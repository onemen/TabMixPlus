/* exported TMP_ClosedTabs */
"use strict";

/*
 * chrome://tabmixplus/content/session/sessionStore.js
 *
 * original code by onemen
 *
 */
var TMP_SessionStore = {
  // get title for closed window from bookmark title or user tab title
  // this funcion return promise to work with Firefox 60 async bookmarks.fetch
  asyncGetTabTitleForClosedWindow(aUndoItem) {
    // if user already rename this item wo don't use other title
    if (aUndoItem.renamed)
      return Promise.resolve(aUndoItem.title);
    let selectedTab = aUndoItem.selected && aUndoItem.tabs[aUndoItem.selected - 1];
    if (!selectedTab || !selectedTab.entries || selectedTab.entries.length === 0)
      return Promise.resolve(aUndoItem.title);
    let tabData = this.getActiveEntryData(selectedTab);
    let url = selectedTab.attributes["label-uri"];
    if (url == tabData.url || url == "*")
      aUndoItem.title = selectedTab.attributes["fixed-label"];
    else {
      const dataTitle = aUndoItem.title || tabData.title || tabData.url;
      return TMP_Places.asyncGetTitleFromBookmark(tabData.url, dataTitle)
          .then(title => {
            if (title == TabmixSvc.aboutBlank) {
              title = Tabmix.getString("tabs.emptyTabTitle");
            }
            return title;
          });
    }
    return Promise.resolve(aUndoItem.title);
  },

  // get nsSessionStore active entry data.
  getActiveEntryData: function TMP_ss_getActiveEntryData(aData) {
    let activeIndex = (aData.index || aData.entries.length) - 1;
    if (activeIndex >= aData.entries.length)
      activeIndex = aData.entries.length - 1;
    return aData.entries[activeIndex] || {};
  },

  getTitleFromTabState(aTab) {
    let tabData = TabmixSvc.JSON.parse(TabmixSvc.ss.getTabState(aTab));
    let data = this.getActiveEntryData(tabData);
    if (data.url == TabmixSvc.aboutBlank) {
      return Tabmix.getString("tabs.emptyTabTitle");
    }
    return data.title || null;
  },

  // check if pending tab has no history or is about:blank
  isBlankPendingTab(aTab) {
    if (!aTab.hasAttribute("pending"))
      return false;
    let tabData = TabmixSvc.JSON.parse(TabmixSvc.ss.getTabState(aTab));
    let entries = tabData && tabData.entries;
    if (entries && entries.length > 1)
      return false;
    return !entries[0] || entries[0].url == "about:blank";
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

      _xulAttributes.forEach(aAttr => {
        TabmixSvc.ss.persistTabAttribute(aAttr);
      });

      TabmixSvc.sm.persistTabAttributeSet = true;
    } catch (ex) {
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
      // update session manager settings according to current tabmix settings
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
            // default: nothing to do
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
    } else if (this.isSessionStoreEnabled()) {
      // ask the user to choose between TMP session manager and sessionstore
      // we use non modal promptService on start up, so we disabled Tabmix session manager to let the startup
      // process continue and set the appropriate preference after the dialog prompt dismissed.
      if (start) {
        Services.prefs.setBoolPref(TMP_SS_MANAGER, false);
        Services.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, false);
      }
      let title = "TabMix " + TabmixSvc.getSMString("sm.title");
      let msg = start ? TabmixSvc.getSMString("sm.disable.msg") + "\n\n" : "";
      msg += TabmixSvc.getSMString("sm.disable.msg" + msgNo);
      let buttons = TabmixSvc.getDialogStrings("Yes", "No").join("\n");
      let self = this;
      let callBack = function(aResult) {
        if ((msgNo == 1 && aResult.button == 1) || ((msgNo == 2 && aResult.button === 0))) {
          self.setSessionRestore(false);
          Services.prefs.setBoolPref(TMP_SS_MANAGER, TMP_manager_enabled);
          Services.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, TMP_crashRecovery_enabled);
        } else {
          // we don't change any of sessionstore default setting
          // the user will be ask on exit what to do.
          // browser.warnOnQuit default value is true
          Services.prefs.setBoolPref(TMP_SS_MANAGER, false);
          Services.prefs.setBoolPref(TMP_SS_CRASHRECOVERY, false);
        }
        TabmixSvc.sm.settingPreference = false;
      };
      let result = Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.HIDE_MENUANDTEXT, Tabmix.HIDE_CHECKBOX],
        [title, msg, "", "", buttons], window, start ? callBack : null);
      if (!start)
        callBack(result);
    } else if (!Services.prefs.prefHasUserValue("browser.warnOnQuit ")) {
      // browser.warnOnQuit default value is true
      Services.prefs.setBoolPref("browser.warnOnQuit", false);
      TabmixSvc.sm.settingPreference = false;
    }
  },

  isSessionStoreEnabled() {
    return Services.prefs.getIntPref("browser.startup.page") == 3 ||
      Services.prefs.getBoolPref("browser.sessionstore.resume_from_crash");
  },

  afterSwitchThemes: false,
  // we call this only one time on window load
  // and store the value in Tabmix.isWindowAfterSessionRestore
  // we call this from onContentLoaded before nsSessionStore run its onLoad
  setAfterSessionRestored() {
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
    } else if (this.afterSwitchThemes) {
      afterSessionRestore = true;
    }

    if (typeof afterSessionRestore == "boolean")
      Tabmix.isWindowAfterSessionRestore = afterSessionRestore;
    else {
      // calling doRestore before sessionstartup finished to read
      // sessionStore.js file throw error since Firefox 28, and force
      // syncRead in Firefox 25-27
      XPCOMUtils.defineLazyGetter(Tabmix, "isWindowAfterSessionRestore", () => {
        let ss = Cc["@mozilla.org/browser/sessionstartup;1"]
            .getService(Ci.nsISessionStartup);
        // when TMP session manager is enabled ss.doRestore is true only after restart
        ss.onceInitialized.then(() => {
          Tabmix.isWindowAfterSessionRestore = ss.doRestore();
        }).catch(Tabmix.reportError);
        // until sessionstartup initialized just return the pref value,
        // we only use isWindowAfterSessionRestore when our Session Manager enable
        return Services.prefs.getBoolPref("browser.sessionstore.resume_session_once");
      });
    }
  },

  setSessionRestore(aEnable) {
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
  asyncGetTabTitle(aData, aUri, aTitle) {
    var fixedLabelUri = this._getAttribute(aData, "label-uri");
    if (fixedLabelUri == aUri || fixedLabelUri == "*")
      return Promise.resolve(this._getAttribute(aData, "fixed-label"));

    const itemId = this._getAttribute(aData, "tabmix_bookmarkId");
    return TMP_Places.asyncGetTitleFromBookmark(aUri, aTitle, itemId);
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
      for (var i = 0; i < xultab.length; i++) {
        if (/^([^\s=]+)=(.*)/.test(xultab[i]) && RegExp.$1 == attrib)
          return decodeURI(RegExp.$2);
      }
    }
    return "";
  }

};

var TMP_ClosedTabs = {
  _buttonBroadcaster: null,
  get buttonBroadcaster() {
    if (!this._buttonBroadcaster)
      this._buttonBroadcaster = document.getElementById("tmp_undocloseButton");
    return this._buttonBroadcaster;
  },

  // make btn_undoclose single-functionality or dual-functionality
  setButtonType(menuOnly) {
    var buttonType = menuOnly ? "menu" : "menu-button";
    if (this.buttonBroadcaster.getAttribute("type") != buttonType)
      this.buttonBroadcaster.setAttribute("type", buttonType);
  },

  setButtonDisableState: function ct_setButtonDisableState(aState) {
    if (typeof (aState) == "undefined")
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
    return TMP_SessionStore.asyncGetTabTitle(aTabData.state, aUri, aTabData.title);
  },

  /* .......... functions for closedtabs list menu and context menu .......... */

  get keepMenuOpen() {
    return Tabmix.prefs.getBoolPref("undoClose.keepMenuOpen");
  },

  set keepMenuOpen(val) {
    Tabmix.prefs.setBoolPref("undoClose.keepMenuOpen", Boolean(val));
    return val;
  },

  populateUndoSubmenu: function ct_populateUndoSubmenu(aPopup, keepWidth) {
    if (TabmixAllTabs.isAfterCtrlClick(aPopup.parentNode))
      return false;

    if (keepWidth && !aPopup.hasAttribute("width")) {
      const width = Tabmix.getBoundsWithoutFlushing(aPopup).width;
      aPopup.setAttribute("width", width);
    }

    TabmixAllTabs.beforeCommonList(aPopup, true);

    let dwu, DIRECTION_RTL;
    if (Tabmix.isVersion(600)) {
      dwu = window.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindowUtils);
      DIRECTION_RTL = Ci.nsIDOMWindowUtils.DIRECTION_RTL;
    }

    // populate menu
    var closedTabs = this.getClosedTabData;
    const ltr = Tabmix.ltr;
    // Grab the title and uri (make the uri friendly text)
    const asyncUpdateItemLabel = (m, i) => {
      var tabData = closedTabs[i];
      var url = this.getUrl(tabData);
      this.getTitle(tabData, url).then(title => {
        var _uri = makeURI(url);
        if (_uri.scheme == "about" && title === "")
          url = title = "about:blank";
        else {
          try {
            const pathProp = TabmixSvc.version(570) ? "pathQueryRef" : "path";
            url = _uri.scheme == "about" ? _uri.spec :
              _uri.scheme + "://" + _uri.hostPort + _uri[pathProp];
          } catch (e) {
            url = title;
          }
        }
        var label = title ? title : url;
        let labelWithCount = label;
        if (ltr) {
          if (i + 1 < 10)
            m.setAttribute("accesskey", i + 1);
          else if (i + 1 == 10)
            m.setAttribute("accesskey", 0);
          if (dwu && dwu.getDirectionFromText(label) == DIRECTION_RTL) {
            const count = " :" + (i + 1) + (i < 9 ? "  " : "");
            labelWithCount = label + count;
          } else {
            const count = (i < 9 ? "  " : "") + (i + 1) + ": ";
            labelWithCount = count + label;
          }
        }
        m.setAttribute("label", labelWithCount);
        m.setAttribute("tooltiptext", label + "\n" + url);
        m.setAttribute("statustext", url);

        var iconURL = tabData.image;
        if (iconURL) {
          if (/^https?:/.test(iconURL))
            iconURL = "moz-anno:favicon:" + iconURL;
          m.setAttribute("image", iconURL);
        }
      });
    };

    for (let i = 0; i < closedTabs.length; i++) {
      const m = document.createElement("menuitem");
      asyncUpdateItemLabel(m, i);
      m.setAttribute("class", "menuitem-iconic bookmark-item menuitem-with-favicon");
      m.setAttribute("value", i);
      m.setAttribute("closemenu", this.keepMenuOpen ? "none" : "auto");
      m.addEventListener("command", this);
      m.addEventListener("click", this);
      if (i === 0)
        m.setAttribute("key", "key_undoCloseTab");
      aPopup.appendChild(m);
    }

    aPopup.appendChild(document.createElement("menuseparator"));

    const addMenu = this.addMenuItem.bind(this, aPopup);
    // "Keep menu open"
    const mi = addMenu("lockedClosedTabsList", TabmixSvc.getString("undoclosetab.keepOpen.label"), -3);
    mi.setAttribute("description", TabmixSvc.getString("undoclosetab.keepOpen.description"));
    mi.setAttribute("closemenu", "none");
    const image = this.keepMenuOpen ? "chrome://tabmixplus/skin/pin.png" : "";
    mi.setAttribute("image", image);
    // "Clear Closed Tabs List"
    addMenu("clearClosedTabsList", TabmixSvc.getString("undoclosetab.clear.label"), -1, "clearClosedTabs");
    // "Restore All Tabs"
    addMenu("restoreAllClosedTabs", gNavigatorBundle.getString("menuRestoreAllTabs.label"), -2, "ucatab");

    return true;
  },

  addMenuItem(popup, id, label, val, keyId) {
    const m = popup.appendChild(document.createElement("menuitem"));
    m.setAttribute("id", id);
    m.setAttribute("label", label);
    m.setAttribute("value", val);
    m.setAttribute("class", "menuitem-iconic");
    if (keyId && document.getElementById("key_tm_" + keyId)) {
      m.setAttribute("key", "key_tm_" + keyId);
    }
    m.addEventListener("command", this);
    return m;
  },

  handleEvent(event) {
    switch (event.type) {
      case "click":
        this.checkForMiddleClick(event);
        break;
      case "command":
        this.restoreCommand(event);
        break;
    }
  },

  restoreCommand(aEvent) {
    const item = aEvent.originalTarget;
    const index = Number(item.getAttribute("value"));
    if (index == -3) {
      this.keepMenuOpen = !this.keepMenuOpen;
      const image = this.keepMenuOpen ? "chrome://tabmixplus/skin/pin.png" : "";
      item.setAttribute("image", image);
      this.populateUndoSubmenu(item.parentNode, true);
      return;
    }

    this.doCommand("restoreTab", "original", item);
  },

  checkForMiddleClick: function ct_checkForMiddleClick(aEvent) {
    if (aEvent.button != 1)
      return;

    const deleteItem = Tabmix.prefs.getBoolPref("middleclickDelete");
    const where = deleteItem ? "delete" : "tab";
    this.doCommand("restoreTab", where, aEvent.originalTarget, deleteItem);
  },

  contextMenuOnPopupShowing(popup) {
    const val = this.keepMenuOpen ? "single" : "auto";
    Array.prototype.forEach.call(popup.childNodes, item => {
      item.setAttribute("closemenu", val);
    });
    return popup.triggerNode.value >= 0;
  },

  contextMenuOnCommand(event) {
    const menuItem = event.originalTarget;
    const [command, where] = menuItem.getAttribute("commandData").split(",");
    const popup = menuItem.parentNode;
    this.doCommand(command, where, popup.triggerNode);
  },

  doCommand(command, where, item, keepMenuOpen) {
    const popup = item.parentNode;
    const index = Number(item.getAttribute("value"));
    this[command](where || index, index);
    const rePopulate = (keepMenuOpen || this.keepMenuOpen) && this.count > 0;
    if (rePopulate) {
      if (popup && command == "restoreTab") {
        this.populateUndoSubmenu(popup, true);
      }
    } else if (!this.count || item.getAttribute("closemenu") == "none") {
      closeMenus(popup);
    }
  },

  addBookmarks: function ct_addBookmarks(index) {
    var tabData = this.getClosedTabData[index];
    var url = this.getUrl(tabData);
    this.getTitle(tabData, url).then(title => {
      PlacesCommandHook.bookmarkLink(PlacesUtils.bookmarksMenuFolderId, url, title);
    });
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
        } else if (aIndex == -2) {
          this.SSS_restoreAllClosedTabs();
          break;
        }
        // else do the default
        /* falls through */
      default:
        this.SSS_undoCloseTab(aIndex, aWhere, true);
    }
  },

  removeAllClosedTabs() {
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
    if (aIndex < 0 || aIndex >= this.count)
      return null;
    // update our session data
    if (TabmixSessionManager.enableBackup)
      TabmixSessionManager.deleteClosedtabAt(this.count - aIndex);

    let closedTab;
    if (Tabmix.isVersion(400)) {
      const closedTabs = TabmixSvc.SessionStore._windows[window.__SSi]._closedTabs;
      closedTab = TabmixSvc.SessionStore.removeClosedTabData(closedTabs, aIndex);
    } else {
      closedTab = this.getClosedTabData.splice(aIndex, 1).shift();
      TabmixSvc.ss.forgetClosedTab(window, aIndex);
    }
    this.setButtonDisableState();
    return closedTab;
  },

  SSS_restoreToNewWindow: function ct_restoreToNewWindow(aIndex) {
    var tabData = this.getClosedTabAtIndex(aIndex);
    // we pass the current tab as a place holder for tabData
    var state = TabmixSvc.JSON.stringify(tabData ? tabData.state : {});
    return gBrowser.duplicateTabToWindow(gBrowser.mCurrentTab, null, state);
  },

  SSS_restoreAllClosedTabs: function ct_SSS_restoreAllClosedTabs() {
    var closedTabCount = this.count;
    let confirmOpenInTabs = Tabmix.isVersion(510) ? "confirmOpenInTabs" : "_confirmOpenInTabs";
    const isConfirmed = Tabmix.isVersion(600) ?
      OpenInTabsUtils.confirmOpenInTabs(closedTabCount) :
      PlacesUIUtils[confirmOpenInTabs](closedTabCount);
    if (!isConfirmed) {
      return;
    }

    this.setButtonDisableState(true);

    // catch blank tabs
    var blankTabs = [];
    for (let i = 0; i < gBrowser.tabs.length; i++) {
      if (gBrowser.isBlankNotBusyTab(gBrowser.tabs[i]))
        blankTabs.push(gBrowser.tabs[i]);
    }

    var multiple = closedTabCount > 1;
    for (let i = 0; i < closedTabCount; i++) {
      let blankTab = blankTabs.pop() || null;
      this.SSS_undoCloseTab(0, "original", i === 0, blankTab, multiple);
    }

    // remove unused blank tabs
    while (blankTabs.length > 0) {
      let blankTab = blankTabs.pop();
      blankTab.collapsed = true;
      gBrowser.removeTab(blankTab);
    }
  },

  SSS_undoCloseTab(aIndex, aWhere, aSelectRestoredTab, aBlankTabToReuse, skipAnimation) {
    if (!Tabmix.prefs.getBoolPref("undoClose") || this.count === 0)
      return null;

    // get tab data
    let {state, pos} = this.getClosedTabAtIndex(aIndex);

    var tabToRemove = null;
    var cTab = gBrowser.mCurrentTab;
    var isCurrentBlank = gBrowser.isBlankNotBusyTab(cTab);
    if (aWhere == "current" && !isCurrentBlank) {
      tabToRemove = cTab;
      pos = cTab._tPos;
    } else if (typeof aBlankTabToReuse == "undefined" && isCurrentBlank) {
      aBlankTabToReuse = cTab;
    }

    if (TMP_TabView.exist("prepareUndoCloseTab")) {
      TabView.prepareUndoCloseTab(tabToRemove);
    }

    if (tabToRemove) {
      tabToRemove.collapsed = true;
    }

    let createLazyBrowser = Tabmix.isVersion(540) &&
      Services.prefs.getBoolPref("browser.sessionstore.restore_tabs_lazily") &&
      Services.prefs.getBoolPref("browser.sessionstore.restore_on_demand") &&
      !aSelectRestoredTab && !state.pinned;

    let userContextId = state.userContextId;
    let reuseExisting = !createLazyBrowser && aBlankTabToReuse &&
        (!Tabmix.isVersion(490) ||
        aBlankTabToReuse.getAttribute("usercontextid") == (userContextId || ""));

    let newTab = reuseExisting ? aBlankTabToReuse :
      gBrowser.addTab(null, Object.assign({
        skipAnimation: tabToRemove || skipAnimation,
        dontMove: true,
        createLazyBrowser,
      }, state));
    if (!reuseExisting && aBlankTabToReuse) {
      gBrowser.removeTab(aBlankTabToReuse, {animate: false});
    }

    if (!createLazyBrowser) {
      newTab.linkedBrowser.stop();
    }
    // if tabbar is hidden when there is only one tab and
    // we replace that tab with new one close the current tab fast so the tab bar don't have time to reveals
    if (tabToRemove) {
      gBrowser.removeTab(tabToRemove, {animate: false});
    }

    // restore tab content
    if (Tabmix.isVersion(400)) {
      TabmixSvc.SessionStore.restoreTab(newTab, state);
    } else {
      TabmixSvc.ss.setTabState(newTab, TabmixSvc.JSON.stringify(state));
    }

    if (TMP_TabView.exist("afterUndoCloseTab")) {
      TabView.afterUndoCloseTab();
    }

    // after we open new tab we only need to fix position if this is true
    // we don't call moveTabTo from add tab if it called from sss_undoCloseTab
    var restorePosition = Tabmix.prefs.getBoolPref("undoClosePosition");
    if (aWhere == "current" || (aWhere == "original" && restorePosition)) {
      gBrowser.moveTabTo(newTab, Math.min(gBrowser.tabs.length - 1, pos));
    } else if (aWhere != "end" && Tabmix.getOpenTabNextPref()) {
      let tab;
      if (Tabmix.isVersion({ff: 570, wf: "56.2.8"})) {
        tab = gBrowser._lastRelatedTabMap.get(gBrowser.selectedTab) || gBrowser.selectedTab;
      } else {
        tab = gBrowser._lastRelatedTab || gBrowser.selectedTab;
      }
      let offset = newTab._tPos > tab._tPos ? 1 : 0;
      gBrowser.moveTabTo(newTab, tab._tPos + offset);
    } else if (aBlankTabToReuse && !Tabmix.getOpenTabNextPref()) {
      // move reused tab to the end
      gBrowser.moveTabTo(newTab, gBrowser.tabs.length - 1);
    }

    if (aSelectRestoredTab) {
      window.focus();
      gBrowser.TMP_selectNewForegroundTab(newTab, false, null, false);
    }
    return newTab;
  },

  undoCloseTab: function ct_undoCloseTab(aIndex, aWhere) {
    return this.SSS_undoCloseTab(aIndex || 0, aWhere || "original", true);
  }

};

var TabmixConvertSession = {
  get getTitle() {
    return TabmixSvc.getString("incompatible.title") + " - " + TabmixSvc.getSMString("sm.title");
  },

  getString: function cs_getString(aEntity) {
    return TabmixSvc.getSMString("sm.extension.convert." + aEntity);
  },

  startup: function cs_startup() {
    if (!Tabmix.firstWindowInSession)
      return;

    if (!Tabmix.extensions.sessionManager || Tabmix._afterTabduplicated || !Tabmix.isFirstWindow) {
      return;
    }

    var sessions = TabmixSessionManager.getSessionList();
    if (!sessions)
      return;

    if (TabmixSessionManager.nodeHasArc("rdf:gSessionManager", "status"))
      return;

    TabmixSessionManager.setLiteral("rdf:gSessionManager", "status", "converted");
    TabmixSessionManager.saveStateDelayed();
    var callBack = function(aResult) {
      if (aResult.button == Tabmix.BUTTON_OK) {
        setTimeout((a, b) => {
          TabmixConvertSession.convertFile(a, b);
        }, 50, null, true);
      }
    };
    this.confirm(this.getString("msg1") + "\n\n" + this.getString("msg2"), callBack);
  },

  selectFile: function cs_selectFile(aWindow) {
    const nsIFilePicker = Ci.nsIFilePicker;
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    var fpCallback = aResult => {
      if (aResult == nsIFilePicker.returnOK)
        this.convertFile(fp.fileURL.spec);
    };

    fp.init(aWindow, this.getString("selectfile"), nsIFilePicker.modeOpen);
    fp.defaultString = "session.rdf";
    fp.appendFilter(this.getString("rdffiles"), "*.rdf");
    fp.appendFilter(this.getString("sessionfiles"), "*session*.*");
    fp.appendFilters(nsIFilePicker.filterText | nsIFilePicker.filterAll);
    fp.open(fpCallback);
  },

  convertFile: function cs_convertFile(aFileUri, aSilent) {
    if (TabmixSvc.sessionManagerAddonInstalled) {
      let tmp = {};
      Cu.import("chrome://sessionmanager/content/modules/session_convert.jsm", tmp);
      tmp.SessionConverter.convertTMP(aFileUri, aSilent);
    } else if ("com" in window && window.com.morac) {
      let sm = window.com.morac.SessionManagerAddon.gSessionManagerWindowObject;
      sm.doTMPConvertFile(aFileUri, aSilent);
    }
  },

  confirm: function cs_confirm(aMsg, aCallBack) {
    let buttons = TabmixSvc.getDialogStrings("Yes", "No").join("\n");
    return Tabmix.promptService([Tabmix.BUTTON_OK, Tabmix.HIDE_MENUANDTEXT, Tabmix.HIDE_CHECKBOX],
      [this.getTitle, aMsg, "", "", buttons], window, aCallBack);
  },

  getSessionState: function cs_getSessionState(aPath, internal) {
    var _windows = [], tabsCount = 0;
    var sessionEnum = TabmixSessionManager.initContainer(aPath).GetElements();
    let index = 0;
    while (sessionEnum.hasMoreElements()) {
      let rdfNodeWindow = sessionEnum.getNext();
      if (rdfNodeWindow instanceof Ci.nsIRDFResource) {
        let windowPath = rdfNodeWindow.QueryInterface(Ci.nsIRDFResource).Value;
        let getState = !TabmixSessionManager.nodeHasArc(windowPath, "dontLoad");
        let aWindowState = getState && this.getWindowState(rdfNodeWindow, internal);
        if (aWindowState) {// don't save empty windows
          aWindowState.index = TabmixSessionManager.getLiteralValue(rdfNodeWindow, "SSi", index++);
          _windows.push(aWindowState);
          tabsCount += aWindowState.tabs.length;
        }
      }
    }
    let selected = _windows[_windows.length - 1];
    _windows.sort((a, b) => a.index > b.index);
    return {
      windows: _windows,
      selectedWindow: _windows.indexOf(selected) + 1,
      tabsCount,
    };
  },

  getWindowState: function cs_getWindowState(rdfNodeWindow, internal) {
    var state = {tabs: [], selected: 0, _closedTabs: []};

    var rdfNodeTabs = TabmixSessionManager.getResource(rdfNodeWindow, "tabs");
    if (!(rdfNodeTabs instanceof Ci.nsIRDFResource) || TabmixSessionManager.containerEmpty(rdfNodeTabs)) {
      return null;
    }
    state.tabs = this.getTabsState(rdfNodeTabs, internal);
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
    _tabData.prototype.toString = function() {
      return this.index;
    };

    var tabsEnum = TabmixSessionManager.initContainer(rdfNodeTabs).GetElements();
    while (tabsEnum.hasMoreElements()) {
      let rdfNodeTab = tabsEnum.getNext();
      if (rdfNodeTab instanceof Ci.nsIRDFResource) {
        tabsData.push(new _tabData(rdfNodeTab));
      }
    }
    tabsData.sort((a, b) => {
      return a - b;
    });
    for (let i = 0; i < tabsData.length; i++) {
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
    var tabData = {entries: [], index: 0, zoom: 1, disallow: "", text: ""};
    const entries = this.getHistoryState(rdfNodeTab);
    if (!entries.length) {
      return null;
    }
    tabData.entries = this.addTriggeringPrincipal(entries);
    tabData.image = TabmixSessionManager.getLiteralValue(rdfNodeTab, "image", null);
    let index = TabmixSessionManager.getIntValue(rdfNodeTab, "index");
    tabData.index = Math.max(1, Math.min(index + 1, tabData.entries.length));
    var scroll = TabmixSessionManager.getLiteralValue(rdfNodeTab, "scroll", "0,0");
    if (scroll.startsWith("{")) {
      tabData.scroll = JSON.parse(scroll);
    } else {
      // until version 0.4.1.5 textZoom was included in scroll data
      scroll = scroll.split(",").splice(0, 2).join(",");
      if (scroll != "0,0") {
        tabData.scroll = {scroll};
      }
    }
    tabData.userContextId = TabmixSessionManager.getIntValue(rdfNodeTab, "userContextId", 0);

    var properties = TabmixSessionManager.getLiteralValue(rdfNodeTab, "properties");
    var tabAttribute = ["Images", "Subframes", "MetaRedirects", "Plugins", "Javascript"];

    var booleanAttrLength = TabmixSessionData.tabAttribute.length + TabmixSessionData.docShellItems.length;
    var tabProperties = properties.substr(0, booleanAttrLength);
    var disallow = [];
    for (let j = 0; j < tabAttribute.length; j++) {
      if (tabProperties.charAt(j + 2) != "1")
        disallow.push(tabAttribute[j]);
    }
    tabData.disallow = disallow.join(",");
    tabData.attributes = {};
    if (tabProperties.charAt(0) == "1" && properties.indexOf("protected=") == -1)
      tabData.attributes.protected = "true";
    if (properties.indexOf("_locked=") == -1)
      tabData.attributes._locked = (tabProperties.charAt(1) == "1");

    var extData = {};
    if (properties.length > booleanAttrLength) {
      // TST add data to our properties with "|" separator
      let TSTProps = properties.split('|');
      properties = TSTProps.shift();
      let PREFIX = "tmp-session-data-";
      TSTProps.forEach(aProp => {
        if (/^([^\s=]+)=(.*)/.test(aProp) &&
            RegExp.$1.startsWith(PREFIX) && RegExp.$2)
          extData[RegExp.$1.substr(PREFIX.length)] = decodeURIComponent(RegExp.$2);
      });
      properties = properties.substr(booleanAttrLength + 1).split(" ");
      properties.forEach(aAttr => {
        aAttr = TabmixSessionManager.getDecodedLiteralValue(null, aAttr);
        if (!/^([^\s=]+)=(.*)/.test(aAttr))
          return;
        let isTrue = RegExp.$2 == "true";
        switch (RegExp.$1) {
          case "tabgroups-data": {
            // TGM data
            if (internal) {
              // for Tabmix SessionManager use
              extData.__tabmixTGM = RegExp.$2;
              break;
            }
            let data = RegExp.$2.split(" ");
            extData.TabGroupsManagerGroupId = data[0];
            extData.TabGroupsManagerGroupName = data[1];
            break;
          }
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
            // treestyletab data
            if (RegExp.$1.startsWith("treestyletab-")) {
              extData[RegExp.$1] = RegExp.$2;
            }
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
    // starting with version 0.5.0.3 history data serialized with JSON.stringify
    let isJSONData = TabmixSessionManager.nodeHasArc(rdfNodeTab, "historyData");
    if (isJSONData) {
      const state = TabmixSessionManager.getLiteralValue(rdfNodeTab, "historyData");
      return JSON.parse(decodeURI(state));
    }

    let decodeData = function(data, decode) {
      return decode ? TabmixSessionManager.getDecodedLiteralValue(null, data) : data;
    };
    var history = TabmixSessionManager.getLiteralValue(rdfNodeTab, "history");
    var tmpData = history.split("|-|");
    var sep = tmpData.shift(); // remove separator from data
    tmpData = tmpData.join("|-|");
    // if all history data was encoded (file saved with version
    // 0.4.1.2pre.131006a1 or newer, changeset 684a4b2302e4)
    // decode it now, else decode each entry separately
    let newFormat = tmpData.indexOf(sep) == -1;
    tmpData = decodeData(tmpData, newFormat);
    var historyData = tmpData.split(sep);
    var historyCount = historyData.length / 3;
    var entries = [];
    for (let i = 0; i < historyCount; i++) {
      let entry = {url: "", children: [], ID: 0};
      let index = i * 3;
      entry.url = historyData[index + 1];
      if (entry.url) {
        entry.title = decodeData(historyData[index], !newFormat);
        entry.scroll = historyData[index + 2];
        entries.push(entry);
      }
    }
    return entries;
  },

  // add triggeringPrincipal to history entries that was saved before Firefox 54 (Bug 1307736)
  addTriggeringPrincipal(entries) {
    if (!TabmixSvc.SERIALIZED_SYSTEMPRINCIPAL) {
      return entries;
    }
    return entries.map(entry => {
      if (!entry.triggeringPrincipal_base64) {
        entry.triggeringPrincipal_base64 = TabmixSvc.SERIALIZED_SYSTEMPRINCIPAL;
      }
      return entry;
    });
  },
};
