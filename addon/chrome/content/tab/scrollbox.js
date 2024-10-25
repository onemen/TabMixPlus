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
    /** @typedef {TabmixArrowScrollboxNS.ArrowScrollbox} This */
    /** @typedef {TabmixArrowScrollboxNS.ArrowScrollbox} ASB */

    class TabmixArrowScrollbox {
      /** @type {ASB["connectTabmix"]} */
      connectTabmix() {
        if (this.tabmixInitialized) {
          return;
        }
        this.tabmixInitialized = true;

        this._scrollButtonUpLeft = this.shadowRoot.getElementById("scrollbutton-up");
        this._scrollButtonDownLeft = this.shadowRoot.getElementById("scrollbutton-down");
        const style = window.getComputedStyle(this.scrollbox);
        this.scrollboxPaddingTop = style ? parseFloat(style.paddingTop) : 0;
        this.scrollboxPaddingBottom = style ? parseFloat(style.paddingBottom) : 0;
        this._verticalAnimation = 3;
        this._singleRowHeight = null;
        this.firstVisibleRow = -1;
        this.firstTabInRowMargin = 0;
        this.offsetRatio = Tabmix.tabsUtils.closeButtonsEnabled ? 0.70 : 0.50;
        this.minOffset = 50;
        this.firstVisible = {tab: null, x: 0, y: 0};

        const overflowTarget = Tabmix.isVersion(1310) ? this : this.scrollbox;
        overflowTarget.addEventListener("underflow", (/** @type {MouseEvent} */event) => {
          // filter underflow events which were dispatched on nested scrollboxes
          if (event.originalTarget !== overflowTarget) {
            return;
          }

          // Ignore events that doesn't match our orientation.
          // Scrollport event orientation:
          //   0: vertical
          //   1: horizontal
          //   2: both
          if (this.getAttribute("orient") === "vertical") {
            if (event.detail === 1) {
              return;
            }
          } else if (event.detail === 0 && !this.isMultiRow) {
            return;
          }

          if (TabmixTabbar.hasMultiRows && Tabmix.tabsUtils.overflow) {
            // don't do anything on Linux when hovering last tab and
            // we show close button on tab on hover
            if (
              !TabmixSvc.isLinux ||
              TabmixTabbar.visibleRows === 1 ||
              !Tabmix.visibleTabs.last.hasAttribute("showbutton") &&
                !Tabmix.visibleTabs.last.hasAttribute("showbutton_removed")
            )
              Tabmix.tabsUtils.updateVerticalTabStrip();
          } else if (
            !TabmixTabbar.widthFitTitle &&
            TabmixTabbar.hasMultiRows &&
            document.getElementById("tabmix-scrollbox").hasAttribute("overflowing")
          ) {
            // when widthFitTitle is false firefox arrowscrollbox fires underflow
            // event after tab closed when tabs in the last row are not in their
            // maximum width.
            // if our multi-row are overflowing call updateVerticalTabStrip to get the right state.
            Tabmix.tabsUtils.updateVerticalTabStrip();
          } else {
            Tabmix.tabsUtils.overflow = false;
          }
        }, true);

        overflowTarget.addEventListener("overflow", (/** @type {MouseEvent} */event) => {
          // filter overflow events which were dispatched on nested scrollboxes
          if (event.originalTarget !== overflowTarget) {
            return;
          }

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
          if (Tabmix.isVersion(1310)) {
            this._updateScrollButtonsDisabledState();
          }

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

        if (Tabmix.isVersion(1310)) {
          this._updateScrollButtonsDisabledState = Tabmix.getPrivateMethod(
            "arrowscrollbox",
            "updateScrollButtonsDisabledState",
            "disconnectedCallback"
          );
        }
        Tabmix.changeCode(this, "scrollbox._updateScrollButtonsDisabledState")._replace(
          'if (this.isRTLScrollbox',
          '$& && !this.isMultiRow', {flags: "g"}
        ).toCode();

        Tabmix.changeCode(this, "scrollbox.lineScrollAmount", {getter: true})._replace(
          '{', `{
                  if (this.isMultiRow) {
                    return this.scrollSize / Tabmix.tabsUtils.lastTabRowNumber;
                  }`
        ).defineProperty();

        const codeToReplace = Tabmix.isVersion(1310) ? 'this.#verticalMode' : 'this.getAttribute("orient") == "vertical"';
        Tabmix.changeCode(this, "scrollbox.on_touchstart")._replace(
          codeToReplace, 'this._verticalMode'
        ).toCode();

        Tabmix.changeCode(this, "scrollbox.on_touchmove")._replace(
          codeToReplace, 'this._verticalMode'
        ).toCode();

        this._scrollButtonUpLeft.addEventListener("contextmenu", this._createScrollButtonContextMenu, true);
        this._scrollButtonDownLeft.addEventListener("contextmenu", this._createScrollButtonContextMenu, true);
        Services.prefs.addObserver("toolkit.scrollbox.", this.tabmixPrefObserver);
      }

      /** @this {This} */
      disconnectTabmix() {
        this._scrollButtonUpLeft.removeEventListener("contextmenu", this._createScrollButtonContextMenu, true);
        this._scrollButtonDownLeft.removeEventListener("contextmenu", this._createScrollButtonContextMenu, true);
        Services.prefs.removeObserver("toolkit.scrollbox.", this.tabmixPrefObserver);
      }

      /** @this {This} */
      get _verticalMode() {
        return this.isMultiRow || this.getAttribute("orient") === "vertical";
      }

      /** @this {This} */
      get startEndProps() {
        return this._verticalMode ?
          ["top", "bottom"] : ["left", "right"];
      }

      get isRTLScrollbox() {
        return this._verticalMode ?
          false : Tabmix.rtl;
      }

      /** @this {This} */
      get isMultiRow() {
        return this.getAttribute("tabmix-flowing") === "multibar";
      }

      /** @this {This} */
      get scrollClientSize() {
        const scrollClientSize =
          this.scrollbox[this._verticalMode ? "clientHeightDouble" : "clientWidthDouble"];
        if (
          Tabmix.isVersion(1310) &&
          this.isMultiRow &&
          Tabmix.callerName().startsWith("MozArrowScrollbox/overflowObserver")
        ) {
          // MozArrowScrollbox/overflowObserver doesn't calculate overflowing based MultiRow
          // the value that we return from here force it get the right overflowing state
          const slot = this.shadowRoot.querySelector("slot");
          const contentSize = slot.getBoundingClientRect()[this._verticalMode ? "height" : "width"];
          const overflowing = contentSize - scrollClientSize > 0.02;
          return overflowing ? -Infinity : Infinity;
        }
        return scrollClientSize;
      }

      /** @this {This} */
      get scrollSize() {
        return this._verticalMode ?
          this.scrollbox.scrollHeight :
          this.scrollbox.scrollWidth;
      }

      /** @this {This} */
      get scrollPosition() {
        return this._verticalMode ?
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
        for (const tab of tabs) {
          const tabHeight = tab.getBoundingClientRect().height;
          if (tabHeight) {
            return tabHeight;
          }
        }

        return this.scrollbox.getBoundingClientRect().height;
      }

      /** @type {ASB["_ensureElementIsVisibleByIndex"]} */
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

      /** @type {ASB["_createScrollButtonContextMenu"]} */
      _createScrollButtonContextMenu(aEvent) {
        const side = aEvent.originalTarget.id === "scrollbutton-up" ? "left" : "right";
        TabmixAllTabs.createScrollButtonTabsList(aEvent, side);
      }

      /** @type {ASB["_distanceToRow"]} */
      _distanceToRow(amountToScroll) {
        if (!this.isMultiRow)
          return amountToScroll;
        const rowHeight = this.singleRowHeight;
        const position = this.scrollPosition;
        return Math.round((amountToScroll + position) / rowHeight) * rowHeight - position;
      }

      /** @type {ASB["_enterVerticalMode"]} */
      _enterVerticalMode() {
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
          Tabmix.setItem(tabBar, "tabmix-multibar", true);
          Tabmix.setItem("tabmix-bottom-toolbox", "tabmix-multibar", true);
          const multibar = Tabmix.tabsUtils.updateVerticalTabStrip();
          if (multibar === null) {
            TabmixTabbar._failedToEnterVerticalMode = true;
          }
          this.updateOverflow(Tabmix.tabsUtils.overflow);
        }
      }

      /** @type {ASB["setFirstTabInRow"]} */
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
        let index, current = 0, previousTab;
        for (const tab of tabs) {
          let row = tab.closing ? -1 : Tabmix.tabsUtils.getTabRowNumber(tab, topY);
          if (row > current) {
            const i = tabs.indexOf(tab);
            current = row;
            if (!tab.hasAttribute("tabmix-firstTabInRow")) {
              tab.setAttribute("tabmix-firstTabInRow", true);
            } else if (previousTab) {
              // remove the margin when the tab have place in the previous row
              const tabEnd = previousTab.getBoundingClientRect()[end] +
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
              index = i + 1;
              break;
            }
          } else if (tab.hasAttribute("tabmix-firstTabInRow")) {
            tab.removeAttribute("tabmix-firstTabInRow");
          }
          previousTab = tab;
        }
        for (const tab of tabs.slice(index)) {
          if (tab.hasAttribute("tabmix-firstTabInRow"))
            tab.removeAttribute("tabmix-firstTabInRow");
        }
        setTimeout(() => {
          // use timeout to make sure we run this after other listeners and observers
          // that may update the overflow state and/or scroll state
          if (
            Tabmix.tabsUtils.overflow &&
            this.hasAttribute("scrolledtostart") &&
            this.hasAttribute("scrolledtoend")
          ) {
            this.resetFirstTabInRow();
            Tabmix.tabsUtils.updateVerticalTabStrip({reset: true});
          }
        }, 50);
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
        for (const tab of Array.from(tabs)) {
          tab.removeAttribute("tabmix-firstTabInRow");
        }
        this.firstVisible = {tab: null, x: 0, y: 0};
      }

      /** @type {ASB["updateOverflow"]} */
      updateOverflow(overflow) {
        // we get here after we update overflow from updateVerticalTabStrip
        if (this.getAttribute("orient") === "vertical" ||
            this.hasAttribute("overflowing") === overflow) {
          return;
        }

        Tabmix.setItem(this, "overflowing", overflow || null);
        this._updateScrollButtonsDisabledState();
        if (Tabmix.isVersion(1310) && !overflow) {
          // we are here before tabmixOverflowObserver
          this.dispatchEvent(new CustomEvent("underflow"));
        }

        if (!overflow) {
          const childNodes = this._getScrollableElements();
          if (childNodes?.length && childNodes[0]) {
            this.ensureElementIsVisible(childNodes[0], true);
          }
        }
      }
    }

    // inject our code into arrowScrollbox
    const tabmixArrowScrollbox = Object.getOwnPropertyDescriptors(TabmixArrowScrollbox.prototype);
    // @ts-expect-error
    delete tabmixArrowScrollbox.constructor;
    const arrowScrollbox = gBrowser.tabContainer.arrowScrollbox;
    Object.defineProperties(arrowScrollbox, tabmixArrowScrollbox);
    arrowScrollbox.connectTabmix();
  },

  addScrollBoxButtons() {
    /** @typedef {TabmixArrowScrollboxNS.RightScrollBox} RSB */

    /** @type {RSB} */
    class TabmixRightScrollBox extends MozXULElement {
      static get inheritedAttributes() {
        return {
          "#scrollbutton-up": "orient,disabled=scrolledtostart",
          "#scrollbutton-down": "orient,disabled=scrolledtoend",
        };
      }

      /** @type {RSB["constructor"]} */
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

        const arrowScrollbox = gBrowser.tabContainer.arrowScrollbox;
        const hasAttribute = (/** @type {string} */ attr) => arrowScrollbox.hasAttribute(attr) || null;
        Tabmix.setItem(this, "scrolledtoend", hasAttribute("scrolledtoend"));
        Tabmix.setItem(this, "scrolledtostart", hasAttribute("scrolledtostart"));
        const scrollButtonsStateObserver = new MutationObserver(([entry = {}]) => {
          if (["scrolledtostart", "scrolledtoend"].includes(entry.attributeName ?? "")) {
            Tabmix.setItem(this, "scrolledtoend", hasAttribute("scrolledtoend"));
            Tabmix.setItem(this, "scrolledtostart", hasAttribute("scrolledtostart"));
          }
        });
        scrollButtonsStateObserver.observe(arrowScrollbox, {attributes: true});
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
        if (!this._fragment) {
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

      /** @type {RSB["finishScroll"]} */
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
