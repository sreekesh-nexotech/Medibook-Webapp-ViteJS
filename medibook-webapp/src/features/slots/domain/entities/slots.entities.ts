/**
 * Slot inventory as the hospital API serves it (`GET /hospital/slots`,
 * `scheduling/services/slots.py`): per doctor → sessions → materialised
 * slots, capacity 1. Every slot is a stored row with its own id.
 */

/**
 * What a slot is right now. `past` is the backend's `state` for an open or
 * blocked slot that has already started; `held` is a slot reserved by a
 * booking that is still awaiting payment.
 */
export type SlotLiveState = 'open' | 'held' | 'booked' | 'blocked' | 'past';

/** The appointment occupying a held or booked slot. */
export interface SlotBooking {
  readonly appointmentId: string;
  readonly bookingRef: string;
  readonly tokenLabel: string | null;
  readonly status: string;
}

export interface ScheduledSlot {
  readonly id: string;
  /** ISO date-time (UTC). */
  readonly startsAt: string;
  readonly endsAt: string;
  readonly state: SlotLiveState;
  readonly blockReason: string | null;
  readonly booking: SlotBooking | null;
}

export interface DoctorSessionSlots {
  readonly id: string;
  readonly label: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly slots: readonly ScheduledSlot[];
}

/** One doctor's day on the grid. No sessions = no slots that day. */
export interface DoctorSlotDay {
  readonly doctorId: string;
  readonly doctorName: string;
  readonly departmentId: string;
  readonly slotLengthMin: number;
  readonly sessions: readonly DoctorSessionSlots[];
}

export interface SlotGridParams {
  /** ISO `yyyy-mm-dd`, hospital-local. */
  readonly date: string;
  readonly departmentId: string | null;
  readonly doctorId: string | null;
}

export interface SlotGridPage {
  readonly days: readonly DoctorSlotDay[];
  /** Doctors matching the filters, even beyond `days`. */
  readonly total: number;
}

/** A booking a block would cancel (with a 100% refund). */
export interface AffectedBooking {
  readonly appointmentId: string;
  readonly bookingRef: string;
  readonly tokenLabel: string | null;
  readonly patientName: string;
  readonly scheduledStartAt: string;
}

export type BulkSlotAction = 'block' | 'open';

/** Which days a bulk update covers. */
export type BulkSlotDays =
  | { readonly kind: 'date'; readonly date: string }
  /** The next `weeks` occurrences of `weekday` (0 = Monday), counting from today. */
  | { readonly kind: 'weekday'; readonly weekday: number; readonly weeks: number };

export interface BulkSlotScope {
  readonly days: BulkSlotDays;
  readonly doctorId: string | null;
  readonly departmentId: string | null;
  /** Hospital-local `HH:MM`: slots starting at or after this… */
  readonly timeFrom: string;
  /** …and ending at or before this. */
  readonly timeTo: string;
}

export interface BulkSlotRequest {
  readonly scope: BulkSlotScope;
  readonly action: BulkSlotAction;
}

export interface BulkSlotResult {
  readonly isDryRun: boolean;
  readonly action: BulkSlotAction;
  /** Slots the update changes (for a block, including booked ones it cancels). */
  readonly affectedCount: number;
  readonly skippedBooked: number;
  readonly skippedPast: number;
  readonly affectedBookings: readonly AffectedBooking[];
}

export interface SlotRegenerateResult {
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly closedCount: number;
  readonly preservedCount: number;
}

export interface SlotGenerationRun {
  readonly id: string;
  readonly doctorId: string | null;
  readonly trigger: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly createdCount: number;
  readonly error: string | null;
}
