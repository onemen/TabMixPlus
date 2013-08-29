"use strict";

var EXPORTED_SYMBOLS = ["console"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://tabmixplus/Services.jsm");

let gNextID = 1;

let console = {
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
    try {
      var obj = aWindow;
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
        let isObj = typeof aMethod == "object";
        let result = isObj ? aMethod.obj[aMethod.name] :
                this.getObject(aWindow, aMethod);
        this.clog((isObj ? aMethod.fullName : aMethod) + " = " + result.toString());
      }.bind(this);

      if (aDelay >= 0) {
        let timer = {};
        timer.__proto__ = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        let timerID = gNextID++;
        this._timers[timerID] = timer;
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
        timer.initWithCallback(function() {
          timer.clear();
          logMethod();
        }, aDelay, Ci.nsITimer.TYPE_ONE_SHOT);
      }
      else
        logMethod();

    } catch (ex) {this.assert(ex, "Error we can't show " + aMethod + " in Tabmix.show");}
  },

  clog: function TMP_clog(aMessage) {
    Services.console.logStringMessage("TabMix :\n" + aMessage);
  },

  log: function TMP_log(aMessage, aShowCaller, offset) {
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
    if (stack[0].indexOf("TMP_") == 0)
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
  getCallerNameByIndex: function TMP_getCallerNameByIndex(aPlace) {
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
    return this._char = TabmixSvc.version(140) ? "@" : "(";
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
  _nameFromComponentsStack: function(Cs) {
    return Cs.name ||
           Cs.filename.substr(Cs.filename.lastIndexOf("/") + 1) + ":" + Cs.lineNumber;
  },

  callerName: function() {
///    return this.getCallerNameByIndex(2);
    try {
      var name = this._nameFromComponentsStack(Components.stack.caller.caller);
    } catch (ex) { }
    return name || "";
  },
*/

  callerName: function() {
    return this.getCallerNameByIndex(2);
  },

  // return true if the caller name of the calling function is in the
  // arguments list
  isCallerInList: function() {
    if (!arguments.length) {
      this.assert("no arguments in Tabmix.isCallerInList");
      return false;
    }

    try {
      let callerName = this.getCallerNameByIndex(2);
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
  }
}
