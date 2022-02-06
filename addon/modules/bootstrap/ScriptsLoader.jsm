/**
 * Load Tabmix scripts to navigator:browser window.
 */

"use strict";

this.EXPORTED_SYMBOLS = ["ScriptsLoader"];

const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {XPCOMUtils} = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
  //
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
});

const initialized = new WeakSet();

this.ScriptsLoader = {
  initForWindow(window, promiseOverlayLoaded) {
    if (initialized.has(window)) {
      return;
    }
    initialized.add(window);

    this._loadScripts(window, promiseOverlayLoaded);
    this._addListeners(window);
  },

  _loadScripts(window, promiseOverlayLoaded) {
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/broadcaster.js", window);
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/utils.js", window);

    window.Tabmix.promiseOverlayLoaded = promiseOverlayLoaded;
  },

  _addListeners(window) {
    const {Tabmix} = window;

    window.addEventListener(
      "MozAfterPaint",
      () => {
        Tabmix.isAfterMozAfterPaint = true;
      },
      {once: true}
    );

    window.addEventListener(
      "SSWindowRestored",
      () => {
        Tabmix.isAfterSSWindowRestored = true;
      },
      {once: true}
    );

    // before-initial-tab-adopted is fired before we are ready,
    // we have to make sure our initialization finshed before
    // Firefox call gBrowser.swapBrowsersAndCloseOther
    window.addEventListener(
      "before-initial-tab-adopted",
      () => {
        this._prepareBeforeOverlays(window);
      },
      {capture: true, once: true}
    );
  },

  /**
   * initialize functions that can be called by events that fired before
   * our overlay is ready.
   *
   * @param window
   */
  _prepareBeforeOverlays(window) {
    const {gBrowser, gBrowserInit, Tabmix} = window;

    Tabmix.singleWindowMode = Tabmix.prefs.getBoolPref("singleWindow");
    /**
     * @brief copy Tabmix data from old tab to new tab.
     *        we use it before swapBrowsersAndCloseOther
     */
    Tabmix.copyTabData = function TMP_copyTabData(newTab, oldTab) {
      /* prettier-ignore */
      const _xulAttributes = ["protected", "_locked", "fixed-label", "label-uri", "reload-data", "visited"];

      _xulAttributes.forEach(attr => {
        this.setItem(newTab, attr, oldTab.hasAttribute(attr) ? oldTab.getAttribute(attr) : null);
      });

      this.promiseOverlayLoaded.then(() => {
        this.restoreTabState(newTab);
        window.TMP_Places.asyncSetTabTitle(newTab);
      });
    };

    Tabmix.originalFunctions.swapBrowsersAndCloseOther = gBrowser.swapBrowsersAndCloseOther;
    const swapTab = function tabmix_swapBrowsersAndCloseOther(aOurTab, aOtherTab) {
      // Do not allow transferring a private tab to a non-private window
      // and vice versa.
      if (
        PrivateBrowsingUtils.isWindowPrivate(window) !==
        PrivateBrowsingUtils.isWindowPrivate(aOtherTab.ownerGlobal)
      ) {
        return false;
      }

      if (Tabmix.isAfterMozAfterPaint && !gBrowserInit.delayedStartupFinished) {
        // we probably will never get here in single window mode
        if (Tabmix.singleWindowMode) {
          return false;
        }
        Tabmix._afterTabduplicated = true;
        const url = aOtherTab.linkedBrowser.currentURI.spec;
        gBrowser.tabContainer._updateCloseButtons(true, url);
      }

      Tabmix.copyTabData(aOurTab, aOtherTab);
      return Tabmix.originalFunctions.swapBrowsersAndCloseOther.apply(this, arguments);
    };
    Tabmix.setNewFunction(gBrowser, "swapBrowsersAndCloseOther", swapTab);
  },
};
