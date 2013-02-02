/***** Preference Dialog Functions *****/
const Cc = Components.classes;
const Ci = Components.interfaces;
const pBranch = Ci.nsIPrefBranch;

function $(id) document.getElementById(id);

var gSetTabIndex = {
  _inited: [],
  tabSelectionChanged: function (event) {
    var tabbox = event.target.parentNode;
    if (event.target.localName != "tabs" || !this._inited[tabbox.id])
      return;
    var preference = $("pref_" + tabbox.id);
    preference.valueFromPreferences = tabbox.selectedIndex;
  },

  init: function (id) {
    var tabbox = $(id);
    var preference = $("pref_" + tabbox.id);
    if (preference.value !== null)
      tabbox.selectedIndex = preference.value;
    this._inited[id] = true;
  }
}

var gPrefs;
var radiogroups;

// load all preferences into the dialog
function TM_EMinit()
{
   gPrefs =  document.getElementsByAttribute("prefstring", "*");
   radiogroups = document.getElementsByTagName("radiogroup");

   getTab();
  // show groupbox if incompatible extensions exist in this profile
  if (prevWindow.getExtensions().length == 0)
    $("incompatible").collapsed = true;

  // add EventListener when we start
  window.addEventListener("command", TM_enableApply, false);
  window.addEventListener("input", TM_enableApply, false);

  // prevent non intiger key in int text box
  window.addEventListener("keypress", keyPressInText, false);

  // create saved Session popup menu
  var popup = $("onStart.popup");
    TabmixSessionManager.createMenuForDialog(popup);

  // update tabclicking items that aren't change by tabmix
  TM_Options.setItem("snapBack", "hidden", !(prevWindow.SessionSaver && prevWindow.SessionSaver.snapBackTab));
  TM_Options.setItem("ieView", "hidden", !(prevWindow.IeView && prevWindow.IeView.ieViewLaunch));

  // check if book mark item in tab context menu
  TM_Options.setItem("bmMenu", "hidden", !(prevWindow.document.getElementById("tm-bookmarkAllTabs")));
  // check if book "Browser:BookmarkAllTabs" command exist
  TM_Options.setItem("bmTabsCommand", "hidden", !(prevWindow.document.getElementById("Browser:BookmarkAllTabs")));

  // update pref for 'places'
  if (prevWindow.gIsPlaces) {
    $("openBookmarks").setAttribute("label", $("selectTabBH").getAttribute("label"));
    $("openHistory").hidden = true;
  }

  TM_setElements(false, true);
}

// save all preferences entered into the dialog
function TM_EMsave(onApply)
{
  // we only need to save if apply is enabled
  if (!onApply && document.documentElement.getButton("extra1").disabled)
    return true;

  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);

  TM_Options.singleWindow( $("singleWindow").checked );
  TM_verifyWidth();

  document.documentElement.getButton('accept').focus()
  document.documentElement.getButton("extra1").disabled = true;

  if (!("undefined" in applyData)) {
    for (var _pref in applyData)
      setPrefByType(_pref, applyData[_pref]);
  }
  else {
    // this part is only if the applayData fail for some unknown reason
    // we don't supposed to get here
    for (var i = 0; i < gPrefs.length; ++i )
      setPrefByType(gPrefs[i].getAttribute("prefstring"), gPrefs[i].value);
  }

  // set saved sessionpath if loadsession >=0
  var val = Tabmix.prefs.getIntPref("sessions.onStart.loadsession");
  var popup = $("onStart.popup");
  var pref = "sessions.onStart.sessionpath";
  Tabmix.prefs.setCharPref(pref, popup.getElementsByAttribute("value", val)[0].getAttribute("session"));

  applyData = [];
  Tabmix.prefs.clearUserPref("setDefault"); // this trigger TabmixTabbar.updateSettings

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

   if (minWidth.value < 22)
     minWidth.value = 30;

   if (minValue != minWidth.value)
      updateApplyData(minWidth);

   if (maxValue != maxWidth.value)
      updateApplyData(maxWidth);
}

var TM_Options = {

   setRadioFromBoolPref: function(prefId)
   {
//Tabmix.log("setRadioFromBoolPref " + prefId)
      var preference = $(prefId);
      return preference.value ? 1 : 0;
   },

   setBoolPrefFromRadio: function(itemId)
   {
//Tabmix.log("setBoolPrefFromRadio " + itemId);
      var radiogroupItem = $(itemId);
      return radiogroupItem.value == 1;
   },

   _prefs: null,
   get prefs() {
alert("don't use this");
      if (!this._prefs)
         this._prefs = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefBranch);

      return this._prefs;
   },

  initBroadcasters: function(paneID, start) {
///XXX TODO fix me
    var broadcasters = $(paneID + ":Broadcaster");
    for (var i = 0; i < broadcasters.childNodes.length; ++i ) {
      var _id = broadcasters.childNodes[i].id.replace("obs_", "");
      this.disabled(_id, start);
    }
  },

  // init broadcaster for obs_undoClose if events pane did not loaded yet
  // we call it from panes : session, menu, mouse
  initUndoCloseBroadcaster: function() {
    if (!$("undoClose") && !Tabmix.prefs.getBoolPref("undoClose"))
      this.setDisabled("obs_undoClose", true);
  },

  // init broadcaster for obs_singleWindow if links pane did not loaded yet
  // we call it from panes : menu, mouse
  initSingleWindowBroadcaster: function() {
    // we use inverseDependency in singleWindow
    if (!$("singleWindow") && Tabmix.prefs.getBoolPref("singleWindow"))
      this.setDisabled("obs_singleWindow", true);
  },

  disabled: function(itemOrId, start) {
try {
    var item = typeof(itemOrId) == "string" ? $(itemOrId) : itemOrId;
//XXX if item not exist ????
    var val;
    if (item.hasAttribute("disableObserver"))
      val = true;
    else
      val = item.getAttribute("inverseDependency") ? item.checked : !item.checked;
    if (start && !val)
      return;
    this.setDisabled("obs_" + item.id, val);
} catch (ex) {Tabmix.assert(ex);}
  },

  setDisabled: function(id, val) {
    if (val == true)
      this.setItem(id, "disabled" , val);
    else {
      // remove disabled from all observers,
      // we can't edit textbox-input with disabled=null or disabled=false
      // textbox-input inherits the dislabled attribute from the textbox

      // all broadcaster has no disabled attribute at startup
      var aBroadcaster = $(id);
      if (aBroadcaster.hasAttribute("disabled")) {
        aBroadcaster.removeAttribute("disabled");
      }
    }
  },

  // update item showInverseLink label in menu pane
  // when "Links" in Events > Tab Focus changed
  selectTab: function() {
try {
    var showInverseLink = $("showInverseLink");
    if (!showInverseLink)  // menu pane not loaded... noting to do
      return;
    var selectTab = $("selectTab");
    // selectTab item is inverted
    var focusType = selectTab ? selectTab.checked : !Services.prefs.getBoolPref("browser.tabs.loadInBackground");
    var val = showInverseLink.getAttribute((focusType ? "bg" : "fg") + "label");
    showInverseLink.setAttribute("label", val);
} catch (ex) {Tabmix.assert(ex);}
  },

  speLink: function() {
try {
    var midcurrent = $("midcurrent");
    if (!midcurrent) // events pane not loaded... noting to do
      return;
    var speLink = $("speLink");
    var val = speLink ? speLink.selectedItem.value : Tabmix.prefs.getIntPref("opentabforLinks");
    this.setDisabled("inverselinks", val != 2 && midcurrent.checked);
} catch (ex) {Tabmix.assert(ex);}
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
    // extensions.tabmix.keepLastTab = true OR
///    // extensions.tabmix.hideTabbar != 0
    // when we enable the item we need to set the disable state for newTabUrl_1
    var keepLastTab = $("keepLastTab");
    // when we call this function from hideTabbar oncommand make sure "keepLastTab" exist
    if (!keepLastTab) // events pane not loaded... noting to do
      return;
    var closeWindow = !$("keepWindow").checked // inverted pref;
    var disable = closeWindow || keepLastTab.checked;
    this.setDisabled("obs_replaceLastTabWith", disable);
    this.newTabUrl($("replaceLastTabWith"), disable, !disable);
  },

   // Set given attribute of specified item.
   // If the value is null, then it removes the attribute
   // (which works nicely for the disabled attribute).
  setItem: function (id, attrib, val) {
    var item = $(id);
    if (val == null) {
      item.removeAttribute(attrib);
      return;
    }

    if (typeof(val) == "boolean")
      val = val ? "true" : "false";

    if (item.getAttribute(attrib) != val)
      item.setAttribute(attrib, val);
  }

}

// other settings not in the main option dialog
var otherPref = ["sessions.onStart.sessionpath",
                  "filetype","boldUnread","italicUnread","underlineUnread",
                  "boldCurrent","italicCurrent","underlineCurrent","unreadColorCode",
                  "currentColorCode","progressColorCode","useCurrentColor",
                 "useUnreadColor","useProgressColor","sessions.menu.showext",
                  "disableIncompatible","hideIcons"];

function TM_defaultSetting () {
  // set flag to prevent TabmixTabbar.updateSettings from run for each change
  Tabmix.prefs.setBoolPref("setDefault", true);

  TM_setElements(true);

  TM_disableApply();

  // reset other settings to default
  for (var i = 0; i < otherPref.length; ++i )
    if (Tabmix.prefs.prefHasUserValue(otherPref[i])) Tabmix.prefs.clearUserPref(otherPref[i]);

  Tabmix.prefs.clearUserPref("setDefault");
  callUpdateSettings();

  Services.prefs.savePrefFile(null); // store the pref immediately
}

function getPrefByType(prefName, save) {
   try {
      switch (Services.prefs.getPrefType(prefName)) {
         case pBranch.PREF_BOOL:
            var  val = Services.prefs.getBoolPref(prefName);
            return save ? val : val ? 1 : 0;
            break;
         case pBranch.PREF_INT:
            return Services.prefs.getIntPref(prefName);
            break;
         case pBranch.PREF_STRING:
            return Services.prefs.getCharPref(prefName);
            break;
      }
   } catch (e) {Tabmix.log("error in getPrefByType " + "\n" + "caller " + getPrefByType.caller.name + "\n"+ prefName + "\n" + e);}
   return null;
}

function setPrefByType(prefName, newValue, atImport) {
   try {
      switch (Services.prefs.getPrefType(prefName)) {
         case pBranch.PREF_BOOL:
            if (atImport)
               newValue = /true/i.test(newValue);
            Services.prefs.setBoolPref(prefName, newValue);
            break;
         case pBranch.PREF_INT:
            Services.prefs.setIntPref(prefName, newValue);
            break;
         case pBranch.PREF_STRING:
            // in prev version we use " " for to export string to file
            if (atImport && newValue.indexOf('"') == 0)
               newValue = newValue.substring(1,newValue.length-1);
            Services.prefs.setCharPref(prefName, newValue);
            break;
         default:
            if (!atImport)
               break;
            // we need to check when import from saved file
            // in 0.3.0.605 we changed tab color from old pref to new pref
            // old pref "extensions.tabmix.currentColor" type integer
            // new pref "extensions.tabmix.currentColorCode" type string
            if (prefName == "extensions.tabmix.currentColor" ||
                prefName == "extensions.tabmix.unreadColor" ||
                prefName == "extensions.tabmix.progressColor") {
                var colorCodes = ["#CF1919", "#0E36EF", "#DDDF0D", "#3F8F3E", "#E066FF", "#86E7EF",
                                   "#FFFFFF", "#7F7F7F", "#000000", "#EF952C", "#FF82AB", "#7F4C0F", "#AAAAFF"]
                Services.prefs.setCharPref(prefName + "Code", colorCodes[newValue]);
            }
      }
   } catch (e) {Tabmix.log("error in setPrefByType " + "\n" + "caller " + setPrefByType.caller.name + "\n"+ prefName + "\n" + newValue + "\n" + e);}
}

function TM_setElements (restore, start) {
gPrefs = document.documentElement.getElementsByAttribute("prefstring", "*");
   for (var i = 0; i < gPrefs.length; ++i ) {
      var pref = gPrefs[i].getAttribute("prefstring");
      if (restore && Services.prefs.prefHasUserValue(pref))
         Services.prefs.clearUserPref(pref);

      gPrefs[i].value = getPrefByType(pref);
   }

   radiogroups = document.documentElement.getElementsByTagName("radiogroup");
   // this is for compatible with ff 1.0.x
   // radiogroup not set selectedIndex selectedItem by value set
   for (i = 0; i < radiogroups.length; i++)
      radiogroups[i].selectedItem.value = radiogroups[i].value;
   TM_Options.initBroadcasters(start);
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
  fp.open(fpCallback);
}

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
   fp.open(fpCallback);
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
   for (let i = 1; i < pattern.length; i++){
      var index = pattern[i].indexOf("=");
      if (index > 0){
         prefName  = pattern[i].substring(0,index);
         prefValue = pattern[i].substring(index+1,pattern[i].length);
         setPrefByType(prefName, prefValue, true);
      }
   }
   var browserWindow = Tabmix.getTopWin();
   browserWindow.gTMPprefObserver.updateTabClickingOptions();
   Tabmix.prefs.clearUserPref("setDefault");

   TM_setElements(false);
   TMP_setButtons(true, true);

   TM_Options.isSessionStoreEnabled(true);
   callUpdateSettings();

   Services.prefs.savePrefFile(null); // store the pref immediately
}

var applyData = [];
function TM_enableApply(event) {
Tabmix.log("",true)
   // if we fail once no neet to continue and we keep the apply button enable
   if ("undefined" in applyData)
      return;

   var item = event.target;
   var n = item.localName;

   // only allow event from this item to go on....
   if (item.parentNode.id == "tm-settings")
      return;
   if (n != "radio" && n != "menuitem" &&
              n != "checkbox" && n != "textbox" && n != "tabclicking")
      return;
   while(item.id != "pref-tabmix" && !item.hasAttribute("prefstring"))
      item = item.parentNode;

   if (item.hasAttribute("prefstring"))
      updateApplyData(item);
   else {
      Tabmix.log("erorr in tabmix options, item.id " + event.target.id + "\n has no prefstring");
      applyData["undefined"] = true;
      document.documentElement.getButton("extra1").disabled = false;
      return;
   }
}

//XXXX check if we need to use inverted on the value
function getValue(item) {
   if (item.localName == "checkbox")
      return $("pref_" + item.id).hasAttribute("inverted") ? !item.checked : item.checked;

   return item.value;
}

// set value to item
function setValue(item, newValue) {
   if (item.localName == "checkbox")
      item.checked = $("pref_" + item.id).hasAttribute("inverted") ? !newValue : newValue;
   else
      item.value = newValue;
}

//function updateApplyData(item, newValue) {
function updateApplyData(item) {
   var newValue = item.value;
   var savedValue = getPrefByType(item);
   var pref = item.getAttribute("prefstring");

   if (savedValue != newValue)
      applyData[pref] = newValue;
   else if (pref in applyData)
      delete applyData[pref];

   var applyCount = 0;
   for (var n in applyData) {
      if (++applyCount > 0)
         break;
   }

   var applyButton = document.documentElement.getButton("extra1");
   if (applyButton.disabled != (applyCount == 0))
      applyButton.disabled = applyCount == 0;
}

function TM_disableApply() {
 document.documentElement.getButton("extra1").disabled = true;
 applyData = [];
}

function setLastTab() {
   Tabmix.prefs.setIntPref("selected_tab", $("tabMixTabBox").selectedIndex);

   var subtabs = document.getElementsByAttribute("subtub", "true");
   var subTab = "selected_sub_tab";
   for (var i = 0; i < subtabs.length; i++)
      Tabmix.prefs.setIntPref(subtabs[i].getAttribute("value"), subtabs[i].selectedIndex);

   // remove EventListener when we exit
   window.removeEventListener("command", TM_enableApply, false);
   window.removeEventListener("input", TM_enableApply, false);
   window.removeEventListener("keypress", keyPressInText, false);
}

function getTab() {
   var selTabindex = Tabmix.getIntPref("selected_tab" , 0, true);
   TM_selectTab(selTabindex);

   var subtabs = document.getElementsByAttribute("subtub", true);
   var subTab = "extensions.tabmix.selected_sub_tab";
   for (var i = 0; i < subtabs.length; i++) {
      var val = Tabmix.getIntPref(subTab + subtabs[i].getAttribute("value"), 0);
      subtabs[i].selectedIndex = val;
   }
}

// this function is called from here and from Tabmix.openOptionsDialog if the dialog already opened
function TM_selectTab(aSelTab) {
  var tabbox = $("tabMixTabBox");
  tabbox.lastselectedIndex = tabbox.selectedIndex;
  tabbox.selectedIndex = (aSelTab) ? aSelTab : 0;
  var tabId = document.getElementsByTagName("tab")[aSelTab].id;
  var catButtons = $("TM_ButtonBox").childNodes;

  for(var i = 0; i < catButtons.length; i++)
    if(catButtons[i].getAttribute('group', 'categories'))
      catButtons[i].setAttribute('checked', (catButtons[i].id == 'button' + tabId));
}

function showIncompatible() {
   var topwin = Tabmix.getTopWin();
   if (topwin) {
      var result = topwin.disableExtensions(this);
      if (result) {
         $("incompatible").collapsed = true;
         sizeToContent();
      }
      this.focus();
   }
   else {
///XXX do we have locals entry for this ?
      Services.prompt.alert(window, "Tabmix Error", "You must have one browser window to use TabMix Options");
      window.close();
   }
}

//XXX TODO check if we can move this to appearance.js
// we call this also from browser window when BrowserCustomizeToolbar finish
// look at Tabmix.delayedStartup in setup.js
function toolbarButtons(aWindow) {
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
  let newTabButton = aWindow.document.getElementById("new-tab-button");
  let enablePosition =  newTabButton && newTabButton.parentNode == aWindow.gBrowser.tabContainer._container;

  TM_Options.setItem("newTabButton", "disableObserver", !enablePosition || null);
  TM_Options.disabled("newTabButton", !enablePosition);
}

function openHelp(aPageaddress) {
  var helpTopic = aPageaddress || document.documentElement.currentPane.helpTopic;
  if (document.documentElement.currentPane.id == "paneSession" ) {
    if (helpTopic == "tabmix") {
      var box = document.documentElement.currentPane.getElementsByTagName("tabbox");
      helpTopic = box[1].selectedTab.getAttribute("helpTopic");
    }
    else
      helpTopic = "";
  }
  var helpPage = "http://tmp.garyr.net/help/#"
  var helpUrl = helpPage + helpTopic;
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
    if (tabBrowser.tabContainer.isBlankNotBusyTab(tabBrowser.mCurrentTab))
      tabToSelect = tabBrowser.mCurrentTab
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
