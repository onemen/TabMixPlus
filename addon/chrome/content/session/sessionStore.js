/*
 * chrome://tabmixplus/content/session/sessionStore.js
 *
 * original code by onemen
 *
 */
var TMP_SessionStore = {
   // make sure sessionstore is init
   _ssInited: null,
   initService: function TMP_ss_start() {
     if (this._ssInited)
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
     let selectedTab = aUndoItem.tabs[aUndoItem.selected - 1];
     if (!selectedTab.entries || selectedTab.entries.length == 0)
       return;
     let activeIndex = (selectedTab.index || selectedTab.entries.length) - 1;
     if (activeIndex >= selectedTab.entries.length)
       activeIndex = selectedTab.entries.length - 1;
     let tabData = selectedTab.entries[activeIndex];
     let url = selectedTab.attributes["label-uri"];
     if (url == tabData.url || url == "*")
       aUndoItem.title = selectedTab.attributes["fixed-label"];
     else {
       aUndoItem.title = TMP_getTitleFromBookmark(tabData.url, aUndoItem.title || tabData.title || tabData.url);
       if (aUndoItem.title == "about:blank") {
         let string = Tabmix.isVersion(40) ?  "tabs.emptyTabTitle" : "tabs.untitled";
         aUndoItem.title = gBrowser.mStringBundle.getString(string);
       }
     }
   },

   /**
    * @brief       - Add attribute to nsSessionStore persistTabAttribute.
    *
    * @param doInit   a Boolean value - true when we need to init nsISessionStore.
    *
    * @returns        Nothing.
    */
   _persistTabAttributeSet: null,
   persistTabAttribute: function TMP_ss_persistTabAttribute() {
      if (this._persistTabAttributeSet)
         return;

      var aTab = gBrowser.tabContainer.firstChild;
      if (aTab != gBrowser.mCurrentTab) {
         aTab.removeAttribute("visited");
         aTab.removeAttribute("flst_id");
      };

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

         this._persistTabAttributeSet = true;
      } catch(ex) {
         Tabmix.log("nsSessionStore could not add Attribute to persistTabAttribute: " + ex + "\n");
      }
   },

   /**
    * @brief         make sure that we don't enable both sessionStore and session manager
    *
    * @param msgNo   a Integer value - msg no. to show.
    *
    * @param start   a Boolean value - true if we call this function before startup.
    *
    * @returns       Nothing.
    */
   setService: function TMP_ss_setSessionService(msgNo, start, win) {
      if ("tabmix_setSession" in window || TabmixSvc.prefs.prefHasUserValue("extensions.tabmix.setDefault"))
         return;
     /*
      * From 2008-03-10 we don't set browser.sessionstore.enabled to false anymore
      * we use nsISessionStore service in TMP.
      * if we use TMP session manager we set all other sessionstore pref to false to disable SessionRestore
      *
      * Bug 449596 – remove the browser.sessionstore.enabled pref
      * so here we don't set it to true, we just clear user pref to the default
      * if the pref exist in firefox this set the pref to true
      * if the pref don't exist this will remove the pref
      */
      const TMP_SS_MANAGER = "extensions.tabmix.sessions.manager";
      const TMP_SS_CRASHRECOVERY = "extensions.tabmix.sessions.crashRecovery";
      var TMP_manager_enabled = TabmixSvc.prefs.getBoolPref(TMP_SS_MANAGER);
      var TMP_crashRecovery_enabled = TabmixSvc.prefs.getBoolPref(TMP_SS_CRASHRECOVERY);
      if (!TMP_manager_enabled && !TMP_crashRecovery_enabled) {
         return;
      }

      window.tabmix_setSession = true;
      // if session manager extension is install disable TMP session manager
      if (Tabmix.extensions.sessionManager) {
         // update session manager settings accourding to current tabmix settings
         if (TMP_manager_enabled) {
            TabmixSvc.prefs.setBoolPref(TMP_SS_MANAGER, false);
            switch (TabmixSvc.SMprefs.getIntPref("onStart")) {
               case 0:
                  TabmixSvc.prefs.setIntPref("extensions.sessionmanager.startup", 0);
                  TabmixSvc.prefs.setIntPref("browser.startup.page", 3);
                  break;
               case 1:
                  TabmixSvc.prefs.setIntPref("extensions.sessionmanager.startup", 1);
                  break;
               //default: nothing to do
            }
            switch (TabmixSvc.SMprefs.getIntPref("onClose")) {
               case 0:
                  TabmixSvc.prefs.setIntPref("extensions.sessionmanager.backup_session", 1);
                  break;
               case 1:
                  TabmixSvc.prefs.setIntPref("extensions.sessionmanager.backup_session", 2);
                  break;
               default:
                  TabmixSvc.prefs.setIntPref("extensions.sessionmanager.backup_session", 0);
            }
         }
         if (TMP_crashRecovery_enabled) {
            TabmixSvc.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, false);
            TabmixSvc.prefs.setBoolPref("browser.sessionstore.resume_from_crash", true);
         }
         delete window.tabmix_setSession;
      }
      else if (this.isSessionStoreEnabled()) {
         // ask the user to choose between TMP session manager and sessionstore
         // we use non modal promptService on start up, so we disabled Tabmix session managerto let the startup
         // process continue and set tothe appropriate after the dialog prompt dismissed.
         if (start) {
            TabmixSvc.prefs.setBoolPref(TMP_SS_MANAGER, false);
            TabmixSvc.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, false);
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
            if ((msgNo == 1 && aResult.button == 1) || ((msgNo == 2 && aResult.button == 0))) {
              self.setSessionRestore(false);
              TabmixSvc.prefs.setBoolPref(TMP_SS_MANAGER, TMP_manager_enabled);
              TabmixSvc.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, TMP_crashRecovery_enabled);
            }
            else {
              // we don't change any of sessionstore default setting
              // the user will be ask on exit what to do. (browser.warnOnRestart and browser.warnOnQuit are both true on default)
              TabmixSvc.prefs.setBoolPref(TMP_SS_MANAGER, false);
              TabmixSvc.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, false);
           }
           delete window.tabmix_setSession;
         }
         let result = Tabmix.promptService([TMP_BUTTON_OK, TMP_HIDE_MENUANDTEXT, TMP_HIDE_CHECKBOX],
               [title, msg, "", "", buttons], window, start ? callBack : null);
         if (!start)
           callBack(result);
      }
      // when user start new profile or update from firefox 2.0 profile browser.warnOnRestart and browser.warnOnQuit are both true on default
      else if (!TabmixSvc.prefs.prefHasUserValue("browser.warnOnRestart") ||
                !TabmixSvc.prefs.prefHasUserValue("browser.warnOnQuit ")) {
         TabmixSvc.prefs.setBoolPref("browser.warnOnRestart", false);
         TabmixSvc.prefs.setBoolPref("browser.warnOnQuit", false);
         delete window.tabmix_setSession;
      }
   },

   isSessionStoreEnabled: function () {
     return TabmixSvc.prefs.getIntPref("browser.startup.page") == 3 ||
            TabmixSvc.prefs.getBoolPref("browser.sessionstore.resume_from_crash");
   },

   afterSwitchThemes: false,
   // we call this only one time on window load
   // and store the value in Tabmix.isWindowAfterSessionRestore
   _isAfterSessionRestored: function () {
      if (!Tabmix.isFirstWindow)
         return false;

      // in Firefox 4.0+ when we close all browser windows without exit (non browser windows are opened)
      // Firefox restore next browser window that open
      if (Tabmix.numberOfWindows(false, null) > 1)
         return Tabmix.isVersion(40);

      var ss = Cc["@mozilla.org/browser/sessionstartup;1"].
                    getService(Ci.nsISessionStartup);
      // when TMP session manager is enabled ss.doRestore is true only after restart
      return ss.doRestore() || this.afterSwitchThemes;
   },

   setSessionRestore: function (aEnable) {
      TabmixSvc.prefs.setBoolPref("browser.warnOnRestart", aEnable);
      TabmixSvc.prefs.setBoolPref("browser.warnOnQuit", aEnable);
      TabmixSvc.prefs.setBoolPref("browser.sessionstore.resume_from_crash", aEnable);
      if (aEnable)
        TabmixSvc.prefs.setIntPref("browser.startup.page", 3);
      else if (TabmixSvc.prefs.getIntPref("browser.startup.page") == 3)
        TabmixSvc.prefs.setIntPref("browser.startup.page", 1);
   },

  /**
   * @brief           update tab title from user name or bookmark.
   *
   * @param aTabData  an object value - tabData from nsSessionStore
   *
   * @param aUri      string value - url address
   *
   * @param aTitle      string value - title
   *
   * @returns         tab title - string.
   */
   _getTitle: function ct_getTitle(aData, aUri, aTitle) {
      var fixedLabelUri = this._getAttribute(aData, "label-uri");
      if (fixedLabelUri == aUri || fixedLabelUri == "*")
         return this._getAttribute(aData, "fixed-label");

      return TMP_getTitleFromBookmark(aUri, aTitle, this._getAttribute(aData, "tabmix_bookmarkId"));
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
      // tabData.attributes is in use for Firefox 3.5+
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

}

var TMP_ClosedTabs = {
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
         aState = this.count == 0;
      aState = aState ? "true" : "false";
      if (this.buttonBroadcaster.getAttribute("disabled") != aState)
         this.buttonBroadcaster.setAttribute("disabled", aState);
   },

  /**
    * Get closed tabs count
    */
   get count() {
      return TabmixSvc.ss.getClosedTabCount(window);
   },

  /**
    * Get closed tabs data
    */
   get getClosedTabData() {
      return Tabmix.JSON.parse(TabmixSvc.ss.getClosedTabData(window));
   },

   getUrl: function ct_getUrl(aTabData) {
      var history = aTabData.state;
      var activeIndex = (history.index || history.entries.length) - 1;
      return history.entries[activeIndex].url;
   },

   getTitle: function ct_getTitle(aTabData, aUri) {
      return TMP_SessionStore._getTitle(aTabData.state, aUri, aTabData.title);
   },

   /* .......... functions for closedtabs list menu and context menu .......... */

   populateUndoSubmenu: function ct_populateUndoSubmenu(aPopup) {
      if (TabmixAllTabs.isAfterCtrlClick(aPopup.parentNode))
         return false;

      TabmixAllTabs.beforeCommonList(aPopup);

      // populate menu
      var closedTabs = this.getClosedTabData;
      var ltr = Tabmix.ltr;
      for (let i = 0; i < closedTabs.length; i++) {
         var m = document.createElement("menuitem");
         var tabData = closedTabs[i];
         // Grab the title and uri (make the uri friendly text)
         var url = this.getUrl(tabData);
         var title = this.getTitle(tabData, url);
         var _uri = makeURI(url);
         if ( _uri.scheme == "about" && title == "" )
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
         m.setAttribute("oncommand", "TMP_ClosedTabs.restoreTab('original', " + i + "); event.stopPropagation();");
         m.addEventListener("click", TMP_ClosedTabs.checkForMiddleClick, false);
         if (i == 0)
            m.setAttribute("key", "key_undoCloseTab");
         aPopup.appendChild(m);
      }

      aPopup.appendChild(document.createElement("menuseparator"));
      // "Clear Closed Tabs List"
      m = aPopup.appendChild(document.createElement("menuitem"));
      m.setAttribute("id", "clearClosedTabsList");
      m.setAttribute("label", TabmixSvc.getString("undoclosetab.clear.label"));
      if (!Tabmix.isVersion(40))
        m.setAttribute("accesskey", TabmixSvc.getString("undoclosetab.clear.accesskey"));
      m.setAttribute("value", -1);
      m.setAttribute("oncommand", "TMP_ClosedTabs.restoreTab('original', -1); event.stopPropagation();");

      // "Restore All Tabs"
      m = aPopup.appendChild(document.createElement("menuitem"));
      m.setAttribute("id", "restoreAllClosedTabs");
      if (Tabmix.isVersion(36)) {
        m.setAttribute("label", gNavigatorBundle.getString("menuRestoreAllTabs.label"));
        if (!Tabmix.isVersion(40))
          m.setAttribute("accesskey", gNavigatorBundle.getString("menuRestoreAllTabs.accesskey"));
      }
      else {
        m.setAttribute("label", gNavigatorBundle.getString("menuOpenAllInTabs.label"));
        m.setAttribute("accesskey", gNavigatorBundle.getString("menuOpenAllInTabs.accesskey"));
      }
      m.setAttribute("value", -2);
      m.setAttribute("oncommand", "TMP_ClosedTabs.restoreTab('original', -2); event.stopPropagation();");
      return true;
   },

   checkForMiddleClick: function ct_checkForMiddleClick(aEvent) {
      if (aEvent.button != 1)
         return;

      aEvent.stopPropagation();
      var index = aEvent.originalTarget.value;
      if (index < 0)
         return;

      var where = TabmixSvc.TMPprefs.getBoolPref("middleclickDelete") ? 'delete' : 'tab';
      TMP_ClosedTabs.restoreTab(where, index);
      var popup = aEvent.originalTarget.parentNode;
      if (TMP_ClosedTabs.count > 0)
         TMP_ClosedTabs.populateUndoSubmenu(popup);
      else {
         popup.hidePopup();
         if (popup.parentNode.id != "btn_undoclose")
            popup.parentNode.parentNode.hidePopup();
      }
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
               this.getClosedTabAtIndex(aIndex);
               return;
            }
            else if (aIndex == -2) {
               this.SSS_restoerAllClosedTabs();
               return;
            }
            // else do the default
         default:
            this.SSS_undoCloseTab(aIndex, aWhere, true);
      }
   },

  /**
   * @brief           fetch the data of closed tab, while removing it from the array
   * @param aIndex    a Integer value - 0 or grater index to remove
   *                  other value empty the list.
   * @returns         closed tab data at aIndex.
   *
   * we can use ss.forgetClosedTab(window, index) from Firefox ? after ?
   *
   */
   getClosedTabAtIndex: function ct_getClosedTabAtIndex(aIndex) {
      // update our session data
      var updateRDF = TabmixSessionManager.enableBackup && TabmixSvc.SMprefs.getBoolPref("save.closedtabs");
      if (updateRDF) {
        if (aIndex >= 0)
           TabmixSessionManager.deleteClosedtabAt(this.count - aIndex);
        else
           TabmixSessionManager.deleteWinClosedtabs(TabmixSessionManager.gThisWin);
      }

      var closedTab;
      var state = { windows: [], _firstTabs: true };
      state.windows[0] = {tabs:[], _closedTabs: [] };
      // if aIndex is not > 0 we just past empy list to setWindowState
      // it's like remove all closed tabs from the list
      if (aIndex >= 0) {
         state.windows[0]._closedTabs = this.getClosedTabData;
         // purge closed tab at aIndex
         closedTab = state.windows[0]._closedTabs.splice(aIndex, 1).shift();
      }

      // replace existing _closedTabs
      try {
        TabmixSvc.ss.setWindowState(window, Tabmix.isVersion(40) ? Tabmix.JSON.stringify(state) : state.toSource(), false);
      } catch (e) {}

      this.setButtonDisableState();
      return closedTab;
   },

   SSS_restoreToNewWindow: function ct_restoreToNewWindow(aIndex) {
      var tabData = this.getClosedTabAtIndex(aIndex);
      // we pass the current tab as reference to this window
      return gBrowser.duplicateInWindow(gBrowser.mCurrentTab, null, tabData);
   },

   SSS_restoerAllClosedTabs: function ct_SSS_restoerAllClosedTabs() {
      var closedTabCount = this.count;
      if (!PlacesUIUtils._confirmOpenInTabs(closedTabCount))
         return;

      this.setButtonDisableState(true);

      var aTab, blankTab;
      // catch blank tab
      var blankTabs = [];
      for (var i = 0; i < gBrowser.tabs.length ; i++) {
         if (gBrowser.isBlankNotBusyTab(gBrowser.tabs[i]))
            blankTabs.push(gBrowser.tabs[i]);
      }

      var multiple = closedTabCount > 1;
      for (i = 0; i < closedTabCount; i++) {
         blankTab = blankTabs.pop();
         this.SSS_undoCloseTab(0, "original", i==0, blankTab, Tabmix.isVersion(40) && multiple);
      }

      // remove unused blank tabs
      while(blankTabs.length > 0){
         blankTab = blankTabs.pop();
         blankTab.collapsed = true;
         gBrowser.removeTab(blankTab);
      }

      gBrowser.tabContainer.nextTab = 1;
   },

   SSS_undoCloseTab: function ct_SSS_undoCloseTab(aIndex, aWhere, aSelectRestoredTab, aTabToRemove, skipAnimation) {
      if (!TabmixSvc.TMPprefs.getBoolPref("undoClose") || this.count == 0)
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

      if ("TabView" in window)
        TabView.prepareUndoCloseTab(aTabToRemove);

      if (aTabToRemove)
         aTabToRemove.collapsed = true;

      var newTab = aTabToRemove || skipAnimation ? gBrowser.addTab("about:blank", {skipAnimation: true}) : gBrowser.addTab("about:blank");
      newTab.linkedBrowser.stop();
      // if tababr is hidden when there is only one tab and
      // we replace that tab with new one close the current tab fast so the tab bar don't have time to reveale
      if (aTabToRemove)
         gBrowser.removeTab(aTabToRemove);
      // add restored tab to current window
      TabmixSvc.ss.setTabState(newTab, Tabmix.isVersion(40) ? Tabmix.JSON.stringify(tabData.state) : tabData.state.toSource());

      if ("TabView" in window)
        TabView.afterUndoCloseTab();

      // after we open new tab we only need to fix position if this is true
      var restorePosition = TabmixSvc.TMPprefs.getBoolPref("undoClosePosition");
      if ( aWhere == "current" || (aWhere == "original" && restorePosition) ) {
         gBrowser.TMmoveTabTo(newTab, Math.min(gBrowser.tabs.length - 1, tabData.pos), 1);
      }
      else if (aWhere != "end" && TMP_getOpenTabNextPref()) // middle click on History > recently closed tabs
         // we don't call TMP_openTabNext from add tab if it called from sss_undoCloseTab
         gBrowser.TMP_openTabNext(newTab);

      if (aSelectRestoredTab) {
         content.focus();
         gBrowser.TMP_selectNewForegroundTab(newTab, false, null, false);
      }

      return newTab;
   },

   undoCloseTab: function ct_undoCloseTab(aIndex, aWhere) {
      return this.SSS_undoCloseTab(aIndex || 0, aWhere || "original", true);
   }

}

var TabmixConvertSession = {
   get getTitle() {
      return TabmixSvc.getString("incompatible.title") + " - " + TabmixSvc.getSMString("sm.title");
   },

   getString: function cs_getString(aEntity) {
      return TabmixSvc.getSMString("sm.extension.convert." + aEntity);
   },

   startup: function cs_startup() {
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
                  if (aResult.button == TMP_BUTTON_OK) {
                    setTimeout(function (a,b) {
                      com.morac.gSessionManagerWindowObject.doTMPConvertFile(a,b);
                    }, 0, null, true);
                  }
                 }
      this.confirm(this.getString("msg1") + "\n\n" + this.getString("msg2"), callBack);
   },

   selectFile: function cs_selectFile(aWindow) {
      const nsIFilePicker = Ci.nsIFilePicker;
      var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

      fp.init(aWindow, this.getString("selectfile"), nsIFilePicker.modeOpen);
      fp.defaultString="session.rdf";
      fp.appendFilter(this.getString("rdffiles"), "*.rdf");
      fp.appendFilter(this.getString("sessionfiles"), "*session*.*");
      fp.appendFilters(nsIFilePicker.filterText | nsIFilePicker.filterAll);

      if (fp.show() != nsIFilePicker.returnOK)
         return;

      this.convertFile(fp.fileURL.spec);
   },

   convertFile: function cs_convertFile(aFileUri) {
      com.morac.gSessionManagerWindowObject.doTMPConvertFile(aFileUri);
   },

   confirm: function cs_confirm(aMsg, aCallBack) {
      let bunService = Cc["@mozilla.org/intl/stringbundle;1"].
                       getService(Ci.nsIStringBundleService);
      let bundle = bunService.createBundle("chrome://global/locale/commonDialogs.properties");
      let buttons = [bundle.GetStringFromName("Yes"), bundle.GetStringFromName("No")].join("\n");
      return Tabmix.promptService([TMP_BUTTON_OK, TMP_HIDE_MENUANDTEXT, TMP_HIDE_CHECKBOX],
            [this.getTitle, aMsg, "", "", buttons], window, aCallBack);
   },

   getSessionState: function cs_getSessionState(aPath) {
      var _windows = [], tabsCount = 0;
      var sessionEnum = TabmixSessionManager.initContainer(aPath).GetElements();
      while (sessionEnum.hasMoreElements()) {
         var rdfNodeWindow = sessionEnum.getNext();
         if (rdfNodeWindow instanceof Ci.nsIRDFResource) {
            var windowPath = rdfNodeWindow.QueryInterface(Ci.nsIRDFResource).Value;
            if (TabmixSessionManager.nodeHasArc(windowPath, "dontLoad"))
               continue;
            var aWindowState = this.getWindowState(rdfNodeWindow);
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
      return state;
   },

   getTabsState: function cs_getTabsState(rdfNodeTabs) {
      var _tabs = [], tabsData = [];

      function _tabData(rdfTab) {
        this.node = rdfTab;
        this.index = TabmixSessionManager.getIntValue(rdfTab, "tabPos");
      }
      _tabData.prototype.toString = function() { return this.index; }

      var tabsEnum = TabmixSessionManager.initContainer(rdfNodeTabs).GetElements();
      while (tabsEnum.hasMoreElements()) {
         let rdfNodeTab = tabsEnum.getNext();
         if (rdfNodeTab instanceof Ci.nsIRDFResource) {
            tabsData.push(new _tabData(rdfNodeTab));
         }
      }

      tabsData.sort(function (a, b) {return a - b;});
      for (let i = 0; i < tabsData.length ; i++)
         _tabs.push(this.getTabState(tabsData[i].node));

      return _tabs;
   },

   getClosedTabsState: function cs_getClosedTabsState(rdfNodeTabs) {
      var _tabs = [];
      var tabsEnum = TabmixSessionManager.initContainer(rdfNodeTabs).GetElements();
      while (tabsEnum.hasMoreElements()) {
         var rdfNodeTab = tabsEnum.getNext();
         if (rdfNodeTab instanceof Ci.nsIRDFResource) {
            var closedTab = {};
            closedTab.state = this.getTabState(rdfNodeTab);
            closedTab.title = closedTab.state.entries[closedTab.state.index - 1].title;
            closedTab.image = TabmixSessionManager.getLiteralValue(rdfNodeTab, "image");
            closedTab.pos = TabmixSessionManager.getIntValue(rdfNodeTab, "tabPos");
            // we use in the RDF revers order
            _tabs.unshift(closedTab);
         }
      }
      return _tabs;
   },

   getTabState: function cs_getTabState(rdfNodeTab) {
      var tabData = {entries:[], index: 0, zoom: 1, disallow:"", extData: null, text:""};
      tabData.entries = this.getHistoryState(rdfNodeTab);
      tabData.index = TabmixSessionManager.getIntValue(rdfNodeTab, "index") + 1;
      tabData.zoom = TabmixSessionManager.getLiteralValue(rdfNodeTab, "scroll").split(",")[2];
      var properties = TabmixSessionManager.getLiteralValue(rdfNodeTab, "properties");
      var tabAttribute = ["Images","Subframes","MetaRedirects","Plugins","Javascript"];

      var booleanAttrLength = TabmixSessionData.tabAttribute.length + TabmixSessionData.docShellItems.length;
      var tabProperties = properties.substr(0, booleanAttrLength);
      var disallow = [];
      for (var j = 0; j < tabAttribute.length; j++ ) {
         if (tabProperties.charAt(j+2) != "1")
            disallow.push(tabAttribute[j]);
      }
      tabData.disallow = disallow.join(",");
      var xultab = [];
      // xultab replace in firefox 3.5+ with tabData.attributes
      // but nsSessionStore can still read xultab
      tabData.attributes = {};
      if (tabProperties.charAt(0) == "1" && properties.indexOf("protected=") == -1)
         tabData.attributes["protected"] = "true";
      if (properties.indexOf("_locked=") == -1)
         tabData.attributes["_locked"] = (tabProperties.charAt(1) == "1");

      if (properties.length > booleanAttrLength) {
         properties = properties.substr(booleanAttrLength + 1).split(" ");
         properties.forEach(function(aAttr) {
           if (/^([^\s=]+)=(.*)/.test(aAttr)) {
             tabData.attributes[RegExp.$1] = RegExp.$2;
           }
         });
      }
      return tabData;
   },

   getHistoryState: function cs_getHistoryState(rdfNodeTab) {
      var tmpData = TabmixSessionManager.getLiteralValue(rdfNodeTab, "history").split("|-|");
      var sep = tmpData.shift(); // remove seperator from data
      var historyData = tmpData.join("|-|").split(sep);
      var historyCount = historyData.length/3;
      var entries = [];
      for ( var i = 0; i < historyCount; i++ ){
         var entry = { url:"", children:[], ID: 0};
         var index = i * 3;
         entry.url = historyData[index + 1];
         entry.title = unescape(historyData[index]);
         entry.scroll = historyData[index + 2];
         entries.push(entry);
      }
      return entries;
   },

  sessionManagerOptions: function SM_sessionManagerOptions() {
    if ("com" in window && com.morac &&
        com.morac.gSessionManager) {
      com.morac.gSessionManager.openOptions();
    }
    else
      gSessionManager.openOptions();
  }
}
