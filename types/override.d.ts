// reference this file before "./gecko/lib.gecko.dom.d.ts"
// to override `namespace ChromeUtils`

// this interface add mising methods to AddonManager that are missing in lib.gecko.dom.d.ts
interface AddonManagerType {
  SIGNEDSTATE_NOT_REQUIRED: number | number;
  getAddonByID(aID: string): Promise<Addon>;
  getAddonsByTypes(aTypes?: string[]): Promise<Addon[]>;
  shouldAutoUpdate(aAddon: Addon): boolean;
}

declare var AddonManager: AddonManagerType;

// see tabmix.d.ts
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

interface DocumentElement extends HTMLElement {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface customXULCommandDispatcher {}

interface Document {
  readonly commandDispatcher: XULCommandDispatcher & customXULCommandDispatcher;
  readonly defaultView: WindowProxy;
  readonly documentElement: DocumentElement;
  getElementsByClassName<K extends keyof GetByMap>(name: K): NonEmptyCollection_G<GetByMap[K]>;
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
  readonly document: Document;
  readonly performance: Performance;
  CustomTitlebar: CustomTitlebar;
  /** @deprecated - use CustomTitlebar instead from Firefox 135 */
  TabsInTitlebar: CustomTitlebar;
}
