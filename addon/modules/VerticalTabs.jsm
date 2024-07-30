"use strict";

const EXPORTED_SYMBOLS = ["VerticalTabs"];

const Services =
  globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
const {TabmixChromeUtils} = ChromeUtils.import("chrome://tabmix-resource/content/ChromeUtils.jsm");

const lazy = {};

TabmixChromeUtils.defineLazyModuleGetters(lazy, {
  setTimeout: "resource://gre/modules/Timer.jsm",
  TabmixSvc: "chrome://tabmix-resource/content/TabmixSvc.jsm",
});

var VerticalTabs = {
  init(window) {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this.onBeforeBrowserWindowShown(window);

    Services.prefs.addObserver("sidebar.verticalTabs", this);
    Services.obs.addObserver(this, "browser-window-before-show");
    Services.obs.addObserver(this, "quit-application");
  },

  observe(subject, topic, data) {
    switch (topic) {
      case "browser-window-before-show":
        this.onBeforeBrowserWindowShown(subject);
        break;
      case "nsPref:changed":
        this.onPrefChange(data);
        break;
      case "quit-application":
        this.onQuitApplication();
        break;
    }
  },

  onBeforeBrowserWindowShown(window) {
    if (window._tabmix_windowIsClosing) {
      // we close window on singleWindowMode
      return;
    }
    // this is a workaround until Firefox stop calling SidebarController.toggleTabstrip
    // when revamp did not loaded.
    const {SidebarController, Tabmix} = window;
    if (!SidebarController.revampComponentsLoaded) {
      // when `addObserver` is missing then the getter was already used and the
      // observer will always call the original function
      const isLazyGetter = SidebarController.__lookupGetter__("sidebarVerticalTabsEnabled")
          .toString()
          .includes("addObserver");
      if (!isLazyGetter) {
        return;
      }

      Tabmix.originalFunctions.SidebarController_toggleTabstrip = SidebarController.toggleTabstrip;
      SidebarController.toggleTabstrip = function(...args) {
        if (!SidebarController.revampComponentsLoaded) {
          // block original function if the sidebar did not initialized
          return;
        }
        Tabmix.originalFunctions.SidebarController_toggleTabstrip.apply(this, args);
      };
      // reset LazyPreferenceGetter
      delete SidebarController.sidebarVerticalTabsEnabled;
      const {XPCOMUtils} = ChromeUtils.importESModule("resource://gre/modules/XPCOMUtils.sys.mjs");
      XPCOMUtils.defineLazyPreferenceGetter(
        window.SidebarController,
        "sidebarVerticalTabsEnabled",
        "sidebar.verticalTabs",
        false,
        window.SidebarController.toggleTabstrip.bind(window.SidebarController)
      );
    }
  },

  onPrefChange(data) {
    if (data !== "sidebar.verticalTabs") {
      return;
    }

    const sidebarVerticalTabsEnabled = Services.prefs.getBoolPref("sidebar.verticalTabs");

    // save current pref value as a backup
    const pref = "extensions.tabmix.tabBarMode";
    const backupPref = `${pref}._backup`;
    if (sidebarVerticalTabsEnabled) {
      Services.prefs.setIntPref(backupPref, Services.prefs.getIntPref(pref));
    }

    // we need to run this changes after SidebarController pref observer runs toggleTabstrip
    lazy.setTimeout(() => {
      lazy.TabmixSvc.forEachBrowserWindow(window => {
        this.toggleTabstrip(window);
      });

      // restore tabBar mode after we set orient back to horizontal
      if (!sidebarVerticalTabsEnabled && Services.prefs.prefHasUserValue(backupPref)) {
        Services.prefs.setIntPref(pref, Services.prefs.getIntPref(backupPref));
        Services.prefs.clearUserPref(backupPref);
      }
    }, 0);
  },

  toggleTabstrip(window) {
    const {document, SidebarController, Tabmix, TabmixTabbar} = window;

    if (!SidebarController.revampComponentsLoaded) {
      return;
    }

    const tabmixScrollBox = document.getElementById("tabmix-scrollbox");

    if (SidebarController.sidebarVerticalTabsEnabled) {
      tabmixScrollBox.setAttribute("verticalTabs", true);
    } else {
      tabmixScrollBox.removeAttribute("verticalTabs");
      const useTabmixButtons =
        TabmixTabbar.scrollButtonsMode > TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT;
      Tabmix.tabsUtils.updateScrollButtons(useTabmixButtons);
    }
    Tabmix.tabsUtils.initializeTabmixUI();
  },

  onQuitApplication() {
    Services.prefs.removeObserver("sidebar.verticalTabs", this);
    Services.obs.removeObserver(this, "browser-window-before-show");
    Services.obs.removeObserver(this, "quit-application");
  },
};
