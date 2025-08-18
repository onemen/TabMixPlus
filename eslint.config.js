import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

import eslintPluginHtml from "eslint-plugin-html";
import eslintPluginMozilla from "eslint-plugin-mozilla";
import prettierRecommended from "eslint-plugin-prettier/recommended";
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

if (!stylistic.configs.all.name) {
  stylistic.configs.all.name = "stylisticJs/configs/all";
}

// mkake sure mozilla config ignores .d.ts files
eslintPluginMozilla.configs["flat/recommended"].forEach(config => {
  if (!config.files) {
    config.ignores = [...(config.ignores ?? []), "**/*.d.ts"];
  }
});

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

  prettierRecommended,

  {
    name: "tabmix/stylistic-rules",
    files: ["**/*.js", "**/*.sys.mjs", "**/*.xhtml"],
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "@stylistic/lines-around-comment": [
        "error",
        {beforeBlockComment: true, allowBlockStart: true, allowBlockEnd: true},
      ],
      "@stylistic/no-mixed-operators": [
        "error",
        {
          groups: [
            // conflicting with prettier
            // ["+", "-", "*", "/", "%", "**"],
            ["&", "|", "^", "~", "<<", ">>", ">>>"],
            ["==", "!=", "===", "!==", ">", ">=", "<", "<="],
            ["&&", "||"],
            ["in", "instanceof"],
          ],
          allowSamePrecedence: true,
        },
      ],
      "@stylistic/padding-line-between-statements": [
        "error",
        {blankLine: "never", prev: "*", next: "directive"},
        {blankLine: "always", prev: "directive", next: "*"},
      ],
      "@stylistic/spaced-comment": [
        "error",
        "always",
        {exceptions: ["-", "+", "/"], markers: ["/", "/XXX", "XXX", "****", "***", "**"]},
      ],
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
      "prettier/prettier": ["error", {experimentalTernaries: true}],

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
      "curly": ["error", "multi-line"],
      "dot-notation": ["error", {allowKeywords: true}],
      "guard-for-in": "error",
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
        lazy: false,
        TabsPanel: false,
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
    files: ["addon/modules/bootstrap/**", "addon/modules/Changecode.sys.mjs"],
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "mozilla/balanced-listeners": "error",
      "mozilla/no-aArgs": "error",

      "class-methods-use-this": "off",
      "no-new-func": "off",
      "no-var": "error",
      "prefer-const": "error",
      "prefer-template": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "@stylistic/quotes": ["error", "double", {avoidEscape: true}],
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

  {
    name: "tabmix/github-scripts",
    files: [".github/scripts/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "mozilla/avoid-Date-timing": "off",
      "no-continue": "off",
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
      plugins: {
        "@stylistic": stylistic,
      },
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
        "@stylistic/quotes": ["error", "double", {avoidEscape: true}],
      },
    },
  ],
];
