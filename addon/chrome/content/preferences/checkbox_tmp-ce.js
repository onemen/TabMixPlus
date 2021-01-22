/* eslint no-var: 2, prefer-const: 2 */
"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{
  class MozCheckbox_tmp extends MozXULElement {
    static get inheritedAttributes() {
      return {".checkbox": "label,align,style,accesskey,crop,flex,disabled"};
    }

    connectedCallback() {
      if (this._initialized) {
        return;
      }
      
      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
      <checkbox class="checkbox" ></checkbox>
    `));

      if (!this.hasAttribute("preference-editable")) {
        this.setAttribute("preference-editable", "true");
      }

      this.initializeAttributeInheritance();
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

      this._checkbox = this.getElementsByClassName("checkbox")[0];
    
      this._initialized = true;
    }

    set label(val) {
      return (this._checkbox.label = val);
    }

    get label() {
      return this._checkbox.label;
    }

    set value(val) {
      return (this.checked = val);
    }

    get value() {
      return this._checkbox.checked;
    }

    set checked(val) {
      return (this._checkbox.checked = val);
    }

    get checked() {
      return this._checkbox.checked;
    }

    set disabled(val) {
      return (this._checkbox.disabled = val);
    }

    get disabled() {
      return this._checkbox.disabled;
    }
  }

  customElements.define("checkbox_tmp", MozCheckbox_tmp);
}
