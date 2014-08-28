"use strict";

var EXPORTED_SYMBOLS = ["TabmixContentClick"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ContentClick",
  "resource:///modules/ContentClick.jsm");

XPCOMUtils.defineLazyModuleGetter(this,
  "TabmixSvc", "resource://tabmixplus/Services.jsm");

this.TabmixContentClick = {
  init: function() {
    ContentClickInternal.init();
  },

  onQuitApplication: function() {
    ContentClickInternal.onQuitApplication();
  },

  getParamsForLink: function(event, linkNode, href, browser, focusedWindow) {
    return ContentClickInternal.getParamsForLink(event, linkNode, href, browser, focusedWindow);
  },

  contentLinkClick: function(event, browser, focusedWindow) {
    ContentClickInternal.contentLinkClick(event, browser, focusedWindow);
    ContentClickInternal.resetData();
  },

  isGreasemonkeyInstalled: function(window) {
    ContentClickInternal.isGreasemonkeyInstalled(window);
  },

  isLinkToExternalDomain: function(curpage, url) {
    return ContentClickInternal.isLinkToExternalDomain(curpage, url);
  },

  isUrlForDownload: function(url) {
    if (TabmixSvc.prefBranch.getBoolPref("enablefiletype"))
      return ContentClickInternal.isUrlForDownload(url);
    return false;
  },

  selectExistingTab: function(href, targetAttr) {
    ContentClickInternal.selectExistingTab(href, targetAttr);
  }
}
Object.freeze(TabmixContentClick);

let Tabmix = { }

let ContentClickInternal = {
  _timer: null,
  _initialized: false,

  init: function() {
    if (!TabmixSvc.version(320) || this._initialized)
      return;
    this._initialized = true;

    Tabmix._debugMode = TabmixSvc.debugMode();
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js");

    let mm = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager);
    mm.addMessageListener("TabmixContent:Click", this);

    this.initContentAreaClick();
  },

  onQuitApplication: function () {
    if (this._timer)
      this._timer.clear();

    if (!this._initialized)
      return;

    this.functions.forEach(function(aFn) {
      ContentClick[aFn] = ContentClick["tabmix_" + aFn];
      delete ContentClick["tabmix_" + aFn];
    });
  },

  functions: ["contentAreaClick"],
  initContentAreaClick: function TMP_initContentAreaClick() {
    try {
      let test = ContentClick.contentAreaClick.toString();
    } catch (ex) { return; }

    this.functions.forEach(function(aFn) {
      ContentClick["tabmix_" + aFn] = ContentClick[aFn];
    });

    Tabmix.changeCode(ContentClick, "ContentClick.contentAreaClick")._replace(
      'var where = window.whereToOpenLink(json);',
      'var data = json.tabmix || {where: window.whereToOpenLink(json)};\n' +
      '    var {where, targetAttr, suppressTabsOnFileDownload} = data;\n' +
      '    if (where == "default" && targetAttr) {\n' +
      '      window.setTimeout(function(){\n' +
      '        window.Tabmix.ContentClick.selectExistingTab(json.href, targetAttr);\n' +
      '      },300);\n' +
      '    }\n'
    )._replace(
      'where == "current"',
      '!json.tabmix && where == "current" || where == "default"'
    )._replace(
      'referrerURI: browser.documentURI,',
      '$&\n' +
      '                                          suppressTabsOnFileDownload: suppressTabsOnFileDownload || false,'
    ).toCode();
  },

  receiveMessage: function (message) {
    if (message.name != "TabmixContent:Click")
      return null;

    let {json, href} = message.data;
    let {node, focusedWindow} = message.objects;
    let browser = message.target;
    // return value to the message caller
    return this.getParamsForLink(json, node, href, browser, focusedWindow, true);
  },

  getParamsForLink: function(event, node, href, browser, focusedWindow, remote) {
    // don't change anything when whereToOpenLink return save or window
    let win = browser.ownerDocument.defaultView;
    if (/^save|window/.test(win.whereToOpenLink(event)))
      return {where: "default", _href: href};

    this._browser = browser;
    this._window = win;
    this._focusedWindow = focusedWindow;

    let targetAttr = this.getTargetAttr(node);
    let [where, suppressTabsOnFileDownload] =
        this.whereToOpen(event, node, href, targetAttr);

    // for debug
    where = where.split("@")[0];
    if (remote)
      where = where.split(".")[0];
    if (where == "current")
      browser.tabmix_allowLoad = true;
    else if (event.__href)
      href = event.__href;

    if (event.button == 1 && this.getHrefFromOnClick(event, href, node)) {
      href = event.__href;
      where = "tab";
    }

    if (remote && /^tab/.test(where))
      this.preventOnClick(node);

    this.resetData();

    return {
      where: where,
      _href: href,
      suppressTabsOnFileDownload: suppressTabsOnFileDownload || false,
      targetAttr: targetAttr
    };
  },

  _data: null,
  resetData: function() {
    this._data = null;
    this._browser = null;
    this._window = null;
    this._focusedWindow = null;
  },

  getPref: function() {
    XPCOMUtils.defineLazyGetter(this, "targetPref", function() {
      return TabmixSvc.prefBranch.getIntPref("opentabforLinks");
    });

    let tabBrowser = this._window.gBrowser;
    XPCOMUtils.defineLazyGetter(this, "currentTabLocked", function() {
      return tabBrowser.selectedTab.hasAttribute("locked");
    });
  },

  /*
   * @param event            A valid event union.
   * @param href             href string.
   * @param linkNode         The DOM node containing the URL to be opened.
   * @param targetAttr       The target attribute of the link node.
   */
  getData: function(event, href, linkNode, targetAttr) {
    let self = this;
    function LinkData() {
      this.event = event;
      this.href = href;
      this.linkNode = linkNode;
      this.targetAttr = targetAttr;
      XPCOMUtils.defineLazyGetter(this, "currentURL", function() {
        return self._browser.currentURI ? self._browser.currentURI.spec : "";
      });
      XPCOMUtils.defineLazyGetter(this, "onclick", function() {
        if (linkNode.hasAttribute("onclick"))
          return linkNode.getAttribute("onclick");
        return null;
      });
      XPCOMUtils.defineLazyGetter(this, "isLinkToExternalDomain", function() {
       /*
        * Check if link refers to external domain.
        * Get current page url
        * if user click a link while the page is reloading linkNode.ownerDocument.location can be null
        */
        ///XXX [object CPOW [object HTMLDocument]] linkNode.ownerDocument
        let location = linkNode.ownerDocument.location;
        let curpage = location ? location.href || location.baseURI : self._data.currentURL;
        return self.isLinkToExternalDomain(curpage, self._window.XULBrowserWindow.overLink || linkNode);
      });
    }

    this._data = new LinkData();
  },

  whereToOpen: function TMP_whereToOpen(event, linkNode, href, targetAttr) {
    let TMP_tabshifted = function TMP_tabshifted(event) {
      var where = this._window.whereToOpenLink(event);
      return where == "tabshifted" ? "tabshifted" : "tab";
    }.bind(this);

  ///XXX check again how SubmitToTab work
    if (typeof(this._window.SubmitToTab) != 'undefined') {
      let target = event.target;
      if (target instanceof HTMLButtonElement ||
          target instanceof HTMLInputElement) {
        if (SubmitToTab.contentAreaClick(event) == false) {
          return ["default@1"];
        }
      }
    }

    if (!linkNode)
      return ["default@2"];

    this.getPref();
    this.getData(event, href, linkNode, targetAttr);

    /*
     * prevents tab form opening when clicking Greasemonkey script
     */
    if (this.isGreasemonkeyScript(href))
      return ["default@3"];

    // Check if new tab already opened from onclick event // 2006-09-26
    if (this._data.onclick && linkNode.ownerDocument.location.href != this._focusedWindow.top.location.href)
      return ["default@4"];

    if (linkNode.getAttribute("rel") == "sidebar" || targetAttr == "_search" ||
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

    if (!/^(http|about)/.test(linkNode.protocol))
      return ["default@8"];

    // check this after we check for suppressTabsOnFileDownload
    // for the case the link have a matche in our list
    if (typeof event.tabmix_openLinkWithHistory == "boolean")
      return ["current@9"];

    // don't mess with links that have onclick inside iFrame
    ///XXX [object CPOW [object HTMLDocument]] linkNode.ownerDocument
    let onClickInFrame = this._data.onclick && linkNode.ownerDocument.defaultView.frameElement;

    /*
     * force a middle-clicked link to open in the current tab if certain conditions
     * are true. See the function comment for more details.
     */
    if (this.divertMiddleClick()) {
      return [onClickInFrame ? "current.frame@10" : "current@10"];
    }

    if (onClickInFrame)
      return ["default@11"];

    // catch other middle & right click
    if (event.button != 0)
      return ["default@12"];

    // the rest of the code if for left-click only

    /*
     * don't change default behavior for links that point to exiting frame
     * in the current page
     */
    if (this.targetIsFrame())
      return ["default@13"];

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
      if (openNewTab != null)
        return [(openNewTab ? TMP_tabshifted(event) : "current") + "@16"];
    }

    return ["default@17"];
  },

  /**
   * @brief For non-remote browser:
   *        handle left-clicks on links when preference is to open new tabs from links
   *        links that are not handled here go on to the page code and then to contentAreaClick
   */
  contentLinkClick: function TMP_contentLinkClick(aEvent, aBrowser, aFocusedWindow) {
    aEvent.tabmix_isRemote = aBrowser.getAttribute("remote") == "true";
    if (aEvent.tabmix_isRemote)
      return;

    if (typeof aEvent.tabmix_openLinkWithHistory == "boolean")
      return;

    if (aEvent.button != 0 || aEvent.shiftKey || aEvent.ctrlKey || aEvent.altKey || aEvent.metaKey)
      return;

    this._browser = aBrowser;
    this._window = this._browser.ownerDocument.defaultView;
    this._focusedWindow = aFocusedWindow;

    this.getPref();
    if (!this.currentTabLocked && this.targetPref == 0)
      return;

    let [href, linkNode] = this._window.hrefAndLinkNodeForClickEvent(aEvent);
    if (!linkNode || !/^(http|about)/.test(linkNode.protocol))
      return;

    let targetAttr = this.getTargetAttr(linkNode);
    this.getData(aEvent, href, linkNode, targetAttr);

    var currentHref = this._data.currentURL;
    // don't do anything on mail.google or google.com/reader
    var isGmail = /^(http|https):\/\/mail.google.com/.test(currentHref) || /^(http|https):\/\/\w*.google.com\/reader/.test(currentHref);
    if (isGmail)
      return;

    if ("className" in linkNode) {
      // don't interrupt with noscript
      if (linkNode.className.indexOf("__noscriptPlaceholder__") > -1)
        return;

      // need to find a way to work here only on links
      if (/button/.test(linkNode.className.toLowerCase()))
        return;
    }

    // don't interrupt with fastdial links
    ///XXX [object CPOW [object HTMLDocument]] linkNode.ownerDocument
    if ("ownerDocument" in linkNode && this._window.Tabmix.isNewTabUrls(linkNode.ownerDocument.documentURI))
      return;

    if (linkNode.getAttribute("rel") == "sidebar" || targetAttr == "_search" ||
          href.indexOf("mailto:") > -1)
      return;

    /*
     * prevents tab form opening when clicking Greasemonkey script
     */
    if (this.isGreasemonkeyScript(href))
      return;

    /*
     * prevent tabs from opening if left-clicked link ends with given filetype or matches regexp;
     * portions were taken from disable target for downloads by cusser
     */
    if (this.suppressTabsOnFileDownload())
      return;

    // don't mess with links that have onclick inside iFrame
    ///XXX [object CPOW [object HTMLDocument]] linkNode.ownerDocument
    if (this._data.onclick && linkNode.ownerDocument.defaultView.frameElement)
      return;

    /*
     * don't change default behavior for links that point to exiting frame
     * in the current page
     */
    if (this.targetIsFrame())
      return;

    /*
     * open targeted links in the current tab only if certain conditions are met.
     * See the function comment for more details.
     */
    if (this.divertTargetedLink())
      return;

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
      this.preventOnClick(linkNode);
      try {
        // for the moment just do it for Google and Yahoo....
        // and tvguide.com - added 2013-07-20
        var blocked = /tvguide.com|google|yahoo.com\/search|my.yahoo.com/.test(currentHref);
        // youtube.com - added 2013-11-15
        if (!blocked && /youtube.com/.test(currentHref) &&
           (!this.isGMEnabled() || this._window.decodeURI(href).indexOf("return false;") == -1))
          blocked = true;
        else if (!blocked) {
          // make sure external links in developer.mozilla.org open new tab
          let host = this._browser.currentURI.host;
          blocked = host == "developer.mozilla.org" && linkNode.host != host &&
                   linkNode.classList.contains("external");
        }
      } catch (ex) {blocked = false;}
      if (!blocked)
        return;

      let where = this._window.whereToOpenLink(aEvent);
      aEvent.__where = where == "tabshifted" ? "tabshifted" : "tab";
      this._window.handleLinkClick(aEvent, href, linkNode);
      aEvent.stopPropagation();
      aEvent.preventDefault();
    }
  },

  /**
   * @brief prevent onclick function with the form javascript:top.location.href = url
   *        or the form window.location = url when we force new tab from link
   */
  preventOnClick: function(linkNode) {
    let {href, onclick} = this._data;

    let removeOnclick = function (node, click) {
      if (this.checkAttr(click, "window.location=")) {
        let clickTarget = click.replace("window.location=", "").trim().replace(/^["|']+|["|']+$/g, "");
        if (href.indexOf(clickTarget) != -1)
          node.removeAttribute("onclick");
      }
    }.bind(this);

    if (onclick) {
      let code = "javascript:top.location.href="
      if (this.checkAttr(href, "javascript:void(0)") && this.checkAttr(onclick, code))
        linkNode.setAttribute("onclick", onclick.replace(code, "var __tabmix.href="));
      else
        removeOnclick(linkNode, onclick);
    }
    ///XXX [object CPOW [object HTMLTableCellElement]] linkNode.parentNode
    let parent = linkNode.parentNode;
    if (parent.hasAttribute("onclick"))
      removeOnclick(parent, parent.getAttribute("onclick"));
  },

  /**
   * @brief hock the proper Greasemonkey function into Tabmix.isGMEnabled
   */
  isGreasemonkeyInstalled: function TMP_isGreasemonkeyInstalled(window) {
    var GM_function;
    try {
      // Greasemonkey >= 0.9.10
      Cu.import("resource://greasemonkey/util.js");
      if ('function' == typeof window.GM_util.getEnabled) {
        GM_function = window.GM_util.getEnabled;
      }
    } catch (e) {
      // Greasemonkey < 0.9.10
      if ('function' == typeof window.GM_getEnabled) {
        GM_function = window.GM_getEnabled;
      }
    }

    if (typeof GM_function !=  "function")
      return;

    this._GM_function.set(window, GM_function);
  },

  /**
   * @brief Suppress tabs that may be created by installing Greasemonkey script
   *
   * @returns             true if the link is a script.
   *
   */
  isGreasemonkeyScript: function TMP_isGreasemonkeyScript(href) {
    if (this.isGMEnabled()) {
      if (href && href.match(/\.user\.js(\?|$)/i))
        return true;
    }
    return false;
  },

  _GM_function: new WeakMap(),

  isGMEnabled: function() {
    if (this._GM_function.has(this._window))
      return this._GM_function.get(this._window)();
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

    let {event, linkNode} = this._data;
    linkNode = linkNode.toString();

    // prevent link with "custombutton" protocol to open new tab when custombutton extension exist
    if (event.button != 2 && typeof(custombuttons) !='undefined'){
      if (this.checkAttr(linkNode, "custombutton://"))
        return true;
    }

    if (!TabmixSvc.prefBranch.getBoolPref("enablefiletype"))
      return false;

    if (event.button != 0 || event.ctrlKey || event.metaKey)
      return false;

    // lets try not to look into links that start with javascript (from 2006-09-02)
    if (this.checkAttr(this._data.href, "javascript:"))
      return false;

    if (this._data.onclick) {
      let {onclick} = this._data;
      if (this.checkAttr(onclick, "return install") ||
          this.checkAttr(onclick, "return installTheme") ||
          this.checkAttr(onclick, "return note") || this.checkAttr(onclick, "return log")) // click on link in http://tinderbox.mozilla.org/showbuilds.cgi
        return true;
    }

    // prevent links in tinderbox.mozilla.org with linkHref to *.gz from open in this function
    if (this.checkAttr(linkNode , "http://tinderbox.mozilla.org/showlog") ||
      this.checkAttr(linkNode , "http://tinderbox.mozilla.org/addnote")) return false;

    return this.isUrlForDownload(this._data.href);
  },

  isUrlForDownload: function TMP_isUrlForDownload(linkHref) {
    //we need this check when calling from onDragOver and onDrop
    if (linkHref.indexOf("mailto:") == 0)
      return true;

    var filetype = TabmixSvc.prefBranch.getCharPref("filetype");
    filetype = filetype.toLowerCase();
    filetype = filetype.split(" ");
    var linkHrefExt = "";
    if (linkHref) {
      linkHref = linkHref.toLowerCase();
      linkHrefExt = linkHref.substring(linkHref.lastIndexOf("/"),linkHref.length);
      linkHrefExt = linkHrefExt.substring(linkHrefExt.indexOf("."),linkHrefExt.length);
    }

    var testString, hrefExt, testExt;
    for (var l = 0; l < filetype.length; l++) {
      if (filetype[l].indexOf("/") != -1){
      // add \ before first ?
        testString = filetype[l].substring(1,filetype[l].length-1).replace(/^\?/,"\\?");
        hrefExt = linkHref;
      }
      else {
        testString = "\\." + filetype[l];
        hrefExt = linkHrefExt;
        try {
          // prevent filetype catch if it is in the middle of a word
          testExt = new RegExp(testString + "[a-z0-9?\.]+", 'i');
          if (testExt.test(hrefExt))
            continue;
        } catch (ex) {}
      }
      try {
        testExt = new RegExp(testString, 'i');
        if (testExt.test(hrefExt))
          return true;
      } catch (ex) {}
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
    if (!TabmixSvc.prefBranch.getBoolPref("middlecurrent"))
      return false;

    var isTabLocked = this.targetPref == 1 || this.currentTabLocked;
    var isDifDomain = this.targetPref == 2 && this._data.isLinkToExternalDomain;
    if (!isTabLocked && !isDifDomain)
      return false;

    let {event} = this._data;
    if (event.button == 1 || event.button == 0 && (event.ctrlKey || event.metaKey))
      return true;

    return false;
  },

 /**
  * @brief check if traget attribute exist and point to frame in the document
  *        frame pool
  */
  targetIsFrame: function() {
    let {targetAttr} = this._data;
    if (targetAttr) {
      let content = this._focusedWindow.top;
      if (this.existsFrameName(content, targetAttr))
        return true;
    }
    return false;
  },

  /**
   * @brief Divert links that contain targets to the current tab.
   *
   * This function forces a link with a target attribute to open in the
   * current tab if the following conditions are true:
   *
   * - extensions.tabmix.linkTarget is true
   * - neither of the Ctrl/Meta keys were used AND the linkNode has a target attribute
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
  ///XXX - check if we need to use here href
    let linkNode = this._data.linkNode.toString();
    if (this.checkAttr(linkNode, "javascript:") || // 2005-11-28 some link in Bloglines start with javascript
        this.checkAttr(linkNode, "data:"))
      return false;

    let {event, targetAttr} = this._data;
    if (!targetAttr || event.ctrlKey || event.metaKey) return false;
    if (!TabmixSvc.prefBranch.getBoolPref("linkTarget")) return false;

    var targetString = /^(_self|_parent|_top|_content|_main)$/;
    if (targetString.test(targetAttr.toLowerCase())) return false;

    if (this.currentTabLocked) return false;
    if (this.targetPref == 1 ||
        this.targetPref == 2 && this._data.isLinkToExternalDomain)
      return false;

    if (this.checkOnClick())
      return false;

    return true;
  },

  /**
   * @brief Open links to other sites in tabs as directed.
   *
   * This function opens links to external sites in tabs as long as the following
   * conditions are met:
   *
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

    if (this.checkOnClick())
      return false;

    if (this._data.isLinkToExternalDomain ||
        this.checkAttr(this._data.linkNode.getAttribute("onmousedown"), "return rwt"))
      return true;

    return false;
  },

  /**
   * @brief Open links in new tabs when tab is lock or preference is to always opne tab from links.
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

    let {href, linkNode, onclick} = this._data;
    if (href)
      href = href.toLowerCase();

    // we replcae in contentLinkClick the onclick javascript:top.location.href = url
    // with var __tabmix.href = url
    if (this.checkAttr(onclick, "var __tabmix.href=") &&
        this.getHrefFromOnClick(this._data.event, href, linkNode, "var __tabmix.href="))
      return "tab";

    if (this.checkAttr(href, "javascript:") ||
        this.checkAttr(href, "data:") ||
        this.checkOnClick(true))
      // javascript links, do nothing!
      return null;
    else
      // when the links target is in the same page don't open new tab
      return this._data.currentURL.split("#")[0] != linkNode.toString().split("#")[0];

    return null;
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

    var {linkNode} = this._data;
    if (/\/intl\/\D{2,}\/options\/|search/.test(linkNode.pathname))
      return true;

    let _list = ["/preferences", "/advanced_search", "/language_tools", "/profiles",
                 "/accounts/Logout", "/accounts/ServiceLogin"];

    let testPathname = _list.indexOf(linkNode.pathname) > -1;
    if (testPathname)
      return true;

    let _host = ["profiles.google.com", "accounts.google.com", "groups.google.com"];
    let testHost = _host.indexOf(linkNode.host) > -1;
    if (testHost)
      return true;

    return false;
  },

  /**
   * @brief Check a document's frame pool and determine if
   * |targetFrame| is located inside of it.
   *
   * @param content           is a frame reference
   * @param targetFrame       The name of the frame that we are seeking.
   * @returns                 true if the frame exists within the given frame pool,
   *                          false if it does not.
   */
  existsFrameName: function TMP_existsFrameName(content, targetFrame) {
    for (let i = 0; i < content.frames.length; i++) {
      let frame = content.frames[i];
      if (frame.name == targetFrame || this.existsFrameName(frame, targetFrame))
        return true;
    }
    return false;
  },

  /**
   * @brief Checks to see if handleLinkClick reload an existing tab without
   *        focusing it for link with target. Search in the browser content
   *        and its frames for content with matching name and href
   */
  selectExistingTab: function TMP_selectExistingTab(href, targetFrame) {
    if (TabmixSvc.prefBranch.getIntPref("opentabforLinks") != 0 ||
        Services.prefs.getBoolPref("browser.tabs.loadInBackground"))
      return;

    function isCurrent(content) {
      if (content.location.href == href && content.name == targetFrame)
        return true;
      for (let i = 0; i < content.frames.length; i++) {
        let frame = content.frames[i];
        if (frame.location.href == href && frame.name == targetFrame)
          return true;
      }
      return false;
    }

    let window = this._window;
    function switchIfURIInWindow(aWindow) {
      // Only switch to the tab if both source and desination are
      // private or non-private.
      if (TabmixSvc.version(200) &&
          PrivateBrowsingUtils.isWindowPrivate(window) !=
          PrivateBrowsingUtils.isWindowPrivate(aWindow)) {
        return false;
      }
      if (!("gBrowser" in aWindow))
        return false;
      let browsers = aWindow.gBrowser.browsers;
      for (let i = 0; i < browsers.length; i++) {
        let browser = browsers[i];
        if (isCurrent(browser[TabmixSvc.contentWindowAsCPOW])) {
          gURLBar.handleRevert();
          // Focus the matching window & tab
          aWindow.focus();
          aWindow.gBrowser.tabContainer.selectedIndex = i;
          return true;
        }
      }
      return false;
    }

    if (switchIfURIInWindow(window))
      return;

    let winEnum = Services.wm.getEnumerator("navigator:browser");
    while (winEnum.hasMoreElements()) {
      let browserWin = winEnum.getNext();
      if (browserWin.closed || browserWin == window)
        continue;
      if (switchIfURIInWindow(browserWin))
        return;
    }
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
    if (typeof(attr) == "string")
      return attr.indexOf(string) == 0;
    return false;
  },

  get uriFixup() {
    delete this.uriFixup;
    return this.uriFixup = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
  },

 /**
  * @brief Check if link refers to external domain.
  *
  * @param target    The target link.
  * @param curpage   The current page url
  * @returns         true when curpage and target are in diffrent domains
  *
  */
  isLinkToExternalDomain: function TMP_isLinkToExternalDomain(curpage, target) {
    var self = this;
    function getDomain(url) {
      if (typeof(url) != "string")
        url = url.toString();

      if (url.match(/auth\?/))
        return null;

      if (url.match(/^file:/))
        return "local_file";

      try {
        var fixedURI = self.uriFixup.createFixupURI(url, Ci.nsIURIFixup.FIXUP_FLAG_NONE);
        url = fixedURI.spec;
      } catch (ex) { }

      if (url.match(/^http/)) {
        url = fixedURI || Services.io.newURI(url, null, null);

        // catch redirect
        if (url.path.match(/^\/r\/\?http/))
          url = Services.io.newURI(url.path.substr("/r/?".length), null, null);
    /* DONT DELETE
      var host = url.hostPort.split(".");
      //XXX      while (host.length > 3) <---- this make problem to site like yahoo mail.yahoo.com ard.yahoo.com need
      while (host.length > 2)
        host.shift();
      return host.join(".");
    */
        try {
          var publicSuffix = Services.eTLD.getPublicSuffixFromHost(url.hostPort);
          var level = (publicSuffix.indexOf(".") == -1) ? 2 : 3;
        } catch(e) {
          level = 2;
        }
        var host = url.hostPort.split(".");
        while (host.length > level)
          host.shift();
        return host.join(".");
      }
      return null;
    }

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
          onclick.indexOf('this.target="_Blank"') != -1 ||
          onclick.indexOf("return false") != -1))
        return true;
    }
    return false;
  },

  getTargetAttr: function TMP_getTargetAttr(linkNode) {
    var targetAttr = linkNode && linkNode.target;
    // If link has no target attribute, check if there is a <base> with a target attribute
    if (!targetAttr) {
      let b = this._focusedWindow.document.getElementsByTagName("base");
      if (b.length > 0)
        targetAttr = b[0].getAttribute("target");
    }
    return targetAttr;
  },

  getHrefFromOnClick: function TMP_getHrefFromOnClick(event, href, linkNode, aCode) {
    if (this.checkAttr(href, "javascript") &&
        linkNode.hasAttribute("onclick")) {
      let onclick = linkNode.getAttribute("onclick");
      let code = aCode || "javascript:top.location.href=";
      try {
        let str = onclick.substr(code.length).replace(/;|'|"/g, "");
        event.__href = this._window.makeURLAbsolute(linkNode.baseURI, str);
        return true;
      } catch (ex) {TabmixSvc.console.log(ex)}
    }
    return false;
  }
}

TabmixContentClick.init();
