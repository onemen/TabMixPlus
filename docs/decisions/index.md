# Decision records

An architecture decision log (ADL) in the
[ADR](https://github.com/architecture-decision-record/architecture-decision-record) format. Open the
list below before proposing a new primitive, surface, or architecture change — a decision already
made usually covers the need. Architecture docs and code describe how the system works today; this
folder records the decisions that shaped it, usually a **no** with a revisit-if.

Linked from AGENTS.md for that check — not as homework and not as a museum.

A good record is half a page: context, the decision, consequences.

Decision records are point-in-time documents written after the fact — they describe what was
decided, not what the code does today.

## When to add a record

Write one after you have already decided not to build something the next agent or contributor will
otherwise re-propose, or when an architectural change lands that later maintainers will need the
"why" of. Copy [0000-template.md](./0000-template.md) to the next unused number (read this index on
main first) with a kebab-case slug. Keep it to roughly half a page.

Do not write an ADR on every PR. Number collisions are the failure mode of that habit; if a number
collides, renumber the later record — never leave duplicates.

Do not record layout or UI tweaks, mode assignments, or "we use library X" unless that pick is a no
that will otherwise be re-litigated.

When a later record changes a decision, mark the old one `superseded by NNNN` rather than editing or
deleting it, and list it under Historical. History stays; it is not silently deleted.

## Steering list

Open these before proposing a new primitive, surface, or architecture change.

- [0001](./0001-agent-skills-and-local-links.md) — Agent docs are tracked (AGENTS.md, ADRs,
  `.agents/skills/`); machine-specific paths stay untracked, never hardcoded in AGENTS.md — link
  mechanism superseded by [0002](./0002-firefox-link-manual-and-path-map.md)
- [0002](./0002-firefox-link-manual-and-path-map.md) — `firefox_code.local` is created manually;
  `config/.firefox-link.local.json` maps every Firefox channel to its unpack path; no setup script
- [0004](./0004-commit-convention.md) — commit subjects follow Conventional Commits; Firefox
  followups are `chore: followup bug NNNNNNN - <title>`; issue fixes carry `(closes #NNN)`

## Historical

(none yet — list superseded records here when one is replaced)
