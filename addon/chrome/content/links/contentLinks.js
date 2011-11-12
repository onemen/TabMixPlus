/*
 * chrome://tabmixplus/content/links/contentLinks.js
 *
 * original code by Bradley Chapman
 * modified and developped by Hemiola SUN
 * modified again by Bradley Chapman
 *
 */

/**
 * @brief Open the given link node in the current window.
 *
 * @param event		A valid event union.
 *
 * @param linkNode	The DOM node containing the URL to open.
 *
 * @param loadInCurrentTab	A Boolean value. If true, the URL will be opened
 *                 within the current tab. If false, it will be opened in a new tab.
 *
 * @param suppressTabsOnFileDownload	A Boolean value. If true, the URL will be opened
 *                         within the current tab. If false, according to loadInCurrentTab
 *                         this is mainly to prevent openLinkIn from opening new tab when link, for downloading file, click on pinned tab
 *
 * @returns  True if the function opened a URL, or the value
 *			of handleLinkClick() if it chose not to.
 *
 */
function TMP_howToOpen(event, linkNode, loadInCurrentTab, suppressTabsOnFileDownload) {
  // this helper function parses the event union for us
  // and makes a better determination of how a link will be opened
  var where = whereToOpenLink(event);
  if (where == "save" || where == "window" ) {
    handleLinkClick(event, linkNode.href, linkNode);
    return true;
  }
  where = loadInCurrentTab ? "current" : where == "tabshifted" ? where : "tab";
  var doc = event.target.ownerDocument;

  try {
    urlSecurityCheck(linkNode.href, doc.nodePrincipal);
  }
  catch(ex) {
    if (!Tabmix.isVersion(40))
      return false;
    // Prevent loading unsecure destinations.
    event.preventDefault();
    return true;
  }

  var postData = { };
  var url = getShortcutOrURI(linkNode.href, postData);
  if (!url)
    return true;

  if (where == "current")
    gBrowser.mCurrentBrowser.tabmix_allowLoad = true;
  if (Tabmix.isVersion(40))
    openLinkIn(url, where, {referrerURI: doc.documentURIObject, charset: doc.characterSet, suppressTabsOnFileDownload: suppressTabsOnFileDownload});
  else if (where == "current")
    openUILinkIn(url, where, false, postData.value, doc.documentURIObject)
  else
    window.openNewTabWith(url, doc, null, event, false);

  event.preventDefault();
  if (!Tabmix.isVersion(40))
    return !loadInCurrentTab;
  return true;
}

/**
 * @brief Check for certain JavaScript strings inside an attribute.
 *
 * @param attr			The attribute to check.
 * @param string		The string to check for.
 * @returns			true if the strings are present, false if they aren't.
 *
 */
function TMP_checkAttr(attr, string) {
   if (typeof(attr) == "string") return attr.indexOf(string) == 0;
   return false;
}

/**
 * @brief Check if link refers to external domain.
 *
 * @param target  The target link.
 * @param curpage  The current page url
 * @returns       current domain and target domain
 *
 */
function TMP_checkDomain(curpage, target) {
  function getDomain(url) {
    if (typeof(url) != "string")
      url = url.toString();

    if (url.match(/^file:/))
      return "local_file";

    if (url.match(/^http/)) {
      url = TabmixSvc.io.newURI(url, null, null);

      // catch redirect
      if (url.path.match(/^\/r\/\?http/))
        url = TabmixSvc.io.newURI(url.path.substr("/r/?".length), null, null);
      try {
        var eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"]
            .getService(Ci.nsIEffectiveTLDService);
        var publicSuffix = eTLDService.getPublicSuffixFromHost(url.hostPort);
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
}

function TMP_getClickTarget(aEvent) {
  function isHTMLLink(aNode){
    return aNode instanceof HTMLAnchorElement ||
           aNode instanceof HTMLAreaElement ||
           aNode instanceof HTMLLinkElement;
  }

  var target = aEvent.target;
  var linkNode;
  if (isHTMLLink(target)) {
    if (target.hasAttribute("href"))
      linkNode = target;
     // xxxmpc: this is kind of a hack to work around a Gecko bug (see bug 266932)
     // we're going to walk up the DOM looking for a parent link node,
     // this shouldn't be necessary, but we're matching the existing behaviour for left click
     var parent = target.parentNode;
     while (parent) {
       if (isHTMLLink(parent) && parent.hasAttribute("href"))
         linkNode = parent;
       parent = parent.parentNode;
     }
  }
  else {
    linkNode = aEvent.originalTarget;
    while (linkNode && !(linkNode instanceof HTMLAnchorElement))
      linkNode = linkNode.parentNode;
    // <a> cannot be nested.  So if we find an anchor without an
    // href, there is no useful <a> around the target
    if (linkNode && !linkNode.hasAttribute("href"))
      linkNode = null;
    else if (linkNode && linkNode.hasAttribute("href"))
      target = linkNode;
  }

  if (!linkNode)
    return [target];

  var openT = linkNode.getAttribute("target");
  // If link has no target attribute, check if there is a <base> with a target attribute
  if (!openT) {
    var b = document.commandDispatcher.focusedWindow.document.getElementsByTagName("base");
    if (b.length > 0)
      openT = b[0].getAttribute("target");
  }
  return [target, linkNode, openT];
}

/**
 * @brief Handle left-clicks on links when preference is to open new tabs from links
 *        links that are not handled here go on to the page code and then to contentAreaClick
 */
function TMP_contentLinkClick(aEvent) {
  if (aEvent.button != 0 || aEvent.shiftKey || aEvent.ctrlKey ||  aEvent.altKey || aEvent.metaKey)
    return;

  var targetPref = TabmixSvc.prefs.getIntPref("extensions.tabmix.opentabforLinks");
  var tabLocked = gBrowser.mCurrentTab.hasAttribute("locked");
  if (!tabLocked && targetPref == 0)
    return;

  var [target, linkNode, openT] = TMP_getClickTarget(aEvent);

  if (!linkNode)
    return;

  let href = target.ownerDocument.location.href;
  try {
    // for the moment just do it for Google and Yahoo....
    var blocked = /google|yahoo.com\/search/.test(href);
  } catch (ex) {blocked = false;}
  if (!blocked)
    return;

  // don't do anything on mail.google or google.com/reader
  var isGmail = /^(http|https):\/\/mail.google.com/.test(href) || /^(http|https):\/\/www.google.com\/reader/.test(href);
  if (isGmail)
    return;

  // don't interrupt with noscript
  if ("className" in target && target.className.indexOf("__noscriptPlaceholder__") > -1)
    return;

  // fix donwload button on page - http://get.adobe.com/reader/
  if ("className" in target && /download.button/.test(target.className))
    return;

  // need to find a way to work here only on links
  if ("className" in target && /button/.test(target.className.toLowerCase()))
    return;

  // don't interrupt with fastdial links
  if ("ownerDocument" in target && tabmix_isNewTabUrls(target.ownerDocument.documentURI))
    return;

  if (linkNode.getAttribute("rel") == "sidebar" || openT == "_search" ||
        linkNode.getAttribute("href").indexOf("mailto:") > -1)
    return;

  /*
   * prevents tab form opening when clicking Greasemonkey script
   */
  if (TMP_isGreasemonkeyScript(aEvent, target))
    return;

  /*
   * prevent tabs from opening if left-clicked link ends with given filetype or matches regexp;
   * portions were taken from disable target for downloads by cusser
   */
  if (TMP_suppressTabsOnFileDownload(aEvent, target, linkNode,
         TabmixSvc.prefs.getBoolPref("extensions.tabmix.enablefiletype")))
    return;

  /*
   * open targeted links in the current tab only if certain conditions are met.
   * See the function comment for more details.
   *
   * Check if link refers to external domain.
   * Get current page url
   * if user click a link when the psage is reloading linkNode.ownerDocument.location can be null
   */
  var curpage = linkNode.ownerDocument.location ? linkNode.ownerDocument.location.href : gBrowser.currentURI.spec;
  var domain = TMP_checkDomain(curpage, window.XULBrowserWindow.overLink || target);
  var targetDomain = domain.target;
  var currentDomain = domain.current;
  if (TMP_divertTargetedLink(aEvent, target, linkNode, openT,
                            document.commandDispatcher.focusedWindow.top.frames,
                            gBrowser.mCurrentTab, currentDomain, targetDomain,
                            targetPref,
                            TabmixSvc.prefs.getBoolPref("extensions.tabmix.linkTarget")))
    return;

  /*
   * open links to other sites in a tab only if certain conditions are met. See the
   * function comment for more details.
   */
  var openNewTab = null;
  if (TMP_openExSiteLink(aEvent, target, linkNode, currentDomain, targetDomain, targetPref))
    openNewTab = true;
  // when a tab is locked or preference is to open in new tab
  // we check that link is not a Javascript or have a onclick function
  else if (tabLocked || targetPref == 1)
    openNewTab = TMP_openTabfromLink(target);

  if (openNewTab) {
    TMP_howToOpen(aEvent, linkNode, false);
    aEvent.stopPropagation();
    aEvent.preventDefault();
  }
}

/**
 * @brief Handle left-clicks inside a browser viewport.
 *
 * This function is the primary entry point for all left-clicks on a browser
 * page; we triage and sort such clicks and handle the ones we want and pass
 * on the ones that we don't.
 *
 * @param event			A valid event union.
 * @param fieldNormalClicks	A Boolean value. If true, we will handle all left-clicks
 *				that invoke this function. If false, we will only handle
 *				the ones that require additional legwork (i.e. locked tabs).
 * @returns			Either the return value of TMP_original_contentAreaClick(), or the
 *				return value of handleLinkClick(), or true if the function
 *				was passed an event it could not handle.
 */
function TMP_contentAreaClick(event, fieldNormalClicks) {
  var targetPref = TabmixSvc.prefs.getIntPref("extensions.tabmix.opentabforLinks");
  var linkTarget = TabmixSvc.prefs.getBoolPref("extensions.tabmix.linkTarget");
  var suppressTabs = TabmixSvc.prefs.getBoolPref("extensions.tabmix.enablefiletype");

  if (!event.isTrusted || event.getPreventDefault()) {
     return true;
  }

  if (typeof(SubmitToTab) != 'undefined') {
    let target = event.target;
    if (target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement) {
      if (SubmitToTab.contentAreaClick(event) == false) {
        return false;
      }
    }
  }

  var [target, linkNode, openT] = TMP_getClickTarget(event);
  if (!linkNode)
    return TMP_original_contentAreaClick(event, fieldNormalClicks);

  // Check if new tab already opened from onclick event // 2006-09-26
  if (target.hasAttribute("onclick") && gBrowser.contentDocument.location.href != document.commandDispatcher.focusedWindow.top.location.href)
    return true;

  if (linkNode.getAttribute("rel") == "sidebar" ||
      openT == "_search" ||
      linkNode.getAttribute("href").indexOf("mailto:") > -1) {
    return TMP_original_contentAreaClick(event, fieldNormalClicks);
  }

  /*
   * prevents tab form opening when clicking Greasemonkey script
   */
  if (TMP_isGreasemonkeyScript(event, target))
    return true;

  /*
   * prevent tabs from opening if left-clicked link ends with given filetype or matches regexp;
   * portions were taken from disable target for downloads by cusser
   */
  if (TMP_suppressTabsOnFileDownload(event, target, linkNode, suppressTabs)) {
      // don't do anything if we are on gmail and let gmail take care of the download
      var isGmail = /^(http|https):\/\/mail.google.com/.test(target.ownerDocument.location.href);
      var isHttps = /^https/.test(target);
      if (isGmail || isHttps)
         return true;

      return TMP_howToOpen(event, linkNode, true, true);
  }

  // Check if link refers to external domain.
  // Get current page url
  // if user click a link when the psage is reloading linkNode.ownerDocument.location can be null
  var curpage = linkNode.ownerDocument.location ? linkNode.ownerDocument.location.href : gBrowser.currentURI.spec;
  var domain = TMP_checkDomain(curpage, window.XULBrowserWindow.overLink || target);
  var targetDomain = domain.target;
  var currentDomain = domain.current;
  /*
   * force a middle-clicked link to open in the current tab if certain conditions
   * are true. See the function comment for more details.
   */
  if (TMP_divertMiddleClick(event, linkNode, gBrowser.mCurrentTab, currentDomain, targetDomain,
                            targetPref, TabmixSvc.prefs.getBoolPref("extensions.tabmix.middlecurrent"))) {
    return TMP_howToOpen(event, linkNode, true);
  }

  // catch other middle & right click
  if (event.button != 0) {
    handleLinkClick(event, linkNode.href, linkNode);
    return true;
  }

  // the rest of the code if for left-click only

  /*
   * open targeted links in the current tab only if certain conditions are met.
   * See the function comment for more details.
   */
  if (TMP_divertTargetedLink(event, target, linkNode, openT,
                             document.commandDispatcher.focusedWindow.top.frames,
                             gBrowser.mCurrentTab, currentDomain, targetDomain,
                             targetPref, linkTarget)) {
    return TMP_howToOpen(event, linkNode, true);
  }

  /*
   * open links to other sites in a tab only if certain conditions are met. See the
   * function comment for more details.
   */
  if (TMP_openExSiteLink(event, target, linkNode, currentDomain, targetDomain, targetPref)) {
    return TMP_howToOpen(event, linkNode, false);
  }

  if (gBrowser.mCurrentTab.hasAttribute("locked") || targetPref == 1) { // tab is locked
    let openNewTab = TMP_openTabfromLink(target);
    if (openNewTab != null)
      return TMP_howToOpen(event, linkNode, !openNewTab);
  }
  // use whereToOpenLink() to determine if no modifiers were used
  else if (whereToOpenLink(event) == "current") {
      if (fieldNormalClicks && (!openT || openT == "_content" || openT  == "_main"))
        return TMP_original_contentAreaClick(event, fieldNormalClicks);
      else if (linkNode.hasAttribute("onclick"))
        return TMP_original_contentAreaClick(event, fieldNormalClicks);
    else if (openT) {
      let result = handleLinkClick(event, linkNode.href, linkNode);
      if (openT != "_new" || result)
        return true;
      if (targetPref == 0 &&
           !TabmixSvc.prefs.getBoolPref("browser.tabs.loadInBackground")) {
        function switchIfURIInWindow(aWindow) {
          if (!("gBrowser" in aWindow))
            return false;
          let browsers = aWindow.gBrowser.browsers;
          for (let i = 0; i < browsers.length; i++) {
            let browser = browsers[i];
            if (browser.currentURI.spec == linkNode.href &&
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
          return true;

        let winEnum = Services.wm.getEnumerator("navigator:browser");
        while (winEnum.hasMoreElements()) {
          let browserWin = winEnum.getNext();
          if (browserWin.closed || browserWin == window)
            continue;
          if (switchIfURIInWindow(browserWin))
            return true;
        }
      }
    }
  }
  else
    handleLinkClick(event, linkNode.href, linkNode);

  return true;
}

/**
 * @brief hock the proper Greasemonkey function into Tabmix.isGMEnabled
 */
function TMP_isGreasemonkeyInstalled() {
  try {
    // Greasemonkey >= 0.9.10
    Components.utils.import("resource://greasemonkey/util.js");
    if ('function' == typeof GM_util.getEnabled) {
      Tabmix.isGMEnabled = GM_util.getEnabled;
      return;
    }
  } catch (e) {
    // Greasemonkey < 0.9.10
    if ('function' == typeof GM_getEnabled) {
      Tabmix.isGMEnabled = GM_getEnabled;
      return;
    }
  }

  TMP_isGreasemonkeyScript = function (a,b) { return false; }
}

/**
 * @brief Suppress tabs that may be created by installing Greasemonkey script
 *
 * @returns             true if the link is a script.
 *
 */
function TMP_isGreasemonkeyScript(event, target) {
  if (event.button == 2)
    return false;

  if (Tabmix.isGMEnabled()) {
    let url = target.getAttribute("href");
    if (url && url.match(/\.user\.js(\?|$)/i))
      return true;
  }

  return false;
}

/**
 * @brief Suppress tabs that may be created by downloading a file.
 *
 * This code borrows from Cusser's Disable Targets for Downloads extension.
 *
 * @param event         A valid event union.
 * @param target        The target of the event.
 * @param linkNode      The DOM node containing the URL to be opened.
 * @param suppressTabs  A Boolean value that controls controlling how the link should be opened.
 * @returns             true if the link was handled by this function.
 *
 */
function TMP_suppressTabsOnFileDownload(event, target, linkNode, suppressTabs) {
   // prevent link with "custombutton" protocol to open new tab when custombutton extension exist
   if (event.button != 2 && typeof(custombuttons) !='undefined'){
      if (TMP_checkAttr(linkNode.toString(), "custombutton://"))
         return true;
   }

   if (event.button != 0 || event.ctrlKey || event.metaKey || !suppressTabs)
      return false;

   // lets try not to look into links that start with javascript (from 2006-09-02)
   if (TMP_checkAttr(linkNode.toString(), "javascript:"))
      return false;

   if (target.hasAttribute("onclick")) {
      var onclick = target.getAttribute("onclick");
      if (TMP_checkAttr(onclick, "return install") ||
          TMP_checkAttr(onclick, "return installTheme") ||
          TMP_checkAttr(onclick, "return note") || TMP_checkAttr(onclick, "return log")) // click on link in http://tinderbox.mozilla.org/showbuilds.cgi
         return true;
   }

   // prevent links in tinderbox.mozilla.org with linkHref to *.gz from open in this function
   if (TMP_checkAttr(linkNode.toString() , "http://tinderbox.mozilla.org/showlog") ||
      TMP_checkAttr(linkNode.toString() , "http://tinderbox.mozilla.org/addnote")) return false;

   return TMP_isUrlForDownload(target.getAttribute("href"));
}

function TMP_isUrlForDownload(linkHref) {
   //we need this check when calling from onDragOver and onDrop
   if (linkHref.indexOf("mailto:") == 0)
     return true;

   var filetype = TabmixSvc.prefs.getCharPref("extensions.tabmix.filetype");
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
}

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
 * @param event			A valid event union.
 * @param linkNode		The DOM node containing the URL to open.
 * @param currentTab		A scripted tab object from the tabbrowser.
 * @param currentDomain		The domain name of the website URL in the current tab.
 * @param targetDomain		The domain name of the website URL in the link node.
 * @param targetPref		An integer value that specifies whether or not links should
 *				be forced into new tabs.
 * @param middlePref		A Boolean value that controls how middle clicks are handled.
 * @returns			true if the function handled the click, false if it didn't.
 *
 */
function TMP_divertMiddleClick(event, linkNode, currentTab, currentDomain, targetDomain,
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
}

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
 * @param target           The target of the event.
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
function TMP_divertTargetedLink(event, target, linkNode, targetAttr, frames,
                                currentTab, currentDomain, targetDomain,
                                targetPref, linkTarget) {
  if (!linkTarget) return false;
  if (TMP_checkAttr(linkNode.toString(), "javascript:") || // 2005-11-28 some link in Bloglines start with javascript
      TMP_checkAttr(linkNode.toString(), "data:"))
    return false;

  if (event.ctrlKey || event.metaKey) return false;

  if (!targetAttr) return false;
  var targetString = /^(_self|_parent|_top|_content|_main)$/;
  if (targetString.test(targetAttr.toLowerCase())) return false;

  if (TMP_existsFrameName(frames, targetAttr)) return false;

  if (targetPref == 2 && targetDomain && targetDomain != currentDomain) return false;
  if (currentTab.hasAttribute("locked")) return false;
  if (targetDomain && targetDomain == currentDomain) return false;

  if (target.hasAttribute("onclick")) {
    var onclick = target.getAttribute("onclick");
    if (TMP_checkAttr(onclick, "window.open") ||
        TMP_checkAttr(onclick, "NewWindow") ||
        TMP_checkAttr(onclick, "PopUpWin") ||
        TMP_checkAttr(onclick, "return "))
          return false;
  }

  return true;
}

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
 * @param event             A valid event union.
 * @param target           The target of the event.
 * @param linkNode         The DOM node containing the URL to be opened.
 * @param currentDomain    The domain name of the website URL loaded in the current tab.
 * @param targetDomain     The domain name of the website URL to be loaded.
 * @param targetPref       An integer value that specifies whether or not links should
 *                         be forced into new tabs.
 * @returns                true if the function handled the click, false if it didn't.
 *
 */
function TMP_openExSiteLink(event, target, linkNode, currentDomain, targetDomain, targetPref) {
  if (targetPref != 2) return false;

  if (target.hasAttribute("onclick")) {
    var onclick = target.getAttribute("onclick");
    if (TMP_checkAttr(onclick, "window.open") ||
        TMP_checkAttr(onclick, "NewWindow") ||
        TMP_checkAttr(onclick, "PopUpWin") ||
        TMP_checkAttr(onclick, "return "))
            return false;
  }
  if (targetDomain && targetDomain != currentDomain ||
     TMP_checkAttr(target.getAttribute("onmousedown"), "return rwt"))
    return true;

  return false;
}

/**
 * @brief Open links in new tabs when tab is lock or preference is to always opne tab from links.
 *
 * @param  target  The target of the event.
 * @returns null if the caller need to handled the click,
                    true to load link in new tab
                    false to load link in current tab
 */
function TMP_openTabfromLink(target) {
    if (TMP_GoogleComLink(target))
      return null;

    var href = null, onclick = null;
    if (target.hasAttribute("href"))
      href = target.getAttribute("href").toLowerCase();
    if (target.hasAttribute("onclick"))
      onclick = target.getAttribute("onclick");
    if (TMP_checkAttr(href, "javascript:") ||
        TMP_checkAttr(href, "data:") ||
        TMP_checkAttr(onclick, "window.open") ||
        TMP_checkAttr(onclick, "openit") ||
        TMP_checkAttr(onclick, "NewWindow") ||
        TMP_checkAttr(onclick, "PopUpWin") ||
        (onclick && onclick.indexOf('this.target="_Blank"') != -1) ||
        (onclick && onclick.indexOf("return false") != -1) ||
        TMP_checkAttr(onclick, "return "))
      ; // javascript links, do nothing!
    else
      return gBrowser.currentURI.spec.split("#")[0] != target.toString().split("#")[0];

    return null;
}

/**
 * @brief Test if target link is special Google.com link preferences , advanced_search ...
 *
 * @param  target  The target of the event.
 * @returns true is it is Google special link false for all other links
 */
function TMP_GoogleComLink(target) {
  var location = gBrowser.currentURI.spec;
  var currentIsnGoogle = /google.co/.test(location);
  if (!currentIsnGoogle)
    return false;

  if (/\/intl\/\D{2,}\/options\//.test(target.pathname))
    return true;

  let _list = ["/preferences", "/advanced_search", "/language_tools", "/profiles",
               "/accounts/Logout", "/accounts/ServiceLogin"];

  let testPathname = _list.indexOf(target.pathname) > -1;
  if (testPathname)
    return true;

  let _host = ["profiles.google.com", "accounts.google.com"];
  let testHost = _host.indexOf(target.host) > -1;
  if (testHost)
    return true;

  return false;
}

/**
 * @brief Check a document's frame pool and determine if
 * |targetFrame| is located inside of it.
 *
 * @param containerFrame	The frame pool of the current document.
 * @param targetFrame		The name of the frame that we are seeking.
 * @returns			true if the frame exists within the given frame pool,
 *				false if it does not.
 */
function TMP_existsFrameName(containerFrame, targetFrame) {
    for (var i = 0; i < containerFrame.length; ++i) {
          if (containerFrame[i].name == targetFrame) return true;
          if (containerFrame[i].frames.length) var return_var = TMP_existsFrameName(containerFrame[i].frames,targetFrame);
    }

    if (return_var) return return_var;
    return false;
}

/**
 * @brief Locate a browser window.
 *
 * @param aExclude	A scripted window object that we do not
 *			want to use.
 * @returns		A scripted window object representing a browser
 *			window that is not the same as aExclude, and is
 *			additionally not a popup window.
 *
 */
function TMP_getBrowserWindow(aExclude) {
    var windows = TabmixSvc.wm.getEnumerator('navigator:browser');

    while (windows.hasMoreElements()) {
        var win = windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
        if (TMP_checkForPopup(win.QueryInterface(Components.interfaces.nsIDOMWindow)))
            continue;

        // this returns the first window that we find; it is not exhaustive
        if (win != aExclude) return win;
    }
    return null;
}

/**
 * @brief Checks to see if a given nsIDOMWindow window is a popup or not.
 *
 * @param domWindow	   A scripted nsIDOMWindow object.
 * @return		   true if the domWindow is a popup, false otherwise.
 *
 */
function TMP_checkForPopup(domWindow) {
  if (!(domWindow instanceof Components.interfaces.nsIDOMWindow)) return false;

  // FIXME: locationbar, menubar, toolbar -
  // if these are hidden the window is probably a popup
  var locbarHidden = !domWindow.locationbar.QueryInterface(Components.interfaces.nsIDOMBarProp).visible;
  var menubarHidden = !domWindow.menubar.QueryInterface(Components.interfaces.nsIDOMBarProp).visible;
  try {
     var toolbarHidden = !domWindow.toolbar.QueryInterface(Components.interfaces.nsIDOMBarProp).visible;
  }
  catch (e) {
   toolbarHidden = "hidden" in domWindow.toolbar ? domWindow.toolbar.hidden : false;
  }

  // the following logic, while possibly slow, is designed
  // to catch all reasonable permutations of hidden UI
  if ((locbarHidden && menubarHidden) ||
      (menubarHidden && toolbarHidden) ||
      (locbarHidden && menubarHidden && toolbarHidden)) {
    return true;
  }

  return false;
}

/*
 * handle all DOM window open events and catch attempts to open new windows
 *
 * PRECONDITION: None.
 * POSTCONDITION: None.
 *
 */
var TMP_DOMWindowOpenObserver = {
    newWindow : function(aWindow) {
        Tabmix.singleWindowMode = TabmixSvc.TMPprefs.getBoolPref("singleWindow");
        gTMPprefObserver.setLink_openPrefs();
        if (!Tabmix.singleWindowMode)
          return;

        var existingWindow = TMP_getBrowserWindow(aWindow);
        // no navigator:browser window open yet?
        if (!existingWindow)
          return;

        // hide the new window
        aWindow.resizeTo(10, 10);
        aWindow.moveTo(-50, -50);
        var win = aWindow.document.getElementById("main-window");
        win.removeAttribute("sizemode");
        if (!Tabmix.isVersion(36)) {
          win.setAttribute("width" , 0);
          win.setAttribute("height" , 0);
          win.setAttribute("screenX" , aWindow.screen.availWidth + 10);
          win.setAttribute("screenY" , aWindow.screen.availHeight + 10);
        }
    },

    onObserve : function(aSubject, aThis) {
        var newWindow = aSubject;
        var existingWindow = TMP_getBrowserWindow(newWindow);
        // no navigator:browser window open yet?
        if (!existingWindow)
          return;

        // if the href is missing, try again later (xxx)
        if (!newWindow.location.href) {
            existingWindow.setTimeout(aThis.onObserve, 0, newWindow, aThis);
            return;
        }

        // we don't want to open non-browser windows in a tab
        if(newWindow.location.href != "chrome://browser/content/browser.xul")
            return;

        if ( !('arguments' in newWindow) || newWindow.arguments.length == 0 )
          return;
        var args = newWindow.arguments;

        var existingBrowser = existingWindow.gBrowser;
        existingWindow.tablib.init(); // just in case tablib isn't init yet
        var uriToLoad = args[0];
        var urls = [];
        var [referrerURI, postData, allowThirdPartyFixup] = [null, null, false];
        if (uriToLoad instanceof Components.interfaces.nsISupportsArray) {
           let count = uriToLoad.Count();
           for (var i = 0; i < count; i++) {
              let urisstring = uriToLoad.GetElementAt(i).QueryInterface(Components.interfaces.nsISupportsString);
              urls.push(urisstring.data);
           }
        }
        else if (uriToLoad instanceof XULElement) {
          // some extension try to swap a tab to new window
          // we don't do anything in this case.
          // just close the new window
        }
        else if (args.length >= 3) {
           referrerURI = args[2];
           postData = args[3] || null;
           allowThirdPartyFixup = args[4] || false;
           urls = [uriToLoad];
        }
        else
          urls = uriToLoad.split("|");
        try {
          // open the tabs in current window
          if (urls.length) {
            var firstTabAdded = existingBrowser.addTab(urls[0], referrerURI, null, postData, null, allowThirdPartyFixup);
            for (let i = 1; i < urls.length; ++i)
              existingBrowser.addTab(urls[i]);
          }
        }  catch(ex) {  }
        try {
          // we need to close the window after timeout so other extensions don't fail.
          // if we don't add this here BrowserShutdown fails
          newWindow.FullZoom.init = function() {};
          newWindow.FullZoom.destroy = function() {};
          newWindow.PlacesStarButton.updateState = function() {};
          newWindow.PlacesStarButton.uninit = function() {};
          newWindow.OfflineApps.uninit = function() {};
          var obs = TabmixSvc.obs;
          obs.addObserver(newWindow.gSessionHistoryObserver, "browser:purge-session-history", false);
          if (Tabmix.isVersion(40)) {
            obs.addObserver(newWindow.gFormSubmitObserver, "invalidformsubmit", false);
            IndexedDBPromptHelper.init();
            obs.addObserver(newWindow.gXPInstallObserver, "addon-install-blocked", false);
            obs.addObserver(newWindow.gXPInstallObserver, "addon-install-failed", false);
            obs.addObserver(newWindow.gXPInstallObserver, "addon-install-complete", false);
            obs.addObserver(newWindow.gPluginHandler.pluginCrashed, "plugin-crashed", false);
          }
          else {
            TMP_delayedStartup = function() {};
            obs.addObserver(newWindow.gXPInstallObserver, "xpinstall-install-blocked", false);
            if (Tabmix.isVersion(36))
              obs.addObserver(newWindow.gMissingPluginInstaller, "plugin-crashed", false);

            newWindow.gAutoHideTabbarPrefListener = {domain: ""}
          }
         newWindow.gPrivateBrowsingUI.uninit = function() {};

         setTimeout(function () {
           newWindow.close();
           if (firstTabAdded)
             existingBrowser.selectedTab = firstTabAdded;
           else
             existingWindow.content.focus();
         },0)
        }  catch(ex) { existingWindow.Tabmix.obj(ex); }
    }
}
// end of TMP_DOMWindowOpenObserver
