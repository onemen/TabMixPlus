"use strict";

const EXPORTED_SYMBOLS = ["Tabmix_NewTabURL"];

const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

const lazy = {};
ChromeUtils.defineModuleGetter(lazy, "AboutNewTab",
  "resource:///modules/AboutNewTab.jsm");

const FIREFOX_PREF = "browser.#.url".replace("#", "newtab");
const ABOUT_NEW_TAB = "about:#".replace("#", "newtab");

// browser. newtab.url preference was removed by bug 1118285 (Firefox 41+)
const Tabmix_NewTabURL = {
  QueryInterface: ChromeUtils.generateQI([
    Ci.nsIObserver,
    Ci.nsISupportsWeakReference
  ]),

  init() {
    if (Services.prefs.prefHasUserValue(FIREFOX_PREF))
      this.updateNewTabURL();

    // eslint-disable-next-line mozilla/balanced-observers
    Services.prefs.addObserver(FIREFOX_PREF, this, true);
  },

  observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "nsPref:changed":
        if (aData == FIREFOX_PREF)
          this.updateNewTabURL(aData);
        break;
    }
  },

  // for Firefox 44+
  updateNewTabURL() {
    let value = Services.prefs.getStringPref(FIREFOX_PREF);
    if (value == ABOUT_NEW_TAB) {
      lazy.AboutNewTab.resetNewTabURL();
    } else {
      lazy.AboutNewTab.newTabURL = value;
    }
  }
};

Tabmix_NewTabURL.init();
