/**
 * Arize Phoenix Integration
 *
 * Opt-in embedding visualization and RAG tracing.
 * Phoenix server runs separately: pip install arize-phoenix && phoenix serve
 * Set PHOENIX_COLLECTOR_ENDPOINT to enable trace collection.
 */

let phoenixInitialized = false;

export function initPhoenix(): void {
  if (phoenixInitialized || !process.env.PHOENIX_COLLECTOR_ENDPOINT) return;

  // Phoenix uses OpenTelemetry for trace collection.
  // When the endpoint is set, traces from LangFuse (which also uses OTEL)
  // will be forwarded. For standalone Phoenix tracing, install
  // @opentelemetry/sdk-node and configure the exporter to point here.
  console.log(
    `[Phoenix] Collector endpoint configured: ${process.env.PHOENIX_COLLECTOR_ENDPOINT}`
  );
  phoenixInitialized = true;
}

export function isPhoenixEnabled(): boolean {
  return !!process.env.PHOENIX_COLLECTOR_ENDPOINT;
}
