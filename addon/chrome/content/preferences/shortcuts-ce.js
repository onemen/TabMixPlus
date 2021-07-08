/* eslint no-var: 2, prefer-const: 2 */
"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{
  class MozShortcut extends MozXULElement {
    static get inheritedAttributes() {
      return {
        "description": "value=label,disabled=blocked",
        ".shortcut-edit-box": "value,disabled=blocked",
      };
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
        <hbox align="start" class="shortcut-content">
          <description inherits="value=label,disabled=blocked" flex="1"></description>
          <html:input class="shortcut-edit-box" anonid="editBox" style="width:200px;" inherits="value,disabled=blocked" context=" " placeholder="&shortcuts.placeholder;" onkeydown="this.parentNode.parentNode.onKeyDown(event);" onkeypress="this.parentNode.parentNode.handleKeyEvents(event);" onfocus="this.parentNode.parentNode.updateFocus(true);" onblur="this.parentNode.parentNode.updateFocus(false);" onmousedown="event.stopPropagation(); event.preventDefault(); this.select();" onchange="event.stopPropagation();">
          </html:input>
            <image anonid="reset" class="shortcut-image" tooltiptext="&shortcuts.reset;" hidden="true" onclick="this.parentNode.parentNode.resetKey();"></image>
            <image anonid="disable" class="shortcut-image" tooltiptext="&shortcuts.clear;" onclick="this.parentNode.parentNode.disableKey();"></image>
        </hbox>
        <vbox anonid="notificationbox" class="shortcut-notificationbox" inuse="&shortcuts.inuse;" flex="1"></vbox>
      `, ["chrome://tabmixplus/locale/shortcuts.dtd"]));
      this.initializeAttributeInheritance();
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

      this._key = null;

      this.notificationbox = this.getElementsByAttribute("anonid", "notificationbox")[0];

      this.editBox = this.getElementsByAttribute("anonid", "editBox")[0];
    }

    get keyid() {
      return Shortcuts.keys[this.id].id || 'key_tm_' + this.id;
    }

    set blocked(val) {
      if (val != this.blocked) {
        if (val)
          this.setAttribute("blocked", "true");
        else
          this.removeAttribute("blocked");
      }
      return val;
    }

    get blocked() {
      return this.hasAttribute('blocked');
    }

    set disabled(val) {
      this._key.disabled = val;
      return val;
    }

    get disabled() {
      return !this._key || this._key.disabled;
    }

    set value(val) {
      if (this.value != val)
        this.setAttribute("value", val);
      return val;
    }

    get value() {
      return this.getAttribute('value');
    }

    set key(val) {
      this._key = val;
      this.value = val.disabled ? "" : getFormattedKey(val);
      return val;
    }

    get key() {
      return this._key;
    }

    get defaultPref() {
      const defaultVal = (Shortcuts.keys[this.id].default || "").replace(/^d&/, "");
      if (defaultVal) {
        const resetButton = this.getElementsByAttribute("anonid", "reset")[0];
        resetButton.hidden = false;
        const defaultKey = getFormattedKey(Shortcuts.keyParse(defaultVal));
        resetButton.setAttribute("tooltiptext",
          resetButton.getAttribute("tooltiptext") + "\nDefault is: " + defaultKey);
      }
      this.__defineGetter__("defaultPref", () => defaultVal);
      return defaultVal;
    }

    valueFromPreferences(aKeyData) {
      this.editBox.previousSibling.textContent = this.getAttribute("label");
      if (!aKeyData.value && !this._key)
        return false;
      this.key = Shortcuts.keyParse(aKeyData.value);
      // trigger this.defaultPref getter on first run
      this.setAttribute("default", this.defaultPref == aKeyData.value && !this.disabled);
      return this.updateNotification();
    }

    updateFocus(onFocus) {
      if (onFocus) {
        this.editBox.select();
        $('shortcuts-panel').editBox = this.editBox;
      }
      this.setAttribute("focused", onFocus);
    }

    applyNewValue(aNewValue, aDisabled) {
      const newValue = (aDisabled ? "d&" : "") + (aNewValue || "").replace(/^d&/, "");
      if (newValue != Shortcuts.keyStringify(this.key)) {
        const newKey = Shortcuts.keyParse(newValue);
        newKey.disabled = aDisabled;
        this.key = newKey;
        this.setAttribute("default", !this.disabled && this.defaultPref == newValue);
        this.parentNode.keys[this.id] = newValue;
        this.parentNode.value = JSON.stringify(this.parentNode.keys);
        Shortcuts.prefsChangedByTabmix = true;
        $("pref_shortcuts").value = this.parentNode.value;
        Shortcuts.prefsChangedByTabmix = false;
        const callBack = shortcut => shortcut.id && shortcut.updateNotification();
        gMenuPane.updateShortcuts(this.parentNode, callBack);
      }
      this.editBox.select();
    }

    resetKey() {
      this.applyNewValue(this.defaultPref, false);
    }

    disableKey() {
      if (!this.disabled)
        this.applyNewValue("", true);
    }

    updateNotification() {
      const shortcut = !this.disabled && getFormattedKey(this.key);
      const usedKey = shortcut && getKeysForShortcut(shortcut, this.keyid);
      const box = this.notificationbox;
      while (box.hasChildNodes()) {
        box.firstChild.remove();
      }
      if (usedKey) {
        const msg = (box.getAttribute("inuse") + ":\n" + usedKey).split("\n");
        for (let i = 0, l = msg.length; i < l; i++) {
          const node = document.createElement("description");
          node.setAttribute("value", msg[i]);
          box.appendChild(node);
        }
        if (!this.hasAttribute("used"))
          this.setAttribute("used", true);
      } else {
        this.removeAttribute("used");
      }
      return usedKey;
    }

    onKeyDown(event) {
      // handle Ctrl/Command + W
      const control = !event.shiftKey && (event.ctrlKey || event.metaKey);
      if (control && event.keyCode == 87)
        this.handleKeyEvents(event, true);
    }

    handleKeyEvents(event, ctrl_w) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const key = {modifiers: "", key: "", keycode: ""};
      const modifiers = ["ctrl", "meta", "alt", "shift"];
      key.modifiers = modifiers.filter(mod => event[mod + "Key"])
          .join(",").replace("ctrl", "control");

      if (!key.modifiers) {
        // Return and Esc blur the edit box
        if (event.keyCode == event.DOM_VK_RETURN ||
          event.keyCode == event.DOM_VK_ESCAPE) {
          this.editBox.blur();
          return;
        }

        // Delete and Backspace disable the key
        if (event.keyCode == event.DOM_VK_DELETE ||
          event.keyCode == event.DOM_VK_BACK_SPACE) {
          this.disableKey();
          return;
        }
      } else if (this.key && this.key.modifiers.indexOf("accel") > -1) {
        // when current modifier is accel replace new modifier with accel
        // if it match ui.key.accelKey
        key.modifiers = key.modifiers.replace(Shortcuts.getPlatformAccel(), "accel");
      }

      if (event.charCode == event.DOM_VK_SPACE)
        key.keycode = "VK_SPACE";
      else if (event.charCode)
        key.key = String.fromCharCode(event.charCode).toUpperCase();
      else {
        const eKeyCode = event.keyCode;
        if (eKeyCode == 8)
          key.keycode = "VK_BACK";
        for (const keycode of Object.keys(KeyboardEvent)) {
          const val = KeyboardEvent[keycode];
          if (val == eKeyCode) {
            const str = ctrl_w ? "DOM_VK_" : "DOM_";
            key.keycode = keycode.replace(str, "");
            break;
          }
        }
        if (!key.keycode)
          return;
      }

      const newValue = Shortcuts.validateKey(key) || Shortcuts.keyStringify(this.key);
      this.applyNewValue(newValue, false);
    }
  }

  customElements.define("shortcut", MozShortcut);
}
