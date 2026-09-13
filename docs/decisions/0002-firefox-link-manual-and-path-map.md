# 0002: Firefox source link is created manually; the JSON path map replaces the setup script

- **Status:** accepted
- **Date:** 2026-09-13

## Context

[ADR 0001](./0001-agent-skills-and-local-links.md) shipped `config/setup-firefox-link.mjs` to
(re)create the untracked `firefox_code.local` link and store one chosen omni.ja path. Using it
surfaced two things: the maintainer prefers to manage the link by hand (it is a one-line
`mklink /J`), and a single stored path is not enough — TabMix compatibility work reads several
Firefox channels side by side (Nightly, Developer Edition, Beta, Release, ESR, previous ESR), whose
unpack paths are already catalogued in the sibling `firefox-updater` project
(`src/helpers/paths.js`).

## Decision

Drop the setup script; the link is created manually and the path map is data, not code. Items 1 and
3 of ADR 0001 (tracked agent docs; flat tracked skills) remain in force — only the link mechanism
changes:

1. `config/setup-firefox-link.mjs` is removed from the repository.
2. `config/.firefox-link.local.json` (gitignored) holds the unpack path per channel (`nightly`,
   `aurora`, `beta`, `release`, `esr`, `esr_previous` — keys matching
   `firefox-updater/src/helpers/paths.js`), plus the active `firefoxOmni` the link points at. The
   maintainer keeps the file and the link up to date by hand; paths use `/` separators.
3. `firefox_code.local` stays the single active link (untracked), so AGENTS.md, the skills, and the
   firefox-source MCP server keep referencing one stable name. To read another channel, agents take
   its path from the JSON and read it directly.

## Consequences

One less script to maintain and no validation logic to keep in sync with Firefox's unpack layout;
every channel is readable from the JSON without re-pointing the link. What gets harder: nothing
validates the paths or the link — a stale entry is caught only when a read fails (the
`firefox-source` skill documents what a valid unpack must contain), and creating the link on a fresh
machine now relies on the documented one-liner.

Revisit-if: multi-machine contributors need automated setup, or the channel list grows beyond what a
hand-edited JSON can keep accurate.
