"use strict";

/*
 * tabmix.js
 *
 * original code by Hemiola SUN, further developed by onemen and CPU
 */
Tabmix.startup = function TMP_startup() {
  Tabmix.originalFunctions.OpenBrowserWindow = window.OpenBrowserWindow;
  window.OpenBrowserWindow = function (options = {}) {
    // When in single window mode allow one normal window and one private window.
    // otherwise open new tab in most recent window of the appropriate type
    if (Tabmix.singleWindowMode) {
      const win = BrowserWindowTracker.getTopWindow({private: options.private ?? false});
      if (win) {
        win.Tabmix.BrowserOpenTab();
        if (win !== window) {
          win.gBrowser.selectedBrowser.focus();
        }
        return win;
      }
    }
    return Tabmix.originalFunctions.OpenBrowserWindow.call(this, options);
  };

  // hide 'File > New Private Window' menu item when in single window mode when
  // there are open private window
  document.getElementById("menu_FilePopup")?.addEventListener("popupshowing", () => {
    this.showItem(
      "menu_newPrivateWindow",
      !this.singleWindowMode || !BrowserWindowTracker.getTopWindow({private: true})
    );
  });

  TabmixContext.toggleEventListener(true);
};

// we call this function from gBrowserInit._delayedStartup, see setup.js
Tabmix.beforeDelayedStartup = function () {
  if (this.isFirstWindow) {
    ChromeUtils.importESModule("chrome://tabmix-resource/content/extensions/AddonManager.sys.mjs");
  }
};

/** @this {TabmixGlobal} */ // @ts-ignore
Tabmix.getAfterTabsButtonsWidth = function () {
  this.afterTabsButtonsWidthReady = false;
  this.afterTabsButtonsWidth = this.isVersion({fp: "128.0.0"}) ? [40] : [35];

  /** @type {number[]} */
  const buttonWidths = [];
  if (gBrowser.tabContainer.getAttribute("orient") == "horizontal") {
    const {toolbar, tabBar, collapsed, tabBarCollapsed, toolbarCollapsed} =
      this.tabsUtils.getCollapsedState;
    let stripIsHidden = TabmixTabbar.hideMode !== 0 && collapsed;
    if (stripIsHidden) {
      toolbar.collapsed = false;
      tabBar.collapsed = false;
    }
    // save tabsNewtabButton width
    this.tabsNewtabButton = document.getElementById("tabs-newtab-button");
    this.tabsNewtabButton.setAttribute("force-display", true);
    // don't use getBoundsWithoutFlushing here, it will get width zero if the button is hidden
    // since we get here after the browser was painted we can use getBoundingClientRect
    let openNewTabRect = this.tabsNewtabButton.getBoundingClientRect();
    let style = window.getComputedStyle(this.tabsNewtabButton);
    let marginStart = style?.getPropertyValue("margin-left") ?? "0px";
    // it doesn't work when marginEnd add to buttonWidth
    // let marginEnd = style.getPropertyValue("margin-right");
    // let buttonWidth = openNewTabRect.width + parseFloat(marginStart) + parseFloat(marginEnd);
    let buttonWidth = openNewTabRect.width + parseFloat(marginStart);
    if (buttonWidth > 0) {
      buttonWidths.push(buttonWidth);
    }

    // when privateTab extension installed add its new tab button width
    // for the use of adjustNewtabButtonVisibility set tabsNewtabButton to be
    // the right button
    let openNewPrivateTab = document.getElementById("privateTab-afterTabs-openNewPrivateTab");
    if (openNewPrivateTab) {
      let openNewPrivateTabRect = openNewPrivateTab.getBoundingClientRect();
      buttonWidths.push(openNewPrivateTabRect.width);
      if (openNewPrivateTabRect.right > openNewTabRect.right) {
        this.tabsNewtabButton = openNewPrivateTab;
      }
    }
    this.tabsNewtabButton.removeAttribute("force-display");
    if (stripIsHidden) {
      toolbar.collapsed = toolbarCollapsed;
      tabBar.collapsed = tabBarCollapsed;
    }
    if (buttonWidths.length) {
      this.tabsUtils._widthCache = {minWidth: 0, maxWidth: 0};
      this.afterTabsButtonsWidth = buttonWidths;
      this.afterTabsButtonsWidthReady = true;
    }
  }
};

Tabmix.afterDelayedStartup = function () {
  const tab = gBrowser.tabContainer.allTabs[0];
  if (!tab.selected) {
    tab.removeAttribute("visited");
    tab.removeAttribute("tabmix_selectedID");
    Tabmix.setTabStyle(tab);
  }

  TMP_ClosedTabs.setButtonDisableState();
  if (this.isFirstWindowInSession) {
    Tabmix.closedObjectsUtils.toggleRecentlyClosedWindowsButton();
  }

  // focus address-bar area if the selected tab is blank when Firefox starts
  // unless the searchbar is focused
  // focus content area if the selected tab is not blank when Firefox starts
  setTimeout(() => {
    const isBlank =
      gBrowser.currentURI.spec === "about:home" || gBrowser.isBlankNotBusyTab(gBrowser.selectedTab);
    if (gURLBar.focused && !isBlank) {
      gBrowser.selectedBrowser.focus();
    } else {
      const focusedElement = Services.focus.focusedElement ?? document.activeElement;
      const isSearchbarFocused = Boolean(focusedElement?.closest("#searchbar"));
      if (!isSearchbarFocused && !gURLBar.focused && isBlank) {
        gURLBar.focus();
      }
    }
  }, 250);

  Tabmix.tabsSelectionUtils.init();

  TMP_Places.onDelayedStartup();

  this.navToolbox.init();

  // set option to Prevent clicking on Tab-bar from dragging the window.
  if (this.prefs.getBoolPref("tabbar.click_dragwindow")) {
    if (!Tabmix.prefs.getBoolPref("tabbar.dblclick_changesize")) {
      TabmixTabClickOptions.toggleEventListener(true);
    }
  } else {
    gTMPprefObserver.setTabbarDragging(false);
  }

  Tabmix.handleTabbarVisibility.toggleEventListener(true);

  TMP_extensionsCompatibility.onDelayedStartup();

  gTMPprefObserver.setMenuIcons();

  TabmixTabbar.updateSettings(true);
  gTMPprefObserver.setTabIconMargin();
  gTMPprefObserver.setCloseButtonMargin();
  if (!gTMPprefObserver._tabStyleSheet) {
    this.log("can't load dynamic styles for tabmixplus");
  }
  gTMPprefObserver._tabStyleSheet = null;

  if ("_failedToEnterVerticalMode" in TabmixTabbar) {
    delete TabmixTabbar._failedToEnterVerticalMode;
    gBrowser.tabContainer.arrowScrollbox._enterVerticalMode();
  }

  try {
    TMP_LastTab.init();
  } catch (ex) {
    this.assert(ex);
  }

  // starting with Firefox 17.0+ we calculate TMP_tabDNDObserver.paddingLeft
  // in gBrowser.tabContainer._positionPinnedTabs
  TMP_tabDNDObserver.paddingLeft = this.getStyle(gBrowser.tabContainer, "paddingLeft");

  // show global notification when debug mode is on
  let gnb = Tabmix._debugMode && gBrowser.getNotificationBox();
  if (gnb) {
    let buttons = [
      {
        label: "Disable Debug Mode",
        accessKey: "D",
        callback() {
          Tabmix.prefs.setBoolPref("enableDebug", false);
        },
      },
    ];
    let msg =
      "Tab Mix is in debug mode!\n " +
      "In case it's activated accidentally, click the button to disable it " +
      "or set 'extensions.tabmix.enableDebug' in about:config to false. " +
      "Once you disable 'Debug Mode' restart your browser.";
    setTimeout(() => {
      gnb.appendNotification(
        "tabmix-debugmode-enabled",
        {
          label: msg,
          priority: gnb.PRIORITY_CRITICAL_HIGH,
        },
        buttons
      );
    }, 500);
  }
};

/** @type {TabmixEventListener} */ // @ts-expect-error
var TMP_eventListener = {
  init: function TMP_EL_init() {
    window.addEventListener("load", this);

    window.addEventListener("SSWindowRestored", this);
    if (Tabmix.isAfterSSWindowRestored) {
      delete Tabmix.isAfterSSWindowRestored;
      this.onSSWindowRestored();
    }

    window.delayedStartupPromise.then(() => {
      Tabmix.initialization.run("afterDelayedStartup");
    });
  },

  handleEvent: function TMP_EL_handleEvent(aEvent) {
    if (WheelEvent.isInstance(aEvent)) {
      switch (aEvent.type) {
        case "wheel":
          this.onTabBarScroll(aEvent);
          break;
      }
      return;
    }

    switch (aEvent.type) {
      case "TabAttrModified":
        this.onTabAttrModified(aEvent);
        break;
      case "SSWindowRestored":
        TMP_ClosedTabs.setButtonDisableState();
        this.onSSWindowRestored();
        break;
      case "SSTabRestoring":
      case "SSTabRestored":
        this.onSSTabRestored(aEvent.target);
        break;
      case "TabOpen":
        this.onTabOpen(aEvent);
        break;
      case "TabBrowserInserted":
        this.onTabBrowserInserted(aEvent);
        break;
      case "TabClose":
        this.onTabClose(aEvent);
        break;
      case "TabSelect":
        this.onTabSelect(aEvent);
        break;
      case "TabMove":
        this.onTabMove(aEvent);
        break;
      case "TabPinned":
        this.onTabPinned(aEvent);
        break;
      case "TabUnpinned":
        this.onTabUnpinned(aEvent);
        break;
      case "load":
        this._onLoad(aEvent.type);
        break;
      case "unload":
        this.onWindowClose();
        break;
      case "fullscreen": {
        let enterFS = window.fullScreen;
        this.onFullScreen(enterFS);
        break;
      }
    }
  },

  toggleEventListener(aObj, aArray, aEnable, aHandler) {
    const handler = aHandler || this;
    const eventListener = aEnable ? "addEventListener" : "removeEventListener";
    aArray.forEach(eventName => {
      aObj[eventListener](eventName, handler, true);
    });
  },

  // ignore non-browser windows
  _onLoad: function TMP_EL_onContentLoaded(aType) {
    window.removeEventListener(aType, this);
    let wintype = window.document.documentElement.getAttribute("windowtype");
    if (wintype == "navigator:browser") {
      if (aType != "load") {
        Tabmix.initialization.run("onContentLoaded");
        Tabmix.initialization.run("beforeBrowserInitOnLoad");
      } else {
        Tabmix.initialization.run("onWindowOpen");
      }
    } else if (aType != "load") {
      window.removeEventListener("load", this);
    }
  },

  onContentLoaded: function TMP_EL_onContentLoaded() {
    Tabmix.isFirstWindow = Tabmix.numberOfWindows() == 1;
    TMP_SessionStore.setAfterSessionRestored();

    try {
      /*
       *  aObject, aName , aModule - file name , aSymbol - symbol in EXPORTED_SYMBOLS, aFlag, aArg
       */
      Tabmix.lazy_import(Tabmix, "flst", "Slideshow", "flst", true);
      Tabmix.lazy_import(Tabmix, "MergeWindows", "MergeWindows", "MergeWindows");
      Tabmix.lazy_import(Tabmix, "autoReload", "AutoReload", "AutoReload");
      Tabmix.lazy_import(Tabmix, "renameTab", "RenameTab", "RenameTab");
      Tabmix.lazy_import(
        Tabmix,
        "docShellCapabilities",
        "DocShellCapabilities",
        "DocShellCapabilities"
      );
      Tabmix.lazy_import(Tabmix, "Utils", "Utils", "TabmixUtils");
    } catch (ex) {
      Tabmix.assert(ex);
    }

    this._tabEvents = [
      "SSTabRestoring",
      "SSTabRestored",
      "TabOpen",
      "TabClose",
      "TabSelect",
      "TabMove",
      "TabUnpinned",
      "TabAttrModified",
      "TabBrowserInserted",
    ];

    if (Tabmix.isVersion(1410)) {
      this._tabEvents.push("TabPinned");
    }

    this.toggleEventListener(gBrowser.tabContainer, this._tabEvents, true);

    // Add tabmixKey to all tabs
    for (const tab of gBrowser.tabs) {
      tab.tabmixKey = new (Cu.getGlobalForObject(Services).Object)();
    }
    this.tabWidthCache.set(gBrowser.selectedTab.tabmixKey, 0);

    try {
      TMP_extensionsCompatibility.onContentLoaded();
    } catch (ex) {
      Tabmix.assert(ex);
    }

    try {
      Tabmix.onContentLoaded.changeCode();
    } catch (ex) {
      Tabmix.assert(ex);
    }

    Tabmix.contentAreaClick.init();

    // make sure AVG Security Toolbar initialized
    // before we change gURLBar.handleCommand to prevent too much recursion from gURLBar.handleCommand
    if (window.InitializeOverlay_avg && typeof window.InitializeOverlay_avg.Init == "function") {
      // avg.Init uses arguments.callee, so i can't call it from strict mode
      Tabmix.nonStrictMode(window.InitializeOverlay_avg, "Init");
    }

    // initialize our gURLBar.handleCommand function early before other extensions change
    // gURLBar.handleCommand or searchbar.handleSearchCommand by replacing the original function
    // url-fixer also prevent the use of eval changes by using closure in the replaced function
    Tabmix.navToolbox.initializeURLBar();
    Tabmix.navToolbox.initializeSearchbar();

    gTMPprefObserver.addDynamicRules();
    this.addGroupMutationObserver();
  },

  onWindowOpen: function TMP_EL_onWindowOpen() {
    window.addEventListener("unload", this);
    window.addEventListener("fullscreen", this, true);

    Tabmix.Utils.initMessageManager(window);

    var tabBar = gBrowser.tabContainer;
    tabBar.addEventListener("wheel", this, true);

    try {
      TabmixProgressListener.startup(gBrowser);
    } catch (ex) {
      Tabmix.assert(ex);
    }

    if (!CustomizableUI.getPlacementOfWidget("tabmix-scrollbox")) {
      const tabsWidget = CustomizableUI.getPlacementOfWidget("tabbrowser-tabs");
      CustomizableUI.addWidgetToArea(
        "tabmix-scrollbox",
        CustomizableUI.AREA_TABSTRIP,
        tabsWidget?.area === CustomizableUI.AREA_TABSTRIP ? tabsWidget.position + 1 : 0
      );
    }

    gBrowser.tabpanels.addEventListener("click", Tabmix.contentAreaClick._contentLinkClick, true);

    // init tabmix functions
    try {
      TMP_extensionsCompatibility.onWindowOpen();
    } catch (ex) {
      Tabmix.assert(ex);
    }
    try {
      Tabmix.tablib.init();
    } catch (ex) {
      Tabmix.assert(ex);
    }
    try {
      TMP_Places.init();
    } catch (ex) {
      Tabmix.assert(ex);
    }
    try {
      Tabmix.startup();
    } catch (ex) {
      Tabmix.assert(ex);
    }
    try {
      Tabmix.linkHandling_init();
    } catch (ex) {
      Tabmix.assert(ex);
    }
    try {
      TMP_tabDNDObserver.init();
    } catch (ex) {
      Tabmix.assert(ex);
    }

    if (TabmixSvc.isMac) {
      tabBar.setAttribute("Mac", "true");
    }

    var tabsToolbar = document.getElementById("TabsToolbar");

    const skin = Services.prefs.getCharPref("extensions.activeThemeID", "");
    if (skin == "classic/1.0") {
      if (TabmixSvc.isMac) {
        tabBar.setAttribute("classic", "v4Mac");
      } else if (TabmixSvc.isLinux) {
        tabBar.setAttribute("classic", "v3Linux");
        ///XXX test if this is still the case
        TMP_tabDNDObserver.LinuxMarginEnd = -2;
        Tabmix.setItem(tabsToolbar, "tabmix_skin", "classic");
      } else {
        let version = navigator.oscpu.startsWith("Windows NT 6.1") ? "v40aero" : "v40";
        tabBar.setAttribute("classic40", version);
        Tabmix.setItem(tabsToolbar, "classic40", version);
      }
    } else {
      //XXX need to add theme list here
      var themes = /^(iPoxRemix|Ie8fox|Vfox3)/;
      if (themes.test(skin)) {
        // add backgroundrepeat Attribute for theme for use in multi-row
        tabBar.setAttribute("backgroundrepeat", true);
      }
      switch (skin) {
        case "cfxe": // Chromifox Extreme
        case "cfxec":
          tabBar.setAttribute("tabmix_skin", "cfxec");
          break;
        case "Vfox3":
        case "phoenityaura": // Phoenity Aura
          tabBar.setAttribute("tabmix_skin", skin);
          break;
        case "CrystalFox_Qute-BigRedBrent":
          tabBar.setAttribute("tabmix_skin", "CrystalFox");
          break;
        case "Vista-aero": {
          let rightBox = document.getElementById("myTabBarRightBox");
          if (rightBox) {
            rightBox.setAttribute("vista_aero", true);
          }

          break;
        }
        case "classiccompact":
          tabBar.setAttribute("tabmix_skin", "classiccompact");
          break;
        case "BlackFox_V1-Blue":
          tabBar.setAttribute("tabmix_skin", "BlackFox");
          break;
      }
    }

    // don't remove maybe some themes use this with Tabmix
    tabBar.setAttribute("tabmix_firefox3", true);

    if (Tabmix.singleWindowMode) {
      gTMPprefObserver.setSingleWindowUI();
    }

    // if treeStyleTab extension installed we call this from
    // Tabmix.afterDelayedStartup
    if (!Tabmix.extensions.treeStyleTab) {
      Tabmix.navToolbox.tabStripAreaChanged();
    }

    TMP_ClosedTabs.setButtonType(Tabmix.prefs.getBoolPref("undoCloseButton.menuonly"));

    TabmixTabbar.hideMode = Tabmix.prefs.getIntPref("hideTabbar");

    /*
     *  In the first time TMP is running we need to match extensions.tabmix.hideTabbar to browser.tabs.autoHide.
     *  extensions.tabmix.hideTabbar default is 0 "Never Hide tabbar"
     *  if browser.tabs.autoHide is true we need to make sure extensions.tabmix.hideTabbar
     *  is set to 1 "Hide tabbar when i have only one tab":
     */
    gTMPprefObserver.setAutoHidePref();

    if (TabmixTabbar.hideMode == 2) {
      TabBarVisibility.update();
    }

    if (Tabmix.prefs.getIntPref("tabBarPosition") == 1) {
      gTMPprefObserver.tabBarPositionChanged(1);
    }

    // for light weight themes
    if (TabmixTabbar.isMultiRow || TabmixTabbar.position == 1) {
      Tabmix.setItem("main-window", "tabmix_lwt", true);
      const value = Tabmix.prefs.getIntPref("theme_background") !== 2 || null;
      Tabmix.setItem("navigator-toolbox", "tabmix_lwt_background", value);
      Tabmix.setItem("tabmix-bottom-toolbox", "tabmix_lwt_background", value);
    }

    // make sure "extensions.tabmix.undoClose" is true if "browser.sessionstore.max_tabs_undo" is not zero
    var sessionstoreUndoClose = Services.prefs.getIntPref("browser.sessionstore.max_tabs_undo") > 0;
    if (sessionstoreUndoClose != Tabmix.prefs.getBoolPref("undoClose")) {
      Tabmix.prefs.setBoolPref("undoClose", sessionstoreUndoClose);
    }

    // apply style on tabs
    /** @type {DynamicRulesModule.RuleName[]} */
    let styles = ["currentTab", "unloadedTab", "unreadTab", "otherTab"];
    styles.forEach(ruleName => {
      gTMPprefObserver.updateTabsStyle(ruleName);
    });
    // progressMeter on tabs
    gTMPprefObserver.setProgressMeter();

    // tabmix Options in Tools menu
    document.getElementById("tabmix-menu").hidden = !Tabmix.prefs.getBoolPref("optionsToolMenu");
    document.getElementById("tabmix-historyUndoWindowMenu").hidden =
      !Tabmix.prefs.getBoolPref("closedWinToolsMenu");

    if (Tabmix.isVersion(1300) && window.SidebarController.sidebarVerticalTabsEnabled) {
      tabBar._updateCloseButtons();
    }

    Tabmix.allTabs.init();

    MozXULElement.insertFTLIfNeeded("browser/tabContextMenu.ftl");
    Tabmix.setFTLDataId("tm-content-undoCloseTab");
    Tabmix.setFTLDataId("tm-content-closetab");
  },

  tabWidthCache: new WeakMap(),
  onTabAttrModified(aEvent) {
    if (!TabmixTabbar.widthFitTitle) {
      return;
    }

    // catch tab width changed when label attribute changed
    // or when busy attribute changed hide/show image
    var tab = aEvent.target;
    var key = tab.tabmixKey;
    if (!this.tabWidthCache.has(key)) {
      return;
    }

    var width = tab.getBoundingClientRect().width;
    if (this.tabWidthCache.get(key) == width) {
      return;
    }

    this.tabWidthCache.set(key, width);

    TabmixTabbar.updateScrollStatus();
    setTimeout(() => TabmixTabbar.updateScrollStatus(), 2500);
  },

  async onSSWindowRestored() {
    // make sure we are fully initialized
    await Tabmix._deferredInitialized.promise;
    const tabs = gBrowser.tabs.filter(t => t.tagName === "tab");
    tabs.forEach(tab => {
      if (!tab.hasAttribute("pending")) {
        const url = tab.linkedBrowser.currentURI.spec;
        TMP_Places.asyncSetTabTitle(tab, {url});
      }
      Tabmix.restoreTabState(tab);
    });

    if (this.tabsAlreadyOpened) {
      // make sure this code runs only once for this window
      delete this.tabsAlreadyOpened;
      tabs.forEach(tab => {
        if (tab.getAttribute("fadein") && tab.getAttribute("linkedpanel") !== "panel-1-1") {
          this.onTabOpen_delayUpdateTabBar(tab);
        }
      });
    }
  },

  onSSTabRestored(tab) {
    Tabmix.restoreTabState(tab);

    // don't mark new tab as unread
    let url = SessionStore.getLazyTabValue(tab, "url") || tab.linkedBrowser.currentURI.spec;
    if (Tabmix.isBlankNewTab(url)) {
      tab.setAttribute("visited", true);
    }
  },

  onFullScreen: function TMP_EL_onFullScreen(enterFS) {
    var fullScrToggler = document.getElementById("fullscr-bottom-toggler");
    if (enterFS && !TabmixSvc.isWaterfox && TabmixTabbar.position == 1) {
      if (!fullScrToggler.initialized) {
        fullScrToggler.addEventListener("mouseover", this._expandCallback);
        fullScrToggler.addEventListener("dragenter", this._expandCallback);
        fullScrToggler.addEventListener("touchmove", this._expandCallback, {passive: true});
        fullScrToggler.initialized = true;
      }
      if (!document.fullscreenElement) {
        fullScrToggler.hidden = false;
      }
    } else if (fullScrToggler && !enterFS) {
      this._updateMarginBottom("");
      fullScrToggler.hidden = true;
    }
    if (!enterFS) {
      this.updateMultiRow();
    }
  },

  showNavToolbox() {
    this._updateMarginBottom("");
    this.toggleTabbarVisibility(true);
    this.updateMultiRow();
    setTimeout(() => {
      this.updateMultiRow();
      // overwrite FullScreen.showNavToolbox calculation for _mouseTargetRect
      if (TabmixTabbar.position == 1) {
        this.updateMouseTargetRect();
      }
    }, 0);
    gBrowser.ensureTabIsVisible(gBrowser.selectedTab, false);
  },

  /*
   * for use in Firefox 40+.
   * update FullScreen._mouseTargetRect when in full screen and the tabbar is
   * visible. we call this function from and showNavToolbox
   */
  updateMouseTargetRect() {
    if (!window.fullScreen || FullScreen._isChromeCollapsed) {
      return;
    }

    let rect = gBrowser.tabpanels.getBoundingClientRect();
    FullScreen._mouseTargetRect = {
      top: rect.top + 50,
      bottom: rect.bottom - (TabmixTabbar.position === 1 ? 50 : 0),
      left: rect.left,
      right: rect.right,
    };
  },

  _updateMarginBottom: function TMP_EL__updateMarginBottom(aMargin) {
    if (TabmixTabbar.position == 1) {
      let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
      bottomToolbox.style.marginBottom = aMargin;
    }
  },

  _expandCallback: function TMP_EL__expandCallback() {
    if (TabmixTabbar.hideMode === 0 || (TabmixTabbar.hideMode === 1 && gBrowser.tabs.length > 1)) {
      FullScreen.showNavToolbox(true);
    }
  },

  // for tabs bellow content
  toggleTabbarVisibility(aShow, aAnimate) {
    let fullScrToggler = document.getElementById("fullscr-bottom-toggler");
    if (TabmixTabbar.position != 1 || !fullScrToggler) {
      return;
    }
    let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
    if (aShow) {
      fullScrToggler.hidden = true;
      bottomToolbox.removeAttribute("fullscreenShouldAnimate");
      bottomToolbox.style.marginBottom = "";
    } else {
      if (!BrowserHandler.kiosk) {
        fullScrToggler.hidden = false;
      }

      if (
        aAnimate &&
        window.matchMedia("(prefers-reduced-motion: no-preference)")?.matches &&
        !BrowserHandler.kiosk
      ) {
        bottomToolbox.setAttribute("fullscreenShouldAnimate", true);
      }

      bottomToolbox.style.marginBottom =
        -(
          bottomToolbox.getBoundingClientRect().height +
          (bottomToolbox.nextElementSibling?.getBoundingClientRect().height ?? 0)
        ) + "px";
    }
  },

  updateMultiRow(aReset) {
    if (aReset) {
      // @ts-expect-error - it's ok
      Tabmix.tabsNewtabButton = null;
    }
    if (TabmixTabbar.isMultiRow) {
      Tabmix.tabsUtils.updateVerticalTabStrip();
      TabmixTabbar.setFirstTabInRow();
    }
  },

  // Function to catch when new tabs are created and update tab icons if needed
  // In addition clicks and doubleclick events are trapped.
  onTabOpen: function TMP_EL_onTabOpen(aEvent) {
    Tabmix._lastTabOpenedTime = performance.timeOrigin + performance.now();
    var tab = aEvent.target;
    this.setTabAttribute(tab);
    TMP_LastTab.tabs = null;
    TMP_LastTab.attachTab(tab);
    Tabmix.tablib.setLoadURI(tab.linkedBrowser);
    if (TabmixTabbar.lockallTabs) {
      tab.setAttribute("locked", "true");
      tab.tabmix_allowLoad = false;
    }
    Tabmix.setTabStyle(tab);
    if (gBrowser.selectedTab.pinned && !tab.pinned) {
      TabmixTabbar.setFirstTabInRow();
    }
  },

  onTabBrowserInserted(event) {
    Tabmix.tablib.setLoadURI(event.target.linkedBrowser);
  },

  // this function call onTabOpen_updateTabBar after some delay
  // when more the one tabs opened at once
  lastTimeTabOpened: 0,
  onTabOpen_delayUpdateTabBar: function TMP_EL_onTabOpen_delayUpdateTabBar(aTab) {
    if (aTab.hasAttribute("pending")) {
      this.onSSTabRestored(aTab);
      if (Tabmix.isBlankNewTab(aTab.label)) {
        aTab.label = Tabmix.emptyTabTitle;
        gBrowser._tabAttrModified(aTab, ["label"]);
      }
    }

    this.tabWidthCache.set(aTab.tabmixKey, aTab.getBoundingClientRect().width);

    const newTime = performance.timeOrigin + performance.now();
    if (Tabmix.tabsUtils.overflow || newTime - this.lastTimeTabOpened > 200) {
      this.onTabOpen_updateTabBar(aTab);
      this.lastTimeTabOpened = newTime;
    } else if (!this._onOpenTimeout) {
      let self = this;
      let timeout =
        (
          Tabmix.tabsUtils.disAllowNewtabbutton &&
          window.matchMedia("(prefers-reduced-motion: no-preference)")?.matches
        ) ?
          0
        : 200;
      this._onOpenTimeout = window.setTimeout(
        function TMP_onOpenTimeout(/** @type {MockedGeckoTypes.BrowserTab} */ tab) {
          if (self._onOpenTimeout) {
            clearTimeout(self._onOpenTimeout);
            self._onOpenTimeout = null;
          }
          self.onTabOpen_updateTabBar(tab);
        },
        timeout,
        aTab
      );
    }
  },

  // TGM extension use it
  onTabOpen_updateTabBar: function TMP_EL_onTabOpen_updateTabBar(aTab) {
    if (aTab.__newLastTab) {
      delete aTab.__newLastTab;
      return;
    }
    var tabBar = gBrowser.tabContainer;
    if (!Tabmix.tabsUtils.overflow) {
      // we use it as a backup for overflow event and for the case that we have
      // pinned tabs in multi-row
      if (TabmixTabbar.isMultiRow && tabBar.arrowScrollbox.getAttribute("orient") != "vertical") {
        tabBar.arrowScrollbox._enterVerticalMode();
      } else {
        TabmixTabbar.updateScrollStatus();
      }
      // make sure selected new tabs stay visible
      if (aTab === gBrowser.selectedTab) {
        gBrowser.ensureTabIsVisible(aTab);
      }
    }
  },

  onTabClose: function TMP_EL_onTabClose(aEvent) {
    // aTab is the tab we are closing now
    var tab = aEvent.target;
    TMP_LastTab.tabs = null;
    TMP_LastTab.detachTab(tab);
    TMP_Places.updateRestoringTabsList(tab);
    var tabBar = gBrowser.tabContainer;

    // if we close the 2nd tab and tabbar is hide when there is only one tab
    // reset all scroll and multi-row parameter
    // strip already collapsed at this point
    if (TabmixTabbar.hideMode == 1) {
      if (Tabmix.tabsUtils.getTabsCount() == 2) {
        tabBar.removeAttribute("tabmix-multibar");
      }
    }

    // when tab animations enabled is true gBrowser._endRemoveTab calls
    // onTabClose_updateTabBar.
    // we would like to get early respond when row height is going to change.
    var updateNow = gReduceMotion;
    if (!updateNow && TabmixTabbar.hasMultiRows) {
      let lastTab = Tabmix.visibleTabs.last;
      if (!TabmixTabbar.inSameRow(lastTab, Tabmix.visibleTabs.previous(lastTab))) {
        updateNow = true;
        // if the removed tab is single in its row hide it
        if (lastTab == tab) {
          tab.style.setProperty("opacity", "0", "important");
        }
      }
    }

    if (updateNow) {
      this.onTabClose_updateTabBar(tab);
    }

    if (Tabmix.selectedTab == tab) {
      Tabmix.selectedTab = null;
      Tabmix.userTypedValue = "";
    }

    // clean WeakMap
    if (this.tabWidthCache.has(tab.tabmixKey)) {
      this.tabWidthCache.delete(tab.tabmixKey);
    }

    if (TabmixTabbar.isMultiRow && Tabmix.tabsUtils.overflow) {
      setTimeout(() => {
        Tabmix.tabsUtils.updateVerticalTabStrip();
      }, 0);
    }
  },

  // TGM extension use it
  onTabClose_updateTabBar: function TMP_EL_onTabClose_updateTabBar(aTab) {
    var tabBar = gBrowser.tabContainer;
    function _updateTabstrip() {
      // underflow not always fires when Classic theme restorer installed
      let multibar = TabmixTabbar.multiRowState;
      if (multibar) {
        Tabmix.tabsUtils.tryRemoveTabmixScrollbox();
        let lastTabRowNumber = Tabmix.tabsUtils.lastTabRowNumber;
        if (multibar == "true" && lastTabRowNumber < TabmixTabbar.visibleRows) {
          Tabmix.tabsUtils.updateVerticalTabStrip();
        }
      }
    }

    // workaround when we remove last visible tab
    if (
      tabBar.allTabs[0].pinned &&
      TabmixTabbar.isMultiRow &&
      Tabmix.tabsUtils.overflow &&
      aTab._tPos >= Tabmix.visibleTabs.last._tPos
    ) {
      tabBar.arrowScrollbox.ensureElementIsVisible(gBrowser.selectedTab, true);
    }

    if (Tabmix.tabsUtils.disAllowNewtabbutton) {
      Tabmix.tabsUtils.adjustNewtabButtonVisibility();
    }

    if (TabmixTabbar.isMultiRow && TabmixTabbar.hasMultiRows) {
      _updateTabstrip();
      setTimeout(() => _updateTabstrip(), 0);
    }
  },

  onTabSelect: function TMP_EL_TabSelect(aEvent) {
    var tab = aEvent.target;

    if (
      TabmixTabbar.hideMode != 2 &&
      TabmixTabbar.widthFitTitle &&
      !tab.hasAttribute("width") &&
      tab.hasAttribute("pending")
    ) {
      tab.setAttribute("width", Tabmix.getBoundsWithoutFlushing(tab).width);
    }

    // for ColorfulTabs 6.0+
    // ColorfulTabs traps TabSelect event after we do
    // we need to set standout class before we check for getTabRowNumber
    // and arrowScrollbox.ensureElementIsVisible
    // this class change tab height (by changing the borders)
    if (
      typeof window.colorfulTabs == "object" &&
      window.colorfulTabs.standout &&
      !tab.classList.contains("standout")
    ) {
      for (const _tab of gBrowser.tabs) {
        if (_tab.classList.contains("standout")) {
          _tab.classList.remove("standout");
          break;
        }
      }
      tab.classList.add("standout");
    }

    // update this functions after new tab select
    tab.setAttribute("tabmix_selectedID", Tabmix._nextSelectedID++);

    if (!gMultiProcessBrowser) {
      this.updateDisplay(tab);
    }

    TMP_LastTab.OnSelect();
  },

  updateDisplay(tab) {
    if (!tab.hasAttribute("visited")) {
      tab.setAttribute("visited", true);
    }

    if (tab.hasAttribute("tabmix_pending")) {
      tab.removeAttribute("tabmix_pending");
    }

    Tabmix.setTabStyle(tab);

    if (
      tab.hasAttribute("showbutton") &&
      gBrowser.tabContainer.getAttribute("closebuttons") == "activetab"
    ) {
      tab.style.removeProperty("width");
    }
  },

  onTabMove: function TMP_EL_onTabMove(aEvent) {
    var tab = aEvent.target;

    // moveTabTo call _positionPinnedTabs when pinned tab moves
    if (!tab.pinned) {
      TabmixTabbar.setFirstTabInRow();
    }
  },

  onTabPinned(event) {
    Tabmix.tabsUtils.updatefirstTabInRowMargin();
    if (event.target.selected && Tabmix.prefs.getBoolPref("pinnedTabScroll")) {
      gBrowser.tabContainer.arrowScrollbox.scrollbox.scrollTop = 0;
    }
  },

  onTabUnpinned: function TMP_EL_onTabUnpinned(aEvent) {
    Tabmix.tabsUtils.updatefirstTabInRowMargin();
    var tab = aEvent.target;
    // we unlock the tab on unpinned only if we have this flag on
    // see TMP_eventListener.onContentLoaded
    if (tab.hasAttribute("_lockedAppTabs")) {
      gBrowser.lockTab(tab);
    }
    tab.style.marginTop = "";
    TabmixTabbar.updateScrollStatus();
  },

  onTabBarScroll: function TMP_EL_onTabBarScroll(aEvent) {
    var scrollTabs = Tabmix.prefs.getIntPref("scrollTabs");
    if (scrollTabs > 1) {
      aEvent.stopPropagation();
      aEvent.preventDefault();
      return;
    }
    let tabBar = gBrowser.tabContainer;
    let tabStrip = tabBar.arrowScrollbox;
    let orient = tabStrip.getAttribute("orient");
    TabmixTabbar.removeShowButtonAttr();

    let shouldMoveFocus = scrollTabs == 1;
    if (aEvent.shiftKey) {
      shouldMoveFocus = !shouldMoveFocus;
    }

    /** @type {number} */
    let direction;
    let isVertical = false;

    if (orient == "vertical") {
      direction = aEvent.deltaY;
    } else {
      isVertical = Math.abs(aEvent.deltaY) > Math.abs(aEvent.deltaX);
      let delta = isVertical ? aEvent.deltaY : aEvent.deltaX;
      direction = isVertical && tabStrip._isRTLScrollbox ? -delta : delta;
    }

    if (Tabmix.prefs.getBoolPref("reversedScroll")) {
      direction *= -1;
    }

    if (shouldMoveFocus) {
      aEvent.stopPropagation();
      aEvent.preventDefault();
      if (aEvent?.inputSource == MouseEvent.MOZ_SOURCE_MOUSE) {
        direction = direction > 0 ? 1 : -1;
        tabBar.advanceSelectedTab(direction, true);
        if (Tabmix.tabsUtils.isVerticalTabs) {
          gBrowser.selectedTab.scrollIntoView({
            block: "nearest",
            behavior: "smooth",
          });
        }
      }
    } else if (
      direction !== 0 &&
      !Tabmix.tabsUtils.isVerticalTabs &&
      !Tabmix.extensions.treeStyleTab
    ) {
      /**
       * this code is based on arrowscrollbox.js on_wheel event handler
       *
       * @param {number} delta
       * @param {boolean} useInstant
       */
      let scrollByDelta = function (delta, useInstant) {
        let instant;
        let scrollAmount = 0;
        if (TabmixTabbar.isMultiRow) {
          delta = delta > 0 ? 1 : -1;
          scrollAmount = delta * tabStrip.singleRowHeight + tabStrip._distanceToRow(0);
        } else if (aEvent.deltaMode == aEvent.DOM_DELTA_PIXEL) {
          scrollAmount = delta;
          instant = true;
        } else if (aEvent.deltaMode == aEvent.DOM_DELTA_PAGE) {
          scrollAmount = delta * tabStrip.scrollClientSize;
        } else if (Tabmix.prefs.getBoolPref("useScrollByTabs")) {
          delta = delta > 0 ? 1 : -1;
          tabStrip.scrollByIndex(delta * Tabmix.prefs.getIntPref("scrollByTabs"));
          return;
        } else {
          scrollAmount = delta * tabStrip.lineScrollAmount;
        }
        tabStrip.scrollByPixels(scrollAmount, useInstant && instant);
      };

      aEvent.stopPropagation();
      aEvent.preventDefault();

      if (!Tabmix.tabsUtils.overflow) {
        return;
      }

      if (orient == "vertical") {
        scrollByDelta(direction, false);
      } else {
        if (tabStrip._prevMouseScrolls.every(prev => prev == isVertical)) {
          scrollByDelta(direction, true);
        }

        if (tabStrip._prevMouseScrolls.length > 1) {
          tabStrip._prevMouseScrolls.shift();
        }

        tabStrip._prevMouseScrolls.push(isVertical);
      }
    }
  },

  onWindowClose: function TMP_EL_onWindowClose() {
    window.removeEventListener("unload", this);
    window.removeEventListener("SSWindowRestored", this);

    Tabmix.closedObjectsUtils.removeObservers();
    TabmixTabClickOptions.toggleEventListener(false);
    TabmixContext.toggleEventListener(false);
    Tabmix.handleTabbarVisibility.toggleEventListener(false);

    TMP_Places.deinit();
    TMP_LastTab.deinit();

    window.removeEventListener("fullscreen", this, true);
    var fullScrToggler = document.getElementById("fullscr-bottom-toggler");
    if (fullScrToggler) {
      fullScrToggler.removeEventListener("mouseover", this._expandCallback);
      fullScrToggler.removeEventListener("dragenter", this._expandCallback);
    }

    this.toggleEventListener(gBrowser.tabContainer, this._tabEvents, false);

    gBrowser.tabContainer.removeEventListener("wheel", this, true);
    gBrowser.tabContainer.arrowScrollbox.disconnectTabmix();

    gBrowser.tabpanels.removeEventListener(
      "click",
      Tabmix.contentAreaClick._contentLinkClick,
      true
    );

    gTMPprefObserver.removeObservers();
    gTMPprefObserver.dynamicRules = {};

    TabmixProgressListener.listener.mTabBrowser = null;
    gBrowser.removeTabsProgressListener(TabmixProgressListener.listener);

    Tabmix.slideshow.cancel();
    Tabmix.navToolbox.deinit();
    Tabmix.Utils.deinit(window);
    Tabmix.tabsUtils.onUnload();
  },

  // some theme not using up to date Tabmix tab binding
  // we check here that all of our attribute exist
  setTabAttribute: function TMP_EL_setTabAttribute(aTab) {
    let reloadIcon = aTab.getElementsByAttribute("class", "tab-reload-icon")[0];
    if (!reloadIcon) {
      let lockIcon = aTab.getElementsByAttribute("class", "tab-lock-icon")[0];
      if (lockIcon) {
        let XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
        let image = document.createElementNS(XULNS, "image");
        image.setAttribute("class", "tab-reload-icon");
        lockIcon.parentNode?.appendChild(image);
      }
    }

    /** @type {TabmixEventListenerNS._updateAttrib} */
    function updateAttrib(aGetAtt, aGetValue, aAtt, aValue) {
      let node = aTab.getElementsByAttribute(aGetAtt, aGetValue)[0];
      Tabmix.setItem(node, aAtt, aValue);
    }
    updateAttrib("class", "tab-icon-image", "role", "presentation");
    updateAttrib("class", "tab-text", "role", "presentation");
  },

  addGroupMutationObserver() {
    /** @param {MockedGeckoTypes.MozTabbrowserTabGroup} group */
    const groupRemoved = group => {
      const groupLabel = group.labelElement.parentNode;
      if (groupLabel.hasAttribute("tabmix-firstTabInRow")) {
        group.hidden = true;
        const nextSibling = group.nextSibling;
        if (nextSibling) {
          group.nextSibling?.setAttribute("tabmix-firstTabInRow", true);
        }
      }
      this.updateMultiRow();
      Tabmix.tabsUtils.tryRemoveTabmixScrollbox();
    };

    // This observer manages:
    // update `new tab button` position when the pref is to show new-tab-button after last tab
    // the tabmix-firstTabInRow attribute which controls margin-inline-start
    // for elements after pinned tabs in multi-row mode. It prevents layout flickering when groups
    // are removed by immediately handling attribute transfers, rather than waiting for Firefox's
    // delayed "TabGroupRemoved" event. It also handles group creation directly instead of relying
    // on Firefox's "TabGroupCreate" event.
    const groupObserver = new MutationObserver(mutationList => {
      // Skip processing if not in multi-row mode with overflow and pinned tabs
      // or new tab button is after last tab
      if (
        !TabmixTabbar.isMultiRow ||
        (!gBrowser.pinnedTabCount && Tabmix.prefs.getIntPref("newTabButton.position") !== 2)
      ) {
        return;
      }
      for (const mutation of mutationList) {
        mutation.addedNodes.forEach(node => {
          if (gBrowser.isTab(node)) {
            // when tab removed from single tab group it was moved after the group
            const group = node.previousSibling;
            if (Tabmix.isTabGroup(group) && group.tabs.length === 0) {
              groupRemoved(group);
            }
            const nextSibling = node.nextSibling;
            if (
              !node.pinned &&
              nextSibling?.hasAttribute("tabmix-firstTabInRow") &&
              TabmixTabbar.inSameRow(node, nextSibling)
            ) {
              node.setAttribute("tabmix-firstTabInRow", true);
              nextSibling.removeAttribute("tabmix-firstTabInRow");
            }
          } else if (Tabmix.isTabGroup(node)) {
            this.updateMultiRow();
          }
        });

        mutation.removedNodes.forEach(node => {
          if (Tabmix.isTabGroup(node) && node.tabs.length === 0) {
            groupRemoved(node);
          }
        });
      }
    });

    const arrowScrollbox = gBrowser.tabContainer.arrowScrollbox;
    // @ts-expect-error - we modify the arrowScrollbox
    groupObserver.observe(arrowScrollbox, {childList: true});

    window.addEventListener(
      "unload",
      () => {
        if (groupObserver) {
          groupObserver.disconnect();
        }
      },
      {once: true}
    );
  },
};

/**
 * other extensions can cause delay to some of the events Tabmix uses for
 * initialization, for each phase call all previous phases that are not
 * initialized yet
 */
Tabmix.initialization = {
  init: {id: 0, obj: "Tabmix.tabsUtils"},
  beforeStartup: {id: 1, obj: "Tabmix"},
  onContentLoaded: {id: 2, obj: "TMP_eventListener"},
  beforeBrowserInitOnLoad: {id: 3, obj: "Tabmix"},
  onWindowOpen: {id: 4, obj: "TMP_eventListener"},
  afterDelayedStartup: {id: 5, obj: "Tabmix"},
  _lastPhase: 5,

  get isValidWindow() {
    // it is unlikely that we get her before SingleWindowModeUtils closes thw window
    let stopInitialization = window._tabmix_windowIsClosing;
    if (stopInitialization) {
      this.run = function () {};
      window.removeEventListener("load", TMP_eventListener);
    }

    Object.defineProperty(this, "run", {enumerable: false});
    Object.defineProperty(this, "isValidWindow", {
      value: !stopInitialization,
      enumerable: false,
    });
    // @ts-expect-error
    const value = Math.max(...Object.values(Tabmix.initialization).map(({id}) => id ?? 0));
    Object.defineProperty(this, "_lastPhase", {enumerable: false, value});
    return !stopInitialization;
  },

  run: function tabmix_initialization_run(aPhase) {
    if (!this.isValidWindow || !window.gBrowser) {
      return null;
    }
    let result,
      currentPhase = this[aPhase].id;
    let getObj = function (/** @type {string} */ list) {
      let obj = window;
      list.split(".").forEach(prop => (obj = obj[prop]));
      return obj;
    };
    for (const _key of Object.keys(this)) {
      /** @type {keyof InitializationSteps} */ // @ts-expect-error
      const key = _key;
      let phase = this[key];
      if (phase.id > currentPhase) {
        break;
      }

      if (!phase.initialized) {
        console.debug("Tabmix initializer:", {key, phase});
        phase.initialized = true;
        try {
          let obj = getObj(phase.obj);
          result = obj[key].apply(obj, Array.prototype.slice.call(arguments, 1));
          if (phase.id === this._lastPhase) {
            Tabmix._deferredInitialized.resolve();
          }
        } catch (ex) {
          Tabmix.assert(ex, phase.obj + "." + key + " failed");
        }
      }
    }
    return result;
  },
};

// A promise resolved once initialization is complete
Tabmix._deferredInitialized = (function () {
  /** @type {DeferredPromise} */
  let deferred = {};

  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  return deferred;
})();

/*
 * add backward compatibility getters to some of the main object/function/variable
 * that we changed from version 0.3.8.5pre.110123a
 * we only add this getters to objects the aren't in the name space
 */
Tabmix.backwardCompatibilityGetter(window, "TabDNDObserver", "TMP_tabDNDObserver");
Tabmix.backwardCompatibilityGetter(window, "gSingleWindowMode", "Tabmix.singleWindowMode");
Tabmix.backwardCompatibilityGetter(window, "TM_init", "Tabmix.startup");
Tabmix.backwardCompatibilityGetter(window, "tabscroll", "TabmixTabbar.scrollButtonsMode");
