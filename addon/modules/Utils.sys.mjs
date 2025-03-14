
// Messages that will be received via the Frame Message Manager.
const FMM_MESSAGES = [
  "Tabmix:restorePermissionsComplete",
  "Tabmix:reloadTab",
  "Tabmix:getOpener",
  "Tabmix:contentDrop",
  "Tabmix:contextmenu",
];

/** @type {TabmixUtilsModule.Lazy} */ // @ts-ignore
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  E10SUtils: "resource://gre/modules/E10SUtils.sys.mjs",
  NetUtil: "resource://gre/modules/NetUtil.sys.mjs",
  AutoReload: "chrome://tabmix-resource/content/AutoReload.sys.mjs",
  DocShellCapabilities: "chrome://tabmix-resource/content/DocShellCapabilities.sys.mjs",
  MergeWindows: "chrome://tabmix-resource/content/MergeWindows.sys.mjs",
  TabmixSvc: "chrome://tabmix-resource/content/TabmixSvc.sys.mjs",
});

// const {TabmixUtils} = ChromeUtils.importESModule("chrome://tabmix-resource/content/Utils.sys.mjs")

/** @type {TabmixUtilsModule.TabmixUtils} */
export const TabmixUtils = {
  initMessageManager(window) {
    let mm = window.getGroupMessageManager("browsers");
    FMM_MESSAGES.forEach(msg => mm.addMessageListener(msg, this));

    // Load the frame script after registering listeners.
    mm.loadFrameScript("chrome://tabmixplus/content/scripts/content.js", true);
  },

  deinit(window) {
    let mm = window.getGroupMessageManager("browsers");
    FMM_MESSAGES.forEach(msg => mm.removeMessageListener(msg, this));
  },

  receiveMessage(message) {
    let browser = message.target;
    let win, tab;
    switch (message.name) {
      case "Tabmix:restorePermissionsComplete":
        lazy.DocShellCapabilities.update(browser, message.data);
        break;
      case "Tabmix:reloadTab": {
        let postData = message.data.postData;
        if (postData)
          message.data.postData = this.makeInputStream(postData);
        lazy.AutoReload.reloadRemoteTab(browser, message.data);
        break;
      }
      case "Tabmix:getOpener":
        win = browser.ownerGlobal;
        tab = win.gBrowser.getTabForBrowser(browser);
        lazy.MergeWindows.moveTabsFromPopups(tab, message.data.openerID);
        break;
      case "Tabmix:contentDrop": {
        const {json, links} = message.data;
        const url = links[0].url;
        win = browser.ownerGlobal;
        const where = !lazy.TabmixSvc.isGlitterInstalled &&
          win.Tabmix.tablib.whereToOpenDrop(json, url);
        if (where == "tab") {
          links[0].tabmixContentDrop = "tab";
          browser.droppedLinkHandler(null, links, Services.scriptSecurityManager.getSystemPrincipal());
          // prevent default
          return true;
        }
        return false;
      }
      case "Tabmix:contextmenu": {
        browser.ownerGlobal.Tabmix.contextMenuLinks = message.data.links;
        break;
      }
    }
    return null;
  },

  focusedWindow(content) {
    /** @type {{value: Window}} */ // @ts-ignore
    let focusedWindow = {};
    Services.focus.getFocusedElementForWindow(content, true, focusedWindow);
    return focusedWindow.value;
  },

  makeInputStream(aString) {
    const stream = Cc["@mozilla.org/io/string-input-stream;1"]
        .createInstance(Ci.nsIStringInputStream);
    const stringStream = stream.QueryInterface(Ci.nsIStringInputStream);
    stringStream.setUTF8Data(aString);
    return stringStream;
  },

  // change current history title
  updateHistoryTitle(history, title) {
    const shEntry = history.getEntryAtIndex(history.index).QueryInterface?.(Ci.nsISHEntry);
    if (shEntry) {
      shEntry.title = title;
    }
  },

  getPostDataFromHistory(history) {
    const json = {};
    const shEntry = history?.getEntryAtIndex(history.index).QueryInterface?.(Ci.nsISHEntry);
    const postData = shEntry?.postData?.QueryInterface?.(Ci.nsICloneableInputStream);
    if (shEntry && postData) {
      const clone = postData.clone();
      json.postData = lazy.NetUtil.readInputStreamToString(clone, clone.available());
      json.referrerInfo = lazy.E10SUtils.serializeReferrerInfo(shEntry.referrerInfo);
    }
    json.isPostData = Boolean(json.postData);
    return json;
  },
};
