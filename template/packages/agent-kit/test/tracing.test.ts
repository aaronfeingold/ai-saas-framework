import { trace } from '@opentelemetry/api';
import type { tracing } from '@opentelemetry/sdk-node';
import { describe, expect, it } from 'vitest';
import { traceLabels } from '../src/skills.js';
import { startTelemetry } from '../src/telemetry/tracing.js';

describe('tracing start-up', () => {
  it('does nothing when there is nowhere to send spans', async () => {
    const t = await startTelemetry({ exporter: 'none', serviceName: 'test' });
    expect(t.metricReaders).toEqual([]);
    await t.shutdown();
  });

  it('sends spans to an extra processor even when the exporter is none', async () => {
    const ended: string[] = [];
    let shutDown = false;
    const processor: tracing.SpanProcessor = {
      onStart() {},
      onEnd: (span) => void ended.push(span.name),
      forceFlush: async () => {},
      shutdown: async () => {
        shutDown = true;
      },
    };
    const t = await startTelemetry({
      exporter: 'none',
      serviceName: 'test',
      extraSpanProcessors: [processor],
    });
    trace.getTracer('test').startSpan('a-span').end();
    await t.shutdown();
    expect(ended).toContain('a-span');
    expect(shutDown).toBe(true);
    expect(t.metricReaders).toEqual([]);
  });
});

describe('trace labels', () => {
  const prompt = (name: string, version: string) => ({
    name,
    version,
    text: 'x',
    source: 'file' as const,
  });

  it('names the agent, the skills and the exact prompt versions, and asks for each to be included', () => {
    const labels = traceLabels(
      'sommelier',
      prompt('sommelier/core', 'abc'),
      [{ id: 'at-the-table', prompt: prompt('sommelier/skill/at-the-table', '7') }],
      { payer: 'user' },
    );
    expect(labels.runtimeContext).toEqual({
      agent: 'sommelier',
      skills: 'at-the-table',
      prompts: 'sommelier/core@abc,sommelier/skill/at-the-table@7',
      payer: 'user',
    });
    expect(labels.include).toEqual({ agent: true, skills: true, prompts: true, payer: true });
  });
});
