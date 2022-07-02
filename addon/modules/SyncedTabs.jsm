/* eslint object-shorthand: "error" */
"use strict";

const EXPORTED_SYMBOLS = ["SyncedTabs"];

const {getChromeWindow} = ChromeUtils.import("resource:///modules/syncedtabs/util.js");
const {TabListView} = ChromeUtils.import("resource:///modules/syncedtabs/TabListView.js");
const {TabmixSvc} = ChromeUtils.import("chrome://tabmix-resource/content/TabmixSvc.jsm");
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

const Tabmix = {};

const SyncedTabs = {
  _initialized: false,

  init(aWindow) {
    if (this._initialized)
      return;
    this._initialized = true;

    Tabmix._debugMode = aWindow.Tabmix._debugMode;
    Tabmix.gIeTab = aWindow.Tabmix.extensions.gIeTab;
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js");

    this.tabListView(aWindow);
  },

  onQuitApplication() {
    this.functions.forEach(aFn => {
      TabListView.prototype[aFn] = TabListView.prototype["tabmix_" + aFn];
      delete TabListView.prototype["tabmix_" + aFn];
    });
    delete TabListView.prototype.tabmix_whereToOpen;
    delete TabListView.prototype.tabmix_inBackground;
  },

  functions: ["onClick", "onOpenSelected", "adjustContextMenu", "onOpenSelectedFromContextMenu"],
  tabListView() {
    this.functions.forEach(aFn => {
      TabListView.prototype["tabmix_" + aFn] = TabListView.prototype[aFn];
    });

    TabListView.prototype.tabmix_whereToOpen = function(event) {
      let window = getChromeWindow(this._window);
      let where = window.whereToOpenLink(event);
      if (where == "current") {
        let pref = "extensions.tabmix.opentabfor.syncedTabs";
        if (window.Tabmix.whereToOpen(pref).inNew) {
          where = "tab";
        }
      }
      let inBackground = this.tabmix_inBackground;
      return {where, inBackground};
    };

    Object.defineProperty(TabListView.prototype, "tabmix_inBackground", {
      get() {
        return TabmixSvc.prefBranch.getBoolPref("loadSyncedTabsInBackground");
      },
      enumerable: true,
      configurable: true
    });

    const fnName = typeof TabListView.prototype._openAllClientTabs == "function" ?
      "TabListView.prototype._openAllClientTabs" : "TabListView.prototype.onClick";
    Tabmix.changeCode(TabListView.prototype, fnName)._replace(
      'this.props.onOpenTabs(urls, where);',
      `if (/^tab/.test(where)) {
          // reverse the background here since props.onOpenTabs reverse it again
          where = where == 'tab' ^ this.tabmix_inBackground ? "tab" : "tabshifted";
        }
        $&`
    ).toCode();

    TabListView.prototype.onOpenSelected = function(url, event) {
      let {where, inBackground} = this.tabmix_whereToOpen(event);
      this.props.onOpenTab(url, where, {inBackground});
    };

    Tabmix.changeCode(TabListView.prototype, "TabListView.prototype.onOpenSelectedFromContextMenu")._replace(
      'private:',
      'inBackground: this.tabmix_inBackground,\n' +
      '        $&'
    ).toCode();

    TabListView.prototype.adjustContextMenu = function(menu) {
      this.tabmix_adjustContextMenu(menu);
      if (menu.id == "SyncedTabsSidebarContext") {
        let window = getChromeWindow(this._window);
        let doc = window.document;
        let where = "syncedTabsOpenSelected";
        let open = doc.getElementById(where);
        let openInWindow = doc.getElementById(`${where}InWindow`);
        let openInPrivateWindow =
            doc.getElementById(`${where}InPrivateWindow`) || {hidden: true};
        let openInTab = doc.getElementById(`${where}InTab`);
        let pref = "extensions.tabmix.opentabfor.syncedTabs";
        window.TMP_Places.contextMenu.update(open, openInWindow, openInPrivateWindow, openInTab, pref);
      }
    };
  },
};
