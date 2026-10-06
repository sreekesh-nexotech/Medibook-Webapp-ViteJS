import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalProfileChanges } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import {
  hospitalsKeys,
  mergeHospitalDetail,
} from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { updatePlatformHospital } from '@/features/ops-hospitals/application/usecases/updatePlatformHospital';

interface UpdateHospitalInput {
  readonly id: string;
  readonly changes: HospitalProfileChanges;
  readonly version: number;
}

/** Correct a hospital's profile or switch online booking (`If-Match` on its version). */
export function useUpdatePlatformHospitalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes, version }: UpdateHospitalInput) =>
      unwrap(await updatePlatformHospital(id, changes, version)),
    onSuccess: (hospital) => mergeHospitalDetail(queryClient, hospital),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.all });
    },
  });
}
