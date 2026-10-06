import type { QueryClient } from '@tanstack/react-query';

import type { QueueSession } from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { refreshTodayAppointmentLists } from '@/features/appointments/application/queries/appointments.refresh';
import { tokenQueueKeys } from '@/features/token-queue/application/queries/tokenQueue.keys';

/**
 * Put a fresh session snapshot into every cached session list, keeping the
 * newer version when a push and a command answer race; then let today's
 * appointment lists (H7) re-read the statuses the command changed, once per
 * burst (RUN-09).
 */
export function applySession(queryClient: QueryClient, session: QueueSession): void {
  queryClient.setQueriesData<readonly QueueSession[]>(
    { queryKey: tokenQueueKeys.sessions() },
    (rows) => rows?.map((s) => (s.id === session.id && session.version >= s.version ? session : s)),
  );
  refreshTodayAppointmentLists(queryClient);
}
