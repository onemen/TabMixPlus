import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginJsonc from "eslint-plugin-jsonc";
import eslintPluginMozilla from "eslint-plugin-mozilla";
import eslintPluginTabmix from "./config/eslint-plugin-tabmix/index.js";

const mozillaGlobals = eslintPluginMozilla.environments;
const tabmixGlobals = eslintPluginTabmix.environments;

eslintConfigPrettier.name = "prettier/disable_formatting_rules";

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

// use flat/valid-jsdoc only on js files
eslintPluginMozilla.configs["flat/valid-jsdoc"].files = ["**/*.js", "**/*.sys.mjs"];

export default [
  {
    name: "tabmix/global-ignore",
    ignores: [
      ".github",
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
      "**/*local*.*",
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
      "mozilla/import-globals": "off",

      // -- Custom Tabmix Rules --
      "tabmix/lazy-getter-name-match": "error",

      // -- General Rule Overrides & Additions --
      // These are rules that are either not in recommended or are configured differently.
      "class-methods-use-this": "error",
      "complexity": "off",
      "consistent-this": ["error", "self"],
      "curly": ["error", "multi-line"],
      // All output must go through the Tabmix logger (Tabmix.console in
      // content, logger.sys.mjs in modules) so every message carries the
      // [Tabmix:<level>] prefix.
      "no-console": "error",
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
      "no-use-before-define": ["error", {functions: false}],
      "strict": ["error", "global"],
    },
  },

  // globals
  {
    name: "tabmix/default-globals",
    files: ["**/*.js", "**/*.sys.mjs", "**/*.xhtml"],
    ignores: ["**/*.config.js"],
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
      sourceType: "module",
    },
  },

  {
    name: "tabmix/config-files",
    // this file is in the node environment, so turn that on here.
    // All files in config are in the node environment.
    files: ["**/*.config.js", "config/**/*.{js,cjs,mjs,ts}"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },

  {
    name: "tabmix/globals",
    files: [
      "addon/chrome/content/**.js",
      "addon/chrome/content/**.xhtml",
      "addon/chrome/content/**/*.xhtml/*.js",
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

        // deprecated Firefox globals
        browserDragAndDrop: false, // deprecated in Firefox 138
        handleDroppedLink: false, // deprecated in Firefox 151
        newWindowButtonObserver: false, // deprecated in Firefox 138
        OpenInTabsUtils: false, // deprecated in Firefox 151
      },
    },
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
    // Files where `console` is already the Tabmix logger export (imported
    // as `logger as console` or via a lazy getter) or where no Tabmix global
    // exists at call time; the call sites carry the prefix through other
    // means, so the global no-console rule must be relaxed for them.
    name: "tabmix/console-exceptions",
    // config tooling (husky runner, typecheck CLI) is Node code whose CLI
    // output is the interface - console IS the interface there, not a
    // bypass of the Tabmix logger (which is browser-only).
    files: [
      "config/**",
      "addon/modules/logger.sys.mjs",
      "addon/chrome/content/scripts/content.js",
      "addon/chrome/content/broadcaster.js",
      "addon/chrome/content/preferences/overlay/aboutaddons.js",
    ],
    rules: {
      "no-console": "off",
    },
  },

  {
    name: "tabmix/overlay-and-scripts-files",
    files: ["addon/chrome/content/overlay/**", "addon/chrome/content/scripts/**"],
    plugins: {mozilla: eslintPluginMozilla},
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
    languageOptions: {
      sourceType: "module",
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  {
    name: "tabmix/github-scripts",
    files: [".github/scripts/**"],
    languageOptions: {
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

  {
    name: "tabmix/test-engine",
    // Test tooling: Node-side runners/helpers. Browser-side chrome scripts
    // (test/E2E/bridge/) must NOT match this block.
    files: ["test/E2E/**/*.mjs", "test/internals/**/*.mjs", "test/unit/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-console": "off", // the CLI output is the interface
      "no-labels": "off", // one labeled break out of a nested unpack walk
      "mozilla/avoid-Date-timing": "off", // Date.now() run-tagging is fine here
    },
  },

  eslintConfigPrettier, // Add at the end to disable formatting rules
];
