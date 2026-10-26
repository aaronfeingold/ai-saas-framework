import { randomUUID } from 'node:crypto';
import {
  Defer,
  Fatal,
  type Job,
  type JobHandler,
  type JobStore,
  MAX_JOB_ERROR_CHARS,
} from './types.js';

// Long work as named steps. Each step's result is saved when it finishes, so a run that is
// stopped (a crash, a deploy, a daily ceiling) carries on from its next step instead of
// starting over. A run is advanced by one job on the queue; its function is called again
// from the top each time, and the steps already finished answer from what was saved.
//
// Two things follow. A step may run more than once (its worker can die after the work and
// before the save), so a step must be safe to repeat. And steps are found by name: rename a
// step and it runs again; code between steps runs on every advance and must not have effects.

export type RunStatus = 'running' | 'waiting' | 'done' | 'failed' | 'stopped';

export type WorkflowRun = {
  id: string;
  kind: string;
  userId: string | null;
  input: unknown;
  status: RunStatus;
  currentStep: string | null;
  /** 0 to 1. */
  progress: number;
  progressLabel: string | null;
  stopRequested: boolean;
  costMicroUsd: bigint;
  result: unknown;
  error: string | null;
};

export type RunPatch = Partial<
  Pick<WorkflowRun, 'status' | 'currentStep' | 'progress' | 'progressLabel' | 'result' | 'error'>
> & { addCostMicroUsd?: bigint };

export interface WorkflowStore {
  createRun(run: { kind: string; input: unknown; userId?: string }): Promise<WorkflowRun>;
  getRun(id: string): Promise<WorkflowRun | null>;
  getStep(runId: string, name: string): Promise<{ output: unknown } | null>;
  /** Saving a step that is already saved keeps the first output. */
  saveStep(runId: string, name: string, output: unknown): Promise<void>;
  updateRun(id: string, patch: RunPatch): Promise<void>;
  requestStop(id: string): Promise<void>;
}

export type Wf = {
  runId: string;
  /** Fires when the worker is stopping. */
  signal: AbortSignal;
  /** Run `fn` once and keep what it returns, which must be plain JSON. */
  step<T>(name: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T>;
  /** Run steps side by side, at most `concurrency` at once (default 3). Results keep their order. */
  all<T>(thunks: Array<() => Promise<T>>, opts?: { concurrency?: number }): Promise<T[]>;
  /** Wait without holding a worker. */
  sleep(name: string, ms: number): Promise<void>;
  progress(fraction: number, label?: string): Promise<void>;
  addCost(microUsd: bigint): Promise<void>;
};

export type Workflow<I, R> = { kind: string; run: (wf: Wf, input: I) => Promise<R> };

export function defineWorkflow<I, R>(def: Workflow<I, R>): Workflow<I, R> {
  return def;
}

export const WORKFLOW_JOB = 'workflow';
/** How long a run waits to try again after failing at a step later than last time. */
export const RETRY_AFTER_PROGRESS_MS = 30_000;

class StopRequested extends Error {}

/** A copy of `value` as JSON would keep it, or an error naming what JSON cannot hold. */
export function toJson(value: unknown, where: string): unknown {
  const check = (v: unknown, path: string): void => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new Fatal(`${where}: ${path} is not a finite number`);
      return;
    }
    if (v === undefined) return;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        check(item, `${path}[${i}]`);
      });
      return;
    }
    if (typeof v === 'object') {
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) {
        throw new Fatal(
          `${where}: ${path} is a ${v.constructor?.name ?? 'non-plain object'}, which JSON cannot keep`,
        );
      }
      for (const [k, item] of Object.entries(v)) check(item, `${path}.${k}`);
      return;
    }
    throw new Fatal(`${where}: ${path} is a ${typeof v}, which JSON cannot keep`);
  };
  check(value, 'output');
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

export async function startRun<I>(
  deps: { jobs: JobStore; runs: WorkflowStore },
  workflow: Workflow<I, unknown>,
  input: I,
  opts: { userId?: string; maxAttempts?: number; runAt?: Date } = {},
): Promise<WorkflowRun> {
  const run = await deps.runs.createRun({
    kind: workflow.kind,
    input: toJson(input, `input of ${workflow.kind}`),
    userId: opts.userId,
  });
  try {
    await deps.jobs.enqueue({
      kind: WORKFLOW_JOB,
      payload: { runId: run.id },
      userId: opts.userId,
      maxAttempts: opts.maxAttempts,
      runAt: opts.runAt,
      dedupeKey: `run:${run.id}`,
    });
  } catch (err) {
    // A run with no job would sit at "running" for ever.
    await deps.runs
      .updateRun(run.id, { status: 'failed', error: 'could not be queued' })
      .catch(() => {});
    throw err;
  }
  return run;
}

/**
 * Ask a run to stop. It stops before its next step; a step under way finishes first. A run
 * that is waiting stops at once.
 */
export async function stopRun(runs: WorkflowStore, id: string): Promise<WorkflowRun | null> {
  const run = await runs.getRun(id);
  if (!run) return null;
  if (run.status === 'done' || run.status === 'failed' || run.status === 'stopped') return run;
  await runs.requestStop(id);
  if (run.status === 'waiting') await runs.updateRun(id, { status: 'stopped' });
  return runs.getRun(id);
}

const FINISHED: ReadonlySet<RunStatus> = new Set(['done', 'failed', 'stopped']);

/** The job handler that advances runs of the given workflows. Register it under `WORKFLOW_JOB`. */
export function workflowHandler(
  deps: { runs: WorkflowStore; now?: () => Date },
  // biome-ignore lint/suspicious/noExplicitAny: workflows of any input and result share one handler
  workflows: Array<Workflow<any, unknown>>,
): JobHandler {
  const { runs } = deps;
  const now = deps.now ?? (() => new Date());
  const byKind = new Map(workflows.map((w) => [w.kind, w]));

  return async (job, ctx) => {
    const runId = (job.payload as { runId?: unknown } | null)?.runId;
    if (typeof runId !== 'string') throw new Fatal('workflow job without a run id');
    const run = await runs.getRun(runId);
    if (!run) throw new Fatal(`run ${runId} does not exist`);
    if (FINISHED.has(run.status)) return;

    const fail = async (message: string): Promise<void> => {
      await runs.updateRun(runId, {
        status: 'failed',
        error: message.slice(0, MAX_JOB_ERROR_CHARS),
      });
    };
    const workflow = byKind.get(run.kind);
    if (!workflow) {
      const message = `no workflow of kind "${run.kind}"`;
      await fail(message);
      throw new Fatal(message);
    }

    const seen = new Set<string>();
    // Steps saved during this advance: a run that is getting somewhere is not using up
    // its attempts.
    let progressed = false;
    const claimName = (name: string): void => {
      if (seen.has(name)) throw new Fatal(`step "${name}" is used twice in ${run.kind}`);
      seen.add(name);
    };
    const checkStop = async (): Promise<void> => {
      // The worker is stopping, or the job is no longer ours: start nothing more.
      if (ctx.signal.aborted) throw ctx.signal.reason ?? new Error('the job was stopped');
      const current = await runs.getRun(runId);
      if (!current || current.stopRequested || current.status === 'stopped') {
        throw new StopRequested();
      }
    };

    const wf: Wf = {
      runId,
      signal: ctx.signal,

      async step(name, fn) {
        claimName(name);
        await checkStop();
        const saved = await runs.getStep(runId, name);
        if (saved) return saved.output as never;
        await runs.updateRun(runId, { currentStep: name });
        const output = toJson(await fn(ctx.signal), `step "${name}" of ${run.kind}`);
        await runs.saveStep(runId, name, output);
        progressed = true;
        // What was saved, which is another worker's output if it saved this step first.
        return ((await runs.getStep(runId, name))?.output ?? output) as never;
      },

      async all(thunks, opts = {}) {
        const limit = Math.max(1, opts.concurrency ?? 3);
        const results = new Array(thunks.length);
        let next = 0;
        const failed: { first: { err: unknown } | null } = { first: null };
        const first = (): { err: unknown } | null => failed.first;
        // Steps under way when one fails are let finish, so their work is saved.
        const lane = async (): Promise<void> => {
          while (!first() && next < thunks.length) {
            const i = next;
            next += 1;
            try {
              results[i] = await (thunks[i] as () => Promise<unknown>)();
            } catch (err) {
              // "Not now" and "stop" outrank an ordinary failure in another lane.
              const outranks = err instanceof Defer || err instanceof StopRequested;
              const earlier = first();
              if (!earlier || (outranks && !(earlier.err instanceof StopRequested))) {
                failed.first = { err };
              }
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(limit, thunks.length) }, lane));
        if (failed.first) throw failed.first.err;
        return results;
      },

      async sleep(name, ms) {
        const key = `sleep:${name}`;
        claimName(key);
        await checkStop();
        const saved = await runs.getStep(runId, key);
        let wakeAt: Date;
        if (saved) {
          wakeAt = new Date((saved.output as { wakeAt: string }).wakeAt);
        } else {
          wakeAt = new Date(now().getTime() + ms);
          await runs.saveStep(runId, key, { wakeAt: wakeAt.toISOString() });
        }
        if (now() < wakeAt) throw new Defer(wakeAt, `sleeping: ${name}`);
      },

      async progress(fraction, label) {
        const progress = Math.min(1, Math.max(0, fraction));
        await runs.updateRun(runId, { progress, progressLabel: label ?? null });
      },

      async addCost(microUsd) {
        if (microUsd > 0n) await runs.updateRun(runId, { addCostMicroUsd: microUsd });
      },
    };

    await runs.updateRun(runId, { status: 'running', error: null });
    try {
      const result = toJson(await workflow.run(wf, run.input), `result of ${run.kind}`);
      await runs.updateRun(runId, { status: 'done', result, progress: 1, currentStep: null });
    } catch (err) {
      if (err instanceof StopRequested) {
        await runs.updateRun(runId, { status: 'stopped' });
        return;
      }
      if (err instanceof Defer) {
        // Asked to stop while the step that is now waiting was under way.
        if ((await runs.getRun(runId))?.stopRequested) {
          await runs.updateRun(runId, { status: 'stopped' });
          return;
        }
        await runs.updateRun(runId, { status: 'waiting' });
        throw err;
      }
      // Cut short by the worker stopping: the queue puts the job back, and the run carries on.
      if (ctx.signal.aborted) throw err;
      const message = err instanceof Error ? err.message : String(err);
      if (progressed && !(err instanceof Fatal)) {
        // It got further than last time, so this failure is not held against it: try
        // again shortly with every attempt still in hand. Only failures with nothing
        // gained in between count towards giving up.
        await runs.updateRun(runId, { error: message.slice(0, MAX_JOB_ERROR_CHARS) });
        throw new Defer(new Date(now().getTime() + RETRY_AFTER_PROGRESS_MS), message);
      }
      if (err instanceof Fatal || job.attempts >= job.maxAttempts) await fail(message);
      else await runs.updateRun(runId, { error: message.slice(0, MAX_JOB_ERROR_CHARS) });
      throw err;
    }
  };
}

/**
 * For the worker's `onDead`: a run whose job died without the run's handler seeing it (its
 * worker was killed each time) is marked failed, so it does not sit at "running" for ever.
 */
export function failRunOfDeadJob(runs: WorkflowStore) {
  return async (job: Job, error: string): Promise<void> => {
    if (job.kind !== WORKFLOW_JOB) return;
    const runId = (job.payload as { runId?: unknown } | null)?.runId;
    if (typeof runId !== 'string') return;
    const run = await runs.getRun(runId);
    if (run && !FINISHED.has(run.status)) await runs.updateRun(runId, { status: 'failed', error });
  };
}

/** Runs and their steps kept in memory, for tests. */
export function createMemoryWorkflowStore(): WorkflowStore & { steps(runId: string): string[] } {
  const runs = new Map<string, WorkflowRun>();
  const steps = new Map<string, Map<string, unknown>>();
  return {
    steps: (runId) => [...(steps.get(runId)?.keys() ?? [])],
    async createRun(input) {
      const run: WorkflowRun = {
        id: randomUUID(),
        kind: input.kind,
        userId: input.userId ?? null,
        input: input.input,
        status: 'running',
        currentStep: null,
        progress: 0,
        progressLabel: null,
        stopRequested: false,
        costMicroUsd: 0n,
        result: null,
        error: null,
      };
      runs.set(run.id, run);
      steps.set(run.id, new Map());
      return { ...run };
    },
    async getRun(id) {
      const run = runs.get(id);
      return run ? { ...run } : null;
    },
    async getStep(runId, name) {
      const saved = steps.get(runId);
      return saved?.has(name) ? { output: structuredClone(saved.get(name)) } : null;
    },
    async saveStep(runId, name, output) {
      const saved = steps.get(runId);
      if (saved && !saved.has(name)) saved.set(name, structuredClone(output));
    },
    async updateRun(id, { addCostMicroUsd, ...patch }) {
      const run = runs.get(id);
      if (!run) return;
      Object.assign(run, patch);
      if (addCostMicroUsd) run.costMicroUsd += addCostMicroUsd;
    },
    async requestStop(id) {
      const run = runs.get(id);
      if (run) run.stopRequested = true;
    },
  };
}
