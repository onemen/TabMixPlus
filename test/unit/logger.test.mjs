/**
 * Unit tests for addon/modules/logger.sys.mjs — the error-handling & logging
 * rewrite (the logger-line rename commit and the log.level pref fixes e7c25380
 *
 * - 51719d24).
 *
 * logger.sys.mjs touches `Services.prefs`, `globalThis.console` and
 * `Components` at import/call time, so each test installs minimal shims and
 * imports the module fresh (a `?case=` query busts the ESM cache) — this also
 * exercises the import-time pref bootstrap branch per test.
 *
 * Covered here: the V8-safe logic. The ConsoleAPI instance itself and live
 * Error().stack introspection are covered by the dev E2E suite
 * (test/E2E/suites/dev.mjs) in a real Firefox.
 */

import assert from "node:assert/strict";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const MODULE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../addon/modules/logger.sys.mjs"
);

const LOG_LEVEL_PREF = "extensions.tabmix.log.level";

/**
 * Install the Firefox globals logger.sys.mjs needs. Returns recorded state;
 * always pair with cleanupShims() (try/finally in the test).
 *
 * @param {{prefExists?: boolean}} [opts] - whether the level pref already
 *   exists
 */
function installShims({prefExists = false} = {}) {
  const state = {prefCalls: [], consoleCalls: [], instanceOptions: null};
  globalThis.Services = {
    prefs: {
      PREF_INVALID: 0,
      PREF_STRING: 32,
      getPrefType() {
        state.prefCalls.push("getPrefType");
        return prefExists ? 32 : 0;
      },
      setStringPref(pref, value) {
        state.prefCalls.push(`setStringPref(${pref}, ${value})`);
        prefExists = true;
      },
      getStringPref() {
        return "All";
      },
    },
  };
  globalThis.console.createInstance = options => {
    state.instanceOptions = options;
    return {
      info: (...args) => state.consoleCalls.push(["info", ...args]),
      warn: (...args) => state.consoleCalls.push(["warn", ...args]),
      error: (...args) => state.consoleCalls.push(["error", ...args]),
      debug: (...args) => state.consoleCalls.push(["debug", ...args]),
      assert: (...args) => state.consoleCalls.push(["assert", ...args]),
    };
  };
  // makeError() branches on `instanceof Components.Exception`
  globalThis.Components = {
    Exception: class MockException extends Error {
      constructor(message) {
        super(message);
        this.name = "NS_ERROR_MOCK";
        this.filename = "mock-exception.js";
      }
    },
  };
  return state;
}

function cleanupShims() {
  delete globalThis.Services;
  delete globalThis.Components;
  // @ts-expect-error - test-only shim on the Node global
  delete globalThis.console.createInstance;
}

/** Import the module fresh (ESM cache busted per case name). */
function importLogger(cacheBust) {
  // eslint-disable-next-line no-unsanitized/method -- local file URL built via pathToFileURL (same as test/unit/run.mjs)
  return import(`${pathToFileURL(MODULE_PATH).href}?case=${cacheBust}`);
}

/** Verify the shims are gone so later test files run in a clean global. */
function assertShimsRemoved() {
  assert.equal(typeof globalThis.Services, "undefined", "Services shim removed");
  assert.equal(typeof globalThis.Components, "undefined", "Components shim removed");
}

export const name = "logger";

export const tests = [
  {
    name: "bootstrap creates the log.level pref with default 'All' when missing",
    async test() {
      const state = installShims({prefExists: false});
      try {
        const {logger} = await importLogger("bootstrap-missing");
        assert.ok(
          state.prefCalls.includes(`setStringPref(${LOG_LEVEL_PREF}, All)`),
          `pref created on first use — got: ${JSON.stringify(state.prefCalls)}`
        );
        assert.equal(state.instanceOptions?.prefix, "Tabmix", "ConsoleAPI prefix");
        assert.equal(state.instanceOptions?.maxLogLevelPref, LOG_LEVEL_PREF, "level pref wired");
        assert.equal(state.instanceOptions?.maxLogLevel, "All", "default level");
        assert.equal(typeof logger.info, "function", "logger is the ConsoleAPI instance");
        return true;
      } finally {
        cleanupShims();
        assertShimsRemoved();
      }
    },
  },
  {
    name: "bootstrap leaves an existing log.level pref untouched",
    async test() {
      const state = installShims({prefExists: true});
      try {
        await importLogger("bootstrap-exists");
        assert.ok(
          !state.prefCalls.some(c => c.startsWith("setStringPref")),
          `no pref write when it exists — got: ${JSON.stringify(state.prefCalls)}`
        );
        return true;
      } finally {
        cleanupShims();
        assertShimsRemoved();
      }
    },
  },
  {
    name: "_name parses named frames, and falls back to file:line when @ is missing (slice clamp fix)",
    async test() {
      installShims();
      try {
        const {console: tconsole} = await importLogger("name");
        assert.equal(tconsole._name("myFunc@resource://mod.js:10"), "myFunc", "name@file frame");
        assert.equal(tconsole._name("myFunc@"), "myFunc", "trailing @ keeps the name");
        // the old .substr(0, -1) returned "" here; .slice clamps to 0 then the
        // fallback takes the file name
        assert.equal(
          tconsole._name("/path/to/file.js:42"),
          "file.js:42",
          "no @ → last path segment"
        );
        assert.equal(
          tconsole._name(""),
          "",
          "empty frame stays empty (no ? fallback for falsy fn)"
        );
        return true;
      } finally {
        cleanupShims();
        assertShimsRemoved();
      }
    },
  },
  {
    name: "_getStackExcludingInternal strips leading TMP_console_ frames from an injected stack",
    async test() {
      installShims();
      try {
        const {console: tconsole} = await importLogger("stack");
        const stack = [
          "TMP_console_log@logger.sys.mjs:300",
          "TMP_console_obj@logger.sys.mjs:230",
          "realCaller@caller.js:7",
          "outer@outer.js:1",
        ].join("\n");
        const frames = tconsole._getStackExcludingInternal(stack);
        assert.deepEqual(frames, ["realCaller@caller.js:7", "outer@outer.js:1"]);
        return true;
      } finally {
        cleanupShims();
        assertShimsRemoved();
      }
    },
  },
  {
    name: "_getNames handles 0 (→1), negative (→all) and overflow counts",
    async test() {
      installShims();
      try {
        const {console: tconsole} = await importLogger("names");
        const stack = [
          "TMP_console_log@logger.sys.mjs:300",
          "a@one.js:1",
          "b@two.js:2",
          "c@three.js:3",
        ].join("\n");
        assert.deepEqual(tconsole._getNames(0, stack), ["a"], "0 defaults to 1");
        assert.deepEqual(tconsole._getNames(-1, stack), ["a", "b", "c"], "negative → all");
        assert.deepEqual(tconsole._getNames(2, stack), ["a", "b"], "2 → first 2");
        assert.deepEqual(tconsole._getNames(99, stack), ["a", "b", "c"], "overflow clamped");
        return true;
      } finally {
        cleanupShims();
        assertShimsRemoved();
      }
    },
  },
  {
    name: "makeError wraps Error and Components.Exception into a 'Tabmix Error'",
    async test() {
      installShims();
      try {
        const {console: tconsole} = await importLogger("makeerror");
        const orig = new Error("boom");
        orig.fileName = "orig.js";
        orig.lineNumber = 11;
        const wrapped = tconsole.makeError(orig, "context line");
        assert.ok(wrapped instanceof Error, "prototype chain is Error");
        assert.equal(wrapped.name, "Tabmix Error");
        assert.equal(wrapped.fileName, "orig.js", "fileName propagated");
        assert.equal(wrapped.lineNumber, 11, "lineNumber propagated");
        assert.ok(wrapped.message.includes("boom"), "original message kept");
        assert.ok(wrapped.message.includes("context line"), "context message prepended");

        const ex = new globalThis.Components.Exception("excepted");
        const wrappedEx = tconsole.makeError(ex);
        assert.equal(wrappedEx.name, "Tabmix Error");
        assert.ok(wrappedEx.message.includes("excepted"), "exception message kept");
        assert.equal(wrappedEx.fileName, "mock-exception.js", "Exception filename mapped");

        const fromString = tconsole.makeError("plain string failure");
        assert.ok(fromString.message.includes("plain string failure"));
        return true;
      } finally {
        cleanupShims();
        assertShimsRemoved();
      }
    },
  },
  {
    name: "reportError honors the message filter and handles null",
    async test() {
      const state = installShims();
      try {
        const {console: tconsole} = await importLogger("reporterror");
        tconsole.reportError(new Error("retry later"), "", "retry");
        assert.equal(state.consoleCalls.length, 1, "matching filter logs");
        tconsole.reportError(new Error("unrelated"), "", "retry");
        assert.equal(state.consoleCalls.length, 1, "non-matching filter is silent");
        tconsole.reportError(null, "explicit null");
        assert.equal(state.consoleCalls.length, 2, "null still logs");
        assert.equal(state.consoleCalls[1][0], "error");
        return true;
      } finally {
        cleanupShims();
        assertShimsRemoved();
      }
    },
  },
  {
    name: "getObject validates arguments and obj() formats plain objects",
    async test() {
      const state = installShims();
      try {
        const {console: tconsole} = await importLogger("getobj");
        // invalid args route through assert → logger.error, no throw
        const bad = tconsole.getObject(undefined, "window.method");
        assert.equal(typeof bad.toString, "function", "invalid window → safe stub");
        assert.ok(
          state.consoleCalls.some(c => c[0] === "error"),
          "assert logged the problem"
        );

        const bad2 = tconsole.getObject({}, 42);
        assert.equal(typeof bad2.toString, "function", "non-string method → safe stub");

        // valid plain-object formatting (no window lookup involved)
        const out = tconsole.obj({a: 1, fn() {}}, "inspect", true);
        assert.ok(out.includes("a[number] =  1"), `plain value formatted — got ${out}`);
        assert.ok(out.includes("fn[function]"), "function entry listed");
        return true;
      } finally {
        cleanupShims();
        assertShimsRemoved();
      }
    },
  },
];
