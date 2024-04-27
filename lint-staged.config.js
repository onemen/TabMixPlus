module.exports = {
  "*.{js,jsm,xhtml}":
    "eslint --format stylish --fix --cache --cache-location config/.eslintcache --no-warn-ignored **/**/*.{js,jsm,xhtml}",
};
