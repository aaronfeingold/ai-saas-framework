import pino from 'pino';
import { describe, expect, it } from 'vitest';
import {
  createMemoryJobStore,
  createMemoryWorkflowStore,
  createWorker,
  Defer,
  defineWorkflow,
  failRunOfDeadJob,
  startRun,
  stopRun,
  WORKFLOW_JOB,
  type Workflow,
  workflowHandler,
} from '../src/index.js';
import { workflowStoreCases } from '../src/jobs/contract.js';

const logger = pino({ level: 'silent' });

// biome-ignore lint/suspicious/noExplicitAny: a bench for workflows of any shape
function bench(workflows: Array<Workflow<any, unknown>>) {
  let t = new Date('2026-01-01T00:00:00Z').getTime();
  const now = () => new Date(t);
  const jobs = createMemoryJobStore(now);
  const runs = createMemoryWorkflowStore();
  // A fresh worker each time, as after a restart: nothing is carried over in memory.
  const worker = () =>
    createWorker({
      store: jobs,
      logger,
      now,
      handlers: { [WORKFLOW_JOB]: workflowHandler({ runs, now }, workflows) },
      onDead: failRunOfDeadJob(runs),
    });
  return {
    jobs,
    runs,
    now,
    advance: (ms: number) => {
      t += ms;
    },
    drain: () => worker().drain(),
    deps: { jobs, runs },
  };
}

describe('the in-memory workflow store', () => {
  for (const c of workflowStoreCases) it(c.name, () => c.run(() => createMemoryWorkflowStore()));
});

describe('a run', () => {
  it('runs its steps in order and keeps the result', async () => {
    const order: string[] = [];
    const wfDef = defineWorkflow({
      kind: 'sum',
      run: async (wf, input: { a: number; b: number }) => {
        const x = await wf.step('double-a', async () => {
          order.push('a');
          return input.a * 2;
        });
        const y = await wf.step('double-b', async () => {
          order.push('b');
          return input.b * 2;
        });
        await wf.progress(0.5, 'halfway');
        await wf.addCost(1_200n);
        return { total: x + y };
      },
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, { a: 1, b: 2 });
    expect(run.status).toBe('running');
    await b.drain();
    expect(order).toEqual(['a', 'b']);
    expect(await b.runs.getRun(run.id)).toMatchObject({
      status: 'done',
      result: { total: 6 },
      progress: 1,
      costMicroUsd: 1_200n,
      currentStep: null,
    });
    expect(b.jobs.all()[0]).toMatchObject({ status: 'done', dedupeKey: `run:${run.id}` });
  });

  it('carries on from the step that failed, without repeating the ones before it', async () => {
    const calls = { one: 0, two: 0, three: 0 };
    const wfDef = defineWorkflow({
      kind: 'flaky',
      run: async (wf) => {
        const a = await wf.step('one', async () => {
          calls.one += 1;
          return { n: 1, dropped: undefined };
        });
        await wf.step('two', async () => {
          calls.two += 1;
        });
        const c = await wf.step('three', async () => {
          calls.three += 1;
          if (calls.three === 1) throw new Error('network');
          return 3;
        });
        return { a, c };
      },
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null);
    await b.drain();
    expect(await b.runs.getRun(run.id)).toMatchObject({ status: 'running', error: 'network' });
    expect(b.runs.steps(run.id)).toEqual(['one', 'two']);
    b.advance(30_000);
    await b.drain();
    expect(calls).toEqual({ one: 1, two: 1, three: 2 });
    // What a step returned first time and what it answers from the save are the same.
    expect(await b.runs.getRun(run.id)).toMatchObject({
      status: 'done',
      result: { a: { n: 1 }, c: 3 },
      error: null,
    });
  });

  it('does not use up its attempts while each try gets further than the last', async () => {
    const failedOnce = new Set<number>();
    const wfDef = defineWorkflow({
      kind: 'long',
      run: async (wf) => {
        for (let i = 1; i <= 8; i += 1) {
          await wf.step(`s${i}`, async () => {
            if (i > 1 && !failedOnce.has(i)) {
              failedOnce.add(i);
              throw new Error(`s${i} hiccup`);
            }
            return i;
          });
        }
        return 'finished';
      },
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null, { maxAttempts: 2 });
    for (let i = 0; i < 12 && (await b.runs.getRun(run.id))?.status !== 'done'; i += 1) {
      await b.drain();
      b.advance(30_000);
    }
    // Seven failures, more than its two attempts, each after a step that was new.
    expect(failedOnce.size).toBe(7);
    expect(await b.runs.getRun(run.id)).toMatchObject({ status: 'done', result: 'finished' });
  });

  it('starts no further step once its worker is stopping', async () => {
    const ran: string[] = [];
    const b = bench([]);
    const wfDef = defineWorkflow({
      kind: 'cut',
      run: async (wf) => {
        await wf.step('one', async () => {
          ran.push('one');
          void w.stop();
        });
        await wf.step('two', async () => {
          ran.push('two');
        });
      },
    });
    const worker = () =>
      createWorker({
        store: b.jobs,
        logger,
        now: b.now,
        handlers: { [WORKFLOW_JOB]: workflowHandler({ runs: b.runs, now: b.now }, [wfDef]) },
      });
    const w = worker();
    const run = await startRun(b.deps, wfDef, null);
    await w.drain();
    await w.stop();
    expect(ran).toEqual(['one']);
    expect(b.jobs.all()[0]).toMatchObject({ status: 'queued', attempts: 0 });
    await worker().drain();
    expect(ran).toEqual(['one', 'two']);
    expect((await b.runs.getRun(run.id))?.status).toBe('done');
  });

  it('stops, not waits, when asked to stop during a step that then says not now', async () => {
    const b = bench([]);
    const wfDef = defineWorkflow({
      kind: 'stop-then-wait',
      run: async (wf) =>
        wf.step('gated', async () => {
          await stopRun(b.runs, wf.runId);
          throw new Defer(new Date(b.now().getTime() + 86_400_000));
        }),
    });
    const w = createWorker({
      store: b.jobs,
      logger,
      now: b.now,
      handlers: { [WORKFLOW_JOB]: workflowHandler({ runs: b.runs, now: b.now }, [wfDef]) },
    });
    const run = await startRun(b.deps, wfDef, null);
    await w.drain();
    expect((await b.runs.getRun(run.id))?.status).toBe('stopped');
    expect(b.jobs.all()[0]?.status).toBe('done');
  });

  it('waits when one side-by-side step says not now, though another failed', async () => {
    const wfDef = defineWorkflow({
      kind: 'fan-defer',
      run: async (wf) =>
        wf.all(
          [
            () => wf.step('a', async () => Promise.reject(new Error('a failed'))),
            () =>
              wf.step('b', async () => {
                await new Promise((r) => setTimeout(r, 10));
                throw new Defer(new Date(Date.UTC(2026, 0, 2)));
              }),
          ],
          { concurrency: 2 },
        ),
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null);
    await b.drain();
    expect((await b.runs.getRun(run.id))?.status).toBe('waiting');
    expect(b.jobs.all()[0]).toMatchObject({ status: 'queued', attempts: 0 });
  });

  it('fails when its job runs out of attempts', async () => {
    const wfDef = defineWorkflow({
      kind: 'doomed',
      run: async (wf) => wf.step('never', async () => Promise.reject(new Error('always'))),
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null, { maxAttempts: 2 });
    await b.drain();
    b.advance(30_000);
    await b.drain();
    expect(await b.runs.getRun(run.id)).toMatchObject({ status: 'failed', error: 'always' });
    expect(b.jobs.all()[0]).toMatchObject({ status: 'dead', attempts: 2 });
  });

  it('runs a step again when its name has changed', async () => {
    let calls = 0;
    let name = 'fetch';
    const wfDef = defineWorkflow({
      kind: 'renamed',
      run: async (wf) => {
        await wf.step(name, async () => {
          calls += 1;
        });
        await wf.step('then', async () => {
          if (calls === 1) throw new Error('once');
        });
      },
    });
    const b = bench([wfDef]);
    await startRun(b.deps, wfDef, null);
    await b.drain();
    name = 'fetch-v2';
    b.advance(30_000);
    await b.drain();
    expect(calls).toBe(2);
  });

  it('refuses a step name used twice', async () => {
    const wfDef = defineWorkflow({
      kind: 'twice',
      run: async (wf) => {
        await wf.step('same', async () => 1);
        await wf.step('same', async () => 2);
      },
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null);
    await b.drain();
    expect(await b.runs.getRun(run.id)).toMatchObject({
      status: 'failed',
      error: 'step "same" is used twice in twice',
    });
  });

  it('runs steps side by side within the limit and returns them in order', async () => {
    let running = 0;
    let most = 0;
    const wfDef = defineWorkflow({
      kind: 'fan',
      run: async (wf) =>
        wf.all(
          [5, 4, 3, 2, 1, 0].map(
            (n) => () =>
              wf.step(`n:${n}`, async () => {
                running += 1;
                most = Math.max(most, running);
                await new Promise((r) => setTimeout(r, n * 3));
                running -= 1;
                return n;
              }),
          ),
          { concurrency: 2 },
        ),
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null);
    await b.drain();
    expect(most).toBe(2);
    expect((await b.runs.getRun(run.id))?.result).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it('keeps the side-by-side steps that finished when one of them fails', async () => {
    const calls: Record<string, number> = {};
    const wfDef = defineWorkflow({
      kind: 'fan-fail',
      run: async (wf) =>
        wf.all(
          ['a', 'b', 'c'].map(
            (n) => () =>
              wf.step(n, async () => {
                calls[n] = (calls[n] ?? 0) + 1;
                if (n === 'a' && calls[n] === 1) throw new Error('a failed');
                await new Promise((r) => setTimeout(r, 10));
                return n;
              }),
          ),
          { concurrency: 2 },
        ),
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null);
    await b.drain();
    expect(b.runs.steps(run.id)).toEqual(['b']);
    b.advance(30_000);
    await b.drain();
    expect(calls).toEqual({ a: 2, b: 1, c: 1 });
    expect((await b.runs.getRun(run.id))?.result).toEqual(['a', 'b', 'c']);
  });

  it('sleeps without holding a worker and wakes at the time', async () => {
    const order: string[] = [];
    const wfDef = defineWorkflow({
      kind: 'nap',
      run: async (wf) => {
        await wf.step('before', async () => void order.push('before'));
        await wf.sleep('settle', 600_000);
        await wf.step('after', async () => void order.push('after'));
      },
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null);
    expect(await b.drain()).toBe(1);
    expect((await b.runs.getRun(run.id))?.status).toBe('waiting');
    expect(b.jobs.all()[0]).toMatchObject({ status: 'queued', attempts: 0 });
    expect(b.jobs.all()[0]?.runAt.getTime()).toBe(b.now().getTime() + 600_000);
    b.advance(599_999);
    expect(await b.drain()).toBe(0);
    b.advance(1);
    expect(await b.drain()).toBe(1);
    expect(order).toEqual(['before', 'after']);
    expect((await b.runs.getRun(run.id))?.status).toBe('done');
  });

  it('waits when a step says not now, spending no attempt and keeping earlier steps', async () => {
    let open = false;
    let first = 0;
    const wfDef = defineWorkflow({
      kind: 'ceiling',
      run: async (wf) => {
        await wf.step('paid-for', async () => {
          first += 1;
        });
        return wf.step('gated', async () => {
          if (!open) throw new Defer(new Date(Date.UTC(2026, 0, 2)), 'daily ceiling');
          return 'read';
        });
      },
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null, { maxAttempts: 1 });
    await b.drain();
    expect((await b.runs.getRun(run.id))?.status).toBe('waiting');
    expect(b.jobs.all()[0]).toMatchObject({ status: 'queued', attempts: 0 });
    expect(b.jobs.all()[0]?.runAt.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    open = true;
    b.advance(86_400_000);
    await b.drain();
    expect(first).toBe(1);
    expect(await b.runs.getRun(run.id)).toMatchObject({ status: 'done', result: 'read' });
  });

  it('stops before its next step when asked', async () => {
    const ran: string[] = [];
    const b = bench([]);
    const wfDef = defineWorkflow({
      kind: 'stoppable',
      run: async (wf) => {
        await wf.step('one', async () => {
          ran.push('one');
          await stopRun(b.runs, wf.runId);
        });
        await wf.step('two', async () => void ran.push('two'));
      },
    });
    const w = createWorker({
      store: b.jobs,
      logger,
      now: b.now,
      handlers: { [WORKFLOW_JOB]: workflowHandler({ runs: b.runs, now: b.now }, [wfDef]) },
    });
    const run = await startRun(b.deps, wfDef, null);
    await w.drain();
    expect(ran).toEqual(['one']);
    expect((await b.runs.getRun(run.id))?.status).toBe('stopped');
    expect(b.jobs.all()[0]?.status).toBe('done');
  });

  it('stops a waiting run at once, and its job then does nothing', async () => {
    let after = 0;
    const wfDef = defineWorkflow({
      kind: 'nap-stop',
      run: async (wf) => {
        await wf.sleep('long', 3_600_000);
        await wf.step('after', async () => {
          after += 1;
        });
      },
    });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null);
    await b.drain();
    expect((await stopRun(b.runs, run.id))?.status).toBe('stopped');
    b.advance(3_600_000);
    await b.drain();
    expect(after).toBe(0);
    expect((await b.runs.getRun(run.id))?.status).toBe('stopped');
    expect(await stopRun(b.runs, 'no-such-run')).toBeNull();
  });

  it('fails a run of a kind nobody defined', async () => {
    const ghost = defineWorkflow({ kind: 'ghost', run: async () => null });
    const b = bench([]);
    const run = await startRun(b.deps, ghost, null);
    await b.drain();
    expect(await b.runs.getRun(run.id)).toMatchObject({
      status: 'failed',
      error: 'no workflow of kind "ghost"',
    });
    expect(b.jobs.all()[0]?.status).toBe('dead');
  });

  it('refuses a step output that JSON cannot keep, naming the step', async () => {
    for (const [bad, what] of [
      [10n, 'bigint'],
      [{ when: new Date() }, 'Date'],
      [{ n: Number.NaN }, 'not a finite number'],
      [new Map(), 'Map'],
    ] as const) {
      const wfDef = defineWorkflow({
        kind: 'unsafe',
        run: async (wf) => wf.step('count', async () => bad),
      });
      const b = bench([wfDef]);
      const run = await startRun(b.deps, wfDef, null);
      await b.drain();
      const read = await b.runs.getRun(run.id);
      expect(read?.status).toBe('failed');
      expect(read?.error).toContain('step "count" of unsafe');
      expect(read?.error).toContain(what);
      expect(b.runs.steps(run.id)).toEqual([]);
    }
  });

  it('is marked failed when its job dies with its worker', async () => {
    const wfDef = defineWorkflow({ kind: 'orphan', run: async () => null });
    const b = bench([wfDef]);
    const run = await startRun(b.deps, wfDef, null, { maxAttempts: 1 });
    await b.jobs.claim('gone', b.now(), new Date(0));
    b.advance(600_001);
    await b.drain();
    expect(await b.runs.getRun(run.id)).toMatchObject({
      status: 'failed',
      error: 'the worker stopped before finishing',
    });
  });
});
