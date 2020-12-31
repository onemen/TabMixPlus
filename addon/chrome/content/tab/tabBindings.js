"use strict";

{
// Tabmix.changeCode(customElements.get("tabbrowser-tab"), "markup", {getter: true})._replace(
//             '<image class=\"tab-icon-image\" validate=\"never\" role=\"presentation\"/>',
//             '$&' + '\n    ' +
//             `<image class=\"tab-protect-icon\" />
//             <image class=\"tab-lock-icon\" />
//             <image class=\"tab-reload-icon\" />`
//           ).defineProperty();

// delete customElements.get("tabbrowser-tab")._fragment;

var tabbrowsertab = customElements.get("tabbrowser-tab");

tabbrowsertab._fragment = MozXULElement.parseXULToFragment(
  `
<hbox class="tab-image-left tab-startcap tab-left tab-left-border"/>
<hbox class="tab-drag-indicator-left"/>
<stack class="tab-stack" flex="1">
  <vbox class="tab-background">
    <hbox class="tab-line"/>
    <spacer flex="1" class="tab-background-inner"/>
    <hbox class="tab-bottom-line"/>
  </vbox>
  <vbox class="tab-progress-container">
    <progress class="tab-progress" max="100" mode="normal"/>
  </vbox>
  <hbox class="tab-loading-burst"/>
  <hbox class="tab-content" align="center">
  <stack class="tab-icon">
    <hbox class="tab-throbber" layer="true"/>
    <hbox class="tab-icon-pending"/>
    <image class="tab-icon-image" validate="never" role="presentation"/>
    <image class="tab-protect-icon"/>
    <image class="tab-lock-icon"/>
    <image class="tab-reload-icon"/>
  </stack>
    <image class="tab-sharing-icon-overlay" role="presentation"/>
    <image class="tab-icon-overlay" role="presentation"/>
    <hbox class="tab-label-container"
          onoverflow="this.setAttribute('textoverflow', 'true');"
          onunderflow="this.removeAttribute('textoverflow');"
          flex="1">
      <label class="tab-text tab-label" tabmix="true" role="presentation"/>
    </hbox>
    <image class="tab-icon-sound" role="presentation"/>
    <image class="tab-close-button close-icon" role="presentation"/>
  </hbox>
</stack>
<hbox class="tab-drag-indicator-right"/>
<hbox class="tab-image-right tab-endcap tab-right tab-right-border"/>
  `,
  tabbrowsertab.entities
);

Tabmix.changeCode(tabbrowsertab, "inheritedAttributes", { getter: true })._replace(
  '};',
  '\n    ' +
  `
  ".tab-image-left":"selected=visuallyselected,hover",
  ".tab-progress":"value=tab-progress,fadein,pinned,selected=visuallyselected",
  ".tab-icon":"fadein,pinned,selected=visuallyselected",
  ".tab-image-right":"selected=visuallyselected,hover",
  `
  +
  '$&'
).defineProperty();

delete tabbrowsertab._flippedInheritedAttributes;

Tabmix.changeCode(tabbrowsertab.prototype, "connectedCallback")._replace(
  'this.initialize();',
  '$&' +
  '\n    ' +
  `
  if ('tabmix_inited' in this) {
    return;
  }

  this.mIsHover = false;

  this.mButtonId = 0;

  this.mFocusId = 0;

  this.mSelect = 0;

  this.tabmix_mouseover = 0;

  if (!Tabmix.isVersion(420)) {
    let context = document.getElementById('context_closeTab');
    this.setAttribute('closetabtext', context.getAttribute('label'));
  }

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
    if (this.mOverCloseButton || this._overPlayingIcon) {
      event.stopPropagation();
    } else if (this.mouseDownSelect) {
      this.onMouseCommand(event);
    } else {
      event.stopPropagation();
    }
  }, true);

  this.tabmix_inited = true;
  `
).toCode();

Object.defineProperties(tabbrowsertab, {
  '_isProtected': {
    get() {
      return this.hasAttribute("protected") || this.pinned ||
        ("permaTabs" in window && this.hasAttribute("isPermaTab"));
    }
  },
  'mouseHoverSelect': {
    get() {
      try {
        return Tabmix.prefs.getBoolPref("mouseOverSelect");
      } catch (e) {
        return false;
      }
    }
  },
  'mouseDownSelect': {
    get() {
      try {
        return Tabmix.prefs.getBoolPref("selectTabOnMouseDown");
      } catch (e) {
        return false;
      }
    }
  },
  'mouseHoverSelectDelay': {
    get() {
      try {
        return Tabmix.prefs.getIntPref("mouseOverSelectDelay");
      } catch (e) {
        return 250;
      }
    }
  },
  'tabXDelay': {
    get() {
      try {
        return Tabmix.prefs.getIntPref("tabs.closeButtons.delay");
      } catch (e) {
        return 0;
      }
    }
  },
  'baseY': {
    get() {
      return this.boxObject.y + this.boxObject.height;
    }
  }
})

Tabmix.setNewFunction(tabbrowsertab, "onMouseOver", function onMouseOver(aEvent) {
  this.setHoverState(aEvent, true);
  this.mButtonId = window.setTimeout(this.setShowButton, this.tabXDelay, this);
  if (this.mouseHoverSelect)
    this.mFocusId = window.setTimeout(this.doMouseHoverSelect, this.mouseHoverSelectDelay, this);

  if (TabmixSvc.australis) {
    this.tabmix_mouseover = window.setTimeout(() => {
      clearTimeout(this.tabmix_mouseover);
      TabmixTabbar.updateBeforeAndAfter(true);
    }, 0);
  }
});

Tabmix.setNewFunction(tabbrowsertab, "doMouseHoverSelect", function doMouseHoverSelect(aTab) {
  if (!aTab || !aTab.parentNode)
    return; // this tab already removed....

  var b = aTab.parentNode.tabbrowser;
  if (b.hasAttribute("preventMouseHoverSelect"))
    b.removeAttribute("preventMouseHoverSelect");
  else if (aTab.mIsHover)
    aTab.parentNode.selectedItem = aTab;
});

Tabmix.setNewFunction(tabbrowsertab, "setShowButton", function setShowButton(aTab) {
  if (!aTab || !aTab.parentNode)
    return; // this tab already removed....

  var pref = Tabmix.prefs.getIntPref("tabs.closeButtons");
  if (pref != 2 && pref != 4)
    return;

  if (aTab.mIsHover && aTab.getAttribute("showbutton") != "on" &&
    !aTab.hasAttribute("dragged")) {
    if (TabmixTabbar.widthFitTitle)
      aTab.style.setProperty("width", Tabmix.getBoundsWithoutFlushing(aTab).width + "px", "important");
    aTab.setAttribute("showbutton", "on");
    aTab.parentNode.__showbuttonTab = aTab;
  }
});

Tabmix.setNewFunction(tabbrowsertab, "onMouseOut", function onMouseOut(aEvent) {
  this.setHoverState(aEvent, false);
  clearTimeout(this.mButtonId);
  this.mButtonId = window.setTimeout(this.removeShowButton, this.tabXDelay, this);
  if (this.mouseHoverSelect && this.mFocusId)
    clearTimeout(this.mFocusId);

  if (TabmixSvc.australis) {
    clearTimeout(this.tabmix_mouseover);
    let positionalTabs = Tabmix.tabsUtils._tabmixPositionalTabs;
    if (positionalTabs.beforeHoveredTab) {
      positionalTabs.beforeHoveredTab.removeAttribute("tabmix-removed-beforehovered");
      positionalTabs.beforeHoveredTab = null;
    }
    if (positionalTabs.afterHoveredTab) {
      positionalTabs.afterHoveredTab.removeAttribute("tabmix-removed-afterhovered");
      positionalTabs.afterHoveredTab = null;
    }
  }
});

Tabmix.setNewFunction(tabbrowsertab, "setHoverState", function setHoverState(aEvent, aOver) {
  var anonid = aEvent.originalTarget &&
    typeof aEvent.originalTarget.getAttribute == "function" &&
    aEvent.originalTarget.getAttribute("anonid");
  if (anonid == "tmp-close-button") {
    this.mOverCloseButton = aOver;
  }
  this.mIsHover = aOver;
});

Tabmix.setNewFunction(tabbrowsertab, "removeShowButton", function removeShowButton(aTab) {
  if (!aTab || !aTab.parentNode)
    return; // this tab already removed....

  if (!aTab.mIsHover && aTab.hasAttribute("showbutton")) {
    aTab.removeAttribute("showbutton");
    aTab.style.removeProperty("width");
    // we use this in Linux to prevent underflow that triggered by hiding
    // the close button
    aTab.setAttribute("showbutton_removed", true);
    setTimeout(tab => tab.removeAttribute("showbutton_removed"), 50, aTab);
    if (aTab == aTab.parentNode.__showbuttonTab)
      delete aTab.parentNode.__showbuttonTab;
  }
});

Tabmix.setNewFunction(tabbrowsertab, "onMouseCommand", function onMouseCommand(aEvent, aSelectNewTab) {
  var isSelected = this == this.parentNode.selectedItem;
  Tabmix.setItem(this, "clickOnCurrent",
    isSelected && aEvent.detail == 1 || null);
  if (isSelected)
    return;

  // don't allow mouse click/down with modifiers to select tab
  if (aEvent.shiftKey || aEvent.ctrlKey || aEvent.altKey || aEvent.metaKey)
    aEvent.stopPropagation();
  else if (aSelectNewTab) {
    this.parentNode._selectNewTab(this);
    let isTabFocused = false;
    try {
      isTabFocused = (document.commandDispatcher.focusedElement == this);
    } catch (e) { }
    if (!isTabFocused) {
      this.setAttribute("ignorefocus", "true");
      this.mSelect = setTimeout(() => this.removeAttribute("ignorefocus"), 0);
    }
  }
  // on mousedown event fall through to default mousedown from tabbox.xml
});

Tabmix.setNewFunction(tabbrowsertab, "clearTimeouts", function clearTimeouts() {
  var timeouts = ["mSelect", "mFocusId", "mButtonId", "autoReloadTimerID", "tabmix_mouseover"];
  timeouts.forEach(function (aTimeout) {
    if (aTimeout in this && this[aTimeout]) {
      clearTimeout(this[aTimeout]);
      this[aTimeout] = null;
    }
  }, this);
});

gBrowser.tabs.forEach(t => { t._initialized = false; t.connectedCallback(); })

Tabmix.initialization.init.initialized = false;
Tabmix.initialization.run("init", gBrowser.tabContainer);

Tabmix.setNewFunction(gBrowser.tabContainer, "_notifyBackgroundTab", function _notifyBackgroundTab(aTab) {
  if (aTab.pinned || aTab.hidden) {
    return;
  }
  // Is the new tab already completely visible?
  if (Tabmix.tabsUtils.isElementVisible(aTab))
    return;

  var scrollRect = this.arrowScrollbox.scrollClientRect;
  var tab = aTab.getBoundingClientRect();
  if (!Tabmix.isVersion(570)) {
    this.arrowScrollbox._calcTabMargins(aTab);
  }

  // DOMRect left/right properties are immutable.
  tab = { left: tab.left, right: tab.right, top: tab.top, bottom: tab.bottom };

  if (this.arrowScrollbox.smoothScroll) {
    let selected = !this.selectedItem.pinned &&
      this.selectedItem.getBoundingClientRect();

    if (!Tabmix.isVersion(570) && Tabmix.isVersion(310) && !TabmixTabbar.isMultiRow) {
      if (selected) {
        selected = { left: selected.left, right: selected.right };
        // Need to take in to account the width of the left/right margins on tabs.
        selected.left += this.arrowScrollbox._tabMarginLeft;
        selected.right -= this.arrowScrollbox._tabMarginRight;
      }

      tab.left += this.arrowScrollbox._tabMarginLeft;
      tab.right -= this.arrowScrollbox._tabMarginRight;
    }

    // Can we make both the new tab and the selected tab completely visible?
    if (!selected ||
      !TabmixTabbar.isMultiRow && Math.max(tab.right - selected.left, selected.right - tab.left) <= scrollRect.width ||
      TabmixTabbar.isMultiRow && Math.max(tab.bottom - selected.top, selected.bottom - tab.top) <= scrollRect.height) {
      if (Tabmix.tabsUtils.overflow)
        this.arrowScrollbox.ensureElementIsVisible(aTab);
      return;
    }

    const scrollByPixels = Tabmix.isVersion(570) ? "scrollByPixels" : "_smoothScrollByPixels";
    if (TabmixTabbar.isMultiRow)
      this.arrowScrollbox[scrollByPixels](selected.top - scrollRect.top);
    else
      this.arrowScrollbox[scrollByPixels](this.arrowScrollbox._isRTLScrollbox ?
        selected.right - scrollRect.right : selected.left - scrollRect.left);
  }

  if (Tabmix.isVersion(540)) {
    if (!this._animateElement.hasAttribute("highlight")) {
      this._animateElement.setAttribute("highlight", "true");
      setTimeout(ele => {
        ele.removeAttribute("highlight");
      }, 150, this._animateElement);
    }
  } else if (!this._animateElement.hasAttribute("notifybgtab")) {
    this._animateElement.setAttribute("notifybgtab", "true");
    setTimeout(ele => {
      ele.removeAttribute("notifybgtab");
    }, 150, this._animateElement);
  }
});

}
