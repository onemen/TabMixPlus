# Tab Mix Plus — Test plan

The living test document: what we test, in what priority order, and which test covers the changes
currently in flight. Decisions (repo-local tests, local-first, CI later) are recorded in
[ADR 0003](./decisions/0003-local-first-test-suite.md).

> This file is the **single source of truth** — reunified on 2026-09-15 from the maintainer's
> `TEST-PLAN.local.md` (which existed untracked between 2026-09-14 and 2026-09-15). Edit this file;
> do not fork it back into a `*.local.*` copy.

> **Status:** the E2E engine (phase 1) with the smoke + internals suites, the dev-line suite (the
> `wip/cleanup` branch changes: dead-code sweep + autoreload fix; a logger section is added on
> `wip/error-handling-logging`), the unit runner (`pnpm test:unit`, seeded with verify-internals
> unit tests), the static verify-firefox-internals check, and the `pr-checks` workflow (lint +
> typecheck + unit on PRs and pushes to main) exist — see
> [test/E2E/README.md](../test/E2E/README.md) for how the engine works and
> [Local developer experience](#8-local-developer-experience) for the commands. The smoke suite
> passed 11/11 on Firefox Nightly, verified manually on Windows 11 (2026-09-13); `--suite=all`
> (internals + smoke) passed on 2026-09-14; the cleanup-branch suite passed 15/15 on Nightly and
> 23/23 with the logger section on the logger branch (2026-09-16). Remaining before the coverage
> rule activates: the P1 unit inventories and the P2 suites.

## Priority tiers

| Tier   | When it runs                               | Tests                                                                                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | before every merge to main                 | `pnpm typecheck` · `pnpm lint` · `pnpm test:unit` · **smoke E2E** (`pnpm test:e2e --suite=smoke`: fresh profile boots, `window.Tabmix` present, sentinel overrides applied, zero console errors) · **verify-firefox-internals** (`pnpm test:internals`: every anchor and `getPrivateMethod` target exists in each supported channel's omni unpack) |
| **P1** | before merge when the subsystem is touched | Changecode units (reconstruction vs omni fixtures, sandbox `lazy` merge, `verifyPrivateMethodReplaced` completeness) · version buckets (`Tabmix.isVersion` 1280–1560+) · prefs integrity (every referenced `extensions.tabmix.*` has a default, no orphans) · URL/link logic units                                                                 |
| **P2** | weekly, and per feature area               | E2E: tabs/multi-row · click matrix · dragdrop · links drop matrix · fluent/l10n                                                                                                                                                                                                                                                                    |
| **P3** | weekly matrix                              | prefs dialogs · session restore/restart · places/flst/autoreload/titlebar · fork matrix (advisory)                                                                                                                                                                                                                                                 |

## Coverage of changes currently in flight

Every change merged from a `wip/*` branch must carry its covering test (ADR 0003):

| Branch change | Covering test | | ------------------------------------------------------------- |
------------------------------------------------------------------- || error-handling/logging
rewrite (`wip/error-handling-logging`) | unit: `test/unit/logger.test.mjs` (shimmed module logic);
E2E dev-suite logger section (surface, `log.level` pref at boot, live `[Tabmix:...]` ConsoleAPI
capture, legacy helpers gone); smoke zero-console-error | | dead-code sweep (dev `e597603d` +
`a7c481fa`) | E2E dev-suite sweep section: no `.substr(` in swept files, `nonStrictMode` gone,
DynamicRules dead state gone; typecheck + smoke boot | | autoreload data-command fix (dev
`f42b4a34`) | E2E dev-suite autoreload section: enable item found by `data-command="toggle"`, full
enable/disable round-trip, no timer leak | | types-safety, types-safety-1 | `pnpm typecheck` **is**
the test (behavior-neutral; smoke confirms) | | perf regex/style caching (`wip/perf`) | unit: cached
vs uncached result equivalence | | arch: ContentClick re-entrancy fix (`wip/arch`) | click E2E
(ctrl+shift range, re-entrant path) | | arch: `verifyPrivateMethodReplaced` call-site | Changecode
unit | | fix-b9 firefox-source copies | verify-firefox-internals checks the ANCHORS table | |
fix-b11 getSandbox lifecycle audit | sandbox lifecycle unit | | E2E engine itself (`wip/test-suite`)
| its own smoke suite (dogfood) |

### Decisions

- **Location: this repo** (`test/` alongside the addon). Unit tests and `verify-firefox-internals`
  read the addon sources directly, and PRs run E2E against the PR's own XPI build — a separate repo
  could only test the last published dev-build.
- **Branching: all test-suite work happens on a dedicated branch** (`wip/test-suite`), never
  directly on main. Many small commits are fine there; main stays clean.
  - Milestone slices can land on main via PR when _you_ decide (after #6 PR-CI green, after #13
    watchdog live) — merging is a manual choice, not automatic.
  - PRs from the branch already exercise the PR checks via the `pull_request` trigger, so everything
    is validated incrementally without touching main. Scheduled watchdogs/matrix only activate once
    the workflows exist on main.
  - Rebase/merge main into the branch periodically during the build (Firefox-compat work keeps
    moving main).

## 1. Goals

- **Unit tests** for pure logic (version buckets, Changecode, URL utils, prefs integrity) — fast, no
  browser.
- **E2E tests** with puppeteer-core + Firefox (WebDriver BiDi), exactly the pattern from
  `firefox-updater/src/services/firefoxPuppeteer.js`: `browser: "firefox"`,
  `protocol: "webDriverBiDi"`, headless, `ignoreDefaultArgs: ["--disable-extensions"]`,
  `-new-instance -no-remote`, profile-tagged process cleanup.
- **CI on every PR / push to main**, **daily Nightly watchdog**, **weekly all-browsers matrix**,
  with **GitHub-issue reporting** (deduped, auto-close, status meta-issue — port of firefox-scripts
  `url-watchdog.yml`).
- Everything runs **locally too** (same scripts, same profile factory).

## 2. Critical enabler — the E2E environment

Modern Firefox can't run Tabmix without the firefox-scripts legacy loader. The profile factory (CI +
local) will:

1. Download a **portable/unpacked browser build** and unzip it (same approach as firefox-updater's
   `unzipStandalone.js`) — writable install dir, no installer.
2. Download `fx-folder.zip` + `utils.zip` from
   `https://github.com/onemen/TabMixPlus/releases/download/dev-build/` (always latest) and install
   per the docs: `config.js` → browser root, `config-prefs.js` → `defaults/pref/`, `utils/` →
   `[profile]/chrome/utils/`.
3. Zip `addon/` → `tab_mix_plus.xpi`, sideload into `profile/extensions/` with
   `extensions.autoDisableScopes=0` via generated `user.js`.
4. Delete `compatibility.ini` + startupCache (the "Clear startup cache" step — same as
   `removeProfileCompatibilityIni` in firefoxPuppeteer.js).
5. **Chrome-privilege bridge** (`tabmix-e2e.uc.js`, a `.uc.js` run by the utils loader from profile
   `chrome/`): custom-event bridge for privileged operations (tabs, prefs via `Tabmix`, `gBrowser`
   state, `Services.wm`), console-error capture via `Services.console`. Zero addon-code changes.
   Fallback `-chrome <url>` relaunch (from `firefox-updater-test.mjs`) for privileged pages.

   Phase 1 status: the bridge exists (`test/E2E/bridge/`) and works locally against the browsers
   installed by firefox-updater (paths in `config/.firefox-link.local.json`); the portable-download
   path is still what makes this hermetic on CI runners.

## 3. Repository layout

```
test/
  unit/                  # *.test.mjs (zero-dependency runner: test/unit/run.mjs)
  E2E/
    shared/              # profileFactory.mjs, launch.mjs, bridgeClient.mjs, run.mjs
    suites/              # smoke.mjs (exists), internals.mjs (exists), tabs.mjs, click.mjs,
                         # dragdrop.mjs, links.mjs, prefs.mjs, session.mjs, places.mjs, flst.mjs,
                         # autoreload.mjs, titlebar.mjs, fluent.mjs
    artifacts/           # gitignored: failure-only screenshots + failure logs
  internals/             # verify-firefox-internals.mjs (static omni-unpack audit)
.github/workflows/
  pr-checks.yml          # exists: lint + typecheck + unit on PRs / pushes to main
  tests.yml              # planned: static, unit, verify-internals, e2e-smoke
  nightly-watchdog.yml   # planned: daily cron: Nightly + Developer Edition + E2E subset + issues
  new-version-watchdog.yml # planned: run unit + E2E when a browser/fork publishes a new version
  browser-matrix.yml     # planned: weekly cron: full 9-browser matrix + issue reporting
```

## 4. Unit test inventory

1. **Version buckets** — `Tabmix.isVersion` across all branch values (1280…1560+); each bucket
   selects the intended branch.
2. **Changecode.sys.mjs** — `getPrivateMethod` reconstruction against real omni fixtures; sandbox
   `lazy` merge semantics (regression tests for the two sandbox fixes);
   `verifyPrivateMethodReplaced` completeness.
3. **URL/link logic** — `getValidUrl`, `whereToOpenDrop` cases, `_shortenURLRegEx`, `_dataURLRegEx`,
   `_nonPrintingRegEx`.
4. **Prefs integrity** — every `extensions.tabmix.*` referenced in code has a default; no orphan
   defaults (drift detector over the defaults file plus code-registered defaults: `log.level` in
   logger.sys.mjs, tab-context visibility prefs in TabContextConfig).
5. **Session store data** — closed-tab serialize/deserialize round-trips.
6. **verify-firefox-internals.mjs** (the audit that caught the recent Firefox-156 breakages,
   automated): assert every `getPrivateMethod` anchor and every `changeCode` `_replace` anchor still
   exists in pinned omni unpacks per channel. Fails CI when Firefox moves internals — the
   early-warning system. (Exists; its ANCHORS/scanner helpers are seeded with unit tests.)
7. **logger.sys.mjs** (exists on `wip/error-handling-logging`) — pure, V8-safe logic under Firefox
   shims: `log.level` pref bootstrap branch, stack introspection (`_name`,
   `_getStackExcludingInternal`, `_getNames`), `makeError`, `reportError` filtering. The ConsoleAPI
   instance itself and live `Error().stack` introspection are covered by the dev-suite E2E logger
   section. (Exists: `test/unit/logger.test.mjs`.)

## 5. E2E suite inventory (full list; prioritize later)

- **smoke** (exists) — boot fresh profile; `window.Tabmix` present; sentinel overrides applied;
  **zero console errors**; version bucket logged.
- **internals** (exists) — runtime complement of verify-firefox-internals: `planned` ⊆ `replaced`
  private-method invariant, sandbox lifecycle, clean boot console.
- **dev (exists, `wip/cleanup`) — cleanup-branch regression gate:** autoreload popup enable item
  found by `data-command="toggle"` with a real dispatched command event (full enable/disable
  round-trip, no timer leak); dead-code sweep assertions (`.substr(` gone from swept files,
  `nonStrictMode` gone, DynamicRules dead state gone). On `wip/error-handling-logging` it gains the
  **logger section**: module surface via `Tabmix.console`, `extensions.tabmix.log.level` present at
  boot, `callerName`/`callerTrace` on live `Error().stack`, a live `Tabmix.console.log` write
  captured in ConsoleAPIStorage with the `Tabmix` prefix, and
  clog/isCallerInList/`TabmixSvc.console` gone.
- **tabs (tab/ + minit)** — new-tab button (incl. middle-click paste #574); close buttons; pinned
  tabs; **multi-row** (rows, wrap points, scrollbox arrows); tab width modes;
  duplicate/merge/detach; all-tabs button.
- **click (click.js)** — full click-pref matrix (select variants, middle/double close, ctrl
  multiselect, ctrl+shift range, altClick cases); context menu (close to start/end, close other,
  **multiselect counts with protected/invisible tabs** — ad22f401 regression); link-click
  `whereToOpenLink` matrix.
- **dragdrop (minit.js)** — reorder single/multiselect; across rows in multi-row; out to new window;
  pinned↔unpinned; drop on new-tab button; Tabmix handlers bound in the 156+ private-method world.
- **links (tablib)** — drop 1 link on tab/tabbar/new-tab × `tabmixContentDrop` prefs; **drop 15+
  links → confirm dialog** (OpenInTabsUtils lazy regression); `whereToOpenDrop` matrix;
  linkWithHistory; background loading; loadURI allow/block (setLoadURI wrappers).
- **prefs (preferences/)** — open all panes + subdialogs; data-driven: for each of the 158 file
  defaults (plus code-registered defaults) set → persists → behavior flag readable via bridge;
  shortcuts editor; number-input validation.
- **session** — closed-tabs restore; closed-windows submenu; save/restore window session; **restart
  persistence** (second launch, same profile); crash-recovery dialog.
- **places / flst / autoreload / titlebar** — reopen closed tab; `TMP_Places.asyncGetTabTitle` +
  changed-label; last-tab-close per prefs; warn-on-close dialog; auto-reload interval; **window
  title respects `privacy.exposeContentTitleInWindow*`** (6417f0fc regression); taskbar path
  no-throw (f6cea03a).
- **fluent / l10n** — zero l10n errors for every ID Tabmix injects:
  `[fluent] Missing message in locale`, `[fluent] Couldn't find a message`,
  `[dom/l10n] Errors during l10n mutation frame` — asserted at startup AND after opening the tab
  context menu, the all-tabs button, and the preferences panes (l10n mutations happen on
  interaction, not just at boot). The bridge's console capture already sees these; the suite scans
  its buffer for the fluent/dom-l10n patterns and reports the missing IDs. Static counterpart in
  verify-firefox-internals: every `data-l10n-id` / `data-lazy-l10n-id` / `convert(data.l10n)` id
  used in the addon exists in the channel's en-US bundles — catches Firefox-side ID renames (e.g.
  `content-blocking-reload-tabs-button-*`) before any user sees a raw ID.
- **Matrix dimensions** — every run reports `isVersion` bucket; Tabmix `isVersion` branches
  exercised per browser (156+ private-method world on Nightly/Dev/official, 151–155 paths on older
  ESRs, Waterfox's built-in loader variant).

## 6. Browser test matrix (final)

| Browser                        | Watchdog (daily) | Weekly matrix | Notes                                            |
| ------------------------------ | ---------------- | ------------- | ------------------------------------------------ |
| **Firefox Nightly**            | ✅               | ✅            | earliest 156+ private-method world               |
| **Firefox Developer Edition**  | ✅               | ✅            | beta channel                                     |
| **Firefox official (release)** | —                | ✅            | required gate                                    |
| **Firefox latest ESR**         | —                | ✅            | required gate                                    |
| **Firefox previous ESR**       | —                | ✅            | min-version edge (ESR 128 floor per install.rdf) |
| **Zen Browser (latest)**       | —                | ✅            | fork; advisory status                            |
| **Waterfox (latest)**          | —                | ✅            | fork; built-in loader variant                    |
| **Floorp (latest)**            | —                | ✅            | fork; advisory status                            |
| **LibreWolf (latest)**         | —                | ✅            | fork; advisory status                            |

Mozilla builds = required checks; the four forks = advisory (failures report issues but don't gate).
Browser resolvers follow firefox-updater `get_download_url.js` / firefox-scripts `downloads.mjs`
patterns (Nightly/Dev/official/ESR via `download.mozilla.org`; forks via their release feeds).

## 7. CI design (Windows runners for now; Linux added with CSS/visual suites)

- **pr-checks.yml** (exists: PR + push to main): `lint:clean` → `typecheck:clean` → `unit`.
- **tests.yml** (planned: PR + push): adds `verify-internals` → `e2e-smoke` (Nightly + official).
  Path-filtered (firefox-scripts `ci.yml` pattern); checks always report.
- **nightly-watchdog.yml** (daily): Nightly + Developer Edition, smoke + tabs + links + dragdrop;
  green → auto-close issues + update table; red → deduped issue.
- **new-version-watchdog.yml** (daily): feed-check (same resolvers as the matrix) for new versions
  of every monitored browser and fork; when a browser or fork publishes a new version, run unit +
  the E2E subset against it and route failures through the same issue pipeline (dedupe +
  auto-close). A brand-new fork starts as a resolver + advisory matrix row (§6).
- **browser-matrix.yml** (weekly): the full 9-browser table above.
- **Issue reporting**: status meta-issue with per-browser × suite table, deduped failure issues
  (`suite + browser` key), auto-close on next green — url-watchdog port.
- Caching by browser version; artifacts on failure; `workflow_dispatch` with browser/version pin for
  manual escapes.

## 8. Local developer experience

| What                            | All                         | Single                                                               |
| ------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| unit tests (`test/unit/`)       | `pnpm test:unit`            | `pnpm test:unit verify-internals` (file-name prefix)                 |
| E2E suites (`test/E2E/suites/`) | `pnpm test:e2e --suite=all` | `pnpm test:e2e --suite=smoke` (or `internals`, …)                    |
| firefox-internals static check  | `pnpm test:internals`       | `node test/internals/verify-firefox-internals.mjs --channel nightly` |

E2E options (`--browser=nightly\|dev\|beta\|release\|esr`, `--binary`, `--headed`, `--keep-profile`)
and prerequisites are documented in [test/E2E/README.md](../test/E2E/README.md). `FIREFOX_BINARY=…`
also works. The internals checker verifies every channel unpack listed in
`config/.firefox-link.local.json` plus the active `firefox_code.local` link; `--channel` limits it
to one. Artifacts are failure-only (screenshots, failure logs) in `test/E2E/artifacts/`
(gitignored); unit-test output is console-only.

Anchors for code copied from Firefox live in the `ANCHORS` table in
`test/internals/verify-firefox-internals.mjs`, not in addon-source comments. When a copied function
needs a version branch (`if (Tabmix.isVersion(N)) … else …`, for any real bucket N), keep both arms
anchored: the checker's `activeVersionGates` parser gives `getPrivateMethod` call sites in each arm
their own gate, and the E2E internals suite exercises whichever arm the running browser takes.

## 9. Implementation order & estimates

Working-day estimates (1 day ≈ one focused agent/developer session; ranges cover debugging
browser/CI quirks). Cumulative ≈ **22–27 days (~5 weeks)**.

> Done so far: engine items #1–#5 exist (phase 1) — implemented against the locally installed
> browsers from firefox-updater instead of the portable-download path (#1 partial); unit runner +
> verify-internals seed tests from #7; #8 done; #6 partial (pr-checks: lint + typecheck + unit,
> without verify-internals/e2e-smoke yet).

| #   | Deliverable                                                                                                           | Est.    | Depends on                  |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------- |
| 1   | **Browser fetcher** (portable download/unzip/cache; Nightly, Dev, official, ESRs; fork resolvers stubbed)             | 0.5–1 d | —                           |
| 2   | **Profile factory** (fx-folder/utils install, XPI sideload, user.js, cache purge)                                     | 1–1.5 d | #1                          |
| 3   | **Launcher + cleanup** (puppeteer BiDi launch, process-tag kill, console capture)                                     | 0.5–1 d | #2                          |
| 4   | **Bridge** (`tabmix-e2e.uc.js` + client helpers)                                                                      | 1 d     | #3                          |
| 5   | **Smoke suite + run.mjs CLI** (`--suite`, `--keep-profile`)                                                           | 0.5–1 d | #4                          |
| 6   | **tests.yml** (static + unit + e2e-smoke on PR/push)                                                                  | 0.5 d   | #5                          |
| 7   | **Unit tests 1–5** (version buckets, changecode+sandbox regressions, URL logic, prefs integrity, session round-trips) | 2–3 d   | — (parallel with #1–5)      |
| 8   | **verify-firefox-internals.mjs** + omni fixtures                                                                      | 1–1.5 d | —                           |
| 9   | **tabs suite** (multi-row, pinned, widths, #574)                                                                      | 2–3 d   | #5                          |
| 10  | **links suite** (drop matrix, 15+ confirm, loadURI)                                                                   | 1–1.5 d | #5                          |
| 11  | **click suite** (full pref matrix, multiselect counts)                                                                | 2 d     | #5                          |
| 12  | **dragdrop suite** (reorder, multi-row, 156+ binding checks)                                                          | 2 d     | #9 (multi-row)              |
| 13  | **nightly-watchdog.yml + issue reporting port** (Nightly + Dev Edition daily)                                         | 1–1.5 d | #6, #9–11                   |
| 14  | **prefs data-driven suite** (8 panes, ~158 prefs, subdialogs)                                                         | 3–4 d   | #4                          |
| 15  | **session suite** (restore, restart persistence, crash dialog)                                                        | 2 d     | #5                          |
| 16  | **places / flst / autoreload / titlebar suites** (incl. 6417f0fc + f6cea03a regressions)                              | 2 d     | #5                          |
| 17  | **browser-matrix.yml** (full 9-browser weekly matrix)                                                                 | 2–3 d   | #13, fork resolvers from #1 |
| 18  | **fluent/l10n suite** (E2E console-pattern scan + static ID-existence check in the unpack)                            | 1 d     | #5, #8                      |
| 19  | **new-version watchdog** (feed poller runs unit + E2E on new browser/fork versions)                                   | 1 d     | #13                         |

**Milestones:** after #6 → CI green on every PR. After #13 → daily Nightly + Dev Edition watchdog
live. After #17 → full 9-browser weekly matrix. After #19 → every new browser/fork version is tested
on arrival. Item #7 runs in parallel throughout.

## 10. Risks & mitigations

- **BiDi chrome-window limits** → bridge user-script; `-chrome` fallback; headed fallback on
  Windows.
- **Profile flakiness** → fresh profile per run; compatibility.ini/startupCache purge; version-keyed
  caches.
- **Watchdog noise** → dedupe + auto-close; forks advisory-only.
- **Windows CI minutes** → path filters, concurrency, cached browsers, smoke-only on PRs; full
  subsets on schedules.
- **Download URL rot** → resolvers exercised daily by the watchdog itself (failure = actionable
  issue).
