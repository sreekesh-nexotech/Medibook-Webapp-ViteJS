import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuditLogFilters } from '@/features/ops-logs/domain/entities/logs.types';
import { exportLogsCsv } from '@/features/ops-logs/application/usecases/exportLogsCsv';

/** The filtered audit trail as CSV text, from the server export. Reads only — nothing to invalidate. */
export function useExportLogsMutation() {
  return useMutation({
    mutationFn: async (filters: AuditLogFilters) => unwrap(await exportLogsCsv(filters)),
  });
}
