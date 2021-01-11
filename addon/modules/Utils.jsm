"use strict";

this.EXPORTED_SYMBOLS = ["TabmixUtils"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

// Messages that will be received via the Frame Message Manager.
const FMM_MESSAGES = [
  "Tabmix:restorePermissionsComplete",
  "Tabmix:updateScrollPosition",
  "Tabmix:reloadTab",
  "Tabmix:getOpener",
  "Tabmix:contentDrop",
  "Tabmix:contextmenu",
];

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/TabmixSvc.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "DocShellCapabilities",
  "resource://tabmixplus/DocShellCapabilities.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "AutoReload",
  "resource://tabmixplus/AutoReload.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "MergeWindows",
  "resource://tabmixplus/MergeWindows.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "TabmixAboutNewTab",
  "resource://tabmixplus/AboutNewTab.jsm");

this.TabmixUtils = {
  initMessageManager(window) {
    let mm = window.getGroupMessageManager("browsers");
    FMM_MESSAGES.forEach(msg => mm.addMessageListener(msg, this));

    // Load the frame script after registering listeners.
    mm.loadFrameScript("chrome://tabmixplus/content/scripts/content.js", true);

    // call TabmixAboutNewTab.updateBrowser for gBrowser._preloadedBrowser,
    // if it already exist before we loaded our frame script
    if (TabmixSvc.version(420)) {
      let gBrowser = window.gBrowser;
      if (TabmixSvc.prefBranch.getBoolPref("titlefrombookmark") &&
          window.BROWSER_NEW_TAB_URL == TabmixSvc.aboutNewtab &&
          gBrowser._preloadedBrowser && gBrowser._isPreloadingEnabled() &&
          !PrivateBrowsingUtils.isWindowPrivate(window)) {
        TabmixAboutNewTab.updateBrowser(gBrowser._preloadedBrowser);
      }
    }
  },

  deinit(window) {
    let mm = window.getGroupMessageManager("browsers");
    FMM_MESSAGES.forEach(msg => mm.removeMessageListener(msg, this));
  },

  receiveMessage(message) {
    let browser = message.target;
    let win, tab;
    switch (message.name) {
      case "Tabmix:restorePermissionsComplete":
        DocShellCapabilities.update(browser, message.data);
        break;
      case "Tabmix:updateScrollPosition":
        win = browser.ownerGlobal;
        tab = win.gBrowser.getTabForBrowser(browser);
        win.TabmixSessionManager.updateScrollPosition(tab, message.data.scroll);
        break;
      case "Tabmix:reloadTab": {
        let postData = message.data.postData;
        if (postData)
          message.data.postData = this.makeInputStream(postData);
        AutoReload.reloadRemoteTab(browser, message.data);
        break;
      }
      case "Tabmix:getOpener":
        win = browser.ownerGlobal;
        tab = win.gBrowser.getTabForBrowser(browser);
        MergeWindows.moveTabsFromPopups(null, tab, message.objects.opener);
        break;
      case "Tabmix:contentDrop": {
        const {json, links, name} = message.data;
        const url = links[0].url;
        win = browser.ownerGlobal;
        const where = !TabmixSvc.isGlitterInstalled &&
          win.Tabmix.tablib.whereToOpenDrop(json, url);
        if (where == "tab") {
          if (TabmixSvc.version(520)) {
            links[0].tabmixContentDrop = "tab";
            // see browser.xml dropLinks method
            browser.droppedLinkHandler(null, links);
          } else {
            // handleDroppedLink call preventDefault
            json.preventDefault = function() {};
            json.tabmixContentDrop = "tab";
            browser.droppedLinkHandler(json, url, name);
          }
          // prevent default
          return true;
        }
        return false;
      }
      case "Tabmix:contextmenu": {
        win = browser.ownerGlobal;
        let links = message.data.links;
        win.Tabmix.contextMenuLinks = links && links.split("\n") || [];
        break;
      }
    }
    return null;
  },

  focusedWindow(content) {
    let fm = Cc["@mozilla.org/focus-manager;1"].getService(Ci.nsIFocusManager);

    let focusedWindow = {};
    fm.getFocusedElementForWindow(content, true, focusedWindow);
    return focusedWindow.value;
  },

  makeInputStream(aString) {
    let stream = Cc["@mozilla.org/io/string-input-stream;1"]
        .createInstance(Ci.nsISupportsCString);
    stream.data = aString;
    return stream;
  },

  // change current history title
  updateHistoryTitle(history, title) {
    var shEntry = history.getEntryAtIndex(history.index, false).QueryInterface(Ci.nsISHEntry);
    shEntry.setTitle(title);
  }
};
