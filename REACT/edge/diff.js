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

function getVNodeKey(vnode) {
  if (!vnode || vnode.type !== "element") {
    return null;
  }

  const props = vnode.props || {};
  return props.key || props["data-key"] || props["data-id"] || props.id || null;
}

function hasUniqueKeys(children) {
  const keySet = new Set();

  for (const child of children) {
    const key = getVNodeKey(child);

    if (!key || keySet.has(key)) {
      return false;
    }

    keySet.add(key);
  }

  return children.length > 0;
}

function shouldUseKeyedDiff(oldChildren, newChildren) {
  return hasUniqueKeys(oldChildren) && hasUniqueKeys(newChildren);
}

function haveSameKeyOrder(oldChildren, newChildren) {
  if (oldChildren.length !== newChildren.length) {
    return false;
  }

  for (let index = 0; index < oldChildren.length; index += 1) {
    if (getVNodeKey(oldChildren[index]) !== getVNodeKey(newChildren[index])) {
      return false;
    }
  }

  return true;
}

function haveSameKeySet(oldChildren, newChildren) {
  if (oldChildren.length !== newChildren.length) {
    return false;
  }

  const oldKeySet = new Set(oldChildren.map(getVNodeKey));

  if (oldKeySet.size !== oldChildren.length) {
    return false;
  }

  for (const child of newChildren) {
    if (!oldKeySet.has(getVNodeKey(child))) {
      return false;
    }
  }

  return true;
}

function canDiffKeyedChildrenByIndex(oldChildren, newChildren) {
  const minLength = Math.min(oldChildren.length, newChildren.length);

  for (let index = 0; index < minLength; index += 1) {
    if (getVNodeKey(oldChildren[index]) !== getVNodeKey(newChildren[index])) {
      return false;
    }
  }

  return true;
}

function buildChildMapByKey(children) {
  const childMap = new Map();

  children.forEach((child) => {
    childMap.set(getVNodeKey(child), child);
  });

  return childMap;
}

function diff(oldVNode, newVNode, path = []) {
  const patches = [];
  const stack = [{ oldVNode, newVNode, path }];

  while (stack.length > 0) {
    const current = stack.pop();
    const currentOldVNode = current.oldVNode;
    const currentNewVNode = current.newVNode;
    const currentPath = current.path;

    if (!currentOldVNode && currentNewVNode) {
      patches.push({ type: "ADD", path: currentPath, node: currentNewVNode });
      continue;
    }

    if (currentOldVNode && !currentNewVNode) {
      patches.push({ type: "REMOVE", path: currentPath });
      continue;
    }

    if (!currentOldVNode || !currentNewVNode) {
      continue;
    }

    if (currentOldVNode.type !== currentNewVNode.type) {
      patches.push({ type: "REPLACE", path: currentPath, node: currentNewVNode });
      continue;
    }

    if (currentOldVNode.type === "text") {
      if (currentOldVNode.text !== currentNewVNode.text) {
        patches.push({ type: "TEXT", path: currentPath, text: currentNewVNode.text });
      }

      continue;
    }

    if (currentOldVNode.tag !== currentNewVNode.tag) {
      patches.push({ type: "REPLACE", path: currentPath, node: currentNewVNode });
      continue;
    }

    const propChanges = diffProps(currentOldVNode.props, currentNewVNode.props);

    if (Object.keys(propChanges).length > 0) {
      patches.push({ type: "PROPS", path: currentPath, props: propChanges });
    }

    const oldChildren = currentOldVNode.children || [];
    const newChildren = currentNewVNode.children || [];

    if (
      shouldUseKeyedDiff(oldChildren, newChildren) &&
      haveSameKeySet(oldChildren, newChildren) &&
      !haveSameKeyOrder(oldChildren, newChildren) &&
      !canDiffKeyedChildrenByIndex(oldChildren, newChildren)
    ) {
      const oldChildrenByKey = buildChildMapByKey(oldChildren);

      patches.push({
        type: "REORDER",
        path: currentPath,
        children: currentNewVNode.children,
      });

      for (let index = newChildren.length - 1; index >= 0; index -= 1) {
        const newChild = newChildren[index];
        const keyedOldChild = oldChildrenByKey.get(getVNodeKey(newChild));

        stack.push({
          oldVNode: keyedOldChild,
          newVNode: newChild,
          path: currentPath.concat(index),
        });
      }

      continue;
    }

    const maxLength = Math.max(oldChildren.length, newChildren.length);

    for (let index = maxLength - 1; index >= 0; index -= 1) {
      stack.push({
        oldVNode: oldChildren[index],
        newVNode: newChildren[index],
        path: currentPath.concat(index),
      });
    }
  }

  return patches;
}

function comparePathsDescending(a, b) {
  const aIsAncestor = a.path.length < b.path.length && a.path.every((value, index) => value === b.path[index]);
  const bIsAncestor = b.path.length < a.path.length && b.path.every((value, index) => value === a.path[index]);

  if (aIsAncestor && a.type === "REORDER") {
    return -1;
  }

  if (bIsAncestor && b.type === "REORDER") {
    return 1;
  }

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
    if (name === "checked") {
      targetNode.checked = Boolean(value);

      if (value) {
        targetNode.setAttribute("checked", "");
      } else {
        targetNode.removeAttribute("checked");
      }

      return;
    }

    if (name === "selected") {
      targetNode.selected = Boolean(value);

      if (value) {
        targetNode.setAttribute("selected", "");
      } else {
        targetNode.removeAttribute("selected");
      }

      return;
    }

    if (name === "value" && "value" in targetNode && value !== null) {
      targetNode.value = value;
      targetNode.setAttribute("value", String(value));
      return;
    }

    if (value === null) {
      targetNode.removeAttribute(name);

      if (name === "value" && "value" in targetNode) {
        targetNode.value = "";
      }

      return;
    }

    if (typeof value === "boolean") {
      if (value) {
        targetNode.setAttribute(name, "");
      } else {
        targetNode.removeAttribute(name);
      }

      return;
    }

    targetNode.setAttribute(name, String(value));
  });
}

function replaceNodeChildren(targetNode, childVNodes, renderVNode) {
  if (!targetNode || targetNode.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  while (targetNode.firstChild) {
    targetNode.removeChild(targetNode.firstChild);
  }

  childVNodes.forEach((childVNode) => {
    targetNode.appendChild(renderVNode(childVNode));
  });
}

function getDOMNodeKey(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  if (typeof node.getAttribute === "function") {
    return (
      node.getAttribute("key") ||
      node.getAttribute("data-key") ||
      node.getAttribute("data-id") ||
      node.getAttribute("id")
    );
  }

  if (!node.attributes) {
    return null;
  }

  const attributeMap = {};

  Array.from(node.attributes).forEach((attribute) => {
    attributeMap[attribute.name] = attribute.value;
  });

  return attributeMap.key || attributeMap["data-key"] || attributeMap["data-id"] || attributeMap.id || null;
}

function reorderNodeChildren(targetNode, childVNodes, renderVNode) {
  if (!targetNode || targetNode.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const existingNodeByKey = new Map();

  Array.from(targetNode.childNodes).forEach((childNode) => {
    const key = getDOMNodeKey(childNode);

    if (key) {
      existingNodeByKey.set(key, childNode);
    }
  });

  const desiredNodes = childVNodes.map((childVNode) => {
    const key = getVNodeKey(childVNode);
    return existingNodeByKey.get(key) || renderVNode(childVNode);
  });

  desiredNodes.forEach((desiredNode, index) => {
    const referenceNode = targetNode.childNodes[index] || null;

    if (desiredNode !== referenceNode) {
      targetNode.insertBefore(desiredNode, referenceNode);
    }
  });

  Array.from(targetNode.childNodes)
    .slice(desiredNodes.length)
    .forEach((extraNode) => {
      targetNode.removeChild(extraNode);
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
    case "REORDER":
      reorderNodeChildren(targetNode, patch.children, renderVNode);
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
