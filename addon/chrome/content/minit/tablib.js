"use strict";

if (!window.tablib || tablib.version != "tabmixplus")
var tablib = {
  version : "tabmixplus",
  _inited: false,
  init : function TMP_tablib_init () {
    if (this._inited)
      return;
    this._inited = true;
    this.change_gBrowser();
    this.change_tabContainer();
    this.change_utility();
    this.addNewFunctionsTo_gBrowser();
  },

  _loadURIWithFlagsinitialized: false,
  setLoadURIWithFlags: function tablib_setLoadURIWithFlags(aBrowser) {
    // set init value according to lockallTabs state
    // we update this value in TabmixProgressListener.listener.onStateChange
    aBrowser.tabmix_allowLoad = !TabmixTabbar.lockallTabs;

    // Bug 1075658 - Enable remaining session store tests that are disabled in e10s.
    // added _loadURIWithFlags to browser.js (Firefox 36+)
    var obj, name;
    if (Tabmix.isVersion(360)) {
      if (this._loadURIWithFlagsinitialized)
        return;
      this._loadURIWithFlagsinitialized = true;
      [obj, name] = [window, "window._loadURIWithFlags"];
    }
    else
      [obj, name] = [aBrowser, "browser.loadURIWithFlags"];
    Tabmix.changeCode(obj, name)._replace(
      '{',
      '$&\n' +
      '  let args = Array.slice(arguments);\n' +
      '  if (!Tabmix.isVersion(360))\n' +
      '    args.unshift(this);\n' +
      '  var tabmixResult = tablib._loadURIWithFlags.apply(null, args);\n' +
      '  if (tabmixResult)\n' +
      '    return tabmixResult;\n'
    )._replace(
      /(\})(\)?)$/,
      '  return null;\n' +
      '$1$2'
    )._replace(
      'this.webNavigation.LOAD_FLAGS_FROM_EXTERNAL',
      'Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL',
      {check: !Tabmix.isVersion(360) && ("loadTabsProgressively" in window)}
    ).toCode();
  },

  _loadURIWithFlags: function(browser, uri, params) {
    let flags;
    if (!Tabmix.isVersion(380)) {
      flags = params;
      params = {
        referrerURI: arguments[3] || null,
        charset: arguments[4] || null,
        postdata: arguments[5] || null,
      };
    }
    else
      flags = params.flags;

    var tab = gBrowser.getTabForBrowser(browser);
    if (!tab) {
      browser.tabmix_allowLoad = true;
      return null;
    }
    var allowLoad = tablib.isException(browser.tabmix_allowLoad !== false ||
                                       uri.match(/^javascript:/));
    if (!allowLoad) {
      try {
        let newURI = Services.io.newURI(uri, null, null);
        allowLoad = browser.currentURI.equalsExceptRef(newURI);
      } catch (ex) {}
    }
    var isBlankTab = gBrowser.isBlankNotBusyTab(tab);
    var isLockedTab = tab.hasAttribute("locked");
    if (!allowLoad && !isBlankTab && isLockedTab) {
      let isFlaged = function(flag) !!(flags & Ci.nsIWebNavigation[flag]);
      params.inBackground = false;
      params.allowThirdPartyFixup = isFlaged("LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP");
      params.fromExternal = isFlaged("LOAD_FLAGS_FROM_EXTERNAL");
      params.allowMixedContent = isFlaged("LOAD_FLAGS_ALLOW_MIXED_CONTENT");
      return gBrowser.loadOneTab(uri, params);
    }
    browser.tabmix_allowLoad = uri == TabmixSvc.aboutBlank || !isLockedTab;
    return null;
  },

  /**
   * check if we need to override our preference and force to load the url in
   * the current tab
   *
   * current code only check if the caller is in the exception list
   */
  isException: function(loadInCurrent) {
    if (loadInCurrent)
      return loadInCurrent;

    let exceptionList = {
      // secureLogin extension expect to execute the login in the current page
      // https://addons.mozilla.org/en-us/firefox/addon/secure-login/?src=ss
      secureLogin: "secureLogin.login"
    };
    let keys = Object.keys(exceptionList);
    let isInstalled = keys.some(function(item) {
      return typeof window[item] == "object";
    });
    if (!isInstalled)
      return loadInCurrent;

    let stack = Error().stack || Components.stack.caller.formattedStack || "";
    var re = keys.map(function(key) exceptionList[key]);
    return new RegExp(re.join("|")).test(stack);
  },

  change_gBrowser: function change_gBrowser() {
    var obj, fnName;
    if (typeof Fd == "object" && typeof Fd.addTab == "function")
      [obj, fnName] = [Fd, "Fd.addTab"];
    else if (Tabmix.extensions.ieTab2)
      [obj, fnName] = [Tabmix.originalFunctions, "oldAddTab"];
    // NRA-ILA toolbar extension raplce the original addTab function
    else if ("origAddTab7c3de167ed6f494aa652f11a71ecb40c" in gBrowser) {
      [obj, fnName] = [gBrowser, "origAddTab7c3de167ed6f494aa652f11a71ecb40c"];
    }
    else
      [obj, fnName] = [gBrowser, "addTab"];

    Tabmix.changeCode(obj, "gBrowser." + fnName)._replace(
      '{','{\n\
      let dontMove, isPending, isRestoringTab = Tabmix.callerName() == "ssi_restoreWindow";\n'
    )._replace(
      'let params = arguments[1];',
      '$&\n' +
      '              params = tablib.definedParams(params);\n' +
      '              dontMove              = params.dontMove;\n' +
      '              isPending             = params.isPending;'
    )._replace(
      't.setAttribute("label", aURI);',
      't.setAttribute("label", TabmixTabbar.widthFitTitle && !aURI.startsWith("about") ?\n' +
      '                              this.mStringBundle.getString("tabs.connecting") : aURI);',
      {check: !Tabmix.isVersion(280)}
    )._replace(
      't.className = "tabbrowser-tab";',
      '$&\
       t.setAttribute("last-tab", "true"); \
       if (isPending || isRestoringTab && Services.prefs.getBoolPref("browser.sessionstore.restore_on_demand")) \
         t.setAttribute("tabmix_pending", "true"); \
       var lastChild = this.tabContainer.lastChild; \
       if (lastChild) lastChild.removeAttribute("last-tab");'
    )._replace(
      'this._lastRelatedTab = t;',
      'if (Tabmix.prefs.getBoolPref("openTabNextInverse")) {\
         TMP_LastTab.attachTab(t, _lastRelatedTab);\
         $&\
       }'
    )._replace(
      'this.selectedTab)._tPos + 1', '_selectedTab)._tPos + 1'
    )._replace(
      /*
        replace Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent")
        before we use it in the next section.
      */
      'Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent")',
      'openTabnext'
    )._replace(
      't.dispatchEvent(evt);',
      'var _selectedTab = this.selectedTab;' +
      'var _lastRelatedTab = this._lastRelatedTab;' +
      't.dispatchEvent(evt);' +
      'var openTabnext = Tabmix.prefs.getBoolPref("openTabNext");' +
      'if (openTabnext) {' +
      '  if (dontMove || Tabmix.isCallerInList(this.TMP_blockedCallers))' +
      '    openTabnext = false;' +
      '  else if (!Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent"))' +
      '    aRelatedToCurrent = true;' +
      '}'
    )._replace( //  new tab can trigger selection change by some extensions (divX HiQ)
      't.owner = this.selectedTab;', 't.owner = _selectedTab;'
    ).toCode();

    gBrowser.TMP_blockedCallers = ["sss_restoreWindow", "ssi_restoreWindow", // ssi_restoreWindow from Firefox 16+
                                   "sss_duplicateTab", "ssi_duplicateTab"]; // ssi_duplicateTab from Firefox 16+


    // ContextMenu Extensions raplce the original removeTab function
    var _removeTab = "removeTab";
    if ("__ctxextensions__removeTab" in gBrowser)
      _removeTab = "__ctxextensions__removeTab";

    // we add compatibility fix for tabGroupManager here
    // so we don't have to work on the same function twice.
    Tabmix.changeCode(gBrowser, "gBrowser." + _removeTab)._replace(
      '{',
      '{\n' +
       '            if (aTab.hasAttribute("protected"))\n' +
       '              return;\n' +
       '            let lastTabInGroup = this.visibleTabs.length == 1;\n' +
       '            if (lastTabInGroup && Tabmix.prefs.getBoolPref("keepLastTab"))\n' +
       '              return;\n' +
       '            if ("clearTimeouts" in aTab)\n' +
       '              aTab.clearTimeouts();'
    )._replace(
      // fix bug in TGM when closeing last tab in a group with animation
      'if (aParams)',
      'if (lastTabInGroup) {aParams ? aParams.animate = false : aParams = {animate: false}};\
       $&', {check: Tabmix.extensions.tabGroupManager}
    ).toCode();

    // changed by bug #563337
    if (!Tabmix.extensions.tabGroupManager) {
      let aboutBlank = 'this.addTab("about:blank", {skipAnimation: true})';
      let aboutNewtab = 'this.addTab(BROWSER_NEW_TAB_URL, {skipAnimation: true})';
      let code = gBrowser._beginRemoveTab.toString().indexOf(aboutNewtab) > -1 ?
                 aboutNewtab : aboutBlank;
      Tabmix.changeCode(gBrowser, "gBrowser._beginRemoveTab")._replace(
        code, 'TMP_BrowserOpenTab(null, true)'
      ).toCode();
    }

    Tabmix.changeCode(gBrowser, "gBrowser._endRemoveTab")._replace(
      'this._blurTab(aTab);',
      'tablib.onRemoveTab(aTab); \
       if (Services.prefs.getBoolPref("browser.tabs.animate")) { \
         TMP_eventListener.onTabClose_updateTabBar(aTab);\
       } \
       $&'
    )._replace(
      // we call focusAndSelectUrlBar from Tabmix.clearUrlBar
      // see TMP_BrowserOpenTab
      'focusAndSelectUrlBar();',
      '{/* see TMP_BrowserOpenTab */}'
    )._replace(
      'this.tabContainer.adjustTabstrip();',
      'if (!wasPinned) TabmixTabbar.setFirstTabInRow();\
       $&'
    ).toCode();

    Tabmix.changeCode(gBrowser, "gBrowser._blurTab")._replace(
      'if (aTab.owner &&',
      'if (false &&'
    )._replace(
      'var tab = aTab;',
      'var tab, newIndex = this.selectIndexAfterRemove(aTab);\
       if (newIndex > -1) {\
         let tabs = TMP_TabView.currentGroup();\
         tab = tabs[newIndex];\
         if (tab && !tab.closing) {\
           this.selectedTab = tab;\
           return;\
         }\
       }\
       tab = aTab;'
    ).toCode();

    Tabmix.changeCode(gBrowser, "gBrowser.getWindowTitleForBrowser")._replace(
      'if (!docTitle)',
      'let tab = this.getTabForBrowser(aBrowser);\
       if (tab.hasAttribute("tabmix_changed_label"))\
         docTitle = tab.getAttribute("tabmix_changed_label");\
       else\
         docTitle = TMP_Places.getTabTitle(tab, aBrowser.currentURI.spec, docTitle);\
       $&'
    ).toCode();

    if ("foxiFrame" in window) {
      Tabmix.changeCode(gBrowser, "gBrowser.updateTitlebar")._replace(
        '{',
        '{try {'
      )._replace(
        /(\})(\)?)$/,
        '} catch (ex) {} \
         $1$2'
      ).toCode();
    }

    if (Tabmix.extensions.ieTab2)
      [obj, fnName] = [Tabmix.originalFunctions, "oldSetTabTitle"];
    else
      [obj, fnName] = [gBrowser, "setTabTitle"];
    Tabmix.changeCode(obj, "gBrowser." + fnName)._replace(
      'var title = browser.contentTitle;',
      '$&\
       var urlTitle, title = tablib.getTabTitle(aTab, browser.currentURI.spec, title);'
    )._replace(
      'title = textToSubURI.unEscapeNonAsciiURI(characterSet, title);',
      '$&\
      urlTitle = title;'
    )._replace(
      'if (aTab.label == title',
      'if (aTab.hasAttribute("mergeselected"))\
         title = "(*) " + title;\
       var noChange = aTab.label == title && aTab.crop == crop;\
       if (aTab.hasAttribute("tabmix_changed_label")) {\
         aTab.removeAttribute("tabmix_changed_label");\
         if (noChange)\
           tablib.onTabTitleChanged(aTab, title == urlTitle);\
       }\
       else if (noChange)\
         TMP_Places.currentTab = null;\
       $&'
    )._replace(
      'aTab.crop = crop;',
      '$&\
       tablib.onTabTitleChanged(aTab, title == urlTitle);'
    ).toCode();

    // after bug 347930 - change Tab strip to be a toolbar
    Tabmix.changeCode(gBrowser, "gBrowser.setStripVisibilityTo")._replace(
      'this.tabContainer.visible = aShow;',
      'if (!aShow || TabmixTabbar.hideMode != 2) $&'
    ).toCode();

    // Follow up bug 887515 - add ability to restore multiple tabs
    // bug 914258 backout 887515 changes from Firefox 25
    if (Tabmix._restoreMultipleTabs) {
      Tabmix.changeCode(gBrowser, "gBrowser.removeTabsToTheEndFrom")._replace(
        'let tabs = this.getTabsToTheEndFrom(aTab);',
        '$&\n'+
        '              Tabmix.startCountingClosedTabs();'
      )._replace(
        '#1.setNumberOfTabsClosedLast(window, numberOfTabsToClose);'.
         replace("#1", Tabmix.isVersion(260) ? "SessionStore" : "ss"),
        'Tabmix.setNumberOfTabsClosedLast();'
      ).toCode();
    }

    if (Tabmix.isVersion(390) && gMultiProcessBrowser) {
      /*
       TabSwitchDone event fire late when the tab is busy, we call our
       functions from updateDisplay only after _visuallySelected was changed
      */
      Tabmix.updateSwitcher = function(switcher) {
        switcher.original_updateDisplay = switcher.updateDisplay;
        switcher.updateDisplay = function() {
          let visibleTab = this.visibleTab;
          this.original_updateDisplay.apply(this, arguments);
          if (visibleTab !== this.visibleTab) {
            TMP_eventListener.updateDisplay(this.visibleTab);
            TabmixTabbar.updateBeforeAndAfter();
          }
        };
      };

      Tabmix.changeCode(gBrowser, "gBrowser._getSwitcher")._replace(
        'this._switcher = switcher;',
        'Tabmix.updateSwitcher(switcher);\n' +
        '$&'
      ).toCode();
    }
  },

  change_tabContainer: function change_tabContainer() {
    let tabBar = gBrowser.tabContainer;
    Tabmix.changeCode(tabBar, "gBrowser.tabContainer.handleEvent")._replace(
      'this.adjustTabstrip',
      'TabmixTabbar._handleResize(); \
       $&'
    ).toCode();

    if (!Tabmix.extensions.verticalTabs) {
      let $LF = '\n          ';
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._positionPinnedTabs")._replace(
        'this.removeAttribute("positionpinnedtabs");',
        'if (typeof this.mTabstrip.resetFirstTabInRow == "function")\
           this.mTabstrip.resetFirstTabInRow();\
         $&'
      )._replace(
        /this.mTabstrip._scrollButtonDown.(scrollWidth|getBoundingClientRect\(\).width)/,
        'TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT ? 0 : $&'
      )._replace(
        'if (doPosition)',
        'if (doPosition && TabmixTabbar.isMultiRow &&' + $LF +
        '    Tabmix.prefs.getBoolPref("pinnedTabScroll")) {' + $LF +
        '  doPosition = false;' + $LF +
        '}' + $LF +
        '  if (doPosition && TabmixTabbar.isMultiRow) {' +
        '    this.setAttribute("positionpinnedtabs", "true");' +
        '    let width = TabmixSvc.australis ? 0 : this.mTabstrip.scrollboxPaddingStart;' +
        '    for (let i = 0; i < numPinned; i++) {' +
        '      let tab = this.childNodes[i];' +
        '      tab.style.MozMarginStart = width + "px";' +
        '      width += tab.getBoundingClientRect().width;' +
        '    }' +
        '    if (width != this.mTabstrip.firstTabInRowMargin) {' +
        '      this.mTabstrip.firstTabInRowMargin = width;' +
        '      this.mTabstrip.firstVisible =  {tab: null, x: 0, y: 0};' +
        '      gTMPprefObserver.dynamicRules["tabmix-firstTabInRow"]' +
        '        .style.setProperty("-moz-margin-start", width + "px", null);' +
        '    }' +
        '    this.style.MozPaddingStart = "";' +
        '    TMP_tabDNDObserver.paddingLeft = Tabmix.getStyle(this, "paddingLeft");' +
        '    this.mTabstrip.setFirstTabInRow();' +
        '  }' +
        '  else $&'
      )._replace(
        /(\})(\)?)$/,
        'if (TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_MULTIROW) {' +
        '  TMP_tabDNDObserver.paddingLeft = parseInt(this.style.MozPaddingStart || 0);' +
        '}' +
        '$1$2'
      ).toCode();
    }

    Tabmix.changeCode(tabBar, "gBrowser.tabContainer._handleNewTab")._replace(
      /(\})(\)?)$/,
      'TMP_eventListener.onTabOpen_delayUpdateTabBar(tab); \
       $1$2'
    ).toCode();

    // we use our own preferences observer
    if (!Tabmix.isVersion(310))
    Tabmix.changeCode(tabBar._prefObserver, "gBrowser.tabContainer._prefObserver.observe")._replace(
      'this.tabContainer.mCloseButtons = Services.prefs.getIntPref(data);',
      'break;'
    )._replace(
      'this.tabContainer.updateVisibility();',  '', {check: !Tabmix.isVersion(230)}
    ).toCode();


    if (Tabmix.isVersion(230)) {
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer.updateVisibility")._replace(
        'window.toolbar.visible',
        '$& && TabmixTabbar.hideMode == 0'
      ).toCode();
    }

    if (!Tabmix.extensions.verticalTabs) {
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._lockTabSizing")._replace(
        '{',
        '{if (this.orient != "horizontal" || !Tabmix.prefs.getBoolPref("lockTabSizingOnClose")) return;'
      )._replace(
        /(var|let) isEndTab =|faviconize.o_lockTabSizing/,
        '  if (TabmixTabbar.widthFitTitle) {' +
        '    let tab, tabs = this.tabbrowser.visibleTabs;' +
        '    for (let t = aTab._tPos+1, l = this.childNodes.length; t < l; t++) {' +
        '      if (tabs.indexOf(this.childNodes[t]) > -1) {' +
        '        tab = this.childNodes[t];' +
        '        break;' +
        '      }' +
        '    }' +
        '    if (tab && !tab.pinned && !tab.collapsed) {' +
        '      let tabWidth = aTab.getBoundingClientRect().width + "px";' +
        '      tab.style.setProperty("width", tabWidth, "important");' +
        '      tab.removeAttribute("width");' +
        '      this._hasTabTempWidth = true;' +
        '      this.tabbrowser.addEventListener("mousemove", this, false);' +
        '      window.addEventListener("mouseout", this, false);' +
        '    }' +
        '    return;' +
        '  }' +
        '  if (!Tabmix.tabsUtils.isSingleRow(tabs))' +
        '    return;' +
        '  this._tabDefaultMaxWidth = this.mTabMaxWidth;' +
        '  $&'
      ).toCode();

      // _expandSpacerBy not exsit in Firefox 21
      if (typeof tabBar._expandSpacerBy == "function")
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._expandSpacerBy")._replace(
        '{',
        '{if (TabmixTabbar.widthFitTitle || !Tabmix.tabsUtils.isSingleRow()) return;'
      ).toCode();

      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._unlockTabSizing")._replace(
        '{', '{\n' +
        '          var updateScrollStatus = this.hasAttribute("using-closing-tabs-spacer") ||\n' +
        '                                   this._hasTabTempMaxWidth || this._hasTabTempWidth;'
      )._replace(
        /(\})(\)?)$/,
        '  if (this._hasTabTempWidth) {' +
        '    this._hasTabTempWidth = false;' +
        '    let tabs = this.tabbrowser.visibleTabs;' +
        '    for (let i = 0; i < tabs.length; i++)' +
        '      tabs[i].style.width = "";' +
        '  }' +
        '  if (updateScrollStatus && this.childNodes.length > 1) {' +
        '    TabmixTabbar.updateScrollStatus();' +
        '    TabmixTabbar.updateBeforeAndAfter();' +
        '  }' +
        '  $1$2'
      ).toCode();
    }

    // when selecting different tab fast with the mouse sometimes original onxblmousedown can call this function
    // before our mousedown handler can prevent it
    Tabmix.changeCode(tabBar, "gBrowser.tabContainer._selectNewTab")._replace(
      '{',
      '{if(!Tabmix.prefs.getBoolPref("selectTabOnMouseDown") && Tabmix.isCallerInList("onxblmousedown")) return;'
    ).toCode();

    Tabmix.changeCode(tabBar,  "gBrowser.tabContainer.visible", {setter: true})._replace(
      'this._container.collapsed = !val;',
      '  if (TabmixTabbar.hideMode == 2)' +
      '    val = false;' +
      '  $&' +
      '  let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");' +
      '  if (bottomToolbox) {' +
      '    bottomToolbox.collapsed = !val;' +
      '    gTMPprefObserver.updateTabbarBottomPosition();' +
      '  }'
    ).defineProperty();

    if (Tabmix.isVersion(220)) {
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._setPositionalAttributes")._replace(
        /(\})(\)?)$/,
        '          Tabmix.setTabStyle(this.selectedItem);\n' +
        '          TabmixTabbar.updateBeforeAndAfter();\n' +
        '$1$2'
      ).toCode();
    }
  },

  change_utility: function change_utility() {
    // FullScreen code related to tabs bellow content initialize by first
    // fullScreen event, see TMP_eventListener.onFullScreen
    if (Tabmix.isVersion(400)) {
      Tabmix.changeCode(FullScreen, "FullScreen.showNavToolbox")._replace(
        'if (!this._isChromeCollapsed) {',
        '$&\n      ' +
        'TMP_eventListener.showNavToolbox();'
      )._replace(
        /(\})(\)?)$/,
        '  TMP_eventListener.showNavToolbox();\n' +
        '$1$2'
      ).toCode();
    }
    else
    Tabmix.changeCode(FullScreen, "FullScreen.mouseoverToggle")._replace(
      'this._isChromeCollapsed = !aShow;',
      '  $&' +
      '  if (aShow)' +
      '    TMP_eventListener.updateMultiRow();' +
      '  if (TabmixTabbar.position == 1) {' +
      '    TMP_eventListener.toggleTabbarVisibility(aShow);' +
      '  }'
    ).toCode();

    Tabmix.changeCode(window, "handleDroppedLink")._replace(
      'loadURI(uri, null, postData.value, false);',
      'tablib.contentAreaOnDrop(event, url, postData.value);', {check: !Tabmix.isVersion(250)}
    )._replace(
      'loadURI(data.url, null, data.postData, false);',
      'tablib.contentAreaOnDrop(event, data.url, data.postData);', {check: Tabmix.isVersion(250)}
    ).toCode();
    // update current browser
    gBrowser.selectedBrowser.droppedLinkHandler = handleDroppedLink;

    // we prevent sessionStore.duplicateTab from moving the tab
    Tabmix.changeCode(window, "duplicateTabIn")._replace(
      'switch (where)',
      'if (where == "window" && Tabmix.getSingleWindowMode()) {\n' +
      '    where = "tab";\n' +
      '  }\n' +
      '  $&'
    )._replace(
      'gBrowser.selectedTab = newTab;',
      '// check tabmix preference before selecting the new tab'
    )._replace(
      /(\})(\)?)$/,
      '  if (where != window) {\n' +
      '    let newTab = gBrowser.getTabForLastPanel();\n' +
      '    let selectNewTab = where == "tab" ?\n' +
      '        !Tabmix.prefs.getBoolPref("loadDuplicateInBackground") :\n' +
      '        Tabmix.prefs.getBoolPref("loadDuplicateInBackground");\n' +
      '    if (selectNewTab) {\n' +
      '      gBrowser.selectedTab = newTab;\n' +
      '    }\n' +
      '    let pref = Tabmix.isCallerInList("gotoHistoryIndex", "BrowserForward", "BrowserBack") ?\n' +
      '               "openTabNext" : "openDuplicateNext";\n' +
      '    if (Tabmix.prefs.getBoolPref(pref)) {\n' +
      '      let pos = newTab._tPos > aTab._tPos ? 1 : 0;\n' +
      '      gBrowser.moveTabTo(newTab, aTab._tPos + pos);\n' +
      '    }\n' +
      '  }\n' +
      '$1$2'
    ).toCode();

    Tabmix.changeCode(window, "BrowserCloseTabOrWindow")._replace(
      'closeWindow(true);', // Mac
      'tablib.closeLastTab();', {check: TabmixSvc.isMac, flags: "g"}
    )._replace(
      'gBrowser.removeCurrentTab({animate: true})',
      'tablib.closeLastTab();'
    ).toCode();

    // hide open link in window in single window mode
    if ("nsContextMenu" in window && "initOpenItems" in nsContextMenu.prototype) {
      Tabmix.changeCode(nsContextMenu.prototype, "nsContextMenu.prototype.initOpenItems")._replace(
        /context-openlink",/, '$& !Tabmix.singleWindowMode &&'
      )._replace(
        /context-openlinkprivate",/, '$& (!Tabmix.singleWindowMode || !isWindowPrivate) &&',
        {check: Tabmix.isVersion(200)}
      ).toCode();

      if (Tabmix.isVersion(200)) {
        Tabmix.changeCode(nsContextMenu.prototype, "nsContextMenu.prototype.openLinkInPrivateWindow")._replace(
          'openLinkIn(this.linkURL, "window",',
          'var [win, where] = [window, "window"];\
           if (Tabmix.singleWindowMode) {\
             let pbWindow = Tabmix.RecentWindow.getMostRecentBrowserWindow({ private: true });\
             if (pbWindow) {\
               [win, where] = [pbWindow, "tab"];\
               pbWindow.focus();\
             }\
           }\
           win.openLinkIn(this.linkURL, where,'
        ).toCode();
      }
    }

    /**
     * don't open link from external application in new window when in single window mode
     * don't open link from external application in current tab if the tab is locked
     *
     * we don't check isUrlForDownload for external links,
     * it is not likely that link in other application opened Firefox for downloading data
     */
    let fnObj = nsBrowserAccess.prototype, fnName, arg;
    [fnName, arg] = Tabmix.isVersion(260) ? ["_openURIInNewTab", "aIsExternal"] :
                                            ["openURI", "isExternal"];
    var _openURI = Tabmix.changeCode(fnObj, "nsBrowserAccess.prototype." + fnName);

    var loadURIWithFlags = Tabmix.isVersion(380) ?
        '      gBrowser.loadURIWithFlags(aURI.spec, {\n' +
        '        flags: loadflags,\n' +
        '        referrerURI: aReferrer,\n' +
        '        referrerPolicy: aReferrerPolicy,\n' +
        '      });' :
        '      browser.loadURIWithFlags(aURI.spec, loadflags, referrer, null, null);'
        .replace("referrer", (Tabmix.isVersion(360) ? "aReferrer" : "referrer"));

    _openURI = _openURI._replace(
      'if (#1 && (!aURI || aURI.spec == "'.replace("#1", arg) + TabmixSvc.aboutBlank + '")) {',
      'let currentIsBlank = win.gBrowser.isBlankNotBusyTab(win.gBrowser.mCurrentTab); \
       $&'
    )._replace(
      'win.BrowserOpenTab()',
      'if (currentIsBlank) tablib.setURLBarFocus(); \
      else $&'
    )._replace(
      '"browser.tabs.loadDivertedInBackground"',
      '#1 ? "extensions.tabmix.loadExternalInBackground" : $&'.replace("#1", arg),
      {check: Tabmix.isVersion(260)}
    )._replace(
      'win.gBrowser.loadOneTab',
      'currentIsBlank ? win.gBrowser.mCurrentTab : $&'
    )._replace(
      'win.gBrowser.getBrowserForTab(tab);',
      '$&' +
      'if (currentIsBlank && aURI) {' +
      '  let loadflags = #1 ?'.replace("#1", arg) +
      '      Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL :' +
      '      Ci.nsIWebNavigation.LOAD_FLAGS_NONE;' +
      '\n' + loadURIWithFlags + '\n    ' +
      '  browser.focus();' +
      '}'
    );

    if (Tabmix.isVersion(260)) {
      _openURI.toCode();
      _openURI = Tabmix.changeCode(fnObj, "nsBrowserAccess.prototype.openURI");
    }

    _openURI._replace(
      'switch (aWhere) {',
      '  if (Tabmix.singleWindowMode &&' +
      '      aWhere == Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW) {' +
      '      aWhere = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;' +
      '  }' +
      '  if (aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW &&' +
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
    [fnObj, fnName] = TMP_Places.getXnotifierFunction("openNewTabWith");
    // inverse focus of middle/ctrl/meta clicked links
    // Firefox check for "browser.tabs.loadInBackground" in openLinkIn
    Tabmix.changeCode(fnObj, fnName)._replace(
      'openLinkIn(',
      'var loadInBackground = false;\n' +
      '  if (aEvent) {\n' +
      '    if (aEvent.shiftKey)\n' +
      '      loadInBackground = !loadInBackground;\n' +
      '    if (getBoolPref("extensions.tabmix.inversefocusLinks")\n' +
      '        && (aEvent.button == 1 || aEvent.button == 0 && (aEvent.ctrlKey || aEvent.metaKey)))\n' +
      '      loadInBackground = !loadInBackground;\n' +
      '  }\n' +
      '  var where = loadInBackground ? "tabshifted" : "tab";\n' +
      '  $&'
    )._replace(
      'aEvent && aEvent.shiftKey ? "tabshifted" : "tab"',
      'where'
    ).toCode();

    Tabmix.originalFunctions.FillHistoryMenu = window.FillHistoryMenu;
    let fillHistoryMenu = function FillHistoryMenu(aParent) {
      let rv = Tabmix.originalFunctions.FillHistoryMenu.apply(this, arguments);
      let l = aParent.childNodes.length;
      for (let i = 0; i < l; i++) {
        let item = aParent.childNodes[i];
        let uri = item.getAttribute("uri");
        let label = item.getAttribute("label");
        let title = TMP_Places.getTitleFromBookmark(uri, label);
        Tabmix.setItem(item, "label", title);
      }
      return rv;
    };
    Tabmix.setNewFunction(window, "FillHistoryMenu", fillHistoryMenu);

    // Fix for Fast Dial
    if ("BrowserGoHome" in window || "BrowserGoHome" in FdTabLoader) {
      let loader = "FdTabLoader" in window && "BrowserGoHome" in FdTabLoader;
      let obj = loader ? FdTabLoader : window;
      let fnName = loader ? "FdTabLoader.BrowserGoHome" : "window.BrowserGoHome";
      Tabmix.changeCode(obj, fnName)._replace(
        'var where = whereToOpenLink(aEvent, false, true);',
        '$&' +
        'if (where == "current" && Tabmix.whereToOpen(false).inNew) where = "tab";'
      )._replace(
       'loadOneOrMoreURIs(homePage);',
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

    Tabmix.changeCode(newWindowButtonObserver, "newWindowButtonObserver.onDrop")._replace(
      '{',
      '{if (Tabmix.singleWindowMode) return;'
    ).toCode();

    Tabmix.changeCode(window, "warnAboutClosingWindow")._replace(
      Tabmix.isVersion(240) ? 'gBrowser.warnAboutClosingTabs(gBrowser.closingTabsEnum.ALL)' :
                              'gBrowser.warnAboutClosingTabs(true)',
      'tablib.closeWindow(true)', {flags: "g"}
    )._replace(
      'os.notifyObservers(null, "browser-lastwindow-close-granted", null);',
      'if (!TabmixSvc.isMac && !tablib.closeWindow(true)) return false;\
       $&'
    ).toCode();

    Tabmix.changeCode(window, "WindowIsClosing")._replace(
      '{',
      '{window.tabmix_warnedBeforeClosing = false;'
    )._replace(
      'if (!closeWindow(false, warnAboutClosingWindow))',
      'var reallyClose = closeWindow(false, warnAboutClosingWindow);\
       if (reallyClose && !window.tabmix_warnedBeforeClosing)\
         reallyClose = tablib.closeWindow();\
       if (!reallyClose)'
    ).toCode();

    Tabmix.changeCode(window, "goQuitApplication")._replace(
      'var appStartup',
      'let closedtByToolkit = Tabmix.isCallerInList("toolkitCloseallOnUnload");' +
      'if (!TabmixSessionManager.canQuitApplication(closedtByToolkit))' +
      '  return false;' +
      '$&'
    ).toCode();

    // if user changed mode to single window mode while having closed window
    // make sure that undoCloseWindow will open the closed window in the most recent non-private window
    Tabmix.changeCode(window, "undoCloseWindow")._replace(
      'window = #1.undoCloseWindow(aIndex || 0);'.
       replace("#1", Tabmix.isVersion(260) ? "SessionStore" : "ss"),
      '{if (Tabmix.singleWindowMode) {\
         window = TabmixSvc.version(200) ?\
            Tabmix.RecentWindow.getMostRecentBrowserWindow({private: false}) :\
            Tabmix.getTopWin();\
       }\
       if (window) {\
        window.focus();\
        let index = aIndex || 0;\
        let closedWindows = TabmixSvc.JSON.parse(#1.getClosedWindowData());\
        #1.forgetClosedWindow(index);\
        let state = closedWindows.splice(index, 1).shift();\
        state = TabmixSvc.JSON.stringify({windows: [state]});\
        #1.setWindowState(window, state, false);\
       }\
       else $&}'.replace(/#1/g, Tabmix.isVersion(260) ? "SessionStore" : "ss")
    )._replace(
      'return window;',
      'TabmixSessionManager.notifyClosedWindowsChanged();\
       $&'
    ).toCode();

    HistoryMenu.prototype.populateUndoSubmenu = function PHM_populateUndoSubmenu() {
      var undoMenu = this._rootElt.getElementsByClassName("recentlyClosedTabsMenu")[0];
      var undoPopup = undoMenu.firstChild;
      if (!undoPopup.hasAttribute("context"))
        undoPopup.setAttribute("context", "tm_undocloseContextMenu");
      TMP_ClosedTabs.populateUndoSubmenu(undoPopup);
    };

    // history menu open in new tab if the curren tab is locked
    // open in current tab if it blank or if middle click and setting is on
    HistoryMenu.prototype._onCommand = function HM__onCommand(aEvent) {
      TMP_Places.historyMenu(aEvent);
    };

    Tabmix.changeCode(HistoryMenu.prototype, "HistoryMenu.prototype._onPopupShowing")._replace(
      'this.toggleRecentlyClosedWindows();',
      '$& \
       TMP_Places.historyMenuItemsTitle(aEvent);'
    )._replace(
      'this.toggleRecentlyClosedWindows();',
      '$& \
       let SM = TabmixSessionManager;\
       Tabmix.setItem("Browser:RestoreLastSession", "disabled", !SM.canRestoreLastSession || SM.isPrivateWindow);',
       {check: Tabmix.isVersion(200) && Tabmix.prefs.getBoolPref("sessions.manager")}
    ).toCode();

    Tabmix.changeCode(HistoryMenu.prototype, "HistoryMenu.prototype.populateUndoWindowSubmenu")._replace(
      'this._ss',
      'TabmixSvc.ss', {check: !Tabmix.isVersion(260), flags: "g"}
    )._replace(
      'this._rootElt.getElementsByClassName("recentlyClosedWindowsMenu")[0];',
      'this._rootElt ? this._rootElt.getElementsByClassName("recentlyClosedWindowsMenu")[0] :\n' +
      '                                   document.getElementById(arguments[0]);'
    )._replace(
      /(\})(\)?)$/,
      '  tablib.populateUndoWindowSubmenu(undoPopup);\n'+
      '$1$2'
    ).toCode();

    var popup = document.getElementById("historyUndoWindowPopup");
    if (popup)
      popup.setAttribute("context", "tm_undocloseWindowContextMenu");

    if (!Tabmix.isVersion(290))
    Tabmix.changeCode(window, "switchToTabHavingURI")._replace(
      'function switchIfURIInWindow',
      'let switchIfURIInWindow = $&', {check: Tabmix._debugMode}
    )._replace(
      'gBrowser.selectedBrowser.loadURI(aURI.spec);',
      '{$& \
       gBrowser.ensureTabIsVisible(gBrowser.selectedTab);}'
    ).toCode();

    if (Tabmix.isVersion(300)) {
      Tabmix.changeCode(window, "BrowserOpenNewTabOrWindow")._replace(
        'event.shiftKey',
        '$& && !Tabmix.singleWindowMode'
      ).toCode();
    }

    Tabmix.originalFunctions.URLBarSetURI = URLBarSetURI;
    let _URLBarSetURI = function tabmix_URLBarSetURI() {
      if (Tabmix.selectedTab == gBrowser.selectedTab &&
          Tabmix.userTypedValue && gBrowser.userTypedValue !== "") {
        gBrowser.userTypedValue = "";
      }
      Tabmix.originalFunctions.URLBarSetURI.apply(window, arguments);
    };
    Tabmix.setNewFunction(window, "URLBarSetURI", _URLBarSetURI);
  },

  populateUndoWindowSubmenu: function(undoPopup) {
    if (!undoPopup.hasAttribute("context"))
      undoPopup.setAttribute("context", "tm_undocloseWindowContextMenu");
    let undoItems = JSON.parse(TabmixSvc.ss.getClosedWindowData());
    let menuLabelString = gNavigatorBundle.getString("menuUndoCloseWindowLabel");
    let menuLabelStringSingleTab =
      gNavigatorBundle.getString("menuUndoCloseWindowSingleTabLabel");
    let checkForMiddleClick = function(e) {this.checkForMiddleClick(e);}.bind(TabmixSessionManager);
    for (let i = 0; i < undoPopup.childNodes.length; i++) {
      let m = undoPopup.childNodes[i];
      let undoItem = undoItems[i];
      if (undoItem && m.hasAttribute("targetURI")) {
        let otherTabsCount = undoItem.tabs.length - 1;
        let label = (otherTabsCount === 0) ? menuLabelStringSingleTab
                                          : PluralForm.get(otherTabsCount, menuLabelString);
        TMP_SessionStore.getTitleForClosedWindow(undoItem);
        let menuLabel = label.replace("#1", undoItem.title)
                             .replace("#2", otherTabsCount);
        m.setAttribute("label", menuLabel);
        m.setAttribute("value", i);
        m.fileName = "closedwindow";
        m.addEventListener("click", checkForMiddleClick, false);
      }
    }
    let restoreAllWindows = undoPopup.lastChild;
    restoreAllWindows.setAttribute("value", -2);
    let clearList = undoPopup.appendChild(document.createElement("menuitem"));
    clearList.id = "menu_clearClosedWindowsList";
    clearList.setAttribute("label", TabmixSvc.getString("undoClosedWindows.clear.label"));
    clearList.setAttribute("value", -1);
    clearList.addEventListener("command", function() {
      TabmixSessionManager.forgetClosedWindow(-1);
    });
    undoPopup.insertBefore(clearList, restoreAllWindows);
  },

  addNewFunctionsTo_gBrowser: function addNewFunctionsTo_gBrowser() {
    let duplicateTab = function tabbrowser_duplicateTab(aTab, aHref, aTabData, disallowSelect, dontFocusUrlBar) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      var newTab = null;
      // try to have SessionStore duplicate the given tab

      if (!aHref && !aTabData) {
        newTab = TabmixSvc.ss.duplicateTab(window, aTab, 0);
      }
      else
        newTab = this.SSS_duplicateTab(aTab, aHref, aTabData);

      if (!newTab && aTabData)
        throw new Error("Tabmix was unable to restore closed tab to new window");

      // sessionstore duplicateTab failed
      if (!newTab)
        return null;

      this.selectedBrowser.focus();

      // move new tab to place before we select it
      var copyToNewWindow = window != aTab.ownerDocument.defaultView;
      if (!disallowSelect && !copyToNewWindow && Tabmix.prefs.getBoolPref("openDuplicateNext")) {
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
    Tabmix.setNewFunction(gBrowser, "duplicateTab", duplicateTab);

    gBrowser.SSS_duplicateTab = function tabbrowser_SSS_duplicateTab(aTab, aHref, aTabData) {
      var newTab = null, tabState;
      // add new history entry after current index
      function addNewHistoryEntry() {
        try {
          var activeIndex = (tabState.index || tabState.entries.length) - 1;
          var entriesToRemove = 0;
          var newEntry = { url: aHref }; // we don't know the page title at this moment
          tabState.entries.splice(activeIndex + 1 , entriesToRemove, newEntry);
          tabState.index++;
        } catch (ex) {Tabmix.assert(ex);}
      }
      // we need to update history title after the new page loaded for use in back/forword button
      function updateNewHistoryTitle() {
        /* jshint validthis: true */
        try {
          this.removeEventListener("SSTabRestored", updateNewHistoryTitle, true);
          let browser = this.linkedBrowser;
          if (Tabmix.isVersion(320))
            browser.messageManager.sendAsyncMessage("Tabmix:updateHistoryTitle", {title: this.label});
          else {
            let history = browser.webNavigation.sessionHistory;
            Tabmix.Utils.updateHistoryTitle(history, this.label);
          }
        } catch (ex) {Tabmix.assert(ex);}
      }
      function urlForDownload() {
        /* jshint validthis: true */
        try {
          this.removeEventListener("SSTabRestored", urlForDownload, true);
          let browser = this.linkedBrowser;
          browser.tabmix_allowLoad = true;
          browser.loadURI(aHref);
        } catch (ex) {Tabmix.assert(ex);}
      }
      try {
        tabState = aTabData ? aTabData.state : TabmixSvc.JSON.parse(TabmixSvc.ss.getTabState(aTab));
        newTab = this.addTab("about:blank", {dontMove: true});
        newTab.linkedBrowser.stop();
        if (aHref) {
          if (Tabmix.ContentClick.isUrlForDownload(aHref))
            newTab.addEventListener("SSTabRestored", urlForDownload, true);
          else {
            addNewHistoryEntry();
            newTab.addEventListener("SSTabRestored", updateNewHistoryTitle, true);
          }
        }
        tabState.pinned = false;
        TabmixSvc.ss.setTabState(newTab, TabmixSvc.JSON.stringify(tabState));
      } catch (ex) {Tabmix.assert(ex);}

      return newTab;
    };

    gBrowser.duplicateTabToWindow = function (aTab, aMoveTab, aTabData) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      if (Tabmix.singleWindowMode) {
        if (!aMoveTab)
          this.duplicateTab(aTab, null, aTabData);
      }
      else if (aMoveTab) {
        this.replaceTabWithWindow(aTab);
      }
      else {
        aTab._tabmixCopyToWindow = {data: aTabData};
        // replaceTabWithWindow not working if there is only one tab in the the window
        window.openDialog("chrome://browser/content/browser.xul",
            "_blank", "chrome,dialog=no,all", aTab);
      }
    };

    gBrowser.openLinkWithHistory = function () {
      var {target, linkURL, principal} = gContextMenu;
      var url = tablib.getValidUrl(linkURL, target);
      if (!url)
        return;

      if (Tabmix.isVersion(380))
        urlSecurityCheck(url, principal);
      else if (typeof gContextMenu._unremotePrincipal == "function") {
        // Firefox 26-37
        let doc = target.ownerDocument;
        urlSecurityCheck(url, gContextMenu._unremotePrincipal(doc.nodePrincipal));
      }
      else {
        // Firefox 17-25
        let doc = target.ownerDocument;
        urlSecurityCheck(url, doc.nodePrincipal);
      }

      this.duplicateTab(gBrowser.selectedTab, url);
    };

    Tabmix.changeCode(nsContextMenu.prototype, "nsContextMenu.prototype.openLinkInTab")._replace(
      /allowMixedContent:|charset:/,
      'inBackground: !Services.prefs.getBoolPref("browser.tabs.loadInBackground"),\n' +
      '      $&'
    ).toCode(false, Tabmix.originalFunctions, "openInverseLink");

    gBrowser.openInverseLink = function () {
      var {target, linkURL} = gContextMenu;
      var url = tablib.getValidUrl(linkURL, target);
      if (!url)
        return;

      gContextMenu.linkURL = url;
      // originalFunctions.openInverseLink is a copy of original
      // nsContextMenu.prototype.openLinkInTab
      Tabmix.originalFunctions.openInverseLink.apply(gContextMenu);
    };

    tablib.openLinkInCurrent = function() {
      var {target, linkURL} = gContextMenu;
      var url = tablib.getValidUrl(linkURL, target);
      if (!url)
        return;

      gContextMenu.linkURL = url;
      gBrowser.selectedBrowser.tabmix_allowLoad = true;
      gContextMenu.openLinkInCurrent();
    };

    tablib.getValidUrl = function(url, target) {
      // valid urls don't contain spaces ' '; if we have a space it isn't a valid url.
      // Also disallow dropping javascript: or data: urls--bail out
      let isValid = function(aUrl) {
        if (!aUrl || !aUrl.length || aUrl.indexOf(" ", 0) != -1 ||
             /^\s*(javascript|data):/.test(aUrl))
          return false;
        return true;
      };

      let browser = gBrowser.selectedBrowser;
      if (browser.getAttribute("remote") == "true" &&
          typeof gContextMenu.tabmixLinkURL != "undefined")
        return gContextMenu.tabmixLinkURL;

      if (!isValid(url)) {
        let json = {button: 0, shiftKey: false, ctrlKey: false, metaKey: false,
                    altKey: false, target: {},
                    tabmix_openLinkWithHistory: true};
        let result = Tabmix.ContentClick.getParamsForLink(json,
              target, url, browser, document.commandDispatcher.focusedWindow);
        return result._href && isValid(result._href) ? result._href : null;
      }
      return url;
    };

    gBrowser.closeAllTabs = function TMP_closeAllTabs() {
      if (this.warnAboutClosingTabs(this.closingTabsEnum.ALL)) {
        if (TabmixTabbar.visibleRows > 1)
          Tabmix.tabsUtils.updateVerticalTabStrip(true);
        let tabs = this.visibleTabs.slice();
        // remove current tab last
        if (!this.mCurrentTab.pinned)
          tabs.unshift(tabs.splice(tabs.indexOf(this.mCurrentTab), 1)[0]);
        Tabmix.startCountingClosedTabs();
        tabs.reverse().forEach(function TMP_removeTab(tab) {
          if (!tab.pinned)
            this.removeTab(tab, {animate: false});
        }, this);
        Tabmix.setNumberOfTabsClosedLast();
        // _handleTabSelect will call mTabstrip.ensureElementIsVisible
      }
    };

    gBrowser.closeGroupTabs = function TMP_closeGroupTabs(aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      var URL = this.getBrowserForTab(aTab).currentURI.spec;
      var matches = URL.match(/(^.*\/)(.*)/);
      var aDomain = matches ?  matches[1] : URL;

      if (this.warnAboutClosingTabs(this.closingTabsEnum.GROUP, null, aDomain)) {
        var childNodes = this.visibleTabs;
        Tabmix.startCountingClosedTabs();
        for (var i = childNodes.length - 1; i > -1; --i) {
          if (childNodes[i] != aTab && !childNodes[i].pinned &&
              this.getBrowserForTab(childNodes[i]).currentURI.spec.indexOf(aDomain) != -1)
            this.removeTab(childNodes[i]);
        }
        if (!aTab.pinned) {
          this.removeTab(aTab, {animate: true});
          this.ensureTabIsVisible(this.selectedTab);
        }
        Tabmix.setNumberOfTabsClosedLast();
      }
    };

    gBrowser._closeLeftTabs = function (aTab) {
      if (Tabmix.ltr)
        this.closeLeftTabs(aTab);
      else
        this.closeRightTabs(aTab);
    };

    gBrowser._closeRightTabs = function (aTab) {
      if (Tabmix.ltr)
        this.closeRightTabs(aTab);
      else
        this.closeLeftTabs(aTab);
    };

    gBrowser.closeRightTabs = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      if (this.warnAboutClosingTabs(this.closingTabsEnum.TO_END, aTab)) {
        if (aTab._tPos < this.mCurrentTab._tPos)
          this.selectedTab = aTab;

        let childNodes = this.visibleTabs;
        let tabPos = childNodes.indexOf(aTab);
        Tabmix.startCountingClosedTabs();
        for (let i = childNodes.length - 1; i > tabPos; i--) {
          if (!childNodes[i].pinned)
            this.removeTab(childNodes[i]);
        }
        Tabmix.setNumberOfTabsClosedLast();
      }
    };

    gBrowser.closeLeftTabs = function TMP_closeLeftTabs(aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      if (this.warnAboutClosingTabs(this.closingTabsEnum.TO_START, aTab)) {
        if (aTab._tPos > this.mCurrentTab._tPos) {
          this.selectedTab = aTab;
        }
        this.ensureTabIsVisible(this.selectedTab);

        let childNodes = this.visibleTabs;
        let tabPos = childNodes.indexOf(aTab);
        Tabmix.startCountingClosedTabs();
        for (let i = tabPos - 1; i >= 0; i--) {
          if (!childNodes[i].pinned)
            this.removeTab(childNodes[i]);
        }
        Tabmix.setNumberOfTabsClosedLast();
      }
    };

    Tabmix.setNewFunction(gBrowser, "removeAllTabsBut", function TMP_removeAllTabsBut(aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      if (this.warnAboutClosingTabs(this.closingTabsEnum.OTHER, aTab)) {
        if (aTab != this.mCurrentTab)
          this.selectedTab = aTab;
        this.ensureTabIsVisible(this.selectedTab);
        var childNodes = this.visibleTabs;
        if (TabmixTabbar.visibleRows > 1)
          Tabmix.tabsUtils.updateVerticalTabStrip(true);
        Tabmix.startCountingClosedTabs();
        for (var i = childNodes.length - 1; i >= 0; --i) {
          if (childNodes[i] != aTab && !childNodes[i].pinned)
            this.removeTab(childNodes[i]);
        }
        Tabmix.setNumberOfTabsClosedLast();
      }
    });

    gBrowser._reloadLeftTabs = function (aTab) {
      if (Tabmix.ltr)
        this.reloadLeftTabs(aTab);
      else
        this.reloadRightTabs(aTab);
    };

    gBrowser._reloadRightTabs = function (aTab) {
      if (Tabmix.ltr)
        this.reloadRightTabs(aTab);
      else
        this.reloadLeftTabs(aTab);
    };

    gBrowser.reloadLeftTabs = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      var childNodes = this.visibleTabs;
      if ( aTab._tPos > this.mCurrentTab._tPos )
        this.selectedTab = aTab;
      let tabPos = childNodes.indexOf(aTab);
      tablib.reloadTabs(childNodes.slice(0, tabPos).reverse());
    };

    gBrowser.reloadRightTabs = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      var childNodes = this.visibleTabs;
      if ( aTab._tPos < this.mCurrentTab._tPos )
        this.selectedTab = aTab;
      let tabPos = childNodes.indexOf(aTab);
      tablib.reloadTabs(childNodes.slice(tabPos + 1));
    };

    gBrowser.reloadAllTabsBut = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      else
        this.selectedTab = aTab;
      tablib.reloadTabs(this.visibleTabs, aTab);
    };

    gBrowser.lockTab = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      if ( aTab.hasAttribute("locked") ) {
        aTab.removeAttribute("_lockedAppTabs"); // we only have this if we locked AppTab
        aTab.removeAttribute("locked");
        aTab.setAttribute("_locked", "false");
      }
      else {
        aTab.setAttribute("locked", "true");
        aTab.setAttribute("_locked", "true");
      }
      aTab.linkedBrowser.tabmix_allowLoad = !aTab.hasAttribute("locked");
      TabmixSvc.saveTabAttributes(aTab, "_locked");
      TabmixSessionManager.updateTabProp(aTab);
    };

    gBrowser.protectTab = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      if ( aTab.hasAttribute("protected") )
        aTab.removeAttribute("protected");
      else
        aTab.setAttribute("protected", "true");
      TabmixSvc.saveTabAttributes(aTab, "protected");
      TabmixSessionManager.updateTabProp(aTab);
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
        TabmixTabbar.updateBeforeAndAfter();
      }
    };

    gBrowser.freezeTab = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      if ( !aTab.hasAttribute("protected") || !aTab.hasAttribute("locked")){
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
      TabmixSvc.saveTabAttributes(aTab, "_locked,protected");
      TabmixSessionManager.updateTabProp(aTab);
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
        TabmixTabbar.updateBeforeAndAfter();
      }
    };

    gBrowser.SelectToMerge = function(aTab) {
      if (Tabmix.singleWindowMode && Tabmix.numberOfWindows() == 1) return;
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      if (aTab.hasAttribute("mergeselected")) {
        aTab.removeAttribute("mergeselected");
        aTab.label = aTab.label.substr(4);
      } else {
        aTab.setAttribute("mergeselected", "true");
        aTab.label = "(*) " + aTab.label;
      }
      this._tabAttrModified(aTab);
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
        TabmixTabbar.updateBeforeAndAfter();
      }
    };

    gBrowser.copyTabUrl = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                   .getService(Components.interfaces.nsIClipboardHelper);

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
      var items = Array.filter(this.tabContainer.getElementsByAttribute("tabmix_selectedID", "*"),
          function(tab) {return !tab.hidden && !tab.closing;
      }, this);
      for (var i = 0; i < items.length; ++i ) {
        if (aTab && items[i] == aTab)
          continue;
        temp_id = parseInt(items[i].getAttribute("tabmix_selectedID") || 0);
        if ( temp_id && temp_id > max_id ) {
          max_id = temp_id;
          tempIndex = tabs.indexOf(items[i]);
        }
      }

      return tempIndex;
    };

    gBrowser.previousTab = function (aTab) {
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

    gBrowser.selectIndexAfterRemove = function (oldTab) {
      var tabs = TMP_TabView.currentGroup();
      var currentIndex = tabs.indexOf(this.mCurrentTab);
      if (this.mCurrentTab != oldTab)
        return currentIndex;
      var l = tabs.length;
      if (l==1)
        return 0;
      var mode = Tabmix.prefs.getIntPref("focusTab");
      switch ( mode ) {
        case 0: // first tab
          return currentIndex === 0 ? 1 : 0;
        case 1: // left tab
          return currentIndex === 0 ? 1 : currentIndex-1 ;
        case 3: // last tab
          return currentIndex == l - 1 ? currentIndex - 1 : l - 1;
        case 6: // last opened
          let lastTabIndex, maxID = -1;
          tabs.forEach(function(tab, index) {
            if (tab == oldTab)
              return;
            let linkedPanel = tab.linkedPanel.replace('panel', '');
            if (Tabmix.isVersion(260))
              linkedPanel = linkedPanel.substr(linkedPanel.lastIndexOf("-") + 1);
            let id = parseInt(linkedPanel);
            if (id > maxID) {
              maxID = id;
              lastTabIndex = index;
            }
          });
          return lastTabIndex;
        case 4: // last selected
          let tempIndex = this.previousTabIndex(oldTab, tabs);
          // if we don't find last selected we fall back to default
          if (tempIndex > -1)
            return tempIndex;
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
          this.setAttribute("preventMouseHoverSelect",true);
          var delay = aTab.mouseHoverSelectDelay + 50;
          setTimeout(function removeDelayAfterClose(browser) {
            browser.removeAttribute("preventMouseHoverSelect");
          }, delay, this);
       }
    };

    Object.defineProperty(gBrowser, "closingTabsEnum",
      {value: { ALL: 0, OTHER: 1, TO_END: 2, ALL_ONEXIT: 3, TO_START: 4, GROUP: 5 }, writable: false});

    let warnAboutClosingTabs = function (whatToClose, aTab, aDomain) {
      // see tablib.closeWindow comment
      if (Tabmix.isCallerInList("BG__onQuitRequest"))
        return true;
      var closing = this.closingTabsEnum;
      // try to cach call from other extensions to warnAboutClosingTabs (before Firefox 24)
      if (typeof(whatToClose) == "boolean")
        whatToClose = whatToClose ? closing.ALL_ONEXIT : closing.OTHER;

      var onExit = whatToClose == closing.ALL_ONEXIT;
      var tabs = !onExit ? this.visibleTabs : this.tabs;
      var numTabs = tabs.length;
      // calc the number of tab to close when there is protected tabs.
      let protectedTabs = [];
      function addProtected(tabs) {
        for (let i = 0; i < tabs.length; i++ ) {
          let tab = tabs[i];
          if (!onExit && tab.hidden)
            continue;
          if (protectedTabs.indexOf(tab) == -1 )
            protectedTabs.push(tabs[i]);
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
      var prefs = ["extensions.tabmix.tabs.warnOnClose",
                  "extensions.tabmix.protectedtabs.warnOnClose",
                  "browser.tabs.warnOnClose"];
      if (onExit) {
        if (numTabs > 1 && Services.prefs.getBoolPref(prefs[2]))
          shouldPrompt = 3;
        else if (numProtected > 0 && Services.prefs.getBoolPref(prefs[1]))
          shouldPrompt = 2;
      }
      else if (numTabs > 1) {
        if (Services.prefs.getBoolPref(prefs[0]))
          shouldPrompt = 1;
        // when we close window with last tab and we don't have protected tabs
        // we need to warn the user with the proper warning
        if (Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab") &&
            !Tabmix.prefs.getBoolPref("keepLastTab") &&
            Services.prefs.getBoolPref(prefs[2])) {
          if (whatToClose == closing.GROUP)
            shouldPrompt = -1;
          else if (whatToClose == closing.ALL && numProtected === 0 &&
              numTabs == this.tabs.length) {
            whatToClose = closing.ALL_ONEXIT;
            shouldPrompt = 3;
          }
        }
      }

      if (shouldPrompt === 0)
        return true;

      var i, tabPos, tabsToClose = 0;
      switch (whatToClose) {
        case closing.ALL:
          tabsToClose = numTabs - numProtected;
          break;
        case closing.ALL_ONEXIT:
          tabsToClose = numTabs - this._removingTabs.length;
          break;
        case closing.OTHER:
          if (!aTab)
            aTab = this.mCurrentTab;
          if (aTab._isProtected)
            --numProtected;
          tabsToClose = numTabs - 1 - numProtected;
          break;
        case closing.GROUP:
          for ( i = numTabs - 1; i > -1; --i) {
            let tab = tabs[i];
            if (this.getBrowserForTab(tab).currentURI.spec.indexOf(aDomain) != -1 &&
                !tab._isProtected)
              tabsToClose++;
          }
          if (shouldPrompt == -1) {
            if (tabsToClose == this.tabs.length)
              shouldPrompt = 3;
            else if (Services.prefs.getBoolPref(prefs[0]))
              shouldPrompt = 1;
            else
              return true;
          }
          break;
        case closing.TO_END:
          if (!aTab)
            throw new Error("Required argument missing: aTab");
          tabPos = tabs.indexOf(aTab);
          for ( i = 0; i < protectedTabs.length; i++ ) {
            let index = tabs.indexOf(protectedTabs[i]);
            if (index <= tabPos)
              --numProtected;
          }
          tabsToClose = numTabs - tabPos - 1 - numProtected;
          break;
        case closing.TO_START:
          if (!aTab)
            throw new Error("Required argument missing: aTab");
          tabPos = tabs.indexOf(aTab);
          for ( i = 0; i < protectedTabs.length; i++ ) {
            let index = tabs.indexOf(protectedTabs[i]);
            if (index >= tabPos)
              --numProtected;
          }
          tabsToClose = tabPos - numProtected;
          break;
        default:
          throw new Error("Invalid argument: " + whatToClose);
      }

      if (whatToClose != closing.ALL_ONEXIT && tabsToClose == numTabs &&
          Tabmix.prefs.getBoolPref("keepLastTab"))
        tabsToClose--;

      if (tabsToClose <= 1 && shouldPrompt < 2)
        return true;

      // default to true: if it were false, we wouldn't get this far
      var warnOnClose = { value:true };
      var bundle = this.mStringBundle;

      var message, chkBoxLabel;
      if (shouldPrompt == 1 || numProtected === 0) {
        if (Tabmix.isVersion(290))
          message = PluralForm.get(tabsToClose, bundle.getString("tabs.closeWarningMultiple"))
                      .replace("#1", tabsToClose);
        else
          message = bundle.getFormattedString("tabs.closeWarningMultipleTabs", [tabsToClose]);
        chkBoxLabel = shouldPrompt == 1 ? bundle.getString("tabs.closeWarningPromptMe") :
                                          TabmixSvc.getString("window.closeWarning.1");
      }
      else {
        let messageKey = "protectedtabs.closeWarning.";
        messageKey += (numProtected < tabsToClose) ? "3" : (numProtected == 1) ? "1" : "2";
        message = TabmixSvc.getFormattedString(messageKey, [tabsToClose, numProtected]);
        var chkBoxKey = shouldPrompt == 3 ? "window.closeWarning.1" : "protectedtabs.closeWarning.4";
        chkBoxLabel = TabmixSvc.getString(chkBoxKey);
      }

      var buttonLabel = shouldPrompt == 1 ? bundle.getString("tabs.closeButtonMultiple") :
                                            TabmixSvc.getString("closeWindow.label");

      window.focus();
      var promptService = Services.prompt;
      var buttonPressed = promptService.confirmEx(window,
                                                  bundle.getString("tabs.closeWarningTitle"),
                                                  message,
                                                  (promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0) +
                                                  (promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1),
                                                  buttonLabel,
                                                  null, null,
                                                  chkBoxLabel,
                                                  warnOnClose);
      var reallyClose = (buttonPressed === 0);
      // don't set the pref unless they press OK and it's false
      if (reallyClose && !warnOnClose.value) {
        Services.prefs.setBoolPref(prefs[shouldPrompt - 1], false);
      }

      return reallyClose;
    };
    Tabmix.setNewFunction(gBrowser, "warnAboutClosingTabs", warnAboutClosingTabs);

    gBrowser.TMP_selectNewForegroundTab = function (aTab, aLoadInBackground, aUrl, addOwner) {
       var bgLoad = typeof aLoadInBackground == "boolean" ? aLoadInBackground :
                      Services.prefs.getBoolPref("browser.tabs.loadInBackground");
       if (!bgLoad) {
          // set new tab owner
          addOwner = typeof addOwner == "boolean" ? addOwner : true;
          if (addOwner)
             aTab.owner = this.selectedTab;
          this.selectedTab = aTab;
          if (aUrl && Tabmix.isNewTabUrls(aUrl))
            tablib.setURLBarFocus();
       }
    };

    Tabmix.originalFunctions.swapBrowsersAndCloseOther = gBrowser.swapBrowsersAndCloseOther;
    let swapTab = function tabmix_swapBrowsersAndCloseOther(aOurTab, aOtherTab) {
      // Do not allow transfering a private tab to a non-private window
      // and vice versa.
      if (Tabmix.isVersion(200) && PrivateBrowsingUtils.isWindowPrivate(window) !=
          PrivateBrowsingUtils.isWindowPrivate(aOtherTab.ownerDocument.defaultView))
        return;

      Tabmix.copyTabData(aOurTab, aOtherTab);

      let copy = aOtherTab._tabmixCopyToWindow;
      delete aOtherTab._tabmixCopyToWindow;
      let pendingTab = !copy && aOtherTab.hasAttribute("pending");
      if (typeof copy == "object" || pendingTab) {
        let tabData = copy ? copy.data : null;
        TabmixSvc.ss.setTabState(aOurTab, tabData || TabmixSvc.ss.getTabState(aOtherTab));
        // Workarounds for bug 817947
        // Move a background unloaded tab to New Window fails
        if (pendingTab) {
          let remoteBrowser = aOtherTab.ownerDocument.defaultView.gBrowser;
          if (!remoteBrowser._beginRemoveTab(aOtherTab, true, true))
            return;
          remoteBrowser._endRemoveTab(aOtherTab);
        }
        return;
      }

      Tabmix.originalFunctions.swapBrowsersAndCloseOther.apply(this, arguments);
    };
    Tabmix.setNewFunction(gBrowser, "swapBrowsersAndCloseOther", swapTab);

    // Bug 752376 - Avoid calling scrollbox.ensureElementIsVisible()
    // if the tab strip doesn't overflow to prevent layout flushes
    gBrowser.ensureTabIsVisible = function tabmix_ensureTabIsVisible(aTab, aSmoothScroll) {
      if (Tabmix.tabsUtils.overflow)
        this.tabContainer.mTabstrip.ensureElementIsVisible(aTab, aSmoothScroll);
    };

    // Follow up bug 887515 - add ability to restore multiple tabs
    // bug 914258 backout 887515 changes from Firefox 25
    if (Tabmix._restoreMultipleTabs) {
      Tabmix.startCountingClosedTabs = function() {
        this.shouldCountClosedTabs = true;
        this.numberOfTabsClosedLast = 0;
      };
      Tabmix.setNumberOfTabsClosedLast = function(aNum) {
        TabmixSvc.ss.setNumberOfTabsClosedLast(window, aNum || this.numberOfTabsClosedLast);
        this.shouldCountClosedTabs = false;
        this.numberOfTabsClosedLast = 0;
      };
      Tabmix.countClosedTabs = function(aTab) {
        if (!this.shouldCountClosedTabs ||
            Services.prefs.getIntPref("browser.sessionstore.max_tabs_undo") === 0)
          return;
        var tabState = TabmixSvc.JSON.parse(TabmixSvc.ss.getTabState(aTab));
        if (!tabState.entries || tabState.entries.length == 1 &&
           (tabState.entries[0].url == TabmixSvc.aboutBlank ||
            tabState.entries[0].url == TabmixSvc.aboutNewtab) &&
            !tabState.userTypedValue)
          return;
        this.numberOfTabsClosedLast++;
      };
    }
    else {
      Tabmix.startCountingClosedTabs = function() { };
      Tabmix.setNumberOfTabsClosedLast = function() { };
      Tabmix.countClosedTabs = function() { };
    }

    /** DEPRECATED **/
    // we keep this function to saty compatible with other extensions that use it
    gBrowser.undoRemoveTab = function () {TMP_ClosedTabs.undoCloseTab();};
    // Tabmix don't use this function anymore
    // but treeStyleTab extension look for it
    gBrowser.restoreTab = function() { };
    gBrowser.closeTab = function(aTab) {this.removeTab(aTab);};
    gBrowser.TMmoveTabTo = gBrowser.moveTabTo;
    gBrowser.renameTab = function(aTab) {Tabmix.renameTab.editTitle(aTab);};
  },

  // prevent 'ReferenceError: reference to undefined property params'
  // in gBrowser.addTab
  props: ["referrerURI","charset","postData","ownerTab",
          "allowThirdPartyFixup","fromExternal","relatedToCurrent",
          "allowMixedContent","skipAnimation","isUTF8","dontMove","isPending",
          "aForceNotRemote", "aNoReferrer"],

  definedParams: function(params) {
    this.props.forEach(function(prop){
      if (typeof params[prop] == "undefined")
        params[prop] = null;
    });
    return params;
  },

  getTabTitle: function TMP_getTabTitle(aTab, url, title) {
    // return the current tab only if it is visible
    if (TabmixTabbar.widthFitTitle &&
        (!TMP_Places.inUpdateBatch || !TMP_Places.currentTab)) {
      let tab = gBrowser.selectedTab;
      if (Tabmix.tabsUtils.isElementVisible(tab))
       TMP_Places.currentTab = tab;
    }
    return TMP_Places.getTabTitle(aTab, url, title);
  },

  onTabTitleChanged: function TMP_onTabTitleChanged(aTab, isUrlTitle) {
    // when TabmixTabbar.widthFitTitle is true we only have width attribute after tab reload
    // some site, like Gmail change title internaly, after load already finished and we have remove
    // width attribute
    if (!TabmixTabbar.widthFitTitle || (isUrlTitle && aTab.hasAttribute("width")))
      return;

    if (aTab.hasAttribute("width")) {
      let width = aTab.boxObject.width;
      aTab.removeAttribute("width");
      if (width != aTab.boxObject.width)
        TMP_Places.afterTabTitleChanged(true);
    }
    else if (aTab.hasAttribute("fadein"))
      TMP_Places.afterTabTitleChanged(true);
    // don't keep unnecessary reference to current tab
    if (!TMP_Places.inUpdateBatch)
      TMP_Places.currentTab = null;
  },

  // make sure that our function don't break removeTab function
  onRemoveTab: function TMP_onRemoveTab(tab) {
    // Not in use since Firefox 27, see comment in TabmixTabClickOptions
    if (Tabmix.prefs.getBoolPref("tabbar.click_dragwindow") &&
        TabmixTabClickOptions._blockDblClick) {
      setTimeout(function() {
        TabmixTabClickOptions._blockDblClick = false;
        if (!Tabmix.isVersion(270))
          gBrowser.tabContainer._blockDblClick = false;
      }, 0);
    }

    try {
      TMP_ClosedTabs.setButtonDisableState();
    }
    catch (ex) { Tabmix.assert(ex, "ERROR in saveClosedTab"); }

    try {
      TabmixSessionManager.tabScrolled(tab);
    }
    catch (ex) { Tabmix.assert(ex, "ERROR in TabmixSessionManager.tabScrolled"); }

    try {
      TabmixSessionManager.tabClosed(tab);
    }
    catch (ex) { Tabmix.assert(ex, "ERROR in TabmixSessionManager.tabClosed"); }
  },

  closeLastTab: function TMP_closeLastTab() {
    if (TabmixSvc.isMac && window.location.href != getBrowserURL()) {
      closeWindow(true);
      return;
    }
    if (gBrowser.tabs.length > 1 ||
        !Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab"))
      gBrowser.removeCurrentTab({animate: true});
    else
      closeWindow(true);
  },

  closeWindow: function TMP_closeWindow(aCountOnlyBrowserWindows) {
    // we use this flag in WindowIsClosing
    window.tabmix_warnedBeforeClosing = true;

    // since that some pref can changed by _onQuitRequest we catch it fisrt
    // by observe browser-lastwindow-close-requested
    function getSavedPref(aPrefName, type) {
      let returnVal = {saved: false};
      if (aPrefName in TabmixSessionManager.savedPrefs) {
        returnVal.saved = true;
        returnVal.value = TabmixSessionManager.savedPrefs[aPrefName];
        returnVal.newValue = Services.prefs[type == "int" ? "getIntPref" : "getBoolPref"](aPrefName);
        delete TabmixSessionManager.savedPrefs[aPrefName];
      }
      else
        returnVal.value = Services.prefs[type == "int" ? "getIntPref" : "getBoolPref"](aPrefName);

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

      if (Tabmix.isVersion(200)) {
        // try to find non-private window
        let nonPrivateWindow = Tabmix.RecentWindow.getMostRecentBrowserWindow({private: false});
        if (!nonPrivateWindow)
          return false;
      }
      else if (TabmixSessionManager.globalPrivateBrowsing)
        return false;

      // last windows with tabs
      var windowtype  = aCountOnlyBrowserWindows ? "navigator:browser" : null;
      if (window.gBrowser.browsers.length < 2 || Tabmix.numberOfWindows(false, windowtype) > 1)
        return false;

      // since this pref can change by _onQuitRequest we catch it fisrt
      // by observe browser-lastwindow-close-requested
      let saveSessionPref = getSavedPref("browser.startup.page", "int");
      if (saveSessionPref.saved && saveSessionPref.value == 3)
        return false;

      // we never get to this function by restart
      // if we are still here we know that we are the last window
      // if "browser.showQuitWarning" is true firefox show "Save & Quit"
      // when we quit or close last browser window.
      // if "browser.showQuitWarning" is false and we close last window firefox design
      // to show warnAboutClosingTabs dialog but we block it in order to call warnAboutClosingTabs
      // from here and catch dispaly time here.
      return getSavedPref("browser.showQuitWarning").value;
    }

    // we always show our prompt on Mac
    var showPrompt = TabmixSvc.isMac || !isAfterFirefoxPrompt();
    // get caller caller name and make sure we are not on restart
    var quitType = Tabmix.getCallerNameByIndex(2);
    var askBeforSave = quitType != "restartApp" && quitType != "restart";
    var isLastWindow = Tabmix.isLastBrowserWindow;
    var result = TabmixSessionManager.deinit(isLastWindow, askBeforSave);
    var canClose = result.canClose;
    // we only show warnAboutClose if firefox or tabmix didn't do it already
    // if showPrompt is false then prompt was shown by firefox code from BrowserGlue.prototype._onQuitRequest
    // or from TabmixSessionManager.deinit
    if (canClose && showPrompt && result.showMorePrompt) {
      var pref = "extensions.tabmix.warnAboutClosingTabs.timeout";
      var startTime = new Date().valueOf();
      var oldTime = Services.prefs.prefHasUserValue(pref) ? Services.prefs.getCharPref(pref) : 0;
      canClose = gBrowser.warnAboutClosingTabs(gBrowser.closingTabsEnum.ALL_ONEXIT);
      Services.prefs.setCharPref(pref, oldTime*1 + (new Date().valueOf() - startTime));
    }

    TabmixSessionManager.windowIsClosing(canClose, isLastWindow, result.saveSession, result.removeClosedTabs);

    return canClose;
  },

  contentAreaOnDrop: function TMP_contentAreaOnDrop(aEvent, aUri, aPostData) {
    var where;
    var browser = gBrowser.selectedBrowser;
    if (aUri != browser.currentURI.spec) {
      let tab = gBrowser.mCurrentTab;
      let isCopy = "dataTransfer" in aEvent ?
                   (aEvent.dataTransfer.dropEffect == "copy") :
                   (aEvent.ctrlKey || aEvent.metaKey);
      if (!isCopy && tab.getAttribute("locked") &&
          !gBrowser.isBlankNotBusyTab(tab) &&
          !Tabmix.ContentClick.isUrlForDownload(aUri)) {
        where = "tab";
      }
      else
        browser.tabmix_allowLoad = true;
    }
    if (where == "tab")
      gBrowser.loadOneTab(aUri, null, null, aPostData, false, false);
    else
      loadURI(aUri, null, aPostData, false);
  },

  setURLBarFocus: function TMP_setURLBarFocus() {
    if (gURLBar)
      gURLBar.focus();
  },

  reloadTabs: function(tabs, skipTab) {
    let l = tabs.length;
    for (let i = 0; i < l; i++) {
      let tab = tabs[i];
      if (tab == skipTab || tab.linkedBrowser.__SS_restoreState == 2)
        continue;
      try {
        tab.linkedBrowser.reload();
      } catch (ex) {  }
    }
  }

}; // end tablib

Tabmix.isNewTabUrls = function Tabmix_isNewTabUrls(aUrl) {
  return this.newTabUrls.indexOf(aUrl) > -1;
};

Tabmix.newTabUrls = [
   "about:newtab", "about:blank",
   "chrome://abouttab/content/text.html",
   "chrome://abouttab/content/tab.html",
   "chrome://google-toolbar/content/new-tab.html",
   "chrome://fastdial/content/fastdial.html"
];

Tabmix.getOpenTabNextPref = function TMP_getOpenTabNextPref(aRelatedToCurrent) {
  if (Tabmix.prefs.getBoolPref("openTabNext") &&
       (!Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent") || aRelatedToCurrent))
    return true;

  return false;
};
