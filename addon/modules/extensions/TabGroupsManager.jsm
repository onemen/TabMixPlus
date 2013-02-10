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
    this.changeCode(aWindow.TMP_eventListener, "TMP_eventListener.onTabOpen")._replace(
      /(\})(\)?)$/,
      'try {if (TabGroupsManager.apiEnabled) TabGroupsManager.eventListener.onTabOpen(aEvent);} catch(e) {Tabmix.log(e);}\
       $1$2'
    ).toCode();

    // in Firefox 4.0 we call TabGroupsManager.eventListener.onTabClose regardless of browser.tabs.animate
    this.changeCode(aWindow.TMP_eventListener, "TMP_eventListener.onTabClose")._replace(
      'this.onTabClose_updateTabBar(tab);',
      'try {TabGroupsManager.eventListener.onTabClose(aEvent);} catch(e) {Tabmix.log(e);}'
    )._replace(
      '!Services.prefs.getBoolPref("browser.tabs.animate")', 'true'
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
      '  this.saveAllGroupsData(null, rdfNodeThisWindow);' +
      '  $&'
    ).toCode();

    this.changeCode(sessionManager, "TabmixSessionManager.loadOneWindow")._replace(
      // get saved group data and repalce ids with new one
      'var lastSelectedIndex = restoreSelect ? this.getIntValue(rdfNodeWindow, "selectedIndex") : 0;',
      '$&' +
      '  var [_restoreSelect, _lastSelectedIndex] = [restoreSelect, lastSelectedIndex];' +
      '  [restoreSelect, lastSelectedIndex] = [false, 0];' +
      '  let jsonText = this.getLiteralValue(rdfNodeWindow, "tgm_jsonText");' +
      '  TabGroupsManager.session.groupRestored = 1;' +
      '  if (jsonText) {' +
      '    /* make sure sessionstore is init */' +
      '    TMP_SessionStore.initService();' +
      '    if ("__SSi" in window)' +
      '      TabmixSvc.ss.setWindowValue(window, "TabGroupsManagerAllGroupsData", decodeURI(jsonText));' +
      '    TabGroupsManager.allGroups.loadAllGroupsData();' +
      '  }'
    )._replace(
      // open new group and add new tabs to it
      'else if (newtabsCount > 0 && !overwrite) {',
      '$&' +
      '  gBrowser.selectedTab = TMP_addTab();' +
      '  gBrowser.moveTabTo(gBrowser.selectedTab, gBrowser.tabs.length - 1);' +
      '  newIndex = gBrowser.selectedTab._tPos;' +
      '  let group = TabGroupsManager.allGroups.openNewGroupActive(' +
      '        gBrowser.selectedTab, -1);' +
      '  for (let i = 1; i < newtabsCount; i++) {' +
      '    TMP_addTab();' +
      '  }' +
      '}' +
      'if (false) {'
    )._replace(
      'if (this.saveClosedtabs)',
      '  if (false && _restoreSelect && (overwrite || (!concatenate && !currentTabIsBalnk)))' +
      '    this.updateSelected(newIndex + _lastSelectedIndex, overwrite || caller=="firstwindowopen" || caller=="windowopenebytabmix");' +
      '  $&'
    ).toCode();

    this.changeCode(sessionManager, "TabmixSessionManager.loadOneTab")._replace(
      'var savedHistory = this.loadTabHistory(rdfNodeSession, webNav.sessionHistory, aTab);',
      '  $&' +
      '  try {' +
      '    let tabgroupsData = TMP_SessionStore._getAttribute({xultab: tabProperties}, "tabgroups-data");' +
      '    let [groupId, groupName] = ["", ""];' +
      '    if (tabgroupsData) {' +
      '      [groupId, groupName] = tabgroupsData.split(" ");' +
      '    }' +
      '    TabmixSvc.ss.setTabValue(aTab, "TabGroupsManagerGroupId", groupId);' +
      '    TabmixSvc.ss.setTabValue(aTab, "TabGroupsManagerGroupName", groupName);' +
      '    aTab.removeAttribute("hidden");' +
      '    TabGroupsManager.session.moveTabToGroupBySessionStore(aTab);' +
      '  } catch (ex) {Tabmix.assert(ex);}'
    ).toCode();

    this.changeCode(sessionManager, "TabmixSessionManager.setNC_TM")._replace(
      'for',
      'rdfLabels.push("tgm_jsonText");\
       $&'
    ).toCode();

    // for TabGroupsManager use - don't change function name from tabmixSessionsManager
    aWindow.TMP_TabGroupsManager = {}
    aWindow.TMP_TabGroupsManager.tabmixSessionsManager = this.tabmixSessionsManager.bind(aWindow);
    aWindow.TabmixSessionManager.saveAllGroupsData = this._saveAllGroupsData.bind(aWindow.TabmixSessionManager);
  },

  // for TabGroupsManager use - don't change function name
  tabmixSessionsManager: function () {
    // this here reffer to the top browser window
    if (!this.Tabmix.isFirstWindow || "tabmix_afterTabduplicated" in this)
      return false;

    return this.Tabmix.prefs.getBoolPref("sessions.manager") &&
        (!Tabmix.isWindowAfterSessionRestore || "tabmixdata" in this)
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
