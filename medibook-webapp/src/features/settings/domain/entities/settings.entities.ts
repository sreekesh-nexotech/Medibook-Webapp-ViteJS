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

/** The hospital rulebook fields this screen edits (`GET /hospital/settings`). */
export interface HospitalRuleSettings {
  readonly bookingWindowDays: number;
  readonly holdTimeoutSeconds: number;
  readonly cancellationCutoffHours: number;
  readonly followUpWindowDays: number;
  /** Default consultation length, used for doctors without their own. */
  readonly expectedConsultMinutes: number | null;
  readonly version: number;
  readonly derived: HospitalRulesDerived;
}

export interface HospitalRuleChanges {
  readonly bookingWindowDays?: number;
  readonly holdTimeoutSeconds?: number;
  readonly cancellationCutoffHours?: number;
  readonly followUpWindowDays?: number;
}

/** One weekday of hospital hours. `weekday` 0 = Monday .. 6 = Sunday. */
export interface HospitalHoursDay {
  readonly weekday: number;
  readonly isClosed: boolean;
  /** `HH:MM` (24 h), `null` when closed. */
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

/** Which series a token number runs in. */
export type TokenScope = 'doctor' | 'department' | 'hospital';

/** The token-numbering policy (`GET /hospital/token-policy`). */
export interface TokenPolicy {
  /** The scope in force today. */
  readonly scope: TokenScope;
  /** A scope change waiting to apply, or `null`. */
  readonly pendingScope: TokenScope | null;
  /** ISO date the pending change applies from. */
  readonly pendingEffectiveDate: string | null;
  readonly version: number;
}

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
