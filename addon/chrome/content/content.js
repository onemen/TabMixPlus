"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

// DocShellCapabilities exist since Firefox 27
XPCOMUtils.defineLazyModuleGetter(this, "DocShellCapabilities",
  "resource:///modules/sessionstore/DocShellCapabilities.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");

let global = this;

let TabmixPermissionsListener = {
  MESSAGES: [
    "Tabmix:restorePermissions",
    "Tabmix:collectPermissions",
  ],

  init: function () {
    this.MESSAGES.forEach(m => addMessageListener(m, this));

    // Send a CPOW to the parent so that it can synchronously request
    // docShell capabilities.
    sendSyncMessage("Tabmix:SetSyncHandler", {}, {syncHandler: this});
  },

  receiveMessage: function ({name, data}) {
    switch (name) {
      case "Tabmix:restorePermissions":
        let disallow = new Set(data.disallow && data.disallow.split(","));
        DocShellCapabilities.restore(docShell, disallow);
        sendSyncMessage("Tabmix:restoPermissionsComplete", {
          disallow: data.disallow,
          reload: data.reload
        });
      break;
      case "Tabmix:collectPermissions":
      let caps = DocShellCapabilities.collect(docShell).join(",");
      sendSyncMessage("Tabmix:collectPermissionsComplete", {caps: caps});
      break;
    }
  },

  getCapabilities: function() {
    return DocShellCapabilities.collect(docShell).join(",") || "";
  }
};

let TabmixClickEventHandler = {
  init: function init() {
    global.addEventListener("click", this, true);
  },

  handleEvent: function(event) {
    switch (event.type) {
    case "click":
      this.contentAreaClick(event);
      break;
    }
  },

  contentAreaClick: function(event) {
    if (!event.isTrusted || event.defaultPrevented || event.button == 2 ||
        event.tabmix_isRemote === false) {
      return;
    }

    let originalTarget = event.originalTarget;
    let ownerDoc = originalTarget.ownerDocument;

    // let Firefox code handle click events from about pages
    if (/^about:[certerror|blocked|neterror]/.test(ownerDoc.documentURI))
      return;

    let [href, node] = this._hrefAndLinkNodeForClickEvent(event);
    if (!node)
      return;

    let json = { button: event.button, shiftKey: event.shiftKey,
                 ctrlKey: event.ctrlKey, metaKey: event.metaKey,
                 altKey: event.altKey, href: null, title: null,
                 bookmark: false };

    if (typeof event.tabmix_openLinkWithHistory == "boolean")
      json.tabmix_openLinkWithHistory = true;

    let result = sendSyncMessage("TabmixContent:Click",
                    {json: json, href: href},
                    {node: node, focusedWindow: this._getFocusedWindow()});
    let data = result[0];
    if (data.where == "default")
      return;

    // prevent Firefox default action
    event.stopPropagation();
    event.preventDefault();

    json.tabmix = data;
    href = data._href;

    if (href) {
      json.href = href;
      if (node) {
        json.title = node.getAttribute("title");
        if (event.button == 0 && !event.ctrlKey && !event.shiftKey &&
            !event.altKey && !event.metaKey) {
          json.bookmark = node.getAttribute("rel") == "sidebar";
          if (json.bookmark) {
            event.preventDefault(); // Need to prevent the pageload.
          }
        }
      }

      sendAsyncMessage("Content:Click", json);
      return;
    }

    // This might be middle mouse navigation.
    if (event.button == 1) {
      sendAsyncMessage("Content:Click", json);
    }
  },

  /**
   * Extracts linkNode and href for the current click target.
   *
   * @param event
   *        The click event.
   * @return [href, linkNode].
   *
   * @note linkNode will be null if the click wasn't on an anchor
   *       element (or XLink).
   */
  _hrefAndLinkNodeForClickEvent: function(event) {
    function isHTMLLink(aNode) {
      // Be consistent with what nsContextMenu.js does.
      return ((aNode instanceof content.HTMLAnchorElement && aNode.href) ||
              (aNode instanceof content.HTMLAreaElement && aNode.href) ||
              aNode instanceof content.HTMLLinkElement);
    }

    let node = event.target;
    while (node && !isHTMLLink(node)) {
      node = node.parentNode;
    }

    if (node)
      return [node.href, node];

    // If there is no linkNode, try simple XLink.
    let href, baseURI;
    node = event.target;
    while (node && !href) {
      if (node.nodeType == content.Node.ELEMENT_NODE) {
        href = node.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (href)
          baseURI = node.ownerDocument.baseURIObject;
      }
      node = node.parentNode;
    }

    // In case of XLink, we don't return the node we got href from since
    // callers expect <a>-like elements.
    // Note: makeURI() will throw if aUri is not a valid URI.
    return [href ? makeURI(href, null, baseURI).spec : null, null];
  },

  _getFocusedWindow: function() {
    let fm = Cc["@mozilla.org/focus-manager;1"].getService(Ci.nsIFocusManager);

    let focusedWindow = {};
    let elt = fm.getFocusedElementForWindow(content, true, focusedWindow);
    return focusedWindow.value;
  }
};

TabmixPermissionsListener.init();
TabmixClickEventHandler.init();
