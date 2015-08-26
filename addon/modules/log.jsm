"use strict";

var EXPORTED_SYMBOLS = ["console"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "OS", function() {
  return Cu.import("resource://gre/modules/osfile.jsm", {}).OS;
});

let gNextID = 1;

this.console = {
  getObject: function(aWindow, aMethod) {
    let msg = "";
    if (!aWindow)
      msg += "aWindow is undefined";
    if (typeof aMethod != "string")
      msg += (msg ? "\n" : "") + "aMethod need to be a string";
    if (msg) {
      this.assert(msg);
      return {toString: function() msg};
    }
    var rootID, methodsList = aMethod.split(".");
    if (methodsList[0] == "window")
      methodsList.shift();
    else if (methodsList[0] == "document") {
      methodsList.shift();
      rootID = methodsList.shift().replace(/getElementById\(|\)|'|"/g , "");
    }
    var obj;
    try {
      obj = aWindow;
      if (rootID)
        obj = obj.document.getElementById(rootID);
      methodsList.forEach(function(aFn) {
        obj = obj[aFn];
      });
    } catch (ex) { }
    return obj || {toString: function() "undefined"};
  },

  _timers: {},
  show: function(aMethod, aDelay, aWindow) {
    try {
      if (typeof(aDelay) == "undefined")
        aDelay = 500;

      let logMethod = function _logMethod() {
        let result = "", isObj = typeof aMethod == "object";
        if (typeof aMethod != "function") {
          result = isObj ? aMethod.obj[aMethod.name] :
                this.getObject(aWindow, aMethod);
          result = " = " + result.toString();
        }
        this.clog((isObj ? aMethod.fullName : aMethod) + result, this.caller);
      }.bind(this);

      if (aDelay >= 0) {
        let timerID = gNextID++;
        let timer = Object.create(Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer));
        timer.clear = function() {
          if (timerID in this._timers)
            delete this._timers[timerID];
          timer.cancel();
        }.bind(this);
        if (aWindow) {
          aWindow.addEventListener("unload", function unload() {
            timer.clear();
          }, false);
        }
        timer.initWithCallback({
          notify: function notify() {
            timer.clear();
            logMethod();
          }
        }, aDelay, Ci.nsITimer.TYPE_ONE_SHOT);

        this._timers[timerID] = timer;
      }
      else
        logMethod();

    } catch (ex) {this.assert(ex, "Error we can't show " + aMethod + " in Tabmix.show");}
  },

  // get functions names from Error().stack
  // excluding any internal caller (name start with TMP_console_)
  _getNames: function(aCount, stack) {
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
  getCallerNameByIndex: function(aIndex) {
    let fn = this._getStackExcludingInternal()[aIndex];
    if (fn)
      return this._name(fn);
    return null;
  },

  _getStackExcludingInternal: function(stack) {
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
  _name: function(fn) {
    let fnName = fn.substr(0, fn.indexOf(this._char));
    if (fn && !fnName) {
      // get file name and line number
      let lastIndexOf = fn.lastIndexOf("/");
      fnName = lastIndexOf > -1 ? fn.substr(lastIndexOf+1) : "?";
    }
    return fnName;
  },

/*
  _nameFromComponentsStack: function(Cs) {
    return Cs.name ||
           Cs.filename.substr(Cs.filename.lastIndexOf("/") + 1) + ":" + Cs.lineNumber;
  },

  callerName: function() {
    try {
      var name = this._nameFromComponentsStack(Components.stack.caller.caller);
    } catch (ex) { }
    return name || "";
  },
*/

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
    var offset = typeof level == "string" ? "  " : "";
    aMessage = aMessage ? offset + aMessage + "\n" : "";
    var objS = aObj ? offset + aObj.toString() : offset + "aObj is " + typeof(aObj);
    objS +=  ":\n";

    for (let prop in aObj) {
      try {
        let val = aObj[prop];
        let type = typeof val;
        if (type == "string")
          val = "\'" + val + "\'";
        if (type == "function" && typeof level == "string") {
          val = val.toString();
          let code = val.toString().indexOf("native code") > -1 ?
            "[native code]" : "[code]";
          val = val.substr(0, val.indexOf("(")) + "() { " + code + " }";
        }
        objS += offset + prop + "[" + type + "]" + " =  " + val + "\n";
        if (type == "object" && val !== null && level && typeof level == "boolean")
          objS += this.obj(val, "", true, "deep") + "\n";
      } catch (ex) {
        objS += offset + prop + " =  " + "[!!error retrieving property]" + "\n";
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

  _formatStack: function(stack) {
    let lines = [], _char = this._char, re = this._pathRegExp;
    stack.forEach(function(line) {
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
        let atIndex = line.indexOf(_char);
        let name = line.slice(0, atIndex).split("(").shift();
        let formated = '  File "' + fileName + '", line ' + lineNumber;
        if (colNumber)
          formated += ', col ' + colNumber;
        if (name)
          formated += ', in ' + name.replace("/<", "");
        lines.push(formated);
      }
    });

    return lines.join("\n");
  },

  /* logMessage */

  clog: function(aMessage, caller) {
    this._logMessage(":\n" + aMessage, "infoFlag", caller);
  },

  log: function TMP_console_log(aMessage, aShowCaller, offset, caller) {
    offset = !offset ? 0 : 1;
    let names = this._getNames(aShowCaller ? 2 + offset : 1 + offset);
    let callerName = names[offset+0];
    let callerCallerName = aShowCaller && names[offset+1] ? " (caller was " + names[offset+1] + ")" : "";
    this._logMessage(" " + callerName + callerCallerName + ":\n" + aMessage, "infoFlag", caller);
  },

  assert: function TMP_console_assert(aError, aMsg) {
    if (!aError || typeof aError.stack != "string") {
      let msg = aMsg ? aMsg + "\n" : "";
      this.trace(msg + (aError || ""), "errorFlag", this.caller);
      return;
    }
    if (/Error/.test(Object.getPrototypeOf(aError))) {
      this.reportError(aError, aMsg);
    }

    let names = this._getNames(1, aError.stack);
    let errAt = " at " + names[0];
    let location = aError.location ? "\n" + aError.location : "";
    let assertionText = " ERROR" + errAt + ":\n" + (aMsg ? aMsg + "\n" : "") + aError.message + location;
    let stackText = "\nStack Trace:\n" + this._formatStack(aError.stack.split("\n"));
    this._logMessage(assertionText + stackText, "errorFlag");
  },

  trace: function TMP_console_trace(aMsg, flag="infoFlag", caller=null) {
    let stack = this._formatStack(this._getStackExcludingInternal());
    let msg = aMsg ? aMsg + "\n" : "";
    this._logMessage(":\n" + msg + "Stack Trace:\n" + stack, flag, caller);
  },

  get caller() {
    let parent = Components.stack.caller;
    parent = parent.name == "_logMessage" ? parent.caller.caller : parent.caller;
    if (parent.name == "TMP_console_wrapper")
      parent = parent.caller.caller;
    return parent;
  },

  reportError: function(ex=null, msg="") {
    if (ex === null) {
      ex = "reportError was called with null";
    }
    msg = ":\n" + (msg ? msg + "\n" : "");
    if (typeof ex != "object" || ex instanceof OS.File.Error ||
        typeof ex.message != "string") {
      this._logMessage(msg + ex.toString(), "errorFlag");
    }
    else {
      if (typeof ex.filename == "undefined") {
        ex.filename = ex.fileName;
      }
      this._logMessage(msg + ex.message, "errorFlag", ex);
    }
  },

  _logMessage: function _logMessage(msg, flag="infoFlag", caller=null) {
    msg = msg.replace(/\r\n/g, "\n");
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

(function(self){
  self.reportError = self.reportError.bind(self);
}(this.console));
