"use strict";

const EXPORTED_SYMBOLS = ["ContentSvc"];

const {TabmixChromeUtils} = ChromeUtils.import("chrome://tabmix-resource/content/ChromeUtils.jsm");
const {XPCOMUtils} = TabmixChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
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

  getStringPref(prefName) {
    return Services.prefs.getStringPref(prefName);
  },

  version() {
    return isVersion.apply(null, arguments);
  },

};

// Tabmix preference branch
XPCOMUtils.defineLazyGetter(ContentSvc, "prefBranch", () => {
  return Services.prefs.getBranch("extensions.tabmix.");
});
