"use strict";

function init() { // jshint ignore:line
  var addon = window.arguments[0];
  var extensionsStrings = document.getElementById("extensionsStrings");
  document.title = extensionsStrings.getFormattedString("aboutWindowTitle", ["Tab Mix Plus"]);
  try {
    var currentVersion = addon.version;
    var extensionVersion = document.getElementById("extensionVersion");
    extensionVersion.value = extensionsStrings.getFormattedString("aboutWindowVersionString", [currentVersion]);
  } catch(ex) {
    extensionVersion.hidden = true;
  }
  var acceptButton = document.documentElement.getButton("accept");
  acceptButton.label = extensionsStrings.getString("aboutWindowCloseButton");
  var extensionDescription = document.getElementById("extensionDescription");
  extensionDescription.value = addon.description;
}
