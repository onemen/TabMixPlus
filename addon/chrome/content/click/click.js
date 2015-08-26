"use strict";

XPCOMUtils.defineLazyModuleGetter(Tabmix, "ContextMenu",
  "resource://tabmixplus/ContextMenu.jsm");

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
      if (this._blockDblClick)
        setTimeout(function(self) {self._blockDblClick = false;}, 0, this);
      return; // double click (with left button)
    }

    var target = aEvent.originalTarget;
    var anonid = target.getAttribute("anonid");
    // since Firefox 27 (bug 897751) we use tabbrowser binding handler to block
    // double click on tab close button
    this._blockDblClick = target.classList.contains("tabs-newtab-button") ||
      !Tabmix.isVersion(270) && leftClick && anonid == "tmp-close-button";

    // don't do anything if user left click on tab or tabbar button
    if (leftClick &&
        (anonid == "tmp-close-button" || aEvent.target._overPlayingIcon ||
         target.localName == "toolbarbutton")) {
      return;
    }

    // only allow middle-click on close tab button on tab to go throw as
    // middle-click on the tab
    if (aEvent.button == 1 && target.localName == "toolbarbutton" &&
        anonid != "tmp-close-button") {
      return;
    }

    var clickOutTabs = aEvent.target.localName == "tabs";
    var tab = clickOutTabs ? gBrowser.mCurrentTab : aEvent.target;

    // we replace click handler from tab binding with this to make sure that we
    // always call onMouseCommand (if we need to) before we call tab flip.
    // tabcontainer click handler run before tab click handler.
    if (leftClick && !clickOutTabs &&  !tab.mouseDownSelect)
      tab.onMouseCommand(aEvent);

    // for tab flip
    if (!clickOutTabs && leftClick && tab.hasAttribute("clickOnCurrent")) {
      tab.removeAttribute("clickOnCurrent");
      let tabFlip = Tabmix.prefs.getBoolPref("tabFlip");
      if (tabFlip && !aEvent.shiftKey && !aEvent.ctrlKey && !aEvent.altKey && !aEvent.metaKey){
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

    var prefName;
    /* middle click*/
    if (aEvent.button == 1)
      prefName = "middle";
    /* shift click*/
    else if (leftClick && aEvent.shiftKey && !aEvent.ctrlKey &&
        !aEvent.altKey && !aEvent.metaKey) {
      prefName = "shift";
    }
    /* alt click*/
    else if (leftClick && aEvent.altKey && !aEvent.ctrlKey &&
        !aEvent.shiftKey && !aEvent.metaKey) {
      prefName = "alt";
      window.addEventListener("keyup", function TMP_onKeyup_onTabClick(aEvent) {
        aEvent.currentTarget.removeEventListener("keyup", TMP_onKeyup_onTabClick, true);
        aEvent.stopPropagation();
      }, true);
    }
    /* ctrl click*/
    else if (leftClick && (aEvent.ctrlKey && !aEvent.metaKey ||
        !aEvent.ctrlKey && aEvent.metaKey) && !aEvent.shiftKey && !aEvent.altKey) {
      prefName = "ctrl";
    }

    if (prefName)
      this.clickAction(prefName, clickOutTabs, tab, aEvent);
  },

  clearTabFlipTimeOut: function() {
    clearTimeout(this._tabFlipTimeOut);
    this._tabFlipTimeOut = null;
  },

  // Double click on tab/tabbar
  onTabBarDblClick: function TMP_onTabBarDblClick(aEvent) {
    if (!aEvent || aEvent.button !== 0 || aEvent.ctrlKey || aEvent.shiftKey ||
        aEvent.altKey || aEvent.metaKey) {
      return;
    }

    var target = aEvent.originalTarget;
    var anonid = target.getAttribute("anonid");
    // don't do anything if user left click on tab or tabbar button
    if (anonid == "tmp-close-button" || aEvent.target._overPlayingIcon ||
        target.localName == "toolbarbutton") {
      return;
    }

    // See hack note in the tabbrowser-close-tab-button binding
    // if we are here the target is not closeTabButton or newtabButton
    if (gBrowser.tabContainer._blockDblClick || this._blockDblClick) {
      aEvent.preventDefault();
      return;
    }

    var clickOutTabs = aEvent.target.localName == "tabs";

    var tab = clickOutTabs ? gBrowser.mCurrentTab : aEvent.target;
    this.clickAction("dbl", clickOutTabs, tab, aEvent);
  },

  // call action function from click on tabs or tabbar
  clickAction: function TMP_clickAction(pref, clickOutTabs, aTab, event) {
    if (!pref) return; // just in case we missed something
    pref += clickOutTabs ? "ClickTabbar" : "ClickTab";
    var command = Tabmix.prefs.getIntPref(pref);
    if (command > -1 && this.doCommand(command, aTab, clickOutTabs)) {
      event.stopPropagation();
      event.preventDefault();
    }
  },

///add option to open new tab after current one
/// convert this switch to object
  doCommand: function TMP_doCommand(command, aTab, clickOutTabs) {
    gBrowser.selectedBrowser.focus();
    switch (command) {
      case 0 :
        break;
      case 1 :
        BrowserOpenTab();
        break;
      case 2 :
        if (aTab && aTab.parentNode)
          gBrowser.removeTab(aTab, {animate: true, byMouse: true});
        break;
      case 3 :
        gBrowser.duplicateTab(aTab);
        break;
      case 4 :
        if (aTab.linkedBrowser.__SS_restoreState != 2)
          gBrowser.reloadTab(aTab);
        break;
      case 5 :
        gBrowser.protectTab(aTab);
        break;
      case 6 :
        gBrowser.lockTab(aTab);
        break;
      case 7 :
        tablib.reloadTabs(gBrowser.visibleTabs);
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
      case 12: //taken from tco
        if (SessionSaver && SessionSaver.snapBackTab)
          SessionSaver.snapBackTab(SessionSaver.snapback_noFX, SessionSaver.snapback_willFocus);
        break;
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
        gBrowser._closeLeftTabs(aTab);
        break;
      case 18:
        gBrowser._closeRightTabs(aTab);
        break;
      case 19:
        gBrowser._reloadLeftTabs(aTab);
        break;
      case 20:
        gBrowser._reloadRightTabs(aTab);
        break;
      case 21: // taken from tco
        var href;
        if (window.IeView && window.IeView.ieViewLaunch) {
          href = gBrowser.getBrowserForTab(aTab).currentURI.spec;
          IeView.ieViewLaunch("Internet Explorer.lnk", href);
        }
        else if (Tabmix.extensions.gIeTab) {
          let ieTab = Tabmix.extensions.gIeTab;
          let gIeTabObj = window[ieTab.obj];
          if (typeof gIeTabObj.switchTabEngine == "function") {
            if (!aTab.selected)
              gBrowser.selectedTab = aTab;
            gIeTabObj.switchTabEngine(aTab, gIeTabObj.getBoolPref(ieTab.folder + ".alwaysNewTab", false));
          }
        }
        else if(window.ieview && window.ieview.launch) {
          href = gBrowser.getBrowserForTab(aTab).currentURI.spec;
          ieview.launch(href);
        }
        break;
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
        var event = document.createEvent("Events");
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
      default:
        return false;
    }
    return true;
  },

  toggleEventListener: function(enable) {
    let eventListener = enable ? "addEventListener" : "removeEventListener";
    document.getElementById("TabsToolbar")[eventListener]("dblclick", this.blockDblclick, false);
  },

  /**
   * block dblclick on TabsToolbar when tabbar.dblclick_changesize is false
   * and tabbar.click_dragwindow is true
   */
  blockDblclick: function(aEvent) {
    if (aEvent.button !== 0 || aEvent.target.localName == "tabs" ||
        Tabmix.prefs.getBoolPref("tabbar.dblclick_changesize") ||
        !Tabmix.prefs.getBoolPref("tabbar.click_dragwindow"))
      return;

    aEvent.preventDefault();
  }
};

var TabmixContext = {
  _closeRightTabs: "tm-closeRightTabs",
  // Create new items in the tab bar context menu
  buildTabContextMenu: function TMP_buildTabContextMenu() {
    var $id = function(id) document.getElementById(id);

    var tabContextMenu = $id("tabContextMenu");
    tabContextMenu.insertBefore($id("context_reloadTab"), $id("tm-autoreloadTab_menu"));
    tabContextMenu.insertBefore($id("context_openTabInWindow"), $id("context_pinTab"));
    tabContextMenu.insertBefore($id("context_bookmarkAllTabs"), $id("context_bookmarkTab").nextSibling);
    tabContextMenu.insertBefore($id("context_closeTab"), $id("tm-closeAllTabs"));
    tabContextMenu.insertBefore($id("context_closeOtherTabs"), $id("tm-closeLeftTabs"));
    // we can't disable menus with command attribute
    $id("context_undoCloseTab").removeAttribute("command");

    if (Tabmix.isVersion(320)) {
      let openNonRemote = $id("context_openNonRemoteWindow");
      if (openNonRemote)
        tabContextMenu.insertBefore(openNonRemote, $id("context_openTabInWindow").nextSibling);
    }

    // insret IE Tab menu-items before Bookmakrs menu-items
    if ("gIeTab" in window) { // no need to do this fix for IE Tab 2
      var aFunction = "createTabbarMenu" in IeTab.prototype ? "createTabbarMenu" : "init";
      if (aFunction in IeTab.prototype) {
        Tabmix.changeCode(IeTab.prototype, "IeTab.prototype." + aFunction)._replace(
             'tabbarMenu.insertBefore(document.getElementById("ietab-tabbar-sep"), separator);',
             'separator = document.getElementById("tm-separator-3"); $&'
        ).toCode();
      }
    }

    // fix conflict with CookiePie extension
    if ("cookiepieContextMenu" in window && !cookiepieContextMenu.initialized)
      cookiepieContextMenu.init();

    // Bug 866880 - Implement "Close Tabs to the Right" as a built-in feature
    if (Tabmix.isVersion(240)) {
      let closeTabsToTheEnd = $id("context_closeTabsToTheEnd");
      tabContextMenu.insertBefore(closeTabsToTheEnd, $id("tm-closeRightTabs"));
      Tabmix.setItem(closeTabsToTheEnd, "oncommand", "gBrowser._closeRightTabs(TabContextMenu.contextTab);");
      tabContextMenu.removeChild($id("tm-closeRightTabs"));
      this._closeRightTabs = "context_closeTabsToTheEnd";
    }

    if (Tabmix._restoreMultipleTabs) {
      let multipletablabel = $id("context_undoCloseTab").getAttribute("multipletablabel");
      let undoCloseTabMenu = $id("tm-content-undoCloseTab");
      undoCloseTabMenu.setAttribute("singletablabel", undoCloseTabMenu.label);
      undoCloseTabMenu.setAttribute("multipletablabel", multipletablabel);
    }

    if (Tabmix.prefs.getBoolPref("showTabContextMenuOnTabbar"))
      this.updateTabbarContextMenu(true);

    // move tm-content-miscSep to its place (Firefox 32+)
    let sep = $id("tm-content-miscSep");
    sep.parentNode.insertBefore(sep, $id("tm-content-closetab"));
  },

  updateTabbarContextMenu: function(show) {
    let tabBar = gBrowser.tabContainer;
    if (show) {
      this._originalTabbarContextMenu = tabBar.getAttribute("context");
      tabBar.setAttribute("context", gBrowser.tabContextMenu.id);
    }
    else
      Tabmix.setItem(tabBar, "context", this._originalTabbarContextMenu || null);
  },

  toggleEventListener: function(enable) {
    var eventListener = enable ? "addEventListener" : "removeEventListener";
    document.getElementById("contentAreaContextMenu")[eventListener]("popupshowing", this, false);
    gBrowser.tabContextMenu[eventListener]("popupshowing", this, false);
    gBrowser.tabContextMenu[eventListener]("popupshown", this, false);
  },

  handleEvent: function(aEvent) {
    let id = aEvent.target.id;
    switch (aEvent.type) {
      case "popupshowing":
        if (id == "tabContextMenu")
          this.updateTabContextMenu(aEvent);
        else if (id == "contentAreaContextMenu")
          this.updateMainContextMenu(aEvent);
        break;
      case "popupshown":
        this.tabContextMenuShown(aEvent);
        break;
      case "popuphidden":
        if (id == "tabContextMenu") {
          aEvent.target.removeEventListener("popuphidden", this, false);
          Tabmix.hidePopup(aEvent.target);
        }
        break;
    }
  },

  // Tab context menu popupshowing
  updateTabContextMenu: function TMP_updateTabContextMenu(event) {
    if (event.originalTarget != gBrowser.tabContextMenu)
      return true;

    gBrowser.tabContextMenu.addEventListener("popuphidden", this, false);

    var item, triggerNode = gBrowser.tabContextMenu.triggerNode;
    if (triggerNode.parentNode)
      item = triggerNode.parentNode.id;
    if (item && (item == "btn_tabslist_menu" || item == "alltabs-popup"))
      TabContextMenu.contextTab = triggerNode.tab;

    var clickOutTabs = triggerNode.localName == "tabs";
    var aTab = clickOutTabs ? gBrowser.selectedTab : TabContextMenu.contextTab;

    var isOneWindow = Tabmix.numberOfWindows() == 1;

    var newTab = document.getElementById("context_newTab");
    Tabmix.showItem(newTab, Tabmix.prefs.getBoolPref("newTabMenu"));
    if (clickOutTabs) {
      Tabmix.setItem(newTab, "label", newTab.getAttribute("_newtab"));
      Tabmix.setItem(newTab, "oncommand", "TMP_BrowserOpenTab();");
    }
    else {
      Tabmix.setItem(newTab, "label", newTab.getAttribute("_newtab") + "  " + newTab.getAttribute("_afterthis"));
      Tabmix.setItem(newTab, "oncommand", "TMP_BrowserOpenTab(TabContextMenu.contextTab);");
    }

    // Duplicate Commands
    Tabmix.showItem("tm-duplicateTab", Tabmix.prefs.getBoolPref("duplicateMenu"));
    Tabmix.showItem("tm-duplicateinWin", Tabmix.prefs.getBoolPref("duplicateinWinMenu") && !Tabmix.singleWindowMode);
    Tabmix.showItem("context_openTabInWindow", Tabmix.prefs.getBoolPref("detachTabMenu") && !Tabmix.singleWindowMode);
    if (Tabmix.isVersion(320)) {
      Tabmix.showItem("context_openNonRemoteWindow",
                      Tabmix.prefs.getBoolPref("tabcontext.openNonRemoteWindow") &&
                      !Tabmix.singleWindowMode && gMultiProcessBrowser);
    }

    var show = Tabmix.prefs.getBoolPref("pinTabMenu");
    Tabmix.showItem("context_pinTab", show && !aTab.pinned);
    Tabmix.showItem("context_unpinTab", show && aTab.pinned);
    Tabmix.showItem("context_tabViewMenu", Tabmix.prefs.getBoolPref("moveToGroup") && !aTab.pinned);
    Tabmix.showItem("tm-mergeWindowsTab",
                    Tabmix.prefs.getBoolPref("showMergeWindow") &&
                    (!Tabmix.singleWindowMode ||
                    (Tabmix.singleWindowMode && !isOneWindow)));
    var showRenameTabMenu = Tabmix.prefs.getBoolPref("renameTabMenu");
    Tabmix.showItem("tm-renameTab", showRenameTabMenu);
    Tabmix.showItem("tm-copyTabUrl", Tabmix.prefs.getBoolPref("copyTabUrlMenu"));

    //  ---------------- menuseparator ---------------- //

    // Reload Commands
    Tabmix.showItem("context_reloadTab", Tabmix.prefs.getBoolPref("reloadTabMenu"));
    Tabmix.showItem("context_reloadAllTabs", Tabmix.prefs.getBoolPref("reloadAllMenu"));
    this._showAutoReloadMenu("tm-autoreloadTab_menu", "autoReloadMenu", true);
    Tabmix.showItem("tm-reloadRight", Tabmix.prefs.getBoolPref("reloadRightMenu"));
    Tabmix.showItem("tm-reloadLeft", Tabmix.prefs.getBoolPref("reloadLeftMenu"));
    Tabmix.showItem("tm-reloadOther", Tabmix.prefs.getBoolPref("reloadOtherMenu"));

    //  ---------------- menuseparator ---------------- //

    var undoClose = Tabmix.prefs.getBoolPref("undoClose");
    Tabmix.showItem("context_undoCloseTab", Tabmix.prefs.getBoolPref("undoCloseTabMenu") && undoClose);
    Tabmix.showItem("tm-undoCloseList", Tabmix.prefs.getBoolPref("undoCloseListMenu") && undoClose);

    //  ---------------- menuseparator ---------------- //

    // Close tab Commands
    var pinnedTab = TabContextMenu.contextTab.pinned;
    Tabmix.showItem("context_closeTab", Tabmix.prefs.getBoolPref("closeTabMenu"));
    Tabmix.showItem("tm-closeAllTabs", Tabmix.prefs.getBoolPref("closeAllMenu") && !pinnedTab);
    Tabmix.showItem("tm-closeSimilar", Tabmix.prefs.getBoolPref("closeSimilarTabs") && !pinnedTab);
    Tabmix.showItem("context_closeOtherTabs", Tabmix.prefs.getBoolPref("closeOtherMenu") && !pinnedTab);
    Tabmix.showItem("tm-closeLeftTabs", Tabmix.prefs.getBoolPref("closeLeftMenu") && !pinnedTab);
    Tabmix.showItem(this._closeRightTabs, Tabmix.prefs.getBoolPref("closeRightMenu") && !pinnedTab);

    //  ---------------- menuseparator ---------------- //

    Tabmix.showItem("tm-docShell", Tabmix.prefs.getBoolPref("docShellMenu"));
    Tabmix.showItem("tm-freezeTab", Tabmix.prefs.getBoolPref("freezeTabMenu"));
    Tabmix.showItem("tm-protectTab", Tabmix.prefs.getBoolPref("protectTabMenu"));
    Tabmix.showItem("tm-lockTab", Tabmix.prefs.getBoolPref("lockTabMenu"));

    //  ---------------- menuseparator ---------------- //

    Tabmix.showItem("context_bookmarkTab", Tabmix.prefs.getBoolPref("bookmarkTabMenu"));
    Tabmix.showItem("context_bookmarkAllTabs", Tabmix.prefs.getBoolPref("bookmarkTabsMenu"));

    // we call this again when popupshown to make sure we don't show 2 menuseparator together
    TabmixContext.tabContextMenuShown(event);

    if (showRenameTabMenu) {
      // disabled rename if the title not ready yet
      let titleNotReady;
      if (aTab.hasAttribute("busy")) {
        let browser = gBrowser.getBrowserForTab(aTab);
        let url = browser.currentURI.spec;
        let docTitle = TMP_Places.getTitleFromBookmark(url, browser.contentTitle, null, aTab);
        if (!docTitle || docTitle == gBrowser.mStringBundle.getString("tabs.emptyTabTitle"))
          titleNotReady = true;
      }
      Tabmix.setItem("tm-renameTab", "disabled", titleNotReady);
    }

    var protectedTab = aTab.hasAttribute("protected");
    var lockedTab = aTab.hasAttribute("locked");
    var tabsCount = gBrowser.visibleTabs.length;
    var unpinnedTabs = tabsCount - TabmixTabbar._real_numPinnedTabs;
    var cIndex = Tabmix.visibleTabs.indexOf(aTab);
    if (Tabmix.rtl)
      cIndex = tabsCount - 1 - cIndex;

    var keepLastTab = tabsCount == 1 && Tabmix.prefs.getBoolPref("keepLastTab");
    Tabmix.setItem("context_closeTab", "disabled", protectedTab || keepLastTab);
    Tabmix.setItem("tm-closeAllTabs", "disabled", keepLastTab || unpinnedTabs <= 1);
    Tabmix.setItem("context_closeOtherTabs", "disabled", unpinnedTabs <= 1);
    Tabmix.setItem(this._closeRightTabs, "disabled", cIndex == tabsCount - 1 || unpinnedTabs <= 1);
    Tabmix.setItem("tm-closeLeftTabs", "disabled", cIndex === 0 || unpinnedTabs <= 1);

    var closeTabsEmpty = TMP_ClosedTabs.count < 1;
    Tabmix.setItem("context_undoCloseTab", "disabled", closeTabsEmpty);
    Tabmix.setItem("tm-undoCloseList", "disabled", closeTabsEmpty);

    Tabmix.setItem("context_openTabInWindow", "disabled", tabsCount == 1);
    Tabmix.setItem("tm-mergeWindowsTab", "disabled", isOneWindow);

    Tabmix.setItem("tm-reloadRight", "disabled", tabsCount == 1 || cIndex == tabsCount - 1);
    Tabmix.setItem("tm-reloadLeft", "disabled", tabsCount == 1 || cIndex === 0);
    Tabmix.setItem("tm-reloadOther", "disabled", tabsCount == 1);
    Tabmix.setItem("context_reloadAllTabs", "disabled", tabsCount == 1);

    Tabmix.setItem("tm-docShell", "disabled", clickOutTabs);

    var freezeTabMenu = document.getElementById("tm-freezeTab");
    if ( !freezeTabMenu.hidden )
      Tabmix.setItem(freezeTabMenu, "checked", lockedTab && protectedTab);

    var lockTabMenu = document.getElementById("tm-lockTab");
    if ( !lockTabMenu.hidden )
      Tabmix.setItem(lockTabMenu, "checked", lockedTab);

    var protectTabMenu = document.getElementById("tm-protectTab");
    if ( !protectTabMenu.hidden )
      Tabmix.setItem(protectTabMenu, "checked", protectedTab);

    return true;
  },

  /**
   *  don't show 2 menuseparator together
   * this function is call by "popupshown" event
   * this is only for the case that other extensions popupshowing run after our TabmixContextMenu.updateTabContextMenu
   */
  tabContextMenuShown: function TMP_tabContextMenuShown(event) {
    var tabContextMenu = gBrowser.tabContextMenu;
    if (event.originalTarget != tabContextMenu)
      return;
    // don't show 2 menuseparator together
    var hideNextSeparator = true, lastVisible, hideMenu = true;
    for(var mi = tabContextMenu.firstChild; mi; mi = mi.nextSibling) {
      if (mi.localName == "menuseparator") {
        if (!lastVisible || !hideNextSeparator) {
          mi.hidden = hideNextSeparator;
          if (!hideNextSeparator) {
            hideNextSeparator = true;
            lastVisible = mi;
          }
        }
        else if (hideNextSeparator) {
          if (lastVisible.getAttribute("type")=="tabmix" && mi.getAttribute("type")!="tabmix") {
            mi.hidden = false;
            lastVisible.hidden = true;
            lastVisible = mi;
          }
          else
            mi.hidden = true;
        }
      }
      else if(!mi.hidden && !mi.collapsed) {
        hideNextSeparator = false;
        hideMenu = false;
      }
    }

    // hide the last visible menuseparator if it is the last visible in the menu
    if (hideNextSeparator && lastVisible)
      lastVisible.hidden = true;

    // if all the menu are hidden don't show the popup
    if (hideMenu)
      tabContextMenu.hidePopup();
  },

  // Main context menu popupshowing
  updateMainContextMenu: function TMP_updateMainContextMenu(event) {
    if (!gContextMenu || event.originalTarget != document.getElementById("contentAreaContextMenu"))
      return true;

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
      * we cahck if gContextMenu.linkURL contain URL
      */
      var onLink = gContextMenu.onLink || gContextMenu.linkURL;
      Tabmix.showItem("context-openlinkincurrent", Tabmix.prefs.getBoolPref("openLinkHere") && onLink);
      var inverseLink = document.getElementById("tm-openinverselink");
      Tabmix.showItem(inverseLink, Tabmix.prefs.getBoolPref("openInverseLink") && onLink);
      if (!inverseLink.hidden){
        let bgPref = Services.prefs.getBoolPref("browser.tabs.loadInBackground");
        let focusType = bgPref ? "fg":"bg";
        inverseLink.setAttribute("label", inverseLink.getAttribute(focusType+"label"));
        inverseLink.setAttribute("accesskey", inverseLink.getAttribute(focusType+"accesskey"));
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
        let {target, linkURL} = gContextMenu;
        gContextMenu.tabmixLinkURL = tablib.getValidUrl(linkURL, target);
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
      if (Tabmix._restoreMultipleTabs) {
        let closedTabCount = TabmixSvc.ss.getNumberOfTabsClosedLast(window);
        let visibleLabel = closedTabCount <= 1 ? "singletablabel" : "multipletablabel";
        undoCloseTabMenu.setAttribute("label", undoCloseTabMenu.getAttribute(visibleLabel));
      }

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

      // show/hide menuseparator
      var undoCloseSep = document.getElementById("tm-content-undoCloseSep");
      var miscSep = document.getElementById("tm-content-miscSep");
      var textSep = document.getElementById("tm-content-textSep");
      undoCloseSep.hidden = undoCloseTabMenu.hidden && undoCloseListMenu.hidden ||
          gContextMenu.isTextSelected && closeTabMenu.hidden && lockTabMenu.hidden &&
          protectTabMenu.hidden && tabsListMenu.hidden  && freezeTabMenu.hidden;
      miscSep.hidden = mergeMenu.hidden && closeTabMenu.hidden && duplicateTabMenu.hidden &&
          duplicateWinMenu.hidden && lockTabMenu.hidden && protectTabMenu.hidden &&
          tabsListMenu.hidden  && freezeTabMenu.hidden || gContextMenu.isTextSelected;
      textSep.hidden = !gContextMenu.isTextSelected || mergeMenu.hidden &&
          duplicateTabMenu.hidden && duplicateWinMenu.hidden && closeTabMenu.hidden &&
          lockTabMenu.hidden && protectTabMenu.hidden && tabsListMenu.hidden &&
          freezeTabMenu.hidden && undoCloseTabMenu.hidden && undoCloseListMenu.hidden;

    } catch (ex) {Tabmix.assert(ex);}
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
    let urls = [];
    let browser = window.gBrowser.selectedBrowser;

    function getLinks() {
      try {
        let handler = TabmixSvc.syncHandlers.get(browser.permanentKey);
        let result = handler.getSelectedLinks();
        gContextMenu.tabmixLinks = result && result.split('\n');
      } catch(ex) {
        Tabmix.log("unable to get syncHandlers for page " +
                   browser.currentURI.spec + "\n" + ex);
      }
      return gContextMenu.tabmixLinks || [];
    }

    if (Tabmix.isVersion(320))
      urls = gContextMenu.tabmixLinks || getLinks();
    // getSelectedLinks was not implemented for remote tabs before Firefox 32
    else if (browser.getAttribute("remote") != "true")
      urls = Tabmix.ContextMenu.getSelectedLinks(content, check);

    if (!check && urls.length) {
      Tabmix.loadTabs(urls, false);
    }
    return urls.length === 0;
  }
};

// for all tabs popup lists
var TabmixAllTabs = {
  _selectedItem: null,
  _popup: null,
  backupLabel: "",
  handleEvent: function TMP_AT_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "TabAttrModified":
        let tab = aEvent.target;
        this._setMenuitemAttributes(tab.mCorrespondingMenuitem, tab);
        break;
      case "TabClose":
        this._tabOnTabClose(aEvent);
        break;
      case "DOMMenuItemActive":
        this.updateMenuItemActive(aEvent);
        break;
      case "DOMMenuItemInactive":
        this.updateMenuItemInactive(aEvent);
        break;
      case "DOMMouseScroll":
        TMP_eventListener.onTabBarScroll(aEvent);
        /* falls through */
      case "scroll":
        this._popup._updateTabsVisibilityStatus();
        break;
      case "popupshown":
        this._ensureElementIsVisible(aEvent);
        break;
    }
  },

  _updateTabsVisibilityStatus: function TMP__updateTabsVisibilityStatus() {
    var tabContainer = gBrowser.tabContainer;
    // We don't want menu item decoration unless there is overflow.
    if (tabContainer.getAttribute("overflow") != "true")
      return;

    for (var i = 0; i < this.childNodes.length; i++) {
      let curTab = this.childNodes[i].tab;
      if (!curTab) // "Tab Groups" menuitem and its menuseparator
        continue;
      let curTabBO = curTab.boxObject;
      if (!curTabBO) // "Tabs From Other Computers" menuitem
        continue;
      if (Tabmix.tabsUtils.isElementVisible(curTab))
        this.childNodes[i].setAttribute("tabIsVisible", "true");
      else
        this.childNodes[i].removeAttribute("tabIsVisible");
    }
  },

  checkForCtrlClick: function TMP_checkForCtrlClick(aEvent) {
    var aButton = aEvent.target;
    if (!aButton.disabled && aEvent.button === 0 && (aEvent.ctrlKey || aEvent.metaKey)) {
      if (aButton.id == "btn_undoclose")
        TMP_ClosedTabs.undoCloseTab();
      else
        BrowserCloseTabOrWindow();

      aButton.setAttribute("afterctrlclick", true);
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

    var tablist =  document.getElementById("tabslist");

    this.beforeCommonList(tablist);
    this.createCommonList(tablist, 2, side);

    if (tablist.hasChildNodes())
      tablist.showPopup(event.target, -1, -1, "popup", "bottomleft","topleft");
  },

  removeTabFromList: function TMP_removeTabFromList(event, popup, aType) {
    if (!Tabmix.prefs.getBoolPref("middleclickDelete"))
      return;

    if (event.target.id == "btn_tabslistSorted")
      return;

    if (event.button == 1) {
      let aTab = event.originalTarget.tab;
      if (popup.parentNode.id == "tm-tabsList" && (aTab.selected || gBrowser.isBlankTab(gBrowser.mCurrentTab))) {
        popup.hidePopup();
        gBrowser.removeTab(aTab, {animate: true});
        return;
      }
      aTab._TMP_removeing = true;
      gBrowser.removeTab(aTab, {animate: true});
      if (gBrowser.tabs.length > 0) {
        this.createTabsList(popup, aType);
        let item = popup.parentNode.parentNode;
        if (item.parentNode.id == "btn_tabslist")
          this.createTabsList(item, aType);
      }
      else popup.hidePopup();
    }
  },

  // show sort/unsort tabs list popup after click on sorted tab menu
  showTabsListPopup: function TMP_showTabsListPopup(event) {
    event.stopPropagation();
    setTimeout( function (popup){
      popup.showPopup(popup.parentNode, -1, -1, "popup", "bottomleft", "topleft");
    }, 0, event.target.parentNode);
  },

  createTabsList: function TMP_createTabsList(popup, aType) {
    if (this.isAfterCtrlClick(popup.parentNode))
      return false;

    var tabContextMenu = gBrowser.tabContextMenu;
    if (popup.hasAttribute("context") && popup.getAttribute("context") != tabContextMenu.id)
      popup.setAttribute("context", tabContextMenu.id);

    this.beforeCommonList(popup);
    this.createCommonList(popup, aType);

    // for firefox 22+ when layout.css.devPixelsPerPx > 1
    // and user middle-click to close last visible tab
    if (popup.id == "btn_tabslist_menu" && gBrowser.visibleTabs.length == 1) {
      popup.setAttribute("minheight", popup.boxObject.height);
      popup.setAttribute("minwidth", popup.boxObject.width);
    }

    gBrowser.tabContainer.mTabstrip.addEventListener("scroll", this, false);
    this._popup = popup;
    if (!this._popup._updateTabsVisibilityStatus)
      this._popup._updateTabsVisibilityStatus = this._updateTabsVisibilityStatus;
    this._popup._updateTabsVisibilityStatus();

    return true;
  },

  beforeCommonList: function TMP_beforeCommonList(popup, aCloseTabsPopup) {
    var item = popup.parentNode;
    if (item.id == "btn_tabslist" || item.id == "btn_undoclose")
      item.removeAttribute("tooltiptext");

    // clear out the menu popup if we show the popup after middle click
    while (popup.hasChildNodes()) {
      var menuItem = popup.firstChild;
      if (menuItem.id.indexOf("btn_tabslist") != -1)
        break;
      menuItem.removeEventListener("click", TMP_ClosedTabs.checkForMiddleClick, false);
      popup.removeChild(menuItem);
    }

    if (!aCloseTabsPopup) {
      gBrowser.tabContainer.addEventListener("TabAttrModified", this, false);
      gBrowser.tabContainer.addEventListener("TabClose", this, false);
    }
    popup.addEventListener("DOMMenuItemActive", this, false);
    popup.addEventListener("DOMMenuItemInactive", this, false);
  },

  createCommonList: function TMP_createCommonList(popup, aType, side) {
    var tabs;
    var i;

    switch(aType) {
      case 1:
        let TabSorting = function _tabSorting(tab, index) {
          this.Tab = tab;
          this.Index = index;
        };
        TabSorting.prototype.toString = function() {
          return this.Tab.label.toLowerCase();
        };
        let visibleTabs = gBrowser.visibleTabs;
        tabs = new Array(visibleTabs.length);
        for (i = 0; i < visibleTabs.length; i++)
          tabs[i] = new TabSorting(visibleTabs[i], i);
        tabs = tabs.sort();
        for (i = 0; i < tabs.length; i++)
          this.createMenuItems(popup, tabs[i].Tab, tabs[i].Index);
        break;
      case 2:
        tabs = gBrowser.visibleTabs;
        let addToMenu = side != "right";
        for (let t = 0; t < tabs.length; t++) {
          let tab = tabs[t];
          let visible = side && Tabmix.tabsUtils.isElementVisible(tab);
          if (visible) {
            if (tab.pinned)
              continue;
            else if (side == "left")
              break;
            addToMenu = true;
            continue;
          }
          if (addToMenu)
            this.createMenuItems(popup, tab, t);
        }
        break;
      case 3:
        for (i = TMP_LastTab.tabs.length - 1; i >= 0; i--) {
          let tab = TMP_LastTab.tabs[i];
          if (tab.hidden)
            continue;
          this.createMenuItems(popup, tab, i);
        }
        break;
    }

    if (this._selectedItem)
      popup.addEventListener("popupshown", this, false);
  },

  _ensureElementIsVisible: function TMP__ensureElementIsVisible(event) {
    var popup = event.target;
    popup.removeEventListener("popupshown", this, false);
    let scrollBox = document.getAnonymousElementByAttribute(popup, "class", "popup-internal-box");
    let items = Array.slice(popup.childNodes);
    let element = items.indexOf(this._selectedItem) < popup.childElementCount/2 ? popup.firstChild : popup.lastChild;
    scrollBox.ensureElementIsVisible(element);
    scrollBox.ensureElementIsVisible(this._selectedItem);
  },

  createMenuItems: function TMP_createMenuItems(popup, tab, value) {
    let mi = document.createElement("menuitem");
    mi.setAttribute("class", "menuitem-iconic bookmark-item alltabs-item");
    let url = gBrowser.getBrowserForTab(tab).currentURI.spec;
    mi.setAttribute("statustext", url);
    mi.setAttribute("tooltiptext", tab.label + "\n" + url);
    let count = "";
    if (Tabmix.ltr) {
      count = (value<9 ? "  " : "") + (value + 1) + ": ";
      mi.setAttribute("count", count);
    }
    this._setMenuitemAttributes(mi, tab);
    if (tab.selected)
      this._selectedItem = mi;

    mi.value = value;
    tab.mCorrespondingMenuitem = mi;
    mi.tab = tab;

    if (popup.id == "btn_tabslist_menu")
      popup.insertBefore(mi, document.getElementById("btn_tabslist_sep"));
    else
      popup.appendChild(mi);

    // for ColorfulTabs 6.0+
    if (typeof colorfulTabs == "object") {
      let rule = "none";
      if (colorfulTabs.clrAllTabsPopPref) {
        let tabClr = TabmixSessionData.getTabValue(tab, "tabClr");
        if (tabClr)
          rule = "linear-gradient(rgba(255,255,255,.7),rgba(#1,.5),rgb(#1)),linear-gradient(rgb(#1),rgb(#1))"
                 .replace(/#1/g, tabClr);
      }
      mi.style.setProperty('background-image', rule, 'important');
    }
  },

  _setMenuitemAttributes: function TMP__setMenuitemAttributes(aMenuitem, aTab) {
    if (!aMenuitem)
      return;

    aMenuitem.setAttribute("label", aMenuitem.getAttribute("count") + aTab.label);
    aMenuitem.setAttribute("crop", aTab.getAttribute("crop"));

    if (aTab.hasAttribute("busy")) {
      aMenuitem.setAttribute("busy", aTab.getAttribute("busy"));
      aMenuitem.removeAttribute("image");
    }
    else {
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
    if (menuItem && menuItem.parentNode)
      menuItem.parentNode.removeChild(menuItem);
  },

  _tabsListOncommand: function TMP__tabsListOncommand(aEvent) {
    if ("tab" in aEvent.originalTarget)
      this._tabSelectedFromList(aEvent.originalTarget.tab);
  },

  _tabSelectedFromList: function TMP__tabSelectedFromList(aTab) {
    if (aTab.selected)
      gBrowser.ensureTabIsVisible(aTab);
    else
      // if we select another tab _handleTabSelect will call mTabstrip.ensureElementIsVisible
      gBrowser.selectedTab = aTab;
  },

  hideCommonList: function TMP_hideCommonList(popup) {
    // clear out the menu popup and remove the listeners
    while (popup.hasChildNodes()) {
      var menuItem = popup.firstChild;
      if (menuItem.id.indexOf("btn_tabslist") != -1)
        break;
      if ("tab" in menuItem) {
        menuItem.tab.mCorrespondingMenuitem = null;
      }
      popup.removeChild(menuItem);
    }

    var item = popup.parentNode;
    if (item.id == "btn_tabslist" || item.id == "btn_undoclose")
      item.setAttribute('tooltiptext', item.getAttribute('_tooltiptext'));

    if (popup.id == "btn_tabslist_menu") {
      popup.removeAttribute("minheight");
      popup.removeAttribute("minwidth");
    }

    gBrowser.tabContainer.removeEventListener("TabAttrModified", this, false);
    gBrowser.tabContainer.mTabstrip.removeEventListener("scroll", this, false);
    gBrowser.tabContainer.removeEventListener("TabClose", this, false);
    popup.removeEventListener("DOMMenuItemActive", this, false);
    popup.removeEventListener("DOMMenuItemInactive", this, false);

    this.backupLabel = "";
    this._selectedItem = null;
    popup._updateTabsVisibilityStatus = null;
    this._popup = null;
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
