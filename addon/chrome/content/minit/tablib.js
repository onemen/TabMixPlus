"use strict";

Tabmix.backwardCompatibilityGetter(window, "tablib", "Tabmix.tablib");

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
    // set init value according to lockallTabs state
    // we update this value in TabmixProgressListener.listener.onStateChange
    aBrowser.tabmix_allowLoad = !TabmixTabbar.lockallTabs;
    if (this._loadURIInitialized) {
      return;
    }
    this._loadURIInitialized = true;

    Tabmix.originalFunctions._loadURI = window._loadURI;
    window._loadURI = function(...args) {
      try {
        // if we redirected the load request to a new tab return it
        const tabmixResult = Tabmix.tablib._loadURI.apply(null, args);
        if (tabmixResult) {
          return tabmixResult;
        }

        Tabmix.originalFunctions._loadURI.apply(this, args);
      } catch (ex) {
        Tabmix.reportError(ex);
      }
      return null;
    };
  },

  _loadURI(browser, uri, params) {
    if (Tabmix.tablib.allowLoad(browser, uri)) {
      return null;
    }
    // redirect load request to a new tab
    let flags = params.flags;
    let isFlagged = flag => Boolean(flags & Ci.nsIWebNavigation[flag]);
    params.inBackground = false;
    params.allowThirdPartyFixup = isFlagged("LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP");
    params.fromExternal = isFlagged("LOAD_FLAGS_FROM_EXTERNAL");
    params.allowMixedContent = isFlagged("LOAD_FLAGS_ALLOW_MIXED_CONTENT");
    return gBrowser.loadOneTab(uri, params);
  },

  allowLoad(browser, uri) {
    var tab = gBrowser.getTabForBrowser(browser);
    if (!tab) {
      browser.tabmix_allowLoad = true;
      return true;
    }
    var allowLoad = this.isException(browser.tabmix_allowLoad !== false ||
                                       uri.match(/^javascript:/));

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
        return null;
      }
      try {
        let newURI = Services.io.newURI(uri);
        allowLoad = browser.currentURI.equalsExceptRef(newURI);
      } catch (ex) {}
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
    gBrowser.addTab = function(...args) {
      let callerTrace = Tabmix.callerTrace(),
          isRestoringTab = callerTrace.contain("ssi_restoreWindow");

      let {index, isPending} = args[1] || {};

      if (typeof index !== "number" &&
          callerTrace.contain("ssi_restoreWindow", "duplicateTabIn ")) {
        args[1].index = this.tabs.length;
      }

      var t = Tabmix.originalFunctions.gBrowser_addTab.apply(this, args);

      if (isPending || isRestoringTab &&
          Services.prefs.getBoolPref("browser.sessionstore.restore_on_demand")) {
        t.setAttribute("tabmix_pending", "true");
      }

      return t;
    };

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
        'TMP_BrowserOpenTab(null, null, true)'
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
      Tabmix.originalFunctions.gBrowser_blurTab.apply(this, arguments);
    };

    const $LF = '\n    ';
    Tabmix.changeCode(gBrowser, "gBrowser.getWindowTitleForBrowser")._replace(
      'let dataSuffix =',
      'let titlePromise;' + $LF +
        'if (tab.hasAttribute("tabmix_changed_label")) {' + $LF +
        '  titlePromise = Promise.resolve(tab.getAttribute("tabmix_changed_label"));' + $LF +
        '} else {' + $LF +
        '  titlePromise = TMP_Places.asyncGetTabTitle(tab, aBrowser.currentURI.spec, title);' + $LF +
        '}' + $LF +
        'return titlePromise.then(title => {' + $LF +
        '$&'
    )._replace(
      /(})(\)?)$/,
      '});\n' +
        '$1$2'
    ).toCode(false, gBrowser, "asyncGetWindowTitleForBrowser");

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
      {flag: 'g'}
    )._replace(
      /title = title\.substring\(0, 500\).*;/,
      '$&\
      urlTitle = title;'
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
         TMP_Places.currentTab = null;\
       $&'
    )._replace(
      '{ isContentTitle }',
      '{ isContentTitle, urlTitle }',
    ).toCode();

    Tabmix.originalFunctions.gBrowser_setInitialTabTitle = gBrowser.setInitialTabTitle;
    gBrowser.setInitialTabTitle = function(aTab) {
      if (aTab._labelIsInitialTitle &&
            aTab.hasAttribute("tabmix_changed_label")) {
        return;
      }
      Tabmix.originalFunctions.gBrowser_setInitialTabTitle.apply(this, arguments);
    };

    Tabmix.changeCode(gBrowser, "gBrowser._setTabLabel")._replace(
      '{ beforeTabOpen, isContentTitle }',
      '{ beforeTabOpen, isContentTitle, urlTitle }'
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
        switcher.updateDisplay = function() {
          let visibleTab = this.visibleTab;
          Tabmix.originalFunctions.switcher_updateDisplay.apply(this, arguments);
          if (visibleTab !== this.visibleTab) {
            Tabmix.setTabStyle(visibleTab);
            TMP_eventListener.updateDisplay(this.visibleTab);
            TabmixTabbar.updateBeforeAndAfter();
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
      const methodName = Tabmix.isVersion(910) ? "gBrowser.tabContainer.init" : "gBrowser.tabContainer.handleEvent";
      Tabmix.changeCode(tabBar, methodName)._replace(
        'this._updateCloseButtons',
        'TabmixTabbar._handleResize(); \
         $&'
      ).toCode();

      let $LF = '\n          ';
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._positionPinnedTabs")._replace(
        'this.removeAttribute("positionpinnedtabs");',
        'if (typeof this.arrowScrollbox.resetFirstTabInRow == "function")\
           this.arrowScrollbox.resetFirstTabInRow();\
         $&'
      )._replace(
        Tabmix.isVersion("890") ? 'scrollStartOffset:' : 'scrollButtonWidth:',
        '$& TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT ? 0 :'
      )._replace(
        'if (doPosition)',
        'if (doPosition && TabmixTabbar.isMultiRow &&' + $LF +
        '    Tabmix.prefs.getBoolPref("pinnedTabScroll")) {' + $LF +
        '  doPosition = false;' + $LF +
        '}' + $LF +
        'if (doPosition && TabmixTabbar.isMultiRow) {' + $LF +
        '  this.setAttribute("positionpinnedtabs", "true");' + $LF +
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
        '    this.style.paddingInlineStart = "";' + $LF +
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
        '  TMP_tabDNDObserver.paddingLeft = parseInt(this.style.paddingInlineStart || 0);' +
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
      } else if (!gBrowser ||
        gBrowser.tabs.length - gBrowser._removingTabs.length == 1) {
        collapse = !window.toolbar.visible || TabmixTabbar.hideMode === 1;
      }
      $&`
    )._replace(
      /(})(\)?)$/,
      `const bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
      if (bottomToolbox) {
        bottomToolbox.collapsed = collapse;
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
        '    TabmixTabbar.updateBeforeAndAfter();' +
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

    Tabmix.changeCode(tabBar, "gBrowser.tabContainer._setPositionalAttributes")._replace(
      /(})(\)?)$/,
      '          Tabmix.setTabStyle(this.selectedItem);\n' +
      '          TabmixTabbar.updateBeforeAndAfter();\n' +
      '$1$2'
    ).toCode();
  },

  change_utility: function change_utility() {
    // FullScreen code related to tabs bellow content initialize by first
    // fullScreen event, see TMP_eventListener.onFullScreen
    Tabmix.originalFunctions.FullScreen_showNavToolbox = FullScreen.showNavToolbox;
    FullScreen.showNavToolbox = function() {
      let result = Tabmix.originalFunctions.FullScreen_showNavToolbox.apply(this, arguments);
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
    // eslint-disable-next-line no-unused-vars
    window.duplicateTabIn = function(aTab, where, delta) {
      if (where == "window" && Tabmix.getSingleWindowMode()) {
        where = "tab";
      }
      // we prevent SessionStore.duplicateTab from moving the tab
      // see gBrowser.addTab
      // always set where to 'tabshifted' to prevent original function from
      // selecting the new tab
      if (where == "tab") {
        arguments[1] = "tabshifted";
      }

      if (where == window) {
        return Tabmix.originalFunctions.duplicateTabIn.apply(this, arguments);
      }

      let pref = Tabmix.callerTrace("gotoHistoryIndex", "BrowserForward", "BrowserBack") ?
        "browser.tabs.insertAfterCurrent" : "extensions.tabmix.openDuplicateNext";
      let openTabNext = Services.prefs.getBoolPref(pref);
      TMP_extensionsCompatibility.treeStyleTab.openNewTabNext(aTab, openTabNext, true);

      let result = Tabmix.originalFunctions.duplicateTabIn.apply(this, arguments);

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

    Tabmix.changeCode(window, "BrowserCloseTabOrWindow")._replace(
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
    let fnObj = nsBrowserAccess.prototype;
    // TreeStyleTab 0.16.2015111001 wrap openURI in nsBrowserAccess.prototype.__treestyletab__openURI
    let TSTopenURI = Tabmix.extensions.treeStyleTab &&
        typeof fnObj.__treestyletab__openURI == "function" ? "__treestyletab__openURI" : "";

    Tabmix.changeCode(fnObj, "nsBrowserAccess.prototype._openURIInNewTab")._replace(
      `if (aIsExternal && (!aURI || aURI.spec == "${TabmixSvc.aboutBlank}")) {`,
      'let currentIsBlank = win.gBrowser.isBlankNotBusyTab(win.gBrowser._selectedTab); \
       $&'
    )._replace(
      'win.BrowserOpenTab()',
      'if (currentIsBlank) Tabmix.tablib.setURLBarFocus(); \
      else $&'
    )._replace(
      '"browser.tabs.loadDivertedInBackground"',
      'aIsExternal ? "extensions.tabmix.loadExternalInBackground" : $&'
    )._replace(
      'win.gBrowser.loadOneTab',
      'currentIsBlank ? win.gBrowser._selectedTab : $&'
    )._replace(
      'win.gBrowser.getBrowserForTab(tab);',
      '$&\n' +
      '    if (currentIsBlank && aURI) {\n' +
      '      let loadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;\n' +
      '      if (aIsExternal) {\n' +
      '        loadFlags |= Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL;\n' +
      '      }\n' +
      '      gBrowser.loadURI(aURI.spec, {\n' +
      '        triggeringPrincipal: aTriggeringPrincipal,\n' +
      '        referrerInfo: aReferrerInfo,\n' +
      '        userContextId: aUserContextId,\n' +
      '        csp: aCsp,\n' +
      '        loadFlags,\n' +
      '      });\n' +
      '      browser.focus();\n' +
      '    }'
    ).toCode();

    let fnName = "nsBrowserAccess.prototype." + (TSTopenURI || "getContentWindowOrOpenURI");
    Tabmix.changeCode(fnObj, fnName)._replace(
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

    // fix after Bug 606678
    // fix compatibility with X-notifier(aka WebMail Notifier) 2.9.13+
    [fnObj, fnName] = Tabmix.onContentLoaded.getXnotifierFunction("openNewTabWith");

    Tabmix.originalFunctions.FillHistoryMenu = window.FillHistoryMenu;
    let fillHistoryMenu = function FillHistoryMenu(aParent) {
      let rv = Tabmix.originalFunctions.FillHistoryMenu.apply(this, arguments);
      let l = aParent.childNodes.length;
      for (let i = 0; i < l; i++) {
        let item = aParent.childNodes[i];
        let uri = item.getAttribute("uri");
        let label = item.getAttribute("label");
        TMP_Places.getTitleFromBookmark(uri, label).then(title => {
          Tabmix.setItem(item, "label", title);
        });
      }
      return rv;
    };
    Tabmix.setNewFunction(window, "FillHistoryMenu", fillHistoryMenu);

    // Fix for old Fast Dial versions before 4.6.1
    // https://addons.mozilla.org/en-us/firefox/addon/fast-dial/
    let fastDial = window.FdTabLoader,
        fdGoHome = fastDial && fastDial.BrowserGoHome;
    if (window.BrowserGoHome || fdGoHome) {
      let obj = fdGoHome ? window.FdTabLoader : window;
      fnName = fdGoHome ? "FdTabLoader.BrowserGoHome" : "window.BrowserGoHome";
      Tabmix.changeCode(obj, fnName)._replace(
        'var where = whereToOpenLink(aEvent, false, true);',
        '$&' +
        'if (where == "current" && Tabmix.whereToOpen(false).inNew) where = "tab";'
      )._replace(
        /loadOneOrMoreURIs\([^;]+;/,
        '$& \
        gBrowser.ensureTabIsVisible(gBrowser.selectedTab);'
      ).toCode();
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
          window = Tabmix.RecentWindow.getMostRecentBrowserWindow({private: false});
       }
       if (window) {
        window.focus();
        let index = aIndex || 0;
        let closedWindows = JSON.parse(SessionStore.getClosedWindowData());
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
      /(})(\)?)$/,
      `if (!undoPopup.hasAttribute("context")) {
        undoPopup.setAttribute("context", "tm_undocloseContextMenu");
      }
      TMP_ClosedTabs.populateUndoSubmenu(undoPopup);
      $1$2`
    ).toCode();

    Tabmix.changeCode(HistoryMenu.prototype, "HistoryMenu.prototype._onPopupShowing")._replace(
      'this.toggleRecentlyClosedWindows();',
      '$& \
       TMP_Places.historyMenuItemsTitle(aEvent);'
    )._replace(
      'this.toggleRecentlyClosedWindows();',
      '$& \
       let SM = TabmixSessionManager;\
       Tabmix.setItem("Browser:RestoreLastSession", "disabled", !SM.canRestoreLastSession || SM.isPrivateWindow);',
      {check: Tabmix.prefs.getBoolPref("sessions.manager")}
    ).toCode();

    Tabmix.changeCode(HistoryMenu.prototype, "HistoryMenu.prototype.populateUndoWindowSubmenu")._replace(
      '"menuitem"',
      'undoPopup.__tagName || "menuitem"'
    )._replace(
      /(})(\)?)$/,
      '  Tabmix.tablib.populateUndoWindowSubmenu(undoPopup);\n' +
      '$1$2'
    ).toCode();

    var popup = document.getElementById("historyUndoWindowPopup");
    if (popup)
      popup.setAttribute("context", "tm_undocloseWindowContextMenu");

    Tabmix.originalFunctions.gURLBarsetURI = gURLBar.setURI();
    let _gURLBarsetURI = function tabmix_gURLBarsetURI() {
      if (Tabmix.selectedTab == gBrowser.selectedTab &&
          Tabmix.userTypedValue && gBrowser.userTypedValue !== "") {
        gBrowser.userTypedValue = "";
      }
      Tabmix.originalFunctions.gURLBarsetURI.apply(window, arguments);
    };
    Tabmix.setNewFunction(gURLBar, "setURI()", _gURLBarsetURI);
  },

  populateUndoWindowSubmenu(undoPopup) {
    const isSubviewbutton = undoPopup.__tagName === "toolbarbutton";
    undoPopup.setAttribute("context", "tm_undocloseWindowContextMenu");
    let undoItems = TabmixSvc.ss.getClosedWindowData(false);
    let menuLabelString = gNavigatorBundle.getString("menuUndoCloseWindowLabel");
    let menuLabelStringSingleTab =
      gNavigatorBundle.getString("menuUndoCloseWindowSingleTabLabel");
    let checkForMiddleClick = function(e) {
      this.checkForMiddleClick(e);
    }.bind(Tabmix.closedObjectsUtils);
    for (let i = 0; i < undoPopup.childNodes.length - 1; i++) {
      let m = undoPopup.childNodes[i];
      let undoItem = undoItems[i];
      if (undoItem && m.hasAttribute("targetURI")) {
        TMP_SessionStore.asyncGetTabTitleForClosedWindow(undoItem).then(title => {
          let otherTabsCount = undoItem.tabs.length - 1;
          let label = (otherTabsCount === 0) ?
            menuLabelStringSingleTab : PluralForm.get(otherTabsCount, menuLabelString);
          const menuLabel = label.replace("#1", title)
              .replace("#2", otherTabsCount);
          m.setAttribute("label", menuLabel);
        });
      }
      m.setAttribute("value", i);
      m.fileName = "closedwindow";
      m.addEventListener("click", checkForMiddleClick);
      if (isSubviewbutton) {
        m.value = i;
        m.setAttribute("class", "bookmark-item subviewbutton subviewbutton-iconic");
      }
    }
    let restoreAllWindows = undoPopup.lastChild;
    restoreAllWindows.setAttribute("value", -2);
    let clearList = document.createXULElement(undoPopup.__tagName || "menuitem");
    clearList.id = "menu_clearClosedWindowsList";
    clearList.setAttribute("label", TabmixSvc.getString("undoClosedWindows.clear.label"));
    clearList.setAttribute("value", -1);
    if (isSubviewbutton) {
      restoreAllWindows.setAttribute("class", "subviewbutton subviewbutton-iconic");
      clearList.setAttribute("class", "subviewbutton subviewbutton-iconic");
    }
    clearList.addEventListener("command", () => {
      Tabmix.closedObjectsUtils.forgetClosedWindow(-1);
    });
    undoPopup.insertBefore(clearList, restoreAllWindows);
  },

  addNewFunctionsTo_gBrowser: function addNewFunctionsTo_gBrowser() {
    let duplicateTab = function(aTab, aHref, aTabData, disallowSelect, dontFocusUrlBar) {
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
        newTab = this.SSS_duplicateTab(aTab, aHref, aTabData);
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
        let url = !dontFocusUrlBar ? aHref || this.getBrowserForTab(aTab).currentURI.spec : null;
        this.TMP_selectNewForegroundTab(newTab, bgPref, url, false);
      }

      return newTab;
    };
    Tabmix.duplicateTab = duplicateTab.bind(gBrowser);

    gBrowser.SSS_duplicateTab = function tabbrowser_SSS_duplicateTab(aTab, aHref, aTabData) {
      var newTab = null, tabState;
      // add new history entry after current index
      function addNewHistoryEntry() {
        try {
          var activeIndex = (tabState.index || tabState.entries.length) - 1;
          var entriesToRemove = 0;
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
      function updateNewHistoryTitle() {
        try {
          this.removeEventListener("SSTabRestored", updateNewHistoryTitle, true);
          let browser = this.linkedBrowser;
          if (Services.appinfo.sessionHistoryInParent) {
            const history = browser.browsingContext.sessionHistory;
            const shEntry = history.getEntryAtIndex(history.index, false).QueryInterface(Ci.nsISHEntry);
            shEntry.title = this.label;
          } else {
            browser.messageManager.sendAsyncMessage("Tabmix:updateHistoryTitle", {title: this.label});
          }
        } catch (ex) {
          Tabmix.assert(ex);
        }
      }
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
        tabState = aTabData ? aTabData.state : JSON.parse(TabmixSvc.ss.getTabState(aTab));
        newTab = this.addTrustedTab("about:blank", {index: gBrowser.tabs.length});
        newTab.linkedBrowser.stop();
        if (aHref) {
          if (Tabmix.ContentClick.isUrlForDownload(aHref))
            newTab.addEventListener("SSTabRestored", urlForDownload, true);
          else {
            delete tabState.scroll;
            addNewHistoryEntry();
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
          Tabmix.duplicateTab(aTab, null, aTabData);
      } else if (aMoveTab) {
        this.replaceTabWithWindow(aTab);
      } else {
        let otherWin = OpenBrowserWindow();
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

    gBrowser.duplicateTabsToWindow = function(contextTab) {
      const tabs = contextTab.multiselected ? this.selectedTabs : [contextTab];
      this.clearMultiSelectedTabs();

      if (tabs.length === 1) {
        this.duplicateTabToWindow(tabs[0]);
        return;
      }

      let selectedTabIndex = Math.max(0, tabs.indexOf(this.selectedTab));
      let otherWin = OpenBrowserWindow({private: PrivateBrowsingUtils.isBrowserPrivate(contextTab.linkedBrowser)});
      let delayedStartupFinished = (subject, topic) => {
        if (topic == "browser-delayed-startup-finished" &&
            subject == otherWin) {
          Services.obs.removeObserver(delayedStartupFinished, topic);
          let otherGBrowser = otherWin.gBrowser;
          let otherTab = otherGBrowser.selectedTab;
          for (let index = 0; index < tabs.length; index += 1) {
            const tab = tabs[index];
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
          }
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
        Tabmix.tabsUtils.updateVerticalTabStrip(true);
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
          tab.linkedBrowser.currentURI.spec.includes(aDomain)
      );
      if (
        !this.warnAboutClosingTabs(tabsToRemove.length, this.closingTabsEnum.GROUP_BY_TABMIX)
      ) {
        return;
      }

      this.removeTabs(tabsToRemove, {suppressWarnAboutClosingWindow: true});
    };

    if (!Tabmix.isVersion(880)) {
      /* eslint-disable no-continue */
      gBrowser.getTabsToTheStartFrom = function(aTab) {
        let tabsToStart = [];
        let tabs = this.visibleTabs;
        for (let i = 0; i < tabs.length; ++i) {
          if (tabs[i] == aTab) {
            break;
          }
          // Ignore pinned tabs.
          if (tabs[i].pinned) {
            continue;
          }
          // In a multi-select context, select all unselected tabs
          // starting from the context tab.
          if (aTab.multiselected && tabs[i].multiselected) {
            continue;
          }
          tabsToStart.push(tabs[i]);
        }
        return tabsToStart;
      };

      /**
       * In a multi-select context, the tabs (except pinned tabs) that are located to the
       * left of the leftmost selected tab will be removed.
       */
      gBrowser.removeTabsToTheStartFrom = function(aTab) {
        let tabs = this.getTabsToTheStartFrom(aTab);
        if (
          !this.warnAboutClosingTabs(tabs.length, this.closingTabsEnum.TO_START)
        ) {
          return;
        }

        this.removeTabs(tabs);
      };
      /* eslint-enable no-continue */
    }

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
        TabmixTabbar.updateBeforeAndAfter();
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
        TabmixTabbar.updateBeforeAndAfter();
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
        TabmixTabbar.updateBeforeAndAfter();
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

    gBrowser.previousTab = function(aTab) {
      var tabs = this.visibleTabs;
      if (tabs.length == 1)
        return;
      var tempIndex = this.previousTabIndex(aTab);

      // if no tabmix_selectedID go to previous tab, from first tab go to the next tab
      if (tempIndex == -1)
        this.selectedTab = aTab == tabs[0] ? Tabmix.visibleTabs.next(aTab) :
          Tabmix.visibleTabs.previous(aTab);
      else
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
          let lastTabIndex, maxID = -1;
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
        this.tabContainer.setAttribute("preventMouseHoverSelect", true);
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
      let protectedTabs = [];
      function addProtected(aTabs) {
        for (let i = 0; i < aTabs.length; i++) {
          let tab = aTabs[i];
          if (!protectedTabs.includes(tab) &&
              (onExit || !tab.hidden)) {
            protectedTabs.push(aTabs[i]);
          }
        }
      }
      // we always restore pinned tabs no need to warn about closing
      if (this._numPinnedTabs && !onExit) {
        addProtected(this.tabContainer.getElementsByAttribute("pinned", true));
      }
      if ("permaTabs" in window) {
        addProtected(this.tabContainer.getElementsByAttribute("isPermaTab", true));
      }
      addProtected(this.tabContainer.getElementsByAttribute("protected", true));

      var numProtected = protectedTabs.length;
      var shouldPrompt = 0;
      var prefs = ["browser.tabs.warnOnCloseOtherTabs",
        "extensions.tabmix.protectedtabs.warnOnClose",
        "browser.tabs.warnOnClose"];
      if (onExit) {
        let openTabs = numTabs - this._removingTabs.length;
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

    Tabmix.tablib.showClosingTabsPrompt = function(shouldPrompt, tabsToClose, numProtected, flags, warnOnClose) {
      const stringMap = {
        "tabs.closeTabsTitle": {before: 940, l10n: "tabs.closeWarningMultipleTabs"},
        "tabs.closeTabsConfirmCheckbox": {before: 940, l10n: "tabs.closeWarningPrompt"},
        "tabs.closeWarningMultipleTabs": {before: 880, l10n: "tabs.closeWarningMultiple"},
        "tabs.closeWarningPrompt": {before: 880, l10n: "tabs.closeWarningPromptMe"},
      };
      function convert(id, data = stringMap[id]) {
        return data && !Tabmix.isVersion(data.before) ? convert(data.l10n) : id;
      }
      function getString(name) {
        return Tabmix.getString(convert(name));
      }

      let warningTitle, message, chkBoxLabel;
      if (shouldPrompt === 1 || numProtected === 0) {
        message = PluralForm.get(tabsToClose, getString("tabs.closeTabsTitle"))
            .replace("#1", tabsToClose);
        chkBoxLabel = shouldPrompt === 1 ? getString("tabs.closeTabsConfirmCheckbox") :
          TabmixSvc.getString("window.closeWarning.2");
      } else {
        let messageKey = "protectedtabs.closeWarning.";
        messageKey += (numProtected < tabsToClose) ? "3" : (numProtected == 1) ? "1" : "2";
        message = [
          TabmixSvc.getFormattedString(messageKey, [tabsToClose, numProtected]),
          TabmixSvc.getString("protectedtabs.closeWarning.4")
        ];
        var chkBoxKey = shouldPrompt == 3 ? "window.closeWarning.2" : "protectedtabs.closeWarning.5";
        chkBoxLabel = TabmixSvc.getString(chkBoxKey);
      }

      let buttonLabel = shouldPrompt == 1 ? getString("tabs.closeButtonMultiple") :
        TabmixSvc.getString("closeWindow.label");

      if (Tabmix.isVersion(940)) {
        if (shouldPrompt === 1 || numProtected === 0) {
          warningTitle = message;
          message = null;
        } else {
          [warningTitle, message] = message;
        }
      } else {
        warningTitle = getString("tabs.closeTitleTabs");
        message = shouldPrompt === 1 || numProtected === 0 ? message : message.join("\n");
      }

      var ps = Services.prompt;
      var buttonPressed = ps.confirmEx(
        window,
        warningTitle,
        message,
        flags,
        buttonLabel,
        null,
        null,
        chkBoxLabel,
        warnOnClose
      );

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

    Tabmix.changeCode(gBrowser, "gBrowser.warnAboutClosingTabs")._replace(
      'var shouldPrompt = Services.prefs.getBoolPref(pref);',
      `$&
      let {promptType, numProtected, keepLastTab, prefName} =
        Tabmix.tablib.warnAboutClosingTabsProps(tabsToClose, aCloseTabs);
      if (promptType === 3) aCloseTabs = this.closingTabsEnum.ALL
      tabsToClose -= keepLastTab;
      shouldPrompt = promptType > 0;`
    )._replace(
      /var buttonPressed = ps\.confirmEx[^;]*;/,
      'var buttonPressed = Tabmix.tablib.showClosingTabsPrompt(promptType, tabsToClose, numProtected, flags, warnOnClose);'
    )._replace(
      'aCloseTabs == this.closingTabsEnum.ALL &&', ''
    )._replace(
      'Services.prefs.setBoolPref(pref, false);',
      'Services.prefs.setBoolPref(prefName, false);'
    ).toCode();

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

    Tabmix.originalFunctions.swapBrowsersAndCloseOther = gBrowser.swapBrowsersAndCloseOther;
    let swapTab = function tabmix_swapBrowsersAndCloseOther(aOurTab, aOtherTab) {
      // Do not allow transferring a private tab to a non-private window
      // and vice versa.
      if (PrivateBrowsingUtils.isWindowPrivate(window) !=
          PrivateBrowsingUtils.isWindowPrivate(aOtherTab.ownerGlobal)) {
        return false;
      }

      if (gBrowserInit.tabmix_delayedStartupStarted && !gBrowserInit.delayedStartupFinished) {
        // we probably will never get here in single window mode
        if (Tabmix.singleWindowMode) {
          return false;
        }
        Tabmix._afterTabduplicated = true;
        let url = aOtherTab.linkedBrowser.currentURI.spec;
        gBrowser.tabContainer._updateCloseButtons(true, url);
      }

      Tabmix.copyTabData(aOurTab, aOtherTab);
      return Tabmix.originalFunctions.swapBrowsersAndCloseOther.apply(this, arguments);
    };
    Tabmix.setNewFunction(gBrowser, "swapBrowsersAndCloseOther", swapTab);

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
    gBrowser.closeTab = aTab => this.removeTab(aTab);
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

  get labels() {
    delete this.labels;
    this.labels = [
      Tabmix.getString("tabs.emptyTabTitle"),
    ];
    return this.labels;
  },

  onTabTitleChanged: function TMP_onTabTitleChanged(aTab, aBrowser, isUrlTitle) {
    if (!aTab || !aTab.parentNode || !aBrowser) {
      return;
    }
    // when TabmixTabbar.widthFitTitle is true we only have width attribute after tab reload
    // some site, like Gmail change title internally, after load already finished and we have remove
    // width attribute
    if (!TabmixTabbar.widthFitTitle || (isUrlTitle && aTab.hasAttribute("width")))
      return;

    if (aBrowser.getAttribute("remote") == "true" &&
        aBrowser.__SS_restoreState == 2 &&
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
      let nonPrivateWindow = Tabmix.RecentWindow.getMostRecentBrowserWindow({private: false});
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
      let closingTabs = gBrowser.tabs.length - gBrowser._removingTabs.length;
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
        (aEvent.ctrlKey || aEvent.metaKey);
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

  contentAreaOnDrop: function TMP_contentAreaOnDrop(aEvent, aUri, aPostData) {
    let where = aEvent.tabmixContentDrop || this.whereToOpenDrop(aEvent, aUri);
    if (where == "tab")
      gBrowser.loadOneTab(aUri, null, null, aPostData, false, false);
    else
      loadURI(aUri, null, aPostData, false);
  },

  setURLBarFocus: function TMP_setURLBarFocus() {
    if (gURLBar)
      gURLBar.focus();
  },

  reloadTabs(tabs, skipTab) {
    let l = tabs.length;
    for (let i = 0; i < l; i++) {
      let tab = tabs[i];
      if (tab != skipTab && tab.linkedBrowser.__SS_restoreState != 2) {
        try {
          tab.linkedBrowser.reload();
        } catch (ex) { }
      }
    }
  }

}; // end Tabmix.tablib

// Firefox 58 - Bug 1409784 - Remove mStringBundle from tabbrowser binding
// and expose gTabBrowserBundle instead
XPCOMUtils.defineLazyGetter(Tabmix, "getString", () => {
  return typeof gTabBrowserBundle == "object" ?
    gTabBrowserBundle.GetStringFromName.bind(gTabBrowserBundle) :
    gBrowser.mStringBundle.getString.bind(gBrowser.mStringBundle);
});

XPCOMUtils.defineLazyGetter(Tabmix, "getFormattedString", () => {
  return typeof gTabBrowserBundle == "object" ?
    gTabBrowserBundle.formatStringFromName.bind(gTabBrowserBundle) :
    gBrowser.mStringBundle.getFormattedString.bind(gBrowser.mStringBundle);
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
  "chrome://fastdial/content/fastdial.html"
];

Tabmix.isBlankNewTab = function(url) {
  return [
    TabmixSvc.aboutNewtab,
    TabmixSvc.aboutBlank,
  ].includes(url);
};

Tabmix.getOpenTabNextPref = function(aRelatedToCurrent) {
  return (
    Services.prefs.getBoolPref("browser.tabs.insertAfterCurrent") ||
    (Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent") &&
      aRelatedToCurrent)
  );
};
