/* eslint no-var: 2, prefer-const: 2 class-methods-use-this: 0 */
/* globals MozArrowScrollbox */
"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{
  class TabmixRightScrollBox extends MozXULElement {
    constructor() {
      super();

      this.addEventListener("dragover", event => {
        const tabBar = gBrowser.tabContainer;
        if (tabBar.useTabmixDnD(event))
          TMP_tabDNDObserver.onDragOver(event);
      });

      this.addEventListener("drop", event => {
        this.finishScroll(event);
      });

      this.addEventListener("dragexit", event => {
        this.finishScroll(event);
      });
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
      <toolbarbutton class="scrollbutton-up" inherits="orient,disabled=scrolledtostart" oncontextmenu="TabmixAllTabs.createScrollButtonTabsList(event, 'left');" anonid="scrollbutton-up-right" onclick="if (!this.disabled) gBrowser.tabContainer.mTabstrip._distanceScroll(event);" onmousedown="if (event.button === 0 FROM-DTD-ampFROM-DTD-amp !this.disabled) gBrowser.tabContainer.mTabstrip._startScroll(-1);" onmouseup="if (event.button === 0) gBrowser.tabContainer.mTabstrip._stopScroll();" onmouseover="if (!this.disabled) gBrowser.tabContainer.mTabstrip._continueScroll(-1);" onmouseout="gBrowser.tabContainer.mTabstrip._pauseScroll();"></toolbarbutton>
      <toolbarbutton class="scrollbutton-down" inherits="orient,disabled=scrolledtoend" oncontextmenu="TabmixAllTabs.createScrollButtonTabsList(event, 'right');" anonid="scrollbutton-down-right" onclick="if (!this.disabled) gBrowser.tabContainer.mTabstrip._distanceScroll(event);" onmousedown="if (event.button === 0 FROM-DTD-ampFROM-DTD-amp !this.disabled) gBrowser.tabContainer.mTabstrip._startScroll(1);" onmouseup="if (event.button === 0) gBrowser.tabContainer.mTabstrip._stopScroll();" onmouseover="if (!this.disabled) gBrowser.tabContainer.mTabstrip._continueScroll(1);" onmouseout="gBrowser.tabContainer.mTabstrip._pauseScroll();"></toolbarbutton>
    `));
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

      this._scrollButtonUp = document.getAnonymousElementByAttribute(this, "anonid", "scrollbutton-up-right");

      this._scrollButtonDown = document.getAnonymousElementByAttribute(this, "anonid", "scrollbutton-down-right");

      const _gBrowser = window.gBrowser || window._gBrowser;
      if (Tabmix.isVersion(580)) {
        _gBrowser.tabContainer.mTabstrip = _gBrowser.tabContainer.arrowScrollbox;
      }
      const tabstrip = _gBrowser.tabContainer.mTabstrip;
      tabstrip._scrollButtonDownRight = this._scrollButtonDown;
      tabstrip._scrollButtonUpRight = this._scrollButtonUp;
    }

    // eslint-disable-next-line class-methods-use-this
    finishScroll(aEvent) {
      const tabBar = gBrowser.tabContainer;
      if (!tabBar.useTabmixDnD(aEvent))
        return;
      TMP_tabDNDObserver.clearDragmark();
      let index;
      const target = aEvent.originalTarget.getAttribute("anonid");
      if (target == "scrollbutton-up-right")
        index = -1;
      else if (target == "scrollbutton-down-right")
        index = 1;
      if (index) {
        const tabstrip = gBrowser.tabContainer.mTabstrip;
        const distanceToRow = tabstrip._distanceToRow(0);
        let amountToScroll;
        if (distanceToRow * index < 0)
          amountToScroll = tabstrip.singleRowHeight * index + distanceToRow;
        else
          amountToScroll = distanceToRow;
        tabstrip.scrollByPixels(amountToScroll);
      }
    }
  }

  class TabmixArrowscrollbox extends MozArrowScrollbox {
    constructor() {
      super();

      this.addEventListener("underflow", event => {
      // filter underflow events which were dispatched on nested scrollboxes
        if (event.originalTarget != this._scrollbox)
          return;

        if (this.orient == "vertical") {
        // vertical scrollbox - Ignore horizontal events
          if (event.detail == 1 || this.blockUnderflow) {
            this.blockUnderflow = false;
            return;
          }
        } else if (event.detail === 0) {
        // horizontal scrollbox - Ignore vertical events
          return;
        }

        const tabs = document.getBindingParent(this);
        if (tabs.hasAttribute("multibar") && Tabmix.tabsUtils.overflow) {
        //XXX don't do anything on Linux when hovering last tab and
        // we show close button on tab on hover
          if (!TabmixSvc.isLinux || TabmixTabbar.visibleRows == 1 ||
          (!Tabmix.visibleTabs.last.hasAttribute("showbutton") &&
            !Tabmix.visibleTabs.last.hasAttribute("showbutton_removed")))
            Tabmix.tabsUtils.updateVerticalTabStrip();
        } else {
          Tabmix.tabsUtils.overflow = false;
        }
      }, true);

      this.addEventListener("overflow", event => {
      // filter overflow events which were dispatched on nested scrollboxes
        if (event.originalTarget != this._scrollbox)
          return;

        if (this.orient == "vertical") {
        // vertical scrollbox - Ignore horizontal events
          if (event.detail == 1 || this.blockOverflow) {
            this.blockOverflow = false;
            return;
          }
        } else {
        // horizontal scrollbox - Ignore vertical events
          if (event.detail === 0) {
            return;
          }
          if (this.isMultiRow && !this._enterVerticalModeTimeout) {
            this.__needToSetVerticalOrient = true;
            // when widthFitTitle is false we enter vertical mode only after we are in overflow
            // if first or last tab is not visible enter vertical mode
            this._enterVerticalModeTimeout = setTimeout(() => {
              this._enterVerticalModeTimeout = null;
              this._enterVerticalMode(true);
            }, 25);
            return;
          }
        }

        if (this.isMultiRow) {
        //XXX don't do anything on Linux when hovering last tab and
        // we show close button on tab on hover
          if (!TabmixSvc.isLinux || TabmixTabbar.visibleRows == 1 ||
          !Tabmix.visibleTabs.last.hasAttribute("showbutton"))
            Tabmix.tabsUtils.updateVerticalTabStrip();
        } else {
          Tabmix.tabsUtils.overflow = true;
        }
      });

      this.addEventListener("scroll", () => {
        if (this.__needToSetVerticalOrient)
          this._enterVerticalMode();

        const tabBar = document.getBindingParent(this);
        tabBar._unlockTabSizing();

        if (this.isMultiRow && tabBar.firstChild.pinned)
          this.setFirstTabInRow(true);
      });
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }

      this.blockUnderflow = false;

      this.blockOverflow = false;

      this._scrollButtonUpLeft = document.getAnonymousElementByAttribute(this, "anonid", "scrollbutton-up");

      this._scrollButtonDownLeft = document.getAnonymousElementByAttribute(this, "anonid", "scrollbutton-down");

      this.innerbox = document.getAnonymousElementByAttribute(this._scrollbox, "class", "box-inherit scrollbox-innerbox");

      this.scrollboxPaddingTop = parseFloat(window.getComputedStyle(this._scrollbox).paddingTop);

      this.scrollboxPaddingBottom = parseFloat(window.getComputedStyle(this._scrollbox).paddingBottom);

      this._tabMarginLeft = null;

      this._tabMarginRight = null;

      this.tabmixPrefObserver = {
        scrollbox: this,
        observe(subject, topic, data) {
          switch (data) {
            case "toolkit.scrollbox.clickToScroll.scrollDelay":
              this.scrollbox._scrollDelay = Services.prefs.getIntPref(data);
              break;
            case "toolkit.scrollbox.smoothScroll":
              this.scrollbox.smoothScroll = Services.prefs.getBoolPref(data);
              break;
          }
        }
      };

      this._verticalAnimation = 4;

      this._smoothVerticalScroll = 6;

      this._singleRowHeight = null;

      this.firstVisibleRow = null;

      this.firstTabInRowMargin = 0;

      if (this.tabmix_inited)
        return;

      this.tabmix_inited = true;

      this.offsetAmountToScroll = Tabmix.prefs.getBoolPref("offsetAmountToScroll");
      this.offsetRatio = Tabmix.tabsUtils.closeButtonsEnabled ? 0.70 : 0.50;
      this.minOffset = TabmixSvc.australis ? 25 : 50;
      if (Tabmix.isVersion(570)) {
        Object.defineProperty(this, 'scrollPosition', {
          get: () => {
            return this.orient == "vertical" ?
              this._scrollbox.scrollTop :
              this._scrollbox.scrollLeft;
          },
        });

        Tabmix.changeCode(this, "scrollbox.ensureElementIsVisible")._replace(
          'element.scrollIntoView',
          `if (this.isMultiRow && Tabmix.tabsUtils.isElementVisible(element)) {
                 return;
               }
               $&`
        ).toCode();

        Tabmix.changeCode(this, "scrollbox.scrollByIndex")._replace(
          'this.ensureElementIsVisible',
          'scrollIntoView', {flags: "g"}
        )._replace(
          '{', `{
              const block = index > 0 ? "end" : "start";
              const scrollIntoView = (element, aInstant) => {
                if (!this.isMultiRow) {
                  this.ensureElementIsVisible(element, aInstant);
                  return;
                }
                if (!this._canScrollToElement(element)) {
                  return;
                }
                const behavior = aInstant ? "instant" : "auto";
                element.scrollIntoView({behavior, block});
              };`
        ).toCode();
      } else {
        Tabmix.changeCode(this, "scrollbox.ensureElementIsVisible")._replace(
          'var amountToScroll',
          '$&, offset = true'
        )._replace(
          'STOP_DISTANCE = 15;',
          'STOP_DISTANCE = this.isMultiRow ? 3 : 15;'
        )._replace(
          'amountToScroll = this._isScrolling * STOP_DISTANCE;',
          '{$& \
               offset = false;}'
        )._replace(
          'this._stopSmoothScroll();',
          '$& \
               if (offset) {\
                 amountToScroll += this.getOffsetAmountToScroll(element, amountToScroll);}'
        ).toCode();

        Tabmix.changeCode(this, "scrollbox._smoothScrollByPixels")._replace(
          '{',
          '$& \
               amountToScroll = this._distanceToRow(amountToScroll);'
        ).toCode();

        // the ratio between tab width and tab height is approximately 6
        // we multiply here the distance to get same animation effect.
        Tabmix.changeCode(this._scrollAnim, "scrollbox._scrollAnim.start")._replace(
          'Math.abs(distance)',
          'Math.abs(distance * (this.scrollbox.isMultiRow ? this.scrollbox._verticalAnimation : 1))'
        ).toCode();

        // replace the original method
        this.scrollByPixels = (px, aSmoothScroll) => {
          if (this._isScrolling || aSmoothScroll) {
            this.scrollPosition += px;
          } else {
            this.scrollPosition += this._distanceToRow(px);
          }
        };

        if (TabmixSvc.isPaleMoon && Tabmix.isVersion(0, 280)) {
          Tabmix.changeCode(this, "scrollbox.scrollByIndex")._replace(
            'var x = index > 0 ? rect[end] + 1 : rect[start] - 1;',
            'var offset = this.isMultiRow ? 2 : 1;\n          ' +
          'var x = index > 0 ? rect[end] + offset : rect[start] - offset;'
          ).toCode();
        }
      }

      // Bug 1387130 (landed in Firefox 57) - Use original tabstrip scrolling behaviour when using scrollbuttons
      if (this._arrowScrollAnim) {
      // we divide scrollDelta by the ratio between tab width and tab height
        Tabmix.changeCode(this._arrowScrollAnim, "scrollbox._arrowScrollAnim.sample")._replace(
          '0.5 * timePassed * scrollIndex',
          'this.scrollbox.isMultiRow ? $& / this.scrollbox._verticalAnimation : $&'
        ).toCode();
      }

      Tabmix.changeCode(this, "scrollbox._distanceScroll")._replace(
        '{',
        '{ if (aEvent.button && aEvent.button == 2) return;'
      ).toCode();

      if (Tabmix.isVersion(560)) {
        const $LF = '\n            ';
        Tabmix.changeCode(this, "scrollbox._updateScrollButtonsDisabledState")._replace(
          'if (this.hasAttribute("notoverflowing")) {',
          '$&' + $LF +
        'let box = document.getElementById("tabmixScrollBox");' + $LF +
        'Tabmix.setItem(box, "scrolledtoend", true);' + $LF +
        'Tabmix.setItem(box, "scrolledtostart", true);'
        )._replace(
          'this.scrollboxPaddingLeft',
          'this.isMultiRow ? this.scrollboxPaddingTop : $&', {check: !Tabmix.isVersion(570)}
        )._replace(
          'this.scrollboxPaddingRight',
          'this.isMultiRow ? this.scrollboxPaddingBottom : $&', {check: !Tabmix.isVersion(570)}
        )._replace(
          'this._isRTLScrollbox',
          '$& && !this.isMultiRow'
        )._replace(
          'if (leftOrTopElement',
          `if (this.isMultiRow) {
                  const _scrollboxPaddingLeft = typeof scrollboxPaddingLeft == "number" ? scrollboxPaddingLeft : 0;
                  const _scrollboxPaddingRight = typeof scrollboxPaddingRight == "number" ? scrollboxPaddingRight : 0;
                  if (leftOrTopElement &&
                      leftOrTopEdge(leftOrTopElement) >= leftOrTopEdge(this._scrollbox) + _scrollboxPaddingLeft) {
                    scrolledToStart = true;
                  } else if (rightOrBottomElement &&
                             rightOrBottomEdge(rightOrBottomElement) <= rightOrBottomEdge(this._scrollbox) - _scrollboxPaddingRight + 2) {
                    scrolledToEnd = true;
                  }
                } else $&`
        )._replace(
          'if (scrolledToEnd) {',
          'let box = document.getElementById("tabmixScrollBox");' + $LF +
        '  Tabmix.setItem(box, "scrolledtoend", scrolledToEnd || null);' + $LF +
        '  Tabmix.setItem(box, "scrolledtostart", scrolledToStart || null);' + $LF +
        '  $&'
        ).toCode();
      } else if (Tabmix.isVersion(320, 270)) {
        Tabmix.changeCode(this, "scrollbox._updateScrollButtonsDisabledState")._replace(
        // when theme or extension add negative margin-bottom to the tab or
        // tab content the scrollHeight can be larger than the actual
        // inner-box height
          'this.scrollClientSize + this.scrollPosition == this.scrollSize',
          'this.isScrolledToEnd'
        )._replace(
          /(})(\)?)$/,
          '          var box = document.getElementById("tabmixScrollBox");\n' +
        '          Tabmix.setItem(box, "scrolledtoend", scrolledToEnd || null);\n' +
        '          Tabmix.setItem(box, "scrolledtostart", scrolledToStart || null);\n' +
        '$1$2'
        ).toCode();
      }

      if (Tabmix.isVersion(570)) {
        Tabmix.changeCode(this, "scrollbox.lineScrollAmount", {getter: true})._replace(
          '{', `{
              if (this.isMultiRow) {
                return this.scrollSize / Tabmix.tabsUtils.lastTabRowNumber;
              }`
        ).defineProperty();
      } else if (Tabmix.isVersion(530)) {
        Tabmix.changeCode(this, "scrollbox.lineScrollAmount", {getter: true})._replace(
          'totalWidth / elements.length',
          'this.isMultiRow ? totalWidth / Tabmix.tabsUtils.lastTabRowNumber : $&'
        ).defineProperty();
      }

      this._scrollButtonUpLeft.addEventListener("contextmenu", this._createScrollButtonContextMenu, true);
      this._scrollButtonDownLeft.addEventListener("contextmenu", this._createScrollButtonContextMenu, true);

      Services.prefs.addObserver("toolkit.scrollbox.", this.tabmixPrefObserver, false);
      this.firstVisible = {tab: null, x: 0, y: 0};
    }
    /**
   * for Vertical Tabs extension
   */
    get _verticalTabs() {
      return this.orient == 'vertical';
    }

    get isMultiRow() {
      return this.getAttribute("flowing") == "multibar";
    }
    /**
   * not in use in Firefox 57+
   */
    get isScrolledToEnd() {
      const scrollPosition = this.scrollClientSize + this.scrollPosition;
      if (this.orient == "vertical" && this.isMultiRow) {
        const height = this.innerbox.getBoundingClientRect().height;
        if (Math.round(height) - scrollPosition < 2) {
          return true;
        }
      }
      return scrollPosition == this.scrollSize;
    }

    get singleRowHeight() {
      if (this._singleRowHeight)
        return this._singleRowHeight;

      if (TabmixTabbar.visibleRows > 1) {
        this._singleRowHeight = TabmixTabbar.singleRowHeight;
        this._smoothVerticalScroll = Math.round(this._singleRowHeight / 4);
        return this._singleRowHeight;
      }

      // still in one row
      const tabs = document.getBindingParent(this);
      const {height} = tabs.selectedItem.getBoundingClientRect();
      if (height)
        return height;

      // if selectedItem don't have height find other tab that does
      for (let i = 0; i < tabs.childNodes.length; i++) {
        const tab = tabs.childNodes[i];
        const tabHeight = tab.getBoundingClientRect().height;
        if (tabHeight) {
          return tabHeight;
        }
      }

      return this._scrollbox.getBoundingClientRect().height;
    }

    /**
   * we replace tabbrowser.xml "tabbrowser-arrowscrollbox" binding with this one
   * Override scrollbox.xml method, since our scrollbox's children are
   * inherited from the binding parent
   */
    _getScrollableElements() {
      return Array.prototype.filter.call(document.getBindingParent(this).childNodes,
        this._canScrollToElement, this);
    }

    _canScrollToElement(tab) {
      return !tab.pinned && !tab.hidden;
    }

    _calcTabMargins(aTab) {
      if (this._tabMarginLeft === null || this._tabMarginRight === null) {
        const tabMiddle = document.getAnonymousElementByAttribute(aTab, "class", "tab-background-middle");
        const tabMiddleStyle = window.getComputedStyle(tabMiddle);
        this._tabMarginLeft = parseFloat(tabMiddleStyle.marginLeft);
        this._tabMarginRight = parseFloat(tabMiddleStyle.marginRight);
      }
    }

    _adjustElementStartAndEnd(aTab, tabStart, tabEnd) {
      if (this.isMultiRow)
        return [tabStart, tabEnd];

      this._calcTabMargins(aTab);
      if (this._tabMarginLeft < 0) {
        tabStart += this._tabMarginLeft;
      }
      if (this._tabMarginRight < 0) {
        tabEnd -= this._tabMarginRight;
      }
      return [tabStart, tabEnd];
    }

    _createScrollButtonContextMenu(aEvent) {
      const side = aEvent.target.className == "scrollbutton-up" ? "left" : "right";
      TabmixAllTabs.createScrollButtonTabsList(aEvent, side);
    }

    /**
   * not in use in Firefox 57+
   */
    getOffsetAmountToScroll(element, amountToScroll) {
      let offset = 0;
      const isScrollingLeft = amountToScroll > 0;
      if (amountToScroll !== 0 && this.offsetAmountToScroll &&
      !this.isMultiRow) {
        let tab;
        if (isScrollingLeft)
          tab = Tabmix.visibleTabs.next(element);
        else
          tab = Tabmix.visibleTabs.previous(element);
        if (tab) {
          offset = Math.min(this.minOffset, this.offsetRatio * Tabmix.getBoundsWithoutFlushing(tab).width);
          if (!isScrollingLeft)
            offset = Math.min(this.scrollPosition, offset);
        }
      }
      return isScrollingLeft ? offset : -offset;
    }

    _distanceToRow(amountToScroll) {
      if (!this.isMultiRow)
        return amountToScroll;
      const rowHeight = this.singleRowHeight;
      const position = this.scrollPosition;
      return Math.round((amountToScroll + position) / rowHeight) * rowHeight - position;
    }

    _enterVerticalMode(blockUnderflow) {
    // when widthFitTitle is false we enter vertical mode only after we are in overflow
    // if first or last tab is not visible enter vertical mode
    // we can get here from new tabs, window resize tabs change width
    // so we call this function after 3 events TabOpen, overflow and scroll
      this.__needToSetVerticalOrient = false;
      if (this.orient == "vertical")
        return;

      Tabmix.tabsUtils.adjustNewtabButtonVisibility();
      const tabs = this._getScrollableElements();
      if (!tabs.length)
        return;
      const isFirstTabVisible = Tabmix.tabsUtils.isElementVisible(tabs[0]);
      const isLastTabVisible = Tabmix.tabsUtils.isElementVisible(tabs[tabs.length - 1]);
      if (!isFirstTabVisible || !isLastTabVisible) {
      // show Newtabbutton for the first time
      // for the case last tab in row fill the all strip and the button
      // is on the next row
        Tabmix.tabsUtils.disAllowNewtabbutton = false;
        this.orient = "vertical";
        const tabBar = document.getBindingParent(this);
        Tabmix.setItem(tabBar, "multibar", true);
        Tabmix.setItem("TabsToolbar", "multibar", true);
        if (Tabmix.tabsUtils.updateVerticalTabStrip() === null)
          TabmixTabbar._failedToEnterVerticalMode = true;
        if (blockUnderflow && this.orient == "vertical")
          this.blockUnderflow = true;
        this.updateOverflow(Tabmix.tabsUtils.overflow);
      }
    }

    setFirstTabInRow(scroll) {
      const firstVisibleRow = Math.round(this.scrollPosition / this.singleRowHeight) + 1;
      if (scroll) {
        if (this.firstVisibleRow == firstVisibleRow)
          return;
      } else if (this.firstVisible.tab) {
        const rect = this.firstVisible.tab.getBoundingClientRect();
        if (this.firstVisible.x == rect.left && this.firstVisible.y == rect.top)
          return;
      }

      this.firstVisibleRow = firstVisibleRow;

      ///XXX check if we can set the margin with animation when we scroll
      const end = Tabmix.ltr ? "right" : "left";
      const containerEnd = this.scrollClientRect[end];
      const topY = Tabmix.tabsUtils.topTabY;
      const tabs = this._getScrollableElements();
      let index, current = 0;
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        let row = tab.closing ? -1 : Tabmix.tabsUtils.getTabRowNumber(tab, topY);
        if (row > current) {
          current = row;
          if (!tab.hasAttribute("tabmix-firstTabInRow"))
            tab.setAttribute("tabmix-firstTabInRow", true);
          else if (i > 0) {
          // remove the margin when the tab have place in the previous row
            const tabEnd = tabs[i - 1].getBoundingClientRect()[end] +
            (Tabmix.ltr ? tab.getBoundingClientRect().width : 0);
            if (!Tabmix.compare(tabEnd, containerEnd, Tabmix.rtl)) {
              tab.removeAttribute("tabmix-firstTabInRow");
              // continue
              row = -1;
            }
          }
          if (row == firstVisibleRow) {
            const rect = tab.getBoundingClientRect();
            this.firstVisible = {tab, x: rect.left, y: rect.top};
            index = ++i;
            break;
          }
        } else if (tab.hasAttribute("tabmix-firstTabInRow"))
          tab.removeAttribute("tabmix-firstTabInRow");
      }
      for (let i = index; i < tabs.length; i++) {
        const tab = tabs[i];
        if (tab.hasAttribute("tabmix-firstTabInRow"))
          tab.removeAttribute("tabmix-firstTabInRow");
      }

      // if a smoothScroll is in progress call ensureElementIsVisible again
      // the amountToScroll changed when we changed firstTabInRow
      if (this._scrollTarget) {
        const instantScroll = !Tabmix.isVersion(570);
        this.ensureElementIsVisible(this._scrollTarget, instantScroll);
      }
    }

    resetFirstTabInRow() {
      if (this.firstTabInRowMargin === 0) {
        return;
      }
      this.firstTabInRowMargin = 0;
      // getElementsByAttribute return a live nodList
      // each time we remove the attribute we remove node from the list
      const tabBar = document.getBindingParent(this);
      const tabs = tabBar.getElementsByAttribute("tabmix-firstTabInRow", "*");
      for (let i = 0, num = tabs.length; i < num; i++) {
        tabs[0].removeAttribute("tabmix-firstTabInRow");
      }
      this.firstVisible = {tab: null, x: 0, y: 0};
    }

    updateOverflow(overflow) {
    // we get here after we update overflow from updateVerticalTabStrip
      if (this.orient == "horizontal" ||
      this.hasAttribute("notoverflowing") == !overflow)
        return;

      Tabmix.setItem(this, "notoverflowing", !overflow || null);

      try {
      // See bug 341047 and comments in overflow handler as to why
      // try..catch is needed here
        this._updateScrollButtonsDisabledState();

        if (!overflow) {
          const childNodes = this._getScrollableElements();
          if (childNodes && childNodes.length) {
            const instantScroll = Tabmix.isVersion(570);
            this.ensureElementIsVisible(childNodes[0], instantScroll);
          }
        }
      } catch (e) {
        Tabmix.setItem(this, "notoverflowing", overflow || null);
      }
    }
    disconnectedCallback() {
      this._scrollButtonUpLeft.removeEventListener("contextmenu", this._createScrollButtonContextMenu, true);
      this._scrollButtonDownLeft.removeEventListener("contextmenu", this._createScrollButtonContextMenu, true);

      Services.prefs.removeObserver("toolkit.scrollbox.", this.tabmixPrefObserver);
    }
  }

  class BottomToolbar extends MozXULElement {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox flex="1" inherits="orient,width" anonid="toolbar-innerbox" class="tabmixplus-toolbar-inner-box">
          <xbl:children></xbl:children>
        </hbox>
      `));
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

      Tabmix.bottomToolbarUtils.init();
    }
  }

  if (!customElements.get("tabmix-right-scrollBox")) {
    customElements.define("tabmix-right-scrollBox", TabmixRightScrollBox);
  }

  if (!customElements.get("tabmix-arrowscrollbox-clicktoscroll")) {
    customElements.define("tabmix-arrowscrollbox-clicktoscroll", TabmixArrowscrollbox);
  }

  if (!customElements.get("firefox-bottom-toolbar")) {
    MozXULElement.implementCustomInterface(BottomToolbar, [Ci.nsIDOMEventListener]);
    customElements.define("firefox-bottom-toolbar", BottomToolbar);
  }
}
