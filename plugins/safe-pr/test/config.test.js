// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { deepMerge, loadConfig } from '../lib/config.js';

test('deepMerge — override replaces scalars (jq .[0] * .[1] semantics)', () => {
  const base = { max_files: 8, max_loc: 150, ci_stability_polls: 3 };
  const override = { max_loc: 40 };
  assert.deepEqual(deepMerge(base, override), {
    max_files: 8,
    max_loc: 40,
    ci_stability_polls: 3,
  });
});

test('deepMerge — arrays are replaced wholesale, not concatenated', () => {
  const base = { denylist_globs: ['a', 'b'] };
  const override = { denylist_globs: ['c'] };
  assert.deepEqual(deepMerge(base, override), { denylist_globs: ['c'] });
});

test('deepMerge — nested objects merge recursively', () => {
  const base = { a: { x: 1, y: 2 }, top: 1 };
  const override = { a: { y: 3, z: 4 } };
  assert.deepEqual(deepMerge(base, override), { a: { x: 1, y: 3, z: 4 }, top: 1 });
});

/**
 * Build injected file deps from an in-memory map.
 * @param {Record<string,string>} files
 */
function fakeFs(files) {
  return {
    readFile: (/** @type {string} */ p) => {
      if (!(p in files)) throw new Error('ENOENT ' + p);
      return files[p];
    },
    exists: (/** @type {string} */ p) => p in files,
  };
}

test('loadConfig — default only when no repo override', () => {
  const files = {
    '/plugin/config/gate.config.json': JSON.stringify({ max_loc: 150, denylist_globs: ['a'] }),
  };
  const cfg = loadConfig({ pluginRoot: '/plugin', ...fakeFs(files) });
  assert.equal(cfg.max_loc, 150);
});

test('loadConfig — repo override deep-merged on top', () => {
  const files = {
    '/plugin/config/gate.config.json': JSON.stringify({ max_loc: 150, max_files: 8 }),
    '/repo/.safe-pr.config.json': JSON.stringify({ max_loc: 40 }),
  };
  const cfg = loadConfig({ pluginRoot: '/plugin', repoRoot: '/repo', ...fakeFs(files) });
  assert.equal(cfg.max_loc, 40);
  assert.equal(cfg.max_files, 8);
});

test('loadConfig — missing default throws', () => {
  assert.throws(
    () => loadConfig({ pluginRoot: '/plugin', ...fakeFs({}) }),
    /default config not found/
  );
});
