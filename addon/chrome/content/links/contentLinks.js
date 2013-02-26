
Tabmix.contentAreaClick = {
  init: function TMP_CA_init() {
    Tabmix.changeCode(window, "contentAreaClick")._replace(
      'if (linkNode &&',
      'var targetAttr = Tabmix.contentAreaClick.getTargetAttr(linkNode);' +
      'var [where, suppressTabsOnFileDownload] =' +
      '      Tabmix.contentAreaClick.whereToOpen(event, linkNode, href, targetAttr);' +
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

    var targetPref = Tabmix.prefs.getIntPref("opentabforLinks");
    var linkTarget = Tabmix.prefs.getBoolPref("linkTarget");
    var suppressTabs = Tabmix.prefs.getBoolPref("enablefiletype");

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

    /*
     * prevents tab form opening when clicking Greasemonkey script
     */
    if (this.isGreasemonkeyScript(href))
      return ["default"];

    // Check if new tab already opened from onclick event // 2006-09-26
    if (linkNode.hasAttribute("onclick") && gBrowser.contentDocument.location.href != document.commandDispatcher.focusedWindow.top.location.href)
      return ["default"];

    if (linkNode.getAttribute("rel") == "sidebar" || targetAttr == "_search" ||
        href.indexOf("mailto:") > -1) {
      return ["default"];
    }

    /*
     * prevent tabs from opening if left-clicked link ends with given filetype or matches regexp;
     * portions were taken from disable target for downloads by cusser
     */
    if (this.suppressTabsOnFileDownload(event, href, linkNode, suppressTabs)) {
        // don't do anything if we are on gmail and let gmail take care of the download
        let url = gBrowser.currentURI ? gBrowser.currentURI.spec : "";
        let isGmail = /^(http|https):\/\/mail.google.com/.test(url);
        let isHttps = /^https/.test(href);
        if (isGmail || isHttps)
           return ["default", true];
        return ["current", true];
    }

    // Check if link refers to external domain.
    // Get current page url
    // if user click a link while the page is reloading linkNode.ownerDocument.location can be null
    var location = linkNode.ownerDocument.location;
    var curpage = location ? location.href || location.baseURI : gBrowser.currentURI.spec;
    var domain = this.checkDomain(curpage, window.XULBrowserWindow.overLink || linkNode);
    var targetDomain = domain.target;
    var currentDomain = domain.current;
    /*
     * force a middle-clicked link to open in the current tab if certain conditions
     * are true. See the function comment for more details.
     */
    if (this.divertMiddleClick(event, linkNode, gBrowser.mCurrentTab, currentDomain, targetDomain,
                              targetPref, Tabmix.prefs.getBoolPref("middlecurrent"))) {
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
    if (this.divertTargetedLink(event, linkNode, targetAttr,
                               document.commandDispatcher.focusedWindow.top.frames,
                               gBrowser.mCurrentTab, currentDomain, targetDomain,
                               targetPref, linkTarget)) {
      return ["current"];
    }

    /*
     * open links to other sites in a tab only if certain conditions are met. See the
     * function comment for more details.
     */
    if (this.openExSiteLink(linkNode, currentDomain, targetDomain, targetPref)) {
      return [TMP_tabshifted(event)];
    }

    if (gBrowser.mCurrentTab.hasAttribute("locked") || targetPref == 1) { // tab is locked
      let openNewTab = this.openTabfromLink(event, linkNode, href);
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
  },

  contentLinkClick: function TMP_contentLinkClick(aEvent) {
    if (aEvent.button != 0 || aEvent.shiftKey || aEvent.ctrlKey || aEvent.altKey || aEvent.metaKey)
      return;

    var targetPref = Tabmix.prefs.getIntPref("opentabforLinks");
    var tabLocked = gBrowser.mCurrentTab.hasAttribute("locked");
    if (!tabLocked && targetPref == 0)
      return;

    let [href, linkNode] = hrefAndLinkNodeForClickEvent(aEvent);
    if (!linkNode)
      return;

    let targetAttr = this.getTargetAttr(linkNode);

    var currentHref = gBrowser.currentURI ? gBrowser.currentURI.spec : "";
    try {
      // for the moment just do it for Google and Yahoo....
      var blocked = /google|yahoo.com\/search/.test(currentHref);
    } catch (ex) {blocked = false;}
    if (!blocked) {
      // replace onclick function with the form javascript:top.location.href = url
      // if the tab is locked or we force new tab from link
      if ((tabLocked || targetPref == 1) && linkNode.hasAttribute("onclick")) {
        let onclick = linkNode.getAttribute("onclick");
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
    if (this.suppressTabsOnFileDownload(aEvent, href, linkNode,
           Tabmix.prefs.getBoolPref("enablefiletype")))
      return;

    /*
     * open targeted links in the current tab only if certain conditions are met.
     * See the function comment for more details.
     *
     * Check if link refers to external domain.
     * Get current page url
     * if user click a link when the psage is reloading linkNode.ownerDocument.location can be null
     */
    var location = linkNode.ownerDocument.location;
    var curpage = location ? location.href || location.baseURI : gBrowser.currentURI.spec;
    var domain = this.checkDomain(curpage, window.XULBrowserWindow.overLink || linkNode);
    var targetDomain = domain.target;
    var currentDomain = domain.current;
    if (this.divertTargetedLink(aEvent, linkNode, targetAttr,
                              document.commandDispatcher.focusedWindow.top.frames,
                              gBrowser.mCurrentTab, currentDomain, targetDomain,
                              targetPref,
                              Tabmix.prefs.getBoolPref("linkTarget")))
      return;

    // open links to other sites in a tab only if certain conditions are met. See the
    // function comment for more details.
    var openNewTab = null;
    if (this.openExSiteLink(linkNode, currentDomain, targetDomain, targetPref))
      openNewTab = true;
    // when a tab is locked or preference is to open in new tab
    // we check that link is not a Javascript or have a onclick function
    else if (tabLocked || targetPref == 1)
      openNewTab = this.openTabfromLink(aEvent, linkNode, href);

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
   * @param event         A valid event union.
   * @param href          href string.
   * @param target        The target of the event.
   * @param linkNode      The DOM node containing the URL to be opened.
   * @param suppressTabs  A Boolean value that controls controlling how the link should be opened.
   * @returns             true if the link was handled by this function.
   *
   */
  suppressTabsOnFileDownload: function TMP_suppressTabsOnFileDownload(event, href, linkNode, suppressTabs) {
    // if we are in google search don't prevent new tab
    if (/\w+\.google\.\D+\/search?/.test(gBrowser.currentURI.spec))
      return false;

    // prevent link with "custombutton" protocol to open new tab when custombutton extension exist
    if (event.button != 2 && typeof(custombuttons) !='undefined'){
      if (this.checkAttr(linkNode.toString(), "custombutton://"))
        return true;
    }

    if (event.button != 0 || event.ctrlKey || event.metaKey || !suppressTabs)
      return false;

    // lets try not to look into links that start with javascript (from 2006-09-02)
    if (this.checkAttr(href, "javascript:"))
      return false;

    if (linkNode.hasAttribute("onclick")) {
      let onclick = linkNode.getAttribute("onclick");
      if (this.checkAttr(onclick, "return install") ||
         this.checkAttr(onclick, "return installTheme") ||
          this.checkAttr(onclick, "return note") || this.checkAttr(onclick, "return log")) // click on link in http://tinderbox.mozilla.org/showbuilds.cgi
        return true;
    }

    // prevent links in tinderbox.mozilla.org with linkHref to *.gz from open in this function
    if (this.checkAttr(linkNode.toString() , "http://tinderbox.mozilla.org/showlog") ||
      this.checkAttr(linkNode.toString() , "http://tinderbox.mozilla.org/addnote")) return false;

    return this.isUrlForDownload(href);
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
   * @param event          A valid event union.
   * @param linkNode       The DOM node containing the URL to open.
   * @param currentTab     A scripted tab object from the tabbrowser.
   * @param currentDomain  The domain name of the website URL in the current tab.
   * @param targetDomain   The domain name of the website URL in the link node.
   * @param targetPref     An integer value that specifies whether or not links should
   *                       be forced into new tabs.
   * @param middlePref     A Boolean value that controls how middle clicks are handled.
   * @returns              true if the function handled the click, false if it didn't.
   *
   */
  divertMiddleClick: function TMP_divertMiddleClick(event, linkNode, currentTab, currentDomain, targetDomain,
                                 targetPref, middlePref) {
    if (!middlePref)
      return false;

    var isTabLocked = targetPref == 1 || currentTab.hasAttribute("locked");
    var isDifDomain = targetPref == 2 && targetDomain &&
                      targetDomain != currentDomain;
    if (!isTabLocked && !isDifDomain)
      return false;

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
   * - linkTarget is set
   * - neither of the Ctrl/Meta keys were used AND the linkNode has a target attribute
   *   AND the content of the target attribute is not one of the special frame targets
   *   AND it is not present in the document frame pool
   * - links to other sites are not configured to open in new tabs AND the domain name
   *   of the current page and the domain name of the target page do not match
   * - the current tab is not locked
   * - the  domain name of the current page and the domain name of the target page
   *   do not match
   * - the target of the event has an onclick attribute that does not contain the
   *   function call 'window.open' or the function call 'return top.js.OpenExtLink'
   *
   * @param event            A valid event union.
   * @param linkNode         The DOM node containing the URL to be opened.
   * @param targetAttr       The target attribute of the link node.
   * @param frames           The frame pool of the current document.
   * @param currentTab       A scripted tab object from the tabbrowser.
   * @param currentDomain    The domain name of the website URL loaded in the current tab.
   * @param targetDomain     The domain name of the website URL to be loaded.
   * @param targetPref       An integer value that specifies whether or not links should
   *                         be forced into new tabs.
   * @param linkTarget       An integer value that specifies how normal links
   *                         that spawn new windows are handled.
   * @returns                true if the function handled the click, false if it didn't.
   *
   */
  divertTargetedLink: function TMP_divertTargetedLink(event, linkNode, targetAttr, frames,
                                  currentTab, currentDomain, targetDomain,
                                targetPref, linkTarget) {
    if (!linkTarget) return false;
    if (this.checkAttr(linkNode.toString(), "javascript:") || // 2005-11-28 some link in Bloglines start with javascript
        this.checkAttr(linkNode.toString(), "data:"))
      return false;

    if (event.ctrlKey || event.metaKey) return false;

    if (!targetAttr) return false;
    var targetString = /^(_self|_parent|_top|_content|_main)$/;
    if (targetString.test(targetAttr.toLowerCase())) return false;

    if (this.existsFrameName(frames, targetAttr)) return false;

    if (targetPref == 2 && targetDomain && targetDomain != currentDomain) return false;
    if (currentTab.hasAttribute("locked")) return false;
    if (targetDomain && targetDomain == currentDomain) return false;

    if (linkNode.hasAttribute("onclick")) {
      let onclick = linkNode.getAttribute("onclick");
      if (this.checkAttr(onclick, "window.open") ||
          this.checkAttr(onclick, "NewWindow") ||
          this.checkAttr(onclick, "PopUpWin") ||
          this.checkAttr(onclick, "return "))
        return false;
    }

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
   * @param event            A valid event union.
   * @param linkNode         The DOM node containing the URL to be opened.
   * @param currentDomain    The domain name of the website URL loaded in the current tab.
   * @param targetDomain     The domain name of the website URL to be loaded.
   * @param targetPref       An integer value that specifies whether or not links should
   *                         be forced into new tabs.
   * @returns                true to load link in new tab
   *                         false to load link in current tab
   *
   */
  openExSiteLink: function TMP_openExSiteLink(linkNode, currentDomain, targetDomain, targetPref) {
    if (targetPref != 2 || Tabmix.isNewTabUrls(gBrowser.currentURI.spec))
      return false;

///XXX if we check this in every function do it one time at the start
    if (linkNode.hasAttribute("onclick")) {
      let onclick = linkNode.getAttribute("onclick");
      if (this.checkAttr(onclick, "window.open") ||
          this.checkAttr(onclick, "NewWindow") ||
          this.checkAttr(onclick, "PopUpWin") ||
          this.checkAttr(onclick, "return "))
        return false;
    }
    if (targetDomain && targetDomain != currentDomain ||
        this.checkAttr(linkNode.getAttribute("onmousedown"), "return rwt"))
      return true;

    return false;
  },

  /**
   * @brief Open links in new tabs when tab is lock or preference is to always opne tab from links.
   *
   * @param event            A valid event union.
   * @param linkNode         The DOM node containing the URL to be opened.
   * @param href             href string.
   * @returns null if the caller need to handled the click,
              true to load link in new tab
              false to load link in current tab
   */
  openTabfromLink: function TMP_openTabfromLink(event, linkNode, href) {
    if (Tabmix.isNewTabUrls(gBrowser.currentURI.spec))
      return false;

    if (this.GoogleComLink(linkNode))
      return null;

    var onclick = null;
    if (href)
      href = href.toLowerCase();

    if (linkNode.hasAttribute("onclick"))
      onclick = linkNode.getAttribute("onclick");

    // we replcae in contentLinkClick the onclick javascript:top.location.href = url
    // with var __tabmix.href = url
    if (this.checkAttr(onclick, "var __tabmix.href=") &&
        this.getHrefFromOnClick(event, href, linkNode, "var __tabmix.href="))
      return "tab";

    if (this.checkAttr(href, "javascript:") ||
        this.checkAttr(href, "data:") ||
        this.checkAttr(onclick, "window.open") ||
        this.checkAttr(onclick, "openit") ||
        this.checkAttr(onclick, "NewWindow") ||
        this.checkAttr(onclick, "PopUpWin") ||
        (onclick && onclick.indexOf('this.target="_Blank"') != -1) ||
        (onclick && onclick.indexOf("return false") != -1) ||
        this.checkAttr(onclick, "return "))
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
   * @param linkNode         The DOM node containing the URL to be opened.
   * @returns true it is Google special link false for all other links
   */
  GoogleComLink: function TMP_GoogleComLink(linkNode) {
    var location = gBrowser.currentURI.spec;
    var currentIsnGoogle = /\/\w+\.google\.\D+\//.test(location);
    if (!currentIsnGoogle)
      return false;

    if (/calendar\/render/.test(location))
      return true;

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
    if (typeof(attr) == "string") return attr.indexOf(string) == 0;
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
  * @returns         current domain and target domain
  *
  */
  checkDomain: function TMP_checkDomain(curpage, target) {
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
    return {current: getDomain(curpage), target: getDomain(target)};
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
