/// <reference types="./tabmix.d.ts" />
/// <reference types="./extraTabmixUtils.d.ts" />

// add here types that apply only for browser windows scope

interface GetByMap {
  TabsToolbar: HTMLElement;
}

interface AppConstants {
  BROWSER_CHROME_URL: string;
  platform: string;
}

declare var ChromeManifest: {
  prototype: ChromeManifest;
  new (loader: (url: string) => string, options: Record<string, any>): ChromeManifest;
  isInstance: IsInstance<ChromeManifest>;
};

declare var Overlays: {
  prototype: Overlays;
  load(overlayProvider: ChromeManifest, window: Window): Promise<void>;
  new (overlayProvider: ChromeManifest, window: Window): Overlays;
  isInstance: IsInstance<Overlays>;
};

declare var AppConstants: AppConstants;
declare var TabmixSvc: TabmixModules.TabmixSvc;

interface Window {
  __SSi: string;
  _tabmix_windowIsClosing: boolean;
  _gBrowser: MockedGeckoTypes.TabBrowser;
  delayedStartupPromise: Promise<void>;
  BrowserCommands: any;
  ConfirmationHint: any;
  duplicateTabIn: (aTab: MockedGeckoTypes.BrowserTab, where: "tab" | "tabshifted" | "window", delta: number) => void;
  FillHistoryMenu: (event: Event) => void;
  gBrowser: MockedGeckoTypes.TabBrowser;
  gMiddleClickNewTabUsesPasteboard: boolean;
  gTMPprefObserver: gTMPprefObserver;
  isBlankPageURL: (aURL: string) => boolean;
  OpenBrowserWindow: (options: {private?: boolean; [key: string]: any}) => void;
  QueryInterface: (id: any) => any;
  restoreLastSession: () => void;
  ResizeObserver: typeof ResizeObserver;
  Services: typeof Services;
  SidebarController: {
    promiseInitialized: Promise<void>;
    readonly sidebarRevampEnabled: boolean;
  };
  Tabmix: typeof Tabmix;
  TabmixSessionManager: any;
  undoCloseTab: (aIndex?: number, sourceWindowSSId?: string, aWhere?: string) => MockedGeckoTypes.BrowserTab;
  URILoadingHelper: any;
  XULBrowserWindow: XULBrowserWindow;

  /** globals installed by extensions */
  bug489729: any;
  com: {
    tobwithu: any;
  };
  cookiepieContextMenu: any;
  colorfulTabs: {
    clrAllTabsPopPref: boolean;
    standout: any;
  };
  IeTab: any;
  ieview: {
    launch: any;
  };
  IeView: {
    ieViewLaunch: any;
  };
  InitializeOverlay_avg: {
    Init: any;
  };
  organizeSE: {
    doSearch: (...args: any[]) => any;
  };
  privateTab: {
    isTabPrivate: (selectedTab: MockedGeckoTypes.BrowserTab) => boolean;
    readyToOpenTab: (ready: boolean) => void;
  };
  SessionSaver: {
    snapBackTab: any;
    snapback_noFX: any;
    snapback_willFocus: any;
  };
  SwitchThemesModule: {
    windowsStates?: any[];
  };
  TabScope: {
    uninit: () => void;
    init: () => void;
  };

  /** @deprecated - removed from firefox on version 112 */
  _loadURI: any;
  /** @deprecated - removed from firefox on version 112 */
  BrowserOpenTab: (options: {event: Event; url: string}) => void;
  /** @deprecated - not in use since Firefox 112 */
  getTopWin: (params: any) => Window;
  /** @deprecated */
  gInPrintPreviewMode: boolean;
  /** @deprecated - removed from firefox on version 109 */
  PluralForm: any;
  /** @deprecated - not in use since Firefox 91 */
  whereToOpenLink: (e: Event, ignoreButton?: boolean, ignoreAlt?: boolean) => WhereToOpen;
}

/* Tabmix modules */

declare namespace TabmixTabClickOptionsNS {
  let _tabFlipTimeOut: any;
  let _blockDblClick: boolean;
  function isOverlayIcons(event: MouseEvent): boolean;
  function onTabClick(aEvent: any): void;
  function clearTabFlipTimeOut(): void;
  function onTabBarDblClick(aEvent: any): void;
  function clickAction(pref: any, clickOutTabs: any, aTab: any, event: any): void;
  function doCommand(command: any, aTab: any, clickOutTabs: any, event: any): boolean;
  function _tabMultiSelected(aTab: any): void;
  function _tabRangeSelected(aTab: any, cumul: any): void;
  function toggleEventListener(enable: any): void;
  /**
   * block dblclick on TabsToolbar when tabbar.dblclick_changesize is false
   * and tabbar.click_dragwindow is true
   */
  function blockDblclick(aEvent: any): void;
  /**
   * block mouse down with modifiers if the modifier is used by our clicking option
   */
  function blockMouseDown(event: any): boolean;
}
declare namespace TabmixContextNS {
  function buildTabContextMenu(): void;
  function updateTabbarContextMenu(show: any): void;
  function toggleEventListener(enable: any): void;
  function handleEvent(aEvent: any): void;
  function updateTabContextMenu(event: any): boolean;
  /**
   *  don't show 2 menuseparator together
   * this function is call by "popupshown" event
   * this is only for the case that other extensions popupshowing run after our TabmixContextMenu.updateTabContextMenu
   */
  function contextMenuShown(event: any, id?: any): void;
  function _prepareContextMenu(): void;
  function updateMainContextMenu(event: any): boolean;
  function _showAutoReloadMenu(menuId: any, pref: any, test: any): void;
  function openMultipleLinks(check: any): boolean;
  function updateSelectedTabsCount(itemOrId: any, isVisible: any): any;
}
declare namespace TabmixAllTabsNS {
  let _selectedItem: any;
  let _popup: any;
  let backupLabel: string;
  function handleEvent(aEvent: any): void;
  function checkForCtrlClick(aEvent: any): void;
  function isAfterCtrlClick(aButton: any): boolean;
  function createScrollButtonTabsList(event: any, side: any): void;
  function removeTabFromList(event: any, popup: any, aType: any): void;
  function showTabsListPopup(event: any): void;
  function createTabsList(popup: any, aType: any): boolean;
  function beforeCommonList(popup: any, aCloseTabsPopup: any): void;
  function createCommonList(popup: any, aType: any, side: any): void;
  function _ensureElementIsVisible(event: any): void;
  function createMenuItems(popup: any, tab: any, value: any): void;
  function _setMenuitemAttributes(aMenuitem: any, aTab: any, value: any): void;
  function _tabOnTabClose(aEvent: any): void;
  function _tabsListOncommand(aEvent: any): void;
  function _tabSelectedFromList(aTab: any): void;
  function hideCommonList(popup: any): void;
  function updateMenuItemActive(event: any, tab: any): void;
  function updateMenuItemInactive(): void;
  function updateStatusText(itemText: any): void;
}

type TabmixTabClickOptions = typeof TabmixTabClickOptionsNS;
type TabmixContext = typeof TabmixContextNS;
type TabmixAllTabs = typeof TabmixAllTabsNS;

// TODO: replace all any with its proper types
type TabmixSessionManager = any;
