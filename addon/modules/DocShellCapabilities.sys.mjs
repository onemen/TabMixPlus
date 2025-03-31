/** @type {DocShellCapabilitiesModule.Lazy} */ // @ts-ignore
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  TabState: "resource:///modules/sessionstore/TabState.sys.mjs",
  TabStateCache: "resource:///modules/sessionstore/TabStateCache.sys.mjs",
});

/** @type {DocShellCapabilitiesModule.DocShellCapabilities} */
export const DocShellCapabilities = {
  init() {
    //
  },

  update(browser, data) {
    // Update the persistent tab state cache
    lazy.TabStateCache.update(browser.permanentKey, {disallow: data.disallow || null});
    if (data.reload) {
      browser.reload();
    }
  },

  collect(tab) {
    let window = tab.ownerGlobal;
    if (window && window.__SSi) {
      let tabState = lazy.TabState.collect(tab);
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

    browser.messageManager.sendAsyncMessage("Tabmix:restorePermissions", {
      disallow,
      reload: reload || false,
    });
  },

  /** for tab context menu ** */

  onGet(nodes, tab) {
    let disallow = this.collect(tab);
    for (const element of nodes) {
      element.setAttribute("checked", !disallow.includes(element.value));
    }
  },

  onSet(tab, node) {
    const parentNodes = node.parentNode?.childNodes ?? [];
    const disallow = Array.from(parentNodes)
      .filter(element => element?.getAttribute("checked") !== "true")
      .map(element => element?.value);
    this.restore(tab, disallow.join(","), true);
  },
};
