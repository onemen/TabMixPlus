const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  TabmixSvc: "chrome://tabmix-resource/content/TabmixSvc.sys.mjs",
});

export const VerticalTabs = {
  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

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
    const {document, gBrowser, SidebarController, Tabmix, TabmixTabbar} = window;

    if (!SidebarController.revampComponentsLoaded) {
      return;
    }

    const tabmixScrollBox = document.getElementById("tabmix-scrollbox");

    if (SidebarController.sidebarVerticalTabsEnabled) {
      tabmixScrollBox.setAttribute("verticalTabs", true);
      gBrowser.tabContainer.arrowScrollbox.resetFirstTabInRow();
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
    Services.obs.removeObserver(this, "quit-application");
  },
};
