/* global gMenuPane */
"use strict";

var gEventsPane = {
  init: function () {
    // for locales with long labels
    var hbox = $("focusTab-box");
    var label = $("focusTab-label").boxObject.width;
    var menulist = $("focusTab");
    if (hbox.boxObject.width > label + menulist.boxObject.width) {
      menulist.parentNode.removeAttribute("pack");
      hbox.setAttribute("orient", "horizontal");
      hbox.setAttribute("align","center");
    }

    var browserWindow = Tabmix.getTopWin();
    let ctrlTab = browserWindow.document.getElementById("ctrlTab-panel") && "ctrlTab" in browserWindow;
    if (!ctrlTab) {
      gPrefWindow.removeChild("pref_ctrltab.tabPreviews");
      gPrefWindow.removeChild("ctrltab.tabPreviews");
    }

    this.disableInverseMiddleClick();

    $("pref_newTabUrl").name = TabmixSvc.newtabUrl;
    let prefValue = $("pref_newTabUrl").valueFromPreferences;
    if (prefValue != "about:newtab")
      $("newTabUrl").value = $("pref_newTabUrl").valueFromPreferences;

    this.newTabUrl($("pref_loadOnNewTab"), false, false);
    this.disabeleRplaceLastTabWith();
    this.disabeleShowTabList();

    var direction = window.getComputedStyle($("paneEvents"), null).direction;
    if (direction == "rtl") {
      let focusTab = $("focusTab").firstChild.childNodes;
      let [rightLabel, leftLabel] = [focusTab[2].label, focusTab[1].label];
      [focusTab[2].label, focusTab[1].label] = [leftLabel, rightLabel];
      // "opener/left"
      focusTab[5].label = focusTab[5].getAttribute("rtlLabel");
    }

    // align Tab opening group boxes
    var vbox1 = $("tabopening1");
    var vbox2 = $("tabopening2");
    var vbox3 = $("tabopening3");
    var max = Math.max(vbox1.boxObject.width, vbox2.boxObject.width, vbox3.boxObject.width);
    vbox1.style.setProperty("width", max + "px", "important");
    vbox2.style.setProperty("width", max + "px", "important");
    vbox3.style.setProperty("width", max + "px", "important");

    gPrefWindow.initPane("paneEvents");
  },

  disabeleShowTabList: function () {
    var ctrlTabPv = $("pref_ctrltab.tabPreviews");
    var disableShowTabList = $("pref_ctrltab").value &&
                             ctrlTabPv && ctrlTabPv.value;
    gPrefWindow.setDisabled("showTabList", disableShowTabList);
    if (!$("obs_showTabList").hasAttribute("disabled"))
      gPrefWindow.setDisabled("respondToMouse", disableShowTabList);
  },

  disabeleRplaceLastTabWith: function() {
    // we disable replaceLastTabWith if one of this test is true
    // browser.tabs.closeWindowWithLastTab = true OR
    // extensions.tabmix.keepLastTab = true
    var disable = !$("pref_keepWindow").value || $("pref_keepLastTab").value;
    gPrefWindow.setDisabled("obs_replaceLastTabWith", disable);
    this.newTabUrl($("pref_replaceLastTabWith"), disable, !disable);
  },

  newTabUrl: function(preference, disable, setFocus) {
    var showTabUrlBox = preference.value == 4;
    var item = $(preference.id.replace("pref_", ""));
    var idnum = item.getAttribute("idnum") || "" ;
    gPrefWindow.setDisabled("newTabUrlLabel" + idnum, !showTabUrlBox || disable);
    gPrefWindow.setDisabled("newTabUrl" + idnum, !showTabUrlBox || disable);
    if (setFocus && showTabUrlBox)
      $("newTabUrl" + idnum).focus();
  },

  syncFromNewTabUrlPref: function (item) {
    var preference = $(item.getAttribute("preference"));
    // If the pref is set to the default, set the value to ""
    // to show the placeholder text
    let value = preference.value;
    if (value && value.toLowerCase() == TabmixSvc.aboutNewtab)
      return "";
    return this.syncToNewTabUrlPref(value);
  },

  syncToNewTabUrlPref: function (value) {
    // If the value is "", use about:newtab.
    if (value === "")
      return "about:newtab";

    // Otherwise, use the actual textbox value.
    return undefined;
  },

  onNewTabKeyDown: function(event) {
    // block spaces from the user to go to about:newtab preference
    if (event.keyCode == 32) {
      event.preventDefault();
    }
  },

  disableInverseMiddleClick: function() {
    var val = ($("pref_opentabforLinks") || $("pref_opentabforLinks1")).value;
    gPrefWindow.setDisabled("inverselinks", val != 2 && $("midcurrent").checked);
  },

  editSlideShowKey: function () {
    document.documentElement.showPane($("paneMenu"));
    if (typeof gMenuPane == "object")
      gMenuPane.editSlideShowKey();
    else
      $("paneMenu").setAttribute("editSlideShowKey", true);
  }
};
