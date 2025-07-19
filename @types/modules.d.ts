/// <reference types="./index.d.ts" />
/// <reference types="./general.d.ts" />

type DeferredPromise = {promise: Promise<void>; resolve: () => void; reject: () => void};
type FunctionWithUnknown = (...args: unknown[]) => unknown;
type FunctionWithAny = (...args: any[]) => any;
type I10MapValue = {before: number; l10n: string};
type I10Map = Record<string, I10MapValue>;

type WindowRect = {sizemode: string | null; height: string | null; width: string | null; screenX: string | null; screenY: string | null};
type PrivateMethodOptions<T> = {
  parent: Record<string, any>;
  parentName: string;
  methodName: T;
  nextMethodName: string;
  sandbox?: TabmixSandbox;
};

// Firefox modules

interface PrivateMethods {
  // BrowserDOMWindow
  openURIInNewTab: BrowserDOMWindow["prototype"]["_openURIInNewTab"];
}

/* nsBrowserAccess replaced with BrowserDOMWindow in firefox 137 */
interface BrowserDOMWindow {
  [key: string]: any;
  __treestyletab__openURI: (...args: any[]) => void;
  _openURIInNewTab(...args: any[]): void;
}

interface createXULMap {
  panel: RenameTabModule.RenameTabPanel;
}

interface GetByMap {
  context_pinTab: HTMLMenuElement;
  context_unpinTab: HTMLMenuElement;
  syncedTabsOpenSelected: HTMLMenuElement;
  tabmixRenametab_buttons: HTMLButtonElement;
  tabmixRenametab_checkbox: HTMLInputElement;
  tabmixRenametab_defaultField: HTMLInputElement;
  tabmixRenametab_deleteButton: HTMLButtonElement;
  tabmixRenametab_doneButton: HTMLButtonElement;
  tabmixRenametab_icon: HTMLImageElement;
  tabmixRenametab_panel: RenameTabModule.RenameTabPanel;
  tabmixRenametab_titleField: HTMLInputElement;
}

interface Window {
  arguments: any[];
  BrowserUtils: MockedExports.BrowserUtils;
  FullZoom: {
    init(): void;
    destroy(): void;
  };
  gBrowser: MockedGeckoTypes.TabBrowser;
  gBrowserInit: gBrowserInit;
  canQuitApplication(): boolean;
  handleLinkClick(event: MouseEvent, href: string, linkNode: ContentClickLinkElement | null, _tabmixOptions?: {where: string}): boolean;
  KeyboardEvent: KeyboardEvent;
  MozXULElement: typeof MozXULElement;
  MutationObserver: typeof MutationObserver;
  nsBrowserAccess: typeof nsBrowserAccess;
  SidebarController: {
    promiseInitialized: Promise<void>;
    revampComponentsLoaded: boolean;
    readonly sidebarVerticalTabsEnabled: boolean;
  };
  ToolbarDropHandler: {
    onDragOver(event: DragEvent): void;
    onDropNewWindowButtonObserver(event: DragEvent): void;
  };
  UIEvent: typeof UIEvent;
  URILoadingHelper: MockedExports.URILoadingHelper;
  XMLHttpRequest: typeof XMLHttpRequest;
  XULElement: XULElement;

  // old extension probably not in use anymore
  custombuttons: object;
  GM_util?: {
    getEnabled: () => boolean;
  };
  GM_getEnabled?: () => boolean;
  keyconfig: unknown;

  __winRect?: WindowRect;
  _tabmix_PlacesUIUtils_openTabset?: MockedGeckoTypes.PlacesUIUtils["openTabset"];
  gIncompatiblePane: IgIncompatiblePane;
  TabmixAllTabs: {checkForCtrlClick: TabmixGlobals.checkForCtrlClick};
  TMP_ClosedTabs: {handleButtonEvent: TabmixGlobals.handleButtonEvent};
  TMP_eventListener: {updateMultiRow: (aReset?: boolean) => void};
  TMP_undocloseTabButtonObserver: TabmixWidgetsModule.UndocloseTabButtonObserver;
  Tabmix: TabmixGlobal;
  TabmixTabClickOptions: typeof TabmixTabClickOptionsNS;
  TMP_SessionStore: typeof TabmixSessionStoreNS;

  // Firefox 141+
  SessionWindowUI: {
    undoCloseWindow(aIndex: number): Window | null;
    undoCloseTab(window: Window, aIndex?: number, sourceWindowSSId?: string): Tab | null;
  };
}

declare var nsBrowserAccess: {
  prototype: BrowserDOMWindow;
  new (): BrowserDOMWindow;
  isInstance: IsInstance<BrowserDOMWindow>;
};

declare var BrowserDOMWindowClass: {
  prototype: BrowserDOMWindow;
  new (): BrowserDOMWindow;
  isInstance: IsInstance<BrowserDOMWindow>;
};

interface TabmixKnownModules {
  // Waterfox
  "resource:///modules/PrivateTab.sys.mjs": {PrivateTab: MockedExports.PrivateTab};
  // Firefox
  "resource://gre/modules/AddonManager.sys.mjs": {AddonManager: AddonManagerType};
  "resource://gre/modules/AppConstants.sys.mjs": {AppConstants: AppConstantsType};
  "resource:///modules/BrowserDOMWindow.sys.mjs": {BrowserDOMWindow: typeof BrowserDOMWindowClass};
  "resource:///modules/BrowserWindowTracker.sys.mjs": import("resource:///modules/BrowserWindowTracker.sys.mjs").BrowserWindowTracker;
  "resource:///modules/PlacesUIUtils.sys.mjs": {PlacesUIUtils: MockedGeckoTypes.PlacesUIUtils};
  "moz-src:///browser/components/places/PlacesUIUtils.sys.mjs": {PlacesUIUtils: MockedGeckoTypes.PlacesUIUtils};
  "resource://gre/modules/Preferences.sys.mjs": {Preferences: typeof MockedExports.PreferencesClass};
  "resource://gre/modules/PrivateBrowsingUtils.sys.mjs": {PrivateBrowsingUtils: MockedExports.PrivateBrowsingUtils};
  "resource://gre/modules/XPCOMUtils.sys.mjs": typeof import("resource://gre/modules/XPCOMUtils.sys.mjs");
  // Tabmix
  "chrome://tabmix-resource/content/BrowserDOMWindow.sys.mjs": {TabmixBrowserDOMWindow: BrowserDOMWindowModule.BrowserDOMWindow};
  "chrome://tabmix-resource/content/BrowserVersion.sys.mjs": {isVersion: BrowserVersion};
  "chrome://tabmix-resource/content/Changecode.sys.mjs": {initializeChangeCodeClass: typeof ChangecodeModule.initializeChangeCodeClass};
  "chrome://tabmix-resource/content/ChromeUtils.sys.mjs": {TabmixChromeUtils: TabmixModules.ChromeUtils};
  "chrome://tabmix-resource/content/ContentClick.sys.mjs": {TabmixContentClick: ContentClickModule.ContentClick};
  "chrome://tabmix-resource/content/DownloadLastDir.sys.mjs": {TabmixDownloadLastDir: DownloadLastDirModule.DownloadLastDir};
  "chrome://tabmix-resource/content/DynamicRules.sys.mjs": {DynamicRules: DynamicRulesModule.DynamicRules};
  "chrome://tabmix-resource/content/extensions/CompatibilityCheck.sys.mjs": {CompatibilityCheck: typeof CompatibilityCheckModule.CompatibilityCheck};
  "chrome://tabmix-resource/content/extensions/AddonManager.sys.mjs": {TabmixAddonManager: {init: () => void}};
  "chrome://tabmix-resource/content/log.sys.mjs": {console: LogModule.Console};
  "chrome://tabmix-resource/content/Places.sys.mjs": {TabmixPlacesUtils: PlacesModule.PlacesUtils};
  "chrome://tabmix-resource/content/TabContextConfig.sys.mjs": {TabContextConfig: TabContextConfigModule.Exports};
  "chrome://tabmix-resource/content/Shortcuts.sys.mjs": {Shortcuts: ShortcutsModule.Shortcuts};
  "chrome://tabmix-resource/content/TabmixSvc.sys.mjs": {TabmixSvc: TabmixSvcModule.TabmixSvc};
  "chrome://tabmix-resource/content/NewTabURL.sys.mjs": {TabmixNewTabURL: NewTabURLModule.NewTabURL};
  "chrome://tabmix-resource/content/VerticalTabs.sys.mjs": {VerticalTabs: VerticalTabsModule.VerticalTabs};
}

declare namespace MockedExports {
  interface BrowserUtils {
    hrefAndLinkNodeForClickEvent: (event: MouseEvent) => ContentClickLinkData;
    whereToOpenLink: (event: MouseEvent, ignoreButton?: boolean, ignoreAlt?: boolean) => WhereToOpen;
  }

  // ContentClickLinkElement;
  interface ContentClickEvent extends ContentMouseEvent {
    // Additional properties not in MouseEvent
    href: string | null;
    title: string | null;
    policyContainer: string;
    referrerInfo: string;
    frameID: number;
    triggeringPrincipal: nsIPrincipal | null;
    originAttributes: nsIPrincipal["originAttributes"];
    isContentWindowPrivate: boolean;
    originPrincipal: nsIPrincipal;
    originStoragePrincipal: nsIPrincipal;
    globalHistoryOptions?: {
      triggeringSponsoredURL: string;
      triggeringSponsoredURLVisitTimeMS: string;
    };

    // Tabmix specific properties
    __hrefFromOnClick?: string | null;
    __where: "tabshifted" | "tab";
    bookmark: string;
    tabmixContentClick: ContentClickResult;

    /** @deprecated - use policyContainer instead */
    csp: string;
  }

  type ContentClickResult = {
    where: WhereToOpen | "default" | "handled" | "current.frame";
    suppressTabsOnFileDownload: boolean;
    _href: string | null;
    targetAttr: string | null;
  };

  interface ClickHandlerParentManager extends Omit<WindowGlobalParent, "browsingContext"> {
    browsingContext: BrowsingContext & {
      top: {
        embedderElement: MockedGeckoTypes.ChromeBrowser;
      };
    };
  }

  interface ClickHandlerParent extends Omit<JSWindowActorParent, "manager"> {
    readonly manager: ClickHandlerParentManager;
    receiveMessage(message: {name: string; data: ContentClickEvent}): void;
    contentAreaClick(data: ContentClickEvent): void;
    tabmix_contentAreaClick(data: ContentClickEvent): void;
    notifyClickListeners(data: ContentClickEvent): void;
    [key: string]: unknown;
  }

  export const ClickHandlerParent: {
    manager: ClickHandlerParentManager;
    prototype: ClickHandlerParent;
    new (): ClickHandlerParent;
    isInstance: IsInstance<ClickHandlerParent>;
  };

  interface CustomizableUIListener {
    onWidgetAfterDOMChange(aNode: Node, aNextNode: Node, aContainer: ParentNode, aWasRemoval: boolean): void;
  }

  interface CustomizableUI {
    AREA_TABSTRIP: string;
    addListener: (aListener: CustomizableUIListener) => void;
    addShortcut(aShortcutNode: Node, aTargetNode?: Node): void;
    addWidgetToArea: (aWidgetId: string, aArea: string, aPosition: number | undefined, aInitialAdd?: boolean) => void;
    beginBatchUpdate(): void;
    createWidget(widget: {id: string; type: string; localized: boolean; onBuild(aDoc: Document): Element}): Element;
    destroyWidget(aWidgetId: string): void;
    endBatchUpdate(): void;
    getWidgetIdsInArea: (aArea: string) => string[];
    getPlacementOfWidget: (aWidgetId: string, aOnlyRegistered?: boolean, aDeadAreas?: boolean) => {area: string; position: number} | null;
    moveWidgetWithinArea: (aWidgetId: string, aPosition: number) => void;
    removeListener: (aListener: CustomizableUIListener) => void;
    removeWidgetFromArea: (aWidgetId: string) => void;
  }

  interface E10SUtils {
    SERIALIZED_SYSTEMPRINCIPAL: string;
    DEFAULT_REMOTE_TYPE: string;
    deserializePolicyContainer(csp_b64?: string | null): nsIContentSecurityPolicy;
    deserializeReferrerInfo(referrerInfo_b64?: string | null): nsIReferrerInfo;
    getRemoteTypeForURI: (aUri: string, aMultiProcess?: boolean, aRemoteSubframes?: boolean, aPreferredRemoteType?: string, aCurrentUri?: string | null, aOriginAttributes?: Params) => string;
    predictOriginAttributes: ({window, browser, userContextId, geckoViewSessionContextId, privateBrowsingId}: {window?: Window; browser?: MockedGeckoTypes.ChromeBrowser; userContextId?: number | undefined; geckoViewSessionContextId?: string; privateBrowsingId?: string}) => {privateBrowsingId: string; userContextId: string; geckoViewSessionContextId: string};
    serializePolicyContainer: (csp: nsIContentSecurityPolicy) => string;
    serializeReferrerInfo: (referrerInfo: nsIReferrerInfo) => string;

    /** @deprecated - use deserializePolicyContainer instead */
    deserializeCSP(csp_b64?: string | null): nsIContentSecurityPolicy;
    /** @deprecated - use serializePolicyContainer instead */
    serializeCSP: (csp: nsIContentSecurityPolicy) => string;
  }

  interface Preferences {
    get<T = unknown>(prefName: string | string[], defaultValue?: T, valueType?: null): T;
    _get(prefName: string, defaultValue: unknown, valueType?: unknown): unknown;
    set(prefName: string | Record<string, string | number | boolean>, prefValue?: string | number | boolean): void;
    _set(prefName: string, prefValue: unknown): void;
    has(prefName: string | string[]): boolean | boolean[];
    isSet(prefName: string | string[]): boolean | string[];
    reset(prefName: string | string[]): void;
    lock(prefName: string | string[]): void;
    unlock(prefName: string | string[]): void;
    locked(prefName: string | string[]): boolean | boolean[];
    observe<P extends string, C extends PrefObserver, T extends Record<string, unknown>>(prefName: P, callback: C, thisObject?: T): {prefName: P; callback: C; thisObject?: T};
    ignore(prefName: string, callback: PrefObserver, thisObject: Record<string, unknown>): void;
    resetBranch(prefBranch?: string): void;
    _branchStr: string;
    readonly _prefBranch: nsIPrefBranchXpcom;
  }

  const PreferencesClass: {
    prototype: Preferences;
    new (
      args?:
        | {
            branch?: string;
            defaultBranch?: boolean;
            privacyContext?: string;
          }
        | string
    ): Preferences;
    isInstance: IsInstance<Preferences>;
  };

  // for Waterfox
  interface PrivateTab {
    overridePlacesUIUtils(): void;
  }

  interface PrivateBrowsingUtils {
    isBrowserPrivate(browser: MockedGeckoTypes.ChromeBrowser): boolean;
    isContentWindowPrivate(window: Window): boolean;
    isWindowPrivate(window: Window): boolean;
    permanentPrivateBrowsing: boolean;
  }

  const PrivateBrowsingUtilsSYSMJS: {
    PrivateBrowsingUtils: {
      isWindowPrivate(window: Window): boolean;
      permanentPrivateBrowsing: boolean;
    };
  };

  interface URILoadingHelper {
    getTargetWindow(window: Window, {skipPopups, forceNonPrivate}?: {skipPopups?: boolean; forceNonPrivate?: boolean}): Window | null;
    openUILink(window: Window, url: string, event: Event, aIgnoreButton: boolean | {ignoreButton: boolean; ignoreAlt: boolean}, aIgnoreAlt: boolean, aAllowThirdPartyFixup: boolean, aPostData: unknown, aReferrerInfo: unknown): void;
  }

  const XPCOMUtilsSYSMJS: {
    XPCOMUtils: {
      defineLazyModuleGetters<T extends Record<string, string>>(obj: object, modules: T): void;
      defineLazyPreferenceGetter(aObject: object, aName: string, aPreference: string, aDefaultPrefValue: unknown, aOnUpdate: (aPreference: string, previousValue: unknown, newValue: unknown) => void, aTransform?: (aPreference: string) => unknown): void;
    };
  };

  type TabListView = TabListViewNS.TabListView;
  var TabListView: {
    prototype: TabListView;
    new (): TabListView;
    isInstance: IsInstance<TabListView>;
  };

  type TelemetrySource = "tab_overflow" | "tab_group" | "tab_menu" | "drag" | "suggest" | "recent" | "unknown";
  type TabMetricsContext = {
    isUserTriggered: true;
    telemetrySource: TelemetrySource;
  };
  interface TabMetricsSourceConstants {
    TAB_OVERFLOW_MENU: "tab_overflow";
    TAB_GROUP_MENU: "tab_group";
    TAB_MENU: "tab_menu";
    DRAG_AND_DROP: "drag";
    SUGGEST: "suggest";
    RECENT_TABS: "recent";
    UNKNOWN: "unknown";
  }

  interface TabMetrics {
    userTriggeredContext: (source: TelemetrySource | undefined) => TabMetricsContext;
    METRIC_SOURCE: TabMetricsSourceConstants;
    METRIC_TABS_LAYOUT: {
      HORIZONTAL: "horizontal";
      VERTICAL: "vertical";
    };
    METRIC_REOPEN_TYPE: {
      SAVED: "saved";
      DELETED: "deleted";
    };
  }
}

// this namespace is for all SessionStore useage in Tabmix
declare namespace SessionStoreNS {
  type ClosedDataSource = Window | {sourceWindow?: Window; sourceClosedId?: number; sourceWindowId?: string; closedWindow?: boolean; restoreAll?: boolean; closedGroup?: {id: string} | undefined};
  type Group = {closedAt: number; collapsed: boolean; color: string; id: string; name: string};
  type WindowSource = Window | {sourceWindow: Window; private: boolean; closedTabsFromAllWindows: boolean; closedTabsFromClosedWindows: boolean};
  interface ClosedGroup extends Group {
    tabs: ClosedTabData[];
  }

  type TabDataEntry = {url: string; title: string; triggeringPrincipal_base64?: string};
  type TabData = {
    attributes?: Record<string, string>;
    disallow?: string[];
    entries: TabDataEntry[];
    extData?: Record<string, string>;
    groupId?: string;
    index: number;
    pinned?: boolean;
    userContextId?: number;
    userTypedValue: string | null;
    userTypedClear: number;
    image?: string;
    iconLoadingPrincipal?: nsIPrincipal;
  };

  type ClosedTabData = {
    _originalStateIndex: number;
    _originalGroupStateIndex: number;
    closedId: number;
    closedAt: number;
    closedInGroup: boolean;
    closedInTabGroupId: string | null;
    pos: number;
    sourceClosedId: number;
    sourceWindowId: string;
    state: TabData;
    title: string;
  };

  interface WindowState {
    _restoring?: boolean;
    _closedTabs: ClosedTabData[];
    _lastClosedTabGroupCount: number;
    busy?: boolean;
    chromeFlags?: number;
    closedGroups: ClosedGroup[];
    groups: Group[];
    height?: number;
    screenX?: number;
    screenY?: number;
    selected?: number;
    sidebar?: Record<string, unknown>;
    sizemode?: string;
    sizemodeBeforeMinimized?: string;
    tabs: TabData[];
    width?: number;
    workspaceID?: string;
    zIndex?: number;
  }

  interface WindowStateData extends Omit<WindowState, "busy"> {
    title: string;
    closedAt: number;
    closedId: number;
  }

  interface SessionStoreApi {
    /** @deprecated - use RunState instead */
    _loadState: number;
    deleteCustomTabValue(aTab: Tab, aKey: string): void;
    duplicateTab(aWindow: Window, aTab: Tab, aDelta?: number, aRestoreImmediately?: boolean, aOptions?: {inBackground?: boolean; index?: number}): Tab;
    forgetClosedTab(aSource: ClosedDataSource, aIndex: number): void;
    forgetClosedTabById(aClosedId: number, aSourceOptions: ClosedDataSource): void;
    forgetClosedTabGroup(source: ClosedDataSource, tabGroupId: string): void;
    forgetClosedWindow(aIndex: number): void;
    getClosedTabCount(aOptions?: WindowSource): number;
    getClosedTabCountForWindow(aWindow: Window): number;
    getClosedTabCountFromClosedWindows(): number;
    getClosedTabData(aOptions?: WindowSource): ClosedTabData[];
    /** @deprecated use getClosedTabData with aOptions?: Source since Firefox 117 */
    getClosedTabData(aWindow: Window, aAsString: boolean): ClosedTabData[];
    getClosedTabDataForWindow(aWindow: Window): ClosedTabData[];
    getClosedTabDataFromClosedWindows(): ClosedTabData[];
    getClosedTabGroups(aOptions?: Partial<WindowSource>): ClosedGroup[];
    getClosedWindowCount(): number;
    getClosedWindowData(): WindowStateData[];
    getCurrentState(aUpdateAll?: boolean): {
      windows: WindowStateData[];
      selectedWindow: number;
      _closedWindows: WindowStateData[];
      session: {lastUpdate: number; startTime: number; recentCrashes: number};
      global?: Record<string, unknown>;
    };
    getCustomTabValue(aTab: Tab, aKey: string): string;
    getInternalObjectState(aBrowser: MockedGeckoTypes.ChromeBrowser): number;
    getLastClosedTabCount(aWindow: Window): number;
    getLazyTabValue(aTab: Tab, aKey: string): string;
    getTabState(aTab: Tab): string;
    getWindowById(aSessionStoreId: string): Window;
    getWindowState(aWindow: nsIDOMWindow): {windows: WindowStateData[]};
    setCustomTabValue(aTab: Tab, aKey: string, aStringValue: unknown): void;
    setTabState(aTab: Tab, aState: string | TabData): void;
    undoCloseTab(aSource: ClosedDataSource, aIndex: number, aTargetWindow?: Window): Tab;
    undoClosedTabFromClosedWindow(aSource: ClosedDataSource, aClosedId: number, aTargetWindow?: Window): void;
  }
}

declare namespace TabListViewNS {
  type ClickHandler = (event: Event) => void;
  type OpenSelectedHandler = (url: string, event: MouseEvent) => void;
  type AdjustContextMenuHandler = (menu: TabmixGlobals.PopupElement) => void;
  type OpenSelectedFromContextMenuHandler = (event: Event) => void;

  interface TabListView {
    _window: Window;
    props: {
      onOpenTab(url: string, where: string, options?: {inBackground?: boolean | undefined}): void;
    };
    onClick: ClickHandler;
    onOpenSelected: OpenSelectedHandler;
    adjustContextMenu: AdjustContextMenuHandler;
    onOpenSelectedFromContextMenu: OpenSelectedFromContextMenuHandler;
    _openAllClientTabs(clientNode: Node, where: string): void;

    tabmix_onClick: ClickHandler;
    tabmix_onOpenSelected: OpenSelectedHandler;
    tabmix_adjustContextMenu: AdjustContextMenuHandler;
    tabmix_onOpenSelectedFromContextMenu: OpenSelectedFromContextMenuHandler;
    tabmix_whereToOpen: (event: MouseEvent) => {where: string; inBackground: boolean | undefined};
    tabmix_inBackground: boolean;
  }
}

declare module "resource:///modules/AboutNewTab.sys.mjs" {
  export interface AboutNewTab {
    get newTabURL(): string;
    set newTabURL(url: string);
    resetNewTabURL(): void;
  }
}

declare module "resource://gre/modules/AddonManager.sys.mjs" {
  const AddonManagerSYSMJS: {
    AddonManager: AddonManagerType;
  };

  export = AddonManagerSYSMJS;
}

declare module "resource:///modules/BrowserWindowTracker.sys.mjs" {
  export interface BrowserWindowTracker {
    getTopWindow(): ChromeWindow;
    readonly orderedWindows: ChromeWindow[];
    windowCount: number;
  }
}

declare module "resource://gre/modules/DownloadLastDir.sys.mjs" {
  export class DownloadLastDir {
    // for our use see descriptor in DownloadLastDir.sys.mjs
    _window: Window | null;
    constructor(window: Window);
    window: Window | null;
    _lastDir: string | null;
    getLastDir(): string | null;
    setFile(file: nsIFile): void;
    cleanupPrivateFile(): void;
  }
}

declare module "resource://gre/modules/NetUtil.sys.mjs" {
  export interface NetUtil {
    readInputStreamToString(aInputStream: nsIInputStream, aCount: number, aOptions?: {charset?: string; replacement?: string}): string;
  }
}

declare module "resource:///modules/OpenInTabsUtils.sys.mjs" {
  export interface OpenInTabsUtils {
    openTabs(urls: string[], params: Record<string, unknown>): Promise<void>;
    openNodeInTabs(aNodes: nsINavHistoryResultNode[], params: Record<string, unknown>): Promise<void>;
  }
}

declare module "resource://gre/modules/Preferences.sys.mjs" {
  export class Preferences extends MockedExports.PreferencesClass {}
}

declare module "resource://gre/modules/PrivateBrowsingUtils.sys.mjs" {
  export = MockedExports.PrivateBrowsingUtilsSYSMJS;
}

declare module "resource://gre/modules/PromiseUtils.sys.mjs" {
  export interface PromiseUtils {
    defer(): DeferredPromise;
  }
}

declare module "resource://gre/modules/Timer.sys.mjs" {
  type setTimeout = (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => number;
  export {setTimeout};
}

declare module "resource:///modules/sessionstore/TabState.sys.mjs" {
  export interface TabState {
    collect(tab: Tab, extData?: Record<string, unknown>): SessionStoreNS.TabData;
  }
}

declare module "resource:///modules/sessionstore/TabStateCache.sys.mjs" {
  export interface TabStateCache {
    update(permanentKey: object, newData: Record<string, unknown>): void;
  }
}

declare module "resource:///modules/SitePermissions.sys.mjs" {
  export interface SitePermissions {
    clearTemporaryBlockPermissions(browser: MockedGeckoTypes.ChromeBrowser): void;
  }
}

declare module "resource:///modules/syncedtabs/TabListView.sys.mjs" {
  export class TabListView extends MockedExports.TabListView {
    [key: string]: unknown;
  }
}

declare module "resource:///modules/URILoadingHelper.sys.mjs" {
  export interface URILoadingHelper extends MockedExports.URILoadingHelper {}
}

declare module "resource:///modules/syncedtabs/util.sys.mjs" {
  export function getChromeWindow(window: Window): ChromeWindow;
}

declare module "resource://gre/modules/XPCOMUtils.sys.mjs" {
  export = MockedExports.XPCOMUtilsSYSMJS;
}

interface KnownModulesImports {
  // firefox
  AboutNewTab: import("resource:///modules/AboutNewTab.sys.mjs").AboutNewTab;
  BrowserUtils: MockedExports.BrowserUtils;
  BrowserWindowTracker: import("resource:///modules/BrowserWindowTracker.sys.mjs").BrowserWindowTracker;
  ClickHandlerParent: typeof MockedExports.ClickHandlerParent;
  CustomizableUI: MockedExports.CustomizableUI;
  E10SUtils: MockedExports.E10SUtils;
  NetUtil: import("resource://gre/modules/NetUtil.sys.mjs").NetUtil;
  OpenInTabsUtils: import("resource:///modules/OpenInTabsUtils.sys.mjs").OpenInTabsUtils;
  PlacesUtils: MockedGeckoTypes.PlacesUtils;
  PlacesUIUtils: MockedGeckoTypes.PlacesUIUtils & PlacesModule.ExtraPlacesUIUtils;
  PrivateBrowsingUtils: MockedExports.PrivateBrowsingUtils;
  PromiseUtils: import("resource://gre/modules/PromiseUtils.sys.mjs").PromiseUtils;
  SitePermissions: import("resource:///modules/SitePermissions.sys.mjs").SitePermissions;
  TabState: import("resource:///modules/sessionstore/TabState.sys.mjs").TabState;
  TabStateCache: import("resource:///modules/sessionstore/TabStateCache.sys.mjs").TabStateCache;
  URILoadingHelper: import("resource:///modules/URILoadingHelper.sys.mjs").URILoadingHelper;

  // tabmix
  AutoReload: AutoReloadModule.AutoReload;
  ContentSvc: TabmixModules.ContentSvc;
  DocShellCapabilities: DocShellCapabilitiesModule.DocShellCapabilities;
  FloorpPrefsObserver: import("chrome://tabmix-resource/content/Floorp.sys.mjs").FloorpPrefsObserver;
  LinkNodeUtils: LinkNodeUtilsModule.LinkNodeUtils;
  initializeChangeCodeClass: typeof ChangecodeModule.initializeChangeCodeClass;
  isVersion: BrowserVersion;
  MergeWindows: MergeWindowsModule.MergeWindows;
  Overlays: OverlaysModule.OverlaysClass;
  SessionStore: SessionStoreNS.SessionStoreApi;
  setTimeout: import("resource://gre/modules/Timer.sys.mjs").setTimeout;
  Shortcuts: ShortcutsModule.Shortcuts;
  SyncedTabs: import("chrome://tabmix-resource/content/SyncedTabs.sys.mjs").SyncedTabs;
  TabmixUtils: TabmixUtilsModule.TabmixUtils;
  TabmixSvc: TabmixSvcModule.TabmixSvc;
  TabmixPlacesUtils: PlacesModule.PlacesUtils;
}

// Tab Mix modules

declare namespace AutoReloadModule {
  type importList = "E10SUtils" | "SitePermissions" | "TabmixUtils";
  type Lazy = Pick<KnownModulesImports, importList>;

  interface Popup extends Omit<TabmixGlobals.PopupElement, "ownerGlobal"> {
    _tab: Tab;
    initialized: boolean;
    listenersAdded: boolean;
    ownerGlobal: Window;
  }

  type serializedReloadData = {scrollX: number; scrollY: number; isPostData: boolean; postData: string | null; referrerInfo: string | null};
  type ReloadData = {scrollX: number; scrollY: number; isPostData: boolean; postData: nsIInputStream | null; referrerInfo: nsIReferrerInfo | null};

  interface AutoReload {
    _labels: {minute: string; minutes: string; seconds: string};
    init(): void;
    initTab(tab: Tab): void;
    addClonePopup(popup: Popup, tab: Tab): void;
    addEventListener(popup: Popup): void;
    onPopupShowing(popup: Popup, tab: Tab): void;
    updateCustomList(popup: Popup): void;
    setLabel(item: HTMLElement, seconds: number): void;
    setTime(tab: Tab, reloadTime: number): void;
    setCustomTime(tab: Tab): void;
    enableAllTabs(tabBrowser: TabBrowser): void;
    disableAllTabs(tabBrowser: TabBrowser): void;
    toggle(tab: Tab): void;
    _enable(tab: Tab): void;
    _disable(tab: Tab): void;
    _update(tab: Tab, value?: string): void;
    onTabReloaded(tab: Tab, browser: Browser): void;
    confirm(window: Window, tab: Tab, isRemote?: boolean): boolean;
    reloadRemoteTab(browser: Browser, serializeData: serializedReloadData): void;
  }

  function _reloadTab(tab: Tab): void;
  function beforeReload(window: Window, browser: Browser): Promise<void>;
  function doReloadTab(window: Window, browser: Browser, tab: Tab, data: ReloadData): void;
  function _observe(subject: Window, topic: string): void;
  function _clearTimeout(tab: Tab, window?: Window): void;
}

declare namespace BrowserDOMWindowModule {
  type importList = "initializeChangeCodeClass" | "URILoadingHelper";
  type Lazy = Pick<KnownModulesImports, importList>;

  type Constructor = typeof BrowserDOMWindowClass | typeof nsBrowserAccess;

  interface BrowserDOMWindow {
    _initialized: boolean;
    init(window: Window): void;
    getBrowserDOMWindow(window: Window): {
      constructor: typeof BrowserDOMWindowClass;
      scope: Record<string, unknown>;
    };
    getNsBrowserAccess(window: Window): {
      constructor: typeof nsBrowserAccess;
      scope?: undefined;
    };
    openURIInNewTab(constructor: Constructor, tabmixObj: TabmixGlobal): void;
    getContentWindowOrOpenURI(constructor: Constructor, methodName: string, tabmixObj: TabmixGlobal): void;
  }
}

type versionInfo = number | string | {ff?: number; wf?: string; fp?: string; zen?: string; updateChannel?: string};

type BrowserVersion = typeof import("chrome://tabmix-resource/content/BrowserVersion.sys.mjs").isVersion;

declare namespace ChangecodeModule {
  interface ChangeCodeScriptParamsWithObj {
    scope?: Record<string, unknown>;
    obj: Record<string, unknown>;
    window?: never;
  }

  interface ChangeCodeScriptParamsWithWindow {
    scope?: Record<string, unknown>;
    obj?: never;
    window: Window;
  }

  type ChangeCodeScriptParams = ChangeCodeScriptParamsWithObj | ChangeCodeScriptParamsWithWindow;
  type ExpandTabmix = Pick<TabmixGlobal, "_debugMode" | "changeCode" | "setNewFunction" | "nonStrictMode" | "getSandbox" | "makeCode">;
  type SandboxOptions = {shared?: boolean; scope?: Record<string, unknown> | undefined};

  function initializeChangeCodeClass(tabmixObj: TabmixGlobal, params: ChangeCodeScriptParams): TabmixSandbox;
  function updateSandboxWithScope(sandbox: TabmixSandbox, scope: Record<string, unknown>): TabmixSandbox;
  function createModuleSandbox(obj: object, options?: SandboxOptions): TabmixSandbox;
  function verifyPrivateMethodReplaced(code: string, obj: Record<string, any> | null, fullName: string): {code: string; needUpdate: boolean};
  function _makeCode(code: string, sandbox?: TabmixSandbox): FunctionWithAny;

  type Options = {forceUpdate?: boolean; silent?: boolean; set?: boolean; get?: boolean; sandbox?: TabmixSandbox | undefined};
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
    baseSandbox: TabmixSandbox;
  }
  interface ChangeCodeClass {
    _errorStack: nsIStackFrame | null;
    _value: string;
    obj: Record<string, any>;
    fnName: string;
    fullName: string;
    needUpdate: boolean;
    silent: boolean;
    type: "__lookupSetter__" | "__lookupGetter__" | "";
    errMsg: string;
    notFound: (string | RegExp)[];
    sandbox: TabmixSandbox | undefined;

    get value(): string;
    _replace(this: ChangeCodeClass, substr: string | RegExp, newString: string, params?: ReplaceParams): ChangeCodeClass;
    toCode(this: ChangeCodeClass, show?: boolean, overrideObj?: Record<string, any>, name?: string): void;
    defineProperty(this: ChangeCodeClass, overrideObj?: Record<string, unknown>, name?: string, codeInfo?: {set?: string; get?: string}): void;
    show(obj?: Record<string, unknown>, name?: string): void;
    isValidToChange(this: ChangeCodeClass, name: string): boolean;
    getCallerData(stack: nsIStackFrame, aOptions?: unknown): Error;
  }
}

declare namespace ChromeUtilsModule {
  type Lazy = Pick<KnownModulesImports, "isVersion">;
  interface ChromeUtils {
    XPCOMUtils?: typeof MockedExports.XPCOMUtilsSYSMJS.XPCOMUtils;
    esmModulePath(module: string): string | null | undefined;
    defineLazyModuleGetters(lazy: object, modules: object): void;
    import(module: string): any;
    defineLazyGetter(aObject: object, aName: string, aLambda: () => any): void;
  }
}

declare namespace CompatibilityCheckModule {
  function constructor(aWindow: Window, aShowList: boolean, aCallbackDialog: boolean): void;

  interface AddOn {
    _name: string;
    id: string;
    _version: string;
    toString(): string;
  }

  interface CompatibilityCheck {
    window: Window | null;
    showList: boolean;
    callbackDialog: boolean | null;
    list: AddOn[];
    DISABLE: number;
    CANCEL: number;
    DISABLE_AND_RESTART: number;

    getIncompatibleList(): void;
    showResult(): void;
    warnAboutIncompatible(): Promise<void>;
    promptCallBack(aResult: any): Promise<void>;
    disableExtensions(): Promise<void>;
    restart(aRestart: boolean): void;
    dialogCallback(aHideButton: boolean): void;
    getList(): Record<string, boolean>;
  }

  const CompatibilityCheck: {
    prototype: CompatibilityCheck;
    new (aWindow: Window, aShowList: boolean, aCallbackDialog?: boolean): CompatibilityCheck;
  };
}

declare namespace ContentAreaClick {
  function init(): void;
  function _contentLinkClick(aEvent: MockedExports.ContentClickEvent): void;
}

declare namespace ContentClickModule {
  type ContentClickEvent = MockedExports.ContentClickEvent;
  type WrappedNode = LinkNodeUtilsModule.WrappedNode;
  type WhereToOpenLink = WhereToOpen | "default";
  type LinkParams = {where: WhereToOpenLink; _href: string | null | undefined; suppressTabsOnFileDownload: boolean; targetAttr: string | null | undefined};
  type ContentNode = ContentClickLinkElement | WrappedNode | null;
  type MessageData = {epoch: number; json: ContentClickEvent; href?: string; node: ContentNode; result?: boolean};
  type FrameData = {href: string | null | undefined; name: string; epoch?: number};

  interface ExtendedWrappedNode extends WrappedNode {
    hasAttribute(name: string): boolean;
    getAttribute(name: string): string | null;
    parentNode: WrappedNode["parentNode"] & {
      hasAttribute(name: string): boolean;
      getAttribute(name: string): string | null;
    };
  }

  function wrapNode(aNode: EventTarget | ContentNode, aGetTargetIsFrame: boolean): ExtendedWrappedNode;
  function makeURI(aURL: string, aOriginCharset?: string | null, aBaseURI?: nsIURI | null): nsIURI;

  interface LinkData {
    event: ContentClickEvent;
    href: string | null | undefined;
    node: ExtendedWrappedNode;
    wrappedNode: ExtendedWrappedNode | null;
    targetAttr: string | null;
    readonly onclick: string | null;
    readonly currentURL: string;
    readonly hrefFromOnClick: string | null;
    readonly isLinkToExternalDomain: boolean;
  }

  type LinkDataClass = {
    new (event: ContentClickEvent, href: string, wrappedNode: ExtendedWrappedNode | null, wrappedOnClickNode: ExtendedWrappedNode | null): LinkData;
    prototype: LinkData;
  };

  interface FrameSearch {
    epoch: number;
    frameData: FrameData | null;
    windows: Window[] | null;
    start(epoch: number): void;
    stop(): void;
    result(browser: Browser, data: MessageData | {result: boolean}): void;
    next(tab?: Tab): void;
  }

  type importList = "BrowserUtils" | "ClickHandlerParent" | "E10SUtils" | "PlacesUIUtils" | "PrivateBrowsingUtils" | "LinkNodeUtils" | "TabmixSvc";
  type Lazy = Pick<KnownModulesImports, importList>;

  interface ContentClick {
    init(): void;
    onQuitApplication(): void;
    getParamsForLink(event: ContentClickEvent, linkNode: EventTarget, href: string, browser: Browser, focusedWindow: Window): LinkParams | null;
    contentLinkClick(event: ContentClickEvent, browser: Browser, focusedWindow: mozIDOMWindowProxy): void;
    isGreasemonkeyInstalled(window: Window): void;
    isLinkToExternalDomain(curpage: string, url: string): boolean;
    isUrlForDownload(url: string): boolean;
    selectExistingTab(window: Window, href: string | null | undefined, targetAttr: string): void;
  }

  interface ContentClickInternal extends ContentClick {
    _browser: Browser | null;
    _data: LinkData;
    _timer: any | null;
    _initialized: boolean;
    _window: Window | null;
    currentTabLocked?: boolean;
    frameSearchEpoch: number;
    frameSearch: Map<number, FrameSearch>;
    functions: string[];
    targetPref?: number;

    initContentAreaClick(): void;
    receiveMessage(message: ReceiveMessageArgument & {name: string; data: MessageData; target: Browser}): {where: "default" | "handled"} | LinkParams | null;
    getWrappedNode(node: EventTarget | ContentNode | null, focusedWindow: mozIDOMWindowProxy, getTargetIsFrame?: boolean): ExtendedWrappedNode | null;
    getHrefFromNodeOnClick(event: ContentClickEvent, browser: Browser, wrappedOnClickNode: ExtendedWrappedNode | null): boolean;
    _getParamsForLink(event: ContentClickEvent, wrappedNode: ExtendedWrappedNode | null, href: string | null | undefined, browser: Browser, fromContent?: boolean, wrappedOnClickNode?: ExtendedWrappedNode): LinkParams;
    resetData(): void;
    getPref(): void;
    getData(event: ContentClickEvent, href: string | null | undefined, node: ExtendedWrappedNode, wrappedNode: ExtendedWrappedNode | null): void;
    whereToOpen(event: ContentClickEvent, href: string | null | undefined, wrappedNode: ExtendedWrappedNode | null, wrappedOnClickNode?: ExtendedWrappedNode): [string, boolean?];
    _contentLinkClick(aEvent: ContentClickEvent, aBrowser: Browser, aFocusedWindow: mozIDOMWindowProxy): void;
    miscellaneous(node: ExtendedWrappedNode | ContentClickLinkElement): boolean;
    isGreasemonkeyScript(href: string | null | undefined): boolean;
    suppressTabsOnFileDownload(): boolean;
    divertMiddleClick(): boolean;
    divertTargetedLink(): boolean;
    openExSiteLink(): boolean;
    openTabfromLink(): boolean | null;
    GoogleComLink(): boolean;
    isFrameInContent(windows: Window[], frameData: FrameData, isMultiProcess: boolean): void;
    checkAttr(attr: string | null | undefined, string: string): boolean;
    checkOnClick(more?: boolean): boolean;
    getHrefFromOnClick(event: ContentClickEvent, href: string | null | undefined, wrappedNode: ExtendedWrappedNode | ContentClickLinkElement | null, onclick: string | null): string | null;
    _hrefFromOnClick(href: string | null | undefined, node: ContentClickLinkElement | ExtendedWrappedNode["parentNode"] | null, onclick: string, result: {__hrefFromOnClick: string | null}): void;
  }
}

declare namespace ContentSvcModule {
  type Lazy = Pick<KnownModulesImports, "isVersion">;
}

declare namespace ContextMenuModule {
  type Lazy = Pick<KnownModulesImports, "TabmixUtils">;
}

declare namespace DocShellCapabilitiesModule {
  type Lazy = Pick<KnownModulesImports, "TabState" | "TabStateCache">;

  interface CapabilitiesData {
    disallow?: string;
    reload?: boolean;
  }

  interface MenuItem extends Omit<Node, "parentNode"> {
    value: string;
    parentNode: {childNodes: HTMLCollectionBase_G<MenuItem>};
  }

  interface DocShellCapabilities {
    init(): void;
    update(browser: Browser, data: CapabilitiesData): void;
    collect(tab: Tab): string[] | "";
    restore(tab: Tab, disallow: string, reload: boolean): void;
    onGet(nodes: HTMLCollectionBase_G<MenuItem>, tab: Tab): void;
    onSet(tab: Tab, node: MenuItem): void;
  }
}

declare namespace DownloadLastDirModule {
  interface DownloadLastDir {
    _initialized: boolean;
    init(): void;
  }
}

declare namespace DynamicRulesModule {
  interface Lazy extends Pick<KnownModulesImports, "TabmixSvc"> {
    Prefs: MockedGeckoTypes._nsIPrefBranch;
    SSS: nsIStyleSheetService;
  }

  interface StyleRule {
    text?: string;
    bg?: string;
  }

  interface DefaultPrefs {
    currentTab: string;
    unloadedTab: string;
    unreadTab: string;
    otherTab: string;
    progressMeter: string;
  }

  type RuleName = keyof DefaultPrefs;

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

  interface DynamicRules {
    cssTemplates: Record<RuleName, StyleRule>;
    styles: Record<string, StyleRule | null>;
    registered: Record<string, any>;
    _initialized: boolean;
    orient: string;
    windows10: boolean;
    tabState: {[key: string]: string};
    init(aWindow: Window): void;
    observe(subject: unknown, topic: string, data: string): void;
    registerMutationObserver(window: ChromeWindow): void;
    onPrefChange(data: string): void;
    onQuitApplication(): void;
    updateOpenedWindows(ruleName: RuleName): void;
    getSelector(name: string, rule: string): string;
    createTemplates(): void;
    userChangedStyle(ruleName: RuleName, notifyWindows?: boolean): void;
    updateStyles(name: RuleName, prefObj: TabStyle): void;
    updateStyleType(): void;
    registerSheet(name: string): void;
    unregisterSheet(name: string): void;
    _defaultPrefs: DefaultPrefs;
    defaultPrefs: DefaultPrefs;
    handleError(error: unknown, ruleName: RuleName): void;
    validatePrefValue(ruleName: RuleName): TabStyle;

    [key: string]: any;
  }

  // buttonColorProcessor
  interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
  }

  interface HSLA {
    h: number;
    s: number;
    l: number;
    a: number;
  }

  interface ButtonColors {
    topColor: string;
    bottomColor: string;
  }

  interface ColorInput {
    bgColor: string;
    bgTopColor: string;
  }

  interface ButtonColorProcessor {
    getButtonColors(colors: ColorInput, value?: number): ButtonColors;
    parseRgba(rgbaString: string): RGBA | null;
    rgbaToHsla(rgba: RGBA): HSLA;
    darkenRgba(rgba: RGBA, amount: number): HSLA;
    hslaToString(hsla: HSLA): string;
    processColor(color: string, value: number): string;
  }

  const ButtonColorProcessor: ButtonColorProcessor;
}

declare namespace FloorpModule {
  type Lazy = {prefs: MockedExports.Preferences};

  interface Floorp {
    _initialized: boolean;
    init(): void;
    observe(subject: unknown, topic: string, data: string): void;
    onPrefChange(data: string): void;
    onQuitApplication(): void;
  }
}

// for LinkNodeUtils.sys.mjs and content.js
declare namespace LinkNodeUtilsModule {
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
    isFrameInContent(content: Window, href: string | null | undefined, name: string): boolean;
    wrap(node: ContentClickLinkElement | WrappedNode | null, focusedWindow: Window, getTargetIsFrame?: boolean): ContentClickLinkElement | WrappedNode | null;
    getNodeWithOnClick(node: ContentClickLinkElement | null): ContentClickLinkElement | null;
    isSpecialPage(href: string | null, linkNode: ContentClickLinkElement | null, currentHref: string, window?: Window): boolean;
    isGMEnabled(window?: Window | null): boolean;
    _GM_function: WeakMap<Window, () => boolean>;
  }

  function getAttributes(node: Element | null, attribs: string[]): Record<string, string>;
  function getTargetAttr(targetAttr: string, focusedWindow: Window): string;
  function targetIsFrame(targetAttr: string | null, focusedWindow: Window): boolean;
  function existsFrameName(content: Window, targetFrame: string): boolean;
}

// add missing types
interface Error {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

declare namespace LogModule {
  type Lazy = Pick<KnownModulesImports, "ContentSvc">;

  interface CustomError extends Error {
    filename?: string;
  }

  type Caller = nsIStackFrame | CustomError;
  type ShowMethod = ((...args: unknown[]) => unknown) | {obj: Record<string, unknown>; name: string; fullName: string} | string;

  interface Console {
    _char: string;
    _formatStack(stack: string[]): string;
    _getNames(aCount?: number, stack?: string): string[];
    _getStackExcludingInternal(stack?: string): string[];
    _logMessage(msg: string, flag: string, caller?: Caller | nsIException): void;
    _name(fn: string): string;
    _pathRegExp: RegExp;
    _timers: Record<number, nsITimer & {clear(): void}>;

    columnNumber?: number;
    filename?: string;
    lineNumber?: number;

    assert(aError: unknown, aMsg?: string): void;
    readonly caller: nsIStackFrame;
    callerName(): string | null;
    callerTrace(): {contain(...names: (string | string[])[]): boolean};
    callerTrace(...args: (string | string[])[]): boolean;
    clog(aMessage: string, caller?: Caller): void;
    error(error: unknown, msg?: string): Error;
    getCallerNameByIndex(aIndex: number): string | null;
    getObject(aWindow: Window | null | undefined, aMethod: string): object | {toString(): string};
    log(aMessage: string, aShowCaller?: boolean, offset?: number | boolean, caller?: Caller): void;
    obj(aObj: Record<string, any>, aMessage?: string, aDisallowLog?: boolean, level?: boolean | string): void;
    reportError(ex: unknown, msg?: string, filter?: string): void;
    show(aMethod: ShowMethod, aDelay?: number, aWindow?: Window): void;
    trace(aMsg: string, flag?: string, caller?: Caller): void;
    [key: string]: unknown;
  }
}

declare namespace MergeWindowsModule {
  type importList = "BrowserWindowTracker" | "PrivateBrowsingUtils" | "PromiseUtils" | "SessionStore";
  type Lazy = Pick<KnownModulesImports, importList>;

  interface MergeOptions {
    multiple: boolean;
    normalWindowsCount: number;
    private: boolean;
    privateNotMatch: boolean;
    skipPopup: boolean;
    tabsSelected: boolean;
  }

  interface WindowsList {
    windows: ChromeWindow[];
    normalWindowsCount: number;
  }

  interface BrowserTab extends Tab {
    __tabmixTabBrowser?: TabBrowser;
    _tabmix_movepopup_promise?: {
      promise: Promise<Tab | null>;
      resolve: (value: Tab | null) => void;
      reject: (reason?: any) => void;
    };
  }

  interface MergeWindows {
    prefs: nsIPrefBranchXpcom;
    mergeWindows(aWindow: ChromeWindow): void;
    mergeTwoWindows(aTargetWindow: ChromeWindow, aWindow: ChromeWindow, aTabs: Tab[], aOptions: MergeOptions): void;
    mergeMultipleWindows(aTargetWindow: ChromeWindow, aWindows: ChromeWindow[], aOptions: MergeOptions): void;
    mergePopUpsToNewWindow(aWindows: Window[], aPrivate: boolean): void;
    concatTabsAndMerge(aTargetWindow: ChromeWindow, aWindows: Window[]): void;
    moveTabsFromPopups(tab: BrowserTab, openerID: number | undefined, tabbrowser?: TabBrowser): void;
    swapTabs(aWindow: ChromeWindow, tabs: BrowserTab[]): Promise<void>;
    isPopupWindow(aWindow: ChromeWindow): boolean;
    isWindowPrivate(aWindow: ChromeWindow): boolean;
    getWindowsList(aWindow: ChromeWindow, aOptions: MergeOptions): WindowsList;
    notify(aWindow: ChromeWindow, privateNotMatch: boolean): void;
    warnBeforeClosingWindow(aWindow: ChromeWindow): boolean;
  }
}

declare namespace NewTabURLModule {
  type Lazy = Pick<KnownModulesImports, "AboutNewTab">;
  interface NewTabURL {
    QueryInterface: MozQueryInterface;
    init(): void;
    observe(aSubject: unknown, aTopic: string, aData: string): void;
    updateNewTabURL(): void;
  }
}

declare namespace OverlaysModule {
  type importList = "isVersion" | "setTimeout";
  type Lazy = Pick<KnownModulesImports, importList>;

  type ChromeManifest = TabmixModules.ChromeManifest;
  type Listener = EventListener | FunctionWithUnknown;
  type DeferredLoad = {listener: Listener; useCapture: boolean}[];

  interface Overlays {
    _decksToResolve: Map<Element, string>;
    _toolbarsToResolve: Element[];
    deferredLoad: DeferredLoad;
    location: string;
    overlayProvider: ChromeManifest;
    persistedIDs: Set<string>;
    unloadedScripts: Element[];
    window: Window;
    readonly document: Document;
    constructor(overlayProvider: ChromeManifest, window: Window): void;
    load(urls: string | string[]): Promise<void>;
    _update(url: string, doc: Document): void;
    _finish(): void;
    _collectOverlays(doc: Document): string[];
    _fireEventListener(listener: EventListener | FunctionWithUnknown): void;
    _resolveForwardReference(node: Element): boolean;
    _insertElement(parent: Element, node: Element): void;
    _mergeElement(parent: Element, node: Element): void;
    fetchOverlay(url: string): Promise<Document>;
    loadScript(script: Element): DeferredLoad;
    loadCSS(sheet: string): void;
    _xpathToNodes(result: XPathResult): Node[];
  }

  interface OverlaysClass {
    prototype: Overlays;
    load(overlayProvider: ChromeManifest, window: Window): Promise<void>;
    new (overlayProvider: ChromeManifest, window: Window): Overlays;
    isInstance: IsInstance<Overlays>;
  }
  const OverlaysClass: OverlaysClass;
}

declare namespace PlacesModule {
  type importList = "BrowserUtils" | "BrowserWindowTracker" | "OpenInTabsUtils" | "PlacesUIUtils" | "PlacesUtils" | "PrivateBrowsingUtils" | "initializeChangeCodeClass";
  type Lazy = Pick<KnownModulesImports, importList>;
  type FunctionsName = "openTabset" | "openNodeWithEvent" | "_openNodeIn";
  type TabmixFunctionsName = `tabmix_${FunctionsName}` | `__treestyletab__${FunctionsName}` | FunctionsName;
  type Callback = (url: string) => string | null | Promise<string | null>;

  function updateOpenTabset(name: "openTabset" | "__treestyletab__openTabset", treeStyleTab?: boolean): void;

  type PlacesUtils = Readonly<{
    init(aWindow: Window): void;
    onQuitApplication(): void;
    applyCallBackOnUrl(aUrl: string, aCallBack: Callback): Promise<string | null>;
    getTitleFromBookmark(aUrl: string, aTitle: string, titlefrombookmark?: boolean): Promise<string>;
    asyncGetTitleFromBookmark(url: string, title: string, titlefrombookmark?: boolean): Promise<string>;
  }>;

  interface PlacesUtilsInternal extends Omit<PlacesUtils, "getTitleFromBookmark"> {
    __index: number;
    _initialized: boolean;
    _timer: nsITimer | null;
    _removeObserver?: () => void;
    functions: readonly FunctionsName[];

    initPlacesUIUtils(aWindow: Window, sandbox: TabmixSandbox): void;
    fetch: MockedGeckoTypes.BookmarksService["fetch"];
    getBookmarkTitle(url: string): Promise<string | null>;
    readonly titlefrombookmark: boolean;
  }

  interface ExtraPlacesUIUtils {
    openNodeWithEvent(aNode: Node, aEvent: MouseEvent | KeyboardEvent): void;
    _openNodeIn(aNode: Node, aWhere: WhereToOpen, aWindow: Window, options?: {aPrivate: false; userContextId: number}): void;
    tabmix_openNodeWithEvent: ExtraPlacesUIUtils["openNodeWithEvent"];
    tabmix_openTabset: MockedGeckoTypes.PlacesUIUtils["openTabset"];
    tabmix__openNodeIn: ExtraPlacesUIUtils["_openNodeIn"];
    __treestyletab__openTabset: MockedGeckoTypes.PlacesUIUtils["openTabset"];
    __treestyletab__openNodeWithEvent?: ExtraPlacesUIUtils["openNodeWithEvent"];
  }
}

declare namespace TabContextConfigModule {
  type PrefList = {
    [id: string]: [string, boolean?];
  };

  type AppName = "waterfox" | "zen" | "firefox" | "floorp";
  type Forks = "waterfox" | "zen" | "floorp";
  type ForkItems = Record<AppName, TabContextConfigModule.PrefList>;

  type Exports = {
    prefList: PrefList;
    selectors: Record<string, string>;
    forksExtraIds: string[];
  };
}

declare namespace RenameTabModule {
  type Lazy = Pick<KnownModulesImports, "TabmixPlacesUtils">;

  type RenameEventListener = ((event: RenameEvent) => void) | {handleEvent(event: RenameEvent): void};
  interface RenameTabPanel extends Omit<CustomXULPanel, "addEventListener" | "removeEventListener"> {
    addEventListener(type: string, listener: RenameEventListener | null, options?: AddEventListenerOptions | boolean, wantsUntrusted?: boolean | null): void;
    removeEventListener(type: string, listener: RenameEventListener | null, options?: EventListenerOptions | boolean): void;
  }

  interface Target extends RenameTabPanel {
    checked: boolean;
    value: string;
  }

  interface RenameEvent extends Omit<MouseEvent | InputEvent | Event, "target" | "originalTarget">, Omit<KeyboardEvent, "target" | "originalTarget"> {
    target: Target;
    originalTarget: Target;
  }

  interface RenameTab {
    window: ChromeWindow;
    panel: RenameTabPanel;
    data: {tab: Tab; url: string; docTitle: string; value: string; modified: string | null; permanently: boolean};
    _element<K extends keyof GetByMap | string>(selectors: K): GetElementByIdOverride<K>;
    editTitle(aTab: Tab): void;
    observe(aSubject: null, aTopic: string): void;
    showPanel(): void;
    hidePopup(): void;
    handleEvent(event: RenameEvent): void;
    handleCommand(event: RenameEvent): void;
    onpopupshown(aEvent: RenameEvent): void;
    onpopuphidden(aEvent: RenameEvent): void;
    onNewTitle(aTitle: string): void;
    resetTitle(): void;
    update(aReset?: boolean): void;
    _doShowPanel(): void;
  }
}

declare namespace ScriptsLoaderModule {
  type importList = "CustomizableUI" | "PrivateBrowsingUtils" | "SessionStore" | "isVersion" | "Overlays";
  type Lazy = Pick<KnownModulesImports, importList>;

  type Params = {chromeManifest: TabmixModules.ChromeManifest; isOverflow: boolean; isEnabled: boolean};

  interface ScriptsLoader {
    initForWindow: (window: Window, promiseOverlayLoaded: Promise<void>, params?: Params) => void;
    _closeButtonAdded: boolean;
    _addCloseButton(): void;
    _loadCSS(window: Window): void;
    _loadScripts(window: Window, promiseOverlayLoaded: Promise<void>): void;
    _addListeners(window: Window): void;
    _prepareBeforeOverlays(window: Window): void;
    _updateAfterEnabled(window: Window, params: Params): Promise<void>;
  }
}

declare namespace ShortcutsModule {
  interface KeyElement extends Element {
    _id: string;
    oncommand?: () => void;
    ownerGlobal: WindowProxy;
  }
  type ShortcutKey = {modifiers: string; key: string; keycode: string; disabled?: boolean};
  type ShortcutData = {id?: string; default?: string; command?: number | ((tab: Tab) => void); label?: string; value?: string; reserved?: boolean; useInMenu?: boolean};

  type ShortcutsKeysImport = typeof import("../addon/modules/Shortcuts.sys.mjs").ShortcutsKeys;
  type ListOfKeys = keyof ShortcutsKeysImport;
  type ShortcutsKeys = {[key in ListOfKeys]: ShortcutData};

  type ShortcutValues = {[k in ListOfKeys]: string} | Record<string, never>;
  type ShortcutEntries = [ListOfKeys, string][];
  type KeysEntries = [ListOfKeys, ShortcutData][];

  interface Shortcuts {
    KeyboardEvent: string[];
    keys: {
      clearClosedTabs: ShortcutData;
      browserReload: ShortcutData;
      slideShow: ShortcutData;
      togglePinTab: ShortcutData;
      undoCloseTab: ShortcutData;
      [key: string]: ShortcutData;
    };
    prefs: nsIPrefBranchXpcom;
    prefsChangedByTabmix: boolean;
    updatingShortcuts: boolean;
    prefBackup: ShortcutValues;
    initialized: boolean;
    keyConfigInstalled: boolean;

    initService(aWindow: Window): void;
    _setReloadKeyId(aWindow: Window): void;
    observe(aSubject: nsISupports, aTopic: string, aData: string): void;
    onPrefChange(aData: string): void;
    handleEvent(aEvent: any): void;
    onCommand(aKey: KeyElement): void;
    onUnload(aWindow: Window): void;
    onWindowOpen(aWindow: Window): void;
    updateWindowKeys(aWindow: Window, aKeys: Record<string, ShortcutData>): void;
    _updateKey(aWindow: Window, aKey: string, aKeyData: ShortcutData): void;
    _getChangedKeys(options: {onChange?: boolean; onOpen?: boolean}): [Record<string, ShortcutData>, number];
    _getShortcutsPref(): ShortcutValues;
    _userChangedKeyPref(value: string): string;
    setShortcutsPref(): void;
    keyParse(value?: string): ShortcutKey;
    keyStringify(value: ShortcutKey): string;
    validateKey(key: ShortcutKey): string;
    getFormattedKey(key?: ShortcutKey | null): string;
    getFormattedKeyForID(id: string): string;
    getPlatformAccel(): string;
  }

  interface KeyConfig {
    prefsChangedByTabmix: boolean;
    keyIdsMap: {[key: string]: ListOfKeys};
    prefs: nsIPrefBranchXpcom;
    init(): void;
    deinit(): void;
    observe(aSubject: any, aTopic: string, aData: string): void;
    syncFromKeyConfig(aKey: ListOfKeys, aPrefName: string, aShortcuts: Record<string, string>): boolean;
    syncToKeyConfig(aChangedKeys: Record<string, string | ShortcutData>, onChange?: boolean): void;
    resetPref(prefName: string): void;
  }

  type PlatformKeys = {[key: string]: string};
  function getPref(name: string): string;
  function setPref(name: string, value: string): void;
  function getPlatformKeys(key: string): string;
}

declare namespace SlideshowModule {
  type Lazy = Pick<KnownModulesImports, "Shortcuts">;

  interface Flst {
    tabContainer: MockedGeckoTypes.TabContainer;
    slideShowTimer?: nsITimer;

    showAlert(msg: string, id: string): void;
    toggle(): void;
    toggleSlideshow(): void;
    notify(this: SlideshowModule.Flst): void;
    cancel(): void;
    get moreThenOneTab(): boolean;
  }
}

declare namespace TabmixSvcModule {
  type importList = "BrowserUtils" | "FloorpPrefsObserver" | "isVersion" | "SessionStore" | "SyncedTabs" | "TabmixPlacesUtils";
  interface Lazy extends Pick<KnownModulesImports, importList> {
    Platform: string;
  }

  interface TabmixSvc {
    readonly aboutBlank: string;
    readonly aboutNewtab: string;
    readonly isCyberfox: boolean;
    readonly isFloorp: boolean;
    readonly isLinux: boolean;
    readonly isMac: boolean;
    readonly isWaterfox: boolean;
    readonly isWindows: boolean;
    readonly isZen: boolean;
    readonly _strings: nsIStringBundle;
    readonly console: LogModule.Console;
    readonly prefs: MockedExports.Preferences;
    readonly prefBranch: nsIPrefBranchXpcom;

    blockedClickingOptions: number[];
    forEachBrowserWindow: (aFunc: (window: Window) => void) => void;
    getDialogStrings: (...keys: string[]) => string[];
    topWin: () => Window;
    getFormattedString: (aStringKey: string, aStringsArray: string[]) => string;
    getSingleWindowMode: () => boolean;
    getString: (key: string) => string;
    i10IdMap: I10Map;
    isFixedGoogleUrl: (url: string) => boolean;
    isGlitterInstalled?: boolean;
    newtabUrl: string;
    setCustomTabValue: (tab: Tab, key: string, value?: unknown) => void;
    setLabel: (property: string) => string;
    skipSingleWindowModeCheck: boolean;
    sm: {
      TAB_STATE_NEEDS_RESTORE: number;
      TAB_STATE_RESTORING: number;
    };
    tabStylePrefs: {
      [K in DynamicRulesModule.RuleName]: DynamicRulesModule.TabStyle;
    };
    URILoadingHelperChanged: boolean;
    version: BrowserVersion;
    windowStartup: {
      QueryInterface: MozQueryInterface;
      _initialized: boolean;
      init(aWindow: Window): void;
      addMissingPrefs(): void;
      observe(subject: nsISupports, topic: string, data: string): void;
    };
  }
}

declare namespace TabmixUtilsModule {
  type importList = "E10SUtils" | "NetUtil" | "AutoReload" | "DocShellCapabilities" | "MergeWindows" | "TabmixSvc";
  type Lazy = Pick<KnownModulesImports, importList>;
  interface TabmixUtils {
    initMessageManager(window: Window): void;
    deinit(window: Window): void;
    receiveMessage(message: ReceiveMessageArgument & {target: Browser}): boolean | null;
    focusedWindow(content: Window): Window;
    makeInputStream(aString: string): nsIInputStream;
    getPostDataFromHistory(sessionHistory: nsISHistory | null): {isPostData: boolean; postData: string | null; referrerInfo: string | null};
    updateHistoryTitle(legacySHistory: nsISHistory, title: string): void;
  }
}

declare namespace TabmixWidgetsModule {
  type importList = "CustomizableUI" | "isVersion";
  type Lazy = Pick<KnownModulesImports, importList>;

  interface WidgetElement extends Omit<HTMLElement, "HTMLCollection"> {
    firstChild: HTMLElement;
    children: HTMLCollection & [HTMLButtonElement, HTMLElement];
    ownerGlobal: WindowProxy;
  }

  function onBuild(node: WidgetElement, document?: Document): void;

  type Widget = {
    id: string;
    localizeFiles: string[];
    readonly markup: string;
    onBuild: typeof onBuild;
    readonly updateMarkup?: string;
  };

  interface TabmixWidgets {
    create(): void;
    destroy(uninstall?: boolean): void;
  }

  interface TabDragEvent extends Omit<DragEvent, "target"> {
    target: HTMLButtonElement;
  }
  interface UndocloseTabButtonObserver {
    onDragOver(aEvent: TabDragEvent): boolean;
    onDragExit(aEvent: TabDragEvent): void;
    onDrop(aEvent: TabDragEvent): void;
  }
}

declare namespace VerticalTabsModule {
  type importList = "setTimeout" | "TabmixSvc";
  type Lazy = Pick<KnownModulesImports, importList>;
  interface VerticalTabs {
    _initialized: boolean;
    init(aWindow: Window): void;
    observe(subject: unknown, topic: string, data: string): void;
    onPrefChange(data: string): void;
    toggleTabstrip(window: Window): void;
    onQuitApplication(): void;
  }
}

// export Tabmix modules

declare module "chrome://tabmix-resource/content/bootstrap/Overlays.sys.mjs" {
  export class Overlays extends OverlaysModule.OverlaysClass {}
}

declare module "chrome://tabmix-resource/content/BrowserVersion.sys.mjs" {
  export function isVersion(versionNo: versionInfo, updateChannel?: string | null): boolean;
}

declare module "chrome://tabmix-resource/content/Changecode.sys.mjs" {
  const initializeChangeCodeClass: typeof ChangecodeModule.initializeChangeCodeClass;
  export {initializeChangeCodeClass};
}

declare module "chrome://tabmix-resource/content/ChromeUtils.sys.mjs" {
  const TabmixChromeUtils: TabmixModules.ChromeUtils;
  export {TabmixChromeUtils};
}

declare module "chrome://tabmix-resource/content/bootstrap/ChromeManifest.sys.mjs" {
  const ChromeManifest: TabmixModules.ChromeManifestClass;
  export {ChromeManifest};
}

declare module "chrome://tabmix-resource/content/Floorp.sys.mjs" {
  export interface FloorpPrefsObserver {
    init(): void;
    observe(subject: unknown, topic: string, data: string): void;
  }
}

declare module "chrome://tabmix-resource/content/log.sys.mjs" {
  const console: LogModule.Console;
  export {console};
}

declare module "chrome://tabmix-resource/content/TabContextConfig.sys.mjs" {
  const TabContextConfig: TabContextConfigModule.Exports;
  export {TabContextConfig};
}

declare module "chrome://tabmix-resource/content/SyncedTabs.sys.mjs" {
  export interface SyncedTabs {
    init(window: Window): void;
    observe(subject: unknown, topic: string, data: string): void;
    onQuitApplication(): void;
  }
}

declare module "chrome://tabmix-resource/content/TabmixSvc.sys.mjs" {
  const TabmixSvc: TabmixSvcModule.TabmixSvc;
  export {TabmixSvc};
}

// add here only properties that are used internally by one of our models
interface TabmixGlobal {
  _afterTabduplicated?: boolean;
  firstWindowInSession?: boolean;
  isAfterSSWindowRestored?: boolean;

  // from changedcode
  _debugMode: boolean;
  _sandbox: TabmixSandbox;
  changeCode(this: TabmixGlobal, parent: Record<string, any>, fnName: string, options?: ChangecodeModule.Options): ChangecodeModule.ChangeCodeClass;
  nonStrictMode(obj: Record<string, any>, fn: string, arg?: any): void;
  setNewFunction(obj: Record<string, any>, name: string, aCode: FunctionWithAny): void;
  getSandbox(this: TabmixGlobal, obj: object, options?: ChangecodeModule.SandboxOptions): TabmixSandbox;
  makeCode(this: TabmixGlobal, code: string, obj: Record<string, any> | null, fullName: string, sandbox?: TabmixSandbox): FunctionWithAny;
  getPrivateMethod<T extends keyof PrivateMethods>(options: PrivateMethodOptions<T>): PrivateMethods[T];
  removedShortcuts: HTMLDivElement;

  gIeTab: TabmixGlobals.gIeTab;
}

declare namespace TabmixModules {
  type BrowserVersionLazy = Partial<{isWaterfox: boolean; isFloorp: boolean; isZen: boolean}>;

  class DefaultMap<K, V> extends Map<K, V> {
    constructor(_default: () => V, iterable?: Iterable<[K, V]>);
    _default: () => V;
    get(key: K, create?: boolean): V;
  }

  interface ChromeManifest {
    parse: (filename?: string, base?: string) => Promise<void>;
    overlay: DefaultMap<string, string[]>;
    style: DefaultMap<string, string[]>;
  }

  interface ChromeManifestClass {
    prototype: ChromeManifest;
    new (loader?: (url: string) => string, options?: Record<string, unknown>): ChromeManifest;
    isInstance: IsInstance<ChromeManifest>;
  }

  interface ChromeUtils {
    defineLazyGetter(aTarget: any, aName: any, aLambda: () => any): void;
    import<S extends keyof TabmixKnownModules>(module: S): TabmixKnownModules[S];
    defineLazyModuleGetters(aObject: object | Record<string, unknown>, aModules: Record<string, string>): void;
  }

  interface ContentSvc {
    _strings: nsIStringBundle;
    readonly aboutNewtab: "about:newtab";
    getString: (key: string) => string;
    prefBranch: nsIPrefBranchXpcom;
    version: BrowserVersion;
  }

  interface WindowParams extends LoadURIOptions {
    allowInheritPrincipal?: boolean;
    allowThirdPartyFixup?: boolean;
    forceAboutBlankViewerInCurrent: boolean;
    fromExternal: boolean;
    originPrincipal: nsIPrincipal;
    originStoragePrincipal: nsIPrincipal;
    userContextId?: number;
  }

  interface SingleWindowModeUtils {
    getBrowserWindow(aExclude: Window): Window | null;
    newWindow(aWindow: Window): boolean;
    restoreDimensionsAndPosition(newWindow: Window & {__winRect?: WindowRect}, restorePosition?: boolean): void;
    onLoad(newWindow: Window): void;
  }

  type SyncedTabsFunctionsName = "onClick" | "onOpenSelected" | "adjustContextMenu" | "onOpenSelectedFromContextMenu";
  type SyncedTabsTabmixFunctionsName = `tabmix_${SyncedTabsFunctionsName}`;
  interface SyncedTabs {
    _initialized: boolean;
    functions: readonly SyncedTabsFunctionsName[];
    init(window: Window): void;
    onQuitApplication(): void;
    tabListView(): void;
  }
}

// global helpers
declare namespace TabmixGlobals {
  type checkForCtrlClick = (event: PopupEvent) => void;
  type handleButtonEvent = (event: ButtonEvent) => void;
  interface ButtonEvent extends Omit<MouseEvent, "target"> {
    target: HTMLButtonElement;
  }
  interface Popup extends PopupElement {
    _tab: Tab;
    initialized: boolean;
    listenersAdded: boolean;
    ownerGlobal: WindowProxy;
  }
  interface PopupEvent extends Omit<MouseEvent, "target" | "originalTarget"> {
    target: Menuitem;
    originalTarget: Menuitem;
  }

  interface CustomPanelView extends HTMLElement {
    lastChild: HTMLMenuElement;
    menupopup: PopupElement;
    panelMultiView: HTMLElement & {
      goBack(): void;
    };
  }

  interface Menuitem extends Omit<HTMLMenuElement, "parentNode"> {
    readonly parentNode: PopupElement;
    readonly triggerNode: Menuitem;
    menupopup: PopupElement;
    value: number;
    // extra props for popup menus
    _tabmix_middleClicked?: boolean;
    closedGroup?: null;
    mCorrespondingMenuitem?: Menuitem | null;
    ownerGlobal: WindowProxy;
    remove(): void;
    tab: Tab;
  }

  interface ScrollBox extends Menuitem {
    ensureElementIsVisible: (item: Menuitem) => void;
  }

  interface PopupElement extends Omit<HTMLElement, "childNodes" | "parentNode" | "firstChild" | "lastChild"> {
    hasStatusListener?: boolean;
    readonly childNodes: HTMLCollectionBase_G<Menuitem>;
    readonly firstChild: Menuitem;
    readonly lastChild: Menuitem;
    openPopup: OpenPopup;
    readonly parentNode: CustomPanelView;
    panelMultiView: HTMLElement & {
      goBack(): void;
    };
    scrollBox: ScrollBox;
    readonly triggerNode: Menuitem;
    dataset: {
      command?: string;
      popup?: string;
    };
    // from XULPopupElement
    moveTo(left: number, top: number): void;
    openPopupAtScreen(x?: number, y?: number, isContextMenu?: boolean, triggerEvent?: Event | null): void;
  }

  type gIeTab = {obj: "gIeTab2" | "gIeTab"; folder: "ietab2" | "ietab"};
}

declare var SessionStore: SessionStoreNS.SessionStoreApi;
declare var ContentSvc: TabmixModules.ContentSvc;
declare var TabmixUtils: TabmixUtilsModule.TabmixUtils;
