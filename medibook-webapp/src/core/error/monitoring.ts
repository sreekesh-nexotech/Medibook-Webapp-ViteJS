import { z } from 'zod';

import { newRequestId } from '@/core/api/requestId';
import { APP_COMMIT, APP_VERSION } from '@/core/config/build';
import { MONITORING_URL } from '@/core/config/env';
import type { Failure, FailureKind } from '@/core/error/failure';
import { isFailure } from '@/core/error/failure';

/**
 * Runtime errors leave the browser here (OBS-01): crashes caught by an error
 * boundary, uncaught errors and rejections, server errors, and responses that
 * failed validation. Each report carries the screen path, the build version
 * and commit (OBS-03) and, for API failures, the request id the backend logged
 * (OBS-04).
 *
 * Reports are POSTed as JSON to `VITE_MONITORING_URL` (payload in
 * `docs/MONITORING.md`). Without one nothing is sent and no reference is
 * shown, since there would be nowhere to look it up.
 *
 * Patient data stays out: the path never includes its query string (search
 * terms), and an API failure is sent as its kind, status, code and request id,
 * never the server's message.
 */

/** Where the error was caught. */
export type ErrorSource = 'render' | 'route' | 'window' | 'promise' | 'api';

export interface ErrorReport {
  /** This report's id; the start of it is shown to the user as the reference. */
  readonly id: string;
  readonly source: ErrorSource;
  readonly name: string;
  readonly message: string;
  readonly stack: string | null;
  readonly componentStack: string | null;
  /** `location.pathname` only — never the query string or hash. */
  readonly path: string;
  readonly release: string;
  readonly commit: string;
  readonly requestId: string | null;
  readonly status: number | null;
  readonly code: string | null;
  /** Validation problems in a response: field paths and Zod codes only. */
  readonly issues: readonly { readonly path: string; readonly code: string }[];
  readonly occurredAt: string;
  readonly userAgent: string;
}

interface ReportContext {
  readonly source: ErrorSource;
  readonly componentStack?: string | null;
}

/** API failures worth an alert: the server erred or answered in a shape we cannot read. */
const REPORTED_KINDS: ReadonlySet<FailureKind> = new Set(['server', 'parse', 'unknown']);

/** At most this many reports per minute from one page, so a render loop cannot flood. */
const MAX_REPORTS_PER_WINDOW = 10;
const REPORT_WINDOW_MS = 60_000;
/** Longest stack sent, in characters (`keepalive` bodies are capped at 64 kB). */
const MAX_STACK_CHARS = 8_000;
const MAX_ISSUES = 5;

/** When this page sent its recent reports, for the per-minute cap. */
const sentAt: number[] = [];
/** The id each error object is (or will be) reported under. */
const ids = new WeakMap<object, string>();
const sent = new WeakSet<object>();

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Non-error value thrown';
}

function truncate(text: string | null | undefined): string | null {
  return text ? text.slice(0, MAX_STACK_CHARS) : null;
}

function issuesOf(error: unknown): ErrorReport['issues'] {
  if (!(error instanceof z.ZodError)) return [];
  return error.issues
    .slice(0, MAX_ISSUES)
    .map((issue) => ({ path: issue.path.map(String).join('.'), code: issue.code }));
}

/** Sends the report; a monitoring outage must never break the app, so failures are dropped. */
function send(report: ErrorReport): void {
  void fetch(MONITORING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => undefined);
}

/** Whether the page may send another report now (at most 10 a minute). */
function underCap(now: number): boolean {
  while (sentAt.length > 0 && now - (sentAt[0] ?? now) > REPORT_WINDOW_MS) sentAt.shift();
  return sentAt.length < MAX_REPORTS_PER_WINDOW;
}

/**
 * The id `error` is reported under, fixed on first ask so a screen can show
 * it while the report is sent from an effect; `null` with monitoring off.
 */
export function reportIdFor(error: unknown): string | null {
  if (!MONITORING_URL || typeof error !== 'object' || error === null) return null;
  const known = ids.get(error);
  if (known) return known;
  const id = newRequestId();
  ids.set(error, id);
  return id;
}

function submit(
  error: unknown,
  context: ReportContext,
  extra: Partial<Pick<ErrorReport, 'requestId' | 'status' | 'code' | 'name' | 'message'>> = {},
): string | null {
  if (!MONITORING_URL) return null;
  const isObject = typeof error === 'object' && error !== null;
  // The same error object is sent once, however many places catch it.
  if (isObject && sent.has(error)) return ids.get(error) ?? null;
  const now = Date.now();
  if (!underCap(now)) return null;
  const id = reportIdFor(error) ?? newRequestId();
  sentAt.push(now);
  if (isObject) sent.add(error);
  send({
    id,
    source: context.source,
    name: extra.name ?? errorName(error),
    message: extra.message ?? errorMessage(error),
    stack: truncate(error instanceof Error ? error.stack : null),
    componentStack: truncate(context.componentStack),
    path: window.location.pathname,
    release: APP_VERSION,
    commit: APP_COMMIT,
    requestId: extra.requestId ?? null,
    status: extra.status ?? null,
    code: extra.code ?? null,
    issues: issuesOf(error),
    occurredAt: new Date(now).toISOString(),
    userAgent: navigator.userAgent,
  });
  return id;
}

/**
 * Report a crash or uncaught error. Returns the report id to show as a
 * reference, or `null` when monitoring is off or the page is over its limit
 * (10 reports a minute). Reporting the same error object again sends nothing
 * and returns the first id.
 */
export function reportError(error: unknown, context: ReportContext): string | null {
  return submit(error, context);
}

/**
 * Report an API failure when it is worth an alert (5xx, an unreadable
 * response, an unexpected client error). `cause` is what was thrown, so a
 * response that failed validation can say which fields.
 */
export function reportFailure(failure: Failure, cause?: unknown): void {
  if (!REPORTED_KINDS.has(failure.kind)) return;
  submit(
    cause ?? failure,
    { source: 'api' },
    {
      name: failure.kind,
      // The server's sentence can quote what the user typed; the code says enough.
      message: failure.code ?? (cause instanceof Error ? cause.message : failure.kind),
      requestId: failure.requestId,
      status: failure.status,
      code: failure.code,
    },
  );
}

/** Wire uncaught errors and rejections to `reportError`; `ignore` skips expected ones. */
export function reportUncaughtErrors(ignore: (error: unknown) => boolean): void {
  window.addEventListener('error', (event) => {
    // "Script error." with no error object comes from another origin (an extension).
    const error: unknown = event.error ?? (event.message ? event.message : null);
    if (error === null || ignore(error)) return;
    reportError(error, { source: 'window' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    if (ignore(reason)) return;
    if (isFailure(reason)) reportFailure(reason);
    else reportError(reason, { source: 'promise' });
  });
}
