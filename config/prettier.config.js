/** @type {import("prettier").Config} */
export default {
  arrowParens: "avoid",
  bracketSpacing: false,
  endOfLine: "lf",
  htmlWhitespaceSensitivity: "css",
  insertPragma: false,
  printWidth: 100,
  proseWrap: "always",
  quoteProps: "consistent",
  requirePragma: false,
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  useTabs: false,
  experimentalTernaries: true,
  plugins: ["prettier-plugin-jsdoc"],
  jsdocCapitalizeDescription: false,
  jsdocPrintWidth: 80,
  overrides: [
    {
      files: "*.yaml",
      options: {
        semi: false,
        singleQuote: true,
      },
    },
    {
      files: "*.d.ts",
      options: {
        printWidth: 500,
        jsdocPrintWidth: 120,
      },
    },
  ],
};
