import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuditLogPageQuery } from '@/features/audit/domain/entities/audit.log';
import { auditKeys } from '@/features/audit/application/queries/audit.keys';
import { fetchAuditLog } from '@/features/audit/application/usecases/fetchAuditLog';

/** New rows arrive with every staff write; half a minute keeps paging snappy without going stale. */
const AUDIT_LOG_STALE_TIME_MS = 30_000;

/**
 * One page of the hospital audit log. The previous page stays on screen while
 * the next one loads, so paging and filtering do not flash an empty table.
 */
export function useAuditLogQuery(query: AuditLogPageQuery, enabled = true) {
  return useQuery({
    queryKey: auditKeys.log(query),
    queryFn: async () => unwrap(await fetchAuditLog(query)),
    placeholderData: keepPreviousData,
    staleTime: AUDIT_LOG_STALE_TIME_MS,
    enabled,
  });
}
