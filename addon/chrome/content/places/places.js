"use strict";

// code by onemen
var TMP_Places = {
  prefHistory: "extensions.tabmix.opentabfor.history",
  prefBookmark: "extensions.tabmix.opentabfor.bookmarks",

  addEvent: function TMP_PC_addEvent() {
    window.addEventListener("load", this);
    window.addEventListener("unload", this);
  },

  handleEvent: function TMP_PC_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "load":
        window.removeEventListener("load", this);
        this.init();
        Tabmix.onContentLoaded.change_utilityOverlay();
        break;
      case "unload":
        window.removeEventListener("unload", this);
        this.deinit();
        break;
      case "SSTabRestored":
        this.updateRestoringTabsList(aEvent.target);
        break;
    }
  },

  init: function TMP_PC_init() {
    Tabmix.lazy_import(this, "PlacesUtils", "Places", "TabmixPlacesUtils");
    Tabmix.lazy_import(this, "AboutNewTab", "AboutNewTab", "TabmixAboutNewTab");

    this.contextMenu.toggleEventListener(true);

    // use tab label for bookmark name when user renamed the tab
    // PlacesCommandHook exist on browser window
    if ("PlacesCommandHook" in window) {
      gBrowser.tabContainer.addEventListener("SSTabRestored", this);
      if (Tabmix.isVersion(400) && !Tabmix.isVersion(600)) {
        if (!Tabmix.originalFunctions.placesBookmarkPage) {
          Tabmix.originalFunctions.placesBookmarkPage = PlacesCommandHook.bookmarkPage;
        }
        PlacesCommandHook.bookmarkPage = function(aBrowser) {
          let origTitle;
          let tab = gBrowser.getTabForBrowser(aBrowser);
          let title = TMP_Places.getTabTitle(tab, aBrowser.currentURI.spec);
          if (typeof title == "string") {
            origTitle = aBrowser.contentTitle;
            aBrowser._contentTitle = title;
          }
          try {
            return Tabmix.originalFunctions.placesBookmarkPage.apply(this, arguments);
          } finally {
            if (origTitle) {
              setTimeout(() => (aBrowser._contentTitle = origTitle), 100);
            }
          }
        };
      } else if (!Tabmix.isVersion(400)) {
        Tabmix.changeCode(PlacesCommandHook, "PlacesCommandHook.bookmarkPage")._replace(
          /(webNav\.document\.)*title \|\| (url|uri)\.spec;/,
          'TMP_Places.getTabTitle(gBrowser.getTabForBrowser(aBrowser), url.spec) || $&'
        ).toCode();
      }

      if (!Tabmix.isVersion(490)) {
        let $LF = '\n        ';
        Tabmix.changeCode(PlacesCommandHook, "uniqueCurrentPages", {getter: true})._replace(
          'URIs.push(tab.linkedBrowser.currentURI);',
          'if (Tabmix.callerTrace("PCH_updateBookmarkAllTabsCommand")) {' + $LF +
          '  $&' + $LF +
          '} else {' + $LF +
          '  let uri = tab.linkedBrowser.currentURI;' + $LF +
          '  URIs.push({uri: uri, title: TMP_Places.getTabTitle(tab, uri.spec)});' + $LF +
          '}'
        ).defineProperty();
      }
    }

    // prevent error when closing window with sidebar open
    var docURI = window.document.documentURI;
    if (docURI == "chrome://browser/content/bookmarks/bookmarksPanel.xul" ||
        docURI == "chrome://browser/content/history/history-panel.xul") {
      let fn = "setMouseoverURL" in SidebarUtils ? "setMouseoverURL" : "clearURLFromStatusBar";
      Tabmix.changeCode(SidebarUtils, "SidebarUtils." + fn)._replace(
        '{',
        '{if (window.top.XULBrowserWindow == null) return;'
      ).toCode();
    }
  },

  deinit: function TMP_PC_deinit() {
    if ("gBrowser" in window) {
      gBrowser.tabContainer.removeEventListener("SSTabRestored", this);
      this.restoringTabs = [];
    }
    this.stopObserver();
  },

  historyMenuItemsTitle: function TMP_PC_historyMenuItemsTitle(aEvent) {
    if (!this._titlefrombookmark)
      return;

    var aMenuPopup = aEvent.target;
    if (aMenuPopup.id != "goPopup" && aMenuPopup.id != "appmenu_historyMenupopup")
      return;

    for (let i = 0; i < aMenuPopup.childNodes.length; i++) {
      let item = aMenuPopup.childNodes[i];
      if ("_placesNode" in item) {
        const url = item._placesNode.uri;
        this.asyncGetTitleFromBookmark(url).then(bookMarkName => {
          if (bookMarkName)
            item.setAttribute("label", bookMarkName);
        });
      }
    }
  },

  openMenuItem(aUri, aEvent, aParams, aPref) {
    let pref = "extensions.tabmix.opentabfor." + aPref;
    let where = this.isBookmarklet(aUri) ? "current" :
      this.fixWhereToOpen(aEvent, whereToOpenLink(aEvent, false, true), pref);
    if (where == "current")
      Tabmix.getTopWin().gBrowser.selectedBrowser.tabmix_allowLoad = true;
    aParams.inBackground = Services.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground");
    openUILinkIn(aUri, where, aParams);
  },

  idsMap: {
    "PanelUI-historyItems": "history",
    goPopup: "history",
    bookmarksMenuPopup: "bookmarks",
    BMB_bookmarksPopup: "bookmarks",
  },

  openUILink(url, event, where, params) {
    // divert all the calls from places UI to use our preferences
    //   HistoryMenu.prototype._onCommand
    //   BookmarkingUI._updateRecentBookmarks/onItemCommand
    //   CustomizableWidgets<.onViewShowing/<.handleResult/onItemCommand
    //   PlacesViewBase.prototype._setLivemarkSiteURIMenuItem
    //   FeedHandler.loadFeed
    let node = event && event.target ? event.target.parentNode : null;
    if (node) {
      // if the id is not in the list, set pref to "bookmarks" when
      // _placesNode exist
      let pref = this.idsMap[node.id] || node._placesNode && "bookmarks";
      if (pref) {
        this.openMenuItem(url, event, params, pref);
        return null;
      }
    }

    let win = Tabmix.getTopWin();
    if (!win || where != "current") {
      return where;
    }

    let isLoadFeed = Tabmix.callerTrace("FeedHandler.loadFeed", "loadFeed");
    if (isLoadFeed) {
      // since Firefox 42 clicking 'Subscribe to This Page' always show
      // 'Subscribe to this feed' page
      let subscribe = Tabmix.isVersion(420) ||
          Services.prefs.getCharPref("browser.feeds.handler") == "ask";
      let openNewTab = subscribe && Tabmix.whereToOpen(this.prefBookmark).inNew;
      if (openNewTab) {
        where = "tab";
        params.inBackground = Tabmix.getBoolPref("browser.tabs.loadBookmarksInBackground");
      } else {
        win.gBrowser.selectedBrowser.tabmix_allowLoad = true;
      }
    } else {
      where = win.Tabmix.checkCurrent(url);
    }
    return where;
  },

  isBookmarklet(url) {
    var jsURL = /^ *javascript:/;
    return jsURL.test(url);
  },

  fixWhereToOpen(aEvent, aWhere, aPref) {
    var w = Tabmix.getTopWin();
    if (!w)
      return aWhere;

    var tabBrowser = w.gBrowser;
    var aTab = tabBrowser.mCurrentTab;

    if (typeof (aPref) == "undefined")
      aPref = this.getPrefByDocumentURI(window);

    var _pref = w.Services.prefs;
    if ((_pref.getBoolPref(aPref) || aTab.hasAttribute("locked"))) {
      if (aEvent && _pref.getBoolPref("extensions.tabmix.middlecurrent") &&
          ((aEvent instanceof MouseEvent &&
            (aEvent.button == 1 || aEvent.button === 0 && (aEvent.ctrlKey || aEvent.metaKey))) ||
           (aEvent instanceof XULCommandEvent &&
            typeof aEvent.target._placesNode == "object" && (aEvent.ctrlKey || aEvent.metaKey))))
        aWhere = "current";
      else if (aWhere == "current" && !tabBrowser.isBlankNotBusyTab(aTab))
        aWhere = "tab";
    }

    return aWhere;
  },

  getPrefByDocumentURI(aWindow) {
    switch (aWindow.document.documentURI) {
      case "chrome://browser/content/places/places.xul": {
        let history = PlacesUIUtils.getString("OrganizerQueryHistory");
        let historyId = PlacesUIUtils.leftPaneQueries[history];
        let node = PlacesOrganizer._places.selectedNode;
        let historySelected = node.itemId == historyId ||
            node.parent && node.parent.itemId == historyId;
        if (!historySelected)
          return this.prefBookmark;
      }
      /* falls through */
      case "chrome://browser/content/history/history-panel.xul":
        return this.prefHistory;
      case "chrome://browser/content/browser.xul":
      case "chrome://browser/content/bookmarks/bookmarksPanel.xul":
        /* falls through */
      default:
        break;
    }
    return this.prefBookmark;
  },

  // fixed: reuse all blank tab not just in the end
  // fixed: if "extensions.tabmix.loadBookmarksAndReplace" is true don't reuse
  //        locked and protected tabs open bookmark after those tabs
  // fixed: focus the first tab if "extensions.tabmix.openTabNext" is true
  // fixed: remove "selected" and "tabmix_selectedID" from reuse tab
  openGroup: function TMP_PC_openGroup(bmGroup, bmIds, aWhere) {
    var openTabs = Tabmix.visibleTabs.tabs;

    var doReplace = (/^tab/).test(aWhere) ? false :
      Tabmix.prefs.getBoolPref("loadBookmarksAndReplace");
    var loadInBackground = bmGroup.length > 1 ?
      Tabmix.prefs.getBoolPref("loadBookmarksGroupInBackground") :
      Services.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground");
    var openTabNext = Tabmix.getOpenTabNextPref();

    // catch tab for reuse
    var aTab, reuseTabs = [], removeTabs = [], i;
    var tabIsBlank, canReplace;
    for (i = 0; i < openTabs.length; i++) {
      aTab = openTabs[i];
      tabIsBlank = gBrowser.isBlankNotBusyTab(aTab);
      // don't reuse collapsed tab if width fitTitle is set
      canReplace = (doReplace && !aTab.hasAttribute("locked") &&
                    !aTab.hasAttribute("pinned")) || tabIsBlank;
      if (reuseTabs.length < bmGroup.length && canReplace)
        reuseTabs.push(aTab);
      else if ((doReplace && !aTab.hasAttribute("locked") &&
                !aTab.hasAttribute("protected") &&
                !aTab.hasAttribute("pinned")) || tabIsBlank) {
        aTab.collapsed = true;
        removeTabs.push(aTab);
      }
    }

    // load tabs progressively:
    // we use two preferences to control this feature:
    // load_tabs_progressively - type int:
    // when the number of tabs to load is more than the number in the preference
    // we use SessionStore to restore each tab otherwise we use browser.loadURI.
    //
    // restore_on_demand - type int:
    // when the number of tabs to load exceed the number in the preference we
    // instruct SessionStore to use restore on demand for the current set of tabs.
    const tabCount = this.restoringTabs.length + bmGroup.length;
    const [loadProgressively, restoreOnDemand] = this.getPreferences(tabCount);

    var tabToSelect = null;
    let prevTab;
    let relatedToCurrent = !doReplace && openTabNext && gBrowser.mCurrentTab._tPos < openTabs.length - 1;
    if (relatedToCurrent) {
      // open bookmarks after last related tab if exist
      let lastRelatedTab = Tabmix.isVersion({ff: 570, wf: "56.2.8"}) ?
        gBrowser._lastRelatedTabMap.get(gBrowser.selectedTab) : gBrowser._lastRelatedTab;
      prevTab = lastRelatedTab || gBrowser.selectedTab;
    } else {
      prevTab = Tabmix.visibleTabs.last;
    }
    var tabPos, index;
    var multiple = bmGroup.length > 1;
    let tabs = [], tabsData = [];
    let savePrincipal = TabmixSvc.SERIALIZED_SYSTEMPRINCIPAL;
    for (i = 0; i < bmGroup.length; i++) {
      let url = bmGroup[i];
      if (i < reuseTabs.length) {
        aTab = reuseTabs[i];
        if (!loadProgressively) {
          const browser = aTab.linkedBrowser;
          try {
            browser.userTypedValue = url;
            if (Tabmix.isVersion(550)) {
              browser.loadURIWithFlags(url, {
                flags: Ci.nsIWebNavigation.LOAD_FLAGS_NONE,
                triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
              });
            } else {
              browser.loadURI(url);
            }
          } catch (ex) { }
        }
        this.resetRestoreState(aTab);
        aTab.collapsed = false;
        // reset visited & tabmix_selectedID attribute
        if (!aTab.selected) {
          aTab.removeAttribute("visited");
          aTab.removeAttribute("tabmix_selectedID");
        } else
          aTab.setAttribute("reloadcurrent", true);
      } else {
        let params = {
          skipAnimation: multiple,
          noInitialLabel: this._titlefrombookmark,
          dontMove: true,
          forceNotRemote: loadProgressively,
        };
        if (Tabmix.isVersion(550)) {
          params.triggeringPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
        }
        aTab = gBrowser.addTab(loadProgressively ? "about:blank" : url, params);
      }
      this.setTabTitle(aTab, url, bmIds[i]);
      if (Tabmix.isVersion(550)) {
        aTab._labelIsInitialTitle = true;
      }
      if (loadProgressively) {
        tabs.push(aTab);
        let entry = {url, title: aTab.label};
        if (savePrincipal) {
          entry.triggeringPrincipal_base64 = TabmixSvc.SERIALIZED_SYSTEMPRINCIPAL;
        }
        tabsData.push({entries: [entry], index: 0});
        if (!url.startsWith("file:") && url != "about:blank") {
          aTab.setAttribute("_tabmix_load_bypass_cache", true);
        }
      }

      if (!tabToSelect)
        tabToSelect = aTab;
      // move tab to place
      index = prevTab._tPos + 1;
      tabPos = aTab._tPos < index ? index - 1 : index;
      gBrowser.moveTabTo(aTab, tabPos);
      TMP_LastTab.attachTab(aTab, prevTab);
      prevTab = aTab;
    }

    // focus the first tab if prefs say to
    if (!loadInBackground || doReplace &&
                             (gBrowser.selectedTab.hasAttribute("reloadcurrent") ||
                              gBrowser.selectedTab in removeTabs)) {
      var old = gBrowser.selectedTab;
      gBrowser.selectedTab = tabToSelect;
      if (!multiple && old != tabToSelect)
        tabToSelect.owner = old;
      var reloadCurrent = old.hasAttribute("reloadcurrent");
      if (reloadCurrent)
        old.removeAttribute("reloadcurrent");
      if (reloadCurrent && old != tabToSelect) {
        old.removeAttribute("visited");
        old.removeAttribute("tabmix_selectedID");
      }
    }

    // and focus selectedBrowser
    gBrowser.selectedBrowser.focus();

    // Close any remaining open tabs or blank tabs that are left over.
    while (removeTabs.length > 0) {
      gBrowser.removeTab(removeTabs.pop());
    }

    if (loadProgressively) {
      this.restoreTabs(tabs, tabsData, this.bookmarksOnDemand || restoreOnDemand);
    }
  },

  getPreferences(tabCount) {
    // negative value indicate that the feature is disabled
    const progressively = Tabmix.prefs.getIntPref("load_tabs_progressively");
    if (progressively < 0) {
      return [false, false];
    }
    let onDemand = Tabmix.prefs.getIntPref("restore_on_demand");
    if (onDemand < 0) {
      return [tabCount > progressively, false];
    }
    if (onDemand < progressively) {
      Tabmix.prefs.setIntPref("restore_on_demand", progressively);
      onDemand = progressively;
    }
    return [tabCount > progressively, tabCount > onDemand];
  },

  restoreTabs(tabs, tabsData, restoreOnDemand) {
    this.restoringTabs.push(...tabs);
    this.bookmarksOnDemand = restoreOnDemand;
    let fnName = Tabmix.isVersion(280) ? "restoreTabs" :
      "restoreHistoryPrecursor";
    TabmixSvc.SessionStore[fnName](window, tabs, tabsData, 0);
    // set icon on pending tabs
    const pendingData = tabs.map(tab => ({tab, url: tabsData.shift().entries[0].url}))
        .filter(({tab, url}) => tab.hasAttribute("pending") && url != "about:blank");
    for (let data of pendingData) {
      const {tab, url} = data;
      const entryURI = BrowserUtils.makeURI(url, null, null);
      PlacesUtils.favicons.getFaviconURLForPage(entryURI, uri => {
        // skip tab that already restored
        if (tab.hasAttribute("pending") && uri) {
          gBrowser.setIcon(tab, uri);
        }
      });
    }
  },

  bookmarksOnDemand: false,
  restoringTabs: [],

  resetRestoreState(tab) {
    if (tab.linkedBrowser.__SS_restoreState) {
      TabmixSvc.SessionStore._resetTabRestoringState(tab);
    }
    this.updateRestoringTabsList(tab);
  },

  updateRestoringTabsList(tab) {
    if (!this.restoringTabs.length && !this.bookmarksOnDemand) {
      return;
    }
    let index = this.restoringTabs.indexOf(tab);
    if (index > -1) {
      this.restoringTabs.splice(index, 1);
    }
    if (!this.restoringTabs.length) {
      this.bookmarksOnDemand = false;
    }
  },

  setTabTitle: function TMP_PC_setTabTitle(aTab, aUrl, aID, title) {
    if (!aTab || !aTab.parentNode)
      return false;
    if (aID && aID > -1)
      aTab.setAttribute("tabmix_bookmarkId", aID);
    if (!aUrl)
      aUrl = aTab.linkedBrowser.currentURI.spec;
    if (!title) {
      title = this.getTabTitle(aTab, aUrl, aTab.label);
    }
    if (title != aTab.label) {
      aTab.label = title;
      aTab.setAttribute("tabmix_changed_label", title);
      if (Tabmix.isVersion(530)) {
        gBrowser._tabAttrModified(aTab, ["label"]);
      } else {
        aTab.crop = title != aUrl || aUrl == TabmixSvc.aboutBlank ? "end" : "center";
        gBrowser._tabAttrModified(aTab, ["label", "crop"]);
      }
      if (aTab.selected)
        gBrowser.updateTitlebar();
      if (!aTab.hasAttribute("faviconized"))
        aTab.removeAttribute("width");
      this._tabTitleChanged = true;
      return true;
    }
    return false;
  },

  asyncSetTabTitle(tab, url, id, title) {
    if (id && id > -1) {
      tab.setAttribute("tabmix_bookmarkId", id);
    }
    return this.asyncGetTabTitle(tab, url, title).then(newTitle => {
      if (newTitle && newTitle != tab.label) {
        this.setTabTitle(tab, url, -1, newTitle);
      }
    });
  },

  getTabTitle: function TMP_PC_getTabTitle(aTab, aUrl, title, byID) {
    if (this.isUserRenameTab(aTab, aUrl))
      return aTab.getAttribute("fixed-label");

    // if the tab is bookmarked we use tabmix_bookmarkId attribute
    // to get the title without using async functions
    let newTitle = this.getTitleFromBookmark(aUrl, null, -1, aTab, byID);
    if (!newTitle && aTab.hasAttribute("pending"))
      newTitle = TMP_SessionStore.getTitleFromTabState(aTab);
    return newTitle || title;
  },

  // rename function to asyncGetTabTitle
  asyncGetTabTitle(aTab, aUrl, title) {
    if (this.isUserRenameTab(aTab, aUrl))
      return Promise.resolve(aTab.getAttribute("fixed-label"));

    return this.asyncGetTitleFromBookmark(aUrl, null, -1, aTab).then(newTitle => {
      if (!newTitle && aTab.hasAttribute("pending"))
        newTitle = TMP_SessionStore.getTitleFromTabState(aTab);
      return newTitle || title;
    });
  },

  get _titlefrombookmark() {
    delete this._titlefrombookmark;
    return (this._titlefrombookmark = Tabmix.prefs.getBoolPref("titlefrombookmark"));
  },

  getTitleFromBookmark(aUrl, aTitle, aItemId, aTab, byID) {
    return this.PlacesUtils.getTitleFromBookmark(aUrl, aTitle, aItemId, aTab, byID);
  },

  asyncGetTitleFromBookmark(aUrl, aTitle, aItemId, aTab) {
    return this.PlacesUtils.asyncGetTitleFromBookmark(aUrl, aTitle, aItemId, aTab);
  },

  isUserRenameTab(aTab, aUrl) {
    if (aTab.hasAttribute("label-uri")) {
      let label = aTab.getAttribute("label-uri");
      if (label == aUrl || label == "*")
        return true;
    }
    return false;
  },

  afterTabTitleChanged(bookmarkChanged = true) {
    if (bookmarkChanged && !this.inUpdateBatch) {
      this.AboutNewTab.updateAllBrowsers(window);
    }

    if (bookmarkChanged && !this._tabTitleChanged)
      return;
    if (this.inUpdateBatch) {
      this._tabTitleChanged = true;
      return;
    }
    this._tabTitleChanged = false;
    TabmixTabbar.updateScrollStatus();
    TabmixTabbar.updateBeforeAndAfter();
    if (this.currentTab) {
      let tabstrip = gBrowser.tabContainer.mTabstrip;
      if (!TabmixTabbar.isMultiRow) {
        let scrollPosition = tabstrip.scrollPosition;
        if (scrollPosition < 100) {
          if (tabstrip.orient == "vertical") {
            tabstrip._scrollbox.scrollTop = 0;
          } else {
            tabstrip._scrollbox.scrollLeft = 0;
          }
        }
      }
      gBrowser.ensureTabIsVisible(this.currentTab, false);
      this.currentTab = null;
    }
  },

  startObserver: function TMP_PC_startObserver() {
    // Start observing bookmarks if needed.
    if (!this._hasBookmarksObserver) {
      try {
        if (Tabmix.isVersion(560)) {
          PlacesUtils.bookmarks.addObserver(this);
        } else {
          PlacesUtils.addLazyBookmarkObserver(this);
        }
        this._hasBookmarksObserver = true;
      } catch (ex) {
        Tabmix.reportError(ex, "Failed to add bookmarks observer:");
      }
    }
  },

  stopObserver: function TMP_PC_stopObserver() {
    if (this._hasBookmarksObserver) {
      if (Tabmix.isVersion(560)) {
        PlacesUtils.bookmarks.removeObserver(this);
      } else {
        PlacesUtils.removeLazyBookmarkObserver(this);
      }
      this._hasBookmarksObserver = false;
    }
  },

  onDelayedStartup() {
    if (!this._titlefrombookmark || !gBrowser.tabs)
      return;

    this.startObserver();
  },

  // extensions.tabmix.titlefrombookmark changed
  onPreferenceChanged(aPrefValue) {
    this._titlefrombookmark = aPrefValue;

    if (aPrefValue) {
      for (let tab of gBrowser.tabs) {
        this.setTabTitle(tab);
      }
      this.startObserver();
    } else {
      let tabs = gBrowser.tabContainer.getElementsByAttribute("tabmix_bookmarkId", "*");
      Array.prototype.slice.call(tabs).forEach(function(tab) {
        if (tab.hasAttribute("pending"))
          this.setTabTitle(tab);
        else
          gBrowser.setTabTitle(tab);
      }, this);
      this.stopObserver();
    }
    this.afterTabTitleChanged();
  },

  _hasBookmarksObserver: false,
  inUpdateBatch: false,
  _tabTitleChanged: false,
  currentTab: null,

  // nsINavBookmarkObserver

  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsINavBookmarkObserver
  ]),

  addItemIdToTabsWithUrl: function TMP_PC_addItemIdToTabsWithUrl(aItemId, aUrl) {
    if (this.inUpdateBatch) {
      this._batchData.add.ids.push(aItemId);
      this._batchData.add.urls.push(aUrl);
      return;
    } else if (!Array.isArray(aItemId)) {
      [aItemId, aUrl] = [[aItemId], [aUrl]];
    }

    let getIndex = url => aUrl.indexOf(url) + 1;
    for (let tab of gBrowser.tabs) {
      let url = tab.linkedBrowser.currentURI.spec;
      if (this.isUserRenameTab(tab, url))
        return;
      let index = this.PlacesUtils.applyCallBackOnUrl(url, getIndex);
      if (index) {
        tab.setAttribute("tabmix_bookmarkId", aItemId[index - 1]);
        this.setTabTitle(tab, url);
      }
    }
    this.afterTabTitleChanged();
  },

  updateTabsTitleForId: function TMP_PC_updateTabsTitleForId(aItemId) {
    if (this.inUpdateBatch) {
      this._batchData.updateIDs.push(aItemId);
      return;
    }
    const ID = "tabmix_bookmarkId";
    let batch = Array.isArray(aItemId);
    let tabs = gBrowser.tabContainer.getElementsByAttribute(ID, batch ? "*" : aItemId);
    Array.prototype.slice.call(tabs).forEach(function(tab) {
      if (!batch ||
          aItemId.indexOf(parseInt(tab.getAttribute(ID))) > -1) {
        tab.removeAttribute(ID);
        let url = tab.linkedBrowser.currentURI.spec;
        if (!this.isUserRenameTab(tab, url)) {
          if (tab.hasAttribute("pending"))
            this.setTabTitle(tab, url);
          else
            gBrowser.setTabTitle(tab);
        }
      }
    }, this);
    this.afterTabTitleChanged();
  },

  onItemAdded: function TMP_PC_onItemAdded(aItemId, aFolder, aIndex, aItemType, aURI) {
    if (aItemId == -1 || aItemType != Ci.nsINavBookmarksService.TYPE_BOOKMARK)
      return;
    var url = aURI ? aURI.spec : null;
    if (url && !isBlankPageURL(url))
      this.addItemIdToTabsWithUrl(aItemId, url);
  },

  onItemRemoved: function TMP_PC_onItemRemoved(aItemId, aFolder, aIndex, aItemType) {
    if (aItemId == -1 || aItemType != Ci.nsINavBookmarksService.TYPE_BOOKMARK)
      return;
    this.updateTabsTitleForId(aItemId);
  },

  // onItemChanged also fired when page is loaded (visited count changed ?)
  onItemChanged: function TMP_PC_onItemChanged(aItemId, aProperty, aIsAnnotationProperty,
                                               aNewValue, aLastModified, aItemType) {
    if (aItemId == -1 || aItemType != Ci.nsINavBookmarksService.TYPE_BOOKMARK ||
        (aProperty != "uri" && aProperty != "title"))
      return;

    if (aProperty == "uri" && aNewValue && !isBlankPageURL(aNewValue))
      this.addItemIdToTabsWithUrl(aItemId, aNewValue);
    this.updateTabsTitleForId(aItemId);
  },

  onBeginUpdateBatch: function TMP_PC_onBeginUpdateBatch() {
    this._batchData = {updateIDs: [], add: {ids: [], urls: []}};
    this.inUpdateBatch = true;

    if (TabmixTabbar.widthFitTitle &&
        Tabmix.tabsUtils.isElementVisible(gBrowser.mCurrentTab))
      this.currentTab = gBrowser.mCurrentTab;
  },

  onEndUpdateBatch: function TMP_PC_onEndUpdateBatch() {
    var data = this._batchData;
    this.inUpdateBatch = false;
    var [updateIDs, addIDs, addURLs] = [data.updateIDs, data.add.ids, data.add.urls];
    if (addIDs.length)
      this.addItemIdToTabsWithUrl(addIDs, addURLs);
    if (updateIDs.length)
      this.updateTabsTitleForId(updateIDs);

    this._batchData = {updateIDs: [], add: {ids: [], urls: []}};

    this.afterTabTitleChanged();
    this.currentTab = null;
  },

  onItemVisited() {},
  onItemMoved() {}
};

TMP_Places.contextMenu = {
  toggleEventListener(enable) {
    var eventListener = enable ? "addEventListener" : "removeEventListener";
    window[eventListener]("unload", this, false);
    document.getElementById("placesContext")[eventListener]("popupshowing", this, false);
  },

  handleEvent(aEvent) {
    switch (aEvent.type) {
      case "popupshowing":
        this.buildContextMenu();
        break;
      case "unload":
        this.toggleEventListener(false);
        break;
    }
  },

  buildContextMenu: function TMP_PC_buildContextMenu() {
    var _open = document.getElementById("placesContext_open");
    var _openInWindow = document.getElementById("placesContext_open:newwindow");
    var _openInPrivateWindow =
        document.getElementById("placesContext_open:newprivatewindow") || {hidden: true};
    var _openInTab = document.getElementById("placesContext_open:newtab");
    this.update(_open, _openInWindow, _openInPrivateWindow, _openInTab, TMP_Places.getPrefByDocumentURI(window));
  },

  // update context menu for bookmarks manager and sidebar
  // for bookmarks/places, history, sage and more.....
  update: function TMP_contextMenu_update(open, openInWindow, openInPrivateWindow,
                                          openInTab, pref) {
    // if all 4 is hidden... probably "Open all in Tabs" is visible
    if (open.hidden && openInWindow.hidden && openInPrivateWindow.hidden &&
        openInTab.hidden) {
      return;
    }

    var w = Tabmix.getTopWin();
    if (w) {
      let where = w.Tabmix.whereToOpen(pref);
      if (!openInPrivateWindow.hidden && !Tabmix.isNewWindowAllow(true))
        openInPrivateWindow.hidden = true;

      if (!openInWindow.hidden && !Tabmix.isNewWindowAllow(false))
        openInWindow.hidden = true;
      else if (openInWindow.hasAttribute("default"))
        openInWindow.removeAttribute("default");

      Tabmix.setItem(openInTab, "default", where.inNew ? "true" : null);

      if (open.hidden != where.lock)
        open.hidden = where.lock;
      if (!open.hidden)
        Tabmix.setItem(open, "default", !where.inNew ? "true" : null);
    } else {
      open.hidden = true;
      openInTab.hidden = true;
      openInWindow.hidden = false;
      openInWindow.setAttribute("default", true);
    }
  }
};

Tabmix.onContentLoaded = {
  changeCode() {
    this.change_miscellaneous();
    this.change_utilityOverlay();
  },

  change_miscellaneous() {
    Tabmix.changeCode(nsContextMenu.prototype, "nsContextMenu.prototype.openLinkInTab")._replace(
      /allowMixedContent:|charset:/,
      'inBackground: !Services.prefs.getBoolPref("browser.tabs.loadInBackground"),\n' +
      '      $&'
    ).toCode(false, Tabmix.originalFunctions, "openInverseLink");

    if ("_update" in TabsInTitlebar) {
      // set option to Prevent double click on Tab-bar from changing window size.
      Tabmix.changeCode(TabsInTitlebar, "TabsInTitlebar._update")._replace(
        'function $(id)',
        'let $ = $&', {check: Tabmix._debugMode && !Tabmix.isVersion(440)}
      )._replace(
        'this._dragBindingAlive',
        '$& && Tabmix.prefs.getBoolPref("tabbar.click_dragwindow")',
        {check: !Tabmix.isVersion(470)}
      )._replace(
        'function rect(ele)',
        'let rect = function _rect(ele)', // for strict mode
        {check: !Tabmix.isVersion(440)}
      )._replace(
        'function verticalMargins(',
        'let verticalMargins = $&',
        {check: Tabmix._debugMode && Tabmix.isVersion(280) && !Tabmix.isVersion(440)}
      )._replace(
        'let tabAndMenuHeight = fullTabsHeight + fullMenuHeight;',
        'fullTabsHeight = fullTabsHeight / TabmixTabbar.visibleRows;\n      $&',
        {check: TabmixSvc.isMac && Tabmix.isVersion(280)}
      )._replace(
        /(})(\)?)$/,
        // when we get in and out of tabsintitlebar mode call updateScrollStatus
        // force another update when rows number changed by Tabmix to update
        // titlebar and titlebarContent height
        '  TabmixTabbar.updateTabsInTitlebarAppearance();\n  ' +
        '$1$2'
      )._replace(
        'titlebarContentHeight = Math.max(titlebarContentHeight, fullTabsHeight)',
        'titlebarContentHeight = Math.max(titlebarContentHeight, TabmixTabbar.singleRowHeight + verticalMargins(tabsStyles))',
        {check: !Tabmix.isVersion(570) && Tabmix.isVersion(550)}
      )._replace(
        'titlebarContentHeight = fullTabsHeight + 1',
        'titlebarContentHeight = TabmixTabbar.singleRowHeight + verticalMargins(tabsStyles) + 1',
        {check: !Tabmix.isVersion(580) && Tabmix.isVersion(570)}
      )._replace(
        'titlebarContentHeight = fullTabsHeight;',
        'titlebarContentHeight = TabmixTabbar.singleRowHeight + verticalMargins(tabsStyles);',
        {check: Tabmix.isVersion(580)}
      ).toCode();
    }

    // we can't use TabPinned.
    // gBrowser.pinTab call adjustTabstrip/_updateCloseButtons that call updateScrollStatus
    // before it dispatch TabPinned event.
    Tabmix.changeCode(gBrowser, "gBrowser.pinTab")._replace(
      `this.tabContainer.${Tabmix.updateCloseButtons}();`,
      '  if (TabmixTabbar.widthFitTitle && aTab.hasAttribute("width"))' +
      '    aTab.removeAttribute("width");' +
      '  if (Tabmix.prefs.getBoolPref("lockAppTabs") &&' +
      '      !aTab.hasAttribute("locked") && "lockTab" in this) {' +
      '    this.lockTab(aTab);' +
      '    aTab.setAttribute("_lockedAppTabs", "true");' +
      '  }' +
      `  this.tabContainer.${Tabmix.updateCloseButtons}(true);` +
      '  TabmixTabbar.updateScrollStatus();' +
      '  TabmixTabbar.updateBeforeAndAfter();'
    ).toCode();
  },

  change_utilityOverlay() {
    // fix small bug when the event is not mouse event
    // inverse focus of middle/ctrl/meta clicked bookmarks/history
    // don't inverse focus when called from onPopupClick and One-Click Search
    // Bar Interface is on
    // when we are in single window mode set the function to return "tab"
    let $LF = '\n    ';
    Tabmix.changeCode(window, "whereToOpenLink")._replace(
      '{', '{\n' +
      'if (e && e.tabmixContentClick) {\n' +
      '  let {where, suppressTabsOnFileDownload} = e.tabmixContentClick;\n' +
      '  return suppressTabsOnFileDownload ? "current" : where;\n' +
      '}\n'
    )._replace(
      'var middle = !ignoreButton && e.button == 1;',
      'var middle = !ignoreButton && e.button && e.button == 1;'
    )._replace(
      'return shift ? "tabshifted" : "tab";',
      '{' + $LF +
      'let callerTrace = Tabmix.callerTrace();' + $LF +
      'let list = ["openUILink", "handleLinkClick", "BG_observe", "contentAreaClick",' + $LF +
      '            "TMP_tabshifted", "TMP_whereToOpenLink", "TMP_contentLinkClick"];' + $LF +
      'let pref = callerTrace.contain(list) ?' + $LF +
      '    "extensions.tabmix.inversefocusLinks" : "extensions.tabmix.inversefocusOther";' + $LF +
      'let notOneClickSearch = !Tabmix.getBoolPref("browser.search.showOneOffButtons", false) ||' + $LF +
      '                        !callerTrace.contain("onPopupClick");' + $LF +
      'if (notOneClickSearch && Tabmix.getBoolPref(pref, true))' + $LF +
      '  shift = !shift;' + $LF +
      '$&' + $LF +
      '}'
    )._replace(
      'return "window";',
      'return Tabmix.getSingleWindowMode() ? "tab" : "window";'
    ).toCode();

    // update incompatibility with X-notifier(aka WebMail Notifier) 2.9.13+
    // in case it warp the function in its object
    let [fnObj, fnName] = this.getXnotifierFunction("openLinkIn");
    Tabmix.changeCode(fnObj, fnName)._replace(
      '{',
      '{\n' +
      '  let callerTrace = Tabmix.callerTrace();\n' +
      '  if (callerTrace.contain("BG_observe", "loadHomepage")) {\n' +
      '    params.inBackground = Tabmix.getBoolPref("browser.tabs.loadInBackground");\n' +
      '  } else if (where == "current" &&\n' +
      '      callerTrace.contain("ReaderParent.toggleReaderMode")) {\n' +
      '    gBrowser.selectedBrowser.tabmix_allowLoad = true;\n' +
      '  }\n'
    )._replace(
      /aRelatedToCurrent\s*= params.relatedToCurrent;/,
      '$&\n' +
      '  var bookMarkId            = params.bookMarkId;'
    )._replace(
      'where == "current" && #1.pinned'
          .replace("#1", Tabmix.isVersion(520) ? "tab" : "w.gBrowser.selectedTab"),
      '$& && !params.suppressTabsOnFileDownload',
      {check: !Tabmix.isVersion(530)}
    )._replace(
      '(targetBrowser).pinned',
      '$& && !params.suppressTabsOnFileDownload',
      {check: Tabmix.isVersion(530)}
    )._replace(
      'if ((where == "tab" ||',
      'if (w && where == "window" &&\n' +
      '      !Tabmix.isNewWindowAllow(aIsPrivate)) {\n' +
      '    where = "tab";\n' +
      '  }\n' +
      '  $&'
    )._replace(
      /Services.ww.openWindow[^;]*;/,
      'let newWin = $&\n' +
      '    if (newWin && bookMarkId) {\n' +
      '        newWin.bookMarkIds = bookMarkId;\n' +
      '    }',
      {check: !Tabmix.isVersion(540)}
    )._replace(
      /win = Services.ww.openWindow[^;]*;/,
      '$&\n' +
      '    if (win && bookMarkId) {\n' +
      '        win.bookMarkIds = bookMarkId;\n' +
      '    }',
      {check: Tabmix.isVersion(540)}
    )._replace(
      /(})(\)?)$/,
      '  const targetTab = where == "current" ?\n' +
      '      w.gBrowser.selectedTab : w.gBrowser.getTabForLastPanel();\n' +
      '  if (Tabmix.isVersion(600)) {\n' +
      '    w.TMP_Places.asyncSetTabTitle(targetTab, url, bookMarkId);\n' +
      '  } else {\n' +
      '    w.TMP_Places.setTabTitle(targetTab, url, bookMarkId);\n' +
      '  }\n' +
      '  if (where == "current") {\n' +
      '    w.gBrowser.ensureTabIsVisible(w.gBrowser.selectedTab);\n' +
      '  }\n' +
      '$1$2'
    ).toCode();
  },

  // update compatibility with X-notifier(aka WebMail Notifier) 2.9.13+
  // object name wmn replace with xnotifier for version 3.0+
  getXnotifierFunction(aName) {
    let com = window.com;
    if (typeof com == "object" && typeof com.tobwithu == "object") {
      let fn = ["wmn", "xnotifier"].filter(f => {
        return typeof com.tobwithu[f] == "object" &&
          typeof com.tobwithu[f][aName] == "function";
      });
      if (fn.length) {
        return [com.tobwithu[fn[0]], aName];
      }
    }
    return [window, aName];
  }

};

// Pale moon 28.5.0a1 removed window.getBoolPref
// https://github.com/MoonchildProductions/UXP/pull/1023
Tabmix.getBoolPref = function(prefname, def) {
  try {
    return Services.prefs.getBoolPref(prefname);
  } catch (er) {
    return def;
  }
};

/** DEPRECATED **/
TMP_Places.getTabFixedTitle = function(aBrowser, aUri) {
  let win = aBrowser.ownerGlobal;
  return win.TMP_Places.getTabTitle(win.gBrowser.getTabForBrowser(aBrowser), aUri.spec);
};
