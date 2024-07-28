/* eslint no-var: 2, prefer-const: 2 */
/* exported tabstyles */
"use strict";

this.$ = id => document.getElementById(id);

const tabstyles = {
  pref: "appearance_tab",
  init() {
    $("stylestabs").selectedIndex = Tabmix.prefs.prefHasUserValue(this.pref) ?
      Tabmix.prefs.getIntPref(this.pref) : 0;

    const dialog = document.querySelector("dialog");
    if (!window.opener && !Tabmix.getTopWin()) {
      dialog.getButton("extra1").disabled = true;
    }

    const extra = dialog.getButton("extra2");
    extra.label = $("hide-RGB").value;
    extra.classList.add("text-link");

    gNumberInput.init(true);
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
    if (win) {
      win.openHelp("display-tab#customize_styles");
    } else {
      this.dialog.getButton("extra1").disabled = true;
    }
  },

  toggleRGB_visibility() {
    const dialog = document.querySelector("dialog");
    const extra = dialog.getButton("extra2");
    const item = $("hide-RGB");
    const wasShow = dialog.getAttribute("hide-RGB") != "true";
    extra.label = item.value = item.getAttribute(wasShow ? 'show' : 'hide');
    dialog.setAttribute("hide-RGB", wasShow);
  }
};
