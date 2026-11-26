import type {
  DisplayBoard,
  DisplayDoctorOffToday,
  DisplaySession,
} from '@/features/display/domain/entities/display.types';

/** What the hall reads under the doctor's name. */
export function sessionStateLabel(session: DisplaySession): string {
  if (session.status === 'closed') return 'Session closed';
  if (session.status === 'paused' || session.queueState === 'on_break') return 'On a short break';
  if (session.status === 'scheduled') return 'Not started yet';
  return session.currentToken ? 'Now consulting' : 'Waiting for the next token';
}

/** "3 waiting" / "1 waiting" / "No one waiting". */
export function waitingLabel(count: number): string {
  return count > 0 ? `${count} waiting` : 'No one waiting';
}

/** The token the hall reads: its plain number (3), or the label from an older backend. */
export function tokenNumber(session: DisplaySession): string | null {
  return session.currentTokenNo != null ? String(session.currentTokenNo) : session.currentToken;
}

/** One row of the board (client feedback point 7): a doctor working today, or one who is not. */
export type BoardRow =
  | { readonly kind: 'session'; readonly key: string; readonly session: DisplaySession }
  | { readonly kind: 'off'; readonly key: string; readonly doctor: DisplayDoctorOffToday };

/** Which of a doctor's sessions today the row shows: the running one, else the next, else done. */
const SESSION_RANK: Record<string, number> = { open: 0, paused: 1, scheduled: 2, closed: 3 };
const rankOf = (s: DisplaySession) => SESSION_RANK[s.status] ?? 2;

/**
 * The rows of the board, one per doctor as on the client's reference screen: a doctor with two
 * sessions today shows the one that matters now. Doctors still working today come first, by name,
 * so a row does not jump when its session opens; then doctors whose day is over; then the doctors
 * with no session today (greyed out, client decision 5) in the hospital's own order.
 */
export function boardRows(board: Pick<DisplayBoard, 'sessions' | 'doctorsOffToday'>): BoardRow[] {
  const byDoctor = new Map<string, DisplaySession>();
  for (const s of board.sessions) {
    const id = s.doctorId || `name:${s.doctorName}`;
    const kept = byDoctor.get(id);
    if (!kept || rankOf(s) < rankOf(kept)) byDoctor.set(id, s);
  }
  const done = (s: DisplaySession) => (s.status === 'closed' ? 1 : 0);
  const working: BoardRow[] = [...byDoctor.values()]
    .sort((a, b) => done(a) - done(b) || a.doctorName.localeCompare(b.doctorName))
    .map((session) => ({ kind: 'session', key: `s:${session.id}`, session }));
  const off: BoardRow[] = board.doctorsOffToday
    .filter((d) => !byDoctor.has(d.id))
    .map((doctor) => ({ kind: 'off', key: `d:${doctor.id}`, doctor }));
  return [...working, ...off];
}

/** What the patient column says for a doctor not working today. */
export function offTodayLabel(doctor: DisplayDoctorOffToday): string {
  return doctor.status === 'on_leave' ? 'On leave today' : 'Not available today';
}

/** Rows shown together on one page of the board, or every row when they all fit. */
export function pageOf<T>(rows: readonly T[], perPage: number, page: number): T[] {
  if (perPage <= 0 || rows.length <= perPage) return [...rows];
  const start = (page % pageCount(rows.length, perPage)) * perPage;
  return rows.slice(start, start + perPage);
}

export function pageCount(rowCount: number, perPage: number): number {
  return perPage > 0 ? Math.max(1, Math.ceil(rowCount / perPage)) : 1;
}

/**
 * How many rows of [rowPx] fit in [areaPx] with [gapPx] between them (at least one, so a tiny
 * window still shows something).
 */
export function rowsThatFit(areaPx: number, rowPx: number, gapPx: number): number {
  if (rowPx <= 0) return 0;
  return Math.max(1, Math.floor((areaPx + gapPx) / (rowPx + gapPx)));
}

/** `2026-10-16` → "Friday, 16 October 2026", read as a calendar date (no time zone shift). */
export function boardDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * The session whose token was called most recently, if that call is newer
 * than [since] — what the "Now calling" banner announces.
 */
export function latestCall(
  sessions: readonly DisplaySession[],
  since: string | null,
): DisplaySession | null {
  let latest: DisplaySession | null = null;
  for (const s of sessions) {
    if (!s.lastCalledAt || !s.currentToken) continue;
    if (!latest || Date.parse(s.lastCalledAt) > Date.parse(latest.lastCalledAt ?? '')) latest = s;
  }
  if (!latest?.lastCalledAt) return null;
  return since && Date.parse(latest.lastCalledAt) <= Date.parse(since) ? null : latest;
}

/**
 * The board's columns, after the client's reference screen (point 7): CONSULTANT | PATIENT | ROOM |
 * TOKEN on a 12-column grid (4 · 4 · 2 · 2), shared by the heading and every row so they line up.
 */
export const BOARD_GRID = 'grid grid-cols-12';
export const BOARD_COLUMN_SPANS = ['col-span-4', 'col-span-4', 'col-span-2', 'col-span-2'] as const;
