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

    if (!Tabmix.isVersion(170)) {
      gPrefWindow.removeChild("pref_moveTabOnDragging");
      gPrefWindow.removeChild("moveTabOnDragging");
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
    this.updateBroadcaster($("pref_tabbarscrolling").value);

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
    let prefID = "pref_" + this._options[aIndex] + "ClickTab";
    // update "ClickTab" menulist
    this.updatePref(this.clickTab, prefID);
    // update "ClickTabbar" menulist
    this.updatePref(this.clickTabbar, prefID + "bar");
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

  updateBroadcaster: function (val) {
    Tabmix.setItem('obs_tabbarscrolling', 'disabled', val == 2 || null);
  }

}
