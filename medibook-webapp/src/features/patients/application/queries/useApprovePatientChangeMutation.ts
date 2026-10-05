import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { approvePatientChange } from '@/features/patients/application/usecases/approvePatientChange';

/** Admin: apply a pending edit (or soft-delete) on a patient record (D-29). */
export function useApprovePatientChangeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => unwrap(await approvePatientChange(requestId)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: patientsKeys.all }),
  });
}
