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

/**
 * @brief Catch call to tabmix options from EM
 *        we only use Tabmix options if we have browser window
 *
 * @param aURL       A valid options URL string.
 *
 * @return           true if the URL is for tabmix options
 *                   false if not.
 *
 */
function TMP_cmd_options(aURL) {
   if (aURL != "chrome://tabmixplus/content/pref/pref-tabmix.xul")
      return false;

   var windowMediator = TabmixSvc.wm;
   var browserWindow = windowMediator.getMostRecentWindow('navigator:browser');

   if (!browserWindow) {
      var tabmixopt = windowMediator.getMostRecentWindow("mozilla:tabmixopt");
      if (tabmixopt)
         tabmixopt.close();
      var title = TabmixSvc.getString("tabmixoption.error.title");
      var msg = TabmixSvc.getString("tabmixoption.error.msg");
      TabmixSvc.prompt.alert(window, title, msg);
   }
   else
      browserWindow.TMP_openDialog(-1);

   return true;
}

function TMP_openDialog(panel) {
  var windowMediator = TabmixSvc.wm;
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
      TabmixSvc.prefs.setIntPref('extensions.tabmix.selected_tab', panel);

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
function TMP_openURL(aURL, event) {
   var linkTarget, loadInBackground;
   try {
            linkTarget = TabmixSvc.prefs.getIntPref("browser.link.open_newwindow");
   }
   catch (e) {
      linkTarget = 1;
   }

   if (aURL == null) aURL = "about:blank";

   // check for an existing window and focus it; it's not application modal
   var browserWindow = Tabmix.getTopWin();

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
            browserWindow.TMP_loadTabs(aURL.split("|"), false);
            break;
      }

   if (event && event instanceof Event) {
      event.preventDefault();
      event.stopPropagation();
   }
   return true;
}

function TMP_BrowserOpenTab(aTab, replaceLastTab) {
   var newTabContent = replaceLastTab ? TabmixSvc.TMPprefs.getIntPref("replaceLastTabWith") :
                                         TabmixSvc.TMPprefs.getIntPref("loadOnNewTab");
   var url;
   switch (newTabContent) {
      case 0 : // blank tab, by default
         url = "about:blank";
         break;
      case 1 :  // home page
         url = gHomeButton.getHomePage().split("|")[0];
         break;
      case 2 : // current URI
         var currentURI = gBrowser.currentURI;
         url = currentURI ? currentURI.spec : "about:blank";
         break;
      case 3 : // duplicate tab
         let currentUrl = gBrowser.currentURI.spec;
         let newTab = gBrowser.duplicateTab(gBrowser.mCurrentTab, null, null, null, true);
         TMP_clearUrlBar(newTab, currentUrl, true);
         return newTab;
         break;
      case 4 : // user url
         try {
            var prefName = replaceLastTab ? "newTabUrl_afterLastTab" : "newTabUrl";
            url = TabmixSvc.TMPprefs.getComplexValue(prefName, Components.interfaces.nsIPrefLocalizedString).data;
         } catch (ex) {  Tabmix.assert(ex); }
         // use this if we can't find the pref
         if (!url)
            url = "about:blank";
         break;
      default:
         url = "about:blank";
   }
   var flags = nsIWebNavigation.LOAD_FLAGS_NONE;
   // if google.toolbar extension installed check google.toolbar.newtab pref
   if ("GTB_GoogleToolbarOverlay" in window) {
     try {
       if (TabmixSvc.prefs.getBoolPref("google.toolbar.newtab")) {
         url = "chrome://google-toolbar/content/new-tab.html";
         flags = nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY
       }
     } catch (ex) {/* no pref - do noting */}
   }
   if ((TabmixTabbar.widthFitTitle || !Tabmix.isVersion(60)) && replaceLastTab && !gBrowser.mCurrentTab.collapsed)
     gBrowser.mCurrentTab.collapsed = true;

   var loadBlank = url == "about:blank";
   var newTab = replaceLastTab && Tabmix.isVersion(40) ? gBrowser.addTab("about:blank", {skipAnimation: true}) : gBrowser.addTab("about:blank");
   if (replaceLastTab) {
     newTab.__newLastTab = true;
     if (TabmixSvc.prefs.getCharPref("general.skins.selectedSkin") == "Vista-aero" ) {
       gBrowser.selectedTab = newTab;
       gBrowser.updateCurrentBrowser();
     }
     if (loadBlank) {
       gBrowser.tabContainer.setAttribute("closebuttons", "noclose");
       gBrowser.tabContainer.removeAttribute("closebuttons-hover");
     }
     // fix a bug in Firefox when we replace last tab the strip remain visible even if the pref is to hide tabbar
     // when there is only one tab
     if (!Tabmix.isVersion(40) && TabmixSvc.prefs.getBoolPref("browser.tabs.autoHide") && gBrowser.getStripVisibility())
       gBrowser.setStripVisibilityTo(false);
   }

   if (!loadBlank) {
      try { // just in case.....
         let browser = newTab.linkedBrowser;
         browser.stop();
         let originCharset = gBrowser.contentDocument.characterSet;
         browser.loadURIWithFlags(url, flags, null, originCharset);
         if (Tabmix.isVersion(36))
            gBrowser.selectedBrowser.focus();
         else
            focusElement(content);
      }
      catch (ex) {}
   }
   if (aTab && aTab.localName == "tab")
      gBrowser.TMmoveTabTo(newTab, aTab._tPos + 1);
   else if (!replaceLastTab && TabmixSvc.TMPprefs.getBoolPref("openNewTabNext")) {
      gBrowser.TMmoveTabTo(newTab, gBrowser.mCurrentTab._tPos + gBrowser.tabContainer.nextTab, 1);
      if (TabmixSvc.TMPprefs.getBoolPref("openTabNextInverse"))
         gBrowser.tabContainer.nextTab++;
   }

   // always select new tab when replacing last tab
   var loadInBackground  = replaceLastTab ? false : TabmixSvc.TMPprefs.getBoolPref("loadNewInBackground");
   gBrowser.TMP_selectNewForegroundTab(newTab, loadInBackground);

   // focus the address bar on new tab
   if (TabmixSvc.TMPprefs.getBoolPref("selectLocationBar") || loadBlank)
     TMP_clearUrlBar(newTab, url);

   return newTab;
}

function TMP_clearUrlBar(aTab, aUrl, aTimeOut) {
  if(/about:home|(www\.)*(google|bing)\./.test(aUrl))
    return;
  if (aUrl != "about:blank") {
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
 * @brief In TMP_BrowserOpenTab we empty and fucos the urlbar
 *        if the user or onload from a page blur the urlbar befroe user typed new valur
 *        we restore the current url
 */
function TMP_urlBarOnBlur() {
  if (!gBrowser.tabmix_tab)
    return;

  var isCurrentTab = gBrowser.tabmix_tab == gBrowser.mCurrentTab;
  var browser = gBrowser.getBrowserForTab(gBrowser.tabmix_tab);
  var url = gBrowser.tabmix_userTypedValue;
  if (url != "about:blank")
    browser.userTypedValue = url;
  if (isCurrentTab && gBrowser.mIsBusy) {
    browser.addEventListener("load", function TMP_onLoad_urlBarOnBlur(aEvent) {
      aEvent.currentTarget.removeEventListener("load", TMP_onLoad_urlBarOnBlur, true);
      TMP_updateUrlBarValue();
    }, true);
    return;
  }

  TMP_updateUrlBarValue()
}

function TMP_updateUrlBarValue() {
  var url = gBrowser.currentURI.spec;
  if (url != gURLBar.value && url != "about:blank") {
    gURLBar.value = gBrowser.userTypedValue = url;
  }
  delete gBrowser.tabmix_tab;
  delete gBrowser.tabmix_userTypedValue;
}

/**
 * @brief Load URLs from the URL bar.
 *
 * @param event         A valid event union.
 * @param aPostData     Additional opaque data used by __TMP_LoadBarURL().
 * @param altDisabled   parameter set by URL Suffix extension, to prevent ALT from opening new tab
 * @param aUrl          aUrl , not in use anymore  
 *                      in the past we used this arg from PopupAutoCompleteRichResult.onPopupClick
 * @param mayInheritPrincipal
                        when false prevent any loads from inheriting the currently loaded document's principal
 * @return              Nothing.
 *
 *
 * we call this function from urlbar.handleCommand up to Firefox 10
 * and from extensions.js for objURLsuffix.  
 *
 */
function TMP_BrowserLoadURL(theEvent, aPostData, altDisabled, aUrl, mayInheritPrincipal) {
  var newTabPref = TabmixSvc.TMPprefs.getBoolPref("opentabfor.urlbar");
  var theBGPref  = TabmixSvc.TMPprefs.getBoolPref("loadUrlInBackground");
  var theURI = aUrl || gURLBar.value;
  if ("gIeTab" in window)
     theURI = gIeTab.getHandledURL(theURI, gURLBar.isModeIE);

  var middleClick = theEvent instanceof MouseEvent && (theEvent.button == 1 || theEvent.ctrlKey || theEvent.metaKey);
  if (aUrl || middleClick) {
    let where = whereToOpenLink(theEvent);
    if (Tabmix.isVersion(40) && where != "current") {
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
  newTabPref = TMP_whereToOpen(newTabPref, isAltKey).inNew;
  __TMP_LoadBarURL(theURI, theEvent, newTabPref, theBGPref, aPostData, true, mayInheritPrincipal);
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
function __TMP_LoadBarURL(aURI, aEvent, aNewTabPref, aLoadInBackground, aPostData, aAllowThirdPartyFixup, mayInheritPrincipal) {
  var originCharset = null;

  if (gBrowser.localName != "tabbrowser") {
    loadURI(aURI, null, aPostData, aAllowThirdPartyFixup);
    content.focus();
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
    content.focus();
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
    gBrowser.tabContainer.ensureTabIsVisible(gBrowser.mCurrentTab._tPos);
  }

  if (Tabmix.isVersion(36))
    gBrowser.selectedBrowser.focus();
  else
    focusElement(content);

  if (aEvent instanceof Event) {
    aEvent.preventDefault();
    aEvent.stopPropagation();
  }
  return;
}

/* call from TMP_TBP_init and from text.link.xul */
function TMP_openUILink_init() {
  if ("openUILink" in window) {
    Tabmix.newCode("openUILink", openUILink)._replace(
      'var where = whereToOpenLink(e, ignoreButton, ignoreAlt);',
      <![CDATA[$&
        var win = Tabmix.getTopWin();
        if (win) {
          // don't open blanke tab when we are about to add new livemark
          let _addLivemark = /^feed:/.test(url) && TabmixSvc.prefs.getCharPref("browser.feeds.handler") == "bookmarks";
          if (where == "current" && !_addLivemark)
            where = win.TMP_checkCurrent(url);
        }
      ]]>
    )._replace(
      'openUILinkIn(url, where, allowKeywordFixup, postData, referrerUrl);',
      'try {$&} catch (ex) {  }'
    )._replace( // fix incompatibility with Omnibar (O is not defined)
      'O.handleSearchQuery',
      'window.Omnibar.handleSearchQuery', {silent: true}
    ).toCode();
  }
}

function TMP_checkCurrent(url) {
  if (gBrowser.mCurrentTab.hasAttribute("locked")) {
    var isBlankTab = gBrowser.isBlankNotBusyTab(gBrowser.mCurrentTab);
    if (!isBlankTab)
       return "tab";
  }
  else if (TabmixSvc.prefs.getIntPref("extensions.tabmix.opentabforLinks") == 2 ) {
    // Get current page url
    var curpage = gBrowser.currentURI.spec;
    var domain = TMP_checkDomain(curpage, url);
    if (domain.current && domain.target && domain.target != domain.current)
      return "tab";
  }
  return "current";
}

function TMP_copyTabData(newTab, oldTab) {
  let _xulAttributes = ["protected", "_locked", "fixed-label", "label-uri", "reload-data", "tabmix_bookmarkId"];

  _xulAttributes.forEach(function _setData(attr) {
    Tabmix.setItem(newTab, attr, oldTab.hasAttribute(attr) ? oldTab.getAttribute(attr) : null);
  });

  TMP_restoreTabState(newTab);
}

function TMP_restoreTabState(aTab) {
  if (aTab.hasAttribute("_locked")) {
    if (aTab.getAttribute("_locked") == "true")
      aTab.setAttribute("locked", "true");
    else
      aTab.removeAttribute("locked");
  }

  // this function run before tab load, so onTabReloaded will run when onStateChange get STATE_STOP
  var reloadData = aTab.getAttribute("reload-data");
  if (reloadData) {
    Tabmix.autoReload.initTab(aTab);
    aTab.autoReloadEnabled = true;
    aTab.setAttribute("_reload", true);
    reloadData = reloadData.split(" ");
    aTab.autoReloadURI = reloadData[0];
    aTab.autoReloadTime = reloadData[1];
  }

  if (aTab.hasAttribute("tabmix_bookmarkId")) {
    // make sure the id exist before using it
    try {
      let _URI = PlacesUtils.bookmarks.getBookmarkURI(bmitemid);
      let title = _URI && _URI.spec == aUrl && PlacesUtils.bookmarks.getItemTitle(bmitemid);
    } catch (ex) {
      aTab.removeAttribute("tabmix_bookmarkId")
    }
  }
}