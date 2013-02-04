var gMenuPane = {
  init: function () {
    gSetTabIndex.init('menu');

    $("pinTab").label = gCommon.pinTabLabel;
    $("togglePinTab").setAttribute("label", gCommon.pinTabLabel);

    var browserWindow = Tabmix.getTopWin();
    // check if bookmark item in tab context menu
    TM_Options.setItem("bmMenu", "hidden", !(browserWindow.document.getElementById("context_bookmarkAllTabs")));

    TM_Options.initUndoCloseBroadcaster();
    TM_Options.initSingleWindowBroadcaster();
    this.setInverseLinkLabel();

    Components.utils.import("resource://tabmixplus/Shortcuts.jsm");
    if (!Shortcuts.keys.browserReload.id)
      $("browserReload").hidden = true;
    this.initializeShortcuts();
    this.updateSessionShortcuts();

    gCommon.setPaneWidth("paneMenu");
  },

  initializeShortcuts: function() {
    if (Shortcuts.updatingShortcuts)
      return;

    let newValue = $("pref_shortcuts").value;
    let shortcuts = $("shortcut-group");
    if (newValue == shortcuts.value)
      return;
    shortcuts.value = newValue;
    shortcuts.keys = Tabmix.JSON.parse(newValue);
    let callBack = function(shortcut) shortcut.valueFromPreferences(Shortcuts.keys[shortcut.id]);
    this.updateShortcuts(shortcuts, callBack)
  },

  updateShortcuts: function (aShortcuts, aCallBack) {
    let boxes = Array.filter(aShortcuts.childNodes, aCallBack);
    $("shortcuts-panel").setAttribute("usedKeys", boxes.length > 0);
    if (typeof gEventsPane == "object")
      gEventsPane.syncSlideShowControl();
  },

  updateSessionShortcuts: function() {
    let block = !($("pref_sessionManager") || $("pref_sessionManager1")).value ||
        Shortcuts.permanentPrivateBrowsing;
    $("saveWindow").blocked = block;
    $("saveSession").blocked = block;
  },

  // for shortcuts panel
  toggleLinkLabel: function(item) {
    var panel = $("shortcuts-panel");
    var wasShow = panel.getAttribute(item.id) == 'false';
    item.value = item.getAttribute(wasShow ? 'show' : 'hide');
    panel.setAttribute(item.id, wasShow);
  },

  // update item showInverseLink label in menu pane
  // when "Links" in Events > Tab Focus changed
  setInverseLinkLabel: function() {
    var showInverseLink = $("showInverseLink");
    var val = ($("pref_selectTab") || $("pref_selectTab1")).value;
    var label = showInverseLink.getAttribute((val ? "bg" : "fg") + "label");
    showInverseLink.setAttribute("label", label);
  }
}
