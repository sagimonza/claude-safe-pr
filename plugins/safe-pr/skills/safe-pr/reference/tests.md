# Tests — honor the repo's convention

Read this **at the Tests step**, after Execute. The rule in one line: **align to the repo.** If the
touched area is conventionally covered by a test, author/adjust that test as part of the change and
run it to green; if it isn't, say so explicitly with a cited reason. Never silently omit a test, and
never silently invent one for a repo that has no convention for this surface.

Detection is **Layer B** (your reasoning) — there is **no** gate subcommand for it. Test-running is a
plain repo command discovered from `CLAUDE.md` / `package.json` (the same way the verification loop
discovers how to run the app).

## Detection heuristics — build the Gate-1 record

Decide the repo's **test expectation** for *this* change and cite the evidence. Signals, strongest
first:

- **Colocated sibling test** — a file with the same basename plus `.spec`/`.test`, or a `__tests__/`
  dir alongside the touched file. Direct evidence the area is tested.
- **An analogous component/page that has a spec** — a strong convention signal even without a
  sibling. E.g. every page in a `cbms-ui`-style app ships a Playwright spec run against **mocked
  endpoints**; a new/changed page is expected to too.
- **Repo docs / scripts** — `CLAUDE.md`, a `testing`/`CONTRIBUTING` doc, or `package.json` scripts
  that name the test command and whether tests are expected per change.

Output the record used at Gate 1:
`{expected: yes | no, kind: e2e/playwright | unit | snapshot | none, evidence: …, run-command: …}`.

## Test-runtime prerequisites

A test's `kind` can carry a **runtime prerequisite**: e2e / playwright / integration tests run
against a **live app/target**, and a test dispatched with that service down doesn't fail meaningfully
— it can't run at all. So before dispatching such a run, **establish the prerequisite** (start the
app using the repo's documented run command) **or confirm the runner starts it itself**, deferring
to the repo's run docs — never assume a stack. A `playwright.config.*` with a **`webServer` block**
means the runner **self-boots** the app; its **absence** means the app must be **started separately**
before the run. If you can neither bring the service up nor determine how the runner reaches it, a
red run is **not** evidence — say the prerequisite couldn't be established and hand off.

This is a **distinct concern** from the two around it: it is **not** the ready-to-run environment
step (that establishes dependency/toolchain freshness — deps installed), and it is **not** the
verification loop's app boot (that's the easiest path for a **human** to eyeball the change). They can
resolve to different commands/environments; keep them separate.

## Expected vs. not

- **Behavioral change in a tested area → expected.** Author or adjust the test.
- **Pure copy/presentational where no test asserts the text → usually not expected** — *unless* the
  repo has snapshot/visual tests that would flip on it (then it's expected: adjust the snapshot).
- **When unsure, prefer "expected"** and let the two-tier bars below scope the effort.

## Add vs. adjust — the two tiers (different bars)

1. **Adjust-to-keep-green** — your change legitimately broke 1–2 existing assertions; the fix is
   mechanical. Near-mandatory, low scrutiny → **Yellow**.
2. **Author-new** — a brand-new test. The bigger, more open-ended act → **higher scrutiny** (mirror
   the repo's existing pattern; don't invent a new style).
3. **Adjust-*many* existing tests** — a **Red contradiction-detector** (already in the rubric): a
   genuine small, bounded fix shouldn't need rewriting much established behavior → the change isn't
   small → **hand off**.

## The "too large" boundary

- If writing the expected test needs **new fixtures / mocks / page-objects / abstractions the repo
  doesn't already provide**, that is new abstraction → **Complexity Red → hand off**. The area isn't
  ergonomic for a non-dev change.
- For sheer size, the **diff ceiling is the backstop** — now **split** (see
  [`gate-cli.md`](gate-cli.md)): test LOC has its own budget (`max_test_loc`), so a normal-sized
  additive spec no longer inflates the product budget, but a runaway test still trips `test_loc`.

## The deny-list boundary — test *files* yes, test *config* no

Author/adjust **inside test files only** (`*.spec.*` / `*.test.*` / `__tests__/`). If making the
tests run requires editing **test config** (`**/*.config.*` — Playwright/Jest config), **CI**
(`.github/**`), or **`package.json`** (scripts), those are on the deny-list → **hand off**. A test
entry point creates no exception.

## Trust & running — why green is the substitute

A non-developer **cannot vouch for a test by hand** (a passing test can assert the wrong thing). So
*green* is what makes an auto-written test trustworthy: run the **relevant** tests (the touched spec
and its neighbours — the lowest-effort subset) to green **locally now**, and let CI confirm the
**full suite** at Gate 2. Without that, an auto-written test is a net negative (false confidence).

## How LOC is weighed

Additive test LOC is lower-risk per line than product LOC (cf. the catalog's "150 LOC of markdown ≠
150 LOC of code") — which is exactly why Layer A gives it its **own** ceiling rather than folding it
into the product budget. The hard ceiling still applies: `test_loc > max_test_loc` is an
`over_ceiling` / `hard_fail` just like the product budget.

## Non-silent, both ways

The original trap was a silent **omission**; the mirror trap is a silent **addition**. The Tests
step's artifact must state **either** "added/adjusted test X because Y (green)" **or** "no test added
because Z (cited)". Never nothing.
