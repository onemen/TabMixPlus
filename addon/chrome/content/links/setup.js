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
 * Install the link-handling functions of Tab Mix Plus.
 *
 * @returns Nothing.
 */
Tabmix.linkHandling_init = function TMP_TBP_init() {
  this.set_BrowserOpenTab();
  this.openUILink_init();
};

Tabmix.set_BrowserOpenTab = function () {
  window.BrowserCommands.openTab = TMP_BrowserOpenTab;
  Tabmix.BrowserOpenTab = TMP_BrowserOpenTab;
};

Tabmix.beforeBrowserInitOnLoad = function () {
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
    Tabmix.closedObjectsUtils.init();
  } catch (ex) {
    this.assert(ex);
  }

  try {
    if (Tabmix.isAfterMozAfterPaint) {
      Tabmix.beforeDelayedStartup();
    } else {
      window.addEventListener("MozAfterPaint", Tabmix.beforeDelayedStartup, {once: true});
    }

    // look for installed extensions that are incompatible with tabmix
    if (this.isFirstWindowInSession && this.prefs.getBoolPref("disableIncompatible")) {
      setTimeout(
        function checkCompatibility(aWindow) {
          const {CompatibilityCheck} = ChromeUtils.importESModule(
            "chrome://tabmix-resource/content/extensions/CompatibilityCheck.sys.mjs"
          );
          return new CompatibilityCheck(aWindow, true, false);
        },
        0,
        window
      );
    }

    // add tabmix menu item to tab context menu before menumanipulator and MenuEdit initialize
    TabmixContext.buildTabContextMenu();
  } catch (ex) {
    this.assert(ex);
  }
};

// this must run before all
Tabmix.beforeStartup = function TMP_beforeStartup(tabBrowser) {
  if (typeof tabBrowser == "undefined") {
    tabBrowser = gBrowser || window._gBrowser;
  }

  // return true if all tabs in the window are blank
  tabBrowser.isBlankWindow = function () {
    for (var i = 0; i < this.tabs.length; i++) {
      if (!this.isBlankBrowser(this.getBrowserAtIndex(i))) {
        return false;
      }
    }
    return true;
  };

  tabBrowser.isBlankTab = function (aTab) {
    return this.isBlankBrowser(this.getBrowserForTab(aTab));
  };

  tabBrowser.isBlankNotBusyTab = function (aTab, aboutBlank) {
    if (aTab.hasAttribute("busy")) {
      return false;
    }

    return this.isBlankBrowser(this.getBrowserForTab(aTab), aboutBlank);
  };

  tabBrowser.isBlankBrowser = function TMP_isBlankBrowser(aBrowser, aboutBlank) {
    try {
      let tab = this.getTabForBrowser(aBrowser);
      if (tab.hasAttribute("pending")) {
        return TMP_SessionStore.isBlankPendingTab(tab);
      }

      if (!aBrowser || !aBrowser.currentURI) {
        return true;
      }

      if (aBrowser.canGoForward || aBrowser.canGoBack) {
        return false;
      }

      return aboutBlank ?
          aBrowser.currentURI.spec == TabmixSvc.aboutBlank
        : Tabmix.isNewTabUrls(aBrowser.currentURI.spec);
    } catch (ex) {
      Tabmix.assert(ex);
      return true;
    }
  };

  tabBrowser.getBrowserForTabPanel = function (notificationbox) {
    return notificationbox.getElementsByClassName("browserStack")[0].firstChild;
  };

  tabBrowser.getTabForLastPanel = function () {
    let notificationbox = this.tabpanels.lastChild;
    let browser = this.getBrowserForTabPanel(notificationbox);
    if (browser === gBrowser.preloadedBrowser && notificationbox.previousSibling) {
      browser = this.getBrowserForTabPanel(notificationbox.previousSibling);
    }
    return this.getTabForBrowser(browser);
  };

  var tabscroll = this.prefs.getIntPref("tabBarMode");
  if (document.documentElement.getAttribute("chromehidden")?.includes("toolbar")) {
    tabscroll = 1;
  }

  if (
    tabscroll < 0 ||
    tabscroll > 3 ||
    (tabscroll != TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT && "TreeStyleTabBrowser" in window)
  ) {
    this.prefs.setIntPref("tabBarMode", 1);
    tabscroll = 1;
  }
  TabmixTabbar.scrollButtonsMode = tabscroll;

  if (window.__SSi && !SessionStore.getWindowState(window).windows[0]?._restoring) {
    TabmixTabbar.flowing =
      ["singlebar", "scrollbutton", "multibar", "scrollbutton"][tabscroll] || "scrollbutton";
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
