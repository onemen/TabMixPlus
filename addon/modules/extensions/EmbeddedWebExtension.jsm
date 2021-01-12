/* globals OS */
"use strict";

this.EXPORTED_SYMBOLS = ['EmbeddedWebExtension'];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import('resource://gre/modules/XPCOMUtils.jsm', this);

XPCOMUtils.defineLazyModuleGetter(this, 'Services',
  'resource://gre/modules/Services.jsm');

XPCOMUtils.defineLazyGetter(this, "OS", () => {
  return Cu.import("resource://gre/modules/osfile.jsm", {}).OS;
});

XPCOMUtils.defineLazyModuleGetter(this, 'TabmixSvc',
  'resource://tabmixplus/TabmixSvc.jsm');

XPCOMUtils.defineLazyModuleGetter(this, "PromiseUtils",
  "resource://gre/modules/PromiseUtils.jsm");

const PrefFn = {0: '', 32: 'CharPref', 64: 'IntPref', 128: 'BoolPref'};
// other settings not in extensions.tabmix. branch that we save
const otherPrefs = [
  'browser.allTabs.previews', 'browser.ctrlTab.previews',
  'browser.link.open_newwindow', 'browser.link.open_newwindow.override.external',
  'browser.link.open_newwindow.restriction', TabmixSvc.newtabUrl,
  'browser.search.context.loadInBackground', 'browser.search.openintab',
  'browser.sessionstore.interval', 'browser.sessionstore.max_tabs_undo',
  'browser.sessionstore.postdata', 'browser.sessionstore.privacy_level',
  'browser.sessionstore.restore_on_demand',
  'browser.sessionstore.resume_from_crash', 'browser.startup.page',
  'browser.tabs.closeWindowWithLastTab',
  'browser.tabs.insertRelatedAfterCurrent', 'browser.tabs.loadBookmarksInBackground',
  'browser.tabs.loadDivertedInBackground', 'browser.tabs.loadInBackground',
  'browser.tabs.tabClipWidth', 'browser.tabs.tabMaxWidth', 'browser.tabs.tabMinWidth',
  'browser.tabs.warnOnClose', 'browser.warnOnQuit',
  'toolkit.scrollbox.clickToScroll.scrollDelay', 'toolkit.scrollbox.smoothScroll'
];

XPCOMUtils.defineLazyGetter(this, 'gPreferenceList', () => {
  let prefs = Services.prefs.getDefaultBranch('');
  let tabmixPrefs = Services.prefs.getChildList('extensions.tabmix.').sort();
  // filter out preference without default value
  tabmixPrefs = otherPrefs.concat(tabmixPrefs).filter(pref => {
    try {
      return prefs['get' + PrefFn[prefs.getPrefType(pref)]](pref) !== undefined;
    } catch (ex) { }
    return false;
  });
  return tabmixPrefs;
});

const TABMIX_ID = '{dc572301-7619-498c-a57d-39143191b318}';

const MIGRATE = 'tabmix.session.migrate.';

this.EmbeddedWebExtension = {
  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIObserver,
    Ci.nsISupportsWeakReference
  ]),

  webextPort: null,

  connected: false,

  init() {
    if (this._initialized || !TabmixSvc.version(510)) {
      return;
    }
    this._initialized = true;

    TabmixSvc.sm.deferredInitialized = PromiseUtils.defer();

    this.initPrefsObserver();
    this.startWebExtension();
  },

  startWebExtension() {
    const {AddonManager} = Cu.import('resource://gre/modules/AddonManager.jsm', {});

    AddonManager.getAddonByID(TABMIX_ID, addon => {
      const baseURI = addon.getResourceURI('/');

      const {LegacyExtensionsUtils} = Cu.import('resource://gre/modules/LegacyExtensionsUtils.jsm', {});

      const embeddedWebExtension = LegacyExtensionsUtils.getEmbeddedExtensionFor({
        id: TABMIX_ID,
        resourceURI: baseURI,
      });

      embeddedWebExtension.startup().then(({browser}) => {
        browser.runtime.onConnect.addListener(function onConnect(port) {
          browser.runtime.onConnect.removeListener(onConnect);
          this.onConnect(port);
        }.bind(this));
      }).catch(err => {
        TabmixSvc.console.reportError(
          `${TABMIX_ID} - embedded webext startup failed: ${err.message} ${err.stack}\n`
        );
      });
    });
  },

  onConnect(port) {
    if (port.name !== 'tabmix-storage-port') {
      throw new Error('Invalid port name: ' + port.name);
    }

    this.webextPort = port;
    this.connected = true;

    port.onDisconnect.addListener(() => {
      this.webextPort = null;
    });

    port.onMessage.addListener(message => this.handleResponse(message));

    this.savePreferencesData();
    TabmixSvc.sm.deferredInitialized.promise.then(() => this.saveSessionsData());
  },

  messageID: 0,

  asyncResponses: new Map(),

  handleStorageRequest(message, asyncResponse) {
    const errorMsg = 'Attempted to connect to the embedded WebExtension helper, but it died!';

    message.messageID += ':' + this.messageID++;
    if (this.webextPort) {
      this.webextPort.postMessage(message);
    } else if (asyncResponse) {
      asyncResponse.reject(errorMsg);
    } else {
      TabmixSvc.console.reportError(errorMsg);
    }

    if (this.webextPort && asyncResponse) {
      this.asyncResponses.set(message.messageID, asyncResponse);
    }
  },

  // we show success message only on first save in the session
  // preferences, remove sessions, add sessions
  showSuccessMsg: 3,

  handleResponse(message) {
    const ID = message.messageID;
    if (!ID.startsWith('migration.')) {
      TabmixSvc.console.reportError('Unexpected messageID: ' + ID);
      throw new Error('Unexpected messageID: ' + ID);
    }

    if (message.saveBackup) {
      this.saveBackupFile();
    }

    if (message.error) {
      // Unexpectedly, an error occurred.
      TabmixSvc.console.reportError(message.error);
    } else if (this.showSuccessMsg && message.successMsg) {
      TabmixSvc.console.log(message.successMsg);
      this.showSuccessMsg--;
    }

    if (this.asyncResponses.has(ID)) {
      const asyncResponse = this.asyncResponses.get(ID);
      asyncResponse.resolve(message.error ? {} : message.result);
      this.asyncResponses.delete(ID);
    }
  },

  /* Migrate Tab mix preferences */

  initPrefsObserver() {
    // add prefs observer
    const OBSERVING = ['extensions.tabmix.', ...otherPrefs];
    OBSERVING.forEach(prefName => {
      try {
        Services.prefs.addObserver(prefName, this, true);
      } catch (ex) {
        TabmixSvc.console.log(`EmbeddedWebExtension failed to attach pref observer for ${prefName}:\n${ex}`);
      }
    });
  },

  observe(subject, topic, prefName) {
    switch (topic) {
      case "nsPref:changed": // catch pref changes
        if (gPreferenceList.includes(prefName)) {
          const key = 'tabmix.preference.migrate.' + prefName;
          this.handleStorageRequest({
            messageID: 'migration.preference.changed: ' + prefName,
            errorMsg: 'fails to save preference to browser.storage',
            type: 'set',
            keys: {[key]: TabmixSvc.prefs.get(prefName)},
          });
        }
        break;
    }
  },

  savePreferencesData() {
    const keys = this.getAllPreferences();
    this.handleStorageRequest({
      messageID: 'migration.preferences',
      successMsg: this.tag`Successfully saved ${keys} preferences to browser.storage`,
      errorMsg: 'fails to save preferences to browser.storage',
      type: 'set',
      keys,
    });
  },

  getAllPreferences() {
    return gPreferenceList.reduce((prefs, prefName) => {
      let val;
      try {
        val = TabmixSvc.prefs.get(prefName);
      } catch (ex) {}
      if (typeof val != 'undefined') {
        prefs['tabmix.preference.migrate.' + prefName] = val;
      }
      return prefs;
    }, {});
  },

  /* Migrate Tab mix sessions data */

  hashList: null,

  saveSessionsData(shutDown) {
    if (!this.connected) {
      return;
    }

    if (shutDown) {
      // force to save the current session - see getSessionList
      this._lastSaveTime = 0;
    }

    if (this.hashList) {
      const data = this.getCurrentSessionsData(this.hashList);
      this.sendSessionToStorage(data, shutDown);
    } else {
      this.getCurrentHashList()
          .then(result => this.getCurrentSessionsData(result || []))
          .then(data => this.sendSessionToStorage(data, shutDown))
          .catch(err => TabmixSvc.console.reportError(err));
    }
  },

  getCurrentHashList() {
    const asyncHashList = PromiseUtils.defer();
    this.handleStorageRequest({
      messageID: 'migration.sessions.getHash',
      errorMsg: 'fails to read current hash list from browser.storage',
      type: 'getHashList',
    }, asyncHashList);

    return asyncHashList.promise;
  },

  getCurrentSessionsData(currentHashList) {
    const newHashList = [];
    const sessionsData = {};
    const window = this.getBrowserWindow();
    if (!window) {
      return Promise.reject("can't find a window with readyState complete");
    }
    const {TabmixSessionManager, TabmixConvertSession} = window;
    const sessions = this.getSessionList(TabmixSessionManager);

    const changedSessions = sessions.filter(session => {
      const hash = session.info.hash;
      newHashList.push(hash);
      return !currentHashList.includes(hash);
    });

    changedSessions.forEach(session => {
      const state = TabmixConvertSession.getSessionState(session.path);
      if (state.windows.length == 0) {
        return;
      }
      // we don't need to set state: "stopped" for this migration
      // state.session = {state: "stopped"};
      delete state.tabsCount;
      let {name, info: {hash, timestamp, windows, tabs}} = session;

      sessionsData[hash] = {
        name,
        timestamp,
        windows,
        tabs,
        state,
      };
    });

    this.hashList = newHashList;

    return {currentHashList, newHashList, sessionsData};
  },

  tag(strings, data, noun) {
    let count = typeof data == 'number' ? data : Object.keys(data).length;
    if (noun) {
      noun = count == 1 ? noun.slice(0, -1) : noun;
      return strings[0] + count + strings[1] + noun + strings[2];
    }
    return strings[0] + count + strings[1];
  },

  sendSessionToStorage({currentHashList, newHashList, sessionsData}, saveBackup) {
    let remove, add;
    const hashToRemove = currentHashList.filter(hash => !newHashList.includes(hash));

    // remove obsolete data
    if (hashToRemove.length > 0) {
      remove = {
        successMsg: this.tag`Successfully removed ${hashToRemove} obsolete ${'sessions'} from browser.storage`,
        errorMsg: 'fails to remove obsolete sessions from browser.storage',
        keys: hashToRemove,
      };
    }

    // save sessions data
    if (Object.keys(sessionsData).length > 0) {
      add = {
        successMsg: this.tag`Successfully saved ${sessionsData} ${'sessions'} to browser.storage`,
        errorMsg: 'fails to save sessions to browser.storage',
        keys: sessionsData,
      };
    }

    if (remove || add) {
      this.handleStorageRequest({
        messageID: 'migration.sessions',
        type: 'update',
        saveBackup,
        remove,
        add,
      });
    } else if (saveBackup) {
      this.saveBackupFile();
    }
  },

  // save backup of the storage.js file to webext@tabmixplus.org folder
  // for the case we will use it as the new extension id
  saveBackupFile() {
    const dataFolder = OS.Path.join(OS.Constants.Path.profileDir, "browser-extension-data");
    const storage = OS.Path.join(dataFolder, TABMIX_ID, "storage.js");
    const backupFolder = OS.Path.join(dataFolder, "webext@tabmixplus.org");
    const backupFile = OS.Path.join(backupFolder, "storage.js");

    // since we are here only when browser-extension-data exist, we only need to
    // create our backup folder
    OS.File.makeDir(backupFolder).then(() => {
      return OS.File.copy(storage, backupFile);
    }).catch(error => TabmixSvc.console.reportError(error));
  },

  _lastSaveTime: 0,

  _currentHash: null,

  getSessionList(SM) {
    const sessions = SM.getSessionList() || {list: [], path: []};

    const crashedSession = SM.gSessionPath[3];
    if (!SM.containerEmpty(crashedSession)) {
      sessions.path.push(crashedSession);
      sessions.list.push("Crashed Session");
    }

    const list = sessions.list.map((name, index) => {
      const path = sessions.path[index];
      const nameExt = SM.getLiteralValue(path, "nameExt").replace(/^, /, "");
      return this.getInfo(name, path, nameExt);
    });

    // save current session no more than once in 10 sec, unless our session
    // manager is shutting down
    const currentSession = SM.gSessionPath[0];
    this.saveCurrentSession = SM.enableManager && SM.enableBackup &&
      !SM.containerEmpty(currentSession);
    if (this.saveCurrentSession) {
      const currentContainer = SM.initContainer(currentSession);
      const count = SM.countWinsAndTabs(currentContainer);
      // 'Current Session' don't have nameExt
      const nameExt = SM.getNameData(count.win, count.tab);
      const data = this.getInfo("Current Session", currentSession, nameExt);
      const prefix = `${MIGRATE}Current_Session.`;
      data.info.hash = data.info.hash.replace(`${MIGRATE}history.`, prefix);
      if (this._currentHash && Date.now() - this._lastSaveTime < 10000) {
        data.info.hash = this._currentHash;
      } else {
        this._lastSaveTime = Date.now();
        this._currentHash = data.info.hash;
      }
      list.push(data);
    }

    return list;
  },

  getInfo(name, path, nameExt) {
    if (nameExt.startsWith("(empty)")) {
      nameExt = nameExt.replace("empty", "0 W, 0 T");
    }

    let re = /\((\d+\sW)*[,\s]*(\d+\sT)\)\s\((\d{4}\/\d{2}\/\d{2})\s(\d{2}:\d{2}:\d{2})/;
    let matches = nameExt.match(re);
    let info;
    if (matches) {
      const date = new Date(matches[3] + " " + matches[4]);
      const timestamp = Date.parse(date);
      const type = path.startsWith('rdf://tabmix/closed') ? 'history.' : 'saved.';
      // The hash value is unique identifier for the session generated from
      // the path timestamp and name of the session
      info = {
        windows: matches[1] ? parseInt(matches[1]) : 1,
        tabs: parseInt(matches[2]),
        timestamp,
        hash: MIGRATE + type + generateHash(`${path}-${timestamp}-${name}`),
      };
    } else {
      info = {invalidInfo: nameExt};
    }

    return {name, path, info};
  },

  getBrowserWindow() {
    const windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      const win = windows.getNext();
      if (!win.closed && win.document.readyState == "complete")
        return win;
    }
    return null;
  },
};

/**
 * Generates an hash for the given string.
 *
 * @note The generated hash is returned in base64 form.  Mind the fact base64
 * is case-sensitive if you are going to reuse this code.
 */
function generateHash(aString) {
  let cryptoHash = Cc["@mozilla.org/security/hash;1"]
      .createInstance(Ci.nsICryptoHash);
  cryptoHash.init(Ci.nsICryptoHash.MD5);
  let stringStream = Cc["@mozilla.org/io/string-input-stream;1"]
      .createInstance(Ci.nsIStringInputStream);
  stringStream.data = aString;
  cryptoHash.updateFromStream(stringStream, -1);
  return cryptoHash.finish(true);
}

this.EmbeddedWebExtension.init();
