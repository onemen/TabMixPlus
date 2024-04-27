/* globals dump */
"use strict";

const EXPORTED_SYMBOLS = ["TabmixSvc"];

const {TabmixChromeUtils} = ChromeUtils.import("chrome://tabmix-resource/content/ChromeUtils.jsm");
const Services = globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
const {AppConstants} = TabmixChromeUtils.import("resource://gre/modules/AppConstants.jsm");

const lazy = {};
ChromeUtils.defineModuleGetter(lazy, "TabmixPlacesUtils",
  "chrome://tabmix-resource/content/Places.jsm");

ChromeUtils.defineModuleGetter(lazy, "SyncedTabs",
  "chrome://tabmix-resource/content/SyncedTabs.jsm");

// place holder for load default preferences function
// eslint-disable-next-line no-unused-vars
var pref;
let TabmixSvc;

var _versions = {};
function isVersion(aVersionNo, updateChannel) {
  let firefox, waterfox, basilisk;
  if (typeof aVersionNo === 'object') {
    firefox = aVersionNo.ff || 0;
    waterfox = aVersionNo.wf || "";
    basilisk = aVersionNo.bs || "";
    updateChannel = aVersionNo.updateChannel || null;

    if (!firefox && !waterfox && !basilisk) {
      TabmixSvc.console.log('invalid version check ' + JSON.stringify(aVersionNo));
      return true;
    }
    if (!firefox && !TabmixSvc.isWaterfox && !TabmixSvc.isBasilisk) {
      return false;
    }
    aVersionNo = firefox;
  }

  if (
    updateChannel &&
    Services.appinfo.defaultUpdateChannel.toLowerCase() !== updateChannel.toLowerCase()
  ) {
    return false;
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

  const suffix = Services.appinfo.vendor === "LibreWolf" ? ".0-1" : ".0a1";
  return (_versions[aVersionNo] = Services.vc.compare(v, aVersionNo / 10 + suffix) >= 0);
}

TabmixSvc = {
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
      const setPref = setPrefType => {
        try {
          prefs[setPrefType](prefName, prefValue);
        } catch (ex1) {
          try {
            // current value is invalid or deleted by the user
            Services.prefs[setPrefType](prefName, prefValue);
            prefs[setPrefType](prefName, prefValue);
            Services.prefs.clearUserPref(prefName);
          } catch (ex2) {
            TabmixSvc.console.reportError(`errored twice when trying to set ${prefName} default`);
            TabmixSvc.console.reportError(ex1);
            TabmixSvc.console.reportError(ex2);
          }
        }
      };

      switch (prefValue.constructor.name) {
        case "String":
          setPref("setCharPref");
          break;
        case "Number":
          setPref("setIntPref");
          break;
        case "Boolean":
          setPref("setBoolPref");
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
      } catch {
        this.console.log("Failed to get string " + key + " in bundle: commonDialogs.properties");
        return key;
      }
    });
  },

  topWin() {
    return Services.wm.getMostRecentWindow("navigator:browser");
  },

  skipSingleWindowModeCheck: false,
  getSingleWindowMode() {
    // if we don't have any browser window opened return false
    // so we can open new window
    if (this.skipSingleWindowModeCheck || !this.topWin()) {
      return false;
    }
    return this.prefBranch.getBoolPref("singleWindow");
  },

  get direct2dDisabled() {
    delete this.direct2dDisabled;
    try {
      // this pref exist only in windows
      return (this.direct2dDisabled = Services.prefs.getBoolPref("gfx.direct2d.disabled"));
    } catch {}
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
      Services.obs.addObserver(this, "browser-lastwindow-close-granted", true);

      ChromeUtils.import("chrome://tabmix-resource/content/DownloadLastDir.jsm");

      lazy.TabmixPlacesUtils.init(aWindow);
      if (!(TabmixSvc.isBasilisk && TabmixSvc.version({bs: "52.9.2019.06.08"}))) {
        this.syncedTabsInitialized = true;
        lazy.SyncedTabs.init(aWindow);
      }

      TabmixSvc.tabStylePrefs = {};
      const {DynamicRules} = ChromeUtils.import("chrome://tabmix-resource/content/DynamicRules.jsm");
      DynamicRules.init(aWindow);

      ChromeUtils.import("chrome://tabmix-resource/content/TabRestoreQueue.jsm");

      if (TabmixSvc.isG3Waterfox) {
        // Waterfox use build-in preference - browser.tabBar.position
        Services.prefs.clearUserPref("extensions.tabmix.tabBarPosition");
        Services.prefs.lockPref("extensions.tabmix.tabBarPosition");
      }
    },

    addMissingPrefs() {
      // add missing preference to the default branch
      let prefs = Services.prefs.getDefaultBranch("");

      if (!TabmixSvc.isCyberfox) {
        prefs.setCharPref(TabmixSvc.newtabUrl, TabmixSvc.aboutNewtab);
        ChromeUtils.import("chrome://tabmix-resource/content/NewTabURL.jsm");
      }
    },

    observe(aSubject, aTopic) {
      switch (aTopic) {
        case "browser-lastwindow-close-granted": {
          Services.obs.removeObserver(this, "browser-lastwindow-close-granted");
          // we close tabmix dialog windows when last browser closed
          Services.wm.getMostRecentWindow("mozilla:tabmixopt")?.closeAll();
          break;
        }
        case "quit-application":
          Services.obs.removeObserver(this, "quit-application");
          lazy.TabmixPlacesUtils.onQuitApplication();
          if (this.syncedTabsInitialized) {
            lazy.SyncedTabs.onQuitApplication();
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
    status: "",
    crashed: false,
    get sanitized() {
      delete this.sanitized;
      return (this.sanitized = TabmixSvc.prefBranch.prefHasUserValue("sessions.sanitized"));
    },
    set sanitized(val) {
      delete this.sanitized;
      this.sanitized = val;
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
      "tab-context-close-n-tabs": {before: 920, l10n: "tab-context-close-tabs"},
      "tab-context-close-tabs": {before: 800, l10n: "close-tab"},
      "tab-context-bookmark-tab": {before: 1050, l10n: "bookmark-tab"},
    };
  },
};

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "prefs", () => {
  const {Preferences} = TabmixChromeUtils.import("resource://gre/modules/Preferences.jsm");
  return new Preferences("");
});

// Tabmix preference branch
TabmixChromeUtils.defineLazyGetter(TabmixSvc, "prefBranch", () => {
  return Services.prefs.getBranch("extensions.tabmix.");
});
// string bundle
TabmixChromeUtils.defineLazyGetter(TabmixSvc, "_strings", () => {
  let properties = "chrome://tabmixplus/locale/tabmix.properties";
  return Services.strings.createBundle(properties);
});
TabmixChromeUtils.defineLazyGetter(TabmixSvc, "SMstrings", () => {
  let properties = "chrome://tabmixplus/locale/session-manager.properties";
  return Services.strings.createBundle(properties);
});

TabmixChromeUtils.defineLazyGetter(lazy, "Platform", () => {
  return AppConstants.platform;
});

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "isWindows", () => {
  return lazy.Platform == "win";
});

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "isMac", () => {
  return lazy.Platform == "macosx";
});

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "isLinux", () => {
  return lazy.Platform == "linux";
});

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "isCyberfox", () => {
  return Services.appinfo.name == "Cyberfox";
});

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "isWaterfox", () => {
  return Services.appinfo.name == "Waterfox";
});

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "isG3Waterfox", () => {
  return Services.appinfo.name == "Waterfox" && isVersion(780);
});

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "isG5Waterfox", () => {
  return Services.appinfo.name == "Waterfox" && isVersion(1020);
});

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "isBasilisk", () => {
  return Services.appinfo.name == "Basilisk";
});

TabmixChromeUtils.defineLazyModuleGetters(TabmixSvc, {
  FileUtils: "resource://gre/modules/FileUtils.jsm",
  //
});

ChromeUtils.defineModuleGetter(TabmixSvc, "console",
  "chrome://tabmix-resource/content/log.jsm");

// TODO: this will stop working with SessionStore.sys.mjs
TabmixChromeUtils.defineLazyGetter(TabmixSvc, "SessionStoreGlobal", () => {
  // Don't ChromeUtils.import here it can not import variables that
  // are not in EXPORTED_SYMBOLS
  // eslint-disable-next-line mozilla/use-chromeutils-import
  return Cu.import("resource:///modules/sessionstore/SessionStore.jsm");
});

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "ss", function() {
  return this.SessionStoreGlobal.SessionStore;
});

TabmixChromeUtils.defineLazyGetter(TabmixSvc, "SessionStore", function() {
  return this.SessionStoreGlobal.SessionStoreInternal;
});

TabmixSvc.loadDefaultPreferences();
