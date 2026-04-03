/**
 * 이 파일은 "함수형 컴포넌트를 실제로 움직이게 만드는 엔진"입니다.
 *
 * hooks.js가 "상태를 어떻게 저장할까?"를 담당한다면,
 * 이 파일은 "언제 렌더하고, 언제 다시 렌더하고,
 *  언제 diff/patch를 하고, 언제 effect를 실행할까?"를 담당합니다.
 *
 * 이 프로젝트에서는 함수형 컴포넌트를 그냥 함수로만 두지 않고,
 * FunctionComponent라는 클래스로 한 번 감쌉니다.
 *
 * 그 이유는 함수 바깥에 아래 정보를 계속 들고 있어야 하기 때문입니다.
 * - hooks 배열: useState / useEffect / useMemo의 실제 저장 공간
 * - hookCursor: 이번 렌더에서 지금 몇 번째 hook를 읽는 중인지
 * - currentVdom: 직전 렌더 결과
 * - pendingEffects: DOM 반영 후 실행할 effect 목록
 * - renderCount: 몇 번 렌더했는지
 * - isMounted: 지금 이미 화면에 올라간 상태인지
 *
 * 전체 흐름은 크게 이렇게 흘러갑니다.
 *
 * 처음 렌더:
 * mount()
 * -> performCommit()
 * -> render()
 * -> 함수형 컴포넌트(App) 실행
 * -> 새 VDOM 생성
 * -> diff
 * -> 실제 DOM에 반영(renderVdom)
 * -> effect 실행
 *
 * state 변경 후 재렌더:
 * setState()
 * -> requestUpdate()
 * -> scheduler가 update() 실행
 * -> performCommit()
 * -> render()
 * -> App 다시 실행
 * -> 이전 VDOM과 새 VDOM 비교(diff)
 * -> 바뀐 부분만 patch
 * -> effect 실행
 */

// 이전/다음 VDOM을 비교해 무엇이 바뀌었는지 계산합니다.
import { diffTrees, summarizeChanges } from "./diff.js";
// 실제 DOM을 "전체 갈아끼우지 않고 필요한 부분만" 갱신합니다.
import { patchDom } from "./patch.js";
// 여러 setState를 한 번의 update로 묶어주는 스케줄러입니다.
import { scheduleComponentUpdate } from "./scheduler.js";
// VDOM 복사, 루트 정규화, 첫 렌더용 DOM 생성 함수들입니다.
import { cloneVdom, normalizeRootVdom, renderVdom } from "./vdom.js";

// "지금 어떤 컴포넌트가 렌더 중인가?"를 전역처럼 기억하는 변수입니다.
// hooks.js의 useState / useEffect / useMemo는 이 값을 보고
// 지금 어느 FunctionComponent의 hooks 배열을 써야 하는지 알아냅니다.
let activeComponent = null;

// 현재 호출 중인 컴포넌트가 루트인지, 자식인지 깊이를 기록합니다.
// 이 프로젝트 규칙상 hook은 루트 컴포넌트에서만 허용되므로,
// 자식 컴포넌트 안에서 hook를 부르면 이 깊이 값을 보고 막습니다.
let componentDepth = 0;

export class FunctionComponent {
  constructor(renderFn, options = {}) {
    // 실제 화면 설계도를 만드는 함수입니다.
    // 예: App 함수
    this.renderFn = renderFn;

    // 컴포넌트에 전달할 props입니다.
    this.props = options.props ?? {};

    // 실제 DOM이 붙을 컨테이너입니다.
    this.container = options.container ?? null;

    // 바깥 store와 연결할 때 사용합니다.
    this.store = options.store ?? null;

    // 렌더가 끝난 뒤 디버그 패널 업데이트 같은 후처리를 하고 싶을 때 쓰는 콜백입니다.
    this.onCommit = options.onCommit ?? null;

    // 모든 hook 정보가 저장되는 핵심 배열입니다.
    this.hooks = [];

    // 이번 렌더에서 현재 몇 번째 hook를 읽고 있는지 나타냅니다.
    this.hookCursor = 0;

    // useEffect가 예약한 "나중에 실행할 작업" 목록입니다.
    this.pendingEffects = [];

    // 직전 렌더 결과를 저장합니다.
    // 처음에는 비어 있는 fragment부터 시작합니다.
    this.currentVdom = normalizeRootVdom(null);

    // 몇 번 렌더했는지 세는 디버그용 값입니다.
    this.renderCount = 0;

    // 실제로 한 번이라도 mount됐는지 기록합니다.
    this.isMounted = false;

    // destroy 이후 예약된 update를 무시하기 위한 상태값입니다.
    this.isDestroyed = false;

    // store가 attachRoot를 지원하면 자기 자신을 루트로 등록합니다.
    if (this.store?.attachRoot) {
      this.store.attachRoot(this);
    }
  }

  mount(container = this.container) {
    // mount 시점에 실제 사용할 container를 확정합니다.
    this.container = container ?? this.container;
    this.isDestroyed = false;

    // 첫 렌더도 결국 performCommit으로 처리합니다.
    return this.performCommit();
  }

  update(nextProps = this.props) {
    if (this.isDestroyed) {
      return this.currentVdom;
    }

    // 재렌더 전에 최신 props로 바꿉니다.
    this.props = nextProps;

    // 이후 commit 과정을 다시 수행합니다.
    return this.performCommit();
  }

  requestUpdate() {
    // setState가 직접 update를 바로 실행하지 않고,
    // scheduler에 예약해서 batching할 수 있게 합니다.
    return scheduleComponentUpdate(this);
  }

  queueEffect(entry) {
    // hooks.js의 useEffect가 effect를 지금 바로 실행하지 않고
    // 여기 pendingEffects에 잠깐 넣어둡니다.
    this.pendingEffects.push(entry);
  }

  getStateSnapshot() {
    // 디버그 패널용입니다.
    // hooks 배열 중 state hook만 골라 현재 값을 요약해서 반환합니다.
    const stateHooks = this.hooks.filter((hook) => hook?.kind === "state");

    if (stateHooks.length === 0) {
      return null;
    }

    if (stateHooks.length === 1) {
      return cloneDebugValue(stateHooks[0].value);
    }

    return stateHooks.map((hook) => cloneDebugValue(hook.value));
  }

  getHookDebugInfo() {
    // 각 hook의 상태를 사람이 보기 쉽게 가공해서 반환합니다.
    return this.hooks.map((hook, index) => summarizeHook(hook, index));
  }

  destroy() {
    // 컴포넌트가 사라질 때 effect cleanup을 전부 실행합니다.
    for (const hook of this.hooks) {
      if (hook?.kind === "effect" && typeof hook.cleanup === "function") {
        hook.cleanup();
      }
    }

    // 더 이상 실행할 effect가 없도록 비웁니다.
    this.pendingEffects = [];

    // mount되지 않은 상태로 표시합니다.
    this.isMounted = false;
    this.isDestroyed = true;
  }

  performCommit() {
    if (this.isDestroyed) {
      return this.currentVdom;
    }

    // diff 비교를 위해 이전 VDOM을 복사해 둡니다.
    const previousVdom = cloneVdom(this.currentVdom);

    // render()를 호출해 새 VDOM을 얻습니다.
    const nextVdom = this.render();

    // 이전 VDOM과 새 VDOM을 비교해 변경 목록을 계산합니다.
    const changes = diffTrees(previousVdom, nextVdom);

    // 브라우저 환경이고 컨테이너가 있으면 실제 DOM에도 반영합니다.
    if (this.container && typeof document !== "undefined") {
      // 처음 mount라면 통째로 처음 렌더합니다.
      if (!this.isMounted) {
        renderVdom(this.container, nextVdom);
      } else {
        // 이미 mount된 뒤라면 바뀐 부분만 patch합니다.
        patchDom(this.container, previousVdom, nextVdom);
      }
    }

    // 이번 렌더 결과를 다음 렌더의 "이전 VDOM"으로 저장합니다.
    this.currentVdom = cloneVdom(nextVdom);

    // 렌더 횟수를 1 증가시킵니다.
    this.renderCount += 1;

    // 이제 mount된 상태라고 표시합니다.
    this.isMounted = true;

    // DOM 반영이 끝난 뒤 예약된 effect를 실행합니다.
    this.flushEffects();

    // 디버그 패널이나 store 기록용으로 commit 정보를 정리합니다.
    const commitInfo = {
      renderCount: this.renderCount,
      hookCount: this.hooks.length,
      stateSnapshot: this.getStateSnapshot(),
      hooks: this.getHookDebugInfo(),
      changes,
      changeSummary: summarizeChanges(changes),
    };

    // store가 있다면 마지막 commit 정보를 저장하게 하고,
    // 외부 콜백(onCommit)도 함께 호출합니다.
    this.store?.recordCommit?.(commitInfo);
    this.onCommit?.(commitInfo);

    // 새 VDOM을 반환합니다.
    return nextVdom;
  }

  render() {
    // 이전에 렌더 중이던 컴포넌트 정보를 잠시 저장해 둡니다.
    // 중첩 호출이 있더라도 끝난 뒤 원래 상태로 복구하려는 목적입니다.
    const previousActiveComponent = activeComponent;
    const previousDepth = componentDepth;

    // 이제부터 "지금 렌더 중인 컴포넌트는 나다"라고 표시합니다.
    activeComponent = this;

    // 루트 렌더이므로 깊이를 0으로 초기화합니다.
    componentDepth = 0;

    // 이번 렌더에서는 첫 번째 hook부터 다시 읽어야 하므로 0으로 초기화합니다.
    this.hookCursor = 0;

    // 이전 렌더에서 남아 있던 pending effect는 새 렌더 전에 비웁니다.
    this.pendingEffects = [];

    try {
      // 실제 함수형 컴포넌트(App)를 실행해서 VDOM을 얻습니다.
      // 어떤 형태로 반환되든 루트는 fragment 형태로 통일합니다.
      return normalizeRootVdom(this.renderFn(this.props));
    } finally {
      // 렌더가 끝나면 전역 상태를 원래 값으로 되돌립니다.
      activeComponent = previousActiveComponent;
      componentDepth = previousDepth;
    }
  }

  flushEffects() {
    // useEffect에서 예약한 작업들을 하나씩 실행합니다.
    for (const pending of this.pendingEffects) {
      // 현재 effect hook 정보를 가져옵니다.
      const hook = this.hooks[pending.index];

      // 이전 cleanup이 있으면 먼저 실행합니다.
      if (typeof hook.cleanup === "function") {
        hook.cleanup();
      }

      // effect 본문을 실행합니다.
      const cleanup = pending.effect();

      // effect가 cleanup 함수를 반환했다면 저장해 둡니다.
      hook.cleanup = typeof cleanup === "function" ? cleanup : null;

      // 이번에 사용한 deps를 현재 deps로 확정합니다.
      hook.deps = pending.deps;

      // 디버그용 실행 횟수 증가입니다.
      hook.runCount = (hook.runCount ?? 0) + 1;
    }

    // 다 실행했으면 목록을 비웁니다.
    this.pendingEffects = [];
  }
}

export function getActiveComponent() {
  // hooks.js가 "지금 누가 렌더 중이지?"라고 물어볼 때 사용합니다.
  return activeComponent;
}

export function assertRootHookUsage(hookName) {
  // 렌더 중이 아닐 때 hook를 호출하면 잘못된 사용입니다.
  if (!activeComponent) {
    throw new Error(`${hookName} must be called during FunctionComponent rendering.`);
  }

  // 이 프로젝트에서는 자식 컴포넌트 안 hook 사용을 금지합니다.
  // depth가 1 이상이면 자식 영역에서 호출한 것이므로 에러를 냅니다.
  if (componentDepth > 0) {
    throw new Error(`${hookName} is only allowed in the root component of this project.`);
  }

  // 문제가 없으면 현재 루트 컴포넌트를 반환합니다.
  return activeComponent;
}

export function renderChild(componentFn, props = {}) {
  // 자식 컴포넌트를 호출하기 직전에 깊이를 1 증가시킵니다.
  const previousDepth = componentDepth;
  componentDepth += 1;

  try {
    // 자식 컴포넌트 함수를 실행합니다.
    return componentFn(props);
  } finally {
    // 실행이 끝나면 원래 깊이로 되돌립니다.
    componentDepth = previousDepth;
  }
}

function summarizeHook(hook, index) {
  // 디버그 표시용으로 hook 정보를 사람이 읽기 쉬운 형태로 바꿉니다.
  if (!hook) {
    return { index, kind: "empty" };
  }

  if (hook.kind === "state") {
    return {
      index,
      kind: "state",
      value: summarizeValue(hook.value),
    };
  }

  if (hook.kind === "memo") {
    return {
      index,
      kind: "memo",
      deps: summarizeValue(hook.deps ?? []),
      value: summarizeValue(hook.value),
      recomputeCount: hook.recomputeCount ?? 0,
      cacheHits: hook.cacheHits ?? 0,
    };
  }

  if (hook.kind === "effect") {
    return {
      index,
      kind: "effect",
      deps: summarizeValue(hook.deps ?? hook.nextDeps ?? []),
      runCount: hook.runCount ?? 0,
      hasCleanup: typeof hook.cleanup === "function",
    };
  }

  return {
    index,
    kind: hook.kind ?? "unknown",
  };
}

function summarizeValue(value, depth = 0) {
  // 디버그 출력이 너무 길어지지 않도록 값을 짧게 요약합니다.
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 60 ? `${value.slice(0, 57)}...` : value;
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return `[Array(${value.length})]`;
    }

    return value.slice(0, 4).map((item) => summarizeValue(item, depth + 1));
  }

  if (depth >= 2) {
    return "[Object]";
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 6)
      .map(([key, item]) => [key, summarizeValue(item, depth + 1)]),
  );
}

function cloneDebugValue(value) {
  // 디버그용 상태 스냅샷이 원본 객체를 직접 참조하지 않도록 복사합니다.
  if (value == null || typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDebugValue(item));
  }

  if (typeof value === "function") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneDebugValue(item)]),
  );
}
