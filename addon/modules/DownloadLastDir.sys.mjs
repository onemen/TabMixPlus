import {DownloadLastDir} from "resource://gre/modules/DownloadLastDir.sys.mjs";

/** @type {DownloadLastDirModule.DownloadLastDir} */
export const TabmixDownloadLastDir = {
  _initialized: false,
  init() {
    if (this._initialized) {
      return;
    }

    this._initialized = true;

    // original DownloadLastDir.sys.mjs query Ci.nsILoadContext on this.window,
    // it fails if we already closed the tab that initialized the download
    // with TypeError: can't access dead object
    /**
     * @type {TypedPropertyDescriptor<Window | null> &
     *   ThisType<DownloadLastDir>}
     */
    let descriptor = {
      get() {
        if (this._window) {
          try {
            this._window.QueryInterface(Ci.nsIInterfaceRequestor);
          } catch {
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
      enumerable: true,
    };

    let obj = DownloadLastDir.prototype;
    Object.defineProperty(obj, "window", descriptor);
    obj._window = null;
  },
};

TabmixDownloadLastDir.init();
