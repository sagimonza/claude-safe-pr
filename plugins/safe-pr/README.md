# safe-pr

A Claude Code **plugin** that guides a non-developer from any function (UX designers first; also PM,
CS, …) through producing a small, low-risk pull request — **content** (docs, help text, user-facing
message strings), **styling** (copy, color, spacing, sizing, simple style props, icon swaps), or a
**tightly-bounded, hand-verifiable tweak** (e.g. remembering the last-open tab) — that a developer
then reviews. It runs a deterministic safety gate plus an LLM risk/complexity/confidence assessment,
builds a targeted regression checklist, and only marks the PR ready-for-review when the gates pass.

The shippable set is defined by two invariants, not by change category: a change qualifies only when
its **blast radius is bounded** and it is **hand-verifiable** (the operator can observe both that it
worked and that nothing else moved). Presentational UI is the archetype that satisfies both; content
and bounded tweaks qualify for the subset that clears the same bar — the rest correctly hand off.

The gate is a **filter to reduce dev review burden and stop the obviously-too-risky**, not a
merge wall. The real backstops remain the repo's existing CI and a developer reviewing every PR.
Enforcement is entirely **in-session** — no custom CI check, no repo scaffolding.

Before any change, the flow enforces a clean, up-to-date starting point (a dirty tree is a hard
stop) and requires a **Jira ticket id** — the feature branch must start with it (e.g.
`DEV-12345_change-button-label`). Branch naming is validated deterministically by the gate.

## Layout

The repo root is a Claude Code **marketplace** (`.claude-plugin/marketplace.json`); this plugin
lives under `plugins/safe-pr/`:

```
plugins/safe-pr/
├── .claude-plugin/plugin.json   # manifest
├── skills/safe-pr/SKILL.md      # entry point + guided-flow wizard spine (Steps 0–11)
│   └── reference/               # triggered reads: change catalog, rubrics, gate CLI, deny-list + handoff
├── bin/pr-gate.js               # Layer A: deterministic checker (ground truth)
├── lib/                         # pure logic (unit-tested) + thin git/gh I/O seams
├── test/                        # node:test suite (no devDependencies)
├── config/gate.config.json      # deny-list globs + thresholds (dev-tunable)
├── templates/pr-body.md         # PR body: scorecard + spec + checklist
└── tsconfig.json                # dev-time JSDoc type checking (checkJs + noEmit)
```

## Requirements

- **Node ≥ 20**, `git`, and the GitHub CLI `gh` (authenticated) on PATH. (`jq` is no longer
  required — the gate is plain JavaScript on Node built-ins, zero runtime dependencies.) Node is
  already present wherever Claude Code runs.
- Each target repo has a top-level `CLAUDE.md` with build/run instructions (enough for the operator
  to exercise the change by its verification method — run the app, or build/preview a doc) and tests
  that run in CI per PR.

## Install locally (for iteration)

This plugin lives in the `claude-non-dev-pr` marketplace at the repo root. Add the marketplace
(the repo root, **not** this plugin directory), then install the plugin from it:

```
/plugin marketplace add /Users/sagi.monza/repos/claude-non-dev-pr
/plugin install safe-pr@claude-non-dev-pr
```

Then run `/safe-pr:safe-pr` in a target repo and follow the guided flow. (The wizard is a **skill**,
invoked directly — there is no separate command wrapper. A same-named command would collide with the
skill and prevent its body from loading.)

## The deterministic gate (`bin/pr-gate.js`)

Run standalone for testing:

```
node bin/pr-gate.js preflight                  # tree/branch/base/gh readiness + branch convention
node bin/pr-gate.js new-branch DEV-12345 <name># validate Jira id, build a convention branch name
node bin/pr-gate.js check-paths <path...>      # deny-list pre-check for files about to be edited
node bin/pr-gate.js scan-diff [base_ref]       # deny-list hits, file/LOC counts, ceiling check
node bin/pr-gate.js ci-status <pr-number>      # stability-aware CI read
node bin/pr-gate.js config                     # dump the effective merged config
node bin/pr-gate.js help                       # print usage and exit 0 (safe to probe)
```

`help` (and the `--help`/`-h` aliases) exits 0 — probing the gate for its menu must never look
like a failure. Every other invocation either returns JSON (exit 0) or is a usage error (exit 2);
the skill treats any non-zero exit as a STOP.

All output is machine-readable JSON. The skill treats it as ground truth and never recomputes
the numbers by eye. A `hard_fail: true` (deny-list hit or over ceiling) is an automatic stop.

## Development

Pure logic lives in `lib/` behind injected I/O seams so it can be unit-tested without a live
repo. Run the test suite (no install, no `node_modules`):

```
node --test
```

Optional dev-time type checking via JSDoc + `tsconfig.json` (`checkJs`/`noEmit`). It needs
`typescript` and `@types/node` available (e.g. globally or `npx`); it is a lint, not a runtime
gate, and the plugin ships no dependency manifest with dependencies.

## Per-repo config override

Drop a `.safe-pr.config.json` at a target repo's root to override thresholds or extend the
deny-list; it is deep-merged on top of `config/gate.config.json`.

## Tuning

The numbers in `config/gate.config.json` (`max_files`, `max_loc`, CI poll settings) are starting
guesses — tune them against real PRs. See `plans/safe-pr-plugin-plan.md` §13 for the calibration
roadmap.
