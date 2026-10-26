import {
  type BudgetDecision,
  costOf,
  type ModelRate,
  nextUtcDayStart,
  type UsageRecord,
  utcDayStart,
} from '@ai-saas/agent-kit';
import type { Ctx } from '../lib/ctx.js';

// Spend control: each signed-in user has a daily cap, and a global daily cap bounds what
// everyone together can spend. Per-plan caps (from Stripe) go here when plans exist.

export type BudgetLimits = {
  globalDailyCapMicroUsd: bigint;
  userDailyCapMicroUsd: bigint;
  model: string;
  maxSteps: number;
};

async function rates(ctx: Ctx): Promise<ModelRate[]> {
  const { rows } = await ctx.db.query<{
    model: string;
    input_micro_usd_per_mtok: string;
    cached_input_micro_usd_per_mtok: string;
    output_micro_usd_per_mtok: string;
  }>('SELECT * FROM app.model_prices');
  return rows.map((r) => ({
    model: r.model,
    inputMicroUsdPerMTok: BigInt(r.input_micro_usd_per_mtok),
    cachedInputMicroUsdPerMTok: BigInt(r.cached_input_micro_usd_per_mtok),
    outputMicroUsdPerMTok: BigInt(r.output_micro_usd_per_mtok),
  }));
}

export async function recordUsage(ctx: Ctx, usage: UsageRecord): Promise<{ costMicroUsd: bigint }> {
  const { costMicroUsd, priced } = costOf(await rates(ctx), usage.model, usage.tokens);
  if (!priced) {
    ctx.logger.error(
      { model: usage.model },
      'no app.model_prices row for this model; charged at the highest known price',
    );
  }
  await ctx.db.query(
    `INSERT INTO app.model_usage (user_id, session_id, model, purpose, agent,
       input_tokens, cached_input_tokens, output_tokens, cost_micro_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      ctx.userId,
      usage.sessionId,
      usage.model,
      usage.purpose,
      usage.agent,
      usage.tokens.input,
      usage.tokens.cachedInput,
      usage.tokens.output,
      costMicroUsd.toString(),
    ],
  );
  return { costMicroUsd };
}

/** Today's (UTC) spend: everyone's, and the caller's. */
export async function spentToday(
  ctx: Ctx,
  now = new Date(),
): Promise<{ everyone: bigint; user: bigint }> {
  const { rows } = await ctx.db.query<{ everyone: string; user_spend: string }>(
    `SELECT COALESCE(sum(cost_micro_usd), 0) AS everyone,
       COALESCE(sum(cost_micro_usd) FILTER (WHERE user_id = $2), 0) AS user_spend
     FROM app.model_usage WHERE created_at >= $1`,
    [utcDayStart(now), ctx.userId],
  );
  const row = rows[0] ?? { everyone: '0', user_spend: '0' };
  return { everyone: BigInt(row.everyone), user: BigInt(row.user_spend) };
}

export async function checkBudget(
  ctx: Ctx,
  limits: BudgetLimits,
  now = new Date(),
): Promise<BudgetDecision> {
  const spent = await spentToday(ctx, now);
  const base = { model: limits.model, maxSteps: limits.maxSteps };
  const resetsAt = nextUtcDayStart(now);
  if (spent.everyone >= limits.globalDailyCapMicroUsd) {
    return { ...base, state: 'blocked', blockedBy: 'global', resetsAt };
  }
  if (spent.user >= limits.userDailyCapMicroUsd) {
    return { ...base, state: 'blocked', blockedBy: 'day', resetsAt };
  }
  return { ...base, state: 'allow' };
}
