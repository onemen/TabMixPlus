declare namespace Bootstrap {
  function restartApplication(): boolean | undefined;
  function showRestartNotification(verb: string, window: Window): void;
  function install(data: {id: string}): Promise<void>;
  function uninstall(): void;
  function startup(data: {id: string}, reason: number): Promise<void>;
  function shutdown(data: {id: string}, reason: number): void;
}

type MainAction = {label: string; accessKey: string; callback: (info: {checkboxChecked: boolean; source: "button" | "esc-press" | "menucommand"}) => void; dismiss?: boolean; disabled?: boolean};
// to use more options see PopupNotifications.sys.mjs show method
type NotificationsOptions = {popupIconURL?: string; persistent?: boolean; hideClose?: boolean; timeout?: number; removeOnDismissal?: boolean};

interface PopupNotifications {
  _currentNotifications: HTMLElement[];
  show: (browser: MockedGeckoTypes.ChromeBrowser, id: string, message: string, anchorID: string | null, mainAction?: MainAction, secondaryActions?: MainAction[], options?: NotificationsOptions) => HTMLElement;
}

interface Window {
  _tabmix_windowIsClosing: boolean;
  gBrowser: MockedGeckoTypes.TabBrowser;
  PopupNotifications: PopupNotifications;
  Tabmix: TabmixGlobal;
}

declare var ADDON_ENABLE: number;
declare var ADDON_DOWNGRADE: number;
declare var ADDON_DISABLE: number;
declare var ADDON_INSTALL: number;
declare var ADDON_UNINSTALL: number;
declare var ADDON_UPGRADE: number;

interface Addon {
  readonly canUninstall: boolean;
  readonly description: string;
  readonly id: string;
  readonly isActive: boolean;
  readonly isEnabled: boolean;
  readonly name: string;
  readonly type: string;
  readonly version: string;
  setEnabled(value: boolean): Promise<void>;
  uninstall(): Promise<boolean>;
  __AddonInternal__: {
    matchingTargetApplication: {
      id: string;
      minVersion: string;
      maxVersion: string;
    };
    signedState?: number;
    updateURL: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Callable<iface> = iface | Extract<iface[keyof iface], Function>;
type DocumentObserver = Callable<{
  observe(aSubject: nsISupports & Document, aTopic: string, aData: string): void;
}>;

interface PreferencesLoader {
  _defaultPreferencesLoaded: boolean;
  loadDefaultPreferences: () => void;
}

declare const ChromeManifest: TabmixModules.ChromeManifestClass;
declare const Overlays: OverlaysModule.OverlaysClass;
declare var PreferencesLoader: PreferencesLoader;
declare var ScriptsLoader: ScriptsLoaderModule.ScriptsLoader;
declare const TabmixChromeUtils: TabmixModules.ChromeUtils;
declare var TabmixWidgets: TabmixWidgetsModule.TabmixWidgets;
