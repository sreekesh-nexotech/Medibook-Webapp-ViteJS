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
  readonly principal: LoginPrincipal | null;
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
  readonly occurredAt: string;
}

/** Server-side filters for the change log. */
export interface ConfigChangeFilters extends ComplianceDateRange {
  readonly scope: ConfigScope | null;
  /** Leading part of the setting key, e.g. `plan.`. */
  readonly settingKeyPrefix: string | null;
}

export type ConfigChangeSortField = 'occurred_at' | 'setting_key';

export interface ConfigChangeParams extends ConfigChangeFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly sortField: ConfigChangeSortField;
  readonly sortDirection: ComplianceSortDirection;
}

export type DataSubjectKind = 'patient' | 'hospital_staff' | 'hospital';

export type DataRequestKind = 'export' | 'deletion' | 'rectification' | 'percent';

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
  readonly requestedAt: string;
  readonly dueAt: string;
  readonly completedAt: string | null;
  /** The prepared export, once there is one. */
  readonly exportFileId: string | null;
  readonly notes: string | null;
}

/** Paging for the DSR register. */
export interface DataRequestParams {
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
