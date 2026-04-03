/**
 * 이 파일은 우리가 직접 만든 Hooks의 핵심 구현입니다.
 *
 * React를 처음 보면 이런 의문이 생깁니다.
 * "함수형 컴포넌트는 렌더할 때마다 다시 실행되는데,
 *  그 안의 state 값은 왜 사라지지 않을까?"
 *
 * 이 프로젝트에서는 그 답을 아주 단순한 방식으로 보여줍니다.
 *
 * 핵심 아이디어:
 * 1. state를 함수 안에 저장하지 않습니다.
 * 2. state는 FunctionComponent 인스턴스의 hooks 배열에 저장합니다.
 * 3. useState / useEffect / useMemo가 호출될 때마다
 *    "지금 몇 번째 hook를 읽고 있는지"를 hookCursor로 추적합니다.
 * 4. 다음 렌더에서도 같은 순서로 hook가 호출되면,
 *    같은 index의 hooks 칸을 다시 읽게 됩니다.
 *
 * 예를 들어 App 안에서
 * - 첫 번째 hook가 useState
 * - 두 번째 hook가 useMemo
 * - 세 번째 hook가 useMemo
 * 라면,
 * hooks 배열은 대략 이런 식으로 유지됩니다.
 *
 * hooks[0] = state 정보
 * hooks[1] = memo 정보
 * hooks[2] = memo 정보
 *
 * 그래서 App 함수는 다시 실행되어도,
 * 실제 데이터는 바깥(FunctionComponent.hooks)에 남아 있어서
 * 이전 값을 계속 이어서 사용할 수 있습니다.
 */

// "지금 hook를 호출해도 되는 상황인지" 검사하는 함수입니다.
// 이 프로젝트에서는 루트 컴포넌트에서만 hook 사용을 허용합니다.
import { assertRootHookUsage } from "./component.js";

export function useState(initialValue) {
  // 현재 렌더 중인 루트 컴포넌트를 가져옵니다.
  // 예: App을 렌더 중이라면 App을 감싼 FunctionComponent 인스턴스가 반환됩니다.
  const component = assertRootHookUsage("useState");

  // hooks 배열에서 지금 몇 번째 칸을 써야 하는지 나타내는 번호입니다.
  // 첫 번째 hook 호출이면 0, 두 번째면 1, 세 번째면 2가 됩니다.
  const index = component.hookCursor;

  // 이번 useState가 사용할 hooks 배열의 칸을 읽어옵니다.
  // 첫 렌더에서는 비어 있을 가능성이 큽니다.
  let hook = component.hooks[index];

  // 아직 해당 칸에 hook 정보가 없다면 "첫 렌더"라는 뜻입니다.
  // 이때 state의 초기값을 만들어 hooks 배열에 저장합니다.
  if (!hook) {
    hook = {
      // 디버깅을 쉽게 하려고 어떤 종류의 hook인지 기록합니다.
      kind: "state",

      // initialValue가 함수면 한 번 실행해서 결과를 초기값으로 씁니다.
      // 함수가 아니면 그 값을 그대로 초기값으로 저장합니다.
      value: typeof initialValue === "function" ? initialValue() : initialValue,

      // setter는 나중에 한 번만 만들어 재사용하려고 처음에는 null로 둡니다.
      setter: null,
    };

    // 이제 이 state hook 정보를 hooks 배열의 현재 칸에 저장합니다.
    component.hooks[index] = hook;
  }

  // hook 순서가 바뀌면 큰 문제가 생깁니다.
  // 예를 들어 예전에는 0번 칸이 state였는데,
  // 이번 렌더에서는 같은 0번 칸에 effect를 기대하면 안 됩니다.
  // 그래서 현재 칸이 정말 state hook인지 검사합니다.
  if (hook.kind !== "state") {
    throw new Error("Hook order changed: expected a state hook.");
  }

  // setter 함수는 한 번만 생성합니다.
  // 이후 렌더에서는 같은 setter를 재사용합니다.
  if (!hook.setter) {
    hook.setter = (nextValue) => {
      // setState(값) 형태도 가능하고,
      // setState(이전값 => 새값) 형태도 가능하게 지원합니다.
      const resolvedValue =
        typeof nextValue === "function" ? nextValue(hook.value) : nextValue;

      // 이전 값과 새 값이 완전히 같다면 굳이 다시 렌더하지 않습니다.
      if (Object.is(hook.value, resolvedValue)) {
        return hook.value;
      }

      // 실제 state 값을 hooks 배열 안에서 직접 바꿉니다.
      hook.value = resolvedValue;

      // state 변경 후에는 화면을 다시 그려야 하므로 update를 요청합니다.
      // store가 연결되어 있으면 store를 통해 루트 업데이트를 요청하고,
      // 없으면 컴포넌트에 직접 업데이트를 요청합니다.
      if (component.store?.requestUpdate) {
        component.store.requestUpdate();
      } else {
        component.requestUpdate();
      }

      // 바뀐 최신 값을 반환합니다.
      return hook.value;
    };
  }

  // 현재 useState 처리가 끝났으니 다음 hook 칸으로 이동합니다.
  component.hookCursor += 1;

  // 컴포넌트 쪽에서는 [현재값, 값을 바꾸는 함수] 형태로 받게 됩니다.
  return [hook.value, hook.setter];
}

export function useEffect(effect, deps) {
  // 현재 렌더 중인 루트 컴포넌트를 가져옵니다.
  const component = assertRootHookUsage("useEffect");

  // 이번 effect가 사용할 hooks 배열의 위치입니다.
  const index = component.hookCursor;

  // 기존 effect 정보가 있으면 재사용하고, 없으면 처음 만듭니다.
  let hook = component.hooks[index];

  if (!hook) {
    hook = {
      // effect hook임을 표시합니다.
      kind: "effect",

      // 지난번 렌더에서 사용했던 deps입니다.
      deps: undefined,

      // 이번 렌더에서 들어온 새 deps를 잠깐 저장하는 용도입니다.
      nextDeps: undefined,

      // 이전 effect가 반환한 cleanup 함수입니다.
      cleanup: null,

      // effect가 몇 번 실행됐는지 디버깅용으로 셉니다.
      runCount: 0,
    };
    component.hooks[index] = hook;
  }

  // hook 순서가 바뀌지 않았는지 확인합니다.
  if (hook.kind !== "effect") {
    throw new Error("Hook order changed: expected an effect hook.");
  }

  // deps가 배열이면 복사해서 저장합니다.
  // 복사하는 이유는 바깥 배열이 나중에 바뀌어도
  // 이번 비교 기준은 안전하게 유지하기 위해서입니다.
  const nextDeps = Array.isArray(deps) ? [...deps] : undefined;

  // deps가 아예 없으면 매 렌더마다 실행합니다.
  // deps가 있으면 이전 deps와 비교해서 달라졌을 때만 실행합니다.
  const shouldRun = nextDeps === undefined || !areDepsEqual(hook.deps, nextDeps);

  // 디버깅이나 이후 처리용으로 "이번 렌더의 deps"를 기억해 둡니다.
  hook.nextDeps = nextDeps;

  // 지금 바로 effect를 실행하지 않고, "나중에 실행할 목록"에 넣어둡니다.
  // 왜냐하면 effect는 DOM patch가 끝난 뒤에 실행되어야 하기 때문입니다.
  if (shouldRun) {
    component.queueEffect({
      index,
      effect,
      deps: nextDeps,
    });
  }

  // 다음 hook 칸으로 이동합니다.
  component.hookCursor += 1;
}

export function useMemo(factory, deps) {
  // 현재 렌더 중인 루트 컴포넌트를 가져옵니다.
  const component = assertRootHookUsage("useMemo");

  // 이번 memo가 사용할 hooks 배열의 위치입니다.
  const index = component.hookCursor;

  // 기존 memo 정보가 있으면 재사용하고, 없으면 새로 만듭니다.
  let hook = component.hooks[index];

  if (!hook) {
    hook = {
      // memo hook임을 표시합니다.
      kind: "memo",

      // 지난번 계산 때 사용한 deps입니다.
      deps: undefined,

      // 계산 결과값이 들어갈 자리입니다.
      value: undefined,

      // 실제로 factory를 다시 계산한 횟수입니다.
      recomputeCount: 0,

      // deps가 같아서 이전 값을 재사용한 횟수입니다.
      cacheHits: 0,
    };
    component.hooks[index] = hook;
  }

  // hook 순서가 바뀌지 않았는지 확인합니다.
  if (hook.kind !== "memo") {
    throw new Error("Hook order changed: expected a memo hook.");
  }

  // deps 배열을 복사해 안전하게 저장합니다.
  const nextDeps = Array.isArray(deps) ? [...deps] : undefined;

  // deps가 없으면 항상 다시 계산합니다.
  // deps가 있으면 이전과 달라졌을 때만 다시 계산합니다.
  const shouldRecompute = nextDeps === undefined || !areDepsEqual(hook.deps, nextDeps);

  if (shouldRecompute) {
    // deps가 달라졌으니 factory를 실행해서 새 값을 구합니다.
    hook.value = factory();

    // 이번 계산 기준이 된 deps를 저장합니다.
    hook.deps = nextDeps;

    // 다시 계산한 횟수를 1 증가시킵니다.
    hook.recomputeCount += 1;
  } else {
    // deps가 같으니 이전에 저장된 값을 그대로 재사용합니다.
    hook.cacheHits += 1;
  }

  // 다음 hook 칸으로 이동합니다.
  component.hookCursor += 1;

  // 새로 계산한 값 또는 캐시된 값을 반환합니다.
  return hook.value;
}

export function areDepsEqual(previousDeps, nextDeps) {
  // 둘 중 하나라도 배열이 아니면 정상적인 deps 비교가 아니므로 false입니다.
  if (!Array.isArray(previousDeps) || !Array.isArray(nextDeps)) {
    return false;
  }

  // 길이가 다르면 같은 deps일 수 없습니다.
  if (previousDeps.length !== nextDeps.length) {
    return false;
  }

  // 모든 칸이 Object.is 기준으로 같아야만 "deps가 같다"고 판단합니다.
  // 하나라도 다르면 false가 됩니다.
  return previousDeps.every((value, index) => Object.is(value, nextDeps[index]));
}
