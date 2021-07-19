/* globals dump */
"use strict";

this.EXPORTED_SYMBOLS = ["TabmixSvc"];

const {XPCOMUtils} = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

ChromeUtils.defineModuleGetter(this, "TabmixPlacesUtils",
  "chrome://tabmix-resource/content/Places.jsm");

ChromeUtils.defineModuleGetter(this, "SyncedTabs",
  "chrome://tabmix-resource/content/SyncedTabs.jsm");

// place holder for load default preferences function
// eslint-disable-next-line no-unused-vars
var pref;

var _versions = {};
function isVersion(aVersionNo) {
  let firefox, waterfox, basilisk;
  if (typeof aVersionNo === 'object') {
    firefox = aVersionNo.ff || 0;
    waterfox = aVersionNo.wf || "";
    basilisk = aVersionNo.bs || "";

    if (!firefox && !waterfox && !basilisk) {
      TabmixSvc.console.log('invalid version check ' + JSON.stringify(aVersionNo));
      return true;
    }
    aVersionNo = firefox;
  }

  if (TabmixSvc.isWaterfox && waterfox) {
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
  aboutBlank: "about:blank",
  aboutNewtab: "about:#".replace("#", "newtab"),
  newtabUrl: "browser.#.url".replace("#", "newtab"),

  // load Tabmix preference to the default branch
  _defaultPreferencesLoaded: false,
  loadDefaultPreferences() {
    if (this._defaultPreferencesLoaded) {
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

  windowStartup: {
    QueryInterface: ChromeUtils.generateQI([Ci.nsIObserver,
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

      TabmixSvc.sortByRecentlyUsed = isVersion(890) ?
        "browser.ctrlTab.sortByRecentlyUsed" : "browser.ctrlTab.recentlyUsedOrder";

      try {
        // replace old Settings.
        // we must call this before any other tabmix function
        aWindow.gTMPprefObserver.updateSettings();
      } catch (ex) {
        TabmixSvc.console.assert(ex);
      }

      this.addMissingPrefs();

      Services.obs.addObserver(this, "quit-application", true);

      ChromeUtils.import("chrome://tabmix-resource/content/DownloadLastDir.jsm");

      TabmixPlacesUtils.init(aWindow);
      if (!(TabmixSvc.isBasilisk && TabmixSvc.version({bs: "52.9.2019.06.08"}))) {
        this.syncedTabsInitialized = true;
        SyncedTabs.init(aWindow);
      }

      TabmixSvc.tabStylePrefs = {};
      const {DynamicRules} = ChromeUtils.import("chrome://tabmix-resource/content/DynamicRules.jsm");
      DynamicRules.init(aWindow);

      ChromeUtils.import("chrome://tabmix-resource/content/TabRestoreQueue.jsm", {});
    },

    addMissingPrefs() {
      // add missing preference to the default branch
      let prefs = Services.prefs.getDefaultBranch("");

      if (!TabmixSvc.isCyberfox) {
        prefs.setCharPref(TabmixSvc.newtabUrl, TabmixSvc.aboutNewtab);
        ChromeUtils.import("chrome://tabmix-resource/content/NewTabURL.jsm", {});
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
    restoreCount: -1,
    observersWereNotified: false,
  },

  setCustomTabValue(tab, key, value) {
    if (value === null || value === undefined) {
      this.ss.deleteCustomTabValue(tab, key);
    } else {
      this.ss.setCustomTabValue(tab, key, value);
    }
  },

  isFixedGoogleUrl: () => false,

  blockedClickingOptions: [],

  get i10IdMap() {
    // map ftl key for older firefox versions
    return {
      "tab-context-open-in-container": {before: 880, l10n: "reopen-in-container"},
      "tab-context-reopen-closed-tabs": {before: 880, l10n: "tab-context-undo-close-tabs"},
      "tab-context-open-in-new-container-tab": {before: 880, l10n: "reopen-in-container"},
      "tab-context-close-tabs": {before: 800, l10n: "close-tab"},
    };
  },
};

XPCOMUtils.defineLazyGetter(TabmixSvc, "prefs", () => {
  const {Preferences} = ChromeUtils.import("resource://gre/modules/Preferences.jsm");
  return new Preferences("");
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
  return (ChromeUtils.import("resource://gre/modules/AppConstants.jsm", {})).AppConstants.platform;
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

XPCOMUtils.defineLazyGetter(TabmixSvc, "isWaterfox", () => {
  return Services.appinfo.name == "Waterfox";
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "isBasilisk", () => {
  return Services.appinfo.name == "Basilisk";
});

ChromeUtils.defineModuleGetter(TabmixSvc, "FileUtils",
  "resource://gre/modules/FileUtils.jsm");

ChromeUtils.defineModuleGetter(TabmixSvc, "console",
  "chrome://tabmix-resource/content/log.jsm");

XPCOMUtils.defineLazyGetter(TabmixSvc, "SessionStoreGlobal", () => {
  // Don't ChromeUtils.import here it can not import variables that
  // are not in EXPORTED_SYMBOLS
  // eslint-disable-next-line mozilla/use-chromeutils-import
  return Cu.import("resource:///modules/sessionstore/SessionStore.jsm");
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "ss", function() {
  return this.SessionStoreGlobal.SessionStore;
});

XPCOMUtils.defineLazyGetter(TabmixSvc, "SessionStore", function() {
  return this.SessionStoreGlobal.SessionStoreInternal;
});
