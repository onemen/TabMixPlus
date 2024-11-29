/// <reference types="./gecko/tools/lib.gecko.services.d.ts" />
/// <reference types="./custom.gecko.dom.d.ts" />

// use these types instead of types from gecko.d.ts
type nsIFilePickerXpcom = nsIFilePicker;
type nsIPrefBranchXpcom = ReturnType<nsIPrefService["getBranch"]>;

interface GetClosestMap {
  "tab.tabbrowser-tab": MockedGeckoTypes.BrowserTab;
}

interface Element {
  closest<K extends keyof GetClosestMap | string>(selector: K | string): K extends keyof GetClosestMap ? GetClosestMap[K] : HTMLElement | null;
  __tagName?: string;
  value: string | number | boolean;
  readonly style: CSSStyleDeclaration;
  getElementsByClassName<K extends keyof GetByMap>(name: K): NonEmptyCollection_G<GetByMap[K]>;
  // it is ok to allow setAttribute to convert the value to string for us
  setAttribute(name: string, value: string | boolean | number): void;
}

interface NodeList {
  readonly length: number;
  item(index: number): HTMLElement | null;
  forEach(callbackfn: (value: HTMLElement | null, key: number, parent: NodeList) => void, thisArg?: unknown): void;
  [index: number]: HTMLElement;
}

type CustomElement<T, Parent = HTMLElement> = Omit<T, "parentNode" | "value"> & {
  parentNode: Parent;
  value: number;
};

type CustomNonNullable<T> = T extends null | undefined ? never : T;
type GenericEvent<T, E extends Event, Parent = T extends {parentNode: infer P} ? (CustomNonNullable<P> extends HTMLElement ? CustomNonNullable<P> : HTMLElement) : HTMLElement> = Omit<E, "target" | "originalTarget"> & {
  target: CustomElement<T, Parent>;
  originalTarget: CustomElement<T, Parent>;
};

interface EventTypeMap<T extends HTMLElement> {
  click: GenericEvent<T, MouseEvent>;
  contextmenu: GenericEvent<T, MouseEvent>;
  dblclick: GenericEvent<T, MouseEvent>;
  overflow: GenericEvent<T, UIEvent>;
  underflow: GenericEvent<T, UIEvent>;
}

interface HTMLElement {
  __updatingViewAfterDelete?: boolean;
  addEventListener<K extends keyof EventTypeMap<T>, T extends HTMLElement>(type: K, listener: (this: T, ev: EventTypeMap<T>[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
  firstChild: HTMLElement | null;
  previousSibling: HTMLElement | null;
  disabled?: boolean;
}

interface HTMLButtonElement {
  addEventListener<K extends keyof EventTypeMap<T>, T extends HTMLButtonElement>(type: K, listener: (this: T, ev: EventTypeMap<T>[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
}

interface CSSStyleDeclaration {
  display: string;
  flexWrap: string;
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
  visibility: string;
  [index: string]: string;
}

type DragEventParams = {sourceNode: HTMLLinkElement | MockedGeckoTypes.BrowserTab | null; dragType: number; tab: HTMLLinkElement | MockedGeckoTypes.BrowserTab | null; oldIndex: number; newIndex: number; mouseIndex: number; addWidth?: boolean};

declare namespace MockedGeckoTypes {
  interface BrowsingContext extends MockedExports.BrowsingContext {
    sessionHistory: nsISHistory | null;
  }

  interface ChromeBrowser extends MockedExports.ChromeBrowser {
    _contentWindow: Window;
    browsingContext: BrowsingContext;
    contentTitle?: string;
    readonly canGoForward: boolean;
    readonly canGoBack: boolean;
    readonly characterSet: string;
    readonly contentDocument: Document | null;
    readonly currentURI: URI;
    droppedLinkHandler: typeof handleDroppedLink;
    getAttribute(name: string): string | null;
    focus(): void;
    // we overrife these see addon.d.ts
    // fixupAndLoadURIString: (uri: string, loadURIOptions?: LoadURIOptions) => void;
    // loadURI: (uri: string, loadURIOptions?: LoadURIOptions) => void;
    messageManager: MockedExports.MessageManager;
    // ignore null here
    readonly ownerGlobal: WindowProxy;
    reload: () => void;
    stop: () => void;
    set userTypedValue(val: string);
    get userTypedValue(): string | null;

    // modified by Tab Mix Plus
    __tabmix__whereToOpen?: WhereToOpen;
    __tabmix_loadURI: boolean;
    __tabmix_fixupAndLoadURIString: boolean;
    tabmix_allowLoad?: boolean;
  }

  interface Browser extends MockedExports.Browser {
    readonly currentURI: URI;
    selectedBrowser: ChromeBrowser;
  }

  type Tabs = NonEmptyArray<BrowserTab>;

  interface BrowserTab extends MockedExports.BrowserTab, Omit<Element, "ownerGlobal"> {
    readonly _isProtected: boolean;
    _labelIsInitialTitle?: boolean;
    _tPos: number;
    _dragData: {
      offsetX: number;
      offsetY: number;
      scrollPos: number;
      screenX: number;
      screenY: number;
      movingTabs: BrowserTab[];
      fromTabList: boolean;
      tabGroupCreationColor: string;
    };
    closing: boolean;
    readonly container: TabContainer;
    connectedCallback: () => void;
    initialize: () => void;
    readonly isEmpty: boolean;
    label: string;
    linkedBrowser: ChromeBrowser;
    set linkedPanel(val: string);
    get linkedPanel(): string;
    // mCorrespondingMenuitem: - see addon.d.ts
    readonly multiselected: boolean;
    owner: BrowserTab | null;
    // MockedExports.BrowserTab use null here - ignore it
    readonly ownerGlobal: WindowProxy;
    readonly pinned: boolean;
    selected: boolean;

    // modified by Tab Mix Plus
    __duplicateFromWindow?: boolean;
    __newLastTab?: string;
    _initialized: boolean;
    _restoreState: number;
    _tabmix_downloadingTimeout: number | null;
    _tabmixState?: {noBookmart?: boolean};
    _TMP_removeing: boolean;
    _tPosInGroup?: number;
    autoReloadEnabled?: boolean;
    autoReloadTimerID: number | null;
    autoReloadURI?: string;
    autoReloadTime?: number;
    readonly baseY: number;
    clearTimeouts: () => void;
    doMouseHoverSelect: (tab: BrowserTab) => void;
    loadOnStartup: boolean;
    mButtonId?: number | null;
    mFocusId: number | null;
    mIsHover: boolean;
    mSelect: number | null;
    readonly mouseDownSelect: boolean;
    readonly mouseHoverSelect: boolean;
    readonly mouseHoverSelectDelay: number;
    mOverCloseButton?: boolean;
    onMouseCommand: (aEvent: MouseEvent, aSelectNewTab: boolean) => void;
    removeShowButton: (tab: BrowserTab) => void;
    setHoverState: (aEvent: MouseEvent, aHover: boolean) => void;
    setShowButton: (tab: BrowserTab) => void;
    readonly tabXDelay: number;
    tabmix_inited: boolean;
    tabmix_allowLoad: boolean;
    tabmixKey: object;
  }

  interface ArrowScrollbox extends Element {
    _boundsWithoutFlushing: (element: HTMLElement) => DOMRect;
    _canScrollToElement: (element: BrowserTab) => boolean;
    _distanceToRow: (amountToScroll: number) => number;
    _isRTLScrollbox: boolean;
    _getScrollableElements: () => BrowserTab[];
    _prevMouseScrolls: boolean[];
    _scrollButtonDown: HTMLButtonElement;
    _scrollButtonUp: HTMLButtonElement;
    ensureElementIsVisible: (tab: BrowserTab, instant?: boolean) => void;
    readonly isRTLScrollbox: boolean;
    get lineScrollAmount(): number;
    offsetRatio: number;
    readonly overflowing: boolean;
    scrollbox: HTMLElement & EventTarget;
    scrollByPixels: (pixels: number, instant?: boolean) => void;
    scrollByIndex(index: number, instant?: boolean): void;
    readonly scrollClientRect: DOMRect;
    get scrollClientSize(): number;
    get scrollIncrement(): number;
    readonly scrollPosition: number;
    readonly singleRowHeight: number;
    smoothScroll: boolean;
    readonly startEndProps: ["top", "bottom"] | ["left", "right"];
  }

  type DNDCanvas = Element & {height: number};

  interface TabContainer extends Element {
    _animateElement: ArrowScrollbox;
    _animateExpandedPinnedTabMove: (event: MouseEvent) => void;
    _animateTabMove: (event: MouseEvent) => void;
    _backgroundTabScrollPromise?: Promise<void>;
    _blockDblClick?: boolean;
    _dndCanvas: DNDCanvas;
    _dndPanel: DNDCanvas;
    _dragOverDelay: number;
    _expandSpacerBy: (pixels: number) => void;
    _finishAnimateTabMove: () => void;
    _finishGroupSelectedTabs: (tab: BrowserTab) => void;
    _getDragTargetTab(event: DragEvent, options?: {ignoreTabSides?: boolean}): BrowserTab | null;
    // we are adding arguments to _getDropIndex see minit.js for details
    _getDropIndex(event: DragEvent, ...rest: unknown[]): DragEventParams | number;
    /** @deprecated replaced with #moveTogetherSelectedTabs in firefox 133 */
    _groupSelectedTabs: (tab: BrowserTab) => void;
    _handleTabSelect: (instant: boolean) => void;
    _invalidateCachedTabs: () => void;
    get _isCustomizing(): boolean;
    _lastTabClosedByMouse: boolean;
    _lastTabToScrollIntoView?: BrowserTab;
    _notifyBackgroundTab: (aTab: BrowserTab) => void;
    _pinnedTabsLayoutCache: Record<string, unknown> | null;
    _positionPinnedTabs: () => void;
    _selectNewTab: (aNewTab: BrowserTab, aFallbackDir?: number, aWrap?: boolean) => void;
    _scrollButtonWidth: number;
    _tabClipWidth: number;
    _tabDropIndicator: HTMLElement;
    _unlockTabSizing: () => void;
    _updateCloseButtons(skipUpdateScrollStatus?: boolean, aUrl?: string): void;
    advanceSelectedTab: (dir: number, wrap: boolean) => void;
    readonly allTabs: NonEmptyArray<BrowserTab>;
    // see declaration in addon.d.ts
    // arrowScrollbox: ArrowScrollbox;
    getDropEffectForTabDrag: (event: DragEvent) => string;
    mCloseButtons: number;
    mTabMaxWidth: number;
    mTabMinWidth: number;
    set selectedItem(val: BrowserTab);
    get selectedItem(): BrowserTab;
    set selectedIndex(val: number);
    get selectedIndex(): number;
    readonly verticalMode: boolean;
    readonly visibleTabs: Tabs;

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
    tabmix_updateCloseButtons: TabContainer["_updateCloseButtons"];

    // replacment for private methods
    _clearDragOverCreateGroupTimer: () => void;
    _dragOverCreateGroupTimer: number;
    _isAnimatingMoveTogetherSelectedTabs: () => boolean;
    _moveTogetherSelectedTabs: (tab: BrowserTab) => void;
    // using insteadof private method #setDragOverGroupColor since Firefox 133
    _setDragOverGroupColor: (groupColorCode: string) => void;
    _triggerDragOverCreateGroup: (dragData: BrowserTab["_dragData"], groupDropIndex: number) => void;

    /** @deprecated removed by bug 1923635 in firefox 133 */
    _getVisibleTabs: () => Tabs;
  }

  interface TabBox {
    handleEvent(event: Event): void;
  }

  interface Tabpanels extends HTMLElement {
    lastChild: HTMLElement;
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

  type Notification = {priority: number; label: string | {"l10n-id": string; "l10n-args": object} | DocumentFragment; eventCallback?: (event: "removed" | "dismissed" | "disconnected") => void; notificationIs?: string; telemetry?: string; telemetryFilter?: string[]};
  type NotificationButton = {label: string; accessKey: string; callback?: (notification: Element, button: object, buttonElement: HTMLButtonElement, event: Event) => boolean | void; link?: string; supportPage?: boolean; popup?: string; telemetry?: string; is?: string};
  interface NotificationBox {
    PRIORITY_CRITICAL_HIGH: number;
    appendNotification(aType: string, aNotification: Notification, aButtons: NotificationButton[]): HTMLElement;
  }

  interface TabBrowser extends Browser {
    // build in methods and properties
    _switcher: {
      visibleTab: BrowserTab;
    };
    _blurTab: (tab: BrowserTab) => void;
    _endRemoveTab: (tab: BrowserTab) => void;
    /** @deprecated replaced with pinnedTabCount in Firefox version 133 */
    readonly _numPinnedTabs: number;
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
    readonly canGoForward: boolean;
    readonly canGoBack: boolean;
    clearMultiSelectedTabs: () => void;
    closingTabsEnum: ClosingTabsEnum;
    duplicateTab: (aTab: BrowserTab, aRestoreTabImmediately: boolean, aOptions?: {inBackground?: boolean; index?: number}) => BrowserTab;
    getBrowserAtIndex: (aIndex: number) => ChromeBrowser;
    getBrowserForTab: (tab: BrowserTab) => ChromeBrowser;
    getNotificationBox: (browser?: ChromeBrowser) => NotificationBox;
    getTabForBrowser: (browser: ChromeBrowser) => BrowserTab;
    getTabsToTheStartFrom: (tab: BrowserTab) => BrowserTab[];
    getIcon: (tab: BrowserTab) => string;
    hideTab: (aTab: BrowserTab, aSource?: string) => void;
    lastMultiSelectedTab: BrowserTab;
    moveTabTo: (tab: BrowserTab, index: number, keepRelatedTabs?: boolean) => void;
    pinTab: (tab: BrowserTab) => void;
    readonly pinnedTabCount: number;
    preloadedBrowser?: ChromeBrowser;
    reloadTab: (tab: BrowserTab) => void;
    // modified by Tab Mix Plus
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
    // see addon.d.ts
    // removeTabsProgressListener: (listener: typeof TabmixProgressListener.listener) => void;
    removeTabsToTheEndFrom: (tab: BrowserTab) => void;
    removeTabsToTheStartFrom: (tab: BrowserTab) => void;
    removeCurrentTab: (params: Params) => void;
    replaceTabWithWindow: (tab: BrowserTab) => Window | null;
    set selectedTabs(tabs: Tabs);
    get selectedTabs(): Tabs;
    selectedTab: BrowserTab;
    setInitialTabTitle: (tab: BrowserTab, title: string, options: Record<string, unknown>) => void;
    setTabTitle: (tab: BrowserTab) => boolean;
    tabContainer: TabContainer;
    tabLocalization: Localization;
    get tabbox(): TabBox;
    get tabpanels(): Tabpanels;
    tabs: Tabs;
    visibleTabs: Tabs;
    unpinTab: (tab: BrowserTab) => void;
    set userTypedValue(val: string);
    get userTypedValue(): string | null;
    warnAboutClosingTabs: (tabsToClose: number, aCloseTabs: ClosingTabsEnumValues, aSource?: string) => boolean;

    // Tab mix method
    _reloadLeftTabs: (tab: BrowserTab) => void;
    _reloadRightTabs: (tab: BrowserTab) => void;
    asyncGetWindowTitleForBrowser: (browser: ChromeBrowser) => Promise<string>;
    closeAllTabs: () => void;
    copyTabUrl: (tab: BrowserTab) => void;
    closeGroupTabs: (tab: BrowserTab) => void;
    duplicateTabToWindow: (tab: BrowserTab, moveTab?: boolean, tabData?: string) => void;
    duplicateTabsToWindow: (contextTab: BrowserTab) => void;
    _delayedStartupFinished: (subject: Window, topic: string) => void;
    ensureTabIsVisible: (tab: BrowserTab, smoothScroll?: boolean) => void;
    freezeTab: (tab: BrowserTab) => void;
    getTabForLastPanel: () => BrowserTab;
    getBrowserForTabPanel: (notificationbox: HTMLElement) => ChromeBrowser;
    isBlankTab: (tab: BrowserTab) => boolean;
    isBlankBrowser: (browser: ChromeBrowser, aboutBlank?: boolean) => boolean;
    isBlankWindow: () => boolean;
    isBlankNotBusyTab: (tab: BrowserTab, aboutBlank?: boolean) => boolean;
    lockTab: (tab: BrowserTab) => void;
    openLinkWithHistory: () => void;
    previousTab: (this: MockedGeckoTypes.TabBrowser, tab: BrowserTab) => void;
    previousTabIndex: (tab: BrowserTab, tabs?: BrowserTab[]) => number;
    protectTab: (tab: BrowserTab) => void;
    reloadLeftTabs: (this: MockedGeckoTypes.TabBrowser, tab: BrowserTab) => void;
    reloadRightTabs: (this: MockedGeckoTypes.TabBrowser, tab: BrowserTab) => void;
    reloadAllTabsBut: (this: MockedGeckoTypes.TabBrowser, tab: BrowserTab) => void;
    selectIndexAfterRemove: (tab: BrowserTab) => number;
    SelectToMerge: (tab: BrowserTab) => void;
    SSS_duplicateTab: (tab: BrowserTab, href: string, tabData?: {state: Params}) => BrowserTab | null;
    stopMouseHoverSelect: (tab: BrowserTab) => void;
    TMP_selectNewForegroundTab: (tab: BrowserTab, loadInBackground?: boolean | string, url?: string, addOwner?: boolean) => void;
    updateTitlebar: () => void;

    /** @deprecated use TMP_ClosedTabs.undoCloseTab instead */
    undoRemoveTab: () => BrowserTab | null;
    /** @deprecated Tabmix don't use this function unknownmore but treeStyleTab extension look for it */
    restoreTab: () => void;
    /** @deprecated use gBrowser.removeTab instead */
    closeTab: (tab: BrowserTab) => void;
    /** @deprecated use gBrowser.moveTabTo instead */
    TMmoveTabTo: (tab: BrowserTab, index: number, keepRelatedTabs?: boolean) => void;
    /** @deprecated use Tabmix.renameTab.editTitle(aTab) instead */
    renameTab: (tab: BrowserTab) => void;
  }

  interface BrowserWindow extends MockedExports.BrowserWindow {
    // override lib.gecko.dom.d.ts Document | null
    readonly document: Document;
    gBrowser: TabBrowser;
  }

  interface TabsPanel extends TabsListBase {
    constructor(opts: Record<string, unknown>): void;
    view: unknown;
    panelMultiView: HTMLElement;
    _populate(): void;
    _createRow(tab: BrowserTab): TabsPanelRow;
    _setRowAttributes(row: TabsPanelRow, tab: BrowserTab): void;
    _setImageAttributes(row: TabsPanelRow, tab: BrowserTab): void;
    _onDragStart(event: TabsPanelDragEvent): void;
    _getTargetRowFromEvent(event: TabsPanelDragEvent): TabsPanelRow;
    _isMovingTabs(event: TabsPanelDragEvent): boolean;
    _onDragOver(event: TabsPanelDragEvent): void;
    _getRowIndex(row: TabsPanelRow): number;
    _onDrop(event: TabsPanelDragEvent): void;
    _onDragLeave(event: TabsPanelDragEvent): void;
    _onDragEnd(event: TabsPanelDragEvent): void;
    _updateDropTarget(event: TabsPanelDragEvent): boolean;
    _setDropTarget(row: TabsPanelRow, direction: number): void;
    _clearDropTarget(): void;
    _onClick(event: TabsPanelEvent): void;

    // Tab Mix Plus
    _removeTabFromList(event: TabsPanelEvent): void;
    _original_createRow(tab: BrowserTab): TabsPanelRow;
  }

  type TabsPanelEvent = GenericEvent<TabsPanelRow, MouseEvent>;
  type TabsPanelDragEvent = GenericEvent<TabsPanelRow, DragEvent>;

  interface TabsPanelRow extends HTMLElement {
    tab: BrowserTab;
  }

  interface TabsListBase {
    constructor({className, filterFn, insertBefore, containerNode, dropIndicator}: {className: string; filterFn: (tab: BrowserTab) => boolean; insertBefore: HTMLElement | null; containerNode: HTMLElement; dropIndicator?: HTMLElement | null}): void;
    className: string;
    filterFn: (tab: BrowserTab) => boolean;
    insertBefore: HTMLElement | null;
    containerNode: HTMLElement;
    dropIndicator: HTMLElement | null;
    dropTargetRow: TabsPanelRow | null;
    dropTargetDirection: number | undefined;
    doc: Document;
    gBrowser: TabBrowser;
    tabToElement: Map<BrowserTab, TabsPanelRow>;
    listenersRegistered: boolean;
    get rows(): IterableIterator<TabsPanelRow>;
    handleEvent(event: Event): void;
    _selectTab(tab: BrowserTab): void;
    _populate(): void;
    _addElement(elementOrFragment: DocumentFragment | HTMLElement): void;
    _cleanup(): void;
    _setupListeners(): void;
    _cleanupListeners(): void;
    _tabAttrModified(tab: BrowserTab): void;
    _moveTab(tab: BrowserTab): void;
    _addTab(newtab: BrowserTab): void;
    _tabClose(tab: BrowserTab): void;
    _removeItem(item: TabsPanelRow, tab: BrowserTab): void;
  }

  interface gTabsPanel {
    init(): void;
    allTabsPanel: TabsPanel;
    kElements: {
      allTabsView: string;
    };
  }

  interface TabContextMenu {
    contextTab: BrowserTab;
  }

  interface OpenLinkInParams {
    charset?: string;
    csp?: nsIContentSecurityPolicy;
    frameID?: number;
    globalHistoryOptions?: {
      triggeringSponsoredURL: string;
      triggeringSponsoredURLVisitTimeMS: string;
    };
    hasValidUserGestureActivation?: boolean;
    originPrincipal?: nsIPrincipal;
    originStoragePrincipal?: nsIPrincipal;
    private?: boolean;
    triggeringPrincipal?: nsIPrincipal;
    triggeringRemoteType?: string;
    userContextId?: number;
    [key: string]: unknown;
  }

  interface gContextMenu {
    _openLinkInParameters: (extra: OpenLinkInParams) => OpenLinkInParams;
    isTextSelected: boolean | undefined;
    linkURL: string;
    onImage: boolean;
    onLink: boolean;
    openLinkInCurrent: () => void;
    onTextInput: boolean;
    principal: nsIPrincipal;
    target: EventTarget;
    tabmixLinks?: Map<string, string> | null;
    tabmixLinkURL?: string | null;
  }

  interface PlacesCommandHook {
    bookmarkLink: (url: string, title: string) => Promise<void>;
    bookmarkPage: () => Promise<void>;
    bookmarkTabs: () => Promise<void>;
    /** @deprecated removed since Firefox version 125 */
    get uniqueCurrentPages(): nsIURI[];
  }

  interface BookmarkInfo {
    guid: string;
    parentGuid: string;
    index: number;
    dateAdded: number;
    lastModified: number;
    type: number;
    title: string;
    url: URL;
  }

  interface nsINavBookmarksObserver {
    onBeginUpdateBatch(): void;
    onEndUpdateBatch(): void;
    onItemChanged(itemId: number, property: string, isAnnotationProperty: boolean, newValue: string, lastModified: string, itemType: number, parentId: string, guid: string): void;
    onItemVisited(itemId: number, visitID: number, time: number): void;
    onItemMoved(itemId: number, oldParentId: number, oldIndex: number, newParentId: number, newIndex: number, itemType: number, guid: string, oldParentGuid: string, newParentGuid: string): void;
  }

  interface BookmarksService extends nsINavBookmarksService {
    fetch: (guidOrInfo: string | {uri?: string; title?: string; guid?: string}, onResult?: ((result: BookmarkInfo) => void) | null, options?: {concurrent?: boolean; includePath?: boolean; includeItemIds?: boolean}) => Promise<BookmarkInfo>;
  }

  interface PlacesUtils {
    bookmarks: BookmarksService;
    favicons: nsIFaviconService;
    observers: typeof PlacesObservers;
    virtualHistoryGuid: string;
  }

  interface PlacesUIUtils {
    openTabset(aItemsToOpen: Array<{uri: string; isBookmark: boolean}>, aEvent: Event, aWindow: Window): void;
    /** @deprecated removed since Firefox version 125 */
    showBookmarkPagesDialog(URIList: nsIURI[], hiddenRows?: string[], win?: Window): Promise<void>;
  }

  /** Services */

  // NOTE:
  // we use here the interface from gecko/lib.gecko.services.d.ts
  // and ignore the declared Services from gecko.d.ts

  interface _nsIEventListenerService extends nsIEventListenerService {
    /** @deprecated removed since Firefox version 125 */
    addSystemEventListener: (element: Window | Document | Element, type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean) => void;
    /** @deprecated removed since Firefox version 125 */
    removeSystemEventListener: (element: Window | Document | Element, type: string, listener: EventListenerOrEventListenerObject, useCapture?: boolean) => void;
  }

  interface _nsIIOService extends nsIIOService {
    newURI(aSpec: string, aOriginCharset?: string | null, aBaseURI?: nsIURI | null): nsIURI;
  }

  interface _nsIObserverService extends nsIObserverService {
    notifyObservers(aSubject: nsISupports, aTopic: string, someData?: string): void;
    notifyObservers(aSubject: nsISupports & {wrappedJSObject: Promise<void>}, aTopic: string, someData?: string): void;
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

  interface _nsIWindowMediator extends Omit<nsIWindowMediator, "getMostRecentWindow"> {
    getEnumerator(aWindowType: string | null): nsISimpleEnumeratorWithWindow;
    getMostRecentWindow: <K extends keyof GetWindowByTypeMap>(selectors: K | string) => K extends keyof GetWindowByTypeMap ? GetWindowByTypeMap[K] : BrowserWindow;
  }

  interface _nsIPrefBranch extends nsIPrefBranchXpcom {
    savePrefFile(aFile: nsIFile | null): void;
  }

  interface Services extends Omit<JSServices, "els" | "io" | "obs" | "prompt" | "wm" | "prefs"> {
    els: _nsIEventListenerService;
    io: _nsIIOService & nsINetUtil & nsISpeculativeConnect;
    obs: _nsIObserverService;
    prompt: _nsIPromptService;
    wm: _nsIWindowMediator;
    prefs: _nsIPrefBranch & nsIPrefService;
  }
}

// @ts-ignore - we override Services from gecko.d.ts with lib.gecko.services.d.ts JSServices
declare var Services: MockedGeckoTypes.Services;

interface IgIncompatiblePane {
  checkForIncompatible: (aShowList: boolean) => void;
}

interface TabmixOptionsWindow extends Window {
  showPane: (paneID: string) => void;
  gAppearancePane?: {
    toolbarButtons: (window: Window) => void;
  };
  gIncompatiblePane: IgIncompatiblePane;
}

interface GetByMap {
  "browser": MockedGeckoTypes.TabBrowser;
  "tabmix_bookmarkUrl": MockedGeckoTypes.BrowserTab;
  "new-tab-button": HTMLButtonElement;
  "placesContext": XULPopupElement;
  "placesContext_open": HTMLElement;
  "placesContext_open:newprivatewindow": HTMLElement;
  "placesContext_open:newtab": HTMLElement;
  "placesContext_open:newwindow": HTMLElement;
  "tabmix_hideTabbar_menu": HTMLMenuElement;
  "tabmix_hideTabbar_separator": HTMLElement;
  "tabs-newtab-button": HTMLButtonElement;
  "toolbar-context-menu": XULPopupElement;
  "browserStack": HTMLElement & {firstChild: MockedGeckoTypes.ChromeBrowser};
  "tabbrowser-tabs": MockedGeckoTypes.TabContainer;
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

interface AppConstantsType {
  BROWSER_CHROME_URL: string;
  platform: string;
}

type ContentClickLinkElement = Omit<HTMLLinkElement, "parentNode" | "ownerDocument" | "ownerGlobal"> & {
  dataset: {isSponsoredLink: "true" | "false" | null};
  parentNode: ContentClickLinkElement;
  readonly ownerDocument: Document;
  ownerGlobal: WindowProxy;
};
type ContentClickLinkData = [href: string | null, linkNode: ContentClickLinkElement | null, linkPrincipal: nsIPrincipal] | null;

interface BrowserUtils {
  hrefAndLinkNodeForClickEvent: (event: MouseEvent) => ContentClickLinkData;
  whereToOpenLink: (event: MouseEvent) => WhereToOpen;
}

interface HistoryMenu {
  populateUndoSubmenu: () => void;
  populateUndoWindowSubmenu: () => void;
}

interface CustomizableUIListener {
  onWidgetAfterDOMChange(aNode: Node, aNextNode: Node, aContainer: ParentNode, aWasRemoval: boolean): void;
}

interface CustomizableUI {
  AREA_TABSTRIP: string;
  addListener: (aListener: CustomizableUIListener) => void;
  addShortcut(aShortcutNode: Node, aTargetNode?: Node): void;
  addWidgetToArea: (aWidgetId: string, aArea: string, aPosition: number, aInitialAdd?: boolean) => void;
  getWidgetIdsInArea: (aArea: string) => string[];
  getPlacementOfWidget: (aWidgetId: string, aOnlyRegistered?: boolean, aDeadAreas?: boolean) => {area: string; position: number} | null;
  moveWidgetWithinArea: (aWidgetId: string, aPosition: number) => void;
  removeListener: (aListener: CustomizableUIListener) => void;
  removeWidgetFromArea: (aWidgetId: string) => void;
}

interface CustomTitlebar {
  _updatingAppearance: boolean;
  _update: () => void;
  enabled: boolean;
  init: () => void;
}

interface E10SUtils {
  SERIALIZED_SYSTEMPRINCIPAL: string;
  DEFAULT_REMOTE_TYPE: string;
  getRemoteTypeForURI: (aUri: string, aMultiProcess?: boolean, aRemoteSubframes?: boolean, aPreferredRemoteType?: string, aCurrentUri?: string | null, aOriginAttributes?: Params) => string;
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

type UrlbarResult = {
  heuristic: boolean;
  payload: {url: string; helpUrl: string};
  type: number;
};

interface UrlbarInput {
  searchMode?: {isPreview: boolean};
  setValueFromResult: (options?: {result: UrlbarResult; event: Event; urlOverride: string}) => boolean;
}

interface UrlbarView {
  input: UrlbarInput;
  panel: HTMLElement;
  getResultFromElement: (element: Element) => UrlbarResult;
  readonly oneOffSearchButtons: {selectedButton: HTMLButtonElement};
  selectedElement: Element;
}

interface gURLBar extends HTMLElement {
  _whereToOpen: (event?: Event & {__tabmix__whereToOpen?: WhereToOpen}) => WhereToOpen;
  focused: boolean;
  handleCommand(event?: Event): void;
  onWidgetAfterDOMChange(aNode: Node): void;
  select: () => void;
  setURI: (uri?: string, dueToTabSwitch?: boolean, dueToSessionRestore?: boolean, dontShowSearchTerms?: boolean, isSameDocument?: boolean) => void;
  textbox: Node & {
    parentNode: Node;
  };
  untrimmedValue: string;
  view: UrlbarView;
  value: string;
}

interface newWindowButtonObserver {
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}

interface nsBrowserAccess {
  __treestyletab__openURI: (...args: unknown[]) => unknown;
}

interface nsContextMenu {
  initOpenItems: () => void;
  openLinkInTab: (event: Event) => void;
}

interface PanelUI {
  _ensureShortcutsShown: (view: HTMLElement) => void;
  showSubView(view: string, anchor: HTMLElement, event?: Event): void;
}

interface PrivateBrowsingUtils {
  isBrowserPrivate: (browser: MockedGeckoTypes.ChromeBrowser) => boolean;
  isContentWindowPrivate: (window: Window) => boolean;
  permanentPrivateBrowsing: boolean;
}

interface StatusPanel {
  isVisible: boolean;
  update: () => void;
}

interface TabBarVisibility {
  update: (force?: boolean) => void;
}

interface XULBrowserWindow {
  setOverLink: (url: string, options?: {hideStatusPanelImmediately?: boolean}) => void;
}

// functions on globals firefox scope
declare function closeMenus(node: Node | null): void;
declare function closeWindow(aClose: boolean, aPromptFunction?: (source: string) => boolean, aSource?: string): boolean;
declare function FillHistoryMenu(event: Event): void;
declare function handleDroppedLink(event: DragEvent, url: string, name: string, triggeringPrincipal: nsIPrincipal): void;
declare function handleDroppedLink(event: DragEvent, links: nsIDroppedLinkItem[], triggeringPrincipal: nsIPrincipal): void;
declare function isBlankPageURL(url: string | null): boolean;
declare function middleMousePaste(event: MouseEvent): void;
declare function OpenBrowserWindow(params?: {private?: boolean; features?: string; args?: nsIArray | nsISupportsString; remote?: boolean; fission?: boolean}): Window | null;
declare function openLinkIn(url: string, where: string, params: Params): void;
declare function openTrustedLinkIn(url: string, where: string, params: Params): void;
declare function pref(name: string, defaultValue: number | string | boolean): void;
declare function readFromClipboard(): string;
declare function setTimeout<T extends unknown[], U>(callback: (...args: T) => U, timeout: number, ...args: T): number;
declare function urlSecurityCheck(aURL: string, aPrincipal: nsIPrincipal, aFlags?: nsIScriptSecurityManager): void;
declare function undoCloseWindow(index: number): void;

declare var CustomizableUI: CustomizableUI;
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
declare var BROWSER_NEW_TAB_URL: string;
declare var browserDragAndDrop: {
  dropLinks: (aEvent: DragEvent, aDisallowInherit: boolean) => nsIDroppedLinkItem[];
};
declare var BrowserHandler: nsIBrowserHandler;
declare var BrowserWindowTracker: {
  getTopWindow: (options?: {private?: boolean; allowPopups?: boolean}) => Window | null;
};
declare var BrowserUtils: BrowserUtils;
declare var Components: nsIXPCComponents;
declare var ctrlTab: {
  init: () => void;
  uninit: () => void;
  _recentlyUsedTabs: MockedGeckoTypes.BrowserTab[];
};
declare var gMultiProcessBrowser: boolean;
declare var gNavToolbox: HTMLElement;
declare var gReduceMotion: boolean;
declare var HomePage: {
  get: (aWindow?: Window) => string;
};
declare var LinkTargetDisplay: {
  _undoCloseListMenu: HTMLMenuElement;
  update: (options?: {hideStatusPanelImmediately?: boolean}) => void;
};
declare var nsContextMenu: {
  _tabmix_initialized?: boolean;
  prototype: nsContextMenu;
  new (aXulMenu: XULPopupElement, aIsShift: boolean): nsContextMenu;
  isInstance: IsInstance<nsContextMenu>;
};
declare var OpenInTabsUtils: {
  confirmOpenInTabs: (closedTabCount: number, aWindow?: Window) => boolean;
};
declare var PageThumbs: {
  captureToCanvas: (aBrowser: MockedGeckoTypes.ChromeBrowser, aCanvas: MockedGeckoTypes.DNDCanvas, aArgs?: unknown, aSkipTelemetry?: boolean) => Promise<MockedGeckoTypes.DNDCanvas>;
};
declare var PanelMultiView: {
  getViewNode: (doc: Document, id: string) => HTMLElement;
};
declare var RecentlyClosedTabsAndWindowsMenuUtils: {
  _undoCloseMiddleClick: (event: MouseEvent) => void;
  getTabsFragment: (aWindow: Window, aTagName: string, aPrefixRestoreAll?: boolean) => Omit<HTMLElement, "firstChild"> & {firstChild: HTMLElement};
  getWindowsFragment: (aWindow: Window, aTagName: string, aPrefixRestoreAll?: boolean) => Omit<HTMLElement, "firstChild"> & {firstChild: HTMLElement};
  onRestoreAllTabsCommand: (event: MouseEvent) => void;
};
declare var SessionStartup: {
  onceInitialized: Promise<void>;
  willRestore: () => boolean;
};
declare var TAB_DROP_TYPE: string;

declare var CustomTitlebar: CustomTitlebar;
/** @deprecated - use CustomTitlebar instead from Firefox 135 */
declare var TabsInTitlebar: CustomTitlebar;

declare var UrlbarUtils: {
  RESULT_TYPE: {
    TAB_SWITCH: number;
  };
  stripUnsafeProtocolOnPaste(pasteData: string): string;
};

// merge types from lib.gecko.xpcom.d.ts with existing interface from gecko.d.ts
declare namespace MockedExports {
  // nsIFilePicker is missing some types from lib.gecko.xpcom.d.ts
  interface nsIFilePicker extends nsIFilePickerXpcom {}
  interface FilePicker extends Pick<nsIFilePicker, "appendFilters" | "defaultExtension" | "defaultString"> {
    init: (browsingContext: BrowsingContext, title: string | null, mode: number) => void;
  }

  interface nsISupportsString {
    number: string;
  }

  interface Cc {
    "@mozilla.org/browser/clh;1": {getService(service: nsJSIID<nsIBrowserHandler>): nsIBrowserHandler};
    "@mozilla.org/content/style-sheet-service;1": {getService(service: nsJSIID<nsIStyleSheetService>): nsIStyleSheetService};
    "@mozilla.org/embedcomp/dialogparam;1": {createInstance(instance: nsJSIID<nsIDialogParamBlock>): nsIDialogParamBlock};
    "@mozilla.org/file/local;1": {createInstance(instance: Ci["nsIFile"]): nsIFile};
    "@mozilla.org/gfx/fontenumerator;1": {createInstance(instance: nsJSIID<nsIFontEnumerator>): nsIFontEnumerator};
    "@mozilla.org/pref-localizedstring;1": {createInstance(instance: Ci["nsIPrefLocalizedString"]): nsIPrefLocalizedString};
    "@mozilla.org/referrer-info;1": {createInstance(instance: nsJSIID<nsIReferrerInfo>): nsIReferrerInfo};
    "@mozilla.org/supports-PRBool;1": {createInstance(instance: nsJSIID<nsISupportsPRBool>): nsISupportsPRBool};
    "@mozilla.org/widget/clipboardhelper;1": {getService(service: nsJSIID<nsIClipboardHelper>): nsIClipboardHelper};
  }

  interface _nsIWebNavigation extends nsIWebNavigation {
    sessionHistory: nsISupports & {legacySHistory: nsISHistory};
  }

  interface Ci extends Omit<nsIXPCComponents_Interfaces, "nsIFilePicker"> {
    nsIWebNavigation: nsJSIID<_nsIWebNavigation> & {[key: string]: any};
  }

  interface Cu {
    getGlobalForObject(obj: unknown): any;
  }
}

interface XULElement {
  container?: unknown;
}

interface XULCommandDispatcher {
  focusedWindow: mozIDOMWindowProxy;
}

interface TabmixKnownModules {
  "resource://gre/modules/AddonManager.sys.mjs": {AddonManager: AddonManagerType};
  "resource://gre/modules/AppConstants.sys.mjs": {AppConstants: AppConstantsType};
  "resource://gre/modules/PrivateBrowsingUtils.sys.mjs": {PrivateBrowsingUtils: PrivateBrowsingUtils};
  "resource:///modules/PlacesUIUtils.sys.mjs": {PlacesUIUtils: MockedGeckoTypes.PlacesUIUtils};
}
