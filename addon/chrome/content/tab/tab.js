"use strict";

var gTMPprefObserver, TabmixProgressListener;

// code based on Tab X 0.5 enhanced version by Morac, modified by Hemiola SUN, later CPU & onemen
var TabmixTabbar = {
  _visibleRows: 1,
  hideMode: 0,
  position: 0,
  SCROLL_BUTTONS_HIDDEN: 0,
  SCROLL_BUTTONS_LEFT_RIGHT: 1,
  SCROLL_BUTTONS_MULTIROW: 2,
  SCROLL_BUTTONS_RIGHT: 3,

  set flowing(val) {
    Tabmix.setItem(gBrowser.tabContainer, "flowing", val);
    Tabmix.setItem(gBrowser.tabContainer.arrowScrollbox, "flowing", val);

    // update our broadcaster
    Tabmix.setItem("tabmix_flowing", "flowing", val);

    Tabmix.setItem("TabsToolbar", "multibar", val == "multibar" || null);
    Tabmix.setItem("tabmix-scrollbox", "orient", val == "multibar" ? "vertical" : "horizontal");

    Tabmix.tabsUtils.resizeObserver(val == "multibar");

    return val;
  },

  get flowing() {
    return gBrowser.tabContainer.getAttribute("flowing");
  },

  get isMultiRow() {
    return this.flowing == "multibar";
  },

  get visibleRows() {
    return this._visibleRows;
  },

  set visibleRows(rows) {
    const currentValue = this._visibleRows;
    this._visibleRows = rows;
    if (currentValue !== rows) {
      document.documentElement.style.setProperty("--tabmix-visiblerows", rows);
      Tabmix.tabsUtils.updateProtonValues();
    }
  },

  isButtonOnTabsToolBar(button) {
    return button && document.getElementById("TabsToolbar").contains(button);
  },

  // get privateTab-toolbar-openNewPrivateTab, when the button is on the tabbar
  newPrivateTabButton() {
    let button = document.getElementById("privateTab-toolbar-openNewPrivateTab");
    return this.isButtonOnTabsToolBar(button) ? button : null;
  },

  updateSettings: function TMP_updateSettings(start) {
    if (!gBrowser || Tabmix.prefs.prefHasUserValue("setDefault"))
      return;

    var tabBar = gBrowser.tabContainer;
    var tabstrip = tabBar.arrowScrollbox;

    var tabscroll = Tabmix.prefs.getIntPref("tabBarMode");
    if (document.documentElement.getAttribute("chromehidden").includes("toolbar"))
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

    var currentVisible = start ? true : Tabmix.tabsUtils.isElementVisible(gBrowser._selectedTab);

    if (prevTabscroll != tabscroll) {
      // update pointer to the button object that we are going to use
      let useTabmixButtons = tabscroll > this.SCROLL_BUTTONS_LEFT_RIGHT;
      let overflow = Tabmix.tabsUtils.overflow;

      // from Firefox 4.0+ on we add dynamically scroll buttons on TabsToolbar.
      let tabmixScrollBox = document.getElementById("tabmix-scrollbox");
      if (tabmixScrollBox) // just in case our box is missing
        Tabmix.tabsUtils.updateScrollButtons(useTabmixButtons);

      if (isMultiRow || prevTabscroll == this.SCROLL_BUTTONS_MULTIROW) {
        // temporarily hide vertical scroll button.
        // visible button can interfere with row height calculation.
        // remove the collapsed attribute after updateVerticalTabStrip
        Tabmix.setItem(tabmixScrollBox, "collapsed", true);
      }

      this.flowing = ["singlebar", "scrollbutton", "multibar", "scrollbutton"][tabscroll];
      let isDefault = tabscroll == this.SCROLL_BUTTONS_LEFT_RIGHT || null;
      Tabmix.setItem(tabBar.arrowScrollbox, "defaultScrollButtons", isDefault);
      Tabmix.setItem(tabmixScrollBox, "defaultScrollButtons", isDefault);

      if (prevTabscroll == this.SCROLL_BUTTONS_MULTIROW) {
        tabstrip.resetFirstTabInRow();
        Tabmix.tabsUtils.updateVerticalTabStrip(true);
      } else if (isMultiRow && overflow) {
        // if we are in overflow in one line we will have more then one line
        // in multi-row. we try to prevent extra over/underflow events by setting
        // the height in front.
        if (Tabmix.tabsUtils.updateVerticalTabStrip() == "scrollbar")
          Tabmix.tabsUtils.overflow = true;
      }
      Tabmix.setItem(tabmixScrollBox, "collapsed", null);

      if (tabBar._pinnedTabsLayoutCache) {
        tabBar._pinnedTabsLayoutCache = null;
      }
      tabBar._positionPinnedTabs();
      if (isMultiRow && TMP_tabDNDObserver.paddingLeft)
        TMP_tabDNDObserver.paddingLeft = Tabmix.getStyle(tabBar, "paddingLeft");
    }

    this.widthFitTitle = Tabmix.prefs.getBoolPref("flexTabs") &&
                    (tabBar.mTabMaxWidth != tabBar.mTabMinWidth);
    Tabmix.setItem(tabBar, "widthFitTitle", this.widthFitTitle || null);

    if (Tabmix.prefs.getIntPref("tabs.closeButtons") == 5 && this.widthFitTitle)
      Tabmix.prefs.setIntPref("tabs.closeButtons", 1);

    // fix bug in positioning the popup off screen or on the button when window
    // is not maximize or when tab bar is in the bottom
    Tabmix.setItem("allTabsMenu-allTabsView", "position",
      (window.windowState != window.STATE_MAXIMIZED || this.position == 1) ? "start_before" : "after_end");

    // for light weight themes
    Tabmix.setItem("main-window", "tabmix_lwt", isMultiRow || this.position == 1 || null);

    for (let i = 0; i < tabBar.allTabs.length; i++) {
      let aTab = tabBar.allTabs[i];
      // treeStyleTab code come after SessionManager... look in extensions.js
      TabmixSessionManager.updateTabProp(aTab);
    }

    if (tabBar.mCloseButtons == 5)
      tabBar._updateCloseButtons(true);

    // show on tabbar
    let tabstripClosebutton = document.getElementById("tabmix-tabs-closebutton");
    if (this.isButtonOnTabsToolBar(tabstripClosebutton))
      tabstripClosebutton.collapsed = Tabmix.prefs.getBoolPref("hideTabBarButton");
    let allTabsButton = document.getElementById("alltabs-button");
    if (this.isButtonOnTabsToolBar(allTabsButton)) {
      allTabsButton.collapsed = !Services.prefs.getBoolPref("browser.tabs.tabmanager.enabled");
      Tabmix.setItem("tabbrowser-tabs", "showalltabsbutton", !allTabsButton.collapsed || null);
    }
    Tabmix.setItem("TabsToolbar", "tabBarSpace", Tabmix.prefs.getBoolPref("tabBarSpace") || null);
    this.setShowNewTabButtonAttr();

    if (start)
      window.setTimeout(() => this.updateScrollStatus(), 0);
    else
      this.updateScrollStatus();

    window.setTimeout(_currentVisible => {
      if (_currentVisible)
        gBrowser.ensureTabIsVisible(gBrowser.selectedTab);
      this.updateBeforeAndAfter();
    }, 50, currentVisible);
  },

  setShowNewTabButtonAttr() {
    let newTabButton = document.getElementById("new-tab-button");
    let showNewTabButton = Tabmix.prefs.getBoolPref("newTabButton") &&
        this.isButtonOnTabsToolBar(newTabButton);
    let position = Tabmix.prefs.getIntPref("newTabButton.position");
    gTMPprefObserver.setShowNewTabButtonAttr(showNewTabButton, position);
  },

  updateTabsInTitlebarAppearance() {
    if ((this.isMultiRow && !this._updatingAppearance ||
        this.getTabsPosition() != this._tabsPosition)) {
      const rows = this.visibleRows;
      gBrowser.tabContainer.arrowScrollbox._singleRowHeight = null;
      this.updateScrollStatus();
      if (!this._updatingAppearance && rows != this.visibleRows) {
        this._updatingAppearance = true;
        TabsInTitlebar._update();
        this._updatingAppearance = false;
      }
    }
  },

  updateScrollStatus: function TMP_updateScrollStatus(delay) {
    if (delay) {
      if (this.updateScrollStatus.timeout) {
        return;
      }
      this.updateScrollStatus.timeout = setTimeout(() => {
        this.updateScrollStatus.timeout = null;
      }, 250);
    }
    var tabBar = gBrowser.tabContainer;
    if (this.isMultiRow) {
      //XXX we only need setFirstTabInRow from here when tab width changed
      // so if widthFitTitle is false we need to call it if we actually change the width
      // for other chases we need to call it when we change title
      if (tabBar.hasAttribute("multibar")) {
        this.setFirstTabInRow();
        Tabmix.tabsUtils.updateVerticalTabStrip();
      }
    } else {
      Tabmix.tabsUtils.adjustNewtabButtonVisibility();
    }
  },

  _tabsPosition: "tabsonbottom",
  getTabsPosition: function TMP_getTabsPosition() {
    let tabsPosition, docElement = document.documentElement;
    if (docElement.getAttribute("tabsintitlebar") == "true")
      tabsPosition = "tabsintitlebar";
    else
      tabsPosition = "tabsonbottom";

    return tabsPosition;
  },

  get singleRowHeight() {
    return gBrowser.tabContainer.arrowScrollbox.singleRowHeight;
  },

  _waitAfterMaximized: false,
  _handleResize: function TMP__handleResize() {
    var tabBar = gBrowser.tabContainer;
    if (this.isMultiRow) {
      this.setFirstTabInRow();
      if (!tabBar.hasAttribute("multibar")) {
        tabBar.arrowScrollbox._enterVerticalMode();
        this.updateBeforeAndAfter();
      } else {
        this._waitAfterMaximized = window.windowState == window.STATE_MAXIMIZED;
        setTimeout(() => {
          this._waitAfterMaximized = false;
          Tabmix.tabsUtils.updateVerticalTabStrip();
          this.updateBeforeAndAfter();
        }, 0);
      }
    }
    /// maybe we cad add this to the popupshowing / or as css rule ?
    Tabmix.setItem("allTabsMenu-allTabsView", "position",
      (window.windowState != window.STATE_MAXIMIZED || this.position == 1) ? "start_before" : "after_end");
  },

  // Update positional attributes when we are in multi-row mode
  updateBeforeAndAfter: function TMP_updateBeforeAndAfter(onlyHoverAtt) {
    let tabBar = gBrowser.tabContainer;
    let multibar = tabBar.hasAttribute("multibar");
    let tabRow, topY;

    let numPinnedTabs = gBrowser._numPinnedTabs;
    let updateAtt = function(tab, type, attrib, visible) {
      // special case is when scrollButtonsMode is in one row and
      // selected or hovered tab is last pinned or first non-pinned tab
      let isSpecialTab = function() {
        if (!tab)
          return false;
        if (/^before/.test(attrib))
          return tab._tPos == numPinnedTabs - 1 ? "before" : false;
        return tab._tPos == numPinnedTabs ? "after" : false;
      };
      let getAttVal = function(val, hoverAttr) {
        if (!isSpecialTab() || hoverAttr && visible && /selected/.test(attrib))
          return val;
        return val ? "special" : val;
      };

      let removed = "tabmix-removed-" + attrib;
      let oldTab = Tabmix.tabsUtils._tabmixPositionalTabs[type];
      if (oldTab && tab != oldTab) {
        oldTab.removeAttribute(removed);
      }
      Tabmix.tabsUtils._tabmixPositionalTabs[type] = tab;
      if (tab && (multibar || tab.hasAttribute(removed) || isSpecialTab())) {
        let sameRow = multibar ? tabRow == Tabmix.tabsUtils.getTabRowNumber(tab, topY) || null : true;
        Tabmix.setItem(tab, removed, !sameRow || null);
        Tabmix.setItem(tab, attrib, getAttVal(sameRow, true));
        if (visible) {
          Tabmix.setItem(tab, attrib + "-visible", getAttVal(sameRow));
        }
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

    let selected = gBrowser._switcher ? gBrowser._switcher.visibleTab : gBrowser.selectedTab;
    let prev = null, next = null;
    if (!selected.closing) {
      let visibleTabs = Tabmix.visibleTabs.tabs;
      if (!visibleTabs.length)
        return;
      let selectedIndex = visibleTabs.indexOf(selected);
      if (selectedIndex > 0)
        prev = visibleTabs[selectedIndex - 1];
      next = tabBar._afterSelectedTab;
    }

    if (multibar) {
      topY = topY || Tabmix.tabsUtils.topTabY;
      tabRow = Tabmix.tabsUtils.getTabRowNumber(selected, topY);
    }
    updateAtt(prev, "beforeSelectedTab", "beforeselected", true);
    updateAtt(next, "afterSelectedTab", "afterselected", true);
  },

  inSameRow: function TMP_inSameRow(tab1, tab2) {
    if (!tab1 || !tab2)
      return false;

    var topY = Tabmix.tabsUtils.topTabY;
    return Tabmix.tabsUtils.getTabRowNumber(tab1, topY) ==
      Tabmix.tabsUtils.getTabRowNumber(tab2, topY);
  },

  setFirstTabInRow() {
    var tabBar = gBrowser.tabContainer;
    // call our tabstrip function only when we are in multi-row and
    // in overflow with pinned tabs
    if (this.isMultiRow && Tabmix.tabsUtils.overflow && tabBar.allTabs[0].pinned) {
      tabBar.arrowScrollbox.setFirstTabInRow();
    }
  },

  removeShowButtonAttr() {
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
    const _gBrowser = window.gBrowser || window._gBrowser;
    return (this.tabBar = _gBrowser.tabContainer);
  },

  get scrollClientRect() {
    return this.tabBar.arrowScrollbox.scrollClientRect;
  },

  getInnerbox() {
    return this.tabBar.arrowScrollbox.scrollbox;
  },

  get inDOMFullscreen() {
    return document.documentElement.hasAttribute("inDOMFullscreen");
  },

  get visible() {
    return !this.getCollapsedState.collapsed;
  },

  get getCollapsedState() {
    const toolbar = document.getElementById("TabsToolbar");
    const tabBar = gBrowser.tabContainer;
    const toolbarCollapsed = toolbar.collapsed;
    const tabBarCollapsed = tabBar.collapsed;
    const collapsed = toolbarCollapsed || tabBarCollapsed;
    return {collapsed, toolbar, tabBar, toolbarCollapsed, tabBarCollapsed};
  },

  events: ["dblclick", "click"],

  init() {
    TMP_eventListener.toggleEventListener(this.tabBar, this.events, true, this);

    if (this.initialized) {
      Tabmix.log("initializeTabmixUI - some extension initialize tabbrowser-tabs binding again");
      this.initializeTabmixUI();
      return;
    }
    this.initialized = true;

    const tab = this.tabBar.allTabs[0];

    Tabmix.rtl = RTL_UI;
    Tabmix.ltr = !RTL_UI;

    // don't set button to left side if it is not inside tab-content
    let button = tab.getElementsByClassName("tab-close-button")[0];
    Tabmix.defaultCloseButtons = button && button.parentNode.className == "tab-content";
    let onLeft = Tabmix.defaultCloseButtons && Tabmix.prefs.getBoolPref("tabs.closeButtons.onLeft");
    this.tabBar.setAttribute("closebuttons-side", onLeft ? "left" : "right");

    // mCloseButtons is not in firefox code since Firefox 31 bug 865826
    this.tabBar.mCloseButtons = Tabmix.prefs.getIntPref("tabs.closeButtons");
    this._keepLastTab = Tabmix.prefs.getBoolPref("keepLastTab");
    this.closeButtonsEnabled = Tabmix.prefs.getBoolPref("tabs.closeButtons.enable");
    this._tabmixPositionalTabs = {
      beforeSelectedTab: null,
      afterSelectedTab: null,
      beforeHoveredTab: null,
      afterHoveredTab: null
    };

    Tabmix.afterTabsButtonsWidth = [35];
    Tabmix.tabsNewtabButton =
      this.tabBar.getElementsByAttribute("command", "cmd_newNavigatorTab")[0];
    this._show_newtabbutton = "aftertabs";

    let attr = ["notpinned", "autoreload", "protected", "locked"].filter(att => {
      return Tabmix.prefs.getBoolPref("extraIcons." + att);
    });
    if (attr.length)
      this.tabBar.setAttribute("tabmix_icons", attr.join(" "));

    Tabmix._debugMode = TabmixSvc.debugMode();

    // initialize first tab
    Tabmix._nextSelectedID = 1;
    TMP_eventListener.setTabAttribute(tab);
    setTimeout(() => TMP_eventListener.setTabAttribute(tab), 500);
    tab.setAttribute("tabmix_selectedID", Tabmix._nextSelectedID++);
    tab.setAttribute("visited", true);
    Tabmix.setTabStyle(tab);
    TabmixTabbar.lockallTabs = Tabmix.prefs.getBoolPref("lockallTabs");
    if (TabmixTabbar.lockallTabs) {
      tab.setAttribute("locked", true);
      tab.tabmix_allowLoad = false;
    }
    if ("linkedBrowser" in tab)
      Tabmix.tablib.setLoadURI(tab.linkedBrowser);

    Tabmix.multiRow.init();
    Tabmix.initialization.run("beforeStartup", gBrowser, this.tabBar);
  },

  onUnload() {
    if (!this.initialized)
      return;
    TMP_eventListener.toggleEventListener(this.tabBar, this.events, false, this);
    this._tabmixPositionalTabs = null;
  },

  handleEvent(aEvent) {
    switch (aEvent.type) {
      case "MozMouseHittest":
        if (Tabmix.keyModifierDown && !document.hasFocus()) {
          Tabmix.keyModifierDown = false;
        }
        if (aEvent.button === 0 && (Tabmix.keyModifierDown || aEvent.detail > 0))
          aEvent.stopPropagation();
        break;
      case "dblclick":
        if (Tabmix.prefs.getBoolPref("tabbar.click_dragwindow") &&
            Tabmix.prefs.getBoolPref("tabbar.dblclick_changesize") &&
            !TabmixSvc.isMac && aEvent.target.localName === "arrowscrollbox") {
          let displayAppButton = !(document.getElementById("titlebar")).hidden;
          if (TabsInTitlebar.enabled || displayAppButton) {
            return;
          }
        }
        TabmixTabClickOptions.onTabBarDblClick(aEvent);
        break;
      case "click":
        TabmixTabClickOptions.onTabClick(aEvent);
        break;
    }
  },

  initializeTabmixUI() {
    // something reset the toolbars...
    const resetSettings = this.topTabY == 0;

    if (typeof this.tabBar.arrowScrollbox.connectTabmix !== "function") {
      Tabmix.multiRow.init();
    }

    // https://addons.mozilla.org/EN-US/firefox/addon/vertical-tabs/
    // verticalTabs 0.9.1+ is restartless.
    let isVertical = Tabmix.extensions.verticalTabs;
    TMP_extensionsCompatibility.setVerticalTabs();
    if (isVertical != Tabmix.extensions.verticalTabs) {
      Tabmix.setItem("TabsToolbar", "collapsed", null);
      TabmixTabbar.updateSettings();
    }

    // tabbrowser-tabs constructor reset first tab label to New Tab
    gBrowser.setTabTitle(this.tabBar.allTabs[0]);
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
    Tabmix.navToolbox.setScrollButtons(true);

    // fix incompatibility with Personal Titlebar extension
    // the extensions trigger tabbar binding reset on toolbars customize
    // we need to init our ui settings from here and again after customization
    if (Tabmix.navToolbox.customizeStarted || resetSettings) {
      TabmixTabbar.visibleRows = 1;
      TabmixTabbar.updateSettings(false);
      Tabmix.navToolbox.resetUI = true;
    }

    if (Tabmix.extensions.verticalTabs) {
      // when Vertical Tabs Reloaded installed TabsInTitlebar was not initialized
      TabsInTitlebar.init();
    }
  },

  updateVerticalTabStrip(aReset) {
    if (Tabmix.extensions.verticalTabBar || gInPrintPreviewMode ||
        this.inDOMFullscreen || FullScreen._isChromeCollapsed ||
        TabmixTabbar._waitAfterMaximized ||
        !Tabmix.tabsUtils.visible && TabmixTabbar.visibleRows == 1)
      return null;
    if (this._inUpdateVerticalTabStrip)
      return this.tabBar.getAttribute("multibar");
    this._inUpdateVerticalTabStrip = true;

    // we must adjustNewtabButtonVisibility before get lastTabRowNumber
    this.adjustNewtabButtonVisibility();
    // this.lastTabRowNumber is null when we hide the tabbar
    let rows = aReset || this.tabBar.allTabs.length == 1 ? 1 : (this.lastTabRowNumber || 1);

    let currentMultibar = this.tabBar.getAttribute("multibar") || null;
    let maxRow = Tabmix.prefs.getIntPref("tabBarMaxRow");
    // we need to check for the case that last row of tabs is empty and we still have hidden row on top
    // this can occur when we close last tab in the last row or when some tab changed width
    if (rows > 1 && rows - maxRow < 0 && this.overflow &&
        this.canScrollTabsLeft) {
      // try to scroll all the way up
      this.tabBar.arrowScrollbox.scrollByPixels((rows - maxRow) * this.tabBar.arrowScrollbox.singleRowHeight);
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
      // set multibar also at _enterVerticalMode
      Tabmix.setItem(this.tabBar, "multibar", multibar);
      Tabmix.setItem("tabmix-bottom-toolbox", "multibar", multibar);
    }

    TabmixTabbar.visibleRows = rows;

    if (TabmixTabbar.isMultiRow) {
      this.overflow = multibar == "scrollbar";
    }

    this._inUpdateVerticalTabStrip = false;
    return multibar;
  },

  /**
   * check that we have enough room to show new tab button after the last tab
   * in the current row. we don't want the button to be on the next row when the
   * tab is on the current row
   */
  adjustNewtabButtonVisibility() {
    if (!TabmixTabbar.isMultiRow || this.tabBar.arrowScrollbox.getAttribute('orient') == "vertical") {
      return;
    }

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
        let tabstripEnd = this.tabBar.arrowScrollbox.scrollbox.screenX +
            this.tabBar.arrowScrollbox.scrollbox.getBoundingClientRect().width;

        const {width} = Tabmix.tabsNewtabButton.getBoundingClientRect();
        let buttonEnd = Tabmix.tabsNewtabButton.screenX + width;
        this.disAllowNewtabbutton = buttonEnd > tabstripEnd;
      } else {
        this.disAllowNewtabbutton = true;
      }
      return;
    }
    // button is NOT visible
    //         A: 2 last tabs are in the same row:
    //            check if we have room for the button in this row
    //         B: 2 last tabs are NOT in the same row:
    //            check if we have room for the last tab + button after
    //            previous to last tab.
    // ignore the case that this tab width is larger then the tabbar
    let previousTab = Tabmix.visibleTabs.previous(lastTab);
    if (!previousTab) {
      this.disAllowNewtabbutton = false;
      return;
    }

    const getWidth = item => item.getBoundingClientRect().width;

    // buttons that are not on TabsToolbar or not visible are null
    let newTabButtonWidth = function(aOnSide) {
      let width = 0, privateTabButton = TabmixTabbar.newPrivateTabButton();
      if (privateTabButton) {
        width += aOnSide ? getWidth(privateTabButton) : Tabmix.afterTabsButtonsWidth[1];
      }
      if (Tabmix.sideNewTabButton) {
        width += aOnSide ? getWidth(Tabmix.sideNewTabButton) :
          Tabmix.afterTabsButtonsWidth[0];
      }
      return width;
    };
    let tsbo = this.tabBar.arrowScrollbox.scrollbox;
    let tsboEnd = tsbo.screenX + tsbo.getBoundingClientRect().width + newTabButtonWidth(true);
    if (TabmixTabbar.inSameRow(lastTab, previousTab)) {
      let buttonEnd = lastTab.screenX + getWidth(lastTab) +
          newTabButtonWidth();
      this.disAllowNewtabbutton = buttonEnd > tsboEnd;
      return;
    }
    let lastTabEnd = previousTab.screenX +
    getWidth(previousTab) + getWidth(lastTab);
    // both last tab and new tab button are in the next row
    if (lastTabEnd > tsboEnd)
      this.disAllowNewtabbutton = false;
    else
      this.disAllowNewtabbutton = lastTabEnd + newTabButtonWidth() > tsboEnd;
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
    if (this.tabBar.arrowScrollbox.getAttribute('orient') == "vertical") {
      return val;
    }

    // we may get here after tabBar overflow/underflow already finished
    if (val != this.overflow ||
        val != document.getElementById("tabmix-scrollbox").hasAttribute("overflowing")) {
      let tabBar = this.tabBar;
      let tabstrip = tabBar.arrowScrollbox;
      Tabmix.setItem("tabmix-scrollbox", "overflowing", val || null);
      this.showNewTabButtonOnSide(val, "right-side");

      // arrowScrollbox and tabbrowser-tabs overflow/underflow listeners skip vertical event
      // when event.detail is 0

      // update arrowScrollbox
      tabstrip.updateOverflow(val);

      // update tabbrowser-tabs
      if (TabmixTabbar.isMultiRow) {
        if (val) {
          tabBar.setAttribute("overflow", "true");
          tabBar._positionPinnedTabs();
          tabBar._handleTabSelect(true);
        } else {
          tabBar.removeAttribute("overflow");
          if (tabBar._lastTabClosedByMouse) {
            tabBar._expandSpacerBy(tabBar._scrollButtonWidth);
          }
          for (let tab of Array.from(gBrowser._removingTabs)) {
            gBrowser.removeTab(tab);
          }
          tabBar._positionPinnedTabs();
        }
      }
    }
    return val;
  },

  showNewTabButtonOnSide(aCondition, aValue) {
    if (this._show_newtabbutton) {
      Tabmix.setItem("TabsToolbar", "tabmix-show-newtabbutton",
        aCondition ? aValue : this._show_newtabbutton);
    }
  },

  get topTabY() {
    return this.scrollClientRect.top +
      Tabmix.getStyle(this.tabBar.arrowScrollbox.scrollbox, "paddingTop") - this.tabBar.arrowScrollbox.scrollPosition;
  },

  get lastTabRowNumber() {
    return this.getTabRowNumber(Tabmix.visibleTabs.last, this.topTabY);
  },

  getTabRowNumber(aTab, aTop) {
    let {top, height = 0} = aTab ? aTab.getBoundingClientRect() : {};
    if (!height) // don't panic
      return 1;
    // some theme add marginTop/marginBottom to tabs
    var cStyle = window.getComputedStyle(aTab);
    var marginTop = parseInt(cStyle.marginTop) || 0;
    var marginBottom = parseInt(cStyle.marginBottom) || 0;
    height += marginTop + marginBottom;

    var tabBottom = top - marginTop + height;
    return Math.round((tabBottom - aTop) / height);
  },

  get canScrollTabsLeft() {
    return !this.tabBar.arrowScrollbox._scrollButtonUp.disabled;
  },

  get canScrollTabsRight() {
    return !this.tabBar.arrowScrollbox._scrollButtonDown.disabled;
  },

  createTooltip(box) {
    let rows = this.lastTabRowNumber;
    let active = this.getTabRowNumber(gBrowser.selectedTab, this.topTabY);
    let rowsStr = TabmixSvc.getString("rowsTooltip.rowscount");
    let activeStr = TabmixSvc.getString("rowsTooltip.activetab");
    box.label = PluralForm.get(rows, rowsStr).replace("#1", rows) +
        "\n" + activeStr.replace("#1", active);
  },

  isSingleRow(visibleTabs) {
    if (!this.tabBar.hasAttribute("multibar"))
      return true;
    // we get here when we are about to go to single row
    // one tab before the last is in the first row and we are closing one tab
    let tabs = visibleTabs || Tabmix.visibleTabs.tabs;
    return this.getTabRowNumber(tabs[tabs.length - 2], this.topTabY) == 1;
  },

  _resizeObserver: null,
  resizeObserver(observe) {
    if (!observe && !this._resizeObserver) {
      return;
    }
    if (!this._resizeObserver) {
      this._resizeObserver = new window.ResizeObserver(entries => {
        for (let entry of entries) {
          if (entry.contentBoxSize) {
            this.updateVerticalTabStrip();
            break;
          }
        }
      });
    }
    if (observe && !gBrowser.tabContainer._isCustomizing) {
      this._resizeObserver.observe(this.tabBar);
    } else {
      this._resizeObserver.unobserve(this.tabBar);
    }
  },

  /**** gBrowser.tabContainer.arrowScrollbox helpers ****/
  /**
   * this function is here for the case restart-less extension override our
   * arrowScrollbox binding when Tabmix's uses its own scroll buttons
   */
  updateScrollButtons(useTabmixButtons) {
    let tabstrip = this.tabBar.arrowScrollbox;
    tabstrip._scrollButtonDown = useTabmixButtons ?
      tabstrip._scrollButtonDownRight :
      tabstrip._scrollButtonDownLeft || // fall back to original
      tabstrip.shadowRoot.getElementById("scrollbutton-down");
    this.tabBar._animateElement = tabstrip._scrollButtonDown;

    tabstrip._scrollButtonUp = useTabmixButtons ?
      tabstrip._scrollButtonUpRight :
      tabstrip._scrollButtonUpLeft || // fall back to original
      tabstrip.shadowRoot.getElementById("scrollbutton-up");
    tabstrip._updateScrollButtonsDisabledState();
  },

  isElementVisible(element) {
    if (!element || !element.parentNode || element.collapsed || element.hidden)
      return false;

    // pinned tabs are always visible
    if (element.pinned)
      return true;

    let round = val => Math.ceil(val);
    var [start, end] = this.tabBar.arrowScrollbox.startEndProps;
    var rect = this.tabBar.arrowScrollbox.scrollClientRect;
    var containerStart = round(rect[start]);
    var containerEnd = round(rect[end]);
    rect = element.getBoundingClientRect();
    var elementStart = round(rect[start]);
    var elementEnd = round(rect[end]);

    // we don't need the extra check with scrollContentRect
    // like in ensureElementIsVisible, the element will be invisible anyhow.
    if (elementStart < containerStart)
      return false;
    else if (containerEnd < elementEnd)
      return false;

    return true;
  },

  get protonValues() {
    // rules to add proton --tab-block-margin to --tab-min-height_mlt
    // we update tab-block-margin dynamically in updateVerticalTabStrip when
    // there are more than one row

    // 86: @supports -moz-bool-pref("browser.proton.tabs.enabled") --proton-tab-block-margin: 2px;
    // 87-88: @supports -moz-bool-pref("browser.proton.tabs.enabled") --proton-tab-block-margin: 4px;
    // 89-90: @media (-moz-proton) --proton-tab-block-margin: 4px;
    // 91: no @media --tab-block-margin: 4px;
    const blockMargin = Object.entries({
      86: {name: "--proton-tab-block-margin", val: "2px", margin: "1px"},
      87: {name: "--proton-tab-block-margin", val: "4px", margin: "3px"},
      91: {name: "--tab-block-margin", val: "4px", margin: "3px"},
    }).reduce((acc, [version, val]) => {
      return Tabmix.isVersion(version * 10) ? val : acc;
    }, []);

    const protonPrefVal = Services.prefs.getBoolPref("browser.proton.tabs.enabled", false);
    const isEnabled = () => {
      if (!Tabmix.isVersion(890)) {
        // only use the pref value from the time the browser start
        // it's in use by: @supports -moz-bool-pref("browser.proton.tabs.enabled")
        return protonPrefVal;
      }
      if (!Tabmix.isVersion(910)) {
        return Services.prefs.getBoolPref("browser.proton.enabled", false);
      }
      return true;
    };

    Object.defineProperty(Tabmix.tabsUtils, "protonValues", {
      configurable: true,
      enumerable: true,
      get() {
        return {...blockMargin, enabled: isEnabled()};
      }
    });
    return {...blockMargin, enabled: isEnabled()};
  },

  updateProtonValues() {
    // we reduce tab-block-margin to 1px on tab-background to minimize gap between rows,
    // and add the difference to #tabbrowser-arrowscrollbox margin top/bottom
    // with --tabmix-multirow-margin
    const reduceMargin = this.protonValues.enabled &&
      gBrowser.tabContainer.attributes.orient.value === "horizontal" &&
      TabmixTabbar.visibleRows > 1;
    const margin = reduceMargin ? "1px" : "";
    document.documentElement.style.setProperty(this.protonValues.name, margin);
  },
};

Tabmix.bottomToolbarUtils = {
  get toolbox() {return document.getElementById("tabmix-bottom-toolbox");},

  init() {
    if (TabmixSvc.isG3Waterfox) {
      return;
    }

    if (!this.toolbox && TabmixTabbar.position === 1) {
      this.createToolbox();
      this.createFullScrToggler();
    }
    this.resizeObserver();
  },

  createToolbox() {
    var updateFullScreen,
        tabBar = gBrowser.tabContainer;
    Tabmix.setItem(tabBar.arrowScrollbox, "flowing", TabmixTabbar.flowing);
    const multibar = gBrowser.tabContainer.getAttribute("multibar") ? ` multibar="true"` : ``;
    const fragment = MozXULElement.parseXULToFragment(
      `<vbox id="tabmix-bottom-toolbox"${multibar}>
         <toolbox></toolbox>
       </vbox>`
    );
    fragment.collapsed = gBrowser.tabContainer.collapsed;
    const referenceNode =
        document.getElementById("customization-container")?.nextSibling ??
        document.getElementById("fullscreen-and-pointerlock-wrapper")?.nextSibling ??
        document.getElementById("browser-bottombox");
    referenceNode.parentNode.insertBefore(fragment, referenceNode);
    delete this.toolbox;
    this.toolbox = document.getElementById("tabmix-bottom-toolbox");
    updateFullScreen = window.fullScreen;

    if (!Tabmix.tabsUtils.visible) {
      // the tabbar is hidden on startup
      let height = tabBar.arrowScrollbox.scrollClientRect.height;
      this.toolbox.firstChild.style.setProperty("height", height + "px", "important");
      let tabsToolbar = document.getElementById("TabsToolbar");
      tabsToolbar.style.setProperty("top", screen.availHeight + "px", "important");
      Tabmix.setItem("TabsToolbar-customization-target", "width", screen.availWidth);
    }
    if (updateFullScreen) {
      TMP_eventListener.toggleTabbarVisibility(false);
      TabmixTabbar.updateSettings(false);
    }
  },

  createFullScrToggler() {
    const fullScrToggler = document.createXULElement("vbox");
    fullScrToggler.id = "fullscr-bottom-toggler";
    fullScrToggler.hidden = true;
    const toggler = document.getElementById("fullscr-toggler");
    toggler.parentNode.insertBefore(fullScrToggler, toggler);

    let $LF = '\n    ';
    Tabmix.changeCode(FullScreen, "FullScreen.hideNavToolbox")._replace(
      'this._isChromeCollapsed = true;',
      'TMP_eventListener._updateMarginBottom(gNavToolbox.style.marginTop);' + $LF +
        '$&' + $LF +
        'TMP_eventListener.toggleTabbarVisibility(false, arguments[0]);'
    ).toCode();
  },

  _resizeObserver: null,
  _observing: new Set(),

  resizeObserver(elementId = "browser", isCustomizing) {
    let observe = TabmixTabbar.position === 1;
    if (!observe || TabmixSvc.isG3Waterfox) {
      if (this._observing.size) {
        this._observing.clear();
        this._resizeObserver.disconnect();
      }
      return;
    }

    if (!this._resizeObserver) {
      this._resizeObserver = new window.ResizeObserver(entries => {
        for (let entry of entries) {
          if (entry.contentBoxSize) {
            this._update();
            break;
          }
        }
      });
    }

    if (elementId === "customization-container") {
      observe = isCustomizing;
    }

    const element = document.getElementById(elementId);
    if (observe) {
      this._observing.add(elementId);
      this._resizeObserver.observe(element);
    } else {
      this._observing.delete(elementId);
      this._resizeObserver.unobserve(element);
    }
  },

  _bottomRect: {top: null},
  _customizingMinTop: 455,

  _update() {
    let {top} = this.toolbox.getBoundingClientRect();
    if (gBrowser.tabContainer._isCustomizing && top < this._customizingMinTop) {
      top = this._customizingMinTop;
    }
    if (this._bottomRect.top != top) {
      this._bottomRect.top = top;
      document.documentElement.style.setProperty("--tabmix-bottom-toolbox-top", `${top}px`);
    }
  },
};

Tabmix.visibleTabs = {
  get tabs() {
    return gBrowser.tabContainer._getVisibleTabs();
  },

  get first() {
    const tabs = gBrowser.tabs;
    for (let i = 0; i < tabs.length; i++) {
      let tab = tabs[i];
      if (!tab.hidden && !tab.closing)
        return tab;
    }
    return gBrowser.selectedTab;
  },

  get last() {
    // we only need the last visible tab,
    // find it directly instead of using gBrowser.tabContainer visibleTabs
    const tabs = gBrowser.tabs;
    for (let i = tabs.length - 1; i >= 0; i--) {
      let tab = tabs[i];
      if (!tab.hidden && !tab.closing)
        return tab;
    }
    return gBrowser.selectedTab;
  },

  previous(aTab) {
    const tabs = this.tabs;
    var index = tabs.indexOf(aTab);
    if (--index > -1)
      return tabs[index];
    return null;
  },

  next(aTab) {
    const tabs = this.tabs;
    var index = tabs.indexOf(aTab);
    if (index > -1 && ++index < tabs.length)
      return tabs[index];
    return null;
  },

  indexOf(aTab) {
    if (aTab)
      return this.tabs.indexOf(aTab);
    return -1;
  }
};

// Function to catch changes to Tab Mix preferences and update existing windows and tabs
//
gTMPprefObserver = {
  preventUpdate: false,
  init() {
    Tabmix.prefs.clearUserPref("setDefault");
    Tabmix.prefs.clearUserPref("PrefObserver.error");

    let addObserver = (pref, condition) => {
      if (condition)
        this.OBSERVING.push(pref);
    };
    addObserver(TabmixSvc.sortByRecentlyUsed, true);
    addObserver("browser.proton.enabled", Tabmix.isVersion(890));

    try {
      // add Observer
      for (var i = 0; i < this.OBSERVING.length; ++i)
        Services.prefs.addObserver(this.OBSERVING[i], this);
    } catch (e) {
      Tabmix.log("prefs-Observer failed to attach:\n" + e);
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
    "browser.tabs.tabmanager.enabled",
    "browser.tabs.insertAfterCurrent",
    "browser.tabs.insertRelatedAfterCurrent",
  ],

  // removes the observer-object from service -- called when the window is no longer open
  removeObservers() {
    let prefSvc = Services.prefs;
    for (var i = 0; i < this.OBSERVING.length; ++i)
      prefSvc.removeObserver(this.OBSERVING[i], this);
  },

  /**
   * Observer-function
   * subject: [wrapped nsISupports :: nsIPrefBranch], nsIPrefBranch Internal
   * topic: "changed"
   */
  prefsValues: {},
  observe: function TMP_pref_observer(subject, topic, prefName) {
    if (this.preventUpdate ||
      this.prefsValues[prefName] === TabmixSvc.prefs.get(prefName)) {
      return;
    }
    const prefValue = TabmixSvc.prefs.get(prefName);
    this.prefsValues[prefName] = prefValue;

    // if we don't have a valid window (closed)
    if (!(typeof (document) == 'object' && document)) {
      this.removeObservers(); // remove the observer..
      return; // ..and don't continue
    }

    switch (prefName) {
      case "extensions.tabmix.titlefrombookmark":
        TMP_Places.onPreferenceChanged(Services.prefs.getBoolPref(prefName));
        break;
      case "extensions.tabmix.tabbar.click_dragwindow":
        this.setTabbarDragging(Services.prefs.getBoolPref(prefName));
        /* falls through */
      case "extensions.tabmix.tabbar.dblclick_changesize": {
        let dragwindow = Tabmix.prefs.getBoolPref("tabbar.click_dragwindow");
        let changesize = Tabmix.prefs.getBoolPref("tabbar.dblclick_changesize");
        if (!dragwindow && changesize) {
          Tabmix.prefs.setBoolPref("tabbar.dblclick_changesize", false);
          changesize = !changesize;
        }
        TabmixTabClickOptions.toggleEventListener(dragwindow && !changesize);
        break;
      }
      case "extensions.tabmix.lockallTabs":
        TabmixTabbar.lockallTabs = Services.prefs.getBoolPref(prefName);
        /* falls through */
      case "extensions.tabmix.lockAppTabs": {
        if (!Tabmix.prefs.getBoolPref("updateOpenedTabsLockState"))
          break;
        let updatePinned = prefName == "extensions.tabmix.lockAppTabs";
        let lockAppTabs = Tabmix.prefs.getBoolPref("lockAppTabs");
        for (let i = 0; i < gBrowser.tabs.length; i++) {
          let tab = gBrowser.tabs[i];
          // only update for the appropriate tabs type
          if (tab.pinned == updatePinned) {
            // when user change settings to lock all tabs we always lock all tabs
            // regardless if they were lock and unlocked before by the user
            if (updatePinned ? lockAppTabs : TabmixTabbar.lockallTabs) {
              tab.setAttribute("locked", "true");
            } else {
              tab.removeAttribute("locked");
            }
            if (updatePinned) {
              tab.removeAttribute("_lockedAppTabs");
              tab.setAttribute("_locked", tab.hasAttribute("locked"));
            } else {
              tab.removeAttribute("_locked");
            }
            tab.linkedBrowser.tabmix_allowLoad = !tab.hasAttribute("locked");
          }
        }
        // force Sessionstore to save our changes
        TabmixSvc.SessionStore.saveStateDelayed(window);
        break;
      }
      case "extensions.tabmix.extraIcons.autoreload":
      case "extensions.tabmix.extraIcons.protected":
      case "extensions.tabmix.extraIcons.locked":
      case "extensions.tabmix.extraIcons.notpinned": {
        let addAtt = Services.prefs.getBoolPref(prefName);
        let name = prefName.substr(prefName.lastIndexOf(".") + 1);
        Tabmix.setAttributeList(gBrowser.tabContainer, "tabmix_icons", name, addAtt);
        break;
      }
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
      // tab appearance
      case "extensions.tabmix.currentTab":
      case "extensions.tabmix.unloadedTab":
      case "extensions.tabmix.unreadTab":
      case "extensions.tabmix.otherTab":
        this.updateTabsStyle(prefName.split(".").pop());
        break;
      case "extensions.tabmix.progressMeter":
        this.setProgressMeter();
        break;
      case "extensions.tabmix.disableBackground":
        this.updateStyleAttributes();
        break;
      case "browser.tabs.tabMaxWidth":
      case "browser.tabs.tabMinWidth": {
        var currentVisible = Tabmix.tabsUtils.isElementVisible(gBrowser._selectedTab);
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
        this.dynamicRules.width.style.setProperty("max-width", tabMaxWidth + "px", "important");
        this.dynamicRules.width.style.setProperty("min-width", tabMinWidth + "px", "important");
        TabmixTabbar.updateSettings(false);
        // we need this timeout when there are many tabs
        if (typeof this._tabWidthChanged == "undefined") {
          let self = this;
          this._tabWidthChanged = true;
          [50, 100, 250, 500].forEach(timeout => {
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
      }
      case "browser.tabs.tabClipWidth":
        gBrowser.tabContainer.mTabClipWidth = Services.prefs.getIntPref(prefName);
        gBrowser.tabContainer._updateCloseButtons();
        break;
      case "extensions.tabmix.keepLastTab":
        Tabmix.tabsUtils._keepLastTab = Services.prefs.getBoolPref(prefName);
        gBrowser.tabContainer._updateCloseButtons();
        break;
      case "browser.tabs.closeButtons":
        switch (prefValue) {
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
        Tabmix.prefs.setBoolPref("tabs.closeButtons.enable", prefValue < 2);
        // show/hide close button on the tabbar
        Tabmix.prefs.setBoolPref("hideTabBarButton", prefValue != 3);
        break;
      case "extensions.tabmix.tabs.closeButtons":
        if (prefValue < 1 || prefValue > 5) {
          Services.prefs.setIntPref(prefName, 1);
        } else if (prefValue == 5 && TabmixTabbar.widthFitTitle) {
          Services.prefs.setIntPref(prefName, 1);
        } else {
          gBrowser.tabContainer.mCloseButtons = Services.prefs.getIntPref(prefName);
          gBrowser.tabContainer._updateCloseButtons();
        }
        break;
      case "extensions.tabmix.tabs.closeButtons.onLeft": {
        let onLeft = Tabmix.defaultCloseButtons && Services.prefs.getBoolPref(prefName);
        gBrowser.tabContainer.setAttribute("closebuttons-side", onLeft ? "left" : "right");
        break;
      }
      case "extensions.tabmix.tabs.closeButtons.enable":
        Tabmix.tabsUtils.closeButtonsEnabled = prefValue;
        gBrowser.tabContainer.arrowScrollbox.offsetRatio = prefValue ? 0.70 : 0.50;
        gBrowser.tabContainer._updateCloseButtons();
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
        } else if (Services.prefs.getIntPref("browser.sessionstore.max_tabs_undo") === 0) {
          Services.prefs.clearUserPref("browser.sessionstore.max_tabs_undo");
        }
        break;
      case "browser.sessionstore.max_tabs_undo": {
        // Firefox's sessionStore maintain the right amount
        if (Tabmix.prefs.getBoolPref("undoClose") != (prefValue > 0))
          Tabmix.prefs.setBoolPref("undoClose", prefValue > 0);
        break;
      }
      /*
      // ##### disable Session Manager #####
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
        /* falls through * /
      case "extensions.tabmix.sessions.save.closedtabs":
      case "extensions.tabmix.sessions.save.history":
      case "extensions.tabmix.sessionToolsMenu":
      case "extensions.tabmix.closedWinToolsMenu":
        TabmixSessionManager.updateSettings();
        break;
      */
      case "extensions.tabmix.closedWinToolsMenu":
        document.getElementById("tabmix-historyUndoWindowMenu").hidden = !Services.prefs.getBoolPref(prefName);
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
      case "extensions.tabmix.hideTabbar.showContextMenu":
        Tabmix.handleTabbarVisibility.toggleEventListener(Services.prefs.getBoolPref(prefName));
        break;
      case "browser.tabs.autoHide":
        this.setAutoHidePref();
        break;
      case "extensions.tabmix.newTabButton.position":
        this.changeNewTabButtonSide(Services.prefs.getIntPref(prefName));
        break;
      case TabmixSvc.sortByRecentlyUsed:
      case "extensions.tabmix.lasttab.tabPreviews":
      case "extensions.tabmix.lasttab.respondToMouseInTabList":
      case "extensions.tabmix.lasttab.showTabList":
        setTimeout(() => {
          // wait until ctrlTab observer finished (ctrlTab.observe, ctrlTab.readPref)
          TMP_LastTab.ReadPreferences();
        }, 0);
        break;
      case "extensions.tabmix.reloadEvery.onReloadButton":
        this.showReloadEveryOnReloadButton();
        break;
      case "extensions.tabmix.tabBarMaxRow": {
        var tabBar = gBrowser.tabContainer;
        let row = Tabmix.prefs.getIntPref("tabBarMaxRow");
        if (row < 2) {
          Tabmix.prefs.setIntPref("tabBarMaxRow", 2);
          return;
        }
        this.dynamicRules["max-rows"].style.setProperty('--tabs-lines', row);
        // maxRow changed
        if (TabmixTabbar.isMultiRow) {
          let isVisible = Tabmix.tabsUtils.isElementVisible(gBrowser._selectedTab);
          // we hide the button to see if tabs can fits to fewer rows without the scroll buttons
          if (Tabmix.tabsUtils.overflow && row > TabmixTabbar.visibleRows)
            Tabmix.tabsUtils.overflow = false;
          // after we update the height check if we are still in overflow
          if (Tabmix.tabsUtils.updateVerticalTabStrip() == "scrollbar") {
            Tabmix.tabsUtils.overflow = true;
            tabBar.arrowScrollbox._updateScrollButtonsDisabledState();
            if (isVisible)
              gBrowser.ensureTabIsVisible(gBrowser.selectedTab, false);
          }
        }
        TabmixTabbar.updateBeforeAndAfter();
        break;
      }
      case "extensions.tabmix.pinnedTabScroll":
        gBrowser.tabContainer._positionPinnedTabs();
        break;
      case "extensions.tabmix.offsetAmountToScroll":
        gBrowser.tabContainer.arrowScrollbox.offsetAmountToScroll = Services.prefs.getBoolPref(prefName);
        break;
      case "browser.tabs.onTop":
        if (TabmixTabbar.position == 1 && Services.prefs.getBoolPref(prefName)) {
          Services.prefs.setBoolPref(prefName, false);
          return;
        }
        // multi-rows total heights can be different when tabs are on top
        if (TabmixTabbar.visibleRows > 1) {
          Tabmix.tabsUtils.updateVerticalTabStrip();
        }
        break;
      case "extensions.tabmix.hideTabBarButton":
      case "extensions.tabmix.tabBarMode":
      case "extensions.tabmix.tabBarSpace":
      case "browser.tabs.tabmanager.enabled":
      case "extensions.tabmix.newTabButton":
      case "extensions.tabmix.flexTabs":
      case "extensions.tabmix.setDefault":
        TabmixTabbar.updateSettings(false);
        break;
      case "extensions.tabmix.moveTabOnDragging":
        TMP_tabDNDObserver._moveTabOnDragging = prefValue;
        break;
      case "layout.css.devPixelsPerPx":
        setTimeout(() => this.setBgMiddleMargin(), 0);
        break;
      case "extensions.tabmix.showTabContextMenuOnTabbar":
        TabmixContext.updateTabbarContextMenu(Services.prefs.getBoolPref(prefName));
        break;
      case "browser.proton.enabled":
        Tabmix.tabsUtils.updateProtonValues();
        break;
      case "browser.tabs.insertAfterCurrent":
        // browser.tabs.insertAfterCurrent defult is false, in the case both pref
        // is true turn browser.tabs.insertRelatedAfterCurrent off
        if (!Services.wm.getMostRecentWindow("mozilla:tabmixopt") &&
            prefValue && Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent")) {
          Services.prefs.setBoolPref("browser.tabs.insertRelatedAfterCurrent", false);
        }
        break;
      case "browser.tabs.insertRelatedAfterCurrent":
        // if user manually turn insertRelatedAfterCurrent on, turn insertAfterCurrent off
        if (!Services.wm.getMostRecentWindow("mozilla:tabmixopt") && prefValue) {
          Services.prefs.setBoolPref("browser.tabs.insertAfterCurrent", false);
        }
        break;
      default:
        break;
    }
  },

  setTabbarDragging(allowDrag) {
    Tabmix.setItem("TabsToolbar-customization-target",
      "tabmix-disallow-drag", !allowDrag || null);
  },

  getStyleSheets: function TMP_PO_getStyleSheet(aHref, aFirst) {
    var styleSheet = [];
    for (let i = 0; i < document.styleSheets.length; ++i) {
      if (document.styleSheets[i].href == aHref) {
        styleSheet.push(document.styleSheets[i]);
        if (aFirst)
          break;
      }
    }
    return styleSheet;
  },

  _tabStyleSheet: null,
  get tabStyleSheet() {
    // can't find where our file is try to use: chrome://browser/content/tabbrowser.css
    var href = "chrome://tabmixplus/skin/tab.css";
    // find tab.css to insert our dynamic rules into it.
    // insert our rules into document.styleSheets[0] cause problem with other extensions
    if (!this._tabStyleSheet) {
      let ss = this.getStyleSheets(href, true);
      this._tabStyleSheet = ss.length ? ss[0] : document.styleSheets[1];
    }
    return this._tabStyleSheet;
  },

  dynamicRules: {},
  insertRule(cssText, name) {
    let index = this.tabStyleSheet.insertRule(cssText,
      this.tabStyleSheet.cssRules.length);
    if (name)
      this.dynamicRules[name] = this.tabStyleSheet.cssRules[index];
    return index;
  },

  setTabIconMargin: function TMP_PO_setTabIconMargin() {
    var [sMarginStart, sMarginEnd] = Tabmix.rtl ? ["margin-right", "margin-left"] : ["margin-left", "margin-right"];
    var icon = gBrowser._selectedTab.getElementsByClassName("tab-icon-image")[0];
    if (!icon)
      return; // nothing to do....

    /**
     *  from Firefox 3 tab-icon-image class have -moz-margin-start: value;
     *                                           -margin-end-value: value;
     *  we apply these value dynamically here to our tab-protect-icon tab-lock-icon class
     *  since each theme can use different values
     */
    let style = window.getComputedStyle(icon);
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

    let tabmix_setRule = aRule => {
      let newRule = aRule.replace(/%S/g, "tab-icon-image").replace("%PX", marginEnd);
      this.insertRule(newRule);
      newRule = aRule.replace(/%S/g, "tab-lock-icon").replace("%PX", marginEnd);
      this.insertRule(newRule);
    };
    iconRule = '#tabbrowser-tabs%favhideclose%[closebuttons-side="left"][closebuttons="alltabs"] > ' +
               '#tabbrowser-arrowscrollbox > .tabbrowser-tab:not([pinned]):not([protected])%faviconized% .%S ,' +
               '#tabbrowser-tabs%favhideclose%[closebuttons-side="left"][closebuttons="activetab"] > ' +
               '#tabbrowser-arrowscrollbox > .tabbrowser-tab:not([pinned]):not([protected])[selected="true"]%faviconized% .%S {' +
               '-moz-margin-start: %PX !important;}';
    if ("faviconize" in window) {
      let newRule = iconRule.replace(/%favhideclose%/g, ':not([favhideclose="true"])').replace(/%faviconized%/g, '');
      tabmix_setRule(newRule);
      newRule = iconRule.replace(/%favhideclose%/g, '[favhideclose="true"]')
          .replace(/%faviconized%/g, ':not([faviconized="true"])');
      tabmix_setRule(newRule);
    } else {
      let newRule = iconRule.replace(/%favhideclose%/g, '').replace(/%faviconized%/g, '');
      tabmix_setRule(newRule);
    }
  },

  setCloseButtonMargin: function TMP_PO_setCloseButtonMargin() {
    var sMarginEnd = Tabmix.rtl ? "margin-left" : "margin-right";
    var icon = gBrowser._selectedTab.getElementsByClassName("tab-close-button")[0];
    if (!icon)
      return; // nothing to do....

    // move left button that show on hover over tab title
    icon.style.setProperty("display", "-moz-box", "important");
    let iconMargin = '#tabbrowser-tabs[closebuttons-hover="notactivetab"][closebuttons-side="left"] > ' +
                     '#tabbrowser-arrowscrollbox > .tabbrowser-tab:not([pinned]):not([faviconized="true"]):not([selected="true"])' +
                     ':not([isPermaTab="true"]):not([protected]) .tab-close-button,' +
                     '#tabbrowser-tabs[closebuttons-hover="alltabs"][closebuttons-side="left"] > ' +
                     '#tabbrowser-arrowscrollbox > .tabbrowser-tab:not([pinned]):not([faviconized="true"]):not([isPermaTab="true"])' +
                     ':not([protected]) .tab-close-button {' +
                     '-moz-margin-start: 0px !important;' +
                     '-moz-margin-end: %Spx !important;}'.replace("%S", -icon.getBoundingClientRect().width);
    icon.style.removeProperty("display");
    this.insertRule(iconMargin);

    // set right margin to tab-label when close button is not right to it
    // on default theme the margin is zero, so we set the end margin to be the same as the start margin
    let style = window.getComputedStyle(icon);
    let marginEnd = style.getPropertyValue(sMarginEnd);
    let textMarginEnd = parseInt(marginEnd) ? marginEnd : this._marginStart;
    delete this._marginStart;
    let iconRule = '#tabbrowser-tabs%favhideclose%[closebuttons="noclose"] > ' +
        '#tabbrowser-arrowscrollbox > .tabbrowser-tab%faviconized%:not([pinned]) .tab-label[tabmix="true"],' +
        '#tabbrowser-tabs%favhideclose%[closebuttons-side="left"] > ' +
        '#tabbrowser-arrowscrollbox > .tabbrowser-tab%faviconized%:not([pinned]) .tab-label[tabmix="true"],' +
        '#tabbrowser-tabs%favhideclose%[closebuttons="activetab"]' +
        ':not([closebuttons-hover="notactivetab"])[closebuttons-side="right"] > ' +
        '#tabbrowser-arrowscrollbox > .tabbrowser-tab%faviconized%:not([pinned]):not([selected="true"]) ' +
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
    } else {
      let newRule = iconRule.replace(/%favhideclose%/g, '')
          .replace(/%faviconized%/g, '').replace(/%faviconized1%/g, '');
      this.insertRule(newRule);
    }
  },

  miscellaneousRules: function TMP_PO_miscellaneousRules() {
    // we don't show icons on menu on Mac OS X
    if (TabmixSvc.isMac)
      return;

    // new tab button on tab context menu
    let newRule = '.tabmix-newtab-menu-icon {' +
              'list-style-image: url("#URL");' +
              '-moz-image-region: #REGION;}';
    let url = "chrome://browser/skin/Toolbar.png", region;
    const skin = Services.prefs.getCharPref("extensions.activeThemeID", "");
    if (skin == "classic/1.0") {
      if (TabmixSvc.isLinux)
        region = "rect(0px, 96px, 24px, 72px)";
      else
        region = "rect(0pt, 180px, 18px, 162px)";
    } else {
      [url, region] = ["newtab.png", "auto"];
    }
    this.insertRule(newRule.replace("#URL", url).replace("#REGION", region));
  },

  addDynamicRules() {
    // tab width rules
    let tst = Tabmix.extensions.treeStyleTab ? ":not([treestyletab-collapsed='true'])" : "";
    let newRule = ".tabbrowser-tab[fadein]" + tst +
                  ":not([pinned]) {min-width: #1px !important; max-width: #2px !important;}";
    let _max = Services.prefs.getIntPref("browser.tabs.tabMaxWidth");
    let _min = Services.prefs.getIntPref("browser.tabs.tabMinWidth");
    newRule = newRule.replace("#1", _min).replace("#2", _max);
    this.insertRule(newRule, "width");

    // rule for controlling margin-inline-start when we have pinned tab in multi-row
    let marginStart = '#tabbrowser-tabs[positionpinnedtabs] > ' +
                      `#tabbrowser-arrowscrollbox > .tabbrowser-tab[tabmix-firstTabInRow="true"]{margin-inline-start: 0px;}`;
    this.insertRule(marginStart, "tabmix-firstTabInRow");

    this.insertRule(`:root { --tabs-lines: ` + Tabmix.prefs.getIntPref("tabBarMaxRow") + `;}`, 'max-rows');

    // for ColorfulTabs 8.0+
    // add new rule to adjust selected tab bottom margin
    // we add the rule after the first tab added
    if (typeof colorfulTabs == "object") {
      let padding = Tabmix.getStyle(gBrowser.tabs[0], "paddingBottom");
      newRule = '#tabbrowser-tabs[flowing="multibar"] > #tabbrowser-arrowscrollbox > .tabbrowser-tab[selected=true]' +
                    ' {margin-bottom: -1px !important; padding-bottom: ' + (padding + 1) + 'px !important;}';
      let index = this.insertRule(newRule);
      newRule = this._tabStyleSheet.cssRules[index];
      gBrowser.tabContainer.addEventListener("TabOpen", function TMP_addStyleRule(aEvent) {
        padding = Tabmix.getStyle(aEvent.target, "paddingBottom");
        newRule.style.setProperty("padding-bottom", (padding + 1) + "px", "important");
      }, {capture: true, once: true});
    }

    if (!Tabmix.isVersion(860)) {
      this.insertRule(
        `#tabmix-closedTabs-dropmarker > .toolbarbutton-icon {
          list-style-image: url(chrome://global/skin/icons/arrow-dropdown-12.svg);
          padding-inline: 2px;
          padding-block: calc(var(--toolbarbutton-inner-padding) + (16px - 12px) / 2);
          width: calc(2 * 2px + 12px);
        }`
      );

      this.insertRule(
        `toolbarpaletteitem[place="menu-panel"] > .toolbaritem-combined-buttons[id^="tabmix"] {
          -moz-box-flex: 1;
          margin: 0;
        }`
      );

      this.insertRule(
        `toolbarpaletteitem[place="menu-panel"] > .toolbaritem-combined-buttons[id^="tabmix"] > toolbarbutton {
          max-width: 29em !important;
        }`
      );
    }

    this.dynamicProtonRules();
    this.toolbarbuttonTopMargin();
    this.overflowIndicator();
  },

  dynamicProtonRules() {
    // since Firefox 89 the pref name is "browser.tabs.enabled",
    // but we don't need to use it here, we use @media (-moz-proton) instead
    const protonPrefVal = Services.prefs.getBoolPref("browser.proton.tabs.enabled", false);
    let newRule;
    if (!Tabmix.isVersion(880)) {
      // the button is not ready when we call dynamicProtonRules early
      // onContentLoaded>addDynamicRules>dynamicProtonRules
      setTimeout(() => {
        // tabmix-tabs-closebutton toolbarbutton
        document.getElementById("tabmix-tabs-closebutton").setAttribute("tabmix-fill-opacity", true);
      }, 100);

      newRule = `#tabmix-tabs-closebutton[tabmix-fill-opacity] > .toolbarbutton-icon {
        padding: ${protonPrefVal ? 7.4 : 4}px 4px !important;
      }`;
      this.insertRule(newRule);
      if (protonPrefVal) {
        this.insertRule(`#tabmix-scrollbox { margin-top: 4px }`);
      }
    }

    if (!Tabmix.isVersion(910)) {
      newRule =
     `#tabmix-scrollbox::part(scrollbutton-up),
      #tabmix-scrollbox::part(scrollbutton-down) {
        ${Tabmix.isVersion(860) ? `appearance: none;` : `-moz-appearance: none;`}
        margin: 0 0 var(--tabs-navbar-shadow-size) !important;
        padding: var(--tabmix-scrollbutton-padding) var(--toolbarbutton-inner-padding) !important;
      }`;
      if (Tabmix.isVersion(890)) {
        this.insertRule(`@media not (-moz-proton) {${newRule}}`);
      } else {
        this.insertRule(newRule);
      }

      // reduce scroll button padding for compact tab without proton style
      newRule =
        `:root[uidensity=compact] #tabmix-scrollbox::part(scrollbutton-up),
        :root[uidensity=compact] #tabmix-scrollbox::part(scrollbutton-down) {
          padding-top: calc(var(--tabmix-scrollbutton-padding) - 1px) !important;
          padding-bottom: calc(var(--tabmix-scrollbutton-padding) - 1px) !important;
        }`;
      if (Tabmix.isVersion(890)) {
        this.insertRule(`@media not (-moz-proton) {${newRule}}`);
      } else {
        this.insertRule(newRule);
      }
    }

    const insertRule = (rule, noMedia) => {
      if (Tabmix.isVersion(910) || noMedia) {
        this.insertRule(rule);
      } else {
        this.insertRule(`@media (-moz-proton) {${rule}}`);
      }
    };

    insertRule(
      `#tabmix-scrollbox::part(scrollbutton-up),
       #tabmix-scrollbox::part(scrollbutton-down) {
         appearance: none;
         background-clip: padding-box;
         border: 4px solid transparent;
         border-radius: calc(var(--tab-border-radius) + 4px);
         margin: 0;
         padding: calc(var(--toolbarbutton-inner-padding) - 2px) calc(var(--toolbarbutton-inner-padding) - 6px);
       }`
    );

    insertRule(
      `#tabmix-scrollbox[flowing=multibar]::part(scrollbutton-up),
       #tabmix-scrollbox[flowing=multibar]::part(scrollbutton-down) {
         padding-inline: calc(var(--toolbarbutton-inner-padding) - 5px);
       }`
    );

    // Bug 1705849 - Update toolbar icon fill colours
    const fill = Tabmix.isVersion(890) ?
      "var(--toolbarbutton-icon-fill)" :
      "var(--lwt-toolbarbutton-icon-fill)";
    newRule = `:root {--tabmix-scrollbox-button-fill: ${fill}}`;
    this.insertRule(newRule);

    // Bug 1699586 - De-duplicate default down arrow icon
    const iconUrl = Tabmix.isVersion(910) ?
      "url(chrome://global/skin/icons/arrow-down.svg)" :
      "url(chrome://global/skin/icons/arrow-dropdown-16.svg)";
    this.insertRule(`:root {--tabmix-scrollbutton-image: ${iconUrl}}`);

    if (!Tabmix.isVersion(860)) {
      newRule = `
      #tabbrowser-arrowscrollbox[flowing=multibar][orient=horizontal] {
        overflow: -moz-hidden-unscrollable;
        display: block;
      }`;
      this.insertRule(newRule);
      return;
    }

    const blockMargin = Tabmix.tabsUtils.protonValues;
    if (Tabmix.isVersion(890)) {
      /* overwrite rule from chrome/browser/skin/classic/browser/browser.css */
      insertRule(
        `#tabbrowser-tabs[orient="horizontal"][widthFitTitle] > #tabbrowser-arrowscrollbox >
        .tabbrowser-tab:not(:hover) > .tab-stack > .tab-content > .tab-close-button {
          padding-inline-start: 7px;
          width: 24px;
        }`
      );

      // for tabbrowser-arrowscrollbox top/bottom margin
      insertRule(
        `:root {
          --tabmix-multirow-margin: ${blockMargin.margin};
        }`
      );
      TMP_tabDNDObserver._multirowMargin = parseInt(blockMargin.margin);
    } else {
      this.insertRule(
        `:root {
          --tabmix-multirow-margin: ${protonPrefVal ? blockMargin.margin : "0px"};
        }`
      );
      TMP_tabDNDObserver._multirowMargin = protonPrefVal ? parseInt(blockMargin.margin) : 0;
    }

    // Firefox adds padding for single row when positionpinnedtabs is set.
    // padding-inline: var(--tab-shadow-max-size);
    insertRule(
      `#tabbrowser-tabs:not([defaultScrollButtons])[orient=horizontal][positionpinnedtabs] > #tabbrowser-arrowscrollbox::part(scrollbox) {
        padding-inline: 0;
      }`,
      Tabmix.isVersion(860) && Services.prefs.getBoolPref("browser.proton.tabs.enabled", false)
    );
  },

  toolbarbuttonTopMargin() {
    // adjust margin-top on toolbarbutton for multirow
    if (Tabmix.isVersion(910)) {
      this.insertRule(
        `:root {
          --tabmix-button-margin-top: 3.5px;
          --tabmix-button-margin-top-compact: 3.5px;
          --tabmix-button-margin-top-proton: 3.5px;
          --tabmix-button-margin-top-proton-compact: 3.5px;
        }`
      );
    } else if (Tabmix.isVersion(890)) {
      this.insertRule(
        `:root {
          --tabmix-button-margin-top: 2px;
          --tabmix-button-margin-top-compact: 0;
          --tabmix-button-margin-top-proton: 3.5px;
          --tabmix-button-margin-top-proton-compact: 3.5px;
        }`
      );
    } else {
      this.insertRule(
        `:root:not([uidensity=compact]) #TabsToolbar[multibar] .toolbarbutton-1:not([id="tabs-newtab-button"]) {
          margin-top: 2px !important;
        }`
      );
      const proton = Tabmix.isVersion(860) &&
        Services.prefs.getBoolPref("browser.proton.tabs.enabled", false);
      this.insertRule(
        `:root[uidensity=compact] #TabsToolbar[multibar] .toolbarbutton-1:not([id="tabs-newtab-button"]) {
          margin-top: ${proton ? 2 : 0}px !important;
        }`
      );
    }
  },

  overflowIndicator() {
    if (!Tabmix.isFirstWindowInSession || !Tabmix.isVersion(890)) {
      return;
    }

    let cssText =
    `/* browser/themes/shared/tabs.inc.css */
    /* Tab Overflow */
    #tabmix-scrollbox[orient=vertical]::part(overflow-start-indicator) {
      display: none;
    }

    #tabmix-scrollbox:not([scrolledtostart])::part(overflow-start-indicator),
    #tabmix-scrollbox:not([scrolledtoend])::part(overflow-end-indicator) {
      width: 7px; /* The width is the sum of the inline margins */
      background-image: radial-gradient(ellipse at bottom,
                                        rgba(0,0,0,0.1) 0%,
                                        rgba(0,0,0,0.1) 7.6%,
                                        rgba(0,0,0,0) 87.5%);
      background-repeat: no-repeat;
      background-position: -3px;
      border-left: .5px solid rgba(255,255,255,.2);
      pointer-events: none;
      position: relative;
      z-index: 3; /* the selected tab's z-index + 1 */
      border-bottom: .5px solid transparent;
    }

    /* original margin-inline: -.5px -6.5px; */
    #tabmix-scrollbox:not([scrolledtostart])::part(overflow-start-indicator) {
      margin-inline: -6.5px -.5px;
    }

    /* original margin-inline: -6.5px -.5px; */
    #tabmix-scrollbox:not([scrolledtoend])::part(overflow-end-indicator) {
      margin-inline: -.5px -6.5px;
    }

    ${Tabmix.isVersion(910) ? `` : `@media not (-moz-proton) {
    #tabmix-scrollbox:not([scrolledtostart])::part(overflow-start-indicator),
    #tabmix-scrollbox:not([scrolledtoend])::part(overflow-end-indicator) {
      width: 18px;
      background-image: url(chrome://browser/skin/tabbrowser/tab-overflow-indicator.png);
      background-size: 17px 100%;
      border-left: 1px solid;
      border-image: linear-gradient(rgba(255,255,255,.2),
                                    rgba(255,255,255,.2) calc(100% - 1px - var(--tabs-navbar-shadow-size)),
                                    transparent calc(100% - 1px - var(--tabs-navbar-shadow-size)));
      border-image-slice: 1;
    }
    } /*** END !proton ***/`}

    /* swap direction from the original rule
       we place overflow-start-indicator left to the button
     */
    #tabmix-scrollbox:-moz-locale-dir(ltr)::part(overflow-start-indicator),
    #tabmix-scrollbox:-moz-locale-dir(rtl)::part(overflow-end-indicator) {
      transform: scaleX(-1);
    }

    ${Tabmix.isVersion(910) ? `` : `@media not (-moz-proton) {
    #tabmix-scrollbox:not([scrolledtostart])::part(overflow-start-indicator) {
      margin-inline: -1px -17px;
    }

    #tabmix-scrollbox:not([scrolledtoend])::part(overflow-end-indicator) {
      margin-inline: -17px -1px;
    }
    }`}

    #tabmix-scrollbox[scrolledtostart]::part(overflow-start-indicator),
    #tabmix-scrollbox[scrolledtoend]::part(overflow-end-indicator) {
      opacity: 0;
    }

    #tabmix-scrollbox::part(overflow-start-indicator),
    #tabmix-scrollbox::part(overflow-end-indicator) {
      transition: opacity 150ms ease;
    }`;

    const styleSheet = Services.io.newURI(
      "data:text/css," + encodeURIComponent(cssText));

    const sss = Cc['@mozilla.org/content/style-sheet-service;1']
        .getService(Ci.nsIStyleSheetService);
    sss.loadAndRegisterSheet(styleSheet, sss.AUTHOR_SHEET);
  },

  updateStyleAttributes() {
    let styles = ["current", "unloaded", "unread", "other"];
    styles.forEach(styleName => {
      this.updateStyleAttribute(styleName + "Tab", styleName);
    });
  },

  updateStyleAttribute(ruleName, styleName) {
    let attribValue = null;
    let enabled = Tabmix.prefs.getBoolPref(ruleName);
    if (enabled) {
      let prefValues = TabmixSvc.tabStylePrefs[ruleName];
      // set bold, italic and underline only when we control the style
      // to override theme default rule if exist
      attribValue = [prefValues.bold ? "bold" : "not-bold",
        prefValues.italic ? "italic" : "not-italic",
        prefValues.underline ? "underline" : "not-underline"
      ];
      if (prefValues.text)
        attribValue.push("text");
      if (prefValues.bg && !Tabmix.prefs.getBoolPref("disableBackground")) {
        attribValue.push("bg");
      }
      attribValue = attribValue.join(" ");
    }

    let attName = "tabmix_" + styleName + "Style";
    Tabmix.setItem(gBrowser.tabContainer, attName, attribValue);
    return attribValue;
  },

  updateTabsStyle(ruleName) {
    let styleName = ruleName.replace("Tab", "");
    let attName = "tabmix_" + styleName + "Style";
    let currentAttrib = gBrowser.tabContainer.getAttribute(attName) || "";
    let attribValue = this.updateStyleAttribute(ruleName, styleName);

    /** style on non-selected tab are unloaded, unread or other, unloaded and
     *  unread are only set on tab if the corresponded preference it on. if user
     *  changed unloaded or unread preference we need to set the proper tab
     *  style for each tab
     */
    if (styleName == "unloaded" || styleName == "unread") {
      for (let tab of gBrowser.tabs) {
        Tabmix.setTabStyle(tab);
      }
    }

    let isBold = function(attrib) {
      attrib = attrib.split(" ");
      return attrib.length > 1 && !attrib.includes("not-bold");
    };
    // changing bold attribute can change tab width and effect tabBar scroll status
    // also when we turn off unloaded, unread and other style different style can take
    // control with a different bold attribute
    if (isBold(attribValue || "") != isBold(currentAttrib)) {
      TabmixTabbar.updateScrollStatus();
      TabmixTabbar.updateBeforeAndAfter();
    }
  },

  setProgressMeter() {
    var showOnTabs = Tabmix.prefs.getBoolPref("progressMeter");
    var attribValue = null;
    if (showOnTabs)
      attribValue = TabmixSvc.tabStylePrefs.progressMeter.bg ? "userColor" : "defaultColor";
    Tabmix.setItem(gBrowser.tabContainer, "tabmix_progressMeter", attribValue);
    TabmixProgressListener.listener.showProgressOnTab = showOnTabs;
  },

  setLink_openPrefs() {
    if (!Tabmix.singleWindowMode)
      return;

    function updateStatus(pref, testVal, test, newVal) {
      try {
        var prefValue = Services.prefs.getIntPref(pref);
        test = test ? prefValue == testVal : prefValue != testVal;
      } catch (e) {
        test = true;
      }

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
  setSingleWindowUI() {
    // menu item inside "appMenu-multiView" does not exist in the DOM before
    // the menu opens for the first time
    const appMenuMultiView = document.getElementById("appMenu-multiView");
    if (appMenuMultiView.childElementCount === 0 && !this.setSingleWindowUI._initialized) {
      document.getElementById("PanelUI-menu-button")
          .addEventListener("click", () => this.setSingleWindowUI(), {once: true});
      this.setSingleWindowUI._initialized = true;
    }

    Tabmix.singleWindowMode = Tabmix.prefs.getBoolPref("singleWindow");
    var newWindowButton = document.getElementById("new-window-button");
    if (newWindowButton)
      newWindowButton.setAttribute("disabled", Tabmix.singleWindowMode);

    const val = Tabmix.singleWindowMode || null;
    const items = document.querySelectorAll('[command="cmd_newNavigator"]');
    for (const item of items) {
      if (item.localName == "menuitem") {
        Tabmix.setItem(item, "hidden", val);
      } else if (item.localName == "toolbarbutton") {
        Tabmix.setItem(item, "disabled", val);
      }
    }

    Tabmix.setItem("tmOpenInNewWindow", "hidden", val);
    Tabmix.setItem("context-openframe", "hidden", val);
    Tabmix.setItem("Tools:FissionWindow", "disabled", val);
    Tabmix.setItem("Tools:NonFissionWindow", "disabled", val);
  },

  setMenuIcons() {
    var hideIcons = Tabmix.prefs.getBoolPref("hideIcons");
    function setClass(items) {
      if (hideIcons) {
        for (let i = 0; i < items.length; ++i)
          items[i].removeAttribute("class");
      } else {
        for (let i = 0; i < items.length; ++i)
          items[i].setAttribute("class", items[i].getAttribute("tmp_iconic"));
      }
    }
    var iconicItems = document.getElementsByAttribute("tmp_iconic", "*");
    setClass(iconicItems);

    iconicItems = document.getElementById("tabContextMenu").getElementsByAttribute("tmp_iconic", "*");
    setClass(iconicItems);
  },

  setAutoHidePref() {
    TabmixTabbar.hideMode = Tabmix.prefs.getIntPref("hideTabbar");
    TabBarVisibility.update();
  },

  setTabBarVisibility: function TMP_PO_setTabBarVisibility() {
    if (TabmixTabbar.hideMode !== 2 &&
        gBrowser.tabs.length - gBrowser._removingTabs.length > 1) {
      gBrowser.ensureTabIsVisible(gBrowser.selectedTab, false);
      TabmixTabbar.updateBeforeAndAfter();
    }
  },

  changeNewTabButtonSide(aPosition) {
    let $ = id => document.getElementById(id);
    let newTabButton = $("new-tab-button");
    if (TabmixTabbar.isButtonOnTabsToolBar(newTabButton)) {
      // update our attribute
      let showNewTabButton = Tabmix.prefs.getBoolPref("newTabButton");
      this.setShowNewTabButtonAttr(showNewTabButton, aPosition);
      Tabmix.sideNewTabButton = newTabButton;

      // move button within TabsToolbar
      let buttonPosition = Tabmix.getPlacement("new-tab-button");
      let tabsPosition = Tabmix.getPlacement("tabbrowser-tabs");
      let boxPosition = Tabmix.getPlacement("tabmix-scrollbox");
      let after = boxPosition == tabsPosition + 1 ? boxPosition : tabsPosition;
      let changePosition = (aPosition === 0 && buttonPosition > tabsPosition) ||
                             (aPosition == 1 && buttonPosition < after) ||
                             (aPosition == 2 && buttonPosition != after + 1);
      if (changePosition) {
        let tabsToolbar = $("TabsToolbar");
        tabsToolbar.removeAttribute("tabbaronbottom");
        let newPosition = aPosition === 0 ? tabsPosition : after + 1;
        let doChange = function() {
          CustomizableUI.moveWidgetWithinArea("new-tab-button", newPosition);
          let onbottom = TabmixTabbar.position == 1 || null;
          Tabmix.setItem(tabsToolbar, "tabbaronbottom", onbottom);
          Tabmix.setItem("main-window", "tabmix-tabbaronbottom", onbottom);
        };
        if (TabmixTabbar.position == 1)
          setTimeout(() => doChange(), 15);
        else
          doChange();
      }
    } else {
      this.setShowNewTabButtonAttr(false);
      Tabmix.sideNewTabButton = null;
    }
  },

  setShowNewTabButtonAttr(aShow, aPosition) {
    // check new tab button visibility when we are in multi-row and the
    // preference is to show new-tab-button after last tab
    Tabmix.tabsUtils.checkNewtabButtonVisibility = TabmixTabbar.isMultiRow &&
      ((aShow && aPosition == 2) || Boolean(TabmixTabbar.newPrivateTabButton()));

    /** values for tabmix-show-newtabbutton to show tabs-newtab-button are:
     *  aftertabs       - show the button after tabs
     *  temporary-right-side
     *                  - show the button on right side when there is no place
     *                    for the button aftertabs in multi-row mode
     *  right-side      - show the button on right side
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
    Tabmix.setItem("TabsToolbar", "tabmix-show-newtabbutton", attrValue);
  },

  tabBarPositionChanged(aPosition) {
    if (aPosition > 1 || (aPosition !== 0 && Tabmix.extensions.verticalTabBar)) {
      Tabmix.prefs.setIntPref("tabBarPosition", 0);
      return false;
    }
    if (TabmixTabbar.position == aPosition)
      return false;

    TabmixTabbar.position = aPosition;
    Tabmix.bottomToolbarUtils.init();
    gBrowser.tabContainer._tabDropIndicator.removeAttribute("style");
    var tabsToolbar = document.getElementById("TabsToolbar");
    // setting tabbaronbottom attribute triggers Tabmix.bottomToolbarUtils.resizeObserver
    let onbottom = TabmixTabbar.position == 1 || null;
    Tabmix.setItem(tabsToolbar, "tabbaronbottom", onbottom);
    Tabmix.setItem("main-window", "tabmix-tabbaronbottom", onbottom);

    if (TabmixTabbar.position === 0) {// top
      this._bottomRect = {top: null, width: null, height: null};
      let bottomToolbox = document.getElementById("tabmix-bottom-toolbox");
      bottomToolbox.firstChild.style.removeProperty("height");
      tabsToolbar.style.removeProperty("top");
      Tabmix.setItem("TabsToolbar-customization-target", "width", null);
      TabmixTabbar.visibleRows = 1;
    }
    return true;
  },

  // Show Reload Every menu on Reload button
  showReloadEveryOnReloadButton() {
    let show = Tabmix.prefs.getBoolPref("reloadEvery.onReloadButton");
    Tabmix.setItem("urlbar-go-button", "context", show ? "autoreload_popup" : null);

    let setContext = function(command) {
      let items = document.getElementsByAttribute("command", "Browser:" + command);
      for (let item of items) {
        if (item.localName == "toolbarbutton")
          Tabmix.setItem(item, "context", show ? "autoreload_popup" : null);
      }
    };
    setContext("ReloadOrDuplicate");
    setContext("Stop");
  },

  // we replace some Tabmix settings with Firefox settings
  updateSettings() {
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
      filetype = filetype.replace("/disp=attd&view=att/", "").replace("  ", " ").trim();
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
    } else if (Services.prefs.prefHasUserValue("browser.tabs.closeButtons") &&
               !Tabmix.prefs.prefHasUserValue("version") &&
               !Tabmix.prefs.prefHasUserValue("tabs.closeButtons")) {
      // partly fix a bug from version 0.3.8.3
      let value = getPrefByType("browser.tabs.closeButtons", 1, "IntPref");
      // these value are from 0.3.8.3. we don't know if 0,1 are also from 0.3.8.3 so we don't use 0,1.
      if (value > 1 && value <= 6) {
        let newValue = [3, 5, 1, 1, 2, 4, 1][value];
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
        const prefValue = Services.prefs.getStringPref(oldPref);
        // only update new preference value if the old control preference is New Tab Page
        let control = controlPref === undefined || Tabmix.prefs.prefHasUserValue(controlPref) &&
                      Tabmix.prefs.getIntPref(controlPref) == 4;
        if (prefValue !== "" && control) {
          Services.prefs.setStringPref(newPref, prefValue);
        }
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
    } catch (ex) {
      Tabmix.assert(ex);
    }
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
      let shortcuts = JSON.parse(Tabmix.prefs.getCharPref("shortcuts"));
      if (useF8Key)
        shortcuts.slideShow = "VK_F8";
      if (useF9Key)
        shortcuts.toggleFLST = "VK_F9";
      Tabmix.prefs.setCharPref("shortcuts", JSON.stringify(shortcuts));
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
    // don't sync sessions.onStart.sessionpath
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
    // 2021-01-22
    if (Services.prefs.prefHasUserValue("extensions.tabmix.hideAllTabsButton")) {
      Services.prefs.setBoolPref("browser.tabs.tabmanager.enabled",
        Services.prefs.getBoolPref("extensions.tabmix.hideAllTabsButton"));
      Services.prefs.clearUserPref("extensions.tabmix.hideAllTabsButton");
    }
    // 2021-04-05
    // Bug 1692303 - Migrate old ctrlTab pref to new ctrlTab pref
    function migrateCtrlTab(oldPrefName) {
      if (Services.prefs.prefHasUserValue(oldPrefName)) {
        let newPrefValue = Services.prefs.getBoolPref(oldPrefName);
        if (Tabmix.isVersion(890)) {
          if (Services.prefs.getBoolPref("browser.engagement.ctrlTab.has-used")) {
            Services.prefs.setBoolPref(
              "browser.ctrlTab.sortByRecentlyUsed",
              newPrefValue
            );
          } else {
            Services.prefs.setBoolPref(
              "browser.ctrlTab.sortByRecentlyUsed",
              false
            );
          }
        } else {
          Services.prefs.setBoolPref("browser.ctrlTab.recentlyUsedOrder",
            newPrefValue);
        }
        Services.prefs.clearUserPref(oldPrefName);
      }
    }
    migrateCtrlTab("browser.ctrlTab.mostRecentlyUsed");
    migrateCtrlTab("extensions.tabmix.lasttab.handleCtrlTab");
    migrateCtrlTab("browser.ctrlTab.previews");
    if (Tabmix.isVersion(890)) {
      migrateCtrlTab("browser.ctrlTab.recentlyUsedOrder");
    }
    // 2021-08-18
    if (Services.prefs.prefHasUserValue("extensions.tabmix.openTabNext")) {
      // insertAfterCurrent override insertRelatedAfterCurrent, set it only if
      // tabmix.openTabNext was true and insertRelatedAfterCurrent was false
      if (!Services.prefs.getBoolPref("browser.tabs.insertRelatedAfterCurrent")) {
        Services.prefs.setBoolPref("browser.tabs.insertAfterCurrent",
          Services.prefs.getBoolPref("extensions.tabmix.openTabNext"));
      }
      Services.prefs.clearUserPref("extensions.tabmix.openTabNext");
    }
    // 2021-08-17
    if (Tabmix.prefs.prefHasUserValue("tabs.warnOnClose")) {
      Services.prefs.setBoolPref("browser.tabs.warnOnCloseOtherTabs", Tabmix.prefs.getBoolPref("tabs.warnOnClose"));
      Tabmix.prefs.clearUserPref("tabs.warnOnClose");
    }

    let getVersion = function _getVersion(currentVersion, shouldAutoUpdate) {
      let oldVersion = TabmixSvc.prefs.get("extensions.tabmix.version", "");

      let vCompare = (a, b) => Services.vc.compare(a, b) <= 0;
      if (oldVersion) {
        // 2013-08-18
        if (vCompare(oldVersion, "0.4.1.1pre.130817a") &&
            Services.prefs.prefHasUserValue("browser.tabs.loadDivertedInBackground"))
          Tabmix.prefs.setBoolPref("loadExternalInBackground", true);
      }

      let showNewVersionTab;
      if (currentVersion != oldVersion) {
        // reset current preference in case it is not a string
        Tabmix.prefs.clearUserPref("version");
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
          let subs = obj => (obj[1] ? obj.input.substring(0, obj.index) : obj.input);
          showNewVersionTab = subs(re.exec(currentVersion)) != subs(re.exec(oldVersion));
        }
      }
      if (showNewVersionTab) {
        // open Tabmix page in a new tab
        window.setTimeout(() => {
          let defaultChanged = "";
          let showComment = oldVersion ? Services.vc.compare(oldVersion, "0.4.0.2pre.120330a") <= 0 : false;
          if (showComment && (_loadOnNewTab || _replaceLastTabWith))
            defaultChanged = "&newtabpage";
          let b = Tabmix.getTopWin().gBrowser;
          b.selectedTab = b.addTrustedTab("http://tabmixplus.org/version_update3.htm?version=" +
                                   currentVersion + defaultChanged);
          b.selectedTab.loadOnStartup = true;
        }, 1000);
        // noting more to do at the moment
      }
    };
    AddonManager.getAddonByID("{dc572301-7619-498c-a57d-39143191b318}").then(aAddon => {
      try {
        let shouldAutoUpdate = AddonManager.shouldAutoUpdate(aAddon);
        getVersion(aAddon.version, shouldAutoUpdate);
      } catch (ex) {
        Tabmix.assert(ex);
      }
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
    void TabmixSvc.direct2dDisabled;
  },

  updateTabClickingOptions() {
    var c = ["dblClickTab", "middleClickTab", "ctrlClickTab", "shiftClickTab", "altClickTab",
      "dblClickTabbar", "middleClickTabbar", "ctrlClickTabbar", "shiftClickTabbar", "altClickTabbar"];
    for (let i = 0; i < c.length; i++)
      this.blockTabClickingOptions("extensions.tabmix." + c[i]);
  },

  blockTabClickingOptions(prefName) {
    if (TabmixSvc.blockedClickingOptions.indexOf(Services.prefs.getIntPref(prefName)) > -1) {
      if (Services.prefs.prefHasUserValue(prefName))
        Services.prefs.clearUserPref(prefName);
      else
        Services.prefs.setIntPref(prefName, 0);
    }
  }

};

TabmixProgressListener = {
  startup: function TMP_PL_startup(tabBrowser) {
    // check the current window.  if we're in a popup, don't init this progressListener
    if (window.document.documentElement.getAttribute("chromehidden"))
      return;
    this.listener.mTabBrowser = tabBrowser;
    tabBrowser.addTabsProgressListener(this.listener);
  },

  listener: {
    mTabBrowser: null,
    showProgressOnTab: false,

    onProgressChange(aBrowser, aWebProgress, aRequest,
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
        if (url == TabmixSvc.aboutBlank) {
          tab.removeAttribute("busy");
          tab.removeAttribute("progress");
          this.mTabBrowser.setTabTitle(tab);
        } else if (!(aStateFlags & nsIWebProgressListener.STATE_RESTORING)) {
          if (tab.hasAttribute("tabmix_pending"))
            tab.removeAttribute("tabmix_pending");
          Tabmix.setTabStyle(tab);
          // this code run after setTabTitleLoading, so we must set tab width on setTabTitleLoading
          // at this stage only un-hide the button if needed.
          if (this.mTabBrowser.tabContainer.getAttribute("closebuttons") == "noclose") {
            let tabsCount = this.mTabBrowser.visibleTabs.length;
            if (tabsCount == 1)
              this.mTabBrowser.tabContainer._updateCloseButtons(true, url);
          }
        }
      } else if (aStateFlags & nsIWebProgressListener.STATE_STOP &&
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
          tab._tabmix_downloadingTimeout = tab.ownerGlobal.setTimeout(() => {
            tab._tabmix_downloadingTimeout = null;
            if (this && this.mTabBrowser && tab && tab.parentNode)
              this.mTabBrowser.removeTab(tab, {animate: false});
          }, 1000, this);
        }

        let tabsCount = this.mTabBrowser.visibleTabs.length;
        if (tabsCount == 1)
          this.mTabBrowser.tabContainer._updateCloseButtons(true);
        tab.removeAttribute("tab-progress");
        if (!isBlankPageURL(uri)) {
          aBrowser.tabmix_allowLoad = !tab.hasAttribute("locked");
          if (Tabmix.prefs.getBoolPref("unreadTabreload") && tab.hasAttribute("visited") &&
              !tab.hasAttribute("dontremovevisited") && tab.getAttribute("visuallyselected") != "true")
            tab.removeAttribute("visited");
          Tabmix.setTabStyle(tab);
        }
        // see gBrowser.openLinkWithHistory in tablib.js
        if (tab.hasAttribute("dontremovevisited"))
          tab.removeAttribute("dontremovevisited");

        if (!tab.hasAttribute("busy")) {
          TabmixSessionManager.tabLoaded(tab);
          // we need to remove width from tabs with url label from here
          if (tab.hasAttribute("width")) {
            Tabmix.tablib.onTabTitleChanged(tab, aBrowser);
          }
        }
      }
      if ((aStateFlags & nsIWebProgressListener.STATE_IS_WINDOW) &&
            (aStateFlags & nsIWebProgressListener.STATE_STOP)) {
        if (tab.autoReloadURI)
          Tabmix.autoReload.onTabReloaded(tab, aBrowser);

        // disabled name for locked tab, so locked tab don't get reuse
        if (tab.getAttribute("locked")) {
          aBrowser.messageManager.sendAsyncMessage("Tabmix:resetContentName");
        }
      }
    }
  }
};
