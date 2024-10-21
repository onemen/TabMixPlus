/* exported gSessionPane */
"use strict";

/** @type {SessionPane} */
var gSessionPane = {
  init() {
    if (TabmixSvc.isLinux)
      $("sessionManager-panels").setAttribute("linux", "true");

    // while we don't use session manager always set `Advanced Setting` as selected tab
    $("session").selectedIndex = 2;

    this.isSessionStoreEnabled(true);
    this.updateSessionShortcuts();

    gPrefWindow.initPane("paneSession");
  },

  updateSessionShortcuts() {
    if (typeof gMenuPane == "object")
      gMenuPane.updateSessionShortcuts();
  },

  isSessionStoreEnabled(onStart) {
    var sessionStoreEnabled = Services.prefs.getIntPref("browser.startup.page") == 3 ||
        Services.prefs.getBoolPref("browser.sessionstore.resume_from_crash");
    $("sessionsOptions").checked = sessionStoreEnabled;
    $("sessionsPanel").setAttribute("manager", !sessionStoreEnabled ? "tabmix" : "firefox");
    if (!onStart || sessionStoreEnabled)
      $("session").selectedIndex = sessionStoreEnabled ? 2 : 0;
    else if ($("session").selectedIndex == 2)
      $("session").selectedIndex = 0;
  },

  setSessionsOptions(item) {
    // ##### disable Session Manager #####
    item.checked = true;
    let instantApply = document.documentElement.instantApply;
    var useSessionManager = !item.checked;
    $("sessionsPanel").setAttribute("manager", useSessionManager ? "tabmix" : "firefox");

    /** @type {(aItemId: string, aValue: PreferenceValue)=>void} */
    function updatePrefs(aItemId, aValue) {
      let preference = $Pref("pref_" + aItemId);
      preference.batching = true;
      if (instantApply) {
        preference.value = aValue;
      } else {
        preference.valueFromPreferences = aValue;
        gPrefWindow.changes.delete(preference);
      }
      preference.batching = false;
    }

    // TMP session pref
    let sessionPrefs = function() {
      updatePrefs("sessionManager", useSessionManager);
      updatePrefs("sessionCrashRecovery", useSessionManager);
    };

    // sessionstore pref
    function sessionstorePrefs() {
      updatePrefs("browser.warnOnQuit", !useSessionManager);
      updatePrefs("resume_from_crash", !useSessionManager);
      // "browser.startup.page"
      updatePrefs("browserStartupPage", useSessionManager ? 1 : 3);
    }

    TabmixSvc.sm.settingPreference = true;
    if (useSessionManager) {
      sessionstorePrefs();
      sessionPrefs();
    } else {
      sessionPrefs();
      sessionstorePrefs();
    }
    TabmixSvc.sm.settingPreference = false;

    if (instantApply)
      Services.prefs.savePrefFile(null);
    else
      gPrefWindow.setButtons(!gPrefWindow.changes.size);
  },

  setSessionpath(val) {
    const menuItem = $("onStart.popup").getElementsByAttribute("value", val)[0];
    if (menuItem) {
      $Pref("pref_sessionpath").value = menuItem.getAttribute("session");
    }
  },

};
