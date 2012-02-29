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
  TAB_DROP_TYPE: "application/x-moz-tabbrowser-tab",
  draggedTab: null,

  init: function TMP_tabDNDObserver_init() {
    this.setDragEvents(true);
    this.draglink = TabmixSvc.getString("droplink.label");

    // without this the Indicator is not visible on the first drag
    var ind = gBrowser.tabContainer._tabDropIndicator;
    ind.style.MozTransform = "translate(0px, 0px)";
    // style flush to prevent the window from flicker on startup
    ind.clientTop;
  },

  setDragEvents: function TMP_setDragEvents(atStart) {
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
    this._dragOverDelay = gBrowser.tabContainer._dragOverDelay;
    this.paddingLeft  = Tabmix.getStyle(gBrowser.tabContainer, "paddingLeft");
  },

  _handleDragover: function (aEvent) {
    var tabBar = gBrowser.tabContainer;
    if (!tabBar.tabmix_useDefaultDnD && tabBar.orient == "horizontal")
      TMP_tabDNDObserver.onDragOver(aEvent);
  },

  onDragStart: function (event) {
    // we get here on capturing phase before "tabbrowser-close-tab-button"
    // binding stop the event propagation
    if (event.originalTarget.getAttribute("anonid") == "tmp-close-button") {
      event.stopPropagation();
      return;
    }

    var tab = gBrowser.tabContainer._getDragTargetTab(event);
    if (!tab)
      return;

    this.draggedTab = tab;
    tab.setAttribute("dragged", true);
    gBrowser.tabContainer.removeShowButtonAttr();

    let dt = event.dataTransfer;
    dt.mozSetDataAt(TAB_DROP_TYPE, tab, 0);
    let uri = gBrowser.getBrowserForTab(tab).currentURI;
    let spec = uri ? uri.spec : "about:blank";

    // We must not set text/x-moz-url or text/plain data here,
    // otherwise trying to deatch the tab by dropping it on the desktop
    // may result in an "internet shortcut"
    dt.mozSetDataAt("text/x-moz-text-internal", spec, 0);

    // Set the cursor to an arrow during tab drags.
    dt.mozCursor = "default";

    let canvas = tabPreviews.capture(tab, false);
    let offset = TabmixTabbar.position == 1 ? canvas.height + 10 : -37
    dt.setDragImage(canvas, 0, offset);

    if (Tabmix.isVersion(70)) {
      // _dragOffsetX/Y give the coordinates that the mouse should be
      // positioned relative to the corner of the new window created upon
      // dragend such that the mouse appears to have the same position
      // relative to the corner of the dragged tab.
      function clientX(ele) ele.getBoundingClientRect().left;
      let tabOffsetX = clientX(tab) -
                       clientX(gBrowser.tabs[0].pinned ? gBrowser.tabs[0] : gBrowser.tabContainer);
      tab._dragOffsetX = event.screenX - window.screenX - tabOffsetX;
      tab._dragOffsetY = event.screenY - window.screenY;
    }

    event.stopPropagation();
  },

  onDragOver: function minit_onDragOver(event) {
    var dt = event.dataTransfer;
    var tabBar = gBrowser.tabContainer;

    var sourceNode = this.getSourceNode(dt);
    var draggeType = this.getDragType(sourceNode);
    var newIndex = this._getDNDIndex(event);
    var oldIndex = draggeType != this.DRAG_LINK ? sourceNode._tPos : -1;
    var left_right; // 1:right, 0: left, -1: drop link on tab to replace tab
///XXX check if we need here visibleTabs insteadof gBrowser.tabs
///    check with groups with or without pinned tabs
    if (newIndex < gBrowser.tabs.length)
      left_right = this.getLeft_Right(event, newIndex, oldIndex, draggeType);
    else {
      newIndex = draggeType != this.DRAG_TAB_IN_SAME_WINDOW && Tabmix.getOpenTabNextPref(draggeType == this.DRAG_LINK) ? tabBar.selectedIndex :
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
          var url = browserDragAndDrop.drop(event, { });
          if (!url || !url.length || url.indexOf(" ", 0) != -1 ||
              /^\s*(javascript|data):/.test(url))
            url = null;

          var disAllowDrop = url ? !Tabmix.contentAreaClick.isUrlForDownload(url) : true;
        } catch (ex) { Tabmix.assert(ex);}

        if (disAllowDrop)
          dt.effectAllowed = "none";
      }
    }

    var canDrop;
    var hideIndicator = false;
    if (effects == "") {
      this.clearDragmark();
      gBrowser.tabContainer._continueScroll(event);
      return;
    }
    canDrop = effects != "none";
    if (canDrop && !isCopy && draggeType == this.DRAG_TAB_IN_SAME_WINDOW && oldIndex == newIndex) {
      canDrop = false;
      dt.effectAllowed = "none";
    }
    // if we don't set effectAllowed to none then the drop indicator stay
    else if (TabmixTabbar.scrollButtonsMode == TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT &&
               gBrowser.tabs[0].pinned && event.screenX < gBrowser.tabs[0].boxObject.screenX) {
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

    if (tabBar.overflow) {
      let tabStrip = tabBar.mTabstrip;
      let ltr = Tabmix.ltr || tabStrip.orient == "vertical";
      let _scroll, targetAnonid;
      if (TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_HIDDEN) // scroll with button
        targetAnonid = event.originalTarget.getAttribute("anonid");
      // scroll without button
      else if (event.screenX <= tabStrip.scrollBoxObject.screenX)
        targetAnonid = ltr ? "scrollbutton-up" : "scrollbutton-down";
      else if(event.screenX >= (tabStrip.scrollBoxObject.screenX + tabStrip.scrollBoxObject.width))
        targetAnonid = ltr ? "scrollbutton-down" : "scrollbutton-up";
      switch (targetAnonid) {
        case "scrollbutton-up":
        case "scrollbutton-up-right":
          if (tabBar.canScrollTabsLeft)
            _scroll = -1;
            break;
        case "scrollbutton-down":
        case "scrollbutton-down-right":
          if (tabBar.canScrollTabsRight)
            _scroll = 1;
            break;
      }
      if (_scroll) {
        let scrollIncrement = TabmixTabbar.isMultiRow ? Math.round(tabStrip._singleRowHeight / 6) : tabStrip.scrollIncrement;
        tabStrip.scrollByPixels((ltr ? _scroll : -_scroll) * scrollIncrement, true);
        hideIndicator = true;
      }
    }

    if (draggeType == this.DRAG_LINK) {
      let tab;
      tab = tabBar._getDragTargetTab(event);
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

  onDrop: function minit_onDrop(event) {
    this.clearDragmark();
    this.updateStatusField();
    var dt = event.dataTransfer;
    var sourceNode = this.getSourceNode(dt);
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

    document.getElementById("tabmix-tooltip").hidePopup();
    // old TreeStyleTab extension version look for isTabReorder in our code
    var isTabReorder = draggeType == this.DRAG_TAB_IN_SAME_WINDOW
    var newIndex = this._getDNDIndex(event);
    var oldIndex = draggedTab ? draggedTab._tPos : -1;
    var left_right;

    if (newIndex < gBrowser.tabs.length)
      left_right = this.getLeft_Right(event, newIndex, oldIndex, draggeType);
    else {
      newIndex = draggeType != this.DRAG_TAB_IN_SAME_WINDOW && Tabmix.getOpenTabNextPref(draggeType == this.DRAG_LINK) ? gBrowser.tabContainer.selectedIndex :
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

        let numPinned = gBrowser._numPinnedTabs;
        if (draggedTab.pinned) {
          if (newIndex >= numPinned)
            gBrowser.unpinTab(draggedTab);
        } else {
          if (newIndex <= numPinned - 1 || (newIndex == numPinned && dt.__pinTab))
            gBrowser.pinTab(draggedTab);
        }
        if (newIndex != draggedTab._tPos)
          gBrowser.moveTabTo(draggedTab, newIndex);

        if (gBrowser.tabContainer.hasAttribute("multibar"))
          TabmixTabbar.updateScrollStatus();
      }

      gBrowser.tabContainer.mTabstrip.ensureElementIsVisible(gBrowser.tabs.item(newIndex));
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

      Tabmix.copyTabData(newTab, draggedTab);
      gBrowser.swapBrowsersAndCloseOther(newTab, draggedTab);

      // We need to set selectedTab after we've done
      // swapBrowsersAndCloseOther, so that the updateCurrentBrowser
      // it triggers will correctly update our URL bar.
      gBrowser.selectedTab = newTab;
    }
    else {
      var url = browserDragAndDrop.drop(event, { });
      // valid urls don't contain spaces ' '; if we have a space it isn't a valid url.
      // Also disallow dropping javascript: or data: urls--bail out
      if (!url || !url.length || url.indexOf(" ", 0) != -1 ||
         /^\s*(javascript|data):/.test(url))
         return;

      var bgLoad = true;
      try {
        bgLoad = TabmixSvc.prefs.getBoolPref("browser.tabs.loadInBackground");
      }
      catch (e) { }

      if (event.shiftKey)
        bgLoad = !bgLoad; // shift Key reverse the pref

      url = getShortcutOrURI(url);
      var tab = null;
      if (left_right > -1 && !Tabmix.contentAreaClick.isUrlForDownload(url)) {
        // We're adding a new tab.
         try {
            tab = gBrowser.addTab(url);
            gBrowser.moveTabTo(tab, newIndex + left_right);
         } catch(ex) {
            // Just ignore invalid urls
            Tabmix.log("addTab\n" + ex);
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
        }
      }
      if (gBrowser.mCurrentTab != tab)
        gBrowser.TMP_selectNewForegroundTab(tab, bgLoad, url);
    }
    if (draggedTab) {
      if (Tabmix.isVersion(70)) {
        delete draggedTab._dragOffsetX;
        delete draggedTab._dragOffsetY;
      }
      draggedTab.removeAttribute("dragged", true);
    }
  },

  onDragEnd: function minit_onDragEnd(aEvent) {
    // see comment in gBrowser.tabContainer.dragEnd
    var dt = aEvent.dataTransfer;
    if (dt.mozUserCancelled || dt.dropEffect != "none")
      return;

    this.clearDragmark(aEvent);
    if (this.draggedTab) {
      this.draggedTab.removeAttribute("dragged", true);
      this.draggedTab = null;
    }

    // don't allow to open new window in single window mode
    if (Tabmix.singleWindowMode && gBrowser.tabs.length > 1) {
      aEvent.stopPropagation();
      return;
    }
    // Disable detach within the browser toolbox
    var eX = aEvent.screenX;
    var wX = window.screenX;
    // check if the drop point is horizontally within the window
    if (eX > wX && eX < (wX + window.outerWidth)) {
      // also avoid detaching if the the tab was dropped too close to
      // the tabbar (half a tab)
      var tabBar = gBrowser.tabContainer;
      var bo = tabBar.mTabstrip.scrollBoxObject;
      var rowHeight = TabmixTabbar.singleRowHeight;
      var endScreenY = bo.screenY + bo.height + 0.5 * rowHeight;
      var eY = aEvent.screenY;
      if (TabmixTabbar.position == 0) {// tabbar on the top
        if (eY < endScreenY && eY > window.screenY) {
          aEvent.stopPropagation();
          return;
        }
      }
      else {// bottom
        var tb = gNavToolbox.boxObject;
        var toolboxEndScreenY = tb.screenY + tb.height;
        var startScreenY = bo.screenY - 0.5 * rowHeight;
        if ((eY > startScreenY && eY < endScreenY) || eY < toolboxEndScreenY) {
          aEvent.stopPropagation();
          return;
        }
      }
    }

    // we copy this code from gBrowser.tabContainer dragend handler
    // for the case tabbar is on the bottom
    var draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
    // screen.availLeft et. al. only check the screen that this window is on,
    // but we want to look at the screen the tab is being dropped onto.
    var sX = {}, sY = {}, sWidth = {}, sHeight = {};
    Cc["@mozilla.org/gfx/screenmanager;1"]
      .getService(Ci.nsIScreenManager)
      .screenForRect(eX, eY, 1, 1)
      .GetAvailRect(sX, sY, sWidth, sHeight);
    // ensure new window entirely within screen
    var winWidth = Math.min(window.outerWidth, sWidth.value);
    var winHeight = Math.min(window.outerHeight, sHeight.value);
    var left = Math.min(Math.max(eX - draggedTab._dragOffsetX, sX.value),
                          sX.value + sWidth.value - winWidth);
    var top = Math.min(Math.max(eY - draggedTab._dragOffsetY, sY.value),
                        sY.value + sHeight.value - winHeight);

    delete draggedTab._dragOffsetX;
    delete draggedTab._dragOffsetY;

    if (gBrowser.tabs.length == 1) {
      // resize _before_ move to ensure the window fits the new screen.  if
      // the window is too large for its screen, the window manager may do
      // automatic repositioning.
      window.resizeTo(winWidth, winHeight);
      window.moveTo(left, top);
      window.focus();
    } else {
      gBrowser.replaceTabWithWindow(draggedTab, {screenX: left,
                                                 screenY: top,
                                                });
    }
    aEvent.stopPropagation();
  },

  onDragExit: function minit_onDragExit(event) {
    event.stopPropagation();
    this._dragTime = 0;

    var target = event.relatedTarget;
    while (target && target.localName != "tabs")
      target = target.parentNode;
    if (target)
      return;

    this.clearDragmark();
    if (this.draggedTab) {
      this.draggedTab.removeAttribute("dragged", true);
      this.draggedTab = null;
    }
    gBrowser.tabContainer._continueScroll(event);
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

  // get _tPos from group index
  _getDNDIndex: function (aEvent) {
    var indexInGroup = this.getNewIndex(aEvent);
    var tabs = gBrowser.visibleTabs;
    var lastIndex = tabs.length - 1;
    if (indexInGroup < 0 || indexInGroup > lastIndex)
      indexInGroup = lastIndex;
    return tabs[indexInGroup]._tPos;
  },

  getNewIndex: function (event) {
    function getTabRowNumber(tab, top) tab.pinned ? 1 : gBrowser.tabContainer.getTabRowNumber(tab, top);
    // if mX is less then the first tab return 0
    // check if mY is below the tab.... if yes go to next row
    // in the row find the closest tab by mX,
    // if no tab is match return gBrowser.tabs.length
    var mX = event.screenX, mY = event.screenY;
    var tabBar = gBrowser.tabContainer;
    var tabs = gBrowser.visibleTabs;
    var numTabs = tabs.length;
    if (!tabBar.hasAttribute("multibar")) {
      for (let i = event.target.localName == "tab" ? TMP_TabView.getIndexInVisibleTabsFromTab(event.target) : 0; i < numTabs; i++) {
        let tab = tabs[i];
        if (Tabmix.compare(mX, Tabmix.itemEnd(tab, Tabmix.ltr), Tabmix.ltr))
          return i;
      }
    }
    else {
      let top = tabBar.topTabY;
      for (let i = 0; i < numTabs; i++) {
        let tab = tabs[i];
        let thisRow = getTabRowNumber(tab, top);
        if (mY >= tab.boxObject.screenY + tab.boxObject.height) {
          while (i < numTabs - 1 && getTabRowNumber(tabs[i+1], top) == thisRow)
            i++;
        }
        else if (Tabmix.compare(mX, Tabmix.itemEnd(tab, Tabmix.ltr), Tabmix.ltr))
          return i;
        else if (i == numTabs - 1 || getTabRowNumber(tabs[i+1], top) != thisRow)
          return i;
      }
    }
    return numTabs;
  },

  getLeft_Right: function (event, newIndex, oldIndex, draggeType) {
   var mX = event.screenX;
   var left_right;
   var tab = gBrowser.tabs[newIndex];
   var tabBo = tab.boxObject;
   var ltr = Tabmix.ltr;
   var _left = ltr ? 0 : 1;
   var _right = ltr ? 1 : 0;

   var isCtrlKey = ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey);
   var lockedTab = tab.getAttribute("locked") && !gBrowser.isBlankNotBusyTab(tab);
   if ((draggeType == this.DRAG_LINK && lockedTab) || (draggeType == this.DRAG_LINK && !lockedTab && !isCtrlKey)) {
      left_right = (mX < tabBo.screenX + tabBo.width / 4) ? _left : _right;
      if (left_right == _right && mX < tabBo.screenX + tabBo.width * 3 / 4 )
         left_right = -1;
   }
   else {
      left_right = (mX < tabBo.screenX + tabBo.width / 2) ? _left : _right;
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
    if (this.dragmarkindex && this.dragmarkindex.newIndex == newIndex &&
        gBrowser.tabs[this.dragmarkindex.index].pinned == gBrowser.tabs[index].pinned)
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
      var ind = gBrowser.tabContainer._tabDropIndicator;
      var minMargin, maxMargin, newMargin;
      var tabBoxObject, tabRect;
      var ltr = Tabmix.ltr;
      let scrollRect = gBrowser.tabContainer.mTabstrip.scrollClientRect;
      let rect = gBrowser.tabContainer.getBoundingClientRect();
      let scrollMode = TabmixTabbar.scrollButtonsMode;
      let paddingLeft = !gBrowser.tabContainer.overflow ||
                        scrollMode == TabmixTabbar.SCROLL_BUTTONS_HIDDEN ||
                        scrollMode == TabmixTabbar.SCROLL_BUTTONS_MULTIROW ||
                        (scrollMode == TabmixTabbar.SCROLL_BUTTONS_RIGHT &&
                         !TabmixSvc.TMPprefs.getBoolPref("tabBarSpace")) ? this.paddingLeft : 0;
      minMargin = scrollRect.left - rect.left - paddingLeft;
      maxMargin = Math.min(minMargin + scrollRect.width, scrollRect.right);
      if (!ltr)
         [minMargin, maxMargin] = [gBrowser.clientWidth - maxMargin, gBrowser.clientWidth - minMargin];

      tabRect = gBrowser.tabs[index].getBoundingClientRect();
      if (ltr)
         newMargin = tabRect.left - rect.left  + (left_right == 1 ? tabRect.width + this.LinuxMarginEnd: 0) - paddingLeft;
      else
         newMargin = rect.right - tabRect.left - (left_right == 0 ? tabRect.width + this.LinuxMarginEnd : 0);

///XXX fix min/max x margin when in one row the drag mark is visible after the arrow when the last tab is partly visible
///XXX look like the same is happen with Firefox
      var newMarginY;
      if (TabmixTabbar.position == 1) {
        newMarginY = tabRect.bottom - ind.parentNode.getBoundingClientRect().bottom;
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

    this.dragmarkindex = {newIndex: newIndex, index: index};
  },

  clearDragmark: function minit_clearDragmark() {
    if (this.dragmarkindex == null)
      return;

    if (!TabmixSvc.TMPprefs.getBoolPref("useFirefoxDragmark")) {
      var index = this.dragmarkindex.newIndex;
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
    gBrowser.tabContainer._tabDropIndicator.collapsed = !val;
  },

  removetDragmarkAttribute: function (tab) {
    tab.removeAttribute("dragmark");
  },

  setDragmarkAttribute: function (tab, markSide) {
    tab.setAttribute("dragmark", markSide);
  },

  /*
   *  helper functions
   */
  _setEffectAllowedForDataTransfer: function minit_setEffectAllowed(aEvent, aDraggeType) {
    var dt = aEvent.dataTransfer;
    // Disallow dropping multiple items
    if (dt.mozItemCount > 1)
      return dt.effectAllowed = "none";

   var types = dt.mozTypesAt(0);
    // move or copy tab
    if (types[0] == this.TAB_DROP_TYPE) {
      var sourceNode = dt.mozGetDataAt(this.TAB_DROP_TYPE, 0);
      if (aDraggeType == this.DRAG_TAB_IN_SAME_WINDOW && aEvent.target == sourceNode) {
        return dt.effectAllowed = "none";
      }
      return dt.effectAllowed = "copyMove";
    }

    if (browserDragAndDrop.canDropLink(aEvent)) {
      return dt.effectAllowed = dt.dropEffect = "link";
    }
    return dt.effectAllowed = "none";
  },

  getSourceNode: function TMP_getSourceNode(aDataTransfer) {
    var types = aDataTransfer.mozTypesAt(0);
    if (types[0] == this.TAB_DROP_TYPE)
      return aDataTransfer.mozGetDataAt(this.TAB_DROP_TYPE, 0);
    return null;
  }

} // TMP_tabDNDObserver end

var TMP_undocloseTabButtonObserver = {
  onDragOver: function (aEvent, aFlavour, aDragSession) {
    var dt = aEvent.dataTransfer;
    var sourceNode = TMP_tabDNDObserver.getSourceNode(dt) || this.NEW_getSourceNode(dt);
    if (!sourceNode || sourceNode.localName != "tab") {
      dt.effectAllowed = "none";
      return true;
    }

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
    var dt = aEvent.dataTransfer;
    var sourceNode = TMP_tabDNDObserver.getSourceNode(dt) || this.NEW_getSourceNode(dt);
    if (sourceNode && sourceNode.localName == "tab")
      // let tabbrowser drag event time to end before we remove the sourceNode
      setTimeout( function (b, aTab) {b.removeTab(aTab, {animate: true});}, 0, gBrowser, sourceNode);

    this.onDragExit(aEvent);
  },

  //XXX we don't need it after bug 455694 (tab drag/detach animations) backed-out.
  // we leave it in case the code will change again.
  NEW_getSourceNode: function TMP_NEW_getSourceNode(aDataTransfer) {
    let node = aDataTransfer.mozSourceNode;
    while (node && node.localName != "tab" && node.localName != "tabs")
      node = node.parentNode;
    return node && node.localName == "tab" ? node : null;
  }
}

/* ::::::::::     miscellaneous     :::::::::: */

Tabmix.goButtonClick = function TMP_goButtonClick(aEvent) {
  if (aEvent.button == 1 && gURLBar.value == gBrowser.currentURI.spec)
    gBrowser.duplicateTab(gBrowser.mCurrentTab);
  else if (aEvent.button != 2)
    gURLBar.handleCommand(aEvent);
}

Tabmix.loadTabs = function TMP_loadTabs(aURIs, aReplace) {
  let bgLoad = TabmixSvc.prefs.getBoolPref("browser.tabs.loadInBackground");
  try {
    gBrowser.loadTabs(aURIs, bgLoad, aReplace);
  } catch (ex) { }
}

Tabmix.whereToOpen = function TMP_whereToOpen(pref, altKey) {
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

Tabmix.getStyle = function TMP_getStyle(aObj, aStyle) {
  try {
    return parseInt(window.getComputedStyle(aObj, null)[aStyle]) || 0;
  } catch (ex) {this.assert(ex);}
}

// sometimes context popup stay "open", we hide it manually.
Tabmix.hidePopup = function TMP_hidePopup(aPopupMenu) {
   var node = aPopupMenu.triggerNode;
   while (node && node.localName != "menubar" && node.localName != "toolbar") {
      if (node.localName == "menupopup" || node.localName == "popup") {
         if (node.hasAttribute("open")) node.removeAttribute("open");
         node.hidePopup();
      }
      node = node.parentNode;
   }
}

var TMP_TabView = {
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

  /* ............... TabView Code Fix  ............... */

  /*
   * this code is fixes some bugs in Panorama code when restoring sessions
   *
   */

  _patchBrowserTabview: function SM__patchBrowserTabview() {
    // we need to stop tabs slideShow before Tabview starts
    Tabmix.newCode("TabView.toggle", TabView.toggle)._replace(
      'this.show();',
      'if (Tabmix.SlideshowInitialized && Tabmix.flst.slideShowTimer) Tabmix.flst.cancel();\
       $&'
    ).toCode();

    // don't do anything if Session Manager extension installed
    if (Tabmix.extensions.sessionManager)
      return;

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
        '', {check: !Tabmix.isVersion(110)}
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
       if (tab.pinned) return;\
       let item = tab._tabViewTabItem;'
    )._replace(
      'groupItem.add(item, {immediately: true});',
      'item._reconnected = true; \
       $&'
    )._replace(
      /(\})(\)?)$/,
      <![CDATA[
        GroupItems.groupItems.forEach(function(group) {
          if (group != groupItem)
            group.close();
        });
       $1$2]]>
    ).toCode();

    TabView._window.TabItems._original_resumeReconnecting = TabView._window.TabItems.resumeReconnecting;
    TabView._window.TabItems.resumeReconnecting = function TabItems_resumeReconnecting() {
      let TabItems = TabView._window.TabItems;
      let Utils = TabView._window.Utils;
      Utils.assertThrow(TabItems._reconnectingPaused, "should already be paused");
      TabItems._reconnectingPaused = false;
      Array.forEach(gBrowser.tabs, function (tab){
        if (tab.pinned)
          return;
        let item = tab._tabViewTabItem;
        if ("__tabmix_reconnected" in item && !item.__tabmix_reconnected) {
          item._reconnected = false;
          delete item.__tabmix_reconnected;
        }
        if (!item._reconnected)
          item._reconnect();
      });
    }
  },

  _resetTabviewFrame: function SM__resetTabviewFrame(){
    if (!Tabmix.extensions.sessionManager && TabView._window) {
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

Tabmix.navToolbox = {
  customizeStarted: false,
  toolboxChanged: false,
  resetUI: false,

  init: function TMP_navToolbox_init() {
    this.updateToolboxItems();
    gNavToolbox.addEventListener("beforecustomization", this, false);
    gNavToolbox.addEventListener("aftercustomization", this, false);
  },

  deinit: function TMP_navToolbox_deinit() {
    gNavToolbox.removeEventListener("beforecustomization", this, false);
    gNavToolbox.removeEventListener("aftercustomization", this, false);
  },

  handleEvent: function TMP_navToolbox_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "beforecustomization":
        this.customizeStart();
        break;
      case "customizationchange":
        gNavToolbox.removeEventListener("customizationchange", this, false);
        this.toolboxChanged = true;
        break;
      case "aftercustomization":
        this.customizeDone(this.toolboxChanged);
        break;
    }
  },

  customizeStart: function TMP_navToolbox_customizeStart() {
    gNavToolbox.addEventListener("customizationchange", this, false);
    this.toolboxChanged = false;
    this.customizeStarted = true;
  },

  customizeDone: function TMP_navToolbox_customizeDone(aToolboxChanged) {
    gNavToolbox.removeEventListener("customizationchange", this, false);
    this.customizeStarted = false;

    if (aToolboxChanged)
      this.updateToolboxItems();

    // fix incompatibility with Personal Titlebar extension
    // the extensions trigger tabbar binding reset on toolbars customize
    // we need to init our ui settings again
    if (this.resetUI) {
      TabmixTabbar.visibleRows = 1;
      TabmixTabbar.updateSettings(false);
      this.resetUI = false;
    }
    else if (aToolboxChanged) {
      TabmixTabbar.updateScrollStatus();
      TabmixTabbar.updateBeforeAndAfter();
    }

    // if tabmix option dialog is open update visible buttons and set focus if needed
    var optionWindow = TabmixSvc.wm.getMostRecentWindow("mozilla:tabmixopt");
    if (optionWindow) {
      optionWindow.toolbarButtons(window);
      if ("_tabmixCustomizeToolbar" in optionWindow) {
        delete optionWindow._tabmixCustomizeToolbar;
        optionWindow.focus();
      }
    }
  },

  updateToolboxItems: function TMP_navToolbox_updateToolboxItems() {
    this.initializeURLBar();
    this.initializeSearchbar();
    this.toolbarButtons();
    this.initializeAlltabsPopup();
    this.initializeScrollButtons();
  },

  initializeURLBar: function TMP_navToolbox_initializeURLBar() {
    if (!gURLBar ||
        document.documentElement.getAttribute("chromehidden").indexOf("location") != -1 ||
        typeof gURLBar.handleCommand == "undefined")
      return;

    // onblur attribut reset each time we exit ToolboxCustomize
    var blur = gURLBar.getAttribute("onblur") || "";
    if (blur.indexOf("Tabmix.urlBarOnBlur") == -1)
      gURLBar.setAttribute("onblur", blur + "Tabmix.urlBarOnBlur();")

    // Fix incompatibility with Omnibar (O is not defined)
    // URL Dot 0.4.x extension
    let fn;
    let _Omnibar = "Omnibar" in window;
    if (_Omnibar && "intercepted_handleCommand" in gURLBar) {
      fn = "intercepted_handleCommand";
      Tabmix.newCode("gURLBar.handleCommand", gURLBar.handleCommand)._replace(
        'O.handleSearchQuery',
        'window.Omnibar.handleSearchQuery', {silent: true}
      ).toCode();
    }
    else if ("urlDot" in window && "handleCommand2" in gURLBar)
      fn = "handleCommand2";
    else
      fn = "handleCommand"
    let _handleCommand = fn in gURLBar ? gURLBar[fn].toString() : "Tabmix.browserLoadURL";

    // fix incompability with https://addons.mozilla.org/en-US/firefox/addon/instantfox/
    // instantfox uses pre-Firefox 10 version of handleCommand
    var testVersionString = "if (aTriggeringEvent instanceof MouseEvent) {";
    var pre10Version = !Tabmix.isVersion(100) || typeof(InstantFox) == "object" &&
        _handleCommand.indexOf(testVersionString) > -1;
    var TMP_fn = !pre10Version ? "Tabmix.whereToOpen" : "Tabmix.browserLoadURL";

    if (_handleCommand.indexOf(TMP_fn) > -1)
      return;

    // set altDisabled if Suffix extension installed
    // dont use it for Firefox 6.0+ until new Suffix extension is out
    let fixedHandleCommand = Tabmix.newCode("gURLBar." + fn,  _handleCommand)._replace(
      '{',
      '{ var _data, altDisabled = false; \
       if (gBrowser.tabmix_tab) {\
         delete gBrowser.tabmix_tab;\
         delete gBrowser.tabmix_userTypedValue;\
       }'
    )._replace(
      'this._canonizeURL(aTriggeringEvent);',
      '_data = $& \
       altDisabled = _data.length == 3;', {check: !Tabmix.isVersion(60)}
    )._replace(
      testVersionString,
      'let _mayInheritPrincipal = typeof(mayInheritPrincipal) == "boolean" ? mayInheritPrincipal : true;\
       Tabmix.browserLoadURL(aTriggeringEvent, postData, altDisabled, url, _mayInheritPrincipal); \
       return; \
       $&', {check: pre10Version}
    );

   /* Starting with firefx 10 we are not using Tabmix.browserLoadURL
    * we don't do anything regarding IeTab and URL Suffix extensions
    */
    if (!pre10Version) {
      fixedHandleCommand = fixedHandleCommand._replace(
        'if (isMouseEvent || altEnter) {',
        'let loadNewTab = Tabmix.whereToOpen("extensions.tabmix.opentabfor.urlbar", altEnter).inNew && !(/^ *javascript:/.test(url));\
         if (isMouseEvent || altEnter || loadNewTab) {'
      )._replace(
        // always check whereToOpenLink except for alt to catch also ctrl/meta
        'if (isMouseEvent)',
        'if (isMouseEvent || aTriggeringEvent && !altEnter)'
      )._replace(
        'where = whereToOpenLink(aTriggeringEvent, false, false);',
        '$&\
         if (loadNewTab && where == "current" || !isMouseEvent && where == "window")\
           where = "tab";'
      )._replace(
        '(where == "current")',
        '(where == "current" || !isMouseEvent && !loadNewTab && /^tab/.test(where))'
      )._replace(
        'openUILinkIn(url, where, params);',
        'params.inBackground = TabmixSvc.TMPprefs.getBoolPref("loadUrlInBackground");\
         $&'
      );
    }
    fixedHandleCommand.toCode();

    // for Omnibar version 0.7.7.20110418+
    if (_Omnibar) {
      window.Omnibar.intercepted_handleCommand = gURLBar[fn];
      Tabmix.newCode("Omnibar.intercepted_handleCommand", Omnibar.intercepted_handleCommand)._replace(
        'Omnibar.handleSearchQuery',
        'false && Omnibar.handleSearchQuery', {silent: true}
      ).toCode();
    }
  },

  initializeSearchbar: function TMP_navToolbox_initializeSearchbar() {
    var searchbar = document.getElementById("searchbar");
    if (!searchbar)
      return;

    let searchLoadExt = "esteban_torres" in window && "searchLoad_Options" in esteban_torres;
    let _handleSearchCommand = searchLoadExt ? esteban_torres.searchLoad_Options.MOZhandleSearch.toString() : searchbar.handleSearchCommand.toString();
    // we check browser.search.openintab also for search button click
    if (_handleSearchCommand.indexOf("forceNewTab") == -1) {
      let functionName = searchLoadExt ? "esteban_torres.searchLoad_Options.MOZhandleSearch" :
                                         "document.getElementById('searchbar').handleSearchCommand";
      Tabmix.newCode(functionName,  _handleSearchCommand)._replace(
        'where = whereToOpenLink(aEvent, false, true);',
        '$& \
        var forceNewTab = where == "current" && textBox._prefBranch.getBoolPref("browser.search.openintab"); \
        if (forceNewTab) where = "tab";'
      ).toCode();
    }

    let organizeSE = "organizeSE" in window && "doSearch" in window.organizeSE;
    let _doSearch;
    if (searchLoadExt)
      _doSearch = esteban_torres.searchLoad_Options.MOZdoSearch.toString()
    else
      _doSearch = organizeSE ? window.organizeSE.doSearch.toString() : searchbar.doSearch.toString();

    if (_doSearch.indexOf("tabmixArg") > -1)
      return;

    let functionName = searchLoadExt ? "esteban_torres.searchLoad_Options.MOZdoSearch" :
                       (organizeSE ? "window.organizeSE.doSearch" : "document.getElementById('searchbar').doSearch");
    Tabmix.newCode(functionName,  _doSearch)._replace(
      /(openUILinkIn[^\(]*\([^\)]+)(\))/,
      '$1, null, tabmixArg$2'
    )._replace(
      'openUILinkIn',
      <![CDATA[
        var tabmixArg = {backgroundPref: "extensions.tabmix.loadSearchInBackground"};
        var isBlankTab = gBrowser.isBlankNotBusyTab(gBrowser.mCurrentTab);
        var isLockTab = !isBlankTab && gBrowser.mCurrentTab.hasAttribute("locked");
        if (aWhere == "current" && isLockTab)
          aWhere = "tab";
        else if ((/^tab/).test(aWhere) && isBlankTab)
          aWhere = "current"
      $&]]>
    )._replace(
      'var loadInBackground = prefs.getBoolPref("loadBookmarksInBackground");',
      'var loadInBackground = TabmixSvc.prefs.getBoolPref("extensions.tabmix.loadSearchInBackground");', {check: !searchLoadExt && organizeSE}
    ).toCode();
  },

  toolbarButtons: function TMP_navToolbox_toolbarButtons() {
    if (TabmixSessionManager.enableManager == null) {
      let inPrivateBrowsing = TabmixSessionManager._inPrivateBrowsing;
      TabmixSessionManager.enableManager = TabmixSvc.SMprefs.getBoolPref("manager") && !inPrivateBrowsing;
      TabmixSessionManager.enableBackup = TabmixSvc.SMprefs.getBoolPref("crashRecovery") && !inPrivateBrowsing;
    }
    Tabmix.setItem("tmp_sessionmanagerButton", "disabled", !TabmixSessionManager.enableManager);
    TabmixSessionManager.toggleRecentlyClosedWindowsButton();

    gTMPprefObserver.showReloadEveryOnReloadButton();

    gTMPprefObserver.changeNewTabButtonSide(TabmixSvc.TMPprefs.getIntPref("newTabButton.position"));
  },

  initializeAlltabsPopup: function TMP_navToolbox_initializeAlltabsPopup() {
    let alltabsPopup = document.getElementById("alltabs-popup");
    if (alltabsPopup && !alltabsPopup._tabmix_inited) {
      alltabsPopup._tabmix_inited = true;
      alltabsPopup.setAttribute("context", gBrowser.tabContextMenu.id);
      alltabsPopup.__ensureElementIsVisible = function () {
        let scrollBox = document.getAnonymousElementByAttribute(this, "class", "popup-internal-box");
        scrollBox.ensureElementIsVisible(gBrowser.mCurrentTab.mCorrespondingMenuitem);
      }
      alltabsPopup.addEventListener("popupshown", alltabsPopup.__ensureElementIsVisible, false);

      // alltabs-popup fix visibility for multi-row
      if (Tabmix.isVersion(70))
        alltabsPopup._updateTabsVisibilityStatus = TabmixAllTabs._updateTabsVisibilityStatus;
    }
  },

  initializeScrollButtons: function TMP_navToolbox_initializeScrollButtons() {
    // Make sure our scroll buttons box is after tabbrowser-tabs
    let id = "tabmixScrollBox";
    let box = document.getElementById(id);
    if (box && box != gBrowser.tabContainer.nextSibling) {
      // update currentset
      let tabsToolbar = document.getElementById("TabsToolbar");
      let cSet = tabsToolbar.getAttribute("currentset");
      // remove existing tabmixScrollBox item
      cSet = cSet.replace("tabmixScrollBox", "").replace(",,", ",").split(",");
      let index = cSet.indexOf("tabbrowser-tabs");
      cSet.splice(index + 1, 0, "tabmixScrollBox");
      tabsToolbar.setAttribute("currentset", cSet.join(","));
      // update physical position
      let useTabmixButtons = TabmixTabbar.scrollButtonsMode > TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT;
      TabmixTabbar.setScrollButtonBox(useTabmixButtons, true, true);
      if (useTabmixButtons && document.getElementById("TabsToolbar").hasAttribute("tabstripoverflow")) {
        let tabStrip = gBrowser.tabContainer.mTabstrip;
        tabStrip._scrollButtonUp.collapsed = tabStrip._scrollButtonDown.collapsed = false;
      }
    }
  }
}
