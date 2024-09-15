/// <reference types="./general.d.ts" />
/// <reference types="./tabmix.d.ts" />
/// <reference types="./customDialog.d.ts" />

interface Document {
  importNode(node: DocumentFragment, deep?: boolean): HTMLElement;
}

//  this types apply to document.documentElement that is PrefWindow in prefs-ce.js
interface Element {
  blur: () => void;
  firstChild: Element;
  focus: () => void;
  instantApply: boolean;
  type: string;
}

declare namespace MockedExports {
  // these types are missing from gecko.d.ts but exist in lib.gecko.xpcom.d.ts
  interface nsIFilePicker {
    readonly filterText: 4;
    modeOpen: 0;
    modeSave: 1;
    modeGetFolder: 2;
    modeOpenMultiple: 3;
    returnCancel: 1;
  }

  interface FilePicker {
    appendFilters: (appendFilters: number) => void;
    defaultExtension: string;
    defaultString: string;
  }
}

interface XULCommandDispatcher {
  advanceFocusIntoSubtree: (elt: PrefWindow | Element) => void;
}

interface Window {
  _sminstalled: boolean;
  $<K extends keyof GetByMap>(selectors: K | string): K extends keyof GetByMap ? GetByMap[K] : HTMLElement | null;
  CustomizableUI: typeof CustomizableUI;
}

interface EventTarget {
  contentDocument: MockedGeckoTypes.ChromeBrowser & Document;
}

interface IgIncompatiblePane {
  lastSelected: string;
  paneButton: PrefPane;
  init: (prefWindow: PrefWindow) => void;
  deinit: () => void;
  handleEvent: (event: Event) => void;
  hide_IncompatibleNotice: (aHide: boolean, aFocus: boolean) => void;
}

interface WindowProxy {
  gIncompatiblePane: IgIncompatiblePane;
  /** @deprecated — removed from firefox on version 87 */
  getHtmlBrowser: () => EventTarget;
  Tabmix: Tabmix;
}

/** classes in prefs-ce.js */

interface Preferences {
  childNodes: NodeList & Preference[];
}

interface Preference {
  parentNode: Preferences;
}

interface PrefPane {}

interface PrefWindow {
  buttons: string;
  mStrBundle: nsIStringBundle;
}

interface MozShortcutEditBox extends HTMLInputElement {
  shortcut: MozShortcut;
}

interface MozShortcut {}

interface MozShortcutParent extends HTMLFieldSetElement {
  keys: {slideShow: string} & Record<string, string>;
}

interface CustomGroupElement<T> extends Element {
  selectedItem: T | null;
  selectedIndex: number;
}

interface PanelItemButton extends HTMLButtonElement {
  _tabmix_command_installed: boolean;
}

interface QuerySelectorMap {
  'panel-item[action="preferences"]': HTMLElement & {button: PanelItemButton};
}

interface GetByMap {
  control: Preference;
  editBox: MozShortcutEditBox;
  pane: PrefPane;
  paneDeck: CustomGroupElement<HTMLInputElement>;
  preference: Preference;
  selector: CustomGroupElement<PrefPane>;
  TabMIxPreferences: PrefWindow;
  "shortcut-group": MozShortcutParent;
}

interface Functions {
  getById<K extends keyof GetByMap | string>(selectors: K): K extends keyof GetByMap ? GetByMap[K] : any | null;
}

interface Tabmix {
  openOptionsDialog: (panel?: string) => void;
  reportError: (ex: unknown) => void;
}

// TODO: fix this
declare var Shortcuts: any;
declare var Tabmix: any;
declare var TabmixChromeUtils: any;

declare var TabmixSvc: TabmixModules.TabmixSvc;

// lazy getters
declare var gPreferenceList: string[];
declare var shortcutKeyMapPromise: Promise<Map<string, any>>;
