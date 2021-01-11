/* globals gGrid, Cu, Services */
"use strict";

// This file is in use for all versions before Firefox 42.0
(function Tabmix_newTab() {
  let PREF = "extensions.tabmix.titlefrombookmark";
  if (Services.prefs.getBoolPref(PREF)) {
    window.addEventListener("load", function loadGrid() {
      window.removeEventListener("load", loadGrid);
      let {updateTitles} = Cu.import("resource://tabmixplus/AboutNewTab.jsm", {}).TabmixAboutNewTab;
      if (gGrid.cells) {
        updateTitles(gGrid.cells);
      }
    });
  }
}());
