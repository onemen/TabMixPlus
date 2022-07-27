"use strict";

const EXPORTED_SYMBOLS = ["TabmixChromeUtils"];

const Services =
  globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

/**
 * Note: If you rename this identifier, also update getModulesMap function in
 * eslint-plugin-tabmix use-mjs-modules.js.
 */
const modulesMap = {
  "resource://gre/modules/PlacesUtils.jsm": [1040, "resource://gre/modules/PlacesUtils.sys.mjs"],
  "resource:///modules/PlacesUIUtils.jsm": [1040, "resource:///modules/PlacesUIUtils.sys.mjs"],
  "resource://gre/modules/PluralForm.jsm": [1050, "resource://gre/modules/PluralForm.sys.mjs"],
  "resource://gre/modules/XPCOMUtils.jsm": [1040, "resource://gre/modules/XPCOMUtils.sys.mjs"],
};

const _versions = {};
function isVersion(aVersionNo) {
  if (typeof _versions[aVersionNo] == "boolean") return _versions[aVersionNo];

  let v = Services.appinfo.version;
  return (_versions[aVersionNo] = Services.vc.compare(v, aVersionNo / 10 + ".0a1") >= 0);
}

var TabmixChromeUtils = {
  get XPCOMUtils() {
    delete this.XPCOMUtils;
    return (this.XPCOMUtils = this.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils);
  },

  defineLazyModuleGetters(lazy, modules) {
    if (isVersion(1040)) {
      const esModules = {};
      const JSMModules = {};
      for (let [name, module] of Object.entries(modules)) {
        const [varsion, modulePath] = modulesMap[module] ?? [];
        if (varsion && isVersion(varsion)) {
          esModules[name] = modulePath;
        } else {
          JSMModules[name] = module;
        }
      }
      if (Object.keys(esModules).length) {
        ChromeUtils.defineESModuleGetters(lazy, esModules);
      }
      if (Object.keys(JSMModules).length) {
        this.XPCOMUtils.defineLazyModuleGetters(lazy, JSMModules);
      }
    } else {
      this.XPCOMUtils.defineLazyModuleGetters(lazy, modules);
    }
  },

  import(module) {
    if (isVersion(1040)) {
      const [varsion, modulePath] = modulesMap[module] ?? [];
      if (varsion && isVersion(varsion)) {
        return ChromeUtils.importESModule(modulePath);
      }
    }
    return ChromeUtils.import(module);
  },
};
