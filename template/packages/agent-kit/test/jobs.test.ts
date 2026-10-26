import pino from 'pino';
import { describe, expect, it } from 'vitest';
import {
  createMemoryJobStore,
  createWorker,
  Defer,
  Fatal,
  type Job,
  type JobHandler,
  retryDelayMs,
} from '../src/index.js';
import { jobStoreCases } from '../src/jobs/contract.js';

const logger = pino({ level: 'silent' });
const T0 = new Date('2026-01-01T00:00:00Z');

function clock() {
  let t = T0.getTime();
  return {
    now: () => new Date(t),
    advance: (ms: number) => {
      t += ms;
    },
  };
}

function setup(
  handlers: Record<string, JobHandler>,
  extra: { onDead?: (j: Job, e: string) => Promise<void> } = {},
) {
  const time = clock();
  const store = createMemoryJobStore(time.now);
  const worker = createWorker({ store, handlers, logger, now: time.now, workerId: 'w', ...extra });
  return { time, store, worker };
}

describe('the in-memory job store', () => {
  for (const c of jobStoreCases) it(c.name, () => c.run(() => createMemoryJobStore()));
});

describe('retry delays', () => {
  it('grow fourfold from 30 seconds and stop at an hour', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(retryDelayMs)).toEqual([
      30_000, 120_000, 480_000, 1_920_000, 3_600_000, 3_600_000, 3_600_000,
    ]);
  });
});

describe('the worker', () => {
  it('runs a due job and leaves one that is not due', async () => {
    const ran: unknown[] = [];
    const { store, worker, time } = setup({ a: async (job) => void ran.push(job.payload) });
    await store.enqueue({ kind: 'a', payload: 1 });
    await store.enqueue({ kind: 'a', payload: 2, runAt: new Date(time.now().getTime() + 60_000) });
    expect(await worker.drain()).toBe(1);
    expect(ran).toEqual([1]);
    expect(store.all().map((j) => j.status)).toEqual(['done', 'queued']);
  });

  it('retries a failing job after 30 s, 2 min, 8 min and 32 min, then leaves it dead', async () => {
    let calls = 0;
    const dead: string[] = [];
    const { store, worker, time } = setup(
      {
        a: async () => {
          calls += 1;
          throw new Error(`x${'y'.repeat(600)}`);
        },
      },
      { onDead: async (job, error) => void dead.push(`${job.kind}:${error.length}`) },
    );
    await store.enqueue({ kind: 'a' });
    for (const wait of [30_000, 120_000, 480_000, 1_920_000]) {
      expect(await worker.drain()).toBe(1);
      const job = store.all()[0] as Job;
      expect(job.status).toBe('queued');
      expect(job.runAt.getTime() - time.now().getTime()).toBe(wait);
      time.advance(wait - 1);
      expect(await worker.drain()).toBe(0);
      time.advance(1);
    }
    expect(await worker.drain()).toBe(1);
    const job = store.all()[0] as Job;
    expect(job.status).toBe('dead');
    expect(job.attempts).toBe(5);
    expect(job.lastError).toHaveLength(500);
    expect(calls).toBe(5);
    expect(dead).toEqual(['a:500']);
    time.advance(86_400_000);
    expect(await worker.drain()).toBe(0);
  });

  it('puts a deferred job back at the time asked, with no attempt used', async () => {
    const time0 = T0.getTime();
    let calls = 0;
    const { store, worker, time } = setup({
      a: async () => {
        calls += 1;
        if (calls <= 8) throw new Defer(new Date(time0 + calls * 1_000), 'not yet');
      },
    });
    await store.enqueue({ kind: 'a', maxAttempts: 2 });
    for (let i = 0; i < 8; i += 1) {
      expect(await worker.drain()).toBe(1);
      expect(store.all()[0]).toMatchObject({ status: 'queued', attempts: 0 });
      time.advance(1_000);
    }
    expect(await worker.drain()).toBe(1);
    expect(store.all()[0]).toMatchObject({ status: 'done', attempts: 1 });
  });

  it('makes a job that says "not now" for a time already past wait a second all the same', async () => {
    let calls = 0;
    const { store, worker, time } = setup({
      a: async () => {
        calls += 1;
        throw new Defer(new Date(0));
      },
    });
    await store.enqueue({ kind: 'a' });
    expect(await worker.drain()).toBe(1);
    expect(calls).toBe(1);
    expect(store.all()[0]?.runAt.getTime()).toBe(time.now().getTime() + 1_000);
  });

  it('gives up at once on a kind it has no handler for, and on a fatal error', async () => {
    let calls = 0;
    const { store, worker } = setup({
      a: async () => {
        calls += 1;
        throw new Fatal('cannot ever work');
      },
    });
    await store.enqueue({ kind: 'mystery' });
    await store.enqueue({ kind: 'a' });
    await worker.drain();
    expect(store.all().map((j) => [j.status, j.lastError])).toEqual([
      ['dead', 'no handler for job kind "mystery"'],
      ['dead', 'cannot ever work'],
    ]);
    expect(calls).toBe(1);
  });

  it('takes up a job whose worker went silent, and gives up when that keeps happening', async () => {
    const time = clock();
    const store = createMemoryJobStore(time.now);
    await store.enqueue({ kind: 'a', maxAttempts: 2 });
    // Two workers take it and die without a word.
    await store.claim('gone-1', time.now(), new Date(0));
    time.advance(600_001);
    await store.claim('gone-2', time.now(), new Date(time.now().getTime() - 600_000));
    time.advance(600_001);
    let calls = 0;
    const worker = createWorker({
      store,
      logger,
      now: time.now,
      handlers: {
        a: async () => {
          calls += 1;
        },
      },
    });
    expect(await worker.drain()).toBe(1);
    expect(calls).toBe(0);
    expect(store.all()[0]).toMatchObject({
      status: 'dead',
      lastError: 'the worker stopped before finishing',
    });
  });

  it('runs jobs that jobs enqueue', async () => {
    const ran: string[] = [];
    const store = createMemoryJobStore();
    const handlers: Record<string, JobHandler> = {
      first: async () => {
        ran.push('first');
        await store.enqueue({ kind: 'second' });
      },
      second: async () => void ran.push('second'),
    };
    const w = createWorker({ store, handlers, logger });
    await store.enqueue({ kind: 'first' });
    expect(await w.drain()).toBe(2);
    expect(ran).toEqual(['first', 'second']);
  });

  it('on stop, signals the running job, waits for it, and puts it back unharmed', async () => {
    const store = createMemoryJobStore();
    let sawAbort = false;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const worker = createWorker({
      store,
      logger,
      pollMs: 5,
      handlers: {
        slow: (_job, { signal }) =>
          new Promise<void>((_resolve, reject) => {
            entered();
            signal.addEventListener('abort', () => {
              sawAbort = true;
              setTimeout(() => reject(new Error('aborted')), 20);
            });
          }),
      },
    });
    await store.enqueue({ kind: 'slow' });
    worker.start();
    await started;
    await worker.stop();
    expect(sawAbort).toBe(true);
    expect(store.all()[0]).toMatchObject({ status: 'queued', attempts: 0, lastError: null });
    // A stopped worker takes nothing more.
    expect(await worker.runOnce()).toBe(false);
  });

  it('never runs more at once than its concurrency', async () => {
    const store = createMemoryJobStore();
    let running = 0;
    let most = 0;
    let done = 0;
    const worker = createWorker({
      store,
      logger,
      concurrency: 2,
      pollMs: 5,
      handlers: {
        a: async () => {
          running += 1;
          most = Math.max(most, running);
          await new Promise((r) => setTimeout(r, 15));
          running -= 1;
          done += 1;
        },
      },
    });
    for (let i = 0; i < 7; i += 1) await store.enqueue({ kind: 'a' });
    worker.start();
    await expect.poll(() => done, { timeout: 5_000 }).toBe(7);
    await worker.stop();
    expect(most).toBe(2);
    expect(store.all().every((j) => j.status === 'done')).toBe(true);
  });

  it('stops a job whose lock another worker has taken', async () => {
    const time = clock();
    const store = createMemoryJobStore(time.now);
    let reason = '';
    let buried = 0;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const worker = createWorker({
      store,
      logger,
      now: time.now,
      workerId: 'slow',
      staleMs: 3_000,
      onDead: async () => {
        buried += 1;
      },
      handlers: {
        a: (_job, { signal }) =>
          new Promise<void>((_resolve, reject) => {
            entered();
            signal.addEventListener('abort', () => {
              reason = String(signal.reason);
              reject(new Fatal('lost'));
            });
          }),
      },
    });
    await store.enqueue({ kind: 'a' });
    const running = worker.runOnce();
    await started;
    time.advance(10_000);
    const stolen = await store.claim('thief', time.now(), new Date(time.now().getTime() - 3_000));
    expect(stolen).not.toBeNull();
    await running;
    expect(reason).toContain('taken by another worker');
    // Nor was it reported dead: it is the other worker's to finish.
    expect(buried).toBe(0);
    // The slow worker's failure did not touch the job it no longer holds.
    expect(store.all()[0]).toMatchObject({ status: 'running', attempts: 2, lastError: null });
  });
});
