import {
  type ContextWindow,
  conflict,
  estimateTokens,
  type NewMessage,
  notFound,
  type StoredMessage,
  type StoredTurn,
} from '@ai-saas/agent-kit';
import { z } from 'zod';
import type { Ctx } from '../lib/ctx.js';

// Conversations with the assistant, stored so a turn has context and a retried message is
// not answered twice. Every query is scoped to the caller's user id (ctx.userId).

/** A turn lock older than this was left behind by a crashed process. */
const STALE_TURN_MS = 15 * 60 * 1000;
const UNIQUE_VIOLATION = '23505';

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  parts: z.array(z.unknown()),
  status: z.enum(['complete', 'stopped', 'failed']),
  clientMessageId: z.string().nullable(),
  createdAt: z.string(),
});

type MessageRow = {
  id: string;
  seq: string;
  role: string;
  parts: unknown;
  status: string;
  client_message_id: string | null;
  created_at: Date;
};

type SessionRow = {
  id: string;
  summary: string | null;
  summarized_through_message_id: string | null;
};

const toStored = (m: MessageRow): StoredMessage => ({
  id: m.id,
  // Text columns; the values are only ever what this service wrote.
  role: m.role as StoredMessage['role'],
  parts: Array.isArray(m.parts) ? m.parts : [],
  status: m.status as StoredMessage['status'],
  clientMessageId: m.client_message_id,
  createdAt: m.created_at.toISOString(),
});

const MESSAGE_COLUMNS = 'id, seq, role, parts, status, client_message_id, created_at';

/** The caller's own session; anyone else's looks missing. */
async function ownSession(ctx: Ctx, sessionId: string): Promise<SessionRow> {
  if (!z.string().uuid().safeParse(sessionId).success) throw notFound('Session');
  const { rows } = await ctx.db.query<SessionRow>(
    'SELECT id, summary, summarized_through_message_id FROM app.chat_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, ctx.userId],
  );
  const row = rows[0];
  if (!row) throw notFound('Session');
  return row;
}

export async function createSession(ctx: Ctx): Promise<{ id: string }> {
  const { rows } = await ctx.db.query<{ id: string }>(
    'INSERT INTO app.chat_sessions (user_id) VALUES ($1) RETURNING id',
    [ctx.userId],
  );
  return { id: (rows[0] as { id: string }).id };
}

export async function getMessages(ctx: Ctx, sessionId: string): Promise<StoredMessage[]> {
  await ownSession(ctx, sessionId);
  const { rows } = await ctx.db.query<MessageRow>(
    `SELECT ${MESSAGE_COLUMNS} FROM app.chat_messages WHERE session_id = $1 ORDER BY seq`,
    [sessionId],
  );
  return rows.map(toStored);
}

export async function appendMessage(
  ctx: Ctx,
  sessionId: string,
  msg: NewMessage,
): Promise<StoredMessage> {
  await ownSession(ctx, sessionId);
  try {
    const { rows } = await ctx.db.query<MessageRow>(
      `INSERT INTO app.chat_messages (session_id, role, parts, status, client_message_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${MESSAGE_COLUMNS}`,
      [
        sessionId,
        msg.role,
        JSON.stringify(msg.parts),
        msg.status ?? 'complete',
        msg.clientMessageId ?? null,
      ],
    );
    await ctx.db.query('UPDATE app.chat_sessions SET updated_at = now() WHERE id = $1', [
      sessionId,
    ]);
    return toStored(rows[0] as MessageRow);
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw conflict('duplicate_message', 'A message with this id already exists in the session');
    }
    throw err;
  }
}

/** The user message a client id refers to, and the reply that followed it, if any. */
export async function findTurnByClientMessageId(
  ctx: Ctx,
  sessionId: string,
  clientMessageId: string,
): Promise<StoredTurn | null> {
  await ownSession(ctx, sessionId);
  const user = (
    await ctx.db.query<MessageRow>(
      `SELECT ${MESSAGE_COLUMNS} FROM app.chat_messages WHERE session_id = $1 AND client_message_id = $2`,
      [sessionId, clientMessageId],
    )
  ).rows[0];
  if (!user) return null;
  const next = (
    await ctx.db.query<MessageRow>(
      `SELECT ${MESSAGE_COLUMNS} FROM app.chat_messages
       WHERE session_id = $1 AND seq > $2 ORDER BY seq LIMIT 1`,
      [sessionId, user.seq],
    )
  ).rows[0];
  return {
    user: toStored(user),
    assistant: next?.role === 'assistant' ? toStored(next) : undefined,
  };
}

/** Claim the session for one turn. False means another turn is running. */
export async function acquireTurn(ctx: Ctx, sessionId: string, at: Date): Promise<boolean> {
  await ownSession(ctx, sessionId);
  const { rowCount } = await ctx.db.query(
    `UPDATE app.chat_sessions SET active_turn_started_at = $3
     WHERE id = $1 AND user_id = $2
       AND (active_turn_started_at IS NULL OR active_turn_started_at < $4)`,
    [sessionId, ctx.userId, at, new Date(at.getTime() - STALE_TURN_MS)],
  );
  return rowCount === 1;
}

/** Release only the claim taken at `at`, so a late turn cannot free its replacement's. */
export async function releaseTurn(ctx: Ctx, sessionId: string, at: Date): Promise<void> {
  await ctx.db.query(
    `UPDATE app.chat_sessions SET active_turn_started_at = NULL
     WHERE id = $1 AND user_id = $2 AND active_turn_started_at = $3`,
    [sessionId, ctx.userId, at],
  );
}

/**
 * The rolling summary, the newest messages that fit `tokenBudget` (never empty when there
 * are messages), and older unsummarised ones that did not fit, for the summariser.
 */
export async function getContextWindow(
  ctx: Ctx,
  sessionId: string,
  tokenBudget: number,
): Promise<ContextWindow> {
  const session = await ownSession(ctx, sessionId);
  const { rows } = await ctx.db.query<MessageRow>(
    `SELECT ${MESSAGE_COLUMNS} FROM app.chat_messages m
     WHERE m.session_id = $1 AND m.seq > COALESCE(
       (SELECT seq FROM app.chat_messages WHERE id = $2), 0)
     ORDER BY m.seq`,
    [sessionId, session.summarized_through_message_id],
  );
  let used = 0;
  let firstRecent = rows.length;
  for (let i = rows.length - 1; i >= 0; i--) {
    used += estimateTokens(JSON.stringify(rows[i]?.parts ?? []));
    if (used > tokenBudget && i < rows.length - 1) break;
    firstRecent = i;
  }
  return {
    summary: session.summary,
    recent: rows.slice(firstRecent).map(toStored),
    overflow: rows.slice(0, firstRecent).map(toStored),
  };
}

export async function updateSummary(
  ctx: Ctx,
  sessionId: string,
  summary: string,
  throughMessageId: string,
): Promise<void> {
  await ownSession(ctx, sessionId);
  await ctx.db.query(
    'UPDATE app.chat_sessions SET summary = $2, summarized_through_message_id = $3 WHERE id = $1',
    [sessionId, summary, throughMessageId],
  );
}

/** Delete sessions, and with them their messages, idle for longer than `hours`. */
export async function purgeOldSessions(db: Ctx['db'], hours: number): Promise<number> {
  const { rowCount } = await db.query(
    'DELETE FROM app.chat_sessions WHERE updated_at < now() - make_interval(hours => $1::int)',
    [Math.ceil(hours)],
  );
  return rowCount ?? 0;
}
