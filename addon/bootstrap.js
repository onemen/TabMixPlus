/* eslint no-var: 2, prefer-const: 2 */
/* exported install uninstall startup shutdown */
"use strict";

Components.utils.import("resource://gre/modules/Services.jsm");

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
overlay   chrome://browser/content/browser.xhtml                 chrome://tabmixplus/content/overlay/tabstoolbar.xhtml

overlay   about:addons                                           chrome://tabmixplus/content/preferences/overlay/aboutaddons.xhtml
`;

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
        window.BrowserUtils.restartApplication();
      }
    },
    [{
      label: 'Not Now',
      accessKey: 'N',
      callback: () => {},
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

function install() { }

function uninstall() { }

function startup(data, reason) {
  Components.utils.import("chrome://tabmixplus/content/ChromeManifest.jsm");
  Components.utils.import("chrome://tabmixplus/content/Overlays.jsm");
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
