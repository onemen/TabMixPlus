import js from "@eslint/js";
import stylisticJs from "@stylistic/eslint-plugin-js";
import globals from "globals";

import eslintPluginHtml from "eslint-plugin-html";
import eslintPluginMozilla from "eslint-plugin-mozilla";
import tseslint from "typescript-eslint";
import eslintPluginTabmix from "./config/eslint-plugin-tabmix/index.js";

const mozillaGlobals = eslintPluginMozilla.environments;
const tabmixGlobals = eslintPluginTabmix.environments;

const workerConfig = eslintPluginMozilla.configs["flat/recommended"]
    .filter(config => !config.name)
    .find(config => config.files?.includes("**/?(*.)worker.?(m)js"));
if (workerConfig) {
  workerConfig.name = "mozilla/recommended/worker-files";
}

if (!stylisticJs.configs["all-flat"].name) {
  stylisticJs.configs["all-flat"].name = "stylisticJs/configs/all-flat";
}

const indentConfig = [
  "error",
  2,
  {
    SwitchCase: 1,
    VariableDeclarator: {var: 2, let: 2, const: 3},
    outerIIFEBody: 1,
    MemberExpression: 2,
    FunctionDeclaration: {body: 1, parameters: "first"},
    FunctionExpression: {body: 1, parameters: "first"},
    CallExpression: {arguments: 1},
    ArrayExpression: 1,
    ObjectExpression: 1,
  },
];

const stylisticRules = {
  // turn off some stylistic rules
  "@stylistic/js/array-element-newline": "off",
  "@stylistic/js/array-bracket-newline": "off",
  "@stylistic/js/lines-around-comment": "off",
  "@stylistic/js/function-call-argument-newline": "off",
  "@stylistic/js/function-paren-newline": "off",
  "@stylistic/js/multiline-comment-style": "off",
  "@stylistic/js/nonblock-statement-body-position": "off",
};

export default [
  {
    name: "tabmix/global-ignore",
    ignores: [
      ".hg",
      "**/*~/*",
      "**/*~*.*",
      "**/*׳¢׳•׳×׳§*.*",
      "**/*עותק*.*",
      "**/private/*",
      "./config/*",
      "!./config/eslint-plugin-tabmix/*",
      "!./config/typecheck.cjs",
      "eslint_result.js",
      "manifest.json",
      "logs/",
      ".vscode",
      "**/*.local.*",
    ],
  },

  {
    name: "eslint/configs/recommended",
    ...js.configs.recommended,
  },
  ...eslintPluginMozilla.configs["flat/recommended"],

  stylisticJs.configs["all-flat"],

  {
    name: "tabmix/stylistic-rules",
    files: ["**/*.js", "**/*.sys.mjs", "**/*.xhtml"],
    rules: {
      // turn off some stylistic rules
      ...stylisticRules,

      "@stylistic/js/array-bracket-spacing": ["error", "never"],
      "@stylistic/js/arrow-parens": ["error", "as-needed"],
      "@stylistic/js/arrow-spacing": ["error", {before: true, after: true}],
      "@stylistic/js/block-spacing": ["error", "never"],
      "@stylistic/js/brace-style": ["error", "1tbs", {allowSingleLine: true}],
      // TODO - maybe in the future
      "@stylistic/js/comma-dangle": "off",
      "@stylistic/js/comma-spacing": "error",
      "@stylistic/js/comma-style": ["error", "last"],
      "@stylistic/js/computed-property-spacing": ["error", "never"],
      "@stylistic/js/dot-location": ["error", "property"],
      "@stylistic/js/eol-last": "error",
      "@stylistic/js/func-call-spacing": ["error", "never"],
      "@stylistic/js/generator-star-spacing": ["error", "after"],
      "@stylistic/js/indent": indentConfig,
      "@stylistic/js/jsx-quotes": "off",
      "@stylistic/js/key-spacing": ["error", {beforeColon: false, afterColon: true}],
      "@stylistic/js/keyword-spacing": "error",
      "@stylistic/js/linebreak-style": ["error", "unix"],
      "@stylistic/js/max-len": ["off", 120, 4],
      "@stylistic/js/max-statements-per-line": ["error", {max: 1}],
      "@stylistic/js/multiline-ternary": "off",
      "@stylistic/js/new-parens": "error",
      "@stylistic/js/newline-per-chained-call": "off",
      "@stylistic/js/no-confusing-arrow": ["error", {allowParens: true}],
      "@stylistic/js/no-extra-parens": [
        "error",
        "all",
        {
          returnAssign: false,
          enforceForArrowConditionals: false,
          enforceForSequenceExpressions: false,
          enforceForNewInMemberExpressions: false,
          enforceForFunctionPrototypeMethods: false,
        },
      ],
      "@stylistic/js/no-extra-semi": "error",
      "@stylistic/js/no-floating-decimal": "error",
      "@stylistic/js/no-mixed-requires": ["off", false],
      "@stylistic/js/no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
      "@stylistic/js/no-multi-spaces": "error",
      "@stylistic/js/no-multiple-empty-lines": ["error", {max: 1}],
      "@stylistic/js/no-trailing-spaces": "error",
      "@stylistic/js/no-whitespace-before-property": "error",
      "@stylistic/js/object-curly-newline": [
        "error",
        {ObjectExpression: {multiline: true}, ObjectPattern: "never"},
      ],
      "@stylistic/js/object-curly-spacing": ["error", "never"],
      "@stylistic/js/object-property-newline": ["error", {allowMultiplePropertiesPerLine: true}],
      "@stylistic/js/one-var-declaration-per-line": "off",
      "@stylistic/js/operator-linebreak": ["error", "after"],
      "@stylistic/js/padded-blocks": ["error", "never"],
      "@stylistic/js/padding-line-between-statements": [
        "error",
        {blankLine: "never", prev: "*", next: "directive"},
        {blankLine: "always", prev: "directive", next: "*"},
      ],
      // in Firefox i can use properties obj - {default: x, private: y}
      "@stylistic/js/quote-props": ["off", "as-needed", {keywords: true}],
      "@stylistic/js/quotes": ["off", "double"],
      "@stylistic/js/rest-spread-spacing": "error",
      "@stylistic/js/semi": "error",
      "@stylistic/js/semi-spacing": ["error", {before: false, after: true}],
      "@stylistic/js/space-before-blocks": ["error", "always"],
      "@stylistic/js/space-before-function-paren": ["error", "never"],
      "@stylistic/js/space-in-parens": ["error", "never"],
      "@stylistic/js/space-infix-ops": "error",
      "@stylistic/js/space-unary-ops": ["error", {words: true, nonwords: false}],
      "@stylistic/js/spaced-comment": [
        "error",
        "always",
        {exceptions: ["-", "+", "/"], markers: ["/", "/XXX", "XXX", "****", "***", "**"]},
      ],
      "@stylistic/js/switch-colon-spacing": ["error", {after: true, before: false}],
      "@stylistic/js/template-curly-spacing": ["error", "never"],
      "@stylistic/js/wrap-iife": "error",
      "@stylistic/js/wrap-regex": "off",
      "@stylistic/js/yield-star-spacing": ["error", "after"],
    },
  },

  {
    name: "tabmix/main-rules",
    files: ["**/*.js", "**/*.sys.mjs", "**/*.xhtml"],
    plugins: {
      mozilla: eslintPluginMozilla,
      tabmix: eslintPluginTabmix,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
    },
    linterOptions: {reportUnusedDisableDirectives: "error"},
    rules: {
      "prettier/prettier": "off",

      // Enable some mozilla rules that are not enabled by mozilla/recommended.
      "mozilla/avoid-Date-timing": "error",
      "mozilla/balanced-listeners": "off",
      "mozilla/balanced-observers": "error",
      "mozilla/no-aArgs": "off",
      "mozilla/reject-chromeutils-import": "off",
      "mozilla/valid-lazy": "off",

      "tabmix/import-globals": "error",
      "tabmix/lazy-getter-name-match": "error",
      "tabmix/valid-lazy": "error",

      "accessor-pairs": "error",
      "array-callback-return": "error",
      "block-scoped-var": "error",
      "class-methods-use-this": "error",
      "complexity": ["off", 11],
      "consistent-this": ["error", "self"],
      // TODO - currently there are more the 1000 errors if we enable "curly"
      "curly": ["off", "all"],
      "dot-notation": ["error", {allowKeywords: true}],
      "func-style": ["off", "declaration"],
      "guard-for-in": "error",
      "lines-around-comment": [
        "off",
        {beforeBlockComment: true, allowBlockStart: true, allowBlockEnd: true},
      ],
      "max-depth": ["off", 4],
      "max-nested-callbacks": ["off", 2],
      "max-params": ["off", 3],
      "max-statements": ["off", 10],
      "no-alert": "error",
      "no-console": "off",
      "no-continue": "error",
      "no-div-regex": "error",
      "no-duplicate-imports": ["error", {includeExports: true}],
      "no-eq-null": "error",
      "no-eval": "off",
      "no-extend-native": "error",
      "no-extra-label": "error",
      "no-implicit-coercion": "error",
      "no-inner-declarations": ["error", "functions"],
      "no-label-var": "error",
      "no-loop-func": "error",
      "no-nested-ternary": "off",
      "no-new": "error",
      "no-new-func": "error",
      "no-octal-escape": "error",
      "no-proto": "error",
      "no-restricted-globals": "off",
      "no-return-assign": ["error", "except-parens"],
      "no-shadow": ["error", {hoist: "all"}],
      "no-template-curly-in-string": "error",
      "no-undef-init": "error",
      "no-unmodified-loop-condition": "error",
      "no-unused-expressions": "error",
      "no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^ignored",
        },
      ],
      "no-use-before-define": ["error", "nofunc"],
      "no-useless-computed-key": "error",
      "no-useless-constructor": "error",
      "no-useless-rename": "error",
      "no-warning-comments": ["off", {terms: ["todo", "fixme", "xxx"], location: "start"}],
      "operator-assignment": ["error", "always"],
      "prefer-arrow-callback": ["error", {allowNamedFunctions: true}],
      "require-await": "error",
      "strict": ["error", "global"],
      "symbol-description": "error",
      "yoda": ["error", "never"],
    },
  },

  // globals
  {
    name: "tabmix/default-globals",
    files: ["**/*.js", "**/*.sys.mjs", "**/*.xhtml"],
    ignores: ["**/**/*.config.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...mozillaGlobals.privileged.globals,
        ...mozillaGlobals.specific.globals,
        event: "off",
        name: "off",
      },
    },
  },

  {
    name: "tabmix/sourceType",
    files: ["**/*.sys.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },

  {
    name: "tabmix/config-files",
    // All .eslintrc.js files are in the node environment, so turn that
    // on here.
    // https://github.com/eslint/eslint/issues/13008
    // All files in eslint-plugin-tabmix are in the node environment.
    files: ["**/**/*.config.js", "config/eslint-plugin-tabmix/**", "config/*.{js,cjs,mjs,ts}"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": "error",
      ...stylisticRules,
      "@stylistic/js/indent": indentConfig,
      "@stylistic/js/padded-blocks": ["error", "never"],
      "@stylistic/js/space-before-function-paren": ["error", "never"],
    },
  },

  {
    name: "tabmix/globals",
    files: [
      "addon/chrome/content/**.js",
      "addon/chrome/content/**.xhtml",
      "addon/chrome/content/click/**",
      "addon/chrome/content/extensions/**",
      "addon/chrome/content/flst/**",
      "addon/chrome/content/links/**",
      "addon/chrome/content/minit/**",
      "addon/chrome/content/places/**",
      "addon/chrome/content/session/**",
      "addon/chrome/content/tab/**",
    ],
    languageOptions: {
      globals: {
        ...mozillaGlobals["browser-window"].globals,
        ...tabmixGlobals.extensions,
        ...tabmixGlobals.tabmix,
        TabsPanel: false
      },
    },
  },

  {
    name: "tabmix/dialogs-globals",
    files: ["addon/chrome/content/dialogs/**"],
    languageOptions: {globals: tabmixGlobals.dialog},
  },

  {
    name: "tabmix/overlay-and-scripts-globals",
    files: ["addon/chrome/content/overlay/**", "addon/chrome/content/scripts/**"],
    languageOptions: {globals: mozillaGlobals["frame-script"].globals},
  },

  {
    name: "tabmix/preferences-globals",
    files: ["addon/chrome/content/preferences/**"],
    languageOptions: {globals: tabmixGlobals.preferences},
  },

  {
    name: "tabmix/extensions.js-globals",
    files: ["addon/chrome/content/extensions/extensions.js"],
    languageOptions: {globals: tabmixGlobals["extensions-js"]},
  },

  // overrides rules
  {
    name: "tabmix/xhtml-files",
    files: ["**/*.html", "**/*.xhtml"],
    plugins: {html: eslintPluginHtml},
    rules: {
      // Curly brackets are required for all the tree via recommended.js,
      // however these files aren't auto-fixable at the moment.
      "curly": "off",
      "no-new-func": "off",
      "strict": "off",
    },
  },

  {
    name: "tabmix/overlay-and-scripts-files",
    files: ["addon/chrome/content/overlay/**", "addon/chrome/content/scripts/**"],
    rules: {
      //
      "mozilla/reject-eager-module-in-lazy-getter": "error", // recommended
    },
  },

  {
    name: "tabmix/modules/bootstrap-files",
    files: ["addon/modules/bootstrap/**"],
    rules: {
      "mozilla/balanced-listeners": "error",
      "mozilla/no-aArgs": "error",
      "mozilla/var-only-at-top-level": "error",

      "class-methods-use-this": "off",
      "no-new-func": "off",
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  {
    name: "tabmix/bootstrap.js",
    files: ["addon/bootstrap.js"],
    languageOptions: {
      globals: {
        ADDON_ENABLE: false,
        ADDON_DISABLE: false,
        ADDON_DOWNGRADE: false,
        ADDON_INSTALL: false,
        ADDON_UNINSTALL: false,
        ADDON_UPGRADE: false,
      },
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  {
    name: "tabmix/eslint-plugin-tabmix-files",
    files: ["config/eslint-plugin-tabmix/**"],
    rules: {
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  // for .d.ts files only
  ...[
    ...tseslint.configs.recommended.map(conf => ({
      ...conf,
      files: ["**/*.d.ts"],
      ignores: ["**/gecko/**/*.d.ts"],
    })),
    {
      name: "tabmix/override-typescript-eslint-rules",
      files: ["**/*.d.ts"],
      ignores: ["**/gecko/**/*.d.ts"],
      rules: {
        "no-var": "off",
        "no-shadow": "off",
        "no-unused-vars": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-misused-new": "off",
        "@typescript-eslint/no-empty-object-type": [
          "error",
          {allowInterfaces: "with-single-extends"},
        ],
        ...stylisticRules,
        "@stylistic/js/indent": "off",
        "@stylistic/js/lines-between-class-members": "off",
        "@stylistic/js/padded-blocks": "off",
        "@stylistic/js/quotes": ["error", "double", {avoidEscape: true}],
      },
    },
  ],
];
