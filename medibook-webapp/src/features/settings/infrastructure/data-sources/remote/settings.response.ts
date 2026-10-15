import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  BankAccount,
  HospitalHoursDay,
  HospitalProfile,
  HospitalRuleSettings,
  SlotsPerSessionEstimate,
  TokenPolicy,
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
  website: z.string().nullable().optional(),
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
  stamp_file_id: z.string().nullable().optional(),
  online_booking_enabled: z.boolean(),
  // IANA zone the hospital's dates and times are kept in; optional for older backends.
  timezone: z.string().optional(),
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
    website: dto.website ?? null,
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
    stampFileId: dto.stamp_file_id ?? null,
    onlineBookingEnabled: dto.online_booking_enabled,
    timezone: dto.timezone ?? null,
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
  token_cancel_rule: z.string().nullable().optional(),
});

const receiptPaperSchema = z.enum(['A5', '80mm', 'A4']);

/** Backend defaults (`HospitalSettings` model) for fields an older backend omits. */
const DEFAULT_REFUND_BEFORE_BP = 10_000;
const DEFAULT_NO_SHOW_ATTEMPTS = 3;
const DEFAULT_RECEIPT_PAPER = 'A5';

/**
 * `GET/PUT /settings` (`HospitalSettingsSerializer`). Every field the
 * screen edits is read; the newer ones are optional so an older backend
 * still parses. `desk_payment_methods` is APPT-03 (B3) — absent until it lands.
 */
export const hospitalSettingsResponseSchema = z.object({
  booking_window_days: z.number().int(),
  online_requires_approval: z.boolean().optional(),
  hold_timeout_seconds: z.number().int(),
  cancellation_cutoff_hours: z.number().int(),
  refund_before_cutoff_bp: z.number().int().optional(),
  refund_after_cutoff_bp: z.number().int().optional(),
  refund_includes_convenience_fee: z.boolean().optional(),
  follow_up_window_days: z.number().int(),
  no_show_call_attempts: z.number().int().optional(),
  token_cancel_limit_min: z.number().int().nullable().optional(),
  expected_consult_minutes: z.number().int().nullable().optional(),
  patient_notes_enabled: z.boolean().optional(),
  receipt_paper: receiptPaperSchema.optional(),
  receipt_show_staff: z.boolean().optional(),
  patient_edit_requires_approval: z.boolean().optional(),
  display_show_full_name: z.boolean().optional(),
  desk_payment_methods: z.array(z.string()).nullable().optional(),
  version: z.number().int(),
  derived: derivedSchema,
});

export type HospitalSettingsResponse = z.infer<typeof hospitalSettingsResponseSchema>;

export function toHospitalRuleSettings(dto: HospitalSettingsResponse): HospitalRuleSettings {
  const estimate: SlotsPerSessionEstimate | null = dto.derived.slots_per_session_estimate ?? null;
  return {
    bookingWindowDays: dto.booking_window_days,
    onlineRequiresApproval: dto.online_requires_approval ?? false,
    holdTimeoutSeconds: dto.hold_timeout_seconds,
    cancellationCutoffHours: dto.cancellation_cutoff_hours,
    refundBeforeCutoffBp: dto.refund_before_cutoff_bp ?? DEFAULT_REFUND_BEFORE_BP,
    refundAfterCutoffBp: dto.refund_after_cutoff_bp ?? 0,
    refundIncludesConvenienceFee: dto.refund_includes_convenience_fee ?? false,
    followUpWindowDays: dto.follow_up_window_days,
    noShowCallAttempts: dto.no_show_call_attempts ?? DEFAULT_NO_SHOW_ATTEMPTS,
    tokenCancelLimitMin: dto.token_cancel_limit_min ?? null,
    expectedConsultMinutes: dto.expected_consult_minutes ?? null,
    patientNotesEnabled: dto.patient_notes_enabled ?? false,
    receiptPaper: dto.receipt_paper ?? DEFAULT_RECEIPT_PAPER,
    receiptShowStaff: dto.receipt_show_staff ?? true,
    patientEditRequiresApproval: dto.patient_edit_requires_approval ?? false,
    displayShowFullName: dto.display_show_full_name ?? false,
    deskPaymentMethods: dto.desk_payment_methods ?? null,
    version: dto.version,
    derived: {
      bookingWindowEndDate: dto.derived.booking_window_end_date ?? null,
      cancellationExample: dto.derived.cancellation_example ?? null,
      slotsPerSessionEstimate: estimate,
      tokenCancelRule: dto.derived.token_cancel_rule ?? null,
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
const tokenResetSchema = z.enum(['session', 'day']);

/** `pending` is `{scope, reset, effective_date}` or null; either key may be null. */
const pendingSchema = z
  .object({
    scope: tokenScopeSchema.nullable().optional(),
    reset: tokenResetSchema.nullable().optional(),
    effective_date: z.string().nullable().optional(),
  })
  .nullable();

/** Model defaults (`TokenPolicy`) for fields an older backend omits. */
const DEFAULT_TOKEN_FORMAT = '{PREFIX}-{SEQ:3}';

/** `GET/PUT /token-policy` (`TokenPolicySerializer`). */
export const tokenPolicyResponseSchema = z.object({
  scope: tokenScopeSchema,
  reset: tokenResetSchema.optional(),
  format: z.string().optional(),
  prefix: z.string().optional(),
  online_marker: z.string().optional(),
  offline_marker: z.string().optional(),
  separate_ranges: z.boolean().optional(),
  online_range_start: z.number().int().nullable().optional(),
  online_range_end: z.number().int().nullable().optional(),
  offline_range_start: z.number().int().nullable().optional(),
  offline_range_end: z.number().int().nullable().optional(),
  reuse_cancelled: z.boolean().optional(),
  print_template_id: z.string().nullable().optional(),
  pending: pendingSchema,
  version: z.number().int(),
});

export type TokenPolicyResponse = z.infer<typeof tokenPolicyResponseSchema>;

export function toTokenPolicy(dto: TokenPolicyResponse): TokenPolicy {
  const pending = dto.pending ?? null;
  const pendingScope = pending?.scope ?? null;
  const pendingReset = pending?.reset ?? null;
  return {
    scope: dto.scope,
    reset: dto.reset ?? 'session',
    format: dto.format ?? DEFAULT_TOKEN_FORMAT,
    prefix: dto.prefix ?? '',
    onlineMarker: dto.online_marker ?? 'A',
    offlineMarker: dto.offline_marker ?? 'W',
    separateRanges: dto.separate_ranges ?? false,
    onlineRangeStart: dto.online_range_start ?? null,
    onlineRangeEnd: dto.online_range_end ?? null,
    offlineRangeStart: dto.offline_range_start ?? null,
    offlineRangeEnd: dto.offline_range_end ?? null,
    reuseCancelled: dto.reuse_cancelled ?? true,
    printTemplateId: dto.print_template_id ?? null,
    pendingScope,
    pendingReset,
    pendingEffectiveDate: pendingScope || pendingReset ? (pending?.effective_date ?? null) : null,
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
