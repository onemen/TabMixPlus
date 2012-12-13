Tabmix.BUTTON_OK = 0;
Tabmix.BUTTON_CANCEL = 1;
Tabmix.BUTTON_EXTRA1 = 2;
Tabmix.SHOW_MENULIST = 1;
Tabmix.SHOW_TEXTBOX = 0;
Tabmix.HIDE_MENUANDTEXT = 2;
Tabmix.CHECKBOX_UNCHECKED = 0;
Tabmix.CHECKBOX_CHECKED = 1;
Tabmix.HIDE_CHECKBOX = 2;
Tabmix.SELECT_DEFAULT = 0;
Tabmix.SELECT_LASTSESSION = 1;
Tabmix.SELECT_CRASH = 2;
Tabmix.SHOW_CLOSED_WINDOW_LIST = 3;
Tabmix.DLG_SAVE = 0;
Tabmix.DLG_RENAME = 1;
Tabmix.NO_NEED_TO_REPLACE = -1;

/**
 *  sanitize privte data by delete the files session.rdf session.old
 */
Tabmix.Sanitizer = {
   isSanitizeTMPwithoutPrompet: function (aOnExit) {
     /*
      * The behavior is:
      *   - Tools > Clear Recent History... - Always show the UI
      *   - about:privatebrowsing clearing your recent history  - Always show the UI
      *   - clear private data on exit - NEVER show the UI
      */
      var promptOnSanitize = !aOnExit;
      // if promptOnSanitize is true we call Tabmix.Sanitizer.sanitize from Firefox Sanitizer
      if (promptOnSanitize)
         return false;

      try {
         var sanitizeTabmix = Services.prefs.getBoolPref("privacy.clearOnShutdown.extensions-tabmix");
      } catch (e) { sanitizeTabmix = false;}

      return sanitizeTabmix;
   },

   tryToSanitize: function (aOnExit) {
      if (this.isSanitizeTMPwithoutPrompet(aOnExit)) {
        this.sanitize();
        return true;
      }

      // History sanitize remove closed tab data from session restore
      // we need to update closed tab button state
      var _windows = Tabmix.windowEnumerator();
      while (_windows.hasMoreElements()) {
         _windows.getNext().TMP_ClosedTabs.setButtonDisableState();
      }

      return false;
   },

// XXX need to add test if we fail to delete then alert the user or ....?
   sanitize: function TMP_SN_sanitize() {
      // get file references
      var sessionFile = Services.dirsvc.get("ProfD", Components.interfaces.nsILocalFile);
      var sessionFileBackup = sessionFile.clone();
      var sessionsBackupDir = sessionFile.clone()
      sessionFile.append("session.rdf");
      sessionFileBackup.append("session.old");
      sessionsBackupDir.append("sessionbackups");

      // remove the files from the disk
      this.clearDisk(sessionFile);
      this.clearDisk(sessionFileBackup);
      this.clearDisk(sessionsBackupDir);

      // init new DATASource for all open window
      var enumerator = Tabmix.windowEnumerator();
      while ( enumerator.hasMoreElements() ) {
         let wnd = enumerator.getNext();

         // clear DATASource
         delete wnd.gBrowser.windowID;
         let _sessionManager = wnd.TabmixSessionManager;
         // Make sure to break session manager cycle with the save timer
         if (_sessionManager._saveTimer) {
            _sessionManager._saveTimer.cancel();
            _sessionManager._saveTimer = null;
         }

         _sessionManager.corruptedFile = false;
         _sessionManager.RDFService.UnregisterDataSource(_sessionManager.DATASource);
         // init new DATASource
         _sessionManager.initDATASource();

         // disable closed window list button
         wnd.Tabmix.setItem("tmp_closedwindows", "disabled", true);

         // clear closed tabs and disable the button if we use TMP session manager and save close tabs
         if ((TabmixSessionManager.enableManager || TabmixSessionManager.enableBackup) && TabmixSessionManager.saveClosedTabs) {
            wnd.TMP_ClosedTabs.restoreTab("original", -1);
            wnd.TMP_ClosedTabs.setButtonDisableState();
         }
      }
      // for the case Tabmix session manager is off
      TabmixSessionManager.notifyClosedWindowsChanged();

      // set flag for next start
      Tabmix.prefs.setBoolPref("sessions.sanitized" , true);
   },

   clearDisk: function (aFile) {
      if (aFile.exists()) {
         try {
            aFile.remove(aFile.isDirectory());
         }
         catch (ex) { dump(ex + "\n"); Tabmix.assert(ex);} // couldn't remove the file - what now?
      }
   }

}

var TabmixSessionData = {
   docShellItems: ["Images","Subframes","MetaRedirects","Plugins","Javascript"],
   tabAttribute:  ["protected","locked"],

   getTabProperties: function sData_getTabProperties(aTab, checkPref) {
      if (typeof(checkPref) == "undefined") checkPref = false; // pref check is only for session manager
      var tabProperties = "", temp;
      for ( var j = 0; j < this.tabAttribute.length; j++ ){
         temp = aTab.hasAttribute(this.tabAttribute[j]) ? aTab.getAttribute(this.tabAttribute[j]) : "false";
         tabProperties += (temp=="true") ? "1" : "0";
      }
      // if save.permissions is false we save all Permissions as on, so if we change this pref after session
      // was saved, the session will load with Permissions as on.
      if (checkPref && !Tabmix.prefs.getBoolPref("sessions.save.permissions"))
        tabProperties += "11111";
      else {
         var aTabDocShell = gBrowser.getBrowserForTab(aTab).docShell;
         for ( j = 0; j < this.docShellItems.length; j++ ){
            tabProperties += aTabDocShell["allow" + this.docShellItems[j]] ? "1" : "0";
         }
      }

      // save fixed label data
      if (aTab.hasAttribute("fixed-label")) {
         temp = " fixed-label=" + encodeURI(aTab.getAttribute("fixed-label"));
         temp += " label-uri=" + encodeURI(aTab.getAttribute("label-uri"));
         tabProperties += temp;
      }

      // save reload data
      if (aTab.getAttribute("reload-data")) {
          tabProperties += " reload-data=" + encodeURI(aTab.getAttribute("reload-data"));
      }

      // save data for bookmark tab title
      if (aTab.getAttribute("tabmix_bookmarkId")) {
          tabProperties += " tabmix_bookmarkId=" + encodeURI(aTab.getAttribute("tabmix_bookmarkId"));
      }

      // save faviconized attribute
      if (aTab.getAttribute("faviconized") == "true") {
          tabProperties += " faviconized=true";
      }

      if (aTab.pinned)
          tabProperties += " pinned=true";
      tabProperties += " hidden=" + aTab.hidden;

      if ("colorfulTabs" in window) {
        try {
          let ctreadonly = colorfulTabs.clrSession.getTabValue(aTab,"ctreadonly");
          if (ctreadonly)
            tabProperties += " ctreadonly=" + ctreadonly;
          let tabClr = colorfulTabs.clrSession.getTabValue(aTab, "tabClr");
          if (tabClr)
            tabProperties += " tabClr=" + encodeURI(tabClr);
        } catch (ex) {}
      }

      return tabProperties;
   },

   setTabProperties: function(aTab, tabProperties, checkPref) {
      var booleanAttrLength = this.tabAttribute.length + this.docShellItems.length;
      if (typeof(checkPref) == "undefined") checkPref = false; // pref check is only for session manager
      if (tabProperties.length > booleanAttrLength) {
         var tabData = {xultab: ""};
         tabData.xultab = tabProperties.substr(booleanAttrLength + 1);
         var fixedLabel = TMP_SessionStore._getAttribute(tabData, "fixed-label");
         if (fixedLabel) {
            aTab.setAttribute("fixed-label", fixedLabel);
            aTab.setAttribute("label-uri", TMP_SessionStore._getAttribute(tabData, "label-uri"));
         }
         var reloadData = TMP_SessionStore._getAttribute(tabData, "reload-data");
         if (reloadData) {
            aTab.setAttribute("reload-data", reloadData);
            reloadData = reloadData.split(" ");
            Tabmix.autoReload.initTab(aTab);
            aTab.setAttribute("_reload", true);
            aTab.autoReloadEnabled = true;
            aTab.autoReloadURI = reloadData[0];
            aTab.autoReloadTime = reloadData[1];
         }
         var bmitemid = TMP_SessionStore._getAttribute(tabData, "tabmix_bookmarkId");
         if (bmitemid) {
           // make sure the id exist before using it
            try {
               let title = PlacesUtils.bookmarks.getItemTitle(bmitemid);
               aTab.setAttribute("tabmix_bookmarkId", bmitemid);
            } catch (ex) { }
         }
         var faviconized = TMP_SessionStore._getAttribute(tabData, "faviconized");
         if (faviconized && "faviconize" in window && faviconize.enable) {
           faviconize.enable(aTab);
         }

         // we set this attribute in loadOneWindow _tabData
         if (!checkPref) {
            let pinned = TMP_SessionStore._getAttribute(tabData, "pinned");
            if (pinned)
              gBrowser.pinTab(aTab);
            else
              gBrowser.unpinTab(aTab);

            if (TMP_SessionStore._getAttribute(tabData, "hidden") == "true")
              gBrowser.hideTab(aTab);
            else
              gBrowser.showTab(aTab);
         }

         if ("colorfulTabs" in window) {
           try {
             let ctreadonly = TMP_SessionStore._getAttribute(tabData, "ctreadonly");
             if (ctreadonly)
               colorfulTabs.clrSession.setTabValue(aTab,"ctreadonly", ctreadonly);
             let tabClr = TMP_SessionStore._getAttribute(tabData, "tabClr");
             if (tabClr)
               colorfulTabs.setColor(aTab, tabClr);
           } catch (ex) {}
         }

      }

      tabProperties = tabProperties.substr(0, booleanAttrLength);
      var k = this.tabAttribute.length;
      for ( var j = 0; j < k; j++ ){
         //extensions.tabmix.sessions.save.protected && extensions.tabmix.sessions.save.locked
         var attrib = this.tabAttribute[j];
         if (!checkPref || Tabmix.prefs.getBoolPref("sessions.save." + attrib)) {
            Tabmix.setItem(aTab, attrib, tabProperties.charAt(j) == "1" || null);
         }
      }
      if (TabmixTabbar.lockallTabs || aTab.hasAttribute("locked"))
         Tabmix.setItem(aTab, "_locked", aTab.hasAttribute("locked"));

      if (checkPref && !Tabmix.prefs.getBoolPref("sessions.save.permissions")) return;
      var aPermission;
      var aTabDocShell = gBrowser.getBrowserForTab(aTab).docShell;
      for ( j = 0; j < this.docShellItems.length; j++ ) {
         aPermission = tabProperties.charAt(j + k) == "1";
         if (aTabDocShell["allow" + this.docShellItems[j]] != aPermission)
            aTabDocShell["allow" + this.docShellItems[j]] = aPermission;
      }
   },

  getTabValue: function TMP_sData_getTabValue(tab, id, parse) {
    var existingData = parse ? null : "";
    try {
      var tabData = TabmixSvc.ss.getTabValue(tab, id);
      if (tabData != "" && tabData != "{}" && tabData != "null") {
        if (parse)
          existingData = Tabmix.JSON.parse(tabData);
        else
          existingData = tabData;
      }
    } catch (ex) {Tabmix.assert(ex);}

    return existingData;
  },

  getWindowValue: function TMP_sData_getWindowValue(win, id, parse) {
    var existingData = parse ? {} : "";
    try {
      var data = TabmixSvc.ss.getWindowValue(win, id);
      if (data) {
        if (parse)
          existingData = Tabmix.JSON.parse(data);
        else
          existingData = data;
      }
    } catch (ex) {Tabmix.assert(ex);}

    return existingData;
  }
}

var TabmixSessionManager = {
    _rdfRoot: "rdf://tabmix",
    HSitems: 3,
    NC_TM:[],
    gSessionPath: ["", "", "", ""],
    gThisWin: null,
    gThisWinTabs: null,
    gThisWinClosedtabs: null,
    RDFService: null,
    CONUtils: null,
    DATASource: null,
    IOService: null,
    overwriteWindow: false,
    saveThisWindow: true,
    NC_NS : "http://home.netscape.com/NC-rdf#",
    enableBackup: null,
    enableManager: null,
    enableSaveHistory: null,
    saveClosedtabs: null,
    corruptedFile: false,
    afterTabSwap: false,
    _inited: false,

    afterCrash: false,

    // whether we are in private browsing mode
    _inPrivateBrowsing: false,

   get prefBranch() {
      delete this.prefBranch;
      return this.prefBranch = Services.prefs.getBranch("extensions.tabmix.sessions.");
   },

   // call by Tabmix.startup
   init: function SM_init() {
      if (this._inited)
         return;
      this._inited = true;

      // just in case tablib isn't init yet
      // when Webmail Notifier extension istalled and user have master password
      // we can get here before the browser window is loaded
      tablib.init();

      var _afterTabduplicated = "tabmix_afterTabduplicated" in window && window.tabmix_afterTabduplicated;
      var isFirstWindow = Tabmix.isFirstWindow && !_afterTabduplicated;

      let obs = Services.obs;
      obs.addObserver(this, "browser-window-change-state", true);
      obs.addObserver(this, "private-browsing", true);
      obs.addObserver(this, "private-browsing-change-granted", true);
      obs.addObserver(this, "quit-application-requested", true);
      obs.addObserver(this, "browser-lastwindow-close-requested", true);
      obs.addObserver(this, "sessionstore-windows-restored", true);
      obs.addObserver(this, "sessionstore-browser-state-restored", true);

      this.enableManager = this.prefBranch.getBoolPref("manager") && !this._inPrivateBrowsing;
      this.enableBackup = this.prefBranch.getBoolPref("crashRecovery") && !this._inPrivateBrowsing;
      this.enableSaveHistory = this.prefBranch.getBoolPref("save.history");
      this.saveClosedtabs = this.prefBranch.getBoolPref("save.closedtabs") &&
                             Tabmix.prefs.getBoolPref("undoClose");
      this._lastSaveTime = Date.now();
      // check if we need to backup
      if (isFirstWindow && this.enableManager && !this.prefBranch.prefHasUserValue("sanitized")) {
         try {
           this.archiveSessions();
         }
         catch (ex) {Tabmix.assert(ex);}
      }

      if (!this.DATASource)
         this.initService();

      if (this._inPrivateBrowsing) {
         this.updateSettings();
         this.setLiteral(this.gThisWin, "dontLoad", "true");
         return;
      }

      var path, status, caller, crashed;
      if (isFirstWindow) {
         path = this._rdfRoot + "/closedSession/thisSession";
         status = this.getLiteralValue(path, "status");
         crashed = status.indexOf("crash") != -1;
         // if this isn't delete on exit, we know next time that firefox crash
         this.prefBranch.setBoolPref("crashed" , true); // we use this in setup.js;
         Services.prefs.savePrefFile(null); // store the pref immediately
         this.setLiteral(path, "status", "crash");

         // if we after sanitize, we have no data to restore
         if (this.enableManager && this.prefBranch.prefHasUserValue("sanitized")) {
            this.prefBranch.clearUserPref("sanitized");
            this.loadHomePage();
            this.saveStateDelayed();
            return;
         }

         if (!this.enableManager && (!this.enableBackup || !crashed)) {
            return;
         }

         // If sessionStore restore the session after restart we do not need to do anything
         // when all tabs are pinned, session resore add the home page on restart
         let tabmixLoading = gBrowser.tabs[0].linkedBrowser.contentDocument.tabmix_loading;
         let afterRestart = !tabmixLoading && Tabmix.isWindowAfterSessionRestore;
         if (afterRestart)
            this.onSessionRestored();
         else if (crashed)
            this.openAfterCrash(status);
         else if (this.enableManager)
            this.openFirstWindow(false);

         if (Tabmix.prefs.prefHasUserValue("warnAboutClosingTabs.timeout"))
            Tabmix.prefs.clearUserPref("warnAboutClosingTabs.timeout")
      }
      else if (this.enableManager && "tabmixdata" in window) {
         path = window.tabmixdata.path;
         caller = window.tabmixdata.caller;

         if (caller == "concatenatewindows")
            this.loadSession(path, caller, false);
         else
            this.loadOneWindow(path, "windowopenebytabmix");
      }
      // sync rdf list with sessionstore closed tab after restart
      // we need it when we delete/restore close tab
      // we need this in case that more then one window where opened before restart
      else if (this.enableManager && this.enableBackup && this.saveClosedtabs && TMP_ClosedTabs.count > 0) {
         this.initSession(this.gSessionPath[0], this.gThisWin);
         this.copyClosedTabsToRDF(this.gThisWin);
      }
      // initialize closed window list broadcaster
      var disabled = this.enableManager ? this.isClosedWindowsEmpty() : TabmixSvc.ss.getClosedWindowCount() == 0;
      Tabmix.setItem("tmp_closedwindows", "disabled", disabled || null);

      this.saveStateDelayed();
   },

   // we call this function after session restored by sessionStore, after restart or after exit private-browsing
   onSessionRestored: function SM_onSessionRestored(aKeepClosedWindows) {
      // sync rdf list with sessionstore closed tab after restart
      // we need it when we delete/restore close tab
      if (this.enableBackup && this.saveClosedtabs && TMP_ClosedTabs.count > 0) {
         this.initSession(this.gSessionPath[0], this.gThisWin);
         this.copyClosedTabsToRDF(this.gThisWin);
      }

      // we keep the old session after restart.
      // just remove the restore session from close window list
      // if we are not exiting private browsing mode
      var sessionContainer = this.initContainer(this.gSessionPath[0]);
      if (!aKeepClosedWindows)
        this.deleteWithProp(sessionContainer, "status", "saved");
      // all the windows that opened by restart will save again with new windowID
      // mark all current data with dontLoad flag
      var rdfNodeThisWin = this.RDFService.GetResource(this.gThisWin);
      var windowEnum = sessionContainer.GetElements();
      while (windowEnum.hasMoreElements()) {
         var rdfNodeWindow = windowEnum.getNext();
         // skip this window....
         if (rdfNodeThisWin == rdfNodeWindow)
            continue;
         this.setLiteral(rdfNodeWindow, "dontLoad", "true");
      }
   },

   // call by TMP_eventListener.onWindowClose and TabmixSessionManager.canQuitApplication, see tablib.js for more
   deinit: function SM_deinit(aLastWindow, askBeforSave, aPopUp) {
      // When Exit Firefox:
      //       pref "extensions.tabmix.sessions.onClose"
      //       0 - Save
      //       1 - Ask me before Save
      //       2 (or else) - Don't Save
      // we check this when last window is about to close for all other window the session is saved
      // in closed window list.
      // in the last window if the user pref in not to save we delete the closed window list.
      var resultData = {canClose: true, showMorePrompt: true, saveSession: true, removeClosedTabs: false};
      if (this.windowClosed || this._inPrivateBrowsing)
         return resultData;

      // we set aPopUp only in canQuitApplication
      if (aPopUp == null)
        aPopUp = this.checkForPopup(window);

      this.lastSaveTabsCount = this.saveOnWindowClose();
      if (!aLastWindow) {
        if (!aPopUp) {
           var thisWinSaveTime = this.getLiteralValue(this.gThisWin, "timestamp", 0);
           this.setLiteral(this.gSessionPath[0], "timestamp", thisWinSaveTime);
        }
        return resultData;
      }
      // we are on the last window........

      // we call Tabmix.Sanitizer.tryToSanitize from onWindowClose
      // we don't need to show warnBeforeSaveSession dialog if we sanitize TMP without prompet on exit
      if (Services.prefs.getBoolPref("privacy.sanitize.sanitizeOnShutdown") && Tabmix.Sanitizer.isSanitizeTMPwithoutPrompet(true))
         return resultData;

      if ( this.enableManager ) {
         var result = {button: this.prefBranch.getIntPref("onClose"), checked: this.saveClosedtabs};
         if (result.button == 1 && !askBeforSave)
            result.button = Tabmix.BUTTON_OK;
         var sessionNotEmpty = this.updateClosedWindowList(aPopUp);
         if (sessionNotEmpty && result.button == 1) { // Ask me before Save
            // result:  0 - save; 1 - cancel quit; 2 - don't save
            result = this.warnBeforeSaveSession();
            resultData.showMorePrompt = false;
            if (result.button == Tabmix.BUTTON_CANCEL) {
               resultData.canClose = false;
               return resultData;
            }
         }
         resultData.saveSession = result.button == Tabmix.BUTTON_OK;
         resultData.removeClosedTabs = this.saveClosedTabs && !result.checked;
      }
      return resultData;
   },

   saveOnWindowClose: function SM_saveOnWindowClose() {
      if (this.enableManager && this.saveThisWindow) {
         for (var i = 0; i < gBrowser.tabs.length; i++)
            gBrowser.tabs[i].removeAttribute("inrestore");
         return this.saveOneWindow(this.gSessionPath[0], "windowclosed");
      }
      return 0;
   },

   warnBeforeSaveSession: function SM_warnBeforeSaveSession() {
      window.focus();
      var title = TabmixSvc.getSMString("sm.askBeforSave.title");
      var msg = TabmixSvc.getSMString("sm.askBeforSave.msg0") + "\n\n"
                + TabmixSvc.getSMString("sm.askBeforSave.msg1");
      var chkBoxLabel = TabmixSvc.getSMString("sm.saveClosedTab.chkbox.label");
      var chkBoxState = this.saveClosedTabs ? Tabmix.CHECKBOX_CHECKED : Tabmix.HIDE_CHECKBOX;

      var stringBundle = Services.strings.createBundle("chrome://global/locale/commonDialogs.properties");
      var buttons = TabmixSvc.setLabel("sm.askBeforSave.button0")
                     + "\n" + stringBundle.GetStringFromName("Cancel")
                     + "\n" + TabmixSvc.setLabel("sm.askBeforSave.button1");
      return Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.HIDE_MENUANDTEXT, chkBoxState],
                              [title, msg, "", chkBoxLabel, buttons]);
   },

   windowIsClosing: function SM_WindowIsClosing(aCanClose, aLastWindow,
        aSaveSession, aRemoveClosedTabs, aKeepClosedWindows) {
      if (this.windowClosed || this._inPrivateBrowsing)
         return;

      this.windowClosed = aCanClose;
      var _flush = false;

      // remove the "dontLoad" flag from current window if user cancel the close
      if (this.enableManager && !aCanClose && this.removeAttribute(this.gThisWin, "dontLoad"))
        _flush = true;

      // update status flag for this window
      // when enableManager is off lastSaveTabsCount is undefined
      if (!aLastWindow && this.lastSaveTabsCount && aCanClose) {
         this.setLiteral(this.gThisWin, "status", "saved");
         this.updateClosedWindowsMenu(false);
         _flush = true;
      }

      if (aLastWindow && aCanClose) {
         if (this.enableManager) {
            if (aSaveSession) {
               var rdfNodeClosedWindows = this.RDFService.GetResource(this.gSessionPath[0]);
               var sessionContainer = this.initContainer(rdfNodeClosedWindows);
               // don't remove closed windows when entring private browsing mode
               if (!aKeepClosedWindows)
                 this.deleteWithProp(sessionContainer, "dontLoad");
               var count = this.countWinsAndTabs(sessionContainer, "dontLoad");
               this.setLiteral(rdfNodeClosedWindows, "nameExt", this.getNameData(count.win, count.tab));
               // delete closed tab list for this session
               if (aRemoveClosedTabs)
                 this.deleteAllClosedtabs(sessionContainer);
            }
            else // delete ALL closed window list.
               this.deleteSubtree(this.gSessionPath[0]);
         }
         // clean-up....
         if (this.enableBackup) this.deleteSession(this.gSessionPath[3]);
         if (Tabmix.prefs.prefHasUserValue("warnAboutClosingTabs.timeout"))
            Tabmix.prefs.clearUserPref("warnAboutClosingTabs.timeout");
         if (this.prefBranch.prefHasUserValue("crashed"))
            this.prefBranch.clearUserPref("crashed"); // we use this in setup.js;
         Services.prefs.savePrefFile(null); // store the pref immediately
         this.setLiteral(this._rdfRoot + "/closedSession/thisSession", "status", "stopped");
         if (!this.enableManager && !this.enableBackup)
            this.deleteSession(this.gSessionPath[0]);
         _flush = true;
      }
      if (_flush || this._saveTimer) {
         // Make sure to break session manager cycle with the save timer
         if (this._saveTimer) {
           this._saveTimer.cancel();
           this._saveTimer = null;
         }
         this.saveState();
      }
   },

   // called from goQuitApplication when user apply File > Exit
   // or when extensions (Mr Tech Toolkit) call goQuitApplication.
   canQuitApplication: function SM_canQuitApplication(aBackup, aKeepClosedWindows) {
       // some extension can call goQuitApplication 2nd time (like ToolKit)
       // we make sure not to run this more the one time
       if (this.windowClosed || this._inPrivateBrowsing)
          return true;
      /*
        1. save all windows
        2. call deinit to the current window (if exist ??)
        3. if user don't cancel the quit mark all windows as closed
        4. return: true if its ok to close
                   false if user cancel quit
      */
      this.saveAllWindows(this.gSessionPath[0], "windowclosed", true);
      // cheack if all open windows are popup
      var allPopups = this.checkForPopup(window);
      var wnd, enumerator;
      enumerator = Tabmix.windowEnumerator();
      while ( allPopups && enumerator.hasMoreElements() ) {
         wnd = enumerator.getNext();
         allPopups = this.checkForPopup(wnd);
      }
      var result = this.deinit(true, !aBackup, allPopups); // we fake that we are the last window
      this.windowIsClosing(result.canClose, true, result.saveSession, result.removeClosedTabs, aKeepClosedWindows);

      if (result.canClose) {
         enumerator = Tabmix.windowEnumerator();
         while ( enumerator.hasMoreElements() ) {
            wnd = enumerator.getNext();
            wnd.TabmixSessionManager.windowClosed = true;
         }
      }
      return result.canClose;
   },

   onWindowClose: function SM_onWindowClose(isLastWindow) {
    // check if we need to sanitize on exit without prompt to user
    try {
      // if tryToSanitize is false and privacy.sanitize.promptOnSanitize is true
      // we call Tabmix.Sanitizer.sanitize from Firefox Sanitizer
      var tabmixSanitized = isLastWindow &&
          Services.prefs.getBoolPref("privacy.sanitize.sanitizeOnShutdown") &&
          Tabmix.Sanitizer.tryToSanitize(true);
    }
    catch (ex) {
      tabmixSanitized = false;
    }
    if (!tabmixSanitized && this._inited) {
      this.deinit(isLastWindow, false);
      this.windowIsClosing(true, isLastWindow, true, false);
    }

    if (this._inited) {
      let obs = Services.obs;
      obs.notifyObservers(null, "browser-window-change-state", "closed");
      obs.removeObserver(this, "browser-window-change-state");
      obs.removeObserver(this, "private-browsing");
      obs.removeObserver(this, "private-browsing-change-granted");
      obs.removeObserver(this, "quit-application-requested");
      obs.removeObserver(this, "browser-lastwindow-close-requested");
      obs.removeObserver(this, "sessionstore-windows-restored");
      obs.removeObserver(this, "sessionstore-browser-state-restored");
      if (this.afterExitPrivateBrowsing) {
        clearTimeout(this.afterExitPrivateBrowsing);
        this.afterExitPrivateBrowsing = null;
      }
    }
   },

  /**
   * @brief Checks to see if a given nsIDOMWindow window is a popup or not.
   *
   * @param domWindow    A scripted nsIDOMWindow object.
   * @return             true if the domWindow is a popup, false otherwise.
   *
   */
  checkForPopup: function TMP_checkForPopup(domWindow) {
    if (!(domWindow instanceof Components.interfaces.nsIDOMWindow)) return false;

    // FIXME: locationbar, menubar, toolbar -
    // if these are hidden the window is probably a popup
    var locbarHidden = !domWindow.locationbar.QueryInterface(Components.interfaces.nsIDOMBarProp).visible;
    var menubarHidden = !domWindow.menubar.QueryInterface(Components.interfaces.nsIDOMBarProp).visible;
    try {
      var toolbarHidden = !domWindow.toolbar.QueryInterface(Components.interfaces.nsIDOMBarProp).visible;
    }
    catch (e) {
      toolbarHidden = "hidden" in domWindow.toolbar ? domWindow.toolbar.hidden : false;
    }

    // the following logic, while possibly slow, is designed
    // to catch all reasonable permutations of hidden UI
    if ((locbarHidden && menubarHidden) ||
        (menubarHidden && toolbarHidden) ||
        (locbarHidden && menubarHidden && toolbarHidden)) {
      return true;
    }

    return false;
  },

   // XXX split this for each pref that has change
   // XXX need to update after permissions, locked......
   updateSettings: function SM_updateSettings() {
      // list of session manager pref
      //          sessions.manager - ok
      //          sessions.crashRecovery - ok
      //          sessions.save.closedtabs - ok
      //          sessions.save.history - ok
      //          sessions.save.permissions - ok (update evry time this function run because lock is change)
      //          sessions.save.locked - ok (update evry time this function run because lock is change)
      //          sessions.save.protected - ok (update evry time this function run because lock is change)
      //          sessions.save.selectedtab - ok
      // xxx      sessions.save.scrollposition - ok (update with history) // xxx need to divide it
      //          undoClose -
      //          browser.sessionstore.max_tabs_undo
      //
      var sessionManager = Tabmix.prefs.getBoolPref("sessions.manager") && !this._inPrivateBrowsing;
      var crashRecovery = Tabmix.prefs.getBoolPref("sessions.crashRecovery") && !this._inPrivateBrowsing;
      var enableClosedtabs = Tabmix.prefs.getBoolPref("sessions.save.closedtabs");
      var enableSaveHistory = Tabmix.prefs.getBoolPref("sessions.save.history");
      var undoClose = Tabmix.prefs.getBoolPref("undoClose");
      var maxTabsUndo = Services.prefs.getIntPref("browser.sessionstore.max_tabs_undo");

       // hide or show session manager buttons & menus
      var showInMenu = !sessionManager || !Tabmix.prefs.getBoolPref("sessionToolsMenu");
      document.getElementById("tm-sessionmanager").hidden = showInMenu;
      let sm = document.getElementById("appmenu-sessionmanager");
      if (sm)
        sm.hidden = !sessionManager;
      var hiddenPref = !sessionManager || !Tabmix.prefs.getBoolPref("closedWinToolsMenu");
      document.getElementById("tm-sm-closedwindows").hidden = hiddenPref;
      document.getElementById("tm-sessionmanager").firstChild.childNodes[2].hidden = !hiddenPref;

      Tabmix.setItem("tmp_sessionmanagerButton", "disabled", !sessionManager || null);

      // we dont need this function to run before sessionmanager init
      if (!this.DATASource)
        return;

      var windowSaved = false, closedTabSaved = false;
      if (this.enableBackup != crashRecovery) {
         if (crashRecovery) { // save all open window and tab
            this.saveAllWindows(this.gSessionPath[0], "windowbackup");
            windowSaved = true;
         } else { // remove all backup
            this.deleteSession(this.gSessionPath[0], "status", "backup");
            this.deleteSession(this.gSessionPath[3]);
            this.initSession(this.gSessionPath[0], this.gThisWin);
            this.saveStateDelayed();
         }
         this.enableBackup = crashRecovery;
      }
      var winPath = this.gThisWin;
      if (crashRecovery)
         this.tabSelected(); // this is fast so we dont check if the pref is changed ( just for now)
      if (this.enableManager != sessionManager) {
         this.enableManager = sessionManager;
      }
      // changing in browser.sessionstore.max_tabs_undo or undoClose pref maintained in TMP_PrefObserver observe
      if (this.saveClosedtabs != enableClosedtabs && undoClose) {
         this.saveClosedtabs = enableClosedtabs && undoClose;
         if (enableClosedtabs) {
            // save if there are closed tabs and we save backup and save closedtab backup
            if (crashRecovery && TMP_ClosedTabs.count > 0 && undoClose) {
               this.initSession(this.gSessionPath[0], winPath);
               this.copyClosedTabsToRDF(winPath);
            }
            closedTabSaved = true;
         } else if (crashRecovery) {
            // if undoClose = false we delete all in TMP_PrefObserver observe
            if (undoClose) this.deleteWinClosedtabs(winPath); // flush only closedTabs list in session.RDF
         }
      }
      if (this.enableSaveHistory != enableSaveHistory) {
         this.enableSaveHistory = enableSaveHistory;
         if (crashRecovery) {
            if (!windowSaved) this.saveAllTab(winPath, 0);
            if (!closedTabSaved && enableClosedtabs && TMP_ClosedTabs.count > 0 && undoClose) {
               this.initSession(this.gSessionPath[0], winPath);
               this.deleteWinClosedtabs(winPath);
               this.copyClosedTabsToRDF(winPath);
               closedTabSaved = true;
            }
         }
      }
      if (closedTabSaved) {
         this.initSession(this.gSessionPath[0], this.gThisWin);
         this.saveStateDelayed();
      }
   },

   loadHomePage: function SM_loadHomePage() {
      function afterLoad(aBrowser) {
        if ("tabmix_loading" in aBrowser.contentDocument) {
          aBrowser.reload();
          delete aBrowser.contentDocument.tabmix_loading;
        }
        if (!gBrowser.isBlankBrowser(aBrowser))
          window.focus();
      }

      var homePage = gHomeButton.getHomePage();
      if ("arguments" in window && homePage == window.arguments[0]) {
        let URIs = homePage.split("|");
        this.setStripVisibility(URIs.length);
        let browser = gBrowser.selectedBrowser;
        if (homePage != "") {
          browser.addEventListener("load", function TMP_onLoad_homePage(aEvent) {
            aEvent.currentTarget.removeEventListener("load", TMP_onLoad_homePage, false);
            if ("tabmix_loading" in browser.contentDocument) {
              browser.reload();
              delete browser.contentDocument.tabmix_loading;
            }
          }, false);
          // This function throws for certain malformed URIs, so use exception handling
          // so that we don't disrupt startup
          try {
            gBrowser.loadTabs(URIs, false, true);
          } catch (e) { afterLoad(gBrowser.selectedBrowser); }
        }
        else
          afterLoad(browser);
      }
      else if (gBrowser.mCurrentTab.loadOnStartup) {
        for (var i = 0; i < gBrowser.tabs.length ; i++)
          delete gBrowser.tabs[i].loadOnStartup;
      }
      else if ("tabmix_loading" in gBrowser.selectedBrowser.contentDocument) {
        gBrowser.selectedBrowser.reload();
        delete gBrowser.selectedBrowser.contentDocument.tabmix_loading;
      }
   },

    // init common services
   initService: function() {
      this.RDFService = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                       .getService(Components.interfaces.nsIRDFService);
      this.CONUtils = Components.classes["@mozilla.org/rdf/container-utils;1"]
                           .getService(Components.interfaces.nsIRDFContainerUtils);
      this.setNC_TM();
      this.initDATASource();
   },

   initDATASource: function SM_initDATASource() {
      var file = this.profileDir;
      file.append("session.rdf");
      var uri = Services.io.newFileURI(file).spec;
      try {
         this.DATASource = this.RDFService.GetDataSourceBlocking(uri);
      } catch (e) { // corrupted session.rdf
         var title = TabmixSvc.getSMString("sm.corrupted.title");
         var msg = TabmixSvc.getSMString("sm.corrupted.msg0") + "\n"
                  + TabmixSvc.getSMString("sm.corrupted.msg1");
         var buttons = ["", TabmixSvc.setLabel("sm.button.continue")].join("\n");
         Tabmix.promptService([Tabmix.BUTTON_CANCEL, Tabmix.HIDE_MENUANDTEXT, Tabmix.HIDE_CHECKBOX],
               [title, msg, "", "", buttons], window, function(){});
         Tabmix.assert(e);
         file.moveTo(this.profileDir, "session.old");
         this.DATASource = this.RDFService.GetDataSourceBlocking(uri);
         this.corruptedFile = true;
      }

      // set path to session type
      var path = this._rdfRoot + "/closedSession/";
      var sessionType = ["thisSession", "lastSession", "previoustolastSession", "crashedsession"];
      var closedSession = this.initContainer(path);
      var i, aEntry;
      if (closedSession.GetCount()==0) { // create the list
         for (i = 0; i < sessionType.length; i++) {
            aEntry = this.RDFService.GetResource(path + sessionType[i]);
            this.setResource(aEntry, "session", this._rdfRoot + "/closed" + i + "/window");
            closedSession.AppendElement(aEntry);
         }
      }
      for (i = 0; i < sessionType.length; i++) {
         this.gSessionPath[i] = this.getResourceValue(path + sessionType[i], "session");
      }
      if (typeof(gBrowser) == "object" && !gBrowser.windowID) {
         gBrowser.windowID = this.getAnonymousId();
         this.gThisWin = this.gSessionPath[0] + "/" + gBrowser.windowID;
         this.gThisWinTabs = this.gThisWin + "/tabs";
         this.gThisWinClosedtabs = this.gThisWin + "/closedtabs";
      }
   },

   get profileDir() {
      return Services.dirsvc.get("ProfD", Components.interfaces.nsILocalFile);
   },

   getAnonymousId: function() {
      const kSaltTable = [
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
        'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
        'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '0' ];

      var id = "";
      for (var i = 0; i < 8; ++i) {
        id += kSaltTable[Math.floor(Math.random() * kSaltTable.length)];
      }
      return id;
   },

   setNC_TM: function() {
      var rdfLabels = ["tabs","closedtabs","index","history","properties","selectedIndex",
               "timestamp","title","url","dontLoad","reOpened","name","nameExt","session",
               "status","tabPos","image","scroll","winFeatures"];
      rdfLabels = rdfLabels.concat(["tabview-visibility", "tabview-group", "tabview-groups", "tabview-tab", "tabview-ui", "tabview-last-session-group-name"]);
      for (var i = 0; i < rdfLabels.length; i++) {
         this.NC_TM[rdfLabels[i]] = this.RDFService.GetResource(this.NC_NS + rdfLabels[i]);
      }
   },

   deleteNode: function(rdfNode) {
      var arcOut = this.DATASource.ArcLabelsOut(rdfNode);
      while (arcOut.hasMoreElements()) {
         var aLabel = arcOut.getNext();
         if (aLabel instanceof Ci.nsIRDFResource) {
            var aTarget = this.DATASource.GetTarget(rdfNode, aLabel, true);
            this.DATASource.Unassert(rdfNode, aLabel, aTarget);
         }
      }
   },

   deleteSubtree: function(labelRoot) {
      var allElements = this.DATASource.GetAllResources();
      while (allElements.hasMoreElements()) {
         var aResource = allElements.getNext();
         if ((aResource instanceof Ci.nsIRDFResource) && (aResource.Value.indexOf(labelRoot) == 0))
            this.deleteNode(aResource);
      }
   },

   initContainer: function(node) {
     var pNode = node;
     try {
       if (typeof(node) == "string")
         node = this.RDFService.GetResource(node);
       return this.CONUtils.MakeSeq(this.DATASource, node);
     } catch (e) {
       Tabmix.assert(e);
       return "error"
     }
   },

    // return true if node is empty container or node is not container
   containerEmpty: function(node) {
     var pNode = node;
     try {
       if (typeof(node) == "string")
         node = this.RDFService.GetResource(node);
       if (!this.CONUtils.IsContainer(this.DATASource, node))
         return true;
       return this.CONUtils.IsEmpty(this.DATASource, node);
     } catch (e) {
       Tabmix.assert(e);
       return "error"
     }
   },

   wrapContainer: function SM_wrapContainer(path, prop) {
      var root = this.getResource(path, prop);
      var container = this.initContainer(root);
if (container == "error") { Tabmix.log("wrapContainer error path " + path + "\n" + "prop " + prop); return "error"}
      return {
         Root: root,
         Container: container,
         Enum: container.GetElements(),
         Count: container.GetCount()
      }
   },

   getValue: function(node, label, typeID, def) {
      if (typeof(node) == "string") node = this.RDFService.GetResource(node);
      label = this.NC_TM[label];
      var rdfNode = this.DATASource.GetTarget(node, label, true);
      return (rdfNode instanceof Components.interfaces[typeID]) ? rdfNode.Value : def;
   },

   getLiteralValue: function(node, arc, def) {
      if (typeof(def) == "undefined") def = "";
      return this.getValue(node, arc, "nsIRDFLiteral", def);
   },

  /*
   * The escape and unescape functions are deprecated we use encodeURI and decodeURI instead.
   * we use this code only for the case that old escape string was left unused after
   * unescape was removed.
   */
   getDecodedLiteralValue: function(node, key) {
     let encodedString = node ? this.getLiteralValue(node, key) : key;
     // in the past we use escape for encoding, we try first to decode with decodeURI
     // only if we fail we use deprecated unescape
     try {
       return decodeURI(encodedString);
     }
     catch (ex) {
       let decodedString;
       try {
         // we defined lazy gette for _decode to import from Decode.jsm module
         decodedString = this._decode.unescape(encodedString);
       } catch (err) {
         Components.utils.reportError("Tabmix is unable to decode " + key + " from "
               + node.QueryInterface(Ci.nsIRDFResource).Value + "\n" + err);
         return "";
       }
       if (node && key) {
         this.setLiteral(node, key, encodeURI(decodedString));
         this.saveStateDelayed(10000);
       }
       return decodedString;
     }
   },

   getIntValue: function(node, arc, def) {
      if (typeof(def) == "undefined") def = 0;
      return this.getValue(node, arc, "nsIRDFInt", def);
   },

   getResourceValue: function(node, arc, def) {
      if (typeof(def) == "undefined") def = null;
      return this.getValue(node, arc, "nsIRDFResource", def);
   },

   getResource: function(node, arc) {
      if (typeof(node) == "string") node = this.RDFService.GetResource(node);
      arc = this.NC_TM[arc];
      return this.DATASource.GetTarget(node, arc, true);
   },

   nodeHasArc: function(node, arc) {
      if (typeof(node) == "string") node = this.RDFService.GetResource(node);
      arc = this.NC_TM[arc];
      return this.DATASource.hasArcOut(node, arc);
   },

   setLiteral: function SM_setLiteral(node, arc, value) {
      if (typeof(node) == "string") node = this.RDFService.GetResource(node);
      arc = this.NC_TM[arc];
      value = this.RDFService.GetLiteral(value);
      this.changeValue(node, arc, value);
   },

   setIntLiteral: function(node, arc, value) {
      if (typeof(node) == "string") node = this.RDFService.GetResource(node);
      arc = this.NC_TM[arc];
      value = this.RDFService.GetIntLiteral(value);
      this.changeValue(node, arc, value);
   },

   setResource: function(node, arc, value) {
      if (typeof(node) == "string") node = this.RDFService.GetResource(node);
      arc = this.NC_TM[arc];
      if (typeof(value) == "string") value = this.RDFService.GetResource(value);
      this.changeValue(node, arc, value);
   },

   changeValue: function(node, arc, newValue) {
      if (this.DATASource.hasArcOut(node, arc)) {
         var oldValue = this.DATASource.GetTarget(node, arc, true);
         if (newValue != oldValue) this.DATASource.Change(node, arc, oldValue, newValue);
      } else this.DATASource.Assert(node, arc, newValue, true);
   },

   // use it only to remove node with literal value
   removeAttribute: function(node, arc) {
      if (typeof(node) == "string") node = this.RDFService.GetResource(node);
      if (this.nodeHasArc(node, arc)) {
         var value = this.getLiteralValue(node, arc);
         this.DATASource.Unassert(node, this.NC_TM[arc], this.RDFService.GetLiteral(value));
         return true;
      }
      return false; // arc not found
   },

   _saveTimer: null,
   // time in milliseconds (Date.now()) when the session was last written to file
   _lastSaveTime: 0,
   // minimal interval between two save operations (in milliseconds)
   _interval: 2000, // 10000
   saveStateDelayed: function SM_saveStateDelayed(aDelay) {
     if (this.windowClosed)
       return;

     if (!this._saveTimer) {
       // interval until the next disk operation is allowed
       var minimalDelay = this._lastSaveTime + this._interval - Date.now();

       // if we have to wait, set a timer, otherwise saveState directly
       aDelay = Math.max(minimalDelay, aDelay || 2000);
       if (aDelay > 0) {
         this._saveTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
         this._saveTimer.init(this, aDelay, Ci.nsITimer.TYPE_ONE_SHOT);
       }
       else {
         this.saveState();
       }
     }
   },

   QueryInterface: function _QueryInterface(aIID){
      if (aIID.equals(Components.interfaces.nsIObserver) ||
            aIID.equals(Components.interfaces.nsISupports) ||
            aIID.equals(Components.interfaces.nsISupportsWeakReference))
         return this;
      throw Components.results.NS_NOINTERFACE;
   },

   closeProtectedTabs: function(){
     var protectedTabs = gBrowser.tabContainer.getElementsByAttribute("protected", true);
     for (var i = protectedTabs.length - 1 ; i >= 0; i--) {
       var tab = protectedTabs[i];
       tab.removeAttribute("protected");
       gBrowser.removeTab(tab);
     }
   },

   savedPrefs: { },
   observe: function SM_observe(aSubject, aTopic, aData) {
      switch (aTopic) {
         case "quit-application-requested":
            // TabView
            if (TabView._window) {
              if (TabView.isVisible())
                this.setLiteral(this.gThisWin, "tabview-visibility", "true");
              else
                this.removeAttribute(this.gThisWin, "tabview-visibility");
              this.saveStateDelayed();
            }
         case "browser-lastwindow-close-requested":
            this.savedPrefs["browser.startup.page"] = Services.prefs.getIntPref("browser.startup.page");
            this.savedPrefs["browser.tabs.warnOnClose"] = Services.prefs.getBoolPref("browser.tabs.warnOnClose");
            this.savedPrefs["browser.showQuitWarning"] = Services.prefs.getBoolPref("browser.showQuitWarning");
            break;
         case "timer-callback": // timer call back for delayed saving
            this._saveTimer = null;
            this.saveState();
            break;
         case "sessionstore-windows-restored":
         case "sessionstore-browser-state-restored":
            // session restored update buttons state
            TMP_ClosedTabs.setButtonDisableState();
            delete TMP_eventListener.tabsPrepared;
         case "browser-window-change-state":
            this.toggleRecentlyClosedWindowsButton();
            break;
         case "private-browsing-change-granted":
            // Whether we restore the session upon resume will be determined by the
            // usual startup prefs see Bug 660785
            if (aData == "enter" && (this.prefBranch.getBoolPref("manager") ||
                this.prefBranch.getBoolPref("crashRecovery"))) {
              this.canQuitApplication(true, true);
            }
            break;
         case "private-browsing":
            switch (aData) {
               case "enter":
                  // check if we need to close protected tab here
                  var needToCloseProtected = true;
                  try {
                    if (Services.prefs.getBoolPref("browser.privatebrowsing.keep_current_session"))
                      needToCloseProtected = false;
                  } catch (ex) { }
                  // noting to do here if we are not using tabmix session manager
                  if (!this.prefBranch.getBoolPref("manager") && !this.prefBranch.getBoolPref("crashRecovery")) {
                    // nsPrivateBrowsingService.js can not close protected tab we have to do it our self
                    // we only close this tab here after nsPrivateBrowsingService save the session
                    if (needToCloseProtected)
                      this.closeProtectedTabs();
                    this._inPrivateBrowsing = true;
                    TMP_ClosedTabs.setButtonDisableState(true);
                    this.toggleRecentlyClosedWindowsButton();
                    break;
                  }
                  this._inPrivateBrowsing = true;
                  if (needToCloseProtected)
                    this.closeProtectedTabs();
                  this.enableManager = this.prefBranch.getBoolPref("manager") && !this._inPrivateBrowsing;
                  this.enableBackup = this.prefBranch.getBoolPref("crashRecovery") && !this._inPrivateBrowsing;
                  this.updateSettings();
                  TMP_ClosedTabs.setButtonDisableState(true);
                  break;
               case "exit":
                  // nsPrivateBrowsingService.js can not close protected tab we have to do it our self
                  this.closeProtectedTabs();
                  aSubject.QueryInterface(Ci.nsISupportsPRBool);
                  var quitting = aSubject.data;
                  if (quitting)
                    break;
                  // build-in sessionStore restore the session for us
                  if (!this.prefBranch.getBoolPref("manager") && !this.prefBranch.getBoolPref("crashRecovery")) {
                    this._inPrivateBrowsing = false;
                    var self = this;
                    window.setTimeout(function () {
                      TMP_ClosedTabs.setButtonDisableState();
                      self.toggleRecentlyClosedWindowsButton();
                    }, 100);
                    break;
                  }
                  TMP_ClosedTabs.getClosedTabAtIndex(-1); // to be on the safe side...
                  this.removeSession(this.gThisWin, this.gSessionPath[0]);
                  window.setTimeout(function () {TMP_ClosedTabs.setButtonDisableState(); }, 0);
                  this.afterExitPrivateBrowsing = window.setTimeout(function (self) {
                    self._inPrivateBrowsing = false;
                    self.windowClosed = false;
                    self.onSessionRestored(true);
                    self.updateSettings();
                    self.removeAttribute(self.gThisWin, "dontLoad");
                    self.saveStateDelayed();
                    self.updateClosedWindowsMenu("check");
                    self.afterExitPrivateBrowsing = null;
                  },0, this);
                  break;
            }
         break;
      }
   },

   restoreWindow: function SM_restoreWindow(aWhere, aIndex) {
      switch (aWhere) {
         case "delete":
            this.forgetClosedWindow(aIndex);
            break;
         case "window":
         default:
            undoCloseWindow(aIndex);
            this.notifyClosedWindowsChanged();
      }
   },

  /**
   * @brief           catch middle click from closed windows list,
   *                  delete window from the list or resrore acurding to the pref
   * @param aEvent    a valid event union.
   * @returns         noting.
   *
   */
   checkForMiddleClick: function SM_checkForMiddleClick(aEvent) {
      if (aEvent.button != 1)
         return;

      aEvent.stopPropagation();
      var index = "value" in aEvent.originalTarget ? aEvent.originalTarget.value : -1;
      if (index < 0)
         return;

      var where = Tabmix.prefs.getBoolPref("middleclickDelete") ? 'delete' : 'tab';
      TabmixSessionManager.restoreWindow(where, index);
      var popup = aEvent.originalTarget.parentNode;
      if (TabmixSvc.ss.getClosedWindowCount() > 0)
         HistoryMenu.prototype.populateUndoWindowSubmenu(popup.parentNode.id);
      else {
         popup.hidePopup();
         if (popup.parentNode.localName != "toolbarbutton")
            popup.parentNode.parentNode.hidePopup();
      }
   },

   forgetClosedWindow: function SM_forgetClosedWindow(aIndex) {
     if (aIndex < 0) {
       while (TabmixSvc.ss.getClosedWindowCount() > 0)
         TabmixSvc.ss.forgetClosedWindow(0);
     }
     else
       TabmixSvc.ss.forgetClosedWindow(aIndex);
     this.notifyClosedWindowsChanged();
   },

  /**
   * @brief           fetch the data of closed window, while removing it from the array
   * @param aIndex    a Integer value - 0 or grater index to remove
   *                  other value empty the list.
   * @returns         closed window data at aIndex.
   *
   */
   getClosedWindowAtIndex: function SM_getClosedWindowAtIndex(aIndex) {
      var closedWindow;
      var state = { windows: [{tabs:[]}], _firstTabs: false , _closedWindows:[]};
      // if aIndex is not > 0 we just past empy list to setWindowState
      // it's like remove all closed tabs from the list
      if (aIndex >= 0) {
         state._closedWindows = Tabmix.JSON.parse(TabmixSvc.ss.getClosedWindowData());
         // purge closed window at aIndex
         closedWindow = state._closedWindows.splice(aIndex, 1).shift();
      }
      // replace existing _closedWindows
      try {
        TabmixSvc.ss.setWindowState(window, Tabmix.JSON.stringify(state), false);
      } catch (ex) {Tabmix.assert(ex);}

      return closedWindow;
   },

   notifyClosedWindowsChanged: function SM_notifyClosedWindowsChanged() {
     Services.obs.notifyObservers(null, "browser-window-change-state", "changed");
   },

   // enable/disable the Recently Closed Windows button
   toggleRecentlyClosedWindowsButton: function SM_toggleRecentlyClosedWindowsButton() {
     if (this.enableManager || this.enableBackup)
       return;
     Tabmix.setItem("tmp_closedwindows", "disabled", TabmixSvc.ss.getClosedWindowCount() == 0 || null);
   },

   saveState: function SM_saveState() {
      // if we're in private browsing mode, do nothing
      if (this._inPrivateBrowsing)
        return;

      try {
         this.DATASource.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();
         this._lastSaveTime = Date.now();
      }
      catch (ex) {
         if (this._interval < 10000) {
           this._interval += 500;
           this.saveStateDelayed();
         }
         Services.console.logStringMessage("TabMix :\n" + "Error when tabmix try to write to session.rdf file");
      }
   },

   promptReplaceStartup: function(caller, path) {
      var loadsession = this.prefBranch.getIntPref("onStart.loadsession");
      var sessionpath = this.prefBranch.getCharPref("onStart.sessionpath");
      var result = {button: Tabmix.NO_NEED_TO_REPLACE};
      if (loadsession < 0 || sessionpath != path) return result;
      var label = this.getDecodedLiteralValue(path, "name");
      var selectionFlag = Tabmix.SELECT_DEFAULT;
      var title, msg, buttons;
      var areYouSure = TabmixSvc.getSMString("sm.areYouSure.msg");
      var chooseStartup = TabmixSvc.getSMString("sm.canChooseStartup.msg");
      switch ( caller ) {
         case "addWinToSession":
            title = TabmixSvc.getSMString("sm.addtoStartup.title");
            var msgType = caller=="addWinToSession" ? "windows" : "tabs";
            msg = TabmixSvc.getSMString("sm.addtoStartup.msg." + msgType) + "\n" + label
               +  "\n" + areYouSure + "\n\n" + chooseStartup;
            buttons = [TabmixSvc.setLabel("sm.addtoStartup.button0"),
                       TabmixSvc.setLabel("sm.addtoStartup.button1")].join("\n");
            break;
         case "replaceSession":
            title = TabmixSvc.getSMString("sm.replaceStartup.title");
            msg = TabmixSvc.getSMString("sm.replaceStartup.msg") + "\n" + label
               +  "\n" + areYouSure + "\n\n" + chooseStartup;
            buttons = [TabmixSvc.setLabel("sm.replaceStartup.button0"),
                       TabmixSvc.setLabel("sm.replaceStartup.button1")].join("\n");
            break;
         case "removeSavedSession":
            title = TabmixSvc.getSMString("sm.removeStartup.title");
            msg = TabmixSvc.getSMString("sm.removeStartup.msg0") + "\n" + label
               +  "\n" + areYouSure + "\n\n" + TabmixSvc.getSMString("sm.removeStartup.msg1");
            buttons = [TabmixSvc.setLabel("sm.removeStartup.button0"),
                       TabmixSvc.setLabel("sm.removeStartup.button1")].join("\n");
            selectionFlag = Tabmix.SELECT_LASTSESSION;
            break;
      }
      return Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.SHOW_MENULIST, Tabmix.HIDE_CHECKBOX, selectionFlag],
                  [title, msg, "", "", buttons]);
   },

   addWinToSession: function SM_addWinToSession(action, path) {
      if (!this.isValidtoSave()) return;
      var result = this.promptReplaceStartup("addWinToSession", path);
      if (result.button == Tabmix.BUTTON_CANCEL) return;
      else if (result.button == Tabmix.BUTTON_OK) this.replaceStartupPref(result, "");
      var saveClosedTabs = this.saveClosedtabs;
      var rdfNodeSession = this.RDFService.GetResource(path);
      var sessionContainer = this.initContainer(rdfNodeSession);
      var oldCount = this.countWinsAndTabs(sessionContainer);
      var newCount = this.saveOneOrAll(action, path, saveClosedTabs);
      if (newCount) {
         var numTabs = oldCount.tab + newCount.tab;
         var numWindows = oldCount.win + newCount.win;
         this.setLiteral(rdfNodeSession, "nameExt", this.getNameData(numWindows, numTabs));
         this.saveStateDelayed();
      }
   },

   saveClosedSession: function SM_saveClosedSession(aTriggerNode) {
      var oldPath = aTriggerNode.session;
      var id = this.getAnonymousId();
      var path = this._rdfRoot + "/saved/" + id + "/window";
      var pathToReplace = "";
      var session = this.getSessionName("saveprevious", this.getDecodedLiteralValue(oldPath, "name"));
      if (session.button == Tabmix.BUTTON_CANCEL) return; // user cancel
      else if (session.button == Tabmix.BUTTON_EXTRA1) { // we replace exist session, Tabmix.BUTTON_OK - save new session
         var result = this.promptReplaceStartup("replaceSession", session.path);
         if (result.button == Tabmix.BUTTON_CANCEL) return; // user cancel
         else if (result.button == Tabmix.BUTTON_OK) { // we replace startup session
            this.replaceStartupPref(result, path);
         }
         pathToReplace = session.path;
      }
      container = this.initContainer(path)
      var pathNode, container, extID = "";
      var node = aTriggerNode.parentNode.parentNode;
      if (node.id.indexOf("tm-sm-closedwindows")==0 || node.id == "btn_closedwindows")
         extID = "/" + id;
      this.copySubtree(oldPath, path + extID);
      if (node.id.indexOf("tm-sm-closedwindows")==0 || node.id == "btn_closedwindows") {
         node = this.RDFService.GetResource(path + extID);
         container.InsertElementAt(node, 1, true);
         this.DATASource.Unassert(node, this.NC_TM["dontLoad"], this.RDFService.GetLiteral("true"));
      }
      var count = this.countWinsAndTabs(container); // we need it just to fix the date
      if (!session.saveClosedTabs)
         this.deleteAllClosedtabs(container);
      if (count)
         this.insertSession(count, session.name, path, pathToReplace);
      else
         Tabmix.log("Error in saveClosedSession");
   },

   copyNode: function(oldNode, newNode, oldRoot, newRoot) {
      var newTarget;
      var arcOut = this.DATASource.ArcLabelsOut(oldNode);
      while (arcOut.hasMoreElements()) {
         var aLabel = arcOut.getNext();
         if (aLabel instanceof Ci.nsIRDFResource) {
            var aTarget = this.DATASource.GetTarget(oldNode, aLabel, true);
            if (aTarget instanceof Ci.nsIRDFResource) {
               newTarget = aTarget.Value.replace(oldRoot, newRoot);
               aTarget = this.RDFService.GetResource(newTarget);
            }
            this.DATASource.Assert(newNode, aLabel, aTarget, true);
         }
      }
   },

   copySubtree: function (oldRoot, newRoot) {
      var allElements = this.DATASource.GetAllResources();
      while (allElements.hasMoreElements()) {
         var aResource = allElements.getNext();
         if ((aResource instanceof Ci.nsIRDFResource) && (aResource.Value.indexOf(oldRoot) == 0)) {
            var newNodeLabel = aResource.Value.replace(oldRoot, newRoot);
            this.copyNode(aResource, this.RDFService.GetResource(newNodeLabel), oldRoot, newRoot);
         }
      }
   },

   replaceStartupPref: function(result, newPath) {
      var sessionpath = !newPath ? "--" : this.prefBranch.getCharPref("onStart.sessionpath");
      this.prefBranch.setIntPref("onStart.loadsession", result.value);
      if (result.value > -1) {
         if (result.label == sessionpath ) this.prefBranch.setCharPref("onStart.sessionpath", newPath);
         else this.prefBranch.setCharPref("onStart.sessionpath", result.label);
      }
      Services.prefs.savePrefFile(null); // store the pref immediately
   },

   sessionUtil: function(action, what, sessionPath) {
      // action = save , replace
      // type = thiswindow , allwindows
      if (!this.isValidtoSave()) return;
      if (Tabmix.numberOfWindows() == 1) what = "thiswindow";
      var oldPath = "", name, saveClosedTabs;
      var id = this.getAnonymousId();
      var newPath = this._rdfRoot + "/saved/" + id + "/window";
      if (action == "save") {
         // ask the user for new name or for exist name if the user want to replace
         var session = this.getSessionName("save"+what);
         if (session.button == Tabmix.BUTTON_CANCEL) return; // user cancel
         else if (session.button == Tabmix.BUTTON_EXTRA1) oldPath = session.path;
         name = session.name;
         saveClosedTabs = session.saveClosedTabs;
      } else {
         oldPath = sessionPath;
         name = this.getLiteralValue(oldPath, "name");
         saveClosedTabs = this.saveClosedtabs;
      }
      if (oldPath != "") { // oldPath is "" if we save to a new name
         // check if the user want to replace startup session
         var result = this.promptReplaceStartup("replaceSession", oldPath);
         if (result.button == Tabmix.BUTTON_CANCEL) return; // user cancel
         else if (result.button == Tabmix.BUTTON_OK) this.replaceStartupPref(result, newPath);
      }
      var count = this.saveOneOrAll("save"+what, newPath, saveClosedTabs);
      if (count) this.insertSession(count, name, newPath, oldPath);
      else Tabmix.log("Error in " + action + " " + what);
   },

   isValidtoSave: function() {
      if ( !this.enableManager ) return false;
      if (gBrowser.isBlankWindow()) {
         var title = TabmixSvc.getSMString("sm.title");
         var msg = TabmixSvc.getSMString("sm.dontSaveBlank.msg");
         var buttons = ["", TabmixSvc.setLabel("sm.button.continue")].join("\n");
         Tabmix.promptService([Tabmix.BUTTON_CANCEL, Tabmix.HIDE_MENUANDTEXT, Tabmix.HIDE_CHECKBOX],[title, msg, "", "", buttons]);
         return false;
      }
      return true;
   },

   saveOneOrAll: function(action, path, saveClosedTabs) {
      var numTabs, numWindows;
      switch ( action ) {
         case "savethiswindow":
               numTabs = this.saveOneWindow(path, "", false, saveClosedTabs);
               numWindows = 1;
            break;
         case "saveallwindows":
               var didSaved = this.saveAllWindows(path, "", saveClosedTabs);
               numTabs = didSaved.tab;
               numWindows = didSaved.win;
            break;
         default: return false;
      }
      if (numTabs > 0) return {win: numWindows, tab: numTabs};
      alert(TabmixSvc.getSMString("sm.sessoinSave.error"));
      return false;
   },

   insertSession: function SM_insertSession(count, name, path, oldPath) {
      var container = this.initContainer(this._rdfRoot + "/windows");
      var index = 0;
      if (oldPath != "") index = container.IndexOf(this.RDFService.GetResource(oldPath));
      var node = this.RDFService.GetResource(path);
      container.InsertElementAt(node, index+1, true);
      if (oldPath != "") { // remove the session we replace
         container.RemoveElementAt(index, true);
         this.removeSession(oldPath, this._rdfRoot+'/windows');
      }
      this.setLiteral(node, "name", name);
      this.setLiteral(node, "nameExt", this.getNameData(count.win, count.tab));
      this.saveStateDelayed();
      return true;
   },

   getSessionName: function(action, old) {
      var showChebox, closedtabMsg, saveClosedTabs = this.saveClosedtabs;
      if (action != "rename" && saveClosedTabs) {
         closedtabMsg = TabmixSvc.getSMString("sm.saveClosedTab.chkbox.label");
         showChebox = Tabmix.CHECKBOX_CHECKED;
      } else showChebox = Tabmix.HIDE_CHECKBOX;
      var msg = TabmixSvc.getSMString("sm.sessionName.msg0") + "\n";
      var title = TabmixSvc.getSMString("sm.sessionName.title." + action);
      var label, buttons, actionFlag;
      var sessionList = this.getSessionList("saved");
      if (action=="rename") {
         label = old;
         buttons = [TabmixSvc.setLabel("sm.sessionName.button0"),
                        TabmixSvc.setLabel("sm.sessionName.button1")].join("\n");
         actionFlag = Tabmix.DLG_RENAME;
      } else {
         label = action == "saveprevious" ? old : gBrowser.mCurrentTab.label;
         buttons = [TabmixSvc.setLabel("sm.askBeforSave.button0"),
                        TabmixSvc.setLabel("sm.askBeforSave.button1"),
                        TabmixSvc.setLabel("sm.replaceStartup.button0")+"..."].join("\n");
         actionFlag = Tabmix.DLG_SAVE;
      }
      label = label + "\n" + sessionList.list.join("\n");
      var result = Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.SHOW_TEXTBOX, showChebox, actionFlag],[title, msg, label, closedtabMsg, buttons]);
      switch (result.button) {
         case Tabmix.BUTTON_CANCEL: return {button: result.button};
         case Tabmix.BUTTON_OK:
         case Tabmix.BUTTON_EXTRA1 :
            var trimResult = result.label.replace(/^[\s]+/g,"").replace(/[\s]+$/g,"");
            return {button: result.button, name: encodeURI(trimResult), path: sessionList.path[result.value], saveClosedTabs: result.checked};
      }
      return {};
   },

   countWinsAndTabs: function SM_countWinsAndTabs(container, prop) {
      // count windows and tabs in this session
      var numTabs = 0, numWindows = 0;
      var windowEnum = container.GetElements();
      while (windowEnum.hasMoreElements()) {
         var rdfNodeWindow = windowEnum.getNext();
         if (prop && this.nodeHasArc(rdfNodeWindow, prop))
            continue;
         numWindows += 1;
         var rdfNodeTabs = this.getResource(rdfNodeWindow, "tabs");
         if (rdfNodeTabs instanceof Ci.nsIRDFResource) {
            var tabContainer = this.initContainer(rdfNodeTabs);
            numTabs += tabContainer.GetCount();
         }
      }
      return {win: numWindows, tab: numTabs};
   },

   getNameData: function(numWindows, numTabs) {
      var d = new Date();
      var date = [d.getFullYear(), '/', d.getMonth()<9 ? "0":"", d.getMonth()+1, '/', d.getDate()<10 ? "0":"", d.getDate()].join('');
      var time = [d.getHours()<10 ? "0":"", d.getHours(), ':', d.getMinutes()<10 ? "0":"", d.getMinutes(), ':', d.getSeconds()<10 ? "0":"", d.getSeconds()].join('');
      var empty = TabmixSvc.getSMString("sm.session.empty");
      var T = TabmixSvc.getSMString("sm.session.tabs");
      var W = TabmixSvc.getSMString("sm.session.windows");
      if (numWindows == 0) return ", (" + empty + ") (" + date + " " + time + ")";
      else if (numWindows < 2) return ", (" + numTabs + " "+ T + ") (" + date + " " + time + ")";
      return ", (" + numWindows + " " + W + ", " + numTabs + " " + T + ") (" + date + " " + time + ")";
   },

   updateSessionMenu: function(menu) {
      var triggerNode = menu.triggerNode;
      if (typeof(triggerNode.session) == "undefined")
        return false;

      var overwriteWindows = this.prefBranch.getBoolPref("restore.overwritewindows") || Tabmix.singleWindowMode;
      document.getElementById("tm-sm-OpenInCurrenWindow").setAttribute("default",overwriteWindows);
      document.getElementById("tm-sm-OpenInNewWindow").setAttribute("default",!overwriteWindows);
      document.getElementById("tm-sm-OpenInNewWindow").hidden = Tabmix.singleWindowMode;

      var mValue = triggerNode.getAttribute("value");
      if (mValue <= -1)
         document.getElementById("tm-sm-Rename").setAttribute("disabled",true);
      else
         document.getElementById("tm-sm-Rename").removeAttribute("disabled");

      var node = triggerNode.parentNode.parentNode;
      var mItem = document.getElementById("tm-sm-SetAsStartup");
      if (node.hasAttribute("sessionmanager-menu")) {
         mItem.removeAttribute("disabled");
         if (triggerNode.hasAttribute("default"))
            mItem.setAttribute("checked", "true");
        else
            mItem.removeAttribute("checked");
      } else {
         mItem.removeAttribute("checked");
         mItem.setAttribute("disabled",true);
      }

      var mShowext = document.getElementById("tm-sm-showext");
      var showext = this.prefBranch.getBoolPref("menu.showext");
      if (!showext && mShowext.hasAttribute("checked"))
         mShowext.removeAttribute("checked");
      else if (showext && !mShowext.hasAttribute("checked"))
         mShowext.setAttribute("checked", "true");

      var obsAll = document.getElementById("tmp_contextmenu_AllWindows");
      var obsThis = document.getElementById("tmp_contextmenu_ThisWindow");
      var mSave = document.getElementById("tm-sm-Save");
      if (node.id.indexOf("tm-sm-closedwindows")==0 || node.id == "btn_closedwindows" || mValue <= -1) {
         if (obsAll.hidden != true)
            obsAll.hidden = true;
         if (obsThis.hidden != true)
            obsThis.hidden = true;
         if (mSave.hidden != false)
            mSave.hidden = false;
         if (triggerNode.hasAttribute("disabled"))
            mSave.setAttribute("disabled", true);
         else
            mSave.removeAttribute("disabled");
      } else {
         var isOneWindow = (Tabmix.numberOfWindows() == 1);
         if (obsAll.hidden != isOneWindow)
            obsAll.hidden = isOneWindow;
         if (obsThis.hidden != false)
            obsThis.hidden = false;
         if (mSave.hidden != true)
            mSave.hidden = true;
      }
      return true;
   },

   restoreSession: function(node, overwriteWindows) {
      if (!this.enableManager)
         return;
      // call restoreSession after delay to let the popup menu time to hide
      window.setTimeout( function () { TabmixSessionManager.delayRestoreSession(node, overwriteWindows); }, 0 );
   },

   delayRestoreSession: function(node, overwriteWindows) {
      var path = node.session;
      var command = node.command;
      if (command == "loadSession")
         this.loadSession(path, "sessionrestore", overwriteWindows);
      else if (command == "openclosedwindow")
         this.openclosedwindow(path, overwriteWindows);
   },

   setSessionAsStartup: function(popup) {
      if (popup.getAttribute("checked")) {
         let node = popup.parentNode.triggerNode;
         var aValue = node.getAttribute("value"); // -1, -2 for for closed session, 1,2.... for saved session
         var loadsession = aValue && aValue <= -1 ? aValue : 0;
         this.prefBranch.setIntPref("onStart.loadsession", loadsession);
         if (loadsession > -1)
            this.prefBranch.setCharPref("onStart.sessionpath", node.session);
         Services.prefs.savePrefFile(null); // store the pref immediately
      }
   },

   setShowNameExt: function() {
      this.prefBranch.setBoolPref("menu.showext", !this.prefBranch.getBoolPref("menu.showext"));
      Services.prefs.savePrefFile(null); // store the pref immediately
   },

   renameSession: function SM_renameSession(thisSession) {
      var node = this.RDFService.GetResource(thisSession);
      var oldName = this.getDecodedLiteralValue(node, "name");
      var result = this.getSessionName("rename", oldName);
      if (result.button == Tabmix.BUTTON_OK) {
         this.setLiteral(node, "name", result.name);
         this.saveStateDelayed();
      }
   },

   removeFromMenu: function(event, popup, root) {
      if (!Tabmix.prefs.getBoolPref("middleclickDelete")) return;
      if ( event.button == 1 && ("session" in event.target)) {
         TabmixSessionManager.removeSavedSession(event.target);
         if (root == this.gSessionPath[0] && this.isClosedWindowsEmpty()) popup.hidePopup();
         else TabmixSessionManager.createMenu(popup, root);
      }
   },

   removeSavedSession: function(aMenuItem, aRemoveSession) {
      var node = aMenuItem.parentNode.parentNode;
      var path = aMenuItem.session;
      if (aRemoveSession || node.hasAttribute("sessionmanager-menu")) {
         // before we remove this session check if it is the startup session
         // and let the user cancel the delete or choose diffrent startup session
         var result = this.promptReplaceStartup("removeSavedSession", path);
         switch (result.button) {
            case Tabmix.BUTTON_CANCEL: return;
            case Tabmix.BUTTON_OK: this.replaceStartupPref(result, "");
            case Tabmix.NO_NEED_TO_REPLACE : this.removeSession(path, this._rdfRoot+'/windows');
         }
      } else if (node.id.indexOf("tm-sm-closedwindows")==0 || node.id == "btn_closedwindows") {
         this.removeSession(path, this.gSessionPath[0]);
         this.updateClosedWindowsMenu("check");
      }
   },

   removeAllSavedSession: function SM_removeAllSavedSession(aMenuItem) {
      var node = aMenuItem.parentNode.parentNode;
      var result, title, msg;
      var buttons = [TabmixSvc.setLabel("sm.removeStartup.button0"),
                     TabmixSvc.setLabel("sm.removeStartup.button1")].join("\n");
      if (node.hasAttribute("sessionmanager-menu")) {
         title = TabmixSvc.getSMString("sm.removeAll.title.session");
         msg = TabmixSvc.getSMString("sm.removeAll.msg0") + "\n\n";
         if (this.prefBranch.getIntPref("onStart.loadsession") > -1)
            msg += TabmixSvc.getSMString("sm.removeAll.msg1");
         result = Tabmix.promptService([Tabmix.BUTTON_CANCEL, Tabmix.HIDE_MENUANDTEXT, Tabmix.HIDE_CHECKBOX],
                        [title, msg, "", "", buttons]);
         if (result.button == Tabmix.BUTTON_OK) {
            this.deleteSubtree(this.gSessionPath[1]);
            this.deleteSubtree(this.gSessionPath[2]);
            this.deleteSubtree(this.gSessionPath[3]);
            this.deleteSubtree(this._rdfRoot+'/saved');
            this.deleteSubtree(this._rdfRoot+'/windows');
            this.saveStateDelayed();
            this.prefBranch.setIntPref("onStart.loadsession", -1);
            Services.prefs.savePrefFile(null); // store the pref immediately
         }
      } else if (node.id.indexOf("tm-sm-closedwindows")==0 || node.id == "btn_closedwindows") {
         title = TabmixSvc.getSMString("sm.removeAll.title.closedwindow");
         msg = TabmixSvc.getSMString("sm.removeAll.msg2");
         result = Tabmix.promptService([Tabmix.BUTTON_CANCEL, Tabmix.HIDE_MENUANDTEXT, Tabmix.HIDE_CHECKBOX],
                        [title, msg, "", "", buttons]);
         if (result.button == Tabmix.BUTTON_OK) {
            var sessionContainer = this.initContainer(this.gSessionPath[0]);
            this.deleteWithProp(sessionContainer, "status", "saved");
            this.updateClosedWindowsMenu(true);
            this.saveStateDelayed();
         }
      }
   },

   // xxx need to check if we need all this functions
   removeSession: function SM_removeSession(value, container) {
      if (value==null) return;
      var node = this.RDFService.GetResource(value);
      var rdfNodeWindows = this.RDFService.GetResource(container);
      var windowsContainer = this.initContainer(rdfNodeWindows);
      this.deleteSubtree(value);
      windowsContainer.RemoveElement(node, true);
      if (!windowsContainer.GetCount()) this.deleteNode(rdfNodeWindows);
      this.saveStateDelayed();
   },

   removeAllClosedSession: function SM_removeAllClosedSession() {
      for (var i = 0; i < this.gSessionPath.length; i++) {
         var rdfNode = this.RDFService.GetResource(this.gSessionPath[i]);
         var container = this.initContainer(rdfNode);
         if (!this.containerEmpty(this.gSessionPath[i])) this.deleteWithProp(container);
         if (!container.GetCount()) this.deleteNode(rdfNode);
      }
   },

   deleteSession: function SM_deleteSession(nodLabel, prop, value) {
      var rdfNode = this.RDFService.GetResource(nodLabel);
      var container = this.initContainer(rdfNode);
      if (!this.containerEmpty(nodLabel)) this.deleteWithProp(container, prop, value);
      if (!container.GetCount()) this.deleteNode(rdfNode);
   },

   deleteWithProp: function(container, prop, value) {
      var containerEnum = container.GetElements();
      var nodeToDelete = [];
      var noProp = typeof(prop) == "undefined";
      var valueExist = typeof(value) == "string";
      while(containerEnum.hasMoreElements()) {
         var node = containerEnum.getNext();
         var propExist = noProp ? true : this.nodeHasArc(node, prop);
         if (valueExist && !noProp && propExist && this.getLiteralValue(node, prop) != value) propExist = false;
         if (propExist) nodeToDelete.push(node);
      }
      this.deleteArrayNodes(container, nodeToDelete, true);
   },

   deleteArrayNodes: function(container, nodeToDelete, deleteSubTree) {
      for (var i = 0; i < nodeToDelete.length; i++) {
         var nodeValue = nodeToDelete[i].QueryInterface(Ci.nsIRDFResource).Value;
         if (deleteSubTree) this.deleteSubtree(nodeValue);
         container.RemoveElement(nodeToDelete[i], true);
      }
   },

   destroyMenuItems: function(menu, aRemoveAllItems) {
      // Destroy the items.
      var destroy = aRemoveAllItems || false, endSeparator;
      for (var i = 0; i < menu.childNodes.length; i++) {
         var item = menu.childNodes[i];
         if (item.id.indexOf("-endSeparator") != -1) {
            endSeparator = item;
            if (!menu.parentNode.hasAttribute("sessionmanager-menu") &&
                menu.parentNode.getAttribute("anonid") != "delete")
               break;
            else
               continue;
         }
         if (destroy) {
            i--;
            menu.removeChild(item);
         } else if (item.id.indexOf("-startSeparator") != -1) destroy = true;
      }
      return endSeparator;
   },

   clonePopupMenu: function SM_clonePopupMenu(menu) {
     if (menu.initialized)
       return;
     menu.initialized = true;
     var popup_menu = document.getElementById("tm-sessionmanager_menu").cloneNode(true);
     popup_menu.id = menu.id + "_menu";
     menu.appendChild(popup_menu);
     popup_menu.childNodes[2].hidden = false;
     TabmixSessionManager.createMenu(popup_menu, this._rdfRoot+'/windows');
   },

   createMenuForDialog: function(popup, contents) {
      if (contents == Tabmix.SHOW_CLOSED_WINDOW_LIST) {
         // create closed window list popup menu
         this.createMenu(popup, window.opener.this.gSessionPath[0], contents);
      } else {
         // create saved Session popup menu
         this.createMenu(popup, this._rdfRoot+'/windows', contents);
         // check if sessionpath and loadsessions valid for saved session
         var loadsession = this.prefBranch.getIntPref("onStart.loadsession");
         if (loadsession > -1 && contents != 1 && loadsession != popup.parentNode.sessionIndex) {
            this.prefBranch.setIntPref("onStart.loadsession", popup.parentNode.sessionIndex);
            var pref = "onStart.sessionpath";
            if (popup.parentNode.sessionIndex < 0 && this.prefBranch.prefHasUserValue(pref))
               this.prefBranch.clearUserPref(pref);
         }
      }
   },

   createMenu: function SM_createMenu(popup, container, contents, aNoSeparators) {
      if (popup.id == "btn_closedwindows_menu") {
        let contextmenu = !this.enableManager ? "tm_undocloseWindowContextMenu" : "tm_sessionmanagerContextMenu";
        document.getElementById("btn_closedwindows_menu").setAttribute("context", contextmenu);
        if (!this.enableManager) {
          HistoryMenu.prototype.populateUndoWindowSubmenu("btn_closedwindows");
          return;
        }
      }

      if (!this.DATASource) this.initService(); // initService if we call from pref dialog
      if (typeof(contents) == "undefined") contents = 0;
      var endSeparator = this.destroyMenuItems(popup, aNoSeparators); // Remove any existing menu items
      var parentId = popup.parentNode.id;
      if (parentId == "btn_sessionmanager" || parentId == "btn_closedwindows")
         popup.parentNode.removeAttribute("tooltiptext");
      var sessionmanagerMenu = popup.parentNode.hasAttribute("sessionmanager-menu");
      var parentID, menuCommand;
      if (sessionmanagerMenu) {
         parentID = "sessionmanagerMenu";
         menuCommand = "loadSession";
      }
      else if (popup.parentNode.getAttribute("anonid") == "delete")
         parentID = "tm_prompt";
      else if (contents != Tabmix.SHOW_CLOSED_WINDOW_LIST)
         parentID = popup.parentNode.id;
      var onClosedWindowsList = parentId.indexOf("tm-sm-closedwindows")==0 || parentId == "btn_closedwindows";
      if (onClosedWindowsList)
         menuCommand = "openclosedwindow";

      var aContainer = this.initContainer(container);
      var containerEnum = aContainer.GetElements();
      var mi, node, name, nameExt, accessKey,index, nodes = [];
      var showNameExt = this.prefBranch.getBoolPref("menu.showext");
      var loadsession = this.prefBranch.getIntPref("onStart.loadsession");
      var sessionpath = this.prefBranch.getCharPref("onStart.sessionpath");
      var showTooltip = sessionmanagerMenu || onClosedWindowsList;
      var closedWinList = parentId.indexOf("closedwindows") != -1;
      while(containerEnum.hasMoreElements()) {
         node = containerEnum.getNext();
         if (this.nodeHasArc(node, "status") &&
               this.getLiteralValue(node, "status") != "saved") continue;
         nodes.push(node);
      }
      var count = nodes.length;
      for (var i = 0; i < count; i++) {
         node = nodes[i];
         name = this.getDecodedLiteralValue(node, "name");
         nameExt = this.getLiteralValue(node, "nameExt");
         // Insert a menu item for session in the container
         mi = document.createElement("menuitem");
         mi.session = node.QueryInterface(Ci.nsIRDFResource).Value;
         mi.command = menuCommand;
         mi.setAttribute("session", mi.session);
         if (contents == 1 && loadsession > -1 && mi.session && mi.session == sessionpath) continue;
         mi.setAttribute("value", i);
         // Ubuntu global menu prevents Session manager menu from working from Tools menu
         // this hack is only for left click, middle click and right click still not working
         if (Tabmix.isPlatform("Linux") && parentId == "tm-sessionmanager")
            mi.setAttribute("oncommand", "TabmixSessionManager.restoreSession(event.originalTarget); event.stopPropagation();");
         mi.value = i;
         if (parentID != "onStart.loadsession") {
            index = closedWinList ? count - 1 - i : i;
            accessKey = (index > 25) ? "" : String.fromCharCode(65 + index) + "  " ;
            mi.setAttribute("accesskey", accessKey);
            mi.setAttribute("label", accessKey + name + (showNameExt ? nameExt : ""));
            if (showTooltip) mi.setAttribute("tooltiptext", accessKey + name + nameExt);
         } else {
            mi.setAttribute("label", name);
         }
         popup.insertBefore(mi, closedWinList ? popup.childNodes[1] : endSeparator);
      }
      var allEmpty = true;
      switch ( parentID ) {
         case "sessionmanagerMenu":
            var observer = document.getElementById("tmp_menu_AllWindows");
            var isOneWindow = (Tabmix.numberOfWindows() == 1);
            if (observer.hidden != isOneWindow) observer.hidden = isOneWindow;
         case "tm_prompt":
            endSeparator.hidden = endSeparator.previousSibling.localName == "menuseparator";
            var sessionLabel;
            var afterCrash = !this.containerEmpty(this.gSessionPath[3]);
            // if Crashed is empty don't show 'Crashed Session' menu item
            if (afterCrash && contents != 1)
               sessionLabel = ["lastgood 1","previous 2","crashed 3"];
            else
               sessionLabel = ["last 1","previous 2"];

            var menu;
            var empty = ", (" + TabmixSvc.getSMString("sm.session.empty") + ")";
            for (i = 0; i < sessionLabel.length; i++ ){
               menu = document.createElement("menuitem");
               var [sLabel , sessionIndex] = sessionLabel[i].split(" ");
               menu.session = this.gSessionPath[sessionIndex];
               menu.command = menuCommand;
               if (this.containerEmpty(menu.session) && contents != 1)
                  menu.setAttribute("disabled", "true");
               else
                  allEmpty = false;
               nameExt = this.getLiteralValue(menu.session, "nameExt", empty);
               sLabel = TabmixSvc.getSMString("sm.sessionMenu." + sLabel);
               menu.setAttribute("label", sLabel + (showNameExt && contents != 1 ? nameExt : ""));
               if (showTooltip) menu.setAttribute("tooltiptext", sLabel + nameExt);
               menu.setAttribute("value", (-1 - i));
               if (Tabmix.isPlatform("Linux") && parentId == "tm-sessionmanager")
                  menu.setAttribute("oncommand", "TabmixSessionManager.restoreSession(event.originalTarget); event.stopPropagation();");
               popup.appendChild (menu);
            }
            if (afterCrash && contents != 1) { // add separator before Crashed menu item
               menu = document.createElement("menuseparator");
               popup.insertBefore(menu, popup.lastChild);
            }
            if (contents == 1) loadsession = -1; //set "Last Sessoin" as default in the list
            this.setDefaultIndex(popup, loadsession, sessionpath);
            break;
         case "onStart.loadsession":
            endSeparator.hidden = this.containerEmpty(container);
            this.setDefaultIndex(popup, loadsession, sessionpath);
            break;
         default:
            this.setDefaultIndex(popup, loadsession, sessionpath);
            if (endSeparator)
               endSeparator.hidden = true;
            break;
      }
      var rename = popup.getElementsByAttribute("anonid", "rename")[0];
      if (rename)
         Tabmix.setItem(rename, "disabled", count == 0 ? true : null);
      var deleteItem = popup.getElementsByAttribute("anonid", "delete")[0];
      if (deleteItem)
         Tabmix.setItem(deleteItem, "disabled", allEmpty && count == 0 ? true : null);
   },

   // set defaultIndex, sessionIndex and default Attribute
   setDefaultIndex : function(popup, loadsession, sessionpath) {
      popup.parentNode.defaultIndex = -1; // index with menuseparator
      popup.parentNode.sessionIndex = -1; // index without menuseparator
      var i, item, value, checked;
      for (i = 0; i < popup.childNodes.length; i++) {
         item = popup.childNodes[i];
         if (item.localName == "menuseparator") continue;
         value = item.getAttribute("value");
         checked = ((loadsession > -1 && item.session && item.session == sessionpath) ||
               (loadsession <= -1 && value && value == loadsession));
         if (checked) {
            item.setAttribute("default", "true");
            popup.parentNode.defaultIndex = i;
            popup.parentNode.sessionIndex = value;
         } else item.removeAttribute("default");
      }
   },

   // update disable/enable to closed window list in tool menu and toolbar
   updateClosedWindowsMenu: function(action) {
      var disabled = (action == "check") ? this.isClosedWindowsEmpty(): action;
      var wnd, enumerator = Tabmix.windowEnumerator();
      while ( enumerator.hasMoreElements() ) {
         wnd = enumerator.getNext();
         wnd.Tabmix.setItem("tmp_closedwindows", "disabled", disabled || null);
      }
   },

   isClosedWindowsEmpty: function SM_isClosedWindowsEmpty() {
      var node, disabled = true;
      var aContainer = this.initContainer(this.gSessionPath[0]);
      var containerEnum = aContainer.GetElements();
      while(containerEnum.hasMoreElements()) {
         node = containerEnum.getNext();
         if (this.getLiteralValue(node, "status") == "saved") {
            disabled = false;
            break;
         }
      }
      return disabled;
   },

   // call by init on first window load after crash
   openAfterCrash: function SM_openAfterCrash(status) {
      this.afterCrash = true;
      var sessionContainer = this.initContainer(this.gSessionPath[0]);
      if (this.enableBackup) {
         var path = this._rdfRoot + "/closedSession/thisSession";
         this.setLiteral(path, "status", "crash2");
         // restore to were we was before the crash
         var crashedContainer = this.initContainer(this.gSessionPath[3]);
         if (status != "crash2") {
            // delete old crash data
            if (!this.containerEmpty(this.gSessionPath[3])) this.deleteWithProp(crashedContainer);
            var windowEnum = sessionContainer.GetElements();
            var nodeToDelete = [];
            while (windowEnum.hasMoreElements()) {
               var rdfNodeWindow = windowEnum.getNext();
               if (this.getLiteralValue(rdfNodeWindow, "status") == "backup") {
                  var tabs = this.getResource(rdfNodeWindow, "tabs");
                  var subTree = rdfNodeWindow.QueryInterface(Ci.nsIRDFResource).Value;
                  if (!this.containerEmpty(tabs)) { // copy "backup" subtree to crashed session if it not empty
                     var newSubTree = subTree.replace(this.gSessionPath[0], this.gSessionPath[3]);
                     this.copySubtree(subTree, newSubTree);
                     crashedContainer.AppendElement(this.RDFService.GetResource(newSubTree));
                  }
                  this.deleteSubtree(subTree); // delete the crashed subtree
                  nodeToDelete.push(rdfNodeWindow);// remove the window from the crash session
               } else this.setLiteral(rdfNodeWindow, "dontLoad", "true"); // we can see this session in the close window list
            }
            this.deleteArrayNodes(sessionContainer, nodeToDelete, false);
         } // if firefox was crashed in middle of crash Recovery try again to restore the same data
         else if (!this.containerEmpty(this.gSessionPath[0]))
            this.deleteWithProp(sessionContainer);

         var title = TabmixSvc.getSMString("sm.afterCrash.title");
         var msg;
         if (status != "crash2")
            msg = TabmixSvc.getSMString("sm.afterCrash.msg0");
         else
            msg = TabmixSvc.getSMString("sm.afterCrash.msg0.again");
         var chkBoxLabel = !this.enableManager ? TabmixSvc.getSMString("sm.afterCrash.chkbox.label") : "";
         var buttons;
         var chkBoxState = !this.enableManager ? Tabmix.CHECKBOX_UNCHECKED : Tabmix.HIDE_CHECKBOX;
         var closedWinList = this.initContainer(this.gSessionPath[0]).GetCount();
         var lastSession = this.containerEmpty(this.gSessionPath[1]) // last session
         var prevtoLast = this.containerEmpty(this.gSessionPath[2]) // previous to last
         var savedSession = this.containerEmpty(this._rdfRoot+'/windows') // saved session
         var isAllEmpty = lastSession && prevtoLast && savedSession;
         var callBack = function (aResult) {TabmixSessionManager.afterCrashPromptCallBack(aResult);}
         this.callBackData = {label: null, whattoLoad: "session"}
         if (!this.containerEmpty(this.gSessionPath[3])) { // if Crashed Session is not empty
            var count = this.countWinsAndTabs(crashedContainer);
            this.setLiteral(this.gSessionPath[3], "nameExt", this.getNameData(count.win, count.tab));
            if (this.enableManager && !isAllEmpty) {
               msg += "\n\n" + TabmixSvc.getSMString("sm.afterCrash.msg1");
               buttons = [TabmixSvc.setLabel("sm.afterCrash.button0"),
                          TabmixSvc.setLabel("sm.afterCrash.button1")].join("\n");
               Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.SHOW_MENULIST, Tabmix.HIDE_CHECKBOX, Tabmix.SELECT_CRASH],
                     [title, msg, "", "", buttons], window, callBack);
            } else {
               msg += " " + TabmixSvc.getSMString("sm.afterCrash.msg2") + ".....";
               if (!this.enableManager)
                  msg += "\n" + TabmixSvc.getSMString("sm.afterCrash.msg3");
               else
                  msg += "\n" + TabmixSvc.getSMString("sm.afterCrash.msg4");
               buttons = [TabmixSvc.setLabel("sm.afterCrash.button0.crashed"),
                          TabmixSvc.setLabel("sm.afterCrash.button1")].join("\n");
               Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.HIDE_MENUANDTEXT, chkBoxState],
                     [title, msg, "", chkBoxLabel, buttons], window, callBack);
               this.callBackData.label = this.gSessionPath[3];
            }
         } else {
            if (this.enableManager && !isAllEmpty) {
               msg += " " + TabmixSvc.getSMString("sm.afterCrash.msg5") + "\n\n"
                          + TabmixSvc.getSMString("sm.afterCrash.msg1");
               buttons = [TabmixSvc.setLabel("sm.afterCrash.button0"),
                          TabmixSvc.setLabel("sm.afterCrash.button1")].join("\n");
               Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.SHOW_MENULIST, Tabmix.HIDE_CHECKBOX, Tabmix.SELECT_DEFAULT],
                     [title, msg, "", "", buttons], window, callBack);
            } else if (closedWinList != 0) {
               msg += " " + TabmixSvc.getSMString("sm.afterCrash.msg6");
               if (!this.enableManager)
                  msg += "\n" + TabmixSvc.getSMString("sm.afterCrash.msg3") + "\n\n"
                              + TabmixSvc.getSMString("sm.afterCrash.msg7") + ":";
               else
                  msg += "\n\n" + TabmixSvc.getSMString("sm.afterCrash.msg7") + " "
                                + TabmixSvc.getSMString("sm.afterCrash.msg8") + ":";
               buttons = [TabmixSvc.setLabel("sm.afterCrash.button0"),
                          TabmixSvc.setLabel("sm.afterCrash.button1")].join("\n");
               Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.SHOW_MENULIST, chkBoxState, Tabmix.SHOW_CLOSED_WINDOW_LIST],
                     [title, msg, "", chkBoxLabel, buttons], window, callBack);
               this.callBackData.whattoLoad = "closedwindow";
            } else {// nothing to restore
               msg = TabmixSvc.getSMString("sm.afterCrash.msg9") + "\n" + TabmixSvc.getSMString("sm.afterCrash.msg10");
               if (!this.enableManager)
                  msg += "\n\n" + TabmixSvc.getSMString("sm.afterCrash.msg3");
               buttons = ["", TabmixSvc.setLabel("sm.button.continue")].join("\n");
               Tabmix.promptService([Tabmix.BUTTON_CANCEL, Tabmix.HIDE_MENUANDTEXT, chkBoxState],
                     [title, msg, "", chkBoxLabel, buttons], window, callBack);
            }
         }
      } else { // crash recovery is off, delete any remains from the crashed session
         if (!this.containerEmpty(this.gSessionPath[0])) this.deleteWithProp(sessionContainer);
         if (this.enableManager) this.openFirstWindow(true); // openFirstWindow with flag openAfterCrash
         //  else BrowserHome(); // we never get to here...
      }
   },

   afterCrashPromptCallBack: function SM_afterCrashPromptCallBack(aResult) {
      if (this.callBackData.label)
        aResult.label = this.callBackData.label;
      if (aResult.checked && !this.enableManager) {
         this.prefBranch.setBoolPref("manager", true); // enable session manager
         try {
            Services.prefs.savePrefFile(null); // store the pref immediately
         } catch(ex) { }
      }
      if (aResult.button == Tabmix.BUTTON_OK) {
         switch (this.callBackData.whattoLoad) {
            case "session": this.loadSession(aResult.label, "firstwindowopen");
               break;
            case "closedwindow": this.openclosedwindow(aResult.label, true);
               break;
            default:
         }
      } else
         this.loadHomePage();
      this.saveStateDelayed();
      delete this.callBackData;
   },

   // call by init or by openAfterCrash on first window load
   openFirstWindow: function SM_openFirstWindow(afterCrash) {
      var path = this._rdfRoot + "/closedSession/";
      var sessionType = ["thisSession", "lastSession", "previoustolastSession", "crashedsession"];
      // swap 0 --> 1 --> 2 --> 0
      var i;
      var sessions = [], subTree, aSession;
      for (i = 0; i < sessionType.length-1; i++) {
         sessions.push(this.getResource(path + sessionType[i], "session"));
      }
      for (i = 0; i < sessionType.length-1; i++) {
         if (i == 0) { // delete oldest session subtree
            aSession = sessions[sessionType.length-2];
            subTree = aSession.QueryInterface(Ci.nsIRDFResource).Value;
            this.deleteSubtree(subTree);
         } else aSession = sessions[i-1];
         this.setResource(path + sessionType[i], "session", aSession)
      }
      for (i = 0; i < sessionType.length; i++) {
         this.gSessionPath[i] = this.getResourceValue(path + sessionType[i], "session");
      }
      this.gThisWin = this.gSessionPath[0] + "/" + gBrowser.windowID;
      this.gThisWinTabs = this.gThisWin + "/tabs";
      this.gThisWinClosedtabs = this.gThisWin + "/closedtabs";

      // make sure we delete closed windows that may exist if we exit Firefox
      // from private browsing mode. we skip this command in windowIsClosing
      // when entring private browsing mode
      this.deleteWithProp(this.initContainer(this.gSessionPath[1]), "dontLoad");

      // When Firefox Starts:
      //       pref "onStart"
      //       0 - Restore
      //       1 - Ask me before Restore
      //       2 (or else) - Don't Restore
      //
      //       pref "onStart.loadsession"
      //       0 , 1 , 2 ..... index of saved sessions
      //       -1, -2 ........ index of previous sessions
      //
      // if loadsession >= 0 the session path is saved in pref "onStart.sessionpath"
      // else if loadsession < 0 the session path is saved in this.gSessionPath
      var restoreFlag = this.prefBranch.getIntPref("onStart");
      if (restoreFlag > 1) {
         return; // Don't Restore
      }
      var loadSession = this.prefBranch.getIntPref("onStart.loadsession");
      // after last session end with restart load the last session without any prompt
      // unless we are after crash
      var startupEmpty = false, savePref = false ;
      var result = {}, title, msg = "", buttons;
      if (afterCrash)
         title = TabmixSvc.getSMString("sm.afterCrash.title");
      else
         title = TabmixSvc.getSMString("sm.start.title");
      var chkBoxLabel = afterCrash ? TabmixSvc.getSMString("sm.start.chkbox.label") : "";
      var chkBoxState = afterCrash ? Tabmix.CHECKBOX_UNCHECKED : Tabmix.HIDE_CHECKBOX;
      // get saved session list, we only need to get session path
      var sessionList = this.getSessionList("onlyPath");
      var askifempty = restoreFlag > 1 ? false : this.prefBranch.getBoolPref("onStart.askifempty");
      if (sessionList == null) {
         if (((askifempty && afterCrash) || restoreFlag == 1) && !this.corruptedFile) {
            msg = TabmixSvc.getSMString("sm.start.msg0") + "\n"
                + TabmixSvc.getSMString("sm.afterCrash.msg10");
            if (afterCrash)
               msg += "\n\n" + TabmixSvc.getSMString("sm.start.msg1");
            buttons = ["", TabmixSvc.setLabel("sm.button.continue")].join("\n");
            let callBack = function (aResult) {
                             TabmixSessionManager.enableCrashRecovery(aResult);
                           }
            Tabmix.promptService([Tabmix.BUTTON_CANCEL, Tabmix.HIDE_MENUANDTEXT, chkBoxState],
                           [title, msg, "", chkBoxLabel, buttons], window, callBack);
         }
         this.loadHomePage();
         return;
      }

      var sessionPath = sessionList.path;
      var loadSessionIsValid = true, sessionIndex, thisPath;
      switch ( (loadSession > 0) ? 0 : loadSession ) {
         case 0:
            sessionIndex = null;
            if (this.prefBranch.prefHasUserValue("onStart.sessionpath")) {
               thisPath = this.prefBranch.getCharPref("onStart.sessionpath");
               // check if sessionpath is valid
               for (i = 0; i < sessionPath.length; i++) {
                  if (sessionPath[i] == thisPath) {
                     sessionIndex = i;
                     break;
                  }
               }
            }
            if ((thisPath && this.containerEmpty(thisPath)) || sessionIndex == null) {
               // error in pref.js or in session.rdf ask the user what to do
               loadSessionIsValid = false;
               thisPath = this.gSessionPath[1]; // load last session
               this.prefBranch.setIntPref("onStart.loadsession", -1);
               savePref = true;
            }
            break;
         default: // just in case that somehow onStart.loadsession is invalid
            loadSession = -1;
            this.prefBranch.setIntPref("onStart.loadsession", -1);
            savePref = true;
         case -2:
         case -1:
            var indx = -1 * loadSession;
            thisPath = this.gSessionPath[indx];
            if (this.containerEmpty(this.gSessionPath[indx])) startupEmpty = true;
            sessionIndex = sessionPath.length + indx - 3;
            break;
      }
      if (restoreFlag > 0 || afterCrash || (startupEmpty && askifempty) || !loadSessionIsValid) {
try{
         if (afterCrash)
            msg += TabmixSvc.getSMString("sm.afterCrash.msg0") + " "
                 + TabmixSvc.getSMString("sm.start.msg1");
         if (startupEmpty) msg += TabmixSvc.getSMString("sm.start.msg0");
         if (!loadSessionIsValid) msg += TabmixSvc.getSMString("sm.start.msg2");
         msg += "\n\n" + TabmixSvc.getSMString("sm.afterCrash.msg1");
         buttons = [TabmixSvc.setLabel("sm.afterCrash.button0"),
                    TabmixSvc.setLabel("sm.afterCrash.button1")].join("\n");
         let callBack = function (aResult) {
                           TabmixSessionManager.onFirstWindowPromptCallBack(aResult);
                        }
         Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.SHOW_MENULIST, chkBoxState, Tabmix.SELECT_DEFAULT],
                  [title, msg, "", chkBoxLabel, buttons], window, callBack);
} catch (ex) {Tabmix.assert(ex);}
      }
      else {
         result.button = startupEmpty ? Tabmix.BUTTON_CANCEL : Tabmix.BUTTON_OK;
         result.label = thisPath;
         this.onFirstWindowPromptCallBack(result);
      }
   },

   enableCrashRecovery: function SM_enableCrashRecovery(aResult) {
      if (aResult.checked && this.afterCrash) {
        this.prefBranch.setBoolPref("crashRecovery", true); // enable Crash Recovery
        Services.prefs.savePrefFile(null); // store the pref immediately
      }
   },

   onFirstWindowPromptCallBack: function SM_onFirstWindowPromptCallBack(aResult) {
      this.enableCrashRecovery(aResult);
      if (aResult.button == Tabmix.BUTTON_OK)
         this.loadSession(aResult.label, "firstwindowopen");
      else
         this.loadHomePage();

      this.saveStateDelayed();

      // now that we open our tabs init TabView again
      TMP_SessionStore.initService();
      TabView.init();

      // some extensions observers for this notification on startup
      // notify observers things are complete.
      Services.obs.notifyObservers(null, "sessionstore-windows-restored", "");
   },

   getSessionList: function SM_getSessionList(flag) {
      var aList = [], sessionPath = [];
      var aContainer = this.initContainer(this._rdfRoot+'/windows');
      var containerEnum = aContainer.GetElements();
      var node, aName;
      while(containerEnum.hasMoreElements()) {
         node = containerEnum.getNext();
         if (flag != "onlyPath") {
           aName = this.getDecodedLiteralValue(node, "name");
           aList.push(aName);
         }
         sessionPath.push(node.QueryInterface(Ci.nsIRDFResource).Value);
      }
      if (flag == "saved") return {list: aList, path: sessionPath};
      else if (flag == "replace") {
         aList.push(TabmixSvc.getSMString("sm.sessionMenu.lastDefault"));
         aList.push(TabmixSvc.getSMString("sm.sessionMenu.previous"));
      } else {
         let empty = ", (" + TabmixSvc.getSMString("sm.session.empty") + ")";
         let empty1 = this.containerEmpty(this.gSessionPath[1]);
         let empty2 = this.containerEmpty(this.gSessionPath[2]);
         if (empty1 && empty2 && sessionPath.length == 0)
            return null;
        if (flag != "onlyPath") {
           let msg = flag == "afterCrash" ? "sm.sessionMenu.lastgood" : "sm.sessionMenu.last";
           aList.push(TabmixSvc.getSMString(msg) + (empty1 ? empty : ""));
           aList.push(TabmixSvc.getSMString("sm.sessionMenu.previous") + (empty2 ? empty : ""));
        }
      }
      sessionPath.push(this.gSessionPath[1]);
      sessionPath.push(this.gSessionPath[2]);
      return {list: aList, path: sessionPath};
   },

   saveAllWindows: function SM_saveAllWindows(path, caller, saveClosedTabs) {
      var enumerator = Tabmix.windowEnumerator();
      var wnd, savedTabs = 0 , savedWin = 0, thisWin;
      while ( enumerator.hasMoreElements() ) {
         wnd = enumerator.getNext();
         thisWin = wnd.TabmixSessionManager.saveOneWindow(path, caller, false, saveClosedTabs);
         savedTabs += thisWin;
         if (thisWin > 0) savedWin += 1;
      }
      return {win: savedWin, tab: savedTabs};
   },

   /*
    *  update closed window list flag 'dontLoad'
    *  all window that where closed more then 10 sec ago will mark 'dontLoad'
    *  return true if we leftout with windows to load
    */
   updateClosedWindowList: function SM_updateClosedWindowList(aPopUp) {
      var thisSession = this.RDFService.GetResource(this.gSessionPath[0]);
      var container = this.initContainer(thisSession);
      var curTime;
      if (aPopUp)
         curTime = this.getLiteralValue(thisSession, "timestamp", 0);
      else {
         var pref = "warnAboutClosingTabs.timeout";
         var delay = Tabmix.prefs.prefHasUserValue(pref) ? Tabmix.prefs.getCharPref(pref)*1 : 0;
         curTime = new Date().valueOf() - delay;
      }
      var windowEnum = container.GetElements();
      while (windowEnum.hasMoreElements()) {
         var rdfNodeLastWindow = windowEnum.getNext();
         var lastSaved = this.getLiteralValue(rdfNodeLastWindow, "timestamp", 0);
         if ((curTime - lastSaved) > 10000) {
            if (!this.nodeHasArc(rdfNodeLastWindow, "dontLoad"))
               this.setLiteral(rdfNodeLastWindow, "dontLoad", "true");
         }
      }
      var count = this.countWinsAndTabs(container,  "dontLoad");
      return count.win > 0 && count.tab > 0;
   },

   // Saves TabView data for the given window.
   saveTabViewData: function SM_saveTabViewData(aWin, aBackup) {
      if (aBackup && !this.enableBackup)
        return;
      let tabview = TabView._window;
      if (tabview) {
        // update all tabs when we exit panorama (tabviewhidden)
        if (aBackup) {
          Array.forEach(gBrowser.tabs, function SM_saveTabViewData_forEach(tab) {
            this.saveTabviewTab(this.getNodeForTab(tab), tab);
          }, this);
        }
        // we don't need to save again when we exit panorama (tabviewhidden event)
        // force Tabview to save when we save all window data
        else {
          tabview.UI._save();
          tabview.GroupItems.saveAll();
          tabview.TabItems.saveAll(TabView.isVisible()); // isVisible here for Firefox 4.0-5.0
          // saveActiveGroupName exist since Firefox 7.0
          if (Tabmix.isVersion(70) && !Tabmix.isVersion(100))
            tabview.Storage.saveActiveGroupName(window);
        }
      }

      let self = this;
      function updateTabviewData(id) {
        let data = TabmixSessionData.getWindowValue(window, id);
        if (data != "" && data != "{}")
          self.setLiteral(aWin, id, data);
        else
          self.removeAttribute(aWin, id);
      }
      updateTabviewData("tabview-ui");
      updateTabviewData("tabview-visibility");
      updateTabviewData("tabview-groups");
      updateTabviewData("tabview-group");
      if (Tabmix.isVersion(70) && !Tabmix.isVersion(100))
        updateTabviewData("tabview-last-session-group-name");
      if (aBackup)
        this.saveStateDelayed();
   },

   saveOneWindow: function SM_saveOneWindow(path, caller, overwriteWindow, saveClosedTabs) {
      if (gBrowser.isBlankWindow()) return 0; // dont save window without any tab
      if (!path) path = this.gSessionPath[0];
      if (!caller) caller = "";
      if (!overwriteWindow) overwriteWindow = false;
      if (typeof(saveClosedTabs) == "undefined") saveClosedTabs = this.saveClosedtabs;
      // if we going to delete close window from the list we can't use GetCount as ID,
      // we need to save unink ID
      var winID;
      if (caller == "windowclosed" || caller == "windowbackup") winID = gBrowser.windowID;
      else winID = this.getAnonymousId();
      var winPath = path + "/" + winID;
      this.initSession(path, winPath);
      var savedTabs = this.saveAllTab(winPath, 0);
      if (caller == "windowclosed" && this.enableBackup) {
         this.setTabsScroll();
      } else {
         if (((this.gThisWin == winPath && !this.enableBackup) || this.gThisWin != winPath) && saveClosedTabs)
            this.copyClosedTabsToRDF(winPath);
      }

      var rdfNodeThisWindow = this.RDFService.GetResource(winPath);
      if (this.prefBranch.getBoolPref("save.selectedtab")) // save selected tab index
         this.setIntLiteral(rdfNodeThisWindow, "selectedIndex", this.getTabPosition());

      // save TabView data
      try {
        this.saveTabViewData(rdfNodeThisWindow);
      } catch (ex) {Tabmix.assert(ex);}

      if (caller == "windowbackup") {
         return savedTabs;
      }

      if (path == this.gSessionPath[0]) {
         // save current tab title. we will use it later in closed windows list as menu entry label
         // if current tab is blank get label from first saved tab that isn't blank
         var _tab = gBrowser.mCurrentTab;
         if (gBrowser.isBlankTab(_tab)) {
            for (var i = 0; i < gBrowser.tabs.length; i++) {
               var aTab = gBrowser.tabs[i];
               if (!gBrowser.isBlankTab(aTab)) {
                  _tab = aTab;
                  break;
               }
            }
         }
         var label = _tab.label;
         // replace "Loading..." with the document title (with minimal side-effects)
         let tabLoadingTitle = gBrowser.mStringBundle.getString("tabs.connecting");
         if (label == tabLoadingTitle) {
            gBrowser.setTabTitle(_tab);
            [label, _tab.label] = [_tab.label, label];
         }
         this.setLiteral(rdfNodeThisWindow, "name", encodeURI(label));
         this.setLiteral(rdfNodeThisWindow, "nameExt", this.getNameData(-1, savedTabs));
         var pref = "warnAboutClosingTabs.timeout";
         var delay = Tabmix.prefs.prefHasUserValue(pref) ? Tabmix.prefs.getCharPref(pref)*1 : 0;
         var newTime = new Date().valueOf() - delay;
         this.setLiteral(rdfNodeThisWindow, "timestamp", newTime);
         // if we overwrite window we don't load it again on restart
         if (this.overwriteWindow || overwriteWindow)
            this.setLiteral(rdfNodeThisWindow, "dontLoad", "true");
         // when we save on close we set this in windowIsClosing
         if (caller != "windowclosed") {
            this.setLiteral(rdfNodeThisWindow, "status", "saved");
            this.updateClosedWindowsMenu(false);
         }
      }
      else
        this.setLiteral(rdfNodeThisWindow, "status", "");
      this.saveStateDelayed();
      return savedTabs;
   }, // end of "saveOneWindow : function ()"

   // if this session is not in the container add it to the last place and init prop
   // else move it to the last place
   initSession: function SM_initSession(path, winPath) {
      var container = this.initContainer(path);
      var rdfNode = this.RDFService.GetResource(winPath);
      var index = container.IndexOf(rdfNode);
      if (index == -1) {
         container.AppendElement(rdfNode);
         this.setLiteral(rdfNode, "status", "backup");
         this.setResource(rdfNode, "tabs", winPath + "/tabs");
         this.setResource(rdfNode, "closedtabs", winPath + "/closedtabs");
      } else if (index != container.GetCount()) {
         container.RemoveElementAt(index, true);
         container.AppendElement(rdfNode);
      }
   },

   // xxx need to fix this to save only history, image and history index
   // and save the rest when tab added
   tabLoaded: function SM_tabLoaded(aTab) {
      if (!this._inited || !this.enableBackup || aTab.hasAttribute("inrestore"))
        return;
      if (gBrowser.isBlankTab(aTab)) return;
      // if this window is not in the container add it to the last place
      this.initSession(this.gSessionPath[0], this.gThisWin);
      var tabContainer = this.initContainer(this.gThisWinTabs);
      var result = this.saveTab(aTab, this.gThisWinTabs, tabContainer, true, 0);
      if (result)
         this.saveStateDelayed();
   },

   updateTabPos: function(aTab, label, add0_1) {
      var tab, node;
      if (!add0_1) add0_1 = 0;
      for (var i = aTab._tPos + add0_1; i < gBrowser.tabs.length; i++) {
         tab = gBrowser.tabs[i];
         node = (typeof(label) == "undefined") ? this.getNodeForTab(tab) : label + "/" + tab.linkedPanel;
         this.setIntLiteral(node, "tabPos", tab._tPos);
      }
   },

   tabClosed: function SM_tabClosed(aTab) { // delete tab from container and save to closed tab list backup
      // we don't check aTab.hasAttribute("inrestore") , in case tab is closed before
      // its finish to restore.
      if (!this.enableBackup || this.windowClosed) return;
      this.initSession(this.gSessionPath[0], this.gThisWin);
      var tabContainer = this.initContainer(this.gThisWinTabs);
      var panelPath = this.getNodeForTab(aTab);
      var nodeToClose = this.RDFService.GetResource(panelPath);
      this.updateTabPos(aTab); // update _tPos for the tab right to the deleted tab
      if (this.saveClosedtabs) {
         // move closedtabs to closedtabs container
         var closedTabContainer = this.initContainer(this.gThisWinClosedtabs);
         var tabExist = true;
         if (tabContainer.IndexOf(nodeToClose) == -1) {
            tabExist = this.saveTab(aTab, this.gThisWinTabs, closedTabContainer, false, 0);
         } else tabContainer.RemoveElement(nodeToClose, true);
         if (tabExist) {
            closedTabContainer.AppendElement(nodeToClose);
            if (closedTabContainer.GetCount() > Services.prefs.getIntPref("browser.sessionstore.max_tabs_undo"))
               this.deleteClosedtabAt(1, this.gThisWin);
         }
      } else if (tabContainer.IndexOf(nodeToClose) > -1) {
         this.deleteSubtree(panelPath);
         tabContainer.RemoveElement(nodeToClose, true);
         if (!tabContainer.GetCount()) { // if no tab in the container remove it from the tree
            var winContainer = this.initContainer(this.gSessionPath[0]);
            var rdfNode = this.RDFService.GetResource(this.gThisWin);
            winContainer.RemoveElement(rdfNode, true);
            this.deleteSubtree(this.gThisWin);
         }
      }
      this.saveStateDelayed();
   },

   updateTabProp: function SM_updateTabProp(aTab) {
      // we dont need this function to run before sessionmanager init
      if (!this._inited || !this.enableBackup || aTab.hasAttribute("inrestore"))
        return;
      if (gBrowser.isBlankTab(aTab))
        return; // dont write blank tab to the file
      this.initSession(this.gSessionPath[0], this.gThisWin);
      this.setLiteral(this.getNodeForTab(aTab), "properties", TabmixSessionData.getTabProperties(aTab, true));
      this.saveStateDelayed();
   },

   tabMoved: function SM_tabMoved(aTab, oldPos, newPos) {
      if (!this.enableBackup || aTab.hasAttribute("inrestore")) return;
      this.initSession(this.gSessionPath[0], this.gThisWin);
      // can't use aTab._tPos after group of tab delete
      // we pass old position and new position from TabMove event
      // we need to fix tabPos for all tab between old position and new position
      var first = Math.min(oldPos, newPos);
      var last = Math.max(oldPos, newPos);
      for (var i = first; i < last + 1; i++) {
         var tab = gBrowser.tabs[i];
         if (!gBrowser.isBlankTab(tab))
            this.setIntLiteral(this.getNodeForTab(tab), "tabPos", i);
      }
      this.saveStateDelayed();
   },

   setTabsScroll: function() {
      if (this.prefBranch.getBoolPref("save.scrollposition"))
         for (var i = 0; i < gBrowser.tabs.length; i++)
            this.tabScrolled(gBrowser.tabs[i]);
   },

   // xxx need to find the right event to trigger this function..
   tabScrolled: function SM_tabScrolled(aTab) {
      if (!this.enableBackup || aTab.hasAttribute("inrestore")) return;
      var aBrowser = gBrowser.getBrowserForTab(aTab);
      if (gBrowser.isBlankBrowser(aBrowser)) return;
      var bContent = aBrowser.contentWindow;
      var zoomFactor = aBrowser.docShell.contentViewer ? aBrowser.markupDocumentViewer.textZoom : 1;
      this.setLiteral(this.getNodeForTab(aTab), "scroll", bContent.scrollX + "," + bContent.scrollY + "," + zoomFactor);
   },

   tabSelected: function(needFlush) {
      if (!this.enableBackup || gBrowser.mCurrentTab.hasAttribute("inrestore")) return;
      if (typeof(needFlush) == "undefined") needFlush = false;
      this.initSession(this.gSessionPath[0], this.gThisWin);
      this.setTabsScroll(); // until i find proper event to update tab scroll do it from here
      if (this.prefBranch.getBoolPref("save.selectedtab")) {
         this.setIntLiteral(this.gThisWin, "selectedIndex", this.getTabPosition());
      }
      if (needFlush)
         this.saveStateDelayed();
   },

   getTabPosition: function() { // calc selected tab position if blank tab not restore
      if (gBrowser.isBlankTab(gBrowser.mCurrentTab)) return 0; // if the current tab is blank we don't resore the index
      var blankTab = 0;
      for (var i = 0; i < gBrowser.mCurrentTab._tPos; i++) {
         if (gBrowser.isBlankTab(gBrowser.tabs[i])) blankTab++;
      }
      return gBrowser.mCurrentTab._tPos - blankTab;
   },

   getNodeForTab: function(aTab) {
      return this.gThisWinTabs + "/" + aTab.linkedPanel;
   },

   saveAllTab: function SM_saveAllTab(winPath, offset, saveBusy) {
      var savedTabs = 0 ;
      var rdfNodeTabs = this.getResource(winPath, "tabs");
      var rdfLabelTabs = rdfNodeTabs.QueryInterface(Ci.nsIRDFResource).Value;
      var tabContainer = this.initContainer(rdfNodeTabs);
      for (var i = 0; i < gBrowser.tabs.length; i++) {
         var aTab = gBrowser.tabs[i];
         if (saveBusy && !aTab.hasAttribute("busy"))
           continue; // save only busy tabs
         if (this.saveTab(aTab, rdfLabelTabs, tabContainer, true, offset))
           savedTabs ++;
      }
      return savedTabs;
   },

   // call from tabloaded, tabClosed, saveAllTab
// xxx add flag what to save : all, history, property, scrollPosition
   saveTab: function SM_saveTab(aTab, rdfLabelTabs, tabContainer, needToAppend, offset) {
      var aBrowser = gBrowser.getBrowserForTab(aTab);
      if (gBrowser.isBlankBrowser(aBrowser)) return false;

      // clear sanitized flag
      if (this.prefBranch.prefHasUserValue("sanitized")) {
         this.prefBranch.clearUserPref("sanitized");
         this.setLiteral(this._rdfRoot + "/closedSession/thisSession", "status", "crash");
      }

      var sessionHistory = aBrowser.webNavigation.sessionHistory;
      var rdfLabelTab = rdfLabelTabs + "/" + aTab.linkedPanel;
      var index = sessionHistory.index < 0 ? 0 : sessionHistory.index;
      var bContent = aBrowser.contentWindow;
      var zoomFactor = aBrowser.docShell.contentViewer ? aBrowser.markupDocumentViewer.textZoom : 1;
      try {
         var curHistory = sessionHistory.getEntryAtIndex(index, false);
         curHistory.QueryInterface(Ci.nsISHEntry).setScrollPosition(bContent.scrollX, bContent.scrollY);
      } catch (e) {Tabmix.assert(ex, "saveTab error at index " + sessionHistory.index);}
      var rdfNodeTab = this.RDFService.GetResource(rdfLabelTab);
      var data = {
         index: this.enableSaveHistory ? index : 0,
         pos: aTab._tPos + offset,
         image: aTab.getAttribute("image"),
         properties: TabmixSessionData.getTabProperties(aTab, true),
         history: this.saveTabHistory(sessionHistory),
         scroll: bContent.scrollX + "," + bContent.scrollY + "," + zoomFactor
      };
      this.saveTabData(rdfNodeTab, data);
      this.saveTabviewTab(rdfNodeTab, aTab);

      // dont append if we call from tabClosed function
      if (tabContainer.IndexOf(rdfNodeTab) == -1 && needToAppend) {
         tabContainer.AppendElement(rdfNodeTab);
         this.updateTabPos(aTab, rdfLabelTabs, 1); // update _tPos for the tab right to the new tab
      }
      return true;
   },

   saveTabviewTab: function SM_saveTabviewTab(aNode, aTab) {
      let data = TabmixSessionData.getTabValue(aTab, "tabview-tab");
      if (data != "" && data != "{}")
        this.setLiteral(aNode, "tabview-tab", data);
      else
        this.removeAttribute(aNode, "tabview-tab");
   },

   saveTabData: function SM_saveTabData(aNode, aData) {
      this.setIntLiteral(aNode, "index",      aData.index);
      this.setIntLiteral(aNode, "tabPos",     aData.pos);
      this.setLiteral   (aNode, "image",      aData.image || ""); // for use in closed tab list
      this.setLiteral   (aNode, "properties", aData.properties);
      this.setLiteral   (aNode, "history",    aData.history);
      this.setLiteral   (aNode, "scroll",     aData.scroll);
   },

   // xxx save text size (zoom), char type ?
   saveTabHistory: function(sessionHistory) {
      var historyStart = this.enableSaveHistory ? 0 : sessionHistory.index;
      var historyEnd = this.enableSaveHistory ? sessionHistory.count : sessionHistory.index+1;
      var j, historyEntry, history = [];
      for (j = historyStart; j < historyEnd; j++) {
         try {
            historyEntry = sessionHistory.getEntryAtIndex(j, false).QueryInterface(Ci.nsISHEntry);
            history.push(encodeURI(historyEntry.title));
            history.push(historyEntry.URI.spec);
            history.push(this.getScrollPosHs(historyEntry)); // not in use yet
         } catch (ex) {Tabmix.assert(ex, "saveTabHistory error at index " + j); }
      }
      // generate unique separator and combine the array to one string
      var separator = "][", extraSeparator = "@";
      for (var i = 0; i < history.length; ++i) {
         while (history[i].indexOf(separator) > -1)
            separator += extraSeparator;
      }
      // insert the separator to history so we can extract it in loadTabHistory
      return separator + "|-|" + history.join(separator);
   },

   getScrollPosHs: function(historyEntry) {
      if (this.prefBranch.getBoolPref("save.scrollposition")) {
         var x={}, y={};
         historyEntry.getScrollPosition(x, y);
         return x.value + "," + y.value;
      } return "0,0";
   },

   loadSession: function SM_loadSession(path, caller, overwriteWindows) {
      var sessionContainer = this.initContainer(path);
      var sessionEnum = sessionContainer.GetElements();
      var sessionCount = 0, concatenate;
      var windowEnum = Tabmix.windowEnumerator();
      if (typeof(overwriteWindows) == "undefined")
         overwriteWindows = this.prefBranch.getBoolPref("restore.overwritewindows");
      // don't concatenate window after crash
      if (caller == "firstwindowopen" && this.getLiteralValue(this.gSessionPath[0], "status") == "crash2")
         concatenate = false;
      else
         concatenate = this.prefBranch.getBoolPref("restore.concatenate");
      var saveBeforOverwrite = this.prefBranch.getBoolPref("restore.saveoverwrite");
      var overwriteTabs = this.prefBranch.getBoolPref("restore.overwritetabs");

      // in single window mode we restore ALL window into this window
      if (Tabmix.singleWindowMode)
         concatenate = true;

      // if this window is blank use it when reload session
      var wnd, blankWindow;
      if (!Tabmix.singleWindowMode && concatenate && !overwriteWindows && !gBrowser.isBlankWindow() && caller != "firstwindowopen" && caller != "concatenatewindows") {
         this.openNewWindow(path, "concatenatewindows");
         return;
      }
      // if we join all window to one window
      // call the same window for all saved window with overwritewindows=false and overwritetabs=false if this not the first saved
      // for first saved window overwritetabs determined by user pref
      while (sessionEnum.hasMoreElements()) {
         sessionCount++;
         var rdfNodeSession = sessionEnum.getNext();
         if (rdfNodeSession instanceof Ci.nsIRDFResource) {
            var windowPath = rdfNodeSession.QueryInterface(Ci.nsIRDFResource).Value;
            if (this.nodeHasArc(windowPath, "dontLoad")) continue;
            if (concatenate) {
               if (caller != "concatenatewindows" && caller != "firstwindowopen" && sessionCount == 1
                         && saveBeforOverwrite && overwriteTabs)
                  this.saveOneWindow(this.gSessionPath[0], "", true);
               var newCaller = (sessionCount != 1) ? caller+"-concatenate" : caller;
               this.loadOneWindow(windowPath, newCaller);
            } else {
               wnd = null;
               blankWindow = false;
               if (windowEnum.hasMoreElements()) {
                  wnd = windowEnum.getNext();
                  blankWindow = wnd.gBrowser.isBlankWindow();
               }
               if (wnd != null && (overwriteWindows || blankWindow || (caller == "firstwindowopen" && sessionCount == 1 ))) {
                  // if we save overwrite windows in the closed windows list don't forget to set dontLoad==true
                  if (caller != "firstwindowopen" && saveBeforOverwrite && overwriteTabs)
                     wnd.TabmixSessionManager.saveOneWindow(this.gSessionPath[0], "", true);
                  wnd.TabmixSessionManager.loadOneWindow(windowPath, caller);
               } else
                  this.openNewWindow(windowPath, caller);
            }
         }
      }
      // cloes extra windows if we overwrite open windows and set dontLoad==true
      if (Tabmix.numberOfWindows() > 1 && overwriteWindows) {
         while (windowEnum.hasMoreElements()) {
            wnd = windowEnum.getNext();
            if (concatenate && wnd == window) continue;
            if (saveBeforOverwrite) wnd.TabmixSessionManager.overwriteWindow = true;
            else wnd.TabmixSessionManager.saveThisWindow = false;
            wnd.close();
         }
      }
   },

   openclosedwindow: function SM_openclosedwindow(path, overwriteWindows) {
      // 1. check if to overwrite the opener window
      //    if 1 is true call loadOneWindow
      //    if 1 is false open new window and pass the path
      // 2. delete the window from closedwindow list (after new window is opend and load)
      var rdfNodeClosedWindow = this.RDFService.GetResource(path);
      // don't reopen same window again. the window removed from closed window list after it finish to load
      if (this.nodeHasArc(rdfNodeClosedWindow, "reOpened")) return;
      this.setLiteral(rdfNodeClosedWindow, "reOpened", "true");
      if (typeof(overwriteWindows) == "undefined") overwriteWindows = this.prefBranch.getBoolPref("restore.overwritewindows");
      var saveBeforOverwrite = this.prefBranch.getBoolPref("restore.saveoverwrite");
      var overwriteTabs = this.prefBranch.getBoolPref("restore.overwritetabs");
      if (overwriteWindows || gBrowser.isBlankWindow() || Tabmix.singleWindowMode) {
         if (saveBeforOverwrite && overwriteTabs)
            this.saveOneWindow(this.gSessionPath[0], "", true);
         this.loadOneWindow(path, "openclosedwindow");
      } else
         this.openNewWindow(path, "openclosedwindow");

      this.saveStateDelayed();
   },

   openNewWindow: function SM_openNewWindow(path, caller) {
      var newWindow = window.openDialog( getBrowserURL(), "_blank", "chrome,all,dialog=no", null);
      newWindow.tabmixdata = { path: path, caller: caller };
   },

   loadOneWindow: function SM_loadOneWindow(path, caller) {
      var overwrite = true, restoreSelect = this.prefBranch.getBoolPref("save.selectedtab");
      switch ( caller ) {
         case "firstwindowopen":
               if (window.arguments && window.arguments.length > 0) {
                  let uriToLoad = window.arguments[0];
                  let isLoadingBlank = uriToLoad == "about:blank";
                  overwrite = isLoadingBlank || uriToLoad == gHomeButton.getHomePage() ? true : false;
                  if (!overwrite && !isLoadingBlank)
                    restoreSelect = false;
               }
               else
                 overwrite = false;
            break;
         case "windowopenebytabmix":
         case "concatenatewindows":
               overwrite = true;
            break;
         case "openclosedwindow":
         case "sessionrestore":
            overwrite = this.prefBranch.getBoolPref("restore.overwritetabs");
            break;
         case "firstwindowopen-concatenate":
         case "openclosedwindow-concatenate":
         case "sessionrestore-concatenate":
         case "concatenatewindows-concatenate":
            overwrite = false;
            break;
         default: Tabmix.log("SessionManager \n error unidentifid caller " + caller);
      }
      /*
      1. when open first windows overwrite tab only if they are home page, if firefox open from link or with
         pages that are not the home page append the new tab to the end.
         simple solution is to set browser.startup.page = 0 , when we activate session manager, in this case if we
         have any tabs in the first window we don't overwrite.
      2. when open window by session manager other than the first window (caller = "windowopenebytabmix" and tabmix in the name) overwrite=true
      3. when loadOneWindow call by openclosedwindow or loadSession we reuse window check user pref for overwrite.
      4. if we open all closed windows to one window append tab to the end and select the selected tab from first window
         in the session.
      */
      var cTab = gBrowser.mCurrentTab;
      var concatenate = caller.indexOf("-concatenate") != -1 || (caller == "firstwindowopen" && gBrowser.tabs.length > 1);
      var rdfNodeWindow = this.RDFService.GetResource(path);
      var rdfNodeTabs = this.getResource(rdfNodeWindow, "tabs");
      if (!(rdfNodeTabs instanceof Ci.nsIRDFResource) || this.containerEmpty(rdfNodeTabs)) {
         alert(TabmixSvc.getSMString("sm.restoreError.msg0") + "\n"  + TabmixSvc.getSMString("sm.restoreError.msg1"));
         let tabmix_loading = gBrowser.selectedBrowser.contentDocument.tabmix_loading;
         if (tabmix_loading) {
            gBrowser.selectedBrowser.reload();
            delete gBrowser.selectedBrowser.contentDocument.tabmix_loading;
         }
         return;
      }

      // restore TabView data before we actualy load the tabs
      this._setWindowStateBusy(rdfNodeWindow);

      var lastSelectedIndex = restoreSelect ? this.getIntValue(rdfNodeWindow, "selectedIndex") : 0;
      if (lastSelectedIndex < 0 || lastSelectedIndex >= newtabsCount) lastSelectedIndex = 0;

      function TMP_addTab() {
        let newTab = gBrowser.addTab("about:blank", {skipAnimation: true});
        newTab.setAttribute("tabmix_hide", "true");
        // flag. dont save tab that are in restore phase
        newTab.setAttribute("inrestore", "true");

        return newTab;
      }

      // make sure to reset the attributes, in case this tab gets reused
      function TMP_resetAttributes(aTab) {
        let browser = gBrowser.getBrowserForTab(aTab);
        browser.stop();
        // reset old history
        let history = browser.webNavigation.sessionHistory;
        if (history.count > 0)
          history.PurgeHistory(history.count);
        history.QueryInterface(Ci.nsISHistoryInternal);

        if (TabmixTabbar.hideMode != 2 && TabmixTabbar.widthFitTitle && !aTab.hasAttribute("width"))
         aTab.setAttribute("width", aTab.getBoundingClientRect().width);

        // remove selected and flst_id from all tabs but the current
        if (aTab != cTab) {
          aTab.removeAttribute("visited");
          aTab.removeAttribute("flst_id");
        }
        // if we need to remove extra tabs make sure they are not protected
        if (aTab.hasAttribute("protected"))
          aTab.removeAttribute("protected");
        // remove tabmix attribute
        aTab.removeAttribute("fixed-label");
        aTab.removeAttribute("label-uri");
        // reset pinned and hidden tabs
        aTab.removeAttribute("hidden");
        if (aTab.pinned)
          gBrowser.unpinTab(aTab);

        // Make sure that set/getTabValue will set/read the correct data by
        // wiping out any current value in tab.__SS_extdata.
        delete aTab.__SS_extdata;
        // delete any sesionRestore data
        delete browser.__SS_data;
      }

      var tabContainer = this.initContainer(rdfNodeTabs);
      var newtabsCount = tabContainer.GetCount();
      var newIndex, aTab, loadOnStartup = [];
      if (newtabsCount > 0 && overwrite) {
         // unpinned tabs reorder tabs, so we loob backward
         for (let i = gBrowser.tabs.length - 1 ; i >= 0; i--) {
           TMP_resetAttributes(gBrowser.tabs[i]);
         }
         while (newtabsCount > gBrowser.tabs.length) {
            let newTab = TMP_addTab();
         }
         cTab.setAttribute("inrestore", "true");
         // move selected tab to place
         gBrowser.moveTabTo(cTab, lastSelectedIndex);
         // remove extra tabs
         while (newtabsCount < gBrowser.tabs.length) {
            let tab = gBrowser.tabContainer.lastChild;
            // workaround to prevent entring Tabview when we remove last item from a group
            if (!Tabmix.isVersion(60))
               tab._tabViewTabIsRemovedAfterRestore = true;
            gBrowser.removeTab(tab);
         }
         newIndex = 0;
      }
      else if (newtabsCount > 0 && !overwrite) { // we use this in TGM and panorama (TabViewe)
         // catch blank tab for reuse
         var blankTabs = [], blankTabsCount = 0, currentTabIsBalnk = false;
         // unpinned tabs reorder tabs loob backward
         for (let i = gBrowser.tabs.length - 1 ; i >= 0; i--) {
            aTab = gBrowser.tabs[i];
            // make sure we not overwrite tab that loads from apps
            if (aTab.loadOnStartup) {
              loadOnStartup.push(aTab);
              delete aTab.loadOnStartup;
            }
            else if (caller == "firstwindowopen" || // overwrite all tabs that are not from apps on first window
                 gBrowser.isBlankTab(aTab) && (aTab.hasAttribute("tabmix_busy") || !aTab.hasAttribute("busy"))) {
               aTab.removeAttribute("tabmix_busy");
               TMP_resetAttributes(aTab);
               blankTabs.push(aTab);
            }
         }

         // make sure not to remove the current tab
         let index = blankTabs.indexOf(cTab);
         if (index > -1) {
           currentTabIsBalnk = true;
           blankTabs.unshift(blankTabs.splice(index, 1)[0]);
         }
         // remove extra tabs
         var blankTab;
         while (blankTabs.length > newtabsCount) {
            blankTab = blankTabs.pop();
            // workaround to prevent entring Tabview when we remove last item from a group
            if (!Tabmix.isVersion(60))
              blankTab._tabViewTabIsRemovedAfterRestore = true;
            if (blankTab)
               gBrowser.removeTab(blankTab);
         }

         // reuse blank tabs and move tabs to the right place
         var openTabNext = Tabmix.getOpenTabNextPref();
         // fix and merge session Tabview data with current window Tabview data
         this._preperTabviewData(loadOnStartup, blankTabs);
         if (this.groupUpdates.hideSessionActiveGroup) {
           restoreSelect = false;
           lastSelectedIndex = 0;
           openTabNext = false;
         }

         blankTabsCount = blankTabs.length;
         let tabsCount = gBrowser.tabs.length;
         let lastIndex = tabsCount - 1;
         let newTotalTabsCount = tabsCount - blankTabsCount + newtabsCount;

         // we don't need to move tab after itself
         if (currentTabIsBalnk)
           blankTabs.shift();

         let needToMove = openTabNext && !concatenate;
         let newPos = needToMove ? cTab._tPos + 1 : lastIndex + 1;
         // move blank tabs to new position
         for (let t = 0; t < blankTabs.length ; t++) {
            blankTab = blankTabs[t];
            tabPos = blankTab._tPos < newPos ? newPos - 1 : newPos;
            gBrowser.moveTabTo(blankTab, tabPos);
         }

         if (cTab._tPos == lastIndex || blankTabs.indexOf(gBrowser.tabs[lastIndex]) > -1)
           needToMove = false;
         while (newTotalTabsCount > gBrowser.tabs.length) {
            let newTab = TMP_addTab();
            if (needToMove)
               gBrowser.moveTabTo(newTab, cTab._tPos + 1);
            // just in case the tab is not in its place, move it to the end
            else if (newTab._tPos < gBrowser.tabs.length - 1)
               gBrowser.moveTabTo(newTab, gBrowser.tabs.length - 1);
         }

         if (tabsCount == blankTabsCount) newPos = 0;
         else newPos = (openTabNext && cTab._tPos < gBrowser.tabs.length - 1 && !concatenate) ? cTab._tPos + 1 : tabsCount - blankTabsCount;
         if (!concatenate && restoreSelect) { // in concatenate mode we select tab only from first window
            if (currentTabIsBalnk) { // if the current tab is not blank select new tab
               if (openTabNext && newPos > 0)
                 newPos--;
               // move selected tab to place
               gBrowser.moveTabTo(cTab, newPos + lastSelectedIndex);
            }
            else
              this.updateSelected(newPos + lastSelectedIndex, caller=="firstwindowopen" || caller=="windowopenebytabmix");
         }
         newIndex = newPos;
      }

      gBrowser._lastRelatedTab = null;
      // call mTabstrip.ensureElementIsVisible before and after we reload the tab
      gBrowser.tabContainer.mTabstrip.ensureElementIsVisible(gBrowser.selectedTab);
      gBrowser.tabsToLoad = newtabsCount;
      this.setStripVisibility(newtabsCount);

      var self = this;
      var tabsData = [];
      var firstVisibleTab = -1;
      function _tabData(rdfTab) {
        this.node = rdfTab;
        this.properties = self.getLiteralValue(rdfTab, "properties");
        let attrib = {xultab: this.properties};
        this.hidden = self.groupUpdates.hideSessionActiveGroup ||
                      TMP_SessionStore._getAttribute(attrib, "hidden") == "true";
        this.index = self.getIntValue(rdfTab, "tabPos");
        this.pinned = TMP_SessionStore._getAttribute(attrib, "pinned") == "true";

        if (!this.hidden && !restoreSelect && (firstVisibleTab < 0 || this.index < firstVisibleTab))
          firstVisibleTab = this.index;
      }
      _tabData.prototype.toString = function() { return this.index; }

      var tabsEnum = tabContainer.GetElements();
      while (tabsEnum.hasMoreElements()) {
        let rdfNodeTab = tabsEnum.getNext();
        if (rdfNodeTab instanceof Ci.nsIRDFResource) {
          tabsData.push(new _tabData(rdfNodeTab));
        }
      }

      // sort the tab by tabsData.index see _tabData
      function sortbyIndex(a, b) {return a - b;}

      // init the new container before we start to load new data
      this.initSession(this.gSessionPath[0], this.gThisWin);
      if (tabsData.length > 0) {
        // make sure rdf tabs are in order
        tabsData.sort(sortbyIndex);

        // when we don't restore the selected tab and don't have any tabs opened
        // by other application, we need to select first tab in the current group
        // if we append the session to hidden groups firstVisibleTab is -1
        if (!loadOnStartup.length && !restoreSelect && firstVisibleTab > 0)
          gBrowser.selectedTab = gBrowser.tabs[newIndex + firstVisibleTab];

        // set pin tab now before we reorder tabsData
        // by moving selected tab to first place
        for (let t = 0; t < tabsData.length ; t++) {
          let data = tabsData[t];
          let tab = tabsData[t].tab = gBrowser.tabs[newIndex + t];
          // flag. dont save tab that are in restore phase
          if (!tab.hasAttribute("inrestore"))
            tab.setAttribute("inrestore", "true");
          if (data.pinned)
            gBrowser.pinTab(tab);

          if (data.hidden) {
            gBrowser.hideTab(tab);
            data.index += tabsData.length;
          }
          else
            gBrowser.showTab(tab);
        }

        // move selected tab to first place (if any in the array)
        if (lastSelectedIndex > 0 && restoreSelect && lastSelectedIndex in tabsData) {
          tabsData[lastSelectedIndex].index = -1;
        }

        // restore visible group first
        tabsData.sort(sortbyIndex);

        for (let t = 0; t < tabsData.length ; t++) {
          this.loadOneTab(tabsData[t]);
        }
      }

      // notify Tabview that we are ready
      var showNotification = caller != "firstwindowopen" || this.prefBranch.getIntPref("onStart") == 1;
      this._setWindowStateReady(overwrite, showNotification);

      // when resuming at startup: add additionally requested pages to the end
      if (caller == "firstwindowopen" && loadOnStartup.length) {
        let lastPlace = gBrowser.tabs.length-1;
        Array.forEach(loadOnStartup, function(aTab) {
          gBrowser.moveTabTo(aTab, lastPlace);
        });
      }

      // load closed tabs from saved session and save to current backup.
      if (this.saveClosedtabs)
         this.saveClosedTabs(path, this.gThisWin, "closedtabs", true);

      TMP_ClosedTabs.setButtonDisableState();
      // if we open closed window delete this window from closed window list
      var caller1;
      if ("tabmixdata" in window) {
         caller1 = window.tabmixdata.caller;
         delete window.tabmixdata;
      }
      if (caller == "openclosedwindow" || caller1 == "openclosedwindow"){
         if (this.nodeHasArc(rdfNodeWindow, "reOpened")) {
            this.removeSession(path, this.gSessionPath[0]);
            this.updateClosedWindowsMenu("check");
         }
      }
   },

   updateSelected: function(newIndex, removeAttribute) {
      let oldIndex = gBrowser.tabContainer.selectedIndex;
      if (newIndex != oldIndex) {
        let tabs = gBrowser.tabs;
        gBrowser.selectedTab = tabs[newIndex];
        if (removeAttribute) {
          tabs[oldIndex].removeAttribute("visited");
          tabs[oldIndex].removeAttribute("flst_id");
        }
      }
   },

   setStripVisibility: function(tabCount) {
      // unhide the tab bar
      if (tabCount > 1 && Services.prefs.getBoolPref("browser.tabs.autoHide") && !gBrowser.tabContainer.visible) {
        gBrowser.tabContainer.visible = true;
      }
   },

   saveClosedTabs: function SM_saveClosedTabs(fromPath, toPath, conPath, updateClosedTabsList) {
      var isClosedTabs = conPath == "closedtabs";
      if (isClosedTabs && !(this.saveClosedtabs))
         return;

      TMP_SessionStore.initService();
      var fromOld = this.wrapContainer(fromPath, conPath);
      if (!(fromOld.Root instanceof Ci.nsIRDFResource)) return;
      var toNew = this.wrapContainer(toPath, conPath);
      var rdfNodeTabs = this.getResource(toPath, "tabs");
      var rdfLabelTabs = rdfNodeTabs.QueryInterface(Ci.nsIRDFResource).Value;
      var maxTabsUndo = Services.prefs.getIntPref("browser.sessionstore.max_tabs_undo");
      var newIndex = -1;
      while (fromOld.Enum.hasMoreElements()) {
         var rdfNodeSession = fromOld.Enum.getNext();
         if (!(rdfNodeSession instanceof Ci.nsIRDFResource)) continue;
         newIndex++;
         if (isClosedTabs && (fromOld.Count - newIndex > Services.prefs.getIntPref("browser.sessionstore.max_tabs_undo"))) continue;
         var uniqueId = "panel" + Date.now() + newIndex;
         var rdfLabelSession = rdfLabelTabs + "/" + uniqueId;
         var newNode = this.RDFService.GetResource(rdfLabelSession);
         var data = {}
         data.pos = this.getIntValue(rdfNodeSession, "tabPos");
         data.image = this.getLiteralValue(rdfNodeSession, "image");
         data.properties = this.getLiteralValue(rdfNodeSession, "properties");
         data.scroll = this.getLiteralValue(rdfNodeSession, "scroll"); // including zoom factor
         if (this.enableBackup) { // save only if backup enabled
            toNew.Container.AppendElement(newNode);
            data.index = this.getIntValue(rdfNodeSession, "index");
            data.history = this.getLiteralValue(rdfNodeSession, "history");
            this.saveTabData(newNode, data);
            // delete old entry if closedTabs container wasn't empty
            if (isClosedTabs && (toNew.Container.GetCount() > maxTabsUndo))
               this.deleteClosedtabAt(1, toPath);
         }
      }
      // if we after restart we get closed data from FF sessionRestore
      if (updateClosedTabsList && !Tabmix.isWindowAfterSessionRestore) {
         let state = { windows: [], _firstTabs: true };
         state.windows[0] = { _closedTabs: [] };
         state.windows[0]._closedTabs = TabmixConvertSession.getClosedTabsState(this.getResource(fromPath, "closedtabs"));
         TabmixSvc.ss.setWindowState(window, Tabmix.JSON.stringify(state), false);
      }
   },

   copyClosedTabsToRDF: function SM_copyClosedTabsToRDF(winPath) {
      var rdfNodeTo = this.getResource(winPath, "closedtabs");
      var toContainer = this.initContainer(rdfNodeTo);
      var rdfNodeTabs = this.getResource(winPath, "tabs");
      var rdfLabelTabs = rdfNodeTabs.QueryInterface(Ci.nsIRDFResource).Value;
      var ctabs = TMP_ClosedTabs.getClosedTabData;
      var tabCount = ctabs.length;
      var maxTabsUndo = Services.prefs.getIntPref("browser.sessionstore.max_tabs_undo");
      var tabData, uniqueId, rdfLabelSession, newNode, historyEntry, scrollPos, history;
      for (var i = tabCount - 1; i >= 0; i--) {
         uniqueId = "panel" + Date.now() + i;
         rdfLabelSession = rdfLabelTabs + "/" + uniqueId;
         newNode = this.RDFService.GetResource(rdfLabelSession);
         toContainer.AppendElement(newNode);
         tabData = ctabs[i];
         this.getSessionStoreDataForRDF(tabData);
         this.saveTabData(newNode, tabData);

         // delete old entry if closedTabs container wasn't empty
         if (toContainer.GetCount() > maxTabsUndo)
            this.deleteClosedtabAt(1, winPath);
      }
      this.saveStateDelayed();
   },

   getSessionStoreDataForRDF: function SM_getSessionStoreDataForRDF(aTabData) {
      var tabState = aTabData.state;
      var count = tabState.entries.length;
      var activeIndex = (tabState.index || count) - 1;
      var historyStart = this.enableSaveHistory ? 0 : activeIndex;
      var historyEnd = this.enableSaveHistory ? count : activeIndex + 1;
      var j, historyEntry, history = [];
      for (j = historyStart; j < historyEnd; j++) {
         try {
            historyEntry = tabState.entries[j];
            history.push(encodeURI(historyEntry.title || ""));
            history.push(historyEntry.url);
            history.push(historyEntry.scroll || "0,0"); // not in use yet
         } catch (ex) {Tabmix.assert(ex, "saveTabHistory error at index " + j); }
      }
      // generate unique separator and combine the array to one string
      var separator = "][", extraSeparator = "@";
      for (var i = 0; i < history.length; ++i) {
         while (history[i].indexOf(separator) > -1)
            separator += extraSeparator;
      }
      // insert the separator to history so we can extract it in loadTabHistory
      aTabData.history = separator + "|-|" + history.join(separator);
      aTabData.index = this.enableSaveHistory ? activeIndex : 0,

      aTabData.scroll = this.prefBranch.getBoolPref("save.scrollposition") ?
                         (tabState.entries[activeIndex].scroll || "0,0") + "," + (aTabData.zoom || 1) : "0,0,1";
      // closed tab can not be protected - set protected to 0
      var _locked = TMP_SessionStore._getAttribute(tabState, "_locked") != "false" ? "1" : "0";
      aTabData.properties = "0" + _locked;
      if ("disallow" in tabState && tabState.disallow) {
         for (var j = 0; j < TabmixSessionData.docShellItems.length; j++ )
            aTabData.properties += tabState.disallow.indexOf(TabmixSessionData.docShellItems[j]) == -1 ? "1" : "0";
      }
      else {
         aTabData.properties += "11111";
      }
      if ("attributes" in tabState && tabState.attributes) {
         delete tabState.attributes["_locked"];
         for (var name in tabState.attributes) {
            aTabData.properties += " " + name + "=" + encodeURI(tabState.attributes[name]);
         }
      }
      if ("xultab" in tabState && tabState.xultab) {
         tabState.xultab = tabState.xultab.replace(" _locked=true", "").replace(" _locked=false", "");
         if (tabState.xultab)
            aTabData.properties += " " + tabState.xultab;
      }
   },

   deleteAllClosedtabs: function(sessionContainer) { // delete all closed tabs in this session
      var windowEnum = sessionContainer.GetElements();
      while (windowEnum.hasMoreElements()) {
         var rdfNodeWindow = windowEnum.getNext();
         this.deleteWinClosedtabs(rdfNodeWindow.QueryInterface(Ci.nsIRDFResource).Value);
      }
   },

   deleteWinClosedtabs: function SM_deleteWinClosedtabs(winPath) {
      var rdfNodeTabs = this.getResource(winPath, "closedtabs");
      // After sanitize there are no closedtabs.
      if (rdfNodeTabs) {
        let container = this.initContainer(rdfNodeTabs);
        this.deleteWithProp(container);
        this.saveStateDelayed();
      }
   },

   deleteClosedtabAt: function SM_deleteClosedtabAt(index, winPath) {
      if (!this.prefBranch.getBoolPref("save.closedtabs"))
         return;
      if (typeof(winPath) == 'undefined')
         winPath = this.gThisWin;
      var rdfNodeTabs = this.getResource(winPath, "closedtabs");
      var container = this.initContainer(rdfNodeTabs);
      if (index == "last")
         index = container.GetCount();
      if (index < 1 || index > container.GetCount())
         return;
      var nodeToDelete = container.RemoveElementAt(index, true);
      var nodeValue = nodeToDelete.QueryInterface(Ci.nsIRDFResource).Value
      this.deleteSubtree(nodeValue);
      if (!container.GetCount()) this.deleteNode(rdfNodeTabs);
      this.saveStateDelayed();
   },

   loadOneTab: function SM_loadOneTab(tabData) {
      var rdfNodeSession = tabData.node;
      var aTab = tabData.tab;
      aTab.removeAttribute("tabmix_hide");
      // load Properties before we load History
      var tabProperties = tabData.properties;
      if (tabProperties != "")
         TabmixSessionData.setTabProperties(aTab, tabProperties, true);
      var aBrowser = gBrowser.getBrowserForTab(aTab);
      aBrowser.stop();
      var webNav = aBrowser.webNavigation;
      var savedHistory = this.loadTabHistory(rdfNodeSession, webNav.sessionHistory);
      if (savedHistory == null) {
         Tabmix.log("loadOneTab() - tab at index " + aTab._tPos + " failed to load data from the saved session");
         gBrowser.removeTab(aTab);
         return;
      }

      this._setTabviewTab(tabData, savedHistory);

      try {
         let self = this;
         let needToReload = this.prefBranch.getBoolPref("restore.reloadall") &&
                         savedHistory.currentURI.indexOf("file:") != 0;
         aBrowser.addEventListener("load", function TMP_onLoad_oneTab(aEvent) {
           aEvent.currentTarget.removeEventListener("load", TMP_onLoad_oneTab, true);
           self.afterTabLoad(aEvent.currentTarget, needToReload, rdfNodeSession);
         }, true);
         aBrowser.gotoIndex(savedHistory.index);
      } catch (e) {Tabmix.log("error in loadOneTab gotoIndex ? ");}
   }, // end of "loadOneTab : function(...............)"

   afterTabLoad: function SM_afterTabLoad(aBrowser, aNeedToReload, aNodeSession) {
      var tab = gBrowser.getTabForBrowser(aBrowser);
      var tabExist = tab && tab.parentNode; // make sure tab was not removed

      if (tabExist && aNeedToReload) {
         const nsIWebNavigation = Components.interfaces.nsIWebNavigation;
         let _webNav = aBrowser.webNavigation;
         try {
            let sh = _webNav.sessionHistory;
            if (sh)
               _webNav = sh.QueryInterface(nsIWebNavigation);
         } catch (e) {}

         try {
            const flags = nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY | nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
            _webNav.reload(flags);
         } catch (e) {}
      }
      // don't mark new tab as unread
      var url = aBrowser.currentURI.spec;
      if (url == "about:blank" || url == "about:newtab")
        tab.setAttribute("visited", true);

      // restore scroll position
      if (this.prefBranch.getBoolPref("save.scrollposition")) {
         let XYZ = this.getLiteralValue(aNodeSession, "scroll", "0,0,1");
         if (XYZ != "0,0,1") {
            XYZ = XYZ.split(",");
            try {
               var sHistory = aBrowser.webNavigation.sessionHistory;
               var curHistory = sHistory.getEntryAtIndex(sHistory.index, false);
               curHistory.QueryInterface(Ci.nsISHEntry).setScrollPosition(XYZ[0], XYZ[1]);
            } catch (ex) {Tabmix.assert(ex, "loadOneTab error index " + sHistory.index); }
            if (tabExist)
               this.setScrollPosition(tab, aBrowser, {href: null, _scrollX: XYZ[0], _scrollY: XYZ[1], zoom: XYZ[2] || 1}, 15);
         }
      }
      if (tabExist) {
        tab.removeAttribute("inrestore");
      }

      // call mTabstrip.ensureElementIsVisible for the current tab
      gBrowser.tabContainer.mTabstrip.ensureElementIsVisible(gBrowser.selectedTab);
      // check if we restore all tabs
      if (--gBrowser.tabsToLoad == 0) {
         delete gBrowser.tabsToLoad;
         TabmixTabbar.updateBeforeAndAfter(); // just in case (we do it also in setTabTitle
         if (this.enableBackup){
            var result = this.saveOneWindow(this.gSessionPath[0], "windowbackup");
            if (result > 0)
               this.saveStateDelayed(-1);
         }
         this.setLiteral(this._rdfRoot + "/closedSession/thisSession", "status", "crash");
      }
   },

   setScrollPosition: function SM_setScrollPosition(aTab, aBrowser, aData, attempts) {
      var bContent = aBrowser.contentWindow;
      var docViewer;
      // we don't use zoom after we drop support for Firefox 2.0 , so null the value
      aData.zoom = null;
      if (!aTab.hasAttribute("busy")) {
         if (bContent.scrollX != aData._scrollX || bContent.scrollY != aData._scrollY)
            bContent.scrollTo(aData._scrollX, aData._scrollY);
      }
      if (attempts && ( bContent.scrollX != aData._scrollX || bContent.scrollY != aData._scrollY)) {
         window.setTimeout(function (tab, browser, data, _attempts) {
           TabmixSessionManager.setScrollPosition(tab, browser, data, _attempts);
         }, 50, aTab, aBrowser, aData, --attempts);
         return;
      } else {
         // if we save this before timeout sometimes scroll is not ready yet
         if (TabmixSessionManager.enableBackup)
            TabmixSessionManager.setLiteral(TabmixSessionManager.getNodeForTab(aTab), "scroll", aData._scrollX + "," + aData._scrollY + "," + aData.zoom);
         // call by openLinkWithHistory
         if (aData.href)
            window.setTimeout( function(aBrowser, aURI) {
               aBrowser.loadURI(aURI, null, null);
            }, 0, aBrowser, aData.href);
      }
   },

   loadTabHistory: function(rdfNodeSession, sHistoryInternal) {
      var history = this.getLiteralValue(rdfNodeSession, "history");
      var tmpData = history.split("|-|");
      var sep = tmpData.shift(); // remove seperator from data
      var historyData = tmpData.join("|-|").split(sep);
      if (historyData.length < this.HSitems) {
         Tabmix.log("error in loadTabHistory" + "\n" + "historyData.length " + historyData.length + "\n" + "historyData " + historyData + "\n" + "history " + history);
         return null; // if it less then 3 no data !!
      }
      if (typeof(sHistoryInternal) == "undefined")
         sHistoryInternal = Components.classes["@mozilla.org/browser/shistory;1"]
                                 .createInstance(Ci.nsISHistory);
      sHistoryInternal = sHistoryInternal.QueryInterface(Components.interfaces.nsISHistoryInternal);
      var sessionIndex = this.getIntValue(rdfNodeSession, "index");
      var historyCount = historyData.length/this.HSitems;
      if ( sessionIndex < 0 || sessionIndex >= historyCount ) sessionIndex = historyCount - 1;
      var index, historyEntry, entryTitle, uriStr, newURI, XY;
      var currentURI = historyData[sessionIndex * this.HSitems + 1];
      for ( var i = 0; i < historyCount; i++ ){
         index = i * this.HSitems;
         if (!this.enableSaveHistory && sessionIndex != i) continue;
         historyEntry = Components.classes["@mozilla.org/browser/session-history-entry;1"]
                           .createInstance(Ci.nsISHEntry);
         entryTitle = this.getDecodedLiteralValue(null, historyData[index]);
         uriStr = historyData[index + 1];
         if (uriStr == "") uriStr = "about:blank";
         newURI = Services.io.newURI(uriStr, null, null);
         historyEntry.setTitle(entryTitle);
         historyEntry.setURI(newURI);
         historyEntry.saveLayoutStateFlag = true;
         if (this.prefBranch.getBoolPref("save.scrollposition")) {
            if (historyData[index + 2] != "0,0") {
               XY = historyData[index + 2].split(",");
               historyEntry.setScrollPosition(XY[0], XY[1]); // XY is array [x,y]
            }
         }
         sHistoryInternal.addEntry(historyEntry, true);
      }
      if (!this.enableSaveHistory) sessionIndex = 0;
      return {history: sHistoryInternal, index: sessionIndex, currentURI: currentURI, label: entryTitle};
   },

  /* ............... Back up and archive sessions ............... */

  archiveSessions: function SM_archiveSessions() {
    var lastBackup = this.getMostRecentBackup();
    // Backup Sessions if there aren't any backups or
    // they haven't been backed up in the last 24 hrs.
    const SESSIONS_ARCHIVE_INTERVAL = 86400 * 1000;
    if (!lastBackup ||
        Date.now() - lastBackup.lastModifiedTime > SESSIONS_ARCHIVE_INTERVAL) {
      var maxBackups = 7;
      // The maximum number of daily sessions backups to
      // keep in <profile>/sessionbackups. Special values:
      // -1: unlimited
      //  0: no backups created (and deletes all existing backups)
      // "extensions.tabmix.sessions.max_backups";
      try {
        maxBackups = this.prefBranch.getIntPref("max_backups");
      } catch(ex) { }

      this.archiveSessionsFile(maxBackups, false /* don't force */);
    }
  },

  getSessionsBackupDir: function SM_getSessionsBackupDir(aCretate) {
    var sessionsBackupDir = this.profileDir;
    sessionsBackupDir.append("sessionbackups");
    if (aCretate && !sessionsBackupDir.exists())
      sessionsBackupDir.create(Ci.nsIFile.DIRECTORY_TYPE, parseInt("0700", 8));
    return sessionsBackupDir;
  },

  /**
   * Get the most recent backup file.
   * @returns nsIFile backup file
   */
  getMostRecentBackup: function SM_getMostRecentBackup() {
    var sessionsBackupDir = this.getSessionsBackupDir(false);
    if (!sessionsBackupDir.exists())
      return null;

    var backups = [];
    var entries = sessionsBackupDir.directoryEntries;
    while (entries.hasMoreElements()) {
      var entry = entries.getNext().QueryInterface(Ci.nsIFile);
      if (!entry.isHidden() && entry.leafName.match(/^tabmix_sessions-.+(rdf)?$/))
        backups.push(entry.leafName);
    }

    if (backups.length ==  0)
      return null;

    backups.sort();
    var filename = backups.pop();

    var backupFile = sessionsBackupDir.clone();
    backupFile.append(filename);
    return backupFile;
  },

  /**
   * ArchiveSessionsFile()
   *
   * Creates a dated backup once a day in <profile>/sessionbackups.
   *
   * @param int aNumberOfBackups - the maximum number of backups to keep
   *
   * @param bool aForceArchive - forces creating an archive even if one was
   *                             already created that day (overwrites)
   */
  archiveSessionsFile:
  function SM_archiveSessionsFile(aNumberOfBackups, aForceArchive) {
    var sessionsBackupDir = this.getSessionsBackupDir(true);
    if (!sessionsBackupDir.exists())
      return; // unable to create directory!

    // construct the new leafname
    // Use YYYY-MM-DD (ISO 8601) as it doesn't contain illegal characters
    // and makes the alphabetical order of multiple backup files more useful.
    var d = new Date();
    var date = [d.getFullYear(), '-', d.getMonth()<9 ? "0":"", d.getMonth()+1, '-', d.getDate()<10 ? "0":"", d.getDate()].join('');
    var backupFilename = "tabmix_sessions-" + date + ".rdf"
    var backupFile = null;
    if (!aForceArchive) {
      var backupFileNames = [];
      var backupFilenamePrefix = backupFilename.substr(0, backupFilename.indexOf("-"));
      var entries = sessionsBackupDir.directoryEntries;
      while (entries.hasMoreElements()) {
        var entry = entries.getNext().QueryInterface(Ci.nsIFile);
        var backupName = entry.leafName;
        if (backupName.substr(0, backupFilenamePrefix.length) == backupFilenamePrefix) {
          if (backupName == backupFilename)
            backupFile = entry;
          backupFileNames.push(backupName);
        }
      }

      var numberOfBackupsToDelete = 0;
      if (aNumberOfBackups > -1)
        numberOfBackupsToDelete = backupFileNames.length - aNumberOfBackups;
      if (numberOfBackupsToDelete > 0) {
        // If we don't have today's backup, remove one more so that
        // the total backups after this operation does not exceed the
        // number specified in the pref.
        if (!backupFile)
          numberOfBackupsToDelete++;

        backupFileNames.sort();
        while (numberOfBackupsToDelete--) {
          backupFile = sessionsBackupDir.clone();
          backupFile.append(backupFileNames[0]);
          backupFile.remove(false);
          backupFileNames.shift();
        }
      }

      // do nothing if we either have today's backup already
      // or the user has set the pref to zero.
      if (backupFile || aNumberOfBackups == 0)
        return;
    }

    backupFile = sessionsBackupDir.clone();
    backupFile.append(backupFilename);

    if (aForceArchive && backupFile.exists())
        backupFile.remove(false);

    if (!backupFile.exists()) {
      var sessionsFile = this.profileDir;
      sessionsFile.append("session.rdf");
      if (sessionsFile.exists())
         sessionsFile.copyTo(sessionsBackupDir, backupFilename);
    }
  },

  /* ............... TabView Data ............... */

  _sendWindowStateEvent: function SM__sendWindowStateEvent(aType) {
    let event = document.createEvent("Events");
    event.initEvent("SSWindowState" + aType, true, false);
    window.dispatchEvent(event);
  },

  // aWindow: rdfNodeWindow to read from
  _setWindowStateBusy: function SM__setWindowStateBusy(aWindow) {
    TMP_SessionStore.initService();
    this._sendWindowStateEvent("Busy");
    this._getdSessionTabviewData(aWindow);

    // save group count before we start the restore
    var parsedData = TabmixSessionData.getWindowValue(window, "tabview-groups", true);
    this._groupCount = parsedData.totalNumber || 1;
    this._updateUIpageBounds = false;
  },

  _setWindowStateReady: function SM__setWindowStateReady(aOverwriteTabs, showNotification) {
    this._saveTabviewData();
    if (!aOverwriteTabs)
      this._groupItems = this._tabviewData["tabview-group"];

    this._updateLastSessionGroupName();

    var parsedData = TabmixSessionData.getWindowValue(window, "tabview-groups", true);
    var groupCount = parsedData.totalNumber || 1;
    TabView.updateGroupNumberBroadcaster(groupCount);

    // show notification
    if (showNotification && (aOverwriteTabs && groupCount > 1 || groupCount > this._groupCount))
      this.showNotification();

    // update page bounds when we overwrite tabs
    if (aOverwriteTabs || this._updateUIpageBounds)
      this._setUIpageBounds();

    this._sendWindowStateEvent("Ready");
    if (TabView._window && !aOverwriteTabs) {
      // when we don't overwriting tabs try to rearrange the groupItems
      // when TabView._window is false we call this function after tabviewframeinitialized event
      this._groupItemPushAway();
    }

    this.groupUpdates = {};
    this._tabviewData = {};
  },

  groupUpdates: {},
  _tabviewData: {},
  _groupItems: null,

  // aWindow: rdfNodeWindow to read from
  _getdSessionTabviewData: function SM__getdSessionTabviewData(aWindow) {
    let self = this;
    function _fixData(id, parse, def) {
      let data = self.getLiteralValue(aWindow, id);
      if (data && data != "null")
        return parse ? Tabmix.JSON.parse(data) : data;
      return def;
    }

    let groupItems = _fixData("tabview-group", true, {});
    let groupsData = _fixData("tabview-groups", true, {});
    this._validateGroupsData(groupItems, groupsData);
    this._tabviewData["tabview-group"] = groupItems;
    this._tabviewData["tabview-groups"] = groupsData;
    this.groupUpdates.lastActiveGroupId = groupsData.activeGroupId;

    this._tabviewData["tabview-ui"] = _fixData("tabview-ui", false, Tabmix.JSON.stringify({}));
    this._tabviewData["tabview-visibility"] = _fixData("tabview-visibility", false, "false");

    if (Tabmix.isVersion(70) && !Tabmix.isVersion(100)) {
      let type = "tabview-last-session-group-name";
      this._lastSessionGroupName = this.getLiteralValue(aWindow, type, "");
    }
  },

  _saveTabviewData: function SM__saveTabviewData() {
    for (let id in this._tabviewData) {
      this._setTabviewData(id, this._tabviewData[id]);
    }
  },

  _setTabviewData: function SM__setTabviewData(id, data) {
    if (typeof(data) != "string")
      data = Tabmix.JSON.stringify(data);
    TabmixSvc.ss.setWindowValue(window, id, data);
    if (!this.enableBackup)
      return;
    if (data != "" && data != "{}")
      this.setLiteral(this.gThisWin, id, data);
    else
      this.removeAttribute(this.gThisWin, id);
  },

  _setTabviewTab: function SM__setTabviewTab(tabData, aEntry){
    if (tabData.tab.pinned)
      return;

    let parsedData;
    function setData(id) {
      let data = { groupID: id };
      if (!Tabmix.isVersion(140)) {
        data.url = aEntry.currentURI;
        data.title = aEntry.label;
      }
      if (!Tabmix.isVersion(60)) {
        // fake bounds, panorama check for bounds in TabItem__reconnect
        data.bounds = {left:0, top:0, width:160, height:120};
      }
      parsedData = data;
      return Tabmix.JSON.stringify(data);
    }

    var update = this.groupUpdates;
    var id = "tabview-tab";
    var data;
    if (update.newGroupID) {
      // We are here only when the restored session did not have tabview data
      // we creat new group and fill all the data
      data = setData(update.newGroupID);
    }
    else {
      data = this.getLiteralValue(tabData.node, id);
      // make sure data is not "null"
      if (!data || data == "null") {
        if (update.lastActiveGroupId)
          data = setData(update.lastActiveGroupId);
        else {
          // force Panorama to reconnect all reused tabs
          if (tabData.tab._tabViewTabItem) {
            // remove any old data
            tabData.tab._tabViewTabItem._reconnected = false;
            try {
              TabmixSvc.ss.deleteTabValue(tabData.tab, id);
            } catch (ex) { }
            if (!Tabmix.isVersion(80))
              tabData.tab._tabViewTabItem.__tabmix_reconnected = false;
          }
          return;
        }
      }

      if (update.IDs) {
        parsedData = Tabmix.JSON.parse(data);
        if (parsedData.groupID in update.IDs) {
          parsedData.groupID = update.IDs[parsedData.groupID];
          data = Tabmix.JSON.stringify(parsedData);
        }
      }
    }

    // force Panorama to reconnect all reused tabs
    // in Firefox 8.0 + we do it from _patchTabviewFrame
    if (!Tabmix.isVersion(80)) {
      let tabItem = tabData.tab._tabViewTabItem;
      if (tabItem) {
        let tabData = parsedData || Tabmix.JSON.parse(data);
        let groupId = tabItem.parent ? tabItem.parent.id : null;
        if (!tabData || tabData.groupID != groupId)
          tabItem._reconnected = false;
          tabItem.__tabmix_reconnected = false;
      }
    }

    // save data
    TabmixSvc.ss.setTabValue(tabData.tab, id, data);
    if (this.enableBackup)
      this.setLiteral(this.getNodeForTab(tabData.tab), id, data);
  },

  _updateLastSessionGroupName: function SM__updateLastSessionGroupName() {
    if (!Tabmix.isVersion(70) || Tabmix.isVersion(100))
      return;

    // keep current name
    if (this.groupUpdates.hideSessionActiveGroup && TabView._lastSessionGroupName != null)
      return;

    // when we don't show last group name on startup set empty string
    if (this.groupUpdates.hideSessionActiveGroup)
      this._lastSessionGroupName = "";

    let title = TabView._lastSessionGroupName = this._lastSessionGroupName;
    gBrowser.updateTitlebar();

    let id = "tabview-last-session-group-name";
    TabmixSvc.ss.setWindowValue(window, id, title);
    if (this.enableBackup)
      this.setLiteral(this.gThisWin, id, title);
  },

  isEmptyObject: function SM_isEmptyObject(obj) {
    for (let name in obj)
      return false;
    return true;
  },

  // return true if there are no visible tabs that are not in the exclude array
  _noNormalTabs: function SM__noNormalTabs(excludeTabs) {
    if (!excludeTabs)
      excludeTabs = [];

    return !Array.some(gBrowser.tabs, function(tab){
      if (!tab.pinned && !tab.hidden && !tab.closing && excludeTabs.indexOf(tab) == -1) {
        return true;
      }
      return false;
    });
  },

  _addGroupItem: function SM__addGroupItem(aGroupItems, aGroupsData, setAsActive) {
    let groupID = aGroupsData.nextID++;
    if (setAsActive) {
      aGroupsData.activeGroupId = groupID;
      this._lastSessionGroupName = "";
    }
    let bounds = {left:0, top:0, width:350, height:300};
    aGroupItems[groupID] = {bounds:bounds, userSize:null, title:"", id:groupID, newItem: true};
    aGroupsData.totalNumber = Object.keys(aGroupItems).length;
    this._tabviewData["tabview-group"] = aGroupItems;
    this._tabviewData["tabview-groups"] = aGroupsData;
  },

   // Remove current active group only when it's empty and have no title
  _deleteActiveGroup: function SM__deleteActiveGroup(aGroupItems, activeGroupId) {
    let activeGroup = aGroupItems[activeGroupId];
    if (activeGroup && activeGroup.title == "") {
      delete aGroupItems[activeGroupId];
      this._tabviewData["tabview-group"] = aGroupItems;
    }
  },

  // just in case.... and add totalNumber to firefox 4.0 - 5.0.x
  _validateGroupsData: function SM__validateGroupsData(aGroupItems, aGroupsData) {
    if (this.isEmptyObject(aGroupItems))
      return;

    if (aGroupsData.nextID && aGroupsData.activeGroupId && aGroupsData.totalNumber)
      return;
    let keys = Object.keys(aGroupItems);
    if (!aGroupsData.nextID) {
      let nextID = 0;
      keys.forEach(function (key) {
        nextID = Math.max(aGroupItems[key].id, nextID);
      })
      aGroupsData.nextID = nextID++;
    }
    if (!aGroupsData.activeGroupId)
      aGroupsData.activeGroupId = aGroupItems[keys[0]].id;
    if (!aGroupsData.totalNumber)
      aGroupsData.totalNumber = keys.length;
  },

 /**
  * when we append tab to this window we merge group data from the session into the curent group data
  * loadOnStartup: array of tabs that load on startup from application
  * blankTabs: remaining blank tabs in this windows
  */
  _preperTabviewData: function SM__preperTabviewData(loadOnStartup, blankTabs) {
    let newGroupItems = this._tabviewData["tabview-group"];
    let groupItems = TabmixSessionData.getWindowValue(window, "tabview-group", true);
    let newGroupItemsIsEmpty = this.isEmptyObject(newGroupItems);
    let groupItemsIsEmpty = this.isEmptyObject(groupItems);

    if (newGroupItemsIsEmpty && groupItemsIsEmpty) {
      // just to be on the safe side
      // Tabview will force to add all tabs in one group
      this._tabviewData["tabview-group"] = {};
      this._tabviewData["tabview-groups"] = {};
      return;
    }

    var noNormalVisibleTabs = this._noNormalTabs(blankTabs.concat(loadOnStartup));
    if (!noNormalVisibleTabs)
      this.groupUpdates.hideSessionActiveGroup = true;

    // newGroupItems is not empty
    if (groupItemsIsEmpty) {
      // we can get here also on startup before we set any data to current window

      if (noNormalVisibleTabs)
        // nothing else to do we use this._tabviewData as is.
        this._updateUIpageBounds = true;
      else {
        // Tabview did not started
        // add all normal tabs to new group with the proper id
        let newGroupsData = this._tabviewData["tabview-groups"];
        this._addGroupItem(newGroupItems, newGroupsData, true);

        // update tabs data
        let groupID = newGroupsData.activeGroupId;
        Array.forEach(gBrowser.tabs, function(tab){
          if (tab.pinned || tab.hidden || tab.closing || blankTabs.indexOf(tab) > -1)
            return;
          let data = { groupID: groupID };
          if (!Tabmix.isVersion(140)) {
            data.url = tab.linkedBrowser.currentURI.spec;
            data.title = tab.label;
          }
          data = Tabmix.JSON.stringify(data);
          TabmixSvc.ss.setTabValue(tab, "tabview-tab", data);
          if (this.enableBackup)
            this.setLiteral(this.getNodeForTab(tab), "tabview-tab", data);
        }, TabmixSessionManager);
      }
      return;
    }

    // groupItems is not empty
    let groupsData = TabmixSessionData.getWindowValue(window, "tabview-groups", true);
    // just in case data was corrupted
    this._validateGroupsData(groupItems, groupsData);

    if (newGroupItemsIsEmpty) {
      let createNewGroup = true;
      if (noNormalVisibleTabs) {
        // if active group is empty without title reuse it for
        // the tabs from the session.
        let activeGroup = groupItems[groupsData.activeGroupId];
        if (activeGroup && activeGroup.title == "") {
          createNewGroup = false;
          this.groupUpdates.newGroupID = groupsData.activeGroupId;
          this._tabviewData["tabview-group"] = groupItems;
          this._tabviewData["tabview-groups"] = groupsData;
        }
      }

      if (createNewGroup) {
        // We create new group here, and set it as active if there is no normal
        // tabs in this window, later we will create "tabview-tab" data in
        // SM__setTabviewTab for each normal tab.
        this.groupUpdates.newGroupID = groupsData.nextID;
        this._addGroupItem(groupItems, groupsData, noNormalVisibleTabs);
      }

      this._tabviewData["tabview-ui"] = TabmixSessionData.getWindowValue(window, "tabview-ui");
      return;
    }

    // both current window and the session that we are restoring have group data

    let IDs = {};
    for (let id in newGroupItems) {
      newGroupItems[id].newItem = true;
      // change group id if already used in this window
      if (id in groupItems) {
        let newID = groupsData.nextID++;
        groupItems[newID] = newGroupItems[id];
        groupItems[newID].id = newID;
        // we will update tabview-tab data later
        IDs[id] = newID;
      }
      else {
        groupItems[id] = newGroupItems[id];
        if (id > groupsData.nextID)
          groupsData.nextID = id;
      }
    }

    // When current active group is empty,
    // change active group to the active group from the session we are restoring.
    if (noNormalVisibleTabs) {
      this._deleteActiveGroup(groupItems, groupsData.activeGroupId);
      // set new activeGroupId
      let activeID = this._tabviewData["tabview-groups"].activeGroupId;
      groupsData.activeGroupId = activeID in IDs ? IDs[activeID] : activeID;
      this._updateUIpageBounds = true;
    }

    if (Object.keys(IDs).length > 0) {
      let id = this.groupUpdates.lastActiveGroupId;
      this.groupUpdates.lastActiveGroupId = IDs[id] || id;
      this.groupUpdates.IDs = IDs;
    }

    // update totalNumber
    groupsData.totalNumber = Object.keys(groupItems).length;
    // save data
    this._tabviewData["tabview-group"] = groupItems;
    this._tabviewData["tabview-groups"] = groupsData;
  },

  showNotification: function SM_showNotification() {
///XXX NEED to update babelzilla
    var msg = "More tabs restored into hidden groups.";
    try {
      let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
      alerts.showAlertNotification("chrome://tabmixplus/skin/tmp.png", "Tab Mix Plus", msg, false, "", null);
    } catch (e) { }
  },

  /* ............... TabView Code Fix  ............... */

  // update page bounds when we overwrite tabs
  _setUIpageBounds: function SM__setUIpageBounds() {
    if (TabView._window) {
      let data = TabView._window.Storage.readUIData(window);
      if (this.isEmptyObject(data))
        return;

      TabView._window.UI._storageSanity(data);
      if (data && data.pageBounds)
        TabView._window.UI._pageBounds = data.pageBounds;
    }
  },

  // when not overwriting tabs try to rearrange the groupItems
  _groupItemPushAway: function SM__groupItemPushAway() {
    if (!this._groupItems)
      return;

    let GroupItems = TabView._window.GroupItems;
    for each(let data in this._groupItems) {
      if (data.newItem) {
        if (GroupItems.groupItemStorageSanity(data)) {
          GroupItems.groupItem(data.id).pushAway(true);
        }
      }
    }
    this._groupItems = null;
  }
};

/**
 * add backward compatibility getters to some of the main object/function/variable
 * that we chaged from version 0.3.8.5pre.110123a
 * we only add this getters to objects the arn't in the name space
 */
Tabmix.backwardCompatibilityGetter(window, "SessionData", "TabmixSessionData");
Tabmix.backwardCompatibilityGetter(window, "SessionManager", "TabmixSessionManager");
Tabmix.backwardCompatibilityGetter(window, "TabDNDObserver", "TMP_tabDNDObserver");
Tabmix.backwardCompatibilityGetter(window, "gSingleWindowMode", "Tabmix.singleWindowMode");
Tabmix.backwardCompatibilityGetter(window, "TM_init", "Tabmix.startup");
Tabmix.backwardCompatibilityGetter(window, "tabscroll", "TabmixTabbar.scrollButtonsMode");
