"use strict";

this.EXPORTED_SYMBOLS = ["TabmixAboutNewTab"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);

XPCOMUtils.defineLazyModuleGetter(this, "DirectoryLinksProvider",
  "resource:///modules/DirectoryLinksProvider.jsm");

XPCOMUtils.defineLazyGetter(this, "gAllPages", () => {
  let tmp = {};
  Cu.import("resource://gre/modules/NewTabUtils.jsm", tmp);
  return tmp.NewTabUtils.allPages;
});

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "chrome://tabmix-resource/content/TabmixSvc.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixPlacesUtils",
  "chrome://tabmix-resource/content/Places.jsm");

var AboutNewTabInternal;
this.TabmixAboutNewTab = Object.freeze({
  updateAllBrowsers(window) {
    AboutNewTabInternal.updateAllBrowsers(window);
  },

  updateBrowser(browser) {
    AboutNewTabInternal.updateBrowser(browser);
  },

  updateTitles(cells) {
    AboutNewTabInternal.updateTitles(cells);
  },
});

AboutNewTabInternal = {
  // update all opened about:newtab browsers in a window including preloaded
  // browser if exist
  updateAllBrowsers(window) {
    let tabBrowser = window.gBrowser;
    let tabPanels = tabBrowser.tabpanels.childNodes;
    let browsers = Array.prototype.map.call(tabPanels, tabPanel => tabBrowser.getBrowserForTabPanel(tabPanel))
        .filter(browser => browser.currentURI.spec == TabmixSvc.aboutNewtab);
    browsers.forEach(browser => this.updateBrowser(browser));
  },

  updateBrowser(browser) {
    browser.messageManager.sendAsyncMessage("Tabmix:updateTitlefrombookmark");
  },

  updateTitles(cells = []) {
    cells.forEach(cell => {
      let site = cell.site;
      if (!site) {
        return;
      }

      let enhancedTitle;

      let enhanced = gAllPages.enhanced &&
            DirectoryLinksProvider.getEnhancedLink(site.link);
      enhancedTitle = enhanced && enhanced.title;

      let url = site.url;
      let title, tooltip;
      let tabmixTitle = TabmixPlacesUtils.getTitleFromBookmark(url, site.title);
      title = enhancedTitle ? enhancedTitle :
        site.link.type == "history" ? site.link.baseDomain :
          tabmixTitle;
      tooltip = (tabmixTitle == url ? tabmixTitle : tabmixTitle + "\n" + url);

      let link = site._querySelector(".newtab-link");
      link.setAttribute("title", tooltip);
      site._querySelector(".newtab-title").textContent = title;
    });
  },
};
