type DeferredPromise = {promise: Promise<void>; resolve: () => void; reject: () => void};
type FunctionWithUnknown = (...args: unknown[]) => unknown;
type FunctionWithAny = (...args: any[]) => any;
type Tab = MockedGeckoTypes.BrowserTab;
type Browser = MockedGeckoTypes.ChromeBrowser;

interface Functions {
  getById<K extends keyof GetByMap | string>(selectors: K): K extends keyof GetByMap ? GetByMap[K] : any | null;
}

declare namespace ChangeCodeNS {
  type Options = {forceUpdate?: boolean; silent?: boolean; setter?: boolean; getter?: boolean};
  type ReplaceParams = {check?: boolean; flags?: "g"; silent?: boolean};
  type Descriptor = {
    configurable: boolean;
    enumerable: boolean;
    writable: boolean;
    value?: FunctionWithUnknown;
    get?: FunctionWithUnknown;
    set?: FunctionWithUnknown;
    [key: string]: unknown;
  };
  interface ChangeCodeParams {
    obj: Record<string, unknown>;
    fnName: string;
    fullName: string;
    options?: Options;
  }
  interface ChangeCodeClass {
    obj: Record<string, any>;
    fnName: string;
    fullName: string;
    needUpdate: boolean;
    silent: boolean;
    type: "__lookupSetter__" | "__lookupGetter__";
    value: string;
    errMsg: string;
    notFound: (string | RegExp)[];

    prototype: ChangeCodeClass;
    new (aParams: ChangeCodeParams): ChangeCodeClass;
    isInstance: IsInstance<ChangeCodeClass>;

    ChangeCode(this: ChangeCodeClass, aParams: ChangeCodeParams): void;
    _replace(this: ChangeCodeClass, substr: string | RegExp, newString: string, aParams?: ReplaceParams): ChangeCodeClass;
    toCode(this: ChangeCodeClass, aShow?: boolean, aObj?: Record<string, any>, aName?: string): void;
    defineProperty(this: ChangeCodeClass, aObj?: Record<string, unknown>, aName?: string, aCode?: {setter?: string; getter?: string}): void;
    show(aObj?: Record<string, unknown>, aName?: string): void;
    isValidToChange(this: ChangeCodeClass, aName: string): boolean;
    getCallerData(stack: nsIStackFrame, aOptions?: unknown): {filename: string; lineNumber: number; columnNumber: number; fnName: string; message: string};
  }
}

declare var ChangeCodeClass: ChangeCodeNS.ChangeCodeClass;

declare namespace TabmixNS {
  // from changedcode
  let _debugMode: boolean;
  let _localMakeCode: string;
  function _makeCode(name: string | null, code: string): FunctionWithUnknown;
  function changeCode(aParent: Record<string, any>, afnName: string, aOptions?: ChangeCodeNS.Options): ChangeCodeNS.ChangeCodeClass;
  function nonStrictMode(aObj: Record<string, any>, aFn: string, aArg?: unknown): void;
  function setNewFunction(aObj: Record<string, any>, aName: string, aCode: FunctionWithAny): void;

  // tabmix.js
  let _lastTabOpenedTime: number;
  let _deferredInitialized: DeferredPromise;
  let afterTabsButtonsWidth: number[];
  let initialization: typeof TabmixInitialization;
  let isFirstWindow: boolean;
  let selectedTab: Tab | null;
  let singleWindowMode: boolean;
  let tabsNewtabButton: HTMLButtonElement;
  let userTypedValue: string;
  function afterDelayedStartup(): void;
  function beforeDelayedStartup(): void;
  function getAfterTabsButtonsWidth(this: typeof TabmixNS): void;
  function sessionInitialized(): void;
  function startup(): void;
  // lazygetters for modules (jsm files)
  const SlideshowInitialized: boolean;
  let autoReload: typeof AutoReload;
  let flst: typeof Flst;
  let MergeWindows: typeof MergeWindowsModule;
  let renameTab: typeof RenameTab;
  let Utils: typeof UtilsModules;

  // click.js
  function openInverseLink(ev: Event): void;
  let allTabs: typeof AllTabs;

  // contentLinks.js
  let ContentClick: typeof ContentClickModule;
  let contentAreaClick: typeof ContentAreaClick;

  // extensions.js
  let extensions: {treeStyleTab: boolean; tabGroupManager: boolean; verticalTabs: boolean; verticalTabBar: boolean; ieTab2: boolean; gIeTab: false | {obj: "gIeTab2" | "gIeTab"; folder: "ietab2" | "ietab"}; sessionManager: boolean};

  // lasttab.js
  let keyModifierDown: boolean;
  let slideshow: {cancel(): void};

  // minit.js
  let navToolbox: typeof NavToolbox;
  function getStyle(aObj: Element, aStyle: string): number;
  function getMovingTabsWidth(movingTabs: Tab[]): number;
  function getPlacement(id: string): number;
  function hidePopup(aPopupMenu: XULPopupElement): void;
  function whereToOpen(pref: string | boolean, altKey?: boolean): {inNew: boolean; lock: boolean};

  // places.js
  let onContentLoaded: typeof OnContentLoaded;
  function whereToOpenLink(event: MouseEvent, ignoreButton: boolean, ignoreAlt: boolean): WhereToOpen;

  // session.js
  const BUTTON_OK: number;
  const CHECKBOX_CHECKED: number;
  const HIDE_CHECKBOX: number;
  const HIDE_MENUANDTEXT: number;

  // sessionStore.js
  let closedObjectsUtils: typeof ClosedObjectsUtils;
  let isWindowAfterSessionRestore: boolean;

  // setup.js
  let _callPrepareLoadOnStartup: boolean;
  function _updateCloseButtons(this: MockedGeckoTypes.TabContainer, skipUpdateScrollStatus: boolean, aUrl?: string | null): void;
  function beforeStartup(tabBrowser: MockedGeckoTypes.TabBrowser, aTabContainer: MockedGeckoTypes.TabContainer): void;
  function beforeBrowserInitOnLoad(): void;
  function BrowserOpenTab(): void;
  function linkHandling_init(): void;
  function prepareLoadOnStartup(uriToLoad?: string | string[] | null): void;
  function set_BrowserOpenTab(): void;

  // ScriptsLoader.jsm;
  let isAfterMozAfterPaint: boolean;
  let promiseOverlayLoaded: Promise<void>;
  function copyTabData(newTab: Tab, oldTab: Tab): void;

  // scrollbox.js
  let multiRow: typeof MultiRow;

  // tab.js
  let _nextSelectedID: number;
  let ltr: boolean;
  let rtl: boolean;
  let bottomToolbarUtils: typeof BottomToolbarUtils;
  let contextMenuLinks: Map<string, string> | null;
  let defaultCloseButtons: boolean;
  let sideNewTabButton: HTMLButtonElement | null;
  let tabsUtils: typeof TabsUtils;
  let visibleTabs: typeof VisibleTabs;

  // tablib.js
  interface TabSwitcher {
    updateDisplay: () => void;
    visibleTab: Tab;
  }

  type TabDataEntry = {url: string; title: string; triggeringPrincipal_base64?: string};
  type TabData = {
    attributes?: Record<string, string>;
    entries: TabDataEntry[];
    index: number;
    pinned?: boolean;
    userContextId?: number;
    userTypedValue: string;
    userTypedClear: number;
    xultab?: string;
  };

  const emptyTabTitle: string;
  let newTabUrls: string[];
  function _duplicateTab(this: MockedGeckoTypes.TabBrowser, aTab: Tab, aHref?: string, aTabData?: TabData | string, disallowSelect?: boolean, dontFocusUrlBar?: boolean): Tab | null;
  function duplicateTab(aTab: Tab, aHref?: string, aTabData?: TabData | string, disallowSelect?: boolean, dontFocusUrlBar?: boolean): Tab | null;
  function formatValueSync(id: string, args?: {tabCount?: number; winTitle?: string} | L10nArgs): string;
  function getOpenTabNextPref(aRelatedToCurrent?: boolean): boolean;
  function isBlankNewTab(url: string): boolean;
  function isNewTabUrls(aUrl: string): boolean;
  function updateSwitcher(switcher: TabSwitcher): void;

  // userinterface.js
  let handleTabbarVisibility: typeof HandleTabbarVisibility & Record<string, any>;
  function checkCurrent(url: string): Partial<WhereToOpen>;
  function clearUrlBarIfNeeded(aTab: Tab, aUrl: string, aTimeOut: boolean, replaceLastTab: boolean): void;
  function isPendingTab(aTab: Tab): boolean;
  function openOptionsDialog(panel?: string): void;
  function openUILink_init(): void;
  function restoreTabState(aTab: Tab): void;
  function setTabStyle(aTab: Tab, boldChanged?: {value: boolean}): void;
  function updateUrlBarValue(): void;
  function urlBarOnBlur(): void;
}

declare namespace AllTabs {
  function init(): void;
  function insertSortButton(): void;
  function sortTabsInList(): void;
  function showAllTabsPanel(event: GenericEvent<HTMLElement, Event>): void;
}

declare namespace AutoReload {
  function initTab(aTab: Tab): void;
  function onTabReloaded(aTab: Tab, aBrowser: Browser): void;
  function restorePendingTabs(aTab: Tab): void;
  function toggle(aTab: Tab): void;
}

declare namespace BottomToolbarUtils {
  const toolbox: HTMLElement;
  let _resizeObserver: ResizeObserver | null;
  let _observing: Set<string>;
  let _bottomRect: {top?: number | null; width?: number | null; height?: number | null};
  let _customizingMinTop: number;
  function init(): void;
  function createToolbox(): void;
  function createFullScrToggler(): void;
  function resizeObserver(elementId?: string, isCustomizing?: boolean): void;
  function _update(): void;
}

declare namespace ClosedObjectsUtils {
  interface CustomPanelView extends HTMLElement {
    lastChild: HTMLMenuElement;
    menupopup: PopupElement;
  }

  type Menuitem = Omit<HTMLMenuElement, "parentNode"> & {
    readonly parentNode: PopupElement;
    readonly triggerNode: Menuitem;
    value: number;
  };

  interface PopupElement extends Omit<HTMLElement, "childNodes" | "parentNode" | "firstChild" | "lastChild"> {
    hasStatusListener?: boolean;
    readonly childNodes: HTMLCollectionBase_G<Menuitem>;
    readonly firstChild: Menuitem;
    readonly lastChild: Menuitem;
    readonly parentNode: CustomPanelView;
    readonly triggerNode: Menuitem;
  }
  type ButtonEvent = Omit<MouseEvent, "target"> & {target: HTMLButtonElement};

  let _initialized_closedTabs: boolean;
  let _initialized_closedWindows: boolean;
  let initialized: boolean;
  function init(this: typeof ClosedObjectsUtils): void;
  function initObjectPanel(viewType: "Tabs" | "Windows"): void;
  function checkForMiddleClick(event: GenericEvent<Menuitem, MouseEvent>): void;
  function forgetClosedWindow(index: number): void;
  function observe(subject: nsISupports, topic: string): void;
  function on_popupshowing(popup: PopupElement): boolean;
  function on_delete(node: Menuitem): void;
  function addHoverListeners(params: CustomPanelView): void;
  function populateClosedTabsMenu(undoTabMenu: CustomPanelView): boolean;
  function populateClosedWindowsMenu(undoWindowMenu: CustomPanelView): void;
  function removeObservers(this: typeof ClosedObjectsUtils): void;
  function restoreWindow(where: WhereToOpen | "delete", index: number): void;
  function showSubView(event: ButtonEvent): Promise<void>;
  function toggleRecentlyClosedWindowsButton(): void;
  function updateView(popup: PopupElement): void;
  function updateAppmenuView(panel: PopupElement, type: "Tabs" | "Windows"): void;
}

declare class CompatibilityCheck {
  constructor(aWindow: Window, aShowList: boolean, aCallbackDialog?: boolean);
}

declare namespace ContentAreaClick {
  function init(): void;
  function _contentLinkClick(aEvent: MouseEvent): void;
}

declare namespace ContentClickModule {
  interface SyntaticEvent {
    button: number;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    target: unknown;
    tabmix_openLinkWithHistory: boolean;
  }

  function contentLinkClick(event: MouseEvent, browser: Browser, focusedWindow: mozIDOMWindowProxy): void;
  function getParamsForLink(event: MouseEvent | SyntaticEvent, linkNode: EventTarget, href: string, browser: Browser, focusedWindow: Window): {where: string; _href: string; suppressTabsOnFileDownload: boolean; targetAttr: string};
  function isLinkToExternalDomain(curpage: string, target: string): boolean;
  function isUrlForDownload(url: string): boolean;
}

declare namespace Flst {
  const slideShowTimer: nsITimer;
  function cancel(): void;
}

declare namespace HandleTabbarVisibility {
  const contextMenu: XULPopupElement;
  const pref: boolean;
  function getHideTabbarMenu(): {hideTabbarMenu: HTMLMenuElement; separator: HTMLElement};
  let enabled: boolean;
  function toggleEventListener(enable: boolean): void;
  function handleEvent(event: Event): void;
  function on_popupshowing(event: Event & {target: XULPopupElement}): void;
}

declare namespace MergeWindowsModule {
  function mergeWindows(aWindow: Window): void;
}

declare namespace MultiRow {
  function init(): void;
  function extandArrowscrollbox(): void;
  function addScrollBoxButtons(): void;
}

declare namespace NavToolbox {
  type _MouseEvent = MouseEvent & {__tabmix__whereToOpen?: WhereToOpen; target: EventTarget};

  let customizeStarted: boolean;
  let toolboxChanged: boolean;
  let resetUI: boolean;
  let listener: {onWidgetAfterDOMChange: CustomizableUIListener["onWidgetAfterDOMChange"]};
  let urlBarInitialized: boolean;
  function init(): void;
  function deinit(): void;
  function handleEvent(event: Event): void;
  function customizeStart(): void;
  function customizeDone(aToolboxChanged: boolean): void;
  function updateToolboxItems(): void;
  function initializeURLBar(): void;
  function handleCommand(this: gURLBar, event: _MouseEvent, openUILinkWhere?: boolean): void;
  function on_mouseup(this: gURLBar["view"], event: _MouseEvent): void;
  function getClosestSelectableElement(element: EventTarget, options?: {byMouse?: boolean}): Element | null;
  function isElementVisible(element: HTMLElement | null): boolean;
  function whereToOpenFromUrlBar(event: _MouseEvent, result?: UrlbarResult | null): void;
  function whereToOpenSearch(aWhere: WhereToOpen): WhereToOpen;
  function initializeSearchbar(): void;
  function toolbarButtons(): void;
  function tabStripAreaChanged(): void;
  function setScrollButtons(reset?: boolean, onlyPosition?: boolean): void;
}

declare namespace OnContentLoaded {
  function changeCode(): void;
  function change_miscellaneous(): void;
  function change_whereToOpenLink(parent: typeof BrowserUtils | Window): void;
  function change_utilityOverlay(): void;
  function getXnotifierFunction(aName: string): [WindowProxy | Record<string, unknown>, string];
}

declare namespace PrivateFunctionsNS {
  namespace onContentLoaded {
    type Params = {forceprivate?: boolean; forceNonPrivate?: boolean; inBackground?: boolean; private?: boolean; skipPopups?: boolean; targetBrowser?: Browser};
    function _getTargetWindow(params?: Params): Window | null;
    function _getWindow(where: WhereToOpen, params?: Params): {w: Window | null; where: WhereToOpen};
    function _openLinkIn(url: string, _where: WhereToOpen, params?: Params): void;
  }
}

declare namespace RenameTab {
  function editTitle(aTab: Tab): void;
}

type AddTabParams = {
  allowInheritPrincipal?: boolean;
  allowMixedContent?: boolean;
  allowThirdPartyFixup?: boolean;
  background?: boolean;
  charset?: string | null;
  inBackground?: boolean;
  index?: number;
  flags?: number;
  forceForeground?: boolean;
  ownerTab?: Tab | null;
  loadInBackground?: boolean;
  fromExternal?: boolean;
  relatedToCurrent?: boolean;
  resolveOnNewTabCreated?: (value: unknown) => void;
  skipAnimation?: boolean;
  url?: string;
  triggeringPrincipal_base64?: string;
};

type loadURIArgs = [browser: Browser, uri: string | URI, params?: LoadURIOptions & AddTabParams];

declare namespace Tablib {
  const labels: string[];
  const recentlyClosed: Localization & {label: string; oneTabLabel: string};
  function getValidUrl(): string | null;
  function openLinkInCurrent(): void;
  function warnAboutClosingTabsProps(this: MockedGeckoTypes.TabBrowser, tabsToClose: number, aCloseTabs: MockedGeckoTypes.EnumValues): void;
  function showClosingTabsPrompt(this: MockedGeckoTypes.TabBrowser, shouldPrompt: number, tabsToClose: number, numProtected: number, flags: number, warnOnClose: {value: boolean}, extraArgs?: {checkboxLabel2?: string; restoreSession?: {value: boolean}}): number;

  let version: string;
  let _inited: boolean;
  function init(): void;
  let _loadURIInitialized: boolean;
  function setLoadURI(aBrowser: Browser): void;
  function loadURIWrapper(browser: Browser, methodName: "loadURI" | "fixupAndLoadURIString"): void;
  function setLoadURI_before_112(aBrowser: Browser): void;
  function _loadURI(...args: loadURIArgs): Tab | null;
  function allowLoad(browser: Browser, uri: string): boolean;
  function isException(loadInCurrent: boolean): boolean;
  function change_gBrowser(): void;
  function change_tabContainer(): void;
  function change_utility(): void;
  // for function populateUndoWindowSubmenu see addon.d.ts
  function addNewFunctionsTo_gBrowser(): void;
  function getTabTitle(aTab: Tab, url: string): boolean;
  function onTabTitleChanged(aTab: Tab, aBrowser: Browser, isUrlTitle?: boolean): void;
  function onRemoveTab(tab: Tab): void;
  function closeLastTab(): void;
  function whereToOpenDrop(aEvent: MouseEvent | DragEvent, aUri: string): string;
  function setURLBarFocus(): void;
  function reloadTabs(tabs: Tab[], skipTab?: Tab): void;
}

type InitializationStep = {id: number; obj: string; initialized?: boolean};
type InitializationSteps = Omit<typeof TabmixInitialization, "run" | "isValidWindow" | "_lastPhase">;
declare namespace TabmixInitialization {
  const _lastPhase: number;
  const init: InitializationStep;
  const beforeStartup: InitializationStep;
  const onContentLoaded: InitializationStep;
  const beforeBrowserInitOnLoad: InitializationStep;
  const onWindowOpen: InitializationStep;
  const afterDelayedStartup: InitializationStep;
  const isValidWindow: boolean;
  function run(aPhase: keyof InitializationSteps, ...rest: unknown[]): unknown;
}

declare namespace TabsUtils {
  let _inUpdateVerticalTabStrip: boolean;
  let _keepLastTab: boolean;
  let _show_newtabbutton: string | null;
  let checkNewtabButtonVisibility: boolean;
  let closeButtonsEnabled: boolean;

  let initialized: boolean;
  let _tabmixPositionalTabs: {
    beforeSelectedTab?: Tab | null | undefined;
    afterSelectedTab?: Tab | null | undefined;
    beforeHoveredTab?: Tab | null | undefined;
    afterHoveredTab?: Tab | null | undefined;
  };
  const tabBar: MockedGeckoTypes.TabContainer;
  const scrollClientRect: DOMRect;
  function getInnerbox(): HTMLElement;
  const inDOMFullscreen: boolean;
  const visible: boolean;
  const isVerticalTabBar: boolean;
  const isVerticalTabs: boolean;
  const getCollapsedState: {collapsed: boolean; toolbar: HTMLElement; tabBar: MockedGeckoTypes.TabContainer; toolbarCollapsed: boolean; tabBarCollapsed: boolean};
  function getTabsCount(num?: number): number;
  const events: string[];
  function init(): void;
  function addPendingObserver(): void;
  function onUnload(): void;
  function handleEvent(aEvent: MouseEvent): void;
  function initializeTabmixUI(): void;
  function updateVerticalTabStrip(params?: {reset?: boolean; forceRightSide?: boolean}): string | null;
  function adjustNewtabButtonVisibility(forceRightSide?: boolean): void;
  let disAllowNewtabbutton: boolean;
  let overflow: boolean;
  function showNewTabButtonOnSide(aCondition: boolean, aValue: string): void;
  const topTabY: number;
  const lastTabRowNumber: number;
  function getTabRowNumber(aTab: Tab | HTMLButtonElement | undefined, aTop: number): number;
  const canScrollTabsLeft: boolean;
  const canScrollTabsRight: boolean;
  function createTooltip(box: HTMLElement & {label: string}): void;
  function isSingleRow(visibleTabs: Tab[]): boolean;
  let _resizeObserver: ResizeObserver | null;
  let _lastResize: {time: number; width: number};
  function resizeObserver(observe: boolean): void;
  function updateScrollButtons(useTabmixButtons: boolean): void;
  function isElementVisible(element: Tab | null | undefined): boolean;
  const protonValues: {enabled: boolean; name: string; val: string; margin: string};
  function updateProtonValues(): void;
}

declare namespace UtilsModules {
  function initMessageManager(window: Window): void;
  function deinit(window: Window): void;
}

declare namespace VisibleTabs {
  const tabs: Tab[];
  const first: Tab;
  const last: Tab;
  function previous(aTab: Tab): Tab | null;
  function next(aTab: Tab): Tab | null;
  function indexOf(aTab: Tab): number;
}

declare namespace GlobalFunctions {
  function TMP_BrowserOpenTab(eventOrObject?: {event?: MouseEvent; url?: string}, aTab?: Tab, replaceLastTab?: boolean): void;
}

interface OriginalFunctions {
  switcher_updateDisplay: TabmixNS.TabSwitcher["updateDisplay"];
}

interface TabmixKnownModules {
  "chrome://tabmix-resource/content/extensions/CompatibilityCheck.jsm": {CompatibilityCheck: typeof CompatibilityCheck};
}
