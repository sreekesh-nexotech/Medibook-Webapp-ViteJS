import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { reinstateHospital } from '@/features/ops-hospitals/application/usecases/reinstateHospital';

/** Lift a suspension — the instance returns to active (or onboarding, if it never went live). */
export function useReinstateHospitalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await reinstateHospital(id)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.all });
    },
  });
}
