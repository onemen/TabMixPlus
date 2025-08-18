/// <reference types="../@types/bootstrap.d.ts" />

/* exported install, uninstall, startup, shutdown */
"use strict";

ChromeUtils.defineESModuleGetters(this, {
  AddonManager: "resource://gre/modules/AddonManager.sys.mjs",
  ChromeManifest: "chrome://tabmix-resource/content/bootstrap/ChromeManifest.sys.mjs",
  Overlays: "chrome://tabmix-resource/content/bootstrap/Overlays.sys.mjs",
  PreferencesLoader: "chrome://tabmix-resource/content/bootstrap/PreferencesLoader.sys.mjs",
  ScriptsLoader: "chrome://tabmix-resource/content/bootstrap/ScriptsLoader.sys.mjs",
  TabmixWidgets: "chrome://tabmix-resource/content/bootstrap/TabmixWidgets.sys.mjs",
});

const appinfo = Services.appinfo;
const options = {
  application: appinfo.ID,
  appversion: appinfo.version,
  platformversion: appinfo.platformVersion,
  os: appinfo.OS,
  osversion: Services.sysinfo.getProperty("version"),
  abi: appinfo.XPCOMABI,
};

const man = `
overlay   chrome://browser/content/browser.xhtml                 chrome://tabmixplus/content/tabmix.xhtml
overlay   about:addons                                           chrome://tabmixplus/content/preferences/overlay/aboutaddons.xhtml

overlay   chrome://browser/content/places/bookmarksSidebar.xhtml chrome://tabmixplus/content/places/places.xhtml
overlay   chrome://browser/content/places/historySidebar.xhtml   chrome://tabmixplus/content/places/places.xhtml
overlay   chrome://browser/content/places/places.xhtml           chrome://tabmixplus/content/places/places.xhtml
`;

/*
 * restartApplication: Restarts the application, keeping it in
 * safe mode if it is already in safe mode.
 */
/** @type {Bootstrap.restartApplication} */
function restartApplication() {
  const cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
  Services.obs.notifyObservers(cancelQuit, "quit-application-requested", "restart");
  if (cancelQuit.data) {
    // The quit request has been canceled.
    return false;
  }
  // if already in safe mode restart in safe mode
  if (Services.appinfo.inSafeMode) {
    Services.startup.restartInSafeMode(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
    return undefined;
  }
  Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
  return undefined;
}

let invalidateCachesOnRestart = false;

/** @type {Bootstrap.showRestartNotification} */
function showRestartNotification(verb, window) {
  if (!window.gBrowser.selectedBrowser) {
    return;
  }
  window.PopupNotifications._currentNotifications.shift();
  window.PopupNotifications.show(
    window.gBrowser.selectedBrowser,
    "addon-install-restart",
    "Tab Mix Plus has been " +
      verb +
      ", but a restart is required to " +
      (verb == "upgraded" || verb == "re-enabled" ? "enable" : "remove") +
      " add-on functionality.",
    "addons-notification-icon",
    {
      label: "Restart Now",
      accessKey: "R",
      callback() {
        Services.appinfo.invalidateCachesOnRestart();
        restartApplication();
      },
    },
    [
      {
        label: "Not Now",
        accessKey: "N",
        callback: () => {
          invalidateCachesOnRestart = true;
        },
      },
    ],
    {
      popupIconURL: "chrome://mozapps/skin/extensions/extension.svg",
      persistent: false,
      hideClose: true,
      timeout: window.performance.timeOrigin + window.performance.now() + 30000,
      removeOnDismissal: true,
    }
  );
}

/** @param {string} id */
async function updateAddon(id) {
  const addon = await AddonManager.getAddonByID(id);
  if (addon?.__AddonInternal__) {
    addon.__AddonInternal__.signedState = AddonManager.SIGNEDSTATE_NOT_REQUIRED;
    if (Services.appinfo.name === "Zen") {
      addon.__AddonInternal__.matchingTargetApplication.minVersion = "1.0";
      addon.__AddonInternal__.updateURL =
        "https://raw.githubusercontent.com/onemen/TabMixPlus/main/config/zen_updates.json";
    }
  }
}

/** @type {Bootstrap.install} */
async function install(data) {
  await updateAddon(data.id);
}

function uninstall() {}

/** @type {Bootstrap.startup} */
async function startup(data, reason) {
  /** @type {any} */
  const lazy = {};

  // TODO: move this to the top ChromeUtils.defineESModuleGetters
  ChromeUtils.defineESModuleGetters(lazy, {
    isVersion: "chrome://tabmix-resource/content/BrowserVersion.sys.mjs",
    SingleWindowModeUtils: "chrome://tabmix-resource/content/SingleWindowModeUtils.sys.mjs",
  });

  const chromeManifest = new ChromeManifest(() => {
    return man;
  }, options);
  await chromeManifest.parse();

  updateAddon(data.id);

  PreferencesLoader.loadDefaultPreferences();
  TabmixWidgets.create();

  const window = Services.wm.getMostRecentWindow("navigator:browser");
  if (reason === ADDON_UPGRADE || reason === ADDON_DOWNGRADE) {
    showRestartNotification("upgraded", window);
    return;
  }

  /** @type {MockedGeckoTypes.PlacesUIUtils["openTabset"]} */
  let _tabmix_PlacesUIUtils_openTabset = () => {};
  if (lazy.isVersion({wf: "115.9.0"})) {
    const PlacesUIUtilsURL =
      lazy.isVersion(1410) ?
        "moz-src:///browser/components/places/PlacesUIUtils.sys.mjs"
      : "resource:///modules/PlacesUIUtils.sys.mjs";
    const {PlacesUIUtils} = ChromeUtils.importESModule(PlacesUIUtilsURL);
    _tabmix_PlacesUIUtils_openTabset = PlacesUIUtils.openTabset;
  }

  if (reason === ADDON_INSTALL || (reason === ADDON_ENABLE && !window.Tabmix)) {
    const enumerator = Services.wm.getEnumerator(null);
    while (enumerator.hasMoreElements()) {
      const win = enumerator.getNext();
      const document = win.document;
      if (document.documentElement) {
        const isBrowser =
          document.documentElement.getAttribute("windowtype") === "navigator:browser";
        const isOverflow = isBrowser && win.gBrowser.tabContainer.hasAttribute("overflow");
        const promiseOverlayLoaded = Promise.withResolvers();
        if (isBrowser) {
          ScriptsLoader.initForWindow(win, promiseOverlayLoaded.promise, {
            chromeManifest,
            isOverflow,
            isEnabled: true,
          });
        }
        Overlays.load(chromeManifest, win, promiseOverlayLoaded);
      }
    }
  }

  /** @type {DocumentObserver} */
  const documentInsertedObserver = {
    observe(document) {
      if (
        document.ownerGlobal &&
        document.documentElement?.getAttribute("windowtype") === "navigator:browser"
      ) {
        const win = document.ownerGlobal;
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            const isSingleWindowMode = Services.prefs.getBoolPref("extensions.tabmix.singleWindow");
            if (isSingleWindowMode && lazy.SingleWindowModeUtils.newWindow(win)) {
              win._tabmix_windowIsClosing = true;
              return;
            }

            win._tabmix_PlacesUIUtils_openTabset = _tabmix_PlacesUIUtils_openTabset;

            const promiseOverlayLoaded = Promise.withResolvers();
            ScriptsLoader.initForWindow(win, promiseOverlayLoaded.promise);
            Overlays.load(chromeManifest, win, promiseOverlayLoaded);
          },
          {once: true}
        );
      }
    },
  };

  /** @type {DocumentObserver} */
  const documentObserver = {
    observe(document) {
      if (document.documentElement && document.ownerGlobal) {
        const isBrowser =
          document.documentElement.getAttribute("windowtype") === "navigator:browser";
        if (!isBrowser) {
          const win = document.ownerGlobal;
          Overlays.load(chromeManifest, win);
        }
      }
    },
  };

  // eslint-disable-next-line mozilla/balanced-observers
  Services.obs.addObserver(documentInsertedObserver, "initial-document-element-inserted");

  // eslint-disable-next-line mozilla/balanced-observers
  Services.obs.addObserver(documentObserver, "chrome-document-loaded");
}

/** @type {Bootstrap.shutdown} */
function shutdown(data, reason) {
  const window = Services.wm.getMostRecentWindow("navigator:browser");
  if (reason === ADDON_DISABLE) {
    showRestartNotification("disabled", window);
  } else if (reason === ADDON_UNINSTALL /* && window.Tabmix */) {
    showRestartNotification("uninstalled", window);
  } else if (invalidateCachesOnRestart) {
    Services.appinfo.invalidateCachesOnRestart();
    invalidateCachesOnRestart = false;
  }

  TabmixWidgets.destroy(reason === ADDON_UNINSTALL);
}
