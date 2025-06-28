"use strict";

(async function () {
  await window.Tabmix.promiseOverlayLoaded;

  const menuToolsPopup = document.getElementById("menu_ToolsPopup");
  menuToolsPopup?.addEventListener(
    "popupshowing",
    () => {
      document
        .getElementById("tabmix-menu")
        .addEventListener("command", () => Tabmix.openOptionsDialog());

      document
        .getElementById("tabmix-historyUndoWindowPopup")
        .addEventListener("popupshowing", (/** @type {MenuPopupEvent} */ event) => {
          Tabmix.closedObjectsUtils.populateClosedWindowsMenu(event.target.parentNode);
        });
    },
    {once: true}
  );

  const mainCommandSet = document.getElementById("mainCommandSet");
  mainCommandSet?.addEventListener(
    "command",
    (/** @type {PopupEvent} */ event) => {
      switch (event.target.id) {
        case "History:UndoCloseTab":
          event.stopPropagation();
          Tabmix.undoCloseTab();
          break;
      }
    },
    {capture: true}
  );

  const contextMenuPopup = document.getElementById("contentAreaContextMenu");
  contextMenuPopup.addEventListener(
    "command",
    (/** @type {PopupEvent} */ event) => {
      switch (event.target.id) {
        case "context-openlinkincurrent":
          Tabmix.tablib.openLinkInCurrent();
          // prevent default listener for context-openlinkincurrent
          event.stopPropagation();
          break;
        case "tm-openinverselink":
          Tabmix.openInverseLink(event);
          break;
        case "tm-openAllLinks":
          TabmixContext.openMultipleLinks();
          break;
        case "tm-linkWithhistory":
          gBrowser.openLinkWithHistory();
          break;
        case "tm-content-closetab":
          gBrowser.removeCurrentTab();
          break;
        case "tm-duplicateTabContext":
          Tabmix.duplicateTab(gBrowser._selectedTab);
          break;
        case "tm-duplicateinWinContext":
          gBrowser.duplicateTabToWindow(gBrowser._selectedTab, false);
          break;
        case "tm-detachTabContext":
          gBrowser.duplicateTabToWindow(gBrowser._selectedTab, true);
          break;
        case "tm-mergeWindows":
          Tabmix.MergeWindows.mergeWindows(window);
          break;
        case "tm-content-freezeTab":
          gBrowser.freezeTab(gBrowser._selectedTab);
          break;
        case "tm-content-protectTab":
          gBrowser.protectTab(gBrowser._selectedTab);
          break;
        case "tm-content-lockTab":
          gBrowser.lockTab(gBrowser._selectedTab);
          break;
      }
    },
    {capture: true}
  );

  const mainPopupSet = document.getElementById("mainPopupSet");
  mainPopupSet?.addEventListener("command", (/** @type {PopupEvent} */ event) => {
    // handel command on menupopup
    const menupopup = event.target.closest("menupopup");
    if (menupopup) {
      switch (menupopup.id) {
        case "tabmix-docShell-popup":
          Tabmix.docShellCapabilities.onSet(TabContextMenu.contextTab, event.originalTarget);
          return;
        case "tm_undocloseContextMenu":
          TMP_ClosedTabs.contextMenuOnCommand(event);
          event.stopPropagation();
          return;
        case "lasttabTabList":
          TMP_LastTab.onMenuCommand(event);
          return;
        case "tabslist":
          TabmixAllTabs._tabsListOncommand(event);
          return;
        case "tm-tabsList-menu":
          // @ts-expect-error
          gBrowser.selectedTab = gBrowser.tabs[event.originalTarget.value];
          return;
        case "tabmix_hideTabbar_popup":
          Tabmix.prefs.setIntPref("hideTabbar", event.originalTarget.value);
          return;
      }
    }

    // handel command on menuitem
    switch (event.target.id) {
      // tabContextMenu.xhtml
      case "tm-duplicateinWin":
        gBrowser.duplicateTabsToWindow(TabContextMenu.contextTab);
        break;
      case "tm-mergeWindowsTab":
        Tabmix.MergeWindows.mergeWindows(window);
        break;
      case "tm-renameTab":
        Tabmix.renameTab.editTitle(TabContextMenu.contextTab);
        break;
      case "tm-copyTabUrl":
        gBrowser.copyTabUrl(TabContextMenu.contextTab);
        break;
      case "tm-reloadLeft":
        gBrowser._reloadLeftTabs(TabContextMenu.contextTab);
        break;
      case "tm-reloadRight":
        gBrowser._reloadRightTabs(TabContextMenu.contextTab);
        break;
      case "context_reloadAllTabs":
        Tabmix.tablib.reloadTabs(Tabmix.visibleTabs.tabs);
        break;
      case "tm-reloadOther":
        gBrowser.reloadAllTabsBut(TabContextMenu.contextTab);
        break;
      case "tm-closeAllTabs":
        gBrowser.closeAllTabs();
        break;
      case "tm-closeSimilar":
        gBrowser.closeGroupTabs(TabContextMenu.contextTab);
        break;
      case "tm-freezeTab":
        gBrowser.freezeTab(TabContextMenu.contextTab);
        break;
      case "tm-protectTab":
        gBrowser.protectTab(TabContextMenu.contextTab);
        break;
      case "tm-lockTab":
        gBrowser.lockTab(TabContextMenu.contextTab);
        break;
      // tabmix.xhtml
      case "tm_delete-window":
        Tabmix.closedObjectsUtils.on_delete(event.target.parentNode.triggerNode);
        break;
    }
  });

  mainPopupSet?.addEventListener("popupshowing", (/** @type {MenuPopupEvent} */ event) => {
    const menupopup = event.target;
    const tab = TabContextMenu.contextTab ?? gBrowser.selectedTab;
    switch (menupopup.dataset.popup ?? menupopup.id) {
      case "autoReload": {
        /** @type {TabmixGlobals.Popup} */ // @ts-expect-error - we extend ClosedObjectsUtils.PopupElement
        const target = event.target;
        Tabmix.autoReload.onPopupShowing(target, tab);
        break;
      }
      case "tm-undoCloseList-menu":
        Tabmix.closedObjectsUtils.populateClosedTabsMenu(menupopup.parentNode);
        event.stopPropagation();
        break;
      case "tabmix-docShell-popup":
        Tabmix.docShellCapabilities.onGet(menupopup.childNodes, tab);
        event.stopPropagation();
        break;
      case "tm-tabsList-menu":
        TabmixAllTabs.createTabsList(menupopup, 2);
        break;
      case "tm-content-undoCloseList-menu":
        Tabmix.closedObjectsUtils.populateClosedTabsMenu(menupopup.parentNode);
        break;
      case "tm_undocloseContextMenu":
        TMP_ClosedTabs.contextMenuOnPopupShowing(event, menupopup);
        break;
      case "tm_undocloseWindowContextMenu":
        Tabmix.closedObjectsUtils.on_popupshowing(event, menupopup);
        break;
      case "lasttabTabList":
        TMP_LastTab.onPopupshowing();
        break;
      case "tabmix_hideTabbar_popup":
        menupopup.children[TabmixTabbar.hideMode]?.setAttribute("checked", "true");
        break;
      case "tabmix-rows-tooltip":
        Tabmix.tabsUtils.createTooltip(menupopup);
        break;
    }
  });

  mainPopupSet?.addEventListener("popupshown", (/** @type {MenuPopupEvent} */ event) => {
    const menupopup = event.target;
    switch (menupopup.dataset.popup ?? menupopup.id) {
      case "tm-undoCloseList-menu":
      case "tabmix-docShell-popup":
        event.stopPropagation();
        break;
    }
  });

  mainPopupSet?.addEventListener("popuphidden", (/** @type {MenuPopupEvent} */ event) => {
    const menupopup = event.target;
    switch (menupopup.dataset.popup ?? menupopup.id) {
      case "tm-undoCloseList-menu":
      case "tm-tabsList-menu":
      case "tm-content-undoCloseList-menu":
      case "tabslist":
        TabmixAllTabs.hideCommonList(menupopup);
        break;
      case "lasttabTabList":
        TMP_LastTab.onPopuphidden();
        break;
    }
  });

  document
    .getElementById("tm-tabsList-menu")
    .addEventListener("click", (/** @type {PopupEvent} */ event) => {
      TabmixAllTabs.removeTabFromList(event);
    });
})();
