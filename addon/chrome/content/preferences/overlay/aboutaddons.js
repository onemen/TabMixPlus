"use strict";

const ID = "{dc572301-7619-498c-a57d-39143191b318}";

// update gViewController.commands.cmd_showItemPreferences to open Tabmix
// options in dialog window
function updateShowItemPreferences() {
  const tabmixItem = window.docShell.chromeEventHandler.contentDocument
      .querySelector(`addon-card[addon-id="${ID}"]`);
  if (tabmixItem) {
    const messageBox = tabmixItem.querySelector(".addon-card-message");
    if (messageBox.getAttribute("type") === "warning") {
      messageBox.style.display = "none";
    }
    const optionsButton = tabmixItem.querySelector(`panel-item[action="preferences"]`).button;
    optionsButton.removeAttribute("action");
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

const targetNode = window.docShell.chromeEventHandler.contentDocument
    .getElementById('content');
const config = {childList: true, subtree: true};
const callback = function(mutationList) {
  for (const mutation of mutationList) {
    if (mutation.type === 'childList') {
      if (mutation?.addedNodes[0]?.nodeName == "DIV") if (mutation?.addedNodes[0]?.querySelector(`addon-card[addon-id="${ID}"]`)) try {
        updateShowItemPreferences();
        break;
      } catch (ex) {
        Cu.reportError(ex);
      }
    }
  }
};
const observer = new MutationObserver(callback);
observer.observe(targetNode, config);
