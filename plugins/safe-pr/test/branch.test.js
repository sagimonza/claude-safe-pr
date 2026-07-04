// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTicket,
  branchMatchesConvention,
  slugify,
  buildBranchName,
} from '../lib/branch.js';

const TICKET_REGEX = '^[A-Z][A-Z0-9]+-[0-9]+$';
const BRANCH_REGEX = '^[A-Z][A-Z0-9]+-[0-9]+_';

test('validateTicket accepts well-formed Jira ids', () => {
  assert.equal(validateTicket('DEV-12345', TICKET_REGEX), true);
  assert.equal(validateTicket('ABC1-7', TICKET_REGEX), true);
});

test('validateTicket rejects malformed ids', () => {
  assert.equal(validateTicket('dev-123', TICKET_REGEX), false);
  assert.equal(validateTicket('12345', TICKET_REGEX), false);
  assert.equal(validateTicket('DEV_123', TICKET_REGEX), false);
  assert.equal(validateTicket('', TICKET_REGEX), false);
  // @ts-expect-error non-string
  assert.equal(validateTicket(undefined, TICKET_REGEX), false);
});

test('branchMatchesConvention only passes ticket-prefixed branches', () => {
  assert.equal(branchMatchesConvention('DEV-12345_foo', BRANCH_REGEX), true);
  assert.equal(branchMatchesConvention('safe-pr/foo', BRANCH_REGEX), false);
  assert.equal(branchMatchesConvention('unknown', BRANCH_REGEX), false);
  assert.equal(branchMatchesConvention('', BRANCH_REGEX), false);
});

test('slugify produces git-safe slugs', () => {
  assert.equal(slugify('Change Button Label'), 'change-button-label');
  assert.equal(slugify('  weird__name!! '), 'weird-name');
  assert.equal(slugify('---'), '');
});

test('buildBranchName builds a convention branch from a valid ticket', () => {
  const r = buildBranchName({ ticket: 'DEV-12345', slug: 'Change Button Label', ticketRegex: TICKET_REGEX });
  assert.equal(r.ok, true);
  assert.equal(r.branch, 'DEV-12345_change-button-label');
  assert.equal(branchMatchesConvention(/** @type {string} */ (r.branch), BRANCH_REGEX), true);
});

test('buildBranchName trims surrounding whitespace on the ticket', () => {
  const r = buildBranchName({ ticket: '  DEV-1 ', slug: 'x', ticketRegex: TICKET_REGEX });
  assert.equal(r.ok, true);
  assert.equal(r.branch, 'DEV-1_x');
});

test('buildBranchName rejects a malformed ticket', () => {
  const r = buildBranchName({ ticket: 'nope', slug: 'x', ticketRegex: TICKET_REGEX });
  assert.equal(r.ok, false);
  assert.match(r.reason || '', /does not match/);
});

test('buildBranchName rejects an empty logical name', () => {
  const r = buildBranchName({ ticket: 'DEV-1', slug: '!!!', ticketRegex: TICKET_REGEX });
  assert.equal(r.ok, false);
  assert.match(r.reason || '', /empty/);
});
