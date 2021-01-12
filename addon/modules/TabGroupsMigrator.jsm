"use strict";

this.EXPORTED_SYMBOLS = ["TabmixGroupsMigrator"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Promise",
  "resource://gre/modules/Promise.jsm");

XPCOMUtils.defineLazyGetter(this, "TabGroupsMigrator", () => {
  if (!TabmixSvc.version(450) || TabmixSvc.version(520)) {
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

XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
  "resource://gre/modules/PlacesUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "AsyncShutdown",
  "resource://gre/modules/AsyncShutdown.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/TabmixSvc.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixPlacesUtils",
  "resource://tabmixplus/Places.jsm");

XPCOMUtils.defineLazyGetter(this, "gBrowserBundle", () => {
  return Services.strings.createBundle('chrome://browser/locale/browser.properties');
});

this.TabmixGroupsMigrator = {
  /**
   * If previous or last session contains tab groups, save a back
   */
  backupSessions(window, isAfterCrash) {
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
          if (!sm.nodeHasArc(windowPath, "dontLoad")) {
            let data = sm.getLiteralValue(windowPath, "tabview-groups", "{}");
            let parsedData = TabmixSvc.JSON.parse(data);
            if (parsedData.totalNumber > 1) {
              notify = true;
              return true;
            }
          }
        }
      }
      return false;
    };

    let bookmarkGroups = session => {
      let state = window.TabmixConvertSession.getSessionState(session, true);
      let {hiddenTabState, groupData} = this.removeHiddenTabGroupsFromState(state);
      if (hiddenTabState.windows.length) {
        sm.showTabGroupRestorationPage = true;
        this.bookmarkAllGroupsFromState(groupData);
      }
    };

    let string = s => TabmixSvc.getSMString("sm.tabview.backup." + s);
    let saveSessions = (type, index, bookmark) => {
      let session = sm.gSessionPath[index];
      if (!isSessionWithGroups(session)) {
        return;
      }

      if (bookmark && index === 0) {
        bookmarkGroups(session);
      }

      sm.saveClosedSession({
        session,
        name: {name: string(type)},
        nameExt: sm.getLiteralValue(session, "nameExt", ""),
        button: -1
      });
    };

    try {
      // we run this function before prepareAfterCrash and prepareSavedSessions
      // we need to backup 2 last session, if last session was crashed backup
      // one more older session
      let index = isAfterCrash ? 1 : 0;
      saveSessions("session", index + 1);
      saveSessions("session", index, true);
      if (isAfterCrash) {
        saveSessions("crashed", 0, true);
      }
      if (notify) {
        TabmixSvc.sm.showMissingTabViewNotification = {msg: string("msg")};
        this.missingTabViewNotification(window, string("msg"));
      }
    } catch (ex) {
      TabmixSvc.console.assert(ex);
    }
  },

  getNotificationBox(doc) {
    return doc.getElementById("high-priority-global-notificationbox") ||
      doc.getElementById("global-notificationbox");
  },

  closeNotificationFromAllWindows() {
    TabmixSvc.forEachBrowserWindow(aWindow => {
      let notificationBox = this.getNotificationBox(aWindow.document);
      let notification = notificationBox.getNotificationWithValue("tabmix-missing-tabview");
      if (notification) {
        notificationBox.removeNotification(notification);
      }
    });
  },

  missingTabViewNotification(win, backup = "") {
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
      callback() {
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
        callback() {
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
      aEventType => {
        if (aEventType == "removed") {
          TabmixSvc.sm.showMissingTabViewNotification = null;
          this.closeNotificationFromAllWindows();
        }
      }
    );
  },

  removeHiddenTabGroupsFromState(state) {
    if (!TabGroupsMigrator) {
      return {hiddenTabState: {windows: []}};
    }

    let groupData = TabGroupsMigrator._gatherGroupData(state);
    let hiddenTabState = TabGroupsMigrator._removeHiddenTabGroupsFromState(state, groupData);
    return {hiddenTabState, groupData};
  },

  isGroupExist(groupData) {
    return [...groupData.keys()].length > 0;
  },

  // add windows without groups to the data as single group
  // add window count to each folder title
  gatherGroupData(state) {
    if (!TabGroupsMigrator) {
      return null;
    }

    let allGroupData = TabGroupsMigrator._gatherGroupData(state);
    // add window count for each group title
    let getWinTitle = id => {
      const name = "sm.bookmarks.migration.windowID";
      return TabmixSvc.SMstrings.formatStringFromName(name, [id], 1);
    };
    let getTitle = id => {
      const name = "tabgroups.migration.anonGroup";
      return gBrowserBundle.formatStringFromName(name, [id], 1);
    };
    let winID = 0;
    for (let win of state.windows) {
      let winTitle = getWinTitle(++winID);
      let windowGroupMap = allGroupData.get(win);
      if (windowGroupMap) {
        let anonGroupCount = 0;
        let windowGroups = [...windowGroupMap.values()].sort(TabGroupsMigrator._groupSorter);
        let singleAnonGroup = windowGroups[0].anonGroupID && windowGroups.length == 1;
        if (singleAnonGroup) {
          windowGroups[0].tabGroupsMigrationTitle = winTitle;
        } else {
          for (let group of windowGroups) {
            let title = group.anonGroupID ?
              getTitle(++anonGroupCount) : group.tabGroupsMigrationTitle;
            group.tabGroupsMigrationTitle = winTitle + " " + title;
          }
        }
      } else {
        windowGroupMap = new Map();
        windowGroupMap.set("active group", {
          tabs: win.tabs,
          anonGroupID: 1,
          tabGroupsMigrationTitle: winTitle
        });
        allGroupData.set(win, windowGroupMap);
      }
    }
    return allGroupData;
  },

  setTabTitle(groupData) {
    for (let [, windowGroupMap] of groupData) {
      let windowGroups = [...windowGroupMap.values()];
      for (let group of windowGroups) {
        for (let tab of group.tabs) {
          let entry = tab.entries[tab.index - 1];
          let title = tab.title || entry.title;
          tab.title = TabmixPlacesUtils.getTitleFromBookmark(entry.url, title);
        }
      }
    }
  },

  promiseItemId({guid}) {
    return PlacesUtils.promiseItemId(guid).then(id => {
      return {id, guid};
    });
  },

  // create SessionsFolder: function() {
  createSessionsFolder() {
    let BM = PlacesUtils.bookmarks;
    return BM.insert({
      parentGuid: BM.menuGuid,
      type: BM.TYPE_FOLDER,
      index: 0,
      title: TabmixSvc.getSMString("sm.bookmarks.sessionFolder"),
    }).then(this.promiseItemId)
        .catch(TabmixSvc.console.reportError);
  },

  getSessionsFolder(folder) {
    return this.promiseItemId(folder).catch(() => this.createSessionsFolder());
  },

  bookmarkAllGroupsFromState(groupData, guid, name) {
    let folder = {guid};
    if (!TabGroupsMigrator || !this.isGroupExist(groupData)) {
      return Promise.resolve(folder);
    }

    // replaced title for previously bookmarked tabs with title of the bookmark
    this.setTabTitle(groupData);
    let bookmarksFinishedPromise = TabGroupsMigrator._bookmarkAllGroupsFromState(groupData);
    let promise = bookmarksFinishedPromise;

    let sessionsFolder;
    if (name) {
      // move the folder created by TabGroupsMigrator to our folder and replace
      // its title with the session title
      let groupsPromise = TabGroupsMigrator.bookmarkedGroupsPromise.then(this.promiseItemId);
      sessionsFolder = this.getSessionsFolder(folder);
      let movePromise = Promise.all([groupsPromise, sessionsFolder]).then(([item, parent]) => {
        let BM = PlacesUtils.bookmarks;
        BM.moveItem(item.id, parent.id, BM.DEFAULT_INDEX);
        BM.setItemTitle(item.id, name);
      });
      promise = Promise.all([bookmarksFinishedPromise, movePromise]);
    }

    AsyncShutdown.profileBeforeChange.addBlocker(
      "Tab groups migration bookmarks",
      promise
    );
    return sessionsFolder;
  },

  showBackgroundTabGroupRestorationPage(state, backgroundData) {
    const RECOVERY_URL = "chrome://browser/content/aboutTabGroupsMigration.xhtml";
    let win = state.windows[state.windows.length - 1];
    let formdata = {id: {sessionData: JSON.stringify(backgroundData)}, url: RECOVERY_URL};
    let newTab = {entries: [{url: RECOVERY_URL}], formdata, index: 1};
    // Add tab and mark it as selected:
    win.selected = win.tabs.push(newTab);
  },
};
