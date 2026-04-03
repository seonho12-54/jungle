import { mountTaskManagerApp } from "../src/main.js";
import { flushScheduledUpdates } from "../src/core/scheduler.js";
import { pushTraceRecorder, resetTraceCounter } from "../src/core/tracer.js";
import { createMemoryStorage } from "../src/state/store.js";

const SCENARIOS = [
  {
    id: "mount",
    title: "빈 DOM에서 첫 마운트까지",
    description:
      "비어 있는 미리보기 컨테이너에서 시작해서 main.js, mountTaskManagerApp, render, VDOM 생성, renderVdom, 실제 DOM 생성, effect 실행까지 처음부터 끝까지 봅니다.",
  },
  {
    id: "draft",
    title: "입력창 state 갱신",
    description:
      "input 이벤트가 루트 state로 들어가고, memo, render, diff, patch를 거쳐 화면에 반영되는 과정을 봅니다.",
    async run({ host }) {
      const input = host.querySelector("#task-title-input");
      typeInto(input, "useMemo 흐름을 실제 값으로 설명하기");
      await flushScheduledUpdates();
    },
  },
  {
    id: "add-task",
    title: "할 일 추가",
    description:
      "draft 입력 후 submit이 일어나고, 새 task가 state, memo 재계산, keyed patch, effect 저장까지 전달되는 과정을 봅니다.",
    async run({ host }) {
      const input = host.querySelector("#task-title-input");
      typeInto(input, "발표 전에 patch 단계 다시 점검");
      await flushScheduledUpdates();

      const form = host.querySelector(".composer-form");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushScheduledUpdates();
    },
  },
  {
    id: "toggle-task",
    title: "완료 체크 토글",
    description:
      "체크박스를 바꾸면서 선택된 task, 통계, effect가 어떻게 다시 계산되는지 따라갑니다.",
    async run({ host }) {
      const checkbox = host.querySelector('.task-item input[type="checkbox"]:not(:checked)');

      if (!checkbox) {
        return;
      }

      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      await flushScheduledUpdates();
    },
  },
  {
    id: "search",
    title: "검색과 useMemo",
    description:
      "검색어를 바꾸면서 filteredTasks용 useMemo가 의존성을 비교하고 다시 계산하는 모습을 봅니다.",
    async run({ host }) {
      const searchInput = host.querySelector("#task-search-input");
      typeInto(searchInput, "memo");
      await flushScheduledUpdates();
    },
  },
  {
    id: "filter",
    title: "필터 버튼 클릭",
    description:
      "필터 버튼 클릭이 state 변경, 새 VDOM, diff 요약, DOM patch 결과로 이어지는 흐름을 봅니다.",
    async run({ host }) {
      const button = host.querySelector("#filter-completed");

      if (!button) {
        return;
      }

      button.click();
      await flushScheduledUpdates();
    },
  },
];

const AUTOPLAY_SPEEDS = {
  slow: 4200,
  normal: 2600,
  fast: 1600,
};

const STAGE_LABELS = {
  SCENARIO: "시나리오",
  BOOT: "시작",
  INPUT: "입력",
  STATE: "상태",
  SCHEDULER: "스케줄러",
  COMPONENT: "컴포넌트",
  VDOM: "화면 설계도",
  MEMO: "메모",
  EFFECT: "이펙트",
  DIFF: "디프",
  PATCH: "패치",
  STORE: "저장",
  TRACE: "기타",
};

const FLOW_STEPS = [
  { key: "SCENARIO", label: "시나리오 준비" },
  { key: "BOOT", label: "시작 / 마운트 진입" },
  { key: "INPUT", label: "브라우저 입력" },
  { key: "STATE", label: "상태 계산" },
  { key: "SCHEDULER", label: "업데이트 예약" },
  { key: "COMPONENT", label: "루트 컴포넌트 실행" },
  { key: "VDOM", label: "가상 DOM 만들기" },
  { key: "MEMO", label: "계산 재사용 판단" },
  { key: "EFFECT", label: "effect 등록 / 실행" },
  { key: "DIFF", label: "이전 트리 비교" },
  { key: "PATCH", label: "실제 DOM 반영" },
  { key: "STORE", label: "스토리지 저장" },
];

let refs = null;
let runtime = null;
let currentSession = null;
let currentScenarioId = null;
let currentStepIndex = 0;
let autoplayTimer = null;
let sourceRenderToken = 0;
const sourceCache = new Map();

window.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});

window.addEventListener("error", (event) => {
  if (!refs) {
    return;
  }

  showError(event.error ?? new Error(event.message));
});

async function bootstrap() {
  try {
    refs = queryRefs();
    renderScenarioButtons();
    bindControls();
    updateTransportState();
    await runScenario("mount");
  } catch (error) {
    showError(error);
  }
}

function queryRefs() {
  return {
    errorBox: document.getElementById("error-box"),
    errorView: document.getElementById("error-view"),
    scenarioButtons: document.getElementById("scenario-buttons"),
    scenarioSummary: document.getElementById("scenario-summary"),
    stepCounter: document.getElementById("step-counter"),
    prevStep: document.getElementById("prev-step"),
    nextStep: document.getElementById("next-step"),
    toggleAutoplay: document.getElementById("toggle-autoplay"),
    resetStepper: document.getElementById("reset-stepper"),
    autoplaySpeed: document.getElementById("autoplay-speed"),
    toggleVdomDetail: document.getElementById("toggle-vdom-detail"),
    flowSummary: document.getElementById("flow-summary"),
    flowTrack: document.getElementById("flow-track"),
    previewRoot: document.getElementById("preview-root"),
    domStatus: document.getElementById("dom-status"),
    stageBadge: document.getElementById("stage-badge"),
    currentType: document.getElementById("current-type"),
    currentTitle: document.getElementById("current-title"),
    currentDescription: document.getElementById("current-description"),
    stepSummaryView: document.getElementById("step-summary-view"),
    transferView: document.getElementById("transfer-view"),
    payloadView: document.getElementById("payload-view"),
    hookLensView: document.getElementById("hook-lens-view"),
    timelineMeta: document.getElementById("timeline-meta"),
    timelineList: document.getElementById("timeline-list"),
    beforeStateView: document.getElementById("before-state-view"),
    afterStateView: document.getElementById("after-state-view"),
    beforeDomView: document.getElementById("before-dom-view"),
    afterDomView: document.getElementById("after-dom-view"),
    sourceMeta: document.getElementById("source-meta"),
    sourceView: document.getElementById("source-view"),
    hooksView: document.getElementById("hooks-view"),
    commitView: document.getElementById("commit-view"),
    storageView: document.getElementById("storage-view"),
  };
}

function renderScenarioButtons() {
  refs.scenarioButtons.replaceChildren(
    ...SCENARIOS.map((scenario) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "edu-scenario-button";
      button.dataset.scenario = scenario.id;
      button.innerHTML = `
        <p class="edu-scenario-button__title">${escapeHtml(scenario.title)}</p>
        <p class="edu-scenario-button__body">${escapeHtml(scenario.description)}</p>
      `;
      button.addEventListener("click", () => {
        void runScenario(scenario.id);
      });
      return button;
    }),
  );
}

function bindControls() {
  refs.prevStep.addEventListener("click", () => {
    setStep(currentStepIndex - 1);
  });

  refs.nextStep.addEventListener("click", () => {
    setStep(currentStepIndex + 1);
  });

  refs.resetStepper.addEventListener("click", () => {
    stopAutoplay();
    setStep(0);
  });

  refs.toggleAutoplay.addEventListener("click", () => {
    if (!currentSession) {
      return;
    }

    if (autoplayTimer) {
      stopAutoplay();
      return;
    }

    refs.toggleAutoplay.textContent = "자동 재생 멈춤";
    autoplayTimer = window.setInterval(() => {
      if (!currentSession || currentStepIndex >= getVisibleEvents().length - 1) {
        stopAutoplay();
        return;
      }

      setStep(currentStepIndex + 1);
    }, AUTOPLAY_SPEEDS[refs.autoplaySpeed.value] ?? AUTOPLAY_SPEEDS.normal);
  });

  window.addEventListener("keydown", (event) => {
    if (!currentSession) {
      return;
    }

    if (event.key === "ArrowRight") {
      setStep(currentStepIndex + 1);
    }

    if (event.key === "ArrowLeft") {
      setStep(currentStepIndex - 1);
    }
  });

  refs.toggleVdomDetail.addEventListener("change", () => {
    if (!currentSession) {
      return;
    }

    refreshStepView();
  });
}

async function runScenario(scenarioId) {
  try {
    stopAutoplay();

    const scenario = SCENARIOS.find((item) => item.id === scenarioId);

    if (!scenario) {
      return;
    }

    currentScenarioId = scenarioId;
    setScenarioButtonState();
    refs.scenarioSummary.textContent = `${scenario.title}: ${scenario.description}`;

    destroyRuntime();
    refs.previewRoot.replaceChildren();

    const storage = createMemoryStorage();
    const tracedEvents = [];
    let beforeSnapshot = createEmptySnapshot();
    let afterSnapshot = createEmptySnapshot();
    let runtimeRef = null;
    let frameCursor = createEmptySnapshot();

    const appendEvent = (event) => {
      frameCursor = recordEventFrame(tracedEvents, frameCursor, event, {
        host: refs.previewRoot,
        runtime: runtimeRef ?? runtime,
        storage,
      });
    };

    for (const event of buildBootstrapPrelude(scenario, refs.previewRoot)) {
      appendEvent(event);
    }

    if (scenario.id === "mount") {
      resetTraceCounter();
      const popRecorder = pushTraceRecorder((event) => {
        appendEvent(event);
      });

      try {
        runtime = mountTaskManagerApp({
          container: refs.previewRoot,
          storage,
          onRuntimeReady(nextRuntime) {
            runtimeRef = nextRuntime;
            runtime = nextRuntime;
          },
        });
        runtimeRef = runtime;
        await flushScheduledUpdates();
      } finally {
        popRecorder();
      }

      beforeSnapshot = createEmptySnapshot();
      afterSnapshot = captureSnapshot({ host: refs.previewRoot, runtime, storage });
    } else {
      runtime = mountTaskManagerApp({
        container: refs.previewRoot,
        storage,
        onRuntimeReady(nextRuntime) {
          runtimeRef = nextRuntime;
          runtime = nextRuntime;
        },
      });
      runtimeRef = runtime;
      await flushScheduledUpdates();
      beforeSnapshot = captureSnapshot({ host: refs.previewRoot, runtime, storage });
      frameCursor = cloneSnapshot(beforeSnapshot);

      appendEvent({
        eventType: "education:baseline-ready",
        payload: {
          scenario: scenario.title,
          note: "이제 기본 마운트가 끝났고, 아래부터는 선택한 상호작용만 추적합니다.",
        },
      });

      resetTraceCounter();
      const popRecorder = pushTraceRecorder((event) => {
        appendEvent(event);
      });

      try {
        await scenario.run({
          host: refs.previewRoot,
          runtime,
        });
        await flushScheduledUpdates();
      } finally {
        popRecorder();
      }

      afterSnapshot = captureSnapshot({ host: refs.previewRoot, runtime, storage });
    }

    appendEvent({
      eventType: "education:scenario:end",
      payload: {
        scenario: scenario.title,
        finalRenderCount: afterSnapshot.commit?.renderCount ?? 0,
        finalChangeCount: afterSnapshot.commit?.changeCount ?? 0,
      },
    });

    currentSession = {
      scenario,
      before: beforeSnapshot,
      after: afterSnapshot,
      events: tracedEvents.map((event, index) => enrichEvent(event, index, scenario)),
    };

    currentStepIndex = 0;
    await refreshStepView();
  } catch (error) {
    showError(error);
  }
}

function buildBootstrapPrelude(scenario, host) {
  return [
    {
      eventType: "education:scenario:start",
      payload: {
        scenario: scenario.title,
        description: scenario.description,
      },
    },
    {
      eventType: "education:boot:html-ready",
      payload: {
        previewTag: host.tagName.toLowerCase(),
        previewChildren: host.childNodes.length,
      },
    },
    {
      eventType: "education:boot:empty-container",
      payload: {
        containerHtmlBefore: host.innerHTML,
      },
    },
    {
      eventType: "education:boot:call-main",
      payload: {
        entry: "mountTaskManagerApp(options)",
        note: "이제 main.js가 container를 받아 루트 런타임을 시작합니다.",
      },
    },
  ];
}

function destroyRuntime() {
  if (!runtime) {
    return;
  }

  runtime.destroy();
  runtime = null;
}

function setScenarioButtonState() {
  for (const button of refs.scenarioButtons.querySelectorAll(".edu-scenario-button")) {
    button.classList.toggle("is-active", button.dataset.scenario === currentScenarioId);
  }
}

function setStep(nextIndex) {
  const visibleEvents = getVisibleEvents();

  if (visibleEvents.length === 0) {
    return;
  }

  const boundedIndex = clamp(nextIndex, 0, visibleEvents.length - 1);

  if (boundedIndex === currentStepIndex) {
    return;
  }

  currentStepIndex = boundedIndex;
  refreshStepView();
}

function updateTransportState() {
  const visibleEvents = getVisibleEvents();
  const hasSession = visibleEvents.length > 0;

  refs.prevStep.disabled = !hasSession || currentStepIndex <= 0;
  refs.nextStep.disabled = !hasSession || currentStepIndex >= visibleEvents.length - 1;
  refs.resetStepper.disabled = !hasSession;
  refs.toggleAutoplay.disabled = !hasSession;
  refs.autoplaySpeed.disabled = !hasSession;
  refs.toggleVdomDetail.disabled = !currentSession;
  refs.stepCounter.textContent = hasSession ? `${currentStepIndex + 1} / ${visibleEvents.length}` : "0 / 0";
}

function renderTimeline() {
  const visibleEvents = getVisibleEvents();

  if (visibleEvents.length === 0) {
    refs.timelineList.replaceChildren();
    return;
  }

  refs.timelineList.replaceChildren(
    ...visibleEvents.map((event, index) => {
      const item = document.createElement("li");
      item.className = "edu-timeline-item";

      if (index === currentStepIndex) {
        item.classList.add("is-active");
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "edu-timeline-button";
      button.innerHTML = `
        <div class="edu-timeline-item__top">
          <span class="edu-timeline-item__index">단계 ${index + 1}</span>
          <span class="edu-timeline-item__stage">${escapeHtml(event.stageLabel)}</span>
        </div>
        <p class="edu-timeline-item__title">${escapeHtml(event.title)}</p>
        <p class="edu-timeline-item__description">${escapeHtml(event.description)}</p>
      `;
      button.addEventListener("click", () => {
        setStep(index);
      });

      item.append(button);
      return item;
    }),
  );

  refs.timelineList.querySelector(".edu-timeline-item.is-active")?.scrollIntoView({
    block: "nearest",
  });
}

async function refreshStepView() {
  const visibleEvents = getVisibleEvents();

  if (visibleEvents.length === 0) {
    currentStepIndex = 0;
    refs.timelineMeta.textContent = "추적 기록 0개";
    refs.timelineList.replaceChildren();
    updateTransportState();
    return;
  }

  currentStepIndex = clamp(currentStepIndex, 0, visibleEvents.length - 1);
  updateTimelineMeta();
  updateTransportState();
  renderTimeline();
  await renderCurrentStep();
}

function updateTimelineMeta() {
  const allEvents = currentSession?.events ?? [];
  const visibleEvents = getVisibleEvents();
  const hiddenCount = allEvents.length - visibleEvents.length;

  if (hiddenCount > 0) {
    refs.timelineMeta.textContent = `표시 ${visibleEvents.length}개 / 전체 ${allEvents.length}개 · VDOM 세부 ${hiddenCount}개 접힘`;
    return;
  }

  refs.timelineMeta.textContent = `추적 기록 ${visibleEvents.length}개`;
}

function getVisibleEvents() {
  if (!currentSession) {
    return [];
  }

  if (refs?.toggleVdomDetail?.checked) {
    return currentSession.events;
  }

  return currentSession.events.filter((event) => !isVerboseVdomEvent(event));
}

function isVerboseVdomEvent(event) {
  return [
    "vdom:dom:create-fragment",
    "vdom:dom:create-element",
    "vdom:dom:create-text",
    "vdom:attr:set",
    "vdom:attr:remove",
  ].includes(event.eventType);
}

async function renderCurrentStep() {
  const event = getVisibleEvents()[currentStepIndex];

  if (!event) {
    return;
  }

  refs.currentType.textContent = `내부 이벤트 이름: ${event.eventType}`;
  refs.currentTitle.textContent = event.title;
  refs.currentDescription.textContent = event.description;
  refs.stageBadge.textContent = event.stageLabel;
  refs.stageBadge.dataset.stage = event.stage;
  refs.stepSummaryView.textContent = buildStepSummary(event);
  refs.transferView.textContent = buildTransferSummary(event);
  refs.payloadView.textContent = pretty(event.payload);
  refs.hookLensView.textContent = pretty(buildHookLens(event));
  refs.hooksView.textContent = pretty(event.afterFrame.hooks);
  refs.commitView.textContent = pretty(event.afterFrame.commit);
  refs.storageView.textContent = pretty(event.afterFrame.storage);
  refs.beforeStateView.textContent = pretty(event.beforeFrame.state);
  refs.afterStateView.textContent = pretty(event.afterFrame.state);
  refs.beforeDomView.textContent = event.beforeFrame.dom;
  refs.afterDomView.textContent = event.afterFrame.dom;
  refs.domStatus.textContent = buildDomStatus(event);
  refs.flowSummary.textContent = buildFlowSummary(event);
  renderFlowTrack(event);

  const token = ++sourceRenderToken;
  const sourceResult = await loadSourceSnippet(event.source);

  if (token !== sourceRenderToken) {
    return;
  }

  refs.sourceMeta.textContent = sourceResult.meta;
  refs.sourceView.textContent = sourceResult.code;
}

function buildHookLens(event) {
  if (
    event.eventType.startsWith("memo:") ||
    event.eventType.startsWith("effect:") ||
    event.eventType.startsWith("state:")
  ) {
    return event.payload;
  }

  return event.afterFrame.hooks;
}

function buildDomStatus(event) {
  const domChanged = event.beforeFrame.dom !== event.afterFrame.dom;

  if (domChanged) {
    return "이 단계에서 실제 DOM 문자열이 바뀌었습니다. 미리보기 화면과 아래 DOM 패널을 같이 보세요.";
  }

  if (event.stage === "PATCH" || event.stage === "VDOM") {
    return "이 단계는 DOM 반영 직전이거나 반영 준비 단계입니다. 아직 눈에 띄는 문자열 변화가 없을 수 있습니다.";
  }

  if (event.stage === "EFFECT") {
    return "이 단계는 DOM이 아니라 effect 또는 저장 로직을 보는 구간입니다.";
  }

  return "이 단계에서는 실제 DOM보다 state, hook, 계산 흐름을 보는 것이 더 중요합니다.";
}

function enrichEvent(rawEvent, index, scenario) {
  const { stage, title, description } = describeEvent(rawEvent, scenario);

  return {
    sequence: index + 1,
    eventType: rawEvent.eventType,
    payload: rawEvent.payload ?? {},
    stage,
    stageLabel: STAGE_LABELS[stage] ?? stage,
    title,
    description,
    source: getSourceDescriptor(rawEvent.eventType),
    beforeFrame: rawEvent.beforeFrame ?? createEmptySnapshot(),
    afterFrame: rawEvent.afterFrame ?? createEmptySnapshot(),
  };
}

function recordEventFrame(events, previousFrame, rawEvent, context) {
  const beforeFrame = cloneSnapshot(previousFrame);
  const afterFrame = captureSnapshot(context);

  events.push({
    ...rawEvent,
    beforeFrame,
    afterFrame,
  });

  return cloneSnapshot(afterFrame);
}

function renderFlowTrack(event) {
  const currentIndex = FLOW_STEPS.findIndex((step) => step.key === event.stage);

  refs.flowTrack.replaceChildren(
    ...FLOW_STEPS.map((step, index) => {
      const node = document.createElement("div");
      node.className = "edu-flow-step";

      if (index < currentIndex) {
        node.classList.add("is-passed");
      }

      if (index === currentIndex) {
        node.classList.add("is-current");
      }

      node.innerHTML = `
        <span class="edu-flow-step__stage">${escapeHtml(step.key)}</span>
        <span class="edu-flow-step__label">${escapeHtml(step.label)}</span>
      `;
      return node;
    }),
  );
}

function buildFlowSummary(event) {
  const detailMode = refs.toggleVdomDetail.checked ? "세부 단계 표시 중" : "간단 모드";
  return `${event.stageLabel} 단계입니다. "${event.title}" 이벤트를 보면서 아래의 직전/직후 상태와 DOM이 어떻게 달라지는지 확인해 보세요. 현재 보기: ${detailMode}.`;
}

function buildStepSummary(event) {
  const lines = [
    `단계 그룹: ${event.stageLabel}`,
    `이벤트: ${event.eventType}`,
    `설명: ${event.title}`,
    `상태 변화: ${buildStateDeltaSummary(event.beforeFrame.state, event.afterFrame.state)}`,
    `DOM 변화: ${buildDomDeltaSummary(event.beforeFrame.dom, event.afterFrame.dom)}`,
  ];

  if (event.afterFrame.commit?.renderCount != null) {
    lines.push(`현재 렌더 횟수: ${event.afterFrame.commit.renderCount}`);
  }

  if (event.stage === "VDOM" && !refs.toggleVdomDetail.checked) {
    lines.push("참고: 엘리먼트 생성, 텍스트 생성, 속성 설정 같은 잔단계는 지금 접혀 있습니다.");
  }

  return lines.join("\n");
}

function buildTransferSummary(event) {
  const payload = event.payload ?? {};

  if (event.eventType.startsWith("ui:event:")) {
    return [
      "입력 위치: 브라우저 이벤트 핸들러",
      `들어온 값: ${summarizeSmallValue(payload.value ?? payload.taskId ?? payload.nextFilter ?? payload)}`,
      "다음 이동: action 함수 안에서 setState 호출 준비",
    ].join("\n");
  }

  if (event.eventType.startsWith("ui:updater:")) {
    return [
      "입력 위치: setState(갱신 함수) 내부",
      `이전 상태: ${summarizeSmallValue(payload.previousState)}`,
      `다음 상태: ${summarizeSmallValue(payload.nextState ?? payload.previousState)}`,
      `바뀐 필드: ${buildStateDeltaSummary(payload.previousState, payload.nextState)}`,
    ].join("\n");
  }

  if (event.eventType === "state:setter:called") {
    return [
      "입력 위치: useState setter",
      `이전 값: ${summarizeSmallValue(payload.previousValue)}`,
      `들어온 인자: ${summarizeSmallValue(payload.nextValue)}`,
      "다음 이동: 갱신 함수라면 먼저 실제 값으로 계산합니다.",
    ].join("\n");
  }

  if (event.eventType === "state:setter:resolved") {
    return [
      "입력 위치: setState 내부 계산 완료",
      `이전 값: ${summarizeSmallValue(payload.previousValue)}`,
      `계산된 다음 값: ${summarizeSmallValue(payload.resolvedValue)}`,
      "다음 이동: 값이 달라졌다면 스케줄러로 업데이트를 넘깁니다.",
    ].join("\n");
  }

  if (event.eventType === "state:setter:scheduled") {
    return [
      "입력 위치: 변경된 hook slot",
      `저장된 값: ${summarizeSmallValue(payload.value)}`,
      "다음 이동: component.requestUpdate() 또는 store.requestUpdate()",
    ].join("\n");
  }

  if (event.eventType === "memo:hook") {
    return [
      "입력 위치: useMemo 의존성 비교",
      `이전 deps: ${summarizeSmallValue(payload.previousDeps)}`,
      `다음 deps: ${summarizeSmallValue(payload.nextDeps)}`,
      `재계산 여부: ${payload.shouldRecompute ? "예" : "아니오"}`,
    ].join("\n");
  }

  if (event.eventType === "memo:compute" || event.eventType === "memo:cache-hit") {
    return [
      `계산 결과: ${summarizeSmallValue(payload.value)}`,
      `deps: ${summarizeSmallValue(payload.nextDeps)}`,
      event.eventType === "memo:compute"
        ? "다음 이동: 이 값을 사용해 render 결과를 만듭니다."
        : "다음 이동: 캐시된 값을 그대로 render에 재사용합니다.",
    ].join("\n");
  }

  if (event.eventType === "effect:register") {
    return [
      "입력 위치: useEffect 등록 단계",
      `이전 deps: ${summarizeSmallValue(payload.previousDeps)}`,
      `다음 deps: ${summarizeSmallValue(payload.nextDeps)}`,
      `실행 예정: ${payload.shouldRun ? "예, commit 뒤에 실행" : "아니오"}`,
    ].join("\n");
  }

  if (event.eventType.startsWith("effect:")) {
    return [
      "입력 위치: commit 이후 effect flush",
      `deps 또는 인덱스 정보: ${summarizeSmallValue(payload.deps ?? payload.index ?? payload)}`,
      "다음 이동: cleanup 또는 effect body 실행",
    ].join("\n");
  }

  if (event.eventType.startsWith("scheduler:")) {
    return [
      "입력 위치: 묶음 처리 스케줄러",
      `현재 정보: ${summarizeSmallValue(payload)}`,
      "다음 이동: 루트 컴포넌트 update -> 실행",
    ].join("\n");
  }

  if (event.eventType.startsWith("component:")) {
    return [
      "입력 위치: FunctionComponent",
      `현재 payload: ${summarizeSmallValue(payload)}`,
      "다음 이동: render -> diff -> patch -> effect flush 순서로 진행됩니다.",
    ].join("\n");
  }

  if (event.eventType.startsWith("vdom:")) {
    return [
      "입력 위치: 가상 DOM 생성 / 실제 DOM 생성 도우미",
      `현재 payload: ${summarizeSmallValue(payload)}`,
      refs.toggleVdomDetail.checked
        ? "다음 이동: 첫 마운트면 createDomFromVdom, 업데이트면 diff/patch로 이어집니다."
        : "다음 이동: 지금은 큰 흐름만 보입니다. 세부 엘리먼트 생성 단계는 접혀 있습니다.",
    ].join("\n");
  }

  if (event.eventType.startsWith("diff:")) {
    return [
      "입력 위치: 이전 VDOM과 다음 VDOM 비교",
      `변경 요약: ${summarizeSmallValue(payload.changeSummary ?? payload.changes ?? payload)}`,
      "다음 이동: patch 단계에서 실제 DOM에 최소 변경만 반영합니다.",
    ].join("\n");
  }

  if (event.eventType.startsWith("patch:")) {
    return [
      "입력 위치: 실제 DOM 반영 단계",
      `현재 payload: ${summarizeSmallValue(payload)}`,
      "다음 이동: DOM 반영이 끝나면 effect flush로 넘어갑니다.",
    ].join("\n");
  }

  if (event.eventType.startsWith("store:")) {
    return [
      "입력 위치: 앱 저장소",
      `현재 payload: ${summarizeSmallValue(payload)}`,
      "다음 이동: 로컬 저장소나 commit 기록이 갱신됩니다.",
    ].join("\n");
  }

  return [
    "입력 위치: 교육용 추적 이벤트",
    `현재 payload: ${summarizeSmallValue(payload)}`,
    "이 단계는 흐름을 설명하기 위한 보조 이벤트입니다.",
  ].join("\n");
}

function buildStateDeltaSummary(beforeState, afterState) {
  if (beforeState == null && afterState == null) {
    return "상태 없음";
  }

  const beforeObject = beforeState ?? {};
  const afterObject = afterState ?? {};
  const keys = new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)]);
  const changes = [];

  for (const key of keys) {
    const beforeValue = beforeObject[key];
    const afterValue = afterObject[key];

    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
      continue;
    }

    changes.push(`${key}: ${summarizeSmallValue(beforeValue)} -> ${summarizeSmallValue(afterValue)}`);
  }

  return changes.length > 0 ? changes.join(" | ") : "눈에 띄는 상태 변화 없음";
}

function buildDomDeltaSummary(beforeDom, afterDom) {
  return beforeDom === afterDom ? "DOM 문자열 변화 없음" : "DOM 문자열 변화 있음";
}

function describeEvent(event, scenario) {
  const payload = event.payload ?? {};

  switch (event.eventType) {
    case "education:scenario:start":
      return {
        stage: "SCENARIO",
        title: `${payload.scenario} 시작`,
        description: payload.description,
      };
    case "education:boot:html-ready":
      return {
        stage: "BOOT",
        title: "교육 페이지 준비 완료",
        description: `미리보기 컨테이너는 아직 비어 있습니다. childNodes=${payload.previewChildren}.`,
      };
    case "education:boot:empty-container":
      return {
        stage: "BOOT",
        title: "빈 컨테이너 확인",
        description: "이 컨테이너가 첫 번째 실제 DOM 결과로 교체될 자리입니다.",
      };
    case "education:boot:call-main":
      return {
        stage: "BOOT",
        title: "이제 main.js로 진입",
        description: payload.note,
      };
    case "education:baseline-ready":
      return {
        stage: "SCENARIO",
        title: "기준 상태 준비 완료",
        description: payload.note,
      };
    case "education:scenario:end":
      return {
        stage: "SCENARIO",
        title: `${payload.scenario} 종료`,
        description: `최종 렌더 횟수=${payload.finalRenderCount ?? 0}, 변경 횟수=${payload.finalChangeCount ?? 0}.`,
      };
    default:
      return {
        stage: inferStage(event.eventType),
        title: summarizeEventTitle(event.eventType, payload, scenario),
        description: summarizeEventDescription(event.eventType, payload),
      };
  }
}

function summarizeEventTitle(eventType, payload, scenario) {
  if (eventType === "bootstrap:mount-app:start") return "mountTaskManagerApp 시작";
  if (eventType === "bootstrap:store-ready") return "스토어 준비 완료";
  if (eventType === "bootstrap:root-component-created") return "FunctionComponent(App) 생성";
  if (eventType === "bootstrap:root-mount-call") return "rootComponent.mount() 호출";
  if (eventType === "bootstrap:mount-app:complete") return "mountTaskManagerApp 종료";
  if (eventType === "component:mount:requested") return "FunctionComponent.mount() 호출 요청";
  if (eventType === "component:update:requested") return "FunctionComponent.update() 호출 요청";
  if (eventType === "component:commit:start") return `${payload.phase ?? "render"} commit 시작`;
  if (eventType === "component:render:start") return "루트 render 시작";
  if (eventType === "component:render:output") return "실행 결과로 새 VDOM 생성";
  if (eventType === "component:commit:complete") return "commit 완료";
  if (eventType === "component:child-render") return `${payload.component ?? "Child"} 렌더링`;
  if (eventType === "vdom:normalize-root") return "화면 설계도 정리";
  if (eventType === "vdom:render:start") return "설계도를 실제 DOM으로 바꾸기 시작";
  if (eventType === "vdom:render:end") return "설계도가 실제 DOM이 됨";
  if (eventType === "vdom:dom:create-fragment") return "DocumentFragment 생성";
  if (eventType === "vdom:dom:create-element") return `<${payload.tagName ?? "node"}> 생성`;
  if (eventType === "vdom:dom:create-text") return "텍스트 노드 생성";
  if (eventType === "vdom:attr:set") return `속성 설정: ${payload.name ?? "unknown"}`;
  if (eventType === "vdom:attr:remove") return `속성 제거: ${payload.name ?? "unknown"}`;
  if (eventType === "state:hook:init") return `useState slot ${payload.index ?? "?"} 초기화`;
  if (eventType === "state:hook:read") return `useState slot ${payload.index ?? "?"} 읽기`;
  if (eventType === "state:setter:called") return "setState 호출";
  if (eventType === "state:setter:resolved") return "setState 다음 값 계산 완료";
  if (eventType === "state:setter:no-change") return "setState 변화 없음";
  if (eventType === "state:setter:scheduled") return "setState가 업데이트 예약";
  if (eventType === "memo:hook") return "useMemo 의존성 비교";
  if (eventType === "memo:compute") return "memo 재계산";
  if (eventType === "memo:cache-hit") return "memo 캐시 재사용";
  if (eventType === "effect:register") return "useEffect 의존성 확인";
  if (eventType === "effect:flush:start") return "effect 실행 묶음 시작";
  if (eventType === "effect:cleanup") return "이전 cleanup 실행";
  if (eventType === "effect:run") return "effect 실행";
  if (eventType === "effect:run:complete") return "effect 실행 완료";
  if (eventType === "effect:flush:end") return "effect 실행 묶음 종료";
  if (eventType === "scheduler:queue") return "스케줄러 큐 등록";
  if (eventType === "scheduler:flush:start") return "스케줄러 비우기 시작";
  if (eventType === "scheduler:flush:end") return "스케줄러 비우기 종료";
  if (eventType === "diff:summary") return "diff 요약 생성";
  if (eventType === "patch:apply:start") return "patch 적용 시작";
  if (eventType === "patch:start") return "patchDom 시작";
  if (eventType === "patch:reuse-keyed") return `keyed 노드 재사용: ${payload.key ?? ""}`;
  if (eventType === "patch:move-keyed") return `keyed 노드 이동: ${payload.key ?? ""}`;
  if (eventType === "patch:reuse-unkeyed") return "unkeyed 노드 재사용";
  if (eventType === "patch:create-node" || eventType === "patch:create-child") return "새 DOM 노드 생성";
  if (eventType === "patch:remove-node" || eventType === "patch:remove-detached-child") return "DOM 노드 제거";
  if (eventType === "patch:replace-node") return "DOM 노드 교체";
  if (eventType === "patch:update-text") return "텍스트 노드 갱신";
  if (eventType === "patch:sync-attributes") return "속성 동기화";
  if (eventType === "patch:apply:end" || eventType === "patch:finish") return "patch 적용 종료";
  if (eventType === "store:initial-state") return "초기 상태 생성";
  if (eventType === "store:persist") return "상태를 저장소에 저장";
  if (eventType.startsWith("ui:event:")) return `UI 이벤트: ${eventType.replace("ui:event:", "")}`;
  if (eventType.startsWith("ui:updater:")) return `상태 갱신 함수: ${eventType.replace("ui:updater:", "")}`;
  return `${scenario.title} 관련 이벤트`;
}

function summarizeEventDescription(eventType, payload) {
  if (eventType === "bootstrap:mount-app:start") return "main.js가 container를 받아 루트 런타임 연결을 시작합니다.";
  if (eventType === "bootstrap:store-ready") return "초기 상태가 준비되었고 이제 루트 컴포넌트를 만들 수 있습니다.";
  if (eventType === "bootstrap:root-component-created") return "App 함수가 FunctionComponent로 감싸졌지만 DOM 컨테이너는 아직 비어 있습니다.";
  if (eventType === "bootstrap:root-mount-call") return "첫 전체 렌더링 파이프라인이 여기서 시작됩니다.";
  if (eventType === "bootstrap:mount-app:complete") return "첫 마운트가 끝났고 컨테이너에는 실제 DOM이 들어 있습니다.";
  if (eventType === "component:commit:start") return "이전 VDOM을 잡아두고 새 render를 시작합니다.";
  if (eventType === "component:render:start") return "루트 함수가 다시 실행되기 전에 hookCursor가 0으로 초기화됩니다.";
  if (eventType === "component:render:output") return "루트 함수가 새 VDOM 트리를 반환했습니다.";
  if (eventType === "component:child-render") return "자식 컴포넌트는 props만 받아 렌더링됩니다. 이 프로젝트에서는 자식 hook 사용이 막혀 있습니다.";
  if (eventType === "vdom:normalize-root") return `컴포넌트가 만든 화면 설계도를 루트 트리 형태로 정리합니다. mode=${payload.mode ?? "unknown"}.`;
  if (eventType === "vdom:render:start") return "첫 마운트라서 이 설계도를 실제 DOM으로 바꾸는 작업을 시작합니다.";
  if (eventType === "vdom:render:end") return "설계도가 실제 DOM으로 바뀌어 container 안에 들어갔습니다.";
  if (eventType === "vdom:dom:create-fragment") return `fragment 노드를 실제 DOM 자식들로 펼치는 중입니다. path=${JSON.stringify(payload.path ?? [])}.`;
  if (eventType === "vdom:dom:create-element") return `실제 DOM element <${payload.tagName ?? "node"}>가 생성됩니다.`;
  if (eventType === "vdom:dom:create-text") return `실제 Text node가 "${payload.value ?? ""}" 값으로 생성됩니다.`;
  if (eventType === "vdom:attr:set") return `초기 속성 쓰기: ${payload.name ?? "unknown"}.`;
  if (eventType === "vdom:attr:remove") return `속성 제거: ${payload.name ?? "unknown"}.`;
  if (eventType === "state:hook:init") return "hook slot이 처음 만들어져 다음 함수 호출에서도 값이 유지됩니다.";
  if (eventType === "state:hook:read") return "hookCursor를 이용해 현재 slot의 값을 읽어 옵니다.";
  if (eventType === "state:setter:called") return "setter는 직접 값 또는 updater 함수를 인자로 받습니다.";
  if (eventType === "state:setter:resolved") return "updater 함수였다면 여기서 실제 다음 값으로 계산됩니다.";
  if (eventType === "state:setter:no-change") return "Object.is 기준으로 값이 같아서 업데이트를 예약하지 않습니다.";
  if (eventType === "state:setter:scheduled") return "hook slot 값이 바뀌었으므로 scheduler에 component update를 넘깁니다.";
  if (eventType === "memo:hook") return "이전 deps와 다음 deps를 비교해 재계산 여부를 판단합니다.";
  if (eventType === "memo:compute") return "deps가 바뀌어서 memo 계산 함수가 다시 실행됩니다.";
  if (eventType === "memo:cache-hit") return "deps가 같아서 캐시된 값을 그대로 씁니다.";
  if (eventType === "effect:register") {
    return payload.shouldRun
      ? "deps가 바뀌었으므로 DOM 작업 후 effect를 실행 대기열에 올립니다."
      : "deps가 바뀌지 않아 이번 render에서는 effect를 건너뜁니다.";
  }
  if (eventType === "effect:flush:start") return "DOM 반영이 끝났고 이제 queue에 쌓인 effect를 실행할 수 있습니다.";
  if (eventType === "effect:cleanup") return "새 effect 전에 이전 cleanup을 먼저 실행합니다.";
  if (eventType === "effect:run") return "effect 본문이 지금 실행됩니다. render와 DOM 업데이트 이후입니다.";
  if (eventType === "effect:run:complete") {
    return payload.hasCleanup
      ? "이 effect는 다음 사이클을 위한 cleanup 함수를 반환했습니다."
      : "이 effect는 cleanup 함수를 반환하지 않았습니다.";
  }
  if (eventType === "scheduler:queue") return `현재 대기 중인 update 수는 ${payload.pendingCount ?? 0}개입니다.`;
  if (eventType === "scheduler:flush:start") return "묶인 update들이 microtask 안에서 실행되기 시작합니다.";
  if (eventType === "scheduler:flush:end") return "이번 microtask 배치가 끝났습니다.";
  if (eventType === "diff:summary") return `이전 VDOM과 다음 VDOM 비교 결과 ${payload.changeSummary?.total ?? 0}개의 변경이 감지되었습니다.`;
  if (eventType === "patch:apply:start") return "이제 실제 DOM 업데이트가 시작됩니다.";
  if (eventType === "patch:start") return "patchDom이 이전/다음 자식 목록을 맞춰 가는 중입니다.";
  if (eventType === "patch:reuse-keyed") return `key=${payload.key ?? ""} 노드는 재사용할 수 있습니다.`;
  if (eventType === "patch:move-keyed") return `key=${payload.key ?? ""} 노드를 ${payload.from ?? "?"} -> ${payload.to ?? "?"}로 이동합니다.`;
  if (eventType === "patch:reuse-unkeyed") return "unkeyed DOM 노드를 인덱스 순서대로 재사용합니다.";
  if (eventType === "patch:create-node" || eventType === "patch:create-child") return "이전에 없던 노드라서 새 DOM 노드를 만듭니다.";
  if (eventType === "patch:remove-node" || eventType === "patch:remove-detached-child") return "다음 VDOM에 없으므로 DOM 노드를 제거합니다.";
  if (eventType === "patch:replace-node") return "노드 모양이 달라서 기존 DOM 노드를 통째로 교체합니다.";
  if (eventType === "patch:update-text") return `텍스트가 "${payload.from ?? ""}" -> "${payload.to ?? ""}"로 바뀝니다.`;
  if (eventType === "patch:sync-attributes") return "바뀐 속성만 실제 element에 동기화합니다.";
  if (eventType === "patch:apply:end" || eventType === "patch:finish") return "실제 DOM 업데이트가 끝났습니다.";
  if (eventType === "store:initial-state") return "초기 상태는 seed 데이터 또는 storage에서 만들어집니다.";
  if (eventType === "store:persist") return "최신 작업 목록이 effect를 통해 storage에 기록됩니다.";
  if (eventType.startsWith("ui:event:")) return "브라우저 이벤트가 루트 action handler 안으로 들어왔습니다.";
  if (eventType.startsWith("ui:updater:")) return "함수형 상태 갱신 함수가 새 상태 객체를 만들었습니다.";
  return `${eventType} 이벤트가 기록되었습니다.`;
}

function inferStage(eventType) {
  if (eventType.startsWith("education:boot:")) return "BOOT";
  if (eventType.startsWith("bootstrap:")) return "BOOT";
  if (eventType.startsWith("ui:")) return "INPUT";
  if (eventType.startsWith("state:")) return "STATE";
  if (eventType.startsWith("memo:")) return "MEMO";
  if (eventType.startsWith("effect:")) return "EFFECT";
  if (eventType.startsWith("scheduler:")) return "SCHEDULER";
  if (eventType.startsWith("component:")) return "COMPONENT";
  if (eventType.startsWith("vdom:")) return "VDOM";
  if (eventType.startsWith("diff:")) return "DIFF";
  if (eventType.startsWith("patch:")) return "PATCH";
  if (eventType.startsWith("store:")) return "STORE";
  return "TRACE";
}

function getSourceDescriptor(eventType) {
  if (eventType.startsWith("education:boot:")) {
    return { file: "../education/app.js", anchor: "function buildBootstrapPrelude(scenario, host)", radius: 18 };
  }

  if (eventType.startsWith("bootstrap:")) {
    return { file: "../src/main.js", anchor: "export function mountTaskManagerApp(options = {})", radius: 26 };
  }

  if (eventType === "vdom:normalize-root") {
    return { file: "../src/core/vdom.js", anchor: "export function normalizeRootVdom(vnode)", radius: 20 };
  }

  if (eventType.startsWith("vdom:render")) {
    return { file: "../src/core/vdom.js", anchor: "export function renderVdom(container, vnode)", radius: 20 };
  }

  if (eventType.startsWith("vdom:dom:create") || eventType.startsWith("vdom:attr:")) {
    return { file: "../src/core/vdom.js", anchor: "export function createDomFromVdom(vnode, path = [])", radius: 30 };
  }

  if (eventType.startsWith("ui:event:draft") || eventType.startsWith("ui:updater:draft")) {
    return { file: "../src/ui/appUi.js", anchor: "handleDraftInput(event)", radius: 12 };
  }

  if (eventType.startsWith("ui:event:search") || eventType.startsWith("ui:updater:search")) {
    return { file: "../src/ui/appUi.js", anchor: "handleSearchInput(event)", radius: 14 };
  }

  if (eventType.startsWith("ui:event:add-submit") || eventType.startsWith("ui:updater:add-submit")) {
    return { file: "../src/ui/appUi.js", anchor: "handleAddSubmit(event)", radius: 18 };
  }

  if (eventType.startsWith("ui:event:toggle-task") || eventType.startsWith("ui:updater:toggle-task")) {
    return { file: "../src/ui/appUi.js", anchor: "handleTaskToggle(event)", radius: 16 };
  }

  if (eventType.startsWith("ui:event:filter-select") || eventType.startsWith("ui:updater:filter-select")) {
    return { file: "../src/ui/appUi.js", anchor: "handleFilterSelect(event)", radius: 16 };
  }

  if (eventType.startsWith("ui:event:remove-task") || eventType.startsWith("ui:updater:remove-task")) {
    return { file: "../src/ui/appUi.js", anchor: "handleTaskRemove(event)", radius: 14 };
  }

  if (eventType.startsWith("state:")) {
    return { file: "../src/core/hooks.js", anchor: "export function useState(initialValue)", radius: 20 };
  }

  if (eventType.startsWith("memo:")) {
    return { file: "../src/core/hooks.js", anchor: "export function useMemo(factory, deps)", radius: 20 };
  }

  if (eventType === "effect:register") {
    return { file: "../src/core/hooks.js", anchor: "export function useEffect(effect, deps)", radius: 20 };
  }

  if (eventType.startsWith("effect:")) {
    return { file: "../src/core/component.js", anchor: "flushEffects()", radius: 22 };
  }

  if (eventType.startsWith("scheduler:")) {
    return { file: "../src/core/scheduler.js", anchor: "export function scheduleComponentUpdate(component)", radius: 16 };
  }

  if (eventType === "component:child-render") {
    return { file: "../src/core/component.js", anchor: "export function renderChild(componentFn, props = {})", radius: 12 };
  }

  if (
    eventType.startsWith("component:commit") ||
    eventType.startsWith("component:mount") ||
    eventType.startsWith("component:update")
  ) {
    return { file: "../src/core/component.js", anchor: "performCommit()", radius: 26 };
  }

  if (eventType === "component:render:start" || eventType === "component:render:output") {
    return { file: "../src/core/component.js", anchor: "render()", radius: 18 };
  }

  if (eventType.startsWith("diff:")) {
    return { file: "../src/core/diff.js", anchor: "export function diffTrees(oldVdom, newVdom)", radius: 18 };
  }

  if (eventType.startsWith("patch:")) {
    return { file: "../src/core/patch.js", anchor: "export function patchDom(container, oldVdom, newVdom)", radius: 26 };
  }

  if (eventType.startsWith("store:")) {
    return { file: "../src/state/store.js", anchor: "export function createAppStore(options = {})", radius: 22 };
  }

  return { file: "../src/main.js", anchor: "export function mountTaskManagerApp(options = {})", radius: 18 };
}

async function loadSourceSnippet(source) {
  if (!source?.file) {
    return {
      meta: "소스 정보 없음",
      code: "// 연결된 소스가 없습니다.",
    };
  }

  try {
    const lines = await loadSourceFile(source.file);
    const anchorIndex = lines.findIndex((line) => line.includes(source.anchor));
    const focusIndex = anchorIndex >= 0 ? anchorIndex : 0;
    const start = Math.max(0, focusIndex - (source.radius ?? 10));
    const end = Math.min(lines.length, focusIndex + (source.radius ?? 10) + 1);

    return {
      meta: `파일: ${source.file} | 기준 위치: ${source.anchor}`,
      code: lines.slice(start, end).map((line, index) => {
        const lineNumber = String(start + index + 1).padStart(4, " ");
        const marker = start + index === focusIndex ? ">" : " ";
        return `${marker}${lineNumber} ${line}`;
      }).join("\n"),
    };
  } catch (error) {
    return {
      meta: `${source.file} 로드 실패`,
      code: `// ${error.message}`,
    };
  }
}

async function loadSourceFile(file) {
  if (sourceCache.has(file)) {
    return sourceCache.get(file);
  }

  const response = await fetch(file);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const text = await response.text();
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  sourceCache.set(file, lines);
  return lines;
}

function captureSnapshot({ host, runtime, storage }) {
  const storageKey = runtime?.store?.getStorageKey?.();
  const rawStorage = storageKey ? storage.getItem(storageKey) : null;

  return {
    state: safeClone(runtime?.rootComponent?.getStateSnapshot?.() ?? null),
    hooks: safeClone(runtime?.rootComponent?.getHookDebugInfo?.() ?? []),
    commit: safeClone(runtime?.store?.getLastCommit?.() ?? null),
    dom: serializeDom(host),
    storage: rawStorage ? JSON.parse(rawStorage) : null,
  };
}

function createEmptySnapshot() {
  return {
    state: null,
    hooks: [],
    commit: null,
    dom: "<empty />",
    storage: null,
  };
}

function cloneSnapshot(snapshot) {
  return snapshot ? safeClone(snapshot) : createEmptySnapshot();
}

function safeClone(value) {
  if (value == null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function pretty(value) {
  if (value == null) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function summarizeSmallValue(value) {
  if (value == null) {
    return "null";
  }

  if (typeof value === "string") {
    return value.length > 80 ? `${value.slice(0, 77)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length}) ${JSON.stringify(value.slice(0, 3))}`;
  }

  if (typeof value === "object") {
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  }

  return String(value);
}

function typeInto(input, value) {
  if (!input) {
    return;
  }

  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function serializeDom(container) {
  const lines = Array.from(container.childNodes)
    .map((node) => formatNode(node, 0))
    .filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : "<empty />";
}

function formatNode(node, depth) {
  const indent = "  ".repeat(depth);

  if (node.nodeType === Node.TEXT_NODE) {
    const value = (node.textContent ?? "").trim();
    return value ? `${indent}${value}` : "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const tagName = node.tagName.toLowerCase();
  const attrs = node.getAttributeNames().map((name) => `${name}="${node.getAttribute(name)}"`).join(" ");
  const open = attrs ? `<${tagName} ${attrs}>` : `<${tagName}>`;
  const children = Array.from(node.childNodes)
    .map((child) => formatNode(child, depth + 1))
    .filter(Boolean);

  if (children.length === 0) {
    return `${indent}${open}</${tagName}>`;
  }

  if (children.length === 1 && node.childNodes.length === 1 && node.firstChild?.nodeType === Node.TEXT_NODE) {
    return `${indent}${open}${children[0].trim()}</${tagName}>`;
  }

  return `${indent}${open}\n${children.join("\n")}\n${indent}</${tagName}>`;
}

function stopAutoplay() {
  if (autoplayTimer) {
    window.clearInterval(autoplayTimer);
    autoplayTimer = null;
  }

  if (refs) {
    refs.toggleAutoplay.textContent = "자동 재생";
  }
}

function showError(error) {
  console.error(error);

  if (!refs) {
    return;
  }

  refs.errorBox.style.display = "block";
  refs.errorView.textContent = `${error?.message ?? error}\n\n${error?.stack ?? ""}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
