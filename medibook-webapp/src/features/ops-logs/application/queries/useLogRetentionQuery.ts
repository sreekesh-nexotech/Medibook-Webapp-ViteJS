import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { logsKeys } from '@/features/ops-logs/application/queries/logs.keys';
import { fetchLogRetention } from '@/features/ops-logs/application/usecases/fetchLogRetention';

/** Retention windows are fixed in the backend's code; one read per session is enough. */
const RETENTION_STALE_MS = 60 * 60 * 1000;

/**
 * The retention windows the backend applies (B6). An older backend answers
 * 404 — callers fall back to the documented 3 years, so no retry.
 */
export function useLogRetentionQuery() {
  return useQuery({
    queryKey: logsKeys.retention(),
    queryFn: async () => unwrap(await fetchLogRetention()),
    staleTime: RETENTION_STALE_MS,
    retry: false,
  });
}
