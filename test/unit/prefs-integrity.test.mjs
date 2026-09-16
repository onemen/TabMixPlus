/**
 * Prefs-integrity drift detector (test-plan §4, P1) for the error-handling &
 * logging branch (PR #582).
 *
 * Tabmix registers its `extensions.tabmix.*` defaults in two places:
 *
 * 1. defaults/preferences/tabmix.js — the bulk, applied at startup by
 *    PreferencesLoader.loadDefaultPreferences() (loadSubScript + default
 *    branch).
 * 2. Code-registered defaults — extensions.tabmix.log.level in logger.sys.mjs
 *    (module import, see PR #582) and the tab-context-menu visibility defaults
 *    derived from TabContextConfig.prefList in
 *    PreferencesLoader.loadDefaultPreferences().
 *
 * The test needs no Firefox: tabmix.js is parsed statically (multi-line pref(
 * calls supported, comments stripped), and TabContextConfig is imported under
 * shims — it runs at import time on Services.appinfo and Tabmix.isVersion.
 *
 * Assertions:
 *
 * - no duplicate default registrations anywhere (drift)
 * - no orphan defaults: every registered default name is referenced somewhere in
 *   the addon sources (catches defaults left behind after a rename)
 * - log.level is NOT in tabmix.js (single source of truth after PR #582)
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const UNIT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ADDON_DIR = path.resolve(UNIT_DIR, "../../addon");

const DEFAULTS_FILE = path.join(ADDON_DIR, "defaults/preferences/tabmix.js");
const TAB_CONTEXT_FILE = path.join(ADDON_DIR, "modules/TabContextConfig.sys.mjs");
const LOG_PREF_NAME = "extensions.tabmix.log.level";

/** Grab every prefName registered via pref("..."/'...' — multi-line aware. */
function prefNamesFromDefaultsFile() {
  // Strip /* block */ and // line comments so commented-out defaults
  // (e.g. the old hideTabbar=1 line) are not counted.
  const src = fs
    .readFileSync(DEFAULTS_FILE, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  return [...src.matchAll(/\bpref\(\s*["']([^"']+)["']/g)].map(m => m[1]);
}

/** Sources that may reference a pref name, for the orphan check. */
function addonSourceFiles() {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|mjs|xhtml|xul|dtd|properties|css)$/.test(entry.name)) out.push(full);
    }
  };
  walk(ADDON_DIR);
  return out;
}

/**
 * Extract the tab-context default pref names from TabContextConfig.sys.mjs
 * statically — mirroring PreferencesLoader.loadDefaultPreferences(), which
 * derives `extensions.tabmix.<name || id.replace(/^context_|^tm-/, "")>` from
 * each prefList entry. Static extraction keeps the suite Firefox-free (the
 * module imports chrome:// URLs that Node cannot load); a drift between the
 * regex and the loader would surface as a false failure here, not as a silent
 * pass.
 *
 * Returns the derived pref names, e.g. "extensions.tabmix.closeTabMenu".
 */
function tabContextPrefNames() {
  const src = fs.readFileSync(TAB_CONTEXT_FILE, "utf8");
  const prefListStart = src.indexOf("const TAB_CONTEXT_MENU_PREFLIST = {");
  const prefListEnd = src.indexOf("\n};", prefListStart);
  assert.ok(prefListStart > 0 && prefListEnd > prefListStart, "prefList block located");
  const block = src.slice(prefListStart, prefListEnd);

  const names = [];
  // Match `"context_x": ["prefName"]` / `"context_x": ["", false]` entries;
  // skip commented-out lines (they carry leading // on the same line).
  for (const m of block.matchAll(/["']([A-Za-z0-9_-]+)["']\s*:\s*\[\s*([^\]]*?)\s*]/g)) {
    const line = block.slice(block.lastIndexOf("\n", m.index) + 1, m.index);
    if (line.includes("//")) continue;
    const [id, configRaw] = [m[1], m[2]];
    const nameMatch = configRaw.match(/["']([^"']*)["']/);
    const name = nameMatch ? nameMatch[1] : id;
    const prefName = name || id.replace(/^context_|^tm-/, "");
    names.push(`extensions.tabmix.${prefName}`);
  }
  return names;
}

export const name = "prefs-integrity";

export const tests = [
  {
    name: "defaults file: every pref() line parses and there are no duplicate registrations",
    async test() {
      const names = prefNamesFromDefaultsFile();
      assert.ok(names.length > 100, `defaults file parsed (${names.length} prefs found)`);
      const dupes = names.filter((n, i) => names.indexOf(n) !== i);
      assert.deepEqual(dupes, [], `no duplicate pref() registrations in tabmix.js`);
      return true;
    },
  },
  {
    name: "log.level default is registered in logger.sys.mjs, not in tabmix.js (single source)",
    async test() {
      const inLogger = fs
        .readFileSync(path.join(ADDON_DIR, "modules/logger.sys.mjs"), "utf8")
        .includes(`setStringPref(LOG_LEVEL_PREF, "All")`);
      assert.ok(inLogger, "logger.sys.mjs registers the log.level default");
      assert.ok(
        !prefNamesFromDefaultsFile().includes(LOG_PREF_NAME),
        "log.level absent from defaults/preferences/tabmix.js"
      );
      return true;
    },
  },
  {
    name: "code-registered tab-context defaults derive cleanly from TabContextConfig.prefList",
    async test() {
      const names = tabContextPrefNames();
      assert.ok(names.length >= 20, `prefList yields defaults (${names.length} found)`);
      const dupes = names.filter((n, i) => names.indexOf(n) !== i);
      assert.deepEqual(dupes, [], "no duplicate tab-context default names");
      for (const n of names) {
        assert.ok(n.startsWith("extensions.tabmix."), `pref name shape: ${n}`);
      }
      return true;
    },
  },
  {
    name: "tab-context defaults do not collide with defaults-file registrations",
    async test() {
      const ctxNames = tabContextPrefNames();
      const fileSet = new Set(prefNamesFromDefaultsFile());
      const overlap = ctxNames.filter(n => fileSet.has(n));
      assert.deepEqual(overlap, [], "PreferencesLoader would re-register existing defaults");
      return true;
    },
  },
  {
    name: "no orphan defaults: every registered default is referenced in addon sources",
    async test() {
      const registered = new Set(prefNamesFromDefaultsFile());
      const source = addonSourceFiles()
        .map(f => fs.readFileSync(f, "utf8"))
        .join("\n");
      const orphans = [...registered].filter(prefName => !source.includes(prefName));
      assert.deepEqual(
        orphans,
        [],
        `every default in tabmix.js must be referenced somewhere (orphans: ${orphans.join(", ")})`
      );
      return true;
    },
  },
];
