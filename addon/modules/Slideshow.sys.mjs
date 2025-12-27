import {TabmixSvc} from "chrome://tabmix-resource/content/TabmixSvc.sys.mjs";
import {XPCOMUtils} from "resource://gre/modules/XPCOMUtils.sys.mjs";

/** @type {SlideshowModule.Lazy} */ // @ts-ignore
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  isVersion: "chrome://tabmix-resource/content/BrowserVersion.sys.mjs",
  Shortcuts: "chrome://tabmix-resource/content/Shortcuts.sys.mjs",
});

XPCOMUtils.defineLazyServiceGetters(lazy, {
  AlertsService: ["@mozilla.org/alerts-service;1", Ci.nsIAlertsService],
});

ChromeUtils.defineLazyGetter(lazy, "AlertNotification", () => {
  return Components.Constructor(
    "@mozilla.org/alert-notification;1",
    "nsIAlertNotification",
    "initWithObject"
  );
});

/** @this {SlideshowModule.Flst} */
export function flst() {
  this.flstOn = TabmixSvc.getString("flstOn.label");
  this.flstOff = TabmixSvc.getString("flstOff.label");
  this.slideshowOn = TabmixSvc.getString("slideshowOn.label");
  this.slideshowOff = TabmixSvc.getString("slideshowOff.label");

  ChromeUtils.defineLazyGetter(this, "tabContainer", () => {
    return TabmixSvc.topWin().gBrowser.tabContainer;
  });
}

/** @type {SlideshowModule.Flst} */
flst.prototype = {
  // @ts-expect-error - we use lazy getter in the constructor
  tabContainer: undefined,
  showAlert(msg, id) {
    try {
      msg = msg.replace(/F8|F9/, lazy.Shortcuts.getFormattedKeyForID(id));
      const imageURL = "chrome://tabmixplus/skin/tmp.png";
      const title = "Tab Mix Plus";
      lazy.isVersion(1470) ?
        lazy.AlertsService.showAlert(
          new lazy.AlertNotification({
            imageURL,
            title,
            text: msg,
            textClickable: false,
            cookie: id,
            name: id,
          })
        )
      : lazy.AlertsService.showAlertNotification(imageURL, title, msg, false, "", undefined, id);
    } catch (error) {
      console.log("Tabmix showAlert error:", error);
    }
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
      this.slideShowTimer.initWithCallback(this, timerInterval, Ci.nsITimer.TYPE_REPEATING_SLACK);
      this.showAlert(this.slideshowOn, "slideShow");
    }
  },

  /** @this {SlideshowModule.Flst} */
  notify() {
    if (this.moreThenOneTab) {
      this.tabContainer.advanceSelectedTab(1, true);
    } else {
      this.cancel();
    }
  },

  cancel({showAlert = true} = {}) {
    this.slideShowTimer?.cancel();
    this.slideShowTimer = undefined;
    if (showAlert) {
      this.showAlert(this.slideshowOff, "slideShow");
    }
  },

  get moreThenOneTab() {
    let visibleCount = 0;
    let tabs = this.tabContainer.allTabs;
    return tabs.some(tab => !tab.hidden && ++visibleCount === 2);
  },
};
