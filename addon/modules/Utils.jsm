"use strict";

this.EXPORTED_SYMBOLS = ["TabmixUtils"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

// Messages that will be received via the Frame Message Manager.
const FMM_MESSAGES = [
  "Tabmix:SetSyncHandler",
  "Tabmix:restorePermissionsComplete",
  "Tabmix:updateScrollPosition",
  "Tabmix:reloadTab",
  "Tabmix:getOpener",
  "Tabmix:contentDrop",
];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "DocShellCapabilities",
  "resource://tabmixplus/DocShellCapabilities.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "AutoReload",
  "resource://tabmixplus/AutoReload.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "MergeWindows",
  "resource://tabmixplus/MergeWindows.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "TabmixAboutNewTab",
  "resource://tabmixplus/AboutNewTab.jsm");

this.TabmixUtils = {
  initMessageManager: function(window) {
    let mm = window.getGroupMessageManager("browsers");
    FMM_MESSAGES.forEach(msg => mm.addMessageListener(msg, this));

    // Load the frame script after registering listeners.
    mm.loadFrameScript("chrome://tabmixplus/content/content.js", true);

    // call TabmixAboutNewTab.updateBrowser for gBrowser._preloadedBrowser,
    // if it already exist before we loaded our frame script
    if (TabmixSvc.version(420)) {
      let {gBrowser, BROWSER_NEW_TAB_URL} = window;
      if (TabmixSvc.prefBranch.getBoolPref("titlefrombookmark") &&
          BROWSER_NEW_TAB_URL == TabmixSvc.aboutNewtab &&
          gBrowser._preloadedBrowser && gBrowser._isPreloadingEnabled() &&
          !PrivateBrowsingUtils.isWindowPrivate(window)) {
        TabmixAboutNewTab.updateBrowser(gBrowser._preloadedBrowser);
      }
    }
  },

  deinit: function(window) {
    let mm = window.getGroupMessageManager("browsers");
    FMM_MESSAGES.forEach(msg => mm.removeMessageListener(msg, this));
  },

  receiveMessage: function(message) {
    let browser = message.target;
    let win, tab;
    switch (message.name) {
      case "Tabmix:SetSyncHandler":
        TabmixSvc.syncHandlers.set(browser.permanentKey, message.objects.syncHandler);
        break;
      case "Tabmix:restorePermissionsComplete":
        DocShellCapabilities.update(browser, message.data);
        break;
      case "Tabmix:updateScrollPosition":
        win = browser.ownerDocument.defaultView;
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
        win = browser.ownerDocument.defaultView;
        tab = win.gBrowser.getTabForBrowser(browser);
        MergeWindows.moveTabsFromPopups(null, tab, message.objects.opener);
        break;
      case "Tabmix:contentDrop": {
        let {json, uri, name} = message.data;
        win = browser.ownerDocument.defaultView;
        let where = win.tablib.whereToOpenDrop(json, uri);
        if (where == "tab") {
          // handleDroppedLink call preventDefault
          json.preventDefault = function() {};
          json.tabmixContentDrop = "tab";
          browser.droppedLinkHandler(json, uri, name);
          // prevent default
          return true;
        }
        return false;
      }
    }
    return null;
  },

  makeInputStream: function(aString) {
    let stream = Cc["@mozilla.org/io/string-input-stream;1"].
    createInstance(Ci.nsISupportsCString);
    stream.data = aString;
    return stream;
  },

  // change current history title
  updateHistoryTitle: function(history, title) {
    var shEntry = history.getEntryAtIndex(history.index, false).QueryInterface(Ci.nsISHEntry);
    shEntry.setTitle(title);
  }
};
