/*
TODO: Need major rewrite to use swapBrowsersAndCloseOther and duplicateTab
*/
var EXPORTED_SYMBOLS = ["MergeWindows"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://tabmixplus/Services.jsm");

/*////////////////////////////////////////////////////////////////////
// The Original Code is the Merge Window function of "Duplicate Tab"//
// extension for Mozilla Firefox.//
// version 0.5.1//
// The Initial Developer of the Original Code is Twanno. //
// Modfied for TMP by CPU //
//
// Convert to module by onemen
//
*/////////////////////////////////////////////////////////////////////
let MergeWindows = {
  // merge several windows to one window, or only selected tabs to previous focussed window,
  // or only current window with previous window
  mergeWindows: function _mergeWindows() {
    var topWindow = TabmixSvc.topWin();
    var tabbrowser = topWindow.gBrowser;

    var mergePopups = TabmixSvc.prefs.getBoolPref("extensions.tabmix.mergePopups");
    var placePopupNextToOpener = TabmixSvc.prefs.getBoolPref("extensions.tabmix.placePopupNextToOpener");
    var mergeAllWindows = TabmixSvc.prefs.getBoolPref("extensions.tabmix.mergeAllWindows");
    var openTabNext = topWindow.Tabmix.getOpenTabNextPref();

    // other variables used in this function
    var currentIndex, tabs, browsers = new Array(), i, j;

    // get browser windows listed and add them to an array
    var windowsArrayList = this.listWindows();
    var windowsArray = windowsArrayList.windowsArray;
    var popupsArray = windowsArrayList.popupsArray;
    var currentWindowIsPopup = windowsArrayList.isCurrentWindowPopup;

    // force the merging of windows when the current window is a popup
    // and the popup would be merged with one other (non popup) window
    var forceMergeWindows = (currentWindowIsPopup && (windowsArray.length == 1 || !mergeAllWindows));

    // foreground window is not a popup other window(s) is/are popup(s)
    var mergeBackGround = (windowsArray.length == 0 && popupsArray.length > 0 && !currentWindowIsPopup && mergePopups);

    // alert if just one window is open; no need to merge one window
    if (!forceMergeWindows && ((!mergePopups && windowsArray.length < 1 && !currentWindowIsPopup)
        || windowsArray.length+popupsArray.length < 1)) {
      var errorMessage = TabmixSvc.getString('tmp.merge.error');
      const errorimage = "chrome://tabmixplus/skin/tmpsmall.png";
      var notificationBox = tabbrowser.getNotificationBox();
      if (!notificationBox.getNotificationWithValue("mergeWindows")) {
        const priority = notificationBox.PRIORITY_INFO_MEDIUM;
        notificationBox.appendNotification(errorMessage, "mergeWindows",
                                               errorimage, priority, null);
      }
      return;
    }

    // check if one or more tabs are selected to be merged
    var selectedTabs = tabbrowser.tabContainer.getElementsByAttribute('mergeselected','true');
    var tabsSelected = (selectedTabs.length > 0);

    // don't merge the current window if it is a popup and all windows are to be merged except popups
    var dontMergeCurrentWindow = (!forceMergeWindows && !mergePopups
                                   && currentWindowIsPopup && mergeAllWindows);

    // get currently focussed and previously focussed window
    // and get the window which has been out of focus longest
    var currentWindow = (dontMergeCurrentWindow)?windowsArray[windowsArray.length-1]:windowsArrayList.currentWindow;
    var previousWindow = (dontMergeCurrentWindow)?windowsArray[windowsArray.length-2]:windowsArray[windowsArray.length-1];
    var firstWindow = windowsArray[0];


    if (mergeBackGround) {
      // to correctly merge popup(s) when only the current window is not a popup
      currentWindow = popupsArray.pop();
      firstWindow = windowsArrayList.currentWindow;
      previousWindow = windowsArrayList.currentWindow;
      currentWindowIsPopup = true;
      windowsArray[0] = windowsArrayList.currentWindow;
    }

    var previousWindowTabBar = previousWindow.gBrowser.tabContainer;
    var firstWindowTabBar = firstWindow.gBrowser.tabContainer;

    var previousWindowTabIndex = (openTabNext)?previousWindowTabBar.selectedIndex:previousWindowTabBar.childNodes.length;
    var firstWindowTabIndex = (openTabNext)?firstWindowTabBar.selectedIndex:firstWindowTabBar.childNodes.length;

   // get currently focussed tab, so it can be selected again after merging
    if (tabsSelected && !tabbrowser.mCurrentTab.hasAttribute('mergeselected')) {
      i = 0, j = -1;
      while (i < tabbrowser.tabs.length) {
        if (tabbrowser.tabs[i].hasAttribute('mergeselected'))
          j++;
        if ((i >= tabbrowser.tabContainer.selectedIndex) && (j > -1)) {
          currentIndex = j;
          break;
        }
        i++;
      }
    }
    else
      currentIndex = (tabsSelected)?tabbrowser.tabContainer.selectedIndex:currentWindow.gBrowser.tabContainer.selectedIndex;

    // If more then one window is opened and not all windows must be merged to one:
    // Either because of selected tabs or the pref is set to do so
    // Merge only the (selected) tabs of the currently focussed window and the previously focussed window
    if (tabsSelected || !mergeAllWindows) {
      var openerPosition = -1;
      tabs = currentWindow.gBrowser.tabs;

      // if tabs have been selected, list them in an array
      if (tabsSelected && !mergeBackGround)
        browsers = listTabs(selectedTabs, topWindow);
      else if (tabsSelected && mergeBackGround) {
        var previousTabs = previousWindow.gBrowser.tabs;
        browsers = listTabs(tabs, currentWindow);
        for (i = 0; i < previousTabs.length; i++) {
          if (!previousTabs[i].hasAttribute('mergeselected'))
            previousTabs[i].setAttribute('mergeremove', 'true');
        }
      }

      // if no tabs have been selected, list all tabs of the window in an array
      else if (!tabsSelected) {
        browsers = listTabs(tabs, currentWindow);
      }

      // if the current window is a popup window place the popup next to its opener
      // when that opener is found in the previous window.
      if (currentWindowIsPopup && placePopupNextToOpener) {
        var openerPositionArray = getPopupOpenerPosition(currentWindow, [previousWindow], previousWindowTabIndex);
        openerPosition = openerPositionArray[0];
        if (openerPositionArray[1] == 'tabs') {
          currentIndex = (mergeBackGround)? currentIndex: openerPosition + currentIndex;
          // the popup opener was found in one of the tabs in the window that will remain.
          // place the tab(s) next to the opener
          setTabsInBrowser(previousWindow, browsers, openerPosition);
        }
      }

      // place all tabs in one window
      if (openerPosition == -1) {
        currentIndex = previousWindowTabIndex + currentIndex;
        setTabsInBrowser(previousWindow, browsers);
      }

     // prompt a warning if some tabs are selected and the window with remaining tabs is closed
      var promptpref = TabmixSvc.prefs.getBoolPref("extensions.tabmix.warnOnclose");
      var closepref = TabmixSvc.prefs.getBoolPref("extensions.tabmix.closeOnSelect");
      var askForPrompt = ((promptpref) && (tabsSelected) && (selectedTabs.length < tabs.length));
      var promptOK = false, promptAgain = { value:true };
      if (askForPrompt && closepref) {
        var promptTitle = TabmixSvc.getString('tmp.merge.warning.title');
        var promptMessage = TabmixSvc.getString('tmp.merge.warning.message');
        var promptCheckboxLabel = TabmixSvc.getString('tmp.merge.warning.checkboxLabel');
        promptOK = TabmixSvc.prompt.confirmCheck(topWindow, promptTitle, promptMessage, promptCheckboxLabel, promptAgain);
      }

      // select the tab which was selected in the top window
      previousWindowTabBar.selectedIndex = currentIndex;

      // close current window if all tabs are merged or if specified by user to do so with some tabs selected
      if ((promptOK || (!askForPrompt)) && closepref) {
        if (!promptAgain.value) {
          TabmixSvc.prefs.setBoolPref("extensions.tabmix.warnOnClose", false);
        }
        previousWindow.focus();
        currentWindow.close();
      }

      // If the window is not to be closed, remove the tabs that have been merged
      // if tab is protect remove mergeselected attribute
      else {
        // xxx if we close in one loop we get
        //Error: Component returned failure code: 0x80004005 (NS_ERROR_FAILURE) [nsIDOMXULElement.boxObject]
        // Source file: chrome://global/content/bindings/browser.xml
        // we need to fix the flst select after remove and made the proper new tab index in gBrowser.removeTab
        //in the first loop we remove all the tab but the current tab
        //in the 2nd loop we remove the current tab
        for (i = selectedTabs.length - 1; i > -1; --i) {
          var tab = selectedTabs.item(i);
          if (tab.hasAttribute("protected")) {
              tab.removeAttribute("mergeselected");
              tab.label = tab.label.substr(4);
          }
          else if (tab != currentWindow.gBrowser.mCurrentTab)
            currentWindow.gBrowser.removeTab(tab);
        }
        for (i = selectedTabs.length - 1; i > -1; --i) {
           tab = selectedTabs.item(i);
           currentWindow.gBrowser.removeTab(tab);
        }
        previousWindow.focus();
      }

      if (mergeBackGround && tabsSelected) {
        // because the other windows are added to the window with selected tabs, the not selected tabs
        // have to be removed. (normally the selected tabs will be removed and placed in another window)
        for (i = 0; i < selectedTabs.length; i++) {
          selectedTabs.item(i).label = selectedTabs.item(i).label.substr(4);
        }

        for (i = 0; i < previousTabs.length; i++) {
          if (previousTabs[i].hasAttribute('mergeremove')) {
            if (i < currentIndex)
              currentIndex--;
            previousWindow.gBrowser.removeTab(previousTabs[i]);
          }
          if (previousTabs[i].hasAttribute('mergeselected'))
            previousTabs[i].removeAttribute('mergeselected');
            previousTabs[i].label = previousTabs[i].label.substr(4);
        }
      }
      previousWindowTabBar.selectedIndex = currentIndex;
    }
    // Merge all windows to one window if more then one window is opened and
    // no tabs are selected and the pref is set to merge all windows.
    else if (!tabsSelected && mergeAllWindows) {
       // list all tabs on all windows with history scrollposition
      var addedTabsLength = 0, popupsList = new Array();

      for (i = 1; i < windowsArray.length; i++) {
        tabs = windowsArray[i].gBrowser.tabs;
        browsers = browsers.concat(listTabs(tabs, windowsArray[i]));
        // the last window in the array is only the current window if merging of popups is disabled
        // and the current window is a popup window
        if (windowsArray[i] != currentWindow)
          addedTabsLength += tabs.length;
      }
      // the current window is a popup and popups should also be merged
      // or the current window is not a popup
      if (!dontMergeCurrentWindow) {
        tabs = currentWindow.gBrowser.tabs;
        if (!currentWindowIsPopup) {
          browsers = browsers.concat(listTabs(tabs, currentWindow));
          currentIndex = firstWindowTabIndex + addedTabsLength + currentIndex;
        }
        else {
          var listedTabs = listTabs(tabs, currentWindow);
          if (placePopupNextToOpener) {
            openerPositionArray = getPopupOpenerPosition(currentWindow, windowsArray, firstWindowTabIndex);
            openerPosition = openerPositionArray[0];
            switch (openerPositionArray[1]) {
              case 'browsers':
                // the popup opener was found in the list of browsers that will be added to the remaining window.
                currentIndex = openerPosition + 1 + currentIndex;
                popupsList[openerPosition] = listedTabs;
                currentIndexSet = true;
                break;
              case 'tabs':
                // the popup opener was found in one of the tabs in the window that will remain.
                setTabsInBrowser(firstWindow, listedTabs, openerPosition);
                // in this case current index is fixed because the to be focused tab
                // has now already been added to the remaining window
                currentIndex = openerPosition + 1 + currentIndex;
                break;
              case 'end':
              default:
                // no popup opener was found, the popup will be added at the end of the tab list.
                browsers = browsers.concat(listedTabs);
                currentIndex = firstWindowTabIndex + addedTabsLength + currentIndex;
                break;
            }
          }
          else {
            browsers = browsers.concat(listedTabs);
            currentIndex = firstWindowTabIndex + addedTabsLength + currentIndex;
          }
        }
      }
      else // the current window is a popup and should not be merged.
        currentIndex = firstWindowTabIndex + addedTabsLength + currentIndex;

      // add popup windows to the remaining window when popup windows should also be merged.
      if (mergePopups) {
        for (i = 0; i < popupsArray.length; i++) {
          tabs = popupsArray[i].gBrowser.tabs;
          if (placePopupNextToOpener) {
            listedTabs = listTabs(tabs, popupsArray[i]);
            var newWindowsArray = windowsArray;
            if (!currentWindowIsPopup && !mergeBackGround)
              newWindowsArray.push(currentWindow);
            openerPositionArray = getPopupOpenerPosition(popupsArray[i], newWindowsArray, firstWindowTabIndex);
            openerPosition = openerPositionArray[0];
            switch (openerPositionArray[1]) {
              case 'browsers':
                // the popup opener was found in the list of browsers that will be added to the remaining window.
                if (openerPosition < currentIndex)
                  currentIndex += tabs.length;
                if (popupsList[openerPosition] instanceof Array)
                  popupsList[openerPosition] = popupsList[openerPosition].concat(listedTabs);
                else
                  popupsList[openerPosition] = listedTabs;
                break;
              case 'tabs':
                // the popup opener was found in one of the tabs in the window that will remain.
                setTabsInBrowser(firstWindow, listedTabs, openerPosition);
                if (openerPosition < currentIndex)
                  currentIndex += tabs.length;
                break;
              case 'end':
              default:
                // no popup opener was found, the pop up will be added at the end of the tab list.
                browsers = browsers.concat(listedTabs);
                break;
            }
          }
          else {
            browsers = browsers.concat(listTabs(tabs, popupsArray[i]));
          }
        }
      }

      // place all tabs in one window and select the tab which was selected in the top window
      setTabsInBrowser(firstWindow, browsers);

      // add popups which have openers next to their openers.
      while (popupsList.length > 0) {
        var popupTabs = popupsList.pop();
        if (popupTabs instanceof Array) {
          var position = popupsList.length;
          setTabsInBrowser(firstWindow, popupTabs, position);
        }
      }

      // select the tab which was selected in the top window
      firstWindowTabBar.selectedIndex = currentIndex;

      // focus the window now containing the tabs and close all other windows
      firstWindow.focus();

      // close windows from where tabs have been merged
      for (i = 1; i < windowsArray.length; i++) {
        windowsArray[i].close();
      }

      // close popup windows if the popups have been merged
      if (mergePopups) {
        for (i = 0; i < popupsArray.length; i++) {
          popupsArray[i].close();
        }
      }

      // if current window has been merged close it
      if (!dontMergeCurrentWindow)
        currentWindow.close();
      // give focus again to the current window if it is a popup and popups should not be merged
      if (dontMergeCurrentWindow)
        windowsArrayList.currentWindow.setTimeout(windowsArrayList.currentWindow.focus, 0);
    }

    // retrieve the opener for a popup window, so it can be placed next to it
    function getPopupOpenerPosition(popupWindow, otherWindows, containerWindowTabsIndex) {
      var i, j, openerIndex = -1;
      var openerWindow = popupWindow.gBrowser.contentWindow.opener
      if (!openerWindow) {
        return [openerIndex, 'end'];
      }
      for (i = 0; i < otherWindows.length; i++) {
        if (otherWindows[i] == popupWindow)
          continue;
        var tabs = otherWindows[i].gBrowser.tabs;
        for (j = 0; j < tabs.length; j++) {
          openerIndex++;
          var possibleOpener = otherWindows[i].gBrowser.getBrowserForTab(tabs[j]).contentWindow;
          if (possibleOpener == openerWindow) {
            var where = (openerIndex >= containerWindowTabsIndex)? 'browsers': 'tabs';
            return [openerIndex, where];
          }
        }
      }
      return [-1, 'end'];
    }

    function listTabs(tabs, aWindow) {
      var x = 0, curBrowser, browsersArray = new Array();
      for (x; x < tabs.length; x++) {
        curBrowser = aWindow.gBrowser.getBrowserForTab(tabs[x]);
        browsersArray[x] = [[MergeWindows.copyHistory(curBrowser.webNavigation.sessionHistory)],
                      aWindow.TabmixSessionData.getTabProperties(tabs[x]),
                      [curBrowser.contentWindow.scrollX, curBrowser.contentWindow.scrollY],
                      curBrowser.markupDocumentViewer.textZoom];
      }

      return browsersArray;
    }

    // add cloned tabs to a browser window
    function setTabsInBrowser(aWindow, pages) {
      var y = 0, openedBrowser, newTab;

      if (openTabNext) {
        var index = (aWindow == firstWindow)?firstWindowTabIndex:previousWindowTabIndex;
      }

      var tabbrowser = aWindow.gBrowser;
      // add tabs to defined position in case of a popup: next to its opener
      var addToPosition = false;
      if (typeof(arguments[2]) == 'number')  {
        addToPosition = true;
        var openerPosition = arguments[2];
        var position = arguments[2];
      }

      while (y < pages.length) {
        newTab = tabbrowser.addTab("about:blank");
        newTab.linkedBrowser.stop();
        if (addToPosition)  {
          var newTabPos = (tabbrowser.getTabIndex)? tabbrowser.getTabIndex(newTab): newTab._tPos;

          // the popup is placed next to its opener
          var newPosition = position + 1;
          if (newTabPos < newPosition)
            newPosition--;
          if (newTabPos != newPosition)
            getTabIndex.moveTabTo((tabbrowser.getTabIndex)? newTabPos: newTab, newPosition);

          // set the opener again for the popup (this data will otherwise be lost)
          var openerBrowser = tabbrowser.getBrowserForTab(tabbrowser.tabs[openerPosition]);
          tabbrowser.getBrowserForTab(newTab).contentWindow.opener = openerBrowser.contentWindow;
          position++;
        }
        else if (openTabNext) {
          var firstArgument = (tabbrowser.getTabIndex)? tabbrowser.getTabIndex(newTab): newTab;
          tabbrowser.moveTabTo(firstArgument, index + 1);
          index++;
        }
        openedBrowser = tabbrowser.getBrowserForTab(newTab);

        // we call setScrollPosition after load to make sure scrollPosition is set
        openedBrowser.addEventListener('load', aWindow.tablib.dupScrollPosition, true);
        openedBrowser._scrollData = {
            tabPos: newTab._tPos,
            href: null,
            _scrollX: pages[y][2][0],
            _scrollY: pages[y][2][1]
        };

        aWindow.TabmixSessionData.setTabProperties(newTab, pages[y][1]);
        MergeWindows.setClonedContent(openedBrowser, pages[y][0]);
        y++;
      }
    }
  },

  // list all browser windows in an array from front to back (z-order on windows, on linux opening order);
  listWindows: function() {
    var windowsArray = new Array(), popupsArray = new Array();
    var i = 0, winEnumerator, currentWindow, isCurrentWindowPopup, win;
    var windowsMediator = TabmixSvc.wm;
    currentWindow = windowsMediator.getMostRecentWindow("navigator:browser");
    // getZOrderDOMWindowEnumerator is broken everywhere other than Windows
    if (Services.appinfo.OS != "WINNT")
      winEnumerator = windowsMediator.getEnumerator("navigator:browser");
    else
      winEnumerator = windowsMediator.getZOrderDOMWindowEnumerator("navigator:browser", false);
    while (winEnumerator.hasMoreElements()) {
      win = winEnumerator.getNext();
      // list the current window apart
      if (win == currentWindow.QueryInterface(Ci.nsIDOMWindow)) {
        currentWindow = win;
        isCurrentWindowPopup = !win.toolbar.visible;
        continue;
      }
      if (win.toolbar.visible)
        windowsArray.push(win);
      else
        popupsArray.push(win);
    }

    var windowsList = {windowsArray: windowsArray, popupsArray: popupsArray, currentWindow: currentWindow, isCurrentWindowPopup: isCurrentWindowPopup};
    return windowsList;
  },

  setClonedContent: function(aBrowser, aClonedContents) {
    if (aClonedContents[0].length == 0) return;
    this.clonedContents = aClonedContents;
    this.newBrowser = aBrowser;
    this.cloneTabHistory(aBrowser, aClonedContents[0]);
  },

  cloneHistoryEntry: function(aEntry) {
    if (!aEntry)
      return null;
    aEntry = aEntry.QueryInterface(Ci.nsISHContainer);
    var newEntry = aEntry.clone();
    newEntry = newEntry.QueryInterface(Ci.nsISHContainer);
    newEntry.loadType = Math.floor(aEntry.loadType);
    if (aEntry.childCount) {
      for (var j = 0; j < aEntry.childCount; j++) {
          var childEntry = this.cloneHistoryEntry(aEntry.GetChildAt(j));
          if (childEntry)
            newEntry.AddChild(childEntry, j);
      }
    }
    return newEntry;
  },

  cloneTabHistory: function(aBrowser, originalHistory) {
    var newHistory = aBrowser.webNavigation.sessionHistory

    newHistory.QueryInterface(Ci.nsISHistoryInternal);

    // delete history entries if they are present
    if (newHistory.count > 0)
      newHistory.PurgeHistory(newHistory.count);

    for (var i = 0; i < originalHistory.length; i++) {
      let entry = originalHistory[i].QueryInterface(Ci.nsISHEntry);
      let newEntry = this.cloneHistoryEntry(entry);
      newHistory.addEntry(newEntry, true);
    }

    // Goto current history location
    if (originalHistory.length > 0 && originalHistory.index < originalHistory.length) {
      try {
        aBrowser.gotoIndex(originalHistory.index);
      }
      catch(e) {
         let win = TabmixSvc.topWin();
         win.setTimeout( function (browser, index) { browser.gotoIndex(index); }, 0, aBrowser, originalHistory.index);
      }
    }
  },

   copyHistory: function(originalHistory, aOnlyBack) {
      // variables used in this function
      var pageCount, currentPageNum, firstPageNum, lastPageNum;

      currentPageNum = originalHistory.index;
      lastPageNum = originalHistory.count-1;

      firstPageNum = 0;
      pageCount = lastPageNum+1;

      currentPageNum = currentPageNum-firstPageNum;

      var copiedHistory = new Array();
      for (var i = firstPageNum; i < pageCount; i++) {
         copiedHistory.push(originalHistory.getEntryAtIndex(i, false));
      }
      copiedHistory.index = currentPageNum;

      return copiedHistory;
   }

}
