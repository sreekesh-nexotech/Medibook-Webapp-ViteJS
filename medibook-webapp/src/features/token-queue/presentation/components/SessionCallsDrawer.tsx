import { useMemo } from 'react';

import { formatTimeIn } from '@/shared/lib/hospitalTime';
import { Drawer } from '@/shared/ui/Drawer';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Spinner } from '@/shared/ui/Spinner';

import { isFailure } from '@/core/error/failure';

import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
import type { QueueSession } from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { useSessionCallsQuery } from '@/features/token-queue/application/queries/tokenQueue.queries';

import { callEventLabel, callTokenLabel } from './tokenQueue.view';

interface SessionCallsDrawerProps {
  /** The session whose history to show; `null` = closed. */
  session: QueueSession | null;
  doctorName: string;
  /** Today's appointments, to name each call's token and patient. */
  appointments: readonly DeskAppointment[];
  timeZone: string;
  onClose: () => void;
}

/**
 * A session's call history (`GET /hospital/sessions/{id}/calls`, the
 * append-only `token_calls`): who was called, skipped, recalled, started or
 * marked no-show, when, and from which counter — newest first.
 */
export function SessionCallsDrawer({
  session,
  doctorName,
  appointments,
  timeZone,
  onClose,
}: SessionCallsDrawerProps) {
  const calls = useSessionCallsQuery(session?.id ?? null);
  const byId = useMemo(() => new Map(appointments.map((a) => [a.id, a])), [appointments]);

  return (
    <Drawer
      open={session !== null}
      onClose={onClose}
      title="Call history"
      subtitle={session ? `${doctorName} · ${session.label}` : undefined}
      width={420}
    >
      {calls.isPending ? (
        <div className="text-text-muted flex justify-center py-10">
          <Spinner size={26} label="Loading the call history" />
        </div>
      ) : calls.isError ? (
        <ErrorState
          inline
          title="The call history did not load"
          message={isFailure(calls.error) ? calls.error.message : undefined}
          onRetry={() => void calls.refetch()}
        />
      ) : calls.data.length === 0 ? (
        <EmptyState
          compact
          icon="ticket"
          title="No tokens called yet."
          message="Calls, skips and no-shows in this session appear here as they happen."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {calls.data.map((c) => {
            const appt = byId.get(c.appointmentId);
            const who = [c.actorName, c.counterCode ? `counter ${c.counterCode}` : null]
              .filter(Boolean)
              .join(' · ');
            return (
              <li
                key={c.id}
                className="border-border-soft flex items-start gap-3 rounded-md border bg-white px-3.5 py-2.5"
              >
                <span className="text-body text-blue w-16 flex-none font-bold">
                  {callTokenLabel(c, byId)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-body text-text-strong font-medium">
                    {callEventLabel(c.event)}
                    {c.attemptNo > 1 && c.event !== 'served' ? ` · attempt ${c.attemptNo}` : ''}
                  </div>
                  <div className="text-caption text-text-muted truncate">
                    {[appt?.patient?.fullName, who].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <span className="text-caption text-text-muted flex-none tabular-nums">
                  {formatTimeIn(c.occurredAt, timeZone)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
