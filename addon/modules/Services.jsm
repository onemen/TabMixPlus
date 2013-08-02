"use strict";

var EXPORTED_SYMBOLS = ["TabmixSvc"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

let TabmixSvc = {
  _version: {},
  version: function(aVersionNo) {
    if (typeof this._version[aVersionNo] == "boolean")
      return this._version[aVersionNo];

    let v = Services.appinfo.version;
    return this._version[aVersionNo] = Services.vc.compare(v, aVersionNo/10 + ".0a1") >= 0;
  },

  getString: function(aStringKey) {
    try {
      return this._strings.GetStringFromName(aStringKey);
    } catch (e) {
      dump("*** Failed to get string " + aStringKey + " in bundle: tabmix.properties\n");
      throw e;
    }
  },

  getFormattedString: function(aStringKey, aStringsArray) {
    try {
      return this._strings.formatStringFromName(aStringKey, aStringsArray, aStringsArray.length);
    } catch (e) {
      dump("*** Failed to format string " + aStringKey + " in bundle: tabmix.properties\n");
      throw e;
    }
  },

  getSMString: function(aStringKey) {
    try {
      return this.SMstrings.GetStringFromName(aStringKey);
    } catch (e) {
      dump("*** Failed to get string " + aStringKey + " in bundle: session-manager.properties\n");
      throw e;
    }
  },

  setLabel: function(property) {
    var label, key;
    if (property.indexOf("sm.") == 0) {
      label = this.getSMString(property + ".label");
      key = this.getSMString(property + ".accesskey");
    }
    else {
      label = this.getString(property + ".label");
      key = this.getString(property + ".accesskey");
    }
    var accessKeyIndex = label.toLowerCase().indexOf(key.toLowerCase());
    if (accessKeyIndex > -1)
      label = label.substr(0, accessKeyIndex) + "&" + label.substr(accessKeyIndex);
    return label;
  },

  topWin: function() {
    return Services.wm.getMostRecentWindow("navigator:browser");
  },

  get direct2dDisabled() {
    delete this.direct2dDisabled;
    try {
      // this pref exist only in windows
      return this.direct2dDisabled = Services.prefs.getBoolPref("gfx.direct2d.disabled");
    } catch(ex) {}
    return this.direct2dDisabled = false;
  },

  // some extensions override native JSON so we use nsIJSON
  JSON: {
    nsIJSON: null,
    parse: function TMP_parse(str) {
      try {
        return JSON.parse(str);
      } catch(ex) {
        try {
          return "decode" in this.nsIJSON ? this.nsIJSON.decode(str) : null;
        } catch(ex) {return null}
      }
    },
    stringify: function TMP_stringify(obj) {
      try {
        return JSON.stringify(obj);
      } catch(ex) {
        try {
          return "encode" in this.nsIJSON ? this.nsIJSON.encode(obj) : null;
        } catch(ex) {return null}
      }
    }
  },

  sm: {
    lastSessionPath: null,
    initialized: false,
    persistTabAttributeSet: false,
    status: "",
    crashed: false,
    get sanitized() {
      delete this.sanitized;
      return this.sanitized = TabmixSvc.prefBranch.prefHasUserValue("sessions.sanitized");
    },
    private: true
  }
}

XPCOMUtils.defineLazyGetter(TabmixSvc.JSON, "nsIJSON", function() {
  return Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
});

/**
 * Lazily define services
 * Getters for common services, use Services.jsm where possible
 */
XPCOMUtils.defineLazyGetter(TabmixSvc, "prefs", function () {return Services.prefs});
XPCOMUtils.defineLazyGetter(TabmixSvc, "io", function () {return Services.io});
XPCOMUtils.defineLazyGetter(TabmixSvc, "console", function () {return Services.console});
XPCOMUtils.defineLazyGetter(TabmixSvc, "wm", function () {return Services.wm});
XPCOMUtils.defineLazyGetter(TabmixSvc, "obs", function () {return Services.obs});
XPCOMUtils.defineLazyGetter(TabmixSvc, "prompt", function () {return Services.prompt});

// Tabmix preference branch
XPCOMUtils.defineLazyGetter(TabmixSvc, "prefBranch", function () {return Services.prefs.getBranch("extensions.tabmix.")});
// string bundle
XPCOMUtils.defineLazyGetter(TabmixSvc, "_strings", function () {
  let properties = "chrome://tabmixplus/locale/tabmix.properties";
  return Services.strings.createBundle(properties);
});
XPCOMUtils.defineLazyGetter(TabmixSvc, "SMstrings", function () {
  let properties = "chrome://tabmixplus/locale/session-manager.properties";
  return Services.strings.createBundle(properties);
});
// sessionStore
XPCOMUtils.defineLazyServiceGetter(TabmixSvc, "ss", "@mozilla.org/browser/sessionstore;1", "nsISessionStore");

XPCOMUtils.defineLazyModuleGetter(TabmixSvc, "FileUtils",
  "resource://gre/modules/FileUtils.jsm");
