// @ts-check
//
// ci-status.js — stability-aware CI read (pure state machine + injected I/O).
//
// Only declares green when ALL checks are terminal, none failing, and the set
// of checks has not grown/changed for `ci_stability_polls` consecutive polls.
// Ported exactly from the bash `cmd_ci_status` loop.

const FAILING_STATE_RE = /FAIL|TIMED_OUT|CANCEL|ACTION_REQUIRED|ERROR|STARTUP_FAILURE/;

/**
 * @typedef {Object} Check
 * @property {string} name
 * @property {string} state
 * @property {string} bucket
 */

/**
 * @typedef {Object} CheckEval
 * @property {boolean} terminal  No check is still pending.
 * @property {boolean} failing   Any check failed/cancelled/errored.
 * @property {string} signature  Sorted check names joined by spaces.
 * @property {number} count
 */

/**
 * Pure predicate evaluation over a set of checks.
 * @param {Check[]} checks
 * @returns {CheckEval}
 */
export function evaluateChecks(checks) {
  const terminal = !checks.some((c) => c.bucket === 'pending');
  const failing = checks.some(
    (c) =>
      c.bucket === 'fail' ||
      c.bucket === 'cancel' ||
      FAILING_STATE_RE.test(String(c.state).toUpperCase())
  );
  const signature = checks
    .map((c) => c.name)
    .sort()
    .join(' ');
  return { terminal, failing, signature, count: checks.length };
}

/**
 * @typedef {Object} CiStatusResult
 * @property {string} pr
 * @property {boolean} stable
 * @property {boolean} all_passing
 * @property {boolean} no_checks
 * @property {number} elapsed_seconds
 * @property {Check[]} checks
 */

/**
 * @typedef {Object} CiStatusDeps
 * @property {string} pr
 * @property {Record<string, any>} config
 * @property {() => Promise<Check[]> | Check[]} fetchChecks  Returns current checks.
 * @property {(seconds: number) => Promise<void> | void} sleep  Awaitable delay.
 * @property {(msg: string) => void} [log]  Diagnostic sink (stderr in production).
 */

/**
 * Run the stability-aware polling loop.
 * @param {CiStatusDeps} deps
 * @returns {Promise<CiStatusResult>}
 */
export async function ciStatus({ pr, config, fetchChecks, sleep, log }) {
  const polls = config.ci_stability_polls;
  const interval = config.ci_poll_interval_seconds;
  const maxTotal = config.ci_max_total_seconds;
  const emit = log || (() => {});

  let elapsed = 0;
  let stableCount = 0;
  let prevSig = '__none__';
  /** @type {Check[]} */
  let final = [];
  let noChecks = false;
  let stable = false;
  let allPassing = false;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const checks = (await fetchChecks()) || [];
    final = checks;
    const { terminal, failing, signature, count } = evaluateChecks(checks);

    if (signature === prevSig) {
      stableCount += 1;
    } else {
      stableCount = 1;
    }
    prevSig = signature;

    emit(
      `pr-gate ci-status: poll @ ${elapsed}s — checks=${count} terminal=${terminal} failing=${failing} stable_run=${stableCount}/${polls}`
    );

    if (count === 0) {
      if (stableCount >= polls) {
        noChecks = true;
        stable = true;
        allPassing = true;
        break;
      }
    } else if (terminal && stableCount >= polls) {
      stable = true;
      allPassing = !failing;
      break;
    }

    if (elapsed >= maxTotal) {
      emit(
        `pr-gate ci-status: timed out after ${elapsed}s without reaching a stable terminal state`
      );
      stable = false;
      allPassing = false;
      break;
    }

    await sleep(interval);
    elapsed += interval;
  }

  return {
    pr,
    stable,
    all_passing: allPassing,
    no_checks: noChecks,
    elapsed_seconds: elapsed,
    checks: final,
  };
}
