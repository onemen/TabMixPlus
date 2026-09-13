# This project is a legacy Firefox browser extension written in Javascript.

## Firefox's codebase and APIs

Firefox source (unpacked `omni.ja`) is read through a **local link** named `firefox_code.local` at
the repository root, pointing at the Firefox Nightly unpack. The link is machine-specific: it is
intentionally not tracked by git, and it is created **manually**:

```bash
cmd //c mklink /J firefox_code.local "C:/path/to/unpacked/Firefox Nightly - omni"
```

The paths of all local Firefox unpacks (Nightly, Developer Edition, Beta, Release, ESR, previous
ESR) are listed in `config/.firefox-link.local.json` (gitignored, `/` separators) under `channels`;
the active link target is its `firefoxOmni` value. The user keeps the link and the file in sync by
hand. To read a different channel, take its path from `channels` and read it directly.

An unpack must contain `chrome/browser/content/browser/browser.xhtml`; 156+ unpacks also have
`moz-src/` (see the `firefox-source` skill).

> Prefer the `firefox-source` MCP server tools to read Firefox files when that server is configured;
> the link is the fallback for direct `read_files`/`code_search` access.

### Firefox version notes (156+)

- Starting from Firefox 156 `tabbrowser.js` was replaced by the shared module
  `firefox_code.local/moz-src/browser/components/tabbrowser/Tabbrowser.sys.mjs` (the `gBrowser`
  Tabbrowser class moved to moz-src; see bug 2049770).
- Sessionstore and other browser components also moved to `moz-src` (see bug 2062783).
- Many previously public gBrowser methods are now private (`#method` in Tabbrowser.sys.mjs). Use
  `Tabmix.getPrivateMethod` to reconstruct them, see `addon/chrome/content/minit/minit.js`.

### Firefox key components

- gBrowser - class Tabbrowser -
  `firefox_code.local/moz-src/browser/components/tabbrowser/Tabbrowser.sys.mjs`
- gBrowser.tabContainer - class MozTabbrowserTabs -
  `firefox_code.local/chrome/browser/content/browser/tabbrowser/tabs.js`, tabs id="tabbrowser-tabs"
  in `firefox_code.local/chrome/browser/content/browser/browser.xhtml`
- tab drag & drop controller - class TabDragAndDrop -
  `firefox_code.local/chrome/browser/content/browser/tabbrowser/drag-and-drop.js`
- gBrowser.tabContainer.arrowScrollbox - class MozArrowScrollbox -
  `firefox_code.local/chrome/toolkit/content/global/elements/arrowscrollbox.js`, arrowscrollbox
  id="tabbrowser-arrowscrollbox" in
  `firefox_code.local/chrome/browser/content/browser/browser.xhtml`
- each tab - class MozTabbrowserTab -
  `firefox_code.local/chrome/browser/content/browser/tabbrowser/tab.js`, tab is="tabbrowser-tab"
  class="tabbrowser-tab" in `firefox_code.local/chrome/browser/content/browser/browser.xhtml`

## Tools

- editor: vscode
- linter: eslint, stylelint
- prettier
- some tools scripts and config files located at ./config

## MCP Servers

- use tools from firefox-source mcp server to read files from firefox source code

## Type safety

- although this project is in Javascript, xhtml and css, it uses typescript to perform type check.
- JSDoc for type checking
- TypeScript definitions (.d.ts files) for type safety are in path: `@types`
- imported type from firefox (DO NOT MODIFY) are in path: `@types/gecko`
- our overrides of firefox types are in `@types/overrideGecko.d.ts`
- run `tsc --build` to check types; it prints errors to the terminal

## Testing

The test plan — priority tiers, the coverage rule for worktree changes, and the local-first E2E
suite — lives in [docs/test-plan.md](./docs/test-plan.md); decisions in
[ADR 0003](./docs/decisions/0003-local-first-test-suite.md). Engine details and run commands:
[test/E2E/README.md](./test/E2E/README.md).

## Tab Mix Plus

- modify Firefox-specific DOM APIs and XUL/XHTML elements by injecting and replacing firefox
  internal code. the extension uses Cu.evalInSandbox to evaluate the modified code see
  `addon/modules/Changecode.sys.mjs`

### TabMix multi-row feature

- tabmix add multi-row feature to Firefox

### Tabs Drag & Drop

- firefox handle tabs drag&drop in class TabDragAndDrop (drag-and-drop.js) and class
  MozTabbrowserTabs (tabs.js).
- TabMix modify and extend it to handle multi-row tabs
- TabMix modify drag&drop in `addon/chrome/content/minit/minit.js`
- when Firefox code references module-scoped constants (for example `DROP_ANIMATION_GRACE_MS` in
  drag-and-drop.js), the sandbox used to evaluate the modified code must define them; see
  `createSandbox` in minit.js

## Decision records

Architecture decisions are recorded as ADRs (architecture decision records) in `docs/decisions/` —
the **steering veto list**: open [docs/decisions/index.md](./docs/decisions/index.md) before
proposing a new primitive, surface, or architecture change; a decision already made usually covers
the need. The records are point-in-time documents written after the fact, usually a **no** with a
revisit-if.

- Template: `docs/decisions/0000-template.md` — copy to the next unused `NNNN` with a kebab-case
  slug; keep the record to roughly half a page (Context / Decision / Consequences).
- One decision per record. Supersede, don't edit: mark the old record `superseded by NNNN` and list
  it under the index's Historical section. Validate with `pnpm check:decisions`.
- The `adr` skill in `.agents/skills/adr/` walks through writing one.

## Skills

Task-specific procedures live as agent skills in `.agents/skills/<name>/SKILL.md`; detail lives
there so this file stays a checklist, not a manual. All skills are direct children of
`.agents/skills/` (flat, tracked; see
[ADR 0001](./docs/decisions/0001-agent-skills-and-local-links.md)):

| Skill             | Kind     | When to load it                                                 |
| ----------------- | -------- | --------------------------------------------------------------- |
| `adr`             | authored | Writing or updating an architecture decision record             |
| `change-workflow` | authored | Planning or starting any code change in this repository         |
| `firefox-source`  | authored | Locating Firefox source files (components, version notes, link) |

All paths are `<root>/.agents/skills/<name>/SKILL.md`. Personal skills live in user scope
(`~/.agents/skills/`) and are never committed.
