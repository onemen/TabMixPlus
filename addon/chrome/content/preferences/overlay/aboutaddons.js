/* globals AddonManager gViewController */
"use strict";

function openTabmixOptionsDialog() {
  const browserWin = window.QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIWebNavigation)
      .QueryInterface(Ci.nsIDocShellTreeItem)
      .rootTreeItem
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindow);

  try {
    browserWin.Tabmix.openOptionsDialog(-1);
  } catch (ex) { }
}

// update gViewController.commands.cmd_showItemPreferences to open Tabmix
// options in dialog window
function updateShowItemPreferences() {
  const id = "{dc572301-7619-498c-a57d-39143191b318}";
  const tabmixItem = document.documentElement.querySelector(`richlistitem[value="${id}"]`);
  if (tabmixItem) {
    tabmixItem._preferencesBtn.hidden = false;
    const descriptor = {enumerable: true, configurable: true, get: () => AddonManager.OPTIONS_TYPE_TAB};
    Object.defineProperty(tabmixItem.mAddon, 'optionsType', descriptor);
    const command = gViewController.commands.cmd_showItemPreferences;
    if (!command.tabmix_saved_originalDoCommand) {
      command.tabmix_saved_originalDoCommand = command.doCommand;
      command.doCommand = function(aAddon) {
        if (aAddon.id == id) {
          openTabmixOptionsDialog();
        } else {
          command.tabmix_saved_originalDoCommand.apply(this, arguments);
        }
      };
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
