"use strict";

/*
 * chrome://tabmixplus/content/session/sessionStore.js
 *
 * original code by onemen
 *
 */
var TMP_SessionStore = { // jshint ignore:line
   // make sure sessionstore is init
   _ssInited: null,
   initService: function TMP_ss_start() {
     if (Tabmix.isVersion(250, 250) || this._ssInited)
       return;
     try {
       TabmixSvc.ss.init(window);
       this._ssInited = true;
     } catch(ex) {
       dump("nsSessionStore could not be initialized: " + ex + "\n");
       Tabmix.assert(ex);
       return;
     }
   },

   // get title for closed window from bookmark title or user tab title
   getTitleForClosedWindow: function TMP_ss_getTitleForClosedWindow(aUndoItem) {
     // if user already rename this item wo don't use other title
     if (aUndoItem.renamed)
       return;
     let selectedTab = aUndoItem.selected && aUndoItem.tabs[aUndoItem.selected - 1];
     if (!selectedTab || !selectedTab.entries || selectedTab.entries.length === 0)
       return;
     let tabData = this.getActiveEntryData(selectedTab);
     let url = selectedTab.attributes["label-uri"];
     if (url == tabData.url || url == "*")
       aUndoItem.title = selectedTab.attributes["fixed-label"];
     else {
       aUndoItem.title = TMP_Places.getTitleFromBookmark(tabData.url, aUndoItem.title || tabData.title || tabData.url);
       if (aUndoItem.title == TabmixSvc.aboutBlank)
         aUndoItem.title = gBrowser.mStringBundle.getString("tabs.emptyTabTitle");
     }
   },

   // get nsSessionStore active entry data.
   getActiveEntryData: function TMP_ss_getActiveEntryData(aData) {
     let activeIndex = (aData.index || aData.entries.length) - 1;
     if (activeIndex >= aData.entries.length)
       activeIndex = aData.entries.length - 1;
     return aData.entries[activeIndex] || {};
   },

   getTitleFromTabState: function(aTab) {
     let tabData = TabmixSvc.JSON.parse(TabmixSvc.ss.getTabState(aTab));
     return this.getActiveEntryData(tabData).title || null;
   },

   // check if pending tab has no history or is about:blank
   isBlankPendingTab: function(aTab) {
     if (!aTab.hasAttribute("pending"))
       return false;
     let tabData = TabmixSvc.JSON.parse(TabmixSvc.ss.getTabState(aTab));
     let entries = tabData && tabData.entries;
     if (entries && entries.length > 1)
       return false;
     if (entries[0] && entries[0].url != "about:blank")
       return false;
      return true;
   },

   /**
    * @brief       - Add attribute to nsSessionStore persistTabAttribute.
    *
    *   we call this after nsSessionStore.init
    *   we add this also when we use TMP session manager.
    *   we use Firefox SessionStore closed tab service and for restore after restart
    *
    * @returns        Nothing.
    */
   persistTabAttribute: function TMP_ss_persistTabAttribute() {
      if (TabmixSvc.sm.persistTabAttributeSet)
        return;

      try {
        /*
         * XUL Tab attributes to (re)store
         * Restored in nsSessionStore restoreHistory()
         */
         var _xulAttributes = ["protected", "_locked", "fixed-label", "label-uri", "reload-data", "tabmix_bookmarkId"];

         // make TreeStyleTab extension compatible with Tabmix Plus
         if ("TreeStyleTabBrowser" in window)
            _xulAttributes = _xulAttributes.concat(TabmixSessionData.tabTSTProperties);

         _xulAttributes.forEach(function(aAttr) {
            TabmixSvc.ss.persistTabAttribute(aAttr);
         });

         TabmixSvc.sm.persistTabAttributeSet = true;
      } catch(ex) {
         Tabmix.log("nsSessionStore could not add Attribute to persistTabAttribute: " + ex + "\n");
      }
   },

   /**
    * @brief         make sure that we don't enable both sessionStore and session manager
    *
    * @param msgNo   a Integer value - msg no. to show.
    *                -1 when session manager extension enabled (see SessionManagerExtension.jsm)
    *
    * @param start   a Boolean value - true if we call this function before startup.
    *
    * @returns       Nothing.
    */
   setService: function TMP_ss_setSessionService(msgNo, start) {
      if (TabmixSvc.sm.settingPreference || Tabmix.prefs.prefHasUserValue("setDefault"))
         return;
     /*
      * From 2008-03-10 we don't set browser.sessionstore.enabled to false anymore
      * we use nsISessionStore service in TMP.
      * if we use TMP session manager we set all other sessionstore pref to false to disable SessionRestore
      *
      * Bug 449596 - remove the browser.sessionstore.enabled pref
      * so here we don't set it to true, we just clear user pref to the default
      * if the pref exist in firefox this set the pref to true
      * if the pref don't exist this will remove the pref
      */
      const TMP_SS_MANAGER = "extensions.tabmix.sessions.manager";
      const TMP_SS_CRASHRECOVERY = "extensions.tabmix.sessions.crashRecovery";
      var TMP_manager_enabled = Services.prefs.getBoolPref(TMP_SS_MANAGER);
      var TMP_crashRecovery_enabled = Services.prefs.getBoolPref(TMP_SS_CRASHRECOVERY);
      if (!TMP_manager_enabled && !TMP_crashRecovery_enabled) {
         return;
      }

      TabmixSvc.sm.settingPreference = true;
      // if session manager extension is install disable TMP session manager
      if (msgNo == -1 || Tabmix.extensions.sessionManager) {
         // update session manager settings accourding to current tabmix settings
         if (TMP_manager_enabled) {
            Services.prefs.setBoolPref(TMP_SS_MANAGER, false);
            switch (Tabmix.prefs.getIntPref("sessions.onStart")) {
               case 0:
                  Services.prefs.setIntPref("extensions.sessionmanager.startup", 0);
                  Services.prefs.setIntPref("browser.startup.page", 3);
                  break;
               case 1:
                  Services.prefs.setIntPref("extensions.sessionmanager.startup", 1);
                  break;
               //default: nothing to do
            }
            switch (Tabmix.prefs.getIntPref("sessions.onClose")) {
               case 0:
                  Services.prefs.setIntPref("extensions.sessionmanager.backup_session", 1);
                  break;
               case 1:
                  Services.prefs.setIntPref("extensions.sessionmanager.backup_session", 2);
                  break;
               default:
                  Services.prefs.setIntPref("extensions.sessionmanager.backup_session", 0);
            }
         }
         if (TMP_crashRecovery_enabled) {
            Services.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, false);
            Services.prefs.setBoolPref("browser.sessionstore.resume_from_crash", true);
         }
         TabmixSvc.sm.settingPreference = false;
      }
      else if (this.isSessionStoreEnabled()) {
         // ask the user to choose between TMP session manager and sessionstore
         // we use non modal promptService on start up, so we disabled Tabmix session managerto let the startup
         // process continue and set the appropriate preference after the dialog prompt dismissed.
         if (start) {
            Services.prefs.setBoolPref(TMP_SS_MANAGER, false);
            Services.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, false);
         }
         let title = "TabMix " + TabmixSvc.getSMString("sm.title");
         let msg = start ? TabmixSvc.getSMString("sm.disable.msg") + "\n\n" : "";
         msg += TabmixSvc.getSMString("sm.disable.msg" + msgNo);
         let bunService = Cc["@mozilla.org/intl/stringbundle;1"].
                       getService(Ci.nsIStringBundleService);
         let bundle = bunService.createBundle("chrome://global/locale/commonDialogs.properties");
         let buttons = [bundle.GetStringFromName("Yes"), bundle.GetStringFromName("No")].join("\n");
         let self = this;
         let callBack = function (aResult) {
            if ((msgNo == 1 && aResult.button == 1) || ((msgNo == 2 && aResult.button === 0))) {
              self.setSessionRestore(false);
              Services.prefs.setBoolPref(TMP_SS_MANAGER, TMP_manager_enabled);
              Services.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, TMP_crashRecovery_enabled);
            }
            else {
              // we don't change any of sessionstore default setting
              // the user will be ask on exit what to do.
              // (browser.warnOnRestart and browser.warnOnQuit are both true on default)
              Services.prefs.setBoolPref(TMP_SS_MANAGER, false);
              Services.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, false);
           }
           TabmixSvc.sm.settingPreference = false;
         };
         let result = Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.HIDE_MENUANDTEXT, Tabmix.HIDE_CHECKBOX],
               [title, msg, "", "", buttons], window, start ? callBack : null);
         if (!start)
           callBack(result);
      }
      // when user start new profile or update from firefox 2.0 profile
      // browser.warnOnRestart and browser.warnOnQuit are both true on default
      else if (!Services.prefs.prefHasUserValue("browser.warnOnRestart") ||
                !Services.prefs.prefHasUserValue("browser.warnOnQuit ")) {
         if (!Tabmix.isVersion(200))
           Services.prefs.setBoolPref("browser.warnOnRestart", false);
         Services.prefs.setBoolPref("browser.warnOnQuit", false);
         TabmixSvc.sm.settingPreference = false;
      }
   },

   isSessionStoreEnabled: function () {
     return Services.prefs.getIntPref("browser.startup.page") == 3 ||
            Services.prefs.getBoolPref("browser.sessionstore.resume_from_crash");
   },

   afterSwitchThemes: false,
   // we call this only one time on window load
   // and store the value in Tabmix.isWindowAfterSessionRestore
   // we call this from onContentLoaded before nsSessionStore run its onLoad
   setAfterSessionRestored: function () {
      let afterSessionRestore;
      if (!Tabmix.isFirstWindow)
         afterSessionRestore = false;
      // When we close all browser windows without exit (non browser windows are opened)
      // Firefox reopen last closed window when a browser window opens
      else if (Tabmix.numberOfWindows(false, null) > 1) {
         if ((Tabmix.prefs.getBoolPref("sessions.manager") ||
              Tabmix.prefs.getBoolPref("sessions.crashRecovery")) &&
              TabmixSvc.ss.getClosedWindowCount() > 0) {
           Services.prefs.setBoolPref("browser.sessionstore.resume_session_once", true);
         }
         afterSessionRestore = true;
      }
      else if (this.afterSwitchThemes)
         afterSessionRestore = true;

      if (typeof afterSessionRestore == "boolean")
        Tabmix.isWindowAfterSessionRestore = afterSessionRestore;
      else {
         // calling doRestore before sessionstartup finished to read
         // sessionstroe.js file throw error since Firefox 28, and force
         // syncRead in Firefox 25-27
         XPCOMUtils.defineLazyGetter(Tabmix, "isWindowAfterSessionRestore", function() {
            let ss = Cc["@mozilla.org/browser/sessionstartup;1"].
                          getService(Ci.nsISessionStartup);
            // when TMP session manager is enabled ss.doRestore is true only after restart
            if (!Tabmix.isVersion(250, 250))
              return ss.doRestore();
            ss.onceInitialized.then(function() {
              Tabmix.isWindowAfterSessionRestore = ss.doRestore();
            }).then(null, Tabmix.reportError);
            // until sessionstartup initialized just return the pref value,
            // we only use isWindowAfterSessionRestore when our Session Manager enable
            return Services.prefs.getBoolPref("browser.sessionstore.resume_session_once");
         });
      }
   },

   setSessionRestore: function (aEnable) {
     if (!Tabmix.isVersion(200))
        Services.prefs.setBoolPref("browser.warnOnRestart", aEnable);
      Services.prefs.setBoolPref("browser.warnOnQuit", aEnable);
      Services.prefs.setBoolPref("browser.sessionstore.resume_from_crash", aEnable);
      if (aEnable)
        Services.prefs.setIntPref("browser.startup.page", 3);
      else if (Services.prefs.getIntPref("browser.startup.page") == 3)
        Services.prefs.setIntPref("browser.startup.page", 1);
   },

  /**
   * @brief           update tab title from user name or bookmark.
   *
   * @param aTabData  an object value - tabData from nsSessionStore
   *
   * @param aUri      string value - url address
   *
   * @param aTitle    string value - title
   *
   * @returns         tab title - string.
   */
   _getTitle: function ct_getTitle(aData, aUri, aTitle) {
      var fixedLabelUri = this._getAttribute(aData, "label-uri");
      if (fixedLabelUri == aUri || fixedLabelUri == "*")
         return this._getAttribute(aData, "fixed-label");

      return TMP_Places.getTitleFromBookmark(aUri, aTitle, this._getAttribute(aData, "tabmix_bookmarkId"));
   },

   /**
    * @brief           get attribute xultab data
    *
    * @param aTabData  an object value - tabData from nsSessionStore
    *
    * @param attrib    attribute name as string
    *
    * @returns         attribute value as string or empty string.
    */
   _getAttribute: function TMP_ss__getAttribute(aTabData, attrib) {
      if (aTabData.attributes && attrib in aTabData.attributes)
         return aTabData.attributes[attrib];

      // restore attributes from the legacy Firefox 2.0/3.0 format
      if (aTabData.xultab) {
         var xultab = aTabData.xultab.split(" ");
         for ( var i= 0; i < xultab.length; i++ ){
            if (/^([^\s=]+)=(.*)/.test(xultab[i]) && RegExp.$1 == attrib)
               return decodeURI(RegExp.$2);
         }
      }
      return  "";
   }

};

var TMP_ClosedTabs = { // jshint ignore:line
   _buttonBroadcaster: null,
   get buttonBroadcaster() {
      if (!this._buttonBroadcaster)
        this._buttonBroadcaster = document.getElementById("tmp_undocloseButton");
      return this._buttonBroadcaster;
   },

   // make btn_undoclose single-functionality or dual-functionality
   setButtonType: function(menuOnly) {
      var buttonType = menuOnly ? "menu" : "menu-button";
      if (this.buttonBroadcaster.getAttribute("type") != buttonType)
         this.buttonBroadcaster.setAttribute("type", buttonType);
   },

   setButtonDisableState: function ct_setButtonDisableState(aState) {
      if (typeof(aState) == "undefined")
         aState = this.count === 0;
      Tabmix.setItem(this.buttonBroadcaster, "disabled", aState || null);
   },

  /**
    * Get closed tabs count
    */
   get count() {
      return window.__SSi ? TabmixSvc.ss.getClosedTabCount(window) : 0;
   },

  /**
    * Get closed tabs data
    */
   get getClosedTabData() {
      return window.__SSi ? TabmixSvc.JSON.parse(TabmixSvc.ss.getClosedTabData(window)) : {};
   },

   getUrl: function ct_getUrl(aTabData) {
      return TMP_SessionStore.getActiveEntryData(aTabData.state).url;
   },

   getTitle: function ct_getTitle(aTabData, aUri) {
      return TMP_SessionStore._getTitle(aTabData.state, aUri, aTabData.title);
   },

   /* .......... functions for closedtabs list menu and context menu .......... */

   populateUndoSubmenu: function ct_populateUndoSubmenu(aPopup) {
      if (TabmixAllTabs.isAfterCtrlClick(aPopup.parentNode))
         return false;

      TabmixAllTabs.beforeCommonList(aPopup, true);

      // populate menu
      var closedTabs = this.getClosedTabData;
      var m, ltr = Tabmix.ltr;
      for (let i = 0; i < closedTabs.length; i++) {
         m = document.createElement("menuitem");
         var tabData = closedTabs[i];
         // Grab the title and uri (make the uri friendly text)
         var url = this.getUrl(tabData);
         var title = this.getTitle(tabData, url);
         var _uri = makeURI(url);
         if ( _uri.scheme == "about" && title === "" )
            url = title = "about:blank";
         else try {
            url = _uri.scheme + ":\/\/" + _uri.hostPort + _uri.path;
         } catch (e) {
            url = title;
         }
         var label = title ? title : url;
         let count = "";
         if (ltr) {
            count = (i<9 ? "  " : "") + (i + 1) + ": ";
            if (i+1 < 10)
               m.setAttribute("accesskey", i+1);
            else if (i+1 == 10)
               m.setAttribute("accesskey", 0);
         }
         m.setAttribute("label", count + label);
         m.setAttribute("tooltiptext", label + "\n" + url);
         m.setAttribute("statustext", url);

         var iconURL = tabData.image;
         if (iconURL) {
            if (/^https?:/.test(iconURL))
               iconURL = "moz-anno:favicon:" + iconURL;
            m.setAttribute("image", iconURL);
         }
         m.setAttribute("class", "menuitem-iconic bookmark-item menuitem-with-favicon");
         m.setAttribute("value", i);
         m.setAttribute("oncommand", "TMP_ClosedTabs.restoreTab('original', " + i + ");");
         m.addEventListener("click", TMP_ClosedTabs.checkForMiddleClick, false);
         if (i === 0)
            m.setAttribute("key", "key_undoCloseTab");
         aPopup.appendChild(m);
      }

      aPopup.appendChild(document.createElement("menuseparator"));
      // "Clear Closed Tabs List"
      m = aPopup.appendChild(document.createElement("menuitem"));
      m.setAttribute("id", "clearClosedTabsList");
      m.setAttribute("label", TabmixSvc.getString("undoclosetab.clear.label"));
      m.setAttribute("value", -1);
      m.addEventListener("command", function() {
         TMP_ClosedTabs.restoreTab('original', -1);
      });

      // "Restore All Tabs"
      m = aPopup.appendChild(document.createElement("menuitem"));
      m.setAttribute("id", "restoreAllClosedTabs");
      m.setAttribute("label", gNavigatorBundle.getString("menuRestoreAllTabs.label"));
      m.setAttribute("value", -2);
      m.addEventListener("command", function() {
         TMP_ClosedTabs.restoreTab('original', -2);
      });
      return true;
   },

   checkForMiddleClick: function ct_checkForMiddleClick(aEvent) {
      if (aEvent.button != 1)
         return;

      var index = aEvent.originalTarget.value;
      if (index < 0)
         return;

      let deleteItem = Tabmix.prefs.getBoolPref("middleclickDelete");
      TMP_ClosedTabs.restoreTab(deleteItem ? "delete" : "tab", index);
      if (deleteItem && TMP_ClosedTabs.count > 0) {
        aEvent.stopPropagation();
        TMP_ClosedTabs.populateUndoSubmenu(aEvent.originalTarget.parentNode);
      }
      else
         closeMenus(aEvent.target);
   },

   addBookmarks: function ct_addBookmarks(index) {
      var tabData = this.getClosedTabData[index];
      var url = this.getUrl(tabData);
      var title = this.getTitle(tabData, url);
      PlacesCommandHook.bookmarkLink(PlacesUtils.bookmarksMenuFolderId, url, title);
   },

   copyTabUrl: function ct_copyTabUrl(index) {
      var tabData = this.getClosedTabData[index];
      var url = this.getUrl(tabData);
      var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                      .getService(Components.interfaces.nsIClipboardHelper);

      clipboard.copyString(url);
   },

   restoreTab: function ct_restoreTab(aWhere, aIndex) {
      switch (aWhere) {
         case "window":
            this.SSS_restoreToNewWindow(aIndex);
            break;
         case "delete":
            this.getClosedTabAtIndex(aIndex);
            break;
         case "original":
            if (aIndex == -1) {
               this.removeAllClosedTabs();
               break;
            }
            else if (aIndex == -2) {
               this.SSS_restoerClosedTabs(this.count);
               break;
            }
            // else do the default
            /* falls through */
         default:
            this.SSS_undoCloseTab(aIndex, aWhere, true);
      }

      // Reset the number of tabs closed last time to the default.
      Tabmix.setNumberOfTabsClosedLast(1);
   },

   removeAllClosedTabs: function () {
      // update our session data
      var updateRDF = TabmixSessionManager.enableBackup && Tabmix.prefs.getBoolPref("sessions.save.closedtabs");
      if (updateRDF)
        TabmixSessionManager.deleteWinClosedtabs(TabmixSessionManager.gThisWin);
      while (this.count)
        TabmixSvc.ss.forgetClosedTab(window, 0);
      this.setButtonDisableState(true);
   },

  /**
   * @brief           fetch the data of closed tab, while removing it from the array
   * @param aIndex    a Integer value - 0 or grater index to remove
   * @returns         closed tab data at aIndex.
   */
   getClosedTabAtIndex: function ct_getClosedTabAtIndex(aIndex) {
      if (0 > aIndex || aIndex >= this.count)
        return null;
      // update our session data
      if (TabmixSessionManager.enableBackup)
        TabmixSessionManager.deleteClosedtabAt(this.count - aIndex);

      var closedTab = this.getClosedTabData.splice(aIndex, 1).shift();
      TabmixSvc.ss.forgetClosedTab(window, aIndex);
      this.setButtonDisableState();
      return closedTab;
   },

   SSS_restoreToNewWindow: function ct_restoreToNewWindow(aIndex) {
      var tabData = this.getClosedTabAtIndex(aIndex);
      // we pass the current tab as a place holder for tabData
      var state = TabmixSvc.JSON.stringify(tabData ? tabData.state : {});
      return gBrowser.duplicateTabToWindow(gBrowser.mCurrentTab, null, state);
   },

   SSS_restoerClosedTabs: function ct_SSS_restoerClosedTabs(closedTabCount) {
      if (!PlacesUIUtils._confirmOpenInTabs(closedTabCount))
         return null;

      this.setButtonDisableState(true);

      // catch blank tabs
      var blankTabs = [];
      for (let i = 0; i < gBrowser.tabs.length ; i++) {
         if (gBrowser.isBlankNotBusyTab(gBrowser.tabs[i]))
            blankTabs.push(gBrowser.tabs[i]);
      }

      var tab, multiple = closedTabCount > 1;
      for (let i = 0; i < closedTabCount; i++) {
         let blankTab = blankTabs.pop() || null;
         tab = this.SSS_undoCloseTab(0, "original", i === 0, blankTab, multiple);
      }

      // remove unused blank tabs
      while(blankTabs.length > 0){
         let blankTab = blankTabs.pop();
         blankTab.collapsed = true;
         gBrowser.removeTab(blankTab);
      }

      return tab;
   },

   SSS_undoCloseTab: function ct_SSS_undoCloseTab(aIndex, aWhere, aSelectRestoredTab, aTabToRemove, skipAnimation) {
      if (!Tabmix.prefs.getBoolPref("undoClose") || this.count === 0)
         return null;

      // get tab data
      var tabData = this.getClosedTabAtIndex(aIndex);
      var cTab = gBrowser.mCurrentTab;
      if (aWhere == "current") {
         aTabToRemove = cTab;
         tabData.pos = cTab._tPos;
      }
      else if (typeof(aTabToRemove) == "undefined" && gBrowser.isBlankNotBusyTab(cTab))
         aTabToRemove = cTab;

      if (TMP_TabView.installed)
         TabView.prepareUndoCloseTab(aTabToRemove);

      if (aTabToRemove)
         aTabToRemove.collapsed = true;

      var newTab = gBrowser.addTab("about:blank", {skipAnimation: aTabToRemove || skipAnimation, dontMove: true});
      newTab.linkedBrowser.stop();
      // if tababr is hidden when there is only one tab and
      // we replace that tab with new one close the current tab fast so the tab bar don't have time to reveale
      if (aTabToRemove)
         gBrowser.removeTab(aTabToRemove);
      // add restored tab to current window
      TabmixSvc.ss.setTabState(newTab, TabmixSvc.JSON.stringify(tabData.state));

      if (TMP_TabView.installed)
         TabView.afterUndoCloseTab();

      // after we open new tab we only need to fix position if this is true
      // we don't call moveTabTo from add tab if it called from sss_undoCloseTab
      var restorePosition = Tabmix.prefs.getBoolPref("undoClosePosition");
      if (aWhere == "current" || (aWhere == "original" && restorePosition)) {
         gBrowser.moveTabTo(newTab, Math.min(gBrowser.tabs.length - 1, tabData.pos));
      }
      else if (aWhere != "end" && Tabmix.getOpenTabNextPref()) {
         let newTabPos = (gBrowser._lastRelatedTab || gBrowser.selectedTab)._tPos + 1;
         gBrowser.moveTabTo(newTab, newTabPos);
      }

      if (aSelectRestoredTab) {
         window.focus();
         gBrowser.TMP_selectNewForegroundTab(newTab, false, null, false);
      }

      return newTab;
   },

   undoCloseTab: function ct_undoCloseTab(aIndex, aWhere) {
      let numberOfTabsToUndoClose = 1;
      let index = Number(aIndex);
      if (isNaN(index)) {
        index = 0;
        if (Tabmix._restoreMultipleTabs)
          numberOfTabsToUndoClose = TabmixSvc.ss.getNumberOfTabsClosedLast(window);
      } else if (0 > index || index >= this.count)
        return null;

      let tab = null;
      if (numberOfTabsToUndoClose > 1)
        tab = this.SSS_restoerClosedTabs(numberOfTabsToUndoClose);
      else
        tab = this.SSS_undoCloseTab(index, aWhere || "original", true);

      // Reset the number of tabs closed last time to the default.
      Tabmix.setNumberOfTabsClosedLast(1);
      return tab;
   }

};

var TabmixConvertSession = { // jshint ignore:line
   get getTitle() {
      return TabmixSvc.getString("incompatible.title") + " - " + TabmixSvc.getSMString("sm.title");
   },

   getString: function cs_getString(aEntity) {
      return TabmixSvc.getSMString("sm.extension.convert." + aEntity);
   },

   startup: function cs_startup() {
      if (!Tabmix.firstWindowInSession)
        return;

      if (!Tabmix.extensions.sessionManager || "tabmix_afterTabduplicated" in window || !Tabmix.isFirstWindow)
        return;

      var sessions = TabmixSessionManager.getSessionList();
      if (!sessions)
         return;

      if(TabmixSessionManager.nodeHasArc("rdf:gSessionManager", "status"))
         return;

      TabmixSessionManager.setLiteral("rdf:gSessionManager", "status", "converted");
      TabmixSessionManager.saveStateDelayed();
      var callBack = function (aResult) {
                  if (aResult.button == Tabmix.BUTTON_OK) {
                    setTimeout(function (a,b) {
                      TabmixConvertSession.convertFile(a, b);
                    }, 50, null, true);
                  }
                 };
      this.confirm(this.getString("msg1") + "\n\n" + this.getString("msg2"), callBack);
   },

   selectFile: function cs_selectFile(aWindow) {
      const nsIFilePicker = Ci.nsIFilePicker;
      var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
      var fpCallback = function fpCallback_done(aResult) {
         if (aResult == nsIFilePicker.returnOK)
            this.convertFile(fp.fileURL.spec);
      }.bind(this);

      fp.init(aWindow, this.getString("selectfile"), nsIFilePicker.modeOpen);
      fp.defaultString="session.rdf";
      fp.appendFilter(this.getString("rdffiles"), "*.rdf");
      fp.appendFilter(this.getString("sessionfiles"), "*session*.*");
      fp.appendFilters(nsIFilePicker.filterText | nsIFilePicker.filterAll);
      if (Tabmix.isVersion(180))
        fp.open(fpCallback);
      else
        fpCallback(fp.show());
   },

   convertFile: function cs_convertFile(aFileUri, aSilent) {
      if (TabmixSvc.sessionManagerAddonInstalled) {
         let tmp = {};
         Cu.import("chrome://sessionmanager/content/modules/session_convert.jsm", tmp);
         tmp.SessionConverter.convertTMP(aFileUri, aSilent);
      }
      else {
         let sm = com.morac.SessionManagerAddon.gSessionManagerWindowObject;
         sm.doTMPConvertFile(aFileUri, aSilent);
      }
   },

   confirm: function cs_confirm(aMsg, aCallBack) {
      let bunService = Cc["@mozilla.org/intl/stringbundle;1"].
                       getService(Ci.nsIStringBundleService);
      let bundle = bunService.createBundle("chrome://global/locale/commonDialogs.properties");
      let buttons = [bundle.GetStringFromName("Yes"), bundle.GetStringFromName("No")].join("\n");
      return Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.HIDE_MENUANDTEXT, Tabmix.HIDE_CHECKBOX],
            [this.getTitle, aMsg, "", "", buttons], window, aCallBack);
   },

   getSessionState: function cs_getSessionState(aPath) {
      var _windows = [], tabsCount = 0;
      var sessionEnum = TabmixSessionManager.initContainer(aPath).GetElements();
      while (sessionEnum.hasMoreElements()) {
         let rdfNodeWindow = sessionEnum.getNext();
         if (rdfNodeWindow instanceof Ci.nsIRDFResource) {
            let windowPath = rdfNodeWindow.QueryInterface(Ci.nsIRDFResource).Value;
            if (TabmixSessionManager.nodeHasArc(windowPath, "dontLoad"))
               continue;
            let aWindowState = this.getWindowState(rdfNodeWindow);
            if (aWindowState) {// don't save empty windows
               _windows.push(aWindowState);
               tabsCount += aWindowState.tabs.length;
            }
         }
      }
      return { windows: _windows, tabsCount: tabsCount };
   },

   getWindowState: function cs_getWindowState(rdfNodeWindow) {
      var state = { tabs: [], selected: 0, _closedTabs: [] };

      var rdfNodeTabs = TabmixSessionManager.getResource(rdfNodeWindow, "tabs");
      if (!(rdfNodeTabs instanceof Ci.nsIRDFResource) || TabmixSessionManager.containerEmpty(rdfNodeTabs)) {
         return null;
      }
      state.tabs = this.getTabsState(rdfNodeTabs);
      state._closedTabs = this.getClosedTabsState(TabmixSessionManager.getResource(rdfNodeWindow, "closedtabs"));
      state.selected = TabmixSessionManager.getIntValue(rdfNodeWindow, "selectedIndex") + 1;
      // we don't save windowState in Tabmix, just get the current windowState for all the sessions
      state.sizemode = (window.windowState == window.STATE_MAXIMIZED) ? "maximized" : "normal";

      // save panorama data if exist
      let extData = {};
      function setExtData(id) {
         let data = TabmixSessionManager.getLiteralValue(rdfNodeWindow, id, null);
         if (data)
            extData[id] = data;
      }
      let tabview = ["tabview-groups", "tabview-group", "tabview-ui"];
      tabview.forEach(setExtData);
      // only save tabview-visibility if tabview-groups exist
      if (extData["tabview-groups"])
         setExtData("tabview-visibility");

      // save TabGroupsManagerAllGroupsData
      let jsonText = TabmixSessionManager.getLiteralValue(rdfNodeWindow, "tgm_jsonText");
      if (jsonText)
         extData.TabGroupsManagerAllGroupsData = TabmixSessionManager.getDecodedLiteralValue(null, jsonText);

      if (Object.keys(extData).length)
         state.extData = extData;
      return state;
   },

   getTabsState: function cs_getTabsState(rdfNodeTabs, internal) {
      var _tabs = [], tabsData = [];

      function _tabData(rdfTab) {
        this.node = rdfTab;
        this.index = TabmixSessionManager.getIntValue(rdfTab, "tabPos");
      }
      _tabData.prototype.toString = function() { return this.index; };

      var tabsEnum = TabmixSessionManager.initContainer(rdfNodeTabs).GetElements();
      while (tabsEnum.hasMoreElements()) {
         let rdfNodeTab = tabsEnum.getNext();
         if (rdfNodeTab instanceof Ci.nsIRDFResource) {
            tabsData.push(new _tabData(rdfNodeTab));
         }
      }
      tabsData.sort(function (a, b) {return a - b;});
      for (let i = 0; i < tabsData.length ; i++) {
         let tab = this.getTabState(tabsData[i].node, false, internal);
         if (tab)
            _tabs.push(tab);
      }

      return _tabs;
   },

   getClosedTabsState: function cs_getClosedTabsState(rdfNodeTabs) {
      var _tabs = [];
      var tabsEnum = TabmixSessionManager.initContainer(rdfNodeTabs).GetElements();
      while (tabsEnum.hasMoreElements()) {
         let rdfNodeTab = tabsEnum.getNext();
         let state = rdfNodeTab instanceof Ci.nsIRDFResource &&
                       this.getTabState(rdfNodeTab, true);
         if (state) {
            let closedTab = {};
            closedTab.state = state;
            closedTab.title = closedTab.state.entries[closedTab.state.index - 1].title;
            closedTab.image = state.image;
            closedTab.pos = TabmixSessionManager.getIntValue(rdfNodeTab, "tabPos");
            let closedAt = TabmixSessionManager.getLiteralValue(rdfNodeTab, "closedAt");
            closedTab.closedAt = parseInt(closedAt) || Date.now();
            // we use revers order in the RDF format
            _tabs.unshift(closedTab);
         }
      }
      return _tabs;
   },

   getTabState: function cs_getTabState(rdfNodeTab, aClosedTab, internal) {
      var tabData = {entries:[], index: 0, zoom: 1, disallow:"", text:""};
      tabData.entries = this.getHistoryState(rdfNodeTab);
      if (!tabData.entries.length)
        return null;
      tabData.image = TabmixSessionManager.getLiteralValue(rdfNodeTab, "image", null);
      let index = TabmixSessionManager.getIntValue(rdfNodeTab, "index");
      tabData.index = Math.max(1, Math.min(index + 1, tabData.entries.length));
      var scroll = TabmixSessionManager.getLiteralValue(rdfNodeTab, "scroll", "0,0");
      if (scroll.startsWith("{")) {
        tabData.scroll = JSON.parse(scroll);
      }
      else {
      // until version 0.4.1.5 textZoom was included in scroll data
        scroll = scroll.split(",").splice(0, 2).join(",");
        if (scroll != "0,0") {
          tabData.scroll = {scroll: scroll};
        }
      }

      var properties = TabmixSessionManager.getLiteralValue(rdfNodeTab, "properties");
      var tabAttribute = ["Images","Subframes","MetaRedirects","Plugins","Javascript"];

      var booleanAttrLength = TabmixSessionData.tabAttribute.length + TabmixSessionData.docShellItems.length;
      var tabProperties = properties.substr(0, booleanAttrLength);
      var disallow = [];
      for (let j = 0; j < tabAttribute.length; j++) {
         if (tabProperties.charAt(j+2) != "1")
            disallow.push(tabAttribute[j]);
      }
      tabData.disallow = disallow.join(",");
      tabData.attributes = {};
      if (tabProperties.charAt(0) == "1" && properties.indexOf("protected=") == -1)
         tabData.attributes["protected"] = "true";
      if (properties.indexOf("_locked=") == -1)
         tabData.attributes["_locked"] = (tabProperties.charAt(1) == "1");

      var extData = {};
      if (properties.length > booleanAttrLength) {
        // TST add data to our properties with "|" separator
        let TSTProps = properties.split('|');
        properties = TSTProps.shift();
        let PREFIX = "tmp-session-data-";
        TSTProps.forEach(function(aProp) {
          if (/^([^\s=]+)=(.*)/.test(aProp) &&
              RegExp.$1.startsWith(PREFIX) && RegExp.$2)
            extData[RegExp.$1.substr(PREFIX.length)] = decodeURIComponent(RegExp.$2);
        });
        properties = properties.substr(booleanAttrLength + 1).split(" ");
        properties.forEach(function(aAttr) {
          aAttr = TabmixSessionManager.getDecodedLiteralValue(null, aAttr);
          if (!/^([^\s=]+)=(.*)/.test(aAttr))
            return;
          let isTrue = RegExp.$2 == "true";
          switch (RegExp.$1) {
            case "tabgroups-data":
              // TGM data
              if (internal) {
                // for Tabmix SessionManager use
                extData.__tabmixTGM = RegExp.$2;
                break;
              }
              let [groupId, groupName] = RegExp.$2.split(" ");
              extData.TabGroupsManagerGroupId = groupId;
              extData.TabGroupsManagerGroupName = groupName;
              break;
            case "faviconized":
              if (isTrue)
                extData.faviconized = true;
              break;
            case "pinned":
            case "hidden":
              if (isTrue)
                tabData[RegExp.$1] = true;
              break;
            // colorfulTabs data
            case "ctreadonly":
              extData.ctreadonly = RegExp.$2;
              break;
            case "tabClr":
              extData.tabClr = RegExp.$2;
              break;
            default:
              tabData.attributes[RegExp.$1] = RegExp.$2;
          }
        });
      }
      // save panorama data if exist
      if (!aClosedTab) {
        let data = TabmixSessionManager.getLiteralValue(rdfNodeTab, "tabview-tab");
        if (data !== "")
          extData["tabview-tab"] = data;
      }
      if (Object.keys(extData).length)
        tabData.extData = extData;
      return tabData;
   },

   getHistoryState: function cs_getHistoryState(rdfNodeTab) {
      let decodeData = function(data, decode) {
        return decode ? TabmixSessionManager.getDecodedLiteralValue(null, data) : data;
      };
      var history = TabmixSessionManager.getLiteralValue(rdfNodeTab, "history");
      var tmpData = history.split("|-|");
      var sep = tmpData.shift(); // remove seperator from data
      tmpData = tmpData.join("|-|");
      // if all history data was encoded (file saved with version
      // 0.4.1.2pre.131006a1 or newer, changeset 684a4b2302e4)
      // decode it now, else decode each entry separately
      let newFormat = tmpData.indexOf(sep) == -1;
      tmpData = decodeData(tmpData, newFormat);
      var historyData = tmpData.split(sep);
      var historyCount = historyData.length/3;
      var entries = [];
      for (let i = 0; i < historyCount; i++) {
         let entry = { url:"", children:[], ID: 0};
         let index = i * 3;
         entry.url = historyData[index + 1];
         if (!entry.url)
            continue;
         entry.title = decodeData(historyData[index], !newFormat);
         entry.scroll = historyData[index + 2];
         entries.push(entry);
      }
      return entries;
   }
};
