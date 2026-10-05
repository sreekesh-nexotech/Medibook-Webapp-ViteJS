/** Ops platform report entities. Plain readonly types. */

/** File formats every platform report exports to (backend `engine.FORMATS`). */
export type OpsReportFormat = 'csv' | 'xlsx' | 'pdf';

/** How a column's values are typed (backend `engine.Column.kind`). */
export type OpsReportColumnKind =
  'str' | 'int' | 'paise' | 'bp' | 'percent' | 'date' | 'datetime' | 'bool';

export interface OpsReportColumn {
  readonly key: string;
  readonly label: string;
  readonly kind: OpsReportColumnKind;
}

/** One registered platform report, as `GET /platform/reports` lists it. */
export interface OpsReportSummary {
  /** Stable snake_case id, e.g. `revenue`, `bookings`. */
  readonly code: string;
  readonly title: string;
  readonly columns: readonly OpsReportColumn[];
  readonly formats: readonly OpsReportFormat[];
  /** Backend notes on nulls and metric definitions. */
  readonly notes: readonly string[];
}

/**
 * The outcome of an export request: the file itself (≤ 50k rows), or an
 * export queued on the server that is emailed to the requester when ready.
 */
export type OpsReportExport =
  | { readonly status: 'file'; readonly filename: string; readonly content: string }
  | { readonly status: 'processing'; readonly exportId: string; readonly rows: number };
