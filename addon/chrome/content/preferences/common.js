//var gCount = 0;
var firstPane = true;
var gCommon = {
  get pinTabLabel() {
    delete this.pinTabLabel;
    // firefox 18 (bug 769101) changed browser.dtd pinAppTab.label to pinTab.label
    let win = Tabmix.getTopWin();
    let label = win.document.getElementById("context_pinTab").getAttribute("label") + "/"
              + win.document.getElementById("context_unpinTab").getAttribute("label");
    return this.pinTabLabel = label;
  },

  incompatibleList: [],
  deinit: function() {
    if (document.documentElement.instantApply &&
        this._applyButton.userchangedWidth) {
      gAppearancePane.changeTabsWidth();
    }
    gIncompatiblePane.deinit();
//    window.removeEventListener("command", this.updateObservers, false);
//    window.removeEventListener("command", this, false);
    window.removeEventListener("change", this, false);
    if (!document.documentElement.instantApply) {
//      window.removeEventListener("change", this.updateApplyButton, false);
//      window.removeEventListener("change", this, false);
      window.removeEventListener("beforeaccept", this, false);
      delete Tabmix.getTopWin().tabmix_setSession;
    }
//    if ("gMousePane" in window)
//      gMousePane.deinit()
//    delete Tabmix.getTopWin().tabmix_setSession;
  },


//XXX not in use - we only need it if wee like to set new height
  // for links and session panels
  // we use this hack to hide the tabs at the to but leave the bottom border visible
  setTopMargin: function(aId) {
    let tabbox = $(aId + "-tabbox");
    let tabs = tabbox.firstChild;
//    let height = tabs.boxObject.height;
//    tabs.style.setProperty("height", height + "px", "");
    tabs.setAttribute("class", "tabs-hidden");
  },

  handleEvent: function(aEvent) {
    switch (aEvent.type) {
/*
      case "command":
        this.updateObservers(aEvent);
        break;
*/
      case "change":
        this.updateObservers(aEvent);
        if (!document.documentElement.instantApply)
          this.updateApplyButton(aEvent);
        break;
      case "beforeaccept":
//alert("beforeaccept");
        // prevent TMP_SessionStore.setService from runing
        if (!document.documentElement.instantApply)
          Tabmix.getTopWin().tabmix_setSession = true;
        break;
    }
  },

  updateObservers: function(aEvent) {
//try {
//   var item = aEvent.target;
   var item = $(aEvent.target.id.replace("pref_", ""));
//alert("updateObservers item.id " + item.id);
   if (item && item.localName == "checkbox" && $("obs_" + item.id))
     TM_Options.disabled(item);
//} catch (ex) {Tabmix.assert(ex);}
  },

  updateApplyButton: function(aEvent) {
try {
    var item = aEvent.target;
//Tabmix.log("item.localName " + item.localName + " " + (item.localName != "preference"));
    if (item.localName != "preference")
      return;
/*
    this._applyButton.value += item.value == item.valueFromPreferences ? -1 : 1;
Tabmix.log("name " + item.name
+"\nvalue " + item.value
+"\nvalueFromPreferences " + item.valueFromPreferences
+"\nthis._applyButton.value " + this._applyButton.value
);
    this._applyButton.disabled = this._applyButton.value <= 0;
*/
/*
    if (savedValue != newValue)
      applyData[pref] = newValue;
    else if (pref in applyData)
      delete applyData[pref];
*/
    let data = this._applyButton.data;
    let valueChanged = item.value != item.valueFromPreferences;
    let index = data.indexOf(item);
    if (valueChanged && index == -1)
      data.push(item);
    else if (!valueChanged && index > -1)
      data.splice(index, 1);
/*
Tabmix.log("name " + item.name
+"\nvalue " + item.value
+"\nvalueFromPreferences " + item.valueFromPreferences
+"\nthis._applyButton.data.length " + data.length + " " + data.join(", ")
);
*/
    this._applyButton.disabled = data.length == 0;

} catch(ex) {Tabmix.log(ex);}
  },

/// check if i need to use event.preventDefault / stop....
  onApply: function() {
    if (document.documentElement.instantApply &&
        this._applyButton.userchangedWidth) {
      gAppearancePane.changeTabsWidth();
      return;
    }
    // set flag to prevent TabmixTabbar.updateSettings from run for each change
    Tabmix.prefs.setBoolPref("setDefault", true);
    // Write all values to preferences.
    var preferences = this._applyButton.data;
    for (var i = 0; i < preferences.length; ++i) {
      var preference = preferences[i];
      preference.batching = true;
      preference.valueFromPreferences = preference.value;
      preference.batching = false;
    }
    Tabmix.prefs.clearUserPref("setDefault"); // this trigger TabmixTabbar.updateSettings
//    nsIPrefServiceObj.savePrefFile(null);
    Services.prefs.savePrefFile(null);
    this._applyButton.data = [];
    this._applyButton.disabled = true;
  },

/*
          var targetHeight = parseInt(window.getComputedStyle(this.content, "").height);
          targetHeight += parseInt(window.getComputedStyle(this.content, "").marginTop);
          targetHeight += parseInt(window.getComputedStyle(this.content, "").marginBottom);
          return targetHeight;
*/

//  XXXcontentWidth: function(aPaneElement) {

//XXX use Tabmix.getStyle(Obj, style)

  targetWidth: function(aPaneElement) {
    var targetWidth = parseInt(window.getComputedStyle(aPaneElement.content, "").width);
    targetWidth += parseInt(window.getComputedStyle(aPaneElement.content, "").marginRight);
    targetWidth += parseInt(window.getComputedStyle(aPaneElement.content, "").marginLeft);
    return targetWidth;
  },

  XXXsetPaneWidth: function(aPaneID) {
    var aPaneElement = $(aPaneID);
    var contentWidth = this.contentWidth(aPaneElement);
    var targetWidth = parseInt(window.getComputedStyle(document.documentElement._paneDeckContainer, "").width);
    var horizontalPadding = parseInt(window.getComputedStyle(aPaneElement, "").paddingRight);
    horizontalPadding += parseInt(window.getComputedStyle(aPaneElement, "").paddingLeft);
Tabmix.log(aPaneID + " contentWidth " + contentWidth
+"\ntargetWidth " + targetWidth
+"\nhorizontalPadding " + horizontalPadding
+"\ncontentWidth > targetWidth - horizontalPadding " + (contentWidth > targetWidth - horizontalPadding) + " " + contentWidth + " > " + (targetWidth - horizontalPadding)
);
    if (contentWidth > targetWidth - horizontalPadding) {
/*
      var bottomPadding = 0;
      var bottomBox = aPaneElement.getElementsByAttribute("class", "bottomBox")[0];
      if (bottomBox)
        bottomPadding = parseInt(window.getComputedStyle(bottomBox, "").paddingLeft);
      window.innerWidth += bottomPadding + horizontalPadding + contentWidth - targetWidth;
*/
Tabmix.log("set Width to " + (horizontalPadding + contentWidth - targetWidth))
      window.innerWidth += horizontalPadding + contentWidth - targetWidth;
    }
    if (this.contentWidth(aPaneElement) + horizontalPadding < targetWidth)
      aPaneElement.content.style.width = targetWidth - horizontalPadding + "px";
  },

  setPaneWidth: function(aPaneID) {
//return;

    var aPaneElement = $(aPaneID);
//    var anonymousNodes = document.getAnonymousElementByAttribute(aPaneElement, "class", "groupbox-body");
    var anonymousNodes = document.getAnonymousNodes(aPaneElement);
    var childs = [];
    for (let i = 0; i < anonymousNodes.length; i++) {
      childs.push(anonymousNodes[i].localName)
    }
    var childs1 = [];
    let contentWidth = document.getAnonymousElementByAttribute(aPaneElement, "class", "content-box").boxObject.width;
    let maxDiff = 0;
    anonymousNodes = aPaneElement.getElementsByTagName("tabbox");
    for (let i = 0; i < anonymousNodes.length; i++) {
      let tabboxWidth = anonymousNodes[i].boxObject.width;
      let diff = tabboxWidth - contentWidth;
      if (diff > 0 && diff > maxDiff)
        maxDiff = diff;
    }
    anonymousNodes = aPaneElement.getElementsByTagName("groupbox");
    for (let i = 0; i < anonymousNodes.length; i++) {
      let groupboxBody = document.getAnonymousElementByAttribute(anonymousNodes[i], "class", "groupbox-body");
      let width = anonymousNodes[i].boxObject.width;
      let bodyWidth = groupboxBody.boxObject.width;
      let diff = bodyWidth - width;
      if (diff > 0 && diff > maxDiff)
        maxDiff = diff;
      childs1.push("groupbox " + i + " width " +  width + " body width " + bodyWidth + " diff " + diff)
    }
    let innerWidth = window.innerWidth;
let currentTargetWidth = document.documentElement._paneDeckContainer.boxObject.width;
var targetWidth = parseInt(window.getComputedStyle(document.documentElement._paneDeckContainer, "").width);
    if (!firstPane && maxDiff)
{
alert("aPaneID " + aPaneID + " " + maxDiff);
      window.innerWidth = targetWidth + maxDiff;
}
    if (firstPane) {
      let innerHeight = window.innerHeight;
      sizeToContent();
      firstPane = false;
      window.innerHeight = innerHeight;
    }
/*
    Tabmix.log(aPaneID + "\ntotal childes " + childs.length
    + "\nchilds "  + childs.join("\n")
    + "\ninnerWidth " + innerWidth
    + "\nnew innerWidth " + window.innerWidth
    + "\ntargetWidth boxObject.width " + currentTargetWidth
    + "\ntargetWidth " + targetWidth
    + "\ntargetWidth new ComputedStyle " + parseInt(window.getComputedStyle(document.documentElement._paneDeckContainer, "").width)
    + "\nthis.contentWidth " + this.contentWidth
    + "\ntotal groupboxes "  + childs1.length + "\nmaxDiff " + maxDiff + "\n" + childs1.join("\n")
    );
*/
  },

  showIncompatibleList: function () {
    var outStr = "";
    for (var w in this.incompatibleList) {
      outStr += " - " + this.incompatibleList[w]._name + " " + this.incompatibleList[w]._version + "\n";
    }
    alert(outStr);
  }
}
