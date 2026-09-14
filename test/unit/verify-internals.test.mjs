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
      const src =
        'getPrivateMethod({parentName: isVersion(1600) ? "a" : "b", methodName: "x(`y`)"})';
      const open = src.indexOf("(");
      const body = balancedBlock(src, open);
      if (!body.includes('methodName: "x(`y`)"')) {
        throw new Error(`unbalanced scan: ${JSON.stringify(body)}`);
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
