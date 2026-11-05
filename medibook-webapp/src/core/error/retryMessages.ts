/**
 * Plain-language copy for the two "slow down" answers (UAT part 2, T13/T15):
 * 423 `AUTH_LOCKED_OUT` carries `meta.locked_until`; 429 carries a wait as the
 * `Retry-After` header and/or `meta.retry_after_seconds`. Each helper returns
 * `null` when the data is missing or unusable so the caller keeps the server's
 * own sentence. Nothing here says which credential was wrong.
 */

type Meta = Readonly<Record<string, unknown>>;

/** "Sign-in is locked until 3:42 pm" in the device's time zone (or `timeZone`, for tests). */
export function lockedOutMessage(
  meta: Meta,
  now: number = Date.now(),
  timeZone?: string,
): string | null {
  const raw = meta['locked_until'];
  if (typeof raw !== 'string') return null;
  const until = Date.parse(raw);
  if (Number.isNaN(until) || until <= now) return null;
  const time = new Intl.DateTimeFormat('en-IN', {
    timeStyle: 'short',
    timeZone,
  }).format(until);
  const sameDay =
    new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone }).format(until) ===
    new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone }).format(now);
  const when = sameDay
    ? time
    : `${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone }).format(until)}, ${time}`;
  return `Too many failed attempts. Sign-in is locked until ${when}. Try again then.`;
}

function positiveSeconds(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.ceil(n) : null;
}

/** The wait a 429 asks for: `Retry-After` header, else `retry_after_seconds`, else `retry_after`. */
export function retryAfterSeconds(meta: Meta, header: unknown): number | null {
  return (
    positiveSeconds(header) ??
    positiveSeconds(meta['retry_after_seconds']) ??
    positiveSeconds(meta['retry_after'])
  );
}

export function tryAgainMessage(seconds: number): string {
  if (seconds < 1) return 'Too many requests. Try again in a moment.';
  return `Too many requests. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`;
}
