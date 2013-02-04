var gMenuPane = {
  init: function () {
    gSetTabIndex.init('menu');

    $("pinTab").label = gCommon.pinTabLabel;

    var browserWindow = Tabmix.getTopWin();
    // check if bookmark item in tab context menu
    TM_Options.setItem("bmMenu", "hidden", !(browserWindow.document.getElementById("context_bookmarkAllTabs")));

    TM_Options.initUndoCloseBroadcaster();
    TM_Options.initSingleWindowBroadcaster();
    this.setInverseLinkLabel();

    gCommon.setPaneWidth("paneMenu");
  },

  // update item showInverseLink label in menu pane
  // when "Links" in Events > Tab Focus changed
  setInverseLinkLabel: function() {
    var showInverseLink = $("showInverseLink");
    var val = ($("pref_selectTab") || $("pref_selectTab1")).value;
    var label = showInverseLink.getAttribute((val ? "bg" : "fg") + "label");
    showInverseLink.setAttribute("label", label);
  }
}
