Tabmix.setSanitizer = {
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
          try { Components.utils.reportError(ex); } catch(ex) {}
        }
      },
      get canClear() {
        return true;
      }
    }
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
      let prefName;
      let cpd = _item.getAttribute("preference").indexOf("privacy.cpd.") != -1;
      if (cpd)
        prefName = "privacy.cpd.extensions-tabmix";
      else
        prefName = "privacy.clearOnShutdown.extensions-tabmix";

      let pref = document.createElement("preference");
      pref.setAttribute("id", prefName);
      pref.setAttribute("name", prefName);
      pref.setAttribute("type", "bool");
      prefs.appendChild(pref);

      let check = document.createElement(itemList ? "listitem" : "checkbox");
      check.setAttribute("label", this._label);
      check.setAttribute("accesskey", this._accesskey);
      check.setAttribute("preference", prefName);
      check.setAttribute("oncommand", "Tabmix.setSanitizer.confirm(this);");
      if (TabmixSvc.prefs.prefHasUserValue(prefName))
        check.setAttribute("checked", TabmixSvc.prefs.getBoolPref(prefName));
      if (itemList) {
        check.setAttribute("type", "checkbox");
        check.setAttribute("noduration", "true");
        itemList.setAttribute("rows", "7");
      }
      _item.parentNode.insertBefore(check, null);

      if (typeof(gSanitizePromptDialog) == "object") {
        pref.setAttribute("readonly", "true");
        check.setAttribute("onsyncfrompreference", "return gSanitizePromptDialog.onReadGeneric();");
      }
    }
  },

  confirm: function (aCheckbox) {
    if (!aCheckbox.checked)
      return;

    var promptService = TabmixSvc.prompt;
    var title = "Tab Mix Plus - " + document.title;
    var msg = this._confirm;
    var buttonPressed = promptService.confirmEx(null,
                    title,
                    msg,
                    (promptService.BUTTON_TITLE_YES * promptService.BUTTON_POS_0)
                    + (promptService.BUTTON_TITLE_NO * promptService.BUTTON_POS_1),
                    null, null, null, null, {});
    if (buttonPressed == 1)
      aCheckbox.checked = false;
  }
}