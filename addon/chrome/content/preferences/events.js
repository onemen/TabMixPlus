var gEventsPane = {
  init: function () {
    gSetTabIndex.init('events');

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
      // in minefiled the default is "about:blank"
///      this._newTabUrl = pref_newTabUrl.defaultValue;
      this._newTabUrl = "about:newtab";
      pref_newTabUrl.value = pref_newTabUrl.valueFromPreferences;

      pref_newTabUrl = $("pref_newTabUrl_1");
      pref_newTabUrl.name = "extensions.tabmix.replaceLastTabWith.newtab.url";
      pref_newTabUrl.value = pref_newTabUrl.valueFromPreferences;
    }

//XXXX TODO fix it
    TM_Options.initBroadcasters("paneEvents", true);
    TM_Options.disabled("undoClose", true); // set "obs_undoClose" global observer
    TM_Options.speLink();
    TM_Options.newTabUrl($("loadOnNewTab"), false, false);
    TM_Options.setDisabeled_replaceLastTabWith();
    this.setShowTabList();

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
    vbox1.style.setProperty("width",max + "px", "important");
    vbox2.style.setProperty("width",max + "px", "important");
    vbox3.style.setProperty("width",max + "px", "important");

    gCommon.setPaneWidth("paneEvents");
  },

  setUndoCloseCache: function (item) {
    var undoCloseCache = $("undoCloseCache");
    var currentValue = undoCloseCache.value;
    var newValue = item.checked ? 10 : 0;
    if (newValue != currentValue) {
      var preference = $("pref_undoCloseCache");
      preference.value = newValue;
//XXX TODO check this
//      updateApplyData(undoCloseCache, newValue);
    }
  },

  setUndoClose: function (item) {
// look like we don't need this....
    if (item.value == "") {
      var preference = $(item.getAttribute("preference"));
      preference.batching = true;
      preference.value = 0;
      preference.batching = false;
    }

    if (item.value == 0) {
      var undoClose = $("undoClose");
      undoClose.checked = false;
      TM_Options.disabled(undoClose);
      this.setUndoCloseCache(undoClose);
    }
//XXX TODO
// need to save pref to file;
  },

  setShowTabList: function () {
    var disableShowTabList = $("ctrltab").checked &&
                              $("ctrltab.tabPreviews").checked;
    TM_Options.setDisabled("showTabList", disableShowTabList);
    if (!$("obs_showTabList").hasAttribute("disabled"))
      TM_Options.setDisabled("respondToMouse", disableShowTabList);
  },

  _newTabUrl: "about:blank",
  syncFromNewTabUrlPref: function () {
    let pref_newTabUrl = $("pref_newTabUrl");

    // If the pref is set to the default, set the value to "" to show the placeholder text
    let value = pref_newTabUrl.value;
    if (value && value.toLowerCase() == this._newTabUrl)
      return "";

    if (pref_newTabUrl.value == "")
      return this._newTabUrl;

    // Otherwise, show the actual pref value.
    return undefined;
  },

  syncToNewTabUrlPref: function (value) {
    // If the value is "", use about:blank or about:newtab.
    if (value == "")
      return this._newTabUrl;

    // Otherwise, use the actual textbox value.
    return undefined;
  },
}
