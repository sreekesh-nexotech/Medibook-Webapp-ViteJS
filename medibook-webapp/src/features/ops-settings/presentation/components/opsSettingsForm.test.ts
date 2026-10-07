import { describe, expect, it } from 'vitest';

import {
  toFeatureFlagPatchBody,
  toPlatformSettingsRequest,
} from '@/features/ops-settings/infrastructure/data-sources/remote/opsSettings.request';
import { toPlatformSettings } from '@/features/ops-settings/infrastructure/data-sources/remote/opsSettings.response';
import {
  formatReminderOffsets,
  parseReminderOffsets,
  toSettingsForm,
  toSettingsValues,
  validateSettingsForm,
} from '@/features/ops-settings/presentation/components/opsSettingsForm';

const DTO = {
  id: 1,
  convenience_fee_tax_rate_bp: 1800,
  platform_gstin: '32AAAAA0000A1Z5',
  platform_legal_name: 'Medibook Health Technologies Pvt Ltd',
  platform_address_line1: '4th Floor, Infopark Phase 2',
  platform_address_line2: null,
  platform_address_line3: null,
  platform_city: 'Kochi',
  platform_state: 'Kerala',
  platform_pincode: '682042',
  platform_phone_e164: '+918022044000',
  otp_length: 4,
  otp_ttl_seconds: 180,
  otp_max_attempts: 3,
  login_max_attempts: 5,
  login_lockout_seconds: 90,
  default_grace_days: 7,
  default_trial_days: 14,
  quiet_hours_start: '21:00:00',
  quiet_hours_end: '08:00:00',
  reminder_offsets_min: [10080, 2880, 1440, 120],
  upload_max_bytes: 10_485_761,
  dsr_cooling_off_days: 30,
  review_moderation_required: true,
  session_timeout_min: 15,
  min_app_version_android: '1.0.0',
  min_app_version_ios: null,
  version: 2,
  updated_at: '2026-07-31T04:00:00Z',
};

const OLD = toPlatformSettings(DTO);
const NEW = toPlatformSettings({
  ...DTO,
  payout_four_eyes: false,
  max_pending_bookings_per_user: 3,
  max_bookings_per_person_doctor_day: 1,
});

describe('reminder offsets', () => {
  it('round-trips the default 1 w / 48 h / 24 h / 2 h', () => {
    expect(formatReminderOffsets([10080, 2880, 1440, 120])).toBe('1w, 48h, 24h, 2h');
    expect(parseReminderOffsets('1w, 48h, 24h, 2h')).toEqual([10080, 2880, 1440, 120]);
  });

  it('accepts days and minutes, sorts and de-duplicates', () => {
    expect(parseReminderOffsets('90m 2d, 48h')).toEqual([2880, 90]);
  });

  it('refuses parts without a unit or with zero', () => {
    expect(parseReminderOffsets('24')).toBeNull();
    expect(parseReminderOffsets('0h')).toBeNull();
    expect(parseReminderOffsets('')).toBeNull();
  });
});

describe('validateSettingsForm', () => {
  const form = toSettingsForm(NEW);

  it('accepts the stored record as it is', () => {
    expect(validateSettingsForm(form, NEW)).toEqual({});
  });

  it('enforces the D-23 caps while the code is 4 digits (B1, L-07)', () => {
    const errors = validateSettingsForm(
      { ...form, otpTtlSeconds: '300', otpMaxAttempts: '5' },
      NEW,
    );
    expect(errors.otpTtlSeconds).toMatch(/at most 180 seconds/);
    expect(errors.otpMaxAttempts).toMatch(/at most 3 attempts/);
    expect(
      validateSettingsForm(
        { ...form, otpLength: '6', otpTtlSeconds: '300', otpMaxAttempts: '5' },
        NEW,
      ),
    ).toEqual({});
  });

  it('applies the serializer bounds', () => {
    const errors = validateSettingsForm(
      { ...form, graceDays: '91', trialDays: '-1', maxPendingBookings: '21', pincode: '06820' },
      NEW,
    );
    expect(Object.keys(errors).sort()).toEqual([
      'graceDays',
      'maxPendingBookings',
      'pincode',
      'trialDays',
    ]);
  });

  it('skips the booking caps on a backend without them', () => {
    expect(validateSettingsForm({ ...toSettingsForm(OLD), maxPendingBookings: '' }, OLD)).toEqual(
      {},
    );
  });
});

describe('toSettingsValues', () => {
  it('keeps unedited stored values exactly (no display rounding)', () => {
    const form = toSettingsForm(OLD);
    const values = toSettingsValues(OLD, form, form);
    expect(values.loginLockoutSeconds).toBe(90);
    expect(values.uploadMaxBytes).toBe(10_485_761);
    expect(values.quietHoursStart).toBe('21:00:00');
  });

  it('converts edited fields back to server units', () => {
    const initial = toSettingsForm(NEW);
    const values = toSettingsValues(
      NEW,
      {
        ...initial,
        convenienceFeeGst: '12',
        lockoutMinutes: '30',
        uploadMaxMb: '5',
        reminderOffsets: '24h, 2h',
        payoutFourEyes: true,
      },
      initial,
    );
    expect(values).toMatchObject({
      convenienceFeeTaxRateBp: 1200,
      loginLockoutSeconds: 1800,
      uploadMaxBytes: 5 * 1024 * 1024,
      reminderOffsetsMin: [1440, 120],
      payoutFourEyes: true,
    });
  });

  it('never sends a setting the backend did not send', () => {
    const form = toSettingsForm(OLD);
    const request = toPlatformSettingsRequest(toSettingsValues(OLD, form, form));
    expect('payout_four_eyes' in request).toBe(false);
    expect('max_pending_bookings_per_user' in request).toBe(false);
    const newer = toPlatformSettingsRequest(
      toSettingsValues(NEW, toSettingsForm(NEW), toSettingsForm(NEW)),
    );
    expect(newer).toMatchObject({ payout_four_eyes: false, max_pending_bookings_per_user: 3 });
  });
});

describe('tax rate applies-to choices (BE-18)', () => {
  it('no longer offers the convenience fee, but keeps it visible on an old row', async () => {
    const { appliesToOptionsFor } =
      await import('@/features/ops-settings/presentation/components/opsSettingsFormat');
    expect(appliesToOptionsFor('service')).toEqual(['consultation', 'service', 'all']);
    expect(appliesToOptionsFor('convenience_fee')[0]).toBe('convenience_fee');
  });
});

describe('feature flag changes', () => {
  it('patches only the fields that change, with the backend names', () => {
    expect(toFeatureFlagPatchBody({ enabled: false })).toEqual({ enabled: false });
    expect(toFeatureFlagPatchBody({ description: 'New booking flow', isPublic: true })).toEqual({
      description: 'New booking flow',
      is_public: true,
    });
    expect(toFeatureFlagPatchBody({})).toEqual({});
  });
});
