"use strict";

var EXPORTED_SYMBOLS = ["Shortcuts"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://tabmixplus/Services.jsm");

this.Shortcuts = {
  keys: {
    newTab: {id: "key_newNavigatorTab", default: "T accel"},
    dupTab: {default: "T accel,alt"},
    dupTabToWin: {command: 14},
    detachTab: {default: "N accel,alt"},
    togglePinTab: {command: 31},
    protecttab: {command: 5},
    locktab: {command: 6},
    freezetab: {command: 15},
    renametab: {command: 11},
    copyTabUrl: {command: 28},
    pasteTabUrl: {command: 29},
    selectMerge: {command: 22},
    mergeWin: {default: "M accel,shift"},
    addBookmark: {id: "addBookmarkAsKb", default: "D accel"},
    bookmarkAllTabs: {id: "bookmarkAllTabsKb", default: "D accel,shift"},
    reload: {id: "key_reload", default: "R accel"},
    browserReload: {default: "VK_F5"},
    reloadtabs: {command: 7},
    reloadothertabs: {command: 16},
    reloadlefttabs: {command: 19},
    reloadrighttabs: {command: 20},
    autoReloadTab: {command: 30},
    close: {id: "key_close", default: "W accel"},
    removeall: {command: 9},
    removesimilar: {command: 24},
    removeother: {command: 8},
    removeleft: {command: 17},
    removeright: {command: 18},
    undoClose: {default: "VK_F12 accel"},
    undoCloseTab: {id: "key_undoCloseTab", default: "T accel,shift"},
    ucatab: {command: 13},
    saveWindow: {id: "key_tm-sm-saveone", default: "VK_F1 accel", sessionKey: true},
    saveSession: {id: "key_tm-sm-saveall", default: "VK_F9 accel", sessionKey: true},
    switchToLast: {command: 32},
    slideShow: {id: "key_tm_slideShow", default: "d&VK_F8"},
    toggleFLST: {id: "key_tm_toggleFLST", default: "d&VK_F9"}
  },

  get prefs() {
    delete this.prefs;
    return (this.prefs = Services.prefs.getBranch("extensions.tabmix."));
  },

  prefsChangedByTabmix: false,
  updatingShortcuts: false,
  prefBackup: null,
  initialized: false,
  permanentPrivateBrowsing: false,
  keyConfigInstalled: false,

  initService: function(aWindow) {
    if (this.initialized)
      return;
    this.initialized = true;

    if (TabmixSvc.version(200)) {
      let tmp = {};
      Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm", tmp);
      this.permanentPrivateBrowsing = tmp.PrivateBrowsingUtils.permanentPrivateBrowsing;
    }
    else
      this.permanentPrivateBrowsing = Cc["@mozilla.org/privatebrowsing;1"].
          getService(Ci.nsIPrivateBrowsingService).autoStarted;

    // update keys initial value and label
    // get our key labels from shortcutsLabels.xml
    let $ = function(id) id && aWindow.document.getElementById(id);
    let container = $("tabmixScrollBox") || $("tabbrowser-tabs");
    let labels = {};
    if (container) {
      let box = aWindow.document.createElement("vbox");
      box.setAttribute("shortcutsLabels", true);
      container.appendChild(box);
      Array.slice(box.attributes).forEach(function(a) labels[a.name] = a.value);
      container.removeChild(box);
    }
    labels.togglePinTab =
      $("context_pinTab").getAttribute("label") + "/" +
      $("context_unpinTab").getAttribute("label");
    for (let key of Object.keys(this.keys)) {
      let keyData = this.keys[key];
      keyData.value = keyData.default || "";
      if (container && key in labels)
        keyData.label = labels[key];
      else if (!container && !key.id)
        keyData.label = "tabmix_key_" + key;
    }

    if (aWindow.keyconfig) {
      this.keyConfigInstalled = true;
      KeyConfig.init(aWindow);
    }

    this.prefs.addObserver("shortcuts", this, false);
    this.prefs.addObserver("sessions.manager", this, false);
    Services.obs.addObserver(this, "quit-application", false);
  },

  observe: function(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "nsPref:changed":
        this.onPrefChange(aData);
        break;
      case "quit-application":
        this.prefs.removeObserver("shortcuts", this);
        this.prefs.removeObserver("sessions.manager", this);
        Services.obs.removeObserver(this, "quit-application");
        if (this.keyConfigInstalled)
          KeyConfig.deinit();
        break;
    }
  },

  onPrefChange: function TMP_SC_onPrefChange(aData) {
   try {
    if (this.updatingShortcuts ||
        aData != "shortcuts" && aData != "sessions.manager")
      return;
    this.updatingShortcuts = true;
    // instead of locking the preference just revert any changes user made
    if (aData == "shortcuts" && !this.prefsChangedByTabmix) {
      this.setShortcutsPref();
      return;
    }

    let [changedKeys, needUpdate] = this._getChangedKeys({onChange: aData == "shortcuts"});
    if (needUpdate) {
      let windowsEnum = Services.wm.getEnumerator("navigator:browser");
      while (windowsEnum.hasMoreElements()) {
        let win = windowsEnum.getNext();
        if (!win.closed)
          this.updateWindowKeys(win, changedKeys);
      }
      if (this.keyConfigInstalled)
        KeyConfig.syncToKeyConfig(changedKeys, true);
    }

    this.updatingShortcuts = false;
   } catch (ex) {TabmixSvc.console.assert(ex);}
  },

  /* ........ Window Event Handlers .............. */

  handleEvent: function(aEvent) {
    switch (aEvent.type) {
      case "command":
        this.onCommand(aEvent.currentTarget);
        break;
      case "unload":
        this.onUnload(aEvent.currentTarget);
        break;
    }
  },

  onCommand: function TMP_SC_onCommand(aKey) {
   try {
    let win = aKey.ownerDocument.defaultView;
    let command = this.keys[aKey._id].command;
    win.TabmixTabClickOptions.doCommand(command, win.gBrowser.selectedTab);
   } catch (ex) {TabmixSvc.console.assert(ex);}
  },

  onUnload: function TMP_SC_onUnload(aWindow) {
    aWindow.removeEventListener("unload", this, false);
    let doc = aWindow.document;
    for (let key of Object.keys(this.keys)) {
      let keyData = this.keys[key];
      if (keyData.command && keyData.value) {
        let keyItem = doc.getElementById(keyData.id || "key_tm_" + key);
        if (keyItem)
          keyItem.removeEventListener("command", this, true);
      }
    }
  },

  onWindowOpen: function TMP_SC_onWindowOpen(aWindow) {
    this._setReloadKeyId(aWindow);
    this.initService(aWindow);

    aWindow.addEventListener("unload", this, false);

    XPCOMUtils.defineLazyGetter(aWindow.Tabmix, "removedShortcuts", function() {
      let document = aWindow.document;
      return document.documentElement.appendChild(document.createElement("tabmix_shortcuts"));
    });

    let [changedKeys, needUpdate] = this._getChangedKeys({onOpen: true});
    if (needUpdate)
      this.updateWindowKeys(aWindow, changedKeys);
  },

  /* ........ Window Key Handlers .............. */

  updateWindowKeys: function TMP_SC_updateWindowKeys(aWindow, aKeys) {
    for (let key of Object.keys(aKeys))
      this._updateKey(aWindow, key, aKeys[key]);

    let keyset = aWindow.document.getElementById("mainKeyset");
    keyset.parentNode.insertBefore(keyset, keyset.nextSibling);
  },

  _updateKey: function TMP_SC__updateKey(aWindow, aKey, aKeyData) {
    let document = aWindow.document;
    let keyset = document.getElementById("mainKeyset");
    let keyAtt = this.keyParse(aKeyData.value || "d&");
    if (aKeyData.sessionKey && aKeyData.blocked)
      keyAtt.disabled = true;
    let disabled = keyAtt.disabled;
    let id = aKeyData.id || "key_tm_" + aKey;
    let keyItem = document.getElementById(id);
    if (keyItem) {
      if (!keyItem.parentNode)
        return;
      for (let att of Object.keys(keyAtt))
        keyItem.removeAttribute(att);
      // disabled shortcuts, like new tab and close tab, can mess the whole keyset
      // so we move those to a different node
      if (disabled)
        aWindow.Tabmix.removedShortcuts.appendChild(keyItem);
      else if (keyItem.parentNode != keyset)
        keyset.appendChild(keyItem);
    }
    else {
      // don't add disabled key
      if (!keyset || disabled)
        return;
      keyItem = document.createElementNS(NS_XUL, "key");
      keyItem.setAttribute("id", id);
      keyItem._id = aKey;
      keyset.appendChild(keyItem);
      keyItem.setAttribute("label", aKeyData.label);
      aWindow.Tabmix.setItem(keyItem, "oncommand", "void(0);");
      keyItem.addEventListener("command", this, true);
    }

    for (let att of Object.keys(keyAtt)) {
      let val = keyAtt[att];
      if (val)
        keyItem.setAttribute(att, val);
    }
    // remove existing acceltext from menus
    let items = document.getElementsByAttribute("key", keyItem.id);
    for (let i = 0, l = items.length; i < l; i++)
      items[i].setAttribute("acceltext", disabled ? " " : "");

    // turn off slideShow if need to
    if (aKey == "slideShow" && disabled &&
        aWindow.Tabmix.SlideshowInitialized && aWindow.Tabmix.flst.slideShowTimer) {
        aWindow.Tabmix.flst.cancel();
    }
  },

  /* ........ Auxiliary Functions .............. */

  _getChangedKeys: function TMP_SC__getChangedKeys(aOptions) {
    let shortcuts = !aOptions.onChange && this.prefBackup || this._getShortcutsPref();
    let disableSessionKeys = this.permanentPrivateBrowsing ||
        !this.prefs.getBoolPref("sessions.manager");
    let changedKeys = {}, onOpen = aOptions.onOpen;
    for (let key of Object.keys(this.keys)) {
      let keyData = this.keys[key];
      let _default = keyData.default || "";
      let currentValue = onOpen ? _default : keyData.value;
      let newValue = shortcuts[key] || _default;
      let updatBlockState = keyData.sessionKey && !/^d&/.test(newValue) &&
          (onOpen ? disableSessionKeys :
          disableSessionKeys != keyData.blocked);
      if (keyData.sessionKey)
        keyData.blocked = disableSessionKeys;
      // on start report disabled by default shortcut as changed so _updateKey
      // can move these shortcuts to removedShortcuts
      if (currentValue != newValue || updatBlockState ||
          onOpen && /^d&/.test(_default)) {
        keyData.value = newValue;
        changedKeys[key] = keyData;
      }
    }

    return [changedKeys, Object.keys(changedKeys).length];
  },

  _getShortcutsPref: function TMP_SC__getShortcutsPref() {
    let shortcuts = null, updatePreference = false;
    try {
      shortcuts = JSON.parse(getPref("extensions.tabmix.shortcuts"));
    } catch (ex) {}
    if (shortcuts === null) {
      TabmixSvc.console.log("failed to read shortcuts preference.\nAll shortcuts was resets to default");
      shortcuts = {};
      updatePreference = true;
    }
    for (let key of Object.keys(shortcuts)) {
      let val = shortcuts[key];
      // if key in preference is not valid key or its value is not valid
      // or its value equal to default, remove it from the preference
      let keyData = this.keys[key] || null;
      if (!keyData || typeof val != "string" || val == keyData.default || val === "" ||
          (val == "d&" && (!keyData.default || /^d&/.test(keyData.default)))) {
        delete shortcuts[key];
        updatePreference = true;
      }
      else if (keyData.default && (val == "d&" + keyData.default)) {
        shortcuts[key] = "d&";
        updatePreference = true;
      }
      else if (val != "d&" && !this.prefBackup) {
        // make sure user didn't changed the preference in prefs.js
        let newValue = this._userChangedKeyPref(val) || keyData.value;
        if (newValue != val) {
          if (newValue == keyData.default)
            delete shortcuts[key];
          else
            shortcuts[key] = newValue;
          updatePreference = true;
        }
      }
    }
    this.prefBackup = shortcuts;
    if (updatePreference)
      this.setShortcutsPref();
    return shortcuts;
  },

  _userChangedKeyPref: function(value) {
    let key = value && this.keyParse(value);
    if (!key)
      return "";
    let modifiers = key.modifiers.replace(/^[\s,]+|[\s,]+$/g,"")
          .replace("ctrl", "control").split(",");
    key.modifiers = ["control","meta","accel","alt","shift"].filter(
      function(mod) new RegExp(mod).test(modifiers)).join(",");

    // make sure that key and keycod are valid
    key.key = key.key.toUpperCase();
    if (key.key == " ")
      [key.key , key.keycode] = ["", "VK_SPACE"];
    else {
      key.keycode = "VK_" + key.keycode.toUpperCase().replace(/^VK_/, "");
      if (key.keycode != "VK_BACK" && !(("DOM_" + key.keycode) in Ci.nsIDOMKeyEvent))
        // not all items in Ci.nsIDOMKeyEvent are valid as keyboard shortcuts
        key.keycode = "";
    }
    return this.validateKey(key);
  },

  setShortcutsPref: function() {
    this.updatingShortcuts = true;
    setPref("extensions.tabmix.shortcuts", JSON.stringify(this.prefBackup));
    this.updatingShortcuts = false;
  },

  keyParse: function keyParse(value) {
    let disabled = /^d&/.test(value);
    let [keyVal, modifiers] = value.replace(/^d&/, "").split(" ");
    let isKey = keyVal.length == 1;
    return {modifiers: modifiers || "" ,key: isKey ? keyVal : "" ,keycode: isKey ? "" : keyVal, disabled: disabled};
  },

  // convert key object {modifiers, key, keycode} into a string with " " separator
  keyStringify: function keyStringify(value) {
    if (!value)
      return "";
    return [(value.disabled ? "d&" : "") + (value.key || value.keycode),
             value.modifiers].join(" ").replace(/[\s|;]$/, "");
  },

  validateKey: function validateKey(key) {
    if ((key.keycode && key.keycode == "VK_SCROLL_LOCK" || key.keycode == "VK_CONTEXT_MENU") ||
       (!key.key && !key.keycode)) {
      key = null;
    }
    // block ALT + TAB
    else if (key.modifiers && /alt/.test(key.modifiers) && key.keycode &&
        (key.keycode == "VK_BACK_QUOTE" || key.keycode == "VK_TAB")) {
      key = null;
    }

    return key ? this.keyStringify(key) : "";
  },

  getFormattedKey: function(key) {
    return getFormattedKey(key);
  },

  getFormattedKeyForID: function(id) {
    let key = this.keyParse(this.keys[id].value);
    return getFormattedKey(key);
  },

  getPlatformAccel: function() {
    return getPlatformAccel();
  },

  // add id for key Browser:Reload
  _setReloadKeyId: function(aWindow) {
    let reload = aWindow.document.getElementsByAttribute("command", "Browser:Reload");
    if (!reload)
      return;
    Array.some(reload, function(key) {
      if (key.getAttribute("keycode") != "VK_F5")
        return false;
      if (!this.keys.browserReload.id) {
        let index = 2, id;
        do {
         id = "key_reload#".replace("#", index++);
        } while (aWindow.document.getElementById(id));
        this.keys.browserReload.id = key.id = id;
      }
      else
        key.id = this.keys.browserReload.id;
      return true;
    }, this);
  }

};

var KeyConfig = {
  prefsChangedByTabmix: false,
  // when keyConfig extension installed sync the preference
  // user may change shortcuts in both extensions
  init: function() {
    this.keyIdsMap = {};
    // keyConfig use index number for its ids
    let oldReloadId = "xxx_key29_Browser:Reload";
    this.keyIdsMap[oldReloadId] = "browserReload";
    for (let key of Object.keys(Shortcuts.keys)) {
      let keyData = Shortcuts.keys[key];
      this.keyIdsMap[keyData.id || "key_tm_" + key] = key;
    }

    this.prefs = Services.prefs.getBranch("keyconfig.main.");
    let shortcuts = Shortcuts._getShortcutsPref();
    // sync non defualt shortcuts
    if (Object.keys(shortcuts).length > 0)
      this.syncToKeyConfig(shortcuts);
    else {
      let prefs = this.prefs.getChildList("").filter(function(pref) {
        let key = this.keyIdsMap[pref];
        return key && this.syncFromKeyConfig(key, pref, shortcuts);
      }, this);
      if (prefs.length > 0) {
        // we are here before onWindowOpen call updateWindowKeys
        // so we don't need to do anything else here
        Shortcuts.prefBackup = shortcuts;
        Shortcuts.setShortcutsPref();
      }
    }
    this.resetPref(oldReloadId);
    this.prefs.addObserver("", this, false);
  },

  deinit: function() {
    this.prefs.removeObserver("", this);
  },

  observe: function(aSubject, aTopic, aData) {
    if (this.prefsChangedByTabmix)
      return;
    let key = this.keyIdsMap[aData];
    if (aTopic == "nsPref:changed" && key) {
      let shortcuts = Shortcuts.prefBackup || Shortcuts._getShortcutsPref();
      if (this.syncFromKeyConfig(key, aData, shortcuts)) {
        // keyConfig extension code updates the DOM key, we don't need to do it
        Shortcuts.prefBackup = shortcuts;
        Shortcuts.keys[key].value = shortcuts[key] || Shortcuts.keys[key].default;
        Shortcuts.setShortcutsPref();
      }
    }
  },

  syncFromKeyConfig: function(aKey, aPrefName, aShortcuts) {
    let prefValue, newValue, keyData = Shortcuts.keys[aKey];
    try {
      prefValue = getPref("keyconfig.main." + aPrefName).split("][");
    } catch (ex) { }
    if (!prefValue)
      newValue = keyData.default;
    else if (/^!/.test(prefValue))
      newValue = "d&";
    else {
      let newKey = {modifiers: prefValue[0].replace(" ", ","),
          key: prefValue[1], keycode: prefValue[2]};
      if (keyData.value.indexOf("accel") > -1)
        newKey.modifiers = newKey.modifiers.replace(getPlatformAccel(), "accel");
      newValue = Shortcuts.keyStringify(newKey);
    }
    if (newValue != keyData.value) {
      if (newValue == keyData.default)
        delete aShortcuts[aKey];
      else
        aShortcuts[aKey] = newValue;
      return true;
    }
    return false;
  },

  syncToKeyConfig: function(aChangedKeys, onChange) {
    for (let key of Object.keys(aChangedKeys)) {
      let prefVal = aChangedKeys[key];
      this.prefsChangedByTabmix = true;
      if (onChange)
        prefVal = prefVal.value;
      let id = Shortcuts.keys[key].id || "key_tm_" + key;
      if (!prefVal || prefVal == Shortcuts.keys[key].default)
        this.resetPref(id);
      else {
        let obj = Shortcuts.keyParse(prefVal);
        let newValue = obj.disabled ? ["!", "", ""] :
          [obj.modifiers.replace(",", " "), obj.key, obj.keycode];
        setPref("keyconfig.main." + id, newValue.join("]["));
      }
      this.prefsChangedByTabmix = false;
    }
  },

  resetPref: function (prefName) {
    this.prefs.clearUserPref(prefName);
  }

};

function getPref(name) {
  return Services.prefs.getComplexValue(name, Ci.nsISupportsString).data;
}

function setPref(name, value) {
  let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
  str.data = value;
  Services.prefs.setComplexValue(name, Ci.nsISupportsString, str);
}

function getFormattedKey(key) {
  if (!key)
    return "";
  var val = "";

  if (key.modifiers) {
    let sep = getPlatformKeys("MODIFIER_SEPARATOR");
    key.modifiers.replace(/^[\s,]+|[\s,]+$/g,"").split(/[\s,]+/g).forEach(function(mod){
      if (/alt|shift|control|meta|accel/.test(mod))
        val += getPlatformKeys("VK_" + mod.toUpperCase()) + sep;
    });
  }

  if (key.key) {
    if (key.key == " ") {
      key.key = ""; key.keycode = "VK_SPACE";
    }
    else
      val += key.key.toUpperCase();
  }
  if (key.keycode) {
    try {
      let localeKeys = Services.strings.createBundle("chrome://global/locale/keys.properties");
      val += localeKeys.GetStringFromName(key.keycode);
    } catch (ex) {
      val += "<" + key.keycode + ">";
    }
  }
  return val;
}

/*
 * get platform labels for: alt, shift, control, meta, accel.
 */
let gPlatformKeys = {};
function getPlatformKeys(key) {
  if (typeof gPlatformKeys[key] == "string")
    return gPlatformKeys[key];

  let val, platformKeys = Services.strings.createBundle("chrome://global-platform/locale/platformKeys.properties");
  if (key != "VK_ACCEL")
    val = platformKeys.GetStringFromName(key);
  else
    val = getPlatformKeys("VK_" + getPlatformAccel().toUpperCase());

  return (gPlatformKeys[key] = val);
}

function getPlatformAccel() {
  switch (Services.prefs.getIntPref("ui.key.accelKey")) {
    case 17:  return "control";
    case 18:  return "alt";
    case 224: return "meta";
  }
  return (Services.appinfo.OS == "Darwin" ? "meta" : "control");
}
