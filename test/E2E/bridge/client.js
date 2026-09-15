/* global Services */
/**
 * Privileged E2E client script (chrome://tabmix-e2e/content/client.js).
 *
 * Loaded by client.xhtml, which is opened as a top-level tab document. BiDi
 * evaluates inside that tab; this script forwards calls into the real browser
 * window (Services.wm). No addon code is modified.
 */
"use strict";

(function () {
  window.__e2eClient = true;

  /** The real browser window (not this client tab). */
  window.__e2eMainWindow = function () {
    return Services.wm.getMostRecentWindow("navigator:browser");
  };

  /** Clone-safe result wrapper used by every entry point. */
  window.__e2eWrap = function (fn) {
    const main = window.__e2eMainWindow();
    if (!main) {
      return {__e2eError: "no navigator:browser window"};
    }
    try {
      const result = fn(main);
      return {value: structuredClone(result === undefined ? null : result)};
    } catch (e) {
      return {__e2eError: String((e && e.stack) || e)};
    }
  };

  /**
   * Run a sync expression inside the main browser window. The source is
   * evaluated as `return (<source>);`.
   */
  window.__e2eEval = function (source) {
    return window.__e2eWrap(main => {
      return new main.Function("return (" + source + ");").call(main);
    });
  };

  /**
   * Run an async body inside the main browser window. The source becomes the
   * body of `async () => { <source> }`.
   */
  window.__e2eEvalAsync = async function (source) {
    const main = window.__e2eMainWindow();
    if (!main) {
      return {__e2eError: "no navigator:browser window"};
    }
    try {
      const result = await new main.Function("return (async () => { " + source + " })();").call(
        main
      );
      return {value: structuredClone(result === undefined ? null : result)};
    } catch (e) {
      return {__e2eError: String((e && e.stack) || e)};
    }
  };

  /** Screenshot the main window (drawWindow) as a PNG data URL. */
  window.__e2eScreenshot = function () {
    return window.__e2eWrap(main => {
      const canvas = main.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      canvas.width = main.innerWidth;
      canvas.height = main.innerHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawWindow(main, 0, 0, main.innerWidth, main.innerHeight, "rgb(255,255,255)");
      return canvas.toDataURL("image/png");
    });
  };
})();
