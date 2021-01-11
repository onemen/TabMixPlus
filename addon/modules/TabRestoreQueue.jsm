"use strict";

this.EXPORTED_SYMBOLS = ["TabRestoreQueue"];

const {utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this,
  "TabmixSvc", "resource://tabmixplus/TabmixSvc.jsm");

let internal = {
  tabmix: {
    restoreOnDemand(restoreOnDemand, visible, tabToRestoreSoon) {
      if (!visible.length) {
        return restoreOnDemand;
      }

      const tab = tabToRestoreSoon || visible[0];
      const win = tab.ownerGlobal;
      const {restoringTabs, bookmarksOnDemand} = win.TMP_Places;
      const index = restoringTabs.indexOf(tab);
      if (index > -1) {
        if (!tabToRestoreSoon && !bookmarksOnDemand) {
          restoringTabs.splice(index, 1);
        }
        return bookmarksOnDemand;
      }

      // not our tab
      return restoreOnDemand;
    },
  },

  // Returns and removes the tab with the highest priority.
  shift() {
    let set;
    let {priority, hidden, visible} = this.tabs;

    let {restoreOnDemand, restorePinnedTabsOnDemand} = this.prefs;
    let restorePinned = !(restoreOnDemand && restorePinnedTabsOnDemand);
    if (restorePinned && priority.length) {
      set = priority;
    } else if (!this.tabmix.restoreOnDemand(restoreOnDemand, visible)) {
      if (visible.length) {
        set = visible;
      } else if (this.prefs.restoreHiddenTabs && hidden.length) {
        set = hidden;
      }
    }

    return set && set.shift();
  },

  willRestoreSoon(tab) {
    let {priority, hidden, visible} = this.tabs;
    let {restoreOnDemand, restorePinnedTabsOnDemand,
      restoreHiddenTabs} = this.prefs;
    let restorePinned = !(restoreOnDemand && restorePinnedTabsOnDemand);
    let candidateSet = [];

    if (restorePinned && priority.length)
      candidateSet.push(...priority);

    if (!this.tabmix.restoreOnDemand(restoreOnDemand, visible, tab)) {
      if (visible.length)
        candidateSet.push(...visible);

      if (restoreHiddenTabs && hidden.length)
        candidateSet.push(...hidden);
    }

    return candidateSet.indexOf(tab) > -1;
  },
};

this.TabRestoreQueue = {
  init() {
    const global = {};
    const tabRestoreQueue = TabmixSvc.SessionStoreGlobal.TabRestoreQueue;
    global.TabRestoreQueue = tabRestoreQueue;
    for (let key of Object.keys(internal)) {
      if (typeof internal[key] == "function") {
        global.TabRestoreQueue[key] = internal[key].bind(tabRestoreQueue);
      } else {
        global.TabRestoreQueue[key] = internal[key];
      }
    }
  },
};

this.TabRestoreQueue.init();
