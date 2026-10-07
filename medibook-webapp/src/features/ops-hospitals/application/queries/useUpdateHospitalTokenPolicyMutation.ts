import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { TokenPolicyChange } from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';
import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { updateHospitalTokenPolicy } from '@/features/ops-hospitals/application/usecases/updateHospitalTokenPolicy';

interface UpdateTokenPolicyInput {
  readonly hospitalId: string;
  readonly change: TokenPolicyChange;
  readonly version: number;
}

/** Override a hospital's token policy; the answer replaces the cached one. */
export function useUpdateHospitalTokenPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hospitalId, change, version }: UpdateTokenPolicyInput) =>
      unwrap(await updateHospitalTokenPolicy(hospitalId, change, version)),
    onSuccess: (policy, { hospitalId }) => {
      queryClient.setQueryData(hospitalsKeys.tokenPolicy(hospitalId), policy);
    },
    onError: (_error, { hospitalId }) => {
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.tokenPolicy(hospitalId) });
    },
  });
}
