"use strict";

this.EXPORTED_SYMBOLS = ["ContentSvc"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/Services.jsm", this);

XPCOMUtils.defineLazyGetter(this, "isPaleMoonID", () => {
  try {
    // noinspection SpellCheckingInspection
    return Services.appinfo.ID == "{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}";
  } catch (ex) {
  }
  return false;
});

var _versions = {};
function isVersion(aVersionNo) {
  if (isPaleMoonID) {
    let paleMoonVer = arguments.length > 1 ? arguments[1] : -1;
    if (aVersionNo > 240 && paleMoonVer == -1)
      return false;
    aVersionNo = paleMoonVer;
  }

  if (typeof _versions[aVersionNo] == "boolean")
    return _versions[aVersionNo];

  let v = Services.appinfo.version;
  return (_versions[aVersionNo] = Services.vc.compare(v, aVersionNo / 10 + ".0a1") >= 0);
}

this.ContentSvc = {
  aboutNewtab: "about:#".replace("#", "newtab"),

  getStringPref(prefName) {
    if (isVersion(580)) {
      return Services.prefs.getStringPref(prefName);
    }
    return Services.prefs.getComplexValue(prefName, Ci.nsISupportsString).data;
  },

  version() {
    return isVersion.apply(null, arguments);
  },

};

// Tabmix preference branch
XPCOMUtils.defineLazyGetter(ContentSvc, "prefBranch", () => {
  return Services.prefs.getBranch("extensions.tabmix.");
});
