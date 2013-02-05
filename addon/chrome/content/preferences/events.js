var gEventsPane = {
  init: function () {
    gSetTabIndex.init('events');

    if (!Tabmix.isVersion(130))
      $("contextMenuSearch").hidden = true;

    // for locals with long labels
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
      let tabPreviews = $("ctrltab.tabPreviews");
      tabPreviews.parentNode.removeChild(tabPreviews);
    }

    // Bug 455553 - New Tab Page feature - landed on 2012-01-26 (Firefox 12)
    if (browserWindow.Tabmix.newTabURLpref == "browser.newtab.url") {
      let pref_newTabUrl = $("pref_newTabUrl");
      pref_newTabUrl.name = "browser.newtab.url";
      this._newTabUrl = "about:newtab";
      pref_newTabUrl.value = pref_newTabUrl.valueFromPreferences;

      pref_newTabUrl = $("pref_newTabUrl_1");
      pref_newTabUrl.name = "extensions.tabmix.replaceLastTabWith.newtab.url";
      pref_newTabUrl.value = pref_newTabUrl.valueFromPreferences;
    }

//XXXX TODO fix it
    TM_Options.initBroadcasters("paneEvents", true);
    TM_Options.disabled("undoClose", true); // set "obs_undoClose" global observer
    this.disableInverseMiddleClick();
    this.newTabUrl($("loadOnNewTab"), false, false);
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

    gCommon.setPaneWidth("paneEvents");
  },

  disabeleShowTabList: function () {
    var disableShowTabList = $("pref_ctrltab").value &&
                             $("pref_ctrltab.tabPreviews").value;
    TM_Options.setDisabled("showTabList", disableShowTabList);
    if (!$("obs_showTabList").hasAttribute("disabled"))
      TM_Options.setDisabled("respondToMouse", disableShowTabList);
  },

  disabeleRplaceLastTabWith: function() {
    // we disable replaceLastTabWith if one of this test is true
    // browser.tabs.closeWindowWithLastTab = true OR
    // extensions.tabmix.keepLastTab = true
    var disable = !$("pref_keepWindow").value || $("pref_keepLastTab").value;
    TM_Options.setDisabled("obs_replaceLastTabWith", disable);
    this.newTabUrl($("replaceLastTabWith"), disable, !disable);
  },

  newTabUrl: function(item, disable, setFocus) {
    var showTabUrlBox = item.selectedItem.value == 4;
    var idnum = item.getAttribute("idnum") || "" ;
    TM_Options.setDisabled("newTabUrlLabel" + idnum, !showTabUrlBox || disable);
    TM_Options.setDisabled("newTabUrl" + idnum, !showTabUrlBox || disable);
    if (setFocus && showTabUrlBox)
      $("newTabUrl" + idnum).focus();
  },

  _newTabUrl: "about:blank",
  syncFromNewTabUrlPref: function (item) {
    var preference = $(item.getAttribute("preference"));
    // If the pref is set to the default, set the value to ""
    // to show the placeholder text
    let value = preference.value;
    if (value && value.toLowerCase() == this._newTabUrl)
      return "";
    return this.syncToNewTabUrlPref(value);
  },

  syncToNewTabUrlPref: function (value) {
    // If the value is "", use about:blank or about:newtab.
    if (value == "")
      return this._newTabUrl;

    // Otherwise, use the actual textbox value.
    return undefined;
  },

  disableInverseMiddleClick: function() {
    var val = ($("pref_opentabforLinks") || $("pref_opentabforLinks1")).value;
    TM_Options.setDisabled("inverselinks", val != 2 && $("midcurrent").checked);
  },

  editSlideShowKey: function () {
    document.documentElement.showPane($("paneMenu"));
    if (typeof gMenuPane == "object")
      gMenuPane.editSlideShowKey();
    else
      $("paneMenu").setAttribute("editSlideShowKey", true);
  }
}
