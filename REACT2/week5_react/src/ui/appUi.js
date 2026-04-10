/**
 * 이 파일은 데모 화면의 왼쪽 "서비스 대시보드" 영역을 구성합니다.
 * 루트 App이 모든 state를 들고 있고, 아래 자식 컴포넌트들은 props만 받아 화면을 그립니다.
 * 오른쪽 inspector 패널에 들어갈 텍스트도 여기서 만들어 줍니다.
 */

import { renderChild } from "../core/component.js";
import { useEffect, useMemo, useState } from "../core/hooks.js";
import { h } from "../core/vdom.js";
import { FILTER_OPTIONS } from "../state/store.js";

const FILTER_LABELS = {
  all: "전체 큐",
  active: "진행 중",
  completed: "완료됨",
};

export function App({ store }) {
  const [state, setState] = useState(() => store.getInitialState());

  const actions = useMemo(() => createActions(setState), []);
  const filteredTasks = useMemo(
    () => selectVisibleTasks(state.tasks, state.search, state.filter),
    [state.tasks, state.search, state.filter],
  );
  const stats = useMemo(
    () => buildStats(state.tasks, filteredTasks.length),
    [state.tasks, filteredTasks.length],
  );

  useEffect(() => {
    store.persistState(state);
  }, [store, state.tasks]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const previousTitle = document.title;
    document.title = `${stats.remaining} open jobs | Mini React Ops Console`;

    return () => {
      document.title = previousTitle;
    };
  }, [stats.remaining, stats.total]);

  return h("div", { class: "ops-dashboard" }, [
    renderChild(WorkspaceHeader, {
      stats,
      filter: state.filter,
      lastAction: state.lastAction,
      stateKeyCount: Object.keys(state).length,
    }),

    h("section", { class: "workspace-card workspace-card--primary" }, [
      h("div", { class: "control-grid" }, [
        renderChild(TaskInput, {
          draftTitle: state.draftTitle,
          onInput: actions.handleDraftInput,
          onSubmit: actions.handleAddSubmit,
        }),
        renderChild(SearchBar, {
          search: state.search,
          onInput: actions.handleSearchInput,
          onClear: actions.handleClearSearch,
        }),
      ]),
      renderChild(FilterTabs, {
        activeFilter: state.filter,
        stats,
        onSelect: actions.handleFilterSelect,
      }),
    ]),

    renderChild(TaskList, {
      tasks: filteredTasks,
      search: state.search,
      onToggle: actions.handleTaskToggle,
      onRemove: actions.handleTaskRemove,
      onEditStart: actions.handleEditStart,
      onEditInput: actions.handleEditInput,
      onEditCancel: actions.handleEditCancel,
      onEditSubmit: actions.handleEditSubmit,
      onFocusRecent: actions.handleRecentTaskFocus,
      activeFilter: state.filter,
      recentTaskId: state.recentTaskId,
      editingTaskId: state.editingTaskId,
      editingDraft: state.editingDraft,
    }),
  ]);
}

export function getInspectorElements(scope = document) {
  const renderCount = scope.getElementById("runtime-render-count");

  if (!renderCount) {
    return null;
  }

  return {
    renderCount,
    changeCount: scope.getElementById("runtime-change-count"),
    completedCount: scope.getElementById("runtime-completed-count"),
    memoCacheHits: scope.getElementById("runtime-memo-cache-hits"),
    summary: scope.getElementById("runtime-summary"),
    stateSnapshot: scope.getElementById("runtime-state"),
    hookSnapshot: scope.getElementById("runtime-hooks"),
    changeLog: scope.getElementById("runtime-changes"),
  };
}

export function renderRuntimeInspector(elements, commit) {
  if (!elements || !commit) {
    return;
  }

  const memoCacheHits = (commit.hooks ?? [])
    .filter((hook) => hook.kind === "memo")
    .reduce((total, hook) => total + Number(hook.cacheHits ?? 0), 0);
  const completedCount = commit.stateSnapshot?.tasks?.filter?.((task) => task.completed).length ?? 0;

  elements.renderCount.textContent = String(commit.renderCount ?? 0);
  elements.changeCount.textContent = String(commit.changeCount ?? 0);
  elements.completedCount.textContent = String(completedCount);
  elements.memoCacheHits.textContent = String(memoCacheHits);
  elements.summary.textContent = formatSummary(commit);
  elements.stateSnapshot.textContent = formatStateSnapshot(commit.stateSnapshot);
  elements.hookSnapshot.textContent = formatHookSnapshot(commit.hooks ?? []);
  elements.changeLog.textContent = formatChangeLog(commit);
}

function WorkspaceHeader({ stats, filter, lastAction, stateKeyCount }) {
  return h("section", { class: "workspace-header" }, [
    h("div", { class: "workspace-header__title" }, [
      h("p", { class: "section-kicker" }, "Mini React Demo"),
      h("h1", {}, "Workflow Operations"),
      h("p", { class: "hero-copy" }, "루트 state, hooks, diff/patch 흐름을 오른쪽 inspector와 함께 확인하는 작업 대시보드입니다."),
    ]),
    h("div", { class: "workspace-header__metrics" }, [
      renderChild(InlineMetric, { label: "Active", value: String(stats.remaining) }),
      renderChild(InlineMetric, { label: "Resolved", value: String(stats.completed) }),
      renderChild(InlineMetric, { label: "Visible", value: String(stats.visibleCount) }),
      renderChild(InlineMetric, { label: "State Keys", value: String(stateKeyCount) }),
    ]),
    h("div", { class: "workspace-header__meta" }, [
      h("span", { class: "meta-pill meta-pill--accent" }, `최근 액션 · ${lastAction}`),
      h("span", { class: "meta-pill" }, `현재 보기 · ${FILTER_LABELS[filter]}`),
      h("span", { class: "meta-pill" }, `완료율 · ${stats.completionRate}%`),
    ]),
  ]);
}

function InlineMetric({ label, value }) {
  return h("article", { class: "inline-metric" }, [
    h("span", {}, label),
    h("strong", {}, value),
  ]);
}

function TaskInput({ draftTitle, onInput, onSubmit }) {
  const isDisabled = draftTitle.trim().length === 0;

  return h("section", { class: "service-panel service-panel--compact" }, [
    h("div", { class: "section-head" }, [
      h("div", {}, [h("p", { class: "section-kicker" }, "Create Job"), h("h2", {}, "워크아이템 등록")]),
      h("span", { class: "section-chip section-chip--soft" }, "setState -> scheduler"),
    ]),
    h("form", { class: "composer-form", onSubmit }, [
      h("input", {
        id: "task-title-input",
        class: "field-input",
        type: "text",
        value: draftTitle,
        placeholder: "예: patch 추적 패널 QA 점검",
        onInput,
      }),
      h(
        "button",
        {
          id: "task-add-button",
          class: "primary-button",
          type: "submit",
          disabled: isDisabled,
        },
        "등록",
      ),
    ]),
  ]);
}

function SearchBar({ search, onInput, onClear }) {
  return h("section", { class: "service-panel service-panel--compact" }, [
    h("div", { class: "section-head section-head--compact" }, [
      h("div", {}, [h("p", { class: "section-kicker" }, "Search"), h("h2", {}, "대상 항목 탐색")]),
      h(
        "button",
        {
          id: "task-search-clear",
          class: "ghost-button",
          type: "button",
          onClick: onClear,
          disabled: search.length === 0,
        },
        "검색 초기화",
      ),
    ]),
    h("input", {
      id: "task-search-input",
      class: "field-input field-input--search",
      type: "search",
      value: search,
      placeholder: "이슈 제목, 카테고리, 런타임 키워드 검색",
      onInput,
    }),
  ]);
}

function FilterTabs({ activeFilter, stats, onSelect }) {
  return h("section", { class: "service-panel service-panel--compact" }, [
    h("div", { class: "section-head section-head--compact" }, [
      h("div", {}, [h("p", { class: "section-kicker" }, "Workflow View"), h("h2", {}, "큐 상태 전환")]),
      h("span", { class: "section-chip section-chip--soft" }, "memo dependency"),
    ]),
    h(
      "div",
      { class: "filter-row" },
      FILTER_OPTIONS.map((filter) =>
        h(
          "button",
          {
            id: `filter-${filter}`,
            class: filter === activeFilter ? "filter-pill is-active" : "filter-pill",
            type: "button",
            "data-filter": filter,
            onClick: onSelect,
          },
          `${FILTER_LABELS[filter]} ${
            filter === "all"
              ? stats.total
              : filter === "active"
                ? stats.remaining
                : stats.completed
          }`,
        ),
      ),
    ),
  ]);
}

function TaskList({
  tasks,
  search,
  onToggle,
  onRemove,
  onEditStart,
  onEditInput,
  onEditCancel,
  onEditSubmit,
  onFocusRecent,
  activeFilter,
  recentTaskId,
  editingTaskId,
  editingDraft,
}) {
  if (tasks.length === 0) {
    return renderChild(EmptyState, { search, activeFilter });
  }

  return h("section", { class: "queue-panel" }, [
    h("div", { class: "section-head" }, [
      h("div", {}, [h("p", { class: "section-kicker" }, "Work Queue"), h("h2", {}, "실시간 워크아이템 보드")]),
      h("span", { class: "section-chip" }, "keyed diff + patch"),
    ]),
    h(
      "ul",
      { class: "task-list" },
      tasks.map((task) =>
        renderChild(TaskItem, {
          task,
          onToggle,
          onRemove,
          onEditStart,
          onEditInput,
          onEditCancel,
          onEditSubmit,
          onFocusRecent,
          isRecent: task.id === recentTaskId,
          isEditing: task.id === editingTaskId,
          editingDraft,
        }),
      ),
    ),
  ]);
}

function TaskItem({
  task,
  onToggle,
  onRemove,
  onEditStart,
  onEditInput,
  onEditCancel,
  onEditSubmit,
  onFocusRecent,
  isRecent,
  isEditing,
  editingDraft,
}) {
  const className = ["task-item", task.completed ? "is-complete" : "", isRecent ? "is-recent" : ""]
    .filter(Boolean)
    .join(" ");

  const handleRecentClick = isRecent ? () => onFocusRecent(task.id) : undefined;
  const handleToggle = (event) => {
    event.stopPropagation();
    onToggle(event);
  };
  const handleRemove = (event) => {
    event.stopPropagation();
    onRemove(event);
  };
  const handleEditStart = (event) => {
    event.stopPropagation();
    onEditStart(event);
  };
  const handleEditCancel = (event) => {
    event.stopPropagation();
    onEditCancel(event);
  };
  const handleEditSubmit = (event) => {
    event.stopPropagation();
    onEditSubmit(event);
  };

  return h(
    "li",
    {
      class: className,
      "data-key": String(task.id),
      onClick: handleRecentClick,
    },
    [
    h("div", { class: "task-item__status" }, [
      h("div", { class: "status-row" }, [
        h("span", { class: task.completed ? "status-pill status-pill--done" : "status-pill" }, task.completed ? "DONE" : "TODO"),
        isRecent ? h("span", { class: "recent-badge" }, "NEW") : null,
      ]),
      h("label", { class: "task-check" }, [
        h("input", {
          type: "checkbox",
          checked: task.completed,
          "data-task-id": String(task.id),
          onChange: handleToggle,
        }),
        h("span", { class: "task-check__visual" }, task.completed ? "완료" : "TODO"),
      ]),
    ]),
    h("div", { class: "task-copy" }, [
      isEditing
        ? h("form", { class: "task-edit-form", onSubmit: handleEditSubmit, "data-task-id": String(task.id) }, [
            h("input", {
              id: `task-edit-input-${task.id}`,
              class: "field-input field-input--inline",
              type: "text",
              value: editingDraft,
              "data-task-id": String(task.id),
              placeholder: "수정할 제목을 입력하세요",
              onInput: onEditInput,
            }),
            h("div", { class: "task-edit-actions" }, [
              h(
                "button",
                {
                  class: "primary-button primary-button--inline",
                  type: "submit",
                  "data-task-id": String(task.id),
                  disabled: editingDraft.trim().length === 0,
                },
                "저장",
              ),
              h(
                "button",
                {
                  class: "ghost-button ghost-button--inline",
                  type: "button",
                  "data-task-id": String(task.id),
                  onClick: handleEditCancel,
                },
                "취소",
              ),
            ]),
          ])
        : h("strong", { class: "task-title" }, task.title),
      h("p", { class: "task-description" }, buildTaskDescription(task)),
      h("div", { class: "task-meta" }, [
        h("span", { class: "task-tag" }, task.category),
        h("span", { class: "task-tag task-tag--muted" }, `ID-${task.id}`),
        h("span", { class: "task-tag task-tag--muted" }, task.createdAt),
      ]),
    ]),
    h("div", { class: "task-actions" }, [
      h(
        "button",
        {
          class: "ghost-button ghost-button--inline",
          type: "button",
          "data-task-id": String(task.id),
          onClick: handleEditStart,
        },
        isEditing ? "편집 중" : "수정",
      ),
      h(
        "button",
        {
          class: "icon-button",
          type: "button",
          "data-task-id": String(task.id),
          onClick: handleRemove,
        },
        "삭제",
      ),
    ]),
    ],
  );
}

function EmptyState({ search, activeFilter }) {
  return h("section", { class: "empty-card" }, [
    h("p", { class: "section-kicker" }, "Queue Empty"),
    h("h2", {}, "현재 조건에 맞는 워크아이템이 없습니다."),
    h(
      "p",
      { class: "empty-copy" },
      search
        ? `검색어 "${search}"와 일치하는 항목이 없어 오른쪽 패널의 memo/diff 로그 변화를 확인하기 좋습니다.`
        : `${FILTER_LABELS[activeFilter]} 조건에서는 표시할 항목이 없습니다. 다른 필터로 전환해 보세요.`,
    ),
  ]);
}

function createActions(setState) {
  return {
    handleDraftInput(event) {
      setState((previousState) => ({
        ...previousState,
        draftTitle: event.target.value,
        lastAction: "입력 버퍼 업데이트",
      }));
    },

    handleSearchInput(event) {
      setState((previousState) => ({
        ...previousState,
        search: event.target.value,
        lastAction: `검색어 변경 -> ${event.target.value || "empty"}`,
      }));
    },

    handleClearSearch() {
      setState((previousState) => ({
        ...previousState,
        search: "",
        lastAction: "검색어 초기화",
      }));
    },

    handleFilterSelect(event) {
      const nextFilter = event.currentTarget.dataset.filter;

      if (!FILTER_OPTIONS.includes(nextFilter)) {
        return;
      }

      setState((previousState) => {
        if (previousState.filter === nextFilter) {
          return previousState;
        }

        return {
          ...previousState,
          filter: nextFilter,
          lastAction: `필터 전환 -> ${nextFilter}`,
        };
      });
    },

    handleAddSubmit(event) {
      event.preventDefault();

      setState((previousState) => {
        const title = previousState.draftTitle.trim();

        if (!title) {
          return previousState;
        }

        const nextTask = {
          id: previousState.nextId,
          title,
          category: classifyTask(title),
          completed: false,
          createdAt: new Date().toISOString().slice(0, 10),
        };

        return {
          ...previousState,
          draftTitle: "",
          nextId: previousState.nextId + 1,
          tasks: [nextTask, ...previousState.tasks],
          lastAction: `워크아이템 생성 -> ${title}`,
          recentTaskId: nextTask.id,
        };
      });
    },

    handleTaskToggle(event) {
      const taskId = Number.parseInt(event.currentTarget.dataset.taskId ?? "", 10);

      if (!Number.isFinite(taskId)) {
        return;
      }

      setState((previousState) => {
        const target = previousState.tasks.find((task) => task.id === taskId);

        if (!target) {
          return previousState;
        }

        return {
          ...previousState,
          tasks: previousState.tasks.map((task) =>
            task.id === taskId ? { ...task, completed: !task.completed } : task,
          ),
          lastAction: `상태 토글 -> ${target.title}`,
          recentTaskId: previousState.recentTaskId === taskId ? null : previousState.recentTaskId,
        };
      });
    },

    handleTaskRemove(event) {
      const taskId = Number.parseInt(event.currentTarget.dataset.taskId ?? "", 10);

      if (!Number.isFinite(taskId)) {
        return;
      }

      setState((previousState) => {
        const target = previousState.tasks.find((task) => task.id === taskId);

        if (!target) {
          return previousState;
        }

        return {
          ...previousState,
          tasks: previousState.tasks.filter((task) => task.id !== taskId),
          lastAction: `워크아이템 보관 -> ${target.title}`,
          recentTaskId: previousState.recentTaskId === taskId ? null : previousState.recentTaskId,
        };
      });
    },

    handleRecentTaskFocus(taskId) {
      setState((previousState) => {
        if (previousState.recentTaskId !== taskId) {
          return previousState;
        }

        return {
          ...previousState,
          recentTaskId: null,
          lastAction: `신규 강조 해제 -> ${taskId}`,
        };
      });
    },

    handleEditStart(event) {
      const taskId = Number.parseInt(event.currentTarget.dataset.taskId ?? "", 10);

      if (!Number.isFinite(taskId)) {
        return;
      }

      setState((previousState) => {
        const target = previousState.tasks.find((task) => task.id === taskId);

        if (!target) {
          return previousState;
        }

        if (previousState.editingTaskId === taskId && previousState.editingDraft === target.title) {
          return previousState;
        }

        return {
          ...previousState,
          editingTaskId: taskId,
          editingDraft: target.title,
          lastAction: `편집 시작 -> ${target.title}`,
        };
      });
    },

    handleEditInput(event) {
      setState((previousState) => ({
        ...previousState,
        editingDraft: event.target.value,
        lastAction: "편집 버퍼 업데이트",
      }));
    },

    handleEditCancel() {
      setState((previousState) => {
        if (previousState.editingTaskId == null && previousState.editingDraft.length === 0) {
          return previousState;
        }

        return {
          ...previousState,
          editingTaskId: null,
          editingDraft: "",
          lastAction: "편집 취소",
        };
      });
    },

    handleEditSubmit(event) {
      event.preventDefault();
      const taskId = Number.parseInt(event.currentTarget.dataset.taskId ?? "", 10);

      if (!Number.isFinite(taskId)) {
        return;
      }

      setState((previousState) => {
        const target = previousState.tasks.find((task) => task.id === taskId);
        const nextTitle = previousState.editingDraft.trim();

        if (!target || !nextTitle) {
          return previousState;
        }

        if (target.title === nextTitle) {
          return {
            ...previousState,
            editingTaskId: null,
            editingDraft: "",
            lastAction: `편집 종료 -> ${target.title}`,
          };
        }

        return {
          ...previousState,
          editingTaskId: null,
          editingDraft: "",
          tasks: previousState.tasks.map((task) =>
            task.id === taskId
              ? { ...task, title: nextTitle, category: classifyTask(nextTitle) }
              : task,
          ),
          lastAction: `워크아이템 수정 -> ${nextTitle}`,
          recentTaskId: taskId,
        };
      });
    },
  };
}

function selectVisibleTasks(tasks, search, filter) {
  const normalizedSearch = search.trim().toLowerCase();

  return tasks.filter((task) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      task.title.toLowerCase().includes(normalizedSearch) ||
      task.category.toLowerCase().includes(normalizedSearch);

    const matchesFilter =
      filter === "all" ||
      (filter === "active" && !task.completed) ||
      (filter === "completed" && task.completed);

    return matchesSearch && matchesFilter;
  });
}

function buildStats(tasks, visibleCount) {
  const completed = tasks.filter((task) => task.completed).length;
  const total = tasks.length;
  const remaining = total - completed;

  return {
    total,
    completed,
    remaining,
    visibleCount,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function classifyTask(title) {
  if (/memo|hook/i.test(title)) {
    return "Hooks";
  }

  if (/patch|diff|dom/i.test(title)) {
    return "Runtime";
  }

  if (/render|effect|state/i.test(title)) {
    return "Engine";
  }

  return "UI";
}

function buildTaskDescription(task) {
  if (task.category === "Hooks") {
    return "Hook 캐시, effect, 상태 보존 흐름을 시연하는 워크아이템입니다.";
  }

  if (task.category === "Runtime") {
    return "Virtual DOM diff/patch 파이프라인에서 변경 로그가 잘 보이는 항목입니다.";
  }

  if (task.category === "Engine") {
    return "루트 state와 렌더 사이클을 설명하기 좋은 엔진 중심 항목입니다.";
  }

  return "사용자 작업 흐름과 UI 상태 전환을 함께 보여주는 대시보드 항목입니다.";
}

function compactState(state) {
  if (!state) {
    return null;
  }

  return {
    draftTitle: state.draftTitle,
    editingTaskId: state.editingTaskId,
    editingDraft: state.editingDraft,
    search: state.search,
    filter: state.filter,
    nextId: state.nextId,
    lastAction: state.lastAction,
    recentTaskId: state.recentTaskId,
    tasks: state.tasks?.map((task) => ({
      id: task.id,
      title: task.title,
      category: task.category,
      completed: task.completed,
    })),
  };
}

function formatSummary(commit) {
  const changeSummary = commit.changeSummary;
  const actionLabel = commit.stateSnapshot?.lastAction ?? "초기 렌더";

  if (!changeSummary || changeSummary.total === 0) {
    return `최근 액션 "${actionLabel}" 이후 실제 DOM patch는 없었습니다.`;
  }

  const byType = Object.entries(changeSummary.byType ?? {})
    .map(([type, count]) => `${type}: ${count}`)
    .join(" / ");

  return `최근 액션 "${actionLabel}" -> 총 ${changeSummary.total}개의 DOM 변경이 반영되었습니다. (${byType})`;
}

function formatStateSnapshot(state) {
  return JSON.stringify(compactState(state), null, 2);
}

function formatHookSnapshot(hooks) {
  const header = [
    "// hook order",
    "// [0] useState(root state)",
    "// [1] useMemo(action map)",
    "// [2] useMemo(filtered tasks)",
    "// [3] useMemo(stats)",
    "// [4] useEffect(localStorage persist)",
    "// [5] useEffect(document.title sync)",
    "",
  ].join("\n");

  return `${header}${JSON.stringify(hooks, null, 2)}`;
}

function formatChangeLog(commit) {
  const actionLabel = commit.stateSnapshot?.lastAction ?? "초기 렌더";
  const lead = inferChangedArea(commit.changes ?? []);
  const summaryLines = [
    `// recent action: ${actionLabel}`,
    `// inferred target: ${lead}`,
    `// render count: ${commit.renderCount ?? 0}`,
    `// patch count: ${commit.changeCount ?? 0}`,
    "",
  ].join("\n");

  if (!commit.changes?.length) {
    return `${summaryLines}// 마지막 렌더에서는 patch 대상이 없었습니다.`;
  }

  return `${summaryLines}${JSON.stringify(commit.changes, null, 2)}`;
}

function inferChangedArea(changes) {
  const serialized = JSON.stringify(changes);

  if (serialized.includes("value") || serialized.includes("draftTitle")) {
    return "입력 컨트롤 또는 검색 필드";
  }

  if (serialized.includes("checked") || serialized.includes("is-complete")) {
    return "워크아이템 상태 토글 영역";
  }

  if (serialized.includes("task-item") || serialized.includes("CREATE_NODE")) {
    return "워크아이템 리스트";
  }

  return "레이아웃 또는 메타 정보";
}
