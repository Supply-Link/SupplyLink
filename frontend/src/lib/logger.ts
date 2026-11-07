export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) { console.error('[Error]', error, context) }
  // Production: wire to Sentry or OpenTelemetry here
}
