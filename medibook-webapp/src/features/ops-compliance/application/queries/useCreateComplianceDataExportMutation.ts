import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';
import { createComplianceDataExport } from '@/features/ops-compliance/application/usecases/createComplianceDataExport';
import type { DataExportDraft } from '@/features/ops-compliance/domain/entities/compliance.entities';

/** File a data-subject export request. */
export function useCreateComplianceDataExportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: DataExportDraft) => unwrap(await createComplianceDataExport(draft)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: complianceKeys.requests() });
    },
  });
}
