import type { Logger } from 'pino';
import type { Operation } from './operations/define.js';
import type { PromptSource } from './prompts.js';
import type { Skill } from './skills.js';

/** The least a per-request context must carry. An application's own context extends this. */
export type BaseCtx = {
  userId: string;
  logger: Logger;
  /** Set by the turn runner for instructions and tool calls: the chat they belong to. */
  sessionId?: string;
  /** Set to 1 for tools called by a sub-agent, which may not start another. */
  agentDepth?: number;
  /**
   * Set for tool calls: fires when the turn or run they belong to is stopped or runs out of
   * time. A handler that waits on something slow (a fetch, another agent) should pass it on.
   */
  abortSignal?: AbortSignal;
  /** Facts about this turn, set by the agent's `beforeTurn`, for its skills to read. */
  signals?: Record<string, unknown>;
};

/** Hono environment for an app whose auth middleware sets `ctx`. */
export type KitEnv<C extends BaseCtx> = { Variables: { ctx: C } };

export type MessageStatus = 'complete' | 'stopped' | 'failed';

export type StoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  /** AI SDK UI message parts. */
  parts: unknown[];
  status: MessageStatus;
  clientMessageId: string | null;
  createdAt: string;
};

export type NewMessage = {
  role: 'user' | 'assistant';
  parts: unknown[];
  clientMessageId?: string;
  status?: MessageStatus;
};

export type ContextWindow = {
  /** Rolling summary of everything older than `recent` and `overflow`. */
  summary: string | null;
  /** Newest messages that fit the token budget; sent to the model verbatim. */
  recent: StoredMessage[];
  /** Older unsummarised messages that did not fit; folded into the summary after the reply. */
  overflow: StoredMessage[];
};

export type StoredTurn = { user: StoredMessage; assistant?: StoredMessage };

/** `input` counts uncached input tokens only; `cachedInput` counts cache reads. */
export type TokenUsage = { input: number; cachedInput: number; output: number };

export type UsageRecord = {
  sessionId: string | null;
  model: string;
  /** `agent` is a sub-agent or batch run; `vision` is reading an image. */
  purpose: 'chat' | 'summary' | 'vision' | 'agent';
  /** Which agent or step made the call: `sommelier`, `research`, `step/read-photo`. */
  agent: string;
  /** Whose allowance pays: the person's, or a shared budget for work that benefits everyone. */
  payer: 'user' | 'library';
  tokens: TokenUsage;
};

export type BudgetDecision = {
  state: 'allow' | 'economy' | 'blocked';
  /** `provider:model-id` to use for this turn. */
  model: string;
  maxSteps: number;
  blockedBy?: 'day' | 'week' | 'month' | 'global';
  resetsAt?: Date;
};

/**
 * Everything the kit needs from storage and spend control. The kit never touches a database:
 * an application implements this over whatever it stores conversations and usage in.
 * Every method must scope its work to `ctx.userId`.
 */
export interface AgentStore<C extends BaseCtx> {
  getContextWindow(ctx: C, sessionId: string, tokenBudget: number): Promise<ContextWindow>;
  appendMessage(ctx: C, sessionId: string, message: NewMessage): Promise<StoredMessage>;
  updateSummary(
    ctx: C,
    sessionId: string,
    summary: string,
    throughMessageId: string,
  ): Promise<void>;
  /** Must reject (404-style) when the session is not the caller's. */
  findTurnByClientMessageId(
    ctx: C,
    sessionId: string,
    clientMessageId: string,
  ): Promise<StoredTurn | null>;
  /** Claim the session for one turn. False means another turn is running. */
  acquireTurn(ctx: C, sessionId: string, at: Date): Promise<boolean>;
  /** Release only the claim taken at `at`. */
  releaseTurn(ctx: C, sessionId: string, at: Date): Promise<void>;

  /** Decide, before a turn, whether it may run and on which model. */
  checkBudget(ctx: C): Promise<BudgetDecision>;
  recordUsage(ctx: C, usage: UsageRecord): Promise<{ costMicroUsd: bigint }>;
}

/** What an agent's `beforeTurn` decided about a turn. Every field is optional. */
export type TurnGate = {
  /** Answer the turn with this text. The model is not called and nothing is spent. */
  reply?: string;
  /** Lines added to this turn's instructions, after the context sections. */
  instructions?: string[];
  /** Facts about this turn for skills to read, placed on `ctx.signals`. */
  signals?: Record<string, unknown>;
  /** Overrides `settings.maxOutputTokens` for this turn. */
  maxOutputTokens?: number;
};

/** Where to end a reply that should go no further, and what to say in place of the rest. */
export type ReplyCut = { cutAt: number; append: string };

/**
 * Text from this index on is not yet known to be fine: keep it from the person until the
 * guard has seen more. It is released when a later verdict moves past it or the part ends.
 */
export type ReplyHold = { holdFrom: number };

/** What a reply guard says about the reply so far: end it, hold some back, or carry on. */
export type ReplyVerdict = ReplyCut | ReplyHold | null;

/** What happened in a turn, for an agent's `afterTurn`. */
export type TurnReport = {
  sessionId: string;
  status: MessageStatus;
  /** The reply's text as stored. */
  replyText: string;
  /** The output of every tool that ran this turn. */
  toolOutputs: unknown[];
  /** The turn was answered by `beforeTurn`; the model was not called. */
  gated: boolean;
  /** The reply was cut short by `replyGuard`. */
  cut: boolean;
};

/** An agent: what it can do, where it keeps things, and how it is told to behave. */
export type AgentDefinition<C extends BaseCtx> = {
  /** Names the agent in tool lists, usage records and traces. */
  id: string;
  /** Operations flagged `agentTool`, and open to this agent, become the model's tools. */
  operations: Operation<C>[];
  store: AgentStore<C>;
  /**
   * The prompt that never varies: who the agent is and how it behaves. It is sent first so
   * provider prompt caching applies.
   */
  corePromptName: string;
  /** Situations that add instructions and switch on tools. Order here is order in the prompt. */
  skills?: Skill<C>[];
  /**
   * Sections placed after the core prompt and skills: what is known about the person, and
   * so on. Call `onMemoryUnavailable` when long-term memory could not be read.
   */
  buildContext?(ctx: C, hooks: { onMemoryUnavailable: () => void }): Promise<string[]>;
  /**
   * Runs before the model is called, with the conversation so far (the last message is the
   * person's). It may answer the turn itself, or add to it. If it throws, the turn goes
   * ahead as though it had returned nothing.
   */
  beforeTurn?(ctx: C, turn: { sessionId: string; recent: StoredMessage[] }): Promise<TurnGate>;
  /**
   * A second gate that runs *while* the model is already starting, for a check too slow to
   * wait for on every turn. The model is started at once on the assumption that this will
   * add nothing; none of its reply is shown and none of its tools run until this resolves.
   * If it returns a reply, the model call is dropped and the reply is used. If what it adds
   * changes the instructions, skills or output limit, the call is dropped and made again.
   * Otherwise the call already under way becomes the turn, and no time was lost.
   *
   * Put anything fast and likely to answer the turn outright in `beforeTurn`; a dropped
   * call still costs what the provider was sent.
   */
  whileStarting?(ctx: C, turn: { sessionId: string; recent: StoredMessage[] }): Promise<TurnGate>;
  /**
   * Called with the whole reply so far each time more text arrives, before any of the new
   * text is shown; `final` is true when the current piece of text has ended. Separate
   * pieces of text (before and after a tool call, say) are joined with a blank line.
   *
   * Returning a cut stops the model, ends the reply at `cutAt` and puts `append` in place of
   * the rest. Returning a hold keeps the text from `holdFrom` back until the guard has seen
   * more. Text the guard has let through cannot be recalled, so hold whatever might still
   * turn out to need cutting.
   */
  replyGuard?(text: string, final: boolean): ReplyVerdict;
  /** Runs once the reply is stored. It cannot fail the turn. */
  afterTurn?(ctx: C, report: TurnReport): Promise<void>;
  /** Names the prompt that overrides the general-purpose conversation summary prompt. */
  summaryPromptName?: string;
};

/** Per-deployment limits. The kit reads no environment variables itself. */
export type TurnSettings = {
  /** Where every prompt is read from. */
  prompts: PromptSource;
  contextTokenBudget: number;
  maxOutputTokens: number;
  maxMessageChars: number;
  /** A whole turn, all steps included, is abandoned and stored as failed after this long. */
  turnTimeoutMs: number;
  /** `provider:model-id` used to summarise long conversations. */
  summaryModel: string;
  /** When set, asks the model to reason at this effort and stream a summary of it. */
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  /** Attach prompts and replies to trace spans. Leave false outside debugging. */
  recordContent: boolean;
  /**
   * Send the model provider's own error message to the client instead of a generic one.
   * For local development only: provider messages are written for the operator, not the user.
   */
  exposeErrorDetail?: boolean;
};
