"use strict";

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

    if (panel && !appearanceWin && !filetypeWin && !promptWin)
      tabmixOptionsWin.showPane(panel);

    tabmixOptionsWin.gIncompatiblePane.checkForIncompatible(false);

    (appearanceWin || filetypeWin || promptWin || tabmixOptionsWin).focus();
  }
  else {
    window.openDialog("chrome://tabmixplus/content/preferences/preferences.xul", "Tab Mix Plus",
        "chrome,titlebar,toolbar,close,dialog=no,centerscreen", panel || null);
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
   var originCharset = tabBrowser.selectedBrowser.characterSet;

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
   var newTabUrl = BROWSER_NEW_TAB_URL;
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
         let prefName = replaceLastTab ? "extensions.tabmix.replaceLastTabWith.newtab.url" :
                                         "browser.newtab.url";
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
   if (TabmixTabbar.widthFitTitle && replaceLastTab && !gBrowser.mCurrentTab.collapsed)
     gBrowser.mCurrentTab.collapsed = true;

   var loadBlank = isBlankPageURL(url);
   var _url = loadBlank ? url : "about:blank";
   var newTab = gBrowser.addTab(_url, {skipAnimation: replaceLastTab, dontMove: true});
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
         let originCharset = gBrowser.selectedBrowser.characterSet;
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
       url == "about:blank" || url == "about:newtab" || url == "about:privatebrowsing";
   if (clearUrlBar)
     Tabmix.clearUrlBar(newTab, url);

   return newTab;
}

Tabmix.selectedTab = null;
Tabmix.clearUrlBar = function TMP_clearUrlBar(aTab, aUrl, aTimeOut) {
  if(/about:home|(www\.)*(google|bing)\./.test(aUrl))
    return;
  if (!isBlankPageURL(aUrl)) {
    // clean the the address bar as if the user laod about:blank tab
    this.selectedTab = aTab;
    this.userTypedValue = aUrl;
    gBrowser.userTypedValue = "";
  }
  // don't try to focus urlbar on popup
  if (aTab.selected && window.toolbar.visible) {
    if (this.isVersion(340) && gMultiProcessBrowser)
      aTab._skipContentFocus = true;
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
  if (isBlankPageURL(gURLBar.value))
    gURLBar.value = "";

  let tab = this.selectedTab;
  if (!tab)
    return;

  var isCurrentTab = tab.selected;
  var browser = gBrowser.getBrowserForTab(tab);
  var url = this.userTypedValue;
  if (!isBlankPageURL(url))
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
  if (url != gURLBar.value && !isBlankPageURL(url)) {
    gURLBar.value = gBrowser.userTypedValue = url;
  }
  this.selectedTab = null;
  this.userTypedValue = "";
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
    this.changeCode(window, "openUILink")._replace(
      'aIgnoreAlt = params.ignoreAlt;',
      'aIgnoreAlt = params.ignoreAlt || null;'
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
    if (this.ContentClick.isLinkToExternalDomain(curpage, url))
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

  let pending = aTab.hasAttribute("pending");

  // this function run before tab load, so onTabReloaded will run when
  // onStateChange get STATE_STOP, unless the tab is pending
  var reloadData = aTab.getAttribute("reload-data");
  if (reloadData) {
    this.autoReload.initTab(aTab);
    aTab.autoReloadEnabled = true;
    aTab.setAttribute("_reload", true);
    reloadData = reloadData.split(" ");
    aTab.autoReloadURI = reloadData[0];
    aTab.autoReloadTime = reloadData[1];
    if (pending)
      this.autoReload.onTabReloaded(aTab, aTab.linkedBrowser);
  }

  let tabTitleChanged, boldChanged = {value: false};
  Tabmix.setTabStyle(aTab, boldChanged);
  if (pending)
    tabTitleChanged = TMP_Places.setTabTitle(aTab);
  if (tabTitleChanged || boldChanged.value) {
    TabmixTabbar.updateScrollStatus();
    TabmixTabbar.updateBeforeAndAfter();
  }

  // make sure other extensions don't set minwidth maxwidth
  aTab.removeAttribute("minwidth");
  aTab.removeAttribute("maxwidth");
}

Tabmix.tabStyles = {}
Tabmix.setTabStyle = function(aTab, boldChanged) {
  if (!aTab)
    return;
  let style = "other";
  if (aTab.selected)
    style = "current";
  // if pending tab is blank we don't style it as unload or unread
  else if (Tabmix.prefs.getBoolPref("unloadedTab") &&
      (aTab.hasAttribute("pending") || aTab.hasAttribute("tabmix_pending")))
    style = TMP_SessionStore.isBlankPendingTab(aTab) ? "other" : "unloaded";
  else if (Tabmix.prefs.getBoolPref("unreadTab") &&
      !aTab.hasAttribute("visited") && !isTabEmpty(aTab))
    style = "unread";

  let currentAttrib = aTab.getAttribute("tabmix_tabStyle");
  let newAttrib = Tabmix.tabStyles[style] || style;
  this.setItem(aTab, "tabmix_tabStyle", newAttrib);

  if (!boldChanged)
    return;

  let isBold = function(attrib) {
    attrib = attrib.split(" ");
    return attrib.length > 1 && attrib.indexOf("not-bold") == -1;
  }
  boldChanged.value = isBold(newAttrib) != isBold(currentAttrib);
}
