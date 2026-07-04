// @ts-check
//
// git.js — thin git command wrappers (I/O seam). No decision logic lives here;
// these just spawn `git` with array args (no shell) and return trimmed output.

import { execFileSync } from 'node:child_process';

/**
 * Run git with the given args, returning trimmed stdout, or null on failure.
 * @param {string[]} args
 * @returns {string | null}
 */
function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** @returns {string} porcelain status output ('' = clean). */
export function status() {
  return git(['status', '--porcelain']) || '';
}

/** @returns {string} current branch name, or 'unknown'. */
export function currentBranch() {
  return git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown';
}

/** @returns {string | null} repo root, or null if not in a repo. */
export function repoRoot() {
  return git(['rev-parse', '--show-toplevel']);
}

/**
 * Detect the repo's default branch (origin/HEAD -> main -> master).
 * @returns {string}
 */
export function defaultBranch() {
  const sym = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (sym) return sym.replace(/^refs\/remotes\/origin\//, '');
  if (showRefVerify('refs/remotes/origin/main')) return 'main';
  if (showRefVerify('refs/remotes/origin/master')) return 'master';
  if (showRefVerify('refs/heads/main')) return 'main';
  return 'master';
}

/**
 * @param {string} ref
 * @returns {boolean} whether the ref exists.
 */
export function showRefVerify(ref) {
  try {
    execFileSync('git', ['show-ref', '--verify', '--quiet', ref], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} range  e.g. "HEAD..origin/main"
 * @returns {number} commit count, or -1 if unknown.
 */
export function revListCount(range) {
  const out = git(['rev-list', '--count', range]);
  if (out === null) return -1;
  const n = parseInt(out, 10);
  return Number.isNaN(n) ? -1 : n;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {string | null} merge-base commit, or null.
 */
export function mergeBase(a, b) {
  return git(['merge-base', a, b]);
}

/**
 * Best-effort fetch (never throws).
 * @param {string} remote
 * @param {string} branch
 */
export function fetch(remote, branch) {
  try {
    execFileSync('git', ['fetch', '--quiet', remote, branch], { stdio: 'ignore' });
  } catch {
    /* best-effort */
  }
}

/**
 * @param {string} range  Base ref (e.g. merge-base) to compare against the
 *   working tree. Intentionally omits a second endpoint so it captures
 *   committed changes on the branch AND staged/unstaged working-tree changes.
 *   This lets scan-diff run correctly both before and after a commit.
 * @returns {string[]} changed file paths.
 */
export function diffNameOnly(range) {
  const out = git(['diff', '--name-only', range]);
  if (!out) return [];
  return out.split('\n').filter((l) => l.length > 0);
}

/**
 * @param {string} range  Base ref to compare against the working tree.
 * @returns {string} raw numstat output.
 */
export function diffNumstat(range) {
  return git(['diff', '--numstat', range]) || '';
}
