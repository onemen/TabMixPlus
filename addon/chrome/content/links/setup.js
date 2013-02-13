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
      'if (Tabmix.isVersion(100))' +
      '  openUILinkIn(url, where, {' +
      '         inBackground: Services.prefs.getBoolPref(pref),' +
      '         initiatingDoc: aEvent ? aEvent.target.ownerDocument : null});' +
      'else' +
      '  openUILinkIn(url, where, false, null, null, {backgroundPref: pref});'
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
  // don't start Tabmix at all if our tabbrowser_4.xml didn't start
  // when ImTranslator extension installed
  if (!Tabmix.initialized) {
    Tabmix.initialized = true;
    if (Tabmix.isVersion(160) && "gBrowserInit" in window)
      gBrowserInit.onLoad();
    else
      BrowserStartup();
    return;
  }

  try {
    // replace old Settings.
    // we must call this before any other tabmix function
    gTMPprefObserver.updateOldStylePrefs();
    gTMPprefObserver.updateSettings();
    gTMPprefObserver.init();

    var SM = TabmixSessionManager;
    if (Tabmix.isVersion(200)) {
      SM.globalPrivateBrowsing = PrivateBrowsingUtils.permanentPrivateBrowsing;
      SM.isWindowPrivate = function SM_isWindowPrivate(aWindow) PrivateBrowsingUtils.isWindowPrivate(aWindow);
      // isPrivateWindow is fix boolean for this window, user can't change private status of a window
      SM.isPrivateWindow = SM.isWindowPrivate(window);
      SM.__defineGetter__("isPrivateSession", function() {
        return this.globalPrivateBrowsing || !TabmixSvc.saveSession;
      });
      // set this flag to true if user opens in a session at least one non-private window
      if (!TabmixSvc.saveSession && !SM.isPrivateWindow)
        TabmixSvc.saveSession = true;
    }
    else {
      let pbs = Cc["@mozilla.org/privatebrowsing;1"].
                getService(Ci.nsIPrivateBrowsingService);
      SM.globalPrivateBrowsing = pbs.privateBrowsingEnabled;
      SM.isWindowPrivate = function SM_isWindowPrivate(aWindow) SM.globalPrivateBrowsing;
      SM.__defineGetter__("isPrivateWindow", function() this.globalPrivateBrowsing);
      SM.__defineGetter__("isPrivateSession", function() this.globalPrivateBrowsing);
    }

    var windowOpeneByTabmix = "tabmixdata" in window;
    var firstWindow = Tabmix.isFirstWindow;
    var disAllow = Tabmix.globalPrivateBrowsing || TMP_SessionStore.isSessionStoreEnabled() ||
                   Tabmix.extensions.sessionManager ||
                   Tabmix.isWindowAfterSessionRestore;
    var sessionManager = Tabmix.prefs.getBoolPref("sessions.manager");
    var crashRecovery = Tabmix.prefs.getBoolPref("sessions.crashRecovery");
    var afterRestart = false;

    var restoreOrAsk = Tabmix.prefs.getIntPref("sessions.onStart") < 2 || afterRestart;
    var afterCrash = Tabmix.prefs.prefHasUserValue("sessions.crashed");

    // make tabmix compatible with ezsidebar extension
    var fnContainer, TMP_BrowserStartup;
    if ("__ezsidebar__BrowserStartup" in window) // need to test this on firefox 16+
      [fnContainer, TMP_BrowserStartup] = [window, "__ezsidebar__BrowserStartup"];
    else if (Tabmix.isVersion(160) && "gBrowserInit" in window)
      [fnContainer, TMP_BrowserStartup] = [gBrowserInit, "onLoad"];
    else
      [fnContainer, TMP_BrowserStartup] = [window, "BrowserStartup"];
    var bowserStartup = Tabmix.changeCode(fnContainer, TMP_BrowserStartup);

    // Bug 756313 - Don't load homepage URI before first paint
    // moved this code from gBrowserInit.onLoad to gBrowserInit._delayedStartup
    var swapOldCode = 'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);';
    var swapNewCode =
      ' if (!Tabmix.singleWindowMode) {' +
      '   window.tabmix_afterTabduplicated = true;' +
      '   TabmixSessionManager.init();' +
      '   let remoteBrowser = uriToLoad.ownerDocument.defaultView.gBrowser;' +
      '   let url = remoteBrowser.getBrowserForTab(uriToLoad).currentURI.spec;' +
      '   gBrowser.tabContainer.adjustTabstrip(true, url);' +
      '   $&' +
      ' }'
    if (!Tabmix.isVersion(190))
      bowserStartup = bowserStartup._replace(swapOldCode, swapNewCode);

    // don't load home page on first window if session manager or crash recovery is enabled
    if (!disAllow && ((sessionManager && windowOpeneByTabmix) ||
         (firstWindow && crashRecovery && afterCrash) ||
         (firstWindow && sessionManager && restoreOrAsk))) {
      // make sure sessionstore is init without restornig pinned tabs
      TabmixSvc.ss.init(null);
      SM._notifyWindowsRestored = true;

      // in firefox if we are here and gHomeButton.getHomePage() == window.arguments[0] then
      // maybe all tabs in the last session were pinned, we leet firefox to load the hompages
      bowserStartup = bowserStartup._replace(
        'uriToLoad = window.arguments[0];',
        'uriToLoad = gHomeButton.getHomePage() == window.arguments[0] ? "about:blank" : window.arguments[0];'
      );
      bowserStartup = bowserStartup._replace(
        'if (window.opener && !window.opener.closed) {',
        '  if (uriToLoad && uriToLoad != "about:blank") {' +
        '    for (var i = 0; i < gBrowser.tabs.length ; i++) {' +
        '      gBrowser.tabs[i].loadOnStartup = true;' +
        '    }' +
        '  }' +
        '  if (uriToLoad == "about:blank" || "tabmixdata" in window) {' +
        '    gBrowser.selectedBrowser.stop();' +
        '  }' +
        '$&'
      );
    }
    // All-in-One Sidebar 0.7.14 brake Firefox 12.0
    if (Tabmix.isVersion(120) && typeof aios_dominitSidebar == "function") {
      bowserStartup = bowserStartup._replace(
        'TabsOnTop.syncCommand();',
        'TabsOnTop.init();', {silent: true}
      );
    }
    bowserStartup.toCode();

    // call TMP_SessionStore.setService before delayedStartup, so this will run before sessionStore.init
    // At the moment we must init TabmixSessionManager before sessionStore.init
    var [obj, fn] = Tabmix.isVersion(160) && "gBrowserInit" in window ?
          [gBrowserInit, "gBrowserInit._delayedStartup"] :
          [window, "delayedStartup"];
    Tabmix.changeCode(obj, fn)._replace(
      '{',
      '{' +
      'try {' +
      '  if (Tabmix.isFirstWindow) TMP_SessionStore.setService(1, true);' +
      '  Tabmix.getNewTabButtonWidth();' +
      '  TabmixSessionManager.init();' +
      '} catch (ex) {Tabmix.assert(ex);}'
    )._replace(
      swapOldCode, swapNewCode, {check: Tabmix.isVersion(190)}
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
Tabmix.initialized = false;
Tabmix.beforeStartup = function TMP_beforeStartup(tabBrowser, aTabContainer) {
    Tabmix.initialized = true;
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
      let notificationbox = this.mPanelContainer.lastChild;
      let attrName = Tabmix.isVersion(180) ? "class" : "anonid"; // changed by Bug 768442
      let browser = document.getAnonymousElementByAttribute(notificationbox, attrName, "browserStack").firstChild;
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
    let tab = this.selectedItem;
    if (!aUrl) {
        let currentURI = tabbrowser.currentURI;
        aUrl = currentURI ? currentURI.spec : null;
    }
    if (this._keepLastTab ||
        Tabmix.isBlankPageURL(tab.__newLastTab || null) ||
       (!aUrl || Tabmix.isBlankPageURL(aUrl)) &&
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
