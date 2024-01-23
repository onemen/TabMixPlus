/* eslint-disable no-unused-vars */

/**
 * append TabmixChromeUtils to eslint-plugin-mozilla valid-lazy rule
 * items and callExpressionMultiDefinitions lists
 */
"use strict";

const path = require("path");

const mozilla = require.resolve("eslint-plugin-mozilla");
const mozillaPath = path.dirname(mozilla);
const helpers = require(path.join(mozillaPath, "helpers.js"));
const validLazy = require(path.join(mozillaPath, "rules", "valid-lazy.js"));

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

const callExpressionDefinitions = [
  /^loader\.lazyGetter\(lazy, "(\w+)"/,
  /^loader\.lazyServiceGetter\(lazy, "(\w+)"/,
  /^loader\.lazyRequireGetter\(lazy, "(\w+)"/,
  /^XPCOMUtils\.defineLazyGetter\(lazy, "(\w+)"/,
  /^TabmixChromeUtils\.defineLazyGetter\(lazy, "(\w+)"/,
  /^Integration\.downloads\.defineESModuleGetter\(lazy, "(\w+)"/,
  /^ChromeUtils\.defineLazyGetter\(lazy, "(\w+)"/,
  /^ChromeUtils\.defineModuleGetter\(lazy, "(\w+)"/,
  /^XPCOMUtils\.defineLazyPreferenceGetter\(lazy, "(\w+)"/,
  /^XPCOMUtils\.defineLazyScriptGetter\(lazy, "(\w+)"/,
  /^XPCOMUtils\.defineLazyServiceGetter\(lazy, "(\w+)"/,
  /^XPCOMUtils\.defineConstant\(lazy, "(\w+)"/,
  /^DevToolsUtils\.defineLazyGetter\(lazy, "(\w+)"/,
  /^Object\.defineProperty\(lazy, "(\w+)"/,
  /^Reflect\.defineProperty\(lazy, "(\w+)"/,
];

const callExpressionMultiDefinitions = [
  "TabmixChromeUtils.defineLazyModuleGetters(lazy,",
  "ChromeUtils.defineESModuleGetters(lazy,",
  "XPCOMUtils.defineLazyModuleGetters(lazy,",
  "XPCOMUtils.defineLazyServiceGetters(lazy,",
  "Object.defineProperties(lazy,",
  "loader.lazyRequireGetter(lazy,",
];

let createFunction = validLazy.create.toString();

if (!createFunction.startsWith("function")) {
  createFunction = "function " + createFunction;
}

module.exports = {
  ...validLazy,
  create: eval("(" + createFunction + ")")
};
