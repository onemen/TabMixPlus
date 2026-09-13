---
name: change-workflow
description:
  Step-by-step workflow for making code changes in this repository — identify the Firefox subsystem
  involved, check the decision log, use the firefox_code.local link or the firefox-source MCP
  server, make the smallest change, and validate with typecheck, eslint, and prettier. Use when
  planning or starting any code change, or when the user asks about the process.
---

# Making a change

## 1. Understand the Firefox side first

Tab Mix Plus works by modifying Firefox internals at runtime (see `addon/modules/Changecode.sys.mjs`
and the `Cu.evalInSandbox` injection), so almost every bug starts on the Firefox side:

- Locate the component through the mapping in AGENTS.md ("Firefox key components") — gBrowser
  (`Tabbrowser.sys.mjs`), the tab container (`tabs.js`), drag & drop (`drag-and-drop.js`), the
  scrollbox (`arrowscrollbox.js`), a single tab (`tab.js`).
- Read the Firefox source through the `firefox-source` MCP server when configured, otherwise the
  `firefox_code.local` link. The link is created manually by the user; per-channel unpack paths are
  listed in `config/.firefox-link.local.json` (see the `firefox-source` skill).
- Check the version notes in AGENTS.md — since Firefox 156 much moved to `moz-src/`, and many
  gBrowser methods are private (`#method`); see `Tabmix.getPrivateMethod` in
  `addon/chrome/content/minit/minit.js`.

## 2. Check the decision log

Open [docs/decisions/index.md](../../../docs/decisions/index.md) before proposing anything
architectural. If a skill matches the task, load it.

## 3. Make the smallest change

- Match the surrounding style; the file's existing formatting wins over general preference.
- Remember the multi-row constraint: Tab Mix Plus re-implements parts of tab layout and drag & drop
  for multi-row tabs, so Firefox changes can invalidate TabMix assumptions in
  `addon/chrome/content/minit/minit.js`.
- When Firefox code references module-scoped constants (e.g. `DROP_ANIMATION_GRACE_MS` in
  drag-and-drop.js), the sandbox that evaluates the modified code must define them — see
  `createSandbox` in minit.js.
- Do not modify `@types/gecko` (imported Firefox types); project overrides live in
  `@types/overrideGecko.d.ts`.

## 4. Validate

```bash
pnpm typecheck   # tsc --build over JSDoc-typed JS; output lands in tsc.local.txt
pnpm lint        # eslint with --fix (config in config/)
pnpm format      # prettier (config in config/prettier.config.js)
pnpm stylelint   # addon/**/*.css
```

Run `pnpm typecheck` last: it reads the whole project and catches what the linters cannot.

## 5. Update the docs when behavior changes

If a change invalidates a statement in AGENTS.md, a skill, or an ADR, update that document in the
same change — stale agent docs are worse than none.
