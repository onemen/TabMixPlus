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
            /(webNav\.document\.)*title \|\| url\.spec;/,
            'TMP_Places.getTabFixedTitle(aBrowser, url) || $&'
         ).toCode();

         Tabmix.newCode(null,  PlacesCommandHook.__lookupGetter__("uniqueCurrentPages"))._replace(
           'URIs.push(tab.linkedBrowser.currentURI);',
           'let uri = tab.linkedBrowser.currentURI; \
            URIs.push({uri: uri, title: TMP_Places.getTabFixedTitle(tab.linkedBrowser, uri)});'
         ).toGetter(PlacesCommandHook, "uniqueCurrentPages");
      }

      if ("PlacesViewBase" in window && PlacesViewBase.prototype) {
         // LiveClick and Boox extensions change this function we can't use it
         if (!("LiveClick" in window) && !Tabmix.isVersion(130))
         Tabmix.newCode("PlacesViewBase.prototype._mayAddCommandsItems", PlacesViewBase.prototype._mayAddCommandsItems)._replace(
            "openUILink(this.getAttribute('targetURI'), event);",
            "TMP_Places.openLivemarkSite(this.getAttribute('targetURI'), event);", {silent: true}
         ).toCode();

         if (Tabmix.isVersion(130))
         Tabmix.newCode("PlacesViewBase.prototype._setLivemarkSiteURIMenuItem", PlacesViewBase.prototype._setLivemarkSiteURIMenuItem)._replace(
            "openUILink(this.getAttribute('targetURI'), event);",
            "TMP_Places.openLivemarkSite(this.getAttribute('targetURI'), event);"
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
        '{let pref = Tabmix.isCallerInList("openUILink", "handleLinkClick", "TMP_tabshifted", "TMP_contentLinkClick") ?\
                 "extensions.tabmix.inversefocusLinks" : "extensions.tabmix.inversefocusOther";\
         if(getBoolPref(pref, true)) shift = !shift; \
         $&}'
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

      // update incompatibility with X-notifier(aka WebMail Notifier) 2.9.13+
      // in case it warp the function in its object
      let [fnName, fnCode] = this.getXnotifierFunction("openLinkIn");

      var _loadURI = Tabmix.isVersion(100) ?
            "w.gBrowser.loadURIWithFlags(url, flags, aReferrerURI, null, aPostData);" :
            "w.loadURI(url, aReferrerURI, aPostData, aAllowThirdPartyFixup);";

      Tabmix.newCode(fnName, fnCode)._replace(
        /aRelatedToCurrent\s*= params.relatedToCurrent;/,
        '$& \
         var bookMarkId = params.bookMarkId; \
         var backgroundPref = params.backgroundPref;'
      )._replace(
        'where == "current" && w.gBrowser.selectedTab.pinned',
        '$& && !params.suppressTabsOnFileDownload'
      )._replace(
        'var w = getTopWin();',
        '$& \
         if (w && where == "window" && !Tabmix.isNewWindowAllow(Tabmix.isVersion(200) ? aIsPrivate : false)) where = "tab";'
      )._replace(
        /Services.ww.openWindow[^;]*;/,
        'let newWin = $&\n    if (newWin && bookMarkId)\n        newWin.bookMarkIds = bookMarkId;'
       )._replace(
        '"browser.tabs.loadBookmarksInBackground"',
        'backgroundPref || $&', {check: !Tabmix.isVersion(110)}
      )._replace( // we probably don't need this since Firefox 10
        'aFromChrome ?',
        '$& getBoolPref(backgroundPref) ||', {check: Tabmix.isVersion(110)}
      )._replace(
        _loadURI,
        '$&\
         w.gBrowser.ensureTabIsVisible(w.gBrowser.selectedTab);'
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
         /whereToOpenLink\(aEvent[,\s\w]*\), window/, '$&, aEvent'
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
        'bookMarkId: aNode.itemId, initiatingDoc: null,\
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

      this.stopObserver();
   },

   getURLsForContainerNode: null,
   _first_instance: false,

  // update compatibility with X-notifier(aka WebMail Notifier) 2.9.13+
  // object name wmn replace with xnotifier for version 3.0+
  getXnotifierFunction: function(aName) {
    if (typeof com == "object" && typeof com.tobwithu == "object") {
      let fn = ["wmn", "xnotifier"].filter(function(f) {
        return typeof com.tobwithu[f] == "object" &&
          typeof com.tobwithu[f][aName] == "function";
      });
      if (fn.length)
        return ["com.tobwithu." + fn[0] + "." + aName, com.tobwithu[fn[0]][aName]];
    }
    return [aName, window[aName]];
  },

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
      if (!this._titlefrombookmark)
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
        inBackground: Services.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground"),
        initiatingDoc: aEvent ? aEvent.target.ownerDocument : null
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
           inBackground: Services.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground"),
           initiatingDoc: aEvent ? aEvent.target.ownerDocument : null
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

      var _pref = w.Services.prefs;
      if ((_pref.getBoolPref(aPref) || aTab.hasAttribute("locked"))) {
         if (aEvent && _pref.getBoolPref("extensions.tabmix.middlecurrent") &&
               ((aEvent instanceof MouseEvent &&
                (aEvent.button == 1 || aEvent.button == 0 && (aEvent.ctrlKey || aEvent.metaKey))) ||
                (aEvent instanceof XULCommandEvent &&
                 typeof aEvent.target._placesNode == "object" && (aEvent.ctrlKey || aEvent.metaKey))))
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
  // fixed: if "extensions.tabmix.loadFolderAndReplace" is true don't reuse locked and protected tabs open bookmark after those tabs
  // fixed: focus the first tab if "extensions.tabmix.openTabNext" is true
  // fixed: remove "selected" and "flst_id" from reuse tab
  //
  //TODO - try to use sessionStore to add many tabs
  openGroup: function TMP_PC_openGroup(bmGroup, bmIds, aWhere) {
    var tabBar = gBrowser.tabContainer;
    var tabs = gBrowser.visibleTabs;

    var doReplace = (/^tab/).test(aWhere) ? false :
        Tabmix.prefs.getBoolPref("loadFolderAndReplace");
    var loadInBackground = bmGroup.length > 1 ?
        Tabmix.prefs.getBoolPref("loadBookmarksGroupInBackground") :
        Services.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground");
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

    // and focus selectedBrowser
    gBrowser.selectedBrowser.focus();

    // Close any remaining open tabs or blank tabs that are left over.
    while (removeTabs.length > 0) {
       gBrowser.removeTab(removeTabs.pop());
    }

  },

   getBookmarkTitle: function TMP_PC_getBookmarkTitle(aUrl, aItemId, aTab) {
      if (aTab)
        aItemId = aTab.getAttribute("tabmix_bookmarkId");
      try {
         if (aItemId && aItemId > -1) {
           var _URI = PlacesUtils.bookmarks.getBookmarkURI(aItemId);
           if (_URI && _URI.spec == aUrl)
             return PlacesUtils.bookmarks.getItemTitle(aItemId);
         }
      } catch (ex) { }
      try {
         aItemId = PlacesUtils.getMostRecentBookmarkForURI(Services.io.newURI(aUrl, null, null));
         if (aItemId > -1) {
           if (aTab)
             aTab.setAttribute("tabmix_bookmarkId", aItemId);
           return PlacesUtils.bookmarks.getItemTitle(aItemId);
         }
      } catch (ex) { }
      if (aTab) {
         aTab.removeAttribute("tabmix_bookmarkId");
         // get title for pending tab from SessionStore
         if (aTab.hasAttribute("pending") && aTab.linkedBrowser.__SS_restoreState &&
             aTab.linkedBrowser.__SS_restoreState == 1)
           return TMP_SessionStore.getActiveEntryData(aTab.linkedBrowser.__SS_data).title || null;
      }
      return null;
   },

   // start showAddBookmarkUI with user defined title if exist
   getTabFixedTitle: function TMP_PC_getTabFixedTitle(aBrowser, aURI) {
      if (gBrowser == aBrowser)
         aBrowser = gBrowser.selectedBrowser;

      var tab = gBrowser.getTabForBrowser(aBrowser);
      if (this.isUserRenameTab(tab, aURI.spec))
        return tab.getAttribute("fixed-label");

      // use bookmark title if exist and used as tab title
      if (this._titlefrombookmark && tab.hasAttribute("tabmix_bookmarkId"))
        return this.getBookmarkTitle(aURI.spec, null, tab);

      return null;
   },

  get _titlefrombookmark() {
    delete this._titlefrombookmark;
    return this._titlefrombookmark = Tabmix.prefs.getBoolPref("titlefrombookmark");
  },

  getTitleFromBookmark: function TMP_getTitleFromBookmark(aUrl, aTitle, aItemId, aTab) {
    if (!this._titlefrombookmark || !aUrl)
      return aTitle;

    var url = aUrl.split("#")[0];
    var title = this.getBookmarkTitle(url, aItemId, aTab);
    if (title)
      return title;
    if (url != aUrl)
      title = this.getBookmarkTitle(aUrl, aItemId, aTab);

    var ieTab = "gIeTab" in window;
    if (title || !ieTab)
      return title || aTitle;

    // IE Tab is installed try to find url with or without the prefix
    var ietab = "chrome://ietab/content/reloaded.html?url="
    if (aUrl == ietab)
      return aTitle;
    if (aUrl.indexOf(ietab) == 0)
      title = this.getBookmarkTitle(aUrl.replace(ietab, ""), aItemId, aTab);
    else
      title = this.getBookmarkTitle(ietab + aUrl, aItemId, aTab);

    return title || aTitle;
  },

  isUserRenameTab: function (aTab, aUrl) {
    if (aTab.hasAttribute("label-uri")) {
      let label = aTab.getAttribute("label-uri");
      if (label == aUrl || label == "*")
        return true;
    }
    return false;
  },

  afterTabTitleChanged: function TMP_PC_afterTabTitleChanged() {
    if (this.inUpdateBatch) {
      this._tabTitleChanged = true;
      return;
    }
    TabmixTabbar.updateScrollStatus();
    TabmixTabbar.updateBeforeAndAfter();
    if (this.currentTab) {
      let tabstrip = gBrowser.tabContainer.mTabstrip;
      if (!TabmixTabbar.isMultiRow) {
        let scrollPosition = tabstrip.scrollPosition;
        if (scrollPosition < 100)
          tabstrip.scrollPosition = 0;
      }
      gBrowser.ensureTabIsVisible(this.currentTab, false);
      this.currentTab = null;
    }
  },

  startObserver: function TMP_PC_startObserver() {
    // Start observing bookmarks if needed.
    if (!this._hasBookmarksObserver) {
      try {
        if (Tabmix.isVersion(100))
          PlacesUtils.addLazyBookmarkObserver(this);
        else
          PlacesUtils.bookmarks.addObserver(this, false);
        this._hasBookmarksObserver = true;
      } catch(ex) {
        Components.utils.reportError("Tabmix failed adding a bookmarks observer: " + ex);
      }
    }
  },

  stopObserver: function TMP_PC_stopObserver() {
    if (this._hasBookmarksObserver) {
      if (Tabmix.isVersion(100))
        PlacesUtils.removeLazyBookmarkObserver(this);
      else
        PlacesUtils.bookmarks.removeObserver(this);
      this._hasBookmarksObserver = false;
    }
  },

  onDelayedStartup: function () {
    if (!this._titlefrombookmark || !gBrowser.tabs)
      return;

    // set title at startup
    // when we are not using session manager
    // startup page(s) or home page(s) load before bookmarks service
    for (let i = 0; i < gBrowser.tabs.length ; i++) {
      let browser = gBrowser.getBrowserAtIndex(i);
      let bookMarkName = this.getTitleFromBookmark(browser.currentURI.spec);
      if (bookMarkName && browser.contentDocument.title != bookMarkName)
        browser.contentDocument.title = bookMarkName;
    }

    this.startObserver();
  },

  // extensions.tabmix.titlefrombookmark changed
  onPreferencChanged: function (aPrefValue) {
    this._titlefrombookmark = aPrefValue;
    for (let i = 0; i < gBrowser.tabs.length; i++) {
      let tab = gBrowser.tabs[i];
      try {
        let uri = tab.linkedBrowser.currentURI;
        let id = PlacesUtils.getMostRecentBookmarkForURI(uri);
        if (id > -1)
          gBrowser.setTabTitle(tab);
      } catch (ex) { }
    }
    if (aPrefValue)
      this.startObserver();
    else
      this.stopObserver();
  },

  _hasBookmarksObserver: false,
  inUpdateBatch: false,
  _tabTitleChanged: false,
  currentTab: null,

  // nsINavBookmarkObserver

  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsINavBookmarkObserver
  ]),

  addItemIdtoTabsWithUrl: function TMP_PC_addItemIdtoTabsWithUrl(aItemId, aUrl) {
    if (this.inUpdateBatch) {
      this._batchData.add.ids.push(aItemId);
      this._batchData.add.urls.push(aUrl);
      return;
    }
    else if (!Array.isArray(aItemId))
      [aItemId, aUrl] = [[aItemId], [aUrl]];

    for (let i = 0; i < gBrowser.tabs.length; i++) {
      let tab = gBrowser.tabs[i];
      let url = tab.linkedBrowser.currentURI.spec;
      let index = aUrl.indexOf(url);
      if (index > -1 && !this.isUserRenameTab(tab, url)) {
        tab.setAttribute("tabmix_bookmarkId", aItemId[index]);
        if (tab.label != PlacesUtils.bookmarks.getItemTitle(aItemId[index]))
          gBrowser.setTabTitle(tab);
      }
    }
  },

  updateTitleonTabs: function TMP_PC_updateTitleonTabs(aItemId) {
    if (this.inUpdateBatch) {
      this._batchData.updateIDs.push(aItemId);
      return;
    }
    let batch = Array.isArray(aItemId);
    let tabs = gBrowser.tabContainer.getElementsByAttribute("tabmix_bookmarkId", batch ? "*" : aItemId);
    // getElementsByAttribute return a live nodList each time we remove
    // tabmix_bookmarkId attribute from a tab we remove node from the list
    // and the loop skip one tab
    for (let i = tabs.length - 1; i >= 0; i--) {
      let tab = tabs[i];
      if (this.isUserRenameTab(tab, tab.linkedBrowser.currentURI.spec))
        continue;
      if (!batch || aItemId.indexOf(parseInt(tab.getAttribute("tabmix_bookmarkId"))) > -1)
        gBrowser.setTabTitle(tab);
    }
  },

  onItemAdded: function TMP_PC_onItemAdded(aItemId, aFolder, aIndex, aItemType, aURI) {
    if (aItemId == -1 || aItemType != Ci.nsINavBookmarksService.TYPE_BOOKMARK)
      return;
    var url = aURI ? aURI.spec : null;
    if (url && !Tabmix.isBlankPageURL(url))
      this.addItemIdtoTabsWithUrl(aItemId, url);
  },

  onItemRemoved: function TMP_PC_onItemRemoved(aItemId, aFolder, aIndex, aItemType) {
    if (aItemId == -1 || aItemType != Ci.nsINavBookmarksService.TYPE_BOOKMARK)
      return;
    this.updateTitleonTabs(aItemId);
  },

  // onItemChanged also fired when page is loaded (visited count changed ?)
  onItemChanged: function TMP_PC_onItemChanged(aItemId, aProperty, aIsAnnotationProperty, aNewValue, aLastModified, aItemType) {
    if (aItemId == -1 || aItemType != Ci.nsINavBookmarksService.TYPE_BOOKMARK ||
        (aProperty != "uri" && aProperty != "title"))
      return;

    if (aProperty == "uri" && aNewValue && !Tabmix.isBlankPageURL(aNewValue))
      this.addItemIdtoTabsWithUrl(aItemId, aNewValue);
    this.updateTitleonTabs(aItemId);
  },

  onBeginUpdateBatch: function TMP_PC_onBeginUpdateBatch() {
    this._batchData = {updateIDs:[], add:{ids:[], urls:[]}};
    this.inUpdateBatch = true;

    if (TabmixTabbar.widthFitTitle &&
         gBrowser.tabContainer.mTabstrip.isElementVisible(gBrowser.mCurrentTab))
      this.currentTab = gBrowser.mCurrentTab;
  },

  onEndUpdateBatch: function TMP_PC_onEndUpdateBatch() {
    var data = this._batchData;
    this.inUpdateBatch = false;
    var [updateIDs, addIDs, addURLs] = [data.updateIDs, data.add.ids, data.add.urls];
    if (addIDs.length)
      this.addItemIdtoTabsWithUrl(addIDs, addURLs)
    if (updateIDs.length)
      this.updateTitleonTabs(updateIDs);

    this._batchData = {updateIDs:[], add:{ids:[], urls:[]}};

    if (this._tabTitleChanged) {
      this._tabTitleChanged = false;
      this.afterTabTitleChanged(this.currentTab);
    }
    else
      this.currentTab = null;
  },

  onBeforeItemRemoved: function () {},
  onItemVisited: function () {},
  onItemMoved: function () {}
}
