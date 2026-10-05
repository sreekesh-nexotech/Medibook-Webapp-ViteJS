import { minutesToTimeLabel, timeLabelToMinutes } from '@/features/doctors/domain/calendar';
import type {
  DoctorSlotDay,
  ScheduledSlot,
  SlotLiveState,
} from '@/features/slots/domain/entities/slots.entities';

/**
 * Shapes the API's doctor → session → slot tree into the doctor × time-of-day
 * grid the screen draws. Times are shown in the browser's time zone: the
 * hospital's own zone lives on its profile (H2), so staff on site see the
 * same clock either way until Z switches this to the profile's zone.
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

export interface SlotRowView {
  readonly doctorId: string;
  readonly doctorName: string;
  readonly dept: string;
  readonly room: string;
  readonly slots: readonly SlotCellView[];
  /** Set when the doctor has no slots at all that day. */
  readonly closedReason: string | null;
}

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

function localMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * MINUTES_PER_HOUR + d.getMinutes();
}

function detailOf(slot: ScheduledSlot): string | null {
  if (slot.booking) {
    return [slot.booking.tokenLabel, slot.booking.bookingRef].filter(Boolean).join(' · ');
  }
  return slot.blockReason;
}

function toCell(slot: ScheduledSlot): SlotCellView {
  const startMinutes = localMinutes(slot.startsAt);
  return {
    id: slot.id,
    startMinutes,
    label: minutesToTimeLabel(startMinutes),
    state: CELL_STATE[slot.state],
    detail: detailOf(slot),
  };
}

export function toSlotGridView(
  date: string,
  days: readonly DoctorSlotDay[],
  deptNames: ReadonlyMap<string, string>,
  rooms: ReadonlyMap<string, string>,
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
    const slots = day.sessions.flatMap((s) => s.slots.map(toCell));
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
      closedReason: slots.length === 0 ? NO_SESSIONS : null,
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
