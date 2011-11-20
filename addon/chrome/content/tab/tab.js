// code based on Tab X 0.5 enhanced version by Morac, modified by Hemiola SUN, later CPU & onemen
var TabmixTabbar = {
  visibleRows: 1,
  _windowStyle: {exist:false, value:null},
  _heights: [],
  _rowHeight: null,
  _width: -1,
  hideMode: 0,
  SCROLL_BUTTONS_HIDDEN: 0,
  SCROLL_BUTTONS_LEFT_RIGHT: 1,
  SCROLL_BUTTONS_MULTIROW: 2,
  SCROLL_BUTTONS_RIGHT: 3,

  updateSettings: function TMP_updateSettings(start) {
    if (!gBrowser || TabmixSvc.TMPprefs.prefHasUserValue("setDefault") || gTMPprefObserver.preventUpdate == true)
      return;

    var tabBar = gBrowser.tabContainer;
    var tabStrip = tabBar.mTabstrip;
    var tabscroll = TabmixSvc.TMPprefs.getIntPref("tabBarMode");
    if (tabscroll < 0 || tabscroll > 3 ||
        (tabscroll != this.SCROLL_BUTTONS_LEFT_RIGHT && "TreeStyleTabBrowser" in window)) {
      TabmixSvc.TMPprefs.setIntPref("tabBarMode", 1);
      return;
    }
    var prevTabscroll = start ? -1 : this.scrollButtonsMode;
    this.scrollButtonsMode = tabscroll;
    this.isMultiRow = tabscroll == this.SCROLL_BUTTONS_MULTIROW;

    var currentVisible = start ? true : tabStrip.isElementVisible(gBrowser.mCurrentTab);

    if (prevTabscroll != tabscroll) {
      // update pointer to the button object that we are going to use
      let useTabmixButtons = tabscroll > this.SCROLL_BUTTONS_LEFT_RIGHT;
      let overflow = tabBar.overflow;

      // from Firefox 4.0+ on we add dynamicly scroll buttons on TabsToolbar.
      this.setScrollButtonBox(useTabmixButtons, false, true);
      if (this.isMultiRow || prevTabscroll == this.SCROLL_BUTTONS_MULTIROW) {
        // reset overflow and hide the buttons
        // vertical button will prevent us from reset the height to one row.
        // when we get overflow in the other orient then button collapsed will set to false in
        // the scrollbox event handler
        tabBar.overflow = false;
      }
      tabStrip._scrollButtonUp.collapsed = tabStrip._scrollButtonDown.collapsed = !tabBar.overflow;

      switch (tabscroll) {
        case this.SCROLL_BUTTONS_HIDDEN:
          tabBar.setAttribute("flowing", "singlebar");
          break;
        case this.SCROLL_BUTTONS_LEFT_RIGHT:
          tabBar.setAttribute("defaultScrollButtons", true);
          Tabmix.setItem("tabmixScrollBox", "defaultScrollButtons", true);
        case this.SCROLL_BUTTONS_RIGHT:
          tabBar.setAttribute("flowing", "scrollbutton");
          break;
        case this.SCROLL_BUTTONS_MULTIROW:
          tabBar.setAttribute("flowing", "multibar");
          break;
      }

      let flowing = tabBar.getAttribute("flowing");
      tabStrip.setAttribute("flowing", flowing);
      Tabmix.setItem("tabmixScrollBox", "flowing", flowing);

      if (prevTabscroll == this.SCROLL_BUTTONS_MULTIROW) {
        tabBar.updateVerticalTabStrip(true);
      }
      else if (this.isMultiRow && overflow) {
        // if we are in overflow in one line we will have more then one line
        // in multi-row. we try to prevent extra over/underflow events by setting
        // the height in front.
        tabStrip.orient = "vertical";
        if (tabBar.updateVerticalTabStrip() == "scrollbar")
          tabBar.overflow = true;
      }

      tabBar._positionPinnedTabs();
      if (tabscroll != this.SCROLL_BUTTONS_LEFT_RIGHT &&
            tabBar.hasAttribute("defaultScrollButtons")) {
        tabBar.removeAttribute("defaultScrollButtons");
        Tabmix.setItem("tabmixScrollBox", "defaultScrollButtons", null);
      }
    }

    this.widthFitTitle = TabmixSvc.TMPprefs.getBoolPref("flexTabs") &&
                    (tabBar.mTabMaxWidth != tabBar.mTabMinWidth);
    if (!Tabmix.extensions.treeStyleTab) {
      if (start) {
        // Don't change tabstip orient on start before sessionStore ends.
        // if we set orient to vertical before sessionStore finish
        // sessionStore don't select the selected tab from last session.
        setTimeout(function() {tabBar.setTabStripOrient();}, 0);
      }
      else
        tabBar.setTabStripOrient();
    }
    Tabmix.setItem(tabBar, "widthFitTitle", this.widthFitTitle || null);

    if (TabmixSvc.prefs.getIntPref("extensions.tabmix.tabs.closeButtons") == 5 && this.widthFitTitle)
      TabmixSvc.prefs.setIntPref("extensions.tabmix.tabs.closeButtons", 1);

    // fix bug in positioning the popup off screen or on the button when window is not maximize or when tab bar is in the bottom
    Tabmix.setItem("alltabs-popup", "position",
           (window.windowState != window.STATE_MAXIMIZED || this.position == 1) ? "start_before" : "after_end");

    // for light weight themes
    Tabmix.setItem("main-window", "tabmix_lwt", this.isMultiRow || this.position == 1 || null);

    for (let i = 0; i < tabBar.childNodes.length; i++) {
      let aTab = tabBar.childNodes[i];
      // treeStyleTab code come after SessionManager... look in extensions.js
      TabmixSessionManager.updateTabProp(aTab);
    }

    if (tabBar.mCloseButtons == 5)
      tabBar.adjustTabstrip(true);

    // show on tabbar
    var showNewTabButton = TabmixSvc.TMPprefs.getBoolPref("newTabButton");
    let toolBar = gBrowser.tabContainer._container;
    let tabstripClosebutton = document.getElementById("tabs-closebutton");
    if (tabstripClosebutton && tabstripClosebutton.parentNode == toolBar)
      tabstripClosebutton.collapsed = TabmixSvc.TMPprefs.getBoolPref("hideTabBarButton");
    let allTabsButton = document.getElementById("alltabs-button");
    if (allTabsButton && allTabsButton.parentNode == toolBar)
      allTabsButton.collapsed = TabmixSvc.TMPprefs.getBoolPref("hideAllTabsButton");

    let newTabButton = document.getElementById("new-tab-button");
    showNewTabButton =  showNewTabButton && newTabButton && newTabButton.parentNode == toolBar;
    Tabmix.setItem("TabsToolbar", "newTabButton", showNewTabButton || false);
    Tabmix.setItem(tabBar, "tabBarSpace", TabmixSvc.TMPprefs.getBoolPref("tabBarSpace") || null);
    tabBar._checkNewtabButtonvisibility = this.isMultiRow && showNewTabButton && TabmixSvc.TMPprefs.getIntPref("newTabButton.position") == 2;

    var self = this;
    if (start)
      window.setTimeout(function TMP_updateSettings_onstart() {self.updateScrollStatus();}, 0);
    else
      this.updateScrollStatus();

    window.setTimeout( function TMP_updateSettings_adjustScroll(_currentVisible) {
        if (_currentVisible)
          tabBar.mTabstrip.ensureElementIsVisible(gBrowser.selectedTab);
        self.updateBeforeAndAfter();
    }, 50, currentVisible);
  },

  setScrollButtonBox: function TMP_setScrollButtonBox(useTabmixButtons, insertAfterTabs, update) {
    let newBox, box = document.getElementById("tabmixScrollBox");
    if (useTabmixButtons && !box) {
      newBox = true;
      box = document.createElement("box");
      box.setAttribute("class", "tabbrowser-arrowscrollbox tabmix_scrollbuttons_box");
      box.setAttribute("type", "tabmix-box");
      box.setAttribute("id", "tabmixScrollBox");
    }

    let tabStrip  = gBrowser.tabContainer.mTabstrip;
    if (newBox || (useTabmixButtons && insertAfterTabs)) {
      document.getElementById("TabsToolbar").insertBefore(box, gBrowser.tabContainer.nextSibling);
      tabStrip._scrollButtonDownRight = box._scrollButtonDown;
      tabStrip._scrollButtonUpRight = box._scrollButtonUp;
    }
    if (update) {
      tabStrip._scrollButtonDown = !useTabmixButtons ?
          tabStrip._scrollButtonDownLeft : tabStrip._scrollButtonDownRight;
      gBrowser.tabContainer._animateElement = tabStrip._scrollButtonDown;

      tabStrip._scrollButtonUp = !useTabmixButtons ?
          tabStrip._scrollButtonUpLeft : tabStrip._scrollButtonUpRight;
      tabStrip._updateScrollButtonsDisabledState();
    }
  },

  updateScrollStatus: function TMP_updateScrollStatus() {
    var tabBar = gBrowser.tabContainer;
    if (this.isMultiRow && tabBar.mTabstrip.orient == "vertical") {
      if (tabBar.hasAttribute("multibar") &&
          tabBar._lastTabRowNumber < TabmixTabbar.visibleRows)
        tabBar._positionPinnedOnMultiRow();
      tabBar.updateVerticalTabStrip();
    }
    else
      tabBar.adjustNewtabButtonvisibility();
  },

  // in Firefox 4.0+ rowheight can change when TabsInTitlebar or TabsOnTop
  _tabsPosition: "tabsonbottom",
  getTabsPosition: function TMP_getTabsPosition() {
    let tabsPosition, docElement = document.documentElement;
    if (docElement.getAttribute("tabsintitlebar") == "true")
      tabsPosition = "tabsintitlebar";
    else if (docElement.getAttribute("tabsontop") == "true")
      tabsPosition = "tabsontop";
    else
      tabsPosition = "tabsonbottom";
    return tabsPosition;
  },

  get singleRowHeight() {
    let heights = this._heights[this._tabsPosition];
    if (typeof(heights) == "undefined")
      return gBrowser.tabContainer.tabstripInnerbox.getBoundingClientRect().height;
    return heights[2] / 2;
  },

  setHeight: function TMP_setHeight(aRows, aReset) {
    var tabsPosition = this.getTabsPosition();

    // need to reset height
    if (this._tabsPosition != tabsPosition) {
      aReset = true;
    }

    if (!aReset && this.visibleRows == aRows)
      return;

    this.visibleRows = aRows;
    this._tabsPosition = tabsPosition;
    var tabBar = gBrowser.tabContainer;
    var tabstrip = tabBar.mTabstrip._scrollbox;

    if (aRows == 1 || aReset)
      this.resetHeight();
    if (aRows == 1) {
      Tabmix.setItem(tabBar, "multibar", null);
      Tabmix.setItem("TabsToolbar", "multibar", null);
      tabBar.overflow = false;
      return;
    }

    var newHeight, fillRowsHeights;
    if (typeof(this._heights[tabsPosition]) == "undefined") {
      this._heights[tabsPosition] = { };
      fillRowsHeights = true;
    }
    if (aRows in this._heights[tabsPosition])
      newHeight = this._heights[tabsPosition][aRows];
    else {
      if (tabBar.tabstripInnerbox) {
        let height = tabBar.tabstripInnerbox.getBoundingClientRect().height;
        if (tabBar.getAttribute("multibar") == "scrollbar") {
          // We can get here if we switch to diffrent tabs position while in multibar
          let rowHeight = height/tabBar.lastTabRowNumber;
          newHeight = rowHeight * aRows;
        }
        else
          newHeight = height;
      }
      else
        newHeight = this.getRowHeight(tabsPosition) * aRows;

      this._heights[tabsPosition][aRows] = newHeight;
      if (fillRowsHeights || (aRows > 2 && typeof(this._heights[tabsPosition][aRows-1]) == "undefined")) {
        rowHeight = newHeight / aRows;
        for (let row = 2; row < aRows; row++)
          this._heights[tabsPosition][row] = rowHeight * row;
      }
    }

    if (tabstrip.style.maxHeight != tabstrip.style.height || tabstrip.style.maxHeight != newHeight + "px")
      this.setHeightByPixels(newHeight);
  },

  setHeightByPixels: function TMP_setHeightByPixels(newHeight) {
    var tabBar = gBrowser.tabContainer;
    var tabstrip = tabBar.mTabstrip._scrollbox;
    tabstrip.style.setProperty("max-height",newHeight + "px", "important");
    tabstrip.style.setProperty("height",newHeight + "px", "important");
    let tabsBottom = document.getAnonymousElementByAttribute(tabBar, "class", "tabs-bottom");
    let tabsBottomHeight = tabsBottom && tabBar.getAttribute("classic") != "v3Linux" ? tabsBottom.boxObject.height : 0;
    let newTabbarHeight = newHeight + tabsBottomHeight;
    if (Tabmix.isMac) {
      document.getElementById("TabsToolbar").style.setProperty("height",newTabbarHeight + "px", "important");
    }
    // override fixed height set by theme to .tabbrowser-tabs class
    if (tabBar.boxObject.height < newTabbarHeight || tabBar.style.getPropertyValue("height")) {
      tabBar.style.setProperty("max-height",newTabbarHeight + "px", "important");
      tabBar.style.setProperty("height",newTabbarHeight + "px", "important");
    }
    let tabsToolbar = document.getElementById("TabsToolbar");
    if (tabsToolbar.boxObject.height < newTabbarHeight || tabsToolbar.style.getPropertyValue("height")) {
      tabsToolbar.style.setProperty("max-height",newTabbarHeight + "px", "important");
      tabsToolbar.style.setProperty("height",newTabbarHeight + "px", "important");
    }

    // experimental - for theme that put tababr above the menus
    // curently its only work with Vfox3 theme
    if (tabstrip.boxObject.y <= gNavToolbox.boxObject.y) {
      let skin = TabmixSvc.prefs.getCharPref("general.skins.selectedSkin");
      let themes = /^(Vfox3)/;
      if (themes.test(skin)) {
        let mWin = document.getElementById("main-window");
        if (!this._windowStyle.exist) {
          this._windowStyle.exist = true;
          this._windowStyle.value = mWin.hasAttribute("style") ? mWin.getAttribute("style") : null;
        }
        mWin.style.setProperty("padding-top", newTabbarHeight + "px", "important");
      }
    }
  },

  resetHeight: function TMP_resetHeight() {
    var tabBar = gBrowser.tabContainer;
    var tabstrip = tabBar.mTabstrip._scrollbox;
    let tabsToolbar = document.getElementById("TabsToolbar");
    if (tabsToolbar.hasAttribute("style")) {
      tabsToolbar.style.removeProperty("max-height");
      tabsToolbar.style.removeProperty("height");
    }
    if (tabstrip.hasAttribute("style")) {
      tabstrip.style.removeProperty("max-height");
      tabstrip.style.removeProperty("height");
    }
    if (tabBar.hasAttribute("style")) {
      tabBar.style.removeProperty("max-height");
      tabBar.style.removeProperty("height");
    }
    if (this._windowStyle.exist)
      Tabmix.setItem(document.getElementById("main-window"), "style", this._windowStyle.value);
    if (Tabmix.isMac) {
      document.getElementById("TabsToolbar").style.removeProperty("height");
    }
  },

  // Update beforeselected and afterselected attribute when we are in multi-row mode
  updateBeforeAndAfter: function TMP_updateBeforeAndAfter() {
    var tabBar = gBrowser.tabContainer;
    if (!tabBar.hasAttribute("multibar"))
       return;

    var top = tabBar.topTabY;
    var tab = tabBar.selectedItem, tabRow = tabBar.getTabRowNumber(tab, top);
    var prev = TMP_TabView.previousVisibleSibling(tab), next = TMP_TabView.nextVisibleSibling(tab);
    if (prev && prev.localName == "tab") {
      Tabmix.setItem(prev, "beforeselected", tabRow == tabBar.getTabRowNumber(prev, top) ? true : null);
    }
    if (next && next.localName == "tab") {
      Tabmix.setItem(next, "afterselected", tabRow == tabBar.getTabRowNumber(next, top) ? true : null);
    }
  },

  getRowHeight: function TMP_getRowHeight(tabsPosition) {
    if (this._rowHeight && this._rowHeight[tabsPosition])
      return this._rowHeight[tabsPosition];

    var tabBar = gBrowser.tabContainer;
    var tabs = gBrowser.visibleTabs;

    var firstTab = tabs[0];
    var lastTab = tabBar.visibleTabsLastChild;
    var top = tabBar.topTabY;
    var lastTabRow = tabBar.lastTabRowNumber;
    if (lastTabRow == 1) { // one row
      if (firstTab.getAttribute("selected") == "true")
        return lastTab.boxObject.height;
      else
        return firstTab.boxObject.height;
    }
    else if (lastTabRow == 2) { // multi-row
      let newRowHeight;
      if (lastTab.getAttribute("selected") == "true") {
        // check if previous to last tab in the 1st row
        // this happen when the selected tab is the first tab in the 2nd row
        var prev = TMP_TabView.previousVisibleSibling(lastTab);
        if (prev && tabBar.getTabRowNumber(prev, top) == 1)
          return lastTab.boxObject.height;
        else
          newRowHeight = prev.baseY - firstTab.baseY;
      }
      else if (firstTab.getAttribute("selected") == "true") {
        // check if 2nd visible tab is in the 2nd row
        // (not likely that user set tab width to more then half screen width)
        var next = TMP_TabView.nextVisibleSibling(firstTab);
        if (next && tabBar.getTabRowNumber(next, top) == 2)
          return lastTab.boxObject.height;
        else
          newRowHeight = lastTab.baseY - next.baseY;
      }
      else
        newRowHeight = lastTab.baseY - firstTab.baseY;

      this._rowHeight[tabsPosition] = newRowHeight;
      return newRowHeight;
    }

    // Just in case we missed something in the above code............
    var i, j;
    i = j = tabs[0]._tPos;
    if ( tabs[j] && tabs[j].getAttribute("selected") == "true" )
      j++;
    while (this.inSameRow(tabs.item(i), tabs.item(j)))
      i++;

    if ( !tabs[i] ) // only one row
      if ( tabs[j] )
        return tabs[j].boxObject.height;
      else
        return tabs[0].boxObject.height;

    if ( tabs[i].getAttribute("selected") == "true" )
      i++;
    if ( !tabs[i] )
      return tabs[i-1].boxObject.height;

    this._rowHeight[tabsPosition] = tabs[i].baseY - tabs[j].baseY;
    return this._rowHeight[tabsPosition];
  },

  inSameRow: function TMP_inSameRow(tab1, tab2) {
    if ( !tab1 || !tab2 )
      return false;

    var tabBar = gBrowser.tabContainer;
    var top = tabBar.topTabY;
    return tabBar.getTabRowNumber(tab1, top) == tabBar.getTabRowNumber(tab2, top);
  }

} // TabmixTabbar end

// Function to catch changes to Tab Mix preferences and update existing windows and tabs
//
var gTMPprefObserver = {
  init: function() {
    var pref = "setDefault"
    if (TabmixSvc.TMPprefs.prefHasUserValue(pref))
      TabmixSvc.TMPprefs.clearUserPref(pref)
    pref = "PrefObserver.error";
    if (TabmixSvc.TMPprefs.prefHasUserValue(pref))
      TabmixSvc.TMPprefs.clearUserPref(pref)

    if ("TreeStyleTabBrowser" in window)
      this.OBSERVING.push("extensions.treestyletab.tabbar.position");

    try {
      // add Observer
      for (var i = 0; i < this.OBSERVING.length; ++i)
        TabmixSvc.prefs.addObserver(this.OBSERVING[i], this, false);
    }
    catch(e) {
      Tabmix.log("prefs-Observer failed to attach:" + "\n" + e);
      TabmixSvc.TMPprefs.setBoolPref(pref, true);
    }
  },

  OBSERVING: ["extensions.tabmix.",
              "browser.tabs.closeButtons",
              "browser.tabs.autoHide",
              "browser.tabs.tabMinWidth",
              "browser.tabs.tabMaxWidth",
              "browser.tabs.tabClipWidth",
              "browser.sessionstore.max_tabs_undo",
              "browser.warnOnRestart",
              "browser.warnOnQuit",
              "browser.sessionstore.resume_from_crash",
              "browser.startup.page",
              "browser.link.open_newwindow.override.external",
              "browser.link.open_newwindow.restriction",
              "browser.link.open_newwindow",
              "browser.ctrlTab.previews"],

  // removes the observer-object from service -- called when the window is no longer open
  removeObservers: function() {
    let prefSvc = TabmixSvc.prefs;
    for (var i = 0; i < this.OBSERVING.length; ++i)
      prefSvc.removeObserver(this.OBSERVING[i], this);
  },

 /**
  * Observer-function
  * subject: [wrapped nsISupports :: nsIPrefBranch], nsIPrefBranch Internal
  * topic: "changed"
  */
  observe: function TMP_pref_observer(subject, topic, prefName) {
    // if we don't have a valid window (closed)
    if ( !(typeof(document) == 'object' && document) ) {
      this.removeObservers(); // remove the observer..
      return;  // ..and don't continue
    }

    var prefValue, value;
    switch (prefName) {
      case "extensions.tabmix.linkTarget":

      case "extensions.tabmix.opentabfor.bookmarks":
      case "extensions.tabmix.opentabfor.history":
      case "extensions.tabmix.opentabfor.urlbar":
      case "extensions.tabmix.middlecurrent":
      case "extensions.tabmix.inversefocusLinks":
      case "extensions.tabmix.inversefocusOther":

      case "extensions.tabmix.loadNewInBackground":
      case "extensions.tabmix.loadUrlInBackground":
      case "extensions.tabmix.loadSearchInBackground":
      case "extensions.tabmix.loadDuplicateInBackground":
      case "extensions.tabmix.loadBookmarksGroupInBackground":

      case "extensions.tabmix.filetype":
      case "extensions.tabmix.warnAboutClosingTabs.timeout":
      case "extensions.tabmix.sessions.crashed":
      case "extensions.tabmix.disableIncompatible":

      case "extensions.tabmix.appearance_tab":
      case "extensions.tabmix.selected_tab":
      case "extensions.tabmix.selected_sub_tab1":
      case "extensions.tabmix.selected_sub_tab2":
      case "extensions.tabmix.selected_sub_tab3":
      case "extensions.tabmix.selected_sub_tab4":
      case "extensions.tabmix.selected_sub_tab5":
      case "extensions.tabmix.selected_sub_tab6":

      case "extensions.tabmix.reload_time":
      case "extensions.tabmix.custom_reload_time":
      case "extensions.tabmix.resume_session_once":
      case "extensions.tabmix.tabs.closeButtons.delay":
        break;
      case "extensions.tabmix.dblClickTabbar_changesize":
        document.getElementById("TabsToolbar")._dragBindingAlive = TabmixSvc.prefs.getBoolPref(prefName);
        break;
      case "extensions.tabmix.lockallTabs":
        TabmixTabbar.lockallTabs = TabmixSvc.prefs.getBoolPref(prefName);
        for (let i = 0; i < gBrowser.tabs.length; i++) {
          let tab = gBrowser.tabs[i];
          // when user change settings to lock all tabs we always lock all tabs
          // regardless if they were lock and unlocked before by the user
          if (TabmixTabbar.lockallTabs) {
            tab.setAttribute("locked", "true");
            tab.removeAttribute("_locked");
          }
          // don't unlock pinned tab if lockAppTabs is true
          else if (!tab.hasAttribute("pinned") || !TabmixSvc.TMPprefs.getBoolPref("lockAppTabs")) {
            tab.removeAttribute("locked");
            tab.removeAttribute("_locked");
          }
        }
        break;
      case "extensions.tabmix.extraIcons.autoreload":
        Tabmix.setItem(gBrowser.tabContainer, "extraIcons-autoreload", TabmixSvc.prefs.getBoolPref(prefName) || null);
        break;
      case "extensions.tabmix.extraIcons.protected":
        Tabmix.setItem(gBrowser.tabContainer, "extraIcons-protected", TabmixSvc.prefs.getBoolPref(prefName) || null);
        break;
      case "extensions.tabmix.extraIcons.locked":
        Tabmix.setItem(gBrowser.tabContainer, "extraIcons-locked", TabmixSvc.prefs.getBoolPref(prefName) || null);
        break;
      case "extensions.tabmix.dblClickTab":
      case "extensions.tabmix.middleClickTab":
      case "extensions.tabmix.ctrlClickTab":
      case "extensions.tabmix.shiftClickTab":
      case "extensions.tabmix.altClickTab":
      case "extensions.tabmix.dblClickTabbar":
      case "extensions.tabmix.middleClickTabbar":
      case "extensions.tabmix.ctrlClickTabbar":
      case "extensions.tabmix.shiftClickTabbar":
      case "extensions.tabmix.altClickTabbar":
        this.blockTabClickingOptions(prefName);
        break;
      case "extensions.tabmix.undoCloseButton.menuonly":
        TMP_ClosedTabs.setButtonType(TabmixSvc.prefs.getBoolPref(prefName));
        break;
      case "extensions.tabmix.focusTab":
          TabmixSvc.prefs.setBoolPref("browser.tabs.selectOwnerOnClose", TabmixSvc.prefs.getIntPref(prefName) == 2);
        break;
      case "extensions.tabmix.disableF9Key":
        this.toggleKey("key_tm_toggleFLST", prefName);
        break;
      case "extensions.tabmix.disableF8Key":
        this.toggleKey("key_tm_slideShow", prefName);
        break;
      case "extensions.tabmix.hideIcons":
        this.setMenuIcons();
        break;
      // tab appearnce
      case "extensions.tabmix.currentTab":
      case "extensions.tabmix.unreadTab":
      case "extensions.tabmix.otherTab":
        this.toggleTabStyles(prefName);
        break;
      case "extensions.tabmix.styles.currentTab":
      case "extensions.tabmix.styles.unreadTab":
      case "extensions.tabmix.styles.otherTab":
      case "extensions.tabmix.styles.progressMeter":
        this.setTabStyles(prefName);
        break;
      case "extensions.tabmix.progressMeter":
        this.setProgressMeter();
        break;
      case "browser.tabs.tabMaxWidth":
      case "browser.tabs.tabMinWidth":
        let tabMaxWidth = Math.max(16, TabmixSvc.prefs.getIntPref("browser.tabs.tabMaxWidth"));
        let tabMinWidth = Math.max(16, TabmixSvc.prefs.getIntPref("browser.tabs.tabMinWidth"));
        if (tabMaxWidth < tabMinWidth) {
          if (prefName == "browser.tabs.tabMaxWidth")
            tabMaxWidth = tabMinWidth;
          else
            tabMinWidth = tabMaxWidth;
        }

        gBrowser.tabContainer.mTabMaxWidth = tabMaxWidth;
        gBrowser.tabContainer.mTabMinWidth = tabMinWidth;
        let [rule, val] = prefName == "browser.tabs.tabMaxWidth" ? ["max-width", tabMaxWidth] : ["min-width", tabMinWidth];
        this.dynamicRules["width"].style.setProperty(rule, val + "px", null);
        let skin = TabmixSvc.prefs.getCharPref("general.skins.selectedSkin");
        if (skin != "classic/1.0") {
          let important = skin == "classiccompact" ? "important" : null;
          this.dynamicRules["width1"].style.setProperty(rule, val + "px", important);
        }
        TabmixTabbar.updateSettings(false);
        window.setTimeout(function TMP_tabWidthCahnged() {TabmixTabbar.updateScrollStatus();}, 50);
        window.setTimeout(function TMP_tabWidthCahnged() {TabmixTabbar.updateScrollStatus();}, 100);
        window.setTimeout(function TMP_tabWidthCahnged() {TabmixTabbar.updateScrollStatus();}, 250);
        window.setTimeout(function TMP_tabWidthCahnged() {TabmixTabbar.updateScrollStatus();}, 500);
        break;
      case "browser.tabs.tabClipWidth":
        gBrowser.tabContainer.mTabClipWidth = TabmixSvc.prefs.getIntPref(prefName);
        gBrowser.tabContainer.adjustTabstrip();
        break;
      case "extensions.tabmix.keepLastTab":
        gBrowser.tabContainer._keepLastTab = TabmixSvc.prefs.getBoolPref(prefName);
        gBrowser.tabContainer.adjustTabstrip();
        break;
      case "browser.tabs.closeButtons":
        value = TabmixSvc.prefs.getIntPref(prefName);
        switch (value) {
          case 0: // Display a close button on the active tab only
            TabmixSvc.prefs.setIntPref("extensions.tabmix.tabs.closeButtons", 3);
            break;
          case 1: // Display close buttons on all tabs (Default)
            TabmixSvc.prefs.setIntPref("extensions.tabmix.tabs.closeButtons", 1);
            break;
          case 2: // Don’t display any close buttons
            break;
          case 3: // Display a single close button at the end of the tab strip
            break;
          default: // invalid value.... don't do anything
            return;
        }
        // show/hide close button on tabs
        TabmixSvc.prefs.setBoolPref("extensions.tabmix.tabs.closeButtons.enable", value < 2);
        // show/hide close button on the tabbar
        TabmixSvc.prefs.setBoolPref("extensions.tabmix.hideTabBarButton", value != 3);
        break;
      case "extensions.tabmix.tabs.closeButtons":
        value = TabmixSvc.prefs.getIntPref(prefName);
        if (value < 1 || value > 5) {
          TabmixSvc.prefs.setIntPref(prefName, 1);
        }
        else if (value == 5 && TabmixTabbar.widthFitTitle)
          TabmixSvc.prefs.setIntPref(prefName, 1);
        else {
          gBrowser.tabContainer.mCloseButtons = TabmixSvc.prefs.getIntPref(prefName);
          gBrowser.tabContainer.adjustTabstrip();
        }
        break;
      case "extensions.tabmix.tabs.closeButtons.onLeft":
        gBrowser.tabContainer.setAttribute("closebuttons-side", TabmixSvc.prefs.getBoolPref(prefName) ? "left" : "right");
        break;
      case "extensions.tabmix.tabs.closeButtons.enable":
        gBrowser.tabContainer.closeButtonsEnabled = TabmixSvc.prefs.getBoolPref(prefName);
        gBrowser.tabContainer.adjustTabstrip();
        break;
      case "extensions.tabmix.tabBarPosition":
         if (this.tabBarPositionChanged(TabmixSvc.prefs.getIntPref(prefName))) {
           if (window.fullScreen)
             TMP_eventListener.onFullScreen(true);
           TabmixTabbar.updateSettings(false);
         }
        break;
      case "extensions.tabmix.undoClose":
        if (!TabmixSvc.TMPprefs.getBoolPref("undoClose")) {
          TabmixSvc.prefs.setIntPref("browser.sessionstore.max_tabs_undo", 0);
        }
        else if (TabmixSvc.prefs.getIntPref("browser.sessionstore.max_tabs_undo") == 0)
          TabmixSvc.prefs.clearUserPref("browser.sessionstore.max_tabs_undo");
        break;
      case "browser.sessionstore.max_tabs_undo":
        // Firefox's sessionStore mainain the right amount
        prefValue = TabmixSvc.prefs.getIntPref(prefName);
        if (TabmixSvc.TMPprefs.getBoolPref("undoClose") != (prefValue > 0))
          TabmixSvc.TMPprefs.setBoolPref("undoClose", prefValue > 0);
        TMP_ClosedTabs.setButtonDisableState();
        break;
      case "browser.warnOnRestart":
      case "browser.warnOnQuit":
      case "browser.sessionstore.resume_from_crash":
        if (!TabmixSvc.prefs.getBoolPref(prefName))
          return;

        var TMP_sessionManager_enabled = TabmixSvc.TMPprefs.getBoolPref("sessions.manager") ||
                         TabmixSvc.TMPprefs.getBoolPref("sessions.crashRecovery");
        if (TMP_sessionManager_enabled)
          TabmixSvc.prefs.setBoolPref(prefName, false);
        break;
      case "browser.startup.page":
        if (TabmixSvc.prefs.getIntPref(prefName) != 3)
          return;
        TMP_sessionManager_enabled = TabmixSvc.TMPprefs.getBoolPref("sessions.manager") ||
                         TabmixSvc.TMPprefs.getBoolPref("sessions.crashRecovery");

        if (TMP_sessionManager_enabled)
          TabmixSvc.prefs.setIntPref(prefName, 1);
        break;
      case "extensions.tabmix.sessions.manager":
      case "extensions.tabmix.sessions.crashRecovery":
        TMP_SessionStore.setService(2, false);
      case "extensions.tabmix.sessions.save.closedtabs":
      case "extensions.tabmix.sessions.save.history":
      case "extensions.tabmix.sessionToolsMenu":
      case "extensions.tabmix.closedWinToolsMenu":
        TabmixSessionManager.updateSettings();
        break;
      case "extensions.tabmix.optionsToolMenu":
        document.getElementById("tabmix-menu").hidden = !TabmixSvc.prefs.getBoolPref(prefName);
        break;
      case "browser.link.open_newwindow.override.external":
      case "browser.link.open_newwindow.restriction":
      case "browser.link.open_newwindow":
        this.setLink_openPrefs();
        break;
      case "extensions.tabmix.singleWindow":
        this.setSingleWindowUI();
        break;
      case "extensions.tabmix.hideTabbar":
        this.setAutoHidePref();
        this.setTabBarVisibility(false);
        break;
      case "browser.tabs.autoHide":
        this.setAutoHidePref();
        break;
      case "extensions.tabmix.newTabButton.position":
        this.changeNewTabButtonSide(TabmixSvc.prefs.getIntPref(prefName));
        break;
      case "browser.ctrlTab.previews":
      case "extensions.tabmix.lasttab.tabPreviews":
      case "extensions.tabmix.lasttab.favorLeftToRightOrdering":
      case "extensions.tabmix.lasttab.respondToMouseInTabList":
      case "extensions.tabmix.lasttab.showTabList":
        TMP_LastTab.ReadPreferences();
        break;
      case "extensions.treestyletab.tabbar.position":
        TMP_tabDNDObserver.setDragEvents(false);
        break;
      case "extensions.tabmix.reloadEvery.onReloadButton":
        this.showReloadEveryOnReloadButton();
        break;
      case "extensions.tabmix.tabBarMaxRow":
          var tabBar = gBrowser.tabContainer;
          let row = tabBar.maxRow;
          if (row < 2) {
            TabmixSvc.prefs.setIntPref("extensions.tabmix.tabBarMaxRow", 2);
            return;
          }
          // maxRow changed
          if (TabmixTabbar.isMultiRow) {
            // we hide the button to see if tabs have rome without the scroll buttons
            if (tabBar.overflow && row > TabmixTabbar.visibleRows)
              tabBar.overflow = false;
            // after we update the height check if we are still in overflow
            if (tabBar.updateVerticalTabStrip() == "scrollbar")
              tabBar.overflow = true;
          }
          TabmixTabbar.updateBeforeAndAfter();
        break;
      default:
        TabmixTabbar.updateSettings(false);
    }

  },

  toggleKey: function(keiID, prefName) {
    var key = document.getElementById(keiID);
    if (Tabmix.getBoolPref(prefName, false)) {
      if (key.hasAttribute("oncommand"))
        key.removeAttribute("oncommand");
    } else
      key.setAttribute("oncommand", key.getAttribute("TM_oncommand"));
  },

  getStyleSheets: function TMP_PO_getStyleSheet(aHerf, aFirst) {
    var styleSheet = [];
    for (let i = 0; i < document.styleSheets.length; ++i) {
      if (document.styleSheets[i].href == aHerf) {
        styleSheet.push(document.styleSheets[i]);
        if (aFirst)
          break;
      }
    }
    return styleSheet;
  },

  dynamicRules: {},
  createColorRules: function TMP_PO_createColorRules() {
    // find tab.css to insert our color rules into it.
    // insert our rules into document.styleSheets[0] cause problem with other extensions
    var ss = this.getStyleSheets("chrome://tabmixplus/skin/tab.css", true)[0];
    if (!ss)
      ss = document.styleSheets[document.styleSheets.length-1];

    this.tabStyleSheet = ss;

    var backgroundRule;
    this.gradients = { };
    this.gradients.body = "-moz-linear-gradient(#colorCode, #colorCode)";
    let bottomBorder = "-moz-linear-gradient(bottom, rgba(10%,10%,10%,.4) 1px, transparent 1px)";
    this.gradients.tab = Tabmix.isMac ? this.gradients.body : (bottomBorder + "," + this.gradients.body);
    backgroundRule = "{-moz-appearance: none; background-image: " + this.gradients.tab + " !important;}"

    var styleRules = {
      currentTab:    { text:  '.tabbrowser-tabs[useCurrentColor] .tabbrowser-tab[selected="true"] .tab-text { color: #colorCode;}',
                       bg  :  '.tabbrowser-tabs[useCurrentBGColor] .tabbrowser-tab[selected="true"],'+
                              '.tabbrowser-tabs[useCurrentBGColor][tabonbottom] .tabs-bottom' + backgroundRule},
      unreadTab:     { text:  '.tabbrowser-tabs[useUnreadColor] .tabbrowser-tab:not([selected="true"]):not([visited]) .tab-text { color: #colorCode;}',
                       bg:    '.tabbrowser-tabs[useUnreadBGColor] .tabbrowser-tab:not([selected="true"]):not([visited])' + backgroundRule},
      otherTab:      { text:  '.tabbrowser-tabs[useOtherColor]:not([unreadTab]) .tabbrowser-tab:not([selected="true"]) .tab-text,' +
                              '.tabbrowser-tabs[useOtherColor][unreadTab] .tabbrowser-tab:not([selected="true"])[visited] .tab-text { color: #colorCode;}',
                       bg:    '.tabbrowser-tabs[useOtherBGColor]:not([unreadTab]) .tabbrowser-tab:not([selected="true"]),' +
                              '.tabbrowser-tabs[useOtherBGColor][unreadTab] .tabbrowser-tab:not([selected="true"])[visited]' + backgroundRule},
      progressMeter: { bg:    '.tabbrowser-tabs[useProgressColor] .tabbrowser-tab .progress-bar {background-color: #colorCode !important;}'}
    }

    if (Tabmix.isMac) {
      styleRules.currentTab.bg =
        '.tabbrowser-tabs[useCurrentBGColor] .tab-background-start[selected="true"],' +
        '.tabbrowser-tabs[useCurrentBGColor] .tab-background-middle[selected="true"],' +
        '.tabbrowser-tabs[useCurrentBGColor] .tab-background-end[selected="true"]' + backgroundRule;
      styleRules.unreadTab.bg =
        '.tabbrowser-tabs[useUnreadBGColor] .tab-background-start:not([selected="true"]):not([visited]),' +
        '.tabbrowser-tabs[useUnreadBGColor] .tab-background-middle:not([selected="true"]):not([visited]),' +
        '.tabbrowser-tabs[useUnreadBGColor] .tab-background-end:not([selected="true"]):not([visited])' + backgroundRule;
      styleRules.otherTab.bg =
        '.tabbrowser-tabs[useOtherBGColor]:not([unreadTab]) .tab-background-start:not([selected="true"]),' +
        '.tabbrowser-tabs[useOtherBGColor]:not([unreadTab]) .tab-background-middle:not([selected="true"]),' +
        '.tabbrowser-tabs[useOtherBGColor]:not([unreadTab]) .tab-background-end:not([selected="true"]),' +
        '.tabbrowser-tabs[useOtherBGColor][unreadTab] .tab-background-start:not([selected="true"])[visited],' +
        '.tabbrowser-tabs[useOtherBGColor][unreadTab] .tab-background-middle:not([selected="true"])[visited],' +
        '.tabbrowser-tabs[useOtherBGColor][unreadTab] .tab-background-end:not([selected="true"])[visited]' + backgroundRule;
    }
    else {
      styleRules.currentTab.bgTabsontop =
        '#TabsToolbar[tabsontop=true] > .tabbrowser-tabs[useCurrentBGColor] .tabbrowser-tab[selected="true"],' +
        '#TabsToolbar[tabsontop=true] > .tabbrowser-tabs[useCurrentBGColor][tabonbottom] .tabs-bottom' +
        "{background-image: " + this.gradients.body + " !important;}";
    }

    // Charter Toolbar extension add Object.prototype.toJSONString
    // that break the use      "for (var rule in styleRules)"
    var rules = ["currentTab", "unreadTab", "otherTab", "progressMeter"];
    for (let j = 0; j < rules.length; j++) {
      let rule = rules[j];
      this.setTabStyles("extensions.tabmix.styles." + rule, true);
      var prefValues = this.tabStylePrefs[rule];
      if (!prefValues)
        continue;

      var newRule, index;
      if (rule !=  "progressMeter") {
        newRule = styleRules[rule].text.replace("#colorCode",prefValues.textColor);
        index = ss.insertRule(newRule, ss.cssRules.length);
        this.dynamicRules[rule] = ss.cssRules[index];
      }
      newRule = styleRules[rule].bg.replace(/#colorCode/g,prefValues.bgColor);
      index = ss.insertRule(newRule, ss.cssRules.length);
      this.dynamicRules[rule + "bg"] = ss.cssRules[index];
      if (rule != "progressMeter")
        this.toggleTabStyles(rule);
    }
    if ("bgTabsontop" in styleRules.currentTab) {
      // bottom border for selected tab on top is diffrent
      let newRule = styleRules.currentTab.bgTabsontop.replace(/#colorCode/g, this.tabStylePrefs["currentTab"].bgColor);
      let index = ss.insertRule(newRule, ss.cssRules.length);
      this.dynamicRules["currentTab" + "bgTabsontop"] = ss.cssRules[index];
    }

    var self = this;
    var callSubFunction = function TMP_callSubFunction() {
      try {
        self.replaceBrowserRules();
      } catch (ex) {Tabmix.assert(ex);}
      self.setTabIconMargin();
      self.setCloseButtonMargin();
      delete self.tabStyleSheet;
    }

    try {
      this.replaceContentBrowserRules();
    } catch (ex) {Tabmix.assert(ex);}
    window.setTimeout(function () {callSubFunction();}, 0);
  },

  setTabIconMargin: function TMP_PO_setTabIconMargin() {
    var ss = this.tabStyleSheet;
    var [sMarginStart, sMarginEnd] = Tabmix.rtl ? ["margin-right", "margin-left"] : ["margin-left", "margin-right"];
    var icon = document.getAnonymousElementByAttribute(gBrowser.mCurrentTab, "class", "tab-icon-image");
    if (!icon)
      return; // nothing to do....

   /**
    *  from Firefox 3 tab-icon-image class have -moz-margin-start: value;
    *                                           -margin-end-value: value;
    *  we apply these value dynamically here to our tab-protect-icon tab-lock-icon class
    *  since each theme can use different values
    */
    let style = window.getComputedStyle(icon, null);
    let pinned;
    pinned = icon.hasAttribute("pinned");
    if (pinned)
      icon.removeAttribute("pinned");
    let marginStart = style.getPropertyValue(sMarginStart);
    this._marginStart = marginStart;
    let marginEnd = style.getPropertyValue(sMarginEnd);
    let selector = '.tab-icon:not([pinned]) > ';
    let iconRule = selector + '.tab-protect-icon,' +
                           selector + '.tab-reload-icon,' +
                           selector + '.tab-lock-icon {' +
                           '-moz-margin-start: %S; -moz-margin-end: %S;}'.replace("%S", marginStart).replace("%S", marginEnd);
    ss.insertRule(iconRule, ss.cssRules.length);
    icon.setAttribute("pinned", true);
    let _marginStart = style.getPropertyValue(sMarginStart);
    let _marginEnd = style.getPropertyValue(sMarginEnd);
    let _selector = '.tab-icon[pinned] > ';
    let _iconRule = _selector + '.tab-protect-icon,' +
                         _selector + '.tab-reload-icon,' +
                         _selector + '.tab-lock-icon {' +
                         '-moz-margin-start: %S; -moz-margin-end: %S;}'.replace("%S", _marginStart).replace("%S", _marginEnd);
    ss.insertRule(_iconRule, ss.cssRules.length);
    if (!pinned)
      icon.removeAttribute("pinned");

   /**
    *  set smaller left margin for the tab icon when the close button is on the left side
    *  only do it if start margin is bigger then end margin
    */
    if (parseInt(marginStart) < parseInt(marginEnd))
      return;

    function tabmix_setRule(aRule) {
      let newRule = aRule.replace(/%S/g, "tab-icon-image").replace("%PX", marginEnd);
      ss.insertRule(newRule, ss.cssRules.length);
      newRule = aRule.replace(/%S/g, "tab-lock-icon").replace("%PX", marginEnd);
      ss.insertRule(newRule, ss.cssRules.length);
    }
    iconRule = '.tabbrowser-tabs%favhideclose%[closebuttons-side="left"][closebuttons="alltabs"] > .tabbrowser-tab:not([pinned]):not([protected])%faviconized% .%S ,' +
                      '.tabbrowser-tabs%favhideclose%[closebuttons-side="left"][closebuttons="activetab"] > .tabbrowser-tab:not([pinned]):not([protected])[selected="true"]%faviconized% .%S {'+
                      '-moz-margin-start: %PX !important;}'
    if ("faviconize" in window) {
      let newRule = iconRule.replace(/%favhideclose%/g, ':not([favhideclose="true"])').replace(/%faviconized%/g, '');
      tabmix_setRule(newRule);
      newRule = iconRule.replace(/%favhideclose%/g, '[favhideclose="true"]').replace(/%faviconized%/g, ':not([faviconized="true"])');
      tabmix_setRule(newRule);
    }
    else {
      let newRule = iconRule.replace(/%favhideclose%/g, '').replace(/%faviconized%/g, '');
      tabmix_setRule(newRule);
    }
  },

  setCloseButtonMargin: function TMP_PO_setCloseButtonMargin() {
    var ss = this.tabStyleSheet;
    var [sMarginStart, sMarginEnd] = Tabmix.rtl ? ["margin-right", "margin-left"] : ["margin-left", "margin-right"];
    var icon = document.getAnonymousElementByAttribute(gBrowser.mCurrentTab, "button_side", "right") ||
               document.getAnonymousElementByAttribute(gBrowser.mCurrentTab, "class", "tab-close-button always-right");
    if (!icon)
      return; // nothing to do....

    // set right margin to text stack when close button is not right to it
    let style = window.getComputedStyle(icon, null);
    let marginEnd = style.getPropertyValue(sMarginEnd);
    // on default theme the margin is zero, so we set the end margin to be the same as the start margin
    let textMarginEnd = parseInt(marginEnd) ? marginEnd : this._marginStart;
    delete this._marginStart;
    let iconRule = '.tabbrowser-tabs%favhideclose%[closebuttons="noclose"] > .tabbrowser-tab%faviconized%:not([pinned]) .tab-text-stack,' +
                            '.tabbrowser-tabs%favhideclose%[closebuttons-side="left"] > .tabbrowser-tab%faviconized%:not([pinned]) .tab-text-stack,' +
                            '.tabbrowser-tabs%favhideclose%[closebuttons="activetab"]:not([closebuttons-hover="notactivetab"])[closebuttons-side="right"] > .tabbrowser-tab%faviconized%:not([pinned]):not([selected="true"]) .tab-text-stack,' +
                            '.tabbrowser-tab%faviconized1%[protected]:not([pinned]) .tab-text-stack {' +
                            '-moz-margin-end: %PX !important;}'.replace("%PX", textMarginEnd);
    if ("faviconize" in window) {
      let newRule = iconRule.replace(/%favhideclose%/g, ':not([favhideclose="true"])').replace(/%faviconized%/g, '').replace(/%faviconized1%/g, ':not([faviconized="true"])');
      ss.insertRule(newRule, ss.cssRules.length);
      newRule = iconRule.replace(/%favhideclose%/g, '[favhideclose="true"]').replace(/%faviconized%/g, ':not([faviconized="true"])').replace(/%faviconized1%/g, ':not([faviconized="true"])');
      ss.insertRule(newRule, ss.cssRules.length);
      newRule = '.tabbrowser-tab[faviconized="true"][protected]:not([pinned]) {max-width: 36px !important;}';
      ss.insertRule(newRule, ss.cssRules.length);
    }
    else {
      let newRule = iconRule.replace(/%favhideclose%/g, '').replace(/%faviconized%/g, '').replace(/%faviconized1%/g, '');
      ss.insertRule(newRule, ss.cssRules.length);
    }
  },

 /**
  * we don't need this from 2010-09-15 - Minefiled 4.0b7pre
  * keep it here maybe it fixes some theme ?
  */
  replaceBrowserRules: function TMP_PO_replaceBrowserRules() {
    function browserRules(browserCss) {
      let tabImage = "";
      let rulesCount = browserCss.cssRules.length;
      let oldImage = "> .tab-icon-image";
      let oldImageRe = new RegExp(oldImage);
      let newImage = tabImage + "> .tab-icon > .tab-icon-image";
      let newImageRe = new RegExp(newImage);
      let oldText = /> \.tab-(text|label)/;
      let oldTextRe = oldText;
      let newText = tabImage + "> .tab-text-stack > .tab-text";
      let newTextRe = new RegExp(newText);

      for (let i = 0; i < rulesCount; ++i) {
        let rule = browserCss.cssRules[i];
        let selector = rule.selectorText;
        if (oldImageRe.test(selector) && !newImageRe.test(selector)) {
          let cssText = rule.cssText.replace(oldImage, newImage);
          this.tabStyleSheet.insertRule(cssText, this.tabStyleSheet.cssRules.length);
        }
        else if (oldTextRe.test(selector) && !newTextRe.test(selector)) {
          let cssText = rule.cssText.replace(oldText, newText);
          this.tabStyleSheet.insertRule(cssText, this.tabStyleSheet.cssRules.length);
        }
      }
    }

    var href = "chrome://browser/skin/browser.css"
    var styleSheets = this.getStyleSheets(href);
    if (styleSheets.length)
      styleSheets.forEach(browserRules, this);
    else
      Tabmix.log('unable to find "' + href + '"');
  },

  replaceContentBrowserRules: function TMP_PO_replaceContentBrowserRules() {
    function contentBrowserRules(browserCss) {
      let rulesCount = browserCss.cssRules.length;
      for (let i = 0; i < rulesCount; ++i) {
        let rule = browserCss.cssRules[i];
        if ("selectorText" in rule && rule.selectorText == ".tabbrowser-tab:not([pinned])") {
          rule.style.removeProperty("width");
          rule.style.removeProperty("-moz-box-flex");
          if (typeof(this.dynamicRules["width"]) == "undefined") {
            let _max = TabmixSvc.prefs.getIntPref("browser.tabs.tabMaxWidth");
            let _min = TabmixSvc.prefs.getIntPref("browser.tabs.tabMinWidth");
            rule.style.setProperty("max-width", _max + "px", null);
            rule.style.setProperty("min-width", _min + "px", null);
            this.dynamicRules["width"] = rule;
            let skin = TabmixSvc.prefs.getCharPref("general.skins.selectedSkin");
            if (skin != "classic/1.0") {
              let important = skin == "classiccompact" ? "!important" : "";
              let newRule = "#tabbrowser-tabs > .tabbrowser-tab[fadein]:not([pinned]) {min-width: XMinpx " + important + "; max-width: XMaxpx " + important + ";}";
              newRule = newRule.replace("XMin" ,_min).replace("XMax" ,_max);
              let ss = this.tabStyleSheet;
              let index = ss.insertRule(newRule, ss.cssRules.length);
              this.dynamicRules["width1"] = ss.cssRules[index];
            }
          }
          else {
            rule.style.removeProperty("max-width");
            rule.style.removeProperty("min-width");
          }
          break;
        }
      }
    }

    var href = "chrome://browser/content/browser.css";
    var styleSheets = this.getStyleSheets(href);
    if (styleSheets.length)
      styleSheets.forEach(contentBrowserRules, this);
    else
      Tabmix.log('unable to find "' + href + '"');
  },

/*XXX move this and all the code from tabmix dialog to import prefs into mudel file */
  updateOldStylePrefs: function TMP_PO_updateOldStylePrefs() {
    // in 0.3.0.605 we changed tab color from old pref to new pref
    // old pref "extensions.tabmix.currentColor" type integer
    // new pref "extensions.tabmix.currentColorCode" type string
    //
    // in 0.3.7.4 2008-12-24 we combined all style prefs into one per type
    // extensions.tabmix.styles.[TYPE NAME]
    var rules = ["currentTab", "unreadTab", "otherTab", "progressMeter"];
    const pBranch = Ci.nsIPrefBranch;
    for (let i = 0; i < rules.length; i++) {
      let rule = rules[i];
      this.preventUpdate = true;
      let ruleName = rule.replace(/Tab|Meter/,"");
      let attrib = ruleName.charAt(0).toUpperCase() + ruleName.substr(1);
      let oldPrefs = {italic: "italic" + attrib, bold: "bold" + attrib, underline: "underline" + attrib,
                       text: "use"+ attrib + "Color", textColor: ruleName + "ColorCode", textColorOLD: ruleName + "Color"}
      let needToUpdatePref = false;
      let prefsToChange = {};
      for (var oldPref in oldPrefs) {
        var prefName = oldPrefs[oldPref] ,prefValue = null;
        if (TabmixSvc.TMPprefs.prefHasUserValue(prefName)) {
          switch (TabmixSvc.TMPprefs.getPrefType(prefName)) {
            case pBranch.PREF_BOOL:
              prefValue = TabmixSvc.TMPprefs.getBoolPref(prefName);
              break;
            case pBranch.PREF_INT:
              var colorCodes = ["#CF1919", "#0E36EF", "#DDDF0D", "#3F8F3E", "#E066FF", "#86E7EF",
                                 "#FFFFFF", "#7F7F7F", "#000000", "#EF952C", "#FF82AB", "#7F4C0F", "#AAAAFF"];
              var _value = TabmixSvc.TMPprefs.getIntPref(prefName);
              if (_value >= 0 && _value < 13)
                prefValue = colorCodes[_value];
              break;
            case pBranch.PREF_STRING:
              prefValue = TabmixSvc.TMPprefs.getCharPref(prefName);
              break;
          }
          TabmixSvc.TMPprefs.clearUserPref(prefName);
          if (prefValue != null) {
            needToUpdatePref = true;
            if (rule == "progressMeter")
              oldPref = oldPref.replace("text", "bg");
            prefsToChange[oldPref.replace("OLD", "")] = prefValue;
          }
        }
      }
      this.preventUpdate = false;
      if (needToUpdatePref == true) {
        this.converOldStylePrefs(rule, prefsToChange);
      }
    }
  },

  converOldStylePrefs: function TMP_PO_converOldStylePrefs(prefName, oldPrefs) {
    var prefString = TabmixSvc.TMPprefs.getCharPref("styles." + prefName);
    try {
      let prefValues = Tabmix.JSON.parse(prefString);
      for (let item in oldPrefs)
        prefValues[item] = oldPrefs[item];
      let newprefString = Tabmix.JSON.stringify(prefValues);
      if (newprefString != prefString)
        TabmixSvc.TMPprefs.setCharPref("styles." + prefName, newprefString);
    } catch (ex) { return; } // nothing we can do
  },

  defaultStylePrefs: {    currentTab: {italic:false,bold:false,underline:false,text:true,textColor:'rgba(0,0,0,1)',bg:false,bgColor:'rgba(236,233,216,1)'},
                           unreadTab: {italic:true,bold:false,underline:false,text:true,textColor:'rgba(204,0,0,1)',bg:false,bgColor:'rgba(236,233,216,1)'},
                            otherTab: {italic:false,bold:false,underline:false,text:true,textColor:'rgba(0,0,0,1)',bg:false,bgColor:'rgba(236,233,216,1)'},
                       progressMeter: {bg:true,bgColor:'rgba(170,170,255,1)'}},

  tabStylePrefs: {},
  setTabStyles: function TMP_PO_setTabStyles(prefName, start) {
    var ruleName = prefName.split(".").pop();
    if (ruleName in this && this[ruleName] == "preventUpdate")
      return;
    this[ruleName] = "preventUpdate";

    // Converts a color string in the format "#RRGGBB" to rgba(r,g,b,a).
    function getRGBcolor(aColorCode, aOpacity) {
      var newRGB = [];
      var _length = aColorCode.length;
      if (/^rgba|rgb/.test(aColorCode)) {
        newRGB = aColorCode.replace(/rgba|rgb|\(|\)/g,"").split(",").splice(0, 4);
        if (newRGB.length < 3)
          return null;
        for (var i = 0; i < newRGB.length; i++) {
          if (isNaN(newRGB[i].replace(/[\s]/g,"") * 1))
            return null ;
        }
      }
      else if (/^#/.test(aColorCode) && _length == 4 || _length == 7) {
        aColorCode = aColorCode.replace("#","");
        var subLength = _length == 7 ? 2 : 1;
        var newRGB = [];
        for (var i = 0; i < 3; i++) {
          var subS = aColorCode.substr(i*subLength, subLength);
          if (_length == 4)
            subS += subS;
          var newNumber = parseInt(subS, 16);
          if (isNaN(newNumber))
            return null;
          newRGB.push(newNumber);
        }
      }
      else
        return null;

      var opacity = newRGB[3];
      if (aOpacity != null || opacity == null || opacity < 0 || opacity > 1)
        newRGB[3] = aOpacity || 1;
      return "rgba(" + newRGB.join(",") + ")";
    }

    // styles format: italic:boolean, bold:boolean, underline:boolean,
    //                text:boolean, textColor:string, textOpacity:string,
    //                bg:boolean, bgColor:string, bgOpacity:striung
    // if we don't catch the problem here it can break the rest of tabmix startup
    var defaultPrefValues = this.defaultStylePrefs[ruleName];
    var prefValues = {};
    if (TabmixSvc.prefs.prefHasUserValue(prefName)) {
      let prefString = TabmixSvc.prefs.getCharPref(prefName);
      try {
        var currentPrefValues = Tabmix.JSON.parse(prefString);
      }
      catch (ex) {
        try {
          // convert old format to JSON string
          // we do it only one time when user update Tabmix from old version
          currentPrefValues = Components.utils.evalInSandbox("({" + prefString  + "})",
                              new Components.utils.Sandbox("about:blank"));
          TabmixSvc.prefs.setCharPref(prefName, Tabmix.JSON.stringify(currentPrefValues));
        } catch (e) {
           Tabmix.log('Error in preference "' + prefName + '", value was reset to default');
           Tabmix.assert(e);
           if (TabmixSvc.prefs.prefHasUserValue(prefName))
             TabmixSvc.prefs.clearUserPref(prefName);
           // set prev value to default so we can continue with this function
           currentPrefValues = defaultPrefValues;
        }
      }

      // make sure we have all the item
      // if item is missing set it to default
      for (let item in defaultPrefValues) {
        let value = currentPrefValues[item];
        if (item.indexOf("Color") > -1) {
         let opacity = item.replace("Color", "Opacity");
         let opacityValue = opacity in currentPrefValues ? currentPrefValues[opacity] : null;
          value = getRGBcolor(value, opacityValue);
        }
        else if (value != null && typeof(value) != "boolean") {
          if (/^true$|^false$/.test(value.replace(/[\s]/g,"")))
            value = value == "true" ? true : false;
          else
            value = null;
        }
        if (value == null)
          prefValues[item] = defaultPrefValues[item];
        else
          prefValues[item] = value;
      }
      if (currentPrefValues != prefValues)
        TabmixSvc.prefs.setCharPref(prefName, Tabmix.JSON.stringify(prefValues));
    }
    else
      prefValues = defaultPrefValues;

    var currentValue = this.tabStylePrefs[ruleName];
    this.tabStylePrefs[ruleName] = prefValues;
    if (currentValue && !start) {
      // we get here only when user changed pref value
      if (currentValue.bgColor != prefValues.bgColor) {
        if (ruleName != "progressMeter") {
          let newRule = this.gradients.tab.replace(/#colorCode/g, prefValues.bgColor);
          this.dynamicRules[ruleName + "bg"].style.setProperty("background-image", newRule, "important");
          if (ruleName + "bgTabsontop" in this.dynamicRules) {
            newRule = this.gradients.body.replace(/#colorCode/g, prefValues.bgColor);
            this.dynamicRules[ruleName + "bgTabsontop"].style.setProperty("background-image", newRule, "important");
          }
        }
        else
          this.dynamicRules[ruleName + "bg"].style.setProperty("background-color", prefValues.bgColor, "important");
      }

      if (ruleName != "progressMeter") {
        if (currentValue.textColor != prefValues.textColor)
          this.dynamicRules[ruleName].style.setProperty("color",prefValues.textColor, null);
        this.toggleTabStyles(prefName);
      }
      else
        this.setProgressMeter();
    }
    delete this[ruleName];
  },

  toggleTabStyles: function TMP_PO_toggleTabStyles(prefName) {
    var ruleName = prefName.split(".").pop();

    var attrib = (ruleName.charAt(0).toUpperCase() + ruleName.substr(1)).replace("Tab","");
    var tabBar = gBrowser.tabContainer;
    var currentBoldStyle = tabBar.getAttribute("bold" + attrib) == "true";
    var prefValues = this.tabStylePrefs[ruleName];

    var control = TabmixSvc.TMPprefs.getBoolPref(ruleName);
    // we need to set unreadTab when it is on
    // in order to control other tabs that aren't read
    if (ruleName == "unreadTab")
      Tabmix.setItem(tabBar, ruleName,                control || null);

    // set bold, italic and underline only wehn we control the sytle
    // to override theme default rule if exist
    Tabmix.setItem(tabBar, "bold" + attrib,           control ? prefValues.bold : null);
    Tabmix.setItem(tabBar, "italic" + attrib,         control ? prefValues.italic : null);
    Tabmix.setItem(tabBar, "underline" + attrib,      control ? prefValues.underline : null);

    Tabmix.setItem(tabBar, "use"+ attrib + "Color",   control && prefValues.text || null);
    Tabmix.setItem(tabBar, "use"+ attrib + "BGColor", control && prefValues.bg || null);

    // changeing bold attribute can change tab width and effect tabBar scroll status
    if (currentBoldStyle != control && prefValues.bold) {
      TabmixTabbar.updateScrollStatus();
      TabmixTabbar.updateBeforeAndAfter();
    }
  },

  setProgressMeter: function () {
    // we don't change attribute to be compatible with theme that maybe use this values
    var showOnTabs = TabmixSvc.TMPprefs.getBoolPref("progressMeter");
    Tabmix.setItem(gBrowser.tabContainer, "useProgressColor", showOnTabs && this.tabStylePrefs["progressMeter"].bg || null);
    Tabmix.setItem(gBrowser.tabContainer, "progressMeter", showOnTabs || null);
    TabmixProgressListener.listener.showProgressOnTab = showOnTabs;
  },

  setLink_openPrefs: function() {
    if (!Tabmix.singleWindowMode)
      return;

    function updateStatus(pref, testVal, test, newVal) {
      try {
        var prefValue = TabmixSvc.prefs.getIntPref(pref);
        test = test ? prefValue == testVal : prefValue != testVal
      }
      catch(e){ test = true; }

      if (test)
        TabmixSvc.prefs.setIntPref(pref, newVal);
    }

    updateStatus("browser.link.open_newwindow", 2, true, 3);
    updateStatus("browser.link.open_newwindow.override.external", 2, true, 3);
    updateStatus("browser.link.open_newwindow.restriction", 0, false, 0);
  },

  // code for Single Window Mode...
  // disable the "Open New Window action
  //disable & hides some menuitem
  setSingleWindowUI: function() {
    Tabmix.singleWindowMode = TabmixSvc.TMPprefs.getBoolPref("singleWindow");
    var newWindowButton = document.getElementById("new-window-button");
    if (newWindowButton)
      newWindowButton.setAttribute("disabled", Tabmix.singleWindowMode);

    var menuItem;
    var menuFile = document.getElementById("menu_FilePopup");
    if (menuFile) {
      menuItem = menuFile.getElementsByAttribute("command", "cmd_newNavigator")[0];
      if (menuItem)
        menuItem.setAttribute("hidden", Tabmix.singleWindowMode);
    }

    var frameMenu = document.getElementById("frame");
    if (frameMenu) {
      menuItem = frameMenu.getElementsByAttribute("oncommand", "gContextMenu.openFrame();")[0];
      if (menuItem)
        menuItem.setAttribute("hidden", Tabmix.singleWindowMode);
    }

    document.getElementById("tmOpenInNewWindow").hidden = Tabmix.singleWindowMode;
  },

  setMenuIcons: function() {
    function setClass(items, hideIcons) {
      if (hideIcons)
        for (var i = 0; i < items.length; ++i)
          items[i].removeAttribute("class");
      else
        for ( i = 0; i < items.length; ++i)
          items[i].setAttribute("class", items[i].getAttribute("tmp_iconic"));
    }
    var hideIcons = TabmixSvc.TMPprefs.getBoolPref("hideIcons");
    var iconicItems = document.getElementsByAttribute("tmp_iconic", "*");
    setClass(iconicItems, hideIcons);

    iconicItems = gBrowser.tabContextMenu.getElementsByAttribute("tmp_iconic", "*");
    setClass(iconicItems, hideIcons);
  },

  setAutoHidePref: function() {
    TabmixTabbar.hideMode = TabmixSvc.TMPprefs.getIntPref("hideTabbar");
    var autoHide = TabmixTabbar.hideMode != 0;
    if (autoHide != TabmixSvc.prefs.getBoolPref("browser.tabs.autoHide")) {
      TabmixSvc.prefs.setBoolPref("browser.tabs.autoHide", autoHide);
      if (TabmixTabbar.hideMode == 1)
        gBrowser.tabContainer.updateVisibility();
    }
  },

  setTabBarVisibility: function TMP_PO_setTabBarVisibility(onFullScreenExit) {
    if (TabmixTabbar.hideMode == 2)
      gBrowser.tabContainer.visible = false;
    else if (!gBrowser.tabContainer.visible) {
      let moreThenOneTab = gBrowser.tabs.length > 1;
      gBrowser.tabContainer.visible = moreThenOneTab || TabmixTabbar.hideMode == 0;
      if (moreThenOneTab) {
        gBrowser.tabContainer.mTabstrip.ensureElementIsVisible(gBrowser.selectedTab, false);
        TabmixTabbar.updateBeforeAndAfter();
      }
    }
  },

  changeNewTabButtonSide: function(aPosition) {
    var tabBar = gBrowser.tabContainer;
    tabBar._checkNewtabButtonVisibility = false;
    let newTabButton = document.getElementById("new-tab-button");
    if (newTabButton && newTabButton.parentNode == gBrowser.tabContainer._container) {
      if (aPosition == 0) {
        Tabmix.setItem("TabsToolbar", "newtab_side", "left");
        newTabButton.parentNode.insertBefore(newTabButton, gBrowser.tabContainer);
      }
      else {
        Tabmix.setItem("TabsToolbar", "newtab_side", aPosition == 1 ? "right" : null);
        let before = gBrowser.tabContainer.nextSibling;
        if (document.getElementById("tabmixScrollBox"))
          before = before.nextSibling
        newTabButton.parentNode.insertBefore(newTabButton, before);
      }
      tabBar._checkNewtabButtonVisibility = TabmixTabbar.isMultiRow && TabmixSvc.TMPprefs.getBoolPref("newTabButton") && aPosition == 2;
      Tabmix.setItem("TabsToolbar", "newTabButton", TabmixSvc.TMPprefs.getBoolPref("newTabButton"));
      tabBar._rightNewTabButton = newTabButton;
    }
    else {
      Tabmix.setItem("TabsToolbar", "newTabButton", false);
      tabBar._rightNewTabButton = null;
    }
  },

  tabBarPositionChanged: function(aPosition) {
    if (aPosition > 1 || (aPosition != 0 && "TreeStyleTabBrowser" in window)) {
      TabmixSvc.TMPprefs.setIntPref("tabBarPosition", 0);
      return false;
    }
    if (TabmixTabbar.position == aPosition)
      return false;

    TabmixTabbar.position = aPosition;
    gBrowser.tabContainer._tabDropIndicator.removeAttribute("style");
    // save TabsOnTop status
    function setTabsOnTopCmd (aVisible) {
      // hide/show TabsOnTop menu & menuseparator
      let toggleTabsOnTop = document.getElementsByAttribute("command", "cmd_ToggleTabsOnTop");
      for (let i = 0; i < toggleTabsOnTop.length; i++) {
        let cmd = toggleTabsOnTop[i];
        cmd.hidden = !aVisible;
        if (cmd.nextSibling && cmd.nextSibling.localName == "menuseparator")
          cmd.nextSibling.hidden = !aVisible;
      }
    }
    if (TabmixTabbar.position == 1) {// bottom
      var bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
      if (!bottomToolbox) {
        bottomToolbox = document.createElement("toolbox");
        bottomToolbox.setAttribute("id", "tabmix-bottom-toolbox");
        if (navigator.oscpu.indexOf("Windows NT 6.1") == 0)
          bottomToolbox.setAttribute("tabmix_aero", true);
        let browser = document.getElementById("browser");
        browser.parentNode.insertBefore(bottomToolbox, browser.nextSibling);
      }
      setTabsOnTopCmd(false);
      if (TabsOnTop.enabled) {
        gNavToolbox.tabmix_tabsontop = true;
        TabsOnTop.enabled = false;
      }
      bottomToolbox.appendChild(document.getElementById("TabsToolbar"));
    }
    else {// top
      gNavToolbox.appendChild(document.getElementById("TabsToolbar"));
      setTabsOnTopCmd(true);
      if (gNavToolbox.tabmix_tabsontop) {
        TabsOnTop.enabled = true;
        gNavToolbox.tabmix_tabsontop = false;
      }
    }
    // force TabmixTabbar.setHeight to set tabbar height
    TabmixTabbar.visibleRows = 1;
    return true;
  },

  // Show Reload Every menu on Reload button
  showReloadEveryOnReloadButton: function() {
    let show = TabmixSvc.prefs.getBoolPref("extensions.tabmix.reloadEvery.onReloadButton");
    let reloadButton = document.getElementById("reload-button");
    if (reloadButton) {
      Tabmix.setItem(reloadButton, "type", show ? "menu-button" : null);
      Tabmix.setItem(reloadButton, "context", show ? "autoreload_popup" : null);
      Tabmix.setItem("stop-button", "context", show ? "autoreload_popup" : null);
    }

    Tabmix.setItem("urlbar-go-button", "context", show ? "autoreload_popup" : null);
    Tabmix.setItem("urlbar-reload-button", "context", show ? "autoreload_popup" : null);
    Tabmix.setItem("urlbar-stop-button", "context", show ? "autoreload_popup" : null);
  },

  // we replace some Tabmix settings with Firefox settings
  updateSettings: function() {
    this.preventUpdate = true;
    if (TabmixSvc.TMPprefs.prefHasUserValue("undoCloseCache")) {
       var max_tabs_undo = TabmixSvc.TMPprefs.getIntPref("undoCloseCache");
       TabmixSvc.TMPprefs.clearUserPref("undoCloseCache");
       TabmixSvc.prefs.setIntPref("browser.sessionstore.max_tabs_undo", max_tabs_undo);
    }
    // remove disp=attd&view=att it's make problem with gMail
    if (TabmixSvc.TMPprefs.prefHasUserValue("filetype")) {
       var filetype = TabmixSvc.TMPprefs.getCharPref("filetype");
       filetype = filetype.replace("/disp=attd&view=att/","").replace("  ", " ").trim();
       TabmixSvc.TMPprefs.setCharPref("filetype", filetype);
    }
    // 2008-08-17
    if (TabmixSvc.TMPprefs.prefHasUserValue("opentabfor.search")) {
       TabmixSvc.prefs.setBoolPref("browser.search.openintab", TabmixSvc.TMPprefs.getBoolPref("opentabfor.search"));
       TabmixSvc.TMPprefs.clearUserPref("opentabfor.search");
    }
    // 2008-09-23
    if (TabmixSvc.TMPprefs.prefHasUserValue("keepWindow")) {
       TabmixSvc.prefs.setBoolPref("browser.tabs.closeWindowWithLastTab", !TabmixSvc.TMPprefs.getBoolPref("keepWindow"));
       TabmixSvc.TMPprefs.clearUserPref("keepWindow");
    }
    // 2008-09-23
    if (TabmixSvc.prefs.prefHasUserValue("browser.ctrlTab.mostRecentlyUsed")) {
       TabmixSvc.prefs.setBoolPref("browser.ctrlTab.previews", TabmixSvc.prefs.getBoolPref("browser.ctrlTab.mostRecentlyUsed"));
       TabmixSvc.prefs.clearUserPref("browser.ctrlTab.mostRecentlyUsed");
    }
    // 2008-09-28
    if (TabmixSvc.TMPprefs.prefHasUserValue("lasttab.handleCtrlTab")) {
       TabmixSvc.prefs.setBoolPref("browser.ctrlTab.previews", TabmixSvc.TMPprefs.getBoolPref("lasttab.handleCtrlTab"));
       TabmixSvc.TMPprefs.clearUserPref("lasttab.handleCtrlTab");
    }
    // 2008-11-29
    if (TabmixSvc.TMPprefs.prefHasUserValue("maxWidth")) {
       TabmixSvc.prefs.setIntPref("browser.tabs.tabMaxWidth", TabmixSvc.TMPprefs.getIntPref("maxWidth"));
       TabmixSvc.TMPprefs.clearUserPref("maxWidth");
    }
    // 2008-11-29
    if (TabmixSvc.TMPprefs.prefHasUserValue("minWidth")) {
       TabmixSvc.prefs.setIntPref("browser.tabs.tabMinWidth", TabmixSvc.TMPprefs.getIntPref("minWidth"));
       TabmixSvc.TMPprefs.clearUserPref("minWidth");
    }
    // 2009-01-31
    if (TabmixSvc.TMPprefs.prefHasUserValue("newTabButton.leftside")) {
       TabmixSvc.TMPprefs.setIntPref("newTabButton.position", TabmixSvc.TMPprefs.getBoolPref("newTabButton.leftside") ? 0 : 2);
       TabmixSvc.TMPprefs.clearUserPref("newTabButton.leftside");
    }
    // 2009-10-10
    // swap prefs --> warn when closing window "extensions.tabmix.windows.warnOnClose" replaced with "browser.tabs.warnOnClose"
    //                warn when closing tabs "browser.tabs.warnOnClose" replaced with "extensions.tabmix.tabs.warnOnClose"
    if (TabmixSvc.TMPprefs.prefHasUserValue("windows.warnOnClose")) {
       TabmixSvc.TMPprefs.setBoolPref("tabs.warnOnClose", TabmixSvc.prefs.getBoolPref("browser.tabs.warnOnClose"));
       TabmixSvc.prefs.setBoolPref("browser.tabs.warnOnClose", TabmixSvc.TMPprefs.getBoolPref("windows.warnOnClose"));
       TabmixSvc.TMPprefs.clearUserPref("windows.warnOnClose");
    }
    // 2010-03-07
    if (TabmixSvc.TMPprefs.prefHasUserValue("extraIcons")) {
       TabmixSvc.TMPprefs.setBoolPref("extraIcons.locked", TabmixSvc.TMPprefs.getBoolPref("extraIcons"));
       TabmixSvc.TMPprefs.setBoolPref("extraIcons.protected", TabmixSvc.TMPprefs.getBoolPref("extraIcons"));
       TabmixSvc.TMPprefs.clearUserPref("extraIcons");
    }
    // 2010-06-05
    if (TabmixSvc.TMPprefs.prefHasUserValue("tabXMode")) {
      TabmixSvc.TMPprefs.setIntPref("tabs.closeButtons", TabmixSvc.TMPprefs.getIntPref("tabXMode"));
      TabmixSvc.TMPprefs.clearUserPref("tabXMode");
    }
    // partly fix a bug from version 0.3.8.3
    else if (TabmixSvc.prefs.prefHasUserValue("browser.tabs.closeButtons") && !TabmixSvc.TMPprefs.prefHasUserValue("version") &&
             !TabmixSvc.TMPprefs.prefHasUserValue("tabs.closeButtons")) {
      let value = TabmixSvc.prefs.getIntPref("browser.tabs.closeButtons");
      // these value are from 0.3.8.3. we don't know if 0,1 are also from 0.3.8.3 so we don't use 0,1.
      if (value > 1 && value <= 6) {
        let newValue = [3,5,1,1,2,4,1][value];
        TabmixSvc.TMPprefs.setIntPref("tabs.closeButtons", newValue);
      }
      TabmixSvc.prefs.clearUserPref("browser.tabs.closeButtons");
    }
    if (TabmixSvc.TMPprefs.prefHasUserValue("tabXMode.enable")) {
      TabmixSvc.TMPprefs.setBoolPref("tabs.closeButtons.enable", TabmixSvc.TMPprefs.getBoolPref("tabXMode.enable"));
      TabmixSvc.TMPprefs.clearUserPref("tabXMode.enable");
    }
    if (TabmixSvc.TMPprefs.prefHasUserValue("tabXLeft")) {
      TabmixSvc.TMPprefs.setBoolPref("tabs.closeButtons.onLeft", TabmixSvc.TMPprefs.getBoolPref("tabXLeft"));
      TabmixSvc.TMPprefs.clearUserPref("tabXLeft");
    }
    if (TabmixSvc.TMPprefs.prefHasUserValue("tabXDelay")) {
      TabmixSvc.TMPprefs.setIntPref("tabs.closeButtons.delay", TabmixSvc.TMPprefs.getIntPref("tabXDelay"));
      TabmixSvc.TMPprefs.clearUserPref("tabXDelay");
    }
    // 2010-09-16
    if (TabmixSvc.TMPprefs.prefHasUserValue("speLink")) {
      let val = TabmixSvc.TMPprefs.getIntPref("speLink");
      TabmixSvc.TMPprefs.setIntPref("opentabforLinks", val);
      TabmixSvc.TMPprefs.setBoolPref("lockallTabs", val == 1);
      TabmixSvc.TMPprefs.clearUserPref("speLink");
    }
    // 2010-10-12
    if (TabmixSvc.TMPprefs.prefHasUserValue("hideurlbarprogress")) {
      TabmixSvc.TMPprefs.clearUserPref("hideurlbarprogress");
    }
    // 2011-01-26
    if (TabmixSvc.TMPprefs.prefHasUserValue("mouseDownSelect")) {
      TabmixSvc.TMPprefs.setBoolPref("selectTabOnMouseDown", TabmixSvc.TMPprefs.getBoolPref("mouseDownSelect"));
      TabmixSvc.TMPprefs.clearUserPref("mouseDownSelect");
    }
    // 2011-10-11
    if (TabmixSvc.prefs.prefHasUserValue("browser.link.open_external")) {
      let val = TabmixSvc.prefs.getIntPref("browser.link.open_external");
      if (val == TabmixSvc.prefs.getIntPref("browser.link.open_newwindow"))
        val = -1;
      TabmixSvc.prefs.setIntPref("browser.link.open_newwindow.override.external", val);
      TabmixSvc.prefs.clearUserPref("browser.link.open_external");
    }

    // verify valid value
    if (TabmixSvc.TMPprefs.prefHasUserValue("tabs.closeButtons")) {
      let value = TabmixSvc.TMPprefs.getIntPref("tabs.closeButtons");
      if (value < 1 || value > 5)
        TabmixSvc.TMPprefs.clearUserPref("tabs.closeButtons");
    }
    // 2011-01-22 - verify sessionstore enabled
    if (TabmixSvc.prefs.prefHasUserValue("browser.sessionstore.enabled"))
      TabmixSvc.prefs.clearUserPref("browser.sessionstore.enabled");

try { // user report about bug here ... ?
    function getVersion(extensions) {
      var currentVersion = extensions.get("{dc572301-7619-498c-a57d-39143191b318}").version;
      var oldVersion = TabmixSvc.TMPprefs.prefHasUserValue("version") ? TabmixSvc.TMPprefs.getCharPref("version") : "";
      if (currentVersion != oldVersion) {
        TabmixSvc.TMPprefs.setCharPref("version", currentVersion);
        // open Tabmix page in a new tab
        window.setTimeout(function() {
          let b = Tabmix.getTopWin().gBrowser;
          b.selectedTab = b.addTab("http://tmp.garyr.net/version_update.htm?version=" + currentVersion);
        },1000);
        // noting more to do at the moment
      }
    }
    const Application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
    Application.getExtensions(getVersion);
} catch (ex) {Tabmix.assert(ex);}
    // block item in tabclicking options that are not in use
    this.blockedValues = [];
    if (!("SessionSaver" in window && window.SessionSaver.snapBackTab))
      this.blockedValues.push(12);
    var isIE = ("IeView" in window && window.IeView.ieViewLaunch) ||
               ("gIeTab" in window && window.gIeTab.switchTabEngine) ||
               ("ieview" in window && window.ieview.launch);
    if (!isIE)
      this.blockedValues.push(21);
    if (!document.getElementById("Browser:BookmarkAllTabs"))
      this.blockedValues.push(26);
    this.updateTabClickingOptions();

    // verify that all the prefs exist .....
    this.addMissingPrefs();
    this.preventUpdate = false;
  },

  updateTabClickingOptions: function() {
    var c = ["dblClickTab", "middleClickTab", "ctrlClickTab", "shiftClickTab", "altClickTab"
                  ,"dblClickTabbar", "middleClickTabbar", "ctrlClickTabbar", "shiftClickTabbar", "altClickTabbar"];
    for (let i = 0; i < c.length; i++)
      this.blockTabClickingOptions("extensions.tabmix." + c[i]);
  },

  blockTabClickingOptions: function(prefName) {
    if (this.blockedValues.indexOf(TabmixSvc.prefs.getIntPref(prefName)) > -1) {
      if (TabmixSvc.prefs.prefHasUserValue(prefName))
        TabmixSvc.prefs.clearUserPref(prefName);
      else
        TabmixSvc.prefs.setIntPref(prefName, 0);
    }
  },

  // we call this function also from pref-tabmix.js
  addMissingPrefs: function() {
    const pBranch = Components.interfaces.nsIPrefBranch;
    function _setPref(aType, aPref, aDefault) {
      if (TabmixSvc.prefs.prefHasUserValue(aPref)) {
        if (TabmixSvc.prefs.getPrefType(aPref) == aType)
          return;
        else
          TabmixSvc.prefs.clearUserPref(aPref);
      }
      switch (aType) {
        case pBranch.PREF_BOOL:
          return Tabmix.getBoolPref(aPref, aDefault);
        case pBranch.PREF_INT:
          return Tabmix.getIntPref(aPref, aDefault);
        case pBranch.PREF_STRING:
          return Tabmix.getCharPref(aPref, aDefault);
      }
    }
    _setPref(pBranch.PREF_INT, "browser.link.open_newwindow.override.external", -1);       // exist from firefox 10.0
  }

}

var TabmixProgressListener = {
  startup: function TMP_PL_startup(tabBrowser) {
    // check the current window.  if we're in a popup, don't init this progressListener
    if (window.document.documentElement.getAttribute("chromehidden"))
      return;
    Tabmix.newCode("gBrowser.setTabTitleLoading", tabBrowser.setTabTitleLoading)._replace(
      'aTab.label = this.mStringBundle.getString("tabs.connecting");',
      'if (TabmixTabbar.hideMode != 2 && TabmixTabbar.widthFitTitle && !aTab.hasAttribute("width")) \
         aTab.setAttribute("width", aTab.getBoundingClientRect().width); \
       $&'
    ).toCode();
    this.listener.mTabBrowser = tabBrowser;
    tabBrowser.addTabsProgressListener(this.listener);
  },

  listener: {
    mTabBrowser: null,
    showProgressOnTab: false,
    onProgressChange: function (aBrowser, aWebProgress, aRequest,
                                aCurSelfProgress, aMaxSelfProgress,
                                aCurTotalProgress, aMaxTotalProgress) {
      if (!this.showProgressOnTab || TabmixTabbar.hideMode == 2 || !aMaxTotalProgress)
        return;
      var percentage = Math.ceil((aCurTotalProgress * 100) / aMaxTotalProgress);
      if (percentage > 0 && percentage < 100)
        this.mTabBrowser.getTabForBrowser(aBrowser).setAttribute("tab-progress", percentage);
    },

    onStateChange: function TMP_onStateChange(aBrowser, aWebProgress, aRequest, aStateFlags, aStatus) {
      let tab = this.mTabBrowser.getTabForBrowser(aBrowser);
      const nsIWebProgressListener = Ci.nsIWebProgressListener;
      if (aStateFlags & nsIWebProgressListener.STATE_START &&
          aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK) {
        let url = aRequest.QueryInterface(Ci.nsIChannel).URI.spec;
        if (url == "about:blank") {
          tab.removeAttribute("busy");
          tab.removeAttribute("progress");
          this.mTabBrowser.setTabTitle(tab);
        }
        // this code run after setTabTitleLoading, so we must set tab width on setTabTitleLoading
        // at this stage only unhide the button if needed.
        else if (!(aStateFlags & nsIWebProgressListener.STATE_RESTORING) &&
              this.mTabBrowser.tabContainer.getAttribute("closebuttons") == "noclose") {
          let tabsCount = this.mTabBrowser.visibleTabs.length;
          if (tabsCount == 1)
            this.mTabBrowser.tabContainer.adjustTabstrip(true, url);
        }
      }
      else if (aStateFlags & nsIWebProgressListener.STATE_STOP &&
                   aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK) {
        let tabsCount = this.mTabBrowser.visibleTabs.length;
        if (tabsCount == 1)
          this.mTabBrowser.tabContainer.adjustTabstrip(true);
        tab.removeAttribute("tab-progress");
        if (TabmixSvc.TMPprefs.getBoolPref("unreadTabreload") && tab.hasAttribute("visited") &&
              !tab.hasAttribute("dontremovevisited") && tab.getAttribute("selected") != "true")
          tab.removeAttribute("visited");
        // see gBrowser.openLinkWithHistory in tablib.js
        if (tab.hasAttribute("dontremovevisited"))
          tab.removeAttribute("dontremovevisited")

        if (!tab.hasAttribute("busy"))
          TabmixSessionManager.tabLoaded(tab);
        if (aRequest.QueryInterface(Ci.nsIChannel).URI.spec != "about:blank")
           aBrowser.tabmix_allowLoad = !tab.hasAttribute("locked");
      }
      if ((aStateFlags & nsIWebProgressListener.STATE_IS_WINDOW) &&
            (aStateFlags & nsIWebProgressListener.STATE_STOP)) {
        if (tab.autoReloadURI)
          Tabmix.autoReload.onTabReloaded(tab, aBrowser);

        // disabled name for locked tab, so locked tab don't get reuse
        if (tab.getAttribute("locked") && aBrowser.contentWindow.name)
          aBrowser.contentWindow.name = "";
      }
    }
  }
}
