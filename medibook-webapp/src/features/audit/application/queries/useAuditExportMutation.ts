import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuditLogFilters } from '@/features/audit/domain/entities/audit.log';
import { exportAuditLog } from '@/features/audit/application/usecases/exportAuditLog';

/**
 * Fetch the server-rendered CSV for the current filters. A read, so there is
 * nothing to invalidate; it is a mutation because the user triggers it and
 * its result is a one-off file, not cached server state.
 */
export function useAuditExportMutation() {
  return useMutation({
    mutationFn: async (filters: AuditLogFilters) => unwrap(await exportAuditLog(filters)),
  });
}
