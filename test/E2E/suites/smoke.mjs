/**
 * E2E smoke suite — proves the engine concept end to end:
 *
 * 1. A fresh profile is built (utils loader + unpacked addon copy + user.js).
 * 2. Firefox (Nightly by default) launches under puppeteer-core / BiDi.
 * 3. The userChromeJS bridge runs and opens the privileged client tab.
 * 4. Tab Mix Plus is active (`window.Tabmix` exists) in the main window.
 * 5. Basic tab operations work through gBrowser in the real window.
 * 6. Console is clean of addon errors (captured by the bridge).
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
  const exe = resolveBrowser(channel, binary);
  console.log(`Smoke suite — browser: ${exe}`);

  const profileDir = createProfileDir("smoke");
  populateProfile(profileDir);
  console.log(`  profile: ${profileDir}`);

  const procLogs = [];
  let browser = null;
  let processTag = null;
  let bridgePage;

  try {
    ({browser, processTag} = await launchFirefox({binary: exe, profileDir, headless}));
    attachProcessLogging(browser, procLogs);

    // Attach to the privileged client tab opened by the .uc.js bridge.
    bridgePage = await openBridgePage(browser);
    check(counter, true, "attached to the privileged E2E client tab over BiDi");

    // 1. The bridge script ran in the main window (marker + console capture).
    const bridge = await waitForValueInMain(
      bridgePage,
      "typeof window.__tabmixE2E !== 'undefined'",
      30_000
    );
    check(counter, Boolean(bridge), "tabmix-e2e bridge is injected (userChromeJS loader ran)");

    // Browser identity for the run log: name, version, update channel, OS.
    const info = await readBrowserInfo(evalAsyncInMain, bridgePage);
    console.log(
      `  browser under test: ${BROWSER_NAMES[channelKey] ?? "custom binary"} ` +
        `${info.version} (update channel: ${info.channel}, ${info.os})`
    );

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
    await evalAsyncInMain(
      bridgePage,
      `
      if (window.Tabmix?.promiseOverlayLoaded) {
        await window.Tabmix.promiseOverlayLoaded;
      }
    `
    ).catch(() => {});

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

    // 5. Screenshot artifact (best effort).
    const shot = await screenshotMain(bridgePage);
    if (shot) {
      const fs = await import("node:fs");
      const out = path.join(artifactsDir(), `smoke-${Date.now()}.png`);
      fs.writeFileSync(out, Buffer.from(shot.split(",")[1], "base64"));
      console.log(`  screenshot: ${path.relative(process.cwd(), out)}`);
    }
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
    await closeBrowser(browser, processTag ? [processTag] : []);
    if (!keepProfile) {
      deleteProfile(profileDir);
    } else {
      console.log(`  profile kept: ${profileDir}`);
    }
  }

  return summary(counter);
}
