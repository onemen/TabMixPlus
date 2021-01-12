/* globals dump */
"use strict";

this.EXPORTED_SYMBOLS = ["TabmixSvc"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/Services.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "TabmixPlacesUtils",
  "resource://tabmixplus/Places.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "SyncedTabs",
  "resource://tabmixplus/SyncedTabs.jsm");

// place holder for load default preferences function
// eslint-disable-next-line no-unused-vars
var pref;

var tabStateCache;
var _versions = {};
function isVersion(aVersionNo) {
  let firefox, waterfox, palemoon, basilisk;
  if (typeof aVersionNo === 'object') {
    firefox = aVersionNo.ff || 0;
    palemoon = aVersionNo.pm || 0;
    waterfox = aVersionNo.wf || "";
    basilisk = aVersionNo.bs || "";

    if (!firefox && !palemoon && !waterfox && !basilisk) {
      TabmixSvc.console.log('invalid version check ' + JSON.stringify(aVersionNo));
      return true;
    }
    aVersionNo = firefox;
  }

  if (TabmixSvc.isPaleMoonID) {
    let paleMoonVer = palemoon || (arguments.length > 1 ? arguments[1] : -1);
    if (aVersionNo > 240 && paleMoonVer == -1)
      return false;
    aVersionNo = paleMoonVer;
  } else if (TabmixSvc.isWaterfox && waterfox) {
    aVersionNo = waterfox;
  } else if (TabmixSvc.isBasilisk && basilisk) {
    aVersionNo = basilisk;
  }

  if (typeof _versions[aVersionNo] == "boolean")
    return _versions[aVersionNo];

  let v = Services.appinfo.version;

  if (TabmixSvc.isWaterfox && waterfox || TabmixSvc.isBasilisk && basilisk) {
    return (_versions[aVersionNo] = Services.vc.compare(v, aVersionNo) >= 0);
  }

  return (_versions[aVersionNo] = Services.vc.compare(v, aVersionNo / 10 + ".0a1") >= 0);
}

this.TabmixSvc = {
  get selectedAtt() {
    delete this.selectedAtt;
    return (this.selectedAtt = isVersion(390) ? "visuallyselected" : "selected");
  },

  aboutBlank: "about:blank",
  aboutNewtab: "about:#".replace("#", "newtab"),
  newtabUrl: "browser.#.url".replace("#", "newtab"),

  // load Tabmix preference to the default branch
  _defaultPreferencesLoaded: false,
  loadDefaultPreferences() {
    if (!isVersion(580) || this._defaultPreferencesLoaded) {
      return;
    }
    this._defaultPreferencesLoaded = true;
    const prefs = Services.prefs.getDefaultBranch("");
    pref = function(prefName, prefValue) {
      switch (prefValue.constructor.name) {
        case "String":
          prefs.setCharPref(prefName, prefValue);
          break;
        case "Number":
          prefs.setIntPref(prefName, prefValue);
          break;
        case "Boolean":
          prefs.setBoolPref(prefName, prefValue);
          break;
        default:
          TabmixSvc.console.reportError(`can't set pref ${prefName} to value '${prefValue}'; ` +
            `it isn't a String, Number, or Boolean`);
      }
    };
    try {
      const path = "chrome://tabmix-prefs/content/tabmix.js";
      Services.scriptloader.loadSubScript(path, {});
    } catch (ex) {
      TabmixSvc.console.reportError(ex);
    }
    // eslint-disable-next-line no-unused-vars
    pref = null;
  },

  getStringPref(prefName) {
    if (isVersion(580)) {
      return Services.prefs.getStringPref(prefName);
    }
    return Services.prefs.getComplexValue(prefName, Ci.nsISupportsString).data;
  },

  setStringPref(prefName, prefValue) {
    if (isVersion(580)) {
      Services.prefs.setStringPref(prefName, prefValue);
    } else {
      let str = Cc["@mozilla.org/supports-string;1"]
          .createInstance(Ci.nsISupportsString);
      str.data = prefValue;
      Services.prefs.setComplexValue(prefName, Ci.nsISupportsString, str);
    }
  },

  debugMode() {
    return this.prefBranch.prefHasUserValue("enableDebug") &&
      this.prefBranch.getBoolPref("enableDebug");
  },

  version() {
    return isVersion.apply(null, arguments);
  },

  getString(aStringKey) {
    try {
      return this._strings.GetStringFromName(aStringKey);
    } catch (e) {
      dump("*** Failed to get string " + aStringKey + " in bundle: tabmix.properties\n");
      throw e;
    }
  },

  getFormattedString(aStringKey, aStringsArray) {
    try {
      return this._strings.formatStringFromName(aStringKey, aStringsArray, aStringsArray.length);
    } catch (e) {
      dump("*** Failed to format string " + aStringKey + " in bundle: tabmix.properties\n");
      throw e;
    }
  },

  getSMString(aStringKey) {
    try {
      return this.SMstrings.GetStringFromName(aStringKey);
    } catch (e) {
      dump("*** Failed to get string " + aStringKey + " in bundle: session-manager.properties\n");
      throw e;
    }
  },

  setLabel(property) {
    var label, key;
    if (property.startsWith("sm.")) {
      label = this.getSMString(property + ".label");
      key = this.getSMString(property + ".accesskey");
    } else {
      label = this.getString(property + ".label");
      key = this.getString(property + ".accesskey");
    }
    var accessKeyIndex = label.toLowerCase().indexOf(key.toLowerCase());
    if (accessKeyIndex > -1)
      label = label.substr(0, accessKeyIndex) + "&" + label.substr(accessKeyIndex);
    return label;
  },

  getDialogStrings(...keys) {
    let stringBundle = Services.strings.createBundle("chrome://global/locale/commonDialogs.properties");

    return keys.map(key => {
      try {
        return stringBundle.GetStringFromName(key);
      } catch (ex) {
        this.console.log("Failed to get string " + key + " in bundle: commonDialogs.properties");
        return key;
      }
    });
  },

  topWin() {
    return Services.wm.getMostRecentWindow("navigator:browser");
  },

  get direct2dDisabled() {
    delete this.direct2dDisabled;
    try {
      // this pref exist only in windows
      return (this.direct2dDisabled = Services.prefs.getBoolPref("gfx.direct2d.disabled"));
    } catch (ex) {}
    return (this.direct2dDisabled = false);
  },

  /**
   * call a callback for all currently opened browser windows
   * (might miss the most recent one)
   * @param aFunc
   *        Callback each window is passed to
   */
  forEachBrowserWindow(aFunc) {
    let windowsEnum = Services.wm.getEnumerator("navigator:browser");
    while (windowsEnum.hasMoreElements()) {
      let window = windowsEnum.getNext();
      if (!window.closed) {
        aFunc(window);
      }
    }
  },

  // some extensions override native JSON so we use nsIJSON
  JSON: {
    nsIJSON: null,
    parse: function TMP_parse(str) {
      try {
        return JSON.parse(str);
      } catch (ex) {
        try {
          return "decode" in this.nsIJSON ? this.nsIJSON.decode(str) : null;
        } catch (er) {
          return null;
        }
      }
    },
    stringify: function TMP_stringify(obj) {
      try {
        return JSON.stringify(obj);
      } catch (ex) {
        try {
          return "encode" in this.nsIJSON ? this.nsIJSON.encode(obj) : null;
        } catch (er) {
          return null;
        }
      }
    }
  },

  windowStartup: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
      Ci.nsISupportsWeakReference]),

    _initialized: false,

    syncedTabsInitialized: false,

    init(aWindow) {
      // windowStartup must only be called once for each window
      if ("firstWindowInSession" in aWindow.Tabmix)
        return;
      aWindow.Tabmix.firstWindowInSession = !this._initialized;
      if (this._initialized)
        return;
      this._initialized = true;

      try {
        // replace old Settings.
        // we must call this before any other tabmix function
        aWindow.gTMPprefObserver.updateSettings();
      } catch (ex) {
        TabmixSvc.console.assert(ex);
      }

      this.addMissingPrefs();

      Services.obs.addObserver(this, "quit-application", true);

      Cu.import("resource://tabmixplus/DownloadLastDir.jsm", {});

      TabmixPlacesUtils.init(aWindow);
      if (TabmixSvc.version(470) && !(TabmixSvc.isBasilisk && TabmixSvc.version({bs: "52.9.2019.06.08"}))) {
        this.syncedTabsInitialized = true;
        SyncedTabs.init(aWindow);
      }

      TabmixSvc.tabStylePrefs = {};
      let tmp = {};
      Cu.import("resource://tabmixplus/DynamicRules.jsm", tmp);
      tmp.DynamicRules.init(aWindow);

      Cu.import("resource://tabmixplus/TabRestoreQueue.jsm", {});

      if (TabmixSvc.version(510)) {
        try {
          Cu.import("resource://tabmixplus/extensions/EmbeddedWebExtension.jsm", {});
        } catch (ex) {
          TabmixSvc.console.reportError(ex);
        }
      }
    },

    addMissingPrefs() {
      // add missing preference to the default branch
      let prefs = Services.prefs.getDefaultBranch("");

      if (TabmixSvc.australis) {
        prefs.setBoolPref("extensions.tabmix.squaredTabsStyle", false);
      }

      if (isVersion(320))
        prefs.setBoolPref("extensions.tabmix.tabcontext.openNonRemoteWindow", true);

      if (isVersion(410) && !TabmixSvc.isCyberfox) {
        prefs.setCharPref(TabmixSvc.newtabUrl, TabmixSvc.aboutNewtab);
        Cu.import("resource://tabmixplus/NewTabURL.jsm", {});
      }
    },

    observe(aSubject, aTopic) {
      switch (aTopic) {
        case "quit-application":
          TabmixPlacesUtils.onQuitApplication();
          if (this.syncedTabsInitialized) {
            SyncedTabs.onQuitApplication();
          }
          for (let id of Object.keys(TabmixSvc.console._timers)) {
            let timer = TabmixSvc.console._timers[id];
            timer.cancel();
          }
          delete TabmixSvc.SessionStoreGlobal;
          delete TabmixSvc.SessionStore;
          break;
      }
    }
  },

  saveTabAttributes(tab, attrib, save) {
    tabStateCache.saveTabAttributes(tab, attrib, save);
  },

  sm: {
    lastSessionPath: null,
    persistTabAttributeSet: false,
    status: "",
    crashed: false,
    get sanitized() {
      delete this.sanitized;
      return (this.sanitized = TabmixSvc.prefBranch.prefHasUserValue("sessions.sanitized"));
    },
    set sanitized(val) {
      delete this.sanitized;
      return (this.sanitized = val);
    },
    private: true,
    settingPreference: false,
    statesToRestore: {},
    deferredInitialized: null,
    restoreCount: -1,
    observersWereNotified: false,
  },

  isAustralisBgStyle(orient) {
    if (typeof orient != "string") {
      throw Components.Exception("orient is not valid", Components.results.NS_ERROR_INVALID_ARG);
    }
    return TabmixSvc.australis && orient == "horizontal" &&
      !this.prefBranch.getBoolPref("squaredTabsStyle");
  },

  isFixedGoogleUrl: () => false,

  blockedClickingOptions: []
};

XPCOMUtils.defineLazyGetter(TabmixSvc.JSON, "nsIJSON", () => {
  return Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
});

// check if australis tab shape is implemented
XPCOMUtils.defineLazyGetter(TabmixSvc, "australis", function() {
  return Boolean(this.topWin().document.getElementById("tab-curve-clip-path-start"));
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "prefs", () => {
  let tmp = {};
  Cu.import("resource://gre/modules/Preferences.jsm", tmp);
  return new tmp.Preferences("");
});

// Tabmix preference branch
XPCOMUtils.defineLazyGetter(TabmixSvc, "prefBranch", () => {
  return Services.prefs.getBranch("extensions.tabmix.");
});
// string bundle
XPCOMUtils.defineLazyGetter(TabmixSvc, "_strings", () => {
  let properties = "chrome://tabmixplus/locale/tabmix.properties";
  return Services.strings.createBundle(properties);
});
XPCOMUtils.defineLazyGetter(TabmixSvc, "SMstrings", () => {
  let properties = "chrome://tabmixplus/locale/session-manager.properties";
  return Services.strings.createBundle(properties);
});

XPCOMUtils.defineLazyGetter(this, "Platform", () => {
  if (isVersion(390)) {
    return (Cu.import("resource://gre/modules/AppConstants.jsm", {})).AppConstants.platform;
  }
  let platform,
      os = Services.appinfo.OS.toLowerCase();
  if (os.startsWith("win")) {
    platform = "win";
  } else if (os == "darwin") {
    platform = "macosx";
  } else if (os == "linux") {
    platform = "linux";
  }
  return platform;
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "isWindows", () => {
  return Platform == "win";
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "isMac", () => {
  return Platform == "macosx";
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "isLinux", () => {
  return Platform == "linux";
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "isCyberfox", () => {
  return Services.appinfo.name == "Cyberfox";
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "isPaleMoon", () => {
  return Services.appinfo.name == "Pale Moon";
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "isPaleMoonID", () => {
  try {
    // noinspection SpellCheckingInspection
    return Services.appinfo.ID == "{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}";
  } catch (ex) {
  }
  return false;
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "isWaterfox", () => {
  return Services.appinfo.name == "Waterfox";
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "isBasilisk", () => {
  return Services.appinfo.name == "Basilisk";
});

XPCOMUtils.defineLazyModuleGetter(TabmixSvc, "FileUtils",
  "resource://gre/modules/FileUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(TabmixSvc, "console",
  "resource://tabmixplus/log.jsm");

XPCOMUtils.defineLazyGetter(TabmixSvc, "SessionStoreGlobal", () => {
  const sessionStoreModule = Cu.import("resource:///modules/sessionstore/SessionStore.jsm", {});
  if (isVersion(570)) {
    return sessionStoreModule;
  }
  return Cu.getGlobalForObject(sessionStoreModule);
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "ss", function() {
  return this.SessionStoreGlobal.SessionStore;
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "SessionStore", function() {
  return this.SessionStoreGlobal.SessionStoreInternal;
});

// Firefox 54
// Bug 1307736 - Assert history loads pass a valid triggeringPrincipal for docshell loads
XPCOMUtils.defineLazyGetter(TabmixSvc, "SERIALIZED_SYSTEMPRINCIPAL", function() {
  return this.SessionStoreGlobal.Utils &&
      this.SessionStoreGlobal.Utils.SERIALIZED_SYSTEMPRINCIPAL || null;
});

// Firefox 55
// Bug 1352069 - Introduce a pref that allows for disabling cosmetic animations
XPCOMUtils.defineLazyGetter(TabmixSvc, "tabAnimationsEnabled", () => {
  return isVersion(550) ?
    Services.prefs.getBoolPref("toolkit.cosmeticAnimations.enabled") :
    Services.prefs.getBoolPref("browser.tabs.animate");
});

tabStateCache = {
  saveTabAttributes(tab, attrib, save = true) {
    if (TabmixSvc.isPaleMoon) {
      return;
    }

    // force Sessionstore to save our persisted tab attributes
    if (save) {
      TabmixSvc.SessionStore.saveStateDelayed(tab.ownerGlobal);
    }

    // After bug 1166757 - Remove browser.__SS_data, we have nothing more to do.
    if (isVersion(410))
      return;

    let attribs = attrib.split(",");
    function update(attributes) {
      attribs.forEach(key => {
        if (tab.hasAttribute(key))
          attributes[key] = tab.getAttribute(key);
        else if (key in attributes)
          delete attributes[key];
      });
    }

    let browser = tab.linkedBrowser;
    if (browser.__SS_data) {
      if (!browser.__SS_data.attributes)
        browser.__SS_data.attributes = {};
      update(browser.__SS_data.attributes);
    }
  }
};
