# Assessment rubrics (Gate 1 & Gate 2)

Read this **before scoring** at Gate 1 (assess the plan) and again at Gate 2 (assess the diff). The three-axis scorecard is the
**only** verdict form — there is no separate "in scope / out of scope" judgment. **Score the
specific change, not the category it falls in or the importance of the file it lives in.** A change
whose logic/state/control-flow ripples beyond a single contained site — a new component, data work,
or reworking how something behaves — is **Complexity: Red** (often **Risk: Red** too). But a
**tightly-bounded** state/prop change (one localized site, self-contained, reversible, verifiable by
hand) is **not** automatically Red — score it on scope and verifiability like anything else. Either
way, say it *through the rubric*, never as a bare "this is out of scope" line.

**Two proxies to distrust — they describe the file or the category, not the change:**
1. **File centrality.** "This file is imported everywhere / is the central hub" describes the file.
   A one-line addition that can only affect an initial value has a small blast radius *even in a
   central file*. Ask what *this change* can break, not what the file touches.
2. **The word "state."** State spans a `sessionStorage`-backed default (contained, reversible) to a
   data-fetch controller (rippling). The word alone decides nothing; scope and containment do.

**Evidence before score:** never state a rating until you have written the facts that justify it,
each with the command or observation that produced it. Required form:

> Risk: **Green** — `grep` shows `Button.jsx` imported by 1 component; change is a className swap
> (presentational only); not under an auth/payments/checkout path; no cautions in local `CLAUDE.md`.

Also read any `CLAUDE.md` in the touched directories for **cautionary/ownership** notes (distinct
from build instructions).

**Aggregation: final = worst of the three.** Two or more yellows still = yellow — they do **NOT**
compound to red.

## Risk (blast radius / reversibility)

**Gather:** Is the touched file a shared lib/component? How many importers/consumers (`grep` /
usage search)? Is the path on a critical/irreversible flow (auth, payments, checkout, data-write)?
Do local `CLAUDE.md` files flag the area sensitive? Runtime-prod vs. build/test-only? User-facing
vs. internal?

**Blast radius is a property of the change, not the file.** In a central/shared file, ask what
*this specific edit* can actually reach: does it touch only a value/branch that's isolated from the
file's other responsibilities, or does it alter logic the file's many consumers depend on? A
localized edit to a central file (e.g. changing only an initial default) can be **Green/Yellow**; an
edit to the shared logic those consumers rely on is **Red**. Don't let importer count alone drive
the score.

- **Green:** leaf/presentational; ≤1–2 consumers; not on a critical path — OR a change so contained
  it can only affect an isolated value, even if the file is shared.
- **Yellow:** shared by several consumers, or moderately central; still presentational or a
  contained state/prop change.
- **Red:** widely-used shared primitive **whose shared logic this change alters**, OR anything on a
  money/auth/data-integrity path, OR the regression surface is effectively unbounded.

**Per-profile — what a "consumer" is and which critical paths matter:**
- **Presentational (UI):** a consumer is an importer/render site of the component; critical paths are
  auth / payments / checkout / data-write.
- **Content:** a consumer is where the string/doc is *surfaced* — the flows that display it; add
  **legal / compliance / security-sensitive wording** to the critical paths (a message that leaks
  info, or instructions users act on).

## Complexity

**Gather:** files changed and LOC (**from Layer A — quote it**). Layer A now reports **product-LOC
and test-LOC separately** (`product_loc` / `test_loc`, each with its own ceiling) — **quote both**.
Test LOC is judged against its **own** ceiling (`max_test_loc`), so a normal-sized additive spec no
longer inflates the product budget; but **new test abstraction/fixtures/page-objects = Red** (see
`tests.md`), and either ceiling tripping (`over_ceiling` / `hard_fail`) is still an automatic stop.
Did it touch logic/state/control-flow or only presentation (CSS/copy/static props)? New deps? New
abstraction/pattern introduced? If it touches state, is it **contained** (one localized site,
reversible, no new abstraction) or **rippling** (changes control flow/timing or logic other code
depends on)?

- **Green:** 1–2 files, presentational only, no logic.
- **Yellow:** a few files, or minor localized logic, OR a **contained** state/prop change — one
  self-contained site, reversible, no new abstraction or control-flow rework (e.g. persisting one
  value in `sessionStorage` and reading it back as a default — one stack's form of a contained
  default; the equivalent in any framework counts the same).
- **Red:** many files, a **rippling** logic/state change (control flow, timing, or logic other code
  depends on), data fetching, a new component, or a new pattern introduced.

**Per-profile — mostly shared; only the interpretation shifts.** Layer A LOC means different things
across profiles (150 LOC of markdown ≠ 150 LOC of code — the ceiling counts lines the same way, but
the *risk* they carry differs), and "touched logic" reads as "touched logic vs. pure text/content."
A large content diff that is purely text is far less complex than the same LOC of code.

## Confidence (how sure nothing breaks)

**Gather:** Do tests exist around the touched code? **Does the repo convention expect a test for this
change** (from the Gate-1 detection), and was it **added/adjusted and made green** (at the Tests
step)? Did CI pass (**Layer A `ci-status`**)? How many *existing* tests had to be **adjusted**? Was
the regression checklist actually verified in the verification loop? **And how easy is it to confirm
no regression at all** — see below.

**Verifiability (ease of confirming no regression) — method-neutral.** Coverage isn't the only way
to be confident; *a change a human can fully **observe** by exercising it is safer than one that fails
silently*, regardless of test count. Ask: can the operator, by a **concrete method appropriate to
the change**, observe both that the change worked **and** that nothing else moved? "Visible on
screen" is just **one instance** of that method — running the app and looking at the surface. Other
methods qualify equally: rendering a doc and reading it, triggering the state that shows a string and
reading it **in context**, exercising the exact path by hand. Or can it break in ways **no available
method would reveal** — a silent failure (stale value, wrong timing, edge-case-only, an automated /
off-screen flow with no observable signal)?

- **High verifiability** — the effect is fully observable and the failure modes are observable too —
  can lift Confidence to **Yellow (or Green)** even with thin test coverage.
- **Low verifiability** — silent / edge-case failure modes with no observable signal by any available
  method — holds Confidence at **Red** even if the change looks small.

- **Green:** good coverage; CI green; only *additive* new tests; checklist verified — OR the change
  is trivially and fully verifiable by hand and the operator confirmed it end-to-end by its method.
- **Yellow:** thin coverage, OR 1–2 existing tests adjusted, OR checklist partially verified — but
  the change is verifiable by hand and its failure modes are observable.
- **Red:** no coverage **and** failure modes are silent / not observable by any available method, OR
  many existing tests adjusted (the change is bigger than a "small, bounded fix"), OR CI failing, OR
  couldn't verify.

**Expected-coverage cap (from the Gate-1 detection + the Tests step).** A **behavioral** change in an
area the repo convention **expects a test** for, that **skipped** that expected test, caps at
**Yellow at best** — flag the reviewer to add coverage; it goes **Red** if the untested behavior can
also **fail silently**. A copy-only change with **no asserting test** is unaffected — it remains
eligible for **Green**. (A test that *was* added/adjusted and is green in CI supports Green as usual.)

> **"Tests adjusted" is a contradiction-detector:** a genuine small, bounded fix shouldn't require
> rewriting much established behavior. A high adjust-count pulls down BOTH Confidence and Risk.

**Per-profile — verification method + the silent-failure traps to look for:**
- **Presentational (UI):** method = run the app and look at the surface; rarely fails silently.
- **Content:** method = render the doc/output and read it, or trigger the state that shows the string
  and read it **in context**. Traps that fail silently: i18n interpolation / pluralization /
  placeholder mismatch (`{count}`, `%s`); a string **reused across contexts** (right in one, wrong in
  another); markdown that **renders differently than it reads** in source; a message consumed by an
  **off-screen / automated** flow with no observable signal → **low verifiability → Red → hand off.**
- **Bounded change:** method = exercise the exact path by hand; the guardrails (one localized,
  self-contained, reversible site) are what keep the failure mode observable.

## Worked examples

> These examples use a web/JS frontend for concreteness, **except where a stack is named** (G is
> Rails, B is Django); the **reasoning is stack-neutral**. Read `Button.jsx` as "any leaf component,"
> `className` as "any presentational attribute," a `useState` default as "any contained default." Each
> verdict turns on scope, blast radius, and verifiability — never on the stack it's written in.

**Example A — clean Green.** Change the label of one button from "Subscribe" to "Join now".
- Risk: **Green** — `grep "PricingButton"` → 1 importer (`PricingPage.tsx`); pure copy change; not
  on auth/payments path; no `CLAUDE.md` cautions in `src/pricing/`.
- Complexity: **Green** — Layer A: `files_changed: 1`, `loc_total: 2`; copy-only, no logic.
- Confidence: **Green** — existing snapshot test covers the button; CI stable-green; no existing
  tests adjusted; operator verified the pricing page in the running app.
- Overall: **Green** → proceed to ready.

**Example B — Yellow (proceed, flagged) — Django.** Recolor a shared badge: swap the CSS class on a
`_badge.html` template partial included in a few places.
- Risk: **Yellow** — `grep` for the partial → included by 4 templates across 3 pages; presentational,
  but moderately shared.
- Complexity: **Green** — Layer A: `files_changed: 1`, `loc_total: 3`; a class swap only.
- Confidence: **Yellow** — no test directly covers the badge; operator verified 2 of the 4 render
  sites in the running app, reasoned the other 2 equivalent (same variant).
- Overall: **Yellow** → proceed; flag the PR so the reviewer checks the unverified render sites.

**Example C — Red (stop, hand off).** "Just nudge the spacing" turns out to live in the shared
`<Layout>` wrapper.
- Risk: **Red** — `grep "Layout"` → 60+ importers spanning the whole app; the regression surface
  is effectively unbounded — can't be reduced to a checkable list (proportionality rule).
- Stop regardless of the other axes (worst-signal). Produce a developer handoff; do not open a
  ready PR.

**Example D — Red via contradiction-detector.** A "small color fix" that required editing 7
existing test files to pass.
- Confidence: **Red** — many existing tests adjusted signals the change is bigger than a small UI
  fix; this also raises Risk. Stop and hand off.

**Example E — Red because the logic *ripples and fails silently*, scored through the rubric (NOT a
bare "out of scope").** "When going back from the details page to the list, restore the scroll
position to the row I drilled in from." Score it through the axes — and note *why* it's Red is the
rippling control flow, not the mere presence of state:
- Risk: **Red** — the fix must hook into the list's scroll/data context *logic* — capture on
  navigate, restore after data loads — i.e. it alters behavior the pagination/filtering/refresh
  flows depend on, not an isolated value. That shared logic is what makes the blast radius large,
  not the file's importer count.
- Complexity: **Red** — this is **rippling**: new control flow and timing (restore *after* data
  loads and the table re-renders), not one contained value. Outside the presentational catalog and
  outside the bounded-state allowance.
- Confidence: **Red** — **low verifiability**: getting the restore timing wrong fails silently
  (works on a fast load, breaks on a slow one), and no test would catch it. The failure mode isn't
  visible on screen.
- Overall: **Red** → STOP and hand off. Contrast with Example F, which is also "state" but contained
  and fully verifiable.

**Example F — Yellow (proceed, flagged): a *contained* state change.** "When I come back to the
rules page, keep me on the tab I last had open instead of resetting to the first one." The tab value
lives in a shared context, but the change is: read/write one `sessionStorage` key in the tab's
`useState` initializer and its change handler. (This is React's form of a contained default; the
equivalent in any framework qualifies the same way.)
- Risk: **Yellow** — the context is shared by both routes, but this edit touches *only the initial
  tab value* — it can't reach the pagination/filter/refresh logic other consumers depend on. Blast
  radius is the tab selection, not the hub. (Score the change, not the file's centrality.)
- Complexity: **Yellow** — Layer A: ~2–3 files, small LOC; **contained** state — one self-contained
  site, reversible, no new abstraction or control-flow rework. Not the presentational catalog, but
  within the bounded-state allowance.
- Confidence: **Yellow** — no test covers it, but **high verifiability**: the operator can open the
  page, switch tabs, navigate away and back, and *see* the right tab restored **and** see nothing
  else changed. The failure modes (wrong tab, first-load default) are visible on screen. Flag the
  first-visit / empty-storage case for the reviewer.
- Overall: **Yellow** → proceed; flag the PR so the reviewer checks the first-load/empty-storage
  edge case.

**Example G — `content` Green — Rails.** Reword a validation error message string from "Enter a valid
email" to "That email doesn't look right." — the string lives under a static key in a Rails
`config/locales/en.yml` (no interpolation), rendered by the signup form's ERB. 1 file, string value
only.
- Risk: **Green** — `grep` shows the locale key used by one signup form; not legal/compliance/security
  wording (no info leaked, no instruction users act on); not on an auth/payments path.
- Complexity: **Green** — Layer A: `files_changed: 1`, small LOC; pure text, no touched logic.
- Confidence: **Green** — **high verifiability**: the operator submits the form with a bad email,
  triggers the error, and reads the new copy **in context** in the rendered page, seeing nothing else
  changed. No interpolation placeholders, no reuse across contexts. Fully hand-verifiable.
- Overall: **Green** → proceed to ready.

**Example H — `content` Red via low verifiability.** Edit a canned message that is only ever sent by
an *automated / off-screen* flow (e.g. a nightly batch email the operator can't trigger and read in
context).
- Confidence: **Red** — **low verifiability**: the message is consumed by a flow with no observable
  on-screen signal, so the operator can't confirm it rendered correctly (interpolation, wrong
  recipient context) — the failure mode is silent. Category ("it's just content") does not make it
  safe; verifiability decides. → STOP and hand off.

**Example I — `content` Red via a profile-specific trap.** "Change the cart summary to read *You have
1 items* → *You have {count} items*" where `{count}` feeds an i18n pluralization rule.
- Confidence: **Red** — **low verifiability**: pluralization can break silently (renders right for
  `count: 2`, wrong for `count: 1` or locale-specific plural forms the operator won't exercise). The
  placeholder/pluralization trap means a failure mode nothing on the tested path reveals. → STOP and
  hand off (a developer with the i18n framework should own the plural rule).

**Example J — honoring the repo's test convention (Green/Yellow), and its "too large" boundary
(Red).** An app whose convention is that **every page ships an end-to-end spec run against mocked
endpoints** (via whatever e2e framework the repo uses — Playwright, Cypress, RSpec/Capybara, …). The
change: a small UI tweak to one page (e.g. add an empty-state message to a list).
- **Gate 1 test expectation:** `{expected: yes, kind: e2e, evidence: "sibling Orders spec; every page
  under the pages dir has a colocated spec", run-command: "<the repo's e2e runner, e.g. npx
  playwright test orders>"}`.
- **Tests step:** author the empty-state coverage in the page's sibling spec, mirroring the existing
  mocked-endpoint pattern; run the touched spec locally → green.
- Complexity: **Green/Yellow** — Layer A: `product_loc: 6`, `test_loc: 70` (each under its own
  ceiling — the 70-line spec doesn't touch the product budget); no new abstraction, reused the
  repo's existing fixtures/mocks.
- Confidence: **Green** — the expected test was added and is green in CI; operator also verified the
  empty state in the running app.
- Overall: **Green** → proceed. Had the operator **skipped** the expected spec, Confidence would cap
  at **Yellow** (flag the reviewer to add coverage).
- **Contrast — Red variant:** the same change on a page that has **no** page-object/mock harness yet,
  so covering it needs a **new page-object and mock fixtures the repo doesn't provide**. That is new
  test abstraction → **Complexity Red → hand off** (the area isn't ergonomic for a non-dev change).
