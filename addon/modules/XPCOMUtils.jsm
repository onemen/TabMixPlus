var EXPORTED_SYMBOLS = ["XPCOMUtils"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
// Gecko 1.9.0/1.9.1 compatibility - add XPCOMUtils.defineLazyServiceGetter
// only defined in Firefox 3.6 and up
if (!("defineLazyGetter" in XPCOMUtils)) {
  XPCOMUtils.defineLazyGetter = function XPCU_defineLazyGetter(aObject, aName, aLambda) {
    aObject.__defineGetter__(aName, function() {
      delete aObject[aName];
      return aObject[aName] = aLambda.apply(aObject);
    });
  }
}

if (!("defineLazyServiceGetter" in XPCOMUtils)) {
  XPCOMUtils.defineLazyServiceGetter = function XPCU_defineLazyServiceGetter(aObject, aName, aContract, aInterfaceName) {
    this.defineLazyGetter(aObject, aName, function XPCU_serviceLambda() {
      return Cc[aContract].getService(Ci[aInterfaceName]);
    });
  }
}