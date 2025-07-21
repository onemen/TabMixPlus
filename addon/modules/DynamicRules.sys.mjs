/** @type {DynamicRulesModule.Lazy} */ // @ts-expect-error
const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  //
  TabmixSvc: "chrome://tabmix-resource/content/TabmixSvc.sys.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "Prefs", () => {
  return Services.prefs.getBranch("extensions.tabmix.styles.");
});

var TYPE = 1;
ChromeUtils.defineLazyGetter(lazy, "SSS", () => {
  let sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService);
  TYPE = sss.USER_SHEET;
  return sss;
});

/** @type {DynamicRulesModule.RuleName[]} */
const STYLENAMES = ["currentTab", "unloadedTab", "unreadTab", "otherTab", "progressMeter"];

/** @type {DynamicRulesModule.DynamicRules} */
export const DynamicRules = {
  // @ts-expect-error - hold templates for our css rules
  cssTemplates: {},

  // hold the current state for each style according to its preference
  styles: {},

  // hold reference to registered style sheets
  registered: {},

  _initialized: false,

  init(aWindow) {
    if (this._initialized) {
      return;
    }

    this._initialized = true;

    this.orient =
      aWindow.document.getElementById("tabbrowser-tabs").getAttribute("orient") || "horizontal";
    this.windows10 = aWindow.navigator.oscpu.startsWith("Windows NT 10.0");

    lazy.Prefs.addObserver("", this);
    STYLENAMES.forEach(pref => {
      Services.prefs.addObserver("extensions.tabmix." + pref, this);
    }, this);
    Services.obs.addObserver(this, "browser-window-before-show");
    Services.obs.addObserver(this, "quit-application");

    this.createTemplates();
  },

  observe(subject, topic, data) {
    switch (topic) {
      case "browser-window-before-show":
        // @ts-expect-error - subject is ChromeWindow
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
    /** @param {MutationRecord[]} aMutations */
    const tabsMutate = aMutations => {
      for (let mutation of aMutations) {
        if (mutation.attributeName == "orient") {
          this.orient = mutation.target?.getAttribute("orient") || "horizontal";
          this.updateStyleType();
          return;
        }
      }
    };
    let Observer = new window.MutationObserver(tabsMutate);
    Observer.observe(window.gBrowser.tabContainer, {attributes: true});
    window.addEventListener(
      "unload",
      function unload() {
        Observer.disconnect();
      },
      {once: true}
    );
  },

  onPrefChange(data) {
    /** @type {DynamicRulesModule.RuleName} */ // @ts-expect-error
    let prefName = data.split(".").pop() || "";
    if (STYLENAMES.indexOf(prefName) > -1) {
      if (prefName == data) {
        this.userChangedStyle(prefName, true);
      } else {
        this.registerSheet(prefName);
      }
    }
  },

  onQuitApplication() {
    Services.obs.removeObserver(this, "browser-window-before-show");
    Services.obs.removeObserver(this, "quit-application");
    lazy.Prefs.removeObserver("", this);
    STYLENAMES.forEach(pref => {
      Services.prefs.removeObserver("extensions.tabmix." + pref, this);
      this.unregisterSheet(pref);
    });
  },

  updateOpenedWindows(ruleName) {
    // update all opened windows
    lazy.TabmixSvc.forEachBrowserWindow(window => {
      if (ruleName != "progressMeter") {
        window.gTMPprefObserver.updateTabsStyle(ruleName);
      } else {
        window.gTMPprefObserver.setProgressMeter();
      }
    });
  },

  getSelector(name, rule) {
    // add more selectors to increase specificity of our rule in order to
    // override rules from Firefox and Waterfox
    let selector = "#tabbrowser-tabs";

    name = name.replace("Tab", "");
    return `${selector}[tabmix_#style~="#type"] arrowscrollbox .tabbrowser-tab${this.tabState[name]}`
      .replace("#style", `${name}Style`)
      .replace("#type", rule);
  },

  createTemplates() {
    let bgImage = {bg: "linear-gradient(#topColor, #bottomColor)"};
    let background =
      " {\n  appearance: none;\n  background-image: " + bgImage.bg + " !important;\n}\n";
    let backgroundRule = " > .tab-stack > .tab-background" + background;
    let tabTextRule = " .tab-text {\n  color: #textColor !important;\n}\n";

    const visuallyselected = "[visuallyselected]";
    const _notSelected = `:not(${visuallyselected})`;
    this.tabState = {
      current: visuallyselected,
      unloaded: '[tabmix_tabState="unloaded"]' + _notSelected,
      unread: '[tabmix_tabState="unread"]' + _notSelected,
      other: ":not([tabmix_tabState])" + _notSelected,
    };

    let styleRules = {
      currentTab: {
        text: `${this.getSelector("current", "text")}${tabTextRule}`,
        bg: `${this.getSelector("current", "bg")}${backgroundRule}`,
      },
      unloadedTab: {
        text: `${this.getSelector("unloaded", "text")}${tabTextRule}`,
        bg: `${this.getSelector("unloaded", "bg")}${backgroundRule}`,
      },
      unreadTab: {
        text: `${this.getSelector("unread", "text")}${tabTextRule}`,
        bg: `${this.getSelector("unread", "bg")}${backgroundRule}`,
      },
      otherTab: {
        text: `${this.getSelector("other", "text")}${tabTextRule}`,
        bg: `${this.getSelector("other", "bg")}${backgroundRule}`,
      },
      progressMeter: {
        bg:
          '#tabbrowser-tabs[tabmix_progressMeter="userColor"] #tabbrowser-arrowscrollbox .tabbrowser-tab > ' +
          ".tab-stack > .tab-progress-container > .tab-progress::-moz-progress-bar" +
          "{\n  background-color: #bottomColor !important;\n}\n",
      },
    };

    this.cssTemplates = styleRules;
    for (let rule of Object.keys(this.cssTemplates)) {
      // @ts-expect-error - we know these keys match DefaultPrefs
      this.userChangedStyle(rule);
    }
  },

  userChangedStyle(ruleName, notifyWindows) {
    if (ruleName in this && this[ruleName] == "preventUpdate") {
      return;
    }

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
    let changed =
      !val || // on start
      (prefObj.bg &&
        (!val.bg || // bgColor enabled
          val.bgColor != prefObj.bgColor || // bgColor changed
          val.bgTopColor != prefObj.bgTopColor)) || // bgTopColor changed
      (prefObj.text &&
        (!val.text || // textColor enabled
          val.textColor != prefObj.textColor)); // textColor changed

    if (changed) {
      this.updateStyles(ruleName, prefObj);
    }

    if (notifyWindows) {
      this.updateOpenedWindows(ruleName);
    }
  },

  updateStyles(name, prefObj) {
    let templates = this.cssTemplates[name];

    const buttonSelector = (/** @type {string} */ rule) =>
      `${this.getSelector(name, rule)} > .tab-stack > .tab-content > .tab-close-button`;
    const bgSelector = (/** @type {string} */ rule) =>
      `${this.getSelector(name, rule)}:hover > .tab-stack > .tab-background`;

    /** @type {Record<string, string>} */
    let style = {};
    for (let rule of Object.keys(templates)) {
      /** @type {string} */ // @ts-expect-error
      let cssText = templates[rule];
      if (rule == "text") {
        if (prefObj.text) {
          style[rule] =
            cssText.replace(/#textColor/g, prefObj.textColor) +
            `\n${buttonSelector(rule)} {
            fill: ${prefObj.textColor} !important;
          }`;
        }
      } else if (prefObj.bg) {
        style[rule] = cssText
          .replace(/#bottomColor/g, prefObj.bgColor)
          .replace(/#topColor/g, prefObj.bgTopColor);

        if (name !== "progressMeter") {
          const {topColor, bottomColor} = getButtonColors(prefObj, 10);
          style[rule] += `\n${buttonSelector(rule)}:hover {
            background-image: linear-gradient(${topColor}, ${bottomColor});
          }`;
        }

        if (name !== "currentTab" && name !== "progressMeter") {
          const {topColor, bottomColor} = getButtonColors(prefObj, 15);
          style[rule] += `\n${bgSelector(rule)} {
            background-image: linear-gradient(${topColor}, ${bottomColor}) !important;
            outline: red !important;
          }`;
        }
      }
    }
    this.styles[name] = Object.keys(style).length ? style : null;
    this.registerSheet(name);
  },

  // update background type tabbar orient changed
  updateStyleType() {
    // @ts-expect-error - reset tabStylePrefs
    lazy.TabmixSvc.tabStylePrefs = {};
    this.createTemplates();

    lazy.TabmixSvc.forEachBrowserWindow(async window => {
      let {Tabmix, TabmixTabbar, gBrowser, gTMPprefObserver} = window;
      await Tabmix._deferredInitialized.promise;
      gTMPprefObserver.updateStyleAttributes();

      // update multi-row heights
      gBrowser.tabContainer.arrowScrollbox._singleRowHeight = null;
      TabmixTabbar.visibleRows = 1;
      Tabmix.tabsUtils.updateVerticalTabStrip();
      TabmixTabbar.setFirstTabInRow();
    });
  },

  /* create/update styleSheet for type of tab or progressMeter
   *  we get here in these cases
   *      - when we initialize this service
   *      - when user changed text or background color
   *      - when user disable/enable the style
   */
  registerSheet(name) {
    let enabled = lazy.TabmixSvc.prefBranch.getBoolPref(name);
    if (!enabled) {
      return;
    }

    /** @type {Record<string, string>} */ // @ts-expect-error
    let style = this.styles[name];
    if (!style) {
      return;
    }

    let cssText = "";
    for (let rule of Object.keys(style)) {
      cssText += "\n" + style[rule];
    }
    let styleSheet = Services.io.newURI("data:text/css," + encodeURIComponent(cssText));

    if (!lazy.SSS.sheetRegistered(styleSheet, TYPE)) {
      this.unregisterSheet(name);
      this.registered[name] = styleSheet;
      lazy.SSS.loadAndRegisterSheet(styleSheet, TYPE);
    }
  },

  unregisterSheet(name) {
    let styleSheet = this.registered[name] || null;
    if (styleSheet && lazy.SSS.sheetRegistered(styleSheet, TYPE)) {
      lazy.SSS.unregisterSheet(styleSheet, TYPE);
    }
  },

  get defaultPrefs() {
    if (this._defaultPrefs) {
      return this._defaultPrefs;
    }

    /** @type {DynamicRulesModule.DefaultPrefs} */ // @ts-expect-error
    const defaults = {};
    let getDefaultBranch = Services.prefs.getDefaultBranch("extensions.tabmix.styles.");
    STYLENAMES.forEach(pref => {
      defaults[pref] = getDefaultBranch.getCharPref(pref);
    });
    this._defaultPrefs = defaults;
    return defaults;
  },

  handleError(error, ruleName) {
    console.error(lazy.TabmixSvc.console.error(error));
    lazy.TabmixSvc.console.log(
      'Error in preference "' + ruleName + '", value was reset to default'
    );
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

    /** @type {Partial<DynamicRulesModule.TabStyle> & {[key: string]: any}} */
    let currentPrefValues = {};

    /** @type {Partial<DynamicRulesModule.TabStyle> & {[key: string]: any}} */
    const prefValues = {};
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

    const reRGBA =
      /rgba\((?:\b(?:1?[0-9]?[0-9]|2[0-4][0-9]|25[0-5])\b,){3}(?:0?\.[0-9]?[0-9]|0|1)\)/;
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
        if (/^true$|^false$/.test(value.replace(/[\s]/g, ""))) {
          value = value == "true";
        } else {
          value = undefined;
        }
      }
      if (value === undefined) {
        prefValues[item] = item == "bgTopColor" ? prefValues.bgColor : defaultPrefValues[item];
      } else {
        prefValues[item] = value;
      }
    }
    let newPrefString = JSON.stringify(prefValues);
    if (prefString != newPrefString) {
      lazy.Prefs.setCharPref(ruleName, newPrefString);
    }

    return prefValues;
  },
};

// Converts a color string in the format "#RRGGBB" to rgba(r,g,b,a).
/**
 * @param {string} aColorCode
 * @param {number | null} aOpacity
 */
function getRGBcolor(aColorCode, aOpacity) {
  let newRGB = [];
  let _length = aColorCode.length;
  if (/^rgba|rgb/.test(aColorCode)) {
    newRGB = aColorCode
      .replace(/rgba|rgb|\(|\)/g, "")
      .split(",")
      .splice(0, 4);
    if (newRGB.length < 3) {
      return null;
    }

    for (let i = 0; i < newRGB.length; i++) {
      let val = Number(newRGB[i]?.replace(/[\s]/g, ""));
      if (isNaN(val)) {
        return null;
      }
    }
  } else if ((/^#/.test(aColorCode) && _length === 4) || _length === 7) {
    aColorCode = aColorCode.replace("#", "");
    let subLength = _length === 7 ? 2 : 1;
    for (let i = 0; i < 3; i++) {
      let subS = aColorCode.substr(i * subLength, subLength);
      if (_length === 4) {
        subS += subS;
      }

      var newNumber = parseInt(subS, 16);
      if (isNaN(newNumber)) {
        return null;
      }

      newRGB.push(newNumber);
    }
  } else {
    return null;
  }

  if (aOpacity !== null) {
    newRGB[3] = aOpacity;
  } else if (newRGB[3] === undefined || Number(newRGB[3]) < 0 || Number(newRGB[3]) > 1) {
    newRGB[3] = 1;
  }

  return "rgba(" + newRGB.join(",") + ")";
}

/** @type {DynamicRulesModule.ButtonColorProcessor} */
const buttonColorProcessor = {
  getButtonColors({bgColor, bgTopColor}, value = 10) {
    return {
      topColor: this.processColor(bgColor, value),
      bottomColor: this.processColor(bgTopColor, value),
    };
  },

  parseRgba(rgbaString) {
    const rgbaPattern = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d+(?:\.\d+)?)\)/;
    const match = rgbaString.trim().match(rgbaPattern);

    if (!match?.[1] || !match[2] || !match[3] || !match[4]) {
      return null;
    }

    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: parseFloat(match[4]),
    };
  },

  rgbaToHsla(rgba) {
    const normalizedRGB = {
      r: rgba.r / 255,
      g: rgba.g / 255,
      b: rgba.b / 255,
    };

    const {r, g, b} = normalizedRGB;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      switch (max) {
        case r:
          h = (60 * ((g - b) / delta) + 360) % 360;
          break;
        case g:
          h = (60 * ((b - r) / delta) + 120) % 360;
          break;
        case b:
          h = (60 * ((r - g) / delta) + 240) % 360;
          break;
      }
    }

    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    return {
      h: Math.round(h),
      s: Math.round(s * 100) / 100,
      l: Math.round(l * 100) / 100,
      a: Math.round(rgba.a * 100) / 100,
    };
  },

  darkenRgba(rgba, amount) {
    const hsla = this.rgbaToHsla(rgba);
    hsla.l = Math.max(0, Math.min(1, hsla.l - amount / 100));
    return hsla;
  },

  hslaToString(hsla) {
    return `hsla(${hsla.h}, ${hsla.s * 100}%, ${hsla.l * 100}%, ${hsla.a})`;
  },

  processColor(color, value) {
    const rgba = this.parseRgba(color);
    if (!rgba) {
      console.error(`Invalid color format: ${color}`);
      return color;
    }
    return this.hslaToString(this.darkenRgba(rgba, value));
  },
};

// get darkened color for close button hover state
/** @type {typeof buttonColorProcessor.getButtonColors} */
function getButtonColors({bgColor, bgTopColor}, value = 10) {
  return buttonColorProcessor.getButtonColors({bgColor, bgTopColor}, value);
}
