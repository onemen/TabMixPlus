import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginJsonc from "eslint-plugin-jsonc";
import eslintPluginMozilla from "eslint-plugin-mozilla";
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

// make sure mozilla config ignores .d.ts files
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
      "**/private/**",
      "eslint_result.js",
      "manifest.json",
      "logs/",
      ".vscode",
      "**/*local*/**",
      "**/*.d.ts",
      "**/@types/**",
    ],
  },

  // Base configs - provides the foundation
  ...eslintPluginJsonc.configs["flat/recommended-with-jsonc"],
  ...eslintPluginMozilla.configs["flat/recommended"],
  eslintPluginMozilla.configs["flat/valid-jsdoc"],

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
      tabmix: eslintPluginTabmix,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
    },
    linterOptions: {reportUnusedDisableDirectives: "warn"},
    rules: {
      // -- Mozilla Rules --
      // Enable some mozilla rules that are not enabled by mozilla/recommended.
      "mozilla/avoid-Date-timing": "error",
      "mozilla/balanced-observers": "error",
      // Explicitly disable some recommended rules
      "mozilla/balanced-listeners": "off",
      "mozilla/no-aArgs": "off",
      "mozilla/reject-chromeutils-import": "off",
      "mozilla/import-globals": "off",

      // -- Custom Tabmix Rules --
      "tabmix/lazy-getter-name-match": "error",

      // -- General Rule Overrides & Additions --
      // These are rules that are either not in recommended or are configured differently.
      "class-methods-use-this": "error",
      "complexity": "off",
      "consistent-this": ["error", "self"],
      "curly": ["error", "multi-line"],
      "no-console": "off",
      "no-continue": "error",
      "no-eval": "off",
      "no-nested-ternary": "off",
      "no-shadow": ["error", {hoist: "all"}],
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
      "strict": ["error", "global"],
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
    // this file is in the node environment, so turn that on here.
    // All files in config are in the node environment.
    files: ["**/**/*.config.js", "config/**/*.{js,cjs,mjs,ts}"],
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
      "addon/chrome/content/update/**",
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
    languageOptions: {
      globals: {
        ...mozillaGlobals["frame-script"].globals,
        ...tabmixGlobals.tabmix,
      },
    },
  },

  {
    name: "tabmix/preferences-globals",
    files: ["addon/chrome/content/preferences/**"],
    languageOptions: {
      globals: {
        ...tabmixGlobals.preferences,
        ...tabmixGlobals.tabmix,
      },
    },
  },

  {
    name: "tabmix/extensions.js-globals",
    files: ["addon/chrome/content/extensions/extensions.js"],
    languageOptions: {globals: tabmixGlobals["extensions-js"]},
  },

  // overrides rules

  {
    name: "tabmix/xhtml-container",
    files: ["**/*.xhtml", "**/*.html"],
    plugins: {tabmix: eslintPluginTabmix},
    processor: "tabmix/xhtml",
    // Do NOT put JS rules here; this block just handles the "extraction"
  },

  {
    name: "tabmix/xhtml-internal-js",
    files: ["**/*.xhtml/*.js", "**/*.html/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...tabmixGlobals.tabmix,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "curly": "off",
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
        ...tabmixGlobals.tabmix,
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

  eslintConfigPrettier, // Add at the end to disable formatting rules

  {
    name: "tabmix/force-ignore-dts",
    files: ["**/*.d.ts"],
    ignores: ["**/*.d.ts"],
    rules: {},
  },
];
