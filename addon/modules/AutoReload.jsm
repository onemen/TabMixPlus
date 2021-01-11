"use strict";

this.EXPORTED_SYMBOLS = ["AutoReload"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://tabmixplus/TabmixSvc.jsm", this);

var _setItem = function() {};

this.AutoReload = {
  init() {
    _setItem = TabmixSvc.topWin().Tabmix.setItem;
  },

  initTab(aTab) {
    aTab.autoReloadEnabled = false;
    aTab.removeAttribute("_reload");
    aTab.autoReloadTime = TabmixSvc.prefBranch.getIntPref("reload_time");
    aTab.autoReloadTimerID = null;
    aTab.postDataAcceptedByUser = false;
  },

  /**
   * Popup command
   */
  addClonePopup(aPopup, aTab) {
    var win = aTab.ownerGlobal;
    let popup = win.document.getElementById("autoreload_popup");
    let parent = aPopup.parentNode;
    win.Tabmix.setItem(aPopup, "onpopuphidden", "this._tab = null;");
    win.Tabmix.setItem(aPopup, "oncommand",
      "Tabmix.autoReload.setTime(this._tab, event.originalTarget.value);event.stopPropagation();");
    for (let i = 0; i < popup.childNodes.length; i++)
      aPopup.appendChild(popup.childNodes[i].cloneNode(true));
    if (parent.id != "reload-button") {
      aPopup.childNodes[0].hidden = true;
      aPopup.childNodes[1].hidden = true;
    }
    aPopup.inited = true;
  },

  onPopupShowing(aPopup, aTab) {
    var menuItems = aPopup.childNodes;
    aPopup._tab = null;
    if (aTab.localName != "tab")
      aTab = this._currentTab(aTab);

    // populate the menu on the first popupShowing
    if (!aPopup.id && !aPopup.inited)
      this.addClonePopup(aPopup, aTab);
    aPopup._tab = aTab;

    if (aPopup._tab.autoReloadEnabled === undefined)
      this.initTab(aPopup._tab);

    var enableItem = menuItems[2];
    if (!this._labels) {
      this._labels = {
        minute: enableItem.getAttribute("minute"),
        minutes: enableItem.getAttribute("minutes"),
        seconds: enableItem.getAttribute("seconds")
      };
    }
    enableItem.setAttribute("checked", aPopup._tab.autoReloadEnabled);
    this.setLabel(enableItem, aPopup._tab.autoReloadTime);

    this.updateCustomList(aPopup);

    var radio = aPopup.getElementsByAttribute("value", "*");
    for (let i = 0; i < radio.length; i++) {
      _setItem(radio[i], "checked", radio[i].value == aPopup._tab.autoReloadTime || null);
    }
  },

  updateCustomList(aPopup) {
    let start = aPopup.getElementsByAttribute("anonid", "start_custom_list")[0];
    let end = aPopup.getElementsByAttribute("anonid", "end_custom_list")[0];
    while (start.nextSibling && start.nextSibling != end) {
      start.nextSibling.remove();
    }

    // get the custom list and validate its values
    function getList() {
      let prefs = TabmixSvc.prefBranch, pref = "custom_reload_list";
      if (!prefs.prefHasUserValue(pref))
        return [];
      let list = prefs.getCharPref(pref).split(",");
      if (!list.every(val => val == parseInt(val))) {
        prefs.clearUserPref(pref);
        return [];
      }
      let defaultList = ["30", "60", "120", "300", "900", "1800"];
      list = list.filter(val => defaultList.indexOf(val) == -1);
      let newList = [];
      list.forEach(val => {
        if (parseInt(val) && newList.indexOf(val) == -1)
          newList.push(val);
        if (newList.length > 6)
          newList.shift();
      });
      prefs.setCharPref(pref, newList);
      return newList;
    }

    let doc = aPopup.ownerGlobal.document;
    getList().sort((a, b) => parseInt(a) > parseInt(b)).forEach(val => {
      let mi = doc.createElement("menuitem");
      this.setLabel(mi, val);
      mi.setAttribute("type", "radio");
      mi.setAttribute("value", val);
      aPopup.insertBefore(mi, end);
    });
  },

  setLabel(aItem, aSeconds) {
    var timeLabel = aItem.hasAttribute("_label") ? aItem.getAttribute("_label") + " " : "";
    if (aSeconds > 59) {
      let minutes = parseInt(aSeconds / 60);
      timeLabel += minutes + " " + (this._labels[minutes > 1 ? "minutes" : "minute"]);
      aSeconds -= 60 * minutes;
      if (aSeconds)
        timeLabel += " ";
    }
    if (aSeconds || !timeLabel)
      timeLabel += aSeconds + " " + this._labels.seconds;
    aItem.setAttribute("label", timeLabel);
  },

  setTime(aTab, aReloadTime) {
    if (aTab.localName != "tab")
      aTab = this._currentTab(aTab);
    aTab.autoReloadTime = aReloadTime;
    TabmixSvc.prefBranch.setIntPref("reload_time", aTab.autoReloadTime);
    this._enable(aTab);
  },

  setCustomTime(aTab) {
    if (aTab.localName != "tab")
      aTab = this._currentTab(aTab);
    let result = {ok: false};
    var win = aTab.ownerGlobal;
    win.openDialog('chrome://tabmixplus/content/overlay/autoReload.xul', '_blank', 'chrome,modal,centerscreen', result);
    if (result.ok) {
      aTab.autoReloadTime = TabmixSvc.prefBranch.getIntPref("reload_time");
      this._enable(aTab);
    }
  },

  enableAllTabs(aTabBrowser) {
    const win = aTabBrowser.ownerGlobal;
    const tabs = win.Tabmix.visibleTabs.tabs;
    for (let i = 0; i < tabs.length; i++) {
      let tab = tabs[i];
      if (tab.autoReloadEnabled === undefined)
        this.initTab(tab);

      if (!tab.autoReloadEnabled || tab.autoReloadURI != tab.linkedBrowser.currentURI.spec)
        this._enable(tab);
    }
  },

  disableAllTabs(aTabBrowser) {
    const win = aTabBrowser.ownerGlobal;
    const tabs = win.Tabmix.visibleTabs.tabs;
    for (let i = 0; i < tabs.length; i++) {
      let tab = tabs[i];
      if (tab.autoReloadEnabled)
        this._disable(tab);
    }
  },

  /**
   * called from popup and from tabclick options
   */
  toggle(aTab) {
    if (aTab.localName != "tab")
      aTab = this._currentTab(aTab);
    if (aTab.autoReloadEnabled)
      this._disable(aTab);
    else
      this._enable(aTab);
  },

  _enable(aTab) {
    var browser = aTab.linkedBrowser;
    var url = browser.currentURI.spec;
    if (url.match(/^about:/) || url.match(/^(http|https):\/\/mail.google.com/))
      return;
    aTab.autoReloadEnabled = true;
    _setItem(aTab, "_reload", true);
    aTab.autoReloadURI = url;
    var win = aTab.ownerGlobal;
    _clearTimeout(aTab, win);
    aTab.autoReloadTimerID = win.setTimeout(_reloadTab, aTab.autoReloadTime * 1000, aTab);
    this._update(aTab, aTab.autoReloadURI + " " + aTab.autoReloadTime);
  },

  _disable(aTab) {
    aTab.autoReloadEnabled = false;
    _setItem(aTab, "_reload", null);
    aTab.autoReloadURI = null;
    aTab.postDataAcceptedByUser = false;
    _clearTimeout(aTab);
    this._update(aTab);
  },

  _update(aTab, aValue) {
    _setItem(aTab, "reload-data", aValue);
    let win = aTab.ownerGlobal;
    TabmixSvc.saveTabAttributes(aTab, "reload-data");
    win.TabmixSessionManager.updateTabProp(aTab);
  },

  /**
   * we supposed to get here only when using firefox 3
   * keep it just to be on the safe side.
   */
  _currentTab(aTabContainer) {
    if (aTabContainer && aTabContainer.localName == "tabs")
      return aTabContainer.selectedItem;

    throw new Error("Tabmix: unexpected argument");
  },

  /**
   *  called by TabmixProgressListener.listener and Tabmix.restoreTabState
   *  for pending tabs
   */
  onTabReloaded(aTab, aBrowser) {
    var win = aTab.ownerGlobal;
    if (aTab.autoReloadTimerID)
      _clearTimeout(aTab, win);

    if (!TabmixSvc.prefBranch.getBoolPref("reload_match_address") ||
        aTab.autoReloadURI == aBrowser.currentURI.spec) {
      if (aBrowser.__tabmixScrollPosition || null) {
        if (TabmixSvc.version(330)) {
          aBrowser.messageManager
              .sendAsyncMessage("Tabmix:setScrollPosition",
                aBrowser.__tabmixScrollPosition);
        } else {
          let {x, y} = aBrowser.__tabmixScrollPosition;
          aBrowser.contentWindow.scrollTo(x, y);
        }
        aBrowser.__tabmixScrollPosition = null;
      }

      if (!aTab.autoReloadEnabled)
        aTab.autoReloadEnabled = true;

      aTab.autoReloadTimerID = win.setTimeout(_reloadTab, aTab.autoReloadTime * 1000, aTab);
    } else if (aTab.autoReloadEnabled) {
      aTab.autoReloadEnabled = false;
    }
    _setItem(aTab, "_reload", aTab.autoReloadEnabled || null);
  },

  confirm(window, tab, isRemote) {
    if (tab.postDataAcceptedByUser)
      return true;
    let title = TabmixSvc.getString('confirm_autoreloadPostData_title');
    let remote = isRemote ? '_remote' : '';
    let msg = TabmixSvc.getString('confirm_autoreloadPostData' + remote);
    Services.obs.addObserver(_observe, "common-dialog-loaded", false);
    let resultOK = Services.prompt.confirm(window, title, msg);
    if (resultOK)
      tab.postDataAcceptedByUser = true;
    else
      this._disable(tab);

    return resultOK;
  },

  reloadRemoteTab(browser, data) {
    var window = browser.ownerGlobal;
    let tab = window.gBrowser.getTabForBrowser(browser);
    // RemoteWebNavigation accepting postdata or headers only from Firefox 42.
    if (data.isPostData && !this.confirm(window, tab, !TabmixSvc.version(420)))
      return;

    doReloadTab(window, browser, data);
  }
};

function _reloadTab(aTab) {
  if (!aTab || !aTab.parentNode)
    return;

  if (aTab.autoReloadEnabled === false) {
    aTab.postDataAcceptedByUser = false;
    return;
  }

  var browser = aTab.linkedBrowser;
  if (TabmixSvc.version(330) && browser.getAttribute("remote")) {
    browser.messageManager.sendAsyncMessage("Tabmix:collectReloadData");
    return;
  }

  var data = {};
  var window = aTab.ownerGlobal;

  try {
    let sh = browser.webNavigation.sessionHistory;
    if (sh) {
      let entry = sh.getEntryAtIndex(sh.index, false);
      data.postData = entry.QueryInterface(Ci.nsISHEntry).postData;
      data.referrer = entry.QueryInterface(Ci.nsISHEntry).referrerURI;
      if (data.postData && !AutoReload.confirm(window, aTab))
        return;
    }
  } catch (e) { }

  let contentWindow = browser.contentWindow;
  data.scrollX = contentWindow.scrollX;
  data.scrollY = contentWindow.scrollY;
  doReloadTab(window, browser, data);
}

function doReloadTab(window, browser, data) {
  browser.__tabmixScrollPosition = {
    x: data.scrollX,
    y: data.scrollY
  };
  var loadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY |
                              Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY |
                              Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;

  // This part is based on BrowserReloadWithFlags.
  let url = browser.currentURI.spec;
  let {postData, referrer} = data;
  let loadURIWithFlags = TabmixSvc.version(330) &&
      window.gBrowser.updateBrowserRemotenessByURL(browser, url) || postData;
  if (loadURIWithFlags) {
    if (!postData)
      postData = referrer = null;
    browser.loadURIWithFlags(url, loadFlags, referrer, null, postData);
    return;
  }

  if (!TabmixSvc.version(330)) {
    let webNav = browser.webNavigation.sessionHistory
        .QueryInterface(Ci.nsIWebNavigation);
    webNav.reload(loadFlags);
    return;
  }

  let windowUtils = window.QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindowUtils);

  browser.messageManager.sendAsyncMessage("Browser:Reload", {
    flags: loadFlags,
    handlingUserInput: windowUtils.isHandlingUserInput
  });
}

function _observe(aSubject, aTopic) {
  if (aTopic == "common-dialog-loaded") {
    Services.obs.removeObserver(_observe, "common-dialog-loaded");
    let icon = aSubject.document.getElementById("info.icon");
    icon.classList.add("alert-icon");
    icon.classList.remove("question-icon");
  }
}

function _clearTimeout(aTab, aWindow) {
  if (aTab.autoReloadTimerID) {
    if (!aWindow)
      aWindow = aTab.ownerGlobal;
    aWindow.clearTimeout(aTab.autoReloadTimerID);
  }
}
