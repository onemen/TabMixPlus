/* exported gEventsPane */
"use strict";

/** @type {EventsPane} */
var gEventsPane = {
  init() {
    // for locales with long labels
    var hbox = $("focusTab-box");
    var label = $("focusTab-label").getBoundingClientRect().width;
    var menulist = $("focusTab");
    if (
      hbox.parentNode &&
      hbox.parentNode.getBoundingClientRect().width > label + menulist.getBoundingClientRect().width
    ) {
      menulist.parentNode?.removeAttribute("pack");
      hbox.setAttribute("orient", "horizontal");
      hbox.setAttribute("align", "center");
    }

    $("keepMenuOpen").label = TabmixSvc.getString("undoclosetab.keepOpen.label");

    var browserWindow = Tabmix.getTopWin();
    let ctrlTab =
      browserWindow.document.getElementById("ctrlTab-panel") && "ctrlTab" in browserWindow;
    if (!ctrlTab) {
      gPrefWindow.removeItemAndPrefById("pref_ctrltab.tabPreviews");
    }

    this.newTabUrl($Pref("pref_loadOnNewTab"), false, false);
    this.disableReplaceLastTabWith();
    this.disableShowTabList();

    if (RTL_UI) {
      /** @type {[Node, Node, Node, Node, Node, Node]} */ // @ts-expect-error - there are 6 labels in the list
      let focusTab = $("focusTab").firstChild?.childNodes;
      let [rightLabel, leftLabel] = [focusTab[2].label, focusTab[1].label];
      [focusTab[2].label, focusTab[1].label] = [leftLabel ?? "", rightLabel ?? ""];
      // "opener/left"
      focusTab[5].label = focusTab[5].getAttribute("rtlLabel") ?? "";
    }

    const {label: syncedTabs} = browserWindow.document.getElementById("menu_tabsSidebar");
    $("syncedTabs").label = syncedTabs;
    $("selectSyncedTabs").label = syncedTabs;

    if (!Tabmix.isVersion(1360)) {
      $("openTabNextInGroup_control").parentNode.hidden = true;
    }

    this.alignTabOpeningBoxes();

    this.openTabNext.on_change($Pref("pref_openTabNext"));

    gPrefWindow.initPane("paneEvents");
  },

  // align Tab opening group boxes
  // add setWidth attribute to columns that need to be aligned
  alignTabOpeningBoxes() {
    /** @type {Record<number, number>} */
    const widths = {};
    const rows = $("tabopening").querySelectorAll("hbox");

    /** @type {(fn: (col: Element, id: number) => void) => void} */
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
      widths[id] = Math.max(widths[id] || 0, col.getBoundingClientRect().width);
    });

    updateGrid((col, id) => {
      col.style.setProperty("width", widths[id] + "px", "important");
    });
  },

  disableShowTabList() {
    var ctrlTabPv = $Pref("pref_ctrltab.tabPreviews");
    var disableShowTabList =
      $Pref("pref_ctrltab").booleanValue && ctrlTabPv && ctrlTabPv.booleanValue;
    gPrefWindow.setDisabled("showTabList", disableShowTabList);
    if (!$("obs_showTabList").hasAttribute("disabled")) {
      gPrefWindow.setDisabled("respondToMouse", disableShowTabList);
    }
  },

  disableReplaceLastTabWith() {
    // we disable replaceLastTabWith if one of this test is true
    // browser.tabs.closeWindowWithLastTab = true OR
    // extensions.tabmix.keepLastTab = true
    var disable = !$Pref("pref_keepWindow").booleanValue || $Pref("pref_keepLastTab").booleanValue;
    gPrefWindow.setDisabled("obs_replaceLastTabWith", disable);
    this.newTabUrl($Pref("pref_replaceLastTabWith"), disable, !disable);
  },

  newTabUrl(preference, disable, setFocus) {
    var showTabUrlBox = preference.value == 4;
    var item = $(preference.id.replace("pref_", ""));
    var idnum = item.getAttribute("idnum") || "";
    gPrefWindow.setDisabled("newTabUrlLabel" + idnum, !showTabUrlBox || disable);
    gPrefWindow.setDisabled("newTabUrl" + idnum, !showTabUrlBox || disable);
    if (setFocus && showTabUrlBox) {
      $("newTabUrl" + idnum).focus();
    }
  },

  syncFromNewTabUrlPref(item) {
    var preference = $Pref(item.getAttribute("preference"));
    // If the pref is set to the default, set the value to ""
    // to show the placeholder text
    let value = preference.value;
    if (value && value.toString().toLowerCase() == TabmixSvc.aboutNewtab) {
      return "";
    }

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
    document.getElementById("TabMIxPreferences").showPane($Pane("paneMenu"));
    if (typeof gMenuPane == "object") {
      gMenuPane.editSlideShowKey();
    } else {
      $("paneMenu").setAttribute("editSlideShowKey", true);
    }
  },

  loadProgressively: {
    syncToCheckBox(item) {
      let preference = $Pref(item.getAttribute("preference"));
      if (preference.value === 0) {
        preference.value = 1;
      }
      const value = preference.numberValue;
      if (preference.hasAttribute("notChecked")) {
        preference.setAttribute("notChecked", -Math.abs(value));
      }
      this.setOnDemandDisabledState();
      return value > -1;
    },

    syncFromCheckBox(item) {
      let preference = $Pref(item.getAttribute("preference"));
      let control = $(item.getAttribute("control"));
      control.disabled = !item.checked;
      return -preference.numberValue;
    },

    syncFromPref(item) {
      const preference = $Pref(item.getAttribute("preference"));
      const prefValue = Math.abs(preference.numberValue);
      this.setOnDemandMinValue(item, prefValue);
      return prefValue;
    },

    setOnDemandMinValue(item, prefValue) {
      if (item.id != "loadProgressively") {
        Tabmix.setItem(
          "restoreOnDemand",
          "decreaseDisabled",
          prefValue <= Math.abs($Pref("pref_loadProgressively").numberValue) || null
        );
        return;
      }
      const onDemand = $("restoreOnDemand");
      const newMinValue = Number(prefValue) || 0;
      onDemand.min = String(newMinValue);
      const restoreOnDemand = $Pref("pref_restoreOnDemand");
      if (prefValue > Math.abs(restoreOnDemand.numberValue)) {
        restoreOnDemand.value = $("chk_restoreOnDemand").checked ? prefValue : -prefValue;
      }
      Tabmix.setItem(
        onDemand,
        "decreaseDisabled",
        restoreOnDemand.numberValue <= newMinValue || null
      );
    },

    setOnDemandDisabledState() {
      const disabled =
        $Pref("pref_loadProgressively").numberValue < 0 ||
        $Pref("pref_restoreOnDemand").numberValue < 0;
      gPrefWindow.setDisabled("restoreOnDemand", disabled);
    },
  },

  openTabNext: {
    isChanging: false,
    on_change(preference) {
      if (this.isChanging) {
        return;
      }
      this.isChanging = true;

      const openTabNext = $Pref("pref_openTabNext");
      const relatedAfterCurrent = $Pref("pref_relatedAfterCurrent");
      const openTabNextCheckbox = $("openTabNext");

      if (preference === openTabNext) {
        // browser.tabs.insertAfterCurrent default is false, in the case both pref
        // is true turn off browser.tabs.insertRelatedAfterCurrent
        if (openTabNext.value && relatedAfterCurrent.value) {
          relatedAfterCurrent.value = false;
        }
      } else {
        openTabNext.value = relatedAfterCurrent.value ? false : openTabNextCheckbox.checked;
      }

      const checked = openTabNext.booleanValue || relatedAfterCurrent.booleanValue;
      openTabNextCheckbox.checked = checked;
      gPrefWindow.setDisabled("obs_openTabNext_control", !checked);

      this.isChanging = false;
    },

    on_command(checked) {
      if (checked) {
        $Pref("pref_openTabNext").value = true;
      } else {
        $Pref("pref_openTabNext").value = false;
        $Pref("pref_relatedAfterCurrent").value = false;
      }
    },
  },

  openTabNextInGroup() {
    let openNewTabNextEnabled = $("openNewTabNext").checked;
    const value = openNewTabNextEnabled ? 0 : 2;
    let inGroupCheckBox = $("openTabNextInGroup_control");
    let openTabNextInGroup = $("openTabNextInGroup");
    let preference = $Pref(openTabNextInGroup.getAttribute("preference"));
    let checked = inGroupCheckBox.checked;
    let enabled = checked && openNewTabNextEnabled;
    if (!enabled) {
      preference.value = -1;
    } else if (preference.value == -1) {
      openTabNextInGroup.value = value;
      preference.value = value;
    }
    if (openTabNextInGroup.firstChild?.firstChild) {
      openTabNextInGroup.firstChild.firstChild.hidden = checked;
    }
    openTabNextInGroup.querySelector('menuitem[value="-1"]').label =
      openTabNextInGroup.querySelector(`menuitem[value="${value}"]`).label;
    inGroupCheckBox.checked = enabled;
    gPrefWindow.setDisabled("openTabNextInGroup", !enabled);
  },
};
