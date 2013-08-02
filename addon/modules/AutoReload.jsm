"use strict";

var EXPORTED_SYMBOLS = ["AutoReload"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://tabmixplus/Services.jsm");

let AutoReload = {
  init: function() {
    _setItem = TabmixSvc.topWin().Tabmix.setItem;
  },

  initTab: function(aTab) {
    aTab.autoReloadEnabled = false;
    aTab.removeAttribute("_reload");
    aTab.autoReloadTime = TabmixSvc.prefBranch.getIntPref("reload_time");
    aTab.autoReloadTimerID = null;
    aTab.postDataAcceptedByUser = false;
  },

 /**
  * Popup command
  */
  addClonePopup: function(aPopup, aTab) {
    var win = _getWindow(aTab.linkedBrowser.contentWindow);
    let popup = win.document.getElementById("autoreload_popup");
    let parent = aPopup.parentNode;
    aPopup.setAttribute("onpopuphidden", "this._tab = null;");
    aPopup.setAttribute("oncommand", "Tabmix.autoReload.setTime(this._tab, event.originalTarget.value);event.stopPropagation();");
    for (let i=0; i<popup.childNodes.length; i++)
      aPopup.appendChild(popup.childNodes[i].cloneNode(true));
    if (parent.id != "reload-button") {
      aPopup.childNodes[0].hidden = true;
      aPopup.childNodes[1].hidden = true;
    }
    aPopup.inited = true;
  },

  onPopupShowing: function(aPopup, aTab) {
    function setLabel(aItem, aSeconds) {
      var timeLabel = aItem.getAttribute("_label") + " ";
      if (aSeconds > 59) {
        let minutes = parseInt(aSeconds / 60);
        timeLabel += minutes + " " + (minutes > 1 ? customMenu.getAttribute("minutes") :
                            customMenu.getAttribute("minute"));
        aSeconds -= 60*minutes;
        if (aSeconds)
          timeLabel += " ";
      }
      if (aSeconds || !timeLabel)
        timeLabel += aSeconds + " " + customMenu.getAttribute("seconds");
      aItem.setAttribute("label", timeLabel);
    }

    var menuItems = aPopup.childNodes;
    aPopup._tab = null;
    if (aTab.localName != "tab")
      aTab = this._currentTab(aTab);

    // populate the menu on the first popupShowing
    if (!aPopup.id  && !aPopup.inited)
      this.addClonePopup(aPopup, aTab);
    aPopup._tab = aTab;

    if (aPopup._tab.autoReloadEnabled == null)
      this.initTab(aPopup._tab);

    var customReloadTime = TabmixSvc.prefBranch.getIntPref("custom_reload_time");
    var customMenu = menuItems[5];
    customMenu.setAttribute("value", customReloadTime);
    setLabel(customMenu, customReloadTime);

    var enableItem = menuItems[2];
    enableItem.setAttribute("checked", aPopup._tab.autoReloadEnabled);
    setLabel(enableItem, aPopup._tab.autoReloadTime);

    var radio = aPopup.getElementsByAttribute("value" , "*");
    for (let i=0; i<radio.length; i++) {
      _setItem(radio[i], "checked", radio[i].value == aPopup._tab.autoReloadTime || null);
    }
  },

  setTime: function(aTab, aReloadTime) {
    if (aTab.localName != "tab")
      aTab = this._currentTab(aTab);
    aTab.autoReloadTime = aReloadTime;
    TabmixSvc.prefBranch.setIntPref("reload_time", aTab.autoReloadTime);
    this._enable(aTab);
  },

  setCustomTime : function(aTab) {
    if (aTab.localName != "tab")
      aTab = this._currentTab(aTab);
    let result = {ok: false};
    var win = _getWindow(aTab.linkedBrowser.contentWindow);
    win.openDialog('chrome://tabmixplus/content/minit/autoReload.xul', '_blank', 'chrome,modal,centerscreen', result);
    if (result.ok) {
      aTab.autoReloadTime = TabmixSvc.prefBranch.getIntPref("custom_reload_time");
      this._enable(aTab);
    }
  },

  enableAllTabs: function(aTabBrowser) {
    var tabs = aTabBrowser.visibleTabs;
    for(let i=0; i<tabs.length; i++) {
      let tab = tabs[i];
      if (tab.autoReloadEnabled == null)
        this.initTab(tab);

      if (!tab.autoReloadEnabled || tab.autoReloadURI != tab.linkedBrowser.currentURI.spec)
        this._enable(tab);
    }
  },

  disableAllTabs: function(aTabBrowser) {
    var tabs = aTabBrowser.visibleTabs;
    for(let i=0; i<tabs.length; i++) {
      let tab = tabs[i];
      if (tab.autoReloadEnabled)
        this._disable(tab);
    }
  },

 /**
  * called from popup and from tabclick options
  */
  toggle: function(aTab) {
    if (aTab.localName != "tab")
      aTab = this._currentTab(aTab);
    if (aTab.autoReloadEnabled)
      this._disable(aTab);
    else
      this._enable(aTab);
  },

  _enable: function(aTab) {
    var browser = aTab.linkedBrowser;
    var url = browser.currentURI.spec;
    if (url.match(/^about:/) || url.match(/^(http|https):\/\/mail.google.com/))
      return;
    aTab.autoReloadEnabled = true;
    _setItem(aTab, "_reload", true);
    aTab.autoReloadURI = url;
    var win = _getWindow(browser.contentWindow);
    _clearTimeout(aTab, win);
    aTab.autoReloadTimerID = win.setTimeout(_reloadTab, aTab.autoReloadTime*1000, aTab);
    aTab.setAttribute("reload-data", aTab.autoReloadURI + " " + aTab.autoReloadTime);
  },

  _disable: function(aTab) {
    aTab.autoReloadEnabled = false;
    _setItem(aTab, "_reload", null);
    aTab.autoReloadURI = null;
    aTab.postDataAcceptedByUser = false;
    _clearTimeout(aTab);
    aTab.removeAttribute("reload-data");
  },

  /**
   * we supposed to get here only when using firefox 3
   * keep it just to be on the safe side.
   */
  _currentTab: function(aTabContainer) {
    if (aTabContainer && aTabContainer.localName == "tabs")
      return aTabContainer.selectedItem;

    throw new Error("Tabmix: unexpected argument");
  },

 /**
  *  called by TabmixProgressListener.listener
  */
  onTabReloaded: function(aTab, aBrowser) {
    var win = _getWindow(aBrowser.contentWindow);
    if (aTab.autoReloadTimerID)
      _clearTimeout(aTab, win);

    if (!TabmixSvc.prefBranch.getBoolPref("reload_match_address") ||
        aTab.autoReloadURI == aBrowser.currentURI.spec) {
      if (aBrowser.curScrollX || aBrowser.curScrollY)
        aBrowser.contentWindow.scrollTo(aBrowser.curScrollX, aBrowser.curScrollY);

      if (!aTab.autoReloadEnabled)
        aTab.autoReloadEnabled = true;

      aTab.autoReloadTimerID = win.setTimeout(_reloadTab, aTab.autoReloadTime*1000, aTab);
    }
    else if (aTab.autoReloadEnabled)
      aTab.autoReloadEnabled = false;
    _setItem(aTab, "_reload", aTab.autoReloadEnabled || null);
  }
}

function _getWindow(aContentWindow) {
  return aContentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                       .getInterface(Ci.nsIWebNavigation)
                       .QueryInterface(Ci.nsIDocShellTreeItem)
                       .rootTreeItem
                       .QueryInterface(Ci.nsIInterfaceRequestor)
                       .getInterface(Ci.nsIDOMWindow)
                       .wrappedJSObject;
}

function _setItem () {}

function _reloadTab(aTab) {
  if (aTab == null || !aTab.parentNode)
    return;

  if (aTab.autoReloadEnabled == false ) {
    aTab.postDataAcceptedByUser = false;
    return;
  }

  var browser = aTab.linkedBrowser;
  var webNav = browser.webNavigation;
  var postData, referrer;

  try {
    let sh = webNav.sessionHistory;
    if (sh) {
      let entry = sh.getEntryAtIndex(sh.index, false);
      postData = entry.QueryInterface(Ci.nsISHEntry).postData;
      referrer = entry.QueryInterface(Ci.nsISHEntry).referrerURI;

      if (postData == null)
        webNav = sh.QueryInterface(Ci.nsIWebNavigation);
      else if (!aTab.postDataAcceptedByUser) {
        let win = _getWindow(browser.contentWindow)
        let title = TabmixSvc.getString('confirm_autoreloadPostData_title');
        let msg = TabmixSvc.getString('confirm_autoreloadPostData');
        TabmixSvc.obs.addObserver(_observe, "common-dialog-loaded", false);
        let resultOK = TabmixSvc.prompt.confirm(win, title, msg);
        if (resultOK)
          aTab.postDataAcceptedByUser = true;
        else {
          aTab.autoReloadEnabled = false;
          _setItem(aTab, "_reload", null);
          aTab.autoReloadURI = null;
          aTab.removeAttribute("reload-data");
          return;
        }
      }
    }
  } catch (e) { }

  browser.curScrollX = browser.contentWindow.scrollX;
  browser.curScrollY = browser.contentWindow.scrollY;
  var loadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY |
                              Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY |
                              Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
  if (postData)
    webNav.loadURI(webNav.currentURI.spec, loadFlags, referrer, postData, null);
  else
    webNav.reload(loadFlags);
}

function  _observe(aSubject, aTopic, aData) {
  if (aTopic == "common-dialog-loaded") {
    TabmixSvc.obs.removeObserver(_observe, "common-dialog-loaded");
    let icon = aSubject.document.getElementById("info.icon");
    icon.className = icon.className.replace("question-icon" ,"alert-icon");
  }
}

function  _clearTimeout(aTab, aWindow) {
  if (aTab.autoReloadTimerID) {
    if (!aWindow)
      aWindow = _getWindow(aTab.linkedBrowser.contentWindow);
    aWindow.clearTimeout(aTab.autoReloadTimerID);
  }
}
