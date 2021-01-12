"use strict";

this.EXPORTED_SYMBOLS = ["TabmixPlacesUtils"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

// these imports are used by PlacesUIUtils and PlacesUtils that we eval here
XPCOMUtils.defineLazyModuleGetter(this, "PluralForm",
  "resource://gre/modules/PluralForm.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PrivateBrowsingUtils",
  "resource://gre/modules/PrivateBrowsingUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "OpenInTabsUtils",
  "resource:///modules/OpenInTabsUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesUIUtils",
  "resource:///modules/PlacesUIUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
  "resource://gre/modules/PlacesUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "RecentWindow",
  "resource:///modules/RecentWindow.jsm");

XPCOMUtils.defineLazyModuleGetter(this,
  "TabmixSvc", "resource://tabmixplus/TabmixSvc.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "AsyncPlacesUtils",
  "resource://tabmixplus/AsyncPlacesUtils.jsm");

var PlacesUtilsInternal;
this.TabmixPlacesUtils = Object.freeze({
  init(aWindow) {
    PlacesUtilsInternal.init(aWindow);
  },

  onQuitApplication() {
    PlacesUtilsInternal.onQuitApplication();
  },

  applyCallBackOnUrl(aUrl, aCallBack) {
    return PlacesUtilsInternal.applyCallBackOnUrl(aUrl, aCallBack);
  },

  getTitleFromBookmark(aUrl, aTitle, aItemId, aTab, byID) {
    return PlacesUtilsInternal.getTitleFromBookmark(aUrl, aTitle, aItemId, aTab, byID);
  },

  asyncGetTitleFromBookmark(aUrl, aTitle, aItemId, aTab) {
    if (TabmixSvc.version(600)) {
      return PlacesUtilsInternal.asyncGetTitleFromBookmark(aUrl, aTitle, aItemId, aTab)
          .catch(err => {
            TabmixSvc.console.reportError(err, 'Error form asyncGetTitleFromBookmark');
            return '';
          });
    }

    const title = PlacesUtilsInternal.getTitleFromBookmark(aUrl, aTitle, aItemId, aTab);
    return Promise.resolve(title);
  },
});

var Tabmix = {};

PlacesUtilsInternal = {
  _timer: null,
  _initialized: false,

  init(aWindow) {
    if (this._initialized)
      return;
    this._initialized = true;

    Tabmix._debugMode = aWindow.Tabmix._debugMode;
    Tabmix.gIeTab = aWindow.Tabmix.extensions.gIeTab;
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js");

    this.initPlacesUIUtils(aWindow);
  },

  onQuitApplication() {
    if (this._timer)
      this._timer.clear();

    this.functions.forEach(aFn => {
      PlacesUIUtils[aFn] = PlacesUIUtils["tabmix_" + aFn];
      delete PlacesUIUtils["tabmix_" + aFn];
    });
    delete PlacesUIUtils.tabmix_getURLsForContainerNode;
    if (TabmixSvc.version(580)) {
      delete PlacesUIUtils._getTopBrowserWin;
    }
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

    this.functions.forEach(aFn => {
      PlacesUIUtils["tabmix_" + aFn] = PlacesUIUtils[aFn];
    });

    function updateOpenTabset(name, treeStyleTab) {
      let openGroup = "    browserWindow.TMP_Places.openGroup(urls, ids, where$1);";
      Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils." + name)._replace(
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
        /browserWindow\.gBrowser\.loadTabs\([^;]+;/,
        'var changeWhere = where == "tabshifted" && aEvent.target.localName != "menuitem";\n' +
        '    if (changeWhere)\n' +
        '      where = "current";\n' +
        openGroup.replace("$1", treeStyleTab ? ", behavior" : "")
      ).toCode();
    }
    var treeStyleTabInstalled = "TreeStyleTabBookmarksService" in aWindow;
    if (treeStyleTabInstalled &&
        typeof PlacesUIUtils.__treestyletab__openTabset == "function") {
      updateOpenTabset("__treestyletab__openTabset");
    } else if (treeStyleTabInstalled) {
      // wait until TreeStyleTab changed PlacesUIUtils._openTabset
      let timer = this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this.__index = 0;
      timer.initWithCallback(() => {
        let str = PlacesUIUtils._openTabset.toString();
        if (++this.__index > 10 || str.indexOf("TreeStyleTabBookmarksService") > -1 ||
            str.indexOf("GroupBookmarkBehavior") > -1) {
          timer.cancel();
          this._timer = null;
          this.__index = null;
          updateOpenTabset("_openTabset", true);
        }
      }, 50, Ci.nsITimer.TYPE_REPEATING_SLACK);
    } else { // TreeStyleTab not installed
      updateOpenTabset("_openTabset");

      Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils.openURINodesInTabs")._replace(
        'push({uri: aNodes[i].uri,',
        'push({id: aNodes[i].itemId, uri: aNodes[i].uri,'
      ).toCode();

      // we enter getURLsForContainerNode into PlacesUIUtils to prevent leaks from PlacesUtils
      Tabmix.changeCode(PlacesUtils, "PlacesUtils.getURLsForContainerNode")._replace(
        'uri: child.uri,',
        '$&\n          ' +
        'id: child.itemId,', {flags: "g"}
      )._replace(
        'this.', 'PlacesUtils.', {flags: "g"}
      ).toCode(false, PlacesUIUtils, "tabmix_getURLsForContainerNode");

      Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils.openContainerNodeInTabs")._replace(
        'PlacesUtils.getURLsForContainerNode(aNode)',
        'PlacesUIUtils.tabmix_getURLsForContainerNode(aNode)'
      ).toCode();
    }

    let fnName = treeStyleTabInstalled && PlacesUIUtils.__treestyletab__openNodeWithEvent ?
      "__treestyletab__openNodeWithEvent" : "openNodeWithEvent";
    Tabmix.changeCode(PlacesUIUtils, "PlacesUIUtils." + fnName)._replace(
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
      '          if (!browserWindow.Tabmix.callerTrace("PC_doCommand")) {\n' +
      '            aWhere = TMP_Places.fixWhereToOpen(null, aWhere);\n' +
      '          }\n' +
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

    if (TabmixSvc.version(580)) {
      PlacesUIUtils._getTopBrowserWin = function PUIU__getTopBrowserWin() {
        return RecentWindow.getMostRecentBrowserWindow();
      };
    }
  },

  // Lazy getter for titlefrombookmark preference
  get titlefrombookmark() {
    const PREF = "extensions.tabmix.titlefrombookmark";
    let updateValue = () => {
      let value = Services.prefs.getBoolPref(PREF);
      let definition = {value, configurable: true};
      Object.defineProperty(this, "titlefrombookmark", definition);
      return value;
    };

    Services.prefs.addObserver(PREF, updateValue, false);
    return updateValue();
  },

  getBookmarkTitle(aUrl, aID, byID) {
    let aItemId = aID.value || -1;
    try {
      if (aItemId > -1) {
        var _URI = PlacesUtils.bookmarks.getBookmarkURI(aItemId);
        if (_URI && _URI.spec == aUrl)
          return PlacesUtils.bookmarks.getItemTitle(aItemId);
      }
    } catch (ex) {
      TabmixSvc.console.reportError(ex, 'Error function name changed', 'not a function');
    }
    if (!byID) {
      try {
        let uri = Services.io.newURI(aUrl, null, null);
        aItemId = aID.value = PlacesUtils.getMostRecentBookmarkForURI(uri);
        if (aItemId > -1)
          return PlacesUtils.bookmarks.getItemTitle(aItemId);
      } catch (ex) {
        TabmixSvc.console.reportError(ex, 'Error function name changed', 'not a function');
      }
    }
    aID.value = null;
    return null;
  },

  applyCallBackOnUrl(aUrl, aCallBack) {
    let hasHref = aUrl.indexOf("#") > -1;
    let result = aCallBack.apply(this, [aUrl]) ||
        hasHref && aCallBack.apply(this, aUrl.split("#"));
    // when IE Tab is installed try to find url with or without the prefix
    let ietab = Tabmix.gIeTab;
    if (!result && ietab) {
      let prefix = "chrome://" + ietab.folder + "/content/reloaded.html?url=";
      if (aUrl != prefix) {
        let url = aUrl.startsWith(prefix) ?
          aUrl.replace(prefix, "") : prefix + aUrl;
        result = aCallBack.apply(this, [url]) ||
          hasHref && aCallBack.apply(this, url.split("#"));
      }
    }
    return result;
  },

  getTitleFromBookmark: function TMP_getTitleFromBookmark(aUrl, aTitle, aItemId, aTab, byID) {
    if (!this.titlefrombookmark || !aUrl)
      return aTitle;

    var oID = {value: aTab ? aTab.getAttribute("tabmix_bookmarkId") : aItemId};
    var getTitle = url => this.getBookmarkTitle(url, oID, byID);
    var title = this.applyCallBackOnUrl(aUrl, getTitle);
    // setItem check if aTab exist and remove the attribute if
    // oID.value is null
    if (aTab) {
      let win = aTab.ownerGlobal;
      win.Tabmix.setItem(aTab, "tabmix_bookmarkId", oID.value);
    }

    return title || aTitle;
  },

  asyncGetTitleFromBookmark(aUrl, aTitle, aItemId, aTab) {
    if (!this.titlefrombookmark || !aUrl)
      return Promise.resolve(aTitle);

    return AsyncPlacesUtils.getTitleFromBookmark(aUrl, aTitle, aItemId, aTab, Tabmix.gIeTab);
  },
};
