"use strict";

(function () {
  Tabmix.setNewFunction(
    document.getElementById("tabbrowser-tabs"),
    "_notifyBackgroundTab",

    /**
     * @param {Tab} aTab
     * @this {typeof gBrowser.tabContainer}
     */
    function _notifyBackgroundTab(aTab) {
      if (
        TabmixSvc.isZen ?
          aTab.hasAttribute("zen-essential")
        : aTab.pinned || aTab.hidden || !this.hasAttribute("overflow")
      ) {
        return;
      }

      this._lastTabToScrollIntoView = aTab;
      if (!this._backgroundTabScrollPromise) {
        this._backgroundTabScrollPromise = window
          .promiseDocumentFlushed(() => {
            // @ts-expect-error
            let lastTabRect = this._lastTabToScrollIntoView.getBoundingClientRect();
            let selectedTab = this.selectedItem ?? gBrowser.selectedTab;
            let tabRect;
            if (selectedTab.pinned) {
              tabRect = null;
            } else {
              tabRect = selectedTab.getBoundingClientRect();
              tabRect = {
                left: tabRect.left,
                right: tabRect.right,
                top: tabRect.top,
                bottom: tabRect.bottom,
              };
            }
            return [
              this._lastTabToScrollIntoView,
              this.arrowScrollbox.scrollClientRect,
              {
                left: lastTabRect.left,
                right: lastTabRect.right,
                top: lastTabRect.top,
                bottom: lastTabRect.bottom,
              },
              tabRect,
            ];
          })
          .then(([tabToScrollIntoView, scrollRect, tabRect, selectedRect]) => {
            // First off, remove the promise so we can re-enter if necessary.
            delete this._backgroundTabScrollPromise;
            // Then, if the layout info isn't for the last-scrolled-to-tab, re-run
            // the code above to get layout info for *that* tab, and don't do
            // anything here, as we really just want to run this for the last-opened tab.
            if (this._lastTabToScrollIntoView) {
              if (this._lastTabToScrollIntoView != tabToScrollIntoView) {
                this._notifyBackgroundTab(this._lastTabToScrollIntoView);
                return;
              }
              delete this._lastTabToScrollIntoView;
            }
            // Is the new tab already completely visible?
            if (Tabmix.tabsUtils.isElementVisible(tabToScrollIntoView)) {
              return;
            }

            if (this.arrowScrollbox.smoothScroll) {
              // Can we make both the new tab and the selected tab completely visible?
              if (
                !selectedRect ||
                (!TabmixTabbar.isMultiRow &&
                  Math.max(tabRect.right - selectedRect.left, selectedRect.right - tabRect.left) <=
                    scrollRect.width) ||
                (TabmixTabbar.isMultiRow &&
                  Math.max(tabRect.bottom - selectedRect.top, selectedRect.bottom - tabRect.top) <=
                    scrollRect.height)
              ) {
                this.arrowScrollbox.ensureElementIsVisible(tabToScrollIntoView);
                return;
              }

              if (TabmixTabbar.isMultiRow) {
                this.arrowScrollbox.scrollByPixels(selectedRect.top - scrollRect.top);
              } else {
                this.arrowScrollbox.scrollByPixels(
                  RTL_UI ?
                    selectedRect.right - scrollRect.right
                  : selectedRect.left - scrollRect.left
                );
              }
            }

            if (!this._animateElement.hasAttribute("highlight")) {
              this._animateElement.setAttribute("highlight", "true");
              setTimeout(
                ele => {
                  ele.removeAttribute("highlight");
                },
                150,
                this._animateElement
              );
            }
          });
      }
    }
  );
})();
