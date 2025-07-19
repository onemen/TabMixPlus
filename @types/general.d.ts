/// <reference types="./gecko/devtools/gecko.d.ts" />
/// <reference types="./gecko/tools/generated/lib.gecko.services.d.ts" />
/// <reference types="./gecko/tools/lib.gecko.tweaks.d.ts" />
/// <reference types="./custom.gecko.dom.d.ts" />

type Tab = MockedGeckoTypes.BrowserTab;
type Tabs = NonEmptyArray<Tab>;
type Browser = MockedGeckoTypes.ChromeBrowser;
type TabBrowser = MockedGeckoTypes.TabBrowser;
type TabContainer = MockedGeckoTypes.TabContainer;

// use these types instead of types from gecko.d.ts
type nsIFilePickerXpcom = nsIFilePicker;
type nsIPrefBranchXpcom = ReturnType<nsIPrefService["getBranch"]>;

interface GetClosestMap {
  "tab.tabbrowser-tab": MockedGeckoTypes.BrowserTab;
  "tab-group": MockedGeckoTypes.MozTabbrowserTabGroup;
  ".tab-group-label": MockedGeckoTypes.MozTabGroupLabel;
}

interface Element {
  closest<K extends keyof GetClosestMap | string>(selector: K | string): K extends keyof GetClosestMap ? GetClosestMap[K] : HTMLElement | null;
  __tagName?: string;
  value: string | number | boolean;
  readonly style: CSSStyleDeclaration;
  getElementsByClassName<K extends keyof GetByMap>(name: K): NonEmptyCollection_G<GetByMap[K]>;
  // it is ok to allow setAttribute to convert the value to string for us
  setAttribute(name: string, value: string | boolean | number): void;
  label: string;
  _originalOrder?: number;
}

interface NodeList {
  readonly length: number;
  item(index: number): HTMLElement | null;
  forEach(callbackfn: (value: HTMLElement | null, key: number, parent: NodeList) => void, thisArg?: unknown): void;
  [index: number]: HTMLElement;
}

type CustomElement<T, Parent = HTMLElement> =
  T extends object ?
    Omit<T, "parentNode" | "value"> & {
      parentNode: Parent;
      value: number;
    }
  : never;

type CustomNonNullable<T> = T extends null | undefined ? never : T;
type GenericEvent<
  T,
  E extends Event,
  Parent = T extends {parentNode: infer P} ?
    CustomNonNullable<P> extends HTMLElement ?
      CustomNonNullable<P>
    : HTMLElement
  : HTMLElement,
> = Omit<E, "target" | "originalTarget"> & {
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
  nextSibling: HTMLElement | null;
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
  marginInlineStart: string;
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
  position: string;
  width: string;
  transform: string;
  visibility: string;
  [index: string]: string;
}

type AriaFocusableItem = MockedGeckoTypes.BrowserTab | MockedGeckoTypes.MozTabGroupLabel;
type AriaFocusableItems = NonEmptyArray<AriaFocusableItem>;
type DraggedElement = AriaFocusableItem | null;
type DraggedSourceNode = DraggedElement | HTMLLinkElement | Element;
type DragEventParams = {sourceNode: DraggedSourceNode; dragType: number; draggedElement: DraggedElement; newIndex: number; dropElement: Tab | undefined; dropBefore?: boolean; fromTabList?: boolean; dropOnStart?: boolean; groupLabelMargin?: number | undefined};

declare namespace MockedGeckoTypes {
  interface BrowsingContext extends MockedExports.BrowsingContext {
    opener?: CanonicalBrowsingContext;
    reload: (loadFlags: number) => void;
    sessionHistory: nsISHistory | null;
  }

  interface ChromeBrowser extends MockedExports.ChromeBrowser, nsIBrowser {
    _contentWindow: Window;
    asyncPermitUnload: (action: string) => Promise<{permitUnload: boolean}>;
    authPromptAbuseCounter?: {
      baseDomain?: number;
    };
    browsingContext: BrowsingContext;
    contentTitle?: string;
    contentWindow: WindowProxy;
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
    mIconURL: string;
    // ignore null here
    readonly ownerDocument: Document;
    readonly ownerGlobal: WindowProxy;
    reload: () => void;
    sendMessageToActor: (messageName: string, data: object, type: string) => void;
    stop: () => void;
    set userTypedValue(val: string);
    get userTypedValue(): string | null;
    webNavigation: MockedExports._nsIWebNavigation;

    // modified by Tab Mix Plus
    __tabmix__whereToOpen?: WhereToOpen;
    __tabmix_loadURI: boolean;
    __tabmix_fixupAndLoadURIString: boolean;
    __tabmixScrollPosition?: {x: number | undefined; y: number | undefined} | null;
    tabmix_allowLoad?: boolean;
  }

  interface CustomElementEventMap extends ElementEventMap {
    DOMModalDialogClosed: CustomEvent & {
      target: Node;
    };
  }

  interface Browser extends MockedExports.Browser {
    readonly currentURI: URI;
    selectedBrowser: ChromeBrowser;
    addEventListener<K extends keyof CustomElementEventMap>(type: K, listener: (this: Element, ev: CustomElementEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
  }

  type DragData = {
    offsetX: number;
    offsetY: number;
    scrollPos: number;
    screenX: number;
    screenY: number;
    movingTabs: BrowserTab[];
    fromTabList: boolean;
    tabGroupCreationColor: string;
    expandGroupOnDrop: boolean;
    nextTab?: BrowserTab;
  };

  interface BrowserTab extends MockedExports.BrowserTab, Omit<Element, "ownerGlobal" | "nextSibling"> {
    readonly _isProtected: boolean;
    _labelIsInitialTitle?: boolean;
    _tPos: number;
    _dragData: DragData;
    closing: boolean;
    readonly container: TabContainer;
    connectedCallback: () => void;
    elementIndex: number;
    group: MozTabbrowserTabGroup | null;
    initialize: () => void;
    isOpen: boolean;
    readonly isEmpty: boolean;
    label: string;
    linkedBrowser: ChromeBrowser;
    set linkedPanel(val: string);
    get linkedPanel(): string;
    // mCorrespondingMenuitem: - see addon.d.ts
    readonly multiselected: boolean;
    nextSibling: BrowserTab | MozTabbrowserTabGroup | undefined;
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
    postDataAcceptedByUser?: boolean;
    removeShowButton: (tab: BrowserTab) => void;
    setHoverState: (aEvent: MouseEvent, aHover: boolean) => void;
    setShowButton: (tab: BrowserTab) => void;
    readonly tabXDelay: number;
    tabmix_inited: boolean;
    tabmix_allowLoad: boolean;
    tabmixKey: object;
  }

  type ScrollboxElement = BrowserTab | MozTabbrowserTabGroup;

  interface ArrowScrollbox extends Omit<Element, "children" | "appendChild" | "contains" | "insertBefore" | "prepend"> {
    _boundsWithoutFlushing: (element: HTMLElement) => DOMRect;
    _canScrollToElement: (element: BrowserTab) => boolean;
    _distanceToRow: (amountToScroll: number) => number;
    _isRTLScrollbox: boolean;
    _getScrollableElements: () => AriaFocusableItems;
    _prevMouseScrolls: boolean[];
    _scrollButtonDown: HTMLButtonElement;
    _scrollButtonUp: HTMLButtonElement;
    children: NonEmptyArray<ScrollboxElement>;
    ensureElementIsVisible: (tab: AriaFocusableItem, instant?: boolean) => void;
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

    appendChild(tab: ScrollboxElement): ScrollboxElement;
    contains(tab: ScrollboxElement): boolean;
    insertBefore(tab: ScrollboxElement, child: ScrollboxElement | null): ScrollboxElement;
    prepend(...tabs: ScrollboxElement[]): void;
    _tabmix_originals: {
      appendChild?: ArrowScrollbox["appendChild"];
      contains: ArrowScrollbox["contains"];
      insertBefore?: ArrowScrollbox["insertBefore"];
      prepend?: ArrowScrollbox["prepend"];
    };
  }

  interface DNDCanvas extends Element {
    height: number;
  }

  interface TabContainer extends Element {
    _animateExpandedPinnedTabMove: (event: MouseEvent) => void;
    _animateTabMove: (event: MouseEvent) => void;
    _backgroundTabScrollPromise?: Promise<void>;
    _blockDblClick?: boolean;
    _dndCanvas: DNDCanvas;
    _dndPanel: DNDCanvas;
    _dragOverDelay: number;
    _expandSpacerBy: (pixels: number) => void;
    /** @deprecated replaced with finishAnimateTabMove in firefox 138 */
    _finishAnimateTabMove: () => void;
    finishAnimateTabMove: () => void;
    finishMoveTogetherSelectedTabs: (tab: BrowserTab) => void;
    /** @deprecated replaced with _finishMoveTogetherSelectedTabs in firefox 138 */
    _finishMoveTogetherSelectedTabs: (tab: BrowserTab) => void;
    /** @deprecated replaced with _finishMoveTogetherSelectedTabs in firefox 133 */
    _finishGroupSelectedTabs: (tab: BrowserTab) => void;
    /** @deprecated replaced with #getDragTarget in firefox 138 */
    _getDragTargetTab(event: DragEvent, options?: {ignoreTabSides?: boolean}): BrowserTab | null;
    // we are adding arguments to _getDropIndex see minit.js for details
    _getDropIndex(event: DragEvent): number;
    _getDropIndex(event: DragEvent, options: {dragover?: boolean; getParams: true}): DragEventParams;
    _getDropIndex(event: DragEvent, options?: {dragover?: boolean; getParams?: boolean}): number | DragEventParams;
    /** @deprecated replaced with #moveTogetherSelectedTabs in firefox 133 */
    _groupSelectedTabs: (tab: BrowserTab) => void;
    _handleTabSelect: (instant: boolean) => void;
    _invalidateCachedTabs: () => void;
    _invalidateCachedVisibleTabs: () => void;
    get _isCustomizing(): boolean;
    _lastTabClosedByMouse: boolean;
    _lastTabToScrollIntoView?: BrowserTab;
    _maxTabsPerRow: number;
    _notifyBackgroundTab: (aTab: BrowserTab) => void;
    _pinnedTabsLayoutCache: Record<string, unknown> | null;
    _positionPinnedTabs: () => void;
    _selectNewTab: (aNewTab: BrowserTab, aFallbackDir?: number, aWrap?: boolean) => void;
    _scrollButtonWidth: number;
    _tabClipWidth: number;
    _tabDropIndicator: HTMLElement;
    _unlockTabSizing: () => void;
    _updateCloseButtons(skipUpdateScrollStatus?: boolean, aUrl?: string | null): void;
    advanceSelectedTab: (dir: number, wrap: boolean) => void;
    get ariaFocusableItems(): AriaFocusableItems;
    get allTabs(): Tabs;
    get allGroups(): MozTabbrowserTabGroup[];
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
    _hasTabTempWidth: boolean;
    _hasTabTempMaxWidth: boolean;
    _rtlMode: boolean;

    // replacment for private methods and getters
    _clearDragOverCreateGroupTimer: () => void;
    _dragOverCreateGroupTimer: number;
    _dragTime: number;
    _expandGroupOnDrop(draggedTab: BrowserTab): void;
    _getDragTarget(event: DragEvent, options?: {ignoreSides?: boolean}): BrowserTab | null;
    _isAnimatingMoveTogetherSelectedTabs: () => boolean;
    _isContainerVerticalPinnedGrid: boolean;
    /** @deprecated replaced with _isContainerVerticalPinnedGrid in firefox 138 */
    _isContainerVerticalPinnedExpanded: boolean;
    _resetTabsAfterDrop(draggedTabDocument: Document): void;
    _updateTabStylesOnDrag(tab: BrowserTab, event: DragEvent): void;

    _keepTabSizeLocked: boolean;
    _moveTogetherSelectedTabs: (tab: BrowserTab) => void;
    // using insteadof private method #setDragOverGroupColor since Firefox 133
    _setDragOverGroupColor: (groupColorCode: string | null) => void;
    _setMovingTabMode(movingTab: boolean): void;
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

  type isTabGroup = (element: Tab | MozTabbrowserTabGroup) => element is MozTabbrowserTabGroup;

  type EnumValues = ClosingTabsEnum[keyof ClosingTabsEnum];
  type ClosingTabsEnumValues = Exclude<EnumValues, string>;

  type Notification = {priority: number; label: string | {"l10n-id": string; "l10n-args": object} | DocumentFragment; eventCallback?: (event: "removed" | "dismissed" | "disconnected") => void; notificationIs?: string; telemetry?: string; telemetryFilter?: string[]};
  type NotificationButton = {label: string; accessKey: string; callback?: (notification: Element, button: object, buttonElement: HTMLButtonElement, event: Event) => boolean | void; link?: string; supportPage?: boolean; popup?: string; telemetry?: string; is?: string};
  interface NotificationMessage extends HTMLElement {
    value: string;
  }
  interface NotificationBox {
    PRIORITY_INFO_MEDIUM: 2;
    PRIORITY_CRITICAL_HIGH: 3;
    appendNotification(aType: string, aNotification: Notification, aButtons?: NotificationButton[], aDisableClickJackingDelay?: boolean): NotificationMessage;
    getNotificationWithValue(value: string): Notification | null;
    removeNotification(notification: NotificationMessage): void;
  }

  type moveTabToOptions = {elementIndex?: number; tabIndex?: number; forceUngrouped?: boolean; keepRelatedTabs?: boolean; telemetrySource?: MockedExports.TelemetrySource};
  type TabMoveState = {tabIndex: number; elementIndex?: number; tabGroupId?: string};

  interface TabBrowser extends Browser {
    // build in methods and properties
    _switcher: {
      visibleTab: BrowserTab;
    };
    _endRemoveTab: (tab: BrowserTab) => void;
    _findTabToBlurTo: (aTab: BrowserTab, aExcludeTabs?: BrowserTab[]) => BrowserTab | null;
    _getTabMoveState: (tab: BrowserTab) => TabMoveState | undefined;
    _handleTabMove: (tab: BrowserTab, moveActionCallback: () => void) => void;
    /** @deprecated replaced with pinnedTabCount in Firefox version 133 */
    readonly _numPinnedTabs: number;
    _isLastTabInWindow: (tab: BrowserTab) => boolean;
    _lastRelatedTabMap: WeakMap<BrowserTab, BrowserTab>;
    _multiSelectedTabsSet: WeakSet<BrowserTab>;
    _notifyPinnedStatus: (tab: BrowserTab, params: {telemetrySource?: string}) => void;
    _notifyOnTabMove: (tab: BrowserTab, previousTabState?: TabMoveState, currentTabState?: TabMoveState, metricsContext?: MockedExports.TabMetricsContext) => void;
    _removingTabs: Set<BrowserTab>;
    _selectedTab: BrowserTab;
    _setTabLabel: (tab: BrowserTab, label: string, options?: {beforeTabOpen?: boolean; isContentTitle?: boolean; isURL?: boolean}) => boolean;
    _tabAttrModified: (tab: BrowserTab, changed: string[]) => void;
    _windowIsClosing: boolean;
    addAdjacentNewTab: (tab: BrowserTab) => void;
    addRangeToMultiSelectedTabs: (start: BrowserTab, end: BrowserTab) => void;
    // params.index was removed in Firefox 140
    addTab: (this: TabBrowser, url: string, params?: {tabIndex?: number; elementIndex?: number; isPending?: boolean; ownerTab?: BrowserTab | null; relatedToCurrent?: boolean} | Record<string, unknown>) => BrowserTab;
    addToMultiSelectedTabs: (tab: BrowserTab) => BrowserTab;
    addTrustedTab: (aURI: string, params?: Params) => BrowserTab;
    adoptTab: (aTab: BrowserTab, params?: {elementIndex?: number; tabIndex?: number; selectTab?: boolean}) => BrowserTab;
    browsers: ChromeBrowser[];
    readonly canGoForward: boolean;
    readonly canGoBack: boolean;
    clearMultiSelectedTabs: () => void;
    closingTabsEnum: ClosingTabsEnum;
    duplicateTab: (aTab: BrowserTab, aRestoreTabImmediately: boolean, aOptions?: {inBackground?: boolean; index?: number}) => BrowserTab;
    discardBrowser: (aTab: BrowserTab, aForceDiscard?: boolean) => void;
    getBrowserAtIndex: (aIndex: number) => ChromeBrowser;
    getBrowserForOuterWindowID(aID: number): ChromeBrowser;
    getBrowserForTab: (tab: BrowserTab) => ChromeBrowser;
    getNotificationBox: (browser?: ChromeBrowser) => NotificationBox;
    getTabForBrowser: (browser: ChromeBrowser) => BrowserTab;
    _getTabsToTheEndFrom: (tab: BrowserTab) => BrowserTab[];
    _getTabsToTheStartFrom: (tab: BrowserTab) => BrowserTab[];
    /** @deprecated replaced with _getTabsToTheEndFrom in firefox 135 */
    getTabsToTheEndFrom: (tab: BrowserTab) => BrowserTab[];
    /** @deprecated replaced with _getTabsToTheStartFrom in firefox 135 */
    getTabsToTheStartFrom: (tab: BrowserTab) => BrowserTab[];
    getIcon: (tab: BrowserTab) => string;
    hideTab: (aTab: BrowserTab, aSource?: string) => void;
    isTabGroupLabel: (element: DraggedSourceNode | EventTarget | undefined) => element is MozTabGroupLabel;
    isTab: (element: DraggedSourceNode | MozTabbrowserTabGroup | EventTarget | undefined) => element is BrowserTab;
    lastMultiSelectedTab: BrowserTab;
    // keepRelatedTabs was used until Firefox 134
    moveTabTo: (aTab: BrowserTab | MozTabbrowserTabGroup, options: moveTabToOptions) => void;
    moveTabsBefore: (tabs: BrowserTab[], targetElement?: BrowserTab | MozTabbrowserTabGroup | null, metricsContext?: MockedExports.TabMetricsContext) => void;
    moveTabsAfter: (tabs: BrowserTab[], targetElement?: BrowserTab | MozTabbrowserTabGroup | null, metricsContext?: MockedExports.TabMetricsContext) => void;
    ownerGlobal: WindowProxy;
    pinTab: (tab: BrowserTab) => void;
    readonly pinnedTabCount: number;
    preloadedBrowser?: ChromeBrowser;
    reloadTab: (tab: BrowserTab) => void;
    // modified by Tab Mix Plus
    removeTab: (
      tab: BrowserTab,
      params?: {
        animate?: boolean;
        triggeringEvent?: Event | undefined;
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
    removeCurrentTab: (params?: Params) => void;
    replaceTabWithWindow: (tab: BrowserTab) => Window | null;
    set selectedTabs(tabs: Tabs);
    get selectedTabs(): Tabs;
    get tabGroups(): MozTabbrowserTabGroup[];
    selectedTab: BrowserTab;
    setIcon(tab: BrowserTab, iconURL: string, originalURL?: string, loadingPrincipal?: nsIPrincipal, clearImageFirst?: boolean): void;
    setInitialTabTitle: (tab: BrowserTab, title: string, options: Record<string, unknown>) => void;
    setTabTitle: (tab: BrowserTab) => boolean;
    swapBrowsersAndCloseOther: (ourTab: BrowserTab, otherTab: BrowserTab) => boolean;
    pinnedTabsContainer: ArrowScrollbox;
    tabContainer: TabContainer;
    tabLocalization: Localization;
    get tabbox(): TabBox;
    get tabpanels(): Tabpanels;
    tabs: Tabs;
    visibleTabs: Tabs;
    unpinTab: (tab: BrowserTab) => void;
    updateBrowserRemotenessByURL: (aBrowser: ChromeBrowser, aURL: string, aOptions?: {newFrameloader?: boolean}) => boolean;
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
    protectTab: (tab: BrowserTab) => void;
    reloadLeftTabs: (this: MockedGeckoTypes.TabBrowser, tab: BrowserTab) => void;
    reloadRightTabs: (this: MockedGeckoTypes.TabBrowser, tab: BrowserTab) => void;
    reloadAllTabsBut: (this: MockedGeckoTypes.TabBrowser, tab: BrowserTab) => void;
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
    /** @deprecated use Tabmix.renameTab.editTitle(aTab) instead */
    renameTab: (tab: BrowserTab) => void;
  }

  interface BrowserWindow extends MockedExports.BrowserWindow {
    // override lib.gecko.dom.d.ts Document | null
    readonly document: Document;
    gBrowser: TabBrowser;
    TabContextMenu: MockedGeckoTypes.TabContextMenu;
  }

  type MozTextLabelContainer = HTMLElement;

  interface MozTextLabel extends Omit<HTMLLabelElement, "control"> {
    _onClick(event: MouseEvent): void;
    get accessKey(): string;
    set accessKey(val: string);
    get textContent(): string;
    set textContent(value: string);
    get control(): string | null;
    set control(value: string | null);
    set labeledControlElement(value: Element | null);
    get lastFormattedAccessKey(): string | null;
    set lastFormattedAccessKey(value: string | null);
    parentElement: MozTextLabelContainer;
  }

  interface GroupLabelContainer extends HTMLElement {
    closing: never;
  }

  interface MozTabGroupLabel extends MozTextLabel {
    _dragData: DragData;
    elementIndex: number;
    container: TabContainer;
    group: MozTabbrowserTabGroup;
    parentNode: GroupLabelContainer;
    pinned: never;
  }

  interface MozTabbrowserTabGroup extends Omit<MozXULElement, "previousSibling"> {
    get color(): string;
    set color(code: string);
    get id(): string;
    set id(val: string);
    get label(): string;
    set label(val: string);
    get name(): string;
    set name(newName: string);
    get collapsed(): boolean;
    set collapsed(val: boolean);
    lastSeenActive(): void;
    get tabs(): Tabs;
    get labelElement(): MozTabGroupLabel;
    addTabs(tabs: BrowserTab[]): void;
    ungroupTabs(): void;
    save(): void;
    on_click(event: PointerEvent): void;
    on_TabSelect(): void;
    select(): void;
    previousSibling: BrowserTab;
    pinned: never;
  }

  interface TabsPanel extends TabsListBase {
    prototype: TabsListBase;
    constructor(opts: Record<string, unknown>): void;
    view: unknown;
    panelMultiView: HTMLElement;
    _populate(): void;
    _createRow(tab: BrowserTab): TabsPanelRow;
    _createGroupRow(group: MozTabbrowserTabGroup): TabsPanelRow;
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
    _populateDOM(): void;
    _addElement(elementOrFragment: DocumentFragment | HTMLElement): void;
    _cleanup(): void;
    _createRow(tab: BrowserTab): TabsPanelRow;
    _createGroupRow(group: MozTabbrowserTabGroup): TabsPanelRow;
    _setupListeners(): void;
    _cleanupListeners(): void;
    _tabAttrModified(tab: BrowserTab): void;
    _moveTab(tab: BrowserTab): void;
    _addTab(newtab: BrowserTab): void;
    _tabClose(tab: BrowserTab): void;
    _removeItem(item: TabsPanelRow, tab: BrowserTab): void;

    _tabmix_sortTabs(): BrowserTab[];
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
    updateContextMenu: (tabContextMenu: HTMLElement) => void;
  }

  interface TabSwitcher {
    updateDisplay: () => void;
    visibleTab: Tab;
  }

  interface OpenLinkInParams {
    allowInheritPrincipal?: boolean;
    charset?: string;
    policyContainer?: nsIContentSecurityPolicy | null;
    frameID?: number;
    globalHistoryOptions?: {
      triggeringSponsoredURL: string;
      triggeringSponsoredURLVisitTimeMS: string;
    };
    hasValidUserGestureActivation?: boolean;
    originPrincipal?: nsIPrincipal;
    originStoragePrincipal?: nsIPrincipal;
    private?: boolean;
    triggeringPrincipal?: nsIPrincipal | null;
    triggeringRemoteType?: string | undefined;
    userContextId?: number;
    [key: string]: unknown;

    /** @deprecated - use policyContainer */
    csp?: nsIContentSecurityPolicy | null;
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
    fetch: (guidOrInfo: string | {url?: string; title?: string; guid?: string}, onResult?: ((result: BookmarkInfo) => void) | null, options?: {concurrent?: boolean; includePath?: boolean; includeItemIds?: boolean}) => Promise<BookmarkInfo>;
  }

  // for PlacesUtils.sys.mjs
  interface PlacesUtils {
    bookmarks: BookmarksService;
    favicons: nsIFaviconService;
    observers: typeof PlacesObservers;
    virtualHistoryGuid: string;
  }

  interface PlacesUIUtils {
    openTabset(aItemsToOpen: Array<{uri: string; isBookmark: boolean}>, aEvent: Event, aWindow: Window): void;
    markPageAsFollowedLink(aURL: string): void;
    /** @deprecated removed since Firefox version 125 */
    showBookmarkPagesDialog(URIList: nsIURI[], hiddenRows?: string[], win?: Window): Promise<void>;
  }
}

interface IgIncompatiblePane {
  checkForIncompatible: (aShowList: boolean) => void;
  hide_IncompatibleNotice(aHide: boolean, aFocus: boolean): void;
}

interface TabmixOptionsWindow extends Window {
  showPane: (paneID: string) => void;
  gAppearancePane?: {
    toolbarButtons: (window: Window) => void;
  };
  gIncompatiblePane: IgIncompatiblePane;
}

interface CustomXULPanel extends Node, Pick<XULPopupElement, "moveTo" | "openPopup" | "openPopupAtScreen"> {
  _overlayLoaded: boolean;
  state: string;
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

interface ContentMouseEvent extends Omit<MouseEvent, "composedTarget" | "originalTarget" | "target"> {
  composedTarget: ContentClickLinkElement;
  originalTarget: ContentClickLinkElement;
  target: ContentClickLinkElement;
  tabmix_isMultiProcessBrowser?: boolean;
  tabmix_openLinkWithHistory: boolean;
}

interface ContentClickLinkElement extends Omit<HTMLLinkElement, "parentNode" | "parentElement" | "ownerDocument" | "ownerGlobal"> {
  __tabmix?: boolean;
  _attributes: string[];
  host: string;
  pathname: string;
  parentElement: ContentClickLinkElement;
  parentNode: ContentClickLinkElement;
  readonly ownerDocument: Document;
  ownerGlobal: WindowProxy;
}
type ContentClickLinkData = [href: string | null, linkNode: ContentClickLinkElement | null, linkPrincipal: nsIPrincipal] | null;

interface HistoryMenu {
  populateUndoSubmenu: () => void;
  populateUndoWindowSubmenu: () => void;
}

interface CustomTitlebar {
  _updatingAppearance: boolean;
  _update: () => void;
  enabled: boolean;
  init: () => void;
}

interface FullScreen {
  _mouseTargetRect: Partial<DOMRect>;
  _isChromeCollapsed: boolean;
  showNavToolbox: (trackMouse?: boolean) => void;
}

interface FirefoxViewHandler {
  tab: Tab;
}

interface gBrowserInit {
  _boundDelayedStartup(): void;
  _delayedStartup(): void;
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
  handleRevert(): void;
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

interface nsContextMenu {
  initOpenItems: () => void;
  openLinkInTab: (event: Event) => void;
}

interface PanelUI {
  _ensureShortcutsShown: (view: HTMLElement) => void;
  showSubView(view: string, anchor: HTMLElement, event?: Event): void;
}

interface StatusPanel {
  isVisible: boolean;
  update: () => void;
}

interface TabBarVisibility {
  update: (force?: boolean) => void;
}

interface XULBrowserWindow {
  overLink: string;
  setOverLink: (url: string, options?: {hideStatusPanelImmediately?: boolean}) => void;
}

// functions on globals firefox scope
declare function closeMenus(node: Node | null): void;
declare function closeWindow(aClose: boolean, aPromptFunction?: (source: string) => boolean, aSource?: string): boolean;
declare function FillHistoryMenu(event: Event): void;
declare function handleDroppedLink(event: DragEvent | null, url: string, name: string, triggeringPrincipal: nsIPrincipal): void;
declare function handleDroppedLink(event: DragEvent | null, links: nsIDroppedLinkItem[], triggeringPrincipal: nsIPrincipal): void;
declare function isBlankPageURL(url: string | null): boolean;
declare function middleMousePaste(event: MouseEvent): void;
declare function OpenBrowserWindow(params?: {private?: boolean; features?: string; args?: nsIArray | nsISupportsString; remote?: boolean; fission?: boolean}): Window | null;
declare function openLinkIn(url: string, where: string, params: Params): void;
declare function openTrustedLinkIn(url: string, where: string, params: Params): void;
declare function pref(name: string, defaultValue: number | string | boolean): void;
declare function readFromClipboard(): string;
declare function setTimeout<T extends unknown[], U>(callback: (...args: T) => U, timeout: number, ...args: T): number;
declare function urlSecurityCheck(aURL: string, aPrincipal: nsIPrincipal, aFlags?: nsIScriptSecurityManager): void;
/** @deprecated undoCloseWindow moved to SessionWindowUI.undoCloseWindow in firefox 141 */
declare function undoCloseWindow(index: number): void;
/** @deprecated undoCloseTab moved to SessionWindowUI.undoCloseTab in firefox 141 */
declare function undoCloseTab(aIndex?: number, sourceWindowSSId?: string): MockedGeckoTypes.BrowserTab | null;

declare var CustomizableUI: MockedExports.CustomizableUI;
declare var E10SUtils: MockedExports.E10SUtils;
declare var FullScreen: FullScreen;
declare var FirefoxViewHandler: FirefoxViewHandler;
declare var gBrowser: MockedGeckoTypes.TabBrowser;
declare var gBrowserInit: gBrowserInit;
declare var gContextMenu: MockedGeckoTypes.gContextMenu;
declare var gFissionBrowser: boolean;
declare var gNavigatorBundle: gNavigatorBundle;
declare var gTabsPanel: MockedGeckoTypes.gTabsPanel;
declare var gURLBar: gURLBar;
declare var lazy: Record<string, unknown>;
/** @deprecated replaced with ToolbarDropHandler from firefox on version 138 */
declare var newWindowButtonObserver: newWindowButtonObserver;
declare var TabContextMenu: MockedGeckoTypes.TabContextMenu;
declare var PanelUI: PanelUI;
declare var PlacesCommandHook: MockedGeckoTypes.PlacesCommandHook;
declare var PlacesUtils: MockedGeckoTypes.PlacesUtils;
declare var PlacesUIUtils: MockedGeckoTypes.PlacesUIUtils;
declare var PrivateBrowsingUtils: MockedExports.PrivateBrowsingUtils;
declare var RTL_UI: boolean;
declare var StatusPanel: StatusPanel;
declare var TabBarVisibility: TabBarVisibility;
declare var XULBrowserWindow: XULBrowserWindow;

declare var HistoryMenu: {
  prototype: HistoryMenu;
  new (): HistoryMenu;
  isInstance: IsInstance<HistoryMenu>;
};

/** Window scope globals */
declare var BROWSER_NEW_TAB_URL: string;
/** @deprecated replaced with ToolbarDropHandler from firefox on version 138 */
declare var browserDragAndDrop: {
  dropLinks: (aEvent: DragEvent, aDisallowInherit: boolean) => nsIDroppedLinkItem[];
};
declare var BrowserHandler: nsIBrowserHandler;
declare var BrowserWindowTracker: {
  getTopWindow: (options?: {private?: boolean; allowPopups?: boolean}) => Window | null;
};
declare var BrowserUtils: MockedExports.BrowserUtils;
declare var Components: nsIXPCComponents & {
  Exception: {
    (message?: string, resultOrOptions?: number | ComponentsExceptionOptions, stack?: nsIStackFrame, data?: object): nsIException;
    prototype: nsIException;
    new (message?: string, resultOrOptions?: number | ComponentsExceptionOptions, stack?: nsIStackFrame, data?: object): nsIException;
  };
};
declare var ctrlTab: {
  init: () => void;
  uninit: () => void;
  _recentlyUsedTabs: MockedGeckoTypes.BrowserTab[];
};
declare var gMultiProcessBrowser: boolean;
declare var gNavToolbox: HTMLElement;
declare var gReduceMotion: boolean;
declare var gReduceMotionSetting: boolean;
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
  getTabsFragment: (aWindow: Window, aTagName: string, aPrefixRestoreAll?: boolean) => Omit<HTMLElement, "firstChild" | "lastChild"> & {firstChild: HTMLElement; lastChild: HTMLElement};
  getWindowsFragment: (aWindow: Window, aTagName: string, aPrefixRestoreAll?: boolean) => Omit<HTMLElement, "firstChild" | "lastChild"> & {firstChild: HTMLElement; lastChild: HTMLElement};
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
declare var TabsPanel: MockedGeckoTypes.TabsPanel;

declare var UrlbarUtils: {
  RESULT_TYPE: {
    TAB_SWITCH: number;
  };
  stripUnsafeProtocolOnPaste(pasteData: string): string;
};

// for Zen Browserw
declare var ZenWorkspaces: any;
declare var gZenVerticalTabsManager: any;

interface XULElement {
  container?: unknown;
  isInstance: IsInstance<XULElement>;
}
