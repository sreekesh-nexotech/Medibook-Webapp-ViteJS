import { describe, expect, it } from 'vitest';

import { isIdleExpired } from '@/features/profile/presentation/components/profileFormat';

const NOW = Date.parse('2026-10-07T10:00:00Z');

describe('isIdleExpired (UAT-69)', () => {
  it('hides another device idle past the limit', () => {
    expect(isIdleExpired({ lastSeenAt: '2026-10-07T09:44:00Z', current: false }, 15, NOW)).toBe(
      true,
    );
  });

  it('keeps a device seen within the limit', () => {
    expect(isIdleExpired({ lastSeenAt: '2026-10-07T09:50:00Z', current: false }, 15, NOW)).toBe(
      false,
    );
  });

  it('never hides this browser, and keeps rows with an unreadable time', () => {
    expect(isIdleExpired({ lastSeenAt: '2026-10-06T09:00:00Z', current: true }, 15, NOW)).toBe(
      false,
    );
    expect(isIdleExpired({ lastSeenAt: 'not a date', current: false }, 15, NOW)).toBe(false);
  });
});
