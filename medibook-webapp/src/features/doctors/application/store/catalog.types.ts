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
  /**
   * The backend session code this window was loaded with (`morning`, …).
   * Saving keeps it, so the session — and the bookings and token queue tied
   * to it — survive an edit; absent for patterns added in the editor.
   */
  readonly sessionCode?: string;
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
