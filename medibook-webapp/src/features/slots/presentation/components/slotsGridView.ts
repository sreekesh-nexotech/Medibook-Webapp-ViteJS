import { minutesToTimeLabel, timeLabelToMinutes } from '@/features/doctors/domain/calendar';
import type {
  DoctorSlotDay,
  ScheduledSlot,
  SlotLiveState,
} from '@/features/slots/domain/entities/slots.entities';

/**
 * Shapes the API's doctor → session → slot tree into the doctor × time-of-day
 * grid the screen draws. Times are shown in the hospital's own time zone (its
 * profile), so the grid reads the same wherever the browser is.
 */

export type SlotCellState = 'available' | 'held' | 'booked' | 'blocked' | 'past';

export interface SlotCellView {
  readonly id: string;
  readonly startMinutes: number;
  /** Start time as the app writes it, e.g. "9:30 am". */
  readonly label: string;
  readonly state: SlotCellState;
  /** Token and booking ref for a taken slot, or the block reason. */
  readonly detail: string | null;
}

/** One of a doctor's sessions that day, as the row header lists it. */
export interface SessionView {
  readonly id: string;
  /** "Morning OPD 9:00 am–12:00 pm". */
  readonly label: string;
  /** "Closed", "Cancelled", "Paused" — `null` while the session runs normally. */
  readonly statusLabel: string | null;
}

export interface SlotRowView {
  readonly doctorId: string;
  readonly doctorName: string;
  readonly dept: string;
  readonly room: string;
  readonly slots: readonly SlotCellView[];
  readonly sessions: readonly SessionView[];
  /** Set when the doctor has no slots at all that day. */
  readonly closedReason: string | null;
}

/** A hospital holiday, as the grid needs it. */
export interface GridHoliday {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  /** `null` = the whole hospital. */
  readonly departmentId: string | null;
}

/** Session statuses worth flagging; `scheduled` / `open` are business as usual. */
const SESSION_STATUS_LABEL: Readonly<Record<string, string>> = {
  paused: 'Paused',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export type SlotCounts = Readonly<Record<SlotCellState, number>>;

export interface SlotGridView {
  readonly date: string;
  /** Slot start times (minutes past midnight) present anywhere in the grid. */
  readonly columns: readonly number[];
  readonly rows: readonly SlotRowView[];
  readonly counts: SlotCounts;
}

const MINUTES_PER_HOUR = 60;
const TIME_PART_WIDTH = 2;

const NO_SESSIONS = 'No sessions on this date';

const CELL_STATE: Readonly<Record<SlotLiveState, SlotCellState>> = {
  open: 'available',
  held: 'held',
  booked: 'booked',
  blocked: 'blocked',
  past: 'past',
};

/** Minutes past midnight of `iso` in `timeZone` (browser zone when `null`). */
export function zonedMinutes(iso: string, timeZone: string | null): number {
  const d = new Date(iso);
  if (!timeZone) return d.getHours() * MINUTES_PER_HOUR + d.getMinutes();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const part = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part('hour') * MINUTES_PER_HOUR + part('minute');
}

/** Booking statuses spelled out where the raw code would read oddly. */
const BOOKING_STATUS_LABEL: Readonly<Record<string, string>> = {
  pending_payment: 'awaiting payment',
  pending_approval: 'awaiting approval',
  checked_in: 'checked in',
  in_consultation: 'in consultation',
  no_show: 'no-show',
};

function detailOf(slot: ScheduledSlot, timeZone: string | null): string | null {
  if (slot.booking) {
    const status = BOOKING_STATUS_LABEL[slot.booking.status] ?? slot.booking.status;
    return [slot.booking.tokenLabel, slot.booking.bookingRef, status].filter(Boolean).join(' · ');
  }
  if (slot.state === 'held' && slot.holdExpiresAt) {
    return `held for payment until ${minutesToTimeLabel(zonedMinutes(slot.holdExpiresAt, timeZone))}`;
  }
  return slot.blockReason;
}

function toCell(slot: ScheduledSlot, timeZone: string | null): SlotCellView {
  const startMinutes = zonedMinutes(slot.startsAt, timeZone);
  return {
    id: slot.id,
    startMinutes,
    label: minutesToTimeLabel(startMinutes),
    state: CELL_STATE[slot.state],
    detail: detailOf(slot, timeZone),
  };
}

/** Why a doctor has no slots: a holiday covering them, else no sessions. */
function closedReasonFor(
  date: string,
  departmentId: string,
  holidays: readonly GridHoliday[],
): string {
  const holiday = holidays.find(
    (h) =>
      h.from <= date &&
      date <= h.to &&
      (h.departmentId === null || h.departmentId === departmentId),
  );
  if (!holiday) return NO_SESSIONS;
  return holiday.departmentId === null
    ? `Hospital holiday — ${holiday.name}`
    : `Department holiday — ${holiday.name}`;
}

export interface SlotGridContext {
  readonly deptNames: ReadonlyMap<string, string>;
  readonly rooms: ReadonlyMap<string, string>;
  /** The hospital's IANA zone; `null` falls back to the browser's. */
  readonly timeZone: string | null;
  readonly holidays: readonly GridHoliday[];
}

export function toSlotGridView(
  date: string,
  days: readonly DoctorSlotDay[],
  { deptNames, rooms, timeZone, holidays }: SlotGridContext,
): SlotGridView {
  const counts: Record<SlotCellState, number> = {
    available: 0,
    held: 0,
    booked: 0,
    blocked: 0,
    past: 0,
  };
  const columns = new Set<number>();
  const rows = days.map((day): SlotRowView => {
    const slots = day.sessions.flatMap((s) => s.slots.map((slot) => toCell(slot, timeZone)));
    const sessions = day.sessions.map((s): SessionView => ({
      id: s.id,
      label: `${s.label} ${minutesToTimeLabel(zonedMinutes(s.startsAt, timeZone))}–${minutesToTimeLabel(zonedMinutes(s.endsAt, timeZone))}`,
      statusLabel: SESSION_STATUS_LABEL[s.status] ?? null,
    }));
    for (const slot of slots) {
      counts[slot.state] += 1;
      columns.add(slot.startMinutes);
    }
    return {
      doctorId: day.doctorId,
      doctorName: day.doctorName,
      dept: deptNames.get(day.departmentId) ?? '',
      room: rooms.get(day.doctorId) ?? '',
      slots,
      sessions,
      closedReason: slots.length === 0 ? closedReasonFor(date, day.departmentId, holidays) : null,
    };
  });
  return { date, columns: [...columns].sort((a, b) => a - b), rows, counts };
}

/** "9:30 am" → "09:30" (the bulk scope's `time_from` / `time_to`). */
export function timeLabelToHhMm(label: string): string | null {
  const minutes = timeLabelToMinutes(label);
  if (minutes == null) return null;
  const pad = (n: number) => String(n).padStart(TIME_PART_WIDTH, '0');
  return `${pad(Math.floor(minutes / MINUTES_PER_HOUR))}:${pad(minutes % MINUTES_PER_HOUR)}`;
}
