// VERSION 2.4.1
// Modules.UTILS = true;
// Modules.BASEUTILS = true;

/* eslint curly: 2 */
"use strict";

this.EXPORTED_SYMBOLS = ["Windows"];
Cu.import("resource://gre/modules/Services.jsm", this);

function callOnLoad(aSubject, aCallback, beforeComplete) {
  if (aSubject.document.readyState == "complete" || beforeComplete) {
    try {
      aCallback(aSubject);
    } catch (ex) {
      Cu.reportError(ex);
    }
    return;
  }

  listenOnce(
    aSubject,
    "load",
    () => {
      try {
        aCallback(aSubject);
      } catch (ex) {
        Cu.reportError(ex);
      }
    },
    false
  );
}

let onceListeners = [];

function listenOnce(aSubject, type, handler, capture) {
  if (!aSubject || !aSubject.addEventListener) {
    return;
  }

  const runOnce = function(event) {
    try {
      aSubject.removeEventListener(type, runOnce, capture);
    } catch (ex) {
      handleDeadObject(ex);
    } // Prevents some can't access dead object errors
    if (event !== undefined) {
      removeOnceListener(runOnce);
      try {
        handler(event, aSubject);
      } catch (ex) {
        Cu.reportError(ex);
      }
    }
  };

  aSubject.addEventListener(type, runOnce, capture);

  const weak = Cu.getWeakReference(runOnce);
  onceListeners.push(weak);
}

function handleDeadObject(ex) {
  if (ex.message == "can't access dead object") {
    const scriptError = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
    scriptError.init(
      "Can't access dead object. This shouldn't cause any problems.",
      ex.sourceName || ex.fileName || null,
      ex.sourceLine || null,
      ex.lineNumber || null,
      ex.columnNumber || null,
      scriptError.warningFlag,
      "XPConnect JavaScript"
    );
    Services.console.logMessage(scriptError);
    return true;
  }
  Cu.reportError(ex);
  return false;
}

function removeOnceListener(oncer) {
  for (let i = 0; i < onceListeners.length; i++) {
    const unwrapped = onceListeners[i].get();

    // clean up dead weak ref
    if (!unwrapped) {
      onceListeners.splice(i, 1);
      i--;
    } else if (!oncer) {
      unwrapped();
    } else if (unwrapped == oncer) {
      onceListeners.splice(i, 1);
    }
  }

  if (!oncer) {
    onceListeners = [];
  }
}

// Windows - Aid object to help with window tasks involving window-mediator and window-watcher
// getEnumerator(aType) - returns an nsISimpleEnumerator object with all windows of aType
//	(optional) aType - (string) window type to get, defaults to null (all)
// callOnMostRecent(aCallback, aType, aURI) - calls aCallback passing it the most recent window of aType as an argument. If successful it returns the return value of aCallback.
//	aCallback - (function(window)) to be called on window
//	(optional) aType - type of windows to execute aCallback on, defaults to null (all)
//	(optional) aURI - (string) when defined, checks the documentURI property against the aURI value and only executes aCallback when true, defaults to null
// callOnAll(aCallback, aType, aURI, beforeComplete) - goes through every opened browser window of aType and executes aCallback on it
//	(optional) beforeComplete - true calls aCallback immediatelly regardless of readyState, false fires aCallback when window loads if readyState != complete, defaults to false.
//	see callOnMostRecent()
// register(aHandler, aTopic, aType, aURI, beforeComplete) - registers aHandler to be notified of every aTopic
//	aHandler - (function(aWindow)) handler to be fired. Or (nsiObserver object) with observe() method which will be passed aWindow and aTopic as its only two arguments.
//	aTopic - (string) "domwindowopened" or (string) "domwindowclosed"
//	(optional) beforeComplete -	See callOnAll()
//					Note that regardless of this value, if you set aType, no callback will be performed before the window is loaded because the windowtype attribute
//					won't be loaded yet! In some cases even the URI might not be loaded either so there's no point in setting this at all.
//	see callOnMostRecent() and callOnAll()
// unregister(aHandler, aTopic, aType, aURI, beforeComplete) - unregisters aHandler from being notified of every aTopic
//	see register()
// watching(aHandler, aTopic, aType, aURI, beforeComplete) - 	returns (int) with corresponding watcher index in watchers[] if aHandler has been registered for aTopic
//								returns (bool) false otherwise
//	see register()
this.Windows = {
  watchers: [],

  getEnumerator(aType) {
    return Services.wm.getEnumerator(aType || null);
  },

  callOnMostRecent(aCallback, aType, aURI) {
    const type = aType || null;
    if (aURI) {
      const browserEnumerator = this.getEnumerator(type);
      while (browserEnumerator.hasMoreElements()) {
        const win = browserEnumerator.getNext();
        if (
          win.document.documentURI.startsWith(aURI) &&
          win.document.readyState == "complete"
        ) {
          return aCallback(win);
        }
      }
      return null;
    }

    const window = Services.wm.getMostRecentWindow(type);
    if (window) {
      return aCallback(window);
    }
    return null;
  },

  // expects aCallback() and sets its this as the window
  callOnAll(aCallback, aType, aURI, beforeComplete) {
    const browserEnumerator = this.getEnumerator(aType);
    while (browserEnumerator.hasMoreElements()) {
      const window = browserEnumerator.getNext();
      if (!aURI || window.document.documentURI.startsWith(aURI)) {
        callOnLoad(window, aCallback, beforeComplete);
      }
    }
  },

  register(aHandler, aTopic, aType, aURI, beforeComplete) {
    if (this.watching(aHandler, aTopic, aType, aURI, beforeComplete) === false) {
      this.watchers.push({
        handler: aHandler,
        topic: aTopic,
        type: aType || null,
        uri: aURI || null,
        beforeComplete: beforeComplete || false,
      });
    }
  },

  unregister(aHandler, aTopic, aType, aURI, beforeComplete) {
    const i = this.watching(aHandler, aTopic, aType, aURI, beforeComplete);
    if (i !== false) {
      this.watchers.splice(i, 1);
    }
  },

  watching(aHandler, aTopic, aType, aURI, beforeComplete) {
    const type = aType || null;
    const uri = aURI || null;
    const before = beforeComplete || false;

    for (let i = 0; i < this.watchers.length; i++) {
      if (
        this.watchers[i].handler == aHandler &&
        this.watchers[i].topic == aTopic &&
        this.watchers[i].type == type &&
        this.watchers[i].uri == uri &&
        this.watchers[i].beforeComplete == before
      ) {
        return i;
      }
    }
    return false;
  },

  observe(aSubject, aTopic, noBefore) {
    let scheduleOnLoad = false;

    for (const watcher of this.watchers) {
      // 'windowtype' attr is undefined until the window loads
      if (!noBefore && aSubject.document.readyState != "complete" && watcher.type) {
        scheduleOnLoad = true;
      }

      if (
        watcher.topic == aTopic &&
        (!watcher.type ||
          aSubject.document.documentElement.getAttribute("windowtype") == watcher.type) &&
        (!watcher.uri || aSubject.document.documentURI.startsWith(watcher.uri))
      ) {
        if (noBefore) {
          // don't run this handler if it's been run before
          if (!watcher.beforeComplete) {
            if (watcher.handler.observe) {
              watcher.handler.observe(aSubject, aTopic);
            } else {
              watcher.handler(aSubject);
            }
          }
        } else if (aSubject.document.readyState == "complete" || watcher.beforeComplete) {
          if (watcher.handler.observe) {
            watcher.handler.observe(aSubject, aTopic);
          } else {
            watcher.handler(aSubject);
          }
        }
      }
    }

    if (scheduleOnLoad) {
      callOnLoad(aSubject, aWindow => {
        this.observe(aWindow, aTopic, true);
      });
    }
  },
};
