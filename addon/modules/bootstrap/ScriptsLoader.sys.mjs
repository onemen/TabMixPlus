/** Load Tabmix scripts to navigator:browser window. */
import {isVersion} from "chrome://tabmix-resource/content/BrowserVersion.sys.mjs";

/** @type {ScriptsLoaderModule.Lazy} */ // @ts-ignore
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  CustomizableUI:
    isVersion(1430) ?
      "moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs"
    : "resource:///modules/CustomizableUI.sys.mjs",
  DynamicRules: "chrome://tabmix-resource/content/DynamicRules.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
  SessionStore: "resource:///modules/sessionstore/SessionStore.sys.mjs",
  Overlays: "chrome://tabmix-resource/content/bootstrap/Overlays.sys.mjs",
});

const isZen = Services.appinfo.name == "Zen";

/** stylesheets and scripts for navigator:browser */
const CSS_URLS = [
  "chrome://tabmixplus/content/overlay/browser.css",
  "chrome://tabmixplus/skin/app_version/all/themeStyles.css",
  "chrome://tabmixplus/content/overlay/multirow.css",
  "chrome://tabmixplus/skin/general.css",
  "chrome://tabmixplus/skin/tab.css",
  isVersion(1430) ?
    "chrome://tabmixplus/skin/menuitem-icons.css"
  : "chrome://tabmixplus/skin/menuitem-icons-before-143.css",
  "chrome://tabmix-os/skin/browser.css",
];

if (isZen) {
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

/** @type {ScriptsLoaderModule.ScriptsLoader} */
export const ScriptsLoader = {
  initForWindow(window, promiseOverlayLoaded, params) {
    if (initialized.has(window)) {
      return;
    }
    initialized.add(window);

    this._addCloseButton();
    this._loadCSS(window);
    this._loadScripts(window, promiseOverlayLoaded);
    this._initTabsStyle(window);
    this._addListeners(window);
    if (params?.isEnabled && params.chromeManifest) {
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
      const closeButtonPlacement =
        lazy.CustomizableUI.getPlacementOfWidget("tabmix-tabs-closebutton");
      if (!closeButtonPlacement || closeButtonPlacement.area !== allTabsButtonPlacement?.area) {
        const {area, position} = allTabsButtonPlacement ?? {
          area: lazy.CustomizableUI.AREA_TABSTRIP,
        };
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

    // we need to add our keys before browser.xhtml loads our overlay,
    // and look for our Shortcuts
    const {Shortcuts} = ChromeUtils.importESModule(
      "chrome://tabmix-resource/content/Shortcuts.sys.mjs"
    );
    Shortcuts.onWindowOpen(window);
  },

  _initTabsStyle(window) {
    const {document, Tabmix, TabmixTabbar} = window;

    const tabContainer = document.getElementById("tabbrowser-tabs");

    // set widthFitTitle
    let max = Math.max(16, Services.prefs.getIntPref("browser.tabs.tabMaxWidth"));
    let min = Math.max(16, Services.prefs.getIntPref("browser.tabs.tabMinWidth"));
    if (max < min) {
      Services.prefs.setIntPref("browser.tabs.tabMaxWidth", min);
      Services.prefs.setIntPref("browser.tabs.tabMinWidth", max);
      [min, max] = [max, min];
    }
    tabContainer.mTabMaxWidth = max;
    tabContainer.mTabMinWidth = min;
    TabmixTabbar.widthFitTitle = !isZen && Tabmix.prefs.getBoolPref("flexTabs") && max != min;
    if (TabmixTabbar.widthFitTitle) {
      Tabmix.setItem(tabContainer, "widthFitTitle", true);
      if (Tabmix.isVersion(1310)) {
        Tabmix.setItem(tabContainer.arrowScrollbox, "widthFitTitle", true);
      }
    }

    // init DynamicRules
    lazy.DynamicRules.init(window);

    const tabs = tabContainer.querySelectorAll(".tabbrowser-tab");
    tabs.forEach(tab => Tabmix.setTabStyle(tab));

    // hide close tab button on single tab
    // see gBrowser.tabContainer._updateCloseButtons at tablib.js
    if (
      tabs.length === 1 &&
      (Tabmix.tabsUtils._keepLastTab ||
        (!Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab") &&
          (!tabs[0]?.linkedBrowser || tabs[0]?.isEmpty)))
    ) {
      tabContainer.setAttribute("closebuttons", "noclose");
      tabContainer.removeAttribute("closebuttons-hover");
    }
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
    let preparedForWindow = false;
    ["load", "before-initial-tab-adopted"].forEach(event => {
      window.addEventListener(
        event,
        () => {
          if (!preparedForWindow) {
            this._prepareBeforeOverlays(window);
            preparedForWindow = true;
          }
        },
        {capture: true, once: true}
      );
    });
  },

  /**
   * initialize functions that can be called by events that fired before our
   * overlay is ready.
   *
   * @param window
   */
  _prepareBeforeOverlays(window) {
    const {gBrowser, gBrowserInit, Tabmix} = window;

    Tabmix.singleWindowMode = Tabmix.prefs.getBoolPref("singleWindow");

    /**
     * copy Tabmix data from old tab to new tab. we use it before
     * swapBrowsersAndCloseOther
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

    /**
     * @type {TabBrowser["swapBrowsersAndCloseOther"]}
     * @this {TabBrowser}
     */
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
      return Tabmix.originalFunctions.swapBrowsersAndCloseOther.apply(this, [ourTab, otherTab]);
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
      const url =
        lazy.SessionStore.getLazyTabValue(tab, "url") || tab.linkedBrowser.currentURI.spec;
      TMP_Places.asyncSetTabTitle(tab, {url});
    });
  },
};
