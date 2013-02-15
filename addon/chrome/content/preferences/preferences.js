/***** Preference Dialog Functions *****/
const Cc = Components.classes;
const Ci = Components.interfaces;
const pBranch = Ci.nsIPrefBranch;
const PrefFn = {0: "", 32: "CharPref", 64: "IntPref", 128: "BoolPref"};

function $(id) document.getElementById(id);

var gPrefWindow = {
  _initialized: false,
  init: function() {
    this._initialized = true;
    /*XXX TODO on init:
      check on mac if i need to set
      tabpanels#tabpanId[Mac] .tabs-hidden > tab {
        margin-top: 2px;
      }
    */

    /* Chromifox theme force button height to 25px */
    var skin = Services.prefs.getCharPref("general.skins.selectedSkin");
    if (skin == "cfxec")
      $("TabMIxPreferences").setAttribute("chromifox", true);

    /* we don't need to fix tabpanels border in ubuntu */
    if (navigator.userAgent.toLowerCase().indexOf("ubuntu") > -1)
      $("TabMIxPreferences").setAttribute("ubuntu", true);

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

    // always init the apply button for the case user change tab width
    this.applyButton = docElt.getButton("extra1");
    if (this.instantApply)
      this.applyButton.hidden = true;
    else
      this.applyButton.disabled = true;

    var settingsButton = docElt.getButton("extra2");
    settingsButton.setAttribute("popup","tm-settings");

    this.initBroadcasters("main");
    // hide broadcasters pane button
    var paneButton = document.getAnonymousElementByAttribute(docElt, "pane", "broadcasters");
    paneButton.collapsed = true;
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
    this.applyButton.disabled = !this.changes.length;
  },

  onApply: function() {
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
    Shortcuts.prefsChangedByTabmix = false;
    Tabmix.prefs.clearUserPref("setDefault"); // this trigger TabmixTabbar.updateSettings
    Services.prefs.savePrefFile(null);
    this.applyButton.disabled = true;
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
  }
}

function getPrefByType(prefName) {
  try {
    var fn = PrefFn[Services.prefs.getPrefType(prefName)];
    return Services.prefs["get" + fn](prefName);
  } catch (ex) {
    Tabmix.log("can't read preference " + prefName + "\n" + ex, true);
  }
  return null;
}

function setPrefByType(prefName, newValue, atImport) {
  try {
    _setPrefByType(prefName, newValue, atImport)
  } catch (ex) {
    Tabmix.log("can't write preference " + prefName + "\nvalue " + newValue, true);
  }
}

function _setPrefByType(prefName, newValue, atImport) {
  let prefType = Services.prefs.getPrefType(prefName);
  // when we import from old saved file, we need to replace old pref that are not in use.
  // we also check for locked pref for the case user locked pref that we replaced
  if (atImport && (prefType == Services.prefs.PREF_INVALID ||
      Services.prefs.prefIsLocked(prefName))) {
    switch (prefName) {
    // in 0.3.0.605 we changed tab color from old pref to new pref
    // old pref "extensions.tabmix.currentColor" type integer
    // new pref "extensions.tabmix.currentColorCode" type string
    case "extensions.tabmix.currentColor":
    case "extensions.tabmix.unreadColor":
    case "extensions.tabmix.progressColor":
      var colorCodes = ["#CF1919", "#0E36EF", "#DDDF0D", "#3F8F3E", "#E066FF", "#86E7EF",
        "#FFFFFF", "#7F7F7F", "#000000", "#EF952C", "#FF82AB", "#7F4C0F", "#AAAAFF"]
      newValue = colorCodes[newValue];
      prefName = prefName + "Code";
    // in 0.3.7.4 2008-12-24 we combined all style pref into one per type
    // extensions.tabmix.styles.[TYPE NAME]
    case "extensions.tabmix.boldUnread":
    case "extensions.tabmix.italicUnread":
    case "extensions.tabmix.underlineUnread":
    case "extensions.tabmix.boldCurrent":
    case "extensions.tabmix.italicCurrent":
    case "extensions.tabmix.underlineCurrent":
    case "extensions.tabmix.unreadColorCode":
    case "extensions.tabmix.currentColorCode":
    case "extensions.tabmix.progressColorCode":
    case "extensions.tabmix.useCurrentColor":
    case "extensions.tabmix.useUnreadColor":
    case "extensions.tabmix.useProgressColor":
      var pref = prefName.toLowerCase().replace(/extensions.tabmix.|color/g,"")
                        .replace(/italic|bold|underline/g, ",$&,")
                        .replace("use", ",text,")
                        .replace("code", ",textColor,")
                        .split(",");
      var styleName, attrib;
      [styleName, attrib] = prefName.indexOf("Code") > -1 ? [pref[0], pref[1]] : [pref[2], pref[1]];
      if (styleName == "progress") {
        attrib = attrib.replace("text", "bg");
        styleName += "Meter"
      }
      else
        styleName += "Tab";
      oldStylePrefs[styleName][attrib] = newValue;
      oldStylePrefs.found = true;
      return;
    // changed at 2008-02-26
    case "extensions.tabmix.undoCloseCache":
      Services.prefs.setIntPref("browser.sessionstore.max_tabs_undo", newValue);
      return;
    // changed at 2008-08-17
    case "extensions.tabmix.opentabfor.search":
      Services.prefs.setBoolPref("browser.search.openintab", /true/i.test(newValue));
      return;
    // changed at 2008-09-23
    case "extensions.tabmix.keepWindow":
      Services.prefs.setBoolPref("browser.tabs.closeWindowWithLastTab", !(/true/i.test(newValue)));
      return;
    // changed at 2008-09-28
    case "browser.ctrlTab.mostRecentlyUsed":
    case "extensions.tabmix.lasttab.handleCtrlTab":
      Services.prefs.setBoolPref("browser.ctrlTab.previews", /true/i.test(newValue));
      return;
    // 2008-11-29
    case "extensions.tabmix.maxWidth":
    case "extensions.tabmix.tabMaxWidth": // 2012-06-22
      Services.prefs.setIntPref("browser.tabs.tabMaxWidth", newValue);
      return;
    // 2008-11-29
    case "extensions.tabmix.minWidth":
    case "extensions.tabmix.tabMinWidth": // 2012-06-22
      Services.prefs.setIntPref("browser.tabs.tabMinWidth", newValue);
      return;
    // 2009-01-31
    case "extensions.tabmix.newTabButton.leftside":
      Tabmix.prefs.setIntPref("newTabButton.position", /true/i.test(newValue) ? 0 : 2);
      return;
    // 2009-10-10
    case "extensions.tabmix.windows.warnOnClose":
      Tabmix.prefs.setBoolPref("tabs.warnOnClose", Services.prefs.getBoolPref("browser.tabs.warnOnClose"));
      Services.prefs.setBoolPref("browser.tabs.warnOnClose", /true/i.test(newValue));
      return;
    // 2010-03-07
    case "extensions.tabmix.extraIcons":
      Services.prefs.setBoolPref(prefName + ".locked", /true/i.test(newValue));
      Services.prefs.setBoolPref(prefName + ".protected", /true/i.test(newValue));
      return;
    // 2010-06-05
    case "extensions.tabmix.tabXMode":
      // in old version we use tabXMode = 0 to disable the button
      if (newValue < 1 || newValue > 5)
        newValue = 1;
      Tabmix.prefs.setIntPref("tabs.closeButtons", newValue);
      return;
    case "extensions.tabmix.tabXMode.enable":
      Tabmix.prefs.setBoolPref("tabs.closeButtons.enable", /true/i.test(newValue));
      return;
    case "extensions.tabmix.tabXLeft":
      Tabmix.prefs.setBoolPref("tabs.closeButtons.onLeft", /true/i.test(newValue));
      return;
    case "extensions.tabmix.tabXDelay":
      Tabmix.prefs.setIntPref("tabs.closeButtons.delay", newValue);
      return;
    // 2010-09-16
    case "extensions.tabmix.speLink":
      Tabmix.prefs.setIntPref("opentabforLinks", newValue);
      return;
    // 2011-01-26
    case "extensions.tabmix.mouseDownSelect":
      Tabmix.prefs.setBoolPref("selectTabOnMouseDown", /true/i.test(newValue));
      return;
    // 2011-10-11
    case "browser.link.open_external":
      if (newValue == $("generalWindowOpen").value)
        newValue = -1;
      Services.prefs.setIntPref("browser.link.open_newwindow.override.external", newValue);
      return;
    // 2011-11-26
    case "extensions.tabmix.clickToScroll.scrollDelay":
      Services.prefs.setIntPref("toolkit.scrollbox.clickToScroll.scrollDelay", newValue);
      return;
    // 2012-01-26
    case "extensions.tabmix.newTabUrl":
      setNewTabUrl(newTabURLpref, newValue);
      return;
    case "extensions.tabmix.newTabUrl_afterLastTab":
      setNewTabUrl(replaceLastTabWithNewTabURLpref, newValue);
      return;
      // 2012-03-21
    case "extensions.tabmix.loadOnNewTab":
      Tabmix.prefs.setIntPref("loadOnNewTab.type", newValue);
      return;
    case "extensions.tabmix.replaceLastTabWith":
      Tabmix.prefs.setIntPref("replaceLastTabWith.type", newValue);
      return;
      // 2012-04-12
    case "browser.tabs.loadFolderAndReplace":
      Tabmix.prefs.setBoolPref("loadFolderAndReplace", /true/i.test(newValue));
      return;
    // 2013-01-18
    case "extensions.tabmix.disableF8Key":
    case "extensions.tabmix.disableF9Key":
      let disabled = /true/i.test(newValue) ? "d&" : "";
      let isF8 = /disableF8Key$/.test(prefName);
      let key = isF8 ? "slideShow" : "toggleFLST";
      $("shortcut-group").keys[key] = disabled + (isF8 ? "VK_F8" : "VK_F9");
      Tabmix.prefs.setCharPref("shortcuts", Tabmix.JSON.stringify($("shortcut-group").keys));
      return;
    }
  }
  switch (prefType) {
  case pBranch.PREF_BOOL:
    if (atImport) {
      newValue = /true/i.test(newValue);
      // from tabmix 0.3.6.0.080223 we use extensions.tabmix.hideTabbar
      if (prefName == "browser.tabs.autoHide") {
        newValue = newValue ? 1 : 0;
        Tabmix.prefs.setIntPref("hideTabbar", newValue);
        return;
      }
    }
    Services.prefs.setBoolPref(prefName, newValue);
    break;
  case pBranch.PREF_INT:
    if (prefName == "browser.tabs.closeButtons") {
      // we use browser.tabs.closeButtons only in 0.3.8.3
      if (newValue < 0 || newValue > 6)
        newValue = 6;
      newValue = [3,5,1,1,2,4,1][newValue];
      Tabmix.prefs.setIntPref("tabs.closeButtons", newValue);
      return;
    }
    Services.prefs.setIntPref(prefName, newValue);
    break;
  case pBranch.PREF_STRING:
    // in prev version we use " " for to export string to file
    if (atImport && newValue.indexOf('"') == 0)
      newValue = newValue.substring(1,newValue.length-1);
    if (newTabURLpref == "browser.newtab.url") {
      if (prefName == "extensions.tabmix.newtab.url") {
        setNewTabUrl("browser.newtab.url", newValue);
        break;
      }
      if (prefName == "extensions.tabmix.replaceLastTabWith.newTabUrl") {
        setNewTabUrl("extensions.tabmix.replaceLastTabWith.newtab.url", newValue);
        break;
      }
    }
    Services.prefs.setCharPref(prefName, newValue);
    break;
  }
}

function setNewTabUrl(newPref, newValue) {
  if (newValue != "") {
    let nsISupportsString = Ci.nsISupportsString;
    let str = Cc["@mozilla.org/supports-string;1"].createInstance(nsISupportsString);
    str.data = newValue;
    Services.prefs.setComplexValue(newPref, nsISupportsString, str);
  }
}

XPCOMUtils.defineLazyGetter(window, "preferenceList", function() {
  // other settings not in extensions.tabmix. branch that we save
  let otherPrefs = ["browser.allTabs.previews","browser.ctrlTab.previews",
  "browser.link.open_newwindow","browser.link.open_newwindow.override.external",
  "browser.link.open_newwindow.restriction","browser.newtab.url",
  "browser.search.context.loadInBackground","browser.search.openintab",
  "browser.sessionstore.interval","browser.sessionstore.max_tabs_undo",
  "browser.sessionstore.postdata","browser.sessionstore.privacy_level",
  "browser.sessionstore.resume_from_crash","browser.startup.page",
  "browser.startup.page","browser.tabs.animate","browser.tabs.closeWindowWithLastTab",
  "browser.tabs.insertRelatedAfterCurrent","browser.tabs.loadBookmarksInBackground",
  "browser.tabs.loadDivertedInBackground","browser.tabs.loadInBackground",
  "browser.tabs.tabClipWidth","browser.tabs.tabMaxWidth","browser.tabs.tabMinWidth",
  "browser.tabs.warnOnClose","browser.warnOnQuit","browser.warnOnRestart",
  "toolkit.scrollbox.clickToScroll.scrollDelay","toolkit.scrollbox.smoothScroll"];

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
  this.preferenceList.forEach(function(pref) {
    if (Services.prefs.prefHasUserValue(pref))
      Services.prefs.clearUserPref(pref);
  });
  Shortcuts.prefsChangedByTabmix = false;
  Tabmix.prefs.clearUserPref("setDefault");
  Services.prefs.savePrefFile(null);
}

function exportData() {
  // save all pending changes
  gPrefWindow.onApply();

  let patterns = this.preferenceList.map(function(pref) {
    return pref + "=" + getPrefByType(pref) + "\n";
  });
  patterns[patterns.length-1] = patterns[patterns.length-1].replace(/\n$/, "");
  patterns.unshift("tabmixplus\n");

  const nsIFilePicker = Ci.nsIFilePicker;
  var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  var fpCallback = function fpCallback_done(aResult) {
    if (aResult != nsIFilePicker.returnCancel) {
      let file = fp.file;
      if (!/\.txt$/.test(file.leafName.toLowerCase()))
        file.leafName += ".txt";
      if (file.exists())
        file.remove(true);
      file.create(file.NORMAL_FILE_TYPE, parseInt("0666", 8));
      let stream = Cc["@mozilla.org/network/file-output-stream;1"].
                   createInstance(Ci.nsIFileOutputStream);
      stream.init(file, 0x02, 0x200, null);
      for (let i = 0; i < patterns.length ; i++)
        stream.write(patterns[i], patterns[i].length);
      stream.close();
    }
  }

  fp.init(window, null, nsIFilePicker.modeSave);
  fp.defaultExtension = "txt";
  fp.defaultString = "TMPpref";
  fp.appendFilters(nsIFilePicker.filterText);
  fp.open(fpCallback);
}

var oldStylePrefs = {currentTab: {}, unreadTab: {}, progressMeter: {}, found: false};
function importData () {
  const nsIFilePicker = Ci.nsIFilePicker;
  var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  var fpCallback = function fpCallback_done(aResult) {
    if (aResult != nsIFilePicker.returnCancel) {
      let stream = Cc["@mozilla.org/network/file-input-stream;1"].
                  createInstance(Ci.nsIFileInputStream);
      stream.init(fp.file, 0x01, parseInt("0444", 8), null);
      let streamIO = Cc["@mozilla.org/scriptableinputstream;1"].
                  createInstance(Ci.nsIScriptableInputStream);
      streamIO.init(stream);
      let input = streamIO.read(stream.available());
      streamIO.close();
      stream.close();
      if (input)
        loadData(input.replace(/\r\n/g, "\n").split("\n"));
    }
  }

  fp.init(window, null, nsIFilePicker.modeOpen);
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

  var prefName, prefValue;
  Shortcuts.prefsChangedByTabmix = true;
  for (let i = 1; i < pattern.length; i++){
    var index = pattern[i].indexOf("=");
    if (index > 0){
      prefName  = pattern[i].substring(0,index);
      prefValue = pattern[i].substring(index+1,pattern[i].length);
      setPrefByType(prefName, prefValue, true);
    }
  }
  Shortcuts.prefsChangedByTabmix = false;
  var browserWindow = Tabmix.getTopWin();
  browserWindow.gTMPprefObserver.updateTabClickingOptions();
  if (oldStylePrefs.found) {
    browserWindow.gTMPprefObserver.converOldStylePrefs("currentTab", oldStylePrefs.currentTab);
    browserWindow.gTMPprefObserver.converOldStylePrefs("unreadTab", oldStylePrefs.unreadTab);
    browserWindow.gTMPprefObserver.converOldStylePrefs("progressMeter", oldStylePrefs.progressMeter);
    oldStylePrefs = {currentTab: {}, unreadTab: {}, progressMeter: {}, found: false};
  }
  Tabmix.prefs.clearUserPref("setDefault");
  Services.prefs.savePrefFile(null);
}

// this function is called from Tabmix.openOptionsDialog if the dialog already opened
function showPane(paneToLoad) {
  let docElt = document.documentElement;
  paneToLoad = paneToLoad > -1 ?
    document.getElementsByTagName("prefpane")[paneToLoad] :
    $(docElt.lastSelected);
  docElt.showPane(paneToLoad);
}

function openHelp() {
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

  var currentPane = document.documentElement.currentPane;
  var helpTopic = currentPane.helpTopic;
  if (currentPane.id == "paneSession" && helpTopic == "tabmix")
      helpTopic = $("session").selectedTab.getAttribute("helpTopic");

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

// Bug 455553 - New Tab Page feature - landed on 2012-01-26 (Firefox 12)
// for support firefox 4.0-11.0
XPCOMUtils.defineLazyGetter(window, "newTabURLpref", function() {
  return Tabmix.getTopWin().Tabmix.newTabURLpref;
});

XPCOMUtils.defineLazyGetter(window, "replaceLastTabWithNewTabURLpref", function() {
  let pref = "extensions.tabmix.replaceLastTabWith.";
  return newTabURLpref == "browser.newtab.url" ?
    pref + "newtab.url" : pref + "newTabUrl";
});

XPCOMUtils.defineLazyGetter(gPrefWindow, "pinTabLabel", function() {
  let win = Tabmix.getTopWin();
  return win.document.getElementById("context_pinTab").getAttribute("label") + "/" +
         win.document.getElementById("context_unpinTab").getAttribute("label");
});

Tabmix.lazy_import(window, "Shortcuts", "Shortcuts", "Shortcuts");
