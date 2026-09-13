# Tab Mix Plus — E2E engine (phase 1: local runs)

Runs real Firefox instances against a freshly built Tab Mix Plus profile using `puppeteer-core` +
WebDriver BiDi. Phase-1 engine of the test suite — see [docs/test-plan.md](../../docs/test-plan.md)
for priorities and the planned suites; this README covers only the engine: run commands,
prerequisites, and platform gotchas.

**Status: smoke suite 11/11 PASS on Firefox Nightly 156+ and official release; verified by the
maintainer on Windows 11 (2026-09-13).**

## Run the smoke test

```bash
node test/E2E/run.mjs --suite=smoke
# options:
#   --browser=nightly|dev|beta|release|esr   (default: nightly)
#   --binary="C:/path/to/firefox.exe"        (explicit exe; wins over --browser)
#   --headed                                 (show the browser window)
#   --keep-profile                           (keep the temp profile for debugging)
#   --list                                   (list suites)
```

`FIREFOX_BINARY` env var also works. Exit code 0 = all checks passed.

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
   updates off, `extensions.tabmix.version` pre-set so the version-update page does not open, …).

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
  the bridge resolves everything through `Services.wm`.- Puppeteer overwrites `user.js` at launch;
  test prefs must go through `extraPrefsFirefox` (the launcher merges `PROFILE_PREFS` there).
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
helpers. `run.mjs --suite=<name>` picks it up automatically.

## Artifacts

`test/E2E/artifacts/` receives screenshots and, on a crash, the captured Firefox stdout/stderr log.
The directory is gitignored.
