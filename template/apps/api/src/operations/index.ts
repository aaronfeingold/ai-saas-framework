import { defineOperation, microToUsd, type Operation } from '@ai-saas/agent-kit';
import { z } from 'zod';
import type { Env } from '../config/env.js';
import type { Ctx } from '../lib/ctx.js';
import { createSession, getMessages, MessageSchema } from '../services/chat-sessions.js';
import { spentToday } from '../services/usage.js';

// The one registry: each operation is a REST route, an OpenAPI entry and, when
// `agentTool` is set, a tool the assistant can call. Descriptions are read by the model.
// Add the app's own capabilities here; `get_usage` is the example to copy.

export function createOperations(env: Env): Operation<Ctx>[] {
  return [
    defineOperation({
      id: 'get_usage',
      description:
        'What the signed-in person has spent on the assistant today (UTC), and their daily allowance, in US dollars.',
      method: 'get',
      path: '/api/usage',
      input: z.object({}),
      output: z.object({ spentUsd: z.number(), dailyCapUsd: z.number() }),
      agentTool: true,
      handler: async (ctx: Ctx) => {
        const spent = await spentToday(ctx);
        return { spentUsd: microToUsd(spent.user), dailyCapUsd: env.USER_DAILY_SPEND_CAP_USD };
      },
    }),
    defineOperation({
      id: 'create_chat_session',
      description: 'Start a conversation with the assistant.',
      method: 'post',
      path: '/api/sessions',
      input: z.object({}),
      output: z.object({ id: z.string() }),
      agentTool: false,
      handler: (ctx: Ctx) => createSession(ctx),
    }),
    defineOperation({
      id: 'get_chat_messages',
      description: "A conversation's messages, oldest first.",
      method: 'get',
      path: '/api/sessions/{sessionId}/messages',
      input: z.object({ sessionId: z.string().uuid() }),
      output: z.object({ messages: z.array(MessageSchema) }),
      agentTool: false,
      handler: async (ctx: Ctx, input) => ({ messages: await getMessages(ctx, input.sessionId) }),
    }),
  ];
}
