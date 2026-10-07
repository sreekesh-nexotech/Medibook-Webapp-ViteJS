import type {
  QueueRow,
  QueueSession,
  QueueState,
  TokenCall,
  TokenCallEvent,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';
import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';

/** View helpers for the live queue. Pure, no React. */

export type QueuePill =
  'Available' | 'Waiting' | 'Consulting' | 'On Break' | 'Not opened' | 'Closed';

const STATE_PILL: Readonly<Record<QueueState, QueuePill>> = {
  available: 'Available',
  waiting: 'Waiting',
  consulting: 'Consulting',
  on_break: 'On Break',
};

/** The card's status pill: the session's lifecycle first, then what the doctor is doing. */
export function pillFor(session: QueueSession): QueuePill {
  if (session.status === 'scheduled') return 'Not opened';
  if (session.status === 'closed' || session.status === 'cancelled') return 'Closed';
  return STATE_PILL[session.queueState];
}

const MS_PER_MINUTE = 60_000;

/** Whole minutes since `iso`, never negative; `null` without a time. */
export function minutesSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : Math.max(0, Math.round((now - at) / MS_PER_MINUTE));
}

export function isLiveSession(session: QueueSession): boolean {
  return session.status === 'open' || session.status === 'paused';
}

/**
 * A patient is at the desk (called, or with the doctor) — UAT-01. The
 * backend clears `current_appointment_id` on complete, skip, no-show and
 * close; `current_token_no` is only its progress pointer and is never
 * cleared, so it must not be read as "serving". Whenever the appointment id
 * is set, `current_token_no` is that appointment's token.
 */
export function isServing(session: QueueSession): boolean {
  return session.currentAppointmentId !== null && session.currentTokenNo !== null;
}

/** The token at the desk, when there is one. */
export function servingTokenNo(session: QueueSession): number | null {
  return isServing(session) ? session.currentTokenNo : null;
}

/**
 * The label of the token at the desk: the backend's own label (BE-20
 * `current_token_label`), else the appointment's, else its number — never a
 * made-up hospital format.
 */
export function servingLabel(
  session: QueueSession,
  servingAppointment: DeskAppointment | null,
): string | null {
  if (!isServing(session)) return null;
  return (
    session.currentTokenLabel ?? servingAppointment?.tokenLabel ?? `#${session.currentTokenNo}`
  );
}

/** When the timer at the desk started: consultation start when known, else the call. */
export function servingSince(
  session: QueueSession,
  servingAppointment: DeskAppointment | null,
): string | null {
  if (!isServing(session)) return null;
  if (session.queueState === 'consulting') {
    return (
      session.consultationStartedAt ??
      servingAppointment?.consultationStartedAt ??
      session.lastCalledAt
    );
  }
  return session.lastCalledAt;
}

/** Statuses of a token still in the queue (backend `queue.WAITING`). */
function isWaiting(a: DeskAppointment): boolean {
  return a.status === 'scheduled' || a.status === 'checked_in';
}

function byToken(a: DeskAppointment, b: DeskAppointment): number {
  return (a.tokenNo ?? Number.MAX_SAFE_INTEGER) - (b.tokenNo ?? Number.MAX_SAFE_INTEGER);
}

/**
 * Who "Call Next" will call, in the order it calls them — the backend's own
 * rule (`queue.call_next`): waiting tokens not called yet, first those after
 * the last token called, smallest first, then wrapping round to the smallest
 * one left (tokens reused from the pool or a reserved range sit below the
 * pointer). Strictly by token number otherwise (Q25); there is no reorder
 * (Q26).
 */
export function upNextFor(
  session: QueueSession,
  appointments: readonly DeskAppointment[],
): readonly DeskAppointment[] {
  const pointer = session.lastCalledTokenNo ?? 0;
  const pending = appointments
    .filter(
      (a) =>
        a.sessionId === session.id &&
        isWaiting(a) &&
        a.tokenNo !== null &&
        a.calledAt === null &&
        a.id !== session.currentAppointmentId,
    )
    .sort(byToken);
  const after = pending.filter((a) => (a.tokenNo ?? 0) > pointer);
  const before = pending.filter((a) => (a.tokenNo ?? 0) <= pointer);
  return [...after, ...before];
}

/**
 * Tokens called earlier and skipped: still waiting, but "Call Next" passes
 * them by. The desk calls them back one at a time (`POST …/recall`).
 */
export function skippedFor(
  session: QueueSession,
  appointments: readonly DeskAppointment[],
): readonly DeskAppointment[] {
  return appointments
    .filter(
      (a) =>
        a.sessionId === session.id &&
        isWaiting(a) &&
        a.tokenNo !== null &&
        a.calledAt !== null &&
        a.id !== session.currentAppointmentId,
    )
    .sort(byToken);
}

/* ----------------------------------------------------------- queue lists */

/** One token as a queue card shows it, from the server's queue or the day's bookings. */
export interface QueueTicket {
  readonly appointmentId: string;
  readonly tokenNo: number;
  /** The hospital's label, else `#N` — never a made-up format. */
  readonly label: string;
  readonly patientName: string | null;
  readonly skipCount: number;
  /** The skip limit is reached: the desk may mark a no-show (Q27, never automatic). */
  readonly offerNoShow: boolean;
  readonly estimatedWaitMinutes: number | null;
}

/** What one session card lists. */
export interface SessionQueue {
  /** In the order Call Next calls them. */
  readonly upNext: readonly QueueTicket[];
  /** Called earlier and passed by; the desk calls them back one at a time. */
  readonly skipped: readonly QueueTicket[];
  /** With the doctor but no longer at the desk — Done still applies to them. */
  readonly withDoctor: readonly QueueTicket[];
  /** The patient at the desk, when known. */
  readonly servingName: string | null;
  /** How many tokens Call Next can still call (B5 `up_next_count` when sent). */
  readonly upNextCount: number;
}

function ticketFromAppointment(session: QueueSession, a: DeskAppointment): QueueTicket {
  const limit = session.noShowCallAttempts;
  return {
    appointmentId: a.id,
    tokenNo: a.tokenNo ?? 0,
    label: a.tokenLabel ?? `#${a.tokenNo ?? ''}`,
    patientName: a.patient?.fullName ?? null,
    skipCount: a.noShowAttempts,
    offerNoShow: limit !== null && a.calledAt !== null && a.noShowAttempts >= limit,
    estimatedWaitMinutes: null,
  };
}

function ticketFromRow(row: QueueRow, appointment: DeskAppointment | undefined): QueueTicket {
  return {
    appointmentId: row.appointmentId,
    tokenNo: row.tokenNo,
    label: row.tokenLabel ?? appointment?.tokenLabel ?? `#${row.tokenNo}`,
    patientName: row.patientName ?? appointment?.patient?.fullName ?? null,
    skipCount: row.skipCount,
    offerNoShow: row.offerNoShow,
    estimatedWaitMinutes: row.estimatedWaitMinutes,
  };
}

/**
 * The session's lists. The server's own queue (B5 `queue`) is the truth when
 * sent — exact Call Next order, skips and names; an older backend's
 * snapshot has none, so the lists are derived from the day's bookings with
 * the same rule (`upNextFor`, `skippedFor`).
 */
export function sessionQueue(
  session: QueueSession,
  appointments: readonly DeskAppointment[],
): SessionQueue {
  const byId = new Map(appointments.map((a) => [a.id, a]));
  const serving = byId.get(session.currentAppointmentId ?? '');
  if (session.queue) {
    const rows = session.queue;
    const of = (kind: QueueRow['kind']) =>
      rows
        .filter((r) => r.kind === kind && r.appointmentId !== session.currentAppointmentId)
        .map((r) => ticketFromRow(r, byId.get(r.appointmentId)));
    const upNext = of('up_next');
    const current = rows.find((r) => r.appointmentId === session.currentAppointmentId);
    return {
      upNext,
      skipped: of('called'),
      withDoctor: of('in_consultation'),
      servingName: current?.patientName ?? serving?.patient?.fullName ?? null,
      upNextCount: session.upNextCount ?? upNext.length,
    };
  }
  const upNext = upNextFor(session, appointments).map((a) => ticketFromAppointment(session, a));
  return {
    upNext,
    skipped: skippedFor(session, appointments).map((a) => ticketFromAppointment(session, a)),
    withDoctor: appointments
      .filter(
        (a) =>
          a.sessionId === session.id &&
          a.status === 'in_consultation' &&
          a.id !== session.currentAppointmentId &&
          a.tokenNo !== null,
      )
      .sort(byToken)
      .map((a) => ticketFromAppointment(session, a)),
    servingName: serving?.patient?.fullName ?? null,
    upNextCount: session.upNextCount ?? upNext.length,
  };
}

/** What the session's main button can do right now. */
export type CallNextState =
  { readonly kind: 'ready' } | { readonly kind: 'blocked'; readonly reason: string };

/**
 * "Call Next" only when the session is open, nobody is at the desk and an
 * un-called token waits (UAT-46: with only skipped tokens left the backend
 * answers "No waiting tokens", so the desk is pointed at Skipped instead).
 */
export function callNextState(
  session: QueueSession,
  upNextCount: number,
  skippedCount: number,
): CallNextState {
  if (session.status === 'paused') {
    return { kind: 'blocked', reason: 'Resume the session to call the next token.' };
  }
  if (session.status !== 'open') {
    return { kind: 'blocked', reason: 'The session is not open.' };
  }
  if (isServing(session)) {
    return { kind: 'blocked', reason: 'Finish or skip the token at the desk first.' };
  }
  if (upNextCount > 0) return { kind: 'ready' };
  if (skippedCount > 0) {
    return {
      kind: 'blocked',
      reason: 'Only skipped tokens are waiting — call one back from Skipped.',
    };
  }
  return { kind: 'blocked', reason: 'Nobody is waiting.' };
}

/**
 * A no-show is offered only for today's session, and only for a token that
 * has been called or skipped (Q27, Q87 — never automatic, never ahead of the
 * day: UAT-13, M-18).
 */
export function canOfferNoShow(session: QueueSession, today: string, wasCalled: boolean): boolean {
  return session.date === today && isLiveSession(session) && wasCalled;
}

/**
 * What the close confirmation says: closing while tokens still wait is
 * allowed (the backend has no such rule), but the desk is told what it
 * leaves behind (UAT-46, T15).
 */
export function closeSessionCopy(doctorName: string, label: string, waiting: number): string {
  const base = `Close ${doctorName}'s ${label} session for today? No more tokens can be called in it.`;
  if (waiting <= 0) return base;
  const who = waiting === 1 ? '1 patient is' : `${waiting} patients are`;
  return `${base} ${who} still waiting — they stay booked; mark them as no-shows or cancel them from Appointments.`;
}

/* -------------------------------------------------------- queue refusals */

/** Desk wording for the queue's refusals (B5); others keep the server's message. */
const QUEUE_REFUSALS: Readonly<Record<string, string>> = {
  SESSION_NOT_TODAY: 'This session is not today’s — its tokens can only be called on its own day.',
  TOKEN_NOT_CALLED: 'Only a token that was called or skipped can be marked a no-show.',
  TOKEN_NOT_CURRENT:
    'That token is no longer at the desk or with the doctor — the queue has been refreshed.',
};

/** Refusals that mean this card's picture of the queue is out of date. */
const STALE_CODES: ReadonlySet<string> = new Set(['TOKEN_NOT_CURRENT', 'TOKEN_NOT_CALLED']);

export function queueRefusalText(code: string | null, message: string): string {
  return (code && QUEUE_REFUSALS[code]) || message;
}

export function isStaleQueueRefusal(code: string | null): boolean {
  return code !== null && STALE_CODES.has(code);
}

/* --------------------------------------------------------------- calls log */

const EVENT_LABEL: Readonly<Record<TokenCallEvent, string>> = {
  called: 'Called',
  recalled: 'Called again',
  skipped: 'Skipped',
  served: 'Consultation started',
  no_show: 'Marked no-show',
  cancelled: 'Cancelled',
};

/** Readable wording for a `token_calls.event`. */
export function callEventLabel(event: TokenCallEvent): string {
  return EVENT_LABEL[event];
}

/** The token a call row names: its own label when sent, else the appointment's, else `#N`. */
export function callTokenLabel(
  call: TokenCall,
  appointmentsById: ReadonlyMap<string, DeskAppointment>,
): string {
  return (
    call.tokenLabel ?? appointmentsById.get(call.appointmentId)?.tokenLabel ?? `#${call.tokenNo}`
  );
}
