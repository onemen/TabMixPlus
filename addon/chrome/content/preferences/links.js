/* exported gLinksPane */
"use strict";

var gLinksPane = {
  init() {
    this.singleWindow($("singleWindow").checked);
    this.externalLinkValue($("externalLink").checked);

    $("externalLinkTarget").querySelector('menuitem[value="-1"]').label = $("externalLinkTarget").querySelector('menuitem[value="3"]').label;
    const config = {attributes: true};
    const callback = function(mutationList) {
      for (const mutation of mutationList) {
        if (mutation.type === 'attributes' && mutation.attributeName == "label") {
          try {
            if (mutation.target.hasAttribute("label")) {
              $("externalLinkTarget").querySelector('menuitem[value="-1"]').label = mutation.target.label;
            }
          } catch (ex) {
            Cu.reportError(ex);
          }
        }
      }
    };
    const observer = new MutationObserver(callback);
    observer.observe($("generalWindowOpen"), config);

    gPrefWindow.setDisabled("obs_opentabforAllLinks", $("pref_opentabforLinks").value == 1);

    gPrefWindow.initPane("paneLinks");
  },

  externalLinkValue(checked) {
    let external = $("externalLinkTarget");
    let preference = $(external.getAttribute("preference"));
    if (!checked) {
      preference.value = -1;
    } else if (preference.value == -1) {
      external.value = $("generalWindowOpen").value;
      preference.value = $("generalWindowOpen").value;
    }
    external.firstChild.firstChild.hidden = checked;
    gPrefWindow.setDisabled("obs_externalLink", !checked);
  },

  updateExternalLinkCheckBox(external) {
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

  singleWindow(enableSingleWindow) {
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

  openFiletypeEditor() {
    window.openDialog("chrome://tabmixplus/content/preferences/subdialogs/pref-filetype.xhtml",
      "filetypePrefsDialog", "modal,titlebar,toolbar,centerscreen");
  }
};
