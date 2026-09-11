/**
 * Slot entities — audit 2.4 / HA-08: "Slot Management is the single largest
 * missing screen in the hospital app. No slot grid, no open or block control,
 * no bulk update."
 *
 * A slot is not stored anywhere: it is **derived** from the doctor's weekly
 * hours, their assigned shift patterns, their leave and date exceptions, and
 * the hospital's slot-length + buffer rules. The only thing the app persists
 * is the list of slots an admin has explicitly blocked. Plain readonly types,
 * no imports from other layers.
 */

/** What one slot currently is. `past` and `booked` are never mutable. */
export type SlotState = 'available' | 'booked' | 'blocked' | 'past';

/** The identity of one slot: a doctor, a calendar date and a start time. */
export interface SlotRef {
  readonly doctorId: string;
  /** ISO `yyyy-mm-dd`, local calendar date. */
  readonly date: string;
  readonly startMinutes: number;
}

/** One generated slot on one doctor's day. */
export interface Slot {
  readonly startMinutes: number;
  readonly endMinutes: number;
  /** Start time as the app writes it, e.g. "9:30 am". */
  readonly label: string;
  readonly state: SlotState;
  /** Who holds it, when booked — "T-004 · Ellen Kinderson". */
  readonly bookedFor?: string;
}

/** One doctor's row in the grid. */
export interface DoctorSlotRow {
  readonly doctorId: string;
  readonly doctorName: string;
  readonly dept: string;
  readonly room: string;
  readonly slots: readonly Slot[];
  /** Set when the doctor generates no slots at all (leave, closed day, no hours). */
  readonly closedReason?: string;
  /** Where the day's hours came from — the shift patterns, or an exception's note. */
  readonly sourceNote?: string;
}

/** Slot tallies for the grid's summary strip. */
export interface SlotCounts {
  readonly available: number;
  readonly booked: number;
  readonly blocked: number;
  readonly past: number;
}

/** The whole derived grid for one date. */
export interface SlotGrid {
  readonly date: string;
  /** Slot start times (minutes past midnight) present anywhere in the grid. */
  readonly columns: readonly number[];
  readonly rows: readonly DoctorSlotRow[];
  readonly slotMinutes: number;
  readonly bufferMinutes: number;
  readonly openMinutes: number;
  readonly closeMinutes: number;
  /** True when the hospital itself is shut on this weekday. */
  readonly hospitalClosed: boolean;
  /**
   * True when `date` falls past the hospital's scheduling horizon
   * (`selectSchedulingHorizonDays`). Booking is simply not open that far
   * ahead yet — it is neither an error nor a closed day, so the screen says
   * so rather than showing an empty grid with no explanation.
   */
  readonly beyondHorizon: boolean;
  readonly counts: SlotCounts;
}

/** The store key for one slot's block flag. */
export function slotKey(ref: SlotRef): string {
  return `${ref.doctorId}|${ref.date}|${ref.startMinutes}`;
}

/** Slots an admin may still change: booked and past slots are not up for grabs. */
export function isMutableState(state: SlotState): boolean {
  return state === 'available' || state === 'blocked';
}
