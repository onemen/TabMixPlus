# 0003: Test suite lives in this repo and is local-first; CI automation is a later milestone

- **Status:** accepted
- **Date:** 2026-09-13

## Context

Recent Firefox 156+ followups broke TabMix in ways a manual audit caught only after release
(undetected `#private`-method moves, sandbox scope changes, lazy-import regressions). The goal is
that every code change is covered by a test — unit tests for pure logic, E2E tests (puppeteer-core +
WebDriver BiDi) driving real Firefox instances with the legacy loader installed, and an automated
`verify-firefox-internals` audit against pinned omni unpacks.

The full plan, its priorities, and the per-branch coverage map live in the maintainer's local
`docs/plan/TEST-PLAN.local.md` — deliberately untracked (every `*.local.*` file stays out of the
repo). The first deliverable — the E2E engine and smoke suite — exists on `wip/test-suite` (see
`test/E2E/README.md`).

## Decision

1. **Tests live in this repository**, under `test/` alongside the addon — unit tests read the addon
   sources directly and E2E runs against the repo's own XPI build; a separate test repo could only
   ever exercise the last published dev-build.
2. **Local-first**: the maintainer runs all suites manually on Windows 11 for now
   (`node test/E2E/run.mjs --suite=...`, `pnpm test:unit`); suites must run identically locally and
   in CI. Automated CI — unit + E2E on every new Firefox release/fork, watchdogs, issue reporting —
   is a later milestone, introduced `workflow_dispatch`-first so nothing runs unattended before it
   is trusted.
3. **Test-suite work happens on `wip/test-suite`**, never directly on main; it lands when the
   maintainer decides (squash, merge, or cherry-pick per slice). Engine code carries its
   verification status — the phase-1 smoke suite was maintainer-verified on Nightly (11/11,
   2026-09-13) before landing.
4. **No merge without coverage**: once the suite lands on main, every change merged to main carries
   a test matching its priority tier in the maintainer's `docs/plan/TEST-PLAN.local.md` (P0 smoke +
   verify-internals at minimum).

## Consequences

EarlyFirefox-breakage detection without waiting for user reports; the maintainer keeps full control
over when browser automation consumes machine time. What gets harder: discipline — the coverage rule
is local and self-enforced until CI exists, and the E2E environment is tied to the maintainer's
installed browsers (see `config/.firefox-link.local.json` and the firefox-updater paths) rather than
a hermetic CI download path; the profile factory must keep both modes working.

Revisit-if: a Firefox release breaks the addon between manual runs (pull the watchdog forward), or a
second machine/developer needs reproducible runs (add the portable-browser download path from the
plan's phase 1 to CI).
