// @ts-check
//
// gh.js — thin GitHub CLI wrappers (I/O seam).

import { execFileSync } from 'node:child_process';

/**
 * @returns {boolean} whether `gh` is present and authenticated.
 */
export function authOk() {
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch PR checks as an array of {name,state,bucket}. Returns [] on "no checks"
 * or any non-zero exit (mirrors the bash `fetch_checks`).
 * @param {string} pr
 * @returns {import('./ci-status.js').Check[]}
 */
export function prChecks(pr) {
  let raw;
  try {
    raw = execFileSync('gh', ['pr', 'checks', pr, '--json', 'name,state,bucket'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return [];
  }
  if (!raw || raw === 'null') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
