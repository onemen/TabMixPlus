import environments from "./environments.js";
import lazyGetterNameMatch from "./lazy-getter-name-match.js";
import xhtmlProcessor from "./xhtml-processor.js";

export default {
  meta: {
    name: "eslint-plugin-tabmix",
    version: "1.3.0",
  },
  environments,
  processors: {
    xhtml: xhtmlProcessor,
  },
  rules: {
    "lazy-getter-name-match": lazyGetterNameMatch,
  },
};
