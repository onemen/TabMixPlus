---
name: adr
description:
  When and how to write an architecture decision record (ADR) in docs/decisions/ — the steering veto
  list to open before proposing a new primitive, surface, or architecture change. Use when a
  decision was made that the next agent or contributor would otherwise re-propose, when asked to
  record or update a decision, or before proposing any architectural change.
---

# Writing an architecture decision record

Decisions live in `docs/decisions/`. Open
[docs/decisions/index.md](../../../docs/decisions/index.md) **first** — a decision already made
usually covers the need, and the index explains what belongs here.

## When to write one

- You decided **not** to build something the next agent will otherwise re-propose (the usual record
  is a product-shaped **no** with a revisit-if).
- An architectural change landed and later maintainers will need the "why".
- A later decision changes an earlier one — **supersede, don't edit**: mark the old record
  `superseded by NNNN`, list it under the index's Historical section, leave the text alone.

Do **not** write one for layout/UI tweaks, a library pick the code already encodes, or because a PR
shipped. When unsure whether something qualifies, prefer no record.

## How

1. Read the index on main to get the next unused number. Number collisions are the failure mode of
   writing ADRs per-PR; if one happens, renumber the later record — never leave duplicates.
2. Copy [0000-template.md](../../../docs/decisions/0000-template.md) to `NNNN-kebab-case-slug.md`.
3. Write it **after** the decision is made, roughly half a page: Context (what forced it, links to
   code/docs), Decision (one or two sentences), Consequences (what stays simple, what gets harder,
   the **revisit-if**).
4. Add a line to the index — the steering list for records that should steer future proposals,
   Historical for superseded ones.
5. Run `pnpm check:decisions` — it validates numbering, slug format, status/superseded links, and
   that every record is linked from the index (see `config/check-decisions.mjs`).

## Example of the shape that steers

See [0001](../../../docs/decisions/0001-agent-skills-and-local-links.md) in this repository, or the
longer history in the sibling `firefox-scripts` repository's `docs/decisions/` (e.g. 0022 there
records why agent skills are managed the way they are).
