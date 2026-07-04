# The gate CLI (Layer A) — paths, subcommands, failure rule, CI reading

## Two layers of truth

- **Layer A — the deterministic script** at `<GATE>` (resolved in SKILL.md). Its JSON output is
  **ground truth**. Run it; quote it; **never recompute its numbers by eye** or argue with it. A
  `hard_fail: true` is an automatic stop.
- **Layer B — your reasoning**, fed by Layer A's facts. You score the three axes (see
  `rubrics.md`), always citing evidence.

## The `<GATE>` / `<PLUGIN>` paths

SKILL.md defines these from `${CLAUDE_SKILL_DIR}`, which is substituted to an absolute path when the
skill loads: **`<GATE>`** is the `pr-gate.js` path and **`<PLUGIN>`** the plugin directory. Copy them
verbatim into every command and file read. Never put `${CLAUDE_PLUGIN_ROOT}` in a Bash command or
file path — it is not available to skills.

Run the script with node, substituting `<GATE>`:

```
node "<GATE>" preflight
node "<GATE>" check-paths <path…>
node "<GATE>" scan-diff
node "<GATE>" ci-status <pr-number>
node "<GATE>" help          # lists the subcommands; exits 0
```

## Subcommand → stage map

Each subcommand belongs to a specific stage — run the one the step calls for, and no other.

| Subcommand | Stage | Purpose |
|---|---|---|
| `preflight` | Pre-flight and Ticket + branch | tree/branch/base/gh readiness + branch convention |
| `new-branch <ticket> <slug>` | Ticket + branch | validate Jira id, build a convention branch name |
| `check-paths <path...>` | Execute (before editing) | deterministic deny-list pre-check on the file(s) you're about to touch; `denied: true` is a STOP → handoff |
| `scan-diff [base]` | Gate 2 (assess the diff) | deny-list hits, file/LOC counts, ceiling check (needs a real diff) |
| `ci-status <pr>` | Gate 2 and Mark ready | stability-aware CI read (needs an open PR) |
| `help` | any time | prints the menu, exits 0 — the only safe way to probe |

**Gate 1 (assess the plan) has NO Layer A subcommand.** There is no diff yet, so there is nothing for the
script to scan; that assessment is pure Layer B reasoning on the plan. Do **not** go hunting for a
plan-stage gate command, and do **not** invoke the gate with guessed flags. If you need to remember
the menu, run `node "<GATE>" help` — it exits 0.

## Layer A failure rule

If the script **errors, exits non-zero, produces no output, or returns `files_changed: 0` when you
know there are changes, that is a STOP.** Do not substitute your own manual inspection,
eye-estimates, or informal counts. Diagnose first (check the exit code, confirm changes are in the
expected state, re-read the JSON). Only proceed once you can quote a clean JSON result. A manual
assessment is never an acceptable substitute for Layer A output.

## How CI reading works

`ci-status <pr>` is **stability-aware** on purpose. Checks on a PR are created *dynamically*, and
**marking a PR ready can itself trigger new checks**, so "watch once, see green, proceed" is buggy.
The script only reports `stable: true, all_passing: true` when every check is terminal, none are
failing, and the **set of checks hasn't grown** for several consecutive polls. Trust its output.
Because of the un-drafting trigger, you **double-watch**: once at Gate 2 (assess the diff) and again
after marking ready (the Mark ready step).

- `all_passing: false` → **Confidence Red** (CI is failing). Hand off.
- `no_checks: true` → the PR has no CI to lean on → Confidence is **thin** (at best Yellow); say so
  honestly.
- If `ci-status` times out without stabilizing, treat it as unverified → do not mark ready; tell
  the operator CI didn't settle and a developer should look.
