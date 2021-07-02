"use strict";

this.EXPORTED_SYMBOLS = ["TabmixUtils"];

const {classes: Cc, interfaces: Ci} = Components;

// Messages that will be received via the Frame Message Manager.
const FMM_MESSAGES = [
  "Tabmix:restorePermissionsComplete",
  "Tabmix:updateScrollPosition",
  "Tabmix:reloadTab",
  "Tabmix:getOpener",
  "Tabmix:contentDrop",
  "Tabmix:contextmenu",
];

const {XPCOMUtils} = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  AutoReload: "chrome://tabmix-resource/content/AutoReload.jsm",
  DocShellCapabilities: "chrome://tabmix-resource/content/DocShellCapabilities.jsm",
  MergeWindows: "chrome://tabmix-resource/content/MergeWindows.jsm",
  NewTabPagePreloading: "resource:///modules/NewTabPagePreloading.jsm",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
  TabmixAboutNewTab: "chrome://tabmix-resource/content/AboutNewTab.jsm",
  TabmixSvc: "chrome://tabmix-resource/content/TabmixSvc.jsm",
});

this.TabmixUtils = {
  initMessageManager(window) {
    let mm = window.getGroupMessageManager("browsers");
    FMM_MESSAGES.forEach(msg => mm.addMessageListener(msg, this));

    // Load the frame script after registering listeners.
    mm.loadFrameScript("chrome://tabmixplus/content/scripts/content.js", true);

    // call TabmixAboutNewTab.updateBrowser for gBrowser.preloadedBrowser,
    // if it already exist before we loaded our frame script
    let gBrowser = window.gBrowser;
    if (TabmixSvc.prefBranch.getBoolPref("titlefrombookmark") &&
          window.BROWSER_NEW_TAB_URL == TabmixSvc.aboutNewtab &&
          gBrowser.preloadedBrowser && NewTabPagePreloading.enabled &&
          !PrivateBrowsingUtils.isWindowPrivate(window)) {
      TabmixAboutNewTab.updateBrowser(gBrowser.preloadedBrowser);
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
        const {json, links} = message.data;
        const url = links[0].url;
        win = browser.ownerGlobal;
        const where = !TabmixSvc.isGlitterInstalled &&
          win.Tabmix.tablib.whereToOpenDrop(json, url);
        if (where == "tab") {
          links[0].tabmixContentDrop = "tab";
          // see browser.xml dropLinks method
          browser.droppedLinkHandler(null, links);
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
