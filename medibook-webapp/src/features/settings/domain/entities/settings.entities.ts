/**
 * Hospital Settings entities (module H2) — what the hospital's own profile,
 * rulebook, hours, token policy and payout account look like to the app.
 * Plain readonly types: no Zod, no Axios, no React.
 */

/** The hospital's own profile row (`GET /hospital/profile`). */
export interface HospitalProfile {
  readonly id: string;
  readonly name: string;
  readonly legalName: string | null;
  /** Platform-managed: shown, never edited from the hospital app. */
  readonly gstin: string | null;
  /** Platform-managed: shown, never edited from the hospital app. */
  readonly registrationNo: string | null;
  readonly email: string;
  /** E.164, e.g. `+918045678900`. */
  readonly phoneE164: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly addressLine3: string | null;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly logoFileId: string | null;
  readonly coverFileId: string | null;
  /** Platform-managed switch for booking from the patient app. */
  readonly onlineBookingEnabled: boolean;
  /** IANA time zone (e.g. `Asia/Kolkata`); `null` from an older backend. */
  readonly timezone: string | null;
  /** Row version, sent back as `If-Match`. */
  readonly version: number;
}

/** The profile fields the hospital may change. Omitted fields keep their value. */
export interface HospitalProfileChanges {
  readonly name?: string;
  readonly email?: string;
  readonly phoneE164?: string;
  readonly addressLine1?: string;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly logoFileId?: string | null;
  readonly coverFileId?: string | null;
}

/** Slots a doctor's weekly session holds, across the hospital's active doctors. */
export interface SlotsPerSessionEstimate {
  readonly min: number;
  readonly max: number;
  readonly avg: number;
}

/** The server-computed consequences of the saved rules (never stored). */
export interface HospitalRulesDerived {
  readonly bookingWindowEndDate: string | null;
  readonly cancellationExample: string | null;
  /** `null` while no active doctor has a weekly session. */
  readonly slotsPerSessionEstimate: SlotsPerSessionEstimate | null;
}

/**
 * The hospital rulebook (`GET /hospital/settings`). Refund shares are basis
 * points: 10000 = 100%. (`receipt_paper` and `receipt_show_staff` are left out:
 * the backend stores them but nothing reads them — PRD-06-B.)
 */
export interface HospitalRuleSettings {
  readonly bookingWindowDays: number;
  /** Online bookings wait for the desk to approve them. */
  readonly onlineRequiresApproval: boolean;
  readonly holdTimeoutSeconds: number;
  readonly cancellationCutoffHours: number;
  /** Refund when the patient cancels before the cut-off. */
  readonly refundBeforeCutoffBp: number;
  /** Refund when the patient cancels after the cut-off. */
  readonly refundAfterCutoffBp: number;
  /** Whether a patient's refund includes the convenience fee. */
  readonly refundIncludesConvenienceFee: boolean;
  readonly followUpWindowDays: number;
  /** Missed calls after which the desk is offered a no-show. */
  readonly noShowCallAttempts: number;
  /** A token can be cancelled until this many minutes before its session; `null` = until called. */
  readonly tokenCancelLimitMin: number | null;
  /** Default minutes per token for wait estimates; a doctor's own value wins. */
  readonly expectedConsultMinutes: number;
  /** Patients may add a note when they book. */
  readonly patientNotesEnabled: boolean;
  /** A desk edit to a patient's details waits for approval. */
  readonly patientEditRequiresApproval: boolean;
  /** The queue display shows full names, not first name and last initial. */
  readonly displayShowFullName: boolean;
  readonly version: number;
  readonly derived: HospitalRulesDerived;
}

/** The rules to change. Omitted fields keep their value. */
export type HospitalRuleChanges = Partial<Omit<HospitalRuleSettings, 'version' | 'derived'>>;

/** One weekday of hospital hours. `weekday` 0 = Monday .. 6 = Sunday. */
export interface HospitalHoursDay {
  readonly weekday: number;
  readonly isClosed: boolean;
  /** `HH:MM` (24 h), `null` when closed. */
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

/** Which counter a token number comes from. It does not change how the token looks. */
export type TokenScope = 'doctor' | 'department' | 'hospital';

/** When token numbers start again from the first. */
export type TokenReset = 'session' | 'day';

/** The token-numbering policy (`GET /hospital/token-policy`). */
export interface TokenPolicy {
  /** The scope in force today. */
  readonly scope: TokenScope;
  /** The reset in force today. */
  readonly reset: TokenReset;
  /** Label template, e.g. `{SRC}{SEQ:3}` (backend `render_label`). */
  readonly format: string;
  readonly prefix: string;
  /** What `{SRC}` prints for an online booking. */
  readonly onlineMarker: string;
  /** What `{SRC}` prints for a walk-in. */
  readonly offlineMarker: string;
  /** Online and walk-in tokens draw from their own number ranges. */
  readonly separateRanges: boolean;
  readonly onlineRangeStart: number | null;
  readonly onlineRangeEnd: number | null;
  readonly offlineRangeStart: number | null;
  readonly offlineRangeEnd: number | null;
  /** A cancelled token's number is given out again. */
  readonly reuseCancelled: boolean;
  /** A scope change waiting to apply, or `null`. */
  readonly pendingScope: TokenScope | null;
  /** A reset change waiting to apply, or `null`. */
  readonly pendingReset: TokenReset | null;
  /** ISO date the pending change applies from. */
  readonly pendingEffectiveDate: string | null;
  readonly version: number;
}

/** Token policy fields to change. Scope and reset apply from tomorrow; the rest at once. */
export type TokenPolicyChanges = Partial<
  Pick<
    TokenPolicy,
    | 'scope'
    | 'reset'
    | 'format'
    | 'prefix'
    | 'onlineMarker'
    | 'offlineMarker'
    | 'separateRanges'
    | 'onlineRangeStart'
    | 'onlineRangeEnd'
    | 'offlineRangeStart'
    | 'offlineRangeEnd'
    | 'reuseCancelled'
  >
>;

/** The hospital's own number series. */
export type NumberingKind = 'mrn' | 'booking' | 'receipt';

/** When a series starts again from 1. */
export type NumberingReset = 'never' | 'fiscal_year' | 'calendar_year' | 'monthly';

/** One number series (`GET /hospital/numbering`). */
export interface NumberingSeries {
  readonly kind: NumberingKind;
  /** e.g. `{PREFIX}/{FY}/{SEQ:5}` (backend `numbering.render`). */
  readonly format: string;
  readonly prefix: string | null;
  /** Digits `{SEQ}` pads to; `{SEQ:n}` pads to n instead. */
  readonly padWidth: number;
  readonly reset: NumberingReset;
  /** 1 = January: when the financial year starts, for `{FY}` and fiscal-year resets. */
  readonly fyStartMonth: number;
  /** Numbers never skip (receipts). */
  readonly gapless: boolean;
  /** False when only Medibook may change the series. */
  readonly hospitalEditable: boolean;
  /** MRNs lock once the first one has been issued. */
  readonly locked: boolean;
  /** The next number, as the saved format renders it. */
  readonly nextPreview: string;
  readonly version: number;
}

/** Series fields to change. A new format applies to numbers issued from now on. */
export type NumberingChanges = Partial<
  Pick<NumberingSeries, 'format' | 'prefix' | 'padWidth' | 'reset' | 'fyStartMonth'>
>;

/** A payout bank account. The full number is never returned — last 4 only. */
export interface BankAccount {
  readonly id: string;
  readonly accountHolder: string;
  readonly accountLast4: string;
  readonly ifsc: string;
  readonly bankName: string;
  readonly upiId: string | null;
  readonly isPrimary: boolean;
  readonly verifiedAt: string | null;
  readonly version: number;
}

/** Create / update a payout account. `accountNumber` omitted = keep the stored one. */
export interface BankAccountInput {
  readonly accountHolder: string;
  readonly accountNumber?: string;
  readonly ifsc: string;
  readonly bankName: string;
  readonly upiId: string | null;
}

/** The two hospital images this screen manages. */
export type HospitalImagePurpose = 'logo' | 'cover';
