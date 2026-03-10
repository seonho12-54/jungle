import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

if (!SLACK_WEBHOOK_URL) {
  console.error("SLACK_WEBHOOK_URL 환경변수가 없습니다.");
  process.exit(1);
}

const allowedOrigins = new Set([
  "https://en1.savefrom.net",
  "https://savefrom.net",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  console.log("[REQ]", req.method, req.url, "origin =", origin || "-");

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.get("/", (req, res) => {
  res.send("server alive");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use(express.json({ limit: "10kb" }));

app.post("/api/slack-relay", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!text) {
      return res.status(400).json({
        ok: false,
        error: "text is required",
      });
    }

    const slackRes = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const bodyText = await slackRes.text();

    if (!slackRes.ok || bodyText.trim() !== "ok") {
      return res.status(502).json({
        ok: false,
        error: "slack relay failed",
        slackStatus: slackRes.status,
        slackBody: bodyText,
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`relay server listening on http://127.0.0.1:${PORT}`);
});