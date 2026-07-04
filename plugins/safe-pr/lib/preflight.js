// @ts-check
//
// preflight.js — pure assembly of the preflight result from injected git facts.
// The CLI gathers the raw booleans/strings; this shapes the contract object and
// computes the derived flags (on_default_branch, base_up_to_date,
// branch_matches_convention).

import { branchMatchesConvention } from './branch.js';

/**
 * @typedef {Object} PreflightFacts
 * @property {boolean} clean_tree
 * @property {string} branch
 * @property {string} default_branch
 * @property {boolean} base_ref_exists  Whether refs/remotes/origin/<def> exists.
 * @property {number} behind  Commits on origin/<def> missing from HEAD (-1 if unknown).
 * @property {boolean} gh_ok
 * @property {string} branch_regex  Convention a feature branch must match (from config).
 */

/**
 * @typedef {Object} PreflightResult
 * @property {boolean} clean_tree
 * @property {string} branch
 * @property {string} default_branch
 * @property {boolean} on_default_branch
 * @property {boolean} base_up_to_date
 * @property {boolean} gh_ok
 * @property {boolean} branch_matches_convention  Branch starts with a Jira ticket id.
 * @property {boolean} node_ok  Always true if the script ran (symmetry/future).
 */

/**
 * @param {PreflightFacts} facts
 * @returns {PreflightResult}
 */
export function assemblePreflight(facts) {
  const on_default_branch = facts.branch === facts.default_branch;
  const base_up_to_date = facts.base_ref_exists && facts.behind === 0;
  const branch_matches_convention =
    !on_default_branch && branchMatchesConvention(facts.branch, facts.branch_regex);
  return {
    clean_tree: facts.clean_tree,
    branch: facts.branch,
    default_branch: facts.default_branch,
    on_default_branch,
    base_up_to_date,
    gh_ok: facts.gh_ok,
    branch_matches_convention,
    node_ok: true,
  };
}
