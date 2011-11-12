// prevent Sage from load pages in locked tabs
// code by onemen

// last updated for sage version 1.4.9 - 2011-01-09
var TMP_Sage = {
   OPEN_TAB_FOR_SAGE:"extensions.tabmix.opentabfor.sage",
   init: function () {
      Tabmix.newCode("updateItemContextMenu", updateItemContextMenu)._replace(
         'readStateController.onCommandUpdate();',
         '$& TMP_Sage.buildContextMenu();'
      ).toCode();

      if ("bookmarksTreeClick" in window) // for older sage version
      Tabmix.newCode("bookmarksTreeClick", bookmarksTreeClick)._replace(
         'const BOOKMARK_SEPARATOR',
         'var where = TMP_Places.fixWhereToOpen(aEvent, CreateHTML._tabbed ? "tab" : "current", TMP_Sage.openTabPref); \
          CreateHTML.tabbed = where == "tab"; \
          $&'
      ).toCode();

      if ("bookmarksOpen" in window) // for older sage version
      Tabmix.newCode("bookmarksOpen", bookmarksOpen)._replace(
         'getContentBrowser().loadURI(lastResource.url);',
         'if (CreateHTML._tabbed) getContentBrowser().addTab(lastResource.url); \
          else $&'
      ).toCode();

      var fn = openURI.toString();
      if (fn.indexOf("switch (windowType)") > -1) {
        Tabmix.newCode("openURI", fn)._replace(
           'switch (windowType)',
           'windowType = TMP_Places.fixWhereToOpen((oType instanceof Event)? oType : null, !windowType ? "current" : windowType, TMP_Sage.openTabPref); \
            $&'
        ).toCode();
      }
      else {
        Tabmix.newCode("openURI", fn)._replace(
           'switch (getWindowType(aEvent))',
           'var windowType = getWindowType(aEvent);\
            windowType = TMP_Places.fixWhereToOpen(aEvent, typeof(windowType) != "string" || !windowType ? "current" : windowType, TMP_Sage.openTabPref); \
            switch (windowType)'
        ).toCode();
      }

   },

   buildContextMenu: function () {
      var _open = document.getElementById("rssOpenItem");
      var _openInWindow = document.getElementById("rssOpenNewWindowItem");
      var _openInTab = document.getElementById("rssOpenNewTabItem");
      TMP_Places.updateContextMenu(_open, _openInWindow, _openInTab, this.openTabPref);
   },

   get openTabPref() {
      if (TabmixSvc.prefs.prefHasUserValue(this.OPEN_TAB_FOR_SAGE))
         return this.OPEN_TAB_FOR_SAGE;
      else
         return TMP_Places.prefBookmark;
   }

}
