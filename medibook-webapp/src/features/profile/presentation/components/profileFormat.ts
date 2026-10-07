/** Display helpers for the my-account screen. Pure functions, no React. */

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** "2026-10-05T09:12:00Z" → "5 Oct 2026, 2:42 pm" in the viewer's zone; em dash when unparsable. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : DATE_TIME_FORMAT.format(date);
}

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/Android/, 'Android'],
  [/iPhone|iPad/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

/** A short "Chrome on macOS" from a user-agent string (best effort). */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1];
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Unknown device';
}

const MS_PER_MINUTE = 60_000;

/**
 * Whether a device's session has already ended from inactivity: the server
 * refuses a session once `last_seen_at + idle limit` has passed
 * (`accounts/authentication.py`), so listing it would offer to sign out a
 * ghost (UAT-69). The backend drops these itself once BE-21 lands; this keeps
 * the list honest meanwhile. This browser's own session is never hidden.
 */
export function isIdleExpired(
  session: { readonly lastSeenAt: string; readonly current: boolean },
  idleMinutes: number,
  now: number = Date.now(),
): boolean {
  if (session.current) return false;
  const lastSeen = new Date(session.lastSeenAt).getTime();
  return Number.isFinite(lastSeen) && lastSeen + idleMinutes * MS_PER_MINUTE <= now;
}
