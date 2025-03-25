/// <reference types="./tabmix.d.ts" />

// add here types that apply only for browser windows scope

interface BroadcasterClass extends MozXULElement {
  parentNode: Node;
}

// based on MozButtonBase - chrome/toolkit/content/global/elements/button.js
interface HTMLButtonElement {
  checked: boolean;
  parentNode: HTMLElement;
}

interface GetByMap {
  "alltabs-button": HTMLButtonElement;
  "allTabsMenu_sortTabsButton": HTMLButtonElement;
  "allTabsMenu-searchTabs": HTMLButtonElement;
  "allTabsMenu-tabsSeparator": HTMLMenuElement;
  "autoreload_popup": XULPopupElement;
  "appMenu-multiView": HTMLElement;
  "back-button": HTMLButtonElement;
  "contentAreaContextMenu": ContextMenu;
  "context_openANewTab": HTMLMenuElement;
  "forward-button": HTMLButtonElement;
  "fullscr-toggler": HTMLElement;
  "history-menu": HTMLMenuElement;
  "info.icon": HTMLMenuElement;
  "key_restoreLastClosedTabOrWindowOrSession": HTMLElement;
  "lasttabTabList": TabmixAllTabsNS.PopupElement;
  "nav-bar": HTMLElement;
  "PanelUI-menu-button": HTMLButtonElement;
  "privateTab-afterTabs-openNewPrivateTab": HTMLButtonElement;
  "privateTab-toolbar-openNewPrivateTab": HTMLButtonElement;
  "tabContextMenu": ContextMenu;
  "tabmix-closedTabsButton": HTMLButtonElement;
  "tabmix-closedTabsView": ClosedObjectsUtils.CustomPanelView;
  "tabmix-closedWindowsView": ClosedObjectsUtils.CustomPanelView;
  "tabmix-historyUndoWindowMenu": HTMLMenuElement;
  "tabmix-historyUndoWindowPopup": ClosedObjectsUtils.PopupElement;
  "tabmix-firstTabInRow": Tab;
  "tabmix-menu": HTMLMenuElement;
  "tabmix-scrollbox": TabmixArrowScrollboxNS.RightScrollBox;
  "tabmix-tabs-closebutton": HTMLButtonElement;
  "tabslist": TabmixAllTabsNS.PopupElement;
  "TabsToolbar": HTMLElement;
  "titlebar": HTMLElement;
  "tm-autoreload_menu": HTMLMenuElement;
  "tm-autoreloadTab_menu": HTMLMenuElement;
  "tm-content-closetab": HTMLMenuElement;
  "tm-freezeTab": HTMLMenuElement;
  "tm-lockTab": HTMLMenuElement;
  "tm-tabsList-menu": ClosedObjectsUtils.PopupElement;
  "tm-openinverselink": HTMLMenuElement;
  "tm-protectTab": HTMLMenuElement;
  "tm-content-undoCloseList-menu": HTMLMenuElement;
  "tmp_disableSave": HTMLElement;
  "tmp_undocloseButton": HTMLElement;
  "viewToolbarsMenuSeparator": HTMLElement;
  "widget-overflow-list": HTMLElement;
}

interface createXULMap {
  menuitem: TabmixAllTabsNS.Menuitem;
}

interface ContextMenu extends XULPopupElement {
  showHideSeparators: () => void;
}

declare var AppConstants: AppConstantsType;
declare var TabmixSvc: TabmixSvcModule.TabmixSvc;

// we use "__SSi" to force typescript to return value when using __SSi as index in array
type SSi = "__SSi";

interface Window {
  uuid: string; // for Zen Browser
  __SSi: SSi;
  _tabmix_windowIsClosing: boolean;
  _gBrowser: MockedGeckoTypes.TabBrowser;
  delayedStartupPromise: Promise<void>;
  BrowserCommands: {
    closeTabOrWindow: (event?: Event) => void;
    openTab: typeof GlobalFunctions.TMP_BrowserOpenTab;
  };
  ConfirmationHint: {
    show(anchor: Node, messageId: string, options?: {event?: Event; descriptionId?: string; position?: string; l10nArgs?: Record<string, unknown>}): void;
  };
  duplicateTabIn: (aTab: Tab, where: "tab" | "tabshifted" | "window", delta: number) => void;
  FillHistoryMenu(event: Event): void;
  gBrowser: MockedGeckoTypes.TabBrowser;
  getComputedStyle(elt: Element | Tab, pseudoElt?: string | null): CSSStyleDeclaration | null;
  gMiddleClickNewTabUsesPasteboard: boolean;
  gFissionBrowser: boolean;
  gMultiProcessBrowser: boolean;
  gTMPprefObserver: gTMPprefObserver;
  gURLBar: gURLBar;
  isBlankPageURL: (aURL: string) => boolean;
  OpenBrowserWindow: (options: {private?: boolean; [key: string]: unknown}) => void;
  openLinkIn: (url: string | null | undefined, where: WhereToOpen, params?: Params) => void;
  PlacesOrganizer: {_places: XULTreeElement & {selectedNode: nsINavHistoryResultNode}};
  QueryInterface<T extends nsIID>(aIID: T): nsQIResult<T>;
  restoreLastSession: () => void;
  ResizeObserver: typeof ResizeObserver;
  Services: typeof Services;
  setTimeout: typeof setTimeout;
  Tabmix: TabmixGlobal;
  TMP_Places: TabmixPlaces;
  XULBrowserWindow: XULBrowserWindow;

  /** globals installed by extensions */
  bug489729: unknown;
  com: {
    tobwithu: Record<string, Record<string, unknown>>;
  };
  cookiepieContextMenu: {
    initialized: boolean;
    init: () => void;
  };
  colorfulTabs: {
    clrAllTabsPopPref: boolean;
    standout: unknown;
  };
  IeTab: {
    prototype: Record<string, unknown>;
  };
  ieview: {
    launch: (...args: unknown[]) => unknown;
  };
  IeView: {
    ieViewLaunch: (...args: unknown[]) => unknown;
  };
  InitializeOverlay_avg: {
    Init: unknown;
  };
  organizeSE: {
    doSearch: (...args: unknown[]) => unknown;
  };
  privateTab: {
    isTabPrivate: (selectedTab: Tab) => boolean;
    readyToOpenTab: (ready: boolean) => void;
  };
  SessionSaver: {
    snapBackTab: (...args: unknown[]) => unknown;
    snapback_noFX: unknown;
    snapback_willFocus: unknown;
  };
  SwitchThemesModule: {
    windowsStates?: unknown[];
  };
  TabScope: {
    uninit: () => void;
    init: () => void;
  };

  /** Floorp */
  gFloorpObservePreference: (prefName: string, callback: () => void) => void;

  /** @deprecated - removed from firefox on version 126 */
  BrowserOpenTab: (options: {event: MouseEvent; url: string}) => void;
}

/* Tabmix modules */

type AnchorElement1 = MockedGeckoTypes.TabBrowser | MockedGeckoTypes.BrowserTab | Element | null;

interface XULPopupElement {
  openPopup(anchorElement?: AnchorElement1, options?: StringOrOpenPopupOptions, x?: number, y?: number, isContextMenu?: boolean, attributesOverride?: boolean, triggerEvent?: Event | null): void;
}

interface GetClosestMap {
  menupopup: ClosedObjectsUtils.PopupElement;
}

interface EventTarget {
  _content: Element;
  childNodes: NodeList;
  classList: DOMTokenList;
  closest<K extends keyof GetClosestMap | string>(selector: K | string): K extends keyof GetClosestMap ? GetClosestMap[K] : HTMLElement | null;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  id: string;
  localName: string;
  parentNode: HTMLElement;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string | boolean | number): void;
}

declare namespace ExtensionsCompatibilityNS {
  function onDelayedStartup(): void;
  function onContentLoaded(): void;
  function onWindowOpen(): void;
  function preInit(): void;
  function setVerticalTabs(): void;
  let treeStyleTab: {
    onBeforeNewTabCommand: (tab: Tab, openTabNext: boolean) => void;
    openNewTabNext: (tab: Tab, openTabNext: boolean, clean?: boolean) => void;
  };
}

declare namespace TabDNDObserverNS {
  let _dragOverDelay: number;
  let _moveTabOnDragging: boolean;
  let draglink: string;
  let LinuxMarginEnd: number;
  let DRAG_LINK: number;
  let DRAG_TAB_TO_NEW_WINDOW: number;
  let DRAG_TAB_IN_SAME_WINDOW: number;
  let draggingTimeout: number;
  let paddingLeft: number;
  let _multirowMargin: number;
  let _allVisibleItems: AriaFocusableItems | null;
  let _cachedDnDValue: boolean | null;
  const allVisibleItems: AriaFocusableItems;
  function init(): void;
  function useTabmixDnD(event: DragEvent, tab?: Tab): boolean;
  function handleEvent(event: DragEvent): void;
  function on_dragstart(this: MockedGeckoTypes.TabContainer, event: DragEvent): void;
  function handleDragover(event: DragEvent): boolean;
  function handleDrop(event: DragEvent, draggedTab: Tab, movingTabs: Tab[]): void;
  function on_dragend(event: DragEvent): void;
  function on_dragleave(event: DragEvent): void;
  function _dragoverScrollButton(event: DragEvent): boolean;
  function postDraggingCleanup(event: DragEvent, skipCleanup?: boolean): boolean;
  let _hideTooltipTimeout: number;
  function hideDragoverMessage(): void;
  function showDragoverTooltip(message: string): void;
  function _getDropIndex(event: DragEvent, options?: {dragover?: boolean; getParams?: boolean}): DragEventParams | number;
  function eventParams(event: DragEvent): DragEventParams;
  function getDropElement(aEvent: DragEvent, tab: DraggedElement): AriaFocusableItem | undefined;
  function getNewIndex(event: DragEvent, tab: DraggedElement): number;
  function getEventTarget(event: DragEvent): AriaFocusableItem | MockedGeckoTypes.MozTabbrowserTabGroup | undefined;
  function isDropBefore(event: DragEvent, dropElement: AriaFocusableItem): boolean;
  function getDragType(sourceNode: DraggedSourceNode): {dragType: number; tab: DraggedElement};
  function getDropIndicatorMarginX(draggedTab: DraggedElement, newIndex: number, dropBefore: boolean, itemRect: DOMRect, rect: DOMRect, defaultMargin: number): number;
  function getDropIndicatorMarginY(ind: HTMLElement, dropElement: AriaFocusableItem, rect: DOMRect): number;
  function isLastTabInRow(dropElement: Tab | undefined, dragOverElement: AriaFocusableItem | undefined): boolean;
  function clearDragmark(): void;
  function getSourceNode(aDataTransfer: DataTransfer): HTMLLinkElement | Tab | null;
}

declare namespace TabmixArrowScrollboxNS {
  type ASB = ArrowScrollbox;
  export interface ArrowScrollbox extends MockedGeckoTypes.ArrowScrollbox {
    _arrowScrollAnim: {
      scrollbox: ASB;
      requestHandle: number;
      start(): void;
      stop(): void;
      sample(timeStamp: number): void;
    };

    _continueScroll(index: number): void;
    _distanceScroll(event: PopupEvent): void;
    _pauseScroll(): void;
    _startScroll(index: number): void;
    _stopScroll(): void;
    _lockScroll: boolean;

    _ensureElementIsVisibleAnimationFrame: number;
    _scrollButtonDownLeft: HTMLButtonElement;
    _scrollButtonDownRight: HTMLButtonElement;
    _scrollButtonUpLeft: HTMLButtonElement;
    _scrollButtonUpRight: HTMLButtonElement;
    // instead of private getter in MozArrowScrollbox
    _scrollButtonUpdatePending: boolean;
    _singleRowHeight: number | null;
    _verticalAnimation: number;
    // instead of private getter in MozArrowScrollbox
    _verticalMode: boolean;
    blockUnderflow: boolean;
    firstTabInRowMargin: number;
    firstVisible: {tab: Tab | HTMLElement | null; x: number; y: number};
    firstVisibleRow: number;
    isMultiRow: boolean;
    minOffset: number;
    offsetRatio: number;
    parentNode: MockedGeckoTypes.TabContainer;
    readonly scrollSize: number;
    readonly shadowRoot: ShadowRoot;
    scrollboxPaddingBottom: number;
    scrollboxPaddingTop: number;
    tabmixInitialized: boolean;
    tabmixPrefObserver: {
      scrollbox: ASB;
      observe: (aSubject: unknown, aTopic: string, aData: string) => void;
    };

    _createScrollButtonContextMenu: (aEvent: PopupEvent) => void;
    _ensureElementIsVisibleByIndex: (this: ASB, element: Tab, instant: boolean, index: number) => void;
    _distanceToRow: (amountToScroll: number) => number;
    _finishScroll: (this: ASB, event: DragEvent) => void;
    _enterVerticalMode: (this: ASB, blockUnderflow?: boolean) => void;
    _updateScrollButtonsDisabledState: (aRafCount?: number) => void;
    connectTabmix: (this: ASB) => void;
    disconnectTabmix: () => void;
    resetFirstTabInRow: () => void;
    setFirstTabInRow: (this: ASB, scroll?: boolean) => void;
    readonly singleRowHeight: number;
    updateOverflow: (this: ASB, isOverflow: boolean) => void;
  }

  type RSBDragEvent = DragEvent & {originalTarget: HTMLButtonElement};

  interface CustomElementEventMap extends ElementEventMap {
    dragleave: RSBDragEvent;
    dragover: RSBDragEvent;
    drop: RSBDragEvent;
  }

  type RSB = RightScrollBox;
  export interface RightScrollBox extends MozXULElement, Omit<MockedGeckoTypes.ArrowScrollbox, "getElementsByTagName" | "children"> {
    addEventListener<K extends keyof CustomElementEventMap>(type: K, listener: (this: Element, ev: CustomElementEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
    addButtonListeners: (button: HTMLButtonElement, side: "left" | "right") => void;
    constructor: (this: RSB) => RSB;
    fragment: Node;
    readonly shadowRoot: ShadowRoot;
  }
}

interface QuerySelectorMap {
  "menuitem": TabmixClosedTabsNS.MenuItemInClosedGroup;
  "toolbarbutton": TabmixClosedTabsNS.MenuItemInClosedGroup;
  ".panel-subview-body": ClosedObjectsUtils.PopupElement;
  "[tabmix_selectedID]": Tab;
}

declare namespace TabmixContextNS {
  interface ContextEvent extends Omit<MouseEvent, "target" | "originalTarget"> {
    target: ContextMenu;
    originalTarget: ContextMenu & {triggerNode: {parentNode: {tab: Tab}}};
  }

  let _originalTabbarContextMenu: string | null;
  const _showHideSeparators: string[];
  function buildTabContextMenu(): void;
  function updateTabbarContextMenu(show: boolean): void;
  function toggleEventListener(enable: boolean): void;
  function handleEvent(this: typeof TabmixContextNS, aEvent: ContextEvent): void;
  function updateTabContextMenu(event: ContextEvent): boolean;
  function contextMenuShown(id: "contentAreaContextMenu" | "tabContextMenu"): void;
  function _prepareContextMenu(): void;
  function updateMainContextMenu(event: ContextEvent): boolean;
  function _showAutoReloadMenu(menuId: "tm-autoreload_menu" | "tm-autoreloadTab_menu", pref: string, test: boolean): void;
  function openMultipleLinks(check?: boolean): boolean;
  function updateSelectedTabsCount(itemOrId: HTMLElement | string, isVisible: boolean): number;
}

declare namespace TabmixEventListenerNS {
  type TabEvent = Omit<UIEvent | CustomEvent, "target"> & {target: Tab};

  let _onOpenTimeout: number | null;
  let _tabEvents: string[];
  function init(): void;
  function handleEvent(aEvent: TabEvent | WheelEvent): void;
  function toggleEventListener(aObj: MockedGeckoTypes.TabContainer, aArray: string[], aEnable: boolean, aHandler?: EventListenerOrEventListenerObject): void;
  function _onLoad(aType: "load" | "DOMContentLoaded"): void;
  function onContentLoaded(): void;
  function onWindowOpen(): void;
  let tabWidthCache: WeakMap<WeakKey, number>;
  function onTabAttrModified(aEvent: TabEvent): void;
  function onSSWindowRestored(): Promise<void>;
  function onSSTabRestored(tab: Tab): void;
  function onFullScreen(enterFS: boolean): void;
  function showNavToolbox(): void;
  function updateMouseTargetRect(): void;
  function _updateMarginBottom(aMargin: string): void;
  function _expandCallback(): void;
  function toggleTabbarVisibility(aShow: boolean, aAnimate?: boolean): void;
  function updateMultiRow(aReset?: boolean): void;
  function onTabOpen(aEvent: TabEvent): void;
  function onTabBrowserInserted(event: TabEvent): void;
  let lastTimeTabOpened: number;
  function onTabOpen_delayUpdateTabBar(aTab: Tab): void;
  function onTabOpen_updateTabBar(aTab: Tab): void;
  function onTabClose(aEvent: TabEvent): void;
  function onTabClose_updateTabBar(aTab: Tab): void;
  function onTabSelect(aEvent: TabEvent): void;
  function updateDisplay(tab: Tab): void;
  function onTabMove(aEvent: TabEvent): void;
  function onTabUnpinned(aEvent: TabEvent): void;
  function onTabBarScroll(aEvent: WheelEvent): void;
  function onWindowClose(): void;
  function setTabAttribute(aTab: Tab): void;
  function addGroupMutationObserver(): void;
  function _updateAttrib(aGetAtt: string, aGetValue: string, aAtt: string, aValue: string): void;
}

type OriginalNode = Node;
declare namespace TabmixAllTabsNS {
  type PopupElement = ClosedObjectsUtils.PopupElement;
  type ButtonEvent = Omit<MouseEvent, "target"> & {target: PopupElement};
  type TabEvent = PopupEvent;
  type Menuitem = ClosedObjectsUtils.Menuitem;

  let _selectedItem: Menuitem | null;
  let backupLabel: string;
  // handleEvent receive 3 types of mouse events ButtonEvent TabEvent and PopupEvent
  function handleEvent(aEvent: any): void;
  const checkForCtrlClick: TabmixGlobals.checkForCtrlClick;
  function isAfterCtrlClick(aButton: HTMLElement): boolean;
  function createScrollButtonTabsList(event: PopupEvent, side: "left" | "right"): void;
  function removeTabFromList(event: TabEvent): void;
  function createTabsList(popup: PopupElement, aType: number): boolean;
  function beforeCommonList(popup: PopupElement, aCloseTabsPopup?: boolean): void;
  function createCommonList(popup: PopupElement, aType: number, side?: "left" | "right"): void;
  function _ensureElementIsVisible(event: ButtonEvent): void;
  function createMenuItems(popup: PopupElement, tab: Tab, value: number): void;
  function _setMenuitemAttributes(aMenuitem: Menuitem | null, aTab: Tab, value: number): void;
  function _tabOnTabClose(aEvent: TabEvent): void;
  function _tabsListOncommand(aEvent: TabEvent): void;
  function _tabSelectedFromList(aTab: Tab): void;
  function hideCommonList(popup: PopupElement): void;
  function updateMenuItemActive(item: Menuitem | null): void;
  function updateMenuItemInactive(): void;
  function updateStatusText(itemText: string): void;
}

interface LastTabTabs {
  get tabs(): Tab[];
  // special setter only to remove all tabs
  set tabs(val: null);
}

declare namespace TabmixLastTabNS {
  type KeyEvent = Omit<KeyboardEvent, "target"> & {target: TabmixAllTabsNS.Menuitem};

  let CtrlKey: boolean;
  let handleCtrlTab: boolean;
  let KeyboardNavigating: boolean;
  let KeyLock: boolean;
  let respondToMouseInTabList: boolean;
  let showTabList: boolean;
  let SuppressTabListReset: boolean;
  let TabHistory: Tab[];
  let TabIndex: number;
  const TabList: TabmixAllTabsNS.PopupElement;
  let TabListLock: boolean;
  let _inited: boolean;
  function DisplayTabList(): void;
  function init(): void;
  function deinit(): void;
  function handleEvent(event: KeyEvent): void;
  function disallowDragwindow(keyDown: boolean): void;
  let disallowDragState: boolean;
  function updateDisallowDrag(disallow: boolean): void;
  function ItemActive(event: KeyEvent): void;
  function ItemInactive(event: KeyEvent): void;
  function attachTab(aTab: Tab, lastRelatedTab?: Tab): void;
  function detachTab(aTab: Tab): void;
  function isCtrlTab(event: KeyEvent): boolean;
  function OnKeyDown(event: KeyEvent): void;
  let _tabs: Tab[] | null;
  function OnKeyPress(event: KeyEvent): void;
  let _timer: number | null;
  function OnKeyUp(event: KeyEvent): void;
  function onMenuCommand(event: PopupEvent): void;
  function onPopupshowing(): void;
  function onPopuphidden(): void;
  function OnSelect(): void;
  function PushSelectedTab(): void;
  function ReadPreferences(): void;
  function inverseIndex(index: number): number;
}

declare namespace TabmixPlacesNS {
  // see openTrustedLinkIn in gecko.d.ts
  type OpenLinksParams = {
    inBackground: boolean;
    userContextId: number;
    forceNonPrivate: boolean;
    relatedToCurrent: boolean;
    resolveOnContentBrowserCreated: (contentBrowser: MockedExports.ChromeBrowser) => unknown;
  };

  interface PlacesEvent extends Event {
    id: number;
    itemType: number;
    url: string;
  }

  interface PlacesNode extends Node {
    _placesNode: {uri: string};
  }

  interface HistoryMenuEvent extends Omit<Event, "target"> {
    target: XULPopupElement & {childNodes: PlacesNode[]};
  }

  let _batchData: {remove: string[]; add: string[]};
  let _titlefrombookmark: boolean;
  let listeners: PlacesEventType[];

  const prefHistory: string;
  const prefBookmark: string;
  function addEvent(): void;
  function handleEvent(aEvent: Event & {target: Tab}): void;
  function init(): void;
  function deinit(): void;
  function historyMenuItemsTitle(aEvent: HistoryMenuEvent): void;
  function openMenuItem(aUri: string, aEvent: MouseEvent, aParams: Partial<OpenLinksParams>, aPref: string): void;
  const idsMap: Record<string, string>;
  function openUILink(url: string, event: MouseEvent & {target: EventTarget & {parentNode: PlacesNode}}, where: WhereToOpen, params: Partial<OpenLinksParams>): string | null;
  function isBookmarklet(url: string): boolean;
  function fixWhereToOpen(aEvent: Event, aWhere: WhereToOpen, aPref: string): WhereToOpen;
  function getPrefByDocumentURI(aWindow: Window): string;
  function openGroup(bmGroup: string[], aWhere: WhereToOpen): void;
  function getPreferences(tabCount: number): [boolean, boolean];
  function restoreTabs(tabsInfo: Map<Tab, SessionStoreNS.TabData>, restoreOnDemand: boolean, relatedToCurrent: boolean): void;
  let bookmarksOnDemand: boolean;
  let restoringTabs: Tab[];
  let tabRestoreQueue: Tab[];
  function resetRestoreState(tab: Tab): void;
  function updateRestoringTabsList(tab: Tab): void;
  function restoreNextTab(): void;
  function addImageToLazyPendingTab(tab: Tab): void;
  function setTabTitle(aTab: Tab, aUrl: string, title: string): void;
  function asyncSetTabTitle(tab: Tab, url?: string, initial?: boolean, reset?: boolean): Promise<boolean>;
  function asyncGetTabTitle(aTab: Tab, aUrl: string, title?: string): Promise<string>;
  function getTitleFromBookmark(aUrl: string, aTitle?: string): Promise<string>;
  function asyncGetTitleFromBookmark(aUrl: string, aTitle: string): Promise<string>;
  function isUserRenameTab(aTab: Tab, aUrl: string): boolean;
  function afterTabTitleChanged(bookmarkChanged?: boolean): void;
  function startObserver(): void;
  function stopObserver(): void;
  function onDelayedStartup(): void;
  function onPreferenceChanged(aPrefValue: boolean): void;
  let _hasBookmarksObserver: boolean;
  let inUpdateBatch: boolean;
  let _tabTitleChanged: boolean;
  let currentTab: Tab | null;
  function addItemUrlToTabs(aUrl: string | string[]): Promise<void>;
  function removeItemUrlFromTabs(aUrl: string | string[]): Promise<void>;
  function updateTabs(): Promise<void>;
  function handlePlacesEvents(aEvents: PlacesEvent[]): void;
  function onItemChanged(itemId: number, property: string, isAnnotationProperty: boolean, newValue: string, lastModified: string, itemType: number, parentId: string, guid: string): void;
  function onBeginUpdateBatch(): void;
  function onEndUpdateBatch(): void;
  function onItemVisited(): void;
  function onItemMoved(): void;
  const contextMenu: typeof TabmixPlacesInternalNS.ContextMenu;
  const PlacesUtils: PlacesModule.PlacesUtils;
}

declare namespace TabmixPlacesInternalNS {
  namespace ContextMenu {
    function toggleEventListener(enable: boolean): void;
    function handleEvent(aEvent: Event): void;
    function buildContextMenu(): void;
    function update(open: HTMLElement, openInWindow: HTMLElement, openInPrivateWindow: HTMLElement | {hidden: boolean}, openInTab: HTMLElement, pref: string): void;
  }
}

declare namespace TabmixTabbarNS {
  let _visibleRows: number;
  let hideMode: number;
  let lockallTabs: boolean;
  let position: number;
  const SCROLL_BUTTONS_HIDDEN: number;
  const SCROLL_BUTTONS_LEFT_RIGHT: number;
  const SCROLL_BUTTONS_MULTIROW: number;
  const SCROLL_BUTTONS_RIGHT: number;
  let flowing: string | null;
  const isMultiRow: boolean;
  const multiRowState: "scrollbar" | "true" | null;
  const hasMultiRows: boolean;
  let visibleRows: number;
  function isButtonOnTabsToolBar(button: HTMLButtonElement): boolean;
  function isButtonOnToolBar(button: HTMLButtonElement): boolean;
  function newPrivateTabButton(): HTMLButtonElement | null;
  let scrollButtonsMode: number;
  let widthFitTitle: boolean;
  function updateSettings(start?: boolean): void;
  function setShowNewTabButtonAttr(): void;
  let _updatingAppearance: boolean;
  function updateTabsInTitlebarAppearance(): void;
  let _updateScrollStatusTimeout: number | null;
  function updateScrollStatus(delay?: boolean): void;
  let _tabsPosition: "tabsonbottom" | "customtitlebar";
  function getTabsPosition(): "tabsonbottom" | "customtitlebar";
  const singleRowHeight: number;
  let _waitAfterMaximized: boolean;
  function _handleResize(): void;
  function inSameRow(tab1: Tab | null, tab2: Tab | HTMLButtonElement | MockedGeckoTypes.MozTextLabelContainer | null): boolean;
  function setFirstTabInRow(): void;
  function removeShowButtonAttr(): void;
  const _real_numPinnedTabs: number;
}

declare namespace PrivateFunctionsNS {
  namespace UndocloseTabButtonObserver {
    function _removeTab(b: MockedGeckoTypes.TabBrowser, aTab: Tab): void;
  }
}

declare namespace TabmixprefObserverNS {
  interface PrefMap {
    CharPref: string;
    IntPref: number;
    BoolPref: boolean;
  }

  function _updateStatus(pref: string, testVal: number, test: boolean, newVal: number): void;
  function getPrefByType<K extends keyof PrefMap>(prefName: string, aDefault: PrefMap[K], aType: K): PrefMap[K];
  function _getVersion(currentVersion: string, shouldAutoUpdate: boolean): void;
  function _setNewTabUrl(oldPref: string, newPref: string, controlPref?: string): void;
  function migrateCtrlTab(oldPrefName: string): void;
}

declare namespace TabWebProgressListener {
  let mTabBrowser: MockedGeckoTypes.TabBrowser | null;
  let showProgressOnTab: boolean;
  function onProgressChange(aBrowser: Browser, aWebProgress: nsIWebProgress, aRequest: nsIRequest, aCurSelfProgress: i32, aMaxSelfProgress: i32, aCurTotalProgress: i32, aMaxTotalProgress: i32): void;
  function onStateChange(aBrowser: Browser, aWebProgress: nsIWebProgress, aRequest: nsIRequest, aStateFlags: u32, aStatus: nsresult): void;
}

declare namespace TabmixProgressListenerNS {
  function startup(tabBrowser: MockedGeckoTypes.TabBrowser): void;
  const listener: typeof TabWebProgressListener;
}

type ExtensionsCompatibility = typeof ExtensionsCompatibilityNS;
type TabDNDObserver = typeof TabDNDObserverNS;
type TabmixAllTabs = typeof TabmixAllTabsNS;
type TabmixClosedTabs = typeof TabmixClosedTabsNS;
type TabmixContext = typeof TabmixContextNS;
type TabmixEventListener = typeof TabmixEventListenerNS & {tabsAlreadyOpened?: boolean};
type TabmixLastTab = typeof TabmixLastTabNS & LastTabTabs;
type TabmixPlaces = typeof TabmixPlacesNS;
type TabmixprefObserver = typeof TabmixprefObserverNS;
type TabmixProgressListener = typeof TabmixProgressListenerNS;
type TabmixSessionStore = typeof TabmixSessionStoreNS;
type TabmixTabbar = typeof TabmixTabbarNS & {_failedToEnterVerticalMode?: boolean};
type TabmixTabClickOptions = typeof TabmixTabClickOptionsNS;

// add types from namespaces that added in this file or in extraTabmixUtils.d.ts
declare namespace MockedGeckoTypes {
  interface BrowserTab {
    mCorrespondingMenuitem: TabmixAllTabsNS.Menuitem | null;
  }

  function loadURIFunction(uri: nsIURI, loadURIOptions?: LoadURIOptions & AddTabParams): Tab | null;
  function loadURIFunction(uri: string | nsIURI, loadURIOptions?: LoadURIOptions & AddTabParams): Tab | null;

  interface ChromeBrowser {
    // we overrife these funcions in tablib.loadURIWrapper
    fixupAndLoadURIString: (uri: string, loadURIOptions?: LoadURIOptions & AddTabParams) => Tab | null;
    loadURI: (uri: nsIURI, loadURIOptions?: LoadURIOptions & AddTabParams) => Tab | null;
  }

  interface TabBrowser {
    addTabsProgressListener(listener: typeof TabmixProgressListenerNS.listener): void;
    createTabsForSessionRestore: (restoreTabsLazily: boolean, selectTab: number, tabDataList: SessionStoreNS.TabData[], tabGroupDataList: any[]) => NonEmptyArray<BrowserTab>;
    removeTabsProgressListener: (listener: typeof TabmixProgressListenerNS.listener) => void;
  }

  // arrowScrollbox: ArrowScrollbox;
  interface TabContainer {
    _animateElement: ArrowScrollbox | TabmixArrowScrollboxNS.RightScrollBox;
    arrowScrollbox: TabmixArrowScrollboxNS.ArrowScrollbox;
  }

  interface TabBox {
    handleEvent(event: Event | TabmixLastTabNS.KeyEvent): void;
  }
}

interface nsIDOMWindowUtils {
  getBoundsWithoutFlushing(aElement: ElementTypesExtended): DOMRect;
}

declare namespace Tablib {
  function populateUndoWindowSubmenu(undoPopup: ClosedObjectsUtils.CustomPanelView, panel?: ClosedObjectsUtils.PopupElement, isAppMenu?: boolean): void;
}

interface PrivateMethods {
  // ArrowScrollbox
  updateScrollButtonsDisabledState: TabmixArrowScrollboxNS.ArrowScrollbox["_updateScrollButtonsDisabledState"];
}

type ElementTypesExtended = ElementTypes | TabmixAllTabsNS.PopupElement;

interface TabmixGlobal {
  tablib: typeof Tablib;
  isAltKey(event: MouseEvent | TabmixLastTabNS.KeyEvent): boolean;
  getBoundsWithoutFlushing(element: ElementTypesExtended): DOMRect;
}

interface EventTypeMap<T extends HTMLElement> {
  click: GenericEvent<T, MouseEvent>;
  ViewShowing: GenericEvent<ClosedObjectsUtils.CustomPanelView, MouseEvent>;
}

/** globals installed by extensions */
declare var colorfulTabs: Window["colorfulTabs"];
declare var privateTab: Window["privateTab"];
declare var TabView: {
  afterUndoCloseTab: () => void;
  prepareUndoCloseTab: (tab: MockedGeckoTypes.BrowserTab | null) => void;
  [key: string]: unknown;
};
