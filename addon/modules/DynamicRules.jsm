"use strict";

const EXPORTED_SYMBOLS = ["DynamicRules"];

const Services = globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;
const {XPCOMUtils} = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

const lazy = {};

ChromeUtils.defineModuleGetter(lazy, "TabmixSvc",
  "chrome://tabmix-resource/content/TabmixSvc.jsm");

XPCOMUtils.defineLazyGetter(lazy, "Prefs", () => {
  return Services.prefs.getBranch("extensions.tabmix.styles.");
});

var TYPE;
XPCOMUtils.defineLazyGetter(lazy, "SSS", () => {
  let sss = Cc['@mozilla.org/content/style-sheet-service;1']
      .getService(Ci.nsIStyleSheetService);
  TYPE = sss.USER_SHEET;
  return sss;
});

XPCOMUtils.defineLazyGetter(lazy, "isMac", () => {
  return lazy.TabmixSvc.isMac;
});

const STYLENAMES = ["currentTab", "unloadedTab", "unreadTab", "otherTab", "progressMeter"];

const DynamicRules = {

  // hold templates for our css rules
  cssTemplates: {},

  // hold the current state for each style according to its preference
  styles: {},

  // hold reference to registered style sheets
  registered: {},

  _initialized: false,

  init(aWindow) {
    if (this._initialized)
      return;
    this._initialized = true;

    this.orient = aWindow.document.getElementById("tabbrowser-tabs").attributes.orient.value;
    this.windows10 = aWindow.navigator.oscpu.startsWith("Windows NT 10.0");

    lazy.Prefs.addObserver("", this);
    STYLENAMES.forEach(function(pref) {
      Services.prefs.addObserver("extensions.tabmix." + pref, this);
    }, this);
    Services.obs.addObserver(this, "browser-window-before-show");
    Services.obs.addObserver(this, "quit-application");

    this.createTemplates();
  },

  observe(subject, topic, data) {
    switch (topic) {
      case "browser-window-before-show":
        this.registerMutationObserver(subject);
        break;
      case "nsPref:changed":
        this.onPrefChange(data);
        break;
      case "quit-application":
        this.onQuitApplication();
        break;
    }
  },

  registerMutationObserver(window) {
    const tabsMutate = aMutations => {
      for (let mutation of aMutations) {
        if (mutation.attributeName == "orient") {
          this.orient = mutation.target.orient || mutation.target.attributes.orient.value;
          this.updateStyleType();
          return;
        }
      }
    };
    let Observer = new window.MutationObserver(tabsMutate);
    Observer.observe(window.gBrowser.tabContainer, {attributes: true});
    window.addEventListener("unload", function unload() {
      Observer.disconnect();
    }, {once: true});
  },

  onPrefChange(data) {
    let prefName = data.split(".").pop();
    if (STYLENAMES.indexOf(prefName) > -1) {
      if (prefName == data)
        this.userChangedStyle(prefName, true);
      else
        this.registerSheet(prefName);
    }
  },

  onQuitApplication() {
    Services.obs.removeObserver(this, "browser-window-before-show");
    Services.obs.removeObserver(this, "quit-application");
    lazy.Prefs.removeObserver("", this);
    STYLENAMES.forEach(function(pref) {
      Services.prefs.removeObserver("extensions.tabmix." + pref, this);
      this.unregisterSheet(pref);
    }, this);
  },

  updateOpenedWindows(ruleName) {
    // update all opened windows
    lazy.TabmixSvc.forEachBrowserWindow(window => {
      if (ruleName != "progressMeter")
        window.gTMPprefObserver.updateTabsStyle(ruleName);
      else
        window.gTMPprefObserver.setProgressMeter();
    });
  },

  createTemplates() {
    let space20 = ' '.repeat(20);
    let bgImage = {};
    bgImage.body = "linear-gradient(#topColor, #bottomColor)";
    let bottomBorder = "linear-gradient(to top, rgba(10%,10%,10%,.4) 1px, transparent 1px),\n";
    bgImage.bg = lazy.isMac ? bgImage.body : bottomBorder + space20 + bgImage.body;
    ///XXX move -moz-appearance: to general rule when style have bg
    let background = " {\n  -moz-appearance: none;\n  background-image: " + bgImage.bg + " !important;\n}\n";
    let backgroundRule = ' > .tab-stack > .tab-background' + background;
    let tabTextRule = " .tab-text {\n  color: #textColor !important;\n}\n";

    let _notSelected = ':not([visuallyselected="true"])';
    let tabState = {
      current: '[visuallyselected="true"]',
      unloaded: '[tabmix_tabState="unloaded"]' + _notSelected,
      unread: '[tabmix_tabState="unread"]' + _notSelected,
      other: ':not([tabmix_tabState])' + _notSelected,
    };

    let styleRules = {
      currentTab: {
        text: '#tabbrowser-tabs[tabmix_currentStyle~="text"] .tabbrowser-tab' + tabState.current + tabTextRule,
        bg: '#tabbrowser-tabs[tabmix_currentStyle~="bg"] .tabbrowser-tab' + tabState.current + backgroundRule
      },
      unloadedTab: {
        text: '#tabbrowser-tabs[tabmix_unloadedStyle~="text"] .tabbrowser-tab' + tabState.unloaded + tabTextRule,
        bg: '#tabbrowser-tabs[tabmix_unloadedStyle~="bg"] .tabbrowser-tab' + tabState.unloaded + backgroundRule
      },
      unreadTab: {
        text: '#tabbrowser-tabs[tabmix_unreadStyle~="text"] .tabbrowser-tab' + tabState.unread + tabTextRule,
        bg: '#tabbrowser-tabs[tabmix_unreadStyle~="bg"] .tabbrowser-tab' + tabState.unread + backgroundRule
      },
      otherTab: {
        text: '#tabbrowser-tabs[tabmix_otherStyle~="text"] .tabbrowser-tab' + tabState.other + tabTextRule,
        bg: '#tabbrowser-tabs[tabmix_otherStyle~="bg"] .tabbrowser-tab' + tabState.other + backgroundRule
      },
    };

    styleRules.progressMeter = {
      bg: '#tabbrowser-tabs[tabmix_progressMeter="userColor"] > #tabbrowser-arrowscrollbox > .tabbrowser-tab > ' +
          '.tab-stack > .tab-progress-container > .tab-progress::-moz-progress-bar' +
          '{\n  background-color: #bottomColor !important;\n}\n'
    };

    this.cssTemplates = styleRules;
    for (let rule of Object.keys(this.cssTemplates)) {
      this.userChangedStyle(rule);
    }
  },

  userChangedStyle(ruleName, notifyWindows) {
    if (ruleName in this && this[ruleName] == "preventUpdate")
      return;

    this[ruleName] = "preventUpdate";
    let prefObj;
    try {
      prefObj = this.validatePrefValue(ruleName);
    } catch (ex) {
      this.handleError(ex, ruleName);
      lazy.Prefs.setCharPref(ruleName, this.defaultPrefs[ruleName]);
      prefObj = this.validatePrefValue(ruleName);
    }
    delete this[ruleName];

    let val = lazy.TabmixSvc.tabStylePrefs[ruleName];
    lazy.TabmixSvc.tabStylePrefs[ruleName] = prefObj;

    if (ruleName == "progressMeter") {
      prefObj.text = false;
      prefObj.textColor = "";
      prefObj.bgTopColor = "";
    }

    // update styles on start or when user changed or enable color
    let changed = !val || // on start
                  prefObj.bg && (!val.bg || // bgColor enabled
                    val.bgColor != prefObj.bgColor || // bgColor changed
                    val.bgTopColor != prefObj.bgTopColor) || // bgTopColor changed
                  prefObj.text && (!val.text || // textColor enabled
                    val.textColor != prefObj.textColor); // textColor changed

    if (changed)
      this.updateStyles(ruleName, prefObj);

    if (notifyWindows)
      this.updateOpenedWindows(ruleName);
  },

  updateStyles(name, prefObj) {
    let templates = this.cssTemplates[name];
    let style = {};
    for (let rule of Object.keys(templates)) {
      let cssText = templates[rule];
      if (rule == "text") {
        if (prefObj.text)
          style[rule] = cssText.replace(/#textColor/g, prefObj.textColor);
      } else if (prefObj.bg) {
        style[rule] = cssText.replace(/#bottomColor/g, prefObj.bgColor)
            .replace(/#topColor/g, prefObj.bgTopColor);
      }
    }
    this.styles[name] = Object.keys(style).length ? style : null;
    this.registerSheet(name);
  },

  // update background type tabbar orient changed
  updateStyleType() {
    lazy.TabmixSvc.tabStylePrefs = {};
    this.createTemplates();

    lazy.TabmixSvc.forEachBrowserWindow(window => {
      let {Tabmix, TabmixTabbar, gBrowser, gTMPprefObserver} = window;
      gTMPprefObserver.updateStyleAttributes();

      // update multi-row heights
      gBrowser.tabContainer.arrowScrollbox._singleRowHeight = null;
      TabmixTabbar.visibleRows = 1;
      Tabmix.tabsUtils.updateVerticalTabStrip();
      TabmixTabbar.setFirstTabInRow();
      TabmixTabbar.updateBeforeAndAfter();
    });
  },

  /** create/update styleSheet for type of tab or progressMeter
   *  we get here in these cases
   *      - when we initialize this service
   *      - when user changed text or background color
   *      - when user disable/enable the style
   */
  registerSheet(name) {
    let enabled = lazy.TabmixSvc.prefBranch.getBoolPref(name);
    if (!enabled)
      return;

    let style = this.styles[name];
    if (!style)
      return;

    let cssText = '';
    for (let rule of Object.keys(style))
      cssText += "\n" + style[rule];
    let styleSheet = Services.io.newURI(
      "data:text/css," + encodeURIComponent(cssText));

    if (!lazy.SSS.sheetRegistered(styleSheet, TYPE)) {
      this.unregisterSheet(name);
      this.registered[name] = styleSheet;
      lazy.SSS.loadAndRegisterSheet(styleSheet, TYPE);
    }
  },

  unregisterSheet(name) {
    let styleSheet = this.registered[name] || null;
    if (styleSheet &&
      lazy.SSS.sheetRegistered(styleSheet, TYPE))
      lazy.SSS.unregisterSheet(styleSheet, TYPE);
  },

  get defaultPrefs() {
    delete this.defaultPrefs;
    let defaults = {};
    let getDefaultBranch = Services.prefs.getDefaultBranch("extensions.tabmix.styles.");
    STYLENAMES.forEach(pref => {
      defaults[pref] = getDefaultBranch.getCharPref(pref);
    }, this);
    return (this.defaultPrefs = defaults);
  },

  handleError(error, ruleName) {
    Cu.reportError(lazy.TabmixSvc.console.error(error));
    lazy.TabmixSvc.console.log('Error in preference "' + ruleName + '", value was reset to default');
    lazy.Prefs.clearUserPref(ruleName);
  },

  validatePrefValue(ruleName) {
    // styles format: italic:boolean, bold:boolean, underline:boolean,
    //                text:boolean, textColor:string, textOpacity:string,
    //                bg:boolean, bgColor:string, bgOpacity:string
    // if we don't catch the problem here it can break the rest of tabmix startup
    var defaultPrefValues = JSON.parse(this.defaultPrefs[ruleName]);
    if (!lazy.Prefs.prefHasUserValue(ruleName)) {
      return defaultPrefValues;
    }

    var currentPrefValues, prefValues = {};
    let prefString = lazy.Prefs.getCharPref(ruleName);
    try {
      currentPrefValues = JSON.parse(prefString);
    } catch (ex) {
      this.handleError(ex, ruleName);
      // set prev value to default so we can continue with this function
      currentPrefValues = defaultPrefValues;
    }
    if (currentPrefValues === null) {
      this.handleError(new Error(ruleName + " value is invalid\n" + prefString), ruleName);
      currentPrefValues = defaultPrefValues;
    }

    const reRGBA = /rgba\((?:\b(?:1?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\b,){3}(?:0?\.[0-9]?[0-9]|0|1)\)/;
    const booleanItems = "italic,bold,underline,text,bg";
    const colorItems = "textColor,bgColor,bgTopColor";

    // make sure we have all the item
    // if item is missing set it to default
    for (let item of Object.keys(defaultPrefValues)) {
      let value = currentPrefValues[item];
      let valid;
      if (booleanItems.includes(item)) {
        valid = typeof value === "boolean";
      } else if (colorItems.includes(item)) {
        valid = typeof value === "string" && value.match(reRGBA);
      }
      if (!valid) {
        throw new Error(`${ruleName} is not valid, ${item} is ${value}`);
      }
      if (value && item.indexOf("Color") > -1) {
        let opacity = item.replace("Color", "Opacity");
        let opacityValue = opacity in currentPrefValues ? currentPrefValues[opacity] : null;
        value = getRGBcolor(value, opacityValue);
      } else if (value !== undefined && typeof value != "boolean") {
        if (/^true$|^false$/.test(value.replace(/[\s]/g, "")))
          value = value == "true";
        else
          value = undefined;
      }
      if (value === undefined) {
        prefValues[item] = item == "bgTopColor" ? prefValues.bgColor :
          defaultPrefValues[item];
      } else {
        prefValues[item] = value;
      }
    }
    let newPrefString = JSON.stringify(prefValues);
    if (prefString != newPrefString) {
      lazy.Prefs.setCharPref(ruleName, newPrefString);
    }

    return prefValues;
  }

};

// Converts a color string in the format "#RRGGBB" to rgba(r,g,b,a).
function getRGBcolor(aColorCode, aOpacity) {
  let newRGB = [];
  let _length = aColorCode.length;
  if (/^rgba|rgb/.test(aColorCode)) {
    newRGB = aColorCode.replace(/rgba|rgb|\(|\)/g, "").split(",").splice(0, 4);
    if (newRGB.length < 3)
      return null;
    for (let i = 0; i < newRGB.length; i++) {
      let val = Number(newRGB[i].replace(/[\s]/g, ""));
      if (isNaN(val))
        return null;
    }
  } else if (/^#/.test(aColorCode) && _length == 4 || _length == 7) {
    aColorCode = aColorCode.replace("#", "");
    let subLength = _length == 7 ? 2 : 1;
    for (let i = 0; i < 3; i++) {
      let subS = aColorCode.substr(i * subLength, subLength);
      if (_length == 4)
        subS += subS;
      var newNumber = parseInt(subS, 16);
      if (isNaN(newNumber))
        return null;
      newRGB.push(newNumber);
    }
  } else {
    return null;
  }

  if (aOpacity !== null)
    newRGB[3] = aOpacity;
  else if (newRGB[3] === undefined || newRGB[3] < 0 || newRGB[3] > 1)
    newRGB[3] = 1;
  return "rgba(" + newRGB.join(",") + ")";
}
