"use strict";

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

    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js");
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
