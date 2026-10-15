import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { refreshAfterPatientDecision } from '@/features/patients/application/queries/patients.cache';
import { approvePatientChange } from '@/features/patients/application/usecases/approvePatientChange';

/** Admin: apply a pending edit (or soft-delete) on a patient record (D-29). */
export function useApprovePatientChangeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => unwrap(await approvePatientChange(requestId)),
    // The admin dashboard counts pending patient changes.
    onSettled: () => refreshAfterPatientDecision(queryClient),
  });
}
