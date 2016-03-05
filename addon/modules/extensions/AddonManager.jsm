/**
 * original code by onemen
 */

"use strict";

this.EXPORTED_SYMBOLS = ["TabmixAddonManager"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://tabmixplus/Services.jsm");

const GOOGLE_REGEXP = /http(s)?:\/\/((www|encrypted|news|images)\.)?google\.(.*?)\/url\?/;
const GOOGLE_IMGRES_REGEXP = /http(s)?:\/\/(.*?\.)?google\.(.*?)\/imgres\?/;
const GOOGLE_PLUS_REGEXP = /http(s)?:\/\/plus.url.google.com\/url\?/;

// https://addons.mozilla.org/en-US/firefox/addon/tab-groups-panorama/
// check if TabView exist in a window and update our code if not initialized
// since more than one extension can replace panorama we check if we need to
// update the code after every extensions change
var TabGroups = {
  tabViewState: false,
  isUpdateNeeded: function() {
    let win = TabmixSvc.topWin();
    let needUpdate = typeof win.TabView == "object" &&
        !win.TabView.hasOwnProperty("tabmixInitialized");
    let currentState = this.tabViewState;
    this.tabViewState = needUpdate;
    return needUpdate && !currentState;
  },
  onEnabled: function() {
    if (this.isUpdateNeeded()) {
      TabmixSvc.forEachBrowserWindow(function(aWindow) {
        aWindow.TMP_TabView.init();
      });
    }
  },
  onDisabled: function() {
  },
};

// https://addons.mozilla.org/en-US/firefox/addon/google-no-tracking-url/
var GoogleNoTrackingUrl = {
  id: "jid1-zUrvDCat3xoDSQ@jetpack",
  onEnabled: function() {
    const pref = "extensions." + this.id + "aggresiveGoogleImagesCleanup";
    TabmixSvc.isFixedGoogleUrl = function(url) {
      const aggresiveWithImageUrls = TabmixSvc.prefs.get(pref, false);
      const isSearchResult = GOOGLE_REGEXP.test(url);
      const isImageSearchResult = GOOGLE_IMGRES_REGEXP.test(url);
      const isGooglePlusRedirect = GOOGLE_PLUS_REGEXP.test(url);

      return isSearchResult || isGooglePlusRedirect ||
        isImageSearchResult && aggresiveWithImageUrls;
    };
  },
  onDisabled: function() {
    TabmixSvc.isFixedGoogleUrl = () => false;
  },
};

// https://addons.mozilla.org/en-US/firefox/addon/private-tab
var PrivateTab = {
  id: "privateTab@infocatcher",
  onEnabled: function() {
    this._resetNewTabButton();
  },
  onDisabled: function() {
    this._resetNewTabButton();
  },
  _resetNewTabButton: function() {
    TabmixSvc.forEachBrowserWindow(function(aWindow) {
      aWindow.TMP_eventListener.updateMultiRow(true);
    });
  }
};

var SessionManager = {
  id: "{1280606b-2510-4fe0-97ef-9b5a22eafe30}",
  init: function() {
    this._saveTabmixPrefs();
    TabmixSvc.sessionManagerAddonInstalled = true;
  },
  _saveTabmixPrefs: function() {
    this.manager_enabled = TabmixSvc.prefBranch.getBoolPref("sessions.manager");
    this.crashRecovery_enabled = TabmixSvc.prefBranch.getBoolPref("sessions.crashRecovery");
  },
  onEnabled: function() {
    TabmixSvc.sessionManagerAddonInstalled = true;
    this._saveTabmixPrefs();
    let win = TabmixSvc.topWin();
    if (win)
      win.TMP_SessionStore.setService(-1);
    this._notify(true);
  },
  onDisabled: function() {
    TabmixSvc.sessionManagerAddonInstalled = false;
    if (this.manager_enabled || this.crashRecovery_enabled) {
      let win = TabmixSvc.topWin();
      if (win)
        win.TMP_SessionStore.setSessionRestore(false);
      TabmixSvc.prefBranch.setBoolPref("sessions.manager", this.manager_enabled);
      TabmixSvc.prefBranch.setBoolPref("sessions.crashRecovery", this.crashRecovery_enabled);
    }
    this._notify(false);
  },
  _notify: function(isActive) {
    // in preference/session.js we only care when the preference is boolean
    let pref = "sessionManagerAddon.isActive";
    TabmixSvc.prefBranch.setBoolPref(pref, isActive);
    TabmixSvc.prefBranch.clearUserPref(pref);
  }
};

var TabmixListener = {
  init: function(id) {
    if (id == SessionManager.id) {
      SessionManager.init();
    } else if (id == GoogleNoTrackingUrl.id) {
      GoogleNoTrackingUrl.onEnabled();
    } else {
      TabGroups.onEnabled();
    }
  },
  onChange: function(aAddon, aAction) {
    let id = aAddon.id;
    if (id == SessionManager.id)
      SessionManager[aAction]();
    else if (id == PrivateTab.id) {
      PrivateTab[aAction]();
    } else if (id == GoogleNoTrackingUrl.id) {
      GoogleNoTrackingUrl[aAction]();
    } else {
      TabGroups[aAction]();
    }
  },
  onEnabled: function(aAddon) {
    this.onChange(aAddon, "onEnabled");
  },
  onDisabled: function(aAddon) {
    this.onChange(aAddon, "onDisabled");
  },
  onInstalled: function(aAddon) {
    if (!aAddon.isActive || aAddon.userDisabled || aAddon.appDisabled)
      return;
    this.onEnabled(aAddon);
  }
};

var TabmixAddonManager = {
  initialized: false,
  init: function() {
    if (this.initialized)
      return;
    this.initialized = true;

    AddonManager.addAddonListener(TabmixListener);
    AddonManager.getAddonsByTypes(["extension"], function(addons) {
      addons.forEach(addon => {
        if (addon.isActive) {
          TabmixListener.init(addon.id);
        }
      });
    });
  }
};

TabmixAddonManager.init();
