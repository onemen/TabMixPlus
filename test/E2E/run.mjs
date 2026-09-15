#!/usr/bin/env node
/**
 * E2E runner CLI — local entry point.
 *
 * Usage: node test/E2E/run.mjs --suite=smoke node test/E2E/run.mjs
 * --suite=smoke --browser=nightly --headed node test/E2E/run.mjs --suite=smoke
 * --binary="C:/path/to/firefox.exe" node test/E2E/run.mjs --suite=all run every
 * suite in test/E2E/suites/ node test/E2E/run.mjs --list
 *
 * Omitting --suite runs the default suite (smoke). Exit code 0 = every check in
 * every selected suite passed.
 *
 * Env overrides: FIREFOX_BINARY=/path/to/exe (config.mjs resolveBrowser)
 * TMP_E2E_BROWSER=nightly (default channel when --browser omitted)
 */

import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {readdirSync} from "node:fs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SUITES_DIR = path.join(TEST_DIR, "suites");

/** Parse --key=value style args. */
function parseArgs() {
  const opts = {
    suite: "smoke",
    browser: null,
    binary: null,
    headed: false,
    keepProfile: false,
    keepOpen: false,
    list: false,
  };
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([a-zA-Z][a-zA-Z-]*)(?:=(.*))?$/);
    if (!m) continue;
    const [, key, value] = m;
    switch (key) {
      case "suite":
        opts.suite = value;
        break;
      case "browser":
        opts.browser = value;
        break;
      case "binary":
        opts.binary = value;
        break;
      case "headed":
        opts.headed = true;
        break;
      case "keep-profile":
        opts.keepProfile = true;
        break;
      case "keep-open":
        opts.keepOpen = true;
        break;
      case "list":
        opts.list = true;
        break;
      default:
        break;
    }
  }
  return opts;
}

/** Suite files (*.mjs) in test/E2E/suites/, sorted for stable order. */
function suiteFiles() {
  return readdirSync(SUITES_DIR)
    .filter(f => f.endsWith(".mjs"))
    .sort();
}

function listSuites() {
  console.log("Available suites:");
  for (const f of suiteFiles()) console.log(`  - ${f.replace(/\.mjs$/, "")}`);
  console.log("  - all (every suite, in the order above)");
  return 0;
}

async function loadSuite(suitePath) {
  // eslint-disable-next-line no-unsanitized/method -- local file URL built via pathToFileURL
  return import(pathToFileURL(suitePath).href);
}

async function main() {
  const opts = parseArgs();
  if (opts.list) return listSuites();

  console.log("Tab Mix Plus E2E");
  console.log("===============\n");

  const runOpts = {
    browser: opts.browser,
    binary: opts.binary,
    headless: !opts.headed,
    keepProfile: opts.keepProfile,
    keepOpen: opts.keepOpen,
  };

  // --suite=all: run every suite sequentially; one failure does not stop the rest.
  if (opts.suite === "all") {
    const results = [];
    for (const file of suiteFiles()) {
      const suiteName = path.basename(file, ".mjs");
      const suitePath = path.join(SUITES_DIR, file);
      let suite;
      try {
        suite = await loadSuite(suitePath);
      } catch (err) {
        console.error(`Suite failed to load: ${suitePath}\n  ${err.message}`);
        results.push({name: suiteName, ok: false});
        continue;
      }
      console.log(`\n### suite: ${suiteName} ###`);
      let ok = false;
      try {
        ok = await suite.run(runOpts);
      } catch (err) {
        console.error(`Suite ${suiteName} crashed: ${err.message}`);
      }
      results.push({name: suiteName, ok: Boolean(ok)});
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log("Suite summary:");
    for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}`);
    console.log(`${"=".repeat(60)}`);
    return results.every(r => r.ok) ? 0 : 1;
  }

  const suitePath = path.join(SUITES_DIR, `${opts.suite}.mjs`);
  let suite;
  try {
    suite = await loadSuite(suitePath);
  } catch (err) {
    console.error(`Suite not found or failed to load: ${suitePath}\n  ${err.message}`);
    return 2;
  }

  const ok = await suite.run(runOpts);
  return ok ? 0 : 1;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error("E2E runner failed:", err);
    process.exit(1);
  });
