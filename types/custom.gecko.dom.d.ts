/// <reference types="./override.d.ts" />
/// <reference types="./gecko/lib.gecko.dom.d.ts" />
/// <reference types="./gecko/lib.gecko.xpcom.d.ts" />

type Params = Record<string, unknown>;

// for class extending MozXULElement
interface CustomElementConstructorOverride {
  _fragment: DocumentFragment;
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
  // with CustomElementConstructor make owr custom classes type doesn't match
  // expected type for constructor argument in customElements.define
  define(name: string, constructor: CustomElementConstructorOverride, options?: ElementDefinitionOptions): void;
}

interface MozXULElement extends Omit<Element, "value"> {
  connectedCallback(): void;
  delayConnectedCallback(): boolean;
  getElementForAttrInheritance(selector: string): Element;
  initializeAttributeInheritance(): void;
}

interface NamedNodeMap {
  attribute?: {
    value: string;
  };
}

interface MozColorbox extends CustomElementConstructorOverride {
  updateColor(): void;
}

declare var MozXULElement: CustomElementConstructorOverride;
declare var MozColorbox: MozColorbox;

interface QuerySelectorMap {
  "[anonid='useThis']": HTMLInputElement;
  "[dlgtype='extra1']": HTMLButtonElement;
  '[dlgtype="extra1"]': HTMLButtonElement;
}

interface GetByMap {
  // for pref-appearance.xhtml
  color: HTMLInputElement;
  red: HTMLInputElement;
  green: HTMLInputElement;
  blue: HTMLInputElement;
  opacity: HTMLInputElement;
  italic: HTMLInputElement;
  bold: HTMLInputElement;
  underline: HTMLInputElement;
  text: HTMLInputElement;
  bg: HTMLInputElement;
  textColor: MozColorbox;
  bgColor: MozColorbox;
  bgTopColor: MozColorbox;
  _unloadedTab: HTMLElement;
  _unreadTab: HTMLElement;
  _otherTab: HTMLElement;
  _progressMeter: HTMLElement;
  useThis: HTMLInputElement;

  checkbox: HTMLInputElement & XULTab;
  checkboxContainer: HTMLElement;
  space_before_checkbox: HTMLElement;
  tm_info: HTMLElement;
  tm_checkbox: HTMLInputElement;
  tm_prompt: HTMLMenuElement;
  tm_prompt_menu: XULPopupElement;
  tm_textbox: HTMLInputElement;

  "tabmix-tooltip": XULPopupElement;
  searchbar: CustomSearchbar;
  "tabmix_hideTabbar_menu-container": HTMLTemplateElement;
  "tabmix-closedTabs-container": HTMLTemplateElement;
  "tabmix-closedWindows-container": HTMLTemplateElement;
  "tabmix-closedTabsView": CustomPanelView;
  "tabmix-closedWindowsView": CustomPanelView;

  "scrollbutton-up": HTMLButtonElement;
  "scrollbutton-down": HTMLButtonElement;
  "tab-close-button": HTMLButtonElement;
  "fullscr-bottom-toggler": HTMLElement & {initialized: boolean};
  "tabmix-bottom-toolbox": HTMLElement;
  reloadevery_custom_dialog: HTMLDialogElement;
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
  [Symbol.iterator](): IterableIterator<T>;
  readonly length: number;
  item(index: number): T | null;
  [index: number]: T;
}

interface HTMLCollection_G<T, K> extends HTMLCollectionBase_G<T> {
  namedItem(name: K): T | null;
}

interface ParentNode {
  getElementsByAttribute<K extends keyof GetByMap>(name: "anonid", value: K): HTMLCollection_G<GetByMap[K], K> | null;
  getElementsByAttribute<K extends keyof GetByMap>(name: K, value: string): HTMLCollection_G<GetByMap[K], K> | null;
  getElementsByClassName<K extends keyof GetByMap>(name: K): HTMLCollection_G<GetByMap[K], K> | null;
  _getElementById<K extends keyof GetByMap | string>(selectors: K): K extends keyof GetByMap ? GetByMap[K] : HTMLElement | null;
  querySelector<K extends keyof QuerySelectorMap | string>(selectors: K): K extends keyof QuerySelectorMap ? QuerySelectorMap[K] : HTMLElement | null;
}

interface XULTab {
  label: string;
}

interface Document {
  getElementById<K extends keyof GetByMap | string>(selectors: K): K extends keyof GetByMap ? GetByMap[K] : (HTMLElement & HTMLInputElement & XULTab) | null;
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
  collapsed: boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  hidden: boolean | null;
  hidePopup(cancel?: boolean): void;
  id?: string;
  localName: string;
}

interface XULCommandDispatcher {
  focusedElement: Element;
}

interface CustomPanelView extends HTMLElement {
  menupopup: Element;
}

/** for content.js */

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

interface mozIDOMWindowProxy {
  windowGlobalChild: WindowGlobalChild | null;
  _callBackFunction?: (data: {button: number; checked: boolean; label: string; value: number}) => void;
}

// @ts-expect-error - override nsIPrefBranch from gecko.d.ts and use the one form lib.gecko.xpcom.d.ts
// for use in Services.prefs
declare interface nsIPrefBranch {}
