/*
 * tabmix.js
 *
 * original code by Hemiola SUN, further developed by onemen and CPU
 */

Tabmix.startup = function TMP_startup() {
  // disable the "Open New Window action in Single Window Mode...
  var cmdNewWindow = document.getElementById("cmd_newNavigator");
  var originalNewNavigator = cmdNewWindow.getAttribute("oncommand");
  cmdNewWindow.setAttribute("oncommand","if (Tabmix.singleWindowMode) BrowserOpenTab(); else {" + originalNewNavigator + "}");

  if (!Tabmix.isVersion(120)) {
    // multi-rows total heights can be diffrent when tabs are on top
    // since this is not trigger any other event that we can listen to
    // we force to add here a call to reset tabbar height
    Tabmix.originalFunctions.tabsOnTop_toggle = TabsOnTop.toggle;
    TabsOnTop.toggle = function TabsOnTop_toggle() {
      Tabmix.originalFunctions.tabsOnTop_toggle.apply(this, arguments);
      if (TabmixTabbar.visibleRows > 1) {
        TabmixTabbar.setHeight(1, true);
        gBrowser.tabContainer.updateVerticalTabStrip();
      }
    }
  }

  TabmixContext.toggleEventListener(true);

  // add call to Tabmix.Sanitizer
  // nsBrowserGlue.js use loadSubScript to load Sanitizer so we need to add this here
  var cmd = document.getElementById("Tools:Sanitize");
  if (cmd)
    cmd.setAttribute("oncommand", cmd.getAttribute("oncommand") + " Tabmix.Sanitizer.tryToSanitize();");

  // if sessionStore disabled use TMP command
  window.undoCloseTab = function ct_window_undoCloseTab(aIndex, aWhere) {
    return TMP_ClosedTabs.undoCloseTab(aIndex, aWhere);
  };
}

// we call this at the start of gBrowserInit._delayedStartup
// if we call it erlier we get this warning:
// XUL box for _moz_generated_content_before element contained an inline #text child
Tabmix.getNewTabButtonWidth = function TMP_getNewTabButtonWidth() {
  if (gBrowser.tabContainer.orient == "horizontal") {
    let tabBar = gBrowser.tabContainer;
    let stripIsHidden = Services.prefs.getBoolPref("browser.tabs.autoHide") && !tabBar.visible;
    if (stripIsHidden)
      tabBar.visible = true;
    this.setItem("TabsToolbar", "tabmix-visible", true);
    // save mTabsNewtabButton width
    let lwtheme = document.getElementById("main-window").getAttribute("lwtheme");
    tabBar._newTabButtonWidth = lwtheme ? 31 : tabBar.mTabsNewtabButton.getBoundingClientRect().width;
    this.setItem("TabsToolbar", "tabmix-visible", null);
    if (stripIsHidden)
      tabBar.visible = false;
    // height shrink to actual size when the tabbar is in display: block (multi-row)
    if (Tabmix.isVersion(120) && Services.prefs.getCharPref("general.skins.selectedSkin") != "classic/1.0")
      tabBar.mTabsNewtabButton.height = tabBar.visibleTabsFirstChild.getBoundingClientRect().height;
  }
}

Tabmix.delayedStartup = function TMP_delayedStartup() {
  TabmixTabbar._enablePositionCheck = true;

  /* Add attribute to nsSessionStore persistTabAttribute after delay
     we call this after nsSessionStore.init
     we add this also when we use TMP session manager.
     we use Firefox SessionStore closed tab service and for restore after restart
  */
  if (this.isFirstWindow)
    TMP_SessionStore.persistTabAttribute();

  TMP_ClosedTabs.setButtonDisableState();
  TabmixSessionManager.toggleRecentlyClosedWindowsButton();
  // convert session.rdf to SessionManager extension format
  TabmixConvertSession.startup();

  // when we open bookmark in new window
  // get bookmark itemId and url - for use in getBookmarkTitle
  if ("bookMarkIds" in window) {
    let items = (window.bookMarkIds + "").split("|");
    for (let i = 0; i < items.length ; i++) {
      if (items[i] && items[i] > -1)
        gBrowser.tabs[i].setAttribute("tabmix_bookmarkId", items[i]);
    }
    delete window.bookMarkIds;
  }

  TMP_Places.onDelayedStartup();

  Tabmix.navToolbox.init();

  // set option to Prevent double click on Tab-bar from changing window size.
  var tabsToolbar = document.getElementById("TabsToolbar");
  if (!Tabmix.prefs.getBoolPref("dblClickTabbar_changesize"))
    tabsToolbar._dragBindingAlive = false;

  TMP_extensionsCompatibility.onDelayedStartup();
  try {
    gTMPprefObserver.replaceBrowserRules();
  } catch (ex) {Tabmix.assert(ex);}

  gTMPprefObserver.setMenuIcons();

  TabmixTabbar.updateSettings(true);
  gTMPprefObserver.setTabIconMargin();
  gTMPprefObserver.setCloseButtonMargin();
  delete gTMPprefObserver.tabStyleSheet;
  if ("_failedToEnterVerticalMode" in TabmixTabbar) {
    delete TabmixTabbar._failedToEnterVerticalMode;
    gBrowser.tabContainer.mTabstrip._enterVerticalMode();
  }

  try {
    TMP_LastTab.init();
  } catch (ex) {this.assert(ex);}

 /*
  * We add minheight to the tab bar to prevent it from shrinking when we
  * enter/exit private browsing without new tab button after tabs and animation on.
  * The last tab is removed before the new tab is fully visible, so the tab
  * bar height is drop below normal height.
  */
  if (!TMP_tabDNDObserver.verticalTreeStyleTab)
    Tabmix.setItem(tabsToolbar, "minheight", tabsToolbar.getBoundingClientRect().height / TabmixTabbar.visibleRows);
}

var TMP_eventListener = {
  init: function TMP_EL_init(aTabContainer) {
    TMP_DOMWindowOpenObserver.newWindow(window);
    window.addEventListener("DOMContentLoaded", this, false);
  },

  observe: function TMP_EL_observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "browser-delayed-startup-finished":
        Services.obs.removeObserver(this, "browser-delayed-startup-finished");
        try {
          // master password dialog can popup before startup when Gmail-manager try to login
          // it can cause load event to fire late, so we get here before onWindowOpen run
          if (!TMP_eventListener._windowInitialized)
            TMP_eventListener.onWindowOpen();
          Tabmix.delayedStartup();
        } catch (ex) {Tabmix.assert(ex);}
        break;
    }
  },

  handleEvent: function TMP_EL_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "SSTabRestoring":
        this.onSSTabRestoring(aEvent);
        break;
      case "SSTabClosing":
        this.onSSTabClosing(aEvent);
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
        try {
          this.onContentLoaded(aEvent);
        } catch (ex) {Tabmix.assert(ex);}
        break;
      case "load":
        try {
          this.onWindowOpen(aEvent);
        } catch (ex) {Tabmix.assert(ex);}
        break;
      case "unload":
        this.onWindowClose(aEvent);
        break;
      case "fullscreen":
        this.onFullScreen(false);
        break;
      /**
       * for Tabview
       */
      case "tabviewshown":
        TabmixSessionManager.saveTabViewData(TabmixSessionManager.gThisWin, true);
        break;
      case "tabviewhidden":
        TabmixSessionManager.saveTabViewData(TabmixSessionManager.gThisWin, true);
        TMP_LastTab.tabs = null;
        if (TabmixTabbar.hideMode != 2)
          setTimeout(function () {gBrowser.tabContainer.adjustTabstrip()}, 0);
        break;
      case "TabShow":
        if (!gBrowser.tabContainer._onDelayTabShow) {
          // pass aEvent to this function for use in TGM
          gBrowser.tabContainer._onDelayTabShow = window.setTimeout(function (aEvent) {
            gBrowser.tabContainer._onDelayTabShow = null;
            TMP_eventListener.onTabOpen_delayUpdateTabBar(aEvent.target);
          }, 0, aEvent);
        }
        break;
      case "TabHide":
        if (!gBrowser.tabContainer._onDelayTabHide) {
          // pass aEvent to this function for use in TGM
          gBrowser.tabContainer._onDelayTabHide = window.setTimeout(function (aEvent) {
            gBrowser.tabContainer._onDelayTabHide = null;
            let tab = aEvent.target;
            // just to pass the test in onTabClose_updateTabBar
            tab._tPosInGroup = true;
            TMP_eventListener.onTabClose_updateTabBar(tab, true);
          }, 0, aEvent);
        }
        break;
    }
  },

 /*
  *  we use this event to run this code before load event
  *  until TMP version 0.3.8.3 we used to run this code from Tabmix.beforeStartup
  *  that called from tabcontainer constractur
  */
  onContentLoaded: function TMP_EL_onContentLoaded() {
    window.removeEventListener("DOMContentLoaded", this, false);
    // don't load tabmix into undock sidebar opened by ezsidebar extension
    var wintype = window.document.documentElement.getAttribute("windowtype");
    if (wintype == "mozilla:sidebar")
      return;

    window.addEventListener("load", this, false);

    try {
      /**
      *  aObject, aName , aModule - file name , aSymbol - symbol in EXPORTED_SYMBOLS, aFlag, aArg
      */
      Tabmix.lazy_import(Tabmix, "flst", "Slideshow", "flst", true);
      Tabmix.lazy_import(Tabmix, "MergeWindows", "MergeWindows", "MergeWindows");
      Tabmix.lazy_import(Tabmix, "autoReload", "AutoReload", "AutoReload");
      Tabmix.lazy_import(Tabmix, "renameTab", "RenameTab", "RenameTab");
      Tabmix.lazy_import(TabmixSessionManager, "_decode", "Decode", "Decode");
    } catch (ex) {Tabmix.assert(ex);}

    var tabContainer = gBrowser.tabContainer;
    tabContainer.addEventListener("SSTabRestoring", this, true);
    tabContainer.addEventListener("SSTabClosing", this, true);
    tabContainer.addEventListener("TabOpen", this, true);
    tabContainer.addEventListener("TabClose", this, true);
    tabContainer.addEventListener("TabSelect", this, true);
    tabContainer.addEventListener("TabMove", this, true);
    tabContainer.addEventListener("TabUnpinned", this, true);

    try {
      TMP_extensionsCompatibility.onContentLoaded();
    } catch (ex) {Tabmix.assert(ex);}

    Tabmix.contentAreaClick.init();

    // initialize our gURLBar.handleCommand function early before other extensions change
    // gURLBar.handleCommand or searchbar.handleSearchCommand by replacing the original function
    // url-fixer also prevent the use of eval changes by using closure in the replcaed function
    Tabmix.navToolbox.initializeURLBar();
    Tabmix.navToolbox.initializeSearchbar();

    // fix webSearch to open new tab if tab is lock
    // Searchbar Autosizer extension wrap this function before "load" event
    Tabmix.newCode("BrowserSearch.webSearch", BrowserSearch.webSearch)._replace(
      'openUILinkIn(Services.search.defaultEngine.searchForm, "current");',
      'gBrowser.TMP_openURI(Services.search.defaultEngine.searchForm);', {check: typeof(Omnibar) == "undefined"}
    ).toCode();

    if ("_update" in TabsInTitlebar) {
      // set option to Prevent double click on Tab-bar from changing window size.
      Tabmix.newCode("TabsInTitlebar._update", TabsInTitlebar._update)._replace(
        'this._dragBindingAlive',
        '$& && Tabmix.prefs.getBoolPref("dblClickTabbar_changesize")'
      )._replace(
        'function rect(ele)',
        'let rect = function _rect(ele)' // for strict mode
      )._replace(
        /(\})(\)?)$/,
        // when we get in and out of tabsintitlebar mode call updateScrollStatus
        'if (TabmixTabbar._enablePositionCheck && TabmixTabbar.getTabsPosition() != TabmixTabbar._tabsPosition)\
           TabmixTabbar.updateScrollStatus();\
         $1$2'
      ).toCode();
    }

    try {
      TMP_TabView._patchBrowserTabview();
    } catch (ex) {Tabmix.assert(ex);}

    // we can't use TabPinned.
    // gBrowser.pinTab call adjustTabstrip that call updateScrollStatus
    // before it dispatch TabPinned event.
    Tabmix.newCode("gBrowser.pinTab", gBrowser.pinTab)._replace(
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
    if ("faviconize" in window && "override" in faviconize) {
      Tabmix.newCode("TMP_TabView.checkTabs", TMP_TabView.checkTabs)._replace(
        '!tab.pinned',
        '$& && !tab.hasAttribute("faviconized")'
      ).toCode();

      // change adjustTabstrip
      faviconize.override.adjustTabstrip = function() { };
    }
  },

  _windowInitialized: false,
  onWindowOpen: function TMP_EL_onWindowOpen() {
    if (this._windowInitialized)
      return;

    this._windowInitialized = true;
    window.removeEventListener("load", this, false);

    window.addEventListener("unload", this, false);
    window.addEventListener("fullscreen", this, true);

    var tabBar = gBrowser.tabContainer;

    tabBar.addEventListener("DOMMouseScroll", this, true);

    var tabView = document.getElementById("tab-view-deck");
    if (tabView) {
      tabView.addEventListener("tabviewhidden", this, true);
      tabView.addEventListener("tabviewshown", this, true);
      tabBar.addEventListener("TabShow", this, true);
      tabBar.addEventListener("TabHide", this, true);
    }

    try {
      TabmixProgressListener.startup(gBrowser);
    } catch (ex) {Tabmix.assert(ex);}

    gBrowser.mPanelContainer.addEventListener("click", Tabmix.contentAreaClick._contentLinkClick, true);

    // Bug 455553 - New Tab Page feature - landed on 2012-01-26 (Firefox 12)
    if (typeof isBlankPageURL == "function") {
      Tabmix.isBlankPageURL = isBlankPageURL;
      Tabmix.__defineGetter__("newTabURL", function() BROWSER_NEW_TAB_URL);
      Tabmix.newTabURLpref = "browser.newtab.url";
    }
    else {
      Tabmix.isBlankPageURL = function TMP_isBlankPageURL(aURL) {
        return aURL == "about:blank";
      }
      Tabmix.newTabURL = "about:blank";
      Tabmix.newTabURLpref = "extensions.tabmix.newtab.url";
    }

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

    if (Tabmix.isPlatform("Mac")) {
      Tabmix.isMac = true;
      tabBar.setAttribute("Mac", "true");
      // get Mac drop indicator marginBottom ,   Mac default theme have marginBottom: -24px
      let ind = gBrowser.tabContainer._tabDropIndicator
      if (ind) {
        TMP_tabDNDObserver.marginBottom = Tabmix.getStyle(ind, "marginBottom");
      }
    }

    var tabsToolbar = document.getElementById("TabsToolbar");
    if (navigator.oscpu.indexOf("Windows NT 6.1") == 0) {
      Tabmix.setItem(tabsToolbar, "tabmix_aero", true);
    }

    var skin = Services.prefs.getCharPref("general.skins.selectedSkin");
    var platform;
    if (skin=="classic/1.0") {
      if (Tabmix.isMac) {
        tabBar.setAttribute("classic", "v4Mac");
        platform = "v4Mac";
      }
      else if (Tabmix.isPlatform("Linux")) {
        tabBar.setAttribute("classic", "v3Linux");
        tabBar.setAttribute("platform", "linux");
        platform = "linux";
///XXX test if this is still the case
        TMP_tabDNDObserver.LinuxMarginEnd = -2;
        Tabmix.setItem(tabsToolbar, "tabmix_skin", "classic");
      }
      else {
        let version = navigator.oscpu.indexOf("Windows NT 6.1") == 0 ? "v40aero" : "v40";
        tabBar.setAttribute("classic40", version);
        Tabmix.setItem(tabsToolbar, "classic40", version);
        platform = "xp40";
      }
    }
    else {
      //XXX need to add theme list here
      var themes = /^(iPoxRemix|Ie8fox|Vfox3)/;
      if (themes.test(skin)) {
        // add backgroundrepeat Attribute for theme for use in multi-row
        tabBar.setAttribute("backgroundrepeat" , true);
      }
      switch (skin) {
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

    // for new tab icon on context menu
    Tabmix.setItem("context_newTab", "platform", platform);

    // don't remove maybe some themes use this with Tabmix
    tabBar.setAttribute("tabmix_firefox3" , true);

    if (Tabmix.singleWindowMode)
      gTMPprefObserver.setSingleWindowUI();

    gTMPprefObserver.toggleKey("key_tm_slideShow", "extensions.tabmix.disableF8Key");
    gTMPprefObserver.toggleKey("key_tm_toggleFLST", "extensions.tabmix.disableF9Key");

    try {
      gTMPprefObserver.createColorRules();
    } catch (ex) {Tabmix.assert(ex);}

    var position = Tabmix.prefs.getIntPref("newTabButton.position");
    gTMPprefObserver.changeNewTabButtonSide(position);
    TMP_ClosedTabs.setButtonType(Tabmix.prefs.getBoolPref("undoCloseButton.menuonly"));

    TabmixTabbar.hideMode = Tabmix.prefs.getIntPref("hideTabbar");
   /*
    *  In the first time TMP is running we need to match extensions.tabmix.hideTabbar to browser.tabs.autoHide.
    *  extensions.tabmix.hideTabbar default is 0 "Never Hide tabbar"
    *  if browser.tabs.autoHide is true we need to make sure extensions.tabmix.hideTabbar is set to 1 "Hide tabbar when i have only one tab":
    */
    if (Services.prefs.getBoolPref("browser.tabs.autoHide") && TabmixTabbar.hideMode == 0) {
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

    // progressMeter on tabs
    gTMPprefObserver.setProgressMeter();

    // tabmix Options in Tools menu
    document.getElementById("tabmix-menu").hidden = !Tabmix.prefs.getBoolPref("optionsToolMenu");

    gTMPprefObserver.addWidthRules();
    TabmixSessionManager.updateSettings();

    tabBar.adjustTabstrip = Tabmix.adjustTabstrip;
    delete Tabmix.adjustTabstrip;
  },

  _tabStillLoading: 0,
  onSSTabRestoring: function TMP_EL_onSSTabRestoring(aEvent) {
   /**
    * set tab title to user defined name or bookmark title when sessionStore restore tabs
    * sessionStore prepare all the tabs before it starts real loading
    * catch the first SSTabRestoring and prepare as well
    */
    if (this._tabStillLoading == 0) {
      let tabWidthChanged;
      let setWidth = TabmixTabbar.widthFitTitle && TabmixTabbar.hideMode != 2;
      for (let i = 0; i < gBrowser.tabs.length; i++) {
        let tab = gBrowser.tabs[i];
        let browser = tab.linkedBrowser;
        let url = browser.userTypedValue;
        let tabStillLoading = Tabmix.isVersion(110) ? "__SS_tabStillLoading" in browser && browser.__SS_tabStillLoading :
            browser.__SS_data && browser.__SS_data._tabStillLoading;
        if (url && tabStillLoading) {
          this._tabStillLoading++;
          let title = TMP_SessionStore._getTitle(browser.__SS_data, url, tab.label);
          if (title != tab.label) {
            if (setWidth) {
              tab.removeAttribute("width");
              tabWidthChanged = true;
            }
            tab.label = title;
          }
        }
      }
      if (tabWidthChanged) {
        TabmixTabbar.updateScrollStatus();
        TabmixTabbar.updateBeforeAndAfter();
      }
    }

    var tab = aEvent.target;
    if (this._tabStillLoading > 0)
      this._tabStillLoading--;

    Tabmix.restoreTabState(tab);

    // don't mark new tab as unread
    var url = tab.linkedBrowser.currentURI.spec;
    if (url == "about:blank" || url == "about:newtab")
      tab.setAttribute("visited", true);
  },

  onSSTabClosing: function TMP_EL_onSSTabClosing(aEvent) {
    var tab = aEvent.target;
/// test if we need this for FF 4.0
    var browser = tab.linkedBrowser;
    var iconURL = browser.mIconURL;
    if (tab.hasAttribute("busy") || tab.getAttribute("image") != iconURL) {
      tab.removeAttribute("busy");
      if (iconURL)
        tab.setAttribute("image", iconURL);
      else if (browser.currentURI && !(/^https?:/.test(browser.currentURI.spec)))
        gBrowser.useDefaultIcon(tab);
    }
  },

  onFullScreen: function TMP_EL_onFullScreen(aPositionChanged) {
    // add fullscr-bottom-toggler when tabbar is on the bottom
    var fullScrToggler = document.getElementById("fullscr-bottom-toggler");
    var fullScreen = window.fullScreen || document.mozFullScreen;
    if (TabmixTabbar.position == 1 && (!fullScreen || aPositionChanged)) {
      if (!fullScrToggler) {
        fullScrToggler = document.createElement("hbox");
        fullScrToggler.id = "fullscr-bottom-toggler";
        fullScrToggler.collapsed = true;
        let addonBar = document.getElementById("addon-bar");
        addonBar.parentNode.insertBefore(fullScrToggler, addonBar);

        if (Tabmix.isVersion(120)) {
          Tabmix.newCode("FullScreen.sample", FullScreen.sample)._replace(
            'gNavToolbox.style.marginTop = "";',
            'TMP_eventListener._updateMarginBottom("");\
             $&'
          )._replace(
            'gNavToolbox.style.marginTop = gNavToolbox.boxObject.height * pos * -1 + "px";',
            '$&\
             TMP_eventListener._updateMarginBottom(gNavToolbox.style.marginTop);'
          ).toCode();
        }
        else {
          Tabmix.newCode("FullScreen._animateUp", FullScreen._animateUp)._replace(
            'gNavToolbox.style.marginTop = "";',
            'TMP_eventListener._updateMarginBottom("");\
             $&'
          )._replace(
            'gNavToolbox.style.marginTop = animateFrameAmount * -1 + "px";',
            '$&\
             TMP_eventListener._updateMarginBottom(gNavToolbox.style.marginTop);'
          ).toCode();
        }

        if (Tabmix.isVersion(100)) {
          Tabmix.newCode("FullScreen.enterDomFullScreen", FullScreen.enterDomFullScreen)._replace(
            /(\})(\)?)$/,
            '  fullScrToggler = document.getElementById("fullscr-bottom-toggler");' +
            '  if (fullScrToggler) {' +
            '    fullScrToggler.removeEventListener("mouseover", TMP_eventListener._expandCallback, false);' +
            '    fullScrToggler.removeEventListener("dragenter", TMP_eventListener._expandCallback, false);' +
            '  }' +
            '$1$2'
          ).toCode();
        }
      }
      if (aPositionChanged) {
        this.mouseoverToggle(false);
      }
      if (!document.mozFullScreen) {
        fullScrToggler.addEventListener("mouseover", this._expandCallback, false);
        fullScrToggler.addEventListener("dragenter", this._expandCallback, false);
        fullScrToggler.collapsed = false;
      }
    }
    else if (fullScrToggler && fullScreen) {
      this._updateMarginBottom("");
      fullScrToggler.removeEventListener("mouseover", this._expandCallback, false);
      fullScrToggler.removeEventListener("dragenter", this._expandCallback, false);
      fullScrToggler.collapsed = true;
    }
    if (fullScreen)
      TMP_eventListener._updateMultiRow();
  },

  _updateMarginBottom: function TMP_EL__updateMarginBottom(aMargin) {
    if (TabmixTabbar.position == 1) {
      let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
      bottomToolbox.style.marginBottom = aMargin;
    }
  },

  _expandCallback: function TMP_EL__expandCallback() {
    if (TabmixTabbar.hideMode == 0 || TabmixTabbar.hideMode == 1 && gBrowser.tabs.length > 1)
      FullScreen.mouseoverToggle(true);
  },

  mouseoverToggle: function (aShow) {
    document.getElementById("fullscr-bottom-toggler").collapsed = aShow;
    let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
    if (aShow) {
      bottomToolbox.style.marginBottom = "";
      gTMPprefObserver.updateTabbarBottomPosition();
    }
    else {
      let bottombox = document.getElementById("browser-bottombox");
      // changing the margin trigger resize event that calls updateTabbarBottomPosition
      bottomToolbox.style.marginBottom =
          -(bottomToolbox.getBoundingClientRect().height +
          bottombox.getBoundingClientRect().height) + "px";
    }
  },

  updateMultiRow: function () {
    if (TabmixTabbar.isMultiRow) {
      gBrowser.tabContainer.updateVerticalTabStrip();
      gBrowser.tabContainer.setFirstTabInRow();
      TabmixTabbar.updateBeforeAndAfter();
    }
  },

  // Function to catch when new tabs are created and update tab icons if needed
  // In addition clicks and doubleclick events are trapped.
  onTabOpen: function TMP_EL_onTabOpen(aEvent) {
    var tab = aEvent.target;
    this.setTabAttribute(tab);
    TMP_LastTab.tabs = null;
    TMP_LastTab.attachTab(tab);
    tablib.setLoadURIWithFlags(tab.linkedBrowser);
    if (TabmixTabbar.lockallTabs)
      tab.setAttribute("locked", "true");
  },

  // this function call onTabOpen_updateTabBar after some delay
  // when more the one tabs opened at once
  lastTimeTabOpened: 0,
  onTabOpen_delayUpdateTabBar: function TMP_EL_onTabOpen_delayUpdateTabBar(aTab) {
    let tabBar = gBrowser.tabContainer;
    let self = this, newTime = new Date().getTime();
    if (tabBar.overflow || newTime - this.lastTimeTabOpened > 200) {
      this.onTabOpen_updateTabBar(aTab);
      this.lastTimeTabOpened = newTime;
    }
    else if (!tabBar.TMP_onOpenTimeout) {
      tabBar.TMP_onOpenTimeout = window.setTimeout( function TMP_onOpenTimeout(tab) {
        if (tabBar.TMP_onOpenTimeout) {
          clearTimeout(tabBar.TMP_onOpenTimeout);
          tabBar.TMP_onOpenTimeout = null;
        }
        self.onTabOpen_updateTabBar(tab);
      }, 200, aTab);
    }
  },

  // TGM extension use it
  onTabOpen_updateTabBar: function TMP_EL_onTabOpen_updateTabBar(aTab) {
    if (aTab.__newLastTab) {
      delete aTab.__newLastTab;
      return;
    }
    var tabBar = gBrowser.tabContainer;
    if (!tabBar.overflow) {
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

    // if we close the 2nd tab and browser.tabs.autoHide is true reset all scroll and multi-row parameter
    // strip already collapsed at this point
    var tabsCount = tabBar.childNodes.length - gBrowser._removingTabs.length;
    if (tabsCount == 2 && Services.prefs.getBoolPref("browser.tabs.autoHide")) {
      TabmixTabbar.setHeight(1);
      tabBar.removeAttribute("multibar");
    }

    // when browser.tabs.animate is true gBrowser._endRemoveTab calls
    // onTabClose_updateTabBar.
    // we would like to get early respond when row height is going to change.
    var updateNow = !Services.prefs.getBoolPref("browser.tabs.animate");
    if (!updateNow && tabBar.hasAttribute("multibar")) {
      let lastTab = tabBar.visibleTabsLastChild;
      if (!TabmixTabbar.inSameRow(lastTab, TMP_TabView.previousVisibleSibling(lastTab))) {
        updateNow = true;
        // if the removed tab is single in its row hide it
        if (lastTab == tab)
          tab.style.setProperty("opacity", "0", "important");
      }
    }

    if (updateNow)
      this.onTabClose_updateTabBar(tab);
  },

  // TGM extension use it
  onTabClose_updateTabBar: function TMP_EL_onTabClose_updateTabBar(aTab, aDelay) {
    // it the tab is not in the curent group we don't have to do anything here.
    if (aTab._tPosInGroup == -1)
      return;

    var tabBar = gBrowser.tabContainer;
    function _updateTabstrip() {
      if (tabBar.getAttribute("multibar") == "true" &&
          tabBar.lastTabRowNumber < TabmixTabbar.visibleRows)
        tabBar.updateVerticalTabStrip();
      TabmixTabbar.updateBeforeAndAfter();
    }

    // workaround when we remove last visible tab
    if (tabBar.firstChild.pinned && TabmixTabbar.isMultiRow && tabBar.overflow && aTab._tPos >= tabBar.visibleTabsLastChild._tPos)
      tabBar.mTabstrip.ensureElementIsVisible(gBrowser.selectedTab, false);

    if (tabBar.disAllowNewtabbutton)
      tabBar.adjustNewtabButtonvisibility();
    if (TabmixTabbar.isMultiRow && tabBar.hasAttribute("multibar")) {
      _updateTabstrip();
      setTimeout(function(){_updateTabstrip();}, 0);
    }
  },

  onTabSelect: function TMP_EL_TabSelect(aEvent) {
    var tab = aEvent.target;
    var tabBar = gBrowser.tabContainer;

    // for ColorfulTabs 6.0+
    // ColorfulTabs trapp TabSelect event after we do
    // we need to set standout class before we check for getTabRowNumber
    // and mTabstrip.ensureElementIsVisible
    // this class change tab height (by changing the borders)
    if (typeof colorfulTabs == "object" && colorfulTabs.standout &&
        tab.className.indexOf("standout") == -1) {
      for (let i = 0; i < gBrowser.tabs.length; i++) {
        let _tab = gBrowser.tabs[i];
        if (_tab.className.indexOf("standout") > -1) {
          _tab.className = _tab.className.replace(" standout", "");
          break;
        }

      }
      tab.className = tab.className + " standout";
    }

    // update this functions after new tab select
    tab.setAttribute("flst_id", new Date().getTime());
    if (!tab.hasAttribute("visited"))
      tab.setAttribute("visited", true);
    TMP_LastTab.OnSelect();
    TabmixSessionManager.tabSelected(true);

    if (tabBar.hasAttribute("multibar")) {
      let top = tabBar.topTabY;
      let tabRow = tabBar.getTabRowNumber(tab, top);
      var prev = TMP_TabView.previousVisibleSibling(tab), next = TMP_TabView.nextVisibleSibling(tab);
      if ( prev && tabRow != tabBar.getTabRowNumber(prev, top) )
        prev.removeAttribute("beforeselected");
      if ( next && tabRow != tabBar.getTabRowNumber(next, top) )
        next.removeAttribute("afterselected");
    }

    var tabsBottom = document.getAnonymousElementByAttribute(tabBar, "class", "tabs-bottom");
    if (tabsBottom)
      Tabmix.setItem(tabBar, "tabonbottom", tab.baseY >= tabsBottom.boxObject.y || null);
  },

  onTabMove: function TMP_EL_onTabMove(aEvent) {
    var tab = aEvent.target;
    // moveTabTo call _positionPinnedTabs when pinned tab moves
    if (!tab.pinned)
      gBrowser.tabContainer.setFirstTabInRow();
    TabmixSessionManager.tabMoved(tab, aEvent.detail, tab._tPos);
  },

  onTabUnpinned: function TMP_EL_onTabUnpinned(aEvent) {
    var tab = aEvent.target;
    if (tab.hasAttribute("_lockedAppTabs")) {
      gBrowser.lockTab(tab);
    }
    tab.style.marginTop = "";
    TabmixTabbar.updateScrollStatus();
    TabmixTabbar.updateBeforeAndAfter();
  },

  onTabBarScroll: function TMP_EL_onTabBarScroll(aEvent) {
    var tabBar = gBrowser.tabContainer;
    tabBar.removeShowButtonAttr();

    var shouldMoveFocus = Tabmix.prefs.getBoolPref("enableScrollSwitch");
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
    else if (direction != 0 && !Tabmix.extensions.treeStyleTab) {
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

        if (tabsSrip._prevMouseScrolls.every(function(prev) prev == isVertical))
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

    var isLastWindow = Tabmix.numberOfWindows() == 0;
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

    TabmixSessionManager.onWindowClose(isLastWindow);
    TabmixContext.toggleEventListener(false);

    TMP_Places.deinit();
    TMP_LastTab.deinit();

    window.removeEventListener("fullscreen", this, true);
    var fullScrToggler = document.getElementById("fullscr-bottom-toggler");
    if (fullScrToggler) {
      fullScrToggler.removeEventListener("mouseover", this._expandCallback, false);
      fullScrToggler.removeEventListener("dragenter", this._expandCallback, false);
    }

    gBrowser.tabContainer.removeEventListener("SSTabRestoring", this, true);
    gBrowser.tabContainer.removeEventListener("SSTabClosing", this, true);
    gBrowser.tabContainer.removeEventListener("TabOpen", this, true);
    gBrowser.tabContainer.removeEventListener("TabClose", this, true);
    gBrowser.tabContainer.removeEventListener("TabSelect", this, true);
    gBrowser.tabContainer.removeEventListener("TabUnpinned", this, true);
    gBrowser.tabContainer.removeEventListener("TabMove", this, true);

    let alltabsPopup = document.getElementById("alltabs-popup");
    if (alltabsPopup)
      alltabsPopup.removeEventListener("popupshown", alltabsPopup.__ensureElementIsVisible, false);

    gBrowser.tabContainer.removeEventListener("DOMMouseScroll", this, true);

    var tabView = document.getElementById("tab-view-deck");
    if (tabView) {
      tabView.removeEventListener("tabviewhidden", this, false);
      tabView.removeEventListener("tabviewshown", this, false);
      gBrowser.tabContainer.removeEventListener("TabShow", this, true);
      gBrowser.tabContainer.removeEventListener("TabHide", this, true);
      TMP_TabView._resetTabviewFrame();
    }
    gBrowser.mPanelContainer.addEventListener("click", Tabmix.contentAreaClick._contentLinkClick, true);

    // TreeStyleTab extension add this to be compatible with old tabmix version
    // we call removeEventListener again here in case user close the window without opening new tabs
    if ("TreeStyleTabBrowser" in window && "tabxTabAdded" in window)
      gBrowser.tabContainer.removeEventListener('DOMNodeInserted', tabxTabAdded, true);

    gTMPprefObserver.removeObservers();
    gTMPprefObserver.dynamicRules = null;

    TabmixProgressListener.listener.mTabBrowser = null;
    gBrowser.removeTabsProgressListener(TabmixProgressListener.listener);

    if (Tabmix.SlideshowInitialized && Tabmix.flst.slideShowTimer)
      Tabmix.flst.cancel();

    Tabmix.navToolbox.deinit();
  },

  // some theme not useing updated Tabmix tab binding
  // we check here that all of our attribute exist
  setTabAttribute: function TMP_EL_setTabAttribute(aTab) {
//XXX need to improve this
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
      if (node)
        node.setAttribute(aAtt, aValue);
    }

    updateAttrib("class", "tab-text-container", "class", "tab-text-stack");

    let button = document.getAnonymousElementByAttribute(aTab, "button_side", "left");
    if (button)
      return;

    let leftButton;
    let rightButton;
    let tabMiddle, tabContent;
    let classString = /tab-middle|box-inherit|tab-image-middle|tab-body/;

    function getCloseButtons(aNodes) {
      Array.slice(aNodes).forEach(function(aNode) {
        if (leftButton && rightButton)
          return;
        if (/tab-stack/.test(aNode.getAttribute("class")))
          tabContent = aNode.firstChild;
        else if (classString.test(aNode.getAttribute("class")))
          tabMiddle = aNode;
        else if (aNode.localName == "toolbarbutton" && aNode.getAttribute("anonid") == "tmp-close-button") {
          if (leftButton) {
            rightButton = aNode;
            aNode.setAttribute("button_side", "right");
          }
          else {
            leftButton = aNode;
            aNode.setAttribute("button_side", "left");
          }
        }
      });
    }

    // 1st search in tab
    getCloseButtons(document.getAnonymousNodes(aTab));
    // 2nd search in tab-content - Firefox 4.0
    if (!rightButton && !leftButton && tabContent)
      getCloseButtons(tabContent.childNodes);
    // 3nd search in tab-middle
    if (!rightButton && !leftButton && tabMiddle)
      getCloseButtons(tabMiddle.childNodes);
    // only one button !
    if (!rightButton && leftButton)
      leftButton.setAttribute("button_side", "right");

    aTab.setAttribute("context", gBrowser.tabContextMenu.id);

    if (leftButton)
      leftButton.setAttribute("clickthrough", "never");
    if (rightButton)
      rightButton.setAttribute("clickthrough", "never");
    updateAttrib("class", "showhover tabs-closebutton", "clickthrough", "never");
    updateAttrib("class", "tab-icon-image", "role", "presentation");
    updateAttrib("class", "tab-text", "role", "presentation");
  }

}
