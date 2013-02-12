//var gCount = 0;
var firstPane = true;
var gCommon = {
  incompatibleList: [],
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
