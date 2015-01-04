"use strict";

var gPref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

function load(){
  var customReloadTime = gPref.getIntPref("extensions.tabmix.reload_time");
  document.getElementById("autoreload_minutes").value = Math.floor(customReloadTime / 60);
  document.getElementById("autoreload_seconds").value = customReloadTime % 60;
  disable_OK();
}

function accept() {
  var customReloadTime = getCustomReloadTime();
  gPref.setIntPref("extensions.tabmix.reload_time", customReloadTime);
  var list = gPref.getCharPref("extensions.tabmix.custom_reload_list");
  list = list ? list.split(",") : [];
  let defaultList = [60,120,300,900,1800];
  if (list.concat(defaultList).indexOf(customReloadTime) == -1) {
    list.push(customReloadTime);
    if (list.length > 6 )
      list.shift();
    gPref.setCharPref("extensions.tabmix.custom_reload_list", list.join(","));
  }

  window.arguments[0].ok = true;
}

function getCustomReloadTime() {
  var minutes;
  if (document.getElementById("autoreload_minutes").value !== '')
    minutes = parseInt(document.getElementById("autoreload_minutes").value);
  else
    minutes = 0;

  var seconds;
  if (document.getElementById("autoreload_seconds").value !== '')
    seconds = parseInt(document.getElementById("autoreload_seconds").value);
  else
    seconds = 0;
  return minutes*60 + seconds;
}

function disable_OK() {
  document.documentElement.getButton("accept").disabled = getCustomReloadTime() === 0;
}

function onInput(item) {
  item.value = parseInt(item.value);
  if (item.value == 'NaN')
    item.value = '';
  let val = Number(item.value);
  if (val < 0)
    item.value = -item.value;
  if (item.id == "autoreload_seconds" && val > 59)
    item.value = 59;

  disable_OK();
}
