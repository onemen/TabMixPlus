"use strict";

Tabmix.backwardCompatibilityGetter(window, "tablib", "Tabmix.tablib");

// @ts-expect-error - some methods added internally
Tabmix.tablib = {
  version: "tabmixplus",
  _inited: false,
  init: function tabmix_tablib_init() {
    if (this._inited)
      return;
    this._inited = true;
    this.change_gBrowser();
    this.change_tabContainer();
    this.change_utility();
    this.addNewFunctionsTo_gBrowser();
  },

  _loadURIInitialized: false,
  setLoadURI: function tabmix_tablib_setLoadURI(aBrowser) {
    const tabs = this._loadURIInitialized ? [gBrowser.getTabForBrowser(aBrowser)] : gBrowser.tabs;
    this._loadURIInitialized = true;
    for (const tab of tabs) {
      const browser = tab.linkedBrowser;
      browser.tabmix_allowLoad = !TabmixTabbar.lockallTabs;
      if (tab.linkedPanel) {
        this.loadURIWrapper(browser, "loadURI");
        this.loadURIWrapper(browser, "fixupAndLoadURIString");
      }
    }
  },

  loadURIWrapper(browser, methodName) {
    const original = browser[methodName];
    if (browser[`__tabmix_${methodName}`]) {
      return;
    }
    /** @type {MockedGeckoTypes.ChromeBrowser["loadURI"]} */
    const loadURI_function = function(uri, params) {
      try {
        const tabmixResult = Tabmix.tablib._loadURI(browser, uri, params);
        if (tabmixResult) {
          return tabmixResult;
        }

        original(uri, params);
      } catch (ex) {
        console.error(ex);
      }
      return null;
    };

    browser[methodName] = loadURI_function.bind(null);
    browser[`__tabmix_${methodName}`] = true;
  },

  _loadURI(browser, uri, params = {}) {
    const urlSpec = typeof uri === "string" ? uri : uri.spec;
    if (Tabmix.tablib.allowLoad(browser, urlSpec)) {
      return null;
    }
    // redirect load request to a new tab
    let flags = params.flags || 0;
    /** @param {string} flag */
    let isFlagged = flag => Boolean(flags & Ci.nsIWebNavigation[flag]);
    params.inBackground = false;
    params.allowThirdPartyFixup = isFlagged("LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP");
    params.fromExternal = isFlagged("LOAD_FLAGS_FROM_EXTERNAL");
    return gBrowser.addTab(urlSpec, params);
  },

  allowLoad(browser, uri) {
    var tab = gBrowser.getTabForBrowser(browser);
    if (!tab) {
      browser.tabmix_allowLoad = true;
      return true;
    }
    var allowLoad =
      this.isException(browser.tabmix_allowLoad !== false || uri.startsWith("javascript:"));

    let allowedUrls = [
      "chrome://browser/content/aboutTabGroupsMigration.xhtml",
      "about:sessionRestore"
    ];
    if (!allowLoad && uri == "about:blank" &&
        allowedUrls.indexOf(browser.currentURI.spec) > -1) {
      allowLoad = true;
    } else if (!allowLoad) {
      // we allow Google Redirects Fixer & Tracking Remover to load fixed url
      // to the same tab
      if (TabmixSvc.isFixedGoogleUrl(uri)) {
        browser.tabmix_allowLoad = true;
        return false;
      }
      try {
        let newURI = Services.io.newURI(uri);
        allowLoad = browser.currentURI.equalsExceptRef(newURI);
      } catch {}
    }
    let isBlankTab = (function() {
      // first tab is busy when browser window starts on Firefox 51
      let checkIfBusy = gBrowserInit.delayedStartupFinished || tab._tPos > 0;
      if (checkIfBusy && tab.hasAttribute("busy") || tab.hasAttribute("pending")) {
        return false;
      }

      return gBrowser.isBlankBrowser(browser);
    }());
    var isLockedTab = tab.hasAttribute("locked");
    if (allowLoad || isBlankTab || !isLockedTab) {
      browser.tabmix_allowLoad = uri == TabmixSvc.aboutBlank || !isLockedTab;
      return true;
    }
    return false;
  },

  /**
   * check if we need to override our preference and force to load the url in
   * the current tab
   *
   * current code only check if the caller is in the exception list
   */
  isException(loadInCurrent) {
    if (loadInCurrent)
      return loadInCurrent;

    /** @type {Record<string, string>} */
    let exceptionList = {
      // secureLogin extension expect to execute the login in the current page
      // https://addons.mozilla.org/en-us/firefox/addon/secure-login/?src=ss
      secureLogin: "secureLogin.login",
      // https://addons.mozilla.org/en-US/firefox/addon/tab-groups-panorama/
      // paneSession.clearData load about.blank to all opened tabs in the active window
      tabGroups: "paneSession.clearData",
    };
    let keys = Object.keys(exceptionList);
    let isInstalled = keys.some(item => {
      return typeof window[item] == "object";
    });
    if (!isInstalled)
      return loadInCurrent;

    let stack = Error().stack || Components.stack.caller.formattedStack || "";
    var re = keys.map(key => exceptionList[key]);
    return new RegExp(re.join("|")).test(stack);
  },

  change_gBrowser: function change_gBrowser() {
    Tabmix.originalFunctions.gBrowser_addTab = gBrowser.addTab;
    gBrowser.addTab = function(uriString, options = {}, ...rest) {
      let callerTrace = Tabmix.callerTrace(),
          isRestoringTab = callerTrace.contain("ssi_restoreWindow");

      let {index, isPending} = options || {};

      if (typeof index !== "number" &&
          callerTrace.contain("ssi_restoreWindow", "duplicateTabIn ")) {
        options.index = this.tabs.length;
      }

      var t = Tabmix.originalFunctions.gBrowser_addTab.apply(this, [uriString, options, ...rest]);

      if (isPending || isRestoringTab &&
          Services.prefs.getBoolPref("browser.sessionstore.restore_on_demand")) {
        t.setAttribute("tabmix_pending", "true");
      }

      return t;
    };

    if (Tabmix.isVersion(1290)) {
      // this function is triggered by "context_openANewTab" command
      gBrowser.addAdjacentNewTab = function(tab) {
        TMP_BrowserOpenTab({}, tab);
      };
    }

    Tabmix.changeCode(gBrowser, "gBrowser._insertTabAtIndex")._replace(
      /(?<!else )if \(openerTab\) \{/,
      'if (openerTab && Tabmix.prefs.getBoolPref("openTabNextInverse")) {'
    ).toCode();

    Tabmix.originalFunctions.gBrowser_removeTab = gBrowser.removeTab;
    gBrowser.removeTab = function(aTab, aParams = {}, ...args) {
      let result;
      if (!aTab || aTab.hasAttribute("protected")) {
        return result;
      }
      let lastTabInGroup = this.visibleTabs.length == 1;
      if (lastTabInGroup) {
        if (Tabmix.prefs.getBoolPref("keepLastTab")) {
          return result;
        }
        // fix bug in TGM when closing last tab in a group with animation
        if (Tabmix.extensions.tabGroupManager) {
          aParams.animate = false;
        }
      }
      if (typeof aTab.clearTimeouts == "function") {
        aTab.clearTimeouts();
      }
      return Tabmix.originalFunctions.gBrowser_removeTab.apply(this, [aTab, aParams, ...args]);
    };

    if (!Tabmix.extensions.tabGroupManager) {
      Tabmix.changeCode(gBrowser, "gBrowser._beginRemoveTab")._replace(
        /this\.addTrustedTab\(BROWSER_NEW_TAB_URL, {\s*skipAnimation: true,?\s*}\)/,
        'TMP_BrowserOpenTab({}, null, true)'
      ).toCode();
    }

    Tabmix.changeCode(gBrowser, "gBrowser._endRemoveTab")._replace(
      'this._blurTab(aTab);',
      'Tabmix.tablib.onRemoveTab(aTab); \
       if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) { \
         TMP_eventListener.onTabClose_updateTabBar(aTab);\
       } \
       $&'
    )._replace(
      // we call gURLBar.select from Tabmix.clearUrlBarIfNeeded
      // see TMP_BrowserOpenTab
      'gURLBar.select();',
      '{/* see TMP_BrowserOpenTab */}'
    )._replace(
      'this.tabContainer._updateCloseButtons();',
      'if (!wasPinned) TabmixTabbar.setFirstTabInRow();\
       $&'
    ).toCode();

    Tabmix.originalFunctions.gBrowser_blurTab = gBrowser._blurTab;

    /** @this {MockedGeckoTypes.TabBrowser} */
    gBrowser._blurTab = function(aTab) {
      if (!aTab.selected)
        return;

      let newIndex = this.selectIndexAfterRemove(aTab);
      if (newIndex > -1) {
        let tabs = TMP_TabView.currentGroup();
        let tab = tabs[newIndex];
        if (tab && !tab.closing) {
          this.selectedTab = tab;
          return;
        }
      }
      Tabmix.originalFunctions.gBrowser_blurTab.apply(this, [aTab]);
    };

    const $LF = '\n    ';
    Tabmix.changeCode(gBrowser, "gBrowser.getWindowTitleForBrowser")._replace(
      'if (title) {',
      'let titlePromise;' + $LF +
        'if (tab.hasAttribute("tabmix_changed_label")) {' + $LF +
        '  titlePromise = Promise.resolve(tab.getAttribute("tabmix_changed_label"));' + $LF +
        '} else {' + $LF +
        '  titlePromise = window.TMP_Places.asyncGetTabTitle(tab, aBrowser.currentURI.spec, title);' + $LF +
        '}' + $LF +
        'return titlePromise.then(newTitle => {' + $LF +
        '  title = newTitle;' + $LF +
        '$&'
    )._replace(
      /(})(\)?)$/,
      '});\n' +
        '$1$2'
    ).toCode(false, gBrowser, "asyncGetWindowTitleForBrowser");

    /** @this {MockedGeckoTypes.TabBrowser} */
    gBrowser.updateTitlebar = function() {
      this.asyncGetWindowTitleForBrowser(this.selectedBrowser).then(title => {
        document.title = title;
      });
    };

    if ("foxiFrame" in window) {
      Tabmix.changeCode(gBrowser, "gBrowser.updateTitlebar")._replace(
        '{',
        '{try {'
      )._replace(
        /(})(\)?)$/,
        '} catch (ex) {} \
         $1$2'
      ).toCode();
    }

    var obj, fnName;
    if (Tabmix.extensions.ieTab2) {
      [obj, fnName] = [Tabmix.originalFunctions, "oldSetTabTitle"];
    } else {
      [obj, fnName] = [gBrowser, "setTabTitle"];
    }
    Tabmix.changeCode(obj, "gBrowser." + fnName)._replace(
      /let isContentTitle =[^;]*;/,
      '$&\n            ' +
      'let urlTitle;\n            ' +
      'if (Tabmix.tablib.getTabTitle(aTab, browser.currentURI.spec)) return false;',
      {flags: 'g'}
    )._replace(
      /title = Services.textToSubURI.unEscapeNonAsciiURI\([^;]*;/,
      '$&\
      urlTitle = title;'
    )._replace(
      'return this._setTabLabel',
      'if (aTab.hasAttribute("mergeselected"))\
         title = "(*) " + title;\
       const noChange = aTab.label == title;\
       if (aTab.hasAttribute("tabmix_changed_label")) {\
         aTab.removeAttribute("tabmix_changed_label");\
         if (noChange)\
           Tabmix.tablib.onTabTitleChanged(aTab, browser, title == urlTitle);\
       }\
       else if (noChange)\
         window.TMP_Places.currentTab = null;\
       $&'
    )._replace(
      '{ isContentTitle',
      '{ isContentTitle, urlTitle',
    ).toCode();

    Tabmix.originalFunctions.gBrowser_setInitialTabTitle = gBrowser.setInitialTabTitle;
    gBrowser.setInitialTabTitle = function(aTab, ...rest) {
      if (aTab._labelIsInitialTitle &&
            aTab.hasAttribute("tabmix_changed_label")) {
        return;
      }
      Tabmix.originalFunctions.gBrowser_setInitialTabTitle.apply(this, [aTab, ...rest]);
    };

    Tabmix.changeCode(gBrowser, "gBrowser._setTabLabel")._replace(
      '{ beforeTabOpen, isContentTitle',
      '{ beforeTabOpen, isContentTitle, urlTitle'
    )._replace(
      /aLabel = aLabel\.substring\(0, 500\).*;/,
      `$&
       urlTitle = aLabel;`
    )._replace(
      'return true;',
      ` Tabmix.tablib.onTabTitleChanged(aTab, aTab.linkedBrowser, aLabel == urlTitle);
         $&`
    ).toCode();

    if (gMultiProcessBrowser) {
      /*
       TabSwitchDone event fire late when the tab is busy, we call our
       functions from updateDisplay only after _visuallySelected was changed
      */
      Tabmix.updateSwitcher = function(switcher) {
        if (typeof Tabmix.originalFunctions.switcher_updateDisplay != 'function') {
          Tabmix.originalFunctions.switcher_updateDisplay = switcher.updateDisplay;
        }
        /** @this {TabmixNS.TabSwitcher} */
        switcher.updateDisplay = function(...args) {
          let visibleTab = this.visibleTab;
          Tabmix.originalFunctions.switcher_updateDisplay.apply(this, args);
          if (visibleTab !== this.visibleTab) {
            Tabmix.setTabStyle(visibleTab);
            TMP_eventListener.updateDisplay(this.visibleTab);
          }
        };
      };

      Tabmix.changeCode(gBrowser, "gBrowser._getSwitcher")._replace(
        'return this._switcher;',
        'Tabmix.updateSwitcher(this._switcher);\n    ' +
          '$&'
      ).toCode();
    }
  },

  change_tabContainer: function change_tabContainer() {
    let tabBar = gBrowser.tabContainer;
    if (!Tabmix.extensions.verticalTabs) {
      // foolows the example from gBrowser.tabContainer.init
      let handleResize = () => {
        TabmixTabbar._handleResize();
      };
      window.addEventListener("resize", handleResize);
      const observer = new MutationObserver(handleResize);
      observer.observe(document.documentElement, {attributeFilter: ["inFullscreen", "inDOMFullscreen"],});

      let $LF = '\n      ';
      const doPosition = Tabmix.isVersion(1300) ? "absPositionHorizontalTabs" : "doPosition";
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._positionPinnedTabs")._replace(
        'let layoutData = this._pinnedTabsLayoutCache;',
        'if (typeof this.arrowScrollbox.resetFirstTabInRow == "function")\
           this.arrowScrollbox.resetFirstTabInRow();\
         $&'
      )._replace(
        'scrollStartOffset:',
        '$& TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT ? 0 :'
      )._replace(
        `if (${doPosition})`,
        `if (${doPosition} && TabmixTabbar.isMultiRow &&
          Tabmix.prefs.getBoolPref("pinnedTabScroll")) {
        ${doPosition} = false;
        this.toggleAttribute("positionpinnedtabs", false);
      }
      if (${doPosition} && TabmixTabbar.isMultiRow) {` + $LF +
        (Tabmix.isVersion(1190) ? '  this.toggleAttribute("positionpinnedtabs", true)' :
          '  this.setAttribute("positionpinnedtabs", "true");') + $LF +
        '  let layoutData = this._pinnedTabsLayoutCache;' + $LF +
        '  if (!layoutData) {' + $LF +
        '    layoutData = {pinnedTabWidth: tabs[0].getBoundingClientRect().width};' + $LF +
        '    this._pinnedTabsLayoutCache = layoutData;' + $LF +
        '  }' + $LF +
        '    let width = this.arrowScrollbox.scrollboxPaddingStart || 0;' + $LF +
        '    for (let i = 0; i < numPinned; i++) {' +
        '      let tab = tabs[i];' +
        '      tab.style.setProperty("margin-inline-start", width + "px", "important");' + $LF +
        '      width += layoutData.pinnedTabWidth;' +
        '      tab._pinnedUnscrollable = true;' +
        '    }' +
        '    if (width != this.arrowScrollbox.firstTabInRowMargin) {' +
        '      this.arrowScrollbox.firstTabInRowMargin = width;' +
        '      this.arrowScrollbox.firstVisible =  {tab: null, x: 0, y: 0};' +
        '      let margin = Tabmix.tabsUtils.protonValues.enabled ? 12 : 0;\n' +
        '      gTMPprefObserver.dynamicRules["tabmix-firstTabInRow"]' +
        '        .style.setProperty("margin-inline-start", width + margin + "px", "important");' + $LF +
        '    }' +
        '    this.style.removeProperty("--tab-overflow-pinned-tabs-width");' + $LF +
        '    TMP_tabDNDObserver.paddingLeft = Tabmix.getStyle(this, "paddingLeft");' +
        '    this.arrowScrollbox.setFirstTabInRow();' +
        '  }' +
        '  else $&'
      )._replace(
        'let width = 0;',
        /* firefox add a gap between the last pinned tab and the first visible tab */
        'let width = TabmixTabbar.scrollButtonsMode !== TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT &&\n' +
        '  Tabmix.tabsUtils.protonValues.enabled ? 12 : 0;',
      )._replace(
        /(})(\)?)$/,
        'if (TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_MULTIROW) {' +
        '  TMP_tabDNDObserver.paddingLeft = parseInt(this.style.getPropertyValue("--tab-overflow-pinned-tabs-width") || 0);' +
        '}' +
        '$1$2'
      ).toCode();
    }

    Tabmix.changeCode(tabBar, "gBrowser.tabContainer._handleNewTab")._replace(
      /(})(\)?)$/,
      'TMP_eventListener.onTabOpen_delayUpdateTabBar(tab); \
       $1$2'
    ).toCode();

    Tabmix.changeCode(TabBarVisibility, "TabBarVisibility.update")._replace(
      'if (collapse ==',
      `if (TabmixTabbar.hideMode === 2) {
        collapse = true;
      } else if (!gBrowser || gBrowser.visibleTabs.length == 1) {
        collapse = !window.toolbar.visible || TabmixTabbar.hideMode === 1;
      }
      $&`,
      {check: !Tabmix.isVersion(1330)}
    )._replace(
      'if (nonPopupWithVerticalTabs) {',
      `if (
        nonPopupWithVerticalTabs ||
        TabmixTabbar.hideMode === 2 ||
        (!isPopup &&
          TabmixTabbar.hideMode === 1 &&
          gBrowser.visibleTabs.length === 1)
      ) {`,
      {check: Tabmix.isVersion(1330)}
    )._replace(
      /(})(\)?)$/,
      `const bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
      if (bottomToolbox) {
        bottomToolbox.collapsed = ${Tabmix.isVersion(1330) ? "hideTabstrip" : "collapse"};
      }
      $1$2`
    ).toCode();

    if (!Tabmix.extensions.verticalTabs) {
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._lockTabSizing")._replace(
        '{',
        '{if (this.getAttribute("orient") != "horizontal" || !Tabmix.prefs.getBoolPref("lockTabSizingOnClose")) return;'
      )._replace(
        /(var|let) isEndTab =|faviconize.o_lockTabSizing/,
        '  if (TabmixTabbar.widthFitTitle) {' +
        '    let tab = tabs.find(t => t._tPos === aTab._tPos + 1);' +
        '    if (tab && !tab.pinned && !tab.collapsed) {' +
        '      let tabWidth = aTab.getBoundingClientRect().width + "px";' +
        '      tab.style.setProperty("width", tabWidth, "important");' +
        '      tab.removeAttribute("width");' +
        '      this._hasTabTempWidth = true;' +
        '      gBrowser.addEventListener("mousemove", this, false);' +
        '      window.addEventListener("mouseout", this, false);' +
        '    }' +
        '    return;' +
        '  }' +
        '  if (!Tabmix.tabsUtils.isSingleRow(tabs))' +
        '    return;' +
        '  this._tabDefaultMaxWidth = this.mTabMaxWidth;' +
        '  $&'
      ).toCode();

      // _expandSpacerBy not exist in Firefox 21
      if (typeof tabBar._expandSpacerBy == "function") {
        Tabmix.changeCode(tabBar, "gBrowser.tabContainer._expandSpacerBy")._replace(
          '{',
          '{if (TabmixTabbar.widthFitTitle || !Tabmix.tabsUtils.isSingleRow()) return;'
        ).toCode();
      }

      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._unlockTabSizing")._replace(
        '{', '{\n' +
        '          var updateScrollStatus = this.hasAttribute("using-closing-tabs-spacer") ||\n' +
        '                                   this._hasTabTempMaxWidth || this._hasTabTempWidth;'
      )._replace(
        /(})(\)?)$/,
        '  if (this._hasTabTempWidth) {' +
        '    this._hasTabTempWidth = false;' +
        '    let tabs = Tabmix.visibleTabs.tabs;' +
        '    for (let i = 0; i < tabs.length; i++)' +
        '      tabs[i].style.width = "";' +
        '  }' +
        '  if (updateScrollStatus && this.allTabs.length > 1) {' +
        '    TabmixTabbar.updateScrollStatus();' +
        '  }' +
        '  $1$2'
      ).toCode();
    }

    // TODO: test if this still a problem
    // when selecting different tab fast with the mouse sometimes original onxblmousedown can call this function
    // before our mousedown handler can prevent it
    // Tabmix.changeCode(tabBar, "gBrowser.tabContainer._selectNewTab")._replace(
    //   '{',
    //   '{if(!Tabmix.prefs.getBoolPref("selectTabOnMouseDown") && Tabmix.callerTrace("onxblmousedown")) return;'
    // ).toCode();

    if (!Tabmix.isVersion(1160)) {
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._setPositionalAttributes")._replace(
        /(})(\)?)$/,
        '          Tabmix.setTabStyle(this.selectedItem);\n' +
        '$1$2'
      ).toCode();
    }
  },

  change_utility: function change_utility() {
    // FullScreen code related to tabs bellow content initialize by first
    // fullScreen event, see TMP_eventListener.onFullScreen
    Tabmix.originalFunctions.FullScreen_showNavToolbox = FullScreen.showNavToolbox;
    FullScreen.showNavToolbox = function(...args) {
      let result = Tabmix.originalFunctions.FullScreen_showNavToolbox.apply(this, args);
      TMP_eventListener.showNavToolbox();
      return result;
    };

    Tabmix.changeCode(window, "handleDroppedLink")._replace(
      'let lastLocationChange = gBrowser.selectedBrowser.lastLocationChange;',
      'let tabmixContentDrop = event ? event.tabmixContentDrop : links[0].tabmixContentDrop;\n  ' +
      '$&'
    )._replace(
      'replace: true',
      'replace: (tabmixContentDrop || Tabmix.tablib.whereToOpenDrop(event, urls[0])) != "tab"'
    ).toCode();
    // update current browser
    gBrowser.selectedBrowser.droppedLinkHandler = handleDroppedLink;

    Tabmix.originalFunctions.duplicateTabIn = window.duplicateTabIn;
    // TreeStyleTab eval of this function use delta

    window.duplicateTabIn = function(aTab, where, delta) {
      if (where == "window" && TabmixSvc.getSingleWindowMode()) {
        where = "tab";
      }
      // we prevent SessionStore.duplicateTab from moving the tab
      // see gBrowser.addTab
      // always set where to 'tabshifted' to prevent original function from
      // selecting the new tab
      if (where == "tab") {
        arguments[1] = "tabshifted";
      }

      if (where == "window") {
        return Tabmix.originalFunctions.duplicateTabIn.apply(this, [aTab, where, delta]);
      }

      let names = Tabmix.isVersion(1260) ?
        ["gotoHistoryIndex", "forward", "back"] :
        ["gotoHistoryIndex", "forward", "back"];
      let pref = Tabmix.callerTrace(...names) ?
        "browser.tabs.insertAfterCurrent" :
        "extensions.tabmix.openDuplicateNext";
      let openTabNext = Services.prefs.getBoolPref(pref);
      TMP_extensionsCompatibility.treeStyleTab.openNewTabNext(aTab, openTabNext, true);

      let result = Tabmix.originalFunctions.duplicateTabIn.apply(this, [aTab, where, delta]);

      let newTab = gBrowser.getTabForLastPanel();
      if (openTabNext) {
        let pos = newTab._tPos > aTab._tPos ? 1 : 0;
        gBrowser.moveTabTo(newTab, aTab._tPos + pos);
      }
      let bgLoad = Tabmix.prefs.getBoolPref("loadDuplicateInBackground");
      let selectNewTab = where == "tab" ? !bgLoad : bgLoad;
      if (selectNewTab) {
        gBrowser.selectedTab = newTab;
      }

      return result;
    };

    let fnObj = Tabmix.isVersion(1260) ? window.BrowserCommands : window;
    let fnName = Tabmix.isVersion(1260) ? "closeTabOrWindow" : "BrowserCloseTabOrWindow";
    Tabmix.changeCode(fnObj, fnName)._replace(
      'closeWindow(true);', // Mac
      'Tabmix.tablib.closeLastTab();', {check: TabmixSvc.isMac, flags: "g"}
    )._replace(
      /gBrowser.removeCurrentTab\([^;]+;/,
      'Tabmix.tablib.closeLastTab();'
    ).toCode();

    /**
     * don't open link from external application in new window when in single window mode
     * don't open link from external application in current tab if the tab is locked
     *
     * we don't check isUrlForDownload for external links,
     * it is not likely that link in other application opened Firefox for downloading data
     */
    const browserAccess = nsBrowserAccess.prototype;
    // TreeStyleTab 0.16.2015111001 wrap openURI in nsBrowserAccess.prototype.__treestyletab__openURI
    let TSTopenURI = Tabmix.extensions.treeStyleTab &&
        typeof browserAccess.__treestyletab__openURI == "function" ? "__treestyletab__openURI" : "";

    Tabmix.changeCode(browserAccess, "nsBrowserAccess.prototype._openURIInNewTab")._replace(
      `if (aIsExternal && (!aURI || aURI.spec == "${TabmixSvc.aboutBlank}")) {`,
      'let currentIsBlank = win.gBrowser.isBlankNotBusyTab(win.gBrowser._selectedTab); \
       $&'
    )._replace(
      Tabmix.isVersion(1260) ? 'win.BrowserCommands.openTab()' : 'win.BrowserOpenTab()',
      'if (currentIsBlank) Tabmix.tablib.setURLBarFocus(); \
      else $&'
    )._replace(
      '"browser.tabs.loadDivertedInBackground"',
      'aIsExternal ? "extensions.tabmix.loadExternalInBackground" : $&'
    )._replace(
      'win.gBrowser.addTab',
      'currentIsBlank ? win.gBrowser._selectedTab : $&'
    )._replace(
      'win.gBrowser.getBrowserForTab(tab);',
      '$&\n' +
      '    if (currentIsBlank && aURI) {\n' +
      '      let loadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;\n' +
      '      if (aIsExternal) {\n' +
      '        loadFlags |= Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL;\n' +
      '      }\n' +
      '      gBrowser.fixupAndLoadURIString(aURI.spec, {\n' +
      '        triggeringPrincipal: aTriggeringPrincipal,\n' +
      '        referrerInfo: aReferrerInfo,\n' +
      '        userContextId: aUserContextId,\n' +
      '        csp: aCsp,\n' +
      '        loadFlags,\n' +
      '      });\n' +
      '      browser.focus();\n' +
      '    }'
    ).toCode();

    fnName = "nsBrowserAccess.prototype." + (TSTopenURI || "getContentWindowOrOpenURI");
    Tabmix.changeCode(browserAccess, fnName)._replace(
      'switch (aWhere) {',
      '  if (Tabmix.singleWindowMode &&' +
      '      aWhere == Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW) {' +
      '      aWhere = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;' +
      '  }' +
      '  if (aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW &&' +
      '      aWhere != Ci.nsIBrowserDOMWindow.OPEN_PRINT_BROWSER &&' +
      '      aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWTAB) {' +
      '      let isLockTab = Tabmix.whereToOpen(null).lock;' +
      '      if (isLockTab) {' +
      '          aWhere = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;' +
      '      }' +
      '  }' +
      '  $&'
    )._replace(
      '"browser.tabs.loadDivertedInBackground"',
      'isExternal ? "extensions.tabmix.loadExternalInBackground" : $&', {flags: "g"}
    ).toCode();

    Tabmix.originalFunctions.FillHistoryMenu = window.FillHistoryMenu;
    if (Tabmix.isVersion(1290)) {
      document.getElementById("back-button").childNodes[0]?.removeEventListener("popupshowing", FillHistoryMenu);
      document.getElementById("forward-button").childNodes[0]?.removeEventListener("popupshowing", FillHistoryMenu);
    }
    /** @type {FillHistoryMenu} */
    let fillHistoryMenu = function FillHistoryMenu(parentOrEvent) {
      /** @type {EventTarget} */ // @ts-expect-error - make type of parent same as EventTarget
      let parent = Tabmix.isVersion(1290) ? parentOrEvent.target : parentOrEvent;
      let rv = Tabmix.originalFunctions.FillHistoryMenu.apply(window, [parentOrEvent]);
      const userLabel = gBrowser.selectedTab.getAttribute("fixed-label");
      const userLabelUri = gBrowser.selectedTab.getAttribute("label-uri");
      let l = parent.childNodes.length;
      for (let i = 0; i < l; i++) {
        let item = parent.childNodes[i];
        let uri = item?.getAttribute("uri");
        let label = item?.getAttribute("label");
        if (userLabelUri === uri && userLabel) {
          // user rename tab for specific url
          Tabmix.setItem(item, "label", userLabel);
        } else if (uri) {
          TMP_Places.getTitleFromBookmark(uri, label ?? "").then(title => {
            Tabmix.setItem(item, "label", title);
          });
        }
      }
      return rv;
    };
    Tabmix.setNewFunction(window, "FillHistoryMenu", fillHistoryMenu);
    if (Tabmix.isVersion(1290)) {
      document.getElementById("back-button").childNodes[0]?.addEventListener("popupshowing", FillHistoryMenu);
      document.getElementById("forward-button").childNodes[0]?.addEventListener("popupshowing", FillHistoryMenu);
    }

    Tabmix.changeCode(newWindowButtonObserver, "newWindowButtonObserver.onDragOver")._replace(
      '{',
      '{ \
       if (Tabmix.singleWindowMode) { \
         if (!aEvent.target.hasAttribute("disabled")) \
           aEvent.target.setAttribute("disabled", true);\
         return; \
       }'
    ).toCode();

    Tabmix.originalFunctions.newWindowButtonObserver_onDrop = newWindowButtonObserver.onDrop;
    newWindowButtonObserver.onDrop = function onDrop(...args) {
      if (!Tabmix.singleWindowMode) {
        Tabmix.originalFunctions.newWindowButtonObserver_onDrop.apply(this, args);
      }
    };

    /**
     * only apply for sessionManager
    Tabmix.changeCode(window, "warnAboutClosingWindow")._replace(
      /gBrowser\.warnAboutClosingTabs\(\n?\s*closingTabs,\n?\s* gBrowser\.closingTabsEnum\.ALL,?\n?\s*(source)?\n?\s*\)/g,
      'Tabmix.tablib.closeWindow(true)'
    )._replace(
      /os\.notifyObservers\(null, "browser-lastwindow-close-granted"(?:, null)?\);/,
      'if (!TabmixSvc.isMac && !Tabmix.tablib.closeWindow(true)) return false;\
       $&'
    ).toCode();

    Tabmix.changeCode(window, "WindowIsClosing")._replace(
      '{',
      '{Tabmix._warnedBeforeClosing = false;'
    )._replace(
      /if \(!closeWindow\(false, warnAboutClosingWindow(, source)?\)\)/,
      `let reallyClose = closeWindow(false, warnAboutClosingWindow$1);
  if (reallyClose && !Tabmix._warnedBeforeClosing)
    reallyClose = Tabmix.tablib.closeWindow();
  if (!reallyClose)`
    ).toCode();
    */

    Tabmix.changeCode(window, "goQuitApplication")._replace(
      'Services.startup.quit',
      'let closedByToolkit = Tabmix.callerTrace("toolkitCloseallOnUnload");' +
      'if (!TabmixSessionManager.canQuitApplication(closedByToolkit))' +
      '  return false;' +
      '$&'
    ).toCode();

    // if user changed mode to single window mode while having closed window
    // make sure that undoCloseWindow will open the closed window in the most recent non-private window
    Tabmix.changeCode(window, "undoCloseWindow")._replace(
      'window = SessionStore.undoCloseWindow(aIndex || 0);',
      `{if (Tabmix.singleWindowMode) {
          window = BrowserWindowTracker.getTopWindow({private: false});
       }
       if (window) {
        window.focus();
        let index = aIndex || 0;
        let closedWindows = SessionStore.getClosedWindowData();
        SessionStore.forgetClosedWindow(index);
        let state = closedWindows.splice(index, 1).shift();
        state = JSON.stringify({windows: [state]});
        SessionStore.setWindowState(window, state, false);
       }
       else $&}`
    ).toCode();

    Tabmix.changeCode(HistoryMenu.prototype, "HistoryMenu.prototype.populateUndoSubmenu")._replace(
      '"menuitem"',
      'undoPopup.__tagName || "menuitem"'
    )._replace(
      // workaround for bug 1868452 - Key key_undoCloseTab of menuitem could not be found
      'undoPopup.appendChild(tabsFragment);',
      `TMP_ClosedTabs.fix_bug_1868452(tabsFragment.firstChild);
      $&`,
      {check: Tabmix.isVersion(1160)}
    )._replace(
      /(})(\)?)$/,
      `TMP_ClosedTabs.populateUndoSubmenu(undoPopup);
      $1$2`
    ).toCode();

    document
        .getElementById("history-menu")
        .addEventListener("popupshowing",
          /** @param {TabmixPlacesNS.HistoryMenuEvent} event */
          event => TMP_Places.historyMenuItemsTitle(event));

    Tabmix.changeCode(HistoryMenu.prototype, "HistoryMenu.prototype.populateUndoWindowSubmenu")._replace(
      '"menuitem"',
      'undoPopup.__tagName || "menuitem"'
    )._replace(
      /(})(\)?)$/,
      '  Tabmix.tablib.populateUndoWindowSubmenu(undoPopup);\n' +
      '$1$2'
    ).toCode();

    var undoWindowPopup = document.getElementById("historyUndoWindowPopup");
    if (undoWindowPopup) {
      undoWindowPopup.setAttribute("context", "tm_undocloseWindowContextMenu");
    }

    Tabmix.originalFunctions.gURLBar_setURI = gURLBar.setURI;
    gURLBar.setURI = function tabmix_gURLBarsetURI(...args) {
      if (Tabmix.selectedTab == gBrowser.selectedTab &&
          Tabmix.userTypedValue && gBrowser.userTypedValue !== "") {
        gBrowser.userTypedValue = "";
      }
      Tabmix.originalFunctions.gURLBar_setURI.apply(this, args);
    };

    Tabmix.originalFunctions.isBlankPageURL = isBlankPageURL;
    window.isBlankPageURL = function isBlankPageURL(url) {
      return (
        url === "about:newtab" || Tabmix.originalFunctions.isBlankPageURL.apply(null, [url])
      );
    };
  },

  populateUndoWindowSubmenu(undoPopup, panel, isAppMenu = Boolean(panel)) {
    const isSubviewbutton = undoPopup.__tagName === "toolbarbutton";
    undoPopup.setAttribute("context", "tm_undocloseWindowContextMenu");
    let undoItems = TabmixSvc.ss.getClosedWindowData();
    const childNodes = panel?.childNodes ?? undoPopup.childNodes;
    for (let i = 0; i < childNodes.length - (isAppMenu ? 0 : 1); i++) {
      /** @type {TabmixClosedTabsNS.Menuitem} */ // @ts-expect-error
      let m = childNodes[i];
      let undoItem = undoItems[i];
      if (undoItem && m.hasAttribute("targetURI")) {
        TMP_SessionStore.asyncGetTabTitleForClosedWindow(undoItem).then(title => {
          let otherTabsCount = undoItem.tabs.length - 1;
          let menuLabel = this.recentlyClosed.formatValueSync(
            "recently-closed-undo-close-window-label",
            {tabCount: otherTabsCount, winTitle: title}
          );
          m.setAttribute("label", menuLabel ?? "");
        });
      }
      m.setAttribute("value", i);
      m.fileName = "closedwindow";
      /** @typedef {GenericEvent<ClosedObjectsUtils.Menuitem, MouseEvent>} EventType */
      m.addEventListener("click", (/** @type {EventType} */ e) => Tabmix.closedObjectsUtils.checkForMiddleClick(e));
      if (isSubviewbutton) {
        m.value = i;
        m.setAttribute("class", "bookmark-item subviewbutton subviewbutton-iconic");
      }
    }

    if (panel?.__updatingViewAfterDelete) {
      // we are repopulateing the the list after user removed an item
      // the menuitem already exist
      return;
    }

    let restoreAllWindows = undoPopup.lastChild;
    restoreAllWindows.setAttribute("value", "-2");
    let clearList = document.createXULElement(undoPopup.__tagName || "menuitem");
    clearList.id = "menu_clearClosedWindowsList";
    clearList.setAttribute("label", TabmixSvc.getString("undoClosedWindows.clear.label"));
    clearList.setAttribute("value", "-1");
    if (isSubviewbutton) {
      restoreAllWindows.classList.add("subviewbutton");
      clearList.classList.add("subviewbutton");
    }
    clearList.addEventListener("command", () => {
      Tabmix.closedObjectsUtils.forgetClosedWindow(-1);
    });
    undoPopup.insertBefore(clearList, restoreAllWindows);
  },

  addNewFunctionsTo_gBrowser: function addNewFunctionsTo_gBrowser() {
    /** @type {TabmixNS._duplicateTab} */
    let duplicateTab = function(aTab, aHref = "", aTabData, disallowSelect, dontFocusUrlBar) {
      if (aTab.localName != "tab")
        aTab = this._selectedTab;

      var newTab = null;
      let copyToNewWindow = window != aTab.ownerGlobal;
      let openDuplicateNext = !disallowSelect && !copyToNewWindow && Tabmix.prefs.getBoolPref("openDuplicateNext");
      TMP_extensionsCompatibility.treeStyleTab.openNewTabNext(aTab, openDuplicateNext);

      // try to have SessionStore duplicate the given tab
      if (!aHref && !aTabData) {
        newTab = this.duplicateTab(aTab, true, {inBackground: true, index: this.tabs.length});
      } else {
        let state;
        if (typeof aTabData === "string") {
          state = JSON.parse(aTabData);
        } else if (typeof aTabData === "object") {
          state = aTabData;
        }
        /** @type {{state: TabmixNS.TabData} | undefined} */
        const tabState = state ? {state} : undefined;
        newTab = this.SSS_duplicateTab(aTab, aHref, tabState);
      }

      if (!newTab && aTabData)
        throw new Error("Tabmix was unable to restore closed tab to new window");

      // sessionstore duplicateTab failed
      if (!newTab)
        return null;

      this.selectedBrowser.focus();

      // move new tab to place before we select it
      if (openDuplicateNext) {
        let pos = newTab._tPos > aTab._tPos ? 1 : 0;
        this.moveTabTo(newTab, aTab._tPos + pos);
      }

      var bgPref = Tabmix.prefs.getBoolPref("loadDuplicateInBackground");
      if (!disallowSelect && !bgPref) {
        newTab.owner = copyToNewWindow ? null : aTab;
        let url = !dontFocusUrlBar ? aHref || this.getBrowserForTab(aTab).currentURI.spec : "";
        this.TMP_selectNewForegroundTab(newTab, bgPref, url, false);
      }

      return newTab;
    };
    Tabmix.duplicateTab = duplicateTab.bind(gBrowser);

    gBrowser.SSS_duplicateTab = function tabbrowser_SSS_duplicateTab(aTab, aHref, aTabData) {
      var newTab = null;
      // add new history entry after current index
      /** @param {{ index: number; entries: Partial<AddTabParams>[]; }} tabState */
      function addNewHistoryEntry(tabState) {
        try {
          var activeIndex = (tabState.index || tabState.entries.length) - 1;
          var entriesToRemove = 0;
          /** @type {Partial<AddTabParams>} */
          var newEntry = {url: aHref}; // we don't know the page title at this moment
          let triggeringPrincipal = E10SUtils.SERIALIZED_SYSTEMPRINCIPAL;
          if (triggeringPrincipal) {
            newEntry.triggeringPrincipal_base64 = triggeringPrincipal;
          }
          tabState.entries.splice(activeIndex + 1, entriesToRemove, newEntry);
          tabState.index++;
        } catch (ex) {
          Tabmix.assert(ex);
        }
      }
      // we need to update history title after the new page loaded for use in back/forward button
      /** @this {Tab} */
      function updateNewHistoryTitle() {
        try {
          this.removeEventListener("SSTabRestored", updateNewHistoryTitle, true);
          let browser = this.linkedBrowser;
          if (Services.appinfo.sessionHistoryInParent) {
            const history = browser.browsingContext.sessionHistory;
            if (history) {
              const shEntry = history.getEntryAtIndex(history.index).QueryInterface?.(Ci.nsISHEntry);
              if (shEntry) {
                shEntry.title = this.label;
              }
            }
          } else {
            browser.messageManager.sendAsyncMessage("Tabmix:updateHistoryTitle", {title: this.label});
          }
        } catch (ex) {
          Tabmix.assert(ex);
        }
      }
      /** @this {Tab} */
      function urlForDownload() {
        try {
          this.removeEventListener("SSTabRestored", urlForDownload, true);
          let browser = this.linkedBrowser;
          browser.tabmix_allowLoad = true;
          browser.loadURI(aHref);
        } catch (ex) {
          Tabmix.assert(ex);
        }
      }
      try {
        const tabState = aTabData ? aTabData.state : JSON.parse(TabmixSvc.ss.getTabState(aTab));
        newTab = this.addTrustedTab("about:blank", {index: gBrowser.tabs.length});
        newTab.linkedBrowser.stop();
        if (aHref) {
          if (Tabmix.ContentClick.isUrlForDownload(aHref)) {
            newTab.addEventListener("SSTabRestored", urlForDownload, true);
          } else {
            delete tabState.scroll;
            addNewHistoryEntry(tabState);
            newTab.addEventListener("SSTabRestored", updateNewHistoryTitle, true);
          }
        }
        tabState.pinned = false;
        TabmixSvc.ss.setTabState(newTab, JSON.stringify(tabState));
      } catch (ex) {
        Tabmix.assert(ex);
      }

      return newTab;
    };

    gBrowser.duplicateTabToWindow = function(aTab, aMoveTab, aTabData) {
      if (aTab.localName != "tab")
        aTab = this._selectedTab;

      if (Tabmix.singleWindowMode) {
        if (!aMoveTab)
          Tabmix.duplicateTab(aTab, "", aTabData);
      } else if (aMoveTab) {
        this.replaceTabWithWindow(aTab);
      } else {
        let otherWin = OpenBrowserWindow();
        /** @type {MockedGeckoTypes.TabBrowser["_delayedStartupFinished"]} */
        let delayedStartupFinished = (subject, topic) => {
          if (topic == "browser-delayed-startup-finished" &&
              subject == otherWin) {
            Services.obs.removeObserver(delayedStartupFinished, topic);
            let otherGBrowser = otherWin.gBrowser;
            let otherTab = otherGBrowser.selectedTab;
            if (aTabData) {
              // restore closed tab to new window
              TabmixSvc.ss.setTabState(otherTab, aTabData);
            } else {
              TabmixSvc.ss.duplicateTab(otherWin, aTab);
              otherGBrowser.removeTab(otherTab, {animate: false});
            }
          }
        };

        Services.obs.addObserver(delayedStartupFinished,
          "browser-delayed-startup-finished");
      }
    };

    /** @param {Tab} contextTab */
    gBrowser.duplicateTabsToWindow = function(contextTab) {
      /** @type {NonEmptyArray<Tab>} */
      const tabs = contextTab.multiselected ? this.selectedTabs : [contextTab];
      this.clearMultiSelectedTabs();

      if (tabs.length === 1) {
        this.duplicateTabToWindow(tabs[0]);
        return;
      }

      let selectedTabIndex = Math.max(0, tabs.indexOf(this.selectedTab));
      let otherWin = OpenBrowserWindow({private: PrivateBrowsingUtils.isBrowserPrivate(contextTab.linkedBrowser)});
      /** @type {MockedGeckoTypes.TabBrowser["_delayedStartupFinished"]} */
      let delayedStartupFinished = (subject, topic) => {
        if (topic == "browser-delayed-startup-finished" && subject == otherWin) {
          Services.obs.removeObserver(delayedStartupFinished, "browser-delayed-startup-finished");
          let otherGBrowser = otherWin.gBrowser;
          let otherTab = otherGBrowser.selectedTab;

          tabs.forEach((tab, index) => {
            const pending = tab.hasAttribute("pending") || tab.hasAttribute("tabmix_pending");
            const newTab = otherGBrowser.duplicateTab(
              tab,
              !pending,
              {inBackground: index !== selectedTabIndex, index}
            );
            if (pending) {
              newTab.removeAttribute("busy");
            }
            newTab.__duplicateFromWindow = true;
            setTimeout(() => {
              delete newTab.__duplicateFromWindow;
              Tabmix.copyTabData(newTab, tab);
            }, 0);
          });
          otherGBrowser.removeTab(otherTab, {animate: false});
        }
      };

      Services.obs.addObserver(
        delayedStartupFinished,
        "browser-delayed-startup-finished"
      );
    };

    gBrowser.openLinkWithHistory = function() {
      var url = Tabmix.tablib.getValidUrl();
      if (!url) {
        return;
      }

      urlSecurityCheck(url, gContextMenu.principal);
      Tabmix.duplicateTab(gBrowser.selectedTab, url);
    };

    Tabmix.tablib.openLinkInCurrent = function() {
      var url = Tabmix.tablib.getValidUrl();
      if (!url) {
        return;
      }

      gContextMenu.linkURL = url;
      gBrowser.selectedBrowser.tabmix_allowLoad = true;
      gContextMenu.openLinkInCurrent();
    };

    Tabmix.tablib.getValidUrl = function() {
      if (!gContextMenu) {
        return null;
      }
      let {target, linkURL} = gContextMenu;
      // valid urls don't contain spaces ' '; if we have a space it isn't a valid url.
      // Also disallow dropping javascript: or data: urls--bail out
      /** @param {string} aUrl */
      let isValid = function(aUrl) {
        return aUrl && aUrl.length && !aUrl.includes(" ") &&
            !(/^\s*(javascript|data):/).test(aUrl);
      };

      let browser = gBrowser.selectedBrowser;
      if (browser.getAttribute("remote") == "true" &&
          typeof gContextMenu.tabmixLinkURL != "undefined")
        return gContextMenu.tabmixLinkURL;

      if (!isValid(linkURL)) {
        let json = {
          button: 0,
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          target: {},
          tabmix_openLinkWithHistory: true
        };
        // we only get here when it is safe to use contentWindowAsCPOW
        // see TabmixContext.updateMainContextMenu
        let result = Tabmix.ContentClick.getParamsForLink(json,
          target, linkURL, browser, gBrowser.selectedBrowser._contentWindow);
        return result._href && isValid(result._href) ? result._href : null;
      }
      return linkURL;
    };

    gBrowser.closingTabsEnum.ALL_BY_TABMIX = 100;
    gBrowser.closingTabsEnum.GROUP_BY_TABMIX = 101;
    gBrowser.closeAllTabs = function TMP_closeAllTabs() {
      const tabsToRemove = this.visibleTabs.filter(tab => !tab._isProtected);
      if (
        !this.warnAboutClosingTabs(tabsToRemove.length, this.closingTabsEnum.ALL_BY_TABMIX)
      ) {
        return;
      }

      if (TabmixTabbar.visibleRows > 1) {
        Tabmix.tabsUtils.updateVerticalTabStrip({reset: true});
      }
      this.removeTabs(tabsToRemove, {suppressWarnAboutClosingWindow: true});
    };

    gBrowser.closeGroupTabs = function TMP_closeGroupTabs(aTab) {
      if (aTab.localName != "tab")
        aTab = this._selectedTab;

      var URL = this.getBrowserForTab(aTab).currentURI.spec;
      var matches = URL.match(/(^.*\/)(.*)/);
      var aDomain = matches ? matches[1] : URL;

      const tabsToRemove = this.visibleTabs.filter(
        tab =>
          !tab._isProtected &&
          tab.linkedBrowser.currentURI.spec.includes(aDomain ?? "")
      );
      if (
        !this.warnAboutClosingTabs(tabsToRemove.length, this.closingTabsEnum.GROUP_BY_TABMIX)
      ) {
        return;
      }

      this.removeTabs(tabsToRemove, {suppressWarnAboutClosingWindow: true});
    };

    gBrowser._reloadLeftTabs = function(aTab) {
      if (Tabmix.ltr)
        this.reloadLeftTabs(aTab);
      else
        this.reloadRightTabs(aTab);
    };

    gBrowser._reloadRightTabs = function(aTab) {
      if (Tabmix.ltr)
        this.reloadRightTabs(aTab);
      else
        this.reloadLeftTabs(aTab);
    };

    gBrowser.reloadLeftTabs = function(aTab) {
      if (aTab.localName != "tab")
        aTab = this._selectedTab;
      var childNodes = this.visibleTabs;
      if (aTab._tPos > this._selectedTab._tPos)
        this.selectedTab = aTab;
      let tabPos = childNodes.indexOf(aTab);
      Tabmix.tablib.reloadTabs(childNodes.slice(0, tabPos).reverse());
    };

    gBrowser.reloadRightTabs = function(aTab) {
      if (aTab.localName != "tab")
        aTab = this._selectedTab;
      var childNodes = this.visibleTabs;
      if (aTab._tPos < this._selectedTab._tPos)
        this.selectedTab = aTab;
      let tabPos = childNodes.indexOf(aTab);
      Tabmix.tablib.reloadTabs(childNodes.slice(tabPos + 1));
    };

    gBrowser.reloadAllTabsBut = function(aTab) {
      if (aTab.localName != "tab")
        aTab = this._selectedTab;
      else
        this.selectedTab = aTab;
      Tabmix.tablib.reloadTabs(this.visibleTabs, aTab);
    };

    gBrowser.lockTab = function(aTab) {
      if (aTab.localName != "tab")
        aTab = this._selectedTab;
      if (aTab.hasAttribute("locked")) {
        aTab.removeAttribute("_lockedAppTabs"); // we only have this if we locked AppTab
        aTab.removeAttribute("locked");
        aTab.setAttribute("_locked", "false");
      } else {
        aTab.setAttribute("locked", "true");
        aTab.setAttribute("_locked", "true");
      }
      aTab.linkedBrowser.tabmix_allowLoad = !aTab.hasAttribute("locked");
      TabmixSvc.setCustomTabValue(aTab, "_locked", aTab.getAttribute("_locked"));
      TabmixSessionManager.updateTabProp(aTab);
    };

    gBrowser.protectTab = function(aTab) {
      if (aTab.localName != "tab")
        aTab = this._selectedTab;
      if (aTab.hasAttribute("protected"))
        aTab.removeAttribute("protected");
      else
        aTab.setAttribute("protected", "true");
      TabmixSvc.setCustomTabValue(aTab, "protected", aTab.getAttribute("protected"));
      TabmixSessionManager.updateTabProp(aTab);
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
      }
    };

    gBrowser.freezeTab = function(aTab) {
      if (aTab.localName != "tab")
        aTab = this._selectedTab;
      if (!aTab.hasAttribute("protected") || !aTab.hasAttribute("locked")) {
        aTab.setAttribute("protected", "true");
        aTab.setAttribute("locked", "true");
        aTab.setAttribute("_locked", "true");
      } else {
        aTab.removeAttribute("protected");
        aTab.removeAttribute("locked");
        aTab.setAttribute("_locked", "false");
      }
      // don't keep this flag after user change lock state manually
      aTab.removeAttribute("_lockedAppTabs");
      aTab.linkedBrowser.tabmix_allowLoad = !aTab.hasAttribute("locked");
      TabmixSvc.setCustomTabValue(aTab, "_locked", aTab.getAttribute("_locked"));
      TabmixSvc.setCustomTabValue(aTab, "protected", aTab.getAttribute("protected"));
      TabmixSessionManager.updateTabProp(aTab);
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
      }
    };

    gBrowser.SelectToMerge = function(aTab) {
      if (Tabmix.singleWindowMode && Tabmix.numberOfWindows() == 1) return;
      if (aTab.localName != "tab")
        aTab = this._selectedTab;
      if (aTab.hasAttribute("mergeselected")) {
        aTab.removeAttribute("mergeselected");
        aTab.label = aTab.label.substr(4);
      } else {
        aTab.setAttribute("mergeselected", "true");
        aTab.label = "(*) " + aTab.label;
      }
      this._tabAttrModified(aTab, ["label"]);
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
      }
    };

    gBrowser.copyTabUrl = function(aTab) {
      if (aTab.localName != "tab")
        aTab = this._selectedTab;
      var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"]
          .getService(Ci.nsIClipboardHelper);

      clipboard.copyString(this.getBrowserForTab(aTab).currentURI.spec);
    };

    /** XXX need to fix this functions:
    previousTabIndex
    previousTab
    selectIndexAfterRemove

    to return tab instead of index
    since we can have tab hidden or remove the index can change....
  */
    gBrowser.previousTabIndex = function _previousTabIndex(aTab, aTabs) {
      var temp_id, tempIndex = -1, max_id = 0;
      var tabs = aTabs || this.visibleTabs;
      var items = Array.prototype.filter.call(this.tabContainer.getElementsByAttribute("tabmix_selectedID", "*"),
        tab => !tab.hidden && !tab.closing);
      for (var i = 0; i < items.length; ++i) {
        if (aTab && items[i] != aTab) {
          temp_id = parseInt(items[i].getAttribute("tabmix_selectedID") || 0);
          if (temp_id && temp_id > max_id) {
            max_id = temp_id;
            tempIndex = tabs.indexOf(items[i]);
          }
        }
      }

      return tempIndex;
    };

    /** @this {MockedGeckoTypes.TabBrowser} */
    gBrowser.previousTab = function(aTab) {
      var tabs = this.visibleTabs;
      if (tabs.length == 1)
        return;
      var tempIndex = this.previousTabIndex(aTab);

      // if no tabmix_selectedID go to previous tab, from first tab go to the next tab
      if (tempIndex == -1)
        // @ts-expect-error - visibleTabs.next is a Tab when tabs.length > 1
        this.selectedTab = aTab == tabs[0] ? Tabmix.visibleTabs.next(aTab) :
          Tabmix.visibleTabs.previous(aTab);
      else
        // @ts-expect-error tab exist in tempIndex
        this.selectedTab = tabs[tempIndex];

      this.selectedBrowser.focus();
    };

    gBrowser.selectIndexAfterRemove = function(oldTab) {
      var tabs = TMP_TabView.currentGroup();
      var currentIndex = tabs.indexOf(this._selectedTab);
      if (this._selectedTab != oldTab)
        return currentIndex;
      var l = tabs.length;
      if (l == 1)
        return 0;
      var mode = Tabmix.prefs.getIntPref("focusTab");
      switch (mode) {
        case 0: // first tab
          return currentIndex === 0 ? 1 : 0;
        case 1: // left tab
          return currentIndex === 0 ? 1 : currentIndex - 1;
        case 3: // last tab
          return currentIndex == l - 1 ? currentIndex - 1 : l - 1;
        case 6: {// last opened
          let lastTabIndex = -1, maxID = -1;
          tabs.forEach((tab, index) => {
            if (tab == oldTab)
              return;
            let linkedPanel = tab.linkedPanel.replace('panel', '');
            linkedPanel = linkedPanel.substr(linkedPanel.lastIndexOf("-") + 1);
            let id = parseInt(linkedPanel);
            if (id > maxID) {
              maxID = id;
              lastTabIndex = index;
            }
          });
          return lastTabIndex;
        }
        case 4: {// last selected
          let tempIndex = this.previousTabIndex(oldTab, tabs);
          // if we don't find last selected we fall back to default
          if (tempIndex > -1)
            return tempIndex;
        }
        /* falls through */
        case 2: // opener / right  (default )
        case 5: // right tab
          /* falls through */
        default:
          if (mode != 5 && Services.prefs.getBoolPref("browser.tabs.selectOwnerOnClose") && "owner" in oldTab) {
            var owner = oldTab.owner;
            if (owner && owner.parentNode && owner != oldTab && !owner.hidden) {
              // oldTab and owner still exist just return its position
              let tempIndex = tabs.indexOf(owner);
              if (tempIndex > -1)
                return tempIndex;
            }
          }
      }
      return currentIndex == l - 1 ? currentIndex - 1 : currentIndex + 1;
    };

    gBrowser.stopMouseHoverSelect = function(aTab) {
      // add extra delay after tab removed or after tab flip before we select by hover
      // to let the user time to move the mouse
      if (aTab.mouseHoverSelect) {
        this.tabContainer.setAttribute("preventMouseHoverSelect", "true");
        var delay = aTab.mouseHoverSelectDelay + 50;
        setTimeout(() => {
          this.tabContainer.removeAttribute("preventMouseHoverSelect");
        }, delay);
      }
    };

    Tabmix.tablib.warnAboutClosingTabsProps = function(tabsToClose, aCloseTabs) {
      var closing = this.closingTabsEnum;
      var onExit = aCloseTabs == closing.ALL;
      var tabs = !onExit ? this.visibleTabs : this.tabs;
      var numTabs = tabs.length;
      // calc the number of tab to close when there is protected tabs.
      /** @type {Tab[]} */
      let protectedTabs = [];
      /** @param {HTMLCollection_G<Tab>} aTabs */
      function addProtected(aTabs) {
        for (const tab of aTabs) {
          if (!protectedTabs.includes(tab) &&
              (onExit || !tab.hidden)) {
            protectedTabs.push(tab);
          }
        }
      }

      // we always restore pinned tabs no need to warn about closing
      if (Tabmix.isVersion(1300)) {
        if (this.pinnedTabCount && !onExit) {
          addProtected(this.tabContainer.getElementsByAttribute("pinned", true));
        }
      } else if (this._numPinnedTabs && !onExit) {
        addProtected(this.tabContainer.getElementsByAttribute("pinned", true));
      }

      if ("permaTabs" in window) {
        addProtected(this.tabContainer.getElementsByAttribute("isPermaTab", true));
      }
      addProtected(this.tabContainer.getElementsByAttribute("protected", true));

      var numProtected = protectedTabs.length;
      var shouldPrompt = 0;
      /** @type {{0: string, 1: string, 2: string} & {[key: number]: string}} */
      const prefs = {
        0: "browser.tabs.warnOnCloseOtherTabs",
        1: "extensions.tabmix.protectedtabs.warnOnClose",
        2: "browser.tabs.warnOnClose"
      };
      if (onExit) {
        let openTabs = Tabmix.tabsUtils.getTabsCount(numTabs);
        if (openTabs > 1 && Services.prefs.getBoolPref(prefs[2]))
          shouldPrompt = 3;
        else if (numProtected > 0 && Services.prefs.getBoolPref(prefs[1]))
          shouldPrompt = 2;
      } else if (numTabs > 1) {
        if (Services.prefs.getBoolPref(prefs[0]))
          shouldPrompt = 1;
        // when we close window with last tab and we don't have protected tabs
        // we need to warn the user with the proper warning
        if (Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab") &&
            !Tabmix.prefs.getBoolPref("keepLastTab") &&
            Services.prefs.getBoolPref(prefs[2])) {
          if (aCloseTabs == closing.GROUP_BY_TABMIX) {
            if (tabsToClose == this.tabs.length)
              shouldPrompt = 3;
            else if (Services.prefs.getBoolPref(prefs[0]))
              shouldPrompt = 1;
            else
              shouldPrompt = 0;
          } else if (aCloseTabs == closing.ALL_BY_TABMIX && numProtected === 0 &&
              numTabs == this.tabs.length) {
            shouldPrompt = 3;
          }
        }
      }

      let keepLastTab = 0;
      if (aCloseTabs != closing.ALL && tabsToClose == this.tabs.length &&
          Tabmix.prefs.getBoolPref("keepLastTab")) {
        keepLastTab = 1;
      }

      if (tabsToClose <= 1 && shouldPrompt < 2) {
        shouldPrompt = 0;
      }

      return {
        promptType: shouldPrompt,
        numProtected,
        keepLastTab,
        prefName: shouldPrompt && prefs[shouldPrompt - 1],
      };
    };

    Tabmix.tablib.showClosingTabsPrompt = function(
      shouldPrompt,
      tabsToClose,
      numProtected,
      flags,
      warnOnClose,
      {checkboxLabel2 = "", restoreSession = null} = {}
    ) {
      let warningTitle = "", buttonLabel = "", chkBoxLabel = "", warningText = "";
      // if (shouldPrompt === 1 || numProtected === 0) {
      if (shouldPrompt === 1) {
        // @ts-expect-error - return types are strings
        [warningTitle, buttonLabel, chkBoxLabel] = gBrowser.tabLocalization.formatValuesSync([
          {
            id: "tabbrowser-confirm-close-tabs-title",
            args: {tabCount: tabsToClose},
          },
          {id: "tabbrowser-confirm-close-tabs-button"},
          {id: "tabbrowser-confirm-close-tabs-checkbox"},
        ]);
      } else if (numProtected === 0) {
        // @ts-expect-error - return types are strings
        [warningTitle] = gBrowser.tabLocalization.formatValuesSync([
          {
            id: "tabbrowser-confirm-close-tabs-title",
            args: {tabCount: tabsToClose},
          }
        ]);
        buttonLabel = TabmixSvc.getString("closeWindow.label");
        chkBoxLabel = TabmixSvc.getString("window.closeWarning.2");
      } else {
        let messageKey = "protectedtabs.closeWarning.";
        messageKey += numProtected < tabsToClose ? "3" : numProtected == 1 ? "1" : "2";
        warningTitle = TabmixSvc.getFormattedString(messageKey, [tabsToClose, numProtected]);
        warningText = TabmixSvc.getString("protectedtabs.closeWarning.4");
        buttonLabel = TabmixSvc.getString("closeWindow.label");
        var chkBoxKey = shouldPrompt == 3 ? "window.closeWarning.2" : "protectedtabs.closeWarning.5";
        chkBoxLabel = TabmixSvc.getString(chkBoxKey);
      }

      let ps = Services.prompt;
      let buttonPressed;
      if (restoreSession) {
        // for waterfox G6.0.17+
        buttonPressed = ps.confirmEx2(
          window,
          warningTitle,
          warningText,
          flags,
          buttonLabel,
          "",
          "",
          chkBoxLabel,
          warnOnClose,
          checkboxLabel2,
          restoreSession
        );
      } else {
        buttonPressed = ps.confirmEx(
          window,
          warningTitle,
          warningText,
          flags,
          buttonLabel,
          "",
          "",
          chkBoxLabel,
          warnOnClose
        );
      }

      return buttonPressed;
    };

    Tabmix.tablib.warnAboutClosingTabsProps = Tabmix.tablib.warnAboutClosingTabsProps.bind(gBrowser);
    Tabmix.tablib.showClosingTabsPrompt = Tabmix.tablib.showClosingTabsPrompt.bind(gBrowser);

    // remove protected tabs from tabs to remove
    Tabmix.changeCode(gBrowser, "gBrowser.removeTabsToTheStartFrom")._replace(
      'let tabs = this.getTabsToTheStartFrom(aTab)',
      '$&.filter(tab => !tab._isProtected)'
    ).toCode();

    Tabmix.changeCode(gBrowser, "gBrowser.removeTabsToTheEndFrom")._replace(
      'let tabs = this.getTabsToTheEndFrom(aTab)',
      '$&.filter(tab => !tab._isProtected)'
    ).toCode();

    Tabmix.changeCode(gBrowser, "gBrowser.removeAllTabsBut")._replace(
      /tab\.pinned/g,
      'tab._isProtected'
    ).toCode();

    // Firefox remove selected pinned tabs
    Tabmix.changeCode(gBrowser, "gBrowser.removeMultiSelectedTabs")._replace(
      'let selectedTabs = this.selectedTabs',
      '$&.filter(tab => !tab._isProtected || tab.pinned)'
    ).toCode();

    if (Tabmix.isVersion(1270)) {
      Tabmix.changeCode(gBrowser, "gBrowser._removeDuplicateTabs")._replace(
        'if (!this.warnAboutClosingTabs',
        `const tabsCount = tabs.length;
        tabs = tabs.filter(tab => !tab._isProtected);
        const protectedCount = tabsCount - tabs.length;
        $&`
      )._replace(
        '{ l10nArgs:',
        '{ protectedCount, l10nArgs:',
      ).toCode();

      Tabmix.changeCode(window.ConfirmationHint, "ConfirmationHint.show")._replace(
        'const DURATION',
        `if (options.protectedCount) {
           this._panel.classList.add("with-description");
           this._description.hidden = false;
           const description = options.protectedCount === 1 ? "1 duplicate tab is protected" : options.protectedCount + " duplicate tabs are protected";
           this._description.setAttribute("value", description);
         }
         $&`
      ).toCode();
    }

    Tabmix.changeCode(gBrowser, "gBrowser.warnAboutClosingTabs")._replace(
      'var shouldPrompt = Services.prefs.getBoolPref(pref);',
      `$&
      let {promptType, numProtected, keepLastTab, prefName} =
        Tabmix.tablib.warnAboutClosingTabsProps(tabsToClose, aCloseTabs);
      if (promptType === 3) aCloseTabs = this.closingTabsEnum.ALL
      tabsToClose -= keepLastTab;
      shouldPrompt = promptType > 0;`
    )._replace(
      /(?<!const )buttonPressed = ps\.confirmEx[^;]*;/,
      'buttonPressed = Tabmix.tablib.showClosingTabsPrompt(promptType, tabsToClose, numProtected, flags, warnOnClose);'
    )._replace(
      /(?<!const )buttonPressed = ps\.confirmEx2[^;]*;/,
      'buttonPressed = Tabmix.tablib.showClosingTabsPrompt(promptType, tabsToClose, numProtected, flags, warnOnClose, {checkboxLabel2,  restoreSession});',
      {check: Tabmix.isVersion({wf: "115.13.0"})}
    )._replace(
      'aCloseTabs == this.closingTabsEnum.ALL &&', ''
    )._replace(
      'Services.prefs.setBoolPref(pref, false);',
      'Services.prefs.setBoolPref(prefName, false);'
    ).toCode();

    /** @this {MockedGeckoTypes.TabBrowser} */
    gBrowser.TMP_selectNewForegroundTab = function(aTab, aLoadInBackground, aUrl, addOwner) {
      var bgLoad = typeof aLoadInBackground == "boolean" ? aLoadInBackground :
        Services.prefs.getBoolPref("browser.tabs.loadInBackground");
      if (!bgLoad) {
        // set new tab owner
        addOwner = typeof addOwner == "boolean" ? addOwner : true;
        if (addOwner)
          aTab.owner = this.selectedTab;
        this.selectedTab = aTab;
        if (aUrl && Tabmix.isNewTabUrls(aUrl))
          Tabmix.tablib.setURLBarFocus();
      }
    };

    // Bug 752376 - Avoid calling scrollbox.ensureElementIsVisible()
    // if the tab strip doesn't overflow to prevent layout flushes
    gBrowser.ensureTabIsVisible = function tabmix_ensureTabIsVisible(aTab, aSmoothScroll) {
      if (Tabmix.tabsUtils.overflow) {
        this.tabContainer.arrowScrollbox.ensureElementIsVisible(aTab, !aSmoothScroll);
      }
    };

    /** DEPRECATED **/
    // we keep this function to stay compatible with other extensions that use it
    gBrowser.undoRemoveTab = () => TMP_ClosedTabs.undoCloseTab();
    // Tabmix don't use this function anymore
    // but treeStyleTab extension look for it
    gBrowser.restoreTab = function() { };
    gBrowser.closeTab = aTab => gBrowser.removeTab(aTab);
    gBrowser.TMmoveTabTo = gBrowser.moveTabTo;
    gBrowser.renameTab = aTab => Tabmix.renameTab.editTitle(aTab);
  },

  getTabTitle: function TMP_getTabTitle(aTab, url) {
    if (aTab?._tabmixState?.noBookmart) {
      aTab._tabmixState = {};
      return false;
    }
    // return the current tab only if it is visible
    if (TabmixTabbar.widthFitTitle &&
        (!TMP_Places.inUpdateBatch || !TMP_Places.currentTab)) {
      let tab = gBrowser.selectedTab;
      if (Tabmix.tabsUtils.isElementVisible(tab))
        TMP_Places.currentTab = tab;
    }

    TMP_Places.asyncSetTabTitle(aTab, url).then(foundTitle => {
      if (!foundTitle && aTab.linkedBrowser) {
        // call setTabTile again to get the default title
        aTab._tabmixState = {noBookmart: true};
        gBrowser.setTabTitle(aTab);
      }
    });

    return true;
  },

  onTabTitleChanged: function TMP_onTabTitleChanged(aTab, aBrowser, isUrlTitle) {
    if (!aTab || !aTab.parentNode || !aBrowser) {
      return;
    }
    // when TabmixTabbar.widthFitTitle is true we only have width attribute after tab reload
    // some site, like Gmail change title internally, after load already finished and we have remove
    // width attribute
    if (!TabmixTabbar.widthFitTitle || isUrlTitle && aTab.hasAttribute("width"))
      return;

    if (aBrowser.getAttribute("remote") == "true" &&
        aTab._restoreState == 2 &&
        this.labels.indexOf(aTab.label) > -1) {
      return;
    }

    if (aTab.hasAttribute("width") && !aTab.hasAttribute("faviconized")) {
      const {width} = aTab.getBoundingClientRect();
      aTab.removeAttribute("width");
      if (width != aTab.getBoundingClientRect().width)
        TMP_Places.afterTabTitleChanged(false);
    } else if (aTab.hasAttribute("fadein")) {
      TMP_Places.afterTabTitleChanged(false);
    }
    // don't keep unnecessary reference to current tab
    if (!TMP_Places.inUpdateBatch)
      TMP_Places.currentTab = null;
  },

  // make sure that our function don't break removeTab function
  onRemoveTab: function TMP_onRemoveTab(tab) {
    // Not in use since Firefox 27, see comment in TabmixTabClickOptions
    if (Tabmix.prefs.getBoolPref("tabbar.click_dragwindow") &&
        TabmixTabClickOptions._blockDblClick) {
      setTimeout(() => {
        TabmixTabClickOptions._blockDblClick = false;
      }, 0);
    }

    try {
      TabmixSessionManager.tabClosed(tab);
    } catch (ex) {
      Tabmix.assert(ex, "ERROR in TabmixSessionManager.tabClosed");
    }
  },

  closeLastTab: function TMP_closeLastTab() {
    if (TabmixSvc.isMac && window.location.href != AppConstants.BROWSER_CHROME_URL) {
      closeWindow(true);
      return;
    }
    if (gBrowser.tabs.length > 1 ||
        !Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab"))
      gBrowser.removeCurrentTab({animate: true});
    else
      closeWindow(true);
  },

  /**
  * only apply for sessionManager
  closeWindow: function TMP_closeWindow(aCountOnlyBrowserWindows) {
    // we use this flag in WindowIsClosing
    Tabmix._warnedBeforeClosing = true;

    // since that some pref can changed by _onQuitRequest we catch it first
    // by observe browser-lastwindow-close-requested
    function getSavedPref(aPrefName, type) {
      let returnVal = {saved: false};
      if (aPrefName in TabmixSessionManager.savedPrefs) {
        returnVal.saved = true;
        returnVal.value = TabmixSessionManager.savedPrefs[aPrefName];
        returnVal.newValue = Services.prefs[type == "int" ? "getIntPref" : "getBoolPref"](aPrefName);
        delete TabmixSessionManager.savedPrefs[aPrefName];
      } else {
        returnVal.value = Services.prefs[type == "int" ? "getIntPref" : "getBoolPref"](aPrefName);
      }

      return returnVal;
    }

    // check if "Save & Quit" or "warn About Closing Tabs" dialog was showed
    // from BrowserGlue.prototype._onQuitRequest
    function isAfterFirefoxPrompt() {
      // There are several cases where Firefox won't show a dialog here:
      // 1. There is only 1 tab open in 1 window
      // 2. The session will be restored at startup, indicated by
      //    browser.startup.page == 3 or browser.sessionstore.resume_session_once == true
      // 3. browser.warnOnQuit == false
      // 4. The browser is currently in Private Browsing mode
      // we check for these cases first

      if (!Services.prefs.getBoolPref("browser.warnOnQuit"))
        return false;

      if (Services.prefs.getBoolPref("browser.sessionstore.resume_session_once"))
        return false;

      // try to find non-private window
      let nonPrivateWindow = BrowserWindowTracker.getTopWindow({private: false});
      if (!nonPrivateWindow)
        return false;

      // last windows with tabs
      var windowtype = aCountOnlyBrowserWindows ? "navigator:browser" : null;
      if (window.gBrowser.browsers.length < 2 || Tabmix.numberOfWindows(false, windowtype) > 1)
        return false;

      // since this pref can change by _onQuitRequest we catch it first
      // by observe browser-lastwindow-close-requested
      let saveSessionPref = getSavedPref("browser.startup.page", "int");
      if (saveSessionPref.saved && saveSessionPref.value == 3)
        return false;

      // we never get to this function by restart
      // if we are still here we know that we are the last window
      // before Firefox 63 the return value was based on "browser.showQuitWarning"
      // if "browser.showQuitWarning" is true firefox show "Save & Quit"
      // when we quit or close last browser window.
      // if "browser.showQuitWarning" is false and we close last window firefox design
      // to show warnAboutClosingTabs dialog but we block it in order to call warnAboutClosingTabs
      // from here and catch display time here.

      // from Firefox 63 always return true
      return true;
    }

    // we always show our prompt on Mac
    var showPrompt = TabmixSvc.isMac || !isAfterFirefoxPrompt();
    // get caller caller name and make sure we are not on restart
    var askBeforeSave = !Tabmix.callerTrace("restartApp", "restart");
    var isLastWindow = Tabmix.isLastBrowserWindow;
    var result = TabmixSessionManager.deinit(isLastWindow, askBeforeSave);
    var canClose = result.canClose;
    // we only show warnAboutClose if firefox or tabmix didn't do it already
    // if showPrompt is false then prompt was shown by firefox code from BrowserGlue.prototype._onQuitRequest
    // or from TabmixSessionManager.deinit
    if (canClose && showPrompt && result.showMorePrompt) {
      var pref = "extensions.tabmix.warnAboutClosingTabs.timeout";
      var startTime = new Date().valueOf();
      var oldTime = Services.prefs.prefHasUserValue(pref) ? Services.prefs.getCharPref(pref) : 0;
      let closingTabs = Tabmix.tabsUtils.getTabsCount();
      canClose = gBrowser.warnAboutClosingTabs(closingTabs, gBrowser.closingTabsEnum.ALL);
      Services.prefs.setCharPref(pref, Number(oldTime) + (new Date().valueOf() - startTime));
    }

    TabmixSessionManager.windowIsClosing(canClose, isLastWindow, result.saveSession, result.removeClosedTabs);

    return canClose;
  },
  */

  whereToOpenDrop(aEvent, aUri) {
    if (!aEvent) {
      return "current";
    }
    let browser = gBrowser.selectedBrowser;
    let where = "current";
    if (aUri != browser.currentURI.spec) {
      let tab = gBrowser._selectedTab;
      let isCopy = "dataTransfer" in aEvent ?
        aEvent.dataTransfer.dropEffect === "copy" :
        aEvent.ctrlKey || aEvent.metaKey;
      if (!isCopy && tab.getAttribute("locked") &&
          !gBrowser.isBlankNotBusyTab(tab) &&
          !Tabmix.ContentClick.isUrlForDownload(aUri)) {
        where = "tab";
      }
    }
    if (where == "current") {
      browser.tabmix_allowLoad = true;
    }
    return where;
  },

  setURLBarFocus: function TMP_setURLBarFocus() {
  },

  reloadTabs(tabs, skipTab) {
    for (const tab of tabs) {
      if (tab != skipTab && tab._restoreState != 2) {
        try {
          tab.linkedBrowser.reload();
        } catch {}
      }
    }
  }

}; // end Tabmix.tablib

ChromeUtils.defineLazyGetter(Tabmix.tablib, "recentlyClosed", () => {
  return new Localization(["browser/recentlyClosed.ftl"], true);
});

// keep this here for the case Firefox will use more then one label in the future
ChromeUtils.defineLazyGetter(Tabmix.tablib, "labels", () => {
  return [Tabmix.emptyTabTitle];
});

ChromeUtils.defineLazyGetter(Tabmix, "emptyTabTitle", () => {
  return gBrowser.tabLocalization.formatValueSync("tabbrowser-empty-tab-title");
});

Tabmix.isNewTabUrls = function Tabmix_isNewTabUrls(aUrl) {
  return this.newTabUrls.indexOf(aUrl) > -1;
};

Tabmix.newTabUrls = [
  TabmixSvc.aboutNewtab, TabmixSvc.aboutBlank,
  "about:privatebrowsing",
  "chrome://abouttab/content/text.html",
  "chrome://abouttab/content/tab.html",
  "chrome://google-toolbar/content/new-tab.html",
  "chrome://fastdial/content/fastdial.html",
  "chrome://browser/content/blanktab.html"
];

Tabmix.isBlankNewTab = function(url) {
  return [
    TabmixSvc.aboutNewtab,
    TabmixSvc.aboutBlank,
    "chrome://browser/content/blanktab.html",
  ].includes(url);
};

Tabmix.getOpenTabNextPref = function(aRelatedToCurrent = false) {
  return (
    Services.prefs.getBoolPref("browser.tabs.insertAfterCurrent") ||
    Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent") &&
      aRelatedToCurrent
  );
};
