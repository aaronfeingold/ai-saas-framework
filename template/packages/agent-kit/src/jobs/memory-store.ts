import { randomUUID } from 'node:crypto';
import { DEFAULT_MAX_ATTEMPTS, type Job, type JobStore, type NewJob, SUPERSEDED } from './types.js';

type Held = Job & { lockedBy: string | null; lockedAt: Date | null; seq: number };

/**
 * Jobs kept in memory: for tests, and for an application that has not chosen a database
 * yet. Follows the same rules as a real store; nothing survives the process.
 */
export function createMemoryJobStore(
  now: () => Date = () => new Date(),
): JobStore & { all(): Job[] } {
  const jobs = new Map<string, Held>();
  let seq = 0;

  const view = ({ lockedBy: _b, lockedAt: _a, seq: _s, ...job }: Held): Job => ({ ...job });
  const mine = (id: string, workerId: string): Held | null => {
    const job = jobs.get(id);
    return job && job.status === 'running' && job.lockedBy === workerId ? job : null;
  };

  // A job going back to the queue while a newer queued job holds its key gives way to it.
  const requeue = (job: Held, runAt: Date): void => {
    job.lockedBy = null;
    job.lockedAt = null;
    const newer =
      job.dedupeKey !== null &&
      [...jobs.values()].some((j) => j.status === 'queued' && j.dedupeKey === job.dedupeKey);
    if (newer) {
      job.status = 'done';
      job.lastError = SUPERSEDED;
      return;
    }
    job.status = 'queued';
    job.runAt = runAt;
  };

  return {
    all: () => [...jobs.values()].sort((a, b) => a.seq - b.seq).map(view),

    async enqueue(input: NewJob) {
      const runAt = input.runAt ?? now();
      if (input.dedupeKey) {
        for (const job of jobs.values()) {
          if (job.status === 'queued' && job.dedupeKey === input.dedupeKey) {
            job.runAt = runAt;
            if (input.payload !== undefined) job.payload = input.payload;
            return view(job);
          }
        }
      }
      seq += 1;
      const job: Held = {
        id: randomUUID(),
        kind: input.kind,
        payload: input.payload ?? null,
        status: 'queued',
        runAt,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        dedupeKey: input.dedupeKey ?? null,
        userId: input.userId ?? null,
        lastError: null,
        lockedBy: null,
        lockedAt: null,
        seq,
      };
      jobs.set(job.id, job);
      return view(job);
    },

    async claim(workerId, at, staleBefore) {
      const due = [...jobs.values()]
        .filter(
          (j) =>
            (j.status === 'queued' && j.runAt <= at) ||
            (j.status === 'running' && j.lockedAt !== null && j.lockedAt < staleBefore),
        )
        .sort((a, b) => a.runAt.getTime() - b.runAt.getTime() || a.seq - b.seq)[0];
      if (!due) return null;
      due.status = 'running';
      due.attempts += 1;
      due.lockedBy = workerId;
      due.lockedAt = at;
      return view(due);
    },

    async touch(id, workerId, at) {
      const job = mine(id, workerId);
      if (!job) return false;
      job.lockedAt = at;
      return true;
    },

    async complete(id, workerId) {
      const job = mine(id, workerId);
      if (!job) return;
      job.status = 'done';
      job.lockedBy = null;
      job.lockedAt = null;
    },

    async fail(id, workerId, error, retryAt) {
      const job = mine(id, workerId);
      if (!job) return false;
      job.lastError = error;
      if (retryAt) {
        requeue(job, retryAt);
      } else {
        job.status = 'dead';
        job.lockedBy = null;
        job.lockedAt = null;
      }
      return true;
    },

    async defer(id, workerId, runAt) {
      const job = mine(id, workerId);
      if (!job) return;
      job.attempts = Math.max(0, job.attempts - 1);
      requeue(job, runAt);
    },
  };
}
