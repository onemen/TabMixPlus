/* eslint no-var: 2, prefer-const: 2 */
"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.

/** @type {MozXULElement} */ // @ts-expect-error
const TabpanelsClass = customElements.get("tabpanels");
{
  /** @type {TabstylepanelClass} */
  class MozTabstylepanel extends TabpanelsClass {
    static get inheritedAttributes() {
      return {
        "hbox:nth-of-type(2)": "_hidebox",
        "[anonid='italic']": "disabled",
        "[anonid='bold']": "disabled",
        "[anonid='underline']": "disabled",
        "[anonid='textColor']": "disabled=text-disabled,_hidebox",
        "[anonid='text']": "disabled",
        "[anonid='bg']": "disabled",
        "[anonid='bgTopColor']": "disabled=bg-disabled,hidden=_hidebox",
        "[anonid='bgTopColor'] > label": "disabled=bg-disabled",
        "[anonid='bgColor']": "disabled=bg-disabled",
        "[anonid='bgColor'] > label": "disabled=bg-disabled,_hidebox",
      };
    }

    /** @this {TabstylepanelClass} */
    constructor() {
      super();

      this.addEventListener("command", () => {
        this._savePrefs();
      });
    }

    /** @this {TabstylepanelClass} */
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }

      /** @param {string} aID */ // @ts-expect-error - we override getElementsByAttribute return type
      this._getElementByAnonid = aID => this.getElementsByAttribute("anonid", aID)[0];

      this.textContent = "";
      this.appendChild(
        MozXULElement.parseXULToFragment(
          `
      <hbox align="center">
        <checkbox anonid="useThis" label="&useThis.label;: " oncommand="this.parentNode.parentNode._updateUseThisState(this.checked); event.stopPropagation();"></checkbox>
        <label></label>
      </hbox>
      <separator class="groove"></separator>
      <hbox align="center" style="height: 28px;" inherits="_hidebox">
        <checkbox anonid="italic" inherits="disabled" label="&italic.label;"></checkbox>
        <checkbox anonid="bold" inherits="disabled" label="&bold.label;"></checkbox>
        <checkbox anonid="underline" inherits="disabled" label="&underline.label;"></checkbox>
      </hbox>
      <vbox flex="1">
        <colorbox anonid="textColor" inherits="disabled=text-disabled,_hidebox">
          <checkbox anonid="text" class="visible" inherits="disabled" label="&textcolor.label;:" oncommand="this.parentNode.parentNode.parentNode.updateDisableState(this.getAttribute('anonid'))"></checkbox>
        </colorbox>
        <checkbox_tmp anonid="bg" inherits="disabled" label="&bgColor.label;:" oncommand="this.parentNode.parentNode.updateDisableState(this.getAttribute('anonid'))"></checkbox_tmp>
        <colorbox anonid="bgTopColor" class="bgTop" inherits="disabled=bg-disabled,hidden=_hidebox">
          <label value="&bgTopColor.label;:" class="visible" inherits="disabled=bg-disabled"></label>
        </colorbox>
        <colorbox anonid="bgColor" class="bgBottom" inherits="disabled=bg-disabled">
          <label value="&bgBottomColor.label;:" class="visible" inherits="disabled=bg-disabled,_hidebox"></label>
        </colorbox>
      </vbox>
      <separator class="groove"></separator>
      <hbox align="center" class="reset-button-box">
        <button label="&settings.default;" oncommand="this.parentNode.parentNode._resetDefault();"></button>
      </hbox>
    `,
          [
            "chrome://tabmixplus/locale/pref-tabmix.dtd",
            "chrome://tabmixplus/locale/pref-appearance.dtd",
          ]
        )
      );
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();

      this.setAttribute("orient", "vertical");

      this._item = null;

      this._prefValues = {};

      let checked = Tabmix.prefs.getBoolPref(this.id);
      this._initUseThisPref = {prefvalue: checked, optionvalue: checked};
      this._initPrefValues = Tabmix.prefs.getCharPref(this.prefName);

      if (
        !Services.prefs.getBoolPref(
          "browser.preferences.instantApply",
          /Mac/.test(navigator.platform)
        )
      ) {
        this._item =
          window.opener && window.opener.document.getElementById("pref_" + this.id, "_PREF_CLASS_");
        if (this._item) {
          this._initUseThisPref.optionvalue = checked = this._item.booleanValue;
          Tabmix.prefs.setBoolPref(this.id, checked);
        }
      }

      const useThis = this._getElementByAnonid("useThis");
      useThis.checked = checked;
      this.disabled = !checked;

      this.disableBgColor =
        Tabmix.prefs.getBoolPref("disableBackground") && this.id != "progressMeter";

      useThis.nextSibling.value = document.getElementById("_" + this.id).label;
      // colorpicker need some time until its ready
      window.setTimeout(() => this._getPrefs(this._initPrefValues), 0);

      const prefwindow = window.opener.document.querySelector("prefwindow");
      const button = document.querySelector('[dlgtype="extra1"]');
      prefwindow.setButtonLabel("help", button);
    }

    get prefName() {
      return "styles." + this.id;
    }

    set disabled(val) {
      if (val) {
        this.setAttribute("disabled", "true");
      } else {
        this.removeAttribute("disabled");
      }
    }

    get disabled() {
      return this.getAttribute("disabled") === "true";
    }

    /** @type {TabstylepanelClass["_updateUseThisState"]} */
    _updateUseThisState(aEnabled) {
      Tabmix.prefs.setBoolPref(this.id, aEnabled);
      this.disabled = !aEnabled;
      if ("text" in this._prefValues) {
        this.updateDisableState("text");
      }

      this.updateDisableState("bg");
    }

    /** @type {TabstylepanelClass["_resetDefault"]} */
    _resetDefault(aResetOnlyStyle) {
      if (!aResetOnlyStyle && Tabmix.prefs.prefHasUserValue(this.id)) {
        const useThis = this._getElementByAnonid("useThis");
        useThis.checked = !useThis.checked;
        this._updateUseThisState(useThis.checked);
        this._initUseThisPref.prefvalue = this._initUseThisPref.optionvalue = useThis.checked;
      }

      Tabmix.prefs.clearUserPref(this.prefName);
      this._initPrefValues = Tabmix.prefs.getCharPref(this.prefName);
      this._getPrefs(this._initPrefValues);
    }

    /** @type {TabstylepanelClass["_getPrefs"]} */
    _getPrefs(aPrefString) {
      try {
        this._prefValues = JSON.parse(aPrefString);
      } catch {
        this._resetDefault(true);
        return;
      }

      for (const [id, value] of Object.entries(this._prefValues)) {
        const item = this._getElementByAnonid(id);
        if (item && "checked" in item) {
          item.checked = value;
        } else if (item && "color" in item) {
          item.color = value;
        }
      }

      if ("text" in this._prefValues) {
        this.updateDisableState("text");
      }

      this.updateDisableState("bg");
    }

    /** @this {TabstylepanelClass} */
    _savePrefs() {
      /** @type {Record<string, boolean | string>} */
      const newPrefSValue = {};
      for (const _id of Object.keys(this._prefValues)) {
        const item = this._getElementByAnonid(_id);
        if (typeof item?.checked === "boolean") {
          newPrefSValue[_id] = item.checked;
        } else if (typeof item?.color === "string") {
          newPrefSValue[_id] = item.color;
        }
      }
      Tabmix.prefs.setCharPref(this.prefName, JSON.stringify(newPrefSValue));
    }

    /** @this {TabstylepanelClass} */
    _ondialogcancel() {
      Tabmix.prefs.setCharPref(this.prefName, this._initPrefValues);
      Tabmix.prefs.setBoolPref(this.id, this._initUseThisPref.prefvalue);
      if (this._item) {
        this._item.value = this._initUseThisPref.optionvalue;
      }
    }

    /** @type {TabstylepanelClass["updateDisableState"]} */
    updateDisableState(aID) {
      const disableBg = this.disableBgColor && aID == "bg";
      const disabled = this.disabled || disableBg || !this._getElementByAnonid(aID)?.checked;
      if (disableBg) {
        this._getElementByAnonid("bg").disabled = true;
      }

      Tabmix.setItem(this, aID + "-disabled", disabled || null);
      if (aID === "text") {
        this._getElementByAnonid("textColor").updateColor();
      } else if (aID === "bg") {
        this._getElementByAnonid("bgColor").updateColor();
      }
      if (aID == "bg") {
        this._getElementByAnonid("bgTopColor").updateColor();
      }
    }
  }

  customElements.define("tabstylepanel", MozTabstylepanel);

  class MozColorbox extends MozXULElement {
    static get inheritedAttributes() {
      return {
        '[anonid="color"]': "disabled",
        'label[value="[RGB]:"]': "disabled",
        '[anonid="red"]': "disabled",
        '[anonid="green"]': "disabled",
        '[anonid="blue"]': "disabled",
        "label.opacity": "disabled",
        '[anonid="opacity"]': "disabled",
      };
    }

    /** @this {MozColorboxClass} */
    constructor() {
      super();

      this.addEventListener("change", event => {
        const item = event.originalTarget;
        if (item.type == "color") {
          this.updateRgba(item.value);
        }
        this.update(event);
      });

      this.addEventListener("input", event => {
        const item = event.originalTarget;
        if (item?.type === "color") {
          this.updateRgba(item.value);
        }
        this.update(event);
      });
    }

    /** @this {MozColorboxClass} */
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }

      this.setAttribute("align", "center");
      this.appendChild(
        MozXULElement.parseXULToFragment(
          `
      <spacer flex="1" class="visible"></spacer>
      <html:input anonid="color" class="visible" palettename="standard" type="color" inherits="disabled"></html:input>
      <label value="[RGB]:" inherits="disabled"></label>
      <html:input anonid="red" class="rgbcontrol" inherits="disabled" maxlength="3" size="3" type="number" required="required" min="0" max="255"></html:input>
      <html:input anonid="green" class="rgbcontrol" inherits="disabled" maxlength="3" size="3" type="number" required="required" min="0" max="255"></html:input>
      <html:input anonid="blue" class="rgbcontrol" inherits="disabled" maxlength="3" size="3" type="number" required="required" min="0" max="255"></html:input>
      <label control="opacity" value="&opacity.label;[%]:" class="opacity" inherits="disabled"></label>
      <html:input anonid="opacity" class="opacity" inherits="disabled" maxlength="3" size="3" type="number" required="required" min="0" max="100"></html:input>
    `,
          [
            "chrome://tabmixplus/locale/pref-tabmix.dtd",
            "chrome://tabmixplus/locale/pref-appearance.dtd",
          ]
        )
      );
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();

      /** @type {StyleElement[]} */
      this._RGB = [];

      /** @typedef {"red" | "green" | "blue" | "opacity"} Colors */
      /** @type {Colors[]} */
      const colors = ["red", "green", "blue", "opacity"];
      colors.forEach(id => {
        this._RGB.push(this.getElementsByAttribute("anonid", id)[0]);
      });

      this._colorpicker = this.getElementsByAttribute("anonid", "color")[0];
      this._parent = this.closest("tabstylepanel");
    }

    /** @this {MozColorboxClass} */
    get rgba() {
      const lastIndex = this._RGB.length - 1;
      const rgba = this._RGB.map((c, i) => {
        return i < lastIndex ? parseInt(c.value) : parseInt(c.value) / 100;
      });
      return rgba;
    }

    /** @type {MozColorboxClass["updateRgba"]} */
    updateRgba(val) {
      // colorpicker use rgb hexadecimal format
      const color = val.replace("#", "");
      this._RGB.slice(0, -1).forEach((element, i) => {
        const subS = color.substr(i * 2, 2);
        element.value = String(parseInt(subS, 16));
      });
    }

    /** @this {MozColorboxClass} */
    set color(val) {
      const lastIndex = this._RGB.length - 1;
      const color = val.replace(/rgba|rgb|\(|\)/g, "").split(",");
      this._RGB.forEach((element, i) => {
        element.value =
          i < lastIndex ? (color[i] ?? "255") : String((parseFloat(color[i] ?? "1") || 1) * 100);
      });
      this.updateColor();
    }

    get color() {
      return this.getColor();
    }

    /** @type {MozColorboxClass["getColor"]} */
    getColor(format) {
      const rgba = this.rgba;
      if (format) {
        rgba[3] = this.getAttribute("disabled") ? 0.2 : Math.max(0.2, rgba[3] ?? 1);
      }
      return "rgba(#1)".replace("#1", rgba.join(","));
    }

    /** @this {MozColorboxClass} */
    updateColor() {
      const orig = this.getColor(true),
        rgbMatch = orig.replace(/\s/g, "").match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i);
      let hex = orig,
        a = "";
      if (rgbMatch) {
        /** @type [string, string, string, string, string] */ // @ts-expect-error
        const rgb = rgbMatch;
        a = (rgb[4] || "").trim();
        hex =
          (parseFloat(rgb[1]) | (1 << 8)).toString(16).slice(1) +
          (parseFloat(rgb[2]) | (1 << 8)).toString(16).slice(1) +
          (parseFloat(rgb[3]) | (1 << 8)).toString(16).slice(1);
      }
      this._colorpicker.value = "#" + hex;
      this._colorpicker.style.opacity = a;
    }

    /** @type {MozColorboxClass["update"]} */
    update(event) {
      this.updateColor();
      this._parent._savePrefs();
      event.stopPropagation();
    }
  }

  customElements.define("colorbox", MozColorbox);
}
