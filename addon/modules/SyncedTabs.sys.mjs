/* eslint object-shorthand: "error" */

import {TabmixSvc} from "chrome://tabmix-resource/content/TabmixSvc.sys.mjs";
import {TabListView} from "resource:///modules/syncedtabs/TabListView.sys.mjs";
import {getChromeWindow} from "resource:///modules/syncedtabs/util.sys.mjs";

/** @type {PlacesModule.Tabmix} */ // @ts-expect-error we add properties bellow
const Tabmix = {};

/** @type {TabmixModules.SyncedTabs} */
export const SyncedTabs = {
  _initialized: false,

  init(aWindow) {
    if (this._initialized)
      return;
    this._initialized = true;

    Tabmix._debugMode = aWindow.Tabmix._debugMode;
    Tabmix.gIeTab = aWindow.Tabmix.extensions.gIeTab;
    Services.scriptloader.loadSubScript("chrome://tabmixplus/content/changecode.js", {Tabmix, TabmixSvc});

    this.tabListView();
  },

  onQuitApplication() {
    this.functions.forEach(aFn => {
      /** @type {TabmixModules.SyncedTabsTabmixFunctionsName} */
      const tabmixName = `tabmix_${aFn}`;
      // @ts-expect-error Function signatures are compatible at runtime
      TabListView.prototype[aFn] = TabListView.prototype[tabmixName];
      delete TabListView.prototype[tabmixName];
    });
    delete TabListView.prototype.tabmix_whereToOpen;
    delete TabListView.prototype.tabmix_inBackground;
  },

  functions: ["onClick", "onOpenSelected", "adjustContextMenu", "onOpenSelectedFromContextMenu"],
  tabListView() {
    this.functions.forEach(aFn => {
      // @ts-expect-error Function signatures are compatible at runtime
      TabListView.prototype[`tabmix_${aFn}`] = TabListView.prototype[aFn];
    });

    /** @type {TabListViewNS["tabmix_whereToOpen"]} */
    TabListView.prototype.tabmix_whereToOpen = function(event) {
      let window = getChromeWindow(this._window);
      let where = window.BrowserUtils.whereToOpenLink(event);
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

    /** @type {TabListViewNS["onOpenSelected"]} */
    TabListView.prototype.onOpenSelected = function(url, event) {
      let {where, inBackground} = this.tabmix_whereToOpen(event);
      this.props.onOpenTab(url, where, {inBackground});
    };

    Tabmix.changeCode(TabListView.prototype, "TabListView.prototype.onOpenSelectedFromContextMenu")._replace(
      'private:',
      'inBackground: this.tabmix_inBackground,\n' +
      '        $&'
    ).toCode();

    /** @type {TabListViewNS["adjustContextMenu"]} */
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
        // @ts-expect-error
        window.TMP_Places.contextMenu.update(open, openInWindow, openInPrivateWindow, openInTab, pref);
      }
    };
  },
};
