const WINDOW_MS = 60_000;
/** How long to suggest waiting when the limit hit is "too many streams at once". */
const CONCURRENCY_RETRY_SEC = 5;

export type Slot = { ok: true; leave: () => void } | { ok: false; retryAfterSec: number };

export type Limiter = { enter: (userId: string) => Slot };

/**
 * Per-user request rate and concurrent-stream limits, held in memory. With several
 * instances each keeps its own counts, so these are approximate guards against runaway
 * clients; spend caps, which are exact, live in Postgres.
 */
export function createLimiter(opts: {
  rpm: number;
  maxConcurrent: number;
  now?: () => number;
}): Limiter {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();
  const active = new Map<string, number>();

  return {
    enter(userId) {
      const t = now();
      const recent = (hits.get(userId) ?? []).filter((at) => t - at < WINDOW_MS);
      hits.set(userId, recent);

      const oldest = recent[0];
      if (recent.length >= opts.rpm && oldest !== undefined) {
        return {
          ok: false,
          retryAfterSec: Math.max(1, Math.ceil((oldest + WINDOW_MS - t) / 1000)),
        };
      }
      const running = active.get(userId) ?? 0;
      if (running >= opts.maxConcurrent) return { ok: false, retryAfterSec: CONCURRENCY_RETRY_SEC };

      recent.push(t);
      active.set(userId, running + 1);
      let left = false;
      return {
        ok: true,
        leave: () => {
          if (left) return;
          left = true;
          const count = (active.get(userId) ?? 1) - 1;
          if (count <= 0) active.delete(userId);
          else active.set(userId, count);
        },
      };
    },
  };
}
