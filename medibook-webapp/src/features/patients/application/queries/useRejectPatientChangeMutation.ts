import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
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
    onSettled: async () => {
      // The admin dashboard counts pending patient changes.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: patientsKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
    },
  });
}
