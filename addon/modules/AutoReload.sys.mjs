import {TabmixSvc} from "chrome://tabmix-resource/content/TabmixSvc.sys.mjs";

const DEFAULT_AUTORELOADTIME = 60;

/** @type {AutoReloadModule.Lazy} */ // @ts-ignore
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  E10SUtils: "resource://gre/modules/E10SUtils.sys.mjs",
  SitePermissions: "resource:///modules/SitePermissions.sys.mjs",
  TabmixUtils: "chrome://tabmix-resource/content/Utils.sys.mjs",
});

/** @type {TabmixGlobal["setItem"]} */
var _setItem = function () {};

/** @type {AutoReloadModule.AutoReload} */
export const AutoReload = {
  _labels: {
    minute: "",
    minutes: "",
    seconds: "",
  },

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

  /** Popup command */
  addClonePopup(aPopup, aTab) {
    var win = aTab.ownerGlobal;
    let popup = win.document.getElementById("autoreload_popup");
    let parent = aPopup.parentNode;
    for (const item of popup.childNodes) {
      if (item) {
        aPopup.appendChild(item.cloneNode(true));
      }
    }
    if (parent?.id != "reload-button") {
      const [first, second] = aPopup.childNodes;
      if (first) first.hidden = true;
      if (second) second.hidden = true;
    }
    aPopup.initialized = true;
  },

  addEventListener(popup) {
    popup.listenersAdded = true;
    popup.addEventListener("command", (/** @type {TabmixGlobals.PopupEvent} */ event) => {
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
      // @ts-ignore
      popup._tab = null;
    });
  },

  onPopupShowing(aPopup, aTab) {
    var menuItems = aPopup.childNodes;
    // @ts-ignore
    aPopup._tab = null;

    // populate the menu on the first popupShowing
    if (!aPopup.id && !aPopup.initialized) {
      this.addClonePopup(aPopup, aTab);
    }
    if (!aPopup.listenersAdded) {
      this.addEventListener(aPopup);
    }
    aPopup._tab = aTab;

    if (aPopup._tab.autoReloadEnabled === undefined) {
      this.initTab(aPopup._tab);
    }

    /** @type {HTMLElement} */ // @ts-ignore
    var enableItem = menuItems[2];
    if (!this._labels) {
      this._labels = {
        minute: enableItem.getAttribute("minute") ?? "",
        minutes: enableItem.getAttribute("minutes") ?? "",
        seconds: enableItem.getAttribute("seconds") ?? "",
      };
    }
    enableItem.setAttribute("checked", Boolean(aPopup._tab.autoReloadEnabled));
    this.setLabel(enableItem, aPopup._tab.autoReloadTime ?? 0);

    this.updateCustomList(aPopup);

    var radio = aPopup.getElementsByAttribute("value", "*");
    for (let i = 0; i < radio.length; i++) {
      _setItem(radio[i], "checked", radio[i]?.value == aPopup._tab.autoReloadTime || null);
    }
  },

  updateCustomList(aPopup) {
    let start = aPopup.getElementsByAttribute("anonid", "start_custom_list")[0];
    let end = aPopup.getElementsByAttribute("anonid", "end_custom_list")[0];
    while (start?.nextSibling && start?.nextSibling != end) {
      start.nextSibling.remove();
    }

    // get the custom list and validate its values
    function getList() {
      let prefs = TabmixSvc.prefBranch,
        pref = "custom_reload_list";
      if (!prefs.prefHasUserValue(pref)) {
        return [];
      }

      let list = prefs.getCharPref(pref).split(",");
      if (list.some(val => isNaN(parseInt(val)))) {
        prefs.clearUserPref(pref);
        return [];
      }
      const defaultList = ["30", "60", "120", "300", "900", "1800"];
      const newList = list.filter(val => !defaultList.includes(val) && parseInt(val));
      newList.splice(0, newList.length - 6);
      prefs.setCharPref(pref, newList.join(","));
      return newList;
    }

    let doc = aPopup.ownerGlobal.document;
    getList()
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach(val => {
        let mi = doc.createXULElement("menuitem");
        this.setLabel(mi, parseInt(val));
        mi.setAttribute("type", "radio");
        mi.setAttribute("value", val);
        aPopup.insertBefore(mi, end);
      });
  },

  setLabel(aItem, aSeconds) {
    var timeLabel = aItem.hasAttribute("_label") ? aItem.getAttribute("_label") + " " : "";
    if (aSeconds > 59) {
      let minutes = Math.floor(aSeconds / 60);
      timeLabel += minutes + " " + this._labels[minutes > 1 ? "minutes" : "minute"];
      aSeconds -= 60 * minutes;
      if (aSeconds) {
        timeLabel += " ";
      }
    }
    if (aSeconds || !timeLabel) {
      timeLabel += aSeconds + " " + this._labels.seconds;
    }

    aItem.setAttribute("label", timeLabel);
  },

  setTime(aTab, aReloadTime) {
    aTab.autoReloadTime = aReloadTime;
    TabmixSvc.prefBranch.setIntPref("reload_time", aTab.autoReloadTime);
    this._enable(aTab);
  },

  setCustomTime(aTab) {
    let result = {ok: false};
    var win = aTab.ownerGlobal;
    win.openDialog(
      "chrome://tabmixplus/content/overlay/autoReload.xhtml",
      "_blank",
      "chrome,modal,centerscreen",
      result
    );
    if (result.ok) {
      aTab.autoReloadTime = TabmixSvc.prefBranch.getIntPref("reload_time");
      this._enable(aTab);
    }
  },

  enableAllTabs(aTabBrowser) {
    const tabs = aTabBrowser.ownerGlobal.Tabmix.visibleTabs.tabs;
    for (const tab of tabs) {
      if (tab.autoReloadEnabled === undefined) {
        this.initTab(tab);
      }
      if (!tab.autoReloadEnabled || tab.autoReloadURI != tab.linkedBrowser.currentURI.spec) {
        this._enable(tab);
      }
    }
  },

  disableAllTabs(aTabBrowser) {
    const tabs = aTabBrowser.ownerGlobal.Tabmix.visibleTabs.tabs;
    for (const tab of tabs) {
      if (tab.autoReloadEnabled) {
        this._disable(tab);
      }
    }
  },

  /** called from popup and from tab click options */
  toggle(aTab) {
    if (aTab.autoReloadEnabled) {
      this._disable(aTab);
    } else {
      this._enable(aTab);
    }
  },

  _enable(aTab) {
    var browser = aTab.linkedBrowser;
    var url = browser.currentURI.spec;
    if (url.match(/^about:/) || url.match(/^(http|https):\/\/mail.google.com/)) {
      return;
    }

    aTab.autoReloadEnabled = true;
    _setItem(aTab, "_reload", true);
    aTab.autoReloadURI = url;
    var win = aTab.ownerGlobal;
    _clearTimeout(aTab, win);
    aTab.autoReloadTimerID = win.setTimeout(
      _reloadTab,
      (aTab.autoReloadTime ?? DEFAULT_AUTORELOADTIME) * 1000,
      aTab
    );
    this._update(aTab, aTab.autoReloadURI + " " + aTab.autoReloadTime);
  },

  _disable(aTab) {
    aTab.autoReloadEnabled = false;
    _setItem(aTab, "_reload", null);
    aTab.autoReloadURI = "";
    aTab.postDataAcceptedByUser = false;
    _clearTimeout(aTab);
    this._update(aTab);
  },

  _update(aTab, aValue) {
    _setItem(aTab, "reload-data", aValue);
    TabmixSvc.setCustomTabValue(aTab, "reload-data", aValue);
  },

  /** called by TabmixProgressListener.listener */
  onTabReloaded(aTab, aBrowser) {
    var win = aTab.ownerGlobal;
    if (aTab.autoReloadTimerID) {
      _clearTimeout(aTab, win);
    }

    if (
      !TabmixSvc.prefBranch.getBoolPref("reload_match_address") ||
      aTab.autoReloadURI == aBrowser.currentURI.spec
    ) {
      if (aBrowser.__tabmixScrollPosition || null) {
        aBrowser.messageManager.sendAsyncMessage(
          "Tabmix:setScrollPosition",
          aBrowser.__tabmixScrollPosition
        );
        aBrowser.__tabmixScrollPosition = null;
      }

      if (!aTab.autoReloadEnabled) {
        aTab.autoReloadEnabled = true;
      }

      aTab.autoReloadTimerID = win.setTimeout(
        _reloadTab,
        (aTab.autoReloadTime ?? DEFAULT_AUTORELOADTIME) * 1000,
        aTab
      );
    } else if (aTab.autoReloadEnabled) {
      aTab.autoReloadEnabled = false;
    }
    _setItem(aTab, "_reload", aTab.autoReloadEnabled || null);
  },

  confirm(window, tab, isRemote) {
    if (tab.postDataAcceptedByUser) {
      return true;
    }

    let title = TabmixSvc.getString("confirm_autoreloadPostData_title");
    let remote = isRemote ? "_remote" : "";
    let msg = TabmixSvc.getString("confirm_autoreloadPostData" + remote);
    Services.obs.addObserver(_observe, "common-dialog-loaded");
    let resultOK = Services.prompt.confirm(window, title, msg);
    if (resultOK) {
      tab.postDataAcceptedByUser = true;
    } else {
      this._disable(tab);
    }

    return resultOK;
  },

  reloadRemoteTab(browser, serializeData) {
    if (Services.appinfo.sessionHistoryInParent) {
      const postData = lazy.TabmixUtils.getPostDataFromHistory(
        browser.browsingContext.sessionHistory
      );
      Object.assign(serializeData, postData);
    }

    const window = browser.ownerGlobal;
    let tab = window.gBrowser.getTabForBrowser(browser);
    if (serializeData.isPostData && !this.confirm(window, tab, false)) {
      return;
    }

    /** @type {AutoReloadModule.ReloadData} */ // @ts-ignore
    let data = {...serializeData};

    // Convert serialized data to proper types
    if (serializeData.postData) {
      data.postData = lazy.TabmixUtils.makeInputStream(serializeData.postData);
    }
    data.referrerInfo = lazy.E10SUtils.deserializeReferrerInfo(serializeData.referrerInfo);
    doReloadTab(window, browser, tab, data);
  },
};

/** @type {AutoReloadModule._reloadTab} */
function _reloadTab(aTab) {
  if (!aTab || !aTab.parentNode) {
    return;
  }

  if (aTab.autoReloadEnabled === false) {
    aTab.postDataAcceptedByUser = false;
    return;
  }

  var browser = aTab.linkedBrowser;
  if (browser.getAttribute("remote")) {
    browser.messageManager.sendAsyncMessage("Tabmix:collectReloadData", {});
    return;
  }

  var data = {};
  var window = aTab.ownerGlobal;

  try {
    let sh = browser.webNavigation.sessionHistory;
    if (sh) {
      let entry = sh.getEntryAtIndex(sh.index, false);
      data.postData = entry.QueryInterface?.(Ci.nsISHEntry).postData ?? null;
      data.isPostData = Boolean(data.postData);
      data.referrerInfo = browser.ownerDocument.referrerInfo;
      if (data.postData && !AutoReload.confirm(window, aTab)) {
        return;
      }
    }
  } catch {}

  let contentWindow = browser.contentWindow;
  data.scrollX = contentWindow.scrollX;
  data.scrollY = contentWindow.scrollY;
  doReloadTab(window, browser, aTab, data);
}

/**
 * when tab have beforeunload prompt, check if user canceled the reload
 *
 * @type {AutoReloadModule.beforeReload}
 */
async function beforeReload(window, browser) {
  const gBrowser = window.gBrowser;
  const {permitUnload} = await browser.asyncPermitUnload("dontUnload");
  if (permitUnload) {
    return;
  }
  gBrowser.addEventListener(
    "DOMModalDialogClosed",
    event => {
      const canUnload =
        event.target.nodeName != "browser" ||
        !event.detail?.wasPermitUnload ||
        event.detail.areLeaving;
      if (!canUnload) {
        // User canceled the reload disable AutoReload for this tab
        const tab = gBrowser.getTabForBrowser(browser);
        AutoReload._disable(tab);
      }
    },
    {once: true}
  );
}

/** @type {AutoReloadModule.doReloadTab} */
function doReloadTab(window, browser, tab, data) {
  beforeReload(window, browser);

  browser.__tabmixScrollPosition = {
    x: data.scrollX,
    y: data.scrollY,
  };

  let loadFlags =
    Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY | Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
  if (Services.prefs.getIntPref("fission.webContentIsolationStrategy") < 2) {
    loadFlags |= Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY;
  }

  // This part is based on BrowserCommands.reloadWithFlags.
  let url = browser.currentURI;
  let urlSpec = url.spec;
  let {postData, referrerInfo} = data;
  let loadURI = window.gBrowser.updateBrowserRemotenessByURL(browser, urlSpec) || postData;
  if (loadURI) {
    if (!postData) {
      postData = referrerInfo = null;
    }
    browser.tabmix_allowLoad = true;
    browser.loadURI(url, {
      [TabmixSvc.version(1430) ? "loadFlags" : "flags"]: loadFlags,
      referrerInfo,
      triggeringPrincipal: browser.contentPrincipal,
      postData,
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

/** @type {AutoReloadModule._observe} */
function _observe(aSubject, aTopic) {
  if (aTopic == "common-dialog-loaded") {
    Services.obs.removeObserver(_observe, "common-dialog-loaded");
    let icon = aSubject.document.getElementById("info.icon");
    icon.classList.add("alert-icon");
    icon.classList.remove("question-icon");
  }
}

/** @type {AutoReloadModule._clearTimeout} */
function _clearTimeout(aTab, aWindow) {
  if (aTab.autoReloadTimerID) {
    if (!aWindow) {
      aWindow = aTab.ownerGlobal;
    }

    aWindow.clearTimeout(aTab.autoReloadTimerID);
  }
}
