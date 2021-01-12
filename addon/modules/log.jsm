/* globals OS */
"use strict";

this.EXPORTED_SYMBOLS = ["console"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

XPCOMUtils.defineLazyGetter(this, "OS", () => {
  return Cu.import("resource://gre/modules/osfile.jsm", {}).OS;
});

var gNextID = 1;

this.console = {
  getObject(aWindow, aMethod) {
    let msg = "";
    if (!aWindow)
      msg += "aWindow is undefined";
    if (typeof aMethod != "string")
      msg += (msg ? "\n" : "") + "aMethod need to be a string";
    if (msg) {
      this.assert(msg);
      return {toString: () => msg};
    }
    var rootID, methodsList = aMethod.split(".");
    if (methodsList[0] == "window")
      methodsList.shift();
    else if (methodsList[0] == "document") {
      methodsList.shift();
      rootID = methodsList.shift().replace(/getElementById\(|\)|'|"/g, "");
    }
    var obj;
    try {
      obj = aWindow;
      if (rootID)
        obj = obj.document.getElementById(rootID);
      methodsList.forEach(aFn => (obj = obj[aFn]));
    } catch (ex) { }
    return obj || {toString: () => "undefined"};
  },

  _timers: {},
  show(aMethod, aDelay, aWindow) {
    try {
      if (typeof (aDelay) == "undefined")
        aDelay = 500;

      let logMethod = () => {
        let result = "", isObj = typeof aMethod == "object";
        if (typeof aMethod != "function") {
          result = isObj ? aMethod.obj[aMethod.name] :
            this.getObject(aWindow, aMethod);
          result = " = " + result.toString();
        }
        this.clog((isObj ? aMethod.fullName : aMethod) + result, this.caller);
      };

      if (aDelay >= 0) {
        let timerID = gNextID++;
        let timer = Object.create(Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer));
        timer.clear = () => {
          if (timerID in this._timers)
            delete this._timers[timerID];
          timer.cancel();
        };
        if (aWindow) {
          aWindow.addEventListener("unload", function unload(event) {
            event.currentTarget.removeEventListener("unload", unload);
            timer.clear();
          });
        }
        timer.initWithCallback({
          notify: function notify() {
            timer.clear();
            logMethod();
          }
        }, aDelay, Ci.nsITimer.TYPE_ONE_SHOT);

        this._timers[timerID] = timer;
      } else {
        logMethod();
      }
    } catch (ex) {
      this.assert(ex, "Error we can't show " + aMethod + " in Tabmix.show");
    }
  },

  // get functions names from Error().stack
  // excluding any internal caller (name start with TMP_console_)
  _getNames(aCount, stack) {
    stack = this._getStackExcludingInternal(stack);
    if (!aCount)
      aCount = 1;
    else if (aCount < 0)
      aCount = stack.length;
    let names = [];
    for (let i = 0, l = Math.min(aCount, stack.length); i < l; i++)
      names.push(this._name(stack[i]));

    return names;
  },

  // get the name of the function that is in the nth place in Error().stack
  // excluding any internal caller in the count
  getCallerNameByIndex(aIndex) {
    let fn = this._getStackExcludingInternal()[aIndex];
    if (fn)
      return this._name(fn);
    return null;
  },

  _getStackExcludingInternal(stack) {
    if (!stack)
      stack = Error().stack.split("\n").slice(2);
    else
      stack = stack.split("\n");
    // cut internal callers
    let re = /TMP_console_.*/;
    while (stack.length && stack[0].match(re))
      stack.splice(0, 1);
    return stack;
  },

  _char: "@",
  _name(fn) {
    let fnName = fn.substr(0, fn.indexOf(this._char));
    if (fn && !fnName) {
      // get file name and line number
      let lastIndexOf = fn.lastIndexOf("/");
      fnName = lastIndexOf > -1 ? fn.substr(lastIndexOf + 1) : "?";
    }
    return fnName;
  },

  callerName: function TMP_console_callerName() {
    return this.getCallerNameByIndex(1);
  },

  // return true if the caller name of the calling function is in the
  // arguments list
  isCallerInList: function TMP_console_isCallerInList() {
    if (!arguments.length) {
      this.assert("no arguments in Tabmix.isCallerInList");
      return false;
    }

    try {
      let callerName = this.getCallerNameByIndex(1);
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

  callerTrace: function TMP_console_callerTrace(...args) {
    let stack = this._getStackExcludingInternal();

    let stackUtil = {
      contain(...names) {
        if (Array.isArray(names[0])) {
          names = names[0];
        }
        let _isCallerInList = function(caller) {
          return names.some(name => caller.startsWith(name + "@"));
        };
        return stack.some(_isCallerInList);
      },
    };
    if (args.length) {
      return stackUtil.contain.apply(null, args);
    }
    return stackUtil;
  },

  /*
  options = {
    msg: msg
    log: true / false; default true
    function: true / false default false
    deep: true / false default false
    offset; for internal use only true / false default false
  }
  */
  obj: function TMP_console_obj(aObj, aMessage, aDisallowLog, level) {
    if (!aObj || typeof aObj != "object") {
      let msg = "log.obj was called with non-object argument\n";
      if (aMessage) {
        msg += aMessage + "\n";
      }
      let type = aObj === null ? "null" : typeof aObj;
      msg += "typeof aObj is '" + type + "'\n'" + aObj + "'";
      if (!aDisallowLog) {
        this.log(msg, true, false, this.caller);
      }
      return msg;
    }
    let offset = typeof level == "string" ? "  " : "";
    aMessage = aMessage ? offset + aMessage + "\n" : "";
    let objS = offset + aObj.toString() + ":\n";

    for (let prop of Object.keys(aObj)) {
      try {
        let val = aObj[prop];
        let type = typeof val;
        if (type == "string")
          val = "'" + val + "'";
        if (type == "function" && typeof level == "string") {
          val = val.toString();
          let code = val.toString().indexOf("native code") > -1 ?
            "[native code]" : "[code]";
          val = val.substr(0, val.indexOf("(")) + "() { " + code + " }";
        }
        objS += offset + prop + "[" + type + "] =  " + val + "\n";
        if (type == "object" && val !== null && level && typeof level == "boolean")
          objS += this.obj(val, "", true, "deep") + "\n";
      } catch (ex) {
        objS += offset + prop + " =  [!!error retrieving property]\n";
      }
    }
    if (aDisallowLog)
      objS = aMessage + "======================\n" + objS;
    else {
      let msg = aMessage + "=============== Object Properties ===============\n";
      this.log(msg + objS, true, false, this.caller);
    }
    return objS;
  },

  // RegExp to remove path/to/profile/extensions from filename
  get _pathRegExp() {
    delete this._pathRegExp;
    let folder = OS.Path.join(OS.Constants.Path.profileDir, "extensions");
    let path = folder.replace(/\\/g, "/") + "/";
    return (this._pathRegExp = new RegExp("jar:|file:///|" + path, "g"));
  },

  _formatStack(stack) {
    let lines = [], _char = this._char, re = this._pathRegExp;
    stack.forEach(line => {
      let atIndex = line.indexOf("@");
      let columnIndex = line.lastIndexOf(":");
      let fileName = line.slice(atIndex + 1, columnIndex).split(" -> ").pop();
      if (fileName) {
        let lineNumber = parseInt(line.slice(columnIndex + 1));
        let colNumber;
        if (fileName.replace("://", "///").indexOf(":") > -1) {
          colNumber = lineNumber;
          columnIndex = fileName.lastIndexOf(":");
          lineNumber = parseInt(fileName.slice(columnIndex + 1));
          fileName = fileName.slice(0, columnIndex);
        }
        fileName = decodeURI(fileName).replace(re, "");
        let index = line.indexOf(_char);
        let name = line.slice(0, index).split("(").shift();
        let formatted = '  File "' + fileName + '", line ' + lineNumber;
        if (colNumber)
          formatted += ', col ' + colNumber;
        if (name)
          formatted += ', in ' + name.replace("/<", "");
        lines.push(formatted);
      }
    });

    return lines.join("\n");
  },

  /* logMessage */

  clog(aMessage, caller) {
    this._logMessage(":\n" + aMessage, "infoFlag", caller);
  },

  log: function TMP_console_log(aMessage, aShowCaller, offset, caller) {
    offset = !offset ? 0 : 1;
    let names = this._getNames(aShowCaller ? 2 + offset : 1 + offset);
    let callerName = names[offset + 0];
    let callerCallerName = aShowCaller && names[offset + 1] ? " (caller was " + names[offset + 1] + ")" : "";
    this._logMessage(" " + callerName + callerCallerName + ":\n" + aMessage, "infoFlag", caller);
  },

  assert: function TMP_console_assert(aError, aMsg) {
    if (!aError || typeof aError.stack != "string") {
      let msg = aMsg ? aMsg + "\n" : "";
      this.trace(msg + (aError || ""), "errorFlag", this.caller);
      return;
    }
    if (typeof aError == "object" &&
        (aError instanceof Components.Exception ||
         aError instanceof Error)) {
      this.reportError(aError, aMsg);
    }

    let names = this._getNames(1, aError.stack);
    let errAt = " at " + names[0];
    let location = aError.location ? "\n" + aError.location : "";
    let assertionText = " ERROR" + errAt + ":\n" + (aMsg ? aMsg + "\n" : "") + aError.message + location;
    let stackText = "\nStack Trace:\n" + this._formatStack(aError.stack.split("\n"));
    this._logMessage(assertionText + stackText, "errorFlag");
  },

  trace: function TMP_console_trace(aMsg, flag = "infoFlag", caller = null) {
    let stack = this._formatStack(this._getStackExcludingInternal());
    let msg = aMsg ? aMsg + "\n" : "";
    this._logMessage(":\n" + msg + "Stack Trace:\n" + stack, flag, caller);
  },

  get caller() {
    let parent = Components.stack.caller;
    parent = parent.name == "_logMessage" ? parent.caller.caller : parent.caller;
    if (parent.name == "TMP_console_wrapper")
      parent = parent.caller.caller;
    return parent || {};
  },

  reportError(ex = null, msg = "", filter) {
    if (filter) {
      if (!ex.message || !ex.message.includes(filter)) {
        return;
      }
    }
    if (ex === null) {
      ex = "reportError was called with null";
    }
    msg = ":\n" + (msg ? msg + "\n" : "");
    if (typeof ex != "object" || ex instanceof OS.File.Error ||
        typeof ex.message != "string") {
      this._logMessage(msg + ex.toString(), "errorFlag");
    } else {
      if (typeof ex.filename == "undefined") {
        ex.filename = ex.fileName;
      }
      this._logMessage(msg + ex.message, "errorFlag", ex);
    }
  },

  _logMessage: function _logMessage(msg, flag = "infoFlag", caller = null) {
    msg = msg.replace(/\r\n/g, "\n") + "\n";
    if (typeof Ci.nsIScriptError[flag] == "undefined") {
      Services.console.logStringMessage("Tabmix" + msg);
      return;
    }
    if (!caller)
      caller = this.caller;
    let {filename, lineNumber, columnNumber} = caller;
    let consoleMsg = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
    consoleMsg.init("Tabmix" + msg, filename, null, lineNumber, columnNumber,
      Ci.nsIScriptError[flag], "component javascript");
    Services.console.logMessage(consoleMsg);
  },

};

(function(_this) {
  _this.reportError = _this.reportError.bind(_this);
}(this.console));
