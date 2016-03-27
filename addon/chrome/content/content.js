/* eslint mozilla/balanced-listeners:0 */
"use strict";

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

// DocShellCapabilities exist since Firefox 27
XPCOMUtils.defineLazyModuleGetter(this, "DocShellCapabilities",
  "resource:///modules/sessionstore/DocShellCapabilities.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "BrowserUtils",
  "resource://gre/modules/BrowserUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
  "resource://gre/modules/NetUtil.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "LinkNodeUtils",
  "resource://tabmixplus/LinkNodeUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ContextMenu",
  "resource://tabmixplus/ContextMenu.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixUtils",
  "resource://tabmixplus/Utils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixAboutNewTab",
  "resource://tabmixplus/AboutNewTab.jsm");

var PROCESS_TYPE_CONTENT = TabmixSvc.version(380) &&
    Services.appinfo.processType == Services.appinfo.PROCESS_TYPE_CONTENT;

var TabmixClickEventHandler;
var TabmixContentHandler = {
  MESSAGES: [
    "Tabmix:restorePermissions",
    "Tabmix:collectPermissions",
    "Tabmix:resetContentName",
    "Tabmix:sendDOMTitleChanged",
    "Tabmix:updateHistoryTitle",
    "Tabmix:collectScrollPosition",
    "Tabmix:setScrollPosition",
    "Tabmix:collectReloadData",
    "Tabmix:isFrameInContent",
    "Tabmix:collectOpener",
  ],

  init: function() {
    this.MESSAGES.forEach(m => addMessageListener(m, this));

    if (PROCESS_TYPE_CONTENT) {
      addEventListener("drop", this.onDrop);
    }
  },

  receiveMessage: function({name, data}) {
    // The docShell might be gone. Don't process messages,
    // that will just lead to errors anyway.
    if (!docShell) {
      return;
    }
    switch (name) {
      case "Tabmix:restorePermissions": {
        let disallow = new Set(data.disallow && data.disallow.split(","));
        DocShellCapabilities.restore(docShell, disallow);
        sendSyncMessage("Tabmix:restorePermissionsComplete", {
          disallow: data.disallow,
          reload: data.reload
        });
        break;
      }
      case "Tabmix:collectPermissions": {
        let caps = DocShellCapabilities.collect(docShell).join(",");
        sendSyncMessage("Tabmix:collectPermissionsComplete", {caps: caps});
        break;
      }
      case "Tabmix:resetContentName": {
        if (content.name)
          content.name = "";
        break;
      }
      case "Tabmix:sendDOMTitleChanged": {
        // workaround for bug 1081891
        let title = content.document.title;
        if (title)
          sendAsyncMessage("DOMTitleChanged", {title: title});
        break;
      }
      case "Tabmix:updateHistoryTitle": {
        let history = docShell.QueryInterface(Ci.nsIWebNavigation).sessionHistory;
        TabmixUtils.updateHistoryTitle(history, data.title);
        break;
      }
      case "Tabmix:collectScrollPosition": {
        let scroll = {scrollX: content.scrollX,
                      scrollY: content.scrollY};
        sendAsyncMessage("Tabmix:updateScrollPosition", {scroll: scroll});
        break;
      }
      case "Tabmix:setScrollPosition": {
        let {x, y} = data;
        content.scrollTo(x, y);
        break;
      }
      case "Tabmix:collectReloadData": {
        let json = {scrollX: content.scrollX,
                    scrollY: content.scrollY,
                    postData: null};
        let sh = docShell.QueryInterface(Ci.nsIWebNavigation).sessionHistory
                         .QueryInterface(Ci.nsISHistoryInternal);
        if (sh) {
          let entry = sh.getEntryAtIndex(sh.index, false);
          let postData = entry.postData;
          // RemoteWebNavigation accepting postdata or headers only from Firefox 42.
          if (postData && TabmixSvc.version(420)) {
            postData = postData.clone();
            json.postData = NetUtil.readInputStreamToString(postData, postData.available());
            let referrer = entry.referrerURI;
            json.referrer = referrer ? referrer.spec : null;
          }
          json.isPostData = !!json.postData;
        }
        sendAsyncMessage("Tabmix:reloadTab", json);
        break;
      }
      case "Tabmix:isFrameInContent": {
        let result = LinkNodeUtils.isFrameInContent(content, data.href, data.name);
        sendAsyncMessage("Tabmix:isFrameInContentResult", {result: result});
        break;
      }
      case "Tabmix:collectOpener": {
        sendSyncMessage("Tabmix:getOpener", {}, {opener: content.opener});
        break;
      }
    }
  },

  getCapabilities: function() {
    return DocShellCapabilities.collect(docShell).join(",") || "";
  },

  onDrop: function(event) {
    let uri, name = { };
    let linkHandler = Cc["@mozilla.org/content/dropped-link-handler;1"].
    getService(Ci.nsIDroppedLinkHandler);
    try {
      // Pass true to prevent the dropping of javascript:/data: URIs
      uri = linkHandler.dropLink(event, name, true);
    } catch (ex) {
      return;
    }
    let data = {
      json: {
        dataTransfer: {dropEffect: event.dataTransfer.dropEffect},
        ctrlKey: event.ctrlKey, metaKey: event.metaKey,
        shiftKey: event.shiftKey, altKey: event.altKey
      },
      uri: uri, name: name.value
    };
    let result = sendSyncMessage("Tabmix:contentDrop", data);
    if (result[0]) {
      event.stopPropagation();
      event.preventDefault();
    }
  }
};

TabmixClickEventHandler = {
  init: function init(global) {
    if (PROCESS_TYPE_CONTENT) {
      global.addEventListener("click", this, true);
    }
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
    if (!ownerDoc || /^about:[certerror|blocked|neterror]/.test(ownerDoc.documentURI))
      return;

    let [href, node, principal] = this._hrefAndLinkNodeForClickEvent(event);

    // get referrer attribute from clicked link and parse it
    // if per element referrer is enabled, the element referrer overrules
    // the document wide referrer
    let referrerPolicy = TabmixSvc.version(380) ? ownerDoc.referrerPolicy : null;
    if (TabmixSvc.version(420) &&
        Services.prefs.getBoolPref("network.http.enablePerElementReferrer") &&
        node) {
      let referrerAttrValue = Services.netUtils.parseAttributePolicyString(node.
          getAttribute(TabmixSvc.version(450) ? "referrerpolicy" : "referrer"));
      if (referrerAttrValue !== Ci.nsIHttpChannel.REFERRER_POLICY_DEFAULT) {
        referrerPolicy = referrerAttrValue;
      }
    }

    let json = {button: event.button, shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey, metaKey: event.metaKey,
                altKey: event.altKey, href: null, title: null,
                bookmark: false, referrerPolicy: referrerPolicy};

    if (typeof event.tabmix_openLinkWithHistory == "boolean")
      json.tabmix_openLinkWithHistory = true;

    // see getHrefFromNodeOnClick in tabmix's ContentClick.jsm
    // for the case there is no href
    let linkNode = href ? node : LinkNodeUtils.getNodeWithOnClick(event.target);
    if (linkNode)
      linkNode = LinkNodeUtils.wrap(linkNode, this._focusedWindow,
                                         href && event.button === 0);

    let result = sendSyncMessage("TabmixContent:Click",
                    {json: json, href: href, node: linkNode});
    let data = result[0];
    if (data.where == "default")
      return;

    // prevent Firefox default action
    event.stopPropagation();
    event.preventDefault();

    if (data.where == "handled")
      return;

    json.tabmixContentClick = data;
    href = data._href;

    if (href) {
      if (TabmixSvc.version(410)) {
        try {
          BrowserUtils.urlSecurityCheck(href, principal);
        } catch (e) {
          return;
        }
      }

      json.href = href;
      if (node) {
        json.title = node.getAttribute("title");
        if (event.button === 0 && !event.ctrlKey && !event.shiftKey &&
            !event.altKey && !event.metaKey) {
          json.bookmark = node.getAttribute("rel") == "sidebar";
          if (json.bookmark) {
            event.preventDefault(); // Need to prevent the pageload.
          }
        }
      }
      json.noReferrer = TabmixSvc.version(370) && BrowserUtils.linkHasNoReferrer(node);

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
   * @return [href, linkNode, linkPrincipal].
   *
   * @note linkNode will be null if the click wasn't on an anchor
   *       element. This includes SVG links, because callers expect |node|
   *       to behave like an <a> element, which SVG links (XLink) don't.
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
      return [node.href, node, node.ownerDocument.nodePrincipal];

    // If there is no linkNode, try simple XLink.
    let href, baseURI;
    node = event.target;
    while (node && !href) {
      if (node.nodeType == content.Node.ELEMENT_NODE &&
          (node.localName == "a" ||
           node.namespaceURI == "http://www.w3.org/1998/Math/MathML")) {
        href = node.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (href) {
          baseURI = node.ownerDocument.baseURIObject;
          break;
        }
      }
      node = node.parentNode;
    }

    // In case of XLink, we don't return the node we got href from since
    // callers expect <a>-like elements.
    // Note: makeURI() will throw if aUri is not a valid URI.
    return [href ? BrowserUtils.makeURI(href, null, baseURI).spec : null, null,
            node && node.ownerDocument.nodePrincipal];
  },

  get _focusedWindow() {
    let fm = Cc["@mozilla.org/focus-manager;1"].getService(Ci.nsIFocusManager);

    let focusedWindow = {};
    fm.getFocusedElementForWindow(content, true, focusedWindow);
    return focusedWindow.value;
  }
};

var AboutNewTabHandler = {
  init: function(global) {
    if (!TabmixSvc.version(420)) {
      return;
    }

    addMessageListener("Tabmix:updateTitlefrombookmark", this);

    let contentLoaded = false;
    global.addEventListener("pageshow", event => {
      if (event.target != content.document) {
        return;
      }
      let doc = content.document;
      // we don't need to update titles on first show if the pref is off
      if (doc.documentURI.toLowerCase() == TabmixSvc.aboutNewtab &&
          (contentLoaded || TabmixSvc.prefBranch.getBoolPref("titlefrombookmark"))) {
        contentLoaded = true;
        this.updateTitles();
      }
    });
  },

  receiveMessage: function({name}) {
    if (name == "Tabmix:updateTitlefrombookmark") {
      this.updateTitles();
    }
  },

  updateTitles: function() {
    if (content && content.gGrid) {
      TabmixAboutNewTab.updateTitles(content.gGrid.cells);
    }
  }
};

var ContextMenuHandler = {
  init: function(global) {
    Cc["@mozilla.org/eventlistenerservice;1"]
      .getService(Ci.nsIEventListenerService)
      .addSystemEventListener(global, "contextmenu", this.prepareContextMenu, true);
  },

  prepareContextMenu: function(event) {
    if (event.defaultPrevented) {
      return;
    }

    let links;
    if (TabmixSvc.prefBranch.getBoolPref("openAllLinks")) {
      links = ContextMenu.getSelectedLinks(content).join("\n");
    }

    sendRpcMessage("Tabmix:contextmenu", {links: links});
  }
};

TabmixContentHandler.init();
TabmixClickEventHandler.init(this);
AboutNewTabHandler.init(this);
ContextMenuHandler.init(this);
