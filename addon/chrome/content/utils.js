"use strict";

/** @type {TabmixGlobal & Record<string, any>} */ // @ts-expect-error - TabmixGlobal included properties added in another files
var Tabmix = {
  get prefs() {
    return this.lazyGetter(this, "prefs", Services.prefs.getBranch("extensions.tabmix."));
  },

  get defaultPrefs() {
    return this.lazyGetter(
      this,
      "defaultPrefs",
      Services.prefs.getDefaultBranch("extensions.tabmix.")
    );
  },

  isVersion(versionNo, updateChannel) {
    return TabmixSvc.version.apply(null, [versionNo, updateChannel]);
  },

  isAltKey(event) {
    return event.altKey || event.getModifierState("AltGraph");
  },

  // for debug
  debug: function TMP_utils_debug(aMessage, aShowCaller) {
    if (this._debug) {
      this.log(aMessage, aShowCaller);
    }
  },

  // Show/hide one item (specified via name or the item element itself).
  showItem(aItemOrId, aShow) {
    var item = typeof aItemOrId == "string" ? document.getElementById(aItemOrId) : aItemOrId;
    if (item && item.hidden == Boolean(aShow)) {
      item.hidden = !aShow;
    }
  },

  setItem(aItemOrId, aAttr, aVal) {
    var elem = typeof aItemOrId == "string" ? document.getElementById(aItemOrId) : aItemOrId;
    if (elem) {
      if (aVal === null || aVal === undefined) {
        elem.removeAttribute(aAttr);
        return;
      }
      if (typeof aVal == "boolean") {
        aVal = aVal ? "true" : "false";
      }

      if (!elem.hasAttribute(aAttr) || elem.getAttribute(aAttr) != aVal) {
        const stringVal = typeof aVal !== "string" ? String(aVal) : aVal;
        elem.setAttribute(aAttr, stringVal);
      }
    }
  },

  setAttributeList(aItemOrId, aAttr, aValue, aAdd) {
    let elem = typeof aItemOrId == "string" ? document.getElementById(aItemOrId) : aItemOrId;
    if (!elem) {
      console.error(`Tabmix setAttributeList: ${aItemOrId} not found`);
      return;
    }
    let att = elem.getAttribute(aAttr);
    let array = att ? att.split(" ") : [];
    let index = array.indexOf(aValue);
    if (aAdd && index == -1) {
      array.push(aValue);
    } else if (!aAdd && index != -1) {
      array.splice(index, 1);
    }

    if (array.length) {
      elem.setAttribute(aAttr, array.join(" "));
    } else {
      elem.removeAttribute(aAttr);
    }
  },

  setFTLDataId(elementId, map = TabmixSvc.i10IdMap) {
    /** @type {TabmixGlobal["convert"]} */
    function convert(id, data = map[id]) {
      return data && !Tabmix.isVersion(data.before) ? convert(data.l10n) : id;
    }

    /** @type {(HTMLElement & HTMLInputElement & XULTab) | null | undefined} */
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Tabmix setFTLDataId: ${elementId} not found`);
      return;
    }

    /** @type {(HTMLElement | null)[]} */
    const nodes =
      element.hasAttribute("data-lazy-l10n-id") ?
        [element]
      : [...element.querySelectorAll("[data-lazy-l10n-id]")];
    nodes.forEach(el => {
      if (!el) return;
      const dataId = el.getAttribute("data-lazy-l10n-id");
      if (!dataId) {
        console.error(`Tabmix setFTLDataId: ${elementId} has no data-lazy-l10n-id`);
        return;
      }
      const l10Id = convert(dataId);
      el.setAttribute("data-l10n-id", l10Id);
      el.removeAttribute("data-lazy-l10n-id");
    });
  },

  getBoundsWithoutFlushing(element) {
    return window.windowUtils?.getBoundsWithoutFlushing(element) ?? element.getBoundingClientRect();
  },

  getTopWin() {
    return Services.wm.getMostRecentWindow("navigator:browser");
  },

  isNewWindowAllow(isPrivate = false) {
    // allow to open new window if:
    //   user are not in single window mode or
    //   there is no other window with the same privacy type
    return (
      !TabmixSvc.getSingleWindowMode() || !BrowserWindowTracker.getTopWindow({private: isPrivate})
    );
  },

  lazy_import(aObject, aName, aModule, aSymbol, aFlag, aArg) {
    if (aFlag) {
      this[aModule + "Initialized"] = false;
    }

    var self = this;
    ChromeUtils.defineLazyGetter(aObject, aName, () => {
      /** @type {any} */
      let tmp = ChromeUtils.importESModule(
        // @ts-expect-error - importESModule
        "chrome://tabmix-resource/content/" + aModule + ".sys.mjs"
      );
      let Obj = tmp[aSymbol];
      if ("prototype" in tmp[aSymbol]) {
        Obj = new Obj();
      } else if ("init" in Obj) {
        Obj.init.apply(Obj, aArg);
      }

      if (aFlag) {
        self[aModule + "Initialized"] = true;
      }

      return Obj;
    });
  },

  lazyGetter(
    obj,
    name,
    get,
    baseConfig = {
      configurable: true,
      enumerable: true,
    }
  ) {
    if (!(name in obj)) {
      console.error(
        `Tabmix.lazyGetter: "get ${name}" does not exist when calling:\n${Error().stack?.split("\n").slice(1, 2) ?? ""}`
      );
    }
    const config = {
      ...baseConfig,
      value: typeof get == "function" ? get() : get,
    };
    Object.defineProperty(obj, name, config);
    return config.value;
  },

  backwardCompatibilityGetter(aObject, aOldName, aNewName) {
    if (aOldName in aObject) {
      return;
    }

    var self = this;
    Object.defineProperty(aObject, aOldName, {
      get() {
        self.informAboutChangeInTabmix(aOldName, aNewName);
        delete aObject[aOldName];
        return (aObject[aOldName] = self.getObject(window, aNewName));
      },
      configurable: true,
    });
  },

  informAboutChangeInTabmix(aOldName, aNewName) {
    let err = Error(aOldName + " is deprecated in Tabmix, use " + aNewName + " instead.");
    // cut off the first lines, we looking for the function that trigger the getter.
    let stack = Error().stack?.split("\n").slice(3) ?? [];
    let stackData = stack[0] ? stack[0].split("@") : null;
    if (stackData && stackData.length == 2) {
      let [path = "", line = 0] = stackData[1]?.replace("chrome://", "").split(":") ?? [];
      let index = path.indexOf("/") - 1;
      let extensionName =
        index > -1 ? path.charAt(0).toUpperCase() + path.substr(1, index) + " " : "";
      this.clog(
        `${err.message}\n\n${extensionName}extension call ${aOldName} from:
  file: chrome://${path}
  line: ${line}

  Report about this to Tabmix developer at https://github.com/onemen/TabMixPlus/issues${extensionName ? ` and ${extensionName} developer.` : "."}`
      );
    } else {
      this.clog(err.message + "\n\n" + stack);
    }
  },

  windowEnumerator: function Tabmix_windowEnumerator(aWindowtype) {
    if (typeof aWindowtype == "undefined") {
      aWindowtype = "navigator:browser";
    }

    return Services.wm.getEnumerator(aWindowtype);
  },

  numberOfWindows: function Tabmix_numberOfWindows(all, aWindowtype) {
    var enumerator = this.windowEnumerator(aWindowtype);
    var count = 0;
    while (enumerator.hasMoreElements()) {
      let win = enumerator.getNext();
      if (!win.closed) {
        count++;
        if (!all && count == 2) {
          break;
        }
      }
    }
    return count;
  },

  get isFirstWindowInSession() {
    // this.firstWindowInSession is undefined before TabmixSvc.windowStartup._initialized
    return this.firstWindowInSession ?? TabmixSvc.windowStartup._initialized === false;
  },

  get isSingleBrowserWindow() {
    return this.numberOfWindows(false, "navigator:browser") == 1;
  },

  get isLastBrowserWindow() {
    return this.isSingleBrowserWindow;
  },

  compare: function TMP_utils_compare(a, b, lessThan) {
    return lessThan ? a < b : a > b;
  },

  itemEnd: function TMP_utils_itemEnd(item, end) {
    return item.screenX + (end ? item.getBoundingClientRect().width : 0);
  },

  show(aMethod, aDelay, aWindow) {
    TabmixSvc.console.show(aMethod, aDelay, aWindow || window);
  },

  // console._removeInternal use this function name to remove it from
  // caller list
  _getMethod: function TMP_console_wrapper(id, args) {
    if (["changeCode", "setNewFunction", "nonStrictMode"].indexOf(id) > -1) {
      this.installChangecode();
      return this[id].apply(this, args);
    }
    if (typeof TabmixSvc.console[id] == "function") {
      return TabmixSvc.console[id].apply(TabmixSvc.console, args);
    }
    TabmixSvc.console.trace("unexpected method " + id);
    return null;
  },

  installChangecode() {
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js", window);
    this.installChangecode = function () {};
  },

  _init() {
    const destroy = () => {
      window.removeEventListener("unload", destroy);
      this.destroy();
    };
    window.addEventListener("unload", destroy);

    var methods = [
      "changeCode",
      "setNewFunction",
      "nonStrictMode",
      "getObject",
      "log",
      "getCallerNameByIndex",
      "callerName",
      "clog",
      "isCallerInList",
      "callerTrace",
      "obj",
      "assert",
      "trace",
      "reportError",
    ];
    methods.forEach(id => {
      this[id] = function TMP_console_wrapper() {
        return this._getMethod(id, arguments);
      };
      this[id] = this[id].bind(this);
    });
  },

  originalFunctions: {},
  destroy: function TMP_utils_destroy() {
    this.originalFunctions = {};
  },
};

Tabmix._init();
Tabmix.lazy_import(window, "TabmixSvc", "TabmixSvc", "TabmixSvc");
