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
    { path: 'src/a.js', added: 10, removed: 5, kind: 'product' },
    { path: 'img/logo.png', added: 0, removed: 0, kind: 'product' },
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

// --- Split LOC ceiling: product vs. test classification -------------------

const splitConfig = {
  denylist_globs: ['**/migrations/**', 'package.json', '**/package.json', '**/*.tf'],
  max_files: 8,
  max_loc: 150,
  max_test_loc: 150,
  test_globs: [
    '**/*.spec.*',
    '**/*.test.*',
    '**/__tests__/**',
    '**/playwright/**',
  ],
};

test('a test file counts to test_loc, not product_loc; kind is test', () => {
  const nameOnly = ['src/pages/Home.spec.tsx'];
  const numstat = '40\t10\tsrc/pages/Home.spec.tsx';
  const r = scanDiff({ nameOnly, numstat, config: splitConfig, baseRef: 'X' });
  assert.equal(r.test_loc, 50);
  assert.equal(r.product_loc, 0);
  assert.equal(r.per_file[0].kind, 'test');
  assert.equal(r.over_ceiling, false);
});

test('a product file counts to product_loc, not test_loc; kind is product', () => {
  const nameOnly = ['src/pages/Home.tsx'];
  const numstat = '4\t2\tsrc/pages/Home.tsx';
  const r = scanDiff({ nameOnly, numstat, config: splitConfig, baseRef: 'X' });
  assert.equal(r.product_loc, 6);
  assert.equal(r.test_loc, 0);
  assert.equal(r.per_file[0].kind, 'product');
});

test('mixed diff — under both ceilings does not breach', () => {
  const nameOnly = ['src/pages/Home.tsx', 'src/pages/Home.spec.tsx'];
  const numstat = '5\t3\tsrc/pages/Home.tsx\n60\t20\tsrc/pages/Home.spec.tsx';
  const r = scanDiff({ nameOnly, numstat, config: splitConfig, baseRef: 'X' });
  assert.equal(r.product_loc, 8);
  assert.equal(r.test_loc, 80);
  assert.equal(r.over_ceiling, false);
  assert.deepEqual(r.ceiling_breaches, []);
  assert.equal(r.hard_fail, false);
});

test('mixed diff — breaches on product_loc alone', () => {
  const nameOnly = ['src/pages/Home.tsx', 'src/pages/Home.spec.tsx'];
  const numstat = '151\t0\tsrc/pages/Home.tsx\n10\t0\tsrc/pages/Home.spec.tsx';
  const r = scanDiff({ nameOnly, numstat, config: splitConfig, baseRef: 'X' });
  assert.equal(r.product_loc, 151);
  assert.equal(r.test_loc, 10);
  assert.deepEqual(r.ceiling_breaches, ['product_loc']);
  assert.equal(r.over_ceiling, true);
  assert.equal(r.hard_fail, true);
});

test('mixed diff — breaches on test_loc alone', () => {
  const nameOnly = ['src/pages/Home.tsx', 'src/pages/Home.spec.tsx'];
  const numstat = '10\t0\tsrc/pages/Home.tsx\n151\t0\tsrc/pages/Home.spec.tsx';
  const r = scanDiff({ nameOnly, numstat, config: splitConfig, baseRef: 'X' });
  assert.equal(r.product_loc, 10);
  assert.equal(r.test_loc, 151);
  assert.deepEqual(r.ceiling_breaches, ['test_loc']);
  assert.equal(r.over_ceiling, true);
  assert.equal(r.hard_fail, true);
});

test('a small product change plus a normal spec no longer trips the single ceiling', () => {
  // Pre-split, product(6) + test(140) = 146 total which was fine, but test(160)
  // would have tripped the old 150 total ceiling. Now each has its own budget.
  const nameOnly = ['src/pages/Home.tsx', 'src/pages/Home.spec.tsx'];
  const numstat = '6\t0\tsrc/pages/Home.tsx\n120\t0\tsrc/pages/Home.spec.tsx';
  const r = scanDiff({ nameOnly, numstat, config: splitConfig, baseRef: 'X' });
  assert.equal(r.loc_total, 126);
  assert.equal(r.product_loc, 6);
  assert.equal(r.test_loc, 120);
  assert.equal(r.over_ceiling, false);
});

test('shared file (matches both test_globs and product_globs) double-counts as kind shared', () => {
  const cfg = {
    ...splitConfig,
    // A fixtures module lives under playwright/ (a test glob) but is imported by
    // product code, so the repo also lists it as product => shared.
    product_globs: ['**/playwright/fixtures/**'],
  };
  const nameOnly = ['playwright/fixtures/users.ts'];
  const numstat = '30\t5\tplaywright/fixtures/users.ts';
  const r = scanDiff({ nameOnly, numstat, config: cfg, baseRef: 'X' });
  assert.equal(r.per_file[0].kind, 'shared');
  assert.equal(r.product_loc, 35);
  assert.equal(r.test_loc, 35);
});

test('a test-matching file NOT in product_globs stays test even when product_globs is set', () => {
  const cfg = { ...splitConfig, product_globs: ['**/playwright/fixtures/**'] };
  const nameOnly = ['playwright/specs/home.spec.ts'];
  const numstat = '20\t0\tplaywright/specs/home.spec.ts';
  const r = scanDiff({ nameOnly, numstat, config: cfg, baseRef: 'X' });
  assert.equal(r.per_file[0].kind, 'test');
  assert.equal(r.test_loc, 20);
  assert.equal(r.product_loc, 0);
});

test('defaults apply when config omits max_test_loc and test_globs', () => {
  // config (top of file) has no test_globs / max_test_loc — code defaults kick in.
  const nameOnly = ['src/pages/Home.spec.tsx'];
  const numstat = '151\t0\tsrc/pages/Home.spec.tsx';
  const r = scanDiff({ nameOnly, numstat, config, baseRef: 'X' });
  assert.equal(r.per_file[0].kind, 'test', 'default test_globs classify .spec. as test');
  assert.equal(r.test_loc, 151);
  assert.equal(r.product_loc, 0);
  assert.equal(r.max_test_loc, 150, 'default max_test_loc applied');
  assert.deepEqual(r.ceiling_breaches, ['test_loc']);
  assert.equal(r.over_ceiling, true);
});

test('anchored tokens do not over-match ordinary product names', () => {
  // Special.tsx / latest.config.js must NOT classify as test under the defaults.
  // (latest.config.js IS deny-listed, but here we check classification only.)
  const nameOnly = ['src/components/Special.tsx', 'src/pages/Specification.ts'];
  const numstat = '5\t0\tsrc/components/Special.tsx\n5\t0\tsrc/pages/Specification.ts';
  const r = scanDiff({ nameOnly, numstat, config, baseRef: 'X' });
  assert.equal(r.per_file[0].kind, 'product');
  assert.equal(r.per_file[1].kind, 'product');
  assert.equal(r.product_loc, 10);
  assert.equal(r.test_loc, 0);
});
