import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { deletePatient } from '@/features/patients/application/usecases/deletePatient';

interface DeletePatientInput {
  readonly id: string;
  /** The version the record was read at, sent as `If-Match`. */
  readonly version: number;
}

/**
 * Delete (soft-delete) a record, or send the deletion to an admin when the
 * hospital requires approval (D-29). Either way the patients cache is re-read.
 */
export function useDeletePatientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: DeletePatientInput) =>
      unwrap(await deletePatient(id, version)),
    onSettled: async () => {
      // The admin dashboard counts pending patient changes.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: patientsKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
    },
  });
}
