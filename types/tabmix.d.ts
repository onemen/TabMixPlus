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

type I10MapValue = {before: number; l10n: string};
type I10Map = Record<string, I10MapValue>;

declare namespace TabmixNS {
  const _debug: boolean;
  const firstWindowInSession: boolean;

  const prefs: nsIPrefBranch;
  const defaultPrefs: nsIPrefBranch;
  function isVersion(aVersionNo: number | {ff?: number; wf?: string; bs?: string; updateChannel?: string}, updateChannel?: string): boolean;
  function isAltKey(event: any): any;
  function debug(aMessage: any, aShowCaller: any): void;
  function showItem(aItemOrId: any, aShow: any): void;
  function setItem(aItemOrId: any, aAttr: any, aVal: any): void;
  function setAttributeList(aItemOrId: any, aAttr: any, aValue: any, aAdd: any): void;
  function setFTLDataId(elementId: any, map?: I10Map): void;
  function convert(id: string, data?: I10MapValue): string;
  function getBoundsWithoutFlushing(element: HTMLElement): DOMRect;
  function getTopWin(): TabmixOptionsWindow | Window | MockedGeckoTypes.BrowserWindow;
  function isNewWindowAllow(isPrivate: any): boolean;
  function lazy_import(aObject: any, aName: any, aModule: any, aSymbol: any, aFlag: any, aArg: any): void;
  function lazyGetter(obj: any, name: string, get: any, config?: {configurable?: boolean; enumerable?: boolean; value?: any}): any;
  function backwardCompatibilityGetter(aObject: any, aOldName: any, aNewName: any): void;
  function informAboutChangeInTabmix(aOldName: any, aNewName: any): void;
  function promptService(intParam: any, strParam: any, aWindow: any, aCallBack: any): {button: any; checked: boolean; label: any; value: any};
  function windowEnumerator(aWindowtype: any): MockedGeckoTypes.nsISimpleEnumeratorWithWindow;
  function numberOfWindows(all: any, aWindowtype: any): number;
  const isFirstWindowInSession: any;
  const isSingleBrowserWindow: boolean;
  const isLastBrowserWindow: boolean;
  function compare(a: any, b: any, lessThan: any): boolean;
  function itemEnd(item: any, end: any): any;
  function show(aMethod: any, aDelay: any, aWindow: any): void;
  function _getMethod(id: any, args: any): any;
  function installChangecode(): void;
  function _init(): void;
  let originalFunctions: {
    OpenBrowserWindow: typeof window.OpenBrowserWindow;
  } & Record<string, (...any: any[]) => any>;
  function destroy(): void;

  // imported from log.jsm
  function log(aMessage: string, aShowCaller: boolean, offset?: number, caller?: {filename: string; lineNumber: number; columnNumber: number}): void;
  function clog(aMessage: string, caller?: {filename: string; lineNumber: number; columnNumber: number}): void;
  function getObject(aWindow: Window, aMethod: string): any;

  // from changedcode
  // TODO: fix returned type
  const _debugMode: boolean;
  const _localMakeCode: string;
  function _makeCode(name: string | null, code: string): typeof Function;
  function changeCode(aParent: any, afnName: string, aOptions: any): any;
  function nonStrictMode(aObj: any, aFn: any, aArg: any): void;
  function setNewFunction(aObj: any, aName: string, aCode: string): void;
  // TODO: check if it's needed
  function toCode(): any;

  // tabmix.js
  let _lastTabOpenedTime: number;
  const _deferredInitialized: {
    promise: Promise<void>;
    resolve: typeof Promise.resolve;
    reject: typeof Promise.reject;
  };
  const initialization: typeof TabmixInitialization;
  let isFirstWindow: boolean;
  let selectedTab: MockedGeckoTypes.BrowserTab;
  const singleWindowMode: boolean;
  let tabsNewtabButton: HTMLButtonElement;
  let userTypedValue: string;
  function afterDelayedStartup(): void;
  function beforeDelayedStartup(): void;
  function getAfterTabsButtonsWidth(): void;
  function sessionInitialized(): void;
  function startup(): void;

  // click.js
  function openInverseLink(ev: any): void;
  const allTabs: typeof AllTabs;

  // tab.js
  let contextMenuLinks: HTMLLinkElement[];
  const tabsUtils: typeof TabsUtils;

  // userinterface.js
  function setTabStyle(aTab: MockedGeckoTypes.BrowserTab, boldChanged: boolean): void;

  // contants
  const CHECKBOX_CHECKED: number;
}

declare namespace AllTabs {
  function init(): void;
}

type InitializationStep = {id: number; obj: string};
declare namespace TabmixInitialization {
  const init: InitializationStep;
  const beforeStartup: InitializationStep;
  const onContentLoaded: InitializationStep;
  const beforeBrowserInitOnLoad: InitializationStep;
  const onWindowOpen: InitializationStep;
  const afterDelayedStartup: InitializationStep;
  // TODO: check if there is spacial type for getter in namespace
  function isValidWindow(): boolean;
  function run(aPhase: number): any;
}

declare namespace TabsUtils {
  const initialized: false;
  const _tabmixPositionalTabs: {
    beforeSelectedTab?: MockedGeckoTypes.BrowserTab;
    afterSelectedTab?: MockedGeckoTypes.BrowserTab;
    beforeHoveredTab?: MockedGeckoTypes.BrowserTab;
    afterHoveredTab?: MockedGeckoTypes.BrowserTab;
  };
}

// type TabmixTypes = Partial<typeof TabmixNS> & {[key: string]: any};
type TabmixTypes = Partial<typeof TabmixNS>;

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
    i10IdMap: I10Map;
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
    setLabel: (property: string) => string;
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
