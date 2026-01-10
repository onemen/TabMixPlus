/// <reference types="./overrideGecko.d.ts" />
/// <reference types="./gecko/devtools/gecko.d.ts" />
/// <reference types="./extraTabmixUtils.d.ts" />

// Tabmix modules

interface TabmixContextMenu {
  getSelectedLinks(content: Window): Map<string, string>;
}

// for gTMPprefObserver._tabStyleSheet
interface CSSRule {
  readonly name: string;
  readonly style: CSSStyleDeclaration;
}

interface HTMLDialogElement {
  getButton(buttonId: string): HTMLButtonElement;
  set defaultButton(buttonId: string);
  get defaultButton(): string;
}

type RulesTypes = "max-rows" | "tabMaxWidthVar" | "visibleRows" | "width" | "inlineMaxWidth" | "tabMinHeight" | "themeBackground";
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
  checkScriptsUpdateNeeded: () => Promise<boolean>;
  showUpdatePage: (currentVersion: string) => Promise<void>;
  updateTabClickingOptions: () => void;
  updateTabsStyle: (ruleName: DynamicRulesModule.RuleName) => void;
  updateSettings: () => void;
  updateStyleAttributes: () => void;
  updateStyleAttribute: (ruleName: DynamicRulesModule.RuleName, styleName: string) => string;
}

type AttributeProps = {
  hasAttribute: (name: string) => boolean;
  hidden: boolean | null;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  setAttribute: (name: string, value: string) => void;
};

type ItemOrId = string | null | undefined | AttributeProps;
type LazyGetterReturnType<T extends (() => unknown) | unknown> = T extends () => infer R ? R : T;
type ElementTypes = Node | HTMLElement | Tab;

interface TabmixGlobal {
  get prefs(): nsIPrefBranchXpcom;
  get defaultPrefs(): nsIPrefBranchXpcom;
  get isSingleBrowserWindow(): boolean;
  get isLastBrowserWindow(): boolean;
  get isFirstWindowInSession(): boolean;

  firstWindowInSession?: boolean;
  _debug: boolean;
  isVersion: TabmixModules.BrowserVersion["isVersion"];
  isAltKey(event: MouseEvent): boolean;
  debug(aMessage: string, aShowCaller?: boolean): void;
  showItem(aItemOrId: ItemOrId, aShow?: boolean): void;
  setItem(aItemOrId: ItemOrId, aAttr: string, aVal: unknown): void;
  setAttributeList(aItemOrId: ItemOrId, aAttr: string, aValue: string, aAdd?: boolean): void;
  setFTLDataId(elementId: string, map?: I10Map): void;
  convert(id: string, data?: I10MapValue): string;
  getBoundsWithoutFlushing(element: ElementTypes): DOMRect;
  getTopWin(): MockedGeckoTypes.BrowserWindow;
  isNewWindowAllow(isPrivate?: boolean): boolean;
  lazy_import(aObject: Record<string, unknown>, aName: string, aModule: string, aSymbol: string, aFlag?: boolean, aArg?: unknown[]): void;
  lazyGetter<T extends (() => unknown) | unknown, O extends object, K extends keyof O & string>(obj: O, name: K, get: T, config?: {configurable?: boolean; enumerable?: boolean}): LazyGetterReturnType<T>;
  backwardCompatibilityGetter(aObject: Record<string, unknown>, aOldName: string, aNewName: string): void;
  informAboutChangeInTabmix(aOldName: string, aNewName: string): void;
  windowEnumerator(aWindowtype?: string | null): MockedGeckoTypes.nsISimpleEnumeratorWithWindow;
  numberOfWindows(all?: boolean, aWindowtype?: string | null): number;
  compare(a: number, b: number, lessThan: boolean): boolean;
  itemEnd(item: Tab | MockedGeckoTypes.MozTabSplitViewWrapper | HTMLElement, end: boolean): number;
  _getMethod(id: string, args: IArguments): unknown;
  installChangecode(): void;
  _init(): void;
  originalFunctions: (OriginalFunctions & Record<string, (...args: unknown[]) => unknown>) | Record<string, any>;
  destroy(): void;

  // imported from log.sys.mjs
  show: LogModule.Console["show"];
  assert: LogModule.Console["assert"];
  callerName: LogModule.Console["callerName"];
  callerTrace: LogModule.Console["callerTrace"];
  log: LogModule.Console["log"];
  clog: LogModule.Console["clog"];
  obj: LogModule.Console["obj"];
  getObject: LogModule.Console["getObject"];
  reportError: LogModule.Console["reportError"];
}

interface OriginalFunctions {
  swapBrowsersAndCloseOther: TabBrowser["swapBrowsersAndCloseOther"];

  _loadURI: Window["_loadURI"];
  duplicateTabIn: Window["duplicateTabIn"];
  FillHistoryMenu: Window["FillHistoryMenu"];
  FullScreen_showNavToolbox: FullScreen["showNavToolbox"];
  gBrowser_addTab: TabBrowser["addTab"];
  gBrowser_findTabToBlurTo: TabBrowser["_findTabToBlurTo"];
  gBrowser_removeTab: TabBrowser["removeTab"];
  gBrowser_setInitialTabTitle: TabBrowser["setInitialTabTitle"];
  gURLBar_handleCommand: gURLBar["handleCommand"];
  gURLBar__whereToOpen: gURLBar["_whereToOpen"];
  gURLBar_setURI: gURLBar["setURI"];
  tabContainer_updateCloseButtons: MockedGeckoTypes.TabContainer["_updateCloseButtons"];
  isBlankPageURL: Window["isBlankPageURL"];
  OpenBrowserWindow: Window["OpenBrowserWindow"];
  openLinkIn: Window["openLinkIn"];
  openInverseLink: nsContextMenu["openLinkInTab"];

  _getDropIndex: TabContainer["_getDropIndex"];
  _finishAnimateTabMove: TabContainer["finishAnimateTabMove"];
  _invalidateCachedTabs: TabContainer["_invalidateCachedTabs"];
  _invalidateCachedVisibleTabs: TabContainer["_invalidateCachedVisibleTabs"];
  _moveTogetherSelectedTabs: TabContainer["_moveTogetherSelectedTabs"];
  /** @deprecated replaced with TabContainer.#moveTogetherSelectedTabs in firefox 133 */
  _groupSelectedTabs: TabContainer["_groupSelectedTabs"];
  on_dragstart: TabContainer["on_dragstart"];
  on_dragover: TabContainer["on_dragover"];
  _tabmix_on_dragover: TabContainer["on_dragover"];
  on_drop: TabContainer["on_drop"];
  _tabmix_on_drop: TabContainer["on_drop"];
  on_dragend: TabContainer["on_dragend"];
  on_dragleave: TabContainer["on_dragleave"];
}

declare var gTMPprefObserver: gTMPprefObserver;
declare var LinkNodeUtils: LinkNodeUtilsModule.LinkNodeUtils;
declare var Shortcuts: ShortcutsModule.Shortcuts;
