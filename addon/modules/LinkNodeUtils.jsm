"use strict";

this.EXPORTED_SYMBOLS = ["LinkNodeUtils"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

const ATTRIBS = ["href", "onclick", "onmousedown", "rel", "role"];

this.LinkNodeUtils = {
  isFrameInContent(content, href, name) {
    if (!content)
      return false;
    if (content.location.href == href && content.name == name)
      return true;
    for (let i = 0; i < content.frames.length; i++) {
      let frame = content.frames[i];
      if (frame.location.href == href && frame.name == name)
        return true;
    }
    return false;
  },

  wrap(node, focusedWindow, getTargetIsFrame) {
    if (!node || typeof node.__tabmix == "boolean")
      return node;

    let doc = node.ownerDocument;
    let wrapper = {
      __tabmix: true,
      baseURI: node.baseURI,
      host: node.host,
      pathname: node.pathname,
      className: node.className,
      target: getTargetAttr(node.target, focusedWindow),
      ownerDocument: {
        URL: doc.URL,
        documentURI: doc.documentURI,
        defaultView: {frameElement: Boolean(doc.defaultView.frameElement)},
        location: {href: doc.location ? doc.location.href : ""}
      },
      parentNode: {
        baseURI: node.parentNode ? node.parentNode.baseURI : '',
        _attributes: getAttributes(node.parentNode, ["onclick"])
      },
      _focusedWindowHref: focusedWindow.top.location.href,
      _attributes: getAttributes(node, ATTRIBS)
    };
    if (getTargetIsFrame)
      wrapper.targetIsFrame = targetIsFrame(wrapper.target, focusedWindow);
    return wrapper;
  },

  getNodeWithOnClick(node) {
    // for safety reason look only 3 level up
    let i = 0;
    while (i < 3 && node && node.hasAttribute && !node.hasAttribute("onclick")) {
      node = node.parentNode;
      i++;
    }
    if (node && node.hasAttribute && node.hasAttribute("onclick"))
      return node;
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
      if (!blocked && /youtube.com/.test(currentHref) &&
          (!this.isGMEnabled(window) || decodeURI(href).indexOf("return false;") == -1)) {
        blocked = true;
      // amazon.com search - added 2019-04-09
      } else if (!blocked && /amazon\.com\/s\?/.test(currentHref)) {
        blocked = true;
      } else if (!blocked) {
        // make sure external links in developer.mozilla.org open new tab
        let uri = Services.io.newURI(currentHref);
        let host = uri && uri.host;
        blocked = host == "developer.mozilla.org" && linkNode.host != host &&
            linkNode.classList.contains("external");
      }
    } catch (ex) {
      blocked = false;
    }
    return blocked;
  },

  _GM_function: new WeakMap(),

  isGMEnabled(window) {
    window = window || Services.wm.getMostRecentWindow("navigator:browser");
    if (this._GM_function.has(window)) {
      return this._GM_function.get(window)();
    }
    return false;
  },
};

function getAttributes(node, attribs) {
  if (!node) {
    return {};
  }
  let wrapper = {};
  for (let att of attribs) {
    if (node.hasAttribute(att)) {
      wrapper[att] = node.getAttribute(att);
    }
  }
  return wrapper;
}

function getTargetAttr(targetAttr, focusedWindow) {
  // If link has no target attribute, check if there is a <base> with a target attribute
  if (!targetAttr) {
    let b = focusedWindow.document.getElementsByTagName("base");
    if (b.length > 0)
      targetAttr = b[0].getAttribute("target");
  }
  return targetAttr;
}

/**
 * @brief check if target attribute exist and point to frame in the document
 *        frame pool
 */
function targetIsFrame(targetAttr, focusedWindow) {
  if (targetAttr) {
    let content = focusedWindow.top;
    if (existsFrameName(content, targetAttr))
      return true;
  }
  return false;
}

/**
 * @brief Check a document's frame pool and determine if
 * |targetFrame| is located inside of it.
 *
 * @param content           is a frame reference
 * @param targetFrame       The name of the frame that we are seeking.
 * @returns                 true if the frame exists within the given frame pool,
 *                          false if it does not.
 */
function existsFrameName(content, targetFrame) {
  for (let i = 0; i < content.frames.length; i++) {
    let frame = content.frames[i];
    if (frame.name == targetFrame || existsFrameName(frame, targetFrame))
      return true;
  }
  return false;
}
