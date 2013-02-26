/**
 * chrome://tabmixplus/content/links/userInterface.js
 *
 * original code by Bradley Chapman
 * modified and developped by Hemiola SUN
 * modified again by Bradley Chapman
 *
 * modified again and again... by onemen
 *
 */

Tabmix.openOptionsDialog = function TMP_openDialog(panel) {
  var windowMediator = Services.wm;
  var tabmixOptionsWin = windowMediator.getMostRecentWindow("mozilla:tabmixopt");
  if (tabmixOptionsWin) {
    var appearanceWin = windowMediator.getMostRecentWindow("mozilla:tabmixopt-appearance");
    var filetypeWin = windowMediator.getMostRecentWindow("mozilla:tabmixopt-filetype");
    var promptWin = windowMediator.getMostRecentWindow("mozilla:tabmixprompt");

    if (panel > -1 && !appearanceWin && !filetypeWin && !promptWin)
      tabmixOptionsWin.TM_selectTab(panel);

    tabmixOptionsWin.gIncompatiblePane.checkForIncompatible(false);

    (appearanceWin || filetypeWin || promptWin || tabmixOptionsWin).focus();
  }
  else {
    if(panel > -1)
      Tabmix.prefs.setIntPref("selected_tab", panel);

    window.openDialog("chrome://tabmixplus/content/pref/pref-tabmix.xul", "Tab Mix Plus", "chrome,titlebar,toolbar,close,dialog=no");
  }
}

/**
 * @brief Load URLs from the Extension/Theme Managers, and item with text-link class
 *
 * This redefines chrome://mozapps/content/extensions/extensions.js:openURL()
 *
 * @param aURL       A valid URI string.
 * @param event      A valid event union. This can be null when
 *                   calling this function.
 * @return           true.
 *
 */
Tabmix.openURL = function TMP_openURL(aURL, event) {
   var linkTarget, loadInBackground;
   try {
            linkTarget = Services.prefs.getIntPref("browser.link.open_newwindow");
   }
   catch (e) {
      linkTarget = 1;
   }

   if (aURL == null) aURL = "about:blank";

   // check for an existing window and focus it; it's not application modal
   var browserWindow = this.getTopWin();

   if (!browserWindow) {
      openDialog("chrome://browser/content/browser.xul", "_blank", "chrome,all,dialog=no", aURL, null, null, null);
      if (event && event instanceof Event) {
         event.preventDefault();
         event.stopPropagation();
      }
      return true;
   }

   var tabBrowser = browserWindow.gBrowser;
   var originCharset = tabBrowser.contentDocument.characterSet;

   // if the current tab is empty, then do not open a new tab
   if (tabBrowser.currentURI.spec == "about:blank") {
      // 1: CURRENT_TAB
      linkTarget = 1;
      originCharset = null;
   }

      switch (linkTarget) {
         case 1 :
            tabBrowser.loadURI(aURL, null, originCharset);
            break;
         case 2 :
            browserWindow.openNewWindowWith(aURL, null, null, false);
            break;
         case 3 :
            // added by request, for extensions with multiple homepages
            browserWindow.Tabmix.loadTabs(aURL.split("|"), false);
            break;
      }

   if (event && event instanceof Event) {
      event.preventDefault();
      event.stopPropagation();
   }
   return true;
}

// Don't change this function name other extensions using it
// Speed-Dial, Fast-Dial, TabGroupManager
function TMP_BrowserOpenTab(aTab, replaceLastTab) {
   var newTabContent = replaceLastTab ? Tabmix.prefs.getIntPref("replaceLastTabWith.type") :
                                        Tabmix.prefs.getIntPref("loadOnNewTab.type");
   var url;
   var newTabUrl = Tabmix.newTabURL;
   switch (newTabContent) {
      case 0 : // blank tab, by default
         url = "about:blank";
         break;
      case 1 :  // home page
         url = gHomeButton.getHomePage().split("|")[0];
         break;
      case 2 : // current URI
         var currentURI = gBrowser.currentURI;
         url = currentURI ? currentURI.spec : newTabUrl;
         break;
      case 3 : // duplicate tab
         let currentUrl = gBrowser.currentURI.spec;
         let newTab = gBrowser.duplicateTab(gBrowser.mCurrentTab, null, null, null, true);
         Tabmix.clearUrlBar(newTab, currentUrl, true);
         return newTab;
         break;
      case 4 : // user url
         let prefName;
         if (replaceLastTab) {
           prefName = typeof isBlankPageURL == "function" ?
                "extensions.tabmix.replaceLastTabWith.newtab.url" :
                "extensions.tabmix.replaceLastTabWith.newTabUrl"
         }
         else
           prefName = Tabmix.newTabURLpref;
         try {
            url = Services.prefs.getComplexValue(prefName, Ci.nsISupportsString).data;
            if (newTabUrl == "about:privatebrowsing" && url == "about:newtab")
              url = "about:privatebrowsing";
         } catch (ex) {  Tabmix.assert(ex); }
         // use this if we can't find the pref
         if (!url)
            url = newTabUrl;
         break;
      default:
         url = newTabUrl;
   }
   var flags = nsIWebNavigation.LOAD_FLAGS_NONE;
   // if google.toolbar extension installed check google.toolbar.newtab pref
   if ("GTB_GoogleToolbarOverlay" in window) {
     try {
       if (Services.prefs.getBoolPref("google.toolbar.newtab")) {
         url = "chrome://google-toolbar/content/new-tab.html";
         flags = nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY
       }
     } catch (ex) {/* no pref - do noting */}
   }
   if ((TabmixTabbar.widthFitTitle || !Tabmix.isVersion(60)) && replaceLastTab && !gBrowser.mCurrentTab.collapsed)
     gBrowser.mCurrentTab.collapsed = true;

   var loadBlank = Tabmix.isBlankPageURL(url);
   var _url = loadBlank ? url : "about:blank";
   var newTab = replaceLastTab ? gBrowser.addTab(_url, {skipAnimation: true}) : gBrowser.addTab(_url);
   if (replaceLastTab) {
     newTab.__newLastTab = url;
     if (Services.prefs.getCharPref("general.skins.selectedSkin") == "Vista-aero" ) {
       gBrowser.selectedTab = newTab;
       gBrowser.updateCurrentBrowser();
     }
     if (loadBlank) {
       gBrowser.tabContainer.setAttribute("closebuttons", "noclose");
       gBrowser.tabContainer.removeAttribute("closebuttons-hover");
     }
   }

   if (!loadBlank) {
      try { // just in case.....
         let browser = newTab.linkedBrowser;
         browser.stop();
         let originCharset = gBrowser.contentDocument.characterSet;
         browser.loadURIWithFlags(url, flags, null, originCharset);
         gBrowser.selectedBrowser.focus();
      }
      catch (ex) {}
   }
   if (aTab && aTab.localName == "tab")
      gBrowser.moveTabTo(newTab, aTab._tPos + 1);
   else if (!replaceLastTab && Tabmix.prefs.getBoolPref("openNewTabNext")) {
      // we used to move tab after lastRelatedTab but we don't need it on new tabs
      // and it mess with recently used tabs order
      gBrowser.moveTabTo(newTab, gBrowser.selectedTab._tPos + 1);
   }

   // always select new tab when replacing last tab
   var loadInBackground  = replaceLastTab ? false : Tabmix.prefs.getBoolPref("loadNewInBackground");
   gBrowser.TMP_selectNewForegroundTab(newTab, loadInBackground);
   // make sure to update recently used tabs
   // if user open many tabs quickly select event don't have time to fire
   // before new tab select
   if (!loadInBackground)
     TMP_LastTab.PushSelectedTab();

   // focus the address bar on new tab
   var clearUrlBar = !replaceLastTab && Tabmix.prefs.getBoolPref("selectLocationBar") ||
       replaceLastTab && Tabmix.prefs.getBoolPref("selectLocationBar.afterLastTabClosed") ||
       loadBlank;
   if (clearUrlBar)
     Tabmix.clearUrlBar(newTab, url);

   return newTab;
}

Tabmix.clearUrlBar = function TMP_clearUrlBar(aTab, aUrl, aTimeOut) {
  if(/about:home|(www\.)*(google|bing)\./.test(aUrl))
    return;
  if (!Tabmix.isBlankPageURL(aUrl)) {
    // clean the the address bar as if the user laod about:blank tab
    gBrowser.tabmix_tab = aTab;
    gBrowser.tabmix_userTypedValue = aUrl;
    gBrowser.userTypedValue = "";
  }
  if (aTab == gBrowser.mCurrentTab) {
    if (aTimeOut)
      setTimeout(function () {focusAndSelectUrlBar();}, 30);
    else
      focusAndSelectUrlBar();
  }
}

/**
 * @brief In TMP_BrowserOpenTab we empty and focus the urlbar
 *        if the user or onload from a page blur the urlbar befroe user typed new value
 *        we restore the current url
 */
Tabmix.urlBarOnBlur = function TMP_urlBarOnBlur() {
  if (Tabmix.isBlankPageURL(gURLBar.value))
    gURLBar.value = "";
  if (!gBrowser.tabmix_tab)
    return;

  var isCurrentTab = gBrowser.tabmix_tab == gBrowser.mCurrentTab;
  var browser = gBrowser.getBrowserForTab(gBrowser.tabmix_tab);
  var url = gBrowser.tabmix_userTypedValue;
  if (!Tabmix.isBlankPageURL(url))
    browser.userTypedValue = url;
  if (isCurrentTab && gBrowser.mIsBusy) {
    browser.addEventListener("load", function TMP_onLoad_urlBarOnBlur(aEvent) {
      aEvent.currentTarget.removeEventListener("load", TMP_onLoad_urlBarOnBlur, true);
      Tabmix.updateUrlBarValue();
    }, true);
    return;
  }

  this.updateUrlBarValue()
}

Tabmix.updateUrlBarValue = function TMP_updateUrlBarValue() {
  var url = gBrowser.currentURI.spec;
  if (url != gURLBar.value && !Tabmix.isBlankPageURL(url)) {
    gURLBar.value = gBrowser.userTypedValue = url;
  }
  delete gBrowser.tabmix_tab;
  delete gBrowser.tabmix_userTypedValue;
}

/**
 * @brief Load URLs from the URL bar.
 *
 * @param event         A valid event union.
 * @param aPostData     Additional opaque data used by Tabmix.__loadURLBar().
 * @param altDisabled   parameter set by URL Suffix extension, to prevent ALT from opening new tab
 * @param aUrl          aUrl , url to load.
 * @param mayInheritPrincipal
                        when false prevent any loads from inheriting the currently loaded document's principal
 * @return              Nothing.
 *
 *
 * we call this function from urlbar.handleCommand up to Firefox 10
 * and from extensions.js for objURLsuffix.
 *
 */
Tabmix.browserLoadURL = function TMP_BrowserLoadURL(theEvent, aPostData, altDisabled, aUrl, mayInheritPrincipal) {
  var newTabPref = Tabmix.prefs.getBoolPref("opentabfor.urlbar");
  var theBGPref  = Tabmix.prefs.getBoolPref("loadUrlInBackground");
  var theURI = aUrl || gURLBar.value;
  if ("gIeTab" in window)
     theURI = gIeTab.getHandledURL(theURI, gURLBar.isModeIE);

  var middleClick = theEvent instanceof MouseEvent && (theEvent.button == 1 || theEvent.ctrlKey || theEvent.metaKey);
  if (middleClick) {
    let where = whereToOpenLink(theEvent);
    if (where != "current") {
      gURLBar.handleRevert();
      gBrowser.selectedBrowser.focus();
    }
    if (where == "tabshifted") {
      theBGPref  = !theBGPref;
      newTabPref = true;
    }
    else {
      openUILinkIn(theURI, where, true /* allow third party fixup */, aPostData);
      return;
    }
  }
  var isAltKey = !altDisabled && (theEvent instanceof Event && ('altKey' in theEvent && theEvent.altKey));
  newTabPref = this.whereToOpen(newTabPref, isAltKey).inNew;
  this.__loadURLBar(theURI, theEvent, newTabPref, theBGPref, aPostData, true, mayInheritPrincipal);
}

/**
 * @brief Load URLs from the URL bar, search bar and search dialog.
 *
 * This function is used directly by Tab Mix Plus.
 *
 * @param aURI                    The URI to be opened.
 * @param aEvent                  A valid event union
 * @param aNewTabPref             A Boolean preference - if true, the URL will be
 *                                opened in a new tab; if false, it will load in
 *                                the current tab.
 * @param aLoadInBackground       A Boolean preference - if false, the newly created tab will be focused;
 *                                if true, the newly created tab will be unfocused.
 * @param aPostData               Additional opaque data used by tabbrowser methods
 * @param aAllowThirdPartyFixup   Allow third-party services to fixup this URL
 * @param mayInheritPrincipal     when false prevent any loads from inheriting the currently loaded document's principal
 * @returns                       Nothing.
 *
 */
Tabmix.__loadURLBar = function __TMP_LoadBarURL(aURI, aEvent, aNewTabPref, aLoadInBackground, aPostData, aAllowThirdPartyFixup, mayInheritPrincipal) {
  var originCharset = null;

  if (gBrowser.localName != "tabbrowser") {
    loadURI(aURI, null, aPostData, aAllowThirdPartyFixup);
    window.focus();
    return;
  }
  else {
    var currentURI = gBrowser.currentURI;
    var url = currentURI ? currentURI.spec : "about:blank";
    originCharset = url != "about:blank" ? gBrowser.contentDocument.characterSet : null;
  }

  if (aNewTabPref && !(/^ *javascript:/.test(aURI))) {
    if (gURLBar)
      gURLBar.handleRevert();
    window.focus();
    try {
      // open new tab in 2 step, this prevent focus problem with forms field
      var newTab = gBrowser.addTab("about:blank");
      newTab.linkedBrowser.stop();
      let flags = nsIWebNavigation.LOAD_FLAGS_NONE;
      if (aAllowThirdPartyFixup) {
        flags |= nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP;
      }
      var browser = gBrowser.getBrowserForTab(newTab);
      browser.userTypedValue = aURI;
      browser.loadURIWithFlags(aURI, flags, null, originCharset, aPostData);
    } catch (e) {  }
    gBrowser.TMP_selectNewForegroundTab(newTab, aLoadInBackground);
  }
  // not opening in a new tab at all
  else {
    gBrowser.mCurrentBrowser.tabmix_allowLoad = true;
    let flags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
    if (aAllowThirdPartyFixup)
      flags |= Ci.nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP;
    if (typeof(mayInheritPrincipal) == "boolean" && !mayInheritPrincipal) {
      flags |= Ci.nsIWebNavigation.LOAD_FLAGS_DISALLOW_INHERIT_OWNER;
    }
    gBrowser.loadURIWithFlags(aURI, flags, null, null, aPostData);
    gBrowser.ensureTabIsVisible(gBrowser.selectedTab)
  }

  gBrowser.selectedBrowser.focus();

  if (aEvent instanceof Event) {
    aEvent.preventDefault();
    aEvent.stopPropagation();
  }
  return;
}

/**
 * @brief openUILink handles clicks on UI elements that cause URLs to load
 *
 * called from Tabmix.linkHandling_init and from text.link.xul
 *
 */
Tabmix.openUILink_init = function TMP_openUILink_init() {
  // in Firefox 17 /(openUILinkIn[^\(]*\([^\)]+)(\))/, find the first
  // openUILinkIn in the comment
  if ("openUILink" in window) {
    let code = ["openUILinkIn(url, where, params);",
                "openUILinkIn(url, where, allowKeywordFixup, postData, referrerUrl);"];
    let source, str = openUILink.toString();
    if (str.indexOf(code[0]) > -1)
      source = code[0];
    else if (str.indexOf(code[1]) > -1)
      source = code[1];
    else
      return; // nothing we can do
    /* don't open blank tab when we are about to add new livemark */
    this.newCode("openUILink", openUILink)._replace(
      'aIgnoreAlt = params.ignoreAlt;',
      'aIgnoreAlt = params.ignoreAlt || null;', {check: Tabmix.isVersion(140)}
    )._replace(
      source,
      '  var win = getTopWin();' +
      '  if (win && where == "current") {' +
      '    let _addLivemark = /^feed:/.test(url) &&' +
      '       Services.prefs.getCharPref("browser.feeds.handler") == "bookmarks";' +
      '    if (!_addLivemark)' +
      '      where = win.Tabmix.checkCurrent(url);' +
      '  }' +
      '  try {$&}  catch (ex) {  }'
    )._replace( // fix incompatibility with Omnibar (O is not defined)
      'O.handleSearchQuery',
      'window.Omnibar.handleSearchQuery', {silent: true}
    ).toCode();
  }
}

Tabmix.checkCurrent = function TMP_checkCurrent(url) {
  var opentabforLinks = Tabmix.prefs.getIntPref("opentabforLinks");
  if (opentabforLinks == 1 || gBrowser.mCurrentTab.hasAttribute("locked")) {
    let isBlankTab = gBrowser.isBlankNotBusyTab(gBrowser.mCurrentTab);
    if (!isBlankTab)
       return "tab";
  }
  else if (opentabforLinks == 2) {
    // Get current page url
    let curpage = gBrowser.currentURI.spec;
    let domain = this.contentAreaClick.checkDomain(curpage, url);
    if (domain.current && domain.target && domain.target != domain.current)
      return "tab";
  }
  return "current";
}

/**
 * @brief copy Tabmix data from old tab to new tab.
 *        we use it before swapBrowsersAndCloseOther
 */
Tabmix.copyTabData = function TMP_copyTabData(newTab, oldTab) {
  let _xulAttributes = ["protected", "_locked", "fixed-label", "label-uri", "reload-data", "tabmix_bookmarkId"];

  var self = this;
  _xulAttributes.forEach(function _setData(attr) {
    self.setItem(newTab, attr, oldTab.hasAttribute(attr) ? oldTab.getAttribute(attr) : null);
  });

  this.restoreTabState(newTab);
}

Tabmix.restoreTabState = function TMP_restoreTabState(aTab) {
  if (aTab.hasAttribute("_locked")) {
    if (aTab.getAttribute("_locked") == "true")
      aTab.setAttribute("locked", "true");
    else
      aTab.removeAttribute("locked");
  }

  // this function run before tab load, so onTabReloaded will run when onStateChange get STATE_STOP
  var reloadData = aTab.getAttribute("reload-data");
  if (reloadData) {
    this.autoReload.initTab(aTab);
    aTab.autoReloadEnabled = true;
    aTab.setAttribute("_reload", true);
    reloadData = reloadData.split(" ");
    aTab.autoReloadURI = reloadData[0];
    aTab.autoReloadTime = reloadData[1];
  }

  if (aTab.hasAttribute("tabmix_bookmarkId")) {
    // make sure the id exist before using it
    let bmitemid = aTab.getAttribute("tabmix_bookmarkId");
    try {
      let title = PlacesUtils.bookmarks.getItemTitle(bmitemid);
    } catch (ex) {
      aTab.removeAttribute("tabmix_bookmarkId");
    }
  }

  // make sure other extensions don't set minwidth maxwidth
  aTab.removeAttribute("minwidth");
  aTab.removeAttribute("maxwidth");
}
