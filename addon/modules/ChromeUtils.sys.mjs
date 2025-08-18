/** @type {ChromeUtilsModule.Lazy} */ // @ts-ignore
const localLazy = {};

ChromeUtils.defineLazyGetter(localLazy, "isVersion", () => {
  return ChromeUtils.importESModule("chrome://tabmix-resource/content/BrowserVersion.sys.mjs")
    .isVersion;
});

/** @type {Record<string, [number, string]>} */
const modulesMap = {
  // we only use SessionStore.jsm in TabmixSvc.jsm
  "resource:///modules/sessionstore/SessionStore.jsm": [
    1090,
    "resource:///modules/sessionstore/SessionStore.sys.mjs",
  ],
  "resource:///modules/AboutNewTab.jsm": [1160, "resource:///modules/AboutNewTab.sys.mjs"],
  "resource:///modules/BrowserWindowTracker.jsm": [
    1160,
    "resource:///modules/BrowserWindowTracker.sys.mjs",
  ],
  "resource:///modules/OpenInTabsUtils.jsm": [1160, "resource:///modules/OpenInTabsUtils.sys.mjs"],
};

/** @type {ChromeUtilsModule.ChromeUtils} */
export const TabmixChromeUtils = {
  get XPCOMUtils() {
    delete this.XPCOMUtils;
    return (this.XPCOMUtils = ChromeUtils.importESModule(
      "resource://gre/modules/XPCOMUtils.sys.mjs"
    ).XPCOMUtils);
  },

  esmModulePath(module) {
    if (module.endsWith(".sys.mjs")) {
      return module;
    }
    const [version, modulePath] = modulesMap[module] ?? [];
    if (version && localLazy.isVersion(version)) {
      return modulePath;
    }
    return null;
  },

  defineLazyModuleGetters(lazy, modules) {
    /** @type {Record<string, string>} */
    const esModules = {};

    /** @type {Record<string, string>} */
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
        console.log("Error when Tabmix call ChromeUtils.defineESModuleGetters with", esModules);
        console.log(error);
      }
    }
    if (Object.keys(JSMModules).length) {
      this.XPCOMUtils?.defineLazyModuleGetters(lazy, JSMModules);
    }
  },

  import(module) {
    const modulePath = this.esmModulePath(module);
    if (modulePath) {
      // @ts-ignore - its ok
      return ChromeUtils.importESModule(modulePath);
    }
    return ChromeUtils.import(module);
  },

  defineLazyGetter(aObject, aName, aLambda) {
    console.warn(
      "Please use ChromeUtils.defineLazyGetter instead of TabmixChromeUtils.defineLazyGetter."
    );
    ChromeUtils.defineLazyGetter(aObject, aName, aLambda);
  },
};
