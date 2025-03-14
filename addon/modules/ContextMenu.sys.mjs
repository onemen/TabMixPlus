/** @type {ContextMenuModule.Lazy} */ // @ts-ignore
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  //
  TabmixUtils: "chrome://tabmix-resource/content/Utils.sys.mjs"
});

/** @type {TabmixContextMenu} */
export const ContextMenu = {
  getSelectedLinks(content) {
    let doc = content.document;
    const NodeFilter = doc.defaultView.NodeFilter;
    // get focused window selection
    let selectionObject = lazy.TabmixUtils.focusedWindow(content).getSelection();
    if (selectionObject?.isCollapsed) {
      // nothing selected
      return new Map();
    }

    let filter = {
      /** @param { Node } n */
      acceptNode(n) {
        if (n.nodeName == 'A' || n.nodeName == 'li') {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    };

    // do urlSecurityCheck for each link in the treeWalker....
    let secMan = Services.scriptSecurityManager;
    /** @param {string} url */
    let securityCheck = function(url) {
      if (!url)
        return false;

      if (!doc) // just in case....
        return true;

      try {
        secMan.checkLoadURIStrWithPrincipal(
          doc.nodePrincipal, url, secMan.STANDARD);
      } catch {
        return false;
      }
      return true;
    };

    let urls = new Map();
    let range = selectionObject?.getRangeAt(0).cloneContents();
    if (!range) {
      return urls;
    }
    /** @typedef {HTMLLinkElement & {firstChild: LinkNode}} LinkNode  */
    /** @type {Omit<TreeWalker, "nextNode"> & {nextNode(): LinkNode}} */ // @ts-ignore
    let treeWalker = doc.createTreeWalker(range, NodeFilter.SHOW_ELEMENT, filter);
    let nextEpisode = treeWalker.nextNode();
    while (nextEpisode !== null) {
      let target = nextEpisode;
      if (nextEpisode.nodeName == "li") {
        let node = nextEpisode.firstChild;
        target = node.nodeName == "p" ? node.firstChild : node;
      }
      let url = target.href;
      if (securityCheck(url)) {
        if (!urls.has(url)) {
          urls.set(url, target.getAttribute("data-usercontextid"));
        }
      }
      nextEpisode = treeWalker.nextNode();
    }
    return urls;
  }
};
