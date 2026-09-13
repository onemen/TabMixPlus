# Tab Mix Plus — Test plan

The living test document: what we test, in what priority order, and which test covers the changes
currently in flight. Decisions (repo-local tests, local-first, CI later) are recorded in
[ADR 0003](./decisions/0003-local-first-test-suite.md). Committed from the maintainer's
TEST-PLAN.local.md — edit this file, not that one.

> **Status:** the E2E engine (phase 1) exists on `wip/test-suite` — see
> [test/E2E/README.md](../test/E2E/README.md) for how it works and how to run it. It has **not**
> been maintainer-reviewed or manually exercised yet; treat its "11/11 PASS" as the author's claim,
> not a verified gate.

## Priority tiers

| Tier   | When it runs                               | Tests                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | before every merge to main                 | `pnpm typecheck` · `pnpm lint` · **smoke E2E** (fresh profile boots, `window.Tabmix` present, sentinel overrides applied, zero console errors) · **verify-firefox-internals** (every `getPrivateMethod` / `changeCode` anchor exists in each supported channel's omni unpack)      |
| **P1** | before merge when the subsystem is touched | Changecode units (reconstruction vs omni fixtures, sandbox `lazy` merge, `verifyPrivateMethodReplaced` completeness) · version buckets (`Tabmix.isVersion` 1280–1560+) · prefs integrity (every referenced `extensions.tabmix.*` has a default, no orphans) · URL/link logic units |
| **P2** | weekly, and per feature area               | E2E: tabs/multi-row · click matrix · dragdrop · links drop matrix                                                                                                                                                                                                                  |
| **P3** | weekly matrix                              | prefs dialogs · session restore/restart · places/flst/autoreload/titlebar · fork matrix (advisory)                                                                                                                                                                                 |

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
| fix-b9 `@tabmix-anchor` markers                               | verify-firefox-internals parses the markers                         |
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

- `node test/E2E/run.mjs --suite=smoke` (options and prerequisites: see
  [test/E2E/README.md](../test/E2E/README.md))
- planned: `pnpm test:unit`, `pnpm test:e2e --suite=<name>`, `pnpm verify:internals`
- artifacts (screenshots, failure logs) land in `test/E2E/artifacts/` (gitignored)

## Implementation order

Estimates in focused work sessions; #7 runs in parallel with the engine phases.

| #   | Deliverable                                                                      | Est.    |
| --- | -------------------------------------------------------------------------------- | ------- |
| 1   | E2E engine phase 1 (exists on `wip/test-suite`, **needs review + manual runs**)  | done    |
| 2   | Unit tests 1–5 + test runner wiring (`pnpm test:unit`)                           | 2–3 d   |
| 3   | verify-firefox-internals.mjs + omni fixtures per channel                         | 1–1.5 d |
| 4   | tabs suite (multi-row, pinned, widths, #574)                                     | 2–3 d   |
| 5   | links suite (drop matrix, 15+ confirm, loadURI)                                  | 1–1.5 d |
| 6   | click suite (full pref matrix, multiselect counts)                               | 2 d     |
| 7   | dragdrop suite (reorder, multi-row, 156+ bindings)                               | 2 d     |
| 8   | prefs data-driven suite (panes, defaults, subdialogs)                            | 3–4 d   |
| 9   | session suite (restore, restart persistence, crash dialog)                       | 2 d     |
| 10  | places / flst / autoreload / titlebar suites                                     | 2 d     |
| 11  | `workflow_dispatch` CI (tests.yml) — manual trigger, run green before scheduling | 0.5–1 d |
| 12  | nightly-watchdog.yml + issue reporting                                           | 1–1.5 d |
| 13  | browser-matrix.yml (full table incl. forks)                                      | 2–3 d   |
