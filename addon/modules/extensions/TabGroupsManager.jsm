/**
XXX not working good

1. when we restore closed windows with group to current window
2. when restore saved sessions to current window

*/

/**
 * original code by onemen
 */
var EXPORTED_SYMBOLS = ["TMP_TabGroupsManager"];

let TMP_TabGroupsManager = {
  init: function TMP_TGM_init(aWindow, tabBar) {
    this.newCode("TMP_eventListener.onTabOpen", aWindow.TMP_eventListener.onTabOpen)._replace(
      'this.onTabOpen_delayUpdateTabBar(tab);',
      'try {if (TabGroupsManager.apiEnabled) TabGroupsManager.eventListener.onTabOpen(aEvent);} catch(e) { }'
    ).toCode();

    // in Firefox 4.0 we call TabGroupsManager.eventListener.onTabClose regardless of browser.tabs.animate
    this.newCode("TMP_eventListener.onTabClose", aWindow.TMP_eventListener.onTabClose)._replace(
      'this.onTabClose_updateTabBar(tab);',
      'try {TabGroupsManager.eventListener.onTabClose(aEvent);} catch(e) { }'
    )._replace(
      '!animat', 'true'
    ).toCode();

    this.newCode("TMP_tabDNDObserver._getTabGroupNewIndex", this._getDNDIndex, true).toCode();

    this.newCode("TMP_tabDNDObserver.onDragExit", aWindow.TMP_tabDNDObserver.onDragExit)._replace(
      'if (target)',
      'if (target && !(/^TabGroupsManager/.test(target.id)))'
    ).toCode();

    this.newCode("TMP_TabView.checkTabs", aWindow.TMP_TabView.checkTabs)._replace(
      '!tab.collapsed',
      '!tab.hidden && $&'
    ).toCode();

    // fix bug in TGM when closeing last tab in a group with animation
    this.newCode("gBrowser.removeTab", aWindow.gBrowser.removeTab)._replace(
      'if (aParams)',
      'if (this.visibleTabs.length == 1) {aParams ? aParams.animate = false : aParams = {animate: false}};\
       $&'
    ).toCode();

    this.newCode("TabGroupsManager.EventListener.prototype.onGroupSelect", aWindow.TabGroupsManager.EventListener.prototype.onGroupSelect)._replace(
      '"tabBarScrollStatus" in window', 'true'
    )._replace(
      'tabBarScrollStatus();', 'TabmixTabbar.updateScrollStatus();'
    )._replace(
      'checkBeforeAndAfter();', 'TabmixTabbar.updateBeforeAndAfter();'
    ).toCode();

    this.newCode("TabGroupsManager.AllGroups.prototype.openNewGroup", aWindow.TabGroupsManager.AllGroups.prototype.openNewGroup)._replace(
      'tab = gBrowser.addTab("about:blank");',
      'if (arguments.length > 4 && arguments[4] == "TMP_BrowserOpenTab") { tab = Tabmix.browserOpenTab(null, true); } \
       else $&'
    ).toCode();

    this.newCode("TabGroupsManager.GroupClass.prototype.removeTab", aWindow.TabGroupsManager.GroupClass.prototype.removeTab)._replace(
      'gBrowser.addTab("about:blank")',
      'Tabmix.browserOpenTab(null, true)'
    )._replace(
      'TabGroupsManager.allGroups.openNewGroup();',
      'TabGroupsManager.allGroups.openNewGroup(null, null, null, null, "TMP_BrowserOpenTab");'
    ).toCode();


    // **************************** for Session Manager ****************************

    this.newCode("TabmixSessionData.getTabProperties", aWindow.TabmixSessionData.getTabProperties)._replace(
      'return tabProperties;',
      'if (aTab.group && aTab.group.id) \
         tabProperties += " tabgroups-data=" + encodeURI(aTab.group.id + " " + aTab.group.name); \
       $&'
    )._replace(
      'tabProperties += " hidden=" + aTab.hidden;',
      '' // don't save hidden attribute when we use TGM
    ).toCode();

    let sessionManager = aWindow.TabmixSessionManager;
    this.newCode("TabmixSessionManager.saveOneWindow", sessionManager.saveOneWindow)._replace(
      'if (caller == "windowbackup")',
      <![CDATA[
        this.saveAllGroupsData(null, rdfNodeThisWindow);
        $&
      ]]>
    ).toCode();

    this.newCode("TabmixSessionManager.loadOneWindow", sessionManager.loadOneWindow)._replace(
      'var lastSelectedIndex = restoreSelect ? this.getIntValue(rdfNodeWindow, "selectedIndex") : 0;',
      <![CDATA[$&
        var [_restoreSelect, _lastSelectedIndex] = [restoreSelect, lastSelectedIndex];
        [restoreSelect, lastSelectedIndex] = [false, 0];

        // get saved group data and repalce ids with new one
        let jsonText = this.getLiteralValue(rdfNodeWindow, "tgm_jsonText");
        TabGroupsManager.session.groupRestored = 1;
        if (jsonText) {
          // make sure sessionstore is init
          TMP_SessionStore.initService();
          if ("__SSi" in window)
            TabmixSvc.ss.setWindowValue(window, "TabGroupsManagerAllGroupsData", decodeURI(jsonText));

          TabGroupsManager.allGroups.loadAllGroupsData();
        }
      ]]>
    )._replace(
      'else if (newtabsCount > 0 && !overwrite) {',
      <![CDATA[$&
        // open new group and add new tabs to it
        gBrowser.selectedTab = TMP_addTab();
        gBrowser.moveTabTo(gBrowser.selectedTab, gBrowser.tabs.length - 1);
        newIndex = gBrowser.selectedTab._tPos;
        let group = TabGroupsManager.allGroups.openNewGroupActive(
              gBrowser.selectedTab, -1);
        for (let i = 1; i < newtabsCount; i++) {
          TMP_addTab();
        }
      }
      if (false) {
      ]]>
    )._replace(
      'if (this.saveClosedtabs)',
      <![CDATA[
        if (false && _restoreSelect && (overwrite || (!concatenate && !currentTabIsBalnk)))
          this.updateSelected(newIndex + _lastSelectedIndex, overwrite || caller=="firstwindowopen" || caller=="windowopenebytabmix");
        $&
      ]]>
    ).toCode();

    this.newCode("TabmixSessionManager.loadOneTab", sessionManager.loadOneTab)._replace(
      'var savedHistory = this.loadTabHistory(rdfNodeSession, webNav.sessionHistory);',
      <![CDATA[
        $&
        try {
          let tabgroupsData = TMP_SessionStore._getAttribute({xultab: tabProperties}, "tabgroups-data");
          let [groupId, groupName] = ["", ""];
          if (tabgroupsData) {
            [groupId, groupName] = tabgroupsData.split(" ");
          }
          TabmixSvc.ss.setTabValue(aTab, "TabGroupsManagerGroupId", groupId);
          TabmixSvc.ss.setTabValue(aTab, "TabGroupsManagerGroupName", groupName);
          aTab.removeAttribute("hidden");
          TabGroupsManager.session.moveTabToGroupBySessionStore(aTab);
        } catch (ex) {Tabmix.assert(ex);}
      ]]>
    ).toCode();

    this.newCode("TabmixSessionManager.setNC_TM", sessionManager.setNC_TM)._replace(
      'for',
      'rdfLabels.push("tgm_jsonText");\
       $&'
    ).toCode();

    // for TabGroupsManager use - don't change function name from tabmixSessionsManager
    aWindow.TMP_TabGroupsManager = {}
    this.newCode("window.TMP_TabGroupsManager.tabmixSessionsManager", this.tabmixSessionsManager, true).toCode();

    this.newCode("TabmixSessionManager.saveAllGroupsData", this._saveAllGroupsData, true).toCode();
  },

  // get _tPos from group index
  _getDNDIndex: function (aEvent) {
    var indexInGroup = this.getNewIndex(aEvent);
    var lastIndex = TabGroupsManagerApiVer1.visibleTabs.length - 1;
    if (indexInGroup < 0 || indexInGroup > lastIndex)
      indexInGroup = lastIndex;
    return TabGroupsManagerApiVer1.visibleTabs[indexInGroup]._tPos;
  },

  // for TabGroupsManager use - don't change function name
  tabmixSessionsManager: function () {
    if (!Tabmix.isFirstWindow || "tabmix_afterTabduplicated" in window)
      return false;

    return TabmixSvc.prefs.getBoolPref("extensions.tabmix.sessions.manager") &&
        (!Tabmix.isWindowAfterSessionRestore || "tabmixdata" in window)
  },

  // for TabGroupsManager use
  _saveAllGroupsData: function (jsonText, windowNode) {
    if (!this.enableBackup && !windowNode)
      return;
    try {
      let value = jsonText || TabmixSvc.ss.getWindowValue(window, "TabGroupsManagerAllGroupsData");
      if (!windowNode)
        windowNode = this.gThisWin;
      this.setLiteral(windowNode, "tgm_jsonText", encodeURI(value));
      this.saveStateDelayed();
    } catch (ex) {
      Tabmix.assert(ex);
    }
  }

}
