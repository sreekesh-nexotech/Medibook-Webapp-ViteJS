import type { DisplaySession } from '@/features/display/domain/entities/display.types';

/** What the hall reads under the doctor's name. */
export function sessionStateLabel(session: DisplaySession): string {
  if (session.status === 'closed') return 'Session closed';
  if (session.status === 'paused' || session.queueState === 'on_break') return 'On a short break';
  if (session.status === 'scheduled') return 'Not started yet';
  return session.currentToken ? 'Now consulting' : 'Waiting for the next token';
}

/** "3 waiting" / "1 waiting" / "No one waiting". */
export function waitingLabel(count: number): string {
  return count > 0 ? `${count} waiting` : 'No one waiting';
}

/** Open sessions first, then the rest by doctor name, so the hall reads the live queues first. */
export function orderSessions(sessions: readonly DisplaySession[]): DisplaySession[] {
  const rank = (s: DisplaySession) => (s.status === 'open' ? 0 : s.status === 'closed' ? 2 : 1);
  return [...sessions].sort(
    (a, b) => rank(a) - rank(b) || a.doctorName.localeCompare(b.doctorName),
  );
}

/** `2026-10-16` → "Friday, 16 October 2026", read as a calendar date (no time zone shift). */
export function boardDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * The session whose token was called most recently, if that call is newer
 * than [since] — what the "Now calling" banner announces.
 */
export function latestCall(
  sessions: readonly DisplaySession[],
  since: string | null,
): DisplaySession | null {
  let latest: DisplaySession | null = null;
  for (const s of sessions) {
    if (!s.lastCalledAt || !s.currentToken) continue;
    if (!latest || Date.parse(s.lastCalledAt) > Date.parse(latest.lastCalledAt ?? '')) latest = s;
  }
  if (!latest?.lastCalledAt) return null;
  return since && Date.parse(latest.lastCalledAt) <= Date.parse(since) ? null : latest;
}
