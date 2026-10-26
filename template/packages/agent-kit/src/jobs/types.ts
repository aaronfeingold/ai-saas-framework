import type { Logger } from 'pino';

// Work that happens after the fact: a queue of jobs, and a worker that takes them one at a
// time. Where the jobs are kept is the application's business (`JobStore`); the rules about
// retrying, waiting and giving up are here.

export type JobStatus = 'queued' | 'running' | 'done' | 'dead';

export type Job = {
  id: string;
  kind: string;
  payload: unknown;
  status: JobStatus;
  runAt: Date;
  /** How many times a worker has taken this job, the current time included. */
  attempts: number;
  maxAttempts: number;
  dedupeKey: string | null;
  userId: string | null;
  lastError: string | null;
};

export type NewJob = {
  kind: string;
  payload?: unknown;
  /** Not before this time. Default: now. */
  runAt?: Date;
  /** Default 5. */
  maxAttempts?: number;
  /**
   * At most one queued job holds a key. Enqueueing with a key a queued job already holds
   * moves that job to the new time and payload instead of adding another.
   */
  dedupeKey?: string;
  userId?: string;
};

export const DEFAULT_MAX_ATTEMPTS = 5;
export const MAX_JOB_ERROR_CHARS = 500;
/** The note left on a job that gave way to a newer queued job holding the same key. */
export const SUPERSEDED = 'superseded by a newer job with the same key';

export interface JobStore {
  enqueue(job: NewJob): Promise<Job>;
  /**
   * The next job due at `now`, or a running one whose worker has not been heard from since
   * `staleBefore`. Marks it running under `workerId` and counts the attempt. Never hands
   * one job to two callers.
   */
  claim(workerId: string, now: Date, staleBefore: Date): Promise<Job | null>;
  /**
   * Says the worker is still on the job. False when the job is no longer this worker's.
   * `complete`, `fail` and `defer` likewise do nothing unless the job is the caller's.
   */
  touch(id: string, workerId: string, now: Date): Promise<boolean>;
  complete(id: string, workerId: string, now: Date): Promise<void>;
  /**
   * `retryAt` null means no attempts are left: the job is dead, and kept. False when the
   * job was not the caller's, and so was not changed.
   */
  fail(
    id: string,
    workerId: string,
    error: string,
    retryAt: Date | null,
    now: Date,
  ): Promise<boolean>;
  /**
   * Back to the queue at `runAt`, without having used an attempt. A job going back to the
   * queue (here or from `fail`) while a newer queued job holds its key is finished instead.
   */
  defer(id: string, workerId: string, runAt: Date): Promise<void>;
}

/** Thrown by a handler to say "not now": the job waits until `until`, and no attempt is spent. */
export class Defer extends Error {
  constructor(
    readonly until: Date,
    reason = 'deferred',
  ) {
    super(reason);
    this.name = 'Defer';
  }
}

/** Thrown by a handler when trying again cannot help: the job is dead at once. */
export class Fatal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Fatal';
  }
}

export type JobContext = {
  /** Fires when the worker is stopping or has lost the job. Pass it to anything slow. */
  signal: AbortSignal;
  logger: Logger;
};

export type JobHandler = (job: Job, ctx: JobContext) => Promise<void>;

const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 3_600_000;

/** How long to wait after a failed attempt: 30 s, 2 min, 8 min, 32 min, then an hour. */
export function retryDelayMs(attempt: number): number {
  const n = Math.max(1, Math.floor(attempt));
  return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 4 ** (n - 1));
}
