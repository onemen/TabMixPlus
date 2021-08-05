/* exported TMP_undocloseTabButtonObserver, TMP_TabView */
"use strict";

/****    Drag and Drop observers    ****/
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
  DRAG_LINK: 0,
  DRAG_TAB_TO_NEW_WINDOW: 1,
  DRAG_TAB_IN_SAME_WINDOW: 2,
  TAB_DROP_TYPE: "application/x-moz-tabbrowser-tab",
  draggedTab: null,
  paddingLeft: 0,

  init: function TMP_tabDNDObserver_init() {
    var tabBar = gBrowser.tabContainer;
    if (Tabmix.extensions.verticalTabBar) {
      tabBar.useTabmixDnD = () => false;
      return;
    }

    tabBar.moveTabOnDragging = Tabmix.prefs.getBoolPref("moveTabOnDragging");

    Tabmix.getMovingTabsWidth = movingTabs => {
      return movingTabs.reduce((width, tab) => {
        return width + tab.getBoundingClientRect().width;
      }, 0);
    };
    // Determine what tab we're dragging over.
    // * In tabmix tabs can have different width
    // * Point of reference is the start of the dragged tab/tabs when
    //   dragging left and the end when dragging right. If that point
    //   is before (for dragging left) or after (for dragging right)
    //   the middle of a background tab, the dragged tab would take that
    //   tab's position when dropped.
    Tabmix.changeCode(tabBar, "gBrowser.tabContainer._animateTabMove")._replace(
      'if (this.getAttribute("movingtab")',
      `let tabmixHandleMove = this.getAttribute("orient") === "horizontal" && TabmixTabbar.widthFitTitle;
      $&`
    )._replace(
      'this.selectedItem = draggedTab;',
      'if (Tabmix.prefs.getBoolPref("selectTabOnMouseDown"))\n\
            $&\n\
          else if (!draggedTab.selected) {\n\
            this.setAttribute("movingBackgroundTab", true);\n\
            draggedTab.setAttribute("dragged", true);\n\
          }'
    )._replace(
      'let shiftWidth = tabWidth * movingTabs.length;',
      `let shiftWidth = Tabmix.getMovingTabsWidth(movingTabs);
       draggedTab._dragData.shiftWidth = shiftWidth;
       let rightTabWidth = movingTabs[movingTabs.length - 1].getBoundingClientRect().width;
       let leftTabWidth = movingTabs[0].getBoundingClientRect().width;
       let referenceTabWidht = ltrMove ? rightTabWidth : leftTabWidth;`
    )._replace(
      '(rightMovingTabScreenX + tabWidth)',
      '(rightMovingTabScreenX + rightTabWidth)'
    )._replace(
      /let leftTabCenter =.*;/,
      `let leftTabCenter = leftMovingTabScreenX + translateX + leftTabWidth / 2;`
    )._replace(
      /let rightTabCenter =.*;/,
      `let rightTabCenter = rightMovingTabScreenX + translateX + rightTabWidth / 2;`
    )._replace(
      'if (screenX > tabCenter) {',
      `let midWidth = tabs[mid].getBoundingClientRect().width;
        if (tabmixHandleMove && referenceTabWidht > midWidth) {
          screenX += midWidth / 2;
          if (screenX > tabCenter + referenceTabWidht / 2) {
            high = mid - 1;
          } else if (
            screenX < tabCenter - referenceTabWidht / 2
          ) {
            low = mid + 1;
          } else {
            newIndex = tabs[mid]._tPos;
            break;
          }
          continue;
        }
        $&`
    )._replace(
      'newIndex >= oldIndex',
      '!tabmixHandleMove ? $& : newIndex > -1 && (RTL_UI !== ltrMove)'
    ).toCode();

    Tabmix.changeCode(tabBar, "gBrowser.tabContainer.on_drop")._replace(
      '} else if (draggedTab && draggedTab.container == this) {',
      `gBrowser.ensureTabIsVisible(draggedTabCopy);
        TabmixTabbar.updateBeforeAndAfter();
      } else if (draggedTab && draggedTab.container == this && TabmixTabbar.visibleRows > 1) {
        let oldIndex = draggedTab._tPos;
        let newIndex = this._getDropIndex(event, false);
        let moveLeft = newIndex < oldIndex;
        if (!moveLeft) newIndex -= 1;
        for (let tab of movingTabs) {
          gBrowser.moveTabTo(tab, newIndex);
          if (moveLeft) newIndex++;
        }
        TabmixTabbar.updateScrollStatus();
        gBrowser.ensureTabIsVisible(draggedTab);
        TabmixTabbar.updateBeforeAndAfter();
      $&`
    )._replace(
      'if (oldTranslateX && oldTranslateX',
      `let refTab = this.allTabs[dropIndex];
       if (refTab) {
         let firstMovingTab = RTL_UI ? movingTabs[movingTabs.length - 1] : movingTabs[0];
           newTranslateX = RTL_UI && dropIndex < firstMovingTab._tPos || !RTL_UI && dropIndex > firstMovingTab._tPos
             ? refTab.screenX + refTab.getBoundingClientRect().width - firstMovingTab.screenX - draggedTab._dragData.shiftWidth
             : refTab.screenX - firstMovingTab.screenX;
       }
      $&`
    )._replace(
      'let newIndex = this._getDropIndex(event, true);',
      `let { newIndex, left_right } = this._getDropIndex(event, true, true);
      let firstUrl = links[0].url;
      replace =
        left_right === -1 || Tabmix.ContentClick.isUrlForDownload(firstUrl);
      newIndex += left_right;
      if (replace) {
        targetTab =
          event.target.closest("tab.tabbrowser-tab") || this.allTabs[newIndex];
        // allow to load in locked tab
        targetTab.linkedBrowser.tabmix_allowLoad = true;
      } else {
        targetTab = null;
      }`
    ).toCode();

    Tabmix.originalFunctions._getDropIndex = gBrowser.tabContainer._getDropIndex;
    gBrowser.tabContainer._getDropIndex = this._getDropIndex.bind(this);

    Tabmix.changeCode(tabBar, "gBrowser.tabContainer._finishAnimateTabMove")._replace(
      /(})(\)?)$/,
      '\n\
        this.removeAttribute("movingBackgroundTab");\n\
        let tabs = this.getElementsByAttribute("dragged", "*");\n\
        Array.prototype.slice.call(tabs).forEach(tab => tab.removeAttribute("dragged"));\n\
      $1$2'
    ).toCode();

    tabBar.useTabmixDnD = function(aEvent) {
      function checkTab(dt) {
        let tab = TMP_tabDNDObserver.getSourceNode(dt);
        return !tab || tab.__tabmixDragStart ||
          TMP_tabDNDObserver.getDragType(tab) == TMP_tabDNDObserver.DRAG_TAB_TO_NEW_WINDOW;
      }

      return this.getAttribute("orient") == "horizontal" &&
        (!this.moveTabOnDragging || this.hasAttribute("multibar") ||
        checkTab(aEvent.dataTransfer));
    };

    this._dragOverDelay = tabBar._dragOverDelay;
    this.draglink = TabmixSvc.getString("droplink.label");

    // without this the Indicator is not visible on the first drag
    tabBar._tabDropIndicator.style.MozTransform = "translate(0px, 0px)";
  },

  get _isCustomizing() {
    return gBrowser.tabContainer._isCustomizing;
  },

  on_dragstart(event) {
    if (this.draggedTab) {
      delete this.draggedTab.__tabmixDragStart;
    }

    const tabBar = gBrowser.tabContainer;
    const tab = tabBar._getDragTargetTab(event, false);
    if (!tab || this._isCustomizing) {
      return;
    }
    tab.__tabmixDragStart = true;
    this.draggedTab = tab;

    TabmixTabbar.removeShowButtonAttr();
    tabBar.on_dragstart(event);
    const windowUtils = window.windowUtils;
    const scale = windowUtils.screenPixelsPerCSSPixel / windowUtils.fullZoom;
    let dragImageOffsetX = -16;
    let dragImageOffsetY = TabmixTabbar.visibleRows == 1 ? -16 : -30;
    let toDrag = tabBar._dndCanvas;
    if (gMultiProcessBrowser) {
      const platform = AppConstants.platform;
      if (platform !== "win" && platform !== "macosx") {
        toDrag = tabBar._dndPanel;
      }
    } else {
      dragImageOffsetX *= scale;
      dragImageOffsetY *= scale;
    }
    if (TabmixTabbar.position == 1) {
      dragImageOffsetY = tabBar._dndCanvas.height - dragImageOffsetY;
    }
    const captureListener = function() {
      event.dataTransfer.updateDragImage(toDrag, dragImageOffsetX, dragImageOffsetY);
    };
    PageThumbs.captureToCanvas(tab.linkedBrowser, tabBar._dndCanvas)
        .then(captureListener)
        .catch(e => Cu.reportError(e));
  },

  on_dragover(event) {
    var dt = event.dataTransfer;
    var tabBar = gBrowser.tabContainer;

    var sourceNode = this.getSourceNode(dt);
    var dragType = this.getDragType(sourceNode);
    var newIndex = this._getDNDIndex(event);
    var oldIndex = dragType != this.DRAG_LINK ? sourceNode._tPos : -1;
    var left_right; // 1:right, 0: left, -1: drop link on tab to replace tab
    ///XXX check if we need here visibleTabs insteadof gBrowser.tabs
    ///    check with groups with or without pinned tabs
    if (newIndex < gBrowser.tabs.length)
      left_right = this.getLeft_Right(event, newIndex, oldIndex, dragType);
    else {
      newIndex = dragType != this.DRAG_TAB_IN_SAME_WINDOW &&
                 Tabmix.getOpenTabNextPref(dragType == this.DRAG_LINK) ?
        tabBar.selectedIndex : gBrowser.tabs.length - 1;
      left_right = 1;
    }

    if (Tabmix.tabsUtils.overflow) {
      let tabStrip = tabBar.arrowScrollbox;
      let ltr = Tabmix.ltr || tabStrip.getAttribute('orient') == "vertical";
      let _scroll, targetAnonid;
      if (TabmixTabbar.scrollButtonsMode != TabmixTabbar.SCROLL_BUTTONS_HIDDEN) // scroll with button
        targetAnonid = event.originalTarget.getAttribute("anonid") || event.originalTarget.id;
      // scroll without button
      else if (event.screenX <= tabStrip.scrollbox.screenX)
        targetAnonid = ltr ? "scrollbutton-up" : "scrollbutton-down";
      else if (event.screenX >= (tabStrip.scrollbox.screenX + tabStrip.scrollClientRect.width))
        targetAnonid = ltr ? "scrollbutton-down" : "scrollbutton-up";

      switch (targetAnonid) {
        case "scrollbutton-up":
        case "scrollbutton-up-right":
          if (Tabmix.tabsUtils.canScrollTabsLeft)
            _scroll = -1;
          break;
        case "scrollbutton-down":
        case "scrollbutton-down-right":
          if (Tabmix.tabsUtils.canScrollTabsRight)
            _scroll = 1;
          break;
      }
      if (_scroll) {
        let scrollIncrement = TabmixTabbar.isMultiRow ?
          Math.round(tabStrip._singleRowHeight / 6) : tabStrip.scrollIncrement;
        tabStrip.scrollByPixels(_scroll * scrollIncrement, true);
        this.clearDragmark();
        return;
      }
    }

    var isCopy = this.isCopyDropEffect(dt, event, dragType);
    var effects = gBrowser.tabContainer._getDropEffectForTabDrag(event);

    var replaceTab = (left_right == -1);
    /* we don't allow to drop link on lock tab.
     * unless:
     *           - the tab is blank
     *     or    - the user press Ctrl/Meta Key
     *     or    - we drop link that start download
     */
    if (replaceTab && !isCopy) {
      let disAllowDrop, targetTab = gBrowser.tabs[newIndex];
      if (targetTab.getAttribute("locked") && !gBrowser.isBlankNotBusyTab(targetTab)) {
        // Pass true to disallow dropping javascript: or data: urls
        let links;
        try {
          links = browserDragAndDrop.dropLinks(event, true);
          const url = links && links.length ? links[0].url : null;
          disAllowDrop = url ? !Tabmix.ContentClick.isUrlForDownload(url) : true;
        } catch (ex) {}

        if (disAllowDrop)
          dt.effectAllowed = "none";
      }
    }

    var canDrop;
    if (effects === "" || effects == "none" && this._isCustomizing) {
      this.clearDragmark();
      return;
    }
    canDrop = effects != "none";
    if (canDrop && !isCopy && dragType == this.DRAG_TAB_IN_SAME_WINDOW && oldIndex == newIndex) {
      canDrop = false;
      dt.effectAllowed = "none";
    } else if (TabmixTabbar.scrollButtonsMode == TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT &&
        // if we don't set effectAllowed to none then the drop indicator stay
        gBrowser.tabs[0].pinned &&
        Tabmix.compare(event.screenX, Tabmix.itemEnd(gBrowser.tabs[0], !Tabmix.ltr), Tabmix.ltr)) {
      canDrop = false;
      dt.effectAllowed = "none";
    }

    event.preventDefault();
    event.stopPropagation();

    // show Drag & Drop message
    if (dragType == this.DRAG_LINK) {
      this.gMsg = event.originalTarget.getAttribute("command") == "cmd_newNavigatorTab" ?
        this.gBackupLabel : this.draglink;
      if (!tabBar.contains(event.target)) {
        this.gMsg = this.gBackupLabel;
      }
      var statusTextFld = document.getElementById("statusbar-display");
      if (statusTextFld && statusTextFld.getAttribute("label") != this.gMsg) {
        if (this.gBackupLabel === "")
          this.gBackupLabel = statusTextFld.getAttribute("label");
        statusTextFld.label = this.gMsg;
        this.statusFieldChanged = true;
      } else if (!statusTextFld) {
        let tooltip = document.getElementById("tabmix-tooltip");
        if (tooltip.state == "closed") {
          tooltip.label = this.gMsg;
          tooltip.openPopup(document.getElementById("browser"), null, 1, 1, false, false);
        }
      }
    }

    let draggedTab = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
    if ((effects == "move" || effects == "copy") && tabBar == draggedTab.container) {
      if (!tabBar._isGroupTabsAnimationOver()) {
        this.clearDragmark();
        // Wait for grouping tabs animation to finish
        return;
      }
      tabBar._finishGroupSelectedTabs(draggedTab);
    }

    if (dragType == this.DRAG_LINK) {
      let tab = tabBar._getDragTargetTab(event, true);
      if (tab && !this._isCustomizing) {
        if (!this._dragTime)
          this._dragTime = Date.now();
        if (Date.now() >= this._dragTime + this._dragOverDelay)
          tabBar.selectedItem = tab;
      }
    }

    if (replaceTab || !canDrop) {
      this.clearDragmark();
      return;
    }

    this.setDragmark(newIndex, left_right);
  },

  on_dragexit(event) {
    event.stopPropagation();
    this._dragTime = 0;

    var target = event.relatedTarget;
    while (target && target.localName != "arrowscrollbox")
      target = target.parentNode;
    if (target)
      return;

    this.clearDragmark();
    if (this.draggedTab) {
      delete this.draggedTab.__tabmixDragStart;
      this.draggedTab = null;
    }
    this.updateStatusField();
  },

  updateStatusField() {
    var statusTextFld = document.getElementById("statusbar-display");
    if (statusTextFld && this.statusFieldChanged) {
      statusTextFld.label = "";
      this.gBackupLabel = "";
      this.statusFieldChanged = null;
    } else if (!statusTextFld) {
      document.getElementById("tabmix-tooltip").hidePopup();
    }
  },

  _getDropIndex(event, isLink, dropLink) {
    const tabBar = gBrowser.tabContainer;
    if (!tabBar.hasAttribute("multibar")) {
      return Tabmix.originalFunctions._getDropIndex.apply(tabBar, arguments);
    }

    const dt = event.dataTransfer;
    const sourceNode = this.getSourceNode(dt);
    const dragType = this.getDragType(sourceNode);
    const tab = dragType != this.DRAG_LINK && sourceNode;
    const oldIndex = tab ? tab._tPos : -1;
    let newIndex = this._getDNDIndex(event);
    let left_right;

    if (newIndex < gBrowser.tabs.length)
      left_right = this.getLeft_Right(event, newIndex, oldIndex, dragType);
    else {
      newIndex = dragType != this.DRAG_TAB_IN_SAME_WINDOW &&
             Tabmix.getOpenTabNextPref(dragType == this.DRAG_LINK) ?
        tabBar.selectedIndex : gBrowser.tabs.length - 1;
      left_right = 1;
    }
    return dropLink ? {newIndex, left_right} : newIndex + left_right;
  },

  // get _tPos from group index
  _getDNDIndex(aEvent) {
    var indexInGroup = this.getNewIndex(aEvent);
    var tabs = Tabmix.visibleTabs.tabs;
    var lastIndex = tabs.length - 1;
    if (indexInGroup < 0 || indexInGroup > lastIndex)
      indexInGroup = lastIndex;
    return tabs[indexInGroup]._tPos;
  },

  getNewIndex(event) {
    let getTabRowNumber = (tab, top) => (tab.pinned ? 1 : Tabmix.tabsUtils.getTabRowNumber(tab, top));
    // if mX is less then the first tab return 0
    // check if mY is below the tab.... if yes go to next row
    // in the row find the closest tab by mX,
    // if no tab is match return gBrowser.tabs.length
    var mX = event.screenX, mY = event.screenY;
    var tabBar = gBrowser.tabContainer;
    var tabs = Tabmix.visibleTabs.tabs;
    var numTabs = tabs.length;
    if (!tabBar.hasAttribute("multibar")) {
      const target = event.target.closest("tab.tabbrowser-tab");
      let i = target ? Tabmix.visibleTabs.indexOf(target) : 0;
      for (; i < numTabs; i++) {
        let tab = tabs[i];
        if (Tabmix.compare(mX, Tabmix.itemEnd(tab, Tabmix.ltr), Tabmix.ltr))
          return i;
      }
    } else {
      // adjust mouseY position when it is in the margin area
      const tabStrip = gBrowser.tabContainer.arrowScrollbox;
      const singleRowHeight = tabStrip.singleRowHeight;
      const firstVisibleRow = Math.round(tabStrip.scrollPosition / singleRowHeight) + 1;
      const {top, height} = document.getElementById("tabbrowser-arrowscrollbox").getBoundingClientRect();
      if (mY > top + height - this._multirowMargin) {
        mY = top + height - this._multirowMargin - 1;
      } else if (mY < top + this._multirowMargin) {
        mY = top + this._multirowMargin + 1;
      }
      const currentRow = firstVisibleRow + parseInt((mY - top - this._multirowMargin) / singleRowHeight);
      let topY = Tabmix.tabsUtils.topTabY;
      let index;
      for (index = 0; index < numTabs; index++) {
        if (getTabRowNumber(tabs[index], topY) === currentRow) {
          break;
        }
      }

      for (let i = index; i < numTabs; i++) {
        let tab = tabs[i];
        if (Tabmix.compare(mX, Tabmix.itemEnd(tab, Tabmix.ltr), Tabmix.ltr)) {
          return i;
        } else if (i == numTabs - 1 || getTabRowNumber(tabs[i + 1], topY) !== currentRow) {
          return i;
        }
      }
    }
    return numTabs;
  },

  getLeft_Right(event, newIndex, oldIndex, dragType) {
    var mX = event.screenX;
    var left_right;
    var tab = gBrowser.tabs[newIndex];
    const {width} = tab.getBoundingClientRect();
    var ltr = Tabmix.ltr;
    var _left = ltr ? 0 : 1;
    var _right = ltr ? 1 : 0;

    var isCtrlKey = ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey);
    var lockedTab = tab.getAttribute("locked") && !gBrowser.isBlankNotBusyTab(tab);
    if ((dragType == this.DRAG_LINK && lockedTab) || (dragType == this.DRAG_LINK && !lockedTab && !isCtrlKey)) {
      left_right = (mX < tab.screenX + width / 4) ? _left : _right;
      if (left_right == _right && mX < tab.screenX + width * 3 / 4)
        left_right = -1;
    } else {
      left_right = (mX < tab.screenX + width / 2) ? _left : _right;
      if (!isCtrlKey && dragType == this.DRAG_TAB_IN_SAME_WINDOW) {
        if (newIndex == oldIndex - 1)
          left_right = ltr ? _left : _right;
        else if (newIndex == oldIndex + 1)
          left_right = ltr ? _right : _left;
      }
    }

    return left_right;
  },

  getDragType(sourceNode) {
    if (
      sourceNode instanceof XULElement &&
      sourceNode.localName == "tab" &&
      sourceNode.ownerGlobal.isChromeWindow &&
      sourceNode.ownerDocument.documentElement.getAttribute("windowtype") ==
      "navigator:browser" &&
      sourceNode.ownerGlobal.gBrowser.tabContainer == sourceNode.container
    ) {
      if (sourceNode.container === gBrowser.tabContainer) {
        return this.DRAG_TAB_IN_SAME_WINDOW; // 2
      }
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

    // code for firefox indicator
    var ind = gBrowser.tabContainer._tabDropIndicator;
    var minMargin, maxMargin, newMargin;
    var tabRect;
    var ltr = Tabmix.ltr;
    let scrollRect = gBrowser.tabContainer.arrowScrollbox.scrollClientRect;
    let rect = gBrowser.tabContainer.getBoundingClientRect();
    minMargin = scrollRect.left - rect.left - this.paddingLeft;
    maxMargin = Math.min(minMargin + scrollRect.width, scrollRect.right);
    if (!ltr)
      [minMargin, maxMargin] = [gBrowser.clientWidth - maxMargin, gBrowser.clientWidth - minMargin];

    tabRect = gBrowser.tabs[index].getBoundingClientRect();
    if (ltr)
      newMargin = tabRect.left - rect.left +
          (left_right == 1 ? tabRect.width + this.LinuxMarginEnd : 0) -
          this.paddingLeft;
    else
      newMargin = rect.right - tabRect.left -
          (left_right === 0 ? tabRect.width + this.LinuxMarginEnd : 0) -
          this.paddingLeft;

    ///XXX fix min/max x margin when in one row the drag mark is visible after
    ///XXX the arrow when the last tab is partly visible
    ///XXX look like the same is happen with Firefox
    var newMarginY;
    if (TabmixTabbar.position == 1) {
      newMarginY = tabRect.bottom - ind.parentNode.getBoundingClientRect().bottom;
    } else {
      newMarginY = tabRect.bottom - rect.bottom;
      // fix for some theme on Mac OS X
      if (TabmixTabbar.visibleRows > 1 &&
            ind.parentNode.getBoundingClientRect().height === 0) {
        newMarginY += tabRect.height;
      }
    }
    // make indicator visible
    ind.style.removeProperty("margin-bottom");

    this.setFirefoxDropIndicator(true);
    newMargin += ind.clientWidth / 2;
    if (!ltr)
      newMargin *= -1;

    ind.style.MozTransform = "translate(" + Math.round(newMargin) + "px," + Math.round(newMarginY) + "px)";
    ind.style.MozMarginStart = (-ind.clientWidth) + "px";

    this.dragmarkindex = {newIndex, index};
  },

  clearDragmark: function minit_clearDragmark() {
    if (this.dragmarkindex === null)
      return;

    this.setFirefoxDropIndicator(false);
    this.dragmarkindex = null;
  },

  setFirefoxDropIndicator(val) {
    gBrowser.tabContainer._tabDropIndicator.hidden = !val;
  },

  getSourceNode: function TMP_getSourceNode(aDataTransfer) {
    var types = aDataTransfer.mozTypesAt(0);
    if (types[0] == this.TAB_DROP_TYPE)
      return aDataTransfer.mozGetDataAt(this.TAB_DROP_TYPE, 0);
    return null;
  },

  isCopyDropEffect(dt, event, type) {
    let isCopy = dt.dropEffect == "copy";
    if (isCopy && type == this.DRAG_LINK) {
      // Dragging bookmark or livemark from the Bookmarks toolbar, or dragging
      // data from external source, always have 'copy' dropEffect
      let isCtrlKey = ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey);
      let sourceNode = dt.effectAllowed == "copyLink" &&
          dt.mozSourceNode ? dt.mozSourceNode : {};

      // return true when user drag text from the urlbar
      let isUrlbar = node => {
        let result;
        // when user drag text from the address bar to another tab
        // node.parentNode is null after selected tab changed
        // save _tabmix_isUrlbar on the first run of this function
        if (typeof sourceNode._tabmix_isUrlbar == "boolean") {
          return sourceNode._tabmix_isUrlbar;
        }
        while (!result && node.parentNode) {
          node = node.parentNode;
          result = node.classList.contains("urlbar-input");
        }
        if (typeof sourceNode._tabmix_isUrlbar == "undefined") {
          sourceNode._tabmix_isUrlbar = result;
        }
        return result;
      };
      let move = !isCtrlKey && (!dt.mozSourceNode || sourceNode._placesNode || isUrlbar(sourceNode));
      return !move;
    }
    return isCopy;
  }

}; // TMP_tabDNDObserver end

var TMP_undocloseTabButtonObserver = {
  onDragOver(aEvent) {
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

  onDragExit(aEvent) {
    if (aEvent.target.hasAttribute("dragover")) {
      var statusTextFld = document.getElementById("statusbar-display");
      if (statusTextFld)
        statusTextFld.label = "";
      else
        document.getElementById("tabmix-tooltip").hidePopup();

      aEvent.target.removeAttribute("dragover");
    }
  },

  onDrop(aEvent) {
    var dt = aEvent.dataTransfer;
    var sourceNode = TMP_tabDNDObserver.getSourceNode(dt) || this.NEW_getSourceNode(dt);
    if (sourceNode && sourceNode.localName == "tab")
      // let tabbrowser drag event time to end before we remove the sourceNode
      setTimeout((b, aTab) => b.removeTab(aTab, {animate: true}), 0, gBrowser, sourceNode);

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
};

/* ::::::::::     miscellaneous     :::::::::: */

Tabmix.goButtonClick = function TMP_goButtonClick(aEvent) {
  if (aEvent.button == 1 && gURLBar.value == gBrowser.currentURI.spec)
    gBrowser.duplicateTab(gBrowser._selectedTab);
  else if (aEvent.button != 2)
    gURLBar.handleCommand(aEvent);
};

Tabmix.loadTabs = function TMP_loadTabs(aURIs, aReplace) {
  let bgLoad = Services.prefs.getBoolPref("browser.tabs.loadInBackground");
  try {
    gBrowser.loadTabs(aURIs, bgLoad, aReplace);
  } catch (ex) { }
};

Tabmix.whereToOpen = function TMP_whereToOpen(pref, altKey) {
  var aTab = gBrowser._selectedTab;
  var isBlankTab = gBrowser.isBlankNotBusyTab(aTab);
  var isLockTab = !isBlankTab && aTab.hasAttribute("locked");

  var openTabPref = typeof (pref) == "string" ? Services.prefs.getBoolPref(pref) : pref;
  if (typeof (altKey) != "undefined") {
    // don't reuse blank tab if the user press alt key when the pref is to open in current tab
    if (altKey && !openTabPref)
      isBlankTab = false;

    // see bug 315034 If search is set to open in a new tab,
    // Alt+Enter should open the search result in the current tab
    // so here we reverse the pref if user press Alt key
    openTabPref = (altKey ^ openTabPref) == 1;
  }
  return {inNew: !isBlankTab && (isLockTab || openTabPref), lock: isLockTab};
};

Tabmix.getStyle = function TMP_getStyle(aObj, aStyle) {
  try {
    return parseInt(window.getComputedStyle(aObj)[aStyle]) || 0;
  } catch (ex) {
    this.assert(ex);
  }
  return 0;
};

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
};

var TMP_TabView = {
  subScriptLoaded: false,
  init() {
    try {
      if (this.installed) {
        this._patchBrowserTabview();
      }
    } catch (ex) {
      Tabmix.assert(ex);
    }
  },

  get installed() {
    let installed = typeof TabView == "object";
    if (installed && !this.subScriptLoaded) {
      Services.scriptloader.loadSubScript("chrome://tabmixplus/content/minit/tabView.js", window);
    }
    return installed;
  },

  exist(id) {
    return this.installed && typeof TabView[id] == "function";
  },

  checkTabs(tabs) {
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

  // including _removingTabs
  currentGroup() {
    return Array.prototype.filter.call(gBrowser.tabs, tab => !tab.hidden);
  },

  // visibleTabs don't include  _removingTabs
  getTabPosInCurrentGroup(aTab) {
    if (aTab) {
      let tabs = Array.prototype.filter.call(gBrowser.tabs, tab => !tab.hidden);
      return tabs.indexOf(aTab);
    }
    return -1;
  },

  getIndexInVisibleTabsFromTab(aTab) {
    if (aTab)
      return Tabmix.visibleTabs.tabs.indexOf(aTab);
    return -1;
  }
};

Tabmix.navToolbox = {
  customizeStarted: false,
  toolboxChanged: false,
  resetUI: false,
  listener: null,

  init: function TMP_navToolbox_init() {
    this.updateToolboxItems();
    gNavToolbox.addEventListener("beforecustomization", this);
    gNavToolbox.addEventListener("aftercustomization", this);

    this.listener = {
      onWidgetAfterDOMChange: function(aNode, aNextNode, aContainer, aWasRemoval) {
        if (this.customizeStarted)
          return;
        if (aContainer.id == "TabsToolbar") {
          this.tabStripAreaChanged();
          TabmixTabbar.updateScrollStatus();
          TabmixTabbar.updateBeforeAndAfter();
        }
        if (!aWasRemoval) {
          let command = aNode.getAttribute("command");
          if (/Browser:ReloadOrDuplicate|Browser:Stop/.test(command))
            gTMPprefObserver.showReloadEveryOnReloadButton();
        }
      }.bind(this)
    };
    CustomizableUI.addListener(this.listener);
  },

  deinit: function TMP_navToolbox_deinit() {
    gNavToolbox.removeEventListener("beforecustomization", this);
    gNavToolbox.removeEventListener("aftercustomization", this);

    // remove tabmix-tabs-closebutton when its position is immediately after
    // tabmix-scrollbox and save its position in preference for future use.
    let boxPosition = Tabmix.getPlacement("tabmix-scrollbox");
    let buttonPosition = Tabmix.getPlacement("tabmix-tabs-closebutton");
    if (buttonPosition == boxPosition + 1) {
      Tabmix.prefs.setIntPref("tabs-closeButton-position", buttonPosition);
      CustomizableUI.removeWidgetFromArea("tabmix-tabs-closebutton");
    }

    CustomizableUI.removeWidgetFromArea("tabmix-scrollbox");
    CustomizableUI.removeListener(this.listener);

    let alltabsPopup = document.getElementById("allTabsMenu-allTabsView");
    if (alltabsPopup && alltabsPopup._tabmix_inited) {
      alltabsPopup.removeEventListener("popupshown", alltabsPopup.__ensureElementIsVisible);
    }
  },

  cleanCurrentset() {
    let tabsToolbar = document.getElementById("TabsToolbar");
    let cSet = tabsToolbar.getAttribute("currentset");
    if (cSet.indexOf("tabmix-scrollbox") > -1) {
      cSet = cSet.replace("tabmix-scrollbox", "").replace(",,", ",");
      tabsToolbar.setAttribute("currentset", cSet);
      document.persist("TabsToolbar", "currentset");
    }
  },

  handleEvent: function TMP_navToolbox_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "beforecustomization":
        this.customizeStart();
        break;
      case "customizationchange":
        gNavToolbox.removeEventListener("customizationchange", this);
        this.toolboxChanged = true;
        break;
      case "aftercustomization":
        this.customizeDone(this.toolboxChanged);
        break;
    }
  },

  customizeStart: function TMP_navToolbox_customizeStart() {
    gNavToolbox.addEventListener("customizationchange", this);
    this.toolboxChanged = false;
    this.customizeStarted = true;
    Tabmix.bottomToolbarUtils.resizeObserver("customization-container", true);
  },

  customizeDone: function TMP_navToolbox_customizeDone(aToolboxChanged) {
    gNavToolbox.removeEventListener("customizationchange", this);
    Tabmix.bottomToolbarUtils.resizeObserver("customization-container", false);
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
    } else if (aToolboxChanged) {
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
    this.tabStripAreaChanged();
  },

  urlBarInitialized: false,
  initializeURLBar: function TMP_navToolbox_initializeURLBar() {
    if (!gURLBar ||
        document.documentElement.getAttribute("chromehidden").includes("location") ||
        typeof gURLBar.handleCommand == "undefined")
      return;

    // onblur attribute reset each time we exit ToolboxCustomize
    var blur = gURLBar.getAttribute("onblur") || "";
    if (!blur.includes("Tabmix.urlBarOnBlur"))
      Tabmix.setItem(gURLBar, "onblur", blur + "Tabmix.urlBarOnBlur();");

    if (!this.urlBarInitialized) {
      Tabmix.originalFunctions.gURLBar_handleCommand = gURLBar.handleCommand;
      gURLBar.handleCommand = this.handleCommand.bind(gURLBar);
      this.urlBarInitialized = true;
    }
  },

  handleCommand(event, openUILinkWhere, openUILinkParams = {}) {
    let prevTab, prevTabPos;
    let _parseActionUrl = function(aUrl) {
      if (!aUrl.startsWith("mozaction:")) {
        return null;
      }

      // URL is in the format mozaction:ACTION,PARAMS
      // Where PARAMS is a JSON encoded object.
      let [, type, params] = aUrl.match(/^mozaction:([^,]+),(.*)$/);

      let newAction = {type};

      try {
        newAction.params = JSON.parse(params);
        for (const [key, value] of Object.entries(newAction.params)) {
          newAction.params[key] = decodeURIComponent(value);
        }
      } catch (e) {
        // If this failed, we assume that params is not a JSON object, and
        // is instead just a flat string. This may happen for legacy
        // search components.
        newAction.params = {url: params};
      }

      return newAction;
    };
    let action = _parseActionUrl(this.value) || {};
    if (Tabmix.prefs.getBoolPref("moveSwitchToTabNext") &&
        action.type == "switchtab" && this.hasAttribute("actiontype")) {
      prevTab = gBrowser.selectedTab;
      prevTabPos = prevTab._tPos;
    }

    if (!openUILinkWhere) {
      let isMouseEvent = event instanceof MouseEvent;
      let altEnter = !isMouseEvent && event &&
          event.altKey && !gBrowser.selectedTab.isEmpty;
      let where = "current";
      let url = action.params ? action.params.url : this.value;
      let loadNewTab = Tabmix.whereToOpen("extensions.tabmix.opentabfor.urlbar",
        altEnter).inNew && !(/^ *javascript:/.test(url));
      if (isMouseEvent || altEnter || loadNewTab) {
        // Use the standard UI link behaviors for clicks or Alt+Enter
        where = "tab";
        if (isMouseEvent || event && !altEnter)
          where = whereToOpenLink(event, false, false);
        if (loadNewTab && where == "current" || !isMouseEvent && where == "window")
          where = "tab";
        else if (!isMouseEvent && !loadNewTab && /^tab/.test(where))
          where = "current";
      }
      openUILinkWhere = where;
    }

    openUILinkParams.inBackground = Tabmix.prefs.getBoolPref("loadUrlInBackground");
    Tabmix.originalFunctions.gURLBar_handleCommand.call(gURLBar, event, openUILinkWhere, openUILinkParams);

    // move the tab that was switched to after the previously selected tab
    if (typeof prevTabPos == "number") {
      let pos = prevTabPos + Number(gBrowser.selectedTab._tPos > prevTabPos) -
          Number(!prevTab || !prevTab.parentNode);
      gBrowser.moveTabTo(gBrowser.selectedTab, pos);
    }
  },

  whereToOpenSearch(aWhere) {
    var tab = gBrowser.selectedTab;
    var isBlankTab = gBrowser.isBlankNotBusyTab(tab);
    var isLockTab = !isBlankTab && tab.hasAttribute("locked");
    if (aWhere == "current" && isLockTab)
      aWhere = "tab";
    else if (/^tab/.test(aWhere) && isBlankTab)
      aWhere = "current";
    return aWhere;
  },

  initializeSearchbar: function TMP_navToolbox_initializeSearchbar() {
    var searchbar = document.getElementById("searchbar");
    if (!searchbar)
      return;

    let obj, fn, $LF;
    let _handleSearchCommand = searchbar.handleSearchCommand.toString();
    // we check browser.search.openintab also for search button click
    if (_handleSearchCommand.includes("whereToOpenLink") &&
          !_handleSearchCommand.includes("forceNewTab")) {
      $LF = '\n            ';
      Tabmix.changeCode(searchbar, "searchbar.handleSearchCommand")._replace(
        'where = whereToOpenLink(aEvent, false, true);',
        '$&' + $LF +
        'let forceNewTab = where == "current" && Services.prefs.getBoolPref("browser.search.openintab");' + $LF +
        'if (forceNewTab) {' + $LF +
        '  where = "tab";' + $LF +
        '}'
      ).toCode();
    }

    let organizeSE = "organizeSE" in window && "doSearch" in window.organizeSE;
    [obj, fn] = [organizeSE ? window.organizeSE : searchbar, "doSearch"];
    if ("__treestyletab__original_doSearch" in searchbar)
      [obj, fn] = [searchbar, "__treestyletab__original_doSearch"];
    let fnString = obj[fn].toString();
    if (/Tabmix/.test(fnString))
      return;

    // Personas Interactive Theme Engine 1.6.5
    let pIte = fnString.indexOf("BTPIServices") > -1;

    $LF = '\n          ';
    Tabmix.changeCode(obj, "searchbar." + fn)._replace(
      /let params|openUILinkIn/,
      'aWhere = Tabmix.navToolbox.whereToOpenSearch(aWhere);' + $LF +
      '$&'
    )._replace(
      'openUILinkIn',
      'params.inBackground = params.inBackground || Tabmix.prefs.getBoolPref("loadSearchInBackground");' + $LF +
      '$&'
    )._replace(
      /searchbar\.currentEngine/g,
      'this.currentEngine', {check: pIte}
    )._replace(
      /BTPIServices/g,
      'Services', {check: pIte}
    ).toCode();
  },

  toolbarButtons: function TMP_navToolbox_toolbarButtons() {
    gTMPprefObserver.setSingleWindowUI();
    gTMPprefObserver.showReloadEveryOnReloadButton();
    TMP_ClosedTabs.setButtonType(Tabmix.prefs.getBoolPref("undoCloseButton.menuonly"));
  },

  initializeAlltabsPopup: function TMP_navToolbox_initializeAlltabsPopup() {
    let alltabsPopup = document.getElementById("allTabsMenu-allTabsView");
    if (alltabsPopup && !alltabsPopup._tabmix_inited) {
      alltabsPopup._tabmix_inited = true;
      alltabsPopup.setAttribute("context", "tabContextMenu");
      alltabsPopup.__ensureElementIsVisible = function() {
        let scrollBox = this.getElementsByClassName("popup-internal-box")[0];
        scrollBox.ensureElementIsVisible(gBrowser._selectedTab.mCorrespondingMenuitem);
      };
      alltabsPopup.addEventListener("popupshown", alltabsPopup.__ensureElementIsVisible);
    }
  },

  tabStripAreaChanged() {
    /**
     * we need to position three elements in TabsToolbar :
     * tabmix-scrollbox, new-tab-button, and tabmix-tabs-closebutton.
     * we restore tabmix-scrollbox position first since its position is fixed,
     * to be on the safe side we check tabmix-scrollbox position again after we
     * restore tabmix-tabs-closebutton and new-tab-button position.
     */
    this.setScrollButtons();
    try {
      this.setCloseButtonPosition();
    } catch (ex) { }
    gTMPprefObserver.changeNewTabButtonSide(Tabmix.prefs.getIntPref("newTabButton.position"));
    this.setScrollButtons(false, true);

    // reset tabsNewtabButton and afterTabsButtonsWidth
    if (typeof privateTab == "object")
      TMP_eventListener.updateMultiRow(true);
  },

  setScrollButtons(reset, onlyPosition) {
    let box = document.getElementById("tabmix-scrollbox");
    if (!box)
      return;

    if (!reset && box == gBrowser.tabContainer.nextSibling)
      return;

    let tabsPosition = Tabmix.getPlacement("tabbrowser-tabs");
    CustomizableUI.moveWidgetWithinArea("tabmix-scrollbox", tabsPosition + 1);

    if (!onlyPosition) {
      let useTabmixButtons = TabmixTabbar.scrollButtonsMode > TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT;
      Tabmix.tabsUtils.updateScrollButtons(useTabmixButtons);
    }
  },

  _closeButtonInitialized: false,
  setCloseButtonPosition() {
    if (this._closeButtonInitialized)
      return;

    // if tabmix-tabs-closebutton was positioned immediately after
    // tabmix-scrollbox we removed the button on exit, to avoid bug 1034394.
    let pref = "tabs-closeButton-position";
    if (Tabmix.prefs.prefHasUserValue(pref)) {
      let position = Tabmix.prefs.getIntPref(pref);
      Tabmix.prefs.clearUserPref(pref);
      CustomizableUI.moveWidgetWithinArea("tabmix-tabs-closebutton", position);
    } else if (!document.getElementById("tabs-closebutton")) {
      // try to restore button position from tabs-closebutton position
      // if item with tabs-closebutton id exist, some other extension add it
      // will throw if called too early (before placements have been fetched)
      let currentset = CustomizableUI.getWidgetIdsInArea("TabsToolbar");
      let position = currentset.indexOf("tabs-closebutton");
      if (position > -1) {
        CustomizableUI.removeWidgetFromArea("tabs-closebutton");
        CustomizableUI.moveWidgetWithinArea("tabmix-tabs-closebutton", position);
      }
    }
    this._closeButtonInitialized = true;
  }

};

Tabmix.getPlacement = function(id) {
  let placement = CustomizableUI.getPlacementOfWidget(id);
  return placement ? placement.position : null;
};
