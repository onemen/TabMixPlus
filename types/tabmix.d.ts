/// <reference types="./gecko/devtools/gecko.d.ts" />

// Tabmix modules

type BrowserVersion = (aVersionNo: number | {ff?: number; wf?: string; fp?: string; updateChannel?: string}, updateChannel?: string) => boolean;

interface ChromeManifest {
  parse: (filename?: string, base?: string) => Promise<void>;
}

interface ChromeManifestClass {
  prototype: ChromeManifest;
  new (loader?: (url: string) => string, options?: Record<string, unknown>): ChromeManifest;
  isInstance: IsInstance<ChromeManifest>;
}

interface ContentSvc {
  readonly aboutNewtab: "about:newtab";
  getString: (key: string) => string;
  prefBranch: nsIPrefBranchXpcom;
  version: TabmixModules.TabmixSvc["version"];
}

// for gTMPprefObserver._tabStyleSheet
interface CSSRule {
  readonly name: string;
  readonly style: CSSStyleDeclaration;
}

type RulesTypes = "max-rows" | "visibleRows" | "width" | "tabMinHeight" | "themeBackground";
interface gTMPprefObserver {
  _marginStart: string;
  _singleWindowUI_initialized: boolean;
  _tabWidthChanged?: boolean;
  _tabStyleSheet?: CSSStyleSheet | null;
  addDynamicRules: () => void;
  blockTabClickingOptions: (prefName: string) => void;
  changeNewTabButtonSide: (aPosition: number) => void;
  dynamicRules: (Record<RulesTypes, CSSRule> & {[key: string]: CSSRule}) | {[key: string]: CSSRule};
  dynamicProtonRules: () => void;
  getStyleSheets: (aHref: string, aFirst: boolean) => CSSStyleSheet[];
  get tabStyleSheet(): CSSStyleSheet;
  init: () => void;
  insertRule: (iconRule: string, name?: string) => number;
  OBSERVING: string[];
  observe: (aSubject: nsISupports, aTopic: string, aData: string) => void;
  preventUpdate: boolean;
  prefsValues: Record<string, unknown>;
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

interface WrappedNode {
  __tabmix: boolean;
  baseURI: string;
  host: string;
  pathname: string;
  className: string;
  target: string | null;
  ownerGlobal: {frameElement: boolean};
  ownerDocument: {
    URL: string;
    documentURI: string;
    defaultView: {frameElement: boolean};
    location: {href: string};
  };
  parentNode: {
    baseURI: string;
    _attributes: Record<string, string>;
  };
  _focusedWindowHref: string;
  _attributes: Record<string, string>;
  targetIsFrame?: boolean;
}

interface LinkNodeUtils {
  getNodeWithOnClick: (node: Element) => ContentClickLinkElement | null;
  isFrameInContent: (content: WindowProxy, href: string, name: string) => boolean;
  isSpecialPage: (href: string | null, linkNode: ContentClickLinkElement | null, currentHref: string, window?: Window) => boolean;
  wrap: (node: ContentClickLinkElement, focusedWindow: Window, getTargetIsFrame: boolean) => WrappedNode;
}

interface Overlays {
  load: (urls: string | string[]) => Promise<void>;
}

interface OverlaysClass {
  prototype: Overlays;
  load(overlayProvider: ChromeManifest, window: Window): Promise<void>;
  new (overlayProvider: ChromeManifest, window: Window): Overlays;
  isInstance: IsInstance<Overlays>;
}

interface TabStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  text: boolean;
  bg: boolean;
  textColor: string;
  bgColor: string;
  bgTopColor: string;
}

declare namespace PreferencesService {
  function get<T = unknown>(prefName: string | string[], defaultValue?: T, valueType?: null): T;
  function _get(prefName: string, defaultValue: unknown, valueType?: unknown): unknown;
  function set(prefName: string | Record<string, string | number | boolean>, prefValue?: string | number | boolean): void;
  function _set(prefName: string, prefValue: unknown): void;
  function has(prefName: string | string[]): boolean | boolean[];
  function isSet(prefName: string | string[]): boolean | string[];
  function reset(prefName: string | string[]): void;
  function lock(prefName: string | string[]): void;
  function unlock(prefName: string | string[]): void;
  function locked(prefName: string | string[]): boolean | boolean[];
  function observe<P extends string, C extends MockedExports.PrefObserver, T extends Record<string, unknown>>(prefName: P, callback: C, thisObject?: T): {prefName: P; callback: C; thisObject?: T};
  function ignore(prefName: string, callback: MockedExports.PrefObserver, thisObject: Record<string, unknown>): void;
  function resetBranch(prefBranch?: string): void;
  let _branchStr: string;
  const _prefBranch: nsIPrefBranchXpcom;
}

type AttributeProps = {
  hasAttribute: (name: string) => boolean;
  set hidden(name: boolean);
  get hidden(): boolean;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  setAttribute: (name: string, value: string) => void;
};

type I10MapValue = {before: number; l10n: string};
type I10Map = Record<string, I10MapValue>;
type ItemOrId = string | Node | Element | AttributeProps | null | undefined;

declare namespace TabmixNS {
  type LazyGetterReturnType<T extends (() => unknown) | unknown> = T extends () => infer R ? R : T;
  type promptServiceReturnType = {button: number; checked: boolean; label: string; value: number};
  type ElementTypes = Node | HTMLElement | MockedGeckoTypes.BrowserTab;

  const _debug: boolean;
  const firstWindowInSession: boolean;

  const prefs: nsIPrefBranchXpcom;
  const defaultPrefs: nsIPrefBranchXpcom;
  const isVersion: BrowserVersion;
  function isAltKey(event: MouseEvent): boolean;
  function debug(aMessage: string, aShowCaller?: boolean): void;
  function showItem(aItemOrId: ItemOrId, aShow?: boolean): void;
  function setItem(aItemOrId: ItemOrId, aAttr: string, aVal: unknown): void;
  function setAttributeList(aItemOrId: ItemOrId, aAttr: string, aValue: string, aAdd?: boolean): void;
  function setFTLDataId(elementId: string, map?: I10Map): void;
  function convert(id: string, data?: I10MapValue): string;
  function getBoundsWithoutFlushing(element: ElementTypes): DOMRect;
  function getTopWin(): MockedGeckoTypes.BrowserWindow;
  function isNewWindowAllow(isPrivate?: boolean): boolean;
  function lazy_import(aObject: Record<string, unknown>, aName: string, aModule: string, aSymbol: string, aFlag?: boolean, aArg?: unknown[]): void;
  function lazyGetter<T extends (() => unknown) | unknown, O extends object, K extends keyof O & string>(obj: O, name: K, get: T, config?: {configurable?: boolean; enumerable?: boolean}): LazyGetterReturnType<T>;
  function backwardCompatibilityGetter(aObject: Record<string, unknown>, aOldName: string, aNewName: string): void;
  function informAboutChangeInTabmix(aOldName: string, aNewName: string): void;
  function promptService(intParam: number[], strParam: string[], aWindow: Window, aCallBack?: (aResult: promptServiceReturnType) => void): promptServiceReturnType;
  function windowEnumerator(aWindowtype?: string | null): MockedGeckoTypes.nsISimpleEnumeratorWithWindow;
  function numberOfWindows(all?: boolean, aWindowtype?: string | null): number;
  const isFirstWindowInSession: boolean;
  const isSingleBrowserWindow: boolean;
  const isLastBrowserWindow: boolean;
  function compare(a: number, b: number, lessThan: boolean): boolean;
  function itemEnd(item: MockedGeckoTypes.BrowserTab | HTMLElement, end: boolean): number;
  function show(aMethod: TabmixModules.ShowMethod, aDelay: number, aWindow: Window): void;
  function _getMethod(id: string, args: IArguments): unknown;
  function installChangecode(): void;
  function _init(): void;
  let originalFunctions: (OriginalFunctions & Record<string, (...args: unknown[]) => unknown>) | Record<string, any>;
  function destroy(): void;

  // imported from log.jsm
  const assert: TabmixModules.Log["assert"];
  const callerName: TabmixModules.Log["callerName"];
  const callerTrace: TabmixModules.Log["callerTrace"];
  const log: TabmixModules.Log["log"];
  const clog: TabmixModules.Log["clog"];
  const getObject: TabmixModules.Log["getObject"];
  const reportError: TabmixModules.Log["reportError"];
}

type TabmixTypes = typeof TabmixNS &
  Record<string, any> & {
    isAfterSSWindowRestored?: boolean;
  };

interface OriginalFunctions {
  _loadURI: Window["_loadURI"];
  duplicateTabIn: Window["duplicateTabIn"];
  FillHistoryMenu: Window["FillHistoryMenu"];
  FullScreen_showNavToolbox: FullScreen["showNavToolbox"];
  gBrowser_addTab: MockedGeckoTypes.TabBrowser["addTab"];
  gBrowser_blurTab: MockedGeckoTypes.TabBrowser["_blurTab"];
  gBrowser_removeTab: MockedGeckoTypes.TabBrowser["removeTab"];
  gBrowser_setInitialTabTitle: MockedGeckoTypes.TabBrowser["setInitialTabTitle"];
  gURLBar_handleCommand: gURLBar["handleCommand"];
  gURLBar__whereToOpen: gURLBar["_whereToOpen"];
  gURLBar_setURI: gURLBar["setURI"];
  isBlankPageURL: Window["isBlankPageURL"];
  newWindowButtonObserver_onDrop: newWindowButtonObserver["onDrop"];
  OpenBrowserWindow: Window["OpenBrowserWindow"];
  openLinkIn: Window["openLinkIn"];
  openInverseLink: nsContextMenu["openLinkInTab"];

  _getDropIndex: MockedGeckoTypes.TabContainer["_getDropIndex"];
  _finishAnimateTabMove: MockedGeckoTypes.TabContainer["_finishAnimateTabMove"];
  _moveTogetherSelectedTabs: MockedGeckoTypes.TabContainer["_moveTogetherSelectedTabs"];
  /** @deprecated replaced with TabContainer.#moveTogetherSelectedTabs in firefox 133 */
  _groupSelectedTabs: MockedGeckoTypes.TabContainer["_groupSelectedTabs"];
  on_dragstart: MockedGeckoTypes.TabContainer["on_dragstart"];
  on_dragover: MockedGeckoTypes.TabContainer["on_dragover"];
  _tabmix_on_dragover: MockedGeckoTypes.TabContainer["on_dragover"];
  on_drop: MockedGeckoTypes.TabContainer["on_drop"];
  _tabmix_on_drop: MockedGeckoTypes.TabContainer["on_drop"];
  on_dragend: MockedGeckoTypes.TabContainer["on_dragend"];
  on_dragleave: MockedGeckoTypes.TabContainer["on_dragleave"];
}

type ShortcutKey = {modifiers: string; key: string; keycode: string; disabled?: boolean};
type ShortcutData = {id: string; default: string; command: number | (() => void); label: string; value: string; reserved?: boolean};

interface Shortcuts {
  getFormattedKey(key?: ShortcutKey | null): string;
  getPlatformAccel(): string;
  keys: {
    browserReload: ShortcutData;
    slideShow: ShortcutData;
  } & Record<string, ShortcutData>;
  keyStringify(value: ShortcutKey): string;
  keyParse(value: string): ShortcutKey;
  onWindowOpen(window: Window): void;
  prefsChangedByTabmix: boolean;
  validateKey(key: ShortcutKey): string;
}

declare namespace TabmixModules {
  type Caller = {filename: string; lineNumber: number; columnNumber: number};
  type ShowMethod = ((...args: unknown[]) => unknown) | {obj: Record<string, unknown>; name: string; fullName: string} | string;
  interface Log {
    assert(aError: unknown, aMsg?: string): void;
    callerName(): string;
    callerTrace(): {contain: (...names: string[]) => boolean};
    callerTrace(...args: string[]): boolean;
    clog(aMessage: string, caller?: Caller): void;
    getObject(aWindow: Window, aMethod: string): Record<string, unknown>;
    log(aMessage: string, aShowCaller?: boolean, offset?: number, caller?: Caller): void;
    obj(aObj: Record<string, unknown>, aMessage: string, aDisallowLog?: boolean, level?: number): void;
    reportError(ex: unknown, msg?: string, filter?: string): void;
    show(aMethod: ShowMethod, aDelay?: number, aWindow?: Window): void;
    trace(aMsg: string, flag?: string, caller?: Caller): void;
    [key: string]: unknown;
  }

  interface TabmixSvc {
    aboutBlank: string;
    aboutNewtab: string;
    blockedClickingOptions: number[];
    console: Log;
    debugMode: () => boolean;
    readonly direct2dDisabled: boolean;
    getDialogStrings: (...keys: string[]) => string[];
    getFormattedString: (aStringKey: string, aStringsArray: number[]) => string;
    getSingleWindowMode: () => boolean;
    getString: (key: string) => string;
    getSMString: (key: string) => string;
    i10IdMap: I10Map;
    isCyberfox: boolean;
    isFloorp: boolean;
    isFixedGoogleUrl: (url: string) => boolean;
    isLinux: boolean;
    isMac: boolean;
    isWaterfox: boolean;
    isWindows: boolean;
    loadDefaultPreferences(): void;
    newtabUrl: string;
    prefBranch: nsIPrefBranchXpcom;
    prefs: typeof PreferencesService;
    setCustomTabValue: (tab: MockedGeckoTypes.BrowserTab, key: string, value?: unknown) => void;
    sanitized: boolean;
    setLabel: (property: string) => string;
    sortByRecentlyUsed: string;
    // SessionStore is declared in addon.d.ts
    // SessionStoreGlobal: unknown;
    skipSingleWindowModeCheck: boolean;
    sm: {
      TAB_STATE_NEEDS_RESTORE: number;
      TAB_STATE_RESTORING: number;
      crashed: boolean;
      lastSessionPath: string | null;
      settingPreference: boolean;
      status: string;
    };
    // SessionStore is declared in addon.d.ts
    // ss: unknown;
    _defaultPreferencesLoaded: boolean;
    _strings: nsIStringBundle;
    SMstrings: nsIStringBundle;
    tabStylePrefs: {
      [key: string]: TabStyle;
      progressMeter: TabStyle & {text: false};
    };
    URILoadingHelperChanged: boolean;
    version: BrowserVersion;
    whereToOpenLinkChanged: boolean;
    windowStartup: {
      _initialized: boolean;
      init: (window: Window) => void;
    };
  }
}

interface TabmixPlacesUtils {
  asyncGetTitleFromBookmark(aUrl: string, aTitle: string): Promise<string>;
  applyCallBackOnUrl<T, C extends (...args: any[]) => T | Promise<T>>(aUrl: string, aCallBack: C): Promise<ReturnType<C>>;
}

interface TabmixChromeUtilsType {
  defineLazyGetter(aTarget: any, aName: any, aLambda: any): void;
  import<S extends keyof TabmixKnownModules>(module: S): TabmixKnownModules[S];
  defineLazyModuleGetters(aObject: object | Record<string, unknown>, aModules: Record<string, string>): void;
}

interface TabmixUtils {
  getPostDataFromHistory(legacySHistory: nsISHistory): {isPostData: boolean; postData: string; referrerInfo: string};
  focusedWindow(content: Window): Window;
  updateHistoryTitle(legacySHistory: nsISHistory, title: string): void;
}

declare var ContentSvc: ContentSvc;
declare var gTMPprefObserver: gTMPprefObserver;
declare var LinkNodeUtils: LinkNodeUtils;
declare var Shortcuts: Shortcuts;
declare var TabmixUtils: TabmixUtils;

interface TabmixKnownModules {
  "chrome://tabmix-resource/content/ChromeUtils.jsm": {TabmixChromeUtils: TabmixChromeUtilsType};
  "chrome://tabmix-resource/content/Places.jsm": {TabmixPlacesUtils: TabmixPlacesUtils};
  "chrome://tabmix-resource/content/Shortcuts.jsm": {Shortcuts: Shortcuts};
  "chrome://tabmix-resource/content/TabmixSvc.jsm": {TabmixSvc: TabmixModules.TabmixSvc};
}
