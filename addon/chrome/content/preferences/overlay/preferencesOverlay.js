"use strict";

Components.utils.import("resource://tabmixplus/Services.jsm");

var gTabMix_preferencesOverlay = { // jshint ignore:line
  id: function(id) {return document.getElementById(id);},

  incontentInit: function gTabMix_preferencesOverlay_incontentInit() {
    var box = this.id("linkTargeting");
    box.collapsed = true;
    box.parentNode.insertBefore(this.id("tabmixplusBox"), box);

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
    setTimeout(function(self) {
      self.initPaneTabsOptions();
    }, 0, this);
  },

/* ........ paneTabs .............. */
   initPaneTabsOptions: function () {
      this.id("_hideTabbar").value = this.id("extensions.tabmix.hideTabbar").value;
      this.id("generalWindowOpen").value = this.id("browser.link.open_newwindow").value;
      this.id("warnCloseMultiple").checked = this.id("extensions.tabmix.tabs.warnOnClose").value;
      this.id("warnOnCloseWindow").checked = this.id("browser.tabs.warnOnClose").value;
      this.id("warnOnCloseProtected").checked = this.id("extensions.tabmix.protectedtabs.warnOnClose").value;
      this.setSingleWindowUI();
   },

   setSingleWindowUI: function () {
     var val = TabmixSvc.prefBranch.getBoolPref("singleWindow");
     let item = this.id("linkTargetWindow");
     item.disabled = val;
     if (val)
       item.setAttribute("style", "color: graytext !important; text-shadow: none !important;");
     else
       item.removeAttribute("style");
   },

   showTabmixOptions: function (panel) {
      var windowMediator = Services.wm;
      var browserWindow = windowMediator.getMostRecentWindow('navigator:browser');

      if (!browserWindow) {
         let tabmixopt = windowMediator.getMostRecentWindow("mozilla:tabmixopt");
         if (tabmixopt)
            tabmixopt.close();
         let title = TabmixSvc.getString("tabmixoption.error.title");
         let msg = TabmixSvc.getString("tabmixoption.error.msg");
         Services.prompt.alert(window, title, msg);
      }
      else
         browserWindow.Tabmix.openOptionsDialog(panel);
   },

/* ........ paneMain .............. */
   initMainPane: function () {
     var menuList = this.id("browserStartupPage");
     var hBox = menuList.parentNode;
     menuList.parentNode.id = "whenBrowserStartBox";
     hBox.insertBefore(this.id("tabmixSessionManager"), menuList);
     this.onStartupPrefchanged();
   },

   onStartupPrefchanged: function () {
     var tabmixSession =  this.id('tabmix.sm').value || this.id('tabmix.cr').value;
     if (tabmixSession)
       this.id("whenBrowserStartBox").setAttribute("tabmixSession", true);
     else
       this.id("whenBrowserStartBox").removeAttribute("tabmixSession");
   }

};
