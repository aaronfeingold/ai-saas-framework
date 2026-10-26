import { describe, expect, it } from 'vitest';
import { withKeepAlive } from '../src/stream/keepalive.js';
import { createLimiter } from '../src/stream/limits.js';
import { createStreamRegistry } from '../src/stream/registry.js';
import { createShutdown } from '../src/stream/shutdown.js';

const enc = new TextEncoder();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  let out = '';
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out += decoder.decode(value);
  }
}

describe('withKeepAlive', () => {
  it('sends comment lines while the source is idle and passes data through untouched', async () => {
    const source = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(enc.encode('data: one\n\n'));
        await sleep(130);
        controller.enqueue(enc.encode('data: two\n\n'));
        controller.close();
      },
    });
    const text = await readAll(withKeepAlive(source, 40));
    expect(text.startsWith('data: one\n\n')).toBe(true);
    expect(text.endsWith('data: two\n\n')).toBe(true);
    expect(text.match(/^: keep-alive$/gm)?.length).toBeGreaterThanOrEqual(2);
  });

  it('sends nothing extra when data keeps flowing', async () => {
    const source = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (let i = 0; i < 5; i++) {
          controller.enqueue(enc.encode(`data: ${i}\n\n`));
          await sleep(10);
        }
        controller.close();
      },
    });
    expect(await readAll(withKeepAlive(source, 200))).not.toContain('keep-alive');
  });

  it('stops its timer and cancels the source when the reader cancels', async () => {
    let cancelled = false;
    const source = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const reader = withKeepAlive(source, 20).getReader();
    await reader.read();
    await reader.cancel();
    expect(cancelled).toBe(true);
  });
});

describe('createLimiter', () => {
  it('allows up to the per-minute limit, then says when to retry', () => {
    let now = 0;
    const limiter = createLimiter({ rpm: 2, maxConcurrent: 10, now: () => now });
    const a = limiter.enter('u');
    const b = limiter.enter('u');
    expect([a.ok, b.ok]).toEqual([true, true]);
    if (a.ok) a.leave();
    if (b.ok) b.leave();
    now = 20_000;
    expect(limiter.enter('u')).toEqual({ ok: false, retryAfterSec: 40 });
    now = 60_001;
    expect(limiter.enter('u').ok).toBe(true);
  });

  it('counts concurrent streams per user and frees a slot on leave, once', () => {
    const limiter = createLimiter({ rpm: 100, maxConcurrent: 1, now: () => 0 });
    const first = limiter.enter('u');
    expect(limiter.enter('u').ok).toBe(false);
    expect(limiter.enter('other').ok).toBe(true);
    if (first.ok) {
      first.leave();
      first.leave();
    }
    expect(limiter.enter('u').ok).toBe(true);
    expect(limiter.enter('u').ok).toBe(false);
  });
});

describe('createShutdown', () => {
  const fakeServer = () => {
    const state = { closed: false };
    return {
      state,
      server: {
        close: (cb?: () => void) => {
          state.closed = true;
          cb?.();
        },
      },
    };
  };

  it('stops accepting connections and waits for open streams to finish', async () => {
    const streams = createStreamRegistry();
    const { state, server } = fakeServer();
    streams.open('u:s');
    let finished = false;
    const shutting = createShutdown(server, streams, 5_000)().then(() => {
      finished = true;
    });
    await sleep(30);
    expect(state.closed).toBe(true);
    expect(finished).toBe(false);
    streams.close('u:s');
    await shutting;
    expect(finished).toBe(true);
  });

  it('gives up waiting after the grace period', async () => {
    const streams = createStreamRegistry();
    streams.open('u:s');
    const started = Date.now();
    await createShutdown(fakeServer().server, streams, 60)();
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('resolves at once when nothing is streaming', async () => {
    await expect(
      createShutdown(fakeServer().server, createStreamRegistry(), 5_000)(),
    ).resolves.toBeUndefined();
  });
});
