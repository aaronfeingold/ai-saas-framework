import {
  type AgentDefinition,
  type AgentStore,
  type Operation,
  type PromptSource,
  type TurnSettings,
  usdToMicro,
} from '@ai-saas/agent-kit';
import type { Env } from '../config/env.js';
import type { Ctx } from '../lib/ctx.js';
import {
  acquireTurn,
  appendMessage,
  findTurnByClientMessageId,
  getContextWindow,
  releaseTurn,
  updateSummary,
} from '../services/chat-sessions.js';
import { type BudgetLimits, checkBudget, recordUsage } from '../services/usage.js';

/** Names the assistant in tool lists, usage records and traces. */
export const ASSISTANT = 'assistant';

export function turnSettings(env: Env, prompts: PromptSource): TurnSettings {
  return {
    prompts,
    contextTokenBudget: env.CONTEXT_TOKEN_BUDGET,
    maxOutputTokens: env.MAX_OUTPUT_TOKENS,
    maxMessageChars: env.MAX_MESSAGE_CHARS,
    turnTimeoutMs: env.TURN_TIMEOUT_MS,
    summaryModel: env.SUMMARY_MODEL,
    reasoningEffort: env.REASONING_EFFORT,
    recordContent: env.TELEMETRY_RECORD_CONTENT,
    exposeErrorDetail: env.NODE_ENV === 'development',
  };
}

export function budgetLimits(env: Env): BudgetLimits {
  return {
    globalDailyCapMicroUsd: usdToMicro(env.GLOBAL_DAILY_SPEND_CAP_USD),
    userDailyCapMicroUsd: usdToMicro(env.USER_DAILY_SPEND_CAP_USD),
    model: env.MODEL,
    maxSteps: env.MAX_STEPS,
  };
}

function createStore(env: Env): AgentStore<Ctx> {
  const limits = budgetLimits(env);
  return {
    getContextWindow,
    appendMessage,
    updateSummary,
    findTurnByClientMessageId,
    acquireTurn,
    releaseTurn,
    checkBudget: (ctx) => checkBudget(ctx, limits),
    recordUsage,
  };
}

/**
 * The app's assistant. Give it a persona in `prompts/assistant/core.md` and capabilities as
 * operations; add skills for situations that need their own instructions or tools.
 */
export function createAssistant(env: Env, operations: Operation<Ctx>[]): AgentDefinition<Ctx> {
  return {
    id: ASSISTANT,
    operations,
    store: createStore(env),
    corePromptName: 'assistant/core',
    // After the core prompt, so the unchanging part stays cacheable.
    buildContext: async () => [`Today (UTC) is ${new Date().toISOString().slice(0, 10)}.`],
  };
}
