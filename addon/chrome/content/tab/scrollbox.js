/* eslint no-var: 2, prefer-const: 2 class-methods-use-this: 0 */
"use strict";

Tabmix.multiRow = {
  init() {
    try {
      this.extandArrowscrollbox();
    } catch (ex) {
      Tabmix.reportError(ex);
    }

    try {
      this.addScrollBoxButtons();
    } catch (ex) {
      Tabmix.reportError(ex);
    }
  },

  extandArrowscrollbox() {
    /** @typedef {MockedGeckoTypes.TabmixArrowScrollbox} This */

    class TabmixArrowScrollbox {
      /** @this {This} */
      connectTabmix() {
        if (this.tabmixInitialized) {
          return;
        }
        this.tabmixInitialized = true;

        this.blockUnderflow = false;
        this._scrollButtonUpLeft = this.shadowRoot.getElementById("scrollbutton-up");
        this._scrollButtonDownLeft = this.shadowRoot.getElementById("scrollbutton-down");
        this.scrollboxPaddingTop = parseFloat(window.getComputedStyle(this.scrollbox).paddingTop);
        this.scrollboxPaddingBottom = parseFloat(window.getComputedStyle(this.scrollbox).paddingBottom);
        this._tabMarginLeft = null;
        this._tabMarginRight = null;
        this._verticalAnimation = 3;
        this._singleRowHeight = null;
        this.firstVisibleRow = null;
        this.firstTabInRowMargin = 0;
        this.offsetAmountToScroll = Tabmix.prefs.getBoolPref("offsetAmountToScroll");
        this.offsetRatio = Tabmix.tabsUtils.closeButtonsEnabled ? 0.70 : 0.50;
        this.minOffset = 50;
        this.firstVisible = {tab: null, x: 0, y: 0};

        this.scrollbox.addEventListener("underflow", event => {
          // filter underflow events which were dispatched on nested scrollboxes
          if (event.originalTarget !== this.scrollbox)
            return;

          // Ignore events that doesn't match our orientation.
          // Scrollport event orientation:
          //   0: vertical
          //   1: horizontal
          //   2: both
          if (this.getAttribute("orient") === "vertical") {
            if (event.detail === 1) {
              return;
            }
          } else if (event.detail === 0 && !this.isMultiRow || this.blockUnderflow) {
            this.blockUnderflow = false;
            return;
          }

          const tabBar = this.parentNode;
          if (tabBar.hasAttribute("multibar") && Tabmix.tabsUtils.overflow) {
            //XXX don't do anything on Linux when hovering last tab and
            // we show close button on tab on hover
            if (!TabmixSvc.isLinux || TabmixTabbar.visibleRows === 1 ||
              !Tabmix.visibleTabs.last.hasAttribute("showbutton") &&
                !Tabmix.visibleTabs.last.hasAttribute("showbutton_removed"))
              Tabmix.tabsUtils.updateVerticalTabStrip();
          } else {
            Tabmix.tabsUtils.overflow = false;
          }
        }, true);

        this.scrollbox.addEventListener("overflow", event => {
          // filter overflow events which were dispatched on nested scrollboxes
          if (event.originalTarget !== this.scrollbox)
            return;

          // Ignore events that doesn't match our orientation.
          // Scrollport event orientation:
          //   0: vertical
          //   1: horizontal
          //   2: both
          if (this.getAttribute("orient") === "vertical") {
            if (event.detail === 1) {
              return;
            }
            // allow vertical event only in multi-row mode
          } else if (event.detail === 0 && !this.isMultiRow) {
            return;
          }

          if (this.isMultiRow) {
            //XXX don't do anything on Linux when hovering last tab and
            // we show close button on tab on hover
            if (!TabmixSvc.isLinux || TabmixTabbar.visibleRows === 1 ||
              !Tabmix.visibleTabs.last.hasAttribute("showbutton"))
              Tabmix.tabsUtils.updateVerticalTabStrip();
          } else {
            Tabmix.tabsUtils.overflow = true;
          }
        });

        this.addEventListener("scroll", () => {
          const tabBar = this.parentNode;
          tabBar._unlockTabSizing();

          if (this.isMultiRow && tabBar.allTabs[0].pinned) {
            this.setFirstTabInRow(true);
          }
        });

        this.tabmixPrefObserver = {
          scrollbox: this,
          observe(subject, topic, data) {
            switch (data) {
              case "toolkit.scrollbox.smoothScroll":
                this.scrollbox.smoothScroll = Services.prefs.getBoolPref(data);
                break;
            }
          }
        };

        Tabmix.changeCode(this, "scrollbox.ensureElementIsVisible")._replace(
          'element.scrollIntoView',
          `if (this.isMultiRow && Tabmix.tabsUtils.isElementVisible(element)) {
                     return;
                   }
                   $&`
        ).toCode();

        Tabmix.changeCode(this, "scrollbox.scrollByIndex")._replace(
          /this.ensureElementIsVisible\(.*\);/,
          'this._ensureElementIsVisibleByIndex(targetElement, aInstant, index);'
        ).toCode();

        // we divide scrollDelta by the ratio between tab width and tab height
        Tabmix.changeCode(this._arrowScrollAnim, "scrollbox._arrowScrollAnim.sample")._replace(
          '0.5 * timePassed * scrollIndex',
          'this.scrollbox.isMultiRow ? $& / this.scrollbox._verticalAnimation : $&'
        ).toCode();

        Tabmix.changeCode(this, "scrollbox._distanceScroll")._replace(
          '{',
          '{ if (aEvent.button && aEvent.button === 2) return;'
        ).toCode();

        const $LF = '\n            ';
        Tabmix.changeCode(this, "scrollbox._updateScrollButtonsDisabledState")._replace(
          'if (!this.hasAttribute("overflowing")) {',
          '$&' + $LF +
              'let box = document.getElementById("tabmix-scrollbox");' + $LF +
              'Tabmix.setItem(box, "scrolledtoend", true);' + $LF +
              'Tabmix.setItem(box, "scrolledtostart", true);'
        )._replace(
          'if (this.isRTLScrollbox',
          '$& && !this.isMultiRow'
        )._replace(
          /if\s*\(\n*\s*leftOrTopElement/,
          `if (this.isMultiRow) {
                      const _scrollboxPaddingLeft = typeof scrollboxPaddingLeft === "number" ? scrollboxPaddingLeft : 0;
                      const _scrollboxPaddingRight = typeof scrollboxPaddingRight === "number" ? scrollboxPaddingRight : 0;
                      if (leftOrTopElement &&
                          leftOrTopEdge(leftOrTopElement) >= leftOrTopEdge(this.scrollbox) + _scrollboxPaddingLeft) {
                        scrolledToStart = true;
                      } else if (rightOrBottomElement &&
                                 rightOrBottomEdge(rightOrBottomElement) <= rightOrBottomEdge(this.scrollbox) - _scrollboxPaddingRight + 2) {
                        scrolledToEnd = true;
                      }
                    } else $&`,
          {check: !Tabmix.isVersion(1020)}
        )._replace(
          'if (scrolledToEnd) {',
          'let box = document.getElementById("tabmix-scrollbox");' + $LF +
            '  Tabmix.setItem(box, "scrolledtoend", scrolledToEnd || null);' + $LF +
            '  Tabmix.setItem(box, "scrolledtostart", scrolledToStart || null);' + $LF +
            '  $&'
        ).toCode();

        Tabmix.changeCode(this, "scrollbox.lineScrollAmount", {getter: true})._replace(
          '{', `{
                  if (this.isMultiRow) {
                    return this.scrollSize / Tabmix.tabsUtils.lastTabRowNumber;
                  }`
        ).defineProperty();

        this._scrollButtonUpLeft.addEventListener("contextmenu", this._createScrollButtonContextMenu, true);
        this._scrollButtonDownLeft.addEventListener("contextmenu", this._createScrollButtonContextMenu, true);
        Services.prefs.addObserver("toolkit.scrollbox.", this.tabmixPrefObserver);
      }

      disconnectTabmix() {
        this._scrollButtonUpLeft.removeEventListener("contextmenu", this._createScrollButtonContextMenu, true);
        this._scrollButtonDownLeft.removeEventListener("contextmenu", this._createScrollButtonContextMenu, true);
        Services.prefs.removeObserver("toolkit.scrollbox.", this.tabmixPrefObserver);
      }

      /** @this {This} */
      get startEndProps() {
        return this.isMultiRow || this.getAttribute("orient") === "vertical" ?
          ["top", "bottom"] : ["left", "right"];
      }

      /** @this {This} */
      get isRTLScrollbox() {
        return this.isMultiRow || this.getAttribute("orient") === "vertical" ?
          false : Tabmix.rtl;
      }

      /** @this {This} */
      get isMultiRow() {
        return this.getAttribute("flowing") === "multibar";
      }

      /** @this {This} */
      get scrollSize() {
        return this.isMultiRow || this.getAttribute("orient") === "vertical" ?
          this.scrollbox.scrollHeight :
          this.scrollbox.scrollWidth;
      }

      /** @this {This} */
      get scrollPosition() {
        return this.isMultiRow || this.getAttribute("orient") === "vertical" ?
          this.scrollbox.scrollTop :
          this.scrollbox.scrollLeft;
      }

      /** @this {This} */
      get singleRowHeight() {
        if (this._singleRowHeight)
          return this._singleRowHeight;

        if (TabmixTabbar.visibleRows > 1) {
          this._singleRowHeight = this.scrollClientRect.height / TabmixTabbar.visibleRows;
          return this._singleRowHeight;
        }

        // still in one row
        const tabs = this.parentNode.allTabs;
        const {height} = this.parentNode.selectedItem.getBoundingClientRect();
        if (height)
          return height;

        // if selectedItem don't have height find other tab that does
        for (let i = 0; i < tabs.length; i++) {
          const tab = tabs[i];
          const tabHeight = tab.getBoundingClientRect().height;
          if (tabHeight) {
            return tabHeight;
          }
        }

        return this.scrollbox.getBoundingClientRect().height;
      }

      /** @this {This} */
      _ensureElementIsVisibleByIndex(element, instant, index) {
        if (!this.isMultiRow) {
          this.ensureElementIsVisible(element, instant);
          return;
        }
        if (!this._canScrollToElement(element)) {
          return;
        }
        if (this._ensureElementIsVisibleAnimationFrame) {
          window.cancelAnimationFrame(this._ensureElementIsVisibleAnimationFrame);
        }
        this._ensureElementIsVisibleAnimationFrame = window.requestAnimationFrame(
          () => {
            element.scrollIntoView({
              block: index > 0 ? "end" : "start",
              behavior: instant ? "instant" : "auto",
            });
            this._ensureElementIsVisibleAnimationFrame = 0;
          }
        );
      }

      _createScrollButtonContextMenu(aEvent) {
        const side = aEvent.originalTarget.id === "scrollbutton-up" ? "left" : "right";
        TabmixAllTabs.createScrollButtonTabsList(aEvent, side);
      }

      _distanceToRow(amountToScroll) {
        if (!this.isMultiRow)
          return amountToScroll;
        const rowHeight = this.singleRowHeight;
        const position = this.scrollPosition;
        return Math.round((amountToScroll + position) / rowHeight) * rowHeight - position;
      }

      /** @this {This} */
      _enterVerticalMode(blockUnderflow) {
        // when widthFitTitle is false we enter vertical mode only after we are in overflow
        // if first or last tab is not visible enter vertical mode
        // we can get here from new tabs, window resize tabs change width
        // so we call this function after 3 events TabOpen, overflow and scroll
        if (this.getAttribute("orient") === "vertical" ||
            this.hasAttribute("overflowing")) {
          return;
        }

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
          const tabBar = this.parentNode;
          // set multibar also at updateVerticalTabStrip
          Tabmix.setItem(tabBar, "multibar", true);
          Tabmix.setItem("tabmix-bottom-toolbox", "multibar", true);
          const multibar = Tabmix.tabsUtils.updateVerticalTabStrip();
          if (multibar === null) {
            TabmixTabbar._failedToEnterVerticalMode = true;
          }
          if (blockUnderflow && multibar) {
            this.blockUnderflow = true;
          }
          this.updateOverflow(Tabmix.tabsUtils.overflow);
        }
      }

      /** @this {This} */
      setFirstTabInRow(scroll) {
        const firstVisibleRow = Math.round(this.scrollPosition / this.singleRowHeight) + 1;
        if (scroll) {
          if (this.firstVisibleRow === firstVisibleRow)
            return;
        } else if (this.firstVisible.tab) {
          const rect = this.firstVisible.tab.getBoundingClientRect();
          if (this.firstVisible.x === rect.left && this.firstVisible.y === rect.top)
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
            if (!tab.hasAttribute("tabmix-firstTabInRow")) {
              tab.setAttribute("tabmix-firstTabInRow", true);
            } else if (i > 0) {
              // remove the margin when the tab have place in the previous row
              const tabEnd = tabs[i - 1].getBoundingClientRect()[end] +
                (Tabmix.ltr ? tab.getBoundingClientRect().width : 0);
              if (!Tabmix.compare(tabEnd, containerEnd, Tabmix.rtl)) {
                tab.removeAttribute("tabmix-firstTabInRow");
                // continue
                row = -1;
              }
            }
            if (row === firstVisibleRow) {
              const rect = tab.getBoundingClientRect();
              this.firstVisible = {tab, x: rect.left, y: rect.top};
              index = ++i;
              break;
            }
          } else if (tab.hasAttribute("tabmix-firstTabInRow")) {
            tab.removeAttribute("tabmix-firstTabInRow");
          }
        }
        for (let i = index; i < tabs.length; i++) {
          const tab = tabs[i];
          if (tab.hasAttribute("tabmix-firstTabInRow"))
            tab.removeAttribute("tabmix-firstTabInRow");
        }
      }

      /** @this {This} */
      resetFirstTabInRow() {
        if (this.firstTabInRowMargin === 0) {
          return;
        }
        this.firstTabInRowMargin = 0;
        // getElementsByAttribute return a live nodList
        // each time we remove the attribute we remove node from the list
        const tabBar = this.parentNode;
        const tabs = tabBar.getElementsByAttribute("tabmix-firstTabInRow", "*");
        for (let i = 0, num = tabs.length; i < num; i++) {
          tabs[0].removeAttribute("tabmix-firstTabInRow");
        }
        this.firstVisible = {tab: null, x: 0, y: 0};
      }

      /** @this {This} */
      updateOverflow(overflow) {
        // we get here after we update overflow from updateVerticalTabStrip
        if (this.getAttribute("orient") === "vertical" ||
            this.hasAttribute("overflowing") === overflow) {
          return;
        }

        Tabmix.setItem(this, "overflowing", overflow || null);

        this._updateScrollButtonsDisabledState();
        if (!overflow) {
          const childNodes = this._getScrollableElements();
          if (childNodes && childNodes.length) {
            this.ensureElementIsVisible(childNodes[0], true);
          }
        }
      }
    }

    // inject our code into arrowScrollbox
    const tabmixArrowScrollbox = Object.getOwnPropertyDescriptors(TabmixArrowScrollbox.prototype);
    delete tabmixArrowScrollbox.constructor;
    const arrowScrollbox = gBrowser.tabContainer.arrowScrollbox;
    Object.defineProperties(arrowScrollbox, tabmixArrowScrollbox);
    arrowScrollbox.connectTabmix();
  },

  addScrollBoxButtons() {
    class TabmixRightScrollBox extends MozXULElement {
      static get inheritedAttributes() {
        return {
          "#scrollbutton-up": "orient,disabled=scrolledtostart",
          "#scrollbutton-down": "orient,disabled=scrolledtoend",
        };
      }

      constructor() {
        super();
        this.attachShadow({mode: "open"});
        this.shadowRoot.appendChild(this.fragment);

        this.textContent = "";
        this._scrollButtonUp = this.shadowRoot.getElementById("scrollbutton-up");
        this._scrollButtonDown = this.shadowRoot.getElementById("scrollbutton-down");

        this.addEventListener("dragover", event => {
          if (TMP_tabDNDObserver.useTabmixDnD(event)) {
            TMP_tabDNDObserver._dragoverScrollButton(event);
            const ind = gBrowser.tabContainer._tabDropIndicator;
            const {left, right} = gBrowser.tabContainer.getBoundingClientRect();
            let newMarginX = event.originalTarget === this._scrollButtonDown ? right - left - 6 : 0;
            const newMarginY = event.originalTarget === this._scrollButtonUp ?
              (TabmixTabbar.visibleRows - 1) * gBrowser.tabContainer.arrowScrollbox.singleRowHeight : 0;
            ind.hidden = false;
            newMarginX += ind.clientWidth / 2;
            if (RTL_UI) {
              newMarginX *= -1;
            }
            ind.style.transform = "translate(" + Math.round(newMarginX) + "px," + Math.round(-newMarginY) + "px)";
          }
        });

        this.addEventListener("drop", event => {
          event.preventDefault();
          event.stopPropagation();
          this.finishScroll(event);
          gBrowser.tabContainer.on_drop(event);
        });

        this.addEventListener("dragexit", event => {
          this.finishScroll(event);
        });
      }

      get markup() {
        return `
        <html:link rel="stylesheet" href="chrome://global/skin/toolbarbutton.css"/>
        <html:link rel="stylesheet" href="chrome://global/skin/arrowscrollbox.css"/>
        <spacer part="overflow-end-indicator"/>
        <toolbarbutton id="scrollbutton-up" part="scrollbutton-up"
                inherits="orient,disabled=scrolledtostart"
                oncontextmenu="TabmixAllTabs.createScrollButtonTabsList(event, 'left');"
                anonid="scrollbutton-up-right"
                onclick="if (!this.disabled) gBrowser.tabContainer.arrowScrollbox._distanceScroll(event);"
                onmousedown="if (event.button === 0) if (!this.disabled) gBrowser.tabContainer.arrowScrollbox._startScroll(-1);"
                onmouseup="if (event.button === 0) gBrowser.tabContainer.arrowScrollbox._stopScroll();"
                onmouseover="if (!this.disabled) gBrowser.tabContainer.arrowScrollbox._continueScroll(-1);"
                onmouseout="gBrowser.tabContainer.arrowScrollbox._pauseScroll();">
        </toolbarbutton>
        <toolbarbutton id="scrollbutton-down" part="scrollbutton-down"
                inherits="orient,disabled=scrolledtoend"
                oncontextmenu="TabmixAllTabs.createScrollButtonTabsList(event, 'right');"
                anonid="scrollbutton-down-right"
                onclick="if (!this.disabled) gBrowser.tabContainer.arrowScrollbox._distanceScroll(event);"
                onmousedown="if (event.button === 0) if (!this.disabled) gBrowser.tabContainer.arrowScrollbox._startScroll(1);"
                onmouseup="if (event.button === 0) gBrowser.tabContainer.arrowScrollbox._stopScroll();"
                onmouseover="if (!this.disabled) gBrowser.tabContainer.arrowScrollbox._continueScroll(1);"
                onmouseout="gBrowser.tabContainer.arrowScrollbox._pauseScroll();">
        </toolbarbutton>
        `;
      }

      get fragment() {
        if (!this.constructor.hasOwnProperty("_fragment")) {
          this._fragment = MozXULElement.parseXULToFragment(
            this.markup
          );
        }
        return document.importNode(this._fragment, true);
      }

      connectedCallback() {
        if (this.hasConnected) {
          return;
        }
        this.hasConnected = true;

        const _gBrowser = window.gBrowser || window._gBrowser;
        const tabstrip = _gBrowser.tabContainer.arrowScrollbox;
        tabstrip._scrollButtonDownRight = this._scrollButtonDown;
        tabstrip._scrollButtonUpRight = this._scrollButtonUp;
        tabstrip._scrollButtonUp = tabstrip.shadowRoot.getElementById("scrollbutton-up");
        tabstrip._scrollButtonDown = tabstrip.shadowRoot.getElementById("scrollbutton-down");
        this.initializeAttributeInheritance();
      }

      finishScroll(aEvent) {
        if (!TMP_tabDNDObserver.useTabmixDnD(aEvent))
          return;
        gBrowser.tabContainer._tabDropIndicator.hidden = true;
        let index;
        const target = aEvent.originalTarget.getAttribute("anonid");
        if (target === "scrollbutton-up-right")
          index = -1;
        else if (target === "scrollbutton-down-right")
          index = 1;
        if (index) {
          const tabstrip = gBrowser.tabContainer.arrowScrollbox;
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
    if (!customElements.get("tabmixscrollbox")) {
      customElements.define("tabmixscrollbox", TabmixRightScrollBox);
    }
  },
};
