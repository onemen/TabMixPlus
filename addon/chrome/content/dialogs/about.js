/* exported init */
"use strict";

function init() {
  var addon = window.arguments[0];
  var extensionsStrings = document.getElementById("extensionsStrings");
  var extensionVersion, currentVersion;
  document.title = extensionsStrings.getFormattedString("aboutWindowTitle", ["Tab Mix Plus"]);
  try {
    currentVersion = addon.version;
    extensionVersion = document.getElementById("extensionVersion");
    extensionVersion.value = extensionsStrings.getFormattedString("aboutWindowVersionString", [currentVersion]);
  } catch (ex) {
    extensionVersion.hidden = true;
  }
  var acceptButton = document.documentElement.getButton("accept");
  acceptButton.label = extensionsStrings.getString("aboutWindowCloseButton");
  var extensionDescription = document.getElementById("extensionDescription");
  extensionDescription.value = addon.description;
}
