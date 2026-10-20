// don't check the imported files
// @ts-nocheck

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Globals that browser.xhtml's scripts define on the browser window. A project
// with modules that run in that window names this file in its tsconfig
// `include`. browser-window-globals.d.ts declares the types of those that are
// not system modules.

/// <reference path="./browser-window-globals.d.ts" />

declare var AppConstants: typeof import("resource://gre/modules/AppConstants.sys.mjs").AppConstants;
declare var BrowserUIUtils: typeof import("resource:///modules/BrowserUIUtils.sys.mjs").BrowserUIUtils;
declare var BrowserWindowTracker: typeof import("resource:///modules/BrowserWindowTracker.sys.mjs").BrowserWindowTracker;
declare var ContextualIdentityService: typeof import("moz-src:///toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs").ContextualIdentityService;
declare var CustomizableUI: typeof import("moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs").CustomizableUI;
declare var NewTabPagePreloading: typeof import("moz-src:///browser/components/tabbrowser/NewTabPagePreloading.sys.mjs").NewTabPagePreloading;
declare var PrivateBrowsingUtils: typeof import("resource://gre/modules/PrivateBrowsingUtils.sys.mjs").PrivateBrowsingUtils;
declare var SessionStore: typeof import("moz-src:///browser/components/sessionstore/SessionStore.sys.mjs").SessionStore;
declare var XPCOMUtils: typeof import("resource://gre/modules/XPCOMUtils.sys.mjs").XPCOMUtils;

// The class and its instance, as a class declaration would provide them.
declare var Tabbrowser: typeof import("moz-src:///browser/components/tabbrowser/Tabbrowser.sys.mjs").Tabbrowser;
type Tabbrowser = BrowserWindow.Tabbrowser;

declare var gBrowser: BrowserWindow["gBrowser"];
declare var gCustomizeMode: BrowserWindow["gCustomizeMode"];
declare var gInitialPages: BrowserWindow["gInitialPages"];
declare var gMultiProcessBrowser: BrowserWindow["gMultiProcessBrowser"];
declare var gURLBar: BrowserWindow["gURLBar"];
declare var delayedStartupPromise: BrowserWindow["delayedStartupPromise"];
declare var RTL_UI: BrowserWindow["RTL_UI"];

declare var isBlankPageURL: BrowserWindow["isBlankPageURL"];
declare var isInitialPage: BrowserWindow["isInitialPage"];
declare var CreateContainerTabMenu: BrowserWindow["CreateContainerTabMenu"];
declare var UpdatePopupNotificationsVisibility: BrowserWindow["UpdatePopupNotificationsVisibility"];
declare var openPreferences: BrowserWindow["openPreferences"];

declare var gBrowserInit: BrowserWindow["gBrowserInit"];
declare var BrowserCommands: BrowserWindow["BrowserCommands"];
declare var CustomTitlebar: BrowserWindow["CustomTitlebar"];
declare var SidebarController: BrowserWindow["SidebarController"];
declare var gSharedTabWarning: BrowserWindow["gSharedTabWarning"];
declare var gKeywordURIFixup: BrowserWindow["gKeywordURIFixup"];
declare const DynamicShortcutTooltip: BrowserWindow["DynamicShortcutTooltip"];
declare const gClickAndHoldListenersOnElement: BrowserWindow["gClickAndHoldListenersOnElement"];
declare var FirefoxViewHandler: BrowserWindow["FirefoxViewHandler"];
