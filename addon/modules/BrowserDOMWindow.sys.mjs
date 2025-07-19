import {isVersion} from "chrome://tabmix-resource/content/BrowserVersion.sys.mjs";
import {XPCOMUtils} from "resource://gre/modules/XPCOMUtils.sys.mjs";

/** @type {BrowserDOMWindowModule.Lazy} */ // @ts-ignore
const lazy = {};

/* eslint-disable tabmix/valid-lazy */
ChromeUtils.defineESModuleGetters(lazy, {
  initializeChangeCodeClass: "chrome://tabmix-resource/content/Changecode.sys.mjs",
  URILoadingHelper: "resource:///modules/URILoadingHelper.sys.mjs",
});

if (isVersion(1420)) {
  ChromeUtils.defineESModuleGetters(lazy, {
    TaskbarTabsUtils: "resource:///modules/taskbartabs/TaskbarTabsUtils.sys.mjs",
  });
}

// @ts-ignore
ChromeUtils.defineLazyGetter(lazy, "ReferrerInfo", () =>
  Components.Constructor("@mozilla.org/referrer-info;1", "nsIReferrerInfo", "init")
);
/* eslint-enable tabmix/valid-lazy */

/**
 * don't open link from external application in new window when in single window
 * mode don't open link from external application in current tab if the tab is
 * locked
 *
 * we don't check isUrlForDownload for external links, it is not likely that
 * link in other application opened Firefox for downloading data
 *
 * @type {BrowserDOMWindowModule.BrowserDOMWindow}
 */
export const TabmixBrowserDOMWindow = {
  _initialized: false,

  init(window) {
    if (this._initialized && isVersion(1370)) {
      return;
    }
    this._initialized = true;

    const {constructor, scope = {}} =
      isVersion(1370) ? this.getBrowserDOMWindow(window) : this.getNsBrowserAccess(window);

    /** @type {TabmixGlobal} */ // @ts-expect-error initializeChangeCodeClass will update Tabmix
    let tabmixObj = {};

    if (isVersion(1370)) {
      lazy.initializeChangeCodeClass(tabmixObj, {
        obj: constructor.prototype,
        scope,
      });
    } else {
      tabmixObj = window.Tabmix;
    }

    const browserAccess = constructor.prototype;
    this.openURIInNewTab(constructor, tabmixObj);

    // TreeStyleTab 0.16.2015111001 wrap openURI in nsBrowserAccess.prototype.__treestyletab__openURI
    let methodName =
      (
        window.Tabmix.extensions.treeStyleTab &&
        typeof browserAccess.__treestyletab__openURI == "function"
      ) ?
        "__treestyletab__openURI"
      : "getContentWindowOrOpenURI";

    this.getContentWindowOrOpenURI(constructor, methodName, tabmixObj);
  },

  getBrowserDOMWindow(window) {
    // BrowserDOMWindow.sys.mjs exist since Firefox 137
    const {BrowserDOMWindow} = ChromeUtils.importESModule(
      "resource:///modules/BrowserDOMWindow.sys.mjs"
    );

    // @ts-ignore
    const {BrowserWindowTracker} = ChromeUtils.importESModule(
      "resource:///modules/BrowserWindowTracker.sys.mjs"
    );
    // @ts-ignore
    const {AppConstants} = ChromeUtils.importESModule(
      "resource://gre/modules/AppConstants.sys.mjs"
    );
    // @ts-ignore
    const {PrivateBrowsingUtils} = ChromeUtils.importESModule(
      "resource://gre/modules/PrivateBrowsingUtils.sys.mjs"
    );

    const getPrivateMethod = window.Tabmix.getPrivateMethod;
    BrowserDOMWindow.prototype._openURIInNewTab = getPrivateMethod({
      parent: BrowserDOMWindow.prototype,
      parentName: "BrowserDOMWindow.prototype",
      methodName: "openURIInNewTab",
      nextMethodName: "createContentWindow",
    });

    /* eslint-disable tabmix/valid-lazy */
    // @ts-ignore
    XPCOMUtils.defineLazyPreferenceGetter(
      lazy,
      "loadDivertedInBackground",
      "browser.tabs.loadDivertedInBackground"
    );

    // @ts-ignore
    XPCOMUtils.defineLazyPreferenceGetter(
      lazy,
      "loadExternalInBackground",
      "extensions.tabmix.loadExternalInBackground"
    );
    /* eslint-enable tabmix/valid-lazy */

    const scope = {
      AppConstants,
      BrowserWindowTracker,
      lazy,
      PrivateBrowsingUtils,
    };

    return {
      constructor: BrowserDOMWindow,
      scope,
    };
  },

  getNsBrowserAccess(window) {
    return {
      constructor: window.nsBrowserAccess,
    };
  },

  openURIInNewTab(constructor, tabmixObj) {
    const fullMethodName = `${constructor.name}.prototype._openURIInNewTab`;
    tabmixObj
      .changeCode(constructor.prototype, fullMethodName, {sandbox: tabmixObj._sandbox})
      ._replace(
        `if (aIsExternal && (!aURI || aURI.spec == "about:blank")) {`,
        `let currentIsBlank = win.gBrowser.isBlankNotBusyTab(win.gBrowser._selectedTab);
      $&`
      )
      ._replace(
        isVersion(1260) ? "win.BrowserCommands.openTab()" : "win.BrowserOpenTab()",
        `if (currentIsBlank) Tabmix.tablib.setURLBarFocus();
      else $&`
      )
      ._replace(
        '"browser.tabs.loadDivertedInBackground"',
        'aIsExternal ? "extensions.tabmix.loadExternalInBackground" : $&',
        {check: !isVersion(1370)}
      )
      ._replace(
        "loadInBackground = lazy.loadDivertedInBackground",
        "loadInBackground = aIsExternal ? lazy.loadExternalInBackground : lazy.loadDivertedInBackground",
        {check: isVersion(1370)}
      )
      ._replace("win.gBrowser.addTab", "currentIsBlank ? win.gBrowser._selectedTab : $&")
      ._replace(
        "win.gBrowser.getBrowserForTab(tab);",
        `$&
    if (currentIsBlank && aURI) {
      let loadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
      if (aIsExternal) {
        loadFlags |= Ci.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL;
      }
      win.gBrowser.fixupAndLoadURIString(aURI.spec, {
        triggeringPrincipal: aTriggeringPrincipal,
        referrerInfo: aReferrerInfo,
        userContextId: aUserContextId,
        ${isVersion(1420) ? `policyContainer: aPolicyContainer` : `csp: aCsp`},
        loadFlags,
      });
      browser.focus();
    }`
      )
      ._replace(/Tabmix\./g, "this.win.Tabmix.", {check: isVersion(1370)})
      .toCode();
  },

  getContentWindowOrOpenURI(constructor, methodName, tabmixObj) {
    const fullMethodName = `${constructor.name}.prototype.${methodName}`;
    tabmixObj
      .changeCode(constructor.prototype, fullMethodName, {sandbox: tabmixObj._sandbox})
      ._replace(
        "switch (aWhere) {",
        `  if (Tabmix.singleWindowMode &&
          aWhere == Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW) {
          aWhere = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
      }
      if (aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW &&
          aWhere != Ci.nsIBrowserDOMWindow.OPEN_PRINT_BROWSER &&
          aWhere != Ci.nsIBrowserDOMWindow.OPEN_NEWTAB) {
          let isLockTab = Tabmix.whereToOpen(null).lock;
          if (isLockTab) {
              aWhere = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
          }
      }
      $&`
      )
      ._replace(
        '"browser.tabs.loadDivertedInBackground"',
        'isExternal ? "extensions.tabmix.loadExternalInBackground" : $&',
        {flags: "g", check: !isVersion(1370)}
      )
      ._replace(
        "!lazy.loadDivertedInBackground",
        "isExternal ? !lazy.loadExternalInBackground : $&",
        {check: isVersion(1370)}
      )
      ._replace(/Tabmix\./g, "this.win.Tabmix.", {check: isVersion(1370)})
      .toCode();
  },
};
