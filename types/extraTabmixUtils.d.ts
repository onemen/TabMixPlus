type DefferedPromise = {promise: Promise<void>; resolve: () => void; reject: () => void};

declare namespace TabmixNS {
  // from changedcode
  // TODO: fix returned type
  const _debugMode: boolean;
  const _localMakeCode: string;
  function _makeCode(name: string | null, code: string): typeof Function;
  function changeCode(aParent: any, afnName: string, aOptions: any): any;
  function nonStrictMode(aObj: any, aFn: any, aArg: any): void;
  function setNewFunction(aObj: any, aName: string, aCode: string): void;
  // TODO: check if it's needed
  function toCode(): any;

  // tabmix.js
  let _lastTabOpenedTime: number;
  let _deferredInitialized: DefferedPromise;
  let afterTabsButtonsWidth: number[];
  const initialization: typeof TabmixInitialization;
  let isFirstWindow: boolean;
  let selectedTab: MockedGeckoTypes.BrowserTab;
  const singleWindowMode: boolean;
  let tabsNewtabButton: HTMLButtonElement;
  let userTypedValue: string;
  function afterDelayedStartup(): void;
  function beforeDelayedStartup(): void;
  function getAfterTabsButtonsWidth(): void;
  function sessionInitialized(): void;
  function startup(): void;

  // click.js
  function openInverseLink(ev: any): void;
  let allTabs: typeof AllTabs;

  // minit.js
  let navToolbox: typeof NavToolbox;
  function getStyle(aObj: any, aStyle: string): number;

  // session.js
  const CHECKBOX_CHECKED: number;

  // sessionStore.js
  const closedObjectsUtils: typeof ClosedObjectsUtils;

  // setup.js
  let _callPrepareLoadOnStartup: boolean;
  function prepareLoadOnStartup(uriToLoad?: string | string[]): void;

  // tab.js
  let contextMenuLinks: HTMLLinkElement[];
  let tabsUtils: typeof TabsUtils;

  // userinterface.js
  let handleTabbarVisibility: typeof HandleTabbarVisibility;
  function setTabStyle(aTab: MockedGeckoTypes.BrowserTab, boldChanged?: boolean): void;
}

declare namespace AllTabs {
  function init(): void;
}

declare namespace ClosedObjectsUtils {
  function init(): void;
  function toggleRecentlyClosedWindowsButton(): void;
}

declare namespace HandleTabbarVisibility {
  function toggleEventListener(enable: boolean): void;
}

declare namespace NavToolbox {
  function init(): void;
}

type InitializationStep = {id: number; obj: string};
declare namespace TabmixInitialization {
  const init: InitializationStep;
  const beforeStartup: InitializationStep;
  const onContentLoaded: InitializationStep;
  const beforeBrowserInitOnLoad: InitializationStep;
  const onWindowOpen: InitializationStep;
  const afterDelayedStartup: InitializationStep;
  // TODO: check if there is spacial type for getter in namespace
  function isValidWindow(): boolean;
  function run(aPhase: number): any;
}

declare namespace TabsUtils {
  const initialized: false;
  const _tabmixPositionalTabs: {
    beforeSelectedTab?: MockedGeckoTypes.BrowserTab;
    afterSelectedTab?: MockedGeckoTypes.BrowserTab;
    beforeHoveredTab?: MockedGeckoTypes.BrowserTab;
    afterHoveredTab?: MockedGeckoTypes.BrowserTab;
  };

  const getCollapsedState: {collapsed: boolean; toolbar: HTMLElement; tabBar: MockedGeckoTypes.TabContainer; toolbarCollapsed: boolean; tabBarCollapsed: boolean};
}
