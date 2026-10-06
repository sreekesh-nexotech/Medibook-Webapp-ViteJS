import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  hospitalsKeys,
  mergeHospitalDetail,
} from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { openHospitalToPatients } from '@/features/ops-hospitals/application/usecases/openHospitalToPatients';

/** Make a hospital findable and bookable in the patient app in one step. */
export function useOpenHospitalToPatientsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await openHospitalToPatients(id)),
    onSuccess: (hospital) => mergeHospitalDetail(queryClient, hospital),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.all });
    },
  });
}
