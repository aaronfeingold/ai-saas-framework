import { PrometheusExporter, PrometheusSerializer } from '@opentelemetry/exporter-prometheus';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider, type MetricReader } from '@opentelemetry/sdk-metrics';

export type TurnOutcomeLabel = 'complete' | 'stopped' | 'failed' | 'dropped';

/** Everything the app measures. Passed in explicitly so each app instance owns its numbers. */
export type Metrics = {
  httpRequest: (route: string, status: number, ms: number) => void;
  chatFirstEvent: (ms: number) => void;
  chatFirstToken: (ms: number) => void;
  chatTurn: (outcome: TurnOutcomeLabel, ms: number) => void;
  toolCall: (tool: string, failed: boolean) => void;
  modelUsage: (
    model: string,
    tokens: { input: number; cachedInput: number; output: number },
    costMicroUsd: bigint,
  ) => void;
  budgetState: (state: 'allow' | 'economy' | 'blocked') => void;
  memoryDegraded: () => void;
  /** Current values in Prometheus text format. */
  render: () => Promise<string>;
  shutdown: () => Promise<void>;
};

/**
 * Metrics are recorded through the OpenTelemetry metrics API. A Prometheus reader always
 * backs `render()`; `extraReaders` add push exporters (OTLP, Cloud Monitoring).
 */
export function createMetrics(extraReaders: MetricReader[] = [], serviceName = 'agent'): Metrics {
  const prometheus = new PrometheusExporter({ preventServerStart: true });
  const provider = new MeterProvider({
    resource: resourceFromAttributes({ 'service.name': serviceName }),
    readers: [prometheus, ...extraReaders],
  });
  const meter = provider.getMeter('agent-kit');
  const serializer = new PrometheusSerializer();

  // Counter names omit "_total": the Prometheus exporter appends it.
  const httpRequests = meter.createCounter('http_requests');
  const httpDuration = meter.createHistogram('http_request_duration_ms');
  const firstEvent = meter.createHistogram('chat_time_to_first_event_ms');
  const firstToken = meter.createHistogram('chat_time_to_first_token_ms');
  const turnDuration = meter.createHistogram('chat_turn_duration_ms');
  const turns = meter.createCounter('chat_turns');
  const toolCalls = meter.createCounter('tool_calls');
  const toolErrors = meter.createCounter('tool_errors');
  const tokens = meter.createCounter('model_tokens');
  const cost = meter.createCounter('model_cost_micro_usd');
  const budget = meter.createCounter('budget_state');
  const degraded = meter.createCounter('memory_degraded');

  return {
    httpRequest(route, status, ms) {
      const labels = { route, status: String(status) };
      httpRequests.add(1, labels);
      httpDuration.record(ms, labels);
    },
    chatFirstEvent: (ms) => firstEvent.record(ms),
    chatFirstToken: (ms) => firstToken.record(ms),
    chatTurn(outcome, ms) {
      turns.add(1, { outcome });
      turnDuration.record(ms, { outcome });
    },
    toolCall(tool, failed) {
      toolCalls.add(1, { tool });
      if (failed) toolErrors.add(1, { tool });
    },
    modelUsage(model, t, costMicroUsd) {
      tokens.add(t.input, { model, kind: 'input' });
      tokens.add(t.cachedInput, { model, kind: 'cached_input' });
      tokens.add(t.output, { model, kind: 'output' });
      cost.add(Number(costMicroUsd), { model });
    },
    budgetState: (state) => budget.add(1, { state }),
    memoryDegraded: () => degraded.add(1),
    async render() {
      const { resourceMetrics } = await prometheus.collect();
      return serializer.serialize(resourceMetrics);
    },
    shutdown: () => provider.shutdown(),
  };
}
