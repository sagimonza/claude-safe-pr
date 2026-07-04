// @ts-check
//
// branch.js — pure ticket/branch-name logic for the safe-pr gate.
//
// Policy: every safe-pr branch must start with a Jira ticket id so the work is
// traceable (e.g. DEV-12345_change-button-label). This module validates the
// operator-supplied ticket id and deterministically builds a safe branch name.
// No git I/O lives here — the CLI runs the actual `git checkout`.

/**
 * @param {string} ticket
 * @param {string} ticketRegex  Source for a RegExp (from config.branch_naming).
 * @returns {boolean}
 */
export function validateTicket(ticket, ticketRegex) {
  if (typeof ticket !== 'string') return false;
  return new RegExp(ticketRegex).test(ticket.trim());
}

/**
 * @param {string} branch
 * @param {string} branchRegex  Source for a RegExp (from config.branch_naming).
 * @returns {boolean}
 */
export function branchMatchesConvention(branch, branchRegex) {
  if (typeof branch !== 'string' || branch === '' || branch === 'unknown') return false;
  return new RegExp(branchRegex).test(branch);
}

/**
 * Turn a free-text logical name into a git-safe slug.
 * @param {string} slug
 * @returns {string}
 */
export function slugify(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

/**
 * @typedef {Object} BuildBranchResult
 * @property {boolean} ok
 * @property {string} [branch]  The validated branch name (only when ok).
 * @property {string} ticket
 * @property {string} [reason]  Why it was rejected (only when !ok).
 */

/**
 * Build a convention-compliant branch name from a ticket id + logical name.
 * @param {{ ticket: string, slug: string, ticketRegex: string }} args
 * @returns {BuildBranchResult}
 */
export function buildBranchName({ ticket, slug, ticketRegex }) {
  const t = typeof ticket === 'string' ? ticket.trim() : '';
  if (!validateTicket(t, ticketRegex)) {
    return {
      ok: false,
      ticket: t,
      reason: `ticket id ${JSON.stringify(t)} does not match required pattern ${ticketRegex} (expected e.g. DEV-12345)`,
    };
  }
  const s = slugify(slug);
  if (!s) {
    return { ok: false, ticket: t, reason: 'logical name is empty after slugifying; provide a short description' };
  }
  return { ok: true, ticket: t, branch: `${t}_${s}` };
}
