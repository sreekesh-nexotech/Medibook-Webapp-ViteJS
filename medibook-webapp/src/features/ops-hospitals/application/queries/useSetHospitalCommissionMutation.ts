import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalCommissionChange } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import {
  hospitalsKeys,
  mergeHospitalDetail,
} from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { setHospitalCommission } from '@/features/ops-hospitals/application/usecases/setHospitalCommission';

interface SetCommissionInput {
  readonly id: string;
  readonly change: HospitalCommissionChange;
}

/** Record a new commission rate from a given day (append-only history, Q9). */
export function useSetHospitalCommissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, change }: SetCommissionInput) =>
      unwrap(await setHospitalCommission(id, change)),
    onSuccess: (hospital) => mergeHospitalDetail(queryClient, hospital),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.all });
    },
  });
}
