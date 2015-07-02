"use strict";

var EXPORTED_SYMBOLS = ["Tabmix_NewTabURL"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "NewTabURL",
                                  "resource:///modules/NewTabURL.jsm");

const FIREFOX_PREF = "browser" + ".newtab.url";
const ABOUT_NEW_TAB = "about:newtab";

// browser. newtab.url preference was removed by bug 1118285 (Firefox 41+)
this.Tabmix_NewTabURL = {
  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIObserver,
    Ci.nsISupportsWeakReference
  ]),

  init: function() {
    if (Services.prefs.prefHasUserValue(FIREFOX_PREF))
      this.updateNewTabURL();

    Services.prefs.addObserver(FIREFOX_PREF, this, true);
  },

  observe: function(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "nsPref:changed":
        if (aData == FIREFOX_PREF)
          this.updateNewTabURL(aData);
        break;
    }
  },

  updateNewTabURL: function() {
    let value = Services.prefs.getComplexValue(FIREFOX_PREF, Ci.nsISupportsString).data;
    if (value == ABOUT_NEW_TAB)
      NewTabURL.reset();
    else
      NewTabURL.override(value);
  }
};

this.Tabmix_NewTabURL.init();
