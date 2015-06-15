"use strict";

var EXPORTED_SYMBOLS = ["TabmixUtils"];

const {interfaces: Ci, utils: Cu} = Components;

// Messages that will be received via the Frame Message Manager.
const FMM_MESSAGES = [
  "Tabmix:SetSyncHandler",
  "Tabmix:restorePermissionsComplete",
  "Tabmix:updateScrollPosition",
  "Tabmix:reloadTab",
  "Tabmix:getOpener",
];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "DocShellCapabilities",
  "resource://tabmixplus/DocShellCapabilities.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "AutoReload",
  "resource://tabmixplus/AutoReload.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "MergeWindows",
  "resource://tabmixplus/MergeWindows.jsm");

this.TabmixUtils = {
  initMessageManager: function(window) {
    let mm = window.getGroupMessageManager("browsers");
    FMM_MESSAGES.forEach(function(msg) mm.addMessageListener(msg, this), this);

    // Load the frame script after registering listeners.
    mm.loadFrameScript("chrome://tabmixplus/content/content.js", true);
  },

  deinit: function(window) {
    let mm = window.getGroupMessageManager("browsers");
    FMM_MESSAGES.forEach(function(msg) mm.removeMessageListener(msg, this), this);
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
      case "Tabmix:reloadTab":
        AutoReload.reloadRemoteTab(browser, message.data);
        break;
      case "Tabmix:getOpener":
        win = browser.ownerDocument.defaultView;
        tab = win.gBrowser.getTabForBrowser(browser);
        MergeWindows.moveTabsFromPopups(null, tab, message.objects.opener);
        break;
    }
  },

  // change current history title
  updateHistoryTitle: function(history, title) {
    var shEntry = history.getEntryAtIndex(history.index, false).QueryInterface(Ci.nsISHEntry);
    shEntry.setTitle(title);
  }
};
