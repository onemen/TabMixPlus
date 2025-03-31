/** @type {ContentSvcModule.Lazy} */ // @ts-ignore
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  //
  isVersion: "chrome://tabmix-resource/content/BrowserVersion.sys.mjs",
});

/** @type {Partial<TabmixModules.ContentSvc>} */
export const ContentSvc = {
  aboutNewtab: "about:newtab",

  getString(aStringKey) {
    try {
      // @ts-ignore
      return this._strings.GetStringFromName(aStringKey);
    } catch (e) {
      dump("*** Failed to get string " + aStringKey + " in bundle: tabmix.properties\n");
      throw e;
    }
  },

  version(versionNo, updateChannel) {
    return lazy.isVersion.apply(null, [versionNo, updateChannel]);
  },
};

// Tabmix preference branch
ChromeUtils.defineLazyGetter(ContentSvc, "prefBranch", () => {
  return Services.prefs.getBranch("extensions.tabmix.");
});
ChromeUtils.defineLazyGetter(ContentSvc, "_strings", () => {
  let properties = "chrome://tabmixplus/locale/tabmix.properties";
  return Services.strings.createBundle(properties);
});
