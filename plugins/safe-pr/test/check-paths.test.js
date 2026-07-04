// @ts-check
//
// Unit tests for the pure deny-list pre-check (lib/check-paths.js). This is the
// in-flow replacement for the old global PreToolUse hook, so it must match the
// same deny-list globs scan-diff uses.
import test from 'node:test';
import assert from 'node:assert/strict';

import { checkPaths, toRepoRelative } from '../lib/check-paths.js';

const config = {
  denylist_globs: ['**/migrations/**', '.github/**', 'package.json', '**/package.json', '**/*.tf'],
};

test('toRepoRelative strips the repo root prefix', () => {
  assert.equal(toRepoRelative('/repo/src/App.tsx', '/repo'), 'src/App.tsx');
});

test('toRepoRelative leaves paths outside the repo (or unknown root) untouched', () => {
  assert.equal(toRepoRelative('/other/x.tf', '/repo'), '/other/x.tf');
  assert.equal(toRepoRelative('src/App.tsx', null), 'src/App.tsx');
  assert.equal(toRepoRelative('src/App.tsx', undefined), 'src/App.tsx');
});

test('allowed presentational file is not denied', () => {
  const r = checkPaths({ paths: ['src/components/Button.tsx'], config, repoRoot: null });
  assert.equal(r.denied, false);
  assert.deepEqual(r.deny_hits, []);
  assert.deepEqual(r.checked, ['src/components/Button.tsx']);
});

test('deny-listed file is denied and names the matched glob', () => {
  const r = checkPaths({ paths: ['db/migrations/001_init.sql'], config, repoRoot: null });
  assert.equal(r.denied, true);
  assert.equal(r.deny_hits.length, 1);
  assert.equal(r.deny_hits[0].path, 'db/migrations/001_init.sql');
  assert.equal(r.deny_hits[0].matched_glob, '**/migrations/**');
});

test('absolute path under repo root is relativized before matching', () => {
  const r = checkPaths({ paths: ['/repo/package.json'], config, repoRoot: '/repo' });
  assert.equal(r.denied, true);
  assert.equal(r.deny_hits[0].path, 'package.json');
});

test('mixed batch reports only the denied entries but denies the whole call', () => {
  const r = checkPaths({
    paths: ['src/App.tsx', '.github/workflows/ci.yml', 'infra/main.tf'],
    config,
    repoRoot: null,
  });
  assert.equal(r.denied, true);
  assert.deepEqual(
    r.deny_hits.map((h) => h.path),
    ['.github/workflows/ci.yml', 'infra/main.tf']
  );
  assert.equal(r.checked.length, 3);
});

test('empty / falsy paths are skipped', () => {
  const r = checkPaths({ paths: ['', 'src/App.tsx'], config, repoRoot: null });
  assert.equal(r.denied, false);
  assert.deepEqual(r.checked, ['src/App.tsx']);
});

test('missing denylist_globs config does not throw and denies nothing', () => {
  const r = checkPaths({ paths: ['package.json'], config: {}, repoRoot: null });
  assert.equal(r.denied, false);
});
