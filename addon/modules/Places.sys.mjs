import {TabmixChromeUtils} from "chrome://tabmix-resource/content/ChromeUtils.sys.mjs";
import {TabmixSvc} from "chrome://tabmix-resource/content/TabmixSvc.sys.mjs";

// AppConstants is used in modified PlacesUIUtils functions
// @ts-ignore
// eslint-disable-next-line no-unused-vars
const AppConstants = ChromeUtils.importESModule(
  "resource://gre/modules/AppConstants.sys.mjs"
).AppConstants;

/** @type {PlacesModule.Lazy} */ // @ts-ignore
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  // eslint-disable-next-line tabmix/valid-lazy
  BrowserUtils: "resource://gre/modules/BrowserUtils.sys.mjs",
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  PlacesUIUtils: "resource:///modules/PlacesUIUtils.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

TabmixChromeUtils.defineLazyModuleGetters(lazy, {
  // BrowserWindowTracker.sys.mjs and OpenInTabsUtils.sys.mjs exist since Firefox 116
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  // eslint-disable-next-line tabmix/valid-lazy
  OpenInTabsUtils: "resource:///modules/OpenInTabsUtils.jsm",
});

// this function is used by PlacesUIUtils functions that we evaluate here
/** @param {Window} aWindow */
// @ts-ignore

function getBrowserWindow(aWindow) {
  return (
      aWindow && aWindow.document.documentElement.getAttribute("windowtype") == "navigator:browser"
    ) ?
      aWindow
    : getTopWindow();
}

function getTopWindow() {
  return lazy.BrowserWindowTracker.getTopWindow();
}

/** @type {PlacesModule.PlacesUtilsInternal} */
var PlacesUtilsInternal;

/** @type {PlacesModule.PlacesUtils} */
export const TabmixPlacesUtils = Object.freeze({
  init(aWindow) {
    PlacesUtilsInternal.init(aWindow);
  },

  onQuitApplication() {
    PlacesUtilsInternal.onQuitApplication();
  },

  applyCallBackOnUrl(aUrl, aCallBack) {
    return PlacesUtilsInternal.applyCallBackOnUrl(aUrl, aCallBack);
  },

  getTitleFromBookmark(aUrl, aTitle) {
    return PlacesUtilsInternal.asyncGetTitleFromBookmark(aUrl, aTitle);
  },

  asyncGetTitleFromBookmark(aUrl, aTitle) {
    return PlacesUtilsInternal.asyncGetTitleFromBookmark(aUrl, aTitle);
  },
});

/** @type {TabmixGlobal} */ // @ts-expect-error we use loadSubScript to add Tabmix to the global scope
const Tabmix = {};

PlacesUtilsInternal = {
  __index: 0,
  _timer: null,
  _initialized: false,

  init(aWindow) {
    if (this._initialized) {
      return;
    }

    this._initialized = true;

    const sandbox = TabmixSvc.initializeChangeCodeScript(Tabmix, {
      // @ts-expect-error - PlacesUIUtils dont have index signature on purpose
      obj: lazy.PlacesUIUtils,
      scope: {lazy, getBrowserWindow, getTopWindow},
    });

    try {
      this.initPlacesUIUtils(aWindow, sandbox);
    } catch (ex) {
      console.error("Tabmix Error:", ex);
    }
  },

  onQuitApplication() {
    if (this._timer) {
      this._timer.cancel();
      this._timer = null;
    }

    this.functions.forEach(aFn => {
      /** @type {PlacesModule.TabmixFunctionsName} */
      const tabmixName = `tabmix_${aFn}`;
      // @ts-expect-error Function signatures are compatible at runtime
      lazy.PlacesUIUtils[aFn] = lazy.PlacesUIUtils[tabmixName];
      delete lazy.PlacesUIUtils[tabmixName];
    });

    this._removeObserver?.();
  },

  functions: ["openTabset", "openNodeWithEvent", "_openNodeIn"],
  initPlacesUIUtils: function TMP_PC_initPlacesUIUtils(aWindow, sandbox) {
    /** @type {MockedGeckoTypes.PlacesUIUtils["openTabset"] | undefined} */
    let originalOpenTabset;
    try {
      originalOpenTabset = aWindow._tabmix_PlacesUIUtils_openTabset;
      lazy.PlacesUIUtils.openTabset.toString();
    } catch {
      if (aWindow.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
        TabmixSvc.console.log(
          "Starting with Firefox 21 Imacros 8.3.0 break toString on PlacesUIUtils functions." +
            "\nTabmix can't update PlacesUIUtils to work according to Tabmix preferences, use Imacros 8.3.1 and up."
        );
      }
      return;
    }

    this.functions.forEach(aFn => {
      // @ts-expect-error Function signatures are compatible at runtime
      lazy.PlacesUIUtils["tabmix_" + aFn] = lazy.PlacesUIUtils[aFn];
    });

    /** @type {PlacesModule.updateOpenTabset} */
    function updateOpenTabset(name, treeStyleTab = false) {
      const isWaterfoxOverridePlacesUIUtils =
        TabmixSvc.version({wf: "115.9.0"}) && !lazy.PrivateBrowsingUtils.isWindowPrivate(aWindow);
      if (isWaterfoxOverridePlacesUIUtils) {
        if (!originalOpenTabset) {
          // can not find original PlacesUIUtils.openTabset that Waterfox override
          return;
        }
        lazy.PlacesUIUtils[name] = originalOpenTabset;
      }
      let openGroup = "    browserWindow.TMP_Places.openGroup(urls, where$1);";
      Tabmix.changeCode(lazy.PlacesUIUtils, "PlacesUIUtils." + name, {sandbox})
        ._replace("urls = []", "behavior, $&", {check: treeStyleTab})
        ._replace(
          /let openGroupBookmarkBehavior =|TSTOpenGroupBookmarkBehavior =/,
          "$& behavior =",
          {check: treeStyleTab, silent: true}
        )
        ._replace(
          /browserWindow\.gBrowser\.loadTabs\([^;]+;/,
          `var changeWhere = where == "tabshifted" && aEvent.target.localName != "menuitem";
    if (changeWhere) where = "current"\n` +
            openGroup.replace("$1", treeStyleTab ? ", behavior" : "")
        )
        .toCode();

      if (isWaterfoxOverridePlacesUIUtils) {
        const {PrivateTab} = ChromeUtils.importESModule("resource:///modules/PrivateTab.sys.mjs");
        PrivateTab.overridePlacesUIUtils();
      }
    }
    var treeStyleTabInstalled = "TreeStyleTabBookmarksService" in aWindow;
    if (
      treeStyleTabInstalled &&
      typeof lazy.PlacesUIUtils.__treestyletab__openTabset == "function"
    ) {
      updateOpenTabset("__treestyletab__openTabset");
    } else if (treeStyleTabInstalled) {
      // wait until TreeStyleTab changed PlacesUIUtils.openTabset
      let timer = (this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer));
      this.__index = 0;
      timer.initWithCallback(
        () => {
          let str = lazy.PlacesUIUtils.openTabset.toString();
          if (
            ++this.__index > 10 ||
            str.indexOf("TreeStyleTabBookmarksService") > -1 ||
            str.indexOf("GroupBookmarkBehavior") > -1
          ) {
            timer.cancel();
            this._timer = null;
            this.__index = 0;
            updateOpenTabset("openTabset", true);
          }
        },
        50,
        Ci.nsITimer.TYPE_REPEATING_SLACK
      );
    } else {
      // TreeStyleTab not installed
      updateOpenTabset("openTabset");
    }

    /** @type {PlacesModule.TabmixFunctionsName} */
    let fnName =
      treeStyleTabInstalled && lazy.PlacesUIUtils.__treestyletab__openNodeWithEvent ?
        "__treestyletab__openNodeWithEvent"
      : "openNodeWithEvent";
    Tabmix.changeCode(lazy.PlacesUIUtils, "PlacesUIUtils." + fnName, {sandbox})
      ._replace("this._openNodeIn", "where = {where, event: aEvent};\n    $&")
      .toCode();

    // Don't change "current" when user click context menu open (callee is PC_doCommand and aWhere is current)
    // we disable the open menu when the tab is lock
    // the 2nd check for aWhere == "current" is for non Firefox code that may call this function
    Tabmix.changeCode(lazy.PlacesUIUtils, "PlacesUIUtils._openNodeIn", {sandbox})
      ._replace(
        /\)\n*\s*{/,
        `$&
    var TMP_Event;
    if (arguments.length > 1 && typeof aWhere == "object") {
      TMP_Event = aWhere.event;
      aWhere = aWhere.where;
    }`
      )
      ._replace(
        "aWindow.openTrustedLinkIn",
        `let browserWindow = getBrowserWindow(aWindow);
      if (browserWindow && typeof aWindow.TMP_Places == "object") {
        let TMP_Places = aWindow.TMP_Places;
        if (TMP_Event)
          aWhere = TMP_Places.isBookmarklet(aNode.uri)
            ? "current"
            : TMP_Places.fixWhereToOpen(TMP_Event, aWhere);
        else if (aWhere == "current" && !TMP_Places.isBookmarklet(aNode.uri)) {
          if (!browserWindow.Tabmix.callerTrace("PC_doCommand")) {
            aWhere = TMP_Places.fixWhereToOpen(null, aWhere);
          }
        }
      }
      if (browserWindow && aWhere == "current")
        browserWindow.gBrowser.selectedBrowser.tabmix_allowLoad = true;
      $&`
      )
      .toCode();
  },

  // Lazy getter for titlefrombookmark preference
  get titlefrombookmark() {
    const PREF = "extensions.tabmix.titlefrombookmark";
    let updateValue = () => {
      let value = Services.prefs.getBoolPref(PREF);
      let definition = {value, configurable: true};
      Object.defineProperty(this, "titlefrombookmark", definition);
      return value;
    };

    Services.prefs.addObserver(PREF, updateValue);
    this._removeObserver = () => {
      Services.prefs.removeObserver(PREF, updateValue);
    };
    return updateValue();
  },

  /* :::::::::::::::   AsyncPlacesUtils   ::::::::::::::: */

  fetch(guidOrInfo, onResult = null, options = {}) {
    return lazy.PlacesUtils.bookmarks.fetch(guidOrInfo, onResult, options);
  },

  async getBookmarkTitle(url) {
    try {
      const {guid, title} = await this.fetch({url});
      if (guid) {
        return title;
      }
    } catch (ex) {
      TabmixSvc.console.reportError(ex, "Error function name changed", "not a function");
    }
    return null;
  },

  async applyCallBackOnUrl(aUrl, aCallBack) {
    let hasHref = aUrl.indexOf("#") > -1;
    let result =
      (await aCallBack.apply(this, [aUrl])) || hasHref ?
        await aCallBack.apply(this, [aUrl.split("#")[0] ?? aUrl])
      : null;
    // when IE Tab is installed try to find url with or without the prefix
    const ietab = Tabmix.gIeTab;
    if (!result && ietab) {
      let prefix = "chrome://" + ietab.folder + "/content/reloaded.html?url=";
      if (aUrl != prefix) {
        let url = aUrl.startsWith(prefix) ? aUrl.replace(prefix, "") : prefix + aUrl;
        result =
          (await aCallBack.apply(this, [url])) || hasHref ?
            await aCallBack.apply(this, [url.split("#")[0] ?? url])
          : null;
      }
    }
    return result;
  },

  async asyncGetTitleFromBookmark(aUrl, aTitle) {
    if (!this.titlefrombookmark || !aUrl) {
      return aTitle;
    }

    try {
      const getTitle = (/** @type {string} */ url) => this.getBookmarkTitle(url);
      const title = await this.applyCallBackOnUrl(aUrl, getTitle);
      return title || aTitle;
    } catch (err) {
      TabmixSvc.console.reportError(err, "Error form asyncGetTitleFromBookmark");
      return "";
    }
  },
};
