import type { Failure } from '@/core/error/failure';

/** Backend password policy minimum (`password_policy.MIN_LENGTH`); the server re-checks. */
export const PASSWORD_MIN_LENGTH = 10;

/** Client-side checks before a new password is sent; `null` when it may be sent. */
export function newPasswordProblem(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}

/**
 * The most useful sentence from a failed password write: the policy's own
 * field message (too short, contains your name, found in a breach) when the
 * server sent one, else the failure's user-safe message.
 */
export function passwordFailureMessage(failure: Failure, field: string): string {
  return failure.fieldErrors[field]?.join(' ') ?? failure.message;
}
