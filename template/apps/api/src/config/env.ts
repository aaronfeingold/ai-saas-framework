import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8787),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1),
  /** Origins allowed to call the API from a browser, comma separated. */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  /**
   * The Supabase project that signs in-app users. The web app sends the user's access token
   * as a bearer token; it is checked against the project's published signing keys.
   */
  SUPABASE_URL: z.string().url().optional(),
  /** Only for projects still on the legacy shared secret (HS256) instead of signing keys. */
  SUPABASE_JWT_SECRET: z.string().min(32).optional(),

  /** Without a key for MODEL's provider the API still serves operations; only chat needs it. */
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  /** `provider:model-id`; priced in app.model_prices. */
  MODEL: z.string().default('anthropic:claude-haiku-5-5'),
  SUMMARY_MODEL: z.string().default('anthropic:claude-haiku-5-5'),
  /** For reasoning models: how hard to think. */
  REASONING_EFFORT: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
  /** Hard ceiling on model spend across every user, per UTC day. */
  GLOBAL_DAILY_SPEND_CAP_USD: z.coerce.number().positive().default(5),
  /** Each user's share of that, per UTC day. */
  USER_DAILY_SPEND_CAP_USD: z.coerce.number().positive().default(0.5),
  MAX_STEPS: z.coerce.number().int().positive().default(8),
  CONTEXT_TOKEN_BUDGET: z.coerce.number().int().positive().default(8000),
  MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(2000),
  MAX_MESSAGE_CHARS: z.coerce.number().int().positive().default(4000),
  TURN_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  /** Chat requests per minute per user, and turns at once per user. */
  CHAT_RPM_PER_USER: z.coerce.number().int().positive().default(20),
  CHAT_CONCURRENT_PER_USER: z.coerce.number().int().positive().default(2),
  /** Chat sessions idle for longer than this are deleted; 720 hours is 30 days. */
  SESSION_RETENTION_HOURS: z.coerce.number().positive().default(720),

  TELEMETRY_EXPORTER: z.enum(['none', 'otlp']).default('none'),
  TELEMETRY_RECORD_CONTENT: bool,
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n  ${problems.join('\n  ')}`);
  }
  return parsed.data;
}
