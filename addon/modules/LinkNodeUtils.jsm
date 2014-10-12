"use strict";

var EXPORTED_SYMBOLS = ["LinkNodeUtils"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");

this.LinkNodeUtils = {
  isFrameInContent: function(content, href, name) {
    if (!content)
      return false;
    if (content.location.href == href && content.name == name)
      return true;
    for (let i = 0; i < content.frames.length; i++) {
      let frame = content.frames[i];
      if (frame.location.href == href && frame.name == name)
        return true;
    }
    return false;
  }
}
