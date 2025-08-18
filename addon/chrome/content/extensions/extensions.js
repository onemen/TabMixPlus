// @ts-nocheck
"use strict";

/*
 * original code by onemen
 */

/*
 *
 * Fix compatibility with other extensions
 *
 */
/** @type {ExtensionsCompatibility} */
var TMP_extensionsCompatibility = {
  preInit: function TMP_EC_preInit() {
    if ("TreeStyleTabWindowHelper" in window) {
      this.treeStyleTab.preInit();
    }
  },

  onContentLoaded: function TMP_EC_onContentLoaded() {
    Tabmix.extensions = {
      treeStyleTab: false,
      tabGroupManager: false,
      verticalTabBar: false,
      ieTab2: false,
      gIeTab: false /* for ieTab and ieTab2 */,
    };

    // fix for Cluster Tabs - Cluster Tab look for TM_init
    // https://addons.mozilla.org/en-US/firefox/addon/cluster-tabs-for-firefox/
    if ("GlaxChrome" in window && typeof window.GlaxChrome == "object") {
      document.getElementById("main-window").setAttribute("gscltTMPinstalled", true);
      let func = ["_setupForOtherExtensions", "enableCustomDragDropMode"];
      let GlaxChrome = window.GlaxChrome.CLT.DragDropManager;
      func.forEach(aFn => {
        if (aFn in GlaxChrome) {
          Tabmix.changeCode(GlaxChrome, `GlaxChrome.CLT.DragDropManager.${aFn}`)
            ._replace("{", "{var TabDNDObserver = TMP_tabDNDObserver;", {
              check: GlaxChrome[aFn].toString().includes("TabDNDObserver"),
            })
            ._replace("TM_init", "Tabmix.startup", {
              check: GlaxChrome[aFn].toString().includes("TM_init"),
              flags: "g",
            })
            .toCode();
        }
      });
    }

    try {
      if ("TreeStyleTabService" in window) {
        this.treeStyleTab.onContentLoaded();
        this.treeStyleTab.installed = true;
        Tabmix.extensions.treeStyleTab = true;
        Tabmix.extensions.verticalTabBar = true;
      }
    } catch (ex) {
      Tabmix.assert(ex, this.treeStyleTab.errorMsg);
    }

    // https://addons.mozilla.org/en-US/firefox/addon/second-search/
    if ("SecondSearchBrowser" in window && SecondSearchBrowser.prototype) {
      let func = ["canOpenNewTab", "loadForSearch", "checkToDoSearch"];
      let SSB = SecondSearchBrowser.prototype;
      func.forEach(aFn => {
        if (aFn in SSB && SSB[aFn].toString().includes("TM_init")) {
          Tabmix.changeCode(SSB, `SecondSearchBrowser.prototype.${aFn}`)
            ._replace("TM_init", "Tabmix.startup")
            .toCode();
        }
      });
    }

    /*  we don't use this code - leave it here as a reminder.

    // workaround for extensions that look for updateIcon
    // Favicon Picker 2
    if (typeof (gBrowser.updateIcon) == "undefined") {
      gBrowser.updateIcon = function updateIcon (aTab) {
        var browser = gBrowser.getBrowserForTab(aTab);
        if ((browser.mIconURL || "") != aTab.getAttribute("image")) {
          if (browser.mIconURL)
            aTab.setAttribute("image", browser.mIconURL);
          else
            aTab.removeAttribute("image");
          gBrowser._tabAttrModified(aTab, ["image"]);
        }
      }
    }
    */

    /*
    // https://addons.mozilla.org/en-US/firefox/addon/tab-flick/
    if ("TabFlick" in window && typeof (TabFlick.openPanel) == "function") {
      Tabmix.changeCode(TMP_tabDNDObserver, "TMP_tabDNDObserver.onDragEnd")._replace(
        'gBrowser.replaceTabWithWindow(draggedTab);',
        'gBrowser.selectedTab = draggedTab; TabFlick.openPanel(aEvent);'
      ).toCode();
    }
    */

    // https://addons.mozilla.org/en-US/firefox/addon/bug489729-disable-detach-and-t//
    // we don't need to do any changes to bug489729 extension version 1.6+

    // https://addons.mozilla.org/en-US/firefox/addon/foxtab/
    if ("foxTab" in window) {
      let loadNewInBackground =
        '$& var loadNewInBackground = Tabmix.prefs.getBoolPref("loadNewInBackground");';
      let newCode = `if (Tabmix.prefs.getBoolPref("openNewTabNext"))
           f.gBrowser.moveTabTo(newTab, f.gBrowser.selectedTab._tPos + 1);
        if (!loadNewInBackground) {
          f.gBrowser.TMP_selectNewForegroundTab(newTab, false);
          TMP_LastTab.PushSelectedTab();
        }`;
      if (typeof foxTab.openNewTab == "function") {
        Tabmix.changeCode(foxTab, "foxTab.openNewTab")
          ._replace("{", loadNewInBackground)
          ._replace("f.isFlashOpen", "f.isFlashOpen && !loadNewInBackground")
          ._replace(
            "f.disableTabSelectedNewTab = true;",
            "f.disableTabSelectedNewTab = !loadNewInBackground;"
          )
          ._replace("f.gBrowser.selectedTab = newTab", newCode)
          ._replace(
            "f.addBrowserListener(f.gBrowser.selectedBrowser);",
            "if( !loadNewInBackground) $&"
          )
          .toCode();
      }
      if (typeof foxTab.showNewTabMessage == "function") {
        Tabmix.changeCode(foxTab, "foxTab.showNewTabMessage")
          ._replace("{", loadNewInBackground)
          ._replace("f.gBrowser.selectedTab = newTab", newCode)
          .toCode();
      }
      Tabmix.set_BrowserOpenTab();
      foxTab.defaultBrowserOpenTab = TMP_BrowserOpenTab;
    }

    // https://addons.mozilla.org/en-US/firefox/addon/ie-tab-2-ff-36/
    // for version IE Tab V2 4.12.6.1
    if (
      typeof window.IeTab2 == "function" &&
      Services.vc.compare(window.gIeTab2Version, "4.12.6.1") === 0
    ) {
      Tabmix.extensions.ieTab2 = true;
      Tabmix.changeCode(IeTab2.prototype, "IeTab2.prototype.hookCodeAll")
        ._replace(/(var )?oldAddTab/g, "Tabmix.originalFunctions.oldAddTab")
        ._replace(/(var )?oldSetTabTitle/g, "Tabmix.originalFunctions.oldSetTabTitle")
        ._replace(/(var )?oldHandleCommand/g, "Tabmix.originalFunctions.oldHandleCommand")
        ._replace(/return;\n/, "return null;\n")
        .toCode();
    }

    if (typeof window.gIeTab2 == "object") {
      Tabmix.extensions.gIeTab = {obj: "gIeTab2", folder: "ietab2"};
    } else if (typeof window.gIeTab == "object") {
      Tabmix.extensions.gIeTab = {obj: "gIeTab", folder: "ietab"};
    }
  },

  onWindowOpen: function TMP_EC_onWindowOpen() {
    this.setVerticalTabs();

    if ("openNewsfox" in window) {
      this.newsfox.init();
    }

    if ("RSSTICKER" in window) {
      this.RSSTICKER.init();
    }

    if ("PersonaController" in window && typeof window.PersonaController == "object") {
      Tabmix.changeCode(PersonaController, "PersonaController._applyPersona")
        ._replace(
          /(})(\)?)$/,
          `if (TabmixTabbar.position == 1) {
             gBrowser.tabContainer.style.backgroundImage = this._footer.style.backgroundImage;
             gBrowser.tabContainer.setAttribute("persona", persona.id);
           }
          $1$2`
        )
        .toCode();

      Tabmix.changeCode(PersonaController, "PersonaController._applyDefault")
        ._replace(
          /(})(\)?)$/,
          `if (TabmixTabbar.position == 1) {
            gBrowser.tabContainer.style.backgroundImage = "";
            gBrowser.tabContainer.removeAttribute("persona");
           }
          $1$2`
        )
        .toCode();
    }

    // Firefox sync
    // fix bug in firefox sync that add new menu item from each popupshowing
    if ("gFxWeaveGlue" in window) {
      Tabmix.changeCode(gFxWeaveGlue, "gFxWeaveGlue.handleEvent")
        ._replace(
          "else if (this.getPageIndex() == -1)",
          'else if ((event.target.id == "allTabsMenu-allTabsView" && this.getPageIndex() == -1)',
          {
            check: gFxWeaveGlue.handleEvent
              .toString()
              .includes("else if (this.getPageIndex() == -1)"),
          }
        )
        .toCode();
    }

    // linkification extension
    if ("objLinkify" in window && "ClickLink" in objLinkify) {
      Tabmix.changeCode(objLinkify, "objLinkify.ClickLink")
        ._replace("if (bOpenWindow)", "if (bOpenWindow && !Tabmix.singleWindowMode)")
        ._replace("if (bOpenTab)", "if (bOpenTab || Tabmix.whereToOpen(null).lock)")
        .toCode();
    }

    // trigger tabmix function when user change tab width with faviconize extension
    if ("faviconize" in window && "toggle" in faviconize) {
      Tabmix.changeCode(faviconize, "faviconize.toggle")
        ._replace(
          /(})(\)?)$/,
          `tab.removeAttribute("minwidth");
           tab.removeAttribute("maxwidth");
           TabmixTabbar.updateScrollStatus();
           $1$2`
        )
        .toCode();
    }

    // fix bug in superDargandGo https://addons.mozilla.org/he/firefox/addon/super-dragandgo/
    try {
      if ("superDrag" in window && "contentAreaDNDObserver" in window) {
        Tabmix.changeCode(contentAreaDNDObserver, "contentAreaDNDObserver.onDrop")
          ._replace(
            'document.firstChild.getAttribute("windowtype")',
            'window.document.documentElement.getAttribute("windowtype")'
          )
          ._replace("preventBubble()" /* fix bug in superDargandGo */, "stopPropagation()")
          .toCode();
      }
    } catch {}

    try {
      if ("TreeStyleTabService" in window) {
        this.treeStyleTab.onWindowLoaded();
      }
    } catch (ex) {
      Tabmix.assert(ex, this.treeStyleTab.errorMsg);
    }

    /* fast dial FdUtils*/
    if ("FdUtils" in window && FdUtils.whereToOpenLink) {
      Tabmix.changeCode(FdUtils, "FdUtils.whereToOpenLink")
        ._replace("if (e.ctrlKey)", "if (e.ctrlKey || Tabmix.whereToOpen(null).lock)")
        .toCode();
    }

    // for MR Tech's local install extension
    if (typeof Local_Install == "object") {
      // don't open 'Throbber' in current tab when tab is locked
      // or 'Throbber' is to different site then the current
      Tabmix.changeCode(Local_Install, "Local_Install.openThrobber")
        ._replace(
          "local_common.openURL(local_common.getThrobberURL(), inNewTab);",
          `var url = local_common.getThrobberURL();
          local_common.openURL(url, inNewTab ? inNewTab : Tabmix.checkCurrent(url) == "tab");`
        )
        .toCode();
      // add name to closeallOverlay.onUnload we use it in goQuitApplication
      if ("closeallOverlay" in window && "onUnload" in closeallOverlay) {
        Tabmix.changeCode(closeallOverlay, "closeallOverlay.onUnload")
          ._replace(/function(\s+)\(/, "function toolkitCloseallOnUnload(")
          .toCode();
      }
    }

    if ("FireGestures" in window) {
      // unable to close source tab after duplicate with FireGestures extension
      // problem fix in FireGestures 1.5.7 keep this here for users with older versions
      let performAction = FireGestures._performAction.toString();
      let codeToReplace = "gBrowser.moveTabTo(newTab, ++orgTab._tPos);";
      if (performAction.includes(codeToReplace)) {
        Tabmix.changeCode(FireGestures, "FireGestures._performAction")
          ._replace(codeToReplace, "Tabmix.moveTabTo(newTab, {tabIndex: orgTab._tPos + 1});")
          .toCode();
      }

      FireGestures.closeMultipleTabs = function (aLeftRight) {
        if (aLeftRight == "left") {
          gBrowser.removeTabsToTheStartFrom(gBrowser._selectedTab);
        } else {
          gBrowser.removeTabsToTheEndFrom(gBrowser._selectedTab);
        }
      };
    }

    // fix bug in new tab button on right extension when we use multi row
    if ("newTabButtons" in window) {
      let tabBar = gBrowser.tabContainer;
      let newbuttonRight = document.getAnonymousElementByAttribute(
        tabBar,
        "id",
        "tabs-newbutton-right"
      );
      let newbuttonEnd = document.getAnonymousElementByAttribute(
        tabBar,
        "id",
        "tabs-newbutton-end"
      );
      if (newbuttonRight && newbuttonEnd) {
        newbuttonEnd.parentNode.insertBefore(newbuttonRight, newbuttonEnd);
      }
    }

    // https://addons.mozilla.org/en-us/firefox/addon/mouse-gestures-redox/
    if ("mgBuiltInFunctions" in window) {
      Tabmix.changeCode(mgBuiltInFunctions, "mgBuiltInFunctions.mgNewBrowserWindow")
        ._replace("window.open();", "if (!Tabmix.singleWindowMode) window.open();")
        .toCode();
    }

    // override some of All-in-One Gestures function
    // override the duplicate tab function
    if (typeof aioDupTab == "function") {
      window.aioDupTab = () => Tabmix.duplicateTab(gBrowser._selectedTab);
    }

    // override the duplicate in new window function
    if (typeof aioDupWindow == "function") {
      window.aioDupWindow = () => gBrowser.duplicateTabToWindow(gBrowser._selectedTab);
    }

    // override the aioCloseWindow function
    if (typeof aioCloseWindow == "function") {
      window.aioCloseWindow = window.BrowserCommands.tryToCloseWindow;
    }
  },

  onDelayedStartup: function TMP_EC_onDelayedStartup() {
    //XXX some themes uses old tabmix_3.xml version and call _createTabsList
    // for now we don't do changes for other themes regarding scroll buttons oncontextmenu
    // with the new code in scrollbox.xml
    // this need more testing with other themes

    // check if Greasemonkey installed
    Tabmix.ContentClick.isGreasemonkeyInstalled(window);

    if (typeof MouseControl == "object" && MouseControl.newTab) {
      Tabmix.changeCode(MouseControl, "MouseControl.newTab")
        ._replace("gBrowser.moveTabTo", 'if (!Tabmix.prefs.getBoolPref("openNewTabNext")) $&')
        .toCode();
    }

    if (typeof SpeedDial == "object" && SpeedDial.originalBrowserOpenTab) {
      Tabmix.changeCode(window, "window.TMP_BrowserOpenTab")
        ._replace(
          "SpeedDial.originalBrowserOpenTab(event);",
          "SpeedDial.originalBrowserOpenTab(event, arguments.length > 1 && arguments[1]);"
        )
        .toCode();
      Tabmix.set_BrowserOpenTab();
    }

    // Redirect Remover 2.6.4
    // https://addons.mozilla.org/he/firefox/addon/redirect-remover/
    if (window.rdrb && typeof rdrb.cleanLink == "function") {
      Tabmix.changeCode(TabmixContext, "TabmixContext.openMultipleLinks")
        ._replace("let params", "url = rdrb.cleanLink(url);\n      $&")
        .toCode();
    }
  },

  setVerticalTabs() {
    // https://addons.mozilla.org/EN-US/firefox/addon/vertical-tabs/
    // https://addons.mozilla.org/en-US/firefox/addon/vertical-tabs-reloaded/
    // https://addons.mozilla.org/EN-US/firefox/addon/side-tabs/
    // https://addons.mozilla.org/en-US/firefox/addon/tabkit-2nd-edition/
    let isVertical =
      typeof VerticalTabs == "object" ||
      typeof VerticalTabsReloaded == "object" ||
      (!Tabmix.isVersion(1300) && typeof gBrowser.tabContainer._verticalTabs === "boolean") ||
      typeof sidetabs == "object" ||
      typeof tabkit == "object" ||
      typeof tabkitGlobal == "object";
    let treeStyleTab = typeof TreeStyleTabService == "object";

    // Firefox 130+ includes vertical tabs feature.
    // it can be toggle by preference sidebar.verticalTabs, we use getter
    // Tabmix.tabsUtils.isVerticalTabBar.
    Tabmix.extensions.verticalTabBar = isVertical || treeStyleTab;
    Tabmix.extensions.verticalTabs = isVertical && !treeStyleTab;
  },
};

TMP_extensionsCompatibility.RSSTICKER = {
  init() {
    Tabmix.changeCode(RSSTICKER, "RSSTICKER.writeFeed")
      ._replace(
        'tbb.setAttribute("onclick"',
        `tbb.setAttribute("onclick", "this.onClick(event);");
        tbb.setAttribute("_onclick"`
      )
      ._replace(
        "tbb.onContextOpen =",
        `tbb.onContextOpen = TMP_extensionsCompatibility.RSSTICKER.onContextOpen;
        tbb.onClick = TMP_extensionsCompatibility.RSSTICKER.onClick;
        tbb._onContextOpen =`
      )
      .toCode();
  },

  onClick(event) {
    if (event.ctrlKey) {
      this.markAsRead(true);
    } else if ((this.parent.alwaysOpenInNewTab && event.which === 1) || event.which === 2) {
      this.onContextOpen("tab");
    } else if (event.which == 1) {
      this.onContextOpen();
    }
  },

  onContextOpen(target) {
    if (!target) {
      if (Tabmix.whereToOpen(null).lock) {
        this.parent.browser.openInNewTab(this.href);
      } else {
        window.openLinkIn(this.href, "current", {allowThirdPartyFixup: false});
      }
    } else if (target == "window") {
      if (Tabmix.singleWindowMode) {
        this.parent.browser.openInNewTab(this.href);
      } else {
        window.open(this.href);
      }
    } else if (target == "tab") {
      this.parent.browser.openInNewTab(this.href);
    }

    this.markAsRead();
  },
};

// prevent Newsfox from load pages in locked tabs
TMP_extensionsCompatibility.newsfox = {
  init() {
    Tabmix.changeCode(window, "openNewsfox")
      ._replace(
        /if \(newTab\) {/,
        `newTab = newTab || Tabmix.whereToOpen(null).lock;
        $&`
      )
      .toCode();
  },
};

/*
 * fix incompatibilities with treeStyleTab
 * we get here only if "TreeStyleTabService" exist in window
 *
 *  https://addons.mozilla.org/en-US/firefox/addon/tree-style-tab/
 */
TMP_extensionsCompatibility.treeStyleTab = {
  installed: false,
  errorMsg: "Error in Tabmix when trying to load compatible functions with TreeStyleTab extension",

  preInit() {
    let tstHelper = TreeStyleTabWindowHelper;
    if (typeof tstHelper.overrideExtensionsPreInit == "function") {
      // overrideExtensionsPreInit look for 'gBrowser.restoreTab' in Tabmix.tablib.init
      Tabmix.tablib._init = Tabmix.tablib.init;
      Tabmix.tablib.init = function () {
        this._init();

        /*
          var newTab = null
          gBrowser.restoreTab = return newTab;
         */
      };
    }

    // run our initialization function before TreeStyleTab functions:
    // preInit and onBeforeBrowserInit
    if (typeof tstHelper.preInit == "function") {
      Tabmix.originalFunctions.tstHelper_preInit = tstHelper.preInit;
      tstHelper.preInit = function () {
        TMP_eventListener._onLoad("DOMContentLoaded");
        let method = Tabmix.originalFunctions.tstHelper_preInit;
        method.apply(this, arguments);
      };
    }

    if (typeof tstHelper.onBeforeBrowserInit == "function") {
      Tabmix.originalFunctions.tstHelper_onBeforeBrowserInit = tstHelper.onBeforeBrowserInit;
      tstHelper.onBeforeBrowserInit = function () {
        TMP_eventListener._onLoad("load");
        let method = Tabmix.originalFunctions.tstHelper_onBeforeBrowserInit;
        method.apply(this, arguments);
      };
    }
  },

  onContentLoaded() {
    // workaround, with version 0.15.2015061300a003855
    // gBrowser.treeStyleTab.initTabContentsOrder throw on Firefox 41+
    Tabmix.TST_initTabContentsOrder = function () {
      try {
        this.initTabContentsOrder.apply(this, arguments);
      } catch {}
    }.bind(gBrowser.treeStyleTab);

    if ("TreeStyleTabBrowser" in window) {
      // update ordinal on previous selected tab when close tab button is on the
      // left side and CloseButtons preference is 4 - close buttons on hover
      // and active tabs
      let onTabSelect = function (event) {
        let tab =
          gBrowser.tabContainer.getAttribute("closebuttons-side") == "left" &&
          gBrowser.tabContainer.mCloseButtons == 4 &&
          event.detail &&
          event.detail.previousTab;
        if (tab) {
          Tabmix.TST_initTabContentsOrder(tab);
        }
      };
      gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect, true);
      window.addEventListener(
        "unload",
        function onunload() {
          gBrowser.tabContainer.removeEventListener("TabSelect", onTabSelect, true);
        },
        {once: true}
      );
    }

    // we removed TMP_howToOpen function 2011-11-15
    if (
      "TreeStyleTabWindowHelper" in window &&
      TreeStyleTabWindowHelper.overrideExtensionsAfterBrowserInit
    ) {
      Tabmix.changeCode(
        TreeStyleTabWindowHelper,
        "TreeStyleTabWindowHelper.overrideExtensionsAfterBrowserInit",
        {silent: true}
      )
        ._replace(/eval\(["|']window\.TMP_howToOpen/, "if (false) $&")
        .toCode();
    }

    // we removed TMP_openTabNext function 2011-11-15
    if (
      "TreeStyleTabWindowHelper" in window &&
      TreeStyleTabWindowHelper.overrideExtensionsDelayed
    ) {
      Tabmix.changeCode(
        TreeStyleTabWindowHelper,
        "TreeStyleTabWindowHelper.overrideExtensionsDelayed",
        {silent: true}
      )
        ._replace("var newTab", "gContextMenu.linkURL = url;")
        ._replace(
          "TreeStyleTabService.readyToOpenChildTab(aTab)",
          "TreeStyleTabService.readyToOpenChildTab(gBrowser._selectedTab)"
        )
        ._replace(/eval\(["|']gBrowser\.TMP_openTabNext/, "if (false) $&")
        .toCode();
    }
  },

  onWindowLoaded() {
    // we don't need this hack since treestyletab version 0.16.2016021602
    if (typeof PlacesUIUtils.__treestyletab__openTabset != "function") {
      /*
       *  TST have eval to TMP_Bookmark.openGroup
       *  we replace TMP_Bookmark.openGroup with TMP_Places.openGroup at Tabmix 0.3.8.2pre.090830
       *  we also replace call to TreeStyleTabService.openGroupBookmarkBehavior();
       *  with aOpenGroupBookmarkBehavior that we pass from PlacesUIUtils._openTabset
       *  we only call this function from browserWindow so we don't need to call it for
       *  other places windows
       */
      Tabmix.changeCode(TMP_Places, "TMP_Places.openGroup")
        ._replace(
          "var openTabs = Tabmix.visibleTabs.tabs;",
          `let TSTOpenGroupBookmarkBehavior = arguments.length > 3 && arguments[3] ||
             TreeStyleTabService.openGroupBookmarkBehavior();
          $&`
        )
        ._replace(
          "index = prevTab._tPos + 1;",
          `  index = gBrowser.treeStyleTab.getNextSiblingTab(gBrowser.treeStyleTab.getRootTab(prevTab));
             if (tabToSelect == aTab) index = gBrowser.treeStyleTab.getNextSiblingTab(index);
               index = index ? index._tPos : (prevTab._tPos + 1);`
        )
        ._replace(
          "prevTab = aTab;",
          `  $&
             if (tabToSelect == aTab && TSTOpenGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE) {
               TreeStyleTabService.readyToOpenChildTab(tabToSelect, true, gBrowser.treeStyleTab.getNextSiblingTab(tabToSelect));
             }`
        )
        ._replace(
          /(})(\)?)$/,
          `  if (TSTOpenGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE)
               TreeStyleTabService.stopToOpenChildTab(tabToSelect);
          $1$2`
        )
        .toCode();
    }

    if (Services.prefs.getBoolPref("extensions.treestyletab.compatibility.TMP")) {
      // Added 2010-04-10
      // TST look for aTab.removeAttribute("tabxleft")
      Tabmix.changeCode(TabmixTabbar, "TabmixTabbar.updateSettings")
        ._replace(
          'Tabmix.setItem("main-window"[^;]*;',
          `$&
         for (const tab of tabBar.allTabs) {
           gBrowser.treeStyleTab.initTabAttributes(aTab);
           Tabmix.TST_initTabContentsOrder(aTab);'
         }`
        )
        .toCode();
      // Added 2010-04-10
      Tabmix.changeCode(TMP_eventListener, "TMP_eventListener.onTabOpen")
        ._replace(
          /(})(\)?)$/,
          `gBrowser.treeStyleTab.initTabAttributes(tab);
           Tabmix.TST_initTabContentsOrder(tab);
           $1$2`
        )
        .toCode();
      // Added 2011-11-09, i'm not sure we really need it, openMultipleLinks call openLinkIn
      Tabmix.changeCode(TabmixContext, "TabmixContext.openMultipleLinks")
        ._replace(
          "for (let [url, usercontextid] of urls) {",
          `TreeStyleTabService.readyToOpenChildTab(gBrowser, true);
         $&`
        )
        ._replace(
          "return false;",
          `TreeStyleTabService.stopToOpenChildTab(gBrowser);
         $&`
        )
        .toCode();
    }
  },

  onBeforeNewTabCommand(tab, openTabNext) {
    if (!this.installed) {
      return;
    }
    if (openTabNext) {
      this.openNewTabNext(tab, true);
    } else {
      gBrowser.treeStyleTab.onBeforeNewTabCommand();
    }
  },

  // Don't call openNewTabNext if treeStyleTab already set readiedToAttachNewTab
  checkToOpenTabNext(tab, check) {
    if (this.installed && check && !gBrowser.treeStyleTab.checkToOpenChildTab(tab)) {
      this.openNewTabNext(tab, true);
    }
  },

  getTabsAndBrowser(tab) {
    let tst = gBrowser.treeStyleTab;
    const tstOldVersion = typeof tst.getBrowserFromTabBrowserElements == "function";
    if (tstOldVersion) {
      let browser = tst.getBrowserFromTabBrowserElements(tab);
      if (!browser) {
        return {};
      }
      let ownerBrowser = tst.getTabBrowserFromChild(browser);
      let baseTab = tst.getTabFromBrowser(browser, ownerBrowser);
      let parentTab = tst.getParentTab(baseTab);
      return {ownerBrowser, baseTab, parentTab};
    }

    // code from treestyletabforpm@oinkoink version 0.0.4
    const tstNewApi = typeof tst.getFrameFromTabBrowserElements == "function";
    if (tstNewApi) {
      let frame = tst.getFrameFromTabBrowserElements(tab);
      if (!frame) {
        return {};
      }

      let ownerBrowser = tst.getTabBrowserFromFrame(frame);
      let baseTab = tst.getTabFromFrame(frame, ownerBrowser);
      let parentTab = tst.getParentTab(baseTab);
      return {ownerBrowser, baseTab, parentTab, tstNewApi};
    }
    return {};
  },

  // instruct treeStyleTab to use 'kNEWTAB_OPEN_AS_NEXT_SIBLING' when our preference
  // is to open the tab next
  openNewTabNext(tab, openTabNext, clean) {
    if (!this.installed || !openTabNext) {
      return;
    }

    let tst = gBrowser.treeStyleTab;
    const {ownerBrowser, baseTab, parentTab, tstNewApi} = this.getTabsAndBrowser(tab);

    // clean previously ready state set by treeStyleTab
    if (clean) {
      tst.stopToOpenChildTab(baseTab);
      if (parentTab) {
        tst.stopToOpenChildTab(parentTab);
      }
    }

    // based on treeStyleTab.readyToOpenNextSiblingTabNow
    // we also set ready state for pinned tabs
    let readyToOpenNextSiblingTab = function () {
      if (!baseTab) {
        return false;
      }

      let nextTab = tst.getNextSiblingTab(baseTab);
      if (parentTab) {
        const insertBefore = tstNewApi ? nextTab : {insertBefore: nextTab, insertAfter: baseTab};
        return tst.readyToOpenChildTab(parentTab, false, insertBefore);
      } else if (nextTab) {
        ownerBrowser.treeStyleTab.readiedToAttachNewTab = true;
        ownerBrowser.treeStyleTab.parentTab = null;
        ownerBrowser.treeStyleTab.insertBefore = nextTab.getAttribute(tst.kID);
        return true;
      }
      return false;
    };

    if (readyToOpenNextSiblingTab()) {
      setTimeout(() => {
        try {
          tst.stopToOpenChildTab(baseTab);
        } catch (ex) {
          if (typeof tst.defaultDeferredErrorHandler == "function") {
            tst.defaultDeferredErrorHandler(ex);
          } else {
            tst.defaultErrorHandler(ex);
          }
        }
      }, 0);
    }
  },

  getProperties(tab) {
    if (!this.installed) {
      return "";
    }

    let props =
      ("TreeStyleTabWindowHelper" in window && TreeStyleTabWindowHelper.extraProperties) || [];
    props = props
      .filter(prop => tab.hasAttribute(prop))
      .map(prop => `${prop}=${encodeURI(tab.getAttribute(prop))}`)
      .join(" ");
    return props.length ? ` ${props}` : "";
  },
};
