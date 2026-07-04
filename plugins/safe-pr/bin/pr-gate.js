#!/usr/bin/env node
// @ts-check
//
// pr-gate.js — Layer A deterministic gate for the safe-pr plugin (CLI entry).
//
// This is the single source of ground truth. The LLM (Layer B) must treat its
// JSON output as authoritative and must NOT recompute these facts by eye.
//
// Same diff -> same answer. All result output is machine-readable JSON on
// stdout; human/diagnostic messages go to stderr.
//
//   preflight                 -> tree/branch/base/gh readiness + branch convention
//   new-branch <ticket> <slug> -> validate Jira id, build a convention branch name
//   check-paths <path...>      -> deny-list pre-check for files about to be edited
//   scan-diff [base_ref]       -> deny-list hits, file/LOC counts, ceiling check
//   ci-status <pr>             -> stability-aware CI read
//   config                     -> dump the effective (merged) config
//
//   help                       -> print usage to stdout and exit 0
//
// Exit codes: 0 = ran successfully (read the JSON for pass/fail). 2 = usage error.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadConfig } from '../lib/config.js';
import { assemblePreflight } from '../lib/preflight.js';
import { buildBranchName } from '../lib/branch.js';
import { checkPaths } from '../lib/check-paths.js';
import { scanDiff } from '../lib/scan-diff.js';
import { ciStatus } from '../lib/ci-status.js';
import * as git from '../lib/git.js';
import * as gh from '../lib/gh.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(__dirname); // the dir above bin/

const USAGE =
  'usage: pr-gate.js {preflight|new-branch <ticket> <slug>|check-paths <path...>|scan-diff [base]|ci-status <pr>|config|help}';

/** @param {string} msg */
function err(msg) {
  process.stderr.write(msg + '\n');
}

/**
 * @param {string} msg
 * @returns {never}
 */
function die(msg) {
  err(msg);
  process.exit(2);
}

/** @returns {Record<string, any>} */
function getConfig() {
  const repoRoot = git.repoRoot() || undefined;
  return loadConfig({
    pluginRoot: PLUGIN_ROOT,
    repoRoot,
    readFile: (p) => readFileSync(p, 'utf8'),
    exists: (p) => existsSync(p),
    join,
  });
}

/** @param {any} result */
function emit(result) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

function cmdPreflight() {
  const config = getConfig();
  const branch_regex = config.branch_naming?.branch_regex ?? '';

  const clean_tree = git.status() === '';
  const branch = git.currentBranch();
  const def = git.defaultBranch();

  // Best-effort fetch so the up-to-date check reflects remote reality.
  git.fetch('origin', def);

  const base_ref_exists = git.showRefVerify(`refs/remotes/origin/${def}`);
  const behind = base_ref_exists ? git.revListCount(`HEAD..origin/${def}`) : -1;
  const gh_ok = gh.authOk();

  emit(
    assemblePreflight({
      clean_tree,
      branch,
      default_branch: def,
      base_ref_exists,
      behind,
      gh_ok,
      branch_regex,
    })
  );
}

/**
 * @param {string=} ticket
 * @param {string=} slugArg  Remaining args joined as the logical name.
 */
function cmdNewBranch(ticket, slugArg) {
  if (!ticket) die('pr-gate new-branch: missing <ticket> argument (e.g. DEV-12345)');
  const config = getConfig();
  const ticketRegex = config.branch_naming?.ticket_regex ?? '';
  emit(buildBranchName({ ticket, slug: slugArg ?? '', ticketRegex }));
}

/** @param {string[]} paths  Candidate file paths about to be edited. */
function cmdCheckPaths(paths) {
  if (!paths || paths.length === 0) {
    die('pr-gate check-paths: missing <path> argument(s)');
  }
  const config = getConfig();
  emit(checkPaths({ paths, config, repoRoot: git.repoRoot() }));
}

/** @param {string=} baseArg */
function cmdScanDiff(baseArg) {
  const config = getConfig();

  let baseRef;
  if (baseArg) {
    baseRef = baseArg;
  } else {
    const def = git.defaultBranch();
    baseRef = git.showRefVerify(`refs/remotes/origin/${def}`) ? `origin/${def}` : def;
  }

  const mergeBase = git.mergeBase('HEAD', baseRef);
  const diffRange = mergeBase || baseRef;

  const nameOnly = git.diffNameOnly(diffRange);
  const numstat = git.diffNumstat(diffRange);

  emit(scanDiff({ nameOnly, numstat, config, baseRef: diffRange }));
}

/** @param {string=} pr */
async function cmdCiStatus(pr) {
  if (!pr) die('pr-gate ci-status: missing <pr> argument');
  const config = getConfig();
  const result = await ciStatus({
    pr: /** @type {string} */ (pr),
    config,
    fetchChecks: () => gh.prChecks(/** @type {string} */ (pr)),
    sleep: (seconds) => new Promise((res) => setTimeout(res, seconds * 1000)),
    log: err,
  });
  emit(result);
}

function cmdConfig() {
  emit(getConfig());
}

// `help` (and the conventional --help/-h aliases) is a successful invocation,
// not a usage error: probing the gate to discover its subcommands must never
// look like a Layer A failure (which the skill treats as a STOP). Prints to
// stdout and exits 0.
function cmdHelp() {
  process.stdout.write(USAGE + '\n');
}

async function main() {
  const [sub, ...rest] = process.argv.slice(2);
  if (!sub) die(USAGE);

  switch (sub) {
    case 'help':
    case '--help':
    case '-h':
      cmdHelp();
      break;
    case 'preflight':
      cmdPreflight();
      break;
    case 'new-branch':
      cmdNewBranch(rest[0], rest.slice(1).join(' '));
      break;
    case 'check-paths':
      cmdCheckPaths(rest);
      break;
    case 'scan-diff':
      cmdScanDiff(rest[0]);
      break;
    case 'ci-status':
      await cmdCiStatus(rest[0]);
      break;
    case 'config':
      cmdConfig();
      break;
    default:
      die(`pr-gate: unknown subcommand '${sub}'\n${USAGE}`);
  }
}

main().catch((e) => {
  err(`pr-gate: ${e && e.message ? e.message : e}`);
  process.exit(2);
});
