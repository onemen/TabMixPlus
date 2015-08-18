"use strict";

// code based on Tab X 0.5 enhanced version by Morac, modified by Hemiola SUN, later CPU & onemen
var TabmixTabbar = {
  visibleRows: 1,
  _windowStyle: {exist:false, value:null},
  _heights: [],
  _rowHeight: null,
  hideMode: 0,
  position: 0,
  SCROLL_BUTTONS_HIDDEN: 0,
  SCROLL_BUTTONS_LEFT_RIGHT: 1,
  SCROLL_BUTTONS_MULTIROW: 2,
  SCROLL_BUTTONS_RIGHT: 3,

  set flowing(val) {
    Tabmix.setItem(gBrowser.tabContainer, "flowing", val);
    Tabmix.setItem(gBrowser.tabContainer.mTabstrip, "flowing", val);

    // update our broadcaster
    Tabmix.setItem("tabmix_flowing", "flowing", val);
    // we have to set orient attribute for Linux theme,
    // maybe other themes need it for display the scroll arrow
    Tabmix.setItem("tabmixScrollBox", "orient", val == "multibar" ? "vertical" : "horizontal");
    return val;
  },

  get flowing() {
    return gBrowser.tabContainer.getAttribute("flowing");
  },

  get isMultiRow() {
    return this.flowing == "multibar";
  },

  isButtonOnTabsToolBar: function(button) {
    return button && button.parentNode == document.getElementById("TabsToolbar");
  },

  // get privateTab-toolbar-openNewPrivateTab, when the button is on the tabbar
  newPrivateTabButton: function() {
    let button = document.getElementById("privateTab-toolbar-openNewPrivateTab");
    return this.isButtonOnTabsToolBar(button) ? button : null;
  },

  updateSettings: function TMP_updateSettings(start) {
    if (!gBrowser || Tabmix.prefs.prefHasUserValue("setDefault"))
      return;

    var tabBar = gBrowser.tabContainer;
    var tabStrip = tabBar.mTabstrip;

    var tabscroll = Tabmix.prefs.getIntPref("tabBarMode");
    if (document.documentElement.getAttribute("chromehidden").indexOf("toolbar") != -1)
      tabscroll = 1;

    if (tabscroll < 0 || tabscroll > 3 ||
        (tabscroll != this.SCROLL_BUTTONS_LEFT_RIGHT &&
        Tabmix.extensions.verticalTabBar)) {
      Tabmix.prefs.setIntPref("tabBarMode", 1);
      return;
    }
    var prevTabscroll = start ? -1 : this.scrollButtonsMode;
    this.scrollButtonsMode = tabscroll;
    var isMultiRow = tabscroll == this.SCROLL_BUTTONS_MULTIROW;

    var currentVisible = start ? true : Tabmix.tabsUtils.isElementVisible(gBrowser.mCurrentTab);

    if (prevTabscroll != tabscroll) {
      // update pointer to the button object that we are going to use
      let useTabmixButtons = tabscroll > this.SCROLL_BUTTONS_LEFT_RIGHT;
      let overflow = Tabmix.tabsUtils.overflow;

      // from Firefox 4.0+ on we add dynamicly scroll buttons on TabsToolbar.
      let tabmixScrollBox = document.getElementById("tabmixScrollBox");
      if (tabmixScrollBox) // just in case our box is missing
        Tabmix.tabsUtils.updateScrollButtons(useTabmixButtons);

      if (isMultiRow || prevTabscroll == this.SCROLL_BUTTONS_MULTIROW) {
        // temporarily hide vertical scroll button.
        // visible button can interfere with row height calculation.
        // remove the collapsed attribut after updateVerticalTabStrip
        Tabmix.setItem(tabmixScrollBox, "collapsed", true);
      }

      let flowing = ["singlebar", "scrollbutton", "multibar", "scrollbutton"][tabscroll];
      this.flowing = flowing;
      let isDefault = tabscroll == this.SCROLL_BUTTONS_LEFT_RIGHT || null;
      Tabmix.setItem(tabBar, "defaultScrollButtons", isDefault);
      Tabmix.setItem(tabmixScrollBox, "defaultScrollButtons", isDefault);

      if (prevTabscroll == this.SCROLL_BUTTONS_MULTIROW) {
        tabBar.mTabstrip.resetFirstTabInRow();
        Tabmix.tabsUtils.updateVerticalTabStrip(true);
      }
      else if (isMultiRow && overflow) {
        // if we are in overflow in one line we will have more then one line
        // in multi-row. we try to prevent extra over/underflow events by setting
        // the height in front.
        tabStrip.orient = "vertical";
        if (Tabmix.tabsUtils.updateVerticalTabStrip() == "scrollbar")
          Tabmix.tabsUtils.overflow = true;
      }
      Tabmix.setItem(tabmixScrollBox, "collapsed", null);

      tabBar._positionPinnedTabs();
      if (isMultiRow && TMP_tabDNDObserver.paddingLeft)
        TMP_tabDNDObserver.paddingLeft = Tabmix.getStyle(tabBar, "paddingLeft");
    }

    this.widthFitTitle = Tabmix.prefs.getBoolPref("flexTabs") &&
                    (tabBar.mTabMaxWidth != tabBar.mTabMinWidth);
    if (!Tabmix.extensions.verticalTabBar) {
      if (start) {
        // Don't change tabstip orient on start before sessionStore ends.
        // if we set orient to vertical before sessionStore finish
        // sessionStore don't select the selected tab from last session.
        setTimeout(function() {Tabmix.tabsUtils.setTabStripOrient();}, 0);
      }
      else
        Tabmix.tabsUtils.setTabStripOrient();
    }
    Tabmix.setItem(tabBar, "widthFitTitle", this.widthFitTitle || null);

    if (Tabmix.prefs.getIntPref("tabs.closeButtons") == 5 && this.widthFitTitle)
      Tabmix.prefs.setIntPref("tabs.closeButtons", 1);

    // fix bug in positioning the popup off screen or on the button when window
    // is not maximize or when tab bar is in the bottom
    Tabmix.setItem("alltabs-popup", "position",
           (window.windowState != window.STATE_MAXIMIZED || this.position == 1) ? "start_before" : "after_end");

    // for light weight themes
    Tabmix.setItem("main-window", "tabmix_lwt", isMultiRow || this.position == 1 || null);

    for (let i = 0; i < tabBar.childNodes.length; i++) {
      let aTab = tabBar.childNodes[i];
      // treeStyleTab code come after SessionManager... look in extensions.js
      TabmixSessionManager.updateTabProp(aTab);
    }

    if (tabBar.mCloseButtons == 5)
      tabBar.adjustTabstrip(true);

    // show on tabbar
    let tabstripClosebutton = Tabmix.isVersion(310) ?
        document.getElementById("tabmix-tabs-closebutton") :
        document.getElementById("tabs-closebutton");
    if (this.isButtonOnTabsToolBar(tabstripClosebutton))
      tabstripClosebutton.collapsed = Tabmix.prefs.getBoolPref("hideTabBarButton");
    let allTabsButton = document.getElementById("alltabs-button");
    if (this.isButtonOnTabsToolBar(allTabsButton))
      allTabsButton.collapsed = Tabmix.prefs.getBoolPref("hideAllTabsButton");
    Tabmix.setItem(tabBar, "tabBarSpace", Tabmix.prefs.getBoolPref("tabBarSpace") || null);
    this.setShowNewTabButtonAttr();

    var self = this;
    if (start)
      window.setTimeout(function TMP_updateSettings_onstart() {self.updateScrollStatus();}, 0);
    else
      this.updateScrollStatus();

    window.setTimeout( function TMP_updateSettings_adjustScroll(_currentVisible) {
        if (_currentVisible)
          gBrowser.ensureTabIsVisible(gBrowser.selectedTab);
        self.updateBeforeAndAfter();
    }, 50, currentVisible);
  },

  setShowNewTabButtonAttr: function() {
    let newTabButton = document.getElementById("new-tab-button");
    let showNewTabButton = Tabmix.prefs.getBoolPref("newTabButton") &&
        this.isButtonOnTabsToolBar(newTabButton);
    let position = Tabmix.prefs.getIntPref("newTabButton.position");
    gTMPprefObserver.setShowNewTabButtonAttr(showNewTabButton, position);
  },

  updateScrollStatus: function TMP_updateScrollStatus() {
    var tabBar = gBrowser.tabContainer;
    if (this.isMultiRow) {
      //XXX we only need setFirstTabInRow from here when tab width changed
      // so if widthFitTitle is false we need to call it if we actualy change the width
      // for other chases we need to call it when we change title
      if (tabBar.mTabstrip.orient == "vertical") {
        this.setFirstTabInRow();
        Tabmix.tabsUtils.updateVerticalTabStrip();
      }
      // with Australis overflow not always trigger when tab changed width
      else if (TabmixSvc.australis && !this.widthFitTitle) {
        tabBar.mTabstrip._enterVerticalMode();
        this.setFirstTabInRow();
      }
    }
    else
      Tabmix.tabsUtils.adjustNewtabButtonvisibility();
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
      return Tabmix.tabsUtils.tabstripInnerbox.getBoundingClientRect().height;
    return heights[2] / 2;
  },

  setHeight: function TMP_setHeight(aRows, aReset) {
    // don't do anything when the tabbar is hidden
    // by Print preview or others...
    if (gInPrintPreviewMode || !gBrowser.tabContainer.visible ||
        Tabmix.tabsUtils.inDOMFullscreen || FullScreen._isChromeCollapsed) {
      return;
    }

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
      Tabmix.tabsUtils.overflow = false;
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
      if (Tabmix.tabsUtils.tabstripInnerbox) {
        let height = Tabmix.tabsUtils.tabstripInnerbox.getBoundingClientRect().height;
        if (tabBar.getAttribute("multibar") == "scrollbar") {
          // We can get here if we switch to diffrent tabs position while in multibar
          let rowHeight = height/Tabmix.tabsUtils.lastTabRowNumber;
          newHeight = rowHeight * aRows;
        }
        else
          newHeight = height;
      }
      else
        newHeight = this.getRowHeight(tabsPosition) * aRows;

      this._heights[tabsPosition][aRows] = newHeight;
      if (fillRowsHeights || (aRows > 2 && typeof(this._heights[tabsPosition][aRows-1]) == "undefined")) {
        let rowHeight = newHeight / aRows;
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
    let tabsToolbar = document.getElementById("TabsToolbar");
    if (TabmixSvc.isMac && !Tabmix.isVersion(280)) {
      tabsToolbar.style.setProperty("height",newTabbarHeight + "px", "important");
    }
    // override fixed height set by theme to .tabbrowser-tabs class
    if (tabBar.boxObject.height < newTabbarHeight || tabBar.style.getPropertyValue("height")) {
      tabBar.style.setProperty("max-height",newTabbarHeight + "px", "important");
      tabBar.style.setProperty("height",newTabbarHeight + "px", "important");
    }
    if (tabsToolbar.boxObject.height < newTabbarHeight || tabsToolbar.style.getPropertyValue("height")) {
      tabsToolbar.style.setProperty("max-height",newTabbarHeight + "px", "important");
      tabsToolbar.style.setProperty("height",newTabbarHeight + "px", "important");
    }

    // experimental - for theme that put tababr above the menus
    // curently its only work with Vfox3 theme
    if (tabstrip.boxObject.y <= gNavToolbox.boxObject.y) {
      let skin = Services.prefs.getCharPref("general.skins.selectedSkin");
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
    gTMPprefObserver.updateTabbarBottomPosition();
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
    if (TabmixSvc.isMac) {
      document.getElementById("TabsToolbar").style.removeProperty("height");
    }
    gTMPprefObserver.updateTabbarBottomPosition();
  },

  _handleResize: function TMP__handleResize() {
    var tabBar = gBrowser.tabContainer;
    if (this.isMultiRow) {
      this.setFirstTabInRow();
      if (tabBar.mTabstrip.orient != "vertical")
        tabBar.mTabstrip._enterVerticalMode();
      else
        Tabmix.tabsUtils.updateVerticalTabStrip();

      if (this.position == 1)
        setTimeout(function(){Tabmix.tabsUtils.updateVerticalTabStrip();},0);

      this.updateBeforeAndAfter();
    }
    ///maybe we cad add this to the popupshing / or as css rule ?
    Tabmix.setItem("alltabs-popup", "position",
        (window.windowState != window.STATE_MAXIMIZED || this.position == 1) ? "start_before" : "after_end");
  },

  // Update positional attributes when we are in multi-row mode
  updateBeforeAndAfter: function TMP_updateBeforeAndAfter(onlyHoverAtt) {
    let tabBar = gBrowser.tabContainer;
    let multibar = tabBar.hasAttribute("multibar");
    let tabRow, topY;

    let numPinnedTabs = gBrowser._numPinnedTabs;
    let isSpecial = TabmixSvc.australis &&
        this.scrollButtonsMode != this.SCROLL_BUTTONS_MULTIROW &&
        numPinnedTabs > 0;
    // Firefox don't have beforeselected-visible attribute (bug 585558 didn't
    // include it), we add tabmix-beforeselected-visible here and use it for
    // Firefox with australis UI
    let updateAtt = function(tab, type, attrib, visible, prefix) {
      // special case is when scrollButtonsMode is in one row and
      // selected or hovered tab is last pinned or first non-pinned tab
      let isSpecialTab = function() {
        if (!tab || !isSpecial)
          return false;
        if (/^before/.test(attrib))
          return tab._tPos == numPinnedTabs - 1 ? "before" : false;
        return tab._tPos == numPinnedTabs ? "after" : false;
      };
      let getAttVal = function(val, hoverAttr) {
        if (!specialTab || hoverAttr && visible && /selected/.test(attrib))
          return val;
        return val ? "special" : val;
      };

      let removed = "tabmix-removed-" + attrib;
      let oldTab = Tabmix.tabsUtils._tabmixPositionalTabs[type];
      if (oldTab && tab != oldTab) {
        oldTab.removeAttribute("tabmix-" + attrib + "-visible");
        oldTab.removeAttribute(removed);
      }
      Tabmix.tabsUtils._tabmixPositionalTabs[type] = tab;
      let specialTab = isSpecialTab();
      if (tab && (TabmixSvc.australis && attrib == "beforeselected" ||
          multibar || tab.hasAttribute(removed) || specialTab)) {
        let sameRow = multibar ? tabRow == Tabmix.tabsUtils.getTabRowNumber(tab, topY) || null : true;
        Tabmix.setItem(tab, removed, !sameRow || null);
        Tabmix.setItem(tab, attrib, getAttVal(sameRow, true));
        if (visible)
          Tabmix.setItem(tab, prefix + attrib + "-visible", getAttVal(sameRow));
      }
    };

    if (tabBar._hoveredTab && !tabBar._hoveredTab.closing) {
      if (multibar) {
        topY = Tabmix.tabsUtils.topTabY;
        tabRow = Tabmix.tabsUtils.getTabRowNumber(tabBar._hoveredTab, topY);
      }
      updateAtt(tabBar._beforeHoveredTab, "beforeHoveredTab", "beforehovered");
      updateAtt(tabBar._afterHoveredTab, "afterHoveredTab", "afterhovered");
    }

    if (onlyHoverAtt)
      return;

    let selected = Tabmix.isVersion(390) && gBrowser._switcher ?
        gBrowser._switcher.visibleTab : tabBar.selectedItem;
    let prev = null, next = null;
    if (!selected.closing) {
      let visibleTabs = gBrowser.visibleTabs;
      if (!visibleTabs.length)
        return;
      let selectedIndex = visibleTabs.indexOf(selected);
      if (selectedIndex > 0)
        prev = visibleTabs[selectedIndex - 1];
      if (Tabmix.isVersion(220))
        next = tabBar._afterSelectedTab;
      else if (selectedIndex < visibleTabs.length - 1)
          next = visibleTabs[selectedIndex + 1];
    }

    if (multibar) {
      topY = topY || Tabmix.tabsUtils.topTabY;
      tabRow = Tabmix.tabsUtils.getTabRowNumber(selected, topY);
    }
    updateAtt(prev, "beforeSelectedTab", "beforeselected", TabmixSvc.australis, "tabmix-");
    updateAtt(next, "afterSelectedTab", "afterselected", Tabmix.isVersion(220), "");
  },

  getRowHeight: function TMP_getRowHeight(tabsPosition) {
    if (this._rowHeight && this._rowHeight[tabsPosition])
      return this._rowHeight[tabsPosition];

    var tabs = gBrowser.visibleTabs;

    var firstTab = tabs[0];
    var lastTab = Tabmix.visibleTabs.last;
    var topY = Tabmix.tabsUtils.topTabY;
    var lastTabRow = Tabmix.tabsUtils.lastTabRowNumber;
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
        var prev = Tabmix.visibleTabs.previous(lastTab);
        if (prev && Tabmix.tabsUtils.getTabRowNumber(prev, topY) == 1)
          return lastTab.boxObject.height;
        else
          newRowHeight = prev.baseY - firstTab.baseY;
      }
      else if (firstTab.getAttribute("selected") == "true") {
        // check if 2nd visible tab is in the 2nd row
        // (not likely that user set tab width to more then half screen width)
        var next = Tabmix.visibleTabs.next(firstTab);
        if (next && Tabmix.tabsUtils.getTabRowNumber(next, topY) == 2)
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

    var topY = Tabmix.tabsUtils.topTabY;
    return Tabmix.tabsUtils.getTabRowNumber(tab1, topY) ==
      Tabmix.tabsUtils.getTabRowNumber(tab2, topY);
  },

  setFirstTabInRow: function() {
    var tabBar = gBrowser.tabContainer;
    // call our tabstrip function only when we are in multi-row and
    // in overflow with pinned tabs
    if (this.isMultiRow && Tabmix.tabsUtils.overflow && tabBar.firstChild.pinned)
      tabBar.mTabstrip.setFirstTabInRow();
  },

  removeShowButtonAttr: function() {
    var tabBar = gBrowser.tabContainer;
    if ("__showbuttonTab" in tabBar) {
      tabBar.__showbuttonTab.removeAttribute("showbutton");
      delete tabBar.__showbuttonTab;
    }
  },

  get _real_numPinnedTabs() {
    var count = 0;
    for (let i = 0; i < gBrowser.tabs.length; i++) {
      let tab = gBrowser.tabs[i];
      if (!tab.pinned)
        break;
      if (!tab.closing)
        count++;
    }
    return count;
  }

}; // TabmixTabbar end

Tabmix.tabsUtils = {
  initialized: false,
  _tabmixPositionalTabs: {},

  get tabBar() {
    delete this.tabBar;
    return (this.tabBar = gBrowser.tabContainer);
  },

  get tabstripInnerbox() {
    delete this.tabstripInnerbox;
    let elm = document.getAnonymousElementByAttribute(
      this.tabBar.mTabstrip._scrollbox, "class", "box-inherit scrollbox-innerbox");
    return (this.tabstripInnerbox = elm);
  },

  get inDOMFullscreen() {
    return document.documentElement.hasAttribute("inDOMFullscreen");
  },

  events: ["MozMouseHittest", "dblclick", "click", "dragstart",
           "drop", "dragend", "dragexit"],

  init: function() {
    TMP_eventListener.toggleEventListener(this.tabBar, this.events, true, this);
    // add dragover event handler to TabsToolbar to capture dragging over
    // tabbar margin area, filter out events that are out of the tabbar
    this.tabBar.parentNode.addEventListener("dragover", this, true);
    if (!Tabmix.isVersion(310))
      Services.prefs.removeObserver("browser.tabs.closeButtons", this.tabBar._prefObserver);

    if (this.initialized) {
      Tabmix.log("initializeTabmixUI - some extension initialize tabbrowser-tabs binding again");
      this.initializeTabmixUI();
      return;
    }
    this.initialized = true;

    var tabbrowser = this.tabBar.tabbrowser;
    let tab = this.tabBar.firstChild;

    XPCOMUtils.defineLazyGetter(Tabmix, "rtl", function () {
      return window.getComputedStyle(tabbrowser, null).direction == "rtl";
    });
    XPCOMUtils.defineLazyGetter(Tabmix, "ltr", function () {return !Tabmix.rtl;});

    // don't set button to left side if it is not inside tab-content
    let button = document.getAnonymousElementByAttribute(tab, "anonid", "tmp-close-button") ||
        document.getAnonymousElementByAttribute(tab, "anonid", "close-button");
    Tabmix.defaultCloseButtons = button && button.parentNode.className == "tab-content";
    let onLeft = Tabmix.defaultCloseButtons && Tabmix.prefs.getBoolPref("tabs.closeButtons.onLeft");
    this.tabBar.setAttribute("closebuttons-side", onLeft ? "left" : "right");

    // mCloseButtons is not in firefox code sinc Firefox 31 bug 865826
    this.tabBar.mCloseButtons = Tabmix.prefs.getIntPref("tabs.closeButtons");
    this._keepLastTab = Tabmix.prefs.getBoolPref("keepLastTab");
    this.closeButtonsEnabled = Tabmix.prefs.getBoolPref("tabs.closeButtons.enable");
    this._tabmixPositionalTabs = {
      beforeSelectedTab: null, afterSelectedTab: null,
      beforeHoveredTab: null, afterHoveredTab: null
    };

    Tabmix.afterTabsButtonsWidth = [Tabmix.isVersion(280) ? 51.6 : 28];
    Tabmix.tabsNewtabButton =
      document.getAnonymousElementByAttribute(this.tabBar, "command", "cmd_newNavigatorTab");
    this._show_newtabbutton = "aftertabs";

    let attr = ["notpinned", "autoreload", "protected",
                "locked"].filter(function(att) {
                  return Tabmix.prefs.getBoolPref("extraIcons." + att);
                });
    if (attr.length)
      this.tabBar.setAttribute("tabmix_icons", attr.join(" "));

    Tabmix._debugMode = TabmixSvc.debugMode();

    // initialize first tab
    Tabmix._nextSelectedID = 1;
    TMP_eventListener.setTabAttribute(tab);
    tab.setAttribute("tabmix_selectedID", Tabmix._nextSelectedID++);
    tab.setAttribute("visited", true);
    Tabmix.setTabStyle(tab);
    TabmixTabbar.lockallTabs = Tabmix.prefs.getBoolPref("lockallTabs");
    if (TabmixTabbar.lockallTabs) {
      tab.setAttribute("locked", true);
      tab.tabmix_allowLoad = false;
    }
    if ("linkedBrowser" in tab)
      tablib.setLoadURIWithFlags(tab.linkedBrowser);

    Tabmix.initialization.run("beforeStartup", tabbrowser, this.tabBar);
  },

  onUnload: function() {
    if (!this.initialized)
      return;
    TMP_eventListener.toggleEventListener(this.tabBar, this.events, false, this);
    if (this.tabBar.parentNode)
      this.tabBar.parentNode.removeEventListener("dragover", this, true);
    delete this.tabstripInnerbox;
    this._tabmixPositionalTabs = null;
  },

  handleEvent: function(aEvent) {
    switch (aEvent.type) {
      case "MozMouseHittest":
        if (aEvent.button === 0 && (Tabmix.keyModifierDown || aEvent.detail > 0))
          aEvent.stopPropagation();
        break;
      case "dblclick":
        if (Tabmix.prefs.getBoolPref("tabbar.click_dragwindow") &&
            Tabmix.prefs.getBoolPref("tabbar.dblclick_changesize") &&
            !TabmixSvc.isMac && aEvent.target.localName == "tabs") {
          let displayAppButton = !(document.getElementById("titlebar") ||
                                   document.getElementById("appmenu-toolbar-button")).hidden;
          let tabsOnTop = !window.TabsOnTop || TabsOnTop.enabled;
          if (TabsInTitlebar.enabled ||
              (displayAppButton && tabsOnTop && this.tabBar.parentNode._dragBindingAlive))
            return;
        }
        TabmixTabClickOptions.onTabBarDblClick(aEvent);
        break;
      case "click":
        TabmixTabClickOptions.onTabClick(aEvent);
        break;
      case "dragstart":
        if (this.tabBar.useTabmixDragstart(aEvent))
          TMP_tabDNDObserver.onDragStart(aEvent);
        break;
      case "dragover":
        let target = aEvent.target.localName;
        if (target != "tab" && target != "tabs")
          return;
        if (this.tabBar.useTabmixDnD(aEvent))
          TMP_tabDNDObserver.onDragOver(aEvent);
        break;
      case "drop":
        if (this.tabBar.useTabmixDnD(aEvent))
          TMP_tabDNDObserver.onDrop(aEvent);
        break;
      case "dragend":
        if (this.tabBar.orient == "horizontal")
          TMP_tabDNDObserver.onDragEnd(aEvent);
        break;
      case "dragexit":
        if (this.tabBar.useTabmixDnD(aEvent))
          TMP_tabDNDObserver.onDragExit(aEvent);
        break;
    }
  },

  initializeTabmixUI: function() {
    // https://addons.mozilla.org/EN-US/firefox/addon/vertical-tabs/
    // verticalTabs 0.9.1+ is restartless.
    if (typeof VerticalTabs == "object" && !Tabmix.extensions.verticalTabs) {
      Tabmix.setItem("TabsToolbar", "collapsed", null);
      Tabmix.extensions.verticalTabs = true;
      Tabmix.extensions.verticalTabBar = true;
      TabmixTabbar.updateSettings();
    }

    // tabbrowser-tabs constructor reset first tab label to New Tab
    this.tabBar.tabbrowser.setTabTitle(this.tabBar.firstChild);
    let position = Tabmix.prefs.getIntPref("newTabButton.position");
    if (position !== 0)
      gTMPprefObserver.changeNewTabButtonSide(position);

    // need to add TabScope eventListener
    // need to find a way to do it for all extensions that add event to the tabstrip
    if ("TabScope" in window) {
      window.TabScope.uninit();
      window.TabScope.init();
    }

    TabmixTabbar.flowing = this.tabBar.getAttribute("flowing");
    this.setTabStripOrient();
    Tabmix.navToolbox.setScrollButtons(true);

    // fix incompatibility with Personal Titlebar extension
    // the extensions trigger tabbar binding reset on toolbars customize
    // we need to init our ui settings from here and again after customization
    if (Tabmix.navToolbox.customizeStarted) {
      TabmixTabbar.visibleRows = 1;
      TabmixTabbar.updateSettings(false);
      Tabmix.navToolbox.resetUI = true;
    }
  },

  updateVerticalTabStrip: function(aReset) {
    if (Tabmix.extensions.verticalTabBar || gInPrintPreviewMode ||
        this.inDOMFullscreen || FullScreen._isChromeCollapsed ||
        !this.tabBar.visible && TabmixTabbar.visibleRows == 1)
      return null;
    if (this._inUpdateVerticalTabStrip)
      return this.tabBar.getAttribute("multibar");
    this._inUpdateVerticalTabStrip = true;

    // we must adjustNewtabButtonvisibility before get lastTabRowNumber
    this.adjustNewtabButtonvisibility();
    // this.lastTabRowNumber is null when we hide the tabbar
    let rows = aReset || this.tabBar.childNodes.length == 1 ? 1 : (this.lastTabRowNumber || 1);

    let currentMultibar = this.tabBar.getAttribute("multibar") || null;
    let maxRow = Tabmix.prefs.getIntPref("tabBarMaxRow");
    // we need to check for the case that last row of tabs is empty and we still have hidden row on top
    // this can occur when we close last tab in the last row or when some tab changed width
    if (rows > 1 && rows - maxRow < 0 && this.overflow &&
        this.canScrollTabsLeft) {
      // try to scroll all the way up
      this.tabBar.mTabstrip.scrollByPixels((rows - maxRow) * this.tabBar.mTabstrip.singleRowHeight);
      // get lastTabRowNumber after the scroll
      rows = this.lastTabRowNumber;
    }

    let multibar;
    if (rows == 1)
      multibar = null; // removeAttribute "multibar"
    else if (rows > maxRow)
      [multibar, rows] = ["scrollbar", maxRow];
    else
      multibar = "true";

    if (currentMultibar != multibar) {
      Tabmix.setItem(this.tabBar, "multibar", multibar);
      Tabmix.setItem("TabsToolbar", "multibar", multibar);
    }

    this.setTabStripOrient();
    TabmixTabbar.setHeight(rows, aReset);

    if (this.tabBar.mTabstrip.orient == "vertical")
      this.overflow = multibar == "scrollbar";

    if (!this.overflow) {
      // prevent new-tab-button on the right from flickering when new tabs animate is on.
      if (this.disAllowNewtabbutton &&
          Services.prefs.getBoolPref("browser.tabs.animate")) {
        // after 250ms new tab is fully opened
        if (!this.adjustNewtabButtonTimeout) {
          let timeout = 250, callerName = Tabmix.callerName();
          if (callerName == "onxbloverflow") {
            let timeFromLastTabOpened = Date.now() - Tabmix._lastTabOpenedTime;
            if (timeFromLastTabOpened < 250)
              timeout = 0;
          }
          this.adjustNewtabButtonTimeout = setTimeout(function() {
            this.adjustNewtabButtonvisibility();
            this.adjustNewtabButtonTimeout = null;
          }.bind(this), timeout);
        }
      }
      else
        this.adjustNewtabButtonvisibility();
    }

    this._inUpdateVerticalTabStrip = false;
    return multibar;
  },

  setTabStripOrient: function() {
    // we can't set dispaly:block and orient=vertical when widthFitTitle is false
    // and we are in one row.
    let vertical = TabmixTabbar.isMultiRow &&
        (TabmixTabbar.widthFitTitle || this.tabBar.hasAttribute("multibar"));
    let tabstrip = this.tabBar.mTabstrip;
    Tabmix.setItem(tabstrip, "orient", vertical ? "vertical" : "horizontal");
    tabstrip._isRTLScrollbox = !vertical && Tabmix.rtl;
  },

  /**
   * check that we have enough room to show new tab button after the last tab
   * in the current row. we don't want the button to be on the next row when the
   * tab is on the current row
   */
  adjustNewtabButtonvisibility: function() {
    if (!TabmixTabbar.isMultiRow && this.tabBar.mTabstrip.orient == "vertical")
      return;

    if (!this.checkNewtabButtonVisibility) {
      this.showNewTabButtonOnSide(this.overflow, "right-side");
      return;
    }

    // when Private-tab enabled/disabled we need to reset
    // tabsNewtabButton and afterTabsButtonsWidth
    if (!Tabmix.tabsNewtabButton)
      Tabmix.getAfterTabsButtonsWidth();

    var lastTab = Tabmix.visibleTabs.last;
    // button is visible
    //         A: last tab and the button are in the same row:
    //            check if we have room for the button in this row
    //         B: last tab and the button are NOT in the same row:
    //            NG - hide the button
    if (!this.disAllowNewtabbutton) {
      let sameRow = TabmixTabbar.inSameRow(lastTab, Tabmix.tabsNewtabButton);
      if (sameRow) {
        let tabstripEnd = this.tabBar.mTabstrip.scrollBoxObject.screenX +
            this.tabBar.mTabstrip.scrollBoxObject.width;
        let buttonEnd = Tabmix.tabsNewtabButton.boxObject.screenX +
            Tabmix.tabsNewtabButton.boxObject.width;
        this.disAllowNewtabbutton = buttonEnd > tabstripEnd;
      }
      else
        this.disAllowNewtabbutton = true;
      return;
    }
    // button is NOT visible
    //         A: 2 last tabs are in the same row:
    //            check if we have room for the button in this row
    //         B: 2 last tabs are NOT in the same row:
    //            check if we have room for the last tab + button after
    //            previous to last tab.
    else {
      // ignor the case that this tab width is larger then the tabbar
      let previousTab = Tabmix.visibleTabs.previous(lastTab);
      if (!previousTab) {
        this.disAllowNewtabbutton = false;
        return;
      }

      // buttons that are not on TabsToolbar or not visible are null
      let newTabButtonWidth = function(aOnSide) {
        let width = 0, privatTabButton = TabmixTabbar.newPrivateTabButton();
        if (privatTabButton) {
          width += aOnSide ? privatTabButton.boxObject.width :
                   Tabmix.afterTabsButtonsWidth[1];
        }
        if (Tabmix.sideNewTabButton) {
          width += aOnSide ? Tabmix.sideNewTabButton.boxObject.width :
                   Tabmix.afterTabsButtonsWidth[0];
        }
        return width;
      };
      let tsbo = this.tabBar.mTabstrip.scrollBoxObject;
      let tsboEnd = tsbo.screenX + tsbo.width + newTabButtonWidth(true);
      if (TabmixTabbar.inSameRow(lastTab, previousTab)) {
        let buttonEnd = lastTab.boxObject.screenX + lastTab.boxObject.width +
            newTabButtonWidth();
        this.disAllowNewtabbutton = buttonEnd > tsboEnd;
        return;
      }
      else {
        let lastTabEnd = previousTab.boxObject.screenX +
            previousTab.boxObject.width + lastTab.boxObject.width;
        // both last tab and new tab button are in the next row
        if (lastTabEnd > tsboEnd)
          this.disAllowNewtabbutton = false;
        else
          this.disAllowNewtabbutton = lastTabEnd + newTabButtonWidth() > tsboEnd;
        return;
      }
    }
  },

  get disAllowNewtabbutton() {
    let toolbar = document.getElementById("TabsToolbar");
    return toolbar.getAttribute("tabmix-show-newtabbutton") == "temporary-right-side";
  },

  set disAllowNewtabbutton(val) {
    let newVal = this.overflow || val;
    this.showNewTabButtonOnSide(newVal, "temporary-right-side");
    return newVal;
  },

  get overflow() {
    return this.tabBar.hasAttribute("overflow");
  },

  set overflow(val) {
    // don't do anything if other extensions set orient to vertical
    // when we arn't use it.
    if (!TabmixTabbar.isMultiRow && this.tabBar.mTabstrip.orient == "vertical")
      return val;

    if (val != this.overflow) {
      let tabBar = this.tabBar;
      let tabstrip = tabBar.mTabstrip;
      if (val)
        tabBar.setAttribute("overflow", "true");
      else
        tabBar.removeAttribute("overflow");
      this.showNewTabButtonOnSide(val, "right-side");

      if (typeof tabstrip.updateOverflow == "function") {
        tabstrip.updateOverflow(val);
        // overflow/underflow handler from tabbrowser-arrowscrollbox binding
        if (val) {
          tabBar._positionPinnedTabs();
          if (Tabmix.isVersion(190))
            tabBar._handleTabSelect(false);
        }
        else {
          if (tabBar._lastTabClosedByMouse)
            tabBar._expandSpacerBy(tabstrip._scrollButtonDown.clientWidth);
          gBrowser._removingTabs.forEach(gBrowser.removeTab, gBrowser);
          tabBar._positionPinnedTabs();
        }
      }
    }
    return val;
  },

  showNewTabButtonOnSide: function(aCondition, aValue) {
    if (this._show_newtabbutton) {
      Tabmix.setItem("TabsToolbar", "tabmix-show-newtabbutton",
                     aCondition ? aValue : this._show_newtabbutton);
    }
  },

  get topTabY() {
    return this.tabstripInnerbox.getBoundingClientRect().top +
      Tabmix.getStyle(this.tabstripInnerbox, "paddingTop");
  },

  get lastTabRowNumber() {
    return this.getTabRowNumber(Tabmix.visibleTabs.last, this.topTabY);
  },

  getTabRowNumber: function(aTab, aTop) {
    var {top, height} = aTab ? aTab.getBoundingClientRect() : {};
    height = aTab ? aTab.boxObject.height : 0;
    if (!height) // don't panic
      return 1;
    // some theme add marginTop/marginBottom to tabs
    var cStyle = window.getComputedStyle(aTab, null);
    var marginTop = parseInt(cStyle["marginTop"]) || 0;
    var marginBottom = parseInt(cStyle["marginBottom"]) || 0;
    height += marginTop + marginBottom;

    var tabBottom = top - marginTop + height;
    return Math.round((tabBottom - aTop)/height);
  },

  get canScrollTabsLeft() {
    return !this.tabBar.mTabstrip._scrollButtonUp.disabled;
  },

  get canScrollTabsRight() {
    return !this.tabBar.mTabstrip._scrollButtonDown.disabled;
  },

  createTooltip: function(box) {
    let rows = this.lastTabRowNumber;
    let active = this.getTabRowNumber(gBrowser.selectedTab, this.topTabY);
    let rowsStr = TabmixSvc.getString("rowsTooltip.rowscount");
    let activeStr = TabmixSvc.getString("rowsTooltip.activetab");
    let tooltip = PluralForm.get(rows, rowsStr).replace("#1", rows) +
        "\n" + activeStr.replace("#1", active);
    box.label = tooltip;
  },

  isSingleRow: function(visibleTabs) {
    if (!this.tabBar.hasAttribute("multibar"))
      return true;
    // we get here when we are about to go to single row
    // one tab before the last is in the first row and we are closing one tab
    let tabs = visibleTabs || gBrowser.visibleTabs;
    return this.getTabRowNumber(tabs[tabs.length - 2], this.topTabY) == 1;
  },

  /**** gBrowser.tabContainer.mTabstrip helpers ****/
  /**
   * this function is here for the case restart-less extension override our
   * mTabstrip binding when Tabmix's uses its own scroll buttons
   */
  updateScrollButtons: function(useTabmixButtons) {
    let tabstrip = this.tabBar.mTabstrip;
    tabstrip._scrollButtonDown = useTabmixButtons ?
      tabstrip._scrollButtonDownRight :
      tabstrip._scrollButtonDownLeft || // fall back to original
      document.getAnonymousElementByAttribute(tabstrip, "anonid", "scrollbutton-down");
    this.tabBar._animateElement = tabstrip._scrollButtonDown;

    tabstrip._scrollButtonUp = useTabmixButtons ?
      tabstrip._scrollButtonUpRight :
      tabstrip._scrollButtonUpLeft || // fall back to original
      document.getAnonymousElementByAttribute(tabstrip, "anonid", "scrollbutton-up");
    tabstrip._updateScrollButtonsDisabledState();

    if (!Tabmix.isVersion(320)) {
      let overflow = this.overflow;
      tabstrip._scrollButtonUp.collapsed = !overflow;
      tabstrip._scrollButtonDown.collapsed = !overflow;
    }
  },

  isElementVisible: function(element) {
    if (!element || !element.parentNode || element.collapsed || element.hidden)
      return false;

    // pinned tabs are always visible
    if (element.pinned)
      return true;

    var [start, end] = this.tabBar.mTabstrip._startEndProps;
    var rect = this.tabBar.mTabstrip.scrollClientRect;
    var containerStart = rect[start];
    var containerEnd = rect[end];
    rect = element.getBoundingClientRect();
    var elementStart = rect[start];
    var elementEnd = rect[end];

    // we don't need the extra check with scrollContentRect
    // like in ensureElementIsVisible, the element will be invisible anyhow.
    if (elementStart < containerStart)
      return false;
    else if (containerEnd < elementEnd)
      return false;

    return true;
  }
};

Tabmix.visibleTabs = {
  get first() {
    var tabs = gBrowser.tabs;
    for (let i = 0; i < tabs.length; i++){
      let tab = tabs[i];
      if (!tab.hidden && !tab.closing)
        return tab;
    }
    return gBrowser.selectedTab;
  },

  get last() {
    // we only need the last visible tab,
    // find it directly instead of using gBrowser.tabContainer.visibleTabs
    var tabs = gBrowser.tabs;
    for (let i = tabs.length - 1; i >= 0; i--){
      let tab = tabs[i];
      if (!tab.hidden && !tab.closing)
        return tab;
    }
    return gBrowser.selectedTab;
  },

  previous: function (aTab) {
    var tabs = gBrowser.visibleTabs;
    var index = tabs.indexOf(aTab);
    if (--index > -1)
      return tabs[index];
    return null;
  },

  next: function (aTab) {
    var tabs = gBrowser.visibleTabs;
    var index = tabs.indexOf(aTab);
    if (index > -1 && ++index < tabs.length)
      return tabs[index];
    return null;
  },

  indexOf: function (aTab) {
    if (aTab)
      return gBrowser.visibleTabs.indexOf(aTab);
    return -1;
  }
};

// Function to catch changes to Tab Mix preferences and update existing windows and tabs
//
var gTMPprefObserver = {
  preventUpdate: false,
  init: function() {
    Tabmix.prefs.clearUserPref("setDefault");
    Tabmix.prefs.clearUserPref("PrefObserver.error");

    let addObserver = function(pref, condition) {
      if (condition)
        this.OBSERVING.push(pref);
    }.bind(this);
    addObserver("browser.warnOnRestart", !Tabmix.isVersion(200));
    addObserver("browser.tabs.autoHide", !Tabmix.isVersion(230));
    addObserver("layout.css.devPixelsPerPx", TabmixSvc.australis);
    addObserver("browser.tabs.onTop", !Tabmix.isVersion(290));
    addObserver("browser.tabs.closeButtons", !Tabmix.isVersion(310));
    addObserver("extensions.classicthemerestorer.closeonleft", Tabmix.extensions.ctr);

    try {
      // add Observer
      for (var i = 0; i < this.OBSERVING.length; ++i)
        Services.prefs.addObserver(this.OBSERVING[i], this, false);
    }
    catch(e) {
      Tabmix.log("prefs-Observer failed to attach:" + "\n" + e);
      Tabmix.prefs.setBoolPref("PrefObserver.error", true);
    }
  },

  OBSERVING: ["extensions.tabmix.",
              "browser.tabs.tabMinWidth",
              "browser.tabs.tabMaxWidth",
              "browser.tabs.tabClipWidth",
              "browser.sessionstore.max_tabs_undo",
              "browser.warnOnQuit",
              "browser.sessionstore.resume_from_crash",
              "browser.startup.page",
              "browser.link.open_newwindow.override.external",
              "browser.link.open_newwindow.restriction",
              "browser.link.open_newwindow",
              "browser.ctrlTab.previews"],

  // removes the observer-object from service -- called when the window is no longer open
  removeObservers: function() {
    let prefSvc = Services.prefs;
    for (var i = 0; i < this.OBSERVING.length; ++i)
      prefSvc.removeObserver(this.OBSERVING[i], this);
  },

 /**
  * Observer-function
  * subject: [wrapped nsISupports :: nsIPrefBranch], nsIPrefBranch Internal
  * topic: "changed"
  */
  observe: function TMP_pref_observer(subject, topic, prefName) {
    if (this.preventUpdate)
      return;
    // if we don't have a valid window (closed)
    if ( !(typeof(document) == 'object' && document) ) {
      this.removeObservers(); // remove the observer..
      return;  // ..and don't continue
    }

    var prefValue, value;
    switch (prefName) {
      case "extensions.tabmix.titlefrombookmark":
        TMP_Places.onPreferencChanged(Services.prefs.getBoolPref(prefName));
        break;
      case "extensions.tabmix.tabbar.click_dragwindow":
        document.getElementById("TabsToolbar")._dragBindingAlive = Services.prefs.getBoolPref(prefName);
        /* falls through */
      case "extensions.tabmix.tabbar.dblclick_changesize":
        let dragwindow = Tabmix.prefs.getBoolPref("tabbar.click_dragwindow");
        let changesize = Tabmix.prefs.getBoolPref("tabbar.dblclick_changesize");
        if (!dragwindow && changesize) {
          Tabmix.prefs.setBoolPref("tabbar.dblclick_changesize", false);
          changesize = !changesize;
        }
        TabmixTabClickOptions.toggleEventListener(dragwindow && !changesize);
        break;
      case "extensions.tabmix.lockallTabs":
        TabmixTabbar.lockallTabs = Services.prefs.getBoolPref(prefName);
        /* falls through */
      case "extensions.tabmix.lockAppTabs":
        if (!Tabmix.prefs.getBoolPref("updateOpenedTabsLockState"))
          break;
        let updatePinned = prefName == "extensions.tabmix.lockAppTabs";
        let lockAppTabs = Tabmix.prefs.getBoolPref("lockAppTabs");
        for (let i = 0; i < gBrowser.tabs.length; i++) {
          let tab = gBrowser.tabs[i];
          if (tab.pinned != updatePinned)
            continue; // only update for the appropriate tabs type
          // when user change settings to lock all tabs we always lock all tabs
          // regardless if they were lock and unlocked before by the user
          if (updatePinned ? lockAppTabs : TabmixTabbar.lockallTabs) {
            tab.setAttribute("locked", "true");
          }
          else {
            tab.removeAttribute("locked");
          }
          if (updatePinned) {
            tab.removeAttribute("_lockedAppTabs");
            tab.setAttribute("_locked", tab.hasAttribute("locked"));
          }
          else
            tab.removeAttribute("_locked");
          tab.linkedBrowser.tabmix_allowLoad = !tab.hasAttribute("locked");
          TabmixSvc.saveTabAttributes(tab, "_locked", false);
        }
        // force Sessionstore to save our changes
        TabmixSvc.SessionStore.saveStateDelayed(window);
        break;
      case "extensions.tabmix.extraIcons.autoreload":
      case "extensions.tabmix.extraIcons.protected":
      case "extensions.tabmix.extraIcons.locked":
      case "extensions.tabmix.extraIcons.notpinned":
        let addAtt = Services.prefs.getBoolPref(prefName);
        let name = prefName.substr(prefName.lastIndexOf(".") + 1);
        Tabmix.setAttributeList(gBrowser.tabContainer, "tabmix_icons", name, addAtt);
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
        TMP_ClosedTabs.setButtonType(Services.prefs.getBoolPref(prefName));
        break;
      case "extensions.tabmix.focusTab":
          Services.prefs.setBoolPref("browser.tabs.selectOwnerOnClose", Services.prefs.getIntPref(prefName) == 2);
        break;
      case "extensions.tabmix.hideIcons":
        this.setMenuIcons();
        break;
      // tab appearnce
      case "extensions.tabmix.currentTab":
      case "extensions.tabmix.unloadedTab":
      case "extensions.tabmix.unreadTab":
      case "extensions.tabmix.otherTab":
        this.updateTabsStyle(prefName.split(".").pop());
        break;
      case "extensions.tabmix.progressMeter":
        this.setProgressMeter();
        break;
      case "browser.tabs.tabMaxWidth":
      case "browser.tabs.tabMinWidth":
        var currentVisible = Tabmix.tabsUtils.isElementVisible(gBrowser.mCurrentTab);
        let tabMaxWidth = Math.max(16, Services.prefs.getIntPref("browser.tabs.tabMaxWidth"));
        let tabMinWidth = Math.max(16, Services.prefs.getIntPref("browser.tabs.tabMinWidth"));
        if (tabMaxWidth < tabMinWidth) {
          if (prefName == "browser.tabs.tabMaxWidth")
            tabMaxWidth = tabMinWidth;
          else
            tabMinWidth = tabMaxWidth;
        }
        gBrowser.tabContainer.mTabMaxWidth = tabMaxWidth;
        gBrowser.tabContainer.mTabMinWidth = tabMinWidth;
        this.dynamicRules["width"].style.setProperty("max-width", tabMaxWidth + "px", "important");
        this.dynamicRules["width"].style.setProperty("min-width", tabMinWidth + "px", "important");
        // fix bug in classiccompact
        if (typeof classiccompactoptions == "object" &&
            Services.prefs.getCharPref("general.skins.selectedSkin") == "classiccompact") {
          classiccompactoptions.setTabWidths(document);
        }
        TabmixTabbar.updateSettings(false);
        // we need this timeout when there are many tabs
        if (typeof this._tabWidthChanged == "undefined") {
          let self = this;
          this._tabWidthChanged = true;
          [50, 100, 250, 500].forEach(function (timeout) {
            setTimeout(function TMP_tabWidthChanged() {
              if (currentVisible)
                gBrowser.ensureTabIsVisible(gBrowser.selectedTab);
              TabmixTabbar.updateScrollStatus();
              if (timeout == 500)
                delete self._tabWidthChanged;
            }, timeout);
          });
        }
        break;
      case "browser.tabs.tabClipWidth":
        gBrowser.tabContainer.mTabClipWidth = Services.prefs.getIntPref(prefName);
        gBrowser.tabContainer.adjustTabstrip();
        break;
      case "extensions.tabmix.keepLastTab":
        Tabmix.tabsUtils._keepLastTab = Services.prefs.getBoolPref(prefName);
        gBrowser.tabContainer.adjustTabstrip();
        break;
      case "browser.tabs.closeButtons":
        value = Services.prefs.getIntPref(prefName);
        switch (value) {
          case 0: // Display a close button on the active tab only
            Tabmix.prefs.setIntPref("tabs.closeButtons", 3);
            break;
          case 1: // Display close buttons on all tabs (Default)
            Tabmix.prefs.setIntPref("tabs.closeButtons", 1);
            break;
          case 2: // Don’t display any close buttons
            break;
          case 3: // Display a single close button at the end of the tab strip
            break;
          default: // invalid value.... don't do anything
            return;
        }
        // show/hide close button on tabs
        Tabmix.prefs.setBoolPref("tabs.closeButtons.enable", value < 2);
        // show/hide close button on the tabbar
        Tabmix.prefs.setBoolPref("hideTabBarButton", value != 3);
        break;
      case "extensions.tabmix.tabs.closeButtons":
        value = Services.prefs.getIntPref(prefName);
        if (value < 1 || value > 5) {
          Services.prefs.setIntPref(prefName, 1);
        }
        else if (value == 5 && TabmixTabbar.widthFitTitle)
          Services.prefs.setIntPref(prefName, 1);
        else {
          gBrowser.tabContainer.mCloseButtons = Services.prefs.getIntPref(prefName);
          gBrowser.tabContainer.adjustTabstrip();
        }
        break;
      case "extensions.tabmix.tabs.closeButtons.onLeft":
      case "extensions.classicthemerestorer.closeonleft":
        // let Classic theme restorer control close tab button placement when
        // the default theme is in use.
        if (Tabmix.extensions.ctr &&
            Services.prefs.getCharPref("general.skins.selectedSkin") == "classic/1.0") {
          let otherPref = prefName == "extensions.tabmix.tabs.closeButtons.onLeft" ?
                                      "extensions.classicthemerestorer.closeonleft" :
                                      "extensions.tabmix.tabs.closeButtons.onLeft";
          value = Services.prefs.getBoolPref(prefName);
          if (Services.prefs.getBoolPref(otherPref) != value)
            Services.prefs.setBoolPref(otherPref, Services.prefs.getBoolPref(prefName));
          Tabmix.setItem(gBrowser.tabContainer, "closebuttons-side", "right");
          break;
        }
        let onLeft = Tabmix.defaultCloseButtons && Services.prefs.getBoolPref(prefName);
        gBrowser.tabContainer.setAttribute("closebuttons-side", onLeft ? "left" : "right");
        break;
      case "extensions.tabmix.tabs.closeButtons.enable":
        prefValue = Services.prefs.getBoolPref(prefName);
        Tabmix.tabsUtils.closeButtonsEnabled = prefValue;
        gBrowser.tabContainer.mTabstrip.offsetRatio = prefValue ? 0.70 : 0.50;
        gBrowser.tabContainer.adjustTabstrip();
        break;
      case "extensions.tabmix.tabBarPosition":
         if (this.tabBarPositionChanged(Services.prefs.getIntPref(prefName))) {
           if (window.fullScreen) {
             TMP_eventListener.onFullScreen(true);
             let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
             if (bottomToolbox)
               TMP_eventListener.toggleTabbarVisibility(false);
           }
           TabmixTabbar.updateSettings(false);
         }
        break;
      case "extensions.tabmix.undoClose":
        if (!Tabmix.prefs.getBoolPref("undoClose")) {
          Services.prefs.setIntPref("browser.sessionstore.max_tabs_undo", 0);
        }
        else if (Services.prefs.getIntPref("browser.sessionstore.max_tabs_undo") === 0)
          Services.prefs.clearUserPref("browser.sessionstore.max_tabs_undo");
        break;
      case "browser.sessionstore.max_tabs_undo":
        // Firefox's sessionStore mainain the right amount
        prefValue = Services.prefs.getIntPref(prefName);
        if (Tabmix.prefs.getBoolPref("undoClose") != (prefValue > 0))
          Tabmix.prefs.setBoolPref("undoClose", prefValue > 0);
        let state = prefValue === 0 || undefined;
        TMP_ClosedTabs.setButtonDisableState(state);
        break;
      case "browser.warnOnRestart":
      case "browser.warnOnQuit":
      case "browser.sessionstore.resume_from_crash":
        if (!Services.prefs.getBoolPref(prefName))
          return;

        var TMP_sessionManager_enabled = Tabmix.prefs.getBoolPref("sessions.manager") ||
                         Tabmix.prefs.getBoolPref("sessions.crashRecovery");
        if (TMP_sessionManager_enabled)
          Services.prefs.setBoolPref(prefName, false);
        break;
      case "browser.startup.page":
        if (Services.prefs.getIntPref(prefName) != 3)
          return;
        TMP_sessionManager_enabled = Tabmix.prefs.getBoolPref("sessions.manager") ||
                         Tabmix.prefs.getBoolPref("sessions.crashRecovery");

        if (TMP_sessionManager_enabled)
          Services.prefs.setIntPref(prefName, 1);
        break;
      case "extensions.tabmix.sessions.manager":
      case "extensions.tabmix.sessions.crashRecovery":
        TMP_SessionStore.setService(2, false);
        /* falls through */
      case "extensions.tabmix.sessions.save.closedtabs":
      case "extensions.tabmix.sessions.save.history":
      case "extensions.tabmix.sessionToolsMenu":
      case "extensions.tabmix.closedWinToolsMenu":
        TabmixSessionManager.updateSettings();
        break;
      case "extensions.tabmix.sessions.save.permissions":
        for (let i = 0; i < gBrowser.tabs.length; i++)
          TabmixSessionManager.updateTabProp(gBrowser.tabs[i]);
        break;
      case "extensions.tabmix.optionsToolMenu":
        document.getElementById("tabmix-menu").hidden = !Services.prefs.getBoolPref(prefName);
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
        this.changeNewTabButtonSide(Services.prefs.getIntPref(prefName));
        break;
      case "browser.ctrlTab.previews":
      case "extensions.tabmix.lasttab.tabPreviews":
      case "extensions.tabmix.lasttab.respondToMouseInTabList":
      case "extensions.tabmix.lasttab.showTabList":
        TMP_LastTab.ReadPreferences();
        break;
      case "extensions.tabmix.reloadEvery.onReloadButton":
        this.showReloadEveryOnReloadButton();
        break;
      case "extensions.tabmix.tabBarMaxRow":
          var tabBar = gBrowser.tabContainer;
          let row = Tabmix.prefs.getIntPref("tabBarMaxRow");
          if (row < 2) {
            Tabmix.prefs.setIntPref("tabBarMaxRow", 2);
            return;
          }
          // maxRow changed
          if (TabmixTabbar.isMultiRow) {
            let isVisible = Tabmix.tabsUtils.isElementVisible(gBrowser.mCurrentTab);
            // we hide the button to see if tabs can fits to fewer rows without the scroll buttons
            if (Tabmix.tabsUtils.overflow && row > TabmixTabbar.visibleRows)
              Tabmix.tabsUtils.overflow = false;
            // after we update the height check if we are still in overflow
            if (Tabmix.tabsUtils.updateVerticalTabStrip() == "scrollbar") {
              Tabmix.tabsUtils.overflow = true;
              tabBar.mTabstrip._updateScrollButtonsDisabledState();
              if (isVisible)
                gBrowser.ensureTabIsVisible(gBrowser.selectedTab, false);
            }
          }
          TabmixTabbar.updateBeforeAndAfter();
        break;
      case "extensions.tabmix.pinnedTabScroll":
        gBrowser.tabContainer._positionPinnedTabs();
        break;
      case "extensions.tabmix.offsetAmountToScroll":
          gBrowser.tabContainer.mTabstrip.offsetAmountToScroll = Services.prefs.getBoolPref(prefName);
        break;
      case "browser.tabs.onTop":
        if (TabmixTabbar.position == 1 && Services.prefs.getBoolPref(prefName)) {
          Services.prefs.setBoolPref(prefName, false);
          return;
        }
        // multi-rows total heights can be diffrent when tabs are on top
        if (TabmixTabbar.visibleRows > 1) {
          TabmixTabbar.setHeight(1, true);
          Tabmix.tabsUtils.updateVerticalTabStrip();
        }
        break;
      case "extensions.tabmix.hideTabBarButton":
      case "extensions.tabmix.tabBarMode":
      case "extensions.tabmix.tabBarSpace":
      case "extensions.tabmix.hideAllTabsButton":
      case "extensions.tabmix.newTabButton":
      case "extensions.tabmix.flexTabs":
      case "extensions.tabmix.setDefault":
        TabmixTabbar.updateSettings(false);
        break;
      case "extensions.tabmix.moveTabOnDragging":
        gBrowser.tabContainer.moveTabOnDragging = Services.prefs.getBoolPref(prefName);
        break;
      case "layout.css.devPixelsPerPx":
        setTimeout(function(self) {self.setBgMiddleMargin();},0, this);
        break;
      case "extensions.tabmix.showTabContextMenuOnTabbar":
        TabmixContext.updateTabbarContextMenu(Services.prefs.getBoolPref(prefName));
        break;
      default:
        break;
    }

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

  _tabStyleSheet: null,
  get tabStyleSheet() {
    var href = "chrome://tabmixplus/skin/tab.css";
    // find tab.css to insert our dynamic rules into it.
    // insert our rules into document.styleSheets[0] cause problem with other extensions
    if (!this._tabStyleSheet || this._tabStyleSheet.href != href) {
      let ss = this.getStyleSheets(href, true);
      this._tabStyleSheet = ss.length ? ss[0] : document.styleSheets[1];
    }
    return this._tabStyleSheet;
  },

  dynamicRules: {},
  insertRule: function(cssText, name) {
    let index = this.tabStyleSheet.insertRule(cssText,
        this.tabStyleSheet.cssRules.length);
    if (name)
      this.dynamicRules[name] = this.tabStyleSheet.cssRules[index];
    return index;
  },

  setTabIconMargin: function TMP_PO_setTabIconMargin() {
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
                           '-moz-margin-start: %S; -moz-margin-end: %S;}'
                           .replace("%S", marginStart).replace("%S", marginEnd);
    this.insertRule(iconRule);

    /** at the moment we move the button over the title - see setCloseButtonMargin
    // move left button that show on hover closer to the tab icon
    iconRule = '.tabbrowser-tabs[closebuttons-hover="notactivetab"][closebuttons-side="left"] > ' +
               '.tabbrowser-tab:not([pinned]):not([faviconized="true"]):not([selected="true"])' +
               ':not([isPermaTab="true"]):not([protected])[showbutton=on] .tab-icon,' +
               '.tabbrowser-tabs[closebuttons-hover="alltabs"][closebuttons-side="left"] > ' +
               '.tabbrowser-tab:not([pinned]):not([faviconized="true"]):not([isPermaTab="true"])' +
               ':not([protected])[showbutton=on] .tab-icon {' +
               '-moz-margin-end: %Spx;}'.replace("%S", - parseInt(marginEnd)/2);
    this.insertRule(iconRule);
    */

    icon.setAttribute("pinned", true);
    let _marginStart = style.getPropertyValue(sMarginStart);
    let _marginEnd = style.getPropertyValue(sMarginEnd);
    let _selector = '.tab-icon[pinned] > ';
    let _iconRule = _selector + '.tab-protect-icon,' +
                         _selector + '.tab-reload-icon,' +
                         _selector + '.tab-lock-icon {' +
                         '-moz-margin-start: %S; -moz-margin-end: %S;}'
                         .replace("%S", _marginStart).replace("%S", _marginEnd);
    this.insertRule(_iconRule);
    if (!pinned)
      icon.removeAttribute("pinned");

   /**
    *  set smaller left margin for the tab icon when the close button is on the left side
    *  only do it if start margin is bigger then end margin
    */
    if (parseInt(marginStart) < parseInt(marginEnd))
      return;

    let tabmix_setRule = function(aRule) {
      let newRule = aRule.replace(/%S/g, "tab-icon-image").replace("%PX", marginEnd);
      this.insertRule(newRule);
      newRule = aRule.replace(/%S/g, "tab-lock-icon").replace("%PX", marginEnd);
      this.insertRule(newRule);
    }.bind(this);
    iconRule = '.tabbrowser-tabs%favhideclose%[closebuttons-side="left"][closebuttons="alltabs"] > ' +
               '.tabbrowser-tab:not([pinned]):not([protected])%faviconized% .%S ,' +
               '.tabbrowser-tabs%favhideclose%[closebuttons-side="left"][closebuttons="activetab"] > ' +
               '.tabbrowser-tab:not([pinned]):not([protected])[selected="true"]%faviconized% .%S {' +
               '-moz-margin-start: %PX !important;}';
    if ("faviconize" in window) {
      let newRule = iconRule.replace(/%favhideclose%/g, ':not([favhideclose="true"])').replace(/%faviconized%/g, '');
      tabmix_setRule(newRule);
      newRule = iconRule.replace(/%favhideclose%/g, '[favhideclose="true"]')
                .replace(/%faviconized%/g, ':not([faviconized="true"])');
      tabmix_setRule(newRule);
    }
    else {
      let newRule = iconRule.replace(/%favhideclose%/g, '').replace(/%faviconized%/g, '');
      tabmix_setRule(newRule);
    }
  },

  setCloseButtonMargin: function TMP_PO_setCloseButtonMargin() {
    var sMarginEnd = Tabmix.rtl ? "margin-left" : "margin-right";
    var icon = document.getAnonymousElementByAttribute(gBrowser.mCurrentTab, "anonid", "tmp-close-button");
    if (!icon)
      return; // nothing to do....

    // move left button that show on hover over tab title
    icon.style.setProperty("display", "-moz-box", "important");
    let iconMargin = '.tabbrowser-tabs[closebuttons-hover="notactivetab"][closebuttons-side="left"] > ' +
                     '.tabbrowser-tab:not([pinned]):not([faviconized="true"]):not([selected="true"])' +
                     ':not([isPermaTab="true"]):not([protected]) .tab-close-button,' +
                     '.tabbrowser-tabs[closebuttons-hover="alltabs"][closebuttons-side="left"] > ' +
                     '.tabbrowser-tab:not([pinned]):not([faviconized="true"]):not([isPermaTab="true"])' +
                     ':not([protected]) .tab-close-button {' +
                     '-moz-margin-start: 0px !important;' +
                     '-moz-margin-end: %Spx !important;}'.replace("%S", - icon.getBoundingClientRect().width);
    icon.style.removeProperty("display");
    this.insertRule(iconMargin);

    // set right margin to tab-label when close button is not right to it
    // on default theme the margin is zero, so we set the end margin to be the same as the start margin
    let style = window.getComputedStyle(icon, null);
    let marginEnd = style.getPropertyValue(sMarginEnd);
    let textMarginEnd = parseInt(marginEnd) ? marginEnd : this._marginStart;
    delete this._marginStart;
             let iconRule = '.tabbrowser-tabs%favhideclose%[closebuttons="noclose"] > ' +
                            '.tabbrowser-tab%faviconized%:not([pinned]) .tab-label[tabmix="true"],' +
                            '.tabbrowser-tabs%favhideclose%[closebuttons-side="left"] > ' +
                            '.tabbrowser-tab%faviconized%:not([pinned]) .tab-label[tabmix="true"],' +
                            '.tabbrowser-tabs%favhideclose%[closebuttons="activetab"]' +
                            ':not([closebuttons-hover="notactivetab"])[closebuttons-side="right"] > ' +
                            '.tabbrowser-tab%faviconized%:not([pinned]):not([selected="true"]) ' +
                            '.tab-label[tabmix="true"],' +
                            '.tabbrowser-tab%faviconized1%[protected]:not([pinned]) .tab-label[tabmix="true"] {' +
                            '-moz-margin-end: %PX !important;}'.replace("%PX", textMarginEnd);
    if ("faviconize" in window) {
      let newRule = iconRule.replace(/%favhideclose%/g, ':not([favhideclose="true"])')
                            .replace(/%faviconized%/g, '')
                            .replace(/%faviconized1%/g, ':not([faviconized="true"])');
      this.insertRule(newRule);
      newRule = iconRule.replace(/%favhideclose%/g, '[favhideclose="true"]')
                        .replace(/%faviconized%/g, ':not([faviconized="true"])')
                        .replace(/%faviconized1%/g, ':not([faviconized="true"])');
      this.insertRule(newRule);
      newRule = '.tabbrowser-tab[faviconized="true"][protected]:not([pinned]) {max-width: 36px !important;}';
      this.insertRule(newRule);
    }
    else {
      let newRule = iconRule.replace(/%favhideclose%/g, '')
                            .replace(/%faviconized%/g, '').replace(/%faviconized1%/g, '');
      this.insertRule(newRule);
    }
  },

  miscellaneousRules: function TMP_PO_miscellaneousRules() {
    // with Walnut theme we get wrong height on Firefox 36
    if (Tabmix._buttonsHeight > 50) {
      let skin = Services.prefs.getCharPref("general.skins.selectedSkin");
      Tabmix._buttonsHeight = skin == "walnut" ? 19 : 23;
    }

    /* tab-icon-overlay added by Bug 1112304, Firefox 38+ */
    if (!Tabmix.isVersion(380))
      this.insertRule('.tab-icon-overlay {display: none;}');

    /* tab-icon-sound added by Bug 486262, Firefox 42+ */
    if (!Tabmix.isVersion(420)) {
      this.insertRule('.tab-icon-sound {display: none;}');
    }

    // height shrink to actual size when the tabbar is in display: block (multi-row)
    let newRule = '#TabsToolbar[tabmix-show-newtabbutton*="aftertabs"] >' +
                  '#tabbrowser-tabs:not([overflow="true"]) > .tabbrowser-arrowscrollbox[flowing="multibar"]' +
                  ' > .tabs-newtab-button[command="cmd_newNavigatorTab"] {height: #px;}'
                  .replace("#", Tabmix._buttonsHeight);
    this.insertRule(newRule);

    if (TabmixSvc.australis && !Tabmix.isVersion(310) && !TabmixSvc.isLinux && !TabmixSvc.isMac) {
      newRule = '#main-window[privatebrowsingmode=temporary] #private-browsing-indicator {' +
                '  height: #px;'.replace("#", Tabmix._buttonsHeight) +
                '}';
      this.insertRule(newRule);
    }

    if (TabmixSvc.isMac && !TabmixSvc.australis)
      Tabmix._buttonsHeight = 24;

    newRule = '#tabmixScrollBox[flowing="multibar"] > toolbarbutton {' +
      '  height: #px;}'.replace("#", Tabmix._buttonsHeight);
    this.insertRule(newRule);

    let _buttonsHeight = Tabmix.isVersion(310) ? Tabmix._buttonsHeight - 1 : Tabmix._buttonsHeight;
    newRule = '#TabsToolbar[multibar] > .toolbarbutton-1 {' +
      '  height: #px;}'.replace("#", _buttonsHeight);
    this.insertRule(newRule);
    delete Tabmix._buttonsHeight;

    // we don't show icons on menu on Mac OS X
    if (TabmixSvc.isMac)
      return;

    // new tab button on tab context menu
    newRule = '.tabmix-newtab-menu-icon {' +
              'list-style-image: url("#URL");' +
              '-moz-image-region: #REGION;}';
    let url = "chrome://browser/skin/Toolbar.png", region;
    let skin = Services.prefs.getCharPref("general.skins.selectedSkin");
    if (skin=="classic/1.0") {
      if (TabmixSvc.isLinux)
        region = TabmixSvc.australis ? "rect(0px, 360px, 18px, 342px)" :
                                       "rect(0px, 96px, 24px, 72px)";
      else
        region = TabmixSvc.australis ? "rect(0px, 360px, 18px, 342px)" :
                                       "rect(0pt, 180px, 18px, 162px)";
    }
    else
      [url, region] = ["newtab.png", "auto"];
    this.insertRule(newRule.replace("#URL", url).replace("#REGION", region));

    if (!TabmixSvc.australis)
      return;

    // Workaround bug 943308 - tab-background not fully overlap the tab curves
    // when layout.css.devPixelsPerPx is not 1.
    let selectedTab = Tabmix.isVersion(390) && gBrowser._switcher ?
        gBrowser._switcher.visibleTab : gBrowser.selectedTab;
    let bgMiddle = document.getAnonymousElementByAttribute(selectedTab, "class", "tab-background-middle");
    let margin = (-parseFloat(window.getComputedStyle(bgMiddle).borderLeftWidth)) + "px";
    let bgMiddleMargin = this.dynamicRules["bgMiddleMargin"];
    if (bgMiddleMargin) {
      bgMiddleMargin.style.MozMarginStart = margin;
      bgMiddleMargin.style.MozMarginEnd = margin;
    }
    else {
      let newRule = '.tab-background-middle, .tab-background, .tabs-newtab-button {' +
                    '-moz-margin-end: %PX; -moz-margin-start: %PX;}';
      this.insertRule(newRule.replace(/%PX/g, margin), "bgMiddleMargin");
    }
  },

  addDynamicRules: function() {
    // tab width rules
    let tst = Tabmix.extensions.treeStyleTab ? ":not([treestyletab-collapsed='true'])" : "";
    let newRule = ".tabbrowser-tab[fadein]" + tst +
                  ":not([pinned]) {min-width: #1px !important; max-width: #2px !important;}";
    let _max = Services.prefs.getIntPref("browser.tabs.tabMaxWidth");
    let _min = Services.prefs.getIntPref("browser.tabs.tabMinWidth");
    newRule = newRule.replace("#1" ,_min).replace("#2" ,_max);
    this.insertRule(newRule, "width");

    // rule for controling moz-margin-start when we have pinned tab in multi-row
    let marginStart = '#tabbrowser-tabs[positionpinnedtabs] > ' +
                      '.tabbrowser-tab[tabmix-firstTabInRow="true"]{-moz-margin-start: 0px;}';
    this.insertRule(marginStart, "tabmix-firstTabInRow");

    // for ColorfulTabs 8.0+
    // add new rule to adjust selected tab bottom margin
    // we add the rule after the first tab added
    if (typeof colorfulTabs == "object") {
      let padding = Tabmix.getStyle(gBrowser.tabs[0], "paddingBottom");
      let newRule = '#tabbrowser-tabs[flowing="multibar"] > .tabbrowser-tab[selected=true]' +
                    ' {margin-bottom: -1px !important; padding-bottom: ' + (padding + 1) + 'px !important;}';
      let index = this.insertRule(newRule);
      newRule = this._tabStyleSheet.cssRules[index];
      gBrowser.tabContainer.addEventListener("TabOpen", function TMP_addStyleRule(aEvent) {
        gBrowser.tabContainer.removeEventListener("TabOpen", TMP_addStyleRule, true);
        let padding = Tabmix.getStyle(aEvent.target, "paddingBottom");
        newRule.style.setProperty("padding-bottom", (padding + 1) + "px", "important");
      }, true);
    }
  },

  updateTabsStyle: function(ruleName) {
    let attribValue = null;
    let styleName = ruleName.replace("Tab", "");
    let enabled = Tabmix.prefs.getBoolPref(ruleName);
    if (enabled) {
      let prefValues = TabmixSvc.tabStylePrefs[ruleName];
      // set bold, italic and underline only when we control the sytle
      // to override theme default rule if exist
      attribValue = [prefValues.bold ? "bold" : "not-bold",
               prefValues.italic ? "italic" : "not-italic",
               prefValues.underline ? "underline" : "not-underline"
      ];
      if (prefValues.text)
        attribValue.push("text");
      if (prefValues.bg) {
        attribValue.push("bg");
        if (TabmixSvc.australis && !Tabmix.extensions.treeStyleTab)
          attribValue.push("aus");
      }
      attribValue = attribValue.join(" ");
    }

    let tabBar = gBrowser.tabContainer;
    let currentAttrib = tabBar.getAttribute("tabmix_" + styleName + "Style") || "";
    Tabmix.setItem(tabBar, "tabmix_" + styleName + "Style", attribValue);

    /** style on non-selected tab are unloaded, unread or other, unloaded and
     *  unread are only set on tab if the corresponded preference it on. if user
     *  changed unloaded or unread preference we need to set the proper tab
     *  style for each tab
     */
    if (styleName == "unloaded" || styleName == "unread")
      Array.forEach(gBrowser.tabs, function(tab) Tabmix.setTabStyle(tab));

    let isBold = function(attrib) {
      attrib = attrib.split(" ");
      return attrib.length > 1 && attrib.indexOf("not-bold") == -1;
    };
    // changing bold attribute can change tab width and effect tabBar scroll status
    // also when we turn off unloaded, unread and other style diffrent style can take
    // control with a diffrent bold attribute
    if (isBold(attribValue || "") != isBold(currentAttrib)) {
      TabmixTabbar.updateScrollStatus();
      TabmixTabbar.updateBeforeAndAfter();
    }
  },

  setProgressMeter: function () {
    var showOnTabs = Tabmix.prefs.getBoolPref("progressMeter");
    var attribValue = null;
    if (showOnTabs)
      attribValue = TabmixSvc.tabStylePrefs["progressMeter"].bg ? "userColor" : "defaultColor";
    Tabmix.setItem(gBrowser.tabContainer, "tabmix_progressMeter", attribValue);
    TabmixProgressListener.listener.showProgressOnTab = showOnTabs;
  },

  setLink_openPrefs: function() {
    if (!Tabmix.singleWindowMode)
      return;

    function updateStatus(pref, testVal, test, newVal) {
      try {
        var prefValue = Services.prefs.getIntPref(pref);
        test = test ? prefValue == testVal : prefValue != testVal;
      }
      catch(e){ test = true; }

      if (test)
        Services.prefs.setIntPref(pref, newVal);
    }

    updateStatus("browser.link.open_newwindow", 2, true, 3);
    updateStatus("browser.link.open_newwindow.override.external", 2, true, 3);
    updateStatus("browser.link.open_newwindow.restriction", 0, false, 0);
  },

  // code for Single Window Mode...
  // disable the "Open New Window action
  // disable & hides some menuitem
  setSingleWindowUI: function() {
    Tabmix.singleWindowMode = Tabmix.prefs.getBoolPref("singleWindow");
    var newWindowButton = document.getElementById("new-window-button");
    if (newWindowButton)
      newWindowButton.setAttribute("disabled", Tabmix.singleWindowMode);

    var items = document.getElementsByAttribute("command", "cmd_newNavigator");
    for (let i = 0; i < items.length; i++) {
      if (items[i].localName == 'menuitem')
        items[i].setAttribute("hidden", Tabmix.singleWindowMode);
    }

    var frameMenu = document.getElementById("frame");
    if (frameMenu) {
      let menuItem = frameMenu.getElementsByAttribute("oncommand", "gContextMenu.openFrame();")[0];
      if (menuItem)
        menuItem.setAttribute("hidden", Tabmix.singleWindowMode);
    }

    document.getElementById("tmOpenInNewWindow").hidden = Tabmix.singleWindowMode;

    if (Tabmix.isVersion(310)) {
      let val = Tabmix.singleWindowMode || null;
      if (val) {
        Tabmix.setItem("menu_newRemoteWindow", "hidden", true);
        Tabmix.setItem("menu_newNonRemoteWindow", "hidden", true);
      }
      else
        gRemoteTabsUI.init();
      Tabmix.setItem("Tools:RemoteWindow", "disabled", val);
      Tabmix.setItem("Tools:NonRemoteWindow", "disabled", val);
    }
  },

  setMenuIcons: function() {
    function setClass(items, hideIcons) {
      if (hideIcons) {
        for (let i = 0; i < items.length; ++i)
          items[i].removeAttribute("class");
      }
      else {
        for (let i = 0; i < items.length; ++i)
          items[i].setAttribute("class", items[i].getAttribute("tmp_iconic"));
      }
    }
    var hideIcons = Tabmix.prefs.getBoolPref("hideIcons");
    var iconicItems = document.getElementsByAttribute("tmp_iconic", "*");
    setClass(iconicItems, hideIcons);

    iconicItems = gBrowser.tabContextMenu.getElementsByAttribute("tmp_iconic", "*");
    setClass(iconicItems, hideIcons);
  },

  setAutoHidePref: function() {
    TabmixTabbar.hideMode = Tabmix.prefs.getIntPref("hideTabbar");
    if (Tabmix.isVersion(230)) {// after Bug 855370
      gBrowser.tabContainer.updateVisibility();
      return;
    }
    var autoHide = TabmixTabbar.hideMode !== 0;
    if (autoHide != Services.prefs.getBoolPref("browser.tabs.autoHide")) {
      Services.prefs.setBoolPref("browser.tabs.autoHide", autoHide);
      if (TabmixTabbar.hideMode == 1)
        gBrowser.tabContainer.updateVisibility();
    }
  },

  setTabBarVisibility: function TMP_PO_setTabBarVisibility() {
    if (TabmixTabbar.hideMode == 2)
      gBrowser.tabContainer.visible = false;
    else if (!gBrowser.tabContainer.visible) {
      let moreThenOneTab = gBrowser.tabs.length > 1;
      gBrowser.tabContainer.visible = moreThenOneTab || TabmixTabbar.hideMode === 0;
      if (moreThenOneTab) {
        gBrowser.ensureTabIsVisible(gBrowser.selectedTab, false);
        TabmixTabbar.updateBeforeAndAfter();
      }
    }
  },

  changeNewTabButtonSide: function(aPosition) {
    function $(id) document.getElementById(id)
    let newTabButton = $("new-tab-button");
    if (TabmixTabbar.isButtonOnTabsToolBar(newTabButton)) {
      // update our attribute
      let showNewTabButton = Tabmix.prefs.getBoolPref("newTabButton");
      this.setShowNewTabButtonAttr(showNewTabButton, aPosition);
      Tabmix.sideNewTabButton = newTabButton;

      // move button within TabsToolbar
      if (Tabmix.isVersion(290)) {
        let buttonPosition = Tabmix.getPlacement("new-tab-button");
        let tabsPosition = Tabmix.getPlacement("tabbrowser-tabs");
        let boxPositoin = Tabmix.getPlacement("tabmixScrollBox");
        let after = boxPositoin == tabsPosition + 1 ? boxPositoin : tabsPosition;
        let changePosition = (aPosition === 0 && buttonPosition > tabsPosition) ||
                             (aPosition == 1 && buttonPosition < after) ||
                             (aPosition == 2 && buttonPosition != after + 1);
        if (changePosition) {
          let tabsToolbar = $("TabsToolbar");
          tabsToolbar.removeAttribute("tabbaronbottom");
          let newPosition = aPosition === 0 ? tabsPosition : after + 1;
          let doChange = function() {
            CustomizableUI.moveWidgetWithinArea("new-tab-button", newPosition);
            Tabmix.setItem(tabsToolbar, "tabbaronbottom", TabmixTabbar.position == 1 || null);
          };
          if (TabmixTabbar.position == 1)
            setTimeout(function() doChange(), 15);
          else
            doChange();
        }
        return;
      }

      let tabsToolbar = $("TabsToolbar");
      let toolBar = Array.slice(tabsToolbar.childNodes);
      let buttonPosition = toolBar.indexOf(newTabButton);
      let tabsPosition = toolBar.indexOf(gBrowser.tabContainer);
      let scrollBox = $("tabmixScrollBox");
      let after = scrollBox && toolBar.indexOf(scrollBox) || tabsPosition;
      let changePosition = (aPosition === 0 && buttonPosition > tabsPosition) ||
                           (aPosition == 1 && buttonPosition < after) ||
                           (aPosition == 2 && buttonPosition != after + 1);
      if (changePosition) {
        let newPosition = aPosition === 0 ? tabsPosition : after + 1;
        tabsToolbar.insertBefore(newTabButton, tabsToolbar.childNodes.item(newPosition));
        // update currentset
        let cSet = tabsToolbar.getAttribute("currentset") || tabsToolbar.getAttribute("defaultset");
        cSet = cSet.split(",").filter(function(id) id != "new-tab-button");
        let tabsIndex = cSet.indexOf("tabbrowser-tabs");
        if (tabsIndex < 0)
          return;
        if (aPosition > 0)
          tabsIndex++;
        cSet.splice(tabsIndex, 0, "new-tab-button");
        tabsToolbar.setAttribute("currentset", cSet.join(","));
        document.persist("TabsToolbar", "currentset");
      }
    }
    else {
      this.setShowNewTabButtonAttr(false);
      Tabmix.sideNewTabButton = null;
    }
  },

  setShowNewTabButtonAttr: function(aShow, aPosition) {
    // check new tab button visibility when we are in multi-row and the
    // preference is to show new-tab-button after last tab
    Tabmix.tabsUtils.checkNewtabButtonVisibility =
                  TabmixTabbar.isMultiRow && ((aShow && aPosition == 2) ||
                  !!TabmixTabbar.newPrivateTabButton());

   /** values for tabmix-show-newtabbutton to show tabs-newtab-button are:
    *  aftertabs       - show the button after tabs
    *  temporary-right-side
    *                  - show the button on right side when there is no place
    *                    for the button aftertabs in multi-row mode
    *  rigth-side      - show the button on right side
    *  left-side       - show the button on left side
    */
    let attrValue;
    if (!aShow)
      attrValue = null;
    else if (aPosition === 0)
      attrValue = "left-side";
    else if (aPosition == 1)
      attrValue = "right-side";
    else
      attrValue = "aftertabs";
    // we use this value in disAllowNewtabbutton and overflow setters
    Tabmix.tabsUtils._show_newtabbutton = attrValue;
    if (aShow) {
      if (Tabmix.tabsUtils.overflow)
        attrValue = "right-side";
      else if (Tabmix.tabsUtils.disAllowNewtabbutton)
        attrValue = "temporary-right-side";
    }
    Tabmix.setItem("TabsToolbar", "tabmix-show-newtabbutton", attrValue);
  },

  tabBarPositionChanged: function(aPosition) {
    if (aPosition > 1 || (aPosition !== 0 && Tabmix.extensions.verticalTabBar)) {
      Tabmix.prefs.setIntPref("tabBarPosition", 0);
      return false;
    }
    if (TabmixTabbar.position == aPosition)
      return false;

    TabmixTabbar.position = aPosition;
    gBrowser.tabContainer._tabDropIndicator.removeAttribute("style");
    var tabsToolbar = document.getElementById("TabsToolbar");
    // setting tabbaronbottom attribute trigger updatePosition in our
    // scrollbox.xml\toolbar binding
    Tabmix.setItem(tabsToolbar, "tabbaronbottom", TabmixTabbar.position == 1 || null);

    // TabsOnTop removed by bug 755593
    if (window.TabsOnTop)
      this.setTabsOnTop(TabmixTabbar.position == 1);

    if (TabmixTabbar.position === 0) {// top
      this._bottomRect = {top:null, width:null, height:null};
      let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
      bottomToolbox.style.removeProperty("height");
      tabsToolbar.style.removeProperty("top");
      tabsToolbar.removeAttribute("width");
      // force TabmixTabbar.setHeight to set tabbar height
      TabmixTabbar.visibleRows = 1;
    }
    return true;
  },

  // TabsOnTop removed by bug 755593
  setTabsOnTop: function(onBottom) {
    // hide/show TabsOnTop menu & menuseparator
    let toggleTabsOnTop = document.getElementsByAttribute("command", "cmd_ToggleTabsOnTop");
    for (let i = 0; i < toggleTabsOnTop.length; i++) {
      let cmd = toggleTabsOnTop[i];
      cmd.hidden = onBottom;
      if (cmd.nextSibling && cmd.nextSibling.localName == "menuseparator")
        cmd.nextSibling.hidden = onBottom;
    }

    if (onBottom) {
      // save TabsOnTop status
      if (TabsOnTop.enabled) {
        gNavToolbox.tabmix_tabsontop = true;
        TabsOnTop.enabled = false;
      }
    }
    else if (gNavToolbox.tabmix_tabsontop) {
      TabsOnTop.enabled = true;
      gNavToolbox.tabmix_tabsontop = false;
    }
  },

  _bottomRect: {top:null, width:null, height:null},
  updateTabbarBottomPosition: function TMP_PO_updateTabbarBottomPosition(aEvent) {
    if (TabmixTabbar.position != 1 || !gBrowser.tabContainer.visible)
      return;

    let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
    if (bottomToolbox.collapsed != gInPrintPreviewMode)
      bottomToolbox.collapsed = gInPrintPreviewMode;
    if (gInPrintPreviewMode)
      return;

    if (aEvent && aEvent.target != window) {
      // when the event is not from the window check if tabmix-bottom-toolbox
      // change its position
      let rect = bottomToolbox.getBoundingClientRect();
      if (rect.top == this._bottomRect.top &&
          rect.width == this._bottomRect.width)
        return;
    }

    let tabsToolbar = document.getElementById("TabsToolbar");
    // when we here after many tabs closed fast mTabstrip height can larger
    // then one row.
    let newHeight = TabmixTabbar.visibleRows == 1 ? TabmixTabbar.singleRowHeight :
            gBrowser.tabContainer.mTabstrip.scrollClientRect.height;
    if (this._bottomRect.height != newHeight) {
      this._bottomRect.height = newHeight;
      bottomToolbox.style.setProperty("height", newHeight + "px", "important");
    }
    // get new rect after changing the height
    let rect = bottomToolbox.getBoundingClientRect();
    if (this._bottomRect.top != rect.top) {
      this._bottomRect.top = rect.top;
      tabsToolbar.style.setProperty("top", rect.top + "px", "important");
    }
    if (this._bottomRect.width != rect.width) {
      this._bottomRect.width = rect.width;
      tabsToolbar.setAttribute("width", rect.width);
    }
  },

  // Show Reload Every menu on Reload button
  showReloadEveryOnReloadButton: function() {
    let show = Tabmix.prefs.getBoolPref("reloadEvery.onReloadButton");
    Tabmix.setItem("reload-button", "type", show ? "menu-button" : null);
    Tabmix.setItem("urlbar-go-button", "context", show ? "autoreload_popup" : null);

    let setContext = function(command) {
      let items = document.getElementsByAttribute("command" ,"Browser:" + command);
      Array.slice(items).forEach(function(item) {
        if (item.localName == "toolbarbutton")
          Tabmix.setItem(item, "context", show ? "autoreload_popup" : null);
      });
    };
    setContext("ReloadOrDuplicate");
    setContext("Stop");
  },

  // we replace some Tabmix settings with Firefox settings
  updateSettings: function() {
    function getPrefByType(prefName, aDefault, aType) {
      let PrefFn = {0: "", 32: "CharPref", 64: "IntPref", 128: "BoolPref"};
      let fn = PrefFn[Services.prefs.getPrefType(prefName)];
      let val;
      try {
        val = Services.prefs["get" + fn](prefName);
        // bug in version 0.4.1.0 import old int pref with zero (0)
        // value into string pref
        if (aType == "IntPref" && fn != aType)
          val = parseInt(val);
      } catch (ex) {
        Tabmix.log("gTMPprefObserver.updateSettings can't read preference " + prefName + "\n" + ex);
        val = typeof aDefault == "undefined" ? null : aDefault;
      }
      Services.prefs.clearUserPref(prefName);
      return val;
    }

    if (Tabmix.prefs.prefHasUserValue("undoCloseCache")) {
       var max_tabs_undo = getPrefByType("extensions.tabmix.undoCloseCache", 5, "IntPref");
       Services.prefs.setIntPref("browser.sessionstore.max_tabs_undo", max_tabs_undo);
    }
    // remove disp=attd&view=att it's make problem with gMail
    if (Tabmix.prefs.prefHasUserValue("filetype")) {
       var filetype = Tabmix.prefs.getCharPref("filetype");
       filetype = filetype.replace("/disp=attd&view=att/","").replace("  ", " ").trim();
       Tabmix.prefs.setCharPref("filetype", filetype);
    }
    // 2008-08-17
    if (Tabmix.prefs.prefHasUserValue("opentabfor.search")) {
       Services.prefs.setBoolPref("browser.search.openintab", Tabmix.prefs.getBoolPref("opentabfor.search"));
       Tabmix.prefs.clearUserPref("opentabfor.search");
    }
    // 2008-09-23
    if (Tabmix.prefs.prefHasUserValue("keepWindow")) {
       Services.prefs.setBoolPref("browser.tabs.closeWindowWithLastTab", !Tabmix.prefs.getBoolPref("keepWindow"));
       Tabmix.prefs.clearUserPref("keepWindow");
    }
    // 2008-09-23
    if (Services.prefs.prefHasUserValue("browser.ctrlTab.mostRecentlyUsed")) {
       Services.prefs.setBoolPref("browser.ctrlTab.previews",
                                  Services.prefs.getBoolPref("browser.ctrlTab.mostRecentlyUsed"));
       Services.prefs.clearUserPref("browser.ctrlTab.mostRecentlyUsed");
    }
    // 2008-09-28
    if (Tabmix.prefs.prefHasUserValue("lasttab.handleCtrlTab")) {
       Services.prefs.setBoolPref("browser.ctrlTab.previews",
                                  Tabmix.prefs.getBoolPref("lasttab.handleCtrlTab"));
       Tabmix.prefs.clearUserPref("lasttab.handleCtrlTab");
    }
    // 2008-11-29
    if (Tabmix.prefs.prefHasUserValue("maxWidth")) {
       let val = getPrefByType("extensions.tabmix.maxWidth", 250, "IntPref");
       Services.prefs.setIntPref("browser.tabs.tabMaxWidth", val);
    }
    // 2008-11-29
    if (Tabmix.prefs.prefHasUserValue("minWidth")) {
       let val = getPrefByType("extensions.tabmix.minWidth", 100, "IntPref");
       Services.prefs.setIntPref("browser.tabs.tabMinWidth", val);
    }
    // 2009-01-31
    if (Tabmix.prefs.prefHasUserValue("newTabButton.leftside")) {
       Tabmix.prefs.setIntPref("newTabButton.position", Tabmix.prefs.getBoolPref("newTabButton.leftside") ? 0 : 2);
       Tabmix.prefs.clearUserPref("newTabButton.leftside");
    }
    // 2009-10-10
    // swap prefs --> warn when closing window "extensions.tabmix.windows.warnOnClose"
    //                replaced with "browser.tabs.warnOnClose"
    //                warn when closing tabs "browser.tabs.warnOnClose"
    //                replaced with "extensions.tabmix.tabs.warnOnClose"
    if (Tabmix.prefs.prefHasUserValue("windows.warnOnClose")) {
       Tabmix.prefs.setBoolPref("tabs.warnOnClose", Services.prefs.getBoolPref("browser.tabs.warnOnClose"));
       Services.prefs.setBoolPref("browser.tabs.warnOnClose", Tabmix.prefs.getBoolPref("windows.warnOnClose"));
       Tabmix.prefs.clearUserPref("windows.warnOnClose");
    }
    // 2010-03-07
    if (Tabmix.prefs.prefHasUserValue("extraIcons")) {
       Tabmix.prefs.setBoolPref("extraIcons.locked", Tabmix.prefs.getBoolPref("extraIcons"));
       Tabmix.prefs.setBoolPref("extraIcons.protected", Tabmix.prefs.getBoolPref("extraIcons"));
       Tabmix.prefs.clearUserPref("extraIcons");
    }
    // 2010-06-05
    if (Tabmix.prefs.prefHasUserValue("tabXMode")) {
      let val = getPrefByType("extensions.tabmix.tabXMode", 1, "IntPref");
      Tabmix.prefs.setIntPref("tabs.closeButtons", val);
    }
    // partly fix a bug from version 0.3.8.3
    else if (Services.prefs.prefHasUserValue("browser.tabs.closeButtons") &&
             !Tabmix.prefs.prefHasUserValue("version") &&
             !Tabmix.prefs.prefHasUserValue("tabs.closeButtons")) {
      let value = getPrefByType("browser.tabs.closeButtons", 1, "IntPref");
      // these value are from 0.3.8.3. we don't know if 0,1 are also from 0.3.8.3 so we don't use 0,1.
      if (value > 1 && value <= 6) {
        let newValue = [3,5,1,1,2,4,1][value];
        Tabmix.prefs.setIntPref("tabs.closeButtons", newValue);
      }
    }
    if (Tabmix.prefs.prefHasUserValue("tabXMode.enable")) {
      Tabmix.prefs.setBoolPref("tabs.closeButtons.enable", Tabmix.prefs.getBoolPref("tabXMode.enable"));
      Tabmix.prefs.clearUserPref("tabXMode.enable");
    }
    if (Tabmix.prefs.prefHasUserValue("tabXLeft")) {
      Tabmix.prefs.setBoolPref("tabs.closeButtons.onLeft", Tabmix.prefs.getBoolPref("tabXLeft"));
      Tabmix.prefs.clearUserPref("tabXLeft");
    }
    if (Tabmix.prefs.prefHasUserValue("tabXDelay")) {
      let val = getPrefByType("extensions.tabmix.tabXDelay", 50, "IntPref");
      Tabmix.prefs.setIntPref("tabs.closeButtons.delay", val);
    }
    // 2010-09-16
    if (Tabmix.prefs.prefHasUserValue("speLink")) {
      let val = getPrefByType("extensions.tabmix.speLink", 0, "IntPref");
      Tabmix.prefs.setIntPref("opentabforLinks", val);
      Tabmix.prefs.setBoolPref("lockallTabs", val == 1);
    }
    // 2010-10-12
    if (Tabmix.prefs.prefHasUserValue("hideurlbarprogress")) {
      Tabmix.prefs.clearUserPref("hideurlbarprogress");
    }
    // 2011-01-26
    if (Tabmix.prefs.prefHasUserValue("mouseDownSelect")) {
      Tabmix.prefs.setBoolPref("selectTabOnMouseDown", Tabmix.prefs.getBoolPref("mouseDownSelect"));
      Tabmix.prefs.clearUserPref("mouseDownSelect");
    }
    // 2011-10-11
    if (Services.prefs.prefHasUserValue("browser.link.open_external")) {
      let val = getPrefByType("browser.link.open_external", 3, "IntPref");
      let val1 = getPrefByType("browser.link.open_newwindow", 3, "IntPref");
      if (val == val1)
        val = -1;
      Services.prefs.setIntPref("browser.link.open_newwindow.override.external", val);
    }
    // 2011-11-26
    if (Tabmix.prefs.prefHasUserValue("clickToScroll.scrollDelay")) {
      let val = getPrefByType("extensions.tabmix.clickToScroll.scrollDelay", 150, "IntPref");
      Services.prefs.setIntPref("toolkit.scrollbox.clickToScroll.scrollDelay", val);
    }
    // 2012-03-21
    var _loadOnNewTab = true, _replaceLastTabWith = true;
    if (Tabmix.prefs.prefHasUserValue("loadOnNewTab")) {
      let val = getPrefByType("extensions.tabmix.loadOnNewTab", 4, "IntPref");
      Tabmix.prefs.setIntPref("loadOnNewTab.type", val);
      _loadOnNewTab = false;
    }
    if (Tabmix.prefs.prefHasUserValue("replaceLastTabWith")) {
      let val = getPrefByType("extensions.tabmix.replaceLastTabWith", 4, "IntPref");
      Tabmix.prefs.setIntPref("replaceLastTabWith.type", val);
      _replaceLastTabWith = false;
    }
    // Changing our preference to use New Tab Page as default starting from Firefox 12
    function _setNewTabUrl(oldPref, newPref, controlPref) {
      if (Services.prefs.prefHasUserValue(oldPref)) {
        let nsISupportsString = Ci.nsISupportsString;
        let str = Cc["@mozilla.org/supports-string;1"].createInstance(nsISupportsString);
        str.data = Services.prefs.getComplexValue(oldPref, nsISupportsString).data;
        // only updtae new preference value if the old control preference is New Tab Page
        let control = controlPref === undefined || Tabmix.prefs.prefHasUserValue(controlPref) &&
                      Tabmix.prefs.getIntPref(controlPref) == 4;
        if (str.data !== "" && control)
          Services.prefs.setComplexValue(newPref, nsISupportsString, str);
        Services.prefs.clearUserPref(oldPref);
      }
    }
    _setNewTabUrl("extensions.tabmix.newTabUrl", TabmixSvc.newtabUrl, "loadOnNewTab.type");
    _setNewTabUrl("extensions.tabmix.newTabUrl_afterLastTab",
                  "extensions.tabmix.replaceLastTabWith.newtab.url", "replaceLastTabWith.type");
    _setNewTabUrl("extensions.tabmix.newtab.url", TabmixSvc.newtabUrl);
    _setNewTabUrl("extensions.tabmix.replaceLastTabWith.newTabUrl",
                  "extensions.tabmix.replaceLastTabWith.newtab.url");
    // 2012-04-12
    var pref = "browser.tabs.loadFolderAndReplace";
    if (Services.prefs.prefHasUserValue(pref)) {
      Tabmix.prefs.setBoolPref("loadBookmarksAndReplace", Services.prefs.getBoolPref(pref));
      Services.prefs.clearUserPref(pref);
    }
try {
    // 2012-06-22 - remove the use of extensions.tabmix.tabMinWidth/tabMaxWidth
    // other extensions still use browser.tabs.tabMinWidth/tabMaxWidth
    if (Tabmix.prefs.prefHasUserValue("tabMinWidth")) {
      let val = getPrefByType("extensions.tabmix.tabMinWidth", 100, "IntPref");
      Services.prefs.setIntPref("browser.tabs.tabMinWidth", val);
    }
    if (Tabmix.prefs.prefHasUserValue("tabMaxWidth")) {
      let val = getPrefByType("extensions.tabmix.tabMaxWidth", 250, "IntPref");
      Services.prefs.setIntPref("browser.tabs.tabMaxWidth", val);
      Tabmix.prefs.clearUserPref("tabMaxWidth");
    }
} catch (ex) {Tabmix.assert(ex);}
    // 2013-01-21 - lock hideIcons to true in mac
    if (Services.appinfo.OS == "Darwin" && !Tabmix.prefs.prefIsLocked("hideIcons")) {
      Tabmix.defaultPrefs.setBoolPref("hideIcons", true);
      Tabmix.prefs.clearUserPref("hideIcons");
      Tabmix.prefs.lockPref("hideIcons");
    }

    // 2013-01-18
    var useF8Key, useF9Key;
    if (Tabmix.prefs.prefHasUserValue("disableF8Key")) {
      useF8Key = !Tabmix.prefs.getBoolPref("disableF8Key");
      Tabmix.prefs.clearUserPref("disableF8Key");
    }
    if (Tabmix.prefs.prefHasUserValue("disableF9Key")) {
      useF9Key = !Tabmix.prefs.getBoolPref("disableF9Key");
      Tabmix.prefs.clearUserPref("disableF9Key");
    }
    if (useF8Key || useF9Key) {
      let shortcuts = TabmixSvc.JSON.parse(Tabmix.prefs.getCharPref("shortcuts"));
      if (useF8Key)
        shortcuts.slideShow = "VK_F8";
      if (useF9Key)
        shortcuts.toggleFLST = "VK_F9";
      Tabmix.prefs.setCharPref("shortcuts", TabmixSvc.JSON.stringify(shortcuts));
    }
    // 2013-09-04
    if (Tabmix.prefs.prefHasUserValue("enableScrollSwitch")) {
      // enableScrollSwitch non-default value was true that is now 1
      Tabmix.prefs.setIntPref("scrollTabs", 1);
      Tabmix.prefs.clearUserPref("enableScrollSwitch");
    }
    // 2014-08-07
    if (Tabmix.prefs.prefHasUserValue("dblClickTabbar_changesize")) {
      let val = Tabmix.prefs.getBoolPref("dblClickTabbar_changesize");
      // make sure to set click_dragwindow first, dblclick_changesize depend
      // on it see gTMPprefObserver.observe.
      Tabmix.prefs.setBoolPref("tabbar.click_dragwindow", val);
      Tabmix.prefs.setBoolPref("tabbar.dblclick_changesize", val);
      Tabmix.prefs.clearUserPref("dblClickTabbar_changesize");
    }
    // 2014-12-25
    // don't synce sessions.onStart.sessionpath
    Services.prefs.clearUserPref("services.sync.prefs.sync.extensions.tabmix.sessions.onStart.sessionpath");
    // 2015-07-15
    if (Tabmix.prefs.prefHasUserValue("loadFolderAndReplace")) {
      Tabmix.prefs.setBoolPref("loadBookmarksAndReplace", Tabmix.prefs.getBoolPref("loadFolderAndReplace"));
      Tabmix.prefs.clearUserPref("loadFolderAndReplace");
    }
    // Add new changes before this line

    // verify valid value
    if (Tabmix.prefs.prefHasUserValue("tabs.closeButtons")) {
      let value = Tabmix.prefs.getIntPref("tabs.closeButtons");
      if (value < 1 || value > 5)
        Tabmix.prefs.clearUserPref("tabs.closeButtons");
    }
    // 2011-01-22 - verify sessionstore enabled
    Services.prefs.clearUserPref("browser.sessionstore.enabled");

    let getVersion = function _getVersion(currentVersion, shouldAutoUpdate) {
      let oldVersion = Tabmix.prefs.prefHasUserValue("version") ? Tabmix.prefs.getCharPref("version") : "";

      let vCompare = function(a, b) Services.vc.compare(a, b) <= 0;
      if (oldVersion) {
        // 2013-08-18
        if (vCompare(oldVersion, "0.4.1.1pre.130817a") &&
            Services.prefs.prefHasUserValue("browser.tabs.loadDivertedInBackground"))
          Tabmix.prefs.setBoolPref("loadExternalInBackground", true);
        // 2013-09-25
        if (vCompare(oldVersion, "0.4.1.2pre.130918a")) {
          let value = Tabmix.prefs.getBoolPref("closeRightMenu");
          if (!Tabmix.prefs.prefHasUserValue("closeRightMenu"))
            Tabmix.prefs.setBoolPref("closeRightMenu", false);
          else if (value)
            Tabmix.prefs.clearUserPref("closeRightMenu");
        }
      }

      let showNewVersionTab;
      if (currentVersion != oldVersion) {
        Tabmix.prefs.setCharPref("version", currentVersion);
        Services.prefs.savePrefFile(null);
        // show the new version page for all official versions and for development
        // versions if auto update is on for Tabmix and the new version is from a
        // different date then the installed version
        let isDevBuild = /[A-Za-z]/.test(currentVersion);
        if (!isDevBuild)
          showNewVersionTab = true;
        else if (shouldAutoUpdate || oldVersion === "") {
          let re = /([A-Za-z]*)\d*$/;
          let subs = function(obj) obj[1] ? obj.input.substring(0, obj.index) : obj.input;
          showNewVersionTab = subs(re.exec(currentVersion)) != subs(re.exec(oldVersion));
        }
      }
      if (showNewVersionTab) {
        // open Tabmix page in a new tab
        window.setTimeout(function() {
          let defaultChanged = "";
          let showComment = oldVersion ? Services.vc.compare(oldVersion, "0.4.0.2pre.120330a") <= 0 : false;
          if (showComment && (_loadOnNewTab || _replaceLastTabWith))
            defaultChanged = "&newtabpage";
          let b = Tabmix.getTopWin().gBrowser;
          b.selectedTab = b.addTab("http://tmp.garyr.net/version_update2.htm?version=" +
                                   currentVersion + defaultChanged);
          b.selectedTab.loadOnStartup = true;
        },1000);
        // noting more to do at the moment
      }
    };
    AddonManager.getAddonByID("{dc572301-7619-498c-a57d-39143191b318}", function(aAddon) {
      try {
        let shouldAutoUpdate = AddonManager.shouldAutoUpdate(aAddon);
        getVersion(aAddon.version, shouldAutoUpdate);
      } catch (ex) {Tabmix.assert(ex);}
    });

    // block item in tabclicking options that are not in use
    var blockedValues = [];
    if (!("SessionSaver" in window && window.SessionSaver.snapBackTab))
      blockedValues.push(12);
    var isIE = ("IeView" in window && window.IeView.ieViewLaunch) ||
               (Tabmix.extensions.gIeTab && window[Tabmix.extensions.gIeTab.obj].switchTabEngine) ||
               ("ieview" in window && window.ieview.launch);
    if (!isIE)
      blockedValues.push(21);
    if (!document.getElementById("Browser:BookmarkAllTabs"))
      blockedValues.push(26);
    TabmixSvc.blockedClickingOptions = blockedValues;
    this.updateTabClickingOptions();

    // capture gfx.direct2d.disabled value on first window
    // see getter at TabmixSvc
    var tmp = TabmixSvc.direct2dDisabled; // jshint ignore:line
  },

  updateTabClickingOptions: function() {
    var c = ["dblClickTab", "middleClickTab", "ctrlClickTab", "shiftClickTab", "altClickTab",
             "dblClickTabbar", "middleClickTabbar", "ctrlClickTabbar", "shiftClickTabbar", "altClickTabbar"];
    for (let i = 0; i < c.length; i++)
      this.blockTabClickingOptions("extensions.tabmix." + c[i]);
  },

  blockTabClickingOptions: function(prefName) {
    if (TabmixSvc.blockedClickingOptions.indexOf(Services.prefs.getIntPref(prefName)) > -1) {
      if (Services.prefs.prefHasUserValue(prefName))
        Services.prefs.clearUserPref(prefName);
      else
        Services.prefs.setIntPref(prefName, 0);
    }
  }

};

var TabmixProgressListener = {
  startup: function TMP_PL_startup(tabBrowser) {
    // check the current window.  if we're in a popup, don't init this progressListener
    if (window.document.documentElement.getAttribute("chromehidden"))
      return;
    Tabmix.changeCode(gBrowser, "gBrowser.setTabTitleLoading")._replace(
      'aTab.label = this.mStringBundle.getString("tabs.connecting");',
      'if (TabmixTabbar.hideMode != 2 && TabmixTabbar.widthFitTitle && !aTab.hasAttribute("width"))' +
      '  aTab.setAttribute("width", aTab.getBoundingClientRect().width);' +
      '$&'
    ).toCode();
    this.listener.mTabBrowser = tabBrowser;
    // Bug 1081891 fixed on Firefox 38
    if (!Tabmix.isVersion(340) || Tabmix.isVersion(380))
      this.listener._fixTabTitle = function() {};
    tabBrowser.addTabsProgressListener(this.listener);
  },

  listener: {
    mTabBrowser: null,
    showProgressOnTab: false,

    // Bug 1081891: Calling webNavigation.loadURI with url that trigger
    // unknownContentType.xul dialog change the tab title to its address
    // as a workaround we trigger DOMTitleChanged async message
    _fixTabTitle: function TMP__contentLinkClick(tab, browser, url) {
      if (browser.getAttribute("remote") != "true" || /^about/.test(url) ||
          browser._contentTitle !== "" || this.mTabBrowser.isBlankTab(tab))
        return;
      tab.addEventListener("TabLabelModified", function titleChanged(event) {
        tab.removeEventListener("TabLabelModified", titleChanged, true);
        if (!browser._contentTitle) {
          event.preventDefault();
          browser.messageManager.sendAsyncMessage("Tabmix:sendDOMTitleChanged");
        }
      }, true);
    },

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
      if (tab.hasAttribute("_tabmix_load_bypass_cache") &&
          (aStateFlags & nsIWebProgressListener.STATE_START)) {
        tab.removeAttribute("_tabmix_load_bypass_cache");
        aRequest.loadFlags = aRequest.loadFlags | aRequest.LOAD_BYPASS_CACHE;
      }
      if (aStateFlags & nsIWebProgressListener.STATE_START &&
          aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK) {
        let url = aRequest.QueryInterface(Ci.nsIChannel).URI.spec;
        this._fixTabTitle(tab, aBrowser, url);
        if (url == TabmixSvc.aboutBlank) {
          tab.removeAttribute("busy");
          tab.removeAttribute("progress");
          this.mTabBrowser.setTabTitle(tab);
        }
        else if (!(aStateFlags & nsIWebProgressListener.STATE_RESTORING)) {
          if (tab.hasAttribute("tabmix_pending"))
            tab.removeAttribute("tabmix_pending");
          Tabmix.setTabStyle(tab);
          // this code run after setTabTitleLoading, so we must set tab width on setTabTitleLoading
          // at this stage only unhide the button if needed.
          if (this.mTabBrowser.tabContainer.getAttribute("closebuttons") == "noclose") {
            let tabsCount = this.mTabBrowser.visibleTabs.length;
            if (tabsCount == 1)
              this.mTabBrowser.tabContainer.adjustTabstrip(true, url);
          }
          if (tab.hasAttribute("tabmix_bookmarkId"))
            TMP_Places.setTabTitle(tab, url);
        }
      }
      else if (aStateFlags & nsIWebProgressListener.STATE_STOP &&
               aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK) {
        let uri = aRequest.QueryInterface(Ci.nsIChannel).URI.spec;
        // remove blank tab that created by downloading a file.
        let isDownLoading = Tabmix.prefs.getBoolPref("enablefiletype") &&
            this.mTabBrowser.isBlankBrowser(aBrowser, true) &&
            !/^about/.test(uri) && aStatus === 0;
        if (isDownLoading) {
          if (tab.selected)
            this.mTabBrowser.previousTab(tab);
          this.mTabBrowser.hideTab(tab);
          TabmixTabbar.updateScrollStatus();
          // let to unknownContentType dialog or nsIFilePicker time to open
          tab._tabmix_downloadingTimeout = tab.ownerDocument.defaultView.setTimeout(function(self) {
            tab._tabmix_downloadingTimeout = null;
            if (self && self.mTabBrowser && tab && tab.parentNode)
              self.mTabBrowser.removeTab(tab, {animate: false});
          }, 500, this);
        }

        let tabsCount = this.mTabBrowser.visibleTabs.length;
        if (tabsCount == 1)
          this.mTabBrowser.tabContainer.adjustTabstrip(true);
        tab.removeAttribute("tab-progress");
        if (!isBlankPageURL(uri) && uri.indexOf("newTab.xul") == -1) {
          aBrowser.tabmix_allowLoad = !tab.hasAttribute("locked");
          if (Tabmix.prefs.getBoolPref("unreadTabreload") && tab.hasAttribute("visited") &&
              !tab.hasAttribute("dontremovevisited") && tab.getAttribute(TabmixSvc.selectedAtt) != "true")
            tab.removeAttribute("visited");
            Tabmix.setTabStyle(tab);
        }
        // see gBrowser.openLinkWithHistory in tablib.js
        if (tab.hasAttribute("dontremovevisited"))
          tab.removeAttribute("dontremovevisited");

        if (!tab.hasAttribute("busy")) {
          TabmixSessionManager.tabLoaded(tab);
          // we need to remove width from tabs with url label from here
          if (tab.hasAttribute("width"))
            tablib.onTabTitleChanged(tab);
        }
      }
      if ((aStateFlags & nsIWebProgressListener.STATE_IS_WINDOW) &&
            (aStateFlags & nsIWebProgressListener.STATE_STOP)) {
        if (tab.autoReloadURI)
          Tabmix.autoReload.onTabReloaded(tab, aBrowser);

        // disabled name for locked tab, so locked tab don't get reuse
        if (tab.getAttribute("locked")) {
          if (Tabmix.isVersion(320))
            aBrowser.messageManager.sendAsyncMessage("Tabmix:resetContentName");
          else if (aBrowser.contentWindow && aBrowser.contentWindow.name)
            aBrowser.contentWindow.name = "";
        }
      }
    }
  }
};
