import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalConvenienceFeeChange } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import {
  hospitalsKeys,
  mergeHospitalDetail,
} from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { setHospitalConvenienceFee } from '@/features/ops-hospitals/application/usecases/setHospitalConvenienceFee';

interface SetFeeInput {
  readonly id: string;
  readonly change: HospitalConvenienceFeeChange;
}

/** Change the patient convenience fee for future bookings (Q4). */
export function useSetHospitalConvenienceFeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, change }: SetFeeInput) =>
      unwrap(await setHospitalConvenienceFee(id, change)),
    onSuccess: (hospital) => mergeHospitalDetail(queryClient, hospital),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.all });
    },
  });
}
