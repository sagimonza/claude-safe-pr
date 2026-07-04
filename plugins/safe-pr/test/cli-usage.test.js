// @ts-check
//
// CLI-level smoke tests for the gate's argument handling. The rest of the suite
// unit-tests lib/ behind injected I/O; this file guards the one contract that
// lives in bin/pr-gate.js itself: help is a SUCCESS (exit 0), misuse is a usage
// error (exit 2). The skill treats any non-zero gate exit as a STOP, so a probe
// like `help`/`--help` must never look like a Layer A failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'pr-gate.js');

/** @param {string[]} args @returns {{ code: number, stdout: string, stderr: string }} */
function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [GATE, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status ?? 1, stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? '' };
  }
}

test('help / --help / -h exit 0 and print usage on stdout', () => {
  for (const flag of ['help', '--help', '-h']) {
    const r = run([flag]);
    assert.equal(r.code, 0, `${flag} should exit 0`);
    assert.match(r.stdout, /usage: pr-gate\.js/, `${flag} should print usage to stdout`);
  }
});

test('no subcommand is a usage error (exit 2)', () => {
  const r = run([]);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /usage: pr-gate\.js/);
});

test('unknown subcommand is a usage error (exit 2) and names the bad verb', () => {
  const r = run(['frobnicate']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /unknown subcommand 'frobnicate'/);
  assert.match(r.stderr, /usage: pr-gate\.js/);
});
