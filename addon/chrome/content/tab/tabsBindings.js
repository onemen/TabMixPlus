"use strict";

(function() {
  // with bootstrap.js we get here after DOMContentLoaded was fired
  // we can call our initializer with 'onContentLoaded' flag
  Tabmix.initialization.init.initialized = false;
  Tabmix.initialization.run("onContentLoaded", gBrowser.tabContainer);

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
    tab = {left: tab.left, right: tab.right, top: tab.top, bottom: tab.bottom};

    if (this.arrowScrollbox.smoothScroll) {
      let selected = !this.selectedItem.pinned &&
        this.selectedItem.getBoundingClientRect();

      if (!Tabmix.isVersion(570) && Tabmix.isVersion(310) && !TabmixTabbar.isMultiRow) {
        if (selected) {
          selected = {left: selected.left, right: selected.right};
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
}());
