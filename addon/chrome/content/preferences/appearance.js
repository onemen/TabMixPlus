"use strict";

var gAppearancePane = { // jshint ignore:line
  init: function () {
    var browserWindow = Tabmix.getTopWin();
    // disable options for position the tabbar and scroll mode if TreeStyleTab extension installed
    if (browserWindow.Tabmix.extensions.verticalTabBar) {
      Tabmix.setItem("treeStyleTab.msg", "hidden", null);
      Tabmix.setItem("tabBarDisplay", "TSTinstalled", true);
      Tabmix.setItem("tabBarPosition", "disabled", true);
      Tabmix.setItem("tabsScroll", "disabled", true);
      Tabmix.setItem("maxrow", "disabled", true);
      Tabmix.setItem("offsetAmountToScroll", "disabled", true);
      Tabmix.setItem("scrollDelay", "disabled", true);
      Tabmix.setItem("smoothScroll", "disabled", true);
    }

    if (browserWindow.Tabmix.extensions.treeStyleTab) {
      Tabmix.setItem("treeStyleTab.bg.msg", "hidden", null);
      window.treeStyleTab = true;
    }

    Tabmix.setItem("tabXLeft", "disabled", !browserWindow.Tabmix.defaultCloseButtons || null);
    Tabmix.setItem("onLeftDisabled", "hidden", browserWindow.Tabmix.defaultCloseButtons || null);

    // browser.allTabs.previews
    if (Tabmix.isVersion(210) && !TabmixSvc.isPaleMoon) {
      gPrefWindow.removeChild("pref_allTabsPpreviews");
      gPrefWindow.removeChild("obs_hideAllTabsButton");
      gPrefWindow.removeChild("allTabsPpreviews");
    }

    // rtl update
    var direction = window.getComputedStyle($("appearance"), null).direction;
    if (direction == "rtl") {
      let right = $("newTabButton.posiotion.right");
      let left = $("newTabButton.posiotion.left");
      [right.label, left.label] = [left.label, right.label];

      let tabsScroll = $("tabsScroll").firstChild.childNodes;
      tabsScroll[2].label = tabsScroll[2].getAttribute("rtlLabel");

      let tabXLeft = $("tabXLeft");
      tabXLeft.label = tabXLeft.getAttribute("rtlLabel");
    }

    this.tabCloseButtonChanged();
    this.setTabCloseButtonUI();
    this.tabsScrollChanged();

    // for locales with long labels
    var hbox = $("tabsScroll-box");
    var label = $("tabsScroll.label").boxObject.width;
    var menulist = $("tabsScroll");
    var ident = 23; // we have class="ident"
    if (hbox.boxObject.width > label + menulist.boxObject.width - ident) {
      menulist.parentNode.removeAttribute("pack");
      menulist.parentNode.removeAttribute("class");
      hbox.setAttribute("orient", "horizontal");
      hbox.setAttribute("align","center");
    }

    gPrefWindow.initPane("paneAppearance");
    // call this function after initPane
    // we update some broadcaster that initPane may reset
    this.toolbarButtons(browserWindow);
  },

  tabCloseButtonChanged: function() {
    var tabCbValue = $("pref_tabCloseButton").value;
    Tabmix.setItem("tabXdelaycheck", "hidden", tabCbValue != 2 && tabCbValue != 4);
    Tabmix.setItem("tabXwidthBox", "hidden", tabCbValue != 5);
  },

  setTabCloseButtonUI: function() {
    if ($("pref_flexTabs").value) {
      $("alltabsItem").disabled = true;
      let tabCbUI = $("tabCloseButton");
      if (tabCbUI.selectedItem.value == 5) {
        tabCbUI.value = 1;
        Tabmix.setItem("tabXwidthBox", "hidden", true);
      }
    }
    else
      $("alltabsItem").disabled = false;
  },

  tabsScrollChanged: function() {
    var multiRow = $("pref_tabsScroll").value == 2;
    $("multi-rows").hidden = !multiRow;
    $("one-row").hidden = multiRow;
  },

  tabmixCustomizeToolbar: function() {
    this._tabmixCustomizeToolbar = true;
    Tabmix.getTopWin().BrowserCustomizeToolbar();
  },

  toolbarButtons: function(aWindow) {
    // Display > Toolbar
    var buttons = ["btn_sessionmanager", "btn_undoclose", "btn_closedwindows", "btn_tabslist"];
    var onToolbar = $("onToolbar");
    var onPlate = $("onPlate");
    for (let i = 0; i < buttons.length; ++i ) {
      let button = aWindow.document.getElementById(buttons[i]);
      let optionButton = $("_" + buttons[i]).parentNode;
      if (button)
        onToolbar.appendChild(optionButton);
      else
        onPlate.appendChild(optionButton);
    }
    onToolbar.childNodes[1].hidden = onToolbar.childNodes.length > 2;
    onPlate.childNodes[1].hidden = onPlate.childNodes.length > 2;

    // Display > Tab bar
    function updateDisabledState(buttonID, itemID, aEnable) {
      let button = aWindow.document.getElementById(buttonID);
      let enablePosition =  button && button.parentNode == aWindow.document.getElementById("TabsToolbar");
      gPrefWindow.setDisabled(itemID, !enablePosition || null);
      gPrefWindow.setDisabled("obs_" + itemID, !aEnable || !enablePosition || null);
    }
    updateDisabledState("new-tab-button", "newTabButton", $("pref_newTabButton").value);
    updateDisabledState("alltabs-button", "hideAllTabsButton", true);

    if (this._tabmixCustomizeToolbar) {
      delete this._tabmixCustomizeToolbar;
      window.focus();
    }
  },

  // block width cange on instantApply
  // user is force to hit apply
  userchangedWidth: function(item) {
    gPrefWindow.widthChanged = $("minWidth").value != $("pref_minWidth").valueFromPreferences ||
                        $("maxWidth").value != $("pref_maxWidth").valueFromPreferences;
    if (!gPrefWindow.instantApply)
      return undefined;
    gPrefWindow.setButtons(!gPrefWindow.widthChanged);
    // block the change by returning the preference own value
    return $(item.getAttribute("preference")).value;
  },

  changeTabsWidth: function() {
    if (!gPrefWindow.widthChanged)
      return;
    gPrefWindow.widthChanged = false;
    let [minWidth, maxWidth] = [parseInt($("minWidth").value), parseInt($("maxWidth").value)];
    if (minWidth > maxWidth)
      [minWidth, maxWidth] = [maxWidth, minWidth];
    [$("pref_minWidth").value, $("pref_maxWidth").value] = [minWidth, maxWidth];
  },

  resetWidthChange: function() {
    gPrefWindow.widthChanged = false;
    $("minWidth").value = $("pref_minWidth").value;
    $("maxWidth").value = $("pref_maxWidth").value;
  },

  openAdvanceAppearance: function() {
    let url = "chrome://tabmixplus/content/preferences/subdialogs/pref-appearance.xul";
    window.openDialog(url, "advanceAppearanceDialog", "modal,titlebar,toolbar,centerscreen");
  }

};
