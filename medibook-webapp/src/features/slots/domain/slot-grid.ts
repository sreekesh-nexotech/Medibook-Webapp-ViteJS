/**
 * The slot generator — one pure function that turns a doctor roster, the
 * hospital's rules and the day's bookings into the grid the Slots &
 * Availability screen renders (audit HA-08).
 *
 * Everything the screen shows comes from here, so "what slots does this doctor
 * have on Tuesday" has exactly one answer in the app. Pure: no React, no
 * stores, no clock reads — the caller passes `nowMinutes` and `today`.
 */

import { minutesToTimeLabel } from '@/features/doctors/domain/calendar';
import {
  availabilityForDate,
  type DoctorSchedule,
  type SchedulePattern,
} from '@/features/doctors/domain/schedule';

import {
  slotKey,
  type DoctorSlotRow,
  type Slot,
  type SlotCounts,
  type SlotGrid,
  type SlotRef,
  type SlotState,
} from './slot';

/** A doctor as the generator needs them: identity plus their schedule. */
export interface SlotGridDoctor extends DoctorSchedule {
  readonly id: string;
  readonly name: string;
  readonly depts: readonly string[];
  readonly room: string;
}

/** One existing appointment, already resolved to a doctor id and a start time. */
export interface SlotBooking {
  readonly doctorId: string;
  readonly startMinutes: number;
  /** "T-004 · Ellen Kinderson" — shown on the booked cell. */
  readonly label: string;
}

/** The hospital rules a grid is generated under (all already parsed to numbers). */
export interface SlotRules {
  readonly slotMinutes: number;
  readonly bufferMinutes: number;
  readonly openMinutes: number;
  readonly closeMinutes: number;
  /** Monday-first open flags for the hospital week (7 entries). */
  readonly openWeekdays: readonly boolean[];
}

export interface SlotGridInput {
  /** ISO `yyyy-mm-dd` the grid is for. */
  readonly date: string;
  /** Monday-first weekday index of `date` (0 = Mon). */
  readonly weekdayIndex: number;
  readonly doctors: readonly SlotGridDoctor[];
  readonly patterns: readonly SchedulePattern[];
  readonly rules: SlotRules;
  readonly bookings: readonly SlotBooking[];
  /** Slot keys an admin has blocked (`slotKey()` values). */
  readonly blocked: ReadonlySet<string>;
  /** Minutes past local midnight, now — only relevant when `date` is today. */
  readonly nowMinutes: number;
  /** Today's ISO date, so "past" is decided without reading the clock here. */
  readonly today: string;
}

/** Thrown-free failure: the rules cannot produce a grid at all. */
export type SlotGridResult =
  { readonly ok: true; readonly grid: SlotGrid } | { readonly ok: false; readonly reason: string };

const EMPTY_COUNTS: SlotCounts = { available: 0, booked: 0, blocked: 0, past: 0 };

/** Sum two tallies — the grid total is the sum of its rows. */
function addCounts(a: SlotCounts, b: SlotCounts): SlotCounts {
  return {
    available: a.available + b.available,
    booked: a.booked + b.booked,
    blocked: a.blocked + b.blocked,
    past: a.past + b.past,
  };
}

function countSlots(slots: readonly Slot[]): SlotCounts {
  return slots.reduce<SlotCounts>(
    (acc, s) => ({
      available: acc.available + (s.state === 'available' ? 1 : 0),
      booked: acc.booked + (s.state === 'booked' ? 1 : 0),
      blocked: acc.blocked + (s.state === 'blocked' ? 1 : 0),
      past: acc.past + (s.state === 'past' ? 1 : 0),
    }),
    EMPTY_COUNTS,
  );
}

/**
 * Build one doctor's slots for the date.
 *
 * A slot consumes `slotMinutes` of consultation plus `bufferMinutes` of gap,
 * so the next one starts one *pitch* later; the last slot of a window must
 * still finish inside it. Every window is clamped to the hospital's own
 * opening hours first — a doctor cannot consult while the hospital is shut.
 */
function buildRow(doctor: SlotGridDoctor, input: SlotGridInput): DoctorSlotRow {
  const { rules, date, today, nowMinutes } = input;
  const availability = availabilityForDate(doctor, input.patterns, date);
  const base = {
    doctorId: doctor.id,
    doctorName: doctor.name,
    dept: doctor.depts[0] ?? '—',
    room: doctor.room,
  };

  if (availability.kind === 'closed') {
    return { ...base, slots: [], closedReason: availability.reason };
  }

  const pitch = rules.slotMinutes + rules.bufferMinutes;
  const isPastDate = date < today;
  const isToday = date === today;
  const slots: Slot[] = [];

  for (const window of availability.windows) {
    const from = Math.max(window.fromMinutes, rules.openMinutes);
    const to = Math.min(window.toMinutes, rules.closeMinutes);
    for (let start = from; start + rules.slotMinutes <= to; start += pitch) {
      const booking = input.bookings.find(
        (b) => b.doctorId === doctor.id && b.startMinutes === start,
      );
      const end = start + rules.slotMinutes;
      const blocked = input.blocked.has(
        slotKey({ doctorId: doctor.id, date, startMinutes: start }),
      );
      // Precedence: a real booking is always shown, then anything already
      // gone by, then an admin block, then simply free.
      const state: Slot['state'] = booking
        ? 'booked'
        : isPastDate || (isToday && end <= nowMinutes)
          ? 'past'
          : blocked
            ? 'blocked'
            : 'available';
      slots.push({
        startMinutes: start,
        endMinutes: end,
        label: minutesToTimeLabel(start),
        state,
        bookedFor: booking?.label,
      });
    }
  }

  if (slots.length === 0) {
    return {
      ...base,
      slots: [],
      closedReason: 'Working hours fall outside the hospital’s opening hours',
    };
  }

  return {
    ...base,
    slots,
    sourceNote:
      availability.source === 'exception'
        ? `Date exception${availability.note ? ` — ${availability.note}` : ''}`
        : availability.source === 'patterns'
          ? availability.note
          : undefined,
  };
}

/** Generate the whole grid, or say why it cannot be generated. */
export function buildSlotGrid(input: SlotGridInput): SlotGridResult {
  const { rules } = input;
  if (rules.slotMinutes <= 0) {
    return {
      ok: false,
      reason: 'The hospital’s consultation duration is not set, so no slots can be generated.',
    };
  }
  if (rules.closeMinutes <= rules.openMinutes) {
    return {
      ok: false,
      reason: 'The hospital’s opening hours close before they open, so no slots can be generated.',
    };
  }

  const hospitalClosed = rules.openWeekdays[input.weekdayIndex] === false;
  const rows = hospitalClosed ? [] : input.doctors.map((d) => buildRow(d, input));
  const columns = [...new Set(rows.flatMap((r) => r.slots.map((s) => s.startMinutes)))].sort(
    (a, b) => a - b,
  );
  const counts = rows.reduce<SlotCounts>(
    (acc, r) => addCounts(acc, countSlots(r.slots)),
    EMPTY_COUNTS,
  );

  return {
    ok: true,
    grid: {
      date: input.date,
      columns,
      rows,
      slotMinutes: rules.slotMinutes,
      bufferMinutes: rules.bufferMinutes,
      openMinutes: rules.openMinutes,
      closeMinutes: rules.closeMinutes,
      hospitalClosed,
      counts,
    },
  };
}

/** Which slots of a grid a bulk update should touch. */
export interface SlotRefFilter {
  /** Limit to one doctor, or every doctor in the grid when null. */
  readonly doctorId?: string | null;
  /** Inclusive start-time window, in minutes past midnight. */
  readonly fromMinutes: number;
  readonly toMinutes: number;
  /** Only slots currently in one of these states are collected. */
  readonly states: readonly SlotState[];
}

/**
 * The slots a bulk update would actually change — the list the confirmation
 * counts, and the list the store then writes. Booked and past slots are never
 * collected, because `states` only ever asks for `available` or `blocked`:
 * a bulk block cannot silently cancel somebody's appointment.
 */
export function collectSlotRefs(grid: SlotGrid, filter: SlotRefFilter): readonly SlotRef[] {
  const refs: SlotRef[] = [];
  for (const row of grid.rows) {
    if (filter.doctorId && row.doctorId !== filter.doctorId) continue;
    for (const slot of row.slots) {
      if (slot.startMinutes < filter.fromMinutes || slot.startMinutes > filter.toMinutes) continue;
      if (!filter.states.includes(slot.state)) continue;
      refs.push({ doctorId: row.doctorId, date: grid.date, startMinutes: slot.startMinutes });
    }
  }
  return refs;
}
