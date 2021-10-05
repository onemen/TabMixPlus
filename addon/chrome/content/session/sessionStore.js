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
      return TMP_Places.getTitleFromBookmark(tabData.url, dataTitle)
          .then(title => {
            if (Tabmix.isBlankNewTab(title)) {
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
    let data = {};
    data.title = TabmixSvc.ss.getLazyTabValue(aTab, "title");
    if (data.title) {
      data.url = TabmixSvc.ss.getLazyTabValue(aTab, "url");
    } else {
      let tabData = JSON.parse(TabmixSvc.ss.getTabState(aTab));
      data = this.getActiveEntryData(tabData);
    }
    if (Tabmix.isBlankNewTab(data.url)) {
      return Tabmix.getString("tabs.emptyTabTitle");
    }
    return data.title || null;
  },

  getUrlFromTabState(aTab) {
    let data = {};
    data.url = TabmixSvc.ss.getLazyTabValue(aTab, "url");
    if (!data.url) {
      let tabData = JSON.parse(TabmixSvc.ss.getTabState(aTab));
      data = this.getActiveEntryData(tabData);
    }
    return data.url;
  },

  // check if pending tab has no history or is about:blank, about:home, about:newtab
  isBlankPendingTab(aTab) {
    if (!aTab.hasAttribute("pending"))
      return false;
    let entries;
    let url = TabmixSvc.ss.getLazyTabValue(aTab, "url");
    if (url) {
      entries = [{url}];
    } else {
      let tabData = JSON.parse(TabmixSvc.ss.getTabState(aTab));
      entries = tabData && tabData.entries;
    }
    if (entries && entries.length > 1)
      return false;
    return !entries[0] ||
      [TabmixSvc.aboutBlank, TabmixSvc.aboutNewtab, "about:home"].includes(entries[0].url);
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
      var _xulAttributes = ["protected", "_locked", "fixed-label", "label-uri", "reload-data"];

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
   *                -1 when session manager extension enabled (see AddonManager.jsm)
   *
   * @param start   a Boolean value - true if we call this function before startup.
   *
   * @returns       Nothing.
   */
  setService: function TMP_ss_setSessionService(msgNo, start) {
    // ##### disable Session Manager #####
    Services.prefs.lockPref("extensions.tabmix.sessions.manager");
    Services.prefs.lockPref("extensions.tabmix.sessions.crashRecovery");
    if (TabmixSessionManager.disableSessionManager) {
      document.getElementById("tmp_disableSave").setAttribute("disabled", true);
      return;
    }
    TabmixSvc.sm.settingPreference = true;

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
      XPCOMUtils.defineLazyGetter(Tabmix, "isWindowAfterSessionRestore", () => {
        // when TMP session manager is enabled ss.willRestore is true only after restart
        SessionStartup.onceInitialized.then(() => {
          Tabmix.isWindowAfterSessionRestore = SessionStartup.willRestore();
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

    return TMP_Places.asyncGetTitleFromBookmark(aUri, aTitle);
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

  // make tabmix-closedTabs-toolbaritem single-functionality or dual-functionality
  setButtonType(menuOnly) {
    const buttonType = menuOnly ? "menu" : "menu-button";
    if (this.buttonBroadcaster.getAttribute("type") != buttonType) {
      this.buttonBroadcaster.setAttribute("type", buttonType);
    }

    const closedTabsButton = document.getElementById("tabmix-closedTabsButton");
    if (closedTabsButton) {
      const onOverflowMenu = closedTabsButton.parentNode.getAttribute("cui-areatype") === "menu-panel";
      if (buttonType === "menu-button" && !onOverflowMenu) {
        closedTabsButton.setAttribute("tooltiptext", closedTabsButton.parentNode.getAttribute("_tooltiptext"));
      } else {
        closedTabsButton.removeAttribute("tooltiptext");
      }
    }
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
    return window.__SSi ? TabmixSvc.ss.getClosedTabData(window, false) : {};
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

  populateUndoSubmenu(aPopup) {
    const closedTabs = this.getClosedTabData;
    const isSubviewbutton = aPopup.__tagName === "toolbarbutton";
    for (let i = 0; i < aPopup.childNodes.length - 1; i++) {
      let m = aPopup.childNodes[i];
      let tabData = closedTabs[i];
      if (tabData && m.hasAttribute("targetURI")) {
        this.getTitle(tabData, m.getAttribute("targetURI")).then(title => {
          m.setAttribute("label", title);
        });
      }
      m.setAttribute("value", i);
      m.setAttribute("closemenu", this.keepMenuOpen ? "none" : "auto");
      m.removeAttribute("oncommand");
      m.addEventListener("command", this);
      m.addEventListener("click", this);
      m.removeEventListener(
        "click",
        RecentlyClosedTabsAndWindowsMenuUtils._undoCloseMiddleClick
      );
      if (isSubviewbutton) {
        m.value = i;
        m.setAttribute("class", "bookmark-item subviewbutton subviewbutton-iconic");
      }
    }

    // Reopen All Tabs
    let reopenAllTabs = aPopup.lastChild;
    reopenAllTabs.setAttribute("value", -2);
    reopenAllTabs.removeAttribute("oncommand");
    reopenAllTabs.addEventListener("command", this);
    if (isSubviewbutton) {
      reopenAllTabs.classList.add("subviewbutton", "subviewbutton-iconic");
    }

    const addMenu = this.addMenuItem.bind(this, aPopup, isSubviewbutton);
    // "Keep menu open"
    const mi = addMenu("lockedClosedTabsList", TabmixSvc.getString("undoclosetab.keepOpen.label"), -3);
    mi.setAttribute("tooltiptext", TabmixSvc.getString("undoclosetab.keepOpen.description"));
    mi.setAttribute("closemenu", "none");
    const image = this.keepMenuOpen ? "chrome://tabmixplus/skin/pin.png" : "";
    mi.setAttribute("image", image);
    // "Clear Closed Tabs List"
    addMenu("clearClosedTabsList", TabmixSvc.getString("undoclosetab.clear.label"), -1, "clearClosedTabs");

    return true;
  },

  addMenuItem(popup, isSubviewbutton, id, label, val, keyId) {
    const m = document.createXULElement(popup.__tagName || "menuitem");
    m.setAttribute("id", id);
    m.setAttribute("label", label);
    m.setAttribute("value", val);
    if (isSubviewbutton) {
      m.setAttribute("class", "subviewbutton subviewbutton-iconic");
    } else {
      m.setAttribute("class", "menuitem-iconic");
    }
    if (keyId && document.getElementById("key_tm_" + keyId)) {
      m.setAttribute("key", "key_tm_" + keyId);
    }
    m.addEventListener("command", this);
    popup.insertBefore(m, popup.lastChild);
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

  handleButtonEvent(event) {
    const showSubView = event.target.getAttribute("type") === "menu" ||
      event.target.parentNode.getAttribute("cui-areatype") === "menu-panel";
    switch (event.type) {
      case "click":
        if (event.button === 1) {
          this.restoreTab("original", -2);
        } else if (event.button === 0 && showSubView &&
            !TabmixAllTabs.isAfterCtrlClick(event.target)) {
          Tabmix.closedObjectsUtils.showSubView(event);
        }
        break;
      case "command":
        if (event.target.id === "tabmix-closedTabsButton" && !showSubView &&
            !TabmixAllTabs.isAfterCtrlClick(event.target)) {
          TMP_ClosedTabs.undoCloseTab();
        }
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
      this.setPopupWidth(item.parentNode);
      Tabmix.closedObjectsUtils.populateClosedTabsMenu(item.parentNode.parentNode);
      return;
    }

    this.doCommand("restoreTab", "original", item);
  },

  setPopupWidth(popup) {
    if (!popup.hasAttribute("width")) {
      const width = Tabmix.getBoundsWithoutFlushing(popup).width;
      popup.setAttribute("width", width);
    }
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
        this.setPopupWidth(popup);
        Tabmix.closedObjectsUtils.populateClosedTabsMenu(popup.parentNode);
      }
    } else if (popup.parentNode.tagName === "panelview") {
      popup.hidePopup();
    } else if (!this.count || item.getAttribute("closemenu") == "none") {
      closeMenus(popup);
    }
  },

  addBookmarks: function ct_addBookmarks(index) {
    var tabData = this.getClosedTabData[index];
    var url = this.getUrl(tabData);
    this.getTitle(tabData, url).then(title => {
      PlacesCommandHook.bookmarkLink(url, title);
    });
  },

  copyTabUrl: function ct_copyTabUrl(index) {
    var tabData = this.getClosedTabData[index];
    var url = this.getUrl(tabData);
    var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Ci.nsIClipboardHelper);

    clipboard.copyString(url);
  },

  restoreTab: function ct_restoreTab(aWhere, aIndex) {
    switch (aWhere) {
      case "window":
        this.restoreToNewWindow(aIndex);
        break;
      case "delete":
        TabmixSvc.ss.forgetClosedTab(window, aIndex);
        break;
      case "original":
        if (aIndex == -1) {
          this.removeAllClosedTabs();
          break;
        } else if (aIndex == -2) {
          this.restoreAllClosedTabs();
          break;
        }
        // else do the default
        /* falls through */
      default:
        this._undoCloseTab(aIndex, aWhere, true);
    }
  },

  removeAllClosedTabs() {
    while (this.count) {
      TabmixSvc.ss.forgetClosedTab(window, 0);
    }
  },

  /**
   * @brief           fetch the data of closed tab, while removing it from the array
   * @param aIndex    a Integer value - 0 or grater index to remove
   * @returns         closed tab data at aIndex.
   */
  getClosedTabAtIndex: function ct_getClosedTabAtIndex(aIndex) {
    if (aIndex < 0 || aIndex >= this.count)
      return null;

    const winData = TabmixSvc.SessionStore._windows[window.__SSi];
    const closedTabs = winData._closedTabs;
    const closedTab = Tabmix.isVersion(940) ?
      TabmixSvc.SessionStore.removeClosedTabData(winData, closedTabs, aIndex) :
      TabmixSvc.SessionStore.removeClosedTabData(closedTabs, aIndex);
    TabmixSvc.SessionStore._notifyOfClosedObjectsChange();
    return closedTab;
  },

  restoreToNewWindow(aIndex) {
    var tabData = this.getClosedTabAtIndex(aIndex);
    // we pass the current tab as a place holder for tabData
    var state = JSON.stringify(tabData ? tabData.state : {});
    return gBrowser.duplicateTabToWindow(gBrowser._selectedTab, null, state);
  },

  restoreAllClosedTabs() {
    const closedTabCount = this.count;
    const isConfirmed = OpenInTabsUtils.confirmOpenInTabs(closedTabCount);
    if (!isConfirmed) {
      return;
    }

    // catch blank tabs
    const blankTabs = gBrowser.tabs.filter(tab => gBrowser.isBlankNotBusyTab(tab));

    var multiple = closedTabCount > 1;
    for (let i = 0; i < closedTabCount; i++) {
      let blankTab = blankTabs.pop() || null;
      this._undoCloseTab(0, "original", i === 0, blankTab, multiple);
    }

    // remove unused blank tabs
    while (blankTabs.length) {
      let blankTab = blankTabs.pop();
      blankTab.collapsed = true;
      gBrowser.removeTab(blankTab);
    }
  },

  _undoCloseTab(aIndex, aWhere, aSelectRestoredTab, aBlankTabToReuse, skipAnimation) {
    if (!Tabmix.prefs.getBoolPref("undoClose") || this.count === 0)
      return null;

    // get tab data
    let {state, pos} = this.getClosedTabAtIndex(aIndex);

    var tabToRemove = null;
    var cTab = gBrowser._selectedTab;
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

    let createLazyBrowser =
      Services.prefs.getBoolPref("browser.sessionstore.restore_tabs_lazily") &&
      Services.prefs.getBoolPref("browser.sessionstore.restore_on_demand") &&
      !aSelectRestoredTab && !state.pinned;

    let userContextId = state.userContextId ?? "";
    let reuseExisting = !createLazyBrowser && aBlankTabToReuse &&
        aBlankTabToReuse.getAttribute("usercontextid") === userContextId;

    let newTab = reuseExisting ? aBlankTabToReuse :
      gBrowser.addTrustedTab(null, Object.assign({
        createLazyBrowser,
        skipAnimation: tabToRemove || skipAnimation,
        allowInheritPrincipal: true,
        noInitialLabel: true,
        userContextId,
        index: gBrowser.tabs.length,
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
    TabmixSvc.SessionStore.restoreTab(newTab, state);

    if (TMP_TabView.exist("afterUndoCloseTab")) {
      TabView.afterUndoCloseTab();
    }

    // after we open new tab we only need to fix position if this condition is true
    // we prevent gBrowser.addTab from moving new tab when we call it from here
    var restorePosition = Tabmix.prefs.getBoolPref("undoClosePosition");
    if (aWhere == "current" || (aWhere == "original" && restorePosition)) {
      gBrowser.moveTabTo(newTab, Math.min(gBrowser.tabs.length - 1, pos));
    } else if (aWhere != "end" && Tabmix.getOpenTabNextPref()) {
      let tab = gBrowser._lastRelatedTabMap.get(gBrowser.selectedTab) || gBrowser.selectedTab;
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
    return this._undoCloseTab(aIndex || 0, aWhere || "original", true);
  }

};

Tabmix.closedObjectsUtils = {
  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    Services.obs.addObserver(this, "sessionstore-closed-objects-changed");

    this.toggleRecentlyClosedWindowsButton();
  },

  initObjectPanel(viewType) {
    const wasInitialized = `_initialized_closed${viewType}`;
    if (this[wasInitialized]) {
      return;
    }
    this[wasInitialized] = true;

    const template = document.getElementById(`tabmix-closed${viewType}-container`);
    template.replaceWith(template.content);

    const panelview = document.getElementById(`tabmix-closed${viewType}View`);

    const body = document.createXULElement("vbox");
    body.className = "panel-subview-body";
    body.__tagName = "toolbarbutton";
    body.hidePopup = () => panelview.closest("panel")?.hidePopup();

    panelview.appendChild(body);
    panelview.menupopup = body;

    panelview.addEventListener("ViewShowing", () => {
      const method = `populateClosed${viewType}Menu`;
      this[method](panelview);
    });
  },

  /**
   * @brief           catch middle click from closed windows list,
   *                  delete window from the list or restore according to the pref
   * @param event     a valid event union.
   * @returns         noting.
   *
   */
  checkForMiddleClick(event) {
    if (event.button != 1) {
      return;
    }

    event.stopPropagation();
    const index = event.originalTarget.value ?? -1;
    if (index < 0) {
      return;
    }

    const where = Tabmix.prefs.getBoolPref("middleclickDelete") ? 'delete' : 'window';
    this.restoreWindow(where, index);

    const popup = event.originalTarget.parentNode;
    this.updateView(popup);
  },

  forgetClosedWindow(index) {
    if (index < 0) {
      while (TabmixSvc.ss.getClosedWindowCount() > 0)
        TabmixSvc.ss.forgetClosedWindow(0);
    } else {
      TabmixSvc.ss.forgetClosedWindow(index);
    }
  },

  observe(subject, topic) {
    switch (topic) {
      case "sessionstore-closed-objects-changed":
        TMP_ClosedTabs.setButtonDisableState();
        this.toggleRecentlyClosedWindowsButton();
        break;
    }
  },

  on_delete(node) {
    const index = node.value;
    this.restoreWindow('delete', index);
    this.updateView(node.parentNode);
  },

  populateClosedTabsMenu(undoTabMenu) {
    if (TabmixAllTabs.isAfterCtrlClick(undoTabMenu)) {
      return false;
    }

    const _getClosedTabCount = HistoryMenu.prototype._getClosedTabCount;
    HistoryMenu.prototype.populateUndoSubmenu.apply({undoTabMenu, _getClosedTabCount});

    // Bug 1689378 removed keyboard shortcut indicator for Firefox 87+
    if (undoTabMenu.localName === "panelview") {
      undoTabMenu.removeAttribute("added-shortcuts");
      PanelUI._ensureShortcutsShown(undoTabMenu);
    }

    return true;
  },

  populateClosedWindowsMenu(undoWindowMenu) {
    HistoryMenu.prototype.populateUndoWindowSubmenu.apply({undoWindowMenu});

    // Bug 1689378 removed keyboard shortcut indicator for Firefox 87+
    if (undoWindowMenu.localName === "panelview") {
      undoWindowMenu.removeAttribute("added-shortcuts");
      PanelUI._ensureShortcutsShown(undoWindowMenu);
    }
  },

  removeObservers() {
    if (!this.initialized) {
      return;
    }
    Services.obs.removeObserver(this, "sessionstore-closed-objects-changed");
  },

  restoreWindow(where, index) {
    switch (where) {
      case "delete":
        this.forgetClosedWindow(index);
        break;
      case "window":
      /* falls through */
      default:
        undoCloseWindow(index);
    }
  },

  async showSubView(event) {
    const viewType = event.target.id == "tabmix-closedWindowsButton" ? "Windows" : "Tabs";

    let anchor = event.target;
    if (
      !Tabmix.isVersion(860) &&
      viewType === "Windows" &&
      anchor.parentNode.parentNode.id === "widget-overflow-fixed-list"
    ) {
      anchor = document.getElementById("nav-bar-overflow-button");
      await new Promise(r => setTimeout(r, 0));
    }

    this.initObjectPanel(viewType);
    PanelUI.showSubView(
      `tabmix-closed${viewType}View`,
      anchor,
      event
    );
  },

  // enable/disable the Recently Closed Windows button
  toggleRecentlyClosedWindowsButton() {
    Tabmix.setItem("tmp_closedwindows", "disabled", TabmixSvc.ss.getClosedWindowCount() === 0 || null);
  },

  updateView(popup) {
    if (TabmixSvc.ss.getClosedWindowCount() > 0) {
      this.populateClosedWindowsMenu(popup.parentNode);
    } else {
      popup.hidePopup();
      if (popup.parentNode.localName != "panelview") {
        popup.parentNode.parentNode.hidePopup();
      }
    }
  },

};
