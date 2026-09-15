# Tab Mix Plus — E2E engine (phase 1: local runs)

Runs real Firefox instances against a freshly built Tab Mix Plus profile using `puppeteer-core` +
WebDriver BiDi. Phase-1 engine of the test suite — priorities and the planned suites live in
[docs/test-plan.md](../../docs/test-plan.md); this README covers only the engine: run commands,
prerequisites, and platform gotchas.

**Status: smoke suite 11/11 PASS on Firefox Nightly 156+ and official release; verified by the
maintainer on Windows 11 (2026-09-13).**

## Run the E2E suites

```bash
node test/E2E/run.mjs --suite=smoke          # one suite (default: smoke)
node test/E2E/run.mjs --suite=all            # every suite, sequential, summary at the end
node test/E2E/run.mjs --list                 # list available suites
# options:
#   --browser=nightly|dev|beta|release|esr   (default: nightly)
#   --binary="C:/path/to/firefox.exe"        (explicit exe; wins over --browser)
#   --headed                                 (show the browser window)
#   --keep-profile                           (keep the temp profile for debugging)
#   --list                                   (list suites)
```

`FIREFOX_BINARY` env var also works. Exit code 0 = all checks passed. With `--suite=all` a single
failing suite does not stop the rest; the final summary and the exit code reflect every suite.

The same entry points exist as pnpm scripts (`pnpm test:e2e`, `pnpm test:unit`,
`pnpm test:internals` in package.json): `pnpm test:e2e --suite=smoke`, `pnpm test:e2e --suite=all`,
`pnpm test:unit` (test/unit runner, same all-or-single pattern), and `pnpm test:internals` (the
static Firefox-internals checker).

## Prerequisites

- The browser binaries from `firefox-updater/src/helpers/paths.js` are installed (Nightly, Dev
  Edition, Beta, Release, ESR) — `shared/config.mjs` maps channels to those exact paths.
- `puppeteer-core` (devDependency, installed via pnpm).
- The reference profile with the userChromeJS `utils/` loader (`oxc75ep9.firefox-changes-log`) — its
  loader files are copied into every test profile. The fx-folder files (`config.js`,
  `config-prefs.js`) are already installed in the browser dirs, so no installer step is needed
  locally.

## How it works

```
test/E2E/
  run.mjs              CLI entry (parses args, loads a suite)
  bridge/
    tabmix-e2e.uc.js   privileged .uc.js — window marker + console capture
    client.xhtml       chrome-privileged client page (a trusted tab)
    client.js          its external script (BiDi eval entry points)
  shared/
    config.mjs         binaries, paths, default prefs
    profileFactory.mjs builds a fresh profile per run (+ userChrome.js patch)
    launch.mjs         puppeteer BiDi launch + tagged cleanup + logging
    bridgeClient.mjs   finds the client tab, evalInMain helpers
    assert.mjs         check()/summary()/waitForValue helpers
  suites/
    smoke.mjs          the P0 gate: Tabmix alive, console clean (see docs/test-plan.md)
    internals.mjs      runtime complement of verify-firefox-internals (private-method + sandbox invariants)
  artifacts/           screenshots + failure logs (gitignored)
```

Per run the profile factory:

1. creates a fresh temp profile dir,
2. copies the userChromeJS loader into `chrome/utils/` (from the reference profile) —
   `userChrome.js` is **patched** (see below),
3. registers the client page in `chrome/utils/chrome.manifest` (`content tabmix-e2e ./` →
   `chrome://tabmix-e2e/content/client.xhtml`),
4. copies `bridge/tabmix-e2e.uc.js` into profile `chrome/` (the loader scans `*.uc.js` there),
5. **copies** `addon/` content (never a link — links previously caused the real addon to be deleted)
   into `extensions/{dc572301-7619-498c-a57d-39143191b318}`,
6. writes `user.js` with deterministic prefs (`extensions.autoDisableScopes=0`, telemetry off,
   updates off, …). Note puppeteer **overwrites** `user.js` at launch — prefs that must reach
   Firefox go through `extraPrefsFirefox` in `launchFirefox()`, including
   `extensions.tabmix.version` (pre-set to the real addon version from `install.rdf` so the "New
   Version Installed" update page never opens).

## Hard-won facts about the platform (do not relearn these)

- **BiDi cannot navigate to chrome:// URLs** and does not expose chrome windows as puppeteer pages.
  The main window's page shows a junk URL (`https://0.0.5.120/` = the string "1400" parsed as a host
  — never pass `--width=1400` to Firefox; the remote agent eats it as a URL argument).
- **Inline scripts in chrome XHTML pages do not execute** when such a page is opened in a tab.
  Tabmix's own update page uses an external `update.js` — the client page does the same (`client.js`
  via `chrome://tabmix-e2e/content/`).
- **A chrome-privileged page in a regular tab IS reachable from BiDi**: script evaluation runs with
  system privileges there. The client page forwards calls into the real browser window via
  `Services.wm.getMostRecentWindow()` + `new main.Function(...)`, returning structured-cloned
  results.
- **The userChromeJS loader needed a one-line-class patch**: `config.js` loads `BootstrapLoader.js`
  before `userChrome.js` in the same autoconfig sandbox; BootstrapLoader pins a non-configurable
  `AppConstants` on the global, so `userChrome.js`'s
  `ChromeUtils.defineESModuleGetters(this, {...})` threw "can't redefine non-configurable property
  AppConstants" and **no .uc.js script ever ran**. The profile factory rewrites that call into a
  guarded loop (`if (!(k in this)) …`) and wraps the script in try/catch reporting its fate to the
  `tabmix.e2e.ucjsLoaded` pref (the autoconfig sandbox swallows errors).
- **`.uc.js` scripts run in a Cu sandbox**, so top-level `window` is not the real chrome window —
  the bridge resolves everything through `Services.wm`.
- Puppeteer overwrites `user.js` at launch; test prefs must go through `extraPrefsFirefox` (the
  launcher merges `PROFILE_PREFS` there).
- **Headed runs (`--headed`) on puppeteer-core 25.6+ / Windows**: the browser window stays invisible
  (fully laid out DOM window, but `MainWindowHandle` = 0) until the first BiDi
  `browsingContext.activate`; 25.5 realized it at launch. `launchFirefox()` therefore calls
  `page.bringToFront()` right after a non-headless launch. Confirmed against puppeteer-core 25.5.0
  vs 25.10.0 with identical spawn args (2026-09-15).
- `ignoreDefaultArgs: ["--disable-extensions"]` is mandatory or the sideloaded legacy extension
  never boots; `-remote-allow-system-access` is required for BiDi script evaluation on privileged
  pages.
- Benign console noise on a fresh profile (already filtered by the smoke suite's regex — extend it,
  don't clear it): repeated
  `shell_windows::taskbar::shortcut Error matching shortcut: HRESULT(0x80004005)` (headless profile
  has no taskbar shortcut to match),
  `PrivateBrowsingUtils.sys.mjs … can't access property "QueryInterface"` with
  `Window.docShell is null` (a closing window raced the profile teardown), and
  `Dynamically enable window occlusion 1` (headless mode banner).
- Process-stderr lines from platform code (`resource://gre/`, `resource://app/`, `shell_windows`,
  occlusion banners) are tagged `[ff:platform]` instead of `[ff:err]` — see `attachProcessLogging`
  in `shared/launch.mjs`. Only `[ff:err]` lines deserve eyes.

## The bridge

`bridge/tabmix-e2e.uc.js` (userChromeJS sandbox, `@include main`, `@onlyonce`):

- sets `window.__tabmixE2E` on the **real** browser window (marker + console buffers the suites read
  via the client page),
- registers a `Services.console` listener (errors/exceptions land in `__tabmixE2E.consoleErrors` —
  suites assert "zero console errors" against it),
- opens the client page as a background trusted tab (best effort; the runner navigates itself if the
  tab is missing).

`bridge/client.js` (chrome-privileged, evaluated from Node over BiDi) exposes:

- `__e2eEval(source)` — sync expression in the main window,
- `__e2eEvalAsync(source)` — async body in the main window (await Tabmix promises inside),
- `__e2eScreenshot()` — PNG data URL of the main window via `drawWindow`.

## Adding a suite

Create `suites/<name>.mjs` exporting `name` and `async run(opts) => boolean`, using the shared
helpers. `run.mjs --suite=<name>` picks it up automatically, and `--suite=all` includes it in the
next full run.

## Artifacts

`test/E2E/artifacts/` is **failure-only** — a green run leaves nothing behind. A failed run saves:

- `smoke-failure-<ts>.png` — window screenshot (smoke suite, taken at teardown)
- `smoke-failure-<ts>.log` — captured Firefox stdout/stderr (smoke suite, on exception)

The directory is gitignored.
