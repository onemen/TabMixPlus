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

  if (this.isVersion(40)) {
    // multi-rows total heights are diffrent when tabs on top
    // since this isnot trigger any other event that we can listen to
    // we force to add here a call to reset tabbar height
    TabsOnTop.tabmix_originaltoggle = TabsOnTop.toggle;
    TabsOnTop.toggle = function TabsOnTop_toggle() {
      this.tabmix_originaltoggle.apply(this, arguments);
      if (TabmixTabbar.visibleRows > 1)
        TabmixTabbar.setHeight(TabmixTabbar.visibleRows, true);
    }

    let closeButton = document.getElementById("tabs-closebutton");
    if (closeButton)
      closeButton.setAttribute("onclick","if (event.button == 1) TMP_ClosedTabs.undoCloseTab();");
  }
  else {
    // replace browser handlers with ours so it recognizes when tabs are acted on
    gBrowser.onTabBarDblClick = function TMP_gBrowser_onTabBarDblClick(aEvent) {TabmixTabClickOptions.onTabBarDblClick(aEvent);};
    gBrowser.onTabClick = function TMP_gBrowser_onTabClick(aEvent) {TabmixTabClickOptions.onTabClick(aEvent);};
    window.setTimeout(function () {Tabmix.delayedStartup();}, 0);

    let goPopup = document.getElementById("goPopup");
    if (goPopup) {
      goPopup.addEventListener("popupshowing", TMP_Places.historyMenuItemsTitle, false);
      let historyMenu = goPopup.parentNode;
      if (historyMenu)
        historyMenu.setAttribute("oncommand", "TMP_Places.historyMenu(event);");
    }

    gBrowser.onresize = function gBrowser_onresize(aEvent) {TabmixTabbar.widthChange(aEvent);};

    // from Firefox 4.0+ window.BrowserHome is the same as window.BrowserGoHome
    // Browser:Home open in new tab if the curren tab is locked
    window.BrowserHome = this.browserHome;
  }

  if(gBrowser.moveTabTo)
    gBrowser.moveTabTo = gBrowser.TMmoveTabTo;

  document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", TabmixContext.updateMainContextMenu, false);

  // override some of All-in-One Gestures function
  // override the duplicate tab function
  if (typeof aioDupTab == 'function')
    aioDupTab = function() { gBrowser.duplicateTab(gBrowser.mCurrentTab); };

  //override the duplicate in new window function
  if (typeof aioDupWindow == 'function')
    aioDupWindow = function() { gBrowser.duplicateInWindow(gBrowser.mCurrentTab); };

  //override the aioCloseWindow function
  if (typeof aioCloseWindow == 'function')
    aioCloseWindow = BrowserTryToCloseWindow;

  // add call to TMP_Sanitizer
  // nsBrowserGlue.js use loadSubScript to load Sanitizer so we need to add this here
  var cmd = document.getElementById("Tools:Sanitize");
  if (cmd)
    cmd.setAttribute("oncommand", cmd.getAttribute("oncommand") + " TMP_Sanitizer.tryToSanitize();");

  // if sessionStore disabled use TMP command
  window.undoCloseTab = function ct_window_undoCloseTab(aIndex, aWhere) {
    return TMP_ClosedTabs.undoCloseTab(aIndex, aWhere);
  };

  if (gBrowser.tabContainer.orient == "horizontal") {
    let tabBar = gBrowser.tabContainer;
    let stripIsHidden = TabmixSvc.prefs.getBoolPref("browser.tabs.autoHide") && !gBrowser.getStripVisibility();
    if (this.isVersion(40)) {
      if (stripIsHidden)
        gBrowser.setStripVisibilityTo(true);
      this.setItem("TabsToolbar", "onStartNewTabButton", true);
      // save mTabsNewtabButton width
      let lwtheme = document.getElementById("main-window").getAttribute("lwtheme");
      tabBar._newTabButtonWidth = lwtheme ? 31 : tabBar.mTabsNewtabButton.getBoundingClientRect().width;
      this.setItem("TabsToolbar", "onStartNewTabButton", null);
      if (stripIsHidden)
        gBrowser.setStripVisibilityTo(false);
    }
    else {
      // save mTabsNewtabButton width
      let lwtheme = document.getElementById("main-window").getAttribute("lwtheme");
      tabBar._newTabButtonWidth = lwtheme ? 31 : tabBar.mTabsNewtabButton.boxObject.width;
      // In XP default theme alltabs-button is the highest object in the tab strip
      // we need a place-holder for the height in case the user hide alltabs-buttin
      var alltabsButton = document.getAnonymousElementByAttribute(tabBar, "anonid", "alltabs-button");
      var alltabsPlaceHolder = document.getAnonymousElementByAttribute(tabBar, "id", "alltabs-place-holder");
      if (alltabsButton && alltabsPlaceHolder) {// mAllTabsButton removed from gBrowser in firefox 3.5 by bug 347930
        if (stripIsHidden)
          gBrowser.setStripVisibilityTo(true);
        alltabsPlaceHolder.setAttribute("height", alltabsButton.parentNode.boxObject.height);
        if (stripIsHidden)
          gBrowser.setStripVisibilityTo(false);
      }
    }
  }

  // we eval navigator-toolbox customizeDone in Tabmix.delayedStartup
  this._bottomPosition = false;
  tablib.browserToolboxCustomizeDone();
}

Tabmix.delayedStartup = function TMP_delayedStartup() {
  TabmixTabbar._enablePositionCheck = true;

  TabmixTabbar.updateDisplayBlock();
  /* Add attribute to nsSessionStore persistTabAttribute after delay
     we call this after nsSessionStore.init
     we add this also when we use TMP session manager.
     we use Firefox SessionStore closed tab service and for restore after restart
  */
  if (this.isFirstWindow)
    TMP_SessionStore.persistTabAttribute();

  TMP_ClosedTabs.setButtonDisableState();
  TabmixSessionManager.toggleRecentlyClosedWindowsButton();
  gBrowser.tabContainer.nextTab = 1;
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

  // set title at startup if we not use session manager
  // startup page or home page load before bookmarks service
  if (TabmixSvc.prefs.getBoolPref("extensions.tabmix.titlefrombookmark")) {
    for (let i = 0; i < gBrowser.mPanelContainer.childNodes.length ; i++) {
      let browser = gBrowser.getBrowserAtIndex(i);
      let aUrl = browser.contentDocument.baseURI;
      aUrl = (aUrl) ? aUrl : browser.currentURI.spec ;
      let bookMarkName = TMP_Places.getTitleFromBookmark(aUrl);
      if (bookMarkName && browser.contentDocument.title != bookMarkName)
        browser.contentDocument.title = bookMarkName;
    }
  }

  var toolbox = document.getElementById("navigator-toolbox");
  window._OriginalToolboxCustomizeDone = toolbox.customizeDone;
  toolbox.customizeDone = function TMP_customizeDone(aToolboxChanged) {
    window._OriginalToolboxCustomizeDone(aToolboxChanged);
    try {
      if (Tabmix._bottomPosition) {
         Tabmix._bottomPosition = null;
         gTMPprefObserver.tabBarPositionChanged(1);
      }

      if (aToolboxChanged) {
        tablib.browserToolboxCustomizeDone();
        if (Tabmix.isVersion(40) && !TabmixTabbar._needResetOnCustomizeDone) {
          TabmixTabbar.updateScrollStatus();
          TabmixTabbar.updateBeforeAndAfter();
        }

        // in Firefox 4.0+ make sure our scroll buttons box is after tabbrowser-tabs
        let box = document.getElementById("tabmixScrollBox");
        if (box && box != gBrowser.tabContainer.nextSibling) {
          let useTabmixButtons = TabmixTabbar.scrollButtonsMode > TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT;
          TabmixTabbar.setScrollButtonBox(useTabmixButtons, true, true);
          if (useTabmixButtons && document.getElementById("TabsToolbar").hasAttribute("tabstripoverflow")) {
            let tabStrip = gBrowser.tabContainer.mTabstrip;
            tabStrip._scrollButtonUp.collapsed = tabStrip._scrollButtonDown.collapsed = false;
          }
        }
      }

      // fix incompatibility with Personal Titlebar extension
      // the extensions trigger tabbar binding reset on toolbars customize
      // we need to init our ui settings again
      TabmixTabbar._toolboxcustomizeStart = false;
      if (TabmixTabbar._needResetOnCustomizeDone) {
        TabmixTabbar.visibleRows = 1;
        TabmixTabbar.updateSettings(false);
        TabmixTabbar._needResetOnCustomizeDone = false;
      }

      // if tabmix option dialog is open update visible buttons and set focus if needed
      var optionWindow = TabmixSvc.wm.getMostRecentWindow("mozilla:tabmixopt");
      if (optionWindow) {
        optionWindow.toolbarButtons(window);
        if ("_tabmixCustomizeToolbar" in optionWindow) {
          delete optionWindow._tabmixCustomizeToolbar;
          optionWindow.focus();
        }
      }
    } catch (ex) {Tabmix.assert(ex, "error in TMP_customizeDone");}
  };

  if (this.isVersion(40)) {
    // set option to Prevent double click on Tab-bar from changing window size.
    if (!TabmixSvc.prefs.getBoolPref("extensions.tabmix.dblClickTabbar_changesize"))
      document.getElementById("TabsToolbar")._dragBindingAlive = false;

    // we repaet this after delay in case some extension change tabContext menu id
    let alltabsPopup = document.getElementById("alltabs-popup");
    if (alltabsPopup)
      alltabsPopup.setAttribute("context", gBrowser.tabContextMenu.id);
  }

  TMP_extensionsCompatibility.onDelayedStartup();

  gTMPprefObserver.setMenuIcons();

  try {
    TMP_LastTab.init();
  } catch (ex) {Tabmix.assert(ex);}
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
        Tabmix.delayedStartup();
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
        let tab = aEvent.target;
        if (tab.collapsed) {
          gBrowser.tabContainer._collapsedTabs--;
          tab.collapsed = false;
        }
        if (!gBrowser.tabContainer._onDelayTabHide) {
          // pass aEvent to this function for use in TGM
          gBrowser.tabContainer._onDelayTabHide = window.setTimeout(function (aEvent) {
            gBrowser.tabContainer._onDelayTabHide = null;
            TMP_eventListener.onTabClose_updateTabBar(aEvent.target, true);
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
      Tabmix.lazy_import(TabmixSessionManager, "_decode", "Decode", "Decode");      
    } catch (ex) {Tabmix.assert(ex);}

    var tabContainer = gBrowser.tabContainer;
    tabContainer.addEventListener("SSTabRestoring", this, true);
    tabContainer.addEventListener("SSTabClosing", this, true);
    tabContainer.addEventListener("TabOpen", this, true);
    tabContainer.addEventListener("TabClose", this, true);
    tabContainer.addEventListener("TabSelect", this, true);

    try {
      TMP_extensionsCompatibility.onContentLoaded();
    } catch (ex) {Tabmix.assert(ex);}

    if (Tabmix.isVersion(40)) {
      Tabmix.contentAreaClick.init();
    
      tabContainer.addEventListener("TabUnpinned", this, true);

      if ("_update" in TabsInTitlebar) {
        // set option to Prevent double click on Tab-bar from changing window size.
        Tabmix.newCode("TabsInTitlebar._update", TabsInTitlebar._update)._replace(
          'this._dragBindingAlive',
          '$& && TabmixSvc.prefs.getBoolPref("extensions.tabmix.dblClickTabbar_changesize")'
        ).toCode();
      }

      try {
        TMP_TabView.init(tabContainer);
      } catch (ex) {Tabmix.assert(ex);}

      // we can't use TabPinned.
      // gBrowser.pinTab call adjustTabstrip that call updateScrollStatus
      // before it dispatch TabPinned event.
      Tabmix.newCode("gBrowser.pinTab", gBrowser.pinTab)._replace(
        'this.tabContainer.adjustTabstrip();',
        <![CDATA[
          if (TabmixTabbar.widthFitTitle && aTab.hasAttribute("width"))
            aTab.removeAttribute("width");
          if (TabmixSvc.TMPprefs.getBoolPref("lockAppTabs") &&
              !aTab.hasAttribute("locked") && "lockTab" in this) {
            this.lockTab(aTab);
            aTab.setAttribute("_lockedAppTabs", "true");
          }
          if (aTab.collapsed)
            aTab.collapsed = false;
          else
            this.tabContainer.collapsedTabs++;
          this.tabContainer.adjustTabstrip(true);
          TabmixTabbar.updateScrollStatus();
          TabmixTabbar.updateBeforeAndAfter();
        ]]>
      ).toCode();
    }
    else {
      // we call this here before some other extensions (like Highlander) change handleLinkClick
      // don't call openNewWindowWith when we are in single window mode
      // look in tablib.js for openNewWindowWith eval
      Tabmix.newCode("handleLinkClick", handleLinkClick)._replace(
        'if (event.shiftKey)',
        'if (Tabmix.singleWindowMode && event.shiftKey) { \
            openNewTabWith(href, doc, null, event, false); \
            event.stopPropagation(); \
            return true; \
          } \
         $&'
      )._replace(
        'if (tab)',
        'if (Tabmix.singleWindowMode || tab)'
      ).toCode();

      // we need this for Firefox 3.5.x - 3.6.x
      if (!("tabs" in gBrowser)) {
        // for FF 3.6 use here  mTabContainer
        gBrowser.__defineGetter__("tabs", function(){return gBrowser.mTabContainer.childNodes;});
      }
    }

   // isBlankNotBusyTab isn't exist when we call adjustTabstrip from tabcontainer constructor
   // so we add this code after constructor already run
    var adjustTabstrip = Tabmix.newCode("gBrowser.tabContainer.adjustTabstrip", tabContainer.adjustTabstrip)._replace(
      'if (this._keepLastTab) {',
      'if (!aUrl) { \
        var currentURI = tabbrowser.currentURI; \
        aUrl = currentURI ? currentURI.spec : null; \
      }\
      if (((!aUrl || aUrl == "about:blank") && tabbrowser.isBlankNotBusyTab(this.selectedItem, true)) || this._keepLastTab) {'
    );

   if (Tabmix.isVersion(40)) {
     adjustTabstrip = adjustTabstrip._replace('document.getBindingParent(this)', 'this.tabbrowser');
     adjustTabstrip = adjustTabstrip._replace(
       'this.childNodes;',
       'tabbrowser.visibleTabs;'
     )._replace(
       'this._isRTLScrollbox && !TabmixTabbar.isMultiRow ? this.firstChild : this.lastChild;',
       'TMP_TabView.checkTabs(tabs);'
     );
   }
   else
     adjustTabstrip = adjustTabstrip._replace('tabs.length', '$& - tabbrowser._removingTabs.length');

    // prevent faviconize use its own adjustTabstrip
    // in Firefox 4.0 we check for faviconized tabs in TMP_TabView.firstTab
   if ("faviconize" in window && "override" in faviconize) {
        Tabmix.newCode("TMP_TabView.checkTabs", TMP_TabView.checkTabs)._replace(
          '!tab.pinned',
          '$& && !tab.hasAttribute("faviconized")'
        ).toCode();

      // chage adjustTabstrip
      faviconize.override.adjustTabstrip = function() { };
      if (!Tabmix.isVersion(40) && !("TabGroupsManagerApiVer1" in window)) {
        adjustTabstrip = adjustTabstrip._replace(
          'this._isRTLScrollbox && !TabmixTabbar.isMultiRow ? this.firstChild : this.lastChild;',
          'TMP_TabView.checkTabs(tabs);'
        );
      }
    }
    adjustTabstrip.toCode();
    // no need to updtae updateScrollStatus
    tabContainer.adjustTabstrip(true);
  },

  onWindowOpen: function TMP_EL_onWindowOpen() {
    window.removeEventListener("load", this, false);

    window.addEventListener("unload", this, false);
    window.addEventListener("fullscreen", this, true);

    var tabbar = gBrowser.tabContainer;
    // add event for mouse scrolling on tab bar, necessary for linux
    if (Tabmix.isPlatform("Linux")) {
       document.getElementById("navigator-toolbox").addEventListener("DOMMouseScroll", this, Tabmix.isVersion(40));
       tabbar.addEventListener("DOMMouseScroll", this, Tabmix.isVersion(40));
    }
    else
       tabbar.addEventListener("DOMMouseScroll", this, Tabmix.isVersion(40));

    var tabView = document.getElementById("tab-view-deck");
    if (tabView) {
      tabView.addEventListener("tabviewhidden", this, true);
      tabView.addEventListener("tabviewshown", this, true);
      tabbar.addEventListener("TabShow", this, true);
      tabbar.addEventListener("TabHide", this, true);
    }

    try {
      TabmixProgressListener.startup(gBrowser);
    } catch (ex) {Tabmix.assert(ex);}

    if (Tabmix.isVersion(40))
      gBrowser.mPanelContainer.addEventListener("click", Tabmix.contentAreaClick._contentLinkClick, true);
    else
      gBrowser.mPanelContainer.addEventListener("click", TMP_contentLinkClick, true);

    // init tabmix functions
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
      TMP_extensionsCompatibility.onWindowOpen();
    } catch (ex) {Tabmix.assert(ex);}
    try {
      Tabmix.linkHandling_init();
    } catch (ex) {Tabmix.assert(ex);}
    try {
      TMP_tabDNDObserver.init();
    } catch (ex) {Tabmix.assert(ex);}

    var tabBar = gBrowser.tabContainer;

   /*
    * Session Manager extesion add tabs too soon for us to check isTabVisible properly
    * we get wrong scrollstatus at startup
    * we add flag to use in tabBrowser.tabContainer.isTabVisible
    */
    if (Tabmix.extensions.sessionManager && Tabmix.isWindowAfterSessionRestore)
      setTimeout(function (_tabBar) { _tabBar.removeAttribute("SM_restart"); }, 0, tabBar);
    else
      tabBar.removeAttribute("SM_restart");

    if (Tabmix.isPlatform("Mac")) {
      Tabmix.isMac = true;
      tabBar.setAttribute("Mac", "true");
     /*
      * get Mac drop indicator marginBottom ,   Mac default thme have marginBottom: -24px
      *
      * with TreeStyleTab extension vertical tabbar mTabDropIndicatorBar.firstChild is null
      */
      var ib = gBrowser.mTabDropIndicatorBar;
      if (ib && ib.firstChild) {
        TMP_tabDNDObserver.marginBottom = Tabmix.getStyle(ib.firstChild, "marginBottom");
      }
    }

    if (navigator.oscpu.indexOf("Windows NT 6.1") == 0) {
      Tabmix.setItem("TabsToolbar", "tabmix_aero", true);
    }

    var skin = TabmixSvc.prefs.getCharPref("general.skins.selectedSkin");
    var platform;
    if (skin=="classic/1.0") {
      if (Tabmix.isMac) {
        if (Tabmix.isVersion(40)) {
          tabBar.setAttribute("classic", "v4Mac");
          platform = "v4Mac";
        }
        else if (Tabmix.isVersion(36)) {
          tabBar.setAttribute("classic", "v3Mac");
          platform = "v36Mac";
        }
        else
          tabBar.setAttribute("classic", "v3Mac");
      }
      else if (Tabmix.isPlatform("Linux")) {
        tabBar.setAttribute("classic", "v3Linux");
        tabBar.setAttribute("platform", "linux");
        platform = "linux";
        TMP_tabDNDObserver.LinuxMarginEnd = -2;
        if (Tabmix.isVersion(40)) {
          Tabmix.setItem("TabsToolbar", "tabmix_skin", "classic");
        }
      }
      else {
        if (Tabmix.isVersion(40)) {
          let version = navigator.oscpu.indexOf("Windows NT 6.1") == 0 ? "v40aero" : "v40";
          tabBar.setAttribute("classic40", version);
          Tabmix.setItem("TabsToolbar", "classic40", version);
          platform = "xp40";
        }
        else {
          tabBar.setAttribute("classic", "v3");
          platform = "xp";
        }
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
        case "cfxe": //  Chromifox Extreme
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

    ///XXX - drop this and see if some one jumps
    /* tabBar.setAttribute("platform", "v35"); */

    // don't remove maybe some themes use this with Tabmix
    tabBar.setAttribute("tabmix_firefox3" , true);

    if (Tabmix.singleWindowMode)
      gTMPprefObserver.setSingleWindowUI();

    gTMPprefObserver.toggleKey("key_tm_slideShow", "extensions.tabmix.disableF8Key");
    gTMPprefObserver.toggleKey("key_tm_toggleFLST", "extensions.tabmix.disableF9Key");

    try {
      gTMPprefObserver.createColorRules();
    } catch (ex) {Tabmix.assert(ex);}

    gTMPprefObserver.tabCloseButton();

    var position = TabmixSvc.TMPprefs.getIntPref("newTabButton.position");
    gTMPprefObserver.changeNewTabButtonSide(position);
    TMP_ClosedTabs.setButtonType(TabmixSvc.TMPprefs.getBoolPref("undoCloseButton.menuonly"));

    TabmixTabbar.hideMode = TabmixSvc.TMPprefs.getIntPref("hideTabbar");
   /*
    *  In the first time TMP is running we need to match extensions.tabmix.hideTabbar to browser.tabs.autoHide.
    *  extensions.tabmix.hideTabbar default is 0 "Never Hide tabbar"
    *  if browser.tabs.autoHide is true we need to make sure extensions.tabmix.hideTabbar is set to 1 "Hide tabbar when i have only one tab":
    */
    if (TabmixSvc.prefs.getBoolPref("browser.tabs.autoHide") && TabmixTabbar.hideMode == 0) {
      TabmixTabbar.hideMode = 1;
      TabmixSvc.TMPprefs.setIntPref("hideTabbar", TabmixTabbar.hideMode);
    }
    else
      gTMPprefObserver.setAutoHidePref();

    window.setTimeout(function () {
      // initialize the value of "gTabBarWidth"
      TabmixTabbar._width = gBrowser.tabContainer.boxObject.width;
      // only hide the tabbar after we catch the width
      if (TabmixTabbar.hideMode == 2)
        Tabmix.setStripVisibilityTo(false);
    }, 100);

    TabmixTabbar.position = 0;
    if (TabmixSvc.TMPprefs.getIntPref("tabBarPosition") == 1)
      gTMPprefObserver.tabBarPositionChanged(1);

    // make sure "extensions.tabmix.undoClose" is true if "browser.sessionstore.max_tabs_undo" is not zero
    var sessionstoreUndoClose = TabmixSvc.prefs.getIntPref("browser.sessionstore.max_tabs_undo") > 0;
    if (sessionstoreUndoClose != TabmixSvc.TMPprefs.getBoolPref("undoClose"))
      TabmixSvc.TMPprefs.setBoolPref("undoClose", sessionstoreUndoClose);

    // progressMeter on tabs
    gTMPprefObserver.setProgressMeter();

    TabmixTabbar.updateSettings(true);

    // tabmix Options in Tools menu
    document.getElementById("tabmix-menu").hidden = !TabmixSvc.TMPprefs.getBoolPref("optionsToolMenu");

    TabmixSessionManager.updateSettings();
  },

  _tabStillLoading: 0,
  onSSTabRestoring: function TMP_EL_onSSTabRestoring(aEvent) {
   /**
    * set tab title to user defined name or bookmark title when sessionStore restore tabs
    * sessionStore prepare all the tabs before it starts real loading
    * catch the first SSTabRestoring and prepare as well
    */
    if (Tabmix.isVersion(40) && this._tabStillLoading == 0) {
      let tabWidthChanged;
      let setWidth = TabmixTabbar.widthFitTitle && TabmixTabbar.hideMode != 2;
      for (let i = 0; i < gBrowser.tabs.length; i++) {
        let tab = gBrowser.tabs[i];
        let browser = tab.linkedBrowser;
        let url = browser.userTypedValue;
        let tabStillLoading = Tabmix.isVersion(110) ? browser.__SS_tabStillLoading :
            browser.__SS_data && browser.__SS_data._tabStillLoading;
        if (url && tabStillLoading) {
          this._tabStillLoading++;
          let title = TMP_SessionStore._getTitle(browser.__SS_data, url, tab.label);
          if (title != tab.label) {
            if (setWidth)
              tab.removeAttribute("width");
            tab.label = title;
            if (setWidth) {
              tab.setAttribute("width", tab.boxObject.width);
              tabWidthChanged = true;
            }
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
  },

  onSSTabClosing: function TMP_EL_onSSTabClosing(aEvent) {
    var tab = aEvent.target;

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
        if (Tabmix.isVersion(40))
          document.getElementById("tabmix-bottom-toolbox").appendChild(fullScrToggler);
        else {
          let _toolbox = document.createElement("toolbox");
          _toolbox.appendChild(fullScrToggler);
          gBrowser.mTabBox.insertBefore(_toolbox, gBrowser.mTabBox.firstChild);
        }

        Tabmix.newCode("FullScreen.mouseoverToggle", FullScreen.mouseoverToggle)._replace(
          'this._isChromeCollapsed = !aShow;',
          'document.getElementById("fullscr-bottom-toggler").collapsed = aShow; \
           $&'
        ).toCode();

        if (Tabmix.isVersion(100)) {
          Tabmix.newCode("FullScreen.enterDomFullScreen", FullScreen.enterDomFullScreen)._replace(
            /(\})(\)?)$/,
            <![CDATA[
              fullScrToggler = document.getElementById("fullscr-bottom-toggler");
              if (fullScrToggler) {
                fullScrToggler.removeEventListener("mouseover", TMP_eventListener._expandCallback, false);
                fullScrToggler.removeEventListener("dragenter", TMP_eventListener._expandCallback, false);
              }
            $1$2]]>
          ).toCode();
        }
      }
      if (!document.mozFullScreen) {
        fullScrToggler.addEventListener("mouseover", this._expandCallback, false);
        fullScrToggler.addEventListener("dragenter", this._expandCallback, false);
        fullScrToggler.collapsed = false;
      }
    }
    else if (fullScrToggler && fullScreen) {
      fullScrToggler.removeEventListener("mouseover", this._expandCallback, false);
      fullScrToggler.removeEventListener("dragenter", this._expandCallback, false);
      fullScrToggler.collapsed = true;
    }
  },

  _expandCallback: function TMP_EL__expandCallback() {
    if (TabmixTabbar.hideMode == 0 || TabmixTabbar.hideMode == 1 && gBrowser.tabs.length > 1)
      FullScreen.mouseoverToggle(true);
  },

  // Function to catch when new tabs are created and update tab icons if needed
  // In addition clicks and doubleclick events are trapped.
  onTabOpen: function TMP_EL_onTabOpen(aEvent) {
    var tab = aEvent.target;
    this.setTabAttribute(tab);
    TMP_LastTab.tabs = null;
    TMP_LastTab.attachTab(tab, 1);
    tablib.setLoadURIWithFlags(tab.linkedBrowser);
    if (TabmixTabbar.lockallTabs)
      tab.setAttribute("locked", "true");

    if (!Tabmix.isVersion(40) || "TabGroupsManagerApiVer1" in window)
      // from Firefox 4.0+ we call onTabOpen_delayUpdateTabBar from _handleNewTab
      // after the tab fully opened
      this.onTabOpen_delayUpdateTabBar(tab);
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
      TabmixTabbar.updateScrollStatus();
      // make sure selected new tabs stay visible
      if (aTab == tabBar.selectedItem)
        tabBar.ensureTabIsVisible(aTab._tPos);
    }
    TabmixTabbar.updateBeforeAndAfter();
  },

  onTabClose: function TMP_EL_onTabClose(aEvent) {
    // aTab is the tab we are closing now
    var tab = aEvent.target;
    TMP_LastTab.tabs = null;
    TMP_LastTab.detachTab(tab);
    var tabBar = gBrowser.tabContainer;

    // if we close the 2nd tab and browser.tabs.autoHide is true reset all scroll and multi-row parameter
    // strip already collapsed at this point
    var tabsCount = tabBar.childNodes.length - gBrowser._removingTabs.length;
    if (tabsCount == 2 && TabmixSvc.prefs.getBoolPref("browser.tabs.autoHide")) {
      tabBar.collapsedTabs = 0;
      TabmixTabbar.setHeight(1);
      tabBar.removeAttribute("multibar");
    }
    if (tab.previousSibling && !TabmixTabbar.inSameRow(tab, tab.previousSibling))
      tab.style.setProperty("opacity", "0", "important");

    var animat = Tabmix.isVersion(40) && TabmixSvc.prefs.getBoolPref("browser.tabs.animate");
    if (!animat)
      this.onTabClose_updateTabBar(tab);
  },

  // TGM extension use it
  onTabClose_updateTabBar: function TMP_EL_onTabClose_updateTabBar(aTab, aDelay) {
    var tabBar = gBrowser.tabContainer;
    if (Tabmix.isVersion(40)) {
      // workaround when we remove last visible tab
      if (TabmixTabbar.isMultiRow && tabBar.overflow && gBrowser._numPinnedTabs > 0 && aTab._tPos >= tabBar.visibleTabsLastChild._tPos)
        tabBar.mTabstrip.ensureElementIsVisible(gBrowser.mCurrentTab, false);
      if (!tabBar.TMP_onCloseTimeout) {
        tabBar.TMP_onCloseTimeout = window.setTimeout( function TMP_onCloseTimeout() {
          if (tabBar.TMP_onCloseTimeout) {
            clearTimeout(tabBar.TMP_onCloseTimeout);
            tabBar.TMP_onCloseTimeout = null;
          }
          tabBar.adjustNewtabButtonvisibility();
          if (TabmixTabbar.isMultiRow) {
            // first we check for unpinned last tab row number
            if (tabBar.hasAttribute("multibar") &&
                tabBar._lastTabRowNumber < TabmixTabbar.visibleRows)
              tabBar._positionPinnedOnMultiRow();
            // here we check for last row for both pinned and unpinned
            if (tabBar.getAttribute("multibar") == "true" &&
                tabBar.lastTabRowNumber < TabmixTabbar.visibleRows)
              tabBar.updateVerticalTabStrip();
            TabmixTabbar.updateBeforeAndAfter();
          }
        }, aDelay ? 0 : 25);
      }
      return;
    }

    if (!TabmixTabbar.isMultiRow) {
      let lastTabVisible = tabBar.lastTabVisible;
      // only uncollapsed left tab when we can't scroll right
      if (aTab._tPos < tabBar.collapsedTabs)
        tabBar._collapsedTabs--;
      else if (lastTabVisible)
        TabmixTabbar._updateScrollLeft();
      if (lastTabVisible) {
        let rtl = tabBar._isRTLScrollbox;
        if (rtl)
          tabBar.canScrollTabsLeft = false;
        else
          tabBar.canScrollTabsRight = false;
      }

      window.setTimeout( function TMP_onCloseTimeout_singleRow() {
                           tabBar.adjustScrollTabsLeft();
                           tabBar.adjustScrollTabsRight();
                           tabBar.overflow = tabBar.canScrollTabsLeft || tabBar.canScrollTabsRight;
                           tabBar.adjustNewtabButtonvisibility();
                       }, 25);
    }
    else if (tabBar.hasAttribute("multibar")) {
      if (gBrowser.tabs.length <= tabBar.collapsedTabs + 1) {
        tabBar.rowScroll(-1);
      }
      // don't update tabBar.collapsedTabs after timeout
      // we must do it live......
      if (aTab._tPos < tabBar.collapsedTabs) {
        // don't use the setter here
        tabBar._collapsedTabs--;
      }
      if (!tabBar.TMP_onCloseTimeout) {
        tabBar.TMP_onCloseTimeout = window.setTimeout( function TMP_onCloseTimeout() {
          if (tabBar.TMP_onCloseTimeout) {
            clearTimeout(tabBar.TMP_onCloseTimeout);
            tabBar.TMP_onCloseTimeout = null;
          }
          let lastTabVisible, lastTab;
          if (tabBar.getAttribute("multibar") == "scrollbar" && tabBar.realCollapsedTabs > 0) {
            lastTab = tabBar.lastChild;
            if (tabBar.lastTabRowNumber == tabBar.maxRow && !TabmixTabbar.inSameRow(lastTab, lastTab.previousSibling)) {
              lastTabVisible = tabBar.isTabVisible(lastTab._tPos);
              tabBar.rowScroll(-1);
            }
          }
          TabmixTabbar.updateScrollStatus();
          TabmixTabbar.updateBeforeAndAfter();
          if (lastTabVisible)
            tabBar.ensureTabIsVisible(lastTab._tPos);
        }, aDelay ? 0 : 25);
      }
    }
    else
      tabBar.disAllowNewtabbutton = false;
  },

  onTabSelect: function TMP_EL_TabSelect(aEvent) {
    var tab = aEvent.target;
    var tabBar = gBrowser.tabContainer;

    // for ColorfulTabs 6.0+
    // ColorfulTabs trapp TabSelect event after we do
    // we need to set standout class before we check for getTabRowNumber
    // and ensureTabIsVisible
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
    tabBar.nextTab = 1;
    tab.setAttribute("flst_id", new Date().getTime());
    if (!tab.hasAttribute("visited"))
      tab.setAttribute("visited", true);
    TMP_LastTab.OnSelect();
    TabmixSessionManager.tabSelected(true);

    if (tabBar.hasAttribute("multibar")) {
      let top = tabBar.topTabY;
      let tabRow = tabBar.getTabRowNumber(tab, top);
      var prev = tab.previousSibling, next = tab.nextSibling;
      if ( prev && tabRow != tabBar.getTabRowNumber(prev, top) )
        prev.removeAttribute("beforeselected");
      if ( next && tabRow != tabBar.getTabRowNumber(next, top) )
        next.removeAttribute("afterselected");
    }

    var tabsBottom = document.getAnonymousElementByAttribute(tabBar, "class", "tabs-bottom");
    if (tabsBottom)
      Tabmix.setItem(tabBar, "tabonbottom", tab.baseY >= tabsBottom.boxObject.y || null);
  },

  onTabUnpinned: function TMP_EL_onTabUnpinned(aEvent) {
    var tab = aEvent.target;
    if (tab.hasAttribute("_lockedAppTabs")) {
      gBrowser.lockTab(tab);
    }
    if (Tabmix.isVersion(40)) {
      tab.style.marginTop = "";
      delete tab.__row;
    }
    else
      gBrowser.tabContainer.collapsedTabs--;
    TabmixTabbar.updateScrollStatus();
    TabmixTabbar.updateBeforeAndAfter();
  },

  onTabBarScroll: function TMP_EL_onTabBarScroll(aEvent) {
    var tabBar = gBrowser.tabContainer;

    let tabs = tabBar.getElementsByAttribute("showbutton" , "*");
    for (let i = 0; i < tabs.length; i++)
      tabs[i].removeAttribute("showbutton");

    var ScrollDirection = aEvent.detail > 0 ? 1 : -1;
      if (TabmixSvc.prefs.getBoolPref("extensions.tabmix.reversedScroll"))
        ScrollDirection = -1 * ScrollDirection;

    var shouldMoveFocus = TabmixSvc.prefs.getBoolPref("extensions.tabmix.enableScrollSwitch");
    if (Tabmix.isVersion(40) && !shouldMoveFocus)
      return;

    if (shouldMoveFocus) {
      tabBar.advanceSelectedTab(ScrollDirection, true);
    }
    else if ("TreeStyleTabBrowser" in window || tabBar.orient == "vertical") {
      if (Tabmix.isPlatform("Linux") && Tabmix.isVersion(40)) {
        aEvent.stopPropagation();
      }
      return;
    }
    else if (!TabmixTabbar.isMultiRow)
      tabBar.collapsedTabs += ScrollDirection;
    else if (TabmixTabbar.isMultiRow)
      tabBar.rowScroll(ScrollDirection);

    aEvent.stopPropagation();
    aEvent.preventDefault();
  },

  onWindowClose: function TMP_EL_onWindowClose() {
    window.removeEventListener("unload", this, false);

    if (!Tabmix.isVersion(40))
      document.getElementById("goPopup").removeEventListener("popupshowing", TMP_Places.historyMenuItemsTitle, false);

    var isLastWindow = Tabmix.numberOfWindows() == 0;
    // we close tabmix dialog windows on exit
    if (isLastWindow) {
      Array.forEach(["tabmixopt-filetype", "tabmixopt-appearance", "tabmixopt"], function(aID) {
        var win = TabmixSvc.wm.getMostRecentWindow("mozilla:" + aID);
        if (win) {
          if (aID != "tabmixopt")
            win.close();
          else
            win.setTimeout(function(){win.close();},0);
        }
      });
    }

    TabmixSessionManager.onWindowClose(isLastWindow);

    document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", TabmixContext.updateMainContextMenu, false);
    gBrowser.tabContextMenu.removeEventListener("popupshowing", TabmixContext.updateTabContextMenu, false);
    gBrowser.tabContextMenu.removeEventListener("popupshown", TabmixContext.tabContextMenuShown, false);

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
    if (Tabmix.isVersion(40)) {
      gBrowser.tabContainer.removeEventListener("TabUnpinned", this, true);

      let alltabsPopup = document.getElementById("alltabs-popup");
      if (alltabsPopup)
        alltabsPopup.removeEventListener("popupshowing", alltabsPopup.__ensureElementIsVisible, false);
    }

    if (Tabmix.isPlatform("Linux")) {
       document.getElementById("navigator-toolbox").removeEventListener("DOMMouseScroll", this, Tabmix.isVersion(40));
       gBrowser.tabContainer.removeEventListener("DOMMouseScroll", this, Tabmix.isVersion(40));
    }
    else
       gBrowser.tabContainer.removeEventListener("DOMMouseScroll", this, Tabmix.isVersion(40));

    var tabView = document.getElementById("tab-view-deck");
    if  (tabView) {
      tabView.removeEventListener("tabviewhidden", this, false);
      tabView.removeEventListener("tabviewshown", this, false);
      gBrowser.tabContainer.removeEventListener("TabShow", this, true);
      gBrowser.tabContainer.removeEventListener("TabHide", this, true);
      TMP_TabView._resetTabviewFrame();
    }
    if (Tabmix.isVersion(40))
      gBrowser.mPanelContainer.addEventListener("click", Tabmix.contentAreaClick._contentLinkClick, true);
    else
      gBrowser.mPanelContainer.addEventListener("click", TMP_contentLinkClick, true);

    // TreeStyleTab extension add this to be compatible with old tabmix version
    // we call removeEventListener again here in case user close the window without opening new tabs
    if ("TreeStyleTabBrowser" in window && "tabxTabAdded" in window)
      gBrowser.tabContainer.removeEventListener('DOMNodeInserted', tabxTabAdded, true);

    gTMPprefObserver.removeObservers();

    TabmixProgressListener.listener.mTabBrowser = null;
    gBrowser.removeTabsProgressListener(TabmixProgressListener.listener);

    if (Tabmix.SlideshowInitialized && Tabmix.flst.slideShowTimer)
      Tabmix.flst.cancel();
  },

  // some theme not useing updated Tabmix tab binding
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
      if (node)
        node.setAttribute(aAtt, aValue);
    }

    updateAttrib("class", "tab-text-container", "class", "tab-text-stack");

    let button  = document.getAnonymousElementByAttribute(aTab, "button_side", "left");
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

    if (Tabmix.isVersion(40)) {
      aTab.setAttribute("context", gBrowser.tabContextMenu.id);
    }

    if (leftButton)
      leftButton.setAttribute("clickthrough", "never");
    if (rightButton)
      rightButton.setAttribute("clickthrough", "never");
    updateAttrib("class", "showhover tabs-closebutton", "clickthrough", "never");
    updateAttrib("class", "tab-icon-image", "role", "presentation");
    updateAttrib("class", "tab-text", "role", "presentation");
  }

}