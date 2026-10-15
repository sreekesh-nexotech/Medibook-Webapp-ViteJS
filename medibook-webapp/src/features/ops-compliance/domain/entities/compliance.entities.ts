/**
 * Compliance records as the platform API serves them
 * (`/platform/compliance/*`, audit 2.5 / SA-06): sign-in events, the
 * configuration-change log with before → after values, and data-subject
 * requests. Timestamps are ISO date-times; date filters are ISO dates that
 * the server reads in IST.
 */

export const LOGIN_RESULTS = [
  'success',
  'failed',
  'locked',
  'mfa_required',
  'mfa_failed',
  'otp_failed',
  'blocked',
] as const;

export type LoginResult = (typeof LOGIN_RESULTS)[number];

/** Which surface the sign-in was against. */
export type LoginPrincipal = 'patient' | 'hospital' | 'platform' | 'display';

/** One sign-in attempt. */
export interface LoginEvent {
  readonly id: string;
  /** `null` when the identifier matched no account. */
  readonly userId: string | null;
  /** Email or phone the attempt was made with. */
  readonly identifier: string;
  readonly principal: string;
  /** Hospital instance, or `null` for the console and patient app. */
  readonly hospitalId: string | null;
  /** The hospital's name when the backend sends it (B6), so no registry read is needed. */
  readonly hospitalName: string | null;
  readonly result: LoginResult;
  readonly ip: string;
  readonly userAgent: string | null;
  readonly occurredAt: string;
}

/** Shared date window, ISO `yyyy-mm-dd`; empty = open-ended. */
export interface ComplianceDateRange {
  readonly dateFrom: string;
  readonly dateTo: string;
}

export type ComplianceSortDirection = 'asc' | 'desc';

/** Server-side filters for the sign-in history. */
export interface LoginHistoryFilters extends ComplianceDateRange {
  readonly result: LoginResult | null;
  readonly hospitalId: string | null;
  /** Any of these surfaces; empty = all (several need B6's multi-value `principal`). */
  readonly principals: readonly LoginPrincipal[];
}

export interface LoginHistoryParams extends LoginHistoryFilters {
  /** One-based. */
  readonly page: number;
  readonly pageSize: number;
  readonly sortDirection: ComplianceSortDirection;
}

export type ConfigScope = 'platform' | 'hospital';

/** One configuration change, with the values on both sides of it. */
export interface ConfigChangeRecord {
  readonly id: string;
  readonly scope: ConfigScope;
  readonly hospitalId: string | null;
  /** Dotted key, e.g. `plan.growth.is_active`. */
  readonly settingKey: string;
  /** Raw JSON values; `null` when the setting was unset on that side. */
  readonly beforeValue: unknown;
  readonly afterValue: unknown;
  readonly actorUserId: string;
  /** Who made the change, when the backend names them (B6). */
  readonly actorName: string | null;
  /** The hospital's name for hospital-scope changes, when the backend sends it (B6). */
  readonly hospitalName: string | null;
  readonly occurredAt: string;
}

/** Server-side filters for the change log. */
export interface ConfigChangeFilters extends ComplianceDateRange {
  readonly scope: ConfigScope | null;
  /** Leading part of the setting key, e.g. `plan.`. */
  readonly settingKeyPrefix: string | null;
  /** One hospital's changes. */
  readonly hospitalId: string | null;
}

export type ConfigChangeSortField = 'occurred_at' | 'setting_key';

export interface ConfigChangeParams extends ConfigChangeFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly sortField: ConfigChangeSortField;
  readonly sortDirection: ComplianceSortDirection;
}

export type DataSubjectKind = 'patient' | 'hospital_staff' | 'hospital';

export type DataRequestKind = 'export' | 'deletion' | 'rectification';

export const DATA_REQUEST_KINDS: readonly DataRequestKind[] = [
  'export',
  'deletion',
  'rectification',
];

export const DATA_SUBJECT_KINDS: readonly DataSubjectKind[] = [
  'patient',
  'hospital_staff',
  'hospital',
];

export const DATA_REQUEST_STATUSES = [
  'requested',
  'cooling_off',
  'verifying',
  'processing',
  'completed',
  'rejected',
  'no_data',
  'withdrawn',
] as const;

export type DataRequestStatus = (typeof DATA_REQUEST_STATUSES)[number];

/** One data-subject request (DSR). */
export interface DataRequest {
  readonly id: string;
  /** Human reference, e.g. `DSR-2026-000004`. */
  readonly requestNo: string;
  readonly subjectKind: DataSubjectKind;
  readonly subjectUserId: string | null;
  readonly hospitalId: string | null;
  readonly kind: DataRequestKind;
  readonly status: DataRequestStatus;
  readonly requestedByKind: string;
  readonly requestedById: string | null;
  readonly requestedAt: string;
  /** End of the D-24 cooling-off (deletion requests); `null` otherwise. */
  readonly coolingOffEndsAt: string | null;
  readonly dueAt: string;
  readonly completedAt: string | null;
  /** The prepared export, once there is one. */
  readonly exportFileId: string | null;
  readonly notes: string | null;
  /** What an export deliberately left out (medical documents, insurance — Q123), free-form. */
  readonly retentionCarveOut: unknown;
  /** Display name and masked contact of the subject, when the backend sends them (B6). */
  readonly subjectName: string | null;
  readonly subjectContact: string | null;
  readonly hospitalName: string | null;
  readonly requestedByName: string | null;
  /**
   * What compliance may do with it now (B6, UAT-54): `process` (prepare the
   * export / mark the rectification done) and `reject`; `null` when the
   * server does not say, and the console falls back to its own rules.
   */
  readonly allowedActions: readonly DataRequestAction[] | null;
}

export type DataRequestAction = 'process' | 'reject';

/** Server-side filters on the DSR register. */
export interface DataRequestFilters {
  /** Any of these statuses; empty = all. */
  readonly statuses: readonly DataRequestStatus[];
  readonly kind: DataRequestKind | null;
  readonly subjectKind: DataSubjectKind | null;
  /** Exact request number, e.g. `DSR-2026-000004` (B6). */
  readonly requestNo?: string;
  /** Requested on or after / before, `yyyy-mm-dd` IST (B6). */
  readonly dateFrom?: string;
  readonly dateTo?: string;
}

/** One page of the DSR register. */
export interface DataRequestParams extends DataRequestFilters {
  readonly page: number;
  readonly pageSize: number;
}

/** Filing an export request for one account. */
export interface DataExportDraft {
  readonly subjectUserId: string;
  readonly subjectKind: Exclude<DataSubjectKind, 'hospital'>;
  /** Replay key, minted once per user intent. */
  readonly idempotencyKey: string;
}

/**
 * What processing did: prepared now, or left for the nightly worker because
 * the export renderer is not available to a live request (HTTP 501).
 */
export type DataRequestProcessOutcome =
  { readonly status: 'processed'; readonly request: DataRequest } | { readonly status: 'deferred' };

/** A capped walk over every page of a list, for CSV export. */
export interface ComplianceExportRows<T> {
  readonly rows: readonly T[];
  /** True when the cap stopped the walk before the last page. */
  readonly truncated: boolean;
}

/* -------------------------------------------------- PHI read audit (B6, H-07) */

/** What a logged read returned: a hospital's patient record, an appointment, or a patient account. */
export const PHI_SUBJECT_KINDS = ['hospital_patient', 'appointment', 'user'] as const;

export type PhiSubjectKind = (typeof PHI_SUBJECT_KINDS)[number];

export const PHI_PRINCIPALS = ['hospital', 'platform'] as const;

export type PhiPrincipal = (typeof PHI_PRINCIPALS)[number];

/** One successful read of patient-identifying data (`phi_access_log`). */
export interface PhiAccessEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly requestId: string;
  readonly principal: string;
  readonly actorUserId: string | null;
  readonly actorName: string | null;
  /** The reader's hospital, for hospital staff. */
  readonly hospitalId: string | null;
  readonly hospitalName: string | null;
  readonly ip: string | null;
  readonly method: string;
  /** The URL route read, e.g. `hospital/patients/<uuid:patient_id>`. */
  readonly endpoint: string;
  readonly subjectKind: PhiSubjectKind;
  readonly subjectIds: readonly string[];
  readonly resultCount: number;
  /** Which query parameter carried a search, when the read was a search (the term is never kept). */
  readonly searchParam: string | null;
}

/** Server-side filters on the PHI read audit. */
export interface PhiAccessFilters extends ComplianceDateRange {
  /** Any of these; empty = both. */
  readonly principals: readonly PhiPrincipal[];
  readonly subjectKind: PhiSubjectKind | null;
  readonly hospitalId: string | null;
  /** Full user id (UUID) of the reader. */
  readonly actorUserId: string | null;
  /** Full id (UUID) of a record that appears in the read's results. */
  readonly subjectId: string | null;
  /** A plain search term; the server hashes it and finds reads that searched for it. */
  readonly search: string | null;
}

export interface PhiAccessParams extends PhiAccessFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly sortDirection: ComplianceSortDirection;
}

/* ------------------------------------------- hospital staff lookup (B9, BE-30) */

/** A hospital staff membership found by `GET /platform/hospital-staff`. */
export interface StaffDirectoryEntry {
  readonly staffId: string;
  /** The account a data-subject request names. */
  readonly userId: string;
  readonly fullName: string;
  /** Masked unless the caller holds `platform_users.edit`. */
  readonly email: string | null;
  readonly phone: string | null;
  readonly employeeCode: string | null;
  readonly status: string;
  readonly hospitalName: string | null;
  readonly roleName: string | null;
}
