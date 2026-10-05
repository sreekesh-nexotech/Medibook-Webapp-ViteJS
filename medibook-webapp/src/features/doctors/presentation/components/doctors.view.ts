import type { ShiftPattern, WeekDay } from '@/features/doctors/application/store/catalog.types';
import {
  minutesToTimeLabel,
  TIME_OPTS,
  timeLabelToMinutes,
  WEEK_DAYS,
} from '@/features/doctors/domain/calendar';
import type {
  DoctorStatus,
  LeaveKind,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';

/**
 * Palette cycled for department swatches, in design-token order: blue, p-400,
 * g-500, y-500, blue-strong, p-300, orange. Departments carry no colour on the
 * backend, so the swatch is derived from the department's position.
 */
const DEPT_COLORS: readonly string[] = [
  '#2563eb',
  '#3f5e85',
  '#2ecc71',
  '#f59e0b',
  '#2055ca',
  '#8095ae',
  '#ea7c2b',
];

/**
 * View-model conversions between the API entities and the editor components
 * (which speak the catalogue's `WeekDay` / `ShiftPattern` shapes and "9:00 am"
 * time labels). Pure functions, no React.
 */

/* ----------------------------------------------------------------- statuses */

export const DOCTOR_STATUS_OPTIONS = ['Active', 'On Leave', 'Inactive'] as const;

export type DoctorStatusLabel = (typeof DOCTOR_STATUS_OPTIONS)[number];

/** Badge text for a doctor status (the design's labels). */
export const DOCTOR_STATUS_LABEL: Readonly<Record<DoctorStatus, DoctorStatusLabel>> = {
  active: 'Active',
  on_leave: 'On Leave',
  inactive: 'Inactive',
};

export function doctorStatusFromLabel(label: string): DoctorStatus {
  if (label === 'On Leave') return 'on_leave';
  if (label === 'Inactive') return 'inactive';
  return 'active';
}

export const LEAVE_KIND_LABEL: Readonly<Record<LeaveKind, string>> = {
  casual: 'Casual',
  sick: 'Sick',
  conference: 'Conference',
  other: 'Other',
};

/** Card colour for a department, cycled by position (the backend stores none). */
export function departmentColor(index: number): string {
  return DEPT_COLORS[index % DEPT_COLORS.length];
}

/* -------------------------------------------------------------------- times */

const MINUTES_PER_HOUR = 60;
const TWO_DIGITS = 2;

/** "14:30" → "2:30 pm". */
export function hhmmToLabel(hhmm: string): string {
  const minutes = timeLabelToMinutes(hhmm);
  return minutes == null ? hhmm : minutesToTimeLabel(minutes);
}

/** "2:30 pm" → "14:30"; `null` when unreadable. */
export function labelToHhmm(label: string): string | null {
  const minutes = timeLabelToMinutes(label);
  if (minutes == null) return null;
  const h = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(TWO_DIGITS, '0');
  const m = String(minutes % MINUTES_PER_HOUR).padStart(TWO_DIGITS, '0');
  return `${h}:${m}`;
}

/* ------------------------------------------------------- weekly sessions ↔ grid */

/** The three standard session codes a plain day window maps onto, by start time. */
const STANDARD_SESSIONS = [
  { code: 'morning', label: 'Morning', startsBefore: 12 * MINUTES_PER_HOUR },
  { code: 'afternoon', label: 'Afternoon', startsBefore: 17 * MINUTES_PER_HOUR },
  { code: 'evening', label: 'Evening', startsBefore: Number.POSITIVE_INFINITY },
] as const;

const CUSTOM_CODE_PREFIX = 'custom-';

/** Default window for a day that is switched on without hours (design default). */
const DEFAULT_FROM = '9:00 am';
const DEFAULT_TO = '5:00 pm';

function standardFor(startMinutes: number) {
  return (
    STANDARD_SESSIONS.find((s) => startMinutes < s.startsBefore) ??
    STANDARD_SESSIONS[STANDARD_SESSIONS.length - 1]
  );
}

/** A session is a "plain" window when it carries its time-of-day code's own label. */
function isPlainSession(session: WeeklySession): boolean {
  return STANDARD_SESSIONS.some((s) => s.code === session.sessionCode && s.label === session.label);
}

/** Pattern identity: one named window with fixed times (same label + times = same pattern). */
function patternKey(session: Pick<WeeklySession, 'label' | 'startsAt' | 'endsAt'>): string {
  return `${session.label}|${session.startsAt}|${session.endsAt}`;
}

export interface WeekGrid {
  readonly week: readonly WeekDay[];
  /** This doctor's named sessions, offered as patterns in the weekly editor. */
  readonly patterns: readonly ShiftPattern[];
}

/**
 * Backend sessions → the weekly editor's grid. A day with one plain session
 * (`morning` labelled "Morning", …) is a single from–to window; any other
 * day runs on patterns — this doctor's distinct named sessions.
 */
export function sessionsToGrid(sessions: readonly WeeklySession[]): WeekGrid {
  const patterns = new Map<string, ShiftPattern>();
  const week = WEEK_DAYS.map((day, weekday): WeekDay => {
    const today = sessions
      .filter((s) => s.weekday === weekday)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    if (today.length === 0) {
      return { day, on: false, from: DEFAULT_FROM, to: DEFAULT_TO, patternIds: [] };
    }
    const only = today[0];
    if (today.length === 1 && isPlainSession(only)) {
      return {
        day,
        on: true,
        from: hhmmToLabel(only.startsAt),
        to: hhmmToLabel(only.endsAt),
        patternIds: [],
      };
    }
    const ids = today.map((s) => {
      const key = patternKey(s);
      if (!patterns.has(key)) {
        patterns.set(key, {
          id: key,
          name: s.label,
          from: hhmmToLabel(s.startsAt),
          to: hhmmToLabel(s.endsAt),
        });
      }
      return key;
    });
    return { day, on: true, from: DEFAULT_FROM, to: DEFAULT_TO, patternIds: ids };
  });
  return { week, patterns: [...patterns.values()] };
}

/**
 * The weekly editor's grid → the full replacement set of sessions. Plain days
 * become one standard session (code by start time); pattern days become one
 * session per pattern, coded `custom-N` (unique per weekday, as the backend
 * requires). Unreadable windows are skipped — the editor validates them.
 */
export function gridToSessions(grid: WeekGrid): WeeklySession[] {
  const byId = new Map(grid.patterns.map((p) => [p.id, p]));
  const sessions: WeeklySession[] = [];
  grid.week.forEach((d, weekday) => {
    if (!d.on) return;
    const patternIds = (d.patternIds ?? []).filter((id) => byId.has(id));
    if (patternIds.length === 0) {
      const startsAt = labelToHhmm(d.from);
      const endsAt = labelToHhmm(d.to);
      const start = timeLabelToMinutes(d.from);
      if (!startsAt || !endsAt || start == null) return;
      const std = standardFor(start);
      sessions.push({ weekday, sessionCode: std.code, label: std.label, startsAt, endsAt });
      return;
    }
    patternIds.forEach((id, index) => {
      const p = byId.get(id);
      const startsAt = p ? labelToHhmm(p.from) : null;
      const endsAt = p ? labelToHhmm(p.to) : null;
      if (!p || !startsAt || !endsAt) return;
      sessions.push({
        weekday,
        sessionCode: `${CUSTOM_CODE_PREFIX}${index + 1}`,
        label: p.name,
        startsAt,
        endsAt,
      });
    });
  });
  return sessions;
}

/** Whether two session sets are the same schedule (order-insensitive). */
export function sameSessions(a: readonly WeeklySession[], b: readonly WeeklySession[]): boolean {
  const key = (s: WeeklySession) => `${s.weekday}|${s.label}|${s.startsAt}|${s.endsAt}`;
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.length === right.length && left.every((k, i) => k === right[i]);
}

/**
 * The time dropdown's options, plus `current` when the backend holds a time
 * outside the standard list (e.g. 9:15 am) — so the select shows the real
 * value instead of silently falling back to the first option.
 */
export function timeOptionsWith(current: string): readonly string[] {
  if ((TIME_OPTS as readonly string[]).includes(current)) return TIME_OPTS;
  const minutes = timeLabelToMinutes(current);
  if (minutes == null) return TIME_OPTS;
  return [...TIME_OPTS, current].sort(
    (a, b) => (timeLabelToMinutes(a) ?? 0) - (timeLabelToMinutes(b) ?? 0),
  );
}
