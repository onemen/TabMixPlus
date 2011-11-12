//code from Dorando and Sboulema's MiniT+, modified by Hemiola SUN
// modified by onemen

var TMP_TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab"

function TMP_DragAndDrop_init() {
  TMP_setDragEvents(true);
  TMP_tabDNDObserver.draglink = TabmixSvc.getString("droplink.label");

  // without this the Indicator is not visible on the first drag
  var ind = Tabmix.isVersion(40) ? gBrowser.tabContainer._tabDropIndicator :
            gBrowser.mTabDropIndicatorBar.firstChild;
  ind.style.MozTransform = "translate(0px, 0px)";
}

function TMP_setDragEvents(atStart) {
  // we only set Tabmix events at start if Tree Style Tab is not in vertical mode
  var useDefaultDnD = false;
  if ("TreeStyleTabBrowser" in window) {
    try {
      var tabbarPosition = TabmixSvc.prefs.getCharPref("extensions.treestyletab.tabbar.position").toLowerCase();
    }
    catch (er) {};
    useDefaultDnD = tabbarPosition == "left" || tabbarPosition == "right";
  }

  if (atStart && useDefaultDnD) {
    gBrowser.tabContainer.tabmix_useDefaultDnD = useDefaultDnD;
    return; // nothing to do here;
  }

  if ("tabmix_useDefaultDnD" in gBrowser.tabContainer && gBrowser.tabContainer.tabmix_useDefaultDnD == useDefaultDnD) {
    return; // nothing to do here;
  }
  gBrowser.tabContainer.tabmix_useDefaultDnD = useDefaultDnD;
  if (Tabmix.isVersion(40)) {
    gBrowser.mTabDropIndicatorBar = gBrowser.tabContainer._tabDropIndicator.parentNode;
    TMP_tabDNDObserver._dragOverDelay = gBrowser.tabContainer._dragOverDelay;
    TMP_tabDNDObserver.paddingLeft  = TMP_getStyle(gBrowser.tabContainer, "paddingLeft");
    return;
  }
  else if ("TreeStyleTabBrowser" in window)
    gBrowser.mTabDropIndicatorBar = document.getAnonymousElementByAttribute(gBrowser, "class", "tab-drop-indicator-bar");

  // this block is for Firefox 3.5-3.6.x
  TMP_tabDNDObserver._dragOverDelay = gBrowser.mDragOverDelay;
  if (useDefaultDnD) {
    gBrowser.mStrip.setAttribute("ondragstart", "this.parentNode.parentNode._onDragStart(event);");
    gBrowser.mStrip.setAttribute("ondragover", "this.parentNode.parentNode._onDragOver(event);");
    gBrowser.mStrip.setAttribute("ondrop", "this.parentNode.parentNode._onDrop(event);");
    gBrowser.mStrip.setAttribute("ondragend", "this.parentNode.parentNode._onDragEnd(event);");
    gBrowser.mStrip.setAttribute("ondragleave", "this.parentNode.parentNode._onDragLeave(event);");
    gBrowser.mTabDropIndicatorBar.setAttribute("ondragover", "this.parentNode.parentNode._onDragOver(event);");
    gBrowser.mTabDropIndicatorBar.setAttribute("ondragleave", "this.parentNode.parentNode._onDragLeave(event);");
    gBrowser.mTabDropIndicatorBar.setAttribute("ondrop", "this.parentNode.parentNode._onDrop(event);");
  }
  else {
    gBrowser.mStrip.setAttribute("ondragstart", "TMP_tabDNDObserver.onDragStart(event)");
    gBrowser.mStrip.setAttribute("ondragover", "TMP_tabDNDObserver.onDragOver(event)");
    gBrowser.mStrip.setAttribute("ondrop", "TMP_tabDNDObserver.onDrop(event);");
    gBrowser.mStrip.setAttribute("ondragend", "TMP_tabDNDObserver.onDragEnd(event);");
    gBrowser.mStrip.setAttribute("ondragleave", "TMP_tabDNDObserver.onDragExit(event);");
    gBrowser.mTabDropIndicatorBar.setAttribute("ondragover", "TMP_tabDNDObserver.onDragOver(event);");
    gBrowser.mTabDropIndicatorBar.setAttribute("ondragleave", "TMP_tabDNDObserver.onDragExit(event);");
    gBrowser.mTabDropIndicatorBar.setAttribute("ondrop", "TMP_tabDNDObserver.onDrop(event);");
  }
}

///////////////////////////////////////////////////////////////////////////
//// Drag and Drop observers

var TMP_tabDNDObserver = {
  gBackupLabel: "",
  gMsg: null,
  draglink: "",
  lastTime: 0,
  dragmarkindex: null,
  marginBottom: 0,
  paddingLeft: 0,
  LinuxMarginEnd: 0,
  _dragTime: 0,
  _dragOverDelay: 350,
  DRAG_LINK              : 0,
  DRAG_TAB_TO_NEW_WINDOW : 1,
  DRAG_TAB_IN_SAME_WINDOW: 2,

  onDragStart: function (event, transferData, action) {
    this._dragLeftWindow = false;
    if (event.target.localName != "tab" || event.originalTarget.localName == "toolbarbutton")
      return;

    let tabs = gBrowser.tabContainer.getElementsByAttribute("showbutton" , "*");
    for (var i = 0; i < tabs.length; i++)
      tabs[i].removeAttribute("showbutton");

    // Firefox dragstart function handle this
    // we treat this as if we drop a link draggeType = this.DRAG_LINK
    if (Tabmix.isVersion(80) && event.ctrlKey) {
      return;
    }

    var draggedTab = event.target;
    var uri = gBrowser.getBrowserForTab(draggedTab).currentURI;
    var spec = uri ? uri.spec : "about:blank";

    let dt = event.dataTransfer;
    dt.mozSetDataAt(TMP_TAB_DROP_TYPE, draggedTab, 0);
    // We must not set text/x-moz-url or text/plain data here,
    // otherwise trying to deatch the tab by dropping it on the desktop
    // may result in an "internet shortcut"
    dt.mozSetDataAt("text/x-moz-text-internal", spec, 0);
    // Set the cursor to an arrow during tab drags.
    dt.mozCursor = "default";

    let canvas = tabPreviews.capture(draggedTab, false);
    dt.setDragImage(canvas, 0, 0);
    event.stopPropagation();
  },

  onDragOver: function minit_onDragOver(event, flavours, session) {
    var dt = event.dataTransfer;
    var tabBar = gBrowser.tabContainer;

    var sourceNode = TMP_getSourceNode(dt, session);
    var draggeType = this.getDragType(sourceNode);
    var newIndex = this.getNewIndex(event);
    var oldIndex = draggeType != this.DRAG_LINK ? sourceNode._tPos : -1;
    var left_right; // 1:right, 0: left, -1: drop link on tab to replace tab
    if (newIndex < gBrowser.tabs.length)
      left_right = this.getLeft_Right(event, newIndex, oldIndex, draggeType);
    else {
      newIndex = draggeType != this.DRAG_TAB_IN_SAME_WINDOW && TMP_getOpenTabNextPref(draggeType == this.DRAG_LINK) ? tabBar.selectedIndex :
                  gBrowser.tabs.length - 1;
      left_right = 1;
    }

    var isCopy;
    isCopy = dt.dropEffect == "copy";
    var effects = this._setEffectAllowedForDataTransfer(event, draggeType);

    var replaceTab = (left_right == -1);
    /* we don't allow to drop link on lock tab.
     * unless:
     *           - the tab is blank
     *     or    - the user press Ctrl/Meta Key
     *     or    - we drop link that start download
     */
    if (replaceTab && !isCopy) {
      var targetTab = gBrowser.tabs[newIndex];
      if (targetTab.getAttribute("locked") && !gBrowser.isBlankNotBusyTab(targetTab)) {
        try {
          var url = Tabmix.isVersion(40) ? browserDragAndDrop.drop(event, { }) : this.retrieveURLFromData(dt);
          if (!url || !url.length || url.indexOf(" ", 0) != -1 ||
              /^\s*(javascript|data):/.test(url))
            url = null;

          var disAllowDrop = url ? !TMP_isUrlForDownload(url) : true;
        } catch (ex) { Tabmix.assert(ex);}

        if (disAllowDrop)
          dt.effectAllowed = "none";
      }
    }

    var canDrop;
    var hideIndicator = false;
    if (effects == "") {
      this.clearDragmark();
      return;
    }
    canDrop = effects != "none";
    if (canDrop && !isCopy && draggeType == this.DRAG_TAB_IN_SAME_WINDOW && oldIndex == newIndex) {
      canDrop = false;
      dt.effectAllowed = "none";
    }
    // if we don't set effectAllowed to none then the drop indicator stay
    else if (Tabmix.isVersion(40) && TabmixTabbar.scrollButtonsMode == TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT &&
               gBrowser.tabs[0].pinned && event.clientX < gBrowser.tabs[0].boxObject.x) {
      canDrop = false;
      dt.effectAllowed = "none";
    }

    event.preventDefault();
    event.stopPropagation();

    // show Drag & Drop message
    if (draggeType == this.DRAG_LINK) {
      this.gMsg = event.originalTarget.getAttribute("command") == "cmd_newNavigatorTab" ?
                              this.gBackupLabel : this.draglink;
      if (event.target.localName != "tab" && event.target.localName != "tabs")
        this.gMsg = this.gBackupLabel;
      var statusTextFld = document.getElementById("statusbar-display");
      if (statusTextFld && statusTextFld.getAttribute("label") != this.gMsg) {
        if (this.gBackupLabel == "")
          this.gBackupLabel = statusTextFld.getAttribute("label");
        statusTextFld.label = this.gMsg;
        this.statusFieldChanged = true;
      }
      else if (!statusTextFld) {
        let tooltip = document.getElementById("tabmix-tooltip");
        if (tooltip.state == "closed") {
          tooltip.label = this.gMsg;
          tooltip.openPopup(document.getElementById("browser"), null, -1, -1, false, false);
        }
      }
    }

    if (tabBar.canScrollTabsLeft || tabBar.canScrollTabsRight) {
      var _scroll, targetAnonid;
      if (TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_HIDDEN) // scroll with button
        targetAnonid = event.originalTarget.getAttribute("anonid");
      // scroll without button
      else if (event.clientX <= tabBar.mTabstrip.scrollBoxObject.x)
        targetAnonid = "scrollbutton-up";
      else if(event.clientX >= (tabBar.mTabstrip.scrollBoxObject.x + tabBar.mTabstrip.scrollBoxObject.width))
        targetAnonid = "scrollbutton-down";

      switch (targetAnonid) {
        case "scrollbutton-up":
        case "scrollbutton-up-right":
          if (tabBar.canScrollTabsLeft)
            _scroll = -1;
            break;
        case "scrollbutton-down":
          if (tabBar.canScrollTabsRight)
            _scroll = 1;
            break;
      }
      if (_scroll) {
        var newTime = new Date().getTime();
        if (newTime - this.lastTime > 100) {
          tabBar.tabsScroll(_scroll);
          this.lastTime = newTime;
        }
        hideIndicator = true;
      }
    }

    if (draggeType == this.DRAG_LINK) {
      let tab;
      if (Tabmix.isVersion(40))
        tab = tabBar._getDragTargetTab(event);
      else
        tab = event.target;
      if (tab) {
        if (!this._dragTime)
          this._dragTime = Date.now();
        if (Date.now() >= this._dragTime + this._dragOverDelay)
          tabBar.selectedItem = tab;
      }
    }

    if ( replaceTab || hideIndicator || !canDrop) {
      this.clearDragmark();
      return;
   }

   this.setDragmark(newIndex, left_right);
  },

  onDrop: function minit_onDrop(event, dropData, session) {
    this.clearDragmark();
    this.updateStatusField();
    var dt = event.dataTransfer;
    var sourceNode = TMP_getSourceNode(dt, session);
    var draggeType = this.getDragType(sourceNode);
    var isCopy = dt.dropEffect == "copy";
    var draggedTab;
    if (draggeType != this.DRAG_LINK) {
      draggedTab = sourceNode;
      // not our drop then
      if (!draggedTab)
        return;
    }

    event.stopPropagation();

    if (Tabmix.isVersion(40))
      document.getElementById("tabmix-tooltip").hidePopup();

    var isTabReorder = draggeType == this.DRAG_TAB_IN_SAME_WINDOW // TreeStyleTab extension look for isTabReorder in our code
    var newIndex = this.getNewIndex(event);
    var oldIndex = draggedTab ? draggedTab._tPos : -1;
    var left_right;

    if (newIndex < gBrowser.tabs.length)
       left_right = this.getLeft_Right(event, newIndex, oldIndex, draggeType);
    else {
      newIndex = draggeType != this.DRAG_TAB_IN_SAME_WINDOW && TMP_getOpenTabNextPref(draggeType == this.DRAG_LINK) ? gBrowser.tabContainer.selectedIndex :
                 gBrowser.tabs.length - 1;
      left_right = 1;
    }

    if (draggedTab && (isCopy || draggeType == this.DRAG_TAB_IN_SAME_WINDOW)) {
      if (isCopy) {
        // copy the dropped tab (wherever it's from)
        var newTab = gBrowser.duplicateTab(draggedTab);
        gBrowser.moveTabTo(newTab, newIndex + left_right);

        if (draggeType == this.DRAG_TAB_TO_NEW_WINDOW || event.shiftKey)
          gBrowser.selectedTab = newTab;
      }
      else {
        // move the dropped tab
        newIndex += left_right - (newIndex > oldIndex);

        if (Tabmix.isVersion(40)) {
          if (draggedTab.pinned) {
            if (newIndex >= gBrowser._numPinnedTabs)
              gBrowser.unpinTab(draggedTab);
          } else {
            if (newIndex <= gBrowser._numPinnedTabs - 1)
              gBrowser.pinTab(draggedTab);
          }
        }
        if (newIndex != draggedTab._tPos)
          gBrowser.moveTabTo(draggedTab, newIndex);

        // when we drag tab over scroll-down button and then drop
        // the dragged tab can be hidden
        draggedTab.collapsed = false;

        if (gBrowser.tabContainer.hasAttribute("multibar"))
          TabmixTabbar.updateScrollStatus();
      }

      gBrowser.tabContainer.ensureTabIsVisible(newIndex);
      TabmixTabbar.updateBeforeAndAfter();
    }
    else if (draggedTab) {
      // swap the dropped tab with a new one we create and then close
      // it in the other window (making it seem to have moved between
      // windows)
      newTab = gBrowser.addTab("about:blank");
      var newBrowser = gBrowser.getBrowserForTab(newTab);
      // Stop the about:blank load
      newBrowser.stop();
      // make sure it has a docshell
      newBrowser.docShell;

      gBrowser.moveTabTo(newTab, newIndex + left_right);

      TMP_copyTabData(newTab, draggedTab);
      gBrowser.swapBrowsersAndCloseOther(newTab, draggedTab);

      // We need to set selectedTab after we've done
      // swapBrowsersAndCloseOther, so that the updateCurrentBrowser
      // it triggers will correctly update our URL bar.
      gBrowser.selectedTab = newTab;
    }
    else {
      var url = Tabmix.isVersion(40) ? browserDragAndDrop.drop(event, { }) : this.retrieveURLFromData(dt);
      // valid urls don't contain spaces ' '; if we have a space it isn't a valid url.
      // Also disallow dropping javascript: or data: urls--bail out
      if (!url || !url.length || url.indexOf(" ", 0) != -1 ||
         /^\s*(javascript|data):/.test(url))
         return;

      if (!Tabmix.isVersion(40)) {
        var dragService = Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService);
        session = dragService.getCurrentSession();
        nsDragAndDrop.dragDropSecurityCheck(event, session, url);
      }

      var bgLoad = true;
      try {
        bgLoad = TabmixSvc.prefs.getBoolPref("browser.tabs.loadInBackground");
      }
      catch (e) { }

      if (event.shiftKey)
        bgLoad = !bgLoad; // shift Key reverse the pref

      url = getShortcutOrURI(url);
      var tab = null;
      if (left_right > -1 && !TMP_isUrlForDownload(url)) {
        // We're adding a new tab.
         try {
            tab = gBrowser.addTab(url);
            gBrowser.moveTabTo(tab, newIndex + left_right);
         } catch(ex) {
            // Just ignore invalid urls
            Tabmix.log("addTab\n" + ex);
            return;
         }
      }
      else {
        // Load in an existing tab.
        tab = event.target.localName == "tab" ? event.target : gBrowser.tabs[newIndex];
        try {
          let browser = tab.linkedBrowser;
          // allow to load in locked tab
          browser.tabmix_allowLoad = true;
          browser.loadURI(url);
        } catch(ex) {
          // Just ignore invalid urls
          Tabmix.log("load\n" + ex);
          return;
        }
      }
      if (gBrowser.mCurrentTab != tab)
        gBrowser.TMP_selectNewForegroundTab(tab, bgLoad, url);
    }
  },

  onDragEnd: function minit_onDragEnd(aEvent) {
    // see comment in gBrowser._onDragEnd
    // don't allow to open new window in single window mode
    var dt = aEvent.dataTransfer;
    if (dt.mozUserCancelled || dt.dropEffect != "none")
      return;

    if (Tabmix.singleWindowMode) {
      if (Tabmix.isVersion(40))
        aEvent.stopPropagation();
      return;
    }
    this.clearDragmark(aEvent);
    // Disable detach within the browser toolbox
    var eX = aEvent.screenX;
    var wX = window.screenX;
    // check if the drop point is horizontally within the window
    if (eX > wX && eX < (wX + window.outerWidth)) {
      // also avoid detaching if the the tab was dropped too close to
      // the tabbar (half a tab)
      var tabBar = gBrowser.tabContainer;
      var bo = tabBar.mTabstrip.scrollBoxObject;
      // in Firefox 4.0 we can pinned all tabs
      let index = tabBar.collapsedTabs;
      if (index == tabBar.childNodes.length)
        index--;
      var tabHeight = tabBar.childNodes[index].boxObject.height;
      var endScreenY = bo.screenY + bo.height + 0.5 * tabHeight;
      var eY = aEvent.screenY;
      if (TabmixTabbar.position == 0) {// tabbar on the top
        if (eY < endScreenY && eY > window.screenY)
          return;
      }
      else {// bottom
        var tb = gNavToolbox.boxObject;
        var toolboxEndScreenY = tb.screenY + tb.height;
        var startScreenY = bo.screenY - 0.5 * tabHeight;
        if ((eY > startScreenY && eY < endScreenY) || eY < toolboxEndScreenY)
          return;
      }

    }

    var draggedTab = dt.mozGetDataAt(TMP_TAB_DROP_TYPE, 0);
    gBrowser.replaceTabWithWindow(draggedTab);
    aEvent.stopPropagation();
  },

  onDragExit: function minit_onDragExit(event, session) {
    event.stopPropagation();
    this._dragTime = 0;

    var target = event.relatedTarget;
    while (target && target.localName != "tabs")
      target = target.parentNode;
    if (target)
      return;

    this.clearDragmark();
    this.updateStatusField();
  },

  updateStatusField: function () {
    var statusTextFld = document.getElementById("statusbar-display");
    if (statusTextFld && this.statusFieldChanged) {
      statusTextFld.label = "";
      this.gBackupLabel = "";
      this.statusFieldChanged = null;
    }
    else if (!statusTextFld)
      document.getElementById("tabmix-tooltip").hidePopup();
  },

  getNewIndex: function (event) {
    // start to chack after collapsedTabs
    // if X is less then the first tab return 0
    // check if the tab is visible... if not return gBrowser.tabs.length
    // check if Y is below the tab.... if yes go to next row
    // in the row find the closest tab by X,
    // if no tab is match return gBrowser.tabs.length
    var mX = event.clientX, mY = event.clientY;
    var i, tabBar = gBrowser.tabContainer;
    var tabs = tabBar.childNodes;
    var collapsed = Tabmix.isVersion(40) && gBrowser._numPinnedTabs ? 0 : tabBar.collapsedTabs;
    if (!tabBar.hasAttribute("multibar")) {
      if (Tabmix.ltr) {
        for (i = event.target.localName == "tab" ? event.target._tPos : collapsed; i < tabs.length; i++) {
          if (tabs[i].collapsed)
            continue;
          if (mX < tabs[i].boxObject.x + tabs[i].boxObject.width)
            return i;
        }
      }
      else {
        for (i = event.target.localName == "tab" ? event.target._tPos : 0 ; i < tabs.length - collapsed; i++) {
          if (tabs[i].collapsed)
            continue;
          if (mX > tabs[i].boxObject.x + tabs[i].boxObject.width*0)
            return i;
          }
      }
    }
    else {
      var j, tab, thisRow;
      var top = tabBar.topTabY;
      if (Tabmix.ltr) {
        for (i = collapsed; i < tabs.length; i++) {
          if (tabs[i].collapsed)
            continue;
          if (!tabBar.isTabVisible(i))
            return tabs.length;
          tab = tabs[i];
          thisRow = tabBar.getTabRowNumber(tab, top);
          if (mY >= tab.baseY) {
            while (i < tabs.length - 1 && tabBar.getTabRowNumber(tabs[i+1], top) == thisRow)
              i++;
          }
          else if (mX < tab.boxObject.x + tab.boxObject.width )
            return i;
          else if (i == tabs.length - 1 || tabBar.getTabRowNumber(tabs[i+1], top) != thisRow)
            return i;
        }
      }
      else {
        for (i = collapsed; i < tabs.length; i++) {
          if (tabs[i].collapsed)
            continue;
          if (!tabBar.isTabVisible(i))
            return tabs.length;
          tab = tabs[i];
          thisRow = tabBar.getTabRowNumber(tab, top);
          if (mY >= tab.baseY) {
            while (i < tabs.length - 1 && tabBar.getTabRowNumber(tabs[i+1], top) == thisRow)
              i++;
          }
          else if (mX > tab.boxObject.x)
            return i;
          else if (i == tabs.length - 1 || tabBar.getTabRowNumber(tabs[i+1], top) != thisRow)
            return i;
        }
      }
    }
    return tabs.length;
  },

  getLeft_Right: function (event, newIndex, oldIndex, draggeType) {
   var clientX = event.clientX;
   var left_right;
   var tab = gBrowser.tabs[newIndex];
   var tabBo = tab.boxObject;
   var ltr = Tabmix.ltr;
   var _left = ltr ? 0 : 1;
   var _right = ltr ? 1 : 0;

   var isCtrlKey = ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey);
   var lockedTab = tab.getAttribute("locked") && !gBrowser.isBlankNotBusyTab(tab);
   if ((draggeType == this.DRAG_LINK && lockedTab) || (draggeType == this.DRAG_LINK && !lockedTab && !isCtrlKey)) {
      left_right = (clientX < tabBo.x + tabBo.width / 4 ) ? _left : _right;
      if (left_right == _right && clientX < tabBo.x + tabBo.width * 3 / 4 )
         left_right = -1;
   }
   else {
      left_right = ( clientX < tabBo.x + tabBo.width / 2 ) ? _left : _right;
      if (!isCtrlKey && draggeType == this.DRAG_TAB_IN_SAME_WINDOW) {
        if (newIndex == oldIndex - 1)
          left_right = ltr ? _left : _right;
        else if (newIndex == oldIndex + 1)
          left_right = ltr ? _right : _left;
      }
   }

   return left_right;
  },

  getDragType: function minit_getDragType(aSourceNode) {
    if (aSourceNode && aSourceNode instanceof XULElement && aSourceNode.localName == "tab") {
      if (aSourceNode.parentNode == gBrowser.tabContainer)
        return this.DRAG_TAB_IN_SAME_WINDOW; // 2
      if (aSourceNode.ownerDocument.defaultView instanceof ChromeWindow &&
           aSourceNode.ownerDocument.documentElement.getAttribute("windowtype") == "navigator:browser")
        return this.DRAG_TAB_TO_NEW_WINDOW; // 1
    }
    return this.DRAG_LINK; // 0
  },

  setDragmark: function minit_setDragmark(index, left_right) {
    var newIndex = index + left_right;
    if (this.dragmarkindex == newIndex)
      return;

   this.clearDragmark();// clear old dragmark if one exist

   if (!TabmixSvc.TMPprefs.getBoolPref("useFirefoxDragmark")) {
      var sameRow = newIndex != 0 && newIndex != gBrowser.tabs.length &&
            TabmixTabbar.inSameRow(gBrowser.tabs[newIndex-1], gBrowser.tabs[newIndex]);
      if (sameRow || left_right==0)
         this.setDragmarkAttribute(gBrowser.tabs[newIndex], "atLeft");
      if (sameRow || left_right==1)
         this.setDragmarkAttribute(gBrowser.tabs[newIndex-1], "atRight");
   }
   else {
      // code for firefox indicator
      var ib = gBrowser.mTabDropIndicatorBar;
      var ibRect = ib.getBoundingClientRect();
      var ind = Tabmix.isVersion(40) ? gBrowser.tabContainer._tabDropIndicator : ib.firstChild;
      var rect;
      var minMargin, maxMargin, newMargin;
      var tabBoxObject, tabRect;
      var ltr = Tabmix.ltr;
      if (Tabmix.isVersion(36)) {
         var scrollRect;
         if (Tabmix.isVersion(40)) {
           scrollRect = gBrowser.tabContainer.mTabstrip.scrollClientRect;
           rect = gBrowser.tabContainer.getBoundingClientRect();
         }
         else {
           scrollRect = gBrowser.tabContainer.mTabstrip.getBoundingClientRect();
           rect = gBrowser.getBoundingClientRect();
         }
         let scrollMode = TabmixTabbar.scrollButtonsMode;
         let paddingLeft = !gBrowser.tabContainer.overflow ||
                           scrollMode == TabmixTabbar.SCROLL_BUTTONS_HIDDEN ||
                           scrollMode == TabmixTabbar.SCROLL_BUTTONS_MULTIROW ||
                           (scrollMode == TabmixTabbar.SCROLL_BUTTONS_RIGHT &&
                            !TabmixSvc.TMPprefs.getBoolPref("tabBarSpace")) ? this.paddingLeft : 0;
         minMargin = scrollRect.left - rect.left - paddingLeft;
         if (Tabmix.isVersion(40))
            maxMargin = Math.min(minMargin + scrollRect.width, scrollRect.right);
         else
            maxMargin = Math.min(minMargin + scrollRect.width, ibRect.right - ind.clientWidth);
         if (!ltr)
            [minMargin, maxMargin] = [gBrowser.clientWidth - maxMargin, gBrowser.clientWidth - minMargin];

         tabRect = gBrowser.tabs[index].getBoundingClientRect();
         if (ltr)
            newMargin = tabRect.left - rect.left  + (left_right == 1 ? tabRect.width + this.LinuxMarginEnd: 0) - paddingLeft;
         else
            newMargin = rect.right - tabRect.left - (left_right == 0 ? tabRect.width + this.LinuxMarginEnd : 0);
      }
      else {
         this.setFirefoxDropIndicator(true);
         var tabStripBoxObject = gBrowser.tabContainer.mTabstrip.scrollBoxObject;
         minMargin = tabStripBoxObject.x - gBrowser.boxObject.x;
         maxMargin = Math.min(minMargin + tabStripBoxObject.width, ib.boxObject.x + ib.boxObject.width - ind.boxObject.width);
         if (!ltr)
            [minMargin, maxMargin] = [gBrowser.boxObject.width - maxMargin, gBrowser.boxObject.width - minMargin];
         if (TabmixTabbar.position != 1)
            this.setFirefoxDropIndicator(false);
         tabBoxObject = gBrowser.tabs[index].boxObject;
         if (ltr)
            newMargin = tabBoxObject.screenX - gBrowser.boxObject.screenX + (left_right == 1 ? tabBoxObject.width + this.LinuxMarginEnd : 0);
         else
            newMargin = gBrowser.boxObject.screenX - tabBoxObject.screenX + gBrowser.boxObject.width - (left_right == 0 ? tabBoxObject.width + this.LinuxMarginEnd : 0);
      }

      if (!Tabmix.isVersion(40)) {
         // ensure we never place the drop indicator beyond our limits
         if (newMargin < minMargin)
            newMargin = minMargin;
         else if (newMargin > maxMargin)
            newMargin = maxMargin;
      }

      var newMarginY;
      if (Tabmix.isVersion(40)) {
         if (TabmixTabbar.position == 1) {
           newMarginY = tabRect.bottom - ibRect.bottom;
           if (document.getElementById("addon-bar").collapsed)
             ind.style.marginBottom = "0px";
           else
             ind.style.removeProperty("margin-bottom");
         }
         else
           newMarginY = tabRect.bottom - rect.bottom;
         this.setFirefoxDropIndicator(true);
         newMargin += ind.clientWidth / 2;
         if (!ltr)
           newMargin *= -1;

         ind.style.MozTransform = "translate(" + Math.round(newMargin) + "px," + Math.round(newMarginY) + "px)";
         ind.style.MozMarginStart = (-ind.clientWidth) + "px";
      }
      else {
         if (TabmixTabbar.position == 1) {
            ind.style.backgroundPosition = "50% 0%";
            if (Tabmix.isVersion(36))
               newMarginY = tabRect.top - ibRect.top;
            else
               newMarginY = tabBoxObject.screenY - ib.boxObject.screenY;
            ind.style.marginTop = newMarginY + "px";
         }
         else {
            ind.style.backgroundPosition = "50% 100%";
            if (Tabmix.isVersion(36))
               newMarginY = rect.top - tabRect.top + this.marginBottom;
            else
               newMarginY = gBrowser.tabContainer.boxObject.screenY - tabBoxObject.screenY + this.marginBottom;
            ind.style.marginBottom = newMarginY + "px";
         }
         ind.style.MozMarginStart = newMargin + "px";
         this.setFirefoxDropIndicator(true);
      }
    }

    this.dragmarkindex = newIndex;
  },

  clearDragmark: function minit_clearDragmark() {
    if (this.dragmarkindex == null)
      return;

    if (!TabmixSvc.TMPprefs.getBoolPref("useFirefoxDragmark")) {
      var index = this.dragmarkindex;
      if (index != gBrowser.tabs.length && gBrowser.tabs[index].hasAttribute("dragmark"))
         this.removetDragmarkAttribute(gBrowser.tabs[index]);
      if (index != 0 && gBrowser.tabs[index-1].hasAttribute("dragmark"))
         this.removetDragmarkAttribute(gBrowser.tabs[index-1]);
    }
    else
      this.setFirefoxDropIndicator(false);

    this.dragmarkindex = null;
  },

  setFirefoxDropIndicator: function (val) {
    var indicator = Tabmix.isVersion(40) ? gBrowser.tabContainer._tabDropIndicator : gBrowser.mTabDropIndicatorBar;
    indicator.collapsed = !val;
  },

  removetDragmarkAttribute: function (tab) {
    tab.removeAttribute("dragmark");
    if (tab.hasAttribute("faviconized")) {
      if (!Tabmix.isVersion(40)) {
        tab.maxWidth = null;
        tab.style.removeProperty("max-width");
      }
    }
    else if (!Tabmix.isVersion(40)) {
      tab.maxWidth = gBrowser.tabContainer.mTabMaxWidth;
      tab.style.maxWidth = tab.maxWidth + "px";
    }
  },

  setDragmarkAttribute: function (tab, markSide) {
    if (!Tabmix.isVersion(40)) {
      tab.maxWidth = tab.boxObject.width;
      tab.style.maxWidth = tab.maxWidth + "px";
    }
    tab.setAttribute("dragmark", markSide);
  },

  /*
   *  helper function for firefox 3.5+
   */
  _setEffectAllowedForDataTransfer: function minit_setEffectAllowed(aEvent, aDraggeType) {
    var dt = aEvent.dataTransfer;
    // Disallow dropping multiple items
    if (dt.mozItemCount > 1)
      return dt.effectAllowed = "none";

   var types = dt.mozTypesAt(0);
    // move or copy tab
    if (types[0] == TMP_TAB_DROP_TYPE) {
      var sourceNode = dt.mozGetDataAt(TMP_TAB_DROP_TYPE, 0);
      if (aDraggeType == this.DRAG_TAB_IN_SAME_WINDOW && aEvent.target == sourceNode) {
        return dt.effectAllowed = "none";
      }
      return dt.effectAllowed = "copyMove";
    }

    if (Tabmix.isVersion(40)) {
      if (browserDragAndDrop.canDropLink(aEvent)) {
        return dt.effectAllowed = dt.dropEffect = "link";
      }
    }
    else {
      for (var i = 0; i < gBrowser._supportedLinkDropTypes.length; i++) {
        if (types.contains(gBrowser._supportedLinkDropTypes[i])) {
          return dt.effectAllowed = dt.dropEffect = "link";
        }
      }
    }
    return dt.effectAllowed = "none";
  },

  retrieveURLFromData: function minit_retrieveURLFromData(aDataTransfer) {
    for (var i=0; i < gBrowser._supportedLinkDropTypes.length; i++) {
      var dataType = gBrowser._supportedLinkDropTypes[i];
      var isURLList = dataType == "text/uri-list";
      var urlData = isURLList ?
                      aDataTransfer.mozGetDataAt("URL", 0) : aDataTransfer.mozGetDataAt(dataType, 0);
      if (urlData)
        return transferUtils.retrieveURLFromData(urlData, isURLList ? "text/plain" : dataType);
    }
    return null;
  }

} // TMP_tabDNDObserver end

function TMP_goButtonClick(aEvent) {
  if (aEvent.button == 1 && gURLBar.value == gBrowser.currentURI.spec)
    gBrowser.duplicateTab(gBrowser.mCurrentTab);
  else if (aEvent.button != 2)
    gURLBar.handleCommand(aEvent);
}

function TMP_BrowserHome() {
   var homePage = gHomeButton.getHomePage();
   if (TMP_whereToOpen(false).inNew) {
     TMP_loadTabs(homePage.split("|"), false);
   }
  else {
    loadOneOrMoreURIs(homePage);
    gBrowser.tabContainer.ensureTabIsVisible(gBrowser.mCurrentTab._tPos);
  }
}

function TMP_loadTabs(aURIs, aReplace) {
  let bgLoad = TabmixSvc.prefs.getBoolPref("browser.tabs.loadInBackground");
  try {
    gBrowser.loadTabs(aURIs, bgLoad, aReplace);
  } catch (ex) { }
  // not in use for Firefox 3.7+
  gBrowser.tabContainer.nextTab = 1;
}

var TMP_undocloseTabButtonObserver = {
  onDragOver: function (aEvent, aFlavour, aDragSession) {
    var dt = aEvent.dataTransfer;
    var sourceNode = TMP_getSourceNode(dt, aDragSession);
    if (!sourceNode || sourceNode.localName != "tab") {
      dt.effectAllowed = "none";
      return true;
    }

    if (Tabmix.isVersion(40))
      aEvent.preventDefault();
    var label = TabmixSvc.getString("droptoclose.label");
    var statusTextFld = document.getElementById("statusbar-display");
    if (statusTextFld)
      statusTextFld.label = label;
    else {
      let tooltip = document.getElementById("tabmix-tooltip");
      if (tooltip.state == "closed") {
        tooltip.label = label;
        tooltip.openPopup(aEvent.target, "before_start", -1, -1, false, false);
      }
    }

    aEvent.target.setAttribute("dragover", "true");
    return true;
  },

  onDragExit: function (aEvent, aDragSession) {
    if (aEvent.target.hasAttribute("dragover")) {
      var statusTextFld = document.getElementById("statusbar-display");
      if (statusTextFld)
        statusTextFld.label = "";
      else
        document.getElementById("tabmix-tooltip").hidePopup();

      aEvent.target.removeAttribute("dragover");
    }
  },

  onDrop: function (aEvent, aXferData, aDragSession) {
    var sourceNode = TMP_getSourceNode(aEvent.dataTransfer, aDragSession);
    if (sourceNode && sourceNode.localName == "tab")
      // let tabbrowser drag event time to end before we remove the sourceNode
      setTimeout( function (b, aTab) {b.removeTab(aTab, {animate: true});}, 0, gBrowser, sourceNode);

    if (Tabmix.isVersion(40))
      this.onDragExit(aEvent);
  },

  /* for Firefox 3.5-3.6 */
  getSupportedFlavours: function () {
    var flavourSet = new FlavourSet();
    flavourSet.appendFlavour(TMP_TAB_DROP_TYPE);
    flavourSet.appendFlavour("text/x-moz-url");
    flavourSet.appendFlavour("text/unicode");
    return flavourSet;
  }
}

/*
 *  helper function for firefox 3.5+
 */
function TMP_getSourceNode(aDataTransfer, aSession) {
  var types = aDataTransfer.mozTypesAt(0);
  if (types[0] == TMP_TAB_DROP_TYPE)
    return aDataTransfer.mozGetDataAt(TMP_TAB_DROP_TYPE, 0);
  return null;
}

function TMP_whereToOpen(pref, altKey) {
   var aTab = gBrowser.mCurrentTab;
   var isBlankTab = gBrowser.isBlankNotBusyTab(aTab);
   var isLockTab = !isBlankTab && aTab.hasAttribute("locked");

   var openTabPref = typeof(pref) == "string" ? TabmixSvc.prefs.getBoolPref(pref) : pref;
   if (typeof(altKey) != "undefined") {
      // don't reuse balnk tab if the user press alt key when the pref is to open in current tab
      if (altKey && !openTabPref)
         isBlankTab = false;

      // see bug 315034 If search is set to open in a new tab,
      // Alt+Enter should open the search result in the current tab
      // so here we reverse the pref if user press Alt key
      openTabPref = (altKey ^ openTabPref) == 1;
   }
   return { inNew: !isBlankTab && (isLockTab || openTabPref), lock: isLockTab };
}

function TMP_setStripVisibilityTo(aShow) {
   if (Tabmix.isVersion(40))
     gBrowser.tabContainer.visible = aShow
   else
     gBrowser.mStrip.collapsed = !aShow;
}

var TMP_TabView = {
  init: function (tabBar) {
    this._patchBrowserTabview();
    TabmixSessionManager.tabViewEnabled = true; // for Firefox 3.5-3.6.x
    this.tabViewEnabled = true;
    var selectedGroupTabs = "this.tabbrowser.visibleTabs";
    var gBrowserVisibleTabs = "gBrowser.visibleTabs";

    function setGetter(aGetter) {
      let _getter = tabBar.__lookupGetter__(aGetter);
      Tabmix.newCode(null, _getter)._replace("this.childNodes", selectedGroupTabs
      )._replace( // for lastTabVisible
        'return this.isTabVisible(index);',
        'index = tabs[index]._tPos;\
        $&', {check: aGetter == "lastTabVisible"}
      )._replace('var tabbrowser = document.getBindingParent(this);', '', {check: aGetter != "topTabY"}
      )._replace('tabbrowser._removingTabs.length', 'false && tabbrowser._removingTabs.length', {check: aGetter != "topTabY"}
      )._replace('{', '{try {'
      )._replace(
      /(\})(\)?)$/,
      '} catch (ex) {Tabmix.log("index " + index + "\\nthis.collapsedTabs " + this.collapsedTabs); Tabmix.assert(ex); return null;} \
      $1$2'
      ).toGetter(tabBar, aGetter);
    }

    setGetter("topTabY");

    tabBar.tabbrowser.__defineGetter__("visibleTabsFirstChild", function() {
      var tabs = this.tabs;
      for (let i = 0; i < tabs.length; i++){
        let tab = tabs[i];
        if (!tab.hidden && this._removingTabs.indexOf(tab) == -1)
          return tab;
      }
      return this.mCurrentTab;
    });

    tabBar.tabbrowser.__defineGetter__("visibleTabsLastChild", function() {
      // we only need the last visible tab,
      // find it directly instead of using this.visibleTabs
      var tabs = this.tabs;
      for (let i = tabs.length - 1; i >= 0; i--){
        let tab = tabs[i];
        if (!tab.hidden && this._removingTabs.indexOf(tab) == -1)
          return tab;
      }
      return this.mCurrentTab;
    });

    // Both lastTabRowNumber and topTabY call tabbrowser.visibleTabs
    // calculate topTabY inside lastTabRowNumber
    tabBar.__defineGetter__("lastTabRowNumber", function _lastTabRowNumber() {
      let tabs = this.tabbrowser.visibleTabs;
      // if we have a pinned tab use first tab as top tab
      let index = tabs[0].pinned ? 0 : this.collapsedTabs;
      let topTab = tabs[index] || tabs[0];
      let topTabY = topTab.getBoundingClientRect().width ?
              topTab.boxObject.y - TMP_getStyle(topTab, "marginTop") : this.boxObject.y;
      return this.getTabRowNumber(tabs[tabs.length - 1], topTabY);
    });

    // replace gBrowser.tabContainer.lastChild with current group lastChild
    var selectedGroupLastChild = "this.tabbrowser.visibleTabsLastChild";
    var gBrowserVisibleTabsLastChild = "gBrowser.visibleTabsLastChild";
    Tabmix.newCode("gBrowser.tabContainer.adjustNewtabButtonvisibility", tabBar.adjustNewtabButtonvisibility)._replace(
      'lastTab.previousSibling;',
      'TMP_TabView.previousVisibleSibling(lastTab);'
    )._replace(
      'this.lastChild', selectedGroupLastChild
    ).toCode();

    Tabmix.newCode("gBrowser.tabContainer.adjustScrollTabsRight", tabBar.adjustScrollTabsRight)._replace(
      'this.childNodes', selectedGroupTabs
    ).toCode();

    Tabmix.newCode("gBrowser.tabContainer.rowScroll", tabBar.rowScroll)._replace("this.childNodes", selectedGroupTabs).toCode();

    var _getter = tabBar.__lookupGetter__("collapsedTabs");
    var _setter = tabBar.__lookupSetter__("collapsedTabs");
    tabBar.__defineGetter__("collapsedTabs", _getter);
    Tabmix.newCode(null, _setter)._replace("this.childNodes", selectedGroupTabs).toSetter(tabBar, "collapsedTabs");

    // only allow to show tabs from the current group
    Tabmix.newCode("gBrowser.tabContainer.isTabVisible", tabBar.isTabVisible)._replace(
      'this.childNodes', selectedGroupTabs
    )._replace(
      '{',
      '{aIndex = TMP_TabView.getIndexInVisibleTabsFrom_tPos(aIndex);'
    ).toCode();

    Tabmix.newCode("gBrowser.tabContainer.ensureTabIsVisible", tabBar.ensureTabIsVisible)._replace(
      'this.childNodes', selectedGroupTabs
    )._replace(
      'const tabs',
      'aIndex = TMP_TabView.getIndexInVisibleTabsFrom_tPos(aIndex); $&'
    ).toCode();

    Tabmix.newCode("gBrowser.tabContainer._notifyBackgroundTab", tabBar._notifyBackgroundTab)._replace(
      'aTab._tPos >= this.collapsedTabs',
      'TMP_TabView.getIndexInVisibleTabsFromTab(aTab) >= this.collapsedTabs'
    )._replace(
      'this.selectedIndex >= this.collapsedTabs',
      'TMP_TabView.getIndexInVisibleTabsFrom_tPos(this.selectedIndex) >= this.collapsedTabs'
    ).toCode();

    // make scrool button show hidden tabs only from the current group
    Tabmix.newCode("TabmixAllTabs.createCommonList", TabmixAllTabs.createCommonList)._replace(
      'gBrowser.tabs', gBrowserVisibleTabs, {flags: "g"}
    )._replace(
      'this.createMenuItems(popup, tab, i, aType);',
      'if  (tab.hidden) continue; \
      $&'
    ).toCode();

    Tabmix.newCode("TMP_Places.openGroup", TMP_Places.openGroup)._replace("tabBar.childNodes", gBrowserVisibleTabs).toCode();

    // we need to get tab position in the group before it get removed
    Tabmix.newCode("TMP_eventListener.onTabClose", TMP_eventListener.onTabClose)._replace(
      'var tab = aEvent.target;',
      '$& \
       tab._tPosInGroup = TMP_TabView.getTabPosInCurrentGroup(tab);'
    ).toCode();

    Tabmix.newCode("TMP_eventListener.onTabClose_updateTabBar", TMP_eventListener.onTabClose_updateTabBar)._replace(
      '{',
      '$& \
       if (aTab._tPosInGroup == -1) return;'
    )._replace(
      'lastTab.previousSibling',
      'TMP_TabView.previousVisibleSibling(lastTab)'
    )._replace(
      'tabBar.lastChild', gBrowserVisibleTabsLastChild
    )._replace(
      'aTab._tPos < tabBar.collapsedTabs',
      'aTab._tPosInGroup <  tabBar.collapsedTabs', {flags: "g"}
    ).toCode();

    Tabmix.newCode("TabmixTabbar._updateScrollLeft", TabmixTabbar._updateScrollLeft)._replace(
      'tabBar.childNodes', gBrowserVisibleTabs
    ).toCode();

    Tabmix.newCode("TMP_tabDNDObserver.onDragOver", TMP_tabDNDObserver.onDragOver)._replace(
      'this.getNewIndex(event)',
      'TMP_TabView._getDNDIndex(event)'
    ).toCode();

    Tabmix.newCode("TMP_tabDNDObserver.onDrop", TMP_tabDNDObserver.onDrop)._replace(
      'this.getNewIndex(event)',
      'TMP_TabView._getDNDIndex(event)'
    ).toCode();

    Tabmix.newCode("TMP_tabDNDObserver.onDragEnd", TMP_tabDNDObserver.onDragEnd)._replace('tabBar.childNodes', gBrowserVisibleTabs).toCode();

    Tabmix.newCode("TMP_tabDNDObserver.getNewIndex", TMP_tabDNDObserver.getNewIndex)._replace(
      'tabBar.childNodes', gBrowserVisibleTabs
    )._replace(
      'event.target._tPos',
      'TMP_TabView.getIndexInVisibleTabsFromTab(event.target)', {flags: "g"}
    )._replace(
      'isTabVisible(i)',
      'isTabVisible(tabs[i]._tPos)', {flags: "g"}
    ).toCode();

    Tabmix.newCode("TabmixTabbar.getRowHeight", TabmixTabbar.getRowHeight)._replace(
      'tabBar.childNodes', gBrowserVisibleTabs
    )._replace(
      'lastTab.previousSibling',
      'TMP_TabView.previousVisibleSibling(lastTab)'
    )._replace(
      'firstTab.nextSibling',
      'TMP_TabView.nextVisibleSibling(firstTab)'
    )._replace(
      'tabBar.lastChild', gBrowserVisibleTabsLastChild
    ).toCode();

    Tabmix.newCode("TabmixTabbar.widthChange", TabmixTabbar.widthChange)._replace(
      'gBrowser.tabs', gBrowserVisibleTabs
    )._replace(
      'tabBar.ensureTabIsVisible(index);',
      'tabBar.ensureTabIsVisible(tabs[index]._tPos);'
    )._replace(
      'tabBar.lastChild', gBrowserVisibleTabsLastChild
    ).toCode();

    Tabmix.newCode("TabmixProgressListener.onStateChange", TabmixProgressListener.onStateChange)._replace(
      'let tabsCount = this.mTabBrowser.tabContainer.childNodes.length - this.mTabBrowser._removingTabs.length;',
      'let tabsCount = this.mTabBrowser.visibleTabs.length;', {flags: "g"}
    ).toCode();

    var oldCode = 'var prev = tab.previousSibling, next = tab.nextSibling;';
    var newCode = 'var prev = TMP_TabView.previousVisibleSibling(tab), next = TMP_TabView.nextVisibleSibling(tab);'
    Tabmix.newCode("TabmixTabbar.updateBeforeAndAfter", TabmixTabbar.updateBeforeAndAfter)._replace(oldCode, newCode).toCode();
    Tabmix.newCode("TMP_eventListener.onTabSelect", TMP_eventListener.onTabSelect)._replace(oldCode, newCode).toCode();

    // we need to stop tabs slideShow before Tabview starts
    Tabmix.newCode("TabView.toggle", TabView.toggle)._replace(
      'this.show();',
      'if (Tabmix.SlideshowInitialized && Tabmix.flst.slideShowTimer) Tabmix.flst.cancel();\
       $&'
    ).toCode();

    Tabmix.newCode("TabmixTabbar.updateDisplayBlock", TabmixTabbar.updateDisplayBlock)._replace(
      'tabBar.lastChild', gBrowserVisibleTabsLastChild
    ).toCode();

  },

  checkTabs: function (tabs) {
    var firstTab;
    for (var i = 0; i < tabs.length; i++) {
      let tab = tabs[i];
      if (!tab.collapsed && !tab.pinned) {
        firstTab = tab;
        break;
      }
    }
    return firstTab;
  },

  previousVisibleSibling: function (aTab) {
    var tabs = gBrowser.visibleTabs;
    var index = tabs.indexOf(aTab);
    if (--index > -1)
      return tabs[index];
    return null;
  },

  nextVisibleSibling: function (aTab) {
    var tabs = gBrowser.visibleTabs;
    var index = tabs.indexOf(aTab);
    if (index > -1 && ++index < tabs.length)
      return tabs[index];
    return null;
  },

  // includung _removingTabs
  currentGroup: function () {
    return Array.filter(gBrowser.tabs, function(tab) !tab.hidden);
  },

  // visibleTabs don't include  _removingTabs
  getTabPosInCurrentGroup: function (aTab) {
    if (aTab) {
      let tabs = Array.filter(gBrowser.tabs, function(tab) !tab.hidden);
      return tabs.indexOf(aTab);
    }
    return -1;
  },

  getIndexInVisibleTabsFromTab: function (aTab) {
    if (aTab)
      return gBrowser.visibleTabs.indexOf(aTab);
    return -1;
  },

  getIndexInVisibleTabsFrom_tPos: function (aIndex) {
    return this.getIndexInVisibleTabsFromTab(gBrowser.tabs.item(aIndex));
  },

  // get _tPos from group index
  _getDNDIndex: function (aEvent) {
    var indexInGroup = TMP_tabDNDObserver.getNewIndex(aEvent);
    var lastIndex = gBrowser.visibleTabs.length - 1;
    if (indexInGroup < 0 || indexInGroup > lastIndex)
      indexInGroup = lastIndex;
    return gBrowser.visibleTabs[indexInGroup]._tPos;
  },


  /* ............... TabView Code Fix  ............... */

  /*
   * this code is fixes some bugs in Panorama code when restoring sessions
   *
   */

  _patchBrowserTabview: function SM__patchBrowserTabview(){
    // add missing function for compatibility
    if (!Tabmix.isVersion(60)) {
      TabView.updateGroupNumberBroadcaster = function TMP_updateGroupNumberBroadcaster(groupCount) {
        Tabmix.setItem("tabviewGroupsNumber", "groups", groupCount);
      }
    }
    // add our function to the TabView initFrameCallbacks
    // we don't need our patch for the first run
    let self = this;
    var callback = function callback_TMP_TabView_patchTabviewFrame() {
      try {
        TabmixSessionManager._groupItemPushAway();
        self._patchTabviewFrame();
      } catch (ex) { Tabmix.assert(ex);}
    }

    if (TabView._window)
      callback();
    else if (Tabmix.isVersion(60))
      TabView._initFrameCallbacks.push(callback);
    else {
      // for firefox 4.0 - 5.0.x
      window.addEventListener("tabviewframeinitialized", function tabmix_onInit() {
        window.removeEventListener("tabviewframeinitialized", tabmix_onInit, false);
        callback();
      }, false);
    }
  },

  _patchTabviewFrame: function SM__patchTabviewFrame(){
    if (Tabmix.isVersion(80)) {
      TabView._window.GroupItems._original_reconstitute = TabView._window.GroupItems.reconstitute;
      Tabmix.newCode("TabView._window.GroupItems.reconstitute", TabView._window.GroupItems.reconstitute)._replace(
       '"use strict";',
        <![CDATA[$&
        // Firefox 8.0 use strict mode - we need to map global variable
        let win = TabView._window;
        let GroupItem = win.GroupItem;
        let iQ = win.iQ;
        let UI = win.UI;
        let Utils = win.Utils;
        let GroupItems = win.GroupItems;
        ]]>, {check: Tabmix.isVersion(80)}
      )._replace(
        'this.',
        'GroupItems.', {flags: "g"}
      )._replace(
        'groupItem.userSize = data.userSize;',
        <![CDATA[
        // This group is re-used by session restore
        // make sure all of its children still belong to this group.
        // Do it before setBounds trigger data save that will overwrite
        // session restore data.
        groupItem.getChildren().forEach(function TMP_GroupItems_reconstitute_groupItem_forEach(tabItem) {
          var tabData = TabmixSessionData.getTabValue(tabItem.tab, "tabview-tab", true);
          if (!tabData || tabData.groupID != data.id) {
            // We call TabItems.resumeReconnecting later to reconnect this item
            tabItem._reconnected = false;
          }
        });
        $&]]>
      )._replace(
        // All remaining children in to-be-closed groups are re-used by
        // session restore. Mark them for recconct later by UI.reset
        // or TabItems.resumeReconnecting.
        //
        // we don't want tabItem without storage data to _reconnect at
        // this moment. Calling GroupItems.newTab before we set the
        // active group, can reconnect the tabItem to the wrong group!
        // also calling this.parent.remove form tabItem._reconnect
        // without dontArrange flag can cause unnecessary groupItem
        // and children arrang (we are about to close this group).
        'tabItem._reconnect();',
        ''
      ).toCode();
    }

    // add tab to the new group on tabs order not tabItem order
    TabView._window.UI._original_reset = TabView._window.UI.reset;
    Tabmix.newCode("TabView._window.UI.reset", TabView._window.UI.reset)._replace(
      '"use strict";',
      <![CDATA[$&
      // Firefox 8.0 use strict mode - we need to map global variable
      let win = TabView._window;
      let Trenches = win.Trenches;
      let Items = win.Items;
      let iQ = win.iQ;
      let Rect = win.Rect;
      let GroupItems = win.GroupItems;
      let GroupItem = win.GroupItem;
      let UI = win.UI;
      ]]>, {check: Tabmix.isVersion(80)}
    )._replace(
      'this.',
      'UI.', {flags: "g", silent: true, check: Tabmix.isVersion(80)}
    )._replace(
      'items = TabItems.getItems();',
      'items = gBrowser.tabs;'
    )._replace(
      'items.forEach(function (item) {',
      'Array.forEach(items, function(tab) { \
       let item = tab._tabViewTabItem;'
    )._replace(
      'groupItem.add(item, {immediately: true});',
      'item._reconnected = true; \
       $&'
    ).toCode();

    TabView._window.TabItems._original_resumeReconnecting = TabView._window.TabItems.resumeReconnecting;
    TabView._window.TabItems.resumeReconnecting = function TabItems_resumeReconnecting() {
      let TabItems = TabView._window.TabItems;
      let Utils = TabView._window.Utils;
      Utils.assertThrow(TabItems._reconnectingPaused, "should already be paused");
      TabItems._reconnectingPaused = false;
      Array.forEach(gBrowser.tabs, function (tab){
        let item = tab._tabViewTabItem;
        if (!item.__tabmix_reconnected) {
          item._reconnected = false;
          delete item.__tabmix_reconnected;
        }
        if (!item._reconnected)
          item._reconnect();
      });
    }
  },

  _resetTabviewFrame: function SM__resetTabviewFrame(){
    if (TabView._window) {
      if (Tabmix.isVersion(80)) {
        TabView._window.GroupItems.reconstitute = TabView._window.GroupItems._original_reconstitute;
        delete TabView._window.GroupItems._original_reconstitute;
      }
      TabView._window.UI.reset = TabView._window.UI._original_reset;
      TabView._window.TabItems.resumeReconnecting = TabView._window.TabItems._original_resumeReconnecting;
      delete TabView._window.UI._original_reset;
      delete TabView._window.TabItems._original_resumeReconnecting;
    }
  }

}