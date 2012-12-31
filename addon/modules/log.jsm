var EXPORTED_SYMBOLS = ["_log"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://tabmixplus/Services.jsm");

var _log = {
  getObject: function (aMethod, rootID) {
    var methodsList = aMethod.split(".");
    if (methodsList[0] == "window")
      methodsList.shift();
    else if (methodsList[0] == "document") {
      methodsList.shift();
      rootID = methodsList.shift().replace(/getElementById\(|\)|'|"/g , "");
    }
    var obj = rootID ? TabmixSvc.topWin().document.getElementById(rootID) : (window || TabmixSvc.topWin());
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
        self.log(aMethod + " = " + result);
        if (self.timer) {
          self.timer.cancel();
          self.timer = null;
        }
      }

      if (aDelay >= 0) {
        this.timer =  Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        this.timer.initWithCallback(logMethod, aDelay, Ci.nsITimer.TYPE_ONE_SHOT);
      }
      else
        logMethod();

    } catch (ex) {this.assert(ex, "Error we can't show " + aMethod + " in Tabmix.show");}
  },

  clog: function TMP_log_clog(aMessage) {
    TabmixSvc.console.logStringMessage("TabMix :\n" + aMessage);
  },

  log: function TMP_log_log(aMessage, aShowCaller, offset) {
    offset = !offset ? 0 : 1;
    let names = this._getNames(aShowCaller ? 2 + offset : 1 + offset);
    let callerName = names[offset+0];
    let callerCallerName = aShowCaller ? " (caller was " + names[offset+1] + ")" : "";
    TabmixSvc.console.logStringMessage("TabMix " + callerName + callerCallerName + " :\n" + aMessage);
  },

  // get functions names from Error().stack
  _getNames: function(aCount, stack) {
    if (!stack)
      stack = Error().stack.split("\n").slice(1);
    else
      stack = stack.split("\n");
    // cut the secound if it is from our utils
    if (stack[0].indexOf("TMP_log_") == 0)
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
  _getCallerNameByIndex: function TMP_log_getCallerNameByIndex(aPlace) {
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
        return arguments[0].indexOf(callerName);

      let args = Array.prototype.slice.call(arguments);
      return args.indexOf(callerName)

    } catch (ex) {
      this.assert(ex, "Error we can't check for caller name");
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
    if (typeof aError.stack != "string") {
      this.trace((aMsg || "") + "\n" + aError, 2);
      return;
    }

    let names = this._getNames(1, aError.stack);
    let errAt = " at " + names[0];
    let location = aError.location ? "\n" + aError.location : "";
    let assertionText = "Tabmix Plus ERROR" + errAt + ":\n" + (aMsg ? aMsg + "\n" : "") + aError.message + location;
    let stackText = "\nStack Trace: \n" + aError.stack;
    TabmixSvc.console.logStringMessage(assertionText + stackText);
  },

  trace: function(aMsg, slice) {
    // cut off the first line of the stack trace, because that's just this function.
    let stack = Error().stack.split("\n").slice(slice || 1);

    TabmixSvc.console.logStringMessage("Tabmix Trace: " + (aMsg || "") + '\n' + stack.join("\n"));
  }
}
