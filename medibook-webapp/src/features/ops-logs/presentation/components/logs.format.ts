/** Audit timestamps read in IST, the console's timezone (backend `audit_log_spec`). */
const LOG_TIME_ZONE = 'Asia/Kolkata';

const logDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: LOG_TIME_ZONE,
  month: 'long',
  day: '2-digit',
  year: 'numeric',
});

const logClockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: LOG_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

/** `June 13, 2026 · 09:42` — the trail's timestamp style. */
export function formatLogTime(iso: string): string {
  const at = new Date(iso);
  return `${logDateFormat.format(at)} · ${logClockFormat.format(at)}`;
}

/** The request behind an entry — `POST /api/v1/platform/plans` — or a background task. */
export function requestOf(method: string, path: string): string {
  return method === 'TASK' || !path ? 'Background task' : `${method} ${path}`;
}
