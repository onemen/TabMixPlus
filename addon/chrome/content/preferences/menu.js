/* exported gMenuPane */
"use strict";

/** @type {MenuPane} */
var gMenuPane = {
  init() {
    MozXULElement.insertFTLIfNeeded("browser/menubar.ftl");
    MozXULElement.insertFTLIfNeeded("browser/tabContextMenu.ftl");
    MozXULElement.insertFTLIfNeeded("browser/preferences/preferences.ftl");
    Tabmix.setFTLDataId("paneMenu");

    $("pinTab").label = gPrefWindow.pinTabLabel;
    $("togglePinTab").setAttribute("label", gPrefWindow.pinTabLabel);
    $("clearClosedTabs").setAttribute("label", TabmixSvc.getString("undoclosetab.clear.label"));

    const [showBmkTab, showBmkTabs] = [$("showBmkTab"), $("showBmkTabs")];
    document.l10n?.translateElements([showBmkTab, showBmkTabs]).then(() => {
      showBmkTab.label = showBmkTab.label.replace("…", "");
      showBmkTabs.label = showBmkTabs.label.replace("…", "");
    });

    MozXULElement.insertFTLIfNeeded("browser/tabbrowser.ftl");
    const [muted, unmuted] = [$("muteTab"), $("unmuteTab")];
    document.l10n?.setAttributes(muted, "tabbrowser-context-mute-tab");
    document.l10n?.setAttributes(unmuted, "tabbrowser-context-unmute-tab");
    document.l10n?.translateElements([muted, unmuted, $("showBmkTab")]).then(() => {
      muted.label += "/" + unmuted.label;
    });

    if (!Tabmix.isVersion(1270)) {
      gPrefWindow.removeItemAndPrefById("pref_closeDuplicateTabs");
    }

    this.setInverseLinkLabel();

    // we can not modify build-in key with reserved attribute
    // bug 1296863 Stop disabling the "New Tab" command in popups
    // bug 1297342 "reserved" attribute should be on <key> elements
    Object.entries(Shortcuts.keys).forEach(([key, keyData]) => {
      if (keyData.reserved) {
        $(key).hidden = true;
      }
    });

    if (!Shortcuts.keys.browserReload.id) {
      $("browserReload").hidden = true;
    }

    this.initializeShortcuts();
    this.setSlideShowLabel();
    let paneMenu = $("paneMenu");
    if (paneMenu.hasAttribute("editSlideShowKey")) {
      paneMenu.removeAttribute("editSlideShowKey");
      setTimeout(() => this.editSlideShowKey(), 0);
    }

    gPrefWindow.initPane("paneMenu");
  },

  initializeShortcuts() {
    if (Shortcuts.prefsChangedByTabmix) {
      return;
    }

    let newValue = $Pref("pref_shortcuts").stringValue;
    let shortcuts = $("shortcut-group");
    if (newValue == shortcuts.value) {
      return;
    }

    shortcuts.value = newValue;
    shortcuts.keys = JSON.parse(newValue);

    /** @param {MozShortcutClass} shortcut */
    let callBack = shortcut => {
      const shortcutData = Shortcuts.keys[shortcut.id];
      return shortcutData ? shortcut.valueFromPreferences(shortcutData) : false;
    };
    this.updateShortcuts(shortcuts, callBack);
  },

  _slideShow: "",
  updateShortcuts(aShortcuts, aCallBack) {
    let boxes = Array.from(aShortcuts.childNodes).filter(shortcut => aCallBack(shortcut));
    $("shortcuts-panel").setAttribute("usedKeys", Boolean(boxes.length));
    if (this._slideShow != $("shortcut-group").keys.slideShow) {
      this._slideShow = $("shortcut-group").keys.slideShow;
      this.setSlideShowLabel();
    }
  },

  setSlideShowLabel() {
    let slideShow = $("slideShow");
    let label = slideShow.disabled ? "??" : getFormattedKey(slideShow.key);
    $("slideDelayLabel").value = slideShow.getAttribute("_label")?.replace("#1", label) ?? "";
    gPrefWindow.setDisabled("obs_slideDelay", slideShow.disabled);
  },

  editSlideShowKey() {
    $("menu").selectedIndex = 3;
    let slideShow = $("slideShow");
    let item = $("hide-unused-shortcuts");
    if (!slideShow.hasAttribute("value") && $("shortcuts-panel").getAttribute(item.id) == "true") {
      this.toggleLinkLabel(item);
    }
    slideShow.editBox.focus();
    let shortcuts = $("shortcut-group");
    shortcuts.scrollTop = shortcuts.scrollHeight - shortcuts.clientHeight;
  },

  // for shortcuts panel
  toggleLinkLabel(item) {
    var panel = $("shortcuts-panel");
    var wasShow = panel.getAttribute(item.id) == "false";
    item.value = item.getAttribute(wasShow ? "show" : "hide") ?? "";
    panel.setAttribute(item.id, wasShow);
  },

  // update item showInverseLink label in menu pane
  // when "Links" in Events > Tab Focus changed
  setInverseLinkLabel() {
    var showInverseLink = $("showInverseLink");
    var val = ($Pref("pref_selectTab") || $Pref("pref_selectTab1")).value;
    var label = showInverseLink.getAttribute((val ? "bg" : "fg") + "label") ?? "";
    showInverseLink.setAttribute("label", label);
  },

  get PrivateBrowsingUtils() {
    return Tabmix.lazyGetter(
      this,
      "PrivateBrowsingUtils",
      () =>
        ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs")
          .PrivateBrowsingUtils
    );
  },
};
