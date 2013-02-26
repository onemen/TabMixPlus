var gTabMix_preferencesOverlay = {
  id: function(id) {return document.getElementById(id);},
  incontentInit: function gTabMix_preferencesOverlay_incontentInit(aEvent) {
    var box = this.id("linkTargeting");
    box.parentNode.insertBefore(this.id("tabmixplusBox"), box);

    var warnOnCloseWindow = this.id("warnOnCloseWindow");
    warnOnCloseWindow.parentNode.insertBefore(this.id("warnCloseMultiple"), warnOnCloseWindow);

    box = this.id("showTabsInTaskbar").nextSibling;
    box.parentNode.insertBefore(this.id("_hideTabbar").parentNode, box);

    this.onPaneMainLoad();
    document.getElementById("startupGroup").setAttribute("incontent", true);
  },

   init: function gTabMix_preferencesOverlay_init(aEvent) {
      var prefWindow = aEvent.target.documentElement;

      this.onPaneLoad(prefWindow.lastSelected);

      Tabmix.newCode(null, prefWindow.showPane)._replace(
        'if (!aPaneElement.loaded) {', ''
      )._replace(
        'OverlayLoadObserver.prototype',
        'if (!aPaneElement.loaded) {\
         $&'
      )._replace(
        'this._outer._selectPane(this._pane);',
        '$& \
         gTabMix_preferencesOverlay.onPaneLoad(this._pane.id);'
      ).toCode(false, prefWindow, "showPane");

      Tabmix.newCode("openLinkIn", openLinkIn)._replace(
        'var w = getTopWin();',
        '$& \
         if (w && where == "window" && Tabmix.prefs.getBoolPref("singleWindow")) where = "tab";'
      ).toCode();

   },

   onPaneLoad: function gTabMix_preferencesOverlay_onPaneLoad(aPaneID) {
      switch (aPaneID) {
         case "paneTabs":
            this.loadOverlay();
         break;
         case "panePrivacy":
            this.onPanePrivacyLoad();
         break;
         case "paneMain":
            this.onPaneMainLoad();
         break;
         default:
      }
   },

/* ........ paneTabs .............. */
   loadOverlay: function () {
      function OverlayLoadObserver() { }
      OverlayLoadObserver.prototype = {
         _outer: this,
         observe: function (aSubject, aTopic, aData) {
            this._outer._afterOverlayLoaded();
         }
      };
      var obs = new OverlayLoadObserver();
      document.loadOverlay("chrome://tabmixplus/content/pref/tab_panel.xul", obs);
   },

   _afterOverlayLoaded: function () {
      document.getElementById("_hideTabbar").value = document.getElementById("extensions.tabmix.hideTabbar").value;
      document.getElementById("generalWindowOpen").value = document.getElementById("browser.link.open_newwindow").value;
      document.getElementById("warnCloseMultiple").checked = document.getElementById("extensions.tabmix.tabs.warnOnClose").value;
      document.getElementById("warnOnCloseWindow").checked = document.getElementById("browser.tabs.warnOnClose").value;
      document.getElementById("warnOnCloseProtected").checked = document.getElementById("extensions.tabmix.protectedtabs.warnOnClose").value;
      var singleWindowMode = Tabmix.prefs.getBoolPref("singleWindow");
      if (singleWindowMode)
         document.getElementById("linkTargetWindow").disabled = true;
      if (document.getElementById('BrowserPreferences')._shouldAnimate)
         window.sizeToContent();
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
         browserWindow.Tabmix.openOptionsDialog(panel == null ? -1 : panel);
   },

/* ........ panePrivacy .............. */
   onPanePrivacyLoad: function () {
       var clearDataNow = document.getElementById("clearDataNow");
       if (clearDataNow)
          clearDataNow.setAttribute("oncommand", clearDataNow.getAttribute("oncommand") + " Tabmix.Sanitizer.tryToSanitize();");
   },

/* ........ paneMain .............. */
   onPaneMainLoad: function () {
     var button = document.getElementById("tabmixSessionManager");
     if (button)
       return;

     if (!Tabmix.isVersion(180))
     Tabmix.newCode(null, gMainPane.showAddonsMgr)._replace(
       'openUILinkIn("about:addons", "window");',
       'var w = Tabmix.getTopWin();\
       if (w) w.BrowserOpenAddonsMgr();\
       else $&', {silent: true}
     ).toCode(false, gMainPane, "showAddonsMgr");

     button = document.createElement("button");
     button.id = "tabmixSessionManager";
     button.setAttribute("label", tabmixButton_label);
     button.setAttribute("oncommand", "gTabMix_preferencesOverlay.showTabmixOptions(5);");
     button.setAttribute("class", "tabmixplus-button");
     var menuList = document.getElementById("browserStartupPage");
     var hBox = menuList.parentNode;
     var spacer = document.createElement("spacer");
     spacer.setAttribute("flex", "1");
     hBox.insertBefore(spacer, menuList);
     hBox.insertBefore(button, menuList);

     var preferences = document.getElementById("mainPreferences");
     var preference = document.createElement("preference");
     preference.setAttribute("id", "tabmix.sm");
     preference.setAttribute("name", "extensions.tabmix.sessions.manager");
     preference.setAttribute("type", "bool");
     preference.setAttribute("onchange", "gTabMix_preferencesOverlay.onStartupPrefchanged();");
     preferences.appendChild(preference);

     preference = document.createElement("preference");
     preference.setAttribute("id", "tabmix.cr");
     preference.setAttribute("name", "extensions.tabmix.sessions.crashRecovery");
     preference.setAttribute("type", "bool");
     preference.setAttribute("onchange", "gTabMix_preferencesOverlay.onStartupPrefchanged();");
     preferences.appendChild(preference);
     this.onStartupPrefchanged();
   },

   onStartupPrefchanged: function () {
     var tabmixSession =  document.getElementById('tabmix.sm').value || document.getElementById('tabmix.cr').value;
     document.getElementById("browserStartupPage").collapsed = tabmixSession;
     var button = document.getElementById("tabmixSessionManager");
     button.collapsed = !tabmixSession;
     button.previousSibling.collapsed = !tabmixSession;
     document.getElementById("startupGroup").setAttribute("tabmixbutton", tabmixSession);
   }

}
