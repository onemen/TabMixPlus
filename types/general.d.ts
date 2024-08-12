/// <reference types="./gecko/lib.gecko.nsresult.d.ts" />
/// <reference types="./gecko/lib.gecko.xpcom.d.ts" />
/// <reference types="./gecko/lib.gecko.services.d.ts" />
/// <reference types="./custom.gecko.dom.d.ts" />
/// <reference types="./gecko/gecko.d.ts" />

interface Element {
  __tagName?: string;
  value: string;
  readonly style: CSSStyleDeclaration;
  getElementsByClassName<K extends keyof GetByMap>(name: K): HTMLCollection_G<GetByMap[K], K> | null;
  // it is ok to allow setAttribute to convert the value to string for us
  setAttribute(name: string, value: string | boolean | number): void;
}

interface HTMLElement {
  firstChild: Element | null;
}

interface CSSStyleDeclaration {
  height: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
  marginTop: string;
  maxHeight: string;
  listStyleImage: string;
  opacity: string | number;
  paddingBottom: string;
  paddingLeft: string;
  paddingRight: string;
  paddingTop: string;
  width: string;
  transform: string;
}

declare namespace MockedGeckoTypes {
  interface BrowsingContext extends MockedExports.BrowsingContext {
    sessionHistory: nsISHistory | null;
  }

  interface ChromeBrowser extends MockedExports.ChromeBrowser {
    _contentWindow?: Window;
    browsingContext: BrowsingContext;
    contentTitle?: string;
    readonly characterSet: string;
    readonly contentDocument: Document | null;
    readonly currentURI: URI | null;
    droppedLinkHandler: typeof handleDroppedLink;
    getAttribute(name: string): string | null;
    focus(): void;
    loadURI: (uri: string, loadURIOptions?: Params) => void;
    messageManager: MockedExports.MessageManager;
    stop: () => void;
    set userTypedValue(val: string);
    get userTypedValue(): string | null;

    /// modified by Tab Mix Plus
    __tabmix__whereToOpen: WhereToOpen;
    tabmix_allowLoad?: boolean;
  }

  interface Browser extends MockedExports.Browser {
    readonly currentURI: URI | null;
    selectedBrowser?: ChromeBrowser;
  }

  interface BrowserTab extends MockedExports.BrowserTab, Element {
    readonly _isProtected: boolean;
    _labelIsInitialTitle?: boolean;
    _tPos: number;
    closing: boolean;
    readonly container: TabContainer;
    connectedCallback: () => void;
    initialize: () => void;
    readonly isEmpty: boolean;
    label: string;
    linkedBrowser: ChromeBrowser;
    set linkedPanel(val: string);
    get linkedPanel(): string | null;
    readonly multiselected: boolean;
    owner?: BrowserTab;
    readonly pinned: boolean;
    selected: boolean;

    /// modified by Tab Mix Plus
    __duplicateFromWindow?: boolean;
    __newLastTab?: string;
    _initialized: boolean;
    readonly baseY: number;
    clearTimeouts: () => void;
    doMouseHoverSelect: (tab: BrowserTab) => void;
    loadOnStartup: boolean;
    mButtonId?: number;
    mFocusId: number;
    mIsHover: boolean;
    mSelect: number;
    readonly mouseDownSelect: boolean;
    readonly mouseHoverSelect: boolean;
    readonly mouseHoverSelectDelay: number;
    mOverCloseButton?: boolean;
    removeShowButton: (tab: BrowserTab) => void;
    setHoverState: (aEvent: MouseEvent, aHover: boolean) => void;
    setShowButton: (tab: BrowserTab) => void;
    readonly tabXDelay: number;
    tabmix_inited: boolean;
    tabmix_allowLoad: boolean;
    tabmixKey: any;
  }

  interface ArrowScrollbox extends Element {
    _singleRowHeight: number;
    _canScrollToElement: (element: BrowserTab) => boolean;
    _createScrollButtonContextMenu: (aEvent: MouseEvent) => void;
    _distanceToRow: (amountToScroll: number) => number;
    _isRTLScrollbox: boolean;
    _getScrollableElements: () => BrowserTab[];
    _prevMouseScrolls: any[];
    _scrollButtonDown: HTMLButtonElement;
    _scrollButtonUp: HTMLButtonElement;
    _scrollButtonDownLeft: HTMLButtonElement;
    _scrollButtonDownRight: HTMLButtonElement;
    _scrollButtonUpLeft: HTMLButtonElement;
    _scrollButtonUpRight: HTMLButtonElement;
    _updateScrollButtonsDisabledState: () => void;
    connectTabmix: () => void;
    ensureElementIsVisible: (tab: BrowserTab, instant?: boolean) => void;
    get lineScrollAmount(): number;
    offsetAmountToScroll: boolean;
    offsetRatio: number;
    scrollbox: any;
    scrollByPixels: (pixels: number, instant?: boolean) => void;
    scrollByIndex(index: number, instant?: boolean): void;
    readonly scrollClientRect: DOMRect;
    get scrollClientSize(): number;
    get scrollIncrement(): number;
    readonly scrollPosition: number;
    readonly singleRowHeight: number;
    smoothScroll: boolean;
    readonly startEndProps: ["top", "bottom"] | ["left", "right"];

    // Tabmix
    _enterVerticalMode: () => void;
    disconnectTabmix: () => void;
    resetFirstTabInRow: () => void;
    setFirstTabInRow: (scroll?: boolean) => void;
    updateOverflow: (isOverflow: boolean) => void;
  }

  interface TabmixArrowScrollbox extends ArrowScrollbox {
    _arrowScrollAnim: {
      scrollbox: TabmixArrowScrollbox;
      requestHandle: number;
      start(): void;
      stop(): void;
      sample(timeStamp: any): void;
    };

    _ensureElementIsVisibleAnimationFrame: number;
    _singleRowHeight: number;
    _tabMarginLeft: number;
    _tabMarginRight: number;
    _verticalAnimation: number;
    blockUnderflow: boolean;
    firstTabInRowMargin: number;
    firstVisible: {tab: BrowserTab; x: number; y: number};
    firstVisibleRow: number;
    isMultiRow: boolean;
    minOffset: number;
    parentNode: TabContainer;
    scrollboxPaddingBottom: number;
    scrollboxPaddingTop: number;
    tabmixInitialized: boolean;
    tabmixPrefObserver: {
      scrollbox: TabmixArrowScrollbox;
      observe: (aSubject: any, aTopic: string, aData: string) => void;
    };
  }

  interface TabContainer extends Element {
    _animateElement: ArrowScrollbox;
    _backgroundTabScrollPromise?: Promise<void>;
    _blockDblClick?: boolean;
    _dragOverDelay: number;
    _expandSpacerBy: (pixels: number) => void;
    _finishAnimateTabMove: () => void;
    _finishGroupSelectedTabs: (tab: BrowserTab) => void;
    _getDragTargetTab: (event: DragEvent, options?: {ignoreTabSides?: boolean}) => BrowserTab | null;
    _getDropIndex: (event: MouseEvent) => number;
    /** @deprecated removed by bug 1771831 in firefox 106 */
    _getDropEffectForTabDrag: (event: DragEvent) => string;
    _getVisibleTabs: () => BrowserTab[];
    _groupSelectedTabs: (tab: BrowserTab) => void;
    _handleTabSelect: (instant: boolean) => void;
    _invalidateCachedTabs: () => void;
    get _isCustomizing(): boolean;
    _lastTabClosedByMouse: boolean;
    _lastTabToScrollIntoView?: BrowserTab;
    _notifyBackgroundTab: (aTab: BrowserTab) => void;
    _pinnedTabsLayoutCache: any;
    _positionPinnedTabs: () => void;
    _selectNewTab: (aNewTab: BrowserTab, aFallbackDir?: number, aWrap?: boolean) => void;
    _scrollButtonWidth: number;
    _tabClipWidth: number;
    _tabDropIndicator?: HTMLElement;
    _unlockTabSizing: () => void;
    _updateCloseButtons(skipUpdateScrollStatus?: boolean, aUrl?: string): void;
    advanceSelectedTab: (dir: number, wrap: boolean) => void;
    readonly allTabs: BrowserTab[];
    arrowScrollbox: ArrowScrollbox;
    getDropEffectForTabDrag: (event: DragEvent) => string;
    mCloseButtons: number;
    mTabMaxWidth: number;
    mTabMinWidth: number;
    set selectedItem(val: BrowserTab);
    get selectedItem(): BrowserTab;
    set selectedIndex(val: number);
    get selectedIndex(): number;
    readonly verticalMode: boolean;

    on_dragover: (event: DragEvent) => void;
    on_dragleave: (event: DragEvent) => void;
    on_dragend: (event: DragEvent) => void;
    on_dragstart: (event: DragEvent) => void;
    on_drop: (event: DragEvent) => void;

    // TGM extension
    _onDelayTabHide?: number;
    _onDelayTabShow?: number;

    // Tabmix
    __showbuttonTab?: BrowserTab;

    /** @deprecated removed by bug 1808661 in firefox 110 */
    _afterHoveredTab: BrowserTab;
    /** @deprecated removed by bug 1808661 in firefox 110 */
    _afterSelectedTab: BrowserTab;
    /** @deprecated removed by bug 1808661 in firefox 110 */
    _beforeHoveredTab: BrowserTab;
    /** @deprecated removed by bug 1808661 in firefox 110 */
    _hoveredTab: BrowserTab;
  }

  interface TabBox {
    handleEvent(event: Event): void;
  }

  interface Tabpanels extends HTMLElement {
    // handleEvent(event: Event): void;
  }

  interface ClosingTabsEnum {
    ALL: 0;
    OTHER: 1;
    TO_START: 2;
    TO_END: 3;
    MULTI_SELECTED: 4;
    DUPLICATES: 6;
    ALL_DUPLICATES: 7;
    ALL_BY_TABMIX: 100;
    GROUP_BY_TABMIX: 101;
  }

  type EnumValues = ClosingTabsEnum[keyof ClosingTabsEnum];
  type ClosingTabsEnumValues = Exclude<EnumValues, string>;

  interface TabBrowser extends Browser {
    /// build in methods and properties
    _switcher: any;
    _blurTab: (tab: BrowserTab) => void;
    readonly _numPinnedTabs: number;
    /** @deprecated removed by bug 1808784 in firefox 111 */
    _invalidateCachedTabs: () => void;
    _lastRelatedTabMap: WeakMap<BrowserTab, BrowserTab>;
    _multiSelectedTabsSet: WeakSet<BrowserTab>;
    _removingTabs: Set<BrowserTab>;
    _selectedTab: BrowserTab;
    _setTabLabel: (tab: BrowserTab, label: string, options?: {beforeTabOpen?: boolean; isContentTitle?: boolean; isURL?: boolean}) => boolean;
    _tabAttrModified: (tab: BrowserTab, changed: string[]) => void;
    addAdjacentNewTab: (tab: BrowserTab) => void;
    addRangeToMultiSelectedTabs: (start: BrowserTab, end: BrowserTab) => void;
    addTab: (url: string, params?: {index?: number; isPending?: boolean} | Record<string, unknown>) => BrowserTab;
    addToMultiSelectedTabs: (tab: BrowserTab) => BrowserTab;
    addTrustedTab: (aURI: string, params?: Params) => BrowserTab;
    browsers: ChromeBrowser[];
    clearMultiSelectedTabs: () => void;
    closingTabsEnum: ClosingTabsEnum;
    duplicateTab: (aTab: BrowserTab, aRestoreTabImmediately: boolean, aOptions?: {inBackground?: boolean; index?: number}) => BrowserTab;
    getBrowserForTab: (tab: BrowserTab) => ChromeBrowser;
    getNotificationBox: (browser?: ChromeBrowser) => any;
    getTabForBrowser: (browser: ChromeBrowser) => BrowserTab;
    getTabsToTheStartFrom: (tab: BrowserTab) => BrowserTab[];
    getIcon: (tab: BrowserTab) => string;
    lastMultiSelectedTab: BrowserTab;
    moveTabTo: (tab: BrowserTab, index: number, keepRelatedTabs?: boolean) => void;
    pinTab: (tab: BrowserTab) => void;
    preloadedBrowser?: ChromeBrowser;
    reloadTab: (tab: BrowserTab) => void;
    /// modified by Tab Mix Plus
    removeTab: (
      tab: BrowserTab,
      params?: {
        animate?: boolean;
        triggeringEvent?: Event;
        skipPermitUnload?: boolean;
        closeWindowWithLastTab?: boolean;
        prewarmed?: boolean;
        skipSessionStore?: boolean;
      }
    ) => void;
    removeTabs: (
      tabs: BrowserTab[],
      params?: {
        animate?: boolean;
        suppressWarnAboutClosingWindow?: boolean;
        skipPermitUnload?: boolean;
        skipSessionStore?: boolean;
      }
    ) => void;
    removeAllTabsBut: (tab: BrowserTab, params?: {skipWarnAboutClosingTabs?: boolean; skipPinnedOrSelectedTabs?: boolean}) => void;
    removeFromMultiSelectedTabs: (tab: BrowserTab) => void;
    removeTabsProgressListener: (listener: any) => void;
    removeTabsToTheEndFrom: (tab: BrowserTab) => void;
    removeTabsToTheStartFrom: (tab: BrowserTab) => void;
    removeCurrentTab: (params: Params) => void;
    replaceTabWithWindow: (tab: BrowserTab) => Window | null;
    set selectedTabs(tabs: BrowserTab[]);
    get selectedTabs(): BrowserTab[];
    selectedTab: BrowserTab;
    setInitialTabTitle: (tab: BrowserTab, title: string, options: Record<string, unknown>) => void;
    setTabTitle: (tab: BrowserTab) => boolean;
    tabContainer: TabContainer;
    tabLocalization: Localization;
    get tabbox(): TabBox;
    get tabpanels(): Tabpanels;
    tabs: BrowserTab[];
    visibleTabs: BrowserTab[];
    unpinTab: (tab: BrowserTab) => void;
    set userTypedValue(val: string);
    get userTypedValue(): string | null;
    warnAboutClosingTabs: (tabsToClose: number, aCloseTabs: ClosingTabsEnumValues, aSource?: string) => boolean;

    /// Tab mix method
    _reloadLeftTabs: (tab: BrowserTab) => void;
    _reloadRightTabs: (tab: BrowserTab) => void;
    asyncGetWindowTitleForBrowser: (browser: ChromeBrowser) => Promise<string>;
    closeAllTabs: () => void;
    copyTabUrl: (tab: BrowserTab) => void;
    closeGroupTabs: (tab: BrowserTab) => void;
    duplicateTabToWindow: (tab: BrowserTab, moveTab?: boolean, tabData?: string) => void;
    duplicateTabsToWindow: (contextTab: BrowserTab) => void;
    ensureTabIsVisible: (tab: BrowserTab, smoothScroll?: boolean) => void;
    freezeTab: (tab: BrowserTab) => void;
    getTabForLastPanel: () => BrowserTab;
    isBlankTab: (tab: BrowserTab) => boolean;
    isBlankBrowser: (browser: ChromeBrowser, aboutBlank?: boolean) => boolean;
    isBlankNotBusyTab: (tab: BrowserTab) => boolean;
    lockTab: (tab: BrowserTab) => void;
    openLinkWithHistory: () => void;
    previousTab: (tab: BrowserTab) => void;
    previousTabIndex: (tab: BrowserTab, tabs?: BrowserTab[]) => number;
    protectTab: (tab: BrowserTab) => void;
    reloadLeftTabs: (tab: BrowserTab) => void;
    reloadRightTabs: (tab: BrowserTab) => void;
    reloadAllTabsBut: (tab: BrowserTab) => void;
    selectIndexAfterRemove: (tab: BrowserTab) => number;
    SelectToMerge: (tab: BrowserTab) => void;
    SSS_duplicateTab: (tab: BrowserTab, href: string, tabData?: {state: Params}) => BrowserTab;
    stopMouseHoverSelect: (tab: BrowserTab) => void;
    TMP_selectNewForegroundTab: (tab: BrowserTab, loadInBackground?: boolean | string, url?: string, addOwner?: boolean) => void;
    updateTitlebar: () => void;

    /** @deprecated removed since Firefox 110 */
    loadOneTab: (url: string, params?: any) => void;
    /** @deprecated use TMP_ClosedTabs.undoCloseTab instead */
    undoRemoveTab: () => BrowserTab;
    /** @deprecated Tabmix don't use this function anymore but treeStyleTab extension look for it */
    restoreTab: () => void;
    /** @deprecated use gBrowser.removeTab instead */
    closeTab: (tab: BrowserTab) => void;
    /** @deprecated use gBrowser.moveTabTo instead */
    TMmoveTabTo: (tab: BrowserTab, index: number, keepRelatedTabs?: boolean) => void;
    /** @deprecated use Tabmix.renameTab.editTitle(aTab) instead */
    renameTab: (tab: BrowserTab) => void;
  }

  interface BrowserWindow extends MockedExports.BrowserWindow {
    gBrowser: TabBrowser;
  }

  interface TabsPanel extends TabsListBase {
    constructor(opts: any);
    view: any;
    panelMultiView: any;
    _populate(): void;
    _createRow(tab: BrowserTab): XULElement;
    _setRowAttributes(row: any, tab: BrowserTab): void;
    _setImageAttributes(row: any, tab: BrowserTab): void;
    _onDragStart(event: any): void;
    _getTargetRowFromEvent(event: any): any;
    _isMovingTabs(event: any): boolean;
    _onDragOver(event: any): void;
    _getRowIndex(row: any): number;
    _onDrop(event: any): void;
    _onDragLeave(event: any): void;
    _onDragEnd(event: any): void;
    _updateDropTarget(event: any): boolean;
    _setDropTarget(row: any, direction: any): void;
    _clearDropTarget(): void;
    _onClick(event: any): void;

    /// Tab Mix Plus
    _removeTabFromList(event: RowClickEvent): void;
    _original_createRow(tab: BrowserTab): TabsPanelRow;
  }

  interface RowClickEvent extends MouseEvent {
    target: EventTarget & TabsPanelRow;
  }

  interface TabsPanelRow extends XULElement {
    tab?: BrowserTab;
  }

  interface TabsListBase {
    constructor({className, filterFn, insertBefore, containerNode, dropIndicator}: {className: string; filterFn: any; insertBefore: any; containerNode: any; dropIndicator?: null | undefined});
    className: string;
    filterFn: any;
    insertBefore: any;
    containerNode: any;
    dropIndicator: any;
    dropTargetRow: any;
    dropTargetDirection: number | undefined;
    doc: any;
    gBrowser: TabBrowser;
    tabToElement: Map<any, any>;
    listenersRegistered: boolean;
    get rows(): IterableIterator<any>;
    handleEvent(event: any): void;
    _selectTab(tab: BrowserTab): void;
    _populate(): void;
    _addElement(elementOrFragment: any): void;
    _cleanup(): void;
    _setupListeners(): void;
    _cleanupListeners(): void;
    _tabAttrModified(tab: BrowserTab): void;
    _moveTab(tab: BrowserTab): void;
    _addTab(newtab: BrowserTab): void;
    _tabClose(tab: BrowserTab): void;
    _removeItem(item: any, tab: BrowserTab): void;
  }

  interface gTabsPanel {
    init(): void;
    allTabsPanel: TabsPanel;
    kElements: {
      allTabsView: string;
    };
  }

  interface TabContextMenu {
    contextTab?: BrowserTab;
  }

  interface gContextMenu {
    _openLinkInParameters: (params: Params) => Params;
    isTextSelected: boolean | undefined;
    linkURL?: string;
    onImage: boolean;
    onLink: boolean;
    openLinkInCurrent: () => void;
    onTextInput: boolean;
    principal: nsIPrincipal;
    target: EventTarget;
    tabmixLinks?: Map<string, string>;
    tabmixLinkURL?: string | null;
  }

  interface PlacesCommandHook {
    bookmarkLink: (url: string, title: string) => Promise<void>;
    bookmarkPage: () => Promise<void>;
    bookmarkTabs: () => Promise<void>;
  }

  interface BookmarksService extends nsINavBookmarksService {
    /** @deprecated removed since Firefox 112 */
    addObserver: (observer: unknown) => void;
    // async fetch(guidOrInfo, onResult = null, options = {}) {
    fetch: (guidOrInfo: string | {uri?: string; title?: string; guid?: string}, onResult?: (result: any | any[]) => void, options?: {concurrent?: boolean; includePath?: boolean; includeItemIds?: boolean}) => Promise<any | any[]>;
    /** @deprecated removed since Firefox 112 */
    removeObserver: (observer: unknown) => void;
  }

  interface PlacesUtils {
    bookmarks: BookmarksService;
    favicons: nsIFaviconService;
    observers: typeof PlacesObservers;
    virtualHistoryGuid: string;
  }

  interface PlacesUIUtils {}

  /** Services */

  // NOTE:
  // we use here the interface from gecko/lib.gecko.services.d.ts
  // and ignore the declared Services from gecko.d.ts

  interface _nsIEventListenerService extends nsIEventListenerService {
    /** @deprecated removed since Firefox 125 */
    addSystemEventListener: (element: Window | Document | Element, type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean) => void;
    /** @deprecated removed since Firefox 125 */
    removeSystemEventListener: any;
  }

  interface _nsIObserverService extends nsIObserverService {
    notifyObservers(
      aSubject: nsISupports & {
        wrappedJSObject: Promise<void>;
      },
      aTopic: string,
      someData?: string
    ): void;
  }

  type InOutParam<T> = {value: T};
  interface _nsIPromptService extends nsIPromptService {
    // for waterfox G6.0.17+
    confirmEx2(aParent: mozIDOMWindowProxy, aDialogTitle: string, aText: string, aButtonFlags: u32, aButton0Title: string, aButton1Title: string, aButton2Title: string, aCheckMsg1: string, aCheckState1: InOutParam<boolean>, aCheckMsg2: string, aCheckState2: InOutParam<boolean>): i32;
  }

  interface nsISimpleEnumeratorWithWindow extends nsISimpleEnumerator {
    getNext(): nsISupports & BrowserWindow;
  }

  interface GetWindowByTypeMap {
    "mozilla:tabmixopt": TabmixOptionsWindow;
    "mozilla:tabmixopt-appearance": Window;
    "mozilla:tabmixopt-filetype": Window;
    "mozilla:tabmixprompt": Window;
    "navigator:browser": BrowserWindow;
  }

  interface _nsIWindowMediator extends nsIWindowMediator {
    getEnumerator(aWindowType: string): nsISimpleEnumeratorWithWindow;
    getMostRecentWindow: <K extends keyof GetWindowByTypeMap>(selectors: K | any) => K extends keyof GetWindowByTypeMap ? GetWindowByTypeMap[K] : BrowserWindow;
  }

  interface Services extends JSServices {
    els: _nsIEventListenerService;
    obs: _nsIObserverService;
    prompt: _nsIPromptService;
    wm: _nsIWindowMediator;
  }
}

interface IgIncompatiblePane {
  checkForIncompatible: (aShowList: boolean) => void;
}

interface TabmixOptionsWindow extends Window {
  showPane: (paneID: string) => void;
  gAppearancePane?: {
    toolbarButtons: (window: Window) => void;
  };
  gIncompatiblePane: {
    checkForIncompatible: (aShowList: boolean) => void;
  };
}

interface GetByMap {
  tabmix_bookmarkUrl: MockedGeckoTypes.BrowserTab;
  "tabmix-scrollbox": MockedGeckoTypes.ArrowScrollbox;
}

declare module "gBrowser" {
  export = gBrowser;
}

declare module "PlacesCommandHook" {
  export = PlacesCommandHook;
}

declare module "PlacesUtils" {
  export = PlacesUtils;
}

type OpenPopup = (anchorElement?: Element | null, options?: StringOrOpenPopupOptions, x?: number, y?: number, isContextMenu?: boolean, attributesOverride?: boolean, triggerEvent?: Event | null) => void;

interface HistoryMenu {
  // _getClosedTabCount: () => number;
  populateUndoSubmenu: () => void;
  populateUndoWindowSubmenu: () => void;
}

interface E10SUtils {
  SERIALIZED_SYSTEMPRINCIPAL: string;
  DEFAULT_REMOTE_TYPE: string;
  getRemoteTypeForURI: (aUri: string, aMultiProcess: boolean, aRemoteSubframes: boolean, aPreferredRemoteType?: string, aCurrentUri?: string, aOriginAttributes?: Params) => string;
  predictOriginAttributes: ({window, browser, userContextId, geckoViewSessionContextId, privateBrowsingId}: {window?: Window; browser?: MockedGeckoTypes.ChromeBrowser; userContextId?: string; geckoViewSessionContextId?: string; privateBrowsingId?: string}) => {privateBrowsingId: string; userContextId: string; geckoViewSessionContextId: string};
  serializeCSP: (csp: nsIContentSecurityPolicy) => string;
  serializeReferrerInfo: (referrerInfo: nsIReferrerInfo) => string;
}

interface FullScreen {
  _mouseTargetRect: Partial<DOMRect>;
  _isChromeCollapsed: boolean;
  showNavToolbox: (trackMouse?: boolean) => void;
}

interface gBrowserInit {
  delayedStartupFinished: boolean | ((subject: Window, topic: string) => void);
  uriToLoadPromise: Promise<string | string[] | null>;
}

interface gNavigatorBundle {
  getString: (id: string) => string;
  getFormattedString: (id: string, array: number[]) => string;
}

type WhereToOpen = "current" | "tabshifted" | "tab" | "save" | "window";

interface UrlbarView {
  panel: HTMLElement;
  /** @deprecated removed since Firefox 108 */
  getClosestSelectableElement: (element: Element, options?: {byMouse: boolean}) => Element;
}

interface gURLBar extends HTMLElement {
  _whereToOpen: (event?: Event & {__tabmix__whereToOpen?: WhereToOpen}) => WhereToOpen;
  focused: boolean;
  handleCommand: (event?: Event) => void;
  select: () => void;
  setURI: (uri?: string, dueToTabSwitch?: boolean, dueToSessionRestore?: boolean, dontShowSearchTerms?: boolean, isSameDocument?: boolean) => void;
  view: UrlbarView;
}

type MenuitemParams = {
  value?: string;
  tab?: MockedGeckoTypes.BrowserTab;
  style?: CSSStyleDeclaration;
};

interface newWindowButtonObserver {
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}

interface nsBrowserAccess {}

interface PanelUI {
  _ensureShortcutsShown: (view: HTMLElement) => void;
  showSubView(view: string, anchor: HTMLElement, event?: Event): void;
}

interface PrivateBrowsingUtils {
  isBrowserPrivate: (browser: MockedGeckoTypes.ChromeBrowser) => boolean;
  isContentWindowPrivate: (window: Window) => boolean;
}

interface StatusPanel {
  isVisible: boolean;
  update: () => void;
}

interface TabBarVisibility {
  update: () => void;
}

interface XULBrowserWindow {
  setOverLink: (url: string, options?: {hideStatusPanelImmediately?: boolean}) => void;
}

// functions on globals firefox scope
declare function closeWindow(aClose: boolean, aPromptFunction?: (source: string) => boolean, aSource?: string): boolean;
declare function FillHistoryMenu(event: Event): void;
declare function handleDroppedLink(event: DragEvent, url: string, name: string, triggeringPrincipal: nsIPrincipal): void;
declare function handleDroppedLink(event: DragEvent, links: nsIDroppedLinkItem[], triggeringPrincipal: nsIPrincipal): void;
declare function isBlankPageURL(url: string): boolean;
declare function middleMousePaste(event: MouseEvent): void;
declare function openLinkIn(url: string, where: string, params: Params): void;
declare function pref(name: string, defaultValue: number | string | boolean): void;
declare function OpenBrowserWindow(params?: {private?: boolean; features?: string; args?: nsIArray | nsISupportsString; remote?: boolean; fission?: boolean}): Window | null;
declare function urlSecurityCheck(aURL: string, aPrincipal: nsIPrincipal, aFlags?: nsIScriptSecurityManager): void;
declare function undoCloseWindow(index: number): void;

declare var E10SUtils: E10SUtils;
declare var FullScreen: FullScreen;
declare var gBrowser: MockedGeckoTypes.TabBrowser;
declare var gBrowserInit: gBrowserInit;
declare var gContextMenu: MockedGeckoTypes.gContextMenu;
declare var gFissionBrowser: boolean;
declare var gNavigatorBundle: gNavigatorBundle;
declare var gTabsPanel: MockedGeckoTypes.gTabsPanel;
declare var gURLBar: gURLBar;
declare var newWindowButtonObserver: newWindowButtonObserver;
declare var TabContextMenu: MockedGeckoTypes.TabContextMenu;
declare var PanelUI: PanelUI;
declare var PlacesCommandHook: MockedGeckoTypes.PlacesCommandHook;
declare var PlacesUtils: MockedGeckoTypes.PlacesUtils;
declare var PlacesUIUtils: MockedGeckoTypes.PlacesUIUtils;
declare var PrivateBrowsingUtils: PrivateBrowsingUtils;
declare var RTL_UI: boolean;
declare var StatusPanel: StatusPanel;
declare var TabBarVisibility: TabBarVisibility;
declare var XULBrowserWindow: XULBrowserWindow;

// AddonManager
declare var ADDON_ENABLE: number;
declare var ADDON_DOWNGRADE: number;
declare var ADDON_DISABLE: number;
declare var ADDON_INSTALL: number;
declare var ADDON_UNINSTALL: number;
declare var ADDON_UPGRADE: number;

declare var HistoryMenu: {
  prototype: HistoryMenu;
  new (): HistoryMenu;
  isInstance: IsInstance<HistoryMenu>;
};

declare var nsBrowserAccess: {
  prototype: nsBrowserAccess;
  new (): nsBrowserAccess;
  isInstance: IsInstance<nsBrowserAccess>;
};

/** Window scope globals */
declare var BROWSER_NEW_TAB_URL: any;
declare var browserDragAndDrop: any;
declare var BrowserHandler: any;
declare var BrowserWindowTracker: any;
declare var BrowserUtils: any;
declare var closeMenus: any;
declare var Components: any;
declare var ctrlTab: any;
declare var CustomizableUI: any;
/** @deprecated removed from firefox on version 87 */
declare var getHtmlBrowser: any;
declare var gMultiProcessBrowser: any;
declare var gNavToolbox: any;
declare var gReduceMotion: any;
/** @deprecated removed from firefox on version 109 */
declare var gTabBrowserBundle: any;
declare var HomePage: any;
declare var LinkTargetDisplay: any;
declare var nsContextMenu: any;
declare var OpenInTabsUtils: any;
declare var openTrustedLinkIn: any;
declare var OS: any;
declare var PageThumbs: any;
declare var PanelMultiView: any;
declare var readFromClipboard: any;
declare var RecentlyClosedTabsAndWindowsMenuUtils: any;
declare var SessionStartup: any;
declare var SessionStore: any;
declare var TAB_DROP_TYPE: any;
declare var TabsInTitlebar: any;
declare var UrlbarUtils: any;

/** content scope globals */
declare var addMessageListener: any;
declare var ContextMenu: any;
declare var sendAsyncMessage: any;
declare var sendSyncMessage: any;
declare var WebNavigationFrames: any;

/** globals installed by extensions */
declare var colorfulTabs: any;
declare var privateTab: any;
declare var TabView: any;

// merge with existing interface from /gecko/gecko.d.ts
declare namespace MockedExports {
  interface nsISupportsString {
    number: string;
  }

  interface Ci {
    nsIAlertsService: nsIAlertsService;
    nsIAppStartup: nsIAppStartup;
    nsIBrowserHandler: nsIBrowserHandler;
    nsIChannel: nsIChannel;
    nsIClipboardHelper: nsIClipboardHelper;
    nsIDialogParamBlock: nsIDialogParamBlock;
    nsIDOMWindowUtils: nsIDOMWindowUtils;
    nsIFile: nsJSIID<nsIFile>;
    nsIFilePicker: nsIFilePicker;
    nsIFontEnumerator: nsIFontEnumerator;
    nsIInterfaceRequestor: nsIInterfaceRequestor;
    nsINavBookmarksService: nsINavBookmarksService;
    nsIPrefLocalizedString: nsJSIID<nsIPrefLocalizedString>;
    nsIReferrerInfo: nsIReferrerInfo;
    nsISHEntry: nsJSIID<nsISHEntry>;
    nsISupportsPRBool: nsISupportsPRBool;
    nsISupportsString: nsISupportsString;
    nsIStyleSheetService: nsIStyleSheetService;
    nsITimer: nsITimer;
    nsIWebNavigation: nsJSIID<nsIWebNavigation>;
    nsIWebProgressListener: nsIWebProgressListener;
  }

  interface Cu {
    getGlobalForObject(obj: any): any;
  }
}

interface nsIDOMWindowUtils {
  /** @deprecated removed since Firefox 109 */
  fullZoom: number;
  /** @deprecated removed since Firefox 109 */
  screenPixelsPerCSSPixel: number;
}

interface XULElement {
  container?: any;
}

interface XULCommandDispatcher {
  focusedWindow: mozIDOMWindowProxy;
}

interface handleTabbarVisibility {
  contextMenu: HTMLElement;
}
