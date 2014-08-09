"use strict";

/*
 * chrome://tabmixplus/content/links/setup.js
 *
 * original code by Bradley Chapman
 * modified and developped by Hemiola SUN
 * modified again by Bradley Chapman
 *
 */

/**
 * @brief Install the link-handling functions of Tab Mix Plus.
 *
 * @returns   Nothing.
 */
Tabmix.linkHandling_init = function TMP_TBP_init(aWindowType) {
  if (aWindowType == "Extension:Manager") {
      // we're in the EM
      openURL = this.openURL;
  }

  // for normal click this function calls urlbar.handleCommand
  // for middle click or click with modifiers whereToOpenLink can't be "current"
  // so we don't need to check for locked tabs only for blanks tabs
  var autoComplete = document.getElementById("PopupAutoCompleteRichResult");
  if (autoComplete) {
    // https://addons.mozilla.org/en-US/firefox/addon/quieturl/
    let fn = typeof autoComplete._QuietUrlPopupClickOld == "function" ?
        "_QuietUrlPopupClickOld" : "PopupAutoCompleteRichResult.onPopupClick";
    this.changeCode(autoComplete, fn)._replace(
      'openUILink(url, aEvent);',
      'var isBlankTab = gBrowser.isBlankNotBusyTab(gBrowser.mCurrentTab);' +
      'var where = isBlankTab ? "current" : whereToOpenLink(aEvent);' +
      'var pref = "extensions.tabmix.loadUrlInBackground";' +
      'openUILinkIn(url, where, {' +
      '       inBackground: Services.prefs.getBoolPref(pref),' +
      '       initiatingDoc: aEvent ? aEvent.target.ownerDocument : null});'
    ).toCode();
  }

  window.BrowserOpenTab = TMP_BrowserOpenTab;

  this.openUILink_init();
}

Tabmix.beforeBrowserInitOnLoad = function() {
  try {
    TabmixSvc.windowStartup.init(window);
  } catch (ex) {this.assert(ex);}

  try {
    gTMPprefObserver.init();
  } catch (ex) {this.assert(ex);}

  try {
    var SM = TabmixSessionManager;
    if (this.isVersion(200)) {
      SM.globalPrivateBrowsing = PrivateBrowsingUtils.permanentPrivateBrowsing;
      SM.isWindowPrivate = function SM_isWindowPrivate(aWindow) PrivateBrowsingUtils.isWindowPrivate(aWindow);
      // isPrivateWindow is boolean property of this window, user can't change private status of a window
      SM.isPrivateWindow = SM.isWindowPrivate(window);
      SM.__defineGetter__("isPrivateSession", function() {
        return this.globalPrivateBrowsing || TabmixSvc.sm.private;
      });
      // set this flag to false if user opens in a session at least one non-private window
      SM.firstNonPrivateWindow = TabmixSvc.sm.private && !SM.isPrivateWindow;
      if (SM.firstNonPrivateWindow)
        TabmixSvc.sm.private = false;
    }
    else {
      let pbs = Cc["@mozilla.org/privatebrowsing;1"].
                getService(Ci.nsIPrivateBrowsingService);
      SM.globalPrivateBrowsing = pbs.privateBrowsingEnabled;
      SM.isWindowPrivate = function SM_isWindowPrivate(aWindow) SM.globalPrivateBrowsing;
      SM.__defineGetter__("isPrivateWindow", function() this.globalPrivateBrowsing);
      SM.__defineGetter__("isPrivateSession", function() this.globalPrivateBrowsing);
    }

    // make tabmix compatible with ezsidebar extension
    var fnContainer, TMP_BrowserStartup;
    if ("__ezsidebar__BrowserStartup" in window) // need to test this on firefox 16+
      [fnContainer, TMP_BrowserStartup] = [window, "__ezsidebar__BrowserStartup"];
    else if ("gBrowserInit" in window)
      [fnContainer, TMP_BrowserStartup] = [gBrowserInit, "onLoad"];
    else // we probably never get here
      [fnContainer, TMP_BrowserStartup] = [window, "BrowserStartup"];
    var bowserStartup = this.changeCode(fnContainer, TMP_BrowserStartup);

    // Bug 756313 - Don't load homepage URI before first paint
    // moved this code from gBrowserInit.onLoad to gBrowserInit._delayedStartup
    var swapOldCode = 'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);';
    var loadOnStartup, swapNewCode =
      ' if (!Tabmix.singleWindowMode) {' +
      '   window.tabmix_afterTabduplicated = true;' +
      '   TabmixSessionManager.init();' +
      '   let remoteBrowser = uriToLoad.ownerDocument.defaultView.gBrowser;' +
      '   let url = remoteBrowser.getBrowserForTab(uriToLoad).currentURI.spec;' +
      '   gBrowser.tabContainer.adjustTabstrip(true, url);' +
      '   $&' +
      ' }'
    if (!this.isVersion(190))
      bowserStartup = bowserStartup._replace(swapOldCode, swapNewCode);

    var firstWindow = this.firstWindowInSession || SM.firstNonPrivateWindow;
    var disAllow = SM.isPrivateWindow || TMP_SessionStore.isSessionStoreEnabled() ||
                   this.extensions.sessionManager ||
                   !this.isVersion(250) && this.isWindowAfterSessionRestore;
    var sessionManager = this.prefs.getBoolPref("sessions.manager");
    var resumeSession  = sessionManager &&
                         this.prefs.getIntPref("sessions.onStart") < 2;
    var recoverSession = this.prefs.getBoolPref("sessions.crashRecovery") &&
                         this.prefs.prefHasUserValue("sessions.crashed");

    SM.doRestore = !disAllow && firstWindow && (recoverSession || resumeSession);
    if (SM.doRestore) {
      // Prevent the default homepage from loading if we're going to restore a session
      if (this.isVersion(240)) {
        this.changeCode(gBrowserInit, "gBrowserInit._getUriToLoad")._replace(
          'sessionStartup.willOverrideHomepage', 'true'
        ).toCode();
      }
      else {
        bowserStartup = bowserStartup._replace(
          'uriToLoad = window.arguments[0];',
          'uriToLoad = gHomeButton.getHomePage() == window.arguments[0] ? null : window.arguments[0];'
        );
      }

      // move this code from gBrowserInit.onLoad to gBrowserInit._delayedStartup after bug 756313
      loadOnStartup =
        '  if (uriToLoad && uriToLoad != "about:blank") {' +
        '    for (let i = 0; i < gBrowser.tabs.length ; i++) {' +
        '      gBrowser.tabs[i].loadOnStartup = true;' +
        '    }' +
        '  }' +
        '  if (uriToLoad == "about:blank" || "tabmixdata" in window) {' +
        '    gBrowser.selectedBrowser.stop();' +
        '  }\n' +
        '    $&'

      if (!this.isVersion(190)) {
        bowserStartup = bowserStartup._replace(
          'if (window.opener && !window.opener.closed', loadOnStartup
        );
      }
    }
    bowserStartup.toCode();

    if (Tabmix.isVersion(270) && sessionManager) {
      this.changeCode(RestoreLastSessionObserver, "RestoreLastSessionObserver.init")._replace(
        'SessionStore.canRestoreLastSession',
        'TabmixSessionManager.canRestoreLastSession'
      ).toCode();
    }

    // At the moment we must init TabmixSessionManager before sessionStore.init
    var [obj, fn] = "gBrowserInit" in window ?
          [gBrowserInit, "gBrowserInit._delayedStartup"] :
          [window, "delayedStartup"];

    let insertionPoint, ssPromise = "";
    if (this.isVersion(250)) {
      insertionPoint = "PlacesToolbarHelper.init();";
      if (!this.isVersion(270))
        ssPromise = 'typeof ssPromise == "object" ? ssPromise : null';
    }
    else
      insertionPoint = 'Services.obs.addObserver';

    this.changeCode(obj, fn)._replace(
      'Services.obs.addObserver', loadOnStartup, {check: this.isVersion(190) && !!loadOnStartup}
    )._replace(
      insertionPoint,
      'try {' +
      '  Tabmix.beforeSessionStoreInit(' + ssPromise + ');' +
      '} catch (ex) {Tabmix.assert(ex);}\n' +
      '    $&'
    )._replace(
      swapOldCode, swapNewCode, {check: this.isVersion(190)}
    )._replace(
      'SessionStore.canRestoreLastSession',
      'TabmixSessionManager.canRestoreLastSession', {check: this.isVersion(260) && sessionManager, silent: true}
    ).toCode();

    // look for installed extensions that are incompatible with tabmix
    if (this.firstWindowInSession && this.prefs.getBoolPref("disableIncompatible")) {
      setTimeout(function checkCompatibility(aWindow) {
        let tmp = { };
        Components.utils.import("resource://tabmixplus/extensions/CompatibilityCheck.jsm", tmp);
        new tmp.CompatibilityCheck(aWindow, true);
      }, 0, window);
    }

    // add tabmix menu item to tab context menu before menumanipulator and MenuEdit initialize
    TabmixContext.buildTabContextMenu();

    fnContainer[TMP_BrowserStartup].bind(fnContainer);

  } catch (ex) {this.assert(ex);}
}

// this must run before all
Tabmix.beforeStartup = function TMP_beforeStartup(tabBrowser, aTabContainer) {
    if (typeof tabBrowser == "undefined")
      tabBrowser = gBrowser;

    // return true if all tabs in the window are blank
    tabBrowser.isBlankWindow = function() {
       for (var i = 0; i < this.tabs.length; i++) {
          if (!this.isBlankBrowser(this.getBrowserAtIndex(i)))
             return false;
       }
       return true;
    }

    tabBrowser.isBlankTab = function(aTab) {
      return this.isBlankBrowser(this.getBrowserForTab(aTab));
    }

    //XXX isTabEmpty exist in Firefox 4.0 - same as isBlankNotBusyTab
    // isTabEmpty don't check for Tabmix.isNewTabUrls
    tabBrowser.isBlankNotBusyTab = function TMP_isBlankNotBusyTab(aTab, aboutBlank) {
      if (aTab.hasAttribute("busy") || aTab.hasAttribute("pending"))
        return false;

      return this.isBlankBrowser(this.getBrowserForTab(aTab), aboutBlank);
    }

    tabBrowser.isBlankBrowser = function TMP_isBlankBrowser(aBrowser, aboutBlank) {
       try{
          if (!aBrowser)
             return true;
          return (!aBrowser.sessionHistory || aBrowser.sessionHistory.index < 0 ||
                  (aBrowser.sessionHistory.count < 2 &&
                  (!aBrowser.currentURI ||
                  (aboutBlank ? aBrowser.currentURI.spec == "about:blank" : Tabmix.isNewTabUrls(aBrowser.currentURI.spec))
          )));
       } catch (ex) {Tabmix.assert(ex); return true;}
    }

    // gBrowser._getTabForBrowser exsit since Firefox 23 (Bug 662008)
    if (typeof tabBrowser._getTabForBrowser != "function") {
       tabBrowser._getTabForBrowser = function (aBrowser) {
          for (let i = 0; i < this.tabs.length; i++) {
            if (this.tabs[i].linkedBrowser == aBrowser)
              return this.tabs[i];
          }
          return null;
       }
    }

    tabBrowser.getTabForLastPanel = function () {
      let notificationbox = this.mPanelContainer.lastChild;
      let attrName = Tabmix.isVersion(180) ? "class" : "anonid"; // changed by Bug 768442
      let browser = document.getAnonymousElementByAttribute(notificationbox, attrName, "browserStack").firstChild;
      return this._getTabForBrowser(browser);
    }

    var tabContainer = aTabContainer || tabBrowser.tabContainer ||
                       document.getAnonymousElementByAttribute(tabBrowser, "anonid", "tabcontainer");

    // Firefox sessionStore and session manager extension start to add tab before our onWindowOpen run
    // so we initialize this before start
    // mTabMaxWidth not exist from firefox 4.0
    var max = Math.max(16, Services.prefs.getIntPref("browser.tabs.tabMaxWidth"));
    var min = Math.max(16, Services.prefs.getIntPref("browser.tabs.tabMinWidth"));
    if (max < min) {
      Services.prefs.setIntPref("browser.tabs.tabMaxWidth", min);
      Services.prefs.setIntPref("browser.tabs.tabMinWidth", max);
      [min, max] = [max, min];
    }
    tabContainer.mTabMaxWidth = max;
    tabContainer.mTabMinWidth = min;
    TabmixTabbar.widthFitTitle = this.prefs.getBoolPref("flexTabs") && (max != min);
    if (TabmixTabbar.widthFitTitle)
      this.setItem(tabContainer, "widthFitTitle", true);

    var tabscroll = this.prefs.getIntPref("tabBarMode");
    if (document.documentElement.getAttribute("chromehidden").indexOf("toolbar") != -1)
      tabscroll = 1;
    if (tabscroll < 0 || tabscroll > 3 ||
        (tabscroll != TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT && "TreeStyleTabBrowser" in window)) {
      this.prefs.setIntPref("tabBarMode", 1);
      tabscroll = 1;
    }
    TabmixTabbar.scrollButtonsMode = tabscroll;
    let flowing = ["singlebar", "scrollbutton", "multibar", "scrollbutton"][tabscroll];
    this.setItem(tabContainer, "flowing", flowing);
    tabContainer.mTabstrip.setAttribute("flowing", flowing);
    this.setItem("tabmixScrollBox", "flowing", flowing);

    // add flag that we are after SwitchThemes, we use it in Tabmix.isWindowAfterSessionRestore
    if ("SwitchThemesModule" in window && SwitchThemesModule.windowsStates && SwitchThemesModule.windowsStates.length)
      TMP_SessionStore.afterSwitchThemes = true;

    TMP_extensionsCompatibility.preInit();
}

Tabmix.adjustTabstrip = function tabContainer_adjustTabstrip(skipUpdateScrollStatus, aUrl) {
  // modes for close button on tabs - extensions.tabmix.tabs.closeButtons
  // 1 - alltabs    = close buttons on all tabs
  // 2 - hovertab   = close buttons on hover tab
  // 3 - activetab  = close button on active tab only
  // 4 - hoveractive = close buttons on hover and active tabs
  // 5 - alltabs wider then  = close buttons on all tabs wider then

  let oldValue = this.getAttribute("closebuttons");
  var tabbrowser = this.tabbrowser;
  var tabs = tabbrowser.visibleTabs;
  var tabsCount = tabs.length - tabbrowser._removingTabs.length;
  switch (this.closeButtonsEnabled ? this.mCloseButtons : 0) {
  case 0:
    this.removeAttribute("closebuttons-hover");
    this.setAttribute("closebuttons", "noclose");
    break;
  case 1:
    this.removeAttribute("closebuttons-hover");
    this.setAttribute("closebuttons", "alltabs");
    break;
  case 2:
    this.setAttribute("closebuttons-hover", "alltabs");
    this.setAttribute("closebuttons", "noclose");
    break;
  case 3:
    this.removeAttribute("closebuttons-hover");
    this.setAttribute("closebuttons", "activetab");
    break;
  case 4:
    this.setAttribute("closebuttons-hover", "notactivetab");
    this.setAttribute("closebuttons", "activetab");
    break;
  case 5:
    this.removeAttribute("closebuttons-hover");
    if (tabsCount < 3)
      this.setAttribute("closebuttons", "alltabs");
    else {
      // make sure not to check collapsed, hidden or pinned tabs for width
      let tab = TMP_TabView.checkTabs(tabs);
      if (tab && tab.getBoundingClientRect().width > this.mTabClipWidth)
        this.setAttribute("closebuttons", "alltabs");
      else
        this.setAttribute("closebuttons", "activetab");
    }
    break;
  }

 /**
  *  Don't use return in this function
  *  TreeStyleTabe add some code at the end
  */
  if (tabsCount == 1) {
    let tab = this.selectedItem;
    if (!aUrl) {
        let currentURI = tabbrowser.currentURI;
        aUrl = currentURI ? currentURI.spec : null;
    }
    if (this._keepLastTab ||
        isBlankPageURL(tab.__newLastTab || null) ||
       (!aUrl || isBlankPageURL(aUrl)) &&
        tabbrowser.isBlankNotBusyTab(tab)) {
      this.setAttribute("closebuttons", "noclose");
      this.removeAttribute("closebuttons-hover");
    }
  }
  else if ((!skipUpdateScrollStatus && oldValue != this.getAttribute("closebuttons")) ||
           ("faviconize" in window && Tabmix.callerName() == "onxbltransitionend")) {
    TabmixTabbar.updateScrollStatus();
    TabmixTabbar.updateBeforeAndAfter();
  }
}

/**
 bug 887515 - add ability to restore multiple tabs
 bug 914258 backout 887515 changes from Firefox 25
 bug 931891 backout 887515 changes from Firefox 26-29
*/
XPCOMUtils.defineLazyGetter(Tabmix, "_restoreMultipleTabs", function() {
  return this.isVersion(290) &&
         typeof TabmixSvc.ss.setNumberOfTabsClosedLast == "function";
});
