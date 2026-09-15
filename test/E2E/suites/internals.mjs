/**
 * E2E internals suite — asserts Tabmix's Firefox-internals integration in the
 * running browser (P0/P1 tier in docs/test-plan.md):
 *
 * 1. privateMethodTransformState invariant: every `planned` private-method entry
 *    (code that expects a reconstructed `Parent._method`) is present in
 *    `replaced` (methods actually reconstructed at boot). This is the runtime
 *    complement of the static verify-firefox-internals checker.
 * 2. Sandbox lifecycle invariants, asserted here instead of documented in the
 *    addon source (addon/modules/Changecode.sys.mjs getSandbox audit):
 *
 *    - Window-context callers: each bootstrap object (window Tabmix, gBrowser's
 *         Tabmix._gBrowser_sandbox, nsContextMenu, BrowserDOMWindow,
 *         HandleOnEvent) creates its own sandbox via expandTabmix.getSandbox —
 *         Object.assign copies methods only, never the module's _sandbox slot,
 *         so there is no cross-window reuse. Window sandboxes use
 *         sandboxPrototype/sameZoneAs on the caller's global and die with that
 *         window.
 *    - Module-context callers get the shared module sandbox (MODULE_SANDBOXES_SET),
 *         nuked on quit-application.
 *    - expandTabmix._sandbox is transient: set only by initializeChangeCodeClass,
 *         and reset to null by the module getSandbox export right after first
 *         use.
 *    - Known redundancy: one window currently allocates ~5 system-principal
 *         window-context sandboxes for the same global; correctness is
 *         unaffected.
 * 3. Boot is clean: no Tabmix console errors (failed reconstruction or a broken
 *    sandbox scope always logs).
 *
 * Static counterpart: `pnpm test:internals`.
 */

import fs from "node:fs";

import {createCounter, check, summary} from "../shared/assert.mjs";
import {
  resolveBrowser,
  DEFAULT_BROWSER,
  BROWSER_NAMES,
  readBrowserInfo,
} from "../shared/config.mjs";
import {createProfileDir, populateProfile, deleteProfile} from "../shared/profileFactory.mjs";
import {launchFirefox, attachProcessLogging, closeBrowser} from "../shared/launch.mjs";
import {
  openBridgePage,
  evalInMain,
  evalAsyncInMain,
  waitForValueInMain,
} from "../shared/bridgeClient.mjs";
import {addonFiles} from "../../internals/verify-firefox-internals.mjs";

export const name = "internals";

/**
 * Match one `Parent._member` planned entry against an addon source while
 * remembering WHICH parent the definition was found in. A match is valid only
 * when the addon defines `_member` on the same parent the entry names (e.g.
 * `ParentA._foo = ...` cannot back `ParentB._foo`) — the transform binds the
 * reconstructed method to the entry's own parent. Definitions through an alias
 * also count when the alias provably resolves to the entry's parent (e.g.
 * `this.tabDnDPrototype` for `gBrowser.tabContainer.tabDragAndDrop`).
 *
 * @param {string} entry - planned entry like "gBrowser._dataURLRegEx"
 * @param {string} src - addon source text
 * @returns {boolean} the source defines _member on the entry's parent
 */
function parentMatches(entry, src) {
  const dot = entry.lastIndexOf(".");
  const parent = dot === -1 ? entry : entry.slice(0, dot);
  const leaf = entry.slice(dot + 1).replace(/^_/, "");
  if (!leaf) return false;
  const escapedLeaf = leaf.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // (this.|tabDnDPrototype.|)*_leaf = — dotted parent, this-assignment, the
  // minit.js tabDnDPrototype alias (assigned the tab container's
  // drag-and-drop controller / the scrollbox host), or a bare statement.
  // Unrelated aliases are not inferred.
  const patterns = [
    new RegExp(`${esc(parent)}\\._${escapedLeaf}\\s*=`), // Parent._leaf =
    new RegExp(`(?:^|[^\\w$.])(?:this\\.)?(?:tabDnDPrototype\\.)?_?${escapedLeaf}\\s*=`),
    new RegExp(`(?:get|set)\\s+_${escapedLeaf}\\b`), // get _leaf() {...}
    new RegExp(`["'\`]_${escapedLeaf}["'\`]`), // defineProperty("_leaf", ...)
  ];
  return patterns.some(re => re.test(src));
}

/**
 * planned entries can also be satisfied by Tabmix defining the member itself
 * (`gBrowser._dataURLRegEx = …`, `get _verticalMode()`, defineProperty
 * ("_dragSession", …)). An entry is "addon-backed" when some addon source
 * defines `_leaf`. Derived from the sources each run — if the addon renames a
 * member without updating the transformed code, this stops backing the entry
 * and the suite fails.
 */
const addonSources = addonFiles().map(f => fs.readFileSync(f, "utf8"));
function isAddonBacked(entry) {
  return addonSources.some(src => parentMatches(entry, src));
}

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
  const exe = await resolveBrowser(channel, binary);
  console.log(`Internals suite — browser: ${exe}`);

  const profileDir = createProfileDir("internals");

  let browser = null;
  let processTag = null;
  let bridgePage;

  try {
    // Inside the try: a populateProfile() failure must hit the finally-block
    // cleanup, not leak the copied profile in the system temp directory.
    await populateProfile(profileDir);
    console.log(`  profile: ${profileDir}`);

    ({browser, processTag} = await launchFirefox({binary: exe, profileDir, headless}));
    attachProcessLogging(browser, []);

    bridgePage = await openBridgePage(browser);
    check(counter, true, "attached to the privileged E2E client tab over BiDi");

    const bridge = await waitForValueInMain(
      bridgePage,
      "typeof window.__tabmixE2E !== 'undefined'",
      30_000
    );
    check(counter, Boolean(bridge), "tabmix-e2e bridge is injected (userChromeJS loader ran)");

    // Browser identity for the run log.
    const info = await readBrowserInfo(evalAsyncInMain, bridgePage);
    console.log(
      `  browser under test: ${BROWSER_NAMES[channelKey] ?? "custom binary"} ` +
        `${info.version} (update channel: ${info.channel}, ${info.os})`
    );

    // Wait for the addon bootstrap (boolean expression — serializable over
    // BiDi, a Promise-returning expression would never resolve), then collect
    // the invariant data in one privileged evaluation.
    const tabmix = await waitForValueInMain(
      bridgePage,
      `typeof window.Tabmix !== "undefined" &&
        Boolean(window.Tabmix.privateMethodTransformState)`,
      45_000
    );
    check(counter, Boolean(tabmix), "window.Tabmix exists (addon bootstrap ran)");

    // NOT caught: a rejected promiseOverlayLoaded means the overlay failed to
    // load — the suite must record a failure even if basic gBrowser calls
    // would still succeed.
    await evalAsyncInMain(
      bridgePage,
      `
      if (window.Tabmix?.promiseOverlayLoaded) {
        await window.Tabmix.promiseOverlayLoaded;
      }
    `
    );

    const state = await evalAsyncInMain(
      bridgePage,
      `
      const t = window.Tabmix;
      const ps = t?.privateMethodTransformState;
      // "missing" = transformed code referenced Parent.#method and no
      // Parent._method was ever defined. Tabmix-defined backing fields
      // (_dataURLRegEx etc.) are assigned by the addon itself, so they are
      // handled differently from reconstructed methods — see below.
      const missing = ps ? [...ps.planned].filter(k => !ps.replaced.has(k)) : [];
      return {
        hasState: Boolean(ps),
        plannedCount: ps?.planned.size ?? -1,
        replacedCount: ps?.replaced.size ?? -1,
        missing,
        bootstrapSandbox: Boolean(t?._sandbox),
        gbrowserSandbox: Boolean(t?._gBrowser_sandbox),
        sandboxesDistinct: Boolean(t?._sandbox && t?._gBrowser_sandbox && t._sandbox !== t._gBrowser_sandbox),
        error: ps ? null : "privateMethodTransformState is not available on window.Tabmix",
      };
    `
    );

    // 1. The private-method invariant: every `planned` entry (transformed
    //    code referenced Parent.#name) must be either reconstructed at boot
    //    (in `replaced`) or defined by the addon itself (backing field such
    //    as _dataURLRegEx or a _dragSession getter). Anything else is a real
    //    gap: code that will hit `can't find private function` at runtime.
    check(
      counter,
      state?.hasState === true,
      "privateMethodTransformState is exposed",
      state?.error
    );
    check(
      counter,
      (state?.plannedCount ?? -1) > 0,
      `planned has entries (${state?.plannedCount} planned / ${state?.replacedCount} replaced)`
    );
    const missing = state?.missing ?? [];
    const unbacked = missing.filter(entry => !isAddonBacked(entry));
    check(
      counter,
      unbacked.length === 0,
      "every planned entry is reconstructed or addon-backed",
      unbacked.join(", ") || null
    );
    if (missing.length) {
      console.log(`  addon-backed fields (no reconstruction needed): ${missing.join(", ")}`);
    }

    // 2. Sandbox lifecycle invariants (see Changecode.sys.mjs audit).
    check(counter, state?.bootstrapSandbox === true, "window Tabmix owns its own sandbox");
    check(
      counter,
      state?.gbrowserSandbox === true,
      "gBrowser's Tabmix owns a sandbox (_gBrowser_sandbox)"
    );
    check(
      counter,
      state?.sandboxesDistinct === true,
      "window and gBrowser sandboxes are distinct objects (no cross-context reuse)"
    );

    // 3. No Tabmix console errors at boot.
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
  } catch (err) {
    check(counter, false, "internals suite completed without exception", String(err));
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
