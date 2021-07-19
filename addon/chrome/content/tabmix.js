"use strict";

/*
 * tabmix.js
 *
 * original code by Hemiola SUN, further developed by onemen and CPU
 */

Tabmix.startup = function TMP_startup() {
  var cmdNewWindow = document.getElementById("cmd_newNavigator");
  var originalNewNavigator = cmdNewWindow.getAttribute("oncommand");
  // When in single window mode allow one normal window and one private window.
  // otherwise open new tab in most recent window of the appropriate type
  this._openNewTab = function(aPrivate) {
    if (this.singleWindowMode) {
      let win = this.RecentWindow.getMostRecentBrowserWindow({private: aPrivate});
      if (win) {
        win.focus();
        win.BrowserOpenTab();
        return false;
      }
    }
    return true;
  };
  let command = document.getElementById("Tools:PrivateBrowsing");
  let originalCode = command.getAttribute("oncommand");
  Tabmix.setItem(command, "oncommand", "if (Tabmix._openNewTab(true)) {" + originalCode + "}");
  Tabmix.setItem(cmdNewWindow, "oncommand", "if (Tabmix._openNewTab(false)) {" + originalNewNavigator + "}");

  TabmixContext.toggleEventListener(true);

  // if sessionStore disabled use TMP command
  window.undoCloseTab = function ct_window_undoCloseTab(aIndex, aWhere) {
    return TMP_ClosedTabs.undoCloseTab(aIndex, aWhere);
  };
};

// we call this function from gBrowserInit._delayedStartup, see setup.js
Tabmix.beforeDelayedStartup = function() {
  if (this.isFirstWindow) {
    ChromeUtils.import("chrome://tabmix-resource/content/extensions/AddonManager.jsm");
    TMP_SessionStore.setService(1, true);
  }
};

// after TabmixSessionManager and SessionStore initialized
Tabmix.sessionInitialized = function() {
  if (Tabmix.fixMultibarRowHeight) {
    delete Tabmix._fixMultibarRowHeight;
    Tabmix.tabsUtils.updateVerticalTabStrip(true);
  }

  var SM = TabmixSessionManager;
  if (SM.enableManager) {
    window.restoreLastSession = function restoreLastSession() {
      TabmixSessionManager.restoreLastSession();
    };

    this.setItem("Browser:RestoreLastSession", "disabled",
      !SM.canRestoreLastSession || SM.isPrivateWindow);
  }

  const tab = gBrowser.tabContainer.allTabs[0];
  if (!tab.selected) {
    tab.removeAttribute("visited");
    tab.removeAttribute("tabmix_selectedID");
    Tabmix.setTabStyle(tab);
  }

  TMP_SessionStore.persistTabAttribute();

  TMP_ClosedTabs.setButtonDisableState();
  if (this.firstWindowInSession) {
    Tabmix.closedObjectsUtils.toggleRecentlyClosedWindowsButton();
  }
};

Tabmix.getAfterTabsButtonsWidth = function TMP_getAfterTabsButtonsWidth() {
  if (gBrowser.tabContainer.getAttribute("orient") == "horizontal") {
    const {toolbar, tabBar, collapsed, tabBarCollapsed, toolbarCollapsed} =
  Tabmix.tabsUtils.getCollapsedState;
    let stripIsHidden = TabmixTabbar.hideMode !== 0 && collapsed;
    if (stripIsHidden) {
      toolbar.collapsed = false;
      tabBar.collapsed = false;
    }
    // save tabsNewtabButton width
    this.tabsNewtabButton =
      tabBar.getElementsByAttribute("command", "cmd_newNavigatorTab")[0];
    this.tabsNewtabButton.setAttribute("force-display", true);
    let openNewTabRect = Tabmix.getBoundsWithoutFlushing(this.tabsNewtabButton);
    let style = window.getComputedStyle(this.tabsNewtabButton);
    let marginStart = style.getPropertyValue("margin-left");
    // it doesn't work when marginEnd add to buttonWidth
    // let marginEnd = style.getPropertyValue("margin-right");
    // let buttonWidth = openNewTabRect.width + parseFloat(marginStart) + parseFloat(marginEnd);
    let buttonWidth = openNewTabRect.width + parseFloat(marginStart);
    if (buttonWidth > 0) {
      this.afterTabsButtonsWidth = [];
      this.afterTabsButtonsWidth.push(buttonWidth);
    }

    // when privateTab extension installed add its new tab button width
    // for the use of adjustNewtabButtonVisibility set tabsNewtabButton to be
    // the right button
    let openNewPrivateTab = document.getElementById("privateTab-afterTabs-openNewPrivateTab");
    if (openNewPrivateTab) {
      let openNewPrivateTabRect = Tabmix.getBoundsWithoutFlushing(openNewPrivateTab);
      this.afterTabsButtonsWidth.push(openNewPrivateTabRect.width);
      if (openNewPrivateTabRect.right > openNewTabRect.right)
        this.tabsNewtabButton = openNewPrivateTab;
    }
    this.tabsNewtabButton.removeAttribute("force-display", true);
    if (stripIsHidden) {
      toolbar.collapsed = toolbarCollapsed;
      tabBar.collapsed = tabBarCollapsed;
    }
  }
};

Tabmix.afterDelayedStartup = function() {
  if (this._callPrepareLoadOnStartup) {
    gBrowserInit._uriToLoadPromise
        .then(uriToLoad => this.prepareLoadOnStartup(uriToLoad))
        .then(() => TabmixSessionManager.init());
  } else {
    this.prepareLoadOnStartup();
    TabmixSessionManager.init();
  }

  // focus address-bar area if the selected tab is blank when Firefox starts
  // focus content area if the selected tab is not blank when Firefox starts
  setTimeout(() => {
    const isBlank = gBrowser.isBlankNotBusyTab(gBrowser.selectedTab);
    if (gURLBar.focused && !isBlank) {
      gBrowser.selectedBrowser.focus();
    } else if (!gURLBar.focused && isBlank) {
      gURLBar.focus();
    }
  }, 250);

  TMP_TabView.init();

  TMP_Places.onDelayedStartup();

  this.navToolbox.init();

  // set option to Prevent clicking on Tab-bar from dragging the window.
  if (this.prefs.getBoolPref("tabbar.click_dragwindow")) {
    if (!Tabmix.prefs.getBoolPref("tabbar.dblclick_changesize"))
      TabmixTabClickOptions.toggleEventListener(true);
  } else {
    gTMPprefObserver.setTabbarDragging(false);
  }

  TMP_extensionsCompatibility.onDelayedStartup();

  setTimeout(() => Tabmix.getAfterTabsButtonsWidth(), 100);

  gTMPprefObserver.setMenuIcons();

  TabmixTabbar.updateSettings(true);
  gTMPprefObserver.setTabIconMargin();
  gTMPprefObserver.setCloseButtonMargin();
  gTMPprefObserver.miscellaneousRules();
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
  let gnb = Tabmix._debugMode &&
            (document.getElementById("high-priority-global-notificationbox") ||
            document.getElementById("global-notificationbox"));
  if (gnb) {
    let buttons = [{
      label: "Disable Debug Mode",
      accessKey: "D",
      callback() {
        Tabmix.prefs.setBoolPref("enableDebug", false);
      }
    }];
    let msg = "Tab Mix is in debug mode!\n " +
      "In case it's activated accidentally, click the button to disable it " +
      "or set 'extensions.tabmix.enableDebug' in about:config to false. " +
      "Once you disable 'Debug Mode' restart your browser.";
    const errorimage = "chrome://tabmixplus/skin/tmpsmall.png";
    gnb.appendNotification(msg, "tabmix-debugmode-enabled",
      errorimage, gnb.PRIORITY_CRITICAL_HIGH, buttons);
  }
};

var TMP_eventListener = {
  init: function TMP_EL_init() {
    window.addEventListener("load", this);
    window.addEventListener("SSWindowRestored", this);
    window.delayedStartupPromise.then(() => {
      Tabmix.initialization.run("afterDelayedStartup");
    });
  },

  handleEvent: function TMP_EL_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "TabAttrModified":
        this.onTabAttrModified(aEvent);
        break;
      case "SSWindowClosing":
        window.removeEventListener("SSWindowClosing", this);
        TabmixSessionManager.onWindowClose(!Tabmix.numberOfWindows());
        break;
      case "SSWindowRestored":
        this.onSSWindowRestored();
        break;
      case "SSTabRestoring":
        this.onSSTabRestoring(aEvent.target);
        break;
      case "TabOpen":
        this.onTabOpen(aEvent);
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
      case "TabUnpinned":
        this.onTabUnpinned(aEvent);
        break;
      case "DOMMouseScroll":
      case "wheel":
        this.onTabBarScroll(aEvent);
        break;
      case "load":
        this._onLoad(aEvent.type);
        break;
      case "unload":
        this.onWindowClose(aEvent);
        break;
      case "fullscreen": {
        let enterFS = window.fullScreen;
        this.onFullScreen(enterFS);
        break;
      }
      case "PrivateTab:PrivateChanged":
        TabmixSessionManager.privateTabChanged(aEvent);
        break;
    }
  },

  toggleEventListener(aObj, aArray, aEnable, aHandler) {
    var handler = aHandler || this;
    var eventListener = aEnable ? "addEventListener" : "removeEventListener";
    aArray.forEach(function(eventName) {
      aObj[eventListener](eventName, this, true);
    }, handler);
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
      /**
      *  aObject, aName , aModule - file name , aSymbol - symbol in EXPORTED_SYMBOLS, aFlag, aArg
      */
      Tabmix.lazy_import(Tabmix, "flst", "Slideshow", "flst", true);
      Tabmix.lazy_import(Tabmix, "MergeWindows", "MergeWindows", "MergeWindows");
      Tabmix.lazy_import(Tabmix, "autoReload", "AutoReload", "AutoReload");
      Tabmix.lazy_import(Tabmix, "renameTab", "RenameTab", "RenameTab");
      Tabmix.lazy_import(TabmixSessionManager, "_decode", "Decode", "Decode");
      Tabmix.lazy_import(Tabmix, "docShellCapabilities",
        "DocShellCapabilities", "DocShellCapabilities");
      Tabmix.lazy_import(Tabmix, "Utils", "Utils", "TabmixUtils");
    } catch (ex) {
      Tabmix.assert(ex);
    }

    this._tabEvents = ["SSTabRestoring", "PrivateTab:PrivateChanged",
      "TabOpen", "TabClose", "TabSelect", "TabMove", "TabUnpinned",
      "TabAttrModified"];
    this.toggleEventListener(gBrowser.tabContainer, this._tabEvents, true);

    gBrowser.selectedTab.tabmixKey = {};
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
  },

  onWindowOpen: function TMP_EL_onWindowOpen() {
    window.addEventListener("unload", this);
    window.addEventListener("SSWindowClosing", this);
    window.addEventListener("fullscreen", this, true);

    Tabmix.Utils.initMessageManager(window);

    var tabBar = gBrowser.tabContainer;
    tabBar.addEventListener("wheel", this, true);

    try {
      TabmixProgressListener.startup(gBrowser);
    } catch (ex) {
      Tabmix.assert(ex);
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
      // get Mac drop indicator marginBottom ,   Mac default theme have marginBottom: -24px
      let ind = gBrowser.tabContainer._tabDropIndicator;
      if (ind) {
        TMP_tabDNDObserver.marginBottom = Tabmix.getStyle(ind, "marginBottom");
      }
    }

    var tabsToolbar = document.getElementById("TabsToolbar");

    const skin = Services.prefs.getCharPref("extensions.activeThemeID", "");
    if (skin == "classic/1.0") {
      if (TabmixSvc.isMac)
        tabBar.setAttribute("classic", "v4Mac");
      else if (TabmixSvc.isLinux) {
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
      /**
       * some theme like Vista-aero 3.0.0.91 and BlueSky 3.0.0.91
       * use TMP_TBP_Startup in stylesheet window[onload="TMP_TBP_Startup()"]
       */
      Tabmix.setItem("main-window", "onload", "TMP_TBP_Startup();");

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
          if (rightBox)
            rightBox.setAttribute("vista_aero", true);
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

    if (Tabmix.singleWindowMode)
      gTMPprefObserver.setSingleWindowUI();

    // if treeStyleTab extension installed we call this from
    // Tabmix.afterDelayedStartup
    if (!Tabmix.extensions.treeStyleTab)
      Tabmix.navToolbox.tabStripAreaChanged();

    TMP_ClosedTabs.setButtonType(Tabmix.prefs.getBoolPref("undoCloseButton.menuonly"));

    TabmixTabbar.hideMode = Tabmix.prefs.getIntPref("hideTabbar");
    /**
     *  In the first time TMP is running we need to match extensions.tabmix.hideTabbar to browser.tabs.autoHide.
     *  extensions.tabmix.hideTabbar default is 0 "Never Hide tabbar"
     *  if browser.tabs.autoHide is true we need to make sure extensions.tabmix.hideTabbar
     *  is set to 1 "Hide tabbar when i have only one tab":
     */
    gTMPprefObserver.setAutoHidePref();

    if (TabmixTabbar.hideMode == 2) {
      TabBarVisibility.update();
    }

    if (Tabmix.prefs.getIntPref("tabBarPosition") == 1)
      gTMPprefObserver.tabBarPositionChanged(1);

    // for light weight themes
    if (TabmixTabbar.isMultiRow || TabmixTabbar.position == 1)
      Tabmix.setItem("main-window", "tabmix_lwt", true);

    // make sure "extensions.tabmix.undoClose" is true if "browser.sessionstore.max_tabs_undo" is not zero
    var sessionstoreUndoClose = Services.prefs.getIntPref("browser.sessionstore.max_tabs_undo") > 0;
    if (sessionstoreUndoClose != Tabmix.prefs.getBoolPref("undoClose"))
      Tabmix.prefs.setBoolPref("undoClose", sessionstoreUndoClose);

    // apply style on tabs
    let styles = ["currentTab", "unloadedTab", "unreadTab", "otherTab"];
    styles.forEach(ruleName => {
      gTMPprefObserver.updateTabsStyle(ruleName);
    });
    // progressMeter on tabs
    gTMPprefObserver.setProgressMeter();

    // tabmix Options in Tools menu
    document.getElementById("tabmix-menu").hidden = !Tabmix.prefs.getBoolPref("optionsToolMenu");
    document.getElementById("tabmix-historyUndoWindowMenu").hidden = !Tabmix.prefs.getBoolPref("closedWinToolsMenu");

    // ##### disable Session Manager #####
    // TabmixSessionManager.updateSettings();

    Tabmix.changeCode(tabBar, "gBrowser.tabContainer._updateCloseButtons")._replace(
      'this._getVisibleTabs()[gBrowser._numPinnedTabs];',
      'TMP_TabView.checkTabs(Tabmix.visibleTabs.tabs);'
    ).toCode(false, tabBar, "tabmix_updateCloseButtons");

    Tabmix.setNewFunction(tabBar, "_updateCloseButtons", Tabmix._updateCloseButtons);
    delete Tabmix._updateCloseButtons;

    // update tooltip for tabmix-tabs-closebutton
    document.getElementById("tabmix-tabs-closebutton").setAttribute('tooltiptext',
      PluralForm.get(
        1,
        gTabBrowserBundle.GetStringFromName("tabs.closeTabs.tooltip")
      ));

    Tabmix.allTabs.init();

    MozXULElement.insertFTLIfNeeded("browser/tabContextMenu.ftl");
    Tabmix.setFTLDataId("tm-content-undoCloseTab");
    Tabmix.setFTLDataId("tm-content-closetab");
  },

  tabWidthCache: new WeakMap(),
  onTabAttrModified(aEvent) {
    if (!TabmixTabbar.widthFitTitle)
      return;

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
    if (Services.prefs.getBoolPref("browser.sessionstore.restore_tabs_lazily", false)) {
      // make sure we are fulli initialized
      await Tabmix._deferredInitialized.promise;
      gBrowser.tabs.forEach(tab => {
        if (tab.hasAttribute("pending")) {
          const url = TabmixSvc.ss.getLazyTabValue(tab, "url");
          TMP_Places.asyncSetTabTitle(tab, url);
        }
      });
    }
  },

  onSSTabRestoring: function TMP_EL_onSSTabRestoring(tab) {
    Tabmix.restoreTabState(tab);
    TabmixSessionManager.restoreHistoryComplete(tab);

    gBrowser.ensureTabIsVisible(gBrowser.selectedTab, false);

    // don't mark new tab as unread
    let url = TabmixSvc.ss.getLazyTabValue(tab, "url") || tab.linkedBrowser.currentURI.spec;
    if (url == TabmixSvc.aboutBlank || url == TabmixSvc.aboutNewtab)
      tab.setAttribute("visited", true);
  },

  onFullScreen: function TMP_EL_onFullScreen(enterFS) {
    // add fullscr-bottom-toggler when tabbar is on the bottom
    var fullScrToggler = document.getElementById("fullscr-bottom-toggler");
    if (enterFS && TabmixTabbar.position == 1) {
      if (!fullScrToggler) {
        fullScrToggler = document.createElement("hbox");
        fullScrToggler.id = "fullscr-bottom-toggler";
        fullScrToggler.addEventListener("mouseover", this._expandCallback);
        fullScrToggler.addEventListener("dragenter", this._expandCallback);
        fullScrToggler.hidden = true;
        let bottombox = document.getElementById("browser-bottombox");
        bottombox.appendChild(fullScrToggler);

        let $LF = '\n    ';
        Tabmix.changeCode(FullScreen, "FullScreen.hideNavToolbox")._replace(
          'this._isChromeCollapsed = true;',
          'TMP_eventListener._updateMarginBottom(gNavToolbox.style.marginTop);' + $LF +
            '$&' + $LF +
            'TMP_eventListener.toggleTabbarVisibility(false, arguments[0]);'
        ).toCode();
      }
      if (!document.fullscreenElement) {
        fullScrToggler.hidden = false;
      }
    } else if (fullScrToggler && !enterFS) {
      this._updateMarginBottom("");
      fullScrToggler.hidden = true;
    }
    if (!enterFS)
      this.updateMultiRow();
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

  /**
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
      bottom: rect.bottom - (TabmixTabbar.position == 1) * 50,
      left: rect.left,
      right: rect.right
    };
  },

  _updateMarginBottom: function TMP_EL__updateMarginBottom(aMargin) {
    if (TabmixTabbar.position == 1) {
      let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
      bottomToolbox.style.marginBottom = aMargin;
    }
  },

  _expandCallback: function TMP_EL__expandCallback() {
    if (TabmixTabbar.hideMode === 0 || TabmixTabbar.hideMode == 1 && gBrowser.tabs.length > 1) {
      FullScreen.mouseoverToggle(true);
    }
  },

  // for tabs bellow content
  toggleTabbarVisibility(aShow, aAnimate) {
    let fullScrToggler = document.getElementById("fullscr-bottom-toggler");
    if (TabmixTabbar.position != 1 || !fullScrToggler) {
      return;
    }
    fullScrToggler.hidden = aShow;
    let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
    if (aShow) {
      bottomToolbox.style.marginBottom = "";
      gTMPprefObserver.updateTabbarBottomPosition();
    } else {
      let bottombox = document.getElementById("browser-bottombox");
      bottomToolbox.style.marginBottom =
          -(bottomToolbox.getBoundingClientRect().height +
          bottombox.getBoundingClientRect().height) + "px";

      if (aAnimate &&
          Services.prefs.getBoolPref("toolkit.cosmeticAnimations.enabled")) {
        // Hide the fullscreen toggler until the transition ends.
        let listener = function() {
          gNavToolbox.removeEventListener("transitionend", listener, true);
          if (FullScreen._isChromeCollapsed)
            fullScrToggler.hidden = false;
        };
        gNavToolbox.addEventListener("transitionend", listener, true);
        fullScrToggler.hidden = true;
      }
      gTMPprefObserver.updateTabbarBottomPosition();
    }
  },

  updateMultiRow(aReset) {
    if (aReset)
      Tabmix.tabsNewtabButton = null;
    if (TabmixTabbar.isMultiRow) {
      Tabmix.tabsUtils.updateVerticalTabStrip();
      TabmixTabbar.setFirstTabInRow();
      TabmixTabbar.updateBeforeAndAfter();
    }
  },

  // Function to catch when new tabs are created and update tab icons if needed
  // In addition clicks and doubleclick events are trapped.
  onTabOpen: function TMP_EL_onTabOpen(aEvent) {
    Tabmix._lastTabOpenedTime = Date.now();
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
  },

  // this function call onTabOpen_updateTabBar after some delay
  // when more the one tabs opened at once
  lastTimeTabOpened: 0,
  onTabOpen_delayUpdateTabBar: function TMP_EL_onTabOpen_delayUpdateTabBar(aTab) {
    if (aTab.hasAttribute("pending")) {
      this.onSSTabRestoring(aTab);
      if (aTab.label == "about:blank") {
        aTab.label = Tabmix.getString("tabs.emptyTabTitle");
        gBrowser._tabAttrModified(aTab, ["label"]);
      }
    }

    aTab.tabmixKey = {};
    this.tabWidthCache.set(aTab.tabmixKey, aTab.getBoundingClientRect().width);

    let newTime = Date.now();
    if (Tabmix.tabsUtils.overflow || newTime - this.lastTimeTabOpened > 200) {
      this.onTabOpen_updateTabBar(aTab);
      this.lastTimeTabOpened = newTime;
    } else if (!this._onOpenTimeout) {
      let self = this;
      let timeout = Tabmix.tabsUtils.disAllowNewtabbutton &&
          window.matchMedia("(prefers-reduced-motion: no-preference)").matches ? 0 : 200;
      this._onOpenTimeout = window.setTimeout(function TMP_onOpenTimeout(tab) {
        if (self._onOpenTimeout) {
          clearTimeout(self._onOpenTimeout);
          self._onOpenTimeout = null;
        }
        self.onTabOpen_updateTabBar(tab);
      }, timeout, aTab);
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
      if (TabmixTabbar.isMultiRow && tabBar.arrowScrollbox.getAttribute('orient') != "vertical")
        tabBar.arrowScrollbox._enterVerticalMode();
      else
        TabmixTabbar.updateScrollStatus();
      // make sure selected new tabs stay visible
      if (aTab == tabBar.selectedItem)
        gBrowser.ensureTabIsVisible(aTab);
    }
    TabmixTabbar.updateBeforeAndAfter();
  },

  onTabClose: function TMP_EL_onTabClose(aEvent) {
    // aTab is the tab we are closing now
    var tab = aEvent.target;
    tab._tPosInGroup = TMP_TabView.getTabPosInCurrentGroup(tab);
    TMP_LastTab.tabs = null;
    TMP_LastTab.detachTab(tab);
    TMP_Places.updateRestoringTabsList(tab);
    var tabBar = gBrowser.tabContainer;

    // if we close the 2nd tab and tabbar is hide when there is only one tab
    // reset all scroll and multi-row parameter
    // strip already collapsed at this point
    if (TabmixTabbar.hideMode == 1) {
      let tabsCount = tabBar.allTabs.length - gBrowser._removingTabs.length;
      if (tabsCount == 2) {
        tabBar.removeAttribute("multibar");
      }
    }

    // when tab animations enabled is true gBrowser._endRemoveTab calls
    // onTabClose_updateTabBar.
    // we would like to get early respond when row height is going to change.
    var updateNow = gReduceMotion;
    if (!updateNow && tabBar.hasAttribute("multibar")) {
      let lastTab = Tabmix.visibleTabs.last;
      if (!TabmixTabbar.inSameRow(lastTab, Tabmix.visibleTabs.previous(lastTab))) {
        updateNow = true;
        // if the removed tab is single in its row hide it
        if (lastTab == tab)
          tab.style.setProperty("opacity", "0", "important");
      }
    }

    if (updateNow)
      this.onTabClose_updateTabBar(tab);

    if (Tabmix.selectedTab == tab) {
      Tabmix.selectedTab = null;
      Tabmix.userTypedValue = "";
    }

    // clean WeakMap
    if (this.tabWidthCache.has(tab.tabmixKey)) {
      this.tabWidthCache.delete(tab.tabmixKey);
    }
  },

  // TGM extension use it
  onTabClose_updateTabBar: function TMP_EL_onTabClose_updateTabBar(aTab) {
    // if the tab is not in the current group we don't have to do anything here.
    if (typeof aTab._tPosInGroup == "number" && aTab._tPosInGroup == -1)
      return;

    var tabBar = gBrowser.tabContainer;
    function _updateTabstrip() {
      // underflow not always fires when Classic theme restorer installed
      let multibar = tabBar.getAttribute("multibar");
      if (multibar) {
        let lastTabRowNumber = Tabmix.tabsUtils.lastTabRowNumber;
        if (multibar == "true" &&
            lastTabRowNumber < TabmixTabbar.visibleRows) {
          Tabmix.tabsUtils.updateVerticalTabStrip();
        }
      }
      TabmixTabbar.updateBeforeAndAfter();
    }

    // workaround when we remove last visible tab
    if (tabBar.allTabs[0].pinned && TabmixTabbar.isMultiRow && Tabmix.tabsUtils.overflow &&
        aTab._tPos >= Tabmix.visibleTabs.last._tPos) {
      tabBar.arrowScrollbox.ensureElementIsVisible(gBrowser.selectedTab, true);
    }

    if (Tabmix.tabsUtils.disAllowNewtabbutton)
      Tabmix.tabsUtils.adjustNewtabButtonVisibility();
    if (TabmixTabbar.isMultiRow && tabBar.hasAttribute("multibar")) {
      _updateTabstrip();
      setTimeout(() => _updateTabstrip(), 0);
    }
  },

  onTabSelect: function TMP_EL_TabSelect(aEvent) {
    var tab = aEvent.target;

    if (TabmixTabbar.hideMode != 2 && TabmixTabbar.widthFitTitle &&
        !tab.hasAttribute("width") && tab.hasAttribute("pending")) {
      tab.setAttribute("width", Tabmix.getBoundsWithoutFlushing(tab).width);
    }

    // for ColorfulTabs 6.0+
    // ColorfulTabs traps TabSelect event after we do
    // we need to set standout class before we check for getTabRowNumber
    // and arrowScrollbox.ensureElementIsVisible
    // this class change tab height (by changing the borders)
    if (typeof window.colorfulTabs == "object" && window.colorfulTabs.standout &&
        !tab.classList.contains("standout")) {
      for (let i = 0; i < gBrowser.tabs.length; i++) {
        let _tab = gBrowser.tabs[i];
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
    TabmixSessionManager.tabSelected(true);
  },

  updateDisplay(tab) {
    if (!tab.hasAttribute("visited"))
      tab.setAttribute("visited", true);

    if (tab.hasAttribute("tabmix_pending"))
      tab.removeAttribute("tabmix_pending");
    Tabmix.setTabStyle(tab);

    if (tab.hasAttribute("showbutton") &&
        gBrowser.tabContainer.getAttribute("closebuttons") == "activetab")
      tab.style.removeProperty("width");
  },

  onTabMove: function TMP_EL_onTabMove(aEvent) {
    var tab = aEvent.target;

    // moveTabTo call _positionPinnedTabs when pinned tab moves
    if (!tab.pinned)
      TabmixTabbar.setFirstTabInRow();
    TabmixSessionManager.tabMoved(tab, aEvent.detail, tab._tPos);

    TabmixTabbar.updateBeforeAndAfter();
  },

  onTabUnpinned: function TMP_EL_onTabUnpinned(aEvent) {
    var tab = aEvent.target;
    // we unlock the tab on unpinned only if we have this flag on
    // see TMP_eventListener.onContentLoaded
    if (tab.hasAttribute("_lockedAppTabs")) {
      gBrowser.lockTab(tab);
    }
    tab.style.marginTop = "";
    TabmixTabbar.updateScrollStatus();
    TabmixTabbar.updateBeforeAndAfter();
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
    if (aEvent.shiftKey)
      shouldMoveFocus = !shouldMoveFocus;

    let direction, isVertical;

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
      if (aEvent.mozInputSource == MouseEvent.MOZ_SOURCE_MOUSE) {
        direction = direction > 0 ? 1 : -1;
        tabBar.advanceSelectedTab(direction, true);
      }
    } else if (direction !== 0 && !Tabmix.extensions.treeStyleTab) {
      // this code is based on arrowscrollbox.js on_wheel event handler
      let scrollByDelta = function(delta, useInstant) {
        let instant;
        let scrollAmount = 0;
        if (TabmixTabbar.isMultiRow) {
          delta = delta > 0 ? 1 : -1;
          scrollAmount = delta * tabStrip.lineScrollAmount;
        } else if (aEvent.deltaMode == aEvent.DOM_DELTA_PIXEL) {
          scrollAmount = delta;
          instant = true;
        } else if (aEvent.deltaMode == aEvent.DOM_DELTA_PAGE) {
          scrollAmount = delta * tabStrip.scrollClientSize;
        } else {
          scrollAmount = delta * tabStrip.lineScrollAmount;
        }
        tabStrip.scrollByPixels(scrollAmount, useInstant && instant);
      };

      aEvent.stopPropagation();
      aEvent.preventDefault();

      if (orient == "vertical") {
        scrollByDelta(direction, false);
      } else {
        if (tabStrip._prevMouseScrolls.every(prev => prev == isVertical)) {
          scrollByDelta(direction, true);
        }

        if (tabStrip._prevMouseScrolls.length > 1)
          tabStrip._prevMouseScrolls.shift();
        tabStrip._prevMouseScrolls.push(isVertical);
      }
    }
  },

  onWindowClose: function TMP_EL_onWindowClose() {
    window.removeEventListener("unload", this);
    window.removeEventListener("SSWindowClosing", this);
    window.removeEventListener("SSWindowRestored", this);

    // notice that windows enumerator don't count this window
    var isLastWindow = Tabmix.numberOfWindows() === 0;
    // we close tabmix dialog windows on exit
    if (isLastWindow) {
      ["tabmixopt-filetype", "tabmixopt-appearance", "tabmixopt"].forEach(aID => {
        var win = Services.wm.getMostRecentWindow("mozilla:" + aID);
        if (win) {
          if (aID != "tabmixopt")
            win.close();
          else
            win.setTimeout(() => win.close(), 0);
        }
      });
    }

    TabmixSessionManager.shutDown(true, isLastWindow, true);
    Tabmix.closedObjectsUtils.removeObservers();
    TabmixTabClickOptions.toggleEventListener(false);
    TabmixContext.toggleEventListener(false);

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

    if (TMP_TabView.installed)
      TMP_TabView._resetTabviewFrame();
    gBrowser.tabpanels.removeEventListener("click", Tabmix.contentAreaClick._contentLinkClick, true);

    gTMPprefObserver.removeObservers();
    gTMPprefObserver.dynamicRules = null;

    TabmixProgressListener.listener.mTabBrowser = null;
    gBrowser.removeTabsProgressListener(TabmixProgressListener.listener);

    Tabmix.slideshow.cancel();
    Tabmix.navToolbox.deinit();
    Tabmix.Utils.deinit(window);
    Tabmix.tabsUtils.onUnload();
    Tabmix.bottomToolbarUtils.onUnload();
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
        lockIcon.parentNode.appendChild(image);
      }
    }

    function updateAttrib(aGetAtt, aGetValue, aAtt, aValue) {
      let node = aTab.getElementsByAttribute(aGetAtt, aGetValue)[0];
      Tabmix.setItem(node, aAtt, aValue);
    }
    updateAttrib("class", "tab-icon-image", "role", "presentation");
    updateAttrib("class", "tab-text", "role", "presentation");
  }

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

  get isValidWindow() {
    TabmixSvc.loadDefaultPreferences();
    /**
      * don't initialize Tabmix functions on this window if one of this is true:
      *  - the window is about to close by SingleWindowModeUtils
      *  - tabbrowser-tabs binding didn't start (i only saw it happened
      *       when ImTranslator extension installed)
      */
    let stopInitialization = false;
    Tabmix.singleWindowMode = Tabmix.prefs.getBoolPref("singleWindow");
    if (Tabmix.singleWindowMode) {
      const tmp = ChromeUtils.import("chrome://tabmix-resource/content/SingleWindowModeUtils.jsm");
      stopInitialization = tmp.SingleWindowModeUtils.newWindow(window);
    }

    if (stopInitialization) {
      this.run = function() {};
      window.removeEventListener("load", TMP_eventListener);
    }

    delete this.isValidWindow;
    Object.defineProperty(this, "run", {enumerable: false});
    Object.defineProperty(this, "isValidWindow", {
      value: !stopInitialization,
      enumerable: false
    });
    const value = Math.max(...Object.values(Tabmix.initialization).map(({id}) => id));
    Object.defineProperty(this, "_lastPhase", {enumerable: false, value});
    return this.isValidWindow;
  },

  run: function tabmix_initialization_run(aPhase) {
    if (!this.isValidWindow || !window.gBrowser) {
      return null;
    }
    let result, currentPhase = this[aPhase].id;
    let getObj = function(list) {
      let obj = window;
      list.split(".").forEach(prop => (obj = obj[prop]));
      return obj;
    };
    for (let key of Object.keys(this)) {
      let phase = this[key];
      if (phase.id > currentPhase)
        break;
      if (!phase.initialized) {
        // eslint-disable-next-line no-undef
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
  }
};

// A promise resolved once initialization is complete
Tabmix._deferredInitialized = (function() {
  let deferred = {};

  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  return deferred;
}());

TMP_eventListener.init();
