import {TabContextConfig} from "chrome://tabmix-resource/content/TabContextConfig.sys.mjs";
import {Preferences} from "resource://gre/modules/Preferences.sys.mjs";

/** load Tabmix preference to the default branch */
export const PreferencesLoader = {
  _defaultPreferencesLoaded: false,

  loadDefaultPreferences() {
    if (this._defaultPreferencesLoaded) {
      return;
    }
    this._defaultPreferencesLoaded = true;
    const prefs = new Preferences({defaultBranch: true});

    /**
     * @param {string} prefName
     * @param {string | number | boolean} prefValue
     */
    const pref = function (prefName, prefValue) {
      const setPref = () => {
        try {
          prefs.set(prefName, prefValue);
        } catch (ex1) {
          console.log(prefName, prefValue, ex1);
          try {
            // current value is invalid or deleted by the user
            Services.prefs.clearUserPref(prefName);
            prefs.set(prefName, prefValue);
          } catch (ex2) {
            console.error(`Tabmix errored twice when trying to set ${prefName} default`);
            console.error("Tabmix Error", ex1);
            console.error("Tabmix Error", ex2);
          }
        }
      };

      switch (prefValue.constructor.name) {
        case "String":
        case "Number":
        case "Boolean":
          setPref();
          break;
        default:
          console.error(
            `Tabmix Error: can't set pref ${prefName} to value '${prefValue}'; ` +
              "it isn't a String, Number, or Boolean"
          );
      }
    };

    try {
      const path = "chrome://tabmix-prefs/content/tabmix.js";
      Services.scriptloader.loadSubScript(path, {pref});
    } catch (ex) {
      console.error("Tabmix Error:", ex);
    }

    // Initialize tab context menu preferences
    try {
      for (const [id, config] of Object.entries(TabContextConfig.prefList)) {
        const [name, defaultVisible = true] = config;
        const prefName = name || id.replace(/^context_|^tm-/, "");
        pref(`extensions.tabmix.${prefName}`, defaultVisible);
      }
    } catch (ex) {
      console.error("Tabmix Error:", ex);
    }
  },
};
