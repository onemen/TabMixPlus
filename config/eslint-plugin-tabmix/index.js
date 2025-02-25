import importGlobals from './import-globals.js';
import lazyGetterNameMatch from './lazy-getter-name-match.js';
import validLazy from './valid-lazy.js';

export default {
  meta: {
    name: "eslint-plugin-tabmix",
    version: "1.2.0"
  },
  environments: {
    extensions: {
      //
      TabView: false
    },
    "extensions-js": {
      bgSaverPref: false,
      CHROMATABS: false,
      closeallOverlay: false,
      com: false,
      contentAreaDNDObserver: false,
      faviconize: false,
      FdUtils: false,
      FireGestures: false,
      foxTab: false,
      gFxWeaveGlue: false,
      IeTab2: false,
      Local_Install: false,
      mgBuiltInFunctions: false,
      MouseControl: false,
      objLinkify: false,
      PersonaController: false,
      rdrb: false,
      readPref: false,
      RSSTICKER: false,
      SecondSearchBrowser: false,
      SpeedDial: false,
      tileTabs: false,
      TreeStyleTabWindowHelper: false,
      TreeStyleTabBrowser: false,
    },
    tabmix: {
      gTMPprefObserver: true,
      Tabmix: true,
      TabmixAllTabs: true,
      TabmixChromeUtils: true,
      TabmixContext: true,
      TabmixProgressListener: true,
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
      TMP_undocloseTabButtonObserver: true,

      ZenWorkspaces: true,
      gZenVerticalTabsManager: true,
    },
    preferences: {
      $: false,
      $Pref: false,
      $Pane: false,
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
  rules: {
    "import-globals": importGlobals,
    "lazy-getter-name-match": lazyGetterNameMatch,
    "valid-lazy": validLazy,
  },
};
