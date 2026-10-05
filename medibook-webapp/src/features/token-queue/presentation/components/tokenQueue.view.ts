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

/**
 * Today's appointments in this session that are still waiting to be called
 * (scheduled or checked in), by booking order — the desk's view of "up next".
 * Appointments carry the doctor and session label, not the session id, so
 * that pair identifies the session.
 */
export function upNextFor(
  session: QueueSession,
  appointments: readonly DeskAppointment[],
): readonly DeskAppointment[] {
  return appointments
    .filter(
      (a) =>
        a.doctor.id === session.doctorId &&
        a.sessionLabel === session.label &&
        a.scheduledDate === session.date &&
        (a.status === 'scheduled' || a.status === 'checked_in') &&
        a.id !== session.currentAppointmentId,
    )
    .sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));
}
