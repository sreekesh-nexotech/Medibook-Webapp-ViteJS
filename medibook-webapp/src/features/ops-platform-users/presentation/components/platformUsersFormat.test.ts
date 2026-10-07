import { describe, expect, it } from 'vitest';

import { toCountQuery } from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.request';
import {
  toPlatformUserDetail,
  toPlatformUserSummary,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.response';
import {
  deviceLine,
  searchHint,
  verifiedLabel,
} from '@/features/ops-platform-users/presentation/components/platformUsersFormat';

const SUMMARY = {
  id: 'u1',
  first_name: 'Asha',
  last_name: 'Rao',
  phone_e164: '+91******00',
  alternate_phone_e164: null,
  email: 'a***@example.com',
  status: 'pending_deletion' as const,
  blocked_reason: null,
  deletion_requested_at: '2026-10-01T05:00:00Z',
  last_login_at: null,
  created_at: '2026-01-01T05:00:00Z',
};

describe('platform user mapping', () => {
  it('reads B2 booking_count and falls back to null on older backends', () => {
    expect(toPlatformUserSummary(SUMMARY).bookingCount).toBeNull();
    expect(toPlatformUserSummary({ ...SUMMARY, booking_count: 7 }).bookingCount).toBe(7);
  });

  it('maps the profile block the screen used to drop', () => {
    const detail = toPlatformUserDetail({
      ...SUMMARY,
      phone_verified_at: null,
      email_verified_at: null,
      has_password: false,
      locked_until: null,
      persons: [],
      bookings: [],
      devices: [],
      active_sessions: 2,
      profile: { date_of_birth: '1990-02-03', gender: 'female', marketing_opt_in: true },
    });
    expect(detail.profile).toEqual({
      dateOfBirth: '1990-02-03',
      gender: 'female',
      marketingOptIn: true,
    });
    expect(detail.deletionDueAt).toBeNull();
  });
});

describe('platform user display helpers', () => {
  it('states exact-match search for masked roles (L-11)', () => {
    expect(searchHint(false)).toMatch(/exact email/);
    expect(searchHint(true)).toMatch(/part of either/);
  });

  it('describes a device and a verification', () => {
    expect(deviceLine('android', '2.3.1', null)).toBe('android · app 2.3.1');
    expect(verifiedLabel(null)).toBe('Not verified');
  });
});

describe('KPI counts (B2 BE-31)', () => {
  it('asks for one row with only the filters a tile sets', () => {
    expect(toCountQuery({ status: 'blocked', createdFrom: null })).toEqual({
      page: 1,
      page_size: 1,
      status: 'blocked',
    });
    expect(toCountQuery({ status: null, createdFrom: null, lastLoginFrom: '2026-09-07' })).toEqual({
      page: 1,
      page_size: 1,
      last_login_from: '2026-09-07',
    });
  });
});
