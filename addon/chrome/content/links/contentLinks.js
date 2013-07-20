"use strict";

Tabmix.contentAreaClick = {
  _data: null,
  getPref: function() {
    XPCOMUtils.defineLazyGetter(this, "targetPref", function() {
      return Tabmix.prefs.getIntPref("opentabforLinks");
    });
    XPCOMUtils.defineLazyGetter(this, "currentTabLocked", function() {
      return gBrowser.mCurrentTab.hasAttribute("locked");
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
        let location = linkNode.ownerDocument.location;
        let curpage = location ? location.href || location.baseURI : gBrowser.currentURI.spec;
        return self.isLinkToExternalDomain(curpage, window.XULBrowserWindow.overLink || linkNode);
      });
    }

    this._data = new LinkData();
  },

  init: function TMP_CA_init() {
    Tabmix.changeCode(window, "contentAreaClick")._replace(
      'if (linkNode &&',
      'var targetAttr = Tabmix.contentAreaClick.getTargetAttr(linkNode);' +
      'var [where, suppressTabsOnFileDownload] =' +
      '      Tabmix.contentAreaClick.whereToOpen(event, linkNode, href, targetAttr);' +
      'Tabmix.contentAreaClick._data = null;' +
      'if (where == "current") gBrowser.mCurrentBrowser.tabmix_allowLoad = true;' +
      'else if (event.__href) href = event.__href;' +
      '$&'
    )._replace(
      'if (linkNode.getAttribute("onclick")',
      'if (where == "default") $&'
    )._replace(
      'loadURI(',
      '  if (where == "tab" || where == "tabshifted") {' +
      '    let doc = event.target.ownerDocument;' +
      '    let _url = Tabmix.isVersion(190) ? href : url;' +
      '    openLinkIn(_url, where, {referrerURI: doc.documentURIObject, charset: doc.characterSet,' +
      '              initiatingDoc: doc,' +
      '              suppressTabsOnFileDownload: suppressTabsOnFileDownload});' +
      '  }' +
      '  else $&'
    )._replace(
      // force handleLinkClick to use openLinkIn by replace "current"
      // with " current", we later use trim() before handleLinkClick call openLinkIn
      'handleLinkClick(event, href, linkNode);',
      '  if (event.button == 1 && Tabmix.contentAreaClick.getHrefFromOnClick(event, href, linkNode)) {' +
      '    href = event.__href;' +
      '    where = "tab";' +
      '  }' +
      '  event.__where = where == "current" && href.indexOf("custombutton://") != 0 ? " " + where : where;' +
      '  event.__suppressTabsOnFileDownload = suppressTabsOnFileDownload;' +
      '  var result = $&' +
      '  if (targetAttr == "_new" && !result) Tabmix.contentAreaClick.selectExistingTab(href);'
    ).toCode();

    /* don't change where if it is save, window, or we passed
     * event.__where = default from contentAreaClick or
     * Tabmix.contentAreaClick.contentLinkClick
     */
    Tabmix.changeCode(window, "handleLinkClick")._replace(
      'whereToOpenLink(event);',
      '$&' +
      '  if (event && event.__where && event.__where != "default" &&' +
      '      ["tab","tabshifted","current"].indexOf(where) != -1) {' +
      '    where = event.__where;' +
      '  }'
    )._replace(
      'var doc = event.target.ownerDocument;',
      'where = where.trim();\
       $&'
    )._replace(
      'charset: doc.characterSet',
      '$&, suppressTabsOnFileDownload: event.__suppressTabsOnFileDownload'
    ).toCode();
  },

  whereToOpen: function TMP_CA_whereToOpen(event, linkNode, href, targetAttr) {
    function TMP_tabshifted(event) {
      var where = whereToOpenLink(event);
      return where == "tabshifted" ? "tabshifted" : "tab";
    }

  ///XXX check again how SubmitToTab work
    if (typeof(SubmitToTab) != 'undefined') {
      let target = event.target;
      if (target instanceof HTMLButtonElement ||
          target instanceof HTMLInputElement) {
        if (SubmitToTab.contentAreaClick(event) == false) {
          return ["default"];
        }
      }
    }

    if (!linkNode)
      return ["default"];

    this.getPref();
    this.getData(event, href, linkNode, targetAttr);

    /*
     * prevents tab form opening when clicking Greasemonkey script
     */
    if (this.isGreasemonkeyScript(href))
      return ["default"];

    // Check if new tab already opened from onclick event // 2006-09-26
    if (this._data.onclick && gBrowser.contentDocument.location.href != document.commandDispatcher.focusedWindow.top.location.href)
      return ["default"];

    if (linkNode.getAttribute("rel") == "sidebar" || targetAttr == "_search" ||
        href.indexOf("mailto:") > -1) {
      return ["default"];
    }

    /*
     * prevent tabs from opening if left-clicked link ends with given filetype or matches regexp;
     * portions were taken from disable target for downloads by cusser
     */
    if (this.suppressTabsOnFileDownload()) {
        // don't do anything if we are on gmail and let gmail take care of the download
        let url = gBrowser.currentURI ? gBrowser.currentURI.spec : "";
        let isGmail = /^(http|https):\/\/mail.google.com/.test(url);
        let isHttps = /^https/.test(href);
        if (isGmail || isHttps)
           return ["default", true];
        return ["current", true];
    }

    /*
     * force a middle-clicked link to open in the current tab if certain conditions
     * are true. See the function comment for more details.
     */
    if (this.divertMiddleClick()) {
      return ["current"];
    }

    // catch other middle & right click
    if (event.button != 0)
      return ["default"];

    // the rest of the code if for left-click only

    /*
     * open targeted links in the current tab only if certain conditions are met.
     * See the function comment for more details.
     */
    if (this.divertTargetedLink()) {
      return ["current"];
    }

    /*
     * open links to other sites in a tab only if certain conditions are met. See the
     * function comment for more details.
     */
    if (this.openExSiteLink()) {
      return [TMP_tabshifted(event)];
    }

    if (this.currentTabLocked || this.targetPref == 1) { // tab is locked
      let openNewTab = this.openTabfromLink();
      if (openNewTab != null)
        return [openNewTab ? TMP_tabshifted(event) : "current"];
    }

    return ["default"];
  },

  /**
   * @brief Handle left-clicks on links when preference is to open new tabs from links
   *        links that are not handled here go on to the page code and then to contentAreaClick
   */
  _contentLinkClick: function TMP__contentLinkClick(aEvent) {
    Tabmix.contentAreaClick.contentLinkClick(aEvent);
    Tabmix.contentAreaClick._data = null;
  },

  contentLinkClick: function TMP_contentLinkClick(aEvent) {
    if (aEvent.button != 0 || aEvent.shiftKey || aEvent.ctrlKey || aEvent.altKey || aEvent.metaKey)
      return;

    this.getPref();
    if (!this.currentTabLocked && targetPref == 0)
      return;

    let [href, linkNode] = hrefAndLinkNodeForClickEvent(aEvent);
    if (!linkNode)
      return;

    let targetAttr = this.getTargetAttr(linkNode);
    this.getData(aEvent, href, linkNode, targetAttr);

    var currentHref = gBrowser.currentURI ? gBrowser.currentURI.spec : "";
    try {
      // for the moment just do it for Google and Yahoo....
      var blocked = /google|yahoo.com\/search/.test(currentHref);
    } catch (ex) {blocked = false;}
    if (!blocked) {
      // replace onclick function with the form javascript:top.location.href = url
      // if the tab is locked or we force new tab from link
      let {onclick} = this._data;
      if ((this.currentTabLocked || targetPref == 1) && onclick) {
        let code = "javascript:top.location.href="
        if (this.checkAttr(href, "javascript:void(0)") && this.checkAttr(onclick, code))
          linkNode.setAttribute("onclick", onclick.replace(code, "var __tabmix.href="));
      }
      return;
    }

    // don't do anything on mail.google or google.com/reader
    var isGmail = /^(http|https):\/\/mail.google.com/.test(currentHref) || /^(http|https):\/\/\w*.google.com\/reader/.test(currentHref);
    if (isGmail)
      return;

    // don't interrupt with noscript
    if ("className" in linkNode && linkNode.className.indexOf("__noscriptPlaceholder__") > -1)
      return;

    // fix donwload button on page - http://get.adobe.com/reader/
    if ("className" in linkNode && /download.button/.test(linkNode.className))
      return;

    // need to find a way to work here only on links
    if ("className" in linkNode && /button/.test(linkNode.className.toLowerCase()))
      return;

    // don't interrupt with fastdial links
    if ("ownerDocument" in linkNode && Tabmix.isNewTabUrls(linkNode.ownerDocument.documentURI))
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

    /*
     * open targeted links in the current tab only if certain conditions are met.
     * See the function comment for more details.
     */
    if (this.divertTargetedLink())
      return;

    // open links to other sites in a tab only if certain conditions are met. See the
    // function comment for more details.
    var openNewTab = null;
    if (this.openExSiteLink())
      openNewTab = true;
    // when a tab is locked or preference is to open in new tab
    // we check that link is not a Javascript or have a onclick function
    else if (this.currentTabLocked || targetPref == 1)
      openNewTab = this.openTabfromLink();

    if (openNewTab) {
      let where = whereToOpenLink(aEvent);
      aEvent.__where = where == "tabshifted" ? "tabshifted" : "tab";
      handleLinkClick(aEvent, href, linkNode);
      aEvent.stopPropagation();
      aEvent.preventDefault();
    }
  },

  /**
   * @brief hock the proper Greasemonkey function into Tabmix.isGMEnabled
   */
  isGreasemonkeyInstalled: function TMP_isGreasemonkeyInstalled() {
    var GM_function;
    try {
      // Greasemonkey >= 0.9.10
      Components.utils.import("resource://greasemonkey/util.js");
      if ('function' == typeof GM_util.getEnabled) {
        GM_function = GM_util.getEnabled;
      }
    } catch (e) {
      // Greasemonkey < 0.9.10
      if ('function' == typeof GM_getEnabled) {
        GM_function = GM_getEnabled;
      }
    }

    if (typeof GM_function !=  "function")
      return;

    this.isGMEnabled = GM_function;
    this.isGreasemonkeyScript = function TMP_isGreasemonkeyScript(href) {
      if (this.isGMEnabled()) {
        if (href && href.match(/\.user\.js(\?|$)/i))
          return true;
      }
      return false;
    }
  },

  /**
   * @brief Suppress tabs that may be created by installing Greasemonkey script
   *
   * @returns             true if the link is a script.
   *
   */
  isGreasemonkeyScript: function (href) { return false; },

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
    if (/\w+\.google\.\D+\/search?/.test(gBrowser.currentURI.spec))
      return false;

    let {event, linkNode} = this._data;
    linkNode = linkNode.toString();

    // prevent link with "custombutton" protocol to open new tab when custombutton extension exist
    if (event.button != 2 && typeof(custombuttons) !='undefined'){
      if (this.checkAttr(linkNode, "custombutton://"))
        return true;
    }

    if (!Tabmix.prefs.getBoolPref("enablefiletype"))
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

    var filetype = Tabmix.prefs.getCharPref("filetype");
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
    if (!Tabmix.prefs.getBoolPref("middlecurrent"))
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
   * @brief Divert links that contain targets to the current tab.
   *
   * This function forces a link with a target attribute to open in the
   * current tab if the following conditions are true:
   *
   * - extensions.tabmix.linkTarget is true
   * - neither of the Ctrl/Meta keys were used AND the linkNode has a target attribute
   *   AND the content of the target attribute is not one of the special frame targets
   *   AND it is not present in the document frame pool
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
    if (!Tabmix.prefs.getBoolPref("linkTarget")) return false;
  ///XXX - check if we need to use here href
    let linkNode = this._data.linkNode.toString();
    if (this.checkAttr(linkNode, "javascript:") || // 2005-11-28 some link in Bloglines start with javascript
        this.checkAttr(linkNode, "data:"))
      return false;

    let {event} = this._data;
    if (event.ctrlKey || event.metaKey) return false;

    let {targetAttr} = this._data;
    if (!targetAttr) return false;
    var targetString = /^(_self|_parent|_top|_content|_main)$/;
    if (targetString.test(targetAttr.toLowerCase())) return false;

    let frames = document.commandDispatcher.focusedWindow.top.frames;
    if (this.existsFrameName(frames, targetAttr)) return false;

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
    if (this.targetPref != 2 || Tabmix.isNewTabUrls(gBrowser.currentURI.spec))
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
    if (Tabmix.isNewTabUrls(gBrowser.currentURI.spec))
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
      return gBrowser.currentURI.spec.split("#")[0] != linkNode.toString().split("#")[0];

    return null;
  },

  /**
   * @brief Test if target link is special Google.com link preferences , advanced_search ...
   *
   * @returns true it is Google special link false for all other links
   */
  GoogleComLink: function TMP_GoogleComLink() {
    var location = gBrowser.currentURI.spec;
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
   * @param containerFrame    The frame pool of the current document.
   * @param targetFrame       The name of the frame that we are seeking.
   * @returns                 true if the frame exists within the given frame pool,
   *                          false if it does not.
   */
  existsFrameName: function TMP_existsFrameName(containerFrame, targetFrame) {
    for (var i = 0; i < containerFrame.length; ++i) {
      if (containerFrame[i].name == targetFrame) return true;
      if (containerFrame[i].frames.length)
        var return_var = this.existsFrameName(containerFrame[i].frames,targetFrame);
    }

    if (return_var)
      return return_var;

    return false;
  },

  /**
   * @brief Checks to see if handleLinkClick reload an existing tab without
   *        focusing it for linke with target "_new".
   *
   */
  selectExistingTab: function TMP_selectExistingTab(href) {
    if (Tabmix.prefs.getIntPref("opentabforLinks") != 0 ||
        Services.prefs.getBoolPref("browser.tabs.loadInBackground"))
      return;
    function switchIfURIInWindow(aWindow) {
      // Only switch to the tab if both source and desination are
      // private or non-private.
      if (Tabmix.isVersion(200) &&
          PrivateBrowsingUtils.isWindowPrivate(window) !=
          PrivateBrowsingUtils.isWindowPrivate(aWindow)) {
        return false;
      }
      if (!("gBrowser" in aWindow))
        return false;
      let browsers = aWindow.gBrowser.browsers;
      for (let i = 0; i < browsers.length; i++) {
        let browser = browsers[i];
        if (browser.currentURI.spec == href &&
            browser.contentWindow.name == "_new") {
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
      let b = document.commandDispatcher.focusedWindow.document.getElementsByTagName("base");
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
        event.__href = makeURLAbsolute(linkNode.baseURI, str);
        return true;
      } catch (ex) {Tabmix.log(ex)}
    }
    return false;
  }
}
