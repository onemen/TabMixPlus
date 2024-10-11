/* exported gAppearancePane */
"use strict";

/** @type {AppearancePane} */
var gAppearancePane = {
  _tabmixCustomizeToolbar: null,
  init() {
    var browserWindow = Tabmix.getTopWin();
    // disable options for position the tabbar and scroll mode if TreeStyleTab extension installed
    if (browserWindow.Tabmix.tabsUtils.isVerticalTabBar) {
      const description = document.getElementById("treeStyleTab.msg");
      Tabmix.setItem(description, "hidden", null);
      if (browserWindow.gBrowser.tabContainer.verticalMode) {
        description.innerHTML = "These preferences are not in use for vertical tabs.";
        description.style.width = "25em";
      }
      const tabBarDisplay = $("tabBarDisplay");
      Tabmix.setItem(tabBarDisplay, "tstInstalled", true);
      Tabmix.setItem("tabBarPosition", "disabled", true);
      Tabmix.setItem("tabsScroll", "disabled", true);
      Tabmix.setItem("maxrow", "disabled", true);
      Tabmix.setItem("pinnedTabScroll", "disabled", true);
      Tabmix.setItem("offsetAmountToScroll", "disabled", true);
      Tabmix.setItem("scrollDelay", "disabled", true);
      Tabmix.setItem("smoothScroll", "disabled", true);

      if (Tabmix.isVersion(1330)) {
        const hideTabbar = $("hideTabbar");
        Tabmix.setItem(hideTabbar, "disabled", true);
        Tabmix.setItem(hideTabbar.previousElementSibling, "disabled", true);
        Tabmix.setItem("show-hideTabbar-context-menu", "disabled", true);
        tabBarDisplay.insertBefore(description, tabBarDisplay.firstChild);
      }
    }

    if (
      browserWindow.gBrowser.tabContainer.verticalMode &&
      browserWindow.Tabmix.tabsUtils.isVerticalTabs
    ) {
      Tabmix.setItem("newTabButton.position", "hidden", true);
    }

    let treeStyleTab = browserWindow.Tabmix.extensions.treeStyleTab;
    let disableButtonOnLefSide = !browserWindow.Tabmix.defaultCloseButtons || treeStyleTab;
    let comment = $("onLeftDisabled");
    Tabmix.setItem("tabXLeft", "disabled", disableButtonOnLefSide || null);
    Tabmix.setItem(comment, "hidden", !disableButtonOnLefSide || null);
    if (treeStyleTab) {
      comment.value = comment.getAttribute("tst") ?? "";
    }

    // rtl update position
    if (RTL_UI) {
      let right = $("newTabButton.position.right");
      let left = $("newTabButton.position.left");
      [right.label, left.label] = [left.label, right.label];

      /** @type {[Node, Node, Node]} */ // @ts-expect-error
      let tabsScroll = $("tabsScroll").firstChild?.childNodes;
      tabsScroll[2].label = tabsScroll[2].getAttribute("rtlLabel") ?? "";

      let tabXLeft = $("tabXLeft");
      tabXLeft.label = tabXLeft.getAttribute("rtlLabel") ?? "";
    }

    this.tabCloseButtonChanged();
    this.setTabCloseButtonUI();
    this.tabsScrollChanged();

    // for locales with long labels
    var hbox = $("tabsScroll-box");
    var label = $("tabsScroll.label").getBoundingClientRect().width;
    var menulist = $("tabsScroll");
    var indent = 23; // we have class="indent"
    if (
      hbox.parentNode &&
      hbox.parentNode.getBoundingClientRect().width > label + menulist.getBoundingClientRect().width - indent
    ) {
      menulist.parentNode?.removeAttribute("pack");
      menulist.parentNode?.removeAttribute("class");
      hbox.setAttribute("orient", "horizontal");
      hbox.setAttribute("align", "center");
    }

    // waterfox position control
    if (TabmixSvc.isG3Waterfox) {
      this._waterfoxPositionControl();
    }

    gPrefWindow.initPane("paneAppearance");
    // call this function after initPane
    // we update some broadcaster that initPane may reset
    this.toolbarButtons(browserWindow);
  },

  _waterfoxPositionControl() {
    gPrefWindow.removeItemAndPrefById("pref_tabBarPosition");
    const position = $("waterfox-tabBarPosition");
    position.hidden = false;
    let positionPref, defaultPrefValue;
    if (Tabmix.isVersion(913)) {
      MozXULElement.insertFTLIfNeeded(Tabmix.isVersion(1020) ? "browser/waterfox.ftl" : "browser/extensibles.ftl");
      defaultPrefValue = "topabove";
      positionPref = "browser.tabs.toolbarposition";
      position.appendChild(MozXULElement.parseXULToFragment(
        `<menupopup>
           <menuitem id="tabBarTopAbove" value="topabove" data-l10n-id="tab-bar-top-above"/>
           <menuitem id="tabBarTopBelow" value="topbelow" data-l10n-id="tab-bar-top-below"/>
           <menuitem id="tabBarBottomAbove" value="bottomabove" data-l10n-id="tab-bar-bottom-above"/>
           <menuitem id="tabBarBottomBelow" value="bottombelow" data-l10n-id="tab-bar-bottom-below"/>
         </menupopup>`
      ));
      if (!Services.prefs.prefHasUserValue(positionPref)) {
        document.l10n?.translateElements([$("tabBarTopAbove")]).then(() => {
          position.setAttribute("label", $("tabBarTopAbove").label);
        }).catch(e => console.error("error in _waterfoxPositionControl", e));
      }
    } else {
      MozXULElement.insertFTLIfNeeded("browser/preferences/preferences.ftl");
      defaultPrefValue = "topAboveAB";
      positionPref = "browser.tabBar.position";
      position.appendChild(MozXULElement.parseXULToFragment(
        `<menupopup>
           <menuitem value="topAboveAB" data-l10n-id="tab-top-above-ab"/>
           <menuitem value="topUnderAB" data-l10n-id="tab-top-under-ab"/>
           <menuitem value="bottom" data-l10n-id="tab-bottom"/>
         </menupopup>`
      ));
    }
    position.setAttribute("preference", positionPref);
    position.setAttribute("value", Services.prefs.getCharPref(positionPref, defaultPrefValue));
    const preferences = $("paneAppearance").querySelector("preferences");
    preferences.appendChild(MozXULElement.parseXULToFragment(
      `<preference id="${positionPref}"
                     name="${positionPref}"
                     type="wstring"
                     ${Tabmix.isVersion(913) ? "" : 'onchange = "window.opener.moveTabBar();"'}/>`
    ));
  },

  tabCloseButtonChanged() {
    var tabCbValue = $Pref("pref_tabCloseButton").value;
    Tabmix.setItem("tabDelayCheck", "hidden", tabCbValue != 2 && tabCbValue != 4);
    Tabmix.setItem("tabWidthBox", "hidden", tabCbValue != 5);
  },

  setTabCloseButtonUI() {
    if ($Pref("pref_flexTabs").value) {
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
    var multiRow = $Pref("pref_tabsScroll").value == 2;
    $("multi-rows").hidden = !multiRow;
    $("one-row").hidden = multiRow;
  },

  tabmixCustomizeToolbar() {
    this._tabmixCustomizeToolbar = true;
    const win = Tabmix.getTopWin();
    win.gCustomizeMode.enter();
  },

  toolbarButtons(aWindow) {
    // Display > Toolbar
    var buttons = [
      "tabmix-closedTabsButton",
      "tabmix-closedWindowsButton",
      "tabmix-alltabs-button",
    ];
    var onToolbar = $("onToolbar");
    var onPlate = $("onPlate");
    for (const id of buttons) {
      let button = aWindow.document.getElementById(id);
      let optionButton = $("_" + id).parentNode;
      if (optionButton) {
        if (button)
          onToolbar.appendChild(optionButton);
        else
          onPlate.appendChild(optionButton);
      } else {
        throw new Error(`Tabmix: _${id} parentNode not found`);
      }
    }
    if (onToolbar.childNodes[1]) {
      onToolbar.childNodes[1].hidden = onToolbar.childNodes.length > 2;
    }
    if (onPlate.childNodes[1]) {
      onPlate.childNodes[1].hidden = onPlate.childNodes.length > 2;
    }

    // Display > Tab bar
    /** @type {(buttonID: string, itemID: string, aEnable: boolean) => void} */
    function updateDisabledState(buttonID, itemID, aEnable) {
      const enablePosition = Boolean(aWindow.CustomizableUI.getPlacementOfWidget(buttonID));
      gPrefWindow.setDisabled(itemID, !enablePosition || null);
      gPrefWindow.setDisabled("obs_" + itemID, !aEnable || !enablePosition || null);
    }
    updateDisabledState("new-tab-button", "newTabButton", $Pref("pref_newTabButton").booleanValue);

    if (this._tabmixCustomizeToolbar) {
      this._tabmixCustomizeToolbar = null;
      window.focus();
    }
  },

  // block width change on instantApply
  // user is force to hit apply
  userChangedWidth(item) {
    gPrefWindow.widthChanged = $("minWidth").value != $Pref("pref_minWidth").valueFromPreferences ||
                        $("maxWidth").value != $Pref("pref_maxWidth").valueFromPreferences;
    if (!gPrefWindow.instantApply)
      return undefined;
    // block the change by returning the preference own value
    return $Pref(item.getAttribute("preference")).value;
  },

  changeTabsWidth() {
    if (!gPrefWindow.widthChanged)
      return;
    if (gPrefWindow.instantApply) {
      gPrefWindow.widthChanged = false;
    }
    let [minWidth, maxWidth] = [parseInt($("minWidth").value), parseInt($("maxWidth").value)];
    if (minWidth > maxWidth) {
      [minWidth, maxWidth] = [maxWidth, minWidth];
      [$("minWidth").value, $("maxWidth").value] = [String(minWidth), String(maxWidth)];
    }
    [$Pref("pref_minWidth").value, $Pref("pref_maxWidth").value] = [minWidth, maxWidth];
  },

  resetWidthChange() {
    gPrefWindow.widthChanged = false;
    const min = $Pref("pref_minWidth");
    min.value = min.valueFromPreferences;
    const max = $Pref("pref_maxWidth");
    max.value = max.valueFromPreferences;
    if (gPrefWindow.instantApply) {
      $("minWidth").value = String(min.value);
      $("maxWidth").value = String(max.value);
    }
  },

  openAdvanceAppearance() {
    window.openDialog("chrome://tabmixplus/content/preferences/subdialogs/pref-appearance.xhtml",
      "advanceAppearanceDialog", "modal,titlebar,toolbar,centerscreen");
  }

};
