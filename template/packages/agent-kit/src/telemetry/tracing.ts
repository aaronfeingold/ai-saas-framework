import { OpenTelemetry } from '@ai-sdk/otel';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { type MetricReader, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK, tracing } from '@opentelemetry/sdk-node';
import { registerTelemetry } from 'ai';

export type Telemetry = {
  /** Push exporters for metrics, to hand to `createMetrics`. */
  metricReaders: MetricReader[];
  shutdown: () => Promise<void>;
};

const METRIC_EXPORT_INTERVAL_MS = 60_000;

export type TelemetryOptions = {
  exporter: 'none' | 'otlp';
  serviceName: string;
  /** Auto-instrumentations for the libraries the application uses (HTTP, its ORM, ...). */
  instrumentations?: NonNullable<ConstructorParameters<typeof NodeSDK>[0]>['instrumentations'];
  /**
   * Further places to send spans, beside the exporter: a prompt and trace service, say.
   * With these set, tracing starts even when `exporter` is `none`.
   */
  extraSpanProcessors?: tracing.SpanProcessor[];
};

/**
 * Start tracing. Must run before the libraries being instrumented are loaded, so an
 * application calls this first and imports the rest of itself afterwards.
 *
 * - `none`: no exporter; spans are recorded only if `extraSpanProcessors` are given.
 * - `otlp`: traces and metrics to the endpoint in the standard OTEL_EXPORTER_OTLP_* variables.
 */
export async function startTelemetry(opts: TelemetryOptions): Promise<Telemetry> {
  const extra = opts.extraSpanProcessors ?? [];
  if (opts.exporter === 'none' && extra.length === 0) {
    return { metricReaders: [], shutdown: async () => {} };
  }

  const spanProcessors: tracing.SpanProcessor[] = [...extra];
  const metricReaders: MetricReader[] = [];

  if (opts.exporter === 'otlp') {
    spanProcessors.unshift(new tracing.BatchSpanProcessor(new OTLPTraceExporter()));
    metricReaders.push(
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
      }),
    );
  }

  const sdk = new NodeSDK({
    serviceName: opts.serviceName,
    spanProcessors,
    instrumentations: opts.instrumentations ?? [],
  });
  sdk.start();
  // Model and tool calls made through the AI SDK become spans in the same trace.
  registerTelemetry(new OpenTelemetry());

  return { metricReaders, shutdown: () => sdk.shutdown() };
}
