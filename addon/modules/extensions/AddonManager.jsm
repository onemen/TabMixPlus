/**
 * original code by onemen
 */
"use strict";

this.EXPORTED_SYMBOLS = ["TabmixAddonManager"];

const {AddonManager} = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");
const {TabmixSvc} = ChromeUtils.import("chrome://tabmix-resource/content/TabmixSvc.jsm");

const GOOGLE_REGEXP = /http(s)?:\/\/((www|encrypted|news|images)\.)?google\.(.*?)\/url\?/;
const GOOGLE_IMGRES_REGEXP = /http(s)?:\/\/(.*?\.)?google\.(.*?)\/imgres\?/;
const GOOGLE_PLUS_REGEXP = /http(s)?:\/\/plus.url.google.com\/url\?/;

// https://addons.mozilla.org/en-US/firefox/addon/tab-groups-panorama/
// check if TabView exist in a window and update our code if not initialized
// since more than one extension can replace panorama we check if we need to
// update the code after every extensions change
var TabGroups = {
  tabViewState: false,
  isUpdateNeeded() {
    let win = TabmixSvc.topWin();
    let needUpdate = typeof win.TabView == "object" &&
        !win.TabView.hasOwnProperty("tabmixInitialized");
    let currentState = this.tabViewState;
    this.tabViewState = needUpdate;
    return needUpdate && !currentState;
  },
  onEnabled() {
    if (this.isUpdateNeeded()) {
      TabmixSvc.forEachBrowserWindow(aWindow => {
        aWindow.TMP_TabView.init();
      });
    }
  },
  onDisabled() {
  },
};

// https://addons.mozilla.org/en-US/firefox/addon/google-no-tracking-url/
var GoogleNoTrackingUrl = {
  id: "jid1-zUrvDCat3xoDSQ@jetpack",
  onEnabled() {
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
  onDisabled() {
    TabmixSvc.isFixedGoogleUrl = () => false;
  },
};

// https://addons.mozilla.org/en-US/firefox/addon/private-tab
var PrivateTab = {
  id: "privateTab@infocatcher",
  onEnabled() {
    this._resetNewTabButton();
  },
  onDisabled() {
    this._resetNewTabButton();
  },
  _resetNewTabButton() {
    TabmixSvc.forEachBrowserWindow(aWindow => {
      aWindow.TMP_eventListener.updateMultiRow(true);
    });
  }
};

// noinspection SpellCheckingInspection
const SMID = "{1280606b-2510-4fe0-97ef-9b5a22eafe30}";
var SessionManager = {
  id: SMID,
  init() {
    TabmixSvc.sessionManagerAddonInstalled = true;
  },
  onEnabled() {
    TabmixSvc.sessionManagerAddonInstalled = true;
  },
  onDisabled() {
    TabmixSvc.sessionManagerAddonInstalled = false;
  },
};

var Glitter = {
  id: "glitterdrag@harytfw",
  onEnabled() {
    TabmixSvc.isGlitterInstalled = true;
  },
  onDisabled() {
    TabmixSvc.isGlitterInstalled = false;
  },
};

var TabmixListener = {
  init(id) {
    if (id == SessionManager.id) {
      SessionManager.init();
    } else if (id == GoogleNoTrackingUrl.id) {
      GoogleNoTrackingUrl.onEnabled();
    } else if (id == Glitter.id) {
      Glitter.onEnabled();
    } else {
      TabGroups.onEnabled();
    }
  },
  onChange(aAddon, aAction) {
    let id = aAddon.id;
    if (id == SessionManager.id)
      SessionManager[aAction]();
    else if (id == PrivateTab.id) {
      PrivateTab[aAction]();
    } else if (id == GoogleNoTrackingUrl.id) {
      GoogleNoTrackingUrl[aAction]();
    } else if (id == Glitter.id) {
      Glitter[aAction]();
    } else {
      TabGroups[aAction]();
    }
  },
  onEnabled(aAddon) {
    this.onChange(aAddon, "onEnabled");
  },
  onDisabled(aAddon) {
    this.onChange(aAddon, "onDisabled");
  },
  onInstalled(aAddon) {
    if (!aAddon.isActive || aAddon.userDisabled || aAddon.appDisabled)
      return;
    this.onEnabled(aAddon);
  }
};

var TabmixAddonManager = {
  initialized: false,
  init() {
    if (this.initialized)
      return;
    this.initialized = true;

    AddonManager.addAddonListener(TabmixListener);
    AddonManager.getAddonsByTypes(["extension"]).then(addons => {
      addons.forEach(addon => {
        if (addon.isActive) {
          TabmixListener.init(addon.id);
        }
      });
    });
  }
};

TabmixAddonManager.init();
