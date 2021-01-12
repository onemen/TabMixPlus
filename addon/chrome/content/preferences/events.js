/* exported gEventsPane */
"use strict";

var gEventsPane = {
  init() {
    // for locales with long labels
    var hbox = $("focusTab-box");
    var label = $("focusTab-label").boxObject.width;
    var menulist = $("focusTab");
    if (hbox.boxObject.width > label + menulist.boxObject.width) {
      menulist.parentNode.removeAttribute("pack");
      hbox.setAttribute("orient", "horizontal");
      hbox.setAttribute("align", "center");
    }

    $("keepMenuOpen").label = TabmixSvc.getString("undoclosetab.keepOpen.label");

    var browserWindow = Tabmix.getTopWin();
    let ctrlTab = browserWindow.document.getElementById("ctrlTab-panel") && "ctrlTab" in browserWindow;
    if (!ctrlTab) {
      gPrefWindow.removeChild("pref_ctrltab.tabPreviews");
      gPrefWindow.removeChild("ctrltab.tabPreviews");
    }

    let newTabUrl = $("pref_newTabUrl");
    newTabUrl.name = TabmixSvc.newtabUrl;
    newTabUrl.value = newTabUrl.valueFromPreferences;

    this.newTabUrl($("pref_loadOnNewTab"), false, false);
    this.disableReplaceLastTabWith();
    this.disableShowTabList();

    var direction = window.getComputedStyle($("paneEvents")).direction;
    if (direction == "rtl") {
      let focusTab = $("focusTab").firstChild.childNodes;
      let [rightLabel, leftLabel] = [focusTab[2].label, focusTab[1].label];
      [focusTab[2].label, focusTab[1].label] = [leftLabel, rightLabel];
      // "opener/left"
      focusTab[5].label = focusTab[5].getAttribute("rtlLabel");
    }

    // bug 1210586 - Create a Synced tabs sidebar
    if (Tabmix.isVersion(470)) {
      const {label: syncedTabs} = browserWindow.document.getElementById("menu_tabsSidebar");
      $("syncedTabs").label = syncedTabs;
      $("selectSyncedTabs").label = syncedTabs;
    } else {
      $("syncedTabs").hidden = true;
      $("selectSyncedTabs").hidden = true;
    }

    // Bug 1352069 - Introduce a pref that allows for disabling cosmetic animations
    // remove the UI for the old 'browser.tabs.animate'
    if (Tabmix.isVersion(550)) {
      gPrefWindow.removeChild("pref_disableTabsAnimate");
      gPrefWindow.removeChild("disableTabsAnimate");
    }

    if (Tabmix.isVersion(600)) {
      $("restoreOnDemand").setAttribute("type", "number");
    }

    this.alignTabOpeningBoxes();

    gPrefWindow.initPane("paneEvents");
  },

  // align Tab opening group boxes
  // add setWidth attribute to columns that need to be aligned
  alignTabOpeningBoxes() {
    const widths = {};
    const rows = $("tabopening").querySelectorAll("hbox");
    function updateGrid(fn) {
      for (let row of rows) {
        let id = 0;
        const cols = row.querySelectorAll("vbox");
        for (let col of cols) {
          if (++id && col.hasAttribute("setWidth")) {
            fn(col, id);
          }
        }
      }
    }
    updateGrid((col, id) => {
      widths[id] = Math.max(widths[id] || 0, col.boxObject.width);
    });

    updateGrid((col, id) => {
      col.style.setProperty("width", widths[id] + "px", "important");
    });
  },

  disableShowTabList() {
    var ctrlTabPv = $("pref_ctrltab.tabPreviews");
    var disableShowTabList = $("pref_ctrltab").value &&
                             ctrlTabPv && ctrlTabPv.value;
    gPrefWindow.setDisabled("showTabList", disableShowTabList);
    if (!$("obs_showTabList").hasAttribute("disabled"))
      gPrefWindow.setDisabled("respondToMouse", disableShowTabList);
  },

  disableReplaceLastTabWith() {
    // we disable replaceLastTabWith if one of this test is true
    // browser.tabs.closeWindowWithLastTab = true OR
    // extensions.tabmix.keepLastTab = true
    var disable = !$("pref_keepWindow").value || $("pref_keepLastTab").value;
    gPrefWindow.setDisabled("obs_replaceLastTabWith", disable);
    this.newTabUrl($("pref_replaceLastTabWith"), disable, !disable);
  },

  newTabUrl(preference, disable, setFocus) {
    var showTabUrlBox = preference.value == 4;
    var item = $(preference.id.replace("pref_", ""));
    var idnum = item.getAttribute("idnum") || "";
    gPrefWindow.setDisabled("newTabUrlLabel" + idnum, !showTabUrlBox || disable);
    gPrefWindow.setDisabled("newTabUrl" + idnum, !showTabUrlBox || disable);
    if (setFocus && showTabUrlBox)
      $("newTabUrl" + idnum).focus();
  },

  syncFromNewTabUrlPref(item) {
    var preference = $(item.getAttribute("preference"));
    // If the pref is set to the default, set the value to ""
    // to show the placeholder text
    let value = preference.value;
    if (value && value.toLowerCase() == TabmixSvc.aboutNewtab)
      return "";
    return this.syncToNewTabUrlPref(value, TabmixSvc.aboutBlank);
  },

  syncToNewTabUrlPref(value, def = TabmixSvc.aboutNewtab) {
    // If the value is "", use about:newtab or about:blank.
    if (value === "") {
      return def;
    }

    // Otherwise, use the actual textbox value.
    return undefined;
  },

  onNewTabKeyDown(event) {
    // block spaces from the user to go to about:newtab preference
    if (event.keyCode == 32) {
      event.preventDefault();
    }
  },

  editSlideShowKey() {
    document.documentElement.showPane($("paneMenu"));
    if (typeof gMenuPane == "object")
      gMenuPane.editSlideShowKey();
    else
      $("paneMenu").setAttribute("editSlideShowKey", true);
  },

  loadProgressively: {
    syncToCheckBox(item) {
      let preference = $(item.getAttribute("preference"));
      if (preference.value === 0) {
        preference.value = 1;
      }
      if (preference.hasAttribute("notChecked")) {
        preference.setAttribute("notChecked", -Math.abs(preference.value));
      }
      this.setOnDemandDisabledState();
      return preference.value > -1;
    },

    syncFromCheckBox(item) {
      let preference = $(item.getAttribute("preference"));
      let control = $(item.getAttribute("control"));
      control.disabled = !item.checked;
      return -preference.value;
    },

    syncFromPref(item) {
      const preference = $(item.getAttribute("preference"));
      const prefValue = Math.abs(preference.value);
      this.setOnDemandMinValue(item, prefValue);
      return prefValue;
    },

    setOnDemandMinValue(item, prefValue) {
      if (item.id != "loadProgressively") {
        return;
      }
      const onDemand = $("restoreOnDemand");
      onDemand.min = item.valueNumber;
      if (!Tabmix.isVersion(600)) {
        onDemand._enableDisableButtons();
      }
      const restoreOnDemand = $("pref_restoreOnDemand");
      if (prefValue > Math.abs(restoreOnDemand.value)) {
        restoreOnDemand.value = $("chk_restoreOnDemand").checked ? prefValue : -prefValue;
      }
    },

    setOnDemandDisabledState() {
      const disabled = $("pref_loadProgressively").value < 0 ||
                       $("pref_restoreOnDemand").value < 0;
      gPrefWindow.setDisabled("restoreOnDemand", disabled);
    },
  },
};
