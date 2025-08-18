/* exported TabmixTabClickOptions, TabmixAllTabs */
"use strict";

/** @type {TabmixTabClickOptions} */
var TabmixTabClickOptions = {
  _tabFlipTimeOut: undefined,
  _blockDblClick: false,

  isOverlayIcons(event) {
    const overlayIcons = ["tab-sharing-icon-overlay", "tab-icon-overlay"];
    return overlayIcons.some(icon => event.target?.classList.contains(icon));
  },

  // Single click on tab/tabbar
  onTabClick: function TMP_onTabClick(aEvent) {
    if (!aEvent || !aEvent.originalTarget || !aEvent.target) {
      return;
    }
    // right click
    if (aEvent.button == 2) {
      return;
    }

    var leftClick = aEvent.button === 0;
    if (leftClick && aEvent.detail > 1) {
      if (this._tabFlipTimeOut) {
        this.clearTabFlipTimeOut();
      }

      if (this._blockDblClick) {
        setTimeout(() => (this._blockDblClick = false), 0);
      }
      return; // double click (with left button)
    }

    const target = aEvent.originalTarget;
    const isCloseButton = aEvent.target?.classList.contains("tab-close-button");
    this._blockDblClick = target.id === "tabs-newtab-button";

    // don't do anything if user left click on tab or tabbar button
    if (
      leftClick &&
      (isCloseButton || this.isOverlayIcons(aEvent) || target.localName == "toolbarbutton")
    ) {
      return;
    }

    // only allow middle-click on close tab button on tab to go throw as
    // middle-click on the tab
    if (aEvent.button == 1 && target.localName == "toolbarbutton" && !isCloseButton) {
      return;
    }

    const targetTab = aEvent.target.closest("tab.tabbrowser-tab");
    const clickOutTabs = !targetTab;
    const tab = targetTab ?? gBrowser.selectedTab;

    // we replace click handler from tab binding with this to make sure that we
    // always call onMouseCommand (if we need to) before we call tab flip.
    // tabcontainer click handler run before tab click handler.
    if (leftClick && !clickOutTabs && !tab.mouseDownSelect) {
      tab.onMouseCommand(aEvent, true);
    }

    // for tab flip
    if (!clickOutTabs && leftClick && tab.hasAttribute("clickOnCurrent")) {
      tab.removeAttribute("clickOnCurrent");
      let tabFlip = Tabmix.prefs.getBoolPref("tabFlip");
      if (
        tabFlip &&
        !aEvent.shiftKey &&
        !aEvent.ctrlKey &&
        !Tabmix.isAltKey(aEvent) &&
        !aEvent.metaKey
      ) {
        let self = this;
        let tabFlipDelay = Tabmix.prefs.getIntPref("tabFlipDelay");
        if (this._tabFlipTimeOut) {
          this.clearTabFlipTimeOut();
        }

        this._tabFlipTimeOut = setTimeout(
          function selectPreviousTab(aTab) {
            self.clearTabFlipTimeOut();
            Tabmix.tabsSelectionUtils.selectPreviousTab(aTab);
            gBrowser.stopMouseHoverSelect(aTab);
            gBrowser.selectedBrowser.focus();
          },
          tabFlipDelay,
          tab
        );
        return;
      }
    }

    // handle multi-select
    if (!clickOutTabs) {
      const keyPress = [
        (aEvent.ctrlKey && !aEvent.metaKey) || (!aEvent.ctrlKey && aEvent.metaKey),
        aEvent.shiftKey,
        Tabmix.isAltKey(aEvent),
      ];
      const pressedCount = keyPress.filter(x => x).length;
      const keyPrefs = [
        Tabmix.prefs.getIntPref("ctrlClickTab"),
        Tabmix.prefs.getIntPref("shiftClickTab"),
        Tabmix.prefs.getIntPref("altClickTab"),
      ];
      const press2Key =
        leftClick &&
        pressedCount === 2 &&
        keyPrefs.some((x, i) => x === 33 && keyPress[i]) &&
        keyPrefs.some((x, i) => x === 34 && keyPress[i]);
      let middleMul;
      if (aEvent.button === 1 && pressedCount === 1) {
        const middleAndModifier = `${Tabmix.prefs.getIntPref("middleClickTab")},${keyPrefs[keyPress.findIndex(x => x)]}`;
        middleMul = middleAndModifier === "33,34" || middleAndModifier === "34,33";
      }
      if (press2Key || middleMul) {
        this._tabRangeSelected(tab, true);
        aEvent.stopPropagation();
        aEvent.preventDefault();
        return;
      }
    }

    var prefName;
    if (aEvent.button == 1) {
      prefName = "middle"; /* middle click*/
    } else if (
      leftClick &&
      aEvent.shiftKey &&
      !aEvent.ctrlKey &&
      !Tabmix.isAltKey(aEvent) &&
      !aEvent.metaKey
    ) {
      prefName = "shift"; /* shift click*/
    } else if (
      leftClick &&
      Tabmix.isAltKey(aEvent) &&
      !aEvent.ctrlKey &&
      !aEvent.shiftKey &&
      !aEvent.metaKey
    ) {
      prefName = "alt"; /* alt click*/
      window.addEventListener(
        "keyup",
        function TMP_onKeyup_onTabClick(event) {
          event.stopPropagation();
        },
        {capture: true, once: true}
      );
    } else if (
      leftClick &&
      ((aEvent.ctrlKey && !aEvent.metaKey) || (!aEvent.ctrlKey && aEvent.metaKey)) &&
      !aEvent.shiftKey &&
      !Tabmix.isAltKey(aEvent)
    ) {
      prefName = "ctrl"; /* ctrl click*/
    }

    if (prefName) {
      this.clickAction(prefName, clickOutTabs, tab, aEvent);
    }
  },

  clearTabFlipTimeOut() {
    clearTimeout(this._tabFlipTimeOut);
    this._tabFlipTimeOut = undefined;
  },

  // Double click on tab/tabbar
  onTabBarDblClick: function TMP_onTabBarDblClick(aEvent) {
    if (!aEvent || !aEvent.originalTarget || !aEvent.target) {
      return;
    }
    if (
      aEvent.button !== 0 ||
      aEvent.ctrlKey ||
      aEvent.shiftKey ||
      Tabmix.isAltKey(aEvent) ||
      aEvent.metaKey
    ) {
      return;
    }

    const target = aEvent.originalTarget;
    const isCloseButton = aEvent.target.classList.contains("tab-close-button");
    // don't do anything if user left click on tab or tabbar button
    if (isCloseButton || this.isOverlayIcons(aEvent) || target.localName == "toolbarbutton") {
      return;
    }

    // See hack note in the tabbrowser-close-tab-button binding
    // if we are here the target is not closeTabButton or newtabButton
    if (gBrowser.tabContainer._blockDblClick || this._blockDblClick) {
      aEvent.preventDefault();
      return;
    }

    const clickOutTabs = aEvent.target.localName == "arrowscrollbox";

    const tab = clickOutTabs ? gBrowser._selectedTab : aEvent.target.closest("tab.tabbrowser-tab");
    this.clickAction("dbl", clickOutTabs, tab, aEvent);
  },

  // call action function from click on tabs or tabbar
  clickAction: function TMP_clickAction(pref, clickOutTabs, aTab, event) {
    if (!pref) return; // just in case we missed something
    pref += clickOutTabs ? "ClickTabbar" : "ClickTab";
    var command = Tabmix.prefs.getIntPref(pref);
    if (command > -1 && this.doCommand(command, aTab, clickOutTabs, event)) {
      event.stopPropagation();
      event.preventDefault();
    }
  },

  /// add option to open new tab after current one
  /// convert this switch to object
  doCommand: function TMP_doCommand(command, aTab, clickOutTabs, event) {
    gBrowser.selectedBrowser.focus();
    switch (command) {
      case 0:
        break;
      case 1:
        Tabmix.BrowserOpenTab();
        break;
      case 2:
        if (aTab?.parentNode) {
          gBrowser.removeTab(aTab, {
            animate: true,
            triggeringEvent: event,
          });
        }
        break;
      case 3:
        Tabmix.duplicateTab(aTab);
        break;
      case 4:
        if (aTab._restoreState != 2) {
          gBrowser.reloadTab(aTab);
        }
        break;
      case 5:
        gBrowser.protectTab(aTab);
        break;
      case 6:
        gBrowser.lockTab(aTab);
        break;
      case 7:
        Tabmix.tablib.reloadTabs(Tabmix.visibleTabs.tabs);
        break;
      case 8:
        gBrowser.removeAllTabsBut(aTab);
        break;
      case 9:
        gBrowser.closeAllTabs();
        break;
      case 10:
        Tabmix.undoCloseTab();
        break;
      case 11:
        Tabmix.renameTab.editTitle(aTab);
        break;
      case 12: {
        // taken from tco
        let SessionSaver = window.SessionSaver;
        if (SessionSaver && SessionSaver.snapBackTab) {
          SessionSaver.snapBackTab(SessionSaver.snapback_noFX, SessionSaver.snapback_willFocus);
        }

        break;
      }
      case 13:
        TMP_ClosedTabs.restoreTab(window, -2, "original");
        break;
      case 14:
        gBrowser.duplicateTabToWindow(aTab, false);
        break;
      case 15:
        gBrowser.freezeTab(aTab);
        break;
      case 16:
        gBrowser.reloadAllTabsBut(aTab);
        break;
      case 17:
        gBrowser.removeTabsToTheStartFrom(aTab);
        break;
      case 18:
        gBrowser.removeTabsToTheEndFrom(aTab);
        break;
      case 19:
        gBrowser._reloadLeftTabs(aTab);
        break;
      case 20:
        gBrowser._reloadRightTabs(aTab);
        break;
      case 21: {
        // taken from tco
        let href;
        if (window.IeView && window.IeView.ieViewLaunch) {
          href = gBrowser.getBrowserForTab(aTab).currentURI.spec;
          window.IeView.ieViewLaunch("Internet Explorer.lnk", href);
        } else if (Tabmix.extensions.gIeTab) {
          let ieTab = Tabmix.extensions.gIeTab;
          let gIeTabObj = window[ieTab.obj];
          if (typeof gIeTabObj.switchTabEngine == "function") {
            if (!aTab.selected) {
              gBrowser.selectedTab = aTab;
            }

            // IeTab2.getBoolPref accept default value
            gIeTabObj.switchTabEngine(
              aTab,
              gIeTabObj.getBoolPref(ieTab.folder + ".alwaysNewTab", false)
            );
          }
        } else if (window.ieview && window.ieview.launch) {
          href = gBrowser.getBrowserForTab(aTab).currentURI.spec;
          window.ieview.launch(href);
        }
        break;
      }
      case 22:
        gBrowser.SelectToMerge(aTab);
        break;
      case 23:
        Tabmix.MergeWindows.mergeWindows(window);
        break;
      case 24:
        gBrowser.closeGroupTabs(aTab);
        break;
      case 25:
        PlacesCommandHook.bookmarkPage();
        break;
      case 26:
        PlacesCommandHook.bookmarkTabs();
        break;
      case 27:
        gBrowser.duplicateTabToWindow(aTab, true);
        break;
      case 28:
        gBrowser.copyTabUrl(aTab);
        break;
      case 29: {
        // changed on 2011-03-09 - open new tab when clicked on tabbar
        // or when the tab is locked
        const openNewTab =
          clickOutTabs || (aTab.hasAttribute("locked") && !gBrowser.isBlankNotBusyTab(aTab));
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          ctrlKey: openNewTab,
        });
        clickEvent.initEvent("click", true, true);
        middleMousePaste(clickEvent);
        if (openNewTab) {
          let tab = gBrowser.getTabForLastPanel();
          if (!tab.selected) {
            gBrowser.selectedTab = tab;
          }
        }
        break;
      }
      case 30: // enable/disable AutoReload
        if (aTab.autoReloadEnabled === undefined) {
          Tabmix.autoReload.initTab(aTab);
        }

        Tabmix.autoReload.toggle(aTab);
        break;
      case 31: // pin/unpin tab
        if (aTab.pinned) {
          gBrowser.unpinTab(aTab);
        } else {
          gBrowser.pinTab(aTab);
        }
        break;
      case 32:
        Tabmix.tabsSelectionUtils.selectPreviousTab(gBrowser.selectedTab);
        break;
      case 33:
        this._tabMultiSelected(aTab);
        break;
      case 34:
        this._tabRangeSelected(aTab, false);
        break;
      default:
        return false;
    }
    return true;
  },

  // taken from MozTabbrowserTab.prototype.on_mousedown()
  _tabMultiSelected(aTab) {
    if (aTab.multiselected) {
      gBrowser.removeFromMultiSelectedTabs(aTab);
    } else if (aTab != gBrowser.selectedTab) {
      gBrowser.addToMultiSelectedTabs(aTab);
      gBrowser.lastMultiSelectedTab = aTab;
    }
  },

  _tabRangeSelected(aTab, cumul) {
    const lastSelectedTab = gBrowser.lastMultiSelectedTab;
    if (!cumul) gBrowser.clearMultiSelectedTabs();
    gBrowser.addRangeToMultiSelectedTabs(lastSelectedTab, aTab);
  },

  toggleEventListener(enable) {
    const eventListener = enable ? "addEventListener" : "removeEventListener";
    document.getElementById("TabsToolbar")[eventListener]("dblclick", this.blockDblclick, false);
  },

  /*
   * block dblclick on TabsToolbar when tabbar.dblclick_changesize is false
   * and tabbar.click_dragwindow is true
   */
  blockDblclick(aEvent) {
    if (
      aEvent.button !== 0 ||
      aEvent.target?.localName == "arrowscrollbox" ||
      Tabmix.prefs.getBoolPref("tabbar.dblclick_changesize") ||
      !Tabmix.prefs.getBoolPref("tabbar.click_dragwindow")
    ) {
      return;
    }

    aEvent.preventDefault();
  },

  /*
   * block mouse down with modifiers if the modifier is used by our clicking option
   */
  blockMouseDown(event) {
    if (
      (event.shiftKey && Tabmix.prefs.getIntPref("shiftClickTab") !== -1) ||
      (Tabmix.isAltKey(event) && Tabmix.prefs.getIntPref("altClickTab") !== -1) ||
      ((event.ctrlKey || event.metaKey) && Tabmix.prefs.getIntPref("ctrlClickTab") !== -1)
    ) {
      return true;
    }
    return false;
  },
};

/** @type {TabmixContextTypes} */
var TabmixContext = {
  _originalTabbarContextMenu: "null",
  _currentMenuOrder: 1, // browser initial order is Firefox build-in order
  _originalOrderSaved: false,

  $id(id) {
    return document.getElementById(id);
  },

  // Create new items in the tab bar context menu
  buildTabContextMenu: function TMP_buildTabContextMenu() {
    MozXULElement.insertFTLIfNeeded("browser/preferences/preferences.ftl");
    MozXULElement.insertFTLIfNeeded("browser/menubar.ftl");
    Tabmix.setFTLDataId("tabContextMenu");

    Tabmix.setFTLDataId("context_reopenInContainer");

    // move extra close options to closeTabOptions submenu
    const closeTabOptions = this.$id("closeTabOptions");
    const closeOtherTabs = this.$id("context_closeOtherTabs");
    closeTabOptions.insertBefore(this.$id("tm-closeAllTabs"), closeOtherTabs);
    closeTabOptions.insertBefore(this.$id("tm-closeSimilar"), closeOtherTabs);

    const openTab = this.$id("context_openANewTab");
    const tabContextMenu = this.$id("tabContextMenu");
    tabContextMenu.addEventListener(
      "popupshowing",
      () => {
        openTab.setAttribute("_newtab", openTab.getAttribute("label") ?? "");
        if (!Tabmix.isVersion(1290)) {
          openTab.setAttribute("oncommand", "Tabmix.BrowserOpenTab({ event });");
        }

        // Save the original Firefox menu order before making any changes
        this._saveOriginalMenuOrder();

        // Reorder the menu items if needed
        this.updateMenuOrder();
      },
      {once: true}
    );

    // insert IE Tab menu-items before Bookmarks menu-items
    if ("gIeTab" in window) {
      // no need to do this fix for IE Tab 2
      let IeTab = window.IeTab;
      var aFunction = "createTabbarMenu" in IeTab.prototype ? "createTabbarMenu" : "init";
      if (aFunction in IeTab.prototype) {
        Tabmix.changeCode(IeTab.prototype, "IeTab.prototype." + aFunction)
          ._replace(
            'tabbarMenu.insertBefore(document.getElementById("ietab-tabbar-sep"), separator);',
            'separator = document.getElementById("tabmix_lockTab_separator"); $&'
          )
          .toCode();
      }
    }

    // fix conflict with CookiePie extension
    if ("cookiepieContextMenu" in window) {
      let cookiepieContextMenu = window.cookiepieContextMenu;
      if (!cookiepieContextMenu.initialized) {
        cookiepieContextMenu.init();
      }
    }

    if (Tabmix.prefs.getBoolPref("showTabContextMenuOnTabbar")) {
      this.updateTabbarContextMenu(true);
    }
  },

  // Save the original Firefox menu order
  _saveOriginalMenuOrder() {
    if (this._originalOrderSaved) {
      return;
    }
    this._originalOrderSaved = true;

    const tabContextMenu = document.getElementById("tabContextMenu");
    if (!tabContextMenu) return;

    try {
      tabContextMenu.insertBefore(
        this.$id("tm-undoCloseList"),
        this.$id("context_undoCloseTab").nextSibling
      );

      // Save the original order of all menu items
      Array.from(tabContextMenu.children).forEach((node, index) => {
        node._originalOrder = index + 1;
      });
    } catch (ex) {
      console.error("Tabmix Error: Failed to save tab context menu original menu order", ex);
    }
  },

  // Set menu order based on preference
  updateMenuOrder() {
    if (!this._originalOrderSaved) {
      return;
    }

    const menuOrder = Tabmix.prefs.getIntPref("tabContextMenu.menuOrder");
    if (this._currentMenuOrder !== menuOrder) {
      this._currentMenuOrder = menuOrder;
      if (menuOrder === 0) {
        this._setTabmixOrder();
      } else {
        this._setFirefoxOrder();
      }
      this.contextMenuShown("tabContextMenu");
    }
  },

  // Define the order of menu items in Tabmix order
  // Format: [itemId, referenceId, insertafter]
  _tabmixMenuOrder: [
    ["tm-duplicateinWin", "context_duplicateTabs", "insertafter"],

    // Tab management section
    ["tm-mergeWindowsTab", "context_reopenInContainer"],
    ["tm-renameTab", "context_reopenInContainer"],
    ["tm-copyTabUrl", "context_reopenInContainer"],

    // Reload options
    ["tm-autoreloadTab_menu", "context_closeTabOptions"],
    ["context_reloadTabOptions", "context_closeTabOptions"],
    ["tabmix_reloadTabOptions_separator", "context_closeTabOptions"],
    ["context_reloadTab", "tabmix_reloadTabOptions_separator"],
    ["context_reloadSelectedTabs", "tabmix_reloadTabOptions_separator"],

    // Close options
    ["tm-undoCloseList", "context_closeTabOptions"],

    // miscellaneous items
    ["tabmix_closeTab_separator", "context_undoCloseTab"],
    ["tm-docShell", "context_undoCloseTab"],
    ["tm-freezeTab", "context_undoCloseTab"],
    ["tm-protectTab", "context_undoCloseTab"],
    ["tm-lockTab", "context_undoCloseTab"],
    ["tabmix_lockTab_separator", "context_undoCloseTab"],

    // Move Close menu to place
    ["context_undoCloseTab", "tabmix_closeTab_separator"],
    ["context_closeTab", "tabmix_closeTab_separator"],
    ["context_closeDuplicateTabs", "tabmix_closeTab_separator"], // from Firefox 127
    ["context_closeTabOptions", "tabmix_closeTab_separator"],

    // Move bookmarks menu together
    ["context_bookmarkSelectedTabs", "context_bookmarkAllTabs"],
    ["context_bookmarkTab", "context_bookmarkAllTabs"],
  ],

  // Set menu items in Tabmix preferred order
  _setTabmixOrder() {
    const tabContextMenu = this.$id("tabContextMenu");
    for (const menuItem of this._tabmixMenuOrder) {
      const [itemId, referenceId, where] = menuItem;
      const item = this.$id(itemId);
      const reference = this.$id(referenceId);
      if (item?.parentNode && reference) {
        try {
          tabContextMenu.insertBefore(
            item,
            // item will append to the end if reference.nextSibling is null
            where === "insertafter" ? reference.nextSibling : reference
          );
        } catch (error) {
          console.log(
            "Tabmix Error: Failed to move tab context menu item",
            // @ts-ignore
            error?.message,
            itemId,
            referenceId,
            where
          );
        }
      }
    }
  },

  // Set menu items in Firefox original order
  _setFirefoxOrder() {
    try {
      const tabContextMenu = this.$id("tabContextMenu");

      // Sort the children based on their original order
      const children = Array.from(tabContextMenu.children);
      children.sort((a, b) => {
        const orderA = a._originalOrder || 999;
        const orderB = b._originalOrder || 999;
        return orderA - orderB;
      });

      // append in the original order
      for (const child of children) {
        tabContextMenu.appendChild(child);
      }
    } catch (ex) {
      console.error("Tabmix Error: Failed to restore tab context menu to Firefox menu order", ex);
    }
  },

  updateTabbarContextMenu(show) {
    let tabBar = gBrowser.tabContainer;
    if (show) {
      this._originalTabbarContextMenu = tabBar.getAttribute("context");
      tabBar.setAttribute("context", "tabContextMenu");
    } else {
      Tabmix.setItem(tabBar, "context", this._originalTabbarContextMenu || null);
    }
  },

  toggleEventListener(enable) {
    const eventListener = enable ? "addEventListener" : "removeEventListener";
    document
      .getElementById("contentAreaContextMenu")
      .parentElement?.[eventListener]("popupshowing", this, true);
    document.getElementById("contentAreaContextMenu")[eventListener]("popupshowing", this, false);
    document.getElementById("tabContextMenu")[eventListener]("popupshowing", this, false);
    document.getElementById("tabContextMenu")[eventListener]("popupshown", this, false);
  },

  handleEvent(aEvent) {
    if (aEvent.type === "popupshowing" && aEvent.target.state != "showing") {
      return;
    }

    let id = aEvent.target.id;
    if (id !== "contentAreaContextMenu" && id !== "tabContextMenu") {
      return;
    }
    switch (`${id}:${aEvent.type}:${aEvent.eventPhase}`) {
      case "contentAreaContextMenu:popupshowing:1":
        this._prepareContextMenu();
        break;
      case "contentAreaContextMenu:popupshowing:2":
        this.updateMainContextMenu(aEvent);
        break;
      case "tabContextMenu:popupshowing:2":
        this.updateTabContextMenu(aEvent);
        break;
      case "tabContextMenu:popupshown:2":
      case "contentAreaContextMenu:popupshown:2":
        this.contextMenuShown(id);
        break;
      case "tabContextMenu:popuphidden:2":
        aEvent.target.removeEventListener("popuphidden", this);
        Tabmix.hidePopup(aEvent.target);
        break;
    }
  },

  get tabContextConfig() {
    return Tabmix.lazyGetter(this, "tabContextConfig", () => {
      const {TabContextConfig} = ChromeUtils.importESModule(
        "chrome://tabmix-resource/content/TabContextConfig.sys.mjs"
      );

      if (TabmixSvc.isWaterfox) {
        // waterfox use extra preference to activate some tabFeature
        // and its eventlistener also run on sub menu popupshowing
        const tabContextMenu = document.getElementById("tabContextMenu");
        const items = tabContextMenu?.querySelectorAll(".tabFeature") ?? [];
        TabContextConfig.forksExtraIds = ["toggleTabPrivateState"].concat(
          [...items].map(item => item.id)
        );
      }

      return TabContextConfig;
    });
  },

  // Tab context menu popupshowing
  updateTabContextMenu: function TMP_updateTabContextMenu(event) {
    if (event.originalTarget != document.getElementById("tabContextMenu")) {
      return true;
    }

    const tabContextMenu = event.originalTarget;
    tabContextMenu.addEventListener("popuphidden", this);

    const {prefList, selectors, forksExtraIds} = this.tabContextConfig;

    /**
     * Checks if a menu item should be hidden based on the tabContextMenu
     * preference
     *
     * @param {string} id - The menu item ID
     * @param {string} [prefname] - preference key to use (optional)
     */
    const isItemVisible = (id, prefname) => {
      if (!prefname) {
        let name;
        if (prefList[id]) {
          name = prefList[id][0] || id;
        } else {
          const relatedId = id.replace(/SelectedTabs$|Tabs$/, "Tab");
          if (prefList[relatedId]) {
            name = prefList[relatedId]?.[0] || relatedId;
          } else {
            console.log("Tabmix Error: unknown menu item", id);
            return true;
          }
        }
        prefname = name.replace(/^context_|^tm-/, "");
      }
      return Tabmix.prefs.getBoolPref(prefname);
    };

    /**
     * @param {HTMLElement | string} iteOrId
     * @param {{key?: string; is?: boolean}} [options]
     */
    function showItem(iteOrId, {key, is: condition = true} = {}) {
      const item = typeof iteOrId === "string" ? document.getElementById(iteOrId) : iteOrId;
      if (item && !condition) {
        Tabmix.showItem(item, false);
      } else if (item) {
        Tabmix.showItem(item, isItemVisible(item.id, key));
      } else {
        console.error("Tabmix Error: Missing menu item", iteOrId, key ?? "");
      }
    }

    const origTriggerNode = tabContextMenu.triggerNode;
    let triggerNode = origTriggerNode && origTriggerNode.parentNode;
    if (triggerNode && triggerNode.parentNode) {
      const item = triggerNode.parentNode.id;
      if (item === "allTabsMenu-allTabsView") {
        TabContextMenu.contextTab = triggerNode.tab;
      }
    }
    let multiselectionContext = TabContextMenu.contextTab?.multiselected;

    const clickOutTabs = triggerNode && triggerNode.localName == "tabs";
    var aTab = clickOutTabs ? gBrowser.selectedTab : TabContextMenu.contextTab;

    var isOneWindow = Tabmix.numberOfWindows() == 1;

    const newTab = document.getElementById("context_openANewTab");
    showItem(newTab);
    const newTabMenuLabel =
      newTab.getAttribute("_newtab") +
      (clickOutTabs ? "" : "  " + newTab.getAttribute("_afterthis"));
    Tabmix.setItem(newTab, "label", newTabMenuLabel);
    if (!Tabmix.isVersion(1290)) {
      if (clickOutTabs) {
        Tabmix.setItem(newTab, "oncommand", "TMP_BrowserOpenTab();");
      } else {
        Tabmix.setItem(newTab, "oncommand", "TMP_BrowserOpenTab({}, TabContextMenu.contextTab);");
      }
    }

    // these menu hidden state controlled by the browse (Firefox, Waterfox ...)
    // make sure not to show menu items that are hidden by Firefox
    const itemsIds = new Set([
      "context_sendTabToDevice",
      "shareTabURL", // no ID in Firefox
      "context_moveTabToNewGroup",
      "context_moveTabToGroup",
      "context_ungroupTab",
      "context_playTab",
      "context_playSelectedTabs",
      TabmixSvc.isZen ? "context_zenUnloadTab" : "context_unloadTab",
      "context_fullscreenAutohide", // no ID in Firefox < 129
      "context_fullscreenExit", // no ID in Firefox < 129
      ...forksExtraIds,
    ]);
    for (const id of Array.from(itemsIds)) {
      const item =
        selectors[id] ? tabContextMenu.querySelector(selectors[id]) : document.getElementById(id);
      const isActivePref = TabmixSvc.isWaterfox && item?.getAttribute("preference");
      const isVisibleByWaterfox = isActivePref ? Services.prefs.getBoolPref(isActivePref) : true;
      Tabmix.setItem(item, "tabmix_hide", !isVisibleByWaterfox || !isItemVisible(id) || null);
    }

    // Duplicate Commands
    if (!TabmixSvc.isWaterfox) {
      // context_duplicateTab is included in forksExtraIds
      showItem("context_duplicateTab", {is: !multiselectionContext});
    }
    showItem("context_duplicateTabs", {is: multiselectionContext});
    showItem("tm-duplicateinWin", {is: !Tabmix.singleWindowMode});
    showItem("context_openTabInWindow", {is: !Tabmix.singleWindowMode});

    showItem("context_toggleMuteTab", {is: !multiselectionContext});
    showItem("context_toggleMuteSelectedTabs", {is: multiselectionContext});

    showItem("context_pinTab", {is: !multiselectionContext && !aTab.pinned});
    showItem("context_unpinTab", {key: "pinTabMenu", is: !multiselectionContext && aTab.pinned});
    showItem("context_pinSelectedTabs", {is: multiselectionContext && !aTab.pinned});
    showItem("context_unpinSelectedTabs", {
      key: "pinTab",
      is: multiselectionContext && aTab.pinned,
    });
    showItem("context_moveTabOptions");

    showItem("tm-mergeWindowsTab", {
      is: !Tabmix.singleWindowMode || (Tabmix.singleWindowMode && !isOneWindow),
    });

    showItem("tm-renameTab");
    showItem("tm-copyTabUrl", {is: !TabmixSvc.isWaterfox});
    showItem("context_reopenInContainer");
    showItem("context_selectAllTabs");

    //  ---------------- menuseparator ---------------- //

    // Reload Commands
    showItem("context_reloadTab", {is: !multiselectionContext});
    showItem("context_reloadSelectedTabs", {is: multiselectionContext});
    this._showAutoReloadMenu("tm-autoreloadTab_menu", isItemVisible("tm-autoreloadTab_menu"));
    showItem("context_reloadTabOptions");

    //  ---------------- menuseparator ---------------- //

    var undoClose = Tabmix.prefs.getBoolPref("undoClose");
    showItem("context_undoCloseTab", {is: undoClose});
    showItem("tm-undoCloseList", {is: undoClose});

    //  ---------------- menuseparator ---------------- //

    // Close tab Commands
    showItem("context_closeTab");
    const showCloseDuplicateTabs = Services.prefs.getBoolPref(
      "browser.tabs.context.close-duplicate.enabled"
    );
    showItem("context_closeDuplicateTabs", {is: showCloseDuplicateTabs});
    showItem("context_closeTabOptions");

    //  ---------------- menuseparator ---------------- //

    showItem("tm-docShell");
    showItem("tm-freezeTab");
    showItem("tm-protectTab");
    showItem("tm-lockTab");

    //  ---------------- menuseparator ---------------- //

    showItem("context_bookmarkTab", {is: !multiselectionContext});
    showItem("context_bookmarkSelectedTabs", {is: multiselectionContext});
    showItem("context_bookmarkAllTabs");

    // we call this again when popupshown to make sure we don't show 2 menuseparator together
    TabmixContext.contextMenuShown("tabContextMenu");

    const showRenameTabMenu = isItemVisible("tm-renameTab");
    if (showRenameTabMenu) {
      // disabled rename if the title not ready yet
      /** @type {boolean | undefined} */
      let titleNotReady;
      if (aTab.hasAttribute("busy")) {
        let browser = gBrowser.getBrowserForTab(aTab);
        let url = browser.currentURI.spec;
        TMP_Places.getTitleFromBookmark(url, browser.contentTitle).then(docTitle => {
          if (!docTitle || docTitle == Tabmix.emptyTabTitle) {
            titleNotReady = true;
          }

          Tabmix.setItem("tm-renameTab", "disabled", titleNotReady);
        });
      } else {
        Tabmix.setItem("tm-renameTab", "disabled", titleNotReady);
      }
    }

    let protectedTab = aTab.hasAttribute("protected");
    let lockedTab = aTab.hasAttribute("locked");
    let tabsCount = Tabmix.visibleTabs.tabs.length;
    let noTabsToEnd, noTabsToStart, unpinnedTabsToClose;
    if (Tabmix.isVersion(1350)) {
      noTabsToEnd = !gBrowser._getTabsToTheEndFrom(aTab).length;
      noTabsToStart = !gBrowser._getTabsToTheStartFrom(aTab).length;
      unpinnedTabsToClose =
        multiselectionContext ?
          gBrowser.visibleTabs.filter(t => !t.multiselected && !t.pinned && !t.hidden).length
        : gBrowser.visibleTabs.filter(t => t != TabContextMenu.contextTab && !t.pinned && !t.hidden)
            .length;
    } else {
      noTabsToEnd = !gBrowser.getTabsToTheEndFrom(aTab).length;
      noTabsToStart = !gBrowser.getTabsToTheStartFrom(aTab).length;
      unpinnedTabsToClose =
        multiselectionContext ?
          gBrowser.visibleTabs.filter(t => !t.multiselected && !t.pinned).length
        : gBrowser.visibleTabs.filter(t => t != TabContextMenu.contextTab && !t.pinned).length;
    }
    let cIndex = Tabmix.visibleTabs.indexOf(aTab);

    // count unprotected tabs for closing
    const selectedTabsCount = this.updateSelectedTabsCount(
      "context_closeTab",
      multiselectionContext
    );

    var keepLastTab = tabsCount == 1 && Tabmix.prefs.getBoolPref("keepLastTab");
    Tabmix.setItem(
      "context_closeTab",
      "disabled",
      (multiselectionContext ? selectedTabsCount === 0 : protectedTab) || keepLastTab
    );
    Tabmix.setItem("tm-closeAllTabs", "disabled", keepLastTab || !unpinnedTabsToClose);
    Tabmix.setItem("context_closeOtherTabs", "disabled", unpinnedTabsToClose < 1);
    Tabmix.setItem("context_closeTabsToTheEnd", "disabled", noTabsToEnd);
    Tabmix.setItem("context_closeTabsToTheStart", "disabled", noTabsToStart);

    var closeTabsEmpty = TMP_ClosedTabs.count < 1;
    Tabmix.setItem("context_undoCloseTab", "disabled", closeTabsEmpty);
    Tabmix.setItem("tm-undoCloseList", "disabled", closeTabsEmpty);

    Tabmix.setItem("context_openTabInWindow", "disabled", tabsCount == 1);
    Tabmix.setItem("tm-mergeWindowsTab", "disabled", isOneWindow);

    if (Tabmix.rtl) {
      cIndex = tabsCount - 1 - cIndex;
    }
    Tabmix.setItem("tm-reloadRight", "disabled", tabsCount == 1 || cIndex == tabsCount - 1);
    Tabmix.setItem("tm-reloadLeft", "disabled", tabsCount == 1 || cIndex === 0);
    Tabmix.setItem("tm-reloadOther", "disabled", tabsCount == 1);
    Tabmix.setItem("context_reloadAllTabs", "disabled", tabsCount == 1);
    // Disable "Reload Multiple Tabs" if all sub menuitems are disabled
    Tabmix.setItem("context_reloadTabOptions", "disabled", tabsCount == 1);

    Tabmix.setItem("tm-docShell", "disabled", clickOutTabs);

    var freezeTabMenu = document.getElementById("tm-freezeTab");
    if (!freezeTabMenu.hidden) {
      Tabmix.setItem(freezeTabMenu, "checked", lockedTab && protectedTab);
    }

    var lockTabMenu = document.getElementById("tm-lockTab");
    if (!lockTabMenu.hidden) {
      Tabmix.setItem(lockTabMenu, "checked", lockedTab);
    }

    var protectTabMenu = document.getElementById("tm-protectTab");
    if (!protectTabMenu.hidden) {
      Tabmix.setItem(protectTabMenu, "checked", protectedTab);
    }

    return true;
  },

  /*
   * don't show 2 menuseparator together
   * this function is call by "popupshown" event
   * this is only for the case that other extensions popupshowing run after our TabmixContextMenu.updateTabContextMenu
   */
  _showHideSeparators: ["tabContextMenu"],
  contextMenuShown(id) {
    if (!this._showHideSeparators.includes(id)) {
      if (id === "contentAreaContextMenu") {
        document.getElementById(id).showHideSeparators();
      }
      return;
    }
    const contextMenu = document.getElementById(id);
    // don't show 2 menuseparator together
    var hideNextSeparator = true,
      lastVisible,
      hideMenu = true;
    for (let mi = contextMenu.firstChild; mi; mi = mi.nextSibling) {
      if (mi.localName == "menuseparator") {
        if (!lastVisible || !hideNextSeparator) {
          mi.hidden = hideNextSeparator;
          if (!hideNextSeparator) {
            hideNextSeparator = true;
            lastVisible = mi;
          }
        } else if (hideNextSeparator) {
          mi.hidden = true;
        }
      } else if (!mi.hidden && !mi.collapsed && mi.getAttribute("tabmix_hide") !== "true") {
        hideNextSeparator = false;
        hideMenu = false;
      }
    }

    // hide the last visible menuseparator if it is the last visible in the menu
    if (hideNextSeparator && lastVisible) {
      lastVisible.hidden = true;
    }

    // if all the menu are hidden don't show the popup
    if (hideMenu) {
      contextMenu.hidePopup();
    }
  },

  contextMenu_initialized: false,
  _prepareContextMenu() {
    if (!nsContextMenu || this.contextMenu_initialized) {
      return;
    }

    this.contextMenu_initialized = true;

    let sep = this.$id("tm-content-miscSep");
    sep.parentNode?.insertBefore(sep, this.$id("tm-content-closetab"));

    let sandbox;
    if (nsContextMenu._tabmix_initialized) {
      sandbox = Tabmix.getSandbox(nsContextMenu);
    } else {
      const lazy = {};
      if (Tabmix.isVersion(1290)) {
        const modules = {
          ContextualIdentityService: "resource://gre/modules/ContextualIdentityService.sys.mjs",
          PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
        };
        if (Tabmix.isVersion(1400)) {
          // @ts-ignore
          modules.LinkPreview = "moz-src:///browser/components/genai/LinkPreview.sys.mjs";
        }
        ChromeUtils.defineESModuleGetters(lazy, modules);
      }

      sandbox = Tabmix.getSandbox(nsContextMenu, {scope: {lazy}});

      // hide open link in window in single window mode
      Tabmix.changeCode(nsContextMenu.prototype, "nsContextMenu.prototype.initOpenItems", {
        sandbox,
      })
        ._replace(/context-openlink",/, "$& !window.Tabmix.singleWindowMode &&")
        ._replace(
          /context-openlinkprivate",/,
          "$& (!window.Tabmix.singleWindowMode || !isWindowPrivate) &&"
        )
        .toCode();

      Tabmix.changeCode(
        nsContextMenu.prototype,
        "nsContextMenu.prototype.openLinkInPrivateWindow",
        {
          sandbox,
        }
      )
        ._replace(
          /(?:this\.window\.)?openLinkIn\(\n*\s*this\.linkURL,\n*\s*"window",/,
          `var [win, where] = [${Tabmix.isVersion(1290) ? "this.window" : "window"}, "window"];
      if (win.Tabmix.singleWindowMode) {
        let pbWindow = BrowserWindowTracker.getTopWindow({ private: true });
        if (pbWindow) {
          [win, where] = [pbWindow, "tab"];
          pbWindow.focus();
        }
      }
      win.openLinkIn(this.linkURL, where,`
        )
        .toCode();

      nsContextMenu._tabmix_initialized = true;
    }

    Tabmix.changeCode(nsContextMenu.prototype, "nsContextMenu.prototype.openLinkInTab", {sandbox})
      ._replace(
        "userContextId:",
        'inBackground: !Services.prefs.getBoolPref("browser.tabs.loadInBackground"),\n      $&'
      )
      .toCode(false, Tabmix.originalFunctions, "openInverseLink");

    Tabmix.openInverseLink = function (ev) {
      var url = Tabmix.tablib.getValidUrl();
      if (!url) {
        return;
      }

      gContextMenu.linkURL = url;
      // originalFunctions.openInverseLink is a copy of original
      // nsContextMenu.prototype.openLinkInTab
      Tabmix.originalFunctions.openInverseLink.call(gContextMenu, ev);
    };
  },

  // Main context menu popupshowing
  updateMainContextMenu: function TMP_updateMainContextMenu(event) {
    if (
      !gContextMenu ||
      event.originalTarget != document.getElementById("contentAreaContextMenu")
    ) {
      return true;
    }

    gContextMenu.tabmixLinks = Tabmix.contextMenuLinks;
    Tabmix.contextMenuLinks = null;

    var tab = gBrowser.selectedTab;
    try {
      var contentClick = gContextMenu.onTextInput || gContextMenu.onLink || gContextMenu.onImage;
      var tabsCount = gBrowser.tabs.length;
      var closeTabsEmpty = TMP_ClosedTabs.count < 1;
      var protectedTab = tab.hasAttribute("protected");
      var lockedTab = tab.hasAttribute("locked");

      /*
       * from Firefox 4.0 2009-09-11 there is gContextMenu.openLinkInCurrent
       * Firefox only show this menu when the selection text is url see Bug 454518
       * we check if gContextMenu.linkURL contain URL
       */
      var onLink = gContextMenu.onLink || Boolean(gContextMenu.linkURL);
      Tabmix.showItem(
        "context-openlinkincurrent",
        Tabmix.prefs.getBoolPref("openLinkHere") && onLink
      );
      var inverseLink = document.getElementById("tm-openinverselink");
      Tabmix.showItem(inverseLink, Tabmix.prefs.getBoolPref("openInverseLink") && onLink);
      if (!inverseLink.hidden) {
        let bgPref = Services.prefs.getBoolPref("browser.tabs.loadInBackground");
        let focusType = bgPref ? "fg" : "bg";
        inverseLink.setAttribute("label", inverseLink.getAttribute(focusType + "label") ?? "");
        inverseLink.setAttribute(
          "accesskey",
          inverseLink.getAttribute(focusType + "accesskey") ?? ""
        );
      }
      Tabmix.showItem("tm-linkWithhistory", Tabmix.prefs.getBoolPref("linkWithHistory") && onLink);
      var closeTabMenu = document.getElementById("tm-content-closetab");
      let showCloseTab = !contentClick && Tabmix.prefs.getBoolPref("closeTabContent");
      const selectedTabsCount = this.updateSelectedTabsCount(closeTabMenu, showCloseTab);
      Tabmix.showItem(closeTabMenu, showCloseTab);
      var keepLastTab = tabsCount == 1 && Tabmix.prefs.getBoolPref("keepLastTab");
      Tabmix.setItem(
        closeTabMenu,
        "disabled",
        (selectedTabsCount === 0 && protectedTab) || keepLastTab
      );

      // for remote tab get call getValidUrl when it is safe to use CPOWs
      // getValidUrl may call getParamsForLink
      if (
        tab.linkedBrowser.getAttribute("remote") == "true" &&
        onLink &&
        (Tabmix.prefs.getBoolPref("openLinkHere") ||
          Tabmix.prefs.getBoolPref("openInverseLink") ||
          Tabmix.prefs.getBoolPref("linkWithHistory"))
      ) {
        gContextMenu.tabmixLinkURL = Tabmix.tablib.getValidUrl();
      }

      var freezeTabMenu = document.getElementById("tm-content-freezeTab");
      Tabmix.showItem(freezeTabMenu, !contentClick && Tabmix.prefs.getBoolPref("freezeTabContent"));
      Tabmix.setItem(freezeTabMenu, "checked", protectedTab && lockedTab);

      var lockTabMenu = document.getElementById("tm-content-lockTab");
      Tabmix.showItem(lockTabMenu, !contentClick && Tabmix.prefs.getBoolPref("lockTabContent"));
      Tabmix.setItem(lockTabMenu, "checked", lockedTab);

      var protectTabMenu = document.getElementById("tm-content-protectTab");
      Tabmix.showItem(
        protectTabMenu,
        !contentClick && Tabmix.prefs.getBoolPref("protectTabContent")
      );
      Tabmix.setItem(protectTabMenu, "checked", protectedTab);

      var duplicateTabMenu = document.getElementById("tm-duplicateTabContext");
      Tabmix.showItem(
        duplicateTabMenu,
        !contentClick &&
          !gContextMenu.isTextSelected &&
          Tabmix.prefs.getBoolPref("duplicateTabContent")
      );

      Tabmix.showItem(
        "tm-detachTabContext",
        !contentClick &&
          !gContextMenu.isTextSelected &&
          !Tabmix.singleWindowMode &&
          Tabmix.prefs.getBoolPref("detachTabContent")
      );

      var duplicateWinMenu = document.getElementById("tm-duplicateinWinContext");
      Tabmix.showItem(
        duplicateWinMenu,
        !contentClick &&
          !gContextMenu.isTextSelected &&
          !Tabmix.singleWindowMode &&
          Tabmix.prefs.getBoolPref("duplicateWinContent")
      );

      var tabsListMenu = document.getElementById("tm-tabsList");
      Tabmix.showItem(tabsListMenu, !contentClick && Tabmix.prefs.getBoolPref("tabsList"));

      var undoCloseTabMenu = document.getElementById("tm-content-undoCloseTab");
      var undoClose = Tabmix.prefs.getBoolPref("undoClose");
      Tabmix.showItem(
        undoCloseTabMenu,
        !contentClick &&
          !gContextMenu.isTextSelected &&
          undoClose &&
          !closeTabsEmpty &&
          Tabmix.prefs.getBoolPref("undoCloseTabContent")
      );

      var undoCloseListMenu = document.getElementById("tm-content-undoCloseList");
      Tabmix.showItem(
        undoCloseListMenu,
        !contentClick &&
          !gContextMenu.isTextSelected &&
          undoClose &&
          !closeTabsEmpty &&
          Tabmix.prefs.getBoolPref("undoCloseListContent")
      );

      var isOneWindow = Tabmix.numberOfWindows() == 1;
      var mergeMenu = document.getElementById("tm-mergeWindows");
      Tabmix.showItem(
        mergeMenu,
        !contentClick && !isOneWindow && Tabmix.prefs.getBoolPref("mergeWindowContent")
      );

      const showMenu =
        Tabmix.prefs.getBoolPref("autoReloadContent") &&
        !contentClick &&
        !gContextMenu.isTextSelected;
      this._showAutoReloadMenu("tm-autoreload_menu", showMenu);

      Tabmix.showItem(
        "tm-openAllLinks",
        Tabmix.prefs.getBoolPref("openAllLinks") && !TabmixContext.openMultipleLinks(true)
      );
    } catch (ex) {
      Tabmix.assert(ex);
    }

    // show/hide menuseparator
    this.contextMenuShown("contentAreaContextMenu");
    return true;
  },

  _showAutoReloadMenu: function TMP__autoReloadMenu(menuId, showMenu) {
    let menu = document.getElementById(menuId);
    if (showMenu) {
      let entity = Tabmix.prefs.getBoolPref("reload_match_address") ? "Site" : "Tab";
      Tabmix.setItem(menu, "label", menu.getAttribute("label#".replace("#", entity)));
      Tabmix.setItem(menu, "accesskey", menu.getAttribute("accesskey#".replace("#", entity)));
    }
    Tabmix.showItem(menu, showMenu);
  },

  openMultipleLinks: function TMP_openMultipleLinks(check) {
    let urls = gContextMenu.tabmixLinks || new Map();
    if (!check && urls.size) {
      for (let [url, usercontextid] of urls) {
        try {
          let params = {userContextId: parseInt(usercontextid)};
          openLinkIn(url, "tab", gContextMenu._openLinkInParameters(params));
        } catch (ex) {
          Tabmix.reportError(ex);
        }
      }
      return false;
    }
    return urls.size === 0;
  },

  updateSelectedTabsCount(itemOrId, isVisible) {
    const selectedTabsCount =
      isVisible ?
        ChromeUtils.nondeterministicGetWeakSetKeys(gBrowser._multiSelectedTabsSet).filter(
          tab => tab.isConnected && !tab.closing && !tab.hasAttribute("protected")
        ).length
      : 1;
    const tabCountInfo = JSON.stringify({tabCount: selectedTabsCount || 1});
    Tabmix.setItem(itemOrId, "data-l10n-args", tabCountInfo);
    return selectedTabsCount;
  },
};

Tabmix.allTabs = {
  init() {
    const allTabsButton = document.getElementById("alltabs-button");
    allTabsButton?.addEventListener("click", function onClick(event) {
      if (event.button === 0 && event.detail === 1) {
        allTabsButton.removeEventListener("click", onClick);
        setTimeout(Tabmix.allTabs.insertSortButton, 0);
      }
    });

    document
      .getElementById("allTabsMenu_sortTabsButton")
      .addEventListener("command", () => this.sortTabsInList());
  },

  insertSortButton() {
    const sortTabsButton = document.getElementById("allTabsMenu_sortTabsButton");
    const searchTabs = document.getElementById("allTabsMenu-searchTabs");
    const panelSubview = searchTabs.parentElement;
    const firstSeparator = panelSubview?.querySelector("toolbarseparator");
    if (firstSeparator && sortTabsButton.nextSibling !== firstSeparator) {
      if ([...searchTabs.classList].includes("subviewbutton-iconic")) {
        sortTabsButton.classList.add("subviewbutton-iconic");
      }
      panelSubview?.insertBefore(sortTabsButton, firstSeparator);

      const panel = gTabsPanel.allTabsPanel;

      panel._removeTabFromList = function (event) {
        if (event.button === 1 && Tabmix.prefs.getBoolPref("middleclickDelete")) {
          this.gBrowser.removeTab(event.target.tab, {animate: true});
        }
      };

      panel._original_createRow = panel._createRow;
      panel._createRow = function (...args) {
        const row = this._original_createRow.apply(this, args);
        row.addEventListener("click", this._removeTabFromList.bind(this));
        return row;
      };

      // TabsListBase class
      // modify _populateDOM and _populate add _tabmix_sortTabs

      /** @type {MockedGeckoTypes.TabsListBase} */
      const TabsListBase = Object.getPrototypeOf(TabsPanel.prototype);

      if (Tabmix.isVersion(1350)) {
        TabsListBase._tabmix_sortTabs = function () {
          return this.gBrowser.tabs.slice().sort((a, b) => {
            if (a.group?.id === b.group?.id) {
              return a.label.toLowerCase() > b.label.toLowerCase() ? 1 : -1;
            }
            const labelA = a.group ? a.group.label.toLowerCase() : a.label.toLowerCase();
            const labelB = b.group ? b.group.label.toLowerCase() : b.label.toLowerCase();
            return labelA > labelB ? 1 : -1;
          });
        };
      } else {
        TabsListBase._tabmix_sortTabs = function () {
          return this.gBrowser.tabs
            .slice()
            .sort((a, b) => (a.label.toLowerCase() > b.label.toLowerCase() ? 1 : -1));
        };
      }

      TabsListBase._populateDOM = function () {
        let fragment = this.doc.createDocumentFragment();
        let currentGroupId;

        const tabs =
          typeof sortTabsButton === "object" && sortTabsButton.checked ?
            this._tabmix_sortTabs()
          : this.gBrowser.tabs;

        for (let tab of tabs) {
          if (this.filterFn(tab)) {
            if (Tabmix.isVersion(1350) && tab.group && tab.group.id != currentGroupId) {
              fragment.appendChild(this._createGroupRow(tab.group));
              currentGroupId = tab.group.id;
            }
            if (!tab.group?.collapsed) {
              fragment.appendChild(this._createRow(tab));
            }
          }
        }

        this._addElement(fragment);
      };

      if (!Tabmix.isVersion(1360)) {
        TabsListBase._populate = function () {
          this._populateDOM();
          this._setupListeners();
        };
      }
    }
  },

  sortTabsInList() {
    gTabsPanel.allTabsPanel._cleanup();
    gTabsPanel.allTabsPanel._populate();
  },

  showAllTabsPanel(event) {
    gTabsPanel.init();
    this.insertSortButton();

    let anchor = event.target;

    setTimeout(() => {
      PanelUI.showSubView(gTabsPanel.kElements.allTabsView, anchor, event);
    }, 0);
  },
};

// for all tabs popup lists
/** @type {TabmixAllTabs} */
var TabmixAllTabs = {
  _selectedItem: null,
  backupLabel: "",
  handleEvent: function TMP_AT_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "TabAttrModified": {
        /** @type {Tab} */
        let tab = aEvent.target;
        let menuitem = tab.mCorrespondingMenuitem;
        this._setMenuitemAttributes(menuitem, tab, Number(menuitem?.value));
        break;
      }
      case "TabClose":
        this._tabOnTabClose(aEvent);
        break;
      case "DOMMenuItemActive":
        this.updateMenuItemActive(aEvent.target);
        break;
      case "DOMMenuItemInactive":
        this.updateMenuItemInactive();
        break;
      case "popupshown":
        this._ensureElementIsVisible(aEvent);
        break;
    }
  },

  checkForCtrlClick: function TMP_checkForCtrlClick(aEvent) {
    var aButton = aEvent.target;
    if (!aButton.disabled && aEvent.button === 0 && (aEvent.ctrlKey || aEvent.metaKey)) {
      if (aButton.id == "tabmix-closedTabsButton") {
        Tabmix.undoCloseTab();
        aButton.setAttribute("afterctrlclick", true);
      } else if (
        aButton.id == "tabmix-alltabs-button" ||
        (aButton.parentNode && aButton.parentNode.id == "allTabsMenu-allTabsView")
      ) {
        window.BrowserCommands.closeTabOrWindow();
        aButton.setAttribute("afterctrlclick", true);
      }
    }
  },

  isAfterCtrlClick: function TMP_isAfterCtrlClick(aButton) {
    if (aButton.hasAttribute("afterctrlclick")) {
      aButton.removeAttribute("afterctrlclick");
      if (aButton.hasAttribute("open")) {
        aButton.removeAttribute("open");
      }

      return true;
    }
    return false;
  },

  createScrollButtonTabsList: function TMP_createScrollButtonTabsList(event, side) {
    event.stopPropagation();
    event.preventDefault();

    if (event.target.disabled) {
      return;
    }

    var tablist = document.getElementById("tabslist");

    this.beforeCommonList(tablist);
    this.createCommonList(tablist, 2, side);

    if (tablist.hasChildNodes()) {
      tablist.openPopup(event.target, {
        position: "bottomleft topleft",
        triggerEvent: event,
      });
    }
  },

  removeTabFromList: function TMP_removeTabFromList(event) {
    if (event.button === 1 && Tabmix.prefs.getBoolPref("middleclickDelete")) {
      closeMenus(event.target);
      gBrowser.removeTab(event.originalTarget.tab, {animate: true});
    }
  },

  createTabsList: function TMP_createTabsList(popup, aType) {
    if (this.isAfterCtrlClick(popup.parentNode)) {
      return false;
    }

    const contextMenuId = "tabContextMenu";
    if (popup.hasAttribute("context") && popup.getAttribute("context") != contextMenuId) {
      popup.setAttribute("context", contextMenuId);
    }

    this.beforeCommonList(popup);
    this.createCommonList(popup, aType);

    return true;
  },

  beforeCommonList: function TMP_beforeCommonList(popup, aCloseTabsPopup) {
    // clear out the menu popup if we show the popup after middle click
    while (popup.hasChildNodes()) {
      var menuItem = popup.firstChild;
      menuItem.removeEventListener("command", TMP_ClosedTabs);
      menuItem.removeEventListener("click", TMP_ClosedTabs);
      menuItem.remove();
    }

    if (!aCloseTabsPopup) {
      gBrowser.tabContainer.addEventListener("TabAttrModified", this);
      gBrowser.tabContainer.addEventListener("TabClose", this);
    }
    popup.addEventListener("DOMMenuItemActive", this);
    popup.addEventListener("DOMMenuItemInactive", this);
  },

  createCommonList: function TMP_createCommonList(popup, aType, side) {
    switch (aType) {
      case 1: {
        /**
         * @param {Tab} tab
         * @param {number} index
         */
        let TabSorting = function _tabSorting(tab, index) {
          this.Tab = tab;
          this.Index = index;
        };
        TabSorting.prototype.toString = function () {
          return this.Tab.label.toLowerCase();
        };
        const tabs = Tabmix.visibleTabs.tabs.map((tab, i) => new TabSorting(tab, i)).sort();
        for (const tab of tabs) {
          this.createMenuItems(popup, tab.Tab, tab.Index);
        }
        break;
      }
      case 2: {
        let addToMenu = side != "right";
        Tabmix.visibleTabs.tabs.some((tab, i) => {
          let visible = side && Tabmix.tabsUtils.isElementVisible(tab);
          if (visible) {
            if (!tab.pinned) {
              if (side == "left") {
                return true;
              }
              addToMenu = true;
            }
          } else if (addToMenu) {
            this.createMenuItems(popup, tab, i);
          }
          return false;
        });
        break;
      }
      case 3: {
        TMP_LastTab.tabs
          .slice()
          .reverse()
          .forEach((tab, i) => {
            if (!tab.hidden) {
              this.createMenuItems(popup, tab, TMP_LastTab.tabs.length - 1 - i);
            }
          });
        break;
      }
    }

    if (this._selectedItem) {
      popup.addEventListener("popupshown", this);
    }
  },

  _ensureElementIsVisible: function TMP__ensureElementIsVisible(event) {
    var popup = event.target;
    popup.removeEventListener("popupshown", this);
    const scrollBox = popup.scrollBox;
    let items = Array.prototype.slice.call(popup.childNodes);
    let element =
      items.indexOf(this._selectedItem) < popup.childElementCount / 2 ?
        popup.firstChild
      : popup.lastChild;
    scrollBox.ensureElementIsVisible(element);
    if (this._selectedItem) {
      scrollBox.ensureElementIsVisible(this._selectedItem);
    }
  },

  createMenuItems: function TMP_createMenuItems(popup, tab, value) {
    let mi = document.createXULElement("menuitem");
    mi.setAttribute("class", "menuitem-iconic bookmark-item alltabs-item");
    let url = gBrowser.getBrowserForTab(tab).currentURI.spec;
    mi.setAttribute("statustext", url);
    mi.setAttribute("tooltiptext", tab.label + "\n" + url);
    this._setMenuitemAttributes(mi, tab, value);
    if (tab.selected) {
      this._selectedItem = mi;
    }

    mi.value = value;
    tab.mCorrespondingMenuitem = mi;
    mi.tab = tab;

    popup.appendChild(mi);

    // for ColorfulTabs 6.0+
    if (typeof window.colorfulTabs == "object") {
      let rule = "none";
      if (window.colorfulTabs.clrAllTabsPopPref) {
        let tabClr = SessionStore.getCustomTabValue(tab, "tabClr");
        if (tabClr) {
          rule =
            "linear-gradient(rgba(255,255,255,.7),rgba(#1,.5),rgb(#1)),linear-gradient(rgb(#1),rgb(#1))".replace(
              /#1/g,
              tabClr
            );
        }
      }
      mi.style.setProperty("background-image", rule, "important");
    }
  },

  _setMenuitemAttributes(aMenuitem, aTab, value) {
    if (!aMenuitem) {
      return;
    }

    const isRTL =
      window.windowUtils.getDirectionFromText(aTab.label) === Ci.nsIDOMWindowUtils.DIRECTION_RTL;
    const rtlSpacer = Tabmix.rtl && value < 9 ? "  " : "";
    const ltrSpacer = Tabmix.ltr && value < 9 ? "  " : "";
    if (Tabmix.ltr === isRTL) {
      const count = " :" + rtlSpacer + (value + 1) + ltrSpacer;
      aMenuitem.setAttribute("label", aTab.label + count);
    } else {
      const count = ltrSpacer + (value + 1) + rtlSpacer + ": ";
      aMenuitem.setAttribute("label", count + aTab.label);
    }
    aMenuitem.setAttribute("crop", "end");

    if (aTab.hasAttribute("busy")) {
      aMenuitem.setAttribute("busy", aTab.getAttribute("busy") ?? "");
      aMenuitem.removeAttribute("image");
    } else {
      const icon = gBrowser.getIcon(aTab);
      if (icon) {
        aMenuitem.setAttribute("image", icon);
      }
      aMenuitem.removeAttribute("busy");
    }

    if (aTab.hasAttribute("pending")) {
      aMenuitem.setAttribute("pending", aTab.getAttribute("pending") ?? "");
    } else {
      aMenuitem.removeAttribute("pending");
    }

    if (aTab.selected) {
      aMenuitem.setAttribute("selected", "true");
    } else {
      aMenuitem.removeAttribute("selected");
    }
  },

  _tabOnTabClose: function TMP__tabOnTabClose(aEvent) {
    var menuItem = aEvent.target.mCorrespondingMenuitem;
    if (menuItem) {
      menuItem.remove();
    }
  },

  _tabsListOncommand: function TMP__tabsListOncommand(aEvent) {
    if ("tab" in aEvent.originalTarget) {
      this._tabSelectedFromList(aEvent.originalTarget.tab);
    }
  },

  _tabSelectedFromList: function TMP__tabSelectedFromList(aTab) {
    if (aTab.selected) {
      gBrowser.ensureTabIsVisible(aTab);
    } else {
      // if we select another tab _handleTabSelect will call arrowScrollbox.ensureElementIsVisible
      gBrowser.selectedTab = aTab;
    }
  },

  hideCommonList: function TMP_hideCommonList(popup) {
    // clear out the menu popup and remove the listeners
    while (popup.hasChildNodes()) {
      var menuItem = popup.firstChild;
      if ("tab" in menuItem) {
        menuItem.tab.mCorrespondingMenuitem = null;
      }
      menuItem.remove();
    }

    gBrowser.tabContainer.removeEventListener("TabAttrModified", this);
    gBrowser.tabContainer.removeEventListener("TabClose", this);
    popup.removeEventListener("DOMMenuItemActive", this);
    popup.removeEventListener("DOMMenuItemInactive", this);

    this.backupLabel = "";
    this._selectedItem = null;

    if (window.XULBrowserWindow) {
      window.XULBrowserWindow.setOverLink("");
      const contextmenu = document.getElementById("contentAreaContextMenu");
      if (contextmenu.state === "open" && StatusPanel.isVisible) {
        StatusPanel.update();
      }
    }
  },

  updateMenuItemActive: function TMP_updateMenuItemActive(item) {
    this.updateStatusText(item?.getAttribute("statustext") ?? "");
  },

  updateMenuItemInactive: function TMP_updateMenuItemInactive() {
    this.updateStatusText("");
  },

  updateStatusText: function TMP_updateStatusText(itemText) {
    XULBrowserWindow.setOverLink(itemText);
  },
};
