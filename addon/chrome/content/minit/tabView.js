  "use strict";

  TMP_TabView.handleEvent = function(aEvent) {
    switch (aEvent.type) {
      case "tabviewshown":
        TabmixSessionManager.saveTabViewData(TabmixSessionManager.gThisWin, true);
        break;
      case "tabviewhidden":
        TabmixSessionManager.saveTabViewData(TabmixSessionManager.gThisWin, true);
        TMP_LastTab.tabs = null;
        if (TabmixTabbar.hideMode != 2)
          setTimeout(function () {gBrowser.tabContainer.adjustTabstrip()}, 0);
        break;
      case "TabShow":
        if (!gBrowser.tabContainer._onDelayTabShow) {
          // pass aEvent to this function for use in TGM
          gBrowser.tabContainer._onDelayTabShow = window.setTimeout(function (aEvent) {
            gBrowser.tabContainer._onDelayTabShow = null;
            TMP_eventListener.onTabOpen_delayUpdateTabBar(aEvent.target);
          }, 0, aEvent);
        }
        break;
      case "TabHide":
        if (!gBrowser.tabContainer._onDelayTabHide) {
          // pass aEvent to this function for use in TGM
          gBrowser.tabContainer._onDelayTabHide = window.setTimeout(function (aEvent) {
            gBrowser.tabContainer._onDelayTabHide = null;
            let tab = aEvent.target;
            TMP_eventListener.onTabClose_updateTabBar(tab, true);
          }, 0, aEvent);
        }
        break;
    }
  }

  /* ............... TabView Code Fix  ............... */

  /*
   * this code is fixes some bugs in Panorama code when restoring sessions
   *
   */

  TMP_TabView._patchBrowserTabview = function SM__patchBrowserTabview() {
    var tabView = document.getElementById("tab-view-deck");
    if (tabView) {
      tabView.addEventListener("tabviewhidden", this, true);
      tabView.addEventListener("tabviewshown", this, true);
      gBrowser.tabContainer.addEventListener("TabShow", this, true);
      gBrowser.tabContainer.addEventListener("TabHide", this, true);
    }

    // we need to stop tabs slideShow before Tabview starts
    Tabmix.changeCode(TabView, "TabView.toggle")._replace(
      'this.show();',
      '{if (Tabmix.SlideshowInitialized && Tabmix.flst.slideShowTimer) Tabmix.flst.cancel();\
       $&}'
    ).toCode();

    // don't do anything if Session Manager extension installed
    if (Tabmix.extensions.sessionManager)
      return;

    // add our function to the TabView initFrameCallbacks
    // we don't need our patch for the first run
    var callback = function callback_TMP_TabView_patchTabviewFrame() {
      try {
        TabmixSessionManager._groupItemPushAway();
        this._patchTabviewFrame();
      } catch (ex) {Tabmix.assert(ex);}
    }.bind(this);

    if (TabView._window)
      callback();
    else
      TabView._initFrameCallbacks.push(callback);
  },

  TMP_TabView._patchTabviewFrame = function SM__patchTabviewFrame(){
    // Firefox 8.0 use strict mode - we need to map global variable
    TabView._window.GroupItems._original_reconstitute = TabView._window.GroupItems.reconstitute;
    Tabmix.changeCode(TabView._window.GroupItems, "TabView._window.GroupItems.reconstitute")._replace(
      '"use strict";',
      '$&' +
      'let win = TabView._window;' +
      'let GroupItem = win.GroupItem;' +
      'let iQ = win.iQ;' +
      'let UI = win.UI;' +
      'let Utils = win.Utils;' +
      'let GroupItems = win.GroupItems;' +
      'let Storage = win.Storage;', {silent: true}
    )._replace(
      'this.',
      'GroupItems.', {flags: "g"}
    )._replace(
      // This group is re-used by session restore
      // make sure all of its children still belong to this group.
      // Do it before setBounds trigger data save that will overwrite
      // session restore data.
      // We call TabItems.resumeReconnecting later to reconnect the tabItem.
      'groupItem.userSize = data.userSize;',
      'groupItem.getChildren().forEach(function TMP_GroupItems_reconstitute_groupItem_forEach(tabItem) {' +
      '  var tabData = TabmixSessionData.getTabValue(tabItem.tab, "tabview-tab", true);' +
      '  if (!tabData || tabData.groupID != data.id) {' +
      '    tabItem._reconnected = false;' +
      '  }' +
      '});' +
      '$&'
    ).toCode();

    // add tab to the new group on tabs order not tabItem order
    TabView._window.UI._original_reset = TabView._window.UI.reset;
    Tabmix.changeCode(TabView._window.UI, "TabView._window.UI.reset")._replace(
      '"use strict";',
      '$&' +
      'let win = TabView._window;' +
      'let Trenches = win.Trenches;' +
      'let Items = win.Items;' +
      'let iQ = win.iQ;' +
      'let Rect = win.Rect;' +
      'let GroupItems = win.GroupItems;' +
      'let GroupItem = win.GroupItem;' +
      'let UI = win.UI;', {silent: true}
    )._replace(
      'this.',
      'UI.', {flags: "g", silent: true}
    )._replace(
      'items = TabItems.getItems();',
      'items = gBrowser.tabs;'
    )._replace(
      /items\.forEach\(function\s*\(item\)\s*{/,
      'Array.forEach(items, function(tab) { \
       if (tab.pinned) return;\
       let item = tab._tabViewTabItem;'
    )._replace(
      'groupItem.add(item, {immediately: true});',
      'item._reconnected = true; \
       $&'
    )._replace(
      /(\})(\)?)$/,
      '  GroupItems.groupItems.forEach(function(group) {' +
      '    if (group != groupItem)' +
      '      group.close();' +
      '  });' +
      ' $1$2'
    ).toCode();

    TabView._window.TabItems._original_resumeReconnecting = TabView._window.TabItems.resumeReconnecting;
    TabView._window.TabItems.resumeReconnecting = function TabItems_resumeReconnecting() {
      let TabItems = TabView._window.TabItems;
      let Utils = TabView._window.Utils;
      Utils.assertThrow(TabItems._reconnectingPaused, "should already be paused");
      TabItems._reconnectingPaused = false;
      Array.forEach(gBrowser.tabs, function (tab){
        if (tab.pinned)
          return;
        let item = tab._tabViewTabItem;
        if ("__tabmix_reconnected" in item && !item.__tabmix_reconnected) {
          item._reconnected = false;
          delete item.__tabmix_reconnected;
        }
        if (!item._reconnected)
          item._reconnect();
      });
    }
  },

  TMP_TabView._resetTabviewFrame = function SM__resetTabviewFrame(){
    var tabView = document.getElementById("tab-view-deck");
    if (tabView) {
      tabView.removeEventListener("tabviewhidden", this, false);
      tabView.removeEventListener("tabviewshown", this, false);
      gBrowser.tabContainer.removeEventListener("TabShow", this, true);
      gBrowser.tabContainer.removeEventListener("TabHide", this, true);
    }

    if (!Tabmix.extensions.sessionManager && TabView._window) {
      TabView._window.GroupItems.reconstitute = TabView._window.GroupItems._original_reconstitute;
      delete TabView._window.GroupItems._original_reconstitute;
      TabView._window.UI.reset = TabView._window.UI._original_reset;
      TabView._window.TabItems.resumeReconnecting = TabView._window.TabItems._original_resumeReconnecting;
      delete TabView._window.UI._original_reset;
      delete TabView._window.TabItems._original_resumeReconnecting;
    }
  }
