/**
 * A hospital's numbering series and token policy, as the platform overrides
 * them (`/platform/hospitals/{id}/numbering/{kind}`, `…/token-policy`;
 * D-15, D-25, D-26). Plain readonly types.
 */

/** The hospital-scoped series ops may override (MRN, booking reference, receipt). */
export type NumberingKind = 'mrn' | 'booking' | 'receipt';

export type NumberingReset = 'never' | 'fiscal_year' | 'calendar_year' | 'monthly';

/** Who may edit a series later (O-02: set at onboarding, platform decides). */
export type NumberingEditableBy = 'platform' | 'hospital_admin' | 'none';

export interface NumberingSeries {
  readonly kind: string;
  /** Tokens `{PREFIX} {SEQ:n} {FY} {YY} {YYYY} {MM}`. */
  readonly format: string;
  readonly prefix: string | null;
  readonly reset: string;
  readonly fyStartMonth: number;
  readonly gapless: boolean;
  readonly editableBy: string;
  /** MRN format is fixed once the first number was issued (`409 NUMBERING_LOCKED`). */
  readonly locked: boolean;
  readonly hasAllocated: boolean;
  /** What the next number will look like. */
  readonly nextPreview: string;
  /** Server reminder that issued numbers are never rewritten. */
  readonly warning: string;
  readonly version: number;
}

export interface NumberingChange {
  readonly format?: string;
  readonly prefix?: string | null;
  readonly reset?: NumberingReset;
  readonly editableBy?: NumberingEditableBy;
}

/** Token sequence scope (O-01 default `doctor`). */
export type TokenScope = 'doctor' | 'department' | 'hospital';

/** When the token sequence starts again. */
export type TokenReset = 'session' | 'day';

export interface TokenPolicy {
  readonly scope: string;
  readonly reset: string;
  /** Tokens `{PREFIX} {SRC} {SEQ:n} {DOC} {DEPT} {DATE:DDMM}`. */
  readonly format: string;
  readonly prefix: string;
  readonly onlineMarker: string;
  readonly offlineMarker: string;
  readonly separateRanges: boolean;
  readonly onlineRangeStart: number | null;
  readonly onlineRangeEnd: number | null;
  readonly offlineRangeStart: number | null;
  readonly offlineRangeEnd: number | null;
  readonly reuseCancelled: boolean;
  /** A scope/reset change waiting for tomorrow (hospital-local), if any. */
  readonly pending: {
    readonly scope: string | null;
    readonly reset: string | null;
    readonly effectiveDate: string | null;
  } | null;
  readonly version: number;
}

export interface TokenPolicyChange {
  readonly scope?: TokenScope;
  readonly reset?: TokenReset;
  readonly format?: string;
  readonly prefix?: string;
  readonly onlineMarker?: string;
  readonly offlineMarker?: string;
  readonly reuseCancelled?: boolean;
  readonly separateRanges?: boolean;
  readonly onlineRangeStart?: number | null;
  readonly onlineRangeEnd?: number | null;
  readonly offlineRangeStart?: number | null;
  readonly offlineRangeEnd?: number | null;
}
