"use strict";

var TMPstyles = {
  init: function () {
    try {
      var index = Services.prefs.getIntPref("extensions.tabmix.appearance_tab");
    }
    catch (ex) { index = 0; }
    document.getElementById("stylestabs").selectedIndex = index;

    /* Chromifox theme force button height to 25px */
    var skin = Services.prefs.getCharPref("general.skins.selectedSkin");
    if (skin == "cfxec")
      document.getElementById("AppearanceTabBox").setAttribute("chromifox", true);
  },

  save: function () {
    Services.prefs.setIntPref("extensions.tabmix.appearance_tab", document.getElementById("stylestabs").selectedIndex);
    // store the pref immediately
    Services.prefs.savePrefFile(null);
  },

  cancel: function () {
    Array.forEach(document.getElementById("stylespanels").childNodes, function(panel) {
      document.getElementById(panel.id)._ondialogcancel();
    });
    this.save();
  },

  openHelp: function () {
    var subPage = ["Current_Tab", "Unloaded_tabs", "Unread_tabs", "Other_Tabs", "Progress_meter_on_tabs"];
    var index = document.getElementById("AppearanceTabBox").selectedIndex;
    window.opener.openHelp("Customize_Styles_-_" + subPage[index]);
  }
}
