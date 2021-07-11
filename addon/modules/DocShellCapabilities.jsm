"use strict";

this.EXPORTED_SYMBOLS = ["DocShellCapabilities"];

ChromeUtils.defineModuleGetter(this, "TabState",
  "resource:///modules/sessionstore/TabState.jsm");
ChromeUtils.defineModuleGetter(this, "TabStateCache",
  "resource:///modules/sessionstore/TabStateCache.jsm");

this.DocShellCapabilities = {
  init() {
    //
  },

  update(browser, data) {
    // Update the persistent tab state cache
    TabStateCache.update(browser.permanentKey, {disallow: data.disallow || null});
    if (data.reload)
      browser.reload();
  },

  collect(tab) {
    let window = tab.ownerGlobal;
    if (window && window.__SSi) {
      let tabState = TabState.collect(tab);
      return tabState.disallow || "";
    }

    return "";
  },

  restore(tab, disallow, reload) {
    let browser = tab.linkedBrowser;
    if (tab.getAttribute("pending") == "true") {
      this.update(browser, {disallow, reload: false});
      return;
    }

    browser.messageManager.sendAsyncMessage("Tabmix:restorePermissions",
      {disallow: disallow.join(","), reload: reload || false});
  },

  /*** for tab context menu ***/

  onGet(nodes, tab) {
    let disallow = this.collect(tab);
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("checked", !disallow.includes(nodes[i].value));
    }
  },

  onSet(tab, node) {
    let nodes = node.parentNode.childNodes;
    let disallow = [];
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute("checked") != "true")
        disallow.push(nodes[i].value);
    }
    this.restore(tab, disallow, true);
  }
};
