import {TabmixSvc} from "chrome://tabmix-resource/content/TabmixSvc.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  E10SUtils: "resource://gre/modules/E10SUtils.sys.mjs",
  SitePermissions: "resource:///modules/SitePermissions.sys.mjs",
  TabmixUtils: "chrome://tabmix-resource/content/Utils.sys.mjs",
});

var _setItem = function() {};

export const AutoReload = {
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
    for (let i = 0; i < popup.childNodes.length; i++)
      aPopup.appendChild(popup.childNodes[i].cloneNode(true));
    if (parent.id != "reload-button") {
      aPopup.childNodes[0].hidden = true;
      aPopup.childNodes[1].hidden = true;
    }
    aPopup.inited = true;
  },

  addEventListener(popup) {
    popup.listenersAdded = true;
    popup.addEventListener("command", event => {
      event.stopPropagation();
      switch (event.target.dataset.command) {
        case "toggle":
          this.toggle(popup._tab);
          break;
        case "customTime":
          this.setCustomTime(popup._tab);
          break;
        case "enableAllTabs":
          this.enableAllTabs(popup.ownerGlobal.gBrowser);
          break;
        case "disableAllTabs":
          this.disableAllTabs(popup.ownerGlobal.gBrowser);
          break;
        default:
          this.setTime(popup._tab, event.originalTarget.value);
          break;
      }
    });

    popup.addEventListener("popuphidden", () => {
      popup._tab = null;
    });
  },

  onPopupShowing(aPopup, aTab) {
    var menuItems = aPopup.childNodes;
    aPopup._tab = null;
    if (aTab.localName != "tab")
      aTab = this._currentTab(aTab);

    // populate the menu on the first popupShowing
    if (!aPopup.id && !aPopup.inited) {
      this.addClonePopup(aPopup, aTab);
    }
    if (!aPopup.listenersAdded) {
      this.addEventListener(aPopup);
    }
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
      list = list.filter(val => !defaultList.includes(val));
      let newList = [];
      list.forEach(val => {
        if (parseInt(val) && !newList.includes(val))
          newList.push(val);
        if (newList.length > 6)
          newList.shift();
      });
      prefs.setCharPref(pref, newList);
      return newList;
    }

    let doc = aPopup.ownerGlobal.document;
    getList().sort((a, b) => parseInt(a) > parseInt(b)).forEach(val => {
      let mi = doc.createXULElement("menuitem");
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
      timeLabel += minutes + " " + this._labels[minutes > 1 ? "minutes" : "minute"];
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
    win.openDialog('chrome://tabmixplus/content/overlay/autoReload.xhtml', '_blank', 'chrome,modal,centerscreen', result);
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
    TabmixSvc.setCustomTabValue(aTab, "reload-data", aValue);
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
   *  called by TabmixProgressListener.listener
   */
  onTabReloaded(aTab, aBrowser) {
    var win = aTab.ownerGlobal;
    if (aTab.autoReloadTimerID)
      _clearTimeout(aTab, win);

    if (!TabmixSvc.prefBranch.getBoolPref("reload_match_address") ||
        aTab.autoReloadURI == aBrowser.currentURI.spec) {
      if (aBrowser.__tabmixScrollPosition || null) {
        aBrowser.messageManager
            .sendAsyncMessage("Tabmix:setScrollPosition",
              aBrowser.__tabmixScrollPosition);
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
    Services.obs.addObserver(_observe, "common-dialog-loaded");
    let resultOK = Services.prompt.confirm(window, title, msg);
    if (resultOK)
      tab.postDataAcceptedByUser = true;
    else
      this._disable(tab);

    return resultOK;
  },

  reloadRemoteTab(browser, data) {
    var window = browser.ownerGlobal;

    if (Services.appinfo.sessionHistoryInParent) {
      const postData = lazy.TabmixUtils.getPostDataFromHistory(browser.browsingContext.sessionHistory);
      data = {
        ...data,
        ...postData
      };
    }

    let tab = window.gBrowser.getTabForBrowser(browser);
    if (data.isPostData && !this.confirm(window, tab, false))
      return;

    data.referrerInfo = lazy.E10SUtils.deserializeReferrerInfo(data.referrerInfo);
    doReloadTab(window, browser, tab, data);
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
  if (browser.getAttribute("remote")) {
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
      data.referrerInfo = browser.ownerDocument.referrerInfo;
      if (data.postData && !AutoReload.confirm(window, aTab))
        return;
    }
  } catch {}

  let contentWindow = browser.contentWindow;
  data.scrollX = contentWindow.scrollX;
  data.scrollY = contentWindow.scrollY;
  doReloadTab(window, browser, aTab, data);
}

/**
 * when tab have beforeunload prompt, check if user canceled the reload
 */
async function beforeReload(window, browser) {
  const gBrowser = window.gBrowser;
  let prompt;
  const {permitUnload} = await browser.asyncPermitUnload("dontUnload");
  if (permitUnload) {
    return;
  }
  gBrowser.addEventListener("DOMModalDialogClosed", event => {
    const canUnload =
      event.target.nodeName != "browser" ||
      (prompt ?
        !prompt.args.inPermitUnload || prompt.args.ok :
        !event.detail?.wasPermitUnload || event.detail.areLeaving);
    if (!canUnload) {
      // User canceled the reload disable AutoReload for this tab
      const tab = gBrowser.getTabForBrowser(browser);
      AutoReload._disable(tab);
    }
  }, {once: true});
}

function doReloadTab(window, browser, tab, data) {
  beforeReload(window, browser);

  browser.__tabmixScrollPosition = {
    x: data.scrollX,
    y: data.scrollY
  };

  let loadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY |
                  Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
  if (Services.prefs.getIntPref("fission.webContentIsolationStrategy") < 2) {
    loadFlags |= Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY;
  }

  // This part is based on BrowserCommands.reloadWithFlags.
  let url = browser.currentURI;
  let urlSpec = url.spec;
  let {postData, referrerInfo} = data;
  let loadURI =
      window.gBrowser.updateBrowserRemotenessByURL(browser, urlSpec) || postData;
  if (loadURI) {
    if (!postData) {
      postData = referrerInfo = null;
    }
    browser.tabmix_allowLoad = true;
    browser.loadURI(url, {
      flags: loadFlags,
      referrerInfo,
      triggeringPrincipal: browser.contentPrincipal,
      postData
    });
    return;
  }

  lazy.SitePermissions.clearTemporaryBlockPermissions(browser);
  // Also reset DOS mitigations for the basic auth prompt on reload.
  delete browser.authPromptAbuseCounter;

  if (TabmixSvc.version(1283)) {
    if (window.document.hasValidTransientUserGestureActivation) {
      loadFlags |= Ci.nsIWebNavigation.LOAD_FLAGS_USER_ACTIVATION;
    }
    const {browsingContext} = tab.linkedBrowser;
    const {sessionHistory} = browsingContext;
    if (sessionHistory) {
      sessionHistory.reload(loadFlags);
    } else {
      browsingContext.reload(loadFlags);
    }
  } else {
    const handlingUserInput = window.document.hasValidTransientUserGestureActivation;

    browser.sendMessageToActor(
      "Browser:Reload",
      {flags: loadFlags, handlingUserInput},
      "BrowserTab"
    );
  }
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
