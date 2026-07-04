// @ts-check
//
// scan-diff.js — pure diff analysis: deny-list hits, file/LOC counts, ceiling
// check. No I/O; the CLI feeds it already-gathered `git diff` output.

import { matchesAnyGlob } from './glob.js';

/**
 * @typedef {Object} PerFile
 * @property {string} path
 * @property {number} added
 * @property {number} removed
 */

/**
 * @typedef {Object} DenyHit
 * @property {string} path
 * @property {string} matched_glob
 */

/**
 * @typedef {Object} ScanDiffResult
 * @property {string} base_ref
 * @property {DenyHit[]} deny_hits
 * @property {number} files_changed
 * @property {number} loc_added
 * @property {number} loc_removed
 * @property {number} loc_total
 * @property {number} max_files
 * @property {number} max_loc
 * @property {boolean} over_ceiling
 * @property {boolean} hard_fail
 * @property {PerFile[]} per_file
 */

/**
 * Parse `git diff --numstat` output into per-file added/removed counts.
 * Binary files report "-"/"-"; they count as 0 LOC but still count as a file.
 * @param {string} text  Raw numstat output (tab-separated: added removed path).
 * @returns {PerFile[]}
 */
export function parseNumstat(text) {
  /** @type {PerFile[]} */
  const out = [];
  if (!text) return out;
  for (const line of text.split('\n')) {
    if (!line) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [a, r, ...rest] = parts;
    const path = rest.join('\t');
    if (!path) continue;
    const added = a === '-' ? 0 : parseInt(a, 10) || 0;
    const removed = r === '-' ? 0 : parseInt(r, 10) || 0;
    out.push({ path, added, removed });
  }
  return out;
}

/**
 * @typedef {Object} ScanDiffInput
 * @property {string[]} nameOnly  Changed paths (from `git diff --name-only`).
 * @property {PerFile[] | string} numstat  Parsed per-file rows, or raw numstat text.
 * @property {Record<string, any>} config  Effective merged config.
 * @property {string} baseRef  The diff range / base ref used.
 */

/**
 * Compute deny-list hits, counts, ceiling breach, and hard-fail flag.
 * @param {ScanDiffInput} input
 * @returns {ScanDiffResult}
 */
export function scanDiff({ nameOnly, numstat, config, baseRef }) {
  const globs = config.denylist_globs || [];

  /** @type {DenyHit[]} */
  const deny_hits = [];
  for (const f of nameOnly) {
    if (!f) continue;
    const matched = matchesAnyGlob(f, globs);
    if (matched) deny_hits.push({ path: f, matched_glob: matched });
  }

  const perFile = typeof numstat === 'string' ? parseNumstat(numstat) : numstat;
  let loc_added = 0;
  let loc_removed = 0;
  for (const row of perFile) {
    loc_added += row.added;
    loc_removed += row.removed;
  }

  const files_changed = nameOnly.filter((f) => !!f).length;
  const loc_total = loc_added + loc_removed;
  const max_files = config.max_files;
  const max_loc = config.max_loc;
  const over_ceiling = files_changed > max_files || loc_total > max_loc;
  const hard_fail = deny_hits.length > 0 || over_ceiling;

  return {
    base_ref: baseRef,
    deny_hits,
    files_changed,
    loc_added,
    loc_removed,
    loc_total,
    max_files,
    max_loc,
    over_ceiling,
    hard_fail,
    per_file: perFile,
  };
}
