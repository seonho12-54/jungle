const recorderStack = [];
let traceCounter = 0;

export function pushTraceRecorder(recorder) {
  if (typeof recorder !== "function") {
    return () => {};
  }

  recorderStack.push(recorder);

  return () => {
    const index = recorderStack.lastIndexOf(recorder);

    if (index >= 0) {
      recorderStack.splice(index, 1);
    }
  };
}

export function resetTraceCounter() {
  traceCounter = 0;
}

export function trace(eventType, payload = {}) {
  const recorder = recorderStack[recorderStack.length - 1];

  if (!recorder) {
    return;
  }

  recorder({
    id: ++traceCounter,
    eventType,
    payload: summarizeTraceValue(payload),
    timestamp: Date.now(),
  });
}

export function getComponentName(renderFn) {
  return renderFn?.name || "AnonymousComponent";
}

export function summarizeTraceValue(value, depth = 0, seen = new WeakSet()) {
  if (value == null || typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (typeof Node !== "undefined" && value instanceof Node) {
    return summarizeDomNode(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return `[Array(${value.length})]`;
    }

    return value.slice(0, 8).map((item) => summarizeTraceValue(item, depth + 1, seen));
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (depth >= 3) {
    return `[${value.constructor?.name || "Object"}]`;
  }

  const entries = Object.entries(value).slice(0, 12);

  return Object.fromEntries(
    entries.map(([key, item]) => [key, summarizeTraceValue(item, depth + 1, seen)]),
  );
}

function summarizeDomNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return {
      nodeType: "text",
      textContent: compactString(node.textContent ?? ""),
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return {
      nodeType: node.nodeType,
    };
  }

  const element = node;

  return {
    nodeType: "element",
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    className: element.className || undefined,
    textContent: compactString(element.textContent ?? ""),
  };
}

function compactString(value) {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}
