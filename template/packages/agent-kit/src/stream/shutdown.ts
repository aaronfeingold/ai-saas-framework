import type { StreamRegistry } from './registry.js';

type Closable = { close: (callback?: () => void) => unknown };

/**
 * Graceful shutdown: stop accepting connections, then let in-flight replies finish, up to
 * `graceMs`. A deploy should not cut someone off mid-sentence.
 */
export function createShutdown(
  server: Closable,
  streams: StreamRegistry,
  graceMs: number,
): () => Promise<void> {
  return async () => {
    server.close();
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      streams.whenIdle(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, graceMs);
      }),
    ]);
    clearTimeout(timer);
  };
}
