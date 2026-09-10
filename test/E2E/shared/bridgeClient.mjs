/**
 * Bridge client — evaluates script inside the REAL browser window.
 *
 * Firefox BiDi refuses navigation to most chrome:// URLs, does not expose
 * chrome windows as puppeteer pages, and inline scripts in chrome XHTML
 * documents do not execute — but a chrome-privileged page registered via a
 * chrome manifest, with its logic in an EXTERNAL script file, works when a
 * tab navigates to it (same pattern as Tabmix's own update.xhtml/update.js).
 *
 * The privileged client page exposes `window.__e2eEval` / `__e2eEvalAsync` /
 * `__e2eScreenshot`, which forward evaluations into the main browser window.
 */

/**
 * Attach to (or open) the privileged E2E client page.
 *
 * Strategy: first check whether the bridge .uc.js already opened the client
 * page in a tab (marker `window.__e2eClient` visible from any BiDi page). If
 * not, hijack the first usable page and navigate it to the client URL —
 * navigation to a chrome-registered URL succeeds even though arbitrary
 * chrome:// gotos are refused.
 *
 * @param {import("puppeteer-core").Browser} browser
 * @param {number} [timeoutMs=60_000]
 * @returns {Promise<import("puppeteer-core").Page>} the client page
 */
export async function openBridgePage(browser, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    let pages = [];
    try {
      pages = await browser.pages();
    } catch {
      // session not ready yet
    }

    // 1. Prefer a page that already IS the client.
    for (const page of pages) {
      try {
        const isClient = await page.evaluate(() => Boolean(window.__e2eClient));
        if (isClient) {
          return page;
        }
      } catch {
        // mid-navigation
      }
    }

    // 2. Hijack the first page that allows evaluation and is not the client.
    for (const page of pages) {
      try {
        const info = await page.evaluate(() => ({
          href: location.href,
          ready: document.readyState,
        }));
        if (info.ready === "complete" || info.ready === "interactive") {
          try {
            await page.goto(CLIENT_URL, {
              waitUntil: "domcontentloaded",
              timeout: 15_000,
            });
            const isClient = await page.evaluate(() => Boolean(window.__e2eClient));
            if (isClient) return page;
            lastError = new Error("navigation succeeded but client script missing");
          } catch (e) {
            lastError = e;
          }
        }
      } catch {
        // page not evaluable (chrome window shim) — try next
      }
    }

    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(
    `E2E client page not reachable within ${timeoutMs}ms` +
      (lastError ? ` — last error: ${lastError.message}` : "")
  );
}

const CLIENT_URL = "chrome://tabmix-e2e/content/client.xhtml";

/**
 * Evaluate an expression in the MAIN browser window via the client page.
 * The expression source is evaluated as `return (<source>);`.
 *
 * @param {import("puppeteer-core").Page} bridgePage - the client tab's page
 * @param {string} source - JS expression evaluated in the main window scope
 * @returns {Promise<unknown>} structured-cloned result
 */
export async function evalInMain(bridgePage, source) {
  const wrapped = await bridgePage.evaluate(src => window.__e2eEval(src), source);
  if (!wrapped || wrapped.__e2eError) {
    throw new Error(`evalInMain failed: ${wrapped?.__e2eError ?? "no result"}`);
  }
  return wrapped.value;
}

/**
 * Async variant: the source becomes the BODY of an async function executed in
 * the main window; use `return` to produce a result. Await Tabmix promises
 * inside as needed.
 *
 * @param {import("puppeteer-core").Page} bridgePage
 * @param {string} source
 * @returns {Promise<unknown>}
 */
export async function evalAsyncInMain(bridgePage, source) {
  const wrapped = await bridgePage.evaluate(src => window.__e2eEvalAsync(src), source);
  if (!wrapped || wrapped.__e2eError) {
    throw new Error(`evalAsyncInMain failed: ${wrapped?.__e2eError ?? "no result"}`);
  }
  return wrapped.value;
}

/**
 * Wait until `source` (evaluated in main) returns a truthy value; returns it.
 *
 * @param {import("puppeteer-core").Page} bridgePage
 * @param {string} source
 * @param {number} timeoutMs
 * @param {number} [intervalMs=500]
 * @returns {Promise<unknown|null>}
 */
export async function waitForValueInMain(bridgePage, source, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await evalInMain(bridgePage, source);
      if (value) return value;
    } catch {
      // main window not ready yet — keep polling
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * Screenshot the main window through the bridge (drawWindow).
 *
 * @param {import("puppeteer-core").Page} bridgePage
 * @returns {Promise<string|null>} PNG data URL or null
 */
export async function screenshotMain(bridgePage) {
  try {
    const wrapped = await bridgePage.evaluate(() => window.__e2eScreenshot());
    if (wrapped?.value) return wrapped.value;
  } catch {
    // fallthrough
  }
  return null;
}
