/* exported gMousePane */
"use strict";

/** @type {MousePane} */
var gMousePane = {
  _inited: false,

  get clickTab() {
    return Tabmix.lazyGetter(this, "clickTab", $("ClickTab"));
  },

  get clickTabbar() {
    return Tabmix.lazyGetter(this, "clickTabbar", $("ClickTabbar"));
  },

  init() {
    MozXULElement.insertFTLIfNeeded("browser/tabContextMenu.ftl");
    Tabmix.setFTLDataId("paneMouse");

    if (TabmixSvc.isMac) {
      let label = $("tabId").getAttribute("label2");
      $("tabId").setAttribute("label", label ?? "");
    }

    $("ClickTabPinTab").label = gPrefWindow.pinTabLabel;

    // Init tab clicking options
    var menuPopup = this.clickTab.firstChild;
    // block item in tab clicking options that are not in use
    var blocked = TabmixSvc.blockedClickingOptions;
    for (const commandId of blocked) {
      let item = menuPopup.getElementsByAttribute("value", commandId)[0];
      if (item) {
        item.hidden = true;
      }
    }
    this.clickTabbar.appendChild(this.clickTab.firstChild.cloneNode(true));
    this.updatePanelPrefs($("tabclick").selectedIndex);
    this.updateDblClickTabbar($Pref("pref_click_dragwindow"));

    gPrefWindow.initPane("paneMouse");

    this._inited = true;
  },

  tabSelectionChanged(event) {
    if (event.target.localName != "tabpanels") {
      return;
    }
    gPrefWindow.tabSelectionChanged(event);

    if (this._inited) {
      this.updatePanelPrefs(event.target._tabbox.tabs.selectedIndex);
    }
  },

  panelSelectionChanged(event, panel = event.target) {
    if (panel.tabbox && panel.selectedIndex !== 0) {
      event.stopPropagation();
      panel.selectedIndex = 0;
    }
  },

  _options: ["dbl", "middle", "ctrl", "shift", "alt"],
  updatePanelPrefs(aIndex) {
    let panel = this._options[aIndex];
    let prefID = "pref_" + panel + "ClickTab";
    // update "ClickTab" menulist
    this.updatePref(this.clickTab, prefID);
    // update "ClickTabbar" menulist
    this.updatePref(this.clickTabbar, prefID + "bar");
    // Linux uses alt key down to trigger the top menu on Ubuntu or
    // start drag window on OpenSuSe
    if (TabmixSvc.isLinux) {
      let disabled = panel == "alt";
      Tabmix.setItem(this.clickTabbar, "disabled", disabled);
      Tabmix.setItem(this.clickTabbar.previousSibling, "disabled", disabled);
    }
  },

  updatePref(element, prefID) {
    let preference = $Pref(prefID);
    element.setAttribute("preference", prefID);
    preference.setElementValue(element);
  },

  ensureElementIsVisible(aPopup) {
    var scrollBox = aPopup._scrollBox;
    scrollBox.ensureElementIsVisible(aPopup.parentNode.selectedItem);
  },

  resetPreference(checkbox) {
    /** @type {MousePaneNS.MenuList} */ // @ts-expect-error
    let menulist = $(checkbox.getAttribute("control"));
    let prefID = menulist.getAttribute("preference");
    $(prefID).value = checkbox.checked ? menulist[prefID] || 0 : -1;
  },

  setCheckedState(menulist) {
    let prefID = menulist.getAttribute("preference");
    let val = $Pref(prefID).numberValue;
    if (val != -1) {
      menulist[prefID] = val;
    }

    menulist.disabled = val == -1;
    menulist.previousSibling.checked = !menulist.disabled;
  },

  updateDblClickTabbar(pref) {
    let dblClickTabbar = $Pref("pref_dblclick_changesize");
    if (pref.value && !dblClickTabbar.value) {
      dblClickTabbar.value = pref.value;
    }

    let checkbox = $("dblclick_changesize")._checkbox;
    let image = checkbox.getElementsByClassName("checkbox-check")[0];
    Tabmix.setItem(image, "disabled", pref.value || null);
  },
};
