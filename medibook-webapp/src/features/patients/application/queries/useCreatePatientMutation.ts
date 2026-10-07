import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PatientCreateInput } from '@/features/patients/domain/entities/patients.entities';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { createPatient } from '@/features/patients/application/usecases/createPatient';

/**
 * Register a patient at the desk (the backend mints the MRN). The outcome may
 * be a list of possible matches to rule on instead (M-14).
 */
export function useCreatePatientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PatientCreateInput) => unwrap(await createPatient(input)),
    onSuccess: (outcome) => {
      if (outcome.status !== 'matchReview') {
        void queryClient.invalidateQueries({ queryKey: patientsKeys.lists() });
      }
    },
  });
}
