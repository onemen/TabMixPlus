"use strict";

(function tabBindings() {
  let tabbrowsertab = customElements.get("tabbrowser-tab");

  if (!tabbrowsertab) {
    console.error("Tabmix: tabbrowser-tab not found in tabBindings.js");
    return;
  }

  let markup = tabbrowsertab.markup
    .replace(
      "</vbox>",
      `$&
        <vbox class="tab-progress-container">
          <html:progress class="tab-progress" max="100" mode="normal"/>
        </vbox>`
    )
    .replace(
      /<.*class="tab-icon-image".*\/>/,
      `$&
            <image class="tab-protect-icon"/>
            <image class="tab-lock-icon"/>
            <image class="tab-reload-icon"/>`
    )
    .replace("tab-icon-stack", "tab-icon tab-icon-stack");

  tabbrowsertab._fragment = MozXULElement.parseXULToFragment(markup);

  Tabmix.changeCode(tabbrowsertab, "inheritedAttributes", {get: true})
    ._replace(
      "};",
      `  ".tab-progress":
          "value=tab-progress,fadein,pinned,selected=visuallyselected",
        ".tab-icon": "fadein,pinned,selected=visuallyselected"
      $&`
    )
    .defineProperty();

  (Tabmix.isVersion(1430) ? ["on_mouseover"] : ["on_mouseover", "on_mouseout"]).forEach(
    methodName => {
      Tabmix.changeCode(tabbrowsertab.prototype, methodName)
        ._replace("event.target.classList", "event.target?.classList?")
        .toCode();
    }
  );

  delete tabbrowsertab._flippedInheritedAttributes;

  Tabmix.changeCode(tabbrowsertab.prototype, "initialize")
    ._replace(
      /(})(\)?)$/,
      `
      if ('tabmix_inited' in this) {
        return;
      }

      this.tabmixKey = new (Cu.getGlobalForObject(Services).Object)();

      this.mIsHover = false;

      this.mButtonId = 0;

      this.mFocusId = 0;

      this.mSelect = 0;

      this.constructor.tabmix_init.call(this);

      this.addEventListener("mouseover", (event) => {
        this.onMouseOver(event);
      });

      this.addEventListener("mouseout", (event) => {
        this.onMouseOut(event);
      });

      this.addEventListener("mousedown", (event) => {
        if (event.button != 0) {
          return;
        }

        if (this.selected) {
          this.style.MozUserFocus = 'ignore';
          void this.clientTop; // just using this to flush style updates
        }
        // prevent chrome://global/content/bindings/tabbox.xml#tab mousedown handler
        if (event.target?.classList?.contains("tab-close-button") || TabmixTabClickOptions.isOverlayIcons(event)) {
          event.stopPropagation();
        } else if (this.mouseDownSelect) {
          this.onMouseCommand(event);
        } else {
          event.stopPropagation();
        }
      }, true);

      const callback = aMutations => {
        for (let mutation of aMutations) {
            this.attributeChangedCallback(mutation.attributeName, mutation.oldValue, mutation.target.getAttribute(mutation.attributeName));
        }
      };
      const observer = new MutationObserver(callback);
      observer.observe(this, {
        attributeFilter: [ "tab-progress", "hover" ],
        attributeOldValue: true
      });

      this.tabmix_inited = true;
  $1$2`
    )
    .toCode();

  Tabmix.setNewFunction(tabbrowsertab, "tabmix_init", function tabmix_init() {
    Object.defineProperties(this, {
      _isProtected: {
        get() {
          return (
            this.hasAttribute("protected") ||
            this.pinned ||
            ("permaTabs" in window && this.hasAttribute("isPermaTab"))
          );
        },
      },
      mouseHoverSelect: {
        get() {
          try {
            return Tabmix.prefs.getBoolPref("mouseOverSelect");
          } catch {
            return false;
          }
        },
      },
      mouseDownSelect: {
        get() {
          try {
            return Tabmix.prefs.getBoolPref("selectTabOnMouseDown");
          } catch {
            return false;
          }
        },
      },
      mouseHoverSelectDelay: {
        get() {
          try {
            return Tabmix.prefs.getIntPref("mouseOverSelectDelay");
          } catch {
            return 250;
          }
        },
      },
      tabXDelay: {
        get() {
          try {
            return Tabmix.prefs.getIntPref("tabs.closeButtons.delay");
          } catch {
            return 0;
          }
        },
      },
      baseY: {
        get() {
          const {height, y} = this.getBoundingClientRect();
          return height + y;
        },
      },
      _restoreState: {
        get() {
          if (this.hasAttribute("pending") || this.hasAttribute("tabmix_pending")) {
            return TabmixSvc.sm.TAB_STATE_NEEDS_RESTORE;
          }
          return SessionStore.getInternalObjectState(this.linkedBrowser);
        },
      },
    });

    /**
     * @param {MouseEvent} aEvent
     * @this {Tab}
     */
    this.onMouseOver = function (aEvent) {
      this.setHoverState(aEvent, true);
      this.mButtonId = window.setTimeout(this.setShowButton, this.tabXDelay, this);
      if (this.mouseHoverSelect) {
        this.mFocusId = window.setTimeout(
          this.doMouseHoverSelect,
          this.mouseHoverSelectDelay,
          this
        );
      }
    };

    /** @param {Tab} aTab */
    this.doMouseHoverSelect = function (aTab) {
      if (!aTab || !aTab.parentNode) {
        return; // this tab already removed....
      }

      if (gBrowser.tabContainer.hasAttribute("preventMouseHoverSelect")) {
        gBrowser.tabContainer.removeAttribute("preventMouseHoverSelect");
      } else if (aTab.mIsHover) {
        gBrowser.selectedTab = aTab;
      }
    };

    /** @param {Tab} aTab */
    this.setShowButton = function (aTab) {
      if (!aTab || !aTab.parentNode) {
        return;
      }
      // this tab already removed....

      var pref = Tabmix.prefs.getIntPref("tabs.closeButtons");
      if (pref != 2 && pref != 4) {
        return;
      }

      if (
        aTab.mIsHover &&
        aTab.getAttribute("showbutton") != "on" &&
        !aTab.hasAttribute("tabmix-dragged")
      ) {
        if (TabmixTabbar.widthFitTitle) {
          aTab.style.setProperty(
            "width",
            Tabmix.getBoundsWithoutFlushing(aTab).width + "px",
            "important"
          );
        }

        aTab.setAttribute("showbutton", "on");
        aTab.container.__showbuttonTab = aTab;
      }
    };

    /**
     * @param {MouseEvent} aEvent
     * @this {Tab}
     */
    this.onMouseOut = function (aEvent) {
      this.setHoverState(aEvent, false);
      if (this.mButtonId) {
        clearTimeout(this.mButtonId);
      }
      this.mButtonId = window.setTimeout(this.removeShowButton, this.tabXDelay, this);
      if (this.mouseHoverSelect && this.mFocusId) {
        clearTimeout(this.mFocusId);
      }
    };

    /**
     * @param {MouseEvent} aEvent
     * @param {boolean} aOver
     * @this {Tab}
     */
    this.setHoverState = function (aEvent, aOver) {
      if (aEvent.target?.classList?.contains("tab-close-button")) {
        this.mOverCloseButton = aOver;
      }
      this.mIsHover = aOver;
    };

    /** @param {Tab} aTab */
    this.removeShowButton = function (aTab) {
      if (!aTab || !aTab.parentNode) {
        return;
      }
      // this tab already removed....

      if (!aTab.mIsHover && aTab.hasAttribute("showbutton")) {
        aTab.removeAttribute("showbutton");
        aTab.style.removeProperty("width");
        // we use this in Linux to prevent underflow that triggered by hiding
        // the close button
        aTab.setAttribute("showbutton_removed", true);
        setTimeout(tab => tab.removeAttribute("showbutton_removed"), 50, aTab);
        if (aTab == aTab.container.__showbuttonTab) {
          delete aTab.container.__showbuttonTab;
        }
      }
    };

    /**
     * @param {MouseEvent} aEvent
     * @param {boolean} aSelectNewTab
     * @this {Tab}
     */
    this.onMouseCommand = function (aEvent, aSelectNewTab) {
      var isSelected = this == this.container.selectedItem;
      Tabmix.setItem(this, "clickOnCurrent", (isSelected && aEvent.detail === 1) || null);
      if (isSelected) {
        return;
      }

      // don't allow mouse click/down with modifiers to select tab
      if (TabmixTabClickOptions.blockMouseDown(aEvent)) {
        aEvent.stopPropagation();
      } else if (aSelectNewTab) {
        this.container._selectNewTab(this);
        let isTabFocused = false;
        try {
          isTabFocused = document.commandDispatcher.focusedElement == this;
        } catch {}
        if (!isTabFocused) {
          this.setAttribute("ignorefocus", "true");
          this.mSelect = setTimeout(() => this.removeAttribute("ignorefocus"), 0);
        }
      }
      // on mousedown event fall through to default mousedown from tabbox.xml
    };

    const TimeoutIds = {
      mSelect: "",
      mFocusId: "",
      mButtonId: "",
      autoReloadTimerID: "",
    };

    /** @type {(keyof typeof TimeoutIds)[]} */ // @ts-expect-error
    const timeouts = Object.values(TimeoutIds);

    /** @this {Tab} */
    this.clearTimeouts = function () {
      timeouts.forEach(aTimeout => {
        if (aTimeout in this && this[aTimeout]) {
          clearTimeout(this[aTimeout]);
          this[aTimeout] = null;
        }
      });
    };
  });

  function connectTabs() {
    gBrowser.tabs.forEach(t => {
      if (t?.tabmix_inited !== true) {
        t._initialized = false;
        t.connectedCallback();
      }
    });
  }

  if (document.readyState === "complete") {
    connectTabs();
  } else {
    window.addEventListener("load", () => connectTabs(), {once: true});
  }
})();
