"use strict";

var EXPORTED_SYMBOLS = ["TabmixPlacesUtils"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PluralForm",
  "resource://gre/modules/PluralForm.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesUIUtils",
  "resource:///modules/PlacesUIUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "PlacesUtils", function() {
  Cu.import("resource://gre/modules/PlacesUtils.jsm");
  return PlacesUtils;
});

XPCOMUtils.defineLazyModuleGetter(this,
  "TabmixSvc", "resource://tabmixplus/Services.jsm");

this.TabmixPlacesUtils = Object.freeze({
  init: function(aWindow) {
    PlacesUtilsInternal.init(aWindow);
  },

  onQuitApplication: function() {
    PlacesUtilsInternal.onQuitApplication();
  }
});

let Tabmix = { };

var PlacesUtilsInternal = {
  _timer: null,
  _initialized: false,

  init: function(aWindow) {
    if (this._initialized)
      return;
    this._initialized = true;

    Tabmix._debugMode = aWindow.Tabmix._debugMode;
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js");

    this.initPlacesUIUtils(aWindow);
  },

  onQuitApplication: function () {
    if (this._timer)
      this._timer.clear();

    this.functions.forEach(function(aFn) {
      PlacesUIUtils[aFn] = PlacesUIUtils["tabmix_" + aFn];
      delete PlacesUIUtils["tabmix_" + aFn];
    });
    delete PlacesUIUtils.tabmix_getURLsForContainerNode;
  },

  functions: ["_openTabset", "openURINodesInTabs", "openContainerNodeInTabs", "openNodeWithEvent", "_openNodeIn"],
  initPlacesUIUtils: function TMP_PC_initPlacesUIUtils(aWindow) {
    try {
      PlacesUIUtils._openTabset.toString();
    } catch (ex) {
      if (aWindow.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
        TabmixSvc.console.log("Starting with Firefox 21 Imacros 8.3.0 break toString on PlacesUIUtils functions." +
          "\nTabmix can't update PlacesUIUtils to work according to Tabmix preferences, use Imacros 8.3.1 and up.");
      }
      return;
    }

    this.functions.forEach(function(aFn) {
      PlacesUIUtils["tabmix_" + aFn] = PlacesUIUtils[aFn];
    });

    var treeStyleTab = "TreeStyleTabBookmarksService" in aWindow;
    function updateOpenTabset() {
      let openGroup = "    browserWindow.TMP_Places.openGroup(urls, ids, where$1);";
      Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils._openTabset")._replace(
        'urls = []',
        'behavior, $&', {check: treeStyleTab}
      )._replace(
        'var urls = []',
        '$&, ids = []', {check: !treeStyleTab}
      )._replace(
        'urls.push(item.uri);',
        '$&\n' +
        '      ids.push(item.id);', {check: !treeStyleTab}
      )._replace(
        '"chrome,dialog=no,all", args);',
        '$&\n' +
        '      browserWindow.bookMarkIds = ids.join("|");'
      )._replace(
        /let openGroupBookmarkBehavior =|TSTOpenGroupBookmarkBehavior =/,
        '$& behavior =', {check: treeStyleTab, silent: true}
      )._replace(
        'browserWindow.gBrowser.loadTabs(urls, loadInBackground, false);',
        'var changeWhere = where == "tabshifted" && aEvent.target.localName != "menuitem";\n' +
        '    if (changeWhere)\n' +
        '      where = "current";\n' +
        openGroup.replace("$1", treeStyleTab ? ", behavior" : "")
      ).toCode();
    }
    if (treeStyleTab) {
      // wait until TreeStyleTab changed PlacesUIUtils._openTabset
      let timer = this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this.__index = 0;
      timer.initWithCallback(function() {
        if (++this.__index > 10 || PlacesUIUtils._openTabset.toString().indexOf("GroupBookmarkBehavior") > -1) {
          timer.cancel();
          this._timer = null;
          this.__index = null;
          updateOpenTabset();
        }
      }.bind(this), 50, Ci.nsITimer.TYPE_REPEATING_SLACK);
    }
    else { // TreeStyleTab not installed
      updateOpenTabset();

      Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils.openURINodesInTabs")._replace(
        'push({uri: aNodes[i].uri,',
        'push({id: aNodes[i].itemId, uri: aNodes[i].uri,'
      ).toCode();

      // we enter getURLsForContainerNode into PlacesUIUtils to prevent leakes from PlacesUtils
      Tabmix.changeCode(PlacesUtils, "PlacesUtils.getURLsForContainerNode")._replace(
        '{uri: child.uri,',
        '{id: child.itemId, uri: child.uri,', {flags: "g"}
      )._replace(
        'this.',  'PlacesUtils.', {flags: "g"}
      ).toCode(false, PlacesUIUtils, "tabmix_getURLsForContainerNode");

      Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils.openContainerNodeInTabs")._replace(
        'PlacesUtils.getURLsForContainerNode(aNode)',
        'PlacesUIUtils.tabmix_getURLsForContainerNode(aNode)'
      ).toCode();
    }

    Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils.openNodeWithEvent")._replace(
      /window.whereToOpenLink\(aEvent[,\s\w]*\)/, '{where: $&, event: aEvent}'
    ).toCode();

    // Don't change "current" when user click context menu open (callee is PC_doCommand and aWhere is current)
    // we disable the open menu when the tab is lock
    // the 2nd check for aWhere == "current" is for non Firefox code that may call this function
    Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils._openNodeIn")._replace(
      '{', '$&\n' +
      '    var TMP_Event;\n' +
      '    if (arguments.length > 1 && typeof aWhere == "object") {\n' +
      '      TMP_Event = aWhere.event;\n' +
      '      aWhere = aWhere.where;\n' +
      '    }\n'
    )._replace(
      'aWindow.openUILinkIn',
      'let browserWindow = this._getTopBrowserWin();\n' +
      '      if (browserWindow && typeof aWindow.TMP_Places == "object") {\n' +
      '        let TMP_Places = aWindow.TMP_Places;\n' +
      '        if (TMP_Event) aWhere = TMP_Places.isBookmarklet(aNode.uri) ? "current" :\n' +
      '                       TMP_Places.fixWhereToOpen(TMP_Event, aWhere);\n' +
      '        else if (aWhere == "current" && !TMP_Places.isBookmarklet(aNode.uri)) {\n' +
      '          let caller = browserWindow.Tabmix.getCallerNameByIndex(2);\n' +
      '          if (caller != "PC_doCommand")\n' +
      '            aWhere = TMP_Places.fixWhereToOpen(null, aWhere);\n' +
      '        }\n' +
      '      }\n' +
      '      if (browserWindow && aWhere == "current")\n' +
      '        browserWindow.gBrowser.selectedBrowser.tabmix_allowLoad = true;\n' +
      '      $&'
    )._replace(
      'inBackground:',
      'bookMarkId: aNode.itemId, initiatingDoc: null,\n' +
      '        $&'
    ).toCode();
  }
};
