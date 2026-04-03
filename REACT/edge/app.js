(function initLikeFeedLab() {
  var actualRoot = document.getElementById("actual-root");
  var beforePreviewRoot = document.getElementById("before-preview");
  var afterPreviewRoot = document.getElementById("after-preview");
  var beforePreviewWrap = document.getElementById("before-preview-wrap");
  var afterPreviewWrap = document.getElementById("after-preview-wrap");
  var beforeVdom = document.getElementById("before-vdom");
  var afterVdom = document.getElementById("after-vdom");
  var vdomChangeJson = document.getElementById("vdom-change-json");
  var vdomChangeCards = document.getElementById("vdom-change-cards");
  var patchLog = document.getElementById("patch-log");
  var gitDiff = document.getElementById("git-diff");
  var historyList = document.getElementById("history-list");
  var historySummary = document.getElementById("history-summary");
  var historyPosition = document.getElementById("history-position");
  var focusTitle = document.getElementById("focus-title");
  var patchSummary = document.getElementById("patch-summary");
  var feedStatus = document.getElementById("feed-status");
  var actionStatus = document.getElementById("action-status");
  var addCount = document.getElementById("add-count");
  var removeCount = document.getElementById("remove-count");
  var patchCount = document.getElementById("patch-count");
  var focusedPostLabel = document.getElementById("focused-post-label");
  var undoButton = document.getElementById("undo-button");
  var redoButton = document.getElementById("redo-button");
  var resetButton = document.getElementById("reset-button");

  if (
    !actualRoot ||
    !beforePreviewRoot ||
    !afterPreviewRoot ||
    !beforePreviewWrap ||
    !afterPreviewWrap ||
    !beforeVdom ||
    !afterVdom ||
    !vdomChangeJson ||
    !vdomChangeCards ||
    !patchLog ||
    !gitDiff ||
    !historyList ||
    !historySummary ||
    !historyPosition ||
    !window.DiffEngine ||
    !window.HistoryManager ||
    !window.VDOM
  ) {
    return;
  }

  var diff = window.DiffEngine.diff;
  var applyPatch = window.DiffEngine.applyPatch;
  var createHistoryManager = window.HistoryManager.createHistoryManager;
  var renderVNode = window.VDOM.renderVNode;
  var cloneVNode = window.VDOM.cloneVNode;
  var domToVNode = window.VDOM.domToVNode;
  var vnodeToHTML = window.VDOM.vnodeToHTML;

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return {
      type: "text",
      text: String(value),
    };
  }

  function element(tag, props, children) {
    return {
      type: "element",
      tag: tag,
      props: props || {},
      children: (children || []).filter(Boolean),
    };
  }

  function replaceChildrenCompat(rootElement, nextChild) {
    while (rootElement.firstChild) {
      rootElement.removeChild(rootElement.firstChild);
    }

    if (nextChild) {
      rootElement.appendChild(nextChild);
    }
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function truncateText(value, maxLength) {
    if (value.length <= maxLength) {
      return value;
    }

    return value.slice(0, maxLength - 3) + "...";
  }

  var initialState = {
    posts: [
      {
        id: "post-1",
        author: "Mina",
        initials: "MN",
        handle: "@mina.dev",
        time: "방금 전",
        avatarTone: "sunset",
        mediaTone: "sunrise",
        badge: "React Practice",
        mediaTitle: "Like를 누르면 이 카드만 바로 바뀝니다",
        copy:
          "왼쪽에서 Like를 누르면 오른쪽은 이 카드만 따라가면서 patch 결과를 보기 쉽게 보여줍니다.",
        likes: 16,
        comments: 4,
        liked: false,
      },
      {
        id: "post-2",
        author: "Jun",
        initials: "JN",
        handle: "@jun.ui",
        time: "12분 전",
        avatarTone: "ocean",
        mediaTone: "sea",
        badge: "Layout Study",
        mediaTitle: "스크롤되는 피드가 시연할 때 훨씬 자연스럽습니다",
        copy:
          "이 카드는 처음부터 Like 상태라서 Undo와 Redo를 양방향으로 시연하기 좋습니다.",
        likes: 21,
        comments: 7,
        liked: true,
      },
      {
        id: "post-3",
        author: "Sua",
        initials: "SA",
        handle: "@sua.lab",
        time: "25분 전",
        avatarTone: "forest",
        mediaTone: "studio",
        badge: "Vanilla JS",
        mediaTitle: "한 카드에만 집중하면 Diff가 더 잘 보입니다",
        copy:
          "오른쪽 패널이 바뀐 Post 하나만 따라가면 Virtual DOM 설명이 훨씬 더 직관적으로 보입니다.",
        likes: 9,
        comments: 2,
        liked: false,
      },
      {
        id: "post-4",
        author: "Doyoon",
        initials: "DY",
        handle: "@doyoon.flow",
        time: "1시간 전",
        avatarTone: "berry",
        mediaTone: "city",
        badge: "Demo Flow",
        mediaTitle: "Before와 After는 나란히 보여야 이해가 쉽습니다",
        copy:
          "Inspect는 상태를 바꾸지 않고 포커스만 옮겨서, 레이아웃부터 설명하고 싶을 때 편합니다.",
        likes: 34,
        comments: 11,
        liked: false,
      },
      {
        id: "post-5",
        author: "Yerin",
        initials: "YR",
        handle: "@yerin.mini",
        time: "어제",
        avatarTone: "night",
        mediaTone: "mint",
        badge: "Prototype",
        mediaTitle: "작지만 바로 시연 가능한 소셜 피드",
        copy:
          "완성형 서비스가 아니라도, 수업이나 발표에서 바로 보여줄 수 있을 정도면 충분합니다.",
        likes: 12,
        comments: 5,
        liked: false,
      },
    ],
  };

  function buildComposerVNode() {
    return element("section", { class: "composer-card" }, [
      element("h3", { class: "composer-title" }, [text("시연 목표")]),
      element("p", { class: "composer-copy" }, [
        text(
          "왼쪽은 User Page처럼 직접 눌러보는 공간이고, 오른쪽은 선택된 카드의 Before / After만 집중해서 보여줍니다."
        ),
      ]),
      element("div", { class: "composer-tags" }, [
        element("span", { class: "composer-tag" }, [text("Like Toggle")]),
        element("span", { class: "composer-tag" }, [text("Focused Compare")]),
        element("span", { class: "composer-tag" }, [text("HTML Diff")]),
      ]),
    ]);
  }

  function buildPostVNode(post) {
    var likeLabel = post.liked ? "Liked" : "Like";
    var noteLabel = post.liked
      ? "Like 상태가 켜져 있어서 이 카드가 강조되고 있습니다."
      : "Like를 누르면 이 카드 변화가 Compare 패널에 바로 반영됩니다.";

    return element(
      "article",
      {
        class: "post-card",
        "data-post-id": post.id,
        "data-liked": post.liked ? "true" : "false",
      },
      [
        element("div", { class: "post-top" }, [
          element("div", { class: "profile-row" }, [
            element("div", { class: "avatar", "data-tone": post.avatarTone }, [text(post.initials)]),
            element("div", { class: "name-stack" }, [
              element("strong", { class: "author" }, [text(post.author)]),
              element("span", { class: "handle" }, [text(post.handle)]),
            ]),
          ]),
          element("span", { class: "post-time" }, [text(post.time)]),
        ]),
        element("p", { class: "post-copy" }, [text(post.copy)]),
        element("div", { class: "post-media", "data-tone": post.mediaTone }, [
          element("span", { class: "media-badge" }, [text(post.badge)]),
          element("strong", { class: "media-title" }, [text(post.mediaTitle)]),
        ]),
        element("div", { class: "reaction-row" }, [
          element("span", { class: "reaction-copy" }, [text("좋아요 " + post.likes)]),
          element("span", { class: "comment-copy" }, [text("댓글 " + post.comments)]),
        ]),
        element("p", { class: "like-note" + (post.liked ? "" : " is-muted") }, [text(noteLabel)]),
        element("div", { class: "action-row" }, [
          element(
            "button",
            {
              class: "social-button like-button" + (post.liked ? " is-active" : ""),
              type: "button",
              "data-action": "toggle-like",
              "data-post-id": post.id,
              "aria-pressed": post.liked ? "true" : "false",
            },
            [
              element("span", { class: "heart-icon", "aria-hidden": "true" }, [text(post.liked ? "ON" : "OFF")]),
              element("span", { class: "button-label" }, [text(likeLabel)]),
            ]
          ),
          element(
            "button",
            {
              class: "social-button ghost-button",
              type: "button",
              "data-action": "focus-post",
              "data-post-id": post.id,
            },
            [text("Inspect")]
          ),
        ]),
      ]
    );
  }

  function buildFeedVNode(state) {
    return element("div", { class: "feed-shell" }, [
      element("header", { class: "feed-appbar" }, [
        element("div", { class: "feed-brand" }, [
          element("div", { class: "brand-group" }, [
            element("div", { class: "brand-mark" }, [text("M")]),
            element("div", { class: "brand-copy" }, [
              element("strong", { class: "brand-name" }, [text("MiniBook")]),
              element("span", { class: "brand-sub" }, [text("Like를 누르고 Compare를 확인해보세요")]),
            ]),
          ]),
          element("span", { class: "mini-chip warm" }, [text("시연 중")]),
        ]),
        element("div", { class: "counter-chip-row" }, [
          element("span", { class: "mini-chip" }, [text("피드 " + state.posts.length + "개")]),
          element("span", { class: "mini-chip" }, [text("집중 patch 보기")]),
        ]),
      ]),
      buildComposerVNode(),
      element("div", { class: "feed-scroll" }, state.posts.map(buildPostVNode)),
    ]);
  }

  function getPostById(state, postId) {
    return state.posts.find(function findPost(post) {
      return post.id === postId;
    });
  }

  function toggleLikeState(state, postId) {
    var nextState = cloneData(state);

    nextState.posts = nextState.posts.map(function mapPost(post) {
      if (post.id !== postId) {
        return post;
      }

      var nextLiked = !post.liked;

      return Object.assign({}, post, {
        liked: nextLiked,
        likes: post.likes + (nextLiked ? 1 : -1),
      });
    });

    return nextState;
  }

  function renderVNodeInto(root, vnode) {
    replaceChildrenCompat(root, vnode ? renderVNode(vnode) : null);
  }

  function findPostVNode(vnode, postId) {
    if (!vnode || vnode.type !== "element") {
      return null;
    }

    if (vnode.props["data-post-id"] === postId) {
      return vnode;
    }

    for (var index = 0; index < vnode.children.length; index += 1) {
      var foundChild = findPostVNode(vnode.children[index], postId);
      if (foundChild) {
        return foundChild;
      }
    }

    return null;
  }

  function getNodeByPath(vnode, path) {
    var currentNode = vnode;

    for (var index = 0; index < path.length; index += 1) {
      if (!currentNode || !currentNode.children) {
        return null;
      }

      currentNode = currentNode.children[path[index]];
    }

    return currentNode || null;
  }

  function getClosestPostIdByPath(vnode, path) {
    var currentNode = vnode;
    var closestPostId = null;

    if (currentNode && currentNode.props && currentNode.props["data-post-id"]) {
      closestPostId = currentNode.props["data-post-id"];
    }

    for (var index = 0; index < path.length; index += 1) {
      if (!currentNode || !currentNode.children) {
        break;
      }

      currentNode = currentNode.children[path[index]];

      if (currentNode && currentNode.props && currentNode.props["data-post-id"]) {
        closestPostId = currentNode.props["data-post-id"];
      }
    }

    return closestPostId;
  }

  function resolveFocusPostId(previousVNode, nextVNode, patches, preferredPostId) {
    if (preferredPostId) {
      return preferredPostId;
    }

    for (var index = 0; index < patches.length; index += 1) {
      var patch = patches[index];
      var fromNext = getClosestPostIdByPath(nextVNode, patch.path);
      var fromPrevious = getClosestPostIdByPath(previousVNode, patch.path);

      if (fromNext || fromPrevious) {
        return fromNext || fromPrevious;
      }
    }

    return lastFocusedPostId || initialState.posts[0].id;
  }

  function filterPatchesForPost(patches, previousVNode, nextVNode, postId) {
    return patches.filter(function filterPatch(patch) {
      var fromNext = getClosestPostIdByPath(nextVNode, patch.path);
      var fromPrevious = getClosestPostIdByPath(previousVNode, patch.path);

      return fromNext === postId || fromPrevious === postId;
    });
  }

  function formatVNodeForCode(vnode) {
    if (!vnode) {
      return "null";
    }

    return JSON.stringify(vnode, null, 2);
  }

  function buildPatchSummary(patches) {
    if (!patches.length) {
      return "PATCH 0";
    }

    var counts = {
      ADD: 0,
      REMOVE: 0,
      REPLACE: 0,
      TEXT: 0,
      PROPS: 0,
    };

    patches.forEach(function eachPatch(patch) {
      counts[patch.type] += 1;
    });

    return ["ADD", "REMOVE", "TEXT", "PROPS", "REPLACE"]
      .filter(function filterType(type) {
        return counts[type] > 0;
      })
      .map(function mapType(type) {
        return type + " " + counts[type];
      })
      .join(" / ");
  }

  function buildPatchDescription(patch, previousVNode, nextVNode) {
    var previousNode = getNodeByPath(previousVNode, patch.path);
    var nextNode = getNodeByPath(nextVNode, patch.path);

    if (patch.type === "ADD") {
      return "A new node was added: <" + ((patch.node && patch.node.tag) || "text") + ">.";
    }

    if (patch.type === "REMOVE") {
      return "A node was removed: <" + ((previousNode && previousNode.tag) || "text") + ">.";
    }

    if (patch.type === "REPLACE") {
      return "A node was replaced with <" + ((patch.node && patch.node.tag) || "text") + ">.";
    }

    if (patch.type === "TEXT") {
      return 'Text changed to "' + truncateText(patch.text, 48) + '".';
    }

    if (patch.type === "PROPS") {
      return "Props changed: " + Object.keys(patch.props).join(", ") + ".";
    }

    return "A change was detected in this component.";
  }

  function summarizeVNodeNode(node) {
    if (!node) {
      return null;
    }

    if (node.type === "text") {
      return {
        type: "text",
        text: node.text,
      };
    }

    return {
      type: node.type,
      tag: node.tag,
      props: node.props,
      childrenCount: node.children ? node.children.length : 0,
    };
  }

  function pickChangedProps(sourceProps, changedProps) {
    var keys = Object.keys(changedProps || {});
    var result = {};

    keys.forEach(function eachKey(key) {
      if (sourceProps && Object.prototype.hasOwnProperty.call(sourceProps, key)) {
        result[key] = sourceProps[key];
      } else {
        result[key] = null;
      }
    });

    return result;
  }

  function getPatchBeforeValue(patch, beforeVNode) {
    var previousNode = getNodeByPath(beforeVNode, patch.path);

    if (patch.type === "TEXT") {
      return previousNode ? previousNode.text : null;
    }

    if (patch.type === "PROPS") {
      return pickChangedProps(previousNode && previousNode.props, patch.props);
    }

    if (patch.type === "REMOVE" || patch.type === "REPLACE") {
      return summarizeVNodeNode(previousNode);
    }

    return null;
  }

  function getPatchAfterValue(patch, afterVNode) {
    var nextNode = getNodeByPath(afterVNode, patch.path);

    if (patch.type === "TEXT") {
      return patch.text;
    }

    if (patch.type === "PROPS") {
      return pickChangedProps(nextNode && nextNode.props, patch.props);
    }

    if (patch.type === "ADD" || patch.type === "REPLACE") {
      return summarizeVNodeNode(patch.node || nextNode);
    }

    return null;
  }

  function formatObjectValue(value) {
    if (value === null || value === undefined) {
      return "null";
    }

    return JSON.stringify(value, null, 2);
  }

  function countLikedInState(state) {
    return state.posts.filter(function filterPost(post) {
      return post.liked;
    }).length;
  }

  function summarizeLikedAuthors(state) {
    var likedAuthors = state.posts
      .filter(function filterPost(post) {
        return post.liked;
      })
      .map(function mapPost(post) {
        return post.author;
      });

    return likedAuthors.length ? likedAuthors.join(", ") : "없음";
  }

  function buildHistoryEntryLabel(index) {
    if (index === 0) {
      return "초기 상태";
    }

    return "저장 상태 " + index;
  }

  function renderHistoryTimeline() {
    var snapshots = stateHistory.getSnapshots();
    var currentIndex = stateHistory.getCurrentIndex();

    historyPosition.textContent = "STEP " + (currentIndex + 1) + " / " + snapshots.length;
    historySummary.textContent =
      "현재 " +
      (currentIndex + 1) +
      "번째 상태를 보고 있습니다. 좋아요가 눌린 카드 수: " +
      countLikedInState(snapshots[currentIndex]) +
      "개";

    historyList.innerHTML = snapshots
      .map(function mapSnapshot(snapshot, index) {
        var likedCount = countLikedInState(snapshot);
        var activeClass = index === currentIndex ? " is-active" : "";

        return [
          '<article class="history-item' + activeClass + '">',
          '<div class="history-item-head">',
          '<span class="history-step">STEP ' + (index + 1) + "</span>",
          '<span class="history-badge">' + (index === currentIndex ? "CURRENT" : "SNAPSHOT") + "</span>",
          "</div>",
          '<h3 class="history-title">' + escapeHTML(buildHistoryEntryLabel(index)) + "</h3>",
          '<p class="history-meta">좋아요 켜진 카드: ' + escapeHTML(String(likedCount)) + "개</p>",
          '<p class="history-meta">좋아요 상태: ' + escapeHTML(summarizeLikedAuthors(snapshot)) + "</p>",
          '<p class="history-meta">전체 피드 수: ' + escapeHTML(String(snapshot.posts.length)) + "개</p>",
          "</article>",
        ].join("");
      })
      .join("");
  }

  function renderVdomChangeObjects(beforeVNode, afterVNode) {
    var objectPatches = diff(beforeVNode, afterVNode);

    if (!objectPatches.length) {
      vdomChangeJson.textContent = "[]";
      vdomChangeCards.innerHTML =
        '<div class="object-empty">아직 바뀐 Virtual DOM 객체가 없습니다. Like를 누르면 바뀐 path와 before/after 값을 여기서 바로 볼 수 있습니다.</div>';
      return;
    }

    vdomChangeJson.textContent = JSON.stringify(objectPatches, null, 2);
    vdomChangeCards.innerHTML = objectPatches
      .map(function mapPatch(patch) {
        var pathLabel = patch.path.length ? patch.path.join(" > ") : "root";
        var beforeValue = formatObjectValue(getPatchBeforeValue(patch, beforeVNode));
        var afterValue = formatObjectValue(getPatchAfterValue(patch, afterVNode));

        return [
          '<article class="object-change-item">',
          '<div class="object-change-head">',
          '<span class="object-change-title">' + escapeHTML(pathLabel) + "</span>",
          '<span class="object-pill">' + escapeHTML(patch.type) + "</span>",
          "</div>",
          '<div class="object-diff-grid">',
          '<div class="object-diff-side">',
          "<strong>Before</strong>",
          "<pre>" + escapeHTML(beforeValue) + "</pre>",
          "</div>",
          '<div class="object-diff-side">',
          "<strong>After</strong>",
          "<pre>" + escapeHTML(afterValue) + "</pre>",
          "</div>",
          "</div>",
          "</article>",
        ].join("");
      })
      .join("");
  }

  function renderPatchLog(patches, previousVNode, nextVNode) {
    if (!patches.length) {
      patchLog.innerHTML =
        '<li class="patch-item"><span class="patch-tag ready">READY</span><p>아직 바뀐 상태가 없습니다. 왼쪽에서 Like를 누르거나 Inspect로 카드를 골라보세요.</p><small>path: focused component</small></li>';
      return;
    }

    patchLog.innerHTML = patches
      .map(function mapPatch(patch) {
        var pathLabel = patch.path.length ? patch.path.join(" > ") : "root";
        var tagClass = patch.type.toLowerCase();

        return [
          '<li class="patch-item">',
          '<span class="patch-tag ' + tagClass + '">' + escapeHTML(patch.type) + "</span>",
          "<p>" + escapeHTML(buildPatchDescription(patch, previousVNode, nextVNode)) + "</p>",
          "<small>path: " + escapeHTML(pathLabel) + "</small>",
          "</li>",
        ].join("");
      })
      .join("");
  }

  function buildLineDiff(beforeLines, afterLines) {
    var matrix = [];
    var row;
    var column;

    for (row = 0; row <= beforeLines.length; row += 1) {
      matrix[row] = [];
      for (column = 0; column <= afterLines.length; column += 1) {
        matrix[row][column] = 0;
      }
    }

    for (var beforeIndex = beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
      for (var afterIndex = afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
        if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
          matrix[beforeIndex][afterIndex] = matrix[beforeIndex + 1][afterIndex + 1] + 1;
        } else {
          matrix[beforeIndex][afterIndex] = Math.max(
            matrix[beforeIndex + 1][afterIndex],
            matrix[beforeIndex][afterIndex + 1]
          );
        }
      }
    }

    var rows = [];
    var leftLineNumber = 1;
    var rightLineNumber = 1;
    var leftIndex = 0;
    var rightIndex = 0;

    while (leftIndex < beforeLines.length && rightIndex < afterLines.length) {
      if (beforeLines[leftIndex] === afterLines[rightIndex]) {
        rows.push({
          type: "context",
          sign: " ",
          lineNumber: rightLineNumber,
          content: afterLines[rightIndex],
        });
        leftIndex += 1;
        rightIndex += 1;
        leftLineNumber += 1;
        rightLineNumber += 1;
      } else if (matrix[leftIndex + 1][rightIndex] >= matrix[leftIndex][rightIndex + 1]) {
        rows.push({
          type: "remove",
          sign: "-",
          lineNumber: leftLineNumber,
          content: beforeLines[leftIndex],
        });
        leftIndex += 1;
        leftLineNumber += 1;
      } else {
        rows.push({
          type: "add",
          sign: "+",
          lineNumber: rightLineNumber,
          content: afterLines[rightIndex],
        });
        rightIndex += 1;
        rightLineNumber += 1;
      }
    }

    while (leftIndex < beforeLines.length) {
      rows.push({
        type: "remove",
        sign: "-",
        lineNumber: leftLineNumber,
        content: beforeLines[leftIndex],
      });
      leftIndex += 1;
      leftLineNumber += 1;
    }

    while (rightIndex < afterLines.length) {
      rows.push({
        type: "add",
        sign: "+",
        lineNumber: rightLineNumber,
        content: afterLines[rightIndex],
      });
      rightIndex += 1;
      rightLineNumber += 1;
    }

    return rows;
  }

  function renderGitDiff(beforeVNode, afterVNode) {
    var beforeHTML = vnodeToHTML(beforeVNode).split("\n");
    var afterHTML = vnodeToHTML(afterVNode).split("\n");
    var diffRows = buildLineDiff(beforeHTML, afterHTML);
    var additions = 0;
    var removals = 0;

    diffRows.forEach(function eachRow(row) {
      if (row.type === "add") {
        additions += 1;
      }

      if (row.type === "remove") {
        removals += 1;
      }
    });

    addCount.textContent = "+" + additions;
    removeCount.textContent = "-" + removals;
    gitDiff.innerHTML = diffRows
      .map(function mapRow(row) {
        return [
          '<div class="diff-line ' + row.type + '">',
          '<div class="diff-sign">' + escapeHTML(row.sign) + "</div>",
          '<div class="diff-number">' + escapeHTML(row.lineNumber) + "</div>",
          '<pre class="diff-code">' + escapeHTML(row.content || "") + "</pre>",
          "</div>",
        ].join("");
      })
      .join("");
  }

  function animateFocus(meta) {
    beforePreviewWrap.classList.remove("flash");
    afterPreviewWrap.classList.remove("flash");

    if (!meta.animate) {
      return;
    }

    window.requestAnimationFrame(function onNextFrame() {
      beforePreviewWrap.classList.add("flash");
      afterPreviewWrap.classList.add("flash");

      window.setTimeout(function removeAnimation() {
        beforePreviewWrap.classList.remove("flash");
        afterPreviewWrap.classList.remove("flash");
      }, 900);
    });
  }

  function renderComparison(previousVNode, nextVNode, patches, meta) {
    var focusPostId = resolveFocusPostId(previousVNode, nextVNode, patches, meta.postId);
    var focusedPost = getPostById(currentState, focusPostId) || currentState.posts[0];
    var beforeFocusedVNode = findPostVNode(previousVNode, focusPostId) || previousVNode;
    var afterFocusedVNode = findPostVNode(nextVNode, focusPostId) || nextVNode;
    var focusedPatches = filterPatchesForPost(patches, previousVNode, nextVNode, focusPostId);

    lastFocusedPostId = focusPostId;

    renderVNodeInto(beforePreviewRoot, cloneVNode(beforeFocusedVNode));
    renderVNodeInto(afterPreviewRoot, cloneVNode(afterFocusedVNode));

    beforeVdom.textContent = formatVNodeForCode(beforeFocusedVNode);
    afterVdom.textContent = formatVNodeForCode(afterFocusedVNode);

    focusTitle.textContent = focusedPost.author + " 피드 카드";
    patchSummary.textContent = buildPatchSummary(focusedPatches);
    patchCount.textContent = "PATCH " + focusedPatches.length;
    focusedPostLabel.textContent = focusPostId;
    feedStatus.textContent = meta.feedMessage;
    actionStatus.textContent = meta.actionMessage;

    renderPatchLog(focusedPatches, previousVNode, nextVNode);
    renderVdomChangeObjects(beforeFocusedVNode, afterFocusedVNode);
    renderGitDiff(beforeFocusedVNode, afterFocusedVNode);
    renderHistoryTimeline();
    animateFocus(meta);
  }

  function updateButtons() {
    undoButton.disabled = !stateHistory.canUndo();
    redoButton.disabled = !stateHistory.canRedo();
  }

  function renderActualFeed(nextVNode, patches) {
    if (!actualRoot.firstChild) {
      renderVNodeInto(actualRoot, nextVNode);
      return;
    }

    if (!patches.length) {
      return;
    }

    var patchedSuccessfully = false;

    try {
      applyPatch(actualRoot, patches);
      patchedSuccessfully = true;
    } catch (error) {
      patchedSuccessfully = false;
    }

    if (!patchedSuccessfully) {
      renderVNodeInto(actualRoot, nextVNode);
      return;
    }

    var actualVNode = domToVNode(actualRoot.firstChild);

    if (!actualVNode || vnodeToHTML(actualVNode) !== vnodeToHTML(nextVNode)) {
      renderVNodeInto(actualRoot, nextVNode);
    }
  }

  function commitTransition(nextState, meta, shouldPushHistory) {
    var previousVNode = cloneVNode(currentVNode);
    var nextVNode = buildFeedVNode(nextState);
    var patches = diff(currentVNode, nextVNode);

    renderActualFeed(nextVNode, patches);

    currentState = cloneData(nextState);
    currentVNode = cloneVNode(nextVNode);

    if (shouldPushHistory) {
      stateHistory.push(currentState);
    }

    renderComparison(previousVNode, nextVNode, patches, meta);
    updateButtons();
  }

  function createMeta(actionMessage, feedMessage, postId, animate) {
    return {
      actionMessage: actionMessage,
      feedMessage: feedMessage,
      postId: postId,
      animate: !!animate,
    };
  }

  function handleLikeToggle(postId) {
    var currentPost = getPostById(currentState, postId);

    if (!currentPost) {
      return;
    }

    var nextState = toggleLikeState(currentState, postId);
    var nextPost = getPostById(nextState, postId);
    var actionMessage = currentPost.liked
      ? nextPost.author + " 카드의 Like를 취소했습니다."
      : nextPost.author + " 카드에 Like를 반영했습니다.";
    var feedMessage = currentPost.liked ? "Like 취소됨" : "Like 반영됨";

    commitTransition(nextState, createMeta(actionMessage, feedMessage, postId, true), true);
  }

  function handleFocusOnly(postId) {
    var targetPost = getPostById(currentState, postId);

    if (!targetPost) {
      return;
    }

    renderComparison(
      currentVNode,
      currentVNode,
      [],
      createMeta(targetPost.author + " 카드를 상태 변경 없이 보고 있습니다.", "포커스 이동", postId, true)
    );
  }

  function handleUndo() {
    var previousState = stateHistory.undo();

    if (!previousState) {
      return;
    }

    commitTransition(previousState, createMeta("이전 상태로 되돌렸습니다.", "Undo 적용", null, true), false);
  }

  function handleRedo() {
    var nextState = stateHistory.redo();

    if (!nextState) {
      return;
    }

    commitTransition(nextState, createMeta("다음 상태를 다시 적용했습니다.", "Redo 적용", null, true), false);
  }

  function handleReset() {
    stateHistory = createHistoryManager(cloneData(initialState));
    commitTransition(cloneData(initialState), createMeta("처음 화면으로 초기화했습니다.", "준비 완료", null, true), false);
  }

  function handleFeedClick(event) {
    var baseTarget = event.target && event.target.nodeType === 1 ? event.target : event.target.parentElement;
    var actionTarget = baseTarget ? baseTarget.closest("[data-action]") : null;

    if (!actionTarget || !actualRoot.contains(actionTarget)) {
      return;
    }

    var actionName = actionTarget.getAttribute("data-action");
    var postId = actionTarget.getAttribute("data-post-id");

    if (actionName === "toggle-like") {
      handleLikeToggle(postId);
      return;
    }

    if (actionName === "focus-post") {
      handleFocusOnly(postId);
    }
  }

  var currentState = cloneData(initialState);
  var currentVNode = buildFeedVNode(currentState);
  var stateHistory = createHistoryManager(cloneData(initialState));
  var lastFocusedPostId = initialState.posts[0].id;

  renderVNodeInto(actualRoot, currentVNode);
  renderComparison(
    currentVNode,
    currentVNode,
    [],
    createMeta("동작을 기다리는 중", "준비 완료", lastFocusedPostId, false)
  );
  updateButtons();

  actualRoot.addEventListener("click", handleFeedClick);
  undoButton.addEventListener("click", handleUndo);
  redoButton.addEventListener("click", handleRedo);
  resetButton.addEventListener("click", handleReset);
})();
