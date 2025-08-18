import {AppConstants} from "resource://gre/modules/AppConstants.sys.mjs";

const isLibreWolf = AppConstants.MOZ_APP_NAME.toLowerCase() == "librewolf";

/** @type {TabmixModules.BrowserVersionLazy} */
const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "isWaterfox", () => {
  return Services.appinfo.name == "Waterfox";
});

ChromeUtils.defineLazyGetter(lazy, "isFloorp", () => {
  return Services.appinfo.name == "Floorp";
});

ChromeUtils.defineLazyGetter(lazy, "isZen", () => {
  return Services.appinfo.name == "Zen";
});

/** @type {Record<string | number, boolean>} */
const _versions = {};

/** @type {BrowserVersion} */
export function isVersion(aVersionNo, updateChannel) {
  let firefox,
    waterfox,
    floorp,
    zen,
    prefix = "";
  if (typeof aVersionNo === "object") {
    firefox = aVersionNo.ff || 0;
    waterfox = aVersionNo.wf || "";
    floorp = aVersionNo.fp || "";
    zen = aVersionNo.zen || "";
    updateChannel = aVersionNo.updateChannel || null;

    if (!firefox && !waterfox && !floorp && !zen) {
      console.log("Tabmix: invalid version check " + JSON.stringify(aVersionNo));
      return true;
    }
    if ((waterfox && !lazy.isWaterfox) || (floorp && !lazy.isFloorp) || (zen && !lazy.isZen)) {
      return false;
    }
    if (!firefox && !lazy.isWaterfox && !lazy.isFloorp && !lazy.isZen) {
      return false;
    }
    if (lazy.isWaterfox && waterfox) {
      aVersionNo = waterfox;
      prefix = "wf";
    } else if (lazy.isFloorp && floorp) {
      aVersionNo = floorp;
      prefix = "fp";
    } else if (lazy.isZen && zen) {
      aVersionNo = zen;
      prefix = "zen";
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

  const cachedValue = _versions[prefix + aVersionNo];
  if (typeof cachedValue === "boolean") {
    return cachedValue;
  }

  let v =
    isLibreWolf || (lazy.isZen && prefix !== "zen") ?
      Services.appinfo.platformVersion
    : Services.appinfo.version;

  if ((lazy.isWaterfox && waterfox) || (lazy.isFloorp && floorp) || (lazy.isZen && zen)) {
    return (_versions[prefix + aVersionNo] = Services.vc.compare(v, String(aVersionNo)) >= 0);
  }

  return (_versions[aVersionNo] = Services.vc.compare(v, Number(aVersionNo) / 10 + ".0a1") >= 0);
}
