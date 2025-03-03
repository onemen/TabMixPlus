
import {isVersion} from "chrome://tabmix-resource/content/BrowserVersion.sys.mjs";
import {TabmixSvc} from "chrome://tabmix-resource/content/TabmixSvc.sys.mjs";
import {XPCOMUtils} from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};
/* eslint-disable tabmix/valid-lazy */
ChromeUtils.defineESModuleGetters(lazy, {
  //
  URILoadingHelper: "resource:///modules/URILoadingHelper.sys.mjs",
});

// @ts-ignore
ChromeUtils.defineLazyGetter(lazy, "ReferrerInfo", () => Components.Constructor(
  "@mozilla.org/referrer-info;1",
  "nsIReferrerInfo",
  "init"
));
/* eslint-enable tabmix/valid-lazy */

const Tabmix = {};

/**
  * don't open link from external application in new window when in single window mode
  * don't open link from external application in current tab if the tab is locked
  *
  * we don't check isUrlForDownload for external links,
  * it is not likely that link in other application opened Firefox for downloading data
  */
export const TabmixBrowserDOMWindow = {
  _initialized: false,

  init(window) {
    if (this._initialized && isVersion(1370)) {
      return;
    }
    this._initialized = true;

    Tabmix._debugMode = window.Tabmix._debugMode;
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js", {Tabmix, TabmixSvc});

    const {constructor, makeCode} = isVersion(1370) ?
      this.getBrowserDOMWindow(window.Tabmix.getPrivateMethod) :
      this.getNsBrowserAccess(window);

    const browserAccess = constructor.prototype;
    browserAccess._openURIInNewTab = makeCode(null, this.openURIInNewTab(constructor));

    // TreeStyleTab 0.16.2015111001 wrap openURI in nsBrowserAccess.prototype.__treestyletab__openURI
    let methodName =
      window.Tabmix.extensions.treeStyleTab && typeof browserAccess.__treestyletab__openURI == "function" ?
        "__treestyletab__openURI" :
        "getContentWindowOrOpenURI";
    browserAccess[methodName] = makeCode(null, this.getContentWindowOrOpenURI(constructor, methodName));
  },

  getBrowserDOMWindow(getPrivateMethod) {
    // BrowserDOMWindow.sys.mjs exist since Firefox 137
    const {BrowserDOMWindow} = ChromeUtils.importESModule("resource:///modules/BrowserDOMWindow.sys.mjs");

    /* eslint-disable no-unused-vars */
    const {BrowserWindowTracker} = ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs");
    const {AppConstants} = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");
    const {PrivateBrowsingUtils} = ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs");
    /* eslint-enable no-unused-vars */

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

    return {
      constructor: BrowserDOMWindow,
      makeCode: eval(Tabmix._localMakeCode),
    };
  },

  getNsBrowserAccess(window) {
    return {
      constructor: window.nsBrowserAccess,
      makeCode: window.eval(Tabmix._localMakeCode),
    };
  },

  openURIInNewTab(constructor) {
    const fullMethodName = `${constructor.name}.prototype._openURIInNewTab`;
    const code = Tabmix.changeCode(constructor.prototype, fullMethodName)._replace(
      `if (aIsExternal && (!aURI || aURI.spec == "about:blank")) {`,
      `let currentIsBlank = win.gBrowser.isBlankNotBusyTab(win.gBrowser._selectedTab);
      $&`
    )._replace(
      isVersion(1260) ? 'win.BrowserCommands.openTab()' : 'win.BrowserOpenTab()',
      `if (currentIsBlank) Tabmix.tablib.setURLBarFocus();
      else $&`
    )._replace(
      '"browser.tabs.loadDivertedInBackground"',
      'aIsExternal ? "extensions.tabmix.loadExternalInBackground" : $&',
      {check: !isVersion(1370)}
    )._replace(
      'loadInBackground = lazy.loadDivertedInBackground',
      'loadInBackground = aIsExternal ? lazy.loadExternalInBackground : lazy.loadDivertedInBackground',
      {check: isVersion(1370)}
    )._replace(
      'win.gBrowser.addTab',
      'currentIsBlank ? win.gBrowser._selectedTab : $&'
    )._replace(
      'win.gBrowser.getBrowserForTab(tab);',
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
    )._replace(
      /Tabmix\./g,
      'this.win.Tabmix.',
      {check: isVersion(1370)}
    );
    return code.value;
  },

  getContentWindowOrOpenURI(constructor, methodName) {
    const fullMethodName = `${constructor.name}.prototype.${methodName}`;
    const code = Tabmix.changeCode(constructor.prototype, fullMethodName)._replace(
      'switch (aWhere) {',
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
    )._replace(
      '"browser.tabs.loadDivertedInBackground"',
      'isExternal ? "extensions.tabmix.loadExternalInBackground" : $&',
      {flags: "g", check: !isVersion(1370)},
    )._replace(
      '!lazy.loadDivertedInBackground',
      'isExternal ? !lazy.loadExternalInBackground : $&',
      {check: isVersion(1370)}
    )._replace(
      /Tabmix\./g,
      'this.win.Tabmix.',
      {check: isVersion(1370)}
    );
    return code.value;
  },
};
