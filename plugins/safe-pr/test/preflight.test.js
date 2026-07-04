// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { assemblePreflight } from '../lib/preflight.js';

const BRANCH_REGEX = '^[A-Z][A-Z0-9]+-[0-9]+_';

test('on a feature branch, base ref exists and up to date', () => {
  const r = assemblePreflight({
    clean_tree: true,
    branch: 'feature/x',
    default_branch: 'main',
    base_ref_exists: true,
    behind: 0,
    gh_ok: true,
    branch_regex: BRANCH_REGEX,
  });
  assert.equal(r.on_default_branch, false);
  assert.equal(r.base_up_to_date, true);
  assert.equal(r.clean_tree, true);
  assert.equal(r.gh_ok, true);
  assert.equal(r.node_ok, true);
});

test('on the default branch', () => {
  const r = assemblePreflight({
    clean_tree: true,
    branch: 'main',
    default_branch: 'main',
    base_ref_exists: true,
    behind: 0,
    gh_ok: false,
    branch_regex: BRANCH_REGEX,
  });
  assert.equal(r.on_default_branch, true);
});

test('ticket-prefixed branch matches the convention', () => {
  const r = assemblePreflight({
    clean_tree: true,
    branch: 'DEV-12345_change-button-label',
    default_branch: 'main',
    base_ref_exists: true,
    behind: 0,
    gh_ok: true,
    branch_regex: BRANCH_REGEX,
  });
  assert.equal(r.branch_matches_convention, true);
});

test('non-ticket branch fails the convention', () => {
  const r = assemblePreflight({
    clean_tree: true,
    branch: 'safe-pr/some-slug',
    default_branch: 'main',
    base_ref_exists: true,
    behind: 0,
    gh_ok: true,
    branch_regex: BRANCH_REGEX,
  });
  assert.equal(r.branch_matches_convention, false);
});

test('the default branch never counts as convention-matching', () => {
  const r = assemblePreflight({
    clean_tree: true,
    branch: 'main',
    default_branch: 'main',
    base_ref_exists: true,
    behind: 0,
    gh_ok: true,
    branch_regex: BRANCH_REGEX,
  });
  assert.equal(r.branch_matches_convention, false);
});

test('behind the base -> base_up_to_date:false', () => {
  const r = assemblePreflight({
    clean_tree: true,
    branch: 'feature/x',
    default_branch: 'main',
    base_ref_exists: true,
    behind: 3,
    gh_ok: true,
  });
  assert.equal(r.base_up_to_date, false);
});

test('missing base ref -> base_up_to_date:false even if behind is 0/-1', () => {
  const r = assemblePreflight({
    clean_tree: true,
    branch: 'feature/x',
    default_branch: 'main',
    base_ref_exists: false,
    behind: -1,
    gh_ok: true,
  });
  assert.equal(r.base_up_to_date, false);
});

test('dirty tree -> clean_tree:false', () => {
  const r = assemblePreflight({
    clean_tree: false,
    branch: 'feature/x',
    default_branch: 'main',
    base_ref_exists: true,
    behind: 0,
    gh_ok: true,
  });
  assert.equal(r.clean_tree, false);
});
