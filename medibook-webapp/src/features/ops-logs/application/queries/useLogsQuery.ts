import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuditLogQuery } from '@/features/ops-logs/domain/entities/logs.types';
import { logsKeys } from '@/features/ops-logs/application/queries/logs.keys';
import { fetchLogs } from '@/features/ops-logs/application/usecases/fetchLogs';

/** The trail grows as people work; 30 s keeps paging snappy without going stale. */
const LOGS_STALE_TIME_MS = 30_000;

/**
 * One page of the platform audit trail (`GET /platform/logs`). The previous
 * page stays on screen while the next one loads, so paging and filtering do
 * not blank the table.
 */
export function useLogsQuery(query: AuditLogQuery, enabled = true) {
  return useQuery({
    enabled,
    queryKey: logsKeys.list(query),
    queryFn: async () => unwrap(await fetchLogs(query)),
    staleTime: LOGS_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
