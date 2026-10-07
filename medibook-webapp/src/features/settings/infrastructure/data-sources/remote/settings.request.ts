import type {
  BankAccountInput,
  HospitalHoursDay,
  HospitalProfileChanges,
  HospitalRuleChanges,
  TokenPolicyChanges,
} from '@/features/settings/domain/entities/settings.entities';

/**
 * Request DTOs for module H2 (`PatchedHospitalProfileUpdateRequest`,
 * `HospitalSettingsUpdateRequest`, `ScheduleHoursPutRequest`,
 * `BankAccountWriteRequest`). Only keys present in the input are sent, so an
 * omitted field keeps its stored value.
 */

export interface HospitalProfilePatchRequest {
  readonly name?: string;
  readonly legal_name?: string | null;
  readonly email?: string;
  readonly phone_e164?: string;
  readonly website?: string | null;
  readonly address_line1?: string;
  readonly address_line2?: string | null;
  readonly address_line3?: string | null;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly logo_file_id?: string | null;
  readonly cover_file_id?: string | null;
  readonly stamp_file_id?: string | null;
}

export function toProfilePatchRequest(c: HospitalProfileChanges): HospitalProfilePatchRequest {
  return {
    ...(c.name !== undefined && { name: c.name }),
    ...(c.legalName !== undefined && { legal_name: c.legalName }),
    ...(c.email !== undefined && { email: c.email }),
    ...(c.phoneE164 !== undefined && { phone_e164: c.phoneE164 }),
    ...(c.website !== undefined && { website: c.website }),
    ...(c.addressLine1 !== undefined && { address_line1: c.addressLine1 }),
    ...(c.addressLine2 !== undefined && { address_line2: c.addressLine2 }),
    ...(c.addressLine3 !== undefined && { address_line3: c.addressLine3 }),
    ...(c.city !== undefined && { city: c.city }),
    ...(c.state !== undefined && { state: c.state }),
    ...(c.pincode !== undefined && { pincode: c.pincode }),
    ...(c.lat !== undefined && { lat: c.lat }),
    ...(c.lng !== undefined && { lng: c.lng }),
    ...(c.logoFileId !== undefined && { logo_file_id: c.logoFileId }),
    ...(c.coverFileId !== undefined && { cover_file_id: c.coverFileId }),
    ...(c.stampFileId !== undefined && { stamp_file_id: c.stampFileId }),
  };
}

/** `HospitalSettingsUpdateSerializer` — every field optional; omitted keeps its value. */
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
  readonly receipt_paper?: string;
  readonly receipt_show_staff?: boolean;
  readonly patient_edit_requires_approval?: boolean;
  readonly display_show_full_name?: boolean;
  readonly desk_payment_methods?: readonly string[];
}

/** Only the keys present in `c` are sent. */
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
    ...(c.expectedConsultMinutes !== undefined &&
      c.expectedConsultMinutes !== null && { expected_consult_minutes: c.expectedConsultMinutes }),
    ...(c.patientNotesEnabled !== undefined && { patient_notes_enabled: c.patientNotesEnabled }),
    ...(c.receiptPaper !== undefined && { receipt_paper: c.receiptPaper }),
    ...(c.receiptShowStaff !== undefined && { receipt_show_staff: c.receiptShowStaff }),
    ...(c.patientEditRequiresApproval !== undefined && {
      patient_edit_requires_approval: c.patientEditRequiresApproval,
    }),
    ...(c.displayShowFullName !== undefined && { display_show_full_name: c.displayShowFullName }),
    ...(c.deskPaymentMethods !== undefined && { desk_payment_methods: c.deskPaymentMethods }),
  };
}

/** `TokenPolicyUpdateSerializer` — omitted fields keep their value. */
export interface TokenPolicyPutRequest {
  readonly scope?: string;
  readonly reset?: string;
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
  readonly print_template_id?: string | null;
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
    ...(c.printTemplateId !== undefined && { print_template_id: c.printTemplateId }),
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
