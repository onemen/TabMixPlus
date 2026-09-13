# 0001: Agent docs are tracked; machine-specific paths stay behind a setup script

- **Status:** superseded by [0002](./0002-firefox-link-manual-and-path-map.md) <!-- accepted -->
- **Date:** 2026-09-13

## Context

The agent instructions file (`AGENTS.md`) is the shared entry point for every agent and contributor
working on Tab Mix Plus. Until now it was listed in `.gitignore` ("ignore local AGENTS.md"), so it
existed only on the maintainer's machine: agents on other machines (or fresh clones) started with no
instructions at all, and the file could not be improved for anyone else.

At the same time the file embedded machine-specific values — most prominently the absolute path of
the local Firefox `omni.ja` unpack behind the `firefox_code.local` link, which differs per machine
and per Firefox channel. Committing that path would break every other checkout, which is why the
whole file had been kept untracked.

The sibling project `firefox-scripts` demonstrates the pattern this decision adopts: tracked
`AGENTS.md`, a decision log in `docs/decisions/`, and task procedures as skills in
`.agents/skills/`.

## Decision

Track the agent documentation, and keep machine-specific values out of it:

1. **`AGENTS.md`, `docs/decisions/`, and `.agents/skills/` are tracked.** The gitignore entry moves
   to `AGENTS.local.md` for genuinely personal notes.
2. **`firefox_code.local` stays untracked and is (re)created with
   `node config/setup-firefox-link.mjs`.** The script validates the target (an unpacked omni.ja
   folder with `browser/` and `chrome/`), saves the chosen path to `config/.firefox-link.local.json`
   (gitignored), and creates a junction/symlink — no absolute path is ever written into a tracked
   file. AGENTS.md references the link by name only.

   _Superseded by [0002](./0002-firefox-link-manual-and-path-map.md): the link is created manually
   and `config/.firefox-link.local.json` holds a path map for all Firefox channels._

3. **Skills live in `.agents/skills/<name>/SKILL.md`, flat and tracked.** Task detail goes there so
   AGENTS.md stays a checklist. Personal skills live in user scope (`~/.agents/skills/`) and are
   never committed.

## Consequences

Fresh clones get the full agent docs immediately; the one machine-specific step (pointing
`firefox_code.local`) becomes a single documented command. The maintainer's path may change freely
without touching git history.

What gets harder: agents that previously relied on the link existing out-of-band must run the setup
script once (the script's `--check` makes that automatable). Gitignore rules now differentiate
tracked from local files more precisely — a new `*.local.md` file under `docs/` or `.agents/` still
requires an explicit ignore entry.

Revisit-if: a second machine-specific value needs to be embedded in agent docs (extend the setup
script into a general `setup` command first), or the `firefox-source` MCP server fully replaces the
link for every workflow.
