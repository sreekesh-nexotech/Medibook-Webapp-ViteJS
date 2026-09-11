/**
 * Interim view-model types for the Doctors & Departments catalog
 * (design `Catalog.jsx`). The catalog is the hospital's own master data: it
 * feeds the Medibook patient app, the booking screens and the slot grid, so
 * every screen that needs a department, a doctor or a fee reads it through
 * `catalog.selectors.ts` rather than a hardcoded list (audit 2.6.3).
 */

/**
 * A named, reusable consultation window ("Morning OPD 9–1") that can be
 * assigned to any weekday of any doctor — audit 2.4 / HA-06, where shift
 * patterns "have no working control". The library is hospital-wide so a
 * pattern is defined once and reused across the roster.
 */
export interface ShiftPattern {
  readonly id: string;
  /** Display name, e.g. "Morning OPD". */
  readonly name: string;
  /** Start time label from `TIME_OPTS`, e.g. "9:00 am". */
  readonly from: string;
  /** End time label from `TIME_OPTS`, e.g. "1:00 pm". */
  readonly to: string;
}

/**
 * One day of a weekly-hours grid ("Mon".."Sun").
 *
 * `patternIds` is the day's assigned shift patterns. When it is non-empty the
 * day's bookable windows are those patterns (so a split morning/evening OPD is
 * two windows, not one long block) and `from`/`to` are ignored; when it is
 * empty the single `from`–`to` window applies.
 */
export interface WeekDay {
  readonly day: string;
  readonly on: boolean;
  readonly from: string;
  readonly to: string;
  readonly patternIds?: readonly string[];
}

export type DeptStatus = 'Active' | 'Inactive';

export interface Dept {
  /** Canonical department key, e.g. `cardiology` (CANONICAL_MASTER_DATA §1). */
  readonly id: string;
  readonly name: string;
  readonly about: string;
  /** Department base fee in **whole rupees** — the default when a doctor has no own fee. */
  readonly fee: number;
  /** Display summary, e.g. "Mon–Sat · 9am–6pm". */
  readonly hours: string;
  readonly status: DeptStatus;
  /** Concrete hex color — feeds data-driven inline styles (cards, gradients). */
  readonly color: string;
  readonly week: readonly WeekDay[];
  /** Optional cover image data-URL added via the dept editor. */
  readonly image?: string | null;
}

/** Catalog-side doctor availability (distinct from the live queue DoctorStatus). */
export type CatalogDoctorStatus = 'Active' | 'On Leave' | 'Inactive';

/** Why a doctor is away — drives the leave chip and the slot grid's reason line. */
export type LeaveType = 'Casual' | 'Sick' | 'Conference';

/**
 * One leave / unavailability entry. Dates are real ISO `yyyy-mm-dd` values,
 * never display strings (CANONICAL_MASTER_DATA §8) — the UI formats them with
 * `fmtDate()` at the edge.
 */
export interface DoctorLeave {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: LeaveType;
  readonly reason: string;
}

/**
 * A single-date override of the weekly pattern (HA-07): an extra clinic on a
 * closed day, or an early close on an open one. `closed` wins over the hours.
 */
export interface DateException {
  readonly id: string;
  /** ISO `yyyy-mm-dd`. */
  readonly date: string;
  /** True = no consultation at all on this date, whatever the weekly pattern says. */
  readonly closed: boolean;
  readonly from: string;
  readonly to: string;
  readonly note: string;
}

/** A patient review shown on the doctor profile (author, rating, date, text). */
export interface DoctorReview {
  readonly a: string;
  readonly r: number;
  readonly d: string;
  readonly t: string;
}

export interface Doctor {
  /** Canonical doctor id, e.g. `dr-anya-sharma` (CANONICAL_MASTER_DATA §2). */
  readonly id: string;
  readonly name: string;
  readonly depts: readonly string[];
  readonly spec: string;
  readonly room: string;
  /** Consultation fee in **whole rupees** (the web app's `money()` unit). */
  readonly fee: number;
  readonly rating: number;
  readonly reviews: number;
  readonly status: CatalogDoctorStatus;
  readonly week: readonly WeekDay[];
  readonly leave: readonly DoctorLeave[];
  readonly list: readonly DoctorReview[];
  /** Canonical hospital id this doctor practises at (`apollo`, `citycare`, …). */
  readonly hospital: string;
  /** Per-date overrides of the weekly pattern. */
  readonly exceptions: readonly DateException[];
  /** Optional profile fields edited via the doctor drawer. */
  readonly phone?: string;
  readonly email?: string;
  readonly qual?: string;
  readonly exp?: string;
  readonly reg?: string;
  readonly photo?: string | null;
  readonly about?: string;
}
