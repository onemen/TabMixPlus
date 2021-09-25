/* global PrefWindow */
/* exported defaultSetting, donate, exportData, importData, openHelp, setDialog,
            showPane, toggleInstantApply, toggleSyncPreference */
"use strict";

/***** Preference Dialog Functions *****/
var PrefFn = {0: "", 32: "CharPref", 64: "IntPref", 128: "BoolPref"};

this.$ = id => document.getElementById(id);

var gPrefWindow = {
  _initialized: false,
  set instantApply(val) {document.documentElement.instantApply = val;},
  get instantApply() {return document.documentElement.instantApply;},
  onContentLoaded() {
    const prefWindow = $("TabMIxPreferences");
    if (window.toString() != "[object ChromeWindow]") {
      prefWindow.style.display = "flex";
      prefWindow.setAttribute("in-tab", true);
    }
  },

  init() {
    this._initialized = true;

    var prefWindow = $("TabMIxPreferences");

    if (TabmixSvc.isMac)
      prefWindow.setAttribute("mac", true);
    else if (TabmixSvc.isLinux) {
      prefWindow.setAttribute("linux", true);
    }

    /* we don't need to fix tabpanels border in ubuntu */
    if (navigator.userAgent.toLowerCase().indexOf("ubuntu") > -1)
      prefWindow.setAttribute("ubuntu", true);

    var docElt = document.documentElement;

    // don't use browser.preferences.animateFadeIn
    Object.defineProperty(docElt, "_shouldAnimate", {
      value: false,
      writable: true,
      configurable: true
    });
    docElt.setAttribute("animated", "false");

    window.gIncompatiblePane.init(docElt);

    window.addEventListener("change", this);
    window.addEventListener("beforeaccept", this);

    gNumberInput.init();

    // init buttons extra1, extra2, accept, cancel
    docElt.getButton("extra1").setAttribute("icon", "apply");
    docElt.getButton("extra2").setAttribute("popup", "tm-settings");
    docElt.setAttribute("cancelbuttonlabel", docElt.mStrBundle.GetStringFromName("button-cancel"));
    this.setButtons(true);

    this.initBroadcasters("main");
    // hide broadcasters pane button
    var paneButton = docElt.getElementsByAttribute("pane", "broadcasters")[0];
    paneButton.collapsed = true;

    $("syncPrefs").setAttribute("checked", Tabmix.prefs.getBoolPref("syncPrefs"));
    $("instantApply").setAttribute("checked", Tabmix.prefs.getBoolPref("instantApply"));
    positionDonateButton();
  },

  initPane(aPaneID) {
    this.initBroadcasters(aPaneID);
    // let _selectPane method set width for first prefpane
    if (!this._initialized) {
      this.init();
      return;
    }
    let aPaneElement = $(aPaneID), diff = 0;
    let content = aPaneElement.getElementsByAttribute("class", "content-box")[0];
    let style = window.getComputedStyle(content);
    let contentWidth = parseInt(style.width) + parseInt(style.marginRight) +
      parseInt(style.marginLeft);
    let tabboxes = aPaneElement.getElementsByTagName("tabbox");
    for (let tabbox of tabboxes) {
      diff = Math.max(diff, tabbox.getBoundingClientRect().width - contentWidth);
    }
    window.innerWidth += diff;
  },

  deinit() {
    window.removeEventListener("change", this);
    window.removeEventListener("beforeaccept", this);
    delete Tabmix.getTopWin().tabmix_setSession;
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
        if (!this.instantApply)
          this.updateApplyButton(aEvent);
        break;
      case "beforeaccept":
        this.applyBlockedChanges();
        if (!this.instantApply) {
          // prevent TMP_SessionStore.setService from running
          Tabmix.getTopWin().tabmix_setSession = true;
          Shortcuts.prefsChangedByTabmix = true;
        }
        break;
    }
  },

  changes: new Set(),

  widthPrefs: ["pref_minWidth", "pref_maxWidth"],

  get widthChanged() {return this.isInChanges(this.widthPrefs);},

  set widthChanged(val) {
    this.updateChanges(val, this.widthPrefs);
  },

  isInChanges(list) {
    return list.some(prefOrId => {
      if (typeof prefOrId === "string") prefOrId = $(prefOrId);
      return this.changes.has(prefOrId);
    });
  },

  updateChanges(add, list) {
    if (!Array.isArray(list)) list = [list];
    const fnName = add ? "add" : "delete";
    for (let prefOrId of list) {
      if (typeof prefOrId === "string") prefOrId = $(prefOrId);
      this.changes[fnName](prefOrId);
    }
    this.setButtons(!this.changes.size);
  },

  // block change on instantApply, user is force to hit apply
  blockOnInstantApply(item) {
    if (!this.instantApply) {
      return undefined;
    }
    const preference = $(item.getAttribute("preference"));
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
      preference.value = preference.getValueByType(element);
    }
  },

  resetChanges() {
    // remove all pending changes
    if (this.changes.size) {
      if (this.widthChanged)
        gAppearancePane.resetWidthChange();
      for (let preference of this.changes) {
        this.changes.delete(preference);
        preference.value = preference.valueFromPreferences;
        if (preference.hasAttribute("notChecked"))
          delete preference._lastValue;
      }
      this.setButtons(true);
    }
  },

  updateApplyButton(aEvent) {
    var item = aEvent.target;
    if (item.localName != "preference")
      return;
    let valueChanged = item.value != item.valueFromPreferences;
    this.updateChanges(valueChanged, item);
  },

  onApply() {
    this.applyBlockedChanges();
    this.setButtons(true);
    if (this.instantApply)
      return;

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
    var docElt = document.documentElement;
    // when in instantApply mode apply and accept buttons are hidden except when user
    // change min/max width value
    var applyButton = docElt.getButton("extra1");
    applyButton.disabled = disable;
    applyButton.hidden = this.instantApply && disable;
    docElt.getButton("accept").hidden = disable;

    var action = disable ? "close" : "cancel";
    var cancelButton = docElt.getButton("cancel");
    cancelButton.label = docElt.getAttribute(action + "buttonlabel");
    cancelButton.setAttribute("icon", action);
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
    if (child.localName == "preference")
      Object.defineProperty(child, "preferences", {value: child.parentNode});
    child.remove();
  },

  initBroadcasters(paneID) {
    var broadcasters = $(paneID + ":Broadcaster");
    if (!broadcasters)
      return;
    for (let broadcaster of broadcasters.childNodes) {
      let preference = $(broadcaster.id.replace("obs", "pref"));
      if (preference)
        this.updateBroadcaster(preference, broadcaster);
    }
  },

  updateBroadcaster(aPreference, aBroadcaster) {
    if (aPreference.type != "bool" && !aPreference.hasAttribute("notChecked"))
      return;
    let broadcaster = aBroadcaster ||
      $(aPreference.id.replace("pref_", "obs_"));
    if (broadcaster) {
      let disable = aPreference.type == "bool" ? !aPreference.value :
        aPreference.value == parseInt(aPreference.getAttribute("notChecked"));
      this.setDisabled(broadcaster, disable);
    }
  },

  setDisabled(itemOrId, val) {
    var item = typeof (itemOrId) == "string" ? $(itemOrId) : itemOrId;
    if (!item)
      return;
    if (item.hasAttribute("inverseDependency"))
      val = !val;
    // remove disabled when the value is false
    Tabmix.setItem(item, "disabled", val || null);
  },

  tabSelectionChanged(event) {
    var tabs = event.target?.tabbox?.tabs;
    if (tabs?.localName != "tabs" || !tabs.tabbox.hasAttribute("onselect"))
      return;
    let preference = $("pref_" + tabs.id);
    if (!tabs._inited) {
      tabs._inited = true;
      if (preference.value !== null)
        tabs.selectedIndex = preference.value;
      else {
        let val = preference.valueFromPreferences;
        if (val !== null)
          tabs.selectedIndex = val;
      }
    } else if (preference.value != tabs.selectedIndex) {
      preference.valueFromPreferences = tabs.selectedIndex;
    }
  },

  afterShortcutsChanged() {
    Shortcuts.prefsChangedByTabmix = false;
    if (typeof gMenuPane == "object" &&
      $("pref_shortcuts").value != $("shortcut-group").value)
      gMenuPane.initializeShortcuts();
  },

  // syncfrompreference and synctopreference are for checkbox preference
  // controlled by int preference
  syncfrompreference(item) {
    let preference = $(item.getAttribute("preference"));
    return preference.value != parseInt(preference.getAttribute("notChecked"));
  },

  synctopreference(item, checkedVal) {
    let preference = $(item.getAttribute("preference"));
    let control = $(item.getAttribute("control"));
    let notChecked = parseInt(preference.getAttribute("notChecked"));
    let val = item.checked ? preference._lastValue || checkedVal : notChecked;
    preference._lastValue = control.value;
    return val;
  },
};

function getPrefByType(prefName) {
  try {
    var fn = PrefFn[Services.prefs.getPrefType(prefName)];
    if (fn == "CharPref") {
      return Services.prefs.getStringPref(prefName);
    }

    return Services.prefs["get" + fn](prefName);
  } catch (ex) {
    Tabmix.log("can't read preference " + prefName + "\n" + ex, true);
  }
  return null;
}

function setPrefByType(prefName, newValue, atImport) {
  let pref = {
    name: prefName,
    value: newValue,
    type: Services.prefs.getPrefType(prefName)
  };
  try {
    if (!atImport || !setPrefAfterImport(pref))
      setPref(pref);
  } catch (ex) {
    Tabmix.log("can't write preference " + prefName + "\nvalue " + pref.value +
      "\n" + ex, true);
  }
}

function setPref(aPref) {
  let fn = PrefFn[aPref.type];
  if (fn == "CharPref") {
    Services.prefs.setStringPref(aPref.name, aPref.value);
  } else {
    Services.prefs["set" + fn](aPref.name, aPref.value);
  }
}

function setPrefAfterImport(aPref) {
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
      if (aPref.value < 0 || aPref.value > 6)
        aPref.value = 6;
      aPref.value = [3, 5, 1, 1, 2, 4, 1][aPref.value];
      Tabmix.prefs.setIntPref("tabs.closeButtons", aPref.value);
      return true;
  }

  // don't do anything if user locked a preference
  if (Services.prefs.prefIsLocked(aPref.name))
    return true;
  // replace old preference by setting new value to it
  // and call gTMPprefObserver.updateSettings to replace it.
  if (aPref.type == Services.prefs.PREF_INVALID) {
    let val = parseInt(aPref.value);
    aPref.type = typeof val == "number" && !isNaN(val) ?
      64 : /true|false/i.test(aPref.value) ? 128 : 32;
    if (aPref.type == 128)
      aPref.value = /true/i.test(aPref.value);
    let prefsUtil = Tabmix.getTopWin().gTMPprefObserver;
    prefsUtil.preventUpdate = true;
    setPref(aPref);
    prefsUtil.preventUpdate = false;
    prefsUtil.updateSettings();
    // remove the preference in case updateSettings did not handle it
    Services.prefs.clearUserPref(aPref.name);
    return true;
  }
  if (aPref.type == Services.prefs.PREF_BOOL)
    aPref.value = /true/i.test(aPref.value);

  return false;
}

var sessionPrefs = ["browser.sessionstore.resume_from_crash",
  "browser.startup.page",
  "extensions.tabmix.sessions.manager",
  "extensions.tabmix.sessions.crashRecovery"];

XPCOMUtils.defineLazyGetter(this, "gPreferenceList", () => {
  // other settings not in extensions.tabmix. branch that we save
  let otherPrefs = [
    "browser.allTabs.previews", TabmixSvc.sortByRecentlyUsed,
    "browser.link.open_newwindow", "browser.link.open_newwindow.override.external",
    "browser.link.open_newwindow.restriction", TabmixSvc.newtabUrl,
    "browser.search.context.loadInBackground", "browser.search.openintab",
    "browser.sessionstore.interval", "browser.sessionstore.max_tabs_undo",
    "browser.sessionstore.privacy_level",
    "browser.sessionstore.restore_on_demand",
    "browser.sessionstore.resume_from_crash", "browser.startup.page",
    "browser.tabs.closeWindowWithLastTab",
    "browser.tabs.insertAfterCurrent",
    "browser.tabs.insertRelatedAfterCurrent", "browser.tabs.loadBookmarksInBackground",
    "browser.tabs.loadDivertedInBackground", "browser.tabs.loadInBackground",
    "browser.tabs.tabClipWidth", "browser.tabs.tabMaxWidth", "browser.tabs.tabMinWidth",
    "browser.tabs.warnOnClose", "browser.warnOnQuit",
    "browser.tabs.warnOnCloseOtherTabs",
    "toolkit.scrollbox.clickToScroll.scrollDelay", "toolkit.scrollbox.smoothScroll"
  ];

  let prefs = Services.prefs.getDefaultBranch("");
  let tabmixPrefs = Services.prefs.getChildList("extensions.tabmix.").sort();
  // filter out preference without default value
  tabmixPrefs = otherPrefs.concat(tabmixPrefs).filter(pref => {
    try {
      return prefs["get" + PrefFn[prefs.getPrefType(pref)]](pref) !== undefined;
    } catch (ex) { }
    return false;
  });
  return tabmixPrefs;
});

XPCOMUtils.defineLazyGetter(this, "_sminstalled", () => {
  return Tabmix.getTopWin().Tabmix.extensions.sessionManager;
});

function defaultSetting() {
  gPrefWindow.resetChanges();
  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);
  Shortcuts.prefsChangedByTabmix = true;
  let SMinstalled = _sminstalled;
  let prefs = !SMinstalled ? gPreferenceList :
    gPreferenceList.map(pref => !sessionPrefs.includes(pref));
  prefs.forEach(pref => {
    Services.prefs.clearUserPref(pref);
  });
  // we enable our session manager on default
  // set resume_from_crash to false
  Services.prefs.setBoolPref("browser.sessionstore.resume_from_crash", false);

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

  if (Tabmix.prefs.getBoolPref('instantApply') !== checked) {
    menuItem.setAttribute("checked", !checked);
    document.documentElement.instantApply = !checked;
  }
  gPrefWindow.setButtons(!gPrefWindow.changes.size);
}

function toggleInstantApply(item) {
  const preference = $("pref_instantApply");
  if (preference._running) return;
  const checked = item.localName === "menuitem" ?
    item.getAttribute("checked") === "true" : item.value;

  // apply all pending changes before we change mode to instantApply
  if (checked) gPrefWindow.onApply();

  document.documentElement.instantApply = checked;
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
    dlgbuttons.parentNode.insertBefore(donateBox, dlgbuttons);
  }
  if (window.toString() === "[object Window]") window.sizeToContent();
}

function toggleSyncPreference() {
  const sync = "services.sync.prefs.sync.";
  let fn = Tabmix.prefs.getBoolPref("syncPrefs") ? "clearUserPref" : "setBoolPref";
  Tabmix.prefs[fn]("syncPrefs", true);
  let exclude = ["extensions.tabmix.sessions.onStart.sessionpath"];
  gPreferenceList.forEach(pref => {
    if (!exclude.includes(pref))
      Services.prefs[fn](sync + pref, true);
  });
  Services.prefs.savePrefFile(null);
}

function exportData() {
  // save all pending changes
  gPrefWindow.onApply();
  showFilePicker("save").then(file => {
    if (file) {
      let patterns = gPreferenceList.map(pref => {
        return "\n" + pref + "=" + getPrefByType(pref);
      });
      patterns.unshift("tabmixplus");
      if (TabmixSvc.version(860)) {
        IOUtils.writeUTF8(file.path, patterns.join(""));
      } else {
        // eslint-disable-next-line mozilla/reject-osfile
        OS.File.writeAtomic(file.path, patterns.join(""), {encoding: "utf-8", tmpPath: file.path + ".tmp"});
      }
    }
  }).catch(Tabmix.reportError);
}

async function importData() {
  try {
    const file = await showFilePicker("open");
    if (!file) return;
    let input;
    if (TabmixSvc.version(860)) {
      input = await IOUtils.readUTF8(file.path);
    } else {
      // eslint-disable-next-line mozilla/reject-osfile
      const data = await OS.File.read(file.path);
      let decoder = new TextDecoder();
      input = decoder.decode(data || "");
    }
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
 * @param mode
 *        The mode for the file picker: open|save
 *
 * @return Promise<{nsILocalFile}>
 */
function showFilePicker(mode) {
  const nsIFilePicker = Ci.nsIFilePicker;
  var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  if (mode == "open")
    mode = nsIFilePicker.modeOpen;
  else {
    fp.defaultExtension = "txt";
    fp.defaultString = "TMPpref";
    mode = nsIFilePicker.modeSave;
  }
  fp.init(window, null, mode);
  fp.appendFilters(nsIFilePicker.filterText);
  return AsyncUtils.spawnFn(fp, fp.open).then(aResult => {
    return aResult != nsIFilePicker.returnCancel ? fp.file : null;
  });
}

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

  // disable both Firefox & Tabmix session manager to prevent our prefs observer to block the change
  let SMinstalled = _sminstalled;
  if (!SMinstalled) {
    Tabmix.prefs.setBoolPref("sessions.manager", false);
    Tabmix.prefs.setBoolPref("sessions.crashRecovery", false);
    Services.prefs.setBoolPref("browser.sessionstore.resume_from_crash", false);
    Services.prefs.setIntPref("browser.startup.page", 0);
    Services.prefs.savePrefFile(null);
  }

  // set updateOpenedTabsLockState before lockallTabs and lockAppTabs
  let pref = "extensions.tabmix.updateOpenedTabsLockState=";
  let index = pattern.indexOf(pref + true) + pattern.indexOf(pref + false) + 1;
  if (index > 0)
    pattern.splice(1, 0, pattern.splice(index, 1)[0]);

  var prefName, prefValue;
  Shortcuts.prefsChangedByTabmix = true;
  for (let i = 1; i < pattern.length; i++) {
    let valIndex = pattern[i].indexOf("=");
    if (valIndex > 0) {
      prefName = pattern[i].substring(0, valIndex);
      if (!SMinstalled || !sessionPrefs.includes(prefName)) {
        prefValue = pattern[i].substring(valIndex + 1, pattern[i].length);
        setPrefByType(prefName, prefValue, true);
      }
    }
  }
  gPrefWindow.afterShortcutsChanged();
  var browserWindow = Tabmix.getTopWin();
  browserWindow.gTMPprefObserver.updateTabClickingOptions();
  Tabmix.prefs.clearUserPref("setDefault");
  Services.prefs.savePrefFile(null);
  updateInstantApply();
}

// this function is called from Tabmix.openOptionsDialog if the dialog already opened
function showPane(paneID) {
  let docElt = document.documentElement;
  let paneToLoad = document.getElementById(paneID);
  if (!paneToLoad || paneToLoad.nodeName != "prefpane")
    paneToLoad = $(docElt.lastSelected);
  docElt.showPane(paneToLoad);
}

function openHelp(helpTopic) {
  var helpPage = "http://tabmixplus.org/support/viewtopic.php?t=3&p=";
  // Check if the help page already open in the top window
  var recentWindow = Tabmix.getTopWin();
  var tabBrowser = recentWindow.gBrowser;
  function selectHelpPage() {
    let browsers = tabBrowser.browsers;
    for (let i = 0; i < browsers.length; i++) {
      let browser = browsers[i];
      if (browser.currentURI.spec.startsWith(helpPage)) {
        tabBrowser.tabContainer.selectedIndex = i;
        browser.tabmix_allowLoad = true;
        return true;
      }
    }
    return false;
  }
  var where = selectHelpPage() ||
    tabBrowser.selectedTab.isEmpty ? "current" : "tab";

  if (!helpTopic) {
    var currentPane = document.documentElement.currentPane;
    helpTopic = currentPane.helpTopic;
    if (currentPane.id == "paneSession") {
      helpTopic = $("session").parentNode.selectedTab.getAttribute("helpTopic");
    }
  }
  helpTopic = helpTopic.toLowerCase().replace("mouse_-_", "").replace(/_-_|_/g, "-");
  recentWindow.openTrustedLinkIn(helpPage + helpTopic, where);
}

function donate() {
  const recentWindow = Tabmix.getTopWin();
  const tabBrowser = recentWindow.gBrowser;
  const url = "https://www.paypal.com/donate?hosted_button_id=W25388CZ3MNU8";
  const where = tabBrowser.selectedTab.isEmpty ? "current" : "tab";
  recentWindow.openTrustedLinkIn(url, where);
}

window.gIncompatiblePane = {
  lastSelected: "paneLinks",

  init(docElt) {
    this.paneButton = docElt.getElementsByAttribute("pane", "paneIncompatible")[0];
    let radioGroup = this.paneButton.parentNode;
    radioGroup.addEventListener("command", this);
    this.checkForIncompatible(false);
  },

  deinit() {
    let radioGroup = this.paneButton.parentNode;
    radioGroup.removeEventListener("command", this);
  },

  handleEvent(aEvent) {
    if (aEvent.type != "command")
      return;
    let prefWindow = document.documentElement;
    if (prefWindow.lastSelected != "paneIncompatible")
      this.lastSelected = prefWindow.lastSelected;
  },

  checkForIncompatible(aShowList) {
    let tmp = {};
    ChromeUtils.import("chrome://tabmix-resource/content/extensions/CompatibilityCheck.jsm", tmp);
    tmp = new tmp.CompatibilityCheck(window, aShowList, true);
  },

  // call back function from CompatibilityCheck.jsm
  hide_IncompatibleNotice(aHide, aFocus) {
    if (this.paneButton.collapsed != aHide) {
      this.paneButton.collapsed = aHide;
      $("paneIncompatible").collapsed = aHide;
    }
    Tabmix.setItem(this.paneButton, "show", !aHide);

    if (aHide && document.documentElement.lastSelected == "paneIncompatible")
      document.documentElement.showPane($(this.lastSelected));

    if (aFocus)
      window.focus();
  }

};

XPCOMUtils.defineLazyGetter(gPrefWindow, "pinTabLabel", () => {
  let win = Tabmix.getTopWin();
  return win.document.getElementById("context_pinTab").getAttribute("label") + "/" +
    win.document.getElementById("context_unpinTab").getAttribute("label");
});

ChromeUtils.defineModuleGetter(this, "OS", "resource://gre/modules/osfile.jsm");

ChromeUtils.defineModuleGetter(this, "AsyncUtils",
  "chrome://tabmix-resource/content/AsyncUtils.jsm");

// eslint-disable-next-line no-unused-vars
XPCOMUtils.defineLazyGetter(this, "RTL_UI", () => {
  return Services.locale.isAppLocaleRTL;
});

Tabmix.lazy_import(window, "Shortcuts", "Shortcuts", "Shortcuts");

gPrefWindow.onContentLoaded();

function setDialog() {
  Object.defineProperty(customElements.get('preferences').prototype, 'instantApply', {get: () => document.documentElement.instantApply});
  customElements.define('prefwindow', class PrefWindowNoInst extends PrefWindow {
    _instantApplyInitialized = true;
    instantApply = Tabmix.prefs.getBoolPref('instantApply');
  });
  if (window.toString() == '[object ChromeWindow]') window.sizeToContent();
}

// avoid opening prefs in tab, workaround to bug 1414406
(function x() {
  /* eslint no-var: 2, prefer-const: 2 */
  const chromewin = window.docShell.rootTreeItem.domWindow;
  if (chromewin.location.href !== 'chrome://tabmixplus/content/preferences/preferences.xhtml') {
    const gBrowser = chromewin.gBrowser;
    const kcTab = gBrowser.selectedTab;
    let previousTab;
    let lastAccessed = 0;
    for (const tab of gBrowser.tabs) {
      if (!tab._notselectedsinceload && !tab.getAttribute('pending') && tab._lastAccessed > lastAccessed && tab != kcTab) {
        lastAccessed = tab._lastAccessed;
        previousTab = tab;
      }
    }
    gBrowser.selectedTab = previousTab;

    chromewin.setTimeout(() => {
      gBrowser.ownerGlobal.Tabmix.openOptionsDialog(-1);
    }, 0);

    gBrowser.removeTab(kcTab);
  } else {
    setTimeout(() => {
      const navwin = Services.wm.getMostRecentWindow('navigator:browser');
      const data = TabmixSvc.SessionStore._windows[navwin.__SSi];
      if (data._closedTabs && data._closedTabs.length && data._closedTabs[0].state.entries[0].url === 'chrome://tabmixplus/content/preferences/preferences.xhtml')
        data._closedTabs.shift();
    }, 0);
  }
  /* eslint no-var: 0, prefer-const: 0 */
}());
