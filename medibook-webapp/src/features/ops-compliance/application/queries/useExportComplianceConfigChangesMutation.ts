import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { exportComplianceConfigChanges } from '@/features/ops-compliance/application/usecases/exportComplianceConfigChanges';
import type { ConfigChangeFilters } from '@/features/ops-compliance/domain/entities/compliance.entities';

/** Gather every configuration change matching the filters, on demand, for CSV. Writes nothing. */
export function useExportComplianceConfigChangesMutation() {
  return useMutation({
    mutationFn: async (filters: ConfigChangeFilters) =>
      unwrap(await exportComplianceConfigChanges(filters)),
  });
}
