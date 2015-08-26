"use strict";

var EXPORTED_SYMBOLS = ["SingleWindowModeUtils"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://tabmixplus/Services.jsm");

this.SingleWindowModeUtils = {
  initialized: false,
  initService: function() {
    if (this.initialized)
      return;
    this.initialized = true;

    if (TabmixSvc.version(200))
      Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
  },

 /**
  * @brief Locate a browser window.
  *
  * @param aExclude  A scripted window object that we do not want to use.
  *
  * @returns         A scripted window object representing a browser
  *                  window that is not the same as aExclude, and is
  *                  additionally not a popup window.
  */
  getBrowserWindow: function(aExclude) {
    // on per-window private browsing mode,
    // allow to open one normal window and one private window in single window mode
    var checkPrivacy = TabmixSvc.version(200);
    var isPrivate = checkPrivacy && PrivateBrowsingUtils.isWindowPrivate(aExclude);

    function isSuitableBrowserWindow(win) {
      return (!win.closed && win.document.readyState == "complete" &&
              win.toolbar.visible && win != aExclude &&
              (!checkPrivacy ||
                PrivateBrowsingUtils.isWindowPrivate(win) == isPrivate));
    }

    var windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      let win = windows.getNext();
      if (isSuitableBrowserWindow(win))
        return win;
    }
    return null;
  },

  newWindow: function(aWindow) {
    if (!aWindow.Tabmix.singleWindowMode)
      return;

    if (!aWindow.arguments || aWindow.arguments.length === 0)
      return;

    this.initService();
    var _this = this;
    aWindow.addEventListener("load", function _onLoad(aEvent) {
      let win = aEvent.currentTarget;
      win.removeEventListener("load", _onLoad, false);
      let docElement = win.document.documentElement;
      if (docElement.getAttribute("windowtype") == "navigator:browser")
        _this.onLoad(win);
    }, false);

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
    win.setAttribute("width" , 0);
    win.setAttribute("height" , 0);
    win.setAttribute("screenX" , aWindow.screen.availWidth + 10);
    win.setAttribute("screenY" , aWindow.screen.availHeight + 10);

    return true;
  },

  onLoad: function(newWindow) {
    var existingWindow = this.getBrowserWindow(newWindow);
    // no navigator:browser window open yet?
    if (!existingWindow)
      return;

    if (!newWindow.arguments || newWindow.arguments.length === 0)
      return;
    var args = newWindow.arguments;

    var existingBrowser = existingWindow.gBrowser;
    existingWindow.tablib.init(); // just in case tablib isn't init yet
    var uriToLoad = args[0];
    var urls = [];
    var params = {
      referrerURI: null,
      referrerPolicy: TabmixSvc.version(390) && Ci.nsIHttpChannel.REFERRER_POLICY_DEFAULT,
      postData: null,
      allowThirdPartyFixup: false
    };
    if (uriToLoad instanceof Ci.nsISupportsArray) {
      let count = uriToLoad.Count();
      for (let i = 0; i < count; i++) {
        let urisstring = uriToLoad.GetElementAt(i).QueryInterface(Ci.nsISupportsString);
        urls.push(urisstring.data);
      }
    }
    else if (uriToLoad instanceof newWindow.XULElement || uriToLoad instanceof Ci.nsIDOMXULElement) {
      // some extension try to swap a tab to new window
      // we don't do anything in this case.
      // just close the new window
    }
    else if (args.length >= 3) {
      params.referrerURI = args[2];
      if (TabmixSvc.version(390)) {
        if (typeof(params.referrerURI) == "string") {
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
      urls = [uriToLoad];
    }
    else
      urls = uriToLoad ? uriToLoad.split("|") : ["about:blank"];

    try {
      // open the tabs in current window
      if (urls.length) {
        var firstTabAdded = existingBrowser.selectedTab;
        let isBlankTab = existingBrowser.isBlankNotBusyTab(firstTabAdded);
        if (isBlankTab)
          existingWindow.openLinkIn(urls[0], "current", params);
        else
          firstTabAdded = existingBrowser.addTab(urls[0], params);
        for (let i = 1; i < urls.length; ++i)
          existingBrowser.addTab(urls[i]);
      }
    } catch(ex) {  }
    try {
      // we need to close the window after timeout so other extensions don't fail.
      // if we don't add this here BrowserShutdown fails
      newWindow.FullZoom.init = function() {};
      newWindow.FullZoom.destroy = function() {};
      if (!TabmixSvc.version(230)) {
        newWindow.PlacesStarButton.updateState = function() {};
        newWindow.PlacesStarButton.uninit = function() {};
      }
      newWindow.OfflineApps.uninit = function() {};
      var obs = Services.obs;
      obs.addObserver(newWindow.gSessionHistoryObserver, "browser:purge-session-history", false);
      if (!TabmixSvc.version(340))
        obs.addObserver(newWindow.gFormSubmitObserver, "invalidformsubmit", false);
      newWindow.IndexedDBPromptHelper.init();
      obs.addObserver(newWindow.gXPInstallObserver, "addon-install-blocked", false);
      obs.addObserver(newWindow.gXPInstallObserver, "addon-install-failed", false);
      obs.addObserver(newWindow.gXPInstallObserver, "addon-install-complete", false);
      let pluginCrashed = TabmixSvc.version(400) ? "NPAPIPluginCrashed" : "pluginCrashed";
      obs.addObserver(newWindow.gPluginHandler[pluginCrashed], "plugin-crashed", false);
      newWindow.gPrivateBrowsingUI.uninit = function() {};
      existingWindow.setTimeout(function () {
        // restore window dimensions, to prevent flickring in the next restart
        var win = newWindow.document.documentElement;
        if (typeof newWindow.__winRect == "object") {
          for (let attr in newWindow.__winRect)
            win.setAttribute(attr, newWindow.__winRect[attr]);
        }
        newWindow.close();
        if (firstTabAdded) {
          existingBrowser.selectedTab = firstTabAdded;
          existingBrowser.ensureTabIsVisible(firstTabAdded);
        }
        // for the case the window is minimized or not in focus
        existingWindow.focus();
      },0);
    }  catch(ex) {existingWindow.Tabmix.obj(ex);}
  }
};
