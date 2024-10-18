"use strict";

/* eslint curly: 2 */
const EXPORTED_SYMBOLS = ["TabmixWidgets"];

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  //
  CustomizableUI: "resource:///modules/CustomizableUI.sys.mjs",
});

ChromeUtils.defineModuleGetter(lazy, "isVersion",
  "chrome://tabmix-resource/content/BrowserVersion.jsm");

const widgets = {
  closedTabs: {
    id: "tabmix-closedTabs-toolbaritem",
    localizeFiles: ["chrome://tabmixplus/locale/tabmix.dtd"],
    get markup() {
      return `
      <toolbaritem id="${this.id}"
          class="toolbaritem-combined-buttons chromeclass-toolbar-additional"
          label="&closedtabsbtn.label;"
          tooltiptext="&closedtabsbtn.tooltip;"
          _tooltiptext="&reopenlastclosedtab.tooltip;"
          badged="true"
          removable="true"
          widget-id="${this.id}"
          widget-type="button-and-view">
        <toolbarbutton id="tabmix-closedTabsButton"
          class="toolbarbutton-1 subviewbutton-nav"
          label="&closedtabsbtn.label;"
          observes="tmp_undocloseButton"
          oncommand="TMP_ClosedTabs.handleButtonEvent(event);"
          onclick="TMP_ClosedTabs.handleButtonEvent(event);"
          onmousedown="TabmixAllTabs.checkForCtrlClick(event);"
          onmouseup="if (event.target == this) setTimeout(function(b) {b.removeAttribute('afterctrlclick')}, 0, this);"
          ondragover="TMP_undocloseTabButtonObserver.onDragOver(event);"
          ondragenter="TMP_undocloseTabButtonObserver.onDragOver(event);"
          ondrop="TMP_undocloseTabButtonObserver.onDrop(event);"
          ondragexit="TMP_undocloseTabButtonObserver.onDragExit(event);">
        </toolbarbutton>
        <toolbarbutton id="tabmix-closedTabs-dropmarker"
          class="toolbarbutton-1 toolbarbutton-combined-buttons-dropmarker"
          tooltiptext="&closedtabsbtn.tooltip;"
          observes="tmp_undocloseButton"
          oncommand="Tabmix.closedObjectsUtils.showSubView(event)"/>
      </toolbaritem>`;
    },
  },
  closedWindows: {
    id: "tabmix-closedWindows-toolbaritem",
    localizeFiles: ["chrome://tabmixplus/locale/tabmix.dtd"],
    get markup() {
      return `
      <toolbaritem id="${this.id}"
          class="toolbaritem-combined-buttons chromeclass-toolbar-additional"
          label="&closedwindowsbtn.label;"
          tooltiptext="&closedwindowsbtn.tooltip;"
          badged="true"
          removable="true"
          widget-id="${this.id}"
          widget-type="button-and-view">
        <toolbarbutton id="tabmix-closedWindowsButton"
          class="toolbarbutton-1 subviewbutton-nav"
          observes="tmp_closedwindows"
          oncommand="Tabmix.closedObjectsUtils.showSubView(event)"
          label="&closedwindowsbtn.label;"/>
      </toolbaritem>`;
    },
  },
  alltabs: {
    id: "tabmix-alltabs-toolbaritem",
    localizeFiles: [],
    get markup() {
      return `
      <toolbaritem id="${this.id}"
        class="toolbaritem-combined-buttons chromeclass-toolbar-additional"
        data-l10n-id="tabs-toolbar-list-all-tabs"
        badged="true"
        removable="true"
        widget-id="${this.id}"
        widget-type="button-and-view">
      <toolbarbutton id="tabmix-alltabs-button"
        class="toolbarbutton-1 subviewbutton-nav tabs-alltabs-button"
        data-l10n-id="tabs-toolbar-list-all-tabs"
        oncommand="Tabmix.allTabs.showAllTabsPanel(event);"/>
      </toolbaritem>`;
    },
  },
  tabsCloseButton: {
    id: "tabmix-tabs-closebutton",
    localizeFiles: [],
    get updateMarkup() {
      const l10nId = lazy.isVersion(1310) ?
        "tabbrowser-close-tabs-button" :
        "tabbrowser-close-tabs-tooltip";
      const markup = this.markup.replace('command="cmd_close"', `$& data-l10n-id="${l10nId}"`);
      return markup;
    },
    get markup() {
      return `
      <toolbarbutton id="tabmix-tabs-closebutton"
        data-l10n-args='{"tabCount": 1}'
        class="close-icon toolbarbutton-1 chromeclass-toolbar-additional"
        command="cmd_close"
        cui-areatype="toolbar"
        removable="false"/>`;
    },
    onBuild(document, node) {
      document.l10n?.translateElements([node]).then(() => {
        node.removeAttribute("data-l10n-id");
        node.removeAttribute("data-l10n-args");
        if (node.hasAttribute("label")) {
          node.setAttribute("tooltiptext", node.getAttribute("label"));
        } else if (node.hasAttribute("tooltiptext")) {
          node.setAttribute("label", node.getAttribute("tooltiptext"));
        }
      });
    },
  },
};

function on_build(widget) {
  const {markup, updateMarkup, localizeFiles, onBuild} = widget;
  return function(document) {
    const MozXULElement = document.ownerGlobal.MozXULElement;
    const node = MozXULElement.parseXULToFragment(updateMarkup ?? markup, localizeFiles);
    const parent = document.createXULElement("box");
    parent.appendChild(node);
    const child = parent.childNodes[0];
    if (onBuild) {
      onBuild(document, child);
    }
    return child;
  };
}

function createWidget(widget) {
  try {
    lazy.CustomizableUI.createWidget({
      id: widget.id,
      type: "custom",
      localized: false,
      onBuild: on_build(widget)
    });
  } catch (error) {
    console.log("Tabmix Error:\nCustomizableUI.createWidget failed for", widget.id, error);
  }
}

const TabmixWidgets = {
  create() {
    try {
      lazy.CustomizableUI.beginBatchUpdate();
      Object.values(widgets).forEach(createWidget);
    } finally {
      lazy.CustomizableUI.endBatchUpdate();
    }
  },

  destroy(uninstall) {
    try {
      lazy.CustomizableUI.beginBatchUpdate();
      Object.values(widgets).forEach(widget => {
        lazy.CustomizableUI.destroyWidget(widget.id);
        if (uninstall) {
          lazy.CustomizableUI.removeWidgetFromArea(widget.id);
        }
      });
    } finally {
      lazy.CustomizableUI.endBatchUpdate();
    }
  },
};
