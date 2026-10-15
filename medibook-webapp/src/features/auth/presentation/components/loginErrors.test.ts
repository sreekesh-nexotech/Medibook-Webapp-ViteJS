import { describe, expect, it } from 'vitest';

import type { Failure } from '@/core/error/failure';

import { loginErrorMessage } from '@/features/auth/presentation/components/loginErrors';

function failure(code: string, meta: Record<string, unknown> = {}): Failure {
  return {
    kind: 'unauthorized',
    message: 'Server says no.',
    code,
    status: 401,
    fieldErrors: {},
    requestId: null,
    meta,
  };
}

const NOW = new Date('2026-10-07T10:00:00+05:30');

describe('loginErrorMessage (UAT-70)', () => {
  it('tells the user how many attempts are left', () => {
    expect(
      loginErrorMessage(failure('AUTH_INVALID_CREDENTIALS', { attempts_remaining: 3 }), false),
    ).toBe('Incorrect email or password. 3 attempts left before sign-in is locked for 60 minutes.');
    expect(
      loginErrorMessage(failure('AUTH_INVALID_CREDENTIALS', { attempts_remaining: 1 }), false),
    ).toContain('1 attempt left');
    expect(
      loginErrorMessage(failure('AUTH_INVALID_CREDENTIALS', { attempts_remaining: 0 }), false),
    ).toContain('now locked');
  });

  it('falls back to the plain message without a count', () => {
    expect(loginErrorMessage(failure('AUTH_INVALID_CREDENTIALS'), true)).toBe(
      'Incorrect email or password.',
    );
  });

  it('shows when a lock-out ends and how to recover, per surface', () => {
    const locked = failure('AUTH_LOCKED_OUT', {
      locked_until: '2026-10-07T11:05:00+05:30',
      attempts_remaining: 0,
    });
    const hospital = loginErrorMessage(locked, false, NOW);
    expect(hospital).toMatch(/locked until 11:05/i);
    expect(hospital).toContain('hospital administrator');
    expect(loginErrorMessage(locked, true, NOW)).toContain('Medibook administrator');
  });

  it('includes the date when the lock runs past today', () => {
    const locked = failure('AUTH_LOCKED_OUT', { locked_until: '2026-10-08T00:30:00+05:30' });
    expect(loginErrorMessage(locked, false, NOW)).toMatch(/8 Oct/);
  });

  it('words a surface mismatch and passes anything else through', () => {
    expect(loginErrorMessage(failure('PERMISSION_DENIED'), true)).toContain('operations console');
    expect(loginErrorMessage(failure('RATE_LIMITED'), false)).toBe('Server says no.');
  });
});
