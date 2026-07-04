// @ts-check
//
// config.js — load + deep-merge the gate config. The merge logic is pure and
// unit-testable; file access is injected via `readFile`/`exists`.
//
// Effective config = plugin default (config/gate.config.json), with an optional
// repo-level override (.safe-pr.config.json at the repo root) deep-merged on
// top. This mirrors the bash `jq -s '.[0] * .[1]'` semantics.

/**
 * Deep-merge `override` onto `base`, matching `jq '.[0] * .[1]'`:
 * objects are merged recursively; any non-object value (including arrays)
 * from the override replaces the base value wholesale.
 * @param {Record<string, any>} base
 * @param {Record<string, any>} override
 * @returns {Record<string, any>}
 */
export function deepMerge(base, override) {
  const out = { ...base };
  for (const key of Object.keys(override)) {
    const b = out[key];
    const o = override[key];
    if (isPlainObject(b) && isPlainObject(o)) {
      out[key] = deepMerge(b, o);
    } else {
      out[key] = o;
    }
  }
  return out;
}

/**
 * @param {any} v
 * @returns {boolean}
 */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @typedef {Object} LoadConfigDeps
 * @property {string} pluginRoot  Plugin root (the dir above bin/).
 * @property {string} [repoRoot]  Target repo root, if known.
 * @property {(path: string) => string} readFile  Reads a file as UTF-8 text.
 * @property {(path: string) => boolean} exists  Returns whether a path exists.
 * @property {(...parts: string[]) => string} [join]  Path join (defaults to '/' join).
 */

/**
 * Load the effective merged config.
 * @param {LoadConfigDeps} deps
 * @returns {Record<string, any>}
 */
export function loadConfig({ pluginRoot, repoRoot, readFile, exists, join }) {
  const j = join || ((...p) => p.join('/'));
  const defaultPath = j(pluginRoot, 'config', 'gate.config.json');
  if (!exists(defaultPath)) {
    throw new Error(`pr-gate: default config not found at ${defaultPath}`);
  }
  const base = JSON.parse(readFile(defaultPath));
  if (repoRoot) {
    const overridePath = j(repoRoot, '.safe-pr.config.json');
    if (exists(overridePath)) {
      const override = JSON.parse(readFile(overridePath));
      return deepMerge(base, override);
    }
  }
  return base;
}
