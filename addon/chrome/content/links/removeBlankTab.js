"use strict";

let TabmixRemoveBlankTab = {
  initialize: function() {
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

  unknownContentType: function() {
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

  handlingDialog: function() {
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

  getWindowAndBrowser: function(aContext) {
    let result = {win: null, b: null};
    if (aContext) {
      let nav = aContext.QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIWebNavigation);
      let doc;
      try {
        doc = nav.document;
      } catch(ex) {
        return result;
      }
      result.win = nav.QueryInterface(Ci.nsIDocShellTreeItem)
                    .rootTreeItem
                    .QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIDOMWindow)
                    .wrappedJSObject;
      result.b = result.win.gBrowser.getBrowserForDocument(doc);
    }
    return result;
  },

  removeTab: function(win, tab) {
    window.addEventListener("unload", function _unload(aEvent) {
      aEvent.currentTarget.removeEventListener("unload", _unload, false);
      if (win && !win.closed) {
        win.setTimeout(function() {
          if (win && win.gBrowser && tab && tab.parentNode)
            win.gBrowser.removeTab(tab, {animate: false});
        }, 250);
      }
    }, false);
  }
};

TabmixRemoveBlankTab.initialize();
