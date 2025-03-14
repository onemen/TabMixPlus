
import {TabmixSvc} from "chrome://tabmix-resource/content/TabmixSvc.sys.mjs";
import {ChromeManifest} from "chrome://tabmix-resource/content/bootstrap/ChromeManifest.sys.mjs";
import {Overlays} from "chrome://tabmix-resource/content/bootstrap/Overlays.sys.mjs";

/** @type {RenameTabModule.Lazy} */ // @ts-ignore
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  //
  TabmixPlacesUtils: "chrome://tabmix-resource/content/Places.sys.mjs"
});

/** @type {RenameTabModule.RenameTab} */
export const RenameTab = {
  // @ts-expect-error - we initialize it later
  window: null,
  // @ts-expect-error - we initialize it later
  panel: undefined,
  // @ts-expect-error - we initialize it later
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

    /** @param {string} title  */
    const prepareDataAndShowPanel = title => {
      this.data.docTitle = title;
      if (!this.data.docTitle)
        this.data.docTitle = this.window?.isBlankPageURL(this.data.url) ?
          this.window.Tabmix.emptyTabTitle : this.data.url;
      this.data.modified = aTab.getAttribute("label-uri") || null;
      if (this.data.modified == this.data.url || this.data.modified == "*")
        this.data.value = aTab.getAttribute("fixed-label") ?? "";
      else
        this.data.value = this.data.docTitle;

      this.showPanel();
    };

    lazy.TabmixPlacesUtils.asyncGetTitleFromBookmark(this.data.url, docTitle ?? "")
        .then(title => prepareDataAndShowPanel(title));
  },

  showPanel: function TMP_renametab_showPanel() {
    var currentPopup = this._element("tabmixRenametab_panel");
    if (currentPopup) {
      if (currentPopup._overlayLoaded) {
        this.panel = currentPopup;
        this._doShowPanel();
      }
      return;
    }

    const popup = this.panel = this.window.document.createXULElement("panel");
    popup._overlayLoaded = false;
    popup.id = "tabmixRenametab_panel";
    // prevent panel initialize. initialize before overlay break it.
    popup.hidden = true;
    this._element("mainPopupSet")?.appendChild(popup);
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

    this.panel.addEventListener("popupshown", this);
    this.panel.addEventListener("popuphidden", this);
    this.panel.addEventListener("command", this);
    this.panel.addEventListener("input", this);

    this._element("tabmixRenametab_doneButton").setAttribute("data-l10n-id", "bookmark-panel-save-button");
    this._element("tabmixRenametab_deleteButton").setAttribute("label", TabmixSvc.getDialogStrings("Cancel")[0] ?? "");

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
    if (this.window.Tabmix.tabsUtils.isElementVisible(this.data.tab)) {
      popup.openPopup(this.data.tab, "bottomcenter topleft");
    } else {
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
    this._element("tabmixRenametab_titleField").setAttribute("value", this.data.value);
    this._element("tabmixRenametab_defaultField").setAttribute("value", this.data.docTitle);
    this.window.Tabmix.setItem(popup, "modified", this.data.modified);
    var permanently = this._element("tabmixRenametab_checkbox");
    if (this.data.modified)
      permanently.checked = this.data.modified == "*";

    this.data.permanently = permanently?.checked ?? false;
  },

  resetTitle() {
    this.data.value = this.data.docTitle;
    this.update(true);
  },

  update(aReset) {
    var data = this.data;
    var tab = data.tab;
    var label = data.value;
    var resetDefault = aReset || label == data.docTitle && !data.permanently;
    var url = resetDefault ? null : data.permanently ? "*" : data.url;

    var win = this.window;
    win.Tabmix.setItem(tab, "fixed-label", resetDefault ? null : label);
    win.Tabmix.setItem(tab, "label-uri", url);
    TabmixSvc.setCustomTabValue(tab, "fixed-label", resetDefault ? null : label);
    TabmixSvc.setCustomTabValue(tab, "label-uri", url);

    if (tab.label != label) {
      delete tab._labelIsInitialTitle;
      win.gBrowser.setTabTitle(tab);
    }

    this.hidePopup();
  },

  handleEvent(event) {
    switch (event.type) {
      case "command":
        this.handleCommand(event);
        break;
      case "input":
        this.onNewTitle(event.target.value);
        break;
      case "keypress":
        if (event.keyCode === event.DOM_VK_RETURN &&
            event.target.localName !== "button") {
          this.update();
        }
        break;
      case "popupshown":
        this.onpopupshown(event);
        break;
      case "popuphidden":
        this.onpopuphidden(event);
        break;
    }
  },

  handleCommand(event) {
    switch (event.target.id) {
      case "tabmixRenametab_resetButton":
        this.resetTitle();
        break;
      case "tabmixRenametab_checkbox":
        this.data.permanently = event.target.checked;
        break;
      case "tabmixRenametab_doneButton":
        this.update();
        break;
      case "tabmixRenametab_deleteButton":
        this.hidePopup();
        break;
    }
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
      // @ts-expect-error - reset panel
      this.window = null;
      // @ts-expect-error - reset panel
      this.panel = null;
      // @ts-expect-error - reset panel
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
