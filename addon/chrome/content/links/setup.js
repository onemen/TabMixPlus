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
      window.openURL = this.openURL;
  }

  // for normal click this function calls urlbar.handleCommand
  // for middle click or click with modifiers whereToOpenLink can't be "current"
  // so we don't need to check for locked tabs only for blanks tabs
  var autoComplete = document.getElementById("PopupAutoCompleteRichResult");
  if (autoComplete) {
    // https://addons.mozilla.org/en-US/firefox/addon/quieturl/
    let fn = typeof autoComplete._QuietUrlPopupClickOld == "function" ?
        "_QuietUrlPopupClickOld" : "PopupAutoCompleteRichResult.onPopupClick";
    let n = '\n            ';
    this.changeCode(autoComplete, fn)._replace(
      /openUILink\(url, aEvent.*\);/,
      'var tabmixOptions = typeof options == "object" ? options : {};' + n +
      'var isBlankTab = gBrowser.isBlankNotBusyTab(gBrowser.mCurrentTab);' + n +
      'var where = isBlankTab ? "current" : whereToOpenLink(aEvent);' + n +
      'var pref = "extensions.tabmix.loadUrlInBackground";' + n +
      'tabmixOptions.inBackground = Services.prefs.getBoolPref(pref);' + n +
      'tabmixOptions.initiatingDoc = aEvent ? aEvent.target.ownerDocument : null;' + n +
      'openUILinkIn(url, where, tabmixOptions);'
    ).toCode();
  }

  window.BrowserOpenTab = TMP_BrowserOpenTab;

  this.openUILink_init();
};

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
      SM.isWindowPrivate = function SM_isWindowPrivate() SM.globalPrivateBrowsing;
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
    var swapOldCode = this.isVersion(380) ?
        'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, tabToOpen);' :
        'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);';
    var loadOnStartup, swapNewCode =
      ' if (!Tabmix.singleWindowMode) {' +
      '   window.tabmix_afterTabduplicated = true;' +
      '   TabmixSessionManager.init();' +
      '   let remoteBrowser = uriToLoad.ownerDocument.defaultView.gBrowser;' +
      '   let url = remoteBrowser.getBrowserForTab(uriToLoad).currentURI.spec;' +
      '   gBrowser.tabContainer.adjustTabstrip(true, url);' +
      '   $&' +
      ' }';
    if (!this.isVersion(190))
      bowserStartup = bowserStartup._replace(swapOldCode, swapNewCode);

    var firstWindow = this.firstWindowInSession || SM.firstNonPrivateWindow;
    var disabled = TMP_SessionStore.isSessionStoreEnabled() ||
                      this.extensions.sessionManager;
    var sessionManager = this.prefs.getBoolPref("sessions.manager");
    var willRestore = firstWindow && !disabled && (sessionManager &&
                      this.prefs.getIntPref("sessions.onStart") <= 1 ||
                      this.prefs.getBoolPref("sessions.crashRecovery") &&
                      this.prefs.prefHasUserValue("sessions.crashed"));
    var notRestore =  firstWindow && !disabled && sessionManager &&
                      this.prefs.getIntPref("sessions.onStart") > 1 &&
                      (!this.prefs.getBoolPref("sessions.onStart.restorePinned") ||
                        this.prefs.getBoolPref("sessions.restore.concatenate"));

    // Set SessionStore._loadState to running on first window in the session
    // to prevent it from restoring last session or pinned tabs.
    let setStateRunning = (willRestore || notRestore) &&
        this.firstWindowInSession && !this.isWindowAfterSessionRestore;
    // RunState exist since Firefox 34, bug 1020831
    if (setStateRunning) {
      let RunState = TabmixSvc.SessionStoreGlobal.RunState || {
        get isStopped() {
          return TabmixSvc.SessionStore._loadState === 0; // STATE_STOPPED
        },
        setRunning: function() {
          TabmixSvc.SessionStore._loadState = 1; // STATE_RUNNING
        }
      };
      if (RunState.isStopped) {
        RunState.setRunning();
        SM.notifyObservers = true;
      }
    }

    var prepareLoadOnStartup = willRestore && !(SM.isPrivateWindow || this.isWindowAfterSessionRestore);
    var willOverrideHomepage = willRestore && !SM.isPrivateWindow;
    if (willOverrideHomepage) {
      // Prevent the default homepage from loading if we're going to restore a session
      let hasFirstArgument = window.arguments && window.arguments[0];
      if (hasFirstArgument) {
        let defaultArgs = Cc["@mozilla.org/browser/clh;1"].
                          getService(Ci.nsIBrowserHandler).defaultArgs;
        if (window.arguments[0] == defaultArgs) {
          SM.overrideHomepage = window.arguments[0];
          window.arguments[0] = null;
        }
      }
    }

    if (prepareLoadOnStartup) {
      // move this code from gBrowserInit.onLoad to gBrowserInit._delayedStartup after bug 756313
      loadOnStartup =
        '  if (uriToLoad && uriToLoad != "about:blank") {' +
        '    for (let i = 0; i < gBrowser.tabs.length ; i++) {' +
        '      gBrowser.tabs[i].loadOnStartup = true;' +
        '    }' +
        '  }' +
        '  if (uriToLoad == TabmixSvc.aboutBlank || "tabmixdata" in window) {' +
        '    gBrowser.selectedBrowser.stop();' +
        '  }\n' +
        '    $&';

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
    if (this.isVersion(250, 250)) {
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
        tmp = new tmp.CompatibilityCheck(aWindow, true);
      }, 0, window);
    }

    // add tabmix menu item to tab context menu before menumanipulator and MenuEdit initialize
    TabmixContext.buildTabContextMenu();

    fnContainer[TMP_BrowserStartup].bind(fnContainer);

  } catch (ex) {this.assert(ex);}
};

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
    };

    tabBrowser.isBlankTab = function(aTab) {
      return this.isBlankBrowser(this.getBrowserForTab(aTab));
    };

    //XXX isTabEmpty exist in Firefox 4.0 - same as isBlankNotBusyTab
    // isTabEmpty don't check for Tabmix.isNewTabUrls
    tabBrowser.isBlankNotBusyTab = function TMP_isBlankNotBusyTab(aTab, aboutBlank) {
      if (aTab.hasAttribute("busy") || aTab.hasAttribute("pending"))
        return false;

      return this.isBlankBrowser(this.getBrowserForTab(aTab), aboutBlank);
    };

    tabBrowser.isBlankBrowser = function TMP_isBlankBrowser(aBrowser, aboutBlank) {
       try{
          if (!aBrowser || !aBrowser.currentURI)
             return true;
          if (aBrowser.canGoForward || aBrowser.canGoBack)
             return false;
          return aboutBlank ? aBrowser.currentURI.spec == TabmixSvc.aboutBlank :
                 Tabmix.isNewTabUrls(aBrowser.currentURI.spec);
       } catch (ex) {Tabmix.assert(ex); return true;}
    };

    /**
     * add gBrowser.getTabForBrowser if it is not exist
     * gBrowser.getTabForBrowser exsit since Firefox 35 (Bug 1039500)
     * gBrowser._getTabForBrowser exsit since Firefox 23 (Bug 662008)
     */
    if (typeof tabBrowser.getTabForBrowser != "function") {
       // this is _getTabForBrowser version from Firefox 23
       tabBrowser.getTabForBrowser = function (aBrowser) {
          for (let i = 0; i < this.tabs.length; i++) {
            if (this.tabs[i].linkedBrowser == aBrowser)
              return this.tabs[i];
          }
          return null;
       };
    }

    tabBrowser.getTabForLastPanel = function () {
      let notificationbox = this.mPanelContainer.lastChild;
      let attrName = Tabmix.isVersion(180) ? "class" : "anonid"; // changed by Bug 768442
      let browser = document.getAnonymousElementByAttribute(notificationbox, attrName, "browserStack").firstChild;
      return this.getTabForBrowser(browser);
    };

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
    TabmixTabbar.flowing = flowing;

    // add flag that we are after SwitchThemes, we use it in Tabmix.isWindowAfterSessionRestore
    if ("SwitchThemesModule" in window && SwitchThemesModule.windowsStates && SwitchThemesModule.windowsStates.length)
      TMP_SessionStore.afterSwitchThemes = true;

    TMP_extensionsCompatibility.preInit();
};

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
  switch (Tabmix.tabsUtils.closeButtonsEnabled ? this.mCloseButtons : 0) {
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
    if (Tabmix.tabsUtils._keepLastTab ||
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
};

/**
 bug 887515 - add ability to restore multiple tabs
 bug 914258 backout 887515 changes from Firefox 25
 bug 931891 backout 887515 changes from Firefox 26-29
*/
XPCOMUtils.defineLazyGetter(Tabmix, "_restoreMultipleTabs", function() {
  return this.isVersion(290) &&
         typeof TabmixSvc.ss.setNumberOfTabsClosedLast == "function";
});
