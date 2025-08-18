/* exported TMP_ClosedTabs */
"use strict";

/*
 * chrome://tabmixplus/content/session/sessionStore.js
 *
 * original code by onemen
 *
 */
/** @type {TabmixSessionStore} */
var TMP_SessionStore = {
  // get title for closed window from bookmark title or user tab title
  // this function return promise to work with Firefox 60 async bookmarks.fetch
  asyncGetTabTitleForClosedWindow(aUndoItem) {
    let selectedTab = aUndoItem.selected && aUndoItem.tabs[aUndoItem.selected - 1];
    if (!selectedTab || !selectedTab.entries || selectedTab.entries.length === 0) {
      return Promise.resolve(aUndoItem.title);
    }

    let tabData = this.getActiveEntryData(selectedTab);
    let url = selectedTab.attributes?.["label-uri"];
    if (url == tabData.url || url == "*") {
      // @ts-expect-error
      aUndoItem.title = selectedTab.attributes?.["fixed-label"];
    } else {
      const dataTitle = aUndoItem.title || tabData.title || tabData.url;
      return TMP_Places.getTitleFromBookmark(tabData.url, dataTitle).then(title => {
        if (Tabmix.isBlankNewTab(title)) {
          title = Tabmix.emptyTabTitle;
        }
        return title;
      });
    }
    return Promise.resolve(aUndoItem.title);
  },

  // get SessionStore active entry data.
  getActiveEntryData: function TMP_ss_getActiveEntryData(aData) {
    let activeIndex = (aData.index || aData.entries.length) - 1;
    if (activeIndex >= aData.entries.length) {
      activeIndex = aData.entries.length - 1;
    }

    return aData.entries[activeIndex] || {url: "", title: ""};
  },

  getTitleFromTabState(aTab) {
    /** @type {SessionStoreNS.TabDataEntry} */
    let data = {};
    data.title = SessionStore.getLazyTabValue(aTab, "title");
    if (data.title) {
      data.url = SessionStore.getLazyTabValue(aTab, "url");
    } else {
      let tabData = JSON.parse(SessionStore.getTabState(aTab));
      data = this.getActiveEntryData(tabData);
    }
    if (Tabmix.isBlankNewTab(data.url)) {
      return Tabmix.emptyTabTitle;
    }
    return data.title || "";
  },

  getUrlFromTabState(aTab) {
    /** @type {SessionStoreNS.TabDataEntry} */
    let data = {};
    data.url = SessionStore.getLazyTabValue(aTab, "url");
    if (!data.url) {
      let tabData = JSON.parse(SessionStore.getTabState(aTab));
      data = this.getActiveEntryData(tabData);
    }
    return data.url;
  },

  // check if pending tab has no history or is about:blank, about:home, about:newtab
  isBlankPendingTab(aTab) {
    if (!aTab.hasAttribute("pending")) {
      return false;
    }

    let entries;
    let url = SessionStore.getLazyTabValue(aTab, "url");
    if (url) {
      entries = [{url}];
    } else {
      let tabData = JSON.parse(SessionStore.getTabState(aTab));
      entries = tabData && tabData.entries;
    }
    if (entries && entries.length > 1) {
      return false;
    }

    return (
      !entries[0] ||
      [TabmixSvc.aboutBlank, TabmixSvc.aboutNewtab, "about:home"].includes(entries[0].url)
    );
  },

  afterSwitchThemes: false,
  // we call this only one time on window load
  // and store the value in Tabmix.isWindowAfterSessionRestore
  // we call this from onContentLoaded before SessionStore run its onLoad
  setAfterSessionRestored() {
    let afterSessionRestore;
    if (!Tabmix.isFirstWindow) {
      afterSessionRestore = false;
      // When we close all browser windows without exit (non browser windows are opened)
      // Firefox reopen last closed window when a browser window opens
    } else if (Tabmix.numberOfWindows(false, null) > 1) {
      afterSessionRestore = true;
    } else if (this.afterSwitchThemes) {
      afterSessionRestore = true;
    }

    if (typeof afterSessionRestore == "boolean") {
      Tabmix.isWindowAfterSessionRestore = afterSessionRestore;
    } else {
      ChromeUtils.defineLazyGetter(Tabmix, "isWindowAfterSessionRestore", () => {
        // when TMP session manager is enabled ss.willRestore is true only after restart
        SessionStartup.onceInitialized
          .then(() => {
            Tabmix.isWindowAfterSessionRestore = SessionStartup.willRestore();
          })
          .catch(Tabmix.reportError);
        // until sessionstartup initialized just return the pref value,
        // we only use isWindowAfterSessionRestore when our Session Manager enable
        return Services.prefs.getBoolPref("browser.sessionstore.resume_session_once");
      });
    }
  },

  setSessionRestore(aEnable) {
    Services.prefs.setBoolPref("browser.warnOnQuit", aEnable);
    Services.prefs.setBoolPref("browser.sessionstore.resume_from_crash", aEnable);
    if (aEnable) {
      Services.prefs.setIntPref("browser.startup.page", 3);
    } else if (Services.prefs.getIntPref("browser.startup.page") == 3) {
      Services.prefs.setIntPref("browser.startup.page", 1);
    }
  },

  /**
   * update tab title from user name or bookmark.
   *
   * @param aTabData an object value - tabData from SessionStore
   * @param aUri string value - url address
   * @param aTitle string value - title
   * @returns tab title - string.
   */
  asyncGetTabTitle(aData, aUri, aTitle) {
    var fixedLabelUri = this._getAttribute(aData, "label-uri");
    if (fixedLabelUri == aUri || fixedLabelUri == "*") {
      return Promise.resolve(this._getAttribute(aData, "fixed-label"));
    }

    return TMP_Places.asyncGetTitleFromBookmark(aUri, aTitle);
  },

  /**
   * get custom tab value from SessionStore
   *
   * @param aTabData an object value - tabData from SessionStore
   * @param attrib attribute name as string
   * @returns attribute value as string or empty string.
   */
  _getAttribute: function TMP_ss__getAttribute(aTabData, attrib) {
    return aTabData.extData?.[attrib] ?? "";
  },
};

/** @type {TabmixClosedTabsNS} */
var TMP_ClosedTabs = {
  _buttonBroadcaster: null,
  get buttonBroadcaster() {
    if (!this._buttonBroadcaster) {
      this._buttonBroadcaster = document.getElementById("tmp_undocloseButton");
    }

    return this._buttonBroadcaster;
  },

  // make tabmix-closedTabs-toolbaritem single-functionality or dual-functionality
  setButtonType(menuOnly) {
    const buttonType = menuOnly ? "menu" : "menu-button";
    if (this.buttonBroadcaster.getAttribute("type") != buttonType) {
      this.buttonBroadcaster.setAttribute("type", buttonType);
    }

    const closedTabsButton = document.getElementById("tabmix-closedTabsButton");
    if (closedTabsButton) {
      const onOverflowMenu =
        closedTabsButton.parentNode.getAttribute("cui-areatype") === "menu-panel";
      if (buttonType === "menu-button" && !onOverflowMenu) {
        closedTabsButton.setAttribute(
          "tooltiptext",
          closedTabsButton.parentNode.getAttribute("_tooltiptext") ?? ""
        );
      } else {
        closedTabsButton.removeAttribute("tooltiptext");
      }
    }
  },

  setButtonDisableState: function ct_setButtonDisableState(aState) {
    if (typeof aState == "undefined") {
      aState = this.count === 0;
    }

    Tabmix.setItem(this.buttonBroadcaster, "disabled", aState || null);
  },

  /** Get closed tabs count */
  get count() {
    if (!window.__SSi) {
      return 0;
    }

    if (Tabmix.isVersion(1360) || !Tabmix.isVersion(1350)) {
      return SessionStore.getClosedTabCount(window);
    }

    const closedTabCountFromClosedGroupInClosedWindows = SessionStore.getClosedWindowData()
      .map(winData => winData.closedGroups)
      .flat()
      .map(group => group?.tabs.length ?? 0)
      .reduce((a, b) => a + b, 0);

    return SessionStore.getClosedTabCount(window) - closedTabCountFromClosedGroupInClosedWindows;
  },

  /** Get closed tabs data */
  get getClosedTabData() {
    if (window.__SSi) {
      return SessionStore.getClosedTabData();
    }
    return [];
  },

  get allClosedTabData() {
    const closedTabsData = this.getClosedTabData;
    if (!PrivateBrowsingUtils.isWindowPrivate(window)) {
      const restoreClosedTabsFromClosedWindows = Services.prefs.getBoolPref(
        "browser.sessionstore.closedTabsFromClosedWindows"
      );
      if (restoreClosedTabsFromClosedWindows) {
        closedTabsData.push(...SessionStore.getClosedTabDataFromClosedWindows());
      }
    }

    return closedTabsData;
  },

  getSource(item) {
    if (item.hasAttribute("source-closed-id")) {
      return {
        sourceClosedId: Number(item.getAttribute("source-closed-id")),
        closedWindow: true,
      };
    } else if (item.hasAttribute("source-window-id")) {
      return {sourceWindowId: item.getAttribute("source-window-id") ?? ""};
    }

    return window;
  },

  // copy of function from SessionStore.sys.mjs SessionStoreInternal._resolveClosedDataSource
  _resolveClosedDataSource(source) {
    let winData;
    if (source instanceof Ci.nsIDOMWindow) {
      winData = SessionStore.getWindowState(source);
    } else if ("sourceWindow" in source && source.sourceWindow instanceof Ci.nsIDOMWindow) {
      winData = SessionStore.getWindowState(source.sourceWindow);
    } else if ("sourceClosedId" in source && typeof source.sourceClosedId == "number") {
      const closedWindowData = SessionStore.getClosedWindowData().find(
        closedData => closedData.closedId == source.sourceClosedId
      );
      if (!closedWindowData) {
        throw Components.Exception("No such closed window", Cr.NS_ERROR_INVALID_ARG);
      }
      return closedWindowData;
    } else if ("sourceWindowId" in source && typeof source.sourceWindowId == "string") {
      let win = SessionStore.getWindowById(source.sourceWindowId);
      winData = SessionStore.getWindowState(win);
    } else {
      throw Components.Exception("Invalid source object", Cr.NS_ERROR_INVALID_ARG);
    }

    /** @type {SessionStoreNS.WindowStateData} */ // @ts-expect-error
    const result = winData.windows[0];
    return result;
  },

  // copy of function from SessionStore.sys.mjs SessionStoreInternal._getStateForClosedTabsAndClosedGroupTabs
  // @ts-expect-error
  _getStateForClosedTabsAndClosedGroupTabs(winData, aIndex) {
    const closedGroups = winData.closedGroups ?? [];
    const closedTabs = winData._closedTabs ?? [];

    // Merge tabs and groups into a single sorted array of tabs sorted by
    // closedAt
    /** @type {SessionStoreNS.ClosedTabData[]} */
    let result = [];
    let groupIdx = 0;
    let tabIdx = 0;
    let current = 0;
    let totalLength = closedGroups.length + closedTabs.length;

    while (current < totalLength) {
      /** @type {SessionStoreNS.ClosedGroup} */ // @ts-expect-error
      let group = closedGroups[groupIdx];

      /** @type {SessionStoreNS.ClosedTabData} */ // @ts-expect-error
      let tab = closedTabs[tabIdx];

      if (
        groupIdx < closedGroups.length &&
        (tabIdx >= closedTabs.length || group?.closedAt > tab?.closedAt)
      ) {
        // eslint-disable-next-line no-loop-func
        group.tabs.forEach((groupTab, idx) => {
          groupTab._originalStateIndex = idx;
          groupTab._originalGroupStateIndex = groupIdx;
          result.push(groupTab);
        });
        groupIdx++;
      } else {
        tab._originalStateIndex = tabIdx;
        result.push(tab);
        tabIdx++;
      }

      current++;
      // @ts-ignore
      if (current > aIndex) {
        break;
      }
    }

    if (aIndex !== undefined) {
      const tabData = result[aIndex];
      if (tabData) {
        return tabData;
      }
      throw new Error(`ClosedTabData not found for index ${aIndex}`);
    }

    return result;
  },

  // copy of function from SessionStore.sys.mjs SessionStoreInternal._getClosedTabStateFromUnifiedIndex
  _getClosedTabStateFromUnifiedIndex(sourceWinData, tabState) {
    let closedTabSet, closedTabIndex;
    // eslint-disable-next-line no-eq-null
    if (tabState._originalGroupStateIndex == null) {
      closedTabSet = sourceWinData._closedTabs;
    } else {
      closedTabSet =
        // @ts-ignore
        sourceWinData.closedGroups[tabState._originalGroupStateIndex].tabs;
    }
    closedTabIndex = tabState._originalStateIndex;

    return {closedTabSet, closedTabIndex};
  },

  // copy of function from SessionStore.sys.mjs SessionStoreInternal.getPreferredRemoteType
  getPreferredRemoteType(url, aWindow, userContextId) {
    return E10SUtils.getRemoteTypeForURI(
      url,
      aWindow.gMultiProcessBrowser,
      aWindow.gFissionBrowser,
      E10SUtils.DEFAULT_REMOTE_TYPE,
      null,
      E10SUtils.predictOriginAttributes({
        window: aWindow,
        userContextId,
      })
    );
  },

  getSingleClosedTabData(source, index) {
    const sourceWinData = this._resolveClosedDataSource(source);

    if (!Tabmix.isVersion(1350)) {
      const closedIndex =
        source.closedWindow && !source.restoreAll ?
          sourceWinData._closedTabs.findIndex(tabData => tabData.closedId == index)
        : index;
      return {
        tabData: sourceWinData._closedTabs[closedIndex],
        closedTabIndex: closedIndex,
      };
    }

    let closedTabState;
    if (source.closedWindow) {
      const closedTabs = this._getStateForClosedTabsAndClosedGroupTabs(sourceWinData, undefined);
      closedTabState =
        source.restoreAll ?
          closedTabs[index]
        : closedTabs.find(tabData => tabData.closedId == index);
    } else {
      closedTabState = this._getStateForClosedTabsAndClosedGroupTabs(sourceWinData, index || 0);
    }

    if (!closedTabState) {
      return {tabData: undefined, closedTabIndex: -1};
    }

    const {closedTabSet, closedTabIndex} = this._getClosedTabStateFromUnifiedIndex(
      sourceWinData,
      closedTabState
    );

    return {tabData: closedTabSet[closedTabIndex], closedTabIndex};
  },

  getUrl: function ct_getUrl(aTabData) {
    return TMP_SessionStore.getActiveEntryData(aTabData.state).url;
  },

  getTitle: function ct_getTitle(aTabData, aUri) {
    return TMP_SessionStore.asyncGetTabTitle(aTabData.state, aUri, aTabData.title);
  },

  /* .......... functions for closedtabs list menu and context menu .......... */

  get keepMenuOpen() {
    return Tabmix.prefs.getBoolPref("undoClose.keepMenuOpen");
  },

  set keepMenuOpen(val) {
    Tabmix.prefs.setBoolPref("undoClose.keepMenuOpen", Boolean(val));
  },

  populateUndoSubmenu(aPopup, panel, isAppMenu = Boolean(panel)) {
    const parent = panel ?? aPopup;
    if (!parent.hasAttribute("context")) {
      parent.setAttribute("context", "tm_undocloseContextMenu");
    }

    const closedTabsInfo = {tabs: this.allClosedTabData.slice(), index: {value: -1}};
    const childNodes = parent.childNodes;
    const isSubviewbutton = aPopup.__tagName === "toolbarbutton";
    for (let i = 0; i < childNodes.length - (isAppMenu ? 0 : 1); i++) {
      /** @type {TabmixClosedTabsNS.Menuitem} */ // @ts-expect-error
      let m = childNodes[i];
      if (isSubviewbutton && m.id.startsWith("closed-tabs-tab-group")) {
        /** @type {ClosedObjectsUtils.PopupElement} */ // @ts-ignore
        const popupItem = m;
        const groupId = popupItem.id.replace("closed-tabs-tab-group-", "");
        popupItem.nextElementSibling?.setAttribute("data-group-id", groupId);
        const subview = popupItem.querySelector(".panel-subview-body");
        subview.setAttribute("context", "tm_undocloseContextMenu");
        subview.hidePopup = aPopup.hidePopup;
        this.updateTabGroupItems(popupItem, closedTabsInfo, isSubviewbutton);
      } else if (m.tagName === "menu") {
        this.updateTabGroupItems(m.menupopup, closedTabsInfo, isSubviewbutton);
      } else if (
        !m.previousElementSibling?.id.startsWith("closed-tabs-tab-group") &&
        m.tagName !== "menuseparator"
      ) {
        this.updateMenuItem(m, closedTabsInfo);
        if (isSubviewbutton) {
          m.value = i;
          m.setAttribute("class", "bookmark-item subviewbutton subviewbutton-iconic");
        }
      }
    }

    if (panel?.__updatingViewAfterDelete) {
      // we are repopulating the list after user removed an item
      // the menuitem already exist
      return true;
    }

    Tabmix.closedObjectsUtils.addSeparatorIfMissing(aPopup);
    // Reopen All Tabs
    let reopenAllTabs = aPopup.lastChild;
    reopenAllTabs.setAttribute("value", -2);
    reopenAllTabs.removeEventListener(
      "command",
      RecentlyClosedTabsAndWindowsMenuUtils.onRestoreAllTabsCommand
    );
    reopenAllTabs.addEventListener("command", this);

    const addMenu = this.addMenuItem.bind(this, aPopup, isSubviewbutton);
    if (isSubviewbutton) {
      reopenAllTabs.classList.add("subviewbutton");
      // "Keep menu open"
      const mi = addMenu({
        id: "lockedClosedTabsList",
        label: TabmixSvc.getString("undoclosetab.keepOpen.label"),
        val: -3,
      });
      mi.setAttribute("tooltiptext", TabmixSvc.getString("undoclosetab.keepOpen.description"));
      mi.setAttribute("closemenu", "none");
      const image = this.keepMenuOpen ? "chrome://tabmixplus/skin/pin.png" : "";
      Tabmix.setItem(mi, "image", image || null);
    }
    // "Clear Closed Tabs List"
    addMenu({
      id: "clearClosedTabsList",
      label: TabmixSvc.getString("undoclosetab.clear.label"),
      val: -1,
      keyId: "clearClosedTabs",
    });

    return true;
  },

  closeTabGroupView(parent, groupId) {
    if (this.keepMenuOpen && groupId) {
      if (this.count) {
        const panel = parent.panelMultiView;
        panel.goBack();
        panel.querySelector(`[data-group-id="${groupId}"]`).remove();
        parent.remove();
      } else {
        const popup = parent.closest(".cui-widget-panel");
        popup?.hidePopup();
      }
    }
  },

  updateTabGroupItems(parent, closedTabsInfo, isSubviewbutton) {
    const tagName = isSubviewbutton ? "toolbarbutton" : "menuitem";
    const items = parent.querySelectorAll(tagName);
    for (const item of Array.from(items).slice(0, -1)) {
      this.updateMenuItem(item, closedTabsInfo);
    }
    const {id, ...source} = items.item(0)?.closedGroup ?? {id: ""};
    const clearTabGroup = this.addMenuItem(parent, isSubviewbutton, {
      id: "clearTabGroup",
      label: "Clear tab group",
      tagName,
      command: () => {
        SessionStore.forgetClosedTabGroup(source, id);
        this.closeTabGroupView(parent, id);
      },
    });
    clearTabGroup.setAttribute("closemenu", this.keepMenuOpen ? "none" : "auto");
    const reopenTabGroupItem = parent.lastChild;
    reopenTabGroupItem.setAttribute("closemenu", this.keepMenuOpen ? "none" : "auto");
    reopenTabGroupItem.addEventListener("command", () => {
      this.closeTabGroupView(parent, id);
    });
  },

  updateMenuItem(item, closedTabsInfo) {
    const closedTab = closedTabsInfo.tabs[++closedTabsInfo.index.value];

    // workaround for bug 1932941 - missing "source-closed-id"
    if (typeof closedTab?.sourceClosedId == "number" && !item.hasAttribute("source-closed-id")) {
      const url = closedTab.state.entries[closedTab.state.index - 1]?.url;
      const targetURI = item.getAttribute("targetURI");
      if (url === targetURI) {
        item.removeAttribute("source-window-id");
        item.setAttribute("source-closed-id", closedTab.sourceClosedId);
        item.setAttribute("value", closedTab.closedId);
      } else {
        console.log("Tabmix Error: unable to set source-closed-id", item, url, targetURI);
      }
    }

    if (closedTab) {
      if (closedTab && item.hasAttribute("targetURI")) {
        this.getTitle(closedTab, item.getAttribute("targetURI") ?? "").then(title => {
          item.setAttribute("label", title);
        });
      }
      const groupId =
        Tabmix.isVersion(1360) ? closedTab.closedInTabGroupId : closedTab.state.groupId;
      if (groupId) {
        item.closedGroup = {
          id: groupId,
          sourceClosedId: closedTab.sourceClosedId,
          sourceWindowId: closedTab.sourceWindowId,
        };
      }
    } else {
      console.log("Tabmix Error: unable to find closed tab data", item, {
        index: closedTabsInfo.index.value,
        closedTabs: closedTabsInfo.tabs[++closedTabsInfo.index.value],
      });
    }
    item.setAttribute("closemenu", this.keepMenuOpen ? "none" : "auto");
    item.removeAttribute("oncommand");
    item.addEventListener("command", this, {capture: true, once: true});
    item.addEventListener("click", this);
    item.removeEventListener("click", RecentlyClosedTabsAndWindowsMenuUtils._undoCloseMiddleClick);
  },

  repopulateGroupItems(popup, itemToRemove) {
    this.setPopupWidth(popup);

    const deletedIndex = Number(itemToRemove.getAttribute("value"));
    let key = "",
      shortcut = "";
    if (deletedIndex === 0) {
      key = itemToRemove.getAttribute("key") ?? "";
      shortcut = itemToRemove.getAttribute("shortcut") ?? "";
    }
    itemToRemove.remove();

    const panelBody = popup.closest("[mainViewId]");

    /** @type {ClosedObjectsUtils.Menuitem[]} */ // @ts-ignore
    const menuItems = panelBody?.querySelectorAll("[source-window-id]");
    for (const item of menuItems) {
      // we can not rely on the item order to set the index
      const index = Number(item.getAttribute("value"));
      if (index > deletedIndex) {
        item.setAttribute("value", index - 1);
        if (deletedIndex === 0 && index === 1) {
          item.setAttribute("key", key);
          item.setAttribute("shortcut", shortcut);
        }
      }
    }

    const groupId = popup.parentNode.id.replace("closed-tabs-tab-group-", "");
    const group = SessionStore.getClosedTabGroups().find(g => g.id === groupId);
    if (!group || group.tabs.length === 0) {
      this.closeTabGroupView(popup.parentNode, groupId);
    }
  },

  addMenuItem(popup, isSubviewbutton, {id, label, command, val, keyId, tagName}) {
    const m = document.createXULElement(tagName || popup.__tagName || "menuitem");
    m.setAttribute("id", id);
    m.setAttribute("label", label);
    if (val) {
      m.setAttribute("value", val);
    }
    if (isSubviewbutton) {
      m.setAttribute("class", "subviewbutton");
    } else {
      m.setAttribute("class", "menuitem");
    }
    if (keyId && document.getElementById("key_tm_" + keyId)) {
      m.setAttribute("key", "key_tm_" + keyId);
    }
    m.addEventListener("command", command ?? this);
    popup.insertBefore(m, popup.lastChild);
    return m;
  },

  handleEvent(event) {
    switch (event.type) {
      case "click":
        this.checkForMiddleClick(event);
        break;
      case "command":
        // stop the event before it trigger the listener from
        // RecentlyClosedTabsAndWindowsMenuUtils.createEntry
        event.stopPropagation();
        if (event.originalTarget._tabmix_middleClicked) {
          delete event.originalTarget._tabmix_middleClicked;
        } else {
          this.restoreCommand(event);
        }
        break;
    }
  },

  handleButtonEvent(event) {
    const showSubView =
      event.target.getAttribute("type") === "menu" ||
      event.target.parentNode.getAttribute("cui-areatype") === "menu-panel";
    switch (event.type) {
      case "click":
        if (event.button === 1) {
          this.restoreTab(window, -2, "original");
        } else if (
          event.button === 0 &&
          showSubView &&
          !TabmixAllTabs.isAfterCtrlClick(event.target)
        ) {
          Tabmix.closedObjectsUtils.showSubView(event);
        }
        break;
      case "command":
        if (
          event.target.id === "tabmix-closedTabsButton" &&
          !showSubView &&
          !TabmixAllTabs.isAfterCtrlClick(event.target)
        ) {
          Tabmix.undoCloseTab();
        }
        break;
    }
  },

  restoreCommand(aEvent) {
    const item = aEvent.originalTarget;
    const index = Number(item.getAttribute("value"));
    if (index == -3) {
      this.keepMenuOpen = !this.keepMenuOpen;
      const image = this.keepMenuOpen ? "chrome://tabmixplus/skin/pin.png" : "";
      Tabmix.setItem(item, "image", image || null);
      if (item.parentNode.id !== "appMenu-library-recentlyClosedTabs") {
        this.setPopupWidth(item.parentNode);
      }
      return;
    }

    this.doCommand("restoreTab", "original", item);
  },

  setPopupWidth(popup) {
    if (!popup.hasAttribute("width")) {
      const width = Tabmix.getBoundsWithoutFlushing(popup).width;
      popup.setAttribute("width", width);
    }
  },

  checkForMiddleClick: function ct_checkForMiddleClick(aEvent) {
    if (aEvent.button != 1) {
      return;
    }

    const deleteItem = Tabmix.prefs.getBoolPref("middleclickDelete");
    const where = deleteItem ? "delete" : "tab";
    aEvent.originalTarget._tabmix_middleClicked = true;
    const keepMenuOpen = deleteItem && aEvent.originalTarget.tagName !== "menuitem";
    this.doCommand("restoreTab", where, aEvent.originalTarget, keepMenuOpen);
  },

  contextMenuOnPopupShowing(event, popup) {
    const val = this.keepMenuOpen ? "single" : "auto";
    Array.prototype.forEach.call(popup.childNodes, item => {
      item.setAttribute("closemenu", val);
    });
    Tabmix.closedObjectsUtils.on_popupshowing(event, popup);
  },

  contextMenuOnCommand(event) {
    const menuItem = event.originalTarget;
    const commandData = menuItem.getAttribute("commandData");
    if (!commandData) {
      throw new Error("missing commandData in contextMenuOnCommand");
    }
    const [command, where = ""] = commandData.split(",");
    const popup = menuItem.parentNode;
    const commands = ["restoreTab", "addBookmarks", "copyTabUrl"];

    /** @type {"restoreTab" | "addBookmarks" | "copyTabUrl"} */ // @ts-expect-error
    const validCommand = commands.find(c => c === command);
    if (validCommand) {
      this.doCommand(validCommand, where, popup.triggerNode);
    } else {
      throw new Error(`Unexpected command in contextMenuOnCommand ${command}`);
    }
  },

  doCommand(command, where, item, keepMenuOpen) {
    // valid commands: restoreTab, addBookmarks, copyTabUrl
    const popup = item.parentNode;
    const index = Number(item.getAttribute("value"));
    const source = this.getSource(item);
    source.closedGroup = item.closedGroup;
    this[command](source, index, where);
    const rePopulate = (keepMenuOpen || this.keepMenuOpen) && this.count > 0;
    if (rePopulate) {
      if (popup && command == "restoreTab") {
        if (popup.parentNode?.id === "appMenu-library-recentlyClosedTabs") {
          Tabmix.closedObjectsUtils.updateAppmenuView(popup, "Tabs");
        } else if (popup.parentNode.id.startsWith("closed-tabs-tab-group")) {
          this.repopulateGroupItems(popup, item);
        } else {
          this.setPopupWidth(popup);
          Tabmix.closedObjectsUtils.populateClosedTabsMenu(popup.parentNode);
        }
      }
    } else if (popup?.parentNode.tagName === "panelview") {
      popup.hidePopup();
    } else if (!this.count || item.getAttribute("closemenu") == "none") {
      closeMenus(popup);
    }
  },

  addBookmarks: function ct_addBookmarks(source, index) {
    const {tabData} = this.getSingleClosedTabData(source, index);
    if (!tabData) {
      console.log(`Tabmix Error: unable to add bookmark from closed tab at index ${index}`);
      return;
    }
    var url = this.getUrl(tabData);
    this.getTitle(tabData, url).then(title => {
      PlacesCommandHook.bookmarkLink(url, title);
    });
  },

  copyTabUrl: function ct_copyTabUrl(source, index) {
    const {tabData} = this.getSingleClosedTabData(source, index);
    if (!tabData) {
      console.log(`Tabmix Error: unable to copy url from closed tab at index ${index}`);
      return;
    }
    var url = this.getUrl(tabData);
    var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper);

    clipboard.copyString(url);
  },

  restoreTab: function ct_restoreTab(source, index, where) {
    switch (where) {
      case "window":
        this.restoreToNewWindow(source, index);
        break;
      case "delete":
        if (source.closedGroup) {
          this.removeClosedTabData(source, index);
        } else if (source.closedWindow) {
          SessionStore.forgetClosedTabById(index, source);
        } else {
          SessionStore.forgetClosedTab(source, index);
        }
        break;
      case "original":
        if (index == -1) {
          this.removeAllClosedTabs();
          break;
        } else if (index == -2) {
          this.restoreAllClosedTabs();
          break;
        }
      // else do the default
      /* falls through */
      default:
        this._undoCloseTab(source, index, where, true);
    }
  },

  removeAllClosedTabs() {
    if (Tabmix.isVersion(1350)) {
      const closedGroups = SessionStore.getClosedTabGroups({closedTabsFromClosedWindows: false});
      if (Tabmix.isVersion(1360) && SessionStore.getClosedTabCountFromClosedWindows()) {
        const uniqueGroups = new Map();
        const closedWindowsClosedTabsData = SessionStore.getClosedTabDataFromClosedWindows();
        for (const {sourceClosedId, closedInTabGroupId: id} of closedWindowsClosedTabsData) {
          if (id) {
            uniqueGroups.set(`${sourceClosedId},${id}`, {tabs: [{sourceClosedId}], id});
          }
        }
        closedGroups.push(...uniqueGroups.values());
      }
      for (const group of closedGroups) {
        const tabData = group.tabs[0];
        if (tabData) {
          SessionStore.forgetClosedTabGroup(tabData, group.id);
        }
      }
    }
    const closedTabsData = this.allClosedTabData;
    for (const {closedId, sourceClosedId, sourceWindowId} of closedTabsData) {
      SessionStore.forgetClosedTabById(closedId, {sourceClosedId, sourceWindowId});
    }
  },

  /**
   * fetch the data of closed tab, while removing it from the array
   *
   * @param source optional sessionstore id to identify the source window
   * @param index Integer value - 0 or grater index to remove
   * @returns closed tab data at aIndex.
   */
  removeClosedTabData(source, index) {
    const {tabData, closedTabIndex} = this.getSingleClosedTabData(source, index);

    if (!tabData) {
      return null;
    }

    if (tabData.state.groupId) {
      // workaround to forget closed tab from closed group - Bug 1945238
      const tabToForget = SessionStore.undoCloseTab(
        source,
        source.closedWindow ? closedTabIndex : index
      );
      gBrowser.hideTab(tabToForget);
      gBrowser.removeTab(tabToForget, {skipSessionStore: true});
    } else {
      SessionStore.forgetClosedTab(source, closedTabIndex);
    }

    return tabData;
  },

  restoreToNewWindow(source, index) {
    const tabData = this.removeClosedTabData(source, index);
    if (tabData) {
      // we pass the current tab as a place holder for tabData
      const state = JSON.stringify(tabData ? tabData.state : {});
      gBrowser.duplicateTabToWindow(gBrowser._selectedTab, false, state);
    }
  },

  restoreAllClosedTabs() {
    const closedTabCount = this.count;
    const isConfirmed = OpenInTabsUtils.confirmOpenInTabs(closedTabCount);
    if (!isConfirmed) {
      return;
    }

    // catch blank tabs
    const blankTabs = gBrowser.tabs.filter(tab => gBrowser.isBlankNotBusyTab(tab));

    const closedTabsData = this.allClosedTabData;
    const multiple = closedTabsData.length > 1;
    let selectRestoredTab = true;
    for (const tabdata of closedTabsData) {
      let blankTab = blankTabs.pop() || null;
      const {sourceClosedId, sourceWindowId} = tabdata;
      const source = {
        sourceClosedId,
        sourceWindowId,
        restoreAll: true,
        closedWindow: typeof sourceClosedId !== "undefined",
      };
      this._undoCloseTab(source, 0, "original", selectRestoredTab, blankTab, multiple);
      selectRestoredTab = false;
    }

    // remove unused blank tabs
    blankTabs.forEach(blankTab => {
      blankTab.collapsed = true;
      gBrowser.removeTab(blankTab);
    });
  },

  _undoCloseTab(aSource, aIndex, aWhere, aSelectRestoredTab, aBlankTabToReuse, multiple) {
    if (!Tabmix.prefs.getBoolPref("undoClose") || this.count === 0) return null;

    // get tab data
    const tabData = this.removeClosedTabData(aSource, aIndex);
    if (!tabData) {
      console.error(`Tabmix Error: unable to restore closed tab from index ${aIndex}`);
      return null;
    }
    let {state, pos} = tabData;

    var tabToRemove = null;
    var cTab = gBrowser._selectedTab;
    var isCurrentBlank = gBrowser.isBlankNotBusyTab(cTab);
    if (aWhere == "current" && !isCurrentBlank) {
      tabToRemove = cTab;
      pos = cTab._tPos;
    } else if (typeof aBlankTabToReuse == "undefined" && isCurrentBlank) {
      aBlankTabToReuse = cTab;
    }

    if (tabToRemove) {
      tabToRemove.collapsed = true;
    }

    let createLazyBrowser =
      Services.prefs.getBoolPref("browser.sessionstore.restore_tabs_lazily") &&
      Services.prefs.getBoolPref("browser.sessionstore.restore_on_demand") &&
      !aSelectRestoredTab &&
      !state.pinned;

    let userContextId = state.userContextId ?? "";
    let validBlankTabToReuse =
      // compare userContextId with == to match "" and 0
      (
        !createLazyBrowser &&
        (aBlankTabToReuse?.getAttribute("usercontextid") ?? "") == userContextId
      ) ?
        aBlankTabToReuse
      : null;

    let preferredRemoteType;
    // Predict the remote type to use for the load to avoid unnecessary process
    // switches.
    preferredRemoteType = E10SUtils.DEFAULT_REMOTE_TYPE;
    const url = this.getUrl(tabData);
    if (url) {
      preferredRemoteType = this.getPreferredRemoteType(url, window, state.userContextId);
    }

    let tabGroup =
      Tabmix.isVersion(1360) ? gBrowser.tabGroups.find(g => g.id == state.groupId) : undefined;
    let newTab =
      validBlankTabToReuse ??
      gBrowser.addTrustedTab("about:blank", {
        createLazyBrowser,
        skipAnimation: tabToRemove || multiple,
        allowInheritPrincipal: true,
        noInitialLabel: true,
        pinned: state.pinned,
        userContextId,
        [Tabmix.isVersion(1400) ? "tabIndex" : "index"]: gBrowser.tabs.length,
        skipLoad: true,
        preferredRemoteType,
        tabGroup,
      });

    if (validBlankTabToReuse) {
      if (tabGroup) {
        tabGroup.addTabs([validBlankTabToReuse]);
      }
    } else if (aBlankTabToReuse) {
      gBrowser.removeTab(aBlankTabToReuse, {animate: false});
    }

    if (!createLazyBrowser) {
      newTab.linkedBrowser.stop();
    }
    // if tabbar is hidden when there is only one tab and
    // we replace that tab with new one close the current tab fast so the tab bar don't have time to reveals
    if (tabToRemove) {
      gBrowser.removeTab(tabToRemove, {animate: false});
    }

    // restore tab content
    SessionStore.setTabState(newTab, state);

    const fromSameWindow = aSource === window || aSource.sourceWindowId === window.__SSi;
    // don't restore position for tabs from other windows
    const restorePosition = fromSameWindow && Tabmix.prefs.getBoolPref("undoClosePosition");
    // if we're opening multiple tabs move tabs from other windows to the end
    if (!fromSameWindow && multiple) {
      aWhere = "end";
    }

    // after we open new tab we only need to fix position if this condition is true
    // we prevent gBrowser.addTab from moving new tab when we call it from here
    if (aWhere === "current" || (aWhere === "original" && restorePosition)) {
      Tabmix.moveTabTo(newTab, {tabIndex: Math.min(gBrowser.tabs.length - 1, pos)});
    } else if (aWhere != "end" && Tabmix.getOpenTabNextPref()) {
      let tab = gBrowser._lastRelatedTabMap.get(gBrowser.selectedTab) || gBrowser.selectedTab;
      let offset = newTab._tPos > tab._tPos ? 1 : 0;
      Tabmix.moveTabTo(newTab, {tabIndex: tab._tPos + offset});
    } else if (aBlankTabToReuse && !Tabmix.getOpenTabNextPref()) {
      // move reused tab to the end
      Tabmix.moveTabTo(newTab, {tabIndex: gBrowser.tabs.length - 1});
    }

    if (aSelectRestoredTab) {
      window.focus();
      gBrowser.TMP_selectNewForegroundTab(newTab, false, "", false);
    }
    return newTab;
  },

  // workaround for bug 1868452 - Key key_undoCloseTab of menuitem could not be found
  fix_bug_1868452(item) {
    if (
      !Tabmix.isVersion(1330) &&
      item?.getAttribute("key") === "key_undoCloseTab" &&
      !document.getElementById("key_undoCloseTab") &&
      document.getElementById("key_restoreLastClosedTabOrWindowOrSession")
    ) {
      document.getElementById("key_restoreLastClosedTabOrWindowOrSession").id = "key_undoCloseTab";
      return true;
    }
    return false;
  },
};

Tabmix.closedObjectsUtils = {
  _initialized_closedTabs: false,
  _initialized_closedWindows: false,
  initialized: false,
  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    Services.obs.addObserver(this, "sessionstore-closed-objects-changed");

    // force LinkTargetDisplay.update to show item's uri in the status bar from
    // our closed tabs list context menu
    const undoCloseListMenu = document.getElementById("tm-content-undoCloseList-menu");
    undoCloseListMenu.addEventListener(
      "popupshowing",
      () => {
        LinkTargetDisplay._undoCloseListMenu = undoCloseListMenu;
        Tabmix.changeCode(LinkTargetDisplay, "LinkTargetDisplay.update")
          ._replace(/this\._contextMenu\.state/g, 'this._undoCloseListMenu.state == "closed" && $&')
          .toCode();
      },
      {once: true}
    );

    this.toggleRecentlyClosedWindowsButton();

    // update appMenu History >
    //                Recently closed Tabs
    //                Recently closed Windows
    const appMenu = [
      {
        id: "appMenu-library-recentlyClosedTabs",
        method: TMP_ClosedTabs.populateUndoSubmenu.bind(TMP_ClosedTabs),
      },
      {
        id: "appMenu-library-recentlyClosedWindows",
        method: Tabmix.tablib.populateUndoWindowSubmenu.bind(Tabmix.tablib),
      },
    ];
    appMenu.forEach(({id, method}) => {
      PanelMultiView.getViewNode(document, id).addEventListener("ViewShowing", e => {
        window.requestAnimationFrame(() => {
          const popup = e.target;
          popup.__tagName = "toolbarbutton";
          const panel = popup.querySelector(".panel-subview-body");
          method(popup, panel);
          panel.hidePopup = () => popup.closest("panel")?.hidePopup();
          TMP_ClosedTabs.fix_bug_1868452(panel.firstChild);
          CustomizableUI.addShortcut(panel.firstChild);
        });
      });
    });
  },

  initObjectPanel(viewType) {
    /** @type {`_initialized_closed${typeof viewType}`} */
    const wasInitialized = `_initialized_closed${viewType}`;
    if (this[wasInitialized]) {
      return;
    }
    this[wasInitialized] = true;

    const viewId =
      viewType === "Tabs" ? "tabmix-closedTabs-container" : "tabmix-closedWindows-container";
    const template = document.getElementById(viewId);
    template.replaceWith(template.content);

    const panelview = document.getElementById(
      viewType === "Tabs" ? "tabmix-closedTabsView" : "tabmix-closedWindowsView"
    );

    /** @type {ClosedObjectsUtils.PopupElement} */ // @ts-expect-error
    const body = document.createXULElement("vbox");
    body.className = "panel-subview-body";
    body.__tagName = "toolbarbutton";
    body.hidePopup = () => panelview.closest("panel")?.hidePopup();

    panelview.appendChild(body);
    panelview.menupopup = body;

    panelview.addEventListener("ViewShowing", () => {
      /** @type {`populateClosed${typeof viewType}Menu`} */
      const method = `populateClosed${viewType}Menu`;
      this[method](panelview);
    });
  },

  /**
   * catch middle click from closed windows list, delete window from the list or
   * restore according to the pref
   *
   * @param event a valid event union.
   * @returns noting.
   */
  checkForMiddleClick(event) {
    if (event.button != 1) {
      return;
    }

    event.stopPropagation();
    const index = event.originalTarget.value ?? -1;
    if (index < 0) {
      return;
    }

    const where = Tabmix.prefs.getBoolPref("middleclickDelete") ? "delete" : "window";
    this.restoreWindow(where, index);

    const popup = event.originalTarget.parentNode;
    this.updateView(popup);
  },

  forgetClosedWindow(index) {
    if (index < 0) {
      while (SessionStore.getClosedWindowCount() > 0) {
        SessionStore.forgetClosedWindow(0);
      }
    } else {
      SessionStore.forgetClosedWindow(index);
    }
  },

  observe(subject, topic) {
    switch (topic) {
      case "sessionstore-closed-objects-changed":
        TMP_ClosedTabs.setButtonDisableState();
        this.toggleRecentlyClosedWindowsButton();
        break;
    }
  },

  on_popupshowing(event, popup) {
    const target = popup.triggerNode;
    const showContextMenu = Number(target.getAttribute("value") ?? -1) >= 0;
    if (showContextMenu) {
      target.classList.add("context-open");
      popup.addEventListener(
        "popuphidden",
        () => {
          target.classList.remove("context-open");
        },
        {once: true}
      );
    } else {
      event.preventDefault();
    }
  },

  on_delete(node) {
    const index = node.value;
    this.restoreWindow("delete", index);
    this.updateView(node.parentNode);
  },

  addHoverListeners({menupopup}) {
    // Lazily add the hover listeners on first showing and never remove them
    if (menupopup.hasStatusListener) {
      return;
    }

    const popupName = menupopup.constructor.name;
    if (!["MozMenuPopup", "XULElement"].includes(popupName)) {
      return;
    }

    const [eventOn, eventOff] =
      popupName === "MozMenuPopup" ?
        ["DOMMenuItemActive", "DOMMenuItemInactive"]
      : ["mouseover", "mouseout"];

    // Show item's uri in the status bar when hovering, and clear on exit
    menupopup.addEventListener(
      eventOn,

      /** @param {GenericEvent<HTMLElement, MouseEvent>} event */
      event => {
        if (event.target.hasAttribute("targetURI")) {
          window.XULBrowserWindow.setOverLink(event.target.getAttribute("targetURI") ?? "");
        }
      }
    );
    menupopup.addEventListener(eventOff, () => {
      window.XULBrowserWindow.setOverLink("");
    });
    menupopup.hasStatusListener = true;
  },

  addSeparatorIfMissing(popup) {
    if (popup.tagName === "panelview") {
      return;
    }
    const reopenAllmenu = popup.lastChild;
    if (reopenAllmenu.previousSibling?.tagName !== "menuseparator") {
      const separator = document.createXULElement("menuseparator");
      separator.classList.add("bookmark-item", "subviewbutton", "subviewbutton-iconic");
      popup.insertBefore(separator, reopenAllmenu);
    }
  },

  populateClosedTabsMenu(undoTabMenu) {
    if (TabmixAllTabs.isAfterCtrlClick(undoTabMenu)) {
      return false;
    }

    const params = {undoTabMenu};
    HistoryMenu.prototype.populateUndoSubmenu.apply(params);

    this.addHoverListeners(undoTabMenu);

    // Bug 1689378 removed keyboard shortcut indicator for Firefox 87+
    if (undoTabMenu.localName === "panelview") {
      undoTabMenu.removeAttribute("added-shortcuts");
      PanelUI._ensureShortcutsShown(undoTabMenu);
    }

    return true;
  },

  populateClosedWindowsMenu(undoWindowMenu) {
    HistoryMenu.prototype.populateUndoWindowSubmenu.apply({undoWindowMenu});

    this.addHoverListeners(undoWindowMenu);

    // Bug 1689378 removed keyboard shortcut indicator for Firefox 87+
    if (undoWindowMenu.localName === "panelview") {
      undoWindowMenu.removeAttribute("added-shortcuts");
      PanelUI._ensureShortcutsShown(undoWindowMenu);
    }
  },

  removeObservers() {
    if (!this.initialized) {
      return;
    }
    Services.obs.removeObserver(this, "sessionstore-closed-objects-changed");
  },

  restoreWindow(where, index) {
    switch (where) {
      case "delete":
        this.forgetClosedWindow(index);
        break;
      case "window":

      /* falls through */
      default:
        if (Tabmix.isVersion(1410)) {
          window.SessionWindowUI.undoCloseWindow(index);
        } else {
          undoCloseWindow(index);
        }
    }
  },

  showSubView(event) {
    const viewType = event.target.id == "tabmix-closedWindowsButton" ? "Windows" : "Tabs";

    let anchor = event.target;
    if (anchor.getAttribute("disabled") === "true") {
      return;
    }

    this.initObjectPanel(viewType);
    PanelUI.showSubView(`tabmix-closed${viewType}View`, anchor, event);
  },

  // enable/disable the Recently Closed Windows button
  toggleRecentlyClosedWindowsButton() {
    Tabmix.setItem(
      "tmp_closedwindows",
      "disabled",
      SessionStore.getClosedWindowCount() === 0 || null
    );
  },

  updateView(popup) {
    if (SessionStore.getClosedWindowCount() > 0) {
      if (popup.parentNode.id === "appMenu-library-recentlyClosedWindows") {
        this.updateAppmenuView(popup, "Windows");
      } else {
        this.populateClosedWindowsMenu(popup.parentNode);
      }
    } else {
      popup.hidePopup();
      if (popup.parentNode.localName != "panelview") {
        popup.parentNode.parentNode?.hidePopup();
      }
    }
  },

  updateAppmenuView(panel, type) {
    // panel her is ".panel-subview-body"
    const utils = RecentlyClosedTabsAndWindowsMenuUtils;
    const fragment =
      type === "Tabs" ?
        utils.getTabsFragment(window, "toolbarbutton", true)
      : utils.getWindowsFragment(window, "toolbarbutton", true);
    if (!fragment.childElementCount) {
      panel.hidePopup();
      return;
    }
    while (panel.hasChildNodes()) {
      panel.firstChild.remove();
    }
    // remove "Restore All Tabs"
    if (Tabmix.isVersion(1350)) {
      fragment.lastChild.remove();
    } else {
      fragment.firstChild.remove();
    }
    panel.appendChild(fragment);
    panel.__updatingViewAfterDelete = true;
    if (type === "Tabs") {
      TMP_ClosedTabs.fix_bug_1868452(panel.firstChild);
      TMP_ClosedTabs.populateUndoSubmenu(panel.parentNode, panel);
    } else {
      Tabmix.tablib.populateUndoWindowSubmenu(panel.parentNode, panel);
    }
    CustomizableUI.addShortcut(panel.firstChild);
  },
};
