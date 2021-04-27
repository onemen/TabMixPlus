/* eslint no-var: 2, prefer-const: 2 */
/* exported install uninstall startup shutdown */
"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

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
  addon.__AddonInternal__.signedState = AddonManager.SIGNEDSTATE_NOT_REQUIRED;
}

function uninstall() { }

function startup(data, reason) {
  Components.utils.import("chrome://tabmix-resource/content/bootstrap/ChromeManifest.jsm");
  Components.utils.import("chrome://tabmix-resource/content/bootstrap/Overlays.jsm");
  Components.utils.import("resource:///modules/CustomizableUI.jsm");

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
        if (_win.document.createXULElement) {
          Overlays.load(chromeManifest, _win.document.defaultView);
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
}
