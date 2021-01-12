/* exported TMP_BrowserOpenTab */
"use strict";

/**
 * chrome://tabmixplus/content/links/userInterface.js
 *
 * original code by Bradley Chapman
 * modified and developed by Hemiola SUN
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
  } else {
    window.openDialog("chrome://tabmixplus/content/preferences/preferences.xul", "Tab Mix Plus",
      "chrome,titlebar,toolbar,close,dialog=no,centerscreen", panel || null);
  }
};

// Don't change this function name other extensions using it
// Speed-Dial, Fast-Dial, TabGroupManager
function TMP_BrowserOpenTab(aEvent, aTab, replaceLastTab) {
  var newTabContent = replaceLastTab ? Tabmix.prefs.getIntPref("replaceLastTabWith.type") :
    Tabmix.prefs.getIntPref("loadOnNewTab.type");
  var url;
  var newTabUrl = BROWSER_NEW_TAB_URL;
  var selectedTab = gBrowser.selectedTab;
  switch (newTabContent) {
    case 0: // blank tab, by default
      url = "about:blank";
      break;
    case 1: // home page
      url = gHomeButton.getHomePage().split("|")[0];
      break;
    case 2: // current URI
      var currentURI = gBrowser.currentURI;
      url = currentURI ? currentURI.spec : newTabUrl;
      break;
    case 3: { // duplicate tab
      let currentUrl = gBrowser.currentURI.spec;
      let dupTab = gBrowser.duplicateTab(selectedTab, null, null, null, true);
      Tabmix.clearUrlBar(dupTab, currentUrl, true);
      return dupTab;
    }
    case 4: {// user url
      if (replaceLastTab || !Tabmix.isVersion(410) || TabmixSvc.isCyberfox) {
        let prefName = replaceLastTab ? "extensions.tabmix.replaceLastTabWith.newtab.url" :
          TabmixSvc.newtabUrl;
        try {
          url = TabmixSvc.getStringPref(prefName);
          if (newTabUrl == "about:privatebrowsing" && url == TabmixSvc.aboutNewtab)
            url = "about:privatebrowsing";
        } catch (ex) {
          Tabmix.assert(ex);
        }
      }
      // use this if we can't find the pref
      if (!url)
        url = newTabUrl;
      break;
    }
    default:
      url = newTabUrl;
  }
  // if google.toolbar extension installed check google.toolbar.newtab pref
  if ("GTB_GoogleToolbarOverlay" in window) {
    try {
      if (Services.prefs.getBoolPref("google.toolbar.newtab"))
        url = "chrome://google-toolbar/content/new-tab.html";
    } catch (ex) {/* no pref - do noting */}
  }
  if (TabmixTabbar.widthFitTitle && replaceLastTab && !selectedTab.collapsed)
    selectedTab.collapsed = true;

  var loadBlank = isBlankPageURL(url);
  if (!TabmixSessionManager.isPrivateWindow && replaceLastTab && !loadBlank &&
      typeof privateTab == "object") {
    let privateTab = window.privateTab;
    if (privateTab.isTabPrivate(selectedTab) &&
        TabmixSvc.prefs.get("extensions.privateTab.makeNewEmptyTabsPrivate", 0) === 0) {
      privateTab.readyToOpenTab(false);
    }
  }

  // always select new tab when replacing last tab
  var loadInBackground = replaceLastTab ? false :
    Tabmix.prefs.getBoolPref("loadNewInBackground");
  let baseTab = aTab && aTab.localName == "tab" ? aTab : null;
  let openTabNext = baseTab || !replaceLastTab && Tabmix.prefs.getBoolPref("openNewTabNext");
  // Let accel-click and middle-click on the new tab button toggle openTabNext preference
  // see bug 528005
  if (Tabmix.isVersion(510) && aEvent && !aTab && !replaceLastTab &&
      (aEvent instanceof MouseEvent || aEvent instanceof XULCommandEvent)) {
    // don't replace 'window' to 'tab' in whereToOpenLink when singleWindowMode is on
    Tabmix.skipSingleWindowModeCheck = true;
    let where = whereToOpenLink(aEvent, false, true);
    Tabmix.skipSingleWindowModeCheck = false;
    switch (where) {
      case "tabshifted":
        loadInBackground = !loadInBackground;
        /* falls through */
      case "tab":
        openTabNext = !openTabNext;
        break;
      case "window":
        if (!Tabmix.getSingleWindowMode()) {
          openUILinkIn(url, where);
          return null;
        }
        break;
    }
  }
  TMP_extensionsCompatibility.treeStyleTab.onBeforeNewTabCommand(baseTab || selectedTab, openTabNext);
  var newTab = gBrowser.addTab(url, {
    charset: loadBlank ? null : gBrowser.selectedBrowser.characterSet,
    ownerTab: loadInBackground ? null : selectedTab,
    skipAnimation: replaceLastTab,
    dontMove: true
  });
  if (replaceLastTab) {
    newTab.__newLastTab = url;
    if (Services.prefs.getCharPref("general.skins.selectedSkin") == "Vista-aero") {
      gBrowser.selectedTab = newTab;
      gBrowser.updateCurrentBrowser();
    }
    if (loadBlank) {
      gBrowser.tabContainer.setAttribute("closebuttons", "noclose");
      gBrowser.tabContainer.removeAttribute("closebuttons-hover");
    }
  }

  if (openTabNext) {
    gBrowser.moveTabTo(newTab, (baseTab || selectedTab)._tPos + 1);
  }
  // make sure to update recently used tabs
  // if user open many tabs quickly select event don't have time to fire
  // before new tab select
  if (!loadInBackground) {
    gBrowser.selectedTab = newTab;
    TMP_LastTab.PushSelectedTab();
  }

  gBrowser.selectedBrowser.focus();
  // focus the address bar on new tab
  var clearUrlBar = !replaceLastTab && Tabmix.prefs.getBoolPref("selectLocationBar") ||
      replaceLastTab && Tabmix.prefs.getBoolPref("selectLocationBar.afterLastTabClosed") ||
      url == TabmixSvc.aboutBlank || url == TabmixSvc.aboutNewtab || url == "about:privatebrowsing";
  if (clearUrlBar)
    Tabmix.clearUrlBar(newTab, url, false, replaceLastTab);

  return newTab;
}

Tabmix.selectedTab = null;
Tabmix.clearUrlBar = function TMP_clearUrlBar(aTab, aUrl, aTimeOut, replaceLastTab) {
  // Firefox always call focusAndSelectUrlBar when it replacing last tab
  if (!replaceLastTab && /about:home|(www\.)*(google|bing)\./.test(aUrl))
    return;
  if (aTab.selected && !isBlankPageURL(aUrl)) {
    // clean the the address bar as if the user load about:blank tab
    this.selectedTab = aTab;
    this.userTypedValue = aUrl;
    gBrowser.userTypedValue = "";
    URLBarSetURI();
  }
  // don't try to focus urlbar on popup
  if (aTab.selected && window.toolbar.visible) {
    if (this.isVersion(340) && gMultiProcessBrowser)
      aTab._skipContentFocus = true;
    if (aTimeOut)
      setTimeout(() => focusAndSelectUrlBar(), 30);
    else
      focusAndSelectUrlBar();
  }
};

/**
 * @brief In TMP_BrowserOpenTab we empty and focus the urlbar
 *        if the user or onload from a page blur the urlbar before user typed new value
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

  this.updateUrlBarValue();
};

Tabmix.updateUrlBarValue = function TMP_updateUrlBarValue() {
  this.selectedTab = null;
  this.userTypedValue = null;

  var url = gBrowser.currentURI.spec;
  if (url != gURLBar.value && !isBlankPageURL(url)) {
    URLBarSetURI();
  }
};

/**
 * @brief openUILink handles clicks on UI elements that cause URLs to load
 *
 * called from Tabmix.linkHandling_init and from text.link.xul
 *
 */
Tabmix.openUILink_init = function TMP_openUILink_init() {
  if ("openUILink" in window) {
    // divert all the calls from places UI to use our preferences
    this.changeCode(window, "openUILink")._replace(
      'aIgnoreAlt = params.ignoreAlt;',
      'aIgnoreAlt = params.ignoreAlt || null;'
    )._replace(
      /openUILinkIn\(.*\);/,
      'where = TMP_Places.openUILink(url, event, where, params);\n' +
      '  if (where) {\n' +
      '    try {\n      $&\n    } catch (ex) {  }\n' +
      '  }\n'
    )._replace(// fix incompatibility with Omnibar (O is not defined)
      'O.handleSearchQuery',
      'window.Omnibar.handleSearchQuery', {silent: true}
    ).toCode();
  }
};

Tabmix.checkCurrent = function TMP_checkCurrent(url) {
  var opentabforLinks = Tabmix.prefs.getIntPref("opentabforLinks");
  if (opentabforLinks == 1 || gBrowser.mCurrentTab.hasAttribute("locked")) {
    let isBlankTab = gBrowser.isBlankNotBusyTab(gBrowser.mCurrentTab);
    if (!isBlankTab)
      return "tab";
  } else if (opentabforLinks == 2) {
    // Get current page url
    let curpage = gBrowser.currentURI.spec;
    if (this.ContentClick.isLinkToExternalDomain(curpage, url))
      return "tab";
  }
  return "current";
};

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
};

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
  if (pending) {
    if (Tabmix.isVersion(600)) {
      TMP_Places.asyncSetTabTitle(aTab, aTab.linkedBrowser.currentURI.spec).then(() => {
        aTab._labelIsInitialTitle = true;
      });
    } else {
      tabTitleChanged = TMP_Places.setTabTitle(aTab);
      aTab._labelIsInitialTitle = true;
    }
    aTab.removeAttribute("tabmix_selectedID");
    aTab.removeAttribute("visited");
  }
  Tabmix.setTabStyle(aTab, boldChanged);
  if (tabTitleChanged || boldChanged.value) {
    TabmixTabbar.updateScrollStatus();
    TabmixTabbar.updateBeforeAndAfter();
  }

  // make sure other extensions don't set minwidth maxwidth
  aTab.removeAttribute("minwidth");
  aTab.removeAttribute("maxwidth");
};

Tabmix.isPendingTab = function(aTab) {
  const pending = aTab.hasAttribute("pending") || aTab.hasAttribute("tabmix_pending");
  if (pending) {
    if (TMP_Places.restoringTabs.indexOf(aTab) > -1) {
      // don't show tab as pending when bookmarks restore_on_demand is false
      return TMP_Places.bookmarksOnDemand;
    }
    return true;
  }
  return false;
};

Tabmix.setTabStyle = function(aTab, boldChanged) {
  if (!aTab)
    return;
  let style = "null";
  let isSelected = aTab.getAttribute(TabmixSvc.selectedAtt) == "true";
  // if pending tab is blank we don't style it as unload or unread
  if (!isSelected && Tabmix.prefs.getBoolPref("unloadedTab") &&
      this.isPendingTab(aTab)) {
    style = aTab.pinned || aTab.hasAttribute("visited") ||
      TMP_SessionStore.isBlankPendingTab(aTab) ? "other" : "unloaded";
  } else if (!isSelected && Tabmix.prefs.getBoolPref("unreadTab") &&
      !aTab.hasAttribute("visited") && !isTabEmpty(aTab)) {
    style = "unread";
  }

  let currentStyle = aTab.getAttribute("tabmix_tabState") || null;
  if (style != "unread" && style != "unloaded")
    style = null;
  this.setItem(aTab, "tabmix_tabState", style);

  if (!boldChanged)
    return;

  // return true if state changed
  boldChanged.value = currentStyle != style;
};
