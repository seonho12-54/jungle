/**
 * 역할:
 * - 루트 컴포넌트가 사용할 초기 상태, localStorage persistence, 마지막 commit 메타데이터를 관리합니다.
 * - setState 이후 update 트리거는 FunctionComponent에 위임하되, store가 루트와 연결되는 구조를 명확히 보여줍니다.
 */

import { sampleTasks } from "../sampleMarkup.js";

export const APP_STORAGE_KEY = "virtual-dom:week5:task-manager";
export const FILTER_OPTIONS = ["all", "active", "completed"];

export function createAppStore(options = {}) {
  const storage = options.storage ?? resolveStorage();
  const storageKey = options.storageKey ?? APP_STORAGE_KEY;
  const initialState = createInitialAppState({
    storage,
    storageKey,
    seedTasks: options.seedTasks ?? sampleTasks,
  });

  let rootComponent = null;
  let lastPersistedState = cloneState(initialState);
  let lastCommit = createEmptyCommit();

  return {
    attachRoot(component) {
      rootComponent = component;
    },

    getInitialState() {
      return cloneState(initialState);
    },

    requestUpdate() {
      return rootComponent?.requestUpdate?.() ?? rootComponent?.update?.();
    },

    persistState(nextState) {
      lastPersistedState = sanitizeState(nextState);

      try {
        storage.setItem(
          storageKey,
          JSON.stringify({
            tasks: lastPersistedState.tasks,
          }),
        );
      } catch {
        // Ignore persistence failures so the in-memory UI can keep working.
      }
    },

    recordCommit(commit) {
      lastCommit = {
        renderCount: commit.renderCount ?? 0,
        hookCount: commit.hookCount ?? 0,
        changeCount: commit.changeSummary?.total ?? 0,
        changeSummary: cloneSerializable(commit.changeSummary ?? { total: 0, byType: {} }),
        stateSnapshot: cloneSerializable(commit.stateSnapshot),
        hooks: cloneSerializable(commit.hooks ?? []),
        changes: (commit.changes ?? []).map((change) => summarizeChange(change)),
      };
    },

    getLastCommit() {
      return cloneSerializable(lastCommit);
    },

    getStorageKey() {
      return storageKey;
    },
  };
}

export function createInitialAppState({ storage, storageKey = APP_STORAGE_KEY, seedTasks = sampleTasks } = {}) {
  const storedPayload = readStoredState(storage, storageKey);
  const hasStoredTasks = Array.isArray(storedPayload?.tasks);
  const tasks = sanitizeTasks(hasStoredTasks ? storedPayload.tasks : seedTasks);

  return {
    tasks,
    draftTitle: "",
    editingTaskId: null,
    editingDraft: "",
    search: "",
    filter: "all",
    nextId: deriveNextId(tasks),
    lastAction: "초기 워크큐 로드",
    recentTaskId: null,
  };
}

export function createMemoryStorage(initialEntries = {}) {
  const memory = new Map(Object.entries(initialEntries));

  return {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },

    setItem(key, value) {
      memory.set(key, String(value));
    },

    removeItem(key) {
      memory.delete(key);
    },

    clear() {
      memory.clear();
    },
  };
}

function resolveStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return createMemoryStorage();
  }

  try {
    const probeKey = "__mini-react-storage-probe__";
    window.localStorage.setItem(probeKey, "ok");
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

function readStoredState(storage, storageKey) {
  if (!storage?.getItem) {
    return null;
  }

  try {
    const raw = storage.getItem(storageKey);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sanitizeState(state) {
  const tasks = sanitizeTasks(state?.tasks ?? sampleTasks);

  return {
    tasks,
    draftTitle: String(state?.draftTitle ?? ""),
    editingTaskId: Number.isFinite(Number(state?.editingTaskId)) ? Number(state.editingTaskId) : null,
    editingDraft: String(state?.editingDraft ?? ""),
    search: String(state?.search ?? ""),
    filter: FILTER_OPTIONS.includes(state?.filter) ? state.filter : "all",
    nextId: Math.max(Number(state?.nextId ?? 0), deriveNextId(tasks)),
    lastAction: String(state?.lastAction ?? "상태 동기화"),
    recentTaskId: Number.isFinite(Number(state?.recentTaskId)) ? Number(state.recentTaskId) : null,
  };
}

function sanitizeTasks(tasks) {
  const seenIds = new Set();

  return tasks.map((task, index) => {
    const safeTask = task && typeof task === "object" ? task : {};
    const normalizedTitle = sanitizeTextValue(safeTask.title, `Task ${index + 1}`);

    return {
      id: sanitizeTaskId(safeTask.id, index, seenIds),
      title: normalizedTitle,
      category: sanitizeTextValue(safeTask.category, "General"),
      completed: Boolean(safeTask.completed),
      createdAt: sanitizeTextValue(safeTask.createdAt, "2026-04-01"),
    };
  });
}

function deriveNextId(tasks) {
  const maxId = tasks.reduce((currentMax, task) => {
    const normalizedId = Number(task.id);
    return Number.isFinite(normalizedId) ? Math.max(currentMax, normalizedId) : currentMax;
  }, 0);
  return maxId + 1;
}

function sanitizeTaskId(rawId, index, seenIds) {
  const normalizedId = Number(rawId);

  if (Number.isInteger(normalizedId) && normalizedId > 0 && !seenIds.has(normalizedId)) {
    seenIds.add(normalizedId);
    return normalizedId;
  }

  let fallbackId = index + 1;

  while (seenIds.has(fallbackId)) {
    fallbackId += 1;
  }

  seenIds.add(fallbackId);
  return fallbackId;
}

function sanitizeTextValue(rawValue, fallbackValue) {
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    return trimmed || fallbackValue;
  }

  if (typeof rawValue === "number" || typeof rawValue === "boolean") {
    return String(rawValue);
  }

  return fallbackValue;
}

function summarizeChange(change) {
  const summarized = {
    type: change.type,
    path: [...(change.path ?? [])],
  };

  if ("attribute" in change) {
    summarized.attribute = change.attribute;
  }

  if ("prevValue" in change && typeof change.prevValue !== "function") {
    summarized.prevValue = change.prevValue;
  }

  if ("nextValue" in change && typeof change.nextValue !== "function") {
    summarized.nextValue = change.nextValue;
  }

  if ("from" in change) {
    summarized.from = change.from;
  }

  if ("to" in change) {
    summarized.to = change.to;
  }

  if ("key" in change) {
    summarized.key = change.key;
  }

  if ("prevNode" in change) {
    summarized.prevNode = summarizeNode(change.prevNode);
  }

  if ("nextNode" in change) {
    summarized.nextNode = summarizeNode(change.nextNode);
  }

  return summarized;
}

function summarizeNode(node) {
  if (!node) {
    return null;
  }

  if (node.type === "text") {
    return {
      type: "text",
      value: node.value,
    };
  }

  if (node.type === "fragment") {
    return {
      type: "fragment",
      childCount: node.children?.length ?? 0,
    };
  }

  return {
    type: "element",
    tagName: node.tagName,
    attrs: Object.fromEntries(
      Object.entries(node.attrs ?? {}).filter(([, value]) => typeof value !== "function"),
    ),
    childCount: node.children?.length ?? 0,
  };
}

function createEmptyCommit() {
  return {
    renderCount: 0,
    hookCount: 0,
    changeCount: 0,
    changeSummary: { total: 0, byType: {} },
    stateSnapshot: null,
    hooks: [],
    changes: [],
  };
}

function cloneState(state) {
  return cloneSerializable(state);
}

function cloneSerializable(value) {
  if (value == null || typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneSerializable(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneSerializable(item)]),
  );
}
