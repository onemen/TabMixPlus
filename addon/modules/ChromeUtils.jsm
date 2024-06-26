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
  "resource://gre/modules/PromiseUtils.jsm": [1070, "resource://gre/modules/PromiseUtils.sys.mjs"],
  "resource://gre/modules/FileUtils.jsm": [1070, "resource://gre/modules/FileUtils.sys.mjs"],
  "resource:///actors/ClickHandlerParent.jsm": [1070, "resource:///actors/ClickHandlerParent.sys.mjs"],
  "resource://gre/modules/SearchSuggestionController.jsm": [1070, "resource://gre/modules/SearchSuggestionController.sys.mjs"],
  "resource://gre/modules/BrowserUtils.jsm": [1070, "resource://gre/modules/BrowserUtils.sys.mjs"],
  "resource://gre/modules/AppConstants.jsm": [1080, "resource://gre/modules/AppConstants.sys.mjs"],
  "resource://gre/modules/DeferredTask.jsm": [1080, "resource://gre/modules/DeferredTask.sys.mjs"],
  "resource://gre/modules/E10SUtils.jsm": [1080, "resource://gre/modules/E10SUtils.sys.mjs"],
  "resource://gre/modules/Preferences.jsm": [1080, "resource://gre/modules/Preferences.sys.mjs"],
  "resource://gre/modules/PrivateBrowsingUtils.jsm": [1080, "resource://gre/modules/PrivateBrowsingUtils.sys.mjs"],
  "resource://gre/modules/Timer.jsm": [1080, "resource://gre/modules/Timer.sys.mjs"],
  "resource://gre/modules/FormHistory.jsm": [1090, "resource://gre/modules/FormHistory.sys.mjs"],
  "resource:///modules/sessionstore/TabState.jsm": [1090, "resource:///modules/sessionstore/TabState.sys.mjs"],
  "resource:///modules/sessionstore/TabStateCache.jsm": [1090, "resource:///modules/sessionstore/TabStateCache.sys.mjs"],
  "resource:///modules/sessionstore/SessionStore.jsm": [1090, "resource:///modules/sessionstore/SessionStore.sys.mjs"],
  "resource://gre/modules/DownloadLastDir.jsm": [1140, "resource://gre/modules/DownloadLastDir.sys.mjs"],
  "resource:///modules/CustomizableUI.jsm": [1150, "resource:///modules/CustomizableUI.sys.mjs"],
  "resource://gre/modules/NetUtil.jsm": [1150, "resource:///modules/NetUtil.sys.mjs"],
  "resource://gre/modules/ExtensionShortcuts.jsm": [1150, "resource://gre/modules/ExtensionShortcuts.sys.mjs"],
  "resource://gre/modules/WebNavigationFrames.jsm": [1150, "resource://gre/modules/WebNavigationFrames.sys.mjs"],
  "resource://gre/modules/AddonManager.jsm": [1150, "resource://gre/modules/AddonManager.sys.mjs"],
  "resource:///modules/SitePermissions.jsm": [1150, "resource:///modules/SitePermissions.sys.mjs"],
  "resource:///modules/AboutNewTab.jsm": [1160, "resource:///modules/AboutNewTab.sys.mjs"],
  "resource:///modules/BrowserWindowTracker.jsm": [1160, "resource:///modules/BrowserWindowTracker.sys.mjs"],
  "resource:///modules/OpenInTabsUtils.jsm": [1160, "resource:///modules/OpenInTabsUtils.sys.mjs"],
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

  esmModulePath(module) {
    if (module.endsWith(".sys.mjs")) {
      return module;
    }
    const [varsion, modulePath] = modulesMap[module] ?? [];
    if (varsion && isVersion(varsion)) {
      return modulePath;
    }
    return null;
  },

  defineLazyModuleGetters(lazy, modules) {
    if (isVersion(1040)) {
      const esModules = {};
      const JSMModules = {};
      for (let [name, module] of Object.entries(modules)) {
        const modulePath = this.esmModulePath(module);
        if (modulePath) {
          esModules[name] = modulePath;
        } else {
          JSMModules[name] = module;
        }
      }
      if (Object.keys(esModules).length) {
        try {
          ChromeUtils.defineESModuleGetters(lazy, esModules);
        } catch (error) {
          console.log('Error when Tabmix call ChromeUtils.defineESModuleGetters with', esModules);
          console.log(error);
        }
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
      const modulePath = this.esmModulePath(module);
      if (modulePath) {
        return ChromeUtils.importESModule(modulePath);
      }
    }
    return ChromeUtils.import(module);
  },

  defineLazyGetter(aObject, aName, aLambda) {
    if (isVersion(1230)) {
      ChromeUtils.defineLazyGetter(aObject, aName, aLambda);
    } else {
      this.XPCOMUtils.defineLazyGetter(aObject, aName, aLambda);
    }
  },
};
