/**
 * Load Tabmix scripts to navigator:browser window.
 */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  CustomizableUI: "resource:///modules/CustomizableUI.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
  isVersion: "chrome://tabmix-resource/content/BrowserVersion.sys.mjs",
  Overlays: "chrome://tabmix-resource/content/bootstrap/Overlays.sys.mjs",
});

/**
 * stylesheets and scripts for navigator:browser
 */
const CSS_URLS = [
  lazy.isVersion(1190) ?
    "chrome://tabmixplus/content/overlay/browser.css" :
    "chrome://tabmixplus/content/overlay/browser_before_119.css",
  lazy.isVersion(1260) ?
    "chrome://tabmixplus/skin/app_version/all/themeStyles.css" :
    "chrome://tabmixplus/skin/app_version/all/themeStyles_before_126.css",
  "chrome://tabmixplus/content/overlay/multirow.css",
  "chrome://tabmixplus/skin/general.css",
  "chrome://tabmixplus/skin/tab.css",
  "chrome://tabmix-os/skin/browser.css",
];

if (Services.appinfo.name == "Zen") {
  CSS_URLS.push("chrome://tabmixplus/content/overlay/zen_browser.css");
}

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
  "chrome://tabmixplus/content/session/sessionStore.js",
  "chrome://tabmixplus/content/extensions/extensions.js",
  "chrome://tabmixplus/content/tab/tabsBindings.js",
];

const initialized = new WeakSet();

export const ScriptsLoader = {
  initForWindow(window, promiseOverlayLoaded, params = {}) {
    if (initialized.has(window)) {
      return;
    }
    initialized.add(window);

    this._addCloseButton();
    this._loadCSS(window);
    this._loadScripts(window, promiseOverlayLoaded);
    this._addListeners(window);
    if (params.isEnabled) {
      this._updateAfterEnabled(window, params);
    }
  },

  _closeButtonAdded: false,
  _addCloseButton() {
    // since Firefox version 132, we need to allow tabmix-tabs-closebutton to move to nav-bar
    // when vertical tabs are enabled
    // we create it as widget and add it to the proper area TabsToolbar or nav-bar
    // we add it after alltabs-button by default but keep its position if user
    // move it in the toolbar
    if (!this._closeButtonAdded) {
      const allTabsButtonPlacement = lazy.CustomizableUI.getPlacementOfWidget("alltabs-button");
      const closeButtonPlacement = lazy.CustomizableUI.getPlacementOfWidget("tabmix-tabs-closebutton");
      if (!closeButtonPlacement || closeButtonPlacement.area !== allTabsButtonPlacement?.area) {
        const {area, position} = allTabsButtonPlacement ?? {area: lazy.CustomizableUI.AREA_TABSTRIP};
        const finalPosition = typeof position === "number" ? position + 1 : undefined;
        lazy.CustomizableUI.addWidgetToArea("tabmix-tabs-closebutton", area, finalPosition);
      }
    }
    this._closeButtonAdded = true;
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

    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/click/listeners.js", window);
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
        const value = oldTab.hasAttribute(attr) ? oldTab.getAttribute(attr) : null;
        if (value) {
          lazy.SessionStore.setCustomTabValue(newTab, attr, value);
        }
        this.setItem(newTab, attr, value);
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
