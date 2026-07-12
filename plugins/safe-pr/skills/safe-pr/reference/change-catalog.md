# The allowed-change catalog

Read this **at Execute**, after the deny-list pre-check (`check-paths`) passes. It defines **what a
safe-pr change may be** and **how you verify it**. The deny-list is the deterministic fence; this
catalog is the shippable set inside that fence.

## Shippable ≙ bounded blast radius AND hand-verifiable

A change belongs in safe-pr only when it clears **both** invariants:

1. **Bounded blast radius** — confined to a deny-list-clean, small, mappable surface. (Enforced by
   Layer A: deny-list + diff ceiling; and by the Risk-axis consumer analysis.)
2. **Hand-verifiable** — the operator can observe both *that the change worked* **and** *that
   nothing else moved*, by a concrete method, and the failure modes are **observable** rather than
   **silent**.

"Presentational UI change" is simply the archetype that satisfies both perfectly. Other change
natures qualify **only for the subset that clears the same bar** — many correctly hand off, and that
is a success, not a gap. The catalog **widens what kind of content and who** can ship, **never how
risky.**

## The three sections

The skill infers which section a change falls in at Gate 1 (plan) and states it in plain language;
that inferred section drives the verification method here and at the verification loop.

| Section | Archetypes | Verification method |
|---|---|---|
| **Presentational (UI)** | copy/text, colors, spacing, sizing, simple style props, icon swaps, toggling a class | run the app, look at the surface — see the effect and that nothing else moved |
| **Content** | docs/markdown, help/support articles, user-facing message strings (error/empty-state/tooltip/label copy), i18n string **values** in context, in-repo canned-response text (CS replies that live in the repo as content, **not** behind config/flags) | render the output and read it — build/preview the doc; **trigger the state that shows the string and read it in context** in the running app |
| **Bounded change** (cross-cutting allowance) | one localized, self-contained, reversible default/prop/state change that cannot reach the file's other responsibilities | exercise the exact path by hand and confirm the effect **and** that nothing else moved |

## Content — what qualifies, and what does not

**In:** text/content that renders somewhere but isn't UI chrome — docs and markdown, help/support
articles, user-facing message strings, i18n string **values** verified in their rendered context,
and canned-response text that lives in the repo as content.

**Out (hand off):**
- Anything **flag/config-driven** — a string selected or gated by config, a feature flag, or env.
  That is on the deny-list and stays there; a content entry point creates **no** exception.
- A string whose effect the operator **cannot trigger and read** — consumed by an automated or
  off-screen flow, or shown only in an edge case they can't reach. Silent failure mode → **low
  verifiability → Confidence Red → hand off**, however small the edit.

**Content traps that break silently** (name these when scoring Confidence):
- i18n interpolation / pluralization / placeholder mismatch (`{count}`, `%s`, `{{name}}`).
- a string **reused across contexts** — reads right in one, wrong in another.
- markdown that **renders differently than it reads** in source.
- a message consumed by an **off-screen / automated** flow with no on-screen signal.

## Bounded change — the allowance and its guardrails

This is the path a small, contained tweak (e.g. a PM's small enhancement) uses. It stays an
**allowance governed by the rubric — not a licence for behavior work.** Allowed **only if it clears
every guardrail**:

- **one localized site** — a single `useState` default, prop default, or handler; not a change
  spread across the file's logic;
- **self-contained** — cannot affect the file's other responsibilities or logic other code depends
  on (this is why Example F's tab default passes but Example E's scroll-restore doesn't);
- **no new abstraction, no control-flow/timing rework, no data fetching, no new component**;
- **reversible and fully hand-verifiable** — the operator can observe, by a concrete method, both
  that it worked **and** that nothing else moved.

If it clears all of those, it's a Gate-1 **Yellow at worst**, not an automatic Red. If it misses
even one, treat it as rippling logic and **STOP** — hand off.

## Tests are cross-cutting, not a fourth section

Any of the three change natures above may warrant a test — a presentational tweak in a
snapshot-tested area, a content string an assertion checks, a bounded change in a spec'd flow. Tests
are therefore **not a catalog section**; they are handled at the **Tests step**, governed by
[`tests.md`](tests.md). Authoring stays **inside test files** (`*.spec.*` / `*.test.*` /
`__tests__/`); test **config** (Playwright/Jest config, CI, `package.json`) is deny-listed → hand off.

## Changes that span sections

Apply the **union** of the relevant catalogs and the **strictest** verifiability standard
(worst-signal, consistent with the rubric's aggregation rule). E.g. a tweak that is part copy, part
styling verifies against both methods; a bounded change that also edits a string must clear the
bounded-change guardrails **and** the content traps.
