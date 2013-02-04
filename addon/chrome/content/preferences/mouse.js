var gMousePane = {
  _inited: false,
  clickTab: null,
  clickTabbar: null,
  init: function () {
///    if (/^Mac/.test(navigator.platform)) {
    if (Tabmix.isPlatform("Mac")) {
      let label = $("tabId").getAttribute("label2");
      $("tabId").setAttribute("label", label);
    }

    this._inited = true;

    $("ClickTabPinTab").label = gCommon.pinTabLabel;

    var browserWindow = Tabmix.getTopWin();
    // update tabclicking items that aren't change by tabmix
    TM_Options.setItem("snapBack", "hidden", !(browserWindow.SessionSaver && browserWindow.SessionSaver.snapBackTab));
    var isIE = (browserWindow.IeView && browserWindow.IeView.ieViewLaunch) ||
               (browserWindow.gIeTab && browserWindow.gIeTab.switchTabEngine) ||
               (browserWindow.ieview && browserWindow.ieview.launch);
    TM_Options.setItem("ieView", "hidden", !isIE);

//XXX we can drop it !!!!
    // check if book "Browser:BookmarkAllTabs" command exist
    TM_Options.setItem("bmTabsCommand", "hidden", !(browserWindow.document.getElementById("Browser:BookmarkAllTabs")));

    // Init tabclicking options
    this.clickTab = $("ClickTab");
    this.clickTabbar = $("ClickTabbar");
    this.clickTabbar.appendChild(this.clickTab.firstChild.cloneNode(true));

//XXXX check this again
    // change tab label on Mac. trigger onselect before broadcaster is set
    // so we add the onselect here
    let tabclicking = $("tabclicking_tabs");
//XXX remove EventListener on unload
//    tabclicking.addEventListener("select", this.tabSelectionChanged, false);

    gSetTabIndex.init('mouse');
    gSetTabIndex.init('tabclick');

    this.updatePanelPrefs(tabclicking.selectedIndex);

//XXX improve this.....
    TM_Options.initBroadcasters("paneMouse", true);
    TM_Options.initUndoCloseBroadcaster();
    TM_Options.initSingleWindowBroadcaster();
//    var index = $("tabclick").selectedIndex;
//    this.setVisibility(index);
//    this.updatePanelPrefs(index);
/*
    // Init tabclicking options
    var popup = $("tabclicking_menu").firstChild;
    this.clickTab = $("ClickTab")
    this.clickTab.appendChild(popup.cloneNode(true));
    this.clickTabbar = $("ClickTabbar")
    this.clickTabbar.appendChild(popup.cloneNode(true));

    var prevWindow = Tabmix.getTopWin();

    // update tabclicking items that aren't change by tabmix
    TM_Options.setItem("snapBack", "hidden", !(prevWindow.SessionSaver && prevWindow.SessionSaver.snapBackTab));
    TM_Options.setItem("ieView", "hidden", !(prevWindow.IeView && prevWindow.IeView.ieViewLaunch));

    // check if book "Browser:BookmarkAllTabs" command exist
    TM_Options.setItem("bmTabsCommand", "hidden", !(prevWindow.document.getElementById("Browser:BookmarkAllTabs")));

    gSetTabIndex.init('mouse');
    gSetTabIndex.init('tabclick');

    TM_Options.initBroadcasters("paneMouse", true);

    var index = $("tabclick").selectedIndex;
    this.setVisibility(index);
    this.updatePanelPrefs(index);
*/
    gCommon.setPaneWidth("paneMouse");
  },

/*
  deinit: function() {
    let tabclicking = $("tabclicking_tabs");
    tabclicking.removeEventListener("select", this.tabSelectionChanged, false);
  },
*/

/*
function tabSelectionChanged(event) {
   if (!event || event.target.localName != "tabs")
      return;

   var index = event.target.selectedIndex;
   setSelectedIndex(index);
}

function setSelectedIndex(index) {
   var c = ["dbl", "middle", "ctrl", "shift", "alt"];
   var clickTab = $("ClickTab");
   var prefId = c[index] + "ClickTab";
   clickTab.value = $(prefId).value;
   clickTab.setAttribute("prefstring_item", prefId);

   var clickTabbar = $("ClickTabbar");
   prefId = c[index] + "ClickTabbar";
   clickTabbar.value = $(prefId).value;
   clickTabbar.setAttribute("prefstring_item", prefId);
}
*/

  tabSelectionChanged: function (aEvent) {
//Tabmix.log("this._inited " + this._inited + "   aEvent.target.localName " + aEvent.target.localName);
    if (aEvent.target.localName != "tabs" || !this._inited)
      return;
    gSetTabIndex.tabSelectionChanged(aEvent);

    this.updatePanelPrefs(aEvent.target.parentNode.selectedIndex);
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
  }

}
