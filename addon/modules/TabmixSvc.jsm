/* globals dump */
"use strict";

const EXPORTED_SYMBOLS = ["TabmixSvc"];

const {AppConstants} = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");

const lazy = {};
ChromeUtils.defineModuleGetter(lazy, "TabmixPlacesUtils",
  "chrome://tabmix-resource/content/Places.jsm");

ChromeUtils.defineModuleGetter(lazy, "SyncedTabs",
  "chrome://tabmix-resource/content/SyncedTabs.jsm");

ChromeUtils.defineModuleGetter(lazy, "isVersion",
  "chrome://tabmix-resource/content/BrowserVersion.jsm");

ChromeUtils.defineModuleGetter(lazy, "FloorpPrefsObserver",
  "chrome://tabmix-resource/content/Floorp.jsm");

const TabmixSvc = {
  aboutBlank: "about:blank",
  aboutNewtab: "about:#".replace("#", "newtab"),
  newtabUrl: "browser.#.url".replace("#", "newtab"),

  debugMode() {
    return this.prefBranch.prefHasUserValue("enableDebug") &&
      this.prefBranch.getBoolPref("enableDebug");
  },

  version() {
    return lazy.isVersion.apply(null, arguments);
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
    QueryInterface: ChromeUtils.generateQI([
      "nsIObserver",
      "nsISupportsWeakReference",
    ]),

    _initialized: false,

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
      Services.obs.addObserver(this, "browser-lastwindow-close-granted", true);

      ChromeUtils.import("chrome://tabmix-resource/content/DownloadLastDir.jsm");

      lazy.TabmixPlacesUtils.init(aWindow);
      lazy.SyncedTabs.init(aWindow);

      TabmixSvc.tabStylePrefs = {};
      const {DynamicRules} = ChromeUtils.import("chrome://tabmix-resource/content/DynamicRules.jsm");
      DynamicRules.init(aWindow);

      ChromeUtils.import("chrome://tabmix-resource/content/TabRestoreQueue.jsm");

      if (lazy.isVersion(1300)) {
        const {VerticalTabs} = ChromeUtils.import("chrome://tabmix-resource/content/VerticalTabs.jsm");
        VerticalTabs.init(aWindow);
      }

      if (TabmixSvc.isWaterfox) {
        // Waterfox use build-in preference - browser.tabBar.position
        Services.prefs.clearUserPref("extensions.tabmix.tabBarPosition");
        Services.prefs.lockPref("extensions.tabmix.tabBarPosition");
      }

      if (lazy.isVersion({fp: "128.0.0"})) {
        lazy.FloorpPrefsObserver.init();
      }

      aWindow.gTMPprefObserver.setLink_openPrefs();
    },

    addMissingPrefs() {
      // add missing preference to the default branch
      let prefs = Services.prefs.getDefaultBranch("");

      if (!TabmixSvc.isCyberfox) {
        prefs.setCharPref(TabmixSvc.newtabUrl, TabmixSvc.aboutNewtab);
        ChromeUtils.import("chrome://tabmix-resource/content/NewTabURL.jsm");
      }

      if (lazy.isVersion(1310)) {
        prefs.setBoolPref("browser.tabs.tabmanager.enabled", true);
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
          lazy.SyncedTabs.onQuitApplication();
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
    return { };
  },
};

ChromeUtils.defineLazyGetter(TabmixSvc, "prefs", () => {
  const {Preferences} = ChromeUtils.importESModule("resource://gre/modules/Preferences.sys.mjs");
  return new Preferences("");
});

// Tabmix preference branch
ChromeUtils.defineLazyGetter(TabmixSvc, "prefBranch", () => {
  return Services.prefs.getBranch("extensions.tabmix.");
});
// string bundle
ChromeUtils.defineLazyGetter(TabmixSvc, "_strings", () => {
  let properties = "chrome://tabmixplus/locale/tabmix.properties";
  return Services.strings.createBundle(properties);
});
ChromeUtils.defineLazyGetter(TabmixSvc, "SMstrings", () => {
  let properties = "chrome://tabmixplus/locale/session-manager.properties";
  return Services.strings.createBundle(properties);
});

ChromeUtils.defineLazyGetter(lazy, "Platform", () => {
  return AppConstants.platform;
});

ChromeUtils.defineLazyGetter(TabmixSvc, "isWindows", () => {
  return lazy.Platform == "win";
});

ChromeUtils.defineLazyGetter(TabmixSvc, "isMac", () => {
  return lazy.Platform == "macosx";
});

ChromeUtils.defineLazyGetter(TabmixSvc, "isLinux", () => {
  return lazy.Platform == "linux";
});

ChromeUtils.defineLazyGetter(TabmixSvc, "isCyberfox", () => {
  return Services.appinfo.name == "Cyberfox";
});

ChromeUtils.defineLazyGetter(TabmixSvc, "isWaterfox", () => {
  return Services.appinfo.name == "Waterfox";
});

ChromeUtils.defineLazyGetter(TabmixSvc, "isFloorp", () => {
  return Services.appinfo.name == "Floorp";
});

ChromeUtils.defineModuleGetter(TabmixSvc, "console",
  "chrome://tabmix-resource/content/log.jsm");

// TODO: this will stop working with SessionStore.sys.mjs
ChromeUtils.defineLazyGetter(TabmixSvc, "SessionStoreGlobal", () => {
  // Don't ChromeUtils.import here it can not import variables that
  // are not in EXPORTED_SYMBOLS
  // eslint-disable-next-line mozilla/use-chromeutils-import
  return Cu.import("resource:///modules/sessionstore/SessionStore.jsm");
});

ChromeUtils.defineLazyGetter(TabmixSvc, "ss", function() {
  return this.SessionStoreGlobal.SessionStore;
});

ChromeUtils.defineLazyGetter(TabmixSvc, "SessionStore", function() {
  return this.SessionStoreGlobal.SessionStoreInternal;
});

ChromeUtils.defineLazyGetter(TabmixSvc.sm, "TAB_STATE_NEEDS_RESTORE", () => {
  return TabmixSvc.SessionStoreGlobal.TAB_STATE_NEEDS_RESTORE;
});

ChromeUtils.defineLazyGetter(TabmixSvc.sm, "TAB_STATE_RESTORING", () => {
  return TabmixSvc.SessionStoreGlobal.TAB_STATE_RESTORING;
});
