import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  BankAccount,
  HospitalHoursDay,
  HospitalProfile,
  HospitalRuleSettings,
  NumberingKind,
  NumberingSeries,
  SlotsPerSessionEstimate,
  TokenPolicy,
  TokenReset,
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
});

export const hospitalSettingsResponseSchema = z.object({
  booking_window_days: z.number().int(),
  online_requires_approval: z.boolean(),
  hold_timeout_seconds: z.number().int(),
  cancellation_cutoff_hours: z.number().int(),
  refund_before_cutoff_bp: z.number().int(),
  refund_after_cutoff_bp: z.number().int(),
  refund_includes_convenience_fee: z.boolean(),
  follow_up_window_days: z.number().int(),
  no_show_call_attempts: z.number().int(),
  token_cancel_limit_min: z.number().int().nullable(),
  expected_consult_minutes: z.number().int(),
  patient_notes_enabled: z.boolean(),
  patient_edit_requires_approval: z.boolean(),
  display_show_full_name: z.boolean(),
  version: z.number().int(),
  derived: derivedSchema,
});

export type HospitalSettingsResponse = z.infer<typeof hospitalSettingsResponseSchema>;

export function toHospitalRuleSettings(dto: HospitalSettingsResponse): HospitalRuleSettings {
  const estimate: SlotsPerSessionEstimate | null = dto.derived.slots_per_session_estimate ?? null;
  return {
    bookingWindowDays: dto.booking_window_days,
    onlineRequiresApproval: dto.online_requires_approval,
    holdTimeoutSeconds: dto.hold_timeout_seconds,
    cancellationCutoffHours: dto.cancellation_cutoff_hours,
    refundBeforeCutoffBp: dto.refund_before_cutoff_bp,
    refundAfterCutoffBp: dto.refund_after_cutoff_bp,
    refundIncludesConvenienceFee: dto.refund_includes_convenience_fee,
    followUpWindowDays: dto.follow_up_window_days,
    noShowCallAttempts: dto.no_show_call_attempts,
    tokenCancelLimitMin: dto.token_cancel_limit_min,
    expectedConsultMinutes: dto.expected_consult_minutes,
    patientNotesEnabled: dto.patient_notes_enabled,
    patientEditRequiresApproval: dto.patient_edit_requires_approval,
    displayShowFullName: dto.display_show_full_name,
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
const tokenResetSchema = z.enum(['session', 'day']);

/** `pending` is `{scope, reset, effective_date}` or null; either key may be null. */
const pendingSchema = z
  .object({
    scope: tokenScopeSchema.nullable().optional(),
    reset: tokenResetSchema.nullable().optional(),
    effective_date: z.string().nullable().optional(),
  })
  .nullable();

export const tokenPolicyResponseSchema = z.object({
  scope: tokenScopeSchema,
  reset: tokenResetSchema,
  format: z.string(),
  prefix: z.string(),
  online_marker: z.string(),
  offline_marker: z.string(),
  separate_ranges: z.boolean(),
  online_range_start: z.number().int().nullable(),
  online_range_end: z.number().int().nullable(),
  offline_range_start: z.number().int().nullable(),
  offline_range_end: z.number().int().nullable(),
  reuse_cancelled: z.boolean(),
  pending: pendingSchema,
  version: z.number().int(),
});

export type TokenPolicyResponse = z.infer<typeof tokenPolicyResponseSchema>;

export function toTokenPolicy(dto: TokenPolicyResponse): TokenPolicy {
  const pendingScope: TokenScope | null = dto.pending?.scope ?? null;
  const pendingReset: TokenReset | null = dto.pending?.reset ?? null;
  return {
    scope: dto.scope,
    reset: dto.reset,
    format: dto.format,
    prefix: dto.prefix,
    onlineMarker: dto.online_marker,
    offlineMarker: dto.offline_marker,
    separateRanges: dto.separate_ranges,
    onlineRangeStart: dto.online_range_start,
    onlineRangeEnd: dto.online_range_end,
    offlineRangeStart: dto.offline_range_start,
    offlineRangeEnd: dto.offline_range_end,
    reuseCancelled: dto.reuse_cancelled,
    pendingScope,
    pendingReset,
    pendingEffectiveDate:
      pendingScope || pendingReset ? (dto.pending?.effective_date ?? null) : null,
    version: dto.version,
  };
}

/* ---------------------------------------------------------------- numbering */

const NUMBERING_KINDS: readonly NumberingKind[] = ['mrn', 'booking', 'receipt'];

/** The only role that may edit a series from the hospital app. */
const HOSPITAL_EDITOR = 'hospital_admin';

function isNumberingKind(kind: string): kind is NumberingKind {
  return (NUMBERING_KINDS as readonly string[]).includes(kind);
}

export const numberingSeriesResponseSchema = z.object({
  kind: z.string(),
  format: z.string(),
  prefix: z.string().nullable(),
  pad_width: z.number().int(),
  reset: z.enum(['never', 'fiscal_year', 'calendar_year', 'monthly']),
  fy_start_month: z.number().int().min(1).max(12),
  gapless: z.boolean(),
  editable_by: z.string(),
  locked: z.boolean(),
  next_preview: z.string(),
  version: z.number().int(),
});

/**
 * `GET /hospital/numbering` wraps the series in `results` with no paging keys
 * (`schema.yml` documents a bare array; the backend's own test reads `results`).
 */
export const numberingListResponseSchema = z.object({
  results: z.array(numberingSeriesResponseSchema),
});

export type NumberingSeriesResponse = z.infer<typeof numberingSeriesResponseSchema>;
export type NumberingListResponse = z.infer<typeof numberingListResponseSchema>;

/** `null` for a kind this app does not manage (only MRN, booking and receipt exist per hospital). */
export function toNumberingSeries(dto: NumberingSeriesResponse): NumberingSeries | null {
  if (!isNumberingKind(dto.kind)) return null;
  return {
    kind: dto.kind,
    format: dto.format,
    prefix: dto.prefix,
    padWidth: dto.pad_width,
    reset: dto.reset,
    fyStartMonth: dto.fy_start_month,
    gapless: dto.gapless,
    hospitalEditable: dto.editable_by === HOSPITAL_EDITOR,
    locked: dto.locked,
    nextPreview: dto.next_preview,
    version: dto.version,
  };
}

export function toNumberingList(dto: NumberingListResponse): readonly NumberingSeries[] {
  return dto.results.flatMap((row) => {
    const series = toNumberingSeries(row);
    return series ? [series] : [];
  });
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
