var gAppearancePane = {
  init: function () {
    gSetTabIndex.init('appearance');

    var browserWindow = Tabmix.getTopWin();
    // disable options for position the tabbar and scroll mode if TreeStyleTab extension installed
    if (browserWindow.Tabmix.extensions.verticalTabBar) {
      TM_Options.setItem("treeStyleTab.msg", "hidden", null);
      TM_Options.setItem("tabBarDisplay", "TSTinstalled", true);
      TM_Options.setItem("tabBarPosition", "disabled", true);
///      TM_Options.setItem("tabBarPosition.label", "disabled", true);
      TM_Options.setItem("tabScroll", "disabled", true);
///      TM_Options.setItem("tabScroll.label", "disabled", true);
      TM_Options.setItem("scrollDelay", "disabled", true);
      TM_Options.setItem("smoothScroll", "disabled", true);
    }

    // rtl update
///alert("window.getComputedStyle(window, null).direction " + window.getComputedStyle($("appearance"), null).direction)
    var direction = window.getComputedStyle($("appearance"), null).direction;
    if (direction == "rtl") {
      let right = $("newTabButton.posiotion.right");
      let left = $("newTabButton.posiotion.left");
      let [rightLabel, leftLabel] = [right.label, left.label];
      [right.label, left.label] = [leftLabel, rightLabel];

      let tabScroll = $("tabScroll").firstChild.childNodes;
      tabScroll[2].label = tabScroll[2].getAttribute("rtlLabel");

      let tabXLeft = $("tabXLeft");
      tabXLeft.label = tabXLeft.getAttribute("rtlLabel");
    }

    TM_Options.initBroadcasters("paneAppearance", true);
    this.setTabXUI();
    this.addTabXUI();
    this.tabScroll();

    // for locals with long labels
    var hbox = $("tabScroll-box");
    var label = $("tabScroll.label").boxObject.width;
    var menulist = $("tabScroll");
    var ident = 23; // we have class="ident"
    if (hbox.boxObject.width > label + menulist.boxObject.width - ident) {
      menulist.parentNode.removeAttribute("pack");
      menulist.parentNode.removeAttribute("class");
      hbox.setAttribute("orient", "horizontal");
      hbox.setAttribute("align","center");
    }

    toolbarButtons(browserWindow);
    gCommon.setPaneWidth("paneAppearance");
  },

  addTabXUI: function() {
    var tabXValue = $("addTabXUI").selectedItem.value;
    TM_Options.setItem("tabXdelaycheck", "hidden", tabXValue != 2 && tabXValue != 4);
    TM_Options.setItem("tabXwidthBox", "hidden", tabXValue != 5);
  },

  setTabXUI: function() {
    if ($("flexTabs").checked) {
      $("alltabsItem").hidden = true;
      var tabXUI = $("addTabXUI");
      if (tabXUI.selectedItem.value == 5) {
        tabXUI.value = 1;
        TM_Options.setItem("tabXwidthBox", "hidden", true);
      }
    }
    else
       $("alltabsItem").hidden = false;
  },

  setAllTabsItemVisibility: function(aShow) {
    if ($("flexTabs").checked)
      $("alltabsItem").hidden = !aShow;
    else
      $("alltabsItem").hidden = false;
   },

  tabScroll: function() {
    var multiRow = $("tabScroll").value == 2;
    $("maxbar").hidden = !multiRow;
    $("offsetAmountToScroll").hidden = multiRow;
  },

  spinbuttonChangeWidth: function(aEvent) {
    var val = aEvent.originalTarget.getAttribute("anonid") == "increaseButton" ? 1 : -1;
    if (aEvent.target.id  == "minWidth")
      $("minScale").value += val;
    else
      $("maxScale").value += val;
  },

  onsynctopreferenceWidth: function(aScale) {
    var val;
    var min = $("minScale");
    var max = $("maxScale");
    if (aScale.id == "minScale")
      val = Math.min(max.value, min.value);
    else
      val = Math.max(max.value, min.value);

    var spinButtons = $("minWidth");
    spinButtons.decreaseDisabled = min.value <= min.min;
    spinButtons.increaseDisabled = min.value >= max.value;
    spinButtons = $("maxWidth");
    spinButtons.decreaseDisabled = max.value <= min.value;
    spinButtons.increaseDisabled = max.value >= max.max;
    return val;
  },

  _onsynctopreferenceWidth: function(aScale) {
    if (aScale.id == "minScale") {
      let max = $("maxScale");
      if (aScale.value > max.value)
        max.value = aScale.value;
    }
    else {
      let min = $("minScale");
      if (aScale.value < min.value)
        min.value = aScale.value;
    }
    let spinButtons = $(aScale.getAttribute("spin"))
    spinButtons.decreaseDisabled = aScale.min == aScale.value;
    spinButtons.increaseDisabled = aScale.max == aScale.value;
    return aScale.value;
  },

  scaleChangeWidth: function(aEvent) {
  return;
    let scale = aEvent.target;
    if (scale.id == "minScale")
      $("maxScale").min = $("minScale").value;
    else
      $("minScale").max = $("maxScale").value;

    let spinButtons = $(scale.getAttribute("spin"))
    spinButtons.decreaseDisabled = scale.min == scale.value;
    spinButtons.increaseDisabled = scale.max == scale.value;

let min = $("minScale")
let max = $("maxScale")
Tabmix.log(scale.id+ " end \nmin " + min.min + " < " + min.value + " < " + min.max
+"\nmax " + max.min + " < " + max.value + " < " + max.max)

  },

  _scaleChangeWidth: function(aEvent) {
    let scale = aEvent.target;
    let min = $("_minScale");
    let max = $("_maxScale");
    if (scale.id == "_minScale")
      $("_maxScale").min = $("_minScale").value;
    else
      $("_minScale").max = $("_maxScale").value;

    let width = 180;
    let thumb = 20;
    let delata = width-thumb;
    let minDif = min.max - min.min;
    let maxDif = max.max - max.min;

    min.width = parseInt(delata * minDif/(minDif + maxDif) + thumb);
    max.width = parseInt(delata * maxDif/(minDif + maxDif) + thumb);

///Tabmix.log(min.width + " + " + max.width + " = " + (parseInt(max.width) + parseInt(min.width)))
  },

  tabmixCustomizeToolbar: function() {
    window._tabmixCustomizeToolbar = true;
    Tabmix.getTopWin().BrowserCustomizeToolbar();
  }

}
