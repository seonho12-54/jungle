/**
 * 역할:
 * - 앱의 시작점입니다.
 * - 루트 FunctionComponent를 mount하고, commit 이후 inspector 패널을 갱신합니다.
 */

import { FunctionComponent } from "./core/component.js";
import { App, getInspectorElements, renderRuntimeInspector } from "./ui/appUi.js";
import { createAppStore } from "./state/store.js";

export function mountTaskManagerApp(options = {}) {
  const container = options.container;

  if (!container) {
    throw new Error("mountTaskManagerApp requires a container element.");
  }

  const store = createAppStore({
    storage: options.storage,
    storageKey: options.storageKey,
    seedTasks: options.seedTasks,
  });
  const inspectorElements = options.inspectorElements ?? null;

  const rootComponent = new FunctionComponent(App, {
    props: { store },
    container,
    store,
    onCommit(commit) {
      renderRuntimeInspector(inspectorElements, store.getLastCommit());
      options.onCommit?.(commit, store.getLastCommit());
    },
  });

  rootComponent.mount(container);

  return {
    store,
    rootComponent,
    destroy() {
      rootComponent.destroy();
      container.replaceChildren();
    },
  };
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("app-root");

    if (!container) {
      return;
    }

    mountTaskManagerApp({
      container,
      inspectorElements: getInspectorElements(document),
    });
  });
}
