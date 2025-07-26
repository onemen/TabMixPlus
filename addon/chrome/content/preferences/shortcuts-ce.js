/* global getKeysForShortcut */
/* eslint no-var: 2, prefer-const: 2 */
"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{
  ChromeUtils.defineLazyGetter(this, "shortcutKeyMapPromise", async () => {
    const {ExtensionShortcutKeyMap} = ChromeUtils.importESModule(
      "resource://gre/modules/ExtensionShortcuts.sys.mjs"
    );
    const {AddonManager} = ChromeUtils.importESModule(
      "resource://gre/modules/AddonManager.sys.mjs"
    );
    const shortcutKeyMap = new ExtensionShortcutKeyMap();
    const addons = await AddonManager.getAddonsByTypes(["extension"]);
    await shortcutKeyMap.buildForAddonIds(addons.map(addon => addon.id));
    return shortcutKeyMap;
  });

  /**
   * @param {string} shortcutString
   * @returns {Promise<string[] | null>}
   */
  const getDuplicateShortcutAddonsName = async shortcutString => {
    const shortcutKeyMap = await shortcutKeyMapPromise;
    if (shortcutKeyMap.has(shortcutString)) {
      return [...shortcutKeyMap.get(shortcutString).values()].map(addon => addon.addonName);
    }
    return null;
  };

  /** @type {MozShortcutClass} */
  class MozShortcut extends MozXULElement {
    static get inheritedAttributes() {
      return {
        "description": "disabled=blocked",
        ".input-container": "disabled=blocked",
        ".shortcut-edit-box": "value,disabled=blocked",
      };
    }

    /** @this {MozShortcutClass} */
    connectedCallback() {
      if (this._initialized || this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(
        MozXULElement.parseXULToFragment(
          `
        <hbox class="shortcut-content">
          <description inherits="disabled=blocked"></description>
          <hbox class="input-container" inherits="disabled=blocked">
            <html:input flex="1" focused="true" class="shortcut-edit-box" anonid="editBox"
              inherits="value,disabled=blocked" context=" "
              placeholder="&shortcuts.placeholder;"
              onkeydown="this.shortcut.onKeyDown(event);"
              onkeypress="this.shortcut.handleKeyEvents(event);"
              onfocus="this.shortcut.updateFocus(true);"
              onmousedown="event.stopPropagation(); event.preventDefault(); this.select();"
              onchange="event.stopPropagation();"/>
            <image anonid="shortcut_reset" class="shortcut-image" tooltiptext="&shortcuts.reset;" _hidden="true"
              onclick="resetKey();"/>
            <image anonid="disable" class="shortcut-image" tooltiptext="&shortcuts.clear;"
              onclick="disableKey();"/>
          </hbox>
        </hbox>
        <vbox anonid="notificationbox" class="shortcut-notificationbox" flex="1"
          inuse="&shortcuts.inuse;"
          otherExtension="&shortcuts.otherExtension;"
        ></vbox>
      `,
          ["chrome://tabmixplus/locale/shortcuts.dtd"]
        )
      );
      this.initializeAttributeInheritance();
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

      this._key = null;

      this.editBox.shortcut = this;

      this._initialized = true;
    }

    get description() {
      return Tabmix.lazyGetter(this, "description", this.querySelector("description"));
    }

    get editBox() {
      return Tabmix.lazyGetter(
        this,
        "editBox",
        () => this.getElementsByAttribute("anonid", "editBox")[0]
      );
    }

    get notificationbox() {
      return Tabmix.lazyGetter(
        this,
        "notificationbox",
        () => this.getElementsByAttribute("anonid", "notificationbox")[0]
      );
    }

    get keyid() {
      return Shortcuts.keys[this.id]?.id || "key_tm_" + this.id;
    }

    set blocked(val) {
      if (val != this.blocked) {
        if (val) {
          this.setAttribute("blocked", "true");
        } else {
          this.removeAttribute("blocked");
        }
      }
    }

    get blocked() {
      return this.hasAttribute("blocked");
    }

    set disabled(val) {
      if (this._key) {
        this._key.disabled = Boolean(val);
      }
    }

    get disabled() {
      return !this._key || this._key.disabled;
    }

    set label(val) {
      this.description.textContent = val;
      this.setAttribute("label", val ?? "");
    }

    get label() {
      return this.getAttribute("label") ?? "";
    }

    set value(val) {
      if (this.value != val) {
        this.setAttribute("value", val);
      }
    }

    get value() {
      return this.getAttribute("value") ?? "";
    }

    set key(val) {
      this._key = val;
      this.value = val?.disabled ? "" : getFormattedKey(val);
    }

    get key() {
      return this._key;
    }

    get defaultPref() {
      const defaultVal = (Shortcuts.keys[this.id]?.default || "").replace(/^d&/, "");
      if (defaultVal) {
        const resetButton = this.getElementsByAttribute("anonid", "shortcut_reset")[0];
        resetButton.setAttribute("_hidden", false);
        const defaultKey = getFormattedKey(Shortcuts.keyParse(defaultVal));
        resetButton.setAttribute(
          "tooltiptext",
          resetButton.getAttribute("tooltiptext") + "\nDefault is: " + defaultKey
        );
      }
      Object.defineProperty(this, "defaultPref", {
        value: defaultVal,
        configurable: true,
        enumerable: true,
      });
      return defaultVal;
    }

    /** @type {MozShortcutClass["valueFromPreferences"]} */
    valueFromPreferences(aKeyData) {
      this.description.textContent = this.label;
      if (!aKeyData.value && !this._key) {
        return false;
      }

      this.key = Shortcuts.keyParse(aKeyData.value);
      // trigger this.defaultPref getter on first run
      this.setAttribute("default", this.defaultPref == aKeyData.value && !this.disabled);
      return this.updateNotification();
    }

    /** @type {MozShortcutClass["updateFocus"]} */
    updateFocus(onFocus) {
      if (onFocus) {
        this.editBox.select();
        const panel = $("shortcuts-panel");
        panel.shortcut?.removeAttribute("focused");
        panel.shortcut = this;
      }
      this.setAttribute("focused", onFocus);
    }

    /** @type {MozShortcutClass["applyNewValue"]} */
    applyNewValue(aNewValue, aDisabled) {
      const newValue = (aDisabled ? "d&" : "") + (aNewValue || "").replace(/^d&/, "");
      if (newValue != Shortcuts.keyStringify(this.key)) {
        const newKey = Shortcuts.keyParse(newValue);
        newKey.disabled = aDisabled;
        this.key = newKey;
        this.setAttribute("default", !this.disabled && this.defaultPref == newValue);
        const shortcuts = $("shortcut-group");
        shortcuts.keys[this.id] = newValue;
        shortcuts.value = JSON.stringify(shortcuts.keys);
        Shortcuts.prefsChangedByTabmix = true;
        $Pref("pref_shortcuts").value = shortcuts.value;
        Shortcuts.prefsChangedByTabmix = false;

        /** @param {MozShortcutClass} shortcut */
        const callBack = shortcut => shortcut.id && shortcut.updateNotification();
        gMenuPane.updateShortcuts(this.parentNode, callBack);
      }
      this.editBox.select();
    }

    /** @this {MozShortcutClass} */
    resetKey() {
      this.applyNewValue(this.defaultPref, false);
    }

    /** @this {MozShortcutClass} */
    disableKey() {
      if (!this.disabled) {
        this.applyNewValue("", true);
      }
    }

    updateNotification() {
      const shortcut = !this.disabled && getFormattedKey(this.key);
      const usedKey = shortcut && getKeysForShortcut(shortcut, this.keyid);
      const box = this.notificationbox;
      while (box.hasChildNodes()) {
        box.firstChild?.remove();
      }

      /**
       * @param {string | null} label
       * @param {number} [_index]
       * @param {any[]} [_array]
       */
      function addDescription(label, _index, _array) {
        const node = document.createXULElement("description");
        node.setAttribute("value", label ?? "");
        box.appendChild(node);
      }

      if (usedKey) {
        const msg = (box.getAttribute("inuse") + ":\n" + usedKey).split("\n");
        for (let i = 0, l = msg.length; i < l; i++) {
          // Firefox code in ExtensionShortcuts.sys.mjs buildKey set oncommand to "//""
          if (msg[i] === "//") {
            getDuplicateShortcutAddonsName(shortcut).then(names => {
              (names || [box.getAttribute("otherExtension")]).forEach(addDescription);
            });
          } else {
            addDescription(msg[i] ?? "");
          }
        }
        if (!this.hasAttribute("used")) {
          this.setAttribute("used", true);
        }
      } else {
        this.removeAttribute("used");
      }
      return usedKey;
    }

    /** @type {MozShortcutClass["onKeyDown"]} */
    onKeyDown(event) {
      // prevents Alt+C from closing our preferences window
      // note: AltGraph+C does not close window
      if (event.altKey && (event.keyCode === 67 || event.key === "c")) {
        event.preventDefault();
        event.stopPropagation();
        this.handleKeyEvents(event, true);
        return;
      }

      // handle Ctrl/Command + W
      const control = !event.shiftKey && (event.ctrlKey || event.metaKey);
      if (control && event.keyCode == 87) {
        this.handleKeyEvents(event, true);
      }
    }

    /** @type {MozShortcutClass["handleKeyEvents"]} */
    handleKeyEvents(event, ctrl_w) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const key = {modifiers: "", key: "", keycode: ""};
      const modifiers = ["ctrl", "meta", "alt", "altGr", "shift"];

      key.modifiers = modifiers
        .filter(mod => event[mod + "Key"])
        .join(",")
        .replace("ctrl", "control");

      if (!key.modifiers) {
        // Return and Esc blur the edit box
        if (event.keyCode == event.DOM_VK_RETURN || event.keyCode == event.DOM_VK_ESCAPE) {
          this.editBox.blur();
          return;
        }

        // Delete and Backspace disable the key
        if (event.keyCode == event.DOM_VK_DELETE || event.keyCode == event.DOM_VK_BACK_SPACE) {
          this.disableKey();
          return;
        }
      } else if (this.key && this.key.modifiers.indexOf("accel") > -1) {
        // when current modifier is accel replace new modifier with accel
        // if it match ui.key.accelKey
        key.modifiers = key.modifiers.replace(Shortcuts.getPlatformAccel(), "accel");
      }

      if (event.charCode == event.DOM_VK_SPACE) {
        key.keycode = "VK_SPACE";
      } else if (event.charCode) {
        key.key = String.fromCharCode(event.charCode).toUpperCase();
      } else {
        const eKeyCode = event.keyCode;
        if (eKeyCode == 8) {
          key.keycode = "VK_BACK";
        }

        for (const keycode of Object.keys(KeyboardEvent)) {
          // @ts-expect-error
          const val = KeyboardEvent[keycode];
          if (val == eKeyCode) {
            const str = ctrl_w ? "DOM_VK_" : "DOM_";
            key.keycode = keycode.replace(str, "");
            break;
          }
        }
        if (!key.keycode) {
          return;
        }
      }

      const newValue = Shortcuts.validateKey(key) || Shortcuts.keyStringify(this.key);
      this.applyNewValue(newValue, false);
    }
  }

  customElements.define("shortcut", MozShortcut);
}
