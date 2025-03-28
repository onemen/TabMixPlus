/* eslint strict: 0 */

// don't use strict for this file
// so we don't evaluate all code as strict mode code

// aOptions can be: getter, setter or forceUpdate
/** @type {TabmixGlobal["changeCode"]} */
Tabmix.changeCode = function(aParent, afnName, aOptions) {
  let console = TabmixSvc.console;
  let debugMode = this._debugMode;
  let errMsgContent =
    "\n\nTry Tabmix latest development version from https://bitbucket.org/onemen/tabmixplus-for-firefox/downloads/," +
    "\nReport about this to Tabmix developer at https://github.com/onemen/TabMixPlus/issues";
  let customTitlebar = TabmixSvc.version(1350) ? "CustomTitlebar._update" : "TabsInTitlebar._update";

  /**
   * @constructor
   * @this {ChangeCodeNS.ChangeCodeClass}
   * @param {ChangeCodeNS.ChangeCodeParams} aParams
   */
  function ChangeCode(aParams) {
    this.obj = aParams.obj;
    this.fnName = aParams.fnName;
    this.fullName = aParams.fullName;

    let options = aParams.options;
    this.needUpdate = options && options.forceUpdate || false;
    this.silent = options && options.silent || false;

    if (options && (options.setter || options.getter)) {
      this.type = options.setter ? "__lookupSetter__" : "__lookupGetter__";
      this._value = this.obj[this.type](this.fnName).toString();
    } else if (typeof this.obj[this.fnName] == "function") {
      this._value = this.obj[this.fnName].toString();
    } else {
      this.errMsg = "\n" + this.fullName + " is undefined.";
    }

    this.verifyPrivateMethodReplaced();

    this.notFound.length = 0;
  }

  /** @type {Partial<ChangeCodeNS.ChangeCodeClass>} */
  ChangeCode.prototype = {
    notFound: [],
    type: "",
    _value: "",
    errMsg: "",

    /** @this {ChangeCodeNS.ChangeCodeClass} */
    get value() {
      this.isValidToChange(this.fullName);
      return this._value;
    },

    _replace: function TMP_utils__replace(substr, newString, aParams) {
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
        if (!doReplace)
          return this;
        if (flags && typeof substr == "string")
          substr = new RegExp(substr.replace(/[{[(\\^.$|?*+/)\]}]/g, "\\$&"), flags);
      }

      var exist = typeof substr == "string" ? this._value.indexOf(substr) > -1 : substr.test(this._value);
      if (exist) {
        this._value = this._value.replace(substr, newString);
        this.needUpdate = true;
      } else if (!silent) {
        this.notFound.push(substr);
      }
      return this;
    },

    toCode: function TMP_utils_toCode(aShow, aObj, aName) {
      try {
        // list of function that we don't warp with try-catch
        let dontDebug = ["gBrowser.tabContainer._animateTabMove, gURLBar.handleCommand"];
        if (debugMode && !dontDebug.includes(this.fullName)) {
          let excludeReturn = [customTitlebar, "gBrowser._blurTab"];
          let addReturn = "", re = new RegExp("//.*", "g");
          if (!excludeReturn.includes(this.fullName) &&
              /return\s.+/.test(this._value.replace(re, "")))
            addReturn = "\nreturn null\n";
          this._value = this._value.replace(/\([^)]*\)\s*{/, "$&\ntry {") +
            ' catch (ex) {' +
            '   TabmixSvc.console.assert(ex, "outer try-catch in ' + (aName || this.fullName) + '");}' +
            addReturn +
            ' }';
        }
        let [obj, fnName] = [aObj || this.obj, aName || this.fnName];
        if (this.isValidToChange(this.fullName)) {
          if (obj)
            Tabmix.setNewFunction(obj, fnName, Tabmix._makeCode(null, this._value));
          else
            Tabmix._makeCode(fnName, this._value);
        }
        if (aShow)
          this.show(obj, fnName);
      } catch (ex) {
        console.reportError(ex, console.callerName() + " failed to change " +
                            this.fullName + "\nError: ");

        console.log(this._value);
      }
    },

    defineProperty(aObj, aName, aCode) {
      if (!this.type)
        throw new Error("Tabmix:\n" + this.fullName + " don't have setter or getter");

      if (!this.isValidToChange(this.fullName)) {
        return;
      }

      let [obj, fnName] = [aObj || this.obj, aName || this.fnName];
      /** @type {Partial<ChangeCodeNS.Descriptor>} */
      let descriptor = {enumerable: true, configurable: true};

      let removeSpaces = function(_match = "", p1 = "", p2 = "", p3 = "") {
        return p1 + (p2 + p3).replace(/\s/g, '_');
      };

      /** @param {string} type */
      let setDescriptor = type => {
        let fnType = "__lookup#ter__".replace("#", type);
        type = type.toLowerCase();
        /** @type {string} */ // @ts-expect-error
        let code = aCode && aCode[type + "ter"] ||
                   this.type == fnType ? this._value : obj[fnType](fnName);

        if (typeof code == "string") {
          // bug 1255925 - Give a name to getters/setters add space before the function name
          // replace function get Foo() to function get_Foo()
          code = code.replace(/^(function\s)?(get|set)(.*\()/, removeSpaces);
          descriptor[type] = Tabmix._makeCode(null, code);
        } else if (typeof code != "undefined") {
          descriptor[type] = code;
        }
      };

      setDescriptor("Get");
      setDescriptor("Set");

      Object.defineProperty(obj, fnName, descriptor);
    },

    show(aObj, aName = "") {
      if (aObj?.hasOwnProperty(aName)) {
        console.show({obj: aObj, name: aName, fullName: this.fullName});
      } else if (typeof this.fullName == "string") {
        let win = typeof window != "undefined" ? window : undefined;
        console.show(this.fullName, 500, win);
      }
    },

    isValidToChange(aName) {
      var notFoundCount = this.notFound.length;
      if (this.needUpdate && !notFoundCount)
        return true;

      const ex = this.getCallerData(Components.stack);
      if (notFoundCount && !this.silent) {
        let str = (notFoundCount > 1 ? "s" : "") + "\n    ";
        ex.message = ex.name + " was unable to change " + aName + "." +
            (this.errMsg || "\ncan't find string" + str + this.notFound.join("\n    ")) + errMsgContent;
        console.reportError(ex);
        if (debugMode) {
          console.clog(ex.name + "\nfunction " + aName + " = " + this._value, ex);
        }
      } else if (!this.needUpdate && debugMode) {
        console.clog(ex.name + " no update needed to " + aName, ex);
      }
      return false;
    },

    getCallerData(stack) {
      let caller = (stack.caller || {}).caller || {};
      const error = console.error(caller);
      Object.assign(error, {name: caller.name, message: ""});
      return error;
    },

    verifyPrivateMethodReplaced() {
      const matches = this._value.match(/this\.#(\w+)/g);
      if (!matches) {
        return;
      }
      const privateMethods = new Set(matches.map(match => match.replace("this.#", "")));
      const parentName = afnName.split(".").slice(0, -1).join(".");
      const ex = this.getCallerData(Components.stack.caller);
      for (const methods of privateMethods) {
        if (typeof aParent[`_${methods}`] === "undefined") {
          ex.message = `Implement replacement for private method #${methods} in ${parentName} it is used by ${this.fullName}${errMsgContent}`;
          console.reportError(ex);
        }
      }
      this._value = this._value.replace(/this\.#(\w+)/g, "this._$1");
    },
  };

  try {
    return new ChangeCode({
      obj: aParent,
      fnName: afnName.split(".").pop() ?? "",
      fullName: afnName,
      options: aOptions ?? {},
    });
  } catch (/** @type {any} */ ex) {
    console.clog(console.callerName() + " failed to change " + afnName + "\nError: " + ex.message);
    if (debugMode)
      console.obj(aParent, "aParent");
  }
  // @ts-expect-error - when ChangeCode throw an error Tabmix.changeCode is null
  return null;
};

Tabmix.setNewFunction = function(aObj, aName, aCode) {
  if (!Object.getOwnPropertyDescriptor(aObj, aName)) {
    Object.defineProperty(aObj, aName, {
      value: aCode,
      writable: true,
      configurable: true
    });
  } else {
    aObj[aName] = aCode;
  }
};

Tabmix.nonStrictMode = function(aObj, aFn, aArg) {
  aObj[aFn].apply(aObj, aArg || []);
};

(function(obj) {
  let global = Cu.getGlobalForObject(obj);
  let fn = global.eval;
  Tabmix._makeCode = function(name, code) {
    if (name) {
      return fn(name + " = " + code);
    }
    if (code.startsWith("async") && !code.startsWith("async function")) {
      return fn("(async function " + code.replace(/^async/, "") + ")");
    }
    if (!code.startsWith("function")) {
      return fn("(function " + code + ")");
    }
    return fn("(" + code + ")");
  };

  // make code with lazy run in local scope, to make sure local variables
  // will be available in the code
  Tabmix._localMakeCode = `(${Tabmix._makeCode.toString().replace(/fn/g, 'eval')})`;
}(this));
