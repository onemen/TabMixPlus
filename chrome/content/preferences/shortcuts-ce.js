/* This Source Code Form is subject to the terms of the Mozilla Public
  * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

  "use strict";

  // This is loaded into all XUL windows. Wrap in a block to prevent
  // leaking to window scope.
  {
  
  class MozShortcut extends MozXULElement {
    static get inheritedAttributes() {
      return {
        "description": "disabled=blocked",
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
          <description inherits="disabled=blocked" flex="1"></description>
          <textbox class="shortcut-edit-box" anonid="editBox" style="width:200px;" inherits="value,disabled=blocked" context=" " placeholder="FROM-DTD-shortcuts-placeholder" onkeydown="document.getBindingParent(this).onKeyDown(event);" onkeypress="document.getBindingParent(this).handleKeyEvents(event);" onfocus="document.getBindingParent(this).updateFocus(true);" onblur="document.getBindingParent(this).updateFocus(false);" onmousedown="event.stopPropagation(); event.preventDefault(); this.select();" onchange="event.stopPropagation();">
            <image anonid="reset" class="shortcut-image" tooltiptext="FROM-DTD-shortcuts-reset" hidden="true" onclick="document.getBindingParent(this).resetKey();"></image>
            <image anonid="disable" class="shortcut-image" tooltiptext="FROM-DTD-shortcuts-clear" onclick="document.getBindingParent(this).disableKey();"></image>
          </textbox>
        </hbox>
        <vbox anonid="notificationbox" class="shortcut-notificationbox" inuse="FROM-DTD-shortcuts-inuse" flex="1"></vbox>
      `));
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
      var defaultVal = (Shortcuts.keys[this.id].default || "").replace(/^d&/, "");
      if (defaultVal) {
        let resetButton = this.getElementsByAttribute("anonid", "reset")[0];
        resetButton.hidden = false;
        let defaultKey = getFormattedKey(Shortcuts.keyParse(defaultVal));
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
      var newValue = (aDisabled ? "d&" : "") + (aNewValue || "").replace(/^d&/, "");
      if (newValue != Shortcuts.keyStringify(this.key)) {
        let newKey = Shortcuts.keyParse(newValue);
        newKey.disabled = aDisabled;
        this.key = newKey;
        this.setAttribute("default", !this.disabled && this.defaultPref == newValue);
        this.parentNode.keys[this.id] = newValue;
        this.parentNode.value = TabmixSvc.JSON.stringify(this.parentNode.keys);
        Shortcuts.prefsChangedByTabmix = true;
        $("pref_shortcuts").value = this.parentNode.value;
        Shortcuts.prefsChangedByTabmix = false;
        let callBack = shortcut => shortcut.id && shortcut.updateNotification();
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
      var shortcut = !this.disabled && getFormattedKey(this.key);
      var usedKey = shortcut && getKeysForShortcut(shortcut, this.keyid);
      var box = this.notificationbox;
      while (box.hasChildNodes()) {
        box.firstChild.remove();
      }
      if (usedKey) {
        let msg = (box.getAttribute("inuse") + ":\n" + usedKey).split("\n");
        for (let i = 0, l = msg.length; i < l; i++) {
          let node = document.createElement("description");
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
      var control = !event.shiftKey && (event.ctrlKey || event.metaKey);
      if (control && event.keyCode == 87)
        this.handleKeyEvents(event, true);
    }
  
    handleKeyEvents(event, ctrl_w) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
  
      var key = { modifiers: "", key: "", keycode: "" };
      let modifiers = ["ctrl", "meta", "alt", "shift"];
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
        let eKeyCode = event.keyCode;
        if (eKeyCode == 8)
          key.keycode = "VK_BACK";
        for (let keycode of Object.keys(KeyboardEvent)) {
          let val = KeyboardEvent[keycode];
          if (val == eKeyCode) {
            let str = ctrl_w ? "DOM_VK_" : "DOM_";
            key.keycode = keycode.replace(str, "");
            break;
          }
        }
        if (!key.keycode)
          return;
      }
  
      var newValue = Shortcuts.validateKey(key) || Shortcuts.keyStringify(this.key);
      this.applyNewValue(newValue, false);
    }
  }
  
  customElements.define("shortcut", MozShortcut);
  
  }
  