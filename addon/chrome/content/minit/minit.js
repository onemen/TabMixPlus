/* exported TMP_undocloseTabButtonObserver */
"use strict";

/****    Drag and Drop observers    ****/
/** @type {TabDNDObserver} */
var TMP_tabDNDObserver = {
  draglink: "",
  LinuxMarginEnd: 0,
  _dragTime: 0,
  _dragOverDelay: 350,
  DRAG_LINK: 0,
  DRAG_TAB_TO_NEW_WINDOW: 1,
  DRAG_TAB_IN_SAME_WINDOW: 2,
  draggingTimeout: 0,
  paddingLeft: 0,
  _multirowMargin: 0,
  _moveTabOnDragging: true,

  init: function TMP_tabDNDObserver_init() {
    var tabBar = gBrowser.tabContainer;
    if (Tabmix.extensions.verticalTabBar) {
      this.useTabmixDnD = () => false;
      return;
    }

    const makeCode = (function() {
      let _make;
      if (Tabmix.isVersion(1370)) {
        // @ts-expect-error
        // eslint-disable-next-line no-unused-vars
        const isTab = element => element.tagName == "tab";

        // @ts-expect-error
        // eslint-disable-next-line no-unused-vars
        const isTabGroupLabel = element => element.classList?.contains("tab-group-label") ?? false;

        _make = eval(Tabmix._localMakeCode);
      } else if (Tabmix.isVersion(1340)) {
        // Since Firefox 134, tabs.js contains scoped constants for group drop actions:
        // - GROUP_DROP_ACTION_CREATE: used in on_drop and triggerDragOverCreateGroup
        // - GROUP_DROP_ACTION_APPEND: used in on_drop and _animateTabMove

        // @ts-expect-error
        // eslint-disable-next-line no-unused-vars
        const GROUP_DROP_ACTION_CREATE = 0x1;
        // @ts-expect-error
        // eslint-disable-next-line no-unused-vars
        const GROUP_DROP_ACTION_APPEND = 0x2;

        _make = eval(Tabmix._localMakeCode);
      } else {
        _make = Tabmix._makeCode;
      }

      /** @param {string | Function} code */
      return function(code) {
        return _make(null, code.toString());
      };
    }());

    this._moveTabOnDragging = Tabmix.prefs.getBoolPref("moveTabOnDragging");

    Tabmix.getMovingTabsWidth = movingTabs => {
      return movingTabs.reduce((width, tab) => {
        return width + tab.getBoundingClientRect().width;
      }, 0);
    };

    if (Tabmix.isVersion(1310)) {
      // create none private method in gBrowser.tabContainer
      // we will use instead of #rtlMode in:
      //  gBrowser.tabContainer._animateTabMove
      //  gBrowser.tabContainer.on_dragover
      Object.defineProperty(gBrowser.tabContainer, "_rtlMode", {
        get() {
          return !this.verticalMode && RTL_UI;
        },
        configurable: true,
        enumerable: true,
      });
    }

    if (Tabmix.isVersion(1320)) {
      // create none private method in gBrowser.tabContainer
      // we will use instead of #isContainerVerticalPinnedExpanded in:
      //  gBrowser.tabContainer.on_dragover
      //  gBrowser.tabContainer.on_drop
      Object.defineProperty(gBrowser.tabContainer, "_isContainerVerticalPinnedExpanded", {
        /** @param {Tab} tab */
        value(tab) {
          return (
            this.verticalMode &&
            tab.hasAttribute("pinned") &&
            this.hasAttribute("expanded")
          );
        },
        configurable: true,
        enumerable: true,
      });

      // this function is just a place holder we don't use it in vertical mode
      gBrowser.tabContainer._animateExpandedPinnedTabMove = function() {};
    }

    if (Tabmix.isVersion(1330)) {
      gBrowser.tabContainer._setDragOverGroupColor = Tabmix.getPrivateMethod(
        "tabbrowser-tabs",
        "setDragOverGroupColor",
        "_finishAnimateTabMove"
      );

      gBrowser.tabContainer._isAnimatingMoveTogetherSelectedTabs = Tabmix.getPrivateMethod(
        "tabbrowser-tabs",
        "isAnimatingMoveTogetherSelectedTabs",
        "handleEvent"
      );
    } else {
      // prevent grouping selected tabs for multi row tabbar
      Tabmix.originalFunctions._groupSelectedTabs = tabBar._groupSelectedTabs;
      /** @type {typeof tabBar._groupSelectedTabs} */
      tabBar._groupSelectedTabs = function(...args) {
        if (TabmixTabbar.visibleRows > 1) return;
        Tabmix.originalFunctions._groupSelectedTabs.apply(this, args);
      };
    }

    if (Tabmix.isVersion(1340)) {
      gBrowser.tabContainer._clearDragOverCreateGroupTimer = Tabmix.getPrivateMethod(
        "tabbrowser-tabs",
        "clearDragOverCreateGroupTimer",
        "#setDragOverGroupColor"
      );

      gBrowser.tabContainer._dragOverCreateGroupTimer = 0;

      gBrowser.tabContainer._triggerDragOverCreateGroup = makeCode(Tabmix.getPrivateMethod(
        "tabbrowser-tabs",
        "triggerDragOverCreateGroup",
        "#clearDragOverCreateGroupTimer"
      ));
    }

    function tabmixHandleMoveString() {
      const baseTest = 'this.getAttribute("orient") === "horizontal" && TabmixTabbar.widthFitTitle';
      if (Tabmix.isVersion(1300)) {
        return `!this.verticalMode && ${baseTest}`;
      }
      if (Tabmix.isVersion({fp: "128.0.0"})) {
        return `!verticalTabbarEnabled() &&  ${baseTest}`;
      }
      return baseTest;
    }

    // Determine what tab we're dragging over.
    // * In tabmix tabs can have different width
    // * Point of reference is the start of the dragged tab/tabs when
    //   dragging left and the end when dragging right. If that point
    //   is before (for dragging left) or after (for dragging right)
    //   the middle of a background tab, the dragged tab would take that
    //   tab's position when dropped.
    const _animateTabMove = Tabmix.changeCode(tabBar, "gBrowser.tabContainer._animateTabMove")._replace(
      /(?:const|let) draggedTab/,
      `let tabmixHandleMove = ${tabmixHandleMoveString()};
      $&`
    )._replace(
      'this.selectedItem = draggedTab;',
      'if (Tabmix.prefs.getBoolPref("selectTabOnMouseDown"))\n\
            $&\n\
          else if (!draggedTab.selected) {\n\
            this.setAttribute("tabmix-movingBackgroundTab", true);\n\
            draggedTab.setAttribute("tabmix-dragged", true);\n\
          }'
    )._replace(
      `if (${Tabmix.isVersion(1300) ? "screen" : "screenX"} > tabCenter) {`,
      `let midWidth = tabs[mid].getBoundingClientRect().width;
        if (tabmixHandleMove && referenceTabWidth > midWidth) {
          _screenX += midWidth / 2;
          if (_screenX > tabCenter + referenceTabWidth / 2) {
            high = mid - 1;
          } else if (
            _screenX < tabCenter - referenceTabWidth / 2
          ) {
            low = mid + 1;
          } else {
            newIndex = tabs[mid]._tPos;
            break;
          }
          continue;
        }
        $&`.replace(/_screenX/g, Tabmix.isVersion(1300) ? "screen" : "screenX"),
      {check: !Tabmix.isVersion(1330)}
    )._replace(
      Tabmix.isVersion(1340) || !Tabmix.isVersion(1330) ?
        'newIndex >= oldIndex' :
        'index >= oldIndex',
      Tabmix.isVersion(1330) ?
        `!tabmixHandleMove ? $& : ${Tabmix.isVersion(1340) ? "newIndex" : "index"} > -1 && (RTL_UI !== directionForward)` :
        `!tabmixHandleMove ? $& : newIndex > -1 && (RTL_UI !== ${Tabmix.isVersion(1300) ? "directionMove" : "ltrMove"})`,
      {check: !Tabmix.isVersion(1370)}
    );

    if (Tabmix.isVersion(1370)) {
      gBrowser.tabContainer._animateTabMove = makeCode(_animateTabMove.value);
    } else if (Tabmix.isVersion(1300)) {
      // Firefox 133-136
      // NOTE: firstMovingTabScreen and lastMovingTabScreen was swapped in version 1330
      const referenceTabString = Tabmix.isVersion(1330) ?
        'referenceTabEdge = (directionForward ? lastMovingTabScreen + rightTabWidth : firstMovingTabScreen) + translate;' :
        'referenceTabWidth = directionMove ? rightTabWidth : leftTabWidth';
      _animateTabMove._replace(
        `let translate = screen - ${Tabmix.isVersion(1330) ? "dragData" : "draggedTab._dragData"}[screenAxis];`,
        `$&
         let rightTabWidth, leftTabWidth, ${Tabmix.isVersion(1330) ? "referenceTabEdge" : "referenceTabWidth"};
         if (!this.verticalMode) {
           shiftSize = Tabmix.getMovingTabsWidth(movingTabs);
           draggedTab._dragData.shiftWidth = shiftSize;
           rightTabWidth = movingTabs.at(-1).getBoundingClientRect().width;
           leftTabWidth = movingTabs[0].getBoundingClientRect().width;
           ${referenceTabString}
         }`
      )._replace(
        /\((.*)MovingTabScreen \+ tabSize\)/,
        '($1MovingTabScreen + (this.verticalMode ? tabSize : rightTabWidth))'
      );

      if (Tabmix.isVersion(1330)) {
        // Firefox 133+
        _animateTabMove._replace(
          'lastMovingTabScreen + tabSize *',
          'lastMovingTabScreen + (this.verticalMode ? tabSize : rightTabWidth) *'
        )._replace(
          'firstMovingTabScreen + tabSize *',
          'firstMovingTabScreen + (this.verticalMode ? tabSize : leftTabWidth) *'
        )._replace(
          'if (screen > point) {',
          `if (tabmixHandleMove) {
              let midWidth = tabs[mid].getBoundingClientRect().width;
              if (screen > referenceTabEdge) {
                high = mid - 1;
              } else if (screen + midWidth < referenceTabEdge) {
                low = mid + 1;
              } else {
                let thresholdCrossed = directionForward ? screen + midWidth * tabSizeDragOverThreshold < referenceTabEdge
                  : screen + midWidth * (1- tabSizeDragOverThreshold) > referenceTabEdge;
                if (thresholdCrossed) {
                  index = tabs[mid]._tPos;
                }
                break;
              }
              continue;
            }
            $&`
        );

        if (!Tabmix.isVersion(1340)) {
          // Firefox 133 only
          _animateTabMove._replace(
            /tabSizeDragOverThreshold/g,
            'point'
          )._replace(
            'tabDropIndexFromPoint(tabCenter)',
            'tabDropIndexFromPoint(tabmixHandleMove ? (gBrowser._tabGroupsEnabled ? 0.7 : 0.5) : tabCenter)'
          )._replace(
            'tabDropIndexFromPoint(groupPoint)',
            'tabDropIndexFromPoint(tabmixHandleMove ? dragOverGroupingThreshold : groupPoint)'
          )._replace(
            // temporary fix bug in Firefox 133.0b9 - 2024-11-25
            'this.allTabs[dragData.animDropIndex].group',
            'this.allTabs[dragData.animDropIndex]?.group',
            {silent: true}
          );
        }
      }

      if (Tabmix.isVersion(1340)) {
        gBrowser.tabContainer._animateTabMove = makeCode(_animateTabMove.value);
      } else {
        // Firefox 130 - 133
        _animateTabMove._replace(
          /let firstTabCenter = (.*)tabSize \/ 2;/,
          'let firstTabCenter = $1(this.verticalMode ? tabSize / 2 : leftTabWidth / 2);'
        )._replace(
          /let lastTabCenter = (.*)tabSize \/ 2;/,
          'let lastTabCenter = $1(this.verticalMode ? tabSize / 2 : rightTabWidth / 2);'
        ).toCode();
      }
    } else {
      // helper function to get floorp strings for width in vertical mode
      /** @param {string} vertical @param {string} horizontal */
      const getWidthString = (vertical, horizontal) => (Tabmix.isVersion({fp: "128.0.0"}) ?
        `(verticalTabbarEnabled() ? ${vertical} : ${horizontal})` :
        horizontal);
      _animateTabMove._replace(
        /(?:const|let) shiftWidth = tabWidth \* movingTabs\.length;/,
        `let shiftWidth = tabmixHandleMove ? Tabmix.getMovingTabsWidth(movingTabs) : tabWidth * movingTabs.length;
         draggedTab._dragData.shiftWidth = shiftWidth;
         let rightTabWidth = movingTabs[movingTabs.length - 1].getBoundingClientRect().width;
         let leftTabWidth = movingTabs[0].getBoundingClientRect().width;
         let referenceTabWidth = ltrMove ? rightTabWidth : leftTabWidth;`
      )._replace(
        '(rightMovingTabScreenX + tabWidth)',
        `(rightMovingTabScreenX + ${getWidthString("tabWidth", "rightTabWidth")})`,
      )._replace(
        /(?:const|let) leftTabCenter =.*;/,
        `let leftTabCenter = leftMovingTabScreenX + translateX + ${getWidthString("tabWidth / 2", "leftTabWidth / 2")};`
      )._replace(
        /(?:const|let) rightTabCenter =.*;/,
        `let rightTabCenter = rightMovingTabScreenX + translateX + ${getWidthString("tabWidth / 2", "rightTabWidth / 2")};`
      ).toCode();
    }

    const dragoverCode = Tabmix.changeCode(tabBar, "gBrowser.tabContainer.on_dragover")._replace(
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
      /(?:const|let) newIndex = this\._getDropIndex\(event.*\);/,
      'let {newIndex, addWidth} = this._getDropIndex(event, {dragover: true, children: this.allTabs});'
    )._replace(
      /(?:const|let) tabRect = children[^;]*;/g,
      `$&
      newMarginY = TMP_tabDNDObserver.getDropIndicatorMarginY(ind, tabRect, rect);`,
    )._replace(
      // there is bug in firefox when swapping margin for RTL
      /\[minMargin, maxMargin\]\s=[^;]*;/,
      '[minMargin, maxMargin] = [minMargin, maxMargin]'
    )._replace(
      // fix for the case user drag pinned tab to a scroll button
      'newMargin = pixelsToScroll > 0 ? maxMargin : minMargin;',
      `if (draggedTab?.pinned) {
          let tabRect = gBrowser.visibleTabs[gBrowser.pinnedTabCount - 1].getBoundingClientRect();
          newMargin = RTL_UI ? rect.right - tabRect.left : tabRect.right - rect.left;
        } else {
          $&
        }`
    )._replace(
      /newMargin = (rect.right|tabRect.right|tabRect.left) - (rect.left|tabRect.right|tabRect.left)/g,
      'newMargin = TMP_tabDNDObserver.getDropIndicatorMarginX(draggedTab, newIndex, addWidth, tabRect, rect, $1 - $2)'
    )._replace(
      'ind.style.transform = "translate(" + Math.round(newMargin) + "px)";',
      'ind.style.transform = "translate(" + Math.round(newMargin) + "px," + Math.round(newMarginY) + "px)";',
      {check: !Tabmix.isVersion(1300)}
    )._replace(
      /ind\.style\.transform\s=[^;]*;/,
      `ind.style.transform = this.verticalMode
         ? "translateY(" + Math.round(newMargin) + "px)"
         : "translate(" + Math.round(newMargin) + "px," + Math.round(newMarginY) + "px)";`,
      {check: Tabmix.isVersion(1300)}
    );

    const dropCode = Tabmix.changeCode(tabBar, "gBrowser.tabContainer.on_drop")._replace(
      'var dt = event.dataTransfer;',
      `if (TMP_tabDNDObserver.finishButtonScroll(event))  {
        return;
      }
      const useTabmixDnD = TMP_tabDNDObserver.useTabmixDnD(event);
       if (useTabmixDnD) {
         TMP_tabDNDObserver.hideDragoverMessage();
       }
       $&`
    )._replace(
      'newTab = gBrowser.duplicateTab(tab);',
      'newTab = Tabmix.duplicateTab(tab);'
    )._replace(
      '} else if (draggedTab && draggedTab.container == this) {',
      `gBrowser.ensureTabIsVisible(draggedTabCopy);
      } else if (draggedTab && draggedTab.container == this && useTabmixDnD) {
        let oldIndex = draggedTab._tPos;
        let newIndex = this._getDropIndex(event, {dragover: false});
        let moveLeft = newIndex < oldIndex;
        if (!moveLeft) newIndex -= 1;
        for (let tab of movingTabs) {
          gBrowser.moveTabTo(tab, newIndex);
          if (moveLeft) newIndex++;
        }
        TabmixTabbar.updateScrollStatus();
        gBrowser.ensureTabIsVisible(draggedTab);
      $&`
    )._replace(
      Tabmix.isVersion(1300) ? Tabmix.isVersion(1320) ? 'let shouldTranslate' : 'if (oldTranslate && oldTranslate' : 'if (oldTranslateX && oldTranslateX',
      `let refTab = this.allTabs[dropIndex];
       if (!this.verticalMode && refTab) {
         let firstMovingTab = RTL_UI ? movingTabs[movingTabs.length - 1] : movingTabs[0];
           _newTranslateX = RTL_UI && dropIndex < firstMovingTab._tPos || !RTL_UI && dropIndex > firstMovingTab._tPos
             ? refTab.screenX + refTab.getBoundingClientRect().width - firstMovingTab.screenX - draggedTab._dragData.shiftWidth
             : refTab.screenX - firstMovingTab.screenX;
           _newTranslateX = Math.round(_newTranslateX);
       }
      $&`.replace(/_newTranslateX/g, Tabmix.isVersion(1300) && !Tabmix.isVersion(1320) ? "newTranslate" : "newTranslateX"),
    )._replace(
      /urls = links.map\(\(?link\)? => link.url\);/,
      `$&
      if (event.target.id === "tabmix-scrollbox") {
        if (event.originalTarget.id === "scrollbutton-up") newIndex = 0;
        else if (event.originalTarget.id === "scrollbutton-down") newIndex = this.allTabs.length;
      }
      let firstUrl = urls[0];
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
    );

    /**
     * @param {"on_dragover" | "on_drop"} name
     * @param {ChangeCodeNS.ChangeCodeClass} code
     */
    function patchDragMethod(name, code) {
      if (Tabmix.isVersion(1320)) {
        Tabmix.originalFunctions[`_tabmix_${name}`] = makeCode(code.value);
        Tabmix.originalFunctions[name] = gBrowser.tabContainer[name];
        gBrowser.tabContainer[name] = function tabmix_patchDragMethod(event) {
          const methodName = this.verticalMode ? name : `_tabmix_${name}`;
          Tabmix.originalFunctions[methodName].apply(this, [event]);
        };
      } else {
        code.toCode(false, gBrowser.tabContainer, name);
      }
    }

    patchDragMethod("on_dragover", dragoverCode);
    patchDragMethod("on_drop", dropCode);

    Tabmix.originalFunctions._getDropIndex = gBrowser.tabContainer._getDropIndex;
    gBrowser.tabContainer._getDropIndex = this._getDropIndex.bind(this);

    Tabmix.originalFunctions._finishAnimateTabMove = gBrowser.tabContainer._finishAnimateTabMove;
    gBrowser.tabContainer._finishAnimateTabMove = function(...args) {
      Tabmix.originalFunctions._finishAnimateTabMove.apply(this, args);
      this.removeAttribute("tabmix-movingBackgroundTab");
      const tabs = this.querySelectorAll("[tabmix-dragged]");
      tabs.forEach(tab => tab?.removeAttribute("tabmix-dragged"));
    };

    this._dragOverDelay = tabBar._dragOverDelay;
    this.draglink = `Hold ${TabmixSvc.isMac ? "⌘" : "Ctrl"} to replace locked tab with link Url`;

    // without this the Indicator is not visible on the first drag
    tabBar._tabDropIndicator.style.transform = "translate(0px, 0px)";

    Tabmix.originalFunctions.on_dragstart = gBrowser.tabContainer.on_dragstart;
    gBrowser.tabContainer.on_dragstart = this.on_dragstart.bind(tabBar);

    Tabmix.originalFunctions.on_dragend = gBrowser.tabContainer.on_dragend;
    gBrowser.tabContainer.on_dragend = this.on_dragend.bind(this);

    Tabmix.originalFunctions.on_dragleave = gBrowser.tabContainer.on_dragleave;
    gBrowser.tabContainer.on_dragleave = this.on_dragleave.bind(this);
  },

  useTabmixDnD(event, tab) {
    const tabBar = gBrowser.tabContainer;
    if (tabBar.getAttribute("orient") !== "horizontal") {
      return false;
    }
    if (!this._moveTabOnDragging) {
      return true;
    }
    // don't use mozGetDataAt before gBrowser.tabContainer.startTabDrag
    const draggedTab = tab ?? event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
    if (draggedTab?.pinned && Tabmix.tabsUtils.lastPinnedTabRowNumber === 1) {
      return false;
    }
    return TabmixTabbar.hasMultiRows || !draggedTab;
  },

  handleEvent(event) {
    let methodName = `on_${event.type}`;
    if (methodName in this) {
      // @ts-expect-error - methodName exist in this but not in the type
      this[methodName](event);
    } else {
      throw new Error(`Unexpected event ${event.type}`);
    }
  },

  // on_dragstart is bound to gBrowser.tabContainer
  on_dragstart(event) {
    const tab = this._getDragTargetTab(event);
    if (!tab || this._isCustomizing) {
      return;
    }

    // Prevent animation when grouping selected tabs for multi-row tab bar
    const currentReduceMotion = gReduceMotionSetting;
    const selectedTabs = gBrowser.selectedTabs;
    if (selectedTabs.length > 1) {
      if (TMP_tabDNDObserver.useTabmixDnD(event, tab)) {
        gReduceMotionSetting = true;
      } else if (tab.pinned && TabmixTabbar.hasMultiRows) {
        // reduce motion if some of the selected tabs are not in the first row
        const topY = Tabmix.tabsUtils.topTabY;
        gReduceMotionSetting = selectedTabs.some(
          t => !t.pinned && Tabmix.tabsUtils.getTabRowNumber(t, topY) > 1
        );
      }
    }

    TabmixTabbar.removeShowButtonAttr();
    Tabmix.originalFunctions.on_dragstart.apply(this, [event]);
    gReduceMotionSetting = currentReduceMotion;

    if (TabmixTabbar.visibleRows === 1 && TabmixTabbar.position === 0) {
      return;
    }

    const scale = window.devicePixelRatio;
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
        .catch(e => console.error(e));
  },

  // we call this function from gBrowser.tabContainer.on_dragover
  handleDragover(event) {
    const tabBar = gBrowser.tabContainer;
    const arrowScrollbox = tabBar.arrowScrollbox;
    if (
      TabmixTabbar.visibleRows > 1 &&
      !arrowScrollbox.hasAttribute("tabmix-dragging")
    ) {
      const attribute = Tabmix.prefs.getBoolPref("tabScrollOnTopBottomDrag") ?
        "enable-scroll-buttons" :
        "true";
      arrowScrollbox.setAttribute("tabmix-dragging", attribute);
      const {top, bottom, left, right} = arrowScrollbox.scrollClientRect;
      const scrollHeight = arrowScrollbox.singleRowHeight / 2;
      arrowScrollbox._lockScroll =
        event.screenY - top < scrollHeight || bottom - event.screenY < scrollHeight;
      clearTimeout(this.draggingTimeout);
      this.draggingTimeout = setTimeout(() => {
        const panel = document.getElementById("customizationui-widget-panel");
        if (panel) {
          const panelRect = panel.getBoundingClientRect();
          const overlap = {
            x: Math.max(0, Math.min(right, panelRect.right) - Math.max(left, panelRect.left)),
            y: Math.max(0, Math.min(bottom, panelRect.bottom) - Math.max(top, panelRect.top))
          };
          if (overlap.x > 0 && overlap.y > 0) {
            panel.hidePopup();
          }
        }
      }, tabBar._dragOverDelay);
    }
    if (this._dragoverScrollButton(event)) {
      return true;
    }

    const effects = tabBar.getDropEffectForTabDrag(event);
    const dt = event.dataTransfer;
    const isCopy = dt.dropEffect == "copy";
    const targetTab = tabBar._getDragTargetTab(event, {ignoreTabSides: true});

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
          const url = links.length && links[0]?.url ? links[0].url : null;
          disAllowDrop = url ? !Tabmix.ContentClick.isUrlForDownload(url) : true;
        } catch {}

        if (disAllowDrop) {
          // show Drag & Drop message
          let tooltip = document.getElementById("tabmix-tooltip");
          if (tooltip.state == "closed") {
            tooltip.label = this.draglink;
            tooltip.openPopup(document.getElementById("browser"), "", 1, 1, false, false);
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

    if (!disAllowDrop && !["scrollbutton-up", "scrollbutton-down"].includes(event.originalTarget.id)) {
      this.hideDragoverMessage();
      const {dragType, oldIndex, newIndex} = this.eventParams(event);
      if (
        !isCopy &&
        dragType == this.DRAG_TAB_IN_SAME_WINDOW &&
        (oldIndex === newIndex || newIndex - oldIndex === 1) &&
        this.useTabmixDnD(event)
      ) {
        disAllowDrop = true;
      } else if (
        TabmixTabbar.scrollButtonsMode == TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT &&
        // if we don't set effectAllowed to none then the drop indicator stay
        gBrowser.tabs[0].pinned &&
        Tabmix.compare(event.screenX, Tabmix.itemEnd(gBrowser.tabs[0], !Tabmix.ltr), Tabmix.ltr)
      ) {
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
    gBrowser.tabContainer.arrowScrollbox.removeAttribute("tabmix-dragging");
    clearTimeout(this.draggingTimeout);
    if (TMP_tabDNDObserver.finishButtonScroll(event)) {
      return;
    }
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

      if (Tabmix.isVersion(1330)) {
        tabBar._finishMoveTogetherSelectedTabs(draggedTab);
      } else {
        tabBar._finishGroupSelectedTabs(draggedTab);
      }
      tabBar._finishAnimateTabMove();
    }

    if (dt.mozUserCancelled || dt.dropEffect != "none" || tabBar._isCustomizing) {
      delete draggedTab._dragData;
    }
  },

  on_dragleave(event) {
    if (TMP_tabDNDObserver.finishButtonScroll(event)) {
      return;
    }
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
    else if (event.screenX >= tabStrip.scrollbox.screenX + tabStrip.scrollClientRect.width)
      targetAnonid = ltr ? "scrollbutton-down" : "scrollbutton-up";

    const pinnedTabCount = gBrowser.pinnedTabCount;
    if (pinnedTabCount && targetAnonid === "scrollbutton-up") {
      const pinnedTabRect = gBrowser.visibleTabs[pinnedTabCount - 1]?.getBoundingClientRect() ?? {right: 0, left: 0};
      if (ltr ? event.screenX < pinnedTabRect.right : event.screenX > pinnedTabRect.left) {
        targetAnonid = null;
      }
    }

    switch (targetAnonid) {
      case "scrollbutton-up":
        scrollDirection = tabStrip._lockScroll ? 0 : -1;
        break;
      case "scrollbutton-up-right":
        scrollDirection = -1;
        break;
      case "scrollbutton-down":
        scrollDirection = tabStrip._lockScroll ? 0 : 1;
        break;
      case "scrollbutton-down-right":
        scrollDirection = 1;
        break;
    }
    if (scrollDirection) {
      let scrollIncrement = TabmixTabbar.isMultiRow ?
        Math.round(tabStrip.singleRowHeight / 10) : tabStrip.scrollIncrement;
      tabStrip.scrollByPixels((ltr ? scrollDirection : -scrollDirection) * scrollIncrement, true);
      event.preventDefault();
      event.stopPropagation();

      if (["scrollbutton-up", "scrollbutton-down"].includes(targetAnonid ?? "")) {
        const ind = gBrowser.tabContainer._tabDropIndicator;
        if (TabmixTabbar.hasMultiRows && Tabmix.prefs.getBoolPref("tabScrollOnTopBottomDrag")) {
          ind.hidden = true;
          return true;
        }
        let arrowScrollbox = gBrowser.tabContainer.arrowScrollbox;
        let rect = arrowScrollbox.getBoundingClientRect();
        let scrollRect = arrowScrollbox.scrollClientRect;
        let minMargin = scrollRect.left - rect.left;
        let maxMargin = Math.min(minMargin + scrollRect.width, scrollRect.right);
        let newMargin = scrollDirection > 0 ? maxMargin : minMargin;
        ind.hidden = false;
        newMargin += ind.clientWidth / 2;
        if (RTL_UI) {
          newMargin *= -1;
        }
        ind.style.transform = "translate(" + Math.round(newMargin) + "px, 0px)";
      }

      return true;
    }
    return false;
  },

  finishButtonScroll(event) {
    const buttonId = event.originalTarget.id;
    if (TabmixTabbar.hasMultiRows && buttonId?.startsWith("scrollbutton")) {
      event.stopPropagation();
      event.preventDefault();
      gBrowser.tabContainer.arrowScrollbox._lockScroll = false;
      gBrowser.tabContainer.arrowScrollbox._finishScroll(event);
      return true;
    }
    return false;
  },

  hideDragoverMessage() {
    document.getElementById("tabmix-tooltip").hidePopup();
  },

  _getDropIndex(event, {dragover = false, children = []} = {children: []}) {
    const tabBar = gBrowser.tabContainer;
    if (!dragover && !this.useTabmixDnD(event)) {
      return Tabmix.originalFunctions._getDropIndex.apply(tabBar, [event]);
    }
    const params = this.eventParams(event);
    if (dragover && this.isLastTabInRow(params.newIndex, params.mouseIndex, children)) {
      // when user drag to the last tab in the row, show drag indicator at the
      // end of the tabs instead of the beginning of the next tab that is in
      // the next row
      params.newIndex = params.mouseIndex;
      params.addWidth = true;
    }
    return dragover ? params : params.newIndex;
  },

  eventParams(event) {
    const tabBar = gBrowser.tabContainer;
    const dt = event.dataTransfer;
    const sourceNode = this.getSourceNode(dt);
    const {dragType, tab} = this.getDragType(sourceNode);
    const oldIndex = tab ? tab._tPos : -1;
    let newIndex = this._getDNDIndex(event, tab);
    let mouseIndex = newIndex;

    if (newIndex < gBrowser.tabs.length) {
      newIndex += this.getLeft_Right(event, newIndex);
      if (dragType == this.DRAG_TAB_IN_SAME_WINDOW &&
        newIndex !== oldIndex && newIndex - oldIndex !== 1
      ) {
        const selectedTabs = gBrowser.selectedTabs;
        if (selectedTabs.length > 1) {
          const firstSelected = selectedTabs[0]._tPos;
          const lastSelected = selectedTabs.at(-1)?._tPos ?? -1;
          if (newIndex >= firstSelected && newIndex <= lastSelected + 1) {
            newIndex =
               newIndex > oldIndex ?
                 Math.min(
                   lastSelected + 2,
                   tab?.pinned ? gBrowser.pinnedTabCount : Infinity,
                   gBrowser.tabs.length - 1
                 ) :
                 Math.max(firstSelected - 1, tab?.pinned ? 0 : gBrowser.pinnedTabCount);
            if (newIndex === firstSelected || newIndex === lastSelected + 1) {
              newIndex = oldIndex;
            }
            mouseIndex = newIndex > oldIndex ? newIndex - 1 : newIndex;
          }
        }
      }
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
  _getDNDIndex(aEvent, draggedTab) {
    var indexInGroup = this.getNewIndex(aEvent, draggedTab);
    var tabs = Tabmix.visibleTabs.tabs;
    var lastIndex = tabs.length - 1;
    if (indexInGroup < 0 || indexInGroup > lastIndex)
      indexInGroup = lastIndex;
    // @ts-expect-error - tabs[indexInGroup] is never undefined
    return tabs[indexInGroup]._tPos;
  },

  getNewIndex(event, draggedTab) {
    /** @param {Tab} tab @param {number} top */
    let getTabRowNumber = (tab, top) => Tabmix.tabsUtils.getTabRowNumber(tab, top);
    // if mX is less then the first tab return 0
    // check if mY is below the tab.... if yes go to next row
    // in the row find the closest tab by mX,
    // if no tab is match return gBrowser.tabs.length
    var mX = event.screenX, mY = event.screenY;
    var tabs = draggedTab?.pinned ?
      Tabmix.visibleTabs.tabs.filter(tab => tab.pinned) :
      Tabmix.visibleTabs.tabs;
    var numTabs = tabs.length;
    if (!TabmixTabbar.hasMultiRows) {
      const target = event.target.closest("tab.tabbrowser-tab");
      let startIndex = target ? Tabmix.visibleTabs.indexOf(target) : 0;
      const index = tabs
          .slice(startIndex, numTabs)
          .findIndex(tab => Tabmix.compare(mX, Tabmix.itemEnd(tab, Tabmix.ltr), Tabmix.ltr));
      if (index > -1) {
        return startIndex + index;
      }
    } else {
      // adjust mouseY position when it is in the margin area
      const tabStrip = gBrowser.tabContainer.arrowScrollbox;
      const singleRowHeight = tabStrip.singleRowHeight;
      const firstVisibleRow = draggedTab?.pinned ? 1 : Math.round(tabStrip.scrollPosition / singleRowHeight) + 1;
      const {height} = tabStrip.getBoundingClientRect();
      const top = tabStrip.screenY;
      if (mY >= top + height - this._multirowMargin) {
        mY = top + height - this._multirowMargin - 1;
      } else if (mY <= top + this._multirowMargin) {
        mY = top + this._multirowMargin + 1;
      }
      const currentRow = firstVisibleRow + Math.floor((mY - top - this._multirowMargin) / singleRowHeight);
      let topY = Tabmix.tabsUtils.topTabY;
      const pinnedTabCount = gBrowser.pinnedTabCount;
      let index = pinnedTabCount && !draggedTab?.pinned ? pinnedTabCount : 0;
      for (index; index < numTabs; index++) {
        // @ts-expect-error - tabs[i] is never undefined
        if (getTabRowNumber(tabs[index], topY) === currentRow) {
          break;
        }
      }

      for (let i = index; i < numTabs; i++) {
        let tab = tabs[i];
        // @ts-expect-error - tabs[i] is never undefined
        if (Tabmix.compare(mX, Tabmix.itemEnd(tab, Tabmix.ltr), Tabmix.ltr)) {
          return i;
        // @ts-expect-error - tabs[i + 1] is never undefined when i < numTabs
        } else if (i == numTabs - 1 || getTabRowNumber(tabs[i + 1], topY) !== currentRow) {
          return i;
        }
      }
    }
    return numTabs;
  },

  getLeft_Right(event, newIndex) {
    var mX = event.screenX;
    /** @type {Tab} */ // @ts-expect-error - gBrowser.tabs[newIndex] is never undefined
    var tab = gBrowser.tabs[newIndex];
    const {width} = tab.getBoundingClientRect();
    const [_left, _right] = RTL_UI ? [1, 0] : [0, 1];
    return mX < tab.screenX + width / 2 ? _left : _right;
  },

  getDragType(sourceNode) {
    if (
      XULElement.isInstance(sourceNode) &&
      sourceNode.localName == "tab" &&
      sourceNode.ownerGlobal?.isChromeWindow &&
      sourceNode.ownerDocument.documentElement.getAttribute("windowtype") ==
      "navigator:browser" &&
      sourceNode.ownerGlobal.gBrowser.tabContainer == sourceNode.container
    ) {
      /** @type {Tab} */ // @ts-expect-error
      const tab = sourceNode;
      if (sourceNode.container === gBrowser.tabContainer) {
        return {dragType: this.DRAG_TAB_IN_SAME_WINDOW, tab};
      }
      return {dragType: this.DRAG_TAB_TO_NEW_WINDOW, tab};
    }
    return {dragType: this.DRAG_LINK, tab: null};
  },

  /**
   * when dragging link or normal tab to pinned tab area show drop indicator
   * before the first non pinned tab.
   * when dragging pinned tab out of the pinned tab area show drop indicator
   * after the last pinned tab
   */
  getDropIndicatorMarginX(draggedTab, newIndex, addWidth, tabRect, rect, defaultMargin) {
    const pinnedTabCount = gBrowser.pinnedTabCount;
    if (pinnedTabCount === 0) {
      return defaultMargin + (addWidth ? tabRect.width : 0);
    }

    if (TabmixTabbar.hasMultiRows) {
      // the case for dragging link or non-pinned tab to pinned tabs area is handeld in getNewIndex
      if (draggedTab?.pinned && newIndex >= pinnedTabCount) {
        const pinnedTabRect = gBrowser.visibleTabs[pinnedTabCount - 1]?.getBoundingClientRect() ?? {right: 0, left: 0};
        return RTL_UI ? rect.right - pinnedTabRect.left : pinnedTabRect.right - rect.left;
      }
    } else {
      let allTabsPinnedOffset = 0;
      if (!draggedTab?.pinned) {
        if (gBrowser.tabContainer.hasAttribute("overflow")) {
          let scrollRect = gBrowser.tabContainer.arrowScrollbox.scrollClientRect;
          return Math.min(Math.max(defaultMargin + (addWidth ? tabRect.width : 0), scrollRect.left - rect.left), scrollRect.right - rect.left);
        }
        const firstNonPinnedTab = gBrowser.visibleTabs[pinnedTabCount];
        allTabsPinnedOffset = firstNonPinnedTab ? 0 : 8;
        if (firstNonPinnedTab) {
          const firstNonPinnedTabRect = firstNonPinnedTab.getBoundingClientRect();
          return RTL_UI ?
            Math.max(defaultMargin + (addWidth ? tabRect.width : 0), rect.right - firstNonPinnedTabRect.right) :
            Math.max(defaultMargin + (addWidth ? tabRect.width : 0), firstNonPinnedTabRect.left - rect.left);
        }
      }
      if (draggedTab?.pinned && newIndex >= pinnedTabCount || allTabsPinnedOffset) {
        const pinnedTabRect = gBrowser.visibleTabs[pinnedTabCount - 1]?.getBoundingClientRect() ?? {right: 0, left: 0};
        return RTL_UI ? rect.right - pinnedTabRect.left + allTabsPinnedOffset : pinnedTabRect.right - rect.left + allTabsPinnedOffset;
      }
    }
    return defaultMargin + (addWidth ? tabRect.width : 0);
  },

  getDropIndicatorMarginY(ind, tabRect, rect) {
    if (TabmixTabbar.visibleRows === 1) {
      return 0;
    }

    let newMarginY;
    if (TabmixTabbar.position == 1) {
      newMarginY = tabRect.bottom - (ind.parentNode?.getBoundingClientRect().bottom ?? 0);
    } else {
      newMarginY = tabRect.bottom - rect.bottom;
      // fix for some theme on Mac OS X
      if (TabmixTabbar.visibleRows > 1 &&
        ind.parentNode?.getBoundingClientRect().height === 0) {
        newMarginY += tabRect.height;
      }
    }

    return newMarginY;
  },

  isLastTabInRow(newIndex, mouseIndex, children) {
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
    if (types[0] == TAB_DROP_TYPE)
      return aDataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
    return null;
  },
}; // TMP_tabDNDObserver end

/** @type {UndocloseTabButtonObserver} */
var TMP_undocloseTabButtonObserver = {
  onDragOver(aEvent) {
    var dt = aEvent.dataTransfer;
    var sourceNode = TMP_tabDNDObserver.getSourceNode(dt);
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
    var sourceNode = TMP_tabDNDObserver.getSourceNode(dt);
    if (sourceNode && sourceNode.localName == "tab")
      // let tabbrowser drag event time to end before we remove the sourceNode
      setTimeout(
        /** @type {PrivateFunctionsNS.UndocloseTabButtonObserver._removeTab} */
        (b, aTab) => b.removeTab(aTab, {animate: true}),
        0, gBrowser, sourceNode
      );

    this.onDragExit(aEvent);
  },
};

/* ::::::::::     miscellaneous     :::::::::: */

Tabmix.whereToOpen = function TMP_whereToOpen(pref, altKey) {
  var aTab = gBrowser._selectedTab;
  var isBlankTab = gBrowser.isBlankNotBusyTab(aTab);
  var isLockTab = !isBlankTab && aTab.hasAttribute("locked");

  var openTabPref = typeof pref == "string" ? Services.prefs.getBoolPref(pref) : pref;
  if (typeof altKey != "undefined") {
    // don't reuse blank tab if the user press alt key when the pref is to open in current tab
    if (altKey && !openTabPref)
      isBlankTab = false;

    // see bug 315034 If search is set to open in a new tab,
    // Alt+Enter should open the search result in the current tab
    // so here we reverse the pref if user press Alt key
    openTabPref = altKey !== openTabPref;
  }
  return {inNew: !isBlankTab && (isLockTab || openTabPref), lock: isLockTab};
};

Tabmix.getStyle = function TMP_getStyle(aObj, aStyle) {
  try {
    const styleValue = window.getComputedStyle(aObj)?.[aStyle] ?? "0px";
    return parseInt(styleValue) || 0;
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

Tabmix.navToolbox = {
  customizeStarted: false,
  toolboxChanged: false,
  resetUI: false,
  // @ts-expect-error - placeholder
  listener: () => {},

  init: function TMP_navToolbox_init() {
    this.updateToolboxItems();
    gNavToolbox.addEventListener("beforecustomization", this);
    gNavToolbox.addEventListener("aftercustomization", this);

    /** @type {CustomizableUIListener["onWidgetAfterDOMChange"]} */
    const onWidgetAfterDOMChange = (aNode, aNextNode, aContainer, aWasRemoval) => {
      if (this.customizeStarted)
        return;
      if (aContainer.id == "TabsToolbar") {
        this.tabStripAreaChanged();
        TabmixTabbar.updateScrollStatus();
      }
      if (!aWasRemoval) {
        let command = aNode.getAttribute("command") ?? "";
        if (/Browser:ReloadOrDuplicate|Browser:Stop/.test(command))
          gTMPprefObserver.showReloadEveryOnReloadButton();

        if (aNode.id === "tabmix-closedTabs-toolbaritem") {
          TMP_ClosedTabs.setButtonType(Tabmix.prefs.getBoolPref("undoCloseButton.menuonly"));
        }
      }
    };
    this.listener = {onWidgetAfterDOMChange};
    CustomizableUI.addListener(this.listener);
  },

  deinit: function TMP_navToolbox_deinit() {
    gNavToolbox.removeEventListener("beforecustomization", this);
    gNavToolbox.removeEventListener("aftercustomization", this);

    CustomizableUI.removeWidgetFromArea("tabmix-scrollbox");
    CustomizableUI.removeListener(this.listener);

    gURLBar?.removeEventListener("blur", this);
  },

  handleEvent: function TMP_navToolbox_handleEvent(aEvent) {
    switch (aEvent.type) {
      // navToolbox events
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
      // gURLBar events
      case "blur":
        Tabmix.urlBarOnBlur();
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
    this.tabStripAreaChanged();
  },

  urlBarInitialized: false,
  initializeURLBar: function TMP_navToolbox_initializeURLBar() {
    if (!gURLBar ||
        document.documentElement.getAttribute("chromehidden")?.includes("location") ||
        typeof gURLBar.handleCommand == "undefined")
      return;

    if (!this.urlBarInitialized) {
      gURLBar.addEventListener("blur", this);

      Tabmix.originalFunctions.gURLBar_handleCommand = gURLBar.handleCommand;
      gURLBar.handleCommand = this.handleCommand.bind(gURLBar);

      Tabmix.originalFunctions.gURLBar__whereToOpen = gURLBar._whereToOpen;
      gURLBar._whereToOpen = function(event) {
        if (event?.__tabmix__whereToOpen) {
          return event.__tabmix__whereToOpen;
        }
        if (gBrowser.selectedBrowser.__tabmix__whereToOpen) {
          const where = gBrowser.selectedBrowser.__tabmix__whereToOpen;
          delete gBrowser.selectedBrowser.__tabmix__whereToOpen;
          return where;
        }
        return Tabmix.originalFunctions.gURLBar__whereToOpen.apply(this, [event]);
      };

      this.on_mouseup = this.on_mouseup.bind(gURLBar.view);
      const rows = gURLBar.view.panel.querySelector(".urlbarView-results");
      rows.addEventListener("mouseup", event => {
        // @ts-expect-error - on_mouseup method is bound to gURLBar.view
        this.on_mouseup(event);
      }, {capture: true});
      this.urlBarInitialized = true;
    }
  },

  handleCommand(event) {
    if (Tabmix.selectedTab === gBrowser.selectedTab) {
      Tabmix.selectedTab = null;
      Tabmix.userTypedValue = "";
    }

    let prevTab, prevTabPos;
    let element = this.view.selectedElement;
    let result = this.view.getResultFromElement(element);
    if (Tabmix.prefs.getBoolPref("moveSwitchToTabNext") &&
        result?.type === UrlbarUtils.RESULT_TYPE.TAB_SWITCH && this.hasAttribute("actiontype")) {
      prevTab = gBrowser.selectedTab;
      prevTabPos = prevTab._tPos;
    }

    Tabmix.navToolbox.whereToOpenFromUrlBar(event, result);
    Tabmix.originalFunctions.gURLBar_handleCommand.apply(this, [event]);

    if (gBrowser.selectedBrowser.__tabmix__whereToOpen) {
      delete gBrowser.selectedBrowser.__tabmix__whereToOpen;
    }

    // move the tab that was switched to after the previously selected tab
    if (typeof prevTabPos == "number") {
      let pos = prevTabPos + Number(gBrowser.selectedTab._tPos > prevTabPos) -
          Number(!prevTab || !prevTab.parentNode);
      gBrowser.moveTabTo(gBrowser.selectedTab, pos);
    }
  },

  // this method is bound to gURLBar.view
  on_mouseup(event) {
    // based on:
    // - gURLBar.view.on_mouseup (UrlbarView.sys.mjs)
    // - gURLBar.pickResult (UrlbarInput.sys.mjs)
    if (event.button == 2) {
      return;
    }

    const element = Tabmix.navToolbox.getClosestSelectableElement(event.target, {byMouse: true});
    const result = element && this.getResultFromElement(element);
    Tabmix.navToolbox.whereToOpenFromUrlBar(event, result);
    if (!result) {
      return;
    }

    if (
      result.heuristic &&
      this.input.searchMode?.isPreview &&
      this.oneOffSearchButtons.selectedButton
    ) {
      return;
    }

    if (!Tabmix.prefs.getBoolPref("moveSwitchToTabNext")) {
      return;
    }

    let urlOverride = "";
    if (element?.classList.contains("urlbarView-help")) {
      urlOverride = result.payload.helpUrl;
    }
    const isCanonized = this.input.setValueFromResult({
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

  // private method from gURLBar.view (UrlbarView.sys.mjs)
  getClosestSelectableElement(element, {byMouse = false} = {}) {
    const SELECTABLE_ELEMENT_SELECTOR = "[role=button], [selectable=true]";
    const KEYBOARD_SELECTABLE_ELEMENT_SELECTOR = "[role=button]:not([keyboard-inaccessible]), [selectable]";
    const closest = element.closest(
      byMouse ?
        SELECTABLE_ELEMENT_SELECTOR :
        KEYBOARD_SELECTABLE_ELEMENT_SELECTOR
    );
    if (closest && this.isElementVisible(closest)) {
      return closest;
    }
    // When clicking on a gap within a row or on its border or padding, treat
    // this as if the main part was clicked.
    if (
      element.classList.contains("urlbarView-row") &&
      element.hasAttribute("row-selectable")
    ) {
      return element._content;
    }
    return null;
  },

  // private method from gURLBar.view (UrlbarView.sys.mjs)
  isElementVisible(element) {
    if (!element || element.style.display == "none") {
      return false;
    }
    let row = element.closest(".urlbarView-row");
    return row ? row.style.display != "none" : false;
  },

  whereToOpenFromUrlBar(event, result) {
    let isMouseEvent = MouseEvent.isInstance(event);
    let altEnter = !isMouseEvent && event &&
      Tabmix.isAltKey(event) && !gBrowser.selectedTab.isEmpty;

    /** @type {WhereToOpen} */
    let where = "current";
    let url = result?.payload?.url ?? gURLBar.value;
    let loadNewTab = Tabmix.whereToOpen("extensions.tabmix.opentabfor.urlbar",
      altEnter).inNew && !/^ *javascript:/.test(url);
    if (isMouseEvent || altEnter || loadNewTab) {
      // Use the standard UI link behaviors for clicks or Alt+Enter
      where = "tab";
      if (isMouseEvent || event && !altEnter)
        where = Tabmix.whereToOpenLink(event, false, false);
      if (loadNewTab && where == "current" || !isMouseEvent && where == "window")
        where = "tab";
      else if (!isMouseEvent && !loadNewTab && /^tab/.test(where))
        where = "current";
    }
    if (Tabmix.prefs.getBoolPref("loadUrlInBackground") && where === "tab") {
      where = "tabshifted";
    }
    if (event) {
      event.__tabmix__whereToOpen = where;
    } else if (where.startsWith("tab") &&
      // when user clicked paste & go with current url we let Firefox
      // reload the same url
      gURLBar.untrimmedValue !== gBrowser.selectedBrowser.currentURI.spec) {
      gBrowser.selectedBrowser.__tabmix__whereToOpen = where;
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

    /** @type {Record<string, any>} */
    let obj, fn, $LF;
    let _handleSearchCommand = searchbar.handleSearchCommand.toString();
    const change_handleSearchCommand =
      _handleSearchCommand.includes("whereToOpenLink") &&
      !_handleSearchCommand.includes("forceNewTab");

    let organizeSE = "organizeSE" in window && "doSearch" in window.organizeSE;
    [obj, fn] = [organizeSE ? window.organizeSE : searchbar, "doSearch"];
    if ("__treestyletab__original_doSearch" in searchbar)
      [obj, fn] = [searchbar, "__treestyletab__original_doSearch"];
    let fnString = obj[fn].toString();
    const change_doSearch = !fnString.includes('Tabmix');

    if (!change_handleSearchCommand && !change_doSearch) {
      // both functions already changed
      return;
    }

    /** @type {any} */
    const modules = {
      // Bug 1793414 (Firefox 107) - MozSearchbar calls into BrowserSearch where it doesn't need to
      // add references to lazy.FormHistory and lazy.SearchSuggestionController
      FormHistory: "resource://gre/modules/FormHistory.sys.mjs",
      SearchSuggestionController: "resource://gre/modules/SearchSuggestionController.sys.mjs",
    };

    if (Tabmix.isVersion(1210) && !Tabmix.isVersion(1220)) {
      // Bug 1866616 add usage for UrlbarPrefs.sys.mjs only in Firefox 121
      modules.UrlbarPrefs = "resource:///modules/UrlbarPrefs.sys.mjs";
    }

    if (Tabmix.isVersion(1270)) {
      // Bug 1742889 (Firefox 127) - Rewrite consumers of whereToOpenLink to use BrowserUtils.whereToOpenLink
      // add references to lazy.BrowserUtils
      modules.BrowserUtils = "resource://gre/modules/BrowserUtils.sys.mjs";
    }

    if (Tabmix.isVersion(1370)) {
      modules.BrowserSearchTelemetry = "resource:///modules/BrowserSearchTelemetry.sys.mjs";
    }

    const lazy = {};
    ChromeUtils.defineESModuleGetters(lazy, modules);

    // we use local eval here to use lazy from the current scope
    /** @param {{value: string}} params */
    function makeCode({value: code}) {
      if (!code.startsWith("function")) {
        code = "function " + code;
      }
      return eval("(" + code + ")");
    }

    // we check browser.search.openintab also for search button click
    if (!change_doSearch) {
      return;
    }

    // Personas Interactive Theme Engine 1.6.5
    let pIte = fnString.indexOf("BTPIServices") > -1;

    $LF = '\n          ';
    obj[fn] = makeCode(Tabmix.changeCode(obj, "searchbar." + fn)._replace(
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
    ));
  },

  toolbarButtons: function TMP_navToolbox_toolbarButtons() {
    gTMPprefObserver.setSingleWindowUI();
    gTMPprefObserver.showReloadEveryOnReloadButton();
    TMP_ClosedTabs.setButtonType(Tabmix.prefs.getBoolPref("undoCloseButton.menuonly"));
  },

  tabStripAreaChanged() {
    /**
     * we need to position three elements in TabsToolbar :
     * tabmix-scrollbox, new-tab-button, and tabmix-tabs-closebutton.
     * we restore tabmix-scrollbox position first since its position is fixed,
     * to be on the safe side we check tabmix-scrollbox position again after we
     * restore tabmix-tabs-closebutton and new-tab-button position.
     * see ScriptsLoader._addCloseButton and VerticalTabs how we handle tabmix-tabs-closebutton
     */
    if (!Tabmix.tabsUtils.isVerticalTabBar) {
      this.setScrollButtons();
      gTMPprefObserver.changeNewTabButtonSide(Tabmix.prefs.getIntPref("newTabButton.position"));
      this.setScrollButtons(false, true);
    }

    // reset tabsNewtabButton and afterTabsButtonsWidth
    if (typeof privateTab == "object")
      TMP_eventListener.updateMultiRow(true);
  },

  setScrollButtons(reset, onlyPosition) {
    if (Tabmix.tabsUtils.isVerticalTabBar) {
      return;
    }
    let box = document.getElementById("tabmix-scrollbox");
    if (box?.parentNode !== gBrowser.tabContainer.parentNode) {
      // nothing to do here when our button box is not a sibling of gBrowser.tabContainer
      return;
    }

    if (!reset && box == gBrowser.tabContainer.nextSibling)
      return;

    let tabsPosition = Tabmix.getPlacement("tabbrowser-tabs");
    if (tabsPosition > -1) {
      CustomizableUI.moveWidgetWithinArea("tabmix-scrollbox", tabsPosition + 1);
    }

    if (!onlyPosition) {
      let useTabmixButtons = TabmixTabbar.scrollButtonsMode > TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT;
      Tabmix.tabsUtils.updateScrollButtons(useTabmixButtons);
    }
  },

};

Tabmix.getPlacement = function(id) {
  let placement = CustomizableUI.getPlacementOfWidget(id);
  return placement ? placement.position : -1;
};

Tabmix.getPrivateMethod = function(constructorName, methhodName, nextMethodName) {
  const errorMsg = `can't find ${constructorName}.${methhodName} function`;
  const firefoxClass = customElements.get(constructorName);
  const method = function() {};
  if (!firefoxClass) {
    console.error(`Tabmix Error: can't find ${constructorName} custom element\n${errorMsg}`);
    return method;
  }
  const code = firefoxClass
      .toString()
      .split(` #${methhodName}`)[1] // function to extract from source code
      ?.split(` ${nextMethodName}`)[0] // next function in the source code
      ?.trim()
      .replace(/this\.#(\w*)/g, "this._$1");
  if (code) {
    return eval(`(function ${code})`);
  }
  console.error(`Tabmix Error: ${errorMsg}`);
  return method;
};
