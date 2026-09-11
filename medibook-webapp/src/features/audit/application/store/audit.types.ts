/**
 * Hospital-side audit-trail view-model types (interim entities for the
 * static-seed phase) — audit X-05: "The hospital app has no log screen at
 * all", while the operations console has had one since day one
 * (`ops-logs`). The shapes deliberately mirror `LogEntry` there (actor,
 * module, ip, severity) so the two log screens read as one product, and add
 * the three things a hospital admin needs that the ops trail does not carry:
 * the entity the action touched, and the before -> after values.
 */

/** Severity of a trail entry — same vocabulary as the ops compliance log. */
export type AuditSeverity = 'Info' | 'Warning' | 'Critical';

/** What kind of change the entry records. Filterable in the trail toolbar. */
export const AUDIT_ACTIONS = [
  'Login',
  'Create',
  'Update',
  'Delete',
  'Cancel',
  'Payment',
  'Refund',
  'Export',
  'Permission',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Which record the action touched. Filterable in the trail toolbar. */
export const AUDIT_ENTITIES = [
  'Appointment',
  'Patient',
  'Payment',
  'Token',
  'Doctor',
  'Department',
  'Service',
  'Coupon',
  'Tax',
  'Branch',
  'Holiday',
  'Banner',
  'Template',
  'Announcement',
  'Settings',
  'User',
  'Role',
  'Report',
  'Session',
] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

/** One row of the hospital audit trail. */
export interface AuditEntry {
  readonly id: string;
  /**
   * Local calendar date, `yyyy-mm-dd`. Built from
   * `getFullYear()/getMonth()/getDate()` — never `toISOString()` on a
   * local-midnight Date, which is the app's yesterday-date defect.
   */
  readonly date: string;
  /** Local wall-clock time, 24h `HH:MM`. */
  readonly time: string;
  /** Who did it — the staff user's display name. */
  readonly actor: string;
  /** Their role at the time of the action, e.g. "Administrator". */
  readonly actorRole: string;
  readonly action: AuditAction;
  /** One-line human summary, e.g. "Cancellation cut-off changed". */
  readonly summary: string;
  readonly entity: AuditEntity;
  /** The record's own id, e.g. `AP1004`, `MB/R/2026-27/000118`, `svc-3`. */
  readonly entityId: string;
  /** Previous value, or null when the action created something. */
  readonly before: string | null;
  /** New value, or null when the action deleted something. */
  readonly after: string | null;
  readonly ip: string;
  /** Device / client the action came from, e.g. "Chrome · Front desk PC". */
  readonly device: string;
  readonly sev: AuditSeverity;
}

/**
 * A new entry as a feature action hands it over: everything except the id and
 * the clock, which the store stamps.
 */
export interface AuditDraft {
  readonly actor?: string;
  readonly actorRole?: string;
  readonly action: AuditAction;
  readonly summary: string;
  readonly entity: AuditEntity;
  readonly entityId: string;
  readonly before?: string | null;
  readonly after?: string | null;
  readonly ip?: string;
  readonly device?: string;
  readonly sev?: AuditSeverity;
}
