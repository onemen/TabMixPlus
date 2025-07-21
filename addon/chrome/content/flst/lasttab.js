/* exported TMP_LastTab */
"use strict";

//////////////////////////////////////////////////////////////////////
// The Original Code is the "LastTab" extension for Mozilla Firefox.//
// version 1.5 - October 26, 2005                                   //
// The Initial Developer of the Original Code is Timothy Humphrey.  //
//////////////////////////////////////////////////////////////////////
/** @type {TabmixLastTabNS.LastTab} */
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
  TabListLock: false,
  _inited: false,
  _tabs: null,
  _timer: null,

  get TabList() {
    return Tabmix.lazyGetter(this, "TabList", document.getElementById("lasttabTabList"));
  },

  DisplayTabList() {
    var tablist = this.TabList;

    TabmixAllTabs.createCommonList(tablist, this.handleCtrlTab ? 3 : 2);
    var item = this.tabs[this.TabIndex]?.mCorrespondingMenuitem ?? null;
    item?.setAttribute("_moz-menuactive", "true");
    TabmixAllTabs.updateMenuItemActive(item);

    // show the list at the center of the screen
    let left = (w = 0) => screen.availLeft + (screen.availWidth - w) / 2;
    let top = (h = 0) => screen.availTop + (screen.availHeight - h) / 2;
    tablist.style.visibility = "hidden";
    tablist.openPopupAtScreen(left(), top(), true);
    const {height, width} = tablist.getBoundingClientRect();
    tablist.moveTo(left(width), top(height));
    tablist.style.visibility = "";

    var ietab = "chrome://ietab/content/reloaded.html?url=";
    if (gBrowser.currentURI.spec.startsWith(ietab)) {
      tablist.focus();
    }

    this.TabListLock = true;
  },

  init() {
    this._inited = true;
    document.removeEventListener("keydown", gBrowser.tabbox, {mozSystemGroup: true});
    document.addEventListener("keydown", this, {mozSystemGroup: true});
    document.addEventListener("keyup", this, {mozSystemGroup: true});
    window.addEventListener("blur", this, {capture: true, mozSystemGroup: true});

    // if session manager select other tab then the first one we need to build
    // TabHistory in two steps to maintain natural Ctrl-Tab order.
    this.TabHistory = [];
    const currentIndex = gBrowser._selectedTab._tPos;
    const rightTabs = gBrowser.tabs.slice(currentIndex);
    const leftTabs = gBrowser.tabs.slice(0, currentIndex);
    for (const tab of rightTabs) {
      this.TabHistory.unshift(tab);
    }
    for (const tab of leftTabs) {
      this.TabHistory.unshift(tab);
    }

    this.ReadPreferences();
  },

  deinit() {
    if (!this._inited) {
      return;
    }

    document.removeEventListener("keydown", this, {mozSystemGroup: true});
    document.removeEventListener("keyup", this, {mozSystemGroup: true});
    window.removeEventListener("blur", this, {capture: true, mozSystemGroup: true});
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

  /*
   * disallow mouse down on TabsToolbar to start dragging the window when one
   * of the key modifiers is down
   */
  disallowDragwindow(keyDown) {
    if (
      Tabmix.prefs.getBoolPref("tabbar.click_dragwindow") &&
      keyDown == Tabmix.keyModifierDown &&
      keyDown != this.disallowDragState
    ) {
      this.updateDisallowDrag(keyDown);
    }
  },

  disallowDragState: false,
  updateDisallowDrag(disallow) {
    this.disallowDragState = disallow;
    Tabmix.setItem("TabsToolbar-customization-target", "tabmix-disallow-drag", disallow || null);
  },

  ItemActive(event) {
    TabmixAllTabs.updateMenuItemActive(event.target);
    if (this.respondToMouseInTabList) {
      if (this.KeyboardNavigating) {
        if (event.target.value != this.inverseIndex(this.TabIndex)) {
          this.tabs[this.TabIndex]?.mCorrespondingMenuitem?.removeAttribute("_moz-menuactive");
        }

        this.KeyboardNavigating = false;
      }
      this.TabIndex = this.inverseIndex(Number(event.target.value));
    } else if (event.target.value != this.inverseIndex(this.TabIndex)) {
      event.target.removeAttribute("_moz-menuactive");
    }
  },

  ItemInactive(event) {
    TabmixAllTabs.updateMenuItemInactive();
    if (!this.respondToMouseInTabList && event.target.value == this.inverseIndex(this.TabIndex)) {
      event.target.setAttribute("_moz-menuactive", "true");
    }
  },

  attachTab: function TMP_LastTab_attachTab(aTab, lastRelatedTab) {
    if (!this._inited) {
      return;
    }

    this.detachTab(aTab);
    let index = this.TabHistory.findIndex(t => t === lastRelatedTab);
    if (index < 0) {
      index = this.TabHistory.length - 1;
    }

    this.TabHistory.splice(index, 0, aTab);
  },

  detachTab: function TMP_LastTab_detachTab(aTab) {
    var i = this.TabHistory.indexOf(aTab);
    if (i >= 0) {
      this.TabHistory.splice(i, 1);
    }
  },

  isCtrlTab(event) {
    return (
      (this.handleCtrlTab || this.showTabList) &&
      event.keyCode == event.DOM_VK_TAB &&
      event.ctrlKey &&
      !Tabmix.isAltKey(event) &&
      !event.metaKey
    );
  },

  OnKeyDown(event) {
    this.CtrlKey = event.ctrlKey && !Tabmix.isAltKey(event) && !event.metaKey;
    Tabmix.keyModifierDown =
      event.shiftKey || event.ctrlKey || Tabmix.isAltKey(event) || event.metaKey;
    this.OnKeyPress(event);
  },

  set tabs(val) {
    if (val !== null) {
      return;
    }

    this._tabs = null;
  },

  get tabs() {
    if (this._tabs) {
      return this._tabs;
    }

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
          this.TabIndex = this.tabs.indexOf(gBrowser._selectedTab);
        }
        this.KeyLock = true;
      }

      if (this.TabListLock) {
        let tab = this.tabs[this.TabIndex];
        if (tab) {
          tab.mCorrespondingMenuitem?.removeAttribute("_moz-menuactive");
        }
      }

      if ((this.handleCtrlTab && event.shiftKey) || (!this.handleCtrlTab && !event.shiftKey)) {
        this.TabIndex++;
        if (this.TabIndex >= tabCount) {
          this.TabIndex = 0;
        }
      } else {
        this.TabIndex--;
        if (this.TabIndex < 0) {
          this.TabIndex = tabCount - 1;
        }
      }

      if (this.showTabList) {
        this.KeyboardNavigating = true;
        if (!this.TabListLock) {
          if (tabCount > 1) {
            if (!this._timer) {
              this._timer = setTimeout(() => {
                this._timer = null;
                if (!this.TabListLock) {
                  this.DisplayTabList();
                }
              }, 200);
            } else {
              this.DisplayTabList();
            }
          }
        } else {
          let item = this.tabs[this.TabIndex]?.mCorrespondingMenuitem ?? null;
          item?.setAttribute("_moz-menuactive", "true");
          TabmixAllTabs.updateMenuItemActive(item);
        }
      } else {
        let tab = this.tabs[this.TabIndex];
        if (tab) {
          TabmixAllTabs._tabSelectedFromList(tab);
        }
      }
      event.stopPropagation();
      event.preventDefault();
    } else if (this.TabListLock && this.CtrlKey && event.keyCode == event.DOM_VK_SHIFT) {
      // don't hide the tabs list popup when user press shift
      // return;
    } else {
      if (this.TabListLock) {
        this.TabList.hidePopup();
      }

      gBrowser.tabbox.handleEvent(event);
    }
  },

  OnKeyUp: function _LastTab_OnKeyUp(event) {
    var keyReleased = event.keyCode == event.DOM_VK_CONTROL;
    this.CtrlKey = event.ctrlKey && !Tabmix.isAltKey(event) && !event.metaKey;
    Tabmix.keyModifierDown =
      event.shiftKey || event.ctrlKey || Tabmix.isAltKey(event) || event.metaKey;
    if (!keyReleased) {
      return;
    }

    var tabToSelect;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
      tabToSelect = this.tabs[this.TabIndex];
      if (tabToSelect) {
        TabmixAllTabs._tabSelectedFromList(tabToSelect);
      }
      this.PushSelectedTab();
    }
    if (this.TabListLock) {
      let tab = this.tabs[this.TabIndex];
      if (tab && tab.mCorrespondingMenuitem?.getAttribute("_moz-menuactive") == "true") {
        tabToSelect = tab;
      }

      TabmixAllTabs.updateMenuItemInactive();
      TabmixAllTabs.backupLabel = "";

      this.TabList.hidePopup();
      if (tabToSelect) {
        TabmixAllTabs._tabSelectedFromList(tabToSelect);
      }

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

      while (tablist.childNodes.length) {
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
    if (!this._inited) {
      return;
    }

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
      if (this.CtrlKey) {
        this.KeyLock = true;
      } else {
        // allow other tab navigation methods to work
        this.PushSelectedTab();
      }
    }
  },

  PushSelectedTab: function TMP_LastTab_PushSelectedTab() {
    var selectedTab = gBrowser.selectedTab;
    this.detachTab(selectedTab);
    this.TabHistory.push(selectedTab);
  },

  ReadPreferences() {
    // when Build-in tabPreviews is on we disable our own function
    var mostRecentlyUsed = Services.prefs.getBoolPref("browser.ctrlTab.sortByRecentlyUsed");
    var tabPreviews = document.getElementById("ctrlTab-panel") && "ctrlTab" in window;
    if (tabPreviews) {
      var tabPreviewsCurrentStatus = Boolean(ctrlTab._recentlyUsedTabs);
      tabPreviews = mostRecentlyUsed && Tabmix.prefs.getBoolPref("lasttab.tabPreviews");
      if (tabPreviewsCurrentStatus != tabPreviews) {
        if (tabPreviews) {
          ctrlTab.init();
          ctrlTab._recentlyUsedTabs = [];
          for (const tab of this.TabHistory) {
            ctrlTab._recentlyUsedTabs.unshift(tab);
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
  },
};

Tabmix.slideshow = {
  cancel() {
    if (Tabmix.SlideshowInitialized && Tabmix.flst.slideShowTimer) {
      Tabmix.flst.cancel();
    }
  },
};
