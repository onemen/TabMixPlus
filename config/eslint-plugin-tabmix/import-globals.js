
/**
 * append TabmixChromeUtils to eslint-plugin-mozilla import-globals rule
 * callExpressionMultiDefinitions lists
 */

import helpers from "eslint-plugin-mozilla/lib/helpers.js";

const callExpressionDefinitions = [
  /^TabmixChromeUtils\.defineLazyModuleGetters\((?:globalThis|this), "(\w+)"/,
  /^TabmixChromeUtils\.import\((?:globalThis|this), "(\w+)"/,
  /^TabmixChromeUtils\.defineLazyGetter\((?:globalThis|this), "(\w+)"/,
];

const callExpressionMultiDefinitions = [
  "TabmixChromeUtils.defineLazyModuleGetters(this,",
  "TabmixChromeUtils.defineLazyModuleGetters(globalThis,",
  "ChromeUtils.defineLazyGetter(this,",
  "ChromeUtils.defineLazyGetter(globalThis,",
];

/**
 * copied from eslint-plugin-mozilla/lib/globals.js
 *
 * Attempts to convert an CallExpressions that look like module imports
 * into global variable definitions.
 *
 * @param  {Object} node
 *         The AST node to convert.
 * @param  {boolean} isGlobal
 *         True if the current node is in the global scope.
 *
 * @return {Array}
 *         An array of objects that contain details about the globals:
 *         - {String} name
 *                    The name of the global.
 *         - {Boolean} writable
 *                     If the global is writeable or not.
 */
function convertCallExpressionToGlobals(node, isGlobal) {
  const express = node.expression;
  if (
    express.type === "CallExpression" &&
    express.callee.type === "MemberExpression" &&
    express.callee.object &&
    express.callee.object.type === "Identifier" &&
    express.arguments.length === 1 &&
    express.arguments[0].type === "ArrayExpression" &&
    express.callee.property.type === "Identifier" &&
    express.callee.property.name === "importGlobalProperties"
  ) {
    return express.arguments[0].elements.map(literal => {
      return {
        explicit: true,
        name: literal.value,
        writable: false,
      };
    });
  }

  let source;
  try {
    source = helpers.getASTSource(node);
  } catch {
    return [];
  }

  // The definition matches below must be in the global scope for us to define
  // a global, so bail out early if we're not a global.
  if (!isGlobal) {
    return [];
  }

  // for (let reg of subScriptMatches) {
  //   let match = source.match(reg);
  //   if (match) {
  //     return getGlobalsForScript(match[1], "script").map(g => {
  //       // We don't want any loadSubScript globals to be explicit, as this
  //       // could trigger no-unused-vars when importing multiple variables
  //       // from a script and not using all of them.
  //       g.explicit = false;
  //       return g;
  //     });
  //   }
  // }

  for (const reg of callExpressionDefinitions) {
    const match = source.match(reg);
    if (match) {
      return [{name: match[1], writable: true, explicit: true}];
    }
  }

  if (
    callExpressionMultiDefinitions.some(expr => source.startsWith(expr)) &&
    node.expression.arguments[1]
  ) {
    const arg = node.expression.arguments[1];
    if (arg.type === "ObjectExpression") {
      return arg.properties
          .map(p => ({
            name: p.type === "Property" && p.key.name,
            writable: true,
            explicit: true,
          }))
          .filter(g => g.name);
    }
    if (arg.type === "ArrayExpression") {
      return arg.elements
          .map(p => ({
            name: p.type === "Literal" && p.value,
            writable: true,
            explicit: true,
          }))
          .filter(g => typeof g.name == "string");
    }
  }

  if (
    node.expression.callee.type == "MemberExpression" &&
    node.expression.callee.property.type == "Identifier" &&
    node.expression.callee.property.name == "defineLazyScriptGetter"
  ) {
    // The case where we have a single symbol as a string has already been
    // handled by the regexp, so we have an array of symbols here.
    return node.expression.arguments[1].elements.map(n => ({
      name: n.value,
      writable: true,
      explicit: true,
    }));
  }

  return [];
}

export default {
  meta: {
    messages: { },
    type: "problem",
  },

  create(context) {
    let globalScope, parents;

    return {
      Program(node) {
        parents = context.sourceCode.getAncestors(node);
        globalScope = context.sourceCode.getScope(node);
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
