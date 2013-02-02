var gLinksPane = {
  init: function () {
    let singleWindow = $("singleWindow");
    this.singleWindow(singleWindow.checked);
    TM_Options.disabled(singleWindow, true);

    TM_Options.initBroadcasters("paneLinks", true);
    gCommon.setPaneWidth("paneLinks");
  },

  externalLinkValue: function(checked) {
    let external = $("externalLinkTarget");
    let node = $("generalWindowOpen");
    let preference = $(external.getAttribute("preference"));
    if (checked) {
      let prefValue = preference.valueFromPreferences;
      preference.value = prefValue > -1 ? prefValue : node.value;
    }
    else {
      preference.value = -1;
    }

    external.firstChild.firstChild.hidden = checked;
    TM_Options.setDisabled("obs_externalLink", !checked);
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
      TM_Options.setDisabled("obs_externalLink", !checked);
    }
  },

  singleWindow: function(enableSingleWindow) {
    if (enableSingleWindow) {
      this.updateStatus("generalWindowOpen", 2, true, 3);
      this.updateStatus("externalLinkTarget", 2, true, 3);
      this.updateStatus("divertedWindowOpen", 0, false, 0);
    }
  },

  updateStatus: function(itemId, testVal, test, newVal) {
    var item = $(itemId);
    if (test ? item.value == testVal : item.value != testVal) {
      var preference = $(item.getAttribute("preference"));
      preference.batching = true;
      preference.value = newVal;
      preference.batching = false;
    }
  }

}
