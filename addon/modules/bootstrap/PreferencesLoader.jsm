/**
 * load Tabmix preference to the default branch
 */

"use strict";

const EXPORTED_SYMBOLS = ["PreferencesLoader"];

const PreferencesLoader = {
  _defaultPreferencesLoaded: false,
  loadDefaultPreferences() {
    if (this._defaultPreferencesLoaded) {
      return;
    }
    this._loaded = true;
    const prefs = Services.prefs.getDefaultBranch("");
    const pref = function(prefName, prefValue) {
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
            console.error(`Tabmix errored twice when trying to set ${prefName} default`);
            console.error("Tabmix Error", ex1);
            console.error("Tabmix Error", ex2);
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
          console.error(`Tabmix Error: can't set pref ${prefName} to value '${prefValue}'; ` +
              `it isn't a String, Number, or Boolean`);
      }
    };
    try {
      const path = "chrome://tabmix-prefs/content/tabmix.js";
      Services.scriptloader.loadSubScript(path, {pref});
    } catch (ex) {
      console.error("Tabmix Error:", ex);
    }
  },
};
