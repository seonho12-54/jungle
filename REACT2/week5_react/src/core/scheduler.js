/**
 * 역할:
 * - 여러 setState 호출을 같은 마이크로태스크 안에서 한 번의 update로 묶습니다.
 * - 선택 과제인 batching 아이디어를 과하게 복잡하지 않게 보여주는 파일입니다.
 */

const pendingComponents = new Set();
let flushPromise = null;

export function scheduleComponentUpdate(component) {
  pendingComponents.add(component);

  if (!flushPromise) {
    flushPromise = Promise.resolve().then(() => {
      const queue = Array.from(pendingComponents);
      pendingComponents.clear();
      flushPromise = null;

      for (const item of queue) {
        item.update();
      }
    });
  }

  return flushPromise;
}

export function flushScheduledUpdates() {
  return flushPromise ?? Promise.resolve();
}
