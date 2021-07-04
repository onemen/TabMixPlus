/* globals PanelUI */
"use strict";

this.EXPORTED_SYMBOLS = ["SingleWindowModeUtils"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("chrome://tabmix-resource/content/TabmixSvc.jsm", this);
Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm", this);

this.SingleWindowModeUtils = {
  /**
   * @brief Locate a browser window.
   *
   * @param aExclude  A scripted window object that we do not want to use.
   *
   * @returns         A scripted window object representing a browser
   *                  window that is not the same as aExclude, and is
   *                  additionally not a popup window.
   */
  getBrowserWindow(aExclude) {
    // on per-window private browsing mode,
    // allow to open one normal window and one private window in single window mode
    const isPrivate = PrivateBrowsingUtils.isWindowPrivate(aExclude);

    function isSuitableBrowserWindow(win) {
      return (!win.closed && win.document.readyState == "complete" &&
              win.toolbar.visible && win != aExclude &&
              PrivateBrowsingUtils.isWindowPrivate(win) == isPrivate);
    }

    const windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      const win = windows.getNext();
      if (isSuitableBrowserWindow(win))
        return win;
    }
    return null;
  },

  newWindow(aWindow) {
    if (!aWindow.Tabmix.singleWindowMode)
      return false;

    if (!aWindow.arguments || aWindow.arguments.length === 0)
      return false;

    const onLoad = () => {
      const docElement = aWindow.document.documentElement;
      if (docElement.getAttribute("windowtype") == "navigator:browser")
        this.onLoad(aWindow);
    };
    aWindow.addEventListener("load", onLoad, {once: true});

    aWindow.gTMPprefObserver.setLink_openPrefs();

    const existingWindow = this.getBrowserWindow(aWindow);
    // no navigator:browser window open yet?
    if (!existingWindow)
      return false;

    existingWindow.focus();
    // save dimensions
    const win = aWindow.document.documentElement;
    aWindow.__winRect = {
      sizemode: win.getAttribute("sizemode"),
      width: win.getAttribute("width"),
      height: win.getAttribute("height"),
      screenX: win.getAttribute("screenX"),
      screenY: win.getAttribute("screenY")
    };
    // hide the new window
    aWindow.resizeTo(10, 10);
    aWindow.moveTo(-50, -50);
    win.removeAttribute("sizemode");
    win.setAttribute("width", 0);
    win.setAttribute("height", 0);
    win.setAttribute("screenX", aWindow.screen.availWidth + 10);
    win.setAttribute("screenY", aWindow.screen.availHeight + 10);

    return true;
  },

  restoreDimensionsAndPosition(newWindow, restorePosition) {
    const rect = newWindow.__winRect;
    if (typeof rect != "object") {
      return;
    }
    const doc = newWindow.document.documentElement;
    for (const attr of Object.keys(rect)) {
      doc.setAttribute(attr, rect[attr]);
    }
    if (restorePosition) {
      const {width, height, screenX, screenY} = rect;
      newWindow.resizeTo(width, height);
      newWindow.moveTo(screenX, screenY);
    }
    delete newWindow.__winRect;
  },

  onLoad(newWindow) {
    const existingWindow = this.getBrowserWindow(newWindow);
    // no navigator:browser window open yet?
    if (!existingWindow)
      return;

    if (!newWindow.arguments || newWindow.arguments.length === 0)
      return;
    const args = newWindow.arguments;

    // don't close windows that was probably opened by extension
    if (args.length == 1 && args[0] === null) {
      this.restoreDimensionsAndPosition(newWindow, true);
      return;
    }

    const existingBrowser = existingWindow.gBrowser;
    existingWindow.Tabmix.tablib.init(); // just in case Tabmix.tablib isn't init yet
    const uriToLoad = args[0];

    let urls = [];
    let params = { };
    if (uriToLoad instanceof Ci.nsIArray) {
      const count = uriToLoad.length;
      for (let i = 0; i < count; i++) {
        const uriString = uriToLoad.queryElementAt(i, Ci.nsISupportsString);
        urls.push(uriString.data);
      }
      params = {
        userContextId: args[5],
        triggeringPrincipal: args[8] || Services.scriptSecurityManager.getSystemPrincipal(),
        allowInheritPrincipal: args[9],
        csp: args[10],
        fromExternal: true,
      };
    } else if (uriToLoad instanceof newWindow.XULElement) {
      // some extension try to swap a tab to new window
      // we don't do anything in this case.
      // just close the new window
    } else if (args.length >= 3) {
      // from browser.js _handleURIToLoad
      // window.arguments[1]: unused (bug 871161)
      //  [2]: referrerInfo (nsIReferrerInfo)
      //  [3]: postData (nsIInputStream)
      //  [4]: allowThirdPartyFixup (bool)
      //  [5]: userContextId (int)
      //  [6]: originPrincipal (nsIPrincipal)
      //  [7]: originStoragePrincipal (nsIPrincipal)
      //  [8]: triggeringPrincipal (nsIPrincipal)
      //  [9]: allowInheritPrincipal (bool)
      //  [10]: csp (nsIContentSecurityPolicy)
      params = {
        referrerInfo: args[2] || null,
        postData: args[3] || null,
        allowThirdPartyFixup: args[4] || false,
        userContextId: args[5] ?? Ci.nsIScriptSecurityManager.DEFAULT_USER_CONTEXT_ID,
        originPrincipal: args[6],
        originStoragePrincipal: args[7],
        forceAboutBlankViewerInCurrent: Boolean(args[6]),
        triggeringPrincipal: args[8],
        allowInheritPrincipal: args[9] !== false,
        csp: args[10],
      };
      urls = [uriToLoad];
    } else {
      urls = uriToLoad ? uriToLoad.split("|") : ["about:blank"];
    }

    let firstTabAdded;
    try {
      // open the tabs in current window
      if (urls.length) {
        firstTabAdded = existingBrowser.selectedTab;
        const isBlankTab = existingBrowser.isBlankNotBusyTab(firstTabAdded);
        if (isBlankTab)
          existingWindow.openLinkIn(urls[0], "current", params);
        else
          firstTabAdded = existingBrowser.addTrustedTab(urls[0], params);
        for (let i = 1; i < urls.length; ++i)
          existingBrowser.addTrustedTab(urls[i]);
      }
    } catch (ex) { }
    try {
      // we need to close the window after timeout so other extensions don't fail.
      // if we don't add this here BrowserShutdown fails
      newWindow.FullZoom.init = function() {};
      newWindow.FullZoom.destroy = function() {};
      newWindow.OfflineApps.uninit = function() {};
      newWindow.IndexedDBPromptHelper.init();
      if ("gMenuButtonBadgeManager" in newWindow) {
        newWindow.gMenuButtonBadgeManager.uninit = function() {
          if (typeof PanelUI == "object" && PanelUI.panel) {
            PanelUI.panel.removeEventListener("popupshowing", this, true);
          }
        };
      }
      newWindow.gPrivateBrowsingUI.uninit = function() {};
    } catch (ex) {
      existingWindow.Tabmix.obj(ex);
    }
    existingWindow.setTimeout(() => {
      try {
        // restore window dimensions, to prevent flickering in the next restart
        this.restoreDimensionsAndPosition(newWindow);
        newWindow.close();
        if (firstTabAdded) {
          existingBrowser.selectedTab = firstTabAdded;
          existingBrowser.ensureTabIsVisible(firstTabAdded);
        }
        // for the case the window is minimized or not in focus
        existingWindow.focus();
      } catch (ex) {
        existingWindow.Tabmix.obj(ex);
      }
    }, 0);
  }
};
