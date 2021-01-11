/* eslint strict: 0 */

// don't use strict for this file
// so we don't evaluate all code as strict mode code

// aOptions can be: getter, setter or forceUpdate
Tabmix.changeCode = function(aParent, afnName, aOptions) {
  let console = TabmixSvc.console;
  let debugMode = this._debugMode;

  function ChangeCode(aParams) {
    this.obj = aParams.obj;
    this.fnName = aParams.fnName;
    this.fullName = aParams.fullName;

    let options = aParams.options;
    this.needUpdate = options && options.forceUpdate || false;
    this.silent = options && options.silent || false;

    if (options && (options.setter || options.getter)) {
      this.type = options.setter ? "__lookupSetter__" : "__lookupGetter__";
      this.value = this.obj[this.type](this.fnName).toString();
    } else if (typeof this.obj[this.fnName] == "function") {
      this.value = this.obj[this.fnName].toString();
    } else {
      this.errMsg = "\n" + this.fullName + " is undefined.";
    }
    this.notFound = [];
  }

  ChangeCode.prototype = {
    value: "",
    errMsg: "",
    _replace: function TMP_utils__replace(substr, newString, aParams) {
      // Don't insert new code before "use strict";
      if (substr == "{") {
        let re = /['|"]use strict['|"];/;
        let result = re.exec(this.value);
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

      var exist = typeof (substr) == "string" ? this.value.indexOf(substr) > -1 : substr.test(this.value);
      if (exist) {
        this.value = this.value.replace(substr, newString);
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
        if (debugMode && dontDebug.indexOf(this.fullName) == -1) {
          let excludeReturn = ["TabsInTitlebar._update", "gBrowser._blurTab"];
          let addReturn = "", re = new RegExp("//.*", "g");
          if (excludeReturn.indexOf(this.fullName) == -1 &&
              /return\s.+/.test(this.value.replace(re, "")))
            addReturn = "\nreturn null\n";
          this.value = this.value.replace("{", "{try {") +
            ' catch (ex) {' +
            '   TabmixSvc.console.assert(ex, "outer try-catch in ' + (aName || this.fullName) + '");}' +
            addReturn +
            ' }';
        }
        let [obj, fnName] = [aObj || this.obj, aName || this.fnName];
        if (this.isValidToChange(this.fullName)) {
          if (obj)
            Tabmix.setNewFunction(obj, fnName, Tabmix._makeCode(null, this.value));
          else
            Tabmix._makeCode(fnName, this.value);
        }
        if (aShow)
          this.show(obj, fnName);
      } catch (ex) {
        console.reportError(ex, console.callerName() + " failed to change " +
                            this.fullName + "\nError: ");
      }
    },

    defineProperty(aObj, aName, aCode) {
      if (!this.type)
        throw new Error("Tabmix:\n" + this.fullName + " don't have setter or getter");

      if (!this.isValidToChange(this.fullName)) {
        return;
      }

      let [obj, fnName] = [aObj || this.obj, aName || this.fnName];
      let descriptor = {enumerable: true, configurable: true};

      let removeSpaces = function(match, p1 = "", p2 = "", p3 = "") {
        return p1 + (p2 + p3).replace(/\s/g, '_');
      };

      let setDescriptor = type => {
        let fnType = "__lookup#ter__".replace("#", type);
        type = type.toLowerCase();
        let code = aCode && aCode[type + "ter"] ||
                   this.type == fnType ? this.value : obj[fnType](fnName);

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

    show(aObj, aName) {
      if (aObj && aName in aObj)
        console.show({obj: aObj, name: aName, fullName: this.fullName});
      else if (typeof this.fullName == "string") {
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
        ex.message = ex.fnName + " was unable to change " + aName + "." +
            (this.errMsg || "\ncan't find string" + str + this.notFound.join("\n    ")) +
            "\n\nTry Tabmix latest development version from tabmixplus.org/tab_mix_plus-dev-build.xpi," +
            "\nReport about this to Tabmix developer at http://tabmixplus.org/forum/";
        console.reportError(ex);
        if (debugMode) {
          console.clog(ex.fnName + "\nfunction " + aName + " = " + this.value, ex);
        }
      } else if (!this.needUpdate && debugMode) {
        console.clog(ex.fnName + " no update needed to " + aName, ex);
      }
      return false;
    },

    getCallerData(stack) {
      let caller = (stack.caller || {}).caller || {};
      let {filename, lineNumber, columnNumber, name} = caller;
      return {filename, lineNumber, columnNumber, fnName: name};
    }
  };

  try {
    return new ChangeCode({
      obj: aParent,
      fnName: afnName.split(".").pop(),
      fullName: afnName,
      options: aOptions
    });
  } catch (ex) {
    console.clog(console.callerName() + " failed to change " + afnName + "\nError: " + ex.message);
    if (debugMode)
      console.obj(aParent, "aParent");
  }
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
  let global = Components.utils.getGlobalForObject(obj);
  // eslint-disable-next-line no-useless-concat
  let fn = global["ev" + "al"];
  Tabmix._makeCode = function(name, code) {
    if (name) {
      return fn(name + " = " + code);
    }
    if (!code.startsWith("function")) {
      return fn("(function " + code + ")");
    }
    return fn("(" + code + ")");
  };
}(this));
