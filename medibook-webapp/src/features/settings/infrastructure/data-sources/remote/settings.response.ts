import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  BankAccount,
  HospitalHoursDay,
  HospitalProfile,
  HospitalRuleSettings,
  SlotsPerSessionEstimate,
  TokenPolicy,
  TokenScope,
} from '@/features/settings/domain/entities/settings.entities';

/**
 * Response DTOs for module H2, from `schema.yml` (`HospitalProfile`,
 * `HospitalSettings`, `ScheduleHours`, `TokenPolicy`, `BankAccount`). Fields
 * the screen does not use are left unvalidated (Zod strips them).
 */

/* ------------------------------------------------------------------ profile */

export const hospitalProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  legal_name: z.string().nullable(),
  gstin: z.string().nullable(),
  registration_no: z.string().nullable(),
  email: z.string(),
  phone_e164: z.string(),
  address_line1: z.string(),
  address_line2: z.string().nullable(),
  address_line3: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  logo_file_id: z.string().nullable(),
  cover_file_id: z.string().nullable(),
  online_booking_enabled: z.boolean(),
  version: z.number().int(),
});

export type HospitalProfileResponse = z.infer<typeof hospitalProfileResponseSchema>;

export function toHospitalProfile(dto: HospitalProfileResponse): HospitalProfile {
  return {
    id: dto.id,
    name: dto.name,
    legalName: dto.legal_name,
    gstin: dto.gstin,
    registrationNo: dto.registration_no,
    email: dto.email,
    phoneE164: dto.phone_e164,
    addressLine1: dto.address_line1,
    addressLine2: dto.address_line2,
    addressLine3: dto.address_line3,
    city: dto.city,
    state: dto.state,
    pincode: dto.pincode,
    lat: dto.lat,
    lng: dto.lng,
    logoFileId: dto.logo_file_id,
    coverFileId: dto.cover_file_id,
    onlineBookingEnabled: dto.online_booking_enabled,
    version: dto.version,
  };
}

/* ----------------------------------------------------------------- settings */

/** `derived` is typed as a free-form object; read only the keys this screen shows. */
const derivedSchema = z.object({
  booking_window_end_date: z.string().nullable().optional(),
  cancellation_example: z.string().nullable().optional(),
  slots_per_session_estimate: z
    .object({ min: z.number(), max: z.number(), avg: z.number() })
    .nullable()
    .optional(),
});

export const hospitalSettingsResponseSchema = z.object({
  booking_window_days: z.number().int(),
  hold_timeout_seconds: z.number().int(),
  cancellation_cutoff_hours: z.number().int(),
  follow_up_window_days: z.number().int(),
  expected_consult_minutes: z.number().int().nullable().optional(),
  version: z.number().int(),
  derived: derivedSchema,
});

export type HospitalSettingsResponse = z.infer<typeof hospitalSettingsResponseSchema>;

export function toHospitalRuleSettings(dto: HospitalSettingsResponse): HospitalRuleSettings {
  const estimate: SlotsPerSessionEstimate | null = dto.derived.slots_per_session_estimate ?? null;
  return {
    bookingWindowDays: dto.booking_window_days,
    holdTimeoutSeconds: dto.hold_timeout_seconds,
    cancellationCutoffHours: dto.cancellation_cutoff_hours,
    followUpWindowDays: dto.follow_up_window_days,
    expectedConsultMinutes: dto.expected_consult_minutes ?? null,
    version: dto.version,
    derived: {
      bookingWindowEndDate: dto.derived.booking_window_end_date ?? null,
      cancellationExample: dto.derived.cancellation_example ?? null,
      slotsPerSessionEstimate: estimate,
    },
  };
}

/* -------------------------------------------------------------------- hours */

/** DRF `TimeField` renders `HH:MM:SS`; the app keeps `HH:MM`. */
const HH_MM_LENGTH = 5;

function toHhMm(time: string | null | undefined): string | null {
  return time ? time.slice(0, HH_MM_LENGTH) : null;
}

const scheduleHoursSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  is_closed: z.boolean().optional(),
  opens_at: z.string().nullable().optional(),
  closes_at: z.string().nullable().optional(),
});

export const scheduleHoursListResponseSchema = z.array(scheduleHoursSchema);

export type ScheduleHoursListResponse = z.infer<typeof scheduleHoursListResponseSchema>;

export function toHospitalHours(dto: ScheduleHoursListResponse): readonly HospitalHoursDay[] {
  return dto
    .map((row) => ({
      weekday: row.weekday,
      isClosed: row.is_closed ?? false,
      opensAt: toHhMm(row.opens_at),
      closesAt: toHhMm(row.closes_at),
    }))
    .sort((a, b) => a.weekday - b.weekday);
}

/* ------------------------------------------------------------- token policy */

const tokenScopeSchema = z.enum(['doctor', 'department', 'hospital']);

/** `pending` is `{scope, reset, effective_date}` or null; either key may be null. */
const pendingSchema = z
  .object({
    scope: tokenScopeSchema.nullable().optional(),
    effective_date: z.string().nullable().optional(),
  })
  .nullable();

export const tokenPolicyResponseSchema = z.object({
  scope: tokenScopeSchema,
  pending: pendingSchema,
  version: z.number().int(),
});

export type TokenPolicyResponse = z.infer<typeof tokenPolicyResponseSchema>;

export function toTokenPolicy(dto: TokenPolicyResponse): TokenPolicy {
  const pendingScope: TokenScope | null = dto.pending?.scope ?? null;
  return {
    scope: dto.scope,
    pendingScope,
    pendingEffectiveDate: pendingScope ? (dto.pending?.effective_date ?? null) : null,
    version: dto.version,
  };
}

/* ------------------------------------------------------------ bank accounts */

export const bankAccountResponseSchema = z.object({
  id: z.string(),
  account_holder: z.string(),
  account_last4: z.string(),
  ifsc: z.string(),
  bank_name: z.string(),
  upi_id: z.string().nullable(),
  is_primary: z.boolean(),
  verified_at: z.string().nullable(),
  version: z.number().int(),
});

/** `GET /billing/bank-accounts` answers with the page envelope, not the bare array `schema.yml` shows. */
export const bankAccountPageResponseSchema = paginatedSchema(bankAccountResponseSchema);

export type BankAccountResponse = z.infer<typeof bankAccountResponseSchema>;

export function toBankAccount(dto: BankAccountResponse): BankAccount {
  return {
    id: dto.id,
    accountHolder: dto.account_holder,
    accountLast4: dto.account_last4,
    ifsc: dto.ifsc,
    bankName: dto.bank_name,
    upiId: dto.upi_id,
    isPrimary: dto.is_primary,
    verifiedAt: dto.verified_at,
    version: dto.version,
  };
}
