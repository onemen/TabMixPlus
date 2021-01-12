/* globals content, docShell, addMessageListener, sendSyncMessage,
           sendAsyncMessage, sendRpcMessage */
"use strict";

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/Services.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "AppConstants",
  "resource://gre/modules/AppConstants.jsm");

// DocShellCapabilities exist since Firefox 27
XPCOMUtils.defineLazyModuleGetter(this, "DocShellCapabilities",
  "resource:///modules/sessionstore/DocShellCapabilities.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "BrowserUtils",
  "resource://gre/modules/BrowserUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
  "resource://gre/modules/NetUtil.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ContentSvc",
  "resource://tabmixplus/ContentSvc.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "LinkNodeUtils",
  "resource://tabmixplus/LinkNodeUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ContextMenu",
  "resource://tabmixplus/ContextMenu.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixUtils",
  "resource://tabmixplus/Utils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixAboutNewTab",
  "resource://tabmixplus/AboutNewTab.jsm");

var PROCESS_TYPE_CONTENT = ContentSvc.version(380) &&
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

  init() {
    this.MESSAGES.forEach(m => addMessageListener(m, this));

    if (PROCESS_TYPE_CONTENT) {
      addEventListener("drop", this.onDrop);
    }
  },

  receiveMessage({name, data}) {
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
        sendSyncMessage("Tabmix:collectPermissionsComplete", {caps});
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
          sendAsyncMessage("DOMTitleChanged", {title});
        break;
      }
      case "Tabmix:updateHistoryTitle": {
        let history = docShell.QueryInterface(Ci.nsIWebNavigation).sessionHistory;
        TabmixUtils.updateHistoryTitle(history, data.title);
        break;
      }
      case "Tabmix:collectScrollPosition": {
        let scroll = {
          scrollX: content.scrollX,
          scrollY: content.scrollY
        };
        sendAsyncMessage("Tabmix:updateScrollPosition", {scroll});
        break;
      }
      case "Tabmix:setScrollPosition": {
        content.scrollTo(data.x, data.y);
        break;
      }
      case "Tabmix:collectReloadData": {
        let json = {
          scrollX: content.scrollX,
          scrollY: content.scrollY,
          postData: null
        };
        let sh = docShell.QueryInterface(Ci.nsIWebNavigation).sessionHistory
            .QueryInterface(Ci.nsISHistoryInternal);
        if (sh) {
          let entry = sh.getEntryAtIndex(sh.index, false);
          let postData = entry.postData;
          // RemoteWebNavigation accepting postdata or headers only from Firefox 42.
          if (postData && ContentSvc.version(420)) {
            postData = postData.clone();
            json.postData = NetUtil.readInputStreamToString(postData, postData.available());
            let referrer = entry.referrerURI;
            json.referrer = referrer ? referrer.spec : null;
          }
          json.isPostData = Boolean(json.postData);
        }
        sendAsyncMessage("Tabmix:reloadTab", json);
        break;
      }
      case "Tabmix:isFrameInContent": {
        let result = LinkNodeUtils.isFrameInContent(content, data.href, data.name);
        sendAsyncMessage("Tabmix:isFrameInContentResult", {result, epoch: data.epoch});
        break;
      }
      case "Tabmix:collectOpener": {
        sendSyncMessage("Tabmix:getOpener", {}, {opener: content.opener});
        break;
      }
    }
  },

  getCapabilities() {
    return DocShellCapabilities.collect(docShell).join(",") || "";
  },

  onDrop(event) {
    let links;
    const linkName = { };
    const linkHandler = Cc["@mozilla.org/content/dropped-link-handler;1"]
        .getService(Ci.nsIDroppedLinkHandler);
    try {
      // Pass true to prevent the dropping of javascript:/data: URIs
      if (ContentSvc.version(520)) {
        links = linkHandler.dropLinks(event, true);
        // we can not send a message with array of wrapped nsIDroppedLinkItem
        links = links.map(link => {
          const {url, name, type} = link;
          return {url, name, type};
        });
      } else {
        links = [{url: linkHandler.dropLink(event, linkName, true)}];
      }
    } catch (ex) {
      return;
    }
    let data = {
      json: {
        dataTransfer: {dropEffect: event.dataTransfer.dropEffect},
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey
      },
      links,
      name: linkName.value
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
    if (ContentSvc.version(380)) {
      global.addEventListener("click", event => {
        let linkData = this.getLinkData(event);
        if (linkData) {
          let [href, node] = linkData;
          let currentHref = event.originalTarget.ownerDocument.documentURI;
          const divertMiddleClick = event.button == 1 && ContentSvc.prefBranch.getBoolPref("middlecurrent");
          const ctrlKey = AppConstants.platform == "macosx" ? event.metaKey : event.ctrlKey;
          if (divertMiddleClick || ctrlKey ||
              LinkNodeUtils.isSpecialPage(href, node, currentHref)) {
            this.contentAreaClick(event, linkData);
          }
        }
      }, true);
      Cc["@mozilla.org/eventlistenerservice;1"]
          .getService(Ci.nsIEventListenerService)
          .addSystemEventListener(global, "click", this, true);
    }
  },

  handleEvent(event) {
    switch (event.type) {
      case "click":
        this.contentAreaClick(event, this.getLinkData(event));
        break;
    }
  },

  getLinkData(event) {
    // tabmix_isMultiProcessBrowser is undefined for remote browser when
    // window.gMultiProcessBrowser is true
    if (!event.isTrusted || event.defaultPrevented || event.button == 2 ||
        event.tabmix_isMultiProcessBrowser === false) {
      return null;
    }

    let ownerDoc = event.originalTarget.ownerDocument;

    // let Firefox code handle click events from about pages
    if (!ownerDoc || (!ContentSvc.version(570) || event.button == 0) &&
        /^about:(certerror|blocked|neterror)$/.test(ownerDoc.documentURI)) {
      return null;
    }

    return this._hrefAndLinkNodeForClickEvent(event);
  },

  contentAreaClick(event, linkData) {
    if (!linkData) {
      return;
    }

    let [href, node, principal] = linkData;
    let ownerDoc = event.originalTarget.ownerDocument;

    // first get document wide referrer policy, then
    // get referrer attribute from clicked link and parse it and
    // allow per element referrer to overrule the document wide referrer if enabled
    let referrerPolicy = ContentSvc.version(380) ? ownerDoc.referrerPolicy : null;
    let setReferrerPolicy = node && (ContentSvc.version(550) ||
      ContentSvc.version(420) &&
      Services.prefs.getBoolPref("network.http.enablePerElementReferrer"));
    if (setReferrerPolicy) {
      let value = node.getAttribute(ContentSvc.version(450) ? "referrerpolicy" : "referrer");
      let referrerAttrValue = Services.netUtils.parseAttributePolicyString(value);
      let policy = ContentSvc.version(490) ? "REFERRER_POLICY_UNSET" : "REFERRER_POLICY_DEFAULT";
      if (referrerAttrValue !== Ci.nsIHttpChannel[policy]) {
        referrerPolicy = referrerAttrValue;
      }
    }

    let frameOuterWindowID;
    if (ContentSvc.version(540)) {
      frameOuterWindowID = ownerDoc.defaultView.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindowUtils)
          .outerWindowID;
    }

    let json = {
      button: event.button,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      href: null,
      title: null,
      bookmark: false,
      referrerPolicy,
      frameOuterWindowID,
      triggeringPrincipal: principal,
      originAttributes: principal ? principal.originAttributes : {},
      isContentWindowPrivate: ContentSvc.version(510) && PrivateBrowsingUtils.isContentWindowPrivate(ownerDoc.defaultView),
    };

    if (typeof event.tabmix_openLinkWithHistory == "boolean")
      json.tabmix_openLinkWithHistory = true;

    // see getHrefFromNodeOnClick in tabmix's ContentClick.jsm
    // for the case there is no href
    let linkNode = href ? node : LinkNodeUtils.getNodeWithOnClick(event.target);
    if (linkNode) {
      if (!href) {
        json.originPrincipal = ownerDoc.nodePrincipal;
        json.triggeringPrincipal = ownerDoc.nodePrincipal;
      }
      linkNode = LinkNodeUtils.wrap(linkNode, TabmixUtils.focusedWindow(content),
        href && event.button === 0);
    }

    let result = sendSyncMessage("TabmixContent:Click",
      {json, href, node: linkNode});
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
      if (ContentSvc.version(410)) {
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
      json.noReferrer = ContentSvc.version(370) && BrowserUtils.linkHasNoReferrer(node);

      if (ContentSvc.version(480)) {
        // Check if the link needs to be opened with mixed content allowed.
        // Only when the owner doc has |mixedContentChannel| and the same origin
        // should we allow mixed content.
        json.allowMixedContent = false;
        let docshell = ownerDoc.defaultView.QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIWebNavigation)
            .QueryInterface(Ci.nsIDocShell);
        if (docShell.mixedContentChannel) {
          const sm = Services.scriptSecurityManager;
          try {
            let targetURI = BrowserUtils.makeURI(href);
            sm.checkSameOriginURI(docshell.mixedContentChannel.URI, targetURI, false);
            json.allowMixedContent = true;
          } catch (ex) {
          }
        }
      }
      json.originPrincipal = ownerDoc.nodePrincipal;
      json.triggeringPrincipal = ownerDoc.nodePrincipal;

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
  _hrefAndLinkNodeForClickEvent(event) {
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
        href = ContentSvc.version(510) && node.getAttribute("href") ||
            node.getAttributeNS("http://www.w3.org/1999/xlink", "href");
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
};

var AboutNewTabHandler = {
  init(global) {
    Cu.import("resource://gre/modules/Services.jsm", this);
    if (!ContentSvc.version(420)) {
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
      if (doc.documentURI.toLowerCase() == ContentSvc.aboutNewtab &&
          (contentLoaded || ContentSvc.prefBranch.getBoolPref("titlefrombookmark"))) {
        contentLoaded = true;
        this.updateTitles();
      }
    });
  },

  receiveMessage({name}) {
    if (name == "Tabmix:updateTitlefrombookmark") {
      this.updateTitles();
    }
  },

  updateTitles() {
    if (content && content.gGrid) {
      TabmixAboutNewTab.updateTitles(content.gGrid.cells);
    }
  }
};

var ContextMenuHandler = {
  init(global) {
    Cc["@mozilla.org/eventlistenerservice;1"]
        .getService(Ci.nsIEventListenerService)
        .addSystemEventListener(global, "contextmenu", this.prepareContextMenu, true);
  },

  prepareContextMenu(event) {
    if (event.defaultPrevented) {
      return;
    }

    let links;
    if (ContentSvc.prefBranch.getBoolPref("openAllLinks")) {
      links = ContextMenu.getSelectedLinks(content).join("\n");
    }

    sendRpcMessage("Tabmix:contextmenu", {links});
  }
};

const AMO = new RegExp("https://addons.mozilla.org/.+/firefox/addon/tab-mix-plus/");
const BITBUCKET = "https://bitbucket.org/onemen/tabmixplus/issues?status=new&status=open";

var TabmixPageHandler = {
  init(global) {
    global.addEventListener("DOMContentLoaded", this);
  },

  handleEvent(event) {
    const doc = content.document;
    if (event.target != doc) {
      return;
    }

    let uri = doc.documentURI.toLowerCase();
    if (AMO.exec(uri)) {
      if (event.type == "DOMContentLoaded") {
        this.count = 0;
        content.addEventListener("pageshow", this);
        this.createAMOButton();
      }
      this.moveAMOButton(event.type);
    } else if (uri == BITBUCKET) {
      this.styleBitbucket();
    }
  },

  buttonID: "tabmixplus-bug-report",
  createAMOButton() {
    const doc = content.document;
    const email = doc.querySelector('ul>li>.email[href="mailto:tabmix.onemen@gmail.com"]');
    if (email && !doc.getElementById(this.buttonID)) {
      const bugReport = doc.createElement("a");
      bugReport.href = BITBUCKET;
      bugReport.textContent = ContentSvc.getString("bugReport.label");
      bugReport.id = this.buttonID;
      bugReport.className = "button";
      bugReport.target = "_blank";
      bugReport.style.marginBottom = "4px";
      let ul = email.parentNode.parentNode;
      ul.parentNode.insertBefore(bugReport, ul);
    }
  },

  count: 0,
  moveAMOButton(eventType) {
    const doc = content.document;
    // add-review is null on DOMContentLoaded
    const addReview = doc.getElementById("add-review");
    if (eventType != "pageshow" && !addReview && this.count++ < 10) {
      this._timeoutID = setTimeout(() => {
        // make sure content exist after timeout
        if (content) {
          this.moveAMOButton("timeout");
        }
      }, 250);
      return;
    }
    if (eventType == "pageshow" || addReview) {
      content.removeEventListener("pageshow", this);
    }
    if (addReview && this._timeoutID) {
      clearTimeout(this._timeoutID);
      this._timeoutID = null;
    }
    let button = doc.getElementById(this.buttonID);
    if (addReview && button) {
      addReview.parentNode.insertBefore(button, addReview);
    }
  },

  styleBitbucket() {
    let createIssue = content.document.getElementById("create-issue-contextual");
    if (createIssue) {
      createIssue.classList.remove("aui-button-subtle");
      createIssue.classList.add("aui-button-primary");
    }
  },
};

TabmixContentHandler.init();
TabmixClickEventHandler.init(this);
AboutNewTabHandler.init(this);
ContextMenuHandler.init(this);
TabmixPageHandler.init(this);
