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

var Tabmix = {
  // aOptions can be: getter, setter or forceUpdate
  changeCode: function(aParent, aName, aOptions) {
    let fnName = aName.split(".").pop();
    try {
      return new Tabmix_ChangeCode({obj: aParent, fnName: fnName,
        fullName: aName, options: aOptions});
    } catch (ex) {
      this.clog(Tabmix.callerName() + " failed to change " + aName + "\nError: " + ex.message);
      if (Tabmix._debugMode)
        this.obj(aObject, "aObject");
    }
    return null;
  },

  get prefs() {
    delete this.prefs;
    return this.prefs = Services.prefs.getBranch("extensions.tabmix.");
  },

  get defaultPrefs() {
    delete this.defaultPrefs;
    return this.defaultPrefs = Services.prefs.getDefaultBranch("extensions.tabmix.");
  },

  isVersion: function(aVersionNo) {
    return TabmixSvc.version(aVersionNo);
  },

  getObject: function (aMethod, rootID) {
try {
    var methodsList = aMethod.split(".");
    if (methodsList[0] == "window")
      methodsList.shift();
    else if (methodsList[0] == "document") {
      methodsList.shift();
      rootID = methodsList.shift().replace(/getElementById\(|\)|'|"/g , "");
    }
    var obj = rootID ? document.getElementById(rootID) : (window || this.getTopWin());
    methodsList.forEach(function(aFn) {
      obj = obj[aFn];
    });
    return obj;
} catch (ex) {
this.log(aMethod)
}
   return null;
  },

  show: function(aMethod, rootID, aDelay) {
    try {
      if (typeof(aDelay) == "undefined")
        aDelay = 500;

      let logMethod = function _logMethod() {
        let isObj = typeof aMethod == "object";
        let result = isObj ? aMethod.obj[aMethod.name] :
                this.getObject(aMethod, rootID).toString();
        this.clog((isObj ? aMethod.fullName : aMethod) + " = " + result);
      }.bind(this);

      if (aDelay >= 0)
        setTimeout(function () {logMethod();}, aDelay);
      else
        logMethod();

    } catch (ex) {this.assert(ex, "Error we can't show " + aMethod + " in Tabmix.show");}
  },

  // for debug
  debug: function TMP_utils_debug(aMessage, aShowCaller) {
    if (this._debug)
      this.log(aMessage, aShowCaller);
  },

  clog: function TMP_utils_clog(aMessage) {
    Services.console.logStringMessage("TabMix :\n" + aMessage);
  },

  log: function TMP_utils_log(aMessage, aShowCaller, offset) {
    offset = !offset ? 0 : 1;
    let names = this._getNames(aShowCaller ? 2 + offset : 1 + offset);
    let callerName = names[offset+0];
    let callerCallerName = aShowCaller ? " (caller was " + names[offset+1] + ")" : "";
    Services.console.logStringMessage("TabMix " + callerName + callerCallerName + " :\n" + aMessage);
  },

  // get functions names from Error().stack
  _getNames: function(aCount, stack) {
    if (!stack)
      stack = Error().stack.split("\n").slice(1);
    else
      stack = stack.split("\n");
    // cut the secound if it is from our utils
    if (stack[0].indexOf("TMP_utils_") == 0)
      stack.splice(0, 1);
    if (!aCount)
      aCount = 1;
    else if (aCount < 0)
      aCount = stack.length;
    let names = [];
    for (let i = 0; i < aCount; i++)
      names.push(this._name(stack[i]));

    return names;
  },

  // get the name of the function that is in the nth place in Error().stack
  // don't include this function in the count
  _getCallerNameByIndex: function TMP_utils_getCallerNameByIndex(aPlace) {
    let stack = Error().stack.split("\n");
    let fn = stack[aPlace + 1];

    if (fn)
      return this._name(fn);
    return null;
  },

  // Bug 744842 - don't include actual args in error.stack.toString()
  // since Bug 744842 landed the stack string don't have (arg1, arg2....)
  // so we can get the name from the start of the string until @
  get _char() {
    delete this._char;
    return this._char = this.isVersion(140) ? "@" : "(";
  },

  _name: function(fn) {
    let name = fn.substr(0, fn.indexOf(this._char))
    if (!name) {
      // get file name and line number
      let lastIndexOf = fn.lastIndexOf("/");
      name = lastIndexOf > -1 ? fn.substr(lastIndexOf+1) : "?";
    }
    return name;
  },

/*
  _nameFromComponentsStack: function (Cs) {
    return Cs.name ||
           Cs.filename.substr(Cs.filename.lastIndexOf("/") + 1) + ":" + Cs.lineNumber;
  },

  callerName: function () {
///    return this._getCallerNameByIndex(2);
    try {
      var name = this._nameFromComponentsStack(Components.stack.caller.caller);
    } catch (ex) { }
    return name || "";
  },
*/
  callerName: function () {
    return this._getCallerNameByIndex(2);
  },

  // return true if the caller name of the calling function is in the
  // arguments list
  isCallerInList: function () {
    if (!arguments.length) {
      this.assert("no arguments in Tabmix.isCallerInList");
      return false;
    }

    try {
      let callerName = this._getCallerNameByIndex(2);
      if (!callerName)
        return false;
      if (typeof arguments[0] == "object")
        return arguments[0].indexOf(callerName) > -1;

      let args = Array.prototype.slice.call(arguments);
      return args.indexOf(callerName) > -1;

    } catch (ex) {
      this.assert(ex, "Error we can't check for caller name");
    }
    return false;
  },

///XXX add new arg as options as object
/*
options = {
  msg: msg
  log: true / false; defaul true
  function: true / false defaul false
  deep: true / false defaul false
  offset; for intenal use only true / false defaul false
}
*/
  obj: function(aObj, aMessage, aDisallowLog, level) {
    var offset = typeof level == "string" ? "  " : "";
    aMessage = aMessage ? offset + aMessage + "\n" : "";
    var objS = aObj ? offset + aObj.toString() : offset + "aObj is " + typeof(aObj);
    objS +=  ":\n"

    for (let prop in aObj) {
      try {
        let val = aObj[prop];
        let type = typeof val;
        if (type == "string")
          val = "\'" + val + "\'";
        if (type == "function" && typeof level == "string") {
          val = val.toString();
          let code = val.toString().indexOf("native code") > -1 ?
            "[native code]" : "[code]"
          val = val.substr(0, val.indexOf("(")) + "() { " + code + " }";
        }
        objS += offset + prop + "[" + type + "]" + " =  " + val + "\n";
        if (type == "object" && val != null && level && typeof level == "boolean")
          objS += this.obj(val, "", true, "deep") + "\n";
      } catch (ex) {
        objS += offset + prop + " =  " + "[!!error retrieving property]" + "\n";
      }
    }
    if (aDisallowLog)
      objS = aMessage + "======================\n" + objS;
    else
      this.log(aMessage + "=============== Object Properties ===============\n" + objS, true, 1);
    return objS;
  },

  assert: function TMP_utils_assert(aError, aMsg) {
    if (typeof aError.stack != "string") {
      this.trace((aMsg || "") + "\n" + aError, 2);
      return;
    }

    let names = this._getNames(1, aError.stack);
    let errAt = " at " + names[0];
    let location = aError.location ? "\n" + aError.location : "";
    let assertionText = "Tabmix Plus ERROR" + errAt + ":\n" + (aMsg ? aMsg + "\n" : "") + aError.message + location;
    let stackText = "\nStack Trace: \n" + decodeURI(aError.stack);
    Services.console.logStringMessage(assertionText + stackText);
  },

  trace: function(aMsg, slice) {
    // cut off the first line of the stack trace, because that's just this function.
    let stack = Error().stack.split("\n").slice(slice || 1);

    Services.console.logStringMessage("Tabmix Trace: " + (aMsg || "") + '\n' + stack.join("\n"));
  },

  // Show/hide one item (specified via name or the item element itself).
  showItem: function(aItemOrId, aShow) {
    var item = typeof(aItemOrId) == "string" ? document.getElementById(aItemOrId) : aItemOrId;
    if (item && item.hidden == aShow)
      item.hidden = !aShow;
  },

  setItem: function(aItemOrId, aAttr, aVal) {
    var elem = typeof(aItemOrId) == "string" ? document.getElementById(aItemOrId) : aItemOrId;
    if (elem) {
      if (aVal == null) {
        elem.removeAttribute(aAttr);
        return;
      }
      if (typeof(aVal) == "boolean")
        aVal = aVal ? "true" : "false";

      if (elem.getAttribute(aAttr) != aVal)
        elem.setAttribute(aAttr, aVal);
    }
  },

  defineProperty: function(aObj, aName, aCode) {
    for (let [type, val] in Iterator(aCode)) {
      if (typeof val == "string")
        aCode[type] = eval("(" + val + ")");
    }
    Object.defineProperty(aObj, aName, {get: aCode.getter, set: aCode.setter,
                          enumerable: true, configurable: true});
  },

  toCode: function(aObj, aName, aCodeString) {
    if (aObj)
      this.setNewFunction(aObj, aName, eval("(" + aCodeString + ")"));
    else
      eval(aName + " = " + aCodeString);
  },

  setNewFunction: function(aObj, aName, aCode) {
    if (!Object.getOwnPropertyDescriptor(aObj, aName)) {
      Object.defineProperty(aObj, aName, {value: aCode,
                                          writable: true, configurable: true});
    }
    else
      aObj[aName] = aCode;
  },

  getTopWin: function() {
    return Services.wm.getMostRecentWindow("navigator:browser");
  },

  getSingleWindowMode: function TMP_getSingleWindowMode() {
    // if we don't have any browser window opened return false
    // so we can open new window
    if (!this.getTopWin())
      return false;
    return Tabmix.prefs.getBoolPref("singleWindow");
  },

  isNewWindowAllow: function(isPrivate) {
    // allow to open new window if not in single window mode or
    // allow to open new private window if there is no private window
    return !this.getSingleWindowMode() ||
           this.isVersion(200) && isPrivate && !this.RecentWindow.getMostRecentBrowserWindow({ private: true });
  },

  lazy_import: function(aObject, aName, aModule, aSymbol, aFlag, aArg) {
    if (aFlag)
      this[aModule + "Initialized"] = false;
    var self = this;
    XPCOMUtils.defineLazyGetter(aObject, aName, function() {
      let tmp = { };
      Components.utils.import("resource://tabmixplus/"+aModule+".jsm", tmp);
      let obj = "prototype" in tmp[aSymbol] ? new tmp[aSymbol] : tmp[aSymbol];
      if ("init" in obj)
        obj.init.apply(obj, aArg);
      if (aFlag)
        self[aModule + "Initialized"] = true;
      return obj;
    });
  },

  backwardCompatibilityGetter: function(aObject, aOldName, aNewName) {
    if (aOldName in aObject)
      return;

    var self = this;
    XPCOMUtils.defineLazyGetter(aObject, aOldName, function() {
      self.informAboutChangeInTabmix(aOldName, aNewName);
      return self.getObject(aNewName);
    });
  },

  informAboutChangeInTabmix: function(aOldName, aNewName) {
    let err = Error(aOldName + " is deprecated in Tabmix since version 0.3.8.5pre.110123a use " + aNewName + " instead.");
    // cut off the first lines, we looking for the function that trigger the getter.
    let stack = Error().stack.split("\n").slice(3);
    let file = stack[0] ? stack[0].split(":") : null;
    if (file) {
      let [chrome, path, line] = file;
      let index = path.indexOf("/", 2) - 3;
      let extensionName = index > -1 ?
         path.charAt(2).toUpperCase() + path.substr(3, index) + " " : "";
      this.clog(err.message + "\n\n" + extensionName + "extension call " + aOldName +
                 " from:\n" + "file: " + "chrome:" + path + "\nline: " + line
                 + "\n\nPlease inform Tabmix Plus developer"
                 + (extensionName ? ( " and " + extensionName + "developer.") : "."));
    }
    else
      this.clog(err.message + "\n\n" + stack);
  },

  promptService: function(intParam, strParam, aWindow, aCallBack) {
    var dpb = Cc["@mozilla.org/embedcomp/dialogparam;1"]
                            .createInstance(Ci.nsIDialogParamBlock);
    // intParam[0] - default button accept=0, cancel=1, extra1=2
    // intParam[1] - show menuList= 1 , show textBox= 0, hide_both= 2
    // intParam[2] - set checkbox checked  true=1 , false=0, hide=2
    // intParam[3] - flag  - for menuList contents: flag to set menu selected item
    //                     - for textBox rename: 1 , save: 0
///XXX temp fix
    // intParam[4] - flag  - 1 - use Tabmix.Sessions.createMenuForDialog

    // we use non modal dialog when we call for prompt on startup
    // when we don't have a callBack function use modal dialog
    let modal = typeof(aCallBack) != "function";
    var i;
    for (i = 0; i < intParam.length; i++)
      dpb.SetInt(i, intParam[i]);
    // strParam labels for: title, msg, testbox.value, checkbox.label, buttons[]
    // buttons[]: labels array for each button
    for (i = 0; i < strParam.length; i++)
      dpb.SetString(i, strParam[i]);

    if (typeof(aWindow) == "undefined") {
      try { aWindow = window;
      }
      catch (e) { aWindow = null;
      }
    }

    // we add dependent to features to make this dialog float over the window on start
    var dialog = Services.ww.openWindow(aWindow,
           "chrome://tabmixplus/content/session/promptservice.xul","","centerscreen" +(modal ? ",modal" : ",dependent") ,dpb);
    if (!modal)
      dialog._callBackFunction = aCallBack;

    return {button: dpb.GetInt(4), checked: (dpb.GetInt(5) == this.CHECKBOX_CHECKED),
            label: dpb.GetString(5), value: dpb.GetInt(6)};
  },

  windowEnumerator: function Tabmix_windowEnumerator(aWindowtype) {
    if (typeof(aWindowtype) == "undefined")
      aWindowtype = "navigator:browser";
    return Services.wm.getEnumerator(aWindowtype);
  },

  numberOfWindows: function Tabmix_numberOfWindows(all, aWindowtype) {
    var enumerator = this.windowEnumerator(aWindowtype);
    var count = 0;
    while (enumerator.hasMoreElements()) {
      let win = enumerator.getNext();
      if ("TabmixSessionManager" in win && win.TabmixSessionManager.windowClosed)
        continue;
      count++;
      if (!all && count == 2)
        break;
    }
    return count;
  },

  get isSingleBrowserWindow() {
    return this.numberOfWindows(false, "navigator:browser") == 1;
  },

  get isLastBrowserWindow() {
    return this.isSingleBrowserWindow;
  },

  isPlatform: function(aPlatform) {
    return navigator.platform.indexOf(aPlatform) == 0;
  },

  // some extensions override native JSON so we use nsIJSON
  JSON: {
    nsIJSON: null,
    parse: function TMP_parse(str) {
      try {
        return JSON.parse(str);
      } catch(ex) {
        try {
          return "decode" in this.nsIJSON ? this.nsIJSON.decode(str) : null;
        } catch(ex) {return null}
      }
    },
    stringify: function TMP_stringify(obj) {
      try {
        return JSON.stringify(obj);
      } catch(ex) {
        try {
          return "encode" in this.nsIJSON ? this.nsIJSON.encode(obj) : null;
        } catch(ex) {return null}
      }
    }
  },

  compare: function TMP_utils_compare(a, b, lessThan) {return lessThan ? a < b : a > b;},
  itemEnd: function TMP_utils_itemEnd(item, end) {return item.boxObject.screenX + (end ? item.getBoundingClientRect().width : 0);},

  _init: function() {
    Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
    Components.utils.import("resource://gre/modules/Services.jsm");
    this.lazy_import(window, "TabmixSvc", "Services", "TabmixSvc");
    XPCOMUtils.defineLazyGetter(this.JSON, "nsIJSON", function() {
      return Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
    });
    if (this.isVersion(200)) {
      XPCOMUtils.defineLazyModuleGetter(this, "RecentWindow",
                 "resource:///modules/RecentWindow.jsm");
    }
    window.addEventListener("unload", function tabmix_destroy() {
      window.removeEventListener("unload", tabmix_destroy, false);
      this.destroy();
    }.bind(this), false);
  },

  originalFunctions: {},
  destroy: function TMP_utils_destroy() {
    this.toCode = null;
    this.originalFunctions = null;
  }
}

Tabmix._init();
