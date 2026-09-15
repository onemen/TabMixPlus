/**
 * Tiny assertion + reporting helpers shared by all E2E suites. (Same shape as
 * firefox-scripts test/e2e/shared/helpers.mjs.)
 */

/** @returns {{passed: number; failed: number; failures: string[]}} */
export function createCounter() {
  return {passed: 0, failed: 0, failures: []};
}

/**
 * Record one check.
 *
 * @param {{passed: number; failed: number; failures: string[]}} counter
 * @param {boolean} ok
 * @param {string} label
 * @param {string} [detail]
 */
export function check(counter, ok, label, detail = "") {
  if (ok) {
    counter.passed++;
    console.log(`  PASS: ${label}`);
  } else {
    counter.failed++;
    counter.failures.push(detail ? `${label} — ${detail}` : label);
    console.error(`  FAIL: ${label}${detail ? " — " + detail : ""}`);
  }
}

/**
 * Print the summary; returns true when nothing failed.
 *
 * @param {{passed: number; failed: number; failures: string[]}} counter
 */
export function summary(counter) {
  const total = counter.passed + counter.failed;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${counter.passed}/${total} passed`);
  if (counter.failures.length) {
    console.log("Failures:");
    for (const f of counter.failures) console.log(`  - ${f}`);
  }
  console.log(`${"=".repeat(60)}`);
  return counter.failed === 0;
}

/**
 * Poll `page.evaluate(condition)` until truthy or timeout.
 *
 * @param {import("puppeteer-core").Page} page
 * @param {() => unknown} condition - serialized into the page
 * @param {number} timeoutMs
 * @param {number} [intervalMs=500] Default is `500`
 * @returns {Promise<boolean>}
 */
export async function waitForCondition(page, condition, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await page.evaluate(condition)) return true;
    } catch {
      // page may be mid-navigation; keep polling
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Poll `page.evaluate(fn)` until it returns a truthy value; returns the value.
 *
 * @param {import("puppeteer-core").Page} page
 * @param {() => unknown} fn
 * @param {number} timeoutMs
 * @param {number} [intervalMs=500] Default is `500`
 * @returns {Promise<unknown | null>}
 */
export async function waitForValue(page, fn, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await page.evaluate(fn);
      if (value) return value;
    } catch {
      // mid-navigation
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}
