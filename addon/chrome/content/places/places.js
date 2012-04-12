// code by onemen
var TMP_Places = {
   prefHistory: "extensions.tabmix.opentabfor.history",
   prefBookmark: "extensions.tabmix.opentabfor.bookmarks",

   addEvent: function TMP_PC_addEvent() {
      window.addEventListener("load", this, false);
      window.addEventListener("unload", this, false);
   },

   handleEvent: function TMP_PC_handleEvent(aEvent) {
      switch (aEvent.type) {
         case "load":
           window.removeEventListener("load", this, false);
           this.init();
           break;
         case "unload":
           window.removeEventListener("unload", this, false);
           this.deinit();
           break;
      }
   },

   init: function TMP_PC_init() {
      this.initPlacesUIUtils();
      PlacesController.prototype.beforeTabMixPLusBuildContextMenu = PlacesController.prototype.buildContextMenu;
      PlacesController.prototype.buildContextMenu = function(aPopup) {
         var anyVisible = this.beforeTabMixPLusBuildContextMenu(aPopup);
         if (anyVisible)
            TMP_Places.buildContextMenu();

         return(anyVisible);
      }

      // use tab label for bookmark name when user renamed the tab
      // PlacesCommandHook exist on browser window
      if ("PlacesCommandHook" in window) {
         Tabmix.newCode("PlacesCommandHook.bookmarkPage", PlacesCommandHook.bookmarkPage)._replace(
            'title = webNav.document.title || url.spec;',
            'title = TMP_Places.getTabFixedTitle(aBrowser, url) || webNav.document.title || url.spec;'
         ).toCode();

         Tabmix.newCode(null,  PlacesCommandHook.__lookupGetter__("uniqueCurrentPages"))._replace(
           'URIs.push(tab.linkedBrowser.currentURI);',
           'let uri = tab.linkedBrowser.currentURI; \
            URIs.push({uri: uri, title: TMP_Places.getTabFixedTitle(tab.linkedBrowser, uri)});'
         ).toGetter(PlacesCommandHook, "uniqueCurrentPages");
      }

      // LiveClick and Boox extensions change this function we can't use it
      if (!("LiveClick" in window) && "PlacesViewBase" in window && PlacesViewBase.prototype) {
         Tabmix.newCode("PlacesViewBase.prototype._mayAddCommandsItems", PlacesViewBase.prototype._mayAddCommandsItems)._replace(
            "openUILink(this.getAttribute('targetURI'), event);",
            "TMP_Places.openLivemarkSite(this.getAttribute('targetURI'), event);", {silent: true}
         ).toCode();
      }

      // fix small bug when the event is not mouse event
      // inverse focus of middle/ctrl/meta clicked bookmarks/history
      // when we are in single window mode set the function to retuen "tab"
      Tabmix.newCode("whereToOpenLink", whereToOpenLink)._replace(
        'var middle = !ignoreButton && e.button == 1;',
        'var middle = e instanceof MouseEvent && !ignoreButton && e.button == 1;'
      )._replace(
        'return shift ? "tabshifted" : "tab";',
        'let pref = Tabmix.isCallerInList("openUILink", "handleLinkClick", "TMP_tabshifted", "TMP_contentLinkClick") ?\
                 "extensions.tabmix.inversefocusLinks" : "extensions.tabmix.inversefocusOther";\
         if(getBoolPref(pref, true)) shift = !shift; \
         $&'
      )._replace(
        'return "window";',
        'return Tabmix.getSingleWindowMode() ? "tab" : "window";'
      ).toCode();

      let inBackground = Tabmix.isVersion(100) ?
          'if ("backgroundPref" in tabmixArg) params.inBackground = getBoolPref(tabmixArg.backgroundPref);' :
          'params.backgroundPref = "backgroundPref" in tabmixArg ? tabmixArg.backgroundPref : null;';

      Tabmix.newCode("openUILinkIn", openUILinkIn)._replace(
        'params.fromChrome = true;',
        '$&\
         var tabmixArg = arguments.length > 5 ? arguments[5] : null; \
         if (tabmixArg) { \
           params.bookMarkId = "bookMarkId" in tabmixArg && tabmixArg.bookMarkId > -1 ? tabmixArg.bookMarkId : null;'
         + inBackground + '}'
      ).toCode();

      let [fnName, fnCode] = ["openLinkIn", openLinkIn];
      try {
        if (com.tobwithu && com.tobwithu.wmn &&
            typeof(com.tobwithu.wmn.openLinkIn) == "function") {
          // update com.tobwithu.wmn.openLinkIn to work with Tabmix's
          // loadInBackground prerfs and add tabmix_bookmarkId
          // to the new tab
          [fnName, fnCode] = ["com.tobwithu.wmn.openLinkIn", com.tobwithu.wmn.openLinkIn];
          Tabmix.newCode("openLinkIn", openLinkIn)._replace(
            '{',
            '{var tab;\
             if (where == "window" && getTopWin() && TabmixSvc.prefs.getBoolPref("extensions.tabmix.singleWindow")) where = "tab";'
          )._replace(
            'com.tobwithu.wmn.openURL',
            'tab = $&', {flags: "g"}
          )._replace(
            'getBoolPref("browser.tabs.loadInBackground");',
            <![CDATA[
              params.fromChrome ? getBoolPref(params.backgroundPref || "browser.tabs.loadBookmarksInBackground") : $&
            ]]>, {check: !Tabmix.isVersion(100), flags: "g"}
          )._replace(
            'getBoolPref("browser.tabs.loadInBackground");',
            <![CDATA[
              params.inBackground;
              if (bg == null)
                bg = params.fromChrome ? getBoolPref(params.backgroundPref || "browser.tabs.loadBookmarksInBackground") : $&
            ]]>, {check: Tabmix.isVersion(100), flags: "g"}
          )._replace(
            /(\})(\)?)$/,
            <![CDATA[
              // if we are after openLinkIn we don't need this
              // we already add this attribute in openLinkIn
              if (tab && params.bookMarkId) {
                // com.tobwithu.wmn.openURL return tab or window
                if (tab.localName != "tab")
                  tab = tab.gBrowser.getTabForLastPanel();
                tab.setAttribute("tabmix_bookmarkId", params.bookMarkId);
              }
            $1$2]]>
          ).toCode();
        }
      } catch(ex) {}

      var _loadURI = Tabmix.isVersion(100) ?
            "w.gBrowser.loadURIWithFlags(url, flags, aReferrerURI, null, aPostData);" :
            "w.loadURI(url, aReferrerURI, aPostData, aAllowThirdPartyFixup);";

      Tabmix.newCode(fnName, fnCode)._replace(
        'var aRelatedToCurrent = params.relatedToCurrent;',
        '$& \
         var bookMarkId = params.bookMarkId; \
         var backgroundPref = params.backgroundPref;'
      )._replace(
        'where == "current" && w.gBrowser.selectedTab.pinned',
        '$& && !params.suppressTabsOnFileDownload'
      )._replace(
        'var w = getTopWin();',
        '$& \
         if (w && where == "window" && TabmixSvc.prefs.getBoolPref("extensions.tabmix.singleWindow")) where = "tab";'
      )._replace(
        'Services.ww.openWindow(w || window, getBrowserURL(), null, "chrome,dialog=no,all", sa);',
        'var newWin = $& \
         if (bookMarkId) newWin.bookMarkIds = bookMarkId;'
      )._replace(
        '"browser.tabs.loadBookmarksInBackground"',
        'backgroundPref || $&', {check: !Tabmix.isVersion(110)}
      )._replace( // we probably don't need this since Firefox 10
        'aFromChrome ?',
        '$& getBoolPref(backgroundPref) ||', {check: Tabmix.isVersion(110)}
      )._replace(
        _loadURI,
        '$&\
         w.gBrowser.tabContainer.mTabstrip.ensureElementIsVisible(w.gBrowser.selectedTab);'
      )._replace(
        /(\})(\)?)$/,
        'if (bookMarkId) { \
           var tab = where == "current" ? w.gBrowser.mCurrentTab : w.gBrowser.getTabForLastPanel(); \
           tab.setAttribute("tabmix_bookmarkId", bookMarkId); \
         } \
         $1$2'
      ).toCode();

      // prevent error when closing window with sidbar open
      var docURI = window.document.documentURI;
      if (docURI == "chrome://browser/content/bookmarks/bookmarksPanel.xul" ||
          docURI == "chrome://browser/content/history/history-panel.xul") {
        let fn = "setMouseoverURL" in SidebarUtils ? "setMouseoverURL" : "clearURLFromStatusBar";
        Tabmix.newCode("SidebarUtils."+fn, SidebarUtils[fn])._replace(
           '{',
           '{if (window.top.XULBrowserWindow == null) return;'
        ).toCode();
      }
   },

   functions: ["_openTabset", "openURINodesInTabs", "openContainerNodeInTabs", "openNodeWithEvent", "_openNodeIn"],
   initPlacesUIUtils: function TMP_PC_initPlacesUIUtils(forceInit) {
      var treeStyleTab = "TreeStyleTabBookmarksService" in window;
      // we enter getURLsForContainerNode into TMP_Places to prevent leakes from PlacesUtils
      if (!this.getURLsForContainerNode && !treeStyleTab) {
        Tabmix.newCode("TMP_Places.getURLsForContainerNode", PlacesUtils.getURLsForContainerNode)._replace(
          '{uri: child.uri,',
          '{id: child.itemId, uri: child.uri,', {flags: "g"}
        )._replace(
          'this.',  'PlacesUtils.', {flags: "g"}
        ).toCode();
      }

      if (!forceInit) {
         if (PlacesUIUtils.tabmix_inited) {
            PlacesUIUtils.tabmix_inited++;
            return;
         }
         PlacesUIUtils.tabmix_inited = 1;
      }
      this._first_instance = true;
      this.functions.forEach(function(aFn) {
        PlacesUIUtils["tabmix_" + aFn] = PlacesUIUtils[aFn];
      });

      var treeStyleTab = "TreeStyleTabBookmarksService" in window;
      function updateOpenTabset() {
        var openDialogCode = '$1openDialog($2getBrowserURL(), "_blank", "chrome,all,dialog=no", urls.join("|"));';
        var loadTabsCode = "browserWindow.$1.loadTabs(urls, loadInBackground, replaceCurrentTab);"
        openDialogCode = openDialogCode.replace("$1", "aWindow.").replace("$2", "aWindow.");
        loadTabsCode = loadTabsCode.replace("$1", "gBrowser");
        if (Tabmix.isVersion(80))
          loadTabsCode = loadTabsCode.replace("replaceCurrentTab", "false");

        var openGroup = "browserWindow.TMP_Places.openGroup(urls, ids, where$1);"
        Tabmix.newCode("PlacesUIUtils._openTabset", PlacesUIUtils._openTabset)._replace(
          'urls = []',
          'behavior, $&', {check: treeStyleTab}
        )._replace(
          'var urls = [];',
          '$& var ids = [];', {check: !treeStyleTab}
        )._replace(
          'urls.push(item.uri);',
          '$& ids.push(item.id);', {check: !treeStyleTab}
        )._replace(
          openDialogCode,
          'let newWin = $& \
           newWin.bookMarkIds = ids.join("|");', {check: !Tabmix.isVersion(60)}
        )._replace(
          '"chrome,dialog=no,all", args);',
          '$&\
           browserWindow.bookMarkIds = ids.join("|");', {check: Tabmix.isVersion(60)}
        )._replace(
          /let openGroupBookmarkBehavior =|TSTOpenGroupBookmarkBehavior =/,
          '$& behavior =', {check: treeStyleTab}
        )._replace(
          loadTabsCode,
          'var changeWhere = where == "tabshifted" && aEvent.target.localName != "menuitem"; \
           if (changeWhere) where = "current";'
           + openGroup.replace("$1", treeStyleTab ? ", behavior" : "")
        ).toCode();
      }
      if (treeStyleTab) {
        window.setTimeout(function () {updateOpenTabset();}, 0);
      }
      else { // TreeStyleTab not installed
        updateOpenTabset();

        Tabmix.newCode("PlacesUIUtils.openURINodesInTabs", PlacesUIUtils.openURINodesInTabs)._replace(
          'push({uri: aNodes[i].uri,',
          'push({id: aNodes[i].itemId, uri: aNodes[i].uri,'
        ).toCode();

        Tabmix.newCode("PlacesUIUtils.openContainerNodeInTabs", PlacesUIUtils.openContainerNodeInTabs)._replace(
          'PlacesUtils.getURLsForContainerNode(aNode)',
          'TMP_Places.getURLsForContainerNode(aNode)'
        ).toCode();
      }

      Tabmix.newCode("PlacesUIUtils.openNodeWithEvent", PlacesUIUtils.openNodeWithEvent)._replace(
         'window.whereToOpenLink(aEvent), window);',
         'window.whereToOpenLink(aEvent), window, aEvent);'
      ).toCode();

      // Don't change "current" when user click context menu open (callee is PC_doCommand and aWhere is current)
      // we disable the open menu when the tab is lock
      // the 2nd check for aWhere == "current" is for non Firefox code that may call this function
      Tabmix.newCode("PlacesUIUtils._openNodeIn", PlacesUIUtils._openNodeIn)._replace(
        /(function[^\(]*\([^\)]+)(\))/,
        '$1, TMP_Event$2'
      )._replace(
        'aWindow.openUILinkIn',
        'if (TMP_Event) aWhere = TMP_Places.isBookmarklet(aNode.uri) ? "current" : '
                     + 'aWindow.TMP_Places.fixWhereToOpen(TMP_Event, aWhere); \
         else if (aWhere == "current" && !TMP_Places.isBookmarklet(aNode.uri)) {\
           let caller = Tabmix._getCallerNameByIndex(2);\
           if (caller != "PC_doCommand")\
             aWhere = aWindow.TMP_Places.fixWhereToOpen(null, aWhere);\
         }\
         if (aWhere == "current") Tabmix.getTopWin().gBrowser.mCurrentBrowser.tabmix_allowLoad = true;\
         $&'
      )._replace(
        'aWindow.openUILinkIn(aNode.uri, aWhere);',
        'aWindow.openUILinkIn(aNode.uri, aWhere, null, null, null, {bookMarkId: aNode.itemId});',
        {check: !Tabmix.isVersion(110)}
      )._replace(
        'inBackground:',
        'bookMarkId: aNode.itemId,\
         $&', {check: Tabmix.isVersion(110)}
      ).toCode();
   },

   deinit: function TMP_PC_deinit() {
      let placesCount = --PlacesUIUtils.tabmix_inited;
      if (this._first_instance || placesCount == 0) {
        this.functions.forEach(function(aFn) {
           PlacesUIUtils[aFn] = PlacesUIUtils["tabmix_" + aFn];
           delete PlacesUIUtils["tabmix_" + aFn];
        });
        this.getURLsForContainerNode = null;
        delete PlacesUIUtils.tabmix_inited;
      }

      // when we close the window from which we run eval on PlacesUIUtils
      // we need to do it again on the new window, or else PlacesUtils will be undefined in PlacesUIUtils
      if (this._first_instance) {
        let win = Tabmix.getTopWin() || Services.wm.getMostRecentWindow("Places:Organizer");
        if (win) {
          PlacesUIUtils.tabmix_inited = placesCount;
          win.TMP_Places.initPlacesUIUtils(true);
        }
      }

      PlacesController.prototype.buildContextMenu = PlacesController.prototype.beforeTabMixPLusBuildContextMenu;
      PlacesController.prototype.beforeTabMixPLusBuildContextMenu = null;
   },

   getURLsForContainerNode: null,
   _first_instance: false,

   buildContextMenu: function TMP_PC_buildContextMenu() {
      var _open = document.getElementById("placesContext_open");
      var _openInWindow = document.getElementById("placesContext_open:newwindow");
      var _openInTab = document.getElementById("placesContext_open:newtab");
      this.updateContextMenu(_open, _openInWindow, _openInTab, this.getPrefByDocumentURI(window));
   },

   // update context menu for bookmarks manager and sidebar
   // for bookmarks/places, history, sage and more.....
   updateContextMenu: function TMP_updateContextMenu(open, openInWindow, openInTab, pref) {
     // if all 3 was hidden ... probably "Open all in Tabs" is visible
     if (open.hidden && openInWindow.hidden && openInTab.hidden)
       return;

     var w = Tabmix.getTopWin();
     if (w) {
       var where = w.Tabmix.whereToOpen(pref);

       if (!openInWindow.hidden && w.Tabmix.singleWindowMode)
         openInWindow.hidden = true;
       else if (openInWindow.hasAttribute("default"))
         openInWindow.removeAttribute("default");

       Tabmix.setItem(openInTab, "default", where.inNew ? "true" : null);

       if (open.hidden != where.lock)
         open.hidden = where.lock;
       if (!open.hidden)
         Tabmix.setItem(open, "default", !where.inNew ? "true" : null);
     }
     else {
       open.hidden = true;
       openInTab.hidden = true;
       openInWindow.hidden = false;
       openInWindow.setAttribute("default", true);
     }
   },

   historyMenuItemsTitle: function TMP_PC_historyMenuItemsTitle(aEvent) {
      if (!TabmixSvc.prefs.getBoolPref("extensions.tabmix.titlefrombookmark"))
        return;

      var aMenuPopup = aEvent.target;
      if (aMenuPopup.id != "goPopup" && aMenuPopup.id != "appmenu_historyMenupopup")
         return;

      for (let i = 0; i < aMenuPopup.childNodes.length ; i++) {
         let item = aMenuPopup.childNodes[i];
         if ("_placesNode" in item) {
           let bookMarkName = this.getTitleFromBookmark(item._placesNode.uri);
           if (bookMarkName)
             item.setAttribute("label", bookMarkName);
         }
      }
   },

   // replace openlivemarksite-menuitem with tabmix function
   openLivemarkSite: function TMP_PC_openLivemarkSite(aUrl, aEvent) {
     var where = this.fixWhereToOpen(aEvent, whereToOpenLink(aEvent), this.prefBookmark);
     if (where == "current")
       Tabmix.getTopWin().gBrowser.mCurrentBrowser.tabmix_allowLoad = true;
     openUILinkIn(aUrl, where, {
        inBackground: Services.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground")
     });
   },

   // we replace HistoryMenu.prototype._onCommand with this function
   // look in tablib.js
   historyMenu: function TMP_PC_historyMenu(aEvent) {
      var node = aEvent.target._placesNode;
      if (node) {
         PlacesUIUtils.markPageAsTyped(node.uri);
         var where = this.isBookmarklet(node.uri) ? "current" :
                      this.fixWhereToOpen(aEvent, whereToOpenLink(aEvent, false, true), this.prefHistory);
         if (where == "current")
           Tabmix.getTopWin().gBrowser.mCurrentBrowser.tabmix_allowLoad = true;
         openUILinkIn(node.uri, where, {
           inBackground: Services.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground")
         });
      }
   },

   isBookmarklet: function (url) {
      var jsURL = /^ *javascript:/;
      return jsURL.test(url) ? true : false;
   },

   fixWhereToOpen: function (aEvent, aWhere, aPref) {
      var w = Tabmix.getTopWin();
      if (!w)
         return aWhere;

      var tabBrowser = w.gBrowser;
      var aTab = tabBrowser.mCurrentTab;

      if (typeof(aPref) == "undefined")
         aPref = this.getPrefByDocumentURI(window);

      var _pref = w.TabmixSvc.prefs;
      if ((_pref.getBoolPref(aPref) || aTab.hasAttribute("locked"))) {
         if (aEvent && _pref.getBoolPref("extensions.tabmix.middlecurrent") &&
               (aEvent.button == 1 || aEvent.button == 0 && (aEvent.ctrlKey || aEvent.metaKey)))
            aWhere = "current";
         else if (aWhere == "current" && !tabBrowser.isBlankNotBusyTab(aTab))
            aWhere = "tab";
      }

      return aWhere;
   },

   getPrefByDocumentURI: function (aWindow) {
     switch (aWindow.document.documentURI) {
       case "chrome://browser/content/places/places.xul":
         if (PlacesOrganizer._places.selectedNode.itemId != PlacesUIUtils.leftPaneQueries["History"])
           break;
       case "chrome://browser/content/history/history-panel.xul":
         return this.prefHistory;
       case "chrome://browser/content/browser.xul":
       case "chrome://browser/content/bookmarks/bookmarksPanel.xul":
       default:
         break;
     }
     return this.prefBookmark;
   },

  // fixed: reuse all blank tab not just in the end
  // fixed: if "browser.tabs.loadFolderAndReplace" is true don't reuse locked and protected tabs open bookmark after those tabs
  // fixed: focus the first tab if "extensions.tabmix.openTabNext" is true
  // fixed: remove "selected" and "flst_id" from reuse tab
  //
  //TODO - try to use sessionStore to add many tabs
  openGroup: function TMP_PC_openGroup(bmGroup, bmIds, aWhere) {
    var tabBar = gBrowser.tabContainer;
    var tabs = gBrowser.visibleTabs;

    var doReplace = (/^tab/).test(aWhere) ? false :
        TabmixSvc.prefs.getBoolPref("browser.tabs.loadFolderAndReplace");
    var loadInBackground = bmGroup.length > 1 ?
        TabmixSvc.prefs.getBoolPref("extensions.tabmix.loadBookmarksGroupInBackground") :
        TabmixSvc.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground");
    var openTabNext = Tabmix.getOpenTabNextPref();

    // catch tab for reuse
    var aTab, reuseTabs = [], removeTabs = [], i;
    var tabIsBlank, canReplace;
    for (i = 0; i < tabs.length ; i++) {
       aTab = tabs[i];
       tabIsBlank = gBrowser.isBlankNotBusyTab(aTab);
       // don't reuse collapsed tab if width fitTitle is set
       canReplace = (doReplace && !aTab.hasAttribute("locked") && !aTab.hasAttribute("pinned")) || tabIsBlank;
       if (reuseTabs.length < bmGroup.length && canReplace)
          reuseTabs.push(aTab);
       else if ((doReplace && !aTab.hasAttribute("locked") && !aTab.hasAttribute("protected") && !aTab.hasAttribute("pinned")) || tabIsBlank) {
          aTab.collapsed = true;
          removeTabs.push(aTab);
       }
    }

    var tabToSelect = null;
    var prevTab = (!doReplace && openTabNext && gBrowser.mCurrentTab._tPos < tabs.length - 1) ?
                  gBrowser.mCurrentTab : tabBar.visibleTabsLastChild;
    var tabPos, index;
    var multiple = bmGroup.length > 1;
    for (i = 0; i < bmGroup.length ; i++) {
       try { // bug 300911
          if (i < reuseTabs.length) {
             aTab = reuseTabs[i];
             let browser = gBrowser.getBrowserForTab(aTab);
             browser.userTypedValue = bmGroup[i];
             browser.loadURI(bmGroup[i]);
             // setTabTitle will call TabmixTabbar.updateScrollStatus for us
             aTab.collapsed = false;
             // reset visited & flst_id attribute
             if (aTab != gBrowser.mCurrentTab) {
                aTab.removeAttribute("visited");
                aTab.removeAttribute("flst_id");
             } else
                aTab.setAttribute("reloadcurrent", true);
          }
          else
             aTab = gBrowser.addTab(bmGroup[i], {skipAnimation: multiple});
          if (bmIds[i] && bmIds[i] > -1)
             aTab.setAttribute("tabmix_bookmarkId", bmIds[i]);
       } catch (er) {  }

       if (!tabToSelect)
          tabToSelect = aTab;
       // move tab to place
       index = prevTab._tPos + 1;
       tabPos = aTab._tPos < index ? index - 1 : index;
       gBrowser.moveTabTo(aTab, tabPos);
       TMP_LastTab.attachTab(aTab, prevTab);
       prevTab = aTab;
    }

    // focus the first tab if prefs say to
    if (!loadInBackground || doReplace &&
                             (gBrowser.selectedTab.hasAttribute("reloadcurrent") ||
                              gBrowser.selectedTab in removeTabs)) {
      var old = gBrowser.selectedTab;
      gBrowser.selectedTab = tabToSelect;
      if (!multiple && old != tabToSelect)
        tabToSelect.owner = old;
      var reloadCurrent = old.hasAttribute("reloadcurrent");
      if (reloadCurrent)
        old.removeAttribute("reloadcurrent");
      if (reloadCurrent && old != tabToSelect) {
        old.removeAttribute("visited");
        old.removeAttribute("flst_id");
      }
    }

    // and focus the content
    content.focus();

    // Close any remaining open tabs or blank tabs that are left over.
    while (removeTabs.length > 0) {
       gBrowser.removeTab(removeTabs.pop());
    }

  },

   getBookmarkTitle: function TMP_PC_getBookmarkTitle(aUrl, aItemId) {
      try {
         if (aItemId && aItemId > -1) {
           var _URI = PlacesUtils.bookmarks.getBookmarkURI(aItemId);
           if (_URI && _URI.spec == aUrl)
             return PlacesUtils.bookmarks.getItemTitle(aItemId);
         }
      } catch (ex) { }
      try {
         aItemId = PlacesUtils.getMostRecentBookmarkForURI(Services.io.newURI(aUrl, null, null));
         return aItemId > -1 ? PlacesUtils.bookmarks.getItemTitle(aItemId): null;
      } catch (ex) { }
      return null;
   },

   // start showAddBookmarkUI with user defined title if exist
   getTabFixedTitle: function TMP_PC_getTabFixedTitle(aBrowser, aURI) {
      if (gBrowser == aBrowser)
         aBrowser = gBrowser.selectedBrowser;

      var aTab = gBrowser.getTabForBrowser(aBrowser);
      var fixedLabelUri = aTab.getAttribute("label-uri");
      if (fixedLabelUri && (fixedLabelUri == aURI.spec || fixedLabelUri == "*"))
         return aTab.getAttribute("fixed-label");

      return null;
   },

  getTitleFromBookmark: function TMP_getTitleFromBookmark(aUrl, aTitle, aItemId) {
    if (!TabmixSvc.prefs.getBoolPref("extensions.tabmix.titlefrombookmark") || !aUrl)
      return aTitle;

    var title = this.getBookmarkTitle(aUrl.split("#")[0], aItemId);
    if (title)
      return title;
    title = this.getBookmarkTitle(aUrl, aItemId);

    var ieTab = "gIeTab" in window;
    if (title || !ieTab)
      return title || aTitle;

    // IE Tab is installed try to find url with or without the prefix
    var ietab = "chrome://ietab/content/reloaded.html?url="
    if (aUrl == ietab)
      return aTitle;
    if (aUrl.indexOf(ietab) == 0)
      title = this.getBookmarkTitle(aUrl.replace(ietab, ""), aItemId);
    else
      title = this.getBookmarkTitle(ietab + aUrl, aItemId);

    return title || aTitle;
  }
}
