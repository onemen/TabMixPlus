"use strict";

this.EXPORTED_SYMBOLS = ["RenameTab"];

const {TabmixSvc} = ChromeUtils.import("chrome://tabmix-resource/content/TabmixSvc.jsm");
const {ChromeManifest} = ChromeUtils.import("chrome://tabmix-resource/content/bootstrap/ChromeManifest.jsm");
const {Overlays} = ChromeUtils.import("chrome://tabmix-resource/content/bootstrap/Overlays.jsm");

ChromeUtils.defineModuleGetter(this, "TabmixPlacesUtils",
  "chrome://tabmix-resource/content/Places.jsm");

this.RenameTab = {
  window: null,
  panel: null,
  data: {},
  _element(aID) {
    return this.window.document.getElementById(aID);
  },

  editTitle(aTab) {
    if (this.panel && this.panel.state != "closed")
      this.hidePopup();

    this.window = aTab.ownerGlobal;
    var gBrowser = this.window.gBrowser;

    this.data.tab = aTab = aTab.localName == "tab" ? aTab : gBrowser._selectedTab;
    var browser = gBrowser.getBrowserForTab(aTab);
    let docTitle = aTab.hasAttribute("pending") ?
      this.window.TMP_SessionStore.getTitleFromTabState(aTab) :
      browser.contentTitle;
    this.data.url = browser.currentURI.spec;

    const prepareDataAndShowPanel = title => {
      this.data.docTitle = title;
      if (!this.data.docTitle)
        this.data.docTitle = this.window.isBlankPageURL(this.data.url) ?
          this.window.Tabmix.getString("tabs.emptyTabTitle") : this.data.url;
      this.data.modified = aTab.getAttribute("label-uri") || null;
      if (this.data.modified == this.data.url || this.data.modified == "*")
        this.data.value = aTab.getAttribute("fixed-label");
      else
        this.data.value = this.data.docTitle;

      this.showPanel();
    };

    TabmixPlacesUtils.asyncGetTitleFromBookmark(this.data.url, docTitle, null, aTab)
        .then(title => prepareDataAndShowPanel(title));
  },

  showPanel: function TMP_renametab_showPanel() {
    var popup = this._element("tabmixRenametab_panel");
    if (popup) {
      if (popup._overlayLoaded) {
        this.panel = popup;
        this._doShowPanel();
      }
      return;
    }

    popup = this.panel = this.window.document.createXULElement("panel");
    popup._overlayLoaded = false;
    popup.id = "tabmixRenametab_panel";
    popup.hidden = true; // prevent panel initialize. initialize before overlay break it.
    this._element("mainPopupSet").appendChild(popup);
    const ov = new Overlays(new ChromeManifest(), this.window);
    ov.load("chrome://tabmixplus/content/overlay/renameTab.xhtml").then(() => {
      this.observe(null, "xul-overlay-merged");
    });
  },

  observe(aSubject, aTopic) {
    if (aTopic != "xul-overlay-merged")
      return;

    this.panel._overlayLoaded = true;
    this.panel.hidden = false;

    const l10Id = TabmixSvc.version(890) ? "bookmark-panel-save-button" : "bookmark-panel-done-button";
    this._element("tabmixRenametab_doneButton").setAttribute("data-l10n-id", l10Id);
    this._element("tabmixRenametab_deleteButton").label = TabmixSvc.getDialogStrings("Cancel");

    // reorder buttons for MacOS & Linux
    if (TabmixSvc.isLinux || TabmixSvc.isMac) {
      let buttons = this._element("tabmixRenametab_buttons");
      buttons.removeAttribute("pack");
      buttons.setAttribute("dir", "rtl");
    }

    this._doShowPanel();
  },

  _doShowPanel() {
    var popup = this.panel;
    popup.addEventListener("keypress", this);
    // dock the panel to the tab icon when possible, otherwise show the panel
    // at screen center
    if (this.window.Tabmix.tabsUtils.isElementVisible(this.data.tab))
      popup.openPopup(this.data.tab, "bottomcenter topleft");
    else {
      let screen = this.window.screen;
      const {height = 215, width = 330} = popup.getBoundingClientRect();
      popup.openPopupAtScreen(screen.availLeft + (screen.availWidth - width) / 2,
        screen.availTop + (screen.availHeight - height) / 2, false);
      const {height: newHeight, width: newWidth} = popup.getBoundingClientRect();
      if (newWidth != width) {
        popup.moveTo(screen.availLeft + (screen.availWidth - newWidth) / 2,
          screen.availTop + (screen.availHeight - newHeight) / 2);
      }
    }

    var image = this.data.tab.linkedBrowser.mIconURL || "chrome://tabmixplus/skin/tmp.png";
    this._element("tabmixRenametab_icon").setAttribute("src", image);
    this._element("tabmixRenametab_titleField").value = this.data.value;
    this._element("tabmixRenametab_defaultField").value = this.data.docTitle;
    this.window.Tabmix.setItem(popup, "modified", this.data.modified);
    var permanently = this._element("tabmixRenametab_checkbox");
    if (this.data.modified)
      permanently.checked = this.data.modified == "*";

    this.data.permanently = permanently.checked;
  },

  resetTitle() {
    this.data.value = this.data.docTitle;
    this.update(true);
  },

  update(aReset) {
    var data = this.data;
    var tab = data.tab;
    var label = data.value;
    var resetDefault = aReset || (label == data.docTitle && !data.permanently);
    var url = resetDefault ? null : data.permanently ? "*" : data.url;

    var win = this.window;
    win.Tabmix.setItem(tab, "fixed-label", resetDefault ? null : label);
    win.Tabmix.setItem(tab, "label-uri", url);
    TabmixSvc.setCustomTabValue(tab, "fixed-label", resetDefault ? null : label);
    TabmixSvc.setCustomTabValue(tab, "label-uri", url);
    win.TabmixSessionManager.updateTabProp(tab);

    if (tab.label != label) {
      delete tab._labelIsInitialTitle;
      win.gBrowser.setTabTitle(tab);
    }

    this.hidePopup();
  },

  handleEvent(aEvent) {
    if (aEvent.type == "keypress" &&
         aEvent.keyCode == aEvent.DOM_VK_RETURN &&
         aEvent.target.localName != "button")
      this.update();
  },

  onpopupshown(aEvent) {
    if (aEvent.target == this.panel) {
      var textbox = this._element("tabmixRenametab_titleField");
      textbox.focus();
      textbox.select();
    }
  },

  onpopuphidden(aEvent) {
    if (aEvent.originalTarget == this.panel) {
      this.panel.removeEventListener("keypress", this);
      this.window = null;
      this.panel = null;
      this.data = {};
    }
  },

  onNewTitle(aTitle) {
    this.data.value = aTitle;
    if (!this.data.modified)
      this.window.Tabmix.setItem(this.panel, "modified", aTitle != this.data.docTitle || null);
  },

  hidePopup() {
    this.panel.hidePopup();
  }
};
