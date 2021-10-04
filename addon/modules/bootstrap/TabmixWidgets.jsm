"use strict";

/* eslint curly: 2 */
this.EXPORTED_SYMBOLS = ["TabmixWidgets"];

ChromeUtils.defineModuleGetter(this, "CustomizableUI",
  "resource:///modules/CustomizableUI.jsm");

ChromeUtils.defineModuleGetter(this, "TabmixSvc",
  "chrome://tabmix-resource/content/TabmixSvc.jsm");

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
    localizeFiles: ["chrome://browser/locale/browser.dtd"],
    get updateMarkup() {
      if (!TabmixSvc.version(940)) {
        const label = 'label="&listAllTabs.label;" tooltiptext="&listAllTabs.label;"';
        return this.markup.replace(/data-l10n-id=[^\n]*/g, label);
      }
      return this.markup;
    },
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
};

function on_build(widget) {
  const {markup, updateMarkup, localizeFiles} = widget;
  return function(document) {
    const MozXULElement = document.ownerGlobal.MozXULElement;
    const node = MozXULElement.parseXULToFragment(updateMarkup ?? markup, localizeFiles);
    const parent = document.createXULElement("box");
    parent.appendChild(node);
    return parent.childNodes[0];
  };
}

function createWidget(widget) {
  try {
    CustomizableUI.createWidget({
      id: widget.id,
      type: "custom",
      localized: false,
      onBuild: on_build(widget)
    });
  } catch (error) {
    console.log("Tabmix Error:\nCustomizableUI.createWidget failed for", widget.id, error);
  }
}

this.TabmixWidgets = {
  create() {
    try {
      CustomizableUI.beginBatchUpdate();
      Object.values(widgets).forEach(createWidget);
    } finally {
      CustomizableUI.endBatchUpdate();
    }
  },

  destroy(uninstall) {
    try {
      CustomizableUI.beginBatchUpdate();
      Object.values(widgets).forEach(widget => {
        CustomizableUI.destroyWidget(widget.id);
        if (uninstall) {
          CustomizableUI.removeWidgetFromArea(widget.id);
        }
      });
    } finally {
      CustomizableUI.endBatchUpdate();
    }
  },
};
