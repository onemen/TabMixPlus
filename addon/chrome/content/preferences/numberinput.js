/* exported gNumberInput */
"use strict";

const gNumberInput = {
  init(delay = false) {
    window.addEventListener("change", this, true);
    window.addEventListener("input", this, true);
    window.addEventListener("keypress", this);
    window.addEventListener("unload", this, {once: true});

    if (delay) {
      // on pref-appearance the input value is not ready on init
      setTimeout(() => {
        this.updateAllSpinners();
      }, 0);
    } else {
      this.updateAllSpinners();
    }
  },

  uninit() {
    window.removeEventListener("change", this);
    window.removeEventListener("input", this);
    window.addEventListener("keypress", this);
  },

  changeExpr: (event)=>!event.target.validity.valid,

  inputExpr: (event)=>!event.target.validity.valid,

  handleEvent(event) {
    const item = event.target;
    if (item.type !== "number") {
      return;
    }
    switch (event.type) {
      case "change":
        if (this.changeExpr(event)) {
          item.value = item.defaultValue;
        }
        this.updateSpinnerDisabledState(item);
        break;
      case "input":
        if (this.inputExpr(event)) {
          event.stopPropagation();
          event.preventDefault();
        }
        if (item.editor.textLength > item.maxLength || item.validity.badInput) {
          item.value = item.defaultValue;
        } else if (item.validity.valid) {
          item.defaultValue = item.value;
        }
        this.updateSpinnerDisabledState(item);
        break;
      case "keypress":
        if (event.charCode == 0 || event.altKey || event.ctrlKey || event.metaKey) return;
        if (!/\d/.test(event.key) ||
            (item.editor.textLength == item.maxLength &&
              item.editor.selection.anchorOffset == item.editor.selection.focusOffset)) {
          event.stopPropagation();
          event.preventDefault();
        }
        break;
      case "unload":
        this.unload();
        break;
    }
  },

  updateAllSpinners() {
    window.document.querySelectorAll('input[type=number]').forEach(item => {
      this.updateSpinnerDisabledState(item);
      item.defaultValue = item.value;
    });
  },

  updateSpinnerDisabledState(item) {
    let {min, max, value} = item;
    value = value ? Number(value) : 0;
    min = min ? Number(min) : 0;
    max = max ? Number(max) : Infinity;
    window.opener.Tabmix.setItem(item, "increaseDisabled", value >= max || null);
    window.opener.Tabmix.setItem(item, "decreaseDisabled", value <= min || null);
  },

};
