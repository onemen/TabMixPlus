/***** Preference Dialog Functions *****/
const Cc = Components.classes;
const Ci = Components.interfaces;
var gPrefs, newTabURLpref, replaceLastTabWithNewTabURLpref;
var instantApply;
Components.utils.import("resource://tabmixplus/Shortcuts.jsm");

function $(id) document.getElementById(id);

function before_Init() {
  if (Tabmix.isPlatform("Mac")) {
    var label = $("tabId").getAttribute("label2");
    $("tabId").setAttribute("label", label);

    $("tabpanId").setAttribute("Mac", true);
  }

  var topWindow = Tabmix.getTopWin();
  var ctrlTab = topWindow.document.getElementById("ctrlTab-panel") && "ctrlTab" in topWindow;
  if (!ctrlTab) {
     var tabPreviews = $("ctrltab.tabPreviews");
     tabPreviews.parentNode.removeChild(tabPreviews);
  }

  /* Chromifox theme force button height to 25px */
  var skin = Services.prefs.getCharPref("general.skins.selectedSkin");
  if (skin == "cfxec")
    $("pref-tabmix").setAttribute("chromifox", true);

  /* we don't need to fix tabpanels border in ubuntu */
  if (navigator.userAgent.toLowerCase().indexOf("ubuntu") > -1) {
     let panels = document.documentElement.getElementsByAttribute("class" , "groupbox-panels");
     for (let i = 0, num = panels.length; i < num; i++) {
        panels[0].removeAttribute("class");
     }
  }

  gIncompatiblePane.checkForIncompatible(false);

  instantApply = document.documentElement.instantApply ||
     Services.prefs.getBoolPref("browser.preferences.instantApply");
  TMP_setButtons(true, true, true);

  // Bug 455553 - New Tab Page feature - landed on 2012-01-26 (Firefox 12)
  newTabURLpref = topWindow.Tabmix.newTabURLpref;
  replaceLastTabWithNewTabURLpref = "extensions.tabmix.replaceLastTabWith.newTabUrl";
  if (newTabURLpref == "browser.newtab.url") {
    Tabmix.setItem("newTabUrl", "prefstring", newTabURLpref);
    replaceLastTabWithNewTabURLpref = "extensions.tabmix.replaceLastTabWith.newtab.url";
    Tabmix.setItem("newTabUrl_1", "prefstring", replaceLastTabWithNewTabURLpref);
  }

  // there are heights diffrenet in our dialog window when Firefox starts with
  // gfx.direct2d.disabled true or false
  if (TabmixSvc.direct2dDisabled) {
    document.documentElement.setAttribute("minheight", 483);
    $("sessionManager-panels").setAttribute("style", "padding-bottom: 4px;");
    $("sessionManager-separator").setAttribute("style", "height: 12px;");
  }
  if (Tabmix.isPlatform("Linux"))
    $("sessionManager-panels").setAttribute("linux", "true");

  // firefox 18 (bug 769101) changed browser.dtd pinAppTab.label to pinTab.label
  var pinTabLabel = topWindow.document.getElementById("context_pinTab").getAttribute("label") + "/"
                  + topWindow.document.getElementById("context_unpinTab").getAttribute("label");
  $("ClickTabPinTab").label = pinTabLabel;
  $("togglePinTab").setAttribute("label", pinTabLabel);
  $("pinTab").label = pinTabLabel;

  if (Services.prefs.getCharPref("general.skins.selectedSkin") == "Australis")
    $("TM_ButtonBox").setAttribute("australis", true);

  if (Tabmix.isVersion(200)) {
    let item = $("browser.warnOnRestart");
    item.parentNode.removeChild(item);
  }
}

// load all preferences into the dialog
function TM_EMinit() {
  var browserWindow = Tabmix.getTopWin();

  getTab();

  // add EventListener when we start
  window.addEventListener("unload", setLastTab, false);
  window.addEventListener("command", userChangedValue, false);
  window.addEventListener("input", userChangedValue, false);
  window.addEventListener("change", userChangedValue, false);

  if (Tabmix.isVersion(130)) {
    let cmSearch = $("contextMenuSearch");
    cmSearch.hidden = false;
    cmSearch.setAttribute("prefstring", "browser.search.context.loadInBackground");
  }
  if (!Tabmix.isVersion(170))
    $("moveTabOnDragging").hidden = true;

  gPrefs =  document.getElementsByAttribute("prefstring", "*");

  // disable TMP session manager setting if session manager extension is install
  if (browserWindow.Tabmix.extensions.sessionManager) {
    $("sessionmanager_button").setAttribute("image", "chrome://sessionmanager/skin/icon.png");
    $("sessionmanager_ext_tab").hidden = false;
    $("sessionStore_tab").hidden = true;
    $("tabmix_tab").hidden = true;
    $("paneSession-tabbox").selectedIndex = 0;
    $("chooseFile").selectedIndex = 1;
  }
  else {
    // create saved Session popup menu
    var popup = $("onStart.popup");
    TabmixSessionManager.createMenuForDialog(popup);
  }

  // disable options for position the tabbar and scroll mode if TreeStyleTab extension
  // or other vertical tabs extensions installed
  if (browserWindow.Tabmix.extensions.verticalTabBar) {
    Tabmix.setItem("treeStyleTab.msg", "hidden", null);
    Tabmix.setItem("tabBarDisplay", "TSTinstalled", true);
    Tabmix.setItem("tabBarPosition", "disabled", true);
    Tabmix.setItem("tabScroll", "disabled", true);
    Tabmix.setItem("scrollDelay", "disabled", true);
    Tabmix.setItem("smoothScroll", "disabled", true);
  }

  // Init tabclicking options
  var menuPopup = $("ClickTab").firstChild;
  // block item in tabclicking options that are not in use
  var blocked = browserWindow.gTMPprefObserver.blockedValues;
  for (let i = 0; i < blocked.length; i++) {
    let item = menuPopup.getElementsByAttribute("value", blocked[i])[0];
    item.hidden = true;
  }
  $("ClickTabbar").appendChild(menuPopup.cloneNode(true));

  // verify that all the prefs exist .....
  browserWindow.gTMPprefObserver.addMissingPrefs();

  TM_setElements(false, true);
  gAppearancePane.toolbarButtons(browserWindow);
  // check if apply is on
  // apply changes if we set single window mode status
  TM_EMsave();

  var tabclicking = $("tabclicking_tabs");
  // change tab label on Mac. trigger onselect before broadcaster is set
  // so we add the onselect here
  tabclicking.addEventListener("select", tabSelectionChanged, false);

  // for locals with long labels
  var hbox = $("focusTab-box");
  var label = $("focusTab-label").boxObject.width;
  var menulist = $("focusTab");
  if (hbox.boxObject.width > label + menulist.boxObject.width) {
    menulist.parentNode.removeAttribute("pack");
    hbox.setAttribute("orient", "horizontal");
    hbox.setAttribute("align","center");
  }

  hbox = $("tabScroll-box");
  label = $("tabScroll.label").boxObject.width;
  var menulist = $("tabScroll");
  var indent = 23; // we have class="indent"
  if (hbox.boxObject.width > label + menulist.boxObject.width - indent) {
    menulist.parentNode.removeAttribute("pack");
    menulist.parentNode.removeAttribute("class");
    hbox.setAttribute("orient", "horizontal");
    hbox.setAttribute("align","center");
  }

  // rtl update
  var direction = window.getComputedStyle($("pref-tabmix"), null).direction;
  if (direction == "rtl") {
    let right = $("newTabButton.posiotion.right");
    let left = $("newTabButton.posiotion.left");
    let [rightLabel, leftLabel] = [right.label, left.label];
    [right.label, left.label] = [leftLabel, rightLabel];

    let focusTab = $("focusTab").firstChild.childNodes;
    [rightLabel, leftLabel] = [focusTab[2].label, focusTab[1].label];
    [focusTab[2].label, focusTab[1].label] = [leftLabel, rightLabel];
    // "opener/left"
    focusTab[5].label = focusTab[5].getAttribute("rtlLabel");

    let tabScroll = $("tabScroll").firstChild.childNodes;
    tabScroll[2].label = tabScroll[2].getAttribute("rtlLabel");

    let tabXLeft = $("tabXLeft");
    tabXLeft.label = tabXLeft.getAttribute("rtlLabel");
  }

  // align Tab opening group boxes
  var vbox1 = $("tabopening1");
  var vbox2 = $("tabopening2");
  var vbox3 = $("tabopening3");
  var max = Math.max(vbox1.boxObject.width, vbox2.boxObject.width, vbox3.boxObject.width);
  vbox1.style.setProperty("width",max + "px", "important");
  vbox2.style.setProperty("width",max + "px", "important");
  vbox3.style.setProperty("width",max + "px", "important");

  if (Tabmix.isPlatform("Linux"))
     sizeToContent();

  window.setTimeout( function () { window.focus();}, 0 );
}

// save all preferences entered into the dialog
function TM_EMsave(onApply) {
  // we only need to save if apply is enabled
  if (!onApply && document.documentElement.getButton("extra1").disabled)
    return true;

  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);

  TM_Options.singleWindow( $("singleWindow").checked );
  TM_Options.setTabXUI();
  TM_verifyWidth();
  TM_Options.verify_PostDataBytes();

  document.documentElement.getButton("accept").focus();
  TMP_setButtons(true, false);

  Shortcuts.prefsChangedByTabmix = true;
  if (!("undefined" in applyData)) {
    for (var _pref in applyData)
      setPrefByType(_pref, applyData[_pref]);
  }
  else {
    // this part is only if the applayData fail for some unknown reason
    // we don't supposed to get here
    for (var i = 0; i < gPrefs.length; ++i )
      setPrefByType(gPrefs[i].getAttribute("prefstring"), getValue(gPrefs[i]));
  }
  Shortcuts.prefsChangedByTabmix = false;

  applyData = [];
  Tabmix.prefs.clearUserPref("setDefault"); // this trigger TabmixTabbar.updateSettings
  TM_Options.isSessionStoreEnabled(true);

  callUpdateSettings();

  Services.prefs.savePrefFile(null); // store the pref immediately
  return true;
}

function callUpdateSettings() {
  var pref = "PrefObserver.error";
  if (Tabmix.prefs.prefHasUserValue(pref) && Tabmix.prefs.getBoolPref(pref)) {
    var wnd, enumerator = Tabmix.windowEnumerator();
    while (enumerator.hasMoreElements()) {
      wnd = enumerator.getNext();
      wnd.TabmixTabbar.updateSettings();
    }
  }
}

function TM_verifyWidth() {
   var minWidth = $("minWidth");
   var maxWidth = $("maxWidth");

   var minValue = minWidth.value;
   var maxValue = maxWidth.value;

   if (maxValue - minValue < 0) {
      minWidth.value = maxValue;
      maxWidth.value = minValue;
   }

   if (minWidth.value < 16)
     minWidth.value = 16;

   if (minValue != minWidth.value)
      updateApplyData(minWidth);

   if (maxValue != maxWidth.value)
      updateApplyData(maxWidth);

}

var TM_Options = {
   checkDependant: function(start) {

      this.singleWindow( $("singleWindow").checked );

      let external = $("externalLinkTarget");
      let checked = external.value != -1;
      external.firstChild.firstChild.hidden = checked;
      $("externalLink").checked = checked;

      var broadcasters = $("disabled:Broadcaster");
      for (var i = 0; i < broadcasters.childNodes.length; ++i ) {
         var _id = broadcasters.childNodes[i].id.replace("obs_", "");
         this.disabled(_id, start);
      }

      this.setTabXUI();
      this.addTabXUI();
      this.selectTab();
      this.tabScroll();
      this.speLink();
      this.newTabUrl($("loadOnNewTab"), false, false);
      this.setShowTabList();
      this.setDisabeled_replaceLastTabWith();
      this.isSessionStoreEnabled(false);

      this.setDisabled("obs_ss_postdata", $("ss_postdata").value == 2);
   },

   disabled: function(itemOrId, start) {
      var item = typeof(itemOrId) == "string" ? $(itemOrId) : itemOrId;
      var val;
      if (item.hasAttribute("disableObserver"))
        val = true;
      else
        val = item.getAttribute("inverseDependency") ? item.checked : !item.checked;
      if (start && !val)
         return;
      this.setDisabled("obs_" + item.id, val);
   },

   setDisabled: function(id, val) {
      // remove disabled when the value is false
      Tabmix.setItem(id, "disabled" , val || null);
   },

   externalLinkValue: function(checked) {
     let external = $("externalLinkTarget");
     let node = $("generalWindowOpen");
     if (checked) {
       let prefValue = Services.prefs.getIntPref("browser.link.open_newwindow.override.external");
       external.value = prefValue > -1 ? prefValue : node.value;
     }
     else
       external.value = -1;
     external.firstChild.firstChild.hidden = checked;
     updateApplyData(external, external.value);
   },

   newTabUrl: function(item, disable, setFocus) {
      var showTabUrlBox = item.selectedItem.value == 4;
      var idnum = item.getAttribute("idnum") || "" ;
      this.setDisabled("newTabUrlLabel" + idnum, !showTabUrlBox || disable);
      this.setDisabled("newTabUrl" + idnum, !showTabUrlBox || disable);
      if (setFocus && showTabUrlBox)
         $("newTabUrl" + idnum).focus();
   },

   setDisabeled_replaceLastTabWith: function() {
      // we disable replaceLastTabWith if one of this test is true
      // browser.tabs.closeWindowWithLastTab == true OR
      // extensions.tabmix.keepLastTab = true
      var closeWindow = !$("keepWindow").checked // inverted pref;
      var keepLastTab = $("keepLastTab");
      var disable = closeWindow || keepLastTab.checked;
      this.setDisabled("obs_replaceLastTabWith", disable);
      this.newTabUrl($("replaceLastTabWith"), disable, !disable);
   },

   addTabXUI: function() {
      var tabXValue = $("addTabXUI").selectedItem.value;
      Tabmix.setItem("tabXdelaycheck", "hidden", tabXValue != 2 && tabXValue != 4);
      Tabmix.setItem("tabXwidthBox", "hidden", tabXValue != 5);
   },

   setTabXUI: function() {
      if ($("flexTabs").checked) {
         $("alltabsItem").hidden = true;
         var tabXUI = $("addTabXUI");
         if ( tabXUI.selectedItem.value == 5) {
            updateApplyData(tabXUI, 1);
            Tabmix.setItem("tabXwidthBox", "hidden", true);
         }
      }
      else
        $("alltabsItem").hidden = false;
   },

   setAllTabsItemVisibility: function(aShow) {
      if ($("flexTabs").checked)
         $("alltabsItem").hidden = !aShow;
      else
        $("alltabsItem").hidden = false;
   },

   selectTab: function() {
      var focusType = $("selectTab").checked ? "bg":"fg";
      var val = $("showInverseLink").getAttribute(focusType+"label");
      Tabmix.setItem("showInverseLink", "label", val);
   },

   tabScroll: function() {
      var multiRow = $("tabScroll").value == 2;
      $("maxbar").hidden = !multiRow;
      $("offsetAmountToScroll").hidden = multiRow;
   },

   speLink: function() {
      var spelink = $("speLink").selectedItem.value;
      $("inverselinks").disabled =  spelink != 2 && $("midcurrent").checked;
   },

   singleWindow: function(enableSingleWindow) {
      function updateStatus(itemId, testVal, test, newVal) {
         var item = $(itemId);
         test = test ? item.value == testVal : item.value != testVal
         if ( test ) {
            updateApplyData(item, newVal);
         }
      }
      if ( enableSingleWindow ) {
         updateStatus("generalWindowOpen", 2, true, 3);
         updateStatus("externalLinkTarget", 2, true, 3);
         updateStatus("divertedWindowOpen", 0, false, 0);
      }
   },

   verify_PostDataBytes: function() {
      var ss_postdatabytes = $("ss_postdatabytes");
      var val = ss_postdatabytes.value;
      if (val == "-" || val == "") {
         updateApplyData(ss_postdatabytes, val == "" ? "0" : "-1");
      }
   },

   updateSessionShortcuts: function() {
      let block = !$("sessionManager").checked || Shortcuts.permanentPrivateBrowsing;
      $("saveWindow").blocked = block;
      $("saveSession").blocked = block;
   },

   isSessionStoreEnabled: function (checkService) {
      var browserWindow = Tabmix.getTopWin();
      if (checkService)
        browserWindow.TMP_SessionStore.setService(2, false, window);

      this.updateSessionShortcuts();
      if (browserWindow.Tabmix.extensions.sessionManager)
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
         var item = $(aItemId);
         updateApplyData(item, aValue);
      }

      // TMP session pref
      let sessionPrefs = function() {
         updatePrefs("sessionManager", useSessionManager);
         updatePrefs("sessionCrashRecovery", useSessionManager);
         this.updateSessionShortcuts();
      }.bind(this);

      // sessionstore pref
      function sessionstorePrefs() {
         if (!Tabmix.isVersion(200))
           updatePrefs("browser.warnOnRestart", !useSessionManager);
         updatePrefs("browser.warnOnQuit", !useSessionManager);
         updatePrefs("resume_from_crash", !useSessionManager);
         // "browser.startup.page"
         updatePrefs("browserStartupPage", useSessionManager ? 1 : 3);
         updatePrefs("browserStartupPage1", useSessionManager ? 1 : 3);
      }

      if (useSessionManager) {
        sessionstorePrefs();
        sessionPrefs();
      }
      else {
        sessionPrefs();
        sessionstorePrefs()
      }
   },

   setSessionpath: function (popup) {
      var val = popup.parentNode.selectedItem.value;
      var sessionpath = $("sessionpath");
      sessionpath.value = popup.getElementsByAttribute("value", val)[0].getAttribute("session");
      updateApplyData(sessionpath);
   },

   setUndoCloseCache: function (item) {
      var undoCloseCache = $("undoCloseCache");
      var currentValue = undoCloseCache.value;
      var newValue = item.checked ? 10 : 0;
      if (newValue != currentValue) {
        updateApplyData(undoCloseCache, newValue);
      }
   },

   setUndoClose: function (item) {
      if (item.value == "")
        item.value = 0;

      if (item.value == 0) {
        var undoClose = $("undoClose_checkbox");
        undoClose.checked = false;
        this.disabled(undoClose);
        this.setUndoCloseCache(undoClose);
      }
   },

   setShowTabList: function () {
      var disableShowTabList = $("ctrltab").checked &&
                                $("ctrltab.tabPreviews").checked;
      this.setDisabled("showTabList", disableShowTabList);
      if (!$("obs_showTabList").hasAttribute("disabled"))
        this.setDisabled("respondToMouse", disableShowTabList);
   },

   updateShortcuts: function (aShortcuts, aCallBack) {
      let boxes = Array.filter(aShortcuts.childNodes, aCallBack);
      $("shortcuts-panel").setAttribute("usedKeys", boxes.length > 0);
      TM_Options.syncSlideShowControl();
   },

   syncSlideShowControl: function () {
     let tabRotation = $("tabRotation"), slideShow = $("slideShow");
     if (tabRotation.hasAttribute("_label")) {
       let label = tabRotation.getAttribute("_label").split("#1");
       tabRotation.label = label[0];
       $("slideshow.labelEnd").value = label[1];
       tabRotation.removeAttribute("_label");
     }
     $("slideshow.link").value = getFormattedKey(slideShow.key) || "???";
     tabRotation.checked = !slideShow.disabled;
     TM_Options.disabled(tabRotation);
   },

   // for shortcuts panel
   toggleLinkLabel: function(item) {
      var panel = $("shortcuts-panel");
      var wasShow = panel.getAttribute(item.id) == 'false';
      item.value = item.getAttribute(wasShow ? 'show' : 'hide');
      panel.setAttribute(item.id, wasShow);
   }
}

// other settings not in the main option dialog
var otherPref = ["unreadTabreload","reload_time","custom_reload_time",
                  "filetype","sessions.menu.showext","disableIncompatible","hideIcons",
                  "styles.currentTab","styles.unloadedTab",
                  "styles.unreadTab","styles.otherTab","styles.progressMeter"];

function TM_defaultSetting () {
  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);

  Shortcuts.prefsChangedByTabmix = true;
  TM_setElements(true);
  Shortcuts.prefsChangedByTabmix = false;
  TMP_setButtons(true, true);

  // reset other settings to default
  for (let i = 0; i < otherPref.length; ++i)
    Tabmix.prefs.clearUserPref(otherPref[i]);

  Tabmix.prefs.clearUserPref("setDefault");
  TM_Options.isSessionStoreEnabled(true);
  callUpdateSettings();

  Services.prefs.savePrefFile(null); // store the pref immediately
}

const PrefFn = {0: "", 32: "CharPref", 64: "IntPref", 128: "BoolPref"};
function getPrefByType(prefName) {
  try {
    var fn = PrefFn[Services.prefs.getPrefType(prefName)];
    return Services.prefs["get" + fn](prefName);
  } catch (ex) {
    Tabmix.log("can't read preference " + prefName + "\n" + ex, true);
  }
  return null;
}

function setPrefByType(prefName, newValue, atImport) {
  let pref = {name: prefName, value: newValue,
              type: Services.prefs.getPrefType(prefName)}
  try {
    if (atImport && setPrefAfterImport(pref))
      return;
    Services.prefs["set" + PrefFn[pref.type]](prefName, pref.value);
  } catch (ex) {
    Tabmix.log("can't write preference " + prefName + "\nvalue " + pref.value +
      "\n" + ex, true);
  }
}

function setPrefAfterImport(aPref) {
  // in prev version we use " " for to export string to file
  aPref.value = aPref.value.replace(/^"*|"*$/g, "");

  // preference that exist in the defaulbranch but no longer in use by Tabmix
  switch (aPref.name) {
  case "browser.tabs.autoHide":
    // from tabmix 0.3.6.0.080223 we use extensions.tabmix.hideTabbar
    Tabmix.prefs.setIntPref("hideTabbar", aPref.value ? 1 : 0);
    return true;
  case "browser.tabs.closeButtons":
    // we use browser.tabs.closeButtons only in 0.3.8.3
    if (aPref.value < 0 || aPref.value > 6)
      aPref.value = 6;
    aPref.value = [3,5,1,1,2,4,1][aPref.value];
    Tabmix.prefs.setIntPref("tabs.closeButtons", aPref.value);
    return true;
  case "extensions.tabmix.newtab.url":
    if (newTabURLpref == "browser.newtab.url") {
      setNewTabUrl("browser.newtab.url", aPref.value);
      return true;
    }
  case "extensions.tabmix.replaceLastTabWith.newTabUrl":
    if (newTabURLpref == "browser.newtab.url") {
      setNewTabUrl("extensions.tabmix.replaceLastTabWith.newtab.url", aPref.value);
      return true;
    }
  }

  // don't do anythis if user locked a preference
  if (Services.prefs.prefIsLocked(aPref.name))
    return true;
  // replace old preference by setting new value to it
  // and call gTMPprefObserver.updateSettings to replace it.
  if (aPref.type == Services.prefs.PREF_INVALID) {
    let type = parseInt(aPref.value) ? 64 : /true|false/i.test(aPref.value) ? 128 : 32;
    if (type == 128)
      aPref.value = /true/i.test(aPref.value);
    let prefsUtil = Tabmix.getTopWin().gTMPprefObserver;
    prefsUtil.preventUpdate = true;
    Services.prefs["set" + PrefFn[type]](aPref.name, aPref.value);
    prefsUtil.preventUpdate = false;
    prefsUtil.updateSettings();
    // remove the preference in case updateSettings did not handle it
    Services.prefs.clearUserPref(aPref.name);
    return true;
  }
  if (aPref.type == Services.prefs.PREF_BOOL)
    aPref.value = /true/i.test(aPref.value);

  return false;
}

function setNewTabUrl(newPref, newValue) {
  if (newValue != "") {
    let nsISupportsString = Ci.nsISupportsString;
    let str = Cc["@mozilla.org/supports-string;1"].createInstance(nsISupportsString);
    str.data = newValue;
    Services.prefs.setComplexValue(newPref, nsISupportsString, str);
  }
}

function TM_setElements (restore, start) {
   for (var i = 0; i < gPrefs.length; ++i ) {
      var item = gPrefs[i];
      var pref = item.getAttribute("prefstring");

      if (restore)
        Services.prefs.clearUserPref(pref);

      var prefValue = getPrefByType(pref);
      switch (item.localName) {
         case "checkbox":
            if (item.hasAttribute("inverted"))
               prefValue = !prefValue;
            item.checked = prefValue;
            break;
         case "radiogroup":
            if (item.hasAttribute("boolean"))
               prefValue = prefValue ? 0 : 1;
            item.selectedIndex = prefValue;
            break;
         default:
            item.value = prefValue;
      }
   }

   setSelectedIndex($("tabclicking_tabs").selectedIndex);
   TM_Options.checkDependant(start);

   // initialize shortcuts
   if (start && !Shortcuts.keys.browserReload.id)
      $("browserReload").hidden = true;
   let shortcuts = $("shortcut-group");
   shortcuts.keys = Tabmix.JSON.parse(shortcuts.value);
   let callBack = function(shortcut) shortcut.valueFromPreferences(Shortcuts.keys[shortcut.id]);
   TM_Options.updateShortcuts(shortcuts, callBack)
}

function exportData() {

  TM_EMsave();

  var patterns = new Array;
  patterns[0] = "tabmixplus";
  var z = 1, pref;

  for (var i = 0; i < gPrefs.length; ++i ) {
     pref = gPrefs[i].getAttribute("prefstring");
     patterns[z++] = pref + "=" + getPrefByType(pref);
  }

  // more pref to save
  for (i = 0; i < otherPref.length; ++i ){
    pref = "extensions.tabmix." + otherPref[i];
    patterns[z++] = pref + "=" + getPrefByType(pref);
  }

  saveToFile(patterns);
}

function saveToFile (patterns) {
  const nsIFilePicker = Ci.nsIFilePicker;
  var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  var fpCallback = function fpCallback_done(aResult) {
    if (aResult != nsIFilePicker.returnCancel) {
      let file = fp.file;
      if (!/\.txt$/.test(file.leafName.toLowerCase()))
        file.leafName += ".txt";
      if (file.exists())
        file.remove(true);
      file.create(file.NORMAL_FILE_TYPE, parseInt("0666", 8));
      let stream = Cc["@mozilla.org/network/file-output-stream;1"].
                   createInstance(Ci.nsIFileOutputStream);
      stream.init(file, 0x02, 0x200, null);
      for (let i = 0; i < patterns.length ; i++) {
        patterns[i]=patterns[i]+"\n";
        stream.write(patterns[i], patterns[i].length);
      }
      stream.close();
    }
  }

  fp.init(window, null, nsIFilePicker.modeSave);
  fp.defaultExtension = "txt";
  fp.defaultString = "TMPpref";
  fp.appendFilters(nsIFilePicker.filterText);
  if (Tabmix.isVersion(180))
    fp.open(fpCallback);
  else
    fpCallback(fp.show());
}

var oldStylePrefs = {currentTab: {}, unreadTab: {}, progressMeter: {}, found: false};
function importData () {
   const nsIFilePicker = Ci.nsIFilePicker;
   var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
   var fpCallback = function fpCallback_done(aResult) {
      if (aResult != nsIFilePicker.returnCancel) {
         let stream = Cc["@mozilla.org/network/file-input-stream;1"].
                      createInstance(Ci.nsIFileInputStream);
         stream.init(fp.file, 0x01, parseInt("0444", 8), null);
         let streamIO = Cc["@mozilla.org/scriptableinputstream;1"].
                        createInstance(Ci.nsIScriptableInputStream);
         streamIO.init(stream);
         let input = streamIO.read(stream.available());
         streamIO.close();
         stream.close();
         if (input)
           loadData(input.replace(/\r\n/g, "\n").split("\n"));
      }
   }

   fp.init(window, null, nsIFilePicker.modeOpen);
   fp.appendFilters(nsIFilePicker.filterText);
   if (Tabmix.isVersion(180))
      fp.open(fpCallback);
   else
      fpCallback(fp.show());
}

function loadData (pattern) {
   if (pattern[0]!="tabmixplus") {
      //  Can not import because it is not a valid file.
      alert(TabmixSvc.getString("tmp.importPref.error1"));
      return;
   }

   // set flag to prevent TabmixTabbar.updateSettings from run for each change
   Tabmix.prefs.setBoolPref("setDefault", true);

   // disable both Firefox & Tabmix session manager to prevent our prefs observer to block the change
   Tabmix.prefs.setBoolPref("sessions.manager", false);
   Tabmix.prefs.setBoolPref("sessions.crashRecovery", false);
   Services.prefs.setBoolPref("browser.sessionstore.resume_from_crash", false);
   Services.prefs.setIntPref("browser.startup.page", false);
   Services.prefs.savePrefFile(null);

   var prefName, prefValue;
   Shortcuts.prefsChangedByTabmix = true;
   for (let i = 1; i < pattern.length; i++){
      var index = pattern[i].indexOf("=");
      if (index > 0){
         prefName  = pattern[i].substring(0,index);
         prefValue = pattern[i].substring(index+1,pattern[i].length);
         setPrefByType(prefName, prefValue, true);
      }
   }
   Shortcuts.prefsChangedByTabmix = false;
   var browserWindow = Tabmix.getTopWin();
   browserWindow.gTMPprefObserver.updateTabClickingOptions();
   if (oldStylePrefs.found) {
      browserWindow.gTMPprefObserver.converOldStylePrefs("currentTab", oldStylePrefs.currentTab);
      browserWindow.gTMPprefObserver.converOldStylePrefs("unreadTab", oldStylePrefs.unreadTab);
      browserWindow.gTMPprefObserver.converOldStylePrefs("progressMeter", oldStylePrefs.progressMeter);
      oldStylePrefs = {currentTab: {}, unreadTab: {}, progressMeter: {}, found: false};
   }
   Tabmix.prefs.clearUserPref("setDefault");

   TM_setElements(false);
   TMP_setButtons(true, true);

   TM_Options.isSessionStoreEnabled(true);
   callUpdateSettings();

   Services.prefs.savePrefFile(null); // store the pref immediately
}

function sessionManagerOptions() {
   var browserWindow = Tabmix.getTopWin();
   browserWindow.TabmixConvertSession.sessionManagerOptions();
}

function convertSession() {
   var browserWindow = Tabmix.getTopWin();
   if ($("chooseFile").selectedItem.value == 0)
      browserWindow.TabmixConvertSession.selectFile(window);
   else
      browserWindow.TabmixConvertSession.convertFile();

   this.focus();
}

var applyData = [];
function userChangedValue(aEvent) {
   var item = aEvent.target;

   // only allow event from this item to go on....
   var n = item.localName;
   if (n == "radio" && item.hasAttribute("pane"))
      return;

   if (["radio","menuitem","checkbox","textbox"].indexOf(n) == -1)
     return;

   if (n == "checkbox" && $("obs_" + item.id))
     TM_Options.disabled(item);

   // if we fail once no need to continue and we keep the apply button enable
   if ("undefined" in applyData)
      return;

   // set item for menuitem
   if (n == "menuitem")
     item = item.parentNode.parentNode;
   // set item for radio
   else if (n == "radio")
     item = item.parentNode;

   if (item.hasAttribute("prefstring_item")) {
     let itemId = item.getAttribute("prefstring_item");
     if (itemId == "no_prefstring")
       return;
     else {
       item = $(itemId);
       item.value = aEvent.target.value; // we don't use this for checkbox
     }
   }

   if (item.hasAttribute("prefstring"))
      updateApplyData(item);
   else {
      Tabmix.log("erorr in tabmix options, item.id " + aEvent.target.id + "\n has no prefstring");
      applyData["undefined"] = true;
      TMP_setButtons(false);
   }
}

// return value from item
function getValue(item) {
   if (item.localName == "checkbox")
      return item.hasAttribute("inverted") ? !item.checked : item.checked;
   if (item.hasAttribute("boolean"))
      return item.selectedIndex == 0;

   return item.value;
}

// set value to item
function setValue(item, newValue) {
   if (item.localName == "checkbox")
      item.checked = item.hasAttribute("inverted") ? !newValue : newValue;
   else
      item.value = newValue;
}

function updateApplyData(item, newValue) {
   if (typeof(newValue) == "undefined")
     newValue = getValue(item);
   else
     setValue(item, newValue);

   var pref = item.getAttribute("prefstring");
   var savedValue = getPrefByType(pref);

   if (savedValue != newValue) {
     // instant apply except when user change min/max width value
     if (instantApply && item.id != "minWidth" && item.id != "maxWidth") {
       Shortcuts.prefsChangedByTabmix = true;
       setPrefByType(pref, newValue);
       Services.prefs.savePrefFile(null);
       Shortcuts.prefsChangedByTabmix = false;
       return;
     }
     else
      applyData[pref] = newValue;
   }
   else if (pref in applyData)
      delete applyData[pref];

   var applyDataIsEmpty = Object.keys(applyData).length == 0;
   var applyButton = document.documentElement.getButton("extra1");
   if (applyButton.disabled != applyDataIsEmpty)
     TMP_setButtons(applyDataIsEmpty);
}

function TMP_setButtons(disable, clearData, start) {
   var docElt = document.documentElement;
   var applyButton = docElt.getButton("extra1");
   var acceptButton = docElt.getButton("accept");
   var cancelButton = docElt.getButton("cancel");
   if (start) {
      let settingsButton = docElt.getButton("extra2");
      settingsButton.id = "myExtra2";
      settingsButton.className += " tabmix-button";
      settingsButton.label = docElt.getAttribute("setingsbuttonlabel");
      settingsButton.setAttribute("popup", "tm-settings");

      let helpButton = docElt.getButton("help");
      helpButton.className += " tabmix-button";
      helpButton.id = "helpButton";

      acceptButton.id = "myAccept";
      acceptButton.className += " tabmix-button";

      applyButton.id = "myApply";
      applyButton.className += " tabmix-button";
      applyButton.setAttribute("icon", "apply");

      cancelButton.id = "myCancel";
      cancelButton.className += " tabmix-button";
      docElt.setAttribute("cancelbuttonlabel", cancelButton.label);

      var spacer = document.getAnonymousElementByAttribute(docElt, "anonid", "spacer");
      spacer.hidden = false;
   }

   // when in instantApply mode apply and accept buttons are hidden except when user
   // change min/max width value
   applyButton.disabled = disable;
   applyButton.hidden = instantApply && disable;
   acceptButton.hidden = disable;

   // no buttons on Mac except Help in instantApply mode
   cancelButton.hidden = Tabmix.isPlatform("Mac") && instantApply && disable;

   var action = disable ? "close" : "cancel"
   cancelButton.label = docElt.getAttribute(action + "buttonlabel");
   cancelButton.setAttribute("icon", action);

   if (clearData)
      applyData = [];
}

function setLastTab(event) {
try {
   // remove EventListener when we exit
   window.removeEventListener("unload", setLastTab, false);
   window.removeEventListener("command", userChangedValue, false);
   window.removeEventListener("input", userChangedValue, false);
   window.removeEventListener("change", userChangedValue, false);
   $("tabclicking_tabs").removeEventListener("select", tabSelectionChanged, false);

   Tabmix.prefs.setIntPref("selected_tab", $("tabMixTabBox").selectedIndex);
   var subtabs = document.getElementsByAttribute("subtub", "true");
   var subTab = "selected_sub_tab";
   for (var i = 0; i < subtabs.length; i++)
      Tabmix.prefs.setIntPref(subTab + subtabs[i].getAttribute("value"), subtabs[i].selectedIndex);

  Services.prefs.savePrefFile(null); // store the pref immediately

} catch(ex) {}
}

function getTab() {
try {
   var selTabindex = Tabmix.getIntPref("selected_tab" , 0, true);
   showPane(selTabindex);

   var subtabs = document.getElementsByAttribute("subtub", true);
   var subTab = "extensions.tabmix.selected_sub_tab";
   for (var i = 0; i < subtabs.length; i++) {
      var val = Tabmix.getIntPref(subTab + subtabs[i].getAttribute("value"), 0);
      subtabs[i].selectedIndex = val;
   }
} catch(ex) {Tabmix.log(ex);}
}

// this function is called from here and from Tabmix.openOptionsDialog if the dialog already opened
function showPane(aSelTab) {
  var tabbox = $("tabMixTabBox");
  tabbox.lastselectedIndex = tabbox.selectedIndex;
  tabbox.selectedIndex = (aSelTab) ? aSelTab : 0;
  $("TM_ButtonBox").selectedIndex = tabbox.selectedIndex;
}

var gIncompatiblePane = {
  checkForIncompatible: function (aShowList) {
     let tmp = { };
     Components.utils.import("resource://tabmixplus/extensions/CompatibilityCheck.jsm", tmp);
     new tmp.CompatibilityCheck(window, aShowList, true);
  },

  // call back function from CompatibilityCheck.jsm
  hide_IncompatibleNotice: function (aHide, aFocus) {
    var button = $("buttonIncompatible");
    if (button.collapsed != aHide) {
      button.collapsed = aHide;
      $("incompatible_panel").collapsed = aHide;
    }

    var tabbox = $("tabMixTabBox")
    if (aHide && tabbox.selectedIndex == 6)
      showPane(tabbox.lastselectedIndex);

    if (aFocus)
      window.focus();
  }
}

function tabSelectionChanged(event) {
   if (!event || event.target.localName != "tabs")
      return;

   var index = event.target.selectedIndex;
   setSelectedIndex(index);
}

function setSelectedIndex(index) {
   var c = ["dbl", "middle", "ctrl", "shift", "alt"];
   var clickTab = $("ClickTab");
   var prefId = c[index] + "ClickTab";
   clickTab.value = $(prefId).value;
   clickTab.setAttribute("prefstring_item", prefId);

   var clickTabbar = $("ClickTabbar");
   prefId = c[index] + "ClickTabbar";
   clickTabbar.value = $(prefId).value;
   clickTabbar.setAttribute("prefstring_item", prefId);
}

function _ensureElementIsVisible(aPopup) {
  var scrollBox = document.getAnonymousElementByAttribute(aPopup, "class", "popup-internal-box");
  scrollBox.ensureElementIsVisible(aPopup.parentNode.selectedItem);
}

let gAppearancePane = {}
gAppearancePane.tabmixCustomizeToolbar = function tabmixCustomizeToolbar() {
  this._tabmixCustomizeToolbar = true;
  Tabmix.getTopWin().BrowserCustomizeToolbar();
}

gAppearancePane.toolbarButtons = function toolbarButtons(aWindow) {
  // Display > Toolbar
  var buttons = ["btn_sessionmanager", "btn_undoclose", "btn_closedwindows", "btn_tabslist"];
  var onToolbar = $("onToolbar");
  var onPlate = $("onPlate");
  for (var i = 0; i < buttons.length; ++i ) {
    var button = aWindow.document.getElementById(buttons[i]);
    var optionButton = $("_" + buttons[i]).parentNode;
    if (button)
      onToolbar.appendChild(optionButton);
    else
      onPlate.appendChild(optionButton);
  }
  onToolbar.childNodes[1].hidden = onToolbar.childNodes.length > 2;
  onPlate.childNodes[1].hidden = onPlate.childNodes.length > 2;

  // Display > Tab bar
  function updateDisabledState(buttonID, itemID) {
    let button = aWindow.document.getElementById(buttonID);
    let enablePosition =  button && button.parentNode == aWindow.gBrowser.tabContainer._container;

    Tabmix.setItem(itemID, "disableObserver", !enablePosition || null);
    Tabmix.setItem(itemID, "disabled", !enablePosition || null);
    TM_Options.disabled(itemID, !enablePosition);
  }
  updateDisabledState("new-tab-button", "newTabButton");
  updateDisabledState("alltabs-button", "hideAllTabsButton");

  if (this._tabmixCustomizeToolbar) {
    delete this._tabmixCustomizeToolbar;
    window.focus();
  }
}

function openHelp(aPageaddress) {
  if (!aPageaddress) {
    let helpPages = [{id:"Links",   tabs:[""]},
                     {id:"Events",  tabs:["New_Tabs", "tab_opening", "Tab_Closing", "Tab_Merging", "Tab_Features"]},  // 1
                     {id:"Display", tabs:["Tab_bar", "Tab" , "ToolBar"]},                                             // 2
                     {id:"Mouse",   tabs:["Mouse_Gestures", "Mouse_Clicking"]},                                       // 3 //sub sub tab 6
                     {id:"Menu",    tabs:["Tab_Context_Menu", "Main_Context_Menu", "Tools_Menu", "Shortcuts"]},       // 4
                     {id:"Session", tabs:["StartExit", "Restore" , "Preserve"]},                                      // 5
                    ];
    // get curent tab index and sub tab if there is one
    let topLevel, subLevel;
    topLevel = subLevel = $("tabMixTabBox").selectedIndex;
    if (topLevel > 0) {
      if (topLevel < 4)
        subLevel--;
      let subtabs = document.getElementsByAttribute("subtub", "true");
      subLevel = subtabs[subLevel].selectedIndex
    }
    let subPage = helpPages[topLevel].tabs[subLevel];
    aPageaddress = helpPages[topLevel].id + (subPage ? "_-_" + subPage : "");
  }
  var helpPage = "http://tmp.garyr.net/help"
  var helpUrl = helpPage + "/#" + aPageaddress;
  var tabToSelect;
  // Check if the help page already open
  var recentWindow = Tabmix.getTopWin();
  var tabBrowser = recentWindow.gBrowser;
  for (var i = 0; i < tabBrowser.browsers.length; i++) {
    if (tabBrowser.browsers[i].currentURI.spec.indexOf(helpPage) == 0) {
      tabToSelect = tabBrowser.tabs[i];
      break;
    }
  }
  if (!tabToSelect) {
    if (tabBrowser.isBlankNotBusyTab(tabBrowser.mCurrentTab))
      tabToSelect = tabBrowser.mCurrentTab;
    else
      tabToSelect = tabBrowser.addTab("about:blank");
  }
  tabToSelect.linkedBrowser.stop();
  tabBrowser.selectedTab = tabToSelect;
  tabBrowser.selectedBrowser.userTypedValue = helpUrl;
  // allow to load in current tab
  tabBrowser.selectedBrowser.tabmix_allowLoad = true;
  recentWindow.loadURI(helpUrl, null, null, false);
  tabBrowser.selectedBrowser.focus();
}
