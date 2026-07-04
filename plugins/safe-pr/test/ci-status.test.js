// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { ciStatus, evaluateChecks } from '../lib/ci-status.js';

const config = {
  ci_stability_polls: 3,
  ci_poll_interval_seconds: 15,
  ci_max_total_seconds: 1800,
};

/** A no-op awaitable sleep so the loop never actually waits. */
const noSleep = () => Promise.resolve();

/**
 * Build a fetchChecks that returns each array in `sequence` on successive
 * calls, repeating the last entry forever after.
 * @param {Array<Array<{name:string,state:string,bucket:string}>>} sequence
 */
function scripted(sequence) {
  let i = 0;
  return () => {
    const v = sequence[Math.min(i, sequence.length - 1)];
    i += 1;
    return v;
  };
}

const GREEN = [
  { name: 'build', state: 'SUCCESS', bucket: 'pass' },
  { name: 'test', state: 'SUCCESS', bucket: 'pass' },
];

test('evaluateChecks — all green', () => {
  const e = evaluateChecks(GREEN);
  assert.equal(e.terminal, true);
  assert.equal(e.failing, false);
  assert.equal(e.signature, 'build test');
  assert.equal(e.count, 2);
});

test('evaluateChecks — one pending', () => {
  const e = evaluateChecks([
    { name: 'build', state: 'SUCCESS', bucket: 'pass' },
    { name: 'test', state: 'IN_PROGRESS', bucket: 'pending' },
  ]);
  assert.equal(e.terminal, false);
  assert.equal(e.failing, false);
});

test('evaluateChecks — one fail (by bucket and by state)', () => {
  assert.equal(evaluateChecks([{ name: 'x', state: 'COMPLETED', bucket: 'fail' }]).failing, true);
  assert.equal(evaluateChecks([{ name: 'x', state: 'TIMED_OUT', bucket: 'pass' }]).failing, true);
});

test('all green and stable -> stable:true, all_passing:true', async () => {
  const r = await ciStatus({
    pr: '42',
    config,
    fetchChecks: scripted([GREEN]),
    sleep: noSleep,
  });
  assert.equal(r.stable, true);
  assert.equal(r.all_passing, true);
  assert.equal(r.no_checks, false);
  // 3 polls of the same signature -> stable on the 3rd poll, elapsed = 2*interval.
  assert.equal(r.elapsed_seconds, 30);
  assert.deepEqual(r.checks, GREEN);
});

test('green-gap: a new pending check appears -> must NOT declare stable early', async () => {
  const GREEN_PLUS_NEW = [
    ...GREEN,
    { name: 'lint', state: 'IN_PROGRESS', bucket: 'pending' },
  ];
  const GREEN_PLUS_DONE = [
    ...GREEN,
    { name: 'lint', state: 'SUCCESS', bucket: 'pass' },
  ];
  // poll1: GREEN (sig A), poll2: new pending check (sig B, resets count to 1),
  // then the larger set holds green and stabilizes.
  const r = await ciStatus({
    pr: '42',
    config,
    fetchChecks: scripted([GREEN, GREEN_PLUS_NEW, GREEN_PLUS_DONE]),
    sleep: noSleep,
  });
  assert.equal(r.stable, true);
  assert.equal(r.all_passing, true);
  // Signature is name-based: poll1 sig="build test" (count1). poll2 introduces
  // "lint" -> sig="build lint test" resets count to 1 (still pending, not terminal).
  // poll3 same names, terminal now, count2. poll4 count3 -> stable. elapsed=3*15.
  assert.equal(r.elapsed_seconds, 45);
  assert.equal(r.checks.length, 3);
});

test('terminal failure -> all_passing:false', async () => {
  const FAIL = [
    { name: 'build', state: 'SUCCESS', bucket: 'pass' },
    { name: 'test', state: 'FAILURE', bucket: 'fail' },
  ];
  const r = await ciStatus({
    pr: '42',
    config,
    fetchChecks: scripted([FAIL]),
    sleep: noSleep,
  });
  assert.equal(r.stable, true);
  assert.equal(r.all_passing, false);
});

test('empty set held for the window -> no_checks:true', async () => {
  const r = await ciStatus({
    pr: '42',
    config,
    fetchChecks: scripted([[]]),
    sleep: noSleep,
  });
  assert.equal(r.no_checks, true);
  assert.equal(r.stable, true);
  assert.equal(r.all_passing, true);
  assert.deepEqual(r.checks, []);
});

test('timeout path -> stable:false, all_passing:false', async () => {
  // A perpetually-pending check never reaches terminal; loop bails at max_total.
  const PENDING = [{ name: 'build', state: 'IN_PROGRESS', bucket: 'pending' }];
  const r = await ciStatus({
    pr: '42',
    config,
    fetchChecks: scripted([PENDING]),
    sleep: noSleep,
  });
  assert.equal(r.stable, false);
  assert.equal(r.all_passing, false);
  assert.equal(r.elapsed_seconds, config.ci_max_total_seconds);
});
