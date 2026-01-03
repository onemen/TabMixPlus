const ATTRIBS = ["href", "onclick", "onmousedown", "rel", "role"];

/** @type {LinkNodeUtilsModule.LinkNodeUtils} */
export const LinkNodeUtils = {
  isFrameInContent(content, href, name) {
    if (!content) {
      return false;
    }

    if (content.location.href == href && content.name == name) {
      return true;
    }

    for (let i = 0; i < content.frames.length; i++) {
      let frame = content.frames[i];
      if (frame.location.href == href && frame.name == name) {
        return true;
      }
    }
    return false;
  },

  wrap(node, focusedWindow, getTargetIsFrame) {
    if (!node || typeof node.__tabmix == "boolean") {
      return node;
    }

    let doc = node.ownerDocument;
    let frameElement = Boolean(node.ownerGlobal.frameElement);

    /** @type {LinkNodeUtilsModule.WrappedNode} */
    let wrapper = {
      __tabmix: true,
      baseURI: node.baseURI || "",
      host: node.host,
      pathname: node.pathname,
      className: node.className,
      target: getTargetAttr(node.target, focusedWindow),
      ownerGlobal: {frameElement},
      ownerDocument: {
        URL: doc.URL,
        documentURI: doc.documentURI,
        defaultView: {frameElement},
        location: {href: doc.location ? doc.location.href : ""},
      },
      parentNode: {
        baseURI: node.parentNode?.baseURI ?? "",
        _attributes: getAttributes(node.parentNode, ["onclick"]),
      },
      _focusedWindowHref: focusedWindow.top?.location.href || "",
      _attributes: getAttributes(node, ATTRIBS),
    };
    if (getTargetIsFrame) {
      wrapper.targetIsFrame = targetIsFrame(wrapper.target, focusedWindow);
    }
    return wrapper;
  },

  getNodeWithOnClick(node) {
    let i = 0;
    let current = node;
    while (i < 3 && current && current.hasAttribute && !current.hasAttribute("onclick")) {
      const parent = current.parentElement;
      if (!parent) break;
      current = parent;
      i++;
    }
    if (current?.hasAttribute?.("onclick")) {
      return current;
    }
    return null;
  },

  // catch link in special pages
  isSpecialPage(href, linkNode, currentHref, window) {
    let blocked;
    try {
      // for the moment just do it for Google and Yahoo....
      // tvguide.com    - added 2013-07-20
      // duckduckgo.com - added 2014-12-24
      // jetbrains.com - added 2016-05-01
      let re = /duckduckgo.com|tvguide.com|google|yahoo.com|jetbrains.com|github.io|github.com/;
      blocked = re.test(currentHref);
      // youtube.com - added 2013-11-15
      if (
        !blocked &&
        /youtube.com/.test(currentHref) &&
        (!this.isGMEnabled(window) || !decodeURI(href || "").includes("return false;"))
      ) {
        blocked = true;
        // amazon.com search - added 2019-04-09
      } else if (!blocked && /amazon\.com\/s\?/.test(currentHref)) {
        blocked = true;
      } else if (!blocked) {
        // make sure external links in developer.mozilla.org open new tab
        let uri = Services.io.newURI(currentHref);
        let host = uri && uri.host;
        blocked = Boolean(
          host === "developer.mozilla.org" &&
          linkNode &&
          linkNode.host != host &&
          linkNode.classList.contains("external")
        );
      }
    } catch {
      blocked = false;
    }
    return blocked;
  },

  _GM_function: new WeakMap(),

  isGMEnabled(window) {
    window = window || Services.wm.getMostRecentWindow("navigator:browser");
    const fn = this._GM_function.get(window);
    return fn ? fn() : false;
  },
};

/**
 * @param {Element | null} node
 * @param {string[]} attribs
 */
function getAttributes(node, attribs) {
  if (!node) {
    return {};
  }

  /** @type {Record<string, string>} */
  const wrapper = {};
  for (let att of attribs) {
    if (node.hasAttribute(att)) {
      wrapper[att] = node.getAttribute(att) || "";
    }
  }
  return wrapper;
}

/** @type {(targetAttr: string, focusedWindow: Window) => string} */
function getTargetAttr(targetAttr, focusedWindow) {
  if (!targetAttr) {
    const bases = focusedWindow.document.getElementsByTagName("base");
    if (bases.length) {
      targetAttr = bases[0].getAttribute("target") || "";
    }
  }
  return targetAttr || "";
}

/**
 * check if target attribute exist and point to frame in the document frame pool
 *
 * @type {(targetAttr: string | null, focusedWindow: Window) => boolean}
 */
function targetIsFrame(targetAttr, focusedWindow) {
  if (targetAttr) {
    const content = focusedWindow.top;
    if (content && existsFrameName(content, targetAttr)) {
      return true;
    }
  }
  return false;
}

/**
 * Check a document's frame pool and determine if
 *
 * |targetFrame| is located inside of it.
 *
 * @type {(content: Window, targetFrame: string) => boolean}
 * @param {Window} content is a frame reference
 * @param {string} targetFrame The name of the frame that we are seeking.
 * @returns {boolean} true if the frame exists within the given frame pool,
 *   false if it does not.
 */
function existsFrameName(content, targetFrame) {
  for (let i = 0; i < content.frames.length; i++) {
    let frame = content.frames[i];
    // Might throw with SecurityError: Permission denied to access property
    // "name" on cross-origin object.
    try {
      if (frame.name == targetFrame || existsFrameName(frame, targetFrame)) {
        return true;
      }
    } catch {}
  }
  return false;
}
