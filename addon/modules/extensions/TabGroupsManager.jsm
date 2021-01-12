"use strict";

/**
 * original code by onemen
 */
this.EXPORTED_SYMBOLS = ["TMP_TabGroupsManager"];

this.TMP_TabGroupsManager = {
  init: function TMP_TGM_init(aWindow) {
    this.changeCode(aWindow.TMP_eventListener, "TMP_eventListener.onTabOpen")._replace(
      /(})(\)?)$/,
      '    try {\n' +
      '      if (TabGroupsManager.apiEnabled)\n' +
      '        TabGroupsManager.eventListener.onTabOpen(aEvent);\n' +
      '    } catch(e) {Tabmix.log(e);}\n' +
      '    $1$2'
    ).toCode();

    // we call TabGroupsManager.eventListener.onTabClose regardless of tab animations
    this.changeCode(aWindow.TMP_eventListener, "TMP_eventListener.onTabClose")._replace(
      'this.onTabClose_updateTabBar(tab);',
      'try {TabGroupsManager.eventListener.onTabClose(aEvent);} catch(e) {Tabmix.log(e);}'
    )._replace(
      '!TabmixSvc.tabAnimationsEnabled', 'true'
    ).toCode();

    this.changeCode(aWindow.TMP_tabDNDObserver, "TMP_tabDNDObserver.onDragExit")._replace(
      'if (target)',
      'if (target && !(/^TabGroupsManager/.test(target.id)))'
    ).toCode();

    this.changeCode(aWindow.TMP_TabView, "TMP_TabView.checkTabs")._replace(
      '!tab.collapsed',
      '!tab.hidden && $&'
    ).toCode();

    // **************************** for Session Manager ****************************

    this.changeCode(aWindow.TabmixSessionData, "TabmixSessionData.getTabProperties")._replace(
      'return tabProperties;',
      'if (aTab.group && aTab.group.id) \
         tabProperties += " tabgroups-data=" + encodeURI(aTab.group.id + " " + aTab.group.name); \
       $&'
    )._replace(
      'tabProperties += " hidden=" + aTab.hidden;',
      '' // don't save hidden attribute when we use TGM
    ).toCode();

    let sessionManager = aWindow.TabmixSessionManager;
    this.changeCode(sessionManager, "TabmixSessionManager.saveOneWindow")._replace(
      'if (caller == "windowbackup")',
      '  try{this.saveAllGroupsData(null, rdfNodeThisWindow);} catch(ex) {Tabmix.assert(ex);}' +
      '  $&'
    ).toCode();

    /*
      we have some compatibility issue if we let TabGroupsManager
      listen to "SSTabRestoring", probably since TGM move tabs around
      the fix is to call TGM.moveTabToGroupBySessionStore for each tab
      after the tab restored by SessionStore
    */
    sessionManager._moveTabsToGroupByTGM = function(window, tabs) {
      let sessionStore = window.TabmixSvc.ss;
      let TGM = window.TabGroupsManager.session;
      for (let i = 0; i < tabs.length; i++) {
        let tab = tabs[i];
        let data = sessionStore.getTabValue(tab, "__tabmixTGM");
        let [groupId, groupName] = data ? data.split(" ") : ["-1", ""];
        sessionStore.setTabValue(tab, "TabGroupsManagerGroupId", groupId);
        sessionStore.setTabValue(tab, "TabGroupsManagerGroupName", groupName);
        sessionStore.deleteTabValue(tab, "__tabmixTGM");
        TGM.moveTabToGroupBySessionStore(tab);
      }
    };

    this.changeCode(sessionManager, "TabmixSessionManager.loadOneWindow")._replace(
      // get saved group data and replace ids with new one
      'var lastSelectedIndex = restoreSelect ? winData.selected - 1 : 0;',
      '$&' +
      '  var [_restoreSelect, _lastSelectedIndex] = [restoreSelect, lastSelectedIndex];' +
      '  [restoreSelect, lastSelectedIndex] = [false, 0];' +
      '  let jsonText = winData.extData && winData.extData.TabGroupsManagerAllGroupsData;' +
      '  TabGroupsManager.session.groupRestored = 1;' +
      '  if (jsonText) {' +
      '    if ("__SSi" in window)' +
      '      TabmixSvc.ss.setWindowValue(window, "TabGroupsManagerAllGroupsData", decodeURI(jsonText));' +
      '    TabGroupsManager.allGroups.loadAllGroupsData();' +
      '  }'
    )._replace(
      // open new group and add new tabs to it
      'else if (newtabsCount > 0 && !overwrite) {',
      '$&' +
      '  let newTab = TMP_addTab();' +
      '  gBrowser.moveTabTo(newTab, gBrowser.tabs.length - 1);' +
      '  gBrowser.selectedTab = newTab;' +
      '  newIndex = newTab._tPos;' +
      '  TabGroupsManager.allGroups.openNewGroupActive(newTab, -1);' +
      '  for (let i = 1; i < newtabsCount; i++) {' +
      '    TMP_addTab();' +
      '  }' +
      '}' +
      'if (false) {'
    )._replace(
      'TMP_ClosedTabs.setButtonDisableState();',
      '  let isBlank = gBrowser.isBlankNotBusyTab(cTab);' +
      '  if (_restoreSelect && (overwrite || !isBlank)) {' +
      '    this.updateSelected(newIndex + _lastSelectedIndex, overwrite ||' +
      '                        caller=="firstwindowopen" || caller=="windowopenedbytabmix");' +
      '  }' +
      '  $&'
    )._replace(
      'TabmixSvc.SessionStore[fnName](window, tabs, tabsData, 0);',
      '$&\n' +
      '      this._moveTabsToGroupByTGM(window, tabs);'
    ).toCode();

    // for TabGroupsManager use - don't change function name from tabmixSessionsManager
    aWindow.TMP_TabGroupsManager = {};
    aWindow.TMP_TabGroupsManager.tabmixSessionsManager = this.tabmixSessionsManager.bind(aWindow);
    this.changeCode(this, "TMP_TabGroupsManager._saveAllGroupsData", {forceUpdate: true})
        .toCode(false, aWindow.TabmixSessionManager, "saveAllGroupsData");
  },

  // for TabGroupsManager use - don't change function name
  tabmixSessionsManager() {
    // this here refers to the top browser window
    if (!this.Tabmix.isFirstWindow || this.Tabmix._afterTabduplicated) {
      return false;
    }

    return this.Tabmix.prefs.getBoolPref("sessions.manager") &&
        (!this.Tabmix.isWindowAfterSessionRestore || "tabmixdata" in this);
  },

  // for TabGroupsManager use
  _saveAllGroupsData(jsonText, windowNode) {
    if (!this.enableBackup && !windowNode)
      return;
    try {
      let value = jsonText || window.TabmixSvc.ss.getWindowValue(window, "TabGroupsManagerAllGroupsData");
      if (!windowNode)
        windowNode = this.gThisWin;
      this.setLiteral(windowNode, "tgm_jsonText", encodeURI(value));
      this.saveStateDelayed();
    } catch (ex) {
      window.Tabmix.assert(ex);
    }
  }

};
