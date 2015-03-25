"use strict";

var EXPORTED_SYMBOLS = ["LinkNodeUtils"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");

const attribs = ["onclick", "rel", "onmousedown"];

this.LinkNodeUtils = {
  isFrameInContent: function(content, href, name) {
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

  wrap: function(node, focusedWindow, getTargetIsFrame) {
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
        defaultView: {
          frameElement: !!doc.defaultView.frameElement
        },
        location: {
          href: doc.location ? doc.location.href : ""
        }
      },
      parentNode: {
        baseURI: node.parentNode.baseURI,
        _attributes: getAttributes(node.parentNode, ["onclick"])
      },
      _focusedWindowHref: focusedWindow.top.location.href,
      _attributes: getAttributes(node, attribs)
    };
    if (getTargetIsFrame)
      wrapper.targetIsFrame = targetIsFrame(wrapper.target, focusedWindow);
    return wrapper;
  },

  getNodeWithOnClick: function(node) {
    // for safety reason look only 3 level up
    let i = 0;
    while (i < 3 && node && node.hasAttribute && !node.hasAttribute("onclick")) {
      node = node.parentNode;
      i++;
    }
    if (node && node.hasAttribute && node.hasAttribute("onclick"))
      return node;
    return null;
  }
};

function getAttributes(node, attribs) {
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
 * @brief check if traget attribute exist and point to frame in the document
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
