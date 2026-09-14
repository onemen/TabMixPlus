/**
 * Unit tests — verify-firefox-internals ANCHORS table + scanning helpers.
 *
 * Guards the anchor registry against rot: every registered copy must still
 * exist in the addon, upstream refs must stay unpack-relative, and the
 * balanced-delimiter scanner must not be fooled by delimiters inside strings.
 */

import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  ANCHORS,
  addonDeclaresSymbol,
  balancedBlock,
} from "../internals/verify-firefox-internals.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const name = "verify-internals";

export const tests = [
  {
    name: "ANCHORS: every addon file exists",
    async test() {
      for (const anchor of ANCHORS) {
        if (!fs.existsSync(path.join(ROOT, anchor.addonFile))) {
          throw new Error(`missing addon file: ${anchor.addonFile}`);
        }
      }
      return true;
    },
  },
  {
    name: "ANCHORS: every copy is still declared in its addon file",
    async test() {
      for (const anchor of ANCHORS) {
        const src = fs.readFileSync(path.join(ROOT, anchor.addonFile), "utf8");
        if (!addonDeclaresSymbol(src, anchor.addonSymbol ?? anchor.symbol)) {
          throw new Error(`stale anchor entry: ${anchor.addonSymbol ?? anchor.symbol}`);
        }
      }
      return true;
    },
  },
  {
    name: "ANCHORS: upstream refs are unpack-relative POSIX paths",
    async test() {
      for (const anchor of ANCHORS) {
        if (path.isAbsolute(anchor.upstream) || anchor.upstream.includes("\\")) {
          throw new Error(
            `upstream ref must be unpack-relative with / separators: ${anchor.upstream}`
          );
        }
      }
      return true;
    },
  },
  {
    name: "ANCHORS: every entry documents its deliberate diffs",
    async test() {
      for (const anchor of ANCHORS) {
        if (typeof anchor.diffs !== "string" || !anchor.diffs.trim()) {
          throw new Error(`anchor ${anchor.symbol} has no diffs note (use "identical")`);
        }
      }
      return true;
    },
  },
  {
    name: "balancedBlock ignores delimiters inside string literals",
    async test() {
      const src = `f("("); g(a)`;
      const open = src.indexOf("g(") + 1; // balancedBlock expects the `(` index
      if (balancedBlock(src, open) !== "a") {
        throw new Error(`expected "a", got ${JSON.stringify(balancedBlock(src, open))}`);
      }
      return true;
    },
  },
  {
    name: "balancedBlock handles nested calls and template literals",
    async test() {
      // A real template literal whose content contains closing delimiters —
      // the scanner must stay in template mode until the backtick, or the `)`
      // inside it would end the block early.
      const src = "getPrivateMethod({methodName: `x) y} z]`})";
      const open = src.indexOf("(");
      const body = balancedBlock(src, open);
      const expected = "{methodName: `x) y} z]`}";
      if (body !== expected) {
        throw new Error(
          `unbalanced scan: expected ${JSON.stringify(expected)}, got ${JSON.stringify(body)}`
        );
      }
      return true;
    },
  },
  {
    name: "parseParentCandidates gates ternary parentName branches by version",
    // tabContainerProps.parentName is a ternary: on 156+ BOTH branches are
    // era-live (1450+ and <1450), so the checker must evaluate each branch at
    // the Firefox versions where the runtime actually selects it — a match in
    // one branch must not mask a rename in the other.
    async test() {
      const {parseParentCandidates} = await import("../internals/verify-firefox-internals.mjs");
      const entry =
        'parentName: Tabmix.isVersion(1450) ? "gBrowser.tabContainer.tabDragAndDrop" : "gBrowser.tabContainer"';
      const cands = parseParentCandidates(entry);
      if (cands.length !== 2) {
        throw new Error(`expected 2 candidates, got ${cands.length}`);
      }
      const gated = cands.find(c => c.name.includes("tabDragAndDrop"));
      if (!gated?.gate || !gated.gate.includes("1450")) {
        throw new Error(`gated branch missing its condition: ${JSON.stringify(gated)}`);
      }
      const plain = cands.find(c => c.name === "gBrowser.tabContainer");
      if (!plain?.gate || !plain.gate.includes("1450")) {
        throw new Error(`else branch missing negated condition: ${JSON.stringify(plain)}`);
      }
      return true;
    },
  },
  {
    name: "activeVersionGates parses both arms of an isVersion if/else",
    // Regression guard for version-branch refactors: when a copied Firefox
    // function gains `if (Tabmix.isVersion(1600)) {new code} else {old code}`,
    // a getPrivateMethod call inside EITHER arm must get a gate — else-arms
    // must not inherit the if-arm's condition (this is why the checker keeps
    // working when you split copied code by Firefox version).
    async test() {
      const {activeVersionGates} = await import("../internals/verify-firefox-internals.mjs");
      const src = [
        "function f() {",
        "  if (Tabmix.isVersion(1600)) {",
        '    h({parentName: "gBrowser", methodName: "newName"});',
        "  } else {",
        '    h({parentName: "gBrowser", methodName: "oldName"});',
        "  }",
        "}",
      ].join("\n");
      const gates = activeVersionGates(src, [src.indexOf("newName"), src.indexOf("oldName")]);
      const [newGate, oldGate] = [...gates.values()];
      const conds = [...gates.values()].flat();
      if (!conds.some(c => c.includes("isVersion(1600)"))) {
        throw new Error(`no isVersion gate found: ${JSON.stringify([...gates.values()])}`);
      }
      if (newGate.length !== 1 || oldGate.length !== 1) {
        throw new Error(
          `expected exactly one gate per arm, got ${JSON.stringify([...gates.values()])}`
        );
      }
      if (newGate[0] === oldGate[0]) {
        throw new Error("else-arm inherited the if-arm condition");
      }
      return true;
    },
  },
];
