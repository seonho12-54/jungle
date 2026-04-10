/**
 * 역할:
 * - Week5 데모 앱이 시작할 때 사용할 샘플 task 데이터와 발표 포인트를 보관합니다.
 * - 파일 이름은 유지해서 "기존 sample 리소스를 확장했다"는 연결점을 남깁니다.
 */

export const sampleTasks = [
  {
    id: 1,
    title: "Engine event sync regression triage",
    category: "Runtime",
    completed: false,
    createdAt: "2026-03-28",
  },
  {
    id: 2,
    title: "Runtime patch rollout approved",
    category: "Engine",
    completed: true,
    createdAt: "2026-03-29",
  },
  {
    id: 3,
    title: "useMemo cache window tuning",
    category: "Hooks",
    completed: false,
    createdAt: "2026-03-30",
  },
];

export const frameworkHighlights = [
  "루트 App만 hooks를 사용하고, 자식 패널은 props-only 컴포넌트로 유지합니다.",
  "state 변경은 scheduler를 거쳐 batching되고, FunctionComponent.update()에서 새로운 VDOM을 계산합니다.",
  "useMemo는 action map, filtered queue, summary stats를 캐싱합니다.",
  "useEffect는 DOM patch 이후 localStorage와 document.title을 동기화합니다.",
];
