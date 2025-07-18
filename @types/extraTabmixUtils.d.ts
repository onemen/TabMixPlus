/// <reference types="./modules.d.ts" />

interface Functions {
  getById<K extends keyof GetByMap | string>(selectors: K): K extends keyof GetByMap ? GetByMap[K] : any | null;
}

// more methods in addon.d.ts
interface PrivateMethods {
  // gBrowser
  getTabMoveState: MockedGeckoTypes.TabBrowser["_getTabMoveState"];
  handleTabMove: MockedGeckoTypes.TabBrowser["_handleTabMove"];
  isLastTabInWindow: MockedGeckoTypes.TabBrowser["_isLastTabInWindow"];
  notifyPinnedStatus: MockedGeckoTypes.TabBrowser["_notifyPinnedStatus"];
  notifyOnTabMove: MockedGeckoTypes.TabBrowser["_notifyOnTabMove"];
  // TabContainer
  animateExpandedPinnedTabMove: MockedGeckoTypes.TabContainer["_animateExpandedPinnedTabMove"];
  clearDragOverCreateGroupTimer: MockedGeckoTypes.TabContainer["_clearDragOverCreateGroupTimer"];
  expandGroupOnDrop: MockedGeckoTypes.TabContainer["_expandGroupOnDrop"];
  getDragTarget: MockedGeckoTypes.TabContainer["_getDragTarget"];
  getDropIndex: MockedGeckoTypes.TabContainer["_getDropIndex"];
  isAnimatingMoveTogetherSelectedTabs: MockedGeckoTypes.TabContainer["_isAnimatingMoveTogetherSelectedTabs"];
  isContainerVerticalPinnedGrid: MockedGeckoTypes.TabContainer["_isContainerVerticalPinnedGrid"];
  /** @deprecated replaced with _isContainerVerticalPinnedGrid in firefox 138 */
  isContainerVerticalPinnedExpanded: MockedGeckoTypes.TabContainer["_isContainerVerticalPinnedExpanded"];
  moveTogetherSelectedTabs: MockedGeckoTypes.TabContainer["_moveTogetherSelectedTabs"];
  resetTabsAfterDrop: MockedGeckoTypes.TabContainer["_resetTabsAfterDrop"];
  setDragOverGroupColor: MockedGeckoTypes.TabContainer["_setDragOverGroupColor"];
  triggerDragOverCreateGroup: MockedGeckoTypes.TabContainer["_triggerDragOverCreateGroup"];
  updateTabStylesOnDrag: MockedGeckoTypes.TabContainer["_updateTabStylesOnDrag"];
}

interface TabmixGlobal {
  // see changedcode and getPrivateMethod in modules.d.ts

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
  extensions: {treeStyleTab: boolean; tabGroupManager: boolean; verticalTabs: boolean; verticalTabBar: boolean; ieTab2: boolean; gIeTab: TabmixGlobals.gIeTab};

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
  tabsUtils: TabmixTabsUtils;
  visibleTabs: typeof VisibleTabs;

  // tablib.js
  readonly emptyTabTitle: string;
  newTabUrls: string[];
  _duplicateTab(this: MockedGeckoTypes.TabBrowser, aTab: Tab, aHref?: string, aTabData?: SessionStoreNS.TabData | string, disallowSelect?: boolean, dontFocusUrlBar?: boolean): Tab | null;
  duplicateTab(aTab: Tab, aHref?: string, aTabData?: SessionStoreNS.TabData | string, disallowSelect?: boolean, dontFocusUrlBar?: boolean): Tab | null;
  getOpenTabNextPref(aRelatedToCurrent?: boolean): boolean;
  getOpenDuplicateNextPref(): boolean;
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
  undoCloseTab(aIndex?: number, sourceWindowSSId?: string): MockedGeckoTypes.BrowserTab | null;

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
interface MenuPopupEvent extends Omit<MouseEvent, "target" | "originalTarget"> {
  target: ClosedObjectsUtils.PopupElement;
  originalTarget: ClosedObjectsUtils.PopupElement;
}

declare namespace ClosedObjectsUtils {
  type CustomPanelView = TabmixGlobals.CustomPanelView;
  type Menuitem = TabmixGlobals.Menuitem;
  type ScrollBox = TabmixGlobals.ScrollBox;
  type PopupElement = TabmixGlobals.PopupElement;

  type OpenPopup = (anchorElement?: Menuitem | null, options?: PopupOptions | string, x?: number, y?: number, isContextMenu?: boolean, attributesOverride?: boolean, triggerEvent?: PopupEvent) => void;

  interface PopupOptions extends Omit<OpenPopupOptions, "triggerEvent"> {
    triggerEvent?: PopupEvent | null;
  }

  interface ButtonEvent extends Omit<MouseEvent, "target"> {
    target: HTMLButtonElement;
  }

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
  interface _MouseEvent extends MouseEvent {
    __tabmix__whereToOpen?: WhereToOpen;
    target: EventTarget;
  }
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
  tabIndex?: number;
  flags?: number;
  forceForeground?: boolean;
  ownerTab?: Tab | null;
  loadInBackground?: boolean;
  fromExternal?: boolean;
  relatedToCurrent?: boolean;
  resolveOnNewTabCreated?: (value: unknown) => void;
  skipAnimation?: boolean;
  tabGroup?: MockedGeckoTypes.MozTabbrowserTabGroup | null;
  triggeringPrincipal_base64?: string;
  url?: string;
};

interface LoadURIParams extends LoadURIOptions, AddTabParams {}
type loadURIArgs = [browser: Browser, uri: string | URI, params?: LoadURIParams];

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
  type ClosedTabsInfo = {tabs: ClosedTabData[]; index: {value: number}};

  interface MenuItemInClosedGroup extends HTMLElement {
    closedGroup: ClosedGroup;
    _tabmix_middleClicked?: boolean;
  }

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

interface ContextMenu extends XULPopupElement {
  showHideSeparators: () => void;
}

interface TabmixContextEvent extends Omit<MouseEvent, "target" | "originalTarget"> {
  target: ContextMenu;
  originalTarget: ContextMenu & {triggerNode: {parentNode: {tab: Tab}}};
}

interface TabmixContextTypes {
  _originalTabbarContextMenu: string | null;
  _currentMenuOrder: number;
  _originalOrderSaved: boolean;
  _showHideSeparators: string[];

  $id: Functions["getById"];

  buildTabContextMenu(): void;
  _saveOriginalMenuOrder(): void;
  updateMenuOrder(): void;
  _tabmixMenuOrder: [item: string, reference: string, where?: "insertbefore" | "insertafter"][];
  _setTabmixOrder(): void;
  _setFirefoxOrder(): void;
  updateTabbarContextMenu(show: boolean): void;
  toggleEventListener(enable: boolean): void;
  handleEvent(aEvent: TabmixContextEvent): void;
  readonly tabContextConfig: TabContextConfigModule.Exports;
  updateTabContextMenu(event: TabmixContextEvent): boolean;
  contextMenuShown(id: "contentAreaContextMenu" | "tabContextMenu"): void;
  _prepareContextMenu(): void;
  updateMainContextMenu(event: TabmixContextEvent): boolean;
  _showAutoReloadMenu(menuId: "tm-autoreload_menu" | "tm-autoreloadTab_menu", showMenu: boolean): void;
  openMultipleLinks(check?: boolean): boolean;
  updateSelectedTabsCount(itemOrId: HTMLElement | string, isVisible: boolean): number;
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

interface TabmixTabsUtils {
  _inUpdateVerticalTabStrip: boolean;
  _keepLastTab: boolean;
  _show_newtabbutton: string | null;
  checkNewtabButtonVisibility: boolean;
  closeButtonsEnabled: boolean;
  customTitlebar: CustomTitlebar;

  initialized: boolean;
  tabBar: MockedGeckoTypes.TabContainer;
  scrollClientRect: DOMRect;
  getInnerbox(): HTMLElement;
  inDOMFullscreen: boolean;
  visible: boolean;
  isVerticalTabBar: boolean;
  isVerticalTabs: boolean;
  getCollapsedState: {collapsed: boolean; toolbar: HTMLElement; tabBar: MockedGeckoTypes.TabContainer; toolbarCollapsed: boolean; tabBarCollapsed: boolean};
  getTabsCount(num?: number): number;
  events: string[];
  init(): void;
  addTabsObserver(): void;
  onUnload(): void;
  handleEvent(aEvent: MouseEvent): void;
  initializeTabmixUI(): void;
  updateVerticalTabStrip(params?: {reset?: boolean}): string | null;
  _newTabButtonWidth(onSide?: boolean): number;
  _widthCache: {minWidth: number; maxWidth: number; [key: number]: number};
  updateMinWidth(): void;
  adjustNewtabButtonVisibility(): void;
  disAllowNewtabbutton: boolean;
  overflow: boolean;
  showNewTabButtonOnSide(aCondition: boolean, aValue: string): void;
  topTabY: number;
  lastTabRowNumber: number;
  lastPinnedTabRowNumber: number;
  getTabRowNumber(aTab: Tab | HTMLButtonElement | MockedGeckoTypes.MozTextLabelContainer | undefined, aTop: number): number;
  canScrollTabsLeft: boolean;
  canScrollTabsRight: boolean;
  createTooltip(box: HTMLElement & {label: string}): void;
  tryRemoveTabmixScrollbox(): void;
  isSingleRow(visibleTabs: Tab[]): boolean;
  _resizeObserver: ResizeObserver | null;
  _lastTabBarWidth: number;
  resizeObserver(observe: boolean): void;
  _tab_overflow_width: number;
  updateOverflowMaxWidth(): void;
  updateScrollButtons(useTabmixButtons: boolean): void;
  isElementVisible(element: AriaFocusableItem | null | undefined): boolean;
  protonValues: {enabled: boolean; name: string; val: string; margin: string};
  updateProtonValues(): void;
  _allVisibleItems: AriaFocusableItems | null;
  allVisibleItems: AriaFocusableItems;
  invalidateAllVisibleItems(): void;
  patchInvalidateCachedVisibleTabs(): void;
  positionPinnedTabs(): void;
  _pinnedTabsContainer: string;
  updatePinnedTabsContainer(): void;
  updatefirstTabInRowMargin(): void;
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
