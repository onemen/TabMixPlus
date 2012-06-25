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
    this.newCode("document.getElementById('PopupAutoCompleteRichResult').onPopupClick", autoComplete.onPopupClick)._replace(
      'openUILink(url, aEvent);',
      <![CDATA[
      var isBlankTab = gBrowser.isBlankNotBusyTab(gBrowser.mCurrentTab);
      var where = isBlankTab ? "current" : whereToOpenLink(aEvent);
      var pref = "extensions.tabmix.loadUrlInBackground";
      if (Tabmix.isVersion(100))
        openUILinkIn(url, where, {inBackground: Services.prefs.getBoolPref(pref)});
      else
        openUILinkIn(url, where, false, null, null, {backgroundPref: pref});
      ]]>
    ).toCode();
  }

  window.BrowserOpenTab = TMP_BrowserOpenTab;

  this.openUILink_init();

  // for dotCOMplete extensoin
  if ("dotCOMplete" in window)
     window.dotCOMplete.realBrowserLoadURL = this.browserLoadURL;
}

/**
 * @brief Force-call the window observer at least one time.
 *
 * @returns  Nothing.
 *
 * @Theme Vista-aero 3.0.0.91 and BlueSky 3.0.0.91 use TMP_TBP_Startup in stylesheet
 *        window[onload="TMP_TBP_Startup()"]
 */
function TMP_TBP_Startup() {
  try {
    // replace old Settings.
    // we must call this before any other tabmix function
    gTMPprefObserver.updateOldStylePrefs();
    gTMPprefObserver.updateSettings();
    gTMPprefObserver.init();
    // force-call the observer once, in order to kill new windows faster
    if (Tabmix.singleWindowMode)
      TMP_DOMWindowOpenObserver.onObserve(window, TMP_DOMWindowOpenObserver);

    // make tabmix compatible with ezsidebar extension
    var fnContainer, TMP_BrowserStartup;
    if ("__ezsidebar__BrowserStartup" in window) // need to test this on firefox 16+
      [fnContainer, TMP_BrowserStartup] = [window, "__ezsidebar__BrowserStartup"];
    else if (Tabmix.isVersion(160) && "gBrowserInit" in window)
      [fnContainer, TMP_BrowserStartup] = [gBrowserInit, "onLoad"];
    else
      [fnContainer, TMP_BrowserStartup] = [window, "BrowserStartup"];
    var bowserStartup = Tabmix.newCode(null, fnContainer[TMP_BrowserStartup]);

    var pbs = Cc["@mozilla.org/privatebrowsing;1"].
              getService(Ci.nsIPrivateBrowsingService);
    TabmixSessionManager._inPrivateBrowsing = pbs.privateBrowsingEnabled;
    bowserStartup = bowserStartup._replace(
      'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);',
      <![CDATA[
       var remoteBrowser = uriToLoad.ownerDocument.defaultView.gBrowser;
       var url = remoteBrowser.getBrowserForTab(uriToLoad).currentURI.spec;
       gBrowser.tabContainer.adjustTabstrip(true, url);
       if (!Tabmix.singleWindowMode) {
         window.tabmix_afterTabduplicated = true;
         TabmixSessionManager.init();
         $&
       }
      ]]>
    );

    var windowOpeneByTabmix = "tabmixdata" in window;
    Tabmix.isFirstWindow = Tabmix.numberOfWindows() == 1;
    Tabmix.isWindowAfterSessionRestore = TMP_SessionStore._isAfterSessionRestored();

    var firstWindow = Tabmix.isFirstWindow;
    var disAllow = TabmixSessionManager._inPrivateBrowsing || TMP_SessionStore.isSessionStoreEnabled() ||
                   Tabmix.extensions.sessionManager ||
                   Tabmix.isWindowAfterSessionRestore;
    var sessionManager = Tabmix.prefs.getBoolPref("sessions.manager");
    var crashRecovery = Tabmix.prefs.getBoolPref("sessions.crashRecovery");
    var afterRestart = false;

    var restoreOrAsk = Tabmix.prefs.getIntPref("sessions.onStart") < 2 || afterRestart;
    var afterCrash = Tabmix.prefs.prefHasUserValue("sessions.crashed");

    // don't load home page on first window if session manager or crash recovery is enabled
    if (!disAllow && ((sessionManager && windowOpeneByTabmix) ||
         (firstWindow && crashRecovery && afterCrash) ||
         (firstWindow && sessionManager && restoreOrAsk))) {
      // make sure sessionstore is init without restornig pinned tabs
      TabmixSvc.ss.init(null);

      // in firefox if we are here and gHomeButton.getHomePage() == window.arguments[0] then
      // maybe all tabs in the last session were pinned, we leet firefox to load the hompages
      bowserStartup = bowserStartup._replace(
        'uriToLoad = window.arguments[0];',
        'uriToLoad = gHomeButton.getHomePage() == window.arguments[0] ? "about:blank" : window.arguments[0];'
      );
      bowserStartup = bowserStartup._replace(
        'if (window.opener && !window.opener.closed) {',
        'if (uriToLoad && uriToLoad != "about:blank")\
           for (var i = 0; i < gBrowser.tabs.length ; i++)\
             gBrowser.tabs[i].loadOnStartup = true;\
         $&'
      );
      bowserStartup = bowserStartup._replace(
        'if (window.opener && !window.opener.closed) {',
        'if (uriToLoad == "about:blank" || "tabmixdata" in window) {\
          gBrowser.selectedBrowser.stop();\
        }\
        $&'
      );
    }
    // All-in-One Sidebar 0.7.14 brake Firefox 12.0
    if (Tabmix.isVersion(120) && typeof aios_dominitSidebar == "function") {
      bowserStartup = bowserStartup._replace(
        'TabsOnTop.syncCommand();',
        'TabsOnTop.init();', {silent: true}
      );
    }
    bowserStartup.toCode(false, fnContainer, TMP_BrowserStartup);

    // call TMP_SessionStore.setService before delayedStartup, so this will run before sessionStore.init
    // At the moment we must init TabmixSessionManager before sessionStore.init
    var [name, fn] = Tabmix.isVersion(160) && "gBrowserInit" in window ?
          ["gBrowserInit._delayedStartup", gBrowserInit._delayedStartup] :
          ["delayedStartup", delayedStartup];
    Tabmix.newCode(name, fn)._replace(
      '{',
      '{\
       try {\
         if (Tabmix.isFirstWindow) TMP_SessionStore.setService(1, true); \
         TabmixSessionManager.init();\
       } catch (ex) {Tabmix.assert(ex);}'
    ).toCode();

    // look for installed extensions that are incompatible with tabmix
    if (firstWindow && Tabmix.prefs.getBoolPref("disableIncompatible")) {
      setTimeout(function checkCompatibility(aWindow) {
        let tmp = { };
        Components.utils.import("resource://tabmixplus/extensions/CompatibilityCheck.jsm", tmp);
        new tmp.CompatibilityCheck(aWindow, true);
      }, Tabmix.isVersion(40) ? 0 : 3000, window);
    }

    // add tabmix menu item to tab context menu before menumanipulator and MenuEdit initialize
    TabmixContext.buildTabContextMenu();

    TMP_BrowserStartup = fnContainer[TMP_BrowserStartup].bind(fnContainer);
    TMP_BrowserStartup();

  } catch (ex) {Tabmix.assert(ex);}
}

// this must run before all
Tabmix.beforeStartup = function TMP_beforeStartup(tabBrowser, aTabContainer) {
    // return true if all tabs in the window are blank
    tabBrowser.isBlankWindow = function() {
       for (var i = 0; i < this.tabs.length; i++) {
          if (!this.isBlankBrowser(this.getBrowserAtIndex(i)))
             return false;
       }
       return true;
    }

    //XXX isTabEmpty exist in Firefox 4.0
    tabBrowser.isBlankTab = function(aTab) {
      return this.isBlankBrowser(this.getBrowserForTab(aTab));
    }

    if (("loadTabsProgressively" in window)) {
      tabBrowser.isBlankNotBusyTab = function TMP_isBlankNotBusyTab(aTab, aboutBlank) {
         // loadTabsProgressively add pending attribute to pending tab when it stop the tab
         if (aTab.hasAttribute("busy") || aTab.hasAttribute("pending"))
            return false;

         return this.isBlankBrowser(this.getBrowserForTab(aTab), aboutBlank);
      }
    }
    else {
      tabBrowser.isBlankNotBusyTab = function TMP_isBlankNotBusyTab(aTab, aboutBlank) {
         if (aTab.hasAttribute("busy"))
            return false;

         return this.isBlankBrowser(this.getBrowserForTab(aTab), aboutBlank);
      }
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

    tabBrowser.getTabForBrowser = function (aBrowser) {
      return this._getTabForContentWindow(aBrowser.contentWindow);
    }

    tabBrowser.getTabForLastPanel = function () {
      let browser = this.mPanelContainer.lastChild.firstChild.firstChild;
      if (Tabmix.isVersion(150)) // changed by Bug 749628
        browser = browser.firstChild;
      return this._getTabForContentWindow(browser.contentWindow);
    }

    var tabContainer = aTabContainer || tabBrowser.tabContainer ||
                       document.getAnonymousElementByAttribute(tabBrowser, "anonid", "tabcontainer");

    TMP_eventListener.init(tabContainer);
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
    TabmixTabbar.widthFitTitle = Tabmix.prefs.getBoolPref("flexTabs") && (max != min);
    if (TabmixTabbar.widthFitTitle)
      this.setItem(tabContainer, "widthFitTitle", true);

    var tabscroll = Tabmix.prefs.getIntPref("tabBarMode");
    if (document.documentElement.getAttribute("chromehidden").indexOf("toolbar") != -1)
      tabscroll = 1;
    if (tabscroll < 0 || tabscroll > 3 ||
        (tabscroll != TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT && "TreeStyleTabBrowser" in window)) {
      Tabmix.prefs.setIntPref("tabBarMode", 1);
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

    if (Tabmix.prefs.prefHasUserValue("enableDebug") &&
        Tabmix.prefs.getBoolPref("enableDebug")) {
      this._debugMode = true;
    }
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
  var tabsCount = tabs.length;
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
    if (tabsCount < 2) {
      this.setAttribute("closebuttons", "alltabs");
    }
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
    if (!aUrl) {
        var currentURI = tabbrowser.currentURI;
        aUrl = currentURI ? currentURI.spec : null;
    }
    if (this._keepLastTab ||
        (!aUrl || aUrl == "about:blank") &&
        tabbrowser.isBlankNotBusyTab(this.selectedItem, true)) {
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
