"use strict";

// prevent Sage from load pages in locked tabs
// code by onemen

// last updated for sage version 1.5.4 - 2016-04-06
// https://addons.mozilla.org/en-us/firefox/addon/sage/
var TMP_Sage = {
  OPEN_TAB_FOR_SAGE: "extensions.tabmix.opentabfor.sage",
  init() {
    TMP_Places.contextMenu.toggleEventListener(true);

    if ("updateItemContextMenu" in window) {
      Tabmix.changeCode(window, "updateItemContextMenu")._replace(
        'readStateController.onCommandUpdate();',
        '$& TMP_Sage.buildContextMenu();'
      ).toCode();
    }

    // for older sage version
    if ("bookmarksTreeClick" in window) {
      Tabmix.changeCode(window, "bookmarksTreeClick")._replace(
        'const BOOKMARK_SEPARATOR',
        'var where = TMP_Places.fixWhereToOpen(aEvent, CreateHTML._tabbed ? "tab" : "current", TMP_Sage.openTabPref); \
         CreateHTML.tabbed = where == "tab"; \
         $&'
      ).toCode();
    }

    // for older sage version
    if ("bookmarksOpen" in window) {
      Tabmix.changeCode(window, "bookmarksOpen")._replace(
        'getContentBrowser().loadURI(lastResource.url);',
        'if (CreateHTML._tabbed) getContentBrowser().addTab(lastResource.url); \
         else $&'
      ).toCode();
    }

    if ("openURI" in window) {
      let fn = window.openURI.toString();
      if (fn.indexOf("switch (windowType)") > -1) {
        Tabmix.changeCode(window, "openURI")._replace(
          'switch (windowType)',
          'windowType = TMP_Places.fixWhereToOpen((oType instanceof Event)? oType : null, !windowType ? "current" : windowType, TMP_Sage.openTabPref); \
           $&'
        ).toCode();
      } else {
        Tabmix.changeCode(window, "openURI")._replace(
          'switch (getWindowType(aEvent))',
          'var windowType = getWindowType(aEvent);\
           windowType = TMP_Places.fixWhereToOpen(aEvent, typeof (windowType) != "string" || !windowType ? "current" : windowType, TMP_Sage.openTabPref); \
           switch (windowType)'
        ).toCode();
      }
    }
  },

  buildContextMenu() {
    var _open = document.getElementById("rssOpenItem");
    var _openInWindow = document.getElementById("rssOpenNewWindowItem");
    var _openInTab = document.getElementById("rssOpenNewTabItem");
    TMP_Places.contextMenu.update(_open, _openInWindow, {hidden: true}, _openInTab, this.openTabPref);
  },

  get openTabPref() {
    if (Services.prefs.prefHasUserValue(this.OPEN_TAB_FOR_SAGE))
      return this.OPEN_TAB_FOR_SAGE;

    return TMP_Places.prefBookmark;
  }

};

window.addEventListener("load", function TMP_onLoad_sageOverlay(aEvent) {
  aEvent.currentTarget.removeEventListener("load", TMP_onLoad_sageOverlay);
  TMP_Sage.init();
});
