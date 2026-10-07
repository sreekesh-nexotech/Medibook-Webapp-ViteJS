import type { QueryClient } from '@tanstack/react-query';

import type { QueueSession } from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { tokenQueueKeys } from '@/features/token-queue/application/queries/tokenQueue.keys';

/**
 * Put a fresh session snapshot into every cached session list, keeping the
 * newer version when a push and a command answer race; then let the
 * appointment lists (H7) re-read the statuses the command changed, and the
 * session's call history pick up the new call.
 */
export function applySession(queryClient: QueryClient, session: QueueSession): void {
  queryClient.setQueriesData<readonly QueueSession[]>(
    { queryKey: tokenQueueKeys.sessions() },
    (rows) => rows?.map((s) => (s.id === session.id && session.version >= s.version ? session : s)),
  );
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.calls(session.id) });
}

/** Something about the day's bookings changed without a snapshot (a booking or a cancel). */
export function refreshQueue(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.sessions() });
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
}
