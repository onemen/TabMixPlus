"use strict";

this.EXPORTED_SYMBOLS = ["ContextMenu"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");

this.ContextMenu = {
  getSelectedLinks: function(content, check) {
    // get focused window selection
    let fm = Cc["@mozilla.org/focus-manager;1"].getService(Ci.nsIFocusManager);
    let focusedWindow = {};
    fm.getFocusedElementForWindow(content, true, focusedWindow);
    let selectionObject = focusedWindow.value.getSelection();
    if (selectionObject.isCollapsed) // nothing selected
      return [];

    let filter = {
      acceptNode: function(n) {
        if(n.nodeName == 'A' || n.nodeName == 'li') {
          return Ci.nsIDOMNodeFilter.FILTER_ACCEPT;
        }
        else {
          return Ci.nsIDOMNodeFilter.FILTER_SKIP;
        }
      }
    };

    // do urlSecurityCheck for each link in the treeWalker....
    let doc = content.document;
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
                          Ci.nsIDOMNodeFilter.SHOW_ELEMENT, filter, true);
    let nextEpisode = treeWalker.nextNode();
    let urls = [];
    while (nextEpisode !== null) {
      let url;
      if (nextEpisode.nodeName == "li") {
        let node = nextEpisode.firstChild;
        url = node.nodeName == "p" ? node.firstChild.href : node.href;
      }
      else
        url = nextEpisode.href;
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
