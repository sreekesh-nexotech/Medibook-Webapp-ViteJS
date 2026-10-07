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
  refreshBookings(queryClient);
  void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.calls(session.id) });
}

/** Something about the day's bookings changed without a snapshot (a booking or a cancel). */
export function refreshQueue(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.sessions() });
  refreshBookings(queryClient);
}

/**
 * A queue change moves bookings on (called, with the doctor, done, no-show):
 * the lists re-read their statuses, and so does an open appointment drawer
 * with its history — a token called on Token Management offers No-show in
 * the drawer straight away (UAT R-10).
 */
function refreshBookings(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.details() });
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.eventLists() });
}
