export default {
  // Root-level JS and JSON files
  "*.{js,json}": [
    "eslint --fix --format stylish --fix --cache --cache-location config/.eslintcache --cache-strategy content --no-warn-ignored",
  ],

  // JS/JSX/XHTML in addon/ and config/
  "addon/**/*.{js,jsm,xhtml}": [
    "eslint --fix --format stylish --fix --cache --cache-location config/.eslintcache --cache-strategy content --no-warn-ignored",
  ],
  "config/**/*.{js,jsm,xhtml}": [
    "eslint --fix --format stylish --fix --cache --cache-location config/.eslintcache --cache-strategy content --no-warn-ignored",
  ],

  // CSS in addon/
  "addon/**/*.css": ["stylelint --fix --config config/.stylelintrc.json"],
};
