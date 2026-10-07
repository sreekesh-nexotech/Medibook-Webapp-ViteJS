/** Ops platform report entities. Plain readonly types. */

/** File formats every platform report exports to (backend `engine.FORMATS`). */
export type OpsReportFormat = 'csv' | 'xlsx' | 'pdf';

/** How a column's values are typed (backend `engine.Column.kind`). Money is integer paise. */
export type OpsReportColumnKind =
  'str' | 'int' | 'paise' | 'bp' | 'percent' | 'date' | 'datetime' | 'bool';

export interface OpsReportColumn {
  readonly key: string;
  readonly label: string;
  readonly kind: OpsReportColumnKind;
}

/**
 * How a filter is entered (backend `engine.Filter.kind`): a `date_range`
 * takes `<x>_from` / `<x>_to`, a `uuid` one id, a `choice` one of `choices`.
 */
export type OpsReportFilterKind = 'date_range' | 'uuid' | 'choice' | 'str';

/** One of the binding sheet's filters, in the sheet's order and wording. */
export interface OpsReportFilter {
  readonly key: string;
  readonly label: string;
  readonly kind: OpsReportFilterKind;
  /** Query parameters it sets (two for a date range). */
  readonly params: readonly string[];
  readonly choices: readonly string[];
}

/** One registered platform report, as `GET /platform/reports` lists it. */
export interface OpsReportSummary {
  /** Stable snake_case id, e.g. `revenue`, `bookings`. */
  readonly code: string;
  readonly title: string;
  readonly filters: readonly OpsReportFilter[];
  readonly columns: readonly OpsReportColumn[];
  readonly formats: readonly OpsReportFormat[];
  /** Backend notes on nulls and metric definitions. */
  readonly notes: readonly string[];
}

/** Filter values by query parameter; blank values are not sent. */
export type OpsReportParams = Readonly<Record<string, string>>;

/** One cell value as the report envelope carries it. */
export type OpsReportValue = string | number | boolean | null;

export interface OpsReportKpi {
  readonly key: string;
  readonly label: string;
  readonly kind: OpsReportColumnKind;
  readonly value: OpsReportValue;
}

/** A run of one report: KPIs over every filtered row, and one page of rows. */
export interface OpsReportResult {
  readonly code: string;
  readonly title: string;
  readonly filtersApplied: Readonly<Record<string, unknown>>;
  readonly kpis: readonly OpsReportKpi[];
  readonly columns: readonly OpsReportColumn[];
  readonly rows: readonly Readonly<Record<string, OpsReportValue>>[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasNext: boolean;
  readonly notes: readonly string[];
}

/** Which page of a run, sorted how. */
export interface OpsReportRunQuery {
  readonly code: string;
  readonly params: OpsReportParams;
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
  /** A column key, `-` prefixed for descending; omitted = the report's default order. */
  readonly sort?: string;
}

/**
 * The outcome of an export request: the file itself, or an export queued on
 * the server (too many rows to render in the request) that the console polls
 * and the requester is emailed about.
 */
export type OpsReportExport =
  | { readonly status: 'file'; readonly filename: string; readonly blob: Blob }
  | { readonly status: 'processing'; readonly exportId: string; readonly rows: number };

/**
 * A queued export's progress (`GET /shared/files/{id}`, B7): not written yet
 * (`pending` — older backends answer 404 until it exists), ready to download
 * until `expiresAt`, failed, or expired (410).
 */
export type OpsExportFileState =
  | { readonly status: 'pending' }
  | { readonly status: 'ready'; readonly expiresAt: string | null; readonly name: string }
  | { readonly status: 'failed' }
  | { readonly status: 'expired' };

/* ---------------------------------------------------------------- schedules */

export type ReportScheduleScope = 'platform' | 'hospital';
export type ReportScheduleCadence = 'daily' | 'weekly';
/** Outcome of a schedule's last run (B7). */
export type ReportScheduleRunStatus = 'sent' | 'skipped' | 'failed';

/** An emailed report on a cadence (Q144, `/platform/report-schedules`). */
export interface ReportSchedule {
  readonly id: string;
  readonly reportCode: string;
  /** `null` when the code is no longer registered. */
  readonly reportTitle: string | null;
  readonly scope: ReportScheduleScope;
  readonly hospitalId: string | null;
  readonly cadence: ReportScheduleCadence;
  readonly format: OpsReportFormat;
  /** Staff emails; empty on a hospital schedule = its active admins at send time. */
  readonly recipients: readonly string[];
  readonly usesDefaultRecipients: boolean;
  readonly isActive: boolean;
  readonly lastSentAt: string | null;
  readonly lastRunAt: string | null;
  readonly lastStatus: ReportScheduleRunStatus | null;
  readonly lastError: string | null;
  /** Row version for `If-Match` (B7); `null` on a backend without it. */
  readonly version: number | null;
  readonly createdAt: string;
}

/** A new platform-scope schedule. */
export interface ReportScheduleDraft {
  readonly reportCode: string;
  readonly cadence: ReportScheduleCadence;
  readonly format: OpsReportFormat;
  readonly recipients: readonly string[];
  readonly isActive: boolean;
}

/** An edit of a schedule (scope and hospital are fixed). */
export interface ReportScheduleChanges {
  readonly reportCode?: string;
  readonly cadence?: ReportScheduleCadence;
  readonly format?: OpsReportFormat;
  readonly recipients?: readonly string[];
  readonly isActive?: boolean;
}

export interface ReportScheduleListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly scope: ReportScheduleScope | null;
  readonly activeOnly: boolean;
}
