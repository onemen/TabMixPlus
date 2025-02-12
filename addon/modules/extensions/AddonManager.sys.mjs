/**
 * original code by onemen
 */

import {TabmixSvc} from "chrome://tabmix-resource/content/TabmixSvc.sys.mjs";
import {AddonManager} from "resource://gre/modules/AddonManager.sys.mjs";

const GOOGLE_REGEXP = /http(s)?:\/\/((www|encrypted|news|images)\.)?google\.(.*?)\/url\?/;
const GOOGLE_IMGRES_REGEXP = /http(s)?:\/\/(.*?\.)?google\.(.*?)\/imgres\?/;
const GOOGLE_PLUS_REGEXP = /http(s)?:\/\/plus.url.google.com\/url\?/;

// https://addons.mozilla.org/en-US/firefox/addon/google-no-tracking-url/
var GoogleNoTrackingUrl = {
  id: "jid1-zUrvDCat3xoDSQ@jetpack",
  onEnabled() {
    const pref = "extensions." + this.id + "aggresiveGoogleImagesCleanup";
    TabmixSvc.isFixedGoogleUrl = function(url) {
      const aggressiveWithImageUrls = TabmixSvc.prefs.get(pref, false);
      const isSearchResult = GOOGLE_REGEXP.test(url);
      const isImageSearchResult = GOOGLE_IMGRES_REGEXP.test(url);
      const isGooglePlusRedirect = GOOGLE_PLUS_REGEXP.test(url);

      return isSearchResult || isGooglePlusRedirect ||
        isImageSearchResult && aggressiveWithImageUrls;
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
    if (id == GoogleNoTrackingUrl.id) {
      GoogleNoTrackingUrl.onEnabled();
    } else if (id == Glitter.id) {
      Glitter.onEnabled();
    }
  },
  onChange(aAddon, aAction) {
    let id = aAddon.id;
    if (id == PrivateTab.id) {
      PrivateTab[aAction]();
    } else if (id == GoogleNoTrackingUrl.id) {
      GoogleNoTrackingUrl[aAction]();
    } else if (id == Glitter.id) {
      Glitter[aAction]();
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

export const TabmixAddonManager = {
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
