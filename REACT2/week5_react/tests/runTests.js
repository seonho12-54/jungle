/**
 * 역할:
 * - 브라우저 환경에서 실제 DOM patch와 Todo Dashboard 상호작용을 검증합니다.
 */

import { mountTaskManagerApp } from "../src/main.js";
import { patchDom } from "../src/core/patch.js";
import { flushScheduledUpdates } from "../src/core/scheduler.js";
import { domToVdom } from "../src/core/vdom.js";
import { createMemoryStorage } from "../src/state/store.js";

const results = [];

await runTest("Patch updates only the changed DOM nodes", async () => {
  const container = document.createElement("div");
  container.innerHTML = `<ul><li data-key="1">A</li><li data-key="2">B</li></ul>`;

  const previous = domToVdom(container);
  const nextPreview = document.createElement("div");
  nextPreview.innerHTML = `<ul><li data-key="2">B</li><li data-key="1">A*</li><li data-key="3">C</li></ul>`;
  const next = domToVdom(nextPreview);

  patchDom(container, previous, next);

  const text = Array.from(container.querySelectorAll("li"))
    .map((node) => node.textContent)
    .join(",");

  assert(text === "B,A*,C", "keyed list patch should preserve requested final DOM order");
});

await runTest("Todo app adds a new task", async () => {
  const runtime = createMountedApp();

  try {
    const input = runtime.host.querySelector("#task-title-input");
    const button = runtime.host.querySelector("#task-add-button");

    typeInto(input, "브라우저 기능 테스트 정리");
    await flushScheduledUpdates();
    button.click();
    await flushScheduledUpdates();

    const titles = getTaskTitles(runtime.host);
    assert(titles[0] === "브라우저 기능 테스트 정리", "new task should be prepended to the list");
  } finally {
    runtime.cleanup();
  }
});

await runTest("Todo app toggles completion", async () => {
  const runtime = createMountedApp();

  try {
    const checkbox = runtime.host.querySelector('.task-item input[type="checkbox"]:not(:checked)');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    await flushScheduledUpdates();

    const completedCount = runtime.host.querySelectorAll(".task-item.is-complete").length;
    assert(completedCount >= 2, "toggling a task should update completed styling");
  } finally {
    runtime.cleanup();
  }
});

await runTest("Todo app filters completed tasks", async () => {
  const runtime = createMountedApp();

  try {
    runtime.host.querySelector("#filter-completed").click();
    await flushScheduledUpdates();

    const titles = getTaskTitles(runtime.host);
    assert(titles.length === 1, "completed filter should only show completed items from seed data");
    assert(
      titles[0].includes("Runtime patch rollout"),
      "completed filter should show the completed seed task",
    );
  } finally {
    runtime.cleanup();
  }
});

await runTest("Todo app search input narrows visible tasks", async () => {
  const runtime = createMountedApp();

  try {
    const searchInput = runtime.host.querySelector("#task-search-input");
    typeInto(searchInput, "memo");
    await flushScheduledUpdates();

    const titles = getTaskTitles(runtime.host);
    assert(titles.length === 1, "search should narrow the visible list");
    assert(titles[0].includes("useMemo"), "search result should match the query");
  } finally {
    runtime.cleanup();
  }
});

await runTest("useEffect persists tasks into localStorage", async () => {
  const runtime = createMountedApp();

  try {
    const input = runtime.host.querySelector("#task-title-input");
    const button = runtime.host.querySelector("#task-add-button");

    typeInto(input, "localStorage 저장 확인");
    await flushScheduledUpdates();
    button.click();
    await flushScheduledUpdates();

    const saved = JSON.parse(runtime.storage.getItem(runtime.runtime.store.getStorageKey()));
    const hasTask = saved.tasks.some((task) => task.title === "localStorage 저장 확인");

    assert(hasTask, "tasks should be persisted after effect runs");
  } finally {
    runtime.cleanup();
  }
});

await runTest("Todo app edits an existing task and delays memo recompute until save", async () => {
  const runtime = createMountedApp();

  try {
    const editButton = runtime.host.querySelector('.task-actions button[type="button"]');
    editButton.click();
    await flushScheduledUpdates();

    const memoAfterStart = runtime.runtime.rootComponent.getHookDebugInfo()[2];
    const editInput = runtime.host.querySelector('#task-edit-input-1');
    typeInto(editInput, "edited task title for memo demo");
    await flushScheduledUpdates();

    const memoAfterDraft = runtime.runtime.rootComponent.getHookDebugInfo()[2];
    assert(
      memoAfterDraft.recomputeCount === memoAfterStart.recomputeCount,
      "editing draft should not recompute filtered tasks before save",
    );

    runtime.host.querySelector('.task-edit-form button[type="submit"]').click();
    await flushScheduledUpdates();

    const memoAfterSave = runtime.runtime.rootComponent.getHookDebugInfo()[2];
    const titles = getTaskTitles(runtime.host);

    assert(
      memoAfterSave.recomputeCount === memoAfterDraft.recomputeCount + 1,
      "saving an edit should recompute filtered tasks",
    );
    assert(titles[0] === "edited task title for memo demo", "edited title should be rendered");
  } finally {
    runtime.cleanup();
  }
});

await runTest("memoized filtered list recomputes only when dependencies change", async () => {
  const runtime = createMountedApp();

  try {
    const memoBefore = runtime.runtime.rootComponent.getHookDebugInfo()[2];
    const draftInput = runtime.host.querySelector("#task-title-input");

    typeInto(draftInput, "아직 추가하지 않은 draft");
    await flushScheduledUpdates();

    const memoAfterDraft = runtime.runtime.rootComponent.getHookDebugInfo()[2];
    assert(
      memoAfterDraft.recomputeCount === memoBefore.recomputeCount,
      "draftTitle change should not invalidate filteredTasks memo",
    );

    const searchInput = runtime.host.querySelector("#task-search-input");
    typeInto(searchInput, "hooks");
    await flushScheduledUpdates();

    const memoAfterSearch = runtime.runtime.rootComponent.getHookDebugInfo()[2];
    assert(
      memoAfterSearch.recomputeCount === memoAfterDraft.recomputeCount + 1,
      "search dependency change should recompute filteredTasks memo",
    );
  } finally {
    runtime.cleanup();
  }
});

renderResults();

async function runTest(name, fn) {
  try {
    await fn();
    results.push({ name, status: "pass" });
  } catch (error) {
    results.push({ name, status: "fail", message: error.message });
  }
}

function createMountedApp() {
  const host = document.createElement("div");
  const storage = createMemoryStorage();
  document.body.append(host);

  const runtime = mountTaskManagerApp({
    container: host,
    storage,
  });

  return {
    host,
    storage,
    runtime,
    cleanup() {
      runtime.destroy();
      host.remove();
    },
  };
}

function typeInto(input, value) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function getTaskTitles(host) {
  return Array.from(host.querySelectorAll(".task-title")).map((node) => node.textContent.trim());
}

function renderResults() {
  const list = document.getElementById("test-results");
  const summary = document.getElementById("test-summary");
  const failedCount = results.filter((result) => result.status === "fail").length;

  summary.textContent = failedCount === 0 ? "전체 통과" : `${failedCount}개 실패`;

  list.replaceChildren(
    ...results.map((result) => {
      const item = document.createElement("li");
      item.textContent =
        result.status === "pass"
          ? `[PASS] ${result.name}`
          : `[FAIL] ${result.name} - ${result.message}`;
      return item;
    }),
  );

  if (failedCount > 0) {
    console.error("Browser test failures:", results.filter((result) => result.status === "fail"));
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
