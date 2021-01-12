/* exported gAppearancePane */
"use strict";

var gAppearancePane = {
  init() {
    var browserWindow = Tabmix.getTopWin();
    // disable options for position the tabbar and scroll mode if TreeStyleTab extension installed
    if (browserWindow.Tabmix.extensions.verticalTabBar) {
      Tabmix.setItem("treeStyleTab.msg", "hidden", null);
      Tabmix.setItem("tabBarDisplay", "tstInstalled", true);
      Tabmix.setItem("tabBarPosition", "disabled", true);
      Tabmix.setItem("tabsScroll", "disabled", true);
      Tabmix.setItem("maxrow", "disabled", true);
      Tabmix.setItem("pinnedTabScroll", "disabled", true);
      Tabmix.setItem("offsetAmountToScroll", "disabled", true);
      Tabmix.setItem("scrollDelay", "disabled", true);
      Tabmix.setItem("smoothScroll", "disabled", true);
    }

    if (!TabmixSvc.australis) {
      Tabmix.setItem("squaredTabs", "hidden", true);
    }

    let treeStyleTab = browserWindow.Tabmix.extensions.treeStyleTab;
    let disableButtonOnLefSide = !browserWindow.Tabmix.defaultCloseButtons || treeStyleTab;
    let comment = $("onLeftDisabled");
    Tabmix.setItem("tabXLeft", "disabled", disableButtonOnLefSide || null);
    Tabmix.setItem(comment, "hidden", !disableButtonOnLefSide || null);
    if (treeStyleTab) {
      comment.value = comment.getAttribute("tst");
    }

    // browser.allTabs.previews
    if (!TabmixSvc.isPaleMoon) {
      gPrefWindow.removeChild("pref_allTabsPreviews");
      gPrefWindow.removeChild("obs_hideAllTabsButton");
      gPrefWindow.removeChild("allTabsPreviews");
    }

    // rtl update position
    var direction = window.getComputedStyle($("appearance")).direction;
    if (direction == "rtl") {
      let right = $("newTabButton.position.right");
      // let left = $("newTabButton.position.left");
      let left = $("newTabButton.position.left");
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
    var indent = 23; // we have class="indent"
    if (hbox.boxObject.width > label + menulist.boxObject.width - indent) {
      menulist.parentNode.removeAttribute("pack");
      menulist.parentNode.removeAttribute("class");
      hbox.setAttribute("orient", "horizontal");
      hbox.setAttribute("align", "center");
    }

    // Firefox 57+ uses both smooth scroll and scrollDelay (see tabstrip._startScroll)
    if (Tabmix.isVersion(570)) {
      gPrefWindow.removeChild("obs_smoothScroll");
    }

    gPrefWindow.initPane("paneAppearance");
    // call this function after initPane
    // we update some broadcaster that initPane may reset
    this.toolbarButtons(browserWindow);
  },

  tabCloseButtonChanged() {
    var tabCbValue = $("pref_tabCloseButton").value;
    Tabmix.setItem("tabDelayCheck", "hidden", tabCbValue != 2 && tabCbValue != 4);
    Tabmix.setItem("tabWidthBox", "hidden", tabCbValue != 5);
  },

  setTabCloseButtonUI() {
    if ($("pref_flexTabs").value) {
      $("alltabsItem").disabled = true;
      let tabCbUI = $("tabCloseButton");
      if (tabCbUI.selectedItem.value == 5) {
        tabCbUI.value = 1;
        Tabmix.setItem("tabWidthBox", "hidden", true);
      }
    } else {
      $("alltabsItem").disabled = false;
    }
  },

  tabsScrollChanged() {
    var multiRow = $("pref_tabsScroll").value == 2;
    $("multi-rows").hidden = !multiRow;
    $("one-row").hidden = multiRow;
  },

  tabmixCustomizeToolbar() {
    this._tabmixCustomizeToolbar = true;
    const win = Tabmix.getTopWin();
    if (typeof win.gCustomizeMode == "object") {
      // Firefox 57
      win.gCustomizeMode.enter();
    } else {
      win.BrowserCustomizeToolbar();
    }
  },

  toolbarButtons(aWindow) {
    // Display > Toolbar
    var buttons = ["btn_sessionmanager", "btn_undoclose", "btn_closedwindows", "btn_tabslist"];
    var onToolbar = $("onToolbar");
    var onPlate = $("onPlate");
    for (let i = 0; i < buttons.length; ++i) {
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
      let enablePosition = button && button.parentNode == aWindow.document.getElementById("TabsToolbar");
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

  // block width change on instantApply
  // user is force to hit apply
  userChangedWidth(item) {
    gPrefWindow.widthChanged = $("minWidth").value != $("pref_minWidth").valueFromPreferences ||
                        $("maxWidth").value != $("pref_maxWidth").valueFromPreferences;
    if (!gPrefWindow.instantApply)
      return undefined;
    gPrefWindow.setButtons(!gPrefWindow.widthChanged);
    // block the change by returning the preference own value
    return $(item.getAttribute("preference")).value;
  },

  changeTabsWidth() {
    if (!gPrefWindow.widthChanged)
      return;
    gPrefWindow.widthChanged = false;
    let [minWidth, maxWidth] = [parseInt($("minWidth").value), parseInt($("maxWidth").value)];
    if (minWidth > maxWidth)
      [minWidth, maxWidth] = [maxWidth, minWidth];
    [$("pref_minWidth").value, $("pref_maxWidth").value] = [minWidth, maxWidth];
  },

  resetWidthChange() {
    gPrefWindow.widthChanged = false;
    $("minWidth").value = $("pref_minWidth").value;
    $("maxWidth").value = $("pref_maxWidth").value;
  },

  openAdvanceAppearance() {
    window.openDialog("chrome://tabmixplus/content/preferences/subdialogs/pref-appearance.xul",
      "advanceAppearanceDialog", "modal,titlebar,toolbar,centerscreen");
  }

};
