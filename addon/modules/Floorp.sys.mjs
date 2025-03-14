/** @type {FloorpModule.Lazy} */ // @ts-ignore
const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "prefs", () => {
  const {Preferences} = ChromeUtils.importESModule("resource://gre/modules/Preferences.sys.mjs");
  return new Preferences("");
});

const PREFS = [
  "extensions.tabmix.tabBarMode",
  "floorp.tabbar.style",
  "userChrome.padding.tabbar_height",
];

/** @type {FloorpModule.Floorp} */
export const FloorpPrefsObserver = {
  _initialized: false,
  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    PREFS.forEach(pref => this.onPrefChange(pref));
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
    const prefValue = lazy.prefs.get(data);

    // when in vertical mode exit
    if (Services.prefs.getIntPref("floorp.tabbar.style") === 2 && data !== "floorp.tabbar.style") {
      return;
    }

    switch (data) {
      case "extensions.tabmix.tabBarMode": {
        const pref = "userChrome.padding.tabbar_height";
        const backupPref = `${pref}._backup`;
        if (prefValue === 2) {
          Services.prefs.setBoolPref(backupPref, Services.prefs.getBoolPref(pref));
          Services.prefs.setBoolPref(pref, false);
          Services.prefs.setIntPref("floorp.tabbar.style", 0);
        } else if (Services.prefs.prefHasUserValue(backupPref)) {
          Services.prefs.setBoolPref(pref, Services.prefs.getBoolPref(backupPref));
          Services.prefs.clearUserPref(backupPref);
        }
        break;
      }
      case "floorp.tabbar.style": {
        const pref = "extensions.tabmix.tabBarMode";
        const backupPref = `${pref}._backup`;
        const tabmixInMultiRow = Services.prefs.getIntPref(pref) === 2;
        if (prefValue === 0 && Services.prefs.prefHasUserValue(backupPref)) {
          Services.prefs.setIntPref(pref, Services.prefs.getIntPref(backupPref));
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
        if (
          prefValue &&
          Services.prefs.getIntPref("extensions.tabmix.tabBarMode") === 2
        ) {
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
