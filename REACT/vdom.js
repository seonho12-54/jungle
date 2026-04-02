const IGNORED_ATTRIBUTES = new Set(["contenteditable", "spellcheck", "data-edit-root"]);

function domToVNode(node) {
  if (!node) {
    return null;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    if (node.textContent.trim() === "") {
      return null;
    }

    return {
      type: "text",
      text: node.textContent,
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const props = {};

  Array.from(node.attributes).forEach((attribute) => {
    if (!IGNORED_ATTRIBUTES.has(attribute.name)) {
      props[attribute.name] = attribute.value;
    }
  });

  const children = [];

  Array.from(node.childNodes).forEach((childNode) => {
    const childVNode = domToVNode(childNode);

    if (childVNode) {
      children.push(childVNode);
    }
  });

  return {
    type: "element",
    tag: node.tagName.toLowerCase(),
    props,
    children,
  };
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
    element.setAttribute(name, value);
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
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function vnodeToHTML(vnode, depth) {
  const currentDepth = depth || 0;
  const indent = "  ".repeat(currentDepth);

  if (vnode.type === "text") {
    return indent + escapeHTML(vnode.text);
  }

  const props = Object.keys(vnode.props)
    .map((key) => ` ${key}="${escapeHTML(vnode.props[key])}"`)
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
