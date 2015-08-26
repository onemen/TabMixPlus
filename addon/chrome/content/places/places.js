"use strict";

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
      this.contextMenu.toggleEventListener(true);

      // use tab label for bookmark name when user renamed the tab
      // PlacesCommandHook exist on browser window
      if ("PlacesCommandHook" in window) {
         if (Tabmix.isVersion(400)) {
           if (!Tabmix.originalFunctions.placesBookmarkPage) {
             Tabmix.originalFunctions.placesBookmarkPage = PlacesCommandHook.bookmarkPage;
           }
           PlacesCommandHook.bookmarkPage = function(aBrowser) {
             let origTitle;
             let tab = gBrowser.getTabForBrowser(aBrowser);
             let title = TMP_Places.getTabTitle(tab, aBrowser.currentURI.spec);
             if (typeof title == "string") {
               origTitle = aBrowser.contentTitle;
               aBrowser._contentTitle = title;
             }
             try {
               return Tabmix.originalFunctions.placesBookmarkPage.apply(this, arguments);
             } finally {
               if (origTitle) {
                 aBrowser._contentTitle = origTitle;
               }
             }
           };
         } else {
           Tabmix.changeCode(PlacesCommandHook, "PlacesCommandHook.bookmarkPage")._replace(
             /(webNav\.document\.)*title \|\| (url|uri)\.spec;/,
             'TMP_Places.getTabTitle(gBrowser.getTabForBrowser(aBrowser), url.spec) || $&'
           ).toCode();
         }

         Tabmix.changeCode(PlacesCommandHook, "uniqueCurrentPages", {getter: true})._replace(
           'URIs.push(tab.linkedBrowser.currentURI);',
           'let uri = tab.linkedBrowser.currentURI; \
            URIs.push({uri: uri, title: TMP_Places.getTabTitle(tab, uri.spec)});'
         ).defineProperty();
      }

      if ("PlacesViewBase" in window && PlacesViewBase.prototype) {
         Tabmix.changeCode(PlacesViewBase.prototype, "PlacesViewBase.prototype._setLivemarkSiteURIMenuItem")._replace(
            "openUILink(this.getAttribute('targetURI'), event);",
            "TMP_Places.openLivemarkSite(this.getAttribute('targetURI'), event);"
         ).toCode();
      }

      // fix small bug when the event is not mouse event
      // inverse focus of middle/ctrl/meta clicked bookmarks/history
      // don't inverse focus when called from onPopupClick and One-Click Search
      // Bar Interface is on
      // when we are in single window mode set the function to return "tab"
      let $LF = '\n  ';
      Tabmix.changeCode(window, "whereToOpenLink")._replace(
        'var middle = !ignoreButton && e.button == 1;',
        'var middle = !ignoreButton && e.button && e.button == 1;'
      )._replace(
        'return shift ? "tabshifted" : "tab";',
        '{let pref = Tabmix.isCallerInList("openUILink", "handleLinkClick", "TMP_tabshifted", "TMP_contentLinkClick") ?\
                 "extensions.tabmix.inversefocusLinks" : "extensions.tabmix.inversefocusOther";' + $LF +
        'let notOneClickSearch = !getBoolPref("browser.search.showOneOffButtons", false) ||' + $LF +
        '                        Tabmix.callerName() != "onPopupClick";' + $LF +
        'if (notOneClickSearch && getBoolPref(pref, true))' + $LF +
        '  shift = !shift;' + $LF +
        '$&}'
      )._replace(
        'return "window";',
        'return Tabmix.getSingleWindowMode() ? "tab" : "window";'
      ).toCode();

      Tabmix.changeCode(window, "openUILinkIn")._replace(
        'params.fromChrome = true;',
        '$&\n' +
        '  if (Tabmix.isCallerInList("BG_observe"))\n' +
        '    params.inBackground = getBoolPref("browser.tabs.loadInBackground");'
      ).toCode();

      // update incompatibility with X-notifier(aka WebMail Notifier) 2.9.13+
      // in case it warp the function in its object
      let [fnObj, fnName] = this.getXnotifierFunction("openLinkIn");

      Tabmix.changeCode(fnObj, fnName)._replace(
        /aRelatedToCurrent\s*= params.relatedToCurrent;/,
        '$& \
         var bookMarkId = params.bookMarkId;'
      )._replace(
        'where == "current" && w.gBrowser.selectedTab.pinned',
        '$& && !params.suppressTabsOnFileDownload'
      )._replace(
        'var w = getTopWin();',
        '$&\n' +
        '  if (w && where == "window" && !Tabmix.isNewWindowAllow(Tabmix.isVersion(200) ?\n' +
        '                                 aIsPrivate : false)) where = "tab";'
      )._replace(
        /Services.ww.openWindow[^;]*;/,
        'let newWin = $&\n    if (newWin && bookMarkId)\n        newWin.bookMarkIds = bookMarkId;'
      )._replace(
        /(\})(\)?)$/,
        '  var tab = where == "current" ?\n' +
        '      w.gBrowser.selectedTab : w.gBrowser.getTabForLastPanel();\n' +
        '  w.TMP_Places.setTabTitle(tab, url, bookMarkId);\n' +
        '  if (where == "current")' +
        '    w.gBrowser.ensureTabIsVisible(w.gBrowser.selectedTab);' +
        '$1$2'
      ).toCode();

      // prevent error when closing window with sidbar open
      var docURI = window.document.documentURI;
      if (docURI == "chrome://browser/content/bookmarks/bookmarksPanel.xul" ||
          docURI == "chrome://browser/content/history/history-panel.xul") {
        let fn = "setMouseoverURL" in SidebarUtils ? "setMouseoverURL" : "clearURLFromStatusBar";
        Tabmix.changeCode(SidebarUtils, "SidebarUtils." + fn)._replace(
           '{',
           '{if (window.top.XULBrowserWindow == null) return;'
        ).toCode();
      }
   },

   deinit: function TMP_PC_deinit() {
      this.stopObserver();
   },

  // update compatibility with X-notifier(aka WebMail Notifier) 2.9.13+
  // object name wmn replace with xnotifier for version 3.0+
  getXnotifierFunction: function(aName) {
    if (typeof com == "object" && typeof com.tobwithu == "object") {
      let fn = ["wmn", "xnotifier"].filter(function(f) {
        return typeof com.tobwithu[f] == "object" &&
          typeof com.tobwithu[f][aName] == "function";
      });
      if (fn.length)
        return [com.tobwithu[fn[0]], aName];
    }
    return [window, aName];
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
       Tabmix.getTopWin().gBrowser.selectedBrowser.tabmix_allowLoad = true;
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
         this.openHistoryItem(node.uri, aEvent);
      }
   },

   // open PanelUI-historyItems from history button, diverted from openUILink
   openHistoryItem: function(aUri, aEvent) {
      var where = this.isBookmarklet(aUri) ? "current" :
                   this.fixWhereToOpen(aEvent, whereToOpenLink(aEvent, false, true), this.prefHistory);
      if (where == "current")
        Tabmix.getTopWin().gBrowser.selectedBrowser.tabmix_allowLoad = true;
      openUILinkIn(aUri, where, {
        inBackground: Services.prefs.getBoolPref("browser.tabs.loadBookmarksInBackground"),
        initiatingDoc: aEvent ? aEvent.target.ownerDocument : null
      });
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
                (aEvent.button == 1 || aEvent.button === 0 && (aEvent.ctrlKey || aEvent.metaKey))) ||
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
         let historyId = PlacesUIUtils.leftPaneQueries["History"];
         let node = PlacesOrganizer._places.selectedNode;
         let historySelected = node.itemId == historyId ||
             node.parent && node.parent.itemId == historyId;
         if (!historySelected)
           return this.prefBookmark;
         /* falls through */
       case "chrome://browser/content/history/history-panel.xul":
         return this.prefHistory;
       case "chrome://browser/content/browser.xul":
       case "chrome://browser/content/bookmarks/bookmarksPanel.xul":
         /* falls through */
       default:
         break;
     }
     return this.prefBookmark;
   },

  // fixed: reuse all blank tab not just in the end
  // fixed: if "extensions.tabmix.loadBookmarksAndReplace" is true don't reuse
  //        locked and protected tabs open bookmark after those tabs
  // fixed: focus the first tab if "extensions.tabmix.openTabNext" is true
  // fixed: remove "selected" and "tabmix_selectedID" from reuse tab
  //
  //TODO - try to use sessionStore to add many tabs
  openGroup: function TMP_PC_openGroup(bmGroup, bmIds, aWhere) {
    var tabs = gBrowser.visibleTabs;

    var doReplace = (/^tab/).test(aWhere) ? false :
        Tabmix.prefs.getBoolPref("loadBookmarksAndReplace");
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
       canReplace = (doReplace && !aTab.hasAttribute("locked") &&
                    !aTab.hasAttribute("pinned")) || tabIsBlank;
       if (reuseTabs.length < bmGroup.length && canReplace)
          reuseTabs.push(aTab);
       else if ((doReplace && !aTab.hasAttribute("locked") &&
                 !aTab.hasAttribute("protected") &&
                 !aTab.hasAttribute("pinned")) || tabIsBlank) {
          aTab.collapsed = true;
          removeTabs.push(aTab);
       }
    }

    var tabToSelect = null;
    var prevTab = (!doReplace && openTabNext && gBrowser.mCurrentTab._tPos < tabs.length - 1) ?
                   gBrowser.mCurrentTab : Tabmix.visibleTabs.last;
    var tabPos, index;
    var multiple = bmGroup.length > 1;
    for (i = 0; i < bmGroup.length ; i++) {
       let url = bmGroup[i];
       try { // bug 300911
          if (i < reuseTabs.length) {
             aTab = reuseTabs[i];
             let browser = gBrowser.getBrowserForTab(aTab);
             browser.userTypedValue = url;
             browser.loadURI(url);
             // setTabTitle will call TabmixTabbar.updateScrollStatus for us
             aTab.collapsed = false;
             // reset visited & tabmix_selectedID attribute
             if (!aTab.selected) {
                aTab.removeAttribute("visited");
                aTab.removeAttribute("tabmix_selectedID");
             } else
                aTab.setAttribute("reloadcurrent", true);
          }
          else
             aTab = gBrowser.addTab(url, {skipAnimation: multiple, dontMove: true});

          this.setTabTitle(aTab, url, bmIds[i]);
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
        old.removeAttribute("tabmix_selectedID");
      }
    }

    // and focus selectedBrowser
    gBrowser.selectedBrowser.focus();

    // Close any remaining open tabs or blank tabs that are left over.
    while (removeTabs.length > 0) {
       gBrowser.removeTab(removeTabs.pop());
    }

  },

  setTabTitle: function TMP_PC_setTabTitle(aTab, aUrl, aID) {
    if (!aTab || !aTab.parentNode)
      return false;
    if (aID && aID > -1)
       aTab.setAttribute("tabmix_bookmarkId", aID);
    if (!aUrl)
      aUrl = aTab.linkedBrowser.currentURI.spec;
    let title = this.getTabTitle(aTab, aUrl, aTab.label);
    if (title != aTab.label) {
      aTab.label = title;
      aTab.crop = title != aUrl || aUrl == TabmixSvc.aboutBlank ? "end" : "center";
      aTab.setAttribute("tabmix_changed_label", title);
      gBrowser._tabAttrModified(aTab);
      if (aTab.selected)
        gBrowser.updateTitlebar();
      if (!aTab.hasAttribute("faviconized"))
        aTab.removeAttribute("width");
      this._tabTitleChanged = true;
      return true;
    }
    return false;
  },

  getTabTitle: function TMP_PC_getTabTitle(aTab, aUrl, title) {
    if (this.isUserRenameTab(aTab, aUrl))
      return aTab.getAttribute("fixed-label");

    let newTitle = this.getTitleFromBookmark(aUrl, null, -1, aTab);
    if (!newTitle && aTab.hasAttribute("pending"))
      newTitle = TMP_SessionStore.getTitleFromTabState(aTab);
    return newTitle || title;
  },

   _getBookmarkTitle: function (aUrl, aID) {
      let aItemId = aID.value || -1;
      try {
         if (aItemId > -1) {
           var _URI = PlacesUtils.bookmarks.getBookmarkURI(aItemId);
           if (_URI && _URI.spec == aUrl)
             return PlacesUtils.bookmarks.getItemTitle(aItemId);
         }
      } catch (ex) { }
      try {
         let uri = Services.io.newURI(aUrl, null, null);
         aItemId = aID.value = PlacesUtils.getMostRecentBookmarkForURI(uri);
         if (aItemId > -1)
           return PlacesUtils.bookmarks.getItemTitle(aItemId);
      } catch (ex) { }
      aID.value = null;
      return null;
   },

  get _titlefrombookmark() {
    delete this._titlefrombookmark;
    return (this._titlefrombookmark = Tabmix.prefs.getBoolPref("titlefrombookmark"));
  },

  applyCallBackOnUrl: function (aUrl, aCallBack) {
 ///XXX need to work with nsURI
    let hasHref = aUrl.indexOf("#") > -1;
    let result = aCallBack.apply(this, [aUrl]) ||
                 hasHref && aCallBack.apply(this, aUrl.split("#"));
    // when IE Tab is installed try to find url with or without the prefix
    let ietab = Tabmix.extensions.gIeTab;
    if (!result && ietab) {
      let prefix = "chrome://" + ietab.folder + "/content/reloaded.html?url=";
      if (aUrl != prefix) {
        let url = aUrl.startsWith(prefix) ?
            aUrl.replace(prefix, "") : prefix + aUrl;
        result = aCallBack.apply(this, [url]) ||
                 hasHref && aCallBack.apply(this, url.split("#"));
      }
    }
    return result;
  },

  getTitleFromBookmark: function TMP_getTitleFromBookmark(aUrl, aTitle, aItemId, aTab) {
    if (!this._titlefrombookmark || !aUrl)
      return aTitle;

    var oID = {value: aTab ? aTab.getAttribute("tabmix_bookmarkId") : aItemId};
    var getTitle = function(url) this._getBookmarkTitle(url, oID);
    var title = this.applyCallBackOnUrl(aUrl, getTitle);
    // setItem check if aTab exist and remove the attribute if
    // oID.value is null
    Tabmix.setItem(aTab, "tabmix_bookmarkId", oID.value);

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

  afterTabTitleChanged: function TMP_PC_afterTabTitleChanged(aChanged) {
    if (!aChanged && !this._tabTitleChanged)
      return;
    if (this.inUpdateBatch) {
      this._tabTitleChanged = true;
      return;
    }
    this._tabTitleChanged = false;
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
      if (!Tabmix.isVersion(210))
        this.onBeforeItemRemoved = function () {};
      try {
        PlacesUtils.addLazyBookmarkObserver(this);
        this._hasBookmarksObserver = true;
      } catch(ex) {
        Tabmix.reportError(ex, "Failed to add bookmarks observer:");
      }
    }
  },

  stopObserver: function TMP_PC_stopObserver() {
    if (this._hasBookmarksObserver) {
      PlacesUtils.removeLazyBookmarkObserver(this);
      this._hasBookmarksObserver = false;
    }
  },

  onDelayedStartup: function () {
    if (!this._titlefrombookmark || !gBrowser.tabs)
      return;

    this.startObserver();
  },

  // extensions.tabmix.titlefrombookmark changed
  onPreferencChanged: function (aPrefValue) {
    this._titlefrombookmark = aPrefValue;

    if (aPrefValue) {
      Array.forEach(gBrowser.tabs, function(tab) {
        this.setTabTitle(tab);
      }, this);
      this.startObserver();
    }
    else {
      let tabs = gBrowser.tabContainer.getElementsByAttribute("tabmix_bookmarkId", "*");
      Array.slice(tabs).forEach(function(tab) {
        if (tab.hasAttribute("pending"))
          this.setTabTitle(tab);
        else
          gBrowser.setTabTitle(tab);
      }, this);
      this.stopObserver();
    }
    this.afterTabTitleChanged();
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

    let getIndex = function(url) aUrl.indexOf(url) + 1;
    Array.forEach(gBrowser.tabs, function(tab) {
      let url = tab.linkedBrowser.currentURI.spec;
      if (this.isUserRenameTab(tab, url))
        return;
      let index = this.applyCallBackOnUrl(url, getIndex);
      if (index) {
        tab.setAttribute("tabmix_bookmarkId", aItemId[index-1]);
        this.setTabTitle(tab, url);
      }
    }, this);
    this.afterTabTitleChanged();
  },

  updateTitleonTabs: function TMP_PC_updateTitleonTabs(aItemId) {
    if (this.inUpdateBatch) {
      this._batchData.updateIDs.push(aItemId);
      return;
    }
    const ID = "tabmix_bookmarkId";
    let batch = Array.isArray(aItemId);
    let tabs = gBrowser.tabContainer.getElementsByAttribute(ID, batch ? "*" : aItemId);
    Array.slice(tabs).forEach(function(tab) {
      if (!batch ||
          aItemId.indexOf(parseInt(tab.getAttribute(ID))) > -1) {
        tab.removeAttribute(ID);
        let url = tab.linkedBrowser.currentURI.spec;
        if (!this.isUserRenameTab(tab, url)) {
          if (tab.hasAttribute("pending"))
            this.setTabTitle(tab, url);
          else
            gBrowser.setTabTitle(tab);
        }
      }
    }, this);
    this.afterTabTitleChanged();
  },

  onItemAdded: function TMP_PC_onItemAdded(aItemId, aFolder, aIndex, aItemType, aURI) {
    if (aItemId == -1 || aItemType != Ci.nsINavBookmarksService.TYPE_BOOKMARK)
      return;
    var url = aURI ? aURI.spec : null;
    if (url && !isBlankPageURL(url))
      this.addItemIdtoTabsWithUrl(aItemId, url);
  },

  onItemRemoved: function TMP_PC_onItemRemoved(aItemId, aFolder, aIndex, aItemType) {
    if (aItemId == -1 || aItemType != Ci.nsINavBookmarksService.TYPE_BOOKMARK)
      return;
    this.updateTitleonTabs(aItemId);
  },

  // onItemChanged also fired when page is loaded (visited count changed ?)
  onItemChanged: function TMP_PC_onItemChanged(aItemId, aProperty, aIsAnnotationProperty,
                                               aNewValue, aLastModified, aItemType) {
    if (aItemId == -1 || aItemType != Ci.nsINavBookmarksService.TYPE_BOOKMARK ||
        (aProperty != "uri" && aProperty != "title"))
      return;

    if (aProperty == "uri" && aNewValue && !isBlankPageURL(aNewValue))
      this.addItemIdtoTabsWithUrl(aItemId, aNewValue);
    this.updateTitleonTabs(aItemId);
  },

  onBeginUpdateBatch: function TMP_PC_onBeginUpdateBatch() {
    this._batchData = {updateIDs:[], add:{ids:[], urls:[]}};
    this.inUpdateBatch = true;

    if (TabmixTabbar.widthFitTitle &&
        Tabmix.tabsUtils.isElementVisible(gBrowser.mCurrentTab))
      this.currentTab = gBrowser.mCurrentTab;
  },

  onEndUpdateBatch: function TMP_PC_onEndUpdateBatch() {
    var data = this._batchData;
    this.inUpdateBatch = false;
    var [updateIDs, addIDs, addURLs] = [data.updateIDs, data.add.ids, data.add.urls];
    if (addIDs.length)
      this.addItemIdtoTabsWithUrl(addIDs, addURLs);
    if (updateIDs.length)
      this.updateTitleonTabs(updateIDs);

    this._batchData = {updateIDs:[], add:{ids:[], urls:[]}};

    this.afterTabTitleChanged();
    this.currentTab = null;
  },

  onItemVisited: function () {},
  onItemMoved: function () {}
};

TMP_Places.contextMenu = {
  toggleEventListener: function(enable) {
    var eventListener = enable ? "addEventListener" : "removeEventListener";
    window[eventListener]("unload", this, false);
    document.getElementById("placesContext")[eventListener]("popupshowing", this, false);
  },

  handleEvent: function (aEvent) {
    switch (aEvent.type) {
      case "popupshowing":
        this.buildContextMenu();
        break;
      case "unload":
        this.toggleEventListener(false);
        break;
    }
  },

  buildContextMenu: function TMP_PC_buildContextMenu() {
    var _open = document.getElementById("placesContext_open");
    var _openInWindow = document.getElementById("placesContext_open:newwindow");
    var _openInPrivateWindow =
        document.getElementById("placesContext_open:newprivatewindow") || {hidden: true};
    var _openInTab = document.getElementById("placesContext_open:newtab");
    this.update(_open, _openInWindow, _openInPrivateWindow, _openInTab, TMP_Places.getPrefByDocumentURI(window));
  },

  // update context menu for bookmarks manager and sidebar
  // for bookmarks/places, history, sage and more.....
  update: function TMP_contextMenu_update(open, openInWindow, openInPrivateWindow,
                                           openInTab, pref) {
    // if all 4 is hidden... probably "Open all in Tabs" is visible
    if (open.hidden && openInWindow.hidden && openInPrivateWindow.hidden &&
        openInTab.hidden) {
      return;
    }

    var w = Tabmix.getTopWin();
    if (w) {
      let where = w.Tabmix.whereToOpen(pref);
      if (!openInPrivateWindow.hidden && !Tabmix.isNewWindowAllow(true))
        openInPrivateWindow.hidden = true;

      if (!openInWindow.hidden && !Tabmix.isNewWindowAllow(false))
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
  }
};

/** DEPRECATED **/
TMP_Places.getTabFixedTitle = function(aBrowser, aUri) {
  let win = aBrowser.ownerDocument.defaultView;
  return win.TMP_Places.getTabTitle(win.gBrowser.getTabForBrowser(aBrowser), aUri.spec);
};
