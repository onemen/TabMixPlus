/* exported TMP_LastTab */
"use strict";

//////////////////////////////////////////////////////////////////////
// The Original Code is the "LastTab" extension for Mozilla Firefox.//
// version 1.5 - October 26, 2005                                   //
// The Initial Developer of the Original Code is Timothy Humphrey.  //
//////////////////////////////////////////////////////////////////////
var TMP_LastTab = {
  CtrlKey: false,
  handleCtrlTab: true,
  KeyboardNavigating: true,
  KeyLock: false,
  respondToMouseInTabList: true,
  showTabList: true,
  SuppressTabListReset: false,
  TabHistory: [],
  TabIndex: 0,
  TabList: null,
  TabListLock: false,
  _inited: false,

  DisplayTabList() {
    var tablist = this.TabList;

    TabmixAllTabs.createCommonList(tablist, this.handleCtrlTab ? 3 : 2);
    var item = this.tabs[this.TabIndex].mCorrespondingMenuitem;
    item.setAttribute("_moz-menuactive", "true");
    TabmixAllTabs.updateMenuItemActive(null, item);

    // show the list at the center of the screen
    let box = tablist.boxObject;
    let left = () => screen.availLeft + (screen.availWidth - box.width) / 2;
    let top = () => screen.availTop + (screen.availHeight - box.height) / 2;
    tablist.style.visibility = "hidden";
    tablist.openPopupAtScreen(left(), top(), true);
    tablist.moveTo(left(), top());
    tablist.style.visibility = "";

    var ietab = "chrome://ietab/content/reloaded.html?url=";
    if (gBrowser.currentURI.spec.startsWith(ietab))
      tablist.focus();

    this.TabListLock = true;
  },

  init() {
    this._inited = true;

    this.TabList = document.getElementById("lasttabTabList");

    const tabBox = Tabmix.isVersion(590) ? gBrowser.tabbox : gBrowser.mTabBox;
    let els = Cc["@mozilla.org/eventlistenerservice;1"]
        .getService(Ci.nsIEventListenerService);
    if (Tabmix.isVersion(320, 270)) {
      els.removeSystemEventListener(tabBox._eventNode, "keydown", tabBox, false);
    } else {
      tabBox._eventNode.removeEventListener("keypress", tabBox);
      els.addSystemEventListener(tabBox._eventNode, "keypress", this, false);
    }
    els.addSystemEventListener(tabBox._eventNode, "keydown", this, false);
    els.addSystemEventListener(tabBox._eventNode, "keyup", this, false);
    if (!Tabmix.isVersion(470)) {
      els.addSystemEventListener(window, "focus", this, true);
    }
    els.addSystemEventListener(window, "blur", this, true);

    // if session manager select other tab then the first one we need to build
    // TabHistory in two steps to maintain natural Ctrl-Tab order.
    this.TabHistory = [];
    var currentIndex = gBrowser.mCurrentTab._tPos;
    for (let i = currentIndex; i < gBrowser.tabs.length; i++)
      this.TabHistory.unshift(gBrowser.tabs[i]);
    for (let i = 0; i < currentIndex; i++)
      this.TabHistory.unshift(gBrowser.tabs[i]);

    this.ReadPreferences();
  },

  deinit() {
    if (!this._inited)
      return;

    const tabBox = Tabmix.isVersion(590) ? gBrowser.tabbox : gBrowser.mTabBox;
    let els = Cc["@mozilla.org/eventlistenerservice;1"]
        .getService(Ci.nsIEventListenerService);
    els.removeSystemEventListener(tabBox._eventNode, "keydown", this, false);
    els.removeSystemEventListener(tabBox._eventNode, "keyup", this, false);
    if (!Tabmix.isVersion(320, 270))
      els.removeSystemEventListener(tabBox._eventNode, "keypress", this, false);
    if (!Tabmix.isVersion(470)) {
      els.removeSystemEventListener(window, "focus", this, true);
    }
    els.removeSystemEventListener(window, "blur", this, true);
  },

  handleEvent(event) {
    switch (event.type) {
      case "focus":
        if (event.target == window.content) {
          Tabmix.keyModifierDown = false;
        }
        break;
      case "blur":
        if (this.disallowDragState) {
          this.updateDisallowDrag(false);
        }
        break;
      case "keydown":
        this.OnKeyDown(event);
        this.disallowDragwindow(true);
        break;
      case "keypress":
        this.OnKeyPress(event);
        break;
      case "keyup":
        this.OnKeyUp(event);
        this.disallowDragwindow(false);
        break;
      case "DOMMenuItemActive":
        this.ItemActive(event);
        break;
      case "DOMMenuItemInactive":
        this.ItemInactive(event);
        break;
    }
  },

  /**
   * disallow mouse down on TabsToolbar to start dragging the window when one
   * of the key modifiers is down
   */
  disallowDragwindow(keyDown) {
    if (!Tabmix.isVersion(470)) {
      return;
    }
    if (Tabmix.prefs.getBoolPref("tabbar.click_dragwindow") &&
        keyDown == Tabmix.keyModifierDown &&
        keyDown != this.disallowDragState) {
      this.updateDisallowDrag(keyDown);
    }
  },

  disallowDragState: false,
  updateDisallowDrag(disallow) {
    this.disallowDragState = disallow;
    Tabmix.setItem("TabsToolbar", "tabmix-disallow-drag", disallow || null);
  },

  ItemActive(event) {
    TabmixAllTabs.updateMenuItemActive(event);
    if (this.respondToMouseInTabList) {
      if (this.KeyboardNavigating) {
        if (event.target.value != this.inverseIndex(this.TabIndex))
          this.tabs[this.TabIndex].mCorrespondingMenuitem.setAttribute("_moz-menuactive", "false");
        this.KeyboardNavigating = false;
      }
      this.TabIndex = this.inverseIndex(event.target.value);
    } else if (event.target.value != this.inverseIndex(this.TabIndex)) {
      event.target.setAttribute("_moz-menuactive", "false");
    }
  },

  ItemInactive(event) {
    TabmixAllTabs.updateMenuItemInactive(event);
    if (!this.respondToMouseInTabList && event.target.value == this.inverseIndex(this.TabIndex))
      event.target.setAttribute("_moz-menuactive", "true");
  },

  attachTab: function TMP_LastTab_attachTab(aTab, lastRelatedTab) {
    if (!this._inited)
      return;

    this.detachTab(aTab);
    let index = this.TabHistory.indexOf(lastRelatedTab);
    if (index < 0)
      index = this.TabHistory.length - 1;
    this.TabHistory.splice(index, 0, aTab);
  },

  detachTab: function TMP_LastTab_detachTab(aTab) {
    var i = this.TabHistory.indexOf(aTab);
    if (i >= 0)
      this.TabHistory.splice(i, 1);
  },

  isCtrlTab(event) {
    return (this.handleCtrlTab || this.showTabList) &&
      event.keyCode == event.DOM_VK_TAB &&
      event.ctrlKey && !event.altKey && !event.metaKey;
  },

  OnKeyDown(event) {
    this.CtrlKey = event.ctrlKey && !event.altKey && !event.metaKey;
    Tabmix.keyModifierDown = event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
    if (Tabmix.isVersion(320, 270))
      this.OnKeyPress(event);
  },

  set tabs(val) {
    if (val !== null)
      return;

    this._tabs = null;
  },

  get tabs() {
    if (this._tabs)
      return this._tabs;
    let list = this.handleCtrlTab ? this.TabHistory : gBrowser.tabs;
    this._tabs = Array.prototype.filter.call(list, tab => {
      return !tab.hidden && !tab.closing;
    });
    return this._tabs;
  },

  OnKeyPress: function _LastTab_OnKeyPress(event) {
    if (this.isCtrlTab(event)) {
      let tabCount = this.tabs.length;
      if (!this.KeyLock) {
        if (this.handleCtrlTab) {
          this.TabIndex = tabCount - 1;
        } else {
          this.TabIndex = this.tabs.indexOf(gBrowser.mCurrentTab);
        }
        this.KeyLock = true;
      }

      if (this.TabListLock) {
        let tab = this.tabs[this.TabIndex];
        if (tab)
          tab.mCorrespondingMenuitem.setAttribute("_moz-menuactive", "false");
      }

      if ((this.handleCtrlTab && event.shiftKey) || (!this.handleCtrlTab && !event.shiftKey)) {
        this.TabIndex++;
        if (this.TabIndex >= tabCount)
          this.TabIndex = 0;
      } else {
        this.TabIndex--;
        if (this.TabIndex < 0)
          this.TabIndex = tabCount - 1;
      }

      if (this.showTabList) {
        this.KeyboardNavigating = true;
        if (!this.TabListLock) {
          if (tabCount > 1) {
            if (!this._timer) {
              this._timer = setTimeout(() => {
                this._timer = null;
                if (!this.TabListLock)
                  this.DisplayTabList();
              }, 200);
            } else {
              this.DisplayTabList();
            }
          }
        } else {
          let item = this.tabs[this.TabIndex].mCorrespondingMenuitem;
          item.setAttribute("_moz-menuactive", "true");
          TabmixAllTabs.updateMenuItemActive(null, item);
        }
      } else {
        TabmixAllTabs._tabSelectedFromList(this.tabs[this.TabIndex]);
      }
      event.stopPropagation();
      event.preventDefault();
    } else if (this.TabListLock && this.CtrlKey &&
             event.keyCode == event.DOM_VK_SHIFT) {
      // don't hide the tabs list popup when user press shift
      // return;
    } else {
      if (this.TabListLock)
        this.TabList.hidePopup();

      const tabBox = Tabmix.isVersion(590) ? gBrowser.tabbox : gBrowser.mTabBox;
      tabBox.handleEvent(event);
    }
  },

  OnKeyUp: function _LastTab_OnKeyUp(event) {
    var keyReleased = event.keyCode == event.DOM_VK_CONTROL;
    this.CtrlKey = event.ctrlKey && !event.altKey && !event.metaKey;
    Tabmix.keyModifierDown = event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
    if (!keyReleased)
      return;
    var tabToSelect;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
      tabToSelect = this.tabs[this.TabIndex];
      TabmixAllTabs._tabSelectedFromList(tabToSelect);
      this.PushSelectedTab();
    }
    if (this.TabListLock) {
      let tab = this.tabs[this.TabIndex];
      if (tab && tab.mCorrespondingMenuitem.getAttribute("_moz-menuactive") == "true") {
        tabToSelect = tab;
      }

      TabmixAllTabs.updateMenuItemInactive(null);
      TabmixAllTabs.backupLabel = "";

      this.TabList.hidePopup();
      if (tabToSelect)
        TabmixAllTabs._tabSelectedFromList(tabToSelect);
      this.PushSelectedTab();
    }
    if (this.KeyLock) {
      this.PushSelectedTab();
      this.TabIndex = 0;
      this.KeyLock = false;
    }
    this._tabs = null;
  },

  onMenuCommand(event) {
    if (this.respondToMouseInTabList) {
      TabmixAllTabs._tabSelectedFromList(event.target.tab);
      this.PushSelectedTab();
    }
  },

  onPopupshowing() {
    this.TabList.addEventListener("DOMMenuItemActive", this, true);
    this.TabList.addEventListener("DOMMenuItemInactive", this, true);
  },

  onPopuphidden() {
    this.TabList.removeEventListener("DOMMenuItemActive", this, true);
    this.TabList.removeEventListener("DOMMenuItemInactive", this, true);
    if (!this.SuppressTabListReset) {
      var tablist = this.TabList;

      while (tablist.childNodes.length > 0) {
        tablist.firstChild.remove();
      }

      this.TabListLock = false;
      this.TabIndex = 0;
      this.KeyLock = false;

      TabmixAllTabs.hideCommonList(tablist);
    }
  },

  OnSelect() {
    // session manager can select new tab before TMP_LastTab is init
    if (!this._inited)
      return;

    var tabCount = this.TabHistory.length;
    if (tabCount != gBrowser.tabs.length) {
      if (tabCount > gBrowser.tabs.length) {
        if (gBrowser.tabs.length == 1) {
          this.KeyLock = false;
          this.TabIndex = 0;
        }
      }
      this.PushSelectedTab();
    } else if (!this.KeyLock) {
      if (this.CtrlKey)
        this.KeyLock = true; // allow other tab navigation methods to work
      else
        this.PushSelectedTab();
    }
  },

  PushSelectedTab: function TMP_LastTab_PushSelectedTab() {
    var selectedTab = gBrowser.tabContainer.selectedItem;
    this.detachTab(selectedTab);
    this.TabHistory.push(selectedTab);
  },

  ReadPreferences() {
    // when Build-in tabPreviews is on we disable our own function
    var mostRecentlyUsed = Services.prefs.getBoolPref("browser.ctrlTab.previews");
    var tabPreviews = document.getElementById("ctrlTab-panel") && "ctrlTab" in window;
    if (tabPreviews) {
      var tabPreviewsCurrentStatus = Boolean(ctrlTab._recentlyUsedTabs);
      tabPreviews = mostRecentlyUsed && Tabmix.prefs.getBoolPref("lasttab.tabPreviews");
      if (tabPreviewsCurrentStatus != tabPreviews) {
        if (tabPreviews) {
          ctrlTab.init();
          ctrlTab._recentlyUsedTabs = [];
          for (var i = 0; i < this.TabHistory.length; i++) {
            ctrlTab._recentlyUsedTabs.unshift(this.TabHistory[i]);
          }
        } else {
          ctrlTab.uninit();
        }
      }
    }

    this.handleCtrlTab = !tabPreviews && mostRecentlyUsed;
    this.showTabList = !tabPreviews && Tabmix.prefs.getBoolPref("lasttab.showTabList");
    this.respondToMouseInTabList = Tabmix.prefs.getBoolPref("lasttab.respondToMouseInTabList");
  },

  inverseIndex(index) {
    return this.handleCtrlTab ? index : this.tabs.length - 1 - index;
  }

};

Tabmix.slideshow = {
  cancel() {
    if (Tabmix.SlideshowInitialized && Tabmix.flst.slideShowTimer) {
      Tabmix.flst.cancel();
    }
  }
};
