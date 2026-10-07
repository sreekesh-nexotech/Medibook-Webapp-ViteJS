import type {
  BankAccountInput,
  HospitalHoursDay,
  HospitalProfileChanges,
  HospitalRuleChanges,
  NumberingChanges,
  NumberingReset,
  TokenPolicyChanges,
  TokenReset,
  TokenScope,
} from '@/features/settings/domain/entities/settings.entities';

/**
 * Request DTOs for module H2 (`PatchedHospitalProfileUpdateRequest`,
 * `HospitalSettingsUpdateRequest`, `ScheduleHoursPutRequest`,
 * `BankAccountWriteRequest`). Only keys present in the input are sent, so an
 * omitted field keeps its stored value.
 */

export interface HospitalProfilePatchRequest {
  readonly name?: string;
  readonly email?: string;
  readonly phone_e164?: string;
  readonly address_line1?: string;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly logo_file_id?: string | null;
  readonly cover_file_id?: string | null;
}

export function toProfilePatchRequest(c: HospitalProfileChanges): HospitalProfilePatchRequest {
  return {
    ...(c.name !== undefined && { name: c.name }),
    ...(c.email !== undefined && { email: c.email }),
    ...(c.phoneE164 !== undefined && { phone_e164: c.phoneE164 }),
    ...(c.addressLine1 !== undefined && { address_line1: c.addressLine1 }),
    ...(c.city !== undefined && { city: c.city }),
    ...(c.state !== undefined && { state: c.state }),
    ...(c.pincode !== undefined && { pincode: c.pincode }),
    ...(c.lat !== undefined && { lat: c.lat }),
    ...(c.lng !== undefined && { lng: c.lng }),
    ...(c.logoFileId !== undefined && { logo_file_id: c.logoFileId }),
    ...(c.coverFileId !== undefined && { cover_file_id: c.coverFileId }),
  };
}

export interface HospitalSettingsPutRequest {
  readonly booking_window_days?: number;
  readonly online_requires_approval?: boolean;
  readonly hold_timeout_seconds?: number;
  readonly cancellation_cutoff_hours?: number;
  readonly refund_before_cutoff_bp?: number;
  readonly refund_after_cutoff_bp?: number;
  readonly refund_includes_convenience_fee?: boolean;
  readonly follow_up_window_days?: number;
  readonly no_show_call_attempts?: number;
  readonly token_cancel_limit_min?: number | null;
  readonly expected_consult_minutes?: number;
  readonly patient_notes_enabled?: boolean;
  readonly patient_edit_requires_approval?: boolean;
  readonly display_show_full_name?: boolean;
}

export function toSettingsPutRequest(c: HospitalRuleChanges): HospitalSettingsPutRequest {
  return {
    ...(c.bookingWindowDays !== undefined && { booking_window_days: c.bookingWindowDays }),
    ...(c.onlineRequiresApproval !== undefined && {
      online_requires_approval: c.onlineRequiresApproval,
    }),
    ...(c.holdTimeoutSeconds !== undefined && { hold_timeout_seconds: c.holdTimeoutSeconds }),
    ...(c.cancellationCutoffHours !== undefined && {
      cancellation_cutoff_hours: c.cancellationCutoffHours,
    }),
    ...(c.refundBeforeCutoffBp !== undefined && {
      refund_before_cutoff_bp: c.refundBeforeCutoffBp,
    }),
    ...(c.refundAfterCutoffBp !== undefined && { refund_after_cutoff_bp: c.refundAfterCutoffBp }),
    ...(c.refundIncludesConvenienceFee !== undefined && {
      refund_includes_convenience_fee: c.refundIncludesConvenienceFee,
    }),
    ...(c.followUpWindowDays !== undefined && { follow_up_window_days: c.followUpWindowDays }),
    ...(c.noShowCallAttempts !== undefined && { no_show_call_attempts: c.noShowCallAttempts }),
    ...(c.tokenCancelLimitMin !== undefined && { token_cancel_limit_min: c.tokenCancelLimitMin }),
    ...(c.expectedConsultMinutes !== undefined && {
      expected_consult_minutes: c.expectedConsultMinutes,
    }),
    ...(c.patientNotesEnabled !== undefined && { patient_notes_enabled: c.patientNotesEnabled }),
    ...(c.patientEditRequiresApproval !== undefined && {
      patient_edit_requires_approval: c.patientEditRequiresApproval,
    }),
    ...(c.displayShowFullName !== undefined && { display_show_full_name: c.displayShowFullName }),
  };
}

/** `TokenPolicyUpdateRequest` — never `version`, `pending` or other read-only keys (a 400). */
export interface TokenPolicyPutRequest {
  readonly scope?: TokenScope;
  readonly reset?: TokenReset;
  readonly format?: string;
  readonly prefix?: string;
  readonly online_marker?: string;
  readonly offline_marker?: string;
  readonly separate_ranges?: boolean;
  readonly online_range_start?: number | null;
  readonly online_range_end?: number | null;
  readonly offline_range_start?: number | null;
  readonly offline_range_end?: number | null;
  readonly reuse_cancelled?: boolean;
}

export function toTokenPolicyPutRequest(c: TokenPolicyChanges): TokenPolicyPutRequest {
  return {
    ...(c.scope !== undefined && { scope: c.scope }),
    ...(c.reset !== undefined && { reset: c.reset }),
    ...(c.format !== undefined && { format: c.format }),
    ...(c.prefix !== undefined && { prefix: c.prefix }),
    ...(c.onlineMarker !== undefined && { online_marker: c.onlineMarker }),
    ...(c.offlineMarker !== undefined && { offline_marker: c.offlineMarker }),
    ...(c.separateRanges !== undefined && { separate_ranges: c.separateRanges }),
    ...(c.onlineRangeStart !== undefined && { online_range_start: c.onlineRangeStart }),
    ...(c.onlineRangeEnd !== undefined && { online_range_end: c.onlineRangeEnd }),
    ...(c.offlineRangeStart !== undefined && { offline_range_start: c.offlineRangeStart }),
    ...(c.offlineRangeEnd !== undefined && { offline_range_end: c.offlineRangeEnd }),
    ...(c.reuseCancelled !== undefined && { reuse_cancelled: c.reuseCancelled }),
  };
}

/** `NumberingSeriesUpdateRequest` — `editable_by` and `gapless` are Medibook's (a 400 here). */
export interface NumberingPutRequest {
  readonly format?: string;
  readonly prefix?: string;
  readonly pad_width?: number;
  readonly reset?: NumberingReset;
  readonly fy_start_month?: number;
}

export function toNumberingPutRequest(c: NumberingChanges): NumberingPutRequest {
  return {
    ...(c.format !== undefined && { format: c.format }),
    // The server stores an empty prefix as no prefix.
    ...(c.prefix !== undefined && { prefix: c.prefix ?? '' }),
    ...(c.padWidth !== undefined && { pad_width: c.padWidth }),
    ...(c.reset !== undefined && { reset: c.reset }),
    ...(c.fyStartMonth !== undefined && { fy_start_month: c.fyStartMonth }),
  };
}

export interface ScheduleHoursPutRequest {
  readonly hours: readonly {
    readonly weekday: number;
    readonly is_closed: boolean;
    readonly opens_at: string | null;
    readonly closes_at: string | null;
  }[];
}

export function toHoursPutRequest(days: readonly HospitalHoursDay[]): ScheduleHoursPutRequest {
  return {
    hours: days.map((d) => ({
      weekday: d.weekday,
      is_closed: d.isClosed,
      opens_at: d.isClosed ? null : d.opensAt,
      closes_at: d.isClosed ? null : d.closesAt,
    })),
  };
}

export interface BankAccountWriteRequest {
  readonly account_holder: string;
  readonly account_number?: string;
  readonly ifsc: string;
  readonly bank_name: string;
  readonly upi_id: string | null;
}

export function toBankAccountWriteRequest(input: BankAccountInput): BankAccountWriteRequest {
  return {
    account_holder: input.accountHolder,
    ...(input.accountNumber !== undefined && { account_number: input.accountNumber }),
    ifsc: input.ifsc,
    bank_name: input.bankName,
    upi_id: input.upiId,
  };
}
