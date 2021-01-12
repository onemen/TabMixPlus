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
  "resource://tabmixplus/TabmixSvc.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixPlacesUtils",
  "resource://tabmixplus/Places.jsm");

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
    let tabPanels = tabBrowser.mPanelContainer.childNodes;
    let browsers = Array.prototype.map.call(tabPanels, tabPanel => tabBrowser.getBrowserForTabPanel(tabPanel))
        .filter(browser => browser.currentURI.spec == TabmixSvc.aboutNewtab);
    browsers.forEach(browser => this.updateBrowser(browser));
  },

  updateBrowser(browser) {
    if (TabmixSvc.version(420)) {
      browser.messageManager.sendAsyncMessage("Tabmix:updateTitlefrombookmark");
    } else {
      try {
        let doc = browser.contentDocument || browser.contentDocumentAsCPOW;
        this.updateTitles(doc.defaultView.gGrid.cells);
      } catch (ex) {
        TabmixSvc.console.reportError(ex);
      }
    }
  },

  updateTitles(cells = []) {
    cells.forEach(cell => {
      let site = cell.site;
      if (!site) {
        return;
      }

      let enhancedTitle;
      if (TabmixSvc.version(340)) {
        let enhanced = gAllPages.enhanced &&
            DirectoryLinksProvider.getEnhancedLink(site.link);
        enhancedTitle = enhanced && enhanced.title;
      }

      let url = site.url;
      let title, tooltip;
      if (TabmixSvc.version(400)) {
        let tabmixTitle = TabmixPlacesUtils.getTitleFromBookmark(url, site.title);
        title = enhancedTitle ? enhancedTitle :
          site.link.type == "history" ? site.link.baseDomain :
            tabmixTitle;
        tooltip = (tabmixTitle == url ? tabmixTitle : tabmixTitle + "\n" + url);
      } else {
        title = enhancedTitle ||
                TabmixPlacesUtils.getTitleFromBookmark(url, site.title || url);
        tooltip = (title == url ? title : title + "\n" + url);
      }

      let link = site._querySelector(".newtab-link");
      link.setAttribute("title", tooltip);
      site._querySelector(".newtab-title").textContent = title;
      // Pale Moon dot't have a refreshThumbnail function
      if (typeof site.refreshThumbnail == "function") {
        site.refreshThumbnail();
      }
    });
  },
};
