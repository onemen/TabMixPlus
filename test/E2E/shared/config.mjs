/**
 * E2E shared config — browsers, paths, launch prefs.
 *
 * Browser binaries follow
 * C:\code\TabMixPlus-Hub\firefox-updater\src\helpers\paths.js (all installed on
 * this machine). A local override file `test/E2E/shared/config.local.mjs` may
 * export a partial deep patch.
 */

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

export const TEST_DIR = fileURLToPath(new URL("../..", import.meta.url)); // test/E2E
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url)); // TabMixPlus/
export const ADDON_DIR = path.join(REPO_ROOT, "addon");

/**
 * Firefox install roots per firefox-updater paths.js (dirs containing
 * firefox.exe).
 */
export const FIREFOX_BINARIES = {
  nightly: "C:/Program Files/Firefox Nightly/firefox.exe",
  dev: "C:/Program Files/Firefox Developer Edition/firefox.exe",
  beta: "C:/Program Files/Mozilla/Firefox Beta/firefox.exe",
  release: "C:/Program Files/Mozilla/Firefox/firefox.exe",
  esr: "C:/Program Files/Mozilla/Firefox ESR/firefox.exe",
};

export const DEFAULT_BROWSER = process.env.TMP_E2E_BROWSER || "nightly";

export const ARTIFACTS_DIR = path.join(TEST_DIR, "e2e", "artifacts");

/** Default profile prefs for every launched test instance. */
export const PROFILE_PREFS = {
  // Firefox 137+: BiDi / CDP need remote agent access from automation;
  // puppeteer passes -remote-allow-system-access but keep this explicit.
  "remote.active-protocols": 3,

  // Sideloading: the extension is copied into profile/extensions/{id}
  // (unpacked dir). Auto-enable it without any XPInstall prompts.
  "extensions.autoDisableScopes": 0,
  "extensions.enabledScopes": 15,
  "extensions.install_origins.enabled": false,
  "xpinstall.signatures.required": false,

  // Fast, deterministic startup for tests.
  "browser.shell.checkDefaultBrowser": false,
  "browser.startup.homepage_override.mstone": "ignore",
  "browser.aboutwelcome.enabled": false,
  "browser.startup.page": 0,
  "datareporting.policy.dataSubmissionEnabled": false,
  "datareporting.healthreport.uploadEnabled": false,
  "app.shield.optoutstudies.enabled": false,
  "toolkit.telemetry.reportingpolicy.firstRun": false,
  "browser.newtabpage.activity-stream.feeds.telemetry": false,
  "browser.newtabpage.activity-stream.telemetry": false,
  "toolkit.telemetry.enabled": false,
  "toolkit.telemetry.unified": false,
  "extensions.update.enabled": false,
  "app.update.auto": false,
  "app.update.enabled": false,
  "browser.sessionstore.resume_from_crash": false,
  "dom.disable_open_during_load": false,
  "browser.tabs.warnOnClose": false,
  "browser.tabs.warnOnCloseOtherTabs": false,
  "browser.warnOnQuit": false,
  "browser.startup.homepage": "about:blank",
  "services.settings.server": "data:{[]}",
};

/** userChromeJS loader prefs (written only when utils/ is installed). */
export const UCJS_PREFS = {
  "userChromeJS.enabled": true,
  "userChromeJS.utilities.enabled": true,
};

/** Friendly browser names for run banners. */
export const BROWSER_NAMES = {
  nightly: "Firefox Nightly",
  dev: "Firefox Developer Edition",
  beta: "Firefox Beta",
  release: "Firefox (official release)",
  esr: "Firefox ESR",
};

/**
 * Read the running browser's identity — version, update channel, OS — by
 * evaluating in the browser. All lookups are best effort: a missing piece is
 * reported as "unknown" instead of failing the suite.
 *
 * @param {Function} evalAsyncInMain - (page, source) => Promise<value>, from
 *   bridgeClient
 * @param {import("puppeteer-core").Page} page - the bridge client page
 * @returns {Promise<{version: string; channel: string; os: string}>}
 */ export async function readBrowserInfo(evalAsyncInMain, page) {
  try {
    // __e2eEvalAsync evaluates its source as an async FUNCTION BODY - an
    // explicit `return` is required (a bare object expression returns nothing).
    const info = await evalAsyncInMain(
      page,
      `
      const appInfo = Services.appinfo;
      const osName = appInfo.OS === "WINNT" ? "Windows" : appInfo.OS;
      // sysinfo "version" is the kernel version string ("10.0" on Win10/11),
      // not a marketing build number - label it as such.
      let osVersion = "";
      try {
        osVersion = " (" + Services.sysinfo.getProperty("version") + ")";
      } catch {}
      return {
        version: appInfo.version,
        channel: appInfo.defaultUpdateChannel,
        os: osName + osVersion,
      };
    `
    );
    return {
      version: info?.version ?? "unknown",
      channel: info?.channel ?? "unknown",
      os: info?.os || "unknown",
    };
  } catch {
    return {version: "unknown", channel: "unknown", os: "unknown"};
  }
}

/**
 * Resolve the browser binary for a channel name; an explicit path wins.
 *
 * @param {string} [channel] - nightly | dev | beta | release | esr
 * @param {string} [binaryOverride] - absolute path to a browser binary
 * @returns {string} absolute path to the browser executable
 */
export function resolveBrowser(channel, binaryOverride) {
  const value =
    binaryOverride || process.env.FIREFOX_BINARY || FIREFOX_BINARIES[channel || DEFAULT_BROWSER];
  if (!value) {
    throw new Error(`No browser binary for channel "${channel || DEFAULT_BROWSER}"`);
  }
  const exe = value.replace(/\//g, path.sep === "\\" ? "/" : path.sep);
  if (!fs.existsSync(exe)) {
    throw new Error(`Browser binary not found: ${exe}`);
  }
  return exe;
}

/**
 * Merge a local override file (config.local.mjs) over the base config. Only
 * used by callers that need the resolved object; deep patch style.
 *
 * @returns {Promise<object>} partial patch object (may be empty)
 */
export async function loadLocalOverrides() {
  const localPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "config.local.mjs");
  if (!fs.existsSync(localPath)) {
    return {};
  }
  // eslint-disable-next-line no-unsanitized/method -- local file URL built via pathToFileURL
  const mod = await import(pathToFileURL(localPath).href);
  return mod.default || mod;
}
