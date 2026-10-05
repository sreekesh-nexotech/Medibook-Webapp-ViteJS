import { useQueryClient } from '@tanstack/react-query';

import { logsKeys } from '@/features/ops-logs/application/queries/logs.keys';

/**
 * Mark every cached audit-trail page stale and re-fetch the ones on screen.
 * Resolves once the active refetch settles, so a Refresh spinner can await it.
 */
export function useRefreshLogs(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: logsKeys.lists() });
}
