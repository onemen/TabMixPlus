"use strict";

function $(id) document.getElementById(id)

let tabstyles = { // jshint ignore:line
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

    let extra = document.documentElement.getButton("extra2");
    extra.label = $("hide-RGB").value;
    extra.classList.add("text-link");
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
  },

  toggleRGBvisibility: function () {
    let doc = document.documentElement;
    let extra = doc.getButton("extra2");
    let item = $("hide-RGB");
    var wasShow = doc.getAttribute("hide-RGB") != "true";
    extra.label = item.value = item.getAttribute(wasShow ? 'show' : 'hide');
    doc.setAttribute("hide-RGB", wasShow);
  }
};
