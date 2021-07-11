"use strict";

this.EXPORTED_SYMBOLS = ["ContentSvc"];

const {XPCOMUtils} = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

var _versions = {};
function isVersion(aVersionNo) {
  if (typeof _versions[aVersionNo] == "boolean")
    return _versions[aVersionNo];

  let v = Services.appinfo.version;
  return (_versions[aVersionNo] = Services.vc.compare(v, aVersionNo / 10 + ".0a1") >= 0);
}

this.ContentSvc = {
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
