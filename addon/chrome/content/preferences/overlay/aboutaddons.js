/* global windowRoot */
"use strict";

const ID = "{dc572301-7619-498c-a57d-39143191b318}";

// update gViewController.commands.cmd_showItemPreferences to open Tabmix
// options in dialog window
function updateShowItemPreferences() {
  const htmlBrowser = typeof getHtmlBrowser === 'function' ?
    window.getHtmlBrowser() : window.docShell.chromeEventHandler;
  const tabmixItem = htmlBrowser.contentDocument
      .querySelector(`addon-card[addon-id="${ID}"]`);
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
          windowRoot.ownerGlobal.Tabmix.openOptionsDialog(-1);
        } catch (ex) {
          windowRoot.ownerGlobal.Tabmix.reportError(ex);
        }
      });
    }
  }
}

window.addEventListener("load", () => {
  try {
    updateShowItemPreferences();
  } catch (ex) {
    Cu.reportError(ex);
  }
}, {once: true});

(function() {
  const htmlBrowser = typeof getHtmlBrowser === 'function' ?
    window.getHtmlBrowser() : window.docShell.chromeEventHandler;
  const targetNode = htmlBrowser.contentDocument.getElementById('content');
  const config = {childList: true, subtree: true};
  const callback = function(mutationList) {
    for (const mutation of mutationList) {
      if (mutation.type === 'childList') {
        const node = mutation?.addedNodes[0];
        const isAddonList = node?.nodeName == "DIV" || node?.nodeName == "ADDON-LIST" || node?.nodeName == "ADDON-CARD";
        if (isAddonList && (node.querySelector(`addon-card[addon-id="${ID}"]`) || node.getAttribute('addon-id') == ID)) {
          try {
            updateShowItemPreferences();
            break;
          } catch (ex) {
            Cu.reportError(ex);
          }
        }
      }
    }
  };
  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
}());
