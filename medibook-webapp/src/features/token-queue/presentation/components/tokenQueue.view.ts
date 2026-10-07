import type {
  QueueSession,
  QueueState,
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

/** A token is with the desk (called or in consultation). */
export function isServing(session: QueueSession): boolean {
  return session.currentTokenNo !== null;
}

/** Statuses of a token still in the queue (backend `queue.WAITING`). */
function isWaiting(a: DeskAppointment): boolean {
  return a.status === 'scheduled' || a.status === 'checked_in';
}

function byToken(a: DeskAppointment, b: DeskAppointment): number {
  return (a.tokenNo ?? Number.MAX_SAFE_INTEGER) - (b.tokenNo ?? Number.MAX_SAFE_INTEGER);
}

/**
 * Who "Call Next" will call, in order: this session's waiting tokens that
 * have not been called yet, by token number — the backend's own rule (queue
 * order is strictly `token_no`, Q25; `call_next` skips called tokens).
 */
export function upNextFor(
  session: QueueSession,
  appointments: readonly DeskAppointment[],
): readonly DeskAppointment[] {
  return appointments
    .filter(
      (a) =>
        a.sessionId === session.id &&
        isWaiting(a) &&
        a.calledAt === null &&
        a.id !== session.currentAppointmentId,
    )
    .sort(byToken);
}

/**
 * Tokens called earlier and skipped: still waiting, but "Call Next" passes
 * them by. The desk calls them back one at a time (`POST …/call`).
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
        a.calledAt !== null &&
        a.id !== session.currentAppointmentId,
    )
    .sort(byToken);
}
