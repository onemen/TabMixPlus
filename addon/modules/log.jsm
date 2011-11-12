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
        self.msg(aMethod + " = " + result);
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

  msg: function(aMessage, aShowCaller) {
    try {
      var caller = arguments.callee.caller;
      var callerName = caller.name;
      var callerCallerName = "";
      if (aShowCaller) {
        let prevCaller = caller.caller;
        let prevCalerName = prevCaller && "name" in prevCaller ? prevCaller.name : prevCaller || "?" ;
        callerCallerName = aShowCaller ? " (caller was " + prevCalerName + ")" : "";
      }
    } catch (e) {
      callerCallerName = callerName = "";
    }
    TabmixSvc.console.logStringMessage("TabMix " + callerName + callerCallerName + ":\n" + aMessage);
  },

  obj: function(aObj, aMessage, aDisallowLog) {
    aMessage = aMessage ? aMessage : "";
    var objS = aObj ? aObj.toString() : "aObj is " + typeof(aObj);
    objS +=  ":\n"

    for (let item in aObj) {
      try {
        let val = aObj[item];
        let type = typeof(val);
        objS += item + "[" + type + "]" + " =  " + val + "\n";
        if (type == "object")
          objS += "\n";
      } catch (er) { objS += item + " =  " + "error in this item" + "\n";}
    }
    if (aDisallowLog)
      objS = aMessage + "\n======================\n" + objS;
    else
      this.msg(aMessage + "\n=============== Object Properties ===============\n" + objS);
    return objS;
  },

  assert: function(aError, aMsg) {
    var caller = arguments.callee.caller;
    var callerName = caller && "name" in caller ? caller.name : "";
    var errAt = callerName ? " at " + callerName : ""
    var assertionText = "Tabmix Plus ERROR" + errAt + ":\n" + (aMsg ? aMsg + "\n" : "") + aError + "\n";
    var stackText = "stack" in aError ? "Stack Trace: \n" + aError.stack : "";
    TabmixSvc.console.logStringMessage(assertionText + stackText);
  },

  trace: function(aMsg) {
    try {
      throw new Error(aMsg);
    } catch (ex) {
      let stack = ex.stack.split("\n");
      let m = stack.splice(3).join("\n");
      this.msg("Message: " + ex.message + "\nIn function:\n" + stack[2] + "\nTrace:\n" + m);
    }
  }
}
