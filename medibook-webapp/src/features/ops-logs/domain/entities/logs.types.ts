/**
 * Platform audit-trail entities (`GET /platform/logs`, backend `audit_log`).
 * Rows are masked server-side before insert; the trail is append-only.
 */

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
  readonly hospitalId: string | null;
  readonly ip: string | null;
  readonly method: string;
  readonly path: string;
  /** Machine action code, e.g. `plan.created` or `http.post`. */
  readonly action: string;
  /** Resource the action touched, e.g. `plan` or a view class name. */
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly statusCode: number;
}

/** Direction of the only server-side sort the trail supports (`occurred_at`). */
export type AuditLogSortDir = 'asc' | 'desc';

/** Server-side filters and paging for the audit trail. */
export interface AuditLogQuery {
  /** 1-based page number. */
  readonly page: number;
  readonly pageSize: number;
  /** Inclusive `YYYY-MM-DD` bounds, interpreted in IST by the backend. */
  readonly dateFrom?: string;
  readonly dateTo?: string;
  /** Exact match on request id, action, resource type, or a resource/actor UUID. */
  readonly q?: string;
  /** Omitted → newest first (the backend default). */
  readonly sortDir?: AuditLogSortDir;
}
