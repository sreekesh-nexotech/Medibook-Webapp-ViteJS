import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { refreshAfterPatientDecision } from '@/features/patients/application/queries/patients.cache';
import { rejectPatientChange } from '@/features/patients/application/usecases/rejectPatientChange';

interface RejectPatientChangeInput {
  readonly requestId: string;
  /** Required by the backend. */
  readonly note: string;
}

/** Admin: turn down a pending change; the record stays as it is (D-29). */
export function useRejectPatientChangeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, note }: RejectPatientChangeInput) =>
      unwrap(await rejectPatientChange(requestId, note)),
    // The admin dashboard counts pending patient changes.
    onSettled: () => refreshAfterPatientDecision(queryClient),
  });
}
