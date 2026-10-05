import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PatientDemographics } from '@/features/patients/domain/entities/patients.entities';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { createPatient } from '@/features/patients/application/usecases/createPatient';

/** Register a patient at the desk (the backend mints the MRN). */
export function useCreatePatientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (demographics: PatientDemographics) =>
      unwrap(await createPatient(demographics)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patientsKeys.lists() }),
  });
}
