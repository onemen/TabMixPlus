"use strict";

const EXPORTED_SYMBOLS = ["VerticalTabs"];

const Services = globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

const lazy = {};

ChromeUtils.defineModuleGetter(lazy, "TabmixSvc",
  "chrome://tabmix-resource/content/TabmixSvc.jsm");

var VerticalTabs = {
  init() {
    if (this._initialized)
      return;
    this._initialized = true;

    Services.prefs.addObserver("sidebar.revamp", this);
    Services.prefs.addObserver("sidebar.verticalTabs", this);
    Services.obs.addObserver(this, "quit-application");
  },

  observe(subject, topic, data) {
    switch (topic) {
      case "nsPref:changed":
        this.onPrefChange(data);
        break;
      case "quit-application":
        this.onQuitApplication();
        break;
    }
  },

  onPrefChange(data) {
    this._counter++;
    if (data !== "sidebar.verticalTabs" && data !== "sidebar.revamp") {
      return;
    }

    const revamp = Services.prefs.getBoolPref("sidebar.revamp");
    const verticalTabs = Services.prefs.getBoolPref("sidebar.verticalTabs");

    // save current pref value as a backup
    const pref = "extensions.tabmix.tabBarMode";
    const backupPref = `${pref}._backup`;
    if (data === "sidebar.verticalTabs" && verticalTabs) {
      Services.prefs.setIntPref(backupPref, Services.prefs.getIntPref(pref));
    }

    // this is workaround until SidebarController.toggleTabstrip prevent it
    if (!revamp && verticalTabs) {
      // verticalTabs set without revamp - set it back to false
      Services.prefs.setBoolPref("sidebar.verticalTabs", false);
      return;
    }

    if (data !== "sidebar.verticalTabs") {
      return;
    }

    lazy.TabmixSvc.forEachBrowserWindow(window => {
      const {document, gBrowser, SidebarController, Tabmix, TabmixTabbar} = window;

      const tabmixScrollBox = document.getElementById("tabmix-scrollbox");
      if (SidebarController?.sidebarVerticalTabsEnabled) {
        tabmixScrollBox.setAttribute("verticalTabs", true);
      } else {
        tabmixScrollBox.removeAttribute("verticalTabs", true);

        const tabBar = gBrowser.tabContainer;
        tabBar.setAttribute("orient", "horizontal");

        const toolbar = document.getElementById("TabsToolbar-customization-target");
        if (toolbar === tabBar.parentNode && tabmixScrollBox !== tabBar.nextSibling) {
          toolbar.insertBefore(tabBar, tabmixScrollBox);
        }

        const useTabmixButtons = TabmixTabbar.scrollButtonsMode > TabmixTabbar.SCROLL_BUTTONS_LEFT_RIGHT;
        Tabmix.tabsUtils.updateScrollButtons(useTabmixButtons);
      }
      Tabmix.tabsUtils.initializeTabmixUI();
    });

    // restore tabBar mode after we set orient back to horizontal
    if (!verticalTabs) {
      Services.prefs.setIntPref(pref, Services.prefs.getIntPref(backupPref, 1));
      Services.prefs.clearUserPref(backupPref);
    }
  },

  onQuitApplication() {
    Services.prefs.removeObserver("sidebar.revamp", this);
    Services.prefs.removeObserver("sidebar.verticalTabs", this);
    Services.obs.removeObserver(this, "quit-application");
  },
};

VerticalTabs.init();
