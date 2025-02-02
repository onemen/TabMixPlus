
import {TabmixChromeUtils} from "chrome://tabmix-resource/content/ChromeUtils.sys.mjs";

const lazy = {};

TabmixChromeUtils.defineLazyModuleGetters(lazy, {
  // AboutNewTab.sys.mjs exists since Firefox 116
  AboutNewTab: "resource:///modules/AboutNewTab.jsm"
});

const FIREFOX_PREF = "browser.#.url".replace("#", "newtab");
const ABOUT_NEW_TAB = "about:#".replace("#", "newtab");

// browser. newtab.url preference was removed by bug 1118285 (Firefox 41+)
export const Tabmix_NewTabURL = {
  QueryInterface: ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
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
      try {
        Services.io.newURI(value);
        lazy.AboutNewTab.newTabURL = value;
      } catch {
        let {preferredURI} = Services.uriFixup.getFixupURIInfo(value);
        lazy.AboutNewTab.newTabURL = preferredURI.spec;
      }
    }
  }
};

Tabmix_NewTabURL.init();
