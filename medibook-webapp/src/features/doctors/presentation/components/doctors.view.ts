import type { ShiftPattern, WeekDay } from '@/features/doctors/application/store/catalog.types';
import {
  minutesToTimeLabel,
  TIME_OPTS,
  timeLabelToMinutes,
  WEEK_DAYS,
} from '@/features/doctors/domain/calendar';
import type {
  DoctorScheduleHistory,
  DoctorStatus,
  LeaveKind,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';
import { fmtDate, parseHundredths } from '@/shared/lib/format';

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

/** What the patient app shows as a doctor's rating, and whether it is real reviews. */
export interface RatingView {
  /** "4.4", or "—" when there is nothing to show. */
  readonly value: string;
  /** Sort key (0 when unrated). */
  readonly sortValue: number;
  /** "(7)" for approved reviews; "starting rating" before the first review. */
  readonly note: string;
}

/**
 * The approved-review average, else the starting rating the patient app falls
 * back to (Q76), else nothing.
 */
export function ratingView(d: {
  readonly ratingAvg: number | null;
  readonly ratingCount: number;
  readonly ratingBase: number | null;
}): RatingView {
  if (d.ratingAvg !== null) {
    return { value: d.ratingAvg.toFixed(1), sortValue: d.ratingAvg, note: `(${d.ratingCount})` };
  }
  if (d.ratingBase !== null) {
    return { value: d.ratingBase.toFixed(1), sortValue: d.ratingBase, note: 'starting rating' };
  }
  return { value: '—', sortValue: 0, note: '(0)' };
}

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
  /**
   * The backend session code each loaded window had, keyed `weekday|patternId`
   * (`weekday|plain` for a plain day). Saving reuses these codes: the backend
   * keys a session by weekday + code, so a new code would retire the session
   * (and its bookings' queue) instead of editing it.
   */
  readonly codes?: Readonly<Record<string, string>>;
}

/** `codes` key for one window of a weekday. */
function codeKey(weekday: number, patternId: string | null): string {
  return `${weekday}|${patternId ?? 'plain'}`;
}

/**
 * Backend sessions → the weekly editor's grid. A day with one plain session
 * (`morning` labelled "Morning", …) is a single from–to window; any other
 * day runs on patterns — this doctor's distinct named sessions.
 */
export function sessionsToGrid(sessions: readonly WeeklySession[]): WeekGrid {
  const patterns = new Map<string, ShiftPattern>();
  const codes: Record<string, string> = {};
  const week = WEEK_DAYS.map((day, weekday): WeekDay => {
    const today = sessions
      .filter((s) => s.weekday === weekday)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    if (today.length === 0) {
      return { day, on: false, from: DEFAULT_FROM, to: DEFAULT_TO, patternIds: [] };
    }
    const only = today[0];
    if (today.length === 1 && isPlainSession(only)) {
      codes[codeKey(weekday, null)] = only.sessionCode;
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
          sessionCode: s.sessionCode,
        });
      }
      codes[codeKey(weekday, key)] = s.sessionCode;
      return key;
    });
    return { day, on: true, from: DEFAULT_FROM, to: DEFAULT_TO, patternIds: ids };
  });
  return { week, patterns: [...patterns.values()], codes };
}

/** The first `custom-N` code not yet taken on the day. */
function nextCustomCode(used: ReadonlySet<string>): string {
  for (let n = 1; ; n += 1) {
    const code = `${CUSTOM_CODE_PREFIX}${n}`;
    if (!used.has(code)) return code;
  }
}

/**
 * The weekly editor's grid → the full replacement set of sessions. Each
 * window keeps the code it was loaded with on that day, else its pattern's
 * code, else a standard code by start time (plain days) or the first free
 * `custom-N` — always unique per weekday, as the backend requires. Unreadable
 * windows are skipped — the editor validates them.
 */
export function gridToSessions(grid: WeekGrid): WeeklySession[] {
  const byId = new Map(grid.patterns.map((p) => [p.id, p]));
  const codes = grid.codes ?? {};
  const sessions: WeeklySession[] = [];
  grid.week.forEach((d, weekday) => {
    if (!d.on) return;
    const used = new Set<string>();
    const claim = (preferred: readonly (string | undefined)[]): string => {
      const code = preferred.find((c): c is string => c !== undefined && !used.has(c));
      const chosen = code ?? nextCustomCode(used);
      used.add(chosen);
      return chosen;
    };
    const patternIds = (d.patternIds ?? []).filter((id) => byId.has(id));
    if (patternIds.length === 0) {
      const startsAt = labelToHhmm(d.from);
      const endsAt = labelToHhmm(d.to);
      const start = timeLabelToMinutes(d.from);
      if (!startsAt || !endsAt || start == null) return;
      const std = standardFor(start);
      const sessionCode = claim([codes[codeKey(weekday, null)], std.code]);
      sessions.push({ weekday, sessionCode, label: std.label, startsAt, endsAt });
      return;
    }
    // Windows that already had a code on this day claim it first.
    const ordered = [...patternIds].sort(
      (a, b) =>
        Number(codes[codeKey(weekday, b)] !== undefined) -
        Number(codes[codeKey(weekday, a)] !== undefined),
    );
    ordered.forEach((id) => {
      const p = byId.get(id);
      const startsAt = p ? labelToHhmm(p.from) : null;
      const endsAt = p ? labelToHhmm(p.to) : null;
      if (!p || !startsAt || !endsAt) return;
      sessions.push({
        weekday,
        sessionCode: claim([codes[codeKey(weekday, id)], p.sessionCode]),
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
  if (TIME_OPTS.includes(current)) return TIME_OPTS;
  const minutes = timeLabelToMinutes(current);
  if (minutes == null) return TIME_OPTS;
  return [...TIME_OPTS, current].sort(
    (a, b) => (timeLabelToMinutes(a) ?? 0) - (timeLabelToMinutes(b) ?? 0),
  );
}

/* --------------------------------------------------------------------- fees */

const PAISE_PER_RUPEE = 100;
/** Digits with at most one dot and two decimals, as typed so far. */
const RUPEE_TYPING_PATTERN = /^\d*(\.\d{0,2})?$/;

/**
 * Paise → the text a fee input shows: whole rupees stay whole ("500"), paise
 * keep two places ("499.50"). Reading the integer paise — never a float
 * rupee value — is what keeps ₹499.50 from turning into ₹4,995 (UAT-08).
 */
export function paiseToRupeeInput(paise: number): string {
  const rupees = Math.trunc(paise / PAISE_PER_RUPEE);
  const rest = Math.abs(paise % PAISE_PER_RUPEE);
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, '0')}`;
}

/**
 * Keep what a person types into a rupee field to digits, one dot and two
 * decimals; anything else (₹, letters, a third decimal) is dropped.
 */
export function sanitizeRupeeInput(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const [whole = '', ...fraction] = cleaned.split('.');
  const next = fraction.length === 0 ? whole : `${whole}.${fraction.join('').slice(0, 2)}`;
  return RUPEE_TYPING_PATTERN.test(next) ? next : whole;
}

/** "499.5" → 49950 paise; `null` when the text is not an amount. */
export function rupeeInputToPaise(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed === '.') return null;
  return parseHundredths(trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed);
}

/**
 * A fee field: required, an amount with at most two decimals, ₹0 allowed —
 * the backend accepts `consultation_fee_paise ≥ 0` (06·Profile F4).
 */
export function feeError(text: string, label: string): string | undefined {
  if (text.trim() === '') return `${label} is required. Enter 0 for a free consultation.`;
  return rupeeInputToPaise(text) === null
    ? `${label} must be an amount in rupees, e.g. 500 or 499.50.`
    : undefined;
}

/* ------------------------------------------------------------ hours checks */

/**
 * Per-day problems in a weekly grid: an open day without patterns needs an
 * end after its start (06·Profile F6 — the backend answers `ends_at` 400
 * otherwise). Keyed by weekday index; empty when the week is fine.
 */
export function weekErrors(week: readonly WeekDay[]): Readonly<Record<number, string>> {
  const out: Record<number, string> = {};
  week.forEach((d, i) => {
    if (!d.on || (d.patternIds ?? []).length > 0) return;
    const from = timeLabelToMinutes(d.from);
    const to = timeLabelToMinutes(d.to);
    if (from == null || to == null) out[i] = 'Pick an opening and a closing time.';
    else if (to <= from) out[i] = 'The end time must be after the start time.';
  });
  return out;
}

/* --------------------------------------------------------- schedule history */

/** One past leave or date exception, as the history list shows it. */
export interface ScheduleHistoryLine {
  readonly key: string;
  /** ISO date the entry ended — the list is newest first. */
  readonly sortDate: string;
  readonly when: string;
  readonly what: string;
}

/**
 * The leave and date exceptions that are over: ended before `today`, the
 * hospital's calendar day (D-09, UAT-47) — the split the backend's schedule
 * read makes with `local_today(hospital.timezone)`. Newest first.
 */
export function pastScheduleLines(
  history: DoctorScheduleHistory,
  today: string,
): ScheduleHistoryLine[] {
  return [
    ...history.leaves
      .filter((l) => l.dateTo < today)
      .map((l) => ({
        key: `leave:${l.id}`,
        sortDate: l.dateTo,
        when:
          l.dateFrom === l.dateTo
            ? fmtDate(l.dateFrom)
            : `${fmtDate(l.dateFrom)} – ${fmtDate(l.dateTo)}`,
        what: `${LEAVE_KIND_LABEL[l.kind]} leave${l.reason ? ` · ${l.reason}` : ''}`,
      })),
    ...history.dateExceptions
      .filter((e) => e.date < today)
      .map((e) => ({
        key: `exception:${e.id}`,
        sortDate: e.date,
        when: fmtDate(e.date),
        what: `${
          e.kind === 'closed'
            ? 'Closed all day'
            : e.sessions
                .map((w) => `${hhmmToLabel(w.startsAt)} – ${hhmmToLabel(w.endsAt)}`)
                .join(', ')
        }${e.note ? ` · ${e.note}` : ''}`,
      })),
  ].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
}
