// reference this file before "./gecko/devtools/gecko.d.ts"

interface TabmixSandbox extends nsIXPCComponents_utils_Sandbox {
  [key: string]: unknown;
  lazy: Record<string, unknown>;
  _shared: unknown;
  _type: unknown;
  _id: unknown;
}

// merge types from lib.gecko.xpcom.d.ts with existing interface from gecko.d.ts
declare namespace MockedExports {
  // nsIFilePicker is missing some types from lib.gecko.xpcom.d.ts
  interface nsIFilePicker_Constants {
    // From nsIFilePicker_Mode enum
    readonly modeOpen: 0;
    readonly modeSave: 1;
    readonly modeGetFolder: 2;
    readonly modeOpenMultiple: 3;

    // From nsIFilePicker_ResultCode enum
    readonly returnOK: 0;
    readonly returnCancel: 1;
    readonly returnReplace: 2;

    // From nsIFilePicker_CaptureTarget enum
    readonly captureNone: 0;
    readonly captureDefault: 1;
    readonly captureUser: 2;
    readonly captureEnv: 3;
  }

  interface nsIFilePicker extends nsIFilePickerXpcom {
    readonly filterText: 4;
  }

  interface FilePicker extends Pick<nsIFilePicker, "appendFilters" | "defaultExtension" | "defaultString"> {
    file: nsIFile;
    init: (browsingContext: BrowsingContext, title: string | null, mode: number) => void;
  }

  interface nsISupportsString {
    number: string;
  }

  interface nsIStringInputStream extends nsISupports, nsIInputStream {
    QueryInterface<T extends nsIID>(aIID: T): nsQIResult<T>;
    setByteStringData(data: string): void;
    setUTF8Data(data: string): void;
  }

  interface _nsIStyleSheetService extends nsIStyleSheetService {
    readonly AGENT_SHEET: 0;
    readonly USER_SHEET: 1;
    readonly AUTHOR_SHEET: 2;
  }

  interface _nsITimer extends nsITimer {
    readonly TYPE_REPEATING_SLACK: 1;
  }

  interface Cc {
    "@mozilla.org/toolkit/app-startup;1": {getService(service: nsJSIID<nsIAppStartup>): nsIAppStartup};
    "@mozilla.org/alerts-service;1": {getService(service: nsJSIID<nsIAlertsService>): nsIAlertsService};
    "@mozilla.org/browser/clh;1": {getService(service: nsJSIID<nsIBrowserHandler>): nsIBrowserHandler};
    "@mozilla.org/filepicker;1": {createInstance(instance: nsJSIID<nsIFilePicker, nsIFilePicker_Constants>): FilePicker};
    "@mozilla.org/content/style-sheet-service;1": {getService(service: nsJSIID<_nsIStyleSheetService>): _nsIStyleSheetService};
    "@mozilla.org/embedcomp/dialogparam;1": {createInstance(instance: nsJSIID<nsIDialogParamBlock>): nsIDialogParamBlock};
    "@mozilla.org/file/local;1": {createInstance(instance: Ci["nsIFile"]): nsIFile};
    "@mozilla.org/gfx/fontenumerator;1": {createInstance(instance: nsJSIID<nsIFontEnumerator>): nsIFontEnumerator};
    "@mozilla.org/pref-localizedstring;1": {createInstance(instance: Ci["nsIPrefLocalizedString"]): nsIPrefLocalizedString};
    "@mozilla.org/referrer-info;1": {createInstance(instance: nsJSIID<nsIReferrerInfo>): nsIReferrerInfo};
    "@mozilla.org/scripterror;1": {createInstance(instance: nsJSIID<nsIScriptError>): nsIScriptError};
    "@mozilla.org/supports-PRBool;1": {createInstance(instance: nsJSIID<nsISupportsPRBool>): nsISupportsPRBool};
    "@mozilla.org/io/string-input-stream;1": {createInstance(instance: nsJSIID<nsIStringInputStream>): nsIStringInputStream};
    "@mozilla.org/timer;1": {createInstance(instance: nsJSIID<_nsITimer>): _nsITimer};
    "@mozilla.org/widget/clipboardhelper;1": {getService(service: nsJSIID<nsIClipboardHelper>): nsIClipboardHelper};
  }

  interface _nsIWebNavigation extends nsIWebNavigation {
    readonly LOAD_FLAGS_NONE: 0;
    readonly LOAD_FLAGS_BYPASS_HISTORY: 64;
    readonly LOAD_FLAGS_BYPASS_CACHE: 256;
    readonly LOAD_FLAGS_BYPASS_PROXY: 512;
    readonly LOAD_FLAGS_USER_ACTIVATION: 134217728;
    sessionHistory: nsISupports & {
      index: i32;
      getEntryAtIndex(aIndex: i32, aPersist?: boolean): nsISHEntry;
      legacySHistory: nsISHistory;
    };
  }

  // overrid lib.gecko.xpcom.d.ts
  interface _nsIAppStartup extends nsIAppStartup {
    readonly eConsiderQuit: 1;
    readonly eAttemptQuit: 2;
    readonly eForceQuit: 3;
    readonly eRestart: 16;
    readonly eSilently: 256;
  }

  interface _nsIWebProgressListener extends nsIWebProgressListener {
    readonly STATE_START: 1;
    readonly STATE_STOP: 16;
    readonly STATE_IS_NETWORK: 262144;
    readonly STATE_IS_WINDOW: 524288;
    readonly STATE_RESTORING: 16777216;
  }

  enum nsIAppStartup_IDLShutdownPhase {
    SHUTDOWN_PHASE_NOTINSHUTDOWN = 0,
    SHUTDOWN_PHASE_APPSHUTDOWNCONFIRMED = 1,
    SHUTDOWN_PHASE_APPSHUTDOWNNETTEARDOWN = 2,
    SHUTDOWN_PHASE_APPSHUTDOWNTEARDOWN = 3,
    SHUTDOWN_PHASE_APPSHUTDOWN = 4,
    SHUTDOWN_PHASE_APPSHUTDOWNQM = 5,
    SHUTDOWN_PHASE_APPSHUTDOWNRELEMETRY = 6,
    SHUTDOWN_PHASE_XPCOMWILLSHUTDOWN = 7,
    SHUTDOWN_PHASE_XPCOMSHUTDOWN = 8,
  }

  interface Ci extends Omit<nsIXPCComponents_Interfaces, "nsIFilePicker"> {
    nsIAppStartup: nsJSIID<_nsIAppStartup, typeof nsIAppStartup_IDLShutdownPhase>;
    nsIFilePicker: nsJSIID<nsIFilePicker, nsIFilePicker_Constants>;
    nsIPromptService: nsJSIID<MockedGeckoTypes._nsIPromptService>;
    nsIStringInputStream: nsJSIID<nsIStringInputStream>;
    nsIStyleSheetService: nsJSIID<_nsIStyleSheetService>;
    nsIWebNavigation: nsJSIID<_nsIWebNavigation> & {[key: string]: any};
    nsIWebProgressListener: nsJSIID<_nsIWebProgressListener>;
    nsITimer: nsJSIID<_nsITimer>;
  }

  interface nsIXPCComponents_utils_Sandbox {
    (principal: nsIPrincipal | nsIPrincipal[], options: object): TabmixSandbox;
  }

  interface Cu extends Omit<nsIXPCComponents_Utils, "Sandbox"> {
    Sandbox: nsIXPCComponents_utils_Sandbox;
  }

  interface Results extends nsIXPCComponents_Results {
    NS_ERROR_INVALID_ARG: 0x80070057;
  }
}

declare var Cr: MockedExports.Results;
declare var Cu: MockedExports.Cu;

interface nsIDOMWindowUtils {
  // @ts-expect-error - overrid nsIDOMWindowUtils from lib.gecko.xpcom.d.ts
  readonly AUTHOR_SHEET: 2;
}

// override gecko.d.ts types
declare namespace MockedExports {
  interface AppConstantsSYSMJS {
    AppConstants: {
      platform: string;
      MOZ_APP_NAME: string;
      MOZ_APP_VERSION: string;
      DEBUG: boolean;
      NIGHTLY_BUILD: boolean;
      RELEASE_OR_BETA: boolean;
      EARLY_BETA_OR_EARLIER: boolean;
    };
  }
}

interface AppConstantsType {
  readonly BROWSER_CHROME_URL: string;
  readonly DEBUG: boolean;
  readonly EARLY_BETA_OR_EARLIER: boolean;
  readonly MOZ_APP_NAME: string;
  readonly MOZ_APP_VERSION: string;
  readonly NIGHTLY_BUILD: boolean;
  readonly RELEASE_OR_BETA: boolean;
  readonly platform: string;
}

declare module "resource://gre/modules/AppConstants.sys.mjs" {
  // @ts-ignore
  export = AppConstantsType;
  const AppConstants: AppConstantsType;
  export {AppConstants};
}

declare namespace MockedGeckoTypes {
  /** Services */

  // NOTE:
  // we use here the interface from gecko/lib.gecko.services.d.ts
  // and ignore the declared Services from gecko.d.ts

  interface _nsIEventListenerService extends nsIEventListenerService {}

  interface _nsIIOService extends nsIIOService {
    newURI(aSpec: string, aOriginCharset?: string | null, aBaseURI?: nsIURI | null): nsIURI;
  }

  interface _nsIObserverService extends nsIObserverService {
    notifyObservers(aSubject: nsISupports, aTopic: string, someData?: string): void;
    notifyObservers(aSubject: nsISupports & {wrappedJSObject: Promise<void>}, aTopic: string, someData?: string): void;
  }

  type InOutParam<T> = {value: T};
  interface _nsIPromptService extends nsIPromptService {
    readonly BUTTON_POS_0: 1;
    readonly BUTTON_POS_1: 256;
    readonly BUTTON_POS_2: 65536;
    readonly MODAL_TYPE_WINDOW: 3;
    readonly BUTTON_TITLE_IS_STRING: 127;
    readonly BUTTON_POS_2_DEFAULT: 33554432;
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
