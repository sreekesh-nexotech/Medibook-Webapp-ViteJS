import type { AuditLogEntry } from '@/features/ops-logs/domain/entities/logs.types';

/** Leading characters of an actor UUID shown under the action. */
const ACTOR_ID_PREVIEW = 8;

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

/** Who acted: the principal, plus the user id when there is one. */
export function actorLabel(entry: AuditLogEntry): string {
  return entry.actorUserId
    ? `${entry.principal} · ${entry.actorUserId.slice(0, ACTOR_ID_PREVIEW)}`
    : entry.principal;
}
