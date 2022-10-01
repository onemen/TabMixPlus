"use strict";

const path = require("path");
const fs = require("fs");

const mozilla = require.resolve("eslint-plugin-mozilla");
const mozillaPath = path.dirname(mozilla);
const helpers = require(path.join(mozillaPath, "helpers.js"));

const SYSMJS_FILE_NAME = "sysmjs.txt";
const USED_SYSMJS_IN_TABMIX = "usedmjs.json";
const CHROME_UTILS_PATH = "addon/modules/ChromeUtils.jsm";
const ROOTDIR = path.join(__dirname, "..", "..");

function getMsjFiles() {
  const filePath = path.join(__dirname, SYSMJS_FILE_NAME);
  if (!fs.existsSync(filePath)) {
    console.log("File not found", filePath);
    return null;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const sysmsj = content
      .split(/\r?\n/)
      .filter(Boolean)
      .map(file => path.basename(file.trim().slice(0, -1)));

  const jsm = sysmsj.map(file => file.replace(".sys.mjs", ".jsm"));
  return [jsm, sysmsj];
}

function getModulesMap() {
  const filePath = path.join(ROOTDIR, CHROME_UTILS_PATH);
  const content = fs.readFileSync(filePath, "utf8");
  const {ast} = helpers.parseCode(content);
  for (const node of Object.values(ast.body)) {
    if (node.type === "VariableDeclaration") {
      for (const item of node.declarations) {
        // item.id?.name must match the variable in in ChromeUtils.jsm
        if (item.id?.type == "Identifier" && item.id?.name === "modulesMap") {
          return item.init.properties.map(i => i.key.value);
        }
      }
    }
  }
  return [];
}

function readUsedMjsResources() {
  const filePath = path.join(__dirname, USED_SYSMJS_IN_TABMIX);
  if (!fs.existsSync(filePath)) {
    console.log("File not found", filePath);
    return [];
  }
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

const lazy = {};

Object.defineProperty(lazy, "usedMjsResources", {
  get() {
    delete this.usedMjsResources;
    return (this.usedMjsResources = readUsedMjsResources());
  },
  configurable: true,
});

Object.defineProperty(lazy, "modulesMap", {
  get() {
    delete this.modulesMap;
    return (this.modulesMap = getModulesMap());
  },
  set(val) {
    delete this.modulesMap;
    this.modulesMap = val;
  },
  configurable: true,
});

const [jsmFiles] = getMsjFiles() || [];

const items = ["XPCOMUtils", "ChromeUtils", "TabmixChromeUtils"];

const callExpressionDefinitions = [
  /^XPCOMUtils\.defineLazyGetter\(.*,\s*"(\w+)",\s*"(.+)"/,
  /^XPCOMUtils\.defineLazyModuleGetter\(.*,\s*"(\w+)",\s*"(.+)"/,
  /^ChromeUtils\.defineModuleGetter\(.*,\s*"(\w+)",\s*"(.+)"/,
];

const callExpressionMultiDefinitions = [
  "ChromeUtils.defineESModuleGetters(",
  "XPCOMUtils.defineLazyModuleGetters(",
];

module.exports = {
  meta: {
    messages: {
      missingInChromeUtils:
        "The path to {{name}} is missing from ChromeUtils.jsm modulesMap object.",
      modulesMap: "modulesMap is missing some .sys.mjs files:\n {{missingFiles}}",
      outDatedChromeUtilsImport: "Use TabmixChromeUtils.import for {{name}}, .sys.mjs file exist",
      outDatedDefineLazyModuleGetters:
        "Use TabmixChromeUtils.defineLazyModuleGetters for {{name}}, .sys.mjs file exist",
    },
    type: "problem",
  },

  create(context) {
    if (!jsmFiles || !jsmFiles.length) {
      return {};
    }

    function isIdentifier(node, id) {
      return node && node.type === "Identifier" && node.name === id;
    }

    function checkForMissingResources(node, item) {
      lazy.modulesMap = item.init.properties.map(i => i.key.value);
      const missingMjsFiles = lazy.usedMjsResources.filter(f => !lazy.modulesMap.includes(f));
      if (missingMjsFiles.length) {
        const missingFiles = missingMjsFiles
            .map(f => path.basename(f).replace(".jsm", ".sys.mjs"))
            .join("\n ");
        context.report({
          node,
          loc: item.id.loc,
          messageId: "modulesMap",
          data: {missingFiles},
        });
      }
    }

    function addReport(messageId, node, {value}, prop) {
      if (value && lazy.usedMjsResources.includes(value)) {
        const name = `"${value.split("/").pop()}"`;
        if (messageId !== "missingInChromeUtils") {
          context.report({
            node,
            loc: prop?.loc,
            messageId,
            data: {name},
          });
        }
        if (!lazy.modulesMap.includes(value)) {
          context.report({
            node,
            loc: prop?.loc,
            messageId: "missingInChromeUtils",
            data: {name},
          });
        }
      }
    }

    function addReportForExpression(messageId, node) {
      const arg = node.arguments[1];
      if (arg.type === "ObjectExpression") {
        for (const prop of arg.properties) {
          if (prop.key.type !== "Literal") {
            addReport(messageId, node, prop.value, prop);
          }
        }
      }
    }

    const CallExpression = node => {
      const {callee} = node;
      if (
        callee.type != "MemberExpression" ||
          callee.object.type == "MemberExpression" &&
            !items.includes(callee.object.object.name) ||
          callee.object.type != "MemberExpression" && !items.includes(callee.object.name)
      ) {
        return;
      }

      if (isIdentifier(callee.object, "TabmixChromeUtils")) {
        if (isIdentifier(callee.property, "import")) {
          addReport("missingInChromeUtils", node, node.arguments[0]);
        } else if (isIdentifier(callee.property, "defineLazyModuleGetters")) {
          addReportForExpression("missingInChromeUtils", node);
        }
        return;
      }

      if (isIdentifier(callee.object, "ChromeUtils") && isIdentifier(callee.property, "import")) {
        addReport("outDatedChromeUtilsImport", node, node.arguments[0]);
        return;
      }

      let source;
      try {
        source = helpers.getASTSource(node);
      } catch (e) {
        return;
      }

      for (const reg of callExpressionDefinitions) {
        const match = source.match(reg);
        if (match) {
          addReport("outDatedDefineLazyModuleGetters", node, {value: match[2]});
        }
      }

      if (
        callExpressionMultiDefinitions.some(expr => source.startsWith(expr)) &&
          node.arguments[1]
      ) {
        addReportForExpression("outDatedDefineLazyModuleGetters", node);
      }
    };

    const VariableDeclaration = node => {
      for (const item of node.declarations) {
        if (item.id?.type == "Identifier" && item.id?.name === "modulesMap") {
          checkForMissingResources(node, item);
          break;
        }
      }
    };

    const isChromeUtils = context.getFilename() === path.resolve(CHROME_UTILS_PATH);
    if (isChromeUtils) {
      return {
        CallExpression,
        VariableDeclaration,
      };
    }
    return {CallExpression};
  },
};
