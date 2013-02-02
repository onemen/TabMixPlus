var gMenuPane = {
  init: function () {
    gSetTabIndex.init('menu');

    var browserWindow = Tabmix.getTopWin();
//XXX we can drop it !!!!
    // check if bookmark item in tab context menu
    TM_Options.setItem("bmMenu", "hidden", !(browserWindow.document.getElementById("context_bookmarkAllTabs")));

//    TM_Options.initBroadcasters("paneMenu", true);
    TM_Options.initUndoCloseBroadcaster();
    TM_Options.initSingleWindowBroadcaster();
//XXX TODO if event pan not loaded yet document.getElementById("selectTab") is null
//  try to call document.getElementById("selectTab").checked
/*
    var checked = document.getElementById("selectTab") ? document.getElementById("selectTab").checked || prevValue ?????
*/
    TM_Options.selectTab();
/*
    var itam = document.getElementById("selectTab");
    var checked = itam ? itam.checked : Services.prefs.getBoolPref("browser.tabs.loadInBackground");
    TM_Options.selectTab(checked);
*/
    gCommon.setPaneWidth("paneMenu");
  }
}
