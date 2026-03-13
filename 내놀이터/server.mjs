import express from "express";
import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = toPositiveInt(process.env.PORT, 3001);
const CONFIG = {
  savefromUrl: process.env.SAVEFROM_URL || "https://en1.savefrom.net/71/",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || "",
  users: parseCsv(process.env.MONITOR_USERS),
  intervalMs: toPositiveInt(process.env.MONITOR_INTERVAL_MS, 60_000),
  waitAfterSearchMs: toPositiveInt(process.env.WAIT_AFTER_SEARCH_MS, 3_000),
  betweenUsersMs: toPositiveInt(process.env.BETWEEN_USERS_MS, 1_500),
  selectorTimeoutMs: toPositiveInt(process.env.SELECTOR_TIMEOUT_MS, 15_000),
  pageTimeoutMs: toPositiveInt(process.env.PAGE_TIMEOUT_MS, 30_000),
  headless: process.env.MONITOR_HEADLESS !== "false",
  stateFilePath: path.resolve(
    process.env.STATE_FILE_PATH || path.join(__dirname, "monitor-state.json")
  ),
  maxEvents: 100,
};

const runtime = {
  browser: null,
  running: false,
  timer: null,
  stopRequested: false,
  startupErrors: [],
  state: {
    serviceStartedAt: new Date().toISOString(),
    lastCycleStartedAt: null,
    lastCycleFinishedAt: null,
    nextCycleAt: null,
    cycleCount: 0,
    lastTrigger: null,
    lastError: null,
    users: {},
    events: [],
  },
};

app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "monitor.html"));
});

app.get("/health", (req, res) => {
  res.json(buildStatus());
});

app.get("/api/status", (req, res) => {
  res.json(buildStatus());
});

app.post("/api/run-now", async (req, res) => {
  if (!monitorReady()) {
    return res.status(400).json({
      ok: false,
      error: "Monitor is not configured. Set MONITOR_USERS and SLACK_WEBHOOK_URL.",
    });
  }

  if (runtime.running) {
    return res.status(409).json({
      ok: false,
      error: "A monitoring cycle is already running.",
    });
  }

  try {
    await runCycle("manual");
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: String(error),
    });
  }
});

app.post("/api/slack-relay", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!text) {
      return res.status(400).json({
        ok: false,
        error: "text is required",
      });
    }

    await sendSlack(text);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: String(error),
    });
  }
});

await loadState();

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`monitor server listening on http://0.0.0.0:${PORT}`);
});

server.on("error", (error) => {
  console.error("server failed to start:", error);
});

if (monitorReady()) {
  void startMonitorLoop();
} else {
  const message =
    "Monitor is waiting for configuration. Set MONITOR_USERS and SLACK_WEBHOOK_URL.";
  runtime.startupErrors.push(message);
  addEvent("warn", message);
  console.warn(message);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function monitorReady() {
  return CONFIG.users.length > 0 && Boolean(CONFIG.slackWebhookUrl);
}

function buildStatus() {
  return {
    ok: true,
    monitorReady: monitorReady(),
    running: runtime.running,
    config: {
      savefromUrl: CONFIG.savefromUrl,
      users: CONFIG.users,
      intervalMs: CONFIG.intervalMs,
      waitAfterSearchMs: CONFIG.waitAfterSearchMs,
      betweenUsersMs: CONFIG.betweenUsersMs,
      selectorTimeoutMs: CONFIG.selectorTimeoutMs,
      pageTimeoutMs: CONFIG.pageTimeoutMs,
      headless: CONFIG.headless,
      stateFilePath: CONFIG.stateFilePath,
      slackConfigured: Boolean(CONFIG.slackWebhookUrl),
      port: PORT,
    },
    startupErrors: runtime.startupErrors,
    ...runtime.state,
  };
}

function addEvent(level, message, extra = {}) {
  runtime.state.events.unshift({
    at: new Date().toISOString(),
    level,
    message,
    ...extra,
  });
  runtime.state.events = runtime.state.events.slice(0, CONFIG.maxEvents);
}

async function loadState() {
  try {
    const raw = await fs.readFile(CONFIG.stateFilePath, "utf8");
    const parsed = JSON.parse(raw);

    runtime.state = {
      ...runtime.state,
      ...parsed,
      users: parsed?.users && typeof parsed.users === "object" ? parsed.users : {},
      events: Array.isArray(parsed?.events) ? parsed.events : [],
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      runtime.state.lastError = String(error);
      addEvent("error", "Failed to load state file.", { error: String(error) });
      console.error("failed to load state:", error);
    }
  }
}

async function saveState() {
  await fs.mkdir(path.dirname(CONFIG.stateFilePath), { recursive: true });
  const data = JSON.stringify(runtime.state, null, 2);
  await fs.writeFile(CONFIG.stateFilePath, data, "utf8");
}

async function sendSlack(text) {
  if (!CONFIG.slackWebhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL is not configured.");
  }

  const response = await fetch(CONFIG.slackWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const bodyText = await response.text();

  if (!response.ok || bodyText.trim() !== "ok") {
    throw new Error(
      `Slack webhook failed. status=${response.status}, body=${bodyText}`
    );
  }
}

async function ensureBrowser() {
  if (runtime.browser) {
    return runtime.browser;
  }

  runtime.browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  runtime.browser.on("disconnected", () => {
    runtime.browser = null;
    addEvent("warn", "Browser disconnected. It will be recreated on the next cycle.");
  });

  return runtime.browser;
}

async function inspectUser(username) {
  const browser = await ensureBrowser();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });

  page.setDefaultTimeout(CONFIG.selectorTimeoutMs);

  try {
    await page.goto(CONFIG.savefromUrl, {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.pageTimeoutMs,
    });

    await page.locator("#sf_url").fill(username);
    await page.locator("#sf_submit").click();
    await page.waitForTimeout(CONFIG.waitAfterSearchMs);

    const storyCards = page.locator(".ig-stories__card");
    const currentCount = await storyCards.count();

    let detectedUsername = username;
    const nameLocator = page.locator(".ig-stories__user__name").first();

    if ((await nameLocator.count()) > 0) {
      detectedUsername = (await nameLocator.textContent())?.trim() || username;
    }

    return {
      username,
      detectedUsername,
      currentCount,
    };
  } finally {
    await page.close();
  }
}

function buildInitialAlert({ detectedUsername, currentCount }) {
  return [
    "Story detected on first run",
    "",
    `Account: ${detectedUsername}`,
    `Current count: ${currentCount}`,
  ].join("\n");
}

function buildIncreaseAlert({
  detectedUsername,
  previousCount,
  currentCount,
  addedCount,
}) {
  return [
    "Story update detected",
    "",
    `Account: ${detectedUsername}`,
    `Before: ${previousCount}`,
    `Now: ${currentCount}`,
    `Added: ${addedCount}`,
  ].join("\n");
}

async function processUser(username) {
  const result = await inspectUser(username);
  const previous = runtime.state.users[username] || {};
  const previousCount = Number.isFinite(previous.count) ? previous.count : null;

  addEvent("info", "User checked.", {
    username,
    detectedUsername: result.detectedUsername,
    previousCount,
    currentCount: result.currentCount,
  });

  if (previousCount === null) {
    if (result.currentCount > 0) {
      await sendSlack(buildInitialAlert(result));
      addEvent("info", "Initial alert sent.", {
        username,
        currentCount: result.currentCount,
      });
    }
  } else if (result.currentCount > previousCount) {
    const addedCount = result.currentCount - previousCount;
    await sendSlack(
      buildIncreaseAlert({
        detectedUsername: result.detectedUsername,
        previousCount,
        currentCount: result.currentCount,
        addedCount,
      })
    );
    addEvent("info", "Increase alert sent.", {
      username,
      previousCount,
      currentCount: result.currentCount,
      addedCount,
    });
  }

  runtime.state.users[username] = {
    username,
    detectedUsername: result.detectedUsername,
    count: result.currentCount,
    initializedAt: previous.initializedAt || new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
  };

  await saveState();
}

async function runCycle(trigger = "scheduled") {
  if (runtime.running) {
    addEvent("warn", "Skipped cycle because another cycle is already running.", {
      trigger,
    });
    return;
  }

  runtime.running = true;
  runtime.state.lastCycleStartedAt = new Date().toISOString();
  runtime.state.nextCycleAt = null;
  runtime.state.lastTrigger = trigger;
  runtime.state.lastError = null;
  addEvent("info", "Monitoring cycle started.", { trigger });

  try {
    for (let index = 0; index < CONFIG.users.length; index += 1) {
      const username = CONFIG.users[index];

      try {
        await processUser(username);
      } catch (error) {
        runtime.state.lastError = String(error);
        addEvent("error", "User check failed.", {
          username,
          error: String(error),
        });
        console.error(`user check failed: ${username}`, error);
      }

      if (index < CONFIG.users.length - 1) {
        await sleep(CONFIG.betweenUsersMs);
      }
    }
  } finally {
    runtime.running = false;
    runtime.state.cycleCount += 1;
    runtime.state.lastCycleFinishedAt = new Date().toISOString();
    addEvent("info", "Monitoring cycle finished.", { trigger });
    await saveState();
  }
}

async function startMonitorLoop() {
  runtime.stopRequested = false;

  try {
    await runCycle("startup");
  } catch (error) {
    runtime.state.lastError = String(error);
    addEvent("error", "Startup cycle failed.", { error: String(error) });
    console.error("startup cycle failed:", error);
  }

  scheduleNextCycle();
}

function scheduleNextCycle() {
  if (runtime.stopRequested) {
    runtime.state.nextCycleAt = null;
    return;
  }

  runtime.state.nextCycleAt = new Date(
    Date.now() + CONFIG.intervalMs
  ).toISOString();

  runtime.timer = setTimeout(() => {
    void runScheduledCycle();
  }, CONFIG.intervalMs);
}

async function runScheduledCycle() {
  try {
    await runCycle("scheduled");
  } catch (error) {
    runtime.state.lastError = String(error);
    addEvent("error", "Scheduled cycle failed.", { error: String(error) });
    console.error("scheduled cycle failed:", error);
  } finally {
    scheduleNextCycle();
  }
}

async function shutdown(signal) {
  runtime.stopRequested = true;

  if (runtime.timer) {
    clearTimeout(runtime.timer);
    runtime.timer = null;
  }

  runtime.state.nextCycleAt = null;
  addEvent("info", "Shutdown requested.", { signal });
  await saveState();

  if (runtime.browser) {
    await runtime.browser.close();
    runtime.browser = null;
  }

  server.close(() => {
    process.exit(0);
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
