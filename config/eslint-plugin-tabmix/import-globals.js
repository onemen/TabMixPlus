
/**
 * append TabmixChromeUtils to eslint-plugin-mozilla import-globals rule
 * callExpressionMultiDefinitions lists
 */
"use strict";

const path = require("path");

const mozilla = require.resolve("eslint-plugin-mozilla");
const mozillaPath = path.dirname(mozilla);
const helpers = require(path.join(mozillaPath, "helpers.js"));

// callExpressionDefinitions and callExpressionMultiDefinitions are used
// by helpers.convertCallExpressionToGlobals

// eslint-disable-next-line no-unused-vars
const callExpressionDefinitions = [
  /^TabmixChromeUtils\.defineLazyModuleGetters\((?:globalThis|this), "(\w+)"/,
  /^TabmixChromeUtils\.import\((?:globalThis|this), "(\w+)"/,
];

// eslint-disable-next-line no-unused-vars
const callExpressionMultiDefinitions = [
  "TabmixChromeUtils.defineLazyModuleGetters(this,",
  "TabmixChromeUtils.defineLazyModuleGetters(globalThis,",
];

let convertToGlobalsString = helpers.convertCallExpressionToGlobals.toString();
if (!convertToGlobalsString.startsWith("function")) {
  convertToGlobalsString = "function " + convertToGlobalsString;
}
const convertCallExpressionToGlobals = eval(`(${convertToGlobalsString})`).bind(helpers);

module.exports = {
  meta: {
    messages: { },
    type: "problem",
  },

  create(context) {
    let globalScope, parents;

    return {
      Program() {
        parents = context.getAncestors();
        globalScope = context.getScope();
      },

      ExpressionStatement(node) {
        if (node.expression.type === "CallExpression") {
          const isGlobal = helpers.getIsGlobalThis(parents);
          let globals = [];
          globals = convertCallExpressionToGlobals(node, isGlobal);
          helpers.addGlobals(
            globals,
            globalScope,
            node.type !== "Program" && node
          );
        }
      },
    };
  }
};
