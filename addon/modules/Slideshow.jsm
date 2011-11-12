var EXPORTED_SYMBOLS = ["flst"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://tabmixplus/XPCOMUtils.jsm");
Components.utils.import("resource://tabmixplus/Services.jsm");

function flst() {
  this.flstOn = TabmixSvc.getString("flstOn.label");
  this.flstOff = TabmixSvc.getString("flstOff.label");
  this.slideshowOn = TabmixSvc.getString("slideshowOn.label");
  this.slideshowOff = TabmixSvc.getString("slideshowOff.label");
  XPCOMUtils.defineLazyGetter(this, "tabContainer", function () {return TabmixSvc.topWin().gBrowser.tabContainer;});
}

flst.prototype = {
  showAlert: function(msg) {
    try {
      let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
      alerts.showAlertNotification("chrome://tabmixplus/skin/tmp.png", "Tab Mix Plus", msg, false, "", null);
    }
    catch (e) {
      if (TabmixSvc.is40)
        return;
      let statusTextFld = TabmixSvc.topWin().document.getElementById("statusbar-display");
      let currentLabel = statusTextFld.label;
      statusTextFld.label = msg;
      this.timer =  Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this.timer.initWithCallback(function () {
            statusTextFld.label = currentLabel;
            this.timer = null;
      }, 2500, Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  //toggle flst on/off
  toggle: function() {
    if (TabmixSvc.prefs.getIntPref("extensions.tabmix.focusTab") != 4) {
      TabmixSvc.prefs.setIntPref("extensions.tabmix.focusTab", 4);
      this.showAlert(this.flstOn);
    }
    else {
      TabmixSvc.prefs.setIntPref("extensions.tabmix.focusTab", 2);
      this.showAlert(this.flstOff);
    }
  },

  toggleSlideshow: function() {
    if (this.slideShowTimer) {
      this.cancel();
    }
    else if (this.moreThenOneTab) {
      let timerInterval = TabmixSvc.prefs.getIntPref("extensions.tabmix.slideDelay") * 1000;
      this.slideShowTimer =  Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this.slideShowTimer.initWithCallback(this, timerInterval,
                        Ci.nsITimer.TYPE_REPEATING_SLACK);
      this.showAlert(this.slideshowOn);
    }
  },

  notify: function() {
    if (this.moreThenOneTab)
      this.tabContainer.advanceSelectedTab(1, true);
    else
      this.cancel();
  },

  cancel: function() {
    this.slideShowTimer.cancel();
    this.slideShowTimer = null;
    this.showAlert(this.slideshowOff);
  },

  get moreThenOneTab() {
    let tabs = this.tabContainer.childNodes;
    for (let count = 0, i = 0; i < tabs.length; i++) {
      if (!tabs[i].hidden && ++count == 2)
        return true;
    }
    return false;
  }
}
