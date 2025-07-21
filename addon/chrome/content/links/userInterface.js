/* exported TMP_BrowserOpenTab */
"use strict";

/*
 * chrome://tabmixplus/content/links/userInterface.js
 *
 * original code by Bradley Chapman
 * modified and developed by Hemiola SUN
 * modified again by Bradley Chapman
 *
 * modified again and again... by onemen
 *
 */

Tabmix.openOptionsDialog = function TMP_openDialog(panel) {
  var windowMediator = Services.wm;
  var tabmixOptionsWin = windowMediator.getMostRecentWindow("mozilla:tabmixopt");
  if (tabmixOptionsWin) {
    var appearanceWin = windowMediator.getMostRecentWindow("mozilla:tabmixopt-appearance");
    var filetypeWin = windowMediator.getMostRecentWindow("mozilla:tabmixopt-filetype");
    var promptWin = windowMediator.getMostRecentWindow("mozilla:tabmixprompt");

    if (panel && !appearanceWin && !filetypeWin && !promptWin) {
      tabmixOptionsWin.showPane(panel);
    }

    tabmixOptionsWin.gIncompatiblePane.checkForIncompatible(false);

    (appearanceWin || filetypeWin || promptWin || tabmixOptionsWin).focus();
  } else {
    window.openDialog(
      "chrome://tabmixplus/content/preferences/preferences.xhtml",
      "Tab Mix Plus",
      "chrome,titlebar,toolbar,close,dialog=no,centerscreen",
      panel || null
    );
  }
};

// Don't change this function name other extensions using it
// Speed-Dial, Fast-Dial, TabGroupManager
/** @type {GlobalFunctions.TMP_BrowserOpenTab} */
function TMP_BrowserOpenTab(eventOrObject, aTab, replaceLastTab = false) {
  var newTabContent =
    replaceLastTab ?
      Tabmix.prefs.getIntPref("replaceLastTabWith.type")
    : Tabmix.prefs.getIntPref("loadOnNewTab.type");

  /** @type {string} */
  let url = "";
  let {event, url: passedURL = null} = eventOrObject ?? {};

  let werePassedURL = Boolean(passedURL);
  let searchClipboard = window.gMiddleClickNewTabUsesPasteboard && event?.button == 1;
  var newTabUrl = BROWSER_NEW_TAB_URL;
  var selectedTab = gBrowser.selectedTab;
  switch (newTabContent) {
    case 0: // blank tab, by default
      url = "about:blank";
      break;
    case 1: // home page
      /** @type {string} */ // @ts-expect-error
      url = HomePage.get().split("|")[0];
      break;
    case 2: // current URI
      var currentURI = gBrowser.currentURI;
      url = currentURI ? currentURI.spec : newTabUrl;
      break;
    case 3: {
      // duplicate tab
      let currentUrl = gBrowser.currentURI.spec;
      let dupTab = Tabmix.duplicateTab(selectedTab, "", undefined, false, true);
      if (dupTab) {
        Tabmix.clearUrlBarIfNeeded(dupTab, currentUrl, true, replaceLastTab);
      }
      return;
    }
    case 4: {
      // user url
      if (replaceLastTab || TabmixSvc.isCyberfox) {
        let prefName =
          replaceLastTab ? "extensions.tabmix.replaceLastTabWith.newtab.url" : TabmixSvc.newtabUrl;
        try {
          url = Services.prefs.getStringPref(prefName);
          if (newTabUrl == "about:privatebrowsing" && url == TabmixSvc.aboutNewtab) {
            url = "about:privatebrowsing";
          }
        } catch (ex) {
          Tabmix.assert(ex);
        }
      }
      // use this if we can't find the pref
      if (!url) {
        url = newTabUrl;
      }

      break;
    }
    default:
      url = passedURL ?? newTabUrl;
  }
  // if google.toolbar extension installed check google.toolbar.newtab pref
  if ("GTB_GoogleToolbarOverlay" in window) {
    try {
      if (Services.prefs.getBoolPref("google.toolbar.newtab")) {
        url = "chrome://google-toolbar/content/new-tab.html";
      }
    } catch {
      /* no pref - do noting */
    }
  }
  if (TabmixTabbar.widthFitTitle && replaceLastTab && !selectedTab.collapsed) {
    selectedTab.collapsed = true;
  }

  var loadBlank = isBlankPageURL(url);
  if (
    replaceLastTab &&
    !loadBlank &&
    typeof privateTab == "object" &&
    !PrivateBrowsingUtils.isWindowPrivate(window)
  ) {
    let privateTab = window.privateTab;
    if (
      privateTab.isTabPrivate(selectedTab) &&
      TabmixSvc.prefs.get("extensions.privateTab.makeNewEmptyTabsPrivate", 0) === 0
    ) {
      privateTab.readyToOpenTab(false);
    }
  }

  // always select new tab when replacing last tab
  var loadInBackground = replaceLastTab ? false : Tabmix.prefs.getBoolPref("loadNewInBackground");
  let baseTab = aTab && aTab.localName == "tab" ? aTab : null;
  let inGroupPref = Tabmix.prefs.getIntPref("openTabNextInGroup");
  let tabGroup = selectedTab.group;
  let openTabNext =
    Boolean(baseTab) ||
    (!replaceLastTab &&
      Tabmix.prefs.getBoolPref("openNewTabNext") &&
      (!tabGroup || inGroupPref !== 2));

  let where = "tab";
  // Let accel-click and middle-click on the new tab button toggle openTabNext preference
  // see bug 528005
  if (
    event &&
    !aTab &&
    !replaceLastTab &&
    (MouseEvent.isInstance(event) || XULCommandEvent.isInstance(event))
  ) {
    // don't replace 'window' to 'tab' in whereToOpenLink when singleWindowMode is on
    TabmixSvc.skipSingleWindowModeCheck = true;
    where = BrowserUtils.whereToOpenLink(event, false, true);
    TabmixSvc.skipSingleWindowModeCheck = false;
    switch (where) {
      case "tabshifted":
        loadInBackground = !loadInBackground;

      /* falls through */
      case "tab":
        openTabNext = !openTabNext;
        inGroupPref = inGroupPref < 1 ? 2 : 0;
        break;
      case "current":
        where = "tab";
        break;
      case "window":
        if (!TabmixSvc.getSingleWindowMode()) {
          window.openWebLinkIn(url, where);
          return;
        }
        break;
    }
  }

  if (replaceLastTab && Tabmix.isVersion({zen: "1.8.1*"})) {
    const emptyTab = ZenWorkspaces._emptyTab;
    if (
      emptyTab &&
      gZenVerticalTabsManager._canReplaceNewTab &&
      ZenWorkspaces._emptyTab.linkedBrowser.currentURI.spec === url
    ) {
      gBrowser.selectedTab = emptyTab;
      return;
    }
  }

  TMP_extensionsCompatibility.treeStyleTab.onBeforeNewTabCommand(
    baseTab || selectedTab,
    openTabNext
  );

  Services.obs.notifyObservers(
    {
      wrappedJSObject: new Promise(resolve => {
        /** @type {AddTabParams} */
        let options = {
          resolveOnNewTabCreated: resolve,
          charset: loadBlank ? null : gBrowser.selectedBrowser.characterSet,
          ownerTab: loadInBackground ? null : selectedTab,
          skipAnimation: replaceLastTab,
        };

        if (!werePassedURL && searchClipboard) {
          let clipboard = readFromClipboard();
          clipboard = UrlbarUtils.stripUnsafeProtocolOnPaste(clipboard).trim();
          if (clipboard) {
            url = clipboard;
            options.allowThirdPartyFixup = true;
            if (gBrowser.isBlankTab(gBrowser.selectedTab)) {
              where = "current";
            }
          }
        }

        let newTab;

        /** @type {"tabIndex"} */ // @ts-expect-error - we have only tabIndex type in AddTabParams
        let tabIndexKey = Tabmix.isVersion(1400) ? "tabIndex" : "index";
        if (where.startsWith("tab")) {
          if (openTabNext && !baseTab && tabGroup && inGroupPref > 0) {
            // don't add new tab to the group when openTabNextInGroup is 1 or 2
            options[tabIndexKey] =
              inGroupPref === 1 ? tabGroup.tabs.at(-1)._tPos + 1 : gBrowser.tabs.length;
          } else {
            const refTab = baseTab || selectedTab;
            options[tabIndexKey] = openTabNext ? refTab._tPos + 1 : gBrowser.tabs.length;
            options.tabGroup = openTabNext ? refTab.group : null;
          }
          newTab = gBrowser.addTrustedTab(url, options);
        } else {
          // openTrustedLinkIn set forceForeground to true if not set before
          options.forceForeground = false;
          openTrustedLinkIn(url, where, options);
          // openTrustedLinkIn does not return the new tab...
          newTab = gBrowser.getTabForLastPanel();
        }

        if (replaceLastTab) {
          newTab.__newLastTab = url;
          if (loadBlank) {
            gBrowser.tabContainer.setAttribute("closebuttons", "noclose");
            gBrowser.tabContainer.removeAttribute("closebuttons-hover");
          }

          if (Tabmix.isVersion({zen: "1.8.1*"})) {
            if (window.uuid) {
              newTab.setAttribute("zen-workspace-id", ZenWorkspaces.activeWorkspace);
            }
          }
        }

        // make sure to update recently used tabs
        // if user open many tabs quickly select event don't have time to fire
        // before new tab select
        if (!loadInBackground) {
          gBrowser.selectedTab = newTab;
          TMP_LastTab.PushSelectedTab();
        }

        gBrowser.selectedBrowser.focus();
        Tabmix.clearUrlBarIfNeeded(newTab, url, false, replaceLastTab);
      }),
    },
    "browser-open-newtab-start"
  );
}

Tabmix.selectedTab = null;
Tabmix.clearUrlBarIfNeeded = function (aTab, aUrl, aTimeOut, replaceLastTab) {
  // check if we need to focus the address bar on new tab
  const needToClearUrlBar =
    (!replaceLastTab && Tabmix.prefs.getBoolPref("selectLocationBar")) ||
    (replaceLastTab && Tabmix.prefs.getBoolPref("selectLocationBar.afterLastTabClosed")) ||
    Tabmix.isBlankNewTab(aUrl) ||
    aUrl === "about:privatebrowsing";
  if (!needToClearUrlBar) {
    return;
  }

  // Firefox always call gURLBar.select when it replacing last tab
  if (!replaceLastTab && /about:home|(www\.)*(google|bing)\./.test(aUrl)) {
    return;
  }

  if (aTab.selected && !isBlankPageURL(aUrl)) {
    // clean the the address bar as if the user load about:blank tab
    this.selectedTab = aTab;
    this.userTypedValue = aUrl;
    gBrowser.userTypedValue = "";
    gURLBar.setURI();
  }
  // don't try to focus urlbar on popup
  if (aTab.selected && window.toolbar.visible) {
    if (aTimeOut) {
      setTimeout(() => gURLBar.select(), 30);
    } else {
      gURLBar.select();
    }
  }
};

/**
 * In TMP_BrowserOpenTab we empty and focus the urlbar if the user or onload
 * from a page blur the urlbar before user typed new value we restore the
 * current url
 */
Tabmix.urlBarOnBlur = function TMP_urlBarOnBlur() {
  if (isBlankPageURL(gURLBar.value)) {
    gURLBar.value = "";
  }

  let tab = this.selectedTab;
  if (!tab) {
    return;
  }

  var browser = gBrowser.getBrowserForTab(tab);
  var url = this.userTypedValue;
  if (!isBlankPageURL(url)) {
    browser.userTypedValue = url;
  }

  this.updateUrlBarValue();
};

Tabmix.updateUrlBarValue = function TMP_updateUrlBarValue() {
  this.selectedTab = null;
  this.userTypedValue = null;

  var url = gBrowser.currentURI.spec;
  if (url != gURLBar.value && !isBlankPageURL(url)) {
    gURLBar.setURI();
  }
};

/**
 * openUILink handles clicks on UI elements that cause URLs to load
 *
 * called from Tabmix.linkHandling_init and from text.link.xul
 */
Tabmix.openUILink_init = function TMP_openUILink_init() {
  if ("openUILink" in window) {
    if (TabmixSvc.URILoadingHelperChanged) {
      return;
    }
    TabmixSvc.URILoadingHelperChanged = true;

    /** @type {Window["URILoadingHelper"]} */
    const parentObj = window.URILoadingHelper;
    const sandbox = Tabmix.getSandbox(parentObj, {scope: {BrowserUtils}});
    // divert all the calls from places UI to use our preferences
    this.changeCode(parentObj, "openUILink", {sandbox})
      ._replace("aIgnoreAlt = params.ignoreAlt;", "aIgnoreAlt = params.ignoreAlt || null;")
      ._replace(
        /this\.openLinkIn\(.*\);/,
        `where = window.TMP_Places.openUILink(url, event, where, params);
    if (where) {
      try {
        this.openLinkIn(window, url, where, params);
      } catch (ex) {  }
    }`
      )
      ._replace(
        // fix incompatibility with Omnibar (O is not defined)
        "O.handleSearchQuery",
        "window.Omnibar.handleSearchQuery",
        {silent: true}
      )
      .toCode();
  }
};

Tabmix.checkCurrent = function TMP_checkCurrent(url) {
  var opentabforLinks = Tabmix.prefs.getIntPref("opentabforLinks");
  if (opentabforLinks == 1 || gBrowser._selectedTab.hasAttribute("locked")) {
    let isBlankTab = gBrowser.isBlankNotBusyTab(gBrowser._selectedTab);
    if (!isBlankTab) {
      return "tab";
    }
  } else if (opentabforLinks == 2) {
    // Get current page url
    let curpage = gBrowser.currentURI.spec;
    if (this.ContentClick.isLinkToExternalDomain(curpage, url)) {
      return "tab";
    }
  }
  return "current";
};

Tabmix.restoreTabState = function TMP_restoreTabState(aTab) {
  const attributes = ["protected", "_locked", "fixed-label", "label-uri", "reload-data"];
  attributes.forEach(att => {
    const value = SessionStore.getCustomTabValue(aTab, att);
    this.setItem(aTab, att, value || null);
  });

  if (aTab.hasAttribute("_locked")) {
    if (aTab.getAttribute("_locked") == "true") {
      aTab.setAttribute("locked", "true");
    } else {
      aTab.removeAttribute("locked");
    }

    aTab.linkedBrowser.tabmix_allowLoad = !aTab.hasAttribute("locked");
  }

  let pending = aTab.hasAttribute("pending");

  // this function run before tab load, so onTabReloaded will run when
  // onStateChange get STATE_STOP, unless the tab is pending
  var reloadData = aTab.getAttribute("reload-data");
  if (reloadData && !aTab.hasAttribute("_reload")) {
    this.autoReload.initTab(aTab);
    aTab.autoReloadEnabled = true;
    aTab.setAttribute("_reload", true);
    const [uri, time] = reloadData.split(" ");
    if (uri && time) {
      aTab.autoReloadURI = uri;
      aTab.autoReloadTime = Number(time);
      if (pending) {
        gBrowser.reloadTab(aTab);
      }
    } else {
      console.warn(`Invalid reloadData format: ${reloadData} for tab ${aTab.label}`);
    }
  }

  let boldChanged = {value: false};
  if (pending) {
    const url = TMP_SessionStore.getUrlFromTabState(aTab);
    if (url) {
      TMP_Places.asyncSetTabTitle(aTab, {url, initial: true}).then(tabTitleChanged => {
        if (tabTitleChanged) {
          TabmixTabbar.updateScrollStatus();
        }
      });
    }

    aTab.removeAttribute("tabmix_selectedID");
    aTab.removeAttribute("visited");
  }
  Tabmix.setTabStyle(aTab, boldChanged);
  if (aTab.hasAttribute("protected") || boldChanged.value) {
    TabmixTabbar.updateScrollStatus();
  }

  // make sure other extensions don't set minwidth maxwidth
  aTab.removeAttribute("minwidth");
  aTab.removeAttribute("maxwidth");
};

Tabmix.isPendingTab = function (aTab) {
  const pending = aTab.hasAttribute("pending") || aTab.hasAttribute("tabmix_pending");
  if (pending) {
    if (TMP_Places.restoringTabs.indexOf(aTab) > -1) {
      // don't show tab as pending when bookmarks restore_on_demand is false
      return TMP_Places.bookmarksOnDemand;
    }
    return true;
  }
  return false;
};

Tabmix.setTabStyle = function (aTab, boldChanged) {
  if (aTab.__duplicateFromWindow || aTab.tagName !== "tab") {
    return;
  }
  if (!aTab) {
    return;
  }

  let style = null;
  let isSelected = aTab.hasAttribute("visuallyselected");
  // if pending tab is blank we don't style it as unload or unread
  if (!isSelected && Tabmix.prefs.getBoolPref("unloadedTab") && this.isPendingTab(aTab)) {
    style =
      aTab.pinned || aTab.hasAttribute("visited") || TMP_SessionStore.isBlankPendingTab(aTab) ?
        "other"
      : "unloaded";
  } else if (
    !isSelected &&
    Tabmix.prefs.getBoolPref("unreadTab") &&
    !aTab.hasAttribute("visited") &&
    Boolean(aTab.linkedBrowser.browsingContext) &&
    !aTab.isEmpty
  ) {
    style = "unread";
  }

  let currentStyle = aTab.getAttribute("tabmix_tabState") || null;
  if (style != "unread" && style != "unloaded") {
    style = null;
  }

  this.setItem(aTab, "tabmix_tabState", style);

  if (!boldChanged) {
    return;
  }

  // return true if state changed
  boldChanged.value = currentStyle != style;
};

Tabmix.handleTabbarVisibility = {
  get contextMenu() {
    return Tabmix.lazyGetter(this, "contextMenu", document.getElementById("toolbar-context-menu"));
  },

  get pref() {
    return Tabmix.prefs.getBoolPref("hideTabbar.showContextMenu");
  },

  getHideTabbarMenu() {
    let hideTabbarMenu = document.getElementById("tabmix_hideTabbar_menu");
    if (!hideTabbarMenu) {
      const template = document.getElementById("tabmix_hideTabbar_menu-container");
      this.contextMenu.appendChild(template.content.cloneNode(true));
      hideTabbarMenu = document.getElementById("tabmix_hideTabbar_menu");
    }
    return {
      hideTabbarMenu,
      separator: document.getElementById("tabmix_hideTabbar_separator"),
    };
  },

  enabled: false,
  toggleEventListener(enable) {
    if (this.pref !== this.enabled) {
      if (this.enabled) {
        // remove our menu items
        const items = this.contextMenu.querySelectorAll("[tabmix_context]");
        items.forEach(item => item?.remove());
      }
      this.enabled = enable;
      const eventListener = enable ? "addEventListener" : "removeEventListener";
      this.contextMenu[eventListener]("popupshowing", this, false);
    }
  },

  handleEvent(event) {
    let methodName = `on_${event.type}`;
    if (methodName in this) {
      this[methodName](event);
    } else {
      throw new Error(`Unexpected event ${event.type}`);
    }
  },

  on_popupshowing(event) {
    if (event.target !== this.contextMenu) {
      return;
    }

    const targetElement =
      document.getElementById("toggle_PersonalToolbar") ??
      document.getElementById("toggle_toolbar-menubar") ??
      document.getElementById("viewToolbarsMenuSeparator").previousSibling;
    const target = targetElement?.nextSibling;

    if (target) {
      const {hideTabbarMenu, separator} = this.getHideTabbarMenu();
      this.contextMenu.insertBefore(separator, target);
      this.contextMenu.insertBefore(hideTabbarMenu, target);
      separator.hidden = Boolean(targetElement);
    } else {
      console.log("Tabmix: no target found to insert 'Hide the tab bar' menu");
    }
  },
};
