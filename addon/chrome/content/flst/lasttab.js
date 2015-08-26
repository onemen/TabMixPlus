"use strict";

/*////////////////////////////////////////////////////////////////////
// The Original Code is the "LastTab" extension for Mozilla Firefox.//
// version 1.5 - October 26, 2005                                   //
// The Initial Developer of the Original Code is Timothy Humphrey.  //
/*////////////////////////////////////////////////////////////////////
var TMP_LastTab = {
   CtrlKey : false,
   handleCtrlTab : true,
   KeyboardNavigating : true,
   KeyLock : false,
   respondToMouseInTabList : true,
   showTabList : true,
   SuppressTabListReset : false,
   TabHistory : [],
   TabIndex : 0,
   TabList : null,
   TabListLock : false,
   _inited: false,

   DisplayTabList : function() {
      var element = document.documentElement;
      var tablist = this.TabList;

      TabmixAllTabs.createCommonList(tablist, this.handleCtrlTab ? 3 : 2);
      var item = this.tabs[this.TabIndex].mCorrespondingMenuitem;
      item.setAttribute("_moz-menuactive", "true");
      TabmixAllTabs.updateMenuItemActive(null, item);

      // show offscreen to get popup measurements
      tablist.showPopup(element, -element.boxObject.screenX, 10000, "popup", null, null);
      var width = tablist.boxObject.width;
      var height = tablist.boxObject.height;
      this.SuppressTabListReset = true;
      tablist.hidePopup();
      this.SuppressTabListReset = false;

      // show at the center of the screen
      tablist.openPopupAtScreen(screen.availLeft + (screen.availWidth - width) / 2,
                                screen.availTop + (screen.availHeight - height) / 2,
                                false);

      var ietab = "chrome://ietab/content/reloaded.html?url=";
      if (gBrowser.currentURI.spec.startsWith(ietab))
         tablist.focus();

      this.TabListLock = true;
   },

   init : function() {
      this._inited = true;

      this.TabList = document.getElementById("lasttabTabList");

      let tabBox = gBrowser.mTabBox;
      let els = Cc["@mozilla.org/eventlistenerservice;1"]
                    .getService(Ci.nsIEventListenerService);
      if (Tabmix.isVersion(320)) {
        els.removeSystemEventListener(tabBox._eventNode, "keydown", tabBox, false);
      }
      else {
        tabBox._eventNode.removeEventListener("keypress", tabBox, false);
        els.addSystemEventListener(tabBox._eventNode, "keypress", this, false);
      }
      els.addSystemEventListener(tabBox._eventNode, "keydown", this, false);
      els.addSystemEventListener(tabBox._eventNode, "keyup", this, false);

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

   deinit : function() {
      if (!this._inited)
        return;

      let tabBox = gBrowser.mTabBox;
      let els = Cc["@mozilla.org/eventlistenerservice;1"]
                    .getService(Ci.nsIEventListenerService);
      els.removeSystemEventListener(tabBox._eventNode, "keydown", this, false);
      els.removeSystemEventListener(tabBox._eventNode, "keyup", this, false);
      if (!Tabmix.isVersion(320))
         els.removeSystemEventListener(tabBox._eventNode, "keypress", this, false);
   },

   handleEvent : function(event) {
      switch (event.type) {
         case "keydown":
            this.OnKeyDown(event);
            break;
         case "keypress":
            this.OnKeyPress(event);
            break;
         case "keyup":
            this.OnKeyUp(event);
            break;
         case "DOMMenuItemActive":
            this.ItemActive(event);
            break;
         case "DOMMenuItemInactive":
            this.ItemInactive(event);
            break;
      }
   },

   ItemActive : function(event) {
      TabmixAllTabs.updateMenuItemActive(event);
      if(this.respondToMouseInTabList) {
         if(this.KeyboardNavigating) {
            if(event.target.value != this.inverseIndex(this.TabIndex))
               this.tabs[this.TabIndex].mCorrespondingMenuitem.setAttribute("_moz-menuactive", "false");
            this.KeyboardNavigating = false;
         }
         this.TabIndex = this.inverseIndex(event.target.value);
      }
      else {
         if(event.target.value != this.inverseIndex(this.TabIndex))
            event.target.setAttribute("_moz-menuactive", "false");
      }
   },

   ItemInactive : function(event) {
      TabmixAllTabs.updateMenuItemInactive(event);
      if(!this.respondToMouseInTabList && event.target.value == this.inverseIndex(this.TabIndex))
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

   isCtrlTab : function(event) {
     return (this.handleCtrlTab || this.showTabList) &&
             event.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_TAB &&
             event.ctrlKey && !event.altKey && !event.metaKey;
   },

   OnKeyDown : function(event) {
      this.CtrlKey = event.ctrlKey && !event.altKey && !event.metaKey;
      Tabmix.keyModifierDown = event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
      if (Tabmix.isVersion(320))
         this.OnKeyPress(event);
   },

   set tabs (val) {
     if (val !== null)
       return;

     this._tabs = null;
   },

   get tabs () {
     if (this._tabs)
       return this._tabs;
     let list = this.handleCtrlTab ? this.TabHistory : gBrowser.tabs;
     this._tabs = Array.filter(list, function(tab) {
       return !tab.hidden && !tab.closing;
     });
     return this._tabs;
   },

   OnKeyPress : function _LastTab_OnKeyPress(event) {
      if (this.isCtrlTab(event)) {
         let tabCount = this.tabs.length;
         if(!this.KeyLock) {
            if (this.handleCtrlTab) {
               this.TabIndex = tabCount - 1;
            } else {
               this.TabIndex = this.tabs.indexOf(gBrowser.mCurrentTab);
            }
            this.KeyLock = true;
         }

         if(this.TabListLock) {
            let tab = this.tabs[this.TabIndex];
            if (tab)
              tab.mCorrespondingMenuitem.setAttribute("_moz-menuactive", "false");
         }

         if((this.handleCtrlTab && event.shiftKey) || (!this.handleCtrlTab && !event.shiftKey)) {
            this.TabIndex++;
            if(this.TabIndex >= tabCount)
               this.TabIndex = 0;
         }
         else {
            this.TabIndex--;
            if(this.TabIndex < 0)
               this.TabIndex = tabCount - 1;
         }

         if(this.showTabList) {
            this.KeyboardNavigating = true;
            if(!this.TabListLock) {
               if(tabCount > 1) {
                 if (!this._timer) {
                   this._timer = setTimeout(function (self) {
                     self._timer = null;
                     if (!self.TabListLock)
                       self.DisplayTabList();
                   }, 200, this);
                 }
                 else
                   this.DisplayTabList();
               }
            }
            else {
               let item = this.tabs[this.TabIndex].mCorrespondingMenuitem;
               item.setAttribute("_moz-menuactive", "true");
               TabmixAllTabs.updateMenuItemActive(null, item);
            }
         }
         else
            TabmixAllTabs._tabSelectedFromList(this.tabs[this.TabIndex]);
         event.stopPropagation();
         event.preventDefault();
      }
      else if (this.TabListLock && this.CtrlKey &&
               event.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_SHIFT) {
        // don't hide the tabs list popup when user press shift
        return;
      }
      else {
         if(this.TabListLock)
            this.TabList.hidePopup();

         gBrowser.mTabBox.handleEvent(event);
      }
   },

   OnKeyUp : function _LastTab_OnKeyUp(event) {
      var keyReleased = event.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_CONTROL;
      this.CtrlKey = event.ctrlKey && !event.altKey && !event.metaKey;
      Tabmix.keyModifierDown = event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
      if(!keyReleased)
        return;
      var tabToSelect;
      if(this._timer) {
        clearTimeout(this._timer);
        this._timer = null;
        tabToSelect = this.tabs[this.TabIndex];
        TabmixAllTabs._tabSelectedFromList(tabToSelect);
        this.PushSelectedTab();
      }
      if(this.TabListLock) {
         let tab = this.tabs[this.TabIndex];
         if(tab && tab.mCorrespondingMenuitem.getAttribute("_moz-menuactive") == "true") {
            tabToSelect = tab;
         }

         TabmixAllTabs.updateMenuItemInactive(null);
         TabmixAllTabs.backupLabel = "";

         this.TabList.hidePopup();
         if (tabToSelect)
           TabmixAllTabs._tabSelectedFromList(tabToSelect);
         this.PushSelectedTab();
      }
      if(this.KeyLock) {
         this.PushSelectedTab();
         this.TabIndex = 0;
         this.KeyLock = false;
      }
      this._tabs = null;
   },

   onMenuCommand : function(event) {
      if(this.respondToMouseInTabList) {
         TabmixAllTabs._tabSelectedFromList(event.target.tab);
         this.PushSelectedTab();
      }
   },

   onPopupshowing : function() {
      this.TabList.addEventListener("DOMMenuItemActive", this, true);
      this.TabList.addEventListener("DOMMenuItemInactive", this, true);
   },

   onPopuphidden : function() {
      this.TabList.removeEventListener("DOMMenuItemActive", this, true);
      this.TabList.removeEventListener("DOMMenuItemInactive", this, true);
      if(!this.SuppressTabListReset) {
         var tablist = this.TabList;

         while(tablist.childNodes.length > 0)
            tablist.removeChild(tablist.childNodes[0]);

         this.TabListLock = false;
         this.TabIndex = 0;
         this.KeyLock = false;

         TabmixAllTabs.hideCommonList(tablist);
      }
   },

   OnSelect: function() {
      // session manager can select new tab before TMP_LastTab is init
      if (!this._inited)
         return;

      var tabCount = this.TabHistory.length;
      if(tabCount != gBrowser.tabs.length) {
         if(tabCount > gBrowser.tabs.length) {
            if(gBrowser.tabs.length == 1) {
               this.KeyLock = false;
               this.TabIndex = 0;
            }
         }
         this.PushSelectedTab();
      }
      else if(!this.KeyLock) {
         if(this.CtrlKey)
            this.KeyLock = true; //allow other tab navigation methods to work
         else
            this.PushSelectedTab();
      }
   },

   PushSelectedTab: function TMP_LastTab_PushSelectedTab() {
      var selectedTab = gBrowser.tabContainer.selectedItem;
      this.detachTab(selectedTab);
      this.TabHistory.push(selectedTab);
   },

   ReadPreferences : function() {
      // when Build-in tabPreviews is on we disable our own function
      var mostRecentlyUsed = Services.prefs.getBoolPref("browser.ctrlTab.previews");
      var tabPreviews = document.getElementById("ctrlTab-panel") && "ctrlTab" in window;
      if (tabPreviews) {
         var tabPreviewsCurentStatus = ctrlTab._recentlyUsedTabs ? true : false;
         tabPreviews = mostRecentlyUsed && Tabmix.prefs.getBoolPref("lasttab.tabPreviews");
         if (tabPreviewsCurentStatus != tabPreviews) {
            if (tabPreviews) {
               ctrlTab.init();
               ctrlTab._recentlyUsedTabs = [];
               for (var i = 0; i < this.TabHistory.length; i++) {
                  ctrlTab._recentlyUsedTabs.unshift(this.TabHistory[i]);
               }
            }
            else
               ctrlTab.uninit();
         }
      }

      this.handleCtrlTab = !tabPreviews && mostRecentlyUsed;
      this.showTabList = !tabPreviews && Tabmix.prefs.getBoolPref("lasttab.showTabList");
      this.respondToMouseInTabList = Tabmix.prefs.getBoolPref("lasttab.respondToMouseInTabList");
   },

   inverseIndex : function(index) {
      return this.handleCtrlTab ? index : this.tabs.length - 1 - index;
   }

};
