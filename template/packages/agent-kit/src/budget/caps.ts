import type { BudgetDecision, TokenUsage } from '../types.js';

/** Price of one model in micro-USD per million tokens. */
export type ModelRate = {
  model: string;
  inputMicroUsdPerMTok: bigint;
  cachedInputMicroUsdPerMTok: bigint;
  outputMicroUsdPerMTok: bigint;
};

export type Period = { capMicroUsd: bigint; spentMicroUsd: bigint; resetsAt: Date };
export type PeriodBudget = { day: Period; week: Period; month: Period };

const ECONOMY_THRESHOLD_PCT = 80n;
const PER_MILLION = 1_000_000n;
const PERIODS = ['month', 'week', 'day'] as const;

/**
 * Cost of one model call, rounded up to a whole micro-dollar. A model with no rate is
 * charged at the highest known rate for each token kind, so a newly configured model can
 * never spend for free unnoticed; `priced` is false so the caller can log it.
 */
export function costOf(
  rates: ModelRate[],
  model: string,
  t: TokenUsage,
): { costMicroUsd: bigint; priced: boolean } {
  const known = rates.find((p) => p.model === model);
  const max = (pick: (p: ModelRate) => bigint) =>
    rates.reduce((hi, p) => (pick(p) > hi ? pick(p) : hi), 0n);
  const rate = known ?? {
    inputMicroUsdPerMTok: max((p) => p.inputMicroUsdPerMTok),
    cachedInputMicroUsdPerMTok: max((p) => p.cachedInputMicroUsdPerMTok),
    outputMicroUsdPerMTok: max((p) => p.outputMicroUsdPerMTok),
  };
  const total =
    BigInt(t.input) * rate.inputMicroUsdPerMTok +
    BigInt(t.cachedInput) * rate.cachedInputMicroUsdPerMTok +
    BigInt(t.output) * rate.outputMicroUsdPerMTok;
  return { costMicroUsd: (total + PER_MILLION - 1n) / PER_MILLION, priced: Boolean(known) };
}

const reached = (p: Period) => p.spentMicroUsd >= p.capMicroUsd;
const nearing = (p: Period) => p.spentMicroUsd * 100n >= p.capMicroUsd * ECONOMY_THRESHOLD_PCT;

/** A person's state from their own caps: blocked at a cap, economy from 80% of one. */
export function capState(budget: PeriodBudget): BudgetDecision['state'] {
  if (PERIODS.some((k) => reached(budget[k]))) return 'blocked';
  if (PERIODS.some((k) => nearing(budget[k]))) return 'economy';
  return 'allow';
}

/**
 * Which cap, if any, blocks a turn. Names the reached cap that resets last, since that is
 * when chat comes back. `global` is the circuit breaker on everyone's spend for the day.
 */
export function blockingCap(
  budget: PeriodBudget,
  global: { spentMicroUsd: bigint; capMicroUsd: bigint; resetsAt: Date },
): { blockedBy: NonNullable<BudgetDecision['blockedBy']>; resetsAt: Date } | null {
  const blockers: Array<{ blockedBy: NonNullable<BudgetDecision['blockedBy']>; resetsAt: Date }> =
    [];
  for (const key of PERIODS) {
    if (reached(budget[key])) blockers.push({ blockedBy: key, resetsAt: budget[key].resetsAt });
  }
  if (global.spentMicroUsd >= global.capMicroUsd) {
    blockers.push({ blockedBy: 'global', resetsAt: global.resetsAt });
  }
  if (blockers.length === 0) return null;
  return blockers.reduce((a, b) => (b.resetsAt > a.resetsAt ? b : a));
}
