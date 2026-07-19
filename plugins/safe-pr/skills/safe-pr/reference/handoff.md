# Deny-list & developer handoff

## Absolute deny-list — auto-stop, no reasoning

If the change touches any of these, **stop immediately** and convert to a developer handoff — do
not even start down the path:

- database migrations
- CI / `.github` files
- configuration files
- secrets
- env vars
- dependency manifests (`package.json`, lockfiles, etc.)
- Dockerfiles
- Terraform

The script enforces this (`deny_hits` in `scan-diff`), but you should also refuse to *start* down
such a path. Narrow scope IS the safety argument.

## Environment STOP → handoff triggers

Beyond the deny-list, two environment failures are also STOP → handoff (a broken base is not safe to
build on, and a run that couldn't execute is not evidence):

- **Setup command fails / environment un-bootable** — the ready-to-run environment step's documented
  setup/refresh command errors or exits non-zero and re-running it doesn't resolve it. Never fix it by
  hand-editing dependency manifests / lockfiles (deny-listed).
- **Test-runtime prerequisite can't be established** — the Tests step needs a live service (e2e /
  playwright / integration) and you can neither bring it up nor determine how the runner reaches it
  (no documented run command, no `webServer` config). Do not report the resulting red run as a real
  result.

## Developer handoff structure

When the verdict is Red (or anything lands on the deny-list), don't just stop — produce a crisp
handoff so a developer can pick it up fast:

1. The **confirmed spec** + acceptance criteria from the confirm-spec step.
2. What was attempted and the **diff so far** (if any code was written).
3. The **specific blocking evidence**: which axis went Red and the cited facts (or the Layer A
   `deny_hits` / `hard_fail`, or the failing CI checks).
4. A plain-language note to the operator: what happened, that it's not their fault, and that a
   developer will take it from here.

If a branch/draft PR already exists, leave it as a **draft** (never ready) and reference it in the
handoff.
