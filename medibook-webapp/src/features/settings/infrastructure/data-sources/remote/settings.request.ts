import type {
  BankAccountInput,
  HospitalHoursDay,
  HospitalProfileChanges,
  HospitalRuleChanges,
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
  readonly hold_timeout_seconds?: number;
  readonly cancellation_cutoff_hours?: number;
  readonly follow_up_window_days?: number;
}

export function toSettingsPutRequest(c: HospitalRuleChanges): HospitalSettingsPutRequest {
  return {
    ...(c.bookingWindowDays !== undefined && { booking_window_days: c.bookingWindowDays }),
    ...(c.holdTimeoutSeconds !== undefined && { hold_timeout_seconds: c.holdTimeoutSeconds }),
    ...(c.cancellationCutoffHours !== undefined && {
      cancellation_cutoff_hours: c.cancellationCutoffHours,
    }),
    ...(c.followUpWindowDays !== undefined && { follow_up_window_days: c.followUpWindowDays }),
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
