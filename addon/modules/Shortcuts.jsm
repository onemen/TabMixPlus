"use strict";

this.EXPORTED_SYMBOLS = ["Shortcuts"];

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const {XPCOMUtils} = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {TabmixSvc} = ChromeUtils.import("chrome://tabmix-resource/content/TabmixSvc.jsm");
const {AppConstants} = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");

ChromeUtils.defineModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");

var KeyConfig;
this.Shortcuts = {
  keys: {
    newTab: {id: "key_newNavigatorTab", default: "T accel"},
    dupTab: {id: "key_tm_dupTab", useInMenu: true, default: "F #modifiers", command: 3},
    dupTabToWin: {command: 14},
    detachTab: {id: "key_tm_detachTab", useInMenu: true, default: "V #modifiers", command: 27},
    togglePinTab: {command: 31},
    protecttab: {command: 5},
    locktab: {command: 6},
    freezetab: {command: 15},
    renametab: {command: 11},
    copyTabUrl: {command: 28},
    pasteTabUrl: {command: 29},
    selectMerge: {command: 22},
    mergeWin: {id: "key_tm_mergeWin", useInMenu: true, default: "U #modifiers", command: 23},
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
    undoCloseTab: {id: "key_undoCloseTab", default: "T accel,shift"},
    clearClosedTabs: {
      command() {
        this.TMP_ClosedTabs.restoreTab('original', -1);
      }
    },
    ucatab: {command: 13},
    saveWindow: {
      id: "key_tm_sm_saveone",
      useInMenu: true,
      default: "VK_F1 accel",
      sessionKey: true,
      command: "TabmixSessionUtils:SaveThisWindow"
    },
    saveSession: {
      id: "key_tm_sm_saveone",
      useInMenu: true,
      default: "VK_F9 accel",
      sessionKey: true,
      command: "TabmixSessionUtils:SaveAllWindow"
    },
    switchToLast: {command: 32},
    slideShow: {
      id: "key_tm_slideShow",
      // disabled by default
      default: "d&VK_F8",
      command() {
        this.Tabmix.flst.toggleSlideshow();
      }
    },
    toggleFLST: {
      id: "key_tm_toggleFLST",
      // disabled by default
      default: "d&VK_F9",
      command() {
        this.Tabmix.flst.toggle();
      }
    }
  },

  get prefs() {
    delete this.prefs;
    return (this.prefs = Services.prefs.getBranch("extensions.tabmix."));
  },

  prefsChangedByTabmix: false,
  updatingShortcuts: false,
  prefBackup: null,
  initialized: false,
  keyConfigInstalled: false,

  initService(aWindow) {
    if (this.initialized)
      return;
    this.initialized = true;

    this.KeyboardEvent = Object.keys(aWindow.KeyboardEvent);

    // update keys initial value and label
    let $ = id => id && aWindow.document.getElementById(id);
    let container = $("TabsToolbar");
    let box = aWindow.MozXULElement.parseXULToFragment(`
      <div hidden="true"
        dupTab="&duplicateTabMenu.label;"
        dupTab_key="&tab.key; #modifiers"
        dupTabToWin="&clicktab.duplicatetabw;"
        detachTab="&detachTab.label;"
        detachTab_key="&window.key; #modifiers"
        protecttab="&clicktab.protecttab;"
        locktab="&clicktab.locktab;"
        freezetab="&clicktab.freezetab;"
        renametab="&clicktab.renametab;"
        copyTabUrl="&clicktab.copyTabUrl;"
        pasteTabUrl="&clicktab.copyUrlFromClipboard;"
        selectMerge="&clicktab.selectMerge;"
        mergeWin="&mergeContext.label;"
        mergeWin_key="&merge.key; #modifiers"
        reload="&clicktab.reloadtab;"
        reloadtabs="&clicktab.reloadtabs;"
        reloadothertabs="&clicktab.reloadothertabs;"
        reloadlefttabs="&clicktab.reloadlefttabs;"
        reloadrighttabs="&clicktab.reloadrighttabs;"
        autoReloadTab="&clicktab.autoReloadTab;"
        removeall="&clicktab.removeall;"
        removesimilar="&clicktab.removesimilar;"
        removeother="&clicktab.removeother;"
        removeleft="&clicktab.removetoLeft;"
        removeright="&clicktab.removetoRight;"
        ucatab="&clicktab.ucatab;"
        saveWindow="&saveWindow.label;"
        saveSession="&saveAllWindows.label;"
        switchToLast="&shortcuts.switchToLast;"
        slideShow="&shortcuts.slideshow;"
        toggleFLST="&shortcuts.toggleFLST;"
      />
      `, [
      "chrome://tabmixplus/locale/tabmix.dtd",
      "chrome://tabmixplus/locale/pref-tabmix.dtd",
      "chrome://tabmixplus/locale/shortcuts.dtd"
    ]).childNodes[0];
    for (let att of box.attributes) {
      if (this.keys[att.name]) {
        this.keys[att.name].label = att.value;
      } else if (att.name.endsWith("_key")) {
        this.keys[att.name.split("_")[0]].default = att.value;
      }
    }

    const isMac = AppConstants.platform == "macosx";
    // Common modifier shared by most key shortcuts
    const platformModifiers = isMac ? "accel,alt" : "accel,shift";

    for (let key of Object.keys(this.keys)) {
      let keyData = this.keys[key];
      let tabmixKey = keyData.id?.startsWith("key_tm");
      // get default value for build-in keys
      // default can be different between languages
      if (keyData.default && !tabmixKey) {
        const elm = $(keyData.id);
        if (elm) {
          const modifiers = elm.getAttribute("modifiers");
          const key_ = elm.getAttribute("key");
          const keycode = elm.getAttribute("keycode");
          const disabled = /^d&/.test(keyData.default || "") ? "d&" : "";
          const newDefault = disabled + (key_ || keycode).toUpperCase() +
              (modifiers ? " " + modifiers.replace(/\s/g, "") : "");
          keyData.default = newDefault;
          if (elm.hasAttribute("reserved")) {
            keyData.reserved = true;
          }
        }
      } else if (tabmixKey) {
        keyData.default = keyData.default.replace("#modifiers", platformModifiers);
      }
      keyData.value = keyData.default || "";
      if (!container && !key.id) {
        keyData.label = "tabmix_key_" + key;
      }
    }

    // Firefox load lables from tabContextMenu.ftl lazily
    const contextMutate = aMutations => {
      for (let mutation of aMutations) {
        if (mutation.attributeName == "label" &&
            $("context_pinTab").hasAttribute("label") &&
            $("context_unpinTab").hasAttribute("label")) {
          const label = $("context_pinTab").getAttribute("label") + "/" +
              $("context_unpinTab").getAttribute("label");

          this.keys.togglePinTab.label = label;
          const keyItem = aWindow.document.getElementById("key_tm_togglePinTab");
          keyItem?.setAttribute("label", label);

          // eslint-disable-next-line no-use-before-define
          Observer.disconnect();
          return;
        }
      }
    };
    let Observer = new aWindow.MutationObserver(contextMutate);
    Observer.observe($("tabContextMenu"), {subtree: true, attributeFilter: ["label"]});

    this.keys.clearClosedTabs.label =
        TabmixSvc.getString("undoclosetab.clear.label");

    if (aWindow.keyconfig) {
      this.keyConfigInstalled = true;
      KeyConfig.init(aWindow);
    }

    this.prefs.addObserver("shortcuts", this);
    this.prefs.addObserver("sessions.manager", this);
    Services.obs.addObserver(this, "quit-application");
  },

  observe(aSubject, aTopic, aData) {
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
    } catch (ex) {
      TabmixSvc.console.assert(ex);
    }
  },

  /* ........ Window Event Handlers .............. */

  handleEvent(aEvent) {
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
      let win = aKey.ownerGlobal;
      let command = this.keys[aKey._id].command;
      if (typeof command == "function") {
        command.apply(win, [win.gBrowser.selectedTab]);
      } else if (typeof command !== "string") {
        win.TabmixTabClickOptions.doCommand(command, win.gBrowser.selectedTab);
      }
    } catch (ex) {
      TabmixSvc.console.assert(ex);
    }
  },

  onUnload: function TMP_SC_onUnload(aWindow) {
    aWindow.removeEventListener("unload", this);
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

    aWindow.addEventListener("unload", this);

    XPCOMUtils.defineLazyGetter(aWindow.Tabmix, "removedShortcuts", () => {
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
    } else {
      // always add tabmix key that is in use by menu
      if (!keyset || (disabled && !aKeyData.useInMenu)) {
        return;
      }
      keyItem = document.createElementNS(NS_XUL, "key");
      keyItem.setAttribute("id", id);
      keyItem._id = aKey;
      keyset.appendChild(keyItem);
      keyItem.setAttribute("label", aKeyData.label);
      if (typeof aKeyData.command === "string") {
        aWindow.Tabmix.setItem(keyItem, "command", aKeyData.command);
      } else {
        aWindow.Tabmix.setItem(keyItem, "oncommand", "void(0);");
        keyItem.addEventListener("command", this, true);
      }
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
    if (aKey == "slideShow" && disabled) {
      aWindow.Tabmix.slideshow.cancel();
    }
  },

  /* ........ Auxiliary Functions .............. */

  _getChangedKeys: function TMP_SC__getChangedKeys(aOptions) {
    let shortcuts = !aOptions.onChange && this.prefBackup || this._getShortcutsPref();
    let disableSessionKeys = PrivateBrowsingUtils.permanentPrivateBrowsing ||
        !this.prefs.getBoolPref("sessions.manager");
    let changedKeys = {}, onOpen = aOptions.onOpen;
    for (let key of Object.keys(this.keys)) {
      let keyData = this.keys[key];
      let _default = keyData.default || "";
      let currentValue = onOpen ? _default : keyData.value;
      let newValue = shortcuts[key] || _default;
      let updateBlockState = keyData.sessionKey && !/^d&/.test(newValue) &&
          (onOpen ? disableSessionKeys :
            disableSessionKeys != keyData.blocked);
      if (keyData.sessionKey)
        keyData.blocked = disableSessionKeys;
      // on start report all tabmix keys and disabled by default shortcut as
      // changed so _updateKey can move these shortcuts to removedShortcuts
      if (!keyData.reserved &&
          (onOpen && keyData.id?.startsWith("key_tm") || currentValue != newValue ||
          updateBlockState || onOpen && /^d&/.test(_default))) {
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
      } else if (keyData.default && (val == "d&" + keyData.default)) {
        shortcuts[key] = "d&";
        updatePreference = true;
      } else if (val != "d&" && !this.prefBackup) {
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

  _userChangedKeyPref(value) {
    let key = value && this.keyParse(value);
    if (!key)
      return "";
    let modifiers = key.modifiers.replace(/^[\s,]+|[\s,]+$/g, "")
        .replace("ctrl", "control").split(",");
    key.modifiers = ["control", "meta", "accel", "alt", "shift"].filter(mod => {
      return new RegExp(mod).test(modifiers);
    }).join(",");

    // make sure that key and keycode are valid
    key.key = key.key.toUpperCase();
    if (key.key == " ")
      [key.key, key.keycode] = ["", "VK_SPACE"];
    else {
      key.keycode = "VK_" + key.keycode.toUpperCase().replace(/^VK_/, "");
      if (key.keycode != "VK_BACK" && !this.KeyboardEvent.includes("DOM_" + key.keycode)) {
        // not all items in KeyboardEvent are valid as keyboard shortcuts
        key.keycode = "";
      }
    }
    return this.validateKey(key);
  },

  setShortcutsPref() {
    this.updatingShortcuts = true;
    setPref("extensions.tabmix.shortcuts", JSON.stringify(this.prefBackup));
    this.updatingShortcuts = false;
  },

  keyParse: function keyParse(value) {
    let disabled = /^d&/.test(value);
    let [keyVal, modifiers] = value.replace(/^d&/, "").split(" ");
    let isKey = keyVal.length == 1;
    return {modifiers: modifiers || "", key: isKey ? keyVal : "", keycode: isKey ? "" : keyVal, disabled};
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
    } else if (key.modifiers && /alt/.test(key.modifiers) && key.keycode &&
        (key.keycode == "VK_BACK_QUOTE" || key.keycode == "VK_TAB")) {
      // block ALT + TAB
      key = null;
    }

    return key ? this.keyStringify(key) : "";
  },

  getFormattedKey(key) {
    return getFormattedKey(key);
  },

  getFormattedKeyForID(id) {
    let key = this.keyParse(this.keys[id].value);
    return getFormattedKey(key);
  },

  getPlatformAccel() {
    return getPlatformAccel();
  },

  // add id for key Browser:Reload
  _setReloadKeyId(aWindow) {
    let reload = aWindow.document.getElementsByAttribute("command", "Browser:Reload");
    if (!reload)
      return;
    Array.prototype.some.call(reload, function(key) {
      if (key.getAttribute("keycode") != "VK_F5")
        return false;
      if (!this.keys.browserReload.id) {
        let index = 2, id;
        do {
          id = "key_reload#".replace("#", index++);
        } while (aWindow.document.getElementById(id));
        this.keys.browserReload.id = key.id = id;
      } else {
        key.id = this.keys.browserReload.id;
      }
      return true;
    }, this);
  }

};

KeyConfig = {
  prefsChangedByTabmix: false,
  // when keyConfig extension installed sync the preference
  // user may change shortcuts in both extensions
  init() {
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
    // sync non default shortcuts
    if (Object.keys(shortcuts).length)
      this.syncToKeyConfig(shortcuts);
    else {
      let prefs = this.prefs.getChildList("").filter(function(pref) {
        let key = this.keyIdsMap[pref];
        return key && this.syncFromKeyConfig(key, pref, shortcuts);
      }, this);
      if (prefs.length) {
        // we are here before onWindowOpen call updateWindowKeys
        // so we don't need to do anything else here
        Shortcuts.prefBackup = shortcuts;
        Shortcuts.setShortcutsPref();
      }
    }
    this.resetPref(oldReloadId);
    this.prefs.addObserver("", this);
  },

  deinit() {
    this.prefs.removeObserver("", this);
  },

  observe(aSubject, aTopic, aData) {
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

  syncFromKeyConfig(aKey, aPrefName, aShortcuts) {
    let prefValue, newValue, keyData = Shortcuts.keys[aKey];
    try {
      prefValue = getPref("keyconfig.main." + aPrefName).split("][");
    } catch (ex) { }
    if (!prefValue)
      newValue = keyData.default;
    else if (/^!/.test(prefValue))
      newValue = "d&";
    else {
      let newKey = {
        modifiers: prefValue[0].replace(" ", ","),
        key: prefValue[1],
        keycode: prefValue[2]
      };
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

  syncToKeyConfig(aChangedKeys, onChange) {
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

  resetPref(prefName) {
    this.prefs.clearUserPref(prefName);
  }

};

function getPref(name) {
  return Services.prefs.getStringPref(name);
}

function setPref(name, value) {
  Services.prefs.setStringPref(name, value);
}

function getFormattedKey(key) {
  if (!key)
    return "";
  var val = "";

  if (key.modifiers) {
    let sep = getPlatformKeys("MODIFIER_SEPARATOR");
    key.modifiers.replace(/^[\s,]+|[\s,]+$/g, "").split(/[\s,]+/g).forEach(mod => {
      if (/alt|shift|control|meta|accel/.test(mod))
        val += getPlatformKeys("VK_" + mod.toUpperCase()) + sep;
    });
  }

  if (key.key) {
    if (key.key == " ") {
      key.key = "";
      key.keycode = "VK_SPACE";
    } else {
      val += key.key.toUpperCase();
    }
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
    case 17: return "control";
    case 18: return "alt";
    case 224: return "meta";
  }
  return (Services.appinfo.OS == "Darwin" ? "meta" : "control");
}
