"use strict";

var gLinksPane = {
  init: function () {
    this.singleWindow($("singleWindow").checked);
    gLinksPane.externalLinkValue($("externalLink").checked);

    gPrefWindow.initPane("paneLinks");
  },

  externalLinkValue: function(checked) {
    let external = $("externalLinkTarget");
    let preference = $(external.getAttribute("preference"));
    if (!checked)
      preference.value = -1;
    else if (preference.valueFromPreferences == -1)
      preference.value = $("generalWindowOpen").value;

    external.firstChild.firstChild.hidden = checked;
    gPrefWindow.setDisabled("obs_externalLink", !checked);
  },

  updateExternalLinkCeckbox: function (external) {
    let preference = $(external.getAttribute("preference"));
    if (external.value == preference.value)
      return;
    let checkbox = $("externalLink");
    let checked = preference.value != -1;
    if (checkbox.checked != checked) {
      checkbox.checked = checked;
      external.firstChild.firstChild.hidden = checked;
      gPrefWindow.setDisabled("obs_externalLink", !checked);
    }
  },

  singleWindow: function(enableSingleWindow) {
    function updateStatus(itemId, testVal, test, newVal) {
      var item = $(itemId);
      if (test ? item.value == testVal : item.value != testVal) {
        let preference = $(item.getAttribute("preference"));
        preference.value = newVal;
      }
    }

    if (enableSingleWindow) {
      updateStatus("generalWindowOpen", 2, true, 3);
      updateStatus("externalLinkTarget", 2, true, 3);
      updateStatus("divertedWindowOpen", 0, false, 0);
    }
  },

  openFiletypeEditor: function() {
    let url = "chrome://tabmixplus/content/preferences/subdialogs/pref-filetype.xul";
    window.openDialog(url, "filetypePrefsDialog", "modal,titlebar,toolbar,centerscreen");
  }
};
