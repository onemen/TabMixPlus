---
name: firefox-source
description:
  How to locate and read Firefox source files for this project — the firefox_code.local link, the
  firefox-source MCP server, the key component paths (gBrowser, tabs, drag & drop), and the Firefox
  156+ moz-src layout. Use when you need to read Firefox internals, find a class or element, or fix
  a broken source link.
---

# Reading the Firefox source

Tab Mix Plus is a legacy extension that overrides Firefox internals, so reading the actual Firefox
source is step one of most tasks.

## Two ways in

1. **`firefox-source` MCP server** — prefer this when configured; it serves files from the unpacked
   Firefox omni folder directly.
2. **`firefox_code.local` link** at the repository root — works with plain `read_files` /
   `code_search` tools. Machine-specific and untracked; the user creates it **manually**:

   ```bash
   cmd //c mklink /J firefox_code.local "C:/path/to/unpacked/Firefox Nightly - omni"
   ```

   Paths for every local channel unpack (Nightly, Developer Edition, Beta, Release, ESR, previous
   ESR) live in `config/.firefox-link.local.json` (gitignored, `/` separators) under `channels`;
   `firefoxOmni` is the active link target, kept in sync by hand. To read another channel, take its
   path from `channels` and read it directly.

The target is an **unpacked `omni.ja`** (7-Zip > Extract Here, or
`python -m zipfile -e omni.ja <target>`). A valid unpack contains
`chrome/browser/content/browser/browser.xhtml`; 156+ unpacks also have `moz-src/`.

## Firefox 156+ layout (moz-src)

Since Firefox 156 several core components moved from `chrome/browser/content/browser/` into the
shared `moz-src/` tree:

| Before 156                                                | 156+                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `chrome/browser/content/browser/tabbrowser/tabbrowser.js` | `moz-src/browser/components/tabbrowser/Tabbrowser.sys.mjs` |
| sessionstore and other shared modules                     | under `moz-src/` (bug 2062778, bug 2062783)                |

Many previously public `gBrowser` methods are now private (`#method`). Use `Tabmix.getPrivateMethod`
to reconstruct them — see `addon/chrome/content/minit/minit.js`.

## Key components (quick map)

- gBrowser - class `Tabbrowser` -
  `firefox_code.local/moz-src/browser/components/tabbrowser/Tabbrowser.sys.mjs`
- gBrowser.tabContainer - class `MozTabbrowserTabs` -
  `firefox_code.local/chrome/browser/content/browser/tabbrowser/tabs.js`; the tabs element
  id="tabbrowser-tabs" lives in `firefox_code.local/chrome/browser/content/browser/browser.xhtml`
- Tab drag & drop controller - class `TabDragAndDrop` -
  `firefox_code.local/chrome/browser/content/browser/tabbrowser/drag-and-drop.js`
- gBrowser.tabContainer.arrowScrollbox - class `MozArrowScrollbox` -
  `firefox_code.local/chrome/toolkit/content/global/elements/arrowscrollbox.js`; the scrollbox
  id="tabbrowser-arrowscrollbox" lives in `browser.xhtml`
- Single tab - class `MozTabbrowserTab` -
  `firefox_code.local/chrome/browser/content/browser/tabbrowser/tab.js`; tab is="tabbrowser-tab"
  class="tabbrowser-tab" in `browser.xhtml`

## Finding anything else

- `code_search` within `firefox_code.local/` for class names, element ids, or CSS selectors seen in
  the DOM.
- `browser.xhtml` is the entry point for most browser UI wiring; global element scripts live in
  `chrome/toolkit/content/global/elements/`.
- When Firefox code references module-scoped constants (e.g. `DROP_ANIMATION_GRACE_MS` in
  drag-and-drop.js) from code TabMix injects, the sandbox must define them — see `createSandbox` in
  `addon/chrome/content/minit/minit.js`.
