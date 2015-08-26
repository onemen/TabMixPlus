"use strict";

this.EXPORTED_SYMBOLS = ["DynamicRules"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "TabmixSvc",
  "resource://tabmixplus/Services.jsm");

XPCOMUtils.defineLazyGetter(this, "Prefs", function () {
  return Services.prefs.getBranch("extensions.tabmix.styles.");
});

let TYPE;
XPCOMUtils.defineLazyGetter(this, "SSS", function () {
    let sss = Cc['@mozilla.org/content/style-sheet-service;1']
                        .getService(Ci.nsIStyleSheetService);
    TYPE = sss.AGENT_SHEET;
    return sss;
});

const NAMESPACE = '@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");\n';
const STYLENAMES = ["currentTab", "unloadedTab", "unreadTab", "otherTab", "progressMeter"];

this.DynamicRules = {

  // hold templets for our css rules
  cssTemplates: {},

  // hold the current state for each style according to its preference
  styles: {},

  // hold reference to registered style sheets
  registered: {},

  _initialized: false,

  init: function (aWindow) {
    if (this._initialized)
      return;
    this._initialized = true;

    this.treeStyleTab = aWindow.Tabmix.extensions.treeStyleTab;

    Prefs.addObserver("", this, false);
    STYLENAMES.forEach(function(pref){
      Services.prefs.addObserver("extensions.tabmix." + pref, this, false);
    }, this);
    Services.obs.addObserver(this, "quit-application", false);

    this.createTemplates();
    for (let rule of Object.keys(this.cssTemplates))
      this.userChangedStyle(rule);
  },

  observe: function(subject, topic, data) {
    switch (topic) {
      case "nsPref:changed":
        this.onPrefChange(data);
        break;
      case "quit-application":
        this.onQuitApplication();
        break;
    }
  },

  onPrefChange: function (data) {
    let prefName = data.split(".").pop();
    if (STYLENAMES.indexOf(prefName) > -1) {
      if (prefName == data)
        this.userChangedStyle(prefName, true);
      else
        this.registerSheet(prefName);
    }
  },

  onQuitApplication: function () {
    Services.obs.removeObserver(this, "quit-application");
    Prefs.removeObserver("", this);
    STYLENAMES.forEach(function(pref){
      Services.prefs.removeObserver("extensions.tabmix." + pref, this);
      this.unregisterSheet(pref);
    }, this);
  },

  updateOpenedWindows: function (ruleName) {
    // update all opened windows
    let windowsEnum = Services.wm.getEnumerator("navigator:browser");
    while (windowsEnum.hasMoreElements()) {
      let window = windowsEnum.getNext();
      if (!window.closed) {
        if (ruleName != "progressMeter")
          window.gTMPprefObserver.updateTabsStyle(ruleName);
        else
          window.gTMPprefObserver.setProgressMeter();
      }
    }
  },

  createTemplates: function () {
    // String.prototype.repeat available from Firefox 24.0
    let space20 = '                    ';
    let space26 = '                          ';
    let bgImage = { };
    bgImage.body = "linear-gradient(#topColor, #bottomColor)";
    let bottomBorder = "linear-gradient(to top, rgba(10%,10%,10%,.4) 1px, transparent 1px),\n";
    bgImage.bg = TabmixSvc.isMac ? bgImage.body : (bottomBorder + space20 + bgImage.body);
///XXX move -moz-appearance: to general rule when style have bg
    let backgroundRule = " {\n  -moz-appearance: none;\n  background-image: " + bgImage.bg + " !important;\n}\n";
    if (TabmixSvc.isMac) {
      backgroundRule = ' > .tab-stack > .tab-background >\n' +
        '      :-moz-any(.tab-background-start, .tab-background-middle, .tab-background-end)' + backgroundRule;
    }
    let tabTextRule = " .tab-text {\n  color: #textColor !important;\n}\n";

    let _selected = TabmixSvc.version(390) ? '[visuallyselected="true"]' : '[selected="true"]';
    let _notSelected = TabmixSvc.version(390) ? ':not([visuallyselected="true"])' : ':not([selected="true"])';
    let tabState = {
      current: _selected,
      unloaded: '[tabmix_tabState="unloaded"]' + _notSelected,
      unread: '[tabmix_tabState="unread"]' + _notSelected,
      other: ':not([tabmix_tabState])' + _notSelected,
    };

    let styleRules = {
      currentTab: {
        text: '#tabbrowser-tabs[tabmix_currentStyle~="text"] > .tabbrowser-tab' + tabState.current + tabTextRule,
        bg:   '#tabbrowser-tabs[tabmix_currentStyle~="bg"] > .tabbrowser-tab' + tabState.current + backgroundRule
      },
      unloadedTab: {
        text: '#tabbrowser-tabs[tabmix_unloadedStyle~="text"] > .tabbrowser-tab' + tabState.unloaded + tabTextRule,
        bg:   '#tabbrowser-tabs[tabmix_unloadedStyle~="bg"] > .tabbrowser-tab' + tabState.unloaded + backgroundRule
      },
      unreadTab: {
        text: '#tabbrowser-tabs[tabmix_unreadStyle~="text"] > .tabbrowser-tab' + tabState.unread + tabTextRule,
        bg:   '#tabbrowser-tabs[tabmix_unreadStyle~="bg"] > .tabbrowser-tab' + tabState.unread + backgroundRule
      },
      otherTab: {
        text: '#tabbrowser-tabs[tabmix_otherStyle~="text"] > .tabbrowser-tab' + tabState.other + tabTextRule,
        bg:   '#tabbrowser-tabs[tabmix_otherStyle~="bg"] > .tabbrowser-tab' + tabState.other + backgroundRule
      },
    };

    if (TabmixSvc.australis && !this.treeStyleTab) {
      bgImage.bg = 'url("chrome://browser/skin/customizableui/background-noise-toolbar.png"),\n' +
            space20 + bottomBorder +
            space20 + bgImage.body;
      bgImage.bgselected = 'url("chrome://browser/skin/tabbrowser/tab-active-middle.png"),\n' +
            space20 + bottomBorder +
            space20 + 'linear-gradient(transparent, transparent 2px, #topColor 2px, #bottomColor)';
      bgImage.startEndselected = bgImage.bgselected;
      bgImage.bghover = 'url("chrome://browser/skin/customizableui/background-noise-toolbar.png"),\n' +
            space20 + bottomBorder +
            space20 + 'linear-gradient(transparent, transparent 2px,\n' +
            space26 + 'rgba(254, 254, 254, 0.72) 2px, rgba(254, 254, 254, 0.72) 2px,\n' +
            space26 + 'rgba(250, 250, 250, 0.88) 3px, rgba(250, 250, 250, 0.88) 3px,\n' +
            space26 + 'rgba(254, 254, 254, 0.72) 4px, rgba(254, 254, 254, 0.72) 4px, #bottomColor)';
      bgImage.startEndhover = bgImage.bghover;
      let _selector = '#tabbrowser-tabs[tabmix_#RULEStyle~="bg"] > ' +
                      '.tabbrowser-tab#HOVER#STATE > .tab-stack > .tab-background >';
      for (let rule of Object.keys(styleRules)) {
        let style = styleRules[rule];
        delete style.bg;
        let styleName = rule.replace("Tab", "");
        let ruleSelector = _selector.replace("#RULE", styleName)
                                    .replace("#STATE", tabState[styleName]);
        let hover = rule == "currentTab" ? "" : ":hover";
        let selector = ruleSelector.replace("#HOVER", hover);
        let type = hover.replace(":", "") || "selected";
        style["bg" + type] =       selector + ' .tab-background-middle {\n' +
                                   '  background-image: ' + bgImage["bg" + type] + ' !important;\n}\n';
        style["startEnd" + type] = selector + ' :-moz-any(.tab-background-start, .tab-background-end)::before {\n' +
                                   '  background-image: ' + bgImage["startEnd" + type] + ' !important;\n}\n';
        if (hover) // i.e. not currentTab style
          style.bg = ruleSelector.replace("#HOVER", ":not(:hover)") + ' .tab-background-middle {\n' +
                        '  background-image: ' + bgImage.bg + ' !important;\n}\n';
      }
    }
    styleRules.progressMeter = {
      bg: '#tabbrowser-tabs[tabmix_progressMeter="userColor"] > .tabbrowser-tab > ' +
          '.tab-stack > .tab-progress-container > .tab-progress > ' +
          '.progress-bar {\n  background-color: #bottomColor !important;\n}\n'
    };

    this.cssTemplates = styleRules;
  },

  userChangedStyle: function (ruleName, notifyWindows) {
    if (ruleName in this && this[ruleName] == "preventUpdate")
      return;

    this[ruleName] = "preventUpdate";
    let prefObj = this.validatePrefValue(ruleName);
    delete this[ruleName];

    let val = TabmixSvc.tabStylePrefs[ruleName];
    TabmixSvc.tabStylePrefs[ruleName] = prefObj;

    if (ruleName == "progressMeter") {
      prefObj.text = false;
      prefObj.textColor = "";
      prefObj.bgTopColor = "";
    }

    // update styles on start or when user changed or enable color
    let changed = !val ||                                          // on start
                  prefObj.bg && (!val.bg ||                     // bgColor enabled
                    val.bgColor != prefObj.bgColor ||           // bgColor changed
                    val.bgTopColor != prefObj.bgTopColor) ||    // bgTopColor changed
                  prefObj.text && (!val.text ||                 // textColor enabled
                    val.textColor != prefObj.textColor);        // textColor changed

    if (changed)
      this.updateStyles(ruleName, prefObj);

    if (notifyWindows)
      this.updateOpenedWindows(ruleName);
  },

  updateStyles: function (name, prefObj) {
    if (this.treeStyleTab && name != "progressMeter")
      return;
    let templates = this.cssTemplates[name];
    let style = {};
    for (let rule of Object.keys(templates)) {
      let cssText = templates[rule];
      if (rule == "text") {
        if (prefObj.text)
          style[rule] = cssText.replace(/#textColor/g, prefObj.textColor);
      }
      else if (prefObj.bg)
          style[rule] = cssText.replace(/#bottomColor/g, prefObj.bgColor)
                               .replace(/#topColor/g, prefObj.bgTopColor);
    }
    this.styles[name] = Object.keys(style).length ? style : null;
    this.registerSheet(name);
  },

  /** create/update styleSheet for type of tab or progressMeter
   *  we get here in these cases
   *      - when we initialize this service
   *      - when user changed text or background color
   *      - when user disable/enable the sytle
   */
  registerSheet: function(name) {
    let enabled = TabmixSvc.prefBranch.getBoolPref(name);
    if (!enabled)
      return;

    let style = this.styles[name];
    if (!style)
      return;

    let cssText = NAMESPACE;
    for (let rule of Object.keys(style))
      cssText += "\n" + style[rule];
    let styleSheet = Services.io.newURI(
      "data:text/css," + encodeURIComponent(cssText), null, null);

    if (!SSS.sheetRegistered(styleSheet, TYPE)) {
      this.unregisterSheet(name);
      this.registered[name] = styleSheet;
      SSS.loadAndRegisterSheet(styleSheet, TYPE);
    }
  },

  unregisterSheet: function(name) {
    let styleShhet = this.registered[name] || null;
    if (styleShhet &&
        SSS.sheetRegistered(styleShhet, TYPE))
      SSS.unregisterSheet(styleShhet, TYPE);
  },

  get defaultPrefs() {
    delete this.defaultPrefs;
    let defaults = {};
    let getDefaultBranch = Services.prefs.getDefaultBranch("extensions.tabmix.styles.");
    STYLENAMES.forEach(function(pref){
      defaults[pref] = getDefaultBranch.getCharPref(pref);
    }, this);
    return (this.defaultPrefs = defaults);
  },

  validatePrefValue: function (ruleName) {
    // styles format: italic:boolean, bold:boolean, underline:boolean,
    //                text:boolean, textColor:string, textOpacity:string,
    //                bg:boolean, bgColor:string, bgOpacity:striung
    // if we don't catch the problem here it can break the rest of tabmix startup
    var defaultPrefValues = TabmixSvc.JSON.parse(this.defaultPrefs[ruleName]);
    if (!Prefs.prefHasUserValue(ruleName))
      return defaultPrefValues;

    var currentPrefValues, prefValues = {};
    let prefString = Prefs.getCharPref(ruleName);
    try {
      currentPrefValues = TabmixSvc.JSON.parse(prefString);
      if (currentPrefValues === null)
        throw Error(ruleName + " value is invalid\n" + prefString);
    }
    catch (ex) {
      TabmixSvc.console.log(ex);
      TabmixSvc.console.log('Error in preference "' + ruleName + '", value was reset to default');
      Prefs.clearUserPref(ruleName);
      // set prev value to default so we can continue with this function
      currentPrefValues = defaultPrefValues;
    }

    // make sure we have all the item
    // if item is missing set it to default
    for (let item in defaultPrefValues) {
      let value = currentPrefValues[item];
      if (value && item.indexOf("Color") > -1) {
        let opacity = item.replace("Color", "Opacity");
        let opacityValue = opacity in currentPrefValues ? currentPrefValues[opacity] : null;
        value = getRGBcolor(value, opacityValue);
      }
      else if (value !== undefined && typeof value != "boolean") {
        if (/^true$|^false$/.test(value.replace(/[\s]/g,"")))
          value = value == "true" ? true : false;
        else
          value = undefined;
      }
      if (value === undefined)
        prefValues[item] = item == "bgTopColor" ? prefValues["bgColor"] :
                                                  defaultPrefValues[item];
      else
        prefValues[item] = value;
    }
    let newPrefString = TabmixSvc.JSON.stringify(prefValues);
    if (prefString != newPrefString)
      Prefs.setCharPref(ruleName, newPrefString);

    return prefValues;
  }

};

// Converts a color string in the format "#RRGGBB" to rgba(r,g,b,a).
function getRGBcolor(aColorCode, aOpacity) {
  let newRGB = [];
  let _length = aColorCode.length;
  if (/^rgba|rgb/.test(aColorCode)) {
    newRGB = aColorCode.replace(/rgba|rgb|\(|\)/g,"").split(",").splice(0, 4);
    if (newRGB.length < 3)
      return null;
    for (let i = 0; i < newRGB.length; i++) {
      if (isNaN(newRGB[i].replace(/[\s]/g,"") * 1))
        return null;
    }
  }
  else if (/^#/.test(aColorCode) && _length == 4 || _length == 7) {
    aColorCode = aColorCode.replace("#","");
    let subLength = _length == 7 ? 2 : 1;
    for (let i = 0; i < 3; i++) {
      let subS = aColorCode.substr(i*subLength, subLength);
      if (_length == 4)
        subS += subS;
      var newNumber = parseInt(subS, 16);
      if (isNaN(newNumber))
        return null;
      newRGB.push(newNumber);
    }
  }
  else
    return null;

  if (aOpacity !== null)
    newRGB[3] = aOpacity;
  else if (newRGB[3] === undefined || newRGB[3] < 0 || newRGB[3] > 1)
    newRGB[3] = 1;
  return "rgba(" + newRGB.join(",") + ")";
}
