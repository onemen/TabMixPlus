"use strict";

const EXPORTED_SYMBOLS = ["ContextMenu"];

const Services = globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

const lazy = {};
ChromeUtils.defineModuleGetter(lazy, "TabmixUtils",
  "chrome://tabmix-resource/content/Utils.jsm");

const ContextMenu = {
  getSelectedLinks(content, check) {
    let doc = content.document;
    const NodeFilter = doc.defaultView.NodeFilter;
    // get focused window selection
    let selectionObject = lazy.TabmixUtils.focusedWindow(content).getSelection();
    if (selectionObject.isCollapsed) // nothing selected
      return [];

    let filter = {
      acceptNode(n) {
        if (n.nodeName == 'A' || n.nodeName == 'li') {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    };

    // do urlSecurityCheck for each link in the treeWalker....
    let secMan = Services.scriptSecurityManager;
    let securityCheck = function(url) {
      if (!url)
        return false;

      if (!doc) // just in case....
        return true;

      try {
        secMan.checkLoadURIStrWithPrincipal(
          doc.nodePrincipal, url, secMan.STANDARD);
      } catch (e) {
        return false;
      }
      return true;
    };

    let range = selectionObject.getRangeAt(0).cloneContents();
    let treeWalker = doc.createTreeWalker(range,
      NodeFilter.SHOW_ELEMENT, filter, true);
    let nextEpisode = treeWalker.nextNode();
    let urls = new Map();
    while (nextEpisode !== null) {
      let target = nextEpisode;
      if (nextEpisode.nodeName == "li") {
        let node = nextEpisode.firstChild;
        target = node.nodeName == "p" ? node.firstChild : node;
      }
      let url = target.href;
      if (securityCheck(url)) {
        if (check)
          return [true];

        if (!urls.has(url)) {
          urls.set(url, target.getAttribute("data-usercontextid"));
        }
      }
      nextEpisode = treeWalker.nextNode();
    }
    return urls;
  }
};
