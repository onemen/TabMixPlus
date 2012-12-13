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

  setLoadURIWithFlags: function tablib_setLoadURIWithFlags(aBrowser) {
    // set init value according to lockallTabs state
    // we update this value in TabmixProgressListener.listener.onStateChange
    aBrowser.tabmix_allowLoad = !TabmixTabbar.lockallTabs;
    Tabmix.newCode(null, aBrowser.loadURIWithFlags)._replace(
      '{',
      '$&' +
      '  var allowLoad = this.tabmix_allowLoad != false || aURI.match(/^javascript:/);' +
      '  var tabbrowser = document.getBindingParent(this);' +
      '  var tab = tabbrowser.getTabForBrowser(this);' +
      '  var isBlankTab = tabbrowser.isBlankNotBusyTab(tab);' +
      '  var isLockedTab = tab.hasAttribute("locked");' +
      '  if (!allowLoad && !isBlankTab && isLockedTab) {' +
      '    var newTab = tabbrowser.addTab();' +
      '    tabbrowser.selectedTab = newTab;' +
      '    var browser = newTab.linkedBrowser;' +
      '    browser.stop();' +
      '    browser.tabmix_allowLoad = true;' +
      '    browser.loadURIWithFlags(aURI, aFlags, aReferrerURI, aCharset, aPostData);' +
      '    return;' +
      '  }' +
      '  this.tabmix_allowLoad = aURI == "about:blank" || !isLockedTab;'
    )._replace(
      'this.webNavigation.LOAD_FLAGS_FROM_EXTERNAL',
      'Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL', {check: "loadTabsProgressively" in window }
    ).toCode(false, aBrowser, "loadURIWithFlags");
  },

  change_gBrowser: function change_gBrowser() {
    // NRA-ILA toolbar extension raplce the original addTab function
    var _addTab = "addTab";
    if ("origAddTab7c3de167ed6f494aa652f11a71ecb40c" in gBrowser)
      _addTab = "origAddTab7c3de167ed6f494aa652f11a71ecb40c";

    Tabmix.newCode("gBrowser." + _addTab, gBrowser[_addTab])._replace(
      'params = arguments[1];',
      '$&\
       let props = ["referrerURI","charset","postData","ownerTab","allowThirdPartyFixup","fromExternal","relatedToCurrent","skipAnimation"];\
       props.forEach(function(prop){if(params[prop]) return; params[prop] = null;});'
    )._replace(
      't.setAttribute("label", aURI);',
      't.setAttribute("label", TabmixTabbar.widthFitTitle ? this.mStringBundle.getString("tabs.connecting") : aURI);'
    )._replace(
      't.className = "tabbrowser-tab";',
      '$&\
       t.setAttribute("last-tab", "true"); \
       var lastChild = this.tabContainer.lastChild; \
       if (lastChild) lastChild.removeAttribute("last-tab"); \
       if (TabmixTabbar.widthFitTitle) t.setAttribute("newtab", true);'
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
      '  if (Tabmix.isCallerInList(this.TMP_blockedCallers))' +
      '    openTabnext = false;' +
      '  else if (!Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent"))' +
      '    aRelatedToCurrent = true;' +
      '}'
    )._replace( //  new tab can trigger selection change by some extensions (divX HiQ)
      't.owner = this.selectedTab;', 't.owner = _selectedTab;'
    ).toCode();

    gBrowser.TMP_blockedCallers = ["tabbrowser_SSS_duplicateTab",
                                   "sss_restoreWindow", "ssi_restoreWindow", // ssi_restoreWindow from Firefox 16+
                                   "sss_duplicateTab", "ssi_duplicateTab", // ssi_duplicateTab from Firefox 16+
                                   "ct_SSS_undoCloseTab",
                                   "TMP_BrowserOpenTab",
                                   "TMP_PC_openGroup",
                                   "TMP_addTab"];

    // ContextMenu Extensions raplce the original removeTab function
    var _removeTab = "removeTab";
    if ("__ctxextensions__removeTab" in gBrowser)
      _removeTab = "__ctxextensions__removeTab";

    // we add compatibility fix for tabGroupManager here
    // so we don't have to work on the same function twice.
    Tabmix.newCode("gBrowser." + _removeTab, gBrowser[_removeTab])._replace(
      '{',
      '{ \
       if (aTab.hasAttribute("protected")) return;\
       if ("clearTimeouts" in aTab) aTab.clearTimeouts();'
    )._replace(
      '{',
      '{var lastTabInGroup = this.visibleTabs.length == 1;\
       if (lastTabInGroup && Tabmix.prefs.getBoolPref("keepLastTab")) return;'
    )._replace(
      // fix bug in TGM when closeing last tab in a group with animation
      'if (aParams)',
      'if (lastTabInGroup) {aParams ? aParams.animate = false : aParams = {animate: false}};\
       $&', {check: Tabmix.extensions.tabGroupManager}
    ).toCode();

    // changed by bug #563337
    if (Tabmix.isVersion(60) && !Tabmix.extensions.tabGroupManager) {
      let aboutBlank = 'this.addTab("about:blank", {skipAnimation: true});';
      let aboutNewtab = 'this.addTab(BROWSER_NEW_TAB_URL, {skipAnimation: true});';
      let code = gBrowser._beginRemoveTab.toString().indexOf(aboutNewtab) > -1 ?
                 aboutNewtab : aboutBlank;
      Tabmix.newCode("gBrowser._beginRemoveTab", gBrowser._beginRemoveTab)._replace(
        code, 'TMP_BrowserOpenTab(null, true);'
      ).toCode();
    }

    Tabmix.newCode("gBrowser._endRemoveTab", gBrowser._endRemoveTab)._replace(
      'this.addTab("about:blank", {skipAnimation: true});',
      'TMP_BrowserOpenTab(null, true);', {check: !Tabmix.isVersion(60) && !Tabmix.extensions.tabGroupManager}
    )._replace(
      'this._blurTab(aTab);',
      'tablib.onRemoveTab(aTab); \
       if (Services.prefs.getBoolPref("browser.tabs.animate")) { \
         TMP_eventListener.onTabClose_updateTabBar(aTab, true);\
       } \
       $&'
    )._replace(
      // we call focusAndSelectUrlBar from Tabmix.clearUrlBar
      // see TMP_BrowserOpenTab
      'focusAndSelectUrlBar();',
      '{/* see TMP_BrowserOpenTab */}'
    )._replace(
      'this.tabContainer.adjustTabstrip();',
      'if (!wasPinned) this.tabContainer.setFirstTabInRow();\
       $&'
    ).toCode();

    Tabmix.newCode("gBrowser._blurTab", gBrowser._blurTab)._replace(
      'if (aTab.owner &&',
      'if (false &&'
    )._replace(
      'var tab = aTab;',
      'var tab, newIndex = this.selectIndexAfterRemove(aTab);\
       if (newIndex > -1) {\
         let tabs = TMP_TabView.currentGroup();\
         tab = tabs[newIndex];\
         if (tab && this._removingTabs.indexOf(tab) == -1) {\
           this.selectedTab = tab;\
           return;\
         }\
       }\
       tab = aTab;'
    ).toCode();

    Tabmix.newCode("gBrowser.getWindowTitleForBrowser", gBrowser.getWindowTitleForBrowser)._replace(
      'if (!docTitle)',
      'var url = this.currentURI.spec; \
       if (TMP_Places.isUserRenameTab(this.mCurrentTab, url)) docTitle = this.mCurrentTab.getAttribute("fixed-label"); \
       else docTitle = TMP_Places.getTitleFromBookmark(url, docTitle, null, this.mCurrentTab); \
       $&'
    ).toCode();

    if ("foxiFrame" in window) {
      Tabmix.newCode("gBrowser.updateTitlebar", gBrowser.updateTitlebar)._replace(
        '{',
        '{try {'
      )._replace(
        /(\})(\)?)$/,
        '} catch (ex) {} \
         $1$2'
      ).toCode();
    }

    Tabmix.newCode("gBrowser.setTabTitle", gBrowser.setTabTitle)._replace(
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
       $&'
    )._replace(
      'aTab.crop = crop;',
      '$&\
       tablib.onTabTitleChanged(aTab, title == urlTitle);'
    ).toCode();

    // after bug 347930 - change Tab strip to be a toolbar
    Tabmix.newCode("gBrowser.setStripVisibilityTo", gBrowser.setStripVisibilityTo)._replace(
      'this.tabContainer.visible = aShow;',
      'if (!aShow || TabmixTabbar.hideMode != 2) $&'
    ).toCode();

    // each TabShow or TabHide trigger event that we monitor
    // we add this as an extra step
    Tabmix.newCode("gBrowser.showOnlyTheseTabs", gBrowser.showOnlyTheseTabs)._replace(
      /(\})(\)?)$/,
      'TabmixTabbar.updateScrollStatus(); \
       $1$2'
    ).toCode();

    Tabmix.originalFunctions.swapBrowsersAndCloseOther = gBrowser.swapBrowsersAndCloseOther;
    gBrowser.swapBrowsersAndCloseOther = function tabmix_swapBrowsersAndCloseOther(aOurTab, aOtherTab) {
      Tabmix.copyTabData(aOurTab, aOtherTab);
      return Tabmix.originalFunctions.swapBrowsersAndCloseOther.apply(this, arguments);
    }

    // Bug 752376 - Avoid calling scrollbox.ensureElementIsVisible()
    // if the tab strip doesn't overflow to prevent layout flushes
    gBrowser.ensureTabIsVisible = function tabmix_ensureTabIsVisible(aTab, aSmoothScroll) {
      if (this.tabContainer.overflow)
        this.tabContainer.mTabstrip.ensureElementIsVisible(aTab, aSmoothScroll);
    }
  },

  change_tabContainer: function change_tabContainer() {

    Tabmix.newCode("gBrowser.tabContainer.handleEvent", gBrowser.tabContainer.handleEvent)._replace(
      'this.adjustTabstrip',
      'TabmixTabbar._handleResize(); \
       $&'
    ).toCode();

    if (!Tabmix.extensions.verticalTabs) {
      Tabmix.newCode("gBrowser.tabContainer._positionPinnedTabs", gBrowser.tabContainer._positionPinnedTabs)._replace(
        'this.removeAttribute("positionpinnedtabs");',
        'this.resetFirstTabInRow();\
         $&'
      )._replace(
        /this.mTabstrip._scrollButtonDown.(scrollWidth|getBoundingClientRect\(\).width)/,
        'TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT ? 0 : $&'
      )._replace(
        'if (doPosition)',
        '  if (doPosition && TabmixTabbar.isMultiRow) {' +
        '    this.setAttribute("positionpinnedtabs", "true");' +
        '    let width = this.mTabstrip.scrollboxPaddingStart;' +
        '    for (let i = 0; i < numPinned; i++) {' +
        '      let tab = this.childNodes[i];' +
        '      tab.style.MozMarginStart = width + "px";' +
        '      width += tab.getBoundingClientRect().width;' +
        '    }' +
        '    if (width != this.firstTabInRowMargin) {' +
        '      this.firstTabInRowMargin = width;' +
        '      this.mTabstrip.firstVisible =  {tab: null, x: 0, y: 0};' +
        '      gTMPprefObserver.dynamicRules["tabmix-firstTabInRow"]' +
        '        .style.setProperty("-moz-margin-start", width + "px", null);' +
        '    }' +
        '    if (Tabmix.isVersion(170))' +
        '      this.style.MozPaddingStart = "";' +
        '    else' +
        '      this.style.MozMarginStart = "";' +
        '    this.mTabstrip.setFirstTabInRow();' +
        '  }' +
        '  else $&'
      ).toCode();
    }

    Tabmix.newCode("gBrowser.tabContainer._handleNewTab", gBrowser.tabContainer._handleNewTab)._replace(
      /(\})(\)?)$/,
      'TMP_eventListener.onTabOpen_delayUpdateTabBar(tab); \
       $1$2'
    ).toCode();

    // we use our own preferences observer
    Tabmix.newCode("gBrowser.tabContainer._prefObserver.observe", gBrowser.tabContainer._prefObserver.observe)._replace(
      'this.tabContainer.mCloseButtons = Services.prefs.getIntPref(data);',
      'break;'
    )._replace(
      'this.tabContainer.updateVisibility();',  ''
    ).toCode();

    if (Tabmix.isVersion(50)) {
      let tabBar = gBrowser.tabContainer;
      tabBar.TMP_inSingleRow = function Tabmix_inSingleRow(visibleTabs) {
        if (!this.hasAttribute("multibar"))
          return true;
        // we get here when we are about to go to single row
        // one tab before the last is in the first row and we are closing one tab
        var tabs = visibleTabs || this.tabbrowser.visibleTabs;
        return this.getTabRowNumber(tabs[tabs.length-2], this.topTabY) == 1;
      }

      Tabmix.newCode("gBrowser.tabContainer._lockTabSizing", gBrowser.tabContainer._lockTabSizing)._replace(
        '{',
        '{if (this.orient != "horizontal" || !Tabmix.prefs.getBoolPref("lockTabSizingOnClose")) return;'
      )._replace(
        /var isEndTab =|faviconize.o_lockTabSizing/,
        '  if (TabmixTabbar.widthFitTitle) {' +
        '    let tab, tabs = this.tabbrowser.visibleTabs;' +
        '    for (let t = aTab._tPos+1; t < this.childNodes.length; t++) {' +
        '      if (tabs.indexOf(this.childNodes[t]) > -1) {' +
        '        tab = this.childNodes[t];' +
        '        break;' +
        '      }' +
        '    }' +
        '    if (tab && !tab.pinned && !tab.collapsed) {' +
        '      let tabWidth = aTab.getBoundingClientRect().width + "px";' +
        '      tab.style.setProperty("width",tabWidth,"important");' +
        '      tab.removeAttribute("width");' +
        '      this._hasTabTempWidth = true;' +
        '      this.tabbrowser.addEventListener("mousemove", this, false);' +
        '      window.addEventListener("mouseout", this, false);' +
        '    }' +
        '    return;' +
        '  }' +
        '  if (!this.TMP_inSingleRow(tabs))' +
        '    return;' +
        '  this._tabDefaultMaxWidth = this.mTabMaxWidth;' +
        '  $&'
      ).toCode();

      Tabmix.newCode("gBrowser.tabContainer._expandSpacerBy", gBrowser.tabContainer._expandSpacerBy)._replace(
        '{',
        '{if (TabmixTabbar.widthFitTitle || !this.TMP_inSingleRow()) return;'
      ).toCode();

      Tabmix.newCode("gBrowser.tabContainer._unlockTabSizing", gBrowser.tabContainer._unlockTabSizing)._replace(
        '{','{var updateScrollStatus = this._usingClosingTabsSpacer || this._hasTabTempMaxWidth || this._hasTabTempWidth;'
      )._replace(
        /(\})(\)?)$/,
        '  if (this._hasTabTempWidth) {' +
        '    this._hasTabTempWidth = false;' +
        '    let tabs = this.tabbrowser.visibleTabs;' +
        '    for (let i = 0; i < tabs.length; i++)' +
        '      tabs[i].style.width = "";' +
        '  }' +
        '  if (updateScrollStatus) {' +
        '    if (this.childNodes.length > 1) {' +
        '      TabmixTabbar.updateScrollStatus();' +
        '      TabmixTabbar.updateBeforeAndAfter();' +
        '    }' +
        '  }' +
        '  $1$2'
      ).toCode();
    }

    // when selecting different tab fast with the mouse sometimes original onxblmousedown can call this function
    // before our mousedown handler can prevent it
    var callerName = Tabmix.isVersion(150) ? "onxblmousedown" : "setTab";
    Tabmix.newCode("gBrowser.tabContainer._selectNewTab", gBrowser.tabContainer._selectNewTab)._replace(
      '{',
      '{if(!Tabmix.prefs.getBoolPref("selectTabOnMouseDown") && Tabmix.isCallerInList("' + callerName + '")) return;'
    ).toCode();

    let _setter = gBrowser.tabContainer.__lookupSetter__("visible");
    gBrowser.tabContainer.__defineGetter__("visible", gBrowser.tabContainer.__lookupGetter__("visible"));
    Tabmix.newCode(null,  _setter)._replace(
      'this._container.collapsed = !val;',
      '  if (TabmixTabbar.hideMode == 2)' +
      '    val = false;' +
      '  $&' +
      '  let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");' +
      '  if (bottomToolbox) {' +
      '    bottomToolbox.collapsed = !val;' +
      '    gTMPprefObserver.updateTabbarBottomPosition();' +
      '  }'
    ).toSetter(gBrowser.tabContainer, "visible");

  },

  change_utility: function change_utility() {
    Tabmix.newCode("FullScreen.mouseoverToggle", FullScreen.mouseoverToggle)._replace(
      'this._isChromeCollapsed = !aShow;',
      '  $&' +
      '  if (aShow)' +
      '    TMP_eventListener.updateMultiRow();' +
      '  if (TabmixTabbar.position == 1) {' +
      '    TMP_eventListener.mouseoverToggle(aShow);' +
      '  }'
    ).toCode();

  //XXX consider to replace handleDroppedLink not use eval here
    Tabmix.newCode("handleDroppedLink", handleDroppedLink)._replace(
      'loadURI(uri, null, postData.value, false);',
      'tablib.contentAreaOnDrop(event, url, postData.value);'
    ).toCode();
    // update current browser
    gBrowser.mCurrentBrowser.droppedLinkHandler = handleDroppedLink;

    // we prevent sessionStore.duplicateTab from moving the tab
    Tabmix.newCode("duplicateTabIn", duplicateTabIn)._replace(
      'switch (where)',
      '  if (where == "window") {' +
      '    if (Tabmix.getSingleWindowMode())' +
      '      where = "tab";' +
      '  }' +
      '  else if (Tabmix.prefs.getBoolPref("openDuplicateNext")) {' +
      '    let pos = newTab._tPos > aTab._tPos ? 1 : 0;' +
      '    gBrowser.moveTabTo(newTab, aTab._tPos + pos);' +
      '  }' +
      '  $&'
    )._replace(
      'browser.tabs.loadBookmarksInBackground',
      'extensions.tabmix.loadDuplicateInBackground', {check: !Tabmix.isVersion(110)}
    )._replace(
      'gBrowser.selectedTab = newTab;',
      'if (!Tabmix.prefs.getBoolPref("loadDuplicateInBackground")) $&', {check: Tabmix.isVersion(110)}
    )._replace(
      'case "tabshifted":',
      '$&\
       if (Tabmix.prefs.getBoolPref("loadDuplicateInBackground")) gBrowser.selectedTab = newTab;', {check: Tabmix.isVersion(110)}
    ).toCode();

    Tabmix.newCode("BrowserCloseTabOrWindow", BrowserCloseTabOrWindow)._replace(
      'closeWindow(true);', // Mac
      'tablib.closeLastTab();', {check: Tabmix.isPlatform("Mac"), flags: "g"}
    )._replace(
      'gBrowser.removeCurrentTab({animate: true})',
      'tablib.closeLastTab();'
    ).toCode();

    // hide open link in window in single window mode
    if ("nsContextMenu" in window && "initOpenItems" in nsContextMenu.prototype) {
      Tabmix.newCode("nsContextMenu.prototype.initOpenItems", nsContextMenu.prototype.initOpenItems)._replace(
        'this.showItem("context-openlink", shouldShow);',
        'this.showItem("context-openlink", shouldShow && !Tabmix.singleWindowMode);'
      ).toCode();
    }

    /**
     * don't open link from external application in new window when in single window mode
     * don't open link from external application in current tab if the tab is locked
     *
     * we don't check isUrlForDownload for external links,
     * it is not likely that link in other application opened Firefox for downloading data
     */
    var _openURI = Tabmix.newCode("nsBrowserAccess.prototype.openURI", nsBrowserAccess.prototype.openURI);
    _openURI = _openURI._replace(
      'win.gBrowser.getBrowserForTab(tab);',
      '  $&' +
      '  if (currentIsBlank && aURI) {' +
      '    let loadflags = isExternal ?' +
      '        Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL :' +
      '        Ci.nsIWebNavigation.LOAD_FLAGS_NONE;' +
      '    browser.loadURIWithFlags(aURI.spec, loadflags, referrer, null, null);' +
      '  }'
    )._replace(
      'if (isExternal && (!aURI || aURI.spec == "about:blank")) {',
      'let currentIsBlank = win.gBrowser.isBlankNotBusyTab(win.gBrowser.mCurrentTab); \
       $&'
    )._replace(
      'win.BrowserOpenTab()',
      'if (currentIsBlank) tablib.setURLBarFocus(); \
      else $&'
    );

    /** patch after Bug 324164 - Unify Single Window Mode Preferences,
     *  and before Bug 509664 - Restore hidden pref browser.link.open_newwindow.override.external
     */
    _openURI = _openURI._replace(
      'aWhere = gPrefService.getIntPref("browser.link.open_newwindow");',
      'if (isExternal) {\
       aWhere = gPrefService.getIntPref("browser.link.open_newwindow.override.external");\
       if (aWhere == -1 ) $&\
       } else $&', {check: !Tabmix.isVersion(100)}
    );

    _openURI = _openURI._replace(
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
      'win.gBrowser.loadOneTab',
      'currentIsBlank ? win.gBrowser.mCurrentTab : $&'
    )._replace(
      'if (needToFocusWin',
      'if (currentIsBlank && !loadInBackground) \
         win.focus();\
       $&'
    );
    _openURI.toCode();

    // fix after Bug 606678
    // fix compatibility with Webmail Notifier
    let [fnName, fnCode] = ["openNewTabWith", openNewTabWith];
    try {
      if (com.tobwithu && com.tobwithu.wmn &&
          typeof(com.tobwithu.wmn.openNewTabWith) == "function") {
        [fnName, fnCode] = ["com.tobwithu.wmn.openNewTabWith", com.tobwithu.wmn.openNewTabWith];
      }
    } catch (ex) {}
    // inverse focus of middle/ctrl/meta clicked links
    // Firefox check for "browser.tabs.loadInBackground" in openLinkIn
    Tabmix.newCode(fnName, fnCode)._replace(
      'var originCharset = aDocument && aDocument.characterSet;',
      '  var loadInBackground = false;' +
      '  if (aEvent) {' +
      '    if (aEvent.shiftKey)' +
      '      loadInBackground = !loadInBackground;' +
      '    if (getBoolPref("extensions.tabmix.inversefocusLinks")' +
      '        && (aEvent.button == 1 || aEvent.button == 0 && (aEvent.ctrlKey || aEvent.metaKey)))' +
      '      loadInBackground = !loadInBackground;' +
      '  }' +
      '  var where = loadInBackground ? "tabshifted" : "tab";' +
      '  $&'
    )._replace(
      'aEvent && aEvent.shiftKey ? "tabshifted" : "tab"',
      'where'
    ).toCode();

    Tabmix.newCode("FillHistoryMenu", FillHistoryMenu)._replace(
      'entry.title',
      'tablib.menuItemTitle(entry)', {flags: "g"}
    ).toCode();

    // Fix for Fast Dial
    if ("BrowserGoHome" in window || "BrowserGoHome" in FdTabLoader) {
      let loader = "FdTabLoader" in window && "BrowserGoHome" in FdTabLoader;
      let obj = loader ? FdTabLoader : window;
      let fnName = loader ? "FdTabLoader.BrowserGoHome" : "BrowserGoHome";
      Tabmix.newCode(fnName , obj.BrowserGoHome)._replace(
        'var where = whereToOpenLink(aEvent, false, true);',
        '$& \ if (where == "current" && Tabmix.whereToOpen(false).inNew) where = "tab";'
      )._replace(
       'loadOneOrMoreURIs(homePage);',
       '$& \
        gBrowser.ensureTabIsVisible(gBrowser.selectedTab);'
      ).toCode();
    }

    Tabmix.newCode("newWindowButtonObserver.onDragOver", newWindowButtonObserver.onDragOver)._replace(
      '{',
      '{ \
       if (Tabmix.singleWindowMode) { \
         if (!aEvent.target.hasAttribute("disabled")) \
           aEvent.target.setAttribute("disabled", true);\
         return; \
       }'
    ).toCode();

    Tabmix.newCode("newWindowButtonObserver.onDrop", newWindowButtonObserver.onDrop)._replace(
      '{',
      '{if (Tabmix.singleWindowMode) return;'
    ).toCode();

    Tabmix.newCode("warnAboutClosingWindow", warnAboutClosingWindow)._replace(
      'return gBrowser.warnAboutClosingTabs(true);',
      'return tablib.closeWindow(true);', {flags: "g"}
    )._replace(
      'os.notifyObservers(null, "browser-lastwindow-close-granted", null);',
      'if (!Tabmix.isPlatform("Mac") && !tablib.closeWindow(true)) return false;\
       $&'
    ).toCode();

    Tabmix.newCode("WindowIsClosing", WindowIsClosing)._replace(
      '{',
      '{window.tabmix_warnedBeforeClosing = false;'
    )._replace(
      'if (!reallyClose)',
      'if (reallyClose && !window.tabmix_warnedBeforeClosing)\
         reallyClose = tablib.closeWindow();\
       $&', {check: !Tabmix.isVersion(170)}
    )._replace(
      'if (!closeWindow(false, warnAboutClosingWindow))',
      'var reallyClose = closeWindow(false, warnAboutClosingWindow);\
       if (reallyClose && !window.tabmix_warnedBeforeClosing)\
         reallyClose = tablib.closeWindow();\
       if (!reallyClose)', {check: Tabmix.isVersion(170)}
    ).toCode();

    Tabmix.newCode("goQuitApplication", goQuitApplication)._replace(
      'var appStartup',
      'let closedtByToolkit = Tabmix.isCallerInList("toolkitCloseallOnUnload");' +
      'if (!TabmixSessionManager.canQuitApplication(closedtByToolkit))' +
      '  return false;' +
      '$&'
    ).toCode();

    // if user changed mode to single window mode while having closed window
    // make sure that undoCloseWindow will open the closed window in the current window
    Tabmix.newCode("undoCloseWindow", undoCloseWindow)._replace(
      'window = ss.undoCloseWindow(aIndex || 0);',
      'if (Tabmix.singleWindowMode) {\
        window = Tabmix.getTopWin();\
        let state = {windows: [TabmixSessionManager.getClosedWindowAtIndex(aIndex || 0)]};\
        TabmixSessionManager.notifyClosedWindowsChanged();\
        state = Tabmix.JSON.stringify(state);\
        ss.setWindowState(window, state, false);\
      }\
      else $&'
    ).toCode();

    // disable undo closed window when single window mode is on
    Tabmix.newCode("HistoryMenu.prototype.toggleRecentlyClosedWindows", HistoryMenu.prototype.toggleRecentlyClosedWindows)._replace(
      'if (this._ss.getClosedWindowCount() == 0)',
      'if (this._ss.getClosedWindowCount() == 0 || Tabmix.singleWindowMode)'
    ).toCode();

    if (document.getElementById("appmenu_recentlyClosedTabsMenu")) {
      HistoryMenu.prototype.populateUndoSubmenu = function PHM_populateUndoSubmenu() {
        var undoMenu = this._rootElt.getElementsByClassName("recentlyClosedTabsMenu")[0];
        var undoPopup = undoMenu.firstChild;
        if (!undoPopup.hasAttribute("context"))
          undoPopup.setAttribute("context", "tm_undocloseContextMenu");
        TMP_ClosedTabs.populateUndoSubmenu(undoPopup);
      }
    }

    // history menu open in new tab if the curren tab is locked
    // open in current tab if it blank or if middle click and setting is on
    HistoryMenu.prototype._onCommand = function HM__onCommand(aEvent) {
      TMP_Places.historyMenu(aEvent);
    }

    Tabmix.newCode("HistoryMenu.prototype._onPopupShowing", HistoryMenu.prototype._onPopupShowing)._replace(
      'this.toggleRecentlyClosedWindows();',
      '$& \
       TMP_Places.historyMenuItemsTitle(aEvent);'
    ).toCode();

    Tabmix.newCode("HistoryMenu.prototype.populateUndoWindowSubmenu", HistoryMenu.prototype.populateUndoWindowSubmenu)._replace(
      'JSON.parse(this._ss.getClosedWindowData());',
      '"parse" in JSON ? JSON.parse(this._ss.getClosedWindowData()) : Tabmix.JSON.parse(this._ss.getClosedWindowData());'
    )._replace(
      'this._ss',
      'TabmixSvc.ss', {flags: "g"}
    )._replace(
      'this._rootElt.getElementsByClassName("recentlyClosedWindowsMenu")[0];',
      'this._rootElt ? this._rootElt.getElementsByClassName("recentlyClosedWindowsMenu")[0] : document.getElementById(arguments[0]);'
    )._replace(
      'undoPopup = undoMenu.firstChild;',
      '$&\
      if (!undoPopup.hasAttribute("context")) undoPopup.setAttribute("context", "tm_undocloseWindowContextMenu");'
    )._replace(
      'let otherTabsCount = undoItem.tabs.length - 1;',
      '$&\
      if (otherTabsCount < 0) continue;'
    )._replace(
      'let menuLabel = label.replace("#1", undoItem.title)',
      'TMP_SessionStore.getTitleForClosedWindow(undoItem);\
      $&'
    )._replace( // m.fileName for new Tabmix.Sessions (look in updateSessionMenu)
      'undoPopup.appendChild(m)',
      'm.setAttribute("value", i);\
       m.fileName = "closedwindow";\
       m.addEventListener("click", TabmixSessionManager.checkForMiddleClick, false);\
       $&'
    )._replace(
      'm.id = "menu_restoreAllWindows";',
      '$& \
      m.setAttribute("value", -2);'
    )._replace(
      'm = undoPopup.appendChild(document.createElement("menuitem"));',
      '$& \
       m.id = "menu_clearClosedWindowsList"; \
       m.setAttribute("label", TabmixSvc.getString("undoClosedWindows.clear.label")); \
       m.setAttribute("value", -1); \
       m.setAttribute("oncommand", "TabmixSessionManager.forgetClosedWindow(-1);"); \
       m = undoPopup.appendChild(document.createElement("menuitem"));'
    ).toCode();

    var popup = document.getElementById("historyUndoWindowPopup");
    if (popup)
      popup.setAttribute("context", "tm_undocloseWindowContextMenu");

    Tabmix.newCode("switchToTabHavingURI", switchToTabHavingURI)._replace(
      'gBrowser.selectedBrowser.loadURI(aURI.spec);',
      '{$& \
       gBrowser.ensureTabIsVisible(gBrowser.selectedTab);}'
    ).toCode();

  },

  addNewFunctionsTo_gBrowser: function addNewFunctionsTo_gBrowser() {
    gBrowser.TMP_openURI = function Tabmix_openURI(uri, aReferrer, aPostData, aAllowThirdPartyFixup) {
      var openNewTab = Tabmix.whereToOpen(true).lock;
      if (openNewTab)
        this.loadOneTab(uri, aReferrer, null, aPostData, false, aAllowThirdPartyFixup);
      else {
        loadURI(uri, aReferrer, aPostData, aAllowThirdPartyFixup);
        gBrowser.ensureTabIsVisible(gBrowser.selectedTab);
      }
    }

    gBrowser.duplicateTab = function tabbrowser_duplicateTab(aTab, aHref, aTabData, disallowSelect, dontFocuseUrlBar) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      var newTab = null;
      // try to have SessionStore duplicate the given tab

      if (!aHref && !aTabData) {
        newTab = TabmixSvc.ss.duplicateTab(window, aTab);
      }
      else
        newTab = this.SSS_duplicateTab(aTab, aHref, aTabData);

      if (!newTab && aTabData)
        throw new Error("Tabmix was unable to restore closed tab to new window");

      // sessionstore duplicateTab failed
      if (!newTab)
        retuen;

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
        let url = !dontFocuseUrlBar ? aHref || this.getBrowserForTab(aTab).currentURI.spec : null;
        this.TMP_selectNewForegroundTab(newTab, bgPref, url, false);
      }

      return newTab;
    }

    gBrowser.SSS_duplicateTab = function tabbrowser_SSS_duplicateTab(aTab, aHref, aTabData) {
      var newTab = null;
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
        var self = this;
      function updateNewHistoryTitle(aEvent) {
        try {
          this.removeEventListener("load", updateNewHistoryTitle, true);
          var history = this.webNavigation.sessionHistory;
          var shEntry = history.getEntryAtIndex(history.index, false).QueryInterface(Ci.nsISHEntry);
          shEntry.setTitle(self.getTabForBrowser(this).label);
        } catch (ex) {Tabmix.assert(ex);}
      }
      try {
        var newTab, tabState;
        tabState = aTabData ? aTabData.state : Tabmix.JSON.parse(TabmixSvc.ss.getTabState(aTab));
        newTab = this.addTab("about:blank");
        newTab.linkedBrowser.stop();
        if (aHref) {
          addNewHistoryEntry();
          newTab.linkedBrowser.addEventListener("load", updateNewHistoryTitle, true);
        }
        tabState.pinned = false;
        TabmixSvc.ss.setTabState(newTab, Tabmix.JSON.stringify(tabState));
      } catch (ex) {Tabmix.assert(ex);}

      return newTab;
    }

    gBrowser.duplicateInWindow = function (aTab, aMoveTab, aTabData) {
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
        let newTab = this.duplicateTab(aTab, null, aTabData, true, true);
        this.hideTab(newTab);
        this.replaceTabWithWindow(newTab);
      }
    }

    gBrowser.openLinkWithHistory = function (aTab) {
      var url = gContextMenu.linkURL;
      if (!isValidUrl(url))
         url = null;

      var newTab = this.duplicateTab(aTab, url, null, url == null);

      if (!url) {
        try {
          // flip aTab with newTab
          // and dispatch click event on the link....
          newTab.removeAttribute("busy");
          this.setIcon(newTab, this.getBrowserForTab(aTab).mIconURL);
          newTab.label = aTab.label;
          newTab.width = aTab.width;

          var index = newTab._tPos;
          this.moveTabTo(newTab, aTab._tPos);
          var pos = index > aTab._tPos ? 1 : 0;
          this.moveTabTo(aTab, index + pos);

          if (Tabmix.prefs.getBoolPref("loadDuplicateInBackground")) {
            this.selectedTab = newTab;
            aTab.removeAttribute("visited");
            aTab.removeAttribute("flst_id");
          }
          else {
            aTab.owner = newTab;
            this.selectedTab = aTab;
            newTab.setAttribute("flst_id", new Date().getTime());
            newTab.setAttribute("visited", true);
            newTab.setAttribute("dontremovevisited", true);
            aTab.setAttribute("flst_id", new Date().getTime());
          }

          var event = document.createEvent("Events");
          event.initEvent("click", true, true);
          event.getPreventDefault = function () { return false; }
          gContextMenu.target.dispatchEvent(event);

          newTab = aTab;
        }
        catch (ex) {Tabmix.assert(ex);}
      }

      return newTab;
    }

    gBrowser.openInverseLink = function () {
      var url = gContextMenu.linkURL;
      if (!isValidUrl(url))
        return null;

      // aTab is for treeStyleTab extension look in treeStyleTab hacks.js
      var aTab = this.selectedTab;

      var bgPref = Services.prefs.getBoolPref("browser.tabs.loadInBackground");
      var newTab = this.loadOneTab(url, null, null, null, !bgPref, true);
      if (url == "about:blank")
        tablib.setURLBarFocus();
      return newTab;
    }

///XXX why we add this to window ?
    window.isValidUrl = function (aUrl) {
      // valid urls don't contain spaces ' '; if we have a space it isn't a valid url.
      // Also disallow dropping javascript: or data: urls--bail out
      if (!aUrl || !aUrl.length || aUrl.indexOf(" ", 0) != -1 ||
           /^\s*(javascript|data):/.test(aUrl))
        return false;

      return true;
    }

    gBrowser.closeAllTabs = function TMP_closeAllTabs() {
      // fix bug in TGM when closeing all tabs in a group with animation
      var animate = !("TMP_TabGroupsManager" in window);

      // when we close window with last tab and we don't have protected tabs
      // we need to warn the user with the proper warning
      var warning = "All";
      if (Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab") &&
            !Tabmix.prefs.getBoolPref("keepLastTab") &&
            this.tabContainer.getElementsByAttribute("protected", true).length == 0 &&
            (!("permaTabs" in window) || this.tabContainer.getElementsByAttribute("isPermaTab", true).length == 0) &&
            this._numPinnedTabs == 0) {
        warning = "All_onExit";
      }
      if (this.warnAboutClosingTabs(warning)) {
        var childNodes = this.visibleTabs;
        if (TabmixTabbar.visibleRows > 1)
          this.tabContainer.updateVerticalTabStrip(true)
        this.moveTabTo(this.mCurrentTab, 0);
        for (var i = childNodes.length - 1; i >= 0; --i) {
          if (!childNodes[i].pinned)
            this.removeTab(childNodes[i], {animate: false});
        }
        if (!this.mCurrentTab.pinned)
          this.removeTab(this.mCurrentTab, {animate: animate});
          // _handleTabSelect will call mTabstrip.ensureElementIsVisible
      }
    }

    gBrowser.closeGroupTabs = function TMP_closeGroupTabs(aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      var URL = this.getBrowserForTab(aTab).currentURI.spec;
      var matches = URL.match(/(^.*\/)(.*)/);
      var aDomain = matches ?  matches[1] : URL;

      if (this.warnAboutClosingTabs("Group", null, null, aDomain)) {
        var childNodes = this.visibleTabs;
        for (var i = childNodes.length - 1; i > -1; --i) {
          if (childNodes[i] != aTab && !childNodes[i].pinned &&
              this.getBrowserForTab(childNodes[i]).currentURI.spec.indexOf(aDomain) != -1)
            this.removeTab(childNodes[i]);
        }
        if (!aTab.pinned) {
          this.removeTab(aTab, {animate: true});
          this.ensureTabIsVisible(this.selectedTab);
        }
      }
    }

    gBrowser._closeLeftTabs = function (aTab) {
      if (Tabmix.ltr)
        this.closeLeftTabs(aTab);
      else
        this.closeRightTabs(aTab);
    }

    gBrowser._closeRightTabs = function (aTab) {
      if (Tabmix.ltr)
        this.closeRightTabs(aTab);
      else
        this.closeLeftTabs(aTab);
    }

    gBrowser.closeRightTabs = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      var childNodes = this.visibleTabs;
      var tabPos = childNodes.indexOf(this.tabs.item(aTab._tPos));
      if (this.warnAboutClosingTabs("Right", tabPos)) {
        if (aTab._tPos < this.mCurrentTab._tPos)
          this.selectedTab = aTab;

        for (var i = childNodes.length - 1; i > tabPos; i--) {
          if (!childNodes[i].pinned)
            this.removeTab(childNodes[i]);
        }
      }
    }

    gBrowser.closeLeftTabs = function TMP_closeLeftTabs(aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      var childNodes = this.visibleTabs;
      var tabPos = childNodes.indexOf(this.tabs.item(aTab._tPos));
      if (this.warnAboutClosingTabs("Left", tabPos)) {
        if (aTab._tPos > this.mCurrentTab._tPos) {
          this.selectedTab = aTab;
        }
        this.ensureTabIsVisible(this.selectedTab);

        for (var i = tabPos - 1; i >= 0; i--) {
          if (!childNodes[i].pinned)
            this.removeTab(childNodes[i]);
        }
      }
    }

    gBrowser.removeAllTabsBut = function TMP_removeAllTabsBut(aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;

      if (this.warnAboutClosingTabs("AllBut", null, aTab._isProtected)) {
        if (aTab != this.mCurrentTab)
          this.selectedTab = aTab;
        this.ensureTabIsVisible(this.selectedTab);
        var childNodes = this.visibleTabs;
        if (TabmixTabbar.visibleRows > 1)
          this.tabContainer.updateVerticalTabStrip(true)
        for (var i = childNodes.length - 1; i >= 0; --i) {
          if (childNodes[i] != aTab && !childNodes[i].pinned)
            this.removeTab(childNodes[i]);
        }
      }
    }

    gBrowser._reloadLeftTabs = function (aTab) {
      if (Tabmix.ltr)
        this.reloadLeftTabs(aTab);
      else
        this.reloadRightTabs(aTab);
    }

    gBrowser._reloadRightTabs = function (aTab) {
      if (Tabmix.ltr)
        this.reloadRightTabs(aTab);
      else
        this.reloadLeftTabs(aTab);
    }

    gBrowser.reloadLeftTabs = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      var childNodes = this.visibleTabs;
      if ( aTab._tPos > this.mCurrentTab._tPos )
        this.selectedTab = aTab;
      for (var i = aTab._tPos - 1; i >= 0; i-- ) {
        try {
          this.getBrowserForTab(childNodes[i]).reload();
        } catch (e) {  }
      }
    }

    gBrowser.reloadRightTabs = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      var childNodes = this.visibleTabs;
      if ( aTab._tPos < this.mCurrentTab._tPos )
        this.selectedTab = aTab;
      for (var i = childNodes.length - 1; i > aTab._tPos; i-- ) {
        try {
          this.getBrowserForTab(childNodes[i]).reload();
        } catch (e) {  }
      }
    }

    gBrowser.reloadAllTabsBut = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      else
        this.selectedTab = aTab;
      var childNodes = this.visibleTabs;
      for (var i = childNodes.length - 1; i >= 0; --i) {
        if (childNodes[i] == aTab)
           continue;
        try {
          this.getBrowserForTab(childNodes[i]).reload();
        } catch (e) {  }
      }
    }

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
      TabmixSessionManager.updateTabProp(aTab);
    }

    gBrowser.protectTab = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      if ( aTab.hasAttribute("protected") )
        aTab.removeAttribute("protected");
      else
        aTab.setAttribute("protected", "true");
      TabmixSessionManager.updateTabProp(aTab);
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
        TabmixTabbar.updateBeforeAndAfter();
      }
    }

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
      TabmixSessionManager.updateTabProp(aTab);
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
        TabmixTabbar.updateBeforeAndAfter();
      }
    }

    gBrowser.SelectToMerge = function(aTab) {
      if (Tabmix.singleWindowMode && Tabmix.numberOfWindows() == 1) return;
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      if (aTab.hasAttribute("mergeselected")) {
        aTab.removeAttribute("mergeselected");
        aTab.label = aTab.label.substr(4);
      } else {
        aTab.setAttribute("mergeselected", "true")
        aTab.label = "(*) "+aTab.label;
      }
      if (TabmixTabbar.widthFitTitle) {
        TabmixTabbar.updateScrollStatus();
        TabmixTabbar.updateBeforeAndAfter();
      }
    }

    gBrowser.copyTabUrl = function (aTab) {
      if (aTab.localName != "tab")
        aTab = this.mCurrentTab;
      var URL = this.getBrowserForTab(aTab).contentDocument.location;

      var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                   .getService(Components.interfaces.nsIClipboardHelper);

      clipboard.copyString(URL);
    }

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
      var items = Array.filter(this.tabContainer.getElementsByAttribute("flst_id", "*"),
          function(tab) {return !tab.hidden && this._removingTabs.indexOf(tab) == -1;
      }, this);
      for (var i = 0; i < items.length; ++i ) {
        temp_id = items[i].getAttribute("flst_id");
        if (aTab && items[i] == aTab)
          continue;
        if ( temp_id && temp_id > max_id ) {
          max_id = temp_id;
          tempIndex = tabs.indexOf(items[i]);
        }
      }

      return tempIndex;
    }

    gBrowser.previousTab = function (aTab) {
      var tabs = this.visibleTabs;
      if (tabs.length == 1)
        return;
      var tempIndex = this.previousTabIndex(aTab);

      // if no flst_id go to previous tab, from first tab go to the next tab
      if (tempIndex == -1)
        this.selectedTab = aTab == tabs[0] ? TMP_TabView.nextVisibleSibling(aTab) :
                                             TMP_TabView.previousVisibleSibling(aTab);
      else
        this.selectedTab = tabs[tempIndex];

      this.selectedBrowser.focus();
    }

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
          return currentIndex == 0 ? 1 : 0;
          break;
        case 1: // left tab
          return currentIndex == 0 ? 1 : currentIndex-1 ;
          break;
        case 3: // last tab
          return currentIndex == l - 1 ? currentIndex - 1 : l - 1;
          break;
        case 6: // last opened
          let lastTabIndex, maxID = -1;
          tabs.forEach(function(tab, index) {
            if (tab == oldTab)
              return;
            let id = parseInt(tab.linkedPanel.replace('panel', ''));
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
        case 2: // opener / right  (default )
        case 5: // right tab
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
    }

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
    }

    gBrowser.warnAboutClosingTabs = function (whatToClose, tabPos, protectedTab, aDomain) {
      // try to cach call from other extensions to warnAboutClosingTabs
      if (typeof(whatToClose) == "boolean") {
        // see tablib.closeWindow comment that apply to firefox 4.0+
        if (Tabmix.isCallerInList("BG__onQuitRequest"))
          return true;

        if (!whatToClose)
          protectedTab = this.mCurrentTab._isProtected;
        whatToClose = whatToClose ? "All_onExit" : "AllBut";
      }

      var onExit = whatToClose == "All_onExit"
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
        if (numProtected > 0 && Services.prefs.getBoolPref(prefs[1]))
          shouldPrompt = 2;

        if (numTabs > 1 && Services.prefs.getBoolPref(prefs[2]))
          shouldPrompt = 3;
      }
      else if (numTabs > 1) {
        if (whatToClose == "Group" &&
            Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab") &&
            !Tabmix.prefs.getBoolPref("keepLastTab") &&
            Services.prefs.getBoolPref(prefs[2]))
          shouldPrompt = -1;
        else if (Services.prefs.getBoolPref(prefs[0]))
          shouldPrompt = 1;
      }

      if (shouldPrompt == 0)
        return true;

      var i, tabsToClose = 0;
      switch (whatToClose) {
        case "All":
          tabsToClose = numTabs - numProtected;
          break;
        case "All_onExit":
          tabsToClose = numTabs - this._removingTabs.length;
          break;
        case "AllBut":
          if (protectedTab)
            --numProtected;
          tabsToClose = numTabs - 1 - numProtected;
          break;
        case "Group":
          for ( i = numTabs - 1; i > -1; --i) {
            let tab = tabs[i];
            if (this.getBrowserForTab(tab).currentURI.spec.indexOf(aDomain) != -1 &&
                !tab._isProtected)
              tabsToClose++;
          }
          if (shouldPrompt == -1) {
            if (tabsToClose == numTabs)
              shouldPrompt = 3;
            else if (Services.prefs.getBoolPref(prefs[0]))
              shouldPrompt = 1;
            else
              return true;
          }
          break;
        case "Right":
          for ( i = 0; i < protectedTabs.length; i++ ) {
            let index = tabs.indexOf(protectedTabs[i]);
            if (index <= tabPos)
              --numProtected;
          }
          tabsToClose = numTabs - tabPos - 1 - numProtected;
          break;
        case "Left":
          for ( i = 0; i < protectedTabs.length; i++ ) {
            let index = tabs.indexOf(protectedTabs[i]);
            if (index >= tabPos)
              --numProtected;
          }
          tabsToClose = tabPos - numProtected;
          break;
      }

      if (whatToClose != "All_onExit" && tabsToClose == numTabs &&
          Tabmix.prefs.getBoolPref("keepLastTab"))
        tabsToClose--;

      if (tabsToClose <= 1 && shouldPrompt < 2)
        return true;

      // default to true: if it were false, we wouldn't get this far
      var warnOnClose = { value:true };
      var bundle = this.mStringBundle;

      var message, chkBoxLabel;
      if (shouldPrompt == 1 || numProtected == 0) {
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
                                                  (promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0)
                                                  + (promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1),
                                                  buttonLabel,
                                                  null, null,
                                                  chkBoxLabel,
                                                  warnOnClose);
      var reallyClose = (buttonPressed == 0);
      // don't set the pref unless they press OK and it's false
      if (reallyClose && !warnOnClose.value) {
        Services.prefs.setBoolPref(prefs[shouldPrompt - 1], false);
      }

      return reallyClose;
    }

    gBrowser.TMP_selectNewForegroundTab = function (aTab, aLoadInBackground, aUrl, addOwner) {
       var bgLoad = (aLoadInBackground != null) ? aLoadInBackground :
                      Services.prefs.getBoolPref("browser.tabs.loadInBackground");
       if (!bgLoad) {
          // set new tab owner
          addOwner = addOwner != null ? addOwner : true;
          if (addOwner)
             aTab.owner = this.selectedTab;
          this.selectedTab = aTab;
          if (aUrl && Tabmix.isNewTabUrls(aUrl))
            tablib.setURLBarFocus();
       }
    }

    /** DEPRECATED **/
    // we keep this function to saty compatible with other extensions that use it
    gBrowser.undoRemoveTab = function () {TMP_ClosedTabs.undoCloseTab();}
    // Tabmix don't use this function anymore
    // but treeStyleTab extension look for it
    gBrowser.restoreTab = function() { }
    gBrowser.closeTab = function(aTab) {this.removeTab(aTab);}
    gBrowser.TMmoveTabTo = gBrowser.moveTabTo;
    gBrowser.renameTab = function(aTab) {Tabmix.renameTab.editTitle(aTab);}
  },

  getTabTitle: function TMP_getTabTitle(aTab, url, title) {
    // return the current tab only if it is visible
    if (TabmixTabbar.widthFitTitle &&
        (!TMP_Places.inUpdateBatch || !TMP_Places.currentTab)) {
      let tabBar = gBrowser.tabContainer;
      let tab = gBrowser.selectedTab;
      if (tabBar.mTabstrip.isElementVisible(tab))
       TMP_Places.currentTab = tab;
    }
    if (TMP_Places.isUserRenameTab(aTab, url))
      title = aTab.getAttribute("fixed-label");
    else
      title = TMP_Places.getTitleFromBookmark(url, title, null, aTab);
    return title;
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
        TMP_Places.afterTabTitleChanged();
      if (aTab.hasAttribute("newtab"))
        aTab.removeAttribute("newtab");
    }
    else if (aTab.hasAttribute("fadein"))
      TMP_Places.afterTabTitleChanged();
    // don't keep unnecessary reference to current tab
    if (!TMP_Places.inUpdateBatch)
      TMP_Places.currentTab = null;
  },

  // make sure that our function don't break removeTab function
  onRemoveTab: function TMP_onRemoveTab(tab) {
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
    if (Tabmix.isPlatform("Mac") && window.location.href != getBrowserURL()) {
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

      var inPrivateBrowsing = Cc["@mozilla.org/privatebrowsing;1"].
                              getService(Ci.nsIPrivateBrowsingService).
                              privateBrowsingEnabled;
      if (inPrivateBrowsing)
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
      // we need to check for different Firefox version
      // in Firefox 4.0:
      // if "browser.showQuitWarning" is true firefox show "Save & Quit"
      // when we quit or close last browser window.
      // if "browser.showQuitWarning" is false and we close last window firefox design
      // to show warnAboutClosingTabs dialog but we block it in order to call warnAboutClosingTabs
      // from here and catch dispaly time here.
      return getSavedPref("browser.showQuitWarning").value;
      return true;
    }

    // we always show our prompt on Mac
    var showPrompt = Tabmix.isPlatform("Mac") || !isAfterFirefoxPrompt();
    // get caller caller name and make sure we are not on restart
    var quitType = Tabmix._getCallerNameByIndex(2);
    var askBeforSave = quitType != "restartApp" && quitType != "restart";
    var isLastWindow = Tabmix.numberOfWindows() == 1;
    var result = TabmixSessionManager.deinit(isLastWindow, askBeforSave);
    var canClose = result.canClose;
    // we only show warnAboutClose if firefox or tabmix didn't do it already
    // if showPrompt is false then prompt was shown by firefox code from BrowserGlue.prototype._onQuitRequest
    // or from TabmixSessionManager.deinit
    if (canClose && showPrompt && result.showMorePrompt) {
      var pref = "extensions.tabmix.warnAboutClosingTabs.timeout";
      var startTime = new Date().valueOf();
      var oldTime = Services.prefs.prefHasUserValue(pref) ? Services.prefs.getCharPref(pref) : 0;
      canClose = gBrowser.warnAboutClosingTabs("All_onExit");
      Services.prefs.setCharPref(pref, oldTime*1 + (new Date().valueOf() - startTime));
    }

    TabmixSessionManager.windowIsClosing(canClose, isLastWindow, result.saveSession, result.removeClosedTabs);

    return canClose;
  },

  contentAreaOnDrop: function TMP_contentAreaOnDrop(aEvent, aUri, aPostData) {
    var where;
    var browser = gBrowser.mCurrentBrowser;
    if (aUri != browser.currentURI.spec) {
      let tab = gBrowser.getTabForBrowser(browser);
      let isCopy = "dataTransfer" in aEvent ? (aEvent.dataTransfer.dropEffect == "copy") : (aEvent.ctrlKey || aEvent.metaKey);
      if (!isCopy && tab.getAttribute("locked") &&
                    !gBrowser.isBlankNotBusyTab(tab) && !Tabmix.contentAreaClick.isUrlForDownload(aUri)) {
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

///XXX only in use by MergeWindows.jsm
  dupScrollPosition: function TMP_dupScrollPosition(event) {
    var browser = this;
    var data = browser._scrollData;
    browser.removeEventListener('load', TMP_dupScrollPosition, true);
    var tab = gBrowser.getTabForBrowser(browser);
    if (tab && tab.parentNode)
      TabmixSessionManager.setScrollPosition(tab, browser, data, 15);
    delete browser._scrollData;
  },

  menuItemTitle: function TMP_menuItemTitle(entry) {
    if (entry.URI)
      return TMP_Places.getTitleFromBookmark(entry.URI.spec, entry.title);
    return entry.title;
  }

} // end tablib

Tabmix.isNewTabUrls = function Tabmix_isNewTabUrls(aUrl) {
  return this.newTabUrls.indexOf(aUrl) > -1;
}

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
}
