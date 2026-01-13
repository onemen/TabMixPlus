// / <reference path="../../../../@types/prefs_ce.d.ts" />

/* exported PrefWindow */
/* eslint no-var: 2, prefer-const: 2, no-new-func: 0, class-methods-use-this: 0 */
"use strict";

const {AppConstants} = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");
const {ChromeManifest} = ChromeUtils.importESModule(
  "chrome://tabmix-resource/content/bootstrap/ChromeManifest.sys.mjs"
);
const {Overlays} = ChromeUtils.importESModule(
  "chrome://tabmix-resource/content/bootstrap/Overlays.sys.mjs"
);

/** @type {BrowserDOMWindowModule.Lazy} */ // @ts-ignore
const localLazy = {};
ChromeUtils.defineESModuleGetters(localLazy, {
  initializeChangeCodeClass: "chrome://tabmix-resource/content/Changecode.sys.mjs",
});

// delay connectedCallback() of tabs till tabs inserted into DOM so it won't be run multiple times and cause trouble.
let delayTabsConnectedCallback = false;
const TabsClass = customElements.get("tabs");
if (TabsClass) {
  TabsClass.prototype.delayConnectedCallback = function () {
    return delayTabsConnectedCallback;
  };
}

const TabClass = customElements.get("tab");
if (TabClass) {
  Object.defineProperty(TabClass.prototype, "container", {
    get() {
      return this.parentNode;
    },
  });
}

/** @type {GetFunction} */
function getFunction(element, eventType, eventCode) {
  // @ts-ignore
  let fn = element[eventType];
  if (!fn) {
    const code = `function ${eventType}(event) {${eventCode}}`;
    fn = Tabmix.makeCode(code, null, "", Tabmix._sandbox);
    // @ts-ignore
    element[eventType] = fn;
  }
  return fn;
}

const PREFS = Services.prefs;

/** @implements {PreferencesListClass} */
class Preferences extends MozXULElement {
  service = PREFS;
  rootBranch = PREFS;
  defaultBranch = this.service.getDefaultBranch("");
  rootBranchInternal = PREFS;

  /*
   * We want to call _constructAfterChildren after all child
   * <preference> elements have been constructed. To do this, we get
   * and store the node list of all child <preference> elements in the
   * constructor, and maintain a count which is incremented in the
   * constructor of <preference>. _constructAfterChildren is called
   * when the count matches the length of the list.
   */
  _constructedChildrenCount = 0;

  /*
   * Some <preference> elements are added dynamically after
   *   _constructAfterChildren has already been called - we want to
   *   avoid looping over all of them again in this case so we remember
   *   if we already called it.
   */
  _constructAfterChildrenCalled = false;

  constructor() {
    super();

    // Bug 1570744
    /** @type {PreferencesListClass["observerFunction"]} */
    this.observerFunction = (...args) => {
      this.observe(...args);
    };

    this._preferenceChildren = this.getElementsByTagName("preference");
  }

  get type() {
    return document.documentElement.type || "";
  }

  get instantApply() {
    const doc = document.documentElement;
    if (!doc) return false;
    return this.type == "child" ?
        doc.instantApply
      : doc.instantApply ||
          this.rootBranch.getBoolPref(
            "browser.preferences.instantApply",
            /Mac/.test(navigator.platform)
          );
  }

  /** @type {PreferencesListClass["observe"]} */
  observe(_aSubject, _aTopic, aData) {
    for (const preference of this._preferenceChildren) {
      if (preference?.name == aData) {
        preference.value = preference.valueFromPreferences;
      }
    }
  }

  _constructAfterChildren() {
    // This method will be called after the last of the child
    // <preference> elements is constructed. Its purpose is to propagate
    // the values to the associated form elements. Sometimes the code for
    // some <preference> initializers depend on other <preference> elements
    // being initialized so we wait and call updateElements on all of them
    // once the last one has been constructed. See bugs 997570 and 992185.

    const elements = this.getElementsByTagName("preference");
    for (const element of elements) {
      element.updateElements();
    }

    this._constructAfterChildrenCalled = true;
  }

  /** @type {PreferencesListClass["fireChangedEvent"]} */
  fireChangedEvent(aPreference) {
    // Value changed, synthesize an event
    try {
      const event = document.createEvent("Events");
      event.initEvent("change", true, true);
      aPreference.dispatchEvent(event);
    } catch (e) {
      console.error(e);
    }
  }
}

/** @implements {PreferenceClass} */
class Preference extends MozXULElement {
  _constructed = false;
  _running = false;
  _useDefault = false;
  batching = false;

  /** @type {PreferenceValue} */
  _value = null;

  constructor() {
    super();

    this.disconnectedCallback = this.disconnectedCallback.bind(this);

    this.addEventListener("change", () => {
      this.updateElements();
    });
  }

  connectedCallback() {
    window.addEventListener("unload", this.disconnectedCallback);

    // if the element has been inserted without the name attribute set,
    // we have nothing to do here
    if (!this.name) {
      return;
    }

    this.preferences.rootBranchInternal.addObserver(this.name, this.preferences.observerFunction);
    // In non-instant apply mode, we must try and use the last saved state
    // from any previous opens of a child dialog instead of the value from
    // preferences, to pick up any edits a user may have made.
    if (
      this.preferences.type == "child" &&
      !this.instantApply &&
      window.opener &&
      window.opener.document.nodePrincipal.isSystemPrincipal
    ) {
      const pdoc = window.opener.document;

      // Try to find a preference element for the same preference.
      let preference = null;
      const parentPreferences = pdoc.getElementsByTagName("preferences");
      for (const parent of parentPreferences) {
        const parentPrefs = parent.getElementsByAttribute("name", this.name);
        for (const parentPref of parentPrefs) {
          if (parentPref.localName == "preference") {
            preference = parentPref;
            break;
          }
        }
        if (preference) {
          break;
        }
      }

      // Don't use the value setter here, we don't want updateElements to be prematurely fired.
      this._value = preference ? preference.value : this.valueFromPreferences;
    } else {
      this._value = this.valueFromPreferences;
    }
    if (this.preferences._constructAfterChildrenCalled) {
      // This <preference> was added after _constructAfterChildren() was already called.
      // We can directly call updateElements().
      this.updateElements();
      return;
    }
    this.preferences._constructedChildrenCount++;
    if (this.preferences._constructedChildrenCount == this.preferences._preferenceChildren.length) {
      // This is the last <preference>, time to updateElements() on all of them.
      this.preferences._constructAfterChildren();
    }
  }

  disconnectedCallback() {
    this.preferences.rootBranchInternal.removeObserver(
      this.name,
      this.preferences.observerFunction
    );
  }

  get instantApply() {
    if (this.getAttribute("instantApply") == "false") {
      return false;
    }

    return this.getAttribute("instantApply") == "true" || this.preferences.instantApply;
  }

  get preferences() {
    /** @type {PreferencesListClass} */ // @ts-expect-error - override default parentNode
    const parentNode = this.parentNode;
    return parentNode;
  }

  get name() {
    return this.getAttribute("name") ?? "";
  }

  set name(val) {
    if (val == this.name) {
      return;
    }

    this.preferences.rootBranchInternal.removeObserver(
      this.name,
      this.preferences.observerFunction
    );
    this.setAttribute("name", val);
    this.preferences.rootBranchInternal.addObserver(val, this.preferences.observerFunction);
  }

  get type() {
    return this.getAttribute("type") ?? "";
  }

  set type(val) {
    this.setAttribute("type", val);
  }

  get inverted() {
    return this.getAttribute("inverted") == "true";
  }

  set inverted(val) {
    this.setAttribute("inverted", val);
  }

  get readonly() {
    return this.getAttribute("readonly") == "true";
  }

  set readonly(val) {
    this.setAttribute("readonly", val);
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._setValue(val);
  }

  get prefExists() {
    return typeof TabmixSvc.prefs.get(this.name) !== "undefined";
  }

  get booleanValue() {
    if (typeof this.value != "boolean" && this.prefExists) {
      throw new Error(`Tabmix:\n ${this.name} is not a boolean preference`);
    }
    /** @type {boolean} */ // @ts-ignore - we check above that is boolean
    const value = this.value;
    return value;
  }

  get numberValue() {
    if (typeof this.value != "number" && this.prefExists) {
      throw new Error(`Tabmix:\n ${this.name} is not a number preference`);
    }
    /** @type {number} */ // @ts-ignore - we check above that is number
    const value = this.value;
    return value;
  }

  get stringValue() {
    if (typeof this.value != "string" && this.prefExists) {
      throw new Error(`Tabmix:\n ${this.name} is not a string preference`);
    }
    /** @type {string} */ // @ts-ignore - we check above that is string
    const value = this.value;
    return value;
  }

  get locked() {
    return this.preferences.rootBranch.prefIsLocked(this.name);
  }

  get disabled() {
    return this.hasAttribute("disabled");
  }

  set disabled(val) {
    this.toggleAttribute("disabled", Boolean(val));

    if (!this.id) {
      return;
    }

    const elements = document.getElementsByAttribute("preference", this.id);
    for (const element of elements) {
      element.disabled = val;
      const labels = document.getElementsByAttribute("control", element.id);
      for (const label of labels) {
        label.disabled = val;
      }
    }
  }

  get tabIndex() {
    return parseInt(this.getAttribute("tabindex") ?? "0");
  }

  set tabIndex(val) {
    if (val) {
      this.setAttribute("tabindex", val);
    } else {
      this.removeAttribute("tabindex");
    }

    if (!this.id) {
      return;
    }

    const elements = document.getElementsByAttribute("preference", this.id);
    for (const element of elements) {
      element.tabIndex = val;
      const labels = document.getElementsByAttribute("control", element.id);
      for (const label of labels) {
        label.tabIndex = val;
      }
    }
  }

  get hasUserValue() {
    return this.preferences.rootBranch.prefHasUserValue(this.name) && this.value !== undefined;
  }

  get defaultValue() {
    this._useDefault = true;
    const val = this.valueFromPreferences;
    this._useDefault = false;
    return val;
  }

  get _branch() {
    return this._useDefault ? this.preferences.defaultBranch : this.preferences.rootBranch;
  }

  get valueFromPreferences() {
    try {
      // Force a resync of value with preferences.
      switch (this.type) {
        case "int":
          return this._branch.getIntPref(this.name);
        case "bool": {
          const val = this._branch.getBoolPref(this.name);
          return this.inverted ? !val : val;
        }
        case "wstring":
          return this._branch.getComplexValue(this.name, Ci.nsIPrefLocalizedString).data;
        case "string":
        case "unichar":
          return this._branch.getStringPref(this.name);
        case "fontname": {
          const family = this._branch.getStringPref(this.name);
          const fontEnumerator = Cc["@mozilla.org/gfx/fontenumerator;1"].createInstance(
            Ci.nsIFontEnumerator
          );
          return fontEnumerator.getStandardFamilyName(family);
        }
        case "file":
          return this._branch.getComplexValue(this.name, Ci.nsIFile);
        default:
          this._reportUnknownType();
      }
    } catch {}
    return null;
  }

  set valueFromPreferences(val) {
    // Exit early if nothing to do.
    if (this.readonly || this.valueFromPreferences == val) {
      return;
    }

    // The special value undefined means 'reset preference to default'.
    if (val === undefined) {
      this.preferences.rootBranch.clearUserPref(this.name);
      return;
    }

    // Force a resync of preferences with value.
    switch (this.type) {
      case "int":
        this.preferences.rootBranch.setIntPref(this.name, Number(val));
        break;
      case "bool":
        this.preferences.rootBranch.setBoolPref(this.name, Boolean(this.inverted ? !val : val));
        break;
      case "wstring": {
        const pls = Cc["@mozilla.org/pref-localizedstring;1"].createInstance(
          Ci.nsIPrefLocalizedString
        );
        pls.data = String(val);
        this.preferences.rootBranch.setComplexValue(this.name, Ci.nsIPrefLocalizedString, pls);
        break;
      }
      case "string":
      case "unichar":
      case "fontname":
        this.preferences.rootBranch.setStringPref(this.name, String(val));
        break;
      case "file": {
        let lf;
        if (typeof val == "string") {
          lf = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
          lf.persistentDescriptor = val;
          if (!lf.exists()) {
            lf.initWithPath(val);
          }
        } else if (val instanceof Ci.nsIFile) {
          lf = val.QueryInterface?.(Ci.nsIFile);
        } else {
          throw new Error("Unsupported file type: " + val);
        }
        if (lf instanceof Ci.nsIFile) {
          this.preferences.rootBranch.setComplexValue(this.name, Ci.nsIFile, lf);
        }
        break;
      }
      default:
        this._reportUnknownType();
    }
    if (!this.batching) {
      this.preferences.service.savePrefFile(null);
    }
  }

  /** @type {PreferenceClass["_setValue"]} */
  _setValue(aValue) {
    if (this.value !== aValue) {
      this._value = aValue;
      if (this.instantApply) {
        this.valueFromPreferences = aValue;
      }

      this.preferences.fireChangedEvent(this);
    }
    return aValue;
  }

  _reportUnknownType() {
    const msg =
      "<preference> with id='" +
      this.id +
      "' and name='" +
      this.name +
      "' has unknown type '" +
      this.type +
      "'.";
    Services.console.logStringMessage(msg);
  }

  /** @type {PreferenceClass["setElementValue"]} */
  setElementValue(aElement) {
    if (this.locked) {
      aElement.disabled = true;
    }

    if (!this.isElementEditable(aElement)) {
      return;
    }

    let rv;
    const onsyncfrompreference =
      aElement.hasAttribute("onsyncfrompreference") &&
      aElement.getAttribute("onsyncfrompreference");
    if (onsyncfrompreference) {
      // Value changed, synthesize an event
      try {
        const f = getFunction(aElement, "syncfrompreference", onsyncfrompreference);
        const event = document.createEvent("Events");
        event.initEvent("syncfrompreference", true, true);
        rv = f.call(aElement, event);
      } catch (e) {
        console.error(e);
      }
    }
    let val = rv;
    if (val === undefined) {
      val = this.instantApply ? this.valueFromPreferences : this.value;
    }

    // if the preference is marked for reset, show default value in UI
    if (val === undefined) {
      val = this.defaultValue;
    }

    /*
     * Initialize a UI element property with a value. Handles the case
     * where an element has not yet had a XBL binding attached for it and
     * the property setter does not yet exist by setting the same attribute
     * on the XUL element using DOM apis and assuming the element's
     * constructor or property getters appropriately handle this state.
     */

    /** @type {typeof PreferenceNS.setValue} */
    function setValue(element, attribute, value) {
      if (attribute in element) {
        // @ts-expect-error - `attribute in element` is safe
        element[attribute] = value;
      } else {
        element.setAttribute(attribute, value);
      }
    }
    if (aElement.localName == "checkbox") {
      setValue(aElement, "checked", val);
    } else if (aElement.localName == "colorpicker") {
      setValue(aElement, "color", val);
    } else if (aElement.localName == "input") {
      // XXXmano Bug 303998: Avoid a caret placement issue if either the
      // preference observer or its setter calls updateElements as a result
      // of the input event handler.
      if (aElement.value !== val) {
        setValue(aElement, "value", val);
      }
    } else {
      setValue(aElement, "value", val);
    }
  }

  /** @type {PreferenceClass["getElementValue"]} */
  getElementValue(aElement) {
    const onsynctopreference =
      aElement.hasAttribute("onsynctopreference") && aElement.getAttribute("onsynctopreference");
    if (onsynctopreference) {
      // Value changed, synthesize an event
      try {
        const f = getFunction(aElement, "synctopreference", onsynctopreference);
        const event = document.createEvent("Events");
        event.initEvent("synctopreference", true, true);
        const rv = f.call(aElement, event);
        if (rv !== undefined) {
          return rv;
        }
      } catch (e) {
        console.error(e);
      }
    }

    const preference = $Pref(aElement.getAttribute("preference"));
    return preference.getValueByType(aElement);
  }

  /** @type {PreferenceClass["getValueByType"]} */
  getValueByType(aElement) {
    /*
     * Read the value of an attribute from an element, assuming the
     * attribute is a property on the element's node API. If the property
     * is not present in the API, then assume its value is contained in
     * an attribute, as is the case before a binding has been attached.
     */

    /** @type {typeof PreferenceNS.getValue} */
    function getValue(element, attribute) {
      if (attribute in element) {
        // @ts-expect-error - `attribute in element` is safe
        return element[attribute];
      }
      return element.getAttribute(attribute);
    }

    /** @type {Record<string, string>} */
    const attributeMap = {
      checkbox: "checked",
      colorpicker: "color",
    };

    const value = getValue(aElement, attributeMap[aElement.localName] ?? "value");
    switch (this.type) {
      case "int":
        return parseInt(value?.toString() ?? "0", 10) || 0;
      case "bool":
        return typeof value == "boolean" ? value : value == "true";
    }
    return value;
  }

  /** @type {PreferenceClass["isElementEditable"]} */
  isElementEditable(aElement) {
    switch (aElement.localName) {
      case "checkbox":
      case "colorpicker":
      case "radiogroup":
      case "input":
      case "richlistitem":
      case "richlistbox":
      case "menulist":
        return true;
    }
    return aElement.getAttribute("preference-editable") == "true";
  }

  updateElements() {
    if (!this.id) {
      return;
    }

    // This "change" event handler tracks changes made to preferences by
    // sources other than the user in this window.
    const elements = document.getElementsByAttribute("preference", this.id);
    for (const element of elements) {
      this.setElementValue(element);
    }
  }
}

/** @implements {PrefPaneClass} */
class PrefPane extends MozXULElement {
  _resizeObserver = null;
  _initialized = false;
  _loaded = false;
  value = "";

  /** @type {Set<PreferenceElement>} */
  _deferredValueUpdateElements = new Set();

  constructor() {
    super();

    this.addEventListener("command", (/** @type {PaneEvent} */ event) => {
      // This "command" event handler tracks changes made to preferences by
      // the user in this window.
      if (event.sourceEvent) {
        event = event.sourceEvent;
      }

      this.userChangedValue(event.target);
    });

    this.addEventListener("select", (/** @type {PaneEvent} */ event) => {
      // This "select" event handler tracks changes made to colorpicker
      // preferences by the user in this window.
      if (event.target.localName == "colorpicker") {
        this.userChangedValue(event.target);
      }
    });

    this.addEventListener("change", (/** @type {PaneEvent} */ event) => {
      // This "change" event handler tracks changes made to preferences by
      // the user in this window.
      this.userChangedValue(event.target);
    });

    this.addEventListener("input", (/** @type {PaneEvent} */ event) => {
      // This "input" event handler tracks changes made to preferences by
      // the user in this window.
      this.userChangedValue(event.target);
    });

    this.addEventListener("paneload", () => {
      // Initialize all values from preferences.
      const elements = this.preferenceElements;
      for (const element of elements) {
        try {
          const preference = this.preferenceForElement(element);
          preference.setElementValue(element);
        } catch {
          dump("*** No preference found for " + element.getAttribute("preference") + "\n");
        }
      }
    });
  }

  static get inheritedAttributes() {
    return {".content-box": "flex"};
  }

  get fragment() {
    if (!this._fragment) {
      this._fragment = MozXULElement.parseXULToFragment(`
        <vbox class="content-box">
        </vbox>
      `);
    }
    return this.ownerDocument.importNode(this._fragment, true);
  }

  connectedCallback() {
    if (this._initialized || !this.loaded) {
      return;
    }

    const fragment = this.fragment;
    this._content = fragment.querySelector(".content-box");
    /** @type {HTMLCollectionBase_G<PanelItemButton>} */ // @ts-expect-error - override default Node type
    const childNodes = [...this.childNodes];
    this.appendChild(fragment);
    this._content.append(...childNodes);

    this.initializeAttributeInheritance();

    this._initialized = true;
  }

  get src() {
    return this.getAttribute("src") ?? "";
  }

  set src(val) {
    this.setAttribute("src", val);
  }

  get selected() {
    return this.getAttribute("selected") == "true";
  }

  set selected(val) {
    this.setAttribute("selected", val);
  }

  get image() {
    return this.getAttribute("image") ?? "";
  }

  set image(val) {
    this.setAttribute("image", val);
  }

  get label() {
    return this.getAttribute("label") ?? "";
  }

  set label(val) {
    this.setAttribute("label", val);
  }

  get preferenceElements() {
    return this.getElementsByAttribute("preference", "*");
  }

  get preferences() {
    return this.getElementsByTagName("preference");
  }

  get helpTopic() {
    // if there are tabs, and the selected tab provides a helpTopic, return that
    const box = this.getElementsByTagName("tabbox");
    if (box[0]) {
      const tab = box[0].selectedTab;
      if (tab && tab.hasAttribute("helpTopic")) {
        return tab.getAttribute("helpTopic") ?? "";
      }
    }

    // otherwise, return the helpTopic of the current panel
    return this.getAttribute("helpTopic") ?? "";
  }

  get loaded() {
    return !this.src ? true : this._loaded;
  }

  set loaded(val) {
    this._loaded = val;
  }

  get DeferredTask() {
    const {DeferredTask} = ChromeUtils.importESModule(
      "resource://gre/modules/DeferredTask.sys.mjs"
    );
    Object.defineProperty(this, "DeferredTask", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: DeferredTask,
    });
    return DeferredTask;
  }

  get contentHeight() {
    const {
      height = "0",
      marginTop = "0",
      marginBottom = "0",
    } = window.getComputedStyle(this._content) ?? {};
    return parseInt(height) + parseInt(marginTop) + parseInt(marginBottom);
  }

  get contentWidth() {
    const {
      width = "0",
      marginLeft = "0",
      marginRight = "0",
    } = window.getComputedStyle(this._content) ?? {};
    return parseInt(width) + parseInt(marginLeft) + parseInt(marginRight);
  }

  /** @type {PrefPaneClass["writePreferences"]} */
  writePreferences(aFlushToDisk) {
    if (!this.loaded) {
      return;
    }
    // Write all values to preferences.
    if (this._deferredValueUpdateElements.size) {
      this._finalizeDeferredElements();
    }

    const preferences = this.preferences;
    for (const preference of preferences) {
      preference.batching = true;
      preference.valueFromPreferences = preference.value;
      preference.batching = false;
    }
    if (aFlushToDisk) {
      Services.prefs.savePrefFile(null);
    }
  }

  /** @type {PrefPaneClass["preferenceForElement"]} */
  preferenceForElement(aElement) {
    return $Pref(aElement.getAttribute("preference"));
  }

  /** @type {PrefPaneClass["getPreferenceElement"]} */
  getPreferenceElement(aStartElement) {
    const preferenceAncestor = aStartElement.closest("[preference]");
    return preferenceAncestor ? preferenceAncestor : aStartElement;
  }

  /** @type {PrefPaneClass["_deferredValueUpdate"]} */
  _deferredValueUpdate(aElement) {
    delete aElement._deferredValueUpdateTask;
    const preference = $Pref(aElement.getAttribute("preference"));
    const prefVal = preference.getElementValue(aElement);
    preference.value = prefVal;
    this._deferredValueUpdateElements.delete(aElement);
  }

  _finalizeDeferredElements() {
    for (const el of this._deferredValueUpdateElements) {
      if (el._deferredValueUpdateTask) {
        el._deferredValueUpdateTask.finalize();
      }
    }
  }

  /** @type {PrefPaneClass["userChangedValue"]} */
  userChangedValue(aElement) {
    const element = this.getPreferenceElement(aElement);
    if (element.hasAttribute("preference")) {
      if (element.getAttribute("delayprefsave") != "true") {
        const preference = $Pref(element.getAttribute("preference"));
        const prefVal = preference.getElementValue(element);
        preference.value = prefVal;
      } else {
        if (!element._deferredValueUpdateTask) {
          element._deferredValueUpdateTask = new this.DeferredTask(
            this._deferredValueUpdate.bind(this, element),
            1000
          );
          this._deferredValueUpdateElements.add(element);
        } else {
          // Each time the preference is changed, restart the delay.
          element._deferredValueUpdateTask.disarm();
        }
        element._deferredValueUpdateTask.arm();
      }
    }
  }
}

/** @type {MozXULElement} */ // @ts-ignore
const _MozRadio = customElements.get("radio");

class PaneButton extends _MozRadio {
  static get thisInheritedAttributes() {
    return {
      ".paneButtonIcon": "src",
      ".paneButtonLabel": "value=label",
    };
  }

  static get inheritedAttributes() {
    return Object.assign({}, super.inheritedAttributes, PaneButton.thisInheritedAttributes);
  }

  /**
   * Overrides super.getElementForAttrInheritance. Used in setting up attribute
   * inheritance. Takes a selector and returns an element for that selector. If
   * the selector is in thisInheritedAttributes it queries the light DOM,
   * otherwise the selector is in super.inheritedAttributes and the shadow DOM
   * is queried. See bug 1545824.
   *
   * @param {string} selector A selector used to query an element.
   * @returns {Element} The element found by the selector.
   */
  getElementForAttrInheritance(selector) {
    if (selector in PaneButton.thisInheritedAttributes) {
      return this.querySelector(selector);
    }
    return super.getElementForAttrInheritance(selector);
  }

  get fragment() {
    if (!this._fragment) {
      this._fragment = MozXULElement.parseXULToFragment(`
          <image class="paneButtonIcon"/>
          <label class="paneButtonLabel"/>
      `);
    }
    return this.ownerDocument.importNode(this._fragment, true);
  }

  connectedCallback() {
    if (this._initialized) {
      return;
    }

    super.connectedCallback();
    this.appendChild(this.fragment);
    this.initializeAttributeInheritance();
    this._initialized = true;
  }

  get disabled() {
    return this.hasAttribute("disabled");
  }

  set disabled(val) {
    this.toggleAttribute("disabled", Boolean(val));
  }

  get tabIndex() {
    return parseInt(this.getAttribute("tabindex") ?? "") || 0;
  }

  set tabIndex(val) {
    if (val) {
      this.setAttribute("tabindex", val);
    } else {
      this.removeAttribute("tabindex");
    }
  }

  get label() {
    return this.getAttribute("label") ?? "";
  }

  set label(val) {
    this.setAttribute("label", val);
  }

  get crop() {
    return this.getAttribute("crop") ?? "";
  }

  set crop(val) {
    this.setAttribute("crop", val);
  }

  get image() {
    return this.getAttribute("image") ?? "";
  }

  set image(val) {
    this.setAttribute("image", val);
  }

  get command() {
    return this.getAttribute("command") ?? "";
  }

  set command(val) {
    this.setAttribute("command", val);
  }

  get accessKey() {
    return this.getAttribute("accesskey") ?? "";
  }

  set accessKey(val) {
    // Always store on the control
    this.setAttribute("accesskey", val);
    // If there is a label, change the accesskey on the labelElement
    // if it's also set there
    const labelElement = document.getElementsByAttribute("control", this.id)[0];
    if (labelElement) {
      labelElement.setAttribute("accesskey", val);
    }
  }
}

/** @implements {PrefWindowClass} */
class PrefWindow extends MozXULElement {
  /*
   * Derived bindings can set this to true to cause us to skip
   * reading the browser.preferences.instantApply pref in the constructor.
   * Then they can set instantApply to their wished value. -->
   */
  _instantApplyInitialized = false;

  /** @type {PrefWindowClass["_buttons"]} */ // @ts-expect-error - set buttons type
  _buttons = {};
  buttons = "";

  // Controls whether changed pref values take effect immediately.
  instantApply = false;

  /** @type {PrefPaneClass | null} */
  _currentPane = null;

  /** @type {Element[]} */
  _l10nButtons = [];

  _initialized = false;

  constructor() {
    super();

    this.disconnectedCallback = this.disconnectedCallback.bind(this);

    localLazy.initializeChangeCodeClass(Tabmix, {obj: window});
    this.fixMozTabsForZen();

    this.addEventListener("dialogaccept", () => {
      if (!this._fireEvent("beforeaccept", this)) {
        return false;
      }

      if (
        this.type == "child" &&
        window.opener &&
        window.opener.document.nodePrincipal.isSystemPrincipal
      ) {
        const pdocEl = window.opener.document.documentElement;
        if (pdocEl.instantApply) {
          const panes = this.preferencePanes;
          for (const pane of panes) {
            pane.writePreferences(true);
          }
        } else {
          // Clone all the preferences elements from the child document and
          // insert them into the pane collection of the parent.
          const pdoc = window.opener.document;
          if (pdoc.documentElement.localName == "prefwindow") {
            /** @type {PrefWindowClass} */ // @ts-expect-error
            const documentElement = pdoc.documentElement;
            const currentPane = documentElement.currentPane;
            const id = window.location.href + "#childprefs";
            let childPrefs = pdoc.getElementById(id, "_PREF_LIST_CLASS_");
            if (!childPrefs) {
              childPrefs = pdoc.createXULElement("preferences");
              currentPane.appendChild(childPrefs);
              childPrefs.id = id;
            }
            const panes = this.preferencePanes;
            for (const {preferences} of panes) {
              for (const childPreference of preferences) {
                // Try to find a preference element for the same preference.
                let preference = null;
                const parentPreferences = pdoc.getElementsByTagName("preferences");
                for (const parent of parentPreferences) {
                  const parentPrefs = parent.getElementsByAttribute("name", childPreference.name);
                  for (const parentPref of parentPrefs) {
                    if (parentPref.localName == "preference") {
                      preference = parentPref;
                      break;
                    }
                  }
                  if (preference) {
                    break;
                  }
                }
                if (!preference) {
                  // No matching preference in the parent window.
                  preference = pdoc.createXULElement("preference");
                  childPrefs.appendChild(preference);
                  preference.name = childPreference.name;
                  preference.type = childPreference.type;
                  preference.inverted = childPreference.inverted;
                  preference.readonly = childPreference.readonly;
                  preference.disabled = childPreference.disabled;
                }
                preference.value = childPreference.value;
              }
            }
          }
        }
      } else {
        const panes = this.preferencePanes;
        for (const pane of panes) {
          pane.writePreferences(true);
        }

        Services.prefs.savePrefFile(null);
      }

      return true;
    });

    this.addEventListener("command", (/** @type {WindowEvent} */ event) => {
      const paneId = event.originalTarget.getAttribute("pane");
      if (paneId) {
        const pane = $Pane(paneId);
        this.showPane(pane);
      }
    });

    this.addEventListener(
      "keypress",
      (/** @type {WindowEvent} */ event) => {
        if ((event.ctrlKey || event.metaKey) && event.key == "w") {
          if (this.instantApply) {
            window.close();
          }

          event.stopPropagation();
          event.preventDefault();
        } else if (AppConstants.platform == "win" && event.key == "F1") {
          const helpButton = this.getButton("help");
          if (helpButton.disabled || helpButton.hidden) {
            return;
          }

          this._fireEvent("dialoghelp", this);
          event.stopPropagation();
          event.preventDefault();
        }
      },
      true
    );
  }

  fixMozTabsForZen(doc = document) {
    // workaround for bug in Zen https://github.com/zen-browser/desktop/issues/5668
    // fixed in version 1.10.3t
    if (!TabmixSvc.isZen || Tabmix.isVersion({zen: "1.10.3t"})) {
      return;
    }

    const MozTabs = doc.ownerGlobal?.customElements.get("tabs");
    // @ts-ignore
    const setter = MozTabs?.prototype.__lookupSetter__("selectedIndex")?.toString();
    // @ts-ignore
    const getter = MozTabs?.prototype.__lookupGetter__("selectedIndex");
    if (!getter || !setter || setter.includes("typeof gZenWorkspaces")) {
      return;
    }

    const code = setter
      .replace(
        "for (let otherTab of gZenWorkspaces.allStoredTabs) {",
        `const tabs = typeof gZenWorkspaces === "object" ? gZenWorkspaces.allStoredTabs : this.allTabs;
        for (let otherTab of tabs) {`
      )
      .replace("set selectedIndex", "function selectedIndex");

    const descriptor = {
      get: getter,
      set: Tabmix.makeCode(code, null, "", Tabmix._sandbox),
      enumerable: true,
      configurable: true,
    };
    Object.defineProperty(MozTabs?.prototype, "selectedIndex", descriptor);
  }

  get fragment() {
    if (!this._fragment) {
      this._fragment = MozXULElement.parseXULToFragment(
        `
        <windowdragbox orient="vertical">
          <radiogroup anonid="selector" orient="horizontal" class="paneSelector chromeclass-toolbar"
                          role="listbox"/> <!-- Expose to accessibility APIs as a listbox -->
        </windowdragbox>
        <hbox flex="1" class="paneDeckContainer">
          <deck anonid="paneDeck" flex="1">
          </deck>
        </hbox>
        <hbox class="prefWindow-dlgbuttons donate-button-container">
          <button class="donate-button dialog-button" onclick="donate();"/>
        </hbox>
        <hbox anonid="dlg-buttons" class="prefWindow-dlgbuttons" pack="end">` +
          this.osButtons +
          `
        </hbox>
        <hbox>
        </hbox>
      `
      );
    }
    return this.ownerDocument.importNode(this._fragment, true);
  }

  get osButtons() {
    if (AppConstants.platform == "linux") {
      return `
          <button dlgtype="disclosure" class="dialog-button" hidden="true"/>
          <button dlgtype="help" class="dialog-button" hidden="true" icon="help"/>
          <button dlgtype="extra2" class="dialog-button" hidden="true"/>
          <button dlgtype="extra1" class="dialog-button" hidden="true"/>
          <spacer anonid="spacer" flex="1"/>
          <button dlgtype="cancel" class="dialog-button" icon="cancel"/>
          <button dlgtype="accept" class="dialog-button" icon="accept"/>`;
    }
    return `
          <button dlgtype="extra2" class="dialog-button" hidden="true"/>
          <spacer anonid="spacer" flex="1"/>
          <button dlgtype="accept" class="dialog-button" icon="accept"/>
          <button dlgtype="extra1" class="dialog-button" hidden="true"/>
          <button dlgtype="cancel" class="dialog-button" icon="cancel"/>
          <button dlgtype="help" class="dialog-button" hidden="true" icon="help"/>
          <button dlgtype="disclosure" class="dialog-button" hidden="true"/>`;
  }

  /** @this {PrefWindowClass} */
  connectedCallback() {
    if (this._initialized || this.delayConnectedCallback()) {
      return;
    }

    /** @param {string} name @param {string} value */
    const updateAttribute = (name, value) => {
      if (!this.hasAttribute(name)) {
        this.setAttribute(name, value);
      }
    };

    const childrenPrefpane = [...this.children].filter(child => child.tagName == "prefpane");
    const otherChildren = [...this.children].filter(child => child.tagName != "prefpane");
    const fragment = this.fragment;
    const deck = fragment.querySelector("deck");
    /** @type {HTMLElement} */ // @ts-ignore
    const fragmentLastChild = fragment.lastElementChild;
    this.appendChild(fragment);
    deck.append(...childrenPrefpane);
    fragmentLastChild.append(...otherChildren);

    this._paneDeckContainer.addEventListener("overflow", () => {
      this.sizeToContent(false);
    });

    updateAttribute("dlgbuttons", "accept,cancel");
    updateAttribute("persist", "screenX screenY");
    updateAttribute("role", "dialog");

    // get close button label
    MozXULElement.insertFTLIfNeeded("toolkit/printing/printPreview.ftl");
    const closeButton = this.querySelector("button[dlgtype='cancel']");
    document.l10n?.setAttributes(closeButton, "printpreview-close");
    document.l10n?.translateElements([closeButton]).then(() => {
      updateAttribute("closebuttonlabel", closeButton.getAttribute("label") ?? "");
      updateAttribute("closebuttonaccesskey", closeButton.getAttribute("accesskey") ?? "");
    });

    const eventTypes = [
      "dialogaccept",
      "dialogcancel",
      "dialogextra1",
      "dialogextra2",
      "dialoghelp",
      "dialogdisclosure",
    ];
    for (const type of eventTypes) {
      const command = this.hasAttribute(`on${type}`) && this.getAttribute(`on${type}`);
      if (command) {
        const code = `function ${type}(event) {${command}}`;
        const f = Tabmix.makeCode(code, null, "", Tabmix._sandbox);
        this.addEventListener(type, event => f.call(this, event));
      }
    }

    window.addEventListener("unload", this.disconnectedCallback);

    this.addEventListener(
      "keypress",
      event => {
        if (event.keyCode == KeyEvent.DOM_VK_RETURN) {
          this._hitEnter(event);
        }
      },
      {mozSystemGroup: true}
    );

    this.addEventListener(
      "keypress",
      event => {
        if (event.keyCode == KeyEvent.DOM_VK_ESCAPE && !event.defaultPrevented) {
          this.cancelDialog();
        }
      },
      {mozSystemGroup: true}
    );

    if (AppConstants.platform == "macosx") {
      this.addEventListener(
        "keypress",
        event => {
          if (event.key == "." && event.metaKey) {
            this.cancelDialog();
          }
        },
        true
      );
    } else {
      this.addEventListener(
        "focus",
        event => {
          const btn = this.getButton(this.defaultButton);
          if (btn) {
            const isDefault =
              event.originalTarget == btn ||
              !(
                event.originalTarget.localName == "button" ||
                event.originalTarget.localName == "toolbarbutton"
              );
            btn.setAttribute("default", isDefault ? "true" : "false");
          }
        },
        true
      );
    }

    // listen for when window is closed via native close buttons
    window.addEventListener("close", event => {
      if (!this.cancelDialog()) {
        event.preventDefault();
      }
    });

    Object.defineProperty(this, "buttons", {
      get: () => {
        return this.getAttribute("buttons");
      },
      set: val => {
        this._configureButtons(val);
      },
    });

    // for things that we need to initialize after onload fires
    if (document.readyState === "complete") {
      this.postLoadInit();
    } else {
      window.addEventListener("load", () => this.postLoadInit());
    }

    this._configureButtons(this.buttons);

    if (this.type != "child") {
      if (!this._instantApplyInitialized) {
        this.instantApply = Services.prefs.getBoolPref(
          "browser.preferences.instantApply",
          /Mac/.test(navigator.platform)
        );
      }
      if (this.instantApply) {
        const acceptButton = this.getButton("accept");
        acceptButton.hidden = true;
        const cancelButton = this.getButton("cancel");
        if (/Mac/.test(navigator.platform)) {
          // no buttons on Mac except Help
          cancelButton.hidden = true;
          // Move Help button to the end
          const spacer = document.getElementsByAttribute("anonid", "spacer")[0];
          if (spacer) {
            spacer.hidden = true;
          }
          // Also, don't fire onDialogAccept on enter
          acceptButton.disabled = true;
        } else {
          // morph the Cancel button into the Close button
          cancelButton.setAttribute("icon", "close");
          cancelButton.label = this.getAttribute("closebuttonlabel") ?? "Close";
          cancelButton.accessKey = this.getAttribute("closebuttonaccesskey") ?? "C";
        }
      }
    }

    const panes = this.preferencePanes;

    let lastPane = null;
    if (this.lastSelected) {
      lastPane = $Pane(this.lastSelected);
      if (!lastPane) {
        this.lastSelected = "";
      }
    }

    for (const pane of panes) {
      this._makePaneButton(pane);
      if (pane.loaded) {
        // Inline pane content, fire load event to force initialization.
        this._fireEvent("paneload", pane);
      }
    }
    this.showPane(lastPane || panes[0]);

    if (panes.length == 1) {
      this._selector.setAttribute("collapsed", "true");
    }

    this._initialized = true;
  }

  disconnectedCallback() {
    for (const pane of this.preferencePanes) {
      pane._resizeObserver?.disconnect();
      pane._resizeObserver = null;
    }
  }

  get mStrBundle() {
    return Tabmix.lazyGetter(this, "mStrBundle", () =>
      Services.strings.createBundle("chrome://global/locale/dialog.properties")
    );
  }

  get preferencePanes() {
    return this.getElementsByTagName("prefpane");
  }

  get type() {
    return this.getAttribute("type") ?? "";
  }

  get _paneDeck() {
    return document.getElementsByAttribute("anonid", "paneDeck")[0];
  }

  get _paneDeckContainer() {
    return document.getElementsByAttribute("class", "paneDeckContainer")[0];
  }

  get _selector() {
    return document.getElementsByAttribute("anonid", "selector")[0];
  }

  get lastSelected() {
    if (!this.hasAttribute("lastSelected")) {
      const val = Services.xulStore.getValue(document.documentURI, "persist", "lastSelected");
      this.setAttribute("lastSelected", val);
      return String(val);
    }
    return this.getAttribute("lastSelected") ?? "";
  }

  set lastSelected(val) {
    this.setAttribute("lastSelected", val);
    Services.xulStore.setValue(document.documentURI, "persist", "lastSelected", val);
  }

  get currentPane() {
    if (!this._currentPane) {
      this._currentPane = this.preferencePanes[0];
    }

    return this._currentPane;
  }

  set currentPane(val) {
    this._currentPane = val;
  }

  get defaultButton() {
    const attributeValue = this.getAttribute("defaultButton") ?? "accept";
    return /** @type {DialogButtonsType} */ (attributeValue);
  }

  set defaultButton(val) {
    this._setDefaultButton(val);
  }

  cancelDialog() {
    return this._doButtonCommand("cancel");
  }

  /** @type {PrefWindowClass["getButton"]} */
  getButton(aDlgType) {
    return this._buttons[aDlgType];
  }

  postLoadInit() {
    const focusInit = () => {
      const defaultButton = this.getButton(this.defaultButton);

      // give focus to the first focusable element in the dialog
      let focusedElt = document.commandDispatcher.focusedElement;
      if (!focusedElt) {
        document.commandDispatcher.advanceFocusIntoSubtree(this);
        focusedElt = document.commandDispatcher.focusedElement;
        if (focusedElt) {
          const initialFocusedElt = focusedElt;
          while (
            focusedElt.localName == "tab" ||
            focusedElt.getAttribute("noinitialfocus") == "true"
          ) {
            document.commandDispatcher.advanceFocusIntoSubtree(focusedElt);
            focusedElt = document.commandDispatcher.focusedElement;
            if (focusedElt) {
              if (focusedElt == initialFocusedElt) {
                if (focusedElt.getAttribute("noinitialfocus") == "true") {
                  focusedElt.blur();
                }
                break;
              }
            }
          }

          if (initialFocusedElt.localName == "tab") {
            if (focusedElt.hasAttribute("dlgtype")) {
              // We don't want to focus on anonymous OK, Cancel, etc. buttons,
              // so return focus to the tab itself
              initialFocusedElt.focus();
            }
          } else if (
            !/Mac/.test(navigator.platform) &&
            focusedElt.hasAttribute("dlgtype") &&
            focusedElt != defaultButton
          ) {
            defaultButton.focus();
          }
        }
      }

      try {
        if (defaultButton) {
          window.notifyDefaultButtonLoaded(defaultButton);
        }
      } catch {}
    };

    // Give focus after onload completes, see bug 103197.
    setTimeout(focusInit, 0);

    if (this._l10nButtons.length) {
      document.l10n?.translateElements(this._l10nButtons).then(() => {
        this.sizeToContent();
      });
    }
  }

  /** @type {PrefWindowClass["_configureButtons"]} */
  _configureButtons(aButtons) {
    // by default, get all the anonymous button elements
    /** @type {Record<string, HTMLButtonElement>} */
    const buttons = {
      accept: document.getElementsByAttribute("dlgtype", "accept")[0],
      cancel: document.getElementsByAttribute("dlgtype", "cancel")[0],
      extra1: document.getElementsByAttribute("dlgtype", "extra1")[0],
      extra2: document.getElementsByAttribute("dlgtype", "extra2")[0],
      help: document.getElementsByAttribute("dlgtype", "help")[0],
      disclosure: document.getElementsByAttribute("dlgtype", "disclosure")[0],
    };

    /** @type {PrefWindowClass["_buttons"]} */ // @ts-expect-error - just cast the right type
    this._buttons = buttons;

    for (const button of Object.values(buttons)) {
      customElements.upgrade(button);
    }
    // look for any overriding explicit button elements
    const exBtns = this.getElementsByAttribute("dlgtype", "*");
    for (const button of exBtns) {
      /** @type {DialogButtonsType} */ // @ts-expect-error
      const dlgtype = button.getAttribute("dlgtype");
      if (buttons[dlgtype] && buttons[dlgtype] !== button) {
        buttons[dlgtype].hidden = true; // hide the anonymous button
        buttons[dlgtype] = button;
      }
    }
    // add the label and oncommand handler to each button
    for (const [dlgtype, button] of Object.entries(buttons)) {
      button.addEventListener(
        "command",
        (/** @type {WindowEvent} */ event) => this._handleButtonCommand(event),
        true
      );
      // don't override custom labels with pre-defined labels on explicit buttons
      if (!button.hasAttribute("label")) {
        // dialog attributes override the default labels in dialog.properties
        if (this.hasAttribute("buttonlabel" + dlgtype)) {
          button.setAttribute("label", this.getAttribute("buttonlabel" + dlgtype) ?? "");
          if (this.hasAttribute("buttonaccesskey" + dlgtype)) {
            button.setAttribute("accesskey", this.getAttribute("buttonaccesskey" + dlgtype) ?? "");
          }
        } else if (this.hasAttribute("buttonid" + dlgtype)) {
          document.l10n?.setAttributes(button, this.getAttribute("buttonid" + dlgtype) ?? "");
          this._l10nButtons.push(button);
        } else if (dlgtype != "extra1" && dlgtype != "extra2") {
          this.setButtonLabel(dlgtype, button);
        }
      }
      // allow specifying alternate icons in the dialog header
      if (!button.hasAttribute("icon")) {
        // if there's an icon specified, use that
        if (this.hasAttribute("buttonicon" + dlgtype)) {
          button.setAttribute("icon", this.getAttribute("buttonicon" + dlgtype) ?? "");
        } else {
          // otherwise set defaults
          switch (dlgtype) {
            case "accept":
              button.setAttribute("icon", "accept");
              break;
            case "cancel":
              button.setAttribute("icon", "cancel");
              break;
            case "disclosure":
              button.setAttribute("icon", "properties");
              break;
            case "help":
              button.setAttribute("icon", "help");
              break;
            default:
              break;
          }
        }
      }
    }
    // ensure that hitting enter triggers the default button command
    // eslint-disable-next-line no-self-assign
    this.defaultButton = this.defaultButton;
    // if there is a special button configuration, use it
    if (aButtons) {
      // expect a comma delimited list of dlgtype values
      const list = aButtons.split(",");
      // mark shown dlgtypes as true
      /** @type {Record<string, boolean>} */
      const shown = {
        accept: false,
        cancel: false,
        help: false,
        disclosure: false,
        extra1: false,
        extra2: false,
      };
      for (const button of list) {
        shown[button.replace(/ /g, "")] = true;
      }
      // hide/show the buttons we want
      for (const dlgtype of Object.keys(buttons)) {
        if (buttons[dlgtype]) {
          buttons[dlgtype].hidden = !shown[dlgtype];
        }
      }
      // show the spacer on Windows only when the extra2 button is present
      if (/Win/.test(navigator.platform)) {
        const spacer = document.getElementsByAttribute("anonid", "spacer")[0];
        spacer?.removeAttribute("hidden");
        // eslint-disable-next-line dot-notation
        spacer?.setAttribute("flex", shown["extra2"] ? "1" : "0");
      }
    }
  }

  /** @type {PrefWindowClass["setButtonLabel"]} */
  setButtonLabel(dlgtype, button) {
    button.setAttribute("label", this.mStrBundle.GetStringFromName("button-" + dlgtype));
    const accessKey = this.mStrBundle.GetStringFromName("accesskey-" + dlgtype);
    if (accessKey) {
      button.setAttribute("accesskey", accessKey);
    }
  }

  /** @type {PrefWindowClass["_setDefaultButton"]} */
  _setDefaultButton(aNewDefault) {
    // remove the default attribute from the previous default button, if any
    const oldDefaultButton = this.getButton(this.defaultButton);
    if (oldDefaultButton) {
      oldDefaultButton.removeAttribute("default");
    }

    const newDefaultButton = this.getButton(aNewDefault);
    if (newDefaultButton) {
      this.setAttribute("defaultButton", aNewDefault);
      newDefaultButton.setAttribute("default", "true");
    } else {
      this.setAttribute("defaultButton", "none");
      if (aNewDefault != "none") {
        dump("invalid new default button: " + aNewDefault + ", assuming: none\n");
      }
    }
  }

  /** @type {PrefWindowClass["_handleButtonCommand"]} */
  _handleButtonCommand(aEvent) {
    const dlgType = aEvent.target.getAttribute("dlgtype");
    if (dlgType === null) {
      console.error("Missing 'dlgtype' attribute on event target.");
      return false;
    }
    return this._doButtonCommand(/** @type {DialogButtonsType} */ (dlgType));
  }

  /** @type {PrefWindowClass["_doButtonCommand"]} */
  _doButtonCommand(aDlgType) {
    const button = this.getButton(aDlgType);
    if (!button.disabled) {
      const noCancel = this._fireButtonEvent(aDlgType);
      if (noCancel) {
        if (aDlgType == "accept" || aDlgType == "cancel") {
          const closingEvent = new CustomEvent("dialogclosing", {
            bubbles: true,
            detail: {button: aDlgType},
          });
          this.dispatchEvent(closingEvent);
          window.close();
        }
      }
      return noCancel;
    }
    return true;
  }

  /** @type {PrefWindowClass["_fireButtonEvent"]} */
  _fireButtonEvent(aDlgType) {
    const event = document.createEvent("Events");
    event.initEvent("dialog" + aDlgType, true, true);
    // handle dom event handlers
    return this.dispatchEvent(event);
  }

  /** @type {PrefWindowClass["_hitEnter"]} */
  _hitEnter(evt) {
    if (evt.defaultPrevented) {
      return;
    }

    const btn = this.getButton(this.defaultButton);
    if (btn) {
      this._doButtonCommand(this.defaultButton);
    }
  }

  /** @type {PrefWindowClass["_makePaneButton"]} */
  _makePaneButton(aPaneElement) {
    const radio = document.createXULElement("radio");
    radio.setAttribute("is", "pane-button");
    radio.setAttribute("pane", aPaneElement.id);
    radio.setAttribute("value", aPaneElement.id);
    radio.setAttribute("label", aPaneElement.label);
    // Expose preference group choice to accessibility APIs as an unchecked list item
    // The parent group is exposed to accessibility APIs as a list
    if (aPaneElement.image) {
      radio.setAttribute("src", aPaneElement.image);
    }

    radio.style.listStyleImage = aPaneElement.style.listStyleImage;
    this._selector.appendChild(radio);
    return radio;
  }

  /** @type {PrefWindowClass["showPane"]} */
  showPane(aPaneElement) {
    if (!aPaneElement) {
      return;
    }

    this._selector.selectedItem = document.getElementsByAttribute("pane", aPaneElement.id)[0];
    if (!aPaneElement.loaded) {
      delayTabsConnectedCallback = true;
      const src = aPaneElement.src;
      if (src) {
        const ov = new Overlays(new ChromeManifest(), window.document.defaultView);
        ov.load(src).then(() => this._paneLoaded(aPaneElement));
      } else {
        this._paneLoaded(aPaneElement);
      }
    } else {
      this._selectPane(aPaneElement);
      if (this.preferencePanes.length > 1) {
        this.sizeToContent(true);
      }
    }
  }

  /** @type {PrefWindowClass["_paneLoaded"]} */
  _paneLoaded(aPaneElement) {
    aPaneElement.loaded = true;
    aPaneElement.connectedCallback();
    // now we can safely call connectedCallback for all tabs in this PrefPane
    delayTabsConnectedCallback = false;
    aPaneElement
      .querySelectorAll("tabs")
      .forEach((/** @type {any} */ tabs) => tabs.connectedCallback());

    this._fireEvent("paneload", aPaneElement);
    this._selectPane(aPaneElement);

    if (this.preferencePanes.length > 1) {
      aPaneElement._resizeObserver = new ResizeObserver(() => {
        this.sizeToContent(true);
      });
      aPaneElement._resizeObserver.observe(aPaneElement);
    }
  }

  /** @type {PrefWindowClass["_fireEvent"]} */
  _fireEvent(aEventName, aTarget) {
    // Panel loaded, synthesize a load event.
    try {
      const event = document.createEvent("Events");
      event.initEvent(aEventName, true, true);
      let cancel = !aTarget.dispatchEvent(event);
      const eventType = "on" + aEventName;
      if (aTarget.hasAttribute(eventType)) {
        const fn = getFunction(aTarget, aEventName, aTarget.getAttribute(eventType) ?? "");
        const rv = fn.call(aTarget, event);
        if (!rv) {
          cancel = true;
        }
      }
      return !cancel;
    } catch (e) {
      console.error(e);
    }
    return false;
  }

  /** @type {PrefWindowClass["_selectPane"]} */
  _selectPane(aPaneElement) {
    if (/Mac/.test(navigator.platform)) {
      const paneTitle = aPaneElement.label;
      if (paneTitle != "") {
        document.title = paneTitle;
      }
    }
    const helpButton = this.getButton("help");
    if (aPaneElement.helpTopic) {
      helpButton.hidden = false;
    } else {
      helpButton.hidden = true;
    }

    // Find this pane's index in the deck and set the deck's
    // selectedIndex to that value to switch to it.
    const prefpanes = this.preferencePanes;
    for (let i = 0; i < prefpanes.length; ++i) {
      if (prefpanes[i] == aPaneElement) {
        this._paneDeck.selectedIndex = i;
        if (this.type != "child") {
          const oldPane = this.lastSelected ? $Pane(this.lastSelected) : this.preferencePanes[0];
          oldPane.selected = !(aPaneElement.selected = true);
          this.lastSelected = aPaneElement.id;
          this.currentPane = aPaneElement;
          this._initialized = true;
        }
        break;
      }
    }
  }

  /* default false, when true check only for increase in size */
  /** @type {PrefWindowClass["sizeToContent"]} */
  sizeToContent(onlySizeUp = false) {
    if (!onlySizeUp && this.currentPane._content) {
      this.currentPane._content.style.height = "";
      this.currentPane._content.style.width = "";
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!this.currentPane._content) {
          return;
        }
        const {height = "0", width = "0"} = window.getComputedStyle(this._paneDeckContainer) ?? {};
        const {
          paddingTop = "0",
          paddingBottom = "0",
          paddingLeft = "0",
          paddingRight = "0",
        } = window.getComputedStyle(this.currentPane) ?? {};
        const paddingY = parseInt(paddingTop) + parseInt(paddingBottom);
        const paddingX = parseInt(paddingLeft) + parseInt(paddingRight);
        this.maybeResize(this.currentPane, parseInt(height), "height", paddingY, onlySizeUp);
        this.maybeResize(this.currentPane, parseInt(width), "width", paddingX, onlySizeUp);
      });
    });
  }

  maxContentSize = {
    width: 0,
    height: 0,
  };

  /** @type {PrefWindowClass["maybeResize"]} */
  maybeResize(aPaneElement, targetSize, measurement, padding, onlySizeUp) {
    const prop = measurement === "height" ? "contentHeight" : "contentWidth";
    const contentSize = aPaneElement[prop];
    if (contentSize > this.maxContentSize[measurement]) {
      this.maxContentSize[measurement] = contentSize;
      this._paneDeckContainer.style.setProperty(
        `--tabmix-content-box-max-pane-${measurement}`,
        `${contentSize}px`
      );
    }

    const condition =
      onlySizeUp ?
        contentSize > targetSize - padding
      : Math.abs(contentSize - (targetSize - padding)) > 0;
    if (condition) {
      let bottomPadding = 0;
      if (measurement === "height") {
        // To workaround the bottom border of a groupbox from being
        // cutoff an hbox with a class of bottomBox may enclose it.
        // This needs to include its padding to resize properly.
        // See bug 394433
        const bottomBox = aPaneElement.getElementsByAttribute("class", "bottomBox")[0];
        if (bottomBox) {
          bottomPadding = parseInt(window.getComputedStyle(bottomBox)?.paddingBottom ?? "0");
        }
      }
      const diff = bottomPadding + padding + contentSize - targetSize;
      if (diff) {
        window.resizeBy(
          diff * Number(measurement === "width"),
          diff * Number(measurement === "height")
        );
      }
    }

    // extend the contents of the prefpane to
    // prevent elements from being cutoff (see bug 349098).
    if (onlySizeUp && aPaneElement[prop] + padding < targetSize) {
      aPaneElement._content.style[measurement] = targetSize - padding + "px";
    }
  }

  /** @type {PrefWindowClass["addPane"]} */
  addPane(aPaneElement) {
    this.appendChild(aPaneElement);

    // Set up pane button
    this._makePaneButton(aPaneElement);
  }
}

customElements.define("preferences", Preferences);
customElements.define("preference", Preference);
customElements.define("prefpane", PrefPane);
customElements.define("pane-button", PaneButton, {extends: "radio"});
