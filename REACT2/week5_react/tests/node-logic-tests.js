/**
 * 역할:
 * - 브라우저 없이도 mini React 런타임과 핵심 diff 로직이 유지되는지 확인하는 Node 테스트입니다.
 */

import { FunctionComponent, renderChild } from "../src/core/component.js";
import { diffTrees } from "../src/core/diff.js";
import { useEffect, useMemo, useState } from "../src/core/hooks.js";
import { flushScheduledUpdates } from "../src/core/scheduler.js";
import { h } from "../src/core/vdom.js";
import { createInitialAppState, createMemoryStorage, createAppStore } from "../src/state/store.js";
import { App } from "../src/ui/appUi.js";

const tests = [
  {
    name: "useState preserves state between renders",
    async run() {
      const renderValues = [];
      const api = {};

      function Counter() {
        const [count, setCount] = useState(0);
        api.setCount = setCount;
        renderValues.push(count);
        return h("div", {}, String(count));
      }

      const component = new FunctionComponent(Counter);
      component.mount();
      api.setCount(2);
      await flushScheduledUpdates();

      assert(renderValues.join(",") === "0,2", "state should survive across renders");
    },
  },
  {
    name: "batched setState schedules only one extra update",
    async run() {
      const api = {};

      function Counter() {
        const [count, setCount] = useState(0);
        api.setCount = setCount;
        return h("div", {}, String(count));
      }

      const component = new FunctionComponent(Counter);
      component.mount();

      api.setCount((previous) => previous + 1);
      api.setCount((previous) => previous + 1);
      await flushScheduledUpdates();

      assert(component.renderCount === 2, "two setState calls should batch into one update");
      assert(component.getStateSnapshot() === 2, "final state should reflect both updates");
    },
  },
  {
    name: "useEffect compares deps and runs cleanup on change",
    async run() {
      const steps = [];
      const api = {};

      function EffectDemo() {
        const [count, setCount] = useState(0);
        api.setCount = setCount;

        useEffect(() => {
          steps.push(`effect:${count}`);
          return () => {
            steps.push(`cleanup:${count}`);
          };
        }, [count]);

        return h("div", {}, String(count));
      }

      const component = new FunctionComponent(EffectDemo);
      component.mount();
      api.setCount(1);
      await flushScheduledUpdates();
      api.setCount(1);
      await flushScheduledUpdates();

      assert(
        steps.join(",") === "effect:0,cleanup:0,effect:1",
        "effect should rerun only when deps change",
      );

      component.destroy();
    },
  },
  {
    name: "useMemo returns cached value when deps do not change",
    async run() {
      let computeCount = 0;
      const api = {};

      function MemoDemo() {
        const [state, setState] = useState({ count: 1, draft: "" });
        api.setState = setState;

        const doubled = useMemo(() => {
          computeCount += 1;
          return state.count * 2;
        }, [state.count]);

        return h("div", {}, String(doubled));
      }

      const component = new FunctionComponent(MemoDemo);
      component.mount();

      api.setState((previous) => ({ ...previous, draft: "only-input-change" }));
      await flushScheduledUpdates();

      const memoHook = component.getHookDebugInfo().find((hook) => hook.kind === "memo");

      assert(computeCount === 1, "memo factory should not rerun when deps are unchanged");
      assert(memoHook.cacheHits === 1, "memo hook should record cache reuse");

      api.setState((previous) => ({ ...previous, count: 2 }));
      await flushScheduledUpdates();

      assert(computeCount === 2, "memo factory should rerun when deps change");
    },
  },
  {
    name: "hooks are blocked inside child components",
    async run() {
      function Child() {
        useState(0);
        return h("span", {}, "bad");
      }

      function Root() {
        return h("div", {}, renderChild(Child));
      }

      const component = new FunctionComponent(Root);

      let error = null;

      try {
        component.mount();
      } catch (caught) {
        error = caught;
      }

      assert(error instanceof Error, "child component hook usage should throw");
      assert(
        error.message.includes("root component"),
        "error message should explain root-only hook restriction",
      );
    },
  },
  {
    name: "diff detects keyed insert and text update",
    async run() {
      const previous = {
        type: "fragment",
        children: [
          {
            type: "element",
            tagName: "li",
            attrs: { "data-key": "1" },
            children: [{ type: "text", value: "A" }],
          },
        ],
      };
      const next = {
        type: "fragment",
        children: [
          {
            type: "element",
            tagName: "li",
            attrs: { "data-key": "2" },
            children: [{ type: "text", value: "B" }],
          },
          {
            type: "element",
            tagName: "li",
            attrs: { "data-key": "1" },
            children: [{ type: "text", value: "A*" }],
          },
        ],
      };

      const changes = diffTrees(previous, next);
      const hasCreate = changes.some((change) => change.type === "CREATE_NODE");
      const hasTextUpdate = changes.some((change) => change.type === "UPDATE_TEXT");
      const hasMove = changes.some((change) => change.type === "MOVE_CHILD");

      assert(hasCreate, "keyed insert should be detected");
      assert(hasTextUpdate, "text update should be detected");
      assert(hasMove, "existing keyed node should be moved");
    },
  },
  {
    name: "stored empty task list should survive reload",
    async run() {
      const storage = createMemoryStorage({
        "virtual-dom:week5:task-manager": JSON.stringify({ tasks: [] }),
      });

      const initialState = createInitialAppState({ storage });

      assert(Array.isArray(initialState.tasks), "tasks should be an array");
      assert(initialState.tasks.length === 0, "empty stored task list should not restore seed tasks");
      assert(initialState.nextId === 1, "empty queue should restart ids from 1");
    },
  },
  {
    name: "corrupted storage payload falls back to seed tasks",
    async run() {
      const storage = createMemoryStorage({
        "virtual-dom:week5:task-manager": "{bad json",
      });

      const initialState = createInitialAppState({ storage });

      assert(initialState.tasks.length === 3, "invalid JSON should recover to seed tasks");
      assert(
        initialState.tasks[0].title === "Engine event sync regression triage",
        "seed data should be restored when stored JSON is unreadable",
      );
    },
  },
  {
    name: "storage read failures fall back to seed tasks",
    async run() {
      const storage = {
        getItem() {
          throw new Error("storage read fail");
        },
      };

      const initialState = createInitialAppState({ storage });

      assert(initialState.tasks.length === 3, "storage read errors should recover to seed tasks");
      assert(initialState.nextId === 4, "seed fallback should preserve the derived next id");
    },
  },
  {
    name: "missing stored tasks payload falls back to seed tasks",
    async run() {
      const storage = createMemoryStorage({
        "virtual-dom:week5:task-manager": JSON.stringify({ foo: "bar" }),
      });

      const initialState = createInitialAppState({ storage });

      assert(initialState.tasks.length === 3, "payloads without tasks should recover to seed tasks");
      assert(
        initialState.tasks[0].title === "Engine event sync regression triage",
        "seed tasks should be used when the tasks field is missing",
      );
    },
  },
  {
    name: "invalid stored task ids recover to numeric ids before adding new work",
    async run() {
      const storage = createMemoryStorage({
        "virtual-dom:week5:task-manager": JSON.stringify({
          tasks: [{ id: "bad-id", title: "legacy payload" }],
        }),
      });
      const store = createAppStore({ storage });
      const component = new FunctionComponent(App, {
        props: { store },
        store,
      });

      component.mount();

      const draftInput = findNode(
        component.currentVdom,
        (node) => node?.type === "element" && node.attrs?.id === "task-title-input",
      );
      const form = findNode(
        component.currentVdom,
        (node) => node?.type === "element" && node.tagName === "form",
      );

      draftInput.attrs.onInput({ target: { value: "new work item" } });
      await flushScheduledUpdates();
      form.attrs.onSubmit({ preventDefault() {} });
      await flushScheduledUpdates();

      const state = component.getStateSnapshot();

      assert(state.tasks[0].id === 2, "new task should receive the next numeric id");
      assert(state.tasks[1].id === 1, "stored malformed id should be normalized during hydration");
      assert(state.nextId === 3, "nextId should remain numeric after recovery");
    },
  },
  {
    name: "duplicate stored task ids are deduplicated during hydration",
    async run() {
      const storage = createMemoryStorage({
        "virtual-dom:week5:task-manager": JSON.stringify({
          tasks: [
            { id: 1, title: "A" },
            { id: 1, title: "B" },
            { id: "bad", title: "C" },
          ],
        }),
      });

      const initialState = createInitialAppState({ storage });
      const ids = initialState.tasks.map((task) => task.id);

      assert(ids.join(",") === "1,2,3", "hydration should recover unique numeric ids");
      assert(initialState.nextId === 4, "nextId should follow the recovered max id");
    },
  },
  {
    name: "malformed task entries do not crash hydration",
    async run() {
      const storage = createMemoryStorage({
        "virtual-dom:week5:task-manager": JSON.stringify({
          tasks: [null, 42, { title: "ok" }],
        }),
      });

      const initialState = createInitialAppState({ storage });

      assert(initialState.tasks.length === 3, "malformed entries should still hydrate into tasks");
      assert(initialState.tasks[0].id === 1, "null entries should recover to a numeric id");
      assert(initialState.tasks[1].title === "Task 2", "primitive entries should fall back to default title");
      assert(initialState.tasks[2].title === "ok", "valid objects should keep their original fields");
      assert(initialState.nextId === 4, "nextId should remain valid after recovery");
    },
  },
  {
    name: "blank stored task titles fall back to generated labels",
    async run() {
      const storage = createMemoryStorage({
        "virtual-dom:week5:task-manager": JSON.stringify({
          tasks: [
            { id: 1, title: "   " },
            { id: 2, title: "" },
            { id: 3, title: "ok" },
          ],
        }),
      });

      const initialState = createInitialAppState({ storage });

      assert(initialState.tasks[0].title === "Task 1", "whitespace-only titles should recover");
      assert(initialState.tasks[1].title === "Task 2", "empty titles should recover");
      assert(initialState.tasks[2].title === "ok", "valid titles should be preserved");
    },
  },
  {
    name: "blank category and createdAt values fall back to defaults",
    async run() {
      const storage = createMemoryStorage({
        "virtual-dom:week5:task-manager": JSON.stringify({
          tasks: [
            { id: 1, title: "ok", category: "   ", createdAt: "" },
            { id: 2, title: "x", category: null, createdAt: null },
          ],
        }),
      });

      const initialState = createInitialAppState({ storage });

      assert(initialState.tasks[0].category === "General", "blank category should recover");
      assert(initialState.tasks[0].createdAt === "2026-04-01", "blank createdAt should recover");
      assert(initialState.tasks[1].category === "General", "null category should recover");
      assert(initialState.tasks[1].createdAt === "2026-04-01", "null createdAt should recover");
    },
  },
  {
    name: "object-like text fields fall back instead of leaking object strings",
    async run() {
      const storage = createMemoryStorage({
        "virtual-dom:week5:task-manager": JSON.stringify({
          tasks: [{ id: 1, title: { bad: true }, category: { x: 1 }, createdAt: { y: 2 } }],
        }),
      });

      const initialState = createInitialAppState({ storage });

      assert(initialState.tasks[0].title === "Task 1", "object title should recover to a default label");
      assert(initialState.tasks[0].category === "General", "object category should recover to default");
      assert(initialState.tasks[0].createdAt === "2026-04-01", "object createdAt should recover to default");
    },
  },
  {
    name: "missing task targets do not mutate action state",
    async run() {
      const store = createAppStore();
      const component = new FunctionComponent(App, {
        props: { store },
        store,
      });

      component.mount();

      const initialState = component.getStateSnapshot();
      const removeButton = findNode(
        component.currentVdom,
        (node) => node?.type === "element" && node.tagName === "button" && node.attrs?.["data-task-id"],
      );
      const checkbox = findNode(
        component.currentVdom,
        (node) => node?.type === "element" && node.tagName === "input" && node.attrs?.type === "checkbox",
      );

      removeButton.attrs.onClick({ currentTarget: { dataset: { taskId: "999" } }, stopPropagation() {} });
      checkbox.attrs.onChange({ currentTarget: { dataset: { taskId: "999" } }, stopPropagation() {} });
      await flushScheduledUpdates();

      const nextState = component.getStateSnapshot();

      assert(nextState.tasks.length === initialState.tasks.length, "missing target should not remove tasks");
      assert(nextState.lastAction === initialState.lastAction, "missing target should not dirty inspector action text");
    },
  },
  {
    name: "edit draft changes reuse memoized task selectors until submit",
    async run() {
      const store = createAppStore();
      const component = new FunctionComponent(App, {
        props: { store },
        store,
      });

      component.mount();

      const editButton = findNode(
        component.currentVdom,
        (node) => node?.type === "element" && node.tagName === "button" && node.children?.[0]?.value === "수정",
      );
      editButton.attrs.onClick({ currentTarget: { dataset: { taskId: "1" } }, stopPropagation() {} });
      await flushScheduledUpdates();

      const memoAfterStart = component.getHookDebugInfo()[2];
      const statsAfterStart = component.getHookDebugInfo()[3];

      const editInput = findNode(
        component.currentVdom,
        (node) => node?.type === "element" && node.attrs?.id === "task-edit-input-1",
      );
      const editForm = findNode(
        component.currentVdom,
        (node) => node?.type === "element" && node.tagName === "form" && node.attrs?.["data-task-id"] === "1",
      );

      editInput.attrs.onInput({ target: { value: "updated runtime task" } });
      await flushScheduledUpdates();

      const memoAfterDraft = component.getHookDebugInfo()[2];
      const statsAfterDraft = component.getHookDebugInfo()[3];

      assert(
        memoAfterDraft.recomputeCount === memoAfterStart.recomputeCount,
        "editing draft should not recompute filtered tasks before submit",
      );
      assert(
        statsAfterDraft.recomputeCount === statsAfterStart.recomputeCount,
        "editing draft should not recompute stats before submit",
      );

      editForm.attrs.onSubmit({
        preventDefault() {},
        stopPropagation() {},
        currentTarget: { dataset: { taskId: "1" } },
      });
      await flushScheduledUpdates();

      const memoAfterSubmit = component.getHookDebugInfo()[2];
      const nextState = component.getStateSnapshot();

      assert(
        memoAfterSubmit.recomputeCount === memoAfterDraft.recomputeCount + 1,
        "submitting an edit should recompute filtered tasks",
      );
      assert(nextState.tasks[0].title === "updated runtime task", "submit should update the task title");
      assert(nextState.editingTaskId === null, "submit should exit edit mode");
    },
  },
  {
    name: "persist failures do not crash the app state flow",
    async run() {
      const storage = {
        getItem() {
          return null;
        },
        setItem() {
          throw new Error("quota exceeded");
        },
      };
      const store = createAppStore({ storage });
      const component = new FunctionComponent(App, {
        props: { store },
        store,
      });

      component.mount();

      const state = component.getStateSnapshot();
      assert(Array.isArray(state.tasks), "app should still mount even when persistence fails");
    },
  },
  {
    name: "scheduled updates are ignored after destroy",
    async run() {
      const api = {};

      function Demo() {
        const [count, setCount] = useState(0);
        api.setCount = setCount;
        return h("div", {}, String(count));
      }

      const component = new FunctionComponent(Demo);
      component.mount();

      api.setCount(1);
      component.destroy();
      await flushScheduledUpdates();

      assert(component.renderCount === 1, "destroyed component should not render again");
      assert(component.isMounted === false, "destroy should keep the component unmounted");
      assert(component.getStateSnapshot() === 1, "state may update, but commit should be skipped");
    },
  },
];

const failures = [];

for (const test of tests) {
  try {
    await test.run();
    console.log(`[PASS] ${test.name}`);
  } catch (error) {
    failures.push({ name: test.name, message: error.message });
    console.error(`[FAIL] ${test.name} - ${error.message}`);
  }
}

if (failures.length > 0) {
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findNode(node, predicate) {
  if (!node) {
    return null;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findNode(child, predicate);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (predicate(node)) {
    return node;
  }

  return findNode(node.children ?? [], predicate);
}
