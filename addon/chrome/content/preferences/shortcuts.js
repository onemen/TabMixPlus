/** based on keyconfig extension by dorando */

/* exported getKeysForShortcut */
"use strict";

/** @type {ShortcutsModule.Shortcuts["getFormattedKey"]} */
var getFormattedKey = key => Shortcuts.getFormattedKey(key);

///XXX TODO - add black list with shortcut (F1, Ctrl-Tab ....) that don't have DOM key element
/** @type {Globals.getKeysForShortcut} */
function getKeysForShortcut(shortcut, id, win) {
  if (!win) {
    win = Services.wm.getMostRecentWindow("navigator:browser");
  }

  /** @param {string} aID @type {Document["getElementById"]} */
  let $ = aID => aID && win.document.getElementById(aID);

  /** @param {Element} item */
  let isDisabled = item => item && item.getAttribute("disabled");

  let ourKey = $(id);
  if (isDisabled(ourKey)) {
    return null;
  }

  let dots = "…";
  let keys = win.document.getElementsByTagName("key");
  let usedKeys = Array.prototype.filter
    .call(keys, key => {
      if (ourKey == key) {
        return false;
      }

      if (isDisabled(key) || isDisabled($(key.getAttribute("command")))) {
        return false;
      }

      let _key = {
        modifiers: key.getAttribute("modifiers"),
        key: key.getAttribute("key"),
        keycode: key.getAttribute("keycode"),
      };
      return getFormattedKey(_key) == shortcut;
    })
    .map(key => _getKeyName(win, key).replace(dots, ""));

  // Firefox code in ExtensionShortcuts.sys.mjs buildKey set oncommand to "//""
  // filter out duplicates "//"
  return usedKeys.filter((v, i, a) => a.indexOf(v) === i).join("\n");
}

/** @type {Globals._getKeyName} */
function _getKeyName(win, aKey) {
  let doc = win.document;
  let command = "",
    val;

  // don't use dynamic label for key name
  const skip = ["key_restoreLastClosedTabOrWindowOrSession", "key_undoCloseWindow"];
  if (!skip.includes(aKey.id)) {
    let fButton = doc.getElementById("titlebar");
    val =
      (fButton &&
        !fButton.hidden &&
        _getLabel(doc.getElementById("appmenu-button"), "key", aKey.id)) ||
      _getLabel(doc.getElementById("main-menubar"), "key", aKey.id) ||
      _getLabel(doc.getElementById("mainPopupSet"), "key", aKey.id) ||
      _getLabel(doc, "key", aKey.id);
  }

  if (!val && (aKey.hasAttribute("command") || aKey.hasAttribute("observes"))) {
    command = aKey.getAttribute("command") || aKey.getAttribute("observes") || "";
    let node = doc.getElementById(command);
    if (node && node.hasAttribute("label")) {
      return node.getAttribute("label") ?? "";
    }
    val = _getLabel(doc, "command", command) || _getLabel(doc, "observes", command);
  }

  if (val) {
    return val;
  }

  if (aKey.hasAttribute("label")) {
    return aKey.getAttribute("label") ?? "";
  }

  let id =
    command && command.indexOf(":") > -1 ?
      command
    : ((aKey.id.replace(/xxx_key.+?_/, "") || // keyconfig format
        command ||
        aKey.getAttribute("oncommand")) ??
      "");
  try {
    const u8arr = new Uint8Array(id.split("").map(c => c.charCodeAt(0)));
    const utf8decoder = new TextDecoder("utf-8");
    id = utf8decoder.decode(u8arr);
  } catch {}

  /** @type {{action: number} & Record<string, string>} */ // @ts-expect-error
  let keyname = {
    "action": Services.prefs.getIntPref("browser.backspace_action"),
    "BrowserReload();": "key_reload",
    "goBackKb2": "goBackKb",
    "goForwardKb2": "goForwardKb",
    get "cmd_handleBackspace"() {
      return (this.action < 2 && ["goBackKb", "cmd_scrollPageUp"][this.action]) || "";
    },
    get "cmd_handleShiftBackspace"() {
      return (this.action < 2 && ["goForwardKb", "cmd_scrollPageDown"][this.action]) || "";
    },
  };
  const keynameId = keyname[id];
  if (keynameId) {
    let key = doc.getElementById(keynameId);
    if (key) {
      return _getKeyName(win, key);
    }
  }

  return (keynameId || id).replace(/key_|cmd_/, "");
}

/** @type {Globals._getLabel} */
function _getLabel(elm, attr, value) {
  if (!elm) {
    return null;
  }

  let items = elm.getElementsByAttribute(attr, value);
  for (const item of items) {
    if (item.hasAttribute("label")) {
      return item.localName == "menuitem" ? _getPath(item) : item.getAttribute("label");
    }
  }
  return null;
}

/** @type {Globals._getPath} */
function _getPath(elm) {
  let names = [];
  while (
    elm.localName &&
    elm.localName != "toolbaritem" &&
    elm.localName != "popupset" &&
    elm.id != "titlebar-content"
  ) {
    if (elm.hasAttribute("label")) {
      names.unshift(elm.getAttribute("label"));
    }

    if (!elm.parentNode) {
      break;
    }
    elm = elm.parentNode;
  }
  return names.join(" > ");
}
