/* eslint strict: 0 */

// don't use strict for this file
// so we don't evaluate all code as strict mode code

// aOptions can be: getter, setter or forceUpdate
/** @type {TabmixGlobal["changeCode"]} */
Tabmix.changeCode = function (aParent, afnName, aOptions) {
  const console = TabmixSvc.console;
  const debugMode = this._debugMode;
  const errMsgContent =
    "\n\nTry Tabmix latest development version from https://bitbucket.org/onemen/tabmixplus-for-firefox/downloads/," +
    "\nReport about this to Tabmix developer at https://github.com/onemen/TabMixPlus/issues";

  // Constants used in toCode method for debug mode
  // List of functions that we don't wrap with try-catch
  const dontDebug = ["gBrowser.tabContainer._animateTabMove, gURLBar.handleCommand"];
  const customTitlebarName =
    TabmixSvc.version(1350) ? "CustomTitlebar._update" : "TabsInTitlebar._update";
  // List of functions that don't need a "return null" fallback in debug mode
  const excludeReturn = [customTitlebarName, "gBrowser._blurTab"];

  /** @implements {ChangeCodeNS.ChangeCodeClass} */
  class ChangeCode {
    obj;
    fnName;
    fullName;
    needUpdate;
    silent;
    _value = "";
    errMsg = "";
    sandbox;

    /** @type {"__lookupSetter__" | "__lookupGetter__" | ""} */
    type = "";

    /** @type {string[]} */
    notFound = [];

    /** @param {ChangeCodeNS.ChangeCodeParams} aParams */
    constructor(aParams) {
      this.obj = aParams.obj;
      this.fnName = aParams.fnName;
      this.fullName = aParams.fullName;

      const {forceUpdate = false, silent = false, set, get, sandbox} = aParams.options ?? {};
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
      this.sandbox = sandbox;
      if (
        !this.sandbox &&
        Cu.getGlobalForObject(this.obj)?.location?.href !== "chrome://browser/content/browser.xhtml"
      ) {
        const {filename, lineNumber} = Components.stack.caller.caller;
        console.reportError(
          `scripts from module must use global sandbox\n${aParams.fullName} - ${filename}:${lineNumber}`
        );
        // reuse the global sandbox
        this.sandbox = Tabmix.getSandbox(Services);
      }

      this.verifyPrivateMethodReplaced();

      this.notFound.length = 0;
    }

    get value() {
      this.isValidToChange(this.fullName);
      return this._value;
    }

    /** @type {ChangeCodeNS.ChangeCodeClass["_replace"]} */
    _replace(substr, newString, aParams) {
      // Don't insert new code before "use strict";
      if (substr == "{") {
        let re = /['|"]use strict['|"];/;
        let result = re.exec(this._value);
        if (result) {
          if (!newString.startsWith("$&")) {
            newString = newString.replace(substr, result[0] + "\n");
          }
          substr = result[0];
        }
      }
      var silent;
      if (typeof aParams != "undefined") {
        let doReplace, flags;
        if (typeof aParams == "object") {
          doReplace = "check" in aParams ? aParams.check : true;
          flags = aParams.flags;
          silent = aParams.silent;
        } else if (typeof aParams == "boolean") {
          doReplace = aParams;
        }
        if (!doReplace) {
          return this;
        }
        if (flags && typeof substr == "string") {
          substr = new RegExp(substr.replace(/[{[(\\^.$|?*+/)\]}]/g, "\\$&"), flags);
        }
      }

      var exist =
        typeof substr == "string" ? this._value.indexOf(substr) > -1 : substr.test(this._value);
      if (exist) {
        this._value = this._value.replace(substr, newString);
        this.needUpdate = true;
      } else if (!silent) {
        this.notFound.push(substr);
      }
      return this;
    }

    /** @type {ChangeCodeNS.ChangeCodeClass["toCode"]} */
    toCode(aShow, aObj, aName) {
      try {
        if (debugMode && !dontDebug.includes(this.fullName)) {
          let addReturn = "",
            re = new RegExp("//.*", "g");
          if (
            !excludeReturn.includes(this.fullName) &&
            /return\s.+/.test(this._value.replace(re, ""))
          ) {
            addReturn = "\nreturn null\n";
          }
          this._value =
            this._value.replace(/\([^)]*\)\s*{/, "$&\ntry {") +
            " catch (ex) {" +
            '   TabmixSvc.console.assert(ex, "outer try-catch in ' +
            (aName || this.fullName) +
            '");}' +
            addReturn +
            " }";
        }
        let [obj, fnName] = [aObj || this.obj, aName || this.fnName];
        if (this.isValidToChange(this.fullName)) {
          if (obj) {
            Tabmix.setNewFunction(obj, fnName, Tabmix._makeCode(this._value, this.sandbox));
          } else {
            console.log("Error: unable to find object for " + this.fullName);
          }
        }
        if (aShow) {
          this.show(obj, fnName);
        }
      } catch (ex) {
        console.reportError(
          ex,
          console.callerName() + " failed to change " + this.fullName + "\nError: "
        );

        console.log(this._value);
      }
    }

    /** @type {ChangeCodeNS.ChangeCodeClass["defineProperty"]} */
    defineProperty(aObj, aName, aCode) {
      if (!this.type) {
        throw new Error("Tabmix:\n" + this.fullName + " don't have setter or getter");
      }

      if (!this.isValidToChange(this.fullName)) {
        return;
      }

      let [obj, fnName] = [aObj || this.obj, aName || this.fnName];

      /** @type {Partial<ChangeCodeNS.Descriptor>} */
      let descriptor = {enumerable: true, configurable: true};

      let removeSpaces = function (_match = "", p1 = "", p2 = "", p3 = "") {
        return p1 + (p2 + p3).replace(/\s/g, "_");
      };

      /** @param {"set" | "get"} type */
      let setDescriptor = type => {
        const fnType = type === "set" ? "__lookupSetter__" : "__lookupGetter__";

        /** @type {string | FunctionWithAny} */
        let code = aCode?.[type] || (this.type == fnType ? this._value : obj[fnType](fnName));

        if (typeof code == "string") {
          // bug 1255925 - Give a name to getters/setters add space before the function name
          // replace function get Foo() to function get_Foo()
          code = code.replace(/^(function\s)?(get|set)(.*\()/, removeSpaces);
          descriptor[type] = Tabmix._makeCode(code, this.sandbox);
        } else if (typeof code != "undefined") {
          descriptor[type] = code;
        }
      };

      setDescriptor("get");
      setDescriptor("set");

      Object.defineProperty(obj, fnName, descriptor);
    }

    /** @type {ChangeCodeNS.ChangeCodeClass["show"]} */
    show(aObj, aName = "") {
      if (aObj?.hasOwnProperty(aName)) {
        console.show({obj: aObj, name: aName, fullName: this.fullName});
      } else if (typeof this.fullName == "string") {
        let win = typeof window != "undefined" ? window : undefined;
        console.show(this.fullName, 500, win);
      }
    }

    /** @type {ChangeCodeNS.ChangeCodeClass["isValidToChange"]} */
    isValidToChange(aName) {
      var notFoundCount = this.notFound.length;
      if (this.needUpdate && !notFoundCount) {
        return true;
      }

      const ex = this.getCallerData(Components.stack);
      if (notFoundCount && !this.silent) {
        let str = (notFoundCount > 1 ? "s" : "") + "\n    ";
        ex.message =
          ex.name +
          " was unable to change " +
          aName +
          "." +
          (this.errMsg || "\ncan't find string" + str + this.notFound.join("\n    ")) +
          errMsgContent;
        console.reportError(ex);
        if (debugMode) {
          console.clog(ex.name + "\nfunction " + aName + " = " + this._value, ex);
        }
      } else if (!this.needUpdate && debugMode) {
        console.clog(ex.name + " no update needed to " + aName, ex);
      }
      return false;
    }

    /** @type {ChangeCodeNS.ChangeCodeClass["getCallerData"]} */
    getCallerData(stack) {
      // Using 'this' to satisfy the linter, even though it's not needed in this method
      this.notFound = this.notFound || [];
      let caller = (stack.caller || {}).caller || {};
      const error = console.error(caller);
      Object.assign(error, {name: caller.name, message: ""});
      return error;
    }

    verifyPrivateMethodReplaced() {
      const matches = this._value.match(/this\.#(\w+)/g);
      if (!matches) {
        return;
      }
      const privateMethods = new Set(matches.map(match => match.replace("this.#", "")));
      const parentName = this.fullName.split(".").slice(0, -1).join(".");
      const ex = this.getCallerData(Components.stack.caller);
      for (const methods of privateMethods) {
        if (typeof this.obj[`_${methods}`] === "undefined") {
          ex.message = `Implement replacement for private method #${methods} in ${parentName} it is used by ${this.fullName}${errMsgContent}`;
          console.reportError(ex);
        }
      }
      this._value = this._value.replace(/this\.#(\w+)/g, "this._$1");
    }
  }

  try {
    return new ChangeCode({
      obj: aParent,
      fnName: afnName.split(".").pop() ?? "",
      fullName: afnName,
      options: aOptions ?? {},
    });
  } catch (/** @type {any} */ ex) {
    console.clog(console.callerName() + " failed to change " + afnName + "\nError: " + ex.message);
    if (debugMode) {
      console.obj(aParent, "aParent");
    }
  }
  // @ts-expect-error - when ChangeCode throw an error Tabmix.changeCode is null
  return null;
};

Tabmix.setNewFunction = function (aObj, aName, aCode) {
  if (!Object.getOwnPropertyDescriptor(aObj, aName)) {
    Object.defineProperty(aObj, aName, {
      value: aCode,
      writable: true,
      configurable: true,
    });
  } else {
    aObj[aName] = aCode;
  }
};

Tabmix.nonStrictMode = function (aObj, aFn, aArg) {
  aObj[aFn].apply(aObj, aArg || []);
};

/** @this {TabmixGlobal} */ // @ts-expect-error typescript confused by this in the function
Tabmix.getSandbox = function getSandbox(obj, shared = true) {
  const global = Cu.getGlobalForObject(obj);
  const location = global?.location?.href;

  const inWindowContext =
    location === "chrome://browser/content/browser.xhtml" ||
    location === "chrome://tabmixplus/content/preferences/preferences.xhtml";

  if (!inWindowContext) {
    return TabmixSvc.createModuleSandbox(obj, shared);
  }

  // Currenly we don't have non shared window snadbox

  // Check if we already have a sandbox for this window
  let sandbox = this._sandbox;
  if (sandbox) {
    return sandbox;
  }

  const id = TabmixSvc._sandboxId++;

  sandbox = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal(), {
    sandboxName: `Tabmix sandbox for window ${id}`,
    sandboxPrototype: global,
    sameZoneAs: global,
    wantXrays: true,
  });

  sandbox._id = id;
  sandbox._type = "window";

  this._sandbox = sandbox;
  return sandbox;
};

Tabmix.expandSandbox = function ({obj, scope = {}, shared = true}) {
  const sandbox = this.getSandbox(obj, shared);
  // Add all scope properties to the shared sandbox
  for (const [key, value] of Object.entries(scope)) {
    // Special handling for 'lazy' object - merge instead of replace
    if (key === "lazy" && sandbox.lazy && typeof value === "object") {
      Object.assign(sandbox.lazy, value);
    } else {
      sandbox[key] = value;
    }
  }
  return sandbox;
};

(function (obj) {
  if (!obj.Tabmix._sandboxData) {
    console.error("Error: _sandboxData is not defined");
    obj.Tabmix._sandboxData = {obj, result: null};
  }
  const {_sandboxData} = obj.Tabmix;
  const baseSandbox = Tabmix.expandSandbox(_sandboxData);
  _sandboxData.result = baseSandbox;

  let id = 0;
  Tabmix._makeCode = function (code, sandbox = baseSandbox) {
    let codeString;
    if (code.startsWith("async") && !code.startsWith("async function")) {
      codeString = `(async function ${code.replace(/^async/, "")})`;
    } else if (!code.startsWith("function")) {
      codeString = `(function ${code})`;
    } else {
      codeString = `(${code})`;
    }

    // to enable clickable link in the browser console enable debug mode by
    // setting extensions.tabmix.enableDebug in about:config to true
    const functionNameMatch = codeString.match(/\((?:async\s+)?function\s+(\w+)/);
    const functionName = functionNameMatch ? functionNameMatch[1] : "anonymous_" + id++;
    const readableFilename =
      this._debugMode ?
        `data:application/javascript,Tabmix_code_${functionName};${encodeURIComponent(codeString)}`
      : `Tabmix_code_${functionName}.js`;

    return Cu.evalInSandbox(codeString, sandbox, null, readableFilename, 1);
  };
})(this);
