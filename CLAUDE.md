# claude-non-dev-pr

A Claude Code **marketplace** of plugins that guide **non-developers** (UX designers first)
through shipping small, low-risk changes safely. The repo root is the marketplace
(`.claude-plugin/marketplace.json`); each plugin lives under `plugins/`.

## Layout

```
.claude-plugin/marketplace.json   # marketplace manifest — lists plugins + their versions
plugins/safe-pr/                  # the safe-pr plugin (see plugins/safe-pr/README.md)
plans/                            # design/planning docs (not shipped)
```

Today there is one plugin, **safe-pr**. Its own architecture (the Layer A deterministic gate vs.
Layer B LLM reasoning, the guided flow, the deny-list) is documented in
`plugins/safe-pr/README.md` and `plugins/safe-pr/skills/safe-pr/SKILL.md` — read those before
touching plugin internals.

## Versioning — REQUIRED on every change

Every change must bump the plugin version, and the version is recorded in **two files that must
stay in sync**:

- `plugins/<plugin>/.claude-plugin/plugin.json` → `version`
- `.claude-plugin/marketplace.json` → the plugin's `version` entry

Both files always carry the **same** version for a given plugin. Update them together in the same
change; never bump one without the other.

Bump per [semver](https://semver.org/), choosing the level by change type:

- **patch** (`0.2.0` → `0.2.1`) — bug fixes, wording/docs tweaks, test-only changes, config
  threshold tuning. No change to the flow's contract or behavior the operator relies on.
- **minor** (`0.2.0` → `0.3.0`) — new backward-compatible functionality: a new gate or step, a
  new `pr-gate.js` subcommand, a new config option with a safe default.
- **major** (`0.2.0` → `1.0.0`) — breaking changes: removing/renaming a subcommand or config key,
  changing the gate's JSON contract, or reworking the flow in a way that changes what a caller or
  the skill depends on.

Docs-only changes at the repo root (like this file) don't require a plugin bump, but anything
under `plugins/<plugin>/` does.

## Working in this repo

- **Tests:** the safe-pr plugin uses `node:test` with no dependencies. Run `node --test` from
  `plugins/safe-pr/`. Add/adjust tests for any logic change in `lib/`.
- **No runtime dependencies:** the gate is plain JavaScript on Node built-ins (Node ≥ 20). Don't
  introduce a dependency manifest with runtime deps.
- **Pure logic vs. I/O:** decision logic lives in `lib/` behind injected I/O seams (git/gh) so it
  stays unit-testable; `bin/pr-gate.js` is the thin CLI that wires real I/O in. Keep that split.
- **Deterministic gate is ground truth:** changes to `lib/`/`bin/` must keep "same input → same
  output." Don't move risk decisions out of the skill into the script, or vice versa.

## Flow-step numbering convention

The guided flow in `SKILL.md` is a numbered sequence of steps. Keep it maintainable under edits:

- **Steps are always whole integers.** Never use a fractional label like `Step 0.5` to squeeze a
  step in between two others.
- **To insert a step, renumber.** Give the new step the next integer and **increment every
  following step** (and its progress-checklist entry) so the sequence stays contiguous.
- **Every step has a name.** The canonical form is `Step N — <name>`.
- **Don't reference a step by its number in prose** — numbers drift whenever a step is inserted.
  Refer to a step by its **name** (e.g. "at the visual satisfaction loop", "read again at Gate 2").
  Numbers belong only in the step headings and the progress checklist, which are the definition,
  not a cross-reference. If a number reference is truly unavoidable, pair it with the name.
