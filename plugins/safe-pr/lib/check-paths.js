// @ts-check
//
// check-paths.js — pure deny-list pre-check for a set of candidate file paths.
// No I/O; the CLI feeds it the already-resolved repo root and merged config.
//
// This is the in-flow replacement for the old global PreToolUse hook: instead
// of firing on every edit everywhere, the skill runs `pr-gate.js check-paths`
// on the file(s) it is about to touch, at the Execute step. It shares the exact
// deny-list matcher (matchesAnyGlob) with scan-diff, so the pre-edit check and
// the diff scan can never drift apart.

import { matchesAnyGlob } from './glob.js';

/**
 * @typedef {Object} DenyHit
 * @property {string} path
 * @property {string} matched_glob
 */

/**
 * Normalize a possibly-absolute path to repo-relative when it lives under
 * `repoRoot`. Deny-list globs are repo-relative, so both sides must compare on
 * the same basis. Paths outside the repo (or when the root is unknown) are left
 * as-is.
 * @param {string} p
 * @param {string | null | undefined} repoRoot
 * @returns {string}
 */
export function toRepoRelative(p, repoRoot) {
  if (repoRoot && p.startsWith(repoRoot + '/')) {
    return p.slice(repoRoot.length + 1);
  }
  return p;
}

/**
 * @typedef {Object} CheckPathsInput
 * @property {string[]} paths  Candidate file paths (absolute or repo-relative).
 * @property {Record<string, any>} config  Effective merged config.
 * @property {string | null} [repoRoot]  Repo root, to relativize absolute paths.
 */

/**
 * @typedef {Object} CheckPathsResult
 * @property {string[]} checked  The repo-relative paths that were checked.
 * @property {DenyHit[]} deny_hits
 * @property {boolean} denied  True if any path hit the deny-list.
 */

/**
 * Check candidate paths against the deny-list.
 * @param {CheckPathsInput} input
 * @returns {CheckPathsResult}
 */
export function checkPaths({ paths, config, repoRoot }) {
  const globs = config.denylist_globs || [];
  /** @type {string[]} */
  const checked = [];
  /** @type {DenyHit[]} */
  const deny_hits = [];
  for (const raw of paths) {
    if (!raw) continue;
    const rel = toRepoRelative(raw, repoRoot);
    checked.push(rel);
    const matched = matchesAnyGlob(rel, globs);
    if (matched) deny_hits.push({ path: rel, matched_glob: matched });
  }
  return { checked, deny_hits, denied: deny_hits.length > 0 };
}
