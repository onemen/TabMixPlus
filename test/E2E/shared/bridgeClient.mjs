/**
 * Bridge client — evaluates script inside the REAL browser window.
 *
 * Firefox BiDi refuses navigation to most chrome:// URLs, does not expose
 * chrome windows as puppeteer pages, and inline scripts in chrome XHTML
 * documents do not execute — but a chrome-privileged page registered via a
 * chrome manifest, with its logic in an EXTERNAL script file, works when a tab
 * navigates to it (same pattern as Tabmix's own update.xhtml/update.js).
 *
 * The privileged client page exposes `window.__e2eEval` / `__e2eEvalAsync` /
 * `__e2eScreenshot`, which forward evaluations into the main browser window.
 */

// page.evaluate() callbacks below run in the browser, not in Node.
/* global window, document, location */

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
 * @param {number} [timeoutMs=60_000] Default is `60_000`
 * @returns {Promise<import("puppeteer-core").Page>} the client page
 */
export async function openBridgePage(browser, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  const started = Date.now();
  // The bridge's own client tab is the happy path: recognize it by URL, then
  // wait for its external script to register __e2eClient. Hijacking another
  // page is the fallback (BiDi goto to the chrome URL can stall), so it only
  // runs after a grace period with a short navigation timeout.
  const HIJACK_GRACE_MS = 3_000;
  const HIJACK_TIMEOUT_MS = 2_000;
  const POLL_MS = 250;
  let lastError = null;

  /**
   * True when the page is the client (script registered) or the client tab
   * still loading its script ("pending"); false for any other page.
   */
  const classify = async page => {
    try {
      return await page.evaluate(
        () =>
          Boolean(window.__e2eClient) ||
          (location.href === "chrome://tabmix-e2e/content/client.xhtml" ? "pending" : false)
      );
    } catch {
      return false; // not evaluable (chrome window shim, mid-navigation)
    }
  };

  /** Poll a single already-open client page until its script registers. */
  const waitForClientScript = async (page, ms) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      try {
        if (await page.evaluate(() => Boolean(window.__e2eClient))) return true;
      } catch {
        // transient
      }
      await new Promise(r => setTimeout(r, POLL_MS));
    }
    return false;
  };

  while (Date.now() < deadline) {
    let pages = [];
    try {
      pages = await browser.pages();
    } catch {
      // session not ready yet
    }

    // 1. A page that already IS the client — done.
    // 2. The bridge's own tab, still loading its script — wait for it.
    for (const page of pages) {
      const kind = await classify(page);
      if (kind === true) return page;
      if (kind === "pending" && (await waitForClientScript(page, 10_000))) {
        return page;
      }
    }

    // 3. Fallback after the grace period: hijack ONE ready page per
    // iteration. BiDi's goto to the chrome URL often stalls past its timeout
    // while the navigation still happens - the next poll (250ms) picks up the
    // result, so trying more pages in the same iteration only adds stalls.
    if (Date.now() - started >= HIJACK_GRACE_MS) {
      for (const page of pages) {
        let ready;
        try {
          const info = await page.evaluate(() => ({
            href: location.href,
            ready: document.readyState,
          }));
          ready = info.ready === "complete" || info.ready === "interactive";
        } catch {
          continue; // page not evaluable - try the next one
        }
        if (!ready) continue;
        try {
          await page.goto(CLIENT_URL, {
            waitUntil: "domcontentloaded",
            timeout: HIJACK_TIMEOUT_MS,
          });
          if (await waitForClientScript(page, 5_000)) return page;
          lastError = new Error("navigation succeeded but client script missing");
        } catch (e) {
          lastError = e;
        }
        break; // one page per iteration; re-poll before trying another
      }
    }

    await new Promise(r => setTimeout(r, POLL_MS));
  }
  throw new Error(
    `E2E client page not reachable within ${timeoutMs}ms` +
      (lastError ? ` — last error: ${lastError.message}` : "")
  );
}

const CLIENT_URL = "chrome://tabmix-e2e/content/client.xhtml";

/**
 * Evaluate an expression in the MAIN browser window via the client page. The
 * expression source is evaluated as `return (<source>);`.
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
 * @param {number} [intervalMs=500] Default is `500`
 * @returns {Promise<unknown | null>}
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
 * @returns {Promise<string | null>} PNG data URL or null
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
