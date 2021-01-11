"use strict";

this.EXPORTED_SYMBOLS = ["ContextMenu"];

const {utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/Services.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "TabmixUtils",
  "resource://tabmixplus/Utils.jsm");

this.ContextMenu = {
  getSelectedLinks(content, check) {
    let doc = content.document;
    const NodeFilter = doc.defaultView.NodeFilter;
    // get focused window selection
    let selectionObject = TabmixUtils.focusedWindow(content).getSelection();
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
    let urls = [];
    while (nextEpisode !== null) {
      let url;
      if (nextEpisode.nodeName == "li") {
        let node = nextEpisode.firstChild;
        url = node.nodeName == "p" ? node.firstChild.href : node.href;
      } else {
        url = nextEpisode.href;
      }
      if (securityCheck(url)) {
        if (check)
          return [true];
        if (urls.indexOf(url) == -1)
          urls.push(url);
      }
      nextEpisode = treeWalker.nextNode();
    }
    return urls;
  }
};
