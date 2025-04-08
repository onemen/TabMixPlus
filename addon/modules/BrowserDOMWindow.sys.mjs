import {isVersion} from "chrome://tabmix-resource/content/BrowserVersion.sys.mjs";
import {TabmixSvc} from "chrome://tabmix-resource/content/TabmixSvc.sys.mjs";
import {XPCOMUtils} from "resource://gre/modules/XPCOMUtils.sys.mjs";

/** @type {BrowserDOMWindowModule.Lazy} */ // @ts-ignore
const lazy = {};
/* eslint-disable tabmix/valid-lazy */
ChromeUtils.defineESModuleGetters(lazy, {
  //
  URILoadingHelper: "resource:///modules/URILoadingHelper.sys.mjs",
});

// @ts-ignore
ChromeUtils.defineLazyGetter(lazy, "ReferrerInfo", () =>
  Components.Constructor("@mozilla.org/referrer-info;1", "nsIReferrerInfo", "init")
);
/* eslint-enable tabmix/valid-lazy */

/** @type {TabmixGlobal} */ // @ts-expect-error we use loadSubScript to add Tabmix to the global scope
const Tabmix = {};

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

    const sandbox = TabmixSvc.initializeChangeCodeScript(Tabmix, {
      obj: constructor.prototype,
      scope,
    });

    const browserAccess = constructor.prototype;
    this.openURIInNewTab(constructor, sandbox);

    // TreeStyleTab 0.16.2015111001 wrap openURI in nsBrowserAccess.prototype.__treestyletab__openURI
    let methodName =
      (
        window.Tabmix.extensions.treeStyleTab &&
        typeof browserAccess.__treestyletab__openURI == "function"
      ) ?
        "__treestyletab__openURI"
      : "getContentWindowOrOpenURI";

    this.getContentWindowOrOpenURI(constructor, methodName, sandbox);
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
    BrowserDOMWindow.prototype._openURIInNewTab = getPrivateMethod(
      BrowserDOMWindow,
      "openURIInNewTab",
      "createContentWindow"
    );

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

  openURIInNewTab(constructor, sandbox) {
    const fullMethodName = `${constructor.name}.prototype._openURIInNewTab`;
    Tabmix.changeCode(constructor.prototype, fullMethodName, {sandbox})
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
        csp: aCsp,
        loadFlags,
      });
      browser.focus();
    }`
      )
      ._replace(/Tabmix\./g, "this.win.Tabmix.", {check: isVersion(1370)})
      .toCode();
  },

  getContentWindowOrOpenURI(constructor, methodName, sandbox) {
    const fullMethodName = `${constructor.name}.prototype.${methodName}`;
    Tabmix.changeCode(constructor.prototype, fullMethodName, {sandbox})
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
