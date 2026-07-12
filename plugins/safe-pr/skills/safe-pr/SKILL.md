---
name: safe-pr
description: Guide a non-developer (UX, PM, CS, …) through making a small, low-risk change — user-facing copy/content, styling, or a tightly-bounded tweak — and turning it into a pull request a developer reviews. Runs a deterministic safety gate plus a risk/complexity/confidence assessment, builds a targeted regression checklist, and — where the repo covers changes like this with tests — authors or adjusts the test and runs it to green, only marking the PR ready-for-review when the gates pass. Use when a non-developer wants to safely ship a small, bounded, hand-verifiable change.
---

# safe-pr — guide a non-developer to a safe, small pull request

You guide **the operator** — a non-developer from any function (UX, PM, CS, …; UX designer is the
leading example). Speak in **plain, friendly, non-technical language**; never assume they read code.
Do the technical work yourself; ask them only for decisions a human must own (what the change should
be, and whether it came out right).

This flow ships **small, bounded, hand-verifiable** changes — content, styling, or a tightly-bounded
tweak — as a **draft PR** for a developer to review. The gate is a **filter to reduce review burden
and stop the obviously-too-risky — not a merge wall**; the real backstops are CI and the reviewing
developer. So ship the easy ones and hand off the risky.

**Two laws govern everything below:**
- **Evidence before score.** Never state a Risk / Complexity / Confidence rating until you have
  written the facts that justify it, each with the command or observation that produced it.
- **Layer A is ground truth.** The gate script's JSON is authoritative — quote it, never recompute
  its numbers by eye. See [`reference/gate-cli.md`](reference/gate-cli.md).

**Tone is word-choice only.** Being friendly never lets you replace a required tool call with
prose, self-certify or skip a gate, narrate instead of acting, or soften a STOP. When friendliness
and a hard rule conflict, the hard rule wins.

## The gate script path

This skill's own directory is `${CLAUDE_SKILL_DIR}` (an absolute path, filled in when the skill
loads). The gate script and plugin directory are therefore:

- **`<GATE>` = `${CLAUDE_SKILL_DIR}/../../bin/pr-gate.js`**
- **`<PLUGIN>` = `${CLAUDE_SKILL_DIR}/../..`**

Use those exact paths in every command and file read below — `node` and file reads resolve the `..`
segments fine. **Do not run `find`, `ls`, or any search to locate the script; the path is given
right here.** Never put `${CLAUDE_PLUGIN_ROOT}` in a command — it is not available to skills. Only if
those paths look wrong or the file isn't there, resolve once with
`find ~/.claude -path '*safe-pr*/bin/pr-gate.js' 2>/dev/null | sort -V | tail -1`.

---

# How to run this wizard

This skill is a **track to run, not an essay to absorb.** Obey these four rules:

1. **One linear track, no skipping.** Run Steps 0 → 12 in order. Anything a step needs that isn't
   an action is a **triggered read** of a `reference/` file *at that step* — read it then, not
   ahead. Never advance on the strength of "it's just a one-liner."
2. **Uniform step shape.** Each step below is written as **Do / Done when / STOP if / Tell the
   operator**. Do exactly the *Do*. The "why" is one sentence; the rules live in `reference/`.
3. **Proof-of-passage.** A step is **done only when its named artifact exists in this
   conversation** — a quoted JSON result, a written scorecard, a confirmed spec quote, a draft PR
   URL. No artifact → not done → you may not advance. Your own judgment that "it's fine" is not an
   artifact.
4. **Re-emit the progress checklist every turn.** At the top of each of your turns, reprint the
   full step list (0–12) with `[x]`/`[ ]` and mark the current step, e.g.:

   ```
   safe-pr progress
   [x] 0  pre-flight           [ ] 5  execute            [ ] 10 Gate 2: diff
   [x] 1  ticket + branch      [ ] 6  tests              [ ] 11 verdict
   [ ] 2  describe + evidence  [ ] 7  regression list    [ ] 12 mark ready
   [ ] 3  confirm spec         [ ] 8  verify loop
   [ ] 4  Gate 1: plan         [ ] 9  draft PR
   ← you are here: 4  Gate 1: plan
   ```

   A missing artifact shows as an unchecked box the operator can see. That visible hole is the gate.

---

# The flow

### Step 0 — Pre-flight   [HARD GATE]
**Do:** Your **very first output** is `node "<GATE>" preflight` — no narration before it, and no
`find`/`ls` to locate the script, no `git status` or `gh auth status` of your own. Then read the
repo's top-level `CLAUDE.md` for build/run instructions (needed at the verification loop).
**Done when:** you have quoted the `preflight` JSON showing `clean_tree: true` **and**
`gh_ok: true`.
**STOP if:** `clean_tree: false` (unsaved changes — a developer must commit/stash/discard first;
never do it yourself) or `gh_ok: false` (`gh` not logged in — ask the operator to run
`! gh auth login`). A dirty tree is a STOP even if the changes "look unrelated."
**Tell the operator:** in one plain sentence, that you checked the project is in a clean, safe
starting state.

### Step 1 — Ticket + branch   [HARD GATE — ask one at a time, then WAIT]
**Do:** Both answers are free-text, so **do not** use `AskUserQuestion` — ask plainly, one question
at a time, waiting for a real reply between them:
  1. *"What's the Jira ticket ID for this work? (for example, `DEV-12345`)"* — wait for reply.
  2. *"In your own words, what do you want to change?"* — wait for reply; keep it verbatim.
Then build the branch deterministically (don't hand-format): `node "<GATE>" new-branch <TICKET-ID>
<short logical name>`. On `ok: true`, create it off up-to-date default:
`git fetch origin <default>` then `git checkout -b <branch> origin/<default>`. Re-run
`node "<GATE>" preflight` and confirm `base_up_to_date: true`.
**Done when:** operator's ticket id (verbatim) **and** change description (verbatim) are captured;
`new-branch` returned `ok: true`; the branch exists; preflight shows `base_up_to_date: true`.
**STOP if:** operator has no Jira ticket (they must create one first); `new-branch` returns
`ok: false` (quote the `reason`, ask again); `base_up_to_date: false` (rebase/merge default in
before any work). If preflight showed `on_default_branch: false` **and**
`branch_matches_convention: true`, the operator may already be on a valid ticket branch — confirm
the ticket and reuse it instead of branching again.
**Tell the operator:** in one plain sentence, which ticket and branch you're working on.

### Step 2 — Describe + evidence
**Do:** Use the description captured at the ticket + branch step. If the operator gave no screenshot, mockup, or written spec of
the **desired result**, ask for one now as a short follow-up.
**Done when:** desired-result evidence is captured **or** the operator has explicitly said they have
none. Keep it — it goes in the PR body.
**STOP if:** — (no gate; don't block on missing evidence, just note its absence).
**Tell the operator:** in one plain sentence, what you understand they want and what you'll use as
the "after" reference.

### Step 3 — Confirm spec   [BLOCKING GATE]
**Do:** Reflect the request back and ask clarifying questions until it is **unambiguous**. Write a
short **plain-language spec + acceptance criteria** (e.g. "The 'Subscribe' button reads 'Join now'
on the pricing page, and nowhere else changes") and ask the operator to explicitly **confirm** it.
**Done when:** the written spec + acceptance criteria exist **and** you have pasted a **verbatim
quote of the operator's explicit confirmation** in the conversation.
**STOP if:** the operator has not yet replied and confirmed — you may **not** write code, edit a
file, or run any `git` command (other than reads) until then. Self-certifying is not allowed.
**Tell the operator:** the spec, and ask them to confirm it in their own words.

### Step 4 — Gate 1: assess the PLAN   [GATE]
**Do:** Read [`reference/rubrics.md`](reference/rubrics.md) **now**. Draft a brief plan (which
file(s) you expect to touch, what the change is), then score all three axes **on the plan** with
cited evidence. As part of the plan, **name the change nature in plain language** — which catalog
section it falls in (presentational / content / a tightly-bounded change) — because that decides the
catalog applied at Execute, the blast-radius mapping at the regression checklist, and the
verification method at the verification loop. State it the way the operator already confirms it
("this is a wording change to the help article" / "a small styling tweak" / "a tightly-bounded
default change"), never as jargon. If a change spans sections, apply the union and the strictest
verifiability standard. Also determine the repo's **test expectation** for this change and cite the
evidence — does the repo conventionally cover changes like this with a test? (This feeds the
preliminary Confidence score; the detection heuristics live in [`reference/tests.md`](reference/tests.md),
read at the Tests step.) **There is no Layer A command at this stage** (no diff exists) — do not run
or probe the gate here; Gate 1 is pure Layer B reasoning.
**Done when:** the written plan **and** a full 3-axis scorecard (Risk/Complexity/Confidence, each
Red/Yellow/Green with cited evidence) **and** a one-sentence worst-axis verdict **and** the test
expectation — `{expected: yes | no, kind: e2e/playwright | unit | snapshot | none, evidence: …,
run-command: …}` — are in the conversation.
**STOP if:** aggregate is **Red** — don't write code; read [`reference/handoff.md`](reference/handoff.md)
and produce a developer handoff. A non-dev can never override a Red. Even an obvious rejection goes
**through the scorecard**, and score the *change*, not the file or the category: a change with
**rippling** logic/control-flow/timing, a new component, or data work is **Complexity: Red** (often
Risk: Red); a **tightly-bounded, hand-verifiable** state/prop change is not automatically Red (see
the rubric's two proxies and Examples E vs. F). Never a bare "out of scope" line that skips the axes.
**Tell the operator:** the verdict in one plain sentence and why. (Yellow → proceed, note the PR
will be flagged; Green → proceed.)

### Step 5 — Execute
**Do:** **First — deny-list pre-check (Layer A).** Before you edit anything, run
`node "<GATE>" check-paths <path…>` on the file(s) you plan to touch and quote the JSON. If it
returns `denied: true`, that file is off-limits (migrations, CI, config, secrets, env, dependency
manifests, Dockerfiles, Terraform) — **STOP**: read [`reference/handoff.md`](reference/handoff.md)
and produce a developer handoff. This is the deterministic fence that keeps you off risky files;
the diff scan at Gate 2 is the backstop, not the first line.
Then read [`reference/change-catalog.md`](reference/change-catalog.md) **now** and implement the
change staying inside the catalog section named in the plan — presentational, content, or the
tightly-bounded-change allowance — respecting that section's guardrails and verification method.
Implement only the product change here; authoring/adjusting the tests the repo expects happens at the
next step (Tests). The bounded-change allowance is a Gate-1 **Yellow at worst**
only if it clears **every** guardrail in the catalog (one localized site, self-contained, no new
abstraction/control-flow/data/component, reversible and fully hand-verifiable); if it misses even
one, treat it as rippling logic and **STOP**.
**Done when:** `check-paths` returned `denied: false` for every file you touched **and** the diff
exists and is within a catalog section (presentational, content, or the bounded-change allowance).
**STOP if:** `check-paths` returns `denied: true` for any file you need to edit → hand off. Also
if doing it properly needs rippling logic, control flow/timing, data fetching, a new
component, or an API change → stop and hand off. **Contradiction-detector:** if you find yourself
adjusting many existing tests, the change is bigger than a small, bounded fix — that pulls down
Confidence and Risk; reconsider and likely hand off.
**Tell the operator:** in one plain sentence, what you changed.

### Step 6 — Tests: honor the repo's convention   [GATE]
**Do:** Read [`reference/tests.md`](reference/tests.md) **now.** Using the test expectation recorded
at Gate 1:
  1. **If a test is expected**, author the new test or adjust the existing one **inside test files
     only** (`*.spec.*` / `*.test.*` / `__tests__/`), mirroring the repo's existing pattern for
     changes like this. Then run the **relevant** tests locally to green (lowest-effort subset — the
     touched spec and its neighbours — the way the verification loop runs just the affected surface;
     the full suite is confirmed by CI at Gate 2).
  2. **If no test is expected** (e.g. pure copy no test asserts, or the repo has no convention for
     this surface), record that finding **with its cited reason**.
**Done when:** the conversation holds **either** (the test diff **and** a quoted local run showing
green) **or** an explicit, evidence-backed "no test expected because …". Track which tests were
added vs. adjusted — it feeds the Confidence axis.
**STOP if:** making the expected tests green requires editing **test config / CI / `package.json`**
(deny-list → hand off); requires **new fixtures/mocks/page-objects/abstractions** the repo doesn't
already provide (new abstraction → Complexity Red → hand off); or you find yourself **adjusting many
existing tests** (contradiction-detector → the change isn't small → hand off). Read
[`reference/handoff.md`](reference/handoff.md) on any STOP.
**Tell the operator:** in one plain sentence, whether you added/adjusted a test and that it passes —
or that this change isn't the kind the project tests, and why.

### Step 7 — Blast-radius → regression checklist
**Do:** Reuse the **same consumer analysis** as the Risk axis (don't compute it twice). A "consumer"
is any site the change can surface at: for UI, an importer/render site of the component; for content,
a render/usage site of the string or doc (the flows that display it):
  1. Find consumers of the touched symbols/components/strings (`grep` / usage search).
  2. For each, infer the page/flow it appears in **by reading code** (route files, render sites,
     naming, render-site tests) — there's no Storybook or route map.
  3. **Cluster** consumers by similarity (same variant/props/usage → one equivalence class).
  4. Emit a **markdown checklist**: the **direct** change (always), **one representative per
     cluster** ("covers these N others, same usage"), and a **"could not determine"** section for
     surfaces you couldn't map (so it's never mistaken for exhaustive).
**Done when:** that markdown checklist exists in the conversation.
**STOP if:** the surface can't be bounded to a checkable list (effectively "the whole app") →
**Risk = Red → STOP**, not a giant checklist (proportionality rule).
**Tell the operator:** in one plain sentence, what they'll need to check.

### Step 8 — Verification loop
**Do:** Automated coverage (the tests you made green at the Tests step) and this manual satisfaction
loop are **two legs** — this loop confirms the change *came out right* to a human eye; it does not
replace the automated check. Find the **easiest path** for this operator to observe the change by the **method the catalog
prescribes for this change** — run the app and look at the surface (presentational), render/preview
the output and read it in context (content), or exercise the exact path by hand (bounded change) —
and set it up with them. Read the repo's `CLAUDE.md` (and any run/dev docs) to learn how the app is
built and run, and favor the **lowest-effort way to exercise *this specific* change** over standing
up a full environment (e.g. for a UI-only change, running just the front-end against whatever backend
the repo already points to is usually enough; for a doc, building just that page — but let the repo's
setup, not this instruction, decide what that shortcut is). Have them verify **the direct change AND
each checklist item** — seeing both the intended effect **and** that nothing else moved — and iterate
until they're happy with the outcome.
**Done when:** each checklist item carries a ✅/⬜ status from the operator **actually exercising the
change** by its method (track which were really verified — this feeds the Confidence axis).
**STOP if:** — (no safety gate here). Keep the loops separate: this is the **satisfaction** loop
(did it *come out right* — operator owns it); the **safety** loop is the gates + developer. Don't let
"it looks great" talk you past a safety Red.
**Tell the operator:** in one plain sentence, what's confirmed and what's left to check.

### Step 9 — Draft PR
**Do:** Push the branch and open a **draft** PR, building the body from `<PLUGIN>/templates/pr-body.md`
(read it with the resolved `PLUGIN_DIR` path) and filling **every** placeholder:
```
git push -u origin HEAD
gh pr create --draft --title "<plain title>" --body-file <filled-body.md>
```
**Done when:** a **draft** PR URL exists, with a body built from the template.
**STOP if:** you're about to run `gh pr create` **without** `--draft` — the `--draft` flag is
required. The PR stays draft until Gate 2 passes and you mark it ready at the mark-ready step.
**Tell the operator:** in one plain sentence, that a draft PR is open for the safety checks.

### Step 10 — Gate 2: assess the DIFF   [GATE]
**Do:**
  1. **Layer A:** run `node "<GATE>" scan-diff` on the real diff; quote the numbers.
  2. **Layer A:** run `node "<GATE>" ci-status <pr>` and **wait for a STABLE green** — see the CI
     semantics in [`reference/gate-cli.md`](reference/gate-cli.md) (checks appear dynamically, so a
     single read is wrong).
  3. **Layer B:** re-score all three axes on the real diff (read [`reference/rubrics.md`](reference/rubrics.md)
     again if needed). Confidence now folds in the CI result, whether the checklist was actually
     verified in the verification loop, **and whether the tests the repo convention expects were
     actually added/adjusted and are green in CI** — a behavioral change that skipped an expected
     test is **Yellow at best** (flag the reviewer to add coverage), or **Red** if that untested
     behavior can also fail silently; copy-only with no asserting test remains eligible for Green.
     Complexity now reads **product-LOC and test-LOC separately** from `scan-diff` (quote both). Take
     the **worst-signal** verdict.
**Done when:** quoted `scan-diff` JSON (no `deny_hits`, not `over_ceiling`, not `hard_fail: true`)
**and** quoted `ci-status` showing stable green **and** the re-scored 3-axis scorecard are all in
the conversation.
**STOP if:** any `deny_hits` / `over_ceiling` / `hard_fail: true` → hand off. `files_changed: 0`
when you made changes → apply the **Layer A failure rule** (stop, diagnose, do not proceed). CI not
stable-green → treat per the CI semantics.
**Tell the operator:** in one plain sentence, what the safety scan and CI showed.

### Step 11 — Verdict
**Do:** Aggregate the Gate 2 scorecard worst-axis and act on it.
**Done when:** a stated verdict exists: **Red** → mark PR **NOT ready** and produce the developer
handoff (confirmed spec + diff + failing evidence — [`reference/handoff.md`](reference/handoff.md));
**Yellow** → flag the PR for closer review (`gh pr edit <pr> --add-label safe-pr:review-closely` if
labels exist, else note it prominently in the body); **Green** → proceed.
**STOP if:** Red — do not proceed to the mark-ready step; leave any PR as a **draft**.
**Tell the operator:** in one plain sentence, the verdict and what happens next.

### Step 12 — Mark ready
**Do:**
  1. Flip the draft to ready: `gh pr ready <pr>`.
  2. **RE-RUN** `node "<GATE>" ci-status <pr>` — un-drafting can trigger new workflows, so confirm a
     stable green **again** (the double-watch).
  3. Ensure the scorecard, confirmed spec, and regression checklist are all embedded in the PR body.
**Done when:** `gh pr ready` is done, the re-run `ci-status` shows stable green, the body embeds the
scorecard + spec + checklist, and you've given the operator the PR link + a one-line verdict summary.
**STOP if:** the post-ready `ci-status` isn't stable-green → it's unverified; tell the operator CI
didn't settle and a developer should look. Do not leave it presented as done.
**Tell the operator:** the PR link and a one-line summary of the verdict.
