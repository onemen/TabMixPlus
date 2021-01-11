/* globals PanelUI */
"use strict";

this.EXPORTED_SYMBOLS = ["SingleWindowModeUtils"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://tabmixplus/TabmixSvc.jsm", this);
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
    var isPrivate = PrivateBrowsingUtils.isWindowPrivate(aExclude);

    function isSuitableBrowserWindow(win) {
      return (!win.closed && win.document.readyState == "complete" &&
              win.toolbar.visible && win != aExclude &&
              PrivateBrowsingUtils.isWindowPrivate(win) == isPrivate);
    }

    var windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      let win = windows.getNext();
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

    const onLoad = aEvent => {
      let window = aEvent.currentTarget;
      window.removeEventListener("load", onLoad);
      let docElement = window.document.documentElement;
      if (docElement.getAttribute("windowtype") == "navigator:browser")
        this.onLoad(window);
    };
    aWindow.addEventListener("load", onLoad);

    aWindow.gTMPprefObserver.setLink_openPrefs();

    var existingWindow = this.getBrowserWindow(aWindow);
    // no navigator:browser window open yet?
    if (!existingWindow)
      return false;

    existingWindow.focus();
    // save dimensions
    var win = aWindow.document.documentElement;
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
    for (let attr of Object.keys(rect)) {
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
    var existingWindow = this.getBrowserWindow(newWindow);
    // no navigator:browser window open yet?
    if (!existingWindow)
      return;

    if (!newWindow.arguments || newWindow.arguments.length === 0)
      return;
    var args = newWindow.arguments;

    // don't close windows that was probably opened by extension
    if (args.length == 1 && args[0] === null) {
      this.restoreDimensionsAndPosition(newWindow, true);
      return;
    }

    var existingBrowser = existingWindow.gBrowser;
    existingWindow.Tabmix.tablib.init(); // just in case Tabmix.tablib isn't init yet
    var uriToLoad = args[0];

    var urls = [];
    var params = {
      referrerURI: null,
      referrerPolicy: (function() {
        if (TabmixSvc.version(390)) {
          let policy = TabmixSvc.version(490) ? "REFERRER_POLICY_UNSET" : "REFERRER_POLICY_DEFAULT";
          return Ci.nsIHttpChannel[policy];
        }
        return null;
      }()),
      postData: null,
      allowThirdPartyFixup: false
    };
    if (!TabmixSvc.version(520) && uriToLoad instanceof Ci.nsISupportsArray) {
      let count = uriToLoad.Count();
      for (let i = 0; i < count; i++) {
        let uriString = uriToLoad.GetElementAt(i).QueryInterface(Ci.nsISupportsString);
        urls.push(uriString.data);
      }
    } else if (uriToLoad instanceof Ci.nsIArray) {
      let count = uriToLoad.length;
      for (let i = 0; i < count; i++) {
        let uriString = uriToLoad.queryElementAt(i, Ci.nsISupportsString);
        urls.push(uriString.data);
      }
    } else if (uriToLoad instanceof newWindow.XULElement || uriToLoad instanceof Ci.nsIDOMXULElement) {
      // some extension try to swap a tab to new window
      // we don't do anything in this case.
      // just close the new window
    } else if (args.length >= 3) {
      params.referrerURI = args[2];
      if (TabmixSvc.version(390)) {
        if (typeof (params.referrerURI) == "string") {
          try {
            params.referrerURI = existingWindow.makeURI(params.referrerURI);
          } catch (e) {
            params.referrerURI = null;
          }
        }
        if (args[5] !== undefined)
          params.referrerPolicy = args[5];
      }
      params.postData = args[3] || null;
      params.allowThirdPartyFixup = args[4] || false;
      if (TabmixSvc.version(500)) {
        params.userContextId = args[6] != undefined ? args[6] :
          Ci.nsIScriptSecurityManager.DEFAULT_USER_CONTEXT_ID;
        params.originPrincipal = args[7];
        params.forceAboutBlankViewerInCurrent = Boolean(args[7]);
        params.triggeringPrincipal = args[8];
      }
      urls = [uriToLoad];
    } else {
      urls = uriToLoad ? uriToLoad.split("|") : ["about:blank"];
    }

    var firstTabAdded;
    try {
      // open the tabs in current window
      if (urls.length) {
        firstTabAdded = existingBrowser.selectedTab;
        let isBlankTab = existingBrowser.isBlankNotBusyTab(firstTabAdded);
        if (isBlankTab)
          existingWindow.openLinkIn(urls[0], "current", params);
        else
          firstTabAdded = existingBrowser.addTab(urls[0], params);
        for (let i = 1; i < urls.length; ++i)
          existingBrowser.addTab(urls[i]);
      }
    } catch (ex) { }
    try {
      // we need to close the window after timeout so other extensions don't fail.
      // if we don't add this here BrowserShutdown fails
      newWindow.FullZoom.init = function() {};
      newWindow.FullZoom.destroy = function() {};
      newWindow.OfflineApps.uninit = function() {};
      newWindow.IndexedDBPromptHelper.init();
      if (TabmixSvc.version(420)) {
        if ("gMenuButtonBadgeManager" in newWindow) {
          newWindow.gMenuButtonBadgeManager.uninit = function() {
            if (typeof PanelUI == "object" && PanelUI.panel) {
              PanelUI.panel.removeEventListener("popupshowing", this, true);
            }
          };
        }
      }
      if (!TabmixSvc.version(440)) {
        let obs = Services.obs;
        obs.addObserver(newWindow.gSessionHistoryObserver, "browser:purge-session-history", false);
        if (!TabmixSvc.version(340))
          obs.addObserver(newWindow.gFormSubmitObserver, "invalidformsubmit", false);
        obs.addObserver(newWindow.gXPInstallObserver, "addon-install-blocked", false);
        obs.addObserver(newWindow.gXPInstallObserver, "addon-install-failed", false);
        obs.addObserver(newWindow.gXPInstallObserver, "addon-install-complete", false);
        let pluginCrashed = TabmixSvc.version(400) ? "NPAPIPluginCrashed" : "pluginCrashed";
        obs.addObserver(newWindow.gPluginHandler[pluginCrashed], "plugin-crashed", false);
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
