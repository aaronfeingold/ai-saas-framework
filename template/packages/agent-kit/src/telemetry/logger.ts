import { isSpanContextValid, trace } from '@opentelemetry/api';
import pino, { type DestinationStream, type Logger } from 'pino';

// Cloud Logging reads `severity` and `message`; pino's defaults are `level` and `msg`.
const SEVERITY: Record<string, string> = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
};

const SECRET_KEYS = [
  'authorization',
  'password',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'NEO4J_PASSWORD',
  'DATABASE_URL',
];
// Each key at the top level and up to two levels down (e.g. req.headers.authorization).
const REDACT_PATHS = SECRET_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]);

/**
 * What gets logged for an error: its type, message, stack and a few safe scalars.
 *
 * Provider and SDK errors carry the request they were sending and the response they got
 * (`requestBodyValues`, `responseBody`, `text`, `response`), which for this application means
 * users' messages and photos. pino's default serialiser copies every property, so errors are
 * described explicitly instead.
 */
export function describeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { message: String(err) };
  const e = err as Error & { code?: unknown; statusCode?: unknown; finishReason?: unknown };
  const scalar = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? v : undefined);
  return {
    type: e.name,
    message: e.message,
    stack: e.stack,
    code: scalar(e.code),
    statusCode: scalar(e.statusCode),
    finishReason: scalar(e.finishReason),
    cause: e.cause instanceof Error ? e.cause.message : undefined,
  };
}

/**
 * JSON logs to stdout. Every line carries the active trace and span ids so a log entry can
 * be opened next to its trace. Callers log ids and outcomes, never message content.
 */
export function createLogger(
  opts: { level?: string; destination?: DestinationStream } = {},
): Logger {
  return pino(
    {
      level: opts.level ?? 'info',
      messageKey: 'message',
      base: undefined,
      formatters: { level: (label) => ({ severity: SEVERITY[label] ?? 'DEFAULT' }) },
      mixin() {
        const span = trace.getActiveSpan()?.spanContext();
        return span && isSpanContextValid(span) ? { trace: span.traceId, spanId: span.spanId } : {};
      },
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      serializers: { err: describeError },
    },
    opts.destination,
  );
}
