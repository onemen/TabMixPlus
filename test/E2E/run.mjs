#!/usr/bin/env node
/**
 * E2E runner CLI — local entry point.
 *
 * Usage:
 *   node test/E2E/run.mjs --suite=smoke
 *   node test/E2E/run.mjs --suite=smoke --browser=nightly --headed
 *   node test/E2E/run.mjs --suite=smoke --binary="C:/path/to/firefox.exe"
 *   node test/E2E/run.mjs --list
 *
 * Env overrides:
 *   FIREFOX_BINARY=/path/to/exe     (config.mjs resolveBrowser)
 *   TMP_E2E_BROWSER=nightly         (default channel when --browser omitted)
 */

import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {readdirSync} from "node:fs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SUITES_DIR = path.join(TEST_DIR, "suites");

/** Parse --key=value style args. */
function parseArgs() {
  const opts = {suite: "smoke", browser: null, binary: null, headed: false, keepProfile: false, list: false};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([a-zA-Z]+)(?:=(.*))?$/);
    if (!m) continue;
    const [, key, value] = m;
    switch (key) {
      case "suite": opts.suite = value; break;
      case "browser": opts.browser = value; break;
      case "binary": opts.binary = value; break;
      case "headed": opts.headed = true; break;
      case "keep-profile": opts.keepProfile = true; break;
      case "list": opts.list = true; break;
      default: break;
    }
  }
  return opts;
}

function listSuites() {
  const files = readdirSync(SUITES_DIR).filter(f => f.endsWith(".mjs") && f !== "README.md");
  console.log("Available suites:");
  for (const f of files) console.log(`  - ${f.replace(/\.mjs$/, "")}`);
  return 0;
}

async function main() {
  const opts = parseArgs();
  if (opts.list) return listSuites();

  const suitePath = path.join(SUITES_DIR, `${opts.suite}.mjs`);
  let suite;
  try {
    suite = await import(pathToFileURL(suitePath).href);
  } catch (err) {
    console.error(`Suite not found or failed to load: ${suitePath}\n  ${err.message}`);
    return 2;
  }

  console.log("Tab Mix Plus E2E");
  console.log("===============\n");

  const ok = await suite.run({
    browser: opts.browser,
    binary: opts.binary,
    headless: !opts.headed,
    keepProfile: opts.keepProfile,
  });

  return ok ? 0 : 1;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error("E2E runner failed:", err);
    process.exit(1);
  });
