const IGNORED_ATTRIBUTES = new Set(["contenteditable", "spellcheck", "data-edit-root"]);

function isWhitespaceOnlyText(text) {
  return String(text).trim() === "";
}

function syncSpecialPropsFromDOM(node, props) {
  const tag = node.tagName.toLowerCase();

  if (tag === "input" || tag === "textarea" || tag === "select") {
    props.value = node.value;
  }

  if (tag === "input" && (node.type === "checkbox" || node.type === "radio")) {
    props.checked = node.checked;
  }

  if (tag === "option") {
    props.selected = node.selected;
  }
}

function setDOMProp(element, name, value) {
  if (name === "checked") {
    element.checked = Boolean(value);

    if (value) {
      element.setAttribute("checked", "");
    } else {
      element.removeAttribute("checked");
    }

    return;
  }

  if (name === "selected") {
    element.selected = Boolean(value);

    if (value) {
      element.setAttribute("selected", "");
    } else {
      element.removeAttribute("selected");
    }

    return;
  }

  if (name === "value" && "value" in element) {
    element.value = value;
    element.setAttribute("value", String(value));
    return;
  }

  if (typeof value === "boolean") {
    if (value) {
      element.setAttribute(name, "");
    } else {
      element.removeAttribute(name);
    }

    return;
  }

  element.setAttribute(name, String(value));
}

function domToVNode(node) {
  if (!node) {
    return null;
  }

  const frames = [{ node, visited: false }];
  const nodeMap = new Map();

  while (frames.length > 0) {
    const currentFrame = frames.pop();
    const currentNode = currentFrame.node;

    if (!currentNode) {
      continue;
    }

    if (!currentFrame.visited) {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        nodeMap.set(
          currentNode,
          isWhitespaceOnlyText(currentNode.textContent)
            ? null
            : {
                type: "text",
                text: currentNode.textContent,
              }
        );
        continue;
      }

      if (currentNode.nodeType !== Node.ELEMENT_NODE) {
        nodeMap.set(currentNode, null);
        continue;
      }

      frames.push({
        node: currentNode,
        visited: true,
      });

      const childNodes = Array.from(currentNode.childNodes);

      for (let index = childNodes.length - 1; index >= 0; index -= 1) {
        frames.push({
          node: childNodes[index],
          visited: false,
        });
      }

      continue;
    }

    const props = {};

    Array.from(currentNode.attributes).forEach((attribute) => {
      if (!IGNORED_ATTRIBUTES.has(attribute.name)) {
        props[attribute.name] = attribute.value;
      }
    });

    syncSpecialPropsFromDOM(currentNode, props);

    const children = [];

    Array.from(currentNode.childNodes).forEach((childNode) => {
      const childVNode = nodeMap.get(childNode);

      if (childVNode) {
        children.push(childVNode);
      }
    });

    nodeMap.set(currentNode, {
      type: "element",
      tag: currentNode.tagName.toLowerCase(),
      props,
      children,
    });
  }

  return nodeMap.get(node) || null;
}

function renderVNode(vnode) {
  if (!vnode) {
    return document.createTextNode("");
  }

  if (vnode.type === "text") {
    return document.createTextNode(vnode.text);
  }

  const element = document.createElement(vnode.tag);

  Object.entries(vnode.props).forEach(([name, value]) => {
    setDOMProp(element, name, value);
  });

  vnode.children.forEach((child) => {
    element.appendChild(renderVNode(child));
  });

  return element;
}

function cloneVNode(vnode) {
  return JSON.parse(JSON.stringify(vnode));
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatHTMLProp(key, value) {
  if (typeof value === "boolean") {
    return value ? ` ${key}` : "";
  }

  return ` ${key}="${escapeHTML(value)}"`;
}

function vnodeToHTML(vnode, depth) {
  const currentDepth = depth || 0;
  const indent = "  ".repeat(currentDepth);

  if (vnode.type === "text") {
    return indent + escapeHTML(vnode.text);
  }

  const props = Object.keys(vnode.props)
    .map((key) => formatHTMLProp(key, vnode.props[key]))
    .join("");

  if (vnode.children.length === 0) {
    return `${indent}<${vnode.tag}${props}></${vnode.tag}>`;
  }

  const childHTML = vnode.children.map((child) => vnodeToHTML(child, currentDepth + 1)).join("\n");
  return `${indent}<${vnode.tag}${props}>\n${childHTML}\n${indent}</${vnode.tag}>`;
}

window.VDOM = {
  domToVNode,
  renderVNode,
  cloneVNode,
  vnodeToHTML,
};
