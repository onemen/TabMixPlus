#!/usr/bin/env node
/**
 * Unit-test runner — local entry point, zero dependencies (node:test style
 * helpers live in assert.mjs, matching the E2E engine's approach).
 *
 * Usage: node test/unit/run.mjs run every unit test node test/unit/run.mjs
 * <name> run one test file (name or name.test.mjs, e.g. "version-gates")
 *
 * Exit code 0 = all tests passed.
 *
 * A "test file" is any `*.test.mjs` directly in test/unit/ (no nesting) that
 * exports `tests` — an array of `{name, test}` where `test` is an async
 * function returning `true` on success, or throwing/returning false on failure.
 * Each file may also export `name` (defaults to its filename).
 */

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const UNIT_DIR = path.dirname(fileURLToPath(import.meta.url));

/** All unit test files (no nesting, *.test.mjs), sorted for stable output. */
function testFiles() {
  return fs
    .readdirSync(UNIT_DIR)
    .filter(f => f.endsWith(".test.mjs"))
    .sort()
    .map(f => path.join(UNIT_DIR, f));
}

async function runFile(file) {
  // eslint-disable-next-line no-unsanitized/method -- local file URL built via pathToFileURL (same as test/E2E/run.mjs)
  const mod = await import(pathToFileURL(file).href);
  const name = mod.name ?? path.basename(file, ".test.mjs");
  const tests = mod.tests ?? [];

  if (!tests.length) {
    console.log(`\n${name}`);
    console.log(`  (no tests exported)`);
    return {name, passed: 0, failed: 0};
  }

  console.log(`\n${name}`);
  const counters = {passed: 0, failed: 0};
  for (const {name: testName, test} of tests) {
    try {
      const ok = await test();
      if (ok === false) throw new Error("test returned false");
      counters.passed++;
      console.log(`  PASS: ${testName}`);
    } catch (err) {
      counters.failed++;
      console.error(`  FAIL: ${testName}`);
      console.error(
        `        ${err instanceof Error ? err.stack : String(err)}`.replace(/\n/g, "\n        ")
      );
    }
  }
  return {name, ...counters};
}

async function main() {
  const arg = process.argv[2]; // single test name, or undefined for all
  const files = testFiles();
  if (!files.length) {
    console.error("No unit tests found (test/unit/*.test.mjs)");
    return 2;
  }

  const selected = arg ? files.filter(f => path.basename(f).startsWith(arg)) : files;
  if (arg && !selected.length) {
    console.error(
      `No unit test matching "${arg}". Available:\n  ` +
        files.map(f => path.basename(f)).join("\n  ")
    );
    return 2;
  }

  console.log("Tab Mix Plus unit tests");
  console.log("=======================");

  const results = [];
  for (const file of selected) {
    try {
      results.push(await runFile(file));
    } catch (err) {
      console.error(`\n${path.basename(file)} — failed to load: ${err.message}`);
      results.push({name: path.basename(file), passed: 0, failed: 1});
    }
  }

  const passed = results.reduce((n, r) => n + r.passed, 0);
  const failed = results.reduce((n, r) => n + r.failed, 0);
  console.log(`\n${"=".repeat(60)}`);
  for (const r of results) {
    console.log(`  ${r.name}: ${r.passed} passed${r.failed ? `, ${r.failed} FAILED` : ""}`);
  }
  console.log(`Total: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}`);
  return failed ? 1 : 0;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error("Unit runner failed:", err);
    process.exit(1);
  });
