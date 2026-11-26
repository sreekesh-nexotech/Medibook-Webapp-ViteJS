import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lockedOutMessage, retryAfterSeconds, tryAgainMessage } from '@/core/error/retryMessages';
import { toFailure } from '@/core/error/toFailure';

const NOW = Date.parse('2026-11-05T10:00:00Z');

function httpError(status: number, data: unknown, headers: Record<string, string> = {}) {
  const config = { headers: new AxiosHeaders() };
  const response: AxiosResponse = { status, statusText: '', data, headers, config };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, null, response);
}

describe('lockedOutMessage (UAT T13)', () => {
  it('names the time the lock ends, in the device’s local time', () => {
    const text = lockedOutMessage({ locked_until: '2026-11-05T10:15:00Z' }, NOW, 'UTC');
    expect(text).toBe(
      'Too many failed attempts. Sign-in is locked until 10:15 am. Try again then.',
    );
  });

  it('adds the date when the lock ends on another day', () => {
    const text = lockedOutMessage({ locked_until: '2026-11-06T09:00:00Z' }, NOW, 'UTC');
    expect(text).toContain('6 Nov');
  });

  it('adds the support contact when the backend sends one', () => {
    const until = '2026-11-05T10:15:00Z';
    const both = lockedOutMessage(
      { locked_until: until, support: { phone_e164: '+911800000000', email: 'help@medibook.in' } },
      NOW,
      'UTC',
    );
    expect(both).toMatch(/Need help\? You can call \+911800000000 or email help@medibook\.in\.$/);
    const phoneOnly = lockedOutMessage(
      { locked_until: until, support: { phone_e164: '+911800000000', email: null } },
      NOW,
      'UTC',
    );
    expect(phoneOnly).toMatch(/You can call \+911800000000\.$/);
  });

  it('leaves the support line out when the contact is null, empty or malformed', () => {
    for (const support of [{ phone_e164: null, email: null }, {}, null, 'x']) {
      expect(lockedOutMessage({ locked_until: '2026-11-05T10:15:00Z', support }, NOW, 'UTC')).toBe(
        'Too many failed attempts. Sign-in is locked until 10:15 am. Try again then.',
      );
    }
  });

  it('is null when locked_until is absent, unparseable or already past', () => {
    expect(lockedOutMessage({}, NOW)).toBeNull();
    expect(lockedOutMessage({ locked_until: 'soon' }, NOW)).toBeNull();
    expect(lockedOutMessage({ locked_until: '2026-11-05T09:00:00Z' }, NOW)).toBeNull();
    expect(lockedOutMessage({ locked_until: 5 }, NOW)).toBeNull();
  });
});

describe('retryAfterSeconds / tryAgainMessage (UAT T15)', () => {
  it('prefers the Retry-After header, then retry_after_seconds, then retry_after', () => {
    expect(retryAfterSeconds({ retry_after_seconds: 30 }, '12')).toBe(12);
    expect(retryAfterSeconds({ retry_after_seconds: 30 }, undefined)).toBe(30);
    expect(retryAfterSeconds({ retry_after: 45 }, undefined)).toBe(45);
  });

  it('rounds up and ignores nonsense', () => {
    expect(retryAfterSeconds({ retry_after_seconds: 2.2 }, undefined)).toBe(3);
    expect(retryAfterSeconds({ retry_after_seconds: -4 }, undefined)).toBeNull();
    expect(retryAfterSeconds({ retry_after_seconds: 'x' }, 'soon')).toBeNull();
    expect(retryAfterSeconds({}, undefined)).toBeNull();
  });

  it('words the wait in seconds', () => {
    expect(tryAgainMessage(1)).toBe('Too many requests. Try again in 1 second.');
    expect(tryAgainMessage(30)).toBe('Too many requests. Try again in 30 seconds.');
    expect(tryAgainMessage(0)).toBe('Too many requests. Try again in a moment.');
  });
});

describe('toFailure with 423 and 429', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('replaces the generic lockout sentence when locked_until is usable', () => {
    const f = toFailure(
      httpError(423, {
        code: 'AUTH_LOCKED_OUT',
        message: 'Too many failed attempts. Try again later.',
        meta: { locked_until: '2026-11-05T10:15:00Z', attempts_remaining: 0 },
      }),
    );
    expect(f).toMatchObject({ kind: 'rateLimited', code: 'AUTH_LOCKED_OUT', status: 423 });
    expect(f.message).toMatch(/locked until/);
    expect(f.meta).toMatchObject({ attempts_remaining: 0 });
  });

  it('keeps the server sentence when locked_until is missing', () => {
    const f = toFailure(
      httpError(423, {
        code: 'AUTH_LOCKED_OUT',
        message: 'Too many failed attempts. Try again later.',
      }),
    );
    expect(f.message).toBe('Too many failed attempts. Try again later.');
  });

  it('tells a 429 how long to wait, from the header or the body', () => {
    const fromBody = toFailure(
      httpError(429, {
        code: 'RATE_LIMITED',
        message: 'Too many requests.',
        meta: { retry_after_seconds: 20 },
      }),
    );
    expect(fromBody.message).toBe('Too many requests. Try again in 20 seconds.');
    const fromHeader = toFailure(
      httpError(
        429,
        { code: 'RATE_LIMITED', message: 'Too many requests.' },
        { 'retry-after': '7' },
      ),
    );
    expect(fromHeader.message).toBe('Too many requests. Try again in 7 seconds.');
  });

  it('leaves a 429 without any wait hint alone', () => {
    const f = toFailure(httpError(429, { code: 'RATE_LIMITED', message: 'Too many requests.' }));
    expect(f.message).toBe('Too many requests.');
  });
});
