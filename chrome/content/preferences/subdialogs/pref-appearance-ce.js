/* This Source Code Form is subject to the terms of the Mozilla Public
  * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{

class MozTabstylepanel extends customElements.get("tabpanels") {
  static get inheritedAttributes() {
    return {
      "hbox:nth-of-type(2)": "_hidebox",
      "#italic": "disabled",
      "#bold": "disabled",
      "#underline": "disabled",
      "#textColor": "disabled=text-disabled,_hidebox",
      "#text": "disabled",
      "#bg": "disabled",
      "#bgTopColor": "disabled=bg-disabled,hidden=_hidebox",
      "#bgTopColor > label": "disabled=bg-disabled",
      "#bgColor": "disabled=bg-disabled",
      "#bgColor > label": "disabled=bg-disabled,_hidebox",
    };
  }
  constructor() {
    super();

    this.addEventListener("command", (event) => {
      this._savePrefs();
    });

  }

  connectedCallback() {
    if (this.delayConnectedCallback()) {
      return;
    }
    
    this.attachShadow({ mode: "open" });
    this.textContent = "";
    this.shadowRoot.appendChild(MozXULElement.parseXULToFragment(`
      <hbox align="center">
        <checkbox id="useThis" label="&useThis.label;: " oncommand="this.getRootNode().host._updateUseThisState(this.checked); event.stopPropagation();"></checkbox>
        <label style="font-weight: bold;"></label>
      </hbox>
      <separator class="groove"></separator>
      <hbox align="center" style="height: 28px;" inherits="_hidebox">
        <checkbox id="italic" inherits="disabled" label="&italic.label;" style="font-style: italic;"></checkbox>
        <checkbox id="bold" inherits="disabled" label="&bold.label;" style="font-weight: bold;"></checkbox>
        <checkbox id="underline" class="tabStyles_underline" inherits="disabled" label="&underline.label;"></checkbox>
      </hbox>
      <hbox flex="1">
        <vbox>
          <colorbox id="textColor" inherits="disabled=text-disabled,_hidebox">
            <checkbox id="text" class="visible" inherits="disabled" label="&textcolor.label;:" oncommand="this.getRootNode().host.updateDisableState(this.getAttribute('id'))"></checkbox>
          </colorbox>
          <checkbox_tmp id="bg" inherits="disabled" label="&bgColor.label;:" oncommand="this.getRootNode().host.updateDisableState(this.getAttribute('id'))"></checkbox_tmp>
          <colorbox id="bgTopColor" class="bgTop" inherits="disabled=bg-disabled,hidden=_hidebox">
            <label value="&bgTopColor.label;:" class="visible" inherits="disabled=bg-disabled"></label>
          </colorbox>
          <colorbox id="bgColor" class="bgBottom" inherits="disabled=bg-disabled">
            <label value="&bgBottomColor.label;:" class="visible" inherits="disabled=bg-disabled,_hidebox"></label>
          </colorbox>
        </vbox>
        <spacer flex="1"></spacer>
      </hbox>
      <separator class="groove"></separator>
      <hbox align="center">
        <button label="&settings.default;" oncommand="this.getRootNode().host._resetDefault();"></button>
      </hbox>
    `,["chrome://tabmixplus/locale/pref-tabmix.dtd","chrome://tabmixplus/locale/pref-appearance.dtd"]));
    // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

    this.setAttribute("orient","vertical");

    this._item = null;

    this._initUseThisPref = null;

    this._initPrefValue = null;

    this._prefValues = null;

    var checked = Tabmix.prefs.getBoolPref(this.id);
    this._initUseThisPref = { prefvalue: checked, optionvalue: checked };
    this._initPrefValues = Tabmix.prefs.getCharPref(this.prefName);

    if (!Services.prefs.getBoolPref("browser.preferences.instantApply")) {
      this._item = window.opener &&
        window.opener.document.getElementById("pref_" + this.id);
      if (this._item) {
        this._initUseThisPref.optionvalue = checked = this._item.value;
        Tabmix.prefs.setBoolPref(this.id, checked);
      }
    }

    var useThis = this._getElementById("useThis");
    useThis.checked = checked;
    this.disabled = !checked;

    this.disableBgColor = Tabmix.prefs.getBoolPref("disableBackground") &&
      this.id != "progressMeter";

    useThis.nextSibling.value = document.getElementById("_" + this.id).label;
    // colorpicker need some time until its ready
    window.setTimeout(() => this._getPrefs(this._initPrefValues), 0);

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
    return this.shadowRoot.getElementById(aID);
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
      var useThis = this._getElementById("useThis");
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
      this._prefValues = TabmixSvc.JSON.parse(aPrefString);
    } catch (er) {
      this._resetDefault(true);
      return;
    }

    for (let _id of Object.keys(this._prefValues)) {
      var item = this._getElementById(_id);
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
    var newPrefSValue = {};
    for (let _id of Object.keys(this._prefValues)) {
      var item = this._getElementById(_id);
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
    Tabmix.prefs.setCharPref(this.prefName, TabmixSvc.JSON.stringify(newPrefSValue));
  }

  _ondialogcancel() {
    Tabmix.prefs.setCharPref(this.prefName, this._initPrefValues);
    Tabmix.prefs.setBoolPref(this.id, this._initUseThisPref.prefvalue);
    if (this._item)
      this._item.value = this._initUseThisPref.optionvalue;
  }

  updateDisableState(aID) {
    var disableBg = this.disableBgColor && aID == "bg";
    var disabled = this.disabled || disableBg ||
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
      "[inherits='disabled']": "disabled",
    };
  }

  constructor() {
    super();

    this.addEventListener("change", (event) => {
      var item = event.originalTarget;
      if (item.localName == "colorpicker") {
        // colorpicker use rgb hexadecimal format
        let color = item.color.replace("#", "");
        for (let i = 0; i < 3; i++) {
          let subS = color.substr(i * 2, 2);
          this._RGB[i].value = parseInt(subS, 16);
        }
      }
      this.update(event);
    });

    this.addEventListener("input", (event) => { this.update(event); });

  }

  connectedCallback() {
    if (this.delayConnectedCallback()) {
      return;
    }
    // this.textContent = "";
    // let childNodes = [...this.childNodes];
    // this.appendChild(...childNodes);
    this.appendChild(MozXULElement.parseXULToFragment(`
      <spacer flex="1" class="visible"></spacer>
      <colorpicker anonid="color" class="visible" palettename="standard" type="button" inherits="disabled"></colorpicker>
      <label value="[RGB]:" inherits="disabled"></label>
      <html:input anonid="red" class="rgbcontrol" inherits="disabled" maxlength="3" size="1" type="number" min="0" max="255"></html:input>
      <html:input anonid="green" class="rgbcontrol" inherits="disabled" maxlength="3" size="1" type="number" min="0" max="255"></html:input>
      <html:input anonid="blue" class="rgbcontrol" inherits="disabled" maxlength="3" size="1" type="number" min="0" max="255"></html:input>
      <label control="opacity" value="&opacity.label;[%]:" class="opacity" inherits="disabled"></label>
      <html:input anonid="opacity" class="opacity" inherits="disabled" maxlength="3" size="1" type="number" min="0" max="100"></html:input>
    `,["chrome://tabmixplus/locale/pref-tabmix.dtd","chrome://tabmixplus/locale/pref-appearance.dtd"]));
    // XXX: Implement `this.inheritAttribute()` for the [inherits] attribute in the markup above!

    this._RGB = [];

    this._colorpicker = null;

    this._parent = null;

    ["red", "green", "blue", "opacity"].forEach(function(id) {
      this._RGB.push(this.getElementsByAttribute("anonid", id)[0]);
    }, this);

    this._colorpicker = this.getElementsByAttribute("anonid", "color")[0];
    this._parent = this.getRootNode().host;

  }

  get rgba() {
    var rgba = this._RGB.map(c => parseInt(c.value));
    rgba[3] /= 100;
    return rgba;
  }

  set color(val) {
    var color = val.replace(/rgba|rgb|\(|\)/g, "").split(",");
    for (let i = 0; i < 3; i++)
      this._RGB[i].value = color[i];
    this._RGB[3].value = (color[3] || 1) * 100;
    this.updateColor();
  }

  get color() {
    return this.getColor();
  }

  getColor(format) {
    var rgba = this.rgba;
    if (format) {
      rgba[3] = this.getAttribute("disabled") ? 0.2 : Math.max(0.2, rgba[3]);
    }
    return "rgba(#1)".replace("#1", rgba.join(","));
  }

  updateColor() {
    this._colorpicker.color = this.getColor(true);
  }

  update(event) {
    this.updateColor();
    this._parent._savePrefs();
    event.stopPropagation();
  }
}

customElements.define("colorbox", MozColorbox);

}
