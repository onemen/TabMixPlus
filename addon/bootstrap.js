/* global
  ADDON_ENABLE: false,
  ADDON_DISABLE: false,
  ADDON_DOWNGRADE: false,
  ADDON_INSTALL: false,
  ADDON_UNINSTALL: false,
  ADDON_UPGRADE: false,
*/
/* eslint-env tabmix/webExtensions */
/* eslint no-var: 2, prefer-const: 2 */
/* exported install uninstall startup shutdown */
"use strict";

const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {AddonManager} = ChromeUtils.import("resource://gre/modules/AddonManager.jsm");

ChromeUtils.defineModuleGetter(this, "ChromeManifest",
  "chrome://tabmix-resource/content/bootstrap/ChromeManifest.jsm");

ChromeUtils.defineModuleGetter(this, "Overlays",
  "chrome://tabmix-resource/content/bootstrap/Overlays.jsm");

ChromeUtils.defineModuleGetter(this, "TabmixWidgets",
  "chrome://tabmix-resource/content/bootstrap/TabmixWidgets.jsm");

const appinfo = Services.appinfo;
const options = {
  application: appinfo.ID,
  appversion: appinfo.version,
  platformversion: appinfo.platformVersion,
  os: appinfo.OS,
  osversion: Services.sysinfo.getProperty("version"),
  abi: appinfo.XPCOMABI
};

const man = `
overlay   chrome://browser/content/browser.xhtml                 chrome://tabmixplus/content/tabmix.xhtml
overlay   about:addons                                           chrome://tabmixplus/content/preferences/overlay/aboutaddons.xhtml

overlay   chrome://browser/content/places/bookmarksSidebar.xhtml chrome://tabmixplus/content/places/places.xhtml
overlay   chrome://browser/content/places/historySidebar.xhtml   chrome://tabmixplus/content/places/places.xhtml
overlay   chrome://browser/content/places/places.xhtml           chrome://tabmixplus/content/places/places.xhtml
`;

/**
 * restartApplication: Restarts the application, keeping it in
 * safe mode if it is already in safe mode.
 */
function restartApplication() {
  const cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
    Ci.nsISupportsPRBool
  );
  Services.obs.notifyObservers(
    cancelQuit,
    "quit-application-requested",
    "restart"
  );
  if (cancelQuit.data) {
    // The quit request has been canceled.
    return false;
  }
  // if already in safe mode restart in safe mode
  if (Services.appinfo.inSafeMode) {
    Services.startup.restartInSafeMode(
      Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
    );
    return undefined;
  }
  Services.startup.quit(
    Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
  );
  return undefined;
}

function showRestartNotification(verb, window) {
  window.PopupNotifications._currentNotifications.shift();
  window.PopupNotifications.show(
    window.gBrowser.selectedBrowser,
    'addon-install-restart',
    'Tab Mix Plus has been ' + verb + ', but a restart is required to ' + (verb == 'upgraded' || verb == 're-enabled' ? 'enable' : 'remove') + ' add-on functionality.',
    'addons-notification-icon',
    {
      label: 'Restart Now',
      accessKey: 'R',
      callback() {
        restartApplication();
      }
    },
    [{
      label: 'Not Now',
      accessKey: 'N',
      callback: () => { },
    }],
    {
      popupIconURL: 'chrome://tabmixplus/skin/addon-install-restart.svg',
      persistent: false,
      hideClose: true,
      timeout: Date.now() + 30000,
      removeOnDismissal: true
    }
  );
}

async function install(data) {
  const addon = await AddonManager.getAddonByID(data.id);
  if (addon?.__AddonInternal__) {
    addon.__AddonInternal__.signedState = AddonManager.SIGNEDSTATE_NOT_REQUIRED;
  }
}

function uninstall() { }

function startup(data, reason) {
  AddonManager.getAddonByID(data.id).then(addon => {
    if (addon?.__AddonInternal__) {
      addon.__AddonInternal__.signedState = AddonManager.SIGNEDSTATE_NOT_REQUIRED;
    }
  });

  TabmixWidgets.create();

  const window = Services.wm.getMostRecentWindow('navigator:browser');
  if (reason === ADDON_UPGRADE || reason === ADDON_DOWNGRADE) {
    showRestartNotification("upgraded", window);
    return;
  } /* else if (reason === ADDON_ENABLE && window.Tabmix) {
      showRestartNotification("re-enabled", window);
      return;
  } */

  if (reason === ADDON_INSTALL || (reason === ADDON_ENABLE && !window.Tabmix)) {
    const enumerator = Services.wm.getEnumerator(null);
    while (enumerator.hasMoreElements()) {
      const win = enumerator.getNext();

      (async function(_win) {
        const chromeManifest = new ChromeManifest(() => {
          return man;
        }, options);
        await chromeManifest.parse();
        const document = _win.document;
        if (document.createXULElement) {
          const isBrowser = document.documentElement.getAttribute("windowtype") === "navigator:browser";
          const isOverflow = isBrowser && _win.gBrowser.tabContainer.getAttribute("overflow");
          Overlays.load(chromeManifest, document.defaultView);
          if (isBrowser) {
            await _win.delayedStartupPromise;
            _win.gBrowser.tabs.forEach(x => {
              const browser = x.linkedBrowser;
              if (browser.currentURI.spec == 'about:addons' && browser.contentWindow) {
                Overlays.load(chromeManifest, browser.contentWindow);
              }
            });
            // verify our scroll buttons are visible on overflow
            if (isOverflow) {
              _win.Tabmix.tabsUtils.updateVerticalTabStrip();
            }
          }
        }
      }(win));
    }
  }

  (async function() {
    const chromeManifest = new ChromeManifest(() => {
      return man;
    }, options);
    await chromeManifest.parse();

    const documentObserver = {
      observe(document) {
        if (document.createXULElement) {
          if (document.documentElement.getAttribute("windowtype") === "navigator:browser") {
            document.defaultView.addEventListener("MozAfterPaint", () => {
              document.defaultView.gBrowserInit.tabmix_delayedStartupStarted = true;
            }, {once: true});
          }
          Overlays.load(chromeManifest, document.defaultView);
        }
      }
    };
    Services.obs.addObserver(documentObserver, "chrome-document-loaded");
  }());
}

function shutdown(data, reason) {
  const window = Services.wm.getMostRecentWindow('navigator:browser');
  if (reason === ADDON_DISABLE) {
    showRestartNotification("disabled", window);
  } else if (reason === ADDON_UNINSTALL /* && window.Tabmix */) {
    showRestartNotification("uninstalled", window);
  }

  TabmixWidgets.destroy(reason === ADDON_UNINSTALL);
}
