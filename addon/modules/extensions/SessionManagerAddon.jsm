/**
 * original code by onemen
 */

"use strict";

var EXPORTED_SYMBOLS = ["SessionManagerAddon"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://tabmixplus/Services.jsm");

let TabmixListener = {
  id: "{1280606b-2510-4fe0-97ef-9b5a22eafe30}",
  saveTabmixPrefs: function(addon) {
    this.manager_enabled = TabmixSvc.prefBranch.getBoolPref("sessions.manager");
    this.crashRecovery_enabled = TabmixSvc.prefBranch.getBoolPref("sessions.crashRecovery");
  },
  onEnabled: function(addon) {
    if (addon.id != this.id)
      return;
    this.saveTabmixPrefs();
    let win = TabmixSvc.topWin();
    if (win)
      win.TMP_SessionStore.setService(-1);
    this.notify(true);
  },
  onDisabled: function(addon) {
    if (addon.id != this.id)
      return;
    if (this.manager_enabled || this.crashRecovery_enabled) {
      let win = TabmixSvc.topWin();
      if (win)
        win.TMP_SessionStore.setSessionRestore(false);
      TabmixSvc.prefBranch.setBoolPref("sessions.manager", this.manager_enabled);
      TabmixSvc.prefBranch.setBoolPref("sessions.crashRecovery", this.crashRecovery_enabled);
    }
    this.notify(false);
  },
  onInstalled: function(addon) {
    if (addon.id != this.id ||
        !addon.isActive || addon.userDisabled || addon.appDisabled)
      return;
    this.onEnabled(addon);
  },
  notify: function(isActive) {
    // in preference/session.js we only care when the preference is boolean
    let pref = "sessionManagerAddon.isActive";
    TabmixSvc.prefBranch.setBoolPref(pref, isActive);
    TabmixSvc.prefBranch.clearUserPref(pref);
  }
}

let SessionManagerAddon = {
  initialized: false,
  init: function() {
    if (this.initialized)
      return;
    this.initialized = true;
    TabmixListener.saveTabmixPrefs();
    AddonManager.addAddonListener(TabmixListener);
  }
}

SessionManagerAddon.init();
