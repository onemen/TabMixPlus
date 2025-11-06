/** Module to tab context menu preferences */

/* eslint @stylistic/lines-around-comment: "off", prefer-const:"error" */

import {isVersion} from "chrome://tabmix-resource/content/BrowserVersion.sys.mjs";

/** @type {TabContextConfigModule.AppName} */ // @ts-expect-error
const appName = Services.appinfo.name.toLowerCase();
const isWaterfox = appName == "waterfox";

/**
 * Tab context menu items configuration Key: Menu item ID Value:
 *
 * - [string, boolean?]: Preference name and optional default visibility
 * - [""]: Empty string means use key as pref name with default visibility true
 *
 * @type {TabContextConfigModule.PrefList}
 */
const TAB_CONTEXT_MENU_PREFLIST = {
  // Firefox items
  "context_bookmarkAllTabs": ["bookmarkTabsMenu"],
  "context_bookmarkTab": ["bookmarkTabMenu"],
  // "context_bookmarkSelectedTabs",
  "context_closeDuplicateTabs": ["closeDuplicateTabs"],
  "context_closeTab": ["closeTabMenu"],
  "context_closeTabOptions": ["closeTabOptions"],
  // "context_openTabInWindow": ["detachTabMenu", false],
  "context_duplicateTab": ["duplicateMenu"],
  // "context_duplicateTabs",
  "context_fullscreenAutohide": [""], // Special case - no ID in Firefox < 129
  "context_fullscreenExit": [""], // Special case - no ID in Firefox < 129
  "context_moveTabOptions": ["moveTabOptions"],
  "context_moveTabToGroup": [""],
  "context_moveTabToNewGroup": [""],
  "context_openANewTab": ["newTabMenu"],
  "context_pinTab": ["pinTabMenu"],
  // "context_pinSelectedTabs",
  "context_playTab": [""],
  // "context_playSelectedTabs",
  "context_reloadTab": ["reloadTabMenu"],
  // "context_reloadSelectedTabs",
  "context_reloadTabOptions": ["reloadTabOptions"],
  "context_reopenInContainer": ["reopenInContainer"],
  "context_selectAllTabs": ["selectAllTabs"],
  "context_sendTabToDevice": ["sendTabToDevice"],
  "context_toggleMuteTab": ["muteTabMenu"],
  // "context_toggleMuteSelectedTabs",
  "context_undoCloseTab": ["undoCloseTabMenu"],
  "context_ungroupTab": [""],
  "context_unloadTab": [""],
  // "context_unpinTab", // Special case - we combined it with pinTab
  // "context_unpinSelectedTabs",

  "shareTabURL": ["shareTabURL"], // Special case - no ID in Firefox

  // Tabmix items
  "tm-autoreloadTab_menu": ["autoReloadMenu", false],
  // waterfox has build-in copy tab url
  [isWaterfox ? "context_copyTabUrl" : "tm-copyTabUrl"]: ["copyTabUrlMenu"],
  "tm-docShell": ["docShellMenu", false],
  "tm-duplicateinWin": ["duplicateinWinMenu", false],
  "tm-freezeTab": ["freezeTabMenu", false],
  "tm-lockTab": ["lockTabMenu"],
  "tm-mergeWindowsTab": ["showMergeWindow", false],
  "tm-protectTab": ["protectTabMenu"],
  "tm-renameTab": ["renameTabMenu", false],
  "tm-undoCloseList": ["undoCloseListMenu"],
};

/** @type {TabContextConfigModule.ForkItems} */
const FORKS_MENU_ITEMS = {
  waterfox: {
    toggleTabPrivateState: [""],
    // we add this to TAB_CONTEXT_MENU_PREFLIST with our existing preference
    // context_copyTabUrl: [""],
    context_copyAllTabUrls: [""],
  },
  firefox: {},
  floorp: {
    context_MoveTabToOtherWorkspace: [""],
    context_toggleToPrivateContainer: [""],
    context_splittabs: [""],
    context_split_fixedtab: [""],
  },
  zen: {
    "context_zen-add-essential": [""],
    "context_zen-remove-essential": [""],
    "context-zen-change-workspace-tab": [""],
    "context_zenSplitTabs": [""],
    "context_zenUnloadTab": [""],
    "context_zenTabActions": [""],
    "context_zen-replace-pinned-url-with-current": [""],
    "context_zen-reset-pinned-tab": [""],
  },
};

/**
 * Mapping for menu items without IDs Maps a unique identifier to a
 * querySelector string
 *
 * @type {{[key: string]: string}}
 */
const TAB_CONTEXT_MENU_SELECTORS = {
  shareTabURL: ".share-tab-url-item",
  ...(isVersion(1290) ?
    {}
  : {
      context_fullscreenAutohide: "[data-l10n-id='full-screen-autohide']",
      context_fullscreenExit: "[data-l10n-id='full-screen-exit']",
    }),
};

/** @type {TabContextConfigModule.Exports} */
export const TabContextConfig = {
  selectors: TAB_CONTEXT_MENU_SELECTORS,
  prefList: {
    ...TAB_CONTEXT_MENU_PREFLIST,
    ...(FORKS_MENU_ITEMS[appName] ?? {}),
  },
  forksExtraIds: Object.keys(FORKS_MENU_ITEMS[appName] ?? {}),
};
