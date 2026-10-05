import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { exportComplianceLogins } from '@/features/ops-compliance/application/usecases/exportComplianceLogins';
import type { LoginHistoryFilters } from '@/features/ops-compliance/domain/entities/compliance.entities';

/** Gather every sign-in matching the filters, on demand, for CSV. Writes nothing. */
export function useExportComplianceLoginsMutation() {
  return useMutation({
    mutationFn: async (filters: LoginHistoryFilters) =>
      unwrap(await exportComplianceLogins(filters)),
  });
}
