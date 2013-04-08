"use strict";

function $(id) document.getElementById(id);

let tabstyles = {
  pref: "appearance_tab",
  init: function () {
    $("stylestabs").selectedIndex = Tabmix.prefs.prefHasUserValue(this.pref) ?
        Tabmix.prefs.getIntPref(this.pref) : 0;

    /* Chromifox theme force button height to 25px */
    var skin = Services.prefs.getCharPref("general.skins.selectedSkin");
    if (skin == "cfxec")
      $("AppearanceTabBox").setAttribute("chromifox", true);

    if (!window.opener && !Tabmix.getTopWin())
      document.documentElement.getButton("help").disabled = true;
  },

  save: function () {
    Tabmix.prefs.setIntPref(this.pref, $("stylestabs").selectedIndex);
    // store the pref immediately
    Services.prefs.savePrefFile(null);
  },

  cancel: function () {
    Array.forEach($("stylespanels").childNodes, function(panel) {
      $(panel.id)._ondialogcancel();
    });
    this.save();
  },

  openHelp: function () {
    var subPage = ["Current_Tab", "Unloaded_tabs", "Unread_tabs", "Other_Tabs", "Progress_meter_on_tabs"];
    var index = $("AppearanceTabBox").selectedIndex;
    var win = window.opener || Tabmix.getTopWin();
    if (win)
      win.openHelp("Customize_Styles_-_" + subPage[index]);
    else
      document.documentElement.getButton("help").disabled = true;
  }
}
