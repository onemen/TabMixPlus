/* eslint no-var: 2, prefer-const: 2 */
/* exported tabstyles */
"use strict";

const $ = id => document.getElementById(id);

const tabstyles = {
  pref: "appearance_tab",
  init() {
    $("stylestabs").selectedIndex = Tabmix.prefs.prefHasUserValue(this.pref) ?
      Tabmix.prefs.getIntPref(this.pref) : 0;

    if (!window.opener && !Tabmix.getTopWin())
      document.documentElement.getButton("help").disabled = true;

    const extra = document.documentElement.getButton("extra2");
    extra.label = $("hide-RGB").value;
    extra.classList.add("text-link");
  },

  save() {
    Tabmix.prefs.setIntPref(this.pref, $("stylestabs").selectedIndex);
    // store the pref immediately
    Services.prefs.savePrefFile(null);
  },

  cancel() {
    const panels = $("stylespanels").childNodes;
    for (const panel of panels) {
      $(panel.id)._ondialogcancel();
    }
    this.save();
  },

  openHelp() {
    const win = window.opener || Tabmix.getTopWin();
    if (win)
      win.openHelp("display-tab#customize_styles");
    else
      document.documentElement.getButton("help").disabled = true;
  },

  toggleRGB_visibility() {
    const doc = document.documentElement;
    const extra = doc.getButton("extra2");
    const item = $("hide-RGB");
    const wasShow = doc.getAttribute("hide-RGB") != "true";
    extra.label = item.value = item.getAttribute(wasShow ? 'show' : 'hide');
    doc.setAttribute("hide-RGB", wasShow);
  }
};
