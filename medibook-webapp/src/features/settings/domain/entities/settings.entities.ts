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
  readonly website: string | null;
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
  /** The receipt stamp image (Q98), printed on receipts. */
  readonly stampFileId: string | null;
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
  readonly legalName?: string | null;
  readonly email?: string;
  readonly phoneE164?: string;
  readonly website?: string | null;
  readonly addressLine1?: string;
  readonly addressLine2?: string | null;
  readonly addressLine3?: string | null;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly logoFileId?: string | null;
  readonly coverFileId?: string | null;
  readonly stampFileId?: string | null;
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
  /** "Tokens can be cancelled until they are called." */
  readonly tokenCancelRule: string | null;
}

/** Receipt paper sizes the backend prints on. */
export type ReceiptPaper = 'A5' | '80mm' | 'A4';

/** The hospital rulebook (`GET /hospital/settings`) — every field the API edits. */
export interface HospitalRuleSettings {
  readonly bookingWindowDays: number;
  /** Q90: online bookings wait for the hospital's approval. */
  readonly onlineRequiresApproval: boolean;
  readonly holdTimeoutSeconds: number;
  readonly cancellationCutoffHours: number;
  /** Refund % for a cancellation before / after the cut-off, in basis points (Q10). */
  readonly refundBeforeCutoffBp: number;
  readonly refundAfterCutoffBp: number;
  readonly refundIncludesConvenienceFee: boolean;
  readonly followUpWindowDays: number;
  /** Q27: skips after which the desk is offered No-show (never automatic). */
  readonly noShowCallAttempts: number;
  /** Q23: minutes before the session a token may still be cancelled; `null` = until called. */
  readonly tokenCancelLimitMin: number | null;
  /** Default consultation length, used for doctors without their own (Q29). */
  readonly expectedConsultMinutes: number | null;
  readonly patientNotesEnabled: boolean;
  readonly receiptPaper: ReceiptPaper;
  readonly receiptShowStaff: boolean;
  /** D-29: desk edits of a patient record wait for an admin's approval. */
  readonly patientEditRequiresApproval: boolean;
  /** Display screen shows full names instead of "first name + last initial". */
  readonly displayShowFullName: boolean;
  /**
   * Desk payment methods the hospital accepts (APPT-03), or `null` when the
   * backend does not offer the setting yet.
   */
  readonly deskPaymentMethods: readonly string[] | null;
  readonly version: number;
  readonly derived: HospitalRulesDerived;
}

/** A rulebook update. Omitted fields keep their value. */
export type HospitalRuleChanges = Partial<
  Omit<HospitalRuleSettings, 'version' | 'derived' | 'deskPaymentMethods'>
> & {
  readonly deskPaymentMethods?: readonly string[];
};

/** One weekday of hospital hours. `weekday` 0 = Monday .. 6 = Sunday. */
export interface HospitalHoursDay {
  readonly weekday: number;
  readonly isClosed: boolean;
  /** `HH:MM` (24 h), `null` when closed. */
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

/** Which series a token number runs in (O-01 default: doctor). */
export type TokenScope = 'doctor' | 'department' | 'hospital';

/** When a token sequence starts again at 1. */
export type TokenReset = 'session' | 'day';

/** The token-numbering policy (`GET /hospital/token-policy`, D-15, Q18–24). */
export interface TokenPolicy {
  /** The scope in force today. */
  readonly scope: TokenScope;
  readonly reset: TokenReset;
  /** Label format: `{PREFIX} {SEQ:n} {SRC} {DOC} {DEPT} {DATE:DDMM}`. */
  readonly format: string;
  readonly prefix: string;
  /** `{SRC}` for online and desk tokens (Q20). */
  readonly onlineMarker: string;
  readonly offlineMarker: string;
  /** Q21: online and desk tokens draw from separate number ranges. */
  readonly separateRanges: boolean;
  readonly onlineRangeStart: number | null;
  readonly onlineRangeEnd: number | null;
  readonly offlineRangeStart: number | null;
  readonly offlineRangeEnd: number | null;
  /** Q23–24: a cancelled, uncalled token number is issued again. */
  readonly reuseCancelled: boolean;
  readonly printTemplateId: string | null;
  /** A scope change waiting to apply, or `null`. */
  readonly pendingScope: TokenScope | null;
  readonly pendingReset: TokenReset | null;
  /** ISO date the pending change applies from. */
  readonly pendingEffectiveDate: string | null;
  readonly version: number;
}

/** A token-policy update; `scope`/`reset` apply from tomorrow, the rest now. */
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
    | 'printTemplateId'
  >
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

/** The hospital images this screen manages (the stamp prints on receipts, Q98). */
export type HospitalImagePurpose = 'logo' | 'cover' | 'stamp';

/* --------------------------------------------------------------- numbering */

/** The series a hospital edits (D-25/D-26); others are platform-scoped. */
export type NumberingKind = 'mrn' | 'booking' | 'receipt';

export type NumberingReset = 'never' | 'fiscal_year' | 'calendar_year' | 'monthly';

/** One numbering series (`GET /hospital/numbering`). */
export interface NumberingSeries {
  readonly kind: string;
  /** `{PREFIX} {SEQ:n} {FY} {YY} {YYYY} {MM}`. */
  readonly format: string;
  readonly prefix: string | null;
  readonly separator: string | null;
  readonly padWidth: number;
  readonly reset: string;
  readonly fyStartMonth: number;
  readonly gapless: boolean;
  /** O-02 default: `hospital_admin` may edit; `platform` / `none` may not. */
  readonly editableBy: string;
  /** MRN after its first allocation: the format can no longer change (409 NUMBERING_LOCKED). */
  readonly locked: boolean;
  readonly hasAllocated: boolean;
  /** The next number as the server would issue it now. */
  readonly nextPreview: string;
  /** "Changing a format never rewrites numbers already issued…" (D-26). */
  readonly warning: string;
  readonly version: number;
}

export interface NumberingChanges {
  readonly format?: string;
  readonly prefix?: string | null;
  readonly separator?: string | null;
  readonly padWidth?: number;
  readonly reset?: NumberingReset;
  readonly fyStartMonth?: number;
}

/* ---------------------------------------------------------------- counters */

/** A front-desk counter; its code prints on receipts (`/hospital/counters`). */
export interface Counter {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly version: number;
}

export interface CounterInput {
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
}

/* --------------------------------------------------------- print templates */

export type PrintTemplateKind = 'token_slip' | 'receipt';

/** A receipt or token-slip layout (`/hospital/print-templates`, Q22). */
export interface PrintTemplate {
  readonly id: string;
  readonly kind: PrintTemplateKind;
  readonly name: string;
  readonly paper: ReceiptPaper;
  readonly templateHtml: string;
  readonly isDefault: boolean;
  readonly version: number;
}

export interface PrintTemplateInput {
  readonly kind: PrintTemplateKind;
  readonly name: string;
  readonly paper: ReceiptPaper;
  readonly templateHtml: string;
  readonly isDefault: boolean;
}

/** A template rendered with sample data (never real patients). */
export interface PrintPreview {
  readonly html: string;
  readonly paper: string;
  /** `null` until the server's PDF renderer is available. */
  readonly pdfBase64: string | null;
}

/* --------------------------------------------------------- display devices */

/** A token display screen (`/hospital/display-devices`, O-10). The key hash is never sent. */
export interface DisplayDevice {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly selectedDoctorIds: readonly string[];
  readonly selectedCounterIds: readonly string[];
  readonly lastSeenAt: string | null;
  readonly version: number;
}

/** A device with its raw key — returned once, on register and on rotate. */
export interface DisplayDeviceWithKey {
  readonly device: DisplayDevice;
  readonly deviceKey: string;
}

export interface DisplayDeviceChanges {
  readonly name?: string;
  readonly isActive?: boolean;
  readonly selectedDoctorIds?: readonly string[];
  readonly selectedCounterIds?: readonly string[];
}
