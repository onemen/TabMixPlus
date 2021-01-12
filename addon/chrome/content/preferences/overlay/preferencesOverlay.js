/* globals Preferences */
/* exported gTabMix_preferencesOverlay */
"use strict";

Components.utils.import("resource://tabmixplus/TabmixSvc.jsm");

var gTabMix_preferencesOverlay = {
  usePreferencesClass: false,

  id(id) {
    return document.getElementById(id);
  },

  getValueOf(id) {
    if (this.usePreferencesClass) {
      return Preferences.get(id).value;
    }
    return this.id(id).value;
  },

  addAllPreferences() {
    if (!TabmixSvc.version(590) || typeof Preferences != "object" ||
      typeof Preferences.addAll != "function") {
      return;
    }
    this.usePreferencesClass = true;
    Preferences.addAll([
      {id: "extensions.tabmix.hideTabbar", type: "int"},
      {id: "extensions.tabmix.tabs.warnOnClose", type: "bool"},
      {id: "extensions.tabmix.protectedtabs.warnOnClose", type: "bool"},
      {id: "extensions.tabmix.singleWindow", type: "bool"},
      {id: "extensions.tabmix.sessions.manager", type: "bool"},
      {id: "extensions.tabmix.sessions.crashRecovery", type: "bool"},
    ]);
  },

  incontentInit: function gTabMix_preferencesOverlay_incontentInit() {
    if (this.usePreferencesClass) {
      let singleWindow = Preferences.get("extensions.tabmix.singleWindow");
      singleWindow.on("change", this.setSingleWindowUI.bind(this));
      let sessionManager = Preferences.get("extensions.tabmix.sessions.manager");
      sessionManager.on("change", this.onStartupPrefChanged.bind(this));
      let crashRecovery = Preferences.get("extensions.tabmix.sessions.crashRecovery");
      crashRecovery.on("change", this.onStartupPrefChanged.bind(this));
    }

    var box = this.id("linkTargeting");
    box.collapsed = true;
    box.parentNode.insertBefore(this.id("tabmixplusBox"), box.parentNode.firstChild);

    var warnOnCloseWindow = this.id("warnOnCloseWindow");
    var warnCloseMultiple = this.id("warnCloseMultiple");
    warnCloseMultiple.setAttribute("preference", "extensions.tabmix.tabs.warnOnClose");
    warnOnCloseWindow.parentNode.insertBefore(warnCloseMultiple, warnOnCloseWindow);

    box = this.id("showTabsInTaskbar") || this.id("switchToNewTabs");
    box.parentNode.appendChild(this.id("hideTabbarBox"));

    var showTabBar = this.id("showTabBar");
    if (showTabBar)
      showTabBar.collapsed = true;

    if (TabmixSvc.version(260)) {
      let boxes = ["tabmixplusBox", "btn_tabmixplus", "generalWindowOpenBox",
        "warnOnCloseWindow", "warnOnCloseProtected", "hideTabbarBox"];
      boxes.forEach(function(id) {
        let item = this.id(id);
        item.removeAttribute("data-category");
        item.hidden = false;
        item.classList.remove("indent");
        item.classList.add("incontent_paneGeneral");
      }, this);
    }

    this.initMainPane();
    setTimeout(() => this.initPaneTabsOptions(), 0);
  },

  /* ........ paneTabs .............. */
  initPaneTabsOptions() {
    this.id("_hideTabbar").value = this.getValueOf("extensions.tabmix.hideTabbar");
    this.id("generalWindowOpen").value = this.getValueOf("browser.link.open_newwindow");
    this.id("warnCloseMultiple").checked = this.getValueOf("extensions.tabmix.tabs.warnOnClose");
    this.id("warnOnCloseWindow").checked = this.getValueOf("browser.tabs.warnOnClose");
    this.id("warnOnCloseProtected").checked = this.getValueOf("extensions.tabmix.protectedtabs.warnOnClose");
    this.setSingleWindowUI();
  },

  setSingleWindowUI() {
    var val = TabmixSvc.prefBranch.getBoolPref("singleWindow");
    let item = this.id("linkTargetWindow");
    item.disabled = val;
    if (val)
      item.setAttribute("style", "color: GrayText !important; text-shadow: none !important;");
    else
      item.removeAttribute("style");
  },

  showTabmixOptions(panel) {
    var windowMediator = Services.wm;
    var browserWindow = windowMediator.getMostRecentWindow('navigator:browser');

    if (!browserWindow) {
      let tabmixopt = windowMediator.getMostRecentWindow("mozilla:tabmixopt");
      if (tabmixopt)
        tabmixopt.close();
      let title = TabmixSvc.getString("tabmixoption.error.title");
      let msg = TabmixSvc.getString("tabmixoption.error.msg");
      Services.prompt.alert(window, title, msg);
    } else {
      browserWindow.Tabmix.openOptionsDialog(panel);
    }
  },

  /* ........ paneMain .............. */
  initMainPane() {
    var menuList = this.id("browserStartupPage");
    var hBox = menuList.parentNode;
    menuList.parentNode.id = "whenBrowserStartBox";
    hBox.insertBefore(this.id("tabmixSessionManager"), menuList);
    this.onStartupPrefChanged();
  },

  onStartupPrefChanged() {
    var tabmixSession = this.getValueOf("extensions.tabmix.sessions.manager") ||
      this.getValueOf("extensions.tabmix.sessions.crashRecovery");
    if (tabmixSession)
      this.id("whenBrowserStartBox").setAttribute("tabmixSession", true);
    else
      this.id("whenBrowserStartBox").removeAttribute("tabmixSession");
  }

};
