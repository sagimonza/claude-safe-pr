// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { globToRegExp, matchesAnyGlob } from '../lib/glob.js';

test('glob matching — positive and negative cases', () => {
  /** @type {Array<[string, string, boolean]>} */
  const cases = [
    // package.json matches root only
    ['package.json', 'package.json', true],
    ['package.json', 'src/package.json', false],
    // **/package.json matches nested (and root via the (.*/)? prefix)
    ['**/package.json', 'src/package.json', true],
    ['**/package.json', 'a/b/c/package.json', true],
    ['**/package.json', 'package.json', true],
    // **/migrations/** matches nested and top-level dirs
    ['**/migrations/**', 'a/b/migrations/c.sql', true],
    ['**/migrations/**', 'migrations/x', true],
    ['**/migrations/**', 'src/other/file.sql', false],
    // .github/** matches workflow files
    ['.github/**', '.github/workflows/ci.yml', true],
    ['.github/**', 'src/.github/x', false],
    // **/*.config.* matches config files anywhere
    ['**/*.config.*', 'app/jest.config.ts', true],
    ['**/*.config.*', 'webpack.config.js', true],
    ['**/*.config.*', 'src/components/Button.jsx', false],
    // **/*.tf
    ['**/*.tf', 'infra/main.tf', true],
    ['**/*.tf', 'main.tf', true],
    ['**/*.tf', 'main.tfvars', false],
    // ? matches a single non-slash char
    ['file?.js', 'file1.js', true],
    ['file?.js', 'file12.js', false],
    ['file?.js', 'file/.js', false],
    // * does not cross a slash
    ['src/*.js', 'src/a.js', true],
    ['src/*.js', 'src/sub/a.js', false],
  ];
  for (const [glob, path, expected] of cases) {
    assert.equal(
      globToRegExp(glob).test(path),
      expected,
      `${glob} vs ${path} should be ${expected}`
    );
  }
});

test('regex specials in glob are escaped', () => {
  // A literal dot must not match an arbitrary char.
  assert.equal(globToRegExp('a.b').test('a.b'), true);
  assert.equal(globToRegExp('a.b').test('axb'), false);
});

test('matchesAnyGlob returns the first matching glob', () => {
  const globs = ['**/*.tf', 'package.json', '**/package.json'];
  assert.equal(matchesAnyGlob('src/package.json', globs), '**/package.json');
  assert.equal(matchesAnyGlob('package.json', globs), 'package.json');
  assert.equal(matchesAnyGlob('infra/main.tf', globs), '**/*.tf');
  assert.equal(matchesAnyGlob('src/components/Button.jsx', globs), null);
});

test('matchesAnyGlob skips empty globs', () => {
  assert.equal(matchesAnyGlob('package.json', ['', 'package.json']), 'package.json');
});
