/**
 * 역할:
 * - Week4에서 만든 Virtual DOM 구조를 유지하면서, Week5용 수동 VDOM 생성(h)까지 담당합니다.
 * - DOM <-> VDOM 변환, 실제 DOM 생성, 속성 동기화, HTML 직렬화를 한 파일에서 이어서 볼 수 있습니다.
 *
 * 관련 파일:
 * - diff.js: 이전/다음 VDOM을 비교합니다.
 * - patch.js: diff 결과가 반영될 실제 DOM을 갱신합니다.
 * - component.js: 함수형 컴포넌트가 만든 VDOM을 mount/update 흐름에 연결합니다.
 */

const IGNORED_ATTRIBUTES = new Set(["contenteditable", "spellcheck"]);
const WHITESPACE_SENSITIVE_TAGS = new Set(["pre", "textarea"]);
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const BOOLEAN_ATTRIBUTES = new Set([
  "checked",
  "disabled",
  "hidden",
  "open",
  "readonly",
  "required",
  "selected",
]);
const BOOLEAN_PROPERTY_MAP = {
  readonly: "readOnly",
};
const BLOCKED_SELECTORS = "script, iframe, object, embed";

export const Fragment = Symbol("Fragment");

export function h(tagName, attrs = {}, ...children) {
  // JSX 없이도 읽기 쉬운 방식으로 VDOM을 직접 만들기 위한 helper입니다.
  if (tagName === Fragment) {
    return createFragment(children);
  }

  if (typeof tagName !== "string") {
    throw new Error("h() only supports string tag names. Use renderChild() for child components.");
  }

  return {
    type: "element",
    tagName,
    attrs: normalizeAttributes(attrs),
    children: normalizeChildren(children),
  };
}

export function createFragment(children = []) {
  return {
    type: "fragment",
    children: normalizeChildren(children),
  };
}

export function createText(value) {
  return {
    type: "text",
    value: String(value),
  };
}

export function normalizeRootVdom(vnode) {
  // patch 루트는 항상 fragment라고 가정하므로, 루트 반환값을 여기서 통일합니다.
  if (!vnode) {
    return createFragment();
  }

  if (vnode.type === "fragment") {
    return vnode;
  }

  if (Array.isArray(vnode)) {
    return createFragment(vnode);
  }

  return createFragment([vnode]);
}

export function cloneVdom(vnode) {
  // 이벤트 핸들러 함수까지 유지되도록 JSON stringify 대신 수동 복제를 사용합니다.
  if (vnode == null) {
    return null;
  }

  if (Array.isArray(vnode)) {
    return vnode.map((child) => cloneVdom(child));
  }

  if (vnode.type === "text") {
    return { ...vnode };
  }

  if (vnode.type === "fragment") {
    return {
      type: "fragment",
      children: cloneVdom(vnode.children ?? []),
    };
  }

  return {
    type: vnode.type,
    tagName: vnode.tagName,
    attrs: cloneAttributes(vnode.attrs ?? {}),
    children: cloneVdom(vnode.children ?? []),
  };
}

export function getNodeKey(vnode) {
  // keyed diff에서 사용할 식별자를 꺼냅니다.
  if (!vnode || vnode.type !== "element") {
    return null;
  }

  return vnode.attrs?.["data-key"] ?? vnode.attrs?.key ?? null;
}

export function sanitizeHtml(input) {
  // HTML 문자열에서 위험한 태그와 inline 이벤트 속성을 제거합니다.
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");

  doc.querySelectorAll(BLOCKED_SELECTORS).forEach((node) => node.remove());

  for (const element of doc.body.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return doc.body.innerHTML.trim();
}

export function domToVdom(container) {
  // 실제 DOM을 현재 프로젝트의 fragment 기반 VDOM 구조로 변환합니다.
  return {
    type: "fragment",
    children: Array.from(container.childNodes)
      .map((child) => domNodeToVdom(child, container))
      .filter(Boolean),
  };
}

export function htmlToVdom(input) {
  // sanitize한 HTML 문자열을 VDOM으로 바꿉니다.
  const parser = new DOMParser();
  const sanitized = sanitizeHtml(input ?? "");
  const doc = parser.parseFromString(sanitized, "text/html");
  return domToVdom(doc.body);
}

export function createDomFromVdom(vnode) {
  // VDOM 노드 하나를 실제 DOM 노드로 생성합니다.
  if (vnode.type === "fragment") {
    const fragment = document.createDocumentFragment();

    for (const child of vnode.children ?? []) {
      fragment.append(createDomFromVdom(child));
    }

    return fragment;
  }

  if (vnode.type === "text") {
    return document.createTextNode(vnode.value);
  }

  const element = document.createElement(vnode.tagName);
  syncAttributes(element, {}, vnode.attrs ?? {});

  if (!VOID_ELEMENTS.has(vnode.tagName)) {
    for (const child of vnode.children ?? []) {
      element.append(createDomFromVdom(child));
    }
  }

  return element;
}

export function renderVdom(container, vnode) {
  // 루트 컨테이너를 새 VDOM 기준으로 렌더링합니다.
  container.replaceChildren(createDomFromVdom(vnode));
}

export function syncAttributes(element, oldAttrs = {}, newAttrs = {}) {
  // 이전/다음 attrs를 비교해 필요한 부분만 실제 DOM에 반영합니다.
  for (const name of Object.keys(oldAttrs)) {
    if (!(name in newAttrs)) {
      removeAttribute(element, name, oldAttrs[name]);
    }
  }

  for (const [name, value] of Object.entries(newAttrs)) {
    if (oldAttrs[name] !== value) {
      setAttribute(element, name, value, oldAttrs[name]);
    }
  }
}

export function serializeVdom(vnode) {
  // 디버그 패널과 README 예시에 쓰기 좋도록 VDOM을 HTML 문자열로 직렬화합니다.
  return stringifyNode(vnode, 0).trim();
}

function normalizeAttributes(attrs = {}) {
  const normalized = {};

  for (const [rawName, rawValue] of Object.entries(attrs ?? {})) {
    if (rawName === "children" || rawValue == null || rawValue === false) {
      continue;
    }

    const name = rawName === "className" ? "class" : rawName;

    if (name === "style" && typeof rawValue === "object") {
      const styleValue = styleObjectToString(rawValue);

      if (styleValue) {
        normalized.style = styleValue;
      }

      continue;
    }

    if (BOOLEAN_ATTRIBUTES.has(name)) {
      normalized[name] = rawValue === true ? "" : rawValue;
      continue;
    }

    normalized[name] = rawValue;
  }

  return normalized;
}

function normalizeChildren(children) {
  const normalized = [];

  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === true) {
      continue;
    }

    if (Array.isArray(child)) {
      normalized.push(...normalizeChildren(child));
      continue;
    }

    if (typeof child === "string" || typeof child === "number") {
      normalized.push(createText(child));
      continue;
    }

    if (child.type === "fragment") {
      normalized.push(...normalizeChildren(child.children ?? []));
      continue;
    }

    normalized.push(child);
  }

  return normalized;
}

function cloneAttributes(attrs) {
  const cloned = {};

  for (const [name, value] of Object.entries(attrs)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      cloned[name] = { ...value };
      continue;
    }

    cloned[name] = value;
  }

  return cloned;
}

function domNodeToVdom(node, parentNode) {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.textContent ?? "";

    if (!shouldKeepTextNode(value, parentNode)) {
      return null;
    }

    return {
      type: "text",
      value,
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const tagName = node.tagName.toLowerCase();
  const attrs = collectAttributes(node);

  return {
    type: "element",
    tagName,
    attrs,
    children: Array.from(node.childNodes)
      .map((child) => domNodeToVdom(child, node))
      .filter(Boolean),
  };
}

function shouldKeepTextNode(value, parentNode) {
  if (!parentNode || parentNode.nodeType !== Node.ELEMENT_NODE) {
    return value.trim().length > 0;
  }

  const tagName = parentNode.tagName.toLowerCase();

  if (WHITESPACE_SENSITIVE_TAGS.has(tagName)) {
    return true;
  }

  return value.trim().length > 0;
}

function collectAttributes(element) {
  const attrs = {};

  for (const name of element.getAttributeNames()) {
    if (IGNORED_ATTRIBUTES.has(name)) {
      continue;
    }

    attrs[name] = element.getAttribute(name) ?? "";
  }

  if (element instanceof HTMLInputElement) {
    attrs.value = element.value;

    if (element.type === "checkbox" || element.type === "radio") {
      if (element.checked) {
        attrs.checked = "";
      } else {
        delete attrs.checked;
      }
    }
  }

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    attrs.value = element.value;
  }

  if (element instanceof HTMLOptionElement && element.selected) {
    attrs.selected = "";
  }

  if (element instanceof HTMLDetailsElement && element.open) {
    attrs.open = "";
  }

  return attrs;
}

function setAttribute(element, name, value, previousValue) {
  if (isEventAttribute(name)) {
    syncEventListener(element, name, value, previousValue);
    return;
  }

  if (name === "value") {
    element.value = value ?? "";
    element.setAttribute(name, value ?? "");
    return;
  }

  if (BOOLEAN_ATTRIBUTES.has(name)) {
    if (value === false || value == null) {
      removeAttribute(element, name);
      return;
    }

    element.setAttribute(name, "");
    const propertyName = BOOLEAN_PROPERTY_MAP[name] ?? name;

    if (propertyName in element) {
      element[propertyName] = true;
    }

    return;
  }

  element.setAttribute(name, String(value));
}

function removeAttribute(element, name, previousValue) {
  if (isEventAttribute(name)) {
    syncEventListener(element, name, null, previousValue);
    return;
  }

  if (name === "value") {
    element.value = "";
  }

  if (BOOLEAN_ATTRIBUTES.has(name)) {
    const propertyName = BOOLEAN_PROPERTY_MAP[name] ?? name;

    if (propertyName in element) {
      element[propertyName] = false;
    }
  }

  element.removeAttribute(name);
}

function syncEventListener(element, name, nextHandler, previousHandler) {
  const eventName = name.slice(2).toLowerCase();
  const registry = element.__miniReactListeners ?? {};

  if (typeof previousHandler === "function") {
    element.removeEventListener(eventName, previousHandler);
    delete registry[eventName];
  }

  if (typeof nextHandler === "function") {
    element.addEventListener(eventName, nextHandler);
    registry[eventName] = nextHandler;
  }

  element.__miniReactListeners = registry;
}

function isEventAttribute(name) {
  return /^on[A-Z]/.test(name);
}

function stringifyNode(vnode, depth) {
  if (!vnode) {
    return "";
  }

  if (vnode.type === "fragment") {
    return vnode.children.map((child) => stringifyNode(child, depth)).join("\n");
  }

  if (vnode.type === "text") {
    return `${indent(depth)}${escapeHtml(vnode.value)}`;
  }

  const attrs = Object.entries(vnode.attrs ?? {})
    .filter(([, value]) => typeof value !== "function")
    .map(([name, value]) =>
      value === "" ? name : `${name}="${escapeAttribute(String(value))}"`,
    )
    .join(" ");

  const openingTag = attrs ? `<${vnode.tagName} ${attrs}>` : `<${vnode.tagName}>`;

  if (VOID_ELEMENTS.has(vnode.tagName)) {
    return `${indent(depth)}${openingTag}`;
  }

  if (!vnode.children || vnode.children.length === 0) {
    return `${indent(depth)}${openingTag}</${vnode.tagName}>`;
  }

  if (hasOnlyTextChildren(vnode)) {
    const textContent = vnode.children
      .map((child) => (child.type === "text" ? escapeHtml(child.value) : stringifyNode(child, 0)))
      .join("");

    return `${indent(depth)}${openingTag}${textContent}</${vnode.tagName}>`;
  }

  const children = vnode.children
    .map((child) => stringifyNode(child, depth + 1))
    .join("\n");

  return `${indent(depth)}${openingTag}\n${children}\n${indent(depth)}</${vnode.tagName}>`;
}

function hasOnlyTextChildren(vnode) {
  return vnode.children.every((child) => child.type === "text");
}

function styleObjectToString(style) {
  return Object.entries(style)
    .filter(([, value]) => value != null && value !== "")
    .map(([name, value]) => `${camelToKebab(name)}:${value}`)
    .join(";");
}

function camelToKebab(value) {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function indent(depth) {
  return "  ".repeat(depth);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
