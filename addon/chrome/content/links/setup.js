"use strict";

/*
 * chrome://tabmixplus/content/links/setup.js
 *
 * original code by Bradley Chapman
 * modified and developed by Hemiola SUN
 * modified again by Bradley Chapman
 *
 */

/**
 * @brief Install the link-handling functions of Tab Mix Plus.
 *
 * @returns   Nothing.
 */
Tabmix.linkHandling_init = function TMP_TBP_init() {
  // Since bug 1180944 onPopupClick always call urlbar.handleCommand
  if (!Tabmix.isVersion(500)) {
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
  }

  window.BrowserOpenTab = TMP_BrowserOpenTab;

  this.openUILink_init();
};

Tabmix.beforeBrowserInitOnLoad = function() {
  try {
    TabmixSvc.windowStartup.init(window);
  } catch (ex) {
    this.assert(ex);
  }

  try {
    gTMPprefObserver.init();
  } catch (ex) {
    this.assert(ex);
  }

  try {
    var SM = TabmixSessionManager;
    SM.initializePrivateStateVars();

    var firstWindow = this.firstWindowInSession || SM.firstNonPrivateWindow;
    var disabled = TMP_SessionStore.isSessionStoreEnabled() ||
                      this.extensions.sessionManager;
    var sessionManager = this.prefs.getBoolPref("sessions.manager");
    var willRestore = firstWindow && !disabled && (sessionManager &&
                      this.prefs.getIntPref("sessions.onStart") <= 1 ||
                      this.prefs.getBoolPref("sessions.crashRecovery") &&
                      this.prefs.prefHasUserValue("sessions.crashed"));
    var notRestore = firstWindow && !disabled && sessionManager &&
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
        setRunning() {
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
        let defaultArgs = Cc["@mozilla.org/browser/clh;1"]
            .getService(Ci.nsIBrowserHandler).defaultArgs;
        if (window.arguments[0] == defaultArgs) {
          SM.overrideHomepage = window.arguments[0];
          window.arguments[0] = null;
        }
      }
    }

    Tabmix._callPrepareLoadOnStartup = this.isVersion(570) && prepareLoadOnStartup;
    if (prepareLoadOnStartup) {
      Tabmix.prepareLoadOnStartup = function(uriToLoad) {
        uriToLoad = this.isVersion(570) ? uriToLoad : gBrowserInit._getUriToLoad();
        if (uriToLoad && uriToLoad != TabmixSvc.aboutBlank) {
          let tabs = gBrowser.tabs;
          for (let tab of tabs) {
            tab.loadOnStartup = true;
          }
        }
        if (uriToLoad == TabmixSvc.aboutBlank || "tabmixdata" in window) {
          gBrowser.selectedBrowser.stop();
        }
      };
    } else {
      Tabmix.prepareLoadOnStartup = function() { };
    }

    Tabmix.originalFunctions.gBrowserInit__delayedStartup = gBrowserInit._delayedStartup;
    gBrowserInit._delayedStartup = function() {
      try {
        Tabmix.beforeDelayedStartup();
      } catch (ex) {
        Tabmix.assert(ex);
      }

      let result;
      try {
        // we use runningDelayedStartup in gBrowser.swapBrowsersAndCloseOther
        Tabmix.runningDelayedStartup = true;
        result = Tabmix.originalFunctions.gBrowserInit__delayedStartup.apply(this, arguments);
      } finally {
        Tabmix.runningDelayedStartup = false;
      }

      if (Tabmix._callPrepareLoadOnStartup) {
        gBrowserInit._uriToLoadPromise
            .then(uriToLoad => Tabmix.prepareLoadOnStartup(uriToLoad))
            .then(() => TabmixSessionManager.init());
      } else {
        Tabmix.prepareLoadOnStartup();
        TabmixSessionManager.init();
      }
      Tabmix.initialization.run("afterDelayedStartup");

      return result;
    };

    // look for installed extensions that are incompatible with tabmix
    if (this.firstWindowInSession && this.prefs.getBoolPref("disableIncompatible")) {
      setTimeout(function checkCompatibility(aWindow) {
        let tmp = {};
        Components.utils.import("resource://tabmixplus/extensions/CompatibilityCheck.jsm", tmp);
        tmp = new tmp.CompatibilityCheck(aWindow, true);
      }, 0, window);
    }

    // add tabmix menu item to tab context menu before menumanipulator and MenuEdit initialize
    TabmixContext.buildTabContextMenu();
  } catch (ex) {
    this.assert(ex);
  }
};

// this must run before all
Tabmix.beforeStartup = function TMP_beforeStartup(tabBrowser, aTabContainer) {
  if (typeof tabBrowser == "undefined")
    tabBrowser = gBrowser || window._gBrowser;

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
    try {
      if (Tabmix.isVersion(550)) {
        let tab = this.getTabForBrowser(aBrowser);
        if (tab.hasAttribute("pending")) {
          return TMP_SessionStore.isBlankPendingTab(tab);
        }
      }
      if (!aBrowser || !aBrowser.currentURI)
        return true;
      if (aBrowser.canGoForward || aBrowser.canGoBack)
        return false;
      return aboutBlank ? aBrowser.currentURI.spec == TabmixSvc.aboutBlank :
        Tabmix.isNewTabUrls(aBrowser.currentURI.spec);
    } catch (ex) {
      Tabmix.assert(ex);
      return true;
    }
  };

  /**
   * add gBrowser.getTabForBrowser if it is not exist
   * gBrowser.getTabForBrowser exist since Firefox 35 (Bug 1039500)
   * gBrowser._getTabForBrowser exist since Firefox 23 (Bug 662008)
   */
  if (typeof tabBrowser.getTabForBrowser != "function") {
    // this is _getTabForBrowser version from Firefox 23
    tabBrowser.getTabForBrowser = function(aBrowser) {
      for (let i = 0; i < this.tabs.length; i++) {
        if (this.tabs[i].linkedBrowser == aBrowser)
          return this.tabs[i];
      }
      return null;
    };
  }

  tabBrowser.getBrowserForTabPanel = function(notificationbox) {
    return document.getAnonymousElementByAttribute(notificationbox, "class", "browserStack").firstChild;
  };

  tabBrowser.getTabForLastPanel = function() {
    let notificationbox = this.mPanelContainer.lastChild;
    let browser = this.getBrowserForTabPanel(notificationbox);
    if (browser == gBrowser._preloadedBrowser) {
      browser = this.getBrowserForTabPanel(notificationbox.previousSibling);
    }
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

  // setting flowing to "multibar" in Firefox 57 prevents Tabmix.getButtonsHeight
  // to get proper height when the window opened by SessionStore._openWindowWithState
  // with more than one rows of tabs
  if (!this.isVersion(570) || TabmixSvc.SessionStore._isWindowLoaded(window)) {
    TabmixTabbar.flowing = ["singlebar", "scrollbutton", "multibar", "scrollbutton"][tabscroll];
  }

  // add flag that we are after SwitchThemes, we use it in Tabmix.isWindowAfterSessionRestore
  if ("SwitchThemesModule" in window) {
    let SwitchThemesModule = window.SwitchThemesModule;
    if (SwitchThemesModule.windowsStates && SwitchThemesModule.windowsStates.length) {
      TMP_SessionStore.afterSwitchThemes = true;
    }
  }

  TMP_extensionsCompatibility.preInit();
};

Tabmix.updateCloseButtons = Tabmix.isVersion(580) ? "_updateCloseButtons" : "adjustTabstrip";
Tabmix._updateCloseButtons = function tabContainer_updateCloseButtons(skipUpdateScrollStatus, aUrl) {
  // modes for close button on tabs - extensions.tabmix.tabs.closeButtons
  // 1 - alltabs    = close buttons on all tabs
  // 2 - hovertab   = close buttons on hover tab
  // 3 - activetab  = close button on active tab only
  // 4 - hoveractive = close buttons on hover and active tabs
  // 5 - alltabs wider then  = close buttons on all tabs wider then

  let oldValue = this.getAttribute("closebuttons");
  var tabs = Tabmix.visibleTabs.tabs;
  var tabsCount = tabs.length - gBrowser._removingTabs.length;
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
      if (Tabmix.isVersion(550)) {
        this.tabmix_updateCloseButtons();
      } else if (tabsCount < 3) {
        this.setAttribute("closebuttons", "alltabs");
      } else {
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
   *  TreeStyleTab add some code at the end
   */
  let transitionend = Tabmix.callerTrace("onxbltransitionend");
  if (tabsCount == 1) {
    let tab = this.selectedItem;
    if (!aUrl) {
      let currentURI = gBrowser.currentURI;
      aUrl = currentURI ? currentURI.spec : null;
    }
    if (Tabmix.tabsUtils._keepLastTab ||
        isBlankPageURL(tab.__newLastTab || null) ||
        (!aUrl || isBlankPageURL(aUrl)) &&
        gBrowser.isBlankNotBusyTab(tab)) {
      this.setAttribute("closebuttons", "noclose");
      this.removeAttribute("closebuttons-hover");
    }
  } else if ((!skipUpdateScrollStatus && oldValue != this.getAttribute("closebuttons")) ||
             transitionend) {
    TabmixTabbar.updateScrollStatus(transitionend);
    TabmixTabbar.updateBeforeAndAfter();
  }
};
