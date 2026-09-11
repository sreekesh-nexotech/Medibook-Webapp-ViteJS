/**
 * Pure schedule resolution: given a doctor's weekly grid, the hospital's shift
 * patterns, their leave and their per-date exceptions, what hours are they
 * actually bookable for on one calendar date?
 *
 * This is the single answer to that question — the slot grid, the doctor
 * screen and the catalogue summary all read it, so a pattern, a leave entry or
 * an exception cannot mean one thing on one screen and another elsewhere
 * (audit 2.4 / HA-06 / HA-07).
 *
 * Inputs are described structurally (only the fields this logic needs), so the
 * domain layer stays free of imports from the application layer while the
 * catalogue's own `Doctor` / `ShiftPattern` records satisfy them directly.
 */

import { isIsoWithin, isoWeekdayLabel, timeLabelToMinutes } from './calendar';

/** A bookable window as minutes since local midnight. */
export interface TimeWindow {
  readonly fromMinutes: number;
  readonly toMinutes: number;
}

export interface ScheduleDay {
  readonly day: string;
  readonly on: boolean;
  readonly from: string;
  readonly to: string;
  readonly patternIds?: readonly string[];
}

export interface SchedulePattern {
  readonly id: string;
  readonly name: string;
  readonly from: string;
  readonly to: string;
}

export interface ScheduleLeave {
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly reason: string;
}

export interface ScheduleException {
  readonly date: string;
  readonly closed: boolean;
  readonly from: string;
  readonly to: string;
  readonly note: string;
}

export interface DoctorSchedule {
  readonly week: readonly ScheduleDay[];
  readonly leave: readonly ScheduleLeave[];
  readonly exceptions: readonly ScheduleException[];
}

/** Where a resolved day's hours came from — shown as the grid row's caption. */
export type AvailabilitySource = 'weekly' | 'patterns' | 'exception';

/** Why a doctor is not bookable on a date, or the windows in which they are. */
export type DayAvailability =
  | {
      readonly kind: 'open';
      readonly windows: readonly TimeWindow[];
      readonly source: AvailabilitySource;
      /** Human note for the row caption (an exception's note, when there is one). */
      readonly note?: string;
    }
  | { readonly kind: 'closed'; readonly reason: string };

/** Read a from/to label pair into a window, dropping anything unreadable or empty. */
function toWindow(from: string, to: string): TimeWindow | null {
  const fromMinutes = timeLabelToMinutes(from);
  const toMinutes = timeLabelToMinutes(to);
  if (fromMinutes == null || toMinutes == null || toMinutes <= fromMinutes) return null;
  return { fromMinutes, toMinutes };
}

/** Earliest first, so the grid reads left to right. */
function sortWindows(windows: readonly TimeWindow[]): readonly TimeWindow[] {
  return [...windows].sort((a, b) => a.fromMinutes - b.fromMinutes);
}

/**
 * The doctor's bookable windows on `iso`.
 *
 * Precedence — **leave, then exception, then the weekly pattern**: a doctor on
 * leave is never bookable whatever else is set, an exception overrides the
 * weekly grid for its one date (that is the point of HA-07), and otherwise the
 * weekday's assigned shift patterns apply, falling back to its raw from–to
 * window when no pattern is assigned.
 */
export function availabilityForDate(
  schedule: DoctorSchedule,
  patterns: readonly SchedulePattern[],
  iso: string,
): DayAvailability {
  const leave = schedule.leave.find((l) => isIsoWithin(iso, l.from, l.to));
  if (leave) {
    return {
      kind: 'closed',
      reason: leave.reason ? `${leave.type} leave — ${leave.reason}` : `${leave.type} leave`,
    };
  }

  const exception = schedule.exceptions.find((e) => e.date === iso);
  if (exception) {
    if (exception.closed) {
      return { kind: 'closed', reason: exception.note || 'Closed for this date' };
    }
    const window = toWindow(exception.from, exception.to);
    if (window) {
      return {
        kind: 'open',
        windows: [window],
        source: 'exception',
        note: exception.note || undefined,
      };
    }
    return { kind: 'closed', reason: 'Date exception has no usable hours' };
  }

  const label = isoWeekdayLabel(iso);
  const day = schedule.week.find((d) => d.day === label);
  if (!day || !day.on) return { kind: 'closed', reason: `Not a working day (${label})` };

  const assigned = (day.patternIds ?? [])
    .map((id) => patterns.find((p) => p.id === id))
    .filter((p): p is SchedulePattern => Boolean(p));

  if (assigned.length > 0) {
    const windows = assigned
      .map((p) => toWindow(p.from, p.to))
      .filter((w): w is TimeWindow => w !== null);
    if (windows.length === 0) {
      return { kind: 'closed', reason: 'Assigned shift patterns have no usable hours' };
    }
    return {
      kind: 'open',
      windows: sortWindows(windows),
      source: 'patterns',
      note: assigned.map((p) => p.name).join(' + '),
    };
  }

  const window = toWindow(day.from, day.to);
  if (!window) return { kind: 'closed', reason: 'No working hours set for this day' };
  return { kind: 'open', windows: [window], source: 'weekly' };
}

/** "9:00 am" → "9am", "4:30 pm" → "4:30pm" — the catalogue's compact summary form. */
function compactTime(label: string): string {
  return label.replace(':00', '').replace(' ', '');
}

/**
 * The catalogue's one-line hours summary, e.g. "Mon–Sat · 9am–6pm" — derived
 * from the grid rather than stored beside it, so an edited week can never
 * disagree with the caption on the card.
 */
export function summariseWeekHours(week: readonly ScheduleDay[]): string {
  const open = week.filter((d) => d.on);
  if (open.length === 0) return 'Closed all week';
  const days = open.length === 1 ? open[0].day : `${open[0].day}–${open[open.length - 1].day}`;
  return `${days} · ${compactTime(open[0].from)}–${compactTime(open[0].to)}`;
}
