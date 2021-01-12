/* globals dialog, Ci */
"use strict";

const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

if (typeof Ci == "undefined") {
  this.Ci = Components.interfaces;
}

var TabmixRemoveBlankTab = {
  initialize() {
    switch (window.document.documentElement.id) {
      case "unknownContentType":
        // chrome\toolkit\content\mozapps\downloads\unknownContentType.xul
        this.unknownContentType();
        break;
      case "handling":
        // chrome\toolkit\content\mozapps\handling\dialog.xul
        this.handlingDialog();
        break;
    }
  },

  unknownContentType() {
    let {win, b} = this.getWindowAndBrowser(dialog.mContext);
    if (win && b) {
      let tab = win.gBrowser.getTabForBrowser(b);
      // wait 250 ms after this window closed before removing mContext tab
      // nsHelperAppDlg.js promptForSaveToFileAsync look for dialog.mContext
      // before it opens nsIFilePicker.
      // see comment in our DownloadLastDir.jsm
      if (tab && tab._tabmix_downloadingTimeout) {
        win.clearTimeout(tab._tabmix_downloadingTimeout);
        tab._tabmix_downloadingTimeout = null;
        this.removeTab(win, tab);
      }
    }
  },

  handlingDialog() {
    /*
    * from chrome\toolkit\content\mozapps\handling\dialog.js
    * window.arguments[8]:
    *   This is the nsIURI that we are being brought up for in the first place.
    * window.arguments[9]:
    *   The nsIInterfaceRequestor of the parent window; may be null
    */
    let {win, b} = this.getWindowAndBrowser(window.arguments[9]);
    let blank = "about:blank";
    if (b && b.currentURI.spec == blank) {
      let uri = window.arguments[8].QueryInterface(Ci.nsIURI);
      if (b.userTypedValue == uri.spec) {
        let tab = win.gBrowser.getTabForBrowser(b);
        if (tab.selected)
          win.gBrowser.previousTab(tab);
        win.gBrowser.hideTab(tab);
        this.removeTab(win, tab);
      }
    }
  },

  getWindowAndBrowser(aContext) {
    let result = {win: null, b: null};
    if (aContext) {
      let nav, doc;
      try {
        nav = aContext.QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIWebNavigation);
        doc = nav.document;
      } catch (ex) {
        return result;
      }
      result.win = nav.QueryInterface(Ci.nsIDocShellTreeItem)
          .rootTreeItem
          .QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindow)
          .wrappedJSObject;
      let tabBrowser = result.win.gBrowser;
      result.b = tabBrowser.getBrowserForDocument(doc);
      if (!result.b) {
        // try to find tab with _tabmix_downloadingTimeout
        let tabs = Array.prototype.filter.call(tabBrowser.tabs, t => t._tabmix_downloadingTimeout);
        if (tabs.length) {
          result.b = tabs[0].linkedBrowser;
        }
      }
    }
    return result;
  },

  removeTab(win, tab) {
    window.addEventListener("unload", function _unload(aEvent) {
      aEvent.currentTarget.removeEventListener("unload", _unload);
      if (win && !win.closed) {
        win.setTimeout(() => {
          let tabBrowser = win && win.gBrowser;
          if (!tabBrowser || !tab || !tab.parentNode) {
            return;
          }
          // don't remove the tab if it going to close the window
          let closeWindow = tabBrowser.tabs.length - tabBrowser._removingTabs.length == 1 &&
              Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab");
          if (closeWindow) {
            return;
          }
          tabBrowser.removeTab(tab, {animate: false});
        }, 250);
      }
    });
  }
};

TabmixRemoveBlankTab.initialize();
