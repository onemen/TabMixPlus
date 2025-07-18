"use strict";

Tabmix.backwardCompatibilityGetter(window, "tablib", "Tabmix.tablib");

// @ts-expect-error - some methods added internally
Tabmix.tablib = {
  version: "tabmixplus",
  _inited: false,
  init: function tabmix_tablib_init() {
    if (this._inited) {
      return;
    }

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
    for (const tab of tabs.filter(t => t.tagName === "tab")) {
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

    /** @type {MockedGeckoTypes.loadURIFunction} */
    const loadURI_function = function (uri, params) {
      try {
        const tabmixResult = Tabmix.tablib._loadURI(browser, uri, params);
        if (tabmixResult) {
          return tabmixResult;
        }
        // @ts-expect-error uri arg is string for fixupAndLoadURIString and nsIURI for loadURI
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
    var allowLoad = this.isException(
      browser.tabmix_allowLoad !== false || uri.startsWith("javascript:")
    );

    let allowedUrls = [
      "chrome://browser/content/aboutTabGroupsMigration.xhtml",
      "about:sessionRestore",
    ];
    if (!allowLoad && uri == "about:blank" && allowedUrls.indexOf(browser.currentURI.spec) > -1) {
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
    let isBlankTab = (function () {
      // first tab is busy when browser window starts on Firefox 51
      let checkIfBusy = gBrowserInit.delayedStartupFinished || tab._tPos > 0;
      if ((checkIfBusy && tab.hasAttribute("busy")) || tab.hasAttribute("pending")) {
        return false;
      }

      return gBrowser.isBlankBrowser(browser);
    })();
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
    if (loadInCurrent) {
      return loadInCurrent;
    }

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
    if (!isInstalled) {
      return loadInCurrent;
    }

    let stack = Error().stack || Components.stack.caller.formattedStack || "";
    var re = keys.map(key => exceptionList[key]);
    return new RegExp(re.join("|")).test(stack);
  },

  change_gBrowser: function change_gBrowser() {
    Tabmix.originalFunctions.gBrowser_addTab = gBrowser.addTab;

    /** @type {TabBrowser["addTab"]} */
    function addTab(uriString, options = {}, ...rest) {
      let callerTrace = Tabmix.callerTrace(),
        isRestoringTab = callerTrace.contain("ssi_restoreWindow");

      let isPending = options.isPending ?? false;
      // @ts-expect-error options.index was removed in Firefox 140
      let tabIndex = Tabmix.isVersion(1400) ? options.tabIndex : options.index;

      // workaround for bug 1961516
      if (callerTrace.contain("on_TabGroupCollapse") && !options.elementIndex) {
        const group = this.selectedTab.group;
        options.elementIndex =
          group ? group.labelElement.elementIndex + 1 : this.tabs.length + this.tabGroups.length;
      }

      if (
        typeof tabIndex !== "number" &&
        callerTrace.contain("duplicateTabIn", "ssi_restoreWindow")
      ) {
        if (Tabmix.isVersion(1400)) {
          options.tabIndex = this.tabs.length;
        } else {
          // @ts-expect-error options.index was removed in Firefox 140
          options.index = this.tabs.length;
        }
      }

      // prevent SessionStore.duplicateTabIn from opening new tab next to the current
      // tab when our preference is disabled
      if (callerTrace.contain("duplicateTabIn") && callerTrace.contain("ssi_duplicateTab")) {
        let openDuplicateNext = Tabmix.getOpenDuplicateNextPref();
        if (!openDuplicateNext) {
          options.relatedToCurrent = false;
          options.ownerTab = null;
        }
      }

      var t = Tabmix.originalFunctions.gBrowser_addTab.apply(this, [uriString, options, ...rest]);
      if (!Tabmix.prefs.getBoolPref("openTabNextInverse")) {
        this._lastRelatedTabMap = new WeakMap();
      }

      if (
        isPending ||
        (isRestoringTab && Services.prefs.getBoolPref("browser.sessionstore.restore_on_demand"))
      ) {
        t.setAttribute("tabmix_pending", "true");
      }

      return t;
    }
    gBrowser.addTab = addTab;

    if (Tabmix.isVersion(1290)) {
      // this function is triggered by "context_openANewTab" command
      gBrowser.addAdjacentNewTab = function (tab) {
        TMP_BrowserOpenTab({}, tab);
      };
    }

    Tabmix.originalFunctions.gBrowser_removeTab = gBrowser.removeTab;
    gBrowser.removeTab = function (aTab, aParams = {}, ...args) {
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
      if (Tabmix.isVersion(1410)) {
        gBrowser._isLastTabInWindow = Tabmix.getPrivateMethod({
          parent: gBrowser,
          parentName: "gBrowser",
          methodName: "isLastTabInWindow",
          nextMethodName: "_hasBeforeUnload",
        });
      }

      Tabmix.changeCode(gBrowser, "gBrowser._beginRemoveTab")
        ._replace(
          /this\.addTrustedTab\(BROWSER_NEW_TAB_URL,\s*\{\s*skipAnimation:\s*true,[\s\S]*?\}\)/,
          "TMP_BrowserOpenTab({}, null, true)",
          {check: !Tabmix.isVersion({zen: "1.8.1*"})}
        )
        ._replace(/ZenWorkspaces\.selectEmptyTab\([^)]*\);/, "TMP_BrowserOpenTab({}, null, true)", {
          check: Tabmix.isVersion({zen: "1.8.1*"}),
        })
        .toCode();
    }

    Tabmix.changeCode(gBrowser, "gBrowser._endRemoveTab")
      ._replace(
        "this._blurTab(aTab);",
        `if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
         TMP_eventListener.onTabClose_updateTabBar(aTab);
       }
       $&`
      )
      ._replace(
        // we call gURLBar.select from Tabmix.clearUrlBarIfNeeded
        // see TMP_BrowserOpenTab
        "gURLBar.select();",
        "{/* see TMP_BrowserOpenTab */}"
      )
      ._replace(
        "this.tabContainer._updateCloseButtons();",
        `if (!wasPinned) TabmixTabbar.setFirstTabInRow();
        $&`,
        {check: !Tabmix.isVersion(1410)}
      )
      .toCode();

    Tabmix.originalFunctions.gBrowser_findTabToBlurTo = gBrowser._findTabToBlurTo;

    /** @this {MockedGeckoTypes.TabBrowser} */
    gBrowser._findTabToBlurTo = function (aTab, aExcludeTabs) {
      return (
        Tabmix.tabsSelectionUtils.selectTabAfterRemove(aTab, aExcludeTabs) ??
        Tabmix.originalFunctions.gBrowser_findTabToBlurTo.apply(this, [aTab, aExcludeTabs])
      );
    };

    Tabmix.changeCode(gBrowser, "gBrowser.getWindowTitleForBrowser")
      ._replace(
        "if (title) {",
        `let titlePromise;
      if (tab.hasAttribute("tabmix_changed_label")) {
        titlePromise = Promise.resolve(tab.getAttribute("tabmix_changed_label"));
      } else {
        titlePromise = window.TMP_Places.asyncGetTabTitle(tab, aBrowser.currentURI.spec, {title});
      }
      return titlePromise.then(newTitle => {
        title = newTitle;
      $&`
      )
      ._replace(/(})(\)?)$/, "});\$1$2")
      .toCode(false, gBrowser, "asyncGetWindowTitleForBrowser");

    /** @this {MockedGeckoTypes.TabBrowser} */
    gBrowser.updateTitlebar = function () {
      this.asyncGetWindowTitleForBrowser(this.selectedBrowser).then(title => {
        document.title = title;
      });
    };

    if ("foxiFrame" in window) {
      Tabmix.changeCode(gBrowser, "gBrowser.updateTitlebar")
        ._replace("{", "{\ntry {")
        ._replace(/(})(\)?)$/, "} catch (ex) {}\n$1$2")
        .toCode();
    }

    var obj, fnName;
    if (Tabmix.extensions.ieTab2) {
      [obj, fnName] = [Tabmix.originalFunctions, "oldSetTabTitle"];
    } else {
      [obj, fnName] = [gBrowser, "setTabTitle"];
    }
    Tabmix.changeCode(obj, `gBrowser.${fnName}`)
      ._replace(
        /let isContentTitle =[^;]*;/,
        `$&
      let urlTitle;
      if (Tabmix.tablib.getTabTitle(aTab, browser.currentURI.spec)) return false;`,
        {flags: "g"}
      )
      ._replace(
        /title = Services.textToSubURI.unEscapeNonAsciiURI\([^;]*;/,
        `$&
              urlTitle = title;`
      )
      ._replace(
        "return this._setTabLabel",
        `if (aTab.hasAttribute("mergeselected")) title = "(*) " + title;
      const noChange = aTab.label == title;
      if (aTab.hasAttribute("tabmix_changed_label")) {
        aTab.removeAttribute("tabmix_changed_label");
        if (noChange)
          Tabmix.tablib.onTabTitleChanged(aTab, browser, title == urlTitle);
      } else if (noChange) window.TMP_Places.currentTab = null;
      $&`
      )
      ._replace("{ isContentTitle", "{ isContentTitle, urlTitle")
      .toCode();

    Tabmix.originalFunctions.gBrowser_setInitialTabTitle = gBrowser.setInitialTabTitle;
    gBrowser.setInitialTabTitle = function (aTab, ...rest) {
      if (aTab._labelIsInitialTitle && aTab.hasAttribute("tabmix_changed_label")) {
        return;
      }
      Tabmix.originalFunctions.gBrowser_setInitialTabTitle.apply(this, [aTab, ...rest]);
    };

    Tabmix.changeCode(gBrowser, "gBrowser._setTabLabel")
      ._replace("{ beforeTabOpen, isContentTitle", "{ beforeTabOpen, isContentTitle, urlTitle")
      ._replace(
        /aLabel = aLabel\.substring\(0, 500\).*;/,
        `$&
       urlTitle = aLabel;`
      )
      ._replace(
        "return true;",
        ` Tabmix.tablib.onTabTitleChanged(aTab, aTab.linkedBrowser, aLabel == urlTitle);
         $&`
      )
      .toCode();

    if (gMultiProcessBrowser) {
      /*
       TabSwitchDone event fire late when the tab is busy, we call our
       functions from updateDisplay only after _visuallySelected was changed
      */
      Tabmix.updateSwitcher = function (switcher) {
        if (typeof Tabmix.originalFunctions.switcher_updateDisplay != "function") {
          Tabmix.originalFunctions.switcher_updateDisplay = switcher.updateDisplay;
        }

        /** @this {MockedGeckoTypes.TabSwitcher} */
        switcher.updateDisplay = function (...args) {
          let visibleTab = this.visibleTab;
          Tabmix.originalFunctions.switcher_updateDisplay.apply(this, args);
          if (visibleTab !== this.visibleTab) {
            Tabmix.setTabStyle(visibleTab);
            TMP_eventListener.updateDisplay(this.visibleTab);
          }
        };
      };

      Tabmix.changeCode(gBrowser, "gBrowser._getSwitcher")
        ._replace("return this._switcher;", "Tabmix.updateSwitcher(this._switcher);\n    $&")
        .toCode();
    }

    if (!Tabmix.isVersion(1300)) {
      Object.defineProperty(gBrowser, "pinnedTabCount", {
        get: function pinnedTabCount() {
          return gBrowser._numPinnedTabs;
        },
        configurable: true,
      });
    }

    Tabmix.moveTabTo = function (item, options) {
      if (this.isVersion(1380)) {
        gBrowser.moveTabTo(item, options);
      } else {
        const oldOptions =
          this.isVersion(1340) ?
            {forceStandaloneTab: options.forceUngrouped}
          : options.keepRelatedTabs;
        // @ts-ignore - function signature before Firefox 138
        gBrowser.moveTabTo(item, options.elementIndex ?? options.tabIndex, oldOptions);
      }
    };
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
      observer.observe(document.documentElement, {
        attributeFilter: ["inFullscreen", "inDOMFullscreen"],
      });

      if (Tabmix.isVersion(1410)) {
        gBrowser.tabContainer._positionPinnedTabs = () => {
          // not in use since firefox 141, see Tabmix.tabsUtils: positionPinnedTabs, updatefirstTabInRowMargin
        };

        Tabmix.tabsUtils.positionPinnedTabs();
        Tabmix.tabsUtils.updateVerticalTabStrip();
      } else {
        const doPosition = Tabmix.isVersion(1300) ? "absPositionHorizontalTabs" : "doPosition";
        const doPositionRE = new RegExp(`if\\s*\\(\\s*${doPosition}(.*?)\\)\\s\\{`);
        Tabmix.changeCode(tabBar, "gBrowser.tabContainer._positionPinnedTabs")
          ._replace("const doPosition =", "let doPosition =", {
            check: Tabmix.isVersion({fp: "128.0.0"}),
          })
          ._replace(
            `let ${doPosition} =`,
            `let multiRowsPinnedTabs = numPinned > 0 && TabmixTabbar.isMultiRow && Tabmix.tabsUtils.lastPinnedTabRowNumber > 1;
      $& !multiRowsPinnedTabs &&`
          )
          ._replace(
            "this._updateVerticalPinnedTabs();",
            `$&
        absPositionHorizontalTabs = false;`,
            {check: Tabmix.isVersion(1300)}
          )
          ._replace(
            "let layoutData = this._pinnedTabsLayoutCache;",
            `if (typeof this.arrowScrollbox.resetFirstTabInRow == "function")
            this.arrowScrollbox.resetFirstTabInRow();
        $&`
          )
          ._replace(
            "scrollStartOffset:",
            "$& TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT ? 0 :"
          )
          ._replace(
            doPositionRE,
            `if (${doPosition}$1 && TabmixTabbar.isMultiRow && Tabmix.prefs.getBoolPref("pinnedTabScroll")) {
        ${doPosition} = false;
        this.toggleAttribute("positionpinnedtabs", false);
      }
      if (${doPosition}$1 && TabmixTabbar.isMultiRow) {` +
              `
        ${
          Tabmix.isVersion(1190) ?
            'this.toggleAttribute("positionpinnedtabs", true)'
          : 'this.setAttribute("positionpinnedtabs", "true");'
        }
        let layoutData = this._pinnedTabsLayoutCache;
        if (!layoutData) {
          layoutData = { pinnedTabWidth: tabs[0].getBoundingClientRect().width };
          this._pinnedTabsLayoutCache = layoutData;
        }
        let width = this.arrowScrollbox.scrollboxPaddingStart || 0;
        for (let i = 0; i < numPinned; i++) {
          let tab = tabs[i];
          tab.style.setProperty("margin-inline-start", width + "px", "important");
          width += layoutData.pinnedTabWidth;
          tab._pinnedUnscrollable = true;
        }
        if (width != this.arrowScrollbox.firstTabInRowMargin) {
          this.arrowScrollbox.firstTabInRowMargin = width;
          this.arrowScrollbox.firstVisible = { tab: null, x: 0, y: 0 };
          let margin = Tabmix.tabsUtils.protonValues.enabled ? 12 : 0;
          gTMPprefObserver.dynamicRules["tabmix-firstTabInRow"].style.setProperty(
            "margin-inline-start",
            width + margin + "px",
            "important"
          );
        }
        this.style.removeProperty("--tab-overflow-pinned-tabs-width");
        TMP_tabDNDObserver.paddingLeft = Tabmix.getStyle(this, "paddingLeft");
        this.arrowScrollbox.setFirstTabInRow();
      } else $&`
          )
          ._replace(
            "let width = 0;",
            // firefox add a gap between the last pinned tab and the first visible tab
            `let width = TabmixTabbar.scrollButtonsMode !== TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT &&
             Tabmix.tabsUtils.protonValues.enabled ? 12 : 0;`
          )
          ._replace(
            /(})(\)?)$/,
            `  if (TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_MULTIROW) {
        TMP_tabDNDObserver.paddingLeft = parseInt(
          this.style.getPropertyValue("--tab-overflow-pinned-tabs-width") || 0
        );
      }
    $1$2`
          )
          .toCode();
      }
    }

    Tabmix.changeCode(tabBar, "gBrowser.tabContainer._handleNewTab")
      ._replace(
        /(})(\)?)$/,
        `  TMP_eventListener.onTabOpen_delayUpdateTabBar(tab);
    $1$2`
      )
      .toCode();

    Tabmix.changeCode(TabBarVisibility, "TabBarVisibility.update")
      ._replace(
        "if (collapse ==",
        `if (TabmixTabbar.hideMode === 2) {
        collapse = true;
      } else if (!gBrowser || gBrowser.visibleTabs.length == 1) {
        collapse = !window.toolbar.visible || TabmixTabbar.hideMode === 1;
      }
      $&`,
        {check: !Tabmix.isVersion(1330)}
      )
      ._replace(
        "if (nonPopupWithVerticalTabs) {",
        `if (
        nonPopupWithVerticalTabs ||
        TabmixTabbar.hideMode === 2 ||
        (!isPopup &&
          TabmixTabbar.hideMode === 1 &&
          gBrowser.visibleTabs.length === 1)
      ) {`,
        {check: Tabmix.isVersion(1330) && !Tabmix.isVersion(1380)}
      )
      ._replace(
        /let hideTabsToolbar =([^;]*);/,
        `let hideTabsToolbar =
        TabmixTabbar.hideMode === 2 ||
        (!isSingleTabWindow && TabmixTabbar.hideMode === 1 && hasSingleTab) || $1;`,
        {check: Tabmix.isVersion(1380)}
      )
      ._replace(
        /(})(\)?)$/,
        `const bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
      if (bottomToolbox) {
        bottomToolbox.collapsed = ${Tabmix.isVersion(1330) ? "hideTabstrip" : "collapse"};
      }
      $1$2`
      )
      .toCode();

    if (!Tabmix.extensions.verticalTabs) {
      const closingTab = Tabmix.isVersion(1380) ? "aClosingTab" : "aTab";
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._lockTabSizing")
        ._replace(
          "{",
          `{
      if (this.getAttribute("orient") != "horizontal" || !Tabmix.prefs.getBoolPref("lockTabSizingOnClose")) {
        return;
      }`
        )
        ._replace(
          /(var|let) isEndTab =|faviconize.o_lockTabSizing/,
          `  if (${closingTab} && TabmixTabbar.widthFitTitle) {
            let tab = tabs.find(t => t._tPos === ${closingTab}._tPos + 1);
            if (tab && !tab.pinned && !tab.collapsed) {
              let tabWidth = ${closingTab}.getBoundingClientRect().width + "px";
              tab.style.setProperty("width", tabWidth, "important");
              tab.removeAttribute("width");
              this._hasTabTempWidth = true;
              gBrowser.addEventListener("mousemove", this, false);
              window.addEventListener("mouseout", this, false);
            }
            return;
          }
          if (!Tabmix.tabsUtils.isSingleRow(tabs))
            return;
          this._tabDefaultMaxWidth = this.mTabMaxWidth;
          $&`
        )
        .toCode();

      // _expandSpacerBy not exist in Firefox 21
      if (typeof tabBar._expandSpacerBy == "function") {
        Tabmix.changeCode(tabBar, "gBrowser.tabContainer._expandSpacerBy")
          ._replace(
            "{",
            "{if (TabmixTabbar.widthFitTitle || !Tabmix.tabsUtils.isSingleRow()) return;"
          )
          .toCode();
      }

      if (Tabmix.isVersion(1380)) {
        /*
         * Starting Firefox 138, Firefox uses private property #keepTabSizeLocked
         * the property is set to true when dragging tabs by startTabDrag that we
         * don't modify, because it uses other private methids and properties.
         * we use `tab._dragData.expandGroupOnDrop` to initialize the value of
         * our _keepTabSizeLocked in on_dragstart, we reset our _keepTabSizeLocked
         * back to false in on_drop.since #keepTabSizeLocked is never set to false
         * we can not use Tabmix.originalFunctions._unlockTabSizing
         *
         * we set _keepTabSizeLocked before Tabmix.changeCode verifyPrivateMethodReplaced
         *  _unlockTabSizing use #keepTabSizeLocked
         */
        tabBar._keepTabSizeLocked = false;
      }
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._unlockTabSizing")
        ._replace(
          "{",
          `{
      let updateScrollStatus =
        this.hasAttribute("using-closing-tabs-spacer") ||
        this._hasTabTempMaxWidth ||
        this._hasTabTempWidth;`
        )
        ._replace(
          /(})(\)?)$/,
          `  if (this._hasTabTempWidth) {
        this._hasTabTempWidth = false;
        let tabs = Tabmix.visibleTabs.tabs;
        for (let i = 0; i < tabs.length; i++) tabs[i].style.width = "";
      }
      if (updateScrollStatus && this.allTabs.length > 1) {
        TabmixTabbar.updateScrollStatus();
      }
    $1$2`
        )
        .toCode();
    }

    if (!Tabmix.isVersion(1160)) {
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._setPositionalAttributes")
        ._replace(/(})(\)?)$/, "          Tabmix.setTabStyle(gBrowser.selectedTab);\$1$2")
        .toCode();
    }

    Tabmix.originalFunctions.tabContainer_updateCloseButtons =
      gBrowser.tabContainer._updateCloseButtons;

    /** @type {MockedGeckoTypes.TabContainer["_updateCloseButtons"]} */
    gBrowser.tabContainer._updateCloseButtons = function (skipUpdateScrollStatus, aUrl) {
      // modes for close button on tabs - extensions.tabmix.tabs.closeButtons
      // 1 - alltabs    = close buttons on all tabs
      // 2 - hovertab   = close buttons on hover tab
      // 3 - activetab  = close button on active tab only
      // 4 - hoveractive = close buttons on hover and active tabs
      // 5 - alltabs wider then  = close buttons on all tabs wider then

      let oldValue = this.getAttribute("closebuttons");
      var tabs = Tabmix.visibleTabs.tabs;
      var tabsCount = Tabmix.tabsUtils.getTabsCount(tabs.length);
      switch (Tabmix.tabsUtils.closeButtonsEnabled ? this.mCloseButtons : 0) {
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
          Tabmix.originalFunctions.tabContainer_updateCloseButtons.call(
            this,
            skipUpdateScrollStatus,
            aUrl
          );
          break;
      }

      /*
       *  Don't use return in this function
       *  TreeStyleTab add some code at the end
       */
      let transitionend = Tabmix.callerTrace("onxbltransitionend");
      if (tabsCount == 1) {
        let tab = this.selectedItem ?? gBrowser.selectedTab;
        if (!aUrl) {
          let currentURI = gBrowser.currentURI;
          aUrl = currentURI ? currentURI.spec : null;
        }
        // hide the close button if one of this condition is true:
        //   - if "Prevent last tab from closing" is set.
        //   - if "Do not close window when closing last tab" is set and
        //     the tab is blank, about:blank or other new tab.
        if (
          Tabmix.tabsUtils._keepLastTab ||
          (!Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab") &&
            (isBlankPageURL(tab.__newLastTab || null) ||
              ((!aUrl || isBlankPageURL(aUrl)) && gBrowser.isBlankNotBusyTab(tab))))
        ) {
          this.setAttribute("closebuttons", "noclose");
          this.removeAttribute("closebuttons-hover");
        }
      } else if (
        (!skipUpdateScrollStatus && oldValue != this.getAttribute("closebuttons")) ||
        transitionend
      ) {
        TabmixTabbar.updateScrollStatus(transitionend);
      }
    };
  },

  change_utility: function change_utility() {
    // FullScreen code related to tabs bellow content initialize by first
    // fullScreen event, see TMP_eventListener.onFullScreen
    Tabmix.originalFunctions.FullScreen_showNavToolbox = FullScreen.showNavToolbox;
    FullScreen.showNavToolbox = function (...args) {
      let result = Tabmix.originalFunctions.FullScreen_showNavToolbox.apply(this, args);
      TMP_eventListener.showNavToolbox();
      return result;
    };

    Tabmix.changeCode(window, "handleDroppedLink")
      ._replace(
        "let lastLocationChange = gBrowser.selectedBrowser.lastLocationChange;",
        `let tabmixContentDrop = event ? event.tabmixContentDrop : links[0].tabmixContentDrop;
  $&`
      )
      ._replace(
        "replace: true",
        'replace: (tabmixContentDrop || Tabmix.tablib.whereToOpenDrop(event, urls[0])) != "tab"'
      )
      .toCode();
    // update current browser
    gBrowser.selectedBrowser.droppedLinkHandler = handleDroppedLink;

    Tabmix.originalFunctions.duplicateTabIn = window.duplicateTabIn;
    // TreeStyleTab eval of this function use delta

    window.duplicateTabIn = function (aTab, where, delta) {
      if (where == "window" && TabmixSvc.getSingleWindowMode()) {
        where = "tab";
      }
      // we prevent SessionStore.duplicateTab from moving the tab
      // see gBrowser.addTab
      // always set where to 'tabshifted' to prevent original function from
      // selecting the new tab
      const originalWhere = where;
      if (where == "tab") {
        where = "tabshifted";
      }

      if (where == "window") {
        return Tabmix.originalFunctions.duplicateTabIn.apply(this, [aTab, where, delta]);
      }

      let openTabNext = Tabmix.getOpenDuplicateNextPref();
      TMP_extensionsCompatibility.treeStyleTab.openNewTabNext(aTab, openTabNext, true);

      let result = Tabmix.originalFunctions.duplicateTabIn.apply(this, [aTab, where, delta]);

      let newTab = gBrowser.getTabForLastPanel();
      if (openTabNext) {
        let pos = newTab._tPos > aTab._tPos ? 1 : 0;
        Tabmix.moveTabTo(newTab, {tabIndex: aTab._tPos + pos, forceUngrouped: !aTab.group});
      }
      let bgLoad = Tabmix.prefs.getBoolPref("loadDuplicateInBackground");
      let selectNewTab = originalWhere === "tab" ? !bgLoad : bgLoad;
      if (selectNewTab) {
        gBrowser.selectedTab = newTab;
      }

      return result;
    };

    let fnObj = Tabmix.isVersion(1260) ? window.BrowserCommands : window;
    let fnName = Tabmix.isVersion(1260) ? "closeTabOrWindow" : "BrowserCloseTabOrWindow";
    Tabmix.changeCode(fnObj, fnName)
      ._replace(
        "closeWindow(true);", // Mac
        "Tabmix.tablib.closeLastTab();",
        {check: TabmixSvc.isMac, flags: "g"}
      )
      ._replace(/gBrowser.removeCurrentTab\([^;]+;/, "Tabmix.tablib.closeLastTab();")
      .toCode();

    /*
     * don't open link from external application in new window when in single window mode
     * don't open link from external application in current tab if the tab is locked
     *
     * we don't check isUrlForDownload for external links,
     * it is not likely that link in other application opened Firefox for downloading data
     */
    if (Tabmix.isFirstWindowInSession || !Tabmix.isVersion(1370)) {
      const {TabmixBrowserDOMWindow} = ChromeUtils.importESModule(
        "chrome://tabmix-resource/content/BrowserDOMWindow.sys.mjs"
      );
      TabmixBrowserDOMWindow.init(window);
    }

    Tabmix.originalFunctions.FillHistoryMenu = window.FillHistoryMenu;
    if (Tabmix.isVersion(1290)) {
      document
        .getElementById("back-button")
        .childNodes[0]?.removeEventListener("popupshowing", FillHistoryMenu);
      document
        .getElementById("forward-button")
        .childNodes[0]?.removeEventListener("popupshowing", FillHistoryMenu);
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
      document
        .getElementById("back-button")
        .childNodes[0]?.addEventListener("popupshowing", FillHistoryMenu);
      document
        .getElementById("forward-button")
        .childNodes[0]?.addEventListener("popupshowing", FillHistoryMenu);
    }

    if (Tabmix.firstWindowInSession || !Tabmix.isVersion(1380)) {
      const [parent, onDropName] =
        Tabmix.isVersion(1380) ?
          [window.ToolbarDropHandler, "onDropNewWindowButtonObserver"]
          // eslint-disable-next-line no-undef
        : [newWindowButtonObserver, "onDrop"];

      const onDragOverNewWindowButton = parent.onDragOver;
      parent.onDragOver = function (...args) {
        const target = args[0].target;
        if (Tabmix.singleWindowMode && target.id == "new-window-button") {
          if (!target.hasAttribute("disabled")) {
            target.setAttribute("disabled", true);
          }

          return;
        }
        onDragOverNewWindowButton.apply(this, args);
      };

      // @ts-ignore
      const onDropNewWindowButtonObserver = parent[onDropName];
      // @ts-ignore
      parent[onDropName] = function (...args) {
        if (!Tabmix.singleWindowMode) {
          onDropNewWindowButtonObserver.apply(this, args);
        }
      };
    }

    // if user changed mode to single window mode while having closed window
    // make sure that undoCloseWindow will open the closed window in the most recent non-private window
    if (Tabmix.isVersion(1410) && Tabmix.isFirstWindowInSession) {
      const lazy = {};
      const modules = {
        BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
        PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
        SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
        TabMetrics: "moz-src:///browser/components/tabbrowser/TabMetrics.sys.mjs",
      };
      ChromeUtils.defineESModuleGetters(lazy, modules);
      const sandbox = Tabmix.getSandbox(window.SessionWindowUI, {scope: {lazy, Tabmix}});

      Tabmix.changeCode(window.SessionWindowUI, "undoCloseWindow", {sandbox})
        ._replace(
          "restoredWindow = lazy.SessionStore.undoCloseWindow(aIndex || 0);",
          `{if (Tabmix.singleWindowMode) {
            restoredWindow = lazy.BrowserWindowTracker.getTopWindow({private: false});
        }
        if (restoredWindow) {
          restoredWindow.focus();
          let index = aIndex || 0;
          let closedWindows = lazy.SessionStore.getClosedWindowData();
          lazy.SessionStore.forgetClosedWindow(index);
          let state = closedWindows.splice(index, 1).shift();
          state = JSON.stringify({windows: [state]});
          lazy.SessionStore.setWindowState(restoredWindow, state, false);
        }
        else $&}`
        )
        .toCode();

      Tabmix.changeCode(window.SessionWindowUI, "undoCloseTab", {sandbox})
        ._replace(
          /tab\s*=\s*lazy\.SessionStore\.undoCloseTab\([\s\S]*?\);\s*tabsRemoved\s*=\s*true;/,
          `tab = window.TMP_ClosedTabs._undoCloseTab(
                ${Tabmix.isVersion(1170) ? "sourceWindow" : "window"},
                index,
                "original",
                !tab,
                !tab ? undefined : null,
                tabsToRemove.length > 1
              );`
        )
        .toCode();
    }
    if (!Tabmix.isVersion(1410)) {
      Tabmix.changeCode(window, "undoCloseWindow")
        ._replace(
          "window = SessionStore.undoCloseWindow(aIndex || 0);",
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
        )
        .toCode();
    }

    Tabmix.changeCode(HistoryMenu.prototype, "HistoryMenu.prototype.populateUndoSubmenu")
      ._replace('"menuitem"', 'undoPopup.__tagName || "menuitem"')
      ._replace(
        // workaround for bug 1868452 - Key key_undoCloseTab of menuitem could not be found
        "undoPopup.appendChild(tabsFragment);",
        `TMP_ClosedTabs.fix_bug_1868452(tabsFragment.firstChild);
      $&`,
        {check: Tabmix.isVersion(1160)}
      )
      ._replace(
        /(})(\)?)$/,
        `TMP_ClosedTabs.populateUndoSubmenu(undoPopup);
      $1$2`
      )
      .toCode();

    document.getElementById("history-menu").addEventListener(
      "popupshowing",

      /** @param {TabmixPlacesNS.HistoryMenuEvent} event */
      event => TMP_Places.historyMenuItemsTitle(event)
    );

    Tabmix.changeCode(HistoryMenu.prototype, "HistoryMenu.prototype.populateUndoWindowSubmenu")
      ._replace('"menuitem"', 'undoPopup.__tagName || "menuitem"')
      ._replace(/(})(\)?)$/, "Tabmix.tablib.populateUndoWindowSubmenu(undoPopup);\n$1$2")
      .toCode();

    var undoWindowPopup = document.getElementById("historyUndoWindowPopup");
    if (undoWindowPopup) {
      undoWindowPopup.setAttribute("context", "tm_undocloseWindowContextMenu");
    }

    Tabmix.originalFunctions.gURLBar_setURI = gURLBar.setURI;
    gURLBar.setURI = function tabmix_gURLBarsetURI(...args) {
      if (
        Tabmix.selectedTab == gBrowser.selectedTab &&
        Tabmix.userTypedValue &&
        gBrowser.userTypedValue !== ""
      ) {
        gBrowser.userTypedValue = "";
      }
      Tabmix.originalFunctions.gURLBar_setURI.apply(this, args);
    };

    Tabmix.originalFunctions.isBlankPageURL = isBlankPageURL;
    window.isBlankPageURL = function isBlankPageURL(url) {
      return url === "about:newtab" || Tabmix.originalFunctions.isBlankPageURL.apply(null, [url]);
    };

    if (!Tabmix.isVersion(1410)) {
      Tabmix.changeCode(window, "window.undoCloseTab")
        ._replace(
          /tab = SessionStore\.undoCloseTab.*\n.*true;/,
          `tab = TMP_ClosedTabs._undoCloseTab(
              ${Tabmix.isVersion(1170) ? "sourceWindow" : "window"},
              index,
              "original",
              !tab,
              !tab ? undefined : null,
              tabsToRemove.length > 1
            );`
        )
        .toCode();
    }
  },

  populateUndoWindowSubmenu(undoPopup, panel, isAppMenu = Boolean(panel)) {
    const isSubviewbutton = undoPopup.__tagName === "toolbarbutton";
    undoPopup.setAttribute("context", "tm_undocloseWindowContextMenu");
    let undoItems = SessionStore.getClosedWindowData();
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
      m.addEventListener("click", (/** @type {EventType} */ e) =>
        Tabmix.closedObjectsUtils.checkForMiddleClick(e)
      );
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

    Tabmix.closedObjectsUtils.addSeparatorIfMissing(undoPopup);
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
    /** @type {TabmixGlobal["_duplicateTab"]} */
    let duplicateTab = function (aTab, aHref = "", aTabData, disallowSelect, dontFocusUrlBar) {
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      }

      var newTab = null;
      let copyToNewWindow = window != aTab.ownerGlobal;
      let openDuplicateNext =
        !disallowSelect && !copyToNewWindow && Tabmix.prefs.getBoolPref("openDuplicateNext");
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

        /** @type {{state: SessionStoreNS.TabData} | undefined} */
        const tabState = state ? {state} : undefined;
        newTab = this.SSS_duplicateTab(aTab, aHref, tabState);
      }

      if (!newTab && aTabData) {
        throw new Error("Tabmix was unable to restore closed tab to new window");
      }

      // sessionstore duplicateTab failed
      if (!newTab) {
        return null;
      }

      this.selectedBrowser.focus();

      // move new tab to place before we select it
      if (openDuplicateNext) {
        let pos = newTab._tPos > aTab._tPos ? 1 : 0;
        Tabmix.moveTabTo(newTab, {tabIndex: aTab._tPos + pos});
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
      /** @param {{index: number; entries: Partial<AddTabParams>[]}} tabState */
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
              const shEntry = history
                .getEntryAtIndex(history.index)
                .QueryInterface?.(Ci.nsISHEntry);
              if (shEntry) {
                shEntry.title = this.label;
              }
            }
          } else {
            browser.messageManager.sendAsyncMessage("Tabmix:updateHistoryTitle", {
              title: this.label,
            });
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
          browser.loadURI(Services.io.newURI(aHref));
        } catch (ex) {
          Tabmix.assert(ex);
        }
      }
      try {
        const tabState = aTabData ? aTabData.state : JSON.parse(SessionStore.getTabState(aTab));
        newTab = this.addTrustedTab("about:blank", {
          [Tabmix.isVersion(1400) ? "tabIndex" : "index"]: gBrowser.tabs.length,
        });
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
        SessionStore.setTabState(newTab, JSON.stringify(tabState));
      } catch (ex) {
        Tabmix.assert(ex);
      }

      return newTab;
    };

    gBrowser.duplicateTabToWindow = function (aTab, aMoveTab, aTabData) {
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      }

      if (Tabmix.singleWindowMode) {
        if (!aMoveTab) {
          Tabmix.duplicateTab(aTab, "", aTabData);
        }
      } else if (aMoveTab) {
        this.replaceTabWithWindow(aTab);
      } else {
        let otherWin = OpenBrowserWindow();

        /** @type {MockedGeckoTypes.TabBrowser["_delayedStartupFinished"]} */
        let delayedStartupFinished = (subject, topic) => {
          if (topic == "browser-delayed-startup-finished" && subject == otherWin) {
            Services.obs.removeObserver(delayedStartupFinished, topic);
            let otherGBrowser = otherWin.gBrowser;
            let otherTab = otherGBrowser.selectedTab;
            if (aTabData) {
              // restore closed tab to new window
              SessionStore.setTabState(otherTab, aTabData);
            } else {
              SessionStore.duplicateTab(otherWin, aTab);
              otherGBrowser.removeTab(otherTab, {animate: false});
            }
          }
        };

        Services.obs.addObserver(delayedStartupFinished, "browser-delayed-startup-finished");
      }
    };

    /** @param {Tab} contextTab */
    gBrowser.duplicateTabsToWindow = function (contextTab) {
      /** @type {Tabs} */ // @ts-expect-error - tabs are never empty
      const tabs = contextTab.multiselected ? this.selectedTabs : [contextTab];
      this.clearMultiSelectedTabs();

      if (tabs.length === 1) {
        this.duplicateTabToWindow(tabs[0]);
        return;
      }

      let selectedTabIndex = Math.max(0, tabs.indexOf(this.selectedTab));
      let otherWin = OpenBrowserWindow({
        private: PrivateBrowsingUtils.isBrowserPrivate(contextTab.linkedBrowser),
      });

      /** @type {MockedGeckoTypes.TabBrowser["_delayedStartupFinished"]} */
      let delayedStartupFinished = (subject, topic) => {
        if (topic == "browser-delayed-startup-finished" && subject == otherWin) {
          Services.obs.removeObserver(delayedStartupFinished, "browser-delayed-startup-finished");
          let otherGBrowser = otherWin.gBrowser;
          let otherTab = otherGBrowser.selectedTab;

          tabs.forEach((tab, index) => {
            const pending = tab.hasAttribute("pending") || tab.hasAttribute("tabmix_pending");
            const newTab = otherGBrowser.duplicateTab(tab, !pending, {
              inBackground: index !== selectedTabIndex,
              index,
            });
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

      Services.obs.addObserver(delayedStartupFinished, "browser-delayed-startup-finished");
    };

    gBrowser.openLinkWithHistory = function () {
      var url = Tabmix.tablib.getValidUrl();
      if (!url) {
        return;
      }

      urlSecurityCheck(url, gContextMenu.principal);
      Tabmix.duplicateTab(gBrowser.selectedTab, url);
    };

    Tabmix.tablib.openLinkInCurrent = function () {
      var url = Tabmix.tablib.getValidUrl();
      if (!url) {
        return;
      }

      gContextMenu.linkURL = url;
      gBrowser.selectedBrowser.tabmix_allowLoad = true;
      gContextMenu.openLinkInCurrent();
    };

    Tabmix.tablib.getValidUrl = function () {
      if (!gContextMenu) {
        return null;
      }
      let {target, linkURL} = gContextMenu;
      // valid urls don't contain spaces ' '; if we have a space it isn't a valid url.
      // Also disallow dropping javascript: or data: urls--bail out
      /** @param {string} aUrl */
      let isValid = function (aUrl) {
        return aUrl && aUrl.length && !aUrl.includes(" ") && !/^\s*(javascript|data):/.test(aUrl);
      };

      let browser = gBrowser.selectedBrowser;
      if (
        browser.getAttribute("remote") == "true" &&
        typeof gContextMenu.tabmixLinkURL != "undefined"
      ) {
        return gContextMenu.tabmixLinkURL;
      }

      if (!isValid(linkURL)) {
        /** @type {ContentClickModule.ContentClickEvent} */
        let json = {
          button: 0,
          shiftKey: false,
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          // @ts-ignore
          target: {},
          tabmix_openLinkWithHistory: true,
        };
        // we only get here when it is safe to use contentWindowAsCPOW
        // see TabmixContext.updateMainContextMenu
        let result = Tabmix.ContentClick.getParamsForLink(
          json,
          target,
          linkURL,
          browser,
          gBrowser.selectedBrowser._contentWindow
        );
        return result?._href && isValid(result._href) ? result._href : null;
      }
      return linkURL;
    };

    gBrowser.closingTabsEnum.ALL_BY_TABMIX = 100;
    gBrowser.closingTabsEnum.GROUP_BY_TABMIX = 101;
    gBrowser.closeAllTabs = function TMP_closeAllTabs() {
      const tabsToRemove = this.visibleTabs.filter(tab => !tab._isProtected);
      if (!this.warnAboutClosingTabs(tabsToRemove.length, this.closingTabsEnum.ALL_BY_TABMIX)) {
        return;
      }

      if (TabmixTabbar.visibleRows > 1) {
        Tabmix.tabsUtils.updateVerticalTabStrip({reset: true});
      }
      this.removeTabs(tabsToRemove, {suppressWarnAboutClosingWindow: true});
    };

    gBrowser.closeGroupTabs = function TMP_closeGroupTabs(aTab) {
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      }

      var URL = this.getBrowserForTab(aTab).currentURI.spec;
      var matches = URL.match(/(^.*\/)(.*)/);
      var aDomain = matches ? matches[1] : URL;

      const tabsToRemove = this.visibleTabs.filter(
        tab => !tab._isProtected && tab.linkedBrowser.currentURI.spec.includes(aDomain ?? "")
      );
      if (!this.warnAboutClosingTabs(tabsToRemove.length, this.closingTabsEnum.GROUP_BY_TABMIX)) {
        return;
      }

      this.removeTabs(tabsToRemove, {suppressWarnAboutClosingWindow: true});
    };

    gBrowser._reloadLeftTabs = function (aTab) {
      if (Tabmix.ltr) {
        this.reloadLeftTabs(aTab);
      } else {
        this.reloadRightTabs(aTab);
      }
    };

    gBrowser._reloadRightTabs = function (aTab) {
      if (Tabmix.ltr) {
        this.reloadRightTabs(aTab);
      } else {
        this.reloadLeftTabs(aTab);
      }
    };

    gBrowser.reloadLeftTabs = function (aTab) {
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      }

      var childNodes = this.visibleTabs;
      if (aTab._tPos > this._selectedTab._tPos) {
        this.selectedTab = aTab;
      }

      let tabPos = childNodes.indexOf(aTab);
      Tabmix.tablib.reloadTabs(childNodes.slice(0, tabPos).reverse());
    };

    gBrowser.reloadRightTabs = function (aTab) {
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      }

      var childNodes = this.visibleTabs;
      if (aTab._tPos < this._selectedTab._tPos) {
        this.selectedTab = aTab;
      }

      let tabPos = childNodes.indexOf(aTab);
      Tabmix.tablib.reloadTabs(childNodes.slice(tabPos + 1));
    };

    gBrowser.reloadAllTabsBut = function (aTab) {
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      } else {
        this.selectedTab = aTab;
      }
      Tabmix.tablib.reloadTabs(this.visibleTabs, aTab);
    };

    gBrowser.lockTab = function (aTab) {
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      }

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
    };

    gBrowser.protectTab = function (aTab) {
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      }

      if (aTab.hasAttribute("protected")) {
        aTab.removeAttribute("protected");
      } else {
        aTab.setAttribute("protected", "true");
      }
      TabmixSvc.setCustomTabValue(aTab, "protected", aTab.getAttribute("protected"));
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
      }
    };

    gBrowser.freezeTab = function (aTab) {
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      }

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
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
      }
    };

    gBrowser.SelectToMerge = function (aTab) {
      if (Tabmix.singleWindowMode && Tabmix.numberOfWindows() == 1) return;
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      }

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

    gBrowser.copyTabUrl = function (aTab) {
      if (aTab.localName != "tab") {
        aTab = this._selectedTab;
      }

      var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper);

      clipboard.copyString(this.getBrowserForTab(aTab).currentURI.spec);
    };

    gBrowser.stopMouseHoverSelect = function (aTab) {
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

    Tabmix.tablib.warnAboutClosingTabsProps = function (tabsToClose, aCloseTabs) {
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
          if (!protectedTabs.includes(tab) && (onExit || !tab.hidden)) {
            protectedTabs.push(tab);
          }
        }
      }

      // we always restore pinned tabs no need to warn about closing
      if (this.pinnedTabCount && !onExit) {
        addProtected(this.tabContainer.getElementsByAttribute("pinned", true));
      }

      if ("permaTabs" in window) {
        addProtected(this.tabContainer.getElementsByAttribute("isPermaTab", true));
      }
      addProtected(this.tabContainer.getElementsByAttribute("protected", true));

      var numProtected = protectedTabs.length;
      var shouldPrompt = 0;

      /**
       * @type {{0: string; 1: string; 2: string} & {
       *   [key: number]: string;
       * }}
       */
      const prefs = {
        0: "browser.tabs.warnOnCloseOtherTabs",
        1: "extensions.tabmix.protectedtabs.warnOnClose",
        2: "browser.tabs.warnOnClose",
      };
      if (onExit) {
        let openTabs = Tabmix.tabsUtils.getTabsCount(numTabs);
        if (openTabs > 1 && Services.prefs.getBoolPref(prefs[2])) {
          shouldPrompt = 3;
        } else if (numProtected > 0 && Services.prefs.getBoolPref(prefs[1])) {
          shouldPrompt = 2;
        }
      } else if (numTabs > 1) {
        if (Services.prefs.getBoolPref(prefs[0])) {
          shouldPrompt = 1;
        }

        // when we close window with last tab and we don't have protected tabs
        // we need to warn the user with the proper warning
        if (
          Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab") &&
          !Tabmix.prefs.getBoolPref("keepLastTab") &&
          Services.prefs.getBoolPref(prefs[2])
        ) {
          if (aCloseTabs == closing.GROUP_BY_TABMIX) {
            if (tabsToClose == this.tabs.length) {
              shouldPrompt = 3;
            } else if (Services.prefs.getBoolPref(prefs[0])) {
              shouldPrompt = 1;
            } else {
              shouldPrompt = 0;
            }
          } else if (
            aCloseTabs == closing.ALL_BY_TABMIX &&
            numProtected === 0 &&
            numTabs == this.tabs.length
          ) {
            shouldPrompt = 3;
          }
        }
      }

      let keepLastTab = 0;
      if (
        aCloseTabs != closing.ALL &&
        tabsToClose == this.tabs.length &&
        Tabmix.prefs.getBoolPref("keepLastTab")
      ) {
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

    Tabmix.tablib.showClosingTabsPrompt = function (
      shouldPrompt,
      tabsToClose,
      numProtected,
      flags,
      warnOnClose,
      {checkboxLabel2 = "", restoreSession = null} = {}
    ) {
      let warningTitle = "",
        buttonLabel = "",
        chkBoxLabel = "",
        warningText = "";
      if (shouldPrompt === 1) {
        // @ts-expect-error - return types are strings
        [warningTitle, buttonLabel, chkBoxLabel] = gBrowser.tabLocalization.formatValuesSync([
          {
            id: "tabbrowser-confirm-close-tabs-title",
            args: {tabCount: tabsToClose},
          },
          {id: "tabbrowser-confirm-close-tabs-button"},
          {id: `tabbrowser-${Tabmix.isVersion(1350) ? "ask" : "confirm"}-close-tabs-checkbox`},
        ]);
      } else if (numProtected === 0) {
        // @ts-expect-error - return types are strings
        [warningTitle] = gBrowser.tabLocalization.formatValuesSync([
          {
            id: "tabbrowser-confirm-close-tabs-title",
            args: {tabCount: tabsToClose},
          },
        ]);
        buttonLabel = TabmixSvc.getString("closeWindow.label");
        chkBoxLabel = TabmixSvc.getString("window.closeWarning.2");
      } else {
        let messageKey = "protectedtabs.closeWarning.";
        messageKey +=
          numProtected < tabsToClose ? "3"
          : numProtected == 1 ? "1"
          : "2";
        warningTitle = TabmixSvc.getFormattedString(messageKey, [
          String(tabsToClose),
          String(numProtected),
        ]);
        warningText = TabmixSvc.getString("protectedtabs.closeWarning.4");
        buttonLabel = TabmixSvc.getString("closeWindow.label");
        var chkBoxKey =
          shouldPrompt == 3 ? "window.closeWarning.2" : "protectedtabs.closeWarning.5";
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

    Tabmix.tablib.warnAboutClosingTabsProps =
      Tabmix.tablib.warnAboutClosingTabsProps.bind(gBrowser);
    Tabmix.tablib.showClosingTabsPrompt = Tabmix.tablib.showClosingTabsPrompt.bind(gBrowser);

    // remove protected tabs from tabs to remove
    const prefix = Tabmix.isVersion(1350) ? "_" : "";

    Tabmix.changeCode(gBrowser, `gBrowser.${prefix}getTabsToTheStartFrom`)
      ._replace(/return tabsToStart/g, "$&.filter(tab => !tab._isProtected)")
      .toCode();

    Tabmix.changeCode(gBrowser, `gBrowser.${prefix}getTabsToTheEndFrom`)
      ._replace(/return tabsToEnd/g, "$&.filter(tab => !tab._isProtected)")
      .toCode();

    Tabmix.changeCode(gBrowser, "gBrowser.removeAllTabsBut")
      ._replace(/tab\.pinned/g, "tab._isProtected")
      .toCode();

    // Firefox remove selected pinned tabs
    Tabmix.changeCode(gBrowser, "gBrowser.removeMultiSelectedTabs")
      ._replace(
        "let selectedTabs = this.selectedTabs",
        "$&.filter(tab => !tab._isProtected || tab.pinned)"
      )
      .toCode();

    if (Tabmix.isVersion(1270)) {
      Tabmix.changeCode(gBrowser, "gBrowser._removeDuplicateTabs")
        ._replace(
          "if (!this.warnAboutClosingTabs",
          `const tabsCount = tabs.length;
        tabs = tabs.filter(tab => !tab._isProtected);
        const protectedCount = tabsCount - tabs.length;
        $&`
        )
        ._replace("{ l10nArgs:", "{ protectedCount, l10nArgs:")
        .toCode();

      Tabmix.changeCode(window.ConfirmationHint, "ConfirmationHint.show")
        ._replace(
          "const DURATION",
          `if (options.protectedCount) {
           this._panel.classList.add("with-description");
           this._description.hidden = false;
           const description = options.protectedCount === 1 ? "1 duplicate tab is protected" : options.protectedCount + " duplicate tabs are protected";
           this._description.setAttribute("value", description);
         }
         $&`
        )
        .toCode();
    }

    Tabmix.changeCode(gBrowser, "gBrowser.warnAboutClosingTabs")
      ._replace(
        "var shouldPrompt = Services.prefs.getBoolPref(pref);",
        `$&
      let {promptType, numProtected, keepLastTab, prefName} =
        Tabmix.tablib.warnAboutClosingTabsProps(tabsToClose, aCloseTabs);
      if (promptType === 3) aCloseTabs = this.closingTabsEnum.ALL
      tabsToClose -= keepLastTab;
      shouldPrompt = promptType > 0;`
      )
      ._replace(
        /(?<!const )buttonPressed = ps\.confirmEx[^;]*;/,
        "buttonPressed = Tabmix.tablib.showClosingTabsPrompt(promptType, tabsToClose, numProtected, flags, warnOnClose);"
      )
      ._replace(
        /(?<!const )buttonPressed = ps\.confirmEx2[^;]*;/,
        "buttonPressed = Tabmix.tablib.showClosingTabsPrompt(promptType, tabsToClose, numProtected, flags, warnOnClose, {checkboxLabel2,  restoreSession});",
        {check: Tabmix.isVersion({wf: "115.13.0"})}
      )
      ._replace("aCloseTabs == this.closingTabsEnum.ALL &&", "")
      ._replace(
        "Services.prefs.setBoolPref(pref, false);",
        "Services.prefs.setBoolPref(prefName, false);"
      )
      .toCode();

    /** @this {MockedGeckoTypes.TabBrowser} */
    gBrowser.TMP_selectNewForegroundTab = function (aTab, aLoadInBackground, aUrl, addOwner) {
      var bgLoad =
        typeof aLoadInBackground == "boolean" ? aLoadInBackground : (
          Services.prefs.getBoolPref("browser.tabs.loadInBackground")
        );
      if (!bgLoad) {
        // set new tab owner
        addOwner = typeof addOwner == "boolean" ? addOwner : true;
        if (addOwner) {
          aTab.owner = this.selectedTab;
        }

        this.selectedTab = aTab;
        if (aUrl && Tabmix.isNewTabUrls(aUrl)) {
          Tabmix.tablib.setURLBarFocus();
        }
      }
    };

    // Bug 752376 - Avoid calling scrollbox.ensureElementIsVisible()
    // if the tab strip doesn't overflow to prevent layout flushes
    gBrowser.ensureTabIsVisible = function tabmix_ensureTabIsVisible(aTab, aSmoothScroll) {
      if (Tabmix.tabsUtils.overflow) {
        this.tabContainer.arrowScrollbox.ensureElementIsVisible(aTab, !aSmoothScroll);
      }
    };

    /* DEPRECATED */
    // we keep this function to stay compatible with other extensions that use it
    gBrowser.undoRemoveTab = () => Tabmix.undoCloseTab();
    // Tabmix don't use this function anymore
    // but treeStyleTab extension look for it
    gBrowser.restoreTab = function () {};
    gBrowser.closeTab = aTab => gBrowser.removeTab(aTab);
    gBrowser.renameTab = aTab => Tabmix.renameTab.editTitle(aTab);
  },

  tabEpochs: new WeakMap(),
  getTabTitle: function TMP_getTabTitle(aTab, url) {
    if (aTab?._tabmixState?.noBookmart) {
      aTab._tabmixState = {};
      return false;
    }
    // return the current tab only if it is visible
    if (TabmixTabbar.widthFitTitle && (!TMP_Places.inUpdateBatch || !TMP_Places.currentTab)) {
      let tab = gBrowser.selectedTab;
      if (Tabmix.tabsUtils.isElementVisible(tab)) {
        TMP_Places.currentTab = tab;
      }
    }

    const newEpoch = (this.tabEpochs.get(aTab) ?? -1) + 1;
    this.tabEpochs.set(aTab, newEpoch);
    TMP_Places.asyncSetTabTitle(aTab, {url}).then(foundTitle => {
      if (!foundTitle && aTab.linkedBrowser) {
        const currentEpoch = this.tabEpochs.get(aTab);
        if (currentEpoch === newEpoch) {
          // call setTabTile again to get the default title
          aTab._tabmixState = {noBookmart: true};
          gBrowser.setTabTitle(aTab);
        }
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
    if (!TabmixTabbar.widthFitTitle || (isUrlTitle && aTab.hasAttribute("width"))) {
      return;
    }

    if (
      aBrowser.getAttribute("remote") == "true" &&
      aTab._restoreState == 2 &&
      this.labels.indexOf(aTab.label) > -1
    ) {
      return;
    }

    if (aTab.hasAttribute("width") && !aTab.hasAttribute("faviconized")) {
      const {width} = aTab.getBoundingClientRect();
      aTab.removeAttribute("width");
      if (width != aTab.getBoundingClientRect().width) {
        TMP_Places.afterTabTitleChanged(false);
      }
    } else if (aTab.hasAttribute("fadein")) {
      TMP_Places.afterTabTitleChanged(false);
    }
    // don't keep unnecessary reference to current tab
    if (!TMP_Places.inUpdateBatch) {
      TMP_Places.currentTab = null;
    }
  },

  closeLastTab: function TMP_closeLastTab() {
    if (TabmixSvc.isMac && window.location.href != AppConstants.BROWSER_CHROME_URL) {
      closeWindow(true);
      return;
    }
    if (
      gBrowser.tabs.length > 1 ||
      !Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab")
    ) {
      gBrowser.removeCurrentTab({animate: true});
    } else {
      closeWindow(true);
    }
  },

  whereToOpenDrop(aEvent, aUri) {
    if (!aEvent) {
      return "current";
    }
    let browser = gBrowser.selectedBrowser;
    let where = "current";
    if (aUri != browser.currentURI.spec) {
      let tab = gBrowser._selectedTab;
      let isCopy =
        "dataTransfer" in aEvent ?
          aEvent.dataTransfer.dropEffect === "copy"
        : aEvent.ctrlKey || aEvent.metaKey;
      if (
        !isCopy &&
        tab.getAttribute("locked") &&
        !gBrowser.isBlankNotBusyTab(tab) &&
        !Tabmix.ContentClick.isUrlForDownload(aUri)
      ) {
        where = "tab";
      }
    }
    if (where == "current") {
      browser.tabmix_allowLoad = true;
    }
    return where;
  },

  setURLBarFocus: function TMP_setURLBarFocus() {},

  reloadTabs(tabs, skipTab) {
    for (const tab of tabs) {
      if (tab != skipTab && tab._restoreState != 2) {
        try {
          tab.linkedBrowser.reload();
        } catch {}
      }
    }
  },
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
  TabmixSvc.aboutNewtab,
  TabmixSvc.aboutBlank,
  "about:privatebrowsing",
  "chrome://abouttab/content/text.html",
  "chrome://abouttab/content/tab.html",
  "chrome://google-toolbar/content/new-tab.html",
  "chrome://fastdial/content/fastdial.html",
  "chrome://browser/content/blanktab.html",
];

Tabmix.isBlankNewTab = function (url) {
  return [
    TabmixSvc.aboutNewtab,
    TabmixSvc.aboutBlank,
    "chrome://browser/content/blanktab.html",
  ].includes(url);
};

Tabmix.getOpenTabNextPref = function (aRelatedToCurrent = false) {
  return (
    Services.prefs.getBoolPref("browser.tabs.insertAfterCurrent") ||
    (Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent") && aRelatedToCurrent)
  );
};

Tabmix.getOpenDuplicateNextPref = function () {
  let names =
    Tabmix.isVersion(1260) ?
      ["gotoHistoryIndex", "forward", "back"]
    : ["gotoHistoryIndex", "BrowserForward", "BrowserBack"];
  let pref =
    Tabmix.callerTrace(...names) ?
      "browser.tabs.insertAfterCurrent"
    : "extensions.tabmix.openDuplicateNext";
  return Services.prefs.getBoolPref(pref);
};

Tabmix.getOpenDuplicateNextPref = function () {
  let names =
    Tabmix.isVersion(1260) ?
      ["gotoHistoryIndex", "forward", "back"]
    : ["gotoHistoryIndex", "BrowserForward", "BrowserBack"];
  let pref =
    Tabmix.callerTrace(...names) ?
      "browser.tabs.insertAfterCurrent"
    : "extensions.tabmix.openDuplicateNext";
  return Services.prefs.getBoolPref(pref);
};

Tabmix.undoCloseTab = function (index, sourceWindow) {
  if (!Tabmix.isVersion(1410)) {
    return undoCloseTab(index, sourceWindow);
  }

  return window.SessionWindowUI.undoCloseTab(window, index, sourceWindow);
};

/**
 * Utility service for tab selection and tracking tab history
 *
 * @type {TabmixGlobal["tabsSelectionUtils"]}
 */
Tabmix.tabsSelectionUtils = {
  //
  /** WeakMap to store tab opening order */
  _tabOrderMap: new WeakMap(),

  /** Counter for assigning sequential IDs to tabs */
  _counter: 1,

  init() {
    // Track existing tabs
    for (const tab of gBrowser.tabs) {
      this.trackTab(tab);
    }

    /** @typedef {TabmixEventListenerNS.TabEvent} TabEvent */

    gBrowser.tabContainer.addEventListener("TabOpen", (/** @type {TabEvent} */ event) => {
      this.trackTab(event.target);
    });

    // Clean up when tabs are closed
    gBrowser.tabContainer.addEventListener("TabClose", (/** @type {TabEvent} */ event) => {
      this.removeTab(event.target);
    });
  },

  /** Track a new tab by assigning it an order number */
  trackTab(tab) {
    if (!this._tabOrderMap.has(tab.tabmixKey)) {
      this._tabOrderMap.set(tab.tabmixKey, ++this._counter);
    }
  },

  /** Get the order number for a tab */
  getTabOrder(tab) {
    return this._tabOrderMap.get(tab.tabmixKey);
  },

  /** Find the most recently opened tab from a list of tabs */
  getLastOpenedTab(tabs) {
    if (!tabs || !tabs.length) {
      return null;
    }

    let lastOpenedTab = null;
    let maxOrder = -1;

    for (const tab of tabs) {
      const order = this.getTabOrder(tab);
      if (order !== undefined && order > maxOrder) {
        maxOrder = order;
        lastOpenedTab = tab;
      }
    }

    return lastOpenedTab;
  },

  /** Remove a tab from tracking when it's closed */
  removeTab(tab) {
    this._tabOrderMap.delete(tab.tabmixKey);
  },

  /** Get the previously selected tab */
  getPreviousSelectedTab(aTab) {
    if (!aTab) {
      return null;
    }

    // Get all tabs with tabmix_selectedID that are visible and not closing
    const selectedTabs = Array.from(
      gBrowser.tabContainer.querySelectorAll("[tabmix_selectedID]")
    ).filter(tab => !tab.hidden && !tab.closing && tab !== aTab);

    // Find the tab with highest tabmix_selectedID that isn't the provided tab
    let maxId = 0;
    let previousTab = null;

    for (const tab of selectedTabs) {
      const selectedId = parseInt(tab.getAttribute("tabmix_selectedID") || "0");
      if (selectedId > maxId) {
        maxId = selectedId;
        previousTab = tab;
      }
    }

    // when previous selected tab is in collapsed group return null to fall
    // back to default - select the next visible tab
    return previousTab?.group?.collapsed ? null : previousTab;
  },

  /** Select previously selected tab in sequence */
  selectPreviousTab(aTab) {
    const tabs = gBrowser.visibleTabs;
    if (tabs.length == 1) {
      return;
    }

    const previousTab = this.getPreviousSelectedTab(aTab);

    if (previousTab) {
      gBrowser.selectedTab = previousTab;
    } else {
      // If no tabmix_selectedID, go to previous tab
      // From first tab go to the next tab
      // @ts-expect-error - visibleTabs.next is a Tab when tabs.length > 1
      gBrowser.selectedTab =
        aTab == tabs[0] ? Tabmix.visibleTabs.next(aTab) : Tabmix.visibleTabs.previous(aTab);
    }

    gBrowser.selectedBrowser.focus();
  },

  /*
   * Use Tab Mix preferences to determine which tab to select after removal.
   * If no matching tab is found based on the preference, return null to let
   * Firefox handle the default behavior.
   */
  selectTabAfterRemove(aTab, aExcludeTabs = []) {
    if (!aTab.selected) {
      return null;
    }
    if (FirefoxViewHandler.tab) {
      aExcludeTabs.push(FirefoxViewHandler.tab);
    }

    const excludeTabs = new Set(aExcludeTabs);

    // Get visible tabs and filter out the tab being closed for compatibility with
    // Firefox versions before 138
    const tabs = gBrowser.visibleTabs.filter(tab => tab !== aTab && !excludeTabs.has(tab));
    // If there are no visible tabs, return null
    if (tabs.length === 0) {
      return null;
    }

    const selectedPos = gBrowser._selectedTab._tPos;

    // Find the first visible tab before and after the selected position
    const getVisibleTabBefore = () =>
      tabs
        .slice()
        .reverse()
        .find(tab => tab._tPos < selectedPos) ?? null;
    const getVisibleTabAfter = () => tabs.find(tab => tab._tPos > selectedPos) ?? null;

    const mode = Tabmix.prefs.getIntPref("focusTab");
    switch (mode) {
      case 0: // first tab
        return tabs[0] ?? null;

      case 1: // left tab
        return getVisibleTabBefore() ?? getVisibleTabAfter();

      case 3: // last tab
        return tabs.at(-1) ?? null;

      case 6: // last opened
        // Use the tab order service to find the most recently opened tab
        // or return null to use Firefox default
        return this.getLastOpenedTab(tabs);

      case 4: // last selected
        // if we don't find last selected we fall back to default
        return this.getPreviousSelectedTab(aTab);

      /* falls through */
      case 5: // right tab
        return getVisibleTabAfter() ?? getVisibleTabBefore();
    }

    // Let Firefox handle the default case
    return null;
  },
};
