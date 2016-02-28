"use strict";

this.EXPORTED_SYMBOLS = ["TabmixGroupsMigrator"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Services",
                                  "resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyGetter(this, "TabGroupsMigrator", function() {
  if (!TabmixSvc.version(470)) {
    return null;
  }

  let tmp = {};
  let resource = "resource:///modules/TabGroupsMigrator.jsm";
  try {
    Cu.import(resource, tmp);
  } catch (ex) {
    TabmixSvc.console.reportError("Failed to load module " + resource + ".");
    return null;
  }
  return tmp.TabGroupsMigrator;
});

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
                                  "resource://tabmixplus/Services.jsm");

this.TabmixGroupsMigrator = {
  /**
   * If previous or last session contains tab groups, save a back
   */
  backupSessions: function(window, isAfterCrash) {
    let sm = window.TabmixSessionManager;
    let notify;

    let isSessionWithGroups = path => {
      if (sm.containerEmpty(path)) {
        return false;
      }
      let sessionContainer = sm.initContainer(path);
      let sessionEnum = sessionContainer.GetElements();
      while (sessionEnum.hasMoreElements()) {
        let rdfNodeSession = sessionEnum.getNext();
        if (rdfNodeSession instanceof Ci.nsIRDFResource) {
          let windowPath = rdfNodeSession.QueryInterface(Ci.nsIRDFResource).Value;
          if (sm.nodeHasArc(windowPath, "dontLoad")) {
            continue;
          }
          let data = sm.getLiteralValue(windowPath, "tabview-groups", "{}");
          let parsedData = TabmixSvc.JSON.parse(data);
          if (parsedData.totalNumber > 1) {
            notify = true;
            return true;
          }
        }
      }
      return false;
    };

    let string = s => TabmixSvc.getSMString("sm.tabview.backup." + s);
    let saveSessions = (type, index) => {
      let session = sm.gSessionPath[index];
      if (!isSessionWithGroups(session)) {
        return;
      }
      sm.saveClosedSession({
        session: session,
        name: {name: string(type)},
        nameExt: sm.getLiteralValue(session, "nameExt", ""),
        button: -1
      });
    };

    try {
      // we run this function before preparAfterCrash and prepareSavedSessions
      // we need to backup 2 last session, if last session was crashed backup
      // one more older session
      let index = isAfterCrash ? 1 : 0;
      saveSessions("session", index + 1);
      saveSessions("session", index);
      if (isAfterCrash) {
        saveSessions("crashed", 0);
      }
      if (notify) {
        TabmixSvc.sm.showMissingTabViewNotification = {msg: string("msg")};
        this.missingTabViewNotification(window, string("msg"));
      }
    } catch (ex) {
      TabmixSvc.console.assert(ex);
    }
  },

  getNotificationBox: function(doc) {
    return doc.getElementById("high-priority-global-notificationbox") ||
      doc.getElementById("global-notificationbox");
  },

  closeNotificationFromAllWindows: function() {
    TabmixSvc.forEachBrowserWindow(aWindow => {
      let notificationBox = this.getNotificationBox(aWindow.document);
      let notification = notificationBox.getNotificationWithValue("tabmix-missing-tabview");
      if (notification) {
        notificationBox.removeNotification(notification);
      }
    });
  },

  missingTabViewNotification: function(win, backup = "") {
    let string = s => TabmixSvc.getSMString("sm.tabview." + s);

    // If there's already an existing notification bar, don't do anything.
    let notificationBox = this.getNotificationBox(win.document);
    let notification = notificationBox.getNotificationWithValue("tabmix-missing-tabview");
    if (notification) {
      return;
    }

    let message = backup;
    let buttons = [{
      label: string("install.label"),
      accessKey: string("install.accesskey"),
      callback: function() {
        let link = TabmixSvc.isPaleMoon ?
            "http://www.palemoon.org/tabgroups.shtml" :
            "https://addons.mozilla.org/en-US/firefox/addon/tab-groups-panorama/";
        win.openUILinkIn(link, "tab");
      }
    }];

    if (TabmixSvc.isPaleMoon) {
      message = string("hiddengroups");
    } else {
      buttons.push({
        label: string("removed.learnMore.label"),
        accessKey: string("removed.learnMore.accesskey"),
        callback: function() {
          win.openUILinkIn("http://tabmixplus.org/support/viewpage.php?t=2&p=tab-groups-removal", "tab");
        }
      });
      message = string("removed") + " " + string("hiddengroups.removed") + " " + message;
    }

    notification = notificationBox.appendNotification(
      message,
      "tabmix-missing-tabview",
      "chrome://tabmixplus/skin/tmpsmall.png",
      notificationBox.PRIORITY_WARNING_MEDIUM,
      buttons,
      (aEventType) => {
        if (aEventType == "removed") {
          TabmixSvc.sm.showMissingTabViewNotification = null;
          this.closeNotificationFromAllWindows();
        }
      }
    );
  },

  removeHiddenTabGroupsFromState: function(state) {
    if (!TabGroupsMigrator) {
      return {windows: []};
    }

    let groupData = TabGroupsMigrator._gatherGroupData(state);
    let hiddenTabState = TabGroupsMigrator._removeHiddenTabGroupsFromState(state, groupData);
    return hiddenTabState;
  },
};
