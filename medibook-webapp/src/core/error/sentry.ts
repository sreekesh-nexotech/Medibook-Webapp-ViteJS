import * as Sentry from '@sentry/react';

import { APP_VERSION } from '@/core/config/build';
import { SENTRY_DSN, SENTRY_ENVIRONMENT } from '@/core/config/env';
import type { ErrorReport } from '@/core/error/monitoring';

/**
 * Sentry as a destination for `core/error/monitoring.ts` (OBS-01). Every
 * report still goes through `monitoring.ts` — its rate cap, one-report-per-error
 * rule and patient-data rules apply first — and is forwarded here as built.
 *
 * The SDK gathers nothing on its own: its global handlers, browser wrappers,
 * breadcrumbs and console capture are off (`monitoring.ts` already catches
 * uncaught errors, and breadcrumbs carry URLs with search terms), and so is
 * the request context, which holds the full page URL.
 */

/** The SDK's defaults that send nothing the app did not choose to report. */
const KEPT_INTEGRATIONS: ReadonlySet<string> = new Set([
  'EventFilters',
  'Dedupe',
  'BrowserSession',
]);

let started = false;

/** Starts the SDK when the build names a DSN; a no-op otherwise. */
export function startSentry(): void {
  if (!SENTRY_DSN || started) return;
  started = true;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: APP_VERSION,
    // No user, cookies, headers, bodies or query strings (search terms).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    integrations: (defaults) => defaults.filter(({ name }) => KEPT_INTEGRATIONS.has(name)),
  });
}

/**
 * Sends `report` to Sentry. The exception is rebuilt from the report, so
 * Sentry receives exactly what the JSON report holds: for an API failure that
 * is its code, never the server's sentence or the thrown object's fields.
 */
export function sendToSentry(report: ErrorReport): void {
  if (!started) return;
  const exception = new Error(report.message);
  exception.name = report.name;
  if (report.stack) exception.stack = report.stack;
  Sentry.captureException(exception, {
    tags: {
      report_id: report.id,
      source: report.source,
      path: report.path,
      commit: report.commit,
      request_id: report.requestId ?? undefined,
      status: report.status ?? undefined,
      code: report.code ?? undefined,
    },
    contexts: {
      report: {
        componentStack: report.componentStack,
        issues: report.issues,
        occurredAt: report.occurredAt,
      },
    },
  });
}
