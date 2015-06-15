"use strict";

this.EXPORTED_SYMBOLS = ["DocShellCapabilities"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabState",
  "resource:///modules/sessionstore/TabState.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "TabStateCache",
  "resource:///modules/sessionstore/TabStateCache.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");

this.DocShellCapabilities = {
  init: function() {
    this.useFrameScript = TabmixSvc.version(320);
  },

  update: function(browser, data) {
    // Update the persistent tab state cache
    TabStateCache.update(browser, {
      disallow: data.disallow || null
    });
    if (data.reload)
      browser.reload();
  },

  caps: ["Images","Subframes","MetaRedirects","Plugins","Javascript"],

  collect: function(tab) {
    let browser = tab.linkedBrowser;

    if (!this.useFrameScript)
      return this.caps.filter(function(cap) !browser.docShell["allow" + cap]);

    if (tab.ownerDocument.defaultView.__SSi) {
      let tabState = TabState.collect(tab);
      return tabState.disallow || "";
    }

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
};
