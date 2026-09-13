/**
 * Launcher — puppeteer-core + Firefox (WebDriver BiDi).
 *
 * Pattern from firefox-updater/src/services/firefoxPuppeteer.js:
 *
 * - protocol: "webDriverBiDi"
 * - ignoreDefaultArgs: ["--disable-extensions"] (so the sideloaded addon loads)
 * - -new-instance -no-remote
 * - process-tag (`--puppeteer-<tag>`) for orphan cleanup on crash
 * - compatibility.ini purge for profile hygiene
 */

import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import puppeteer from "puppeteer-core";
import {PROFILE_PREFS} from "./config.mjs";
import {removeProfileCompatibilityIni} from "./profileFactory.mjs";

// the screenshotMain evaluate() callback runs in the browser, not in Node.
/* global window */

/** Every Firefox exe started by this run carries this tag in its command line. */
function makeProcessTag() {
  return `--puppeteer-tabmix-e2e-${process.pid}-${Date.now()}`;
}

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
 *   processTag: string;
 * }>}
 */
export async function launchFirefox({binary, profileDir, headless = true, extraPrefs = {}}) {
  const processTag = makeProcessTag();

  // puppeteer-core syncs extraPrefsFirefox into user.js AFTER we write ours,
  // so pass the full set through it (a hand-written user.js would be replaced).
  const prefs = {...PROFILE_PREFS, ...extraPrefs};

  removeProfileCompatibilityIni(profileDir);

  // NOTE: no --width/--height args. Firefox's remote agent misparses
  // `--width=1400` as a URL argument ("1400" -> https://0.0.5.120/) and opens
  // a junk tab. Window sizing is handled by puppeteer's default viewport.
  const args = [
    "-new-instance",
    "-no-remote",
    // BiDi script.evaluate on chrome pages requires system access.
    "-remote-allow-system-access",
    processTag,
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

  return {browser, processTag};
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
 * Kill any Firefox processes whose command line carries one of the tags. Used
 * on launch failure and as a safety net after browser.close().
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
 * Close the browser and clean up stray processes.
 *
 * @param {import("puppeteer-core").Browser | null} browser
 * @param {string[]} tags - process tags from launchFirefox
 */
export async function closeBrowser(browser, tags = []) {
  if (browser) {
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
