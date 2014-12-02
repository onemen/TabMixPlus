/**
 * based on keyconfig extension by dorando
 */

"use strict";

///XXX TODO - add black list with shortcut (F1, Ctrl-Tab ....) that don't have DOM key element
function getKeysForShortcut(shortcut, id, win) {
  if (!win)
    win = Services.wm.getMostRecentWindow("navigator:browser");

  let $ = function(id) id && win.document.getElementById(id);
  let isDisabled = function(item) item && item.getAttribute("disabled");

  let ourKey = $(id);
  if (isDisabled(ourKey))
    return null;

  let dots = "…";
  let keys = win.document.getElementsByTagName("key");
  let usedKeys = Array.filter(keys, function(key) {
    if (ourKey == key)
      return false;
    if (isDisabled(key) || isDisabled($(key.getAttribute("command"))))
      return false;
    let _key = {
      modifiers: key.getAttribute("modifiers"),
      key: key.getAttribute("key"),
      keycode: key.getAttribute("keycode")
    };
    if (getFormattedKey(_key) == shortcut)
      return true;
    return false;
  }).map(function(key) "     " + _getKeyName(win, key).replace(dots, ""));

  return usedKeys.join("\n");
}

function _getKeyName(win, aKey) {
  let doc = win.document;
  let command, val;

  // don't use dynamic label for key name
  let skip = ["key_undoCloseTab", "key_undoCloseWindow"];
  if (skip.indexOf(aKey.id) == -1) {
    let fButton = doc.getElementById("titlebar");
    val = fButton && !fButton.hidden && _getLabel(doc.getElementById("appmenu-button"), "key", aKey.id) ||
      _getLabel(doc.getElementById("main-menubar"), "key", aKey.id) ||
      _getLabel(doc.getElementById("mainPopupSet"), "key", aKey.id) ||
      _getLabel(doc, "key", aKey.id);
  }

  if (!val && (aKey.hasAttribute("command") || aKey.hasAttribute("observes"))) {
    command = aKey.getAttribute("command") || aKey.getAttribute("observes");
    let node = doc.getElementById(command);
    if (node && node.hasAttribute("label"))
      return node.getAttribute("label");
    val = _getLabel(doc, "command", command) || _getLabel(doc, "observes", command);
  }

  if (val)
    return val;

  if (aKey.hasAttribute("label"))
    return aKey.getAttribute("label");

  let id = command && command.indexOf(":") > -1 ? command :
           aKey.id.replace(/xxx_key.+?_/, "") || // keyconfig foramt
           command || aKey.getAttribute("oncommand");
  let gUnicodeConverter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
          .createInstance(Ci.nsIScriptableUnicodeConverter);
  gUnicodeConverter.charset = "UTF-8";
  try {
    id = gUnicodeConverter.ConvertToUnicode(id);
  } catch(ex) { }

  let keyname = {
    action: Services.prefs.getIntPref("browser.backspace_action"),
    "BrowserReload();": "key_reload",
    goBackKb2: "goBackKb",
    goForwardKb2: "goForwardKb",
    get cmd_handleBackspace() this.action < 2 && ["goBackKb", "cmd_scrollPageUp"][this.action],
    get cmd_handleShiftBackspace() this.action < 2 && ["goForwardKb", "cmd_scrollPageDown"][this.action]
  };
  if (keyname[id]) {
    let key = doc.getElementById(keyname[id]);
    if (key)
      return _getKeyName(win, key);
  }

  return (keyname[id] || id).replace(/key_|cmd_/, "");
}

function _getLabel(elm, attr, value) {
  if (!elm)
    return null;
  let items = elm.getElementsByAttribute(attr, value);
  for (let i = 0, l = items.length; i < l; i++) {
    if (items[i].hasAttribute("label")) {
      return items[i].localName == "menuitem" ?
        _getPath(items[i]) : items[i].getAttribute("label");
    }
  }
  return null;
}

function _getPath(elm){
  let names = [];
  while (elm && elm.localName && elm.localName != "toolbaritem" &&
         elm.localName != "popupset" && elm.id != "titlebar-content") {
    if (elm.hasAttribute("label"))
      names.unshift(elm.getAttribute("label"));
    elm = elm.parentNode;
  }
  return names.join(" > ");
}

function getFormattedKey(key) Shortcuts.getFormattedKey(key)
