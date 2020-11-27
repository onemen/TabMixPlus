/* exported tabstyles */
"use strict";

var $ = id => document.getElementById(id);

var tabstyles = {
  pref: "appearance_tab",
  init() {
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

  save() {
    Tabmix.prefs.setIntPref(this.pref, $("stylestabs").selectedIndex);
    // store the pref immediately
    Services.prefs.savePrefFile(null);
  },

  cancel() {
    let panels = $("stylespanels").childNodes;
    for (let panel of panels) {
      $(panel.id)._ondialogcancel();
    }
    this.save();
  },

  openHelp() {
    var win = window.opener || Tabmix.getTopWin();
    if (win)
      win.openHelp("display-tab#customize_styles");
    else
      document.documentElement.getButton("help").disabled = true;
  },

  toggleRGB_visibility() {
    let doc = document.documentElement;
    let extra = doc.getButton("extra2");
    let item = $("hide-RGB");
    var wasShow = doc.getAttribute("hide-RGB") != "true";
    extra.label = item.value = item.getAttribute(wasShow ? 'show' : 'hide');
    doc.setAttribute("hide-RGB", wasShow);
  }
};
