"use strict";

/*
 * tabmix.js
 *
 * original code by Hemiola SUN, further developed by onemen and CPU
 */

Tabmix.startup = function TMP_startup() {
  var cmdNewWindow = document.getElementById("cmd_newNavigator");
  var originalNewNavigator = cmdNewWindow.getAttribute("oncommand");
  // Firefox 20+ implemented per-window Private Browsing
  // When in single window mode allow one normal window and one private window.
  // otherwise open new tab in most recent window of the appropriate type
  if (this.isVersion(200)) {
    this._openNewTab = function (aPrivate) {
      if (this.singleWindowMode) {
        let win = this.RecentWindow.getMostRecentBrowserWindow({ private: aPrivate });
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
    Tabmix.setItem(command, "oncommand","if (Tabmix._openNewTab(true)) {" + originalCode + "}");
    Tabmix.setItem(cmdNewWindow, "oncommand","if (Tabmix._openNewTab(false)) {" + originalNewNavigator + "}");
  }
  else
    Tabmix.setItem(cmdNewWindow, "oncommand","if (Tabmix.singleWindowMode) BrowserOpenTab(); " +
                                          "else {" + originalNewNavigator + "}");

  TabmixContext.toggleEventListener(true);

  // if sessionStore disabled use TMP command
  window.undoCloseTab = function ct_window_undoCloseTab(aIndex, aWhere) {
    return TMP_ClosedTabs.undoCloseTab(aIndex, aWhere);
  };
};

// we call this function from gBrowserInit._delayedStartup, see setup.js
Tabmix.beforeSessionStoreInit = function TMP_beforeSessionStoreInit(aPromise) {
  // when gBrowserInit._delayedStartup broke by extension we don't get
  // "browser-delayed-startup-finished" notification
  setTimeout(function() {
    Tabmix.initialization.run("delayedStartup");
  }, 25);

  if (this.isFirstWindow) {
    let tmp = {};
    Cu.import("resource://tabmixplus/extensions/AddonManager.jsm", tmp);
    TMP_SessionStore.setService(1, true);
  }

  TabmixSessionManager.init(aPromise);

  // if we call these functions earlier we get this warning:
  // XUL box for _moz_generated_content_before element contained an inline #text child
  // by calling getBoundingClientRect
  Tabmix.getButtonsHeight();
  // with Australis build the button is not ready yet at this time
  if (!this.isVersion(280))
    this.getAfterTabsButtonsWidth();
};

// after TabmixSessionManager and SessionStore initialized
Tabmix.sessionInitialized = function() {
  this.ssPromise = null;
  var SM = TabmixSessionManager;
  if (SM.enableManager) {
    window.restoreLastSession = function restoreLastSession() {
      TabmixSessionManager.restoreLastSession();
    };
    if (this.isVersion(200)) {
      this.setItem("Browser:RestoreLastSession", "disabled",
        !SM.canRestoreLastSession || SM.isPrivateWindow);
    }
    else {
      this.changeCode(HistoryMenu.prototype, "HistoryMenu.prototype.toggleRestoreLastSession")._replace(
        'this._ss', 'TabmixSessionManager'
      ).toCode();
    }

    if (!this.isVersion(260)) {
      this.changeCode(window, "window.BrowserOnAboutPageLoad")._replace(
        'function updateSearchEngine',
        'let updateSearchEngine = function _updateSearchEngine', {silent: true}
      )._replace(
        'ss.canRestoreLastSession',
        'TabmixSessionManager.canRestoreLastSession'
      ).toCode();

      this.changeCode(BrowserOnClick, "BrowserOnClick.onAboutHome")._replace(
        'if (ss.canRestoreLastSession)',
        'ss = TabmixSessionManager;\
         $&'
      ).toCode();
    }
    // from Firefox 27 SessionStore notify sessionstore-last-session-cleared
    else if (!this.isVersion(270))
      SessionStore.canRestoreLastSession = false;
  }

  var tab = gBrowser.tabContainer.firstChild;
  if (!tab.selected) {
    tab.removeAttribute("visited");
    tab.removeAttribute("tabmix_selectedID");
  }

  TMP_SessionStore.persistTabAttribute();

  TMP_ClosedTabs.setButtonDisableState();
  if (this.firstWindowInSession)
    SM.toggleRecentlyClosedWindowsButton();

  // convert session.rdf to SessionManager extension format
  TabmixConvertSession.startup();
};

// we call gTMPprefObserver.miscellaneousRules to add some dynamic rules
// from Tabmix.delayedStartup
Tabmix.getButtonsHeight = function() {
  if (gBrowser.tabContainer.orient == "horizontal") {
    let tabBar = gBrowser.tabContainer;
    let stripIsHidden = TabmixTabbar.hideMode !== 0 && !tabBar.visible;
    if (stripIsHidden)
      tabBar.visible = true;
    this._buttonsHeight = Tabmix.visibleTabs.first.getBoundingClientRect().height;
    if (stripIsHidden)
      tabBar.visible = false;
  }
  else
    this._buttonsHeight = 24;
};

Tabmix.getAfterTabsButtonsWidth = function TMP_getAfterTabsButtonsWidth() {
  if (gBrowser.tabContainer.orient == "horizontal") {
    let tabBar = gBrowser.tabContainer;
    let stripIsHidden = TabmixTabbar.hideMode !== 0 && !tabBar.visible;
    if (stripIsHidden)
      tabBar.visible = true;
    // save tabsNewtabButton width
    let lwtheme = !this.isVersion(280) && document.getElementById("main-window").getAttribute("lwtheme");
    this.tabsNewtabButton =
      document.getAnonymousElementByAttribute(tabBar, "command", "cmd_newNavigatorTab");
    this.tabsNewtabButton.setAttribute("force-display", true);
    let openNewTabRect = this.tabsNewtabButton.getBoundingClientRect();
    let style = window.getComputedStyle(this.tabsNewtabButton, null);
    let marginStart = style.getPropertyValue("margin-left");
    // it doesn't work when marginEnd add to buttonWidth
    // let marginEnd = style.getPropertyValue("margin-right");
    // let buttonWidth = openNewTabRect.width + parseFloat(marginStart) + parseFloat(marginEnd);
    let buttonWidth = openNewTabRect.width + parseFloat(marginStart);
    if (buttonWidth > 0) {
      this.afterTabsButtonsWidth = [];
      this.afterTabsButtonsWidth.push(lwtheme ? 31 : buttonWidth);
    }

    // when privateTab extension installed add its new tab button width
    // for the use of adjustNewtabButtonvisibility set tabsNewtabButton to be
    // the right button
    let openNewPrivateTab = document.getElementById("privateTab-afterTabs-openNewPrivateTab");
    if (openNewPrivateTab) {
      let openNewPrivateTabRect = openNewPrivateTab.getBoundingClientRect();
      this.afterTabsButtonsWidth.push(openNewPrivateTabRect.width);
      if (openNewPrivateTabRect.right > openNewTabRect.right)
        this.tabsNewtabButton = openNewPrivateTab;
    }
    this.tabsNewtabButton.removeAttribute("force-display", true);
    if (stripIsHidden)
      tabBar.visible = false;
  }
};

Tabmix.delayedStartup = function TMP_delayedStartup() {
  TabmixTabbar._enablePositionCheck = true;

  if (this.isVersion(250) && this.ssPromise && !TabmixSvc.sm.promiseInitialized)
    this.ssPromise.then(this.sessionInitialized.bind(this), Tabmix.reportError);
  else
    this.sessionInitialized();

  // when we open bookmark in new window
  // get bookmark itemId and url - for use in getBookmarkTitle
  if ("bookMarkIds" in window) {
    let items = (window.bookMarkIds + "").split("|");
    for (let i = 0; i < items.length ; i++) {
      if (items[i] && items[i] > -1)
        gBrowser.tabs[i].setAttribute("tabmix_bookmarkId", items[i]);
    }
    delete window.bookMarkIds;
    gBrowser._lastRelatedTab = null;
  }

  TMP_Places.onDelayedStartup();

  this.navToolbox.init();

  // set option to Prevent clicking on Tab-bar from dragging the window.
  if (this.prefs.getBoolPref("tabbar.click_dragwindow")) {
    if (!Tabmix.prefs.getBoolPref("tabbar.dblclick_changesize"))
      TabmixTabClickOptions.toggleEventListener(true);
  }
  else
    document.getElementById("TabsToolbar")._dragBindingAlive = false;

  TMP_extensionsCompatibility.onDelayedStartup();

  if (this.isVersion(280))
    setTimeout(function() {Tabmix.getAfterTabsButtonsWidth();}, 100);

  gTMPprefObserver.setMenuIcons();

  TabmixTabbar.updateSettings(true);
  gTMPprefObserver.setTabIconMargin();
  gTMPprefObserver.setCloseButtonMargin();
  gTMPprefObserver.miscellaneousRules();
  if (!gTMPprefObserver._tabStyleSheet ||
      gTMPprefObserver._tabStyleSheet.href != "chrome://tabmixplus/skin/tab.css") {
    this.log("can't load dynamic styles into tabmixplus/skin/tab.css");
  }
  gTMPprefObserver._tabStyleSheet = null;

  if ("_failedToEnterVerticalMode" in TabmixTabbar) {
    delete TabmixTabbar._failedToEnterVerticalMode;
    gBrowser.tabContainer.mTabstrip._enterVerticalMode();
  }

  try {
    TMP_LastTab.init();
  } catch (ex) {this.assert(ex);}

  // starting with Fireofox 17.0+ we calculate TMP_tabDNDObserver.paddingLeft
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
      callback: function () {
        Tabmix.prefs.setBoolPref("enableDebug", false);
      }
    }];
    let msg = "Tab Mix is in debug mode!\n " +
      "In case it's activated accidentally, click the button to disalbe it " +
      "or set 'extensions.tabmix.enableDebug' in about:config to false. " +
      "Once you disable 'Debug Mode' restart your browser.";
    const errorimage = "chrome://tabmixplus/skin/tmpsmall.png";
    gnb.appendNotification(msg, "tabmix-debugmode-enabled",
        errorimage, gnb.PRIORITY_CRITICAL_HIGH, buttons);
  }
};

var TMP_eventListener = {
  init: function TMP_EL_init() {
    window.addEventListener("DOMContentLoaded", this, false);
    window.addEventListener("load", this, false);
  },

  handleEvent: function TMP_EL_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "TabAttrModified":
        this.onTabAttrModified(aEvent);
        break;
      case "SSWindowClosing":
        window.removeEventListener("SSWindowClosing", this, false);
        TabmixSessionManager.onWindowClose(!Tabmix.numberOfWindows());
        break;
      case "SSTabRestoring":
        this.onSSTabRestoring(aEvent);
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
        this.onTabBarScroll(aEvent);
        break;
      case "DOMContentLoaded":
      case "load":
        this._onLoad(aEvent.type);
        break;
      case "unload":
        this.onWindowClose(aEvent);
        break;
      case "fullscreen":
        let enterFS = window.fullScreen;
        // Until Firefox 41 (Bug 1161802 part 2) we get the fullscreen event
        // before the window transitions into or out of FS mode.
        if (!Tabmix.isVersion(410))
          enterFS = !enterFS;
        this.onFullScreen(enterFS);
        break;
      case "PrivateTab:PrivateChanged":
        TabmixSessionManager.privateTabChanged(aEvent);
        break;
    }
  },

  toggleEventListener: function(aObj, aArray, aEnable, aHandler) {
    var handler = aHandler || this;
    var eventListener = aEnable ? "addEventListener" : "removeEventListener";
    aArray.forEach(function(eventName) {
      aObj[eventListener](eventName, this, true);
    }, handler);
  },

  // ignore non-browser windows
  _onLoad: function TMP_EL_onContentLoaded(aType) {
    window.removeEventListener(aType, this, false);
    let wintype = window.document.documentElement.getAttribute("windowtype");
    if (wintype == "navigator:browser")
      if (aType != "load") {
        Tabmix.initialization.run("onContentLoaded");
        Tabmix.initialization.run("beforeBrowserInitOnLoad");
      }
      else
        Tabmix.initialization.run("onWindowOpen");
    else if (aType != "load")
      window.removeEventListener("load", this, false);
  },

  onContentLoaded: function TMP_EL_onContentLoaded() {
    if (!Tabmix.isVersion(280)) {
      let newRule = '.tabbrowser-tab > .tab-stack > .tab-content > .tab-label[tabmix="true"] {' +
        '-moz-binding: url("chrome://tabmixplus/content/tab/tabbrowser_4.xml#tabmix-tab-label") !important;}';
      gTMPprefObserver.insertRule(newRule);
    }

    Tabmix.isFirstWindow = Tabmix.numberOfWindows() == 1;
    TMP_SessionStore.setAfterSessionRestored();

    try {
      /**
      *  aObject, aName , aModule - file name , aSymbol - symbol in EXPORTED_SYMBOLS, aFlag, aArg
      */
      Tabmix.lazy_import(Tabmix, "Shortcuts", "Shortcuts", "Shortcuts", true);
      Tabmix.lazy_import(Tabmix, "flst", "Slideshow", "flst", true);
      Tabmix.lazy_import(Tabmix, "MergeWindows", "MergeWindows", "MergeWindows");
      Tabmix.lazy_import(Tabmix, "autoReload", "AutoReload", "AutoReload");
      Tabmix.lazy_import(Tabmix, "renameTab", "RenameTab", "RenameTab");
      Tabmix.lazy_import(TabmixSessionManager, "_decode", "Decode", "Decode");
      Tabmix.lazy_import(Tabmix, "docShellCapabilities",
        "DocShellCapabilities", "DocShellCapabilities");
      Tabmix.lazy_import(Tabmix, "Utils", "Utils", "TabmixUtils");
    } catch (ex) {Tabmix.assert(ex);}

    this._tabEvents = ["SSTabRestoring", "PrivateTab:PrivateChanged",
      "TabOpen", "TabClose", "TabSelect", "TabMove", "TabUnpinned",
      "TabAttrModified"];
    this.toggleEventListener(gBrowser.tabContainer, this._tabEvents, true);

    try {
      TMP_extensionsCompatibility.onContentLoaded();
    } catch (ex) {Tabmix.assert(ex);}

    Tabmix.contentAreaClick.init();

    // make sure AVG Security Toolbar initialized
    // before we change gURLBar.handleCommand to prevent too much recursion from gURLBar.handleCommand
    if (window.InitializeOverlay_avg && typeof window.InitializeOverlay_avg.Init == "function") {
      // avg.Init uses arguments.callee, so i can't call it from strict mode
      Tabmix.nonStrictMode(window.InitializeOverlay_avg, "Init");
    }

    // initialize our gURLBar.handleCommand function early before other extensions change
    // gURLBar.handleCommand or searchbar.handleSearchCommand by replacing the original function
    // url-fixer also prevent the use of eval changes by using closure in the replcaed function
    Tabmix.navToolbox.initializeURLBar();
    Tabmix.navToolbox.initializeSearchbar();

    if ("_update" in TabsInTitlebar) {
      // set option to Prevent double click on Tab-bar from changing window size.
      Tabmix.changeCode(TabsInTitlebar, "TabsInTitlebar._update")._replace(
        'function $(id)',
        'let $ = $&', {check: Tabmix._debugMode}
      )._replace(
        'this._dragBindingAlive',
        '$& && Tabmix.prefs.getBoolPref("tabbar.click_dragwindow")'
      )._replace(
        'function rect(ele)',
        'let rect = function _rect(ele)' // for strict mode
      )._replace(
        'function verticalMargins(',
        'let verticalMargins = $&',
        {check: Tabmix._debugMode && Tabmix.isVersion(280)}
      )._replace(
        'let tabAndMenuHeight = fullTabsHeight + fullMenuHeight;',
        'fullTabsHeight = fullTabsHeight / TabmixTabbar.visibleRows;\n      $&',
        {check: TabmixSvc.isMac && Tabmix.isVersion(280)}
      )._replace(
        /(\})(\)?)$/,
        // when we get in and out of tabsintitlebar mode call updateScrollStatus
        'if (TabmixTabbar._enablePositionCheck && TabmixTabbar.getTabsPosition() != TabmixTabbar._tabsPosition)\
           TabmixTabbar.updateScrollStatus();\
         $1$2'
      ).toCode();
    }

    try {
      if (TMP_TabView.installed)
        TMP_TabView._patchBrowserTabview();
    } catch (ex) {Tabmix.assert(ex);}

    // we can't use TabPinned.
    // gBrowser.pinTab call adjustTabstrip that call updateScrollStatus
    // before it dispatch TabPinned event.
    Tabmix.changeCode(gBrowser, "gBrowser.pinTab")._replace(
      'this.tabContainer.adjustTabstrip();',
      '  if (TabmixTabbar.widthFitTitle && aTab.hasAttribute("width"))' +
      '    aTab.removeAttribute("width");' +
      '  if (Tabmix.prefs.getBoolPref("lockAppTabs") &&' +
      '      !aTab.hasAttribute("locked") && "lockTab" in this) {' +
      '    this.lockTab(aTab);' +
      '    aTab.setAttribute("_lockedAppTabs", "true");' +
      '  }' +
      '  this.tabContainer.adjustTabstrip(true);' +
      '  TabmixTabbar.updateScrollStatus();' +
      '  TabmixTabbar.updateBeforeAndAfter();'
    ).toCode();

    // prevent faviconize use its own adjustTabstrip
    // in Firefox 4.0 we check for faviconized tabs in TMP_TabView.firstTab
    if ("faviconize" in window && "override" in window.faviconize) {
      Tabmix.changeCode(TMP_TabView, "TMP_TabView.checkTabs")._replace(
        '!tab.pinned',
        '$& && !tab.hasAttribute("faviconized")'
      ).toCode();

      // change adjustTabstrip
      window.faviconize.override.adjustTabstrip = function() { };
    }
  },

  onWindowOpen: function TMP_EL_onWindowOpen() {
    window.addEventListener("unload", this, false);
    window.addEventListener("SSWindowClosing", this, false);
    window.addEventListener("fullscreen", this, true);

    if (Tabmix.isVersion(320)) {
      Tabmix.Utils.initMessageManager(window);
    }

    var tabBar = gBrowser.tabContainer;

    tabBar.addEventListener("DOMMouseScroll", this, true);

    try {
      TabmixProgressListener.startup(gBrowser);
    } catch (ex) {Tabmix.assert(ex);}

    gBrowser.mPanelContainer.addEventListener("click", Tabmix.contentAreaClick._contentLinkClick, true);

    // init tabmix functions
    try {
      TMP_extensionsCompatibility.onWindowOpen();
    } catch (ex) {Tabmix.assert(ex);}
    try {
      tablib.init();
    } catch (ex) {Tabmix.assert(ex);}
    try {
      TMP_Places.init();
    } catch (ex) {Tabmix.assert(ex);}
    try {
      Tabmix.startup();
    } catch (ex) {Tabmix.assert(ex);}
    try {
      Tabmix.linkHandling_init();
    } catch (ex) {Tabmix.assert(ex);}
    try {
      TMP_tabDNDObserver.init();
    } catch (ex) {Tabmix.assert(ex);}

    if (TabmixSvc.isMac) {
      tabBar.setAttribute("Mac", "true");
      // get Mac drop indicator marginBottom ,   Mac default theme have marginBottom: -24px
      let ind = gBrowser.tabContainer._tabDropIndicator;
      if (ind) {
        TMP_tabDNDObserver.marginBottom = Tabmix.getStyle(ind, "marginBottom");
      }
    }

    var tabsToolbar = document.getElementById("TabsToolbar");
    if (navigator.oscpu.startsWith("Windows NT 6.1")) {
      Tabmix.setItem(tabsToolbar, "tabmix_aero", true);
    }

    if (TabmixSvc.australis)
      tabBar.setAttribute("tabmix_australis", Tabmix.extensions.treeStyleTab ? "tst" : "true");

    var skin = Services.prefs.getCharPref("general.skins.selectedSkin");
    if (skin=="classic/1.0") {
      if (TabmixSvc.isMac)
        tabBar.setAttribute("classic", "v4Mac");
      else if (TabmixSvc.isLinux) {
        tabBar.setAttribute("classic", "v3Linux");
///XXX test if this is still the case
        TMP_tabDNDObserver.LinuxMarginEnd = -2;
        Tabmix.setItem(tabsToolbar, "tabmix_skin", "classic");
      }
      else {
        let version = navigator.oscpu.startsWith("Windows NT 6.1") ? "v40aero" : "v40";
        tabBar.setAttribute("classic40", version);
        Tabmix.setItem(tabsToolbar, "classic40", version);
      }
    }
    else {
      /**
       * some theme like Vista-aero 3.0.0.91 and BlueSky 3.0.0.91
       * use TMP_TBP_Startup in stylesheet window[onload="TMP_TBP_Startup()"]
       */
      Tabmix.setItem("main-window", "onload", "TMP_TBP_Startup();");

      //XXX need to add theme list here
      var themes = /^(iPoxRemix|Ie8fox|Vfox3)/;
      if (themes.test(skin)) {
        // add backgroundrepeat Attribute for theme for use in multi-row
        tabBar.setAttribute("backgroundrepeat" , true);
      }
      switch (skin) {
        case "Australis":
          tabBar.setAttribute("tabmix_australis", Tabmix.extensions.treeStyleTab ? "tst" : "true");
          break;
        case "cfxe": // Chromifox Extreme
        case "cfxec":
          tabBar.setAttribute("tabmix_skin" , "cfxec");
          break;
        case "Vfox3":
        case "phoenityaura": // Phoenity Aura
          tabBar.setAttribute("tabmix_skin" , skin);
          break;
        case "CrystalFox_Qute-BigRedBrent":
          tabBar.setAttribute("tabmix_skin" , "CrystalFox");
          break;
        case "Vista-aero":
          let rightBox = document.getElementById("myTabBarRightBox");
          if (rightBox)
            rightBox.setAttribute("vista_aero" , true);
          break;
        case "classiccompact":
          tabBar.setAttribute("tabmix_skin" , "classiccompact");
          break;
        case "BlackFox_V1-Blue":
          tabBar.setAttribute("tabmix_skin" , "BlackFox");
          break;
      }
    }

    // don't remove maybe some themes use this with Tabmix
    tabBar.setAttribute("tabmix_firefox3" , true);

    if (Tabmix.singleWindowMode)
      gTMPprefObserver.setSingleWindowUI();

    Tabmix.Shortcuts.onWindowOpen(window);

    // if treeStyleTab extension installed we call this from
    // Tabmix.delayedStartup
    if (!Tabmix.extensions.treeStyleTab)
      Tabmix.navToolbox.tabStripAreaChanged();

    TMP_ClosedTabs.setButtonType(Tabmix.prefs.getBoolPref("undoCloseButton.menuonly"));

    TabmixTabbar.hideMode = Tabmix.prefs.getIntPref("hideTabbar");
   /*
    *  In the first time TMP is running we need to match extensions.tabmix.hideTabbar to browser.tabs.autoHide.
    *  extensions.tabmix.hideTabbar default is 0 "Never Hide tabbar"
    *  if browser.tabs.autoHide is true we need to make sure extensions.tabmix.hideTabbar
    *  is set to 1 "Hide tabbar when i have only one tab":
    */
    if (!Tabmix.isVersion(230) &&
        Services.prefs.getBoolPref("browser.tabs.autoHide") && TabmixTabbar.hideMode === 0) {
      TabmixTabbar.hideMode = 1;
      Tabmix.prefs.setIntPref("hideTabbar", TabmixTabbar.hideMode);
    }
    else
      gTMPprefObserver.setAutoHidePref();

    if (TabmixTabbar.hideMode == 2)
      gBrowser.tabContainer.visible = false;

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
    styles.forEach(function(ruleName) {
      gTMPprefObserver.updateTabsStyle(ruleName);
    });
    // progressMeter on tabs
    gTMPprefObserver.setProgressMeter();

    // tabmix Options in Tools menu
    document.getElementById("tabmix-menu").hidden = !Tabmix.prefs.getBoolPref("optionsToolMenu");

    gTMPprefObserver.addDynamicRules();
    TabmixSessionManager.updateSettings();
    // turn both broadcasters off, we will set the proper value later
    Tabmix.setItem("tmp_undocloseButton", "disabled", true);
    Tabmix.setItem("tmp_closedwindows", "disabled", true);

    Tabmix.setNewFunction(tabBar, "adjustTabstrip", Tabmix.adjustTabstrip);
    delete Tabmix.adjustTabstrip;
  },

  tabWidthCache: new WeakMap(),
  onTabAttrModified: function (aEvent) {
    if (!TabmixTabbar.widthFitTitle)
      return;

    // when browser.tabs.animate is true and a new tab is still opening we wait
    // until onTabOpen_delayUpdateTabBar call updateScrollStatus
    let lastTab = Services.prefs.getBoolPref("browser.tabs.animate") &&
        gBrowser.getTabForLastPanel();
    if (lastTab && !lastTab._fullyOpen)
      return;

    // catch tab width changed when label attribute changed
    // or when busy attribute changed hide/show image
    var tab = aEvent.target;
    var width = tab.boxObject.width;
    if (this.tabWidthCache.has(tab) && this.tabWidthCache.get(tab) == width)
      return;

    this.tabWidthCache.set(tab, width);

    TabmixTabbar.updateScrollStatus();
    setTimeout(function(){TabmixTabbar.updateScrollStatus();}, 2500);
  },

  onSSTabRestoring: function TMP_EL_onSSTabRestoring(aEvent) {
    var tab = aEvent.target;
    Tabmix.restoreTabState(tab);
    TabmixSessionManager.restoreHistoryComplete(tab);

    gBrowser.ensureTabIsVisible(gBrowser.selectedTab, false);

    // don't mark new tab as unread
    var url = tab.linkedBrowser.currentURI.spec;
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
        fullScrToggler.addEventListener("mouseover", this._expandCallback, false);
        fullScrToggler.addEventListener("dragenter", this._expandCallback, false);
        fullScrToggler.hidden = true;
        let bottombox = document.getElementById("browser-bottombox");
        bottombox.appendChild(fullScrToggler);

        if (Tabmix.isVersion(400)) {
          let $LF = '\n    ';
          Tabmix.changeCode(FullScreen, "FullScreen.hideNavToolbox")._replace(
            'this._isChromeCollapsed = true;',
            'TMP_eventListener._updateMarginBottom(gNavToolbox.style.marginTop);' + $LF +
            '$&' + $LF +
            'TMP_eventListener.toggleTabbarVisibility(false, aAnimate);'
          ).toCode();
        }
        else
        Tabmix.changeCode(FullScreen, "FullScreen.sample")._replace(
          'gNavToolbox.style.marginTop = "";',
          'TMP_eventListener._updateMarginBottom("");\
           $&'
        )._replace(
          'gNavToolbox.style.marginTop = (gNavToolbox.boxObject.height * pos * -1) + "px";',
          '$&\
           TMP_eventListener._updateMarginBottom(gNavToolbox.style.marginTop);'
        ).toCode();
      }
      if (!document.mozFullScreen) {
        fullScrToggler.hidden = false;
      }
    }
    else if (fullScrToggler && !enterFS) {
      this._updateMarginBottom("");
      fullScrToggler.hidden = true;
    }
    if (!enterFS)
      this.updateMultiRow();
  },

  showNavToolbox: function() {
    this._updateMarginBottom("");
    this.toggleTabbarVisibility(true);
    this.updateMultiRow();
    setTimeout(() => this.updateMultiRow(), 0);
    gBrowser.ensureTabIsVisible(gBrowser.selectedTab, false);
  },

  _updateMarginBottom: function TMP_EL__updateMarginBottom(aMargin) {
    if (TabmixTabbar.position == 1) {
      let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
      bottomToolbox.style.marginBottom = aMargin;
    }
  },

  _expandCallback: function TMP_EL__expandCallback() {
    if (TabmixTabbar.hideMode === 0 || TabmixTabbar.hideMode == 1 && gBrowser.tabs.length > 1) {
      if (Tabmix.isVersion(400))
        FullScreen.showNavToolbox();
      else
        FullScreen.mouseoverToggle(true);
    }
  },

  // for tabs bellow content
  toggleTabbarVisibility: function(aShow, aAnimate) {
    if (TabmixTabbar.position != 1)
      return;
    let fullScrToggler = document.getElementById("fullscr-bottom-toggler");
    fullScrToggler.hidden = aShow;
    let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
    if (aShow) {
      bottomToolbox.style.marginBottom = "";
      gTMPprefObserver.updateTabbarBottomPosition();
    }
    else {
      let bottombox = document.getElementById("browser-bottombox");
      bottomToolbox.style.marginBottom =
          -(bottomToolbox.getBoundingClientRect().height +
          bottombox.getBoundingClientRect().height) + "px";

      if (Tabmix.isVersion(400) && aAnimate &&
          Services.prefs.getBoolPref("browser.fullscreen.animate")) {
        // Hide the fullscreen toggler until the transition ends.
        let listener = function() {
          gNavToolbox.removeEventListener("transitionend", listener, true);
          if (FullScreen._isChromeCollapsed)
            fullScrToggler.hidden = false;
        };
        gNavToolbox.addEventListener("transitionend", listener, true);
        fullScrToggler.hidden = true;
      }

      // Until Firefox 41 changing the margin trigger resize event that calls
      // updateTabbarBottomPosition
      if (Tabmix.isVersion(410))
        gTMPprefObserver.updateTabbarBottomPosition();
    }
  },

  updateMultiRow: function (aReset) {
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
    tablib.setLoadURIWithFlags(tab.linkedBrowser);
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
    let newTime = Date.now();
    if (Tabmix.tabsUtils.overflow || newTime - this.lastTimeTabOpened > 200) {
      this.onTabOpen_updateTabBar(aTab);
      this.lastTimeTabOpened = newTime;
    }
    else if (!this._onOpenTimeout) {
      let self = this;
      let timeout = Tabmix.tabsUtils.disAllowNewtabbutton &&
          Services.prefs.getBoolPref("browser.tabs.animate") ? 0 : 200;
      this._onOpenTimeout = window.setTimeout( function TMP_onOpenTimeout(tab) {
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
      if (TabmixTabbar.isMultiRow && tabBar.mTabstrip.orient != "vertical")
        tabBar.mTabstrip._enterVerticalMode();
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
    var tabBar = gBrowser.tabContainer;

    // if we close the 2nd tab and tabbar is hide when there is only one tab
    // reset all scroll and multi-row parameter
    // strip already collapsed at this point
    if (TabmixTabbar.hideMode == 1) {
      let tabsCount = tabBar.childNodes.length - gBrowser._removingTabs.length;
      if (tabsCount == 2) {
        TabmixTabbar.setHeight(1);
        tabBar.removeAttribute("multibar");
      }
    }

    // when browser.tabs.animate is true gBrowser._endRemoveTab calls
    // onTabClose_updateTabBar.
    // we would like to get early respond when row height is going to change.
    var updateNow = !Services.prefs.getBoolPref("browser.tabs.animate");
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

    Tabmix.countClosedTabs(tab);

    if (Tabmix.selectedTab == tab) {
      Tabmix.selectedTab = null;
      Tabmix.userTypedValue = "";
    }

    // clean WeakMap
    let browser = tab.linkedBrowser;
    if (Tabmix.isVersion(320) && browser && TabmixSvc.syncHandlers.has(browser.permanentKey))
      TabmixSvc.syncHandlers.delete(browser.permanentKey);
    if (this.tabWidthCache.has(tab))
      this.tabWidthCache.delete(tab);
  },

  // TGM extension use it
  onTabClose_updateTabBar: function TMP_EL_onTabClose_updateTabBar(aTab) {
    // if the tab is not in the curent group we don't have to do anything here.
    if (typeof aTab._tPosInGroup == "number" && aTab._tPosInGroup == -1)
      return;

    var tabBar = gBrowser.tabContainer;
    function _updateTabstrip() {
      if (tabBar.getAttribute("multibar") == "true" &&
          Tabmix.tabsUtils.lastTabRowNumber < TabmixTabbar.visibleRows)
        Tabmix.tabsUtils.updateVerticalTabStrip();
      TabmixTabbar.updateBeforeAndAfter();
    }

    // workaround when we remove last visible tab
    if (tabBar.firstChild.pinned && TabmixTabbar.isMultiRow && Tabmix.tabsUtils.overflow &&
        aTab._tPos >= Tabmix.visibleTabs.last._tPos)
      tabBar.mTabstrip.ensureElementIsVisible(gBrowser.selectedTab, false);

    if (Tabmix.tabsUtils.disAllowNewtabbutton)
      Tabmix.tabsUtils.adjustNewtabButtonvisibility();
    if (TabmixTabbar.isMultiRow && tabBar.hasAttribute("multibar")) {
      _updateTabstrip();
      setTimeout(function(){_updateTabstrip();}, 0);
    }
  },

  onTabSelect: function TMP_EL_TabSelect(aEvent) {
    var tab = aEvent.target;

    // for ColorfulTabs 6.0+
    // ColorfulTabs trapp TabSelect event after we do
    // we need to set standout class before we check for getTabRowNumber
    // and mTabstrip.ensureElementIsVisible
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

    if (!Tabmix.isVersion(390) || !gMultiProcessBrowser) {
      this.updateDisplay(tab);
    }

    TMP_LastTab.OnSelect();
    TabmixSessionManager.tabSelected(true);
  },

  updateDisplay: function(tab) {
    if (!tab.hasAttribute("visited"))
      tab.setAttribute("visited", true);

    if (tab.hasAttribute("tabmix_pending"))
      tab.removeAttribute("tabmix_pending");
    Tabmix.setTabStyle(tab);

    if (tab.hasAttribute("showbutton") &&
        gBrowser.tabContainer.getAttribute("closebuttons") == "activetab")
      tab.style.removeProperty("width");

    // tabBar.updateCurrentBrowser call tabBar._setPositionalAttributes after
    // TabSelect event.
    // Since Firefox 220 we call updateBeforeAndAfter from _setPositionalAttributes
    if (!Tabmix.isVersion(220))
      TabmixTabbar.updateBeforeAndAfter();
  },

  onTabMove: function TMP_EL_onTabMove(aEvent) {
    var tab = aEvent.target;

    // workaround for bug 852952
    // transitionend is not fired if the new tab is move before transitionend
    // fixed by bug 850163 - Firefox 23
    if (Tabmix.isVersion(210) && tab.getAttribute("fadein") == "true" &&
        !tab._fullyOpen && !tab.closing) {
      gBrowser.tabContainer._handleNewTab(tab);
    }

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
    var tabBar = gBrowser.tabContainer;
    TabmixTabbar.removeShowButtonAttr();

    let shouldMoveFocus = scrollTabs == 1;
    if (aEvent.shiftKey)
      shouldMoveFocus = !shouldMoveFocus;
    var direction = aEvent.detail;
    if (Tabmix.prefs.getBoolPref("reversedScroll"))
      direction = -1 * direction;

    if (shouldMoveFocus) {
      direction = direction > 0 ? 1 : -1;
      tabBar.advanceSelectedTab(direction, true);
      aEvent.stopPropagation();
      aEvent.preventDefault();
    }
    else if (direction !== 0 && !Tabmix.extensions.treeStyleTab) {
      // this code is based on scrollbox.xml DOMMouseScroll event handler
      let tabsSrip = tabBar.mTabstrip;
      let orient = tabsSrip.orient;

      // scroll the tabbar by one tab
      if (orient == "horizontal" || TabmixTabbar.isMultiRow)
        direction = direction > 0 ? 1 : -1;

      if (orient == "vertical") {
        if (aEvent.axis == aEvent.HORIZONTAL_AXIS)
          return;
        tabsSrip.scrollByIndex(direction);
      }
      else {
        let isVertical = aEvent.axis == aEvent.VERTICAL_AXIS;
        if (tabsSrip._prevMouseScrolls.every(function(prev) {return prev == isVertical}))
          tabsSrip.scrollByIndex(isVertical && tabsSrip._isRTLScrollbox ? -direction : direction);

        if (tabsSrip._prevMouseScrolls.length > 1)
          tabsSrip._prevMouseScrolls.shift();
        tabsSrip._prevMouseScrolls.push(isVertical);
      }
      aEvent.stopPropagation();
      aEvent.preventDefault();
    }
  },

  onWindowClose: function TMP_EL_onWindowClose() {
    window.removeEventListener("unload", this, false);
    window.removeEventListener("SSWindowClosing", this, false);

    // notice that windows enumerator don't count this window
    var isLastWindow = Tabmix.numberOfWindows() === 0;
    // we close tabmix dialog windows on exit
    if (isLastWindow) {
      Array.forEach(["tabmixopt-filetype", "tabmixopt-appearance", "tabmixopt"], function(aID) {
        var win = Services.wm.getMostRecentWindow("mozilla:" + aID);
        if (win) {
          if (aID != "tabmixopt")
            win.close();
          else
            win.setTimeout(function(){win.close();},0);
        }
      });
    }

    TabmixSessionManager.shutDown(true, isLastWindow, true);
    TabmixSessionManager.notifyClosedWindowsChanged(true);
    TabmixTabClickOptions.toggleEventListener(false);
    TabmixContext.toggleEventListener(false);

    TMP_Places.deinit();
    TMP_LastTab.deinit();

    window.removeEventListener("fullscreen", this, true);
    var fullScrToggler = document.getElementById("fullscr-bottom-toggler");
    if (fullScrToggler) {
      fullScrToggler.removeEventListener("mouseover", this._expandCallback, false);
      fullScrToggler.removeEventListener("dragenter", this._expandCallback, false);
    }

    this.toggleEventListener(gBrowser.tabContainer, this._tabEvents, false);

    let alltabsPopup = document.getElementById("alltabs-popup");
    if (alltabsPopup && alltabsPopup._tabmix_inited)
      alltabsPopup.removeEventListener("popupshown", alltabsPopup.__ensureElementIsVisible, false);

    gBrowser.tabContainer.removeEventListener("DOMMouseScroll", this, true);

    if (TMP_TabView.installed)
      TMP_TabView._resetTabviewFrame();
    gBrowser.mPanelContainer.removeEventListener("click", Tabmix.contentAreaClick._contentLinkClick, true);

    gTMPprefObserver.removeObservers();
    gTMPprefObserver.dynamicRules = null;

    TabmixProgressListener.listener.mTabBrowser = null;
    gBrowser.removeTabsProgressListener(TabmixProgressListener.listener);

    if (Tabmix.SlideshowInitialized && Tabmix.flst.slideShowTimer)
      Tabmix.flst.cancel();

    Tabmix.navToolbox.deinit();

    if (Tabmix.isVersion(320)) {
      Tabmix.Utils.deinit(window);
    }

    Tabmix.tabsUtils.onUnload();
  },

  // some theme not useing up to date Tabmix tab binding
  // we check here that all of our attribute exist
  setTabAttribute: function TMP_EL_setTabAttribute(aTab) {
    let reloadIcon  = document.getAnonymousElementByAttribute(aTab, "class", "tab-reload-icon");
    if (!reloadIcon) {
      let lockIcon  = document.getAnonymousElementByAttribute(aTab, "class", "tab-lock-icon");
      if (lockIcon) {
        let XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
        let image = document.createElementNS(XULNS, "image");
        image.setAttribute("class", "tab-reload-icon");
        lockIcon.parentNode.appendChild(image);
      }
    }

    function updateAttrib(aGetAtt, aGetValue, aAtt, aValue) {
      let node = document.getAnonymousElementByAttribute(aTab, aGetAtt, aGetValue);
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
  init:                    {id: 0, obj: "Tabmix.tabsUtils"},
  beforeStartup:           {id: 1, obj: "Tabmix"},
  onContentLoaded:         {id: 2, obj: "TMP_eventListener"},
  beforeBrowserInitOnLoad: {id: 3, obj: "Tabmix"},
  onWindowOpen:            {id: 4, obj: "TMP_eventListener"},
  delayedStartup:          {id: 5, obj: "Tabmix"},

  get isValidWindow() {
    /**
      * don't initialize Tabmix functions on this window if one of this is true:
      *  - the window is about to close by SingleWindowModeUtils
      *  - tabbrowser-tabs binding didn't start (i onlly saw it happened
      *       when ImTranslator extension installed)
      */
    let stopInitialization = false;
    Tabmix.singleWindowMode = Tabmix.prefs.getBoolPref("singleWindow");
    if (Tabmix.singleWindowMode) {
      let tmp = { };
      Components.utils.import("resource://tabmixplus/SingleWindowModeUtils.jsm", tmp);
      stopInitialization = tmp.SingleWindowModeUtils.newWindow(window);
    }

    if (stopInitialization) {
      this.run = function() {};
      window.removeEventListener("DOMContentLoaded", TMP_eventListener, false);
      window.removeEventListener("load", TMP_eventListener, false);
    }

    delete this.isValidWindow;
    Object.defineProperty(this, "run", {enumerable: false});
    Object.defineProperty(this, "isValidWindow", {value: !stopInitialization,
                                                  enumerable: false});
    return this.isValidWindow;
  },

  run: function tabmix_initialization_run(aPhase) {
    if (!this.isValidWindow)
      return null;
    let result, currentPhase = this[aPhase].id;
    let getObj = function(list) {
      let obj = window;
      list.split(".").forEach(function(prop) {obj = obj[prop];});
      return obj;
    };
    for (let key of Object.keys(this)) {
      let phase = this[key];
      if (phase.id > currentPhase)
        break;
      if (!phase.initialized) {
        phase.initialized = true;
        try {
          let obj = getObj(phase.obj);
          result = obj[key].apply(obj, Array.slice(arguments, 1));
        } catch (ex) {
          Tabmix.assert(ex, phase.obj + "." + key + " failed");
        }
      }
    }
    return result;
  }
};

TMP_eventListener.init();
