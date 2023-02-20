module.exports = {
  "*.{js,ts,tsx}":
    "eslint --fix --cache-location config/.eslintcache --cache --ignore-path config/.eslintignore --ext .js,.jsm,.xhtml .",
};
