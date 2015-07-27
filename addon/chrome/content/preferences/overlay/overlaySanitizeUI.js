"use strict";

Tabmix.setSanitizer = {
  init: function () {
    this.isPromptDialog = typeof window.gSanitizePromptDialog == "object";
    this.addSanitizeItem();
    this.addMenuItem();
    if (this.isPromptDialog) {
      Tabmix.changeCode(gSanitizePromptDialog, "gSanitizePromptDialog.selectByTimespan")._replace(
        'if (this.selectedTimespan',
        'Tabmix.setSanitizer.disableMenuItem();\
         $&'
      ).toCode();
    }
  },

  addSanitizeItem: function () {
    if (typeof Sanitizer != 'function')
      return;
    // Sanitizer will execute this
    Sanitizer.prototype.items['extensions-tabmix'] = {
      clear : function() {
        try {
          let win = Tabmix.getTopWin();
          win.Tabmix.Sanitizer.sanitize();
        } catch (ex) {
          try {Tabmix.reportError(ex);} catch(e) { }
        }
      },
      get canClear() {
        // only sanitize when user selects to sanitize everything
        return !this.range;
      }
    };
  },

  addMenuItem: function () {
    var prefs = document.getElementsByTagName("preferences")[0];
    var _item;
    var itemList = document.getElementById("itemList");
    if (itemList)
      _item = itemList.lastChild;
    else {
      _item = document.getElementsByTagName("checkbox");
      _item = _item[_item.length - 1];
    }
    if (prefs && _item) {// if this isn't true we are lost :)
      let prefName, container = _item.parentNode;
      let cpd = _item.getAttribute("preference").indexOf("privacy.cpd.") != -1;
      if (cpd)
        prefName = this.prefName = "privacy.cpd.extensions-tabmix";
      else
        prefName = this.prefName = "privacy.clearOnShutdown.extensions-tabmix";

      let pref = document.createElement("preference");
      pref.setAttribute("id", prefName);
      pref.setAttribute("name", prefName);
      pref.setAttribute("type", "bool");
      prefs.appendChild(pref);

      let check = document.createElement(itemList ? "listitem" : "checkbox");
      check.setAttribute("id", "extensions-tabmix");
      check.setAttribute("label", this._label);
      check.setAttribute("accesskey", this._accesskey);
      check.setAttribute("preference", prefName);
      Tabmix.setItem(check, "oncommand", "Tabmix.setSanitizer.confirm(this);");
      if (Services.prefs.prefHasUserValue(prefName)) {
        this.checked = Services.prefs.getBoolPref(prefName);
        check.setAttribute("checked", this.checked);
      }
      if (itemList) {
        check.setAttribute("type", "checkbox");
        check.setAttribute("noduration", "true");
        itemList.setAttribute("rows", parseInt(itemList.getAttribute("rows")) + 1);
      }
      else if (container.childNodes.length > 1) {
        // don't add our checkbox to a row that already have 2 items
        let row = document.createElement("row");
        container.parentNode.appendChild(row);
        container = row;
      }
      container.appendChild(check);

      if (this.isPromptDialog) {
        Tabmix.setSanitizer.disableMenuItem();
        pref.setAttribute("readonly", "true");
        Tabmix.setItem(check, "onsyncfrompreference",
                           "Tabmix.setSanitizer.checked = this.checked; " +
                           "return gSanitizePromptDialog.onReadGeneric();");
      }
    }
  },

  checked: false,
  disableMenuItem: function () {
    let disabled = gSanitizePromptDialog.selectedTimespan !== Sanitizer.TIMESPAN_EVERYTHING;
    let checkbox = document.getElementById("extensions-tabmix");
    checkbox.setAttribute("disabled", disabled);
    if (this.checked) {
      checkbox.setAttribute("checked", !disabled);
      document.getElementById(this.prefName).disabled = disabled;
      gSanitizePromptDialog.onReadGeneric();
    }
  },

  confirm: function (aCheckbox) {
    if (!aCheckbox.checked)
      return;

    var promptService = Services.prompt;
    var title = "Tab Mix Plus - " + document.title;
    var msg = this._confirm;
    var buttonPressed = promptService.confirmEx(null,
                    title,
                    msg,
                    (promptService.BUTTON_TITLE_YES * promptService.BUTTON_POS_0) +
                    (promptService.BUTTON_TITLE_NO * promptService.BUTTON_POS_1),
                    null, null, null, null, {});
    if (buttonPressed == 1)
      aCheckbox.checked = false;
  }
};
