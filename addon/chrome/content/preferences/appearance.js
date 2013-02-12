var gAppearancePane = {
  init: function () {
    gSetTabIndex.init("appearance");

    var browserWindow = Tabmix.getTopWin();
    // disable options for position the tabbar and scroll mode if TreeStyleTab extension installed
    if (browserWindow.Tabmix.extensions.verticalTabBar) {
      Tabmix.setItem("treeStyleTab.msg", "hidden", null);
      Tabmix.setItem("tabBarDisplay", "TSTinstalled", true);
      Tabmix.setItem("tabBarPosition", "disabled", true);
      Tabmix.setItem("tabsScroll", "disabled", true);
      Tabmix.setItem("scrollDelay", "disabled", true);
      Tabmix.setItem("smoothScroll", "disabled", true);
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

    TM_Options.initBroadcasters("paneAppearance", true);
    this.tabCloseButtonChanged();
    this.setTabCloseButtonUI();
    this.tabsScrollChanged();

    // for locals with long labels
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

//XXX TODO check if we can move this to appearance.js
    toolbarButtons(browserWindow);
//XXX TODO check how to work with width and height change
    gCommon.setPaneWidth("paneAppearance");
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

  setAllTabsItemVisibility: function(aShow) {return;
    if ($("flexTabs").checked)
      $("alltabsItem").hidden = !aShow;
    else
      $("alltabsItem").hidden = false;
   },

  tabsScrollChanged: function() {
    var multiRow = $("pref_tabsScroll").value == 2;
    $("maxbar").hidden = !multiRow;
    $("offsetAmountToScroll").hidden = multiRow;
  },

  tabmixCustomizeToolbar: function() {
    window._tabmixCustomizeToolbar = true;
    Tabmix.getTopWin().BrowserCustomizeToolbar();
  },

  // block width cange on instantApply
  // user is force to hit apply
  userchangedWidth: function(item) {
    this.widthChanged = $("minWidth").value != $("pref_minWidth").valueFromPreferences ||
                        $("maxWidth").value != $("pref_maxWidth").valueFromPreferences
    let docElt = document.documentElement;
    if (!docElt.instantApply)
      return undefined;
    docElt.getButton("accept").hidden = !this.widthChanged;
    docElt.getButton("extra1").hidden = !this.widthChanged;
    // block the change by returning the preference own value
    return $(item.getAttribute("preference")).value;
  },

  changeTabsWidth: function() {
    if (!this.widthChanged)
      return;
    this.widthChanged = false;
    let docElt = document.documentElement;
    docElt.getButton("accept").hidden = docElt.instantApply;
    docElt.getButton("extra1").hidden = docElt.instantApply;
    let [minWidth, maxWidth] = [parseInt($("minWidth").value), parseInt($("maxWidth").value)];
    if (minWidth > maxWidth)
      [minWidth, maxWidth] = [maxWidth, minWidth];
    [$("pref_minWidth").value, $("pref_maxWidth").value] = [minWidth, maxWidth];
  },

  openAdvanceAppearance: function() {
    let url = "chrome://tabmixplus/content/pref/pref-appearance.xul";
    window.openDialog(url, "advanceAppearanceDialog", "modal,titlebar,toolbar");
  }

}
