/* exported TMP_undocloseTabButtonObserver */
"use strict";

/** Drag and Drop observers *** */
/** @type {TabmixDNDObserver} */
var TMP_tabDNDObserver = {
  draglink: "",
  LinuxMarginEnd: 0,
  _dragOverDelay: 350,
  DRAG_LINK: 0,
  DRAG_TAB_TO_NEW_WINDOW: 1,
  DRAG_TAB_IN_SAME_WINDOW: 2,
  draggingTimeout: 0,
  paddingLeft: 0,
  _multirowMargin: 0,
  _moveTabOnDragging: true,
  _hideTooltipTimeout: 0,
  // we add this property lazily for Firefox 138+
  TabMetrics: {
    userTriggeredContext: s => ({isUserTriggered: true, telemetrySource: s ?? "unknown"}),
    // @ts-expect-error
    METRIC_SOURCE: {},
  },

  init: function TMP_tabDNDObserver_init() {
    var tabBar = gBrowser.tabContainer;
    if (Tabmix.extensions.verticalTabBar) {
      this.useTabmixDnD = () => false;
      return;
    }

    const tabContainerProps = {
      parent: gBrowser.tabContainer,
      parentName: "gBrowser.tabContainer",
    };

    const localSandbox = (function () {
      let scope;
      if (Tabmix.isVersion(1370)) {
        /* eslint-disable-next-line */ // @ts-expect-error
        const isTab = element => !!(element?.tagName == "tab");

        /* eslint-disable-next-line */ // @ts-expect-error
        const isTabGroup = element => !!(element?.tagName == "tab-group");

        /* eslint-disable-next-line */ // @ts-expect-error
        const isTabGroupLabel = element => !!element?.classList?.contains("tab-group-label");

        scope = {
          isTab,
          isTabGroup,
          isTabGroupLabel,
          lazy: {},
        };

        if (Tabmix.isVersion(1380)) {
          const lazy = {};

          ChromeUtils.defineESModuleGetters(lazy, {
            // eslint-disable-next-line tabmix/valid-lazy
            TabMetrics: "moz-src:///browser/components/tabbrowser/TabMetrics.sys.mjs",
          });
          scope.lazy = lazy;
        }
      } else if (Tabmix.isVersion(1340)) {
        // Since Firefox 134, tabs.js contains scoped constants for group drop actions:
        // - GROUP_DROP_ACTION_CREATE: used in on_drop and triggerDragOverCreateGroup
        // - GROUP_DROP_ACTION_APPEND: used in on_drop and _animateTabMove
        scope = {
          GROUP_DROP_ACTION_CREATE: 0x1,
          GROUP_DROP_ACTION_APPEND: 0x2,
        };
      }

      if (Tabmix.isVersion({fp: "128.0.0"})) {
        const verticalTabbarEnabled = () => Services.prefs.getIntPref("floorp.tabbar.style") === 2;
        scope = {
          ...scope,
          verticalTabbarEnabled,
        };
      }

      return Tabmix.getSandbox(window, {scope});
    })();

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
      // we will use instead of #isContainerVerticalPinnedGrid in:
      //  gBrowser.tabContainer.on_dragover
      //  gBrowser.tabContainer.on_drop
      const name =
        Tabmix.isVersion(1380) ?
          "isContainerVerticalPinnedGrid"
        : "isContainerVerticalPinnedExpanded";
      gBrowser.tabContainer[`_${name}`] = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: name,
        nextMethodName: "appendChild",
      });

      gBrowser.tabContainer._maxTabsPerRow = 0;

      gBrowser.tabContainer._animateExpandedPinnedTabMove = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "animateExpandedPinnedTabMove",
        nextMethodName: "_animateTabMove",
      });
    }

    if (Tabmix.isVersion(1330)) {
      gBrowser.tabContainer._setDragOverGroupColor = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "setDragOverGroupColor",
        nextMethodName: Tabmix.isVersion(1380) ? "finishAnimateTabMove" : "_finishAnimateTabMove",
      });

      gBrowser.tabContainer._moveTogetherSelectedTabs = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "moveTogetherSelectedTabs",
        nextMethodName:
          Tabmix.isVersion(1380) ?
            "finishMoveTogetherSelectedTabs"
          : "_finishMoveTogetherSelectedTabs",
      });

      gBrowser.tabContainer._isAnimatingMoveTogetherSelectedTabs = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "isAnimatingMoveTogetherSelectedTabs",
        nextMethodName: "handleEvent",
      });
    } else {
      // prevent grouping selected tabs for multi row tabbar
      Tabmix.originalFunctions._groupSelectedTabs = tabBar._groupSelectedTabs;

      /** @type {typeof tabBar._groupSelectedTabs} */
      tabBar._groupSelectedTabs = function (...args) {
        if (TabmixTabbar.visibleRows > 1) return;
        Tabmix.originalFunctions._groupSelectedTabs.apply(this, args);
      };

      gBrowser.tabContainer._setDragOverGroupColor = () => {};
    }

    if (Tabmix.isVersion(1340)) {
      gBrowser.tabContainer._dragOverCreateGroupTimer = 0;

      gBrowser.tabContainer._clearDragOverCreateGroupTimer = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "clearDragOverCreateGroupTimer",
        nextMethodName: "#setDragOverGroupColor",
      });

      gBrowser.tabContainer._triggerDragOverCreateGroup = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "triggerDragOverCreateGroup",
        nextMethodName: "#clearDragOverCreateGroupTimer",
        sandbox: localSandbox,
      });
    }

    if (Tabmix.isVersion(1420)) {
      tabBar._updateTabStylesOnDrag = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "updateTabStylesOnDrag",
        nextMethodName: "#animateExpandedPinnedTabMove",
      });

      tabBar._resetTabsAfterDrop = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "resetTabsAfterDrop",
        nextMethodName: "#moveTogetherSelectedTabs",
      });
    }

    if (Tabmix.isVersion(1380)) {
      tabBar._expandGroupOnDrop = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "expandGroupOnDrop",
        nextMethodName: "on_drop",
      });

      Tabmix.changeCode(tabBar, "gBrowser.tabContainer._expandGroupOnDrop")
        ._replace("isTabGroupLabel(draggedTab)", "gBrowser.isTabGroupLabel(draggedTab)")
        .toCode();

      gBrowser.tabContainer._setMovingTabMode = function (movingTab) {
        this.toggleAttribute("movingtab", movingTab);
        gNavToolbox.toggleAttribute("movingtab", movingTab);
      };

      tabBar._dragTime = 0;

      tabBar._getDragTarget = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "getDragTarget",
        nextMethodName: "#getDropIndex",
        sandbox: localSandbox,
      });

      tabBar._getDropIndex = Tabmix.getPrivateMethod({
        ...tabContainerProps,
        methodName: "getDropIndex",
        nextMethodName: "getDropEffectForTabDrag",
        sandbox: localSandbox,
      });

      ChromeUtils.defineESModuleGetters(this, {
        TabMetrics: "moz-src:///browser/components/tabbrowser/TabMetrics.sys.mjs",
      });
    } else {
      tabBar._getDragTarget = function (event, options = {}) {
        return this._getDragTargetTab(event, {ignoreTabSides: Boolean(options.ignoreSides)});
      };
      // @ts-expect-error - override isTabGroupLabel for older versions
      gBrowser.isTabGroupLabel = element =>
        Boolean(element?.classList?.contains("tab-group-label"));
      // @ts-expect-error - override isTab for older versions
      gBrowser.isTab = element => Boolean(element?.tagName == "tab");
    }

    if (Tabmix.isVersion(1320)) {
      // modify startTabDrag after all private method it uses modified above
      Tabmix.changeCode(tabBar, "gBrowser.tabContainer.startTabDrag", {
        forceUpdate: true,
      })
        ._replace("this.selectedItem = tab;", "if (this.verticalMode) {$&}", {
          check: Tabmix.isVersion(1390),
        })
        ._replace(
          "this._updateTabStylesOnDrag(tab, event);",
          `if (!TMP_tabDNDObserver.useTabmixDnD(event)) {
        $&
      }
      if (tab.pinned && TabmixTabbar.isMultiRow && Tabmix.prefs.getBoolPref("pinnedTabScroll") && Tabmix.prefs.getBoolPref("moveTabOnDragging")) {
        const width = movingTabs.reduce(
          (w, t) => w + window.windowUtils.getBoundsWithoutFlushing(t).width,
          0
        );
        const nextTab = this.visibleTabs[gBrowser.pinnedTabCount];
        if (nextTab) {
          nextTab.style.setProperty("margin-inline-start", width + 12 + "px", "important");
          tab._dragData.nextTab = nextTab;
        }
      }`,
          {
            check: Tabmix.isVersion(1420),
          }
        )
        .toCode();
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
    const _animateTabMove = Tabmix.changeCode(tabBar, "gBrowser.tabContainer._animateTabMove", {
      sandbox: localSandbox,
    })
      ._replace(
        /(?:const|let) draggedTab/,
        `let tabmixHandleMove = ${tabmixHandleMoveString()};
      $&`
      )
      ._replace("allTabs.at(this._rtlMode ? -1 : 0)", "TabmixTabbar.isMultiRow ? tabs[0] : $&", {
        check: Tabmix.isVersion(1420),
      })
      ._replace(
        "allTabs.at(this._rtlMode ? 0 : -1)",
        "TabmixTabbar.isMultiRow ? tabs.at(-1) : $&",
        {check: Tabmix.isVersion(1420)}
      )
      ._replace(
        "this.selectedItem = draggedTab;",
        `if (Tabmix.prefs.getBoolPref("selectTabOnMouseDown"))
            $&
          else if (!draggedTab.selected) {
            this.setAttribute("tabmix-movingBackgroundTab", true);
            draggedTab.setAttribute("tabmix-dragged", true);
          }`,
        {check: !Tabmix.isVersion(1380)}
      )
      ._replace(
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
      )
      ._replace(
        Tabmix.isVersion(1340) || !Tabmix.isVersion(1330) ?
          "newIndex >= oldIndex"
        : "index >= oldIndex",
        Tabmix.isVersion(1330) ?
          `!tabmixHandleMove ? $& : ${Tabmix.isVersion(1340) ? "newIndex" : "index"} > -1 && (RTL_UI !== directionForward)`
        : `!tabmixHandleMove ? $& : newIndex > -1 && (RTL_UI !== ${Tabmix.isVersion(1300) ? "directionMove" : "ltrMove"})`,
        {check: !Tabmix.isVersion(1370)}
      );

    if (Tabmix.isVersion(1300) && !Tabmix.isVersion(1370)) {
      // Firefox 133-136
      // NOTE: firstMovingTabScreen and lastMovingTabScreen was swapped in version 1330
      const referenceTabString =
        Tabmix.isVersion(1330) ?
          "referenceTabEdge = (directionForward ? lastMovingTabScreen + rightTabWidth : firstMovingTabScreen) + translate;"
        : "referenceTabWidth = directionMove ? rightTabWidth : leftTabWidth";
      _animateTabMove
        ._replace(
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
        )
        ._replace(
          /\((.*)MovingTabScreen \+ tabSize\)/,
          "($1MovingTabScreen + (this.verticalMode ? tabSize : rightTabWidth))"
        );

      if (Tabmix.isVersion(1330)) {
        // Firefox 133+
        _animateTabMove
          ._replace(
            "lastMovingTabScreen + tabSize *",
            "lastMovingTabScreen + (this.verticalMode ? tabSize : rightTabWidth) *"
          )
          ._replace(
            "firstMovingTabScreen + tabSize *",
            "firstMovingTabScreen + (this.verticalMode ? tabSize : leftTabWidth) *"
          )
          ._replace(
            "if (screen > point) {",
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
          _animateTabMove
            ._replace(/tabSizeDragOverThreshold/g, "point")
            ._replace(
              "tabDropIndexFromPoint(tabCenter)",
              "tabDropIndexFromPoint(tabmixHandleMove ? (gBrowser._tabGroupsEnabled ? 0.7 : 0.5) : tabCenter)"
            )
            ._replace(
              "tabDropIndexFromPoint(groupPoint)",
              "tabDropIndexFromPoint(tabmixHandleMove ? dragOverGroupingThreshold : groupPoint)"
            )
            ._replace(
              // temporary fix bug in Firefox 133.0b9 - 2024-11-25
              "this.allTabs[dragData.animDropIndex].group",
              "this.allTabs[dragData.animDropIndex]?.group",
              {silent: true}
            );
        }
      }

      if (!Tabmix.isVersion(1340)) {
        // Firefox 130 - 133
        _animateTabMove
          ._replace(
            /let firstTabCenter = (.*)tabSize \/ 2;/,
            "let firstTabCenter = $1(this.verticalMode ? tabSize / 2 : leftTabWidth / 2);"
          )
          ._replace(
            /let lastTabCenter = (.*)tabSize \/ 2;/,
            "let lastTabCenter = $1(this.verticalMode ? tabSize / 2 : rightTabWidth / 2);"
          );
      }
    } else if (!Tabmix.isVersion(1300)) {
      // helper function to get floorp strings for width in vertical mode
      /** @param {string} vertical @param {string} horizontal */
      const getWidthString = (vertical, horizontal) =>
        Tabmix.isVersion({fp: "128.0.0"}) ?
          `(verticalTabbarEnabled() ? ${vertical} : ${horizontal})`
        : horizontal;
      _animateTabMove
        ._replace(
          /(?:const|let) shiftWidth = tabWidth \* movingTabs\.length;/,
          `let shiftWidth = tabmixHandleMove ? Tabmix.getMovingTabsWidth(movingTabs) : tabWidth * movingTabs.length;
         draggedTab._dragData.shiftWidth = shiftWidth;
         let rightTabWidth = movingTabs[movingTabs.length - 1].getBoundingClientRect().width;
         let leftTabWidth = movingTabs[0].getBoundingClientRect().width;
         let referenceTabWidth = ltrMove ? rightTabWidth : leftTabWidth;`
        )
        ._replace(
          "(rightMovingTabScreenX + tabWidth)",
          `(rightMovingTabScreenX + ${getWidthString("tabWidth", "rightTabWidth")})`
        )
        ._replace(
          /(?:const|let) leftTabCenter =.*;/,
          `let leftTabCenter = leftMovingTabScreenX + translateX + ${getWidthString("tabWidth / 2", "leftTabWidth / 2")};`
        )
        ._replace(
          /(?:const|let) rightTabCenter =.*;/,
          `let rightTabCenter = rightMovingTabScreenX + translateX + ${getWidthString("tabWidth / 2", "rightTabWidth / 2")};`
        );
    }
    _animateTabMove.toCode();

    const itemRect = Tabmix.isVersion(1380) ? "itemRect" : "tabRect";

    const dragoverCode = Tabmix.changeCode(tabBar, "gBrowser.tabContainer.on_dragover", {
      sandbox: localSandbox,
    })
      ._replace(
        "event.stopPropagation();",
        `$&
      const useTabmixDnD = TMP_tabDNDObserver.useTabmixDnD(event)
      if (TMP_tabDNDObserver.handleDragover(event, useTabmixDnD)) {
        return;
      }`
      )
      ._replace('if (effects == "move") {', 'if (effects == "move" && !useTabmixDnD) {')
      ._replace("var newMargin;", "var newMargin, newMarginY = 0;")
      ._replace(
        /(?:const|let) newIndex = this\._getDropIndex\(event.*\);/,
        "let {newIndex, dropBefore, groupLabelMargin, dropElement} = this._getDropIndex(event, {dragover: true, getParams: true});"
      )
      ._replace(
        RegExp(`(?:const|let) ${itemRect} = children[^;]*;`, "g"),
        `$&
          if (groupLabelMargin && newIndex > 0) {
            dropElement = children[newIndex - 1];
          }
          newMarginY = TMP_tabDNDObserver.getDropIndicatorMarginY(ind, dropElement ?? children.at(-1), rect);`
      )
      ._replace(
        // there is bug in firefox when swapping margin for RTL
        /\[minMargin, maxMargin\]\s=[^;]*;/,
        "[minMargin, maxMargin] = [minMargin, maxMargin]"
      )
      ._replace(
        // fix for the case user drag pinned tab to a scroll button
        "newMargin = pixelsToScroll > 0 ? maxMargin : minMargin;",
        `if (draggedTab?.pinned) {
          let ${itemRect} = gBrowser.visibleTabs[gBrowser.pinnedTabCount - 1].getBoundingClientRect();
          newMargin = RTL_UI ? rect.right - ${itemRect}.left : ${itemRect}.right - rect.left;
        } else {
          $&
        }`
      )
      ._replace(
        RegExp(`newMargin = (rect.right - ${itemRect}.left|${itemRect}.right - rect.left)`, "g"),
        `newMargin = TMP_tabDNDObserver.getDropIndicatorMarginX(draggedTab, newIndex, dropBefore, ${itemRect}, rect, $1)`
      )
      ._replace(
        RegExp(`newMargin = (rect.right - ${itemRect}.right|${itemRect}.left - rect.left)`, "g"),
        `newMargin = groupLabelMargin || TMP_tabDNDObserver.getDropIndicatorMarginX(draggedTab, newIndex, dropBefore, ${itemRect}, rect, $1)`
      )
      ._replace(
        'ind.style.transform = "translate(" + Math.round(newMargin) + "px)";',
        'ind.style.transform = "translate(" + Math.round(newMargin) + "px," + Math.round(newMarginY) + "px)";',
        {check: !Tabmix.isVersion(1300)}
      )
      ._replace(
        /ind\.style\.transform\s=[^;]*;/,
        `ind.style.transform = this.verticalMode
         ? "translateY(" + Math.round(newMargin) + "px)"
         : "translate(" + Math.round(newMargin) + "px," + Math.round(newMarginY) + "px)";`,
        {check: Tabmix.isVersion(1300)}
      )
      ._replace(
        // don't hide drop indicator when dragging link over group label
        /(effects == "link"[\s\S]*?)(ind\.hidden = true;)/,
        "$1ind.hidden = !overGroupLabel;",
        {check: Tabmix.isVersion(1380)}
      );

    const dropCode = Tabmix.changeCode(tabBar, "gBrowser.tabContainer.on_drop", {
      sandbox: localSandbox,
    })
      ._replace(
        "var dt = event.dataTransfer;",
        `if (TMP_tabDNDObserver.postDraggingCleanup(event))  {
        event.stopPropagation();
        event.preventDefault();
        return;
      }
      const useTabmixDnD = TMP_tabDNDObserver.useTabmixDnD(event);
       if (useTabmixDnD) {
         TMP_tabDNDObserver.hideDragoverMessage();
       }
       $&`
      )
      ._replace(
        "this._resetTabsAfterDrop(draggedTab?.ownerDocument);",
        `$&
        TMP_tabDNDObserver.resetTabsAfterDrop(draggedTab);`,
        {check: Tabmix.isVersion(1420)}
      )
      ._replace(
        // Don't pin/unpin tabs when dropping pinned tab on multi-row tabbar
        "let shouldTranslate =",
        `if (TabmixTabbar.isMultiRow) {
           shouldPin = shouldUnpin = false;
         }
         $&`,
        {check: Tabmix.isVersion(1420)}
      )
      ._replace(
        /(duplicatedTab|newTab) = gBrowser\.duplicateTab\(tab\);/,
        "$1 = Tabmix.duplicateTab(tab);"
      )
      ._replace(
        "} else if (draggedTab && draggedTab.container == this) {",
        `gBrowser.ensureTabIsVisible(${Tabmix.isVersion(1380) ? "duplicatedDraggedTab" : "draggedTabCopy"});
      } else if (draggedTab && draggedTab.container == this && useTabmixDnD) {
        TMP_tabDNDObserver.handleDrop(event, draggedTab, movingTabs);
      $&`
      )
      ._replace(
        Tabmix.isVersion(1320) ? "let shouldTranslate"
        : Tabmix.isVersion(1300) ? "if (oldTranslate && oldTranslate"
        : "if (oldTranslateX && oldTranslateX",
        `let refTab = Tabmix.isVersion(1380) ? this.ariaFocusableItems[dropIndex] : this.allTabs[dropIndex];
       if (!this.verticalMode && refTab) {
         let firstMovingTab = RTL_UI ? movingTabs[movingTabs.length - 1] : movingTabs[0];
           _newTranslateX = RTL_UI && dropIndex < firstMovingTab.elementIndex || !RTL_UI && dropIndex > firstMovingTab.elementIndex
             ? refTab.screenX + refTab.getBoundingClientRect().width - firstMovingTab.screenX - draggedTab._dragData.shiftWidth
             : refTab.screenX - firstMovingTab.screenX;
           _newTranslateX = Math.round(_newTranslateX);
       }
      $&`.replace(
          /_newTranslateX/g,
          Tabmix.isVersion(1300) && !Tabmix.isVersion(1320) ? "newTranslate" : "newTranslateX"
        )
      )
      ._replace(
        /urls = links.map\(\(?link\)? => link.url\);/,
        `$&
      let firstUrl = urls[0];
      replace =
        gBrowser.isTab(targetTab) || Tabmix.ContentClick.isUrlForDownload(firstUrl);
      if (replace) {
        targetTab =
          event.target.closest("tab.tabbrowser-tab") ||
          Tabmix.tabsUtils.allVisibleItems[Math.min(newIndex, Tabmix.tabsUtils.allVisibleItems.length - 1)];
        if (gBrowser.isTabGroupLabel(targetTab)) {
          targetTab = targetTab.group.tabs[0];
        }
        // allow to load in locked tab
        targetTab.linkedBrowser.tabmix_allowLoad = true;
      } else {
        targetTab = null;
      }`
      );

    /**
     * @param {"on_dragover" | "on_drop"} name
     * @param {ChangecodeModule.ChangeCodeClass} code
     */
    function patchDragMethod(name, code) {
      if (Tabmix.isVersion(1320)) {
        code.toCode(false, Tabmix.originalFunctions, `_tabmix_${name}`);
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
    // @ts-expect-error - Complex function overload with bind
    gBrowser.tabContainer._getDropIndex = this._getDropIndex.bind(this);

    const finishAnimateTabMove =
      Tabmix.isVersion(1380) ? "finishAnimateTabMove" : "_finishAnimateTabMove";
    Tabmix.originalFunctions._finishAnimateTabMove = gBrowser.tabContainer[finishAnimateTabMove];
    gBrowser.tabContainer[finishAnimateTabMove] = function (...args) {
      Tabmix.originalFunctions._finishAnimateTabMove.apply(this, args);
      this.removeAttribute("tabmix-movingBackgroundTab");
      if (Tabmix.isVersion(1340)) {
        // the original function call #clearDragOverCreateGroupTimer
        // so we need to call our "private" version
        this._clearDragOverCreateGroupTimer();
      }
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

  _cachedDnDValue: null,
  useTabmixDnD(event, tab) {
    if (this._cachedDnDValue !== null) {
      return this._cachedDnDValue;
    }
    const tabBar = gBrowser.tabContainer;
    if (tabBar.getAttribute("orient") !== "horizontal") {
      this._cachedDnDValue = false;
      return false;
    }
    if (!this._moveTabOnDragging) {
      this._cachedDnDValue = true;
      return true;
    }
    // don't use mozGetDataAt before gBrowser.tabContainer.startTabDrag
    const draggedTab = tab ?? event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
    if (draggedTab?.pinned && Tabmix.tabsUtils.lastPinnedTabRowNumber === 1) {
      this._cachedDnDValue = false;
      return false;
    }
    const result = TabmixTabbar.hasMultiRows || !draggedTab;
    this._cachedDnDValue = result;
    return result;
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
    const tab = this._getDragTarget(event);
    if (!tab || this._isCustomizing) {
      return;
    }

    // Prevent animation when grouping selected tabs for multi-row tab bar
    const currentReduceMotion = gReduceMotionSetting;
    const selectedTabs = gBrowser.selectedTabs;
    const useTabmixDnD = TMP_tabDNDObserver.useTabmixDnD(event, tab);
    if (selectedTabs.length > 1) {
      if (useTabmixDnD) {
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
    if (Tabmix.isVersion(1380)) {
      if (!tab.selected && !Tabmix.prefs.getBoolPref("selectTabOnMouseDown")) {
        this.setAttribute("tabmix-movingBackgroundTab", true);
        tab.setAttribute("tabmix-dragged", true);
      }
      // we don't collape the group on multi-row to prevent changing the number of rows
      if (useTabmixDnD && tab._dragData.expandGroupOnDrop) {
        this._expandGroupOnDrop(tab);
      }
    }
    gReduceMotionSetting = currentReduceMotion;

    if (TabmixTabbar.visibleRows === 1 && TabmixTabbar.position === 0) {
      return;
    }

    const scale = window.devicePixelRatio;
    let dragImageOffsetX = -16;
    let dragImageOffsetY = TabmixTabbar.visibleRows == 1 ? -16 : -30;
    let toDrag = this._dndCanvas;
    if (Tabmix.isVersion(1380) && gBrowser.isTabGroupLabel(tab)) {
      return;
    } else if (gMultiProcessBrowser) {
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
    const captureListener = function () {
      event.dataTransfer.updateDragImage(toDrag, dragImageOffsetX, dragImageOffsetY);
    };
    PageThumbs.captureToCanvas(tab.linkedBrowser, this._dndCanvas)
      .then(captureListener)
      .catch(e => console.error(e));
  },

  // we call this function from gBrowser.tabContainer.on_dragover
  handleDragover(event, useTabmixDnD) {
    const tabBar = gBrowser.tabContainer;
    const arrowScrollbox = tabBar.arrowScrollbox;
    if (TabmixTabbar.visibleRows > 1 && !arrowScrollbox.hasAttribute("tabmix-dragging")) {
      const attribute =
        Tabmix.prefs.getBoolPref("tabScrollOnTopBottomDrag") ? "enable-scroll-buttons" : "true";
      arrowScrollbox.setAttribute("tabmix-dragging", attribute);
      arrowScrollbox._lockScroll = true;
      clearTimeout(this.draggingTimeout);
      this.draggingTimeout = setTimeout(() => {
        arrowScrollbox._lockScroll = false;
        const panel = document.getElementById("customizationui-widget-panel");
        if (panel) {
          const tabsRect = arrowScrollbox.scrollClientRect;
          const panelRect = panel.getBoundingClientRect();
          const overlap = {
            x: Math.max(
              0,
              Math.min(tabsRect.right, panelRect.right) - Math.max(tabsRect.left, panelRect.left)
            ),
            y: Math.max(
              0,
              Math.min(tabsRect.bottom, panelRect.bottom) - Math.max(tabsRect.top, panelRect.top)
            ),
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

    if (!useTabmixDnD) {
      return false;
    }

    const effects = tabBar.getDropEffectForTabDrag(event);
    const dt = event.dataTransfer;
    const isCopy = dt.dropEffect == "copy";
    const targetTab = tabBar._getDragTarget(event, {ignoreSides: true});

    let disAllowDrop = false;
    let mozCursor = effects == "link" ? "auto" : "default";

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
          const links =
            Tabmix.isVersion(1380) ?
              Services.droppedLinkHandler.dropLinks(event, true)
              // eslint-disable-next-line no-undef
            : browserDragAndDrop.dropLinks(event, true);
          const url = links.length && links[0]?.url ? links[0].url : null;
          disAllowDrop = url ? !Tabmix.ContentClick.isUrlForDownload(url) : true;
        } catch {}

        if (disAllowDrop) {
          // show Drag & Drop message
          this.showDragoverTooltip(this.draglink);
        }
      }
    }

    // disAllowDrop drop when user drag link over tabbrowser-tabs multi-row margin
    if (effects == "link" && !targetTab && !disAllowDrop && TabmixTabbar.visibleRows > 1) {
      const {top, bottom} = tabBar.arrowScrollbox.getBoundingClientRect();
      if (
        event.clientY < top + this._multirowMargin ||
        event.clientY > bottom - this._multirowMargin
      ) {
        disAllowDrop = true;
      }
    }

    if (
      !disAllowDrop &&
      !["scrollbutton-up", "scrollbutton-down"].includes(event.originalTarget.id)
    ) {
      const {dragType, draggedElement, dropElement, dropOnStart, dropBefore} =
        this.eventParams(event);
      const draggedGroup = gBrowser.isTabGroupLabel(draggedElement) ? draggedElement.group : null;
      const draggedTab = draggedGroup?.tabs[0] ?? draggedElement;
      const elementGroup = dropElement?.group;
      const groupDropNotAllowed = draggedGroup && elementGroup;

      if (!groupDropNotAllowed) {
        this.hideDragoverMessage();
      }

      // Prevent dropping group on group
      if (groupDropNotAllowed) {
        disAllowDrop = true;
        mozCursor = "not-allowed";
        this.showDragoverTooltip(
          "Cannot merge groups. Drag group to a position between tabs or groups."
        );
      } else if (
        !isCopy &&
        !dropOnStart &&
        dragType == this.DRAG_TAB_IN_SAME_WINDOW &&
        // Prevent dropping on the same tab
        (draggedTab === dropElement ||
          // Prevent dropping tab-group in its current position
          (dropElement &&
            dropElement === draggedGroup?.[dropBefore ? "nextSibling" : "previousSibling"]) ||
          // Prevent dropping tab in its current position, but allow if moving between groups
          (dropElement === draggedTab?.[dropBefore ? "nextSibling" : "previousSibling"] &&
            draggedTab?.group?.id === elementGroup?.id) ||
          // Prevent dropping last tab after itself when not in a group
          (!dropElement && draggedTab === gBrowser.tabs.at(-1) && !draggedTab.group))
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

      if (draggedElement && draggedElement.container == tabBar) {
        const color = !disAllowDrop && elementGroup && !dropOnStart ? elementGroup.color : null;
        tabBar._setDragOverGroupColor(color);
        draggedElement._dragData.movingTabs.forEach(tab => {
          tab.toggleAttribute("tabmix-movingtab-togroup", Boolean(color));
        });
      }
    }

    if (disAllowDrop) {
      this.clearDragmark();
      dt.effectAllowed = "none";
    }

    dt.mozCursor = mozCursor;
    return disAllowDrop;
  },

  // called from gBrowser.tabContainer.on_drop when dragging tabs within the same window
  // and when Tabmix's custom drag and drop handling is active (useTabmixDnD === true)
  handleDrop(event, draggedTab, movingTabs) {
    let {dropElement, newIndex, dropBefore, fromTabList, dropOnStart} =
      gBrowser.tabContainer._getDropIndex(event, {getParams: true});
    const telemetrySource = this.TabMetrics.METRIC_SOURCE.DRAG_AND_DROP;
    if (!Tabmix.isVersion(1370) || fromTabList) {
      const oldIndex = draggedTab[Tabmix.isVersion(1380) ? "elementIndex" : "_tPos"];
      newIndex += dropBefore ? 0 : 1;
      const moveLeft = newIndex < oldIndex;
      if (!moveLeft) newIndex -= 1;
      if (
        Tabmix.isVersion(1350) &&
        !Tabmix.isVersion(1370) &&
        newIndex === 0 &&
        dropBefore &&
        gBrowser.isTabGroupLabel(event.target)
      ) {
        dropOnStart = true;
      }
      for (let tab of movingTabs) {
        /** @type {MockedGeckoTypes.moveTabToOptions} */
        const options =
          Tabmix.isVersion(1380) ? {elementIndex: newIndex, telemetrySource} : {tabIndex: newIndex};
        if (dropOnStart) {
          options.forceUngrouped = true;
        }
        Tabmix.moveTabTo(tab, options);
        if (moveLeft) newIndex++;
      }
    } else {
      const dropMetricsContext = this.TabMetrics.userTriggeredContext(telemetrySource);
      if (dropBefore) {
        gBrowser.moveTabsBefore(
          movingTabs,
          dropOnStart ? dropElement?.group : dropElement,
          dropMetricsContext
        );
      } else {
        gBrowser.moveTabsAfter(
          movingTabs,
          dropOnStart ? dropElement?.group : dropElement,
          dropMetricsContext
        );
      }
    }
    TabmixTabbar.updateScrollStatus();
    gBrowser.ensureTabIsVisible(draggedTab);
  },

  on_dragend(event) {
    const useTabmixDnD = this.useTabmixDnD(event);
    this._cachedDnDValue = null;
    this.postDraggingCleanup(event);
    this.clearDragmark();

    // don't allow to open new window in single window mode
    // respect bug489729 extension preference
    const disableDetachTab =
      (window.bug489729 && Services.prefs.getBoolPref("extensions.bug489729.disable_detach_tab")) ||
      (Tabmix.singleWindowMode && gBrowser.tabs.length > 1);

    let tabBar = gBrowser.tabContainer;

    let dt = event.dataTransfer;
    let draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
    if (!disableDetachTab) {
      this.resetTabsAfterDrop(draggedTab);
      // fall back to default Firefox event handler
      // it will call #expandGroupOnDrop
      Tabmix.originalFunctions.on_dragend.apply(tabBar, [event]);
      return;
    }

    event.stopPropagation();

    if (!useTabmixDnD) {
      // Prevent this code from running if a tabdrop animation is
      // running since calling _finishAnimateTabMove would clear
      // any CSS transition that is running.
      if (draggedTab.hasAttribute("tabdrop-samewindow")) {
        return;
      }

      if (!Tabmix.isVersion(1380)) {
        if (Tabmix.isVersion(1330)) {
          tabBar._finishMoveTogetherSelectedTabs(draggedTab);
        } else {
          tabBar._finishGroupSelectedTabs(draggedTab);
        }
        tabBar._finishAnimateTabMove();
      }
    }

    // since Firefox 138 we need to reset drag state even if we use our
    // own functions to handle the drag and drop
    if (Tabmix.isVersion(1380)) {
      tabBar.finishMoveTogetherSelectedTabs(draggedTab);
      tabBar.finishAnimateTabMove();
      tabBar._expandGroupOnDrop(draggedTab);
    }
    if (Tabmix.isVersion(1420)) {
      this.resetTabsAfterDrop(draggedTab);
      tabBar._resetTabsAfterDrop(draggedTab.ownerDocument);
    }

    if (dt.mozUserCancelled || dt.dropEffect != "none" || tabBar._isCustomizing) {
      delete draggedTab._dragData;
    }
  },

  on_dragleave(event) {
    this._cachedDnDValue = null;
    gBrowser.tabContainer._dragTime = 0;
    this.hideDragoverMessage();
    Tabmix.originalFunctions.on_dragleave.apply(gBrowser.tabContainer, [event]);
    let target = event.relatedTarget;
    // @ts-ignore
    while (target && target != gBrowser.tabContainer) target = target.parentNode;
    this.postDraggingCleanup(event, Boolean(target));
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
    if (TabmixTabbar.scrollButtonsMode !== TabmixTabbar.SCROLL_BUTTONS_HIDDEN) {
      // scroll with button
      targetAnonid = event.originalTarget.getAttribute("anonid") || event.originalTarget.id;
    } else if (event.screenX <= tabStrip.scrollbox.screenX) {
      // scroll without button
      targetAnonid = ltr ? "scrollbutton-up" : "scrollbutton-down";
    } else if (event.screenX >= tabStrip.scrollbox.screenX + tabStrip.scrollClientRect.width) {
      targetAnonid = ltr ? "scrollbutton-down" : "scrollbutton-up";
    }

    const pinnedTabCount = gBrowser.pinnedTabCount;
    if (pinnedTabCount && targetAnonid === "scrollbutton-up") {
      const pinnedTabRect = Tabmix.tabsUtils.allVisibleItems[
        pinnedTabCount - 1
      ]?.getBoundingClientRect() ?? {
        right: 0,
        left: 0,
      };
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
      let scrollIncrement =
        TabmixTabbar.isMultiRow ?
          Math.round(tabStrip.singleRowHeight / 10)
        : tabStrip.scrollIncrement;
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

  postDraggingCleanup(event, skipCleanup = false) {
    const tabBar = gBrowser.tabContainer;
    const arrowScrollbox = tabBar.arrowScrollbox;
    if (!skipCleanup) {
      clearTimeout(this.draggingTimeout);
      arrowScrollbox.removeAttribute("tabmix-dragging");
      arrowScrollbox._lockScroll = false;
    }

    const tabs = tabBar.querySelectorAll("[tabmix-movingtab-togroup]");
    tabs.forEach(tab => tab?.removeAttribute("tabmix-movingtab-togroup"));
    tabBar._setDragOverGroupColor(null);

    // make sure scroll position is aligned to row
    if (TabmixTabbar.hasMultiRows && event.originalTarget.id?.startsWith("scrollbutton")) {
      arrowScrollbox._finishScroll(event);
      return true;
    }
    return false;
  },

  hideDragoverMessage() {
    if (!this._hideTooltipTimeout) {
      this._hideTooltipTimeout = setTimeout(() => {
        document.getElementById("tabmix-tooltip").hidePopup();
        this._hideTooltipTimeout = 0;
      }, 100);
    }
  },

  showDragoverTooltip(message) {
    clearTimeout(this._hideTooltipTimeout);
    this._hideTooltipTimeout = 0;
    let tooltip = document.getElementById("tabmix-tooltip");
    if (tooltip.state == "closed") {
      tooltip.label = message;
      tooltip.openPopup(document.getElementById("browser"), "", 1, 1, false, false);
    } else if (tooltip.label !== message) {
      tooltip.label = message;
    }
  },

  _getDropIndex(event, {dragover = false, getParams = false} = {}) {
    const tabBar = gBrowser.tabContainer;
    if (!dragover && !this.useTabmixDnD(event)) {
      return Tabmix.originalFunctions._getDropIndex.apply(tabBar, [event]);
    }
    const params = this.eventParams(event);
    if (dragover) {
      const tab = params.dropElement;
      const group = tab?.group;

      // when group label is the last element in the row show drag indicator
      // next to it instead of the next row
      const useGroupLabel =
        group &&
        group.tabs[0] === tab &&
        this.isLastTabInRow(tab, group.labelElement) &&
        !gBrowser.isTab(this.getEventTarget(event));
      if (params.dropOnStart || useGroupLabel) {
        const rect = group?.labelElement.getBoundingClientRect();
        if (rect) {
          if (params.dropOnStart) {
            const offset = gBrowser.pinnedTabCount ? 0 : 3;
            params.groupLabelMargin = tabBar._rtlMode ? rect.right - offset : rect.left + offset;
          } else {
            params.groupLabelMargin = tabBar._rtlMode ? rect.left : rect.right;
          }
        }
      }
    }

    return getParams ? params : params.newIndex + (params.dropBefore || params.dropOnStart ? 0 : 1);
  },

  eventParams(event) {
    const tabBar = gBrowser.tabContainer;
    const dt = event.dataTransfer;
    const sourceNode = this.getSourceNode(dt);
    const {dragType, tab} = this.getDragType(sourceNode);
    const oldIndex =
      gBrowser.isTabGroupLabel(tab) ?
        // first tab in the group
        tab.group.tabs[0]._tPos
      : (tab?._tPos ?? -1);
    let newIndex = -1;
    let dropBefore = true;
    let dropOnStart = false;
    let dropElement = this.getDropElement(event, tab);
    if (dropElement) {
      const pinnedTabCount = gBrowser.pinnedTabCount;
      const isDraggedTabPinned = tab?.pinned ?? false;
      const isDropElementPinned = dropElement?.pinned ?? false;
      // prevent mixing pinned and unpinned tabs
      if (isDraggedTabPinned !== isDropElementPinned) {
        newIndex = pinnedTabCount - (isDraggedTabPinned ? 1 : 0);

        /** @type {AriaFocusableItem} */ // @ts-expect-error
        const element = Tabmix.tabsUtils.allVisibleItems[newIndex];
        dropElement = element;
        dropBefore = !isDraggedTabPinned;
        dropOnStart = !isDraggedTabPinned;
      } else if (gBrowser.isTabGroupLabel(dropElement)) {
        newIndex = dropElement.group.tabs[0]._tPos;
        // first non pinned tab element is group and dragging element before it
        dropOnStart =
          dropElement.elementIndex === pinnedTabCount && this.isDropBefore(event, dropElement);
      } else {
        newIndex = dropElement._tPos;
        dropBefore = this.isDropBefore(event, dropElement);
      }
      if (
        dragType == this.DRAG_TAB_IN_SAME_WINDOW &&
        newIndex !== oldIndex &&
        newIndex - oldIndex !== 1
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
                  isDraggedTabPinned ? pinnedTabCount : Infinity,
                  gBrowser.tabs.length - 1
                )
              : Math.max(firstSelected - 1, isDraggedTabPinned ? 0 : pinnedTabCount);
            if (newIndex === firstSelected || newIndex === lastSelected + 1) {
              newIndex = oldIndex;
            }
            dropBefore = true;
          }
        }
      }
    } else {
      newIndex = gBrowser.tabs.length;
    }

    const dropTab = tabBar.allTabs[newIndex];
    const fromTabList =
      (tab?._dragData.fromTabList && dropTab !== dropTab?.group?.tabs[0]) || false;
    if (Tabmix.isVersion(1380)) {
      if (dropTab?.group?.collapsed) {
        newIndex = dropTab.group.labelElement.elementIndex;
        dropOnStart = this.isDropBefore(event, dropTab.group.labelElement);
      } else {
        newIndex = dropTab?.elementIndex ?? Tabmix.tabsUtils.allVisibleItems.length;
      }
    }

    return {
      sourceNode,
      dragType,
      draggedElement: tab,
      newIndex,
      dropBefore,
      dropElement: dropTab,
      fromTabList,
      dropOnStart,
    };
  },

  // when user drag after last tab we return undefined
  getDropElement(aEvent, draggedTab) {
    let indexInGroup = this.getNewIndex(aEvent, draggedTab);
    const elements = Tabmix.tabsUtils.allVisibleItems;
    const lastIndex = elements.length - 1;
    if (indexInGroup < 0) {
      indexInGroup = lastIndex;
    }
    return elements[indexInGroup];
  },

  getNewIndex(event, draggedTab) {
    /** @param {Tab} tab @param {number} top */
    let getTabRowNumber = (tab, top) => Tabmix.tabsUtils.getTabRowNumber(tab, top);
    // if mX is less then the first tab return 0
    // check if mY is below the tab.... if yes go to next row
    // in the row find the closest tab by mX,
    // if no tab is match return gBrowser.tabs.length
    var mX = event.screenX,
      mY = event.screenY;
    const isPinnedTab = draggedTab?.pinned ?? false;
    const tabs =
      isPinnedTab ?
        Tabmix.tabsUtils.allVisibleItems.filter(tab => tab.pinned)
      : Tabmix.tabsUtils.allVisibleItems;
    const numTabs = tabs.length;
    if (!TabmixTabbar.hasMultiRows) {
      const target = this.getEventTarget(event);
      const tabTarget = Tabmix.isTabGroup(target) ? target.tabs[0] : target;
      const startIndex = tabTarget?.elementIndex ?? 0;
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
      const firstVisibleRow =
        isPinnedTab ? 1 : Math.round(tabStrip.scrollPosition / singleRowHeight) + 1;
      const {height} = tabStrip.getBoundingClientRect();
      const top = tabStrip.screenY;
      if (mY >= top + height - this._multirowMargin) {
        mY = top + height - this._multirowMargin - 1;
      } else if (mY <= top + this._multirowMargin) {
        mY = top + this._multirowMargin + 1;
      }
      const currentRow =
        firstVisibleRow + Math.floor((mY - top - this._multirowMargin) / singleRowHeight);
      let topY = Tabmix.tabsUtils.topTabY;
      const pinnedTabCount = gBrowser.pinnedTabCount;
      let index = pinnedTabCount && !isPinnedTab ? pinnedTabCount : 0;
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
          return i == numTabs - 1 ? numTabs : i;
        }
      }
    }
    return numTabs;
  },

  getEventTarget(event) {
    const maybeTabTarget = event.target.closest("tab.tabbrowser-tab");
    const target =
      maybeTabTarget ??
      (Tabmix.isVersion(1370) ?
        event.target.closest(".tab-group-label")
      : event.target.closest("tab-group"));
    return target;
  },

  isDropBefore(event, dropElement) {
    var mX = event.screenX;
    const [start, end] = RTL_UI ? [false, true] : [true, false];
    const {width} = dropElement.getBoundingClientRect();
    return mX < dropElement.screenX + width / 2 ? start : end;
  },

  getDragType(sourceNode) {
    if (
      XULElement.isInstance(sourceNode) &&
      (sourceNode.localName == "tab" ||
        (Tabmix.isVersion(1380) && gBrowser.isTabGroupLabel(sourceNode))) &&
      sourceNode.ownerGlobal?.isChromeWindow &&
      sourceNode.ownerDocument.documentElement.getAttribute("windowtype") == "navigator:browser" &&
      sourceNode.ownerGlobal.gBrowser.tabContainer == sourceNode.container
    ) {
      /** @type {AriaFocusableItem} */ // @ts-expect-error
      const tab = sourceNode;
      if (sourceNode.container === gBrowser.tabContainer) {
        return {dragType: this.DRAG_TAB_IN_SAME_WINDOW, tab};
      }
      return {dragType: this.DRAG_TAB_TO_NEW_WINDOW, tab};
    }
    return {dragType: this.DRAG_LINK, tab: null};
  },

  /*
   * when dragging link or normal tab to pinned tab area show drop indicator
   * before the first non pinned tab.
   * when dragging pinned tab out of the pinned tab area show drop indicator
   * after the last pinned tab
   */
  getDropIndicatorMarginX(draggedTab, newIndex, dropBefore, itemRect, rect, defaultMargin) {
    const margin = defaultMargin + (dropBefore ? 0 : itemRect.width);
    const pinnedTabCount = gBrowser.pinnedTabCount;
    if (pinnedTabCount === 0) {
      return margin;
    }
    const isPinnedTab = gBrowser.isTab(draggedTab) ? draggedTab.pinned : false;
    if (TabmixTabbar.hasMultiRows) {
      // the case for dragging link or non-pinned tab to pinned tabs area is handeld in getNewIndex
      if (isPinnedTab && newIndex >= pinnedTabCount) {
        const pinnedTabRect = Tabmix.tabsUtils.allVisibleItems[
          pinnedTabCount - 1
        ]?.getBoundingClientRect() ?? {
          right: 0,
          left: 0,
        };
        return RTL_UI ? rect.right - pinnedTabRect.left : pinnedTabRect.right - rect.left;
      }
    } else {
      let allTabsPinnedOffset = 0;
      if (!isPinnedTab) {
        if (gBrowser.tabContainer.hasAttribute("overflow")) {
          let scrollRect = gBrowser.tabContainer.arrowScrollbox.scrollClientRect;
          return Math.min(
            Math.max(margin, scrollRect.left - rect.left),
            scrollRect.right - rect.left
          );
        }
        const firstNonPinnedTab = Tabmix.tabsUtils.allVisibleItems[pinnedTabCount];
        allTabsPinnedOffset = firstNonPinnedTab ? 0 : 8;
        if (firstNonPinnedTab) {
          const firstNonPinnedTabRect = firstNonPinnedTab.getBoundingClientRect();
          return RTL_UI ?
              Math.max(margin, rect.right - firstNonPinnedTabRect.right)
            : Math.max(margin, firstNonPinnedTabRect.left - rect.left);
        }
      }
      if ((isPinnedTab && newIndex >= pinnedTabCount) || allTabsPinnedOffset) {
        const pinnedTabRect = Tabmix.tabsUtils.allVisibleItems[
          pinnedTabCount - 1
        ]?.getBoundingClientRect() ?? {
          right: 0,
          left: 0,
        };
        return RTL_UI ?
            rect.right - pinnedTabRect.left + allTabsPinnedOffset
          : pinnedTabRect.right - rect.left + allTabsPinnedOffset;
      }
    }
    return margin;
  },

  getDropIndicatorMarginY(ind, dropElement, rect) {
    if (TabmixTabbar.visibleRows === 1) {
      return 0;
    }

    const item = gBrowser.isTabGroupLabel(dropElement) ? dropElement.parentElement : dropElement;
    const itemRect = item.getBoundingClientRect();
    let newMarginY;
    if (TabmixTabbar.position == 1) {
      newMarginY = itemRect.bottom - (ind.parentNode?.getBoundingClientRect().bottom ?? 0);
    } else {
      newMarginY = itemRect.bottom - rect.bottom;
      // fix for some theme on Mac OS X
      if (TabmixTabbar.visibleRows > 1 && ind.parentNode?.getBoundingClientRect().height === 0) {
        newMarginY += itemRect.height;
      }
    }

    return newMarginY;
  },

  isLastTabInRow(dropTab, dragOverElement) {
    if (!dropTab || !dragOverElement) {
      return false;
    }
    const dropElement = dropTab?.group?.collapsed ? dropTab.group.labelElement : dropTab;
    const newIndex = dropElement.elementIndex;
    if (
      dropElement === dragOverElement ||
      TabmixTabbar.visibleRows === 1 ||
      newIndex === 0 ||
      newIndex === gBrowser.tabs.length
    ) {
      return false;
    }

    const topY = Tabmix.tabsUtils.topTabY;
    const rowA = Tabmix.tabsUtils.getTabRowNumber(dropElement, topY);
    const rowB = Tabmix.tabsUtils.getTabRowNumber(dragOverElement, topY);
    return rowA > rowB;
  },

  clearDragmark() {
    gBrowser.tabContainer._tabDropIndicator.hidden = true;
  },

  getSourceNode: function TMP_getSourceNode(aDataTransfer) {
    var types = aDataTransfer.mozTypesAt(0);
    if (types[0] == TAB_DROP_TYPE) {
      return aDataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
    }

    return null;
  },

  resetTabsAfterDrop(draggedTab) {
    if (draggedTab?._dragData?.nextTab) {
      draggedTab._dragData.nextTab.style.removeProperty("margin-inline-start");
    }
  },
}; // TMP_tabDNDObserver end

/** @type {TabmixWidgetsModule.UndocloseTabButtonObserver} */
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

    /** @type {Tab} */ // @ts-expect-error
    var sourceNode = TMP_tabDNDObserver.getSourceNode(dt);
    if (sourceNode && sourceNode.localName == "tab") {
      // let tabbrowser drag event time to end before we remove the sourceNode
      setTimeout((b, aTab) => b.removeTab(aTab, {animate: true}), 0, gBrowser, sourceNode);
    }

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
    if (altKey && !openTabPref) {
      isBlankTab = false;
    }

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

    /** @type {NavToolbox.OnWidgetAfterDOMChange} */
    const onWidgetAfterDOMChange = (aNode, aNextNode, aContainer, aWasRemoval) => {
      if (this.customizeStarted) {
        return;
      }

      if (aContainer.id == "TabsToolbar") {
        this.tabStripAreaChanged();
        TabmixTabbar.updateScrollStatus();
      }
      if (!aWasRemoval) {
        let command = aNode.getAttribute("command") ?? "";
        if (/Browser:ReloadOrDuplicate|Browser:Stop/.test(command)) {
          gTMPprefObserver.showReloadEveryOnReloadButton();
        }

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

    if (aToolboxChanged) {
      this.updateToolboxItems();
    }

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
    if (optionWindow && optionWindow.gAppearancePane) {
      optionWindow.gAppearancePane.toolbarButtons(window);
    }
  },

  updateToolboxItems: function TMP_navToolbox_updateToolboxItems() {
    this.initializeURLBar();
    this.initializeSearchbar();
    this.toolbarButtons();
    this.tabStripAreaChanged();
  },

  urlBarInitialized: false,
  initializeURLBar: function TMP_navToolbox_initializeURLBar() {
    if (
      !gURLBar ||
      document.documentElement.getAttribute("chromehidden")?.includes("location") ||
      typeof gURLBar.handleCommand == "undefined"
    ) {
      return;
    }

    if (!this.urlBarInitialized) {
      gURLBar.addEventListener("blur", this);

      Tabmix.originalFunctions.gURLBar_handleCommand = gURLBar.handleCommand;
      gURLBar.handleCommand = this.handleCommand.bind(gURLBar);

      Tabmix.originalFunctions.gURLBar__whereToOpen = gURLBar._whereToOpen;
      gURLBar._whereToOpen = function (event) {
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
      rows.addEventListener(
        "mouseup",
        event => {
          // @ts-expect-error - on_mouseup method is bound to gURLBar.view
          this.on_mouseup(event);
        },
        {capture: true}
      );
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
    if (
      Tabmix.prefs.getBoolPref("moveSwitchToTabNext") &&
      result?.type === UrlbarUtils.RESULT_TYPE.TAB_SWITCH &&
      this.hasAttribute("actiontype")
    ) {
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
      let pos =
        prevTabPos +
        Number(gBrowser.selectedTab._tPos > prevTabPos) -
        Number(!prevTab || !prevTab.parentNode);
      Tabmix.moveTabTo(gBrowser.selectedTab, {tabIndex: pos});
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
            Tabmix.moveTabTo(gBrowser.selectedTab, {tabIndex: pos});
          },
          {once: true}
        );
      }
    }
  },

  // private method from gURLBar.view (UrlbarView.sys.mjs)
  getClosestSelectableElement(element, {byMouse = false} = {}) {
    const SELECTABLE_ELEMENT_SELECTOR = "[role=button], [selectable=true]";
    const KEYBOARD_SELECTABLE_ELEMENT_SELECTOR =
      "[role=button]:not([keyboard-inaccessible]), [selectable]";
    const closest = element.closest(
      byMouse ? SELECTABLE_ELEMENT_SELECTOR : KEYBOARD_SELECTABLE_ELEMENT_SELECTOR
    );
    if (closest && this.isElementVisible(closest)) {
      return closest;
    }
    // When clicking on a gap within a row or on its border or padding, treat
    // this as if the main part was clicked.
    if (element.classList.contains("urlbarView-row") && element.hasAttribute("row-selectable")) {
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
    let altEnter =
      !isMouseEvent && event && Tabmix.isAltKey(event) && !gBrowser.selectedTab.isEmpty;

    /** @type {WhereToOpen} */
    let where = "current";
    let url = result?.payload?.url ?? gURLBar.value;
    let loadNewTab =
      Tabmix.whereToOpen("extensions.tabmix.opentabfor.urlbar", altEnter).inNew &&
      !/^ *javascript:/.test(url);
    if (isMouseEvent || altEnter || loadNewTab) {
      // Use the standard UI link behaviors for clicks or Alt+Enter
      where = "tab";
      if (isMouseEvent || (event && !altEnter)) {
        where = BrowserUtils.whereToOpenLink(event, false, false);
      }

      if ((loadNewTab && where === "current") || (!isMouseEvent && where === "window")) {
        where = "tab";
      } else if (!isMouseEvent && !loadNewTab && /^tab/.test(where)) {
        where = "current";
      }
    }
    if (Tabmix.prefs.getBoolPref("loadUrlInBackground") && where === "tab") {
      where = "tabshifted";
    }
    if (event) {
      event.__tabmix__whereToOpen = where;
    } else if (
      where.startsWith("tab") &&
      // when user clicked paste & go with current url we let Firefox
      // reload the same url
      gURLBar.untrimmedValue !== gBrowser.selectedBrowser.currentURI.spec
    ) {
      gBrowser.selectedBrowser.__tabmix__whereToOpen = where;
    }
  },

  whereToOpenSearch(aWhere) {
    var tab = gBrowser.selectedTab;
    var isBlankTab = gBrowser.isBlankNotBusyTab(tab);
    var isLockTab = !isBlankTab && tab.hasAttribute("locked");
    if (aWhere == "current" && isLockTab) {
      aWhere = "tab";
    } else if (/^tab/.test(aWhere) && isBlankTab) {
      aWhere = "current";
    }

    return aWhere;
  },

  initializeSearchbar: function TMP_navToolbox_initializeSearchbar() {
    var searchbar = document.getElementById("searchbar");
    if (!searchbar) {
      return;
    }

    /** @type {Record<string, any>} */
    let obj, fn;
    let _handleSearchCommand = searchbar.handleSearchCommand.toString();
    const change_handleSearchCommand =
      _handleSearchCommand.includes("whereToOpenLink") &&
      !_handleSearchCommand.includes("forceNewTab");

    let organizeSE = "organizeSE" in window && "doSearch" in window.organizeSE;
    [obj, fn] = [organizeSE ? window.organizeSE : searchbar, "doSearch"];
    if ("__treestyletab__original_doSearch" in searchbar) {
      [obj, fn] = [searchbar, "__treestyletab__original_doSearch"];
    }

    let fnString = obj[fn].toString();
    const change_doSearch = !fnString.includes("Tabmix");

    if (!change_handleSearchCommand && !change_doSearch) {
      // both functions already changed
      return;
    }

    /** @type {any} */
    const modules = {
      // Bug 1793414 (Firefox 107) - MozSearchbar calls into BrowserSearch where it doesn't need to
      // add references to lazy.FormHistory and lazy.SearchSuggestionController
      FormHistory: "resource://gre/modules/FormHistory.sys.mjs",
      SearchSuggestionController:
        Tabmix.isVersion(1400) ?
          "moz-src:///toolkit/components/search/SearchSuggestionController.sys.mjs"
        : "resource://gre/modules/SearchSuggestionController.sys.mjs",
      // Bug 1742889 (Firefox 127) - Rewrite consumers of whereToOpenLink to use BrowserUtils.whereToOpenLink
      // add references to lazy.BrowserUtils
      BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
    };

    if (Tabmix.isVersion(1370)) {
      modules.BrowserSearchTelemetry =
        Tabmix.isVersion(1380) ?
          "moz-src:///browser/components/search/BrowserSearchTelemetry.sys.mjs"
        : "resource:///modules/BrowserSearchTelemetry.sys.mjs";
    }

    const lazy = {};
    ChromeUtils.defineESModuleGetters(lazy, modules);

    // Use custom sandbox for code evaluation
    const searchbarSandbox = Tabmix.getSandbox(window, {scope: {lazy}});

    // Personas Interactive Theme Engine 1.6.5
    let pIte = fnString.indexOf("BTPIServices") > -1;

    Tabmix.changeCode(obj, "searchbar." + fn, {sandbox: searchbarSandbox})
      ._replace(
        "let params",
        `aWhere = Tabmix.navToolbox.whereToOpenSearch(aWhere);
      $&`
      )
      ._replace(
        "openTrustedLinkIn",
        `params.inBackground = params.inBackground || Tabmix.prefs.getBoolPref("loadSearchInBackground");
      $&`
      )
      ._replace(/searchbar\.currentEngine/g, "this.currentEngine", {check: pIte})
      ._replace(/BTPIServices/g, "Services", {check: pIte})
      .toCode();
  },

  toolbarButtons: function TMP_navToolbox_toolbarButtons() {
    gTMPprefObserver.setSingleWindowUI();
    gTMPprefObserver.showReloadEveryOnReloadButton();
    TMP_ClosedTabs.setButtonType(Tabmix.prefs.getBoolPref("undoCloseButton.menuonly"));
  },

  tabStripAreaChanged() {
    /*
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
    if (typeof privateTab == "object") {
      TMP_eventListener.updateMultiRow(true);
    }
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

    if (!reset && box == gBrowser.tabContainer.nextSibling) {
      return;
    }

    let tabsPosition = Tabmix.getPlacement("tabbrowser-tabs");
    if (tabsPosition > -1) {
      CustomizableUI.moveWidgetWithinArea("tabmix-scrollbox", tabsPosition + 1);
    }

    if (!onlyPosition) {
      let useTabmixButtons =
        TabmixTabbar.scrollButtonsMode > TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT;
      Tabmix.tabsUtils.updateScrollButtons(useTabmixButtons);
    }
  },
};

Tabmix.getPlacement = function (id) {
  let placement = CustomizableUI.getPlacementOfWidget(id);
  return placement ? placement.position : -1;
};

Tabmix.getPrivateMethod = function ({parent, parentName, methodName, nextMethodName, sandbox}) {
  const firefoxClass = parent?.constructor;
  const name = parentName || firefoxClass?.name;
  const nonPrivateMethodName = `${name}._${methodName}`;

  const errorMsg = `can't find private function ${name}.#${methodName}`;
  const method = function () {};
  if (!firefoxClass) {
    console.error(`Tabmix Error: can't find ${name} constructor for element\n${errorMsg}`);
    return method;
  }

  let code = firefoxClass
    .toString()
    .split(` #${methodName}`)[1] // function to extract from source code
    ?.split(` ${nextMethodName}`)[0] // next function in the source code
    ?.trim();
  if (code) {
    try {
      const codeWithoutCommnets = code.split("\n");
      while (codeWithoutCommnets.at(-1)?.trim().startsWith("//")) {
        codeWithoutCommnets.pop();
      }
      code = codeWithoutCommnets.join("\n").trim();
      return Tabmix.makeCode(`_${methodName}${code}`, parent, nonPrivateMethodName, sandbox);
    } catch (error) {
      console.error(
        `Tabmix Error: getPrivateMethod failed to evaluate ${nonPrivateMethodName}`,
        error
      );
      return method;
    }
  }
  console.error(`Tabmix Error: ${errorMsg}`);
  return method;
};

// @ts-expect-error - use typescript element is MozTabbrowserTabGroup
Tabmix.isTabGroup = element => Boolean(element?.tagName == "tab-group");
