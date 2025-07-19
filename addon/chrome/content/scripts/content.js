"use strict";

const {AppConstants} = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");

ChromeUtils.defineESModuleGetters(this, {
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
  E10SUtils: "resource://gre/modules/E10SUtils.sys.mjs",
  ContentSvc: "chrome://tabmix-resource/content/ContentSvc.sys.mjs",
  LinkNodeUtils: "chrome://tabmix-resource/content/LinkNodeUtils.sys.mjs",
  ContextMenu: "chrome://tabmix-resource/content/ContextMenu.sys.mjs",
  TabmixUtils: "chrome://tabmix-resource/content/Utils.sys.mjs",
});

var PROCESS_TYPE_CONTENT = Services.appinfo.processType == Services.appinfo.PROCESS_TYPE_CONTENT;

/** @type {TabmixContentHandler} */
var TabmixContentHandler = {
  MESSAGES: [
    "Tabmix:restorePermissions",
    "Tabmix:resetContentName",
    "Tabmix:updateHistoryTitle",
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
          reload: data.reload,
        });
        break;
      }
      case "Tabmix:resetContentName": {
        if (content.name) {
          content.name = "";
        }

        break;
      }
      case "Tabmix:updateHistoryTitle": {
        if (!Services.appinfo.sessionHistoryInParent) {
          let history = docShell.QueryInterface(Ci.nsIWebNavigation).sessionHistory;
          TabmixUtils.updateHistoryTitle(history.legacySHistory, data.title);
        }
        break;
      }
      case "Tabmix:setScrollPosition": {
        content.scrollTo(data.x, data.y);
        break;
      }
      case "Tabmix:collectReloadData": {
        let postData = {isPostData: false};
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
        } catch {
          /* ignore permission errors */
        }
        sendSyncMessage("Tabmix:getOpener", {openerID});
        break;
      }
      case "Tabmix:SetPendingTabIcon": {
        try {
          // eslint-disable-next-line no-use-before-define
          FaviconLoader.load(data);
        } catch (ex) {
          console.error(ex);
        }
        break;
      }
    }
  },

  onDrop(event) {
    let links;
    try {
      // Pass true to prevent the dropping of javascript:/data: URIs
      links = Services.droppedLinkHandler.dropLinks(event, true);
      // we can not send a message with array of wrapped nsIDroppedLinkItem
      links = links.map(link => {
        const {url, name, type} = link;
        return {url, name, type};
      });
    } catch {
      return;
    }
    let data = {
      json: {
        dataTransfer: {dropEffect: event.dataTransfer.dropEffect},
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey || event.getModifierState("AltGraph"),
      },
      links,
    };
    let result = sendSyncMessage("Tabmix:contentDrop", data);
    if (result[0]) {
      event.stopPropagation();
      event.preventDefault();
    }
  },
};

// not in use from Firefox 139
/** @type {FaviconLoader} */
var FaviconLoader = {
  get actor() {
    const actor = docShell.domWindow.windowGlobalChild.getActor("LinkHandler");
    Object.defineProperty(this, "actor", {
      value: actor,
      configurable: true,
      enumerable: true,
    });
    return actor;
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

  // based on LinkHandlerChild.sys.mjs
  // we can't call addRootIcon from LinkHandlerChild.sys.mjs directly since our current
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
    if (!iconUri.spec.startsWith("fake-favicon-uri:") && !iconUri.spec.endsWith("/favicon.ico")) {
      const iconInfo = this.actor._iconLoader.iconInfos[0];
      iconInfo.iconUri = iconUri;
    }

    if (this.actor._iconLoader) {
      this.actor._iconLoader.onPageShow();
    }
  },
};

/** @type {TabmixClickEventHandler} */
var TabmixClickEventHandler = {
  init: function init(global) {
    global.addEventListener(
      "click",
      event => {
        let linkData = this.getLinkData(event);
        if (linkData) {
          let [href, node] = linkData;
          let currentHref = event.originalTarget.ownerDocument.documentURI;
          const divertMiddleClick =
            event.button == 1 && ContentSvc.prefBranch.getBoolPref("middlecurrent");
          const ctrlKey = AppConstants.platform == "macosx" ? event.metaKey : event.ctrlKey;
          if (
            divertMiddleClick ||
            ctrlKey ||
            LinkNodeUtils.isSpecialPage(href, node, currentHref)
          ) {
            this.contentAreaClick(event, linkData);
          }
        }
      },
      true
    );
    if (ContentSvc.version(1250)) {
      global.addEventListener("click", this, {capture: true, mozSystemGroup: true});
    } else {
      // @ts-expect-error - Firefox < 1250
      Services.els.addSystemEventListener(global, "click", this, true);
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
    if (
      event.defaultPrevented ||
      event.button == 2 ||
      event.tabmix_isMultiProcessBrowser === false
    ) {
      return null;
    }

    // Don't do anything on editable things, we shouldn't open links in
    // contenteditables, and editor needs to possibly handle middlemouse paste
    let composedTarget = event.composedTarget;
    if (
      composedTarget.isContentEditable ||
      (composedTarget.ownerDocument && composedTarget.ownerDocument.designMode === "on") ||
      ChromeUtils.getClassName(composedTarget) === "HTMLInputElement" ||
      ChromeUtils.getClassName(composedTarget) === "HTMLTextAreaElement"
    ) {
      return null;
    }

    let ownerDoc = event.originalTarget.ownerDocument;

    // let Firefox code handle click events from about pages
    if (
      !ownerDoc ||
      (event.button == 0 && /^about:(certerror|blocked|neterror)$/.test(ownerDoc.documentURI))
    ) {
      return null;
    }

    // For untrusted events, require a valid transient user gesture activation.
    if (!event.isTrusted && !ownerDoc.hasValidTransientUserGestureActivation) {
      return null;
    }

    return BrowserUtils.hrefAndLinkNodeForClickEvent(event);
  },

  contentAreaClick(event, linkData) {
    if (!linkData) {
      return;
    }

    let [href, node, principal] = linkData;
    let ownerDoc = event.originalTarget.ownerDocument;

    let policyContainerName = ContentSvc.version(1420) ? "policyContainer" : "csp";
    // @ts-expect-error
    let policyContainer = ownerDoc[policyContainerName];
    if (policyContainer) {
      policyContainer =
        ContentSvc.version(1420) ?
          E10SUtils.serializePolicyContainer(policyContainer)
        : E10SUtils.serializeCSP(policyContainer);
    }

    let referrerInfo = Cc["@mozilla.org/referrer-info;1"].createInstance(Ci.nsIReferrerInfo);
    if (node) {
      referrerInfo.initWithElement(node);
    } else {
      referrerInfo.initWithDocument(ownerDoc);
    }

    let serializeReferrerInfo = E10SUtils.serializeReferrerInfo(referrerInfo);

    /** @type {Partial<ClickJSONData>} */
    let json = {
      isTrusted: event.isTrusted,
      button: event.button,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey || event.getModifierState("AltGraph"),
      href: null,
      title: null,
      [policyContainerName]: policyContainer,
      referrerInfo: serializeReferrerInfo,
    };

    if (typeof event.tabmix_openLinkWithHistory == "boolean") {
      json.tabmix_openLinkWithHistory = true;
    }

    // see getHrefFromNodeOnClick in tabmix's ContentClick.sys.mjs
    // for the case there is no href
    /** @type {LinkNode} */
    let linkNode = href ? node : LinkNodeUtils.getNodeWithOnClick(event.target);
    if (linkNode) {
      if (!href) {
        json.originPrincipal = ownerDoc.nodePrincipal;
        json.originStoragePrincipal = ownerDoc.effectiveStoragePrincipal;
        json.triggeringPrincipal = ownerDoc.nodePrincipal;
      }
      linkNode = LinkNodeUtils.wrap(
        linkNode,
        TabmixUtils.focusedWindow(content),
        Boolean(href && event.button === 0)
      );
    }

    let result = sendSyncMessage("TabmixContent:Click", {json, href, node: linkNode});
    let data = result[0];
    if (data.where == "default") {
      return;
    }

    // prevent Firefox default action
    event.stopPropagation();
    event.preventDefault();

    if (data.where == "handled") {
      return;
    }

    json.tabmixContentClick = data;
    href = data._href;

    const actor = docShell.domWindow.windowGlobalChild.getActor("ClickHandler");

    // we are not suppose to get here from middle-click TabmixContent:Click
    // should return "default";
    const isFromMiddleMousePasteHandler =
      Services.prefs.getBoolPref("middlemouse.contentLoadURL", false) &&
      !Services.prefs.getBoolPref("general.autoScroll", true);

    if (href && !isFromMiddleMousePasteHandler) {
      try {
        const secMan = Services.scriptSecurityManager;
        secMan.checkLoadURIStrWithPrincipal(principal, href);
      } catch {
        return;
      }

      if (!event.isTrusted && BrowserUtils.whereToOpenLink(event) != "current") {
        ownerDoc.consumeTransientUserGestureActivation();
      }

      json.href = href;
      if (node) {
        json.title = node.getAttribute("title");
      }

      if (
        (ownerDoc.URL === "about:newtab" || ownerDoc.URL === "about:home") &&
        // we are here only when we have href, so we also have node
        node?.dataset.isSponsoredLink === "true"
      ) {
        json.globalHistoryOptions = {triggeringSponsoredURL: href};
      }

      event.preventMultipleActions();
      actor.sendAsyncMessage("Content:Click", json);
      return;
    }

    // This might be middle mouse navigation, in which case pass this back:
    if (!href && event.button == 1 && isFromMiddleMousePasteHandler) {
      docShell.domWindow.windowGlobalChild
        .getActor("MiddleMousePasteHandler")
        .onProcessedClick(json);
    }
  },
};

/** @type {ContextMenuHandler} */
var ContextMenuHandler = {
  init(global) {
    if (ContentSvc.version(1250)) {
      global.addEventListener("contextmenu", this.prepareContextMenu, {
        capture: true,
        mozSystemGroup: true,
      });
    } else {
      // @ts-expect-error - Firefox < 1250
      Services.els.addSystemEventListener(global, "contextmenu", this.prepareContextMenu, true);
    }
  },

  prepareContextMenu(event) {
    if (event.defaultPrevented) {
      return;
    }

    /** @type {Map<string, string>} */
    let links = new Map();
    if (ContentSvc.prefBranch.getBoolPref("openAllLinks")) {
      links = ContextMenu.getSelectedLinks(content);
    }

    sendSyncMessage("Tabmix:contextmenu", {links});
  },
};

TabmixContentHandler.init();
TabmixClickEventHandler.init(this);
ContextMenuHandler.init(this);
