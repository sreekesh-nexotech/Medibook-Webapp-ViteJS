/**
 * Hospital-profile view-model types — audit HA-03 (§2.4): "Branches and
 * holiday calendar have no screen. Hospital-published banners for the patient
 * app have no screen."
 *
 * Three records, one screen:
 *   `HospitalBranch`  where the hospital operates, and which departments run there
 *   `HospitalHoliday` when it is closed — the calendar slot generation must respect
 *   `PatientBanner`   what the hospital publishes to the Medibook patient app
 *
 * Dates are real ISO `yyyy-mm-dd` values, never display strings
 * (CANONICAL_MASTER_DATA §8); the UI formats them with `fmtDate()` at the edge.
 */

export interface HospitalBranch {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly city: string;
  readonly phone: string;
  /** Department names operating at this branch (from the catalog's master data). */
  readonly departments: readonly string[];
  /** Exactly one branch is the primary; it cannot be deleted. */
  readonly primary: boolean;
}

/** What a closure applies to. */
export const HOLIDAY_SCOPES = ['Whole hospital', 'Branch', 'Department'] as const;

export type HolidayScope = (typeof HOLIDAY_SCOPES)[number];

/**
 * A named closure. A single day is `from === to`; a range spans both ends
 * inclusive. `scopeRef` is the branch id for `Branch`, the department name for
 * `Department`, and empty for `Whole hospital`.
 */
export interface HospitalHoliday {
  readonly id: string;
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly scope: HolidayScope;
  readonly scopeRef: string;
  readonly note: string;
}

/** Who a published banner is aimed at. */
export const BANNER_AUDIENCES = [
  'All patients',
  'New patients',
  'Returning patients',
  'Patients of a department',
] as const;

export type BannerAudience = (typeof BANNER_AUDIENCES)[number];

/**
 * A banner the hospital publishes to the patient app. Same authoring shape as
 * the operations console's campaign banners (`ops-notifications`), plus the
 * body copy and audience a hospital-published banner needs.
 */
export interface PatientBanner {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** Uploaded creative as a data URI; null renders the gradient placeholder. */
  readonly img: string | null;
  readonly from: string;
  readonly to: string;
  readonly audience: BannerAudience;
  /** Department name when `audience` is "Patients of a department". */
  readonly audienceDept: string;
  /** Paused banners keep their schedule but leave the rotation. */
  readonly active: boolean;
}

/** Derived publication state of a banner against a given day. */
export type BannerState = 'Live' | 'Scheduled' | 'Expired' | 'Paused';
