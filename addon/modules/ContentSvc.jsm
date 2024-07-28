"use strict";

const EXPORTED_SYMBOLS = ["ContentSvc"];

const {TabmixChromeUtils} = ChromeUtils.import("chrome://tabmix-resource/content/ChromeUtils.jsm");
const Services = globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

var _versions = {};
function isVersion(aVersionNo) {
  if (typeof _versions[aVersionNo] == "boolean")
    return _versions[aVersionNo];

  let v = Services.appinfo.version;
  return (_versions[aVersionNo] = Services.vc.compare(v, aVersionNo / 10 + ".0a1") >= 0);
}

const ContentSvc = {
  aboutNewtab: "about:#".replace("#", "newtab"),

  getString(aStringKey) {
    try {
      return this._strings.GetStringFromName(aStringKey);
    } catch (e) {
      dump("*** Failed to get string " + aStringKey + " in bundle: tabmix.properties\n");
      throw e;
    }
  },

  version() {
    return isVersion.apply(null, arguments);
  },

};

// Tabmix preference branch
TabmixChromeUtils.defineLazyGetter(ContentSvc, "prefBranch", () => {
  return Services.prefs.getBranch("extensions.tabmix.");
});
TabmixChromeUtils.defineLazyGetter(ContentSvc, "_strings", () => {
  let properties = "chrome://tabmixplus/locale/tabmix.properties";
  return Services.strings.createBundle(properties);
});
