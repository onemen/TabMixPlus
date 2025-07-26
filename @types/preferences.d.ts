/// <reference types="./modules.d.ts" />

type GeneralElement = HTMLElement;
type ShortcutKey = ShortcutsModule.ShortcutKey;

// Helper type for elements that can be used with preferences
type PreferenceCompatibleElement = HTMLElement | PreferenceElement | MousePaneNS.MenuList;

interface GetByMapWithType {
  _PREF_CLASS_: PreferenceClass;
  _PREF_LIST_CLASS_: PreferencesListClass;
  _PANE_CLASS_: PrefPaneClass;
}

interface Document {
  getElementById<K extends keyof GetByMap | string>(selectors: K): K extends keyof GetByMap ? GetByMap[K] : GeneralElement;
  getElementById<K extends keyof GetByMapWithType>(selectors: string, type: K): K extends keyof GetByMapWithType ? GetByMapWithType[K] : GeneralElement;
  importNode(node: DocumentFragment, deep?: boolean): HTMLElement;
}

interface EventTarget {
  contentDocument: MockedGeckoTypes.ChromeBrowser & Document;
  localName: string;
}

//  this types apply to document.documentElement that is PrefWindow in prefs-ce.js
interface Element {
  blur: () => void;
  getAttribute(name: "control" | "preference" | "prefstring"): string;
  focus: () => void;
  instantApply: boolean;
  type: string;
}

interface HTMLMenuElement {
  selectedItem: HTMLElement;
}

declare class ExtensionShortcutKeyMap {
  constructor();
  buildForAddonIds(addonIds: string[]): Promise<void>;
}

interface CheckBoxElement extends Omit<HTMLInputElement, "value"> {
  value: boolean;
}

interface Node {
  appendChild<T>(child: T): T;
  contains<T>(other: T | null): boolean;
  label?: string;
}

interface customXULCommandDispatcher {
  advanceFocusIntoSubtree: (elt: PrefWindowClass | Element) => void;
}

interface Window {
  $<K extends keyof GetByMap>(selectors: K | string): K extends keyof GetByMap ? GetByMap[K] : HTMLElement | null;
  getComputedStyle(elt: HTMLElement, pseudoElt?: string | null): CSSStyleDeclaration | null;
  notifyDefaultButtonLoaded(defaultButton: HTMLButtonElement): void;
  CustomizableUI: typeof CustomizableUI;
}

interface WindowProxy extends mozIDOMWindowProxy {
  readonly opener: WindowProxy;
  openHelp: typeof Globals.openHelp;
  gIncompatiblePane: IgIncompatiblePane;
  Tabmix: TabmixGlobal;
}

interface IgIncompatiblePane {
  _initialized: boolean;
  lastSelected: string;
  paneButton: PrefPaneClass;
  init: () => void;
  deinit: () => void;
  handleEvent: (event: Event) => void;
  hide_IncompatibleNotice: (this: IgIncompatiblePane, aHide: boolean, aFocus: boolean) => void;
}

/** classes in prefs-ce.js */

type GetFunction = (element: PrefWindowClass | PrefPaneClass | HTMLElement | PreferenceElement | MousePaneNS.MenuList, eventType: string, eventCode: string) => FunctionWithAny;

// for testing...
type BindThis<T extends object> = {
  [K in keyof T]: T[K] extends (...args: any) => any ? (this: T, ...args: Parameters<T[K]>) => ReturnType<T[K]> : T[K];
};

type observerArgs = [subject: nsISupports, topic: string, data: string];
type Prefs = MockedGeckoTypes.Services["prefs"];

interface MozXULElement {
  _content: HTMLElement;
  appendChild<T>(child: T): T;
  get fragment(): HTMLElement;
  ownerDocument: Document;
}

interface extendedMozXULElement extends Omit<MozXULElement, "childNodes" | "getElementsByAttribute"> {
  getElementsByAttribute(name: "name", value: string): NonEmptyCollection_G<PreferenceClass>;
}

interface PreferencesListOverrideMozXULElement extends extendedMozXULElement {
  childNodes: HTMLCollectionBase_G<PreferenceClass>;
}

declare interface PreferencesListClass extends PreferencesListOverrideMozXULElement {
  observerFunction: (subject: nsISupports, topic: string, data: string) => void;
  service: Prefs;
  rootBranch: Prefs;
  defaultBranch: nsIPrefBranchXpcom;
  rootBranchInternal: Prefs;
  _constructedChildrenCount: number;
  _constructAfterChildrenCalled: boolean;
  _preferenceChildren: HTMLCollectionBase_G<PreferenceClass>;
  get type(): string;
  get instantApply(): boolean;
  observe(this: PreferencesListClass, aSubject: nsISupports, aTopic: string, aData: string): void;
  _constructAfterChildren(this: PreferencesListClass): void;
  fireChangedEvent(aPreference: PreferenceClass): void;
}

type PreferenceValue = string | number | boolean | nsIFile | null;

// for inner functions
declare namespace PreferenceNS {
  function getValue(element: PreferenceCompatibleElement, attribute: string): PreferenceValue;
  function setValue(element: PreferenceCompatibleElement, attribute: string, value: string | number | boolean): void;
}

interface PreferencOverrideMozXULElement extends Omit<MozXULElement, "parentNode"> {
  parentNode: PreferencesListClass;
}

interface PreferenceClass extends PreferencOverrideMozXULElement {
  _branch: nsIPrefBranchXpcom;
  _constructed: boolean;
  _lastValue?: PreferenceValue;
  _reportUnknownType(): void;
  _running: boolean;
  _setValue(aValue: PreferenceValue): PreferenceValue;
  _useDefault: boolean;
  _value: PreferenceValue;
  batching: boolean;
  defaultValue: PreferenceValue;
  disabled: boolean;
  getElementValue(aElement: PreferenceElement): PreferenceValue;
  getValueByType(aElement: HTMLElement | PreferenceElement): PreferenceValue;
  isElementEditable(aElement: PreferenceCompatibleElement): boolean;
  inverted: boolean;
  locked: boolean;
  get name(): string;
  set name(val: string);
  get booleanValue(): boolean;
  get numberValue(): number;
  get stringValue(): string;
  readonly preferences: PreferencesListClass;
  readonly: boolean;
  setElementValue(aElement: HTMLElement | PreferenceElement | MousePaneNS.MenuList): void;
  get tabIndex(): number;
  set tabIndex(val: number);
  get type(): string;
  set type(val: string);
  updateElements(): void;
  get value(): PreferenceValue;
  set value(val: PreferenceValue);
  get valueFromPreferences(): PreferenceValue | null;
  set valueFromPreferences(val: PreferenceValue);
}

interface PaneEvent extends Omit<Event, "target"> {
  target: PreferenceElement;
  sourceEvent: PaneEvent;
}

interface DeferredTask {
  arm(): void;
  disarm(): void;
  finalize(): void;
}

interface DeferredTaskConstructor {
  prototype: DeferredTask;
  new (aTaskFn: () => unknown | Promise<unknown>, aDelayMs: number, aIdleTimeoutMs?: number): DeferredTask;
  isInstance: IsInstance<DeferredTask>;
}

// PreferenceElement: any element with attribute preference with value to preference
interface PreferenceElement extends Omit<HTMLInputElement, "value"> {
  _deferredValueUpdateTask?: DeferredTask;
  value: string | number | boolean;
}

interface ResizeObserver {
  disconnect(): void;
  observe(target: PrefPaneClass, options?: ResizeObserverOptions): void;
  unobserve(target: PrefPaneClass): void;
}

interface PrefPaneOverrideMozXULElement extends Omit<MozXULElement, "addEventListener" | "childNodes"> {
  addEventListener(type: string, listener: (this: PreferenceElement, ev: PaneEvent) => any, options?: boolean | AddEventListenerOptions): void;
  childNodes: HTMLCollectionBase_G<PanelItemButton>;
  parentNode: HTMLElement;
  value: string;
}

declare interface PrefPaneClass extends PrefPaneOverrideMozXULElement {
  _content: HTMLElement;
  _deferredValueUpdateElements: Set<PreferenceElement>;
  _initialized: boolean;
  _deferredValueUpdate(this: PrefPaneClass, aElement: PreferenceElement): void;
  _finalizeDeferredElements(): void;
  _loaded: boolean;
  _resizeObserver: ResizeObserver | null;
  readonly contentHeight: number;
  readonly contentWidth: number;
  readonly DeferredTask: DeferredTaskConstructor;
  getPreferenceElement(aElement: PreferenceElement): PreferenceElement;
  readonly helpTopic: string;
  get image(): string;
  set image(val: string);
  get loaded(): boolean;
  set loaded(val: boolean);
  readonly preferenceElements: HTMLCollectionBase_G<PreferenceElement>;
  readonly preferences: PreferenceClass[];
  preferenceForElement(aElement: PreferenceElement): PreferenceClass;
  get selected(): boolean;
  set selected(val: boolean);
  get src(): string;
  set src(val: string);
  userChangedValue(this: PrefPaneClass, aElement: PreferenceElement): void;
  writePreferences(this: PrefPaneClass, aFlushToDisk: boolean): void;
}

interface WindowEvent extends Omit<KeyboardEvent, "target" | "originalTarget"> {
  originalTarget: HTMLElement;
  target: HTMLElement;
  sourceEvent: WindowEvent;
}
type ButtonsTypeWithoutNone = "accept" | "cancel" | "extra1" | "extra2" | "help" | "disclosure";
type DialogButtonsType = "accept" | "cancel" | "extra1" | "extra2" | "help" | "disclosure" | "none";

interface PrefWindowOverrideMozXULElement extends Omit<MozXULElement, "addEventListener" | "appendChild"> {
  addEventListener(type: string, listener: (this: HTMLElement, ev: WindowEvent) => any, options?: boolean | AddEventListenerOptions): void;
  appendChild(child: HTMLElement | PrefPaneClass): PrefPaneClass;
  get fragment(): HTMLElement & {lastElementChild: HTMLElement};
}

interface PrefWindowClass extends PrefWindowOverrideMozXULElement {
  _buttons: {[key in DialogButtonsType]: HTMLButtonElement};
  _configureButtons(aButtons: string): void;
  _currentPane: PrefPaneClass | null;
  _doButtonCommand(aDlgType: DialogButtonsType): boolean;
  _fireButtonEvent(aDlgType: string): boolean;
  _fireEvent(aEventName: string, aTarget: PrefWindowClass | PrefPaneClass): boolean;
  _handleButtonCommand(aEvent: WindowEvent): boolean;
  _hitEnter(evt: WindowEvent): void;
  _initialized: boolean;
  _instantApplyInitialized: boolean;
  _l10nButtons: Element[];
  _makePaneButton(aPaneElement: PrefPaneClass): Element;
  _paneLoaded(this: PrefWindowClass, aPaneElement: PrefPaneClass): void;
  readonly _paneDeck: CustomGroupElement<PrefPaneClass>;
  readonly _paneDeckContainer: HTMLElement;
  readonly _selector: CustomGroupElement<PrefPaneClass>;
  _selectPane(this: PrefWindowClass, aPaneElement: PrefPaneClass): void;
  _setDefaultButton(aNewDefault: DialogButtonsType): void;
  addPane(this: PrefWindowClass, aPaneElement: PrefPaneClass): void;
  buttons: string;
  cancelDialog(): boolean;
  currentPane: PrefPaneClass;
  set defaultButton(buttonId: DialogButtonsType);
  get defaultButton(): DialogButtonsType;
  getButton(aDlgType: DialogButtonsType): HTMLButtonElement;
  fixMozTabsForZen(doc?: Document): void;
  lastSelected: string;
  maxContentSize: {width: number; height: number};
  maybeResize(aPaneElement: PrefPaneClass, targetSize: number, measurement: "height" | "width", padding: number, onlySizeUp: boolean): void;
  mStrBundle: nsIStringBundle;
  postLoadInit(): void;
  readonly preferencePanes: NonEmptyCollection_G<PrefPaneClass>;
  setButtonLabel(dlgtype: string, button: HTMLButtonElement): void;
  showPane(this: PrefWindowClass, aPaneElement: PrefPaneClass): void;
  sizeToContent(this: PrefWindowClass, onlySizeUp?: boolean): void;
}

interface CheckboxClassOverrideMozXULElement extends MozXULElement {}

interface CheckboxClass extends CheckboxClassOverrideMozXULElement {
  _initialized: boolean;
  _checkbox: HTMLInputElement;
  get label(): string;
  set label(val: string);
  get value(): boolean;
  set value(val: boolean);
  get checked(): boolean;
  set checked(val: boolean);
  get disabled(): boolean;
  set disabled(val: boolean);
  parentNode: HTMLElement;
}

interface MozShortcutClassOverrideMozXULElement extends Omit<MozXULElement, "parentNode"> {
  parentNode: ShortcutParent;
}

interface MozShortcutClass extends MozShortcutClassOverrideMozXULElement {
  _key: ShortcutKey | null;
  _initialized: boolean;
  applyNewValue(this: MozShortcutClass, aNewValue: string, aDisabled: boolean): void;
  get blocked(): boolean;
  set blocked(val: boolean);
  readonly defaultPref: string;
  readonly description: HTMLElement;
  disabled: boolean;
  disableKey(): void;
  readonly editBox: ShortcutEditBox;
  handleKeyEvents(this: MozShortcutClass, event: MouseEvent & KeyboardEvent & {[key: string]: any}, ctrl_w: boolean): void;
  get key(): ShortcutKey;
  set key(val: ShortcutKey);
  get label(): string;
  set label(val: string);
  notificationbox: HTMLElement;
  onKeyDown(this: MozShortcutClass, event: MouseEvent & KeyboardEvent): void;
  updateFocus(this: MozShortcutClass, onFocus: boolean): void;
  updateNotification(): string;
  value: string;
  valueFromPreferences(this: MozShortcutClass, aKeyData: ShortcutsModule.ShortcutData): boolean | string;
}

interface ShortcutEditBox extends HTMLInputElement {
  shortcut: MozShortcutClass;
}

interface ShortcutsPanel extends HTMLElement {
  shortcut: MozShortcutClass;
}

interface ShortcutParent extends Omit<HTMLFieldSetElement, "childNodes"> {
  childNodes: HTMLCollectionBase_G<MozShortcutClass>;
  keys: {slideShow: string} & Record<string, string>;
}

type StyleProps = "italic" | "bold" | "underline" | "text" | "textColor" | "bg" | "bgColor" | "bgTopColor";
interface StyleElement extends Omit<HTMLInputElement, "checked"> {
  checked?: string | boolean;
  color?: string | boolean;
  nextSibling: HTMLLabelElement;
}

interface TabstylepanelClassOverrideMozXULElement extends Omit<MozXULElement, "parentNode"> {
  parentNode: Node;
}

interface TabstylepanelClass extends TabstylepanelClassOverrideMozXULElement {
  _initPrefValues: string;
  _initUseThisPref: {prefvalue: boolean; optionvalue: boolean};
  _item: PreferenceClass | null;
  _getElementByAnonid<K extends keyof GetByMap | string>(aID: K): K extends keyof GetByMap ? GetByMap[K] : StyleElement | null;
  _getPrefs(this: TabstylepanelClass, aPrefString: string): void;
  _ondialogcancel(): void;
  _prefValues: DynamicRulesModule.TabStyle | object;
  _resetDefault(this: TabstylepanelClass, aResetOnlyStyle: boolean): void;
  _savePrefs(): void;
  _updateUseThisState(this: TabstylepanelClass, aEnabled: boolean): void;
  get disabled(): boolean;
  set disabled(val: boolean);
  disableBgColor: boolean;
  readonly prefName: string;
  updateDisableState(this: TabstylepanelClass, aID: string): void;
}

type ColorElement = HTMLInputElement;
interface ColorEvent extends Omit<Event, "target"> {
  target: ColorElement;
  originalTarget: ColorElement;
  sourceEvent: ColorEvent;
}

interface MozColorboxOverrideMozXULElement extends Omit<MozXULElement, "addEventListener" | "closest" | "parentNode"> {
  addEventListener(type: string, listener: (this: ColorElement, ev: ColorEvent) => any, options?: boolean | AddEventListenerOptions): void;
  closest<K extends "tabstylepanel" | string>(selector: K): K extends "tabstylepanel" ? TabstylepanelClass : Element | null;
  parentNode: Node;
}

interface MozColorbox extends MozColorboxOverrideMozXULElement {
  _RGB: StyleElement[];
  _colorpicker: StyleElement;
  _parent: TabstylepanelClass;
  getColor(format?: boolean): string;
  update(this: MozColorbox, event: ColorEvent): void;
  updateColor(): void;
  updateRgba(this: MozColorbox, val: string): void;
}

interface MozColorboxClass extends MozColorbox {}

/** pref-filetype.js */
interface RichListBox extends Omit<MozXULElement, "getElementsByAttribute" | "lastChild"> {
  appendItem(label: string, value: string): RichListItem;
  ensureIndexIsVisible(aIndex: number): void;
  getElementsByAttribute(name: "value", value: string): HTMLCollection_G<RichListItem> | null;
  getIndexOfItem(aItem: RichListItem): number;
  getItemAtIndex(aIndex: number): RichListItem;
  getRowCount(): number;
  lastChild: RichListItem;
  parentNode: Node;
  get selectedIndex(): number;
  set selectedIndex(value: number);
  get selectedItem(): RichListItem;
  set selectedItem(val: RichListItem);
}

interface RichListItem extends MozXULElement {
  get value(): string;
  set value(val: string);
}

/** panles methods */

declare namespace AppearancePaneNS {
  let _tabmixCustomizeToolbar: boolean | null;
  function init(): void;
  function _waterfoxPositionControl(): void;
  function tabCloseButtonChanged(): void;
  function setTabCloseButtonUI(): void;
  function tabsScrollChanged(): void;
  function tabmixCustomizeToolbar(): void;
  function toolbarButtons(aWindow: Window): void;
  function userChangedWidth(item: PreferenceElement): PreferenceValue | undefined;
  function changeTabsWidth(): void;
  function resetWidthChange(): void;
  function openAdvanceAppearance(): void;
}

declare namespace EventsPaneNS {
  function init(): void;
  function alignTabOpeningBoxes(): void;

  function disableShowTabList(): void;
  function disableReplaceLastTabWith(): void;
  function newTabUrl(preference: PreferenceClass, disable: boolean, setFocus: boolean): void;
  function syncFromNewTabUrlPref(item: HTMLElement): string | undefined;
  function syncToNewTabUrlPref(value: PreferenceValue, def?: string): string | undefined;
  function onNewTabKeyDown(event: KeyboardEvent): void;
  function editSlideShowKey(): void;
  namespace loadProgressively {
    function syncToCheckBox(item: HTMLInputElement): boolean;
    function syncFromCheckBox(item: HTMLInputElement): number;
    function syncFromPref(item: HTMLInputElement): number;
    function setOnDemandMinValue(item: HTMLInputElement, prefValue: number): void;
    function setOnDemandDisabledState(): void;
  }
  namespace openTabNext {
    let isChanging: boolean;
    function on_change(preference: PreferenceClass): void;
    function on_command(checked: boolean): void;
  }
  function openTabNextInGroup(): void;
}

declare namespace LinksPaneNS {
  function init(): void;
  function externalLinkValue(checked: boolean): void;
  function updateExternalLinkCheckBox(external: HTMLMenuElement): void;
  function singleWindow(enableSingleWindow: boolean): void;
  function updateStatus(itemId: string, testVal: number, test: boolean, newVal: number): void;
  function openFiletypeEditor(): void;
}

declare namespace MenuPaneNS {
  type Dataset = {prefKey: string};
  function init(): void;
  function initializeShortcuts(): void;
  let _slideShow: string;
  function updateShortcuts(aShortcuts: ShortcutParent, aCallBack: (shortcut: MozShortcutClass) => void): void;
  function setSlideShowLabel(): void;
  function editSlideShowKey(): void;
  function toggleLinkLabel(item: HTMLElement): void;
  function setInverseLinkLabel(): void;
  const PrivateBrowsingUtils: MockedExports.PrivateBrowsingUtils;
  function generateTabContextMenuItems(): void;
  function handleSpecialLabels(browserWindow: BrowserWindow): void;
  function sortMenuItems(container: HTMLElement): void;
}

declare namespace MousePaneNS {
  interface ArrowScrollbox extends Omit<MockedGeckoTypes.ArrowScrollbox, "parentNode"> {
    parentNode: SelectControlElement;
    _scrollBox: HTMLElement & {
      ensureElementIsVisible(item: Element): void;
    };
  }

  interface SelectControlElement extends HTMLElement {
    _inited: boolean;
    _tabbox: Tabbox;
    selectedItem: HTMLElement;
    selectedIndex: i32;
    tabbox: Tabbox;
  }

  interface MenuList extends Omit<HTMLElement, "firstChild" | "previousSibling"> {
    firstChild: HTMLMenuElement;
    previousSibling: HTMLInputElement;
    // Allow indexing with string to get number values
    [key: string]: string | number | Element | NodeListOf<Element> | null | undefined | FunctionWithAny | any;
  }
  interface Tabbox extends HTMLElement {
    tabs: SelectControlElement;
    selectedTab: HTMLElement;
  }
  interface OptionsTabs extends HTMLElement {
    _tabbox: Tabbox;
    tabbox: Tabbox;
  }

  let _inited: boolean;
  const clickTab: MenuList;
  const clickTabbar: MenuList;
  function init(): void;
  function tabSelectionChanged(event: MouseEvent & {target: OptionsTabs}): void;
  function panelSelectionChanged(event: Event & {target: SelectControlElement}, panel?: SelectControlElement): void;
  let _options: string[];
  function updatePanelPrefs(aIndex: number): void;
  function updatePref(element: MenuList, prefID: string): void;
  function ensureElementIsVisible(aPopup: ArrowScrollbox): void;
  function resetPreference(checkbox: PreferenceElement | MousePaneNS.MenuList): void;
  function setCheckedState(menulist: MenuList): void;
  function updateDblClickTabbar(pref: PreferenceClass): void;
}

declare namespace PrefWindowNS {
  // add type fror preference elemnt, maybe it is the same as the PreferenceClass
  // it use to create it `customElements.define("preference", Preference);`
  interface PrefEvent extends MouseEvent {
    target: PreferenceClass;
  }
  let _initialized: boolean;
  const pinTabLabel: string;
  let instantApply: boolean;
  function init(): void;
  function updateMaxHeight(): void;
  function initPane(aPaneID: string): void;
  function deinit(): void;
  function handleEvent(aEvent: PrefEvent): void;
  let changes: Set<PreferenceClass>;
  let widthPrefs: (PreferenceClass | string)[];
  let widthChanged: boolean;
  function isInChanges(list: (PreferenceClass | string)[]): boolean;
  function updateChanges(add: boolean, list: PreferenceClass | (PreferenceClass | string)[]): void;
  function blockOnInstantApply(item: PreferenceElement): PreferenceValue | undefined;
  function applyBlockedChanges(): void;
  function updateValueFromElement(): void;
  function resetChanges(): void;
  function updateApplyButton(aEvent: PrefEvent): void;
  function onApply(): void;
  function setButtons(disable: boolean): void;
  function removeItemAndPrefById(id: string): void;
  function removeChild(id: string): void;
  function initBroadcasters(paneID: string): void;
  function updateBroadcaster(aPreference: PreferenceClass, aBroadcaster?: Node): void;
  function setDisabled(itemOrId: Node | PreferenceElement | string, val: boolean | null): void;
  function tabSelectionChanged(event: MouseEvent & {target: MousePaneNS.OptionsTabs}): void;
  function afterShortcutsChanged(): void;
  function syncfrompreference(item: PreferenceElement): boolean;
  function synctopreference(item: PreferenceElement, checkedVal: boolean): PreferenceValue;
}

declare namespace SessionPaneNS {
  interface SessionsTabs extends CustomGroupElement<HTMLElement> {
    parentNode: HTMLElement & {
      selectedTab: HTMLElement;
    };
  }

  function init(): void;
}

/** function in the preference window global scope */
declare namespace Globals {
  type Pref = {name: string; value: any; type: number};
  const PrefFn: Map<number, "" | "getCharPref" | "getIntPref" | "getBoolPref">;
  function getPrefByType(prefName: string): string | number | boolean | null;
  function setPrefByType(prefName: string, newValue: any, browserWindow: BrowserWindow, atImport: boolean): void;
  function setPref(aPref: Pref): void;
  function setPrefAfterImport(aPref: Pref, browserWindow: BrowserWindow): boolean;
  function toggleInstantApply(item: CheckBoxElement): void;
  function loadData(pattern: string[]): void;
  function showPane(paneID: string): void;
  function openHelp(helpTopic: string): void;

  /** shortcuts methods */
  function getKeysForShortcut(shortcut: string, id: string, win?: Window): string | null;
  function _getKeyName(win: Window, aKey: HTMLElement): string;
  function _getLabel(elm: Element | Document, attr: string, value: string): string | null;
  function _getPath(elm: Node | Element): string;

  // pref-filetype.js
  function SelectItemAt(index: number, focus: boolean): void;
  function setButtonDisable(button: HTMLButtonElement, set: boolean): void;
}

type AppearancePane = typeof AppearancePaneNS;
type EventsPane = typeof EventsPaneNS;
type LinksPane = Omit<typeof LinksPaneNS, "updateStatus">;
type MenuPane = typeof MenuPaneNS;
type MousePane = typeof MousePaneNS;
type GeneralPrefWindow = typeof PrefWindowNS;
type SessionPane = typeof SessionPaneNS;

interface CustomGroupElement<T> extends Element {
  _inited: boolean;
  selectedItem?: T | null | undefined;
  selectedIndex: number;
}

interface PanelItemButton extends HTMLButtonElement {
  _tabmix_command_installed: boolean;
}

interface QuerySelectorMap {
  ".content-box": HTMLElement;
  "checkbox": HTMLInputElement;
  "deck": HTMLElement;
  "dialog": HTMLDialogElement & {ownerGlobal: Window};
  "description": HTMLElement;
  'panel-item[action="preferences"]': HTMLElement & {button: PanelItemButton};
  "prefwindow": PrefWindowClass;
  "button[dlgtype='cancel']": HTMLButtonElement & {firstChild: Element};
  ".donate-button-container": HTMLButtonElement;
  '[anonid="dlg-buttons"]': CustomGroupElement<HTMLButtonElement>;
}

interface createXULMap {
  checkbox: HTMLInputElement;
  preference: PreferenceClass;
  preferences: PreferencesListClass;
  radio: HTMLInputElement;
}

interface GetByMap {
  "broadcasters": PrefPaneClass;
  "chk_restoreOnDemand": HTMLInputElement;
  "ClickTab": MousePaneNS.MenuList;
  "ClickTabbar": MousePaneNS.MenuList;
  "dblclick_changesize": CheckboxClass;
  "control": HTMLLabelElement;
  "dlgtype": HTMLButtonElement;
  "editBox": ShortcutEditBox;
  "externalLink": CheckboxClass;
  "externalLinkTarget": HTMLMenuElement;
  "focusTab": HTMLMenuElement;
  "focusTab-box": HTMLElement;
  "focusTab-label": HTMLLabelElement;
  "generalWindowOpen": HTMLMenuElement;
  "hide-unused-shortcuts": HTMLLabelElement;
  "hide-RGB": HTMLLabelElement & {value: string};
  "minWidth": HTMLInputElement;
  "maxWidth": HTMLInputElement;
  "muteTab": CheckboxClass & Element;
  "menu": CustomGroupElement<HTMLElement>;
  readonly "notificationbox": HTMLElement;
  "obs_showTabList": HTMLElement;
  "onLeftDisabled": HTMLLabelElement;
  "onToolbar": HTMLElement;
  "onPlate": HTMLElement;
  "openTabNext": CheckboxClass;
  "openNewTabNext": CheckboxClass;
  "openTabNextInGroup_control": CheckboxClass;
  "openTabNextInGroup": HTMLMenuElement;
  "pane": PrefPaneClass;
  "paneDeck": CustomGroupElement<HTMLInputElement>;
  "paneIncompatible": PrefPaneClass;
  "paneMenu": PrefPaneClass;
  "paneDeckContainer": HTMLElement;
  "preference": PreferenceElement;
  "selector": CustomGroupElement<PrefPaneClass>;
  "restoreOnDemand": HTMLInputElement;
  "searchclipboardfor": CheckboxClass;
  "shortcut-group": ShortcutParent;
  "shortcuts-panel": ShortcutsPanel;
  "singleWindow": CheckboxClass;
  "tabBarTopAbove": HTMLMenuElement;
  "tabclick": CustomGroupElement<HTMLElement>;
  "tabCloseButton": HTMLMenuElement;
  "TabMIxPreferences": PrefWindowClass;
  "tabsScroll": HTMLMenuElement;
  "tabXLeft": CheckboxClass;
  "treeStyleTab.msg": HTMLElement;
  "shortcut_reset": HTMLButtonElement;
  "showBmkTab": CheckboxClass & Element;
  "showBmkTabs": CheckboxClass & Element;
  "unmuteTab": CheckboxClass & Element;
  "session": SessionPaneNS.SessionsTabs;
  "stylestabs": CustomGroupElement<HTMLElement>;
  "stylespanels": Omit<HTMLElement, "childNodes"> & {childNodes: HTMLCollectionBase_G<TabstylepanelClass>};

  "saveSession": MozShortcutClass;
  "saveWindow": MozShortcutClass;
  "slideShow": MozShortcutClass;

  "tab-context-menu-container": HTMLElement & {_columns: HTMLElement[]; _itemsPerColumn: number};

  // for pref-appearance.xhtml
  "color": StyleElement;
  "red": StyleElement;
  "green": StyleElement;
  "blue": StyleElement;
  "opacity": StyleElement;
  "italic": StyleElement;
  "bold": StyleElement;
  "underline": StyleElement;
  "text": StyleElement;
  "bg": StyleElement;
  "textColor": MozColorboxClass;
  "bgColor": MozColorboxClass;
  "bgTopColor": MozColorboxClass;
  "_unloadedTab": HTMLElement;
  "_unreadTab": HTMLElement;
  "_otherTab": HTMLElement;
  "_progressMeter": HTMLElement;
  "useThis": StyleElement;

  // pref-filetype.xhtml
  "filetypeList": RichListBox;
  "filetypeEntry": HTMLInputElement;
  "filetypeEdit": HTMLButtonElement;
  "filetypeDelete": HTMLButtonElement;
  "filetypeAdd": HTMLButtonElement;
}

interface GetByTagNameMap {
  key: HTMLElement;
  label: Omit<HTMLInputElement, "value"> & {value: string | null};
  preference: PreferenceClass;
  preferences: PreferencesListClass;
  prefpane: PrefPaneClass;
  tabbox: MousePaneNS.Tabbox;
}

interface BrowserWindow extends MockedGeckoTypes.BrowserWindow {
  gCustomizeMode: {enter: () => void};
  gNavigatorBundle: gNavigatorBundle;
  gTMPprefObserver: gTMPprefObserver;
  Tabmix: TabmixGlobal;
  TabmixContext: TabmixContextTypes;
}

interface TabmixKnownModules {
  "chrome://tabmix-resource/content/bootstrap/ChromeManifest.sys.mjs": {ChromeManifest: TabmixModules.ChromeManifestClass};
  "chrome://tabmix-resource/content/bootstrap/Overlays.sys.mjs": {Overlays: OverlaysModule.OverlaysClass};
  "resource://gre/modules/DeferredTask.sys.mjs": {DeferredTask: DeferredTaskConstructor};
  "resource://gre/modules/ExtensionShortcuts.sys.mjs": {ExtensionShortcutKeyMap: typeof ExtensionShortcutKeyMap};
}

interface TabmixGlobal {
  getTopWin(): BrowserWindow;
}

declare var Tabmix: TabmixGlobal;
declare var TabmixSvc: TabmixSvcModule.TabmixSvc;

// lazy getters
declare var gPreferenceList: string[];
declare var shortcutKeyMapPromise: Promise<Map<string, any>>;
