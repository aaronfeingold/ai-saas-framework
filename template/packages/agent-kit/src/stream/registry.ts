/**
 * The turns currently streaming in this process, each with the controller that stops it.
 * Used by the stop endpoint and by graceful shutdown.
 */
export type StreamRegistry = {
  open: (key: string) => AbortController;
  /** Remove the entry. Given a controller, only if it is still the one registered. */
  close: (key: string, owner?: AbortController) => void;
  /** Abort the turn under `key`. False when there is none. */
  abort: (key: string) => boolean;
  size: () => number;
  /** Resolves when no turn is streaming. */
  whenIdle: () => Promise<void>;
};

export const streamKey = (userId: string, sessionId: string) => `${userId}:${sessionId}`;

export function createStreamRegistry(): StreamRegistry {
  const open = new Map<string, AbortController>();
  let waiters: Array<() => void> = [];

  return {
    open(key) {
      const controller = new AbortController();
      open.set(key, controller);
      return controller;
    },
    close(key, owner) {
      if (owner && open.get(key) !== owner) return;
      open.delete(key);
      if (open.size === 0) {
        for (const resolve of waiters) resolve();
        waiters = [];
      }
    },
    abort(key) {
      const controller = open.get(key);
      controller?.abort();
      return Boolean(controller);
    },
    size: () => open.size,
    whenIdle: () =>
      open.size === 0 ? Promise.resolve() : new Promise((resolve) => waiters.push(resolve)),
  };
}
