/* eslint no-var: 2, prefer-const: 2 */
"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{
  /** @type {CheckboxClass} */
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

    /** @this {CheckboxClass} */
    set label(val) {
      this._checkbox.label = val;
    }

    /** @this {CheckboxClass} */
    get label() {
      return this._checkbox.label;
    }

    set value(val) {
      this.checked = val;
    }

    /** @this {CheckboxClass} */
    get value() {
      return this._checkbox.checked;
    }

    /** @this {CheckboxClass} */
    set checked(val) {
      this._checkbox.checked = val;
    }

    /** @this {CheckboxClass} */
    get checked() {
      return this._checkbox.checked;
    }

    /** @this {CheckboxClass} */
    set disabled(val) {
      this._checkbox.disabled = val;
    }

    /** @this {CheckboxClass} */
    get disabled() {
      return this._checkbox.disabled;
    }
  }

  customElements.define("checkbox_tmp", MozCheckbox_tmp);
}
