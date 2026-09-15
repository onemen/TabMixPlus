/**
 * Profile factory — builds a fresh test profile with:
 *
 * 1. `chrome/utils/` (userChromeJS loader, copied from the reference profile)
 * 2. `chrome/tabmix-e2e.uc.js` (the privileged test bridge)
 * 3. `extensions/{dc572301-7619-498c-a57d-39143191b318}` (Tab Mix Plus, UNPACKED
 *    COPY)
 * 4. user.js with deterministic prefs
 * 5. `datareporting/state.json` with valid UUIDs (see seedDataReportingState)
 *
 * NOTE: the addon is _copied_ (never linked) into the profile.
 * Symlinks/junctions from /addon previously caused the working copy to be
 * deleted by the browser.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  ADDON_DIR,
  ARTIFACTS_DIR,
  PROFILE_PREFS,
  UCJS_PREFS,
  loadLocalOverrides,
} from "./config.mjs";

/** The privileged test bridge script (copied into profile chrome/). */
const BRIDGE_SRC = fileURLToPath(new URL("../bridge/tabmix-e2e.uc.js", import.meta.url));
/** The privileged client page (copied into profile chrome/utils/). */
const CLIENT_PAGE_SRC = fileURLToPath(new URL("../bridge/client.xhtml", import.meta.url));

const EXTENSION_ID = "{dc572301-7619-498c-a57d-39143191b318}";

/**
 * Fallback when neither config.local.mjs (`utilsDir`) nor TMP_E2E_UTILS_DIR
 * provides one.
 */
const DEFAULT_REFERENCE_UTILS_DIR =
  "C:/Users/Hadar/AppData/Roaming/Mozilla/Firefox/Profiles/oxc75ep9.firefox-changes-log/chrome/utils";

/** Files copied from the reference utils dir (loader core only). */
const UTILS_FILES = [
  "chrome.manifest",
  "userChrome.js",
  "BootstrapLoader.js",
  "xPref.sys.mjs",
  "RDFDataSource.sys.mjs",
  "RDFManifestConverter.sys.mjs",
];

/**
 * Copy userChrome.js with a safe-getters patch.
 *
 * config.js loads BootstrapLoader.js BEFORE userChrome.js in the same
 * autoconfig sandbox global; BootstrapLoader pins a non-configurable
 * `AppConstants` there, so userChrome.js's own defineESModuleGetters(this,
 * {...AppConstants...}) throws "can't redefine non-configurable property" and
 * the whole .uc.js loader dies. Patch the call to skip already-defined keys.
 *
 * @param {string} src - source userChrome.js path
 * @param {string} dest - destination path in the profile
 */
function patchUserChromeGetters(src, dest) {
  const source = fs.readFileSync(src, "utf-8");
  const patched = source.replace(
    /ChromeUtils\.defineESModuleGetters\(this, \{([^}]*)\}\);/,
    (_, body) =>
      "for (const [__k, __u] of Object.entries({" +
      body +
      "})) {\n" +
      "  if (!(__k in this)) ChromeUtils.defineESModuleGetters(this, {[__k]: __u});\n" +
      "}"
  );
  if (patched === source) {
    throw new Error("patchUserChromeGetters: defineESModuleGetters block not found");
  }
  // Wrap the whole script and report its fate to a pref (the autoconfig
  // sandbox swallows errors; prefs are the most reliable channel from there).
  // The ok flag is written ONLY on the success path — a catch must not be
  // overwritten by the trailing ok flag.
  const flagOk = "\n;Services.prefs.setStringPref('tabmix.e2e.ucjsLoaded', 'ok');\n";
  const flagErr =
    "  try {\n" +
    "    Services.prefs.setStringPref('tabmix.e2e.ucjsLoaded',\n" +
    "      'ERR: ' + e.message + ' @ ' + (e.filename || '?') + ':' + (e.lineNumber || '?'));\n" +
    "  } catch (e2) {}\n";
  fs.writeFileSync(dest, "try {\n" + patched + flagOk + "\n} catch (e) {\n" + flagErr + "}");
}

/**
 * Create a fresh temp profile directory.
 *
 * @param {string} tag - short tag for the temp prefix
 * @returns {string} profile dir path
 */
export function createProfileDir(tag = "tmp") {
  return fs.mkdtempSync(path.join(os.tmpdir(), `tmp-e2e-${tag}-`));
}

/**
 * Populate a profile dir: utils loader + bridge script + addon copy + user.js.
 *
 * The userChromeJS loader is copied from a reference profile's chrome/utils
 * directory — per-machine, so it is resolved as: `utilsDir` from
 * config.local.mjs, then TMP_E2E_UTILS_DIR, then the built-in default.
 *
 * @param {string} profileDir - existing (empty) profile dir
 */
export async function populateProfile(profileDir) {
  const overrides = await loadLocalOverrides();
  const referenceUtilsDir =
    overrides?.utilsDir || process.env.TMP_E2E_UTILS_DIR || DEFAULT_REFERENCE_UTILS_DIR;
  const chromeDir = path.join(profileDir, "chrome");
  const utilsDir = path.join(chromeDir, "utils");

  // 1. userChromeJS loader (from the reference profile).
  if (!fs.existsSync(referenceUtilsDir)) {
    throw new Error(
      `utils loader dir not found: ${referenceUtilsDir} — set utilsDir in ` +
        `test/E2E/shared/config.local.mjs (or TMP_E2E_UTILS_DIR) to a profile ` +
        `chrome/utils directory (see test/E2E/README.md)`
    );
  }
  fs.mkdirSync(utilsDir, {recursive: true});
  for (const name of UTILS_FILES) {
    const src = path.join(referenceUtilsDir, name);
    if (!fs.existsSync(src)) {
      throw new Error(`utils loader file missing: ${src}`);
    }
    if (name === "userChrome.js") {
      patchUserChromeGetters(src, path.join(utilsDir, name));
    } else {
      fs.copyFileSync(src, path.join(utilsDir, name));
    }
  }
  // Register the privileged client page:
  //   chrome://tabmix-e2e/content/client.xhtml
  // The utils manifest is auto-registered by config.js at startup (before
  // any .uc.js runs), and its paths are relative to utils/ — so the client
  // page must live IN utils/ for `./` to resolve.
  fs.appendFileSync(
    path.join(utilsDir, "chrome.manifest"),
    "\n# Tab Mix Plus E2E client page\ncontent tabmix-e2e ./\n"
  );
  fs.copyFileSync(CLIENT_PAGE_SRC, path.join(utilsDir, "client.xhtml"));
  fs.copyFileSync(
    fileURLToPath(new URL("../bridge/client.js", import.meta.url)),
    path.join(utilsDir, "client.js")
  );

  // 2. The E2E bridge as a .uc.js script in profile chrome/ (loader scans it).
  fs.copyFileSync(BRIDGE_SRC, path.join(chromeDir, "tabmix-e2e.uc.js"));

  // 3. Tab Mix Plus — UNPACKED COPY into extensions/{id}.
  const extDir = path.join(profileDir, "extensions", EXTENSION_ID);
  fs.cpSync(ADDON_DIR, extDir, {
    recursive: true,
    filter: src => {
      const rel = path.relative(ADDON_DIR, src);
      if (!rel) return true;
      // skip build artifacts and junk
      return (
        !/(^|[\\/])(tsconfig\.tsbuildinfo|\.DS_Store)$/.test(rel) &&
        !/(^|[\\/])node_modules([\\/]|$)/.test(rel)
      );
    },
  });
  // install.rdf bloats nothing but is required for legacy sideload.
  if (!fs.existsSync(path.join(extDir, "install.rdf"))) {
    throw new Error("addon copy is missing install.rdf");
  }

  // 4. user.js — NOTE: puppeteer overwrites user.js at launch (extraPrefsFirefox
  // wins), so test prefs that must reach Firefox go through launchFirefox(),
  // not here. The extensions.tabmix.version suppression pref lives there too
  // (see shared/config.mjs readAddonVersion).
  const prefs = {
    ...PROFILE_PREFS,
    ...UCJS_PREFS,
  };
  const lines = Object.entries(prefs).map(([k, v]) => prefLine(k, v));
  fs.writeFileSync(path.join(profileDir, "user.js"), lines.join("\n") + "\n");

  seedDataReportingState(profileDir);
}

/**
 * Pre-seed `<profile>/datareporting/state.json` with the CANARY identifiers.
 *
 * Why: telemetry upload is disabled in test profiles (PROFILE_PREFS), and with
 * upload disabled Firefox CONVERGES every identifier to a known canary constant
 * (ClientID.sys.mjs): TelemetryController delayed-init calls
 * setCanaryIdentifiers() when it sees a non-canary client ID. Seeding the
 * canary values directly starts every run at that converged state — no
 * regeneration churn, and the values are by-design non-identifying. (The
 * `invalid client ID: null` boot errors are prevented separately, by
 * pre-setting `datareporting.usage.uploadEnabled: false` in PROFILE_PREFS — see
 * config.mjs — so the remote agent's runtime set is a no-op and
 * UsageReporting's falling-edge canary save never runs mid-boot.)
 *
 * Shape mirrors _saveDataReportingState (version 2 + four UUID fields).
 *
 * @param {string} profileDir
 */
function seedDataReportingState(profileDir) {
  const state = {
    version: 2,
    // CANARY_CLIENT_ID / CANARY_PROFILE_GROUP_ID (ClientID.sys.mjs)
    clientID: "c0ffeec0-ffee-c0ff-eec0-ffeec0ffeec0",
    profileGroupID: "decafdec-afde-cafd-ecaf-decafdecafde",
    // CANARY_USAGE_PROFILE_ID / CANARY_USAGE_PROFILE_GROUP_ID
    usageProfileID: "beefbeef-beef-beef-beef-beeefbeefbee",
    usageProfileGroupID: "b0bacafe-b0ba-cafe-b0ba-cafeb0bacafe",
  };
  fs.mkdirSync(path.join(profileDir, "datareporting"), {recursive: true});
  fs.writeFileSync(
    path.join(profileDir, "datareporting", "state.json"),
    JSON.stringify(state, null, 2)
  );
}

/**
 * Serialize one pref line for user.js.
 *
 * @param {string} key
 * @param {boolean | number | string} value
 */
function prefLine(key, value) {
  if (typeof value === "boolean") return `user_pref("${key}", ${value});`;
  if (typeof value === "number") return `user_pref("${key}", ${value});`;
  return `user_pref("${key}", ${JSON.stringify(value)});`;
}

/**
 * Post-launch profile hygiene: delete compatibility.ini + startupCache so the
 * unpacked legacy extension re-scans on next start (same as firefox-updater).
 *
 * @param {string} profileDir
 */
export function removeProfileCompatibilityIni(profileDir) {
  const filePath = path.join(profileDir, "compatibility.ini");
  try {
    fs.unlinkSync(filePath);
  } catch {
    // may not exist yet
  }
}

/**
 * Remove a profile dir (best effort).
 *
 * @param {string} profileDir
 */
export function deleteProfile(profileDir) {
  try {
    fs.rmSync(profileDir, {recursive: true, force: true});
  } catch {
    // best effort
  }
}

/** Where failure artifacts (screenshots, logs) go. */
export function artifactsDir() {
  fs.mkdirSync(ARTIFACTS_DIR, {recursive: true});
  return ARTIFACTS_DIR;
}
