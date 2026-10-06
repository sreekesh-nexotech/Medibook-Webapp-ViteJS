import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalAppVisibility } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import {
  hospitalsKeys,
  mergeHospitalDetail,
} from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { setHospitalVisibility } from '@/features/ops-hospitals/application/usecases/setHospitalVisibility';

interface SetVisibilityInput {
  readonly id: string;
  readonly visibility: HospitalAppVisibility;
}

/** List or unlist a hospital in the patient app. */
export function useSetHospitalVisibilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, visibility }: SetVisibilityInput) =>
      unwrap(await setHospitalVisibility(id, visibility)),
    onSuccess: (hospital) => mergeHospitalDetail(queryClient, hospital),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.all });
    },
  });
}
