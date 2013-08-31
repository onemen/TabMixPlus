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

this.TabmixPlacesUtils = {
  init: function(aWindow) {
    PlacesUtilsInternal.init(aWindow);
  }
}
Object.freeze(TabmixPlacesUtils);

let global = this; // for Firefox 11-14
let Tabmix = { }

let PlacesUtilsInternal = {
  _timer: null,
  _initialized: false,

  init: function(aWindow) {
    if (this._initialized)
      return;
    this._initialized = true;

    let tmp = {};
    Cu.import("resource://tabmixplus/log.jsm", tmp);
    for (let [fnName, value] in Iterator(tmp.log))
      Tabmix[fnName] = typeof value == "function" ? value.bind(Tabmix) : value;
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js", global);

    Services.obs.addObserver(this, "quit-application", true);
    this.initPlacesUIUtils(aWindow);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference]),

  observe: function(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "quit-application":
        this.onQuitApplication();
        break;
    }
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
      let test = PlacesUIUtils._openTabset.toString();
    } catch (ex) {
      if (aWindow.document.documentElement.getAttribute("windowtype") == "navigator:browser") {
        Tabmix.log("Starting with Firefox 21 Imacros 8.3.0 break toString on PlacesUIUtils functions."
          + "\nTabmix can't update PlacesUIUtils to work according to Tabmix preferences, use Imacros 8.3.1 and up.");
      }
      return;
    }

    this.functions.forEach(function(aFn) {
      PlacesUIUtils["tabmix_" + aFn] = PlacesUIUtils[aFn];
    });

    var treeStyleTab = "TreeStyleTabBookmarksService" in aWindow;
    function updateOpenTabset() {
      let openGroup = "    browserWindow.TMP_Places.openGroup(urls, ids, where$1);"
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
        '$& behavior =', {check: treeStyleTab}
      )._replace(
        'browserWindow.gBrowser.loadTabs(urls, loadInBackground, false);',
        'var changeWhere = where == "tabshifted" && aEvent.target.localName != "menuitem";\n' +
        '    if (changeWhere)\n' +
        '      where = "current";\n' +
        openGroup.replace("$1", treeStyleTab ? ", behavior" : "")
      ).toCode();
    };
    if (treeStyleTab) {
      let timer = this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      timer.initWithCallback(function() {
        timer.cancel();
        this._timer = null;
        updateOpenTabset();
      }.bind(this), 50, Ci.nsITimer.TYPE_ONE_SHOT);
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
      /whereToOpenLink\(aEvent[,\s\w]*\), window/, '$&, aEvent'
    ).toCode();

    // Don't change "current" when user click context menu open (callee is PC_doCommand and aWhere is current)
    // we disable the open menu when the tab is lock
    // the 2nd check for aWhere == "current" is for non Firefox code that may call this function
    Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils._openNodeIn")._replace(
      /(function[^\(]*\([^\)]+)(\))/,
      '$1, TMP_Event$2' /* event argument exist when this function called from openNodeWithEvent */
    )._replace(
      'aWindow.openUILinkIn',
      'if (TMP_Event) aWhere = aWindow.TMP_Places.isBookmarklet(aNode.uri) ? "current" :\n' +
      '                     aWindow.TMP_Places.fixWhereToOpen(TMP_Event, aWhere);\n' +
      '      else if (aWhere == "current" && !aWindow.TMP_Places.isBookmarklet(aNode.uri)) {\n' +
      '        let caller = aWindow.Tabmix.getCallerNameByIndex(2);\n' +
      '        if (caller != "PC_doCommand")\n' +
      '          aWhere = aWindow.TMP_Places.fixWhereToOpen(null, aWhere);\n' +
      '      }\n' +
      '      if (aWhere == "current") aWindow.gBrowser.mCurrentBrowser.tabmix_allowLoad = true;\n' +
      '      $&'
    )._replace(
      'inBackground:',
      'bookMarkId: aNode.itemId, initiatingDoc: null,\n' +
      '        $&'
    ).toCode();
  }
}
