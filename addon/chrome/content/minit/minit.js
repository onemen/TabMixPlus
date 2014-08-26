"use strict";

///////////////////////////////////////////////////////////////////////////
//// Drag and Drop observers
var TMP_tabDNDObserver = {
  gBackupLabel: "",
  gMsg: null,
  draglink: "",
  lastTime: 0,
  dragmarkindex: null,
  marginBottom: 0,
  LinuxMarginEnd: 0,
  _dragTime: 0,
  _dragOverDelay: 350,
  DRAG_LINK              : 0,
  DRAG_TAB_TO_NEW_WINDOW : 1,
  DRAG_TAB_IN_SAME_WINDOW: 2,
  TAB_DROP_TYPE: "application/x-moz-tabbrowser-tab",
  draggedTab: null,
  paddingLeft: 0,

  init: function TMP_tabDNDObserver_init() {
    var tabBar = gBrowser.tabContainer;
    tabBar.moveTabOnDragging = Tabmix.prefs.getBoolPref("moveTabOnDragging");
    // Determine what tab we're dragging over.
    // * In tabmix tabs can have diffrent width
    // * Point of reference is the start of the dragged tab when
    //   draging left and the end when draging right. If that point
    //   is before (for dragging left) or after (for dragging right)
    //   the middle of a background tab, the dragged tab would take that
    //   tab's position when dropped.
    if (!Tabmix.extensions.treeStyleTab)
    Tabmix.changeCode(tabBar, "gBrowser.tabContainer._animateTabMove")._replace(
      'this.selectedItem = draggedTab;',
      'if (Tabmix.prefs.getBoolPref("selectTabOnMouseDown"))\n\
            $&\n\
          else if (!draggedTab.selected) {\n\
            this.setAttribute("movingBackgroundTab", true);\n\
            draggedTab.setAttribute("dragged", true);\n\
          }'
    )._replace(
      'let tabCenter = tabScreenX + translateX + tabWidth / 2;',
      'let tabCenter = tabScreenX + translateX + draggingRight * tabWidth;'
    )._replace(
      'let screenX = boxObject.screenX + getTabShift(tabs[mid], oldIndex);',
      'let halfWidth = boxObject.width / 2;\n\
          let screenX = boxObject.screenX + draggingRight * halfWidth +\n\
                        getTabShift(tabs[mid], oldIndex);'
    )._replace(
      'screenX + boxObject.width < tabCenter',
      'screenX + halfWidth < tabCenter'
    )._replace(
      'newIndex >= oldIndex',
      'rtl ? $& : draggingRight && newIndex > -1'
    ).toCode();

    Tabmix.changeCode(tabBar, "gBrowser.tabContainer._finishAnimateTabMove")._replace(
      /(\})(\)?)$/,
      '\n\
        this.removeAttribute("movingBackgroundTab");\n\
        let tabs = this.getElementsByAttribute("dragged", "*");\n\
        Array.slice(tabs).forEach(function(tab) tab.removeAttribute("dragged"));\n\
      $1$2'
    ).toCode();

    tabBar.useTabmixDragstart = function(aEvent) {
      if (TMP_tabDNDObserver.draggedTab) {
        delete TMP_tabDNDObserver.draggedTab.__tabmixDragStart;
        TMP_tabDNDObserver.draggedTab = null;
      }
      return this.orient == "horizontal" &&
        (!this.moveTabOnDragging || this.hasAttribute("multibar") ||
        aEvent.altKey);
    }
    tabBar.useTabmixDnD = function(aEvent) {
      function checkTab(dt) {
        let tab = TMP_tabDNDObserver.getSourceNode(dt);
        return !tab || "__tabmixDragStart" in tab;
      }

      return this.orient == "horizontal" &&
        (!this.moveTabOnDragging || this.hasAttribute("multibar") ||
        checkTab(aEvent.dataTransfer));
    }

    this._dragOverDelay = tabBar._dragOverDelay;
    this.draglink = TabmixSvc.getString("droplink.label");

    // without this the Indicator is not visible on the first drag
    tabBar._tabDropIndicator.style.MozTransform = "translate(0px, 0px)";
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

    tab.__tabmixDragStart = true;
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

    // _dragData.offsetX/Y give the coordinates that the mouse should be
    // positioned relative to the corner of the new window created upon
    // dragend such that the mouse appears to have the same position
    // relative to the corner of the dragged tab.
    let clientX = function _clientX(ele) ele.getBoundingClientRect().left;
    let tabOffsetX = clientX(tab) -
                      clientX(gBrowser.tabs[0].pinned ? gBrowser.tabs[0] : gBrowser.tabContainer);
    tab._dragData = {
      offsetX: event.screenX - window.screenX - tabOffsetX,
      offsetY: event.screenY - window.screenY
    };

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

          var disAllowDrop = url ? !Tabmix.ContentClick.isUrlForDownload(url) : true;
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
    else if (TabmixTabbar.scrollButtonsMode == TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT &&
        gBrowser.tabs[0].pinned &&
        Tabmix.compare(event.screenX, Tabmix.itemEnd(gBrowser.tabs[0], !Tabmix.ltr), Tabmix.ltr)) {
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
      let tab = tabBar._getDragTargetTab(event);
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

      gBrowser.ensureTabIsVisible(gBrowser.tabs.item(newIndex));
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
      gBrowser.selectedTab = newTab;
      gBrowser.swapBrowsersAndCloseOther(newTab, draggedTab);
      gBrowser.updateCurrentBrowser(true);
    }
    else {
      // Pass true to disallow dropping javascript: or data: urls
      let url;
      try {
        url = browserDragAndDrop.drop(event, { }, true);
      } catch (ex) {}

      if (!url)
        return;

      let bgLoad = Services.prefs.getBoolPref("browser.tabs.loadInBackground");

      if (event.shiftKey)
        bgLoad = !bgLoad; // shift Key reverse the pref

      if (left_right > -1 && !Tabmix.ContentClick.isUrlForDownload(url)) {
        // We're adding a new tab.
        let newTab = gBrowser.loadOneTab(url, {inBackground: bgLoad, allowThirdPartyFixup: true});
        gBrowser.moveTabTo(newTab, newIndex + left_right);
      }
      else {
        // Load in an existing tab.
        let tab = event.target.localName == "tab" ? event.target : gBrowser.tabs[newIndex];
        try {
          let browser = tab.linkedBrowser;
          // allow to load in locked tab
          browser.tabmix_allowLoad = true;
          let webNav = Ci.nsIWebNavigation;
          let flags = webNav.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP |
                      webNav.LOAD_FLAGS_FIXUP_SCHEME_TYPOS;
          browser.loadURIWithFlags(url, flags);
          if (!bgLoad)
            gBrowser.tabContainer.selectedItem = tab;
        } catch(ex) {
          // Just ignore invalid urls
          Tabmix.log("load\n" + ex);
        }
      }
    }
    if (draggedTab) {
      delete draggedTab._dragData;
      draggedTab.removeAttribute("dragged", true);
    }
  },

  onDragEnd: function minit_onDragEnd(aEvent) {
    var tabBar = gBrowser.tabContainer;
    if (!tabBar.useTabmixDnD(aEvent))
      tabBar._finishAnimateTabMove();

    if (this.draggedTab) {
      delete this.draggedTab.__tabmixDragStart;
      this.draggedTab.removeAttribute("dragged", true);
      this.draggedTab = null;
    }
    // see comment in gBrowser.tabContainer.dragEnd
    var dt = aEvent.dataTransfer;
    var draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
    if (dt.mozUserCancelled || dt.dropEffect != "none") {
      delete draggedTab._dragData;
      return;
    }

    this.clearDragmark(aEvent);

    // don't allow to open new window in single window mode
    // respect bug489729 extension preference
    if (window.bug489729 && Services.prefs.getBoolPref("extensions.bug489729.disable_detach_tab") ||
        Tabmix.singleWindowMode && gBrowser.tabs.length > 1) {
      aEvent.stopPropagation();
      return;
    }

    // Disable detach within the browser toolbox
    var eX = aEvent.screenX;
    var eY = aEvent.screenY;
    var wX = window.screenX;
    // check if the drop point is horizontally within the window
    if (eX > wX && eX < (wX + window.outerWidth)) {
      // also avoid detaching if the the tab was dropped too close to
      // the tabbar (half a tab)
      var bo = tabBar.mTabstrip.scrollBoxObject;
      var rowHeight = TabmixTabbar.singleRowHeight;
      var endScreenY = bo.screenY + bo.height + 0.5 * rowHeight;
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
    var left = Math.min(Math.max(eX - draggedTab._dragData.offsetX, sX.value),
                          sX.value + sWidth.value - winWidth);
    var top = Math.min(Math.max(eY - draggedTab._dragData.offsetY, sY.value),
                        sY.value + sHeight.value - winHeight);

    delete draggedTab._dragData;

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
      delete this.draggedTab.__tabmixDragStart;
      this.draggedTab.removeAttribute("dragged", true);
      this.draggedTab = null;
    }
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

   if (!Tabmix.prefs.getBoolPref("useFirefoxDragmark")) {
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
      minMargin = scrollRect.left - rect.left - this.paddingLeft;
      maxMargin = Math.min(minMargin + scrollRect.width, scrollRect.right);
      if (!ltr)
         [minMargin, maxMargin] = [gBrowser.clientWidth - maxMargin, gBrowser.clientWidth - minMargin];

      tabRect = gBrowser.tabs[index].getBoundingClientRect();
      if (ltr)
         newMargin = tabRect.left - rect.left  + (left_right == 1 ? tabRect.width + this.LinuxMarginEnd: 0) - this.paddingLeft;
      else
         newMargin = rect.right - tabRect.left - (left_right == 0 ? tabRect.width + this.LinuxMarginEnd : 0) - this.paddingLeft;

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

    if (!Tabmix.prefs.getBoolPref("useFirefoxDragmark")) {
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
      let sourceNode = dt.mozGetDataAt(this.TAB_DROP_TYPE, 0);
      if ((aDraggeType == this.DRAG_TAB_IN_SAME_WINDOW && aEvent.target == sourceNode) ||
        // Do not allow transfering a private tab to a non-private window
        // and vice versa.
        (Tabmix.isVersion(200) && PrivateBrowsingUtils.isWindowPrivate(window) !=
            PrivateBrowsingUtils.isWindowPrivate(sourceNode.ownerDocument.defaultView))){
        return dt.effectAllowed = "none";
      }

      if (Tabmix.isVersion(310) && window.gMultiProcessBrowser !=
          sourceNode.ownerDocument.defaultView.gMultiProcessBrowser)
        return dt.effectAllowed = "none";

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
  let bgLoad = Services.prefs.getBoolPref("browser.tabs.loadInBackground");
  try {
    gBrowser.loadTabs(aURIs, bgLoad, aReplace);
  } catch (ex) { }
}

Tabmix.whereToOpen = function TMP_whereToOpen(pref, altKey) {
   var aTab = gBrowser.mCurrentTab;
   var isBlankTab = gBrowser.isBlankNotBusyTab(aTab);
   var isLockTab = !isBlankTab && aTab.hasAttribute("locked");

   var openTabPref = typeof(pref) == "string" ? Services.prefs.getBoolPref(pref) : pref;
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
  return 0;
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
  __noSuchMethod__: function(id, args) {
    if (!this.installed)
      return;
    if (typeof TabView[id] == "function")
      TabView[id].apply(TabView, args);
    else
      Tabmix.log("Error " + id + " is not exist in TabView", true);
  },

  get installed() {
    delete this.installed;
    let installed = typeof TabView == "object";
    if (installed)
      Services.scriptloader.loadSubScript("chrome://tabmixplus/content/minit/tabView.js", window);
    return this.installed = installed;
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

    // fix bug 1034394 - tab mix plus's tabmixscrollbox is not cleaned up after
    // uninstalling tab mix plus
    let tabsToolbar = document.getElementById("TabsToolbar");
    let cSet = tabsToolbar.getAttribute("currentset");
    if (cSet.indexOf("tabmixScrollBox") > -1) {
      cSet = cSet.replace("tabmixScrollBox", "").replace(",,", ",");
      tabsToolbar.setAttribute("currentset", cSet);
      document.persist("TabsToolbar", "currentset");
      if (Tabmix.isVersion(290))
        CustomizableUI.removeWidgetFromArea("tabmixScrollBox");
    }
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
    var optionWindow = Services.wm.getMostRecentWindow("mozilla:tabmixopt");
    if (optionWindow && optionWindow.gAppearancePane)
      optionWindow.gAppearancePane.toolbarButtons(window);
  },

  updateToolboxItems: function TMP_navToolbox_updateToolboxItems() {
    this.initializeURLBar();
    this.initializeSearchbar();
    this.toolbarButtons();
    this.initializeAlltabsPopup();
    this.initializeScrollButtons();
  },

  urlBarInitialized: false,
  initializeURLBar: function TMP_navToolbox_initializeURLBar() {
    if (!gURLBar ||
        document.documentElement.getAttribute("chromehidden").indexOf("location") != -1 ||
        typeof gURLBar.handleCommand == "undefined")
      return;

    // onblur attribut reset each time we exit ToolboxCustomize
    var blur = gURLBar.getAttribute("onblur") || "";
    if (blur.indexOf("Tabmix.urlBarOnBlur") == -1)
      gURLBar.setAttribute("onblur", blur + "Tabmix.urlBarOnBlur();")

    let obj = gURLBar, fn;
    // Fix incompatibility with Omnibar (O is not defined)
    // URL Dot 0.4.x extension
    let _Omnibar = "Omnibar" in window;
    if (_Omnibar && "intercepted_handleCommand" in gURLBar) {
      fn = "intercepted_handleCommand";
      Tabmix.changeCode(gURLBar, "gURLBar.handleCommand")._replace(
        'O.handleSearchQuery',
        'window.Omnibar.handleSearchQuery', {silent: true}
      ).toCode();
    }
    else if ("urlDot" in window && "handleCommand2" in gURLBar)
      fn = "handleCommand2";
    else
      fn = "handleCommand"

    // Fix incompatibility with https://addons.mozilla.org/en-US/firefox/addon/url-fixer/
    if ("urlfixerOldHandler" in gURLBar.handleCommand) {
      _handleCommand = gURLBar.handleCommand.urlfixerOldHandler.toString();
      obj = gURLBar.handleCommand;
      fn = "urlfixerOldHandler";
    }

    let TMP_fn = "Tabmix.whereToOpen";
    let _handleCommand = fn in obj ? obj[fn].toString() : "Tabmix.whereToOpen";
    if (_handleCommand.indexOf(TMP_fn) > -1)
      return;

    if (Tabmix.extensions.ieTab2 && Tabmix.originalFunctions.oldHandleCommand &&
        Tabmix.originalFunctions.oldHandleCommand.toString().indexOf(TMP_fn) > -1)
      return;

    // InstantFox extension uses old version of gURLBar.handleCommand until Firefox 25
    let instantFox = !Tabmix.isVersion(250) && typeof InstantFox == "object";

    // we don't do anything regarding IeTab and URL Suffix extensions
    _handleCommand = Tabmix.changeCode(obj, "gURLBar." + fn, {silent: this.urlBarInitialized})._replace(
      '{',
      '{\
       if (gBrowser.tabmix_tab) {\
         delete gBrowser.tabmix_tab;\
         delete gBrowser.tabmix_userTypedValue;\
       }'
    )._replace(
      'if (isMouseEvent || altEnter) {',
      'let loadNewTab = Tabmix.whereToOpen("extensions.tabmix.opentabfor.urlbar", altEnter).inNew && !(/^ *javascript:/.test(url));\
       if (isMouseEvent || altEnter || loadNewTab) {', {check: !instantFox}
    )._replace(
      // always check whereToOpenLink except for alt to catch also ctrl/meta
      'if (isMouseEvent)',
      'if (isMouseEvent || aTriggeringEvent && !altEnter)', {check: !instantFox}
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
      'params.inBackground = Tabmix.prefs.getBoolPref("loadUrlInBackground");\
       $&', {check: !instantFox}
    );

    if (instantFox) {
      _handleCommand._replace(
        'if (aTriggeringEvent instanceof MouseEvent) {',
        'let isMouseEvent = aTriggeringEvent instanceof MouseEvent;\
         let tabEmpty = !isTabEmpty(gBrowser.selectedTab);\
         let altEnter = !isMouseEvent && aTriggeringEvent && aTriggeringEvent.altKey && !tabEmpty;\
         let loadNewTab = InstantFoxModule.currentQuery && InstantFoxModule.openSearchInNewTab && !tabEmpty ||\
                          Tabmix.whereToOpen("extensions.tabmix.opentabfor.urlbar", altEnter).inNew && !(/^ *javascript:/.test(url));\
         let inBackground = Tabmix.prefs.getBoolPref("loadUrlInBackground");\
         $&'
      )._replace(
        'allowThirdPartyFixup: true, postData: postData',
        '$&, inBackground: inBackground'
      )._replace(
        '} else if (aTriggeringEvent && aTriggeringEvent.altKey && !isTabEmpty(gBrowser.selectedTab)) {',
        '} else if (loadNewTab) {'
      )._replace(
        'inBackground: false',
        'inBackground: inBackground'
      )
    }
    _handleCommand.toCode();

    // don't call ChangeCode.isValidToChange after urlbar initialized,
    // we can only lost our changes if user customized the toolbar and remove urlbar
    if (!this.urlBarInitialized && fn in obj)
      this.urlBarInitialized = obj[fn].toString().indexOf(TMP_fn) > -1;

    // For the case Omnibar version 0.7.7.20110418+ change handleCommand before we do.
    if (_Omnibar && typeof(Omnibar.intercepted_handleCommand) == "function" ) {
      window.Omnibar.intercepted_handleCommand = gURLBar[fn];
      Tabmix.changeCode(Omnibar, "Omnibar.intercepted_handleCommand")._replace(
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
    let _handleSearchCommand = searchLoadExt ? esteban_torres.searchLoad_Options.MOZhandleSearch.toString() :
                                               searchbar.handleSearchCommand.toString();
    // we check browser.search.openintab also for search button click
    if (_handleSearchCommand.indexOf("whereToOpenLink") > -1 &&
          _handleSearchCommand.indexOf("forceNewTab") == -1) {
      let [obj, fn] = searchLoadExt ? [esteban_torres.searchLoad_Options, "MOZhandleSearch"] :
                                      [searchbar, "handleSearchCommand"];
      Tabmix.changeCode(obj, "searchbar." + fn)._replace(
        'where = whereToOpenLink(aEvent, false, true);',
        '$& \
        var forceNewTab = where == "current" && textBox._prefBranch.getBoolPref("browser.search.openintab"); \
        if (forceNewTab) where = "tab";'
      ).toCode();
    }

    let organizeSE = "organizeSE" in window && "doSearch" in window.organizeSE;
    let [obj, fn] = searchLoadExt ? [esteban_torres.searchLoad_Options, "MOZdoSearch"] :
                                    [organizeSE ? window.organizeSE : searchbar, "doSearch"];
    if (obj[fn].toString().indexOf("tabmixArg") > -1)
      return;
    Tabmix.changeCode(obj, "searchbar." + fn)._replace(
      /(openUILinkIn[^\(]*\([^\)]+)(\))/,
      '$1, null, tabmixArg$2'
    )._replace(
      'openUILinkIn',
      '  var tabmixArg = {backgroundPref: "extensions.tabmix.loadSearchInBackground"};' +
      '  var isBlankTab = gBrowser.isBlankNotBusyTab(gBrowser.mCurrentTab);' +
      '  var isLockTab = !isBlankTab && gBrowser.mCurrentTab.hasAttribute("locked");' +
      '  if (aWhere == "current" && isLockTab)' +
      '    aWhere = "tab";' +
      '  else if ((/^tab/).test(aWhere) && isBlankTab)' +
      '    aWhere = "current";' +
      '$&'
    )._replace(
      'var loadInBackground = prefs.getBoolPref("loadBookmarksInBackground");',
      'var loadInBackground = Tabmix.prefs.getBoolPref("loadSearchInBackground");', {check: !searchLoadExt && organizeSE}
    ).toCode();
  },

  toolbarButtons: function TMP_navToolbox_toolbarButtons() {
    let SM = TabmixSessionManager;
    if (SM.enableManager != null)
      SM.toggleRecentlyClosedWindowsButton();

    gTMPprefObserver.showReloadEveryOnReloadButton();

    gTMPprefObserver.changeNewTabButtonSide(Tabmix.prefs.getIntPref("newTabButton.position"));
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
      Tabmix.setNewFunction(alltabsPopup, "_updateTabsVisibilityStatus",
          TabmixAllTabs._updateTabsVisibilityStatus);
    }
  },

  initializeScrollButtons: function TMP_navToolbox_initializeScrollButtons() {
    // Make sure our scroll buttons box is after tabbrowser-tabs
    let id = "tabmixScrollBox";
    let box = document.getElementById(id);
    let tabBar = gBrowser.tabContainer;
    if (box && box != tabBar.nextSibling) {
      let useTabmixButtons = TabmixTabbar.scrollButtonsMode > TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT;
      TabmixTabbar.setScrollButtonBox(useTabmixButtons, true, true);
      if (!Tabmix.isVersion(320) && useTabmixButtons && tabBar.overflow) {
        tabBar.mTabstrip._scrollButtonUp.collapsed = false;
        tabBar.mTabstrip._scrollButtonDown.collapsed = false;
      }
    }

    // reset tabsNewtabButton and afterTabsButtonsWidth
    if (typeof privateTab == "object")
      TMP_eventListener.updateMultiRow(true);
  }
}
