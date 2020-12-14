/* globals AddonManager gViewController */
"use strict";

// function openTabmixOptionsDialog() {
//   const browserWin = window.QueryInterface(Ci.nsIInterfaceRequestor)
//       .getInterface(Ci.nsIWebNavigation)
//       .QueryInterface(Ci.nsIDocShellTreeItem)
//       .rootTreeItem
//       .QueryInterface(Ci.nsIInterfaceRequestor)
//       .getInterface(Ci.nsIDOMWindow);

//   try {
//     browserWin.Tabmix.openOptionsDialog(-1);
//   } catch (ex) { }
// }

// update gViewController.commands.cmd_showItemPreferences to open Tabmix
// options in dialog window
function updateShowItemPreferences() {
  const id = "{dc572301-7619-498c-a57d-39143191b318}";
//   const tabmixItem = document.documentElement.querySelector(`richlistitem[value="${id}"]`);
//   if (tabmixItem) {
//     tabmixItem._preferencesBtn.hidden = false;
//     const descriptor = {enumerable: true, configurable: true, get: () => AddonManager.OPTIONS_TYPE_TAB};
//     Object.defineProperty(tabmixItem.mAddon, 'optionsType', descriptor);
//     const command = gViewController.commands.cmd_showItemPreferences;
//     if (!command.tabmix_saved_originalDoCommand) {
//       command.tabmix_saved_originalDoCommand = command.doCommand;
//       command.doCommand = function(aAddon) {
//         if (aAddon.id == id) {
//           openTabmixOptionsDialog();
//         } else {
//           command.tabmix_saved_originalDoCommand.apply(this, arguments);
//         }
//       };
//     }
//   }
  const tabmixItem = getHtmlBrowser().contentDocument.querySelector(`addon-card[addon-id="${id}"]`)
  if (tabmixItem) {
     tabmixItem.querySelector(`panel-item[action="preferences"]`)
      .button.addEventListener("click",(event)=>{
       event.stopPropagation(); 
       try {windowRoot.ownerGlobal.Tabmix.openOptionsDialog(-1)}
       catch (ex) { }
      }
   );
  }
  // const addonOptionsItem = getHtmlBrowser().contentDocument.querySelector(`template[name="addon-options"]`).content.querySelector(`[action="preferences"]`);
  // addonOptionsItem.setAttribute("onclick",
  // `if(this.parentElement.parentElement.parentElement.parentElement.attributes["addon-id"].value == "${id}") 
  //    {event.stopPropagation(); 
  //    try {windowRoot.ownerGlobal.Tabmix.openOptionsDialog(-1)}
  //    catch (ex) { }}`
  // );
}

window.addEventListener("load", () => {
  try {
    updateShowItemPreferences();
  } catch (ex) {
    Cu.reportError(ex);
  }
}, {once: true});

// window.addEventListener("popstate", () => setTimeout(
//   () => {
//     try {
//       updateShowItemPreferences();
//     } catch (ex) {
//       Cu.reportError(ex);
//     }
//   }, 0)
// );

const id = "{dc572301-7619-498c-a57d-39143191b318}";
const targetNode = getHtmlBrowser().contentDocument.getElementById('content');
const config = { childList: true, subtree: true };
const callback = function(mutationList, observer) {
  for(const mutation of mutationList) {
      if (mutation.type === 'childList') {
        if (mutation?.addedNodes[0]?.nodeName == "DIV") if (mutation?.addedNodes[0]?.querySelector(`addon-card[addon-id="${id}"]`)) try {
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