/* eslint-disable mozilla/balanced-listeners */
import {isVersion} from "chrome://tabmix-resource/content/BrowserVersion.sys.mjs";

/** @type {TabmixWidgetsModule.Lazy} */ // @ts-ignore
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  CustomizableUI:
    isVersion(1430) ?
      "moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs"
    : "resource:///modules/CustomizableUI.sys.mjs",
});

const OPTIONS_WIDGET_ID = "tabmix-closedTabs-toolbaritem";
const TABMIX_UUID = "{dc572301-7619-498c-a57d-39143191b318}";

/** @type {typeof TabmixWidgetsModule.onBuild} */
function buildOptionsWidget(node, document) {
  const extension = {
    id: `${TABMIX_UUID}`,
    name: "Tab Mix Plus",
    tabManager: {
      addActiveTabPermission: () => true,
      activateScripts: (/** @type {Tab} */ tab) => {
        tab.ownerGlobal.Tabmix.openOptionsDialog();
      },
    },
  };

  /**
   * @typedef {HTMLElement & {
   *   _actionButton: HTMLElement;
   *   render(): void;
   *   setExtension(extension: object): void;
   * }} UnifiedExtensionsItem
   */

  /** @type {UnifiedExtensionsItem} */ // @ts-expect-error - custom element
  const item = document.createElement("unified-extensions-item");
  item.setExtension(extension);

  node.appendChild(item);

  node.ownerGlobal.setTimeout(() => {
    /** @type {UnifiedExtensionsItem} */ // @ts-expect-error - custom element: unified-extensions-item
    const container = node.firstChild;

    // Override the render method of THIS SPECIFIC instance
    const originalRender = container.render;
    container.render = function (...args) {
      // Run the original render logic first
      originalRender.apply(this, args);

      // Now it's guaranteed that _actionButton exists
      this._actionButton.disabled = false;

      [
        ".unified-extensions-item-message-default",
        ".unified-extensions-item-message-hover",
      ].forEach(selector => {
        const label = this.querySelector(selector);
        if (label) {
          label.removeAttribute("data-l10n-id");
          label.textContent = "Click to open Options";
        }
      });
    };

    // If it has already rendered, trigger it now
    if (container.isConnected) {
      container.render();
    }

    // many search in firefox that look for this class need the parent from here
    container.classList.remove("unified-extensions-item");

    // render set src asynchronously
    const image = document.querySelector(`[data-extensionid="${TABMIX_UUID}"] > image`);
    if (image) {
      image.setAttribute("src", "chrome://tabmixplus/skin/tmp.png");
    }
  }, 0);
}

const widgets = {
  optionsWidget: {
    id: `_${OPTIONS_WIDGET_ID}_-browser-action`,
    localizeFiles: [],

    get markup() {
      return `
  <toolbaritem
    class="toolbaritem-combined-buttons unified-extensions-item chromeclass-toolbar-additional"
    view-button-id="_${OPTIONS_WIDGET_ID}_-BAP"
    data-extensionid="${TABMIX_UUID}"
    id="_${OPTIONS_WIDGET_ID}_-browser-action"
    widget-id="_${OPTIONS_WIDGET_ID}_-browser-action"
    widget-type="custom"
    removable="true"
    overflows="true"
    label="Tab Mix Plus"
    tooltiptext="Tab Mix Plus"
    cui-areatype="toolbar"
  >
  </toolbaritem>`;
    },
    /** @type {typeof TabmixWidgetsModule.onBuild} */
    onBuild(node, document) {
      const placement = lazy.CustomizableUI.getPlacementOfWidget(node.id);
      if (
        placement?.area === lazy.CustomizableUI.AREA_NAVBAR &&
        document.readyState !== "complete"
      ) {
        node.ownerGlobal.addEventListener(
          "DOMContentLoaded",
          () => buildOptionsWidget(node, document),
          {once: true}
        );
      } else {
        node.ownerGlobal.requestAnimationFrame(() => buildOptionsWidget(node, document));
      }
    },
  },
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
          observes="tmp_undocloseButton"/>
        <toolbarbutton id="tabmix-closedTabs-dropmarker"
          class="toolbarbutton-1 toolbarbutton-combined-buttons-dropmarker"
          tooltiptext="&closedtabsbtn.tooltip;"
          observes="tmp_undocloseButton"/>
      </toolbaritem>`;
    },

    /** @typedef {TabmixGlobals.ButtonEvent} ButtonEvent */
    /** @typedef {TabmixGlobals.PopupEvent} PopupEvent */
    /** @typedef {TabmixWidgetsModule.TabDragEvent} TabDragEvent */
    /** @type {typeof TabmixWidgetsModule.onBuild} */
    onBuild(node) {
      const [button, dropmarker] = node.children;
      button.addEventListener("command", (/** @type {ButtonEvent} */ event) => {
        node.ownerGlobal.TMP_ClosedTabs.handleButtonEvent(event);
      });
      button.addEventListener("click", (/** @type {ButtonEvent} */ event) => {
        node.ownerGlobal.TMP_ClosedTabs.handleButtonEvent(event);
      });
      button.addEventListener("mousedown", (/** @type {PopupEvent} */ event) => {
        node.ownerGlobal.TabmixAllTabs.checkForCtrlClick(event);
      });
      button.addEventListener("mouseup", event => {
        if (event.target == button) {
          node.ownerGlobal.setTimeout(() => button.removeAttribute("afterctrlclick"), 0);
        }
      });
      button.addEventListener("dragover", (/** @type {TabDragEvent} */ event) => {
        node.ownerGlobal.TMP_undocloseTabButtonObserver.onDragOver(event);
      });
      button.addEventListener("dragenter", (/** @type {TabDragEvent} */ event) => {
        node.ownerGlobal.TMP_undocloseTabButtonObserver.onDragOver(event);
      });
      button.addEventListener("drop", (/** @type {TabDragEvent} */ event) => {
        node.ownerGlobal.TMP_undocloseTabButtonObserver.onDrop(event);
      });
      button.addEventListener("dragleave", (/** @type {TabDragEvent} */ event) => {
        node.ownerGlobal.TMP_undocloseTabButtonObserver.onDragExit(event);
      });
      dropmarker.addEventListener("command", (/** @type {ButtonEvent} */ event) => {
        node.ownerGlobal.Tabmix.closedObjectsUtils.showSubView(event);
      });
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
          label="&closedwindowsbtn.label;"/>
      </toolbaritem>`;
    },

    /** @type {typeof TabmixWidgetsModule.onBuild} */
    onBuild(node) {
      node.firstChild.addEventListener("command", (/** @type {ButtonEvent} */ event) => {
        node.ownerGlobal.Tabmix.closedObjectsUtils.showSubView(event);
      });
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
        data-l10n-id="tabs-toolbar-list-all-tabs"/>
      </toolbaritem>`;
    },

    /** @type {typeof TabmixWidgetsModule.onBuild} */
    onBuild(node) {
      node.firstChild.addEventListener(
        "command",
        (/** @type {GenericEvent<HTMLElement, Event>} */ event) => {
          node.ownerGlobal.Tabmix.allTabs.showAllTabsPanel(event);
        }
      );
    },
  },
  tabsCloseButton: {
    id: "tabmix-tabs-closebutton",
    localizeFiles: [],
    get updateMarkup() {
      const l10nId =
        isVersion(1310) ? "tabbrowser-close-tabs-button" : "tabbrowser-close-tabs-tooltip";
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

    /** @type {typeof TabmixWidgetsModule.onBuild} */
    onBuild(node, document) {
      document?.l10n?.translateElements([node]).then(() => {
        node.removeAttribute("data-l10n-id");
        node.removeAttribute("data-l10n-args");
        if (node.hasAttribute("label")) {
          node.setAttribute("tooltiptext", node.getAttribute("label") ?? "");
        } else if (node.hasAttribute("tooltiptext")) {
          node.setAttribute("label", node.getAttribute("tooltiptext") ?? "");
        }
      });
    },
  },
};

/** @param {TabmixWidgetsModule.Widget} widget */
function on_build(widget) {
  const {markup, updateMarkup, localizeFiles, onBuild} = widget;
  return function (/** @type {Document & {ownerGlobal: Window}} */ document) {
    const MozXULElement = document.ownerGlobal.MozXULElement;
    const node = MozXULElement.parseXULToFragment(updateMarkup ?? markup, localizeFiles);
    const parent = document.createXULElement("box");
    parent.appendChild(node);

    /** @type {TabmixWidgetsModule.WidgetElement} */ // @ts-ignore
    const child = parent.childNodes[0];
    if (onBuild) {
      onBuild(child, document);
    }
    return child;
  };
}

/** @param {TabmixWidgetsModule.Widget} widget */
function createWidget(widget) {
  try {
    lazy.CustomizableUI.createWidget({
      id: widget.id,
      type: "custom",
      localized: false,
      onBuild: on_build(widget),
    });
  } catch (error) {
    console.log("Tabmix Error:\nCustomizableUI.createWidget failed for", widget.id, error);
  }
}

/** @type {TabmixWidgetsModule.TabmixWidgets} */
export const TabmixWidgets = {
  create() {
    try {
      lazy.CustomizableUI.beginBatchUpdate();
      Object.values(widgets).forEach(w => createWidget(w));
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
