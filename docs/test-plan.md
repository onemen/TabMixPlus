# Tab Mix Plus — Test plan

The living test document: what we test, in what priority order, and which test covers the changes
currently in flight. Decisions (repo-local tests, local-first, CI later) are recorded in
[ADR 0003](./decisions/0003-local-first-test-suite.md). Committed from the maintainer's
TEST-PLAN.local.md — edit this file, not that one.

> **Status:** the E2E engine (phase 1) with the smoke + internals suites, the unit runner
> (`pnpm test:unit`, seeded with verify-internals unit tests), and the static
> verify-firefox-internals check exist — see [test/E2E/README.md](../test/E2E/README.md) for how the
> engine works and [Local runs](#local-runs) for the commands. The smoke suite passed 11/11 on
> Firefox Nightly, verified manually on Windows 11 (2026-09-13); `--suite=all` (internals + smoke)
> passed on 2026-09-14. Remaining before the coverage rule activates: the P1 unit inventories and
> the P2 suites.

## Priority tiers

| Tier   | When it runs                               | Tests                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | before every merge to main                 | `pnpm typecheck` · `pnpm lint` · `pnpm test:unit` · **smoke E2E** (`pnpm test:e2e --suite=smoke`: fresh profile boots, `window.Tabmix` present, sentinel overrides applied, zero console errors) · **verify-firefox-internals** (`pnpm test:internals`: every anchor and `getPrivateMethod` target exists in each supported channel's omni unpack) |
| **P1** | before merge when the subsystem is touched | Changecode units (reconstruction vs omni fixtures, sandbox `lazy` merge, `verifyPrivateMethodReplaced` completeness) · version buckets (`Tabmix.isVersion` 1280–1560+) · prefs integrity (every referenced `extensions.tabmix.*` has a default, no orphans) · URL/link logic units                                                                 |
| **P2** | weekly, and per feature area               | E2E: tabs/multi-row · click matrix · dragdrop · links drop matrix                                                                                                                                                                                                                                                                                  |
| **P3** | weekly matrix                              | prefs dialogs · session restore/restart · places/flst/autoreload/titlebar · fork matrix (advisory)                                                                                                                                                                                                                                                 |

## Coverage of changes currently in flight

Every change merged from a `wip/*` branch must carry its covering test (ADR 0003):

| Branch change                                                 | Covering test                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| error-handling/logging rewrite (`wip/error-handling-logging`) | smoke zero-console-error + log.level pref unit                      |
| dead-code sweep                                               | typecheck + smoke boot                                              |
| types-safety, types-safety-1                                  | `pnpm typecheck` **is** the test (behavior-neutral; smoke confirms) |
| perf regex/style caching (`wip/perf`)                         | unit: cached vs uncached result equivalence                         |
| arch: ContentClick re-entrancy fix (`wip/arch`)               | click E2E (ctrl+shift range, re-entrant path)                       |
| arch: `verifyPrivateMethodReplaced` call-site                 | Changecode unit                                                     |
| fix-b9 firefox-source copies                                  | verify-firefox-internals checks the ANCHORS table                   |
| fix-b11 getSandbox lifecycle audit                            | sandbox lifecycle unit                                              |
| E2E engine itself (`wip/test-suite`)                          | its own smoke suite (dogfood)                                       |

## Unit test inventory

1. **Version buckets** — `Tabmix.isVersion` across all branch values (1280…1560+); each bucket
   selects the intended branch.
2. **Changecode.sys.mjs** — `getPrivateMethod` reconstruction against real omni fixtures; sandbox
   `lazy` merge semantics (regression tests for the two sandbox fixes);
   `verifyPrivateMethodReplaced` completeness.
3. **URL/link logic** — `getValidUrl`, `whereToOpenDrop` cases, `_shortenURLRegEx`, `_dataURLRegEx`,
   `_nonPrintingRegEx`.
4. **Prefs integrity** — every referenced `extensions.tabmix.*` pref has a default; no orphan
   defaults (drift detector over the defaults list).
5. **Session store data** — closed-tab serialize/deserialize round-trips.
6. **verify-firefox-internals.mjs** — the audit that caught the recent Firefox-156 breakages,
   automated: assert every `getPrivateMethod` anchor and every `changeCode` `_replace` anchor still
   exists in pinned omni unpacks per channel. Fails when Firefox moves internals — the early-warning
   system.

## E2E suite inventory

The engine and the smoke suite are documented in [test/E2E/README.md](../test/E2E/README.md); new
suites drop into `test/E2E/suites/`. Planned suites, in priority order:

- **smoke** (exists, unreviewed) — boot fresh profile; `window.Tabmix` present; sentinel overrides
  applied; zero console errors; version bucket logged.
- **tabs** (P2) — new-tab button (incl. middle-click paste #574); close buttons; pinned tabs;
  **multi-row** (rows, wrap points, scrollbox arrows); tab width modes; duplicate/merge/detach;
  all-tabs button.
- **click** (P2) — full click-pref matrix; context menu (close to start/end, close other,
  multiselect counts with protected/invisible tabs — ad22f401 regression); link-click
  `whereToOpenLink` matrix.
- **dragdrop** (P2) — reorder single/multiselect; across rows in multi-row; out to new window;
  pinned↔unpinned; drop on new-tab button; Tabmix handlers bound in the 156+ private-method world.
- **links** (P2) — drop 1 link on tab/tabbar/new-tab × `tabmixContentDrop` prefs; **drop 15+ links →
  confirm dialog** (OpenInTabsUtils lazy regression); `whereToOpenDrop` matrix; linkWithHistory;
  loadURI allow/block.
- **prefs** (P3) — all panes + subdialogs; data-driven over the defaults list: set → persists →
  behavior flag readable via bridge; shortcuts editor; number-input validation.
- **session** (P3) — closed-tabs restore; closed-windows submenu; save/restore window session;
  **restart persistence** (second launch, same profile); crash-recovery dialog.
- **places / flst / autoreload / titlebar** (P3) — reopen closed tab; `TMP_Places.asyncGetTabTitle`;
  last-tab-close per prefs; warn-on-close dialog; auto-reload interval; **window title respects
  `privacy.exposeContentTitleInWindow*`** (6417f0fc regression); taskbar path no-throw (f6cea03a).
- **Matrix dimension** — every run reports its `isVersion` bucket; branches exercised per browser
  (156+ private-method world on Nightly/Dev/official, older paths on previous ESR).

## Browser matrix

| Browser                             | Manual (now) | Watchdog (later, daily) | Weekly matrix | Notes                              |
| ----------------------------------- | ------------ | ----------------------- | ------------- | ---------------------------------- |
| Firefox Nightly                     | ✅           | ✅                      | ✅            | earliest 156+ private-method world |
| Firefox Developer Edition           | ✅           | ✅                      | ✅            | beta channel                       |
| Firefox official (release)          | ✅           | —                       | ✅            | required gate                      |
| Firefox latest ESR                  | ✅           | —                       | ✅            | required gate                      |
| Firefox previous ESR                | ✅           | —                       | ✅            | min-version edge (ESR 128 floor)   |
| Zen / Waterfox / Floorp / LibreWolf | ✅           | —                       | ✅            | forks; advisory only               |

Mozilla builds gate; forks report issues but never block. Channel unpack paths are already listed in
`config/.firefox-link.local.json` (see the `firefox-source` skill); browser binaries follow
`firefox-updater/src/helpers/paths.js`.

## CI design (later milestone — `workflow_dispatch` first)

When introduced: `tests.yml` (static → unit → verify-internals → e2e-smoke) on push to main and on
branches; `nightly-watchdog.yml` (daily Nightly + Dev Edition, issue reporting, deduped + auto-
close); `browser-matrix.yml` (weekly, the table above). Windows runners first; browsers cached by
version; smoke-only on push, full subsets on schedules. Nothing scheduled until it has run green
manually via `workflow_dispatch`.

## Local runs

All runners take an optional single-test selector; with no argument they run everything.

| What                            | All                         | Single                                                               |
| ------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| unit tests (`test/unit/`)       | `pnpm test:unit`            | `pnpm test:unit verify-internals` (file-name prefix)                 |
| E2E suites (`test/E2E/suites/`) | `pnpm test:e2e --suite=all` | `pnpm test:e2e --suite=smoke` (or `internals`, …)                    |
| firefox-internals static check  | `pnpm test:internals`       | `node test/internals/verify-firefox-internals.mjs --channel nightly` |

E2E options (`--browser=nightly\|dev\|beta\|release\|esr`, `--binary`, `--headed`, `--keep-profile`)
and prerequisites are documented in [test/E2E/README.md](../test/E2E/README.md). The internals
checker verifies every channel unpack listed in `config/.firefox-link.local.json` plus the active
`firefox_code.local` link; `--channel` limits it to one. Artifacts (screenshots, failure logs) land
in `test/E2E/artifacts/` (gitignored); unit-test output is console-only.

Anchors for code copied from Firefox live in the `ANCHORS` table at the top of
`test/internals/verify-firefox-internals.mjs` (upstream file + symbol, addon copy name when it
differs, documented deliberate diffs) — not as comments in the addon sources. When a copied function
needs a version branch (`if (Tabmix.isVersion(1600)) … else …`), keep both arms anchored: the
checker's `activeVersionGates` parser gives `getPrivateMethod` call sites in each arm their own
gate, and the E2E internals suite exercises whichever arm the running browser takes.

## Implementation order

Estimates in focused work sessions; #7 runs in parallel with the engine phases.

| #   | Deliverable                                                                      | Est.                                                                    |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | E2E engine phase 1 (exists on `wip/test-suite`, **needs review + manual runs**)  | done                                                                    |
| 2   | Unit tests 1–5 + test runner wiring (`pnpm test:unit`)                           | runner **done** (`test/unit/run.mjs`, 2026-09-14); inventories 1–5 open |
| 3   | verify-firefox-internals.mjs + omni fixtures per channel                         | **done** (`test/internals/verify-firefox-internals.mjs`, all channels)  |
| 4   | tabs suite (multi-row, pinned, widths, #574)                                     | 2–3 d                                                                   |
| 5   | links suite (drop matrix, 15+ confirm, loadURI)                                  | 1–1.5 d                                                                 |
| 6   | click suite (full pref matrix, multiselect counts)                               | 2 d                                                                     |
| 7   | dragdrop suite (reorder, multi-row, 156+ bindings)                               | 2 d                                                                     |
| 8   | prefs data-driven suite (panes, defaults, subdialogs)                            | 3–4 d                                                                   |
| 9   | session suite (restore, restart persistence, crash dialog)                       | 2 d                                                                     |
| 10  | places / flst / autoreload / titlebar suites                                     | 2 d                                                                     |
| 11  | `workflow_dispatch` CI (tests.yml) — manual trigger, run green before scheduling | 0.5–1 d                                                                 |
| 12  | nightly-watchdog.yml + issue reporting                                           | 1–1.5 d                                                                 |
| 13  | browser-matrix.yml (full table incl. forks)                                      | 2–3 d                                                                   |
