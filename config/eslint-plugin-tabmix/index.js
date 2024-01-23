/* eslint strict: 0, object-curly-newline: [2, always] */

module.exports = {
  environments: {
    extensions: {
      globals: {
        TabView: false
      }
    },
    tabmix: {
      globals: {
        gTMPprefObserver: true,
        Tabmix: true,
        TabmixAllTabs: true,
        TabmixChromeUtils: true,
        TabmixContext: true,
        TabmixProgressListener: true,
        TabmixSessionData: true,
        TabmixSessionManager: true,
        TabmixSvc: true,
        TabmixTabbar: true,
        TabmixTabClickOptions: true,
        TMP_BrowserOpenTab: true,
        TMP_ClosedTabs: true,
        TMP_eventListener: true,
        TMP_extensionsCompatibility: true,
        TMP_LastTab: true,
        TMP_Places: true,
        TMP_SessionStore: true,
        TMP_tabDNDObserver: true,
        TMP_TabView: true,
        TMP_undocloseTabButtonObserver: true,
      },
    },
    preferences: {
      globals: {
        $: false,
        gAppearancePane: false,
        getFormattedKey: false,
        gMenuPane: false,
        gNumberInput: false,
        gPrefWindow: false,
        MozXULElement: false,
        RTL_UI: false,
        Services: false,
        Shortcuts: false,
        Tabmix: false,
        TabmixChromeUtils: true,
        TabmixSvc: false,
      },
    },
    dialog: {
      globals: {
        centerWindowOnScreen: false,
        moveToAlertPosition: false,
        Tabmix: false,
        TabmixSvc: false,
      },
    },
  },
  rules: {
    "import-globals": require("./import-globals"),
    "use-mjs-modules": require("./use-mjs-modules"),
    "valid-lazy": require("./valid-lazy"),
  },
};
