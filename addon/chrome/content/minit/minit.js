/* exported TMP_undocloseTabButtonObserver, TMP_TabView */
"use strict";

/****    Drag and Drop observers    ****/
var TMP_tabDNDObserver = {
  draglink: "",
  LinuxMarginEnd: 0,
  _dragTime: 0,
  _dragOverDelay: 350,
  DRAG_LINK: 0,
  DRAG_TAB_TO_NEW_WINDOW: 1,
  DRAG_TAB_IN_SAME_WINDOW: 2,
  TAB_DROP_TYPE: "application/x-moz-tabbrowser-tab",
  paddingLeft: 0,
  _multirowMargin: 0,

  init: function TMP_tabDNDObserver_init() {
    var tabBar = gBrowser.tabContainer;
    if (Tabmix.extensions.verticalTabBar) {
      this.useTabmixDnD = () => false;
      return;
    }

    this._moveTabOnDragging = Tabmix.prefs.getBoolPref("moveTabOnDragging");

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
       let referenceTabWidth = ltrMove ? rightTabWidth : leftTabWidth;`
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
        if (tabmixHandleMove && referenceTabWidth > midWidth) {
          screenX += midWidth / 2;
          if (screenX > tabCenter + referenceTabWidth / 2) {
            high = mid - 1;
          } else if (
            screenX < tabCenter - referenceTabWidth / 2
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

    Tabmix.changeCode(tabBar, "gBrowser.tabContainer.on_dragover")._replace(
      'event.stopPropagation();',
      `$&
      if (TMP_tabDNDObserver.handleDragover(event)) {
        return;
      }`
    )._replace(
      'if (effects == "move") {',
      'if (effects == "move" && !TMP_tabDNDObserver.useTabmixDnD(event)) {'
    )._replace(
      'var newMargin;',
      'var newMargin, newMarginY = 0;'
    )._replace(
      'let newIndex = this._getDropIndex(event, effects == "link");',
      'let {newIndex, mouseIndex} = this._getDropIndex(event, effects == "link", true);'
    )._replace(
      'if (newIndex == children.length) {',
      `const isFirstTabInRow = TMP_tabDNDObserver.isFirstTabInRow(newIndex, mouseIndex, children);
       if (newIndex == children.length || isFirstTabInRow) {`
    )._replace(
      /let tabRect = children[^;]*;/g,
      `$&
      newMarginY = TMP_tabDNDObserver.getDropIndicatorMarginY(ind, tabRect, rect);`
    )._replace(
      'ind.style.transform = "translate(" + Math.round(newMargin) + "px)";',
      'ind.style.transform = "translate(" + Math.round(newMargin) + "px," + Math.round(newMarginY) + "px)";'
    ).toCode();

    Tabmix.changeCode(tabBar, "gBrowser.tabContainer.on_drop")._replace(
      'var dt = event.dataTransfer;',
      `const useTabmixDnD = TMP_tabDNDObserver.useTabmixDnD(event);
       if (useTabmixDnD) {
         TMP_tabDNDObserver.hideDragoverMessage();
       }
       $&`
    )._replace(
      'let newTab = gBrowser.duplicateTab(tab);',
      'let newTab = Tabmix.duplicateTab(tab);'
    )._replace(
      '} else if (draggedTab && draggedTab.container == this) {',
      `gBrowser.ensureTabIsVisible(draggedTabCopy);
        TabmixTabbar.updateBeforeAndAfter();
      } else if (draggedTab && draggedTab.container == this && useTabmixDnD) {
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
      `$&
      if (event.target.id === "tabmix-scrollbox") {
        if (event.originalTarget.id === "scrollbutton-up") newIndex = 0;
        else if (event.originalTarget.id === "scrollbutton-down") newIndex = this.allTabs.length;
      }
      let firstUrl = links[0].url;
      replace =
        !!targetTab || Tabmix.ContentClick.isUrlForDownload(firstUrl);
      if (replace) {
        targetTab =
          event.target.closest("tab.tabbrowser-tab") ||
          this.allTabs[Math.min(newIndex, this.allTabs.length - 1)];
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

    this._dragOverDelay = tabBar._dragOverDelay;
    this.draglink = `Hold ${TabmixSvc.isMac ? "⌘" : "Ctrl"} to replace locked tab with link Url`;

    // without this the Indicator is not visible on the first drag
    tabBar._tabDropIndicator.style.MozTransform = "translate(0px, 0px)";

    // prevent grouping selected tabs for multi row tabbar
    Tabmix.originalFunctions._groupSelectedTabs = tabBar._groupSelectedTabs;
    tabBar._groupSelectedTabs = function() {
      if (TabmixTabbar.visibleRows > 1) return;
      Tabmix.originalFunctions._groupSelectedTabs.apply(this, arguments);
    };

    Tabmix.originalFunctions.on_dragstart = gBrowser.tabContainer.on_dragstart;
    gBrowser.tabContainer.on_dragstart = this.on_dragstart.bind(tabBar);

    Tabmix.originalFunctions.on_dragend = gBrowser.tabContainer.on_dragend;
    gBrowser.tabContainer.on_dragend = this.on_dragend.bind(this);

    Tabmix.originalFunctions.on_dragleave = gBrowser.tabContainer.on_dragleave;
    gBrowser.tabContainer.on_dragleave = this.on_dragleave.bind(this);
  },

  useTabmixDnD(aEvent) {
    const tabBar = gBrowser.tabContainer;
    return (
      tabBar.getAttribute("orient") == "horizontal" &&
      (!this._moveTabOnDragging ||
        tabBar.hasAttribute("multibar") ||
        aEvent.dataTransfer.mozTypesAt(0)[0] !== this.TAB_DROP_TYPE)
    );
  },

  handleEvent(event) {
    let methodName = `on_${event.type}`;
    if (methodName in this) {
      this[methodName](event);
    } else {
      throw new Error(`Unexpected event ${event.type}`);
    }
  },

  // on_dragstart is bound to gBrowser.tabContainer
  on_dragstart(event) {
    const tab = this._getDragTargetTab(event, false);
    if (!tab || this._isCustomizing) {
      return;
    }

    TabmixTabbar.removeShowButtonAttr();
    Tabmix.originalFunctions.on_dragstart.apply(this, [event]);

    if (TabmixTabbar.visibleRows === 1 && TabmixTabbar.position === 0) {
      return;
    }

    const windowUtils = window.windowUtils;
    const scale = windowUtils.screenPixelsPerCSSPixel / windowUtils.fullZoom;
    let dragImageOffsetX = -16;
    let dragImageOffsetY = TabmixTabbar.visibleRows == 1 ? -16 : -30;
    let toDrag = this._dndCanvas;
    if (gMultiProcessBrowser) {
      const platform = AppConstants.platform;
      if (platform !== "win" && platform !== "macosx") {
        toDrag = this._dndPanel;
      }
    } else {
      dragImageOffsetX *= scale;
      dragImageOffsetY *= scale;
    }
    if (TabmixTabbar.position == 1) {
      dragImageOffsetY = this._dndCanvas.height - dragImageOffsetY;
    }
    const captureListener = function() {
      event.dataTransfer.updateDragImage(toDrag, dragImageOffsetX, dragImageOffsetY);
    };
    PageThumbs.captureToCanvas(tab.linkedBrowser, this._dndCanvas)
        .then(captureListener)
        .catch(e => Cu.reportError(e));
  },

  // we call this function from gBrowser.tabContainer.on_dragover
  handleDragover(event) {
    if (this._dragoverScrollButton(event)) {
      return true;
    }

    const tabBar = gBrowser.tabContainer;
    const effects = tabBar._getDropEffectForTabDrag(event);
    const dt = event.dataTransfer;
    const isCopy = dt.dropEffect == "copy";
    const targetTab = tabBar._getDragTargetTab(event, true);

    let disAllowDrop = false;
    /* we don't allow to drop link on lock tab.
     * unless:
     *           - the tab is blank
     *     or    - the user press Ctrl/Meta Key
     *     or    - we drop link that start download
     */
    if (effects == "link" && targetTab && !isCopy) {
      if (targetTab.getAttribute("locked") && !gBrowser.isBlankNotBusyTab(targetTab)) {
        // Pass true to disallow dropping javascript: or data: urls
        try {
          const links = browserDragAndDrop.dropLinks(event, true);
          const url = links && links.length ? links[0].url : null;
          disAllowDrop = url ? !Tabmix.ContentClick.isUrlForDownload(url) : true;
        } catch (ex) {}

        if (disAllowDrop) {
          // show Drag & Drop message
          let tooltip = document.getElementById("tabmix-tooltip");
          if (tooltip.state == "closed") {
            tooltip.label = this.draglink;
            tooltip.openPopup(document.getElementById("browser"), null, 1, 1, false, false);
          }
        }
      }
    }

    // disAllowDrop drop when user drag link over tabbrowser-tabs multi-row margin
    if (effects == "link" && !targetTab && !disAllowDrop && TabmixTabbar.visibleRows > 1) {
      const {top, bottom} = tabBar.arrowScrollbox.getBoundingClientRect();
      if (event.clientY < top + this._multirowMargin || event.clientY > bottom - this._multirowMargin) {
        disAllowDrop = true;
      }
    }

    if (!disAllowDrop) {
      this.hideDragoverMessage();
      const {dragType, oldIndex, newIndex} = this.eventParams(event);
      if (!isCopy && dragType == this.DRAG_TAB_IN_SAME_WINDOW &&
        (oldIndex === newIndex || newIndex - oldIndex === 1)) {
        disAllowDrop = true;
      } else if (TabmixTabbar.scrollButtonsMode == TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT &&
        // if we don't set effectAllowed to none then the drop indicator stay
        gBrowser.tabs[0].pinned &&
        Tabmix.compare(event.screenX, Tabmix.itemEnd(gBrowser.tabs[0], !Tabmix.ltr), Tabmix.ltr)) {
        disAllowDrop = true;
      }
    }

    if (disAllowDrop) {
      this.clearDragmark();
      dt.effectAllowed = "none";
    }

    return disAllowDrop;
  },

  on_dragend(event) {
    this.clearDragmark();

    // don't allow to open new window in single window mode
    // respect bug489729 extension preference
    const disableDetachTab =
        window.bug489729 && Services.prefs.getBoolPref("extensions.bug489729.disable_detach_tab") ||
        Tabmix.singleWindowMode && gBrowser.tabs.length > 1;

    let tabBar = gBrowser.tabContainer;
    if (!disableDetachTab) {
      // fall back to default Firefox event handler
      Tabmix.originalFunctions.on_dragend.apply(tabBar, [event]);
      return;
    }

    event.stopPropagation();

    var dt = event.dataTransfer;
    var draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);

    if (!this.useTabmixDnD(event)) {
      // Prevent this code from running if a tabdrop animation is
      // running since calling _finishAnimateTabMove would clear
      // any CSS transition that is running.
      if (draggedTab.hasAttribute("tabdrop-samewindow")) {
        return;
      }

      tabBar._finishGroupSelectedTabs(draggedTab);
      tabBar._finishAnimateTabMove();
    }

    if (dt.mozUserCancelled || dt.dropEffect != "none" || tabBar._isCustomizing) {
      delete draggedTab._dragData;
    }
  },

  on_dragleave(event) {
    this._dragTime = 0;
    this.hideDragoverMessage();
    Tabmix.originalFunctions.on_dragleave.apply(gBrowser.tabContainer, [event]);
  },

  _dragoverScrollButton(event) {
    if (!Tabmix.tabsUtils.overflow) {
      return false;
    }

    this.clearDragmark();

    if (TabmixTabbar.scrollButtonsMode === TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT) {
      if (["scrollbutton-up", "scrollbutton-down"].includes(event.originalTarget.id)) {
        return false;
      }
    }

    let tabBar = gBrowser.tabContainer;
    let tabStrip = tabBar.arrowScrollbox;
    let ltr = Tabmix.ltr || TabmixTabbar.visibleRows > 1;
    let scrollDirection, targetAnonid;
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
        scrollDirection = -1;
        break;
      case "scrollbutton-down":
      case "scrollbutton-down-right":
        scrollDirection = 1;
        break;
    }
    if (scrollDirection) {
      let scrollIncrement = TabmixTabbar.isMultiRow ?
        Math.round(tabStrip._singleRowHeight / 8) : tabStrip.scrollIncrement;
      tabStrip.scrollByPixels((ltr ? scrollDirection : -scrollDirection) * scrollIncrement, true);
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    return false;
  },

  hideDragoverMessage() {
    document.getElementById("tabmix-tooltip").hidePopup();
  },

  _getDropIndex(event, aLink, asObj) {
    const tabBar = gBrowser.tabContainer;
    if (!asObj && !this.useTabmixDnD(event)) {
      return Tabmix.originalFunctions._getDropIndex.apply(tabBar, arguments);
    }
    const params = this.eventParams(event);
    return asObj ? params : params.newIndex;
  },

  eventParams(event) {
    const tabBar = gBrowser.tabContainer;
    const dt = event.dataTransfer;
    const sourceNode = this.getSourceNode(dt);
    const dragType = this.getDragType(sourceNode);
    const tab = dragType != this.DRAG_LINK && sourceNode;
    const oldIndex = tab ? tab._tPos : -1;
    let newIndex = this._getDNDIndex(event);
    const mouseIndex = newIndex;

    if (newIndex < gBrowser.tabs.length) {
      newIndex += this.getLeft_Right(event, newIndex, oldIndex, dragType);
    } else {
      newIndex =
        dragType != this.DRAG_TAB_IN_SAME_WINDOW &&
        Tabmix.getOpenTabNextPref(dragType == this.DRAG_LINK) ?
          tabBar.selectedIndex + 1 : gBrowser.tabs.length;
    }

    return {
      sourceNode,
      dragType,
      tab,
      oldIndex,
      newIndex,
      mouseIndex,
    };
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
      const {height} = tabStrip.getBoundingClientRect();
      const top = tabStrip.screenY;
      if (mY >= top + height - this._multirowMargin) {
        mY = top + height - this._multirowMargin - 1;
      } else if (mY <= top + this._multirowMargin) {
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
    var tab = gBrowser.tabs[newIndex];
    const {width} = tab.getBoundingClientRect();
    const [_left, _right] = RTL_UI ? [1, 0] : [0, 1];
    let left_right = (mX < tab.screenX + width / 2) ? _left : _right;
    const isCopy = event.dataTransfer.dropEffect == "copy";
    if (
      !isCopy &&
      dragType == this.DRAG_TAB_IN_SAME_WINDOW &&
      newIndex == oldIndex + 1
    ) {
      left_right = 1;
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

  getDropIndicatorMarginY(ind, tabRect, rect) {
    if (TabmixTabbar.visibleRows === 1) {
      return 0;
    }

    let newMarginY;
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

    return newMarginY;
  },

  isFirstTabInRow(newIndex, mouseIndex, children) {
    if (
      TabmixTabbar.visibleRows === 1 ||
      newIndex === 0 ||
      newIndex === children.length ||
      newIndex === mouseIndex
    ) {
      return false;
    }

    const topY = Tabmix.tabsUtils.topTabY;
    const rowA = Tabmix.tabsUtils.getTabRowNumber(children[mouseIndex], topY);
    const rowB = Tabmix.tabsUtils.getTabRowNumber(children[newIndex], topY);
    return rowA < rowB;
  },

  clearDragmark() {
    gBrowser.tabContainer._tabDropIndicator.hidden = true;
  },

  getSourceNode: function TMP_getSourceNode(aDataTransfer) {
    var types = aDataTransfer.mozTypesAt(0);
    if (types[0] == this.TAB_DROP_TYPE)
      return aDataTransfer.mozGetDataAt(this.TAB_DROP_TYPE, 0);
    return null;
  },
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
    let tooltip = document.getElementById("tabmix-tooltip");
    if (tooltip.state == "closed") {
      tooltip.label = label;
      tooltip.openPopup(aEvent.target, "before_start", -1, -1, false, false);
    }

    aEvent.target.setAttribute("dragover", "true");
    return true;
  },

  onDragExit(aEvent) {
    if (aEvent.target.hasAttribute("dragover")) {
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
    this.duplicateTab(gBrowser._selectedTab);
  else if (aEvent.button != 2)
    gURLBar.handleCommand(aEvent);
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

          if (aNode.id === "tabmix-closedTabs-toolbaritem") {
            TMP_ClosedTabs.setButtonType(Tabmix.prefs.getBoolPref("undoCloseButton.menuonly"));
          }
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
      gURLBar.view._rows.addEventListener("mouseup", event => {
        this.on_mouseup(event);
      }, {capture: true});
      this.urlBarInitialized = true;
    }
  },

  handleCommand(event, openUILinkWhere, openUILinkParams = {}) {
    let prevTab, prevTabPos;
    let element = this.view.selectedElement;
    let result = this.view.getResultFromElement(element);
    if (Tabmix.prefs.getBoolPref("moveSwitchToTabNext") &&
        result?.type === UrlbarUtils.RESULT_TYPE.TAB_SWITCH && this.hasAttribute("actiontype")) {
      prevTab = gBrowser.selectedTab;
      prevTabPos = prevTab._tPos;
    }

    if (!openUILinkWhere) {
      let isMouseEvent = event instanceof MouseEvent;
      let altEnter = !isMouseEvent && event &&
          event.altKey && !gBrowser.selectedTab.isEmpty;
      let where = "current";
      let url = result?.payload?.url ?? this.value;
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

  on_mouseup(event) {
    // based on:
    // - gURLBar.view._on_mouseup (UrlbarView.jsm)
    // - gURLBar.pickResult (UrlbarInput.jsm)
    if (event.button == 2 || !Tabmix.prefs.getBoolPref("moveSwitchToTabNext")) {
      return;
    }

    const element = gURLBar.view.getClosestSelectableElement(event.target);
    const result = element && gURLBar.view.getResultFromElement(element);
    if (!result) {
      return;
    }

    if (
      result.heuristic &&
      gURLBar.searchMode?.isPreview &&
      gURLBar.view.oneOffSearchButtons.selectedButton
    ) {
      return;
    }

    let urlOverride;
    if (element?.classList.contains("urlbarView-help")) {
      urlOverride = result.payload.helpUrl;
    }
    const isCanonized = gURLBar.setValueFromResult({
      result,
      event,
      urlOverride,
    });
    if (isCanonized) {
      return;
    }

    if (result.type === UrlbarUtils.RESULT_TYPE.TAB_SWITCH) {
      // move switched to tab only when it is in the same window
      const resultUrl = result.payload?.url;
      const inSameWindow = gBrowser.browsers.some(browser => {
        return browser.currentURI.displaySpec === resultUrl;
      });
      if (inSameWindow) {
        const prevTab = gBrowser.selectedTab;
        const prevTabPos = prevTab._tPos;
        gBrowser.tabContainer.addEventListener(
          "TabSelect",
          () => {
            const pos =
              prevTabPos +
              Number(gBrowser.selectedTab._tPos > prevTabPos) -
              Number(!prevTab || !prevTab.parentNode);
            gBrowser.moveTabTo(gBrowser.selectedTab, pos);
          },
          {once: true}
        );
      }
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
      'let params',
      'aWhere = Tabmix.navToolbox.whereToOpenSearch(aWhere);' + $LF +
      '$&'
    )._replace(
      'openTrustedLinkIn',
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
