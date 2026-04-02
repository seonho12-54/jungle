function createHistoryManager(initialVNode) {
  const cloneVNode = window.VDOM.cloneVNode;
  const snapshots = [cloneVNode(initialVNode)];
  let currentIndex = 0;

  function current() {
    return cloneVNode(snapshots[currentIndex]);
  }

  return {
    push(vnode) {
      snapshots.splice(currentIndex + 1);
      snapshots.push(cloneVNode(vnode));
      currentIndex = snapshots.length - 1;
      return current();
    },
    undo() {
      if (currentIndex === 0) {
        return null;
      }

      currentIndex -= 1;
      return current();
    },
    redo() {
      if (currentIndex === snapshots.length - 1) {
        return null;
      }

      currentIndex += 1;
      return current();
    },
    canUndo() {
      return currentIndex > 0;
    },
    canRedo() {
      return currentIndex < snapshots.length - 1;
    },
    getSnapshots() {
      return snapshots.map((snapshot) => cloneVNode(snapshot));
    },
    getCurrentIndex() {
      return currentIndex;
    },
    current,
  };
}

window.HistoryManager = {
  createHistoryManager,
};
