"use strict";

/***** Preference Dialog Functions *****/
const Cc = Components.classes;
const Ci = Components.interfaces;
const PrefFn = {0: "", 32: "CharPref", 64: "IntPref", 128: "BoolPref"};

function $(id) document.getElementById(id);

var gPrefWindow = {
  _initialized: false,
  init: function() {
    this._initialized = true;

    /* Chromifox theme force button height to 25px */
    var skin = Services.prefs.getCharPref("general.skins.selectedSkin");
    if (skin == "cfxec")
      prefWindow.setAttribute("chromifox", true);

    var prefWindow = $("TabMIxPreferences");
    if (TabmixSvc.isMac)
      prefWindow.setAttribute("mac", true);
    else if (TabmixSvc.isLinux) {
      prefWindow.setAttribute("linux", true);
      if (skin == "ftdeepdark")
        prefWindow.setAttribute("ftdeepdark", true);
    }

    /* we don't need to fix tabpanels border in ubuntu */
    if (navigator.userAgent.toLowerCase().indexOf("ubuntu") > -1)
      prefWindow.setAttribute("ubuntu", true);

    var browserWindow = Tabmix.getTopWin();
    var docElt = document.documentElement;

    // don't use browser.preferences.animateFadeIn
    Object.defineProperty(docElt, "_shouldAnimate", {value: false,
                          writable: true, configurable: true});
    docElt.setAttribute("animated", "false");

    gIncompatiblePane.init(docElt);

    this.instantApply = docElt.instantApply;
    window.addEventListener("change", this, false);
    window.addEventListener("beforeaccept", this, false);

    // init buttons extra1, extra2, accept, cancel
    docElt.getButton("extra1").setAttribute("icon", "apply");
    docElt.getButton("extra2").setAttribute("popup","tm-settings");
    docElt.setAttribute("cancelbuttonlabel", docElt.mStrBundle.GetStringFromName("button-cancel"));
    this.setButtons(true);

    this.initBroadcasters("main");
    // hide broadcasters pane button
    var paneButton = document.getAnonymousElementByAttribute(docElt, "pane", "broadcasters");
    paneButton.collapsed = true;

    $("syncPrefs").setAttribute("checked", Tabmix.prefs.getBoolPref("syncPrefs"));
  },

  initPane: function(aPaneID) {
    this.initBroadcasters(aPaneID);
    // let _selectPane method set width for first prefpane
    if (!this._initialized) {
      this.init();
      return;
    }
    let aPaneElement = $(aPaneID), diff = 0;
    let content = document.getAnonymousElementByAttribute(aPaneElement, "class", "content-box");
    let style = window.getComputedStyle(content, "");
    let contentWidth = parseInt(style.width) + parseInt(style.marginRight) +
                       parseInt(style.marginLeft);
    Array.slice(aPaneElement.getElementsByTagName("tabbox")).forEach(function(tabbox) {
      diff = Math.max(diff, tabbox.boxObject.width - contentWidth);
    });
    window.innerWidth += diff;
  },

  deinit: function() {
    window.removeEventListener("change", this, false);
    window.removeEventListener("beforeaccept", this, false);
    delete Tabmix.getTopWin().tabmix_setSession;
    Shortcuts.prefsChangedByTabmix = false;
    gIncompatiblePane.deinit();
  },

  handleEvent: function(aEvent) {
    switch (aEvent.type) {
    case "change":
      if (aEvent.target.localName != "preference")
        return;
      this.updateBroadcasters(aEvent.target);
      if (!this.instantApply)
        this.updateApplyButton(aEvent);
      break;
    case "beforeaccept":
      if (typeof gAppearancePane == "object")
        gAppearancePane.changeTabsWidth();
      if (!this.instantApply) {
        // prevent TMP_SessionStore.setService from runing
        Tabmix.getTopWin().tabmix_setSession = true;
        Shortcuts.prefsChangedByTabmix = true;
      }
      break;
    }
  },

  changes: [],
  updateApplyButton: function(aEvent) {
    var item = aEvent.target;
    if (item.localName != "preference")
      return;
    let valueChanged = item.value != item.valueFromPreferences;
    let index = this.changes.indexOf(item);
    if (valueChanged && index == -1)
      this.changes.push(item);
    else if (!valueChanged && index > -1)
      this.changes.splice(index, 1);
    this.setButtons(!this.changes.length);
  },

  onApply: function() {
    this.setButtons(true);
    if (typeof gAppearancePane == "object")
      gAppearancePane.changeTabsWidth();
    if (this.instantApply)
      return;

    // set flag to prevent TabmixTabbar.updateSettings from run for each change
    Tabmix.prefs.setBoolPref("setDefault", true);
    Shortcuts.prefsChangedByTabmix = true;
    // Write all values to preferences.
    while (this.changes.length) {
      var preference = this.changes.shift();
      preference.batching = true;
      preference.valueFromPreferences = preference.value;
      preference.batching = false;
    }
    gPrefWindow.afterShortcutsChanged();
    Tabmix.prefs.clearUserPref("setDefault"); // this trigger TabmixTabbar.updateSettings
    Services.prefs.savePrefFile(null);
  },

  setButtons: function(disable) {
    var docElt = document.documentElement;
    // when in instantApply mode apply and accept buttons are hidden except when user
    // change min/max width value
    var applyButton = docElt.getButton("extra1");
    applyButton.disabled = disable;
    applyButton.hidden = this.instantApply && disable;
    docElt.getButton("accept").hidden = disable;

    var action = disable ? "close" : "cancel"
    var cancelButton = docElt.getButton("cancel");
    cancelButton.label = docElt.getAttribute(action + "buttonlabel");
    cancelButton.setAttribute("icon", action);
  },

  removeChild: function(id) {
    let child = $(id);
    // override preferences getter before we remove the preference
    if (child.localName == "preference")
      Object.defineProperty(child, "preferences", {value: child.parentNode});
    child.parentNode.removeChild(child);
  },

  initBroadcasters: function(paneID) {
    var broadcasters = $(paneID + ":Broadcaster");
    if (!broadcasters)
      return;
    Array.forEach(broadcasters.childNodes, function (broadcaster) {
      let preference = $(broadcaster.id.replace("obs", "pref"));
      if (preference)
        this.setDisabled(broadcaster, !preference.value);
    }, this);
  },

  updateBroadcasters: function(aPreference) {
    if (aPreference.type != "bool")
      return;
    let obs = $(aPreference.id.replace("pref_", "obs_"));
    if (obs)
      this.setDisabled(obs, !aPreference.value);
  },

  setDisabled: function(itemOrId, val) {
    var item = typeof(itemOrId) == "string" ? $(itemOrId) : itemOrId;
    if (!item)
      return;
    if (item.hasAttribute("inverseDependency"))
      val = !val;
    // remove disabled when the value is false
    Tabmix.setItem(item, "disabled" , val || null);
  },

  tabSelectionChanged: function(event) {
    var tabs = event.target;
    if (tabs.localName != "tabs" || !tabs.hasAttribute("onselect"))
      return;
    let preference = $("pref_" + tabs.id);
    if (!tabs._inited) {
      tabs._inited = true;
      if (preference.value != null)
        tabs.selectedIndex = preference.value;
    }
    else if (preference.value != tabs.selectedIndex)
      preference.valueFromPreferences = tabs.selectedIndex;
  },

  afterShortcutsChanged: function() {
    Shortcuts.prefsChangedByTabmix = false;
    if (typeof gMenuPane == "object" &&
        $("pref_shortcuts").value != $("shortcut-group").value)
      gMenuPane.initializeShortcuts();
  }
}

function getPrefByType(prefName) {
  try {
    var fn = PrefFn[Services.prefs.getPrefType(prefName)];
    if (fn == "CharPref")
      return Services.prefs.getComplexValue(prefName, Ci.nsISupportsString).data;
    else
      return Services.prefs["get" + fn](prefName);
  } catch (ex) {
    Tabmix.log("can't read preference " + prefName + "\n" + ex, true);
  }
  return null;
}

function setPrefByType(prefName, newValue, atImport) {
  let pref = {name: prefName, value: newValue,
              type: Services.prefs.getPrefType(prefName)}
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
    let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
    str.data = aPref.value;
    Services.prefs.setComplexValue(aPref.name, Ci.nsISupportsString, str);
  }
  else
    Services.prefs["set" + fn](aPref.name, aPref.value);
}

function setPrefAfterImport(aPref) {
  // in prev version we use " " for to export string to file
  aPref.value = aPref.value.replace(/^"*|"*$/g, "");

  // preference that exist in the defaulbranch but no longer in use by Tabmix
  switch (aPref.name) {
  case "browser.tabs.autoHide":
    // from tabmix 0.3.6.0.080223 we use extensions.tabmix.hideTabbar
    Tabmix.prefs.setIntPref("hideTabbar", aPref.value ? 1 : 0);
    return true;
  case "browser.tabs.closeButtons":
    // we use browser.tabs.closeButtons only in 0.3.8.3
    if (aPref.value < 0 || aPref.value > 6)
      aPref.value = 6;
    aPref.value = [3,5,1,1,2,4,1][aPref.value];
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

XPCOMUtils.defineLazyGetter(window, "gPreferenceList", function() {
  // other settings not in extensions.tabmix. branch that we save
  let otherPrefs = ["browser.allTabs.previews","browser.ctrlTab.previews",
  "browser.link.open_newwindow","browser.link.open_newwindow.override.external",
  "browser.link.open_newwindow.restriction","browser.newtab.url",
  "browser.search.context.loadInBackground","browser.search.openintab",
  "browser.sessionstore.interval","browser.sessionstore.max_tabs_undo",
  "browser.sessionstore.postdata","browser.sessionstore.privacy_level",
  "browser.sessionstore.resume_from_crash","browser.startup.page",
  "browser.tabs.animate","browser.tabs.closeWindowWithLastTab",
  "browser.tabs.insertRelatedAfterCurrent","browser.tabs.loadBookmarksInBackground",
  "browser.tabs.loadDivertedInBackground","browser.tabs.loadInBackground",
  "browser.tabs.tabClipWidth","browser.tabs.tabMaxWidth","browser.tabs.tabMinWidth",
  "browser.tabs.warnOnClose","browser.warnOnQuit",
  "toolkit.scrollbox.clickToScroll.scrollDelay","toolkit.scrollbox.smoothScroll"];

  if (!Tabmix.isVersion(200))
    otherPrefs.push("browser.warnOnRestart");

  let prefs = Services.prefs.getDefaultBranch("");
  let tabmixPrefs = Services.prefs.getChildList("extensions.tabmix.").sort();
  // filter out preference without default value
  tabmixPrefs = otherPrefs.concat(tabmixPrefs).filter(function(pref){
    try {
      return prefs["get" + PrefFn[prefs.getPrefType(pref)]](pref) != undefined;
    } catch (ex) { }
    return false;
  });
  return tabmixPrefs;
});

function defaultSetting() {
  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);
  Shortcuts.prefsChangedByTabmix = true;
  gPreferenceList.forEach(function(pref) {
    Services.prefs.clearUserPref(pref);
  });
  // we enable our session manager on default
  // set resume_from_crash to false
  Services.prefs.setBoolPref("browser.sessionstore.resume_from_crash", false);

  gPrefWindow.afterShortcutsChanged();
  Tabmix.prefs.clearUserPref("setDefault");
  Services.prefs.savePrefFile(null);
}

function toggleSyncPreference() {
  const sync = "services.sync.prefs.sync.";
  let fn = Tabmix.prefs.getBoolPref("syncPrefs") ? "clearUserPref" : "setBoolPref";
  Tabmix.prefs[fn]("syncPrefs", true);
  gPreferenceList.forEach(function(pref) {
    Services.prefs[fn](sync + pref, true);
  });
  Services.prefs.savePrefFile(null);
}

function exportData() {
  // save all pending changes
  gPrefWindow.onApply();

  let patterns = gPreferenceList.map(function(pref) {
    return pref + "=" + getPrefByType(pref) + "\n";
  });
  patterns[patterns.length-1] = patterns[patterns.length-1].replace(/\n$/, "");
  patterns.unshift("tabmixplus\n");

  function exportCallback(aFile) {
    if (!/\.txt$/.test(aFile.leafName.toLowerCase()))
      aFile.leafName += ".txt";
    if (aFile.exists())
      aFile.remove(true);
    aFile.create(aFile.NORMAL_FILE_TYPE, parseInt("0666", 8));
    let stream = Cc["@mozilla.org/network/file-output-stream;1"].
                  createInstance(Ci.nsIFileOutputStream);
    stream.init(aFile, 0x02, 0x200, null);
    for (let i = 0; i < patterns.length ; i++)
      stream.write(patterns[i], patterns[i].length);
    stream.close();
  }
  showFilePicker("save", exportCallback);
}

function importData () {
  function importCallback(aFile) {
    let stream = Cc["@mozilla.org/network/file-input-stream;1"].
                createInstance(Ci.nsIFileInputStream);
    stream.init(aFile, 0x01, parseInt("0444", 8), null);
    let streamIO = Cc["@mozilla.org/scriptableinputstream;1"].
                createInstance(Ci.nsIScriptableInputStream);
    streamIO.init(stream);
    let input = streamIO.read(stream.available());
    streamIO.close();
    stream.close();
    if (input)
      loadData(input.replace(/\r\n/g, "\n").split("\n"));
  }

  showFilePicker("open", importCallback);
}

function showFilePicker(mode, callback) {
  const nsIFilePicker = Ci.nsIFilePicker;
  var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  function fpCallback(aResult) {
    if (aResult != nsIFilePicker.returnCancel)
      callback(fp.file);
  }

  if (mode == "open")
    mode = nsIFilePicker.modeOpen;
  else {
    fp.defaultExtension = "txt";
    fp.defaultString = "TMPpref";
    mode = nsIFilePicker.modeSave;
  }
  fp.init(window, null, mode);
  fp.appendFilters(nsIFilePicker.filterText);
  if (Tabmix.isVersion(180))
    fp.open(fpCallback);
  else
    fpCallback(fp.show());
}

function loadData (pattern) {
  if (pattern[0]!="tabmixplus") {
    //  Can not import because it is not a valid file.
    alert(TabmixSvc.getString("tmp.importPref.error1"));
    return;
  }

  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);

  // disable both Firefox & Tabmix session manager to prevent our prefs observer to block the change
  Tabmix.prefs.setBoolPref("sessions.manager", false);
  Tabmix.prefs.setBoolPref("sessions.crashRecovery", false);
  Services.prefs.setBoolPref("browser.sessionstore.resume_from_crash", false);
  Services.prefs.setIntPref("browser.startup.page", false);
  Services.prefs.savePrefFile(null);

  // set updateOpenedTabsLockState before lockallTabs and lockAppTabs
  let pref = "extensions.tabmix.updateOpenedTabsLockState=";
  let index = pattern.indexOf(pref + true) + pattern.indexOf(pref + false) + 1;
  if (index > 0)
    pattern.splice(1, 0, pattern.splice(index, 1)[0]);

  var prefName, prefValue;
  Shortcuts.prefsChangedByTabmix = true;
  for (let i = 1; i < pattern.length; i++){
    let index = pattern[i].indexOf("=");
    if (index > 0){
      prefName  = pattern[i].substring(0,index);
      prefValue = pattern[i].substring(index+1,pattern[i].length);
      setPrefByType(prefName, prefValue, true);
    }
  }
  gPrefWindow.afterShortcutsChanged();
  var browserWindow = Tabmix.getTopWin();
  browserWindow.gTMPprefObserver.updateTabClickingOptions();
  Tabmix.prefs.clearUserPref("setDefault");
  Services.prefs.savePrefFile(null);
}

// this function is called from Tabmix.openOptionsDialog if the dialog already opened
function showPane(paneID) {
  let docElt = document.documentElement;
  let paneToLoad = document.getElementById(paneID);
  if(!paneToLoad || paneToLoad.nodeName != "prefpane")
    paneToLoad = $(docElt.lastSelected);
  docElt.showPane(paneToLoad);
}

function openHelp(helpTopic) {
  var helpPage = "http://tmp.garyr.net/help/#"
  // Check if the help page already open in the top window
  var recentWindow = Tabmix.getTopWin();
  var tabBrowser = recentWindow.gBrowser;
  function selectHelpPage() {
    let browsers = tabBrowser.browsers;
    for (let i = 0; i < browsers.length; i++) {
      let browser = browsers[i];
      if (browser.currentURI.spec.indexOf(helpPage) == 0) {
        tabBrowser.tabContainer.selectedIndex = i;
        return true;
      }
    }
    return false;
  }
  var where = selectHelpPage() ||
    recentWindow.isTabEmpty(tabBrowser.selectedTab) ? "current" : "tab";

  if (!helpTopic) {
    var currentPane = document.documentElement.currentPane;
    helpTopic = currentPane.helpTopic;
    if (currentPane.id == "paneSession" && helpTopic == "tabmix")
      helpTopic = $("session").parentNode.selectedTab.getAttribute("helpTopic");
  }

  recentWindow.openUILinkIn(helpPage + helpTopic, where);
}

var gIncompatiblePane = {
  lastSelected: "paneLinks",

  init: function (docElt) {
    this.paneButton = document.getAnonymousElementByAttribute(docElt, "pane", "paneIncompatible");
    let radioGroup = this.paneButton.parentNode;
    radioGroup.addEventListener("command", this, false);
    this.checkForIncompatible(false);
  },

  deinit: function() {
    let radioGroup = this.paneButton.parentNode;
    radioGroup.removeEventListener("command", this, false);
  },

  handleEvent: function (aEvent) {
    if (aEvent.type != "command")
      return;
    let prefWindow = document.documentElement;
    if (prefWindow.lastSelected != "paneIncompatible")
      this.lastSelected = prefWindow.lastSelected;
  },

  checkForIncompatible: function (aShowList) {
     let tmp = { };
     Components.utils.import("resource://tabmixplus/extensions/CompatibilityCheck.jsm", tmp);
     new tmp.CompatibilityCheck(window, aShowList, true);
  },

  // call back function from CompatibilityCheck.jsm
  hide_IncompatibleNotice: function (aHide, aFocus) {
    if (this.paneButton.collapsed != aHide) {
      this.paneButton.collapsed = aHide;
      $("paneIncompatible").collapsed = aHide;
    }
    Tabmix.setItem(this.paneButton, "show", !aHide)

    if (aHide && document.documentElement.lastSelected == "paneIncompatible")
      document.documentElement.showPane($(this.lastSelected));

    if (aFocus)
      window.focus();
  }

}

XPCOMUtils.defineLazyGetter(gPrefWindow, "pinTabLabel", function() {
  let win = Tabmix.getTopWin();
  return win.document.getElementById("context_pinTab").getAttribute("label") + "/" +
         win.document.getElementById("context_unpinTab").getAttribute("label");
});

Tabmix.lazy_import(window, "Shortcuts", "Shortcuts", "Shortcuts");
