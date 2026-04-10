(function initEdgeCaseTests() {
  var runButton = document.getElementById("run-tests-button");
  var resultList = document.getElementById("result-list");
  var suiteStatus = document.getElementById("suite-status");
  var suiteConsole = document.getElementById("suite-console");
  var summaryTotal = document.getElementById("summary-total");
  var summaryPass = document.getElementById("summary-pass");
  var summaryFail = document.getElementById("summary-fail");
  var summaryTime = document.getElementById("summary-time");

  if (
    !runButton ||
    !resultList ||
    !suiteStatus ||
    !suiteConsole ||
    !summaryTotal ||
    !summaryPass ||
    !summaryFail ||
    !summaryTime ||
    !window.VDOM ||
    !window.DiffEngine
  ) {
    return;
  }

  var VDOM = window.VDOM;
  var DiffEngine = window.DiffEngine;

  function vnode(tag, props, children) {
    return {
      type: "element",
      tag: tag,
      props: props || {},
      children: children || [],
    };
  }

  function text(value) {
    return {
      type: "text",
      text: String(value),
    };
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function assert(condition, label, detail) {
    return {
      ok: Boolean(condition),
      label: label,
      detail: detail || "",
    };
  }

  function buildResult(name, checks, extra) {
    var passed = checks.every(function everyCheck(check) {
      return check.ok;
    });

    return {
      name: name,
      passed: passed,
      checks: checks,
      note: extra && extra.note ? extra.note : "",
      meta: extra && extra.meta ? extra.meta : "",
      raw: extra && extra.raw ? extra.raw : null,
    };
  }

  function renderAndPatch(oldVNode, newVNode) {
    var root = document.createElement("div");
    root.appendChild(VDOM.renderVNode(oldVNode));

    var patches = DiffEngine.diff(oldVNode, newVNode);
    DiffEngine.applyPatch(root, patches);

    var patchedVNode = VDOM.domToVNode(root.firstChild);

    return {
      patches: patches,
      patchedVNode: patchedVNode,
      expectedHTML: VDOM.vnodeToHTML(newVNode),
      actualHTML: patchedVNode ? VDOM.vnodeToHTML(patchedVNode) : "",
    };
  }

  function makeDeepTree(depth, finalText) {
    var node = text(finalText);
    var currentDepth = depth;

    while (currentDepth >= 1) {
      node = vnode("div", { "data-depth": String(currentDepth) }, [node]);
      currentDepth -= 1;
    }

    return node;
  }

  function makeLargeList(count, changedIndex) {
    var children = [];
    var index = 0;

    while (index < count) {
      children.push(
        vnode("li", { "data-id": String(index) }, [
          text(index === changedIndex ? "item-" + index + "-changed" : "item-" + index),
        ])
      );
      index += 1;
    }

    return vnode("ul", { class: "big-list" }, children);
  }

  function parseHTMLToVNode(html) {
    var template = document.createElement("template");
    template.innerHTML = html;
    return VDOM.domToVNode(template.content.firstElementChild);
  }

  function runDeepNestedTest() {
    var start = performance.now();
    var oldVNode = makeDeepTree(600, "A");
    var newVNode = makeDeepTree(600, "B");
    var result = renderAndPatch(oldVNode, newVNode);
    var duration = Math.round((performance.now() - start) * 100) / 100;

    return buildResult(
      "1. 중첩 구조",
      [
        assert(result.patches.length === 1, "patch 수", "depth 600에서 patch 1개인지 확인"),
        assert(
          result.actualHTML === result.expectedHTML,
          "patch 결과 일치",
          "깊은 트리도 최종 HTML이 기대값과 같은지 확인"
        ),
      ],
      {
        meta: "depth 600, duration " + duration + "ms",
        raw: result.patches,
      }
    );
  }

  function runWhitespaceTest() {
    var normalOld = parseHTMLToVNode("<div>\n  <span>A</span>\n</div>");
    var normalNew = parseHTMLToVNode("<div>\n\n        <span>A</span>\n\n</div>");
    var normalPatches = DiffEngine.diff(normalOld, normalNew);

    var preOldElement = document.createElement("pre");
    preOldElement.textContent = "   ";
    var preNewElement = document.createElement("pre");
    preNewElement.textContent = "      ";
    var preOld = VDOM.domToVNode(preOldElement);
    var preNew = VDOM.domToVNode(preNewElement);
    var prePatches = DiffEngine.diff(preOld, preNew);

    return buildResult(
      "2. 공백 처리",
      [
        assert(
          normalPatches.length === 0,
          "일반 공백 무시",
          "들여쓰기나 줄바꿈만 다른 경우는 diff가 생기지 않아야 함"
        ),
        assert(
          prePatches.length > 0,
          "공백 민감 태그 보존",
          "<pre> 안 공백은 의미가 있으므로 diff가 감지되어야 함"
        ),
      ],
      {
        meta: "일반 공백과 공백 민감 태그를 같이 검사",
        note:
          "<pre> 공백 테스트가 실패하면 현재 구현이 whitespace-sensitive context를 구분하지 못한다는 뜻입니다.",
        raw: {
          normalPatchCount: normalPatches.length,
          prePatchCount: prePatches.length,
        },
      }
    );
  }

  function runLargeListTest() {
    var start = performance.now();
    var oldVNode = makeLargeList(10000, -1);
    var newVNode = makeLargeList(10000, 9876);
    var result = renderAndPatch(oldVNode, newVNode);
    var duration = Math.round((performance.now() - start) * 100) / 100;

    return buildResult(
      "3. 대량 리스트",
      [
        assert(result.patches.length === 1, "patch 수", "10,000개 중 1개만 바뀌었을 때 patch 1개인지 확인"),
        assert(
          result.actualHTML === result.expectedHTML,
          "patch 결과 일치",
          "대량 리스트에서도 최종 HTML이 기대값과 같은지 확인"
        ),
      ],
      {
        meta: "item 10000, changed index 9876, duration " + duration + "ms",
        raw: result.patches,
      }
    );
  }

  function runMixedPropsTest() {
    var buttonOld = vnode(
      "button",
      {
        class: "btn primary",
        "data-id": "1",
        title: "old",
        disabled: "",
        style: "color:red;padding:4px",
        "aria-label": "old-button",
      },
      [text("send")]
    );
    var buttonNew = vnode(
      "button",
      {
        class: "btn active secondary",
        "data-id": "2",
        title: "new",
        style: "color:blue;margin:2px",
        "aria-label": "new-button",
        "data-mode": "on",
      },
      [text("send")]
    );

    var buttonResult = renderAndPatch(buttonOld, buttonNew);

    var inputOld = vnode(
      "input",
      {
        type: "checkbox",
        checked: "",
        value: "old",
        class: "box old",
      },
      []
    );
    var inputNew = vnode(
      "input",
      {
        type: "checkbox",
        value: "new",
        class: "box new",
        "data-mode": "done",
      },
      []
    );

    var inputRoot = document.createElement("div");
    inputRoot.appendChild(VDOM.renderVNode(inputOld));
    var inputPatches = DiffEngine.diff(inputOld, inputNew);
    DiffEngine.applyPatch(inputRoot, inputPatches);
    var inputElement = inputRoot.firstChild;

    return buildResult(
      "4. 속성 혼합 변경",
      [
        assert(
          buttonResult.actualHTML === buttonResult.expectedHTML,
          "일반 속성 반영",
          "class, style, data-*, title, disabled 변경이 반영되는지 확인"
        ),
        assert(
          inputElement.checked === false &&
            inputElement.value === "new" &&
            inputElement.getAttribute("class") === "box new" &&
            inputElement.getAttribute("data-mode") === "done",
          "form 속성 반영",
          "input value/checked/class/data-* 변경이 함께 반영되는지 확인"
        ),
      ],
      {
        meta: "button 속성 + input form 속성을 같이 검사",
        raw: {
          buttonPatches: buttonResult.patches,
          inputPatches: inputPatches,
        },
      }
    );
  }

  function renderResults(results, duration) {
    var passCount = results.filter(function filterResult(result) {
      return result.passed;
    }).length;
    var failCount = results.length - passCount;

    summaryTotal.textContent = String(results.length);
    summaryPass.textContent = String(passCount);
    summaryFail.textContent = String(failCount);
    summaryTime.textContent = duration + " ms";
    suiteStatus.textContent = failCount === 0 ? "모든 테스트 통과" : "실패한 테스트 있음";

    resultList.innerHTML = results
      .map(function mapResult(result) {
        var checksHTML = result.checks
          .map(function mapCheck(check) {
            return [
              '<li class="check-item">',
              "<div>",
              "<strong>" + escapeHTML(check.label) + "</strong>",
              "<span>" + escapeHTML(check.detail) + "</span>",
              "</div>",
              '<span class="check-status ' + (check.ok ? "pass" : "fail") + '">' + (check.ok ? "PASS" : "FAIL") + "</span>",
              "</li>",
            ].join("");
          })
          .join("");

        return [
          '<article class="result-card ' + (result.passed ? "pass" : "fail") + '">',
          '<div class="result-top">',
          "<h3>" + escapeHTML(result.name) + "</h3>",
          '<span class="badge ' + (result.passed ? "pass" : "fail") + '">' + (result.passed ? "PASS" : "FAIL") + "</span>",
          "</div>",
          '<p class="meta">' + escapeHTML(result.meta) + "</p>",
          '<ul class="check-list">' + checksHTML + "</ul>",
          result.note ? '<div class="note">' + escapeHTML(result.note) + "</div>" : "",
          "</article>",
        ].join("");
      })
      .join("");

    suiteConsole.textContent = JSON.stringify(
      results.map(function mapRaw(result) {
        return {
          name: result.name,
          passed: result.passed,
          meta: result.meta,
          raw: result.raw,
        };
      }),
      null,
      2
    );
  }

  function runSuite() {
    suiteStatus.textContent = "테스트 실행 중";
    resultList.innerHTML = "";
    suiteConsole.textContent = "Running edge case tests...";

    window.setTimeout(function executeSuite() {
      var start = performance.now();
      var results = [
        runDeepNestedTest(),
        runWhitespaceTest(),
        runLargeListTest(),
        runMixedPropsTest(),
      ];
      var duration = Math.round((performance.now() - start) * 100) / 100;

      renderResults(results, duration);
    }, 20);
  }

  runButton.addEventListener("click", runSuite);
  runSuite();
})();
