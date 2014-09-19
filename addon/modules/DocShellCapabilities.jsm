"use strict";

this.EXPORTED_SYMBOLS = ["DocShellCapabilities"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabStateCache",
  "resource:///modules/sessionstore/TabStateCache.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");

this.DocShellCapabilities = {
  init: function(window) {
    this.useFrameScript = TabmixSvc.version(320);
    if (this.useFrameScript) {
      let mm = window.getGroupMessageManager("browsers");
      mm.addMessageListener("Tabmix:restoPermissionsComplete", this);
    }
  },

  deinit: function(window) {
    if (this.useFrameScript) {
      let mm = window.getGroupMessageManager("browsers");
      mm.removeMessageListener("Tabmix:restoPermissionsComplete", this);
    }
  },

  receiveMessage: function(message) {
    let browser = message.target;
    switch (message.name) {
      case "Tabmix:restoPermissionsComplete":
        // Update the persistent tab state cache
        TabStateCache.update(browser, {
          disallow: message.data.disallow || null
        });
        if (message.data.reload)
          browser.reload();
        break;
    }
  },

  caps: ["Images","Subframes","MetaRedirects","Plugins","Javascript"],

  collect: function(tab) {
    let browser = tab.linkedBrowser;

    if (!this.useFrameScript)
      return this.caps.filter(function(cap) !browser.docShell["allow" + cap]);

    try {
      let handler = TabmixSvc.syncHandlers.get(browser.permanentKey);
      return handler.getCapabilities();
    } catch(ex) { }
    return "";
  },

  restore: function(tab, disallow, reload) {
    let browser = tab.linkedBrowser;
    if (reload && tab.getAttribute("pending") == "true")
      reload = false;

    if (!this.useFrameScript) {
      let browserDocShell = browser.docShell;
      disallow = new Set(disallow);
      for (let cap of this.caps)
        browserDocShell["allow" + cap] = !disallow.has(cap);
      if (reload)
        browser.reload();
      return;
    }

    browser.messageManager.sendAsyncMessage("Tabmix:restorePermissions",
      {disallow: disallow.join(","), reload: reload || false});
  },

  /*** for tab context menu ***/

  onGet: function(nodes, tab) {
    let disallow = this.collect(tab);
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("checked", disallow.indexOf(nodes[i].value) == -1);
    }
  },

  onSet: function(tab, node) {
    let nodes = node.parentNode.childNodes;
    let disallow = [];
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute("checked") != "true")
        disallow.push(nodes[i].value);
    }
    this.restore(tab, disallow, true);
  }
}
