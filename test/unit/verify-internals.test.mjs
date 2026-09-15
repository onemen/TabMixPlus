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
    name: "parseParentCandidates handles chained ternaries",
    async test() {
      const {parseParentCandidates} = await import("../internals/verify-firefox-internals.mjs");
      const entry =
        'parentName: Tabmix.isVersion(1500) ? "parentA" : Tabmix.isVersion(1400) ? "parentB" : "parentC"';
      const cands = parseParentCandidates(entry);
      const byName = new Map(cands.map(c => [c.name, c.gate]));
      if (cands.length !== 3) {
        throw new Error(`expected 3 candidates, got ${JSON.stringify(cands)}`);
      }
      if (!byName.get("parentA")?.includes("1500")) {
        throw new Error(`parentA gate wrong: ${JSON.stringify(byName)}`);
      }
      // Exact polarity: parentB must be (!1500) && (1400) — a substring check
      // would accept a lost or flipped negation.
      const parentB = byName.get("parentB");
      if (
        !parentB?.includes("!Tabmix.isVersion(1500)") ||
        !parentB.includes("(Tabmix.isVersion(1400))")
      ) {
        throw new Error(`parentB gate must be (!1500) && (1400): ${JSON.stringify(byName)}`);
      }
      const parentC = byName.get("parentC");
      if (
        !parentC?.includes("!Tabmix.isVersion(1500)") ||
        !parentC.includes("!Tabmix.isVersion(1400)")
      ) {
        throw new Error(`parentC gate must carry the last negation: ${JSON.stringify(byName)}`);
      }
      return true;
    },
  },
  {
    name: "parseParentCandidates matches the colon of nested then-branch ternaries",
    // C1 ? (C2 ? A : B) : C — the colon finder must skip the nested ternary and
    // pair C1 with the SECOND colon, so B gets gate (C1 && !C2) — not !C1 —
    // and C stays gated only by !C1.
    async test() {
      const {parseParentCandidates} = await import("../internals/verify-firefox-internals.mjs");
      const entry =
        'parentName: Tabmix.isVersion(1500) ? Tabmix.isVersion(1400) ? "parentA" : "parentB" : "parentC"';
      const cands = parseParentCandidates(entry);
      const byName = new Map(cands.map(c => [c.name, c.gate]));
      if (cands.length !== 3) {
        throw new Error(`expected 3 candidates, got ${JSON.stringify(cands)}`);
      }
      const parentA = byName.get("parentA");
      if (
        !parentA?.includes("(Tabmix.isVersion(1500))") ||
        !parentA.includes("(Tabmix.isVersion(1400))")
      ) {
        throw new Error(`parentA gate must be (1500) && (1400): ${JSON.stringify(byName)}`);
      }
      const parentB = byName.get("parentB");
      if (
        !parentB?.includes("!Tabmix.isVersion(1400)") ||
        !parentB.includes("(Tabmix.isVersion(1500))")
      ) {
        throw new Error(`parentB gate must be (1500) && (!1400): ${JSON.stringify(byName)}`);
      }
      const parentC = byName.get("parentC");
      if (!parentC?.includes("!Tabmix.isVersion(1500)") || parentC.includes("1400")) {
        throw new Error(`parentC gate must be !1500 only: ${JSON.stringify(byName)}`);
      }
      return true;
    },
  },
  {
    name: "parseParentCandidates keeps gates through parentheses",
    async test() {
      const {parseParentCandidates} = await import("../internals/verify-firefox-internals.mjs");
      const entry = 'parentName: (Tabmix.isVersion(1450)) ? ("parentA") : ("parentB")';
      const cands = parseParentCandidates(entry);
      const a = cands.find(c => c.name === "parentA");
      if (!a?.gate?.includes("1450")) {
        throw new Error(`parenthesized then-branch lost its gate: ${JSON.stringify(cands)}`);
      }
      return true;
    },
  },
  {
    name: "activeVersionGates parses both arms of an isVersion if/else",
    // Regression guard for version-branch refactors: when a copied Firefox
    // function gains `if (Tabmix.isVersion(N)) {new code} else {old code}`,
    // a getPrivateMethod call inside EITHER arm must get a gate — else-arms
    // must not inherit the if-arm's condition (this is why the checker keeps
    // working when you split copied code by Firefox version). N is any real
    // version bucket (here 1450, like the addon's own code) — the parser is
    // bucket-agnostic and cannot be tested against future buckets.
    async test() {
      const {activeVersionGates} = await import("../internals/verify-firefox-internals.mjs");
      const src = [
        "function f() {",
        "  if (Tabmix.isVersion(1450)) {",
        '    h({parentName: "gBrowser", methodName: "newName"});',
        "  } else {",
        '    h({parentName: "gBrowser", methodName: "oldName"});',
        "  }",
        "}",
      ].join("\n");
      const gates = activeVersionGates(src, [src.indexOf("newName"), src.indexOf("oldName")]);
      const [newGate, oldGate] = [...gates.values()];
      const conds = [...gates.values()].flat();
      if (!conds.some(c => c.includes("isVersion(1450)"))) {
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
