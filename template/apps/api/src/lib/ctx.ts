import type { BaseCtx } from '@ai-saas/agent-kit';
import type { Pool } from 'pg';

/**
 * Per-request context. `userId` is the Supabase user id from the verified access token; it
 * scopes chat sessions and spend.
 */
export type Ctx = BaseCtx & {
  db: Pool;
};
