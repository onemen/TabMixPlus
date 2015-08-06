/* jshint esnext: true */
"use strict";

var EXPORTED_SYMBOLS = ["AsyncUtils"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Promise",
                                  "resource://gre/modules/Promise.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
                                  "resource://tabmixplus/Services.jsm");
this.AsyncUtils = {
  /* PromiseUtils.defer exsit since Firefox 39 */
  defer : function() {
    return new Deferred();
  },

  spawnFn: function(thisArg, fn, index) {
    return this.promisify(thisArg, fn, index).call(undefined);
  },

  asyncFn: function(thisArg, fn, index) {
    return this.promisify(thisArg, fn, index);
  },

  promisify: function(thisArg, fn, index) {
    return function() {
      let deferred = new Deferred();
      let args = Array.slice(arguments);
      if (typeof index == "undefined")
        index = args.length;
      args.splice(index, 0, deferred.callback);

      try {
        fn.apply(thisArg, args);
      } catch(ex) {
        deferred.reject(ex);
      }
      return deferred.promise;
    };
  }
};

function Deferred() {
  let defer = Promise.defer();
  this.promise = defer.promise;
  this.resolve = defer.resolve;
  this.reject = defer.reject;
  this.callback = (result, error) => {
    if (error)
      return this.reject(error);
    return this.resolve(result);
  };
}
