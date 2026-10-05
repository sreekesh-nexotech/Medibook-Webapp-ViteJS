import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { tokenQueueKeys } from '@/features/token-queue/application/queries/tokenQueue.keys';
import { fetchSessions } from '@/features/token-queue/application/usecases/tokenQueue.fetchSessions';

/**
 * Live pushes keep the queue current (`useQueueLive`); this refetch is only
 * the safety net for a dropped socket.
 */
const SESSIONS_REFETCH_MS = 60_000;
const SESSIONS_STALE_TIME_MS = 10_000;

/** Every doctor session on a hospital-local date. */
export function useQueueSessionsQuery(date: string) {
  return useQuery({
    queryKey: tokenQueueKeys.sessionsOn(date),
    queryFn: async () => unwrap(await fetchSessions(date)),
    staleTime: SESSIONS_STALE_TIME_MS,
    refetchInterval: SESSIONS_REFETCH_MS,
  });
}
