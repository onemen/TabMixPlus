"use strict";

const EXPORTED_SYMBOLS = ["isVersion"];

const {AppConstants} = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");

const isLibrewolf = AppConstants.MOZ_APP_NAME.toLowerCase() == "librewolf";

const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "isWaterfox", () => {
  return Services.appinfo.name == "Waterfox";
});

ChromeUtils.defineLazyGetter(lazy, "isFloorp", () => {
  return Services.appinfo.name == "Floorp";
});

const _versions = {};
function isVersion(aVersionNo, updateChannel) {
  let firefox, waterfox, floorp, prefix = "";
  if (typeof aVersionNo === 'object') {
    firefox = aVersionNo.ff || 0;
    waterfox = aVersionNo.wf || "";
    floorp = aVersionNo.fp || "";
    updateChannel = aVersionNo.updateChannel || null;

    if (!firefox && !waterfox && !floorp) {
      console.log('Tabmix: invalid version check ' + JSON.stringify(aVersionNo));
      return true;
    }
    if (waterfox && !lazy.isWaterfox || floorp && !lazy.isFloorp) {
      return false;
    }
    if (!firefox && !lazy.isWaterfox && !lazy.isFloorp) {
      return false;
    }
    if (lazy.isWaterfox && waterfox) {
      aVersionNo = waterfox;
      prefix = "wf";
    } else if (lazy.isFloorp && floorp) {
      aVersionNo = floorp;
      prefix = "fp";
    } else {
      aVersionNo = firefox;
    }
  }

  if (
    updateChannel &&
    Services.appinfo.defaultUpdateChannel.toLowerCase() !== updateChannel.toLowerCase()
  ) {
    return false;
  }

  if (typeof _versions[prefix + aVersionNo] == "boolean")
    return _versions[prefix + aVersionNo];

  let v = Services.appinfo.version;

  if (lazy.isWaterfox && waterfox || lazy.isFloorp && floorp) {
    return (_versions[prefix + aVersionNo] = Services.vc.compare(v, aVersionNo) >= 0);
  }

  const suffix = isLibrewolf ? `.${v.split('.')[1] ?? "0-1"}` : ".0a1";
  return (_versions[aVersionNo] = Services.vc.compare(v, aVersionNo / 10 + suffix) >= 0);
}
