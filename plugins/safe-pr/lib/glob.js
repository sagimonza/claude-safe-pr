// @ts-check
//
// glob.js — vendored, hand-written glob -> RegExp matcher (pure, no I/O).
//
// Imported by both lib/scan-diff.js (diff scan) and lib/check-paths.js (the
// pre-edit deny-list check) so the two can never drift apart. Ports the bash
// `glob_to_regex` converter exactly:
//   **/  -> (.*/)?      (any leading dirs, including none)
//   /**  -> /.*         (anything under a dir; falls out of the `**` -> .* rule)
//   **   -> .*
//   *    -> [^/]*       (within a path segment)
//   ?    -> [^/]
// Regex specials are escaped. Anchored ^...$.

const REGEX_SPECIALS = new Set(['.', '+', '(', ')', '{', '}', '|', '^', '$', '[', ']', '\\']);

/**
 * Convert a glob pattern to an anchored RegExp.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  let out = '';
  let i = 0;
  const n = glob.length;
  while (i < n) {
    const c = glob[i];
    const two = glob.slice(i, i + 2);
    if (two === '**') {
      if (glob[i + 2] === '/') {
        out += '(.*/)?';
        i += 3;
        continue;
      } else {
        out += '.*';
        i += 2;
        continue;
      }
    }
    if (c === '*') {
      out += '[^/]*';
    } else if (c === '?') {
      out += '[^/]';
    } else if (REGEX_SPECIALS.has(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
    i += 1;
  }
  return new RegExp('^' + out + '$');
}

/**
 * Return the first glob that matches `path`, or null if none match.
 * @param {string} path
 * @param {string[]} globs
 * @returns {string | null}
 */
export function matchesAnyGlob(path, globs) {
  for (const glob of globs) {
    if (!glob) continue;
    if (globToRegExp(glob).test(path)) return glob;
  }
  return null;
}
