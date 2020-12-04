const {AppConstants} = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");


// connectedCallback do tabs cria um elemento spacer de cada lado e se tiver mais de um antes das tab faz o tabbox não conseguir
// identificar o selectedIndex. Para evitar múltiplas execuções do connectedCallback, resultado do carregamento via overlay seguido
// de inserção no content binding, é só pular enquanto não detectar que o binding root (prefwindow) foi definido, pois ele é quem
// estrutura o content binding.
customElements.get('tabs').prototype.delayConnectedCallback = function () {
  return customElements.get('prefwindow') ? false : true;
};

class Preferences extends MozXULElement {
  constructor() {
    super();

    // Bug 1570744
    this.observerFunction = (subject, topic, data) => {
      this.observe(subject, topic, data);
    };

    this.service = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
    this.rootBranch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
    this.defaultBranch = this.service.getDefaultBranch("");
    this.rootBranchInternal = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);

    /**
     * We want to call _constructAfterChildren after all child
     * <preference> elements have been constructed. To do this, we get
     * and store the node list of all child <preference> elements in the
     * constructor, and maintain a count which is incremented in the
     * constructor of <preference>. _constructAfterChildren is called
     * when the count matches the length of the list.
     */
    this._constructedChildrenCount = 0;

    /**
     * Some <preference> elements are added dynamically after
     *   _constructAfterChildren has already been called - we want to
     *   avoid looping over all of them again in this case so we remember
     *   if we already called it.
     */
    this._constructAfterChildrenCalled = false;

    this._preferenceChildren = this.getElementsByTagName("preference");
  }

  get type() {
    return document.documentElement.type || "";
  }

  get instantApply() {
    var doc = document.documentElement;
    return this.type == "child" ? doc.instantApply
                                : doc.instantApply || this.rootBranch.getBoolPref("browser.preferences.instantApply");
  }

  observe(aSubject, aTopic, aData) {
    for (var i = 0; i < this.childNodes.length; ++i) {
      var preference = this.childNodes[i];
      if (preference.name == aData) {
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

    var elements = this.getElementsByTagName("preference");
    for (let element of elements) {
      element.updateElements();
    }

    this._constructAfterChildrenCalled = true;
  }

  fireChangedEvent(aPreference) {
    // Value changed, synthesize an event
    try {
      var event = document.createEvent("Events");
      event.initEvent("change", true, true);
      aPreference.dispatchEvent(event);
    } catch (e) {
      Cu.reportError(e);
    }
  }
}

class Preference extends MozXULElement {
  constructor() {
    super();

    this.disconnectedCallback = this.disconnectedCallback.bind(this);

    this.addEventListener("change", (event) => {
      this.updateElements();
    });
  }

  connectedCallback() {
    if (this._initialized) {
      return;
    }

    this._constructed = false;
    this._value = null;
    this._useDefault = false;
    this.batching = false;

    window.addEventListener("unload", this.disconnectedCallback);

    // if the element has been inserted without the name attribute set,
    // we have nothing to do here
    if (!this.name)
      return;

    this.preferences.rootBranchInternal
        .addObserver(this.name, this.preferences.observerFunction);
    // In non-instant apply mode, we must try and use the last saved state
    // from any previous opens of a child dialog instead of the value from
    // preferences, to pick up any edits a user may have made.

    var secMan = Cc["@mozilla.org/scriptsecuritymanager;1"]
                .getService(Ci.nsIScriptSecurityManager);
    if (this.preferences.type == "child" &&
        !this.instantApply && window.opener &&
        secMan.isSystemPrincipal(window.opener.document.nodePrincipal)) {
      var pdoc = window.opener.document;

      // Try to find a preference element for the same preference.
      var preference = null;
      var parentPreferences = pdoc.getElementsByTagName("preferences");
      for (var k = 0; (k < parentPreferences.length && !preference); ++k) {
        var parentPrefs = parentPreferences[k]
                                .getElementsByAttribute("name", this.name);
        for (var l = 0; (l < parentPrefs.length && !preference); ++l) {
          if (parentPrefs[l].localName == "preference")
            preference = parentPrefs[l];
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
    if (this.preferences._constructedChildrenCount ==
        this.preferences._preferenceChildren.length) {
      // This is the last <preference>, time to updateElements() on all of them.
      this.preferences._constructAfterChildren();
    }

    this._initialized = true;
  }

  disconnectedCallback() {
    this.preferences.rootBranchInternal
        .removeObserver(this.name, this.preferences.observerFunction);
  }

  get instantApply() {
    if (this.getAttribute("instantApply") == "false")
      return false;
    return this.getAttribute("instantApply") == "true" || this.preferences.instantApply;
  }

  get preferences() {
    return this.parentNode;
  }

  get name() {
    return this.getAttribute('name');
  }

  set name(val) {
    if (val == this.name)
      return val;

    this.preferences.rootBranchInternal
        .removeObserver(this.name, this.preferences.observerFunction);
    this.setAttribute("name", val);
    this.preferences.rootBranchInternal
        .addObserver(val, this.preferences.observerFunction);

    return val;
  }

  get type() {
    return this.getAttribute('type');
  }

  set type(val) {
    this.setAttribute('type', val);
    return val;
  }

  get inverted() {
    return this.getAttribute('inverted') == 'true';
  }

  set inverted(val) {
    this.setAttribute('inverted', val);
    return val;
  }

  get readonly() {
    return this.getAttribute('readonly') == 'true';
  }

  set readonly(val) {
    this.setAttribute('readonly', val);
    return val;
  }

  get value() {
    return this._value;
  }

  set value(val) {
    return this._setValue(val);
  }

  get locked() {
    return this.preferences.rootBranch.prefIsLocked(this.name);
  }

  get disabled() {
    return this.getAttribute("disabled") == "true";
  }

  set disabled(val) {
    if (val)
      this.setAttribute("disabled", "true");
    else
      this.removeAttribute("disabled");

    if (!this.id)
      return val;

    var elements = document.getElementsByAttribute("preference", this.id);
    for (var i = 0; i < elements.length; ++i) {
      elements[i].disabled = val;

      var labels = document.getElementsByAttribute("control", elements[i].id);
      for (var j = 0; j < labels.length; ++j)
        labels[j].disabled = val;
    }

    return val;
  }

  get tabIndex() {
    return parseInt(this.getAttribute("tabindex"));
  }

  set tabIndex(val) {
    if (val)
      this.setAttribute("tabindex", val);
    else
      this.removeAttribute("tabindex");

    if (!this.id)
      return val;

    var elements = document.getElementsByAttribute("preference", this.id);
    for (var i = 0; i < elements.length; ++i) {
      elements[i].tabIndex = val;

      var labels = document.getElementsByAttribute("control", elements[i].id);
      for (var j = 0; j < labels.length; ++j)
        labels[j].tabIndex = val;
    }

    return val;
  }

  get hasUserValue() {
    return this.preferences.rootBranch.prefHasUserValue(this.name) &&
           this.value !== undefined;
  }

  get defaultValue() {
    this._useDefault = true;
    var val = this.valueFromPreferences;
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
      case "bool":
        var val = this._branch.getBoolPref(this.name);
        return this.inverted ? !val : val;
      case "wstring":
        return this._branch
                   .getComplexValue(this.name, Ci.nsIPrefLocalizedString)
                   .data;
      case "string":
      case "unichar":
        return this._branch.getStringPref(this.name);
      case "fontname":
        var family = this._branch.getStringPref(this.name);
        var fontEnumerator = Cc["@mozilla.org/gfx/fontenumerator;1"]
                               .createInstance(Ci.nsIFontEnumerator);
        return fontEnumerator.getStandardFamilyName(family);
      case "file":
        var f = this._branch
                    .getComplexValue(this.name, Ci.nsIFile);
        return f;
      default:
        this._reportUnknownType();
      }
    } catch (e) { }
    return null;
  }

  set valueFromPreferences(val) {
    // Exit early if nothing to do.
    if (this.readonly || this.valueFromPreferences == val)
      return val;

    // The special value undefined means 'reset preference to default'.
    if (val === undefined) {
      this.preferences.rootBranch.clearUserPref(this.name);
      return val;
    }

    // Force a resync of preferences with value.
    switch (this.type) {
    case "int":
      this.preferences.rootBranch.setIntPref(this.name, val);
      break;
    case "bool":
      this.preferences.rootBranch.setBoolPref(this.name, this.inverted ? !val : val);
      break;
    case "wstring":
      var pls = Cc["@mozilla.org/pref-localizedstring;1"]
                  .createInstance(Ci.nsIPrefLocalizedString);
      pls.data = val;
      this.preferences.rootBranch
          .setComplexValue(this.name, Ci.nsIPrefLocalizedString, pls);
      break;
    case "string":
    case "unichar":
    case "fontname":
      this.preferences.rootBranch.setStringPref(this.name, val);
      break;
    case "file":
      var lf;
      if (typeof(val) == "string") {
        lf = Cc["@mozilla.org/file/local;1"]
               .createInstance(Ci.nsIFile);
        lf.persistentDescriptor = val;
        if (!lf.exists())
          lf.initWithPath(val);
      } else
        lf = val.QueryInterface(Ci.nsIFile);
      this.preferences.rootBranch
          .setComplexValue(this.name, Ci.nsIFile, lf);
      break;
    default:
      this._reportUnknownType();
    }
    if (!this.batching)
      this.preferences.service.savePrefFile(null);
    return val;
  }

  _setValue(aValue) {
    if (this.value !== aValue) {
      this._value = aValue;
      if (this.instantApply)
        this.valueFromPreferences = aValue;
      this.preferences.fireChangedEvent(this);
    }
    return aValue;
  }

  reset() {
    // defer reset until preference update
    this.value = undefined;
  }

  _reportUnknownType() {
    var consoleService = Cc["@mozilla.org/consoleservice;1"]
                           .getService(Ci.nsIConsoleService);
    var msg = "<preference> with id='" + this.id + "' and name='" +
              this.name + "' has unknown type '" + this.type + "'.";
    consoleService.logStringMessage(msg);
  }

  setElementValue(aElement) {
    if (this.locked)
      aElement.disabled = true;

    if (!this.isElementEditable(aElement))
      return;

    var rv = undefined;
    if (aElement.hasAttribute("onsyncfrompreference")) {
      // Value changed, synthesize an event
      try {
        var event = document.createEvent("Events");
        event.initEvent("syncfrompreference", true, true);
        var f = new Function("event",
                             aElement.getAttribute("onsyncfrompreference"));
        rv = f.call(aElement, event);
      } catch (e) {
        Cu.reportError(e);
      }
    }
    var val = rv;
    if (val === undefined)
      val = this.instantApply ? this.valueFromPreferences : this.value;
    // if the preference is marked for reset, show default value in UI
    if (val === undefined)
      val = this.defaultValue;

    /**
     * Initialize a UI element property with a value. Handles the case
     * where an element has not yet had a XBL binding attached for it and
     * the property setter does not yet exist by setting the same attribute
     * on the XUL element using DOM apis and assuming the element's
     * constructor or property getters appropriately handle this state.
     */
    function setValue(element, attribute, value) {
      if (attribute in element)
        element[attribute] = value;
      else
        element.setAttribute(attribute, value);
    }
    if (aElement.localName == "checkbox")
      setValue(aElement, "checked", val);
    else if (aElement.localName == "colorpicker")
      setValue(aElement, "color", val);
    else if (aElement.localName == "input") {
      // XXXmano Bug 303998: Avoid a caret placement issue if either the
      // preference observer or its setter calls updateElements as a result
      // of the input event handler.
      if (aElement.value !== val)
        setValue(aElement, "value", val);
    } else
      setValue(aElement, "value", val);
  }

  getElementValue(aElement) {
    if (aElement.hasAttribute("onsynctopreference")) {
      // Value changed, synthesize an event
      try {
        var event = document.createEvent("Events");
        event.initEvent("synctopreference", true, true);
        var f = new Function("event",
                             aElement.getAttribute("onsynctopreference"));
        var rv = f.call(aElement, event);
        if (rv !== undefined)
          return rv;
      } catch (e) {
        Cu.reportError(e);
      }
    }

    /**
     * Read the value of an attribute from an element, assuming the
     * attribute is a property on the element's node API. If the property
     * is not present in the API, then assume its value is contained in
     * an attribute, as is the case before a binding has been attached.
     */
    function getValue(element, attribute) {
      if (attribute in element)
        return element[attribute];
      return element.getAttribute(attribute);
    }
    if (aElement.localName == "checkbox")
      var value = getValue(aElement, "checked");
    else if (aElement.localName == "colorpicker")
      value = getValue(aElement, "color");
    else
      value = getValue(aElement, "value");

    switch (this.type) {
    case "int":
      return parseInt(value, 10) || 0;
    case "bool":
      return typeof(value) == "boolean" ? value : value == "true";
    }
    return value;
  }

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
    if (!this.id)
      return;

    // This "change" event handler tracks changes made to preferences by
    // sources other than the user in this window.
    var elements = document.getElementsByAttribute("preference", this.id);
    for (var i = 0; i < elements.length; ++i)
      this.setElementValue(elements[i]);
  }
}

class PrefPane extends MozXULElement {
  constructor() {
    super();

    this.addEventListener("command", (event) => {
      // This "command" event handler tracks changes made to preferences by
      // the user in this window.
      if (event.sourceEvent)
        event = event.sourceEvent;
      this.userChangedValue(event.target);
    });

    this.addEventListener("select", (event) => {
      // This "select" event handler tracks changes made to colorpicker
      // preferences by the user in this window.
      if (event.target.localName == "colorpicker")
        this.userChangedValue(event.target);
    });

    this.addEventListener("change", (event) => {
      // This "change" event handler tracks changes made to preferences by
      // the user in this window.
      this.userChangedValue(event.target);
    });

    this.addEventListener("input", (event) => {
      // This "input" event handler tracks changes made to preferences by
      // the user in this window.
      this.userChangedValue(event.target);
    });

    this.addEventListener("paneload", (event) => {
      // Initialize all values from preferences.
      var elements = this.preferenceElements;
      for (var i = 0; i < elements.length; ++i) {
        try {
          var preference = this.preferenceForElement(elements[i]);
          preference.setElementValue(elements[i]);
        } catch (e) {
          dump("*** No preference found for " + elements[i].getAttribute("preference") + "\n");
        }
      }
    });
  }

  static get inheritedAttributes() {
    return {
      ".content-box": "flex",
    };
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

  async connectedCallback() {
    if (this._initialized) {
      return;
    }

    //PrefPane overlay have to be move earlier to here otherwise tabs elements won't load properly. see ln 1551
    //But this may be the cause of EMSG <Uncaught (in promise) undefined> shows up 
    if(this.src){
      Components.utils.import("chrome://tabmixplus/content/ChromeManifest.jsm");
      Components.utils.import("chrome://tabmixplus/content/Overlays.jsm");

      let ov = new Overlays(new ChromeManifest(),window.document.defaultView);
      ov.load(this.src);
    }

    let fragment = this.fragment;
    let contentBox = fragment.querySelector('.content-box');
    let childNodes = [...this.childNodes];
    this.appendChild(fragment);
    contentBox.append(...childNodes);
    this.initializeAttributeInheritance();

    this._loaded = false;
    this._deferredValueUpdateElements = new Set();
    this._content = this.getElementsByClassName('content-box')[0];

    this._initialized = true;
  }

  get src() {
    return this.getAttribute('src');
  }

  set src(val) {
    this.setAttribute('src', val);
    return val;
  }

  get selected() {
    return this.getAttribute('selected') == 'true';
  }

  set selected(val) {
    this.setAttribute('selected', val);
    return val;
  }

  get image() {
    return this.getAttribute('image');
  }

  set image(val) {
    this.setAttribute('image', val);
    return val;
  }

  get label() {
    return this.getAttribute('label');
  }

  set label(val) {
    this.setAttribute('label', val);
    return val;
  }

  get preferenceElements() {
    return this.getElementsByAttribute('preference', '*');
  }

  get preferences() {
    return this.getElementsByTagName('preference');
  }

  get helpTopic() {
    // if there are tabs, and the selected tab provides a helpTopic, return that
    var box = this.getElementsByTagName("tabbox");
    if (box[0]) {
      var tab = box[0].selectedTab;
      if (tab && tab.hasAttribute("helpTopic"))
        return tab.getAttribute("helpTopic");
    }

    // otherwise, return the helpTopic of the current panel
    return this.getAttribute("helpTopic");
  }

  get loaded() {
    return !this.src ? true : this._loaded;
  }

  set loaded(val) {
    this._loaded = val;
    return val;
  }

  get DeferredTask() {
    let module = {};
    ChromeUtils.import("resource://gre/modules/DeferredTask.jsm", module);
    Object.defineProperty(this, "DeferredTask", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: module.DeferredTask,
    });
    return module.DeferredTask;
  }

  get contentHeight() {
    var targetHeight = parseInt(window.getComputedStyle(this._content).height);
    targetHeight += parseInt(window.getComputedStyle(this._content).marginTop);
    targetHeight += parseInt(window.getComputedStyle(this._content).marginBottom);
    return targetHeight;
  }

  writePreferences(aFlushToDisk) {
    // Write all values to preferences.
    if (this._deferredValueUpdateElements.size) {
      this._finalizeDeferredElements();
    }

    var preferences = this.preferences;
    for (var i = 0; i < preferences.length; ++i) {
      var preference = preferences[i];
      preference.batching = true;
      preference.valueFromPreferences = preference.value;
      preference.batching = false;
    }
    if (aFlushToDisk) {
      var psvc = Cc["@mozilla.org/preferences-service;1"]
                   .getService(Ci.nsIPrefService);
      psvc.savePrefFile(null);
    }
  }

  preferenceForElement(aElement) {
    return document.getElementById(aElement.getAttribute("preference"));
  }

  getPreferenceElement(aStartElement) {
    var temp = aStartElement;
    while (temp && temp.nodeType == Node.ELEMENT_NODE &&
           !temp.hasAttribute("preference"))
      temp = temp.parentNode;
    return temp && temp.nodeType == Node.ELEMENT_NODE ?
           temp : aStartElement;
  }

  _deferredValueUpdate(aElement) {
    delete aElement._deferredValueUpdateTask;
    let preference = document.getElementById(aElement.getAttribute("preference"));
    let prefVal = preference.getElementValue(aElement);
    preference.value = prefVal;
    this._deferredValueUpdateElements.delete(aElement);
  }

  _finalizeDeferredElements() {
    for (let el of this._deferredValueUpdateElements) {
      if (el._deferredValueUpdateTask) {
        el._deferredValueUpdateTask.finalize();
      }
    }
  }

  userChangedValue(aElement) {
    let element = this.getPreferenceElement(aElement);
    if (element.hasAttribute("preference")) {
      if (element.getAttribute("delayprefsave") != "true") {
        var preference = document.getElementById(element.getAttribute("preference"));
        var prefVal = preference.getElementValue(element);
        preference.value = prefVal;
      } else {
        if (!element._deferredValueUpdateTask) {
          element._deferredValueUpdateTask = new this.DeferredTask(this._deferredValueUpdate.bind(this, element), 1000);
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

class PaneButton extends customElements.get('radio') {
  constructor() {
    super();
  }

  static get thisInheritedAttributes() {
    return {
      ".paneButtonIcon": "src",
      ".paneButtonLabel": "value=label",
    };
  }

  static get inheritedAttributes() {
    return Object.assign({}, super.inheritedAttributes,
        PaneButton.thisInheritedAttributes);
  }

  /**
   * Overrides super.getElementForAttrInheritance. Used in setting up attribute inheritance.
   * Takes a selector and returns an element for that selector. If the selector is in
   * thisInheritedAttributes it queries the light DOM, otherwise the selector is in
   * super.inheritedAttributes and the shadow DOM is queried. See bug 1545824.
   *
   * @param {string} selector  A selector used to query an element.
   * @return {Element}  The element found by the selector.
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
    return this.getAttribute('disabled') == 'true';
  }

  set disabled(val) {
    if (val)
      this.setAttribute('disabled', 'true');
    else
      this.removeAttribute('disabled');
    return val;
  }

  get tabIndex() {
    return parseInt(this.getAttribute('tabindex')) || 0;
  }

  set tabIndex(val) {
    if (val)
      this.setAttribute('tabindex', val);
    else
      this.removeAttribute('tabindex');
    return val;
  }

  get label() {
    return this.getAttribute('label');
  }

  set label(val) {
    this.setAttribute('label',val);
    return val;
  }

  get crop() {
    return this.getAttribute('crop');
  }

  set crop(val) {
    this.setAttribute('crop',val);
    return val;
  }

  get image() {
    return this.getAttribute('image');
  }

  set image(val) {
    this.setAttribute('image',val);
    return val;
  }

  get command() {
    return this.getAttribute('command');
  }

  set command(val) {
    this.setAttribute('command',val);
    return val;
  }

  get accessKey() {
    return this.getAttribute("accesskey");
  }

  set accessKey(val) {
    // Always store on the control
    this.setAttribute("accesskey", val);
    // If there is a label, change the accesskey on the labelElement
    // if it's also set there
    let labelElement = document.getElementsByAttribute("control", this.id)[0];
    if (labelElement) {
      labelElement.setAttribute("accesskey", val);
    }
    return val;
  }
}

class PrefWindow extends MozXULElement {
  constructor() {
    super();

    this.disconnectedCallback = this.disconnectedCallback.bind(this);

    this.addEventListener("dialogaccept", (event) => {
      if (!this._fireEvent("beforeaccept", this)) {
        return false;
      }

      var secMan = Cc["@mozilla.org/scriptsecuritymanager;1"]
                  .getService(Ci.nsIScriptSecurityManager);
      if (this.type == "child" && window.opener &&
          secMan.isSystemPrincipal(window.opener.document.nodePrincipal)) {
        var pdocEl = window.opener.document.documentElement;
        if (pdocEl.instantApply) {
          let panes = this.preferencePanes;
          for (let i = 0; i < panes.length; ++i)
            panes[i].writePreferences(true);
        } else {
          // Clone all the preferences elements from the child document and
          // insert them into the pane collection of the parent.
          var pdoc = window.opener.document;
          if (pdoc.documentElement.localName == "prefwindow") {
            var currentPane = pdoc.documentElement.currentPane;
            var id = window.location.href + "#childprefs";
            var childPrefs = pdoc.getElementById(id);
            if (!childPrefs) {
              childPrefs = pdoc.createXULElement("preferences");
              currentPane.appendChild(childPrefs);
              childPrefs.id = id;
            }
            let panes = this.preferencePanes;
            for (let i = 0; i < panes.length; ++i) {
              var preferences = panes[i].preferences;
              for (var j = 0; j < preferences.length; ++j) {
                // Try to find a preference element for the same preference.
                var preference = null;
                var parentPreferences = pdoc.getElementsByTagName("preferences");
                for (var k = 0; (k < parentPreferences.length && !preference); ++k) {
                  var parentPrefs = parentPreferences[k]
                                       .getElementsByAttribute("name", preferences[j].name);
                  for (var l = 0; (l < parentPrefs.length && !preference); ++l) {
                    if (parentPrefs[l].localName == "preference")
                      preference = parentPrefs[l];
                  }
                }
                if (!preference) {
                  // No matching preference in the parent window.
                  preference = pdoc.createXULElement("preference");
                  childPrefs.appendChild(preference);
                  preference.name     = preferences[j].name;
                  preference.type     = preferences[j].type;
                  preference.inverted = preferences[j].inverted;
                  preference.readonly = preferences[j].readonly;
                  preference.disabled = preferences[j].disabled;
                }
                preference.value = preferences[j].value;
              }
            }
          }
        }
      } else {
        let panes = this.preferencePanes;
        for (var i = 0; i < panes.length; ++i)
          panes[i].writePreferences(false);

        let psvc = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefService);
        psvc.savePrefFile(null);
      }

      return true;
    });

    this.addEventListener("command", (event) => {
      if (event.originalTarget.hasAttribute("pane")) {
        var pane = document.getElementById(event.originalTarget.getAttribute("pane"));
        this.showPane(pane);
      }
    });

    this.addEventListener("keypress", (event) => {
      if((event.accel || event.metaKey) && event.key == 'w') {
        if (this.instantApply)
          window.close();
        event.stopPropagation();
        event.preventDefault();
      } else if (AppConstants.platform == 'win' && event.key == 'F1') {
        var helpButton = this.getButton("help");
        if (helpButton.disabled || helpButton.hidden)
          return;
        this._fireEvent("dialoghelp", this);
        event.stopPropagation();
        event.preventDefault();
      }
    }, true);
  }

  get fragment() {
    if (!this._fragment) {
      this._fragment = MozXULElement.parseXULToFragment(`
        <windowdragbox orient="vertical">
          <radiogroup anonid="selector" orient="horizontal" class="paneSelector chromeclass-toolbar"
                          role="listbox"/> <!-- Expose to accessibility APIs as a listbox -->
        </windowdragbox>
        <hbox flex="1" class="paneDeckContainer">
          <deck anonid="paneDeck" flex="1">
          </deck>
        </hbox>
        <hbox anonid="dlg-buttons" class="prefWindow-dlgbuttons" pack="end">`
        + this.osButtons + `
        </hbox>
        <hbox>
        </hbox>
      `);
    }
    return this.ownerDocument.importNode(this._fragment, true);
  }

  get osButtons() {
    if (AppConstants.platform == 'linux')
      return `
          <button dlgtype="disclosure" class="dialog-button" hidden="true"/>
          <button dlgtype="help" class="dialog-button" hidden="true" icon="help"/>
          <button dlgtype="extra2" class="dialog-button" hidden="true"/>
          <button dlgtype="extra1" class="dialog-button" hidden="true"/>
          <spacer anonid="spacer" flex="1"/>
          <button dlgtype="cancel" class="dialog-button" icon="cancel"/>
          <button dlgtype="accept" class="dialog-button" icon="accept"/>`;
    else
      return `
          <button dlgtype="extra2" class="dialog-button" hidden="true"/>
          <spacer anonid="spacer" flex="1"/>
          <button dlgtype="accept" class="dialog-button" icon="accept"/>
          <button dlgtype="extra1" class="dialog-button" hidden="true"/>
          <button dlgtype="cancel" class="dialog-button" icon="cancel"/>
          <button dlgtype="help" class="dialog-button" hidden="true" icon="help"/>
          <button dlgtype="disclosure" class="dialog-button" hidden="true"/>`;          
  }

  connectedCallback() {
    if (this._initialized) {
      return;
    }

    let childrenPrefpane = [...this.children].filter(child => child.tagName == 'prefpane');
    let otherChildren = [...this.children].filter(child => child.tagName != 'prefpane');
    let fragment = this.fragment;
    let deck = fragment.querySelector('deck');
    let fragmentLastChild = fragment.lastElementChild;
    this.appendChild(fragment);
    deck.append(...childrenPrefpane);
    fragmentLastChild.append(...otherChildren);

    this.hasAttribute("dlgbuttons") ? '' : this.setAttribute("dlgbuttons", "accept,cancel");
    this.hasAttribute("persist") ? '' : this.setAttribute("persist", "lastSelected screenX screenY");
    // this.hasAttribute("closebuttonlabel") ? '' : this.setAttribute("closebuttonlabel", "&preferencesCloseButton.label;");
    // this.hasAttribute("closebuttonaccesskey") ? '' : this.setAttribute("closebuttonaccesskey", "&preferencesCloseButton.accesskey;");
    this.hasAttribute("closebuttonlabel") ? '' : this.setAttribute("closebuttonlabel", MozXULElement.parseXULToFragment(`<div attr="&uiTour.infoPanel.close;" />`,["chrome://browser/locale/browser.dtd"]).childNodes[0].attributes[0].value);
    this.hasAttribute("closebuttonaccesskey") ? '' : this.setAttribute("closebuttonaccesskey", "C");
    this.hasAttribute("role") ? '' : this.setAttribute("role", "dialog");
    // this.hasAttribute("title") ? '' : this.setAttribute("title", "&preferencesDefaultTitleWin.title;");
    this.hasAttribute("title") ? '' : this.setAttribute("title", MozXULElement.parseXULToFragment(`<div attr="&preferencesCmd2.label;" />`,["chrome://browser/locale/browser.dtd"]).childNodes[0].attributes[0].value);

    /**
     * Derived bindings can set this to true to cause us to skip
     * reading the browser.preferences.instantApply pref in the constructor.
     * Then they can set instantApply to their wished value. -->
     */
    this._instantApplyInitialized = false;

    // Controls whether changed pref values take effect immediately.
    this.instantApply = false;

    this._currentPane = null;
    this._initialized = false;
    this._animateTimer = null;
    this._fadeTimer = null;
    this._animateDelay = 15;
    this._animateIncrement = 40;
    this._fadeDelay = 5;
    this._fadeIncrement = 0.40;
    this._animateRemainder = 0;
    this._currentHeight = 0;
    this._multiplier = 0;

    window.addEventListener("unload", this.disconnectedCallback);

    this._mStrBundle = null;

    this.addEventListener("keypress", (event) => {
      if (event.keyCode == KeyEvent.DOM_VK_RETURN) {
        this._hitEnter(event);
      }
    }, { mozSystemGroup: true });

    this.addEventListener("keypress", (event) => {
      if (event.keyCode == KeyEvent.DOM_VK_ESCAPE && !event.defaultPrevented) {
        this.cancelDialog();
      }
    }, { mozSystemGroup: true });

    if (AppConstants.platform == "macosx") {
      this.addEventListener("keypress", (event) => {
        if (event.key == "." && event.metaKey) {
          this.cancelDialog();
        }
      }, true);
    } else {
      this.addEventListener("focus", (event) => {
        let btn = this.getButton(this.defaultButton);
        if (btn) {
          btn.setAttribute("default",
            event.originalTarget == btn ||
            !(event.originalTarget.localName == "button" ||
              event.originalTarget.localName == "toolbarbutton"));
        }
      }, true);
    }

    // listen for when window is closed via native close buttons
    window.addEventListener("close", (event) => {
      if (!document.documentElement.cancelDialog()) {
        event.preventDefault();
      }
    });

    // for things that we need to initialize after onload fires
    window.addEventListener("load", (event) => this.postLoadInit(event));

    this._l10nButtons = [];

    Object.defineProperty(this, 'buttons', {
      get: () => {
        return this.getAttribute("buttons");
      },
      set: (val) => {
        this._configureButtons(val);
        return val;
      }
    });

    Object.defineProperty(this, 'defaultButton', {
      get: () => {
        if (this.hasAttribute("defaultButton"))
          return this.getAttribute("defaultButton");
        return "accept"; // default to the accept button
      },
      set: (val) => {
        this._setDefaultButton(val);
        return val;
      }
    });

    this.cancelDialog = function () {
      return this._doButtonCommand("cancel");
    };

    this.getButton = function (aDlgType) {
      return this._buttons[aDlgType];
    };

    Object.defineProperty(this, 'mStrBundle', {
      get: () => {
        if (!this._mStrBundle) {
          // need to create string bundle manually instead of using <xul:stringbundle/>
          // see bug 63370 for details
          this._mStrBundle = Cc["@mozilla.org/intl/stringbundle;1"]
                               .getService(Ci.nsIStringBundleService)
                               .createBundle("chrome://global/locale/dialog.properties");
        }
        return this._mStrBundle;
      }
    });

    this.postLoadInit = function (aEvent) {
      function focusInit() {
        const dialog = document.documentElement;
        const defaultButton = dialog.getButton(dialog.defaultButton);

        // give focus to the first focusable element in the dialog
        let focusedElt = document.commandDispatcher.focusedElement;
        if (!focusedElt) {
          document.commandDispatcher.advanceFocusIntoSubtree(dialog);

          focusedElt = document.commandDispatcher.focusedElement;
          if (focusedElt) {
            var initialFocusedElt = focusedElt;
            while (focusedElt.localName == "tab" ||
              focusedElt.getAttribute("noinitialfocus") == "true") {
              document.commandDispatcher.advanceFocusIntoSubtree(focusedElt);
              focusedElt = document.commandDispatcher.focusedElement;
              if (focusedElt)
              if (focusedElt == initialFocusedElt) {
                if (focusedElt.getAttribute("noinitialfocus") == "true") {
                  focusedElt.blur();
                }
                break;
              }
            }

            if (initialFocusedElt.localName == "tab") {
              if (focusedElt.hasAttribute("dlgtype")) {
                // We don't want to focus on anonymous OK, Cancel, etc. buttons,
                // so return focus to the tab itself
                initialFocusedElt.focus();
              }
            } else if (!/Mac/.test(navigator.platform) &&
                       focusedElt.hasAttribute("dlgtype") &&
                       focusedElt != defaultButton) {
              defaultButton.focus();
            }
          }
        }

        try {
          if (defaultButton)
            window.notifyDefaultButtonLoaded(defaultButton);
        } catch (e) {}
      }

      // Give focus after onload completes, see bug 103197.
      setTimeout(focusInit, 0);

      if (this._l10nButtons.length) {
        document.l10n.translateElements(this._l10nButtons).then(() => {
          window.sizeToContent();
        });
      }
    };

    this._configureButtons = function (aButtons) {
      // by default, get all the anonymous button elements
      var buttons = {};
      this._buttons = buttons;
      buttons.accept = document.getElementsByAttribute("dlgtype", "accept")[0];
      buttons.cancel = document.getElementsByAttribute("dlgtype", "cancel")[0];
      buttons.extra1 = document.getElementsByAttribute("dlgtype", "extra1")[0];
      buttons.extra2 = document.getElementsByAttribute("dlgtype", "extra2")[0];
      buttons.help = document.getElementsByAttribute("dlgtype", "help")[0];
      buttons.disclosure = document.getElementsByAttribute("dlgtype", "disclosure")[0];
      for (let button in buttons) {
        customElements.upgrade(buttons[button]);
      }
      // look for any overriding explicit button elements
      var exBtns = this.getElementsByAttribute("dlgtype", "*");
      var dlgtype;
      var i;
      for (i = 0; i < exBtns.length; ++i) {
        dlgtype = exBtns[i].getAttribute("dlgtype");
        if (buttons[dlgtype] != exBtns[i]) {
          buttons[dlgtype].hidden = true; // hide the anonymous button
          buttons[dlgtype] = exBtns[i];
        }
      }
      // add the label and oncommand handler to each button
      for (dlgtype in buttons) {
        var button = buttons[dlgtype];
        button.addEventListener("command", this._handleButtonCommand, true);
        // don't override custom labels with pre-defined labels on explicit buttons
        if (!button.hasAttribute("label")) {
          // dialog attributes override the default labels in dialog.properties
          if (this.hasAttribute("buttonlabel" + dlgtype)) {
            button.setAttribute("label", this.getAttribute("buttonlabel" + dlgtype));
            if (this.hasAttribute("buttonaccesskey" + dlgtype))
              button.setAttribute("accesskey", this.getAttribute("buttonaccesskey" + dlgtype));
          } else if (this.hasAttribute("buttonid" + dlgtype)) {
            document.l10n.setAttributes(button, this.getAttribute("buttonid" + dlgtype));
            this._l10nButtons.push(button);
          } else if (dlgtype != "extra1" && dlgtype != "extra2") {
            button.setAttribute("label", this.mStrBundle.GetStringFromName("button-" + dlgtype));
            var accessKey = this.mStrBundle.GetStringFromName("accesskey-" + dlgtype);
            if (accessKey)
              button.setAttribute("accesskey", accessKey);
          }
        }
        // allow specifying alternate icons in the dialog header
        if (!button.hasAttribute("icon")) {
          // if there's an icon specified, use that
          if (this.hasAttribute("buttonicon" + dlgtype))
            button.setAttribute("icon", this.getAttribute("buttonicon" + dlgtype));
          // otherwise set defaults
          else
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
      // ensure that hitting enter triggers the default button command
      this.defaultButton = this.defaultButton;
      // if there is a special button configuration, use it
      if (aButtons) {
        // expect a comma delimited list of dlgtype values
        var list = aButtons.split(",");
        // mark shown dlgtypes as true
        var shown = { accept: false, cancel: false, help: false,
                      disclosure: false, extra1: false, extra2: false };
        for (i = 0; i < list.length; ++i)
          shown[list[i].replace(/ /g, "")] = true;
        // hide/show the buttons we want
        for (dlgtype in buttons)
          buttons[dlgtype].hidden = !shown[dlgtype];
        // show the spacer on Windows only when the extra2 button is present
        if (/Win/.test(navigator.platform)) {
          var spacer = document.getElementsByAttribute("anonid", "spacer")[0];
          spacer.removeAttribute("hidden");
          spacer.setAttribute("flex", shown.extra2 ? "1" : "0");
        }
      }
    };

    this._setDefaultButton = function (aNewDefault) {
      // remove the default attribute from the previous default button, if any
      var oldDefaultButton = this.getButton(this.defaultButton);
      if (oldDefaultButton)
        oldDefaultButton.removeAttribute("default");
      var newDefaultButton = this.getButton(aNewDefault);
      if (newDefaultButton) {
        this.setAttribute("defaultButton", aNewDefault);
        newDefaultButton.setAttribute("default", "true");
      } else {
        this.setAttribute("defaultButton", "none");
        if (aNewDefault != "none")
          dump("invalid new default button: " + aNewDefault + ", assuming: none\n");
      }
    };

    this._handleButtonCommand = function (aEvent) {
      return document.documentElement._doButtonCommand(
                                    aEvent.target.getAttribute("dlgtype"));
    };

    this._doButtonCommand = function (aDlgType) {
      var button = this.getButton(aDlgType);
      if (!button.disabled) {
        var noCancel = this._fireButtonEvent(aDlgType);
        if (noCancel) {
          if (aDlgType == "accept" || aDlgType == "cancel") {
            var closingEvent = new CustomEvent("dialogclosing", {
              bubbles: true,
              detail: { button: aDlgType },
            });
            this.dispatchEvent(closingEvent);
            window.close();
          }
        }
        return noCancel;
      }
      return true;
    };

    this._fireButtonEvent = function (aDlgType) {
      var event = document.createEvent("Events");
      event.initEvent("dialog" + aDlgType, true, true);
      // handle dom event handlers
      return this.dispatchEvent(event);
    };

    this._hitEnter = function (evt) {
      if (evt.defaultPrevented)
        return;

      var btn = this.getButton(this.defaultButton);
      if (btn)
        this._doButtonCommand(this.defaultButton);
    };

    this._configureButtons(this.buttons);

    if (this.type != "child") {
      if (!this._instantApplyInitialized) {
        let psvc = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
        this.instantApply = psvc.getBoolPref("browser.preferences.instantApply");
      }
      if (this.instantApply) {
        var docElt = document.documentElement;
        var acceptButton = docElt.getButton("accept");
        acceptButton.hidden = true;
        var cancelButton = docElt.getButton("cancel");
        if (/Mac/.test(navigator.platform)) {
          // no buttons on Mac except Help
          cancelButton.hidden = true;
          // Move Help button to the end
          document.getElementsByAttribute("anonid", "spacer")[0].hidden = true;
          // Also, don't fire onDialogAccept on enter
          acceptButton.disabled = true;
        } else {
          // morph the Cancel button into the Close button
          cancelButton.setAttribute("icon", "close");
          cancelButton.label = docElt.getAttribute("closebuttonlabel");
          cancelButton.accesskey = docElt.getAttribute("closebuttonaccesskey");
        }
      }
    }
    this.setAttribute("animated", this._shouldAnimate ? "true" : "false");
    var panes = this.preferencePanes;

    var lastPane = null;
    if (this.lastSelected) {
      lastPane = document.getElementById(this.lastSelected);
      if (!lastPane) {
        this.lastSelected = "";
      }
    }

    for (var i = 0; i < panes.length; ++i) {
      this._makePaneButton(panes[i]);
      if (panes[i].loaded) {
        // Inline pane content, fire load event to force initialization.
        this._fireEvent("paneload", panes[i]);
      }
    }
    this.showPane(lastPane || panes[0]);

    if (panes.length == 1)
      this._selector.setAttribute("collapsed", "true");

    this._initialized = true;
  }

  disconnectedCallback() {
    // Release timers to avoid reference cycles.
    if (this._animateTimer) {
      this._animateTimer.cancel();
      this._animateTimer = null;
    }
    if (this._fadeTimer) {
      this._fadeTimer.cancel();
      this._fadeTimer = null;
    }
  }

  get preferencePanes() {
    return this.getElementsByTagName('prefpane');
  }

  get type() {
    return this.getAttribute('type');
  }

  get _paneDeck() {
    return document.getElementsByAttribute('anonid', 'paneDeck')[0];
  }

  get _paneDeckContainer() {
    return document.getElementsByAttribute('class', 'paneDeckContainer')[0];
  }

  get _selector() {
    return document.getElementsByAttribute('anonid', 'selector')[0];
  }

  get lastSelected() {
    return this.getAttribute('lastSelected');
  }

  set lastSelected(val) {
    this.setAttribute("lastSelected", val);
    const {Services} = ChromeUtils.import('resource://gre/modules/Services.jsm');
    Services.xulStore.persist(this, "lastSelected");
    return val;
  }

  get currentPane() {
    if (!this._currentPane)
      this._currentPane = this.preferencePanes[0];

    return this._currentPane;
  }

  set currentPane(val) {
    return this._currentPane = val;
  }

  get _shouldAnimate() {
    var psvc = Cc["@mozilla.org/preferences-service;1"]
                 .getService(Ci.nsIPrefBranch);
    return psvc.getBoolPref("browser.preferences.animateFadeIn",
                            /Mac/.test(navigator.platform));
  }

  get _sizeIncrement() {
    var lastSelectedPane = document.getElementById(this.lastSelected);
    var increment = this._animateIncrement * this._multiplier;
    var newHeight = this._currentHeight + increment;
    if ((this._multiplier > 0 && this._currentHeight >= lastSelectedPane.contentHeight) ||
        (this._multiplier < 0 && this._currentHeight <= lastSelectedPane.contentHeight))
      return 0;

    if ((this._multiplier > 0 && newHeight > lastSelectedPane.contentHeight) ||
        (this._multiplier < 0 && newHeight < lastSelectedPane.contentHeight))
      increment = this._animateRemainder * this._multiplier;
    return increment;
  }

  _makePaneButton(aPaneElement) {
    var radio = document.createXULElement("radio");
    radio.setAttribute("is", 'pane-button');
    radio.setAttribute("pane", aPaneElement.id);
    radio.setAttribute("value", aPaneElement.id);
    radio.setAttribute("label", aPaneElement.label);
    // Expose preference group choice to accessibility APIs as an unchecked list item
    // The parent group is exposed to accessibility APIs as a list
    if (aPaneElement.image)
      radio.setAttribute("src", aPaneElement.image);
    radio.style.listStyleImage = aPaneElement.style.listStyleImage;
    this._selector.appendChild(radio);
    return radio;
  }

  showPane(aPaneElement) {
    if (!aPaneElement)
      return;

    this._selector.selectedItem = document.getElementsByAttribute("pane", aPaneElement.id)[0];
    if (!aPaneElement.loaded) {
      let OverlayLoadObserver = function(aPane) {
        this._pane = aPane;
      }
      OverlayLoadObserver.prototype = {
        _outer: this,
        observe(aSubject, aTopic, aData) {
          this._pane.loaded = true;
          this._outer._fireEvent("paneload", this._pane);
          this._outer._selectPane(this._pane);
        }
      };

      var obs = new OverlayLoadObserver(aPaneElement);

      //Pane overlay have to be move to earlier stage to load properly but not without issue see ln 601
      // document.loadOverlay(aPaneElement.src, obs);

      // Components.utils.import("chrome://tabmixplus/content/ChromeManifest.jsm");
      // Components.utils.import("chrome://tabmixplus/content/Overlays.jsm");

      // let ov = new Overlays(new ChromeManifest(),document.defaultView);
      // ov.load(aPaneElement.src);
      obs.observe();

    } else
      this._selectPane(aPaneElement);
  }

  _fireEvent(aEventName, aTarget) {
    // Panel loaded, synthesize a load event.
    try {
      var event = document.createEvent("Events");
      event.initEvent(aEventName, true, true);
      var cancel = !aTarget.dispatchEvent(event);
      if (aTarget.hasAttribute("on" + aEventName)) {
        var fn = new Function("event", aTarget.getAttribute("on" + aEventName));
        var rv = fn.call(aTarget, event);
        if (!rv)
          cancel = true;
      }
      return !cancel;
    } catch (e) {
      Cu.reportError(e);
    }
    return false;
  }

  _selectPane(aPaneElement) {
    if (/Mac/.test(navigator.platform)) {
      var paneTitle = aPaneElement.label;
      if (paneTitle != "")
        document.title = paneTitle;
    }
    var helpButton = document.documentElement.getButton("help");
    if (aPaneElement.helpTopic)
      helpButton.hidden = false;
    else
      helpButton.hidden = true;

    // Find this pane's index in the deck and set the deck's
    // selectedIndex to that value to switch to it.
    var prefpanes = this.preferencePanes;
    for (var i = 0; i < prefpanes.length; ++i) {
      if (prefpanes[i] == aPaneElement) {
        this._paneDeck.selectedIndex = i;

        if (this.type != "child") {
          if (aPaneElement.hasAttribute("flex") && this._shouldAnimate &&
              prefpanes.length > 1)
            aPaneElement.removeAttribute("flex");
          // Calling sizeToContent after the first prefpane is loaded
          // will size the windows contents so style information is
          // available to calculate correct sizing.
          if (!this._initialized && prefpanes.length > 1) {
            if (this._shouldAnimate)
              this.style.minHeight = 0;
            window.sizeToContent();
          }

          var oldPane = this.lastSelected ? document.getElementById(this.lastSelected) : this.preferencePanes[0];
          oldPane.selected = !(aPaneElement.selected = true);
          this.lastSelected = aPaneElement.id;
          this.currentPane = aPaneElement;
          this._initialized = true;

          // Only animate if we've switched between prefpanes
          if (this._shouldAnimate && oldPane.id != aPaneElement.id) {
            aPaneElement.style.opacity = 0.0;
            this.animate(oldPane, aPaneElement);
          } else if (!this._shouldAnimate && prefpanes.length > 1) {
            var targetHeight = parseInt(window.getComputedStyle(this._paneDeckContainer).height);
            var verticalPadding = parseInt(window.getComputedStyle(aPaneElement).paddingTop);
            verticalPadding += parseInt(window.getComputedStyle(aPaneElement).paddingBottom);
            if (aPaneElement.contentHeight > targetHeight - verticalPadding) {
              // To workaround the bottom border of a groupbox from being
              // cutoff an hbox with a class of bottomBox may enclose it.
              // This needs to include its padding to resize properly.
              // See bug 394433
              var bottomPadding = 0;
              var bottomBox = aPaneElement.getElementsByAttribute("class", "bottomBox")[0];
              if (bottomBox)
                bottomPadding = parseInt(window.getComputedStyle(bottomBox).paddingBottom);
              window.innerHeight += bottomPadding + verticalPadding + aPaneElement.contentHeight - targetHeight;
            }
            
            // XXX rstrong - extend the contents of the prefpane to
            // prevent elements from being cutoff (see bug 349098).
            if (aPaneElement.contentHeight + verticalPadding < targetHeight)
              aPaneElement._content.style.height = targetHeight - verticalPadding + "px";
          }
        }
        break;
      }
    }
  }

  animate(aOldPane, aNewPane) {
    // if we are already resizing, use currentHeight
    var oldHeight = this._currentHeight ? this._currentHeight : aOldPane.contentHeight;

    this._multiplier = aNewPane.contentHeight > oldHeight ? 1 : -1;
    var sizeDelta = Math.abs(oldHeight - aNewPane.contentHeight);
    this._animateRemainder = sizeDelta % this._animateIncrement;

    this._setUpAnimationTimer(oldHeight);
  }

  _setUpAnimationTimer(aStartHeight) {
    if (!this._animateTimer)
      this._animateTimer = Cc["@mozilla.org/timer;1"]
                             .createInstance(Ci.nsITimer);
    else
      this._animateTimer.cancel();
    this._currentHeight = aStartHeight;

    let callback = () => {
      if (!document && this._animateTimer) {
        this._animateTimer.cancel();
      }

      var increment = this._sizeIncrement;
      if (increment != 0) {
        window.innerHeight += increment;
        this._currentHeight += increment;
      } else {
        this._animateTimer.cancel();
        this._setUpFadeTimer();
      }
    };

    this._animateTimer.initWithCallback(callback, this._scrollDelay,
                                        this._animateTimer.TYPE_REPEATING_SLACK);
  }

  _setUpFadeTimer(aStartHeight) {
    if (!this._fadeTimer)
      this._fadeTimer = Cc["@mozilla.org/timer;1"]
                          .createInstance(Ci.nsITimer);
    else
      this._fadeTimer.cancel();

    this._fadeTimer.initWithCallback(this, this._fadeDelay,
                                     Ci.nsITimer.TYPE_REPEATING_SLACK);

    let callback = () => {
      if (!document && this._fadeTimer) {
        this._fadeTimer.cancel();
      }

      var elt = document.getElementById(this.lastSelected);
      var newOpacity = parseFloat(window.getComputedStyle(elt).opacity) + this._fadeIncrement;
      if (newOpacity < 1.0)
        elt.style.opacity = newOpacity;
      else {
        this._animateTimer.cancel();
        elt.style.opacity = 1.0;
      }
    };

    this._fadeTimer.initWithCallback(callback, this._fadeDelay,
                                        this._fadeTimer.TYPE_REPEATING_SLACK);

  }

  addPane(aPaneElement) {
    this.appendChild(aPaneElement);

    // Set up pane button
    this._makePaneButton(aPaneElement);
  }

  openSubDialog(aURL, aFeatures, aParams) {
    return openDialog(aURL, "", "modal,centerscreen,resizable=no" + (aFeatures != "" ? ("," + aFeatures) : ""), aParams);
  }

  openWindow(aWindowType, aURL, aFeatures, aParams) {
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
               .getService(Ci.nsIWindowMediator);
    var win = aWindowType ? wm.getMostRecentWindow(aWindowType) : null;
    if (win) {
      if ("initWithParams" in win)
        win.initWithParams(aParams);
      win.focus();
    } else {
      var features = "resizable,dialog=no,centerscreen" + (aFeatures != "" ? ("," + aFeatures) : "");
      var parentWindow = (this.instantApply || !window.opener || window.opener.closed) ? window : window.opener;
      win = parentWindow.openDialog(aURL, "_blank", features, aParams);
    }
    return win;
  }
}

customElements.define("preferences", Preferences);
customElements.define("preference", Preference);
customElements.define("prefpane", PrefPane);
customElements.define("pane-button", PaneButton, { extends: "radio" });