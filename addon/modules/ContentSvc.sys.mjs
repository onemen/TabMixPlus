const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  //
  isVersion: "chrome://tabmix-resource/content/BrowserVersion.sys.mjs"
});

export const ContentSvc = {
  aboutNewtab: "about:#".replace("#", "newtab"),

  getString(aStringKey) {
    try {
      return this._strings.GetStringFromName(aStringKey);
    } catch (e) {
      dump("*** Failed to get string " + aStringKey + " in bundle: tabmix.properties\n");
      throw e;
    }
  },

  version() {
    return lazy.isVersion.apply(null, arguments);
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
