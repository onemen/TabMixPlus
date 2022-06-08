/* globals content, docShell, addMessageListener, sendSyncMessage,
           sendAsyncMessage */
"use strict";

const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

const {setTimeout, clearTimeout} = ChromeUtils.import(
  "resource://gre/modules/Timer.jsm"
);

const {AppConstants} = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");

ChromeUtils.defineModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");

ChromeUtils.defineModuleGetter(this, "WebNavigationFrames",
  "resource://gre/modules/WebNavigationFrames.jsm");

ChromeUtils.defineModuleGetter(this, "E10SUtils",
  "resource://gre/modules/E10SUtils.jsm");

ChromeUtils.defineModuleGetter(this, "ContentSvc",
  "chrome://tabmix-resource/content/ContentSvc.jsm");

ChromeUtils.defineModuleGetter(this, "LinkNodeUtils",
  "chrome://tabmix-resource/content/LinkNodeUtils.jsm");

ChromeUtils.defineModuleGetter(this, "ContextMenu",
  "chrome://tabmix-resource/content/ContextMenu.jsm");

ChromeUtils.defineModuleGetter(this, "TabmixUtils",
  "chrome://tabmix-resource/content/Utils.jsm");

var PROCESS_TYPE_CONTENT = Services.appinfo.processType == Services.appinfo.PROCESS_TYPE_CONTENT;

var TabmixClickEventHandler, FaviconLoader;
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
    "Tabmix:SetPendingTabIcon",
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
        SessionStoreUtils.restoreDocShellCapabilities(docShell, [...disallow].join(","));
        sendSyncMessage("Tabmix:restorePermissionsComplete", {
          disallow: data.disallow,
          reload: data.reload
        });
        break;
      }
      case "Tabmix:collectPermissions": {
        let caps = SessionStoreUtils.collectDocShellCapabilities(docShell);
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
        TabmixUtils.updateHistoryTitle(history.legacySHistory, data.title);
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
        let postData = {isPostData: false, postData: null};
        if (!Services.appinfo.sessionHistoryInParent) {
          const history = docShell.QueryInterface(Ci.nsIWebNavigation).sessionHistory;
          postData = TabmixUtils.getPostDataFromHistory(history.legacySHistory);
        }
        let json = {
          scrollX: content.scrollX,
          scrollY: content.scrollY,
          ...postData,
        };
        sendAsyncMessage("Tabmix:reloadTab", json);
        break;
      }
      case "Tabmix:isFrameInContent": {
        let result = LinkNodeUtils.isFrameInContent(content, data.href, data.name);
        sendAsyncMessage("Tabmix:isFrameInContentResult", {result, epoch: data.epoch});
        break;
      }
      case "Tabmix:collectOpener": {
        let openerID = null;
        try {
          openerID = content.opener?.top?.docShell?.outerWindowID;
        } catch {/* ignore permission errors */}
        sendSyncMessage("Tabmix:getOpener", {openerID});
        break;
      }
      case "Tabmix:SetPendingTabIcon": {
        try {
          FaviconLoader.load(data);
        } catch (ex) {
          Cu.reportError(ex);
        }
        break;
      }
    }
  },

  onDrop(event) {
    let links;
    const linkName = { };
    try {
      // Pass true to prevent the dropping of javascript:/data: URIs
      links = Services.droppedLinkHandler.dropLinks(event, true);
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

FaviconLoader = {
  get actor() {
    delete this.actor;
    return (this.actor = docShell.domWindow.windowGlobalChild.getActor("LinkHandler"));
  },

  load({iconUrl, pageUrl}) {
    const baseURI = Services.io.newURI(pageUrl);
    const pageUri = Services.io.newURI(pageUrl, null, baseURI);
    const iconUri = Services.io.newURI(iconUrl, null, baseURI);

    // we only trigger LinkHandler actor for pending tabs
    if (content.document.documentURIObject.spec === "about:blank") {
      this.onHeadParsed(iconUri, pageUri);
    }
  },

  // based on LinkHandlerChild.jsm
  // we can't call addRootIcon from LinkHandlerChild.jsm directly since our current
  // pageURI (document.documentURIObject) is about:blank
  addRootIcon(pageURI) {
    if (
      !this.actor.seenTabIcon &&
        Services.prefs.getBoolPref("browser.chrome.guess_favicon", true) &&
        Services.prefs.getBoolPref("browser.chrome.site_icons", true)
    ) {
      if (["http", "https"].includes(pageURI.scheme)) {
        this.actor.iconLoader.addDefaultIcon(pageURI);
      }
    }
  },

  onHeadParsed(iconUri, pageUri) {
    // set iconInfo.iconUri to be /favicon.ico
    this.addRootIcon(pageUri);

    // replace iconInfo.iconUri with the one we got from
    // PlacesUtils.favicons.getFaviconURLForPage
    if (!iconUri.spec.startsWith("fake-favicon-uri:") &&
        !iconUri.spec.endsWith("/favicon.ico")) {
      const iconInfo = this.actor._iconLoader.iconInfos[0];
      iconInfo.iconUri = iconUri;
    }

    if (this.actor._iconLoader) {
      this.actor._iconLoader.onPageShow();
    }
  },
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
        const secMan = Services.scriptSecurityManager;
        const args = ContentSvc.version(870) ?
          [principal, href] : [principal, href, secMan.STANDARD];
        secMan.checkLoadURIStrWithPrincipal(...args);
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
      return content.HTMLAnchorElement.isInstance(aNode) && aNode.href ||
              content.HTMLAreaElement.isInstance(aNode) && aNode.href ||
              content.HTMLLinkElement.isInstance(aNode);
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
      links = ContextMenu.getSelectedLinks(content);
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
ContextMenuHandler.init(this);
TabmixPageHandler.init(this);
