"use strict";

var gMousePane = {
  _inited: false,
  clickTab: null,
  clickTabbar: null,
  init: function () {
    this._inited = true;

    if (Tabmix.isPlatform("Mac")) {
      let label = $("tabId").getAttribute("label2");
      $("tabId").setAttribute("label", label);
    }

    $("ClickTabPinTab").label = gPrefWindow.pinTabLabel;

    var browserWindow = Tabmix.getTopWin();

    // Init tabclicking options
    this.clickTab = $("ClickTab");
    var menuPopup = this.clickTab.firstChild;
    // block item in tabclicking options that are not in use
    var blocked = browserWindow.gTMPprefObserver.blockedValues;
    for (let i = 0; i < blocked.length; i++) {
      let item = menuPopup.getElementsByAttribute("value", blocked[i])[0];
      item.hidden = true;
    }
    this.clickTabbar = $("ClickTabbar");
    this.clickTabbar.appendChild(this.clickTab.firstChild.cloneNode(true));
    this.updatePanelPrefs($("tabclick").selectedIndex);
    $("dblClickTabbar_changesize").setAttribute("style",
        "width: #px;".replace("#", $("mouseClick_tabbox").boxObject.width));
    this.updateBroadcaster('tabbarscrolling');
    this.updateBroadcaster('disableMoveTab');

    gPrefWindow.initPane("paneMouse");
  },

  tabSelectionChanged: function (aEvent) {
    if (aEvent.target.localName != "tabs")
      return;
    gPrefWindow.tabSelectionChanged(aEvent);

    if (this._inited)
      this.updatePanelPrefs(aEvent.target.selectedIndex);
  },

  _options: ["dbl", "middle", "ctrl", "shift", "alt"],
  updatePanelPrefs: function (aIndex) {
    let panel = this._options[aIndex];
    let prefID = "pref_" + panel + "ClickTab";
    // update "ClickTab" menulist
    this.updatePref(this.clickTab, prefID);
    // update "ClickTabbar" menulist
    this.updatePref(this.clickTabbar, prefID + "bar");
    // Linux uses alt key down to trigger the top menu on Ubuntu or
    // start drag window on OpenSuSe
    let disabled = Tabmix.isPlatform("Linux") && panel == "alt";
    Tabmix.setItem(this.clickTabbar, "disabled", disabled || null);
    Tabmix.setItem(this.clickTabbar.previousSibling, "disabled", disabled || null);
  },

  updatePref: function (element, prefID) {
    let preference = $(prefID);
    element.setAttribute("preference", prefID);
    preference.setElementValue(element);
  },

  ensureElementIsVisible: function (aPopup) {
    var scrollBox = document.getAnonymousElementByAttribute(aPopup, "class", "popup-internal-box");
    scrollBox.ensureElementIsVisible(aPopup.parentNode.selectedItem);
  },

  updateBroadcaster: function (id) {
    let preference = $("pref_" + id);
    Tabmix.setItem("obs_" + id, "disabled", preference.value == 2 || null);
  },

  resetPreference: function (checkbox) {
    let menulist = $(checkbox.getAttribute("control"));
    let prefID = menulist.getAttribute("preference");
    $(prefID).valueFromPreferences = checkbox.checked ? (menulist[prefID] || undefined) : -1;
  },

  setCheckedState: function (menulist) {
    let prefID = menulist.getAttribute("preference");
    let val = $(prefID).value;
    if (val != -1)
      menulist[prefID] = val;
    menulist.disabled = val == -1;
    menulist.previousSibling.checked = !menulist.disabled;
  }

}
