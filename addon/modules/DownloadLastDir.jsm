/// "use strict";

/* eslint strict: 0 */

this.EXPORTED_SYMBOLS = ["TabmixDownloadLastDir"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

this.TabmixDownloadLastDir = {
  _initialized: false,
  init() {
    if (this._initialized)
      return;
    this._initialized = true;

    // original DownloadLastDir.jsm query Ci.nsILoadContext on this.window,
    // it fails if we already closed the tab that initialized the download
    // with TypeError: can't access dead object
    let descriptor = {
      get() {
        if (this._window) {
          try {
            this._window.QueryInterface(Ci.nsIInterfaceRequestor);
          } catch (ex) {
            let win = Services.wm.getMostRecentWindow("navigator:browser");
            return win ? win.gBrowser.selectedTab.ownerGlobal : null;
          }
        }
        return this._window;
      },
      set(val) {
        this._window = val;
        return val;
      },
      configurable: true,
      enumerable: true
    };

    let downloadModule = {};
    Cu.import("resource://gre/modules/DownloadLastDir.jsm", downloadModule);
    let obj = downloadModule.DownloadLastDir.prototype;
    Object.defineProperty(obj, "window", descriptor);
    obj._window = null;
  }
};

this.TabmixDownloadLastDir.init();
