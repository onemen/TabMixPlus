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

  // for debug
  debug: function TMP_utils_debug(aMessage, aShowCaller) {
    if (this._debug)
      this.log(aMessage, aShowCaller);
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
      return self.getObject(window, aNewName);
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

  get window() {
    return window;
  },

  compare: function TMP_utils_compare(a, b, lessThan) {return lessThan ? a < b : a > b;},
  itemEnd: function TMP_utils_itemEnd(item, end) {return item.boxObject.screenX + (end ? item.getBoundingClientRect().width : 0);},

  _init: function() {
    Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
    Components.utils.import("resource://gre/modules/Services.jsm");
    this.lazy_import(window, "TabmixSvc", "Services", "TabmixSvc");
    if (this.isVersion(200)) {
      XPCOMUtils.defineLazyModuleGetter(this, "RecentWindow",
                 "resource:///modules/RecentWindow.jsm");
    }

    let tmp = {};
    Components.utils.import("resource://tabmixplus/log.jsm", tmp);
    for (let [fnName, value] in Iterator(tmp.log))
      this[fnName] = typeof value == "function" ? value.bind(this) : value;

    window.addEventListener("unload", function tabmix_destroy() {
      window.removeEventListener("unload", tabmix_destroy, false);
      this.destroy();
    }.bind(this), false);
  },

  originalFunctions: {},
  destroy: function TMP_utils_destroy() {
    this.toCode = null;
    this.originalFunctions = null;
    delete this.window;
    for (let [id, timer] in Iterator(this._timers)) {
      timer.cancel();
      delete this._timers[id];
    }
  }
}

Tabmix._init();
