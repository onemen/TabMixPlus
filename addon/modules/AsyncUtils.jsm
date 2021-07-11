"use strict";

this.EXPORTED_SYMBOLS = ["AsyncUtils"];

ChromeUtils.defineModuleGetter(this, "Promise",
  "resource://gre/modules/Promise.jsm");

this.AsyncUtils = {
  spawnFn(thisArg, fn, index) {
    return this.promisify(thisArg, fn, index)();
  },

  asyncFn(thisArg, fn, index) {
    return this.promisify(thisArg, fn, index);
  },

  promisify(thisArg, fn, index) {
    return function(...args) {
      return new Promise((resolve, reject) => {
        if (typeof index == "undefined")
          index = args.length;
        args.splice(index, 0, (result, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });

        try {
          fn.apply(thisArg, args);
        } catch (ex) {
          reject(ex);
        }
      });
    };
  }
};
