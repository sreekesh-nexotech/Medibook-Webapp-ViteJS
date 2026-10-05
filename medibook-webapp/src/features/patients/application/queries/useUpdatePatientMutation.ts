import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PatientDemographics } from '@/features/patients/domain/entities/patients.entities';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { updatePatient } from '@/features/patients/application/usecases/updatePatient';

interface UpdatePatientInput {
  readonly id: string;
  readonly changes: Partial<PatientDemographics>;
  /** The version the form was opened on, sent as `If-Match`. */
  readonly version: number;
}

/**
 * Edit a record. Settles either way by re-reading the patients cache: an
 * applied edit or a new pending request changes what the detail shows, and a
 * version conflict means the cached copy is stale.
 */
export function useUpdatePatientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes, version }: UpdatePatientInput) =>
      unwrap(await updatePatient(id, changes, version)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: patientsKeys.all }),
  });
}
