// don't use strict for this file
// so we don't evaluat all code as strict mode code

function Tabmix_ChangeCode(aParams) {
  this.obj = aParams.obj;
  this.fnName = aParams.fnName;
  this.fullName = aParams.fullName;

  let options = aParams.options;
  this.needUpdate = options && options.forceUpdate || false;

  if (options && (options.setter || options.getter)) {
    let type = options.setter ? "__lookupSetter__" : "__lookupGetter__";
    this.value = this.obj[type](this.fnName).toString();
  }
  else if (typeof this.obj[this.fnName] == "function")
    this.value = this.obj[this.fnName].toString();
  else
    this.errMsg = "\n" + this.fullName + " is undefined.";
  this.notFound = [];
}

Tabmix_ChangeCode.prototype = {
  value: "", errMsg: "",
  _replace: function TMP_utils__replace(substr ,newString, aParams) {
    var silent;
    if (typeof aParams != "undefined") {
      let doReplace, flags;
      if (typeof aParams == "object") {
        doReplace = aParams.check;
        flags = aParams.flags;
        silent = aParams.silent
      }
      else if (typeof aParams == "boolean") {
        doReplace = aParams;
      }
      if (doReplace == false)
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
      if (Tabmix._debugMode) {
        this.value = this.value.replace("{", "{try {") +
            ' catch (ex) {Tabmix.assert(ex, "outer try-catch in ' + (aName || this.fullName) + '");}}';
      }
      let [obj, fnName] = [aObj || this.obj, aName || this.fnName];
      if (this.isValidToChange(fnName))
        Tabmix.toCode(obj, fnName, this.value);
      if (aShow)
        this.show(obj, fnName);
    } catch (ex) {
      Components.utils.reportError("Tabmix " + Tabmix.callerName() + " failed to change " + this.fullName + "\nError: " + ex.message);
    }
  },

  show: function(aObj, aName) {
    if (aObj && aName in aObj)
      Tabmix.show({obj: aObj, name: aName, fullName: this.fullName});
    else if (this.fullName != null)
      Tabmix.show(this.fullName);
  },

  isValidToChange: function(aName) {
    var notFoundCount = this.notFound.length;
    if (this.needUpdate && !notFoundCount)
      return true;
    var caller = Tabmix._getCallerNameByIndex(2);
    if (notFoundCount) {
      let str = (notFoundCount > 1 ? "s" : "") + "\n    ";
      Tabmix.clog(caller + " was unable to change " + aName + "."
        + (this.errMsg || "\ncan't find string" + str + this.notFound.join("\n    "))
        + "\n\nTry Tabmix latest development version from tmp.garyr.net/tab_mix_plus-dev-build.xpi,"
        + "\nReport about this to Tabmix developer at http://tmp.garyr.net/forum/");
      if (Tabmix._debugMode)
        Tabmix.clog(caller + "\nfunction " + aName + " = " + this.value);
    }
    else if (!this.needUpdate && Tabmix._debugMode)
      Tabmix.clog(caller + " no update needed to " + aName);
    return false;
  }
}

Tabmix.defineProperty = function(aObj, aName, aCode) {
  for (let [type, val] in Iterator(aCode)) {
    if (typeof val == "string")
      aCode[type] = eval("(" + val + ")");
  }
  Object.defineProperty(aObj, aName, {get: aCode.getter, set: aCode.setter,
                        enumerable: true, configurable: true});
}

Tabmix.toCode = function(aObj, aName, aCodeString) {
  if (aObj)
    this.setNewFunction(aObj, aName, eval("(" + aCodeString + ")"));
  else
    eval(aName + " = " + aCodeString);
}

Tabmix.setNewFunction = function(aObj, aName, aCode) {
  if (!Object.getOwnPropertyDescriptor(aObj, aName)) {
    Object.defineProperty(aObj, aName, {value: aCode,
                                        writable: true, configurable: true});
  }
  else
    aObj[aName] = aCode;
}
