import {isVersion} from "chrome://tabmix-resource/content/BrowserVersion.sys.mjs";

const isFirefoxVerticalMode = isVersion({fp: "143.0.0"});

const PREFS = ["extensions.tabmix.tabBarMode", "userChrome.padding.tabbar_height"];
if (!isFirefoxVerticalMode) {
  PREFS.push("floorp.tabbar.style");
}

/**
 * Floorp only writes some of the preferences this module observes from its own
 * theme modules (the Lepton userjs sets userChrome.padding.tabbar_height), so
 * they may not exist yet when windowStartup.init() runs.
 *
 * Reading them without a fallback used to throw NS_ERROR_UNEXPECTED out of
 * init(), which skipped setLink_openPrefs() and change_whereToOpenLink() in
 * windowStartup.init() - see issue #591.
 *
 * @param {string} name
 * @param {boolean} [fallback=false] Default is `false`
 * @returns {boolean}
 */
function getBoolPref(name, fallback = false) {
  try {
    return Services.prefs.getBoolPref(name);
  } catch {
    return fallback;
  }
}

/**
 * @param {string} name
 * @param {number} [fallback=0] Default is `0`
 * @returns {number}
 */
function getIntPref(name, fallback = 0) {
  try {
    return Services.prefs.getIntPref(name);
  } catch {
    return fallback;
  }
}

/** @type {FloorpModule.Floorp} */
export const FloorpPrefsObserver = {
  _initialized: false,
  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    // one unusable preference must not keep the remaining observers from
    // being registered, and must not escape into windowStartup.init()
    PREFS.forEach(pref => {
      try {
        this.onPrefChange(pref);
      } catch (ex) {
        console.error(`Tabmix FloorpPrefsObserver ${pref}:`, ex);
      }
    });
    PREFS.forEach(pref => Services.prefs.addObserver(pref, this));
    Services.obs.addObserver(this, "quit-application");
  },

  observe(subject, topic, data) {
    switch (topic) {
      case "nsPref:changed":
        this.onPrefChange(data);
        break;
      case "quit-application":
        this.onQuitApplication();
        break;
    }
  },

  onPrefChange(data) {
    // when in vertical mode exit
    if (isFirefoxVerticalMode) {
      if (getBoolPref("sidebar.verticalTabs")) {
        return;
      }
    } else if (getIntPref("floorp.tabbar.style") === 2 && data !== "floorp.tabbar.style") {
      return;
    }

    switch (data) {
      case "extensions.tabmix.tabBarMode": {
        const pref = "userChrome.padding.tabbar_height";
        const backupPref = `${pref}._backup`;
        const prefValue = getIntPref(data);
        if (prefValue === 2) {
          Services.prefs.setBoolPref(backupPref, getBoolPref(pref));
          Services.prefs.setBoolPref(pref, false);
          if (!isFirefoxVerticalMode) {
            Services.prefs.setIntPref("floorp.tabbar.style", 0);
          }
        } else if (Services.prefs.prefHasUserValue(backupPref)) {
          Services.prefs.setBoolPref(pref, getBoolPref(backupPref));
          Services.prefs.clearUserPref(backupPref);
        }
        break;
      }
      case "floorp.tabbar.style": {
        const pref = "extensions.tabmix.tabBarMode";
        const backupPref = `${pref}._backup`;
        const tabmixInMultiRow = getIntPref(pref) === 2;
        const prefValue = getIntPref(data);
        if (prefValue === 0 && Services.prefs.prefHasUserValue(backupPref)) {
          Services.prefs.setIntPref(pref, getIntPref(backupPref));
          Services.prefs.clearUserPref(backupPref);
        } else if (prefValue === 1 && tabmixInMultiRow) {
          Services.prefs.setIntPref(data, 0);
        } else if (prefValue === 2 && tabmixInMultiRow) {
          Services.prefs.setIntPref(backupPref, 2);
          Services.prefs.setIntPref(pref, 1);
        }
        break;
      }
      case "userChrome.padding.tabbar_height": {
        const prefValue = getBoolPref(data);
        if (prefValue && getIntPref("extensions.tabmix.tabBarMode") === 2) {
          Services.prefs.setBoolPref(data, false);
        }
        break;
      }
    }
  },

  onQuitApplication() {
    PREFS.forEach(pref => Services.prefs.removeObserver(pref, this));
    Services.obs.removeObserver(this, "quit-application");
  },
};
