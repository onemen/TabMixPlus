/// <reference types="./gecko/gecko.d.ts" />

// Tabmix modules

interface ChromeManifest {
  parse: (filename?: string, base?: string) => Promise<void>;
}

interface ContentSvc {
  readonly aboutNewtab: "about:newtab";
  getString: (key: string) => string;
  prefBranch: nsIPrefBranch;
  version: TabmixModules.TabmixSvc["version"];
}

// for gTMPprefObserver._tabStyleSheet
interface CSSRule {
  readonly name: string;
  readonly style: CSSStyleDeclaration;
}

interface gTMPprefObserver {
  _marginStart: string;
  _singleWindowUI_initialized: boolean;
  _tabWidthChanged?: boolean;
  _tabStyleSheet: CSSStyleSheet;
  addDynamicRules: () => void;
  blockTabClickingOptions: (prefName: string) => void;
  changeNewTabButtonSide: (aPosition: number) => void;
  dynamicRules:
    | {
        visibleRows: CSSStyleRule;
        width: CSSStyleRule;
      }
    | Record<string, CSSStyleRule>;
  dynamicProtonRules: () => void;
  dynamicRulesForVersion: () => void;
  getStyleSheets: (aHref: string, aFirst: boolean) => CSSStyleSheet[];
  get tabStyleSheet(): typeof gTMPprefObserver._tabStyleSheet;
  init: () => void;
  insertRule: (iconRule: string, name?: string) => number;
  OBSERVING: string[];
  observe: (aSubject: nsISupports, aTopic: string, aData: string) => void;
  overflowIndicator: () => void;
  preventUpdate: boolean;
  prefsValues: Record<string, string | boolean | number>;
  removeObservers: () => void;
  setMenuIcons: () => void;
  setAutoHidePref: () => void;
  setCloseButtonMargin: () => void;
  setLink_openPrefs: () => void;
  setProgressMeter: () => void;
  setShowNewTabButtonAttr: (aShow: boolean, aPosition?: number) => void;
  setSingleWindowUI: () => void;
  setTabbarDragging: (allowDrag: boolean) => void;
  setTabBarVisibility: () => void;
  setTabIconMargin: () => void;
  showReloadEveryOnReloadButton: () => void;
  tabBarPositionChanged: (aPosition: number) => boolean;
  toolbarbuttonTopMargin: () => void;
  updateTabClickingOptions: () => void;
  updateTabsStyle: (ruleName: string) => void;
  updateSettings: () => void;
  updateStyleAttributes: () => void;
  updateStyleAttribute: (ruleName: string, styleName: string) => string;
}

interface LinkNodeUtils {
  getNodeWithOnClick: (node: Element) => Element | null;
  isFrameInContent: (content: any, href: string, name: string) => boolean;
  isSpecialPage: (href: string, linkNode: Element, currentHref: string, window?: Window) => boolean;
  wrap: (node: Element, focusedWindow: Window, getTargetIsFrame: boolean) => any;
}

interface Overlays {}

interface ScriptsLoader {
  initForWindow: (window: Window, promiseOverlayLoaded: Promise<void>, params?: any) => void;
}

type TabStyle = {
  text: string;
  bg: string;
};

declare namespace Preferences {
  function get(prefName: string | any[], defaultValue: any, valueType?: null): any;
  function _get(prefName: any, defaultValue: any, valueType: any): any;
  function set(prefName: string | Record<string, string | number | boolean>, prefValue: string | number | boolean): void;
  function _set(prefName: any, prefValue: any): void;
  function has(prefName: string | any[]): boolean | any[];
  function isSet(prefName: string | any[]): boolean | any[];
  function reset(prefName: any): void;
  function lock(prefName: string | any[]): void;
  function unlock(prefName: string | any[]): void;
  function locked(prefName: string | any[]): boolean | any[];
  function observe(prefName: string, callback: any, thisObject: any): MockedExports.PrefObserver;
  function ignore(prefName: string, callback: any, thisObject: any): void;
  function resetBranch(prefBranch?: string): void;
  let _branchStr: string;
  let _cachedPrefBranch: any;
  const _prefBranch: any;
}

declare namespace TabmixModules {
  // TODO: replace all any with its proper types
  interface TabmixSvc {
    aboutBlank: string;
    aboutNewtab: string;
    blockedClickingOptions: number[];
    console: any;
    debugMode: () => boolean;
    readonly direct2dDisabled: boolean;
    getDialogStrings: (...keys: string[]) => string[];
    getFormattedString: (aStringKey: string, aStringsArray: string[]) => string;
    getSingleWindowMode: () => boolean;
    getString: (key: string) => string;
    getSMString: (key: string) => string;
    i10IdMap: () => Record<string, {before: number; l10n: string}>;
    isBasilisk: boolean;
    isCyberfox: boolean;
    isFixedGoogleUrl: (url: string) => boolean;
    isG3Waterfox: boolean;
    isG4Waterfox: boolean;
    isG5Waterfox: boolean;
    isLinux: boolean;
    isMac: boolean;
    isWaterfox: boolean;
    isWindows: boolean;
    loadDefaultPreferences(): void;
    newtabUrl: string;
    prefBranch: nsIPrefBranch;
    prefs: typeof Preferences;
    setCustomTabValue: (tab: MockedGeckoTypes.BrowserTab, key: string, value?: string) => void;
    sanitized: boolean;
    setLabel: (property) => string;
    sortByRecentlyUsed: string;
    SessionStore: any;
    SessionStoreGlobal: any;
    skipSingleWindowModeCheck: boolean;
    sm: {
      crashed: boolean;
      lastSessionPath: string | null;
      settingPreference: boolean;
      status: string;
    };
    ss: any;
    _defaultPreferencesLoaded: boolean;
    _strings: nsIStringBundle;
    SMstrings: nsIStringBundle;
    tabStylePrefs: {
      currentTab: TabStyle;
      unloadedTab: TabStyle;
      unreadTab: TabStyle;
      otherTab: TabStyle;
      progressMeter: {bg: string};
    };
    URILoadingHelperChanged: boolean;
    version: (aVersionNo: number | {ff?: number; wf?: string; bs?: string; updateChannel?: string}, updateChannel?: string) => boolean;
    whereToOpenLinkChanged: boolean;
    windowStartup: {
      _initialized: boolean;
      syncedTabsInitialized: boolean;
      init: (window: Window) => void;
    };
  }
}

interface TabmixWidgets {
  create: () => void;
  destroy: (uninstall?: boolean) => void;
}

declare var ContentSvc: ContentSvc;
declare var gTMPprefObserver: gTMPprefObserver;
declare var LinkNodeUtils: LinkNodeUtils;
declare var ScriptsLoader: ScriptsLoader;
declare var TabmixUtils: any;
declare var TabmixWidgets: TabmixWidgets;
