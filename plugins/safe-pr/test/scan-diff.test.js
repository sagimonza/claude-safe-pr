// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanDiff, parseNumstat } from '../lib/scan-diff.js';

const config = {
  denylist_globs: ['**/migrations/**', 'package.json', '**/package.json', '**/*.tf'],
  max_files: 8,
  max_loc: 150,
};

test('parseNumstat — handles binary lines, tabs, and empty input', () => {
  assert.deepEqual(parseNumstat(''), []);
  assert.deepEqual(parseNumstat('10\t5\tsrc/a.js'), [
    { path: 'src/a.js', added: 10, removed: 5 },
  ]);
  // Binary file reports -/-, counts as 0 LOC.
  assert.deepEqual(parseNumstat('-\t-\timg/logo.png'), [
    { path: 'img/logo.png', added: 0, removed: 0 },
  ]);
  // Path containing a tab is preserved.
  assert.deepEqual(parseNumstat('1\t2\tdir/we ird\tname.js'), [
    { path: 'dir/we ird\tname.js', added: 1, removed: 2 },
  ]);
});

test('deny-hit detection with correct matched_glob (multi-deny case)', () => {
  const nameOnly = ['package.json', 'src/db/migrations/001.sql', 'src/components/Button.jsx'];
  const numstat =
    '5\t2\tpackage.json\n10\t0\tsrc/db/migrations/001.sql\n3\t1\tsrc/components/Button.jsx';
  const r = scanDiff({ nameOnly, numstat, config, baseRef: 'origin/main' });
  assert.deepEqual(r.deny_hits, [
    { path: 'package.json', matched_glob: 'package.json' },
    { path: 'src/db/migrations/001.sql', matched_glob: '**/migrations/**' },
  ]);
  assert.equal(r.hard_fail, true);
});

test('LOC sums, per_file shape, and binary files counted as files', () => {
  const nameOnly = ['src/a.js', 'img/logo.png'];
  const numstat = '10\t5\tsrc/a.js\n-\t-\timg/logo.png';
  const r = scanDiff({ nameOnly, numstat, config, baseRef: 'X' });
  assert.equal(r.files_changed, 2);
  assert.equal(r.loc_added, 10);
  assert.equal(r.loc_removed, 5);
  assert.equal(r.loc_total, 15);
  assert.deepEqual(r.per_file, [
    { path: 'src/a.js', added: 10, removed: 5 },
    { path: 'img/logo.png', added: 0, removed: 0 },
  ]);
});

test('clean presentational diff -> no hard fail', () => {
  const nameOnly = ['src/components/Button.jsx'];
  const numstat = '4\t2\tsrc/components/Button.jsx';
  const r = scanDiff({ nameOnly, numstat, config, baseRef: 'X' });
  assert.deepEqual(r.deny_hits, []);
  assert.equal(r.over_ceiling, false);
  assert.equal(r.hard_fail, false);
});

test('over_ceiling boundaries — max_files (exactly at vs one over)', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => `src/f${i}.js`);
  const numstatFor = (paths) => paths.map((p) => `1\t0\t${p}`).join('\n');

  const at = mk(8);
  const rAt = scanDiff({ nameOnly: at, numstat: numstatFor(at), config, baseRef: 'X' });
  assert.equal(rAt.over_ceiling, false, '8 files == max_files is not over');

  const over = mk(9);
  const rOver = scanDiff({ nameOnly: over, numstat: numstatFor(over), config, baseRef: 'X' });
  assert.equal(rOver.over_ceiling, true, '9 files > max_files is over');
  assert.equal(rOver.hard_fail, true);
});

test('over_ceiling boundaries — max_loc (exactly at vs one over)', () => {
  const at = scanDiff({
    nameOnly: ['src/a.js'],
    numstat: '100\t50\tsrc/a.js', // 150 total == max_loc
    config,
    baseRef: 'X',
  });
  assert.equal(at.loc_total, 150);
  assert.equal(at.over_ceiling, false);

  const over = scanDiff({
    nameOnly: ['src/a.js'],
    numstat: '100\t51\tsrc/a.js', // 151 total > max_loc
    config,
    baseRef: 'X',
  });
  assert.equal(over.loc_total, 151);
  assert.equal(over.over_ceiling, true);
  assert.equal(over.hard_fail, true);
});

test('scanDiff accepts pre-parsed numstat array', () => {
  const r = scanDiff({
    nameOnly: ['src/a.js'],
    numstat: [{ path: 'src/a.js', added: 3, removed: 1 }],
    config,
    baseRef: 'X',
  });
  assert.equal(r.loc_total, 4);
});
