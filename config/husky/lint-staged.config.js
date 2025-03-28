export default {
  "*.{js,jsm,xhtml}":
    "eslint --format stylish --fix --cache --cache-location config/.eslintcache --cache-strategy content --no-warn-ignored",
  "*.css": 'stylelint --fix --config config/.stylelintrc.json "addon/**/*.css"',
};
