"use strict";

var EXPORTED_SYMBOLS = ["Decode"];

/*
    The escape and unescape functions are deprecated we use encodeURI and decodeURI instead.
    we use this code only for the case that old escape string was left unused after
    unescape was removed.

    use unescape if exist, if removed from firefox we use our own function
*/
this.Decode = {
  escape: function(str) {
    // we always use encodeURI
    return encodeURI(str);
    // let self = this;
    // return str.replace(/[^\w @\*\-\+\.\/]/g, function(aChar) {return self._(aChar);});
    // return str.replace(/[^\w @\*\-\+\.\/]/g, getReturnValue);
  },
  unescape: function(str) {
    if (typeof unescape == "function")
      return unescape(str);

   //    let self = this;
   //    return str.replace(/%(u[\da-f]{4}|[\da-f]{2})/gi, function(seq) {return self._(seq);});
    return str.replace(/%(u[\da-f]{4}|[\da-f]{2})/gi, getReturnValue);
  }
};

let escapeHash = {};

function getReturnValue (input) {
  var ret = escapeHash[input];
  if (!ret) {
    if (input.length - 1) {
      let code = parseInt(input.substring(input.length - 3 ? 2 : 1), 16);
      ret = fixedFromCharCode(code);
    }
    else {
      let code = input.charCodeAt(0);
      ret = code < 256 ?
        "%" + ("0" + code.toString(16)).slice(-2).toUpperCase() :
        "%u" + ("000" + code.toString(16)).slice(-4).toUpperCase();
    }
    escapeHash[ret] = input;
    escapeHash[input] = ret;
  }
  return ret;
}

/* from https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/String/fromCharCode
* String.fromCharCode() alone cannot get the character at such a high code point
* The following, on the other hand, can return a 4-byte character as well as the
*   usual 2-byte ones (i.e., it can return a single character which actually has
*   a string length of 2 instead of 1!)
*/
function fixedFromCharCode(codePt) {
  if (codePt > 0xFFFF) {
    codePt -= 0x10000;
    return String.fromCharCode(0xD800 + (codePt >> 10), 0xDC00 + (codePt & 0x3FF));
  }
  else {
    return String.fromCharCode(codePt);
  }
}
