#!/usr/bin/env node
/**
 * verify-firefox-internals — static early-warning that Firefox updates did not
 * break Tabmix's copied/injected code (P0 tier in docs/test-plan.md).
 *
 * Validates, against every Firefox channel unpack listed in
 * config/.firefox-link.local.json (plus the active firefox_code.local link):
 *
 * 1. Anchors — every entry in the ANCHORS table (code copied from Firefox must
 *    still resolve: the file exists in the unpack and the symbol text is
 *    present; stale table entries whose addon copy is gone are warnings).
 * 2. getPrivateMethod call sites — every `Tabmix.getPrivateMethod({ parentName,
 *    methodName })` target must exist as a `#method` private member in the
 *    parent's source file, in the era where that code path runs.
 *
 *    - 156+ channels (Tabbrowser.sys.mjs layout): the private-method path IS the
 *         runtime path → missing symbol is a hard FAIL.
 *    - pre-156 channels (tabbrowser.js layout): sites fall back to public methods
 *         via nextMethodName → missing symbol is a WARN (runtime is covered by
 *         the E2E `internals` suite instead).
 * 3. Sandbox lifecycle contract (the getSandbox audit, asserted at runtime by the
 *    E2E internals suite) — Changecode.sys.mjs must still: share one module
 *    sandbox (MODULE_SANDBOXES_SET), nuke it on quit-application, and reset
 *    expandTabmix._sandbox after first use.
 *
 * Usage: node test/internals/verify-firefox-internals.mjs [--channel nightly]
 *
 * Exit codes: 0 = all hard checks pass (warnings allowed), 1 = at least one
 * hard check failed.
 */

import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

/** Parent → source file per layout era, relative to the unpack root. */
const PARENT_FILES = {
  "gBrowser": {
    "156+": "moz-src/browser/components/tabbrowser/Tabbrowser.sys.mjs",
    "pre-156": "chrome/browser/content/browser/tabbrowser/tabbrowser.js",
  },
  "gBrowser.tabContainer": {
    "156+": "chrome/browser/content/browser/tabbrowser/tabs.js",
    "pre-156": "chrome/browser/content/browser/tabbrowser/tabs.js",
  },
  "gBrowser.tabContainer.tabDragAndDrop": {
    "156+": "chrome/browser/content/browser/tabbrowser/drag-and-drop.js",
    "pre-156": "chrome/browser/content/browser/tabbrowser/tabs.js",
  },
  "gBrowser.tabContainer.arrowScrollbox": {
    "156+": "chrome/toolkit/content/global/elements/arrowscrollbox.js",
    "pre-156": "chrome/toolkit/content/global/elements/arrowscrollbox.js",
  },
  "BrowserDOMWindow.prototype": {
    "156+": "modules/BrowserDOMWindow.sys.mjs",
    "pre-156": "modules/BrowserDOMWindow.sys.mjs",
  },
};

const ADDON_EXT = new Set([".js", ".jsm", ".mjs"]);

/**
 * Anchors — code copied from Firefox source. Each entry pins the addon file
 * (repo-relative, / separators) to the Firefox file it was copied from.
 *
 * Data lives here instead of as comments in the addon sources (the previous
 *
 * @type {{
 *   addonFile: string;
 *   symbol: string;
 *   addonSymbol?: string;
 *   upstream: string;
 *   diffs: string;
 * }[]}
 * @tabmix-anchor JSDoc markers were moved out — they belong to the test, not
 * to the shipped code); the checker fails when the upstream file or symbol
 * disappears from a channel's omni unpack. Deliberate diffs from upstream are
 * documented next to each entry.
 */
export const ANCHORS = [
  {
    addonFile: "addon/chrome/content/session/sessionStore.js",
    symbol: "resolveClosedDataSource",
    addonSymbol: "_resolveClosedDataSource",
    upstream: "moz-src/browser/components/sessionstore/SessionStore.sys.mjs",
    diffs:
      "uses public getWindowState / getClosedWindowData and returns " +
      "winData.windows[0]; keeps the 'sourceWindow' in source guard",
  },
  {
    addonFile: "addon/chrome/content/session/sessionStore.js",
    symbol: "getStateForClosedTabsAndClosedGroupTabs",
    addonSymbol: "_getStateForClosedTabsAndClosedGroupTabs",
    upstream: "moz-src/browser/components/sessionstore/SessionStore.sys.mjs",
    diffs: "throws when no tab data exists for aIndex, upstream returns undefined",
  },
  {
    addonFile: "addon/chrome/content/session/sessionStore.js",
    symbol: "getClosedTabStateFromUnifiedIndex",
    addonSymbol: "_getClosedTabStateFromUnifiedIndex",
    upstream: "moz-src/browser/components/sessionstore/SessionStore.sys.mjs",
    diffs: "identical",
  },
  {
    addonFile: "addon/chrome/content/session/sessionStore.js",
    symbol: "getPreferredRemoteType",
    upstream: "moz-src/browser/components/sessionstore/SessionStore.sys.mjs",
    diffs: "153+ branch identical; the pre-153 E10SUtils branch predates upstream",
  },
  {
    addonFile: "addon/modules/TabmixSvc.sys.mjs",
    symbol: "parseXULToFragment",
    upstream: "chrome/toolkit/content/global/customElements.js",
    diffs:
      "uses a plain DOMParser (no forceEnableXULXBL) since the forced parser " +
      "throws with dtd entities from Firefox 153",
  },
];

/**
 * True when the addon file still carries the anchor's symbol — the anchor is
 * obsolete once the copy is removed or renamed and should be pruned from this
 * table (a stale entry is reported as a warning).
 */
export function addonDeclaresSymbol(src, symbol) {
  return new RegExp(`(?:^|[^\\w$])${symbol}\\s*\\(`).test(src);
}

class Report {
  constructor(channel) {
    this.channel = channel;
    this.fail = [];
    this.warn = [];
    this.pass = [];
    this.inactive = [];
  }

  ok(msg) {
    this.pass.push(msg);
  }
  warnMsg(msg) {
    this.warn.push(msg);
  }
  failMsg(msg) {
    this.fail.push(msg);
  }
  skipMsg(msg) {
    this.inactive.push(msg);
  }
  print() {
    console.log(`\n=== channel: ${this.channel} ===`);
    for (const p of this.pass) console.log(`  ok    ${p}`);
    for (const w of this.warn) console.log(`  WARN  ${w}`);
    for (const f of this.fail) console.log(`  FAIL  ${f}`);
    for (const s of this.inactive) console.log(`  skip  ${s}`);
    console.log(
      `  summary: ${this.pass.length} ok, ${this.warn.length} warnings, ` +
        `${this.fail.length} failures, ${this.inactive.length} inactive (gated off)`
    );
  }
}

/** All addon source files the scanner should inspect. */
function addonFiles() {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "test" || entry.name.startsWith(".")) continue;
        walk(full);
      } else if (ADDON_EXT.has(path.extname(entry.name))) {
        out.push(full);
      }
    }
  };
  walk(path.join(ROOT, "addon"));
  return out;
}

/** Resolve a channel unpack root; returns null when the path does not exist. */
function unpackRoot(p) {
  if (!p) return null;
  try {
    return fs.realpathSync(path.resolve(p));
  } catch {
    return null;
  }
}

/** Channels to verify: the active link first, then every configured unpack. */
function channels(filter) {
  const list = [];
  const active = unpackRoot(path.join(ROOT, "firefox_code.local"));
  if (active) list.push({key: "active", root: active});

  const cfgPath = path.join(ROOT, "config", ".firefox-link.local.json");
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    for (const [key, p] of Object.entries(cfg.channels ?? {})) {
      const root = unpackRoot(p);
      if (!root) continue;
      if (list.some(c => c.root === root)) continue; // same unpack as active
      list.push({key, root});
    }
  }
  return filter ? list.filter(c => c.key === filter) : list;
}

/**
 * Layout era of an unpack. 156+ has Tabbrowser.sys.mjs under moz-src; pre-156
 * has the legacy tabbrowser.js. Both at once is ambiguous.
 */
function eraOf(root) {
  const newLayout = fs.existsSync(path.join(root, PARENT_FILES.gBrowser["156+"]));
  const oldLayout = fs.existsSync(path.join(root, PARENT_FILES.gBrowser["pre-156"]));
  if (newLayout && oldLayout) return "ambiguous";
  if (newLayout) return "156+";
  if (oldLayout) return "pre-156";
  return "unknown";
}

/** Find a file by basename inside the unpack's source dirs (cached per root). */
const basenameCache = new Map();
function findInUnpack(root, basename) {
  const key = `${root}\0${basename}`;
  if (basenameCache.has(key)) return basenameCache.get(key);

  let result = null;
  const stack = [root];
  outer: while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "test" || entry.name.startsWith(".")) continue;
        stack.push(full);
      } else if (entry.name === basename) {
        result = full;
        break outer;
      }
    }
  }
  basenameCache.set(key, result);
  return result;
}

/** Resolve an anchor's "File" part to a path inside the unpack. */
function resolveUnpackFile(root, fileRef) {
  const direct = path.join(root, fileRef);
  if (fs.existsSync(direct)) return direct;
  const mozSrc = path.join(root, "moz-src", fileRef);
  if (fs.existsSync(mozSrc)) return mozSrc;
  return findInUnpack(root, path.basename(fileRef));
}

/**
 * Balanced-delimiter scan starting at `open` (index of the opening `(` or `{`),
 * returning the text between the delimiters. String-aware so nested delimiters
 * inside literals do not miscount.
 */
export function balancedBlock(src, open) {
  const pairs = {"(": ")", "{": "}"};
  const close = pairs[src[open]];
  if (!close) return null;
  const stack = [close];
  let quote = null;
  for (let i = open + 1; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "(" || ch === "{") {
      stack.push(pairs[ch]);
    } else if (ch === ")" || ch === "}") {
      if (stack.pop() !== ch) return null;
      if (!stack.length) return src.slice(open + 1, i);
    }
  }
  return null;
}

/**
 * Split a `{...}` block body into top-level `key: value` entries (comma at
 * nesting depth 0, string-aware).
 */
function blockEntries(block) {
  const entries = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "(" || ch === "{") {
      depth++;
    } else if (ch === ")" || ch === "}") {
      depth--;
    } else if (ch === "," && depth === 0) {
      entries.push(block.slice(start, i));
      start = i + 1;
    }
  }
  if (block.slice(start).trim()) entries.push(block.slice(start));
  return entries;
}

/**
 * All string literals in an entry value (parentName may be an isVersion
 * ternary).
 */
const stringsIn = text => [...text.matchAll(/"([^"]+)"/g)].map(m => m[1]);

/**
 * Parse `const NAME = { ... }` object blocks in a file so call sites that
 * spread them (`...tabContainerProps`) can inherit their parentName. Values may
 * be era-dependent ternaries → every string literal is a candidate.
 */
function spreadParentNames(src) {
  const map = new Map();
  for (const m of src.matchAll(/(?:const|let|var)\s+(\w+)\s*=[^;{]*\{/g)) {
    const block = balancedBlock(src, m.index + m[0].length - 1);
    if (!block) continue;
    const entry = blockEntries(block).find(e => /^\s*parentName\s*:/.test(e));
    if (entry) map.set(m[1], stringsIn(entry));
  }
  return map;
}

/** One getPrivateMethod call site extracted from addon source. */
export function callSites(src) {
  const spreads = spreadParentNames(src);
  const sites = [];
  for (const m of src.matchAll(/getPrivateMethod\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const text = balancedBlock(src, open);
    if (text === null) continue;

    // The arguments are a single object literal `{ ... }`; extract its body so
    // blockEntries sees the commas at nesting depth 0.
    const braceIdx = text.indexOf("{");
    const body =
      braceIdx !== -1 ? (balancedBlock(text, braceIdx) ?? text.slice(braceIdx + 1)) : text;

    const rawName = /methodName:\s*("([^"]+)"|[A-Za-z_$][\w$]*)/.exec(body)?.[1];
    const methodName = rawName?.startsWith('"') ? rawName.slice(1, -1) : null;

    // parentName candidates: inline value(s) plus every spread object's value(s).
    const parentNames = [];
    for (const entry of blockEntries(body)) {
      if (/^\s*parentName\s*:/.test(entry)) parentNames.push(...stringsIn(entry));
    }
    for (const sp of body.matchAll(/\.\.\.(\w+)/g)) {
      if (spreads.has(sp[1])) parentNames.push(...spreads.get(sp[1]));
    }

    const line = src.slice(0, m.index).split("\n").length;
    sites.push({methodName, parentNames: [...new Set(parentNames)], line, offset: m.index});
  }
  return sites;
}

/**
 * Active `Tabmix.isVersion` gate conditions (from enclosing if / else-if
 * blocks) per source offset. Conditions without an isVersion clause count as
 * always-true and are not collected. String-aware; ignores nested parens.
 */
/** Simple single-clause isVersion condition that we can negate safely. */
const SIMPLE_CLAUSE_RE = /^\s*(!?)\s*(?:Tabmix\.)?isVersion\((\d+)\)\s*$/;

/** Negate a simple isVersion clause string (`X` → `!X`, `!X` → `X`). */
function negateSimple(cond) {
  const m = SIMPLE_CLAUSE_RE.exec(cond);
  if (!m) return null; // complex condition — cannot negate conservatively
  return m[1] === "!" ? cond.replace(/^\s*!\s*/, "") : `!${cond.trim()}`;
}

/**
 * Condition of an `else if` branch: previous chain link negated AND this
 * condition. Returns null when the previous link is too complex to negate
 * (caller keeps the branch unconditioned — conservative).
 */
function composeElseIf(chainCond, cond) {
  if (chainCond == null) return cond;
  const negated = negateSimple(chainCond);
  if (!negated) return null;
  return `(${negated}) && (${cond})`;
}

/** Skip whitespace and comments from index i; returns the next index. */
function skipInsignificant(src, i) {
  for (;;) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
    } else if (ch === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i === -1) return src.length;
    } else if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
    } else {
      return i;
    }
  }
}

/** Read the balanced parenthesized condition starting at `open` (the `(`). */
function readParenCond(src, open) {
  let depth = 1;
  for (let j = open + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return {text: src.slice(open + 1, j), end: j};
    }
  }
  return null;
}

export function activeVersionGates(src, offsets) {
  const result = new Map();
  const stack = []; // gate condition text (or null) per open brace
  let pending = null; // if-header condition awaiting its `{`
  let si = 0;
  const sorted = [...offsets].sort((a, b) => a - b);

  const snapshot = upTo => {
    while (si < sorted.length && sorted[si] <= upTo) {
      result.set(
        sorted[si],
        stack.filter(c => c !== null)
      );
      si++;
    }
  };

  // 4-state scan (code / line comment / block comment / string) so that
  // apostrophes in comments do not corrupt brace tracking. Indices are the
  // original ones — comments are skipped, not stripped.
  const CODE = 0;
  const LINE_COMMENT = 1;
  const BLOCK_COMMENT = 2;
  const STRING = 3;
  let state = CODE;
  let quote = null;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (state === LINE_COMMENT) {
      if (ch === "\n") state = CODE;
      continue;
    }
    if (state === BLOCK_COMMENT) {
      if (ch === "*" && next === "/") {
        state = CODE;
        i++;
      }
      continue;
    }
    if (state === STRING) {
      if (ch === "\\") i++;
      else if (ch === quote) state = CODE;
      continue;
    }

    // CODE state — comment detection comes FIRST ("it's // x" must not open
    // a string from the apostrophe).
    if (ch === "/" && next === "/") {
      state = LINE_COMMENT;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      state = BLOCK_COMMENT;
      i++;
      continue;
    }

    snapshot(i - 1);

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      state = STRING;
    } else if (ch === "{") {
      stack.push(pending);
      pending = null;
    } else if (ch === "}" && src[i + 1] === ";") {
      stack.pop(); // `};` — block close
      i++;
    } else if (ch === "}") {
      const closedCond = stack.pop();
      pending = null;

      // `} else if (cond) {` / `} else {`: pre-compose the upcoming block's
      // condition (negate the closed branch, AND the else-if condition).
      let j = skipInsignificant(src, i + 1);
      if (src.startsWith("else", j)) {
        let k = skipInsignificant(src, j + 4);
        if (src.startsWith("if", k)) {
          const paren = skipInsignificant(src, k + 2);
          if (src[paren] === "(") {
            const parsed = readParenCond(src, paren);
            if (parsed) {
              const condText = parsed.text;
              const composed =
                /isVersion\(/.test(condText) ? composeElseIf(closedCond, condText) : closedCond;
              pending = composed;
              i = skipInsignificant(src, parsed.end + 1) - 1; // resume at the block `{`
            }
          } else {
            pending = closedCond; // not a condition header — treat as plain else
            i = paren - 1;
          }
        } else if (src[k] === "{") {
          pending = negateSimple(closedCond ?? "");
          i = k - 1; // resume at the `{`
        }
      }
    } else if (ch === "(") {
      const before = src.slice(Math.max(0, i - 32), i + 1);
      if (/\b(?:else\s+)?if\s*\($/.test(before)) {
        const parsed = readParenCond(src, i);
        if (parsed) {
          if (/isVersion\(/.test(parsed.text)) pending = parsed.text;
          i = parsed.end;
        }
      }
    }
  }
  snapshot(src.length);
  return result;
}

/** AND-combined isVersion clauses; conditions without any clause are true. */
export function evalVersionGate(cond, v) {
  const clauses = [...cond.matchAll(/(!?)\s*(?:Tabmix\.)?isVersion\((\d+)\)/g)];
  if (!clauses.length) return true;
  return clauses.every(([, not, n]) => (not === "!" ? v < Number(n) : v >= Number(n)));
}

/**
 * True when the gate holds for ANY Firefox version the era covers (pre-156
 * spans roughly 102..155). Evaluated at every clause boundary in range.
 */
function gateActiveSomewhereInEra(gates, lo, hi) {
  const points = new Set([lo, hi]);
  for (const cond of gates) {
    for (const m of cond.matchAll(/isVersion\((\d+)\)/g)) {
      const n = Number(m[1]);
      if (n > lo && n <= hi) {
        points.add(n);
        points.add(n - 1);
      }
    }
  }
  return [...points].some(v => gates.every(c => evalVersionGate(c, v)));
}

/**
 * Anchors: every registered copy must still resolve against the unpack (file
 *
 * - symbol), and every registered copy must still exist in the addon (stale
 *   entries are warnings — prune the table when a copy is removed).
 */
function verifyAnchors(report, root) {
  for (const anchor of ANCHORS) {
    const addonSymbol = anchor.addonSymbol ?? anchor.symbol;
    const addonPath = path.join(ROOT, anchor.addonFile);
    if (!fs.existsSync(addonPath)) {
      report.failMsg(`anchor ${addonSymbol}: addon file ${anchor.addonFile} not found`);
      continue;
    }
    if (!addonDeclaresSymbol(fs.readFileSync(addonPath, "utf8"), addonSymbol)) {
      report.warnMsg(
        `anchor ${addonSymbol}: not found in ${anchor.addonFile} — remove the stale table entry`
      );
      continue;
    }

    const target = resolveUnpackFile(root, anchor.upstream);
    if (!target) {
      report.failMsg(`anchor ${addonSymbol}: upstream file ${anchor.upstream} not found in unpack`);
      continue;
    }
    if (!fs.readFileSync(target, "utf8").includes(anchor.symbol)) {
      report.failMsg(
        `anchor ${addonSymbol}: upstream symbol "${anchor.symbol}" not found in unpack file ` +
          `${anchor.upstream} — Firefox renamed it; re-verify the copy against the new source`
      );
      continue;
    }
    report.ok(`anchor ${addonSymbol} ← ${anchor.upstream}${diffSuffix(anchor)}`);
  }
}

/** Short human-readable diff note for the report line. */
function diffSuffix(anchor) {
  return anchor.diffs && anchor.diffs !== "identical" ? " (diff: " + anchor.diffs + ")" : "";
}

function verifyCallSites(report, root, era) {
  const required = era === "156+"; // private-method path only runs on 156+
  let checked = 0;

  for (const file of addonFiles()) {
    const src = fs.readFileSync(file, "utf8");
    if (!src.includes("getPrivateMethod")) continue;
    const rel = path.relative(ROOT, file);

    const sites = callSites(src);
    const gatesMap = activeVersionGates(
      src,
      sites.map(s => s.offset)
    );

    for (const site of sites) {
      const gates = gatesMap.get(site.offset) ?? [];

      // Does this call site even execute on this channel's layout era?
      const active =
        era === "156+" ?
          gates.every(c => evalVersionGate(c, 1560))
        : gateActiveSomewhereInEra(gates, 1020, 1559);
      if (!active) {
        report.skipMsg(
          `${rel}:${site.line} ${site.methodName} — version gate not active on ${era}`
        );
        continue;
      }
      if (!site.methodName) {
        report.warnMsg(
          `${rel}:${site.line} dynamic methodName — covered by the E2E internals suite`
        );
        continue;
      }

      // Era check passes when ANY parentName candidate maps to a file that
      // declares the private method (the addon picks the parent at runtime).
      const mapped = site.parentNames
        .map(p => ({parent: p, eraFile: PARENT_FILES[p]?.[era]}))
        .filter(c => c.eraFile);
      if (!site.parentNames.length) {
        report.failMsg(`${rel}:${site.line} ${site.methodName}: parentName not resolvable`);
        continue;
      }
      if (!mapped.length) {
        report.warnMsg(
          `${rel}:${site.line} ${site.methodName}: no ${era} source mapping for ${site.parentNames.join(" | ")}`
        );
        continue;
      }

      const hasPrivate = mapped.some(
        c =>
          fs.existsSync(path.join(root, c.eraFile)) &&
          new RegExp(`#${site.methodName}\\b`).test(
            fs.readFileSync(path.join(root, c.eraFile), "utf8")
          )
      );
      checked++;
      const where = mapped.map(c => `${c.parent} in ${path.basename(c.eraFile)}`).join(" or ");
      if (hasPrivate) {
        report.ok(`${site.methodName} ← ${where}`);
      } else if (required) {
        report.failMsg(
          `${site.methodName} ← ${where}: private method not found — Firefox renamed it; ` +
            `getPrivateMethod will fail at runtime`
        );
      } else {
        report.warnMsg(
          `${site.methodName} ← ${where}: not private in ${era} sources (falls back to public methods)`
        );
      }
    }
  }
  if (checked) {
    report.ok(`${checked} getPrivateMethod target(s) verified against ${era} sources`);
  }
}

/** getSandbox audit contract, checked statically in Changecode.sys.mjs. */
function verifySandboxContract(report) {
  const file = path.join(ROOT, "addon", "modules", "Changecode.sys.mjs");
  const src = fs.readFileSync(file, "utf8");

  const contract = [
    ["module sandbox set", /const MODULE_SANDBOXES_SET = new Map\(\)/],
    ["module sandbox nuked on quit", /addObserver\(cleanupSandboxes, "quit-application"\)/],
    ["nukeSandbox call", /Cu\.nukeSandbox\(/],
    ["transient expandTabmix._sandbox reset", /expandTabmix\._sandbox = null/],
  ];
  for (const [name, re] of contract) {
    if (re.test(src)) report.ok(`sandbox contract: ${name}`);
    else report.failMsg(`sandbox contract broken: ${name} not found in Changecode.sys.mjs`);
  }
}

function main() {
  const argIdx = process.argv.indexOf("--channel");
  const filter = argIdx !== -1 ? process.argv[argIdx + 1] : undefined;

  const list = channels(filter);
  if (!list.length) {
    console.error(
      "No Firefox unpacks found. Check firefox_code.local / config/.firefox-link.local.json"
    );
    process.exit(1);
  }

  let failed = false;
  for (const {key, root} of list) {
    const report = new Report(key);
    const era = eraOf(root);
    if (era === "ambiguous" || era === "unknown") {
      report.failMsg(`cannot determine layout era of ${root}`);
    } else {
      verifyAnchors(report, root);
      verifyCallSites(report, root, era);
      verifySandboxContract(report);
    }
    report.print();
    if (report.fail.length) failed = true;
  }

  console.log(failed ? "\nverify-firefox-internals: FAIL" : "\nverify-firefox-internals: PASS");
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
