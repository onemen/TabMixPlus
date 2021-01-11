"use strict";

this.EXPORTED_SYMBOLS = ["Tabmix_NewTabURL"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/Services.jsm", this);

XPCOMUtils.defineLazyServiceGetter(this, "aboutNewTabService",
  "@mozilla.org/browser/aboutnewtab-service;1",
  "nsIAboutNewTabService");

XPCOMUtils.defineLazyModuleGetter(this, "NewTabURL",
  "resource:///modules/NewTabURL.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/TabmixSvc.jsm");

const FIREFOX_PREF = "browser.#.url".replace("#", "newtab");
const ABOUT_NEW_TAB = "about:#".replace("#", "newtab");

// browser. newtab.url preference was removed by bug 1118285 (Firefox 41+)
this.Tabmix_NewTabURL = {
  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIObserver,
    Ci.nsISupportsWeakReference
  ]),

  init() {
    if (!TabmixSvc.version(440)) {
      this.updateNewTabURL = this._updateNewTabURL;
    }

    if (Services.prefs.prefHasUserValue(FIREFOX_PREF))
      this.updateNewTabURL();

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

  // for Firefox 41 - 43
  _updateNewTabURL() {
    let value = TabmixSvc.getStringPref(FIREFOX_PREF);
    if (value == ABOUT_NEW_TAB)
      NewTabURL.reset();
    else
      NewTabURL.override(value);
  },

  // for Firefox 44+
  updateNewTabURL() {
    let value = TabmixSvc.getStringPref(FIREFOX_PREF);
    if (value == ABOUT_NEW_TAB) {
      aboutNewTabService.resetNewTabURL();
    } else {
      aboutNewTabService.newTabURL = value;
    }
  }
};

this.Tabmix_NewTabURL.init();
