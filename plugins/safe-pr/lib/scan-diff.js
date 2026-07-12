// @ts-check
//
// scan-diff.js — pure diff analysis: deny-list hits, file/LOC counts, ceiling
// check. No I/O; the CLI feeds it already-gathered `git diff` output.

import { matchesAnyGlob } from './glob.js';

// Code-side defaults for the split-ceiling classification. The canonical values
// live in config/gate.config.json (repo-overridable via .safe-pr.config.json);
// these are the safety net used when scanDiff is called with a config that omits
// the new keys. Keep DEFAULT_TEST_GLOBS in sync with gate.config.json's list.
// The vendored glob engine (lib/glob.js) has NO brace expansion, so each
// alternative is its own entry; tokens are delimiter-anchored so `*Spec.*`
// matches `FooSpec.ts` but not `Special.tsx`.
export const DEFAULT_TEST_GLOBS = [
  '**/*.spec.*',
  '**/*.test.*',
  '**/*_spec.*',
  '**/*_test.*',
  '**/*Spec.*',
  '**/*Test.*',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/e2e/**',
  '**/cypress/**',
  '**/playwright/**',
];
const DEFAULT_MAX_TEST_LOC = 150;

/**
 * @typedef {'product' | 'test' | 'shared'} FileKind
 */

/**
 * @typedef {Object} PerFile
 * @property {string} path
 * @property {number} added
 * @property {number} removed
 * @property {FileKind} [kind]
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
 * @property {number} product_loc
 * @property {number} test_loc
 * @property {number} max_files
 * @property {number} max_loc
 * @property {number} max_test_loc
 * @property {string[]} ceiling_breaches
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
 * Classify a changed file as product / test / shared.
 *
 * A file matching a `test_globs` entry is **test**; otherwise it is **product**
 * (product = not-test by default). When `product_globs` is configured, a file
 * matching **both** lists is **shared** — its LOC counts toward both budgets
 * (conservative: a dual-purpose file, e.g. a fixtures module imported by product
 * code, never dodges either ceiling). This is per-file/glob-based, never a
 * per-line split of a file that mixes product and test code.
 * @param {string} path
 * @param {string[]} testGlobs
 * @param {string[]} productGlobs
 * @returns {FileKind}
 */
function classifyFile(path, testGlobs, productGlobs) {
  const isTest = matchesAnyGlob(path, testGlobs) !== null;
  // product = not-test, PLUS any test-matching file the repo explicitly lists in
  // product_globs (that file becomes shared). No LOC is ever dropped.
  const isProduct = !isTest || (productGlobs.length > 0 && matchesAnyGlob(path, productGlobs) !== null);
  if (isTest && isProduct) return 'shared';
  return isTest ? 'test' : 'product';
}

/**
 * Compute deny-list hits, counts, split-ceiling breach, and hard-fail flag.
 * @param {ScanDiffInput} input
 * @returns {ScanDiffResult}
 */
export function scanDiff({ nameOnly, numstat, config, baseRef }) {
  const globs = config.denylist_globs || [];
  const testGlobs = config.test_globs || DEFAULT_TEST_GLOBS;
  const productGlobs = config.product_globs || [];

  /** @type {DenyHit[]} */
  const deny_hits = [];
  for (const f of nameOnly) {
    if (!f) continue;
    const matched = matchesAnyGlob(f, globs);
    if (matched) deny_hits.push({ path: f, matched_glob: matched });
  }

  const parsed = typeof numstat === 'string' ? parseNumstat(numstat) : numstat;
  let loc_added = 0;
  let loc_removed = 0;
  let product_loc = 0;
  let test_loc = 0;
  /** @type {PerFile[]} */
  const perFile = [];
  for (const row of parsed) {
    loc_added += row.added;
    loc_removed += row.removed;
    const kind = classifyFile(row.path, testGlobs, productGlobs);
    const loc = row.added + row.removed;
    if (kind === 'product' || kind === 'shared') product_loc += loc;
    if (kind === 'test' || kind === 'shared') test_loc += loc;
    perFile.push({ ...row, kind });
  }

  const files_changed = nameOnly.filter((f) => !!f).length;
  const loc_total = loc_added + loc_removed;
  const max_files = config.max_files;
  const max_loc = config.max_loc; // now the PRODUCT (non-test) LOC ceiling
  const max_test_loc = config.max_test_loc ?? DEFAULT_MAX_TEST_LOC;

  /** @type {string[]} */
  const ceiling_breaches = [];
  if (files_changed > max_files) ceiling_breaches.push('files_changed');
  if (product_loc > max_loc) ceiling_breaches.push('product_loc');
  if (test_loc > max_test_loc) ceiling_breaches.push('test_loc');
  const over_ceiling = ceiling_breaches.length > 0;
  const hard_fail = deny_hits.length > 0 || over_ceiling;

  return {
    base_ref: baseRef,
    deny_hits,
    files_changed,
    loc_added,
    loc_removed,
    loc_total,
    product_loc,
    test_loc,
    max_files,
    max_loc,
    max_test_loc,
    ceiling_breaches,
    over_ceiling,
    hard_fail,
    per_file: perFile,
  };
}
