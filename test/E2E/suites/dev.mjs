/**
 * E2E dev-line suite — covers the dev-v1.48 changes that unit tests cannot
 * reach, in the real browser (P1 tier in docs/test-plan.md):
 *
 * 1. Autoreload popup keyed by data-command (f42b4a34): onPopupShowing finds the
 *    enable item by `data-command="toggle"` — the same key the command listener
 *    dispatches on — and a dispatched command event toggles the tab through the
 *    full _enable/_disable path. This is the regression gate for the "find by
 *    DOM position" bug class: reorder the popup items and this suite must still
 *    pass.
 * 2. Dead-code sweep (e597603d + a7c481fa): the removed code shapes are really
 *    gone at runtime — no deprecated `.substr(` call sites in the swept files,
 *    no Tabmix.nonStrictMode (AVG/Greasemonkey branch deleted), and
 *    DynamicRules keeps no dead orient/windows10 state fields. These assertions
 *    intentionally also hold on wip/error-handling-logging, which removes a
 *    strict superset (logger rewrite, clog/isCallerInList, TabmixSvc.console
 *    alias, log.sys.mjs rename).
 *
 * Static/VM counterpart: the boot must be error-free before any probe runs.
 */

import {createCounter, check, summary} from "../shared/assert.mjs";
import {
  resolveBrowser,
  DEFAULT_BROWSER,
  BROWSER_NAMES,
  readBrowserInfo,
} from "../shared/config.mjs";
import {createProfileDir, populateProfile, deleteProfile} from "../shared/profileFactory.mjs";
import {launchFirefox, attachProcessLogging, closeBrowser} from "../shared/launch.mjs";
import {
  openBridgePage,
  evalInMain,
  evalAsyncInMain,
  waitForValueInMain,
} from "../shared/bridgeClient.mjs";

export const name = "dev";

const BENIGN_BOOT_ERRORS =
  /RSLoader|RemoteSettings|PrivateBrowsingUtils|occlusion|onboarding|telemetry|GMP|WebMIDI|autofill/i;

/**
 * Section 1 — autoreload popup: data-command lookup + full toggle round-trip.
 *
 * @param {object} counter - shared counter
 * @param {object} bridgePage - the privileged client tab
 */
async function checkAutoReload(counter, bridgePage) {
  const autoReload = await evalAsyncInMain(
    bridgePage,
    `
      const result = {};
      try {
        const popup = document.getElementById("autoreload_popup");
        if (!popup) throw new Error("autoreload_popup not found (overlay missing)");

        // The enable item must be reachable by data-command="toggle" — the
        // same key the command listener dispatches on (the f42b4a34 fix).
        const enableItem = popup.getElementsByAttribute("data-command", "toggle")[0];
        result.toggleItemExists = Boolean(enableItem);
        if (!enableItem) throw new Error("no data-command=toggle item in autoreload_popup");

        const tab = gBrowser.addTab("data:text/html,tabmix-e2e-autoreload", {
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        });
        // keep any residue timer far away; the suite disables before leaving
        tab.autoReloadTime = 3600;
        // wait for the data: URL to load — _enable() bails while the tab
        // still points at about:blank (its about: guard), which would make
        // every toggle below a silent no-op
        await new Promise(resolve => {
          const started = Date.now();
          const checkLoaded = () => {
            if (tab.linkedBrowser?.currentURI?.spec.startsWith("data:") || Date.now() - started > 5000) {
              resolve();
              return;
            }
            setTimeout(checkLoaded, 100);
          };
          checkLoaded();
        });
        result.urlLoaded = tab.linkedBrowser?.currentURI?.spec.startsWith("data:");

        // onPopupShowing wires listeners, initializes the tab and labels the
        // item — this is the fixed lookup path (was menuItems[2]).
        Tabmix.autoReload.onPopupShowing(popup, tab);
        result.tabInitialized = tab.autoReloadEnabled === false;
        result.labelFromItemAttrs = enableItem.getAttribute("label") || "";
        result.labelsRead = Boolean(
          enableItem.getAttribute("minute") &&
          enableItem.getAttribute("seconds")
        );

        // Dispatch a real command event through the popup listener, exactly
        // like clicking the menu item: toggle on.
        const dispatchToggle = () => {
          const item = document.createXULElement("menuitem");
          item.setAttribute("data-command", "toggle");
          popup.appendChild(item);
          item.dispatchEvent(new window.Event("command", {bubbles: true}));
          item.remove();
        };
        dispatchToggle();
        result.enabledAfterToggle = tab.autoReloadEnabled === true;
        result.reloadAttrSet = tab.hasAttribute("_reload");

        // And toggle back off — full round-trip, no timer left behind.
        dispatchToggle();
        result.disabledAfterSecondToggle = tab.autoReloadEnabled === false;
        result.reloadAttrCleared = !tab.hasAttribute("_reload");

        gBrowser.removeTab(tab);
        result.ok = true;
      } catch (e) {
        result.ok = false;
        result.error = String(e);
      }
      return result;
    `
  );
  check(
    counter,
    autoReload?.ok === true,
    "autoreload popup round-trip completed without exception",
    autoReload?.error
  );
  check(
    counter,
    autoReload?.urlLoaded === true,
    "data: tab finished loading (toggle guard precondition)"
  );
  check(
    counter,
    autoReload?.toggleItemExists === true,
    "enable item found by data-command=toggle (not DOM position)"
  );
  check(
    counter,
    autoReload?.tabInitialized === true,
    "onPopupShowing initialized the tab (autoReloadEnabled=false)"
  );
  check(
    counter,
    Boolean(autoReload?.labelFromItemAttrs) && autoReload?.labelsRead === true,
    "enable item label built from its own minute/seconds attributes"
  );
  check(
    counter,
    autoReload?.enabledAfterToggle === true && autoReload?.reloadAttrSet === true,
    "dispatched toggle command enabled auto-reload (_reload attr set)"
  );
  check(
    counter,
    autoReload?.disabledAfterSecondToggle === true && autoReload?.reloadAttrCleared === true,
    "second toggle disabled auto-reload and cleared the state (no timer leak)"
  );
}

/**
 * Section 2 — dead-code sweep (e597603d + a7c481fa): the removed code shapes
 * are really gone at runtime. Every assertion here also holds on
 * wip/error-handling-logging, which removes a strict superset (the logger
 * rewrite, clog/isCallerInList, the TabmixSvc.console alias), so the suite
 * keeps passing after the logger rebase.
 *
 * @param {object} counter - shared counter
 * @param {object} bridgePage - the privileged client tab
 */
async function checkDeadCodeSweep(counter, bridgePage) {
  // Files whose .substr( call sites the sweep replaced with .slice().
  // chrome://tabmix-resource/content/ = addon/modules, chrome://tabmixplus/
  // = addon/chrome/content. log.sys.mjs only exists pre-rename (dev); missing
  // files are skipped so the list stays valid after the logger rename too.
  const SWEPT_FILES = [
    "chrome://tabmixplus/content/click/click.js",
    "chrome://tabmixplus/content/minit/tablib.js",
    "chrome://tabmixplus/content/tab/tab.js",
    "chrome://tabmixplus/content/tabmix.js",
    "chrome://tabmixplus/content/utils.js",
    "chrome://tabmix-resource/content/Changecode.sys.mjs",
    "chrome://tabmix-resource/content/ContentClick.sys.mjs",
    "chrome://tabmix-resource/content/DynamicRules.sys.mjs",
    "chrome://tabmix-resource/content/TabmixSvc.sys.mjs",
    "chrome://tabmix-resource/content/log.sys.mjs",
  ];

  const sweep = await evalAsyncInMain(
    bridgePage,
    `
      const urls = ${JSON.stringify(SWEPT_FILES)};
      const result = {};
      try {
        // 1. No deprecated .substr( call site survives in any swept file.
        result.substrOffenders = [];
        for (const url of urls) {
          // fetch REJECTS (NetworkError) for chrome:// URLs that do not
          // resolve (e.g. a renamed file) — treat that as "not in this build".
          const response = await fetch(url).catch(() => null);
          if (!response || !response.ok) continue; // file not in this build
          if (/\\.substr\\(/.test(await response.text())) {
            result.substrOffenders.push(url);
          }
        }

        // 2. nonStrictMode helper deleted with the AVG/Greasemonkey branch.
        result.nonStrictModeGone = typeof window.Tabmix.nonStrictMode === "undefined";

        // 3. DynamicRules (a7c481fa): no dead orient/windows10 state fields,
        //    module still initializes (its orient MUTATION OBSERVER stays).
        const {DynamicRules} = ChromeUtils.importESModule(
          "chrome://tabmix-resource/content/DynamicRules.sys.mjs"
        );
        result.dynamicRulesNoDeadState =
          !Object.hasOwn(DynamicRules, "orient") &&
          !Object.hasOwn(DynamicRules, "windows10");
        result.dynamicRulesAlive = typeof DynamicRules.init === "function";

        result.ok = true;
      } catch (e) {
        result.ok = false;
        result.error = String(e);
      }
      return result;
    `
  );
  check(
    counter,
    sweep?.ok === true,
    "dead-code sweep probe completed without exception",
    sweep?.error
  );
  check(
    counter,
    Array.isArray(sweep?.substrOffenders) && sweep.substrOffenders.length === 0,
    "no .substr( call sites remain in the swept addon files",
    (sweep?.substrOffenders ?? []).join(", ")
  );
  check(
    counter,
    sweep?.nonStrictModeGone === true,
    "Tabmix.nonStrictMode is gone (AVG/Greasemonkey branch removed)"
  );
  check(
    counter,
    sweep?.dynamicRulesNoDeadState === true && sweep?.dynamicRulesAlive === true,
    "DynamicRules has no orient/windows10 state fields and still initializes"
  );
}

/**
 * @param {object} opts
 * @param {string} [opts.browser] - channel name (nightly/dev/beta/release/esr)
 * @param {string} [opts.binary] - explicit binary path
 * @param {boolean} [opts.headless=true] Default is `true`
 * @param {boolean} [opts.keepProfile=false] Default is `false`
 * @param {boolean} [opts.keepOpen=false] leave the browser open after the suite
 *   for manual inspection (--keep-open); teardown resumes on window close.
 *   Default is `false`
 * @returns {Promise<boolean>} success
 */
export async function run({
  browser: channel,
  binary,
  headless = true,
  keepProfile = false,
  keepOpen = false,
} = {}) {
  const counter = createCounter();
  const channelKey = channel || DEFAULT_BROWSER;
  const exe = await resolveBrowser(channel, binary);
  console.log(`Dev-line suite — browser: ${exe}`);

  const profileDir = createProfileDir("dev");

  let browser = null;
  let processTags = null;
  let bridgePage;

  try {
    // Inside the try: a populateProfile() failure must hit the finally-block
    // cleanup, not leak the copied profile in the system temp directory.
    await populateProfile(profileDir);
    console.log(`  profile: ${profileDir}`);

    ({browser, processTags} = await launchFirefox({binary: exe, profileDir, headless}));
    attachProcessLogging(browser, []);

    bridgePage = await openBridgePage(browser);
    check(counter, true, "attached to the privileged E2E client tab over BiDi");

    const bridge = await waitForValueInMain(
      bridgePage,
      "typeof window.__tabmixE2E !== 'undefined'",
      30_000
    );
    check(counter, Boolean(bridge), "tabmix-e2e bridge is injected (userChromeJS loader ran)");

    const info = await readBrowserInfo(evalAsyncInMain, bridgePage);
    console.log(
      `  browser under test: ${BROWSER_NAMES[channelKey] ?? "custom binary"} ` +
        `${info.version} (update channel: ${info.channel}, ${info.os})`
    );

    const tabmix = await waitForValueInMain(
      bridgePage,
      "typeof window.Tabmix !== 'undefined'",
      45_000
    );
    check(counter, Boolean(tabmix), "window.Tabmix exists (addon bootstrap ran)");

    await evalAsyncInMain(
      bridgePage,
      `
      if (window.Tabmix?.promiseOverlayLoaded) {
        await window.Tabmix.promiseOverlayLoaded;
      }
    `
    ); // ── 0. Boot is clean BEFORE any probe writes to the console ──
    const consoleErrors = await evalInMain(bridgePage, "window.__tabmixE2E.consoleErrors");
    const realErrors = (consoleErrors || []).filter(e => !BENIGN_BOOT_ERRORS.test(e.text));
    check(
      counter,
      realErrors.length === 0,
      "no console errors at startup",
      realErrors.map(e => e.text.slice(0, 200)).join(" | ")
    );
    if (realErrors.length) {
      console.log("  console errors:");
      for (const e of realErrors) console.log(`    - ${e.text.slice(0, 200)}`);
    }

    // ── 1. Autoreload popup: data-command lookup + full toggle round-trip ──
    await checkAutoReload(counter, bridgePage);

    // ── 2. Dead-code sweep: removed paths are gone at runtime ──
    await checkDeadCodeSweep(counter, bridgePage);
  } catch (err) {
    check(counter, false, "dev suite completed without exception", String(err));
  } finally {
    await closeBrowser(browser, processTags ?? [], keepOpen);
    if (!keepProfile) {
      deleteProfile(profileDir);
    } else {
      console.log(`  profile kept: ${profileDir}`);
    }
  }

  return summary(counter);
}
