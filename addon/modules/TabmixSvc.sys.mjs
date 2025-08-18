import {AppConstants} from "resource://gre/modules/AppConstants.sys.mjs";

/** @type {TabmixSvcModule.Lazy} */ // @ts-ignore
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
  FloorpPrefsObserver: "chrome://tabmix-resource/content/Floorp.sys.mjs",
  isVersion: "chrome://tabmix-resource/content/BrowserVersion.sys.mjs",
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
  SyncedTabs: "chrome://tabmix-resource/content/SyncedTabs.sys.mjs",
  TabmixPlacesUtils: "chrome://tabmix-resource/content/Places.sys.mjs",
});

/** @type {TabmixSvcModule.TabmixSvc} */
export const TabmixSvc = {
  aboutBlank: "about:blank",
  aboutNewtab: "about:#".replace("#", "newtab"),
  newtabUrl: "browser.#.url".replace("#", "newtab"),

  // @ts-expect-error - initialize tabStylePrefs
  tabStylePrefs: {},
  URILoadingHelperChanged: false,

  version(versionNo, updateChannel) {
    return lazy.isVersion.apply(null, [versionNo, updateChannel]);
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
      return this._strings.formatStringFromName(aStringKey, aStringsArray);
    } catch (e) {
      dump("*** Failed to format string " + aStringKey + " in bundle: tabmix.properties\n");
      throw e;
    }
  },

  setLabel(property) {
    let label = this.getString(property + ".label");
    const key = this.getString(property + ".accesskey");
    const accessKeyIndex = label.toLowerCase().indexOf(key.toLowerCase());
    if (accessKeyIndex > -1) {
      label = label.substr(0, accessKeyIndex) + "&" + label.substr(accessKeyIndex);
    }

    return label;
  },

  getDialogStrings(...keys) {
    let stringBundle = Services.strings.createBundle(
      "chrome://global/locale/commonDialogs.properties"
    );

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

  /**
   * call a callback for all currently opened browser windows (might miss the
   * most recent one)
   *
   * @param aFunc Callback each window is passed to
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
    QueryInterface: ChromeUtils.generateQI(["nsIObserver", "nsISupportsWeakReference"]),

    _initialized: false,

    init(aWindow) {
      // windowStartup must only be called once for each window
      if ("firstWindowInSession" in aWindow.Tabmix) {
        return;
      }

      aWindow.Tabmix.firstWindowInSession = !this._initialized;
      if (this._initialized) {
        return;
      }

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

      ChromeUtils.importESModule("chrome://tabmix-resource/content/DownloadLastDir.sys.mjs");

      lazy.TabmixPlacesUtils.init(aWindow);
      lazy.SyncedTabs.init(aWindow);

      if (lazy.isVersion(1300)) {
        const {VerticalTabs} = ChromeUtils.importESModule(
          "chrome://tabmix-resource/content/VerticalTabs.sys.mjs"
        );
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

      //  Bug 1742801 - move whereToOpenLink and getRootEvent implementations into BrowserUtils
      //  Bug 1742889 - Rewrite consumers of whereToOpenLink to use BrowserUtils.whereToOpenLink
      aWindow.Tabmix.onContentLoaded.change_whereToOpenLink(lazy.BrowserUtils);
    },

    addMissingPrefs() {
      // add missing preference to the default branch
      let prefs = Services.prefs.getDefaultBranch("");

      if (!TabmixSvc.isCyberfox) {
        prefs.setCharPref(TabmixSvc.newtabUrl, TabmixSvc.aboutNewtab);
        ChromeUtils.importESModule("chrome://tabmix-resource/content/NewTabURL.sys.mjs");
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

          // Cancel any console timers
          Object.values(TabmixSvc.console._timers).forEach(timer => timer.cancel());
          TabmixSvc.console._timers = {};
          break;
      }
    },
  },

  sm: {
    TAB_STATE_NEEDS_RESTORE: 1,
    TAB_STATE_RESTORING: 2,
  },

  setCustomTabValue(tab, key, value) {
    if (value === null || value === undefined) {
      lazy.SessionStore.deleteCustomTabValue(tab, key);
    } else {
      lazy.SessionStore.setCustomTabValue(tab, key, value);
    }
  },

  isFixedGoogleUrl: () => false,

  blockedClickingOptions: [],

  get i10IdMap() {
    // map ftl key for older firefox versions
    return {};
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

ChromeUtils.defineLazyGetter(TabmixSvc, "isZen", () => {
  return Services.appinfo.name == "Zen";
});

ChromeUtils.defineLazyGetter(TabmixSvc, "console", () => {
  return ChromeUtils.importESModule("chrome://tabmix-resource/content/log.sys.mjs").console;
});
