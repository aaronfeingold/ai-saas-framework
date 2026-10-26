import assert from 'node:assert/strict';
import { type JobStore, SUPERSEDED } from './types.js';
import type { WorkflowStore } from './workflow.js';

// What every store must do, as cases a test file can run against its own implementation:
//   for (const c of jobStoreCases) it(c.name, () => c.run(makeStore));
// The kit runs them against its in-memory stores; an application runs them against its
// database, so the two cannot drift apart.

export type StoreCase<S> = { name: string; run: (make: () => Promise<S> | S) => Promise<void> };

const T0 = new Date('2026-01-01T00:00:00Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1_000);
const NEVER_STALE = new Date(0);

export const jobStoreCases: Array<StoreCase<JobStore>> = [
  {
    name: 'hands out a due job once, and not one that is not due yet',
    async run(make) {
      const store = await make();
      const soon = await store.enqueue({ kind: 'a', payload: { n: 1 }, runAt: at(0) });
      await store.enqueue({ kind: 'a', runAt: at(60) });
      const first = await store.claim('w1', at(1), NEVER_STALE);
      assert.equal(first?.id, soon.id);
      assert.equal(first?.status, 'running');
      assert.equal(first?.attempts, 1);
      assert.deepEqual(first?.payload, { n: 1 });
      assert.equal(await store.claim('w2', at(1), NEVER_STALE), null);
    },
  },
  {
    name: 'hands out the job due earliest first',
    async run(make) {
      const store = await make();
      await store.enqueue({ kind: 'late', runAt: at(5) });
      await store.enqueue({ kind: 'early', runAt: at(1) });
      assert.equal((await store.claim('w', at(10), NEVER_STALE))?.kind, 'early');
      assert.equal((await store.claim('w', at(10), NEVER_STALE))?.kind, 'late');
    },
  },
  {
    name: 'a failed job waits for its retry time and keeps its error',
    async run(make) {
      const store = await make();
      await store.enqueue({ kind: 'a', runAt: at(0) });
      const job = await store.claim('w', at(0), NEVER_STALE);
      assert.ok(job);
      await store.fail(job.id, 'w', 'boom', at(30), at(0));
      assert.equal(await store.claim('w', at(29), NEVER_STALE), null);
      const again = await store.claim('w', at(30), NEVER_STALE);
      assert.equal(again?.id, job.id);
      assert.equal(again?.attempts, 2);
      assert.equal(again?.lastError, 'boom');
    },
  },
  {
    name: 'a job failed with no retry time is dead and is not handed out again',
    async run(make) {
      const store = await make();
      await store.enqueue({ kind: 'a', runAt: at(0) });
      const job = await store.claim('w', at(0), NEVER_STALE);
      assert.ok(job);
      await store.fail(job.id, 'w', 'gone', null, at(0));
      assert.equal(await store.claim('w', at(9_999), at(9_000)), null);
    },
  },
  {
    name: 'a deferred job goes back without having used an attempt',
    async run(make) {
      const store = await make();
      await store.enqueue({ kind: 'a', runAt: at(0) });
      const job = await store.claim('w', at(0), NEVER_STALE);
      assert.ok(job);
      await store.defer(job.id, 'w', at(100));
      assert.equal(await store.claim('w', at(99), NEVER_STALE), null);
      assert.equal((await store.claim('w', at(100), NEVER_STALE))?.attempts, 1);
    },
  },
  {
    name: 'a finished job is not handed out again',
    async run(make) {
      const store = await make();
      await store.enqueue({ kind: 'a', runAt: at(0) });
      const job = await store.claim('w', at(0), NEVER_STALE);
      assert.ok(job);
      await store.complete(job.id, 'w', at(1));
      assert.equal(await store.claim('w', at(9_999), at(9_000)), null);
    },
  },
  {
    name: 'a running job whose worker went silent is taken up by another',
    async run(make) {
      const store = await make();
      await store.enqueue({ kind: 'a', runAt: at(0) });
      const job = await store.claim('w1', at(0), NEVER_STALE);
      assert.ok(job);
      assert.equal(await store.claim('w2', at(500), at(-100)), null);
      const taken = await store.claim('w2', at(700), at(100));
      assert.equal(taken?.id, job.id);
      assert.equal(taken?.attempts, 2);
    },
  },
  {
    name: 'a heartbeat keeps a job from being taken, and says when the job is lost',
    async run(make) {
      const store = await make();
      await store.enqueue({ kind: 'a', runAt: at(0) });
      const job = await store.claim('w1', at(0), NEVER_STALE);
      assert.ok(job);
      assert.equal(await store.touch(job.id, 'w1', at(500)), true);
      assert.equal(await store.claim('w2', at(700), at(100)), null);
      await store.claim('w2', at(2_000), at(1_000));
      assert.equal(await store.touch(job.id, 'w1', at(2_001)), false);
    },
  },
  {
    name: 'a worker that lost a job cannot finish, fail or defer it',
    async run(make) {
      const store = await make();
      await store.enqueue({ kind: 'a', runAt: at(0) });
      const job = await store.claim('w1', at(0), NEVER_STALE);
      assert.ok(job);
      await store.claim('w2', at(700), at(100));
      await store.complete(job.id, 'w1', at(701));
      await store.fail(job.id, 'w1', 'late', null, at(701));
      await store.defer(job.id, 'w1', at(701));
      // Still w2's: it can be touched by w2 and is not on offer.
      assert.equal(await store.touch(job.id, 'w2', at(702)), true);
      assert.equal(await store.claim('w3', at(703), NEVER_STALE), null);
    },
  },
  {
    name: 'enqueueing with a key a queued job holds moves that job instead of adding one',
    async run(make) {
      const store = await make();
      const first = await store.enqueue({
        kind: 'a',
        dedupeKey: 'k',
        runAt: at(10),
        payload: { v: 1 },
      });
      for (let i = 2; i <= 10; i += 1) {
        const same = await store.enqueue({
          kind: 'a',
          dedupeKey: 'k',
          runAt: at(10 * i),
          payload: { v: i },
        });
        assert.equal(same.id, first.id);
      }
      assert.equal(await store.claim('w', at(99), NEVER_STALE), null);
      const job = await store.claim('w', at(100), NEVER_STALE);
      assert.equal(job?.id, first.id);
      assert.deepEqual(job?.payload, { v: 10 });
      assert.equal(await store.claim('w', at(9_999), NEVER_STALE), null);
    },
  },
  {
    name: 'a key is free again once its job is running or finished',
    async run(make) {
      const store = await make();
      const first = await store.enqueue({ kind: 'a', dedupeKey: 'k', runAt: at(0) });
      const running = await store.claim('w', at(0), NEVER_STALE);
      assert.ok(running);
      const second = await store.enqueue({ kind: 'a', dedupeKey: 'k', runAt: at(5) });
      assert.notEqual(second.id, first.id);
      await store.complete(first.id, 'w', at(1));
      assert.equal((await store.claim('w', at(5), NEVER_STALE))?.id, second.id);
    },
  },
  {
    name: 'a job going back to the queue gives way to a newer queued job with its key',
    async run(make) {
      const store = await make();
      const first = await store.enqueue({ kind: 'a', dedupeKey: 'k', runAt: at(0) });
      await store.claim('w', at(0), NEVER_STALE);
      const second = await store.enqueue({ kind: 'a', dedupeKey: 'k', runAt: at(5) });
      await store.fail(first.id, 'w', 'boom', at(30), at(1));
      const next = await store.claim('w', at(100), NEVER_STALE);
      assert.equal(next?.id, second.id);
      assert.equal(await store.claim('w', at(100), NEVER_STALE), null);
      assert.ok(SUPERSEDED.length > 0);
    },
  },
  {
    name: 'keeps the user and the attempt limit it was given',
    async run(make) {
      const store = await make();
      const made = await store.enqueue({ kind: 'a', runAt: at(0), maxAttempts: 2 });
      assert.equal(made.maxAttempts, 2);
      assert.equal(made.userId, null);
      assert.equal(made.status, 'queued');
      assert.equal(made.attempts, 0);
      assert.equal((await store.enqueue({ kind: 'b', runAt: at(1) })).maxAttempts, 5);
    },
  },
];

export const workflowStoreCases: Array<StoreCase<WorkflowStore>> = [
  {
    name: 'a new run starts running, with nothing done',
    async run(make) {
      const store = await make();
      const run = await store.createRun({ kind: 'k', input: { a: [1, 'two', null] } });
      const read = await store.getRun(run.id);
      assert.equal(read?.kind, 'k');
      assert.equal(read?.status, 'running');
      assert.equal(read?.progress, 0);
      assert.equal(read?.stopRequested, false);
      assert.equal(read?.costMicroUsd, 0n);
      assert.equal(read?.userId, null);
      assert.deepEqual(read?.input, { a: [1, 'two', null] });
      assert.equal(await store.getRun('00000000-0000-4000-8000-000000000000'), null);
    },
  },
  {
    name: 'a saved step is read back, and saving it again keeps the first output',
    async run(make) {
      const store = await make();
      const run = await store.createRun({ kind: 'k', input: null });
      assert.equal(await store.getStep(run.id, 'one'), null);
      await store.saveStep(run.id, 'one', { items: [{ n: 1 }], note: null });
      await store.saveStep(run.id, 'one', { items: [] });
      await store.saveStep(run.id, 'nothing', null);
      assert.deepEqual(await store.getStep(run.id, 'one'), {
        output: { items: [{ n: 1 }], note: null },
      });
      assert.deepEqual(await store.getStep(run.id, 'nothing'), { output: null });
    },
  },
  {
    name: 'steps belong to their run',
    async run(make) {
      const store = await make();
      const a = await store.createRun({ kind: 'k', input: null });
      const b = await store.createRun({ kind: 'k', input: null });
      await store.saveStep(a.id, 'one', 1);
      assert.equal(await store.getStep(b.id, 'one'), null);
    },
  },
  {
    name: 'updates change only what they name, and cost adds up',
    async run(make) {
      const store = await make();
      const run = await store.createRun({ kind: 'k', input: null });
      await store.updateRun(run.id, { currentStep: 's', progress: 0.5, progressLabel: 'half' });
      await store.updateRun(run.id, { addCostMicroUsd: 1_500n });
      await store.updateRun(run.id, { addCostMicroUsd: 500n, status: 'waiting' });
      const read = await store.getRun(run.id);
      assert.equal(read?.status, 'waiting');
      assert.equal(read?.currentStep, 's');
      assert.equal(read?.progress, 0.5);
      assert.equal(read?.progressLabel, 'half');
      assert.equal(read?.costMicroUsd, 2_000n);
      await store.updateRun(run.id, { status: 'done', result: { ok: true }, error: null });
      assert.deepEqual((await store.getRun(run.id))?.result, { ok: true });
    },
  },
  {
    name: 'a stop request is remembered',
    async run(make) {
      const store = await make();
      const run = await store.createRun({ kind: 'k', input: null });
      await store.requestStop(run.id);
      assert.equal((await store.getRun(run.id))?.stopRequested, true);
    },
  },
];
