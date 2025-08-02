/* global PrefWindow */
/* exported defaultSetting, donate, exportData, importData, openHelp, setDialog,
            showPane, toggleInstantApply, toggleSyncPreference, closeAll, RTL_UI */
"use strict";

/** Preference Dialog Functions **** */
/** @type {Globals.PrefFn} */
const PrefFn = new Map([
  [0, ""],
  [32, "getCharPref"],
  [64, "getIntPref"],
  [128, "getBoolPref"],
]);

/** @param {string} id @type {Document["getElementById"]} */
var $ = id => document.getElementById(id);

/** @param {string} id */
var $Pref = id => {
  const preference = document.getElementById(id, "_PREF_CLASS_");
  // only show error message when the element exist bt it is not a preference
  if (preference && preference.nodeName !== "preference") {
    console.error(`Preference ${id} is not a preference!`);
  }
  return preference;
};

/** @param {string} id */
const $Pane = id => {
  const pane = document.getElementById(id, "_PANE_CLASS_");
  if (pane.nodeName !== "prefpane") {
    console.error(`Pane ${id} is not a prefpane!`);
  }
  return pane;
};

// this is the same as document.documentElement it is the PrefWindow class
const prefWindow = $("TabMIxPreferences");

/** @type {GeneralPrefWindow} */
var gPrefWindow = {
  _initialized: false,
  set instantApply(val) {
    prefWindow.instantApply = val;
  },
  get instantApply() {
    return prefWindow.instantApply;
  },

  get pinTabLabel() {
    return Tabmix.lazyGetter(this, "pinTabLabel", () => {
      let win = Tabmix.getTopWin();
      return (
        win.document.getElementById("context_pinTab").getAttribute("label") +
        "/" +
        win.document.getElementById("context_unpinTab").getAttribute("label")
      );
    });
  },

  init() {
    this._initialized = true;

    if (TabmixSvc.isMac) {
      prefWindow.setAttribute("mac", true);
    } else if (TabmixSvc.isLinux) {
      prefWindow.setAttribute("linux", true);
      prefWindow.sizeToContent();
    }

    /* we don't need to fix tabpanels border in ubuntu */
    if (navigator.userAgent.toLowerCase().indexOf("ubuntu") > -1) {
      prefWindow.setAttribute("ubuntu", true);
    }

    window.gIncompatiblePane.init();

    window.addEventListener("change", this);
    window.addEventListener("beforeaccept", this);

    gNumberInput.init();

    // init buttons extra1, extra2, accept, cancel
    prefWindow.getButton("extra1").setAttribute("icon", "apply");
    prefWindow.getButton("extra2").setAttribute("popup", "tm-settings");
    prefWindow.setAttribute(
      "cancelbuttonlabel",
      prefWindow.mStrBundle.GetStringFromName("button-cancel")
    );
    this.setButtons(true);

    this.initBroadcasters("main");
    // hide broadcasters pane button
    var paneButton = prefWindow.getElementsByAttribute("pane", "broadcasters")[0];
    paneButton.collapsed = true;

    $("syncPrefs").setAttribute("checked", Tabmix.prefs.getBoolPref("syncPrefs"));
    $("instantApply").setAttribute("checked", Tabmix.prefs.getBoolPref("instantApply"));
    positionDonateButton();

    this.updateMaxHeight();
  },

  updateMaxHeight() {
    /** @type {number} */
    let previousDevicePixelRatio;
    const setMaxHeight = () => {
      const currentDevicePixelRatio = window.devicePixelRatio;
      if (currentDevicePixelRatio !== previousDevicePixelRatio) {
        const maxHeight = window.screen.height * 0.8;
        prefWindow.style.maxHeight = window.devicePixelRatio > 1.25 ? maxHeight + "px" : "";
        prefWindow.sizeToContent();
      }
      previousDevicePixelRatio = currentDevicePixelRatio;
    };
    window.addEventListener("resize", setMaxHeight);
    setMaxHeight();
  },

  initPane(aPaneID) {
    this.initBroadcasters(aPaneID);

    const aPaneElement = $(aPaneID);
    // select last selected tab in this pane
    /** @type {CustomGroupElement<HTMLElement>} */ // @ts-expect-error
    const tabs = $(aPaneID).querySelector("tabbox")?.querySelector("tabs");
    if (tabs) {
      let preference = $Pref("pref_" + tabs.id);
      if (preference?.value !== undefined) {
        tabs._inited = true;
        tabs.selectedIndex = preference.numberValue;
      }
    }

    const menuLists = aPaneElement.querySelectorAll("menulist");
    for (const menuList of menuLists) {
      if (!menuList.hasAttribute("sizetopopup") && menuList.firstChild) {
        menuList.style.width = menuList.firstChild.getBoundingClientRect().width + "px";
      }
    }

    // let _selectPane method set width for first prefpane
    if (!this._initialized) {
      this.init();
    }
  },

  deinit() {
    window.removeEventListener("change", this);
    window.removeEventListener("beforeaccept", this);
    Shortcuts.prefsChangedByTabmix = false;
    window.gIncompatiblePane.deinit();
  },

  handleEvent(aEvent) {
    const item = aEvent.target;
    switch (aEvent.type) {
      case "change":
        if (item.localName != "preference") {
          return;
        }
        this.updateBroadcaster(item);
        if (!this.instantApply) {
          this.updateApplyButton(aEvent);
        }

        break;
      case "beforeaccept":
        this.applyBlockedChanges();
        if (!this.instantApply) {
          Shortcuts.prefsChangedByTabmix = true;
        }
        break;
    }
  },

  changes: new Set(),

  widthPrefs: ["pref_minWidth", "pref_maxWidth"],

  get widthChanged() {
    return this.isInChanges(this.widthPrefs);
  },

  set widthChanged(val) {
    this.updateChanges(val, this.widthPrefs);
  },

  isInChanges(list) {
    return list.some(prefOrId => {
      const preference = typeof prefOrId === "string" ? $Pref(prefOrId) : prefOrId;
      return this.changes.has(preference);
    });
  },

  updateChanges(add, list) {
    if (!Array.isArray(list)) list = [list];
    const fnName = add ? "add" : "delete";
    for (let prefOrId of list) {
      const preference = typeof prefOrId === "string" ? $Pref(prefOrId) : prefOrId;
      this.changes[fnName](preference);
    }
    this.setButtons(!this.changes.size);
  },

  // block change on instantApply, user is force to hit apply
  blockOnInstantApply(item) {
    if (!this.instantApply) {
      return undefined;
    }
    const preference = $Pref(item.getAttribute("preference"));
    const valueChange = item.value !== String(preference.valueFromPreferences);
    this.updateChanges(valueChange, preference);
    return preference.value;
  },

  applyBlockedChanges() {
    if (this.widthChanged) {
      gAppearancePane.changeTabsWidth();
    }
    if (this.instantApply) {
      this.updateValueFromElement();
    }
  },

  updateValueFromElement() {
    // widthPrefs handled in gAppearancePane.changeTabsWidth
    const changes = [...this.changes].filter(c => !this.widthPrefs.includes(c));
    // in instantApply all the changes in this.changes are blocked changes
    // with: onsynctopreference="return gPrefWindow.blockOnInstantApply(this);"/>
    for (let preference of changes) {
      this.changes.delete(preference);
      const element = document.querySelector(`[preference=${preference.id}]`);
      if (element) {
        preference.value = preference.getValueByType(element);
      } else {
        throw new Error(`No preference element found for ${preference.id}`);
      }
    }
  },

  resetChanges() {
    // remove all pending changes
    if (this.changes.size) {
      if (this.widthChanged) {
        gAppearancePane.resetWidthChange();
      }

      for (let preference of this.changes) {
        this.changes.delete(preference);
        preference.value = preference.valueFromPreferences;
        if (preference.hasAttribute("notChecked")) {
          delete preference._lastValue;
        }
      }
      this.setButtons(true);
    }
  },

  updateApplyButton(aEvent) {
    var item = aEvent.target;
    if (item.localName != "preference") {
      return;
    }

    let valueChanged = item.value != item.valueFromPreferences;
    this.updateChanges(valueChanged, item);
  },

  onApply() {
    this.applyBlockedChanges();
    this.setButtons(true);
    if (this.instantApply) {
      return;
    }

    // set flag to prevent TabmixTabbar.updateSettings from run for each change
    Tabmix.prefs.setBoolPref("setDefault", true);
    Shortcuts.prefsChangedByTabmix = true;
    // Write all values to preferences.
    for (let preference of this.changes) {
      this.changes.delete(preference);
      preference.batching = true;
      preference.valueFromPreferences = preference.value;
      preference.batching = false;
    }
    this.afterShortcutsChanged();
    Tabmix.prefs.clearUserPref("setDefault"); // this trigger TabmixTabbar.updateSettings
    Services.prefs.savePrefFile(null);
  },

  setButtons(disable) {
    var docElt = prefWindow;
    // when in instantApply mode apply and accept buttons are hidden except when user
    // change min/max width value
    var applyButton = docElt.getButton("extra1");
    applyButton.disabled = disable;
    applyButton.hidden = this.instantApply && disable;
    docElt.getButton("accept").hidden = disable;

    const donateBox = document.querySelector(".donate-button-container");
    donateBox.hidden = this.instantApply && !disable;

    var action = disable ? "close" : "cancel";
    var cancelButton = docElt.getButton("cancel");
    cancelButton.label = docElt.getAttribute(action + "buttonlabel") ?? "";
    cancelButton.setAttribute("icon", action);

    docElt.defaultButton = disable ? "cancel" : "accept";
  },

  removeItemAndPrefById(id) {
    const item = document.querySelector(`[preference=${id}]`);
    if (!item) {
      throw new Error(`Tabmix:\n ${id} is not a preference`);
    }
    item.remove();
    this.removeChild(id);
  },

  removeChild(id) {
    let child = $(id);
    // override preferences getter before we remove the preference
    if (child.localName == "preference") {
      Object.defineProperty(child, "preferences", {value: child.parentNode});
    }
    child.remove();
  },

  initBroadcasters(paneID) {
    var broadcasters = $(paneID + ":Broadcaster");
    if (!broadcasters) {
      return;
    }

    for (let broadcaster of broadcasters.childNodes) {
      if (broadcaster?.id) {
        // not all observers are for preferences
        let preference = $Pref(broadcaster.id.replace("obs", "pref"));
        if (preference) {
          this.updateBroadcaster(preference, broadcaster);
        }
      }
    }
  },

  updateBroadcaster(aPreference, aBroadcaster) {
    if (aPreference.type != "bool" && !aPreference.hasAttribute("notChecked")) {
      return;
    }

    let broadcaster = aBroadcaster || $(aPreference.id.replace("pref_", "obs_"));
    if (broadcaster) {
      let {type, value} = aPreference;
      let disable =
        type == "bool" ? !value
        : aPreference.type == "number" ?
          value == parseInt(aPreference.getAttribute("notChecked") ?? "")
        : value == aPreference.getAttribute("notChecked");
      this.setDisabled(broadcaster, disable);
    }
  },

  setDisabled(itemOrId, val) {
    var item = typeof itemOrId == "string" ? $(itemOrId) : itemOrId;
    if (!item) {
      return;
    }

    if (item.hasAttribute("inverseDependency")) {
      val = !val;
    }

    // remove disabled when the value is false
    Tabmix.setItem(item, "disabled", val || null);
  },

  tabSelectionChanged(event) {
    var tabs = event.target?.tabbox?.tabs;
    if (tabs?.localName != "tabs" || !tabs.tabbox.hasAttribute("onselect")) {
      return;
    }

    let preference = $Pref("pref_" + tabs.id);
    if (!tabs._inited) {
      tabs._inited = true;
      if (preference.value !== null) {
        tabs.selectedIndex = preference.numberValue;
      } else {
        let val = preference.valueFromPreferences;
        if (val === null) {
          preference.valueFromPreferences = tabs.selectedIndex;
        } else {
          tabs.selectedIndex = Number(val);
        }
      }
    } else if (preference.value != tabs.selectedIndex) {
      preference.valueFromPreferences = tabs.selectedIndex;
    }
  },

  afterShortcutsChanged() {
    Shortcuts.prefsChangedByTabmix = false;
    if (
      typeof gMenuPane == "object" &&
      $Pref("pref_shortcuts").value != $("shortcut-group").value
    ) {
      gMenuPane.initializeShortcuts();
    }
  },

  // syncfrompreference and synctopreference are for checkbox preference
  // controlled by int preference
  syncfrompreference(item) {
    let preference = $Pref(item.getAttribute("preference"));
    return preference.value != parseInt(preference.getAttribute("notChecked") ?? "");
  },

  synctopreference(item, checkedVal) {
    let preference = $Pref(item.getAttribute("preference"));
    let control = $(item.getAttribute("control"));
    let notChecked = parseInt(preference.getAttribute("notChecked") ?? "");
    let val = item.checked ? preference._lastValue || checkedVal : notChecked;
    preference._lastValue = control.value;
    return val;
  },
};

/** @type {Globals.getPrefByType} */
function getPrefByType(prefName) {
  try {
    var fn = PrefFn.get(Services.prefs.getPrefType(prefName));
    if (fn == "getCharPref") {
      return Services.prefs.getStringPref(prefName);
    }
    if (fn && fn in Services.prefs) {
      return Services.prefs[fn](prefName);
    }
  } catch (ex) {
    Tabmix.log("can't read preference " + prefName + "\n" + ex, true);
  }
  return null;
}

/** @type {Globals.setPrefByType} */
function setPrefByType(prefName, newValue, browserWindow, atImport) {
  let pref = {
    name: prefName,
    value: newValue,
    type: Services.prefs.getPrefType(prefName),
  };
  try {
    if (!atImport || !setPrefAfterImport(pref, browserWindow)) {
      setPref(pref);
    }
  } catch (ex) {
    Tabmix.log(`can't write preference ${prefName}\nvalue ${pref.value}\n${ex}`, true);
  }
}

/** @type {Globals.setPref} */
function setPref(aPref) {
  let fn = PrefFn.get(aPref.type);
  if (fn == "getCharPref") {
    Services.prefs.setStringPref(aPref.name, aPref.value);
  } else if (fn) {
    const setFn = fn.replace(/^get/, "set");
    // @ts-expect-error
    Services.prefs[setFn](aPref.name, aPref.value);
  }
}

/** @type {Globals.setPrefAfterImport} */
function setPrefAfterImport(aPref, browserWindow) {
  // in prev version we use " " for to export string to file
  aPref.value = aPref.value.replace(/^"*|"*$/g, "");

  // preference that exist in the default branch but no longer in use by Tabmix
  switch (aPref.name) {
    case "browser.tabs.autoHide":
      // from tabmix 0.3.6.0.080223 we use extensions.tabmix.hideTabbar
      Tabmix.prefs.setIntPref("hideTabbar", aPref.value ? 1 : 0);
      return true;
    case "browser.tabs.closeButtons":
      // we use browser.tabs.closeButtons only in 0.3.8.3
      if (aPref.value < 0 || aPref.value > 6) {
        aPref.value = 6;
      }

      aPref.value = [3, 5, 1, 1, 2, 4, 1][aPref.value];
      Tabmix.prefs.setIntPref("tabs.closeButtons", aPref.value);
      return true;
  }

  // don't do anything if user locked a preference
  if (Services.prefs.prefIsLocked(aPref.name)) {
    return true;
  }

  // replace old preference by setting new value to it
  // and call gTMPprefObserver.updateSettings to replace it.
  if (aPref.type == Services.prefs.PREF_INVALID) {
    let val = parseInt(aPref.value);
    aPref.type =
      typeof val == "number" && !isNaN(val) ? 64
      : /true|false/i.test(aPref.value) ? 128
      : 32;
    if (aPref.type == 128) {
      aPref.value = /true/i.test(aPref.value);
    }

    let prefsUtil = browserWindow.gTMPprefObserver;
    prefsUtil.preventUpdate = true;
    setPref(aPref);
    prefsUtil.preventUpdate = false;
    prefsUtil.updateSettings();
    // remove the preference in case updateSettings did not handle it
    Services.prefs.clearUserPref(aPref.name);
    return true;
  }
  if (aPref.type == Services.prefs.PREF_BOOL) {
    aPref.value = /true/i.test(aPref.value);
  }

  return false;
}

ChromeUtils.defineLazyGetter(this, "gPreferenceList", () => {
  // other settings not in extensions.tabmix. branch that we save
  let otherPrefs = [
    "browser.allTabs.previews",
    "browser.ctrlTab.sortByRecentlyUsed",
    "browser.link.open_newwindow",
    "browser.link.open_newwindow.override.external",
    "browser.link.open_newwindow.restriction",
    TabmixSvc.newtabUrl,
    "browser.search.context.loadInBackground",
    "browser.search.openintab",
    "browser.sessionstore.interval",
    "browser.sessionstore.max_tabs_undo",
    "browser.sessionstore.privacy_level",
    "browser.sessionstore.restore_on_demand",
    "browser.sessionstore.resume_from_crash",
    "browser.startup.page",
    "browser.tabs.closeWindowWithLastTab",
    "browser.tabs.insertAfterCurrent",
    "browser.tabs.insertRelatedAfterCurrent",
    "browser.tabs.loadBookmarksInBackground",
    "browser.tabs.loadDivertedInBackground",
    "browser.tabs.loadInBackground",
    "browser.tabs.tabClipWidth",
    "browser.tabs.tabMaxWidth",
    "browser.tabs.tabMinWidth",
    "browser.tabs.warnOnClose",
    "browser.warnOnQuit",
    "browser.tabs.warnOnCloseOtherTabs",
    "toolkit.scrollbox.clickToScroll.scrollDelay",
    "toolkit.scrollbox.smoothScroll",
  ];

  let prefs = Services.prefs.getDefaultBranch("");
  let tabmixPrefs = Services.prefs.getChildList("extensions.tabmix.").sort();
  // filter out preference without default value
  tabmixPrefs = otherPrefs.concat(tabmixPrefs).filter(pref => {
    try {
      const fn = PrefFn.get(prefs.getPrefType(pref));
      if (fn && fn in prefs) {
        return prefs[fn](pref) !== undefined;
      }
    } catch {}
    return false;
  });
  return tabmixPrefs;
});

function defaultSetting() {
  gPrefWindow.resetChanges();
  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);
  Shortcuts.prefsChangedByTabmix = true;
  gPreferenceList.forEach(pref => {
    Services.prefs.clearUserPref(pref);
  });

  gPrefWindow.afterShortcutsChanged();
  Tabmix.prefs.clearUserPref("setDefault");
  Services.prefs.savePrefFile(null);
  updateInstantApply();
}

// update instantApply after import or reset
function updateInstantApply() {
  const menuItem = $("instantApply");
  const checked = menuItem.getAttribute("checked") === "true";

  // update any left over items with its preference value
  for (let preference of gPrefWindow.changes) {
    gPrefWindow.changes.delete(preference);
    preference.updateElements();
  }

  if (Tabmix.prefs.getBoolPref("instantApply") !== checked) {
    menuItem.setAttribute("checked", !checked);
    prefWindow.instantApply = !checked;
  }
  gPrefWindow.setButtons(!gPrefWindow.changes.size);
}

/** @type {Globals.toggleInstantApply} */
function toggleInstantApply(item) {
  const preference = $Pref("pref_instantApply");
  if (preference._running) return;
  const checked =
    item.localName === "menuitem" ? item.getAttribute("checked") === "true" : item.value;

  // apply all pending changes before we change mode to instantApply
  if (checked) gPrefWindow.onApply();

  prefWindow.instantApply = checked;
  if (item.id === "instantApply") {
    preference._running = true;
    Tabmix.prefs.setBoolPref("instantApply", checked);
    preference._running = false;
  }

  // update blocked value
  if (!checked) gPrefWindow.updateValueFromElement();

  gPrefWindow.setButtons(!gPrefWindow.changes.size);
  positionDonateButton();
}

function positionDonateButton() {
  const donateBox = document.querySelector(".donate-button-container");
  const dlgbuttons = document.querySelector('[anonid="dlg-buttons"]');
  if (gPrefWindow.instantApply) {
    dlgbuttons.insertBefore(donateBox, dlgbuttons.querySelector("spacer"));
  } else {
    dlgbuttons.parentNode?.insertBefore(donateBox, dlgbuttons);
  }
  if (window.toString() === "[object Window]") {
    prefWindow.sizeToContent();
  }
}

function toggleSyncPreference() {
  const sync = "services.sync.prefs.sync.";

  /** @type {"clearUserPref" | "setBoolPref"} */
  let fn = Tabmix.prefs.getBoolPref("syncPrefs") ? "clearUserPref" : "setBoolPref";
  Tabmix.prefs[fn]("syncPrefs", true);
  gPreferenceList.forEach(pref => {
    Services.prefs[fn](sync + pref, true);
  });
  Services.prefs.savePrefFile(null);
}

function exportData() {
  // save all pending changes
  gPrefWindow.onApply();
  showFilePicker(Ci.nsIFilePicker.modeSave)
    .then(file => {
      if (file) {
        let patterns = gPreferenceList.map(pref => {
          return "\n" + pref + "=" + getPrefByType(pref);
        });
        patterns.unshift("tabmixplus");
        IOUtils.writeUTF8(file.path, patterns.join(""));
      }
    })
    .catch(Tabmix.reportError);
}

async function importData() {
  try {
    const file = await showFilePicker(Ci.nsIFilePicker.modeOpen);
    if (!file) return;
    let input;
    input = await IOUtils.readUTF8(file.path);
    if (input) {
      loadData(input.replace(/\r\n/g, "\n").split("\n"));
    }
  } catch (ex) {
    Tabmix.reportError(ex);
  }
}

/**
 * Open file picker in open or save mode
 *
 * @param {number} mode The mode for the file picker: open|save
 * @returns {Promise<nsIFile | null>}
 */
function showFilePicker(mode) {
  return new Promise(resolve => {
    const nsIFilePicker = Ci.nsIFilePicker;
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    if (mode === nsIFilePicker.modeSave) {
      fp.defaultExtension = "txt";
      fp.defaultString = "TMPpref";
    }
    fp.init(window.browsingContext, null, mode);
    fp.appendFilters(nsIFilePicker.filterText);
    fp.open(result => {
      if (result === nsIFilePicker.returnOK) {
        const fileName = fp.file.leafName;
        if (!fileName.endsWith(".txt")) {
          fp.file.leafName = fileName + ".txt";
        }
        return resolve(fp.file);
      }
      return resolve(null);
    });
  });
}

/** @type {Globals.loadData} */
function loadData(pattern) {
  if (pattern[0] != "tabmixplus") {
    //  Can not import because it is not a valid file.
    let msg = TabmixSvc.getString("tmp.importPref.error1");
    let title = TabmixSvc.getString("tabmixoption.error.title");
    Services.prompt.alert(window, title, msg);
    return;
  }

  gPrefWindow.resetChanges();
  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);

  // set updateOpenedTabsLockState before lockallTabs and lockAppTabs
  let pref = "extensions.tabmix.updateOpenedTabsLockState=";
  let index = pattern.indexOf(pref + true) + pattern.indexOf(pref + false) + 1;
  if (index > 0) {
    pattern.splice(1, 0, pattern.splice(index, 1)[0] ?? "");
  }

  const browserWindow = Tabmix.getTopWin();
  var prefName, prefValue;
  for (const val of pattern) {
    Shortcuts.prefsChangedByTabmix = true;
    let valIndex = val.indexOf("=");
    if (valIndex > 0) {
      prefName = val.substring(0, valIndex);
      prefValue = val.substring(valIndex + 1, val.length);
      setPrefByType(prefName, prefValue, browserWindow, true);
    }
  }
  gPrefWindow.afterShortcutsChanged();
  browserWindow.gTMPprefObserver.updateTabClickingOptions();
  Tabmix.prefs.clearUserPref("setDefault");
  Services.prefs.savePrefFile(null);
  updateInstantApply();
}

// this function is called from Tabmix.openOptionsDialog if the dialog already opened
/** @type {Globals.showPane} */
function showPane(paneID) {
  let pane = $Pane(paneID);
  const paneToLoad = !pane || pane.nodeName != "prefpane" ? $Pane(prefWindow.lastSelected) : pane;
  prefWindow.showPane(paneToLoad);
}

/** @type {Globals.openHelp} */
function openHelp(helpTopic) {
  var helpPage = "https://onemen.github.io/tabmixplus-docs/";
  // Check if the help page already open in the top window
  var recentWindow = Tabmix.getTopWin();
  var tabBrowser = recentWindow.gBrowser;
  function selectHelpPage() {
    return tabBrowser.browsers.some((browser, i) => {
      if (browser.currentURI.spec.startsWith(helpPage)) {
        tabBrowser.tabContainer.selectedIndex = i;
        browser.tabmix_allowLoad = true;
        return true;
      }
      return false;
    });
  }

  /** @type {WhereToOpen} */
  var where = selectHelpPage() || tabBrowser.selectedTab.isEmpty ? "current" : "tab";

  if (!helpTopic) {
    var currentPane = prefWindow.currentPane;
    helpTopic = currentPane.helpTopic;
    if (currentPane.id == "paneSession") {
      helpTopic = $("session").parentNode.selectedTab.getAttribute("helpTopic") ?? "";
    }
  }
  helpTopic = helpTopic.toLowerCase().replace("mouse_-_", "").replace(/_-_|_/g, "-");
  recentWindow.openTrustedLinkIn(helpPage + "help/" + helpTopic, where);
}

function donate() {
  const recentWindow = Tabmix.getTopWin();
  const tabBrowser = recentWindow.gBrowser;
  const url = "https://ko-fi.com/M4M71J13A4";
  const where = tabBrowser.selectedTab.isEmpty ? "current" : "tab";
  recentWindow.openTrustedLinkIn(url, where);
}

window.gIncompatiblePane = {
  lastSelected: "paneLinks",
  _initialized: false,

  get paneButton() {
    return Tabmix.lazyGetter(
      this,
      "paneButton",
      prefWindow.getElementsByAttribute("pane", "paneIncompatible")[0]
    );
  },

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    let radioGroup = this.paneButton.parentNode;
    radioGroup.addEventListener("command", this);
    this.checkForIncompatible(false);
    gPrefWindow.initPane("paneIncompatible");
  },

  deinit() {
    let radioGroup = this.paneButton.parentNode;
    radioGroup.removeEventListener("command", this);
  },

  handleEvent(aEvent) {
    if (aEvent.type != "command") {
      return;
    }

    if (prefWindow.lastSelected != "paneIncompatible") {
      this.lastSelected = prefWindow.lastSelected;
    }
  },

  checkForIncompatible(aShowList) {
    const {CompatibilityCheck} = ChromeUtils.importESModule(
      "chrome://tabmix-resource/content/extensions/CompatibilityCheck.sys.mjs"
    );
    return new CompatibilityCheck(window, aShowList, true);
  },

  // call back function from CompatibilityCheck.sys.mjs
  hide_IncompatibleNotice(aHide, aFocus) {
    if (this.paneButton.collapsed != aHide) {
      this.paneButton.collapsed = aHide;
      $("paneIncompatible").collapsed = aHide;
    }
    Tabmix.setItem(this.paneButton, "show", !aHide);

    if (aHide && prefWindow.lastSelected == "paneIncompatible") {
      const pane = $Pane(this.lastSelected);
      prefWindow.showPane(pane);
    }

    if (aFocus) {
      window.focus();
    }
  },
};

ChromeUtils.defineLazyGetter(this, "RTL_UI", () => {
  return Services.locale.isAppLocaleRTL;
});

Tabmix.lazy_import(window, "Shortcuts", "Shortcuts", "Shortcuts");

function setDialog() {
  const preferences = customElements.get("preferences");
  if (preferences) {
    Object.defineProperty(preferences.prototype, "instantApply", {
      get: () => prefWindow.instantApply,
    });
  }
  customElements.define(
    "prefwindow",
    class PrefWindowNoInst extends PrefWindow {
      _instantApplyInitialized = true;

      instantApply = Tabmix.prefs.getBoolPref("instantApply");
    }
  );
  if (window.toString() == "[object Window]") {
    prefWindow.sizeToContent();
  }
}

function closeAll() {
  const subDialog =
    Services.wm.getMostRecentWindow("mozilla:tabmixopt-filetype") ??
    Services.wm.getMostRecentWindow("mozilla:tabmixopt-appearance");
  subDialog?.close();
  if (subDialog) {
    setTimeout(() => {
      window.close();
    }, 0);
  } else {
    window.close();
  }
}
