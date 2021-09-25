/* exported TabmixTabClickOptions, TabmixAllTabs */
"use strict";

ChromeUtils.defineModuleGetter(Tabmix, "ContextMenu",
  "chrome://tabmix-resource/content/ContextMenu.jsm");

var TabmixTabClickOptions = {
  _tabFlipTimeOut: null,
  _blockDblClick: false,

  // Single click on tab/tabbar
  onTabClick: function TMP_onTabClick(aEvent) {
    if (!aEvent)
      return;
    if (aEvent.button == 2)
      return; // right click

    var leftClick = aEvent.button === 0;
    if (leftClick && aEvent.detail > 1) {
      if (this._tabFlipTimeOut)
        this.clearTabFlipTimeOut();
      if (this._blockDblClick) {
        setTimeout(() => (this._blockDblClick = false), 0);
      }
      return; // double click (with left button)
    }

    const target = aEvent.originalTarget;
    const isCloseButton = aEvent.target.classList.contains("tab-close-button");
    this._blockDblClick = target.id === "tabs-newtab-button";

    // don't do anything if user left click on tab or tabbar button
    if (leftClick &&
        (isCloseButton || aEvent.target._overPlayingIcon ||
         target.localName == "toolbarbutton")) {
      return;
    }

    // only allow middle-click on close tab button on tab to go throw as
    // middle-click on the tab
    if (aEvent.button == 1 && target.localName == "toolbarbutton" && !isCloseButton) {
      return;
    }

    const clickOutTabs = aEvent.target.localName == "arrowscrollbox";
    const tab = clickOutTabs ? gBrowser._selectedTab : aEvent.target.closest("tab.tabbrowser-tab");

    // we replace click handler from tab binding with this to make sure that we
    // always call onMouseCommand (if we need to) before we call tab flip.
    // tabcontainer click handler run before tab click handler.
    if (leftClick && !clickOutTabs && !tab.mouseDownSelect)
      tab.onMouseCommand(aEvent, true);

    // for tab flip
    if (!clickOutTabs && leftClick && tab.hasAttribute("clickOnCurrent")) {
      tab.removeAttribute("clickOnCurrent");
      let tabFlip = Tabmix.prefs.getBoolPref("tabFlip");
      if (tabFlip && !aEvent.shiftKey && !aEvent.ctrlKey && !aEvent.altKey && !aEvent.metaKey) {
        let self = this;
        let tabFlipDelay = Tabmix.prefs.getIntPref("tabFlipDelay");
        if (this._tabFlipTimeOut)
          this.clearTabFlipTimeOut();
        this._tabFlipTimeOut = setTimeout(function selectPreviousTab(aTab) {
          self.clearTabFlipTimeOut();
          gBrowser.previousTab(aTab);
          gBrowser.stopMouseHoverSelect(aTab);
          gBrowser.selectedBrowser.focus();
        }, tabFlipDelay, tab);
        return;
      }
    }

    // handle multi-select
    if (!clickOutTabs) {
      const keyPress = [
        (aEvent.ctrlKey && !aEvent.metaKey || !aEvent.ctrlKey && aEvent.metaKey),
        aEvent.shiftKey,
        aEvent.altKey,
      ];
      const keyPrefs = [
        Tabmix.prefs.getIntPref("ctrlClickTab"),
        Tabmix.prefs.getIntPref("shiftClickTab"),
        Tabmix.prefs.getIntPref("altClickTab")
      ];
      const press2Key = leftClick && keyPress[0] + keyPress[1] + keyPress[2] === 2 &&
        keyPrefs.some((x, i) => x === 33 && keyPress[i]) &&
        keyPrefs.some((x, i) => x === 34 && keyPress[i]);
      let middleMul;
      if (aEvent.button === 1 && keyPress[0] + keyPress[1] + keyPress[2] === 1) {
        const middleAndModifier = `${Tabmix.prefs.getIntPref("middleClickTab")},${keyPrefs[keyPress.findIndex(x => x)]}`;
        middleMul = middleAndModifier === '33,34' || middleAndModifier === '34,33';
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
    } else if (leftClick && aEvent.shiftKey && !aEvent.ctrlKey &&
        !aEvent.altKey && !aEvent.metaKey) {
      prefName = "shift"; /* shift click*/
    } else if (leftClick && aEvent.altKey && !aEvent.ctrlKey &&
        !aEvent.shiftKey && !aEvent.metaKey) {
      prefName = "alt"; /* alt click*/
      window.addEventListener("keyup", function TMP_onKeyup_onTabClick(event) {
        event.stopPropagation();
      }, {capture: true, once: true});
    } else if (leftClick && (aEvent.ctrlKey && !aEvent.metaKey ||
        !aEvent.ctrlKey && aEvent.metaKey) && !aEvent.shiftKey && !aEvent.altKey) {
      prefName = "ctrl"; /* ctrl click*/
    }

    if (prefName)
      this.clickAction(prefName, clickOutTabs, tab, aEvent);
  },

  clearTabFlipTimeOut() {
    clearTimeout(this._tabFlipTimeOut);
    this._tabFlipTimeOut = null;
  },

  // Double click on tab/tabbar
  onTabBarDblClick: function TMP_onTabBarDblClick(aEvent) {
    if (!aEvent || aEvent.button !== 0 || aEvent.ctrlKey || aEvent.shiftKey ||
        aEvent.altKey || aEvent.metaKey) {
      return;
    }

    const target = aEvent.originalTarget;
    const isCloseButton = aEvent.target.classList.contains("tab-close-button");
    // don't do anything if user left click on tab or tabbar button
    if (isCloseButton || aEvent.target._overPlayingIcon ||
        target.localName == "toolbarbutton") {
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
        BrowserOpenTab();
        break;
      case 2:
        if (aTab?.parentNode) {
          let byMouse = event?.mozInputSource == MouseEvent.MOZ_SOURCE_MOUSE;
          gBrowser.removeTab(aTab, {animate: true, byMouse});
        }
        break;
      case 3:
        Tabmix.duplicateTab(aTab);
        break;
      case 4:
        if (aTab.linkedBrowser.__SS_restoreState != 2)
          gBrowser.reloadTab(aTab);
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
        TMP_ClosedTabs.undoCloseTab();
        break;
      case 11:
        Tabmix.renameTab.editTitle(aTab);
        break;
      case 12: { // taken from tco
        let SessionSaver = window.SessionSaver;
        if (SessionSaver && SessionSaver.snapBackTab)
          SessionSaver.snapBackTab(SessionSaver.snapback_noFX, SessionSaver.snapback_willFocus);
        break;
      }
      case 13:
        TMP_ClosedTabs.restoreTab("original", -2);
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
      case 21: { // taken from tco
        let href;
        if (window.IeView && window.IeView.ieViewLaunch) {
          href = gBrowser.getBrowserForTab(aTab).currentURI.spec;
          window.IeView.ieViewLaunch("Internet Explorer.lnk", href);
        } else if (Tabmix.extensions.gIeTab) {
          let ieTab = Tabmix.extensions.gIeTab;
          let gIeTabObj = window[ieTab.obj];
          if (typeof gIeTabObj.switchTabEngine == "function") {
            if (!aTab.selected)
              gBrowser.selectedTab = aTab;
            // IeTab2.getBoolPref accept default value
            gIeTabObj.switchTabEngine(aTab, gIeTabObj.getBoolPref(ieTab.folder + ".alwaysNewTab", false));
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
        PlacesCommandHook.bookmarkPage(aTab.linkedBrowser, PlacesUtils.bookmarksMenuFolderId, true);
        break;
      case 26:
        PlacesCommandHook.bookmarkCurrentPages();
        break;
      case 27:
        gBrowser.duplicateTabToWindow(aTab, true);
        break;
      case 28:
        gBrowser.copyTabUrl(aTab);
        break;
      case 29:
        // changed on 2011-03-09 - open new tab when clicked on tabbar
        // or when the tab is locked
        event = document.createEvent("Events");
        var opennewTab = clickOutTabs || (aTab.hasAttribute("locked") && !gBrowser.isBlankNotBusyTab(aTab));
        event.ctrlKey = opennewTab;
        event.initEvent("click", true, true);
        middleMousePaste(event);
        if (opennewTab) {
          let tab = gBrowser.getTabForLastPanel();
          if (!tab.selected)
            gBrowser.selectedTab = tab;
        }
        break;
      case 30: // enable/disable AutoReload
        if (aTab.autoReloadEnabled === undefined)
          Tabmix.autoReload.initTab(aTab);
        Tabmix.autoReload.toggle(aTab);
        break;
      case 31: // pin/unpin tab
        if (aTab.pinned)
          gBrowser.unpinTab(aTab);
        else
          gBrowser.pinTab(aTab);
        break;
      case 32:
        gBrowser.previousTab(gBrowser.selectedTab);
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
      gBrowser.removeFromMultiSelectedTabs(aTab, {isLastMultiSelectChange: true});
    } else if (aTab != gBrowser.selectedTab) {
      gBrowser.addToMultiSelectedTabs(aTab, {isLastMultiSelectChange: true});
      gBrowser.lastMultiSelectedTab = aTab;
    }
  },

  _tabRangeSelected(aTab, cumul) {
    const lastSelectedTab = gBrowser.lastMultiSelectedTab;
    if (!cumul) gBrowser.clearMultiSelectedTabs({isLastMultiSelectChange: false});
    gBrowser.addRangeToMultiSelectedTabs(lastSelectedTab, aTab);
  },

  toggleEventListener(enable) {
    let eventListener = enable ? "addEventListener" : "removeEventListener";
    document.getElementById("TabsToolbar")[eventListener]("dblclick", this.blockDblclick, false);
  },

  /**
   * block dblclick on TabsToolbar when tabbar.dblclick_changesize is false
   * and tabbar.click_dragwindow is true
   */
  blockDblclick(aEvent) {
    if (aEvent.button !== 0 || aEvent.target.localName == "arrowscrollbox" ||
        Tabmix.prefs.getBoolPref("tabbar.dblclick_changesize") ||
        !Tabmix.prefs.getBoolPref("tabbar.click_dragwindow"))
      return;

    aEvent.preventDefault();
  },

  /**
   * block mouse down with modifiers if the modifier is used by our clicking option
   */
  blockMouseDown(event) {
    if (event.shiftKey && Tabmix.prefs.getIntPref("shiftClickTab") != -1 ||
      event.altKey && Tabmix.prefs.getIntPref("altClickTab") != -1 ||
      (event.ctrlKey || event.metaKey) && Tabmix.prefs.getIntPref("ctrlClickTab") != -1
    ) {
      return true;
    }
    return false;
  },
};

var TabmixContext = {
  // Create new items in the tab bar context menu
  buildTabContextMenu: function TMP_buildTabContextMenu() {
    var $id = id => document.getElementById(id);

    MozXULElement.insertFTLIfNeeded("browser/preferences/preferences.ftl");
    MozXULElement.insertFTLIfNeeded("browser/menubar.ftl");
    Tabmix.setFTLDataId("tabContextMenu");

    Tabmix.setFTLDataId("context_reopenInContainer");

    var tabContextMenu = $id("tabContextMenu");
    tabContextMenu.insertBefore($id("context_reloadTab"), $id("tabmix_reloadTabOptions_separator"));
    tabContextMenu.insertBefore($id("context_reloadSelectedTabs"), $id("tabmix_reloadTabOptions_separator"));
    tabContextMenu.insertBefore($id("context_undoCloseTab"), $id("tabmix_closeTab_separator"));
    tabContextMenu.insertBefore($id("context_closeTab"), $id("tabmix_closeTab_separator"));
    tabContextMenu.insertBefore($id("context_bookmarkSelectedTabs"), $id("context_bookmarkAllTabs"));
    tabContextMenu.insertBefore($id("context_bookmarkTab"), $id("context_bookmarkAllTabs"));

    const openTab = $id("context_openANewTab");
    if (Tabmix.isVersion(940)) {
      tabContextMenu.addEventListener("popupshowing", () => {
        openTab.setAttribute("_newtab", openTab.getAttribute("label"));
      }, {once: true});
    } else {
      const {firstElementChild: element} = MozXULElement.parseXULToFragment(
        `<menuitem label="&tabCmd.label;"/>`,
        ["chrome://browser/locale/browser.dtd"]
      );
      const label = element.getAttribute("label");
      openTab.setAttribute("label", label);
      openTab.setAttribute("_newtab", label);
    }

    if (!Tabmix.isVersion(880)) {
      const closeTabsToTheStart = MozXULElement.parseXULToFragment(
        `<menuitem id="context_closeTabsToTheStart"
          label="&closeTabsToLeft.label;" accesskey="&closeleft.accesskey;"
          oncommand="gBrowser.removeTabsToTheStartFrom(TabContextMenu.contextTab);"/>
        `,
        ["chrome://tabmixplus/locale/tabmix.dtd"]
      );
      const closeTabsToTheEnd = $id("context_closeTabsToTheEnd");
      closeTabsToTheEnd.parentElement.insertBefore(closeTabsToTheStart, closeTabsToTheEnd);
    }

    // we can't disable menus with command attribute
    $id("context_undoCloseTab").removeAttribute("command");

    // insert IE Tab menu-items before Bookmarks menu-items
    if ("gIeTab" in window) { // no need to do this fix for IE Tab 2
      let IeTab = window.IeTab;
      var aFunction = "createTabbarMenu" in IeTab.prototype ? "createTabbarMenu" : "init";
      if (aFunction in IeTab.prototype) {
        Tabmix.changeCode(IeTab.prototype, "IeTab.prototype." + aFunction)._replace(
          'tabbarMenu.insertBefore(document.getElementById("ietab-tabbar-sep"), separator);',
          'separator = document.getElementById("tabmix_lockTab_separator"); $&'
        ).toCode();
      }
    }

    // fix conflict with CookiePie extension
    if ("cookiepieContextMenu" in window) {
      let cookiepieContextMenu = window.cookiepieContextMenu;
      if (!cookiepieContextMenu.initialized) {
        cookiepieContextMenu.init();
      }
    }

    if (Tabmix.prefs.getBoolPref("showTabContextMenuOnTabbar"))
      this.updateTabbarContextMenu(true);

    // move tm-content-miscSep to its place (Firefox 32+)
    let sep = $id("tm-content-miscSep");
    sep.parentNode.insertBefore(sep, $id("tm-content-closetab"));
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
    var eventListener = enable ? "addEventListener" : "removeEventListener";
    document.getElementById("contentAreaContextMenu")[eventListener]("popupshowing", this, false);
    document.getElementById("tabContextMenu")[eventListener]("popupshowing", this, false);
    document.getElementById("tabContextMenu")[eventListener]("popupshown", this, false);
  },

  handleEvent(aEvent) {
    let id = aEvent.target.id;
    switch (aEvent.type) {
      case "popupshowing":
        if (aEvent.target.state != "showing") {
          return;
        }
        if (id == "tabContextMenu")
          this.updateTabContextMenu(aEvent);
        else if (id == "contentAreaContextMenu")
          this.updateMainContextMenu(aEvent);
        break;
      case "popupshown":
        this.contextMenuShown(aEvent);
        break;
      case "popuphidden":
        if (id == "tabContextMenu") {
          aEvent.target.removeEventListener("popuphidden", this);
          Tabmix.hidePopup(aEvent.target);
        }
        break;
    }
  },

  // Tab context menu popupshowing
  updateTabContextMenu: function TMP_updateTabContextMenu(event) {
    if (event.originalTarget != document.getElementById("tabContextMenu"))
      return true;

    document.getElementById("tabContextMenu").addEventListener("popuphidden", this);

    const origTriggerNode = document.getElementById("tabContextMenu").triggerNode;
    let triggerNode = origTriggerNode && origTriggerNode.parentNode;
    if (triggerNode && triggerNode.parentNode) {
      const item = triggerNode.parentNode.id;
      if (item === "allTabsMenu-allTabsView") {
        TabContextMenu.contextTab = triggerNode.tab;
      }
    }
    let multiselectionContext = TabContextMenu.contextTab.multiselected;

    const clickOutTabs = triggerNode && triggerNode.localName == "tabs";
    var aTab = clickOutTabs ? gBrowser.selectedTab : TabContextMenu.contextTab;

    var isOneWindow = Tabmix.numberOfWindows() == 1;

    const newTab = document.getElementById("context_openANewTab");
    Tabmix.showItem(newTab, Tabmix.prefs.getBoolPref("newTabMenu"));
    if (clickOutTabs) {
      Tabmix.setItem(newTab, "label", newTab.getAttribute("_newtab"));
      Tabmix.setItem(newTab, "oncommand", "TMP_BrowserOpenTab();");
    } else {
      Tabmix.setItem(newTab, "label", newTab.getAttribute("_newtab") + "  " + newTab.getAttribute("_afterthis"));
      Tabmix.setItem(newTab, "oncommand", "TMP_BrowserOpenTab(null, TabContextMenu.contextTab);");
    }

    // Duplicate Commands
    Tabmix.showItem("context_duplicateTab", !multiselectionContext && Tabmix.prefs.getBoolPref("duplicateMenu"));
    Tabmix.showItem("context_duplicateTabs", multiselectionContext && Tabmix.prefs.getBoolPref("duplicateMenu"));
    Tabmix.showItem("tm-duplicateinWin", Tabmix.prefs.getBoolPref("duplicateinWinMenu") && !Tabmix.singleWindowMode);
    Tabmix.showItem("context_openTabInWindow", Tabmix.prefs.getBoolPref("detachTabMenu") && !Tabmix.singleWindowMode);

    Tabmix.showItem("context_toggleMuteTab", !multiselectionContext && Tabmix.prefs.getBoolPref("muteTabMenu"));
    Tabmix.showItem("context_toggleMuteTabs", multiselectionContext && Tabmix.prefs.getBoolPref("muteTabMenu"));

    var show = Tabmix.prefs.getBoolPref("pinTabMenu");
    Tabmix.showItem("context_pinTab", !multiselectionContext && show && !aTab.pinned);
    Tabmix.showItem("context_unpinTab", !multiselectionContext && show && aTab.pinned);
    Tabmix.showItem("context_pinSelectedTabs", multiselectionContext && show && !aTab.pinned);
    Tabmix.showItem("context_unpinSelectedTabs", multiselectionContext && show && aTab.pinned);
    setTimeout(() => {
      // we need to set our show/hide after tabGroups extension
      let tabViewMenu = document.getElementById("context_tabViewMenu") ||
          document.getElementById("tabGroups-context_tabViewMenu");
      Tabmix.showItem(tabViewMenu, Tabmix.prefs.getBoolPref("moveToGroup") && !aTab.pinned);
    });
    Tabmix.showItem("context_moveTabOptions", Tabmix.prefs.getBoolPref("moveTabOptions"));

    // make sure not to show menu items that are hidden by Firefox
    Tabmix.setItem("context_sendTabToDevice", "tabmix_hide", !Tabmix.prefs.getBoolPref("sendTabToDevice") || null);
    Tabmix.setItem("context_shareTabURL", "tabmix_hide", !Tabmix.prefs.getBoolPref("shareTabURL") || null);

    Tabmix.showItem("tm-mergeWindowsTab",
      Tabmix.prefs.getBoolPref("showMergeWindow") &&
      (!Tabmix.singleWindowMode ||
      (Tabmix.singleWindowMode && !isOneWindow)));
    var showRenameTabMenu = Tabmix.prefs.getBoolPref("renameTabMenu");
    Tabmix.showItem("tm-renameTab", showRenameTabMenu);
    Tabmix.showItem("tm-copyTabUrl", Tabmix.prefs.getBoolPref("copyTabUrlMenu"));
    Tabmix.showItem("context_reopenInContainer", Tabmix.prefs.getBoolPref("reopenInContainer"));
    Tabmix.showItem("context_selectAllTabs", Tabmix.prefs.getBoolPref("selectAllTabs"));

    //  ---------------- menuseparator ---------------- //

    // Reload Commands
    Tabmix.showItem("context_reloadTab", !multiselectionContext && Tabmix.prefs.getBoolPref("reloadTabMenu"));
    Tabmix.showItem("context_reloadSelectedTabs", multiselectionContext && Tabmix.prefs.getBoolPref("reloadTabMenu"));
    this._showAutoReloadMenu("tm-autoreloadTab_menu", "autoReloadMenu", true);
    Tabmix.showItem("context_reloadTabOptions", Tabmix.prefs.getBoolPref("reloadTabOptions"));

    //  ---------------- menuseparator ---------------- //

    var undoClose = Tabmix.prefs.getBoolPref("undoClose");
    Tabmix.showItem("context_undoCloseTab", Tabmix.prefs.getBoolPref("undoCloseTabMenu") && undoClose);
    Tabmix.showItem("tm-undoCloseList", Tabmix.prefs.getBoolPref("undoCloseListMenu") && undoClose);

    //  ---------------- menuseparator ---------------- //

    // Close tab Commands
    Tabmix.showItem("context_closeTab", Tabmix.prefs.getBoolPref("closeTabMenu"));
    Tabmix.showItem("context_closeTabOptions", Tabmix.prefs.getBoolPref("closeTabOptions"));

    //  ---------------- menuseparator ---------------- //

    Tabmix.showItem("tm-docShell", Tabmix.prefs.getBoolPref("docShellMenu"));
    Tabmix.showItem("tm-freezeTab", Tabmix.prefs.getBoolPref("freezeTabMenu"));
    Tabmix.showItem("tm-protectTab", Tabmix.prefs.getBoolPref("protectTabMenu"));
    Tabmix.showItem("tm-lockTab", Tabmix.prefs.getBoolPref("lockTabMenu"));

    //  ---------------- menuseparator ---------------- //

    Tabmix.showItem("context_bookmarkTab", !multiselectionContext && Tabmix.prefs.getBoolPref("bookmarkTabMenu"));
    Tabmix.showItem("context_bookmarkTabs", multiselectionContext && Tabmix.prefs.getBoolPref("bookmarkTabMenu"));
    Tabmix.showItem("context_bookmarkAllTabs", Tabmix.prefs.getBoolPref("bookmarkTabsMenu"));

    // we call this again when popupshown to make sure we don't show 2 menuseparator together
    TabmixContext.contextMenuShown(event, "tabContextMenu");

    if (showRenameTabMenu) {
      // disabled rename if the title not ready yet
      let titleNotReady;
      if (aTab.hasAttribute("busy")) {
        let browser = gBrowser.getBrowserForTab(aTab);
        let url = browser.currentURI.spec;
        TMP_Places.getTitleFromBookmark(url, browser.contentTitle)
            .then(docTitle => {
              if (!docTitle || docTitle == Tabmix.getString("tabs.emptyTabTitle"))
                titleNotReady = true;
              Tabmix.setItem("tm-renameTab", "disabled", titleNotReady);
            });
      } else {
        Tabmix.setItem("tm-renameTab", "disabled", titleNotReady);
      }
    }

    let protectedTab = aTab.hasAttribute("protected");
    let lockedTab = aTab.hasAttribute("locked");
    let tabsCount = Tabmix.visibleTabs.tabs.length;
    let unpinnedTabsCount = multiselectionContext ?
      gBrowser.visibleTabs.filter(t => !t.multiselected && !t.pinned).length :
      gBrowser.visibleTabs.filter(t => t != this.contextTab && !t.pinned)
          .length;
    let noTabsToClose = !unpinnedTabsCount || unpinnedTabsCount == 1 && !aTab.pinned;
    let cIndex = Tabmix.visibleTabs.indexOf(aTab);

    // count unprotected tabs for closing
    let selectedTabsCount = multiselectionContext ? ChromeUtils.nondeterministicGetWeakSetKeys(
      gBrowser._multiSelectedTabsSet
    ).filter(tab => tab.isConnected && !tab.closing && !tab.hasAttribute("protected")).length : 1;
    let tabCountInfo = JSON.stringify({tabCount: selectedTabsCount});
    Tabmix.setItem("context_closeTab", "data-l10n-args", tabCountInfo);

    var keepLastTab = tabsCount == 1 && Tabmix.prefs.getBoolPref("keepLastTab");
    Tabmix.setItem("context_closeTab", "disabled", (multiselectionContext ? selectedTabsCount === 0 : protectedTab) || keepLastTab);
    Tabmix.setItem("tm-closeAllTabs", "disabled", keepLastTab || !unpinnedTabsCount);
    Tabmix.setItem("context_closeOtherTabs", "disabled", noTabsToClose);
    Tabmix.setItem("context_closeTabsToTheEnd", "disabled", cIndex == tabsCount - 1 || noTabsToClose);
    Tabmix.setItem("context_closeTabsToTheStart", "disabled",
      cIndex === 0 || aTab.pinned || Tabmix.visibleTabs.previous(aTab).pinned);

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
    if (!freezeTabMenu.hidden)
      Tabmix.setItem(freezeTabMenu, "checked", lockedTab && protectedTab);

    var lockTabMenu = document.getElementById("tm-lockTab");
    if (!lockTabMenu.hidden)
      Tabmix.setItem(lockTabMenu, "checked", lockedTab);

    var protectTabMenu = document.getElementById("tm-protectTab");
    if (!protectTabMenu.hidden)
      Tabmix.setItem(protectTabMenu, "checked", protectedTab);

    return true;
  },

  /**
   *  don't show 2 menuseparator together
   * this function is call by "popupshown" event
   * this is only for the case that other extensions popupshowing run after our TabmixContextMenu.updateTabContextMenu
   */
  contextMenuShown(event, id = event?.originalTarget?.id) {
    if (!["contentAreaContextMenu", "tabContextMenu"].includes(id)) {
      return;
    }
    const contextMenu = document.getElementById(id);
    // don't show 2 menuseparator together
    var hideNextSeparator = true, lastVisible, hideMenu = true;
    for (let mi = contextMenu.firstChild; mi; mi = mi.nextSibling) {
      if (mi.localName == "menuseparator") {
        if (!lastVisible || !hideNextSeparator) {
          mi.hidden = hideNextSeparator;
          if (!hideNextSeparator) {
            hideNextSeparator = true;
            lastVisible = mi;
          }
        } else if (hideNextSeparator) {
          if (lastVisible.getAttribute("type") == "tabmix" && mi.getAttribute("type") != "tabmix") {
            mi.hidden = false;
            lastVisible.hidden = true;
            lastVisible = mi;
          } else {
            mi.hidden = true;
          }
        }
      } else if (!mi.hidden && !mi.collapsed) {
        hideNextSeparator = false;
        hideMenu = false;
      }
    }

    // hide the last visible menuseparator if it is the last visible in the menu
    if (hideNextSeparator && lastVisible)
      lastVisible.hidden = true;

    // if all the menu are hidden don't show the popup
    if (hideMenu) {
      contextMenu.hidePopup();
    }
  },

  // Main context menu popupshowing
  updateMainContextMenu: function TMP_updateMainContextMenu(event) {
    if (!gContextMenu || event.originalTarget != document.getElementById("contentAreaContextMenu"))
      return true;

    // hide open link in window in single window mode
    Tabmix.changeCode(gContextMenu, "gContextMenu.initOpenItems")._replace(
      /context-openlink",/, '$& !Tabmix.singleWindowMode &&'
    )._replace(
      /context-openlinkprivate",/, '$& (!Tabmix.singleWindowMode || !isWindowPrivate) &&'
    ).toCode();

    Tabmix.changeCode(gContextMenu, "gContextMenu.openLinkInPrivateWindow")._replace(
      /openLinkIn\(\n*\s*this\.linkURL,\n*\s*"window",/,
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

    Tabmix.changeCode(gContextMenu, "gContextMenu.openLinkInTab")._replace(
      'userContextId:',
      'inBackground: !Services.prefs.getBoolPref("browser.tabs.loadInBackground"),\n' +
            '      $&'
    ).toCode(false, Tabmix.originalFunctions, "openInverseLink");

    Tabmix.openInverseLink = function(ev) {
      var url = Tabmix.tablib.getValidUrl();
      if (!url)
        return;

      gContextMenu.linkURL = url;
      // originalFunctions.openInverseLink is a copy of original
      // nsContextMenu.prototype.openLinkInTab
      Tabmix.originalFunctions.openInverseLink.call(gContextMenu, ev);
    };

    gContextMenu.tabmixLinks = Tabmix.contextMenuLinks;
    Tabmix.contextMenuLinks = null;

    var tab = gBrowser.selectedTab;
    try {
      var contentClick = gContextMenu.onTextInput || gContextMenu.onLink || gContextMenu.onImage;
      var tabsCount = gBrowser.tabs.length;
      var closeTabsEmpty = TMP_ClosedTabs.count < 1;
      var protectedTab = tab.hasAttribute("protected");
      var lockedTab = tab.hasAttribute("locked");

      /**
       * from Firefox 4.0 2009-09-11 there is gContextMenu.openLinkInCurrent
       * Firefox only show this menu when the selection text is url see Bug 454518
       * we check if gContextMenu.linkURL contain URL
       */
      var onLink = gContextMenu.onLink || gContextMenu.linkURL;
      Tabmix.showItem("context-openlinkincurrent", Tabmix.prefs.getBoolPref("openLinkHere") && onLink);
      var inverseLink = document.getElementById("tm-openinverselink");
      Tabmix.showItem(inverseLink, Tabmix.prefs.getBoolPref("openInverseLink") && onLink);
      if (!inverseLink.hidden) {
        let bgPref = Services.prefs.getBoolPref("browser.tabs.loadInBackground");
        let focusType = bgPref ? "fg" : "bg";
        inverseLink.setAttribute("label", inverseLink.getAttribute(focusType + "label"));
        inverseLink.setAttribute("accesskey", inverseLink.getAttribute(focusType + "accesskey"));
      }
      Tabmix.showItem("tm-linkWithhistory", Tabmix.prefs.getBoolPref("linkWithHistory") && onLink);
      var closeTabMenu = document.getElementById("tm-content-closetab");
      Tabmix.showItem(closeTabMenu, !contentClick && Tabmix.prefs.getBoolPref("closeTabContent"));
      var keepLastTab = tabsCount == 1 && Tabmix.prefs.getBoolPref("keepLastTab");
      Tabmix.setItem(closeTabMenu, "disabled", protectedTab || keepLastTab);

      // for remote tab get call getValidUrl when it is safe to use CPOWs
      // getValidUrl may call getParamsForLink
      if (tab.linkedBrowser.getAttribute("remote") == "true" &&
          onLink && (Tabmix.prefs.getBoolPref("openLinkHere") ||
                     Tabmix.prefs.getBoolPref("openInverseLink") ||
                     Tabmix.prefs.getBoolPref("linkWithHistory"))) {
        gContextMenu.tabmixLinkURL = Tabmix.tablib.getValidUrl();
      }

      var freezeTabMenu = document.getElementById("tm-content-freezeTab");
      Tabmix.showItem(freezeTabMenu, !contentClick && Tabmix.prefs.getBoolPref("freezeTabContent"));
      Tabmix.setItem(freezeTabMenu, "checked", protectedTab && lockedTab);

      var lockTabMenu = document.getElementById("tm-content-lockTab");
      Tabmix.showItem(lockTabMenu, !contentClick && Tabmix.prefs.getBoolPref("lockTabContent"));
      Tabmix.setItem(lockTabMenu, "checked", lockedTab);

      var protectTabMenu = document.getElementById("tm-content-protectTab");
      Tabmix.showItem(protectTabMenu, !contentClick && Tabmix.prefs.getBoolPref("protectTabContent"));
      Tabmix.setItem(protectTabMenu, "checked", protectedTab);

      var duplicateTabMenu = document.getElementById("tm-duplicateTabContext");
      Tabmix.showItem(duplicateTabMenu, !contentClick &&
          !gContextMenu.isTextSelected &&
          Tabmix.prefs.getBoolPref("duplicateTabContent"));

      Tabmix.showItem("tm-detachTabContext", !contentClick &&
          !gContextMenu.isTextSelected && !Tabmix.singleWindowMode &&
          Tabmix.prefs.getBoolPref("detachTabContent"));

      var duplicateWinMenu = document.getElementById("tm-duplicateinWinContext");
      Tabmix.showItem(duplicateWinMenu, !contentClick &&
          !gContextMenu.isTextSelected && !Tabmix.singleWindowMode &&
          Tabmix.prefs.getBoolPref("duplicateWinContent"));

      var tabsListMenu = document.getElementById("tm-tabsList");
      Tabmix.showItem(tabsListMenu, !contentClick && Tabmix.prefs.getBoolPref("tabsList"));

      var undoCloseTabMenu = document.getElementById("tm-content-undoCloseTab");
      var undoClose = Tabmix.prefs.getBoolPref("undoClose");
      Tabmix.showItem(undoCloseTabMenu, !contentClick &&
          !gContextMenu.isTextSelected && undoClose && !closeTabsEmpty &&
          Tabmix.prefs.getBoolPref("undoCloseTabContent"));

      var undoCloseListMenu = document.getElementById("tm-content-undoCloseList");
      Tabmix.showItem(undoCloseListMenu, !contentClick &&
          !gContextMenu.isTextSelected && undoClose && !closeTabsEmpty &&
          Tabmix.prefs.getBoolPref("undoCloseListContent"));

      var isOneWindow = Tabmix.numberOfWindows() == 1;
      var mergeMenu = document.getElementById("tm-mergeWindows");
      Tabmix.showItem(mergeMenu, !contentClick && !isOneWindow && Tabmix.prefs.getBoolPref("mergeWindowContent"));

      this._showAutoReloadMenu("tm-autoreload_menu", "autoReloadContent",
        !contentClick && !gContextMenu.isTextSelected);

      Tabmix.showItem("tm-openAllLinks",
        Tabmix.prefs.getBoolPref("openAllLinks") &&
        !TabmixContext.openMultipleLinks(true));
    } catch (ex) {
      Tabmix.assert(ex);
    }

    // show/hide menuseparator
    this.contextMenuShown(event, "contentAreaContextMenu");
    return true;
  },

  _showAutoReloadMenu: function TMP__autoReloadMenu(menuId, pref, test) {
    let showMenu = Tabmix.prefs.getBoolPref(pref) && test;
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
  }
};

Tabmix.allTabs = {
  init() {
    const allTabsButton = document.getElementById("alltabs-button");
    allTabsButton.addEventListener("click", function onClick(event) {
      if (event.button === 0 && event.detail === 1) {
        allTabsButton.removeEventListener("click", onClick);
        setTimeout(Tabmix.allTabs.insertSortButton, 0);
      }
    });
  },

  insertSortButton() {
    const sortTabsButton = document.getElementById("allTabsMenu_sortTabsButton");
    const tabsSeparator = document.getElementById("allTabsMenu-tabsSeparator");
    if (sortTabsButton.nextSibling !== tabsSeparator) {
      const searchTabs = document.getElementById("allTabsMenu-searchTabs");
      if ([...searchTabs.classList].includes("subviewbutton-iconic")) {
        sortTabsButton.classList.add("subviewbutton-iconic");
      }
      tabsSeparator.parentNode.insertBefore(sortTabsButton, tabsSeparator);

      const panel = gTabsPanel.allTabsPanel;

      panel._removeTabFromList = function(event) {
        if (event.button === 1 && Tabmix.prefs.getBoolPref("middleclickDelete")) {
          this.gBrowser.removeTab(event.target.tab, {animate: true});
        }
      };

      panel._original_createRow = panel._createRow;
      panel._createRow = function(...args) {
        const row = this._original_createRow.apply(this, args);
        row.addEventListener("click", this._removeTabFromList.bind(this));
        return row;
      };

      // eslint-disable-next-line no-unused-vars
      panel._populate = function(event) {
        let fragment = this.doc.createDocumentFragment();

        const sortTabs = () => [...this.gBrowser.tabs]
            .sort((a, b) => (a.label.toLowerCase() > b.label.toLowerCase() ? 1 : -1));
        const tabs = typeof sortTabsButton === "object" && sortTabsButton.checked ?
          sortTabs() : this.gBrowser.tabs;

        for (let tab of tabs) {
          if (this.filterFn(tab)) {
            fragment.appendChild(this._createRow(tab));
          }
        }

        this._addElement(fragment);
        this._setupListeners();
      };
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
    if (
      !Tabmix.isVersion(860) &&
      anchor.parentNode.parentNode.id === "widget-overflow-fixed-list"
    ) {
      anchor = document.getElementById("nav-bar-overflow-button");
    }

    setTimeout(() => {
      PanelUI.showSubView(
        gTabsPanel.kElements.allTabsView,
        anchor,
        event
      );
    }, 0);
  },
};

// for all tabs popup lists
var TabmixAllTabs = {
  _selectedItem: null,
  _popup: null,
  backupLabel: "",
  handleEvent: function TMP_AT_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "TabAttrModified": {
        let tab = aEvent.target;
        this._setMenuitemAttributes(tab.mCorrespondingMenuitem, tab);
        break;
      }
      case "TabClose":
        this._tabOnTabClose(aEvent);
        break;
      case "DOMMenuItemActive":
        this.updateMenuItemActive(aEvent);
        break;
      case "DOMMenuItemInactive":
        this.updateMenuItemInactive(aEvent);
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
        TMP_ClosedTabs.undoCloseTab();
        aButton.setAttribute("afterctrlclick", true);
      } else if (aButton.id == "tabmix-alltabs-button" ||
          aButton.parentNode && aButton.parentNode.id == "allTabsMenu-allTabsView") {
        BrowserCloseTabOrWindow();
        aButton.setAttribute("afterctrlclick", true);
      }
    }
  },

  isAfterCtrlClick: function TMP_isAfterCtrlClick(aButton) {
    if (aButton.hasAttribute("afterctrlclick")) {
      aButton.removeAttribute("afterctrlclick");
      if (aButton.hasAttribute("open"))
        aButton.removeAttribute("open");
      return true;
    }
    return false;
  },

  createScrollButtonTabsList: function TMP_createScrollButtonTabsList(event, side) {
    event.stopPropagation();
    event.preventDefault();

    if (event.target.disabled)
      return;

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

  removeTabFromList: function TMP_removeTabFromList(event, popup, aType) {
    if (!Tabmix.prefs.getBoolPref("middleclickDelete"))
      return;

    if (event.button == 1) {
      let aTab = event.originalTarget.tab;
      if (popup.parentNode.id == "tm-tabsList" && (aTab.selected || gBrowser.isBlankTab(gBrowser._selectedTab))) {
        popup.hidePopup();
        gBrowser.removeTab(aTab, {animate: true});
        return;
      }
      aTab._TMP_removeing = true;
      gBrowser.removeTab(aTab, {animate: true});
      if (gBrowser.tabs.length) {
        this.createTabsList(popup, aType);
      } else {
        popup.hidePopup();
      }
    }
  },

  // show sort/unsort tabs list popup after click on sorted tab menu
  showTabsListPopup: function TMP_showTabsListPopup(event) {
    event.stopPropagation();
    setTimeout(e => {
      const popup = event.target.parentNode;
      popup.openPopup(popup.parentNode, {
        position: "bottomleft topleft",
        triggerEvent: e,
      });
    }, 0, event);
  },

  createTabsList: function TMP_createTabsList(popup, aType) {
    if (this.isAfterCtrlClick(popup.parentNode))
      return false;

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
    var tabs;
    var i;

    switch (aType) {
      case 1: {
        let TabSorting = function _tabSorting(tab, index) {
          this.Tab = tab;
          this.Index = index;
        };
        TabSorting.prototype.toString = function() {
          return this.Tab.label.toLowerCase();
        };
        let visibleTabs = Tabmix.visibleTabs.tabs;
        tabs = new Array(visibleTabs.length);
        for (i = 0; i < visibleTabs.length; i++)
          tabs[i] = new TabSorting(visibleTabs[i], i);
        tabs = tabs.sort();
        for (i = 0; i < tabs.length; i++)
          this.createMenuItems(popup, tabs[i].Tab, tabs[i].Index);
        break;
      }
      case 2: {
        tabs = Tabmix.visibleTabs.tabs;
        let addToMenu = side != "right";
        for (let t = 0; t < tabs.length; t++) {
          let tab = tabs[t];
          let visible = side && Tabmix.tabsUtils.isElementVisible(tab);
          if (visible) {
            if (!tab.pinned) {
              if (side == "left") {
                break;
              }
              addToMenu = true;
            }
          } else if (addToMenu) {
            this.createMenuItems(popup, tab, t);
          }
        }
        break;
      }
      case 3: {
        for (i = TMP_LastTab.tabs.length - 1; i >= 0; i--) {
          let tab = TMP_LastTab.tabs[i];
          if (!tab.hidden) {
            this.createMenuItems(popup, tab, i);
          }
        }
        break;
      }
    }

    if (this._selectedItem)
      popup.addEventListener("popupshown", this);
  },

  _ensureElementIsVisible: function TMP__ensureElementIsVisible(event) {
    var popup = event.target;
    popup.removeEventListener("popupshown", this);
    const scrollBox = popup.scrollBox;
    let items = Array.prototype.slice.call(popup.childNodes);
    let element = items.indexOf(this._selectedItem) < popup.childElementCount / 2 ? popup.firstChild : popup.lastChild;
    scrollBox.ensureElementIsVisible(element);
    scrollBox.ensureElementIsVisible(this._selectedItem);
  },

  createMenuItems: function TMP_createMenuItems(popup, tab, value) {
    let mi = document.createXULElement("menuitem");
    mi.setAttribute("class", "menuitem-iconic bookmark-item alltabs-item");
    let url = gBrowser.getBrowserForTab(tab).currentURI.spec;
    mi.setAttribute("statustext", url);
    mi.setAttribute("tooltiptext", tab.label + "\n" + url);
    this._setMenuitemAttributes(mi, tab, value);
    if (tab.selected)
      this._selectedItem = mi;

    mi.value = value;
    tab.mCorrespondingMenuitem = mi;
    mi.tab = tab;

    popup.appendChild(mi);

    // for ColorfulTabs 6.0+
    if (typeof colorfulTabs == "object") {
      let rule = "none";
      if (window.colorfulTabs.clrAllTabsPopPref) {
        let tabClr = TabmixSessionData.getTabValue(tab, "tabClr");
        if (tabClr)
          rule = "linear-gradient(rgba(255,255,255,.7),rgba(#1,.5),rgb(#1)),linear-gradient(rgb(#1),rgb(#1))"
              .replace(/#1/g, tabClr);
      }
      mi.style.setProperty('background-image', rule, 'important');
    }
  },

  _setMenuitemAttributes(aMenuitem, aTab, value) {
    if (!aMenuitem)
      return;

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
      aMenuitem.setAttribute("busy", aTab.getAttribute("busy"));
      aMenuitem.removeAttribute("image");
    } else {
      aMenuitem.setAttribute("image", gBrowser.getIcon(aTab));
      aMenuitem.removeAttribute("busy");
    }

    if (aTab.hasAttribute("pending"))
      aMenuitem.setAttribute("pending", aTab.getAttribute("pending"));
    else
      aMenuitem.removeAttribute("pending");

    if (aTab.selected)
      aMenuitem.setAttribute("selected", "true");
    else
      aMenuitem.removeAttribute("selected");
  },

  _tabOnTabClose: function TMP__tabOnTabClose(aEvent) {
    var menuItem = aEvent.target.mCorrespondingMenuitem;
    if (menuItem) {
      menuItem.remove();
    }
  },

  _tabsListOncommand: function TMP__tabsListOncommand(aEvent) {
    if ("tab" in aEvent.originalTarget)
      this._tabSelectedFromList(aEvent.originalTarget.tab);
  },

  _tabSelectedFromList: function TMP__tabSelectedFromList(aTab) {
    if (aTab.selected)
      gBrowser.ensureTabIsVisible(aTab);
    else
      // if we select another tab _handleTabSelect will call arrowScrollbox.ensureElementIsVisible
      gBrowser.selectedTab = aTab;
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
  },

  updateMenuItemActive: function TMP_updateMenuItemActive(event, tab) {
    if (!tab)
      tab = event.target;
    this.updateStatusText(tab.getAttribute("statustext"));
  },

  updateMenuItemInactive: function TMP_updateMenuItemInactive() {
    this.updateStatusText("");
  },

  updateStatusText: function TMP_updateStatusText(itemText) {
    XULBrowserWindow.setOverLink(itemText);
  }
};
