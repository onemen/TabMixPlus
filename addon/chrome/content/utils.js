"use strict";

var Tabmix = { // jshint ignore:line
  get prefs() {
    delete this.prefs;
    return (this.prefs = Services.prefs.getBranch("extensions.tabmix."));
  },

  get defaultPrefs() {
    delete this.defaultPrefs;
    return (this.defaultPrefs = Services.prefs.getDefaultBranch("extensions.tabmix."));
  },

  isVersion: function() {
    return TabmixSvc.version.apply(null, arguments);
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
      if (aVal === null || aVal === undefined) {
        elem.removeAttribute(aAttr);
        return;
      }
      if (typeof(aVal) == "boolean")
        aVal = aVal ? "true" : "false";

      if (!elem.hasAttribute(aAttr) || elem.getAttribute(aAttr) != aVal)
        elem.setAttribute(aAttr, aVal);
    }
  },

  setAttributeList: function(aItemOrId, aAttr, aValue, aAdd) {
    let elem = typeof(aItemOrId) == "string" ? document.getElementById(aItemOrId) : aItemOrId;
    let att = elem.getAttribute(aAttr);
    let array = att ? att.split(" ") : [];
    let index = array.indexOf(aValue);
    if (aAdd && index == -1)
      array.push(aValue);
    else if (!aAdd && index != -1)
      array.splice(index, 1);
    if (array.length)
      elem.setAttribute(aAttr, array.join(" "));
    else
      elem.removeAttribute(aAttr);
  },

  getTopWin: function() {
    return Services.wm.getMostRecentWindow("navigator:browser");
  },

  getSingleWindowMode: function TMP_getSingleWindowMode() {
    // if we don't have any browser window opened return false
    // so we can open new window
    if (!this.getTopWin())
      return false;
    return this.prefs.getBoolPref("singleWindow");
  },

  isNewWindowAllow: function(isPrivate) {
    // allow to open new window if:
    //   user are not in single window mode or
    //   there is no other window with the same privacy type
    return !this.getSingleWindowMode() ||
      this.isVersion(200) && !this.RecentWindow.getMostRecentBrowserWindow({private: isPrivate});
  },

  lazy_import: function(aObject, aName, aModule, aSymbol, aFlag, aArg) {
    if (aFlag)
      this[aModule + "Initialized"] = false;
    var self = this;
    XPCOMUtils.defineLazyGetter(aObject, aName, function() {
      let tmp = { };
      Components.utils.import("resource://tabmixplus/"+aModule+".jsm", tmp);
      let Obj = tmp[aSymbol];
      if ("prototype" in tmp[aSymbol])
        Obj = new Obj();
      else if ("init" in Obj)
        Obj.init.apply(Obj, aArg);
      if (aFlag)
        self[aModule + "Initialized"] = true;
      return Obj;
    });
  },

  backwardCompatibilityGetter: function(aObject, aOldName, aNewName) {
    if (aOldName in aObject)
      return;

    var self = this;
    Object.defineProperty(aObject, aOldName, {
      get: function () {
        self.informAboutChangeInTabmix(aOldName, aNewName);
        delete aObject[aOldName];
        return (aObject[aOldName] = self.getObject(window, aNewName));
      },
      configurable: true
    });
  },

  informAboutChangeInTabmix: function(aOldName, aNewName) {
    let err = Error(aOldName + " is deprecated in Tabmix, use " + aNewName + " instead.");
    // cut off the first lines, we looking for the function that trigger the getter.
    let stack = Error().stack.split("\n").slice(3);
    let file = stack[0] ? stack[0].split(":") : null;
    if (file) {
      let [path, line] = file;
      let index = path.indexOf("/", 2) - 3;
      let extensionName = index > -1 ?
         path.charAt(2).toUpperCase() + path.substr(3, index) + " " : "";
      this.clog(err.message + "\n\n" + extensionName + "extension call " + aOldName +
                 " from:\n" + "file: " + "chrome:" + path + "\nline: " + line +
                 "\n\nPlease inform Tabmix Plus developer" +
                 (extensionName ? ( " and " + extensionName + "developer.") : "."));
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
           "chrome://tabmixplus/content/session/promptservice.xul","","centerscreen" +
           (modal ? ",modal" : ",dependent") ,dpb);
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

  get window() {
    return window;
  },

  compare: function TMP_utils_compare(a, b, lessThan) {return lessThan ? a < b : a > b;},
  itemEnd: function TMP_utils_itemEnd(item, end) {
    return item.boxObject.screenX + (end ? item.getBoundingClientRect().width : 0);
  },

  show: function(aMethod, aDelay, aWindow) {
    TabmixSvc.console.show(aMethod, aDelay, aWindow || window);
  },

  // console._removeInternal use this function name to remove it from
  // caller list
  _getMethod: function TMP_console_wrapper(id, args) {
    if (["changeCode", "setNewFunction", "nonStrictMode"].indexOf(id) > -1) {
      this.installeChangecode();
      return this[id].apply(this, args);
    }
    if (typeof TabmixSvc.console[id] == "function") {
      return TabmixSvc.console[id].apply(TabmixSvc.console, args);
    }
    TabmixSvc.console.trace("unexpected method " + id);
    return null;
  },

  installeChangecode: function() {
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js", window);
    this.installeChangecode = function() {};
  },

  _init: function() {
    Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
    Components.utils.import("resource://gre/modules/Services.jsm");
    this.lazy_import(window, "TabmixSvc", "Services", "TabmixSvc");
    if (this.isVersion(200)) {
      let resource = this.isVersion(210) ? "resource:///" : "resource://gre/";
      XPCOMUtils.defineLazyModuleGetter(this, "RecentWindow",
                 resource + "modules/RecentWindow.jsm");
    }

    window.addEventListener("unload", function tabmix_destroy() {
      window.removeEventListener("unload", tabmix_destroy, false);
      this.destroy();
    }.bind(this), false);

    var methods = ["changeCode", "setNewFunction", "nonStrictMode",
                   "getObject", "log", "getCallerNameByIndex", "callerName",
                   "clog", "isCallerInList", "obj", "assert", "trace", "reportError"];
    methods.forEach(function(id) {
      this[id] = function TMP_console_wrapper() {
        return this._getMethod(id, arguments);
      }.bind(this);
    }, this);
  },

  originalFunctions: {},
  destroy: function TMP_utils_destroy() {
    this.toCode = null;
    this.originalFunctions = null;
    delete this.window;
  }
};

Tabmix._init();
