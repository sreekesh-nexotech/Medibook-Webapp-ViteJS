/**
 * Hospital reports from the backend's report engine (`reports/services/engine.py`).
 * Every report is described by the server — its filters, columns and KPIs —
 * and the same definition drives the JSON read and the file exports.
 *
 * Money is whole rupees here (`kind: 'rupees'`); the paise the API uses never
 * leave the infrastructure layer.
 */

/** How a column or KPI value is meant to be read. */
export type ReportValueKind =
  'str' | 'int' | 'rupees' | 'bp' | 'percent' | 'date' | 'datetime' | 'bool';

/** One cell or KPI value; `null` is a documented gap (see the report notes). */
export type ReportValue = string | number | boolean | null;

/** How a filter is entered. A `date_range` takes two params: `<x>_from`, `<x>_to`. */
export type ReportFilterKind = 'date_range' | 'uuid' | 'choice' | 'str';

export interface ReportFilterDef {
  /** Filter identity, e.g. `date`, `doctor`, `status`. */
  readonly key: string;
  /** The binding sheet's wording, e.g. "Booking date". */
  readonly label: string;
  readonly kind: ReportFilterKind;
  /** Query params this filter fills, in order (`[from, to]` for a range). */
  readonly params: readonly string[];
  /** Allowed raw values of a `choice` filter (empty otherwise). */
  readonly choices: readonly string[];
}

export interface ReportColumnDef {
  readonly key: string;
  readonly label: string;
  readonly kind: ReportValueKind;
}

export type ReportExportFormat = 'csv' | 'xlsx' | 'pdf';

/** One entry of the report catalogue. */
export interface ReportDefinition {
  /** Stable code, e.g. `appointment`, `doctor_performance`. */
  readonly code: string;
  readonly title: string;
  readonly filters: readonly ReportFilterDef[];
  readonly columns: readonly ReportColumnDef[];
  readonly formats: readonly ReportExportFormat[];
  /** Metric definitions and documented nulls. */
  readonly notes: readonly string[];
}

export interface ReportKpiValue {
  readonly key: string;
  readonly label: string;
  readonly kind: ReportValueKind;
  readonly value: ReportValue;
}

export type ReportRow = Readonly<Record<string, ReportValue>>;

export type SortDirection = 'asc' | 'desc';

export interface ReportSort {
  /** Column key. */
  readonly key: string;
  readonly dir: SortDirection;
}

/** Filter query params → value; blank values are left out of the request. */
export type ReportParams = Readonly<Record<string, string>>;

/** One page of one report. */
export interface ReportQuery {
  readonly code: string;
  readonly params: ReportParams;
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
  /** `null` = the report's own default order. */
  readonly sort: ReportSort | null;
}

/** One page of a report, with KPIs over every filtered row (not just the page). */
export interface ReportResult {
  readonly code: string;
  readonly title: string;
  readonly kpis: readonly ReportKpiValue[];
  readonly columns: readonly ReportColumnDef[];
  readonly rows: readonly ReportRow[];
  readonly page: number;
  readonly pageSize: number;
  /** Filtered rows across all pages. */
  readonly total: number;
  readonly hasNext: boolean;
  readonly notes: readonly string[];
}

export interface ReportExportRequest {
  readonly code: string;
  readonly params: ReportParams;
  readonly sort: ReportSort | null;
  readonly format: ReportExportFormat;
}

/**
 * An export is either the file itself, or — above the server's synchronous
 * row limit — queued: the backend builds it in the background, emails the
 * requester a link, and the screen follows it by `exportId` (UAT-67).
 */
export type ReportExport =
  | { readonly kind: 'file'; readonly file: Blob; readonly filename: string }
  | { readonly kind: 'queued'; readonly exportId: string; readonly rows: number | null };

/** Where a queued export stands. */
export type ReportExportStatus =
  /** Still being built (or, on an older backend, not readable until built). */
  | 'pending'
  /** Built and downloadable until `expiresAt`. */
  | 'ready'
  /** The build failed; export again. */
  | 'failed'
  /** Past its expiry; export again. */
  | 'expired';

/**
 * A finished export an emailed link points at (`/shared/files/{id}`). The
 * backend stores it as an `export` file and emails `…/reports/downloads/{id}`.
 */
export interface ReportExportFile {
  readonly id: string;
  /** The file name the server gave it, e.g. `appointments.csv`. */
  readonly name: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  /** When the file stops being available; `null` when it does not expire. */
  readonly expiresAt: string | null;
  readonly status: ReportExportStatus;
}
