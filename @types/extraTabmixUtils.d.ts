/// <reference types="./modules.d.ts" />

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
    obj: Record<string, any>;
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
    type: "__lookupSetter__" | "__lookupGetter__" | "";
    _value: string;
    errMsg: string;
    notFound: (string | RegExp)[];

    get value(): string;
    _replace(this: ChangeCodeClass, substr: string | RegExp, newString: string, aParams?: ReplaceParams): ChangeCodeClass;
    toCode(this: ChangeCodeClass, aShow?: boolean, aObj?: Record<string, any>, aName?: string): void;
    defineProperty(this: ChangeCodeClass, aObj?: Record<string, unknown>, aName?: string, aCode?: {setter?: string; getter?: string}): void;
    show(aObj?: Record<string, unknown>, aName?: string): void;
    isValidToChange(this: ChangeCodeClass, aName: string): boolean;
    getCallerData(stack: nsIStackFrame, aOptions?: unknown): Error;
    verifyPrivateMethodReplaced(this: ChangeCodeClass): void;
  }
}

declare var ChangeCodeClass: ChangeCodeNS.ChangeCodeClass;

// more methods in addon.d.ts
interface PrivateMethods {
  // gBrowser
  handleTabMove: MockedGeckoTypes.TabBrowser["_handleTabMove"];
  // TabContainer
  animateExpandedPinnedTabMove: MockedGeckoTypes.TabContainer["_animateExpandedPinnedTabMove"];
  clearDragOverCreateGroupTimer: MockedGeckoTypes.TabContainer["_clearDragOverCreateGroupTimer"];
  expandGroupOnDrop: MockedGeckoTypes.TabContainer["_expandGroupOnDrop"];
  getDragTarget: MockedGeckoTypes.TabContainer["_getDragTarget"];
  getDropIndex: MockedGeckoTypes.TabContainer["_getDropIndex"];
  isAnimatingMoveTogetherSelectedTabs: MockedGeckoTypes.TabContainer["_isAnimatingMoveTogetherSelectedTabs"];
  moveTogetherSelectedTabs: MockedGeckoTypes.TabContainer["_moveTogetherSelectedTabs"];
  setDragOverGroupColor: MockedGeckoTypes.TabContainer["_setDragOverGroupColor"];
  triggerDragOverCreateGroup: MockedGeckoTypes.TabContainer["_triggerDragOverCreateGroup"];
}

interface TabmixGlobal {
  // from changedcode
  _debugMode: boolean;
  _localMakeCode: string;
  changeCode(aParent: Record<string, any>, afnName: string, aOptions?: ChangeCodeNS.Options): ChangeCodeNS.ChangeCodeClass;
  nonStrictMode(aObj: Record<string, any>, aFn: string, aArg?: unknown): void;
  setNewFunction(aObj: Record<string, any>, aName: string, aCode: FunctionWithAny): void;
  // in modules.d.ts
  // _makeCode
  // getPrivateMethod

  // tabmix.js
  _lastTabOpenedTime: number;
  _deferredInitialized: DeferredPromise;
  afterTabsButtonsWidth: number[];
  afterTabsButtonsWidthReady: boolean;
  initialization: typeof TabmixInitialization;
  isFirstWindow: boolean;
  selectedTab: Tab | null;
  singleWindowMode: boolean;
  tabsNewtabButton: HTMLButtonElement;
  userTypedValue: string;
  afterDelayedStartup(): void;
  beforeDelayedStartup(): void;
  getAfterTabsButtonsWidth(): void;
  startup(): void;
  // lazygetters for modules (sys.js files)
  SlideshowInitialized: boolean;
  autoReload: AutoReloadModule.AutoReload;
  docShellCapabilities: typeof DocShellCapabilities;
  flst: SlideshowModule.Flst;
  MergeWindows: MergeWindowsModule.MergeWindows;
  renameTab: typeof RenameTab;
  Utils: typeof UtilsModules;

  // click.js
  openInverseLink(ev: Event): void;
  allTabs: typeof AllTabs;

  // contentLinks.js
  ContentClick: ContentClickModule.ContentClick;
  contentAreaClick: typeof ContentAreaClick;

  // extensions.js
  extensions: {treeStyleTab: boolean; tabGroupManager: boolean; verticalTabs: boolean; verticalTabBar: boolean; ieTab2: boolean; gIeTab: false | {obj: "gIeTab2" | "gIeTab"; folder: "ietab2" | "ietab"}};

  // lasttab.js
  keyModifierDown: boolean;
  slideshow: {cancel(): void};

  // minit.js
  navToolbox: typeof NavToolbox;
  getStyle(aObj: Element | Tab, aStyle: string): number;
  getMovingTabsWidth(movingTabs: Tab[]): number;
  getPlacement(id: string): number;
  isTabGroup(element: DraggedSourceNode | MockedGeckoTypes.MozTabbrowserTabGroup | undefined): element is MockedGeckoTypes.MozTabbrowserTabGroup;

  // getPrivateMethod is in addon.d.ts
  hidePopup(aPopupMenu: XULPopupElement): void;
  whereToOpen(pref: string | boolean, altKey?: boolean): {inNew: boolean; lock: boolean};

  // places.js
  onContentLoaded: typeof OnContentLoaded;

  // sessionStore.js
  closedObjectsUtils: typeof ClosedObjectsUtils;
  isWindowAfterSessionRestore: boolean;

  // setup.js
  beforeStartup(tabBrowser: MockedGeckoTypes.TabBrowser, aTabContainer: MockedGeckoTypes.TabContainer): void;
  beforeBrowserInitOnLoad(): void;
  BrowserOpenTab(): void;
  linkHandling_init(): void;
  set_BrowserOpenTab(): void;

  // ScriptsLoader.sys.mjs;
  isAfterMozAfterPaint: boolean;
  promiseOverlayLoaded: Promise<void>;
  copyTabData(newTab: Tab, oldTab: Tab): void;

  // scrollbox.js
  multiRow: typeof MultiRow;

  // tab.js
  _nextSelectedID: number;
  ltr: boolean;
  rtl: boolean;
  bottomToolbarUtils: typeof BottomToolbarUtils;
  contextMenuLinks: Map<string, string> | null;
  defaultCloseButtons: boolean;
  sideNewTabButton: HTMLButtonElement | null;
  tabsUtils: typeof TabsUtils;
  visibleTabs: typeof VisibleTabs;

  // tablib.js
  readonly emptyTabTitle: string;
  newTabUrls: string[];
  _duplicateTab(this: MockedGeckoTypes.TabBrowser, aTab: Tab, aHref?: string, aTabData?: SessionStoreNS.TabData | string, disallowSelect?: boolean, dontFocusUrlBar?: boolean): Tab | null;
  duplicateTab(aTab: Tab, aHref?: string, aTabData?: SessionStoreNS.TabData | string, disallowSelect?: boolean, dontFocusUrlBar?: boolean): Tab | null;
  getOpenTabNextPref(aRelatedToCurrent?: boolean): boolean;
  isBlankNewTab(url: string): boolean;
  isNewTabUrls(aUrl: string): boolean;
  updateSwitcher(switcher: MockedGeckoTypes.TabSwitcher): void;
  moveTabTo: MockedGeckoTypes.TabBrowser["moveTabTo"];
  tabsSelectionUtils: {
    _tabOrderMap: WeakMap<WeakKey, number>;
    _counter: number;
    init(): void;
    trackTab(tab: Tab): void;
    getTabOrder(tab: Tab): number | undefined;
    getLastOpenedTab(tabs: Tab[]): Tab | null;
    removeTab(tab: Tab): void;
    getPreviousSelectedTab: (tab: Tab) => Tab | null;
    selectPreviousTab: (tab: Tab) => void;
    selectTabAfterRemove: (tab: Tab, aExcludeTabs?: Tab[]) => Tab | null;
  };

  // userinterface.js
  handleTabbarVisibility: typeof HandleTabbarVisibility & Record<string, any>;
  checkCurrent(url: string): Partial<WhereToOpen>;
  clearUrlBarIfNeeded(aTab: Tab, aUrl: string, aTimeOut: boolean, replaceLastTab: boolean): void;
  isPendingTab(aTab: Tab): boolean;
  openOptionsDialog(panel?: string): void;
  openUILink_init(): void;
  restoreTabState(aTab: Tab): void;
  setTabStyle(aTab: Tab, boldChanged?: {value: boolean}): void;
  updateUrlBarValue(): void;
  urlBarOnBlur(): void;
}

declare namespace AllTabs {
  function init(): void;
  function insertSortButton(): void;
  function sortTabsInList(): void;
  function showAllTabsPanel(event: GenericEvent<HTMLElement, Event>): void;
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

type PopupEvent = TabmixGlobals.PopupEvent;
type MenuPopupEvent = Omit<MouseEvent, "target" | "originalTarget"> & {target: ClosedObjectsUtils.PopupElement; originalTarget: ClosedObjectsUtils.PopupElement};

declare namespace ClosedObjectsUtils {
  type CustomPanelView = TabmixGlobals.CustomPanelView;
  type Menuitem = TabmixGlobals.Menuitem;
  type ScrollBox = TabmixGlobals.ScrollBox;
  type PopupElement = TabmixGlobals.PopupElement;

  type PopupOptions = Omit<OpenPopupOptions, "triggerEvent"> & {triggerEvent?: PopupEvent | null};
  type OpenPopup = (anchorElement?: Menuitem | null, options?: PopupOptions | string, x?: number, y?: number, isContextMenu?: boolean, attributesOverride?: boolean, triggerEvent?: PopupEvent) => void;
  type ButtonEvent = Omit<MouseEvent, "target"> & {target: HTMLButtonElement};

  let _initialized_closedTabs: boolean;
  let _initialized_closedWindows: boolean;
  let initialized: boolean;
  function init(this: typeof ClosedObjectsUtils): void;
  function initObjectPanel(viewType: "Tabs" | "Windows"): void;
  function checkForMiddleClick(event: GenericEvent<Menuitem, MouseEvent>): void;
  function forgetClosedWindow(index: number): void;
  function observe(subject: nsISupports, topic: string): void;
  function on_popupshowing(event: MenuPopupEvent, popup: PopupElement): void;
  function on_delete(node: Menuitem): void;
  function addHoverListeners(params: CustomPanelView): void;
  function addSeparatorIfMissing(popup: CustomPanelView): void;
  function populateClosedTabsMenu(undoTabMenu: CustomPanelView): boolean;
  function populateClosedWindowsMenu(undoWindowMenu: CustomPanelView): void;
  function removeObservers(this: typeof ClosedObjectsUtils): void;
  function restoreWindow(where: WhereToOpen | "delete", index: number): void;
  function showSubView(event: ButtonEvent): void;
  function toggleRecentlyClosedWindowsButton(): void;
  function updateView(popup: PopupElement): void;
  function updateAppmenuView(panel: PopupElement, type: "Tabs" | "Windows"): void;
}

declare namespace DocShellCapabilities {
  function init(): void;
  function update(browser: Browser, data: any): void;
  function collect(tab: Tab): void;
  function restore(tab: Tab, disallow: string[], reload: boolean): void;
  function onGet(nodes: HTMLCollectionBase_G<ClosedObjectsUtils.Menuitem>, tab: Tab): void;
  function onSet(tab: Tab, node: Node): void;
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

declare namespace MultiRow {
  function init(): void;
  function extandArrowscrollbox(): void;
  function addScrollBoxButtons(): void;
}

declare namespace NavToolbox {
  type _MouseEvent = MouseEvent & {__tabmix__whereToOpen?: WhereToOpen; target: EventTarget};
  type OnWidgetAfterDOMChange = MockedExports.CustomizableUIListener["onWidgetAfterDOMChange"];

  let customizeStarted: boolean;
  let toolboxChanged: boolean;
  let resetUI: boolean;
  let listener: {onWidgetAfterDOMChange: OnWidgetAfterDOMChange};
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
  function _loadURI(...args: loadURIArgs): Tab | null;
  function allowLoad(browser: Browser, uri: string): boolean;
  function isException(loadInCurrent: boolean): boolean;
  function change_gBrowser(): void;
  function change_tabContainer(): void;
  function change_utility(): void;
  // for function populateUndoWindowSubmenu see addon.d.ts
  function addNewFunctionsTo_gBrowser(): void;
  const tabEpochs: WeakMap<Tab, number>;
  function getTabTitle(aTab: Tab, url: string): boolean;
  function onTabTitleChanged(aTab: Tab, aBrowser: Browser, isUrlTitle?: boolean): void;
  function closeLastTab(): void;
  function whereToOpenDrop(aEvent: MouseEvent | DragEvent, aUri: string): string;
  function setURLBarFocus(): void;
  function reloadTabs(tabs: Tab[], skipTab?: Tab): void;
}

declare namespace TabmixClosedTabsNS {
  type ClosedTabData = SessionStoreNS.ClosedTabData;
  type ClosedDataSource = SessionStoreNS.ClosedDataSource;
  type WindowStateData = SessionStoreNS.WindowStateData;
  type TabData = SessionStoreNS.TabData;

  type PanelView = ClosedObjectsUtils.CustomPanelView;
  type Popup = ClosedObjectsUtils.PopupElement;
  type Menuitem = ClosedObjectsUtils.Menuitem;
  type ButtonEvent = TabmixGlobals.ButtonEvent;
  type ClosedGroup = {id: string; sourceClosedId: number; sourceWindowId: string};
  type MenuItemInClosedGroup = HTMLElement & {closedGroup: ClosedGroup; _tabmix_middleClicked?: boolean};
  type ClosedTabsInfo = {tabs: ClosedTabData[]; index: {value: number}};

  let _buttonBroadcaster: HTMLElement | null;
  const buttonBroadcaster: HTMLElement;
  function setButtonType(menuOnly: boolean): void;
  function setButtonDisableState(aState?: boolean): void;
  const count: number;
  const getClosedTabData: ClosedTabData[];
  const allClosedTabData: ClosedTabData[];
  function getSource(item: HTMLElement): ClosedDataSource;
  function _resolveClosedDataSource(source: ClosedDataSource): WindowStateData;
  function _getStateForClosedTabsAndClosedGroupTabs<Index extends number | undefined>(winData: WindowStateData, aIndex?: Index): Index extends number ? ClosedTabData : ClosedTabData[];
  function _getClosedTabStateFromUnifiedIndex(winData: WindowStateData, tabState: ClosedTabData): {closedTabSet: ClosedTabData[]; closedTabIndex: number};
  function getPreferredRemoteType(url: string, aWindow: Window, userContextId?: number): string;
  function getSingleClosedTabData(source: ClosedDataSource, index: number): {tabData: ClosedTabData | undefined; closedTabIndex: number};
  function getUrl(aTabData: ClosedTabData): string;
  function getTitle(aTabData: ClosedTabData, aUri: string): Promise<string>;
  let keepMenuOpen: boolean;
  function populateUndoSubmenu(aPopup: PanelView, panel: Popup, isAppMenu?: boolean): boolean;
  function closeTabGroupView(parent: Popup | ClosedObjectsUtils.CustomPanelView, groupId: string): void;
  function updateTabGroupItems(menu: Popup, closedTabsInfo: ClosedTabsInfo, isSubviewbutton: boolean): void;
  function updateMenuItem(item: Menuitem | MenuItemInClosedGroup, closedTabsInfo: ClosedTabsInfo): void;
  function repopulateGroupItems(popup: Popup, item: Menuitem): void;
  function addMenuItem(popup: PanelView | Menuitem | Popup, isSubviewbutton: boolean, options: {id: string; label: string; command?: () => void; val?: number; keyId?: string; tagName?: string}): Element;
  function handleEvent(event: PopupEvent): void;
  const handleButtonEvent: TabmixGlobals.handleButtonEvent;
  function restoreCommand(aEvent: PopupEvent): void;
  function setPopupWidth(popup: Popup | Node): void;
  function checkForMiddleClick(aEvent: PopupEvent): void;
  function contextMenuOnPopupShowing(event: MenuPopupEvent, popup: Popup): void;
  function contextMenuOnCommand(event: PopupEvent): void;
  function doCommand(command: "restoreTab" | "addBookmarks" | "copyTabUrl", where: string, item: Menuitem, keepMenuOpen?: boolean): void;
  function addBookmarks(source: ClosedDataSource, index: number): void;
  function copyTabUrl(source: ClosedDataSource, index: number): void;
  function restoreTab(source: ClosedDataSource, index: number, where: string): void;
  function removeAllClosedTabs(): void;
  function removeClosedTabData(source: ClosedDataSource, index: number): ClosedTabData | null;
  function restoreToNewWindow(source: ClosedDataSource, index: number): void;
  function restoreAllClosedTabs(): void;
  function _undoCloseTab(aSource: ClosedDataSource, aIndex: number, aWhere: string, aSelectRestoredTab: boolean, aBlankTabToReuse?: Tab | null, multiple?: boolean): Tab | null;
  function fix_bug_1868452(item: Menuitem): boolean;
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

declare namespace TabmixSessionStoreNS {
  type TabData = SessionStoreNS.TabData;
  type TabDataEntry = SessionStoreNS.TabDataEntry;

  function asyncGetTabTitleForClosedWindow(aUndoItem: SessionStoreNS.WindowStateData): Promise<string>;
  function getActiveEntryData(aData: TabData): TabDataEntry;
  function getTitleFromTabState(aTab: Tab): string;
  function getUrlFromTabState(aTab: Tab): string;
  function isBlankPendingTab(aTab: Tab): boolean;
  let afterSwitchThemes: boolean;
  function setAfterSessionRestored(): void;
  function setSessionRestore(aEnable: boolean): void;
  function asyncGetTabTitle(aData: TabData, aUri: string, aTitle: string): Promise<string>;
  function _getAttribute(aTabData: TabData, attrib: string): string;
}

declare namespace TabmixTabClickOptionsNS {
  let _tabFlipTimeOut: number | undefined;
  let _blockDblClick: boolean;
  function isOverlayIcons(event: MouseEvent): boolean;
  function onTabClick(aEvent: MouseEvent): void;
  function clearTabFlipTimeOut(): void;
  function onTabBarDblClick(aEvent: MouseEvent): void;
  function clickAction(pref: string, clickOutTabs: boolean, aTab: Tab, event: MouseEvent): void;
  function doCommand(command: number, aTab: Tab, clickOutTabs?: boolean, event?: MouseEvent): boolean;
  function _tabMultiSelected(aTab: Tab): void;
  function _tabRangeSelected(aTab: Tab, cumul: boolean): void;
  function toggleEventListener(enable: boolean): void;
  function blockDblclick(aEvent: MouseEvent): void;
  function blockMouseDown(event: MouseEvent): boolean;
}

declare namespace TabsUtils {
  let _inUpdateVerticalTabStrip: boolean;
  let _keepLastTab: boolean;
  let _show_newtabbutton: string | null;
  let checkNewtabButtonVisibility: boolean;
  let closeButtonsEnabled: boolean;
  let customTitlebar: CustomTitlebar;

  let initialized: boolean;
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
  function addTabsObserver(): void;
  function onUnload(): void;
  function handleEvent(aEvent: MouseEvent): void;
  function initializeTabmixUI(): void;
  function updateVerticalTabStrip(params?: {reset?: boolean}): string | null;
  function _newTabButtonWidth(onSide?: boolean): number;
  let _widthCache: {minWidth: number; maxWidth: number; [key: number]: number};
  function updateMinWidth(): void;
  function adjustNewtabButtonVisibility(): void;
  let disAllowNewtabbutton: boolean;
  let overflow: boolean;
  function showNewTabButtonOnSide(aCondition: boolean, aValue: string): void;
  const topTabY: number;
  const lastTabRowNumber: number;
  const lastPinnedTabRowNumber: number;
  function getTabRowNumber(aTab: Tab | HTMLButtonElement | MockedGeckoTypes.MozTextLabelContainer | undefined, aTop: number): number;
  const canScrollTabsLeft: boolean;
  const canScrollTabsRight: boolean;
  function createTooltip(box: HTMLElement & {label: string}): void;
  function tryRemoveTabmixScrollbox(): void;
  function isSingleRow(visibleTabs: Tab[]): boolean;
  let _resizeObserver: ResizeObserver | null;
  let _lastTabBarWidth: number;
  function resizeObserver(observe: boolean): void;
  let _tab_overflow_width: number;
  function updateOverflowMaxWidth(): void;
  function updateScrollButtons(useTabmixButtons: boolean): void;
  function isElementVisible(element: AriaFocusableItem | null | undefined): boolean;
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
  switcher_updateDisplay: MockedGeckoTypes.TabSwitcher["updateDisplay"];
}
