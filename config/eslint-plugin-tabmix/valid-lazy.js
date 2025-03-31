/* eslint-disable no-unused-vars */

/**
 * append TabmixChromeUtils to eslint-plugin-mozilla valid-lazy rule items and
 * callExpressionMultiDefinitions lists
 */

import MozillaHelpers from "eslint-plugin-mozilla/lib/helpers.js";
import validLazy from "eslint-plugin-mozilla/lib/rules/valid-lazy.js";

// used as closer in eval
const helpers = MozillaHelpers;

// @ts-expect-error - used as closer in eval
const items = [
  "loader",
  "XPCOMUtils",
  "Integration",
  "TabmixChromeUtils",
  "ChromeUtils",
  "DevToolsUtils",
  "Object",
  "Reflect",
];

// @ts-expect-error - used as closer in eval
const callExpressionDefinitions = [
  /^loader\.lazyGetter\(lazy, "(\w+)"/,
  /^loader\.lazyServiceGetter\(lazy, "(\w+)"/,
  /^loader\.lazyRequireGetter\(lazy, "(\w+)"/,
  /^TabmixChromeUtils\.defineLazyGetter\(lazy, "(\w+)"/,
  /^Integration\.downloads\.defineESModuleGetter\(lazy, "(\w+)"/,
  /^ChromeUtils\.defineLazyGetter\(lazy, "(\w+)"/,
  /^XPCOMUtils\.defineLazyPreferenceGetter\(lazy, "(\w+)"/,
  /^XPCOMUtils\.defineLazyScriptGetter\(lazy, "(\w+)"/,
  /^XPCOMUtils\.defineLazyServiceGetter\(lazy, "(\w+)"/,
  /^XPCOMUtils\.defineConstant\(lazy, "(\w+)"/,
  /^DevToolsUtils\.defineLazyGetter\(lazy, "(\w+)"/,
  /^Object\.defineProperty\(lazy, "(\w+)"/,
  /^Reflect\.defineProperty\(lazy, "(\w+)"/,
];

// @ts-expect-error - used as closer in eval
const callExpressionMultiDefinitions = [
  "TabmixChromeUtils.defineLazyModuleGetters(lazy,",
  "ChromeUtils.defineESModuleGetters(lazy,",
  "XPCOMUtils.defineLazyServiceGetters(lazy,",
  "Object.defineProperties(lazy,",
  "loader.lazyRequireGetter(lazy,",
];

// fix a bug in mozilla valid-lazy.js when the code is `let lazy`
let createFunction = validLazy.create.toString().replace(/node\.init\./g, "node.init?.");

if (!createFunction.startsWith("function")) {
  createFunction = "function " + createFunction;
}

export default {
  ...validLazy,
  create: eval("(" + createFunction + ")"),
};
