/* globals content, docShell, addMessageListener, sendSyncMessage,
           sendAsyncMessage */
"use strict";

var {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/Services.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "AppConstants",
  "resource://gre/modules/AppConstants.jsm");

// DocShellCapabilities exist since Firefox 27
XPCOMUtils.defineLazyModuleGetter(this, "DocShellCapabilities",
  "resource:///modules/sessionstore/DocShellCapabilities.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "WebNavigationFrames",
  "resource://gre/modules/WebNavigationFrames.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "E10SUtils",
  "resource://gre/modules/E10SUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
  "resource://gre/modules/NetUtil.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ContentSvc",
  "chrome://tabmix-resource/content/ContentSvc.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "LinkNodeUtils",
  "chrome://tabmix-resource/content/LinkNodeUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ContextMenu",
  "chrome://tabmix-resource/content/ContextMenu.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixUtils",
  "chrome://tabmix-resource/content/Utils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixAboutNewTab",
  "chrome://tabmix-resource/content/AboutNewTab.jsm");

var PROCESS_TYPE_CONTENT = Services.appinfo.processType == Services.appinfo.PROCESS_TYPE_CONTENT;

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
        const sessionHistoryEntry = docShell
            .QueryInterface(Ci.nsIWebPageDescriptor)
            .currentDescriptor.QueryInterface(Ci.nsISHEntry);
        if (sessionHistoryEntry) {
          let postData = sessionHistoryEntry.postData;
          if (postData) {
            postData = postData.clone();
            json.postData = NetUtil.readInputStreamToString(postData, postData.available());
            json.referrerInfo = E10SUtils.serializeReferrerInfo(sessionHistoryEntry.referrerInfo);
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
      links = linkHandler.dropLinks(event, true);
      // we can not send a message with array of wrapped nsIDroppedLinkItem
      links = links.map(link => {
        const {url, name, type} = link;
        return {url, name, type};
      });
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
    Services.els.addSystemEventListener(global, "click", this, true);
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
    if (!ownerDoc || event.button == 0 &&
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

    let csp = ownerDoc.csp;
    if (csp) {
      csp = E10SUtils.serializeCSP(csp);
    }

    let referrerInfo = Cc["@mozilla.org/referrer-info;1"].createInstance(
      Ci.nsIReferrerInfo
    );
    if (node) {
      referrerInfo.initWithElement(node);
    } else {
      referrerInfo.initWithDocument(ownerDoc);
    }

    referrerInfo = E10SUtils.serializeReferrerInfo(referrerInfo);
    let frameID = WebNavigationFrames.getFrameId(ownerDoc.defaultView);

    let json = {
      button: event.button,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      href: null,
      title: null,
      frameID,
      triggeringPrincipal: principal,
      csp,
      referrerInfo,
      originAttributes: principal ? principal.originAttributes : {},
      isContentWindowPrivate: PrivateBrowsingUtils.isContentWindowPrivate(
        ownerDoc.defaultView
      ),
    };

    if (typeof event.tabmix_openLinkWithHistory == "boolean")
      json.tabmix_openLinkWithHistory = true;

    // see getHrefFromNodeOnClick in tabmix's ContentClick.jsm
    // for the case there is no href
    let linkNode = href ? node : LinkNodeUtils.getNodeWithOnClick(event.target);
    if (linkNode) {
      if (!href) {
        json.originPrincipal = ownerDoc.nodePrincipal;
        json.originStoragePrincipal = ownerDoc.effectiveStoragePrincipal;
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

    const actor = docShell.domWindow.windowGlobalChild.getActor("ClickHandler");

    if (href) {
      try {
        Services.scriptSecurityManager.checkLoadURIStrWithPrincipal(
          principal,
          href
        );
      } catch (e) {
        return;
      }

      json.href = href;
      if (node) {
        json.title = node.getAttribute("title");
      }

      // Check if the link needs to be opened with mixed content allowed.
      // Only when the owner doc has |mixedContentChannel| and the same origin
      // should we allow mixed content.
      json.allowMixedContent = false;
      let docshell = ownerDoc.defaultView.docShell;
      if (docShell.mixedContentChannel) {
        const sm = Services.scriptSecurityManager;
        try {
          let targetURI = Services.io.newURI(href);
          let isPrivateWin =
            ownerDoc.nodePrincipal.originAttributes.privateBrowsingId > 0;
          sm.checkSameOriginURI(
            docshell.mixedContentChannel.URI,
            targetURI,
            false,
            isPrivateWin
          );
          json.allowMixedContent = true;
        } catch (e) {}
      }
      json.originPrincipal = ownerDoc.nodePrincipal;
      json.originStoragePrincipal = ownerDoc.effectiveStoragePrincipal;
      json.triggeringPrincipal = ownerDoc.nodePrincipal;

      // If a link element is clicked with middle button, user wants to open
      // the link somewhere rather than pasting clipboard content.  Therefore,
      // when it's clicked with middle button, we should prevent multiple
      // actions here to avoid leaking clipboard content unexpectedly.
      // Note that whether the link will work actually or not does not matter
      // because in this case, user does not intent to paste clipboard content.
      if (event.button === 1) {
        event.preventMultipleActions();
      }

      actor.sendAsyncMessage("Content:Click", json);
      return;
    }

    // This might be middle mouse navigation.
    if (event.button == 1) {
      actor.sendAsyncMessage("Content:Click", json);
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
        href = node.getAttribute("href") ||
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
    return [href ? Services.io.newURI(href, null, baseURI).spec : null, null,
      node && node.ownerDocument.nodePrincipal];
  },
};

var AboutNewTabHandler = {
  init(global) {
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
    Services.els.addSystemEventListener(global, "contextmenu", this.prepareContextMenu, true);
  },

  prepareContextMenu(event) {
    if (event.defaultPrevented) {
      return;
    }

    let links;
    if (ContentSvc.prefBranch.getBoolPref("openAllLinks")) {
      links = ContextMenu.getSelectedLinks(content).join("\n");
    }

    sendSyncMessage("Tabmix:contextmenu", {links});
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
