/// <reference types="./tabmix.d.ts" />

// add here types that apply only for browser windows scope

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
