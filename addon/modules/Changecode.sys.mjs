import {isVersion} from "chrome://tabmix-resource/content/BrowserVersion.sys.mjs";
import {TabmixSvc} from "chrome://tabmix-resource/content/TabmixSvc.sys.mjs";
import {AppConstants} from "resource://gre/modules/AppConstants.sys.mjs";

/** @type {{console: LogModule.Console}} */ // @ts-ignore
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  console: "chrome://tabmix-resource/content/log.sys.mjs",
});

const DEBUGMODE = Services.prefs.getBoolPref("extensions.tabmix.debugMode", false);
const errMsgContent =
  "\n\nTry Tabmix latest development version from https://github.com/onemen/TabMixPlus/releases/tag/dev-build," +
  "\nReport about this to Tabmix developer at https://github.com/onemen/TabMixPlus/issues";

// Constants used in toCode method for debug mode
// List of functions that we don't wrap with try-catch
const dontDebug = ["gBrowser.tabContainer._animateTabMove, gURLBar.handleCommand"];
// List of functions that don't need a "return null" fallback in debug mode
const customTitlebarName = isVersion(1350) ? "CustomTitlebar._update" : "TabsInTitlebar._update";
const excludeReturn = [customTitlebarName, "gBrowser._blurTab"];

const MODULE_SANDBOXES_SET = new Map();
const SHARED_SANDBOX_KEY = new (Cu.getGlobalForObject(Services).Object)();
let _sandboxId = 0;

(function cleanup() {
  function cleanupSandboxes() {
    Services.obs.removeObserver(cleanupSandboxes, "quit-application");
    for (const sandbox of MODULE_SANDBOXES_SET.values()) {
      try {
        Cu.nukeSandbox(sandbox);
      } catch {}
    }
    MODULE_SANDBOXES_SET.clear();
  }
  Services.obs.addObserver(cleanupSandboxes, "quit-application");
})();

/** @typedef {ChangecodeModule.ChangeCodeClass} ChangeCodeClass */

/** @implements {ChangeCodeClass} */
class ChangeCode {
  _errorStack = null;
  _value = "";
  obj;
  fnName;
  fullName;
  needUpdate = false;
  silent;
  errMsg = "";
  sandbox;

  /** @type {"__lookupSetter__" | "__lookupGetter__" | ""} */
  type = "";

  /** @type {string[]} */
  notFound = [];

  /** @param {ChangecodeModule.ChangeCodeParams} params */
  constructor(params) {
    this.obj = params.obj;
    this.fnName = params.fnName;
    this.fullName = params.fullName;

    const {forceUpdate = false, silent = false, set, get, sandbox} = params.options ?? {};
    this.needUpdate = forceUpdate;
    this.silent = silent;

    if (set || get) {
      this.type = set ? "__lookupSetter__" : "__lookupGetter__";
      this._value = this.obj[this.type](this.fnName).toString();
    } else if (typeof this.obj[this.fnName] === "function") {
      this._value = this.obj[this.fnName].toString();
    } else {
      this.errMsg = `\n${this.fullName} is undefined.`;
    }

    // While some modules set baseSandbox, not all do.
    // This warning ensures we remember to pass the sandbox option
    // for all module objects rather than maintaining a list of exceptions.
    if (sandbox) {
      this.sandbox = sandbox;
    } else {
      const global = Cu.getGlobalForObject(this.obj);
      if (isInWindowContext(global)) {
        this.sandbox = params.baseSandbox;
      } else {
        const {filename, lineNumber} = Components.stack.caller.caller;
        lazy.console.reportError(
          `scripts from module must use global sandbox\n${params.fullName} - ${filename}:${lineNumber}`
        );
        // fallback to the global sandbox
        this.sandbox = createModuleSandbox(Services, {shared: true});
      }
    }

    // Check for private methods and replace them
    const result = verifyPrivateMethodReplaced(this._value, this.obj, this.fullName);
    this._value = result.code;
    this.needUpdate = this.needUpdate || result.needUpdate;

    this.notFound.length = 0;
  }

  get value() {
    this.isValidToChange(this.fullName);
    return this._value;
  }

  /** @type {ChangeCodeClass["_replace"]} */
  _replace(substr, newString, params) {
    // Don't insert new code before "use strict";
    if (substr == "{") {
      const re = /['|"]use strict['|"];/;
      const result = re.exec(this._value);
      if (result) {
        if (!newString.startsWith("$&")) {
          newString = newString.replace(substr, `${result[0]}\n`);
        }
        substr = result[0];
      }
    }
    let silent;
    if (typeof params != "undefined") {
      let doReplace, flags;
      if (typeof params == "object") {
        doReplace = "check" in params ? params.check : true;
        flags = params.flags;
        silent = params.silent;
      } else if (typeof params == "boolean") {
        doReplace = params;
      }
      if (!doReplace) {
        return this;
      }
      if (flags && typeof substr == "string") {
        substr = new RegExp(substr.replace(/[{[(\\^.$|?*+/)\]}]/g, "\\$&"), flags);
      }
    }

    const exist =
      typeof substr == "string" ? this._value.indexOf(substr) > -1 : substr.test(this._value);
    if (exist) {
      this._value = this._value.replace(substr, newString);
      this.needUpdate = true;
    } else if (!silent) {
      if (!this._errorStack) {
        this._errorStack = Components.stack;
      }
      this.notFound.push(substr);
    }
    return this;
  }

  /** @type {ChangeCodeClass["toCode"]} */
  toCode(show, overrideObj, name) {
    try {
      if (DEBUGMODE && !dontDebug.includes(this.fullName)) {
        let addReturn = "";
        const re = new RegExp("//.*", "g");
        if (
          !excludeReturn.includes(this.fullName) &&
          /return\s.+/.test(this._value.replace(re, ""))
        ) {
          addReturn = "\nreturn null\n";
        }
        this._value =
          `${this._value.replace(/\([^)]*\)\s*{/, "$&\ntry {")} catch (ex) {` +
          `   TabmixSvc.lazy.console.assert(ex, "outer try-catch in ${name || this.fullName}");}${
            addReturn
          } }`;
      }
      const [obj, fnName] = [overrideObj || this.obj, name || this.fnName];
      if (this.isValidToChange(this.fullName)) {
        if (obj) {
          _setNewFunction(obj, fnName, _makeCode(this._value, this.sandbox));
        } else {
          lazy.console.log(`Error: unable to find object for ${this.fullName}`);
        }
      }
      if (show) {
        this.show(obj, fnName);
      }
    } catch (ex) {
      lazy.console.reportError(
        ex,
        `${lazy.console.callerName()} failed to change ${this.fullName}\nError: `
      );

      lazy.console.log(this._value);
    }
  }

  /** @type {ChangeCodeClass["defineProperty"]} */
  defineProperty(overrideObj, name, codeInfo) {
    if (!this.type) {
      throw new Error(`Tabmix:\n${this.fullName} don't have setter or getter`);
    }

    if (!this.isValidToChange(this.fullName)) {
      return;
    }

    const [obj, fnName] = [overrideObj || this.obj, name || this.fnName];

    /** @type {Partial<ChangecodeModule.Descriptor>} */
    const descriptor = {enumerable: true, configurable: true};

    const removeSpaces = function (_match = "", p1 = "", p2 = "", p3 = "") {
      return p1 + (p2 + p3).replace(/\s/g, "_");
    };

    /** @param {"set" | "get"} type */
    const setDescriptor = type => {
      const fnType = type === "set" ? "__lookupSetter__" : "__lookupGetter__";

      /** @type {string | FunctionWithAny} */
      let code = codeInfo?.[type] || (this.type == fnType ? this._value : obj[fnType](fnName));

      if (typeof code == "string") {
        // bug 1255925 - Give a name to getters/setters add space before the function name
        // replace function get Foo() to function get_Foo()
        code = code.replace(/^(function\s)?(get|set)(.*\()/, removeSpaces);
        descriptor[type] = _makeCode(code, this.sandbox);
      } else if (typeof code != "undefined") {
        descriptor[type] = code;
      }
    };

    setDescriptor("get");
    setDescriptor("set");

    Object.defineProperty(obj, fnName, descriptor);
  }

  /** @type {ChangeCodeClass["show"]} */
  show(obj, name = "") {
    if (obj?.hasOwnProperty(name)) {
      lazy.console.show({obj, name, fullName: this.fullName});
    } else if (typeof this.fullName == "string") {
      const win = typeof window != "undefined" ? window : undefined;
      lazy.console.show(this.fullName, 500, win);
    }
  }

  /** @type {ChangeCodeClass["isValidToChange"]} */
  isValidToChange(name) {
    const notFoundCount = this.notFound.length;
    if (this.needUpdate && !notFoundCount) {
      return true;
    }

    const stack = this._errorStack ?? Components.stack;
    if (notFoundCount && !this.silent) {
      const ex = this.getCallerData(stack);
      const str = `${notFoundCount > 1 ? "s" : ""}\n    `;
      ex.message = `${ex.name} was unable to change ${name}.${
        this.errMsg || `\ncan't find string${str}${this.notFound.join("\n    ")}`
      }${errMsgContent}`;
      lazy.console.reportError(ex);
      if (DEBUGMODE) {
        lazy.console.clog(`${ex.name}\nfunction ${name} = ${this._value}`, ex);
      }
    } else if (!this.needUpdate && DEBUGMODE) {
      const ex = this.getCallerData(stack?.caller);
      lazy.console.clog(`${ex.name} no update needed to ${name}`, ex);
    }
    return false;
  }

  /** @type {ChangeCodeClass["getCallerData"]} */
  getCallerData(stack) {
    const caller = stack.caller || {};
    const error = lazy.console.error(caller);
    const name = caller.name ?? caller.caller?.name ?? "unknown";
    Object.assign(error, {name, message: ""});
    return error;
  }
}

/** @type {TabmixGlobal["setNewFunction"]} */
function _setNewFunction(obj, name, code) {
  if (!Object.getOwnPropertyDescriptor(obj, name)) {
    Object.defineProperty(obj, name, {
      value: code,
      writable: true,
      configurable: true,
    });
  } else {
    obj[name] = code;
  }
}

/**
 * @typedef {{location: {href: string}}} Context
 * @param {Context | string} obj - Object with location property or href string
 */
function isInWindowContext(obj) {
  const href = typeof obj === "string" ? obj : obj?.location?.href;
  return (
    href === "chrome://browser/content/browser.xhtml" ||
    href === "chrome://tabmixplus/content/preferences/preferences.xhtml"
  );
}

/** @type {ChangecodeModule.updateSandboxWithScope} */
function updateSandboxWithScope(sandbox, scope) {
  if (!Object.keys(scope).length) {
    return sandbox;
  }

  // Handle scope properties with special case for 'lazy'
  const {lazy: scopeLazy, ...restScope} = scope;

  // For regular properties, only add if they don't exist
  for (const [key, value] of Object.entries(restScope)) {
    if (!Object.prototype.hasOwnProperty.call(sandbox, key)) {
      sandbox[key] = value;
    }
  }

  // Special handling for 'lazy' object - only add if properties don't exist
  if (typeof scopeLazy === "object" && scopeLazy !== null) {
    if (sandbox.lazy) {
      // Only add properties that don't exist
      for (const [key, value] of Object.entries(scopeLazy)) {
        if (!Object.prototype.hasOwnProperty.call(sandbox.lazy, key)) {
          sandbox.lazy[key] = value;
        }
      }
    } else {
      // @ts-expect-error - We know what we're doing here
      sandbox.lazy = scopeLazy;
    }
  }

  return sandbox;
}

/** @type {ChangecodeModule.createModuleSandbox} */
function createModuleSandbox(obj, options = {}) {
  const {shared = true, scope = {}} = options;
  const key = shared ? SHARED_SANDBOX_KEY : obj;
  let sandbox = MODULE_SANDBOXES_SET.get(key);
  if (sandbox) {
    return updateSandboxWithScope(sandbox, scope);
  }

  const id = _sandboxId++;

  sandbox = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal(), {
    sandboxName: `Tabmix sandbox for module ${id}`,
    wantGlobalProperties: ["ChromeUtils"],
    wantXrays: false,
  });

  // Initialize sandbox with base properties
  Object.assign(sandbox, {
    AppConstants,
    Cc,
    Ci,
    Cr,
    Cu,
    console: lazy.console,
    sandbox,
    TabmixSvc,
    _shared: shared,
    _id: id,
    _type: "module",
    ...scope,
  });

  MODULE_SANDBOXES_SET.set(key, sandbox);
  return sandbox;
}

/** @type {ChangecodeModule["verifyPrivateMethodReplaced"]} */
function verifyPrivateMethodReplaced(code, obj, fullName) {
  const matches = code.match(/this\.#(\w+)/g);
  if (!matches) {
    return {code, needUpdate: false};
  }

  const privateMethods = new Set(matches.map(match => match.replace("this.#", "")));
  const parts = fullName ? fullName.split(".") : [];
  const methodName = parts.at(-1) || "";
  const parentName = parts.slice(0, -1).join(".");
  if (methodName) {
    privateMethods.delete(methodName.replace(/^_/, ""));
  }
  const ex = lazy.console.error(Components.stack.caller?.caller);

  for (const method of privateMethods) {
    if (obj && typeof obj[`_${method}`] === "undefined") {
      ex.message = `Implement replacement for private method #${method} in ${parentName} it is used by ${fullName || "makeCode"}${errMsgContent}`;
      lazy.console.reportError(ex);
    }
  }

  return {
    code: code.replace(/this\.#(\w+)/g, "this._$1"),
    needUpdate: true,
  };
}

let scriptId = 0;

/** @type {ChangecodeModule["_makeCode"]} */
function _makeCode(code, sandbox) {
  if (!sandbox) {
    throw new Error("Error: _makeCode was called without sandbox");
  }

  let codeString;
  if (code.startsWith("async") && !code.startsWith("async function")) {
    codeString = `(async function ${code.replace(/^async/, "")})`;
  } else if (!code.startsWith("function")) {
    codeString = `(function ${code})`;
  } else {
    codeString = `(${code})`;
  }

  // to enable clickable link in the browser lazy.console enable debug mode by
  // setting extensions.tabmix.enableDebug in about:config to true
  const functionNameMatch = codeString.match(/\((?:async\s+)?function\s+(\w+)/);
  const functionName = functionNameMatch ? functionNameMatch[1] : "anonymous_";
  const filename = `${functionName}_${scriptId++}`;
  const readableFilename =
    DEBUGMODE ?
      `data:application/javascript,Tabmix_code_${filename};${encodeURIComponent(codeString)}`
    : `Tabmix_code_${filename}.js`;

  return Cu.evalInSandbox(codeString, sandbox, null, readableFilename, 1);
}

/** @type {ChangecodeModule.ExpandTabmix} */
const expandTabmix = {
  _debugMode: DEBUGMODE,

  // @ts-expect-error - when ChangeCode throw an error Tabmix.changeCode is null
  changeCode(parent, fnName, options) {
    try {
      return new ChangeCode({
        obj: parent,
        fnName: fnName.split(".").pop() ?? "",
        fullName: fnName,
        options: options ?? {},
        baseSandbox: this._sandbox,
      });
    } catch (/** @type {any} */ ex) {
      lazy.console.clog(
        `${lazy.console.callerName()} failed to change ${fnName}\nError: ${ex.message}`
      );
      if (DEBUGMODE) {
        lazy.console.obj(parent, "aParent");
      }
    }
    return null;
  },

  setNewFunction: _setNewFunction,

  nonStrictMode(obj, fn, arg = []) {
    obj[fn](...arg);
  },

  getSandbox(obj, options = {}) {
    const global = Cu.getGlobalForObject(obj);

    if (!isInWindowContext(global)) {
      return createModuleSandbox(obj, options);
    }

    // Currently we don't have non shared window sandbox

    const {scope = {}} = options;

    // Check if we already have a sandbox for this window
    let sandbox = this._sandbox;
    if (sandbox) {
      return updateSandboxWithScope(sandbox, scope);
    }

    const id = _sandboxId++;

    sandbox = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal(), {
      sandboxName: `Tabmix sandbox for window ${id}`,
      sandboxPrototype: global,
      sameZoneAs: global,
      wantXrays: true,
    });

    sandbox._id = id;
    sandbox._type = "window";

    return updateSandboxWithScope(sandbox, scope);
  },

  makeCode(code, obj, fullName, sandbox) {
    // Verify and replace private methods before passing to _makeCode
    const {code: updatedCode} = verifyPrivateMethodReplaced(code, obj, fullName);
    return _makeCode(updatedCode, sandbox ?? this._sandbox);
  },
};

/** @type {ChangecodeModule.getSandbox} */
export function getSandbox(window, options = {}) {
  if (window?._tabmix_sandbox || window?.Tabmix?._sandbox) {
    return window._tabmix_sandbox ?? window.Tabmix._sandbox;
  }

  // @ts-expect-error - its ok
  const sandbox = expandTabmix.getSandbox(window, options);
  window._tabmix_sandbox = sandbox;
  // @ts-expect-error - reset the value
  expandTabmix._sandbox = null;
  return sandbox;
}

/** @type {ChangecodeModule.initializeChangeCodeClass} */
export function initializeChangeCodeClass(tabmixObj, {obj, window, scope = {}}) {
  if (!obj && !window) {
    throw new Error("Error: obj and window are not defined");
  }

  // bound function to tabmixObj before creating the sandbox to make sure that
  // if we are in window context the sandbox will be saved to tabmixObj.
  Object.assign(tabmixObj, expandTabmix);
  if (window?._tabmix_sandbox) {
    tabmixObj._sandbox = window._tabmix_sandbox;
    window._tabmix_sandbox = null;
  }
  const baseSandbox = tabmixObj.getSandbox(window ?? obj, {scope});
  tabmixObj._sandbox = baseSandbox;

  return baseSandbox;
}
