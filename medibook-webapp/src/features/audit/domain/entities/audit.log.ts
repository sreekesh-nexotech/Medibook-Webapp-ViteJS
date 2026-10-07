/**
 * Hospital audit-log entities (`GET /hospital/audit/log`). Plain readonly
 * types — no React, no Axios, no Zod.
 *
 * The backend writes one row per successful mutation (generic `http.<method>`
 * actions) plus richer domain rows (`doctor.created`, `service.updated`, …)
 * whose before/after values are masked before insert. Rows are append-only.
 */

/** Who made the request (backend `principal`). */
export type AuditPrincipal = 'patient' | 'hospital' | 'platform' | 'display' | 'system';

/** One changed field from the row's `diff`, values rendered as display strings. */
export interface AuditFieldChange {
  readonly field: string;
  /** Previous value, or `null` when the field was unset. */
  readonly before: string | null;
  /** New value, or `null` when the field was removed. */
  readonly after: string | null;
}

/** One top-level field of a row's `before`, `after` or `meta` snapshot, as display text. */
export interface AuditSnapshotField {
  readonly field: string;
  /** `null` when the value was empty. */
  readonly value: string | null;
}

/** One row of the hospital audit log. */
export interface AuditLogEntry {
  readonly id: string;
  /** ISO date-time the action happened (UTC offset included). */
  readonly occurredAt: string;
  readonly requestId: string;
  /** Known principal, or the raw value when the backend adds a new one. */
  readonly principal: AuditPrincipal | string;
  /** Staff user who acted; `null` for system tasks and display devices. */
  readonly actorUserId: string | null;
  readonly ip: string | null;
  /** HTTP method, or `TASK` for background jobs. */
  readonly method: string;
  readonly path: string;
  /** e.g. `http.patch`, `doctor.created`. */
  readonly action: string;
  /** e.g. `doctor`, `HospitalDoctorDetailView`. */
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly changes: readonly AuditFieldChange[];
  /** The masked snapshot before the change (domain rows only). */
  readonly before: readonly AuditSnapshotField[];
  /** The masked snapshot after the change (domain rows only). */
  readonly after: readonly AuditSnapshotField[];
  /** Context the backend attached (e.g. the record's MRN). */
  readonly meta: readonly AuditSnapshotField[];
  readonly statusCode: number;
}

/** Server-side sort the audit log accepts (`occurred_at` only). */
export type AuditLogSort = 'occurred_at' | '-occurred_at';

/** Filters shared by the list and the CSV export. Absent = no filter. */
export interface AuditLogFilters {
  /** Inclusive local date `yyyy-mm-dd`, in the hospital's timezone. */
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly actorUserId?: string;
  /** Exact action code, e.g. `http.delete`. */
  readonly action?: string;
  /** Exact entity, e.g. `hospital_patient`. */
  readonly resourceType?: string;
  /** Exact match on a request id, action, resource type, or a record / actor UUID. */
  readonly q?: string;
  readonly sort: AuditLogSort;
}

/** One page request of the audit log (`page` is 1-based, as the backend counts). */
export interface AuditLogPageQuery extends AuditLogFilters {
  readonly page: number;
  readonly pageSize: number;
}

/** The CSV the backend renders for the current filters. */
export interface AuditLogExport {
  readonly filename: string;
  readonly csv: string;
  /** The backend stopped at its row cap (`X-Export-Truncated`, UAT-40). */
  readonly isTruncated: boolean;
  readonly rowLimit: number | null;
}
