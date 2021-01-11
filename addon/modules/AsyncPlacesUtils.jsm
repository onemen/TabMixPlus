"use strict";

this.EXPORTED_SYMBOLS = ["AsyncPlacesUtils"];

const {utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
  "resource://gre/modules/PlacesUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/TabmixSvc.jsm");

this.AsyncPlacesUtils = {
  promiseItemGuid(itemId) {
    return PlacesUtils.promiseItemGuid(itemId);
  },
  promiseItemId(guid) {
    return PlacesUtils.promiseItemId(guid);
  },

  fetch(guidOrInfo, onResult = null, options = {}) {
    return PlacesUtils.bookmarks.fetch(guidOrInfo, onResult, options);
  },

  async getBookmarkTitle(url, itemId) {
    itemId = itemId || -1;
    try {
      if (itemId > -1) {
        const _URI = PlacesUtils.bookmarks.getBookmarkURI(itemId);
        if (_URI && _URI.spec == url) {
          return {
            itemId,
            title: PlacesUtils.bookmarks.getItemTitle(itemId),
          };
        }
      }
    } catch (ex) {
      TabmixSvc.console.reportError(ex, 'Error function name changed', 'not a function');
    }
    try {
      const {guid, title} = await this.fetch({url});
      if (guid) {
        itemId = await this.promiseItemId(guid);
        return {
          itemId,
          title,
        };
      }
    } catch (ex) {
      TabmixSvc.console.reportError(ex, 'Error function name changed', 'not a function');
    }
    return null;
  },

  async applyCallBackOnUrl(aUrl, ietab, aCallBack) {
    let hasHref = aUrl.indexOf("#") > -1;
    let result = await aCallBack.apply(this, [aUrl]) ||
        hasHref && await aCallBack.apply(this, aUrl.split("#"));
    // when IE Tab is installed try to find url with or without the prefix
    if (!result && ietab) {
      let prefix = "chrome://" + ietab.folder + "/content/reloaded.html?url=";
      if (aUrl != prefix) {
        let url = aUrl.startsWith(prefix) ?
          aUrl.replace(prefix, "") : prefix + aUrl;
        result = await aCallBack.apply(this, [url]) ||
          hasHref && await aCallBack.apply(this, url.split("#"));
      }
    }
    return result;
  },

  async getTitleFromBookmark(aUrl, aTitle, aItemId, aTab, ietab) {
    aItemId = aTab ? aTab.getAttribute("tabmix_bookmarkId") : aItemId;
    const getTitle = url => this.getBookmarkTitle(url, aItemId);
    const result = await this.applyCallBackOnUrl(aUrl, ietab, getTitle);
    const {itemId, title} = result || {};
    if (aTab) {
      let win = aTab.ownerGlobal;
      // setItem check if aTab exist and remove the attribute if it is null
      win.Tabmix.setItem(aTab, "tabmix_bookmarkId", itemId || null);
    }

    return title || aTitle;
  },

};
