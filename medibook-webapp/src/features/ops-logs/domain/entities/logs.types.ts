/**
 * Platform audit-trail entities (`GET /platform/logs`, backend `audit_log`).
 * Rows are masked server-side before insert; the trail is append-only and
 * archived, never purged (3 years hot, Q122).
 */

/** Who acted (backend `audit_log.principal`). */
export type AuditPrincipal = 'patient' | 'hospital' | 'platform' | 'display' | 'system';

/** Severity of an audit entry, when the backend records one (B6). */
export type LogSeverity = 'info' | 'warning' | 'critical';

/** One field's before → after, read from the entry's `diff`. */
export interface AuditFieldChange {
  readonly field: string;
  /** Display text (strings as-is, the rest as JSON); `null` when absent. */
  readonly before: string | null;
  readonly after: string | null;
}

/** One `audit_log` row as the Compliance Logs screen reads it. */
export interface AuditLogEntry {
  readonly id: string;
  /** ISO-8601 instant the action happened. */
  readonly occurredAt: string;
  readonly requestId: string;
  /** Who acted: `patient` / `hospital` / `platform` / `display` / `system`. */
  readonly principal: string;
  /** Acting user, or `null` for system and anonymous actions. */
  readonly actorUserId: string | null;
  /** Actor's display name and email, when the backend sends them (B6/B9). */
  readonly actorName: string | null;
  readonly actorEmail: string | null;
  readonly hospitalId: string | null;
  /** The hospital's name, when the backend sends it (B6/B9). */
  readonly hospitalName: string | null;
  readonly ip: string | null;
  readonly method: string;
  readonly path: string;
  /** Machine action code, e.g. `plan.created` or `http.post`. */
  readonly action: string;
  /** Resource the action touched, e.g. `plan` or a view class name. */
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly statusCode: number;
  /** Permission module the action belongs to (B6); `null` on older rows/backends. */
  readonly module: string | null;
  /** `null` when the backend records no severity for the row. */
  readonly severity: LogSeverity | null;
  /** The record before and after the change, as the backend masked them (free-form JSON). */
  readonly before: unknown;
  readonly after: unknown;
  /** Field-level changes from `diff`; empty when the entry carries none. */
  readonly changes: readonly AuditFieldChange[];
  /** Free-form context the action recorded (reasons, versions, counts). */
  readonly meta: unknown;
}

/** Direction of the only server-side sort the trail supports (`occurred_at`). */
export type AuditLogSortDir = 'asc' | 'desc';

/** Server-side filters on the trail (`audit_log_spec` allowlist). */
export interface AuditLogFilters {
  /** Inclusive `YYYY-MM-DD` bounds, interpreted in IST by the backend. */
  readonly dateFrom?: string;
  readonly dateTo?: string;
  /** Exact match on request id, action, resource type, or a resource/actor UUID. */
  readonly q?: string;
  /** One acting user (UUID). */
  readonly actorUserId?: string;
  /** Any of these principals; empty or omitted = all. */
  readonly principals?: readonly AuditPrincipal[];
  /** Exact action code, e.g. `user.blocked`. */
  readonly action?: string;
  /** One hospital's entries only; omitted = the whole platform. */
  readonly hospitalId?: string;
  /** Permission module (B6). */
  readonly module?: string;
  /** Severity (B6). */
  readonly severity?: LogSeverity;
}

/** Filters plus paging and sort for one page of the trail. */
export interface AuditLogQuery extends AuditLogFilters {
  /** 1-based page number. */
  readonly page: number;
  readonly pageSize: number;
  /** Omitted → newest first (the backend default). */
  readonly sortDir?: AuditLogSortDir;
}
