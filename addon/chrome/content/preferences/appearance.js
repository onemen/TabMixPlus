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
///alert("window.getComputedStyle(window, null).direction " + window.getComputedStyle(document.getElementById("appearance"), null).direction)
    var direction = window.getComputedStyle(document.getElementById("appearance"), null).direction;
    if (direction == "rtl") {
      let right = document.getElementById("newTabButton.posiotion.right");
      let left = document.getElementById("newTabButton.posiotion.left");
      let [rightLabel, leftLabel] = [right.label, left.label];
      [right.label, left.label] = [leftLabel, rightLabel];

      let tabScroll = document.getElementById("tabScroll").firstChild.childNodes;
      tabScroll[2].label = tabScroll[2].getAttribute("rtlLabel");

      let tabXLeft = document.getElementById("tabXLeft");
      tabXLeft.label = tabXLeft.getAttribute("rtlLabel");
    }

    TM_Options.initBroadcasters("paneAppearance", true);
    this.setTabXUI();
    this.addTabXUI();
    this.tabScroll();

    // for locals with long labels
    var hbox = document.getElementById("tabScroll-box");
    var label = document.getElementById("tabScroll.label").boxObject.width;
    var menulist = document.getElementById("tabScroll");
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
    var tabXValue = document.getElementById("addTabXUI").selectedItem.value;
    TM_Options.setItem("tabXdelaycheck", "hidden", tabXValue != 2 && tabXValue != 4);
    TM_Options.setItem("tabXwidthBox", "hidden", tabXValue != 5);
  },

  setTabXUI: function() {
    if (document.getElementById("flexTabs").checked) {
      document.getElementById("alltabsItem").hidden = true;
      var tabXUI = document.getElementById("addTabXUI");
      if (tabXUI.selectedItem.value == 5) {
        tabXUI.value = 1;
        TM_Options.setItem("tabXwidthBox", "hidden", true);
      }
    }
    else
       document.getElementById("alltabsItem").hidden = false;
  },

  setAllTabsItemVisibility: function(aShow) {
    if (document.getElementById("flexTabs").checked)
      document.getElementById("alltabsItem").hidden = !aShow;
    else
      document.getElementById("alltabsItem").hidden = false;
   },

  tabScroll: function() {
    var multiRow = document.getElementById("tabScroll").value == 2;
    document.getElementById("maxbar").hidden = !multiRow;
    document.getElementById("offsetAmountToScroll").hidden = multiRow;
  },

  spinbuttonChangeWidth: function(aEvent) {
    var val = aEvent.originalTarget.getAttribute("anonid") == "increaseButton" ? 1 : -1;
    if (aEvent.target.id  == "minWidth")
      document.getElementById("minScale").value += val;
    else
      document.getElementById("maxScale").value += val;
  },

  onsynctopreferenceWidth: function(aScale) {
    var val;
    var min = document.getElementById("minScale");
    var max = document.getElementById("maxScale");
    if (aScale.id == "minScale")
      val = Math.min(max.value, min.value);
    else
      val = Math.max(max.value, min.value);

    var spinButtons = document.getElementById("minWidth");
    spinButtons.decreaseDisabled = min.value <= min.min;
    spinButtons.increaseDisabled = min.value >= max.value;
    spinButtons = document.getElementById("maxWidth");
    spinButtons.decreaseDisabled = max.value <= min.value;
    spinButtons.increaseDisabled = max.value >= max.max;
    return val;
  },

  _onsynctopreferenceWidth: function(aScale) {
    if (aScale.id == "minScale") {
      let max = document.getElementById("maxScale");
      if (aScale.value > max.value)
        max.value = aScale.value;
    }
    else {
      let min = document.getElementById("minScale");
      if (aScale.value < min.value)
        min.value = aScale.value;
    }
    let spinButtons = document.getElementById(aScale.getAttribute("spin"))
    spinButtons.decreaseDisabled = aScale.min == aScale.value;
    spinButtons.increaseDisabled = aScale.max == aScale.value;
    return aScale.value;
  },

  scaleChangeWidth: function(aEvent) {
  return;
    let scale = aEvent.target;
    if (scale.id == "minScale")
      document.getElementById("maxScale").min = document.getElementById("minScale").value;
    else
      document.getElementById("minScale").max = document.getElementById("maxScale").value;

    let spinButtons = document.getElementById(scale.getAttribute("spin"))
    spinButtons.decreaseDisabled = scale.min == scale.value;
    spinButtons.increaseDisabled = scale.max == scale.value;

let min = document.getElementById("minScale")
let max = document.getElementById("maxScale")
Tabmix.log(scale.id+ " end \nmin " + min.min + " < " + min.value + " < " + min.max
+"\nmax " + max.min + " < " + max.value + " < " + max.max)

  },

  _scaleChangeWidth: function(aEvent) {
    let scale = aEvent.target;
    let min = document.getElementById("_minScale");
    let max = document.getElementById("_maxScale");
    if (scale.id == "_minScale")
      document.getElementById("_maxScale").min = document.getElementById("_minScale").value;
    else
      document.getElementById("_minScale").max = document.getElementById("_maxScale").value;

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
