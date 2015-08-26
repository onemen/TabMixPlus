"use strict";

var EXPORTED_SYMBOLS = ["MergeWindows"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://tabmixplus/Services.jsm");

/*////////////////////////////////////////////////////////////////////
// The Original Code is the Merge Window function of "Duplicate Tab"//
// extension for Mozilla Firefox.                                   //
// version 0.5.1                                                    //
// The Initial Developer of the Original Code is Twanno.            //
// Modfied for TMP by CPU                                           //
//                                                                  //
// Convert to module and modfied by onemen                          //
//                                                                  //
*/////////////////////////////////////////////////////////////////////
this.MergeWindows = {
  get prefs() {
    delete this.prefs;
    return (this.prefs = Services.prefs.getBranch("extensions.tabmix."));
  },

  // merge several windows to one window, or only selected tabs to previous focussed window,
  // or only current window with previous window
  mergeWindows: function _mergeWindows(aWindow) {
    var tabbrowser = aWindow.gBrowser;
    var mergeAllWindows = this.prefs.getBoolPref("mergeAllWindows");

    // check if one or more tabs are selected to be merged
    var selectedTabs = tabbrowser.tabContainer.getElementsByAttribute("mergeselected", true);
    let options = {
      skipPopup: !this.prefs.getBoolPref("mergePopups"),
      private: TabmixSvc.version(200) ? this.isWindowPrivate(aWindow) : false,
      tabsSelected: selectedTabs.length > 0,
      multiple: mergeAllWindows && !selectedTabs.length
    };
    let {windows: windows, normalWindowsCount: normalWindowsCount} = this.getWindowsList(aWindow, options);
    if (!windows.length)
      this.notify(aWindow, options.privateNotMatch);
    else if (!normalWindowsCount && this.isPopupWindow(aWindow)) {
      windows.unshift(aWindow);
      this.mergePopUpsToNewWindow(windows, options.private);
    }
    else if (options.multiple) {
      options.normalWindowsCount = normalWindowsCount;
      this.mergeMultipleWindows(aWindow, windows, options);
    }
    else {
      let tabsToMove = Array.slice(options.tabsSelected ? selectedTabs : tabbrowser.tabs);
      this.mergeTwoWindows(windows[0], aWindow, tabsToMove, options);
    }
  },

  // merge current window into previously focussed window, unless it was popup
  // in that case merge previously focussed window into current window
  mergeTwoWindows: function TMP_mergeTwoWindows(aTargetWindow, aWindow, aTabs, aOptions) {
    let tabbrowser = aWindow.gBrowser;
    let canClose = aOptions.tabsSelected && tabbrowser.tabs.length > aTabs.length &&
                    this.warnBeforeClosingWindow(aWindow);
    if (this.isPopupWindow(aTargetWindow)) {
      if (aOptions.tabsSelected) {
        // merge tabs from the popup window into the current window
        // remove or move to new window tabs that wasn't selected
        for (let i = tabbrowser.tabs.length - 1; i >=0; i--) {
          let tab = tabbrowser.tabs[i];
          if (tab.hasAttribute("mergeselected")) {
            tab.removeAttribute("mergeselected");
            tab.label = tab.label.substr(4);
            tabbrowser._tabAttrModified(tab);
          }
          else if (canClose)
            tabbrowser.removeTab(tab);
        }
        canClose = false;
      }
      [aTargetWindow, aTabs] = [aWindow, aTargetWindow.gBrowser.tabs];
    }
    this.swapTabs(aTargetWindow, aTabs);
    // _endRemoveTab set _windowIsClosing if the last tab moved to a diffrenent window
    if (canClose && !tabbrowser._windowIsClosing)
      aWindow.close();
  },

  // merge all suitable windows into the current window unless it is popup
  mergeMultipleWindows: function TMP_mergeMultipleWindows(aTargetWindow, aWindows, aOptions) {
    if (this.isPopupWindow(aTargetWindow)) {
      // we have at least one non-popup windows, so we can merge all windows
      // into the first window in the list.
      // when we don't merge popups, allow to merge the current popup window
      // if there is only one non-popup window.
      if (!aOptions.skipPopup || aOptions.normalWindowsCount == 1)
        aWindows.splice(aOptions.normalWindowsCount, 0, aTargetWindow);
      aTargetWindow = aWindows.shift();
    }
    this.concatTabsAndMerge(aTargetWindow, aWindows);
  },

  mergePopUpsToNewWindow: function(aWindows, aPrivate) {
    var features = "chrome,all,dialog=no";
    if (TabmixSvc.version(200))
        features += aPrivate ? ",private" : ",non-private";
    var newWindow = aWindows[0].openDialog("chrome://browser/content/browser.xul",
        "_blank", features, null);
    let mergePopUps = function _mergePopUps() {
      newWindow.removeEventListener("SSWindowStateReady", _mergePopUps, false);
      this.concatTabsAndMerge(newWindow, aWindows);
    }.bind(this);
    newWindow.addEventListener("SSWindowStateReady", mergePopUps, false);
  },

  concatTabsAndMerge: function(aTargetWindow, aWindows) {
    let tabsToMove = [];
    for (let i = 0; i < aWindows.length; i++)
      tabsToMove = tabsToMove.concat(Array.slice(aWindows[i].gBrowser.tabs));
    this.swapTabs(aTargetWindow, tabsToMove);
  },

  // tabs from popup windows open after opener or at the end
  // other tabs open according to our openTabNext preference
  // and move to place by tabbrowser.addTab
  moveTabsFromPopups: function(newTab, aTab, openerWindow, tabbrowser) {
    if (!newTab) {
      newTab = aTab.__tabmixNewTab;
      delete aTab.__tabmixNewTab;
      tabbrowser = newTab.ownerDocument.defaultView.gBrowser;
    }
    let index = tabbrowser.tabs.length - 1;
    if (openerWindow) {
      // since we merge popup after all other tabs was merged,
      // we only look for opener in the target window
      let openerTab = openerWindow &&
          tabbrowser._getTabForContentWindow(openerWindow.top);
      if (openerTab)
        index = openerTab._tPos + 1;
    }
    let lastRelatedTab = tabbrowser._lastRelatedTab;
    tabbrowser.moveTabTo(newTab, index);
    tabbrowser._lastRelatedTab = lastRelatedTab;
    tabbrowser.swapBrowsersAndCloseOther(newTab, aTab);
  },

  // move tabs to a window
  swapTabs: function TMP_swapTabs(aWindow, tabs) {
    var currentWindow = TabmixSvc.topWin();
    var notFocused = currentWindow != aWindow;
    if (notFocused) {
      // after merge select currently selected tab or first merged tab
      let selectedTab = currentWindow.gBrowser.selectedTab;
      let tab = tabs.indexOf(selectedTab) > -1 ? selectedTab : tabs[0];
      tab.setAttribute("_TMP_selectAfterMerege", true);
    }

    var tabbrowser = aWindow.gBrowser;

    var placePopupNextToOpener = this.prefs.getBoolPref("placePopupNextToOpener");
    var tabToSelect = null;
    // make sure that the tabs will open in the same order
    let prefVal = this.prefs.getBoolPref("openTabNextInverse");
    this.prefs.setBoolPref("openTabNextInverse", true);
    for (let i = 0; i < tabs.length; i++) {
      let tab = tabs[i];
      let isPopup = !tab.ownerDocument.defaultView.toolbar.visible;
      let newTab = tabbrowser.addTab("about:blank", {dontMove: isPopup});
      let newBrowser = newTab.linkedBrowser;
      newBrowser.stop();
      newBrowser.docShell; // jshint ignore:line
      if (tab.hasAttribute("_TMP_selectAfterMerege")) {
        tab.removeAttribute("_TMP_selectAfterMerege");
        tabToSelect = newTab;
      }
      if (isPopup) {
        let openerWindow;
        if (placePopupNextToOpener) {
          let browser = tab.linkedBrowser;
          if (TabmixSvc.version(330) && browser.getAttribute("remote") == "true") {
            browser.messageManager.sendAsyncMessage("Tabmix:collectOpener");
            tab.__tabmixNewTab = newTab;
            return;
          }
          openerWindow = browser.contentWindow.opener;
        }
        this.moveTabsFromPopups(newTab, tab, openerWindow, tabbrowser);
      }
      else {
        // we don't keep tab attributs: visited, tabmix_selectedID
        // see in Tabmix.copyTabData list of attributs we copy to the new tab
        tabbrowser.swapBrowsersAndCloseOther(newTab, tab);
      }
    }
    this.prefs.setBoolPref("openTabNextInverse", prefVal);

    if (notFocused) {
      // select new tab after all other tabs swap to the target window
      if (tabToSelect)
        tabbrowser.selectedTab = tabToSelect;
      aWindow.focus();
    }
  },

  isPopupWindow: function(aWindow) {
    return !aWindow.toolbar.visible;
  },

  // we use it only for Fireofx 20+, before that always return false
  isWindowPrivate: function() {
    delete this.isWindowPrivate;
    if (TabmixSvc.version(200)) {
      Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
      this.isWindowPrivate = function(aWindow) PrivateBrowsingUtils.isWindowPrivate(aWindow);
      return this.isWindowPrivate(arguments[0]);
    }
    this.isWindowPrivate = function() false;
    return false;
  },

  /*
   * Get windows that match the most search in recent order (ZOrder).
   *
   * @param aWindow a window to skip.
   *
   * @param aOptions an object accepting the arguments for the search.
   *        Set the private property to true in order to restrict the
   *        search to private windows only, or to false in order to
   *        restrict the search to non-private windows only.  To search
   *        in both groups, don't specify the private property.
   *
   *        set skipPopup property to true when the preference is not
   *        to merge popus.
   *
   *        set multiple property to true to get all suitable windows
   *
   * @return
   *        multiple is true all non-popup windows then all popup windows
   *        multiple is false most recent non-popup windows or most recent
   *        popup windows
   */
  getWindowsList: function(aWindow, aOptions) {
    let checkPrivacy = typeof aOptions == "object" &&
                       "private" in aOptions;

    let privateNotMatch = 0;
    let isSuitableBrowserWindow = function (win) {
      let suitable = win != aWindow && !win.closed;
      if (!suitable || !checkPrivacy)
        return suitable;

      if (this.isWindowPrivate(win) == aOptions.private)
        return true;
      privateNotMatch++;
      return false;
    }.bind(this);

    let windows = [], popUps = [];
    let isWINNT = Services.appinfo.OS == "WINNT";
    let more = function() !isWINNT || aOptions.multiple || windows.length === 0;
    // getEnumerator return windows from oldest to newest, so we use unshift.
    // when OS is WINNT and option is not multiple the loop stops when we find the most
    // recent suitable window
    let fn = isWINNT ? "push" : "unshift";
    let windowList = !isWINNT ? Services.wm.getEnumerator("navigator:browser") :
        Services.wm.getZOrderDOMWindowEnumerator("navigator:browser", true);
    while (more() && windowList.hasMoreElements()) {
      let nextWin = windowList.getNext();
      if (isSuitableBrowserWindow(nextWin)) {
        if (this.isPopupWindow(nextWin))
          popUps[fn](nextWin);
        else
          windows[fn](nextWin);
      }
    }
    aOptions.privateNotMatch = privateNotMatch > 0;
    if (aOptions.skipPopup)
      popUps = [];

    let normalWindowsCount = windows.length;
    if (aOptions.multiple)
      return {windows: windows.concat(popUps), normalWindowsCount: normalWindowsCount};

    let traget = windows[0] || popUps[0] || null;
    return {windows: traget ? [traget] : [], normalWindowsCount: normalWindowsCount};
  },

  notify: function TMP_mergeNotify(aWindow, privateNotMatch) {
    let errorMessage = TabmixSvc.getString('tmp.merge.error');
    if (privateNotMatch)
      errorMessage += ", " + TabmixSvc.getString('tmp.merge.private');
    const errorimage = "chrome://tabmixplus/skin/tmpsmall.png";
    let notificationBox = aWindow.gBrowser.getNotificationBox();
    let name = "mergeWindows-notification";
    if (!notificationBox.getNotificationWithValue(name)) {
      const priority = notificationBox.PRIORITY_INFO_MEDIUM;
      let notificationBar = notificationBox.appendNotification(errorMessage,
                                name, errorimage, priority, null);
      aWindow.setTimeout(function(){
        notificationBox.removeNotification(notificationBar);
      }, 10000);
    }
  },

  warnBeforeClosingWindow: function(aWindow) {
    // prompt a warning before closing a window with left ovar tabs
    var canClose = this.prefs.getBoolPref("closeOnSelect");
    if (!canClose)
      return false;

    var shouldPrompt = this.prefs.getBoolPref("warnOnclose");
    if (!shouldPrompt)
      return true;

    var promptAgain = { value:true };
    canClose = Services.prompt.confirmCheck(aWindow,
                   TabmixSvc.getString('tmp.merge.warning.title'),
                   TabmixSvc.getString('tmp.merge.warning.message'),
                   TabmixSvc.getString('tmp.merge.warning.checkboxLabel'),
                   promptAgain);

    if (canClose && !promptAgain.value)
      this.prefs.setBoolPref("warnOnClose", false);

    return canClose;
  }
};
