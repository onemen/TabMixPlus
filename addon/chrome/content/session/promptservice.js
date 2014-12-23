"use strict";

   const TMP_BUTTON_OK = 0;
   const TMP_BUTTON_CANCEL = 1;
   const TMP_BUTTON_EXTRA1 = 2;
   const TMP_SHOW_MENULIST = 1;
   const TMP_SHOW_TEXTBOX = 0;
   const TMP_HIDE_MENUANDTEXT = 2;
   const TMP_CHECKBOX_UNCHECKED = 0;
   const TMP_CHECKBOX_CHECKED = 1;
   const TMP_HIDE_CHECKBOX = 2;
   const TMP_SELECT_DEFAULT = 0;
   const TMP_SELECT_LASTSESSION = 1;
   const TMP_SELECT_CRASH = 2;
   const TMP_SHOW_CLOSED_WINDOW_LIST = 3;
   const TMP_DLG_SAVE = 0;
   const TMP_DLG_RENAME = 1;

   var dialogParams, gHideElmParam, gSavedName, gCancelLabel, gOrigName;

   function prompt_init() {
      dialogParams = window.arguments[0].QueryInterface(Components.interfaces.nsIDialogParamBlock);
      document.title = dialogParams.GetString(0);

      // display the main text
      var i, messageText = dialogParams.GetString(1);
      var messageParent = document.getElementById("tm_info");
      var messageParagraphs = messageText.split("\n");
      gHideElmParam = dialogParams.GetInt(1);
      for (i = 0; i < messageParagraphs.length; i++) {
         var descriptionNode = document.createElement("description");
         var text = document.createTextNode(messageParagraphs[i]);
         descriptionNode.appendChild(text);
         messageParent.appendChild(descriptionNode);
      }

      // display the menulist
      gHideElmParam = dialogParams.GetInt(1);
      var menuList = document.getElementById("tm_prompt");
      if (gHideElmParam == TMP_SHOW_MENULIST) {
         var index, isDisabled, popup = document.getElementById("tm_prompt_menu");
         if (dialogParams.GetInt(4) == 1)
           window.opener.Tabmix.Sessions.createMenuForDialog(popup, dialogParams.GetInt(3));
         else
           window.opener.TabmixSessionManager.createMenuForDialog(popup, dialogParams.GetInt(3));
         switch ( dialogParams.GetInt(3) ) {
            case TMP_SELECT_CRASH: index = popup.childNodes.length - 1;
               break;
            case TMP_SHOW_CLOSED_WINDOW_LIST: index = 1; // 0 is menuseparator
               break;
            default:
               index = menuList.defaultIndex;
               if (index >= popup.childNodes.length || index < 0) index = 1;
               isDisabled = popup.childNodes[index].getAttribute("disabled") == "true";
               // select the first entry that isn't menuseparator and not "disabled"
               if (!isDisabled) break;
               var item;
               for (i = 1; i < popup.childNodes.length; ++i) {
                  item = popup.childNodes[i];
                  if (item.localName == "menuseparator") continue;
                  if (item.getAttribute("disabled") != "true") {
                     index = i;
                     break;
                  }
               }
         }
         menuList.selectedIndex = index;
      } else menuList.hidden = true;

      // display the textBox
      var textBox = document.getElementById("tm_textbox");
      if (gHideElmParam == TMP_SHOW_TEXTBOX) {
         messageParent.lastChild.setAttribute("style","height:3em");
         gSavedName = dialogParams.GetString(2).split("\n");
         textBox.value = gSavedName.shift();
         gOrigName = textBox.value.toLowerCase();
      }
      else textBox.hidden = true;

      // display the checkbox
      var checkBox = document.getElementById("tm_checkbox");
      var check = dialogParams.GetInt(2);
      if (check != TMP_HIDE_CHECKBOX) {
         document.getElementById("checkboxContainer").removeAttribute("collapsed");
         checkBox.checked = check == TMP_CHECKBOX_CHECKED;
         setLabelForNode(checkBox, dialogParams.GetString(3));
      }

      // display the command buttons
      var aButtons, buttons = ["accept", "cancel", "extra1"];
      var btnLabels = dialogParams.GetString(4).split("\n");
      for (i = 0; i < buttons.length; ++i) {
         aButtons = document.documentElement.getButton(buttons[i]);
         if (i < btnLabels.length && btnLabels[i] !== "") {
            setLabelForNode(aButtons, btnLabels[i]);
         }
         else aButtons.hidden = true; // hide extra button
      }

      // Set and focus default button
      var dButton = buttons[dialogParams.GetInt(0)];
      var dialog = document.documentElement;
      dialog.defaultButton = dButton;
      if (gHideElmParam == TMP_HIDE_MENUANDTEXT) { // hide menulist & text box and set focus to default Button
         document.getElementById("space_befor_checkbox").hidden = true;
         dialog.getButton(dButton).focus();
      }

      if (gHideElmParam == TMP_SHOW_TEXTBOX) {
         dialog.getButton("extra1").hidden = true;
         gCancelLabel = dialog.getButton("cancel").label;
         inputText(textBox);
      }

      // Move to the right location
      moveToAlertPosition();
      centerWindowOnScreen();
   }

   function prompt_deinit(button) {
      dialogParams.SetInt(4, button); // ok = 0; cancel = 1; extra1 = 2;
      dialogParams.SetInt(5, document.getElementById("tm_checkbox").checked);
      if (gHideElmParam < TMP_HIDE_MENUANDTEXT) {
         if (gHideElmParam == TMP_SHOW_MENULIST) {
            var item = document.getElementById("tm_prompt").selectedItem;
///XXX item.fileName - in the new Tabmix.Sessions
            dialogParams.SetString(5, item.session || item.fileName);
            dialogParams.SetInt(6, item.getAttribute("value"));
         }
         else dialogParams.SetString(5, document.getElementById("tm_textbox").value);
      }
      // if we are not a modal use a callback function
      if (typeof window._callBackFunction == "function") {
        if (window.opener && !window.opener.closed) {
          let returnData  = {button: dialogParams.GetInt(4),
                             checked: (dialogParams.GetInt(5) == TMP_CHECKBOX_CHECKED),
                             label: dialogParams.GetString(5),
                             value: dialogParams.GetInt(6)};
          try {
            window._callBackFunction(returnData);
          } catch (ex) {Tabmix.assert(ex, "error in callback " + window._callBackFunction.name);}
        }
        window._callBackFunction = null;
      }
   }

   function prompt_extra1(button) {
      prompt_deinit(button);
      window.close();
   }

   // copy from commonDialog.js
   function setLabelForNode(aNode, aLabel, aIsLabelFlag) {
     var accessKey = null;
     if (/ *\(\&([^&])\)(:?)$/.test(aLabel)) {
       aLabel = RegExp.leftContext + RegExp.$2;
       accessKey = RegExp.$1;
     } else if (/^([^&]*)\&(([^&]).*$)/.test(aLabel)) {
       aLabel = RegExp.$1 + RegExp.$2;
       accessKey = RegExp.$3;
     }

     // && is the magic sequence to embed an & in your label.
     aLabel = aLabel.replace(/\&\&/g, "&");
     if (aIsLabelFlag) {    // Set text for <label> element
       aNode.setAttribute("value", aLabel);
     } else {    // Set text for other xul elements
       aNode.label = aLabel;
     }

     // Need to set this after aNode.setAttribute("value", aLabel);
     if (accessKey)
       aNode.accessKey = accessKey;
   }

   function inputText(textBox) {
      var btnOK = document.documentElement.getButton("accept");
      var btnCancel = document.documentElement.getButton("cancel");
      var btnExt = document.documentElement.getButton("extra1");
      var msg = [];
      msg[0] = "";
      /**
      var msg1 = "Name must be at least one letter or number."
      var msg2 = "This name already in use!"
      var msg3 = "Are you sure you want to replace the session?"
      var cLabel = "&Don't Replace";
      */
      msg[1] = TabmixSvc.getSMString("sm.sessionName.msg1");
      msg[2] = TabmixSvc.getSMString("sm.sessionName.msg2");
      msg[3] = msg[2] + ", " + TabmixSvc.getSMString("sm.sessionName.msg3");
      var cLabel = TabmixSvc.setLabel("sm.replaceStartup.button1");

      var description = document.getElementById("tm_info").lastChild.firstChild;
      textBox.value = textBox.value.replace(/^[\s]+/g,"");
      var name = textBox.value.toLowerCase();
      var validName = 0;
      if (name === "") validName = 1;
      if (validName === 0) {
         for (var i = 0; i < gSavedName.length; i++) {
            if (name == gSavedName[i].toLowerCase() && gSavedName[i] !== "" ) {
               if (dialogParams.GetInt(3) == TMP_DLG_RENAME) {
                  if (gOrigName != name) validName = 2;
                  continue;
               }
               validName = 3;
               dialogParams.SetInt(6, i);
               break;
            }
         }
      }
      switch ( validName ) {
         case 0:
            if (btnOK.disabled) btnOK.disabled = false;
            if (btnOK.hidden) btnOK.hidden = false;
            if (!btnExt.hidden) {
               btnExt.hidden = true;
               if (dialogParams.GetInt(3) == TMP_DLG_SAVE) setLabelForNode(btnCancel,gCancelLabel);
            }
            description.replaceData(0,description.length, "");
            document.documentElement.defaultButton = "accept";
            break;
         case 1:
         case 2:
            if (btnOK.hidden) btnOK.hidden = false;
            if (!btnOK.disabled) btnOK.disabled = true;
            if (!btnExt.hidden) {
               btnExt.hidden = true;
               if (dialogParams.GetInt(3) == TMP_DLG_SAVE) setLabelForNode(btnCancel,gCancelLabel);
            }
            document.documentElement.defaultButton = "cancel";
            break;
         case 3:
            if (!btnOK.hidden) btnOK.hidden = true;
            btnExt.hidden = false;
            if (dialogParams.GetInt(3) == TMP_DLG_SAVE) setLabelForNode(btnCancel,cLabel);
            document.documentElement.defaultButton = "cancel";
            break;
      }
      description.replaceData(0,description.length, msg[validName]);
   }
