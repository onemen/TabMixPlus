/**
 * Launcher — puppeteer-core + Firefox (WebDriver BiDi).
 *
 * Pattern from firefox-updater/src/services/firefoxPuppeteer.js:
 *
 * - protocol: "webDriverBiDi"
 * - ignoreDefaultArgs: ["--disable-extensions"] (so the sideloaded addon loads)
 * - -new-instance -no-remote
 * - orphan cleanup marker: the unique temp-profile path (already on the command
 *   line via `--profile`) — do NOT inject a custom CLI flag, Firefox logs
 *   "unrecognized command line flag" for it in the Browser Console
 * - compatibility.ini purge for profile hygiene
 */

import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import puppeteer from "puppeteer-core";
import {PROFILE_PREFS, readAddonVersion} from "./config.mjs";
import {removeProfileCompatibilityIni} from "./profileFactory.mjs";

// the screenshotMain evaluate() callback runs in the browser, not in Node.
/* global window */

// Every Firefox exe started by this run is matched by its command line
// carrying the run's unique markers (see launchFirefox — the temp profile
// path).
/**
 * Launch Firefox with puppeteer-core over WebDriver BiDi.
 *
 * @param {object} opts
 * @param {string} opts.binary - absolute path to firefox.exe
 * @param {string} opts.profileDir - profile directory (userDataDir)
 * @param {boolean} [opts.headless=true] Default is `true`
 * @param {Record<string, boolean | number | string>} [opts.extraPrefs] - merged
 *   over PROFILE_PREFS
 * @returns {Promise<{
 *   browser: import("puppeteer-core").Browser;
 *   processTags: string[];
 * }>}
 */
export async function launchFirefox({binary, profileDir, headless = true, extraPrefs = {}}) {
  // Orphan-cleanup marker: the profile dir is unique per run (mkdtempSync) and
  // already on the parent's command line via `--profile`, so findPidsByTag can
  // match it without injecting a custom (unrecognized) CLI flag.
  // puppeteer-core syncs extraPrefsFirefox into user.js AFTER we write ours,
  // so pass the full set through it (a hand-written user.js would be replaced).
  // extensions.tabmix.version must equal the real addon version or tab.js's
  // version check opens the "New Version Installed" update page every run.
  const prefs = {
    ...PROFILE_PREFS,
    ...extraPrefs,
    "extensions.tabmix.version": readAddonVersion(),
  };

  removeProfileCompatibilityIni(profileDir);

  // NOTE: no --width/--height args. Firefox's remote agent misparses
  // `--width=1400` as a URL argument ("1400" -> https://0.0.5.120/) and opens
  // a junk tab. Window sizing is handled by puppeteer's default viewport.
  const args = [
    "-new-instance",
    "-no-remote",
    // BiDi script.evaluate on chrome pages requires system access.
    "-remote-allow-system-access",
  ];

  const browser = await puppeteer.launch({
    browser: "firefox",
    executablePath: binary,
    userDataDir: profileDir,
    headless,
    protocol: "webDriverBiDi",
    // CRITICAL: without this the sideloaded legacy extension never loads.
    ignoreDefaultArgs: ["--disable-extensions"],
    waitForInitialPage: true,
    extraPrefsFirefox: prefs,
    args,
  });

  // puppeteer-core 25.6+ (BiDi, win32): a headed launch leaves the browser
  // window fully laid out but WITHOUT a native window handle (MainWindowHandle
  // = 0, invisible on screen) until the first browsingContext.activate.
  // puppeteer-core 25.5 realized it at launch; 25.10 does not. bringToFront()
  // issues that activate and makes --headed runs visible. Raw Firefox spawns
  // are unaffected — this is a puppeteer/BiDi-connect behavior change, not a
  // Firefox one.
  if (!headless) {
    try {
      const [page] = await browser.pages();
      await page?.bringToFront();
    } catch {
      // best effort — headed visibility only
    }
  }

  return {browser, processTags: [profileDir]};
}

/**
 * Mirror the Firefox process stdout/stderr into the test log — autoconfig and
 * startup JS errors surface there (pattern from firefox-scripts helpers.mjs).
 *
 * stderr lines whose source is clearly Firefox platform code (resource://gre/,
 * resource://app/, known subsystem banners) are tagged `[ff:platform]` instead
 * of `[ff:err]` — platform noise, not the addon or the test. Anything else on
 * stderr stays `[ff:err]` and deserves eyes.
 *
 * @param {import("puppeteer-core").Browser} browser
 * @param {string[]} [sink] - optional array to also collect lines (returned on
 *   failure)
 * @param {string} [label="ff"] Default is `"ff"`
 */
const PLATFORM_STDERR =
  /resource:\/\/(?:gre|app)\/|shell_windows|window occlusion|Dynamically enable|docShell is null/i;

/**
 * Print one process line, wrapping long lines IDE-style: the continuation goes
 * on the next line, indented under the content (past the tag prefix), breaking
 * at the last space so words stay whole.
 *
 * @param {string} line - already-tagged line, e.g. " [ff:platform] ..."
 */
function printWrapped(line) {
  const width = Number(process.stdout?.columns) || 140;
  if (line.length <= width) {
    console.log(line);
    return;
  }
  const tagEnd = line.indexOf("] ");
  const indent = " ".repeat(tagEnd > 0 ? tagEnd + 2 : 2);
  let rest = line;
  while (rest.length > width) {
    let cut = rest.lastIndexOf(" ", width);
    if (cut <= indent.length) cut = width; // no space to break at - hard cut
    console.log(rest.slice(0, cut));
    rest = indent + rest.slice(cut).trimStart();
  }
  if (rest.trim()) console.log(rest);
}

export function attachProcessLogging(browser, sink = null, label = "ff") {
  const proc = browser.process?.();
  if (!proc?.stdout || !proc?.stderr) return;
  const pipe = (stream, name) => {
    stream.setEncoding("utf8");
    let buf = "";
    stream.on("data", chunk => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const tag = name === "err" && PLATFORM_STDERR.test(line) ? "platform" : name;
        const tagged = `  [${label}:${tag}] ${line}`;
        if (sink) sink.push(tagged);
        printWrapped(tagged);
      }
    });
  };
  pipe(proc.stdout, "out");
  pipe(proc.stderr, "err");
}

/**
 * Kill any Firefox processes whose command line carries one of the markers (the
 * run's unique profile paths). Used on launch failure and as a safety net after
 * browser.close().
 *
 * @param {string[]} tags
 * @returns {Promise<number>} number of killed pids
 */
export async function killProcessesByTag(tags) {
  const pids = await findPidsByTag(tags);
  for (const pid of pids) {
    try {
      await taskkill(pid);
    } catch {
      // already gone
    }
  }
  return pids.length;
}

async function findPidsByTag(tags) {
  // tasklist + wmic are unreliable for command lines; use PowerShell CIM once.
  const script =
    `Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" | ` +
    `Where-Object { $cl = $_.CommandLine; ` +
    tags.map(t => `$cl -like '*${t}*'`).join(" -or ") +
    ` } | Select-Object -ExpandProperty ProcessId`;
  try {
    const out = await runCapture("powershell.exe", ["-NoProfile", "-Command", script]);
    return out
      .split(/\s+/)
      .map(s => parseInt(s, 10))
      .filter(Number.isInteger);
  } catch {
    return [];
  }
}

function taskkill(pid) {
  return new Promise((resolve, reject) => {
    const proc = spawn("taskkill", ["/PID", String(pid), "/F"], {stdio: "ignore"});
    proc.on("exit", code =>
      code === 0 ? resolve() : reject(new Error(`taskkill ${pid} -> ${code}`))
    );
    proc.on("error", reject);
  });
}

function runCapture(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {stdio: ["ignore", "pipe", "ignore"]});
    let out = "";
    proc.stdout.on("data", d => (out += d.toString()));
    proc.on("exit", code => (code === 0 ? resolve(out) : reject(new Error(`${cmd} -> ${code}`))));
    proc.on("error", reject);
  });
}

/**
 * Wait until the user closes the browser window (or the process exits on its
 * own). Used by --keep-open: after a suite finishes, the browser stays on
 * screen for manual inspection and teardown resumes when it is gone.
 *
 * @param {import("puppeteer-core").Browser} browser
 */
async function waitForManualClose(browser) {
  console.log(
    "  --keep-open: browser left open for inspection; close the window (or Ctrl+C the runner) to continue teardown."
  );
  const proc = browser.process();
  // Already exited (or signaled) before we got here? Don't install listeners
  // that may never fire again — resolve immediately.
  if (proc && (proc.exitCode !== null || proc.signalCode !== null || proc.killed)) {
    return;
  }
  await new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    // Process exit is authoritative — closing the last window exits Firefox.
    proc?.once("exit", finish);
    // BiDi disconnects as soon as the last window closes, but the process can
    // linger briefly (crashreporter, shutdown); re-check after a delay.
    browser.on("disconnected", () => {
      setTimeout(() => {
        if (proc && proc.exitCode === null && !proc.killed) return; // still running
        finish();
      }, 1500);
    });
  });
}

/**
 * Close the browser and clean up stray processes.
 *
 * @param {import("puppeteer-core").Browser | null} browser
 * @param {string[]} tags - process markers from launchFirefox (profile paths)
 * @param {boolean} [keepOpen=false] wait for the user to close the window
 *   instead of closing it (--keep-open); teardown resumes automatically.
 *   Default is `false`
 */
export async function closeBrowser(browser, tags = [], keepOpen = false) {
  if (browser && keepOpen) {
    await waitForManualClose(browser);
  } else if (browser) {
    try {
      await browser.close();
    } catch {
      try {
        browser.process()?.kill();
      } catch {
        // ignore
      }
    }
  }
  await killProcessesByTag(tags);
}

/**
 * Save a failure artifact (screenshot of a privileged page via drawWindow).
 *
 * @param {import("puppeteer-core").Page} page
 * @param {string} name - file name (png)
 * @param {string} artifactsDir
 * @returns {Promise<string | null>} written path or null
 */
export async function saveScreenshot(page, name, artifactsDir) {
  try {
    const dataUrl = await page.evaluate(() => {
      const win = window;
      const canvas = win.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      canvas.width = win.innerWidth;
      canvas.height = win.innerHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawWindow(win, 0, 0, win.innerWidth, win.innerHeight, "rgb(255,255,255)");
      return canvas.toDataURL("image/png");
    });
    fs.mkdirSync(artifactsDir, {recursive: true});
    const out = path.join(artifactsDir, name);
    fs.writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
    return out;
  } catch {
    return null;
  }
}
