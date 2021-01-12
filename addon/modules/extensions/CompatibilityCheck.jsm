"use strict";

/**
 * original code by onemen
 */

/**
 *  functions to disable incompatible extensions
 *  original code by mrtech local_install.js ,
 *                   code modified by onemen 2006-01-13
 *                   code modified by onemen 2010-03-22 - work with new AddonManager for firefox 4.0
 */
this.EXPORTED_SYMBOLS = ["CompatibilityCheck"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

const TMP_BUTTON_CANCEL = 1;
const TMP_BUTTON_EXTRA1 = 2;
const TMP_HIDE_MENUANDTEXT = 2;
const TMP_CHECKBOX_UNCHECKED = 0;
const TMP_CHECKBOX_CHECKED = 1;
const TMP_HIDE_CHECKBOX = 2;

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/AddonManager.jsm", this);
Cu.import("resource://tabmixplus/TabmixSvc.jsm", this);
XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");

var _initialized = false;

function CompatibilityCheck(aWindow, aShowList, aCallbackDialog) {
  if (_initialized && !aCallbackDialog)
    return;
  _initialized = true;
  this.window = aWindow;
  this.showList = aShowList;
  this.callbackDialog = aCallbackDialog;
  this.list = [];
  this.getIncompatibleList();
}

CompatibilityCheck.prototype = {
  DISABLE: 0,
  CANCEL: 1,
  DISABLE_AND_RESTART: 2,
  window: null,
  showList: null,
  callbackDialog: null,
  list: null,

  // for new AddonManager since Firefox 4.0
  getIncompatibleList: function TMP_EX_getIncompatibleList() {
    function isPending(aAddon, aAction) {
      var action = AddonManager["PENDING_" + aAction.toUpperCase()];
      return Boolean(aAddon.pendingOperations & action);
    }

    function AddOn(addon) {
      this._name = addon.name;
      this.id = addon.id;
      this._version = addon.version;
    }
    AddOn.prototype = {
      toString() {
        return this._name.toLowerCase();
      }
    };

    var guid_list = this.getList();
    var self = this;
    AddonManager.getAddonsByTypes(["extension"], aAddonsList => {
      for (let i = 0; i < aAddonsList.length; i++) {
        let addon = aAddonsList[i];
        if (addon.id.toLowerCase() in guid_list) {
          let disabled = addon.userDisabled;
          if ((!disabled && !isPending(addon, "disable") && !isPending(addon, "uninstall")) ||
                  (disabled && isPending(addon, "enable"))) {
            self.list.push(new AddOn(addon));
            if (!self.showList)
              break;
          }
        }
      }
      self.showResult();
    });
  },

  showResult: function TMP_EX_showResult() {
    let emptyList = this.list.length === 0;
    if (this.showList && !emptyList)
      this.warnAboutIncompatible();
    else
      this.dialogCallback(emptyList);
  },

  warnAboutIncompatible: function TMP_EX_warnAboutIncompatible() {
    var list = this.list;
    try {
      list.sort();
    } catch (ex) { }

    var outStr = "";
    for (let i = 0; i < list.length; i++) {
      let name = list[i]._name;
      name = name.charAt(0).toUpperCase() + name.substr(1);
      outStr += " - " + name + " " + list[i]._version + "\n";
    }

    var showatStart = TabmixSvc.prefBranch.getBoolPref("disableIncompatible");
    var chkBoxState = showatStart ? TMP_CHECKBOX_CHECKED : TMP_CHECKBOX_UNCHECKED;

    var title = TabmixSvc.getString("incompatible.title");
    var msg = TabmixSvc.getString("incompatible.msg0") + "\n" +
              TabmixSvc.getString("incompatible.msg1") + "\n\n" + outStr + "\n\n";
    var chkBoxLabel = TabmixSvc.getString("incompatible.chkbox.label");
    var buttons = [TabmixSvc.setLabel("incompatible.button0"),
      TabmixSvc.setLabel("incompatible.button1")];
    buttons.push(TabmixSvc.setLabel("incompatible.button2"));

    // make promptService non modal on startup
    var self = this;
    var callBack = this.callbackDialog ? null :
      function(aResult) {
        aResult.showatStart = showatStart;
        self.promptCallBack(aResult);
      };
    var result = this.window.Tabmix.promptService([TMP_BUTTON_EXTRA1, TMP_HIDE_MENUANDTEXT, chkBoxState],
      [title, msg, "", chkBoxLabel, buttons.join("\n")], this.window, callBack);
    if (!callBack)
      this.promptCallBack(result);
  },

  // we use non modal promptService on startup
  promptCallBack: function TMP_EX_promptCallBack(aResult) {
    if (aResult.checked != aResult.showatStart) {
      TabmixSvc.prefBranch.setBoolPref("disableIncompatible", aResult.checked);
      Services.prefs.savePrefFile(null); // store the pref immediately
    }

    if (aResult.button != this.CANCEL) {
      this.doDisable();
      this.restart(aResult.button == this.DISABLE_AND_RESTART);
      this.dialogCallback(true); // we don't need this on startup
    }
  },

  doDisable: function TMP_EX_doDisable() {
    var list = this.list;
    list.forEach(aAddonToDisable => {
      AddonManager.getAddonByID(aAddonToDisable.id, aAddon => {
        aAddon.userDisabled = true;
      });
    });
  },

  restart: function TMP_EX_restart(aRestart) {
    if (aRestart && TabmixSvc.topWin().canQuitApplication()) {
      var appStartup = Ci.nsIAppStartup;
      Cc["@mozilla.org/toolkit/app-startup;1"]
          .getService(appStartup).quit(appStartup.eRestart | appStartup.eAttemptQuit);
    } else {
      let title = TabmixSvc.getString("incompatible.title");
      let msg = TabmixSvc.getString("incompatible.msg2");
      let button = TabmixSvc.setLabel("sm.button.continue");
      let buttons = ["", button].join("\n");
      // make it not modal on startup
      let callBack = this.callbackDialog ? null : function() {/* nothing to do */};
      this.window.Tabmix.promptService([TMP_BUTTON_CANCEL, TMP_HIDE_MENUANDTEXT, TMP_HIDE_CHECKBOX],
        [title, msg, "", "", buttons], this.window, callBack);
    }
  },

  dialogCallback: function TMP_EX_dialogCallback(aHideButton) {
    if (this.callbackDialog) {
      this.window.gIncompatiblePane.hide_IncompatibleNotice(aHideButton, this.showList);
    }
  },

  /* eslint dot-notation: 0 */
  getList: function TMP_EX_getList() {
    /*
     *  The following extensions are integrated or incompatible with Tab Mix Plus
     *
     *  Add extensions ID in lowercase.
     */
    // noinspection SpellCheckingInspection
    return {
      '{00bdd586-51fb-4b06-9c23-af2fb7609bf3}': true, //   Basics
      '{b98719b3-76d6-4bec-aeed-3ab542b23bd7}': true, //   BlankLast
      '{47921160-3085-4023-a145-8ec466babfba}': true, //   Click2Tab
      '{b0f9cad2-ebae-4685-b518-d3d9b41ea183}': true, //   Close Tab On Double Click
      'ctc@clav.mozdev.org': true, //   CTC
      '{61ed2a9a-39eb-4aaf-bd14-06dfbe8880c3}': true, //   Duplicate Tab
      'flowtabs': true, //   Flowing Tabs
      '{cd2b821e-19f9-40a7-ac5c-08d6c197fc43}': true, //   FLST
      '{68e5dd30-a659-4987-99f9-eaf21f9d4140}': true, //   LastTab
      'minit@dorando': true, //   MiniT
      'minit-drag': true, //   miniT-drag
      'minit-tabscroll@dorando': true, //   miniT-tabscroll
      'new-tab-button-on-tab-bar@mikegoodspeed.com': true, //   new tab button on tab bar
      '{66e978cd-981f-47df-ac42-e3cf417c1467}': true, //   new tab homepage
      'newtaburl@sogame.cat': true, //   NewTabURL
      '{4b2867d9-2973-42f3-bd9b-5ad30127c444}': true, //   Petite Tabbrowser Extensions
      '{888d99e7-e8b5-46a3-851e-1ec45da1e644}': true, //   ReloadEvery
      '{aede9b05-c23c-479b-a90e-9146ed62d377}': true, //   Reload Tab On Double-Click
      '{492aa940-beaa-11d8-9669-0800200c9a66}': true, //   Scrollable Tabs
      '{eb922232-fd76-4eb0-bd5a-c1cba4238343}': true, //   Single Window
      '{149c6cc6-ec62-4ebd-b719-3c2e867930c7}': true, //   Stack style tabs
      'supert@studio17.wordpress.com': true, //   superT
      'tabbin': true, //   Tab Bin
      '{43520b8f-4107-4351-ac64-9bcc5eea24b9}': true, //   Tab Clicking Options
      '{bea6d1a7-882d-425f-bc75-944e0063ff3b}': true, //   Tab Mix [original one]
      'tabtowindow@sogame.cat': true, //   Tab to window
      'tabx@clav.mozdev.org': true, //   Tab X
      '{0b0b0da8-08ba-4bc6-987c-6bc9f4d8a81e}': true, //   Tabbrowser Extensions
      '{9b9d2aaa-ae26-4447-a7a1-633a32b19ddd}': true, //   Tabbrowser Preferences
      'tabdrag': true, //   tabdrag-for-tablib
      'tabfx@chaosware.net': true, //   TabFX
      'tabsopenrelative@jomel.me.uk': true, //   Tabs open ralative
      'tablib': true, //   tablib
      '{328bbe91-cb86-40b0-a3fd-2b39969f9faa}': true, //   Undo Close Tab
      'undoclosetab@dorando': true, //   Undo Close Tab
      '{99ec6690-8bb1-11da-a72b-0800200c9a66}': true, //   Unread Tabs
      // updated 2009-08-01
      'undoclosedtabsbutton@supernova00.biz': true, //   Undo closed button
      'remove-new-tab-button@forerunnerdesigns.com': true, //   Remove new tab button
      'last-tab-close-button@victor.sacharin': true, //   Last tab close button
      // 2010-09-15
      'tabutils@ithinc.cn': true, //   Tab Utilities
      // 2012-05-23
      'tab-width@design-noir.de': true, //   Custom Tab Width
    };
  }
};
