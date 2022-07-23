"use strict";

const EXPORTED_SYMBOLS = ["TabmixChromeUtils"];

const Services =
  globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

const modules = {
  // add sys.mjs modules here
  "resource://gre/modules/XPCOMUtils.jsm": [1040, "resource://gre/modules/XPCOMUtils.sys.mjs"],
};

const _versions = {};
function isVersion(aVersionNo) {
  if (typeof _versions[aVersionNo] == "boolean") return _versions[aVersionNo];

  let v = Services.appinfo.version;
  return (_versions[aVersionNo] = Services.vc.compare(v, aVersionNo / 10 + ".0a1") >= 0);
}

var TabmixChromeUtils = {
  import(module) {
    if (isVersion(1040)) {
      const [varsion, modulePath] = modules[module] ?? {};
      if (varsion && isVersion(varsion)) {
        return ChromeUtils.importESModule(modulePath);
      }
    }
    return ChromeUtils.import(module);
  },
};
