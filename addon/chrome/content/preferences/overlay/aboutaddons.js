/// <reference types="../../../../../@types/aboutaddons.d.ts" />
/* global windowRoot */
"use strict";

const ID = "{dc572301-7619-498c-a57d-39143191b318}";

function updateAddonCard() {
  const htmlBrowser = window.docShell.chromeEventHandler;
  const tabmixItem = htmlBrowser.contentDocument.querySelector(`addon-card[addon-id="${ID}"]`);

  // hide compatibility error message
  const messageBar = tabmixItem?.querySelector(".addon-card-message");
  if (messageBar) {
    const supportedVersion = Services.vc.compare(Services.appinfo.platformVersion, "115.0") >= 0;
    const incompatibleMessage = messageBar?.getAttribute("data-l10n-id")?.includes("incompatible");
    if (incompatibleMessage && supportedVersion) {
      messageBar.remove();
    }
  }

  // update gViewController.commands.cmd_showItemPreferences to open Tabmix
  // options in dialog window.
  const panelItem = tabmixItem?.querySelector(`panel-item[action="preferences"]`);
  if (panelItem) {
    const optionsButton = panelItem.button;
    panelItem.removeAttribute("action");
    panelItem.hidden = false;
    if (!optionsButton._tabmix_command_installed) {
      optionsButton._tabmix_command_installed = true;
      optionsButton.addEventListener("click", event => {
        event.stopPropagation();
        try {
          windowRoot.ownerGlobal.Tabmix.openOptionsDialog();
        } catch (ex) {
          windowRoot.ownerGlobal.Tabmix.reportError(ex);
        }
      });
    }
  }
}

window.addEventListener(
  "load",
  () => {
    try {
      updateAddonCard();
    } catch (ex) {
      console.error(ex);
    }
  },
  {once: true}
);

(function () {
  const htmlBrowser = window.docShell.chromeEventHandler;
  const targetNode = htmlBrowser.contentDocument.getElementById("content");
  const config = {childList: true, subtree: true};
  const callback = function (/** @type {MutationRecord[]} */ mutationList) {
    for (const mutation of mutationList) {
      if (mutation.type === "childList") {
        const node = mutation?.addedNodes[0];
        const isAddonList =
          node?.nodeName == "DIV" ||
          node?.nodeName == "ADDON-LIST" ||
          node?.nodeName == "ADDON-CARD";
        if (
          isAddonList &&
          // @ts-expect-error - it is ok, querySelector exist
          (node.querySelector(`addon-card[addon-id="${ID}"]`) ||
            node.getAttribute("addon-id") == ID)
        ) {
          try {
            updateAddonCard();
            break;
          } catch (ex) {
            console.error(ex);
          }
        }
      }
    }
  };
  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
})();
