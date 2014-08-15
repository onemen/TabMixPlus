"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

// DocShellCapabilities exist since Firefox 27
XPCOMUtils.defineLazyModuleGetter(this, "DocShellCapabilities",
  "resource:///modules/sessionstore/DocShellCapabilities.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");

let MessageListener = {
  MESSAGES: [
    "Tabmix:restorePermissions",
    "Tabmix:collectPermissions",
  ],

  init: function () {
    this.MESSAGES.forEach(m => addMessageListener(m, this));

    // Send a CPOW to the parent so that it can synchronously request
    // docShell capabilities.
    sendSyncMessage("Tabmix:SetSyncHandler", {}, {syncHandler: this});
  },

  receiveMessage: function ({name, data}) {
    switch (name) {
      case "Tabmix:restorePermissions":
        let disallow = new Set(data.disallow && data.disallow.split(","));
        DocShellCapabilities.restore(docShell, disallow);
        sendSyncMessage("Tabmix:restoPermissionsComplete", {
          disallow: data.disallow,
          reload: data.reload
        });
      break;
      case "Tabmix:collectPermissions":
      let caps = DocShellCapabilities.collect(docShell).join(",");
      sendSyncMessage("Tabmix:collectPermissionsComplete", {caps: caps});
      break;
    }
  },

  getCapabilities: function() {
    return DocShellCapabilities.collect(docShell).join(",") || "";
  }
};

MessageListener.init();
