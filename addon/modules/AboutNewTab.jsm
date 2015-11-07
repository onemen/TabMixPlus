"use strict";

this.EXPORTED_SYMBOLS = ["TabmixAboutNewTab"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "DirectoryLinksProvider",
  "resource:///modules/DirectoryLinksProvider.jsm");

XPCOMUtils.defineLazyGetter(this, "gAllPages", function() {
  let tmp = {};
  Cu.import("resource://gre/modules/NewTabUtils.jsm", tmp);
  return tmp.NewTabUtils.allPages;
});

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixPlacesUtils",
  "resource://tabmixplus/Places.jsm");

this.TabmixAboutNewTab = Object.freeze({
  updateAllBrowsers: function(window) {
    AboutNewTabInternal.updateAllBrowsers(window);
  },

  updateBrowser: function(browser) {
    AboutNewTabInternal.updateBrowser(browser);
  },

  updateTitles: function(cells) {
    AboutNewTabInternal.updateTitles(cells);
  },
});

var AboutNewTabInternal = {
  // update all opened about:newtab browsers in a window including preloaded
  // browser if exist
  updateAllBrowsers: function(window) {
    let tabBrowser = window.gBrowser;
    let tabPanels = tabBrowser.mPanelContainer.childNodes;
    let browsers = Array.map(tabPanels, tabPanel => tabBrowser.getBrowserForTabPanel(tabPanel))
                        .filter(browser => browser.currentURI.spec == "about:newtab");
    browsers.forEach(browser => this.updateBrowser(browser));
  },

  updateBrowser: function(browser) {
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

  updateTitles: function(cells = []) {
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
      site.refreshThumbnail();
    });
  },
};
