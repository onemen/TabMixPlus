/**
 * Load Tabmix scripts to navigator:browser window.
 */

"use strict";

const EXPORTED_SYMBOLS = ["ScriptsLoader"];

const Services = globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
const {TabmixChromeUtils} = ChromeUtils.import("chrome://tabmix-resource/content/ChromeUtils.jsm");

const lazy = {};

TabmixChromeUtils.defineLazyModuleGetters(lazy, {
  Overlays: "chrome://tabmix-resource/content/bootstrap/Overlays.jsm",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
  SessionStore: "resource:///modules/sessionstore/SessionStore.jsm",
});

const isVersion119 = Services.vc.compare(Services.appinfo.version, "119.0a1");

/**
 * stylesheets and scripts for navigator:browser
 */
const CSS_URLS = [
  isVersion119 ? "chrome://tabmixplus/content/overlay/browser.css" : "chrome://tabmixplus/content/overlay/browser_before_119.css",
  "chrome://tabmixplus/content/overlay/multirow.css",
  "chrome://tabmixplus/skin/tab.css",
  "chrome://tabmix-os/skin/browser.css",
];

const SCRIPTS = [
  "chrome://tabmixplus/content/broadcaster.js",
  "chrome://tabmixplus/content/utils.js",
  "chrome://tabmixplus/content/tab/scrollbox.js",
  "chrome://tabmixplus/content/tab/tabBindings.js",
  "chrome://tabmixplus/content/tabmix.js",
  "chrome://tabmixplus/content/minit/tablib.js",
  "chrome://tabmixplus/content/minit/minit.js",
  "chrome://tabmixplus/content/links/contentLinks.js",
  "chrome://tabmixplus/content/links/userInterface.js",
  "chrome://tabmixplus/content/links/setup.js",
  "chrome://tabmixplus/content/tab/tab.js",
  "chrome://tabmixplus/content/flst/lasttab.js",
  "chrome://tabmixplus/content/click/click.js",
  "chrome://tabmixplus/content/places/places.js",
  "chrome://tabmixplus/content/session/session.js",
  "chrome://tabmixplus/content/session/sessionStore.js",
  "chrome://tabmixplus/content/extensions/extensions.js",
  "chrome://tabmixplus/content/tab/tabsBindings.js",
];

const initialized = new WeakSet();

const ScriptsLoader = {
  initForWindow(window, promiseOverlayLoaded, params = {}) {
    if (initialized.has(window)) {
      return;
    }
    initialized.add(window);

    this._loadCSS(window);
    this._loadScripts(window, promiseOverlayLoaded);
    this._addListeners(window);
    if (params.isEnabled) {
      this._updateAfterEnabled(window, params);
    }
  },

  _loadCSS(window) {
    const winUtils = window.windowUtils;
    for (const url of CSS_URLS) {
      winUtils.loadSheetUsingURIString(url, winUtils.AUTHOR_SHEET);
    }
  },

  _loadScripts(window, promiseOverlayLoaded) {
    for (const url of SCRIPTS) {
      Services.scriptloader.loadSubScript(url, window);
    }

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
    // we have to make sure our initialization finished before
    // Firefox call gBrowser.swapBrowsersAndCloseOther
    ["load", "before-initial-tab-adopted"].forEach(event => {
      window.addEventListener(
        event,
        () => {
          this._prepareBeforeOverlays(window);
        },
        {capture: true, once: true}
      );
    });
  },

  /**
   * initialize functions that can be called by events that fired before
   * our overlay is ready.
   *
   * @param window
   */
  _prepareBeforeOverlays(window) {
    const {gBrowser, gBrowserInit, Tabmix} = window;

    if (Tabmix.copyTabData) {
      return;
    }

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
    const swapTab = function tabmix_swapBrowsersAndCloseOther(ourTab, otherTab) {
      // Do not allow transferring a private tab to a non-private window
      // and vice versa.
      if (
        lazy.PrivateBrowsingUtils.isWindowPrivate(window) !==
        lazy.PrivateBrowsingUtils.isWindowPrivate(otherTab.ownerGlobal)
      ) {
        return false;
      }

      if (Tabmix.isAfterMozAfterPaint && !gBrowserInit.delayedStartupFinished) {
        // we probably will never get here in single window mode
        if (Tabmix.singleWindowMode) {
          return false;
        }
        Tabmix._afterTabduplicated = true;
        const url = otherTab.linkedBrowser.currentURI.spec;
        gBrowser.tabContainer._updateCloseButtons(true, url);
      }

      Tabmix.copyTabData(ourTab, otherTab);
      return Tabmix.originalFunctions.swapBrowsersAndCloseOther.apply(this, arguments);
    };
    Tabmix.setNewFunction(gBrowser, "swapBrowsersAndCloseOther", swapTab);
  },

  async _updateAfterEnabled(window, {chromeManifest, isOverflow}) {
    await window.delayedStartupPromise;

    const {gBrowser, Tabmix, TMP_Places} = window;

    gBrowser.tabs.forEach(tab => {
      const browser = tab.linkedBrowser;
      if (browser.currentURI.spec == "about:addons" && browser.contentWindow) {
        lazy.Overlays.load(chromeManifest, browser.contentWindow);
      }
    });

    await Tabmix._deferredInitialized.promise;

    // verify our scroll buttons are visible on overflow
    if (isOverflow) {
      Tabmix.tabsUtils.updateVerticalTabStrip();
    }

    // update tabs title
    gBrowser.tabs.forEach(tab => {
      const url = lazy.SessionStore.getLazyTabValue(tab, "url") || tab.linkedBrowser.currentURI.spec;
      TMP_Places.asyncSetTabTitle(tab, url);
    });
  },
};
