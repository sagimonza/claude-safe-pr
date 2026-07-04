<!--
  safe-pr PR body template. The skill fills every {{PLACEHOLDER}} before opening the PR.
  Keep the section order: a richer body = a faster developer review, which is the whole payoff.
-->

> 🛟 **Produced with `safe-pr` by a non-developer.** Overall assessment: **{{OVERALL_VERDICT}}**.
> {{YELLOW_FLAG_NOTE}}

## 1. Confirmed spec

{{CONFIRMED_SPEC}}

**Acceptance criteria** (confirmed by the operator before any code was written):

{{ACCEPTANCE_CRITERIA}}

## 2. Before / after evidence

**Desired result provided by the operator:**

{{DESIRED_RESULT_EVIDENCE}}

**What was verified by the operator (and how it was exercised):**

{{VERIFIED_EVIDENCE}}

## 3. Assessment scorecard

> Worst-signal wins. Every rating is justified by cited facts gathered before the score
> ("evidence before score"). Layer A facts come from `pr-gate.js` and are not re-derived by eye.

| Axis | Rating | Evidence |
|------|--------|----------|
| **Risk** | {{RISK_RATING}} | {{RISK_EVIDENCE}} |
| **Complexity** | {{COMPLEXITY_RATING}} | {{COMPLEXITY_EVIDENCE}} |
| **Confidence** | {{CONFIDENCE_RATING}} | {{CONFIDENCE_EVIDENCE}} |
| **Overall** | **{{OVERALL_VERDICT}}** | worst of the three above |

**Layer A facts (deterministic, from `pr-gate.js`):**

- Files changed: {{FILES_CHANGED}} (ceiling {{MAX_FILES}})
- LOC changed: {{LOC_TOTAL}} (+{{LOC_ADDED}} / -{{LOC_REMOVED}}, ceiling {{MAX_LOC}})
- Deny-list hits: {{DENY_HITS}}
- CI at assessment time: {{CI_SUMMARY}}

## 4. Regression checklist

The direct change plus one representative per equivalence class of consumers. Items marked ✅
were verified by the operator (exercised by the change's method); ⬜ were reasoned-equivalent but
not individually exercised.

{{REGRESSION_CHECKLIST}}

**Could not determine** (surfaces the agent could not map to a viewable page/flow — *not*
covered, listed so this checklist is never mistaken for exhaustive):

{{COULD_NOT_DETERMINE}}

## 5. For the reviewer

{{REVIEWER_NOTES}}
