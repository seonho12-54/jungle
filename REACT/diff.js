function diffProps(oldProps, newProps) {
  const changes = {};

  Object.keys(oldProps).forEach((key) => {
    if (!(key in newProps)) {
      changes[key] = null;
    }
  });

  Object.keys(newProps).forEach((key) => {
    if (oldProps[key] !== newProps[key]) {
      changes[key] = newProps[key];
    }
  });

  return changes;
}

function diff(oldVNode, newVNode, path = []) {
  const patches = [];

  if (!oldVNode && newVNode) {
    patches.push({ type: "ADD", path, node: newVNode });
    return patches;
  }

  if (oldVNode && !newVNode) {
    patches.push({ type: "REMOVE", path });
    return patches;
  }

  if (oldVNode.type !== newVNode.type) {
    patches.push({ type: "REPLACE", path, node: newVNode });
    return patches;
  }

  if (oldVNode.type === "text" && oldVNode.text !== newVNode.text) {
    patches.push({ type: "TEXT", path, text: newVNode.text });
    return patches;
  }

  if (oldVNode.type === "text" && newVNode.type === "text") {
    return patches;
  }

  if (oldVNode.tag !== newVNode.tag) {
    patches.push({ type: "REPLACE", path, node: newVNode });
    return patches;
  }

  const propChanges = diffProps(oldVNode.props, newVNode.props);

  if (Object.keys(propChanges).length > 0) {
    patches.push({ type: "PROPS", path, props: propChanges });
  }

  const maxLength = Math.max(oldVNode.children.length, newVNode.children.length);

  for (let index = 0; index < maxLength; index += 1) {
    const childPath = path.concat(index);
    const childPatches = diff(oldVNode.children[index], newVNode.children[index], childPath);
    patches.push(...childPatches);
  }

  return patches;
}

function comparePathsDescending(a, b) {
  const maxLength = Math.max(a.path.length, b.path.length);

  for (let index = 0; index < maxLength; index += 1) {
    const aValue = a.path[index] === undefined ? -1 : a.path[index];
    const bValue = b.path[index] === undefined ? -1 : b.path[index];

    if (aValue !== bValue) {
      return bValue - aValue;
    }
  }

  return b.path.length - a.path.length;
}

function getNodeByPath(rootNode, path) {
  let currentNode = rootNode;

  for (const childIndex of path) {
    if (!currentNode || !currentNode.childNodes) {
      return null;
    }

    currentNode = currentNode.childNodes[childIndex];
  }

  return currentNode;
}

function applyPropChanges(targetNode, propChanges) {
  if (!targetNode || targetNode.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  Object.entries(propChanges).forEach(([name, value]) => {
    if (value === null) {
      targetNode.removeAttribute(name);
      return;
    }

    targetNode.setAttribute(name, value);
  });
}

function applySinglePatch(realRoot, patch) {
  const rootNode = realRoot.firstChild;
  const renderVNode = window.VDOM.renderVNode;

  if (patch.type === "ADD" && patch.path.length === 0) {
    while (realRoot.firstChild) {
      realRoot.removeChild(realRoot.firstChild);
    }

    realRoot.appendChild(renderVNode(patch.node));
    return;
  }

  const parentPath = patch.path.slice(0, -1);
  const targetIndex = patch.path[patch.path.length - 1];
  const parentNode = patch.path.length === 0 ? realRoot : getNodeByPath(rootNode, parentPath);
  const targetNode =
    patch.path.length === 0
      ? rootNode
      : parentNode && parentNode.childNodes
        ? parentNode.childNodes[targetIndex] || null
        : null;

  switch (patch.type) {
    case "ADD": {
      const newNode = renderVNode(patch.node);
      const referenceNode = parentNode.childNodes[targetIndex] || null;
      parentNode.insertBefore(newNode, referenceNode);
      break;
    }
    case "REMOVE":
      if (targetNode && parentNode) {
        parentNode.removeChild(targetNode);
      }
      break;
    case "REPLACE":
      if (patch.path.length === 0) {
        while (realRoot.firstChild) {
          realRoot.removeChild(realRoot.firstChild);
        }

        realRoot.appendChild(renderVNode(patch.node));
      } else if (targetNode) {
        parentNode.replaceChild(renderVNode(patch.node), targetNode);
      }
      break;
    case "TEXT":
      if (targetNode) {
        targetNode.textContent = patch.text;
      }
      break;
    case "PROPS":
      applyPropChanges(targetNode, patch.props);
      break;
    default:
      break;
  }
}

function applyPatch(realRoot, patches) {
  const orderedPatches = [...patches].sort(comparePathsDescending);

  // 같은 부모의 뒤쪽 자식부터 적용해야 index 기반 비교가 안정적으로 유지된다.
  orderedPatches.forEach((patch) => {
    applySinglePatch(realRoot, patch);
  });
}

window.DiffEngine = {
  diff,
  applyPatch,
};
