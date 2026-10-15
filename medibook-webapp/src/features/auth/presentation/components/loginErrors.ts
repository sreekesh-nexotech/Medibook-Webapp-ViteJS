import type { Failure } from '@/core/error/failure';

/**
 * Sign-in failure copy (UAT-70). The backend's lockout service sends what a
 * user needs to avoid and recover from a lock-out (`accounts/services/
 * lockout.py`): `attempts_remaining` with a 401 `AUTH_INVALID_CREDENTIALS`,
 * and `locked_until` with a 423 `AUTH_LOCKED_OUT`. Both are shown.
 */

/** Five failures lock sign-in for an hour (CLAUDE.md §6 Identity). */
const LOCKOUT_MINUTES = 60;

function readNumber(meta: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = meta[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readDate(meta: Readonly<Record<string, unknown>>, key: string): Date | null {
  const value = meta[key];
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "4:05 pm", or "8 Oct, 4:05 pm" when the lock runs past today. */
export function formatUnlockTime(until: Date, now: Date): string {
  const sameDay = until.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat('en-IN', {
    ...(sameDay ? {} : { day: 'numeric', month: 'short' }),
    hour: 'numeric',
    minute: '2-digit',
  }).format(until);
}

function attemptsSentence(remaining: number): string {
  if (remaining <= 0) return `Sign-in is now locked for ${LOCKOUT_MINUTES} minutes.`;
  const attempts = remaining === 1 ? '1 attempt' : `${remaining} attempts`;
  return `${attempts} left before sign-in is locked for ${LOCKOUT_MINUTES} minutes.`;
}

/** Sign-in failures worded for the login screen; anything else shows the server's message. */
export function loginErrorMessage(
  failure: Failure,
  isOps: boolean,
  now: Date = new Date(),
): string {
  if (failure.code === 'AUTH_INVALID_CREDENTIALS') {
    const remaining = readNumber(failure.meta, 'attempts_remaining');
    const base = 'Incorrect email or password.';
    return remaining === null ? base : `${base} ${attemptsSentence(remaining)}`;
  }
  if (failure.code === 'AUTH_LOCKED_OUT') {
    const until = readDate(failure.meta, 'locked_until');
    const when = until ? `until ${formatUnlockTime(until, now)}` : 'for a while';
    const unlock = isOps
      ? 'Reset your password with "Forgot Password?", or ask a Medibook administrator.'
      : 'Reset your password with "Forgot Password?", or ask your hospital administrator to unlock your account.';
    return `Too many failed attempts. Sign-in is locked ${when}. ${unlock}`;
  }
  if (failure.code === 'PERMISSION_DENIED') {
    return isOps
      ? 'This account does not have access to the operations console.'
      : 'This account has no active hospital access. Contact your hospital administrator.';
  }
  return failure.message;
}
