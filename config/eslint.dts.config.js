import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";

// This file is dedicated to linting .d.ts files.
// It is called by the script in `config/typecheck.js`.

export default [
  ...tseslint.configs.recommended.map(conf => ({
    ...conf,
    files: ["@types/**/*.d.ts"],
    ignores: ["@types/gecko/**/*.d.ts"],
  })),
  {
    name: "tabmix/override-typescript-eslint-rules",
    files: ["@types/**/*.d.ts"],
    ignores: ["@types/gecko/**/*.d.ts"],
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
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@stylistic/quotes": ["error", "double", {avoidEscape: true}],
    },
  },
];
