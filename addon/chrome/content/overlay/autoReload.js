/* global gNumberInput */
/* exported load, accept, onInput, onSelect, openPopup */
"use strict";

const {TabmixSvc} = ChromeUtils.import("chrome://tabmix-resource/content/TabmixSvc.jsm");

const gPref = TabmixSvc.prefBranch;

function load() {
  document.documentElement.addEventListener("dialogaccept", accept.bind(null));
  const customReloadTime = gPref.getIntPref("reload_time");
  document.getElementById("autoreload_minutes").value = String(Math.floor(customReloadTime / 60));
  document.getElementById("autoreload_seconds").value = String(customReloadTime % 60);
  updateOkButtonDisabledState();

  gNumberInput.init();
  gNumberInput.inputExpr = gNumberInput.changeExpr = e => {
    const target = e.target;
    const outRange = target.validity.rangeOverflow || target.validity.rangeUnderflow;
    if (outRange) target.oninput(e);// call default input logic
    return !target.validity.valid && !outRange;
  };

  // Apply our styles to the shadow dom buttons
  const linkElem = document.createElement("link");
  linkElem.setAttribute("rel", "stylesheet");
  linkElem.setAttribute("href", "chrome://tabmixplus/skin/preferences.css");
  const dialog = document.getElementById("reloadevery_custom_dialog");
  dialog.shadowRoot.appendChild(linkElem);
}

function accept() {
  const customReloadTime = getCustomReloadTime();
  gPref.setIntPref("reload_time", customReloadTime);
  let listPrefValue = gPref.getCharPref("custom_reload_list");
  const list = listPrefValue?.split(",").map(Number) ?? [];
  let defaultList = [60, 120, 300, 900, 1800];
  if (!list.concat(defaultList).includes(customReloadTime)) {
    list.push(customReloadTime);
    if (list.length > 6)
      list.shift();
    gPref.setCharPref("custom_reload_list", list.join(","));
  }

  window.arguments[0].ok = true;
}

function getCustomReloadTime() {
  let minutes;
  if (document.getElementById("autoreload_minutes").value !== '')
    minutes = parseInt(String(document.getElementById("autoreload_minutes").value));
  else
    minutes = 0;

  let seconds;
  if (document.getElementById("autoreload_seconds").value !== '')
    seconds = parseInt(String(document.getElementById("autoreload_seconds").value));
  else
    seconds = 0;
  return minutes * 60 + seconds;
}

function updateOkButtonDisabledState() {
  document.documentElement.getButton("accept").disabled = getCustomReloadTime() === 0;
}

/** @type {Globals.oninput} */
function onInput(item) {
  item.value = parseInt(item.value.toString());
  if (item.value.toString() === 'NaN') {
    item.value = '';
  }
  let val = Number(item.value);
  if (val < 0)
    item.value = -item.value;
  if (item.id == "autoreload_seconds" && val > 59)
    item.value = 59;

  updateOkButtonDisabledState();
}

/** @type {Globals.onSelect} */
function onSelect(event) {
  const item = event.target;
  const input = item.closest(".combined-element").firstChild;
  input.value = item.value;
  input.focus();
  updateOkButtonDisabledState();
}

/** @type {Globals.openPopup} */
function openPopup(button) {
  const popup = button.nextElementSibling;
  if (popup.state !== "closed") {
    popup.hidePopup();
  } else {
    popup.openPopup(button.closest(".container"), "after_start", 0, -1);
  }
}
