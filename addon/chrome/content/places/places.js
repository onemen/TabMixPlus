"use strict";

// code by onemen
/** @type {TabmixPlaces} */
var TMP_Places = {
  _batchData: {remove: [], add: []},
  _titlefrombookmark: false,
  listeners: [],
  prefHistory: "extensions.tabmix.opentabfor.history",
  prefBookmark: "extensions.tabmix.opentabfor.bookmarks",

  get PlacesUtils() {
    return Tabmix.lazyGetter(this, "PlacesUtils", () => {
      const {TabmixPlacesUtils} = ChromeUtils.importESModule("chrome://tabmix-resource/content/Places.sys.mjs");
      // we get here only after the window was loaded
      // so we can safely call our 'onWindowOpen' initialization t make sure its done
      if (!Tabmix.initialization.onWindowOpen.initialized) {
        Tabmix.initialization.run("onWindowOpen");
      }
      return TabmixPlacesUtils;
    });
  },

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
    this._titlefrombookmark = Tabmix.prefs.getBoolPref("titlefrombookmark");

    /** @type {PlacesEventType[]} */
    this.listeners = [
      "bookmark-added",
      "bookmark-removed",
      "bookmark-title-changed",
      "bookmark-url-changed",
    ];

    this.contextMenu.toggleEventListener(true);

    // use tab label for bookmark name when user renamed the tab
    // PlacesCommandHook exist on browser window
    if ("PlacesCommandHook" in window) {
      gBrowser.tabContainer.addEventListener("SSTabRestored", this);

      Tabmix.changeCode(PlacesCommandHook, "PlacesCommandHook.getUniquePages")._replace(
        'browser.contentTitle || tab.label;',
        'tab.getAttribute("fixed-label") || $&'
      ).toCode();

      Tabmix.changeCode(PlacesCommandHook, "PlacesCommandHook.bookmarkPage")._replace(
        'info.title = info.title || url.href',
        'info.title = gBrowser.selectedTab.getAttribute("fixed-label") || info.title || url.href'
      ).toCode();
    }
  },

  deinit: function TMP_PC_deinit() {
    if ("gBrowser" in window) {
      gBrowser.tabContainer.removeEventListener("SSTabRestored", this);
      this.restoringTabs = [];
      this.tabRestoreQueue = [];
    }
    this.stopObserver();
  },

  historyMenuItemsTitle: function TMP_PC_historyMenuItemsTitle(aEvent) {
    if (!this._titlefrombookmark)
      return;

    var aMenuPopup = aEvent.target;
    const ids = ["historyMenuPopup", "appmenu_historyMenupopup"];
    if (!ids.includes(aMenuPopup.id)) {
      return;
    }

    for (const item of Array.from(aMenuPopup.childNodes)) {
      if ("_placesNode" in item) {
        const url = item._placesNode.uri;
        this.getTitleFromBookmark(url).then(bookMarkName => {
          if (bookMarkName)
            item.setAttribute("label", bookMarkName);
        });
      }
    }
  },

  openMenuItem(aUri, aEvent, aParams, aPref) {
    let pref = "extensions.tabmix.opentabfor." + aPref;
    let where = this.isBookmarklet(aUri) ? "current" :
      this.fixWhereToOpen(aEvent, Tabmix.whereToOpenLink(aEvent, false, true), pref);
    if (where == "current")
      Tabmix.getTopWin().gBrowser.selectedBrowser.tabmix_allowLoad = true;
    aParams.inBackground = Services.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground");
    window.openTrustedLinkIn(aUri, where, aParams);
  },

  idsMap: {
    "PanelUI-historyItems": "history",
    historyMenuPopup: "history",
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

    where = win.Tabmix.checkCurrent(url);
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
    var aTab = tabBrowser._selectedTab;

    if (typeof aPref == "undefined")
      aPref = this.getPrefByDocumentURI(window);

    var _pref = w.Services.prefs;
    if (_pref.getBoolPref(aPref) || aTab.hasAttribute("locked")) {
      if (aEvent && _pref.getBoolPref("extensions.tabmix.middlecurrent") &&
          (MouseEvent.isInstance(aEvent) &&
            (aEvent.button == 1 || aEvent.button === 0 && (aEvent.ctrlKey || aEvent.metaKey)) ||
           XULCommandEvent.isInstance(aEvent) &&
            // @ts-expect-error - we check here to make sure it is _placesNode
            typeof aEvent.target._placesNode == "object" && (aEvent.ctrlKey || aEvent.metaKey)))
        aWhere = "current";
      else if (aWhere == "current" && !tabBrowser.isBlankNotBusyTab(aTab))
        aWhere = "tab";
    }

    return aWhere;
  },

  getPrefByDocumentURI(aWindow) {
    switch (aWindow.document.documentURI) {
      case "chrome://browser/content/places/places.xhtml": {
        let historyId = PlacesUtils.virtualHistoryGuid;
        let node = aWindow.PlacesOrganizer._places.selectedNode;
        let historySelected = node.bookmarkGuid == historyId ||
            node.parent && node.parent.bookmarkGuid == historyId;
        if (!historySelected)
          return this.prefBookmark;
      }
      /* falls through */
      case "chrome://browser/content/places/historySidebar.xhtml":
        return this.prefHistory;
      case AppConstants.BROWSER_CHROME_URL:
      case "chrome://browser/content/places/bookmarksSidebar.xhtml":
        /* falls through */
      default:
        break;
    }
    return this.prefBookmark;
  },

  // fixed: reuse all blank tab not just in the end
  // fixed: if "extensions.tabmix.loadBookmarksAndReplace" is true don't reuse
  //        locked and protected tabs open bookmark after those tabs
  // fixed: focus the first tab if "browser.tabs.insertAfterCurrent" is true
  // fixed: remove "selected" and "tabmix_selectedID" from reuse tab
  openGroup: function TMP_PC_openGroup(bmGroup, aWhere) {
    var openTabs = Tabmix.visibleTabs.tabs;

    var doReplace = (/^tab/).test(aWhere) ? false :
      Tabmix.prefs.getBoolPref("loadBookmarksAndReplace");
    var loadInBackground = bmGroup.length > 1 ?
      Tabmix.prefs.getBoolPref("loadBookmarksGroupInBackground") :
      Services.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground");
    var openTabNext = Tabmix.getOpenTabNextPref();

    // catch tab for reuse
    /** @type {Tab[]} */
    const reuseTabs = [];
    /** @type {Tab[]} */
    const removeTabs = [];
    var tabIsBlank, canReplace;
    for (const aTab of openTabs) {
      tabIsBlank = gBrowser.isBlankNotBusyTab(aTab);
      // don't reuse collapsed tab if width fitTitle is set
      canReplace = doReplace && !aTab.hasAttribute("locked") &&
                    !aTab.hasAttribute("pinned") || tabIsBlank;
      if (reuseTabs.length < bmGroup.length && canReplace) {
        reuseTabs.push(aTab);
      } else if (doReplace && !aTab.hasAttribute("locked") &&
                !aTab.hasAttribute("protected") &&
                !aTab.hasAttribute("pinned") || tabIsBlank) {
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
    const [loadProgressively, restoreOnDemand] = this.getPreferences(bmGroup.length);
    const sessionStoreRestoreOnDemand = Services.prefs.getBoolPref(
      "browser.sessionstore.restore_on_demand"
    );
    const hideTempTabs = restoreOnDemand && !sessionStoreRestoreOnDemand;

    /** @type {Tab | undefined} */
    var tabToSelect;
    /** @type {Tab} */
    let prevTab;
    let relatedToCurrent = !doReplace && openTabNext && gBrowser._selectedTab._tPos < openTabs.length - 1;
    if (relatedToCurrent) {
      // open bookmarks after last related tab if exist
      let lastRelatedTab = gBrowser._lastRelatedTabMap.get(gBrowser.selectedTab);
      prevTab = lastRelatedTab || gBrowser.selectedTab;
    } else {
      prevTab = Tabmix.visibleTabs.last;
    }
    var tabPos, index;
    var multiple = bmGroup.length > 1;
    /** @type {Map<Tab, SessionStoreNS.TabData>} */
    let tabsInfo = new Map();
    let savePrincipal = E10SUtils.SERIALIZED_SYSTEMPRINCIPAL;
    bmGroup.forEach((url, i) => {
      let aTab = reuseTabs[i];
      if (aTab) {
        if (!loadProgressively) {
          const browser = aTab.linkedBrowser;
          try {
            browser.userTypedValue = url;
            browser.fixupAndLoadURIString(url, {
              loadFlags: Ci.nsIWebNavigation.LOAD_FLAGS_NONE,
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            });
          } catch {}
        }
        this.resetRestoreState(aTab);
        aTab.collapsed = false;
        // reset visited & tabmix_selectedID attribute
        if (!aTab.selected) {
          aTab.removeAttribute("visited");
          aTab.removeAttribute("tabmix_selectedID");
        } else {
          aTab.setAttribute("reloadcurrent", "true");
        }
        // move tab to place
        index = prevTab._tPos + 1;
        tabPos = aTab._tPos < index ? index - 1 : index;
        gBrowser.moveTabTo(aTab, tabPos);
      } else {
        let preferredRemoteType = E10SUtils.getRemoteTypeForURI(
          url,
          gMultiProcessBrowser,
          gFissionBrowser,
          E10SUtils.DEFAULT_REMOTE_TYPE,
          null,
          E10SUtils.predictOriginAttributes({window})
        );
        let params = {
          skipAnimation: multiple,
          noInitialLabel: this._titlefrombookmark,
          index: prevTab._tPos + 1,
          skipBackgroundNotify: loadProgressively,
          skipLoad: loadProgressively && tabToSelect,
          preferredRemoteType,
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        };
        aTab = gBrowser.addTrustedTab(loadProgressively ? "about:blank" : url, params);
      }
      this.asyncSetTabTitle(aTab, url, true);
      if (loadProgressively) {
        /** @type {SessionStoreNS.TabDataEntry} */
        let entry = {url, title: aTab.label};
        if (savePrincipal) {
          entry.triggeringPrincipal_base64 = E10SUtils.SERIALIZED_SYSTEMPRINCIPAL;
        }
        // make SessionStore load the tab with proper loadFlags by setting
        // userTypedValue and userTypedClear
        const tabData = {
          entries: [entry],
          index: 1,
          userTypedValue: url,
          userTypedClear: 1,
        };
        tabsInfo.set(aTab, tabData);
      }

      if (!tabToSelect) {
        tabToSelect = aTab;
      }
      if (hideTempTabs && aTab !== tabToSelect) {
        aTab.setAttribute("tabmix_temp_pendingtab", "true");
        gBrowser.hideTab(aTab);
      }
      TMP_LastTab.attachTab(aTab, prevTab);
      prevTab = aTab;
      aTab.initialize();
    });

    gBrowser.tabContainer._invalidateCachedTabs();

    // focus the first tab if prefs say to
    if (tabToSelect) {
      const replaceCurrent =
        gBrowser.selectedTab.hasAttribute("reloadcurrent") ||
        removeTabs.includes(gBrowser.selectedTab);
      if (!loadInBackground || doReplace && replaceCurrent) {
        var old = gBrowser.selectedTab;
        gBrowser.selectedTab = tabToSelect;
        if (!multiple && old != tabToSelect) tabToSelect.owner = old;
        var reloadCurrent = old.hasAttribute("reloadcurrent");
        if (reloadCurrent) old.removeAttribute("reloadcurrent");
        if (reloadCurrent && old != tabToSelect) {
          old.removeAttribute("visited");
          old.removeAttribute("tabmix_selectedID");
        }
      }
    }

    // and focus selectedBrowser
    gBrowser.selectedBrowser.focus();

    // Close any remaining open tabs or blank tabs that are left over.
    removeTabs.forEach(tab => gBrowser.removeTab(tab));

    if (loadProgressively) {
      this.restoreTabs(tabsInfo, this.bookmarksOnDemand || restoreOnDemand, relatedToCurrent);
    }
  },

  getPreferences(tabCount) {
    tabCount += this.restoringTabs.length + this.tabRestoreQueue.length;
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

  restoreTabs(tabsInfo, restoreOnDemand, relatedToCurrent) {
    this.bookmarksOnDemand = restoreOnDemand;
    const sessionStoreRestoreOnDemand = Services.prefs.getBoolPref(
      "browser.sessionstore.restore_on_demand"
    );

    if (sessionStoreRestoreOnDemand === restoreOnDemand) {
      for (const [tab, tabData] of tabsInfo) {
        this.restoringTabs.push(tab);
        SessionStore.setTabState(tab, tabData);
      }
    } else if (restoreOnDemand) {
      // sessionstore.restore_on_demand is off but we want restore_on_demand for bookmarks
      let prevTab = gBrowser.selectedTab;
      const tabDataList = [...tabsInfo.values()];
      const tabs = gBrowser.createTabsForSessionRestore(
        true,
        1,
        tabDataList,
        []
      );
      // need to set it again in case it set back to false before we add restoringTabs
      this.bookmarksOnDemand = restoreOnDemand;
      this.restoringTabs.push(...tabs);
      tabs.forEach((tab, i) => {
        if (relatedToCurrent) {
          gBrowser.moveTabTo(tab, prevTab._tPos + 1);
          prevTab = tab;
        }
        /** @type {TabmixNS.TabData} */ // @ts-expect-error
        const tabData = tabDataList[i];
        SessionStore.setTabState(tab, tabData);
      });
    } else {
      // sessionstore.restore_on_demand is on but we want bookmarks to restoe progressively
      for (const [tab, tabData] of tabsInfo) {
        SessionStore.setTabState(tab, tabData);
        if (tab.selected) {
          this.restoringTabs.push(tab);
        } else {
          this.tabRestoreQueue.push(tab);
          this.restoreNextTab();
        }
      }
    }

    // set icon on pending tabs that are not about: pages
    const pendingData = Array.from(tabsInfo.entries()).filter(
      ([tab, tabData]) => (tab.hasAttribute("tabmix_temp_pendingtab") ||
          tab.hasAttribute("pending")) &&
        !tabData.userTypedValue?.startsWith("about")
    );
    for (let [tab, {userTypedValue}] of pendingData) {
      /** @type {string}  */ // @ts-expect-error - we set userTypedValue to bookmarks url above
      const pageUrl = userTypedValue;
      const entryURI = Services.io.newURI(pageUrl);
      PlacesUtils.favicons.getFaviconURLForPage(entryURI, iconURI => {
        if (!iconURI) {
          // fallback to favicon.ico
          iconURI = Services.io.newURI(`${pageUrl.replace(/\/$/, "")}/favicon.ico`);
        }
        // skip tab that already restored
        if (
          tab.hasAttribute("tabmix_temp_pendingtab") && tab.linkedBrowser ||
          tab.hasAttribute("pending")
        ) {
          const message = {iconUrl: iconURI.spec, pageUrl};
          tab.linkedBrowser.messageManager.sendAsyncMessage(
            "Tabmix:SetPendingTabIcon",
            message
          );
          // fallback in case somehow we don't get the image back
          if (tab.hasAttribute("tabmix_temp_pendingtab")) {
            setTimeout(() => {
              if (tab.parentElement) {
                gBrowser.removeTab(tab, {animate: false});
              }
            }, 1000);
          }
        }
      });
    }
  },

  bookmarksOnDemand: false,
  restoringTabs: [],
  tabRestoreQueue: [],

  resetRestoreState(tab) {
    if (tab._restoreState) {
      gBrowser.discardBrowser(tab, true);
    }
    this.updateRestoringTabsList(tab);
  },

  updateRestoringTabsList(tab) {
    if (
      !this.restoringTabs.length &&
      !this.tabRestoreQueue.length &&
      !this.bookmarksOnDemand
    ) {
      return;
    }
    let index = this.restoringTabs.indexOf(tab);
    if (index > -1) {
      this.restoringTabs.splice(index, 1);
    }
    if (this.tabRestoreQueue.length) {
      this.restoreNextTab();
    }
    if (!this.restoringTabs.length) {
      this.bookmarksOnDemand = false;
    }
  },

  restoreNextTab() {
    if (this.restoringTabs.length >= 3) {
      return;
    }

    const tab = this.tabRestoreQueue.shift();
    if (tab) {
      this.restoringTabs.push(tab);
      gBrowser.reloadTab(tab);
    }
  },

  // for unloaded pending tab, we copy the image from temporary tab
  addImageToLazyPendingTab(tab) {
    if (tab.selected || !tab.hasAttribute("tabmix_temp_pendingtab")) {
      return;
    }
    const bookmarkUrl = tab.getAttribute("tabmix_bookmarkUrl");
    const restoringTab = this.restoringTabs.find(t => t.getAttribute("tabmix_bookmarkUrl") === bookmarkUrl);
    if (restoringTab && restoringTab !== tab && tab.hasAttribute("image")) {
      restoringTab.setAttribute("image", tab.getAttribute("image") ?? "");
      gBrowser.removeTab(tab, {animate: false});
    }
  },

  setTabTitle: function TMP_PC_setTabTitle(aTab, aUrl, title) {
    if (!aTab || !aTab.parentNode)
      return false;
    if (!aUrl)
      aUrl = aTab.linkedBrowser.currentURI.spec;
    if (title != aTab.label) {
      aTab.setAttribute("tabmix_changed_label", title);
      gBrowser._setTabLabel(aTab, title);
      this._tabTitleChanged = true;
      return true;
    }
    return false;
  },

  asyncSetTabTitle(tab, url, initial, reset) {
    if (!tab) {
      return Promise.resolve(false);
    }
    if (!url) {
      url = tab.linkedBrowser.currentURI.spec;
    }
    return this.asyncGetTabTitle(tab, url).then(newTitle => {
      // only call setTabTitle if we found one to avoid loop
      if (!newTitle) {
        if (reset && !tab.hasAttribute("pending")) {
          gBrowser.setTabTitle(tab);
        }
        return false;
      }
      if (newTitle != tab.label) {
        this.setTabTitle(tab, url, newTitle);
        if (initial) {
          tab._labelIsInitialTitle = true;
        }
      }
      return true;
    });
  },

  async asyncGetTabTitle(aTab, aUrl, title = "") {
    aTab.removeAttribute("tabmix_bookmarkUrl");
    if (this.isUserRenameTab(aTab, aUrl)) {
      return Promise.resolve(aTab.getAttribute("fixed-label") ?? "");
    }

    await Tabmix.promiseOverlayLoaded;

    let newTitle = await this.getTitleFromBookmark(aUrl);
    if (aTab && newTitle) {
      aTab.setAttribute("tabmix_bookmarkUrl", aUrl);
    }
    if (!newTitle && aTab.hasAttribute("pending")) {
      newTitle = TMP_SessionStore.getTitleFromTabState(aTab);
    }
    return newTitle || title;
  },

  getTitleFromBookmark(aUrl, aTitle = "") {
    return this.PlacesUtils.asyncGetTitleFromBookmark(aUrl, aTitle);
  },

  asyncGetTitleFromBookmark(aUrl, aTitle) {
    return this.PlacesUtils.asyncGetTitleFromBookmark(aUrl, aTitle);
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
    if (bookmarkChanged && !this._tabTitleChanged)
      return;
    if (this.inUpdateBatch) {
      this._tabTitleChanged = true;
      return;
    }
    this._tabTitleChanged = false;
    TabmixTabbar.updateScrollStatus();
    if (this.currentTab) {
      let tabstrip = gBrowser.tabContainer.arrowScrollbox;
      if (!TabmixTabbar.isMultiRow) {
        let scrollPosition = tabstrip.scrollPosition;
        if (scrollPosition < 100) {
          if (tabstrip.getAttribute("orient") == "vertical") {
            tabstrip.scrollbox.scrollTop = 0;
          } else {
            tabstrip.scrollbox.scrollLeft = 0;
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
        this.handlePlacesEvents = this.handlePlacesEvents.bind(this);
        PlacesUtils.observers.addListener(
          this.listeners,
          this.handlePlacesEvents
        );
        this._hasBookmarksObserver = true;
      } catch (ex) {
        Tabmix.reportError(ex, "Failed to add bookmarks observer:");
      }
    }
  },

  stopObserver: function TMP_PC_stopObserver() {
    if (this._hasBookmarksObserver) {
      PlacesUtils.observers.removeListener(
        this.listeners,
        this.handlePlacesEvents
      );
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
    const promises = [];

    if (aPrefValue) {
      for (let tab of gBrowser.tabs) {
        promises.push(this.asyncSetTabTitle(tab));
      }
      this.startObserver();
    } else {
      let tabs = gBrowser.tabContainer.getElementsByAttribute("tabmix_bookmarkUrl", "*");
      Array.prototype.slice.call(tabs).forEach(tab => {
        tab.removeAttribute("tabmix_bookmarkUrl");
        if (tab.hasAttribute("pending")) {
          promises.push(this.asyncSetTabTitle(tab));
        } else {
          gBrowser.setTabTitle(tab);
        }
      });
      this.stopObserver();
    }
    Promise.all(promises).then(() => {
      this.afterTabTitleChanged();
    });
  },

  _hasBookmarksObserver: false,
  inUpdateBatch: false,
  _tabTitleChanged: false,
  currentTab: null,

  async addItemUrlToTabs(aUrl) {
    const urls = Array.isArray(aUrl) ? aUrl : [aUrl];
    if (this.inUpdateBatch) {
      this._batchData.add.push(...urls);
      return;
    }
    /** @type {Promise<boolean>[]} */
    const promises = [];
    const getBookmarkUrl = (/** @type {string} */ url) => (urls.includes(url) ? url : null);
    /** @type {(tab: Tab, url: string) => Promise<void>} */
    const updateTabs = async(tab, url) => {
      let bookmarkUrl = await this.PlacesUtils.applyCallBackOnUrl(url, getBookmarkUrl);
      if (bookmarkUrl) {
        tab.setAttribute("tabmix_bookmarkUrl", bookmarkUrl);
        promises.push(this.asyncSetTabTitle(tab, url));
      }
    };

    for (let tab of gBrowser.tabs) {
      let url = tab.linkedBrowser.currentURI.spec;
      if (!this.isUserRenameTab(tab, url)) {
        updateTabs(tab, url);
      }
    }
    await Promise.all(promises);
    this.afterTabTitleChanged();
  },

  async removeItemUrlFromTabs(aUrl) {
    const batch = Array.isArray(aUrl);
    const urls = batch ? aUrl : [aUrl];
    if (this.inUpdateBatch) {
      this._batchData.remove.push(...urls);
      return;
    }
    /** @type {Promise<boolean>[]} */
    const promises = [];
    const attrib = "tabmix_bookmarkUrl";
    const tabs = gBrowser.tabContainer.getElementsByAttribute(attrib, batch ? "*" : aUrl) ?? [];
    Array.from(tabs).forEach(tab => {
      let url = tab.linkedBrowser.currentURI.spec;
      if (urls.includes(url)) {
        tab.removeAttribute(attrib);
        if (!this.isUserRenameTab(tab, url)) {
          if (tab.hasAttribute("pending")) {
            promises.push(this.asyncSetTabTitle(tab, url));
          } else {
            gBrowser.setTabTitle(tab);
          }
        }
      }
    });
    await Promise.all(promises);
    this.afterTabTitleChanged();
  },

  async updateTabs() {
    const promises = [];
    for (let tab of gBrowser.tabs) {
      tab.removeAttribute("tabmix_bookmarkUrl");
      let url = tab.linkedBrowser.currentURI.spec;
      if (!this.isUserRenameTab(tab, url)) {
        promises.push(this.asyncSetTabTitle(tab, url, false, true));
      }
    }
    await Promise.all(promises);
    this.afterTabTitleChanged();
  },

  handlePlacesEvents(aEvents) {
    const events = aEvents.filter(ev => ev.id !== -1 ||
      ev.itemType === Ci.nsINavBookmarksService.TYPE_BOOKMARK);
    for (const ev of events) {
      switch (ev.type) {
        case "bookmark-added":
          if (ev.url && !isBlankPageURL(ev.url)) {
            this.addItemUrlToTabs(ev.url);
          }
          break;
        case "bookmark-removed":
          this.removeItemUrlFromTabs(ev.url);
          break;
        case "bookmark-title-changed":
        case "bookmark-url-changed":
          this.updateTabs();
          break;
      }
    }
  },

  // onItemChanged also fired when page is loaded (visited count changed ?)
  onItemChanged: function TMP_PC_onItemChanged(itemId, property, isAnnotationProperty,
                                               newValue, lastModified, itemType,
                                               parentId, guid) {
    if (itemId == -1 || itemType != Ci.nsINavBookmarksService.TYPE_BOOKMARK ||
        property != "uri" && property != "title")
      return;

    if (property == "uri" && newValue && !isBlankPageURL(newValue)) {
      this.addItemUrlToTabs(newValue);
    } else if (property == "title") {
      PlacesUtils.bookmarks.fetch({guid}, null, {})
          .then(({url}) => this.addItemUrlToTabs(url.href));
    }
  },

  onBeginUpdateBatch: function TMP_PC_onBeginUpdateBatch() {
    this._batchData = {remove: [], add: []};
    this.inUpdateBatch = true;

    if (TabmixTabbar.widthFitTitle &&
        Tabmix.tabsUtils.isElementVisible(gBrowser._selectedTab))
      this.currentTab = gBrowser._selectedTab;
  },

  onEndUpdateBatch: function TMP_PC_onEndUpdateBatch() {
    var data = this._batchData;
    this.inUpdateBatch = false;
    var [removeURLs, addURLs] = [data.remove, data.add];
    if (addURLs.length)
      this.addItemUrlToTabs(addURLs);
    if (removeURLs.length)
      this.removeItemUrlFromTabs(removeURLs);

    this._batchData = {remove: [], add: []};

    this.afterTabTitleChanged();
    this.currentTab = null;
  },

  onItemVisited() {},
  onItemMoved() {},

  contextMenu: {
    toggleEventListener(enable) {
      const eventListener = enable ? "addEventListener" : "removeEventListener";
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
  },
};

Tabmix.onContentLoaded = {
  changeCode() {
    this.change_miscellaneous();
    this.change_utilityOverlay();
  },

  change_miscellaneous() {
    const [customTitlebar, updateTitlebar] = TabmixSvc.version(1350) ?
      [window.CustomTitlebar, "CustomTitlebar._update"] :
      [window.TabsInTitlebar, "TabsInTitlebar._update"];

    if ("_update" in customTitlebar) {
      if (!TabmixSvc.version(1350)) {
        Tabmix.changeCode(TabmixTabbar, "TabmixTabbar.updateTabsInTitlebarAppearance")._replace(
          'window.CustomTitlebar',
          'window.TabsInTitlebar'
        ).toCode();

        Tabmix.changeCode(TabmixTabbar, "TabmixTabbar.getTabsPosition")._replace(
          /customtitlebar/g,
          'tabsintitlebar'
        ).toCode();
      }
      // set option to Prevent double click on Tab-bar from changing window size.
      Tabmix.changeCode(customTitlebar, updateTitlebar)._replace(
        /(})(\)?)$/,
        // when we get in and out of customTitlebar mode call updateScrollStatus
        // force another update when rows number changed by Tabmix to update
        // titlebar and titlebarContent height
        '  TabmixTabbar.updateTabsInTitlebarAppearance();\n  ' +
        '$1$2'
      ).toCode();
      TabmixTabbar.updateTabsInTitlebarAppearance();
    }

    if (Tabmix.isVersion(1370)) {
      // gBrowser.pinTab call gBrowser.#handleTabMove
      gBrowser._handleTabMove = Tabmix.getPrivateMethod(
        // @ts-expect-error - Tabbrowser class
        window.Tabbrowser,
        "handleTabMove",
        "adoptTab",
        "window.Tabbrowser"
      );
    }

    // we can't use TabPinned.
    // gBrowser.pinTab call _updateCloseButtons that call updateScrollStatus
    // before it dispatch TabPinned event.
    Tabmix.changeCode(gBrowser, "gBrowser.pinTab")._replace(
      'this._updateTabBarForPinnedTabs();',
      '  if (TabmixTabbar.widthFitTitle && aTab.hasAttribute("width"))' +
      '    aTab.removeAttribute("width");' +
      '  if (Tabmix.prefs.getBoolPref("lockAppTabs") &&' +
      '      !aTab.hasAttribute("locked") && "lockTab" in this) {' +
      '    this.lockTab(aTab);' +
      '    aTab.setAttribute("_lockedAppTabs", "true");' +
      '  }' +
      '  $&' +
      '  TabmixTabbar.updateScrollStatus();'
    ).toCode();
  },

  change_whereToOpenLink(parent) {
    // fix small bug when the event is not mouse event
    // inverse focus of middle/ctrl/meta clicked bookmarks/history
    // don't inverse focus when called from onPopupClick and One-Click Search
    // Bar Interface is on
    // when we are in single window mode set the function to return "tab"
    let $LF = '\n    ';
    Tabmix.changeCode(parent, "whereToOpenLink")._replace(
      '{', '{\n' +
      'if (e && e.tabmixContentClick) {\n' +
      '  let {where, suppressTabsOnFileDownload} = e.tabmixContentClick;\n' +
      '  return suppressTabsOnFileDownload ? "current" : where;\n' +
      '}\n'
    )._replace(
      'let middle = !ignoreButton && e.button == 1;',
      'let middle = !ignoreButton && e.button && e.button == 1;'
    )._replace(
      'return shift ? "tabshifted" : "tab";',
      '{' + $LF +
      'let callerTrace = TabmixSvc.console.callerTrace();' + $LF +
      'let list = ["openUILink", "handleLinkClick", "BG_observe", "contentAreaClick",' + $LF +
      '            "TMP_tabshifted", "TMP_whereToOpenLink", "TMP_contentLinkClick"];' + $LF +
      'let pref = callerTrace.contain(list) ?' + $LF +
      '    "extensions.tabmix.inversefocusLinks" : "extensions.tabmix.inversefocusOther";' + $LF +
      'let notOneClickSearch = !Services.prefs.getBoolPref("browser.search.showOneOffButtons", false) ||' + $LF +
      '                        !callerTrace.contain("onPopupClick");' + $LF +
      'if (notOneClickSearch && Services.prefs.getBoolPref(pref, true))' + $LF +
      '  shift = !shift;' + $LF +
      '$&' + $LF +
      '}'
    )._replace(
      'return "window";',
      'return TabmixSvc.getSingleWindowMode() ? "tab" : "window";'
    ).toCode();
  },

  change_utilityOverlay() {
    //  Bug 1742801 - move whereToOpenLink and getRootEvent implementations into BrowserUtils
    //  Bug 1742889 - Rewrite consumers of whereToOpenLink to use BrowserUtils.whereToOpenLink
    if (!TabmixSvc.whereToOpenLinkChanged) {
      TabmixSvc.whereToOpenLinkChanged = true;
      this.change_whereToOpenLink(BrowserUtils);
    }
    Tabmix.whereToOpenLink = BrowserUtils.whereToOpenLink.bind(BrowserUtils);

    /** @type {PrivateFunctionsNS.onContentLoaded._getWindow} */
    function getWindow(where, params = {}) {
      const forceNonPrivate = params.forceNonPrivate ?? false;
      // Establish which window we'll load the link in.
      let w;
      if (where == "current" && params.targetBrowser) {
        w = params.targetBrowser.ownerGlobal;
      } else {
        w = window.URILoadingHelper.getTargetWindow(window, {forceNonPrivate});
      }

      if (w && where == "window" && !Tabmix.isNewWindowAllow(params.private)) {
        where = "tab";
      }

      // We don't want to open tabs in popups, so try to find a non-popup window in
      // that case.
      if ((where == "tab" || where == "tabshifted") && w && !w.toolbar.visible) {
        w = window.URILoadingHelper.getTargetWindow(window, {
          skipPopups: true,
          forceNonPrivate,
        });
      }

      return {w, where};
    }

    // update incompatibility with X-notifier(aka WebMail Notifier) 2.9.13+
    // in case it warp the function in its object
    let [fnObj, fnName] = this.getXnotifierFunction("openLinkIn");
    Tabmix.originalFunctions.openLinkIn = fnObj[fnName];

    /** @type {PrivateFunctionsNS.onContentLoaded._openLinkIn} */
    fnObj[fnName] = function openLinkIn(url, _where, params = {}) {
      const {w, where} = getWindow(_where, params);

      const callerTrace = Tabmix.callerTrace();
      if (callerTrace.contain("BG_observe", "loadHomepage")) {
        params.inBackground = Services.prefs.getBoolPref("browser.tabs.loadInBackground");
      } else if (
        where == "current" &&
        callerTrace.contain("ReaderParent.toggleReaderMode")
      ) {
        gBrowser.selectedBrowser.tabmix_allowLoad = true;
      }

      const lastCreatedTab = w?.gBrowser.getTabForLastPanel();

      const returnValue = Tabmix.originalFunctions.openLinkIn.call(null, url, where, params);

      if (w && where !== "window" && where !== "save") {
        const latestTab = w.gBrowser.getTabForLastPanel();
        const targetTab = latestTab !== lastCreatedTab ? latestTab : w.gBrowser.selectedTab;
        w.TMP_Places.asyncSetTabTitle(targetTab, url, true).then(() => {
          if (where == "current") {
            w.gBrowser.ensureTabIsVisible(w.gBrowser.selectedTab);
          }
        });
      }

      return returnValue;
    };
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
      const obj = fn?.[0] ? com.tobwithu[fn[0]] : undefined;
      if (obj) {
        return [obj, aName];
      }
    }
    return [window, aName];
  }

};

if (typeof E10SUtils !== "object") {
  ChromeUtils.defineESModuleGetters(this, {E10SUtils: "resource://gre/modules/E10SUtils.sys.mjs"});
}
