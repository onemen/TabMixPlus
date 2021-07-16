/* exported gMenuPane */
"use strict";

var gMenuPane = {
  init() {
    if (!Tabmix.isVersion(880)) {
      gPrefWindow.removeItemAndPrefById("pref_shareTabURL");
    }
    if (!Tabmix.isVersion(800)) {
      gPrefWindow.removeItemAndPrefById("pref_moveTabOptions");
    }

    MozXULElement.insertFTLIfNeeded("browser/menubar.ftl");
    MozXULElement.insertFTLIfNeeded("browser/tabContextMenu.ftl");
    MozXULElement.insertFTLIfNeeded("browser/preferences/preferences.ftl");
    Tabmix.setFTLDataId("paneMenu");

    $("pinTab").label = gPrefWindow.pinTabLabel;
    $("togglePinTab").setAttribute("label", gPrefWindow.pinTabLabel);
    $("clearClosedTabs").setAttribute("label", TabmixSvc.getString("undoclosetab.clear.label"));

    var browserWindow = Tabmix.getTopWin();
    let $$ = id => browserWindow.document.getElementById(id);

    $("muteTab").label = browserWindow.gNavigatorBundle.getString("muteTab.label") + "/" +
        browserWindow.gNavigatorBundle.getString("unmuteTab.label");

    // if Tabview exist copy its menu label
    let tabViewMenu = browserWindow.TMP_TabView.installed &&
        ($$("context_tabViewMenu") || $$("tabGroups-context_tabViewMenu"));
    if (tabViewMenu) {
      $("moveToGroup").label = tabViewMenu.getAttribute("label");
    } else {
      gPrefWindow.removeItemAndPrefById("pref_showMoveToGroup");
    }

    $("sendTabToDevice").label = browserWindow.PluralForm.get(
      1,
      browserWindow.gNavigatorBundle.getString("sendTabsToDevice.label")
    );

    this.setInverseLinkLabel();

    // we can not modify build-in key with reserved attribute
    // bug 1296863 Stop disabling the "New Tab" command in popups
    // bug 1297342 "reserved" attribute should be on <key> elements
    Object.entries(Shortcuts.keys).forEach(([key, keyData]) => {
      if (keyData.reserved) {
        $(key).hidden = true;
      }
    });

    if (!Shortcuts.keys.browserReload.id)
      $("browserReload").hidden = true;
    this.initializeShortcuts();
    this.updateSessionShortcuts();
    this.setSlideShowLabel();
    let paneMenu = $("paneMenu");
    if (paneMenu.hasAttribute("editSlideShowKey")) {
      paneMenu.removeAttribute("editSlideShowKey");
      setTimeout(() => this.editSlideShowKey(), 0);
    }

    gPrefWindow.initPane("paneMenu");
  },

  initializeShortcuts() {
    if (Shortcuts.prefsChangedByTabmix)
      return;

    let newValue = $("pref_shortcuts").value;
    let shortcuts = $("shortcut-group");
    if (newValue == shortcuts.value)
      return;
    shortcuts.value = newValue;
    shortcuts.keys = JSON.parse(newValue);
    let callBack = shortcut => shortcut.id && shortcut.valueFromPreferences(Shortcuts.keys[shortcut.id]);
    this.updateShortcuts(shortcuts, callBack);
  },

  _slideShow: "",
  updateShortcuts(aShortcuts, aCallBack) {
    let boxes = Array.prototype.filter.call(aShortcuts.childNodes, aCallBack);
    $("shortcuts-panel").setAttribute("usedKeys", Boolean(boxes.length));
    if (this._slideShow != $("shortcut-group").keys.slideShow) {
      this._slideShow = $("shortcut-group").keys.slideShow;
      this.setSlideShowLabel();
    }
  },

  setSlideShowLabel() {
    let slideShow = $("slideShow");
    let label = slideShow.disabled ? "??" : getFormattedKey(slideShow.key);
    $("slideDelayLabel").value = slideShow.getAttribute("_label").replace("#1", label);
    gPrefWindow.setDisabled("obs_slideDelay", slideShow.disabled);
  },

  editSlideShowKey() {
    $("menu").selectedIndex = 3;
    let slideShow = $("slideShow");
    let item = $("hide-unused-shortcuts");
    if (!slideShow.hasAttribute("value") &&
        $("shortcuts-panel").getAttribute(item.id) == "true")
      this.toggleLinkLabel(item);
    slideShow.editBox.focus();
    let shortcuts = $("shortcut-group");
    shortcuts.scrollTop = shortcuts.scrollHeight - shortcuts.clientHeight;
  },

  updateSessionShortcuts() {
    let block = !($("pref_sessionManager") || $("pref_sessionManager1")).value ||
        Shortcuts.permanentPrivateBrowsing;
    $("saveWindow").blocked = block;
    $("saveSession").blocked = block;
  },

  // for shortcuts panel
  toggleLinkLabel(item) {
    var panel = $("shortcuts-panel");
    var wasShow = panel.getAttribute(item.id) == 'false';
    item.value = item.getAttribute(wasShow ? 'show' : 'hide');
    panel.setAttribute(item.id, wasShow);
  },

  // update item showInverseLink label in menu pane
  // when "Links" in Events > Tab Focus changed
  setInverseLinkLabel() {
    var showInverseLink = $("showInverseLink");
    var val = ($("pref_selectTab") || $("pref_selectTab1")).value;
    var label = showInverseLink.getAttribute((val ? "bg" : "fg") + "label");
    showInverseLink.setAttribute("label", label);
  }
};
