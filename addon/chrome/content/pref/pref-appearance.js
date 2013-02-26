var TMPstyles = {
  _prefsSvc: null,
  get prefsSvc() {
    if (!this._prefsSvc) {
      this._prefsSvc =  Components.classes["@mozilla.org/preferences-service;1"]
             .getService(Components.interfaces.nsIPrefService)
             .QueryInterface(Components.interfaces.nsIPrefBranch);
    }
    return this._prefsSvc;
  },

  init: function () {
    try {
      var index = this.prefsSvc.getIntPref("extensions.tabmix.appearance_tab");
    }
    catch (ex) { index = 0; }
    document.getElementById("stylestabs").selectedIndex = index;


    /* Chromifox theme force button height to 25px */
    var skin = this.prefsSvc.getCharPref("general.skins.selectedSkin");
    if (skin == "cfxec")
      document.getElementById("AppearanceTabBox").setAttribute("chromifox", true);
  },

  save: function () {
    this.prefsSvc.setIntPref("extensions.tabmix.appearance_tab", document.getElementById("stylestabs").selectedIndex);
    // store the pref immediately
    this._prefsSvc.savePrefFile(null);
  },

  cancel: function () {
    Array.forEach(["currentTab", "unreadTab", "otherTab", "progressMeter"], function(aID) {
      document.getElementById(aID)._ondialogcancel();
    });
    this.save();
  },

  openHelp: function () {
    var subPage = ["Current_Tab", "Unread_tabs", "Other_Tabs", "Progress_meter_on_tabs"];
    var index = document.getElementById("AppearanceTabBox").selectedIndex;
    window.opener.openHelp("Customize_Styles_-_" + subPage[index]);
  }
}
