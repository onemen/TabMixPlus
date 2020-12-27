/* This Source Code Form is subject to the terms of the Mozilla Public
  * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{

class MozMenulistEditable extends MozMenulist {
  constructor() {
    super();

    this.addEventListener("focus", (event) => {
      this.setAttribute("focused", "true");
    }, true);

    this.addEventListener("blur", (event) => {
      this.removeAttribute("focused");
    }, true);

    this.addEventListener("popupshowing", (event) => {
      // editable menulists elements aren't in the focus order,
      // so when the popup opens we need to force the focus to the inputField
      if (event.target.parentNode == this) {
        if (document.commandDispatcher.focusedElement != this.inputField)
          this.inputField.focus();

        this.menuBoxObject.activeChild = null;
        if (this.selectedItem)
          // Not ready for auto-setting the active child in hierarchies yet.
          // For now, only do this when the outermost menupopup opens.
          this.menuBoxObject.activeChild = this.mSelectedInternal;
      }
    });

    this.addEventListener("keypress", (event) => {
      // open popup if key is up arrow, down arrow, or F4
      if (!event.ctrlKey && !event.shiftKey) {
        if (event.keyCode == KeyEvent.DOM_VK_UP ||
          event.keyCode == KeyEvent.DOM_VK_DOWN ||
          (event.keyCode == KeyEvent.DOM_VK_F4 && !event.altKey)) {
          event.preventDefault();
          this.open = true;
        }
      }
    });

  }

  static get inheritedAttributes() {
    return object.defineProperties(super.prop.inheritedAttributes,{
      input:{value:"value=label,value,disabled,tabindex,readonly,placeholder,list,type,min,max,size"},
    });
  }

  static get markup() {
    // Accessibility information of these nodes will be presented
    // on XULComboboxAccessible generated from <menulist>;
    // hide these nodes from the accessibility tree.
    return `
      <html:link href="chrome://global/skin/menulist.css" rel="stylesheet"/>
      <hbox id="label-box" part="label-box" flex="1" role="none">
        <html:input class="menulist-editable-input" id="input" allowevents="true" 
            inherits="value=label,value,disabled,tabindex,readonly,placeholder"></html:input>
      </hbox>
      <dropmarker part="dropmarker" exportparts="icon: dropmarker-icon" type="menu" role="none"/>
      <html:slot/>
  `;
  }

//   connectedCallback() {
//     if (this.delayConnectedCallback()) {
//       return;
//     }
//     this.textContent = "";
//     this.appendChild(MozXULElement.parseXULToFragment(`
//       <hbox class="menulist-editable-box textbox-input-box" inherits="context,disabled,readonly,focused" flex="1">
//         <html:input class="menulist-editable-input" anonid="input" allowevents="true" inherits="value=label,value,disabled,tabindex,readonly,placeholder"></html:input>
//       </hbox>
//       <dropmarker class="menulist-dropmarker" type="menu" inherits="open,disabled,parentfocused=focused"></dropmarker>
//       <children includes="menupopup"></children>
//     `));
//     // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

//   }

  get inputField() {
    if (!this.mInputField)
      this.mInputField = document.shadowRoot.getElementById("input");
    return this.mInputField;
  }

  set label(val) {
    this.inputField.value = val;
    return val;
  }

  get label() {
    return this.inputField.value;
  }

  set value(val) {
    // Override menulist's value setter to refer to the inputField's value
    // (Allows using "menulist.value" instead of "menulist.inputField.value")
    this.inputField.value = val;
    this.setAttribute("value", val);
    this.setAttribute("label", val);
    this._selectInputFieldValueInList();
    return val;
  }

  get value() {
    return this.inputField.value;
  }

  set selectedItem(val) {
    var oldval = this.mSelectedInternal;
    if (oldval == val)
      return val;

    if (val && !this.contains(val))
      return val;

    // This doesn't touch inputField.value or "value" and "label" attributes
    this.setSelectionInternal(val);
    if (val) {
      // Editable menulist uses "label" as its "value"
      var label = val.getAttribute("label");
      this.inputField.value = label;
      this.setAttribute("value", label);
      this.setAttribute("label", label);
    } else {
      this.inputField.value = "";
      this.removeAttribute("value");
      this.removeAttribute("label");
    }

    var event = document.createEvent("Events");
    event.initEvent("select", true, true);
    this.dispatchEvent(event);

    event = document.createEvent("Events");
    event.initEvent("ValueChange", true, true);
    this.dispatchEvent(event);

    return val;
  }

  get selectedItem() {
    // Make sure internally-selected item
    //  is in sync with inputField.value
    this._selectInputFieldValueInList();
    return this.mSelectedInternal;
  }

  set disableautoselect(val) {
    if (val) this.setAttribute('disableautoselect', 'true');
    else this.removeAttribute('disableautoselect');
    return val;
  }

  get disableautoselect() {
    return this.hasAttribute('disableautoselect');
  }

  get editor() {
    const nsIDOMNSEditableElement = Components.interfaces.nsIDOMNSEditableElement;
    return this.inputField.QueryInterface(nsIDOMNSEditableElement).editor;
  }

  set readOnly(val) {
    this.inputField.readOnly = val;
    if (val) this.setAttribute('readonly', 'true');
    else this.removeAttribute('readonly');
    return val;
  }

  get readOnly() {
    return this.inputField.readOnly;
  }

  _selectInputFieldValueInList() {
    if (this.hasAttribute("disableautoselect"))
      return;

    // Find and select the menuitem that matches inputField's "value"
    var arr = null;
    var popup = this.menupopup;

    if (popup)
      arr = popup.getElementsByAttribute("label", this.inputField.value);

    this.setSelectionInternal(arr ? arr.item(0) : null);
  }

  setSelectionInternal(val) {
    // This is called internally to set selected item
    //  without triggering infinite loop
    //  when using selectedItem's setter
    if (this.mSelectedInternal == val)
      return val;

    if (this.mSelectedInternal)
      this.mSelectedInternal.removeAttribute("selected");

    this.mSelectedInternal = val;

    if (val)
      val.setAttribute("selected", "true");

    // Do NOT change the "value", which is owned by inputField
    return val;
  }

  select() {
    this.inputField.select();
  }
}

customElements.define("menulist-editable", MozMenulistEditable);

}