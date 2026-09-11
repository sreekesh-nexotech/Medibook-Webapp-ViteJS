/**
 * Compliance view-model types (interim entities for the static-seed phase).
 *
 * Audit 2.5 / SA-06: "staff login history, configuration-change detail and
 * export-on-request have no screen". These three record shapes are that
 * screen's substance:
 *
 *  - `StaffLogin`    who signed in, when, from where, on what, and whether it
 *                    worked — for the ops console or for one hospital.
 *  - `ConfigChange`  every settings change with its **before → after** pair.
 *                    A change log without both values is not auditable, which
 *                    is the whole point of the finding.
 *  - `ExportRequest` a data-subject / regulatory export, recorded with a
 *                    status rather than assumed to have succeeded.
 *
 * Dates are ISO `yyyy-mm-dd` strings with a separate `HH:mm` time, compared as
 * strings and formatted for display. Nothing here round-trips through
 * `Date.toISOString()` on a local midnight — that is the defect that makes a
 * date land a day early.
 */

/** Outcome of one sign-in attempt. */
export type LoginResult = 'Success' | 'Failed' | 'Locked out';

/** One sign-in attempt against the ops console or a hospital instance. */
export interface StaffLogin {
  readonly id: number;
  /** ISO `yyyy-mm-dd`. */
  readonly date: string;
  /** 24-hour `HH:mm`, local to the instance. */
  readonly time: string;
  readonly user: string;
  readonly name: string;
  readonly role: string;
  /** Tenant id, or `null` for the Medibook operations console itself. */
  readonly hid: number | null;
  readonly ip: string;
  /** Browser / OS as reported by the user agent. */
  readonly device: string;
  readonly result: LoginResult;
  /** Why a non-success attempt failed. */
  readonly reason?: string;
}

/** Whether a change applied platform-wide or to one hospital instance. */
export type ConfigScope = 'Platform' | 'Hospital';

/** One configuration change, with the values on both sides of it. */
export interface ConfigChange {
  readonly id: number;
  /** ISO `yyyy-mm-dd`. */
  readonly date: string;
  readonly time: string;
  readonly actor: string;
  /** Where the setting lives, e.g. "Platform Settings". */
  readonly area: string;
  /** The setting itself, e.g. "Payout schedule". */
  readonly setting: string;
  /** Value before the change — "—" when the setting was previously unset. */
  readonly before: string;
  /** Value after the change. */
  readonly after: string;
  readonly scope: ConfigScope;
  /** Tenant id when `scope` is `Hospital`. */
  readonly hid?: number | null;
}

/** What a data-subject export is about. */
export type ExportSubjectKind = 'Hospital' | 'Staff user' | 'Patient reference';

/**
 * Where a recorded export got to. `Preparing` is the honest state while the
 * rows are being gathered; `Completed` is only set once a file has actually
 * been written; `No data` records a request that matched nothing — no file,
 * and no claim that one arrived.
 */
export type ExportStatus = 'Preparing' | 'Completed' | 'No data';

/** One export-on-request record. */
export interface ExportRequest {
  readonly id: string;
  readonly kind: ExportSubjectKind;
  /** Display label of the subject, e.g. "Apollo Hospital". */
  readonly subject: string;
  /** Opaque subject key the rows were gathered by. */
  readonly subjectKey: string;
  /** ISO range, inclusive. */
  readonly from: string;
  readonly to: string;
  readonly requestedBy: string;
  /** Display stamp of when it was requested. */
  readonly requestedAt: string;
  readonly status: ExportStatus;
  /** Rows written (0 until it completes). */
  readonly rows: number;
  /** Filename actually written, or null when nothing was. */
  readonly file: string | null;
}
