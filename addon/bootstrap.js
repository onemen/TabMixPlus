/// <reference types="../@types/bootstrap.d.ts" />

/* exported install, uninstall, startup, shutdown */
"use strict";

ChromeUtils.defineESModuleGetters(this, {
  AddonManager: "resource://gre/modules/AddonManager.sys.mjs",
  getGlobal: "chrome://tabmix-resource/content/globalAccess.sys.mjs",
  Overlays: "chrome://tabmix-resource/content/bootstrap/Overlays.sys.mjs",
  PreferencesLoader: "chrome://tabmix-resource/content/bootstrap/PreferencesLoader.sys.mjs",
  ScriptsLoader: "chrome://tabmix-resource/content/bootstrap/ScriptsLoader.sys.mjs",
  TabmixWidgets: "chrome://tabmix-resource/content/bootstrap/TabmixWidgets.sys.mjs",
});

const chromeManifest = {
  // prettier-ignore
  overlay: new Map([
    ["chrome://browser/content/browser.xhtml", ["chrome://tabmixplus/content/tabmix.xhtml"]],
    ["about:addons", ["chrome://tabmixplus/content/preferences/overlay/aboutaddons.xhtml"]],
    ["chrome://browser/content/sidebar/sidebar-bookmarks.html", ["chrome://tabmixplus/content/places/places.xhtml"]],
    ["chrome://browser/content/places/bookmarksSidebar.xhtml", ["chrome://tabmixplus/content/places/places.xhtml"]],
    ["chrome://browser/content/sidebar/sidebar-history.html", ["chrome://tabmixplus/content/places/places.xhtml"]],
    ["chrome://browser/content/places/historySidebar.xhtml", ["chrome://tabmixplus/content/places/places.xhtml"]],
    ["chrome://browser/content/places/places.xhtml", ["chrome://tabmixplus/content/places/places.xhtml"]],
  ]),
  style: new Map(),
};

/*
 * restartApplication: Restarts the application, keeping it in
 * safe mode if it is already in safe mode.
 */
/** @type {typeof Bootstrap.restartApplication} */
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

/** @type {typeof Bootstrap.showRestartNotification} */
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
        callback: () => {},
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

/*
 * toggle content script listeners for the case user disabled the extension
 * without restart
 */
/** @type {typeof Bootstrap.toggleContentListeners} */
function toggleContentListeners(enabled) {
  const enumerator = Services.wm.getEnumerator("navigator:browser");
  while (enumerator.hasMoreElements()) {
    const win = enumerator.getNext();
    if (win.gBrowser) {
      for (const browser of win.gBrowser.browsers) {
        browser.messageManager.sendAsyncMessage("Tabmix:toggleContentListeners", {
          enabled,
        });
      }
    }
  }
}

/** @type {typeof Bootstrap.updateAddon} */
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

/** @type {typeof Bootstrap.install} */
async function install(data) {
  await updateAddon(data.id);
}

function uninstall() {
  Overlays.setEnabled(false);
}

/** @type {typeof Bootstrap.startup} */
async function startup(data, reason) {
  Overlays.setEnabled(true);

  /** @type {any} */
  const lazy = {};

  // TODO: move this to the top ChromeUtils.defineESModuleGetters
  ChromeUtils.defineESModuleGetters(lazy, {
    isVersion: "chrome://tabmix-resource/content/BrowserVersion.sys.mjs",
    SingleWindowModeUtils: "chrome://tabmix-resource/content/SingleWindowModeUtils.sys.mjs",
  });

  updateAddon(data.id);

  PreferencesLoader.loadDefaultPreferences();
  TabmixWidgets.create();

  if (reason === ADDON_ENABLE) {
    toggleContentListeners(true);
  }

  const window = Services.wm.getMostRecentWindow("navigator:browser");
  if (reason === ADDON_UPGRADE || reason === ADDON_DOWNGRADE) {
    Services.appinfo.invalidateCachesOnRestart();
    showRestartNotification("upgraded", window);
    return;
  }

  /** @type {MockedGeckoTypes.PlacesUIUtils["openTabset"]} */
  let _tabmix_PlacesUIUtils_openTabset = () => {};
  if (lazy.isVersion({wf: "115.9.0"}) && !lazy.isVersion({wf: "153.0"})) {
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
        /** @type {PromiseWithResolvers<void>} */
        const promiseOverlayLoaded = Promise.withResolvers();
        if (isBrowser) {
          ScriptsLoader.initForWindow(win, promiseOverlayLoaded.promise, {
            chromeManifest,
            isOverflow,
            isEnabled: true,
          });
        }
        Overlays.load(win, chromeManifest, promiseOverlayLoaded);
      }
    }
  }

  /** @type {DocumentObserver} */
  const documentInsertedObserver = {
    observe(document) {
      const win = getGlobal(document);
      if (win && document.documentElement?.getAttribute("windowtype") === "navigator:browser") {
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            const isSingleWindowMode = Services.prefs.getBoolPref("extensions.tabmix.singleWindow");
            if (isSingleWindowMode && lazy.SingleWindowModeUtils.newWindow(win)) {
              win._tabmix_windowIsClosing = true;
              return;
            }

            win._tabmix_PlacesUIUtils_openTabset = _tabmix_PlacesUIUtils_openTabset;

            /** @type {PromiseWithResolvers<void>} */
            const promiseOverlayLoaded = Promise.withResolvers();
            ScriptsLoader.initForWindow(win, promiseOverlayLoaded.promise);
            Overlays.load(win, chromeManifest, promiseOverlayLoaded);
          },
          {once: true}
        );
      }
    },
  };

  /** @type {DocumentObserver} */
  const documentObserver = {
    observe(document) {
      const win = getGlobal(document);
      if (win && document.documentElement) {
        const isBrowser =
          document.documentElement.getAttribute("windowtype") === "navigator:browser";
        if (!isBrowser) {
          Overlays.load(win, chromeManifest);
        }
      }
    },
  };

  // eslint-disable-next-line mozilla/balanced-observers
  Services.obs.addObserver(documentInsertedObserver, "initial-document-element-inserted");

  // eslint-disable-next-line mozilla/balanced-observers
  Services.obs.addObserver(documentObserver, "chrome-document-loaded");
}

/** @type {typeof Bootstrap.shutdown} */
function shutdown(data, reason) {
  Overlays.setEnabled(false);

  if (reason === ADDON_DISABLE || reason === ADDON_UNINSTALL) {
    toggleContentListeners(false);
  }

  const window = Services.wm.getMostRecentWindow("navigator:browser");
  if (reason === ADDON_DISABLE) {
    Services.appinfo.invalidateCachesOnRestart();
    showRestartNotification("disabled", window);
  } else if (reason === ADDON_UNINSTALL /* && window.Tabmix */) {
    Services.appinfo.invalidateCachesOnRestart();
    showRestartNotification("uninstalled", window);
  }

  TabmixWidgets.destroy(reason === ADDON_UNINSTALL);
}
