"use strict";

var list, entry, edit, del, add;

function Init()
{
   // set these once and refer to them later
   list = document.getElementById('filetypeList');
   entry = document.getElementById('filetypeEntry');
   edit = document.getElementById('filetypeEdit');
   del = document.getElementById('filetypeDelete');
   add = document.getElementById('filetypeAdd');

   FillData();
}

function FillData()
{
   //remove all the item from the list
   while(list.hasChildNodes()) {
    list.removeChild(list.lastChild);
   }

   var data, items, item;
   try {
      data = Services.prefs.getCharPref(list.getAttribute('prefstring'));
   }
   catch (e) {}

   if (!data.length) {
      setButtonDisable(del, true);
      return true;
   }

   items = data.split(' ');
   for (var i = 0; i < items.length; ++i) {
      if (items[i] === "") continue;
      item = items[i].trim();
      list.appendItem(item, item.toLowerCase());
   }

   list.selectedIndex = 0;
   list.focus();
   return true;
}

function Save()
{
   var filetype = [];
   for (var i = 0; i < list.getRowCount(); ++i)
      filetype.push(list.getItemAtIndex(i).getAttribute("label").trim());

   try {
      Services.prefs.setCharPref(list.getAttribute('prefstring'), filetype.join(" "));
   }
   catch (ex) {Tabmix.assert(ex, "error in filetype: " + filetype);}
   return true;
}

// sets the textbox to the currently selected item, if any
function Select()
{
   setButtonDisable(add, true);
   setButtonDisable(edit, true);

   if (!list.selectedItem) {
      setButtonDisable(del, true);
      return false;
   }
   entry.value = list.selectedItem.getAttribute("label");
   setButtonDisable(del, false);
   return true;
}

function Add()
{
   // check for data in the textbox
   if (!entry.value) return false;

   list.appendItem(entry.value, entry.value.toLowerCase());

   SelectItemAt(list.getRowCount()-1, true);
   setButtonDisable(del, false);
   return true;
}

function Mod()
{
   // check for data in the textbox
   if (!entry.value) return false;

   // make sure an item is selected, else create a new item
   if (!list.selectedItem) return Add();

   // change the text
   list.selectedItem.setAttribute("label", entry.value);
   list.selectedItem.setAttribute("value", entry.value.toLowerCase());
   SelectItemAt(list.getIndexOfItem(list.selectedItem), false);

   setButtonDisable(add, true);
   setButtonDisable(edit, true);
   return true;
}

function Input()
{
   if (!entry.value) {
      setButtonDisable(edit ,true);
      setButtonDisable(add ,true);
   } else {
      // chack if the input value is in the list
      var items = list.getElementsByAttribute("value", entry.value.toLowerCase());
      if (items.length > 0) {
         SelectItemAt(list.getIndexOfItem(items[0]), false);
         setButtonDisable(edit ,true);
         setButtonDisable(add ,true);
      } else {
         if (list.selectedItem) setButtonDisable(edit ,false);
         setButtonDisable(add ,false);
      }
   }
}

function Del()
{
   var item = list.selectedItem;
   if (!item) return;
   var index = list.getIndexOfItem(item);
   // if the list is not empty select next item or if we at the end the last item
   if (list.getRowCount() > 1)
      SelectItemAt(index == list.getRowCount() - 1  ? index - 1 : index + 1, true);
   else
      entry.value = null;
   list.removeChild(item);
}

function Restore()
{
   Save();
   var pref = "filetype";
   if (Tabmix.prefs.prefHasUserValue(pref))
     Tabmix.prefs.clearUserPref(pref);
   FillData();
}

// select new item and focus the list
function SelectItemAt(index, focus)
{
   list.ensureIndexIsVisible(index);
   list.selectedIndex = index;
   if (focus) list.focus();
}

function setButtonDisable(button, set)
{
   if (set) {
      button.setAttribute("disabled",true);
   } else {
      button.removeAttribute("disabled");
   }
}
