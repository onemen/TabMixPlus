/* exported gMenuPane */
"use strict";

/** @type {MenuPane} */
var gMenuPane = {
  init() {
    MozXULElement.insertFTLIfNeeded("browser/browser.ftl");
    MozXULElement.insertFTLIfNeeded("browser/menubar.ftl");
    MozXULElement.insertFTLIfNeeded("browser/tabContextMenu.ftl");
    MozXULElement.insertFTLIfNeeded("browser/preferences/preferences.ftl");
    MozXULElement.insertFTLIfNeeded("browser/tabbrowser.ftl");

    if (TabmixSvc.isZen) {
      MozXULElement.insertFTLIfNeeded("browser/zen-general.ftl");
      MozXULElement.insertFTLIfNeeded("browser/zen-split-view.ftl");
    }

    Tabmix.setFTLDataId("paneMenu");

    $("clearClosedTabs").setAttribute("label", TabmixSvc.getString("undoclosetab.clear.label"));

    if (Tabmix.isVersion(1340) && !Tabmix.isVersion(1400)) {
      MozXULElement.insertFTLIfNeeded("preview/tabUnload.ftl");
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

    $("tabContextMenu_menuOrder").querySelector("[data-build-in]").label =
      `${Services.appinfo.name} build-in order`;

    this.generateTabContextMenuItems();

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

  /** Generates tab context menu items from hardcoded lists */
  generateTabContextMenuItems() {
    // Get the column containers
    const columns = ["1", "2", "3"].map(i => {
      const column = document.getElementById(`column-${i}`);
      column.innerHTML = "";
      return column;
    });

    // Get browser window and tab context menu
    const browserWindow = Tabmix.getTopWin();
    if (!browserWindow) {
      console.error("Tabmix Error: Could not get browser window");
      return;
    }

    const tabContextMenu = browserWindow.document.getElementById("tabContextMenu");
    if (!tabContextMenu) {
      console.error("Tabmix Error: Could not find tabContextMenu");
      return;
    }

    const {TabmixContext, TabContextMenu} = browserWindow;

    // make sure original order is saved
    if (!TabmixContext._originalOrderSaved) {
      TabContextMenu.updateContextMenu(tabContextMenu);
      TabmixContext._saveOriginalMenuOrder();
      TabmixContext.updateMenuOrder();
    }

    // Import the menu ID list and selectors
    const {TabContextConfig} = ChromeUtils.importESModule(
      "chrome://tabmix-resource/content/TabContextConfig.sys.mjs"
    );
    const prefList = TabContextConfig.prefList;

    /** @type {Element[]} */
    const itemsWithOutIds = [];
    for (const [id, selector] of Object.entries(TabContextConfig.selectors)) {
      const item = tabContextMenu.querySelector(selector);
      if (item) {
        item.setAttribute("data-selector-id", id);
        itemsWithOutIds.push(item);
      }
    }

    // Get all menu items from the tab context menu
    const allItems = Array.from(tabContextMenu.children);

    const preferences = $("paneMenu").querySelector("preferences");

    // Filter items that are in our predefined lists
    // Direct ID match or match by selector
    const filteredItems = allItems.filter(
      item => prefList[item.id] || itemsWithOutIds.includes(item)
    );

    // Calculate items per column based on filtered items
    const itemsPerColumn = Math.ceil(filteredItems.length / 3);

    // Create checkboxes for each item in menu order
    filteredItems.forEach((menuItem, index) => {
      // Get the ID (either direct or from selector match)
      let id = menuItem.id || menuItem.getAttribute("data-selector-id");
      if (!id) {
        console.log("Tabmix Error: Missing id for tab context menu item", menuItem);
        return;
      }

      const checkbox = document.createXULElement("checkbox");
      checkbox.id = id;

      // Get label and label data from menu item, replace any numeric values
      // with 1 using regex to avoid plural forms of menu items
      checkbox.setAttribute("label", menuItem.label ?? "__MISSING__LABEL__:" + id);
      const args = menuItem.getAttribute("data-l10n-args");
      if (args) {
        const normalizedArgs = args.replace(/":\s*(\d+)/g, '": 1');
        checkbox.setAttribute("data-l10n-args", normalizedArgs);
      }
      const l10nId =
        menuItem.getAttribute("data-l10n-id") || menuItem.getAttribute("data-lazy-l10n-id");
      if (l10nId) {
        checkbox.setAttribute("data-l10n-id", l10nId);
      }

      // Determine if this is a Tabmix item
      if (id.startsWith("tm-") || menuItem.hasAttribute("tabmix")) {
        checkbox.setAttribute("data-source", "tabmix");
      }

      // Add to appropriate column
      columns[Math.floor(index / itemsPerColumn)]?.appendChild(checkbox);

      // Add preference and connect it to checkbox
      const prefKey = id.replace(/^context_|^tm-/, "");
      const prefId = `pref_${prefKey}`;
      checkbox.setAttribute("preference", prefId);
      const preference = document.createXULElement("preference");
      preference.id = prefId;
      const prefname = `extensions.tabmix.${prefList[id]?.[0] || prefKey}`;
      preference.setAttribute("name", prefname);
      preference.setAttribute("type", "bool");
      preferences.appendChild(preference);
    });

    this.handleSpecialLabels(browserWindow);

    const container = document.getElementById("tab-context-menu-container");
    container._columns = columns;
    container._itemsPerColumn = itemsPerColumn;
  },

  /** Handle special cases for menu item labels */
  handleSpecialLabels(browserWindow) {
    // Fix new tab label
    document.l10n?.setAttributes($("context_openANewTab"), "menu-file-new-tab");

    // Fix reload tab every label
    const reloadTabEvery = browserWindow.document.querySelector("#tm-autoreloadTab_menu");
    const label = reloadTabEvery?.getAttribute("labelTab") || "Reload Tab Every";
    $("tm-autoreloadTab_menu")?.setAttribute("label", label);

    // Fix mute/unmute tab label
    const muted = $("context_toggleMuteTab");
    const unmuted = document.createXULElement("checkbox");
    muted.parentNode?.insertBefore(unmuted, muted);
    unmuted.hidden = true;
    document.l10n?.setAttributes(muted, "tabbrowser-context-mute-tab");
    document.l10n?.setAttributes(unmuted, "tabbrowser-context-unmute-tab");
    document.l10n?.translateElements([muted, unmuted]).then(() => {
      muted.removeAttribute("data-l10n-id");
      muted.label += "/" + unmuted.label;
      unmuted.remove();
    });

    // join pin/unpin tab
    const pinTab = $("context_pinTab");
    const unpinTab = browserWindow.document.getElementById("context_unpinTab");
    document.l10n?.translateElements([pinTab, unpinTab]).then(() => {
      pinTab.removeAttribute("data-l10n-id");
      pinTab.label += "/" + unpinTab.label;
      $("togglePinTab").label = pinTab.label;
    });

    const [showBmkTab, showBmkTabs] = [$("context_bookmarkAllTabs"), $("context_bookmarkTab")];
    document.l10n?.translateElements([showBmkTab, showBmkTabs]).then(() => {
      showBmkTab.label = showBmkTab.label.replace("…", "");
      showBmkTabs.label = showBmkTabs.label.replace("…", "");
    });

    // Zen items
    if (TabmixSvc.isZen) {
      const splitTabs = $("context_zenSplitTabs");
      splitTabs.removeAttribute("data-l10n-args");
      document.l10n?.translateElements([splitTabs]).then(() => {
        splitTabs.removeAttribute("data-l10n-id");
        splitTabs.label = splitTabs.label.replace(" {$tabCount} ", " ");
      });
    }
  },

  /** Sorts menu items based on the current menu order preference */
  sortMenuItems() {
    const browserWindow = Tabmix.getTopWin();
    const tabContextMenu = browserWindow?.document.getElementById("tabContextMenu");
    if (!tabContextMenu) {
      return;
    }

    const container = document.getElementById("tab-context-menu-container");
    const itemsPerColumn = container._itemsPerColumn;
    const allItems = Array.from(tabContextMenu.children);
    let index = 0;
    allItems.forEach(menuItem => {
      if (menuItem.tagName === "menuseparator") return;
      const id = menuItem.id || menuItem.getAttribute("data-selector-id");
      const checkbox = id ? document.getElementById(id) : null;
      if (checkbox) {
        container._columns[Math.floor(index / itemsPerColumn)]?.appendChild(checkbox);
        index++;
      }
    });
  },
};
