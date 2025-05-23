// reference this file before "./gecko/tools/generated/lib.gecko.dom.d.ts"
// to override `namespace ChromeUtils`

// this interface add mising methods to AddonManager that are missing in lib.gecko.dom.d.ts
interface AddonType extends Addon {
  disable(): void;
  appDisabled: boolean;
  pendingOperations: number;
  userDisabled: boolean;
}

interface AddonManagerListener {
  init(id: string): void;
  onChange(aAddon: AddonType, aAction: "onEnabled" | "onDisabled"): void;
  onEnabled(aAddon: AddonType): void;
  onDisabled(aAddon: AddonType): void;
  onInstalled(aAddon: AddonType): void;
}

interface AddonManagerType {
  SIGNEDSTATE_NOT_REQUIRED: i32;
  PENDING_NONE: i32;
  PENDING_ENABLE: i32;
  PENDING_DISABLE: i32;
  PENDING_UNINSTALL: i32;
  PENDING_INSTALL: i32;
  PENDING_UPGRADE: i32;
  getAddonByID(aID: string): Promise<AddonType>;
  getAddonsByTypes(aTypes?: string[]): Promise<AddonType[]>;
  shouldAutoUpdate(aAddon: AddonType): boolean;
  addAddonListener(listener: any): void;
}

declare var AddonManager: AddonManagerType;

// see modules.d.ts
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TabmixKnownModules {}

// @ts-expect-error - override `namespace ChromeUtils` from `gecko/lib.gecko.dom.d.ts`
interface ChromeUtils {
  defineLazyGetter(aTarget: any, aName: any, aLambda: any): void;
  /** @deprecated - removed in Firefox 136 */
  defineModuleGetter: (target: any, variable: string, path: string) => void;
  defineESModuleGetters: (target: any, mappings: any) => void;
  generateQI(interfaces: any[]): MozQueryInterface;
  getClassName(obj: any, unwrap?: boolean): string;
  import<S extends keyof TabmixKnownModules>(module: S): TabmixKnownModules[S];
  /** @deprecated - removed in Firefox 136 */
  import(aResourceURI: string): any;
  importESModule<S extends keyof TabmixKnownModules>(aResourceURI: S): TabmixKnownModules[S];
  nondeterministicGetWeakSetKeys<T extends object>(aSet: WeakSet<T>): T[];
}

// @ts-expect-error - override `namespace ChromeUtils` from `gecko/lib.gecko.dom.d.ts`
declare var ChromeUtils: ChromeUtils;

// @ts-ignore - lib.gecko.dom.d.ts set hidden to:  boolean | number | string | null;
interface HTMLElement {
  hidden: boolean | null;
}

interface DocumentElement extends HTMLElement {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface customXULCommandDispatcher {}

interface Document {
  readonly commandDispatcher: XULCommandDispatcher & customXULCommandDispatcher;
  readonly defaultView: WindowProxy;
  readonly documentElement: DocumentElement;
  getElementsByClassName<K extends keyof GetByMap>(name: K): NonEmptyCollection_G<GetByMap[K]>;
}

interface DOMStringMap {
  isSponsoredLink?: string;
  command?: string;
  popup?: string;
}

// overide lib.gecko.dom.d.ts DragEvent, don't set dataTransfer to null
interface DragEvent extends MouseEvent {
  readonly dataTransfer: DataTransfer;
  initDragEvent(type: string, canBubble?: boolean, cancelable?: boolean, aView?: Window | null, aDetail?: number, aScreenX?: number, aScreenY?: number, aClientX?: number, aClientY?: number, aCtrlKey?: boolean, aAltKey?: boolean, aShiftKey?: boolean, aMetaKey?: boolean, aButton?: number, aRelatedTarget?: EventTarget | null, aDataTransfer?: DataTransfer): void;
  originalTarget: EventTarget;
  target: EventTarget;
}

// override lib.gecko.dom.d.ts Document | null to prevent nullcheck of documnet
// documnet if document is null the browser will throw an error
declare var document: Document;
declare var performance: Performance;

interface Window {
  closeAll(): void;
  readonly document: Document;
  CustomTitlebar: CustomTitlebar;
  NodeFilter: typeof NodeFilter;
  readonly performance: Performance;
  /** @deprecated - use CustomTitlebar instead from Firefox 135 */
  TabsInTitlebar: CustomTitlebar;
}

interface WindowProxy {
  isChromeWindow: true;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GetByMap {}

// default getElementById override
type GetElementByIdOverride<K extends keyof GetByMap | string> = K extends keyof GetByMap ? GetByMap[K] : HTMLElement | null;
