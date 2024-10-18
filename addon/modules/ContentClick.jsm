"use strict";

const EXPORTED_SYMBOLS = ["TabmixContentClick"];

const {TabmixChromeUtils} = ChromeUtils.import("chrome://tabmix-resource/content/ChromeUtils.jsm");

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  ClickHandlerParent: "resource:///actors/ClickHandlerParent.sys.mjs",
  E10SUtils: "resource://gre/modules/E10SUtils.sys.mjs",
  PlacesUIUtils: "resource:///modules/PlacesUIUtils.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

TabmixChromeUtils.defineLazyModuleGetters(lazy, {
  LinkNodeUtils: "chrome://tabmix-resource/content/LinkNodeUtils.jsm",
  TabmixSvc: "chrome://tabmix-resource/content/TabmixSvc.jsm",
});

// prevents eslint-plugin-tabmix import-globals.js from identify internal
// imports as globals
const internalChromeUtils = TabmixChromeUtils;

var ContentClickInternal;
const TabmixContentClick = {
  init() {
    ContentClickInternal.init();
  },

  onQuitApplication() {
    ContentClickInternal.onQuitApplication();
  },

  getParamsForLink(event, linkNode, href, browser, focusedWindow) {
    return ContentClickInternal.getParamsForLink(event, linkNode, href, browser, focusedWindow);
  },

  contentLinkClick(event, browser, focusedWindow) {
    ContentClickInternal.contentLinkClick(event, browser, focusedWindow);
  },

  isGreasemonkeyInstalled(window) {
    ContentClickInternal.isGreasemonkeyInstalled(window);
  },

  isLinkToExternalDomain(curpage, url) {
    return ContentClickInternal.isLinkToExternalDomain(curpage, url);
  },

  isUrlForDownload(url) {
    return ContentClickInternal.isUrlForDownload(url);
  },

  selectExistingTab(window, href, targetAttr) {
    ContentClickInternal.selectExistingTab(window, href, targetAttr);
  }
};
Object.freeze(TabmixContentClick);

ContentClickInternal = {
  _timer: null,
  _initialized: false,

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    try {
      if (typeof lazy.ClickHandlerParent.prototype.contentAreaClick !== "function") {
        lazy.TabmixSvc.console.log("ClickHandlerParent.contentAreaClick is not a function");
        this.functions = [];
        return;
      }
    } catch {
      lazy.TabmixSvc.console.log("Unable to use ClickHandlerParent.sys.mjs");
      this.functions = [];
      return;
    }

    let mm = Services.mm;
    mm.addMessageListener("TabmixContent:Click", this);
    mm.addMessageListener("Tabmix:isFrameInContentResult", this);

    this.initContentAreaClick();
  },

  onQuitApplication() {
    if (this._timer)
      this._timer.clear();

    if (!this._initialized)
      return;

    this.functions.forEach(aFn => {
      lazy.ClickHandlerParent.prototype[aFn] = lazy.ClickHandlerParent.prototype["tabmix_" + aFn];
      delete lazy.ClickHandlerParent.prototype["tabmix_" + aFn];
    });
  },

  functions: ["contentAreaClick"],
  initContentAreaClick: function TMP_initContentAreaClick() {
    this.functions.forEach(aFn => {
      lazy.ClickHandlerParent.prototype["tabmix_" + aFn] = lazy.ClickHandlerParent.prototype[aFn];
    });

    lazy.ClickHandlerParent.prototype.contentAreaClick = function contentAreaClick(json) {
      this.tabmix_contentAreaClick.apply(this, arguments);

      // we add preventDefault in our content.js when 'where' is not the
      // 'default', original ClickHandlerParent.prototype.contentAreaClick handle all cases
      // except when 'where' equals 'current'
      if (!json.tabmixContentClick || !json.href || json.bookmark) {
        return;
      }

      // based on ClickHandlerParent.prototype.contentAreaClick
      let browser = this.manager.browsingContext.top.embedderElement;
      let window = browser.ownerGlobal;
      var where = window.Tabmix.whereToOpenLink(json);
      if (where != "current") {
        return;
      }

      let suppressTabsOnFileDownload =
          json.tabmixContentClick.suppressTabsOnFileDownload || false;
      let params = {
        charset: browser.characterSet,
        suppressTabsOnFileDownload,
        referrerInfo: lazy.E10SUtils.deserializeReferrerInfo(json.referrerInfo),
        isContentWindowPrivate: json.isContentWindowPrivate,
        originPrincipal: json.originPrincipal,
        originStoragePrincipal: json.originStoragePrincipal,
        triggeringPrincipal: json.triggeringPrincipal,
        csp: json.csp ? lazy.E10SUtils.deserializeCSP(json.csp) : null,
        frameID: json.frameID,
        openerBrowser: browser,
        hasValidUserGestureActivation: true,
        triggeringRemoteType: this.manager.domProcess?.remoteType,
      };

      if (json.globalHistoryOptions) {
        params.globalHistoryOptions = json.globalHistoryOptions;
      } else {
        params.globalHistoryOptions = {
          triggeringSponsoredURL: browser.getAttribute("triggeringSponsoredURL"),
          triggeringSponsoredURLVisitTimeMS: browser.getAttribute(
            "triggeringSponsoredURLVisitTimeMS"
          ),
        };
      }

      if (json.originAttributes.userContextId) {
        params.userContextId = json.originAttributes.userContextId;
      }
      params.allowInheritPrincipal = true;
      window.openLinkIn(json.href, where, params);

      try {
        if (!lazy.PrivateBrowsingUtils.isWindowPrivate(window)) {
          // this function is bound to ClickHandlerParent that import PlacesUIUtils
          lazy.PlacesUIUtils.markPageAsFollowedLink(json.href);
        }
      } catch {
        /* Skip invalid URIs. */
      }
    };
  },

  receiveMessage(message) {
    if (message.name == "Tabmix:isFrameInContentResult") {
      const {epoch} = message.data;
      if (this.frameSearch.has(epoch)) {
        const frameSearch = this.frameSearch.get(epoch);
        frameSearch.result(message.target, message.data);
      }
      return null;
    }
    if (message.name != "TabmixContent:Click")
      return null;

    let {json, href, node} = message.data;
    // call getWrappedNode to add attribute functions to the wrapped node
    let wrappedNode = this.getWrappedNode(node);
    let browser = message.target;

    // return value to the message caller
    if (!href && wrappedNode) {
      let result = this.getHrefFromNodeOnClick(json, browser, wrappedNode);
      return {where: result ? "handled" : "default"};
    }
    return this._getParamsForLink(json, wrappedNode, href, browser, true);
  },

  // for non-link element with onclick that change location.href
  getHrefFromNodeOnClick(event, browser, wrappedOnClickNode) {
    if (!wrappedOnClickNode || !this.getHrefFromOnClick(event, null, wrappedOnClickNode,
      wrappedOnClickNode.getAttribute("onclick")))
      return false;

    let href = event.__hrefFromOnClick;
    let result = this._getParamsForLink(event, null, href, browser, true, wrappedOnClickNode);
    if (result.where == "default") {
      event.__hrefFromOnClick = null;
      return false;
    }

    if (!event.isTrusted && result.where != "current") {
      browser.ownerDocument.consumeTransientUserGestureActivation();
    }

    const params = {
      charset: browser.characterSet,
      referrerInfo: lazy.E10SUtils.deserializeReferrerInfo(event.referrerInfo),
      isContentWindowPrivate: event.isContentWindowPrivate,
      originPrincipal: event.originPrincipal,
      originStoragePrincipal: event.originStoragePrincipal,
      triggeringPrincipal: event.triggeringPrincipal,
      csp: event.csp ? lazy.E10SUtils.deserializeCSP(event.csp) : null,
      frameID: event.frameID,
      suppressTabsOnFileDownload: result.suppressTabsOnFileDownload,
      openerBrowser: browser,
      hasValidUserGestureActivation: true,
      triggeringRemoteType: lazy.ClickHandlerParent.manager?.domProcess?.remoteType,
    };

    let win = browser.ownerGlobal;
    win.openLinkIn(href, result.where, params);

    return true;
  },

  getParamsForLink(event, linkNode, href, browser, focusedWindow) {
    let wrappedNode = this.getWrappedNode(linkNode, focusedWindow, event.button === 0);
    return this._getParamsForLink(event, wrappedNode, href, browser);
  },

  _getParamsForLink(event, wrappedNode, href, browser, clean, wrappedOnClickNode) {
    this._browser = browser;
    this._window = browser.ownerGlobal;

    let [where, suppressTabsOnFileDownload] =
        this.whereToOpen(event, href, wrappedNode, wrappedOnClickNode);

    // for debug
    where = where.split("@")[0];
    // we only use the format where.xxxx in window.contentAreaClick
    // see contentLinks.js
    if (clean)
      where = where.split(".")[0];
    if (where == "current")
      browser.tabmix_allowLoad = true;

    let targetAttr = wrappedNode && wrappedNode.target;
    if (href && browser.getAttribute("remote") == "true" &&
        where == "default" && targetAttr) {
      let win = this._window;
      win.setTimeout(() => {
        // don't try to select new tab if the original browser is no longer
        // the selected browser
        if (win.gBrowser.selectedBrowser == browser)
          this.selectExistingTab(win, href, targetAttr);
      }, 300);
    }

    // don't call this._data.hrefFromOnClick
    // if __hrefFromOnClick did not set by now we won't use it
    if (where != "default" && event.__hrefFromOnClick)
      href = event.__hrefFromOnClick;

    this.resetData();

    return {
      where,
      _href: href,
      suppressTabsOnFileDownload: suppressTabsOnFileDownload || false,
      targetAttr
    };
  },

  _data: null,
  resetData() {
    this._data = null;
    this._browser = null;
    this._window = null;
  },

  getPref() {
    internalChromeUtils.defineLazyGetter(this, "targetPref", () => {
      return lazy.TabmixSvc.prefBranch.getIntPref("opentabforLinks");
    });

    let tabBrowser = this._window.gBrowser;
    internalChromeUtils.defineLazyGetter(this, "currentTabLocked", () => {
      return tabBrowser.selectedTab.hasAttribute("locked");
    });
  },

  /**
   * @param node             json received from message.data, contain wrapped node,
   *                         or The DOM node containing the URL to be opened.
   * @param focusedWindow    focused window, see LinkNodeUtils.
   * @param getTargetIsFrame boolean, if true add targetIsFrame to the wrapped node.
   *
   * @return                 wrapped node including attribute functions
   */
  getWrappedNode(node, focusedWindow, getTargetIsFrame) {
    let wrapNode = function wrapNode(aNode, aGetTargetIsFrame) {
      let nObj = lazy.LinkNodeUtils.wrap(aNode, focusedWindow, aGetTargetIsFrame);
      nObj.hasAttribute = function(att) {
        return att in this._attributes;
      };
      nObj.getAttribute = function(att) {
        return this._attributes[att] || null;
      };
      nObj.parentNode.hasAttribute = function(att) {
        return att in this._attributes;
      };
      nObj.parentNode.getAttribute = function(att) {
        return this._attributes[att] || null;
      };
      return nObj;
    };

    return node ? wrapNode(node, getTargetIsFrame) : null;
  },

  /**
   * @param event            A valid event union.
   * @param href             href string.
   * @param wrappedNode      wrapped DOM node containing the URL to be opened.
   * @param wrappedOnClickNode   wrapped DOM node containing onclick, may exist only
   *                         when link node is null.
   */
  getData(event, href, wrappedNode, wrappedOnClickNode) {
    let self = this;
    function LinkData() {
      this.event = event;
      this.href = href;
      this.wrappedNode = wrappedNode || null;
      this.wrappedOnClickNode = wrappedOnClickNode || null;
      this.targetAttr = wrappedNode && wrappedNode.target;
      internalChromeUtils.defineLazyGetter(this, "currentURL", () => {
        return self._browser.currentURI ? self._browser.currentURI.spec : "";
      });
      internalChromeUtils.defineLazyGetter(this, "onclick", function() {
        if (this.wrappedNode && this.wrappedNode.hasAttribute("onclick"))
          return this.wrappedNode.getAttribute("onclick");
        return null;
      });
      internalChromeUtils.defineLazyGetter(this, "hrefFromOnClick", function() {
        return self.getHrefFromOnClick(event, href, this.wrappedNode, this.onclick);
      });
      internalChromeUtils.defineLazyGetter(this, "isLinkToExternalDomain", function() {
        /**
         * Check if link refers to external domain.
         * Get current page url
         * if user click a link while the page is reloading node.ownerDocument.location can be null
         */
        let youtube = /www\.youtube\.com\/watch\?v=/;
        let curpage = this.currentURL;
        if (!youtube.test(curpage)) {
          let node = this.wrappedNode || this.wrappedOnClickNode;
          curpage = node.ownerDocument.URL || this.currentURL;
        }
        let nodeHref = this.hrefFromOnClick || this.href || self._window.XULBrowserWindow.overLink;
        return self.isLinkToExternalDomain(curpage, nodeHref);
      });
    }

    this._data = new LinkData();
  },

  whereToOpen: function TMP_whereToOpenLink(event, href, wrappedNode, wrappedOnClickNode) {
    let eventWhere;
    let TMP_tabshifted = aEvent => {
      var where = eventWhere || this._window.Tabmix.whereToOpenLink(aEvent);
      return where == "tabshifted" ? "tabshifted" : "tab";
    };

    ///XXX check again how SubmitToTab work
    if (typeof this._window.SubmitToTab != 'undefined') {
      let target = event.target;
      if (HTMLButtonElement.isInstance(target) ||
          HTMLInputElement.isInstance(target)) {
        if (this._window.SubmitToTab.SubmitToTab.contentAreaClick(event) === false) {
          return ["default@1"];
        }
      }
    }

    if (!wrappedNode && !wrappedOnClickNode)
      return ["default@2"];

    this.getPref();
    this.getData(event, href, wrappedNode, wrappedOnClickNode);

    // whereToOpenLink return save or window
    eventWhere = this._window.Tabmix.whereToOpenLink(event);
    if (/^save|window/.test(eventWhere)) {
      // make sure to trigger hrefFromOnClick getter
      void this._data.hrefFromOnClick;
      return [eventWhere + "@2.1"];
    }

    if (this.miscellaneous(wrappedNode || wrappedOnClickNode))
      return ["default@2.2"];

    /*
     * prevents tab form opening when clicking Greasemonkey script
     */
    if (this.isGreasemonkeyScript(href))
      return ["default@3"];

    // Check if new tab already opened from onclick event // 2006-09-26
    let {onclick, targetAttr} = this._data;
    if (wrappedNode && onclick && wrappedNode.ownerDocument.location.href != wrappedNode._focusedWindowHref)
      return ["default@4"];

    if (wrappedNode && wrappedNode.getAttribute("rel") == "sidebar" || targetAttr == "_search" ||
        href.indexOf("mailto:") > -1) {
      return ["default@5"];
    }

    /*
     * prevent tabs from opening if left-clicked link ends with given filetype or matches regexp;
     * portions were taken from disable target for downloads by cusser
     */
    if (this.suppressTabsOnFileDownload()) {
      // don't do anything if we are on gmail and let gmail take care of the download
      let url = this._data.currentURL;
      let isGmail = /^(http|https):\/\/mail.google.com/.test(url);
      let isHttps = /^https/.test(href);
      if (isGmail || isHttps)
        return ["default@6", true];
      return ["current@7", true];
    }

    // check this after we check for suppressTabsOnFileDownload
    // for the case the link have a match in our list
    if (typeof event.tabmix_openLinkWithHistory == "boolean")
      return ["current@9"];

    // don't mess with links that have onclick inside iFrame
    let onClickInFrame = wrappedOnClickNode && wrappedOnClickNode.ownerGlobal.frameElement ||
        onclick && wrappedNode.ownerGlobal.frameElement;

    /*
     * force a middle-clicked link to open in the current tab if certain conditions
     * are true. See the function comment for more details.
     */
    if (this.divertMiddleClick()) {
      // make sure to trigger hrefFromOnClick getter
      void this._data.hrefFromOnClick;
      return [onClickInFrame ? "current.frame@10" : "current@10"];
    }

    if (onClickInFrame)
      return ["default@11"];

    // catch other middle & right click
    if (event.button !== 0) {
      return event.button == 1 && this._data.hrefFromOnClick ?
        [TMP_tabshifted(event) + "@12"] : ["default@12"];
    }

    // the rest of the code if for left-click only

    /*
     * don't change default behavior for links that point to exiting frame
     * in the current page
     */
    if (wrappedNode && wrappedNode.targetIsFrame &&
        lazy.TabmixSvc.prefBranch.getBoolPref("targetIsFrame")) {
      return ["default@13"];
    }

    /*
     * open targeted links in the current tab only if certain conditions are met.
     * See the function comment for more details.
     */
    if (this.divertTargetedLink())
      return ["current@14"];

    /*
     * open links to other sites in a tab only if certain conditions are met. See the
     * function comment for more details.
     */
    if (this.openExSiteLink())
      return [TMP_tabshifted(event) + "@15"];

    if (this.currentTabLocked || this.targetPref == 1) { // tab is locked
      let openNewTab = this.openTabfromLink();
      if (openNewTab !== null)
        return [(openNewTab ? TMP_tabshifted(event) : "default") + "@16"];
    }
    return ["default@17"];
  },

  contentLinkClick(event, browser, focusedWindow) {
    this._contentLinkClick(event, browser, focusedWindow);
    if (event.__hrefFromOnClick) {
      event.stopImmediatePropagation();
    }
    this.resetData();
  },

  /**
   * @brief For non-remote browser:
   *        handle left-clicks on links when preference is to open new tabs from links
   *        links that are not handled here go on to the page code and then to contentAreaClick
   */
  _contentLinkClick: function TMP_contentLinkClick(aEvent, aBrowser, aFocusedWindow) {
    let ownerDoc = aBrowser.ownerDocument;
    let win = ownerDoc.defaultView;
    aEvent.tabmix_isMultiProcessBrowser = win.gMultiProcessBrowser;
    if (aEvent.tabmix_isMultiProcessBrowser) {
      return "1";
    }

    if (typeof aEvent.tabmix_openLinkWithHistory == "boolean")
      return "2";

    let [href, linkNode] = win.hrefAndLinkNodeForClickEvent(aEvent);
    if (!href) {
      let node = lazy.LinkNodeUtils.getNodeWithOnClick(aEvent.target);
      let wrappedOnClickNode = this.getWrappedNode(node, aFocusedWindow, aEvent.button === 0);
      if (this.getHrefFromNodeOnClick(aEvent, aBrowser, wrappedOnClickNode))
        aEvent.preventDefault();
      return "2.1";
    }

    if (
      aEvent.button !== 0 ||
      aEvent.shiftKey ||
      aEvent.ctrlKey ||
      aEvent.altKey ||
      aEvent.getModifierState("AltGraph") ||
      aEvent.metaKey
    ) {
      if (/^save|window|tab/.test(win.Tabmix.whereToOpenLink(aEvent)))
        this.getHrefFromOnClick(aEvent, href, linkNode, linkNode.getAttribute("onclick"));
      return "3";
    }

    this._browser = aBrowser;
    this._window = win;

    this.getPref();
    if (!this.currentTabLocked && this.targetPref === 0)
      return "4";

    if (!linkNode)
      return "5";

    let wrappedNode = this.getWrappedNode(linkNode, aFocusedWindow, true);
    this.getData(aEvent, href, wrappedNode);

    var currentHref = this._data.currentURL;
    // don't do anything on mail.google or google.com/reader
    var isGmail = /^(http|https):\/\/mail.google.com/.test(currentHref) ||
                  /^(http|https):\/\/\w*.google.com\/reader/.test(currentHref);
    if (isGmail)
      return "6";

    if (this.miscellaneous(linkNode))
      return "7";

    if (linkNode.getAttribute("rel") == "sidebar" || this._data.targetAttr == "_search" ||
          href.indexOf("mailto:") > -1)
      return "10";

    /*
     * prevents tab form opening when clicking Greasemonkey script
     */
    if (this.isGreasemonkeyScript(href))
      return "11";

    /*
     * prevent tabs from opening if left-clicked link ends with given filetype or matches regexp;
     * portions were taken from disable target for downloads by cusser
     */
    if (this.suppressTabsOnFileDownload())
      return "12";

    // don't mess with links that have onclick inside iFrame
    if (this._data.onclick && linkNode.ownerGlobal.frameElement)
      return "13";

    /*
     * don't change default behavior for links that point to exiting frame
     * in the current page
     */
    if (wrappedNode && wrappedNode.targetIsFrame &&
        lazy.TabmixSvc.prefBranch.getBoolPref("targetIsFrame")) {
      return "14";
    }

    /*
     * open targeted links in the current tab only if certain conditions are met.
     * See the function comment for more details.
     */
    if (this.divertTargetedLink())
      return "15";

    var openNewTab = null;

    // when a tab is locked or preference is to open in new tab
    // we check that link is not a Javascript or have a onclick function
    if (this.currentTabLocked || this.targetPref == 1)
      openNewTab = this.openTabfromLink();
    // open links to other sites in a tab only if certain conditions are met. See the
    // function comment for more details.
    else if (this.openExSiteLink())
      openNewTab = true;

    if (openNewTab) {
      let blocked = lazy.LinkNodeUtils.isSpecialPage(href, linkNode, currentHref, this._window);
      if (!blocked) {
        return "16";
      }

      let where = this._window.Tabmix.whereToOpenLink(aEvent);
      aEvent.__where = where == "tabshifted" ? "tabshifted" : "tab";
      // in Firefox 17.0-20.0 we can't pass aEvent.__where to handleLinkClick
      // add 4th arguments with where value
      this._window.handleLinkClick(aEvent, aEvent.__hrefFromOnClick || href, linkNode, {where: aEvent.__where});
      aEvent.stopPropagation();
      aEvent.preventDefault();
      return "17";
    }

    return "18";
  },

  /**
   * @brief hock the proper Greasemonkey function into Tabmix.isGMEnabled
   */
  isGreasemonkeyInstalled: function TMP_isGreasemonkeyInstalled(window) {
    var GM_function;
    // Greasemonkey >= 0.9.10
    if (typeof window.GM_util == "object" &&
      typeof window.GM_util.getEnabled == 'function') {
      GM_function = window.GM_util.getEnabled;
    // Greasemonkey < 0.9.10
    } else if (typeof window.GM_getEnabled == 'function') {
      GM_function = window.GM_getEnabled;
    }

    if (typeof GM_function != "function")
      return;

    lazy.LinkNodeUtils._GM_function.set(window, GM_function);
  },

  miscellaneous(node) {
    if ("className" in node && node.host !== "github.com") {
      // don't interrupt with noscript
      if (node.className.indexOf("__noscriptPlaceholder__") > -1)
        return true;

      let className = node.className.toLowerCase();
      // need to find a way to work here only on links
      if (/button/.test(className))
        return true;

      let isAMO = /^(http|https):\/\/addons.mozilla.org/.test(this._data.currentURL);
      if (isAMO && /flag-review/.test(className))
        return true;
    }

    if (node.hasAttribute("href") && node.hasAttribute("role")) {
      const role = node.getAttribute("role");
      if (role == "button" || role == "menu") {
        // treat this "button" from github as link
        const isGitHubButton = node.host === "github.com" && node.pathname.includes("/tree/");
        if (!isGitHubButton) return true;
      }
    }

    // don't interrupt with fastdial links
    return "ownerDocument" in node &&
        this._window.Tabmix.isNewTabUrls(node.ownerDocument.documentURI);
  },

  /**
   * @brief Suppress tabs that may be created by installing Greasemonkey script
   *
   * @returns             true if the link is a script.
   *
   */
  isGreasemonkeyScript: function TMP_isGreasemonkeyScript(href) {
    if (lazy.LinkNodeUtils.isGMEnabled(this._window)) {
      if (href && href.match(/\.user\.js(\?|$)/i))
        return true;
    }
    return false;
  },

  /**
   * @brief Suppress tabs that may be created by downloading a file.
   *
   * This code borrows from Cusser's Disable Targets for Downloads extension.
   *
   * @returns             true if the link was handled by this function.
   *
   */
  suppressTabsOnFileDownload: function TMP_suppressTabsOnFileDownload() {
    // if we are in google search don't prevent new tab
    if (/\w+\.google\.\D+\/search?/.test(this._data.currentURL))
      return false;

    let {event, href, hrefFromOnClick} = this._data;
    href = hrefFromOnClick || href;

    // prevent link with "custombutton" protocol to open new tab when custombutton extension exist
    if (event.button != 2 && typeof custombuttons != 'undefined') {
      if (this.checkAttr(href, "custombutton://"))
        return true;
    }

    if (event.button !== 0 || event.ctrlKey || event.metaKey)
      return false;

    // prevent links in tinderbox.mozilla.org with linkHref to *.gz from open in this function
    if (this.checkAttr(href, "http://tinderbox.mozilla.org/showlog") ||
        this.checkAttr(href, "http://tinderbox.mozilla.org/addnote"))
      return false;

    let onclick = this._data.onclick;
    if (onclick) {
      if (this.checkAttr(onclick, "return install") ||
          this.checkAttr(onclick, "return installTheme") ||
          // click on link in http://tinderbox.mozilla.org/showbuilds.cgi
          this.checkAttr(onclick, "return note") || this.checkAttr(onclick, "return log"))
        return true;
    }

    // lets try not to look into links that start with javascript (from 2006-09-02)
    if (this.checkAttr(href, "javascript:"))
      return false;

    return this.isUrlForDownload(href);
  },

  isUrlForDownload: function TMP_isUrlForDownload(linkHref) {
    // we need this check when calling from onDragOver and onDrop
    if (linkHref.startsWith("mailto:"))
      return true;

    // always check if the link is an xpi link
    let filetype = ["xpi"];
    if (lazy.TabmixSvc.prefBranch.getBoolPref("enablefiletype")) {
      let types = lazy.TabmixSvc.prefBranch.getCharPref("filetype");
      types = types.toLowerCase().split(" ")
          .filter(t => !filetype.includes(t));
      filetype = [...filetype, ...types];
    }

    var linkHrefExt = "";
    if (linkHref) {
      linkHref = linkHref.toLowerCase();
      linkHrefExt = linkHref.substring(linkHref.lastIndexOf("/"), linkHref.length);
      linkHrefExt = linkHrefExt.substring(linkHrefExt.indexOf("."), linkHrefExt.length);
    }

    var testString, hrefExt, testExt;
    for (var l = 0; l < filetype.length; l++) {
      let doTest = true;
      if (filetype[l].includes("/")) {
        // add \ before first ?
        testString = filetype[l].replace(/^\/(.*)\/$/, "$1").replace(/^\?/, "\\?");
        hrefExt = linkHref;
      } else if (filetype[l].includes('?')) {
        // escape any ? and make sure it starts with \.
        testString = filetype[l].replace(/\?/g, "?").replace(/\?/g, "\\?")
            .replace(/^\./, "").replace(/^\\\./, "");
        testString = "\\." + testString;
        hrefExt = linkHref;
      } else {
        testString = "\\." + filetype[l];
        hrefExt = linkHrefExt;
        try {
          // prevent filetype catch if it is in the middle of a word
          testExt = new RegExp(testString + "[a-z0-9?.]+", 'i');
          if (testExt.test(hrefExt))
            doTest = false;
        } catch {}
      }
      try {
        if (doTest) {
          testExt = new RegExp(testString, 'i');
          if (testExt.test(hrefExt))
            return true;
        }
      } catch {}
    }
    return false;
  },

  /**
   * @brief Divert middle-clicked links into the current tab.
   *
   * This function forces a middle-clicked link to open in the current tab if
   * the following conditions are true:
   *
   * - links to other sites are not configured to open in new tabs AND the current
   *   page domain and the target page domain do not match OR the current
   *   tab is locked
   * - middle-clicks are configured to open in the current tab AND the middle
   *   mouse button was pressed OR the left mouse button and one of the Ctrl/Meta keys
   *   was pressed
   *
   * @returns              true if the function handled the click, false if it didn't.
   *
   */
  divertMiddleClick: function TMP_divertMiddleClick() {
    // middlecurrent - A Boolean value that controls how middle clicks are handled.
    if (!lazy.TabmixSvc.prefBranch.getBoolPref("middlecurrent"))
      return false;

    var isTabLocked = this.targetPref == 1 || this.currentTabLocked;
    var isDifDomain = this.targetPref == 2 && this._data.isLinkToExternalDomain;
    if (!isTabLocked && !isDifDomain)
      return false;

    let {event} = this._data;
    return event.button == 1 || event.button === 0 && (event.ctrlKey || event.metaKey);
  },

  /**
   * @brief Divert links that contain targets to the current tab.
   *
   * This function forces a link with a target attribute to open in the
   * current tab if the following conditions are true:
   *
   * - extensions.tabmix.linkTarget is true
   * - neither of the Ctrl/Meta keys were used AND the link node has a target attribute
   *   AND the content of the target attribute is not one of the special frame targets
   * - all links are not forced to open in new tabs.
   * - links to other sites are not configured to open in new tabs OR the domain name
   *   of the current page and the domain name of the target page match
   * - the current tab is not locked
   * - the target of the event has an onclick attribute that does not contain the
   *   function call 'window.open' or the function call 'return top.js.OpenExtLink'
   *
   * @returns                true if the function handled the click, false if it didn't.
   *
   */
  divertTargetedLink: function TMP_divertTargetedLink() {
    let href = this._data.hrefFromOnClick || this._data.href;
    if (this.checkAttr(href, "javascript:") || // 2005-11-28 some link in Bloglines start with javascript
        this.checkAttr(href, "data:"))
      return false;

    let {event, targetAttr} = this._data;
    if (!targetAttr || event.ctrlKey || event.metaKey) return false;
    if (!lazy.TabmixSvc.prefBranch.getBoolPref("linkTarget")) return false;

    var targetString = /^(_self|_parent|_top|_content|_main)$/;
    if (targetString.test(targetAttr.toLowerCase())) return false;

    if (this.currentTabLocked) return false;
    if (this.targetPref == 1 ||
        this.targetPref == 2 && this._data.isLinkToExternalDomain)
      return false;

    return !this.checkOnClick();
  },

  /**
   * @brief Open links to other sites in tabs as directed.
   *
   * This function opens links to external sites in tabs as long as the following
   * conditions are met:
   *
   * - links protocol is http[s] or about
   * - links to other sites are configured to open in tabs
   * - the link node does not have an 'onclick' attribute that contains either the function call
   *   'window.open' or the function call 'return top.js.OpenExtLink'.
   * - the domain name of the current page and the domain name of the target page do not match
   *   OR the link node has an 'onmousedown' attribute that contains the text 'return rwt'
   *
   * @returns                true to load link in new tab
   *                         false to load link in current tab
   *
   */
  openExSiteLink: function TMP_openExSiteLink() {
    if (this.targetPref != 2 || this._window.Tabmix.isNewTabUrls(this._data.currentURL))
      return false;

    if (this.GoogleComLink())
      return false;

    if (this.checkOnClick())
      return false;

    let {href, hrefFromOnClick, isLinkToExternalDomain, wrappedNode} = this._data;
    return /^(http|about)/.test(hrefFromOnClick || href) &&
        (isLinkToExternalDomain || wrappedNode &&
        this.checkAttr(wrappedNode.getAttribute("onmousedown"), "return rwt"));
  },

  /**
   * @brief Open links in new tabs when tab is lock or preference is to always open tab from links.
   *
   * @returns null if the caller need to handled the click,
              true to load link in new tab
              false to load link in current tab
   */
  openTabfromLink: function TMP_openTabfromLink() {
    if (this._window.Tabmix.isNewTabUrls(this._data.currentURL))
      return false;

    if (this.GoogleComLink())
      return null;

    let {href, hrefFromOnClick} = this._data;
    if (!/^(http|about)/.test(hrefFromOnClick || href))
      return null;

    // don't open new tab from facebook chat and settings
    if (/www\.facebook\.com\/(?:ajax|settings)/.test(href))
      return false;

    let current = this._data.currentURL.toLowerCase();
    let youtube = /www\.youtube\.com\/watch\?v=/;
    let isYoutube = _href => youtube.test(current) && youtube.test(_href);
    const pathProp = "pathQueryRef";
    let isSamePath = (_href, att) => makeURI(current)[pathProp].split(att)[0] == makeURI(_href)[pathProp].split(att)[0];
    let isSame = (_href, att) => current.split(att)[0] == _href.split(att)[0];

    if (hrefFromOnClick) {
      hrefFromOnClick = hrefFromOnClick.toLowerCase();
      if (isYoutube(hrefFromOnClick))
        return !isSamePath(hrefFromOnClick, '&t=');

      return !isSame(hrefFromOnClick, '#');
    }

    if (href)
      href = href.toLowerCase();

    if (this.checkAttr(href, "javascript:") ||
        this.checkAttr(href, "data:") ||
        this.checkOnClick(true))
      // javascript links, do nothing!
      return null;
    else if (isYoutube(href))
      return !isSamePath(href, '&t=');

    // when the links target is in the same page don't open new tab
    return !isSame(href, '#');
  },

  /**
   * @brief Test if target link is special Google.com link preferences , advanced_search ...
   *
   * @returns true it is Google special link false for all other links
   */
  GoogleComLink: function TMP_GoogleComLink() {
    var location = this._data.currentURL;
    var currentIsnGoogle = /\/\w+\.google\.\D+\//.test(location);
    if (!currentIsnGoogle)
      return false;

    if (/calendar\/render/.test(location))
      return true;

    var node = this._data.wrappedNode || this._data.wrappedOnClickNode;
    if (/\/intl\/\D{2,}\/options\/|search/.test(node.pathname))
      return true;

    let _list = ["/preferences", "/advanced_search", "/language_tools", "/profiles",
      "/accounts/Logout", "/accounts/ServiceLogin", "/u/2/stream/all"];

    let testPathname = _list.indexOf(node.pathname) > -1;
    if (testPathname)
      return true;

    let _host = [
      "profiles.google.com",
      "accounts.google.com",
      "groups.google.com",
      "news.google.com",
    ];
    return _host.indexOf(node.host) > -1;
  },

  /**
   * @brief Checks to see if handleLinkClick reload an existing tab without
   *        focusing it for link with target. Search in the browser content
   *        and its frames for content with matching name and href
   */
  selectExistingTab: function TMP_selectExistingTab(window, href, targetFrame) {
    if (lazy.TabmixSvc.prefBranch.getIntPref("opentabforLinks") !== 0 ||
        Services.prefs.getBoolPref("browser.tabs.loadInBackground"))
      return;

    let isValidWindow = function(aWindow) {
      // window is valid only if both source and destination are in the same
      // privacy state and multiProcess state
      return lazy.PrivateBrowsingUtils.isWindowPrivate(window) ==
        lazy.PrivateBrowsingUtils.isWindowPrivate(aWindow) &&
        window.gMultiProcessBrowser == aWindow.gMultiProcessBrowser;
    };

    let isMultiProcess;
    let windows = [];
    let addValidWindow = aWindow => {
      windows.push(aWindow);
      isMultiProcess = isMultiProcess || aWindow.gMultiProcessBrowser;
    };

    if (window.gBrowser && isValidWindow(window)) {
      addValidWindow(window);
    }

    let winEnum = Services.wm.getEnumerator("navigator:browser");
    while (winEnum.hasMoreElements()) {
      let browserWin = winEnum.getNext();
      if (!browserWin.closed && browserWin != window &&
          isValidWindow(browserWin)) {
        addValidWindow(browserWin);
      }
    }
    this.isFrameInContent(windows, {href, name: targetFrame}, isMultiProcess);
  },

  frameSearchEpoch: 0,
  frameSearch: new Map(),

  isFrameInContent(windows, frameData, isMultiProcess) {
    const deleteEpoch = epoch => {
      if (this.frameSearch.has(epoch)) {
        this.frameSearch.delete(epoch);
      }
    };
    const frameSearch = {
      epoch: 0,
      frameData: null,
      windows: null,
      start(epoch) {
        this.frameData = frameData;
        this.epoch = epoch;
        this.frameData.epoch = this.epoch;
        this.windows = windows;
        let window = this.windows.shift();
        this.next(window.gBrowser.tabs[0]);
      },
      stop() {
        this.frameData = null;
        this.windows = null;
        deleteEpoch(this.epoch);
      },
      result(browser, data) {
        let window = browser.ownerGlobal;
        let tab = window.gBrowser.getTabForBrowser(browser);
        if (data.result) {
          this.stop();
          window.gURLBar.handleRevert();
          // Focus the matching window & tab
          window.focus();
          window.gBrowser.selectedTab = tab;
        } else {
          this.next(tab.nextSibling);
        }
      },
      next(tab) {
        if (!tab && this.windows.length) {
          let window = this.windows.shift();
          tab = window.gBrowser.tabs[0];
        }
        if (tab && !tab.hasAttribute("pending")) {
          let browser = tab.linkedBrowser;
          if (browser.getAttribute("remote") == "true") {
            browser.messageManager
                .sendAsyncMessage("Tabmix:isFrameInContent", this.frameData);
          } else {
            let result = lazy.LinkNodeUtils.isFrameInContent(browser.contentWindow,
              this.frameData.href, this.frameData.name);
            this.result(browser, {result});
          }
        } else {
          this.stop();
        }
      }
    };

    const newEpoch = this.frameSearchEpoch++;
    // some open windows have gMultiProcessBrowser == true
    if (isMultiProcess) {
      this.frameSearch.set(newEpoch, frameSearch);
    }
    frameSearch.start(newEpoch);
  },

  /**
   * @brief Check for certain JavaScript strings inside an attribute.
   *
   * @param attr     The attribute to check.
   * @param string   The string to check for.
   * @returns        true if the strings are present, false if they aren't.
   *
   */
  checkAttr: function TMP_checkAttr(attr, string) {
    if (typeof attr == "string")
      return attr.startsWith(string);
    return false;
  },

  /**
   * @brief Check if link refers to external domain.
   *
   * @param target    The target link.
   * @param curpage   The current page url
   * @returns         true when curpage and target are in different domains
   *
   */
  isLinkToExternalDomain: function TMP_isLinkToExternalDomain(curpage, target) {
    const fixupURI = url => {
      try {
        return Services.uriFixup.getFixupURIInfo(url, Ci.nsIURIFixup.FIXUP_FLAG_NONE).preferredURI;
      } catch {}
      return null;
    };

    let getDomain = function getDomain(url) {
      if (typeof url != "string")
        url = url.toString();

      if (url.match(/auth\?/))
        return null;

      if (url.match(/^file:/))
        return "local_file";

      const fixedURI = fixupURI(url);
      if (fixedURI) {
        url = fixedURI.spec;
      }

      if (url.match(/^http/)) {
        url = fixedURI || makeURI(url);

        // catch redirect
        const pathProp = "pathQueryRef";
        const path = url[pathProp];
        if (path.match(/^\/r\/\?http/)) {
          url = fixupURI(path.substr("/r/?".length));
        } else if (path.match(/^.*\?url=http/)) {
          // redirect in www.reddit.com
          url = fixupURI(path.replace(/^.*\?url=/, ""));
        }
        if (!url) {
          return null;
        }
        /* DONT DELETE
        var host = url.hostPort.split(".");
        //XXX      while (host.length > 3) <---- this make problem to site like yahoo mail.yahoo.com ard.yahoo.com need
        while (host.length > 2)
          host.shift();
        return host.join(".");
        */
        let level;
        try {
          var publicSuffix = Services.eTLD.getPublicSuffixFromHost(url.hostPort);
          level = !publicSuffix.includes(".") ? 2 : 3;
        } catch {
          level = 2;
        }
        var host = url.hostPort.split(".");
        while (host.length > level)
          host.shift();
        return host.join(".");
      }
      return null;
    };

    let targetDomain = getDomain(target);
    return targetDomain && targetDomain != getDomain(curpage);
  },

  /**
   * @brief check if the link contain special onclick function.
   */
  checkOnClick: function TMP_checkOnClick(more) {
    let {onclick} = this._data;
    if (onclick) {
      if (this.checkAttr(onclick, "window.open") ||
          this.checkAttr(onclick, "NewWindow") ||
          this.checkAttr(onclick, "PopUpWin") ||
          this.checkAttr(onclick, "return "))
        return true;

      if (more && (this.checkAttr(onclick, "openit") ||
          onclick.includes('this.target="_Blank"') ||
          onclick.includes("return false")))
        return true;
    }
    return false;
  },

  /**
   * @brief prevent onclick function with the form javascript:top.location.href = url
   *        or the form window.location = url when we force new tab from link
   */
  getHrefFromOnClick(event, href, node, onclick) {
    if (typeof event.__hrefFromOnClick != "undefined")
      return event.__hrefFromOnClick;

    let result = {__hrefFromOnClick: null};
    if (onclick) {
      this._hrefFromOnClick(href, node, onclick, result);
    } else {
      let parent = node.parentNode;
      if (parent && parent.hasAttribute("onclick"))
        this._hrefFromOnClick(href, parent, parent.getAttribute("onclick"), result);
    }

    return (event.__hrefFromOnClick = result.__hrefFromOnClick);
  },

  _hrefFromOnClick(href, node, onclick, result) {
    let re = /^(javascript:)?(window\.|top\.)?(document\.)?location(\.href)?=/;
    if (!re.test(onclick))
      return;

    let clickHref = onclick.replace(re, "").trim().replace(/;|'|"/g, "");
    // special case for forum/ucp.php
    if (clickHref == "this.firstChild.href")
      clickHref = href;
    let newHref;
    // get absolute href
    try {
      newHref = makeURI(clickHref, null, makeURI(node.baseURI)).spec;
    } catch (ex) {
      // unexpected error
      lazy.TabmixSvc.console.log(ex +
        "\nunexpected error from makeURLAbsolute\nurl " + clickHref);
      return;
    }

    // Don't open new tab when the link protocol is not http or https
    if (!/^(http|about)/.test(newHref))
      return;

    // don't change the onclick if the href point to a different address
    // from the href we extract from the onclick
    if (href && !href.includes(clickHref) &&
        !this.checkAttr(href, "javascript"))
      return;

    result.__hrefFromOnClick = newHref;
  }
};

function makeURI(aURL, aOriginCharset, aBaseURI) {
  return Services.io.newURI(aURL, aOriginCharset, aBaseURI);
}

TabmixContentClick.init();
