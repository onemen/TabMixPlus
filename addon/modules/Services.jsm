var EXPORTED_SYMBOLS = ["TabmixSvc"];

const Cc = Components.classes;
const Ci = Components.interfaces;

let TabmixSvc = {
  stackOffset: 1,
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
  }
}

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyGetter(TabmixSvc, "version", function () {
  var comparator = Services.vc;
  var version = Services.appinfo.version;
  let v = {value:version};
  v.is40 = comparator.compare(version, "4.0b4") >= 0;
  v.is50 = comparator.compare(version, "5.0a1") >= 0;
  v.is60 = comparator.compare(version, "6.0a1") >= 0;
  v.is70 = comparator.compare(version, "7.0a1") >= 0;
  v.is80 = comparator.compare(version, "8.0a1") >= 0;
  v.is90 = comparator.compare(version, "9.0a1") >= 0;
  v.is100 = comparator.compare(version, "10.0a1") >= 0;
  v.is110 = comparator.compare(version, "11.0a1") >= 0;
  v.is120 = comparator.compare(version, "12.0a1") >= 0;
  v.is130 = comparator.compare(version, "13.0a1") >= 0;
  v.is140 = comparator.compare(version, "14.0a1") >= 0;
  v.is150 = comparator.compare(version, "15.0a1") >= 0;
  return v;
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
