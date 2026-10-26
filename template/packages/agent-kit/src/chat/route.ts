import { createUIMessageStreamResponse, type UIMessageChunk } from 'ai';
import type { Hono } from 'hono';
import { z } from 'zod';
import { AppError, badRequest, conflict } from '../errors.js';
import { withKeepAlive } from '../stream/keepalive.js';
import type { Limiter } from '../stream/limits.js';
import { type StreamRegistry, streamKey } from '../stream/registry.js';
import { runTurn, type TurnDeps } from '../turn/run-turn.js';
import type { BaseCtx, BudgetDecision, KitEnv } from '../types.js';

export type ChatDeps<C extends BaseCtx> = TurnDeps<C> & {
  streams: StreamRegistry;
  limiter: Limiter;
  /** Idle time before a keep-alive comment is sent. */
  keepAliveMs: number;
};

export const ChatBodySchema = z.object({
  sessionId: z.string().min(1),
  /** Chosen by the client; resending the same id never creates a second turn. */
  messageId: z.string().min(1).max(100),
  text: z.string(),
});

const GENERIC_ERROR = 'Something went wrong. Please try again.';

const tooMany = (
  code: string,
  message: string,
  retryAfterSec: number,
  extra: Record<string, unknown> = {},
) =>
  new Response(JSON.stringify({ error: { code, message, ...extra } }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'retry-after': String(retryAfterSec) },
  });

/**
 * Mount `POST /api/chat` (streaming) and `POST /api/chat/:sessionId/stop` for an agent.
 * The app must already have middleware that authenticates the request and sets `ctx`.
 */
export function chatRoutes<C extends BaseCtx>(app: Hono<KitEnv<C>>, deps: ChatDeps<C>): void {
  const { settings } = deps;
  const { store } = deps.agent;

  app.post('/api/chat', async (c) => {
    const ctx = c.get('ctx');
    const startedAt = performance.now();
    const { metrics } = deps;

    // 1. Shape and size, before anything is stored or spent.
    const parsed = ChatBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw badRequest('Expected { sessionId, messageId, text }');
    const { sessionId, messageId } = parsed.data;
    const text = parsed.data.text.trim();
    if (!text) throw badRequest('text must not be empty');
    if (parsed.data.text.length > settings.maxMessageChars) {
      throw new AppError(
        'message_too_large',
        413,
        `Messages are limited to ${settings.maxMessageChars} characters`,
      );
    }

    // 2. A retry of a turn that already finished gets the stored reply, not a new turn.
    //    (Also the ownership check: someone else's session is 404 here.)
    const existing = await store.findTurnByClientMessageId(ctx, sessionId, messageId);
    if (existing?.assistant) return c.json({ replay: true, assistant: existing.assistant });

    // 3. Rate and concurrency limits.
    const slot = deps.limiter.enter(ctx.userId);
    if (!slot.ok) {
      return tooMany('rate_limited', 'Too many requests; slow down a little', slot.retryAfterSec);
    }

    const lockedAt = new Date();
    let budget: BudgetDecision;
    try {
      // 4. Spend caps.
      budget = await store.checkBudget(ctx);
      metrics?.budgetState(budget.state);
      if (budget.state === 'blocked') {
        slot.leave();
        const resetsAt = budget.resetsAt ?? new Date();
        return tooMany(
          'budget_exceeded',
          'You have reached your usage limit for now',
          Math.max(1, Math.ceil((resetsAt.getTime() - Date.now()) / 1000)),
          { blockedBy: budget.blockedBy, resetsAt: resetsAt.toISOString() },
        );
      }
      // 5. One turn at a time per session.
      if (!(await store.acquireTurn(ctx, sessionId, lockedAt))) {
        throw conflict('turn_in_progress', 'A reply is already in progress in this session');
      }
    } catch (err) {
      slot.leave();
      throw err;
    }

    // From here the session is locked: every path must reach `finish`.
    const key = streamKey(ctx.userId, sessionId);
    const abort = deps.streams.open(key);
    let finished = false;
    const finish = async () => {
      if (finished) return;
      finished = true;
      deps.streams.close(key, abort);
      slot.leave();
      await store
        .releaseTurn(ctx, sessionId, lockedAt)
        .catch((err) => ctx.logger.error({ err, sessionId }, 'could not release turn lock'));
    };

    let clientGone = false;
    let outcome: 'complete' | 'stopped' | 'failed' = 'failed';
    const chunks = new ReadableStream<UIMessageChunk>({
      start(controller) {
        const send = (chunk: UIMessageChunk) => {
          if (clientGone) return;
          try {
            controller.enqueue(chunk);
          } catch {
            clientGone = true;
          }
        };
        // 6. Acknowledge at once, before any storage or model work.
        send({
          type: 'data-status',
          data: { state: 'thinking', budget: budget.state },
          transient: true,
        });
        metrics?.chatFirstEvent(performance.now() - startedAt);

        void (async () => {
          try {
            if (!existing) {
              await store.appendMessage(ctx, sessionId, {
                role: 'user',
                parts: [{ type: 'text', text }],
                clientMessageId: messageId,
              });
            }
            const turn = await runTurn(deps, ctx, {
              sessionId,
              budget,
              abortSignal: abort.signal,
              onDone: async (result) => {
                outcome = result.status;
                await finish();
              },
            });
            // Read to the end even if the client has gone: the turn finishes regardless.
            const reader = turn.stream.getReader();
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              send(value);
            }
          } catch (err) {
            ctx.logger.error({ err, sessionId }, 'chat turn could not start');
            send({ type: 'error', errorText: GENERIC_ERROR });
          } finally {
            await finish();
            const durationMs = Math.round(performance.now() - startedAt);
            // A reply nobody was connected to receive is "dropped": stored, but unseen.
            const label = outcome === 'complete' && clientGone ? 'dropped' : outcome;
            metrics?.chatTurn(label, durationMs);
            ctx.logger.info(
              { sessionId, status: outcome, clientGone, budget: budget.state, durationMs },
              'chat turn finished',
            );
            if (!clientGone) {
              try {
                controller.close();
              } catch {
                // Cancelled while finishing.
              }
            }
          }
        })();
      },
      cancel() {
        // A dropped connection is not a stop: only the stop endpoint cancels the model.
        clientGone = true;
      },
    });

    const response = createUIMessageStreamResponse({ stream: chunks });
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('cache-control', 'no-cache, no-transform');
    responseHeaders.set('x-accel-buffering', 'no');
    return new Response(
      withKeepAlive(response.body as ReadableStream<Uint8Array>, deps.keepAliveMs),
      { status: 200, headers: responseHeaders },
    );
  });

  // 8. Explicit stop: cancels the model call; the partial reply is stored as stopped.
  app.post('/api/chat/:sessionId/stop', (c) => {
    const stopped = deps.streams.abort(streamKey(c.get('ctx').userId, c.req.param('sessionId')));
    return c.json({ stopped });
  });
}
