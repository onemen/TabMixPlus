/**
 * Tabmix logging and caller-introspection utilities.
 *
 * All user-visible output goes through a single `ConsoleAPI` instance
 * (`logger`) created with `console.createInstance({prefix: "Tabmix"})`, so
 * every message is natively rendered as `[Tabmix:<level>]` in the Browser
 * Console and can be filtered by one click on the prefix. Log level is
 * controlled by the `extensions.tabmix.log.level` pref through
 * `maxLogLevelPref`.
 *
 * Modules import the `logger` instance directly; the `console` export keeps the
 * method surface that has always been exposed (as Tabmix.console /
 * TabmixSvc.console), implemented on top of `logger`. Content code reaches it
 * through the Tabmix.console lazy getter (Tabmix.lazy_import in utils.js).
 *
 * Caller introspection (`callerName`, `callerTrace`, ...) is used by runtime
 * logic, not only for logging, so it stays implemented on Error().stack.
 *
 * `console.createInstance` is available since Firefox 87 on the WebIDL global,
 * in every privileged context including content scripts.
 */

/**
 * The raw ConsoleAPI instance. New code should prefer this over the legacy
 * `console` export below. The initial level is "all" - matching the old
 * log.sys.mjs that always printed - and users can quiet it down by setting the
 * `extensions.tabmix.log.level` pref (e.g. "Debug", "Warn", "Error").
 *
 * @type {ConsoleInstance}
 */
export const logger = globalThis.console.createInstance({
  prefix: "Tabmix",
  maxLogLevel: "All",
  maxLogLevelPref: "extensions.tabmix.log.level",
});

var gNextID = 1;

/** @type {LogModule.Console} */
export const console = {
  getObject(aWindow, aMethod) {
    let msg = "";
    if (!aWindow) {
      msg += "aWindow is undefined";
    }

    if (typeof aMethod != "string") {
      msg += (msg ? "\n" : "") + "aMethod need to be a string";
    }

    if (msg) {
      this.assert(msg);
      return {toString: () => msg};
    }
    var rootID,
      methodsList = aMethod.split(".");
    if (methodsList[0] == "window") {
      methodsList.shift();
    } else if (methodsList[0] == "document") {
      methodsList.shift();
      rootID = methodsList.shift()?.replace(/getElementById\(|\)|'|"/g, "");
    }

    /** @type {any} */
    var obj;
    try {
      obj = aWindow;
      if (rootID) {
        obj = obj?.document.getElementById(rootID);
      }

      methodsList.forEach(aFn => (obj = obj[aFn]));
    } catch {}
    return typeof obj !== "undefined" ? obj : {toString: () => "undefined"};
  },

  _timers: {},
  show(aMethod, aDelay, aWindow) {
    try {
      if (typeof aDelay == "undefined") {
        aDelay = 500;
      }

      const caller = this.caller;
      let logMethod = () => {
        const isObj = typeof aMethod == "object";
        let result = "";
        if (typeof aMethod != "function") {
          const method = isObj ? aMethod.obj[aMethod.name] : this.getObject(aWindow, aMethod);
          result = " = " + method?.toString();
        }
        this.log((isObj ? aMethod.fullName : aMethod) + result, false, false, caller);
      };

      if (aDelay >= 0) {
        let timerID = gNextID++;
        let timer = Object.create(Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer));
        timer.clear = () => {
          if (timerID in this._timers) {
            delete this._timers[timerID];
          }

          timer.cancel();
        };
        if (aWindow) {
          aWindow.addEventListener(
            "unload",
            function unload() {
              timer.clear();
            },
            {once: true}
          );
        }
        timer.initWithCallback(
          {
            notify: function notify() {
              timer.clear();
              logMethod();
            },
          },
          aDelay,
          Ci.nsITimer.TYPE_ONE_SHOT
        );

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
    let stackList = this._getStackExcludingInternal(stack);
    if (!aCount) {
      aCount = 1;
    } else if (aCount < 0) {
      aCount = stackList.length;
    }

    return stackList.slice(0, Math.min(aCount, stackList.length)).map(n => this._name(n));
  },

  // get the name of the function that is in the nth place in Error().stack
  // excluding any internal caller in the count
  getCallerNameByIndex(aIndex) {
    let fn = this._getStackExcludingInternal()[aIndex];
    if (fn) {
      return this._name(fn);
    }

    return null;
  },

  _getStackExcludingInternal(stack) {
    let stackList;
    if (!stack) {
      stackList = Error().stack?.split("\n").slice(2) ?? [];
    } else {
      stackList = stack.split("\n");
    }
    // cut internal callers
    let re = /TMP_console_.*/;
    while (stackList[0]?.match(re)) {
      stackList.splice(0, 1);
    }
    return stackList;
  },

  _char: "@",
  _name(fn) {
    // substr(0, -1) returned "" when the separator is missing; clamp to 0
    let fnName = fn.slice(0, Math.max(fn.indexOf(this._char), 0));
    if (fn && !fnName) {
      // get file name and line number
      let lastIndexOf = fn.lastIndexOf("/");
      fnName = lastIndexOf > -1 ? fn.slice(lastIndexOf + 1) : "?";
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
      if (!callerName) {
        return false;
      }

      if (typeof arguments[0] == "object") {
        return arguments[0].indexOf(callerName) > -1;
      }

      let args = Array.prototype.slice.call(arguments);
      return args.indexOf(callerName) > -1;
    } catch (ex) {
      this.assert(ex, "Error we can't check for caller name");
    }
    return false;
  },

  // @ts-expect-error - we are using 2 overloads to this function
  callerTrace: function TMP_console_callerTrace() {
    let stack = this._getStackExcludingInternal();

    let stackUtil = {
      contain(/** @type {string[]} */ ...names) {
        if (Array.isArray(names[0])) {
          names = names[0];
        }
        let _isCallerInList = function (/** @type {string} */ caller) {
          return names.some(name => caller.startsWith(name + "@"));
        };
        return stack.some(_isCallerInList);
      },
    };
    const args = Array.from(arguments);
    if (args.length) {
      return stackUtil.contain.apply(null, args);
    }
    return stackUtil;
  } /*

  options = {
    msg: msg
    log: true / false; default true
    function: true / false default false
    deep: true / false default false
    offset; for internal use only true / false default false
  }
  */,
  obj: function TMP_console_obj(aObj, aMessage, aDisallowLog, level) {
    if (!aObj || typeof aObj != "object") {
      let msg = "log.obj was called with non-object argument\n";
      if (aMessage) {
        msg += aMessage + "\n";
      }
      let type = aObj === null ? "null" : typeof aObj;
      msg += "typeof aObj is '" + type + "'\n'" + aObj + "'";
      if (!aDisallowLog) {
        logger.error(msg);
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
        if (type == "string") {
          val = "'" + val + "'";
        }

        if (type == "function" && typeof level == "string") {
          val = val.toString();
          let code = val.toString().indexOf("native code") > -1 ? "[native code]" : "[code]";
          val = val.slice(0, Math.max(val.indexOf("("), 0)) + "() { " + code + " }";
        }
        objS += offset + prop + "[" + type + "] =  " + val + "\n";
        if (type == "object" && val !== null && level && typeof level == "boolean") {
          objS += this.obj(val, "", true, "deep") + "\n";
        }
      } catch {
        objS += offset + prop + " =  [!!error retrieving property]\n";
      }
    }
    if (aDisallowLog) {
      objS = aMessage + "======================\\n" + objS;
    } else {
      let msg = aMessage + "=============== Object Properties ===============\n";
      logger.info(msg + objS);
    }
    return objS;
  },

  /* logMessage */

  error(error, message = "") {
    const isException = error instanceof Components.Exception;
    const isError = error instanceof Error;
    /** @type {LogModule.CustomErrorConstructorFn} */
    function CustomErrorImpl() {
      Object.assign(this, error);
      this.name = "Tabmix Error";
      const errorMessage = isException || isError ? error.message : String(error);
      this.message = `${message ? `\n${message}\n` : "\n"}${errorMessage};`;
      // @ts-expect-error - filename exist in Exception, fileName exist in Error
      const {filename, fileName, lineNumber, columnNumber} = error ?? {};
      this.fileName = filename ?? fileName;
      this.lineNumber = lineNumber;
      this.columnNumber = columnNumber;
    }
    /** @type {LogModule.CustomErrorConstructor} */
    var CustomError = /** @type {any} */ (CustomErrorImpl);
    CustomError.prototype = new Error();
    return new CustomError();
  },

  clog(aMessage, caller) {
    this.log(aMessage, false, false, caller);
  },

  log: function TMP_console_log(aMessage, aShowCaller, offset, caller) {
    if (caller) {
      // caller passed explicitly (show/obj paths) - use its name if we can
      const name = caller.name || caller.filename || "";
      logger.info(name ? `${name}: ${aMessage}` : aMessage);
      return;
    }
    offset = !offset ? 0 : 1;
    let names = this._getNames(aShowCaller ? 2 + offset : 1 + offset);
    let callerName = names[offset + 0];
    let callerCallerName =
      aShowCaller && names[offset + 1] ? " (caller was " + names[offset + 1] + ")" : "";
    logger.info(" " + callerName + callerCallerName + ":\n" + aMessage);
  },

  assert: function TMP_console_assert(aError, aMsg) {
    // @ts-expect-error - we are ok here
    if (!aError || typeof aError.stack != "string") {
      let msg = aMsg ? aMsg + "\n" : "";
      logger.error(msg + (aError || ""));
      return;
    }
    if (aError instanceof Components.Exception || aError instanceof Error) {
      this.reportError(aError, aMsg);
      return;
    }

    // @ts-expect-error - we get the right values here
    const {stack, message} = aError;
    let names = this._getNames(1, stack);
    let errAt = " at " + names[0];
    let assertionText = ` ERROR${errAt}:\n${aMsg ? aMsg + "\n" : ""}${message}`;
    logger.error(assertionText);
  },

  trace: function TMP_console_trace(aMsg, _flag = "infoFlag", _caller) {
    // `flag` and `caller` args are kept for compatibility with existing call
    // sites; severity is decided by the logger method, not by callers.
    let msg = aMsg ? aMsg + "\n" : "";
    if (msg) {
      logger.info(msg);
    }
    logger.trace();
  },

  get caller() {
    let parent = Components.stack.caller;
    parent = parent.name == "_logMessage" ? parent.caller.caller : parent.caller;
    if (parent?.name == "TMP_console_wrapper") {
      parent = parent.caller.caller;
    }

    return parent || {};
  },

  reportError(ex, msg = "", filter) {
    if (ex === null) {
      logger.error(msg || "reportError was called with null");
      return;
    }
    if (filter && (ex instanceof Components.Exception || ex instanceof Error)) {
      if (!ex.message || !ex.message.includes(filter)) {
        return;
      }
    }

    if (msg) {
      logger.error(msg, ex);
    } else {
      logger.error(ex);
    }
  },
};

(function (_this) {
  _this.reportError = _this.reportError.bind(_this);
})(console);
