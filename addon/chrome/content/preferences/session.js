var gSessionPane = {
  gSessionManager: null,
  init: function () {
    if (Tabmix.isPlatform("Linux"))
      $("sessionManager-panels").setAttribute("linux", "true");

    // disable TMP session manager setting if session manager extension is install
    this.gSessionManager = Tabmix.getTopWin().Tabmix.extensions.sessionManager;
    if (this.gSessionManager) {
      $("sessionmanager_button").setAttribute("image", "chrome://sessionmanager/skin/icon.png");
      $("sessionmanager_ext_tab").hidden = false;
      $("sessionStore_tab").hidden = true;
      $("tabmix_tab").hidden = true;
      $("paneSession-tabbox").selectedIndex = 0;
      $("chooseFile").selectedIndex = 1;
    }
    else
      TabmixSessionManager.createMenuForDialog($("onStart.popup"));

    gSetTabIndex.init('session');

    TM_Options.initBroadcasters("paneSession", true);
    TM_Options.initUndoCloseBroadcaster();
    TM_Options.setDisabled("obs_ss_postdata", $("pref_ss_postdata").value == 2);
    this.isSessionStoreEnabled(false);

    if (Tabmix.isVersion(200))
      gPrefwindow.removeChild("pref_browser.warnOnRestart");

    gCommon.setPaneWidth("paneSession");
  },

  updateSessionShortcuts: function() {
    if (typeof gMenuPane == "object")
      gMenuPane.updateSessionShortcuts();
  },

  isSessionStoreEnabled: function (checkService) {
    var browserWindow = Tabmix.getTopWin();
    if (checkService)
      browserWindow.TMP_SessionStore.setService(2, false, window);

    this.updateSessionShortcuts();
    if (this.gSessionManager)
      return;

    var sessionStoreEnabled = browserWindow.TMP_SessionStore.isSessionStoreEnabled();
    var currentState = $("sessionstore_0").checked;
    if (currentState != sessionStoreEnabled || (!checkService && !sessionStoreEnabled)) {
      $("sessionstore_0").checked = sessionStoreEnabled;
      $("sessionstore_1").checked = sessionStoreEnabled;
      $("paneSession-tabbox").selectedIndex = sessionStoreEnabled ? 1 : 2;
    }
  },

  setSessionsOptions: function (item, id) {
    var useSessionManager = !item.checked;
    $("paneSession-tabbox").selectedIndex = item.checked ? 1 : 2;
    $(id).checked = item.checked;
    $(id).focus();

    function updatePrefs(aItemId, aValue) {
      let preference = $("pref_" + aItemId);
      preference.batching = true;
      preference.value = aValue;
      preference.batching = false;
    }

    // TMP session pref
    let sessionPrefs = function() {
      updatePrefs("sessionManager", useSessionManager);
      updatePrefs("sessionCrashRecovery", useSessionManager);
      this.updateSessionShortcuts();
    }.bind(this);

    // sessionstore pref
    function sessionstorePrefs() {
      // browser.warnOnRestart remove on Firefox 20
      if (!Tabmix.isVersion(200))
        updatePrefs("browser.warnOnRestart", !useSessionManager);
      updatePrefs("browser.warnOnQuit", !useSessionManager);
      updatePrefs("resume_from_crash", !useSessionManager);
      // "browser.startup.page"
      updatePrefs("browserStartupPage", useSessionManager ? 1 : 3);
    }

    if (useSessionManager) {
      sessionstorePrefs();
      sessionPrefs();
    }
    else {
      sessionPrefs();
      sessionstorePrefs()
    }

    if (document.documentElement.instantApply)
      Services.prefs.savePrefFile(null);
  },

  sessionManagerOptions: function () {
    var browserWindow = Tabmix.getTopWin();
    browserWindow.TabmixConvertSession.sessionManagerOptions();
  },

  convertSession: function () {
    var browserWindow = Tabmix.getTopWin();
    if ($("chooseFile").selectedItem.value == 0)
      browserWindow.TabmixConvertSession.selectFile(window);
    else
     browserWindow.TabmixConvertSession.convertFile();

    window.focus();
  }

}
