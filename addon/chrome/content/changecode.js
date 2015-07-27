/* jshint strict: false */

// don't use strict for this file
// so we don't evaluat all code as strict mode code

// aOptions can be: getter, setter or forceUpdate
Tabmix.changeCode = function(aParent, aName, aOptions) {
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
    }
    else if (typeof this.obj[this.fnName] == "function")
      this.value = this.obj[this.fnName].toString();
    else
      this.errMsg = "\n" + this.fullName + " is undefined.";
    this.notFound = [];
  }

  ChangeCode.prototype = {
    value: "", errMsg: "",
    _replace: function TMP_utils__replace(substr ,newString, aParams) {
      var silent;
      if (typeof aParams != "undefined") {
        let doReplace, flags;
        if (typeof aParams == "object") {
          doReplace = "check" in aParams ? aParams.check : true;
          flags = aParams.flags;
          silent = aParams.silent;
        }
        else if (typeof aParams == "boolean") {
          doReplace = aParams;
        }
        if (!doReplace)
          return this;
        if (flags && typeof substr == "string")
          substr = new RegExp(substr.replace(/[{[(\\^.$|?*+\/)\]}]/g, "\\$&"), flags);
      }

      var exist = typeof(substr) == "string" ? this.value.indexOf(substr) > -1 : substr.test(this.value);
      if (exist) {
        this.value = this.value.replace(substr, newString);
        this.needUpdate = true;
      }
      else if (!silent)
        this.notFound.push(substr);
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
        if (this.isValidToChange(fnName)) {
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

    defineProperty: function(aObj, aName, aCode) {
      if (!this.type)
        throw "Tabmix:\n" +  this.fullName + " don't have setter or getter";

      let [obj, fnName] = [aObj || this.obj, aName || this.fnName];
      let descriptor = {enumerable: true, configurable: true};

      let setDescriptor = function(type) {
        let fnType = "__lookup#ter__".replace("#", type);
        type = type.toLowerCase();
        let code = aCode && aCode[type + "ter"] ||
                   this.type == fnType ? this.value : obj[fnType](fnName);

        if (typeof code == "string")
          descriptor[type] = Tabmix._makeCode(null, code);
        else if (typeof code != "undefined")
          descriptor[type] = code;
      }.bind(this);

      setDescriptor("Get");
      setDescriptor("Set");

      Object.defineProperty(obj, fnName, descriptor);
    },

    show: function(aObj, aName) {
      if (aObj && aName in aObj)
        console.show({obj: aObj, name: aName, fullName: this.fullName});
      else if (typeof this.fullName == "string") {
        let win = typeof window != "undefined" ? window : undefined;
        console.show(this.fullName, 500, win);
      }
    },

    isValidToChange: function(aName) {
      var notFoundCount = this.notFound.length;
      if (this.needUpdate && !notFoundCount)
        return true;
      var caller = console.getCallerNameByIndex(2);
      if (notFoundCount && !this.silent) {
        let str = (notFoundCount > 1 ? "s" : "") + "\n    ";
        console.clog(caller + " was unable to change " + aName + "." +
          (this.errMsg || "\ncan't find string" + str + this.notFound.join("\n    ")) +
          "\n\nTry Tabmix latest development version from tmp.garyr.net/tab_mix_plus-dev-build.xpi," +
          "\nReport about this to Tabmix developer at http://tmp.garyr.net/forum/");
        if (debugMode)
          console.clog(caller + "\nfunction " + aName + " = " + this.value);
      }
      else if (!this.needUpdate && debugMode)
        console.clog(caller + " no update needed to " + aName);
      return false;
    }
  };

  let fnName = aName.split(".").pop();
  try {
    return new ChangeCode({obj: aParent, fnName: fnName,
      fullName: aName, options: aOptions});
  } catch (ex) {
    console.clog(console.callerName() + " failed to change " + aName + "\nError: " + ex.message);
    if (debugMode)
      console.obj(aParent, "aParent");
  }
  return null;
};

Tabmix.setNewFunction = function(aObj, aName, aCode) {
  if (!Object.getOwnPropertyDescriptor(aObj, aName)) {
    Object.defineProperty(aObj, aName, {value: aCode,
                                        writable: true, configurable: true});
  }
  else
    aObj[aName] = aCode;
};

Tabmix.nonStrictMode = function(aObj, aFn, aArg) {
  aObj[aFn].apply(aObj, aArg || []);
};

(function(obj) {
  /* jshint moz: true, esnext: false */
  let global = Components.utils.getGlobalForObject(obj);
  let fn = global["ev" + "al"];
  Tabmix._makeCode = function(name, code) name ?
    fn(name + " = " + code) : fn("(" + code + ")");
})(this);
