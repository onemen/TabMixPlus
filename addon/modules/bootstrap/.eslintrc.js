/* eslint strict: 0 */
/* global module */
module.exports = {
  plugins: ["tabmix"],

  rules: {
    "class-methods-use-this": 0,
    "no-new-func": 0,
    "no-var": 2,
    "prefer-const": 2,
  },

  globals: {
    Cc: false,
    Ci: false,
    Cu: false,
    CustomizableUI: false,
  },
};
