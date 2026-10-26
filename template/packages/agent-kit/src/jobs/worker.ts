import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import { describeError } from '../telemetry/logger.js';
import {
  Defer,
  Fatal,
  type Job,
  type JobHandler,
  type JobStore,
  MAX_JOB_ERROR_CHARS,
  retryDelayMs,
} from './types.js';

export type WorkerOptions = {
  store: JobStore;
  /** One handler per job kind. A job of a kind with no handler is dead at once. */
  handlers: Record<string, JobHandler>;
  logger: Logger;
  workerId?: string;
  /** Jobs run at once by `start`. Default 1. */
  concurrency?: number;
  /** How often `start` looks for work when idle. Default 1 s. */
  pollMs?: number;
  /** A running job whose worker has been silent this long is taken up again. Default 10 min. */
  staleMs?: number;
  now?: () => Date;
  /** Told of every job that ends dead, so what it stood for can be marked failed. */
  onDead?: (job: Job, error: string) => Promise<void>;
};

export type Worker = {
  /** Run one due job, if there is one. */
  runOnce(): Promise<boolean>;
  /** Run jobs until none is due. Returns how many ran. */
  drain(): Promise<number>;
  /** Keep taking jobs until `stop`. */
  start(): void;
  /** Take no more jobs, signal the ones running, and wait for them to return. */
  stop(): Promise<void>;
};

const DEFAULT_STALE_MS = 600_000;
/** The least a deferred job waits. */
export const MIN_DEFER_MS = 1_000;

export function createWorker(opts: WorkerOptions): Worker {
  const { store, handlers, logger } = opts;
  const workerId = opts.workerId ?? `worker-${randomUUID()}`;
  const concurrency = Math.max(1, opts.concurrency ?? 1);
  const pollMs = opts.pollMs ?? 1_000;
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
  const now = opts.now ?? (() => new Date());

  const stopping = new AbortController();
  const active = new Set<Promise<void>>();
  let started = false;
  let timer: NodeJS.Timeout | undefined;
  let filling: Promise<void> | null = null;

  function claim(): Promise<Job | null> {
    const at = now();
    return store.claim(workerId, at, new Date(at.getTime() - staleMs));
  }

  async function bury(job: Job, error: string, log: Logger): Promise<void> {
    // A job another worker has taken is theirs to finish or bury, not ours.
    if (!(await store.fail(job.id, workerId, error, null, now()))) return;
    try {
      await opts.onDead?.(job, error);
    } catch (err) {
      log.error({ err: describeError(err) }, 'could not record a dead job');
    }
  }

  async function run(job: Job): Promise<void> {
    const log = logger.child({ jobId: job.id, jobKind: job.kind, attempt: job.attempts });
    // A job found stale after its last attempt was already used: its worker died each time.
    if (job.attempts > job.maxAttempts) {
      await bury(job, 'the worker stopped before finishing', log);
      log.error('job dead: its worker stopped before finishing, every time');
      return;
    }
    const handler = handlers[job.kind];
    if (!handler) {
      await bury(job, `no handler for job kind "${job.kind}"`, log);
      log.error('job dead: no handler for its kind');
      return;
    }

    // The job's own signal: fires when the worker stops, or when the job stops being ours.
    const mine = new AbortController();
    const onStop = () => mine.abort(stopping.signal.reason);
    if (stopping.signal.aborted) onStop();
    else stopping.signal.addEventListener('abort', onStop, { once: true });
    const heartbeat = setInterval(
      () => {
        store.touch(job.id, workerId, now()).then(
          (held) => {
            if (!held) mine.abort(new Error('the job was taken by another worker'));
          },
          (err) => log.warn({ err: describeError(err) }, 'job heartbeat failed'),
        );
      },
      Math.max(1_000, Math.floor(staleMs / 3)),
    );
    heartbeat.unref();

    try {
      await handler(job, { signal: mine.signal, logger: log });
      await store.complete(job.id, workerId, now());
      log.info('job done');
    } catch (err) {
      if (err instanceof Defer) {
        // Never to a time already past: a handler that keeps saying "not now, but now"
        // would otherwise run without pause and without ever using an attempt.
        const until = new Date(Math.max(err.until.getTime(), now().getTime() + MIN_DEFER_MS));
        await store.defer(job.id, workerId, until);
        log.info({ until: until.toISOString(), reason: err.message }, 'job deferred');
      } else if (stopping.signal.aborted) {
        // Cut short by shutdown, not by a fault of its own: the attempt is not held against it.
        await store.defer(job.id, workerId, now());
        log.info('job put back: the worker is stopping');
      } else {
        const message = (err instanceof Error ? err.message : String(err)).slice(
          0,
          MAX_JOB_ERROR_CHARS,
        );
        const dead = err instanceof Fatal || job.attempts >= job.maxAttempts;
        if (dead) {
          await bury(job, message, log);
        } else {
          const at = now();
          const retryAt = new Date(at.getTime() + retryDelayMs(job.attempts));
          await store.fail(job.id, workerId, message, retryAt, at);
        }
        if (dead) log.error({ err: describeError(err) }, 'job dead');
        else log.warn({ err: describeError(err) }, 'job failed; will retry');
      }
    } finally {
      clearInterval(heartbeat);
      stopping.signal.removeEventListener('abort', onStop);
    }
  }

  function track(job: Job): Promise<void> {
    const running: Promise<void> = run(job)
      .catch((err) => logger.error({ err: describeError(err) }, 'job bookkeeping failed'))
      .finally(() => active.delete(running));
    active.add(running);
    return running;
  }

  async function runOnce(): Promise<boolean> {
    if (stopping.signal.aborted) return false;
    const job = await claim();
    if (!job) return false;
    await track(job);
    return true;
  }

  async function drain(): Promise<number> {
    let ran = 0;
    while (await runOnce()) ran += 1;
    return ran;
  }

  async function fillOnce(): Promise<void> {
    try {
      while (!stopping.signal.aborted && active.size < concurrency) {
        const job = await claim();
        if (!job) break;
        if (stopping.signal.aborted) {
          // Taken in the moment the worker was told to stop: hand it straight back.
          await store.defer(job.id, workerId, now());
          break;
        }
        void track(job).finally(() => fill());
      }
    } catch (err) {
      logger.error({ err: describeError(err) }, 'could not look for jobs');
    }
  }

  function fill(): void {
    if (filling || stopping.signal.aborted) return;
    filling = fillOnce().finally(() => {
      filling = null;
    });
  }

  function start(): void {
    if (started || stopping.signal.aborted) return;
    started = true;
    fill();
    timer = setInterval(fill, pollMs);
    timer.unref();
  }

  async function stop(): Promise<void> {
    if (timer) clearInterval(timer);
    stopping.abort(new Error('the worker is stopping'));
    if (filling) await filling;
    await Promise.allSettled([...active]);
  }

  return { runOnce, drain, start, stop };
}
