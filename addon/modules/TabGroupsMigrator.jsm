"use strict";

this.EXPORTED_SYMBOLS = ["TabmixGroupsMigrator"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Services",
                                  "resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabGroupsMigrator",
                                  "resource:///modules/TabGroupsMigrator.jsm");

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
        this.missingTabViewNotification(window, string("msg"));
      }
    } catch (ex) {
      TabmixSvc.console.assert(ex);
    }
  },

  missingTabViewNotification: function(win, backup = "") {
    let string = s => TabmixSvc.getSMString("sm.tabview." + s);
    let doc = win.document;

    // If there's already an existing notification bar, don't do anything.
    let notificationBox = doc.getElementById("high-priority-global-notificationbox") ||
                          doc.getElementById("global-notificationbox");
    let notification = notificationBox.getNotificationWithValue("tabmix-missing-tabview");
    if (notification) {
      if (notification.tabmixSavedBackup) {
        notification.label += " " + string("hiddengroups");
        delete notification.tabmixSavedBackup;
      }
      return;
    }

    let message = backup || string("hiddengroups");
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

    if (!TabmixSvc.isPaleMoon) {
      buttons.push({
        label: string("removed.learnMore.label"),
        accessKey: string("removed.learnMore.accesskey"),
        callback: function() {
          win.openUILinkIn("http://tabmixplus.org/support/viewpage.php?t=2&p=tab-groups-removal", "tab");
        }
      });
      message = string("removed") + " " + message;
    }

    notification = notificationBox.appendNotification(
      message,
      "tabmix-missing-tabview",
      "chrome://tabmixplus/skin/tmpsmall.png",
      notificationBox.PRIORITY_WARNING_MEDIUM,
      buttons
    );
    if (backup) {
      notification.tabmixSavedBackup = true;
    }
  },
};
