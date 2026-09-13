/*
 * chrome-sandbox script (userChromeJS) - not a module. Timestamps and the
 * console service handle below are intentional for this environment.
 */
/* eslint-disable strict, mozilla/avoid-Date-timing, mozilla/use-services */

// ==UserScript==
// @name         tabmix-e2e bridge
// @description  Privileged bridge for the Tab Mix Plus E2E engine: window
//               marker on the real chrome window + console error capture
//               through Services.console.
// @author       tabmix-e2e
// @include      main
// @onlyonce
// ==/UserScript==

/*
 * Runs inside the userChromeJS SANDBOX on every "main" (browser.xhtml) window.
 * In this sandbox the top-level `window`/`gBrowser` may not be the real chrome
 * window, so everything is resolved through Services.wm instead (same approach
 * the reference restart.uc.js uses inside its observers).
 *
 * Responsibilities:
 *   1. set `window.__tabmixE2E` on the REAL browser window (marker + console
 *      buffers the Node runner reads via the client page),
 *   2. register a Services.console listener (once per process) that records
 *      errors/exceptions so suites can assert "zero console errors",
 *   3. open the privileged client page in a background trusted tab (best
 *      effort — the runner can also navigate to it itself).
 *
 * IMPORTANT: this script must never modify Tabmix behavior; it only observes
 * and provides test infrastructure.
 */

(function () {
  // Resolve the REAL browser window (sandbox `window` is not reliable).
  let w = null;
  try {
    w = Services.wm.getMostRecentWindow("navigator:browser");
  } catch {
    // fallthrough
  }
  if (!w) {
    try {
      w = window;
    } catch {
      return;
    }
  }
  if (w.__tabmixE2E) {
    return; // already injected in this window
  }

  const CLIENT_URL = "chrome://tabmix-e2e/content/client.xhtml";

  w.__tabmixE2E = {
    injectedAt: Date.now(),
    consoleErrors: [],
    consoleMessages: [],
    clientTabOpened: false,
    errors: [], // bridge-internal errors, for debugging the bridge itself
  };

  // ── 1. open the client page in a background trusted tab (best effort) ──
  try {
    w.gBrowser.addTrustedTab(CLIENT_URL, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    // Keep it in the background; suites find it via window.__e2eClient.
    w.gBrowser.selectedTab = w.gBrowser.tabs[0];
    w.__tabmixE2E.clientTabOpened = true;
  } catch (e) {
    w.__tabmixE2E.errors.push("client tab failed: " + e);
  }

  // ── 2. console capture (once per process) ─────────────────────────────
  try {
    const ConsoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
    const listener = {
      observe(message) {
        try {
          let text = "";
          let level = "log";
          if (message instanceof Ci.nsIScriptError) {
            text = `${message.errorMessage || message.toString()} (${message.sourceName}:${message.lineNumber})`;
            level = message.flags & Ci.nsIScriptError.warningFlag ? "warning" : "error";
            if (message.flags & Ci.nsIScriptError.exceptionFlag) level = "exception";
          } else {
            text = message.message ?? String(message);
          }
          const entry = {time: Date.now(), level, text: String(text).slice(0, 1000)};
          // record on every browser window that has the bridge marker
          for (const win of Services.wm.getEnumerator("navigator:browser")) {
            if (win.__tabmixE2E) {
              win.__tabmixE2E.consoleMessages.push(entry);
              if (level === "error" || level === "exception") {
                win.__tabmixE2E.consoleErrors.push(entry);
              }
            }
          }
        } catch {
          // never break the console service
        }
      },
      QueryInterface: ChromeUtils.generateQI(["nsIObserver"]),
    };
    // Only register once per process: mark the console service itself.
    if (!w.__tabmixE2EProcessListener) {
      w.__tabmixE2EProcessListener = true; // window-level, may repeat per window
      ConsoleService.registerListener(listener);
      w.__tabmixE2E.consoleListener = listener;
    }
  } catch (e) {
    w.__tabmixE2E.errors.push("console listener failed: " + e);
  }
})();
