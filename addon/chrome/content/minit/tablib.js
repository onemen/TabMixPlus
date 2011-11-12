// code modified by Hemiola SUN, 2005-04-14 and fixed by onemen
if(!window.tablib || tablib.version != "tabmixplus")
var tablib = {
version : "tabmixplus",
_inited: false,

setLoadURIWithFlags : function tablib_setLoadURIWithFlags(aBrowser) {
  // set init value according to lockallTabs state
  // we update this value in TabmixProgressListener.onStateChange
  aBrowser.tabmix_allowLoad = !TabmixTabbar.lockallTabs;
  Tabmix.newCode(null, aBrowser.loadURIWithFlags)._replace(
    '{',
    <![CDATA[$&
      var allowLoad = this.tabmix_allowLoad != false || aURI.match(/^javascript:/);
      var tabbrowser = document.getBindingParent(this);
      var tab = tabbrowser.getTabForBrowser(this);
      var isBlankTab = tabbrowser.isBlankNotBusyTab(tab);
      var isLockedTab = tab.hasAttribute("locked");
      if (!allowLoad && !isBlankTab && isLockedTab) {
        var newTab = tabbrowser.addTab();
        tabbrowser.selectedTab = newTab;
        var browser = newTab.linkedBrowser;
        browser.stop();
        browser.tabmix_allowLoad = true;
        browser.loadURIWithFlags(aURI, aFlags, aReferrerURI, aCharset, aPostData);
        return;
      }
      this.tabmix_allowLoad = aURI == "about:blank" || !isLockedTab;
    ]]>
  )._replace(
    'this.webNavigation.LOAD_FLAGS_FROM_EXTERNAL',
    'Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL', {check: Tabmix.isVersion(40) && "loadTabsProgressively" in window }
  ).toCode(false, aBrowser, "loadURIWithFlags");
},

init : function TMP_tablib_init () {
if (this._inited)
  return;
this._inited = true;

if(gBrowser.tabs.length > 0)
  gBrowser.mCurrentTab._selected = true;

// NRA-ILA toolbar extension raplce the original addTab function
var _addTab = "addTab";
if ("origAddTab7c3de167ed6f494aa652f11a71ecb40c" in gBrowser)
  _addTab = "origAddTab7c3de167ed6f494aa652f11a71ecb40c";

var newAddtab = Tabmix.newCode("gBrowser." + _addTab, gBrowser[_addTab])._replace(
    't.setAttribute("label", aURI);',
    't.setAttribute("label", TabmixTabbar.widthFitTitle ? this.mStringBundle.getString("tabs.*") : aURI);'
    .replace("*", Tabmix.isVersion(40) ? "connecting" : "loading")
  )._replace(
    't.className = "tabbrowser-tab";',
    '$&\
     t.setAttribute("last-tab", "true"); \
     var lastChild = this.tabContainer.lastChild; \
     if (lastChild) lastChild.removeAttribute("last-tab"); \
     if (TabmixTabbar.widthFitTitle) t.setAttribute("newtab", true);'
  )._replace(
    'this._lastRelatedTab = t;',
    'if (TabmixSvc.prefs.getBoolPref("extensions.tabmix.openTabNextInverse")) $&', {check: Tabmix.isVersion(36)}
  )._replace(
    'this._lastRelatedTab || this.selectedTab', 'this._lastRelatedTab || _selectedTab', {check: Tabmix.isVersion(36)}
  )._replace( //  3.6+
    't.dispatchEvent(evt);',
    'var _selectedTab = this.selectedTab; \
     $& \
     var openTabnext = TabmixSvc.prefs.getBoolPref("extensions.tabmix.openTabNext"); \
     if (openTabnext) { \
       var callerFunction = arguments.callee.caller ? arguments.callee.caller.name : ""; \
       if (callerFunction in this.TMP_blockedCallers) \
         openTabnext = false; \
       else if (!TabmixSvc.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent")) \
         aRelatedToCurrent = true; \
     }', {check: Tabmix.isVersion(36)}
  );

if (Tabmix.isVersion(40)) {
  newAddtab = newAddtab._replace(
    't.setAttribute("crop", "end");',
    <![CDATA[$&
      t.setAttribute("tabmix_fadein", true);
      if (TabmixTabbar.widthFitTitle) {
        t.setAttribute("flex", "0");
      }
      else
        t.width = 0;
    ]]>
  )._replace(
    't.setAttribute("fadein", "true");',
    '$&\
     this.tabContainer.tabmix_handleNewTab(t, true)'
  )._replace(
    'Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent")',
    'openTabnext'
  )._replace( //  new tab can trigger selection change by some extensions (divX HiQ)
    't.owner = this.selectedTab;', 't.owner = _selectedTab'
  );
}
else {
  newAddtab = newAddtab._replace(
    'var blank = aURI == "about:blank";', // 3.5-3.6
    'var blank = !aURI || aURI == "about:blank";', {silent: true}
  )._replace( // 3.5-3.6
    't.minWidth =',
    't.style.maxWidth = t.maxWidth + "px";\
     $&'
  )._replace( // 3.5-3.6
    't.width = 0;',
    ''
  )._replace( // 3.5-3.6
    't.setAttribute("flex", "100");',
    'if (!TabmixTabbar.widthFitTitle) { \
       t.width = 0; \
       $& \
     }'
  )._replace( /* Bug 465673 Change 'Default' Tab Opening Behavior/Position for Firefox - landed on 3.6*/
    'this.mPrefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent")',
    'openTabnext', {check: Tabmix.isVersion(36)}
  )._replace( // 3.5
    't.dispatchEvent(evt);',
    '$& \
     var callerFunction = arguments.callee.caller ? arguments.callee.caller.name : "";\
     this.TMP_openTabNext(t, callerFunction);' , {check: !Tabmix.isVersion(36)}
  );
}
newAddtab.toCode();

if (Tabmix.isVersion(40)) {
  let tabBar = gBrowser.tabContainer;
  if ("_lockTabSizing" in tabBar) {
    tabBar.TMP_inSingleRow = function Tabmix_inSingleRow() {
      if (!this.hasAttribute("multibar"))
        return true;
      // we get here when we are about to go to single row 
      // one tab before the last is in the first row and we are closing one tab 
      var tabs = this.tabbrowser.visibleTabs;
      return this.getTabRowNumber(tabs[tabs.length-2], this.topTabY) == 1;
    }
    
    Tabmix.newCode("gBrowser.tabContainer._lockTabSizing", gBrowser.tabContainer._lockTabSizing)._replace(
      '{',
      <![CDATA[$&
        if (TabmixTabbar.widthFitTitle) {
          let tab, tabs = this.tabbrowser.visibleTabs;
          for (let t = aTab._tPos+1; t < this.childNodes.length; t++) {
            if (tabs.indexOf(this.childNodes[t]) > -1) {
              tab = this.childNodes[t];
              break;
            }
          }
          if (tab && !tab.pinned && !tab.collapsed) {
            let tabWidth = aTab.getBoundingClientRect().width + "px";
            tab.style.setProperty("width",tabWidth,"important");
            tab.removeAttribute("width");
            this._hasTabTempWidth = true;
            this.tabbrowser.addEventListener("mousemove", this, false);
            window.addEventListener("mouseout", this, false);
          }
          return;
        }
        if (!this.TMP_inSingleRow())
          return;
        this._tabDefaultMaxWidth = this.mTabMaxWidth
      ]]>
    ).toCode();

    Tabmix.newCode("gBrowser.tabContainer._expandSpacerBy", gBrowser.tabContainer._expandSpacerBy)._replace(
      '{',
      '{if (TabmixTabbar.widthFitTitle || !this.TMP_inSingleRow()) return;'
    ).toCode();

    Tabmix.newCode("gBrowser.tabContainer._unlockTabSizing", gBrowser.tabContainer._unlockTabSizing)._replace(
      '{','{var updateScrollStatus = this._usingClosingTabsSpacer || this._hasTabTempMaxWidth || this._hasTabTempWidth;'
    )._replace(
      /(\})(\)?)$/,
      <![CDATA[
        if (this._hasTabTempWidth) {
          this._hasTabTempWidth = false;
          let tabs = this.tabbrowser.visibleTabs;
          for (let i = 0; i < tabs.length; i++)
            tabs[i].style.width = "";
        }
        if (updateScrollStatus) {
          if (this.childNodes.length > 1) {
            TabmixTabbar.updateScrollStatus();
            TabmixTabbar.updateBeforeAndAfter();
          }
          TabmixTabbar._updateScrollLeft();
        }
        $1$2
      ]]>
    ).toCode();
  }

  Tabmix.newCode("gBrowser.tabContainer._handleNewTab", gBrowser.tabContainer._handleNewTab)._replace(
    /(\})(\)?)$/,
    'this.tabmix_handleNewTab(tab); \
     $1$2'
  ).toCode();

  // we use our own preferences observer
  Tabmix.newCode("gBrowser.tabContainer._prefObserver.observe", gBrowser.tabContainer._prefObserver.observe)._replace(
    'this.tabContainer.mCloseButtons = Services.prefs.getIntPref(data);',
    'break;'
  )._replace(
    'this.tabContainer.updateVisibility();',  ''
  ).toCode();

  Tabmix.newCode("handleDroppedLink", handleDroppedLink)._replace(
    'loadURI(uri, null, postData.value, false);',
    'TMP_contentAreaOnDrop(event, url, postData.value);'
  ).toCode();
  // update current browser
  gBrowser.mCurrentBrowser.droppedLinkHandler = handleDroppedLink;

  Tabmix.newCode("duplicateTabIn", duplicateTabIn)._replace(
    '{',
    '{ if (where == "window" && TMP_getSingleWindowMode()) where = "tab";'
  ).toCode();
}

gBrowser.TMP_blockedCallers = {tabbrowser_TMP_duplicateTab:true,
                                                     tabbrowser_SSS_duplicateTab:true,
                                                     sss_restoreWindow:true,
                                                     ct_SSS_undoCloseTab:true,
                                                     TMP_BrowserOpenTab:true,
                                                     TMP_PC_openGroup:true};

// ContextMenu Extensions raplce the original removeTab function
var _removeTab = "removeTab";
if ("__ctxextensions__removeTab" in gBrowser)
  _removeTab = "__ctxextensions__removeTab";

  if (Tabmix.isVersion(40)) {
     Tabmix.newCode("gBrowser." + _removeTab, gBrowser[_removeTab])._replace(
        '{',
        '{ \
         if (aTab.hasAttribute("protected")) return;\
         if ("clearTimeouts" in aTab) aTab.clearTimeouts();'
     )._replace(
        '{',
        '{if (this.visibleTabs.length == 1 && TabmixSvc.prefs.getBoolPref("extensions.tabmix.keepLastTab")) return;', {check: ("visibleTabs" in gBrowser)}
     )._replace(
       'aTab.removeAttribute("fadein");',
       'aTab.removeAttribute("minwidth"); \
        aTab.removeAttribute("maxwidth"); \
        delete aTab.minWidth; delete aTab.maxWidth;\
        $&'
     ).toCode();

    // we are prepare for bug #563337
    let _bug563337 = false;
    let _beginRemoveTab = gBrowser._beginRemoveTab.toString();
    if (_beginRemoveTab.indexOf('this.addTab("about:blank", {skipAnimation: true});') > -1) {
      _bug563337 = true;
      Tabmix.newCode("gBrowser._beginRemoveTab", _beginRemoveTab)._replace(
        'this.addTab("about:blank", {skipAnimation: true});',
        'TMP_BrowserOpenTab(null, true);', {check: !("TabGroupsManagerApiVer1" in window)}
      ).toCode();
    }

    // we check if browser.tabs.animate exist until bug Bug 380960 - Implement closing tabs animation will land
    Tabmix.newCode("gBrowser._endRemoveTab", gBrowser._endRemoveTab)._replace(
      'this.addTab("about:blank", {skipAnimation: true});',
      'TMP_BrowserOpenTab(null, true);', {check: !_bug563337 && !("TabGroupsManagerApiVer1" in window)}
    )._replace( // Firefox 3.7+
      'this._blurTab(aTab);',
      'TMP_onRemoveTab(aTab); \
       this.tabContainer.nextTab = 1; \
       try {var animat = TabmixSvc.prefs.getBoolPref("browser.tabs.animate");} catch (ex) {animat = false;} \
       if (animat) TMP_eventListener.onTabClose_updateTabBar(aTab, true); \
       $&'
    ).toCode();
  }
  else {
     Tabmix.newCode("gBrowser." + _removeTab, gBrowser[_removeTab])._replace(
        '{',
        '{ \
         if (this.tabs.length - this._removingTabs.length == 1 && TabmixSvc.prefs.getBoolPref("extensions.tabmix.keepLastTab")) return; \
         if (aTab.hasAttribute("protected")) return;\
         aTab.clearTimeouts();'
     ).toCode();

    Tabmix.newCode("gBrowser._endRemoveTab", gBrowser._endRemoveTab)._replace(
      'aTab.collapsed = true;',
      'if (this.tabs.length == this._removingTabs.length) aTab.collapsed = true; \
       else aTab.hidden = true;'
    )._replace( // Firefox 3.5-3.6
      'this.addTab("about:blank");',
      'TMP_BrowserOpenTab(null, true);', {check: !("TabGroupsManagerApiVer1" in window)}
    )._replace(
      'this._blurTab(aTab);',
      'TMP_onRemoveTab(aTab); \
       this.tabContainer.nextTab = 1; \
       $&'
    ).toCode();
  }

  Tabmix.newCode("gBrowser._blurTab", gBrowser._blurTab)._replace(
    'if (aTab.owner &&',
    'if (false &&'
  )._replace(
    'var tab = aTab;',
    'var tab, newIndex = this.selectIndexAfterRemove(aTab);\
     if (newIndex > -1) {\
       let tabs = Tabmix.isVersion(40) ? TMP_TabView.currentGroup() : this.tabs;\
       tab = tabs[newIndex];\
       if (tab && this._removingTabs.indexOf(tab) == -1) {\
         this.selectedTab = tab;\
         return;\
       }\
     }\
     tab = aTab;'
  ).toCode();

Tabmix.newCode("gBrowser.tabContainer._selectNewTab", gBrowser.tabContainer._selectNewTab)._replace(
'{',
'{if(!TabmixSvc.prefs.getBoolPref("extensions.tabmix.selectTabOnMouseDown") && arguments.callee.caller.name == "setTab") return; '
).toCode();

Tabmix.newCode("BrowserCloseTabOrWindow", BrowserCloseTabOrWindow)._replace(
'closeWindow(true);', // Mac
'TMP_closeLastTab();', {check: Tabmix.isPlatform("Mac"), flags: "g"}
)._replace(
'gBrowser.removeCurrentTab();', // Firefox 3.5-3.6
'TMP_closeLastTab();', {check: !Tabmix.isVersion(40), flags: "g"}
)._replace(
'gBrowser.removeCurrentTab({animate: true})', // Firefox 4.0+
'TMP_closeLastTab();', {check: Tabmix.isVersion(40)}
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
if (Tabmix.isVersion(40)) {
  _openURI = _openURI._replace(
    'win.gBrowser.getBrowserForTab(tab);',
    <![CDATA[$&
      if (currentIsBlank && aURI) {
        let loadflags = isExternal ?
                            Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL :
                            Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
        browser.loadURIWithFlags(aURI.spec, loadflags, referrer, null, null);
      }]]>
  )._replace(
    'if (isExternal && (!aURI || aURI.spec == "about:blank")) {',
    'let currentIsBlank = win.gBrowser.isBlankNotBusyTab(win.gBrowser.mCurrentTab); \
     $&'
  )._replace(
    'win.BrowserOpenTab()',
    'if (currentIsBlank) TMP_setURLBarFocus(); \
    else $&'
  );
}
else {
  _openURI = _openURI._replace(
    '("browser.tabs.loadDivertedInBackground");',
    '$& \
     let currentIsBlank = win.gBrowser.isBlankNotBusyTab(win.gBrowser.mCurrentTab);'
  );
}

// after Bug 324164 - Unify Single Window Mode Preferences
_openURI = _openURI._replace(
  'aWhere = gPrefService.getIntPref("browser.link.open_newwindow");',
  'if (isExternal) aWhere = Tabmix.getIntPref("browser.link.open_external",3); \
   else $&'
)._replace(
  'let loadBlankFirst =',
  '$& currentIsBlank ||', {check: Tabmix.isVersion(36) && !Tabmix.isVersion(40)}
);

_openURI = _openURI._replace(
  'switch (aWhere) {',
  <![CDATA[
    if (Tabmix.singleWindowMode &&
        aWhere == Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW) {
        aWhere = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
    }
    if (aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW &&
        aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWTAB) {
        let isLockTab = TMP_whereToOpen(null).lock;
        if (isLockTab) {
            aWhere = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
        }
    }
    $&]]>
)._replace(
  'win.gBrowser.loadOneTab',
  'currentIsBlank ? win.gBrowser.mCurrentTab : $&'
)._replace(
  'if (needToFocusWin',
  'if (currentIsBlank && !loadInBackground) \
     win.content.focus();\
   $&'
);
_openURI.toCode();

// fix after Bug 606678
if (Tabmix.isVersion(40)) {
  let [fnName, fnCode] = ["openNewTabWith", openNewTabWith];
  try {
    if (typeof(com.tobwithu.wmn.openNewTabWith) == "function") {
      [fnName, fnCode] = ["com.tobwithu.wmn.openNewTabWith", com.tobwithu.wmn.openNewTabWith];
    }
  } catch(ex) {}
  Tabmix.newCode(fnName, fnCode)._replace(
    'var originCharset = aDocument && aDocument.characterSet;',
    <![CDATA[
      // inverse focus of middle/ctrl/meta clicked links
      // Firefox check for "browser.tabs.loadInBackground" in openLinkIn
      var loadInBackground = false;
      if (aEvent) {
        if (aEvent.shiftKey)
          loadInBackground = !loadInBackground;
        if (getBoolPref("extensions.tabmix.inversefocusLinks")
            && (aEvent.button == 1 || aEvent.button == 0 && (aEvent.ctrlKey || aEvent.metaKey)))
          loadInBackground = !loadInBackground;
      }
      var where = loadInBackground ? "tabshifted" : "tab";
      $&
    ]]>
  )._replace(
    'aEvent && aEvent.shiftKey ? "tabshifted" : "tab"',
    'where'
  ).toCode();
}
else {
  // inverse focus of middle/ctrl/meta clicked links
  let [fnName, fnCode] = ["openNewTabWith", openNewTabWith];
  try {
    if (typeof(com.tobwithu.wmn.openNewTabWith) == "function") {
      [fnName, fnCode] = ["com.tobwithu.wmn.openNewTabWith", com.tobwithu.wmn.openNewTabWith];
    }
  } catch(ex) {}
  Tabmix.newCode(fnName, fnCode)._replace(
  'var wintype = document.documentElement.getAttribute("windowtype");',
  'if (getBoolPref("extensions.tabmix.inversefocusLinks") && aEvent && (aEvent.button == 1 || aEvent.button == 0 && ( aEvent.ctrlKey || aEvent.metaKey ))) loadInBackground = !loadInBackground;\
   $&'
  ).toCode();

  Tabmix.newCode("openNewWindowWith", openNewWindowWith)._replace(
  '{',
  '{ \
   if (Tabmix.singleWindowMode) {\
     openNewTabWith(aURL, aDocument, aPostData, null, aAllowThirdPartyFixup, aReferrer);\
     return OfflineApps._getBrowserWindowForContentWindow(gBrowser.contentWindow); \
   }'
  ).toCode();
}

Tabmix.newCode("FillHistoryMenu", FillHistoryMenu)._replace(
'entry.title',
'TMP_menuItemTitle(entry)', {flags: "g"}
).toCode();

// Chromin Frame put gBrowser.updateTitlebar in gChrominFrame._origupdateTitlebar
var fnName, objName;
/** getWindowTitleForBrowser is in Firefox from version 3.6.8 */
if(Tabmix.isVersion(36) && "getWindowTitleForBrowser" in gBrowser) {
  objName = "gBrowser";
  fnName = "getWindowTitleForBrowser";
}
else {
 let chrominFrame;
  chrominFrame = "gChrominFrame" in window && "_origupdateTitlebar" in gChrominFrame;
  fnName = chrominFrame ? "_origupdateTitlebar" : "updateTitlebar";
  objName = chrominFrame ? "gChrominFrame" : "gBrowser";
}
Tabmix.newCode(objName + "." + fnName, window[objName][fnName])._replace(
'if (!docTitle)',
'var url = this.contentDocument.baseURI || this.currentURI.spec; \
 if (this.mCurrentTab.getAttribute("label-uri") == url || this.mCurrentTab.getAttribute("label-uri") == "*") docTitle = this.mCurrentTab.getAttribute("fixed-label"); \
 else docTitle = TMP_getTitleFromBookmark(url, docTitle, this.mCurrentTab.getAttribute("tabmix_bookmarkId")); \
 $&'
).toCode();

if ("foxiFrame" in window)
Tabmix.newCode("gBrowser.updateTitlebar", gBrowser.updateTitlebar)._replace(
  '{',
  '{try {'
)._replace(
  /(\})(\)?)$/,
  '} catch (ex) {} \
   $1$2'
).toCode();

Tabmix.newCode("gBrowser.setTabTitle", gBrowser.setTabTitle)._replace(
  'var title = browser.contentTitle;',
  '$&\
   var url = browser.contentDocument.baseURI || browser.currentURI.spec;\
   var cIndex, currentTabVisible, urlTitle;\
   [title, cIndex, currentTabVisible] = tablib.getTabTitle(aTab, url, title);'
)._replace(
  'title = textToSubURI.unEscapeNonAsciiURI(characterSet, title);',
  '$&\
  urlTitle = title;'
)._replace(
  (Tabmix.isVersion(40) ? 'if (aTab.label == title' : 'aTab.label = title;'),
  'if (aTab.hasAttribute("mergeselected"))\
     title = "(*) " + title;\
   $&'
)._replace(
  (Tabmix.isVersion(40) ? 'aTab.crop = crop;' : 'aTab.setAttribute("crop", crop);'),
  '$&\
   tablib.onTabTitleChanged(aTab, currentTabVisible, cIndex, title == urlTitle);'
).toCode();

this.getTabTitle = function(aTab, url, title) {
  if (TabmixTabbar.widthFitTitle) {
    var cIndex = gBrowser.tabContainer.selectedIndex;
    var currentTabVisible = gBrowser.tabContainer.isTabVisible(cIndex);
  }
  if (aTab.getAttribute("label-uri") == url || aTab.getAttribute("label-uri") == "*")
    title = aTab.getAttribute("fixed-label");
  else
    title = TMP_getTitleFromBookmark(url, title, aTab.getAttribute("tabmix_bookmarkId"));
  return [title, cIndex, currentTabVisible];
};

this.onTabTitleChanged = function TMP_onTabTitleChanged(aTab, aCurrentTabVisible, aIndex, isUrlTitle) {
  // when TabmixTabbar.widthFitTitle is true we only have width attribute after tab reload
  // some site, like Gmail change title internaly, after load already finished and we have remove
  // width attribute
  if (!TabmixTabbar.widthFitTitle || (isUrlTitle && aTab.hasAttribute("width")))
    return;

  if (isUrlTitle && aTab.hasAttribute("width"))
    return;

  function TMP_onTabTitleChanged_update() {
    TabmixTabbar.updateScrollStatus();
    TabmixTabbar.updateBeforeAndAfter();
    if (aCurrentTabVisible)
      gBrowser.tabContainer.ensureTabIsVisible(aIndex);
  }

  if (aTab.hasAttribute("width")) {
    let width = aTab.boxObject.width;
    aTab.removeAttribute("width");
    if (width != aTab.boxObject.width)
      TMP_onTabTitleChanged_update();
    if (aTab.hasAttribute("newtab")) {
      aTab.removeAttribute("newtab");
      // on first time this tab get its full width notify background tab
      if (aTab != gBrowser.mCurrentTab)
        gBrowser.tabContainer._notifyBackgroundTab(aTab);
    }
  }
  else
    TMP_onTabTitleChanged_update();
};

// Fix for Fast Dial
if ("BrowserGoHome" in window || "BrowserGoHome" in FdTabLoader) {
  let loader = "FdTabLoader" in window && "BrowserGoHome" in FdTabLoader;
  let obj = loader ? FdTabLoader : window;
  let fnName = loader ? "FdTabLoader.BrowserGoHome" : "BrowserGoHome";
  Tabmix.newCode(fnName , obj.BrowserGoHome)._replace(
    'var where = whereToOpenLink(aEvent, false, true);',
    '$& \ if (where == "current" && TMP_whereToOpen(false).inNew) where = "tab";'
  )._replace(
   'loadOneOrMoreURIs(homePage);',
   '$& \
    gBrowser.tabContainer.ensureTabIsVisible(gBrowser.mCurrentTab._tPos);'
  ).toCode();
}

// before Firefox 3.6 newWindowButtonObserver.onDragOver return true and from version 3.6 return witout value
var newString = Tabmix.isVersion(36) ? "return;" : "return true;";
Tabmix.newCode("newWindowButtonObserver.onDragOver", newWindowButtonObserver.onDragOver)._replace(
'{',
'{ \
 if (Tabmix.singleWindowMode) { \
    if (!aEvent.target.hasAttribute("disabled")) \
       aEvent.target.setAttribute("disabled", true);\
    NEWSTRING \
 }'
)._replace('NEWSTRING', newString).toCode();

Tabmix.newCode("newWindowButtonObserver.onDrop", newWindowButtonObserver.onDrop)._replace(
'{',
'{ if (Tabmix.singleWindowMode) return;'
).toCode();

// fix webSearch to open new tab if tab is lock
Tabmix.newCode("BrowserSearch.webSearch", BrowserSearch.webSearch)._replace(
  'loadURI(searchForm, null, null, false);',
  'gBrowser.TMP_openURI(searchForm, null, null, false);', {check: !Tabmix.isVersion(40) && typeof(Omnibar) == "undefined"}
)._replace(
  'openUILinkIn(Services.search.defaultEngine.searchForm, "current");',
  'gBrowser.TMP_openURI(Services.search.defaultEngine.searchForm);', {check: Tabmix.isVersion(40) && typeof(Omnibar) == "undefined"}
).toCode();

gBrowser.TMP_openURI = function Tabmix_openURI(uri, aReferrer, aPostData, aAllowThirdPartyFixup) {
   var openNewTab = TMP_whereToOpen(true).lock;
   if (openNewTab)
      this.loadOneTab(uri, aReferrer, null, aPostData, false, aAllowThirdPartyFixup);
   else {
      loadURI(uri, aReferrer, aPostData, aAllowThirdPartyFixup);
      gBrowser.tabContainer.ensureTabIsVisible(gBrowser.mCurrentTab._tPos);
   }
}

// Firefox 3.6 Tabmix.isVersion(36)
// warnAboutClosingWindow in window from Bug 354894 29/07/2009
if ("warnAboutClosingWindow" in window) {
  Tabmix.newCode("warnAboutClosingWindow", warnAboutClosingWindow)._replace(
    'return gBrowser.warnAboutClosingTabs(true);',
    'return TMP_closeWindow(true);', {flags: "g"}
  )._replace(
    'os.notifyObservers(null, "browser-lastwindow-close-granted", null);',
    'if (!Tabmix.isPlatform("Mac") && !TMP_closeWindow(true)) return false;\
     $&'
  ).toCode();

  Tabmix.newCode("WindowIsClosing", WindowIsClosing)._replace(
    '{',
    '{window.tabmix_warnedBeforeClosing = false;'
  )._replace(
    'if (!reallyClose)',
    'if (reallyClose && !window.tabmix_warnedBeforeClosing)\
       reallyClose = TMP_closeWindow();\
    $&'
  ).toCode();
}
else {
  Tabmix.newCode("WindowIsClosing", WindowIsClosing)._replace(
    'var reallyClose = closeWindow(false, function () {return gBrowser.warnAboutClosingTabs(true);});',
    'var reallyClose = TMP_closeWindow();'
  ).toCode();
}

Tabmix.newCode("goQuitApplication", goQuitApplication)._replace(
  'var appStartup',
  'let callerFunction = arguments.callee.caller ? arguments.callee.caller.name : "";\
  let closedtByToolkit = callerFunction == "toolkitCloseallOnUnload";\
  if(!TabmixSessionManager.canQuitApplication(closedtByToolkit)) \
     return false; \
  $&'
).toCode();

  // if usr changed mode to single window mode while having closed window
  // make sure that undoCloseWindow will open the closed window in the current window
  Tabmix.newCode("undoCloseWindow", undoCloseWindow)._replace(
    'window = ss.undoCloseWindow(aIndex || 0);',
    'if (Tabmix.singleWindowMode) {\
      window = Tabmix.getTopWin();\
      let state = {windows: [TabmixSessionManager.getClosedWindowAtIndex(aIndex || 0)]};\
      TabmixSessionManager.notifyClosedWindowsChanged();\
      state = Tabmix.isVersion(40) ? Tabmix.JSON.stringify(state) : state.toSource();\
      ss.setWindowState(window, state, false);\
    }\
    else $&'
  ).toCode();

  let fn = Tabmix.isVersion(40) ? HistoryMenu.prototype.toggleRecentlyClosedWindows : HistoryMenu.toggleRecentlyClosedWindows;
  let fnName  = Tabmix.isVersion(40) ? "HistoryMenu.prototype.toggleRecentlyClosedWindows" : "HistoryMenu.toggleRecentlyClosedWindows";
  // disable undo closed window when single window mode is on
  Tabmix.newCode(fnName, fn)._replace(
    'if (this._ss.getClosedWindowCount() == 0)',
    'if (this._ss.getClosedWindowCount() == 0 || Tabmix.singleWindowMode)'
  ).toCode();

  if (Tabmix.isVersion(40) && document.getElementById("appmenu_recentlyClosedTabsMenu")) {
    HistoryMenu.prototype.populateUndoSubmenu = function PHM_populateUndoSubmenu() {
      var undoMenu = this._rootElt.getElementsByClassName("recentlyClosedTabsMenu")[0];
      var undoPopup = undoMenu.firstChild;
      if (!undoPopup.hasAttribute("context"))
        undoPopup.setAttribute("context", "tm_undocloseContextMenu");
      TMP_ClosedTabs.populateUndoSubmenu(undoPopup);
    }
  }

  var newCode;
  if (Tabmix.isVersion(40)) {
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

    fn = HistoryMenu.prototype.populateUndoWindowSubmenu;
    fnName = "HistoryMenu.prototype.populateUndoWindowSubmenu";
    newCode = Tabmix.newCode(fnName, fn)._replace(
      'JSON.parse(this._ss.getClosedWindowData());',
      '"parse" in JSON ? JSON.parse(this._ss.getClosedWindowData()) : Tabmix.JSON.parse(this._ss.getClosedWindowData());'
    )._replace(
      'this._ss',
      'TabmixSvc.ss', {flags: "g"}
    );
  }
  else {
    fn = HistoryMenu.populateUndoWindowSubmenu;
    fnName = "HistoryMenu.populateUndoWindowSubmenu";
    newCode = Tabmix.newCode(fnName, fn)._replace(
      'JSON.parse(this._ss.getClosedWindowData());',
      '"parse" in JSON ? JSON.parse(this._ss.getClosedWindowData()) : Tabmix.JSON.parse(this._ss.getClosedWindowData());'
    )
  }

  // populateUndoWindowSubmenu
  newCode._replace(
    'this._rootElt.getElementsByClassName("recentlyClosedWindowsMenu")[0];',
    'this._rootElt ? this._rootElt.getElementsByClassName("recentlyClosedWindowsMenu")[0] : document.getElementById(arguments[0]);',
    {check: Tabmix.isVersion(40)}
  )._replace(
    'var undoPopup = undoMenu.firstChild;',
    '$&\
    if (!undoPopup.hasAttribute("context")) undoPopup.setAttribute("context", "tm_undocloseWindowContextMenu");',
    {check: Tabmix.isVersion(40)}
  )._replace(
    'var undoPopup = document.getElementById("historyUndoWindowPopup");',
    'var id = arguments.length == 1 ? arguments[0] : "historyUndoWindowPopup"; \
     var undoPopup = document.getElementById(id);', {check: !Tabmix.isVersion(40)}
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
    'var m = undoPopup.appendChild(document.createElement("menuitem"));',
    '$& \
     m.id = "menu_clearClosedWindowsList"; \
     m.setAttribute("label", TabmixSvc.getString("undoClosedWindows.clear.label")); \
     if (!Tabmix.isVersion(40)) m.setAttribute("accesskey", TabmixSvc.getString("undoClosedWindows.clear.accesskey")); \
     m.setAttribute("value", -1); \
     m.setAttribute("oncommand", "TabmixSessionManager.forgetClosedWindow(-1);"); \
     m = undoPopup.appendChild(document.createElement("menuitem"));'
  ).toCode();

  var popup = document.getElementById("historyUndoWindowPopup");
  if (popup)
    popup.setAttribute("context", "tm_undocloseWindowContextMenu");

if (Tabmix.isVersion(40)) {
   Tabmix.newCode("switchToTabHavingURI", switchToTabHavingURI)._replace(
     'gBrowser.selectedBrowser.loadURI(aURI.spec);',
     '$& \
      gBrowser.tabContainer.ensureTabIsVisible(gBrowser.mCurrentTab._tPos);', {check: Tabmix.isVersion(40)}
   ).toCode();

   // check multi-row status when we get out of fullscreen
   Tabmix.newCode("FullScreen.mouseoverToggle", FullScreen.mouseoverToggle)._replace(
    'gNavToolbox.style.marginTop = aShow ? "" : - gNavToolbox.getBoundingClientRect().height + "px";',
    'gNavToolbox.collapsed = !aShow;'
   )._replace(
     'this._isChromeCollapsed = !aShow;',
     'if (aShow ) { \
       if (TabmixTabbar.hideMode == 0 || TabmixTabbar.hideMode == 1 && gBrowser.tabs.length > 1) \
         gTMPprefObserver.setTabBarVisibility(true); \
      } \
      else document.getElementById("TabsToolbar").collapsed = true; \
      $&'
   ).toCode();

   // after bug 347930 - change Tab strip to be a toolbar
   Tabmix.newCode("gBrowser.setStripVisibilityTo", gBrowser.setStripVisibilityTo)._replace(
     'this.tabContainer.visible = aShow;',
     'if (!aShow || TabmixTabbar.hideMode != 2) $&'
   ).toCode();

   let _setter = gBrowser.tabContainer.__lookupSetter__("visible");
   gBrowser.tabContainer.__defineGetter__("visible", gBrowser.tabContainer.__lookupGetter__("visible"));
   Tabmix.newCode(null,  _setter)._replace(
     'this._container.collapsed = !val;',
     'if (TabmixTabbar.hideMode == 2) val = false;\
      $&'
   ).toSetter(gBrowser.tabContainer, "visible");

  // make sure that tabs-toolbar is on the top before we enter customize toolbar mode
  var _command = document.getElementById("cmd_CustomizeToolbars");
  if (_command)
    _command.setAttribute("oncommand", "TMP_BrowserCustomizeToolbar();" + _command.getAttribute("oncommand"));
}
else {
   // check multi-row status when we get out of fullscreen
   Tabmix.newCode("FullScreen.mouseoverToggle", FullScreen.mouseoverToggle)._replace(
   'gBrowser.mStrip.setAttribute("moz-collapsed", !aShow);',
   'if (aShow && TabmixTabbar.hideMode != 2) gTMPprefObserver.setTabBarVisibility(true); \
    else $&'
   ).toCode();

   Tabmix.newCode("gBrowser.setStripVisibilityTo", gBrowser.setStripVisibilityTo)._replace(
     'this.mStrip.collapsed = !aShow;',
     'if (!aShow || TabmixTabbar.hideMode != 2) $&'
   ).toCode();
}

// not in use for firefox 3.6+
gBrowser.TMP_openTabNext = function _TMP_openTabNext(aTab, aCaller) {
   if (aCaller in this.TMP_blockedCallers)
     return;

   // the fix in TreeStyleTabBrowser 0.8.2009073102 hacks.js make new tab open in wrong place
   // when tab don't have Child tabs
   if (TabmixSvc.prefs.getBoolPref("extensions.tabmix.openTabNext")) {
      this.TMmoveTabTo(aTab, this.mCurrentTab._tPos + this.tabContainer.nextTab,1);
      if (TabmixSvc.prefs.getBoolPref("extensions.tabmix.openTabNextInverse"))
        this.tabContainer.nextTab++;
   }
}

gBrowser.TMmoveTabTo = function _TMmoveTabTo(aTab, aIndex, flag) {
  var oldPosition = aTab._tPos;
  if (oldPosition == aIndex)
    return aTab;

  // Don't allow mixing pinned and unpinned tabs.
  if (Tabmix.isVersion(40)) {
    if (aTab.pinned)
      aIndex = Math.min(aIndex, this._numPinnedTabs - 1);
    else
      aIndex = Math.max(aIndex, this._numPinnedTabs);
  }
  if (oldPosition == aIndex)
    return aTab;

  if(!(flag & 1)) this.tabContainer.nextTab = 1;
  this._lastRelatedTab = null;
  this.mTabFilters.splice(aIndex,0,this.mTabFilters.splice(aTab._tPos, 1)[0]);
  this.mTabListeners.splice(aIndex,0,this.mTabListeners.splice(aTab._tPos, 1)[0]);

  var tabCount = this.tabs.length;
  var newPos = tabCount - 1 < aIndex ? tabCount - 1 : aIndex;

  aIndex = aIndex < aTab._tPos ? aIndex: aIndex+1;
  this.mCurrentTab._selected = false;
  // use .item() instead of [] because dragging to the end of the strip goes out of
  // bounds: .item() returns null (so it acts like appendChild), but [] throws
  this.tabContainer.insertBefore(aTab, this.tabs.item(aIndex));

  // invalidate cache, because mTabContainer is about to change
  this._browsers = null;
  for (let i = 0; i < tabCount; i++) {
     this.tabs[i]._tPos = i;
     this.tabs[i]._selected = false;
  }
  this.mCurrentTab._selected = true;
  this.tabContainer.ensureTabIsVisible(aTab._tPos);

  if (aTab.pinned)
    this.tabContainer._positionPinnedTabs();

  var evt = document.createEvent("UIEvents");
  evt.initUIEvent("TabMove", true, false, window, oldPosition);
  aTab.dispatchEvent(evt);

  TabmixSessionManager.tabMoved(aTab, oldPosition, newPos);

  return aTab;
}

gBrowser.duplicateTab = function tabbrowser_duplicateTab(aTab, aHref, aTabData, disallowSelect, dontFocuseUrlBar) {
  if (aTab.localName != "tab")
    aTab = this.mCurrentTab;

  var newTab = null;
  // try to have SessionStore duplicate the given tab
  newTab = this.SSS_duplicateTab(aTab, aHref, aTabData);

  if(!newTab && aTabData)
    throw new Error("Tabmix was unable to restore closed tab to new window");

  // if SSS_duplicateTab failed fall back to TMP_duplicateTab
  if(!newTab)
    newTab = this.TMP_duplicateTab(aTab, aHref);

  if (Tabmix.isVersion(36))
    this.selectedBrowser.focus();
  else
    focusElement(content);

  // move new tab to place before we select it
  if (!disallowSelect && !copyToNewWindow && TabmixSvc.prefs.getBoolPref("extensions.tabmix.openDuplicateNext")) {
    let pos = newTab._tPos > aTab._tPos ? 1 : 0;
    this.TMmoveTabTo(newTab, aTab._tPos+pos);
  }

  var bgPref = TabmixSvc.prefs.getBoolPref("extensions.tabmix.loadDuplicateInBackground");
  var copyToNewWindow = window != aTab.ownerDocument.defaultView;
  if (!disallowSelect && !bgPref) {
    newTab.owner = copyToNewWindow ? null : aTab;
    let url = !dontFocuseUrlBar ? aHref || this.getBrowserForTab(aTab).currentURI.spec : null;
    this.TMP_selectNewForegroundTab(newTab, bgPref, url, false);
  }

  return newTab;
}

gBrowser.SSS_duplicateTab = function tabbrowser_SSS_duplicateTab(aTab, aHref, aTabData) {
  var newTab = null;
  try {
    var newTab, tabState;
    // add new history entry after current index
    function addNewHistoryEntry() {
      var activeIndex = (tabState.index || tabState.entries.length) - 1;
      var entriesToRemove = 0;
      var newEntry = { url: aHref }; // we don't know the page title at this moment
      tabState.entries.splice(activeIndex + 1 , entriesToRemove, newEntry);
      tabState.index++;
    }
    // we need to update history title after the new page loaded for use in back/forword button
    var self = this;
    function updateNewHistoryTitle(aEvent) {
      this.removeEventListener("load", updateNewHistoryTitle, true);
      var history = this.webNavigation.sessionHistory;
      var shEntry = history.getEntryAtIndex(history.index, false).QueryInterface(Ci.nsISHEntry);
      shEntry.setTitle(self.getTabForBrowser(this).label);
    }

    tabState = aTabData ? aTabData.state : Tabmix.JSON.parse(TabmixSvc.ss.getTabState(aTab));
    newTab = this.addTab("about:blank");
    newTab.linkedBrowser.stop();
    if (aHref) {
      addNewHistoryEntry();
      newTab.linkedBrowser.addEventListener("load", updateNewHistoryTitle, true);
    }
    if (Tabmix.isVersion(40)) {
      tabState.pinned = false;
      TabmixSvc.ss.setTabState(newTab, Tabmix.JSON.stringify(tabState));
    }
    else
      TabmixSvc.ss.setTabState(newTab, tabState.toSource());
  } catch (ex) {Tabmix.assert(ex);}

  return newTab;
}

gBrowser.TMP_duplicateTab = function tabbrowser_TMP_duplicateTab(aTab, href) {
try {
  var aBrowser = this.getBrowserForTab(aTab);
  var originalHistory = aBrowser.webNavigation.sessionHistory;
  var newTab = this.addTab("about:blank");
  newTab.linkedBrowser.stop();

  var newBrowser = this.getBrowserForTab(newTab);
  var prop = TabmixSessionData.getTabProperties(aTab);
  TabmixSessionData.setTabProperties(newTab, prop);

  newBrowser.addEventListener('load', TMP_dupScrollPosition, true);
  //save scroll data and href to load after we clone tab history
  var bContent = aBrowser.contentWindow;
  newBrowser._scrollData = {
      href: href,
      _scrollX: bContent.scrollX,
      _scrollY: bContent.scrollY
  };

  Tabmix.MergeWindows.cloneTabHistory(newBrowser, Tabmix.MergeWindows.copyHistory(originalHistory));
} catch (ex) {Tabmix.assert(ex);}
  return newTab;

}

gBrowser.duplicateInWindow = function (aTab, aMoveTab, aTabData) {
  if (aTab.localName != "tab")
    aTab = this.mCurrentTab;

  if (Tabmix.singleWindowMode) {
    if (!aMoveTab)
      this.duplicateTab(aTab, null, aTabData);

    return;
  }

  if (aMoveTab) {
    this.replaceTabWithWindow(aTab);
    return;
  }

  function _restoreWindow(aWindow, aCount) {
    var tabBrowser = aWindow.gBrowser;
    // make sure sessionHistory is ready
    try {
      if (!tabBrowser.webNavigation.sessionHistory) {
        throw new Error();
      }
    }
    catch (ex) { // in case browser or history aren't ready yet
      if (aCount < 10) {
        var restoreHistoryFunc = function() {_restoreWindow(aWindow, aCount + 1); }
        aWindow.setTimeout(restoreHistoryFunc, 100);
        return;
      }
    }

    var oldTab = aWindow._duplicateData.tab;
    var tabData = aWindow._duplicateData.tabData;
    var sourceWindow = aWindow.opener;
    // we don't have to do anything if the openr not exist, or we copy only tabdata
    var moveMode = aWindow._duplicateData.move && sourceWindow && !tabData;
    if (moveMode) {
      var sourceBrowser = sourceWindow.gBrowser;
    }
    // remove unused blank tab
    var blankTabToRemove = null;
    if (tabBrowser.isBlankNotBusyTab(tabBrowser.mCurrentTab)) {
      blankTabToRemove = tabBrowser.mCurrentTab;
      blankTabToRemove.collapsed = true;
    }
    var newTab = tabBrowser.duplicateTab(oldTab, null, tabData);
    if (blankTabToRemove) {
      tabBrowser.removeTab(blankTabToRemove);
      // show button on new first tab if url exist
      try {
        var url = tabData ? tabData.state.entries[tabData.state.index - 1].url : oldTab.linkedBrowser.currentURI.spec;
      } catch(ex) { }
      tabBrowser.tabContainer.adjustTabstrip(null, url);
    }
    // make sure the new tab is in the end
    var lastIndex = tabBrowser.tabs.length - 1;
    if (newTab._tPos < lastIndex)
      tabBrowser.moveTabTo(newTab, lastIndex);

    // remove old tab and close the other window if _duplicateTab was its last tab
    if (moveMode) {
      var needToClose = "needToClose" in  sourceWindow;
      if (oldTab.parentNode) { // make sure the tab still exist before we try to remove it
        needToClose = needToClose || sourceBrowser.tabs.length == 1;
        oldTab.removeAttribute("protected");
        sourceBrowser.removeTab(oldTab);
      }

      if (needToClose)
        sourceWindow.closeWindow(true);
    }

    delete newWindow._duplicateData;
  }

  // we going to delete the moved tab after some timeout catch the flag now
  // we use this only if the tab was not exist anymore when its time to remove it
  if (aMoveTab && this.tabs.length == 1)
    window.needToClose = true;

  // open new window
  var newWindow = window.openDialog( getBrowserURL(), "_blank", "chrome,all,dialog=no");
  newWindow.tabmix_afterTabduplicated = true;
  newWindow._duplicateData = {tab: aTab, tabData: aTabData, move: aMoveTab};
  newWindow.addEventListener("load", function (aEvent) {
      var win = aEvent.currentTarget;
      win.removeEventListener("load", arguments.callee, false);
      win.TMP_SessionStore.initService();
      _restoreWindow(win, 0);
  }, false);

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
      this.TMmoveTabTo(newTab, aTab._tPos);
      var pos = index > aTab._tPos ? 1 : 0;
      this.TMmoveTabTo(aTab, index + pos);

      if (TabmixSvc.prefs.getBoolPref("extensions.tabmix.loadDuplicateInBackground")) {
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

gBrowser.openHereWith = function () {
  var url = gContextMenu.linkURL;
  if (!isValidUrl(url))
     return;

  this.mCurrentBrowser.tabmix_allowLoad = true;
  openUILinkIn(gContextMenu.linkURL, "current", null, null, gContextMenu.target.ownerDocument.documentURIObject);
}

gBrowser.openInverseLink = function () {
  var url = gContextMenu.linkURL;
  if (!isValidUrl(url))
     return null;

  // aTab is for treeStyleTab extension look in treeStyleTab hacks.js
  var aTab = this.selectedTab;

  var bgPref = TabmixSvc.prefs.getBoolPref("browser.tabs.loadInBackground");
  var newTab = this.loadOneTab(url, null, null, null, !bgPref, true);
  if (url == "about:blank")
    TMP_setURLBarFocus();
  return newTab;
}

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
   if (TabmixSvc.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab") &&
               !TabmixSvc.prefs.getBoolPref("extensions.tabmix.keepLastTab") &&
               this.tabContainer.getElementsByAttribute("protected", true).length == 0 &&
               (!("permaTabs" in window) || this.tabContainer.getElementsByAttribute("isPermaTab", true).length == 0) &&
               (!Tabmix.isVersion(40) || this._numPinnedTabs == 0)) {
     warning = "All_onExit";
   }
   if (this.warnAboutClosingTabs(warning)) {
      var childNodes = Tabmix.isVersion(40) ? this.visibleTabs : this.tabs;
      this.tabContainer.overflow = false;
      if (!TabmixTabbar.isMultiRow) {
         if (this.tabContainer.collapsedTabs > 0)
            this.tabContainer.collapsedTabs = 0;
      }

      for (var i = childNodes.length - 1; i >= 0; --i) {
         if (childNodes[i] != this.mCurrentTab && !childNodes[i].pinned)
            this.removeTab(childNodes[i], {animate: animate});
      }
      if (!Tabmix.isVersion(40) || !this.mCurrentTab.pinned)
        this.removeTab(this.mCurrentTab, {animate: animate});
      // _handleTabSelect will call ensureTabIsVisible
   }
}

gBrowser.closeGroupTabs = function TMP_closeGroupTabs(aTab) {
   if (aTab.localName != "tab")
      aTab = this.mCurrentTab;

   var URL = this.getBrowserForTab(aTab).currentURI.spec;
   var matches = URL.match(/(^.*\/)(.*)/);
   var aDomain = matches ?  matches[1] : URL;

   if (this.warnAboutClosingTabs("Group", null, null, aDomain)) {
      var childNodes = Tabmix.isVersion(40) ? this.visibleTabs : this.tabs;
      if (!TabmixTabbar.isMultiRow) {
         if (this.tabContainer.collapsedTabs > 0)
            this.tabContainer.collapsedTabs = 0;
      }
      for (var i = childNodes.length - 1; i > -1; --i) {
         if (childNodes[i] != aTab && !childNodes[i].pinned &&
               this.getBrowserForTab(childNodes[i]).currentURI.spec.indexOf(aDomain) != -1)
            this.removeTab(childNodes[i], {animate: true});
      }
      if (!Tabmix.isVersion(40) || !aTab.pinned) {
        this.removeTab(aTab, {animate: true});
        this.tabContainer.ensureTabIsVisible(this.tabContainer.selectedIndex);
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

   var childNodes = Tabmix.isVersion(40) ? this.visibleTabs : this.tabs;
   var tabPos = Tabmix.isVersion(40) ? childNodes.indexOf(this.tabs.item(aTab._tPos)) : aTab._tPos;
   if (this.warnAboutClosingTabs("Right", tabPos)) {
      if ( aTab._tPos < this.mCurrentTab._tPos )
         this.selectedTab = aTab;

      for (var i = childNodes.length - 1; i > tabPos; i-- ) {
         if (!childNodes[i].pinned)
            this.removeTab(childNodes[i], {animate: true});
      }
   }
}

gBrowser.closeLeftTabs = function TMP_closeLeftTabs(aTab) {
   if (aTab.localName != "tab")
      aTab = this.mCurrentTab;

   var childNodes = Tabmix.isVersion(40) ? this.visibleTabs : this.tabs;
   var tabPos = Tabmix.isVersion(40) ? childNodes.indexOf(this.tabs.item(aTab._tPos)) : aTab._tPos;
   if (this.warnAboutClosingTabs("Left", tabPos)) {
      if ( aTab._tPos > this.mCurrentTab._tPos ) {
         this.selectedTab = aTab;
      }
      this.tabContainer.ensureTabIsVisible(this.tabContainer.selectedIndex);

      if (tabPos >= this.tabContainer.collapsedTabs)
        this.tabContainer.overflow = false;
      if (!TabmixTabbar.isMultiRow) {
         if (this.tabContainer.collapsedTabs > 0)
            this.tabContainer.collapsedTabs = 0;
      }
      for (var i = tabPos - 1; i >= 0; i-- ) {
         if (!childNodes[i].pinned)
            this.removeTab(childNodes[i], {animate: true});
      }
   }
}

gBrowser.removeAllTabsBut = function TMP_removeAllTabsBut(aTab) {
   if (aTab.localName != "tab")
      aTab = this.mCurrentTab;

   /**
   *  Firefox 4.0 prevent this function, we alow it for non menu callers
   * if (aTab.pinned)
   *   return;
   */

   if (this.warnAboutClosingTabs("AllBut", null, aTab._isProtected)) {
      if (aTab != this.mCurrentTab) {
         this.selectedTab = aTab;
      }
      this.tabContainer.ensureTabIsVisible(this.tabContainer.selectedIndex);
      var childNodes = Tabmix.isVersion(40) ? this.visibleTabs : this.tabs;
      this.tabContainer.overflow = false;
      if (!TabmixTabbar.isMultiRow) {
         if (this.tabContainer.collapsedTabs > 0)
            this.tabContainer.collapsedTabs = 0;
      }
      for (var i = childNodes.length - 1; i >= 0; --i) {
         if (childNodes[i] != aTab && !childNodes[i].pinned)
            this.removeTab(childNodes[i], {animate: true});
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
  var childNodes = Tabmix.isVersion(40) ? this.visibleTabs : this.tabs;
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
  var childNodes = Tabmix.isVersion(40) ? this.visibleTabs : this.tabs;
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
  var childNodes = Tabmix.isVersion(40) ? this.visibleTabs : this.tabs;
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

gBrowser.renameTab = function(aTab) {
   if (aTab.localName != "tab") aTab = this.mCurrentTab;
   var browser = this.getBrowserForTab(aTab);
   var url = browser.contentDocument.baseURI || browser.currentURI.spec;
   var docTitle = TMP_getTitleFromBookmark(url, browser.contentDocument.title, aTab.getAttribute("tabmix_bookmarkId"))
                            || this.mStringBundle.getString(Tabmix.isVersion(40) ? "tabs.emptyTabTitle" : "tabs.untitled");
   var tabTitle;
   if (aTab.getAttribute("label-uri") == url || aTab.getAttribute("label-uri") == "*")
      tabTitle = aTab.getAttribute("fixed-label");
   else
      tabTitle = docTitle;

   var data = {
      value: tabTitle,
      rename_all: this._renameAll != null ? this._renameAll : TabmixSvc.prefs.getBoolPref("extensions.tabmix.titlefrombookmark"),
      permanently: aTab.getAttribute("label-uri") == "*",
      resetTitle: false,
      modified: false,
      docTitle: docTitle
   };
   window.openDialog('chrome://tabmixplus/content/minit/setFixedLabel.xul', '_blank', 'chrome,modal,centerscreen', data);
   this._renameAll = data.rename_all;
   if (data.modified) {
      var label = data.value;
      if (data.rename_all)
         this.setFixLabel(label, url, !data.resetTitle && data.value != docTitle);
      else {
         var resetDefault = data.resetTitle || (data.value == docTitle && !data.permanently);
         Tabmix.setItem(aTab, "fixed-label", resetDefault ? null : label);
         var _url = resetDefault ? null : data.permanently ? "*" : url;
         Tabmix.setItem(aTab, "label-uri", _url);
         TabmixSessionManager.updateTabProp(aTab);
         if (aTab.getAttribute('label') != label) {
            aTab.setAttribute('label', label);
            if (Tabmix.isVersion(40))
              this._tabAttrModified(aTab)
            if (TabmixTabbar.widthFitTitle) {
              TabmixTabbar.updateScrollStatus();
              TabmixTabbar.updateBeforeAndAfter();
            }
            if (aTab == this.mCurrentTab)
               this.updateTitlebar();
         }
      }
   }
}

gBrowser.setFixLabel = function (label, url, setFixedLabel) {
   // if setFixedLabel is false we reset title to default
   var i, wnd, aTab, browser, enumerator = Tabmix.windowEnumerator(), titleChanged = false;
   while (enumerator.hasMoreElements()) {
      wnd = enumerator.getNext();
      for (i = 0; i < wnd.gBrowser.tabs.length; i++) {
         aTab = wnd.gBrowser.tabs[i];
         browser = wnd.gBrowser.getBrowserForTab(aTab);
         if (browser.currentURI.spec == url) {
            wnd.Tabmix.setItem(aTab, "fixed-label", setFixedLabel ? label : null);
            wnd.Tabmix.setItem(aTab, "label-uri", setFixedLabel ? url : null);
            wnd.TabmixSessionManager.updateTabProp(aTab);
            if (aTab.getAttribute('label') != label) {
               titleChanged = true;
               aTab.setAttribute('label', label);
               if (Tabmix.isVersion(40))
                  this._tabAttrModified(aTab)
               if (aTab == wnd.gBrowser.mCurrentTab)
                  wnd.gBrowser.updateTitlebar();
            }
         }
      }
      if (titleChanged && TabmixTabbar.widthFitTitle) {
         wnd.TabmixTabbar.updateScrollStatus();
         wnd.TabmixTabbar.updateBeforeAndAfter();
      }
   }
}

gBrowser.previousTabIndex = function _previousTabIndex(aTab, aTabs) {
  var temp_id, tempIndex = -1, max_id = 0;
  var tabs = Tabmix.isVersion(40) ? aTabs || this.visibleTabs : this.tabs;
  var items = Array.filter(this.tabContainer.getElementsByAttribute("flst_id", "*"),
      function(tab) {return !tab.hidden && this._removingTabs.indexOf(tab) == -1}, this);
  for (var i = 0; i < items.length; ++i ) {
    temp_id = items[i].getAttribute("flst_id");
    if (aTab && items[i] == aTab)
      continue;
    if ( temp_id && temp_id > max_id ) {
      max_id = temp_id;
      tempIndex = Tabmix.isVersion(40) ? tabs.indexOf(items[i]) : items[i]._tPos;
    }
  }

  return tempIndex;
}

if (Tabmix.isVersion(40)) {
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
}
else {
  gBrowser.previousTab = function (aTab) {
    var tabs = this.tabs;
    if (tabs.length == 1)
      return;
    var tempIndex = this.previousTabIndex(aTab);

    // if no flst_id go to previous tab, from first tab go to the next tab
    if (tempIndex == -1)
      this.selectedTab = aTab == tabs[0] ? aTab.nextSibling :
                                           aTab.previousSibling;
    else
      this.selectedTab = tabs[tempIndex];
    if (Tabmix.isVersion(36))
      this.selectedBrowser.focus();
    else
      focusElement(content);
  }
}

gBrowser.selectIndexAfterRemove = function (oldTab) {
   var tabs = Tabmix.isVersion(40) ? TMP_TabView.currentGroup() : this.tabs;
   var currentIndex = Tabmix.isVersion(40) ? tabs.indexOf(this.mCurrentTab) : this.mCurrentTab._tPos;
   if (this.mCurrentTab != oldTab)
     return currentIndex;
   var l = tabs.length;
   if (l==1)
     return 0;
   var mode = TabmixSvc.prefs.getIntPref("extensions.tabmix.focusTab");
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
            if (Tabmix.isVersion(40)) {
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
            }
            else {
              let lastTab = this.getTabForLastPanel();
              if (lastTab == oldTab && l > 1) {
                lastTab = this.getTabForBrowser(this.mPanelContainer.childNodes[l-2].firstChild);
              }
              return lastTab._tPos;
            }
      case 4: // last selected
            let tempIndex = this.previousTabIndex(oldTab, tabs);
            // if we don't find last selected we fall back to default
            if (tempIndex > -1)
               return tempIndex;
      case 2: // opener / right  (default )
      case 5: // right tab
      default:
            if (mode != 5 && TabmixSvc.prefs.getBoolPref("browser.tabs.selectOwnerOnClose") && "owner" in oldTab) {
               var owner = oldTab.owner;
               if (owner && owner.parentNode && owner != oldTab && !owner.hidden) {
                 // oldTab and owner still exist just return its position
                 let tempIndex = Tabmix.isVersion(40) ? tabs.indexOf(owner) : owner._tPos;
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

gBrowser.warnAboutClosingTabs =  function (whatToClose, tabPos, protectedTab, aDomain) {
   // try to cach call from other extensions to warnAboutClosingTabs
   if (typeof(whatToClose) == "boolean") {
      // see TMP_closeWindow
      if (arguments.callee.caller && arguments.callee.caller.name == "BG__onQuitRequest")
        return true;

      if (!whatToClose)
         protectedTab = this.mCurrentTab._isProtected;
      whatToClose = whatToClose ? "All_onExit" : "AllBut";
   }

   var onExit = whatToClose == "All_onExit"
   var tabs = Tabmix.isVersion(40) && !onExit ? this.visibleTabs : this.tabs;
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
   if (Tabmix.isVersion(40) && this._numPinnedTabs && !onExit) {
     addProtected(this.tabContainer.getElementsByAttribute("pinned", true));
   }
   if ("permaTabs" in window) {
     addProtected(this.tabContainer.getElementsByAttribute("isPermaTab", true));
   }
   if (protectedTabs.length || Tabmix.isVersion(40)) {
     addProtected(this.tabContainer.getElementsByAttribute("protected", true));
   }
   else
     protectedTabs = this.tabContainer.getElementsByAttribute("protected", true);

   var numProtected = protectedTabs.length;
   var shouldPrompt = 0;
   var prefs = ["extensions.tabmix.tabs.warnOnClose",
                "extensions.tabmix.protectedtabs.warnOnClose",
                "browser.tabs.warnOnClose"];
   if (onExit) {
      if (numProtected > 0 && TabmixSvc.prefs.getBoolPref(prefs[1]))
         shouldPrompt = 2;

      if (numTabs > 1 && TabmixSvc.prefs.getBoolPref(prefs[2]))
         shouldPrompt = 3;
   }
   else if (numTabs > 1) {
     if (whatToClose == "Group" &&
           TabmixSvc.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab") &&
           !TabmixSvc.prefs.getBoolPref("extensions.tabmix.keepLastTab") &&
           TabmixSvc.prefs.getBoolPref(prefs[2]))
        shouldPrompt = -1;
     else if (TabmixSvc.prefs.getBoolPref(prefs[0]))
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
         tabsToClose = numTabs;
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
           else if (TabmixSvc.prefs.getBoolPref(prefs[0]))
             shouldPrompt = 1;
           else
             return true;
         }
         break;
      case "Right":
         for ( i = 0; i < protectedTabs.length; i++ ) {
            let index = Tabmix.isVersion(40) ? tabs.indexOf(protectedTabs[i]) : protectedTabs[i]._tPos;
            if (index <= tabPos)
               --numProtected;
         }
         tabsToClose = numTabs - tabPos - 1 - numProtected;
         break;
      case "Left":
         for ( i = 0; i < protectedTabs.length; i++ ) {
            let index = Tabmix.isVersion(40) ? tabs.indexOf(protectedTabs[i]) : protectedTabs[i]._tPos;
            if (index >= tabPos)
               --numProtected;
         }
         tabsToClose = tabPos - numProtected;
         break;
   }

   if (tabsToClose == numTabs && TabmixSvc.prefs.getBoolPref("extensions.tabmix.keepLastTab"))
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
   var promptService = TabmixSvc.prompt;
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
      TabmixSvc.prefs.setBoolPref(prefs[shouldPrompt - 1], false);
   }

   return reallyClose;
}

gBrowser.TMP_selectNewForegroundTab = function (aTab, aLoadInBackground, aUrl, addOwner) {
   var bgLoad = (aLoadInBackground != null) ? aLoadInBackground :
                  TabmixSvc.prefs.getBoolPref("browser.tabs.loadInBackground");
   if (!bgLoad) {
      // set new tab owner
      addOwner = addOwner != null ? addOwner : true;
      if (addOwner)
         aTab.owner = this.selectedTab;
      this.selectedTab = aTab;
      if (aUrl && tabmix_isNewTabUrls(aUrl))
        TMP_setURLBarFocus();
   }
}

/** DEPRECATED **/
 // we keep this function to saty compatible with other extensions that use it
 gBrowser.undoRemoveTab = function () {TMP_ClosedTabs.undoCloseTab();}
 // Tabmix don't use this function anymore
 // but treeStyleTab extension look for it
 gBrowser.restoreTab = function() { }
 gBrowser.closeTab = function(aTab) {this.removeTab(aTab);}
}} // end tablib

function tabmix_isNewTabUrls(aUrl) {
  return tabmix_newTabUrls.indexOf(aUrl) > -1;
}

var tabmix_newTabUrls = [
   "about:blank",
   "chrome://abouttab/content/text.html",
   "chrome://abouttab/content/tab.html",
   "chrome://google-toolbar/content/new-tab.html",
   "chrome://fastdial/content/fastdial.html"
];

function TMP_getOpenTabNextPref(aRelatedToCurrent) {
  if (TabmixSvc.prefs.getBoolPref("extensions.tabmix.openTabNext") &&
       (!Tabmix.isVersion(36) || !TabmixSvc.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent") || aRelatedToCurrent))
    return true;

  return false;
}

// make sure that our function don't break removeTab function
function TMP_onRemoveTab(tab) {
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
}

function TMP_closeLastTab() {
  if (Tabmix.isPlatform("Mac") && window.location.href != getBrowserURL()) {
    closeWindow(true);
    return;
  }
  // browser.tabs.closeWindowWithLastTab exist only from Firefox 3.5
  if (gBrowser.tabs.length > 1 ||
      !Tabmix.getBoolPref("browser.tabs.closeWindowWithLastTab",false))
    gBrowser.removeCurrentTab({animate: true});
  else
    closeWindow(true);
}

function TMP_closeWindow(aCountOnlyBrowserWindows) {
  if (Tabmix.isVersion(36))
     // we use this flag in WindowIsClosing
     window.tabmix_warnedBeforeClosing = true;
  else if (!closeWindow(false))
     return false;

  // since that some pref can changed by _onQuitRequest we catch is fisrt
  // by observe browser-lastwindow-close-requested
  function getSavedPref(aPrefName, type) {
    let returnVal = {saved: false};
    if (aPrefName in TabmixSessionManager.savedPrefs) {
      returnVal.saved = true;
      returnVal.value = TabmixSessionManager.savedPrefs[aPrefName];
      returnVal.newValue = TabmixSvc.prefs[type == "int" ? "getIntPref" : "getBoolPref"](aPrefName);
      delete TabmixSessionManager.savedPrefs[aPrefName];
    }
    else
      returnVal.value = TabmixSvc.prefs[type == "int" ? "getIntPref" : "getBoolPref"](aPrefName);

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

    if (!TabmixSvc.prefs.getBoolPref("browser.warnOnQuit"))
      return false;

    if (TabmixSvc.prefs.getBoolPref("browser.sessionstore.resume_session_once"))
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
    if (Tabmix.isVersion(40)) {
      // in Firefox 4.0:
      // if "browser.showQuitWarning" is true firefox show "Save & Quit"
      // when we quit or close last browser window.
      // if "browser.showQuitWarning" is false and we close last window firefox design
      // to show warnAboutClosingTabs dialog but we block it in order to call warnAboutClosingTabs
      // from here and catch dispaly time here.
      return getSavedPref("browser.showQuitWarning").value;
    }
    else {
      // in Firefox 3.5-3.6:
      // firefox show "Save & Quit" when we quit if browser.tabs.warnOnClose is true
      let warnOnClose = getSavedPref("browser.tabs.warnOnClose");
      // user set Do not ask next time and Quit we use browser.tabs.warnOnClose
      // for warnAboutClosingTabs so disable browser.warnOnQuit
      if (warnOnClose.saved && warnOnClose.value && !warnOnClose.newValue) {
        TabmixSvc.prefs.setBoolPref("browser.tabs.warnOnClose", true);
        TabmixSvc.prefs.setBoolPref("browser.warnOnQuit", false);
      }
      return warnOnClose.value;
    }

    return true;
  }

  // we always show our prompt on Mac
  var showPrompt = Tabmix.isPlatform("Mac") || !isAfterFirefoxPrompt();
  var quitType = arguments.callee.caller.caller.name;
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
      var oldTime = TabmixSvc.prefs.prefHasUserValue(pref) ? TabmixSvc.prefs.getCharPref(pref) : 0;
      canClose = gBrowser.warnAboutClosingTabs("All_onExit");
      TabmixSvc.prefs.setCharPref(pref, oldTime*1 + (new Date().valueOf() - startTime));
  }

  TabmixSessionManager.windowIsClosing(canClose, isLastWindow, result.saveSession, result.removeClosedTabs);

  return canClose;
}

function TMP_contentAreaOnDrop(aEvent, aUri, aPostData) {
  var where;
  var browser = gBrowser.mCurrentBrowser;
  if (aUri != browser.currentURI.spec) {
    let tab = gBrowser.getTabForBrowser(browser);
    let isCopy = "dataTransfer" in aEvent ? (aEvent.dataTransfer.dropEffect == "copy") : (aEvent.ctrlKey || aEvent.metaKey);
    if (!isCopy && tab.getAttribute("locked") &&
                  !gBrowser.isBlankNotBusyTab(tab) && !TMP_isUrlForDownload(aUri)) {
      where = "tab";
    }
    else
      browser.tabmix_allowLoad = true;
  }
  if (where == "tab")
    gBrowser.loadOneTab(aUri, null, null, aPostData, false, false);
  else
    loadURI(aUri, null, aPostData, false);
}

Tabmix._bottomPosition = false;
function TMP_BrowserToolboxCustomizeDone() {
  var urlbar = document.getElementById("urlbar");
  // onblur attribut e reset each time we exit ToolboxCustomize
  if (urlbar) {
    var blur = urlbar.getAttribute("onblur") || "";
    if (blur.indexOf("TMP_urlBarOnBlur") == -1)
      urlbar.setAttribute("onblur", blur + "TMP_urlBarOnBlur();")

    // Fix incompatibility with Omnibar (O is not defined)
    // URL Dot 0.4.x extension
    let fn;
    let _Omnibar = "Omnibar" in window;
    if (_Omnibar && "intercepted_handleCommand" in urlbar) {
      fn = "intercepted_handleCommand";
      Tabmix.newCode("gURLBar.handleCommand", gURLBar.handleCommand)._replace(
        'O.handleSearchQuery',
        'window.Omnibar.handleSearchQuery', {silent: true}
      ).toCode();
    }
    else if ("urlDot" in window && "handleCommand2" in urlbar)
      fn = "handleCommand2";
    else
      fn = "handleCommand"
    let _handleCommand = fn in urlbar ? urlbar[fn].toString() : "TMP_BrowserLoadURL";
    if (_handleCommand.indexOf("TMP_BrowserLoadURL") == -1) {
      // set altDisabled if Suffix extension installed
      // dont use it for Firefox 6.0+ until new Suffix extension is out
      Tabmix.newCode("gURLBar." + fn,  _handleCommand)._replace(
        '{',
        '{ var _data, altDisabled = false; \
         if (gBrowser.tabmix_tab) {\
           delete gBrowser.tabmix_tab;\
           delete gBrowser.tabmix_userTypedValue;\
         }'
      )._replace(
        'this._canonizeURL(aTriggeringEvent);',
        '_data = $& \
         altDisabled = !Tabmix.isVersion(60) && _data.length == 3;'
      )._replace(
        'if (aTriggeringEvent instanceof MouseEvent) {',
        'let _mayInheritPrincipal = typeof(mayInheritPrincipal) == "boolean" ? mayInheritPrincipal : true;\
         TMP_BrowserLoadURL(aTriggeringEvent, postData, altDisabled, null, _mayInheritPrincipal); \
         return; \
         $&'
      ).toCode();

      // for Omnibar version 0.7.7.20110418+
      if (_Omnibar) {
        window.Omnibar.intercepted_handleCommand = urlbar[fn];
        Tabmix.newCode("Omnibar.intercepted_handleCommand", Omnibar.intercepted_handleCommand)._replace(
          'Omnibar.handleSearchQuery',
          'false && Omnibar.handleSearchQuery', {silent: true}
        ).toCode();
      }
    }
  }

  var searchbar = document.getElementById("searchbar");
  if (searchbar) {
    let searchLoadExt = "esteban_torres" in window && "searchLoad_Options" in esteban_torres;
    let _handleSearchCommand = searchLoadExt ? esteban_torres.searchLoad_Options.MOZhandleSearch.toString() : searchbar.handleSearchCommand.toString();
    // we check browser.search.openintab also for search button click
    if (_handleSearchCommand.indexOf("forceNewTab") == -1) {
      let functionName = searchLoadExt ? "esteban_torres.searchLoad_Options.MOZhandleSearch" :
                                         "document.getElementById('searchbar').handleSearchCommand";
      Tabmix.newCode(functionName,  _handleSearchCommand)._replace(
       'where = whereToOpenLink(aEvent, false, true);',
       '$& \
        var forceNewTab = where == "current" && textBox._prefBranch.getBoolPref("browser.search.openintab"); \
        if (forceNewTab) where = "tab";'
      ).toCode();
    }

    let organizeSE = "organizeSE" in window && "doSearch" in window.organizeSE;
    let _doSearch;
    if (searchLoadExt)
      _doSearch = esteban_torres.searchLoad_Options.MOZdoSearch.toString()
    else
      _doSearch = organizeSE ? window.organizeSE.doSearch.toString() : searchbar.doSearch.toString();
    if (_doSearch.indexOf("tabmixArg") == -1) {
      let functionName = searchLoadExt ? "esteban_torres.searchLoad_Options.MOZdoSearch" :
                         (organizeSE ? "window.organizeSE.doSearch" : "document.getElementById('searchbar').doSearch");
      Tabmix.newCode(functionName,  _doSearch)._replace(
        /(openUILinkIn[^\(]*\([^\)]+)(\))/,
        '$1, null, tabmixArg$2'
      )._replace(
        'openUILinkIn',
         <![CDATA[
           var tabmixArg = {backgroundPref: "extensions.tabmix.loadSearchInBackground"};
           var isBlankTab = gBrowser.isBlankNotBusyTab(gBrowser.mCurrentTab);
           var isLockTab = !isBlankTab && gBrowser.mCurrentTab.hasAttribute("locked");
           if (aWhere == "current" && isLockTab)
             aWhere = "tab";
           else if ((/^tab/).test(aWhere) && isBlankTab)
             aWhere = "current"
           $&
         ]]>
      )._replace(
        'var loadInBackground = prefs.getBoolPref("loadBookmarksInBackground");',
        'var loadInBackground = TabmixSvc.prefs.getBoolPref("extensions.tabmix.loadSearchInBackground");', {check: !searchLoadExt && organizeSE}
      ).toCode();
    }
  }

  var undocloseButton = document.getElementById("btn_undoclose");
  if (undocloseButton) {
    let isFixed = undocloseButton.hasAttribute("ondrop");
    if (!isFixed) {
      if (Tabmix.isVersion(40)) {
        undocloseButton.setAttribute("ondragover", "TMP_undocloseTabButtonObserver.onDragOver(event);");
        undocloseButton.setAttribute("ondrop", "TMP_undocloseTabButtonObserver.onDrop(event);");
        undocloseButton.setAttribute("ondragexit", "TMP_undocloseTabButtonObserver.onDragExit(event);");
      }
      else {
        undocloseButton.setAttribute("ondragover", "nsDragAndDrop.dragOver(event, TMP_undocloseTabButtonObserver);");
        undocloseButton.setAttribute("ondrop", "nsDragAndDrop.drop(event, TMP_undocloseTabButtonObserver);");
        undocloseButton.setAttribute("ondragleave", "nsDragAndDrop.dragExit(event, TMP_undocloseTabButtonObserver);");
      }
    }
  }
  if (TabmixSessionManager.enableManager == null) {
    let inPrivateBrowsing = TabmixSessionManager._inPrivateBrowsing;
    TabmixSessionManager.enableManager = TabmixSvc.SMprefs.getBoolPref("manager") && !inPrivateBrowsing;
    TabmixSessionManager.enableBackup = TabmixSvc.SMprefs.getBoolPref("crashRecovery") && !inPrivateBrowsing;
  }
  Tabmix.setItem("tmp_sessionmanagerButton", "disabled", !TabmixSessionManager.enableManager);
  TabmixSessionManager.toggleRecentlyClosedWindowsButton();

  // Show Reload Every menu on Reload button
  gTMPprefObserver.showReloadEveryOnReloadButton();

  if (Tabmix.isVersion(40)) {
    gTMPprefObserver.changeNewTabButtonSide(TabmixSvc.TMPprefs.getIntPref("newTabButton.position"));
    let alltabsPopup = document.getElementById("alltabs-popup");
    if (alltabsPopup)
      alltabsPopup.setAttribute("context", gBrowser.tabContextMenu.id);
  }

}

function TMP_BrowserCustomizeToolbar() {
  TabmixTabbar._toolboxcustomizeStart = true;
  if (TabmixTabbar.position == 1) {
    Tabmix._bottomPosition = true;
    gTMPprefObserver.tabBarPositionChanged(0);
  }
}

function TMP_setURLBarFocus() {
  if (gURLBar)
    gURLBar.focus();
}

function TMP_dupScrollPosition(event) {
  var browser = this;
  var data = browser._scrollData;
  browser.removeEventListener('load', TMP_dupScrollPosition, true);
  var tab = gBrowser.getTabForBrowser(browser);
  if (tab && tab.parentNode)
    TabmixSessionManager.setScrollPosition(tab, browser, data, 15);
  delete browser._scrollData;
}

function TMP_menuItemTitle(entry) {
   if (entry.URI)
      return TMP_getTitleFromBookmark(entry.URI.spec, entry.title);
   return entry.title;
}

/* DEPRECATED */
function TMP_BrowserCloseWindow() { Tabmix.log(TMP_D_MSG, true); }
function _confirmOpenTabs(numTabsToOpen) {
  Tabmix.log(TMP_D_MSG, true);
  return PlacesUIUtils._confirmOpenInTabs(numTabsToOpen);
}
function setTextZoom() { Tabmix.log(TMP_D_MSG, true); }
function adjustSafebrowsingDimArea() { Tabmix.log(TMP_D_MSG, true); }
function openMultipleLinks() { Tabmix.log(TMP_D_MSG, true); }
function TMP_SearchLoadURL() { Tabmix.log(TMP_D_MSG, true); }
