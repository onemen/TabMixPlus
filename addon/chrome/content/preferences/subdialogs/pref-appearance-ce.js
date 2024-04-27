/* eslint no-var: 2, prefer-const: 2 */
"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{
  class MozTabstylepanel extends customElements.get("tabpanels") {
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
    constructor() {
      super();

      this.addEventListener("command", () => {
        this._savePrefs();
      });
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }

      this.textContent = "";
      this.appendChild(MozXULElement.parseXULToFragment(`
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
    `, ["chrome://tabmixplus/locale/pref-tabmix.dtd", "chrome://tabmixplus/locale/pref-appearance.dtd"]));
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();

      this.setAttribute("orient", "vertical");

      this._item = null;

      this._initUseThisPref = null;

      this._initPrefValue = null;

      this._prefValues = null;

      let checked = Tabmix.prefs.getBoolPref(this.id);
      this._initUseThisPref = {prefvalue: checked, optionvalue: checked};
      this._initPrefValues = Tabmix.prefs.getCharPref(this.prefName);

      if (
        !Services.prefs.getBoolPref(
          "browser.preferences.instantApply",
          /Mac/.test(navigator.platform)
        )
      ) {
        this._item = window.opener && window.opener.document.getElementById("pref_" + this.id);
        if (this._item) {
          this._initUseThisPref.optionvalue = checked = this._item.value;
          Tabmix.prefs.setBoolPref(this.id, checked);
        }
      }

      const useThis = this._getElementById("useThis");
      useThis.checked = checked;
      this.disabled = !checked;

      this.disableBgColor = Tabmix.prefs.getBoolPref("disableBackground") &&
      this.id != "progressMeter";

      useThis.nextSibling.value = document.getElementById("_" + this.id).label;
      // colorpicker need some time until its ready
      window.setTimeout(() => this._getPrefs(this._initPrefValues), 0);

      const prefwindow = window.opener.document.querySelector("prefwindow");
      const button = document.querySelector('[dlgtype="extra1"]');
      prefwindow.setButtonLabel("help", button);

      if (Tabmix.isVersion(1080)) {
        document.documentElement.style.setProperty("--input-padding-inline", "2px");
        document.documentElement.style.setProperty("--input-sppiner-offset", "14px");
        document.documentElement.style.setProperty("minWidth", "510px");
      }
    }

    get prefName() {
      return 'styles.' + this.id;
    }

    set disabled(val) {
      if (val) {
        this.setAttribute("disabled", true);
      } else {
        this.removeAttribute("disabled");
      }
    }

    get disabled() {
      return this.getAttribute('disabled');
    }

    _getElementById(aID) {
      return this.getElementsByAttribute("anonid", aID)[0];
    }

    _updateUseThisState(aEnabled) {
      Tabmix.prefs.setBoolPref(this.id, aEnabled);
      this.disabled = !aEnabled;
      if ("text" in this._prefValues)
        this.updateDisableState("text");
      this.updateDisableState("bg");
    }

    _resetDefault(aResetOnlyStyle) {
      if (!aResetOnlyStyle && Tabmix.prefs.prefHasUserValue(this.id)) {
        const useThis = this._getElementById("useThis");
        useThis.checked = !useThis.checked;
        this._updateUseThisState(useThis.checked);
        this._initUseThisPref.prefvalue = this._initUseThisPref.optionvalue = useThis.checked;
      }

      Tabmix.prefs.clearUserPref(this.prefName);
      this._initPrefValues = Tabmix.prefs.getCharPref(this.prefName);
      this._getPrefs(this._initPrefValues);
    }

    _getPrefs(aPrefString) {
      try {
        this._prefValues = JSON.parse(aPrefString);
      } catch {
        this._resetDefault(true);
        return;
      }

      for (const _id of Object.keys(this._prefValues)) {
        const item = this._getElementById(_id);
        switch (item && item.localName) {
          case "checkbox":
          case "checkbox_tmp":
            item.checked = this._prefValues[_id];
            break;
          case "colorbox":
            item.color = this._prefValues[_id];
        }
      }

      if ("text" in this._prefValues)
        this.updateDisableState("text");
      this.updateDisableState("bg");
    }

    _savePrefs() {
      const newPrefSValue = {};
      for (const _id of Object.keys(this._prefValues)) {
        const item = this._getElementById(_id);
        switch (item.localName) {
          case "checkbox":
          case "checkbox_tmp":
            newPrefSValue[_id] = item.checked;
            break;
          case "colorbox":
            newPrefSValue[_id] = item.color;
            break;
        }
      }
      Tabmix.prefs.setCharPref(this.prefName, JSON.stringify(newPrefSValue));
    }

    _ondialogcancel() {
      Tabmix.prefs.setCharPref(this.prefName, this._initPrefValues);
      Tabmix.prefs.setBoolPref(this.id, this._initUseThisPref.prefvalue);
      if (this._item)
        this._item.value = this._initUseThisPref.optionvalue;
    }

    updateDisableState(aID) {
      const disableBg = this.disableBgColor && aID == "bg";
      const disabled = this.disabled || disableBg ||
      !this._getElementById(aID).checked;
      if (disableBg)
        this._getElementById("bg").disabled = true;
      Tabmix.setItem(this, aID + "-disabled", disabled || null);
      this._getElementById(aID + "Color").updateColor();
      if (aID == "bg")
        this._getElementById("bgTopColor").updateColor();
    }
  }

  customElements.define("tabstylepanel", MozTabstylepanel);

  class MozColorbox extends MozXULElement {
    static get inheritedAttributes() {
      return {
        "[anonid=\"color\"]": "disabled",
        "label[value=\"[RGB]:\"]": "disabled",
        "[anonid=\"red\"]": "disabled",
        "[anonid=\"green\"]": "disabled",
        "[anonid=\"blue\"]": "disabled",
        "label.opacity": "disabled",
        "[anonid=\"opacity\"]": "disabled",
      };
    }

    constructor() {
      super();

      this.addEventListener("change", event => {
        const item = event.originalTarget;
        if (item.type == "color") {
        // colorpicker use rgb hexadecimal format
          const color = item.value.replace("#", "");
          for (let i = 0; i < 3; i++) {
            const subS = color.substr(i * 2, 2);
            this._RGB[i].value = parseInt(subS, 16);
          }
        }
        this.update(event);
      });

      this.addEventListener("input", event => {
        if (event.originalTarget?.type != "color") {
          this.update(event);
        }
      });
    }

    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }

      this.setAttribute("align", "center");
      this.appendChild(MozXULElement.parseXULToFragment(`
      <spacer flex="1" class="visible"></spacer>
      <html:input anonid="color" class="visible" palettename="standard" type="color" inherits="disabled"></html:input>
      <label value="[RGB]:" inherits="disabled"></label>
      <html:input anonid="red" class="rgbcontrol" inherits="disabled" maxlength="3" size="3" type="number" required="required" min="0" max="255"></html:input>
      <html:input anonid="green" class="rgbcontrol" inherits="disabled" maxlength="3" size="3" type="number" required="required" min="0" max="255"></html:input>
      <html:input anonid="blue" class="rgbcontrol" inherits="disabled" maxlength="3" size="3" type="number" required="required" min="0" max="255"></html:input>
      <label control="opacity" value="&opacity.label;[%]:" class="opacity" inherits="disabled"></label>
      <html:input anonid="opacity" class="opacity" inherits="disabled" maxlength="3" size="3" type="number" required="required" min="0" max="100"></html:input>
    `, ["chrome://tabmixplus/locale/pref-tabmix.dtd", "chrome://tabmixplus/locale/pref-appearance.dtd"]));
      // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!
      this.initializeAttributeInheritance();

      this._RGB = [];

      this._colorpicker = null;

      this._parent = null;

      ["red", "green", "blue", "opacity"].forEach(function(id) {
        this._RGB.push(this.getElementsByAttribute("anonid", id)[0]);
      }, this);

      this._colorpicker = this.getElementsByAttribute("anonid", "color")[0];
      this._parent = this.parentNode.parentNode;
    }

    get rgba() {
      const rgba = this._RGB.map(c => parseInt(c.value));
      rgba[3] /= 100;
      return rgba;
    }

    set color(val) {
      const color = val.replace(/rgba|rgb|\(|\)/g, "").split(",");
      for (let i = 0; i < 3; i++)
        this._RGB[i].value = color[i];
      this._RGB[3].value = (color[3] || 1) * 100;
      this.updateColor();
    }

    get color() {
      return this.getColor();
    }

    getColor(format) {
      const rgba = this.rgba;
      if (format) {
        rgba[3] = this.getAttribute("disabled") ? 0.2 : Math.max(0.2, rgba[3]);
      }
      return "rgba(#1)".replace("#1", rgba.join(","));
    }

    updateColor() {
      const orig = this.getColor(true),
            rgb = orig.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i),
            a = (rgb && rgb[4] || "").trim(),
            hex = rgb ?
              (rgb[1] | 1 << 8).toString(16).slice(1) +
      (rgb[2] | 1 << 8).toString(16).slice(1) +
      (rgb[3] | 1 << 8).toString(16).slice(1) : orig;

      this._colorpicker.value = "#" + hex;
      this._colorpicker.style.opacity = a;
    }

    update(event) {
      this.updateColor();
      this._parent._savePrefs();
      event.stopPropagation();
    }
  }

  customElements.define("colorbox", MozColorbox);
}
