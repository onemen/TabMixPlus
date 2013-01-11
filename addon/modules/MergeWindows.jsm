
var EXPORTED_SYMBOLS = ["MergeWindows"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://tabmixplus/Services.jsm");

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
let MergeWindows = {
  get prefs() {
    delete this.prefs;
    return this.prefs = Services.prefs.getBranch("extensions.tabmix.");
  },

  // merge several windows to one window, or only selected tabs to previous focussed window,
  // or only current window with previous window
  mergeWindows: function _mergeWindows(aWindow) {
    var tabbrowser = aWindow.gBrowser;
    var mergeAllWindows = this.prefs.getBoolPref("mergeAllWindows");

    let options = {skipPopup: !this.prefs.getBoolPref("mergePopups")};
    if (TabmixSvc.version(200))
      options.private = this.isWindowPrivate(aWindow);

    // check if one or more tabs are selected to be merged
    var selectedTabs = tabbrowser.tabContainer.getElementsByAttribute("mergeselected", true);
    options.tabsSelected = selectedTabs.length > 0;
    options.multiple = mergeAllWindows && !options.tabsSelected;

    if (options.multiple)
      this.mergeMultipleWindows(aWindow, options);
    else {
      let tabsToMove = Array.slice(options.tabsSelected ? selectedTabs : tabbrowser.tabs);
      this.mergeTwoWindows(aWindow, tabsToMove, options);
    }
  },

  // merge current window into previously focussed window, unless it was popup
  // in that case merge previously focussed window into current window
  mergeTwoWindows: function TMP_mergeTwoWindows(aWindow, aTabs, aOptions) {
    let tabbrowser = aWindow.gBrowser;
    let targetWindow = this.getWindowsList(aWindow, aOptions);
    if (!targetWindow)
      this.notify(aWindow, aOptions.privateNotMatch);
    // user set preference to merge popups
    else if (this.isPopupWindow(targetWindow)) {
      if (this.isPopupWindow(aWindow)) {
        tabbrowser.selectedTab.setAttribute("_TMP_selectAfterMerege", true);
        this.mergePopUpsToNewWindow([aWindow, targetWindow], aOptions.private);
        return;
      }
      if (aOptions.tabsSelected) {
        // merge tabs from the popup window into the current window
        // remove or move to new window tabs that wasn't selected
        let leftOverTabs = [];
        for (let i = 0; i < tabbrowser.tabs.length; i++) {
          let tab = tabbrowser.tabs[i];
          if (tab.hasAttribute("mergeselected")) {
            tab.removeAttribute("mergeselected");
            tab.label = tab.label.substr(4);
            tabbrowser._tabAttrModified(tab);
          }
          else
            leftOverTabs.push(tab);
        }
        if (leftOverTabs.length && this.warnBeforeClosingWindow(aWindow)) {
          for (let i = 0; i < leftOverTabs.length; i++)
            tabbrowser.removeTab(leftOverTabs[i]);
        }
      }
      this.swapTabs(aWindow, targetWindow.gBrowser.tabs);
    }
    else {
      // after merge select currently selected tab or first merged tab
      let tab = aTabs.indexOf(tabbrowser.selectedTab) > -1 ? tabbrowser.selectedTab : aTabs[0];
      tab.setAttribute("_TMP_selectAfterMerege", true);
      let canClose = tabbrowser.tabs.length > aTabs.length &&
                     this.warnBeforeClosingWindow(aWindow);
      this.swapTabs(targetWindow, aTabs);
      // _endRemoveTab set _windowIsClosing if the last tab moved to a diffrenent window
      if (!tabbrowser._windowIsClosing && canClose)
        aWindow.close();
      targetWindow.focus();
    }
  },

  // merge all suitable windows into the current window unless it is popup
  mergeMultipleWindows: function TMP_mergeMultipleWindows(aWindow, aOptions) {
    let {windows: windows, normalWindowsCount: normalWindowsCount} = this.getWindowsList(aWindow, aOptions);
    if (!windows.length)
      this.notify(aWindow, aOptions.privateNotMatch);
    else if (this.isPopupWindow(aWindow)) {
      aWindow.gBrowser.selectedTab.setAttribute("_TMP_selectAfterMerege", true);
      // all windows are popups
      if (!normalWindowsCount) {
        windows.unshift(aWindow);
        this.mergePopUpsToNewWindow(windows, aOptions.private);
        return;
      }
      // we have at least one non-popup windows, so we can merge all windows
      // into the first window in the list.
      // when we don't merge popups, allow to merge the current popup window
      // if there is only one non-popup window.
      if (!aOptions.skipPopup || normalWindowsCount == 1)
        windows.splice(normalWindowsCount, 0, aWindow);
      let targetWindow = windows.shift();
      this.concatTabsAndMerge(targetWindow, windows);
      targetWindow.focus();
    }
    else
      this.concatTabsAndMerge(aWindow, windows);
  },

  mergePopUpsToNewWindow: function(aWindows, aPrivate) {
    var features = "chrome,all,dialog=no";
    if (TabmixSvc.version(200))
        features += aPrivate ? ",private" : ",non-private";
    var newWindow = aWindows[0].openDialog(aWindows[0].getBrowserURL(), "_blank", features, null);
    let mergePopUps = function _mergePopUps(aEvent) {
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

  // move tabs to a window
  swapTabs: function TMP_swapTabs(aWindow, tabs) {
    var tabbrowser = aWindow.gBrowser;

    // tabs from popup windows open after opener or at the end
    // other tabs open according to our openTabNext preference
    // and move to place by tabbrowser.addTab
    var placePopupNextToOpener = this.prefs.getBoolPref("placePopupNextToOpener");
    function moveTabsFromPopups(newTab, aTab) {
      let index = tabbrowser.tabs.length - 1;
      if (placePopupNextToOpener) {
        // since we merge popup after all other tabs was merged,
        // we only look for opener in the target window
        let popupWindow = aTab.ownerDocument.defaultView;
        let openerWindow = popupWindow.gBrowser.contentWindow.opener;
        let openerTab = openerWindow &&
            tabbrowser._getTabForContentWindow(openerWindow.top);
        if (openerTab)
          index = openerTab._tPos + 1;
      }
      let lastRelatedTab = tabbrowser._lastRelatedTab;
      tabbrowser.moveTabTo(newTab, index);
      tabbrowser._lastRelatedTab = lastRelatedTab;
    }

    var tabToSelect = null;
    for (let i = 0; i < tabs.length; i++) {
      let tab = tabs[i];
      let isPopup = !tab.ownerDocument.defaultView.toolbar.visible;
      let newTab = tabbrowser.addTab("about:blank", {dontMove: isPopup});
      let newBrowser = newTab.linkedBrowser;
      newBrowser.stop();
      newBrowser.docShell;
      if (tab.hasAttribute("_TMP_selectAfterMerege")) {
        tab.removeAttribute("_TMP_selectAfterMerege");
        tabToSelect = newTab;
      }
      if (isPopup)
        moveTabsFromPopups(newTab, tab);
      // we don't keep tab attributs: visited, flst_id
      // see in Tabmix.copyTabData list of attributs we copy to the new tab
      tabbrowser.swapBrowsersAndCloseOther(newTab, tab);
    }

    // select new tab after all other tabs swap to the target window
    if (tabToSelect)
      tabbrowser.selectedTab = tabToSelect;
  },

  isPopupWindow: function(aWindow) {
    return !aWindow.toolbar.visible;
  },

  // we use it only for Fireofx 20+, before that always return false
  isWindowPrivate: function() {
    delete this.isWindowPrivate
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
    let more = function() !isWINNT || aOptions.multiple || windows.length == 0;
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

    if (aOptions.multiple) {
      let normalWindowsCount = windows.length;
      return {windows: windows.concat(popUps), normalWindowsCount: normalWindowsCount};
    }

    return windows[0] || popUps[0] || null;
  },

  notify: function TMP_mergeNotify(aWindow, privateNotMatch) {
    let errorMessage = TabmixSvc.getString('tmp.merge.error');
    ///XXX update babelzilla
    if (privateNotMatch)
      errorMessage += ", " + "You can not merge private window with non-private window.";
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
    var canClose = Services.prompt.confirmCheck(aWindow,
                   TabmixSvc.getString('tmp.merge.warning.title'),
                   TabmixSvc.getString('tmp.merge.warning.message'),
                   TabmixSvc.getString('tmp.merge.warning.checkboxLabel'),
                   promptAgain);

    if (canClose && !promptAgain.value)
      this.prefs.setBoolPref("warnOnClose", false);

    return canClose;
  }
}
