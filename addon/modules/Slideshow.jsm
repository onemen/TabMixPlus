"use strict";

var EXPORTED_SYMBOLS = ["flst"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://tabmixplus/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Shortcuts",
  "resource://tabmixplus/Shortcuts.jsm");

function flst() {
  this.flstOn = TabmixSvc.getString("flstOn.label");
  this.flstOff = TabmixSvc.getString("flstOff.label");
  this.slideshowOn = TabmixSvc.getString("slideshowOn.label");
  this.slideshowOff = TabmixSvc.getString("slideshowOff.label");
  XPCOMUtils.defineLazyGetter(this, "tabContainer", function () {return TabmixSvc.topWin().gBrowser.tabContainer;});
}

flst.prototype = {
  showAlert: function(msg, id) {
    try {
      msg = msg.replace(/F8|F9/, Shortcuts.getFormattedKeyForID(id));
      let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
      alerts.showAlertNotification("chrome://tabmixplus/skin/tmp.png", "Tab Mix Plus", msg, false, "", null);
    }
    catch (e) { }
  },

  //toggle flst on/off
  toggle: function() {
    if (TabmixSvc.prefBranch.getIntPref("focusTab") != 4) {
      TabmixSvc.prefBranch.setIntPref("focusTab", 4);
      this.showAlert(this.flstOn, "toggleFLST");
    }
    else {
      TabmixSvc.prefBranch.setIntPref("focusTab", 2);
      this.showAlert(this.flstOff, "toggleFLST");
    }
  },

  toggleSlideshow: function() {
    if (this.slideShowTimer) {
      this.cancel();
    }
    else if (this.moreThenOneTab) {
      let timerInterval = TabmixSvc.prefBranch.getIntPref("slideDelay") * 1000;
      this.slideShowTimer =  Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this.slideShowTimer.initWithCallback(this, timerInterval,
                        Ci.nsITimer.TYPE_REPEATING_SLACK);
      this.showAlert(this.slideshowOn, "slideShow");
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
    this.showAlert(this.slideshowOff, "slideShow");
  },

  get moreThenOneTab() {
    let tabs = this.tabContainer.childNodes;
    for (let count = 0, i = 0; i < tabs.length; i++) {
      if (!tabs[i].hidden && ++count == 2)
        return true;
    }
    return false;
  }
};
