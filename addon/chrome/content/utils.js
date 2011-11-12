/**
 * We replace some global Services with smart getters
 * gIOService     >  TabmixSvc.io
 * gTabmixPrefs   >  TabmixSvc.prefs
 * tabxPrefs      >  TabmixSvc.TMPprefs
 * SessionPref    > TabmixSvc.SMprefs
 * gWindowManager > TabmixSvc.wm
 *
 **/

 /**
rename functions and global variable:

utils.js
========
TM_PromptService > Tabmix.promptService
gIsFirefox35 > Tabmix.isVersion(35)
gIsFirefox36 > Tabmix.isVersion(36)
gIsFirefox37 > Tabmix.isVersion(37)

*/

function Tabmix_ChangeCode(aObjectName, aCodeString, aForceUpdate) {
  this.name = aObjectName;
  this.value = aCodeString;
  this.needUpdate = aForceUpdate;
}

Tabmix_ChangeCode.prototype =  {
  needUpdate: false,
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
    else if (!silent){
      Tabmix.clog(Tabmix._getNames()[0] + " can't find string: " + substr
          + "\nin " + this.name + "."
          + "\n\nTry Tabmix latest development version from tmp.garyr.net/tab_mix_plus-dev-build.xpi,"
          + "\n\nReport about this to Tabmix developer at http://tmp.garyr.net/forum/"
      );
    }
    return this;
  },

  toSetter: function(aObj, aName) {
    Tabmix._define("setter", aObj, aName, this.value);
    delete this;
  },

  toGetter: function(aObj, aName) {
    Tabmix._define("getter", aObj, aName, this.value);
    delete this;
  },

  toCode: function TMP_utils_toCode(aShow, aObj, aName) {
     try {
       if (this.needUpdate)
         Tabmix.toCode(aObj, aName || this.name, this.value);
       if (aShow)
         this.show();
       delete this;
    } catch (ex) {
      Components.utils.reportError("Tabmix " + Tabmix._getNames()[0] + " failed to change " + this.name + "\nError: " + ex.message);
    }
  },

  show: function() {
    if (this.name != null)
      Tabmix.show(this.name);
  }

}

var Tabmix = {
  newCode: function(aObjectName, aObject, aForceUpdate) {
    return new Tabmix_ChangeCode(aObjectName, aObject.toString(), aForceUpdate);
  },

  isVersion: function(aVersionNo) {
    let ver = "is" + aVersionNo;
    if (ver in TabmixSvc.version)
      return TabmixSvc.version[ver];

    throw (Components.returnCode = "INVALID version number " + aVersionNo);
  },

  getObject: function (aMethod, rootID) {
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
  },

  show: function(aMethod, rootID, aDelay) {
    try {
      if (typeof(aDelay) == "undefined")
        aDelay = 500;

      var self = this;
      var logMethod = function () {
        let result = self.getObject(aMethod, rootID).toString();
        self.clog(aMethod + " = " + result);
      }

      if (aDelay >= 0)
        setTimeout(logMethod, aDelay);
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
    TabmixSvc.console.logStringMessage("TabMix :\n" + aMessage);
  },

  log: function TMP_utils_log(aMessage, aShowCaller, offset) {
    offset = !offset ? 0 : 1;
    let names = this._getNames(aShowCaller ? 2 + offset: 1 + offset);
    let callerName = names[offset+0];
    let callerCallerName = aShowCaller ? " (caller was " + names[offset+1] + ")" : "";
    TabmixSvc.console.logStringMessage("TabMix " + callerName + callerCallerName + " :\n" + aMessage);
  },

  // get functions names from Error().stack
  _getNames: function(aCount, stack) {
    if (!stack)
      stack = Error().stack.split("\n").slice(TabmixSvc.stackOffset);
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
    let fn = stack[TabmixSvc.stackOffset + aPlace];
    if (fn)
      return this._name(fn);
    return null;
  },

  _name: function(fn) {
    let name = fn.substr(0, fn.indexOf("("));
    if (!name) {
      // get file name and line number
      let lastIndexOf = fn.lastIndexOf("/");
      name = lastIndexOf > -1 ? fn.substr(lastIndexOf+1) : "?";
    }
    return name;
  },

  callerName: function () {
    return this._getCallerNameByIndex(2);
  }, 

  // return true if the caller name of the calling function is in the
  // arguments list
  isCallerInList: function () {
    // we need the caller to the caller function
    // this function is 0, the caller is 1, caller caller is 2
    let callerName = this._getCallerNameByIndex(2);
    if (arguments.length == 1 && typeof arguments[0] == "string")
      return arguments[0] == callerName;
    
    if (callerName) {
      let list = [];
      Array.forEach(arguments, function(arg) {
        list = list.concat(arg);
      });

      if (!list.length)
       return false;

      return list.some(function(name){
        if (name == callerName)
          return true;
        return false;
      });
    }
    return false;
  },

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
      this.clog(aMessage + "=============== Object Properties ===============\n" + objS);
    return objS;
  },

  assert: function TMP_utils_assert(aError, aMsg) {
    let names = this._getNames(1, aError.stack);
    let errAt = " at " + names[0];
    let location = aError.location ? "\n" + aError.location : "";
    let assertionText = "Tabmix Plus ERROR" + errAt + ":\n" + (aMsg ? aMsg + "\n" : "") + aError.message + location;
    let stackText = "stack" in aError ? "\nStack Trace: \n" + aError.stack : "";
    if (stackText)
      TabmixSvc.console.logStringMessage(assertionText + stackText);
    else 
      this.trace(assertionText, 2);
  },

  trace: function(aMsg, slice) {
    // cut off the first line of the stack trace, because that's just this function.
    let stack = Error().stack.split("\n").slice(slice || 1);

    TabmixSvc.console.logStringMessage("Tabmix Trace: " + aMsg + '\n' + stack.join("\n"));
  },

  // Show/hide one item (specified via name or the item element itself).
  showItem: function(aItemOrId, aShow) {
    var item = typeof(aItemOrId) == "string" ? document.getElementById(aItemOrId) : aItemOrId;
    if (item)
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

  _define: function(aType, aObj, aName, aCodeString) {
    let type = aType == "setter" ? "__defineSetter__" : "__defineGetter__";
    let fn = new Function();
    eval("fn = " + aCodeString);
    aObj[type](aName, fn);
  },

  toCode: function(aObj, aName, aCodeString) {
    if (aObj) {
      let fn = new Function();
      eval("fn = " + aCodeString);
      aObj[aName] = fn;
    }
    else
      eval(aName + " = " + aCodeString);
  },

  getBoolPref: function(aPrefName, aDefault, aUseTabmixBranch) {
    var branch = aUseTabmixBranch ? "extensions.tabmix." : "";
    try {
      return TabmixSvc.prefs.getBoolPref(branch + aPrefName);
    }
    catch(er) {
      TabmixSvc.prefs.setBoolPref(branch + aPrefName, aDefault);
      return aDefault;
    }
  },

  getIntPref: function(aPrefName, aDefault, aUseTabmixBranch) {
    var branch = aUseTabmixBranch ? "extensions.tabmix." : "";
    try {
      return TabmixSvc.prefs.getIntPref(branch + aPrefName);
    }
    catch(er) {
      TabmixSvc.prefs.setIntPref(branch + aPrefName, aDefault);
      return aDefault;
    }
  },

  getCharPref: function(aPrefName, aDefault, aUseTabmixBranch) {
    var branch = aUseTabmixBranch ? "extensions.tabmix." : "";
    try {
      return TabmixSvc.prefs.getCharPref(branch + aPrefName);
    }
    catch(er) {
      TabmixSvc.prefs.setCharPref(branch + aPrefName, aDefault);
      return aDefault;
    }
  },

  getTopWin: function() {
    return TabmixSvc.wm.getMostRecentWindow("navigator:browser");
  },

  lazy_import: function(aObject, aName, aModule, aSymbol, aFlag, aArg) {
    if (aFlag)
      Tabmix[aModule + "Initialized"] = false;
    XPCOMUtils.defineLazyGetter(aObject, aName, function() {
      let tmp = { };
      Components.utils.import("resource://tabmixplus/"+aModule+".jsm", tmp);
      let obj = "prototype" in tmp[aSymbol] ? new tmp[aSymbol] : tmp[aSymbol];
      if ("init" in obj)
        obj.init.apply(obj, aArg);
      if (aFlag)
        window.Tabmix[aModule + "Initialized"] = true;
      return obj;
    });
  },

  backwardCompatibilityGetter: function(aObject, aOldName, aNewName) {
    if (aOldName in aObject)
      return;

    XPCOMUtils.defineLazyGetter(aObject, aOldName, function() {
      Tabmix.informAboutChangeInTabmix(aOldName, aNewName);
      return Tabmix.getObject(aNewName);
    });
  },

  informAboutChangeInTabmix: function(aOldName, aNewName) {
    let err = Error(aOldName + " is deprecated in Tabmix since version 0.3.8.5pre.110123a use " + aNewName + " instead.");
    // cut off the first lines, we looking for the function that trigger the getter.
    let stack = Error().stack.split("\n").slice(TabmixSvc.stackOffset+2);
    let file = stack[0] ? stack[0].split(":") : null;
    if (file) {
      let [chrome, path, line] = file;
      let index = path.indexOf("/", 2) - 3;
      let extensionName = index > -1 ?
         path.charAt(2).toUpperCase() + path.substr(3, index) + " " : "";
      Tabmix.clog(err.message + "\n\n" + extensionName + "extension call " + aOldName +
                 " from:\n" + "file: " + "chrome:" + path + "\nline: " + line
                 + "\n\nPlease inform Tabmix Plus developer"
                 + (extensionName ? ( " and " + extensionName + "developer.") : "."));
    }
    else
      Tabmix.clog(err.message + "\n\n" + stack);
  },

  promptService: function(intParam, strParam, aWindow, aCallBack) {
    var dpb = Cc["@mozilla.org/embedcomp/dialogparam;1"]
                            .createInstance(Ci.nsIDialogParamBlock);
    // intParam[0] - default button accept=0, cancel=1, extra1=2
    // intParam[1] - show menuList= 1 , show textBox= 0, hide_both= 2
    // intParam[2] - set checkbox checked  true=1 , false=0, hide=2
    // intParam[3] - flag  - for menuList contents: flag to set menu selected item
    //                     - for textBox rename: 1 , save: 0

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

    var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                        .getService(Ci.nsIWindowWatcher);
    if (typeof(aWindow) == "undefined") {
      try { aWindow = window;
      }
      catch (e) { aWindow = null;
      }
    }

    var dialog = ww.openWindow(aWindow,
           "chrome://tabmixplus/content/session/promptservice.xul","",'centerscreen'+(modal ? ",modal" : ",dependent") ,dpb);
    if (!modal)
      dialog._callBackFunction = aCallBack;

    return {button: dpb.GetInt(4), checked: (dpb.GetInt(5) == TMP_CHECKBOX_CHECKED),
            label: dpb.GetString(5), value: dpb.GetInt(6)};
  },

  windowEnumerator: function Tabmix_windowEnumerator(aWindowtype) {
    if (typeof(aWindowtype) == "undefined")
      aWindowtype = "navigator:browser";
    return TabmixSvc.wm.getEnumerator(aWindowtype);
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

  isPlatform: function(aPlatform) {
    return navigator.platform.indexOf(aPlatform) == 0;
  },

  // some extensions override native JSON so we use nsIJSON
  JSON: {
    nsIJSON: null,
    parse: function TMP_parse(str) {
      return "decode" in this.nsIJSON ? this.nsIJSON.decode(str) : JSON.parse(str);
    },
    stringify: function TMP_stringify(obj) {
      return "encode" in this.nsIJSON ? this.nsIJSON.encode(obj) : JSON.stringify(obj);
    }
  },

  destroy: function() {
    this._define = null;
    this.toCode = null;
    window.removeEventListener("unload", Tabmix.destroy, false);
  }
}

Components.utils.import("resource://tabmixplus/XPCOMUtils.jsm");
Tabmix.lazy_import(window, "TabmixSvc", "Services", "TabmixSvc");
XPCOMUtils.defineLazyServiceGetter(Tabmix.JSON, "nsIJSON", "@mozilla.org/dom/json;1", "nsIJSON");

window.addEventListener("unload", Tabmix.destroy, false);
