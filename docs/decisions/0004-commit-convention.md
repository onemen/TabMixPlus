# 0004: Commit subjects follow Conventional Commits with TabMix followup convention

- **Status:** accepted
- **Date:** 2026-09-13

## Context

`config/husky/commit-msg` enforces the subject format on `main` only:
`type(optional-scope): message` with lowercase first letter and a 110-character limit, where type is
one of `feat fix docs style refactor perf test build ci chore revert`. A `commitlint.config.js`
extended `@commitlint/config-conventional` with the same limit, but was removed (2026-09-13):
commitlint was slow, and the husky hook is the single enforcement point.

History adds two project-specific conventions the hook does not know about: 224 commits
`chore: followup bug NNNNNNN - <Firefox bug title>` track adaptations to Firefox changes (a followup
is `chore`, never `fix`, because it ports upstream behavior rather than repairing a regression), and
fixes close issues with a `(closes #NNN)` subject suffix (`(fixes #NNN)` appears once as a variant).
Scopes are essentially unused (one `chore(types):` in 300+ commits), and
`chore: update dependencies` is the recurring maintenance subject. Generated-by footers are allowed
in the body; the hook only validates the first line.

## Decision

Keep the hook as the single enforcement point and write down what it does not check:

1. **Subject**: `type(optional-scope): lowercase message`, ≤ 110 chars, exactly as enforced by
   `commit-msg` on `main`. Scopes stay rare — use one only when the type alone is ambiguous.
2. **Firefox followups**: `chore: followup bug NNNNNNN - <bug title>`, when a change ports behavior
   from a specific Firefox bug. Body bullet-points the TabMix-side adaptation.
3. **Issue fixes**: `fix: <what was broken> (closes #NNN)` — `(closes #NNN)` in the subject, not the
   body.
4. **Ported fixes**: `(Commit <sha>)` suffix when importing a fix authored elsewhere.
5. **Releases**: `Release version X.Y.Z` is exempt (it is a tag-cut, not a subject; do not mass-
   rewrite history to conform).
6. Bodies are free-form; footers allowed. Do not add `BREAKING CHANGE:` trailers — add-on versions
   communicate compatibility (`strict_min_version` in install.rdf), not commit trailers.

## Consequences

Subjects stay greppable (`git log --grep '^chore: followup'` yields the Firefox-adaptation history;
`--grep '(closes #'` the issue fixes) and the changelog stays hand-curated from release tags rather
than generated from subjects. The husky `commit-msg` hook also only guards `main`, so `wip/*`
branches can carry non-conforming subjects that are fixed up at merge time (acceptable, since merges
into `main` are local and frequent).

Revisit-if: a second developer joins (wire commitlint on all branches), or changelog generation
switches to parsing subjects (then trailers and scopes need tightening).
