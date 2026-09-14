/**
 * E2E smoke suite — the permanent "is Tabmix alive on Firefox X?" gate: run
 * after every Firefox update and before every merge (P0 tier in
 * docs/test-plan.md).
 *
 * 1. A fresh profile is built (utils loader + unpacked addon copy + user.js).
 * 2. Firefox (Nightly by default) launches under puppeteer-core / BiDi.
 * 3. The userChromeJS bridge runs and opens the privileged client tab — failing
 *    here means the TEST INFRA broke, not Tabmix.
 * 4. Tab Mix Plus is active (`window.Tabmix` exists) in the main window — failing
 *    here is the early warning that a Firefox update broke the addon
 *    bootstrap.
 * 5. Basic tab operations work through gBrowser in the real window.
 * 6. Console is clean of addon errors (captured by the bridge) — catches failed
 *    getPrivateMethod reconstructions and sandbox scope changes at boot.
 */

import path from "node:path";
import {createCounter, check, summary} from "../shared/assert.mjs";
import {
  resolveBrowser,
  ARTIFACTS_DIR,
  DEFAULT_BROWSER,
  BROWSER_NAMES,
  readBrowserInfo,
} from "../shared/config.mjs";
import {
  createProfileDir,
  populateProfile,
  deleteProfile,
  artifactsDir,
} from "../shared/profileFactory.mjs";
import {launchFirefox, attachProcessLogging, closeBrowser} from "../shared/launch.mjs";
import {
  openBridgePage,
  evalInMain,
  evalAsyncInMain,
  waitForValueInMain,
  screenshotMain,
} from "../shared/bridgeClient.mjs";

export const name = "smoke";

/**
 * @param {object} opts
 * @param {string} [opts.browser] - channel name (nightly/dev/beta/release/esr)
 * @param {string} [opts.binary] - explicit binary path
 * @param {boolean} [opts.headless=true] Default is `true`
 * @param {boolean} [opts.keepProfile=false] Default is `false`
 * @returns {Promise<boolean>} success
 */
export async function run({browser: channel, binary, headless = true, keepProfile = false} = {}) {
  const counter = createCounter();
  const channelKey = channel || DEFAULT_BROWSER;
  const exe = await resolveBrowser(channel, binary);
  console.log(`Smoke suite — browser: ${exe}`);

  const profileDir = createProfileDir("smoke");

  // Phase timing marks - printed only with --timing (or TMP_E2E_TIMING=1).
  const phases = [];
  const timing = process.env.TMP_E2E_TIMING === "1";
  const runStart = Date.now();
  let phaseStart = runStart;
  const mark = label => {
    const now = Date.now();
    phases.push({name: label, ms: now - phaseStart});
    phaseStart = now;
  };
  const printTimings = () => {
    if (!timing) return;
    console.log("  phase timings:");
    for (const p of phases) console.log(`    ${String(p.ms).padStart(6)}ms  ${p.name}`);
    console.log(`    ${String(Date.now() - runStart).padStart(6)}ms  total`);
  };

  const procLogs = [];
  let browser = null;
  let processTag = null;
  let bridgePage;

  try {
    // Inside the try: a populateProfile() failure must hit the finally-block
    // cleanup, not leak the copied profile in the system temp directory.
    populateProfile(profileDir);
    console.log(`  profile: ${profileDir}`);

    mark("profile setup (before launch)");
    ({browser, processTag} = await launchFirefox({binary: exe, profileDir, headless}));
    mark("firefox launch (puppeteer attach)");
    attachProcessLogging(browser, procLogs);

    // Attach to the privileged client tab opened by the .uc.js bridge.
    bridgePage = await openBridgePage(browser);
    mark("bridge tab attach");
    check(counter, true, "attached to the privileged E2E client tab over BiDi");

    // 1. The bridge script ran in the main window (marker + console capture).
    const bridge = await waitForValueInMain(
      bridgePage,
      "typeof window.__tabmixE2E !== 'undefined'",
      30_000
    );
    check(counter, Boolean(bridge), "tabmix-e2e bridge is injected (userChromeJS loader ran)");
    mark("bridge marker wait");

    // Browser identity for the run log: name, version, update channel, OS.
    const info = await readBrowserInfo(evalAsyncInMain, bridgePage);
    console.log(
      `  browser under test: ${BROWSER_NAMES[channelKey] ?? "custom binary"} ` +
        `${info.version} (update channel: ${info.channel}, ${info.os})`
    );
    mark("tabmix bootstrap wait (window.Tabmix + overlay)");

    // 2. Tab Mix Plus active?
    const tabmix = await waitForValueInMain(
      bridgePage,
      `(() => {
      if (typeof window.Tabmix === "undefined") return null;
      return {
        hasIsVersion: typeof window.Tabmix.isVersion === "function",
        promiseOverlayLoaded: typeof window.Tabmix.promiseOverlayLoaded?.then === "function",
        firefoxVersion: Services.appinfo.version,
        versionBucket: window.Tabmix.isVersion(156) ? "156+" : "pre-156",
      };
    })()`,
      45_000
    );
    check(counter, Boolean(tabmix), "window.Tabmix exists (addon bootstrap ran)");
    check(counter, Boolean(tabmix?.hasIsVersion), "Tabmix.isVersion is a function");
    check(counter, Boolean(tabmix?.promiseOverlayLoaded), "Tabmix.promiseOverlayLoaded exposed");
    if (tabmix?.versionBucket) {
      console.log(
        `  isVersion bucket: ${tabmix.versionBucket} (Firefox ${tabmix.firefoxVersion ?? "?"}) — ` +
          (tabmix.versionBucket === "156+" ?
            "addon runs the private-method / moz-src code paths"
          : "addon runs the legacy tabbrowser.js code paths")
      );
    }

    // 3. Wait for the addon overlay to finish, then exercise gBrowser.
    // NOT caught: a rejected promiseOverlayLoaded means the overlay failed to
    // load — the suite must record a failure even if basic gBrowser calls
    // would still succeed.
    await evalAsyncInMain(
      bridgePage,
      `
      if (window.Tabmix?.promiseOverlayLoaded) {
        await window.Tabmix.promiseOverlayLoaded;
      }
    `
    );

    const tabTest = await evalAsyncInMain(
      bridgePage,
      `
      const results = {};
      try {
        results.tabCountBefore = gBrowser.tabs.length;
        const tab = gBrowser.addTab("about:config", {
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        });
        gBrowser.selectedTab = tab;
        results.tabCountAfter = gBrowser.tabs.length;
        results.selectedIsNew = gBrowser.selectedTab === tab;
        results.tabmixTabsUtils = typeof Tabmix.tabsUtils !== "undefined";
        gBrowser.removeTab(tab);
        results.tabCountClosed = gBrowser.tabs.length;
        results.ok = true;
      } catch (e) {
        results.ok = false;
        results.error = String(e);
      }
      return results;
    `
    );
    check(counter, tabTest?.ok === true, "gBrowser addTab/removeTab works", tabTest?.error);
    check(counter, tabTest?.tabCountAfter === tabTest?.tabCountBefore + 1, "tab count incremented");
    check(counter, tabTest?.selectedIsNew === true, "new tab became selected");
    check(counter, tabTest?.tabCountClosed === tabTest?.tabCountBefore, "tab removed again");
    check(counter, tabTest?.tabmixTabsUtils === true, "Tabmix.tabsUtils is available");
    mark("gBrowser tab operations");

    // 4. Console errors captured by the bridge (ignoring benign noise).
    const consoleErrors = await evalInMain(bridgePage, "window.__tabmixE2E.consoleErrors");
    const benign =
      /RSLoader|RemoteSettings|PrivateBrowsingUtils|occlusion|onboarding|telemetry|GMP|WebMIDI|autofill/i;
    const realErrors = (consoleErrors || []).filter(e => !benign.test(e.text));
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
    mark("console error check");

    // 5. Screenshot artifact (best effort).
    const shot = await screenshotMain(bridgePage);
    if (shot) {
      const fs = await import("node:fs");
      const out = path.join(artifactsDir(), `smoke-${Date.now()}.png`);
      fs.writeFileSync(out, Buffer.from(shot.split(",")[1], "base64"));
      console.log(`  screenshot: ${path.relative(process.cwd(), out)}`);
    }
    mark("screenshot");
  } catch (err) {
    check(counter, false, "smoke suite completed without exception", String(err));
    try {
      const fs = await import("node:fs");
      fs.mkdirSync(ARTIFACTS_DIR, {recursive: true});
      const logPath = path.join(ARTIFACTS_DIR, `smoke-failure-${Date.now()}.log`);
      fs.writeFileSync(logPath, procLogs.join("\n"));
      console.error(`  process log written to: ${logPath}`);
    } catch {
      // ignore
    }
  } finally {
    mark("teardown start");
    await closeBrowser(browser, processTag ? [processTag] : []);
    mark("browser close");
    if (!keepProfile) {
      deleteProfile(profileDir);
    } else {
      console.log(`  profile kept: ${profileDir}`);
    }
    mark("profile cleanup");
    printTimings();
  }

  return summary(counter);
}
