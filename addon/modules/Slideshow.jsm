"use strict";

const EXPORTED_SYMBOLS = ["flst"];

const {TabmixChromeUtils} = ChromeUtils.import("chrome://tabmix-resource/content/ChromeUtils.jsm");
const {TabmixSvc} = ChromeUtils.import("chrome://tabmix-resource/content/TabmixSvc.jsm");

const lazy = {};
ChromeUtils.defineModuleGetter(lazy, "Shortcuts",
  "chrome://tabmix-resource/content/Shortcuts.jsm");

function flst() {
  this.flstOn = TabmixSvc.getString("flstOn.label");
  this.flstOff = TabmixSvc.getString("flstOff.label");
  this.slideshowOn = TabmixSvc.getString("slideshowOn.label");
  this.slideshowOff = TabmixSvc.getString("slideshowOff.label");

  // prevents eslint-plugin-tabmix import-globals.js from identify internal
  // imports as globals
  // eslint-disable-next-line no-unused-vars
  TabmixChromeUtils.defineLazyGetter(this, "tabContainer", () => {
    return TabmixSvc.topWin().gBrowser.tabContainer;
  });
}

flst.prototype = {
  showAlert(msg, id) {
    try {
      msg = msg.replace(/F8|F9/, lazy.Shortcuts.getFormattedKeyForID(id));
      let alerts = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
      alerts.showAlertNotification("chrome://tabmixplus/skin/tmp.png", "Tab Mix Plus", msg, false, "", null);
    } catch (e) { }
  },

  // toggle flst on/off
  toggle() {
    if (TabmixSvc.prefBranch.getIntPref("focusTab") != 4) {
      TabmixSvc.prefBranch.setIntPref("focusTab", 4);
      this.showAlert(this.flstOn, "toggleFLST");
    } else {
      TabmixSvc.prefBranch.setIntPref("focusTab", 2);
      this.showAlert(this.flstOff, "toggleFLST");
    }
  },

  toggleSlideshow() {
    if (this.slideShowTimer) {
      this.cancel();
    } else if (this.moreThenOneTab) {
      let timerInterval = TabmixSvc.prefBranch.getIntPref("slideDelay") * 1000;
      this.slideShowTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this.slideShowTimer.initWithCallback(this, timerInterval,
        Ci.nsITimer.TYPE_REPEATING_SLACK);
      this.showAlert(this.slideshowOn, "slideShow");
    }
  },

  notify() {
    if (this.moreThenOneTab)
      this.tabContainer.advanceSelectedTab(1, true);
    else
      this.cancel();
  },

  cancel() {
    this.slideShowTimer.cancel();
    this.slideShowTimer = null;
    this.showAlert(this.slideshowOff, "slideShow");
  },

  get moreThenOneTab() {
    let tabs = this.tabContainer.allTabs;
    for (let count = 0, i = 0; i < tabs.length; i++) {
      if (!tabs[i].hidden && ++count == 2)
        return true;
    }
    return false;
  }
};
