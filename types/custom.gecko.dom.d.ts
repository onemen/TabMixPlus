/// <reference types="./override.d.ts" />
/// <reference types="./gecko/tools/lib.gecko.dom.d.ts" />
/// <reference types="./gecko/tools/lib.gecko.xpcom.d.ts" />
/// <reference types="./gecko/tools/lib.gecko.xpidl.d.ts" />

// helpers types
type f<T> = Array<T>;
type NonEmptyArray<T> = T[] & {0: T};
type Params = Record<string, unknown>;

// for class extending MozXULElement
interface CustomElementConstructorOverride {
  _fragment: DocumentFragment;
  get fragment(): Node;
  _flippedInheritedAttributes?: Record<string, unknown>;
  get inheritedAttributes(): Record<string, string>;
  insertFTLIfNeeded(id: string): Promise<void>;
  markup: string;
  parseXULToFragment(markup: string, localizeFiles?: string[]): DocumentFragment;

  prototype: MozXULElement;
  new (): MozXULElement;
  isInstance: IsInstance<MozXULElement>;
}

interface CustomElementConstructor extends CustomElementConstructorOverride {}

interface CustomElementRegistry {
  // with CustomElementConstructor the type of owr custom classes doesn't match
  // the expected type for constructor argument in customElements.define
  define(name: string, constructor: CustomElementConstructorOverride, options?: ElementDefinitionOptions): void;
}

// add properties to GetByTagNameMap as needed when using getElementsByTagName
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GetByTagNameMap {}

interface MozXULElement extends Omit<Element, "parentNode" | "value">, CustomElementConstructorOverride {
  connectedCallback(): void;
  delayConnectedCallback(): boolean;
  disconnectedCallback(): void;
  getElementForAttrInheritance(selector: string): Element;
  getElementsByTagName<K extends keyof GetByTagNameMap>(localName: K): NonEmptyCollection_G<GetByTagNameMap[K]>;
  initializeAttributeInheritance(): void;
}

interface NamedNodeMap {
  attribute?: {
    value: string;
  };
}

declare var MozXULElement: CustomElementConstructorOverride;

interface QuerySelectorMap {
  '[anonid="useThis"]': HTMLInputElement;
  '[dlgtype="extra1"]': HTMLButtonElement;
  "[tabmix_context]": HTMLElement;
  ".urlbarView-results": HTMLElement;
  "slot": HTMLElement;
}

interface GetByMap {
  "checkbox": HTMLInputElement;
  "tabmix-tooltip": XULPopupElement;
  "searchbar": CustomSearchbar;
  "tabmix_hideTabbar_menu-container": HTMLTemplateElement;
  "tabmix-closedTabs-container": HTMLTemplateElement;
  "tabmix-closedWindows-container": HTMLTemplateElement;

  "scrollbutton-up": HTMLButtonElement;
  "scrollbutton-down": HTMLButtonElement;
  "tab-close-button": HTMLButtonElement;
  "fullscr-bottom-toggler": HTMLElement & {initialized: boolean};
  "navigator-toolbox": HTMLElement;
  "tabmix-bottom-toolbox": HTMLElement;
  "nav-bar-overflow-button": HTMLButtonElement;
}

interface CustomSearchbar extends HTMLInputElement {
  handleSearchCommand: (event: Event) => void;
}

interface KnownElements {
  id1: Element;
  id2: HTMLElement;
  useThis: HTMLInputElement;
  id4: HTMLButtonElement;
}

interface HTMLCollectionBase_G<T> {
  readonly length: number;
  item(index: number): T | null;
  forEach(callbackfn: (value: T, key: number, parent: NodeList) => void, thisArg?: any): void;
  [index: number]: T;
  [Symbol.iterator](): IterableIterator<T | null>;
  entries(): IterableIterator<[number, T | null]>;
  keys(): IterableIterator<number>;
  values(): IterableIterator<T | null>;
  [Symbol.iterator](): IterableIterator<T>; // Remove the | null
}

interface HTMLCollection_G<T> extends HTMLCollectionBase_G<T> {
  namedItem(name: string): T | null;
}

type NonEmptyCollection_G<T> = HTMLCollectionBase_G<T> & {0: T};

interface ParentNode {
  id?: string;
  getElementsByAttribute(name: "pinned" | "isPermaTab" | "protected", value: true): HTMLCollection_G<MockedGeckoTypes.BrowserTab>;
  getElementsByAttribute(name: string, value: number | null): HTMLCollection;
  getElementsByAttribute<K extends keyof GetByMap>(name: "anonid" | "class" | "command" | "pane", value: K): NonEmptyCollection_G<GetByMap[K]>;
  getElementsByAttribute(name: "dlgtype", value: string): NonEmptyCollection_G<HTMLButtonElement>;
  getElementsByAttribute<K extends keyof GetByMap>(name: K, value: string): HTMLCollection_G<GetByMap[K]>;
  _getElementById<K extends keyof GetByMap | string>(selectors: K): K extends keyof GetByMap ? GetByMap[K] : HTMLElement | null;
  querySelector<K extends keyof QuerySelectorMap | string>(selectors: K): K extends keyof QuerySelectorMap ? QuerySelectorMap[K] : HTMLElement;
  querySelectorAll<K extends keyof QuerySelectorMap>(selectors: K): HTMLCollection_G<QuerySelectorMap[K]>;
  querySelectorAll(selectors: string): HTMLCollection_G<HTMLElement>;
}

interface XULTab {
  label: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface createXULMap {}

interface Document {
  createXULElement<K extends keyof createXULMap | string>(selectors: K): K extends keyof createXULMap ? createXULMap[K] : HTMLElement;
  getElementById<K extends keyof GetByMap | string>(selectors: K): K extends keyof GetByMap ? GetByMap[K] : (HTMLElement & HTMLInputElement & XULTab) | null;
  getElementsByTagName<K extends keyof GetByTagNameMap>(localName: K): NonEmptyCollection_G<GetByTagNameMap[K]>;
  querySelector<K extends keyof QuerySelectorMap | string>(selectors: K): K extends keyof QuerySelectorMap ? QuerySelectorMap[K] : HTMLElement | null;
}

interface ShadowRoot {
  getElementById<K extends keyof GetByMap | string>(selectors: K): K extends keyof GetByMap ? GetByMap[K] : (HTMLElement & HTMLInputElement & XULTab) | null;
  querySelector<K extends keyof QuerySelectorMap | string>(selectors: K): K extends keyof QuerySelectorMap ? QuerySelectorMap[K] : HTMLElement | null;
}

interface HTMLInputElement {
  readonly nextSibling: HTMLElement | HTMLInputElement | Element | null;
}

interface Node {
  className: string;
  classList: DOMTokenList;
  collapsed: boolean;
  fileName: string;
  getAttribute(name: string): string | null;
  getBoundingClientRect(): DOMRect;
  hasAttribute(name: string): boolean;
  hidden: boolean | null;
  hidePopup(cancel?: boolean): void;
  id?: string;
  localName: string;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string | boolean | number): void;
  readonly tagName: string;
}

/**
 * for content.js
 * this types are here since it is also used by other files
 */
type IconInfo = {pageUri: nsIURI; iconUri: nsIURI; width: number; isRichIcon: boolean; type: string; node: HTMLLinkElement};

interface IconLoader {
  addDefaultIcon(pageUri: any): void;
  iconInfos: any[];
  onPageShow(): void;
}

interface JSWindowActorChild {
  _iconLoader: IconLoader;
  get iconLoader(): IconLoader;
  onProcessedClick: (json: Params) => void;
  seenTabIcon: boolean;
}
